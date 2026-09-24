#!/usr/bin/env python3
# ─── Liquiditätsplanung KD Ventures (Excel) → MAKE OS Planposten ────────────
# Kevin, 24.09.2026: „nimm die aktuellste Liquid-Planung für KD Ventures mit
# rein, damit wir auf der Business-Seite die ganzen Finanzen sauber haben.“
#
# Liest die Treiber der Excel (Blätter „Umsatz“, „Kosten & Personal“,
# „Liquidität“) und legt je Vertrag, Gehalt, Kostenblock und Darlehen einen
# eigenen Planposten für kdv an — einzeln änderbar in MAKE OS. Beträge sind
# Zahlungen (brutto), so wie die Excel die Liquidität rechnet: Umsatz und
# Sachkosten × (1 + USt), Versicherung und Personal ohne USt, die USt-Zahllast
# im Folgemonat. Auf ganze Euro gerundet (so speichert MAKE OS).
#
# Wiederholbar: Posten mit der Kennung „lp-kdv-plan-…“ werden ersetzt, alles
# andere bleibt. Vorher wird der alte Stand nach .data/archiv gesichert.
#
#   python3 scripts/liquiplan-aus-excel.py <datei.xlsx>            # nur zeigen
#   python3 scripts/liquiplan-aus-excel.py <datei.xlsx> --schreiben
#
# Kein Download, keine Bibliothek: .xlsx ist ein ZIP mit XML.

import json, os, re, sys, zipfile, datetime, urllib.request
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
PRAEFIX = 'lp-kdv-plan-'
SPALTEN = 'CDEFGHIJKLMNOPQ'  # Monat 1 … 15 der Planung


def lies(pfad):
    z = zipfile.ZipFile(pfad)
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    ziel = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    blaetter = {}
    for s in wb.find('m:sheets', NS):
        t = ziel[s.get('{%s}id' % NS['r'])]
        t = t if t.startswith('xl/') else 'xl/' + t.lstrip('/')
        zellen = {}
        for c in ET.fromstring(z.read(t)).iter('{%s}c' % NS['m']):
            v, typ = c.find('m:v', NS), c.get('t')
            if v is None:
                continue
            zellen[c.get('r')] = ss[int(v.text)] if typ == 's' else v.text if typ in ('str', 'inlineStr') else float(v.text)
        blaetter[s.get('name')] = zellen
    return blaetter


def euro(x):
    """Kaufmännisch runden (Python rundet .5 sonst zur geraden Zahl)."""
    return int(x + 0.5) if x >= 0 else -int(-x + 0.5)


def monat(start, n):
    """Monat n (1 = Startmonat) als JJJJ-MM."""
    j, m = start
    m = m - 1 + (n - 1)
    return f'{j + m // 12}-{m % 12 + 1:02d}'


