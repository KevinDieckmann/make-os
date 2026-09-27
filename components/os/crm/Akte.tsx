'use client';
import { phaseVon } from '@/lib/crm/phase';
import { leadScore, temperaturFarbe, temperaturLabel } from '@/lib/crm/score';

// ─── Markttraktion · Kontaktakte ────────────────────────────────────────────
// Kevin 25.09.: rechts oben in der Karteikarte ein Knopf, dahinter „die ganze
// Matrix“ zur Person. Malin 27.09.: weniger scrollen — deshalb ein kompakter
// Kopf und darunter Reiter statt Endlos-Stapel:
//   Kopf        Zurück · Name, Firma · Phase, Score, Typ, Kategorie, Rollen,
//               Kreis · hält die Beziehung · Kanäle · eine Zeile Kennzahlen
//               (letzter Kontakt, nächster Schritt, Takt, Gespräche, Deals, Vollständigkeit)
//   Reiter      Überblick · Stammdaten · Beziehung · Verlauf · Datenschutz
//     Überblick    Vertrieb (nächster Schritt, Deals & Mandate, Lead) · Beziehung kurz ·
//                  letzte 5 Aktivitäten · Notiz
//     Stammdaten   die Matrix: Einordnung (Typ, Kategorie zuerst), Person · Firma, Herkunft
//     Beziehung    Kreis, Takt, Rollen, Ansprache, LinkedIn · Verbindungen (Kollegen,
//                  Deals der Firma, Events, Kampagnen, Marketing-Wirkung, Power Hour)
//     Verlauf      alle Aktivitäten · Entwurf
//     Datenschutz  Grundlage, Einwilligungen, Werbewiderspruch, Betroffenenrechte ·
//                  Anträge · Privat (nur für den Angemeldeten)
// Je Reiter zwei Spalten ab SPALTEN_AB (useSpalten), am Handy eine; Abschnitte
// einklappbar (je Person gemerkt, localStorage mt-akte-zu-<id>), der zuletzt
// gewählte Reiter je Person ebenfalls (mt-akte-reiter-<id>).
// Adresse: /os/markttraktion?s=kontakte&a=akte&k=<id>&t=<reiter> — ohne t der
// Überblick, alte Links aus Suche, Befunden und ZOE funktionieren unverändert.
// Zurück (Knopf, Esc oder Browser) führt in die Kartei mit derselben Person.
// Die Bausteine teilt die Akte mit der Karteikarte (kontakt-teile.tsx), die
// Regeln stehen in lib/crm/akte.ts.

import { localDay } from '@/lib/zeit';
import { nachOben } from '../Verlauf';
import { useRouter } from 'next/navigation';
import { WEG } from '@/lib/wege';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Chip, Punkt, LEUCHT, SPALTEN_AB } from '../schlank';
import { anzeigename, STUFE_LABEL, type Kontakt, rollenVon, ROLLE_LABEL } from '@/lib/make-one/crm';
import { ampel as kanalAmpel } from '@/lib/crm/recht';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { vollstaendigkeit, verbindungen, takt, verlaufZahlen, TEILNAHME_LABEL, KAMPAGNEN_ERGEBNIS_LABEL } from '@/lib/crm/akte';
import { haeltBeziehung, nameVon } from '@/lib/crm/team';
import { AKTE_REITER, akteReiter, type AkteReiter } from '@/lib/crm/adresse';
import { type CrmApi, datum, euro } from './daten';
import { KanalAmpel, Grund, Pillen, Verlauf } from './teile';
import { Person, AuchHier } from './team';
import { LeadBlock } from './Leads';
import { phaseFarbe, phaseLabel, Hinweise, NaechsterSchrittTeil, BeziehungTeil, DealsTeil, EntwurfTeil, VerlaufTeil, RechtTeil, LinkedInTeil, MatrixTeilInhalt, MatrixZahl, MatrixZeile, MATRIX_TEIL_LABEL, type MatrixTeil } from './kontakt-teile';

