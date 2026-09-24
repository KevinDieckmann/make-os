// ─── MAKE OS — Der Gesundheitslauf ──────────────────────────────────────────
// Was der Agent „gesundheit" tut, wenn der Takt ihn ruft: für jede gekoppelte
// Person nachsehen, welcher Slot dran ist, die Nachricht bauen, senden,
// merken. Deterministisch — kein Modell. Das Modell kommt erst, wenn Kevin
// oder Malin antworten.
//
// Nicht gekoppelt = übersprungen und trotzdem markiert. Sonst würde der Takt
// jede Minute denselben Auftrag einreihen, solange niemand gekoppelt ist.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { speicherFuer, nameVon, type Person } from '@/lib/jarvis/raum';
import { alleSpeicher, namenVon } from '@/lib/zugang/konten';
import { resolveVitals } from '@/lib/vitals';
import { localDay } from '@/lib/zeit';
import { ladeStand, chatsFuerPerson, sendeAnPerson, telegramKonfiguriert } from '@/lib/telegram';
import { faelligeSlots, markiere, morgenText, mittagText, abendText, wochenText, type Slot, type TaktStand } from './takt';
import { hautTrend, streakStand, routineQuote, type HautLog, type StreakLog, type RoutinenLog } from './eintraege';

interface Routine { id: string; label: string; wann: string; aktiv: boolean }


async function routinen(): Promise<Routine[]> {
  const f = await loadJson<{ routinen?: Routine[] }>('routinen');
  return (f?.routinen ?? []).filter(r => r.aktiv);
}

/** Ob der Streak für diese Person Thema ist: Kevins erklärtes Ziel (29.07.),
 *  bei Malin nur, wenn sie selbst angefangen hat, ihn zu führen. */
async function streakAktiv(person: Person, log: StreakLog, heute: string): Promise<boolean> {
  if (person === 'kevin') return true;
  return streakStand(log, heute).eintraege30 > 0;
}

/** Whoop nachts holen — nur für Kevin, nur wenn eingerichtet. Fehler sind hier
 *  keine: die Morgennachricht sagt dann eben ehrlich „keine Werte". */
async function whoopHolen(origin: string): Promise<void> {
  try {
    await fetch(`${origin}/api/whoop/sync`, {
      method: 'POST', headers: { 'x-make-key': process.env.MAKE_OS_KEY ?? '' }, signal: AbortSignal.timeout(30_000),
    });
  } catch { /* nichts — die Nachricht kommt trotzdem */ }
}

/**
 * Fällige private Posten für die Morgennachricht (24.09.). Kevin hat Beträge
 * in Briefings ausdrücklich erlaubt. Nur für Personen mit Haushalt; Telegram-
 * Bot-Chats sind nicht Ende-zu-Ende-verschlüsselt — das weiß Kevin.
 */
async function haushaltZeilen(person: Person): Promise<string> {
  try {
    const { haushaltFuer } = await import('@/lib/finanzen/haushalt/zugriff');
    const z = await haushaltFuer(person);
    if (!z) return '';
    const { ladeHaushalt } = await import('@/lib/finanzen/haushalt/speicher');
    const { faelligeZeilen } = await import('@/lib/finanzen/haushalt/jarvis');
    const zeilen = faelligeZeilen(await ladeHaushalt(z.haushalt)).slice(0, 4);
    return zeilen.length ? `\n\n💶 Finanzen\n${zeilen.map(t => `• ${t}`).join('\n')}` : '';
  } catch { return ''; }
}

export async function nachrichtFuer(person: Person, slot: Slot, origin: string): Promise<string> {
  const heute = localDay();
  const name = (await namenVon())[person] ?? nameVon(person);
  const alle = await routinen();
  if (slot === 'morgen') {
    if (person === 'kevin') await whoopHolen(origin);
    const v = await resolveVitals(heute, person);
    const text = morgenText({
      name,
      vitals: { rec: v.rec, sleep: v.sleep, heute: v.heute },
      routinen: alle.filter(r => r.wann === 'morgen').map(r => r.label),
    });
    return text + await haushaltZeilen(person);
  }
  if (slot === 'mittag') return mittagText(name);
  const streak = (await loadJson<StreakLog>(speicherFuer('streak', person))) ?? {};
  if (slot === 'abend') {
    return abendText({
      name,
      routinen: alle.filter(r => r.wann === 'abend').map(r => r.label),
      streakAktiv: await streakAktiv(person, streak, heute),
    });
  }
  // woche
  const [haut, hl, journal, vitalsLog] = await Promise.all([
    loadJson<HautLog>(speicherFuer('haut', person)),
    loadJson<RoutinenLog>(speicherFuer('health-log', person)),
    loadJson<Record<string, unknown>>(speicherFuer('journal', person)),
    loadJson<Record<string, { rec?: number }>>(speicherFuer('vitals', person)),
  ]);
  const t7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(`${heute}T12:00:00`); d.setDate(d.getDate() - i); return localDay(d); });
  const recs = t7.map(d => vitalsLog?.[d]?.rec).filter((x): x is number => typeof x === 'number');
  const q = routineQuote(hl ?? {}, alle.map(r => r.id), heute, 7);
  return wochenText({
    name,
    recovery7: recs.length ? Math.round(recs.reduce((a, b) => a + b, 0) / recs.length) : undefined,
    routinenQuote: q.quote, routinenTage: q.tage,
    journalTage: t7.filter(d => journal?.[d]).length,
    haut: hautTrend(haut ?? {}, heute),
    streak: streakStand(streak, heute),
  });
}

export interface LaufErgebnis { ok: boolean; text: string; gesendet: number; uebersprungen: number }

export async function gesundheitsLauf(origin: string, nur?: Slot, jetzt = new Date()): Promise<LaufErgebnis> {
  if (!telegramKonfiguriert()) return { ok: false, text: 'Kein Telegram-Token — der Gesundheits-Takt hat keinen Weg zu Kevin.', gesendet: 0, uebersprungen: 0 };
  const heute = localDay(jetzt);
  const tg = await ladeStand();
  let stand = (await loadJson<TaktStand>('gesundheit-takt')) ?? {};
  const zeilen: string[] = [];
  let gesendet = 0, uebersprungen = 0;

  const namen = await namenVon();
  for (const person of await alleSpeicher()) {
    const slots = faelligeSlots(stand, person, jetzt, heute).filter(s => !nur || s === nur);
    if (!slots.length) continue;
    const gekoppelt = chatsFuerPerson(tg, person).length > 0;
    for (const slot of slots) {
      if (!gekoppelt) {
        uebersprungen++;
        zeilen.push(`${namen[person] ?? nameVon(person)} · ${slot}: nicht gekoppelt, übersprungen`);
      } else {
        const text = await nachrichtFuer(person, slot, origin);
        const r = await sendeAnPerson(person, text);
        if (r.erreicht) { gesendet++; zeilen.push(`${namen[person] ?? nameVon(person)} · ${slot}: gesendet`); }
        else { zeilen.push(`${namen[person] ?? nameVon(person)} · ${slot}: ${r.fehler ?? 'nicht zugestellt'}`); continue; }
      }
      stand = markiere(stand, person, slot, heute);
    }
  }
  await updateJson<TaktStand>('gesundheit-takt', () => stand);
  return { ok: true, text: zeilen.length ? `GESUNDHEIT: ${zeilen.join(' · ')}` : 'GESUNDHEIT: nichts fällig.', gesendet, uebersprungen };
}