def baue(b, quelle):
    U, K, L = b['Umsatz'], b['Kosten & Personal'], b['Liquidität']
    zahl = lambda blatt, ref: float(blatt.get(ref) or 0)
    text = lambda blatt, ref: str(blatt.get(ref) or '').strip()
    # Startmonat aus der Kopfzeile („Okt 26“)
    kopf = text(L, 'C5')
    mon = {'Jan': 1, 'Feb': 2, 'Mrz': 3, 'Mär': 3, 'Apr': 4, 'Mai': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9, 'Okt': 10, 'Nov': 11, 'Dez': 12}
    m = re.match(r'(\w+)\s+(\d{2})', kopf)
    if not m or m.group(1) not in mon:
        raise SystemExit(f'Startmonat in Liquidität!C5 nicht lesbar: {kopf!r}')
    start = (2000 + int(m.group(2)), mon[m.group(1)])
    letzter = len(SPALTEN)
    ust = zahl(L, 'C8') or 0.19
    brutto = lambda netto: netto * (1 + ust)
    notiz = lambda s: f'{s} · aus {quelle}'
    posten = []

    def neu(slug, titel, betrag, rhythmus, ab, bis=None, kategorie=None, sicher=True, wahrscheinlich=None, n=''):
        if euro(betrag) == 0:
            return
        p = {'id': PRAEFIX + slug, 'titel': titel, 'betrag': euro(betrag), 'rhythmus': rhythmus, 'ab': ab, 'sicher': sicher, 'firmaId': 'kdv', 'notiz': notiz(n)}
        if bis: p['bis'] = bis
        if kategorie: p['kategorie'] = kategorie
        if wahrscheinlich is not None: p['wahrscheinlich'] = wahrscheinlich
        posten.append(p)

    # ── Umsatz: Retainer (Zeilen 10–17: Preis, Startmonat, Laufzeit, Name) ──
    for r in range(10, 18):
        preis, st, lz = zahl(U, f'C{r}'), int(zahl(U, f'D{r}')), int(zahl(U, f'E{r}'))
        if preis <= 0 or st <= 0 or lz <= 0:
            continue
        ende = min(letzter, st + lz - 1)
        name = text(U, f'B{r}') + (f' · {text(U, f"F{r}")}' if text(U, f'F{r}') else '')
        neu(f'retainer-{r - 9}', name, brutto(preis), 'monatlich', f'{monat(start, st)}-15', f'{monat(start, ende)}-28',
            'mandat', sicher=False, wahrscheinlich=60, n=f'{text(U, f"B{r}")}: {preis:.0f} € netto + {ust:.0%} USt, Monat {st}–{ende} der Planung. Unterschrieben? Dann auf „sicher“ stellen')
    # ── Umsatz: ASTARNA-Provisionen (Anzahl Kunden je Monat × Provision) ──
    prov = zahl(U, 'C23')
    anz = [zahl(U, f'{c}24') for c in SPALTEN]
    i = 0
    while i < letzter:
        if anz[i] <= 0:
            i += 1; continue
        j = i
        while j + 1 < letzter and anz[j + 1] == anz[i]:
            j += 1
        betrag = brutto(anz[i] * prov)
        titel = f'ASTARNA-Provision ({anz[i]:.0f} Kunden)'
        if j > i:
            neu(f'astarna-{i + 1}', titel, betrag, 'monatlich', f'{monat(start, i + 1)}-20', f'{monat(start, j + 1)}-28', 'sonstige-ein', False, 60, f'{prov:.0f} € je vermitteltem Kunden + USt')
        else:
            neu(f'astarna-{i + 1}', titel, betrag, 'einmalig', f'{monat(start, i + 1)}-20', None, 'sonstige-ein', False, 60, f'{prov:.0f} € je vermitteltem Kunden + USt')
        i = j + 1
    # ── Weitere Einnahmen (Zeilen 28–30), je Monat ──
    for r, slug in ((28, 'empfehlung'), (29, 'projekte'), (30, 'weitere')):
        for k, c in enumerate(SPALTEN):
            neu(f'{slug}-{k + 1}', text(U, f'B{r}'), brutto(zahl(U, f'{c}{r}')), 'einmalig', f'{monat(start, k + 1)}-20', None, 'sonstige-ein', False, 60, 'je Monat aus der Umsatzplanung')

    # ── Personal (Zeilen 9–13): Kosten/Monat inkl. AG-Anteil ab Monat ──
    for r in range(9, 13):
        kosten, ab = zahl(K, f'E{r}'), int(zahl(K, f'D{r}'))
        if kosten > 0 and ab > 0:
            neu(f'personal-{r}', text(K, f'B{r}').replace(' · ', ': '), -kosten, 'monatlich', f'{monat(start, ab)}-28', None, 'personal',
                n=f'{zahl(K, f"C{r}"):.0f} € brutto + {zahl(K, "C8"):.0%} Arbeitgeberanteil')
    if zahl(K, 'E13') > 0:
        neu('freelancer', 'Freelancer / externe Leistung', -zahl(K, 'E13'), 'monatlich', f'{monat(start, 1)}-28', None, 'personal', n='ohne Lohnnebenkosten')
    # ── Software und Lizenzen (16–23), Sonstige (27–33): netto → brutto; Versicherung (29) ohne USt ──
    for r in list(range(16, 24)) + list(range(27, 34)):
        netto = zahl(K, f'E{r}')
        if netto <= 0:
            continue
        ohne_ust = r == 29
        kat = 'raum' if r == 28 else 'betrieb'
        neu(f'kosten-{r}', text(K, f'B{r}') or f'Kosten Zeile {r}', -(netto if ohne_ust else brutto(netto)), 'monatlich', f'{monat(start, 1)}-01', None, kat,
            n=f'{netto:.2f} € netto/Monat' + ('' if ohne_ust else f' + {ust:.0%} USt'))
    # ── Jährliche Kosten (37–39: Betrag, Monat) ──
    for r in range(37, 40):
        betrag, mo = zahl(K, f'C{r}'), int(zahl(K, f'D{r}'))
        if betrag > 0 and mo > 0:
            neu(f'jaehrlich-{r}', text(K, f'B{r}'), -brutto(betrag), 'jaehrlich', f'{monat(start, mo)}-15', None, 'steuern' if 'IHK' in text(K, f'B{r}') else 'betrieb', n=f'{betrag:.0f} € netto im Jahr')
    # ── Einmalige Kosten (43–47) ──
    for r in range(43, 48):
        betrag, mo = zahl(K, f'C{r}'), int(zahl(K, f'D{r}'))
        if betrag > 0 and mo > 0:
            neu(f'einmalig-{r}', text(K, f'B{r}'), -brutto(betrag), 'einmalig', f'{monat(start, mo)}-15', None, 'betrieb', n=f'{betrag:.0f} € netto')
    # ── Darlehen (55–56: Rate, ab Monat, Restschuld) — bis zur letzten Rate, auch nach dem Planungszeitraum ──
    for r in (55, 56):
        rate, ab, rest = zahl(K, f'C{r}'), int(zahl(K, f'D{r}')), zahl(K, f'E{r}')
        if rate <= 0 or ab <= 0 or rest <= 0:
            continue
        volle = int(rest // rate)
        neu(f'darlehen-{r}', text(K, f'B{r}'), -rate, 'monatlich', f'{monat(start, ab)}-01', f'{monat(start, ab + volle - 1)}-28', 'kredite',
            n=f'Restschuld {rest:.0f} €, {volle} volle Raten, keine USt')
        if rest - volle * rate > 0:
            neu(f'darlehen-{r}-rest', f'{text(K, f"B{r}")} (letzte Rate)', -(rest - volle * rate), 'einmalig', f'{monat(start, ab + volle)}-01', None, 'kredite', n='Restbetrag')
    # ── USt-Zahllast (Liquidität Zeile 20, im Folgemonat am 10.) ──
    for k, c in enumerate(SPALTEN):
        z = zahl(L, f'{c}20')
        if z > 0:
            # Hängt an den geplanten Umsätzen — deshalb so unsicher wie sie.
            neu(f'ust-{k + 1}', f'USt-Zahllast für {monat(start, k)}', -z, 'einmalig', f'{monat(start, k + 1)}-10', None, 'steuern', sicher=False, wahrscheinlich=60,
                n='19 % × (Umsatz − Sachkosten) des Vormonats, laut Planung — kommt nur, wenn die Umsätze kommen')
    return posten, start


def monatssaldo(posten, start):
    """Summe je Planungsmonat (wie die Vorschau zählt), zum Abgleich mit Liquidität!Zeile 25."""
    raus = []
    for n in range(1, len(SPALTEN) + 1):
        mo = monat(start, n)
        s = 0
        for p in posten:
            ab, bis = p['ab'][:7], (p.get('bis') or '9999-12')[:7]
            if p['rhythmus'] == 'einmalig':
                if ab == mo: s += p['betrag']
            elif p['rhythmus'] == 'monatlich':
                if ab <= mo <= bis: s += p['betrag']
            elif p['rhythmus'] == 'jaehrlich':
                if ab <= mo <= bis and mo[5:] == ab[5:]: s += p['betrag']
        raus.append(s)
    return raus


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__ or 'Aufruf: liquiplan-aus-excel.py <datei.xlsx> [--schreiben]')
    pfad = sys.argv[1]
    b = lies(pfad)
    quelle = f'{os.path.basename(pfad)} ({datetime.datetime.fromtimestamp(os.path.getmtime(pfad)).strftime("%d.%m.%Y")})'
    posten, start = baue(b, quelle)
    # Abgleich gegen die Excel: Monatssaldo je Monat (Zeile 25)
    excel = [float(b['Liquidität'].get(f'{c}25') or 0) for c in SPALTEN]
    wir = monatssaldo(posten, start)
    abw = [round(w - e, 2) for w, e in zip(wir, excel)]
    print(f'{len(posten)} Planposten aus {quelle}, Start {monat(start, 1)}')
    print('Abweichung Monatssaldo MAKE OS − Excel je Monat (Rundung auf Euro):', abw)
    if max(abs(x) for x in abw) > 15:
        raise SystemExit('Abweichung über 15 € in einem Monat — nichts geschrieben. Hat sich der Aufbau der Excel geändert?')
    if '--schreiben' not in sys.argv:
        print(json.dumps(posten, ensure_ascii=False, indent=1)[:3000])
        return
    wurzel = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = dict(l.strip().split('=', 1) for l in open(os.path.join(wurzel, '.env.local')) if '=' in l and not l.startswith('#'))
    ort = os.environ.get('MAKE_OS_ORT', 'http://localhost:3001')
    kopf = {'x-make-key': env['MAKE_OS_KEY'], 'Origin': ort, 'Content-Type': 'application/json'}
    alt = json.load(urllib.request.urlopen(urllib.request.Request(f'{ort}/api/state/liquiplan', headers=kopf)))['posten']
    archiv = os.path.join(wurzel, '.data', 'archiv')
    os.makedirs(archiv, exist_ok=True)
    ziel = os.path.join(archiv, f'liquiplan-vor-excel-import-{datetime.datetime.now().strftime("%Y-%m-%d-%H%M%S")}.json')
    json.dump({'posten': alt}, open(ziel, 'w'), ensure_ascii=False, indent=1)
    # Was in MAKE OS entschieden wurde, gewinnt: ersetzte Plan-Posten bleiben weg,
    # und Einschätzung (sicher, Wahrscheinlichkeit) sowie Firma bleiben erhalten.
    eigene = [p for p in alt if not str(p.get('id', '')).startswith(PRAEFIX)]
    ersetzt = {p.get('ersetzt') for p in eigene if p.get('ersetzt')}
    vorher = {p['id']: p for p in alt if str(p.get('id', '')).startswith(PRAEFIX)}
    for p in posten:
        v = vorher.get(p['id'])
        if v:
            for feld in ('sicher', 'wahrscheinlich', 'firmaId'):
                if feld in v: p[feld] = v[feld]
            if v.get('notiz', '').startswith('Zu klären') and not p['notiz'].startswith('Zu klären'):
                p['notiz'] = v['notiz'].split(' · ')[0] + ' · ' + p['notiz']
    posten = [p for p in posten if p['id'] not in ersetzt]
    neu = eigene + posten
    req = urllib.request.Request(f'{ort}/api/state/liquiplan', data=json.dumps({'posten': neu}).encode(), headers=kopf, method='PUT')
    antwort = json.load(urllib.request.urlopen(req))
    print(f'Geschrieben: {len(neu)} Posten ({len(posten)} aus der Excel, {len(neu) - len(posten)} eigene). Alter Stand: {ziel}. Antwort ok={antwort.get("ok")}')


if __name__ == '__main__':
    main()
