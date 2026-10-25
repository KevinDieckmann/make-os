'use client';

// ─── „Über <Postfach> senden (mit PDF)“ — ein Beleg (Angebot · Rechnung) per Klick aus der Inbox (25.10.2026) ────────────────────────────
// Kevin 25.10.: Rechnungsstellung „zumindest als PDF vorbereiten und dann per Google Mail verschicken“. Der Knopf öffnet in der Inbox eine neue Mail
// (lib/inbox/neue-mail.ts — Adresse und Text nur im Sitzungsspeicher, nie in der URL), vorbelegt mit Empfänger, Betreff, Text der vorhandenen Vorlage
// und dem PDF als Anhang. Gesendet wird erst mit „Senden“ in der Inbox (Rechnungen gehen nie automatisch raus); danach vermerkt der Server „versendet
// am … über …“ am Beleg. Ohne verbundenes Postfach bleibt der Rückfall: das Mail-Programm (`mailto`, PDF selbst anhängen).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Knopf } from '../ui';
import { neueMailVorbereiten } from '@/lib/inbox/neue-mail';

interface PostfachKurz { id: string; anzeigename?: string; quelle?: string; zustand?: { stufe?: string } }

/** Das erste nutzbare Postfach des Business-Bereichs (Name für den Knopf) — null ohne, undefined solange es lädt. */
export function useSendePostfach(): { name: string } | null | undefined {
  const [p, setP] = useState<{ name: string } | null | undefined>(undefined);
  useEffect(() => {
    let lebt = true;
    fetch('/api/inbox/postfaecher?space=business', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((j: { postfaecher?: PostfachKurz[] } | null) => {
        const x = (j?.postfaecher ?? []).find(y => y.quelle !== 'whatsapp' && y.zustand?.stufe !== 'anmeldung');
        if (lebt) setP(x ? { name: x.anzeigename || 'Postfach' } : null);
      })
      .catch(() => { if (lebt) setP(null); });
    return () => { lebt = false; };
  }, []);
  return p;
}

export function BelegSendenKnopf({ an, name, betreff, text, pdf, beleg, mailto, leise }: {
  an?: string; name?: string; betreff: string; text: string; pdf: { id: string; name: string }; beleg: { art: 'angebot' | 'rechnung'; id: string }; mailto: string; leise?: boolean;
}) {
  const router = useRouter();
  const postfach = useSendePostfach();
  if (postfach === undefined) return null;
  if (!postfach) return <Knopf leise href={mailto}>Mail öffnen (PDF selbst anhängen)</Knopf>;
  return (
    <Knopf leise={leise} onClick={() => { router.push(neueMailVorbereiten({ ...(an ? { an } : {}), ...(name ? { name } : {}), betreff, text, anhaenge: [{ datei: pdf.id, name: pdf.name }], beleg })); }}>
      Über {postfach.name} senden (mit PDF)
    </Knopf>
  );
}
