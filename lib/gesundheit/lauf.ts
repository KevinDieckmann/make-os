// ─── MAKE OS — Der Gesundheitslauf ──────────────────────────────────────────
// Was der Agent „gesundheit" tut, wenn der Takt ihn ruft: für jede gekoppelte
// Person nachsehen, welcher Slot dran ist, die Nachricht bauen, senden,
// merken. Deterministisch — kein Modell. Das Modell kommt erst, wenn Kevin
// oder Malin antworten.
//
// Nicht gekoppelt = übersprungen und trotzdem markiert. Sonst würde der Takt
// jede Minute denselben Auftrag einreihen, solange niemand gekoppelt ist.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { speicherFuer, nameVon, type Person } from '@/lib/zoe/raum';
import { alleSpeicher, namenVon } from '@/lib/zugang/konten';
import { resolveVitals } from '@/lib/vitals';
import { localDay } from '@/lib/zeit';
import { anPersonMelden, botenEingerichtet, botenKanalFuer, inhalteErlaubtFuer } from '@/lib/zoe/an-person';
import { faelligeSlots, markiere, morgenText, mittagText, abendText, wochenText, type Slot, type TaktStand } from './takt';
import { hautTrend, streakStand, routineQuote, type HautLog, type StreakLog, type RoutinenLog } from './eintraege';
import { sichtbarFuer } from '@/lib/planung/routinen';
import { appLink, hinweisCheckIn } from '@/lib/datenschutz/telegram-text';
import { aussenAdresse } from '@/lib/innen';

interface Routine { id: string; label: string; wann: string; aktiv: boolean; owner?: string }


/** Aktive Routinen, die `person` sieht — eigene und gemeinsame (`sichtbarFuer`, Praxis-Fund 04.10.). */
async function routinen(person: Person): Promise<Routine[]> {
  const f = await loadJson<{ routinen?: Routine[] }>('routinen');
  return sichtbarFuer((f?.routinen ?? []).filter(r => r.aktiv), person);
}

/** Symptom-Regler und Zähler „Sauber geblieben“ der Person — NUR aus ihrer eigenen Einstellung im Körper-Profil (08.10. abends,
 *  Fragebogen Teil 3): keine Abfrage einer festen Person mehr. Ohne Profil (oder nicht lesbar) beides aus. */
async function anzeigeEinstellung(person: Person): Promise<{ symptom: string | null; sauberZaehler: boolean }> {
  try {
    const { koerperLaden } = await import('./koerper-server');
    const { koerper } = await koerperLaden(person);
    return { symptom: koerper?.symptom?.name ?? null, sauberZaehler: koerper?.sauberZaehler === true };
  } catch { return { symptom: null, sauberZaehler: false }; }
}

/** WHOOP frisch holen (08.10.): für JEDE Person mit eigener Verbindung (vorher fest nur das Erstkonto) — wartet höchstens 30 s.
 *  Fehler sind hier keine: die Morgennachricht sagt dann eben ehrlich „keine Werte“. */
async function whoopHolen(person: Person): Promise<void> {
  try { const { whoopFrischFuer } = await import('@/lib/whoop/takt'); await whoopFrischFuer(person); } catch { /* nichts — die Nachricht kommt trotzdem */ }
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
    const { faelligeZeilen } = await import('@/lib/finanzen/haushalt/zoe');
    const zeilen = faelligeZeilen(await ladeHaushalt(z.haushalt)).slice(0, 4);
    return zeilen.length ? `\n\n💶 Finanzen\n${zeilen.map(t => `• ${t}`).join('\n')}` : '';
  } catch { return ''; }
}

/**
 * Die Nachricht eines Slots aufs Handy. Seit 05.10. (DSGVO, Telegram ist nicht Ende-zu-Ende-verschlüsselt, Drittland):
 * ohne die Ausnahme der Person NUR ein neutraler Hinweis mit Link — keine Werte (Recovery, Schlaf), keine Fragen zu
 * Beschwerden, keine Beträge. Mit der Ausnahme wie früher. Seit 08.10. (ZOE auf WhatsApp) zählt die Ausnahme DES Kanals,
 * der genutzt wird (`inhalteErlaubtFuer`: WhatsApp „Inhalte senden“, sonst wie bisher Telegram).
 */
export async function nachrichtFuer(person: Person, slot: Slot, _origin: string, o: { voll?: boolean } = {}): Promise<string> {
  const heute = localDay();
  const name = (await namenVon())[person] ?? nameVon(person);
  // `voll` ausdrücklich: ein Weg, der den Kanal schon kennt (die Telegram-Kopplung schickt direkt in den Chat → Telegram-Ausnahme).
  const voll = o.voll ?? await inhalteErlaubtFuer(person).catch(() => false);
  if (!voll) return hinweisCheckIn(name, slot, appLink(aussenAdresse(), '/os/gesundheit'));
  const alle = await routinen(person);
  if (slot === 'morgen') {
    await whoopHolen(person);
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
  const anzeige = await anzeigeEinstellung(person);
  if (slot === 'abend') {
    return abendText({
      name,
      routinen: alle.filter(r => r.wann === 'abend').map(r => r.label),
      streakAktiv: anzeige.sauberZaehler,
      symptom: anzeige.symptom,
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
    symptom: anzeige.symptom,
  });
}

export interface LaufErgebnis { ok: boolean; text: string; gesendet: number; uebersprungen: number }

export async function gesundheitsLauf(origin: string, nur?: Slot, jetzt = new Date()): Promise<LaufErgebnis> {
  if (!(await botenEingerichtet())) return { ok: false, text: 'Kein Bote eingerichtet (ZOE auf WhatsApp oder Telegram) — der Gesundheits-Takt hat keinen Weg aufs Handy.', gesendet: 0, uebersprungen: 0 };
  const heute = localDay(jetzt);
  let stand = (await loadJson<TaktStand>('gesundheit-takt')) ?? {};
  const zeilen: string[] = [];
  let gesendet = 0, uebersprungen = 0;

  const namen = await namenVon();
  for (const person of await alleSpeicher()) {
    const slots = faelligeSlots(stand, person, jetzt, heute).filter(s => !nur || s === nur);
    if (!slots.length) continue;
    // ZOE auf WhatsApp (verbunden) oder Telegram (gekoppelt) — sonst übersprungen wie bisher (08.10.: EIN Sendeweg, lib/zoe/an-person.ts).
    const gekoppelt = (await botenKanalFuer(person)) !== null;
    for (const slot of slots) {
      if (!gekoppelt) {
        uebersprungen++;
        zeilen.push(`${namen[person] ?? nameVon(person)} · ${slot}: nicht gekoppelt, übersprungen`);
      } else {
        const text = await nachrichtFuer(person, slot, origin);
        const r = await anPersonMelden(person, 'gesundheit', text, { link: '/os/gesundheit' });
        if (r.erreicht) { gesendet++; zeilen.push(`${namen[person] ?? nameVon(person)} · ${slot}: gesendet`); }
        else { zeilen.push(`${namen[person] ?? nameVon(person)} · ${slot}: ${r.fehler ?? 'nicht zugestellt'}`); continue; }
      }
      stand = markiere(stand, person, slot, heute);
    }
  }
  await updateJson<TaktStand>('gesundheit-takt', () => stand);
  return { ok: true, text: zeilen.length ? `GESUNDHEIT: ${zeilen.join(' · ')}` : 'GESUNDHEIT: nichts fällig.', gesendet, uebersprungen };
}
