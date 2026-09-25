'use client';

// ─── CRM — Daten auf der Seite ──────────────────────────────────────────────
// Zwei Quellen: die Kartei (Personen, /api/state/kontakte) und der CRM-Bestand
// (Chancen, Mandate, Leistungen, Events, /api/crm/bestand). Jede Handlung
// schickt eine Einzeländerung; der Abgleich holt alle 20 Sekunden den Stand,
// damit Kevin und Malin gleichzeitig arbeiten können.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAbgleich } from '@/hooks/useAbgleich';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, CrmListe, ChancenStufe } from '@/lib/crm/typen';
import type { Prognose, Ampel } from '@/lib/crm/pipeline';
import type { MandatLage } from '@/lib/crm/kunden';
import type { EventZahlen } from '@/lib/crm/events';

export interface CrmAntwort {
  ok: boolean; heute: string; stand: CrmBestand;
  /** Wer hier angemeldet ist (Team-Kürzel) — für „Meins“, Übergaben und Freigaben. */
  ich: string;
  stufen: { id: ChancenStufe; label: string; p: number; weiterWenn: string; offen: boolean }[];
  prognose: Prognose; gewinnquote: { gewonnen: number; verloren: number; quote: number | null };
  ampel: Record<string, { ampel: Ampel; gruende: string[] }>;
  mandate: Record<string, MandatLage>;
  /** Faktor Zahlung aus den Rechnungen im Finanzplan (null = keine passende Rechnung). */
  zahlung: Record<string, { wert: number; text: string } | null>;
  mrr: number; konzentration: { kunde: string; anteil: number } | null;
  events: Record<string, EventZahlen>;
  /** Nächster Termin je Person (aus dem Geschäftskalender). */
  termine: Record<string, { titel: string; start: string }>;
}

/**
 * Große Abfrage mit Stand (ETag, lib/http/json-antwort.ts): Der Browser sagt,
 * welchen Stand er hat; unverändert kommt 304 und hier null — dann bleibt alles,
 * wie es ist, und nichts wird neu gezeichnet. `staende` merkt sich je Adresse
 * den letzten Stand.
 */
export async function holeMitStand<T>(url: string, staende: Map<string, string>): Promise<T | null> {
  const alt = staende.get(url);
  const r = await fetch(url, { cache: 'no-store', headers: alt ? { 'If-None-Match': alt } : {} });
  if (r.status === 304) return null;
  const e = r.headers.get('etag');
  if (e && r.ok) staende.set(url, e); else staende.delete(url);
  return (await r.json()) as T;
}

