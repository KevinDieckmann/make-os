'use client';

// ─── Produkte (Produkte & Mandate › Produkte) ───────────────────────────────
// Kevin 25.09.: „Da werden wir unsere Produkte abbilden und Mandate abbilden.“ Seit 19.10. (P2, PRODUKTE_KONZEPT.md „Ein Produkt, eine Karte“,
// Kevin: „maximal einfach“): oben die Lage (Antwort zuerst), dann EINE Ansicht — die Leistungstreppe aus den Karten (Stufen links → rechts,
// Alternativen übereinander, darunter der Faden), „Ohne Stufe“ als Zeilen, darunter eingeklappt Kundenreise · Zielbild · Roadmap · Positionierung.
// Antippen öffnet die Karte (Fenster, Adresse `?s=produkte&k=<id>` = WEG.produkt), „+ Produkt“ das geführte Anlegen. Die frühere Liste nach
// Linien entfällt — die Linie ist ein Filter. Archiv und Papierkorb wie seit 04.10.: jede Zeile hängt am Baustein `ZeileAktionen` (Archivieren
// = „eingestellt“, zurückholbar; Löschen = Papierkorb 30 Tage, laufende Mandate/offene Deals → Rückfrage; endgültig nur aus dem Papierkorb).
// Gerechnet wird in lib/crm/produkt-katalog.ts (Ansicht) und lib/crm/produkte.ts (Zahlen); geschrieben über den Bestand (api.teil/setze).

import { WEG } from '@/lib/wege';
import { useMemo, useRef, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Leerzustand, Knopf, Chip, Punkt, Pillen, Lage, Hinweis, LEUCHT, Segmente, ZeileAktionen, useRueckgaengig, useRueckfrage, type LageEintrag } from '../ui';
import type { Leistung } from '@/lib/crm/typen';
import { produktZahlen, portfolio, produktZustand, produktVerweise, verweisSatz, produktePapierkorb, produktArchivieren, produktZurueck, linieVon } from '@/lib/crm/produkte';
import { katalogAnsicht, karteAusStufe, belegungText, kartenLuecken } from '@/lib/crm/produkt-katalog';
import { katalogTreppe } from '@/lib/crm/produkt-karte';
import { PAPIERKORB_TAGE } from '@/lib/eintraege/sicher';
import { type CrmApi, neueId, kurzEuro, datum } from '../crm/daten';
import { useLinkAuswahl } from '../Verlauf';
import { produktAngebotFehlt } from '@/lib/crm/angebote';
import { useTreppe } from './treppe/daten';
import { AusDokument } from './treppe/AusDokument';
import { TreppenStrategie } from './treppe/Treppe';
import { KatalogTreppe } from './KatalogTreppe';
import { ProduktKarte } from './karte/ProduktKarte';
import { ProduktAnlegen } from './karte/ProduktAnlegen';

const statusFarbe = (s: Leistung['status']) => (s === 'aktiv' ? LEUCHT.gut : s === 'entwurf' ? LEUCHT.achtung : C.inkLeise);
const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;

type Sicht = 'produkte' | 'archiv' | 'papierkorb';

