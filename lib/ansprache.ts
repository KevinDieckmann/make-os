// ─── MAKE OS — Die Ansprache entwerfen ──────────────────────────────────────
// Der Outreach-Agent kannte bisher nur Firmen aus der Zielliste. Die
// Masterliste kennt MENSCHEN: Position, Seniorität, was über die Person
// bekannt ist, und einen Aufhänger, den Kevin selbst hat recherchieren
// lassen. Daraus wird eine Ansprache, die nicht nach Serienbrief klingt.
//
// Versendet wird hier nichts. Nie. Der Entwurf geht in Apple Mail als
// Entwurf oder in die Zwischenablage — Kevin schickt.

import { askJson } from '@/lib/anthropic';
import { resolveAgent } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';

export const RECHT =
  'B2B-Kaltansprache per E-Mail ist in DE nur mit mutmaßlicher Einwilligung sauber (§7 UWG) — bei kaltem Kontakt ist LinkedIn oder Telefon der sichere erste Kanal. Versand bleibt bei dir.';

export interface Entwurf { betreff: string; email: string; linkedin: string; hinweis: string }

export async function entwurfFuer(k: Kontakt): Promise<{ ok: true; entwurf: Entwurf } | { ok: false; fehler: string }> {
  const agent = await resolveAgent('outreach');
  if (!agent.enabled) return { ok: false, fehler: 'Outreach-Agent ist ausgeschaltet.' };

  const system = [
    'Du schreibst Erstansprachen für Kevin Dieckmann (Gründer KEMARIS, Produkt POINCAP — Controlling-/Liquiditäts-Cockpit für den Mittelstand).',
    'KEVINS STIMME: klar, auf Augenhöhe, unternehmerisch, warm aber ohne Anbiederung. Kurze Sätze. Kein Vertriebs-Sprech.',
    'SPRACHREGELN (verbindlich): NIEMALS diese Wörter: Dashboard, Tool, Disruption, Unicorn, Game Changer, Reporting, „einfach zu bedienen". Stattdessen wo passend: Echtzeit-Finanzbild, Steuerungslücke, Kapitalstau, Souveränität. Anrede: Sie — außer die Person ist als Netzwerk-/Apple-Kontakt markiert, dann Du.',
    'AUFBAU E-MAIL (max 110 Wörter): 1) der konkrete Aufhänger unten — nichts erfinden, 2) EIN Satz, welches Problem POINCAP für genau diese Rolle löst, 3) niedrigschwellige Frage als Abschluss. Betreff: konkret, max 7 Wörter.',
    'AUFBAU LINKEDIN (max 55 Wörter): persönlicher, ohne Pitch-Absatz — Aufhänger + eine ehrliche Frage.',
    'Wenn Fakten fehlen, bleib allgemein statt zu erfinden. KEINE erfundenen Zahlen, Namen oder Ereignisse.',
    'Antworte NUR als JSON: {"betreff":"…","email":"…","linkedin":"…"}',
  ].join('\n');

  const user = [
    `PERSON: ${anzeigename(k)}`,
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
    `AUFHÄNGER (von Kevin recherchiert, benutze ihn): ${k.aufhaenger ?? '— keiner, dann allgemein bleiben'}`,
    k.notiz ? `Kevins Notiz: ${k.notiz}` : '',
  ].filter(Boolean).join('\n');

  const r = await askJson<{ betreff?: string; email?: string; linkedin?: string }>({
    zweck: 'outreach', system, user, maxTokens: 3500, model: agent.model, timeoutMs: 120_000,
  });
  if (!r.ok || !r.data?.email) return { ok: false, fehler: r.error ?? 'Kein Entwurf erhalten.' };

  await logRun('outreach', `Ansprache entworfen: ${anzeigename(k)}${k.firma ? ` (${k.firma})` : ''}`, { id: k.id, prio: k.prio });
  return {
    ok: true,
    entwurf: {
      betreff: String(r.data.betreff ?? `POINCAP × ${k.firma ?? anzeigename(k)}`).slice(0, 140),
      email: String(r.data.email).slice(0, 2000),
      linkedin: String(r.data.linkedin ?? '').slice(0, 800),
      hinweis: RECHT,
    },
  };
}
