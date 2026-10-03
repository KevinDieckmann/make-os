'use client';
// ─── „gehört zu Meilenstein X“ (30.09.) ──────────────────────────────────────
// Eine Aufgabe gehört zu einem Meilenstein, solange sie in seiner Liste liegt (lib/planung/meilenstein-aufgaben.ts —
// nur per Kennung, kein Feld an der Aufgabe). Das Bauteil zeigt den Link dorthin; die Meilensteine werden nur geladen,
// wenn die Liste eine Meilenstein-Liste ist — über den EINEN Zwischenspeicher der Planungsdaten (lib/planung/ziele-client.ts).

import Link from 'next/link';
import { useMemo } from 'react';
import { Flag } from 'lucide-react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { istMeilensteinListe, meilensteinVonAufgabe } from '@/lib/planung/meilenstein-aufgaben';
import { useZieleUndMeilensteine } from '@/lib/planung/ziele-client';

export function MeilensteinVerweis({ listeId }: { listeId?: string }) {
  const istListe = istMeilensteinListe(listeId);
  const daten = useZieleUndMeilensteine(istListe);
  const m = useMemo(() => (istListe && daten ? meilensteinVonAufgabe({ listeId }, daten.meilensteine) : null), [istListe, daten, listeId]);
  if (!m) return null;
  return (
    <Link href={WEG.meilenstein(m.id)} title="Zum Meilenstein — Aufgaben, Verlauf, Dateien, Notizen"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.aktiv, textDecoration: 'none', fontFamily: SCHRIFT.text, fontSize: 13 }}>
      <Flag size={12} />gehört zu Meilenstein „{m.titel}“
    </Link>
  );
}
