'use client';

// ─── Markttraktion · Events — gemeinsame Listen, Schreibwege und kleine Bauteile ──────
// Zu zweit am selben Event: geschrieben werden nur die Felder, die sich
// wirklich ändern (api.teil — der Server vereint sie mit seinem Stand), nie
// der ganze Eintrag. So überschreiben Kevin und Malin einander nichts, auch
// nicht am Abend an zwei Geräten. Neu angelegt wird weiter mit api.setze;
// Checklisten-Punkte gehen einzeln über /api/crm/events (Checkliste.tsx).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { feld, Chip, Fortschritt, LEUCHT } from '../../schlank';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import type { Event, Teilnahme, TeilnahmeStatus, LeadStatus } from '@/lib/crm/typen';
import { teilAenderung, type Mix, type MixGruppe } from '@/lib/crm/eventplanung';
import { followUpEingabe, hebtLead, type NachfassErgebnis } from '@/lib/crm/event-bruecke';
import { MARKE_EVENTS, eventName } from '@/lib/crm/marke';
import { statusLabel } from '@/lib/crm/leads';
import { TEAM, BEIDE, anderer, nameVon } from '@/lib/crm/team';
import { datum, type CrmApi } from '../daten';
import { Feld, Pillen } from '../teile';
import { Person } from '../team';
import { ausgenommen } from '@/lib/crm/einschraenkung';

export const FORMATE = [{ id: 'stammtisch', label: 'Stammtisch' }, { id: 'workshop', label: 'Workshop' }, { id: 'dinner', label: 'Dinner' }, { id: 'webinar', label: 'Webinar' }, { id: 'messe', label: 'Messe' }, { id: 'sonstig', label: 'Sonstiges' }] as const;
export const STATUS = [{ id: 'idee', label: 'Idee' }, { id: 'geplant', label: 'Geplant' }, { id: 'einladung', label: 'Einladung läuft' }, { id: 'durchgefuehrt', label: 'Durchgeführt' }, { id: 'abgesagt', label: 'Abgesagt' }] as const;
export const GAST: { id: TeilnahmeStatus; label: string }[] = [{ id: 'vorgemerkt', label: 'vorgemerkt' }, { id: 'eingeladen', label: 'eingeladen' }, { id: 'zugesagt', label: 'zugesagt' }, { id: 'abgesagt', label: 'abgesagt' }, { id: 'da', label: 'war da' }, { id: 'no_show', label: 'nicht gekommen' }];
export type Rolle = NonNullable<Teilnahme['rolle']>;
export const ROLLEN: { id: Rolle; label: string }[] = [{ id: 'gast', label: 'Gast' }, { id: 'co_host', label: 'Co-Host' }, { id: 'speaker', label: 'Speaker' }];
export type Weg = NonNullable<Teilnahme['einladungsweg']>;
export const WEGE: { id: Weg; label: string }[] = [{ id: 'persoenlich', label: 'persönlich' }, { id: 'telefon', label: 'Telefon' }, { id: 'mail', label: 'Mail' }, { id: 'linkedin', label: 'LinkedIn' }];
export const MIX: Record<MixGruppe, { label: string; mehrzahl: string; farbe: string }> = {
  zielkunde: { label: 'Zielkunde', mehrzahl: 'Zielkunden', farbe: LEUCHT.business },
  kunde: { label: 'Kunde/Multiplikator', mehrzahl: 'Kunden/Multiplikatoren', farbe: LEUCHT.beziehung },
  sonstig: { label: 'Sonstige', mehrzahl: 'Sonstige', farbe: C.inkLeise },
};
export const AMPEL = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;

export type Reiter = 'ueberblick' | 'gaeste' | 'ablauf' | 'checkliste' | 'budget' | 'abend' | 'nachfassen';
export interface ReiterProps { e: Event; api: CrmApi; zuKontakt: (id: string) => void }

