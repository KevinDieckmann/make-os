// ─── MAKE OS — Die Ansprache entwerfen ──────────────────────────────────────
// Der Outreach-Agent kannte bisher nur Firmen aus der Zielliste. Die
// Masterliste kennt MENSCHEN: Position, Seniorität, was über die Person
// bekannt ist, und einen selbst recherchierten Aufhänger. Daraus wird eine
// Ansprache, die nicht nach Serienbrief klingt. Absender und Produkte kommen
// seit 09.10. aus dem Konto der auslösenden Person und dem Produktkatalog
// (lib/crm/absender.ts) — keine feste Person, Firma oder Marke im Code.
//
// Versendet wird hier nichts. Nie. Der Entwurf geht in die Inbox (neue Mail,
// Postfach wählen) oder in die Zwischenablage — gesendet wird per Einzelklick.

import { askJson } from '@/lib/anthropic';
import type { KiKontext } from '@/lib/datenschutz/ki-tor';
import { resolveAgent } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { absenderLaden, absenderZeilen, betreffRueckfall } from '@/lib/crm/absender';

// 24.09.: Der alte Hinweis („bei kaltem Kontakt ist LinkedIn oder Telefon der
// sichere erste Kanal“) war falsch — LinkedIn-Nachrichten zählen als
// elektronische Post (OLG Hamm), Kaltanrufe brauchen einen konkreten Anlass.
// Welcher Kanal zulässig ist, sagt jetzt die Kanal-Ampel (lib/crm/recht.ts).
export const RECHT =
  'Werbung per Mail oder LinkedIn-Nachricht nur mit Einwilligung oder als Bestandskunde (§ 7 UWG); ohne Grundlage nur eine Vernetzungsanfrage ohne Werbebotschaft. Welcher Kanal geht, zeigt die Ampel. Versand bleibt bei dir.';

export interface Entwurf { betreff: string; email: string; linkedin: string; hinweis: string }

export async function entwurfFuer(k: Kontakt, ki: KiKontext = { lauf: 'aufruf', person: null, kategorien: ['crm'], anzahl: 1 }): Promise<{ ok: true; entwurf: Entwurf } | { ok: false; fehler: string }> {
  if (k.eingeschraenkt) return { ok: false, fehler: `Verarbeitung eingeschränkt (Art. 18) seit ${k.eingeschraenkt.seit} — kein Entwurf.` };
  if (k.werbesperre) return { ok: false, fehler: `Werbesperre seit ${k.werbesperre.seit} — kein Entwurf.` };
  const agent = await resolveAgent('outreach');
  if (!agent.enabled) return { ok: false, fehler: 'Outreach-Agent ist ausgeschaltet.' };

  const absender = await absenderLaden(ki.person);
  const system = [
    'Du schreibst Erstansprachen (E-Mail und LinkedIn-Nachricht) als Entwurf — versendet wird nur von Hand.',
    ...absenderZeilen(absender),
    'STIMME: klar, auf Augenhöhe, unternehmerisch, warm aber ohne Anbiederung. Kurze Sätze. Kein Vertriebs-Sprech, keine Buzzwords (kein „Game Changer“, keine „Disruption“).',
    'Weitere Sprachregeln, Begriffe und Stimme der Instanz stehen in den Brain-Regeln — hier gilt nur das Obige. Anrede: laut „Anrede“-Zeile; fehlt sie, Sie — außer die Person ist als Netzwerk-/Apple-Kontakt markiert, dann Du.',
    'AUFBAU E-MAIL (max 110 Wörter): 1) der konkrete Aufhänger unten — nichts erfinden, 2) höchstens EIN Satz, welches Problem eines der Produkte oben für genau diese Rolle löst (ohne Produkt: weglassen), 3) niedrigschwellige Frage als Abschluss. Betreff: konkret, max 7 Wörter.',
    'AUFBAU LINKEDIN (max 55 Wörter): persönlicher, ohne Pitch-Absatz — Aufhänger + eine ehrliche Frage.',
    'Wenn Fakten fehlen, bleib allgemein statt zu erfinden. KEINE erfundenen Zahlen, Namen oder Ereignisse.',
    'Antworte NUR als JSON: {"betreff":"…","email":"…","linkedin":"…"}',
  ].join('\n');

  const user = [
    `PERSON: ${anzeigename(k)}`,
    k.anrede ? `Anrede: ${k.anrede}` : '',
    k.position ? `Position: ${k.position}` : k.jobtitel ? `Position: ${k.jobtitel}` : '',
    k.senioritaet ? `Seniorität: ${k.senioritaet}` : '',
    k.personInfo ? `Über die Person: ${k.personInfo}` : '',
    k.typ ? `Kontakttyp: ${k.typ}${k.kategorie ? ` (${k.kategorie})` : ''}` : '',
    '',
    k.firma ? `FIRMA: ${k.firma}` : '',
    k.firmaBranche ? `Branche: ${k.firmaBranche}` : '',
    k.firmaStadt ? `Ort: ${k.firmaStadt}` : '',
    k.firmaMitarbeiter ? `Größe: ${k.firmaMitarbeiter} Mitarbeiter` : '',
    k.marktinfo ? `Marktinfo: ${k.marktinfo}` : '',
    k.signale ? `Signale: ${k.signale}` : '',
    k.kiBezug ? `KI-Bezug: ${k.kiBezug}` : '',
    '',
    `AUFHÄNGER (selbst recherchiert, benutze ihn): ${k.aufhaenger ?? '— keiner, dann allgemein bleiben'}`,
    k.notiz ? `Eigene Notiz: ${k.notiz}` : '',
  ].filter(Boolean).join('\n');

  const r = await askJson<{ betreff?: string; email?: string; linkedin?: string }>({
    zweck: 'outreach', system, user, maxTokens: 3500, model: agent.model, timeoutMs: 120_000,
    // Absender (Konto) und Produktkatalog (CRM) stehen mit im Prompt.
    ki: { ...ki, kategorien: Array.from(new Set([...ki.kategorien, 'crm', 'konto'] as const)) },
  });
  if (!r.ok || !r.data?.email) return { ok: false, fehler: r.error ?? 'Kein Entwurf erhalten.' };

  await logRun('outreach', `Ansprache entworfen: ${anzeigename(k)}${k.firma ? ` (${k.firma})` : ''}`, { id: k.id, prio: k.prio }, { person: ki.person });
  return {
    ok: true,
    entwurf: {
      betreff: String(r.data.betreff ?? betreffRueckfall(k.firma ?? anzeigename(k))).slice(0, 140),
      email: String(r.data.email).slice(0, 2000),
      linkedin: String(r.data.linkedin ?? '').slice(0, 800),
      hinweis: RECHT,
    },
  };
}
