'use client';

// ─── Markttraktion · Geführte Runden (25.09.) ───────────────────────────────
// Stand 25.09.: 438 von 453 Kontakten ohne Beziehungskreis, 17 „im Gespräch“
// ohne eine einzige Chance. Zwei Runden bringen das in Minuten in Form —
// Karte für Karte, mit Tastatur oder Daumen:
//   Kreis-Runde    je Person Kreis A/B/C/D (Pflege-Takt der Power Hour), wer
//                  die Beziehung hält (so wandert Arbeit zu Malin) und Sie/Du.
//                  Erst die Wichtigen (Kunden, Mandate, Gespräche, Prio A/B),
//                  die übrigen auf Wunsch danach.
//   Chancen-Runde  je Person im Gespräch eine Chance mit Wert und nächstem
//                  Schritt (Pflicht) — oder „kein Bedarf“.
// Jede Karte speichert sofort: der Kontakt als ganzer Eintrag (der Server
// vereint den Verlauf mit dem aktuellen Stand), die Chance als
// Einzeländerung. „Kein Bedarf“ ist EIN Aufruf an /api/crm/aktivitaet (Notiz
// plus Stufe) — so kann kein älterer Stand die Stufe überschreiben. „z“ nimmt
// die letzte Karte zurück. Wer drankommt und was vorbelegt ist, rechnet
// lib/crm/runden.ts (getestet). Die Liste wird beim Start festgehalten, damit
// „12 von 57“ stehen bleibt, obwohl jede Entscheidung die Person aus der
// Auswahl nimmt.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Leer, Fortschritt, feld, LEUCHT } from '../schlank';
import { anzeigename, STUFE_LABEL, type Kontakt, type Kreis, type Stufe } from '@/lib/make-one/crm';
import type { Chance, ChancenArt, ChancenStufe, CrmBestand, Leistung } from '@/lib/crm/typen';
import { STUFEN, gesamtwert, wahrscheinlichkeit } from '@/lib/crm/pipeline';
import { TEAM, BEIDE, anderer, nameVon, haeltBeziehung, verantwortlich } from '@/lib/crm/team';
import { markttraktion } from '@/lib/crm/adresse';
import {
  kreisKandidaten, kreisBilanz, kreisZusammenfassung, letzteNotiz, KREIS_WAHL, KREIS_GRUPPEN,
  chancenKandidaten, chancenBilanz, chanceAnlegen, chanceBesitzer, wertFuerArt, schrittOk, CHANCEN_ARTEN, SCHRITT_VORSCHLAEGE,
  type KreisKandidat, type KreisGruppe, type ChancenKandidat, type ChancenEingabe,
} from '@/lib/crm/runden';
import { type CrmApi, neueId, datum, euro } from './daten';
import { Pillen, Feldzeile, Verlauf } from './teile';
import { Person, ZustaendigWahl } from './team';

export type RundenArt = 'kreis' | 'chancen';
interface RundenProps { api: CrmApi; name: (p: string) => string; zuKontakt: (id: string) => void; zurueck: () => void }

export function Runden({ api, art, name, zuKontakt, zurueck }: RundenProps & { art: RundenArt }) {
  // Handy: volle Breite; Rechner: eine Spalte in der Mitte — eine Karte, ein Blick.
  return (
    <div style={{ width: '100%', maxWidth: 720, margin: '0 auto', display: 'grid', gap: 14 }}>
      {art === 'kreis'
        ? <KreisRunde api={api} name={name} zuKontakt={zuKontakt} zurueck={zurueck} />
        : <ChancenRunde api={api} name={name} zuKontakt={zuKontakt} zurueck={zurueck} />}
    </div>
  );
}

// ── Gemeinsames ─────────────────────────────────────────────────────────────

/**
 * Tastenkürzel — nie mit Cmd/Strg/Alt (Schnellsuche, Browser), nie in einem
 * offenen Dialog (z. B. „+ Gespräch“); ob ein Kürzel beim Tippen in einem Feld
 * gilt, entscheidet der Aufrufer (`imFeld`).
 */
function useTasten(handler: (e: KeyboardEvent, imFeld: boolean) => void) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest('[role="dialog"],[aria-modal="true"]')) return;
      const imFeld = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      ref.current(e, imFeld);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
}

/** Die Karte nach jedem Schritt wieder ganz ins Bild holen — sonst steht auf dem Handy der Name über dem Rand. */
function useInsBild(schluessel: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [schluessel]);
  return ref;
}

