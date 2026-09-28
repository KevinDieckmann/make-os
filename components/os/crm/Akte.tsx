'use client';

// ─── Markttraktion · Kontakt öffnen ─────────────────────────────────────────
// Kevin 25.09.: rechts oben in der Karteikarte ein Knopf, dahinter „die ganze
// Matrix“ zur Person. Malin 27.09.: weniger scrollen. Kevin 28.09. (HubSpot als
// Vorbild, „Kontakt öffnen“ statt „Akte öffnen“): unser Kopf bleibt, darunter
// drei Spalten.
//   Kopf        Zurück · Name, Firma · Lifecycle (Wahl, ohne Phase „Lead“, Vorschlag nur höher) ·
//               BEAN (Wahl: abgeleitet sichtbar, von Hand markiert, 28.09. H4), Score, Typ,
//               Kategorie, Rollen, Kreis · hält die Beziehung · Kanäle · eine Zeile
//               Kennzahlen (letzter Kontakt, nächster Schritt, Takt, Gespräche, Deals, Vollständigkeit)
//   Links       Kontaktdaten · Schnellaktionen (Notiz · E-Mail · Anruf · Aufgabe · Meeting) ·
//               wichtigste Infos (KontaktSpalten.tsx)
//   Mitte       Reiter Über · Aktivitäten · Umsatz · Daten
//     Über         Zusammenfassung mit Quellen, nächster Schritt, Lead kurz, Beziehung kurz,
//                  letzte drei Aktivitäten (KontaktUeber.tsx)
//     Aktivitäten  kontakt/AktivitaetenReiter.tsx (Unter-Reiter `u` in der Adresse, Anker #akt-…)
//     Umsatz       kontakt/UmsatzReiter.tsx
//     Daten        Stammdaten (Matrix), Notiz, Beziehung, Netzwerk, Verbindungen, Recht,
//                  Anträge, Privat — einklappbar, zwei Spalten, wenn die Mitte breit genug ist
//   Rechts      Firma · Deals · Mandate · Follow-ups (KontaktSpalten.tsx)
// Ab SPALTEN_AB drei Spalten, darunter untereinander (links, Reiter, rechts).
// Abschnitte einklappbar (je Person gemerkt, localStorage mt-akte-zu-<id>), der
// zuletzt gewählte Reiter je Person ebenfalls (mt-akte-reiter-<id>).
// Adresse: /os/markttraktion?s=kontakte&a=akte&k=<id>&t=<reiter>&u=<unter> — ohne t „Über“;
// alte Links (a=akte, t=ueberblick|stammdaten|beziehung|verlauf|datenschutz) funktionieren weiter.
// Zurück (Knopf, Esc oder Browser) führt in die Kartei mit derselben Person.

import { localDay } from '@/lib/zeit';
import { nachOben } from '../Verlauf';
import { useRouter } from 'next/navigation';
import { WEG } from '@/lib/wege';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Chip, Punkt, LEUCHT, SPALTEN_AB } from '../schlank';
import { anzeigename, STUFE_LABEL, type Kontakt, rollenVon, ROLLE_LABEL } from '@/lib/make-one/crm';
import { ampel as kanalAmpel } from '@/lib/crm/recht';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { phaseVon } from '@/lib/crm/phase';
import { leadScore, temperaturFarbe, temperaturLabel } from '@/lib/crm/score';
import { lifecycleVorschlagHoeher } from '@/lib/crm/vorschlaege';
import { beanVon } from '@/lib/crm/bean';
import { vollstaendigkeit, verbindungen, takt, verlaufZahlen, TEILNAHME_LABEL, KAMPAGNEN_ERGEBNIS_LABEL } from '@/lib/crm/akte';
import { haeltBeziehung, nameVon } from '@/lib/crm/team';
import { AKTE_REITER, akteReiter, akteUnter, type AkteReiter } from '@/lib/crm/adresse';
import { type CrmApi, datum, euro } from './daten';
import { KanalAmpel, Grund, Pillen } from './teile';
import { Person, AuchHier } from './team';
import { phaseFarbe, phaseLabel, Hinweise, BeziehungTeil, RechtTeil, LinkedInTeil, MatrixTeilInhalt, MatrixZahl, MatrixZeile, MATRIX_TEIL_LABEL, type MatrixTeil } from './kontakt-teile';
import { Klappe, leiseKnopf, useKlappen, useBreite } from './kontakt-klappe';
import { KontaktLinks, KontaktRechts, LifecycleWahl } from './KontaktSpalten';
import { BeanWahl, useOffeneAngebote } from './bean-teile';
import { KontaktUeber } from './KontaktUeber';
import { AktivitaetenReiter } from './kontakt/AktivitaetenReiter';
import { UmsatzReiter } from './kontakt/UmsatzReiter';
import { typenVon, kategorienVon, labelsVon } from '@/lib/crm/mehrfach';
import { personenDerFirma } from '@/lib/crm/stationen';

