'use client';

// ─── Antworten an einem Lead, live gerechnet (03.10.) ──────────────────────────────────────────
// Eine Stelle für Runde und Lead-Ansicht: die gewählten Stufen samt den gespiegelten alten Feldern liegen lokal (der Score rechnet
// beim Tippen sofort mit), geschrieben wird über /api/crm/lead; kurz nach dem letzten Klick lädt die Oberfläche neu, damit Kartei und
// CRM wieder die eine Quelle sind.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { localDay } from '@/lib/zeit';
import type { Kriterien, Qual } from '@/lib/crm/typen';
import { salesBereit, fehltBisSqlZeile, type LeadZeile } from '@/lib/crm/leads';
import { leadScore, scoringKontext } from '@/lib/crm/score';
import { altWertAusStufe, type ScoringEinstellungen } from '@/lib/crm/scoring';
import type { CrmApi } from '../daten';
import { leadPost } from './hilfen';

export function useLeadFragen(api: CrmApi, z: LeadZeile, einstellungen: ScoringEinstellungen) {
  const heute = api.crm?.heute ?? localDay();
  const [lokal, setLokal] = useState<{ stufen: Record<string, string>; kriterien: Kriterien; fit?: Qual }>({ stufen: z.stufen ?? {}, kriterien: z.kriterien, ...(z.fit ? { fit: z.fit } : {}) });
  const [antworten, setAntworten] = useState<Record<string, string>>(z.antworten ?? {});
  const [fehler, setFehler] = useState('');
  const nachladen = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (nachladen.current) clearTimeout(nachladen.current); }, []);
  const personen = useMemo(() => z.personen.map(p => (api.kontakte ?? []).find(x => x.id === p.id)).filter((x): x is NonNullable<typeof x> => !!x), [z.personen, api.kontakte]);
  const score = useMemo(() => leadScore(personen, { status: z.status, kriterien: lokal.kriterien, ...(lokal.fit ? { fit: lokal.fit } : {}), stufen: lokal.stufen }, heute, undefined, scoringKontext(api.crm?.stand)), [personen, z.status, lokal, heute, api.crm]);

  const speichern = useCallback(async (felder: Record<string, unknown>): Promise<boolean> => {
    const r = await leadPost({ aktion: 'setze', id: z.id, felder });
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht gespeichert.'); return false; }
    setFehler('');
    if (nachladen.current) clearTimeout(nachladen.current);
    nachladen.current = setTimeout(() => { void api.laden(true); }, 700);
    return true;
  }, [z.id, api]);
  const nachStatus = (['neu', 'kontaktiert', 'im_gespraech'] as string[]).includes(z.status) ? 'qualifizierung' : undefined;
  const stufeWaehlen = useCallback((kid: string, stufeId: string | null) => {
    const k = einstellungen.sales.teile.flatMap(t => t.kriterien).find(x => x.id === kid);
    setLokal(l => {
      const stufen = { ...l.stufen }; if (stufeId === null) delete stufen[kid]; else stufen[kid] = stufeId;
      const w = k ? altWertAusStufe(k, stufeId) : undefined;
      return { stufen, kriterien: k?.alt && k.alt !== 'fit' && w ? { ...l.kriterien, [k.alt]: w } : l.kriterien, ...(k?.alt === 'fit' && w ? { fit: w } : l.fit ? { fit: l.fit } : {}) };
    });
    void speichern({ stufen: { [kid]: stufeId }, ...(nachStatus ? { status: nachStatus } : {}) });
  }, [einstellungen, speichern, nachStatus]);
  const antwortSpeichern = useCallback((kid: string, text: string) => { setAntworten(a => ({ ...a, [kid]: text })); void speichern({ antworten: { [kid]: text } }); }, [speichern]);
  const bereit = salesBereit({ kriterien: lokal.kriterien, score });
  const fehlt = fehltBisSqlZeile({ kriterien: lokal.kriterien, score });
  return { lokal, antworten, score, fehler, setFehler, speichern, stufeWaehlen, antwortSpeichern, bereit, fehlt };
}