/** Tastenhinweis — nur, wo eine Tastatur ist (globals.css .nur-tastatur). */
const T = ({ children }: { children: ReactNode }) => <span className="taste nur-tastatur" style={{ marginLeft: 6 }}>{children}</span>;
const kurz = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const tageSeit = (iso: string, heute: string) => Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T12:00:00Z`)) / 864e5);
const leiseLink = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: 0, fontFamily: SCHRIFT.text } as const;
const kleinText = { fontSize: 12.5, color: C.inkLeise, lineHeight: 1.5 } as const;
const eingabe = { ...feld, fontSize: TYP.bedien, padding: '9px 12px' } as const;

function Kopfzeilen({ k, rechts, chips }: { k: Kontakt; rechts: ReactNode; chips: ReactNode }) {
  const wo = [k.position ?? k.jobtitel, k.firma].filter(Boolean).join(' · ');
  return (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{chips}<span style={{ flex: 1 }} />{rechts}</div>
      <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(22px, 4.2vw, 28px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15, marginTop: 10 }}>{anzeigename(k)}</div>
      {wo && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4, lineHeight: 1.45 }}>{kurz(wo, 180)}</div>}
    </>
  );
}

// ── Kreis-Runde ─────────────────────────────────────────────────────────────

const GRUPPE_FARBE: Record<KreisGruppe, string> = { 0: LEUCHT.geld, 1: LEUCHT.business, 2: LEUCHT.puls, 3: C.inkDim };
const ANREDEN: { id: 'Sie' | 'Du'; label: string }[] = [{ id: 'Sie', label: 'Sie' }, { id: 'Du', label: 'Du' }];

interface KreisSchritt { pos: number; id: string; kreis: Kreis | null; besitzer: string; anrede: 'Sie' | 'Du'; vorher: Pick<Kontakt, 'kreis' | 'besitzer' | 'anrede'> }

function KreisRunde({ api, name, zuKontakt, zurueck }: RundenProps) {
  const heute = api.crm?.heute ?? '';
  const [liste, setListe] = useState<KreisKandidat[] | null>(null);
  const [pos, setPos] = useState(0);
  const [auchUebrige, setAuchUebrige] = useState(false);
  const [schritte, setSchritte] = useState<KreisSchritt[]>([]);
  // Einmal beim Start festhalten — jede Entscheidung nimmt die Person ja aus der Auswahl.
  useEffect(() => { if (!liste && api.kontakte && api.crm) setListe(kreisKandidaten(api.kontakte, api.crm.stand, api.crm.heute)); }, [liste, api.kontakte, api.crm]);
  const nachId = useMemo(() => new Map((api.kontakte ?? []).map(k => [k.id, k])), [api.kontakte]);
  const karteRef = useInsBild(pos);

  const wichtige = liste ? liste.filter(x => x.wichtig).length : 0;
  const etappe = !liste ? [] : auchUebrige || !wichtige ? liste : liste.slice(0, wichtige);
  const kandidat: KreisKandidat | undefined = etappe[pos];
  const k = kandidat ? nachId.get(kandidat.kontakt.id) : undefined;
  // Inzwischen zusammengeführt oder gelöscht → die nächste Karte.
  useEffect(() => { if (kandidat && api.kontakte && !k) setPos(p => p + 1); }, [kandidat, k, api.kontakte]);

  const bilanz = kreisBilanz(schritte.map(s => ({ kontaktId: s.id, kreis: s.kreis, besitzer: s.besitzer, anrede: s.anrede })));

  const entscheide = (kreis: Kreis | null, besitzer: string, anrede: 'Sie' | 'Du') => {
    if (!k) return;
    setSchritte(l => [...l, { pos, id: k.id, kreis, besitzer, anrede, vorher: { kreis: k.kreis, besitzer: k.besitzer, anrede: k.anrede } }]);
    setPos(pos + 1);
    if (kreis) void api.kontaktSetzen({ ...k, kreis, besitzer, anrede });
  };
  const rueckgaengig = () => {
    const s = schritte[schritte.length - 1];
    if (!s) return;
    setSchritte(l => l.slice(0, -1));
    setPos(s.pos);
    const jetzt = nachId.get(s.id);
    // Fehlende Felder fallen beim Speichern weg — so wird „ohne Kreis“ wieder „ohne Kreis“.
    if (s.kreis && jetzt) void api.kontaktSetzen({ ...jetzt, kreis: s.vorher.kreis, besitzer: s.vorher.besitzer, anrede: s.vorher.anrede });
  };
  useTasten((e, imFeld) => { if (!imFeld && e.key.toLowerCase() === 'z' && schritte.length) { e.preventDefault(); rueckgaengig(); } });

  if (!liste) return <Karte i={0}><Leer>Lädt die Kartei …</Leer></Karte>;
  if (!liste.length) {
    return (
      <Karte i={0} akzent={LEUCHT.gut}>
        <Ueberschrift farbe={LEUCHT.gut}>Kreis-Runde</Ueberschrift>
        <Leer>Alle Kontakte haben einen Kreis — der Pflege-Takt greift überall.</Leer>
        <Knopf onClick={zurueck}>Zurück zur Kartei</Knopf>
      </Karte>
    );
  }
  const rest = liste.length - etappe.length;
  const andere = anderer(api.ich ?? verantwortlich('sales'));
  const takt = (id: Kreis) => KREIS_WAHL.find(w => w.id === id)!.takt;
  const verteilt = TEAM.filter(t => t.id !== verantwortlich('sales') && bilanz.jePerson[t.id]);

  return (
    <>
      <Karte i={0} akzent={LEUCHT.beziehung}>
        <Ueberschrift farbe={LEUCHT.beziehung} rechts={<span style={{ fontVariantNumeric: 'tabular-nums' }}><b style={{ color: C.ink }}>{Math.min(pos + 1, etappe.length)}</b> von {etappe.length}</span>}>Kreis-Runde</Ueberschrift>
        {!schritte.length && (
          <p style={{ margin: '0 0 12px', fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
            Ohne Kreis kein Pflege-Takt: Die Power Hour meldet Kreis A alle {takt('A')} Tage und Kreis B alle {takt('B')} Tage; C und D zählen für Segmente, Einladungen und Newsletter.
            Und wer die Beziehung hält, bekommt die Person in die eigene Power Hour — so verteilst du an {nameVon(andere)}. Erst die Wichtigen: Kunden, Mandate, Gespräche, Prio A/B.
          </p>
        )}
        <Fortschritt anteil={etappe.length ? pos / etappe.length : 1} farbe={LEUCHT.beziehung} />
        {rest > 0 && <div style={{ ...kleinText, marginTop: 6 }}>Die wichtigen {etappe.length} zuerst — danach auf Wunsch die übrigen {rest}.</div>}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          {KREIS_WAHL.map(w => <Chip key={w.id} farbe={bilanz.jeKreis[w.id] ? LEUCHT.beziehung : C.inkLeise}>{w.id} {bilanz.jeKreis[w.id]}</Chip>)}
          {[...TEAM.map(t => t.id), BEIDE].filter(p => bilanz.jePerson[p]).map(p => (
            <span key={p} title={`hält die Beziehung: ${nameVon(p)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: C.inkDim, marginLeft: 4 }}><Person id={p} groesse={18} />{bilanz.jePerson[p]}</span>
          ))}
          {bilanz.uebersprungen > 0 && <span style={{ ...kleinText, marginLeft: 4 }}>{bilanz.uebersprungen} übersprungen</span>}
          <span style={{ flex: 1 }} />
          <button onClick={zurueck} style={leiseLink}>Zur Kartei</button>
        </div>
        <div className="nur-tastatur" style={{ ...kleinText, marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span><span className="taste">1</span>–<span className="taste">4</span> Kreis A–D</span>
          <span><span className="taste">k</span> <span className="taste">m</span> <span className="taste">b</span> Kevin · Malin · Beide</span>
          <span><span className="taste">a</span> Sie/Du</span>
          <span><span className="taste">s</span> überspringen</span>
          <span><span className="taste">z</span> zurück</span>
        </div>
      </Karte>

      <div ref={karteRef} style={{ scrollMarginTop: 84 }}>
        {kandidat && k ? (
          <KreisKarte key={k.id} kandidat={kandidat} k={k} heute={heute} name={name} kannZurueck={schritte.length > 0}
            onEntscheid={entscheide} onZurueck={rueckgaengig} zuKontakt={zuKontakt} />
        ) : !kandidat && (
          <Karte i={1} akzent={LEUCHT.gut}>
            <Ueberschrift farbe={LEUCHT.gut}>{rest > 0 ? 'Die Wichtigen sind durch' : 'Runde geschafft'}</Ueberschrift>
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(20px, 3.6vw, 26px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.3 }}>
              {bilanz.gesetzt ? kreisZusammenfassung(bilanz) : 'Noch kein Kreis vergeben.'}
            </div>
            {bilanz.gesetzt > 0 && (
              <div style={{ ...kleinText, marginTop: 8, fontSize: TYP.bedien, color: C.inkDim }}>
                {bilanz.jeKreis.A + bilanz.jeKreis.B > 0 && `${bilanz.jeKreis.A + bilanz.jeKreis.B} in Kreis A/B — die Power Hour meldet sie jetzt im Takt. `}
                {verteilt.map(t => `${bilanz.jePerson[t.id]} liegen jetzt bei ${t.name} und tauchen in ${t.name}s Power Hour auf. `)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {rest > 0 && <Knopf farbe={LEUCHT.beziehung} onClick={() => setAuchUebrige(true)}>Weiter mit den übrigen {rest}</Knopf>}
              <Knopf leise={rest > 0} onClick={zurueck}>Zurück zur Kartei</Knopf>
              {schritte.length > 0 && <Knopf leise onClick={rueckgaengig}>Letzte zurücknehmen<T>z</T></Knopf>}
            </div>
          </Karte>
        )}
      </div>
    </>
  );
}

function KreisKarte({ kandidat, k, heute, name, kannZurueck, onEntscheid, onZurueck, zuKontakt }: {
  kandidat: KreisKandidat; k: Kontakt; heute: string; name: (p: string) => string; kannZurueck: boolean;
  onEntscheid: (kreis: Kreis | null, besitzer: string, anrede: 'Sie' | 'Du') => void; onZurueck: () => void; zuKontakt: (id: string) => void;
}) {
  // Standard: wer die Beziehung schon hält (ohne Eintrag die Sales-Verantwortung) und die bisherige Anrede (sonst Sie).
  const [besitzer, setBesitzer] = useState(() => haeltBeziehung(k));
  const [anrede, setAnrede] = useState<'Sie' | 'Du'>(k.anrede ?? 'Sie');
  useTasten((e, imFeld) => {
    if (imFeld) return;
    const t = e.key.toLowerCase();
    const w = KREIS_WAHL.find(x => x.taste === e.key);
    const person = t === 'b' ? BEIDE : TEAM.find(m => m.name.charAt(0).toLowerCase() === t)?.id;
    if (w) onEntscheid(w.id, besitzer, anrede);
    else if (t === 's') onEntscheid(null, besitzer, anrede);
    else if (person) setBesitzer(person);
    else if (t === 'a') setAnrede(a => (a === 'Sie' ? 'Du' : 'Sie'));
    else return;
    e.preventDefault();
  });

  const notiz = letzteNotiz(k);
  const seit = k.letzterKontakt && heute ? tageSeit(k.letzterKontakt, heute) : null;
  const farbe = GRUPPE_FARBE[kandidat.gruppe];
  return (
    <Karte i={1} akzent={farbe}>
      <Kopfzeilen k={k}
        chips={<>
          <Chip farbe={farbe}>{KREIS_GRUPPEN[kandidat.gruppe]}</Chip>
          {k.prio && kandidat.gruppe !== 2 && <Chip farbe={C.inkDim}>Prio {k.prio}</Chip>}
          {k.kreis && <Chip farbe={LEUCHT.achtung}>inzwischen Kreis {k.kreis}</Chip>}
        </>}
        rechts={<button onClick={() => zuKontakt(k.id)} style={leiseLink}>Zur Person →</button>} />
      <div style={{ fontSize: TYP.body, color: C.ink, marginTop: 12, lineHeight: 1.45 }}>{kandidat.grund}</div>
      <div style={{ display: 'grid', gap: 4, marginTop: 8, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
        <div><span style={{ color: C.inkLeise }}>Letzter Kontakt:</span> {k.letzterKontakt ? `${datum(k.letzterKontakt, heute)}${seit !== null && seit > 1 ? ` · vor ${seit} Tagen` : ''}` : 'noch keiner vermerkt'}</div>
        {notiz && <div><span style={{ color: C.inkLeise }}>Letzte Notiz ({datum(notiz.am, heute)}, {name(notiz.von)}):</span> {kurz(notiz.text, 240)}</div>}
        {!notiz && k.notiz && <div><span style={{ color: C.inkLeise }}>Notiz:</span> {kurz(k.notiz, 240)}</div>}
      </div>

      <div style={{ display: 'grid', gap: 2, marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <Feldzeile label="Hält die Beziehung">
          <ZustaendigWahl wert={besitzer} welt="sales" onWahl={setBesitzer} />
        </Feldzeile>
        <Feldzeile label="Anrede"><Pillen liste={ANREDEN} aktiv={anrede} onWahl={setAnrede} /></Feldzeile>
      </div>

      <div role="group" aria-label="Kreis wählen" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
        {KREIS_WAHL.map(w => (
          <button key={w.id} onClick={() => onEntscheid(w.id, besitzer, anrede)} className="fassbar" aria-label={`Kreis ${w.id}, ${w.text}, alle ${w.takt} Tage`} style={{
            minHeight: 84, padding: '10px 4px', borderRadius: 16, cursor: 'pointer', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 3,
            border: `1px solid ${LEUCHT.beziehung}55`, background: `${LEUCHT.beziehung}14`, color: C.ink, fontFamily: SCHRIFT.text,
          }}>
            <span style={{ fontFamily: SCHRIFT.display, fontSize: 30, fontWeight: 800, color: LEUCHT.beziehung, lineHeight: 1 }}>{w.id}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{w.text}</span>
            <span style={{ fontSize: 11.5, color: C.inkLeise }}>alle {w.takt} T</span>
            <span className="taste nur-tastatur">{w.taste}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <Knopf leise onClick={() => onEntscheid(null, besitzer, anrede)}>Überspringen<T>s</T></Knopf>
        {kannZurueck && <Knopf leise onClick={onZurueck}>Zurück<T>z</T></Knopf>}
      </div>
    </Karte>
  );
}

// ── Chancen-Runde ───────────────────────────────────────────────────────────

const OFFENE: { id: ChancenStufe; label: string }[] = STUFEN.filter(s => s.offen).map(s => ({ id: s.id, label: s.label }));
const BASEN: { id: 'monat' | 'einmalig'; label: string }[] = [{ id: 'monat', label: 'je Monat' }, { id: 'einmalig', label: 'einmalig' }];

interface ChancenSchritt { pos: number; id: string; was: 'chance' | 'kein' | 'weiter'; chance?: Chance; vorher?: Stufe }

function ChancenRunde({ api, name, zuKontakt, zurueck }: RundenProps) {
  const heute = api.crm?.heute ?? '';
  const [liste, setListe] = useState<ChancenKandidat[] | null>(null);
  const [pos, setPos] = useState(0);
  const [schritte, setSchritte] = useState<ChancenSchritt[]>([]);
  useEffect(() => { if (!liste && api.kontakte && api.crm) setListe(chancenKandidaten(api.kontakte, api.crm.stand, api.crm.heute)); }, [liste, api.kontakte, api.crm]);
  const nachId = useMemo(() => new Map((api.kontakte ?? []).map(k => [k.id, k])), [api.kontakte]);
  const karteRef = useInsBild(pos);

  const kandidat: ChancenKandidat | undefined = liste?.[pos];
  const k = kandidat ? nachId.get(kandidat.kontakt.id) : undefined;
  useEffect(() => { if (kandidat && api.kontakte && !k) setPos(p => p + 1); }, [kandidat, k, api.kontakte]);

  const eigene = api.crm?.stand.wahrscheinlichkeiten;
  const bilanz = chancenBilanz(schritte.flatMap(s => (s.chance ? [s.chance] : [])), eigene);
  const ohneBedarf = schritte.filter(s => s.was === 'kein').length;
  const uebersprungen = schritte.filter(s => s.was === 'weiter').length;

  const weiter = (s: Omit<ChancenSchritt, 'pos'>) => { setSchritte(l => [...l, { ...s, pos }]); setPos(pos + 1); };
  const anlegen = (e: ChancenEingabe) => {
    if (!k) return;
    const c = chanceAnlegen(neueId('ch'), k, e, new Date().toISOString(), api.ich ?? verantwortlich('sales'));
    weiter({ id: k.id, was: 'chance', chance: c });
    void api.setze('chancen', { ...c });
  };
  const keinBedarf = () => {
    if (!k || !kandidat) return;
    const stufe = kandidat.keinBedarf;
    weiter({ id: k.id, was: 'kein', vorher: k.stufe });
    void api.aktivitaet({ id: k.id, art: 'notiz', text: stufe === 'gewonnen' ? 'Chancen-Runde: kein weiterer Bedarf — Mandat läuft' : 'Chancen-Runde: kein Bedarf', stufe });
  };
  const rueckgaengig = () => {
    const s = schritte[schritte.length - 1];
    if (!s) return;
    setSchritte(l => l.slice(0, -1));
    setPos(s.pos);
    if (s.was === 'chance' && s.chance) void api.weg('chancen', s.chance.id);
    if (s.was === 'kein' && s.vorher) void api.aktivitaet({ id: s.id, art: 'notiz', text: 'Chancen-Runde: „kein Bedarf“ zurückgenommen', stufe: s.vorher });
  };
  useTasten((e, imFeld) => { if (!imFeld && e.key.toLowerCase() === 'z' && schritte.length) { e.preventDefault(); rueckgaengig(); } });

  if (!liste) return <Karte i={0}><Leer>Lädt Kartei und Pipeline …</Leer></Karte>;
  const pipeline = markttraktion('sales', 'pipeline');
  if (!liste.length) {
    return (
      <Karte i={0} akzent={LEUCHT.gut}>
        <Ueberschrift farbe={LEUCHT.gut}>Chancen-Runde</Ueberschrift>
        <Leer>Niemand ist im Gespräch ohne Chance — jedes Gespräch steht in der Pipeline.</Leer>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link href={pipeline} className="fassbar" style={linkKnopf}>Zur Pipeline →</Link><Knopf leise onClick={zurueck}>Zurück zur Kartei</Knopf></div>
      </Karte>
    );
  }

  return (
    <>
      <Karte i={0} akzent={LEUCHT.business}>
        <Ueberschrift farbe={LEUCHT.business} rechts={<span style={{ fontVariantNumeric: 'tabular-nums' }}><b style={{ color: C.ink }}>{Math.min(pos + 1, liste.length)}</b> von {liste.length}</span>}>Chancen-Runde</Ueberschrift>
        {!schritte.length && (
          <p style={{ margin: '0 0 12px', fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
            {liste.length} {liste.length === 1 ? 'Person ist' : 'Personen sind'} im Gespräch, aber ohne Chance — dann bleiben Pipeline, Prognose und Sales-Kennzahlen leer, und niemand sieht, was ansteht.
            Je Person ein Titel, ein Wert und ein nächster Schritt mit Datum. Oder „kein Bedarf“: Dann ruht die Person, mit Notiz im Verlauf.
          </p>
        )}
        <Fortschritt anteil={pos / liste.length} farbe={LEUCHT.business} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, fontSize: 12.5, color: C.inkDim }}>
          <Chip farbe={bilanz.anzahl ? LEUCHT.business : C.inkLeise}>{bilanz.anzahl} angelegt</Chip>
          {bilanz.summe > 0 && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{euro(bilanz.summe)} · gewichtet {euro(bilanz.gewichtet)}</span>}
          {ohneBedarf > 0 && <span>{ohneBedarf} kein Bedarf</span>}
          {uebersprungen > 0 && <span style={{ color: C.inkLeise }}>{uebersprungen} übersprungen</span>}
          <span style={{ flex: 1 }} />
          <button onClick={zurueck} style={leiseLink}>Zur Kartei</button>
        </div>
        <div className="nur-tastatur" style={{ ...kleinText, marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span><span className="taste">⏎</span> anlegen</span>
          <span><span className="taste">n</span> kein Bedarf</span>
          <span><span className="taste">s</span> überspringen</span>
          <span><span className="taste">z</span> zurück</span>
          <span><span className="taste">Esc</span> Feld verlassen</span>
        </div>
      </Karte>

      <div ref={karteRef} style={{ scrollMarginTop: 84 }}>
        {kandidat && k ? (
          <ChancenKarte key={k.id} kandidat={kandidat} k={k} heute={heute} name={name} ich={api.ich} leistungen={api.crm?.stand.leistungen ?? []} eigene={eigene}
            kannZurueck={schritte.length > 0} onAnlegen={anlegen} onKeinBedarf={keinBedarf} onWeiter={() => k && weiter({ id: k.id, was: 'weiter' })} onZurueck={rueckgaengig} zuKontakt={zuKontakt} />
        ) : !kandidat && (
          <Karte i={1} akzent={LEUCHT.gut}>
            <Ueberschrift farbe={LEUCHT.gut}>Runde geschafft</Ueberschrift>
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(20px, 3.6vw, 26px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.3 }}>
              {bilanz.anzahl === 1 ? '1 Chance angelegt' : `${bilanz.anzahl} Chancen angelegt`}
            </div>
            {bilanz.anzahl > 0 && <div style={{ fontSize: TYP.body, color: C.inkDim, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{euro(bilanz.summe)} in der Pipeline · {euro(bilanz.gewichtet)} gewichtet</div>}
            {(ohneBedarf > 0 || uebersprungen > 0) && <div style={{ ...kleinText, marginTop: 6 }}>{[ohneBedarf ? `${ohneBedarf} ohne Bedarf` : '', uebersprungen ? `${uebersprungen} übersprungen — kommen bei der nächsten Runde wieder` : ''].filter(Boolean).join(' · ')}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <Link href={pipeline} className="fassbar" style={linkKnopf}>Zur Pipeline →</Link>
              <Knopf leise onClick={zurueck}>Zurück zur Kartei</Knopf>
              {schritte.length > 0 && <Knopf leise onClick={rueckgaengig}>Letzte zurücknehmen<T>z</T></Knopf>}
            </div>
          </Karte>
        )}
      </div>
    </>
  );
}

const linkKnopf = { display: 'inline-flex', alignItems: 'center', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, background: LEUCHT.business, color: C.grund, textDecoration: 'none', boxShadow: `0 6px 18px -6px ${LEUCHT.business}99` } as const;

function ChancenKarte({ kandidat, k, heute, name, ich, leistungen, eigene, kannZurueck, onAnlegen, onKeinBedarf, onWeiter, onZurueck, zuKontakt }: {
  kandidat: ChancenKandidat; k: Kontakt; heute: string; name: (p: string) => string; ich: string | null; leistungen: Leistung[]; eigene?: CrmBestand['wahrscheinlichkeiten'];
  kannZurueck: boolean; onAnlegen: (e: ChancenEingabe) => void; onKeinBedarf: () => void; onWeiter: () => void; onZurueck: () => void; zuKontakt: (id: string) => void;
}) {
  const v = kandidat.vorschlag;
  const [titel, setTitel] = useState(v.titel);
  const [art, setArt] = useState<ChancenArt>(v.art);
  // Der Wert startet LEER — ein Katalogpreis ist ein Vorschlag zum Übernehmen, nie eine stille Annahme
  // (sonst stünden nach 17× Enter rund 400.000 € erfundene Pipeline da; Grundsatz: nie eine erfundene Zahl).
  const [betrag, setBetrag] = useState('');
  const katalog = v.wert.betrag ? v.wert : null;
  const [basis, setBasis] = useState<'monat' | 'einmalig'>(v.wert.basis);
  const [leistung, setLeistung] = useState<{ id?: string; name?: string }>({});
  /** Wert von Hand geändert — dann schreibt ein Wechsel der Art ihn nicht mehr aus dem Katalog um. */
  const [vonHand, setVonHand] = useState(false);
  const [stufe, setStufe] = useState<ChancenStufe>(v.stufe);
  const [schritt, setSchritt] = useState(v.naechsterSchritt.text);
  const [wann, setWann] = useState(v.naechsterSchritt.datum || heute);
  const [bis, setBis] = useState(v.erwartetAm ?? '');
  const [besitzer, setBesitzer] = useState(() => chanceBesitzer(k, ich));
  const [fehlt, setFehlt] = useState(false);
  const schrittRef = useRef<HTMLInputElement>(null);

  const zahl = Number(betrag.replace(',', '.'));
  const wert = Number.isFinite(zahl) && zahl > 0 ? zahl : 0;
  const gesamt = gesamtwert({ wert: { betrag: wert, basis } });
  const ok = schrittOk({ text: schritt, datum: wann });

  const artWaehlen = (a: ChancenArt) => {
    setArt(a);
    if (vonHand || !betrag) { setLeistung({}); return; }
    const w = wertFuerArt(a, leistungen);
    setBetrag(w.betrag ? String(w.betrag) : ''); setBasis(w.basis); setLeistung({ id: w.leistungId, name: w.leistung });
  };
  const artVorschlag = wertFuerArt(art, leistungen);
  const uebernehmen = () => { const w = artVorschlag.betrag ? artVorschlag : katalog; if (!w) return; setBetrag(String(w.betrag)); setBasis(w.basis); setLeistung({ id: w.leistungId, name: w.leistung }); setVonHand(false); };
  const anlegen = () => {
    if (!ok) { setFehlt(true); schrittRef.current?.focus(); return; }
    onAnlegen({ titel, ...(v.firma ? { firma: v.firma } : {}), art, betrag: wert, basis, stufe, naechsterSchritt: { text: schritt, datum: wann }, ...(bis ? { erwartetAm: bis } : {}), besitzer, ...(leistung.id ? { leistungId: leistung.id } : {}) });
  };
  useTasten((e, imFeld) => {
    // Enter legt an — auch aus einem Feld heraus und auf einem Knopf (sonst löste der Knopf zusätzlich aus).
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); anlegen(); return; }
    if (imFeld) { if (e.key === 'Escape') (e.target as HTMLElement).blur(); return; }
    const t = e.key.toLowerCase();
    if (t === 'n') onKeinBedarf();
    else if (t === 's') onWeiter();
    else return;
    e.preventDefault();
  });

  const beziehung = haeltBeziehung(k);
  return (
    <Karte i={1} akzent={LEUCHT.business}>
      <Kopfzeilen k={k}
        chips={<>
          <Chip farbe={LEUCHT.business}>{STUFE_LABEL[k.stufe]}</Chip>
          {k.lebensphase === 'kunde' && <Chip farbe={LEUCHT.geld}>Kunde</Chip>}
          {k.prio && <Chip farbe={C.inkDim}>Prio {k.prio}</Chip>}
          <span title={`hält die Beziehung: ${nameVon(beziehung)}`} style={{ display: 'inline-flex', marginLeft: 2 }}><Person id={beziehung} groesse={20} /></span>
        </>}
        rechts={<button onClick={() => zuKontakt(k.id)} style={leiseLink}>Zur Person →</button>} />
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8 }}>{kandidat.grund}</div>
      {kandidat.hinweise.length > 0 && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 3 }}>
          {kandidat.hinweise.map((h, i) => <li key={i} style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.45 }}>{h}</li>)}
        </ul>
      )}
      {kandidat.auszug.length > 0 && <div style={{ marginTop: 10 }}><Verlauf liste={kandidat.auszug} name={name} max={3} heute={heute} /></div>}

      <div style={{ display: 'grid', gap: 2, marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <Feldzeile label="Titel"><input value={titel} onChange={e => setTitel(e.target.value)} aria-label="Titel der Chance" style={eingabe} /></Feldzeile>
        <Feldzeile label="Art"><Pillen liste={CHANCEN_ARTEN} aktiv={art} onWahl={artWaehlen} /></Feldzeile>
        <Feldzeile label="Wert">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="number" inputMode="decimal" min={0} step={100} value={betrag} placeholder="Betrag in €" aria-label="Betrag in Euro"
              onChange={e => { setBetrag(e.target.value); setVonHand(true); }} style={{ ...eingabe, width: 140 }} />
            <Pillen liste={BASEN} aktiv={basis} onWahl={b => { setBasis(b); setVonHand(true); }} />
          </div>
          <div style={{ ...kleinText, marginTop: 4 }}>
            {wert ? `${euro(gesamt)} gesamt${basis === 'monat' ? ' (12 Monate)' : ''} · gewichtet ${euro(Math.round(gesamt * wahrscheinlichkeit(stufe, eigene) / 100))}` : 'Ohne Wert steht die Chance in der Pipeline gelb.'}
            {leistung.name && !vonHand ? ` · aus „${leistung.name}“` : ''}
          </div>
          {!betrag && (artVorschlag.betrag || katalog) ? (
            <button type="button" onClick={uebernehmen} style={{ marginTop: 6, background: 'none', border: '1px dashed rgba(255,255,255,.2)', borderRadius: 8, padding: '4px 10px', color: C.inkDim, cursor: 'pointer', fontSize: 12.5 }}>
              Katalogpreis übernehmen: {euro((artVorschlag.betrag ? artVorschlag : katalog)!.betrag)}{(artVorschlag.betrag ? artVorschlag : katalog)!.basis === 'monat' ? '/Monat' : ' einmalig'} ({(artVorschlag.betrag ? artVorschlag : katalog)!.leistung})
            </button>
          ) : null}
        </Feldzeile>
        <Feldzeile label="Stufe">
          <Pillen liste={OFFENE} aktiv={stufe} onWahl={setStufe} farbe={LEUCHT.business} />
          <div style={{ ...kleinText, marginTop: 4 }}>Weiter, wenn: {STUFEN.find(s => s.id === stufe)?.weiterWenn}</div>
        </Feldzeile>
        <Feldzeile label="Nächster Schritt">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input ref={schrittRef} value={schritt} onChange={e => { setSchritt(e.target.value); setFehlt(false); }} placeholder="Was als Nächstes passiert (Pflicht)" aria-label="Nächster Schritt" aria-invalid={fehlt && !ok}
              style={{ ...eingabe, flex: '1 1 200px', width: 'auto', minWidth: 0, ...(fehlt && !schritt.trim() ? { borderColor: LEUCHT.kritisch } : {}) }} />
            <input type="date" value={wann} onChange={e => { setWann(e.target.value); setFehlt(false); }} aria-label="Datum des nächsten Schritts" style={{ ...eingabe, width: 'auto', ...(fehlt && !wann ? { borderColor: LEUCHT.kritisch } : {}) }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {(SCHRITT_VORSCHLAEGE[stufe] ?? []).map(t => (
              <button key={t} onClick={() => { setSchritt(t); setFehlt(false); }} className="fassbar" style={{ fontSize: 12, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', border: '1px dashed rgba(255,255,255,.14)', background: 'transparent', color: C.inkDim, fontFamily: SCHRIFT.text }}>{t}</button>
            ))}
          </div>
        </Feldzeile>
        <Feldzeile label="Entscheidung bis">
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><input type="date" value={bis} onChange={e => setBis(e.target.value)} aria-label="Entscheidung bis (optional)" style={{ ...eingabe, width: 'auto' }} /><span style={kleinText}>optional</span></span>
        </Feldzeile>
        <Feldzeile label="Wer"><ZustaendigWahl wert={besitzer} welt="sales" onWahl={setBesitzer} beide={false} /></Feldzeile>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
        <Knopf farbe={LEUCHT.business} aus={!ok} onClick={anlegen}>Chance anlegen<T>⏎</T></Knopf>
        <span title={kandidat.keinBedarf === 'gewonnen' ? 'Bleibt Kunde (Stufe Gewonnen) — Notiz im Verlauf' : 'Stufe → Ruht, Notiz im Verlauf'}>
          <Knopf leise onClick={onKeinBedarf}>{kandidat.keinBedarf === 'gewonnen' ? 'Kein weiterer Bedarf' : 'Kein Bedarf'}<T>n</T></Knopf>
        </span>
        <Knopf leise onClick={onWeiter}>Überspringen<T>s</T></Knopf>
        {kannZurueck && <Knopf leise onClick={onZurueck}>Zurück<T>z</T></Knopf>}
      </div>
      {!ok && <div style={{ ...kleinText, marginTop: 8, color: fehlt ? LEUCHT.kritisch : C.inkLeise }}>Anlegen geht, sobald der nächste Schritt mit Datum steht — ohne Schritt verliert sich jede Chance.</div>}
    </Karte>
  );
}
