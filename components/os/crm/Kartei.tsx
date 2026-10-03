'use client';

// ─── Markttraktion · Kontakte und Firmen (die Kartei) ────────────────────────────────────
// Personen: Kennzahlen im Kopf, gespeicherte Ansichten, Suche, Tastatur
// (/ sucht, j/k blättert, Enter öffnet, Esc schließt), Anlegen mit
// Dublettenprüfung. Die Karteikarte hat vier Reiter: Überblick (Kanäle,
// Beziehung, nächster Schritt, Deals, Entwurf) · Verlauf (Notizvorlage,
// Filter) · Stammdaten (die Matrix aller Felder der Masterdatei) · Recht
// (Art. 6/14/15/17/21, Einwilligungen, Werbesperre). Oben rechts „Kontakt
// öffnen“: dieselbe Person auf einer ganzen Seite (Akte.tsx), mit Zurück in die
// Kartei. Die Bausteine teilen sich Karte und „Kontakt öffnen“ (kontakt-teile.tsx).
// Lifecycle (28.09.): Filter als Wahl-Chip und eigene Spalte — gesetzt, sonst
// (leiser) „Lead“ (lib/crm/vorschlaege.ts `lifecycleVon`, H4).
// BEAN (28.09., H4): Filter als Wahl-Chip (auch aus der Adresse `bean=B|E|A|N`,
// Verteilungskarte im Überblick) und Spalte mit dem Buchstaben (lib/crm/bean.ts).
// Quelle ist die Masterdatei — das Adressbuch der Kontakte-App bleibt bewusst draußen.
// Zu zweit (25.09.): Filter „Alle · Meins · Malin“ nach „Zuständig“ (Feld `besitzer`, früher „Hält die Beziehung“)
// (ohne Eintrag: Sales-Verantwortung, Kevin), gefilterte Kontakte gesammelt
// übergeben, je Person „Übergeben“ und „Malin ist gerade hier“. Die private
// Notiz sieht nur, wer sie schrieb (serverseitig).

import { suchPasst } from '@/lib/text/such-norm';
import { useNachfrage } from './Nachfrage';
import { localDay } from '@/lib/zeit';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { SearchX } from 'lucide-react';
import { Karte, Ueberschrift, Leer, Leerzustand, Knopf, Chip, Punkt, feld, Spalten, Spalte, useBreit, LEUCHT } from '../ui';
import { anzeigename, STUFE_LABEL, HERKUNFT, type Kontakt, type Lebensphase, type Herkunft, rollenVon, ROLLE_LABEL } from '@/lib/make-one/crm';
import { ampel as kanalAmpel, art14, besterKanal } from '@/lib/crm/recht';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { dubletten, wanderungText, type Wanderung } from '@/lib/crm/dubletten';
import { type CrmApi, datum } from './daten';
import { KanalAmpel, Grund, Feldzeile, Pillen, Feld, AMPEL_FARBE } from './teile';
import { Wahl } from './Wahl';
import { Firmen, neueFirma } from './Firmen';
import { FirmenDatalist } from './FirmenDatalist';
import { bestehendeFirma } from '@/lib/crm/firmen';
import { Person, WerFilter, useWerFilter, passtWer, Uebergeben, AuchHier } from './team';
import { VisitenkarteKnopf } from './Visitenkarte';
import { LeadBlock } from './Leads';
import { PHASEN, phaseFarbe, phaseLabel, lifecycleFarbe, Hinweise, NaechsterSchrittTeil, BeziehungTeil, DealsTeil, EntwurfTeil, VerlaufTeil, RechtTeil, Matrix, LinkedInTeil } from './kontakt-teile';
import { gleicherName } from '@/lib/crm/visitenkarte';
import { haeltBeziehung, anderer, nameVon } from '@/lib/crm/team';
import { lifecycleVon } from '@/lib/crm/vorschlaege';
import { LIFECYCLE_PHASEN, LIFECYCLE_KURZ, LIFECYCLE_LABEL, type LifecyclePhase } from '@/lib/crm/lifecycle';
import { BEAN_IDS, BEAN_LABEL, BEAN_HINWEIS, beanVon, istBean, type BeanErgebnis, type BeanId } from '@/lib/crm/bean';
import { BeanBadge, BEAN_FARBE, useOffeneAngebote } from './bean-teile';
import { typenVon, kategorienVon, labelsVon, enthaeltEinenVon } from '@/lib/crm/mehrfach';
import { LABEL_DUBLETTE, LABEL_LEAD_PRUEFEN } from '@/lib/crm/netzwerken';
import { alleAdressen, hatAdresse } from '@/lib/crm/emails';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { neueKontaktKennung } from '@/lib/kennung';
import { useNaechsterTermin } from '../kalender/TermineAkte';

type Modus = 'personen' | 'firmen';
type Ansicht = 'alle' | 'kunden' | 'kreis' | 'prio' | 'chancen' | 'mail' | 'anreichern' | 'art14' | 'gesperrt' | 'dubletten' | 'dublette-pruefen' | 'lead-pruefen';
const ANSICHT_IDS: Ansicht[] = ['alle', 'kunden', 'kreis', 'prio', 'chancen', 'mail', 'anreichern', 'art14', 'gesperrt', 'dubletten', 'dublette-pruefen', 'lead-pruefen'];
const istAnsicht = (a?: string): a is Ansicht => !!a && (ANSICHT_IDS as string[]).includes(a);

