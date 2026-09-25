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
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Leer, Fortschritt, LEUCHT } from '../schlank';
import { anzeigename, type Kontakt, type Kreis } from '@/lib/make-one/crm';
import { TEAM, BEIDE, anderer, nameVon, haeltBeziehung, verantwortlich } from '@/lib/crm/team';
import { QualifizierungsRunde } from './Leads';
import {
  kreisKandidaten, kreisBilanz, kreisZusammenfassung, letzteNotiz, KREIS_WAHL, KREIS_GRUPPEN,
  type KreisKandidat, type KreisGruppe,
} from '@/lib/crm/runden';
import { type CrmApi, datum } from './daten';
import { Pillen, Feldzeile } from './teile';
import { Person, ZustaendigWahl } from './team';

/** 'chancen' heißt seit 25.09. Qualifizierungs-Runde: Leads im Gespräch bis zum SQL (Ebene 1 → 2). */
export type RundenArt = 'kreis' | 'chancen';
interface RundenProps { api: CrmApi; name: (p: string) => string; zuKontakt: (id: string) => void; zurueck: () => void }

export function Runden({ api, art, name, zuKontakt, zurueck }: RundenProps & { art: RundenArt }) {
  // Handy: volle Breite; Rechner: eine Spalte in der Mitte — eine Karte, ein Blick.
  return (
    <div style={{ width: '100%', maxWidth: 720, margin: '0 auto', display: 'grid', gap: 14 }}>
      {art === 'kreis'
        ? <KreisRunde api={api} name={name} zuKontakt={zuKontakt} zurueck={zurueck} />
        : <QualifizierungsRunde api={api} zuKontakt={zuKontakt} zurueck={zurueck} />}
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
