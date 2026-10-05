// ─── Abmeldelink anwenden (Server, 05.10., Paket „Betroffenenrechte v2“) — Regeln und Token: ./abmelden.ts ──────────────────────
// Eine Abmeldung wirkt auf JEDEN Kontakt, dessen Adresse (Haupt- oder weitere) zum Token passt:
//   · Werbesperre (Art. 21 Abs. 3) — bleibt, auch über Import und Löschung (Sperrliste, Fingerabdruck)
//   · Werbe-Einwilligungen widerrufen (Newsletter, Einladung, Mail-Werbung inkl. Bestandskunden-Werbung § 7 Abs. 3 UWG)
//   · Wiedervorlage/nächster Schritt weg (wie „Werbesperre eintragen“ in der Akte), Verlauf + Änderungsprotokoll („System“, nur Feldnamen)
// Eine schon abgemeldete Person bleibt unverändert (idempotent). Die Route antwortet IMMER gleich — die Zahl hier verlässt den Server nie.

import { updateJson } from '@/lib/store/local-db';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { sperren } from '@/lib/crm/sperrliste';
import { emailsVon } from '@/lib/crm/emails';
import { localDay } from '@/lib/zeit';
import type { Einwilligung, Kontakt } from '@/lib/make-one/crm';
import { ABMELDE_TOKEN, tokenPasst } from './abmelden';

const werblich = (e: Einwilligung) => !e.widerrufenAm && (e.kanal === 'newsletter' || e.kanal === 'einladung' || (e.kanal === 'mail' && (e.grundlage === 'einwilligung' || e.grundlage === 'bestandskunde_7_3')));

/** Rein: die Abmeldung an EINEM Kontakt (derselbe Wert, wenn nichts zu tun ist). */
export function abmeldungAnwenden(k: Kontakt, heute: string, jetzt: string): Kontakt {
  const offen = (k.einwilligungen ?? []).some(werblich);
  if (k.werbesperre && !offen) return k;
  return {
    ...k,
    werbesperre: k.werbesperre ?? { seit: heute, grund: 'Abmeldelink (Widerspruch, Art. 21)' },
    ...(k.einwilligungen ? { einwilligungen: k.einwilligungen.map(e => (werblich(e) ? { ...e, widerrufenAm: heute, widerrufenVon: 'abmeldelink' } : e)) } : {}),
    wiedervorlage: undefined, naechsterSchritt: undefined,
    aktivitaeten: [...(k.aktivitaeten ?? []), { am: jetzt, art: 'system' as const, von: 'system', text: 'Über den Abmeldelink abgemeldet — Werbewiderspruch (Art. 21), Werbe-Einwilligungen widerrufen' }],
  };
}

/** Abmeldung zu einem Token anwenden. Liefert die Zahl der geänderten Kontakte (nur für Tests/Log — nie in die Antwort). */
export async function abmeldenAnwenden(token: string, jetzt = new Date()): Promise<number> {
  if (!ABMELDE_TOKEN.test(token)) return 0;
  const heute = localDay(jetzt), iso = jetzt.toISOString();
  const geaendert: Kontakt[] = [];
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    if (!cur || !Array.isArray(cur.kontakte)) return cur as { kontakte: Kontakt[] };
    let anders = false;
    const kontakte = cur.kontakte.map(k => {
      if (!tokenPasst(token, emailsVon(k).map(a => a.adresse))) return k;
      const n = abmeldungAnwenden(k, heute, iso);
      if (n !== k) { anders = true; geaendert.push(n); }
      return n;
    });
    return anders ? { ...cur, kontakte } : cur;
  });
  // Nachlauf nur bei Treffern — ein Fehler hier wird geloggt, aber nie zur Antwort (sonst verriete er, dass es die Adresse gibt).
  if (geaendert.length) {
    try {
      await protokolliere('kontakte', geaendert.map(k => ({ op: 'geaendert' as const, id: k.id, felder: ['werbesperre', 'einwilligungen', 'wiedervorlage', 'naechsterSchritt', 'aktivitaeten'] })), { art: 'system' });
      await sperren(geaendert, 'werbesperre', heute);
    } catch (e) { console.error('[abmelden] Nachlauf:', e instanceof Error ? e.message.slice(0, 160) : e); }
  }
  return geaendert.length;
}