export function Kartei({ api, name, modus, auswahl, setAuswahl, zuKontakt, zuFirma, start, zuRunde, zuAkte, startBean }: { api: CrmApi; name: (p: string) => string; modus: Modus; auswahl: string | null; setAuswahl: (id: string | null) => void; zuKontakt: (id: string) => void; zuFirma: (id: string) => void; start?: string; zuRunde?: (art: 'kreis' | 'chancen' | 'vernetzen') => void; zuAkte?: (id: string) => void;
  /** BEAN-Filter aus der Adresse (`bean=`), z. B. aus der Verteilungskarte im Überblick. */
  startBean?: string | null }) {
  const breit = useBreit();
  const [suche, setSuche] = useState('');
  // Die Ansicht kommt aus der Adresse (?a=art14|anreichern|gesperrt|…) — Befunde, Index-Punkte und Übergaben landen so auf der richtigen Liste (26.09.).
  const [ansicht, setAnsicht] = useState<Ansicht>(istAnsicht(start) ? start : 'alle');
  const [mehr, setMehr] = useState(80);
  const [markiert, setMarkiert] = useState(0);
  const [anlegen, setAnlegen] = useState(false);
  const sucheRef = useRef<HTMLInputElement>(null);
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const crm = api.crm;
  const heute = crm?.heute ?? localDay();
  const firmen = useMemo(() => new Map((crm?.stand.firmen ?? []).map(f => [f.id, f])), [crm]);
  const mitChance = useMemo(() => new Set((crm?.stand.chancen ?? []).filter(c => OFFENE_STUFEN.includes(c.stufe)).flatMap(c => c.kontaktIds)), [crm]);
  const mitMandat = useMemo(() => new Set((crm?.stand.mandate ?? []).filter(m => m.status === 'aktiv').flatMap(m => m.kontaktIds)), [crm]);
  const paare = useMemo(() => dubletten(kontakte), [kontakte]);
  useEffect(() => { if (istAnsicht(start)) setAnsicht(start); }, [start]);
  const [wer, setWer] = useWerFilter('kontakte');
  // Lifecycle (28.09.): gesetzt oder Vorschlag — je Person einmal gerechnet, Filter als Wahl-Chip.
  const [lc, setLc] = useState<LifecyclePhase | null>(null);
  const lifecycle = useMemo(() => new Map(kontakte.map(k => [k.id, lifecycleVon(k, crm?.stand, heute)])), [kontakte, crm, heute]);
  const lcZahl = useMemo(() => { const z = new Map<LifecyclePhase, number>(); for (const l of lifecycle.values()) z.set(l.phase, (z.get(l.phase) ?? 0) + 1); return z; }, [lifecycle]);
  // BEAN (28.09., H4): von Hand, sonst abgeleitet — mit den offenen Angeboten der Dateiablage.
  const angebote = useOffeneAngebote();
  const [bn, setBn] = useState<BeanId | null>(istBean(startBean) ? startBean : null);
  useEffect(() => { if (istBean(startBean)) setBn(startBean); }, [startBean]);
  const beans = useMemo(() => new Map(kontakte.map(k => [k.id, beanVon(k, crm?.stand, { angebote })])), [kontakte, crm, angebote]);
  const bnZahl = useMemo(() => { const z = new Map<BeanId, number>(); for (const b of beans.values()) z.set(b.bean, (z.get(b.bean) ?? 0) + 1); return z; }, [beans]);
  // Einordnung (28.09.): Typ, Kategorie, Label — mehrfach an der Person; der Filter trifft, wer den Wert trägt.
  const [ein, setEin] = useState<string | null>(null);
  const einordnung = useMemo(() => {
    const z = new Map<string, { label: string; n: number }>();
    const zaehle = (art: string, name: string, w: string) => { const id = `${art}:${w.toLocaleLowerCase('de-DE')}`; const e = z.get(id); z.set(id, { label: `${name}: ${e?.label.split(': ')[1] ?? w}`, n: (e?.n ?? 0) + 1 }); };
    for (const k of kontakte) { for (const t of typenVon(k)) zaehle('t', 'Typ', t); for (const t of kategorienVon(k)) zaehle('k', 'Kategorie', t); for (const t of labelsVon(k)) zaehle('l', 'Label', t); }
    return Array.from(z.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([id, x]) => ({ id, label: `${x.label} · ${x.n}` }));
  }, [kontakte]);
  const passtEin = useMemo(() => {
    if (!ein) return () => true;
    const [art, ...rest] = ein.split(':'); const w = rest.join(':');
    return (k: Kontakt) => enthaeltEinenVon(art === 't' ? typenVon(k) : art === 'k' ? kategorienVon(k) : labelsVon(k), [w]);
  }, [ein]);
  // Aus einer Übergabe-Aufgabe (…&wer=malin) direkt in die übergebenen Kontakte.
  useEffect(() => { const w = new URLSearchParams(window.location.search).get('wer'); if (w) setWer(w === api.ich ? 'ich' : w); }, [api.ich]); // eslint-disable-line react-hooks/exhaustive-deps
  const ich = api.ich;

  // Gemerkt (Prüfbericht 27.09., Punkt 20): zehn Filter über alle Kontakte liefen bei jedem Tastendruck in der Suche neu.
  const filter = useMemo<Record<Ansicht, (k: Kontakt) => boolean>>(() => ({
    alle: () => true, kunden: k => k.lebensphase === 'kunde', kreis: k => k.kreis === 'A' || k.kreis === 'B', prio: k => k.prio === 'A',
    chancen: k => mitChance.has(k.id), mail: k => !!k.email, anreichern: k => !k.email && !k.telefon && !k.sms || !k.firma,
    art14: k => !!art14(k, heute)?.faellig, gesperrt: k => ausgenommen(k), dubletten: k => paare.some(([a, b]) => a.id === k.id || b.id === k.id),
    // Arbeitslisten aus „Netzwerken“ (N3): die Labels „Dublette prüfen“ und „Lead prüfen“ setzt die Erfassung — hier stehen die Personen, die ein Mensch ansehen soll.
    'dublette-pruefen': k => !ausgenommen(k) && labelsVon(k).includes(LABEL_DUBLETTE), 'lead-pruefen': k => !ausgenommen(k) && labelsVon(k).includes(LABEL_LEAD_PRUEFEN),
  }), [mitChance, paare, heute]);
  const zaehlung = useMemo(() => { const z = {} as Record<Ansicht, number>; for (const id of Object.keys(filter) as Ansicht[]) z[id] = kontakte.filter(filter[id]).length; return z; }, [kontakte, filter]);
  const ANSICHTEN: { id: Ansicht; label: string }[] = ([
    ['alle', 'Alle'], ['kunden', 'Kunden'], ['kreis', 'Kreis A/B'], ['prio', 'Prio A'], ['chancen', 'Mit Deal'], ['mail', 'Mit E-Mail'], ['anreichern', 'Anreichern'], ['art14', 'Art. 14'], ['gesperrt', 'Gesperrt'], ['dubletten', 'Dubletten'],
  ] as [Ansicht, string][]).concat([['dublette-pruefen', 'Dublette prüfen'], ['lead-pruefen', 'Lead prüfen']] as [Ansicht, string][]).filter(([id]) => (id !== 'dublette-pruefen' && id !== 'lead-pruefen') || zaehlung[id] > 0 || ansicht === id).map(([id, l]) => ({ id, label: `${l} ${zaehlung[id]}` }));

  const treffer = useMemo(() => {
    const q = suche.trim();
    let l = kontakte.filter(filter[ansicht]).filter(k => passtWer(wer, k.besitzer, 'sales', ich)).filter(k => !lc || lifecycle.get(k.id)?.phase === lc).filter(k => !bn || beans.get(k.id)?.bean === bn).filter(passtEin);
    // Eine Such-Normalisierung (K2 #105): „mueller“ findet „Müller“ (auch NFD), „strasse“ „Straße“; jedes Wort muss passen.
    // Alle E-Mail-Adressen, Typen, Kategorien und Labels zählen mit (28.09.).
    if (q) l = l.filter(k => suchPasst([anzeigename(k), k.firma, ...alleAdressen(k), k.firmaBranche, k.position, k.firmaStadt, k.telefon, ...labelsVon(k), ...kategorienVon(k)], q));
    const rang = (k: Kontakt) => (k.lebensphase === 'kunde' ? 0 : k.kreis === 'A' ? 1 : k.kreis === 'B' ? 2 : k.prio === 'A' ? 3 : k.prio === 'B' ? 4 : 5);
    return [...l].sort((a, b) => (ansicht === 'dubletten' ? anzeigename(a).localeCompare(anzeigename(b)) : rang(a) - rang(b) || anzeigename(a).localeCompare(anzeigename(b))));
  }, [kontakte, suche, ansicht, filter, wer, ich, lc, lifecycle, bn, beans, passtEin]);
  const sichtbar = treffer.slice(0, mehr);
  const [erreichbar, freigegeben] = useMemo(() => [
    kontakte.filter(k => k.email || k.telefon || k.sms).length,
    kontakte.filter(k => kanalAmpel(k, { hatMandat: mitMandat.has(k.id) }).some(s => s.kanal === 'mail' && s.farbe === 'gruen')).length,
  ], [kontakte, mitMandat]);
  const werZahlen = ich ? { alle: kontakte.length, ich: kontakte.filter(k => passtWer('ich', k.besitzer, 'sales', ich)).length, [anderer(ich)]: kontakte.filter(k => passtWer(anderer(ich), k.besitzer, 'sales', ich)).length } : undefined;
  // Gesammelt übergeben geht nur mit einer Eingrenzung — nie aus Versehen die ganze Kartei.
  const eingegrenzt = !!suche.trim() || ansicht !== 'alle' || wer !== 'alle' || !!lc || !!bn || !!ein;
  const sammel = eingegrenzt && treffer.length > 0 && treffer.length <= 300 ? treffer.filter(k => !ausgenommen(k)) : [];

  // Tastatur wie in einer guten Liste: / sucht, j/k blättert, Enter öffnet, Esc schließt.
  useEffect(() => {
    if (modus !== 'personen') return;
    const taste = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const imFeld = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      if (e.key === 'Escape') { if (imFeld) (t as HTMLInputElement).blur(); else setAuswahl(null); return; }
      if (imFeld) return;
      if (e.key === '/') { e.preventDefault(); sucheRef.current?.focus(); }
      else if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setMarkiert(m => Math.min(sichtbar.length - 1, m + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setMarkiert(m => Math.max(0, m - 1)); }
      else if (e.key === 'Enter' && sichtbar[markiert]) setAuswahl(sichtbar[markiert].id);
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [modus, sichtbar, markiert, setAuswahl]);
  useEffect(() => { setMarkiert(0); }, [suche, ansicht]);
  // Zurück aus „Kontakt öffnen“ (oder ein Link mit ?k=): die gewählte Person steht einmal sichtbar in der Liste — späteres Anklicken springt nicht.
  const erstesMal = useRef(true);
  useEffect(() => {
    if (!erstesMal.current || modus !== 'personen' || !kontakte.length) return;
    const i = auswahl ? treffer.findIndex(x => x.id === auswahl) : -1;
    if (i >= mehr) { setMehr(i + 20); return; }
    erstesMal.current = false;
    if (i < 0) return;
    setMarkiert(i);
    // Erst scrollen, wenn das Layout steht: useBreit meldet die Spalten einen Takt nach dem ersten Zeichnen.
    setTimeout(() => document.querySelector(`[data-kid="${auswahl}"]`)?.scrollIntoView({ block: 'center' }), 150);
  }, [modus, auswahl, treffer, mehr, kontakte.length]);

  // Zusammenführungen der letzten 30 Tage, die noch zurück können (W4, 28.09.) — nur in der Ansicht „Dubletten“ geladen.
  const [zusammengefuehrt, setZusammengefuehrt] = useState<{ id: string; am: string; person: string; name: string; weg: string }[]>([]);
  const zusammenLaden = async () => {
    const r = await fetch('/api/crm/dubletten', { cache: 'no-store' }).then(x => x.json()).catch(() => null);
    if (r?.ok) setZusammengefuehrt(r.zusammenfuehrungen ?? []);
  };
  useEffect(() => { if (ansicht === 'dubletten') void zusammenLaden(); }, [ansicht]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Zusammenführen (W4): erst zeigen, was wandert, dann bestätigen — rückgängig bleibt 30 Tage möglich. */
  const zusammen = async (behalten: Kontakt, weg: Kontakt) => {
    const v = await fetch(`/api/crm/dubletten?behalten=${encodeURIComponent(behalten.id)}&weg=${encodeURIComponent(weg.id)}`, { cache: 'no-store' }).then(x => x.json()).catch(() => null) as { ok?: boolean; wandert?: Wanderung; grund?: string; fehler?: string } | null;
    if (!v?.ok || !v.wandert) { api.setFehler(v?.fehler ?? 'Vorschau nicht geladen — nichts zusammengeführt.'); return; }
    if (v.grund) { api.setFehler(v.grund); return; }
    if (!window.confirm(`„${anzeigename(behalten)}“ behalten und „${anzeigename(weg)}“ hineinführen?\n\nEs wandert: ${wanderungText(v.wandert)}.\n\nRückgängig geht 30 Tage lang (Dubletten › Zusammengeführt), solange niemand die Einträge seitdem ändert.`)) return;
    const r = await fetch('/api/crm/dubletten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ behalten: behalten.id, weg: weg.id }) }).then(x => x.json()).catch(() => null);
    await api.laden(true);
    if (r?.ok) { setAuswahl(behalten.id); void zusammenLaden(); } else api.setFehler(r?.fehler ?? 'Nicht zusammengeführt.');
  };
  const zurueck = async (laufId: string) => {
    const r = await fetch('/api/crm/dubletten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'rueckgaengig', laufId }) }).then(x => x.json()).catch(() => null);
    await api.laden(true);
    void zusammenLaden();
    if (!r?.ok) api.setFehler(r?.fehler ?? 'Nicht zurückgenommen.');
    else if (r.hinweis) api.setHinweis(r.hinweis);
  };

  const k = auswahl && !auswahl.startsWith('f-') ? kontakte.find(x => x.id === auswahl) ?? null : null;
  const { frage, dialog: nachfrage } = useNachfrage();
  const kopf = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input ref={sucheRef} value={suche} onChange={e => setSuche(e.target.value)} placeholder={modus === 'personen' ? 'Suchen: Name, Firma, Branche, Ort …  ( / )' : 'Firma, Domain, Branche, Ort …'} aria-label="Suchen" style={{ ...feld, flex: 1, minWidth: 200, padding: '9px 13px', fontSize: TYP.bedien }} />
      {modus === 'personen' && zuRunde && <><Knopf leise onClick={() => zuRunde('kreis')}>Kreis-Runde</Knopf><Knopf leise onClick={() => zuRunde('chancen')}>Qualifizierungs-Runde</Knopf><Knopf leise onClick={() => zuRunde('vernetzen')}>Vernetzen-Runde</Knopf></>}
      {modus === 'personen' ? <Knopf haupt onClick={() => setAnlegen(!anlegen)}>+ Person</Knopf>
        : <Knopf haupt onClick={async () => { const n = await frage('Name der Firma', { hinweis: 'Rechtsform gern dazu — Dubletten prüft die Kartei danach.' }); if (n?.trim()) { const da = bestehendeFirma(api.crm?.stand.firmen ?? [], n); if (da) { zuFirma(da.id); return; } const f = neueFirma(n); void api.setze('firmen', f as unknown as { id: string } & Record<string, unknown>).then(() => zuFirma(f.id)); } }}>+ Firma</Knopf>}
      {nachfrage}
    </div>
  );

  if (modus === 'firmen') {
    return (
      <>
        <Karte i={0}>{kopf}</Karte>
        <Firmen api={api} auswahl={auswahl?.startsWith('f-') ? auswahl : null} setAuswahl={setAuswahl} zuPerson={zuKontakt} suche={suche} />
      </>
    );
  }

  return (
    <>
      <Karte i={0}>
        {kopf}
        {anlegen && <Anlegen api={api} heute={heute} onFertig={id => { setAnlegen(false); if (id) setAuswahl(id); }} />}
      </Karte>
      <Spalten verhaeltnis="3:2">
        <Spalte>
          <Karte i={1}>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10 }}>
              <span><b style={{ color: C.ink }}>{eingegrenzt ? treffer.length : kontakte.length}</b> {eingegrenzt ? 'Treffer' : 'Personen'}</span>
              <span title="Mail oder Telefon vorhanden"><b style={{ color: C.ink }}>{erreichbar}</b> erreichbar</span>
              <span title="Werbung per Mail zulässig (Einwilligung oder Bestandskunde)"><b style={{ color: C.ink }}>{freigegeben}</b> Mail freigegeben</span>
              {breit && <span style={{ marginLeft: 'auto', color: C.inkLeise, fontSize: TYP.bedien }}>/ suchen · j k blättern · Enter öffnen</span>}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <WerFilter wahl={wer} onWahl={w => { setWer(w); setMehr(80); }} ich={ich} zahlen={werZahlen} />
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>nach „Zuständig“ · ohne Eintrag bei {nameVon('kevin')} (Sales-Verantwortung)</span>
              <span style={{ marginLeft: 'auto' }} title="BEAN: Bestandskunde · Ehemalig · Angebotskunde · Neu — von Hand oder abgeleitet">
                <Wahl label="BEAN" klein liste={BEAN_IDS.map(b => ({ id: b, label: `${b} · ${BEAN_LABEL[b]} · ${bnZahl.get(b) ?? 0}`, hinweis: BEAN_HINWEIS[b] }))}
                  wert={bn} leer="BEAN: alle ▾" farbe={bn ? BEAN_FARBE[bn] : undefined} onWahl={b => { setBn(b); setMehr(80); }} onLeeren={() => setBn(null)} leerenLabel="alle Gruppen" />
              </span>
              {einordnung.length > 0 && (
                <span title="Typ, Kategorie oder Label — trifft, wer den Wert trägt (mehrfach an der Person)">
                  <Wahl label="Einordnung" klein liste={einordnung} wert={ein} leer="Typ/Kategorie/Label: alle ▾" onWahl={x => { setEin(x); setMehr(80); }} onLeeren={() => setEin(null)} leerenLabel="alle" />
                </span>
              )}
              <span title="Lifecycle: gesetzt, sonst Lead">
                <Wahl label="Lifecycle" klein liste={LIFECYCLE_PHASEN.map(p => ({ id: p, label: `${LIFECYCLE_KURZ[p]} · ${lcZahl.get(p) ?? 0}`, ...(LIFECYCLE_KURZ[p] !== LIFECYCLE_LABEL[p] ? { hinweis: LIFECYCLE_LABEL[p] } : {}) }))}
                  wert={lc} leer="Lifecycle: alle ▾" farbe={lc ? lifecycleFarbe(lc) : undefined} onWahl={p => { setLc(p); setMehr(80); }} onLeeren={() => setLc(null)} leerenLabel="alle Lifecycle" />
              </span>
            </div>
            <div style={{ marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={ANSICHTEN} aktiv={ansicht} onWahl={a => { setAnsicht(a); setMehr(80); }} /></div>
            {sammel.length > 0 && ansicht !== 'dubletten' && (
              <div style={{ marginBottom: 10 }}>
                <Uebergeben api={api} art="kontakte" ids={sammel.map(x => x.id)} titel={`Diese ${sammel.length} übergeben`} klein />
              </div>
            )}
            {ansicht === 'dubletten' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {paare.map(([a, b]) => (
                  <div key={`${a.id}|${b.id}`} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 8 }}>
                    {[a, b].map(x => <div key={x.id} style={{ fontSize: TYP.bedien }}><b style={{ fontWeight: 600 }}>{anzeigename(x)}</b> <span style={{ color: C.inkLeise }}>· {x.email ?? 'ohne Mail'} · {x.firma ?? '—'} · {(x.aktivitaeten ?? []).length} Einträge</span></div>)}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Knopf leise onClick={() => zusammen(a, b)}>Erste behalten</Knopf><Knopf leise onClick={() => zusammen(b, a)}>Zweite behalten</Knopf></div>
                  </div>
                ))}
                {!paare.length && <Leer>Keine Dubletten.</Leer>}
                {zusammengefuehrt.length > 0 && (
                  <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                    <Ueberschrift>Zusammengeführt · 30 Tage rückgängig</Ueberschrift>
                    {zusammengefuehrt.map(z => (
                      <div key={z.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>
                        <span style={{ flex: 1, minWidth: 200 }}>{z.name} ← {z.weg} <span style={{ color: C.inkLeise }}>· {datum(z.am.slice(0, 10), heute)} · {nameVon(z.person)}</span></span>
                        <Knopf leise onClick={async () => { if (window.confirm(`Zusammenführung „${z.name} ← ${z.weg}“ zurücknehmen? Beide Einträge stehen danach wieder wie vorher da — nur, wenn seitdem niemand sie geändert hat.`)) await zurueck(z.id); }}>Rückgängig</Knopf>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Gleicher Name und ein zweites Merkmal (Firma, Domain, LinkedIn, Telefon). Verlauf, Einwilligungen und die zweite Mailadresse bleiben erhalten; eine Sperre gilt weiter. Vor dem Zusammenführen steht, was wandert; 30 Tage lang rückgängig.</div>
              </div>
            ) : (
              <div className="kartei-liste">
                {breit && (
                  <div className="kartei-zeile" style={{ display: 'grid', gap: 12, padding: '0 8px 6px', fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    <span /><span /><span>Name</span><span>Firma</span><span title="BEAN-Kundengruppe">BEAN</span><span>Lifecycle</span><span>Phase</span><span>Kanal</span><span style={{ textAlign: 'right' }}>Zuletzt</span>
                  </div>
                )}
                <div>
                  {sichtbar.map((x, i) => (
                    <div key={x.id} data-kid={x.id}>
                      <KarteiZeile k={x} firma={x.firmaId ? firmen.get(x.firmaId)?.name : undefined} lifecycle={lifecycle.get(x.id)} bean={beans.get(x.id)} breit={breit} aktiv={auswahl === x.id} markiert={i === markiert && breit}
                        chance={mitChance.has(x.id)} mandat={mitMandat.has(x.id)} heute={heute} onClick={() => { setMarkiert(i); setAuswahl(auswahl === x.id ? null : x.id); }} />
                      {auswahl === x.id && !breit && <div style={{ padding: '8px 0 18px' }}><Karteikarte k={x} api={api} name={name} zuFirma={zuFirma} zuAkte={zuAkte} /></div>}
                    </div>
                  ))}
                </div>
                {treffer.length > mehr && <div style={{ marginTop: 10 }}><Knopf leise onClick={() => setMehr(mehr + 150)}>Weitere {Math.min(150, treffer.length - mehr)} zeigen</Knopf></div>}
                {!treffer.length && <Leerzustand symbol={<SearchX size={26} />} titel="Niemand gefunden">Suche zurücksetzen oder eine andere Ansicht wählen.</Leerzustand>}
              </div>
            )}
          </Karte>
        </Spalte>
        {breit && (
          <Spalte klebt>
            <Karte i={2} akzent={k ? phaseFarbe(k.lebensphase) : undefined}>
              {k ? <Karteikarte k={k} api={api} name={name} zuFirma={zuFirma} zuAkte={zuAkte} /> : <Leer>Eine Person anklicken oder mit j/k wählen und Enter — Verlauf, Notiz, Kanäle, Stammdaten und Recht erscheinen hier. „Kontakt öffnen“ zeigt alles auf einer Seite.</Leer>}
            </Karte>
          </Spalte>
        )}
      </Spalten>
    </>
  );
}

// Die Spalten stehen in globals.css (`.kartei-zeile`): ist die Karte schmal (Rechner mit Leiste, zwei Spalten), fallen Lifecycle, Phase und Kanal weg — Name und Firma bleiben lesbar.

function KarteiZeile({ k, firma, lifecycle, bean, breit, aktiv, markiert, chance, mandat, heute, onClick }: { k: Kontakt; firma?: string; lifecycle?: { phase: LifecyclePhase; vonHand: boolean; grund: string }; bean?: BeanErgebnis; breit: boolean; aktiv: boolean; markiert: boolean; chance: boolean; mandat: boolean; heute: string; onClick: () => void }) {
  const kanal = besterKanal(k, { hatMandat: mandat, hatChance: chance });
  const a14 = art14(k, heute);
  const f = firma ?? k.firma;
  if (!breit) {
    return (
      <div onClick={onClick} className="zeile zeile-klick fassbar" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', background: aktiv ? 'rgba(255,255,255,.05)' : 'transparent', borderRadius: aktiv ? 10 : 0 }}>
        <Punkt farbe={ausgenommen(k) ? LEUCHT.kritisch : phaseFarbe(k.lebensphase)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: TYP.body, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anzeigename(k)}{f && <span style={{ color: C.inkLeise }}> · {f}</span>}</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[lifecycle ? LIFECYCLE_KURZ[lifecycle.phase] : '', k.position ?? k.jobtitel, k.naechsterSchritt ? `→ ${k.naechsterSchritt.text}` : ''].filter(Boolean).join(' · ')}</div>
        </div>
        {bean && <BeanBadge bean={bean.bean} vonHand={bean.vonHand} grund={bean.grund} />}
        {chance && <Chip farbe={LEUCHT.business}>Deal</Chip>}
        <span style={{ opacity: k.besitzer ? 1 : 0.45, display: 'inline-flex' }}><Person id={haeltBeziehung(k)} groesse={18} /></span>
      </div>
    );
  }
  return (
    <div onClick={onClick} className="fassbar kartei-zeile" title={[anzeigename(k), k.position, f].filter(Boolean).join(' · ')}
      style={{ display: 'grid', gap: 12, alignItems: 'center', padding: '8px 8px', minHeight: 44, borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', fontSize: TYP.bedien,
        background: aktiv ? 'rgba(255,255,255,.07)' : markiert ? 'rgba(88,217,205,.07)' : 'transparent', borderRadius: aktiv || markiert ? 8 : 0 }}>
      <Punkt farbe={ausgenommen(k) ? LEUCHT.kritisch : phaseFarbe(k.lebensphase)} groesse={8} />
      <span title={`Zuständig: ${nameVon(haeltBeziehung(k))}${k.besitzer ? '' : ' (Sales-Verantwortung)'}`} style={{ opacity: k.besitzer ? 1 : 0.45, display: 'inline-flex' }}><Person id={haeltBeziehung(k)} groesse={18} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anzeigename(k)}{k.prio === 'A' && <span style={{ color: LEUCHT.gut, marginLeft: 6, fontSize: 12 }}>A</span>}{a14?.faellig && <span style={{ color: LEUCHT.kritisch, marginLeft: 6, fontSize: 12 }}>Art. 14</span>}</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.naechsterSchritt ? `→ ${k.naechsterSchritt.text}` : (k.position ?? k.jobtitel ?? '')}</div>
      </div>
      <div style={{ color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f ?? '—'}</div>
      <div>{bean ? <BeanBadge bean={bean.bean} vonHand={bean.vonHand} grund={bean.grund} /> : '—'}</div>
      <div title={lifecycle ? `${LIFECYCLE_LABEL[lifecycle.phase]} — ${lifecycle.grund}` : undefined}
        style={{ fontSize: TYP.bedien, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: lifecycle ? lifecycleFarbe(lifecycle.phase) : C.inkLeise, opacity: lifecycle?.vonHand ? 1 : 0.6, fontStyle: lifecycle?.vonHand ? 'normal' : 'italic' }}>
        {lifecycle ? LIFECYCLE_KURZ[lifecycle.phase] : '—'}
      </div>
      <div style={{ color: k.lebensphase && k.lebensphase !== 'kontakt' ? phaseFarbe(k.lebensphase) : C.inkLeise, fontSize: TYP.bedien, whiteSpace: 'nowrap' }}>{phaseLabel(k.lebensphase)}{k.kreis ? ` · ${k.kreis}` : ''}{chance ? ' ·◆' : ''}</div>
      <div title={kanal ? `${kanal.kanal}: ${kanal.grund}` : 'kein zulässiger Kanal'} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: TYP.bedien, color: C.inkDim }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: kanal ? AMPEL_FARBE[kanal.farbe] : C.inkLeise }} />{kanal ? ({ telefon: 'Tel', mail: 'Mail', linkedin: 'LI', vernetzen: 'Netz', newsletter: 'NL', einladung: 'Einl' } as Record<string, string>)[kanal.kanal] : '—'}
      </div>
      <div style={{ textAlign: 'right', fontSize: TYP.bedien, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{k.letzterKontakt ? datum(k.letzterKontakt, heute) : '—'}</div>
    </div>
  );
}

function Anlegen({ api, heute, onFertig }: { api: CrmApi; heute: string; onFertig: (id: string | null) => void }) {
  // linkedin/webseite/mobil kommen nur von der Visitenkarte (keine eigenen Eingabefelder) und werden mit gespeichert.
  const [e, setE] = useState({ vorname: '', nachname: '', email: '', telefon: '', position: '', firma: '', lebensphase: 'kontakt' as Lebensphase, herkunft: undefined as Herkunft | undefined, anrede: 'Sie' as 'Sie' | 'Du', linkedin: '', webseite: '', mobil: '', vonKarte: false });
  const firmen = api.crm?.stand.firmen ?? [];
  const dublette = e.email.includes('@') ? (api.kontakte ?? []).find(k => hatAdresse(k, e.email)) : undefined;
  // Ohne Titel verglichen: „Dr. Anna Weber“ von der Karte ist „Anna Weber“ in der Kartei.
  const namensgleich = e.nachname.trim() ? (api.kontakte ?? []).find(k => gleicherName(k, e)) : undefined;
  // Auch „Muster GmbH“ zu „Muster“ (gleiche Kennung) — verknüpfen statt die bestehende Firma zu überschreiben (F1).
  const firma = bestehendeFirma(firmen, e.firma);
  const ok = e.nachname.trim() && !dublette;
  const anlegen = async () => {
    if (!ok) return;
    let firmaId = firma?.id;
    if (!firmaId && e.firma.trim()) { const f = { ...neueFirma(e.firma), ...(e.webseite ? { webseite: e.webseite } : {}) }; firmaId = f.id; await api.setze('firmen', f as unknown as { id: string } & Record<string, unknown>); }
    const id = neueKontaktKennung(); // Paket D-C #35: `c-<uuid>` — keine Zeit, keine E-Mail in der Kennung
    const herk = HERKUNFT.find(h => h.id === e.herkunft);
    await api.kontaktSetzen({
      id, vorname: e.vorname.trim(), nachname: e.nachname.trim(), ...(e.email.trim() ? { email: e.email.trim().toLowerCase() } : {}), ...(e.telefon.trim() ? { telefon: e.telefon.trim() } : {}),
      ...(e.position.trim() ? { position: e.position.trim() } : {}), ...(e.firma.trim() ? { firma: firma?.name ?? e.firma.trim(), firmaId } : {}),
      ...(e.mobil ? { sms: e.mobil } : {}), ...(e.linkedin ? { linkedin: e.linkedin } : {}), ...(e.webseite ? { firmaWebseite: e.webseite } : {}),
      eignung: '', prio: '', stufe: 'neu', lebensphase: e.lebensphase, anrede: e.anrede, ...(api.ich ? { besitzer: api.ich } : {}), ...(e.herkunft ? { herkunft: e.herkunft, ...(herk?.fremd ? { fremddaten: true } : {}) } : {}),
      quelle: e.vonKarte ? 'Visitenkarte' : 'Von Hand angelegt', aktivitaeten: [{ am: new Date().toISOString(), art: 'system', text: e.vonKarte ? 'Per Visitenkarte angelegt' : 'Von Hand angelegt', von: 'system' }], importiertAm: heute, geaendertAm: heute,
    });
    onFertig(id);
  };
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 14, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      {/* Visitenkarte fotografieren → Felder vorausgefüllt; die Karte kam von der Person selbst (keine Art.-14-Pflicht, aber keine Einwilligung). */}
      <VisitenkarteKnopf onErkannt={d => setE({ ...e, vorname: d.vorname ?? e.vorname, nachname: d.nachname ?? e.nachname, email: d.email ?? e.email, telefon: d.telefon ?? e.telefon, position: d.position ?? e.position, firma: d.firma ?? e.firma, linkedin: d.linkedin ?? e.linkedin, webseite: d.webseite ?? e.webseite, mobil: d.mobil ?? e.mobil, vonKarte: true, herkunft: e.herkunft ?? 'selbst' })} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 8 }}>
        <Feld wert={e.vorname} platzhalter="Vorname" onFertig={vorname => setE({ ...e, vorname })} />
        <Feld wert={e.nachname} platzhalter="Nachname *" onFertig={nachname => setE({ ...e, nachname })} />
        <Feld wert={e.email} platzhalter="E-Mail (Dublettenschlüssel)" onFertig={email => setE({ ...e, email })} />
        <Feld wert={e.telefon} platzhalter="Telefon" onFertig={telefon => setE({ ...e, telefon })} />
        <Feld wert={e.position} platzhalter="Position" onFertig={position => setE({ ...e, position })} />
        <div>
          <input list="crm-firmen" value={e.firma} onChange={x => setE({ ...e, firma: x.target.value })} placeholder="Firma (bestehend oder neu)" aria-label="Firma" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <FirmenDatalist id="crm-firmen" firmen={firmen} suche={e.firma} />
        </div>
      </div>
      <Feldzeile label="Lebensphase"><Wahl label="Lebensphase" liste={PHASEN} wert={e.lebensphase} onWahl={lebensphase => setE({ ...e, lebensphase })} /></Feldzeile>
      <Feldzeile label="Herkunft"><Wahl label="Herkunft" liste={HERKUNFT.map(h => ({ id: h.id, label: h.label, ...(h.fremd ? { hinweis: 'Art. 14' } : {}) }))} wert={e.herkunft} onWahl={herkunft => setE({ ...e, herkunft })} onLeeren={() => setE({ ...e, herkunft: undefined })} /></Feldzeile>
      <Feldzeile label="Anrede"><Pillen liste={[{ id: 'Sie', label: 'Sie' }, { id: 'Du', label: 'Du' }]} aktiv={e.anrede} onWahl={a => setE({ ...e, anrede: a as 'Sie' | 'Du' })} /></Feldzeile>
      {dublette && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>Diese Mail gehört schon zu {anzeigename(dublette)} — nicht doppelt anlegen.</div>}
      {!dublette && namensgleich && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>Achtung: {anzeigename(namensgleich)}{namensgleich.firma ? ` (${namensgleich.firma})` : ''} gibt es schon — gleiche Person?</div>}
      {e.firma.trim() && !firma && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Neue Firma „{e.firma.trim()}“ wird mit angelegt.</div>}
      <div style={{ display: 'flex', gap: 8 }}><Knopf aus={!ok} onClick={anlegen}>Anlegen</Knopf><Knopf leise onClick={() => onFertig(null)}>Abbrechen</Knopf><span style={{ fontSize: TYP.bedien, color: C.inkLeise, alignSelf: 'center' }}>* Pflichtfeld · Herkunft bestimmt die Art.-14-Pflicht</span></div>
    </div>
  );
}

type Reiter = 'ueberblick' | 'verlauf' | 'stamm' | 'recht';
function Karteikarte({ k, api, name, zuFirma, zuAkte }: { k: Kontakt; api: CrmApi; name: (p: string) => string; zuFirma: (id: string) => void; zuAkte?: (id: string) => void }) {
  const crm = api.crm;
  const heute = crm?.heute ?? localDay();
  const [reiter, setReiter] = useState<Reiter>('ueberblick');
  // Nächster Termin (F3, 29.09.): derselbe Kalender-Leser wie die Kontaktakte — über den Bezug, abgesagte nie.
  const termin = useNaechsterTermin(k.id);
  const firma = k.firmaId ? crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const chancen = (crm?.stand.chancen ?? []).filter(c => c.kontaktIds.includes(k.id));
  const mandate = (crm?.stand.mandate ?? []).filter(m => m.kontaktIds.includes(k.id));
  const ctx = { hatMandat: mandate.some(m => m.status === 'aktiv'), hatChance: chancen.some(c => OFFENE_STUFEN.includes(c.stufe)) };
  const ampel = kanalAmpel(k, ctx);
  const setze = (teil: Partial<Kontakt>) => api.kontaktTeil(k.id, teil);
  const mailOk = ampel.some(s => s.kanal === 'mail' && s.farbe !== 'rot');

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-.015em' }}>{anzeigename(k)}</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>
            {k.position ?? k.jobtitel ?? ''}{(k.position ?? k.jobtitel) && (firma || k.firma) ? ' · ' : ''}
            {firma ? <button onClick={() => zuFirma(firma.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.2)', fontSize: TYP.bedien }}>{firma.name}</button> : k.firma}
          </div>
        </div>
        {/* Kevin 25.09.: „rechts in dem Feld oben“ — die ganze Person auf einer Seite, mit Zurück in die Kartei (28.09.: „Kontakt öffnen“). */}
        {zuAkte && <button onClick={() => zuAkte(k.id)} className="fassbar" title="Alle Stammdaten, der ganze Verlauf und jede Verbindung auf einer Seite"
          style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 11, cursor: 'pointer', border: `1px solid ${LEUCHT.business}55`, background: `${LEUCHT.business}14`, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, whiteSpace: 'nowrap' }}>
          Kontakt öffnen <span aria-hidden style={{ color: LEUCHT.business }}>⤢</span>
        </button>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: -6, flexWrap: 'wrap' }}>
        <Chip farbe={phaseFarbe(k.lebensphase)}>{phaseLabel(k.lebensphase)}</Chip>{rollenVon(k).map(r => <Chip key={r} farbe={LEUCHT.business}>{ROLLE_LABEL[r]}</Chip>)}{k.kreis && <Chip farbe={LEUCHT.beziehung}>Kreis {k.kreis}</Chip>}
        <Chip farbe={C.inkDim}>{STUFE_LABEL[k.stufe] ?? k.stufe}</Chip>{k.prio && <Chip farbe={C.inkDim}>Prio {k.prio}</Chip>}
        <AuchHier passt={p => p.includes(`k=${k.id}`)} was="bei dieser Person" />
      </div>
      <Hinweise k={k} heute={heute} setze={setze} />
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen liste={[{ id: 'ueberblick', label: 'Überblick' }, { id: 'verlauf', label: `Verlauf ${(k.aktivitaeten ?? []).length}` }, { id: 'stamm', label: 'Stammdaten' }, { id: 'recht', label: 'Recht' }]} aktiv={reiter} onWahl={setReiter} farbe={LEUCHT.business} einzeilig /></div>

      {reiter === 'ueberblick' && (
        <>
          {termin && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${LEUCHT.puls}14`, fontSize: TYP.bedien, color: C.ink }}>Nächster Termin: <b style={{ fontWeight: 600 }}>{termin.titel}</b> · {datum(termin.start.slice(0, 10), heute)}{termin.ganztags ? '' : ` ${termin.start.slice(11, 16)}`}</div>}
          <div><Ueberschrift>Kanäle</Ueberschrift><KanalAmpel ampel={ampel} ziele={{ telefon: k.telefon ?? k.sms, email: k.email, linkedin: k.linkedin }} /><Grund ampel={ampel} /></div>
          <NaechsterSchrittTeil k={k} heute={heute} setze={setze} />
          <LinkedInTeil k={k} api={api} />
          <LeadBlock api={api} leadId={k.firmaId ?? k.id} />
          <BeziehungTeil k={k} api={api} setze={setze} />
          <DealsTeil k={k} api={api} />
          {(k.aufhaenger || k.signale || k.marktinfo) && (
            <div>
              <Ueberschrift>Einordnung</Ueberschrift>
              {k.aufhaenger && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginBottom: 6 }}><span style={{ color: C.inkLeise }}>Aufhänger:</span> {k.aufhaenger}</div>}
              {k.signale && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginBottom: 6 }}><span style={{ color: C.inkLeise }}>Signale:</span> {k.signale}</div>}
              {k.marktinfo && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}><span style={{ color: C.inkLeise }}>Markt:</span> {k.marktinfo}</div>}
            </div>
          )}
          <EntwurfTeil k={k} mailOk={mailOk} />
        </>
      )}

      {reiter === 'verlauf' && <VerlaufTeil k={k} api={api} name={name} heute={heute} />}
      {reiter === 'stamm' && <Matrix k={k} api={api} setze={setze} zuFirma={zuFirma} />}
      {reiter === 'recht' && <RechtTeil k={k} api={api} heute={heute} setze={setze} />}
    </div>
  );
}
