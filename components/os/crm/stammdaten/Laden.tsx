'use client';

// ─── Stammdaten — Ladezustand, der nicht hängen bleibt ──────────────────────
// „Lädt …“ darf kein totes Ende sein: nach 8 Sekunden ohne Antwort oder bei
// einem Fehler steht da, was los ist, und ein Knopf „Noch einmal“. Die Karte
// ist nur eingehängt, solange nichts da ist — kommt die Antwort, geht sie weg.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Leer, LEUCHT } from '../../ui';

export const LADE_FRIST_MS = 8000;

export function Laedt({ fehler, nochEinmal, was = 'Die Stammdaten' }: { fehler?: string | null; nochEinmal: () => void; was?: string }) {
  const [langsam, setLangsam] = useState(false);
  const [versuch, setVersuch] = useState(0);
  useEffect(() => {
    setLangsam(false);
    const t = setTimeout(() => setLangsam(true), LADE_FRIST_MS);
    return () => clearTimeout(t);
  }, [versuch]);
  if (!fehler && !langsam) return <Leer>Lädt …</Leer>;
  return (
    <div role="status" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 2px' }}>
      <span style={{ fontSize: TYP.bedien, color: fehler ? LEUCHT.kritisch : C.inkDim, lineHeight: 1.5 }}>
        {fehler ? `${was} konnten nicht geladen werden: ${fehler}` : `${was} brauchen länger als erwartet.`}
      </span>
      <Knopf leise onClick={() => { setVersuch(v => v + 1); nochEinmal(); }}>Noch einmal</Knopf>
    </div>
  );
}
