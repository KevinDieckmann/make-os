// ─── Gmail — Aufbewahrung im Löschfristen-Lauf (Server, 03.10.2026) ──────────
// Frist „Mail-Spiegel“ (Standard 180 Tage, lib/crm/loeschfristen.ts): Der Takt-Lauf kürzt ALLE Spiegel (`gmail-stand--*`), auch von
// Personen, deren Abgleich gerade ruht — sonst bliebe eine Kopie liegen, die niemand mehr pflegt. Das Original bleibt in Gmail.
// Jeder Abgleich wendet dieselbe Grenze selbst an (lib/gmail/abgleich.ts); hier ist das Netz darunter.

import { promises as fs } from 'fs';
import { datenOrdner } from '@/lib/store/local-db';
import { aendereGmailStand, aendereGmailTexte, aufbewahren, ladeGmailStand } from './stand';
import { PERSON_OK } from './typen';

/** Alle Spiegel kürzen (Nachrichten vor `grenzeTag` + über der Höchstzahl); liefert die Zahl entfernter Nachrichten. */
export async function gmailAufraeumen(grenzeTag: string): Promise<number> {
  const namen = (await fs.readdir(datenOrdner()).catch(() => [] as string[])).filter(n => /^gmail-stand--[a-z0-9-]+\.json$/.test(n));
  let gesamt = 0;
  for (const n of namen) {
    const person = n.slice('gmail-stand--'.length, -'.json'.length);
    if (!PERSON_OK.test(person) || !(await ladeGmailStand(person))) continue;
    let weg: string[] = [];
    await aendereGmailStand(person, s => {
      const r = aufbewahren(s.koepfe, grenzeTag);
      weg = r.weg;
      return r.weg.length ? { ...s, koepfe: r.rest } : null;
    });
    if (weg.length) {
      const w = new Set(weg);
      await aendereGmailTexte(person, t => ({ v: 1, texte: Object.fromEntries(Object.entries(t.texte).filter(([id]) => !w.has(id))) }));
      gesamt += weg.length;
    }
  }
  return gesamt;
}
