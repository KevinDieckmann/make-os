'use client';

// ─── Finanzplanung jetzt — Datenzugriff im Browser ───────────────────────────
// Ein Dokument, Änderungen als Operationen (Konzept § 6.3): Die Oberfläche
// wendet jede Änderung sofort lokal an, schickt sie als PATCH mit dem Stand,
// den sie kennt, und hält die Gegenoperation für Rückgängig (Cmd+Z) bereit.
// Antwortet der Server 409, hat jemand dazwischen geändert: dann gilt sein
// Dokument, und die Meldung bleibt stehen. Fehler bleiben rot, bis man sie
// wegklickt (Lehre aus Cockpit v1).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAbgleich } from '@/hooks/useAbgleich';
import type { FinanzDaten, MonatPrivat, MonatUG, Szenario, IstHistorie } from '@/lib/finanzen/rechenkern';
import { rechneUG, rechnePrivat, kennzahlen, istHistorie } from '@/lib/finanzen/rechenkern';
import { wendeOperationenAn, lies, pfadTeile, OperationUngueltig, type Operation } from '@/lib/finanzen/plan/operationen';
import type { Unterseite } from '@/lib/finanzen/plan/hilfen';

export type Zustand = 'laedt' | 'da' | 'leer' | 'kein' | 'fehler';
export interface Meldung { id: number; art: 'ok' | 'fehler' | 'info'; titel: string; text?: string; aktion?: { label: string; tun: () => void } }

interface Antwort { ok: boolean; haushalt?: string; person?: string; dokument?: FinanzDaten | null; fehler?: string }
interface PatchAntwort { ok: boolean; stand?: string; protokoll?: FinanzDaten['protokoll']; meta?: Record<string, { wer: string; wann: string } | null>; nachladen?: boolean; fehler?: string; dokument?: FinanzDaten }

const MERKER_VERBERGEN = 'make-fp-verbergen';
const UNDO_MAX = 40;

/** Gegenoperation: setzt den alten Wert zurück (oder entfernt, was angehängt wurde). */
function gegenOperation(d: FinanzDaten, op: Operation): Operation | null {
  const teile = pfadTeile(op.pfad);
  if (teile[0] === 'regeln') return null; // Regel wirkt rückwirkend auf Buchungen — nicht sauber umkehrbar
  if (teile[teile.length - 1] === '-') {
    const id = op.neu && typeof op.neu === 'object' && typeof (op.neu as { id?: unknown }).id === 'string' ? (op.neu as { id: string }).id : null;
    return id ? { pfad: `${op.pfad.slice(0, -1)}id=${id}`, feld: op.feld } : null;
  }
  const alt = lies(d, teile);
  return alt === undefined ? { pfad: op.pfad, feld: op.feld } : { pfad: op.pfad, neu: alt, feld: op.feld };
}