export function Produkte({ api }: { api: CrmApi }) {
  const [auswahl, setAuswahl] = useLinkAuswahl();
  const [sicht, setSicht] = useState<Sicht>('produkte');
  const [linie, setLinie] = useState<string | null>(null);
  const [anlegen, setAnlegen] = useState<{ ebene: number | null } | null>(null);
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const treppe = useTreppe();
  const lage = treppe.lage;
  // „Als Produkt anlegen“: aus welcher Stufe welches Produkt entstand — ein zweiter Klick (Verknüpfen scheiterte) legt kein zweites an.
  const ausStufeAngelegt = useRef(new Map<string, string>());
  const crm = api.crm;
  const alle = useMemo(() => crm?.stand.leistungen ?? [], [crm]);
  const gespeicherte = useMemo(() => lage?.datei.stufen ?? [], [lage]);
  const ansicht = useMemo(() => katalogAnsicht({ leistungen: alle, gespeicherte, belegung: lage?.kapa.jeStufe, mandate: crm?.stand.mandate, linie }), [alle, gespeicherte, lage, crm, linie]);
  const kat = useMemo(() => katalogTreppe(alle, gespeicherte), [alle, gespeicherte]);
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const aktiv = alle.filter(l => produktZustand(l) === 'aktiv');
  const archiv = alle.filter(l => produktZustand(l) === 'archiv');
  const korb = produktePapierkorb(crm.stand);
  const p = portfolio(crm.stand);
  const offen = auswahl ? alle.find(l => l.id === auswahl && produktZustand(l) !== 'papierkorb') ?? null : null;

  // ── Archivieren · Zurückholen · Löschen (04.10.) — sicher statt endgültig, jeweils mit „Rückgängig“ ──
  const archivieren = (l: Leistung) => {
    const vorher = l.status;
    if (auswahl === l.id) setAuswahl(null);
    void api.teil('leistungen', l.id, produktArchivieren(l));
    melden(`„${l.name}“ archiviert — bleibt an Deals und Mandaten lesbar`, () => void api.teil('leistungen', l.id, { status: vorher }));
  };
  const zurueckholen = (l: Leistung) => {
    const felder = produktZurueck(l, !produktAngebotFehlt(l).length);
    void api.teil('leistungen', l.id, felder);
    melden(`„${l.name}“ ist zurück — ${felder.status === 'aktiv' ? 'wieder aktiv' : 'als Entwurf (Leistungstext fehlt für „aktiv“)'}`, () => void api.teil('leistungen', l.id, { status: 'eingestellt' }));
  };
  const inPapierkorb = (l: Leistung) => {
    if (auswahl === l.id) setAuswahl(null);
    // Die Zeit setzt der Server (lib/eintraege/sicher.ts `markeVomServer`) — der Browser schickt nur „jetzt“.
    void api.teil('leistungen', l.id, { geloeschtAm: new Date().toISOString() });
    melden(`„${l.name}“ im Papierkorb — 30 Tage wiederherstellbar`, () => void api.teil('leistungen', l.id, { geloeschtAm: null }));
  };
  const loeschen = (l: Leistung) => {
    const v = produktVerweise(l.id, crm.stand);
    const laufend = verweisSatz(v);
    if (!laufend) { inPapierkorb(l); return; }
    // Verknüpfungen: nie still — die Rückfrage nennt, was daran hängt, und bietet das Archiv als ruhigeren Weg an.
    fragen({
      titel: `„${l.name}“ in den Papierkorb?`,
      text: <>An diesem Produkt hängen {laufend}. Sie bleiben, wie sie sind, und zeigen das Produkt weiter an. Endgültig gelöscht wird es erst, wenn nichts mehr daran hängt — bis dahin liegt es im Papierkorb. Soll es nur nicht mehr angeboten werden, ist <b>Archivieren</b> der ruhigere Weg.</>,
      wahl: [{ label: 'Archivieren', ton: 'leise', tun: () => archivieren(l) }, { label: 'In den Papierkorb', ton: 'gefahr', tun: () => inPapierkorb(l) }],
    });
  };
  const wiederherstellen = (id: string, name: string) => {
    void api.teil('leistungen', id, { geloeschtAm: null });
    melden(`„${name}“ wiederhergestellt`, () => void api.teil('leistungen', id, { geloeschtAm: new Date().toISOString() }));
  };
  const endgueltig = (id: string, name: string) => fragen({
    titel: `„${name}“ endgültig löschen?`,
    text: 'Das Produkt verschwindet ganz — mit Angebotstexten, Phasen und Unterlagen-Links. Das lässt sich nicht rückgängig machen.',
    wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => api.weg('leistungen', id) }],
  });

  // ── Stufen ohne Produkt (gespeicherte Altstufen): „Als Produkt anlegen“ — nur auf Klick, die Kennung der Stufe bleibt ──
  const ausStufe = async (stufeId: string) => {
    const s = gespeicherte.find(x => x.id === stufeId);
    if (!s) return;
    let id = ausStufeAngelegt.current.get(stufeId);
    if (!id || !alle.some(l => l.id === id)) {
      id = neueId('l');
      if (!(await api.setze('leistungen', karteAusStufe(s, id) as unknown as { id: string } & Record<string, unknown>))) return;
      ausStufeAngelegt.current.set(stufeId, id);
    }
    // Verknüpfen: die Stufe gehört ab jetzt diesem Produkt (Karte gewinnt, die Stufe füllt Leeres) — Kundenfortschritt bleibt an derselben Kennung.
    if (await treppe.schreibe([{ op: 'stufe', eintrag: { id: s.id, leistungIds: [id] }, stand: s.stand }])) { setSicht('produkte'); setAuswahl(id); }
  };
  const stufeWeg = (stufeId: string) => {
    const s = gespeicherte.find(x => x.id === stufeId);
    if (!s) return;
    fragen({
      titel: `Stufe „${s.name}“ entfernen?`,
      text: 'Sie hängt an keinem Produkt. Verweise darauf (Kundenreise, Roadmap, Kunden) werden gelöst — die Mandate selbst bleiben unverändert.',
      wahl: [{ label: 'Entfernen', ton: 'gefahr', tun: () => void treppe.schreibe([{ op: 'stufe-weg', id: s.id, stand: s.stand }]) }],
    });
  };

  const zeile = (l: Leistung, archiviert = false) => {
    const z = produktZahlen(l, crm.stand);
    const k = ansicht.ohneStufe.find(x => x.leistungId === l.id);
    const unter = [k?.preisText ?? '', k ? belegungText(k) : z.mandateAktiv ? `${z.mandateAktiv} aktiv` : '', z.mrr ? `${kurzEuro(z.mrr)}/Monat` : '', k?.hinweis ?? ''].filter(Boolean).join(' · ');
    return (
      <ZeileAktionen titel={l.name} key={l.id} href={WEG.produkt(l.id)} onOeffnen={() => setAuswahl(l.id)} archiviert={archiviert} onArchivieren={() => (archiviert ? zurueckholen(l) : archivieren(l))} onLoeschen={() => loeschen(l)}>
        <Zeile onClick={() => setAuswahl(l.id)} links={<Punkt farbe={statusFarbe(l.status)} />} titel={l.name} umbrechen unter={unter}
          rechts={<span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{l.status === 'aktiv' && produktAngebotFehlt(l).length ? <Chip farbe={LEUCHT.achtung}>Text fehlt</Chip> : null}<Chip farbe={statusFarbe(l.status)}>{l.status === 'eingestellt' ? 'archiviert' : l.status}</Chip></span>} />
      </ZeileAktionen>
    );
  };

  // ── Antwort zuerst: die Lage in höchstens fünf Kacheln ──
  const unvollstaendig = aktiv.filter(l => kartenLuecken(l).length).length;
  const ohneStufeAktiv = ansicht.ohneStufe.length;
  const lageKacheln: LageEintrag[] = [
    { id: 'produkte', wert: String(aktiv.length), label: aktiv.length === 1 ? 'Produkt' : 'Produkte', unter: `${aktiv.filter(l => l.status === 'entwurf').length} davon Entwurf` },
    { id: 'kunden', wert: String(p.aktiv), label: p.aktiv === 1 ? 'Kunde jetzt' : 'Kunden jetzt', unter: 'aktive Mandate', href: WEG.mandat() },
    { id: 'mrr', wert: p.mrr ? kurzEuro(p.mrr) : '—', label: 'je Monat', unter: 'aus aktiven Mandaten' },
    { id: 'fehlt', wert: String(unvollstaendig), label: 'unvollständig', unter: 'Text, Preis oder Laufzeit fehlt', bedeutung: unvollstaendig ? 'achtung' : 'gut' },
    { id: 'ohne', wert: String(p.ohneProdukt), label: 'Mandate ohne Produkt', unter: p.ohneProdukt ? 'im Mandat zuordnen' : 'alle zugeordnet', bedeutung: p.ohneProdukt ? 'achtung' : undefined, href: WEG.mandat() },
  ];
  const leer = !aktiv.length && !ansicht.ebenen.length;
  // Alle Ebenen der Treppe (ohne Linien-Filter) — für die Wahl der Stufe beim Anlegen und in der Karte.
  const ebenen = Array.from(new Set(kat.stufen.map(s => s.ebene))).sort((a, b) => a - b);

  return (
    <>
      <Lage eintraege={lageKacheln} label="Produkte auf einen Blick" />
      <Segmente<Sicht> liste={[{ id: 'produkte', label: `Produkte · ${aktiv.length}` }, { id: 'archiv', label: `Archiv · ${archiv.length}` }, { id: 'papierkorb', label: `Papierkorb · ${korb.length}` }]} aktiv={sicht} onWahl={x => { setSicht(x); setAuswahl(null); }} />
      {sicht === 'produkte' && (
        <>
          {treppe.hinweis && <Hinweis art="achtung" aktion={<Knopf leise onClick={() => treppe.setHinweis(null)}>Ok</Knopf>}>{treppe.hinweis}</Hinweis>}
          <Karte i={0}>
            <Ueberschrift rechts={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{lage && <AusDokument ki={lage.ki} />}<Knopf haupt onClick={() => setAnlegen({ ebene: null })}>+ Produkt</Knopf></span>}>Leistungstreppe</Ueberschrift>
            {ansicht.linien.length > 1 && (
              <div style={{ marginBottom: 12 }}><Pillen<string> einzeilig liste={[{ id: '', label: 'Alle Linien' }, ...ansicht.linien.map(x => ({ id: x, label: x }))]} aktiv={linie ?? ''} onWahl={x => setLinie(x || null)} /></div>
            )}
            {treppe.fehler && !lage && <Hinweis art="kritisch">{treppe.fehler}</Hinweis>}
            {leer ? (
              <Leerzustand symbol="↗" titel="Noch keine Produkte" aktion={<Knopf onClick={() => setAnlegen({ ebene: 1 })}>Erstes Produkt anlegen</Knopf>}>
                Jedes Produkt ist eine Karte mit Preis, Vertrag, Texten und Ablauf. Mit einer Stufe steht es auf der Treppe — vom Einstieg bis zum großen Paket.
              </Leerzustand>
            ) : ansicht.ebenen.length ? (
              <KatalogTreppe ansicht={ansicht} onOeffnen={id => setAuswahl(id)} onNeu={linie ? undefined : e => setAnlegen({ ebene: e })} onAusStufe={ausStufe} onStufeWeg={stufeWeg} />
            ) : <Leer>Noch kein Produkt auf der Treppe — in der Karte eine Stufe wählen{linie ? ' (oder den Filter „Alle Linien“ nehmen)' : ''}.</Leer>}
            <div style={{ ...klein, marginTop: 10 }}>
              {ansicht.ebenen.length > 1 ? 'Von links nach rechts: jede Stufe bereitet die nächste vor; der Faden leuchtet bis zur höchsten Stufe mit Kunden. ' : ''}Antippen öffnet die Karte des Produkts.
              {lage?.kapa.jeStufe.some(x => x.ueber) ? ' Achtung: mindestens eine Stufe ist über ihrer Platzgrenze.' : ''}
            </div>
          </Karte>
          {ohneStufeAktiv > 0 && (
            <Karte i={1}>
              <Ueberschrift rechts={`${ohneStufeAktiv}`}>Ohne Stufe</Ueberschrift>
              <Liste>{ansicht.ohneStufe.map(k => alle.find(l => l.id === k.leistungId)).filter((l): l is Leistung => !!l).map(l => zeile(l))}</Liste>
              <div style={{ ...klein, marginTop: 8 }}>Einzelleistungen und Zusatzmodule dürfen hier stehen — mit einer Stufe in der Karte kommen sie auf die Treppe.</div>
            </Karte>
          )}
          {lage && <TreppenStrategie api={treppe} lage={lage} />}
        </>
      )}
      {sicht === 'archiv' && (
        <Karte i={1}>
          <Ueberschrift rechts={`${archiv.length}`}>Archiv</Ueberschrift>
          <Liste>{[...archiv].sort((a, b) => linieVon(a).localeCompare(linieVon(b), 'de') || a.name.localeCompare(b.name, 'de')).map(l => zeile(l, true))}</Liste>
          {!archiv.length && <Leer>Das Archiv ist leer. Ein archiviertes Produkt wird nicht mehr angeboten, bleibt an Deals und Mandaten lesbar und lässt sich jederzeit zurückholen.</Leer>}
        </Karte>
      )}
      {sicht === 'papierkorb' && (
        <Karte i={1}>
          <Ueberschrift rechts={`${PAPIERKORB_TAGE} Tage`}>Papierkorb</Ueberschrift>
          <Liste>
            {korb.map(e => (
              <Zeile key={e.id} links={<Punkt farbe={C.inkLeise} />} titel={e.name} umbrechen
                unter={`gelöscht ${datum(e.geloeschtAm.slice(0, 10))} · ${e.haengt ? `bleibt, solange ${[e.verweise.mandate ? `${e.verweise.mandate} Mandat${e.verweise.mandate === 1 ? '' : 'e'}` : '', e.verweise.deals ? `${e.verweise.deals} Deal${e.verweise.deals === 1 ? '' : 's'}` : ''].filter(Boolean).join(' und ')} darauf zeig${e.verweise.mandate + e.verweise.deals === 1 ? 't' : 'en'}` : `endgültig ab ${datum(e.bisTag)}`}`}
                rechts={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Knopf leise onClick={() => wiederherstellen(e.id, e.name)}>Wiederherstellen</Knopf>
                  {!e.haengt && <Knopf leise farbe={LEUCHT.kritisch} onClick={() => endgueltig(e.id, e.name)}>Endgültig löschen</Knopf>}
                </span>} />
            ))}
          </Liste>
          {!korb.length && <Leer>Der Papierkorb ist leer. Gelöschte Produkte liegen hier {PAPIERKORB_TAGE} Tage, bevor sie endgültig gehen.</Leer>}
        </Karte>
      )}
      {offen && (() => {
        const h = Object.entries(kat.herkunft).find(([, x]) => x.leistungId === offen.id);
        const stufeId = h?.[0] ?? null;
        const gespeichert = h && h[1].gespeichert ? gespeicherte.find(s => s.id === h[0]) ?? null : null;
        const b = stufeId ? lage?.kapa.jeStufe.find(x => x.stufeId === stufeId) : undefined;
        return (
          <ProduktKarte api={api} l={offen} gespeicherteStufe={gespeichert} besitztStufe={!!gespeichert} belegung={b ? { kunden: b.kunden, stundenWoche: b.stundenWoche } : null}
            ebenen={ebenen} zielJahr={lage?.datei.zielJahr} linien={ansicht.linien} onZu={() => setAuswahl(null)}
            onArchivieren={() => archivieren(offen)} onZurueckholen={() => zurueckholen(offen)} onLoeschen={() => loeschen(offen)} />
        );
      })()}
      {anlegen && <ProduktAnlegen api={api} ebene={anlegen.ebene} vorhandeneEbenen={ebenen} onZu={() => setAnlegen(null)} onFertig={id => { setAnlegen(null); setSicht('produkte'); setAuswahl(id); }} />}
      {dialog}
      {hinweis}
    </>
  );
}