/** Event ändern: nur die geänderten Felder (api.teil). Unverändertes geht gar nicht erst raus. */
export function eventSetzen(api: CrmApi, e: Event, teil: Partial<Event>): Promise<boolean> {
  const felder = teilAenderung(e, teil);
  return Object.keys(felder).length ? api.teil('events', e.id, felder) : Promise.resolve(true);
}
/** Teilnahme ändern (Status, Notiz, Nachfassen, Weg, lädt ein …): nur diese Felder — zwei Geräte am Einlass stören sich nicht. */
export function gastSetzen(api: CrmApi, t: Teilnahme, teil: Partial<Teilnahme>): Promise<boolean> {
  const felder = teilAenderung(t, teil);
  return Object.keys(felder).length ? api.teil('teilnahmen', t.id, felder) : Promise.resolve(true);
}

// ── Brücke Teilnahme → Lead → Follow-up (lib/crm/event-bruecke.ts) ──────────

type Antwort = { ok: boolean; fehler?: string } & Record<string, unknown>;
/** POST an /api/crm/events — immer mit der Event-ID. */
export const eventsPost = (eventId: string, body: Record<string, unknown>): Promise<Antwort> =>
  fetch('/api/crm/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, ...body }) })
    .then(r => r.json() as Promise<Antwort>).catch(() => ({ ok: false, fehler: 'Nicht gespeichert — keine Verbindung.' }));

export interface LeadMeldung { ziel: { art: 'firma' | 'person'; id: string; name: string }; von: LeadStatus; nach: LeadStatus; geaendert: boolean; grund?: string }

/**
 * Nachfassen mit Ergebnis: Aktivität an der Person (bestehender Weg
 * /api/crm/aktivitaet, mit dem Event als Bezug), dann die Brücke in der
 * Route: followUpAm am Gast, Lead der Firma auf „Im Gespräch“ bei Gespräch
 * oder Termin. Liefert die Meldung für die Oberfläche.
 */
export async function nachfassen(api: CrmApi, e: Event, t: Teilnahme, k: Kontakt, ergebnis: NachfassErgebnis): Promise<{ ok: boolean; text: string; lead?: LeadMeldung }> {
  const label = ergebnis === 'gespraech' ? 'Gespräch' : ergebnis === 'termin' ? 'Termin' : null;
  await api.aktivitaet({
    id: k.id, art: ergebnis === 'erledigt' ? 'event' : ergebnis, bezug: e.id,
    text: label ? `Nachgefasst nach „${eventName(e)}“ — ${label}` : `Nachgefasst nach „${eventName(e)}“`,
    ...(hebtLead(ergebnis) ? { ergebnis } : {}),
  });
  const r = await eventsPost(e.id, { aktion: 'nachfassen', teilnahmeId: t.id, ergebnis });
  void api.laden();
  if (!r.ok) return { ok: false, text: r.fehler ?? 'Nicht gespeichert.' };
  const lead = (r.lead as LeadMeldung | null) ?? undefined;
  const text = !lead ? `${anzeigename(k)} nachgefasst.`
    : lead.geaendert ? `${anzeigename(k)} nachgefasst · Lead „${lead.ziel.name}“ von ${statusLabel(lead.von)} auf ${statusLabel(lead.nach)}.`
    : `${anzeigename(k)} nachgefasst · ${lead.grund ?? `Lead „${lead.ziel.name}“ bleibt auf ${statusLabel(lead.von)}.`}`;
  return { ok: true, text, lead };
}

/**
 * Event löschen über den Serverweg (28.09., W6): POST /api/crm/events { aktion: 'loeschen' } — Teilnahmen weg,
 * offene Follow-ups des Events abgesagt, alles in EINER Änderung. Meldung als Hinweis bzw. Fehler.
 */
export async function eventLoeschen(api: CrmApi, e: Event): Promise<void> {
  const r = await eventsPost(e.id, { aktion: 'loeschen' });
  if (r.ok) api.setHinweis(typeof r.text === 'string' ? r.text : 'Event gelöscht.');
  else api.setFehler(r.fehler ?? 'Nicht gelöscht.');
  await api.laden();
}

/** Echtes Follow-up für einen Gast, der da war (POST /api/crm/followup) — Frist 48 h nach dem Event, Quelle „event“. */
export async function followUpAnlegen(api: CrmApi, e: Event, t: Teilnahme): Promise<{ ok: boolean; text: string }> {
  type FuAntwort = { ok: boolean; text?: string; fehler?: string };
  const r: FuAntwort = await fetch('/api/crm/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(followUpEingabe(e, t)) })
    .then(x => x.json() as Promise<FuAntwort>).catch((): FuAntwort => ({ ok: false, fehler: 'Nicht angelegt — keine Verbindung.' }));
  void api.laden();
  return { ok: !!r.ok, text: r.ok ? (r.text ?? 'Follow-up steht.') : (r.fehler ?? 'Nicht angelegt.') };
}

const NOTEN: { id: '1' | '2' | '3' | '4' | '5'; label: string }[] = [{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }, { id: '4', label: '4' }, { id: '5', label: '5' }];

/** Rückmeldung des Gastes: Note 1–5 (5 = sehr gut) und ein Satz — Teilnahme.feedback, geschrieben als Teil-Änderung. */
export function Feedback({ api, t, heute, kompakt }: { api: CrmApi; t: Teilnahme; heute: string; kompakt?: boolean }) {
  const f = t.feedback ?? {};
  const setze = (teil: { note?: number; text?: string }) => {
    const neu = { ...f, ...teil, am: heute };
    if (neu.text === '') delete neu.text;
    void gastSetzen(api, t, { feedback: neu.note === undefined && !neu.text ? undefined : neu });
  };
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' }}>{kompakt ? 'Note' : 'Rückmeldung des Gastes'}</span>
      <Pillen liste={NOTEN} aktiv={f.note ? (String(f.note) as '1' | '2' | '3' | '4' | '5') : null} onWahl={n => setze({ note: Number(n) })} farbe={LEUCHT.gut} />
      <div style={{ flex: 1, minWidth: kompakt ? 160 : 220 }}><Feld wert={f.text ?? ''} platzhalter="Ein Satz — was hat der Gast gesagt?" onFertig={text => setze({ text: text.trim() })} /></div>
      {f.am && <span style={{ fontSize: 11.5, color: C.inkLeise, whiteSpace: 'nowrap' }} title={f.am}>{datum(f.am, heute)}</span>}
    </div>
  );
}

/**
 * Mehrzeilige Notiz, die beim Verlassen speichert (wie Feld, nur als Textfeld).
 * Solange hier getippt wird, überschreibt der Abgleich (alle 20 s) den Text nicht.
 */
export function Notizfeld({ wert = '', onFertig, platzhalter, zeilen = 2, gross }: { wert?: string; onFertig: (t: string) => void; platzhalter: string; zeilen?: number; gross?: boolean }) {
  const [t, setT] = useState(wert);
  const tippt = useRef(false);
  useEffect(() => { if (!tippt.current) setT(wert); }, [wert]);
  return <textarea value={t} rows={zeilen} placeholder={platzhalter} aria-label={platzhalter} onChange={x => setT(x.target.value)}
    onFocus={() => { tippt.current = true; }} onBlur={() => { tippt.current = false; if (t !== wert) onFertig(t); }}
    style={{ ...feld, resize: 'vertical', fontSize: gross ? TYP.body : TYP.bedien, padding: gross ? '12px 14px' : '8px 11px', lineHeight: 1.5 }} />;
}

/**
 * Kompakter Wechsel Kevin ⇄ Malin — zu zweit reicht ein Klick. Für „wer
 * erledigt den Punkt“ und „wer lädt ein“. `standard` erklärt, woher der Wert
 * kommt, solange niemand ihn eingetragen hat (z. B. „hält die Beziehung“).
 */
export function WerTausch({ wert, onWahl, label, standard, ich }: { wert: string; onWahl: (person: string) => void; label?: string; standard?: string; ich?: string | null }) {
  const naechste = wert === BEIDE || !TEAM.some(m => m.id === wert) ? (ich ?? TEAM[0].id) : anderer(wert);
  return (
    <button onClick={x => { x.stopPropagation(); onWahl(naechste); }} className="fassbar"
      title={`${label ? `${label}: ` : ''}${nameVon(wert)}${standard ? ` (${standard})` : ''} — Klick: ${nameVon(naechste)}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px 3px 4px', borderRadius: 999, cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: C.inkDim, fontSize: 12, fontWeight: 600, fontFamily: SCHRIFT.text, whiteSpace: 'nowrap' }}>
      <Person id={wert} groesse={18} />
      {label && <span style={{ color: C.inkLeise, fontWeight: 500 }}>{label}</span>}
      <span style={{ color: C.ink }}>{nameVon(wert)}</span>
      {standard && <span style={{ color: C.inkLeise, fontWeight: 500 }}>· {standard}</span>}
      <span aria-hidden style={{ color: C.inkLeise }}>⇄</span>
    </button>
  );
}

/** „Kevin 6 · Malin 4“ — je Team-Mitglied eine Zahl mit Plakette; Nullen bleiben weg, außer alle sind null. */
export function JePerson({ zahlen, einheit }: { zahlen: Record<string, number>; einheit?: (n: number) => string }) {
  const liste = TEAM.filter(m => zahlen[m.id]);
  return (
    <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
      {(liste.length ? liste : TEAM).map(m => (
        <span key={m.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
          <Person id={m.id} groesse={18} />{m.name} <b style={{ color: C.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{zahlen[m.id] ?? 0}</b>{einheit ? ` ${einheit(zahlen[m.id] ?? 0)}` : ''}
        </span>
      ))}
    </span>
  );
}

/** Kleine Textschaltfläche (Löschen, Zur Person, Mehr zeigen). */
export function Leise({ children, onClick, farbe }: { children: ReactNode; onClick: () => void; farbe?: string }) {
  return <button onClick={onClick} style={{ background: 'none', border: 'none', color: farbe ?? C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0, textAlign: 'left' }}>{children}</button>;
}

/** Suchfeld über die Kartei: Treffer ohne Gesperrte und ohne die, die schon auf der Liste stehen. */
export function KarteiSuche({ api, e, platzhalter, onWahl }: { api: CrmApi; e: Event; platzhalter: string; onWahl: (kontaktId: string) => void }) {
  const [suche, setSuche] = useState('');
  const crm = api.crm!;
  const drin = new Set(crm.stand.teilnahmen.filter(t => t.eventId === e.id).map(t => t.kontaktId));
  const q = suche.trim().toLowerCase();
  const treffer = q.length >= 2 ? (api.kontakte ?? []).filter(k => !drin.has(k.id) && !ausgenommen(k) && `${k.vorname} ${k.nachname} ${k.firma ?? ''} ${k.email ?? ''}`.toLowerCase().includes(q)).slice(0, 6) : [];
  return (
    <div>
      <input value={suche} onChange={x => setSuche(x.target.value)} placeholder={platzhalter} aria-label={platzhalter} style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
      {treffer.map(k => (
        <button key={k.id} onClick={() => { onWahl(k.id); setSuche(''); }} style={{ display: 'block', textAlign: 'left', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: '5px 0' }}>
          + {anzeigename(k)}{k.firma ? ` · ${k.firma}` : ''}{k.kreis ? ` · Kreis ${k.kreis}` : ''}
        </button>
      ))}
    </div>
  );
}

/**
 * Marke des Events (27.09.): als Chip — ein Klick öffnet das Feld, leer heißt
 * wieder Make.One. Im Anlege-Formular mit eigenem Zustand, im Überblick über
 * eventSetzen; `wert` ist die gespeicherte Marke (undefined = abgeleitet).
 */
export function MarkeWahl({ wert, onWahl }: { wert?: string; onWahl: (marke: string | undefined) => void }) {
  const [offen, setOffen] = useState(false);
  const marke = wert?.trim() || MARKE_EVENTS;
  if (!offen) {
    return (
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setOffen(true)} title="Marke ändern" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><Chip farbe={LEUCHT.beziehung}>{marke}</Chip></button>
        <span style={{ fontSize: 12, color: C.inkLeise }}>{marke === MARKE_EVENTS ? 'unsere Veranstaltungsmarke' : `statt ${MARKE_EVENTS}`}</span>
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Feld wert={wert ?? ''} breite={180} platzhalter={MARKE_EVENTS} onFertig={t => { const m = t.trim().slice(0, 40); onWahl(m && m !== MARKE_EVENTS ? m : undefined); setOffen(false); }} />
      <span style={{ fontSize: 12, color: C.inkLeise }}>leer = {MARKE_EVENTS}</span>
    </span>
  );
}

const AMPEL_TEXT = { gruen: 'passt', gelb: 'knapp', rot: 'Mischung fehlt' } as const;

/** Gästemischung gegen das Soll: Balken je Gruppe mit Soll-Marke, Ampel und was fehlt. `onSoll` macht das Soll editierbar. */
export function MixAnzeige({ m, onSoll }: { m: Mix; onSoll?: (ziel: { zielkunden: number; kunden: number }) => void }) {
  const zeile = (g: MixGruppe, soll?: number, setzen?: (n: number) => void) => (
    <div key={g} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,190px) 1fr 44px auto', gap: 10, alignItems: 'center', fontSize: TYP.bedien }}>
      <span style={{ color: C.inkDim }}>{MIX[g].mehrzahl} <b style={{ color: C.ink, fontWeight: 600 }}>{m.anzahl[g]}</b></span>
      <div style={{ position: 'relative' }}>
        <Fortschritt anteil={m.n ? Math.max(0.02, m.anteil[g] / 100) : 0} farbe={MIX[g].farbe} />
        {soll !== undefined && <span title={`Soll ${soll} %`} style={{ position: 'absolute', top: -3, bottom: -3, left: `${Math.min(100, soll)}%`, width: 2, borderRadius: 1, background: C.ink, opacity: 0.7 }} />}
      </div>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.n ? `${m.anteil[g]} %` : '—'}</span>
      {soll !== undefined ? (setzen
        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.inkLeise, fontSize: 12 }}>Soll <Feld typ="number" wert={String(soll)} breite={64} platzhalter="Soll %" onFertig={v => { const n = Math.round(Number(v)); if (Number.isFinite(n) && n >= 0 && n <= 100) setzen(n); }} /></span>
        : <span style={{ color: C.inkLeise, fontSize: 12 }}>Soll {soll} %</span>) : <span />}
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {m.ampel ? <Chip farbe={AMPEL[m.ampel]}>{AMPEL_TEXT[m.ampel]}</Chip> : null}
        <span style={{ fontSize: 12, color: C.inkLeise }}>{m.basis === 'zugesagt' ? `aus ${m.n} ${m.n === 1 ? 'Zusage' : 'Zusagen'}` : m.basis === 'gaesteliste' ? `aus der Gästeliste (${m.n}) — noch keine Zusagen` : 'noch keine Gäste'}</span>
      </div>
      {zeile('zielkunde', m.ziel.zielkunden, onSoll ? n => onSoll({ ...m.ziel, zielkunden: n }) : undefined)}
      {zeile('kunde', m.ziel.kunden, onSoll ? n => onSoll({ ...m.ziel, kunden: n }) : undefined)}
      {zeile('sonstig')}
      <div style={{ fontSize: 12.5, color: m.ampel === 'rot' ? LEUCHT.achtung : C.inkDim }}>{m.hinweis}</div>
    </div>
  );
}