export const neueId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function useCrm() {
  const [crm, setCrm] = useState<CrmAntwort | null>(null);
  const [kontakte, setKontakte] = useState<Kontakt[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const unterwegs = useRef(0);
  // Letzter Stand je Abfrage — der Abgleich holt nur, was sich geändert hat (25.09.).
  const staende = useRef(new Map<string, string>());
  /** Schreiben ging schief: beim nächsten Abgleich alles frisch holen, damit nichts Ungespeichertes stehen bleibt. */
  const fehlschlag = (text: string) => { staende.current.clear(); setFehler(text); };

  const laden = useCallback(async () => {
    if (unterwegs.current) return;
    try {
      const [a, b] = await Promise.all([holeMitStand<CrmAntwort>('/api/crm/bestand', staende.current), holeMitStand<{ kontakte?: Kontakt[] }>('/api/state/kontakte', staende.current)]);
      if (a?.ok) setCrm(a);
      if (b) setKontakte(b.kontakte ?? []);
      setFehler(null);
    } catch { staende.current.clear(); setFehler('Nicht erreichbar.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  // Signale aus Mail und Kalender (höchstens alle 5 Minuten, der Server entscheidet) — danach neu laden, wenn etwas dazukam.
  useEffect(() => { fetch('/api/crm/signale', { method: 'POST' }).then(r => r.json()).then(d => { if (d?.neu) void laden(); }).catch(() => {}); }, [laden]);
  useAbgleich(laden, { alle: 20_000, pausiert: () => unterwegs.current > 0 });

  /** CRM-Eintrag anlegen/ändern (ganzer Eintrag). */
  const setze = useCallback(async (liste: CrmListe, eintrag: { id: string } & Record<string, unknown>) => {
    unterwegs.current++;
    setCrm(alt => {
      if (!alt) return alt;
      const l = alt.stand[liste] as unknown as { id: string }[];
      const neu = l.some(x => x.id === eintrag.id) ? l.map(x => (x.id === eintrag.id ? eintrag : x)) : [...l, eintrag];
      return { ...alt, stand: { ...alt.stand, [liste]: neu } };
    });
    try {
      const r = await fetch('/api/crm/bestand', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [{ liste, op: 'upsert', eintrag }] }) }).then(x => x.json());
      if (r.ok) setCrm(r); else fehlschlag(r.fehler ?? 'Nicht gespeichert.');
    } catch { fehlschlag('Nicht gespeichert — keine Verbindung.'); }
    finally { unterwegs.current--; }
  }, []);

  /**
   * Nur diese Felder ändern (Server vereint mit dem aktuellen Stand) — so
   * überschreiben Kevin und Malin am selben Eintrag nie die Felder der/des anderen.
   */
  const teil = useCallback(async (liste: CrmListe, id: string, felder: Record<string, unknown>) => {
    unterwegs.current++;
    setCrm(alt => (alt ? { ...alt, stand: { ...alt.stand, [liste]: (alt.stand[liste] as unknown as { id: string }[]).map(x => (x.id === id ? { ...x, ...felder } : x)) } } : alt));
    try {
      const r = await fetch('/api/crm/bestand', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [{ liste, op: 'teil', id, felder }] }) }).then(x => x.json());
      if (r.ok) setCrm(r); else fehlschlag(r.fehler ?? 'Nicht gespeichert.');
    } catch { fehlschlag('Nicht gespeichert — keine Verbindung.'); }
    finally { unterwegs.current--; }
  }, []);

  /** An Kevin oder Malin übergeben (/api/crm/uebergabe) — danach neu laden. */
  const uebergeben = useCallback(async (body: { art: string; id?: string; ids?: string[]; an: string; notiz?: string; frist?: string }) => {
    unterwegs.current++;
    try {
      const r = await fetch('/api/crm/uebergabe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'keine Verbindung' }));
      if (!r.ok) setFehler(r.fehler ?? 'Nicht übergeben.');
      return r as { ok: boolean; text?: string; fehler?: string };
    } finally { unterwegs.current--; void laden(); }
  }, [laden]);

  const weg = useCallback(async (liste: CrmListe, id: string) => {
    unterwegs.current++;
    try {
      const r = await fetch('/api/crm/bestand', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [{ liste, op: 'delete', id }] }) }).then(x => x.json());
      if (r.ok) setCrm(r);
    } finally { unterwegs.current--; }
  }, []);

  /** Kartei: einen Kontakt ändern (ganzer Eintrag, Einzeländerung). */
  const kontaktSetzen = useCallback(async (k: Kontakt) => {
    unterwegs.current++;
    setKontakte(alt => (alt ? (alt.some(x => x.id === k.id) ? alt.map(x => (x.id === k.id ? k : x)) : [...alt, k]) : alt));
    try {
      const r = await fetch('/api/state/kontakte', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [{ op: 'upsert', eintrag: { ...k, geaendertAm: new Date().toISOString().slice(0, 10) } }] }) }).then(x => x.json());
      if (!r.ok) fehlschlag(r.error ?? 'Nicht gespeichert.');
    } catch { fehlschlag('Nicht gespeichert — keine Verbindung.'); }
    finally { unterwegs.current--; }
  }, []);

  /** Aktivität am Kontakt (Ergebnis, Notiz, nächster Schritt) — Regeln laufen auf dem Server. */
  const aktivitaet = useCallback(async (body: Record<string, unknown>) => {
    unterwegs.current++;
    try {
      const r = await fetch('/api/crm/aktivitaet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json());
      if (r.kontakt) setKontakte(alt => (alt ? alt.map(x => (x.id === r.kontakt.id ? r.kontakt : x)) : alt));
      else fehlschlag(r.error ?? 'Nicht gespeichert.');
      return r as { ok?: boolean; kontakt?: Kontakt; hinweis?: string; error?: string };
    } finally { unterwegs.current--; }
  }, []);

  return { crm, kontakte, fehler, setFehler, laden, setze, teil, uebergeben, weg, kontaktSetzen, aktivitaet, ich: crm?.ich ?? null };
}
export type CrmApi = ReturnType<typeof useCrm>;

export const euro = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
export const kurzEuro = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} T€` : `${Math.round(n)} €`);
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export function datum(iso?: string | null, heute?: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const kurz = `${WT[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.${heute && iso.slice(0, 4) !== heute.slice(0, 4) ? iso.slice(2, 4) : ''}`;
  if (!heute) return kurz;
  const n = Math.round((Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 864e5);
  return n === 0 ? 'heute' : n === 1 ? 'morgen' : n === -1 ? 'gestern' : kurz;
}
export const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
