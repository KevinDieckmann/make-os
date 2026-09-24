'use client';

// ─── CRM · Events — gemeinsame Listen, Schreibwege und kleine Bauteile ──────
// Geschrieben wird immer der ganze Eintrag über api.setze (Einzeländerung,
// der Server säubert ihn) — damit Kevin und Malin gleichzeitig am selben
// Event arbeiten können.

import { useEffect, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { feld, Chip, Fortschritt, LEUCHT } from '../../schlank';
import { anzeigename } from '@/lib/make-one/crm';
import type { Event, Teilnahme, TeilnahmeStatus } from '@/lib/crm/typen';
import type { Mix, MixGruppe } from '@/lib/crm/eventplanung';
import type { CrmApi } from '../daten';
import { Feld } from '../teile';

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

type Eintrag = { id: string } & Record<string, unknown>;
export const eventSetzen = (api: CrmApi, e: Event, teil: Partial<Event>) => api.setze('events', { ...e, ...teil } as unknown as Eintrag);
export const gastSetzen = (api: CrmApi, t: Teilnahme, teil: Partial<Teilnahme>) => api.setze('teilnahmen', { ...t, ...teil } as unknown as Eintrag);

/** Mehrzeilige Notiz, die beim Verlassen speichert (wie Feld, nur als Textfeld). */
export function Notizfeld({ wert = '', onFertig, platzhalter, zeilen = 2, gross }: { wert?: string; onFertig: (t: string) => void; platzhalter: string; zeilen?: number; gross?: boolean }) {
  const [t, setT] = useState(wert);
  useEffect(() => { setT(wert); }, [wert]);
  return <textarea value={t} rows={zeilen} placeholder={platzhalter} aria-label={platzhalter} onChange={x => setT(x.target.value)} onBlur={() => { if (t !== wert) onFertig(t); }}
    style={{ ...feld, resize: 'vertical', fontSize: gross ? TYP.body : TYP.bedien, padding: gross ? '12px 14px' : '8px 11px', lineHeight: 1.5 }} />;
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
  const treffer = q.length >= 2 ? (api.kontakte ?? []).filter(k => !drin.has(k.id) && !k.werbesperre && `${k.vorname} ${k.nachname} ${k.firma ?? ''} ${k.email ?? ''}`.toLowerCase().includes(q)).slice(0, 6) : [];
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