/** Zwei Spalten ab SPALTEN_AB, sonst eine (die Reiter halten die Akte kurz genug — drei Spalten braucht es nicht mehr). */
function useSpalten(): 1 | 2 {
  const [n, setN] = useState<1 | 2>(1);
  useEffect(() => {
    const zwei = window.matchMedia(`(min-width: ${SPALTEN_AB}px)`);
    const an = () => setN(zwei.matches ? 2 : 1);
    an(); zwei.addEventListener('change', an);
    return () => zwei.removeEventListener('change', an);
  }, []);
  return n;
}

/** Eingeklappte Abschnitte je Person — im Browser gemerkt, ohne Speicher einfach alles offen. */
function useKlappen(personId: string) {
  const [zu, setZu] = useState<string[]>([]);
  useEffect(() => {
    try { const x = localStorage.getItem(`mt-akte-zu-${personId}`); const l: unknown = x ? JSON.parse(x) : []; setZu(Array.isArray(l) ? l.filter((a): a is string => typeof a === 'string') : []); } catch { setZu([]); }
  }, [personId]);
  const umschalten = useCallback((a: string) => setZu(alt => {
    const neu = alt.includes(a) ? alt.filter(x => x !== a) : [...alt, a];
    try { localStorage.setItem(`mt-akte-zu-${personId}`, JSON.stringify(neu)); } catch { /* egal */ }
    return neu;
  }), [personId]);
  return { istZu: (a: string) => zu.includes(a), umschalten };
}

const reiterMerker = (personId: string) => `mt-akte-reiter-${personId}`;

/** Ein einklappbarer Abschnitt der Akte: Karte mit Kopfzeile (Titel = Knopf), Inhalt nur offen. */
function Klappe({ id, titel, unter, rechts, akzent, i, zu, umschalten, children }: { id: string; titel: string; unter?: ReactNode; rechts?: ReactNode; akzent?: string; i: number; zu: boolean; umschalten: (id: string) => void; children: ReactNode }) {
  const inhaltId = `akte-${id}`;
  return (
    <Karte i={i} akzent={zu ? undefined : akzent}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: zu ? 0 : 14 }}>
        <button onClick={() => umschalten(id)} aria-expanded={!zu} aria-controls={inhaltId} className="fassbar" title={zu ? 'Aufklappen' : 'Einklappen'}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 9, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text, color: C.ink }}>
          <span aria-hidden style={{ display: 'inline-block', width: 14, marginTop: 4, fontSize: 11, color: C.inkLeise, transform: zu ? 'rotate(-90deg)' : 'none', transition: 'transform .18s ease' }}>▼</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: SCHRIFT.display, fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.25 }}>{titel}</span>
            {unter && !zu && <span style={{ display: 'block', fontSize: 12.5, color: C.inkLeise, marginTop: 3 }}>{unter}</span>}
          </span>
        </button>
        {rechts && <span style={{ fontSize: 12, color: C.inkLeise, display: 'flex', gap: 12, alignItems: 'center', flex: '0 0 auto', marginTop: 3 }}>{rechts}</span>}
      </div>
      {!zu && <div id={inhaltId}>{children}</div>}
    </Karte>
  );
}

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

/** Eine Spalte der Akte: Karten untereinander. Außerhalb der Akte definiert, damit nichts bei jedem Zeichnen neu entsteht (sonst gingen Eingaben verloren). */
function Stapel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 14, minWidth: 0, alignContent: 'start' }}>{children}</div>;
}

