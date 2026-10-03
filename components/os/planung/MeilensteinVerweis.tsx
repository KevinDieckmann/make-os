'use client';
// ─── „gehört zu Meilenstein X“ (30.09.) ──────────────────────────────────────
// Eine Aufgabe gehört zu einem Meilenstein, solange sie in seiner Liste liegt (lib/planung/meilenstein-aufgaben.ts —
// nur per Kennung, kein Feld an der Aufgabe). Das Bauteil zeigt den Link dorthin; die Meilensteine werden nur geladen,
// wenn die Liste eine Meilenstein-Liste ist (einmal je Seite, danach aus dem Zwischenspeicher des Moduls).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { istMeilensteinListe, meilensteinVonAufgabe } from '@/lib/planung/meilenstein-aufgaben';
import type { Meilenstein } from '@/lib/planung/typen';

let ladung: Promise<Meilenstein[]> | null = null;
/** Meilensteine einmal je Seite laden (`neu` = nach einer Änderung frisch holen). */
export function meilensteineHolen(neu = false): Promise<Meilenstein[]> {
  if (!ladung || neu) {
    ladung = fetch('/api/state/meilensteine', { cache: 'no-store' }).then(r => r.json()).then(d => (Array.isArray(d.meilensteine) ? d.meilensteine as Meilenstein[] : [])).catch(() => { ladung = null; return []; });
  }
  return ladung;
}

export function MeilensteinVerweis({ listeId }: { listeId?: string }) {
  const [m, setM] = useState<Meilenstein | null>(null);
  useEffect(() => {
    if (!istMeilensteinListe(listeId)) { setM(null); return; }
    let lebt = true;
    void meilensteineHolen().then(l => { if (lebt) setM(meilensteinVonAufgabe({ listeId }, l)); });
    return () => { lebt = false; };
  }, [listeId]);
  if (!m) return null;
  return (
    <Link href={WEG.meilenstein(m.id)} title="Zum Meilenstein — Aufgaben, Verlauf, Dateien, Notizen"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.aktiv, textDecoration: 'none', fontFamily: SCHRIFT.text, fontSize: 13 }}>
      <Flag size={12} />gehört zu Meilenstein „{m.titel}“
    </Link>
  );
}