/** Drei Spalten ab SPALTEN_AB, sonst untereinander. */
function useDrei(): boolean {
  const [drei, setDrei] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${SPALTEN_AB}px)`);
    const an = () => setDrei(mq.matches);
    an(); mq.addEventListener('change', an);
    return () => mq.removeEventListener('change', an);
  }, []);
  return drei;
}

const reiterMerker = (personId: string) => `mt-akte-reiter-${personId}`;
/** Ab dieser Breite der Mitte stehen Karten in zwei Spalten (Über, Daten). */
const MITTE_ZWEI_AB = 720;

/** Eine Kennzahl in der Kopfzeile: kleines Wort, Wert, optional ein Zusatz — alles in einer Zeile. */
function Kurz({ label, wert, zusatz, farbe, title }: { label: string; wert: ReactNode; zusatz?: ReactNode; farbe?: string; title?: string }) {
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0, maxWidth: '100%' }}>
      <span style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
      <b style={{ fontSize: 13, fontWeight: 700, color: farbe ?? C.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wert}</b>
      {zusatz && <span style={{ fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{zusatz}</span>}
    </span>
  );
}

/** Eine Zeile in „Verbindungen“: Punkt, Titel, Zusatz, Datum rechts. */
function VZeile({ farbe, titel, zusatz, am, heute, onClick }: { farbe: string; titel: ReactNode; zusatz?: ReactNode; am?: string; heute: string; onClick?: () => void }) {
  const inhalt = (
    <>
      <Punkt farbe={farbe} groesse={7} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b style={{ fontWeight: 600 }}>{titel}</b>{zusatz && <span style={{ color: C.inkLeise }}> · {zusatz}</span>}</span>
      {am && <span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{datum(am, heute)}</span>}
    </>
  );
  const stil = { display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', fontSize: TYP.bedien, color: C.ink, width: '100%', minHeight: 32 } as const;
  return onClick
    ? <button onClick={onClick} className="fassbar" style={{ ...stil, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text }}>{inhalt}<span aria-hidden style={{ color: C.inkLeise }}>›</span></button>
    : <div style={stil}>{inhalt}</div>;
}

/** Eine Spalte: Karten untereinander. Außerhalb der Komponente definiert, damit nichts bei jedem Zeichnen neu entsteht (sonst gingen Eingaben verloren). */
function Stapel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 14, minWidth: 0, alignContent: 'start' }}>{children}</div>;
}

/** Zwei Spalten, wenn Platz ist, sonst eine (links zuerst). */
function Zwei({ zwei, links, rechts }: { zwei: boolean; links: ReactNode; rechts: ReactNode }) {
  if (!zwei) return <Stapel>{links}{rechts}</Stapel>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
      <Stapel>{links}</Stapel>
      <Stapel>{rechts}</Stapel>
    </div>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return <div><Ueberschrift>{titel}</Ueberschrift>{children}</div>;
}

export function KontaktAkte({ api, id, name, zurueck, zuFirma, zuAkte, t, u, setReiter }: {
  api: CrmApi; id: string; name: (p: string) => string; zurueck: () => void; zuFirma: (id: string) => void; zuAkte: (id: string) => void;
  /** Der Reiter aus der Adresse (`t`), roh — null heißt: nicht angegeben. */
  t: string | null;
  /** Der Unter-Reiter der Aktivitäten aus der Adresse (`u`), roh. */
  u: string | null;
  /** Reiter wechseln = Adresse ersetzen (kein neuer Eintrag im Verlauf); `anker` springt im Reiter zu einem Eintrag. */
  setReiter: (t: AkteReiter, u?: string | null, anker?: string) => void;
}) {
  const router = useRouter();
  const drei = useDrei();
  const [mitteRef, mitteBreite] = useBreite<HTMLDivElement>();
  const zweiInDerMitte = mitteBreite >= MITTE_ZWEI_AB;
  const klappen = useKlappen(id);
  const angebote = useOffeneAngebote();
  const { istZu, umschalten } = klappen;
  const crm = api.crm;
  const heute = crm?.heute ?? localDay();
  const k = api.kontakte?.find(x => x.id === id) ?? null;
  const reiter = akteReiter(t);
  const unter = akteUnter(u);

  // Oben anfangen — die Kartei war vielleicht weit nach unten gescrollt. Gescrollt wird in <main> der Oberfläche, nicht im Fenster.
  useEffect(() => { nachOben(); }, [id]);
  // Zuletzt gewählter Reiter je Person: ohne `t` in der Adresse dorthin springen (ersetzt die Adresse — der Link von außen bleibt gültig).
  useEffect(() => {
    if (t !== null) return;
    try { const m = akteReiter(localStorage.getItem(reiterMerker(id))); if (m !== 'ueber') setReiter(m); } catch { /* ohne Speicher: Über */ }
    // Nur beim Öffnen einer Person — nicht bei jedem Reiterwechsel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const waehleReiter = (r: AkteReiter, unterReiter?: string | null, anker?: string) => {
    try { localStorage.setItem(reiterMerker(id), r); } catch { /* egal */ }
    setReiter(r, unterReiter, anker);
  };
  // Esc = zurück, außer beim Tippen oder wenn ein Fenster (z. B. „+ Gespräch“) offen ist.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      zurueck();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [zurueck]);

  const v = useMemo(() => (k && crm ? verbindungen(k, api.kontakte ?? [], crm.stand) : null), [k, crm, api.kontakte]);
  // Personen der Firma — für den Lead-Score im Kopf und die Lead-Qualifizierung (wie in den Leads).
  // Personen der Firma nur über die Stationen (28.09., `personenDerFirma`).
  const personen = useMemo(() => (k ? (k.firmaId ? personenDerFirma(api.kontakte ?? [k], k.firmaId) : [k]) : []), [k, api.kontakte]);

  const zurueckKnopf = (
    <button onClick={zurueck} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 10px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700 }}>
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>‹</span> Zurück zu Kontakte
    </button>
  );

  if (!api.kontakte) return <Karte i={0}>{zurueckKnopf}<Leer>Der Kontakt lädt …</Leer></Karte>;
  if (!k || !v) return <Karte i={0}>{zurueckKnopf}<Leer>Diese Person gibt es nicht mehr — gelöscht oder mit einer Dublette zusammengeführt.</Leer></Karte>;

  const firma = k.firmaId ? crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const offeneDeals = v.deals.filter(d => !d.ueberFirma && OFFENE_STUFEN.includes(d.stufe));
  const aktivesMandat = v.mandate.some(m => m.status === 'aktiv');
  const ampel = kanalAmpel(k, { hatMandat: aktivesMandat, hatChance: offeneDeals.length > 0 });
  // Stufe 2: nur die geänderten Felder — der Server legt sie auf den aktuellen Stand (409 bei Konflikt).
  const setze = (teil: Partial<Kontakt>) => api.kontaktTeil(k.id, teil);
  const voll = vollstaendigkeit(k, firma);
  const tk = takt(k, heute);
  const vz = verlaufZahlen(k);
  const zuletzt = k.letzterKontakt ?? vz.zuletzt;
  const termin = crm?.termine?.[k.id];
  const initialen = `${(k.vorname || '').charAt(0)}${(k.nachname || '').charAt(0)}`.toUpperCase() || '?';
  const ph = phaseVon(k, crm?.stand);
  const pf = phaseFarbe(ph.phase);
  // Lead-Score (27.09.): Firma-Lead vor Personen-Lead, Personen der Firma zählen mit (Wärme, Erreichbarkeit).
  const scoreAkte = leadScore(personen, firma?.lead ?? k.lead, heute);
  // Lifecycle (28.09., H4): ohne gesetzte Phase gilt Lead — ein Vorschlag nur, wenn er höher ist.
  const lcVorschlag = lifecycleVorschlagHoeher(k, crm?.stand, heute);
  // BEAN (28.09., H4): von Hand, sonst abgeleitet — mit den offenen Angeboten aus der Dateiablage.
  const beanErgebnis = beanVon(k, crm?.stand, { angebote });
  const dealWert = offeneDeals.reduce((s, d) => s + (d.wert.betrag || 0) * (d.wert.basis === 'monat' ? 12 : 1), 0);
  const schrittUeberfaellig = !!k.naechsterSchritt && k.naechsterSchritt.datum < heute;
  const vollFarbe = voll.anteil >= 0.7 ? LEUCHT.gut : voll.anteil >= 0.4 ? LEUCHT.achtung : LEUCHT.kritisch;

  /** Typ und Kategorie als Chips im Kopf (Malin 27.09.; mehrfach seit 28.09. — mit „ · “ verbunden) — ein Tipp springt in die Stammdaten. */
  const einordnungChip = (label: string, wert?: string) => (
    <button key={label} onClick={() => waehleReiter('daten')} title={wert ? `${label}: ${wert} — ändern unter Stammdaten oder links` : `${label} fehlt — unter Stammdaten oder links setzen`} className="fassbar"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: SCHRIFT.text }}>
      <Chip farbe={wert ? LEUCHT.agenten : C.inkLeise}>{wert ? `${label} · ${wert}` : `${label} —`}</Chip>
    </button>
  );

  const kopf = (
    <Karte i={0} akzent={pf}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {zurueckKnopf}
        <span style={{ fontSize: 12, color: C.inkLeise }}>Kontakt · geändert {datum(k.geaendertAm, heute)}{drei ? ' · Esc schließt' : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div aria-hidden style={{ width: 46, height: 46, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, color: pf, background: `${pf}18`, border: `2px solid ${pf}88`, boxShadow: `0 0 24px -6px ${pf}` }}>{initialen}</div>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h2 style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(20px, 2.2vw, 25px)', fontWeight: 700, letterSpacing: '-.02em', margin: 0, lineHeight: 1.15 }}>{anzeigename(k)}</h2>
          <div style={{ fontSize: TYP.body, color: C.inkDim, marginTop: 3 }}>
            {k.position ?? k.jobtitel ?? ''}{(k.position ?? k.jobtitel) && (firma || k.firma) ? ' · ' : ''}
            {firma ? <button onClick={() => zuFirma(firma.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.2)', fontSize: TYP.body, fontFamily: SCHRIFT.text }}>{firma.name}</button> : k.firma}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Lifecycle (28.09.) ersetzt hier die abgeleitete Phase — die Beziehungs-Lebensphase steht unter Stammdaten › Beziehung. */}
            <LifecycleWahl k={k} vorschlag={lcVorschlag} setze={setze} klein />
            <BeanWahl wert={k.bean} ergebnis={beanErgebnis} klein onSetze={b => void setze({ bean: b })} />
            <span title={scoreAkte.teile.map(x => `${x.label} ${x.punkte}/${x.max} — ${x.grund}`).join('\n')}><Chip farbe={temperaturFarbe(scoreAkte.temperatur)}>Score {scoreAkte.punkte} · {temperaturLabel(scoreAkte.temperatur)}</Chip></span>
            {einordnungChip('Typ', typenVon(k).join(' · ') || undefined)}{einordnungChip('Kategorie', kategorienVon(k).join(' · ') || undefined)}
            {labelsVon(k).map(l => <Chip key={`l-${l}`} farbe={LEUCHT.agenten}>{l}</Chip>)}
            {rollenVon(k).map(r => <Chip key={r} farbe={LEUCHT.business}>{ROLLE_LABEL[r]}</Chip>)}{k.kreis && <Chip farbe={LEUCHT.beziehung}>Kreis {k.kreis}</Chip>}
            <Chip farbe={C.inkDim}>{STUFE_LABEL[k.stufe]}</Chip>{k.prio && <Chip farbe={C.inkDim}>Prio {k.prio}</Chip>}
            {k.werbesperre && <Chip farbe={LEUCHT.kritisch}>Werbesperre</Chip>}
            {k.eingeschraenkt && <Chip farbe={LEUCHT.kritisch}>Eingeschränkt (Art. 18)</Chip>}
            <span title={`Zuständig: ${nameVon(haeltBeziehung(k))}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkLeise, marginLeft: 4 }}><Person id={haeltBeziehung(k)} groesse={18} />{nameVon(haeltBeziehung(k))}</span>
            <AuchHier passt={p => p.includes(`k=${k.id}`)} was="bei dieser Person" />
          </div>
        </div>
        <div style={{ flex: '0 1 auto', minWidth: 0, display: 'grid', gap: 4, justifyItems: drei ? 'end' : 'start' }}>
          <KanalAmpel ampel={ampel} ziele={{ telefon: k.telefon ?? k.sms, email: k.email, linkedin: k.linkedin }} />
          <Grund ampel={ampel} />
        </div>
      </div>
      {termin && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 10, background: `${LEUCHT.puls}14`, fontSize: TYP.bedien }}>Nächster Termin: <b style={{ fontWeight: 600 }}>{termin.titel}</b> · {datum(termin.start.slice(0, 10), heute)} {termin.start.slice(11, 16)}</div>}
      <div style={{ display: 'flex', gap: '8px 22px', flexWrap: 'wrap', alignItems: 'baseline', marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <Kurz label="Letzter Kontakt" wert={zuletzt ? datum(zuletzt, heute) : 'noch keiner'} farbe={zuletzt ? undefined : C.inkLeise} title={vz.eintraege ? `${vz.eintraege} Einträge im Verlauf` : 'Verlauf leer'} />
        <Kurz label="Nächster" wert={k.naechsterSchritt ? datum(k.naechsterSchritt.datum, heute) : 'keiner'} zusatz={k.naechsterSchritt?.text} farbe={!k.naechsterSchritt ? LEUCHT.achtung : schrittUeberfaellig ? LEUCHT.kritisch : undefined} title={k.naechsterSchritt?.text ?? 'Ohne Schritt verliert sich die Person'} />
        <Kurz label="Takt" wert={tk ? (tk.ueberfaellig ? 'jetzt melden' : `fällig ${datum(tk.faelligAm, heute)}`) : 'kein Kreis'} farbe={tk?.ueberfaellig ? LEUCHT.achtung : tk ? undefined : C.inkLeise} title={tk ? `alle ${tk.tage} Tage${tk.seit !== null ? ` · seit ${tk.seit} T still` : ''}` : 'Kreis A–D setzt den Takt'} />
        <Kurz label="Gespräche" wert={vz.gespraeche} title="echte Gespräche und Termine" />
        <Kurz label="Deals" wert={offeneDeals.length ? `${offeneDeals.length} offen` : aktivesMandat ? 'Mandat aktiv' : 'kein Deal'} zusatz={offeneDeals.length && dealWert ? `${euro(dealWert)} im Jahr` : undefined} farbe={offeneDeals.length || aktivesMandat ? LEUCHT.gut : C.inkLeise} title={`${v.mandate.length} Mandat${v.mandate.length === 1 ? '' : 'e'}`} />
        <Kurz label="Vollständig" wert={`${Math.round(voll.anteil * 100)} %`} zusatz={`${voll.gefuellt}/${voll.gesamt}`} farbe={vollFarbe} title={`${voll.gefuellt} von ${voll.gesamt} Feldern der Matrix gefüllt`} />
      </div>
    </Karte>
  );

  const reiterListe = AKTE_REITER.map(r => ({ id: r.id, label: r.id === 'aktivitaeten' && vz.eintraege ? `Aktivitäten · ${vz.eintraege}` : r.label }));
  const reiterLeiste = (
    <div role="tablist" aria-label="Kontakt" style={{ overflowX: 'auto', scrollbarWidth: 'none', margin: '2px 0 -2px' }}>
      <Pillen einzeilig liste={reiterListe} aktiv={reiter} onWahl={r => waehleReiter(r, r === 'aktivitaeten' ? unter : undefined)} farbe={C.ink} />
    </div>
  );

  // ── Daten: Stammdaten (Matrix), Notiz, Beziehung, Netzwerk, Verbindungen, Recht, Anträge, Privat ──
  const matrixKlappe = (teil: MatrixTeil, i: number, unterText?: string) => (
    <Klappe key={teil} id={`matrix-${teil}`} i={i} titel={MATRIX_TEIL_LABEL[teil]} unter={unterText} rechts={<>{teil === 'firma' && firma && <button onClick={() => zuFirma(firma.id)} style={leiseKnopf}>Firma öffnen ›</button>}<MatrixZahl teil={teil} k={k} api={api} /></>} zu={istZu(`matrix-${teil}`)} umschalten={umschalten}>
      <MatrixTeilInhalt teil={teil} k={k} api={api} setze={setze} zuFirma={zuFirma} />
    </Klappe>
  );
  const firmenDeals = v.deals.filter(d => d.ueberFirma);
  const nichtsVerbunden = !v.events.length && !v.kampagnen.length && !v.beitraege.length && !v.powerHour.length && !v.kollegen.length && !firmenDeals.length;
  const verbindungenKlappe = (
    <Klappe id="verbindungen" i={7} titel="Verbindungen" unter="Wo die Person sonst im System vorkommt" zu={istZu('verbindungen')} umschalten={umschalten}>
      <div style={{ display: 'grid', gap: 16 }}>
        {v.kollegen.length > 0 && <Abschnitt titel={`Kollegen bei ${firma?.name ?? k.firma ?? 'der Firma'} · ${v.kollegen.length}`}>
          {v.kollegen.slice(0, 12).map(x => <VZeile key={x.id} farbe={x.werbesperre ? LEUCHT.kritisch : phaseFarbe(x.lebensphase)} titel={anzeigename(x)} zusatz={x.position ?? x.jobtitel ?? phaseLabel(x.lebensphase)} am={x.letzterKontakt} heute={heute} onClick={() => zuAkte(x.id)} />)}
          {v.kollegen.length > 12 && <div style={{ fontSize: 12, color: C.inkLeise }}>… und {v.kollegen.length - 12} weitere in der Firmenkarte.</div>}
        </Abschnitt>}
        {firmenDeals.length > 0 && <Abschnitt titel="Deals der Firma">
          {firmenDeals.map(d => <VZeile key={d.id} farbe={OFFENE_STUFEN.includes(d.stufe) ? LEUCHT.business : C.inkLeise} titel={d.titel} zusatz={`${crm?.stufen.find(s => s.id === d.stufe)?.label ?? d.stufe}${d.wert.betrag ? ` · ${euro(d.wert.betrag)}${d.wert.basis === 'monat' ? '/Monat' : ''}` : ''} · ohne diese Person`} am={d.geaendert} heute={heute} onClick={() => router.push(WEG.deal(d.id))} />)}
        </Abschnitt>}
        {v.events.length > 0 && <Abschnitt titel="Events">
          {v.events.map(e => <VZeile key={e.teilnahme.id} farbe={e.teilnahme.status === 'da' ? LEUCHT.gut : e.teilnahme.status === 'no_show' || e.teilnahme.status === 'abgesagt' ? C.inkLeise : LEUCHT.puls} titel={e.event.titel} zusatz={TEILNAHME_LABEL[e.teilnahme.status]} am={e.event.datum} heute={heute} onClick={() => router.push(WEG.event(e.event.id))} />)}
        </Abschnitt>}
        {v.kampagnen.length > 0 && <Abschnitt titel="Kampagnen">
          {v.kampagnen.map(x => <VZeile key={x.kampagne.id} farbe={x.ergebnis === 'gespraech' || x.ergebnis === 'chance' ? LEUCHT.gut : x.ergebnis ? LEUCHT.puls : C.inkLeise} titel={x.kampagne.name} zusatz={x.ergebnis ? KAMPAGNEN_ERGEBNIS_LABEL[x.ergebnis] : 'noch nicht angesprochen'} am={x.am} heute={heute} onClick={() => router.push(WEG.kampagne(x.kampagne.id))} />)}
        </Abschnitt>}
        {v.beitraege.length > 0 && <Abschnitt titel="Marketing-Wirkung">
          {v.beitraege.map((b, i) => <VZeile key={`${b.beitrag.id}-${i}`} farbe={LEUCHT.agenten} titel={b.beitrag.titel} zusatz={b.art} am={b.am} heute={heute} onClick={() => router.push(WEG.marketing('redaktion'))} />)}
        </Abschnitt>}
        {v.powerHour.length > 0 && <Abschnitt titel="Power Hour">
          {v.powerHour.slice(0, 8).map((p, i) => <VZeile key={i} farbe={LEUCHT.puls} titel={nameVon(p.person)} zusatz={[p.ergebnis, p.notiz].filter(Boolean).join(' · ') || 'auf der Liste'} am={p.datum} heute={heute} onClick={() => router.push(WEG.powerHour())} />)}
        </Abschnitt>}
        {nichtsVerbunden && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Noch keine Kollegen, Events, Kampagnen oder Beiträge mit dieser Person.</div>}
      </div>
    </Klappe>
  );
  const daten = (
    <Zwei zwei={zweiInDerMitte}
      links={<>
        {matrixKlappe('einordnung', 1, 'Typ und Kategorie zuerst — Chip antippen: alle Werte, Suche, „+ neu …“ legt an.')}
        {matrixKlappe('person', 2, 'Antippen zum Bearbeiten, Enter speichert, Esc verwirft.')}
        {matrixKlappe('firma', 3, firma ? 'Aus dem Firmeneintrag — gilt für alle Personen der Firma.' : 'Aus dem Import — eine Firma zuordnen bündelt die Felder.')}
        {matrixKlappe('herkunft', 4)}
        <Klappe id="notiz" i={5} titel="Notiz" unter="Für alle im Team — die private Notiz steht unten unter Privat." zu={istZu('notiz')} umschalten={umschalten}>
          <MatrixZeile label="Notiz" lang wert={k.notiz} onFertig={x => void setze({ notiz: x || undefined })} />
        </Klappe>
      </>}
      rechts={<>
        <Klappe id="beziehung" i={6} titel="Beziehung" unter="Kreis, Takt, Rollen, Ansprache, Lebensphase — wer sie hält" zu={istZu('beziehung')} umschalten={umschalten}>
          <BeziehungTeil k={k} api={api} setze={setze} ohneTitel />
          {tk && <div style={{ fontSize: 12.5, color: tk.ueberfaellig ? LEUCHT.achtung : C.inkLeise, marginTop: 6 }}>Takt: alle {tk.tage} Tage · {tk.ueberfaellig ? 'jetzt melden' : `fällig ${datum(tk.faelligAm, heute)}`}{tk.seit !== null ? ` · seit ${tk.seit} T still` : ''}</div>}
        </Klappe>
        <Klappe id="netzwerk" i={7} titel="Netzwerk" unter="LinkedIn — Profil, Stand je Person, nächster Schritt" zu={istZu('netzwerk')} umschalten={umschalten}>
          <LinkedInTeil k={k} api={api} />
        </Klappe>
        {verbindungenKlappe}
        <Klappe id="recht" i={8} titel="Datenschutz" unter="DSGVO und § 7 UWG — worauf die Ansprache beruht" zu={istZu('recht')} umschalten={umschalten}>
          <RechtTeil k={k} api={api} heute={heute} setze={setze} />
        </Klappe>
        <Klappe id="antraege" i={9} titel="Betroffenenanträge" unter={v.antraege.length ? `${v.antraege.length} zu dieser Person` : 'Keine Anträge zu dieser Person.'} rechts={<button onClick={() => router.push(WEG.stammdaten('datenschutz'))} style={leiseKnopf}>Alle Anträge ›</button>} zu={istZu('antraege')} umschalten={umschalten}>
          {v.antraege.map(a => <VZeile key={a.id} farbe={a.status === 'offen' ? LEUCHT.kritisch : C.inkLeise} titel={a.art} zusatz={a.status === 'offen' ? `Frist ${datum(a.frist, heute)}` : 'erledigt'} am={a.eingang} heute={heute} onClick={() => router.push(WEG.stammdaten('datenschutz'))} />)}
          {!v.antraege.length && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Auskunft, Löschung und Widerspruch werden unter Stammdaten › Datenschutz geführt.</div>}
        </Klappe>
        <Klappe id="privat" i={10} titel="Privat" unter="Nur für dich sichtbar · nie an Agenten" zu={istZu('privat')} umschalten={umschalten}>
          <MatrixTeilInhalt teil="privat" k={k} api={api} setze={setze} zuFirma={zuFirma} />
        </Klappe>
      </>}
    />
  );

  const mitte = (
    <div ref={mitteRef} style={{ display: 'grid', gap: 14, minWidth: 0, alignContent: 'start' }}>
      {reiterLeiste}
      <div role="tabpanel" aria-label={AKTE_REITER.find(r => r.id === reiter)?.label} style={{ display: 'grid', gap: 14, minWidth: 0 }}>
        {reiter === 'ueber' && <KontaktUeber k={k} api={api} heute={heute} name={name} setze={setze} klappen={klappen} breit={zweiInDerMitte} zuReiter={waehleReiter} personen={personen} />}
        {reiter === 'aktivitaeten' && <AktivitaetenReiter k={k} api={api} unter={unter} onUnter={x => waehleReiter('aktivitaeten', x)} zuKontakt={zuAkte} />}
        {reiter === 'umsatz' && <UmsatzReiter k={k} api={api} zuDeal={dealId => router.push(WEG.deal(dealId))} />}
        {reiter === 'daten' && daten}
      </div>
    </div>
  );
  const links = <KontaktLinks k={k} api={api} heute={heute} ampel={ampel} setze={setze} klappen={klappen} lifecycle={lcVorschlag} bean={beanErgebnis} />;
  const rechts = <KontaktRechts k={k} api={api} heute={heute} setze={setze} klappen={klappen} zuFirma={zuFirma} zuAufgabe={anker => waehleReiter('aktivitaeten', 'aufgaben', anker)} />;

  return (
    <>
      {kopf}
      <Hinweise k={k} heute={heute} setze={setze} />
      {drei ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, 270px) minmax(0, 1fr) minmax(240px, 290px)', gap: 14, alignItems: 'start' }}>
          <Stapel>{links}</Stapel>
          {mitte}
          <Stapel>{rechts}</Stapel>
        </div>
      ) : (
        <Stapel>{links}{mitte}{rechts}</Stapel>
      )}
    </>
  );
}