/** Zwei Spalten auf breiten Bildschirmen, am Handy eine (links zuerst). */
function Zwei({ spalten, links, rechts }: { spalten: 1 | 2; links: ReactNode; rechts: ReactNode }) {
  if (spalten === 1) return <Stapel>{links}{rechts}</Stapel>;
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

const leiseKnopf = { background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: SCHRIFT.text } as const;

export function KontaktAkte({ api, id, name, zurueck, zuFirma, zuAkte, t, setReiter }: {
  api: CrmApi; id: string; name: (p: string) => string; zurueck: () => void; zuFirma: (id: string) => void; zuAkte: (id: string) => void;
  /** Der Reiter aus der Adresse (`t`), roh — null heißt: nicht angegeben. */
  t: string | null;
  /** Reiter wechseln = Adresse ersetzen (kein neuer Eintrag im Verlauf). */
  setReiter: (t: AkteReiter) => void;
}) {
  const router = useRouter();
  const spalten = useSpalten();
  const { istZu, umschalten } = useKlappen(id);
  const crm = api.crm;
  const heute = crm?.heute ?? localDay();
  const k = api.kontakte?.find(x => x.id === id) ?? null;
  const reiter = akteReiter(t);

  // Oben anfangen — die Kartei war vielleicht weit nach unten gescrollt. Gescrollt wird in <main> der Oberfläche, nicht im Fenster.
  useEffect(() => { nachOben(); }, [id]);
  // Zuletzt gewählter Reiter je Person: ohne `t` in der Adresse dorthin springen (ersetzt die Adresse — der Link von außen bleibt gültig).
  useEffect(() => {
    if (t !== null) return;
    try { const m = akteReiter(localStorage.getItem(reiterMerker(id))); if (m !== 'ueberblick') setReiter(m); } catch { /* ohne Speicher: Überblick */ }
    // Nur beim Öffnen einer Person — nicht bei jedem Reiterwechsel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const waehleReiter = (r: AkteReiter) => { try { localStorage.setItem(reiterMerker(id), r); } catch { /* egal */ } setReiter(r); };
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

  const zurueckKnopf = (
    <button onClick={zurueck} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 10px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700 }}>
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>‹</span> Zurück zu Kontakte
    </button>
  );

  if (!api.kontakte) return <Karte i={0}>{zurueckKnopf}<Leer>Die Akte lädt …</Leer></Karte>;
  if (!k || !v) return <Karte i={0}>{zurueckKnopf}<Leer>Diese Person gibt es nicht mehr — gelöscht oder mit einer Dublette zusammengeführt.</Leer></Karte>;

  const firma = k.firmaId ? crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const offeneDeals = v.deals.filter(d => !d.ueberFirma && OFFENE_STUFEN.includes(d.stufe));
  const aktivesMandat = v.mandate.some(m => m.status === 'aktiv');
  const ampel = kanalAmpel(k, { hatMandat: aktivesMandat, hatChance: offeneDeals.length > 0 });
  const mailOk = ampel.some(s => s.kanal === 'mail' && s.farbe !== 'rot');
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
  const scoreAkte = leadScore(k.firmaId ? (api.kontakte ?? [k]).filter(x => x.firmaId === k.firmaId) : [k], firma?.lead ?? k.lead, heute);
  const dealWert = offeneDeals.reduce((s, d) => s + (d.wert.betrag || 0) * (d.wert.basis === 'monat' ? 12 : 1), 0);
  const schrittUeberfaellig = !!k.naechsterSchritt && k.naechsterSchritt.datum < heute;
  const vollFarbe = voll.anteil >= 0.7 ? LEUCHT.gut : voll.anteil >= 0.4 ? LEUCHT.achtung : LEUCHT.kritisch;

  /** Typ und Kategorie als Chips im Kopf (Malin 27.09.) — ein Tipp springt in die Stammdaten. */
  const einordnungChip = (label: string, wert?: string) => (
    <button key={label} onClick={() => waehleReiter('stammdaten')} title={wert ? `${label}: ${wert} — ändern unter Stammdaten` : `${label} fehlt — unter Stammdaten setzen`} className="fassbar"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: SCHRIFT.text }}>
      <Chip farbe={wert ? LEUCHT.agenten : C.inkLeise}>{wert ? `${label} · ${wert}` : `${label} —`}</Chip>
    </button>
  );

  const kopf = (
    <Karte i={0} akzent={pf}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {zurueckKnopf}
        <span style={{ fontSize: 12, color: C.inkLeise }}>Akte · geändert {datum(k.geaendertAm, heute)}{spalten > 1 ? ' · Esc schließt' : ''}</span>
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
            <span title={ph.grund}><Chip farbe={pf}>{phaseLabel(ph.phase)}</Chip></span>
            <span title={scoreAkte.teile.map(x => `${x.label} ${x.punkte}/${x.max} — ${x.grund}`).join('\n')}><Chip farbe={temperaturFarbe(scoreAkte.temperatur)}>Score {scoreAkte.punkte} · {temperaturLabel(scoreAkte.temperatur)}</Chip></span>
            {einordnungChip('Typ', k.typ)}{einordnungChip('Kategorie', k.kategorie)}
            {rollenVon(k).map(r => <Chip key={r} farbe={LEUCHT.business}>{ROLLE_LABEL[r]}</Chip>)}{k.kreis && <Chip farbe={LEUCHT.beziehung}>Kreis {k.kreis}</Chip>}
            <Chip farbe={C.inkDim}>{STUFE_LABEL[k.stufe]}</Chip>{k.prio && <Chip farbe={C.inkDim}>Prio {k.prio}</Chip>}
            {k.werbesperre && <Chip farbe={LEUCHT.kritisch}>Werbesperre</Chip>}
            <span title={`Hält die Beziehung: ${nameVon(haeltBeziehung(k))}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkLeise, marginLeft: 4 }}><Person id={haeltBeziehung(k)} groesse={18} />{nameVon(haeltBeziehung(k))}</span>
            <AuchHier passt={p => p.includes(`k=${k.id}`)} was="bei dieser Person" />
          </div>
        </div>
        <div style={{ flex: '0 1 auto', minWidth: 0, display: 'grid', gap: 4, justifyItems: spalten > 1 ? 'end' : 'start' }}>
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

  const reiterListe = AKTE_REITER.map(r => ({ id: r.id, label: r.id === 'verlauf' && vz.eintraege ? `Verlauf · ${vz.eintraege}` : r.label }));
  const reiterLeiste = (
    <div role="tablist" aria-label="Akte" style={{ overflowX: 'auto', scrollbarWidth: 'none', margin: '2px 0 -2px' }}>
      <Pillen einzeilig liste={reiterListe} aktiv={reiter} onWahl={waehleReiter} farbe={C.ink} />
    </div>
  );

  // ── Überblick ──
  const beziehungChip = (text: string, farbe: string) => <span style={{ fontSize: 11.5, fontWeight: 600, color: farbe, border: `1px solid ${farbe}55`, borderRadius: 999, padding: '2px 8px' }}>{text}</span>;
  const letzte = (k.aktivitaeten ?? []).slice(-5);
  const ueberblick = (
    <Zwei spalten={spalten}
      links={<>
        <Klappe id="vertrieb" i={1} titel="Vertrieb" unter="Nächster Schritt · Lead → Deal → Kunde" akzent={offeneDeals.length ? LEUCHT.gut : undefined} zu={istZu('vertrieb')} umschalten={umschalten}>
          <div style={{ display: 'grid', gap: 18 }}>
            <NaechsterSchrittTeil k={k} heute={heute} setze={setze} />
            <DealsTeil k={k} api={api} />
            <LeadBlock api={api} leadId={k.firmaId ?? k.id} />
          </div>
        </Klappe>
      </>}
      rechts={<>
        <Klappe id="beziehung-kurz" i={2} titel="Beziehung" rechts={<button onClick={() => waehleReiter('beziehung')} style={leiseKnopf}>Alles zur Beziehung ›</button>} zu={istZu('beziehung-kurz')} umschalten={umschalten}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {beziehungChip(k.kreis ? `Kreis ${k.kreis}${tk ? ` · alle ${tk.tage} T` : ''}` : 'kein Kreis', k.kreis ? LEUCHT.beziehung : C.inkLeise)}
            {beziehungChip(phaseLabel(ph.phase), pf)}
            {rollenVon(k).map(r => <span key={r}>{beziehungChip(ROLLE_LABEL[r], LEUCHT.business)}</span>)}
            {beziehungChip(STUFE_LABEL[k.stufe], C.inkDim)}{k.anrede && beziehungChip(k.anrede, C.inkDim)}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkLeise }}><Person id={haeltBeziehung(k)} groesse={16} />hält {nameVon(haeltBeziehung(k))}</span>
          </div>
          {tk && <div style={{ fontSize: 12.5, color: tk.ueberfaellig ? LEUCHT.achtung : C.inkLeise, marginTop: 8 }}>{tk.ueberfaellig ? 'Takt überschritten — jetzt melden.' : `Nach dem Takt fällig ${datum(tk.faelligAm, heute)}.`}{tk.seit !== null ? ` Seit ${tk.seit} Tagen still.` : ''}</div>}
        </Klappe>
        <Klappe id="letzte" i={3} titel="Letzte Aktivitäten" unter={vz.eintraege ? `${Math.min(5, vz.eintraege)} von ${vz.eintraege}` : 'Noch nichts festgehalten.'} rechts={vz.eintraege > 5 ? <button onClick={() => waehleReiter('verlauf')} style={leiseKnopf}>Ganzer Verlauf ›</button> : undefined} zu={istZu('letzte')} umschalten={umschalten}>
          {letzte.length ? <Verlauf liste={letzte} name={name} heute={heute} max={5} /> : <div style={{ fontSize: 12.5, color: C.inkLeise }}>Im Reiter Verlauf festhalten: Gesprächsnotiz, Anruf, Mail.</div>}
        </Klappe>
        <Klappe id="notiz" i={4} titel="Notiz" unter="Für alle im Team — die private Notiz steht unter Datenschutz." zu={istZu('notiz')} umschalten={umschalten}>
          <MatrixZeile label="Notiz" lang wert={k.notiz} onFertig={x => void setze({ notiz: x || undefined })} />
        </Klappe>
      </>}
    />
  );

  // ── Stammdaten ──
  const matrixKlappe = (teil: MatrixTeil, i: number, unter?: string) => (
    <Klappe key={teil} id={`matrix-${teil}`} i={i} titel={MATRIX_TEIL_LABEL[teil]} unter={unter} rechts={<>{teil === 'firma' && firma && <button onClick={() => zuFirma(firma.id)} style={leiseKnopf}>Firma öffnen ›</button>}<MatrixZahl teil={teil} k={k} api={api} /></>} zu={istZu(`matrix-${teil}`)} umschalten={umschalten}>
      <MatrixTeilInhalt teil={teil} k={k} api={api} setze={setze} zuFirma={zuFirma} />
    </Klappe>
  );
  const stammdaten = (
    <Zwei spalten={spalten}
      links={<>{matrixKlappe('einordnung', 1, 'Typ und Kategorie zuerst — alle Werte der Wertelisten, „+ neu“ legt an.')}{matrixKlappe('person', 2, 'Antippen zum Bearbeiten, Enter speichert, Esc verwirft.')}</>}
      rechts={<>{matrixKlappe('firma', 3, firma ? 'Aus dem Firmeneintrag — gilt für alle Personen der Firma.' : 'Aus dem Import — eine Firma zuordnen bündelt die Felder.')}{matrixKlappe('herkunft', 4)}</>}
    />
  );

  // ── Beziehung ──
  const firmenDeals = v.deals.filter(d => d.ueberFirma);
  const nichtsVerbunden = !v.events.length && !v.kampagnen.length && !v.beitraege.length && !v.powerHour.length && !v.kollegen.length && !firmenDeals.length;
  const beziehung = (
    <Zwei spalten={spalten}
      links={<>
        <Klappe id="beziehung" i={1} titel="Beziehung" unter="Kreis, Takt, Rollen, Ansprache — wer sie hält" zu={istZu('beziehung')} umschalten={umschalten}>
          <BeziehungTeil k={k} api={api} setze={setze} ohneTitel />
          {tk && <div style={{ fontSize: 12.5, color: tk.ueberfaellig ? LEUCHT.achtung : C.inkLeise, marginTop: 6 }}>Takt: alle {tk.tage} Tage · {tk.ueberfaellig ? 'jetzt melden' : `fällig ${datum(tk.faelligAm, heute)}`}{tk.seit !== null ? ` · seit ${tk.seit} T still` : ''}</div>}
        </Klappe>
        <Klappe id="netzwerk" i={2} titel="Netzwerk" unter="LinkedIn — Profil, Stand je Person, nächster Schritt" zu={istZu('netzwerk')} umschalten={umschalten}>
          <LinkedInTeil k={k} api={api} />
        </Klappe>
      </>}
      rechts={
        <Klappe id="verbindungen" i={3} titel="Verbindungen" unter="Wo die Person sonst im System vorkommt" zu={istZu('verbindungen')} umschalten={umschalten}>
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
      }
    />
  );

  // ── Verlauf ──
  const verlauf = (
    <Zwei spalten={spalten}
      links={
        <Klappe id="aktivitaeten" i={1} titel="Aktivitäten" unter={vz.eintraege ? `${vz.eintraege} Einträge · ${vz.gespraeche} Gespräche${vz.zuletzt ? ` · zuletzt ${datum(vz.zuletzt, heute)}` : ''}` : 'Noch nichts festgehalten.'} zu={istZu('aktivitaeten')} umschalten={umschalten}>
          <VerlaufTeil k={k} api={api} name={name} heute={heute} max={400} />
        </Klappe>
      }
      rechts={!k.werbesperre && (
        <Klappe id="entwurf" i={2} titel="Entwurf" unter="ZOE schreibt vor — versendet wird nichts." zu={istZu('entwurf')} umschalten={umschalten}>
          <EntwurfTeil k={k} mailOk={mailOk} ohneTitel />
        </Klappe>
      )}
    />
  );

  // ── Datenschutz ──
  const datenschutz = (
    <Zwei spalten={spalten}
      links={
        <Klappe id="recht" i={1} titel="Recht" unter="DSGVO und § 7 UWG — worauf die Ansprache beruht" zu={istZu('recht')} umschalten={umschalten}>
          <RechtTeil k={k} api={api} heute={heute} setze={setze} />
        </Klappe>
      }
      rechts={<>
        <Klappe id="antraege" i={2} titel="Betroffenenanträge" unter={v.antraege.length ? `${v.antraege.length} zu dieser Person` : 'Keine Anträge zu dieser Person.'} rechts={<button onClick={() => router.push(WEG.stammdaten('datenschutz'))} style={leiseKnopf}>Alle Anträge ›</button>} zu={istZu('antraege')} umschalten={umschalten}>
          {v.antraege.map(a => <VZeile key={a.id} farbe={a.status === 'offen' ? LEUCHT.kritisch : C.inkLeise} titel={a.art} zusatz={a.status === 'offen' ? `Frist ${datum(a.frist, heute)}` : 'erledigt'} am={a.eingang} heute={heute} onClick={() => router.push(WEG.stammdaten('datenschutz'))} />)}
          {!v.antraege.length && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Auskunft, Löschung und Widerspruch werden unter Stammdaten › Datenschutz geführt.</div>}
        </Klappe>
        <Klappe id="privat" i={3} titel="Privat" unter="Nur für dich sichtbar · nie an Agenten" zu={istZu('privat')} umschalten={umschalten}>
          <MatrixTeilInhalt teil="privat" k={k} api={api} setze={setze} zuFirma={zuFirma} />
        </Klappe>
      </>}
    />
  );

  return (
    <>
      {kopf}
      <Hinweise k={k} heute={heute} setze={setze} />
      {reiterLeiste}
      <div role="tabpanel" aria-label={AKTE_REITER.find(r => r.id === reiter)?.label} style={{ display: 'grid', gap: 14 }}>
        {reiter === 'ueberblick' && ueberblick}
        {reiter === 'stammdaten' && stammdaten}
        {reiter === 'beziehung' && beziehung}
        {reiter === 'verlauf' && verlauf}
        {reiter === 'datenschutz' && datenschutz}
      </div>
    </>
  );
}
