// ─── Postfächer — Lage für den Head of IT (Server, 06.10.2026) ──────────────────────────────────────────────────
// Nur Zähler und Zustände (lib/hoi/lage.ts `postfachBefunde`): wie viele IMAP-Postfächer, wie viele mit abgelehnter Anmeldung, mit Fehler,
// verzögert, mit IDLE. Nie Adressen, Anbieter oder Betreffs.

import { alleSpeicher } from '@/lib/zugang/konten';
import type { PostfachLage } from '@/lib/hoi/lage';
import { ladePostfaecher } from './register';
import { ladeImapStand } from './spiegel';
import { imapZustand } from '@/lib/inbox/strom-server';

export async function postfachLage(jetzt = Date.now()): Promise<PostfachLage | null> {
  const l: PostfachLage = { postfaecher: 0, anmeldung: 0, fehler: 0, veraltet: 0, idle: 0 };
  for (const p of await alleSpeicher()) {
    const liste = (await ladePostfaecher(p)).filter(x => x.quelle === 'imap');
    if (!liste.length) continue;
    const s = await ladeImapStand(p);
    for (const x of liste) {
      l.postfaecher++;
      const z = imapZustand(s, x.id, jetzt);
      if (z.stufe === 'anmeldung') l.anmeldung++;
      else if (z.stufe === 'fehler') l.fehler++;
      else if (z.stufe === 'verzoegert') l.veraltet++;
      if (z.idle) l.idle++;
    }
  }
  return l.postfaecher ? l : null;
}