export function useFinanzplanDaten() {
  const [dokument, setDokument] = useState<FinanzDaten | null>(null);
  const [zustand, setZustand] = useState<Zustand>('laedt');
  const [person, setPerson] = useState<string>('');
  const [meldungen, setMeldungen] = useState<Meldung[]>([]);
  const [undoAnzahl, setUndoAnzahl] = useState(0);
  const [verbergen, setVerbergenRoh] = useState(false);
  const etag = useRef<string | null>(null);
  const unterwegs = useRef(0);
  const undo = useRef<{ ops: Operation[]; feld: string }[]>([]);
  const dokRef = useRef<FinanzDaten | null>(null);
  dokRef.current = dokument;

  useEffect(() => { try { setVerbergenRoh(localStorage.getItem(MERKER_VERBERGEN) === '1'); } catch { /* ohne Speicher */ } }, []);
  const setVerbergen = useCallback((v: boolean) => { setVerbergenRoh(v); try { localStorage.setItem(MERKER_VERBERGEN, v ? '1' : '0'); } catch { /* egal */ } }, []);

  const melde = useCallback((art: Meldung['art'], titel: string, text?: string, aktion?: Meldung['aktion']) => {
    const id = Date.now() + Math.random();
    setMeldungen(m => [...m.filter(x => x.art !== 'ok' || x.aktion), { id, art, titel, text, aktion }].slice(-4));
    if (art !== 'fehler') setTimeout(() => setMeldungen(m => m.filter(x => x.id !== id)), 4500);
  }, []);
  const weg = useCallback((id: number) => setMeldungen(m => m.filter(x => x.id !== id)), []);

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/finanzplan', { cache: 'no-store', headers: etag.current ? { 'If-None-Match': etag.current } : {} });
      if (r.status === 304) return;
      if (r.status === 403) { setZustand('kein'); return; }
      const d = (await r.json()) as Antwort;
      if (!d.ok) { setZustand('fehler'); melde('fehler', 'Plan konnte nicht geladen werden', d.fehler); return; }
      etag.current = r.headers.get('etag');
      setPerson(d.person ?? '');
      setDokument(d.dokument ?? null);
      setZustand(d.dokument ? 'da' : 'leer');
    } catch { setZustand(z => (z === 'laedt' ? 'fehler' : z)); melde('fehler', 'Keine Verbindung', 'MAKE OS ist gerade nicht erreichbar.'); }
  }, [melde]);
  useEffect(() => { void laden(); }, [laden]);
  useAbgleich(laden, { alle: 30_000, pausiert: () => unterwegs.current > 0 });

  /**
   * Änderung anwenden: lokal sofort, dann PATCH mit Stand-Prüfung. `feld` ist
   * der lesbare Name für Meldung und Protokoll. Liefert true, wenn gespeichert.
   */
  const aendern = useCallback(async (ops: Operation[], feld: string, opt: { merken?: boolean } = {}): Promise<boolean> => {
    const d = dokRef.current;
    if (!d || !ops.length) return false;
    const gegen: Operation[] = [];
    for (const op of ops) { const g = gegenOperation(d, op); if (g) gegen.push(g); }
    let lokal: ReturnType<typeof wendeOperationenAn>;
    try { lokal = wendeOperationenAn(d, ops.map(o => ({ ...o, feld: o.feld ?? feld })), person || 'ich', new Date().toISOString()); }
    catch (err) { melde('fehler', 'Nicht übernommen', err instanceof OperationUngueltig ? err.message : 'Änderung nicht verwertbar.'); return false; }
    const basisStand = d.stand;
    setDokument(lokal.dokument);
    dokRef.current = lokal.dokument;
    unterwegs.current++;
    try {
      const r = await fetch('/api/finanzplan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ basisStand, ops: ops.map(o => ({ ...o, feld: o.feld ?? feld })) }) });
      const a = (await r.json()) as PatchAntwort;
      if (!a.ok) {
        if (r.status === 409 && a.dokument) { setDokument(a.dokument); dokRef.current = a.dokument; etag.current = null; undo.current = []; setUndoAnzahl(0); melde('fehler', 'Inzwischen geändert', a.fehler ?? 'Der Plan wurde neu geladen — bitte noch einmal.'); }
        else { melde('fehler', 'Nicht gespeichert', a.fehler ?? 'Unbekannter Fehler.'); etag.current = null; await laden(); }
        return false;
      }
      const stand = a.stand ?? basisStand;
      const server = a.protokoll ?? [];
      const meta = a.meta ?? {};
      setDokument(cur => {
        if (!cur) return cur;
        const m = { ...cur.meta };
        for (const [k, v] of Object.entries(meta)) { if (v) m[k] = v; else delete m[k]; }
        return { ...cur, stand, meta: m, protokoll: server.length ? [...[...server].reverse(), ...cur.protokoll.slice(lokal.protokoll.length)] : cur.protokoll };
      });
      etag.current = null;
      if (a.nachladen) await laden();
      if (opt.merken !== false && gegen.length === ops.length) {
        undo.current = [...undo.current, { ops: gegen.reverse(), feld }].slice(-UNDO_MAX);
        setUndoAnzahl(undo.current.length);
      }
      return true;
    } catch {
      melde('fehler', 'Nicht gespeichert', 'Keine Verbindung — der Plan wird neu geladen.');
      etag.current = null; await laden();
      return false;
    } finally { unterwegs.current--; }
  }, [laden, melde, person]);

  const rueckgaengig = useCallback(async () => {
    const letzte = undo.current.pop();
    setUndoAnzahl(undo.current.length);
    if (!letzte) { melde('info', 'Nichts rückgängig zu machen'); return; }
    const ok = await aendern(letzte.ops, `Rückgängig: ${letzte.feld}`, { merken: false });
    if (ok) melde('info', 'Rückgängig gemacht', letzte.feld);
  }, [aendern, melde]);

  const gespeichert = useCallback((feld: string) => melde('ok', 'Gespeichert', feld, undo.current.length ? { label: 'Rückgängig', tun: () => { void rueckgaengig(); } } : undefined), [melde, rueckgaengig]);

  return { dokument, zustand, person, laden, aendern, rueckgaengig, undoAnzahl, meldungen, melde, weg, gespeichert, verbergen, setVerbergen };
}

// ── Gerechnete Sicht für alle Ansichten ──────────────────────────────────────

export interface Gerechnet { sz: Szenario; ug: MonatUG[]; pr: MonatPrivat[]; kz: ReturnType<typeof kennzahlen>; h: IstHistorie }

export function rechne(d: FinanzDaten, szenario?: Szenario): Gerechnet {
  const sz = szenario ?? d.szenarien.find(s => s.id === d.aktiv) ?? d.szenarien[0];
  const ug = rechneUG(d, sz);
  const pr = rechnePrivat(d, ug, sz);
  return { sz, ug, pr, kz: kennzahlen(ug, pr), h: istHistorie(d) };
}

export interface PlanKontext extends Gerechnet {
  d: FinanzDaten;
  person: string;
  verbergen: boolean;
  /** Änderung mit lesbarem Feldnamen; meldet „Gespeichert“ selbst. */
  aendere: (ops: Operation[], feld: string) => Promise<boolean>;
  melde: (art: Meldung['art'], titel: string, text?: string) => void;
  /** Unterseite wechseln — mit Parametern (Monat, Zeile) für Sprünge in die Buchungen. */
  geh: (u: Unterseite, params?: Record<string, string | number | undefined>) => void;
  params: URLSearchParams;
}

export const FinanzplanKontext = createContext<PlanKontext | null>(null);
export function usePlan(): PlanKontext {
  const k = useContext(FinanzplanKontext);
  if (!k) throw new Error('usePlan nur innerhalb von <Finanzplan>');
  return k;
}

/** Gerechnete Sicht — neu nur, wenn sich Dokument oder Szenario ändern. */
export function useGerechnet(d: FinanzDaten | null): Gerechnet | null {
  return useMemo(() => (d ? rechne(d) : null), [d]);
}
