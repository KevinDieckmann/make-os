'use client';
// Der aktive Space (Privat/Business) — aus der Adresse, sonst der zuletzt gewählte (localStorage).
// Leiste und Kopf lesen denselben Stand; ein Wechsel schickt ein Ereignis, damit beide folgen.
// Seit 08.10. (Aufräumen Etappe 1) liest der Hook die Parameter über `useSearchParams`: auf Heute wechselt nur
// `?space=` (gleicher Pfad) — mit dem alten Lesen aus `window.location` blieb der Space dort stehen.
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { spaceVonAdresse, SPACE_MERKER, SPACE_EREIGNIS, type SpaceId } from '@/lib/make-one/spaces';

function gemerkt(): SpaceId {
  try { const v = localStorage.getItem(SPACE_MERKER); return v === 'business' ? 'business' : 'privat'; } catch { return 'privat'; }
}

export function useSpace(): { space: SpaceId; ausAdresse: SpaceId | null; suche: string; setzen: (s: SpaceId) => void } {
  const pfad = usePathname() ?? '/os';
  const params = useSearchParams();
  const text = params?.toString() ?? '';
  const suche = text ? `?${text}` : '';
  const [gewaehlt, setGewaehlt] = useState<SpaceId>('privat');
  useEffect(() => { setGewaehlt(gemerkt()); }, [pfad, suche]);
  useEffect(() => {
    const auf = () => setGewaehlt(gemerkt());
    window.addEventListener(SPACE_EREIGNIS, auf);
    return () => window.removeEventListener(SPACE_EREIGNIS, auf);
  }, []);
  const ausAdresse = spaceVonAdresse(pfad, suche);
  const setzen = useCallback((s: SpaceId) => { try { localStorage.setItem(SPACE_MERKER, s); } catch { /* egal */ } setGewaehlt(s); window.dispatchEvent(new Event(SPACE_EREIGNIS)); }, []);
  // Die Adresse gewinnt: wer auf einer Business-Seite ist, ist im Business-Space — und der wird gemerkt.
  useEffect(() => { if (ausAdresse && ausAdresse !== gemerkt()) { try { localStorage.setItem(SPACE_MERKER, ausAdresse); } catch { /* egal */ } setGewaehlt(ausAdresse); window.dispatchEvent(new Event(SPACE_EREIGNIS)); } }, [ausAdresse]);
  return { space: ausAdresse ?? gewaehlt, ausAdresse, suche, setzen };
}
