// ─── Kontakt öffnen · „Frage stellen“ und „Mit ZOE formulieren“ (28.09.) ────
// GET  → { ok, ki, grund? }  — ist KI gerade verfügbar (Schlüssel, Guthaben, Agent an)?
//        Die Oberfläche blendet „Mit ZOE formulieren“ nur ein, wenn ki = true.
// POST { id, frage? } → { ok, text } — ZOE beantwortet die Frage (ohne Frage: formuliert
//        die Zusammenfassung) NUR aus dem Datenpaket der Person (lib/crm/zusammenfassung.ts
//        `kontaktPaket`): nie die private Notiz, nie Personen mit Werbesperre, keine Kollegen.
//        Kein Guthaben → 402 { ok:false, grund:'guthaben' } — die Oberfläche zeigt einen
//        freundlichen Hinweis statt eines Fehlers. Es wird nichts gespeichert und nichts verschickt.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { NextResponse } from 'next/server';
import { resolveAgent } from '@/lib/agent-config';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { modellSchranke, zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { askText, hasAnthropicKey, guthabenLeer, fremd, FREMD_REGEL } from '@/lib/anthropic';
import { ladeCrm } from '@/lib/crm/speicher';
import { kontaktPaket } from '@/lib/crm/zusammenfassung';
import { localDay } from '@/lib/zeit';
import { kiAus } from '@/lib/datenschutz/ki-lauf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FRAGE_MAX = 500;

async function kiStand(): Promise<{ ki: boolean; grund?: 'schluessel' | 'guthaben' | 'aus' }> {
  if (!hasAnthropicKey()) return { ki: false, grund: 'schluessel' };
  if (guthabenLeer()) return { ki: false, grund: 'guthaben' };
  const agent = await resolveAgent('crm');
  if (!agent.enabled) return { ki: false, grund: 'aus' };
  return { ki: true };
}

/** Nur für eine ausdrücklich benannte Person (Regel 5): ein Dienstaufruf ohne Person fragt nicht im Namen von „kevin“. */
const OHNE_PERSON = () => NextResponse.json({ ok: false, fehler: 'Ohne angemeldete Person keine Frage an ZOE.' }, { status: 401 });

export async function GET(req: Request) {
  if (!personStreng(req)) return OHNE_PERSON();
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  return NextResponse.json({ ok: true, ...(await kiStand()) });
}

export async function POST(req: Request) {
  if (!personStreng(req)) return OHNE_PERSON();
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  if (zuGross(req, 20_000)) return ZU_GROSS(20_000);
  let b: { id?: unknown; frage?: unknown };
  try { b = await jsonBegrenzt(req, 20_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = String(b.id ?? '');
  if (!/^c-[a-z0-9-]{4,60}$/.test(id)) return NextResponse.json({ ok: false, fehler: 'Kontakt fehlt.' }, { status: 400 });
  const frage = typeof b.frage === 'string' ? b.frage.replace(/\s+/g, ' ').trim().slice(0, FRAGE_MAX) : '';

  const stand = await kiStand();
  if (!stand.ki) {
    const text = stand.grund === 'guthaben' ? 'Das KI-Guthaben ist gerade aufgebraucht — die Zusammenfassung oben ist aus den Daten gerechnet und gilt weiter.'
      : stand.grund === 'aus' ? 'ZOE ist für die Markttraktion gerade ausgeschaltet (unter Agenten wieder einschalten).'
      : 'Ohne KI-Schlüssel beantwortet ZOE keine Fragen — die Zusammenfassung oben ist aus den Daten gerechnet.';
    return NextResponse.json({ ok: false, grund: stand.grund, text }, { status: stand.grund === 'guthaben' ? 402 : 200 });
  }
  const schranke = modellSchranke(req); if (schranke) return schranke;

  // Art. 18 zentral (29.09.): eine eingeschränkte Person geht an kein Modell — sie ist hier gar nicht erst da.
  const k = (await kontakteFuerVerarbeitung()).find(x => x.id === id);
  if (!k) return NextResponse.json({ ok: false, fehler: 'Kontakt nicht gefunden oder Verarbeitung eingeschränkt (Art. 18).' }, { status: 404 });
  const heute = localDay();
  const paket = kontaktPaket(k, await ladeCrm(), heute);
  if (!paket) return NextResponse.json({ ok: false, grund: 'gesperrt', text: 'Für diese Person gilt eine Werbesperre — sie geht an keinen Agenten.' }, { status: 403 });

  const agent = await resolveAgent('crm');
  const system = [
    FREMD_REGEL,
    'Du bist ZOE, die Assistenz in der Markttraktion von MAKE OS (Kevin und Malin). Du bekommst das Datenpaket EINER Person (Kontakt, Verlauf, Deals, Mandate, Lead).',
    'Antworte auf Deutsch, knapp (höchstens fünf Sätze), sachlich, ohne Floskeln, ohne Markdown-Überschriften. Nutze NUR, was im Paket steht — fehlt etwas, sag das offen, statt zu raten.',
    'Stützt sich eine Aussage auf die Zusammenfassung, setze ihre Quellen-Nummer (①, ② …) dahinter. Erfinde keine Nummern.',
    'Du verschickst nichts und schlägst keinen Versand vor, der gegen eine fehlende Einwilligung verstößt — MAKE OS verschickt nie selbst.',
  ].join('\n');
  const auftrag = frage
    ? `Frage zu dieser Person: ${frage}`
    : 'Formuliere aus der Zusammenfassung zwei bis vier flüssige Sätze: wo wir mit der Person stehen und was als Nächstes sinnvoll ist. Behalte die Quellen-Nummern bei.';
  const r = await askText({ system, user: `${auftrag}\n\n${fremd('kontakt', JSON.stringify(paket))}`, maxTokens: 1500, zweck: frage ? 'crm-kontakt-frage' : 'crm-kontakt-zusammenfassung', ki: kiAus(req, ['crm'], { anzahl: 1 }), model: agent.model, timeoutMs: 60_000, effort: 'low' });
  if (!r.ok) {
    if (r.status === 402 || r.error === 'guthaben-leer') return NextResponse.json({ ok: false, grund: 'guthaben', text: 'Das KI-Guthaben ist gerade aufgebraucht — die Zusammenfassung oben ist aus den Daten gerechnet und gilt weiter.' }, { status: 402 });
    return NextResponse.json({ ok: false, grund: 'fehler', text: 'ZOE ist gerade nicht erreichbar — bitte gleich noch einmal.' }, { status: 200 });
  }
  return NextResponse.json({ ok: true, text: r.text.trim().slice(0, 3000) });
}
