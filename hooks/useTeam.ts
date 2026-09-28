'use client';
// ─── Das Team im Browser (28.09., U4) ───────────────────────────────────────
// Liest GET /api/team mit ETag (304, wenn sich nichts geändert hat) und teilt
// den Stand zwischen allen Karten der Seite. Ohne Zugang oder Verbindung gelten
// die Rollen-Platzhalter. Schreiben nur als Einzeländerung mit Stand; bei 409
// kommt der aktuelle Stand zurück und ersetzt die Sicht.

import { useCallback, useEffect, useState } from 'react';
import { platzhalterTeam, type TeamAntwort, type TeamEintrag, type TeamPerson } from '@/lib/make-one/team-typen';

interface Stand { team: TeamPerson[]; ausDaten: boolean; geladen: boolean; gesperrt: boolean }

let stand: Stand = { team: platzhalterTeam(), ausDaten: false, geladen: false, gesperrt: false };
let etag: string | null = null;
let laeuft: Promise<void> | null = null;
const hoerer = new Set<(s: Stand) => void>();
const setzen = (s: Stand) => { stand = s; hoerer.forEach(h => h(s)); };

async function laden(): Promise<void> {
  if (laeuft) return laeuft;
  laeuft = (async () => {
    try {
      const r = await fetch('/api/team', { cache: 'no-store', headers: etag ? { 'If-None-Match': etag } : {} });
      if (r.status === 304) { if (!stand.geladen) setzen({ ...stand, geladen: true }); return; }
      if (r.status === 403) { etag = null; setzen({ team: platzhalterTeam(), ausDaten: false, geladen: true, gesperrt: true }); return; }
      const d = (await r.json()) as TeamAntwort;
      if (!r.ok || !Array.isArray(d.team)) { etag = null; return; }
      etag = r.headers.get('etag');
      setzen({ team: d.team, ausDaten: !!d.ausDaten, geladen: true, gesperrt: false });
    } catch { etag = null; } finally { laeuft = null; }
  })();
  return laeuft;
}

export type TeamOp = { op: 'upsert'; eintrag: TeamEintrag; stand?: string } | { op: 'teil'; id: string; felder: Partial<TeamEintrag>; stand?: string };

/** Eine Änderung senden — { ok } oder { ok: false, fehler } (409: Sicht zeigt schon den aktuellen Stand). */
async function schreiben(ops: TeamOp[]): Promise<{ ok: boolean; fehler?: string; status: number }> {
  try {
    const r = await fetch('/api/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops }) });
    const d = (await r.json().catch(() => ({}))) as Partial<TeamAntwort>;
    if (Array.isArray(d.team)) { etag = null; setzen({ team: d.team, ausDaten: !!d.ausDaten, geladen: true, gesperrt: false }); }
    if (r.status === 409 && d.konflikte) return { ok: false, status: 409, fehler: 'Wurde inzwischen geändert — neu geladen. Bitte noch einmal.' };
    return r.ok ? { ok: true, status: r.status } : { ok: false, status: r.status, fehler: d.fehler ?? 'Nicht gespeichert.' };
  } catch { return { ok: false, status: 0, fehler: 'Nicht erreichbar.' }; }
}

export function useTeam(): Stand & { laden: () => Promise<void>; schreiben: typeof schreiben } {
  const [s, setS] = useState<Stand>(stand);
  useEffect(() => {
    hoerer.add(setS);
    setS(stand);
    void laden();
    return () => { hoerer.delete(setS); };
  }, []);
  const neu = useCallback(() => laden(), []);
  return { ...s, laden: neu, schreiben };
}
