// ─── Postfächer — Aufbewahrung im Löschfristen-Lauf (Server, 06.10.2026) ─────────────────────────────────────────
// Frist „Mail-Spiegel“ (Standard 180 Tage, lib/crm/loeschfristen.ts): der Morgenlauf kürzt ALLE IMAP-Spiegel (`imap-stand--*`), auch von
// Postfächern, deren Abgleich gerade ruht (z. B. „Verbindung erneuern“ offen). Das Original bleibt beim Anbieter. Jeder Abgleich wendet
// dieselbe Grenze selbst an (lib/postfach/abgleich.ts); hier ist das Netz darunter. Köpfe ohne Register-Eintrag (verwaist) fallen ganz weg.

import { promises as fs } from 'fs';
import { datenOrdner } from '@/lib/store/local-db';
import { ladePostfaecher } from './register';
import { aendereImapStand, aendereImapTexte, imapAufbewahren, ladeImapStand } from './spiegel';
import { PERSON_OK } from './typen';

/** Alle IMAP-Spiegel kürzen; liefert die Zahl entfernter Nachrichten. */
export async function imapAufraeumen(grenzeTag: string): Promise<number> {
  const namen = (await fs.readdir(datenOrdner()).catch(() => [] as string[])).filter(n => /^imap-stand--[a-z0-9-]+\.json$/.test(n));
  let gesamt = 0;
  for (const n of namen) {
    const person = n.slice('imap-stand--'.length, -'.json'.length);
    if (!PERSON_OK.test(person)) continue;
    const s = await ladeImapStand(person);
    if (!Object.keys(s.koepfe).length) continue;
    const da = new Set((await ladePostfaecher(person)).map(p => p.id));
    let weg: string[] = [];
    await aendereImapStand(person, cur => {
      const ohneWaisen = Object.fromEntries(Object.entries(cur.koepfe).filter(([, k]) => da.has(k.postfachId)));
      const r = imapAufbewahren(ohneWaisen, grenzeTag);
      weg = Object.keys(cur.koepfe).filter(id => !r.rest[id]);
      return weg.length ? { ...cur, koepfe: r.rest } : null;
    });
    if (weg.length) {
      const w = new Set(weg);
      await aendereImapTexte(person, t => ({ v: 1, texte: Object.fromEntries(Object.entries(t.texte).filter(([id]) => !w.has(id))) }));
      gesamt += weg.length;
    }
  }
  return gesamt;
}
