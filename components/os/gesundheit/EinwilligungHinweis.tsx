'use client';

// ─── Gesundheit: Hinweis zur Art.-9-Einwilligung (05.10.) ───────────────────────────────────────────────────────────
// Einmal oben im Bereich Gesundheit: Bestands-Konten ohne Erklärung sehen „bitte bestätigen“, neue Konten ohne
// Einwilligung „noch keine Einwilligung“ — beides mit Weg zu System › Datenschutz. Ist alles erklärt, bleibt er weg.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Hinweis } from '../ui';

interface Stand { hinweisOffen: boolean; verarbeitungErlaubt: boolean }

export function EinwilligungHinweis() {
  const [s, setS] = useState<Stand | null>(null);
  useEffect(() => {
    let lebt = true;
    fetch('/api/datenschutz/gesundheit', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => { if (lebt && d?.ok) setS(d.stand); }).catch(() => undefined);
    return () => { lebt = false; };
  }, []);
  if (!s || (!s.hinweisOffen && s.verarbeitungErlaubt)) return null;
  return (
    <Hinweis art={s.hinweisOffen ? 'achtung' : 'info'} titel={s.hinweisOffen ? 'Bitte bestätigen: Einwilligung Gesundheitsdaten' : 'Noch keine Einwilligung'}
      aktion={<Link href="/os/datenschutz#gesundheit">Zur Einwilligung</Link>}>
      {s.hinweisOffen
        ? 'Gesundheitsdaten sind besonders geschützt (Art. 9 DSGVO). Bis du bestätigst, bleibt alles wie bisher — aber nichts geht an die KI oder an deinen Partner.'
        : 'Gesundheitsdaten werden erst erfasst, wenn du eingewilligt hast. An die KI und an deinen Partner gehen sie nur mit gesonderter Einwilligung.'}
    </Hinweis>
  );
}
