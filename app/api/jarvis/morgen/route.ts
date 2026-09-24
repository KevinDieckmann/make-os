// ─── MAKE OS — Der Morgenlauf: Jarvis bereitet vor ──────────────────────────
// Baustein 2+4 zusammengeführt (07.09.). Bis hierher entstand ein Vorschlag
// nur, wenn Kevin etwas angestoßen hat. Jarvis konnte handeln — aber nie von
// selbst anfangen.
//
// Kevins Antwort auf die Frage, woran er merkt, dass es sich lohnt:
// „Morgens liegt der Stapel fertig da." Genau das macht dieser Lauf. Er sieht
// sich die Lage an und legt konkrete Vorschläge in den Stapel — nichts wird
// ausgeführt, alles wartet auf einen Klick.
//
// Wichtig: ALLES wird gestapelt, auch was tagsüber frei durchliefe. Der
// Unterschied ist nicht das Werkzeug, sondern dass niemand danach gefragt hat.
// Was Jarvis nachts allein erarbeitet, soll Kevin einmal gesehen haben.

import { NextResponse } from 'next/server';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { gatherBrain, promptBrain } from '@/lib/brain';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { ladeHaushalt } from '@/lib/finanzen/haushalt/speicher';
import { blockHaushalt } from '@/lib/finanzen/haushalt/jarvis';
import { fuehreAus } from '@/lib/jarvis/ausfuehren';
import { offeneAnzahl, lies as liesStapel } from '@/lib/jarvis/stapel';
import { personAus, type Person } from '@/lib/jarvis/raum';
import { localDay } from '@/lib/zeit';
import { innenAdresse } from '@/lib/innen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Nur diese Werkzeuge darf der Morgenlauf vorschlagen.
 *
 * Bewusst eng: er soll den Tag vorbereiten, nicht die Buchhaltung umschreiben.
 * Alles, was Geld bewegt, bleibt draußen — dafür fehlt ihm nachts jede
 * Grundlage, und ein Vorschlag ohne Grundlage ist nur Arbeit für Kevin.
 */
const ERLAUBT = ['create_task', 'plan_block'] as const;

const WERKZEUGE = [
  {
    name: 'create_task',
    description: 'Schlägt eine Aufgabe vor. Nur für Dinge, die aus der Lage KLAR folgen — eine überfällige Rechnung, ein Termin ohne Vorbereitung, ein Meilenstein ohne nächsten Schritt. Keine Allgemeinplätze.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Imperativ, konkret, unter 80 Zeichen' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        why: { type: 'string', description: 'Ein Satz: woraus folgt das' },
        faellig: { type: 'string', description: 'YYYY-MM-DD (optional)' },
      },
      required: ['title', 'why'],
    },
  },
  {
    name: 'plan_block',
    description: 'Schlägt einen Block im Tagesplan vor — Fokuszeit, Reha, Vorbereitung. Nur in freie Zeit; feste Termine stehen im Live-Zustand. Fenster 06:00–22:00, Raster 15 Minuten.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD, heute oder morgen' },
        startMin: { type: 'number', description: 'Minuten ab 00:00 (540 = 09:00)' },
        dauerMin: { type: 'number', description: '15–240' },
        titel: { type: 'string' },
        art: { type: 'string', enum: ['fokus', 'reha', 'routine', 'pause', 'aufgabe', 'block'] },
      },
      required: ['date', 'startMin', 'dauerMin', 'titel'],
    },
  },
];

export type Tageszeit = 'morgen' | 'abend';

function anweisung(person: Person, lage: string, zeit: Tageszeit, liegt: string): string {
  if (zeit === 'abend') return anweisungAbend(person, lage, liegt);
  const wer = person === 'malin' ? 'Malin' : 'Kevin';
  return [
    `Du bist JARVIS und bereitest ${wer}s Tag vor, bevor er den Rechner aufklappt.`,
    '',
    'AUFTRAG: Sieh dir die Lage an und schlage HÖCHSTENS FÜNF Dinge vor, die heute wirklich zählen.',
    'Jeder Vorschlag muss aus einer konkreten Stelle der Lage folgen — eine überfällige Zahlung, ein Termin,',
    'ein Meilenstein ohne nächsten Schritt, eine ungeschützte Fokuszeit, die Bandscheibe (Reha täglich 30 Min).',
    '',
    'STRENG: Lieber ZWEI gute Vorschläge als fünf mittelmäßige. Nichts vorschlagen, was schon als Aufgabe',
    'offen ist oder schon im Stapel liegt. Keine Allgemeinplätze („Prioritäten prüfen", „Mails checken") —',
    'das ist Arbeit, keine Hilfe.',
    liegt,
    'Findest du nichts Belastbares, schlage NICHTS vor und sag es in einem Satz.',
    '',
    'REIHENFOLGE: Schreibe ZUERST den Lagebericht, DANN rufe die Werkzeuge auf. Ohne Bericht steht Kevin',
    'morgens vor einem Stapel ohne Begründung — der Bericht ist wichtiger als der fünfte Vorschlag.',
    'Höchstens drei Sätze, keine Aufzählung, keine Überschriften, kein Gruß: was ist heute die eine wichtige Sache.',
    '',
    `Heute ist ${localDay()}.`,
    '',
    'LAGE:',
    lage,
  ].join('\n');
}

/**
 * Der Abendlauf. Kevins Vorgabe war „gebuendelt, morgens und abends" — der
 * Morgen bereitet vor, der Abend raeumt nach.
 *
 * Bewusst ein ANDERER Auftrag, nicht derselbe zweimal: abends ist die Frage
 * nicht „was ist heute wichtig", sondern „was ist heute liegengeblieben und
 * was muss morgen frueh stehen". Derselbe Prompt zweimal am Tag haette nur
 * dieselben Vorschlaege ein zweites Mal erzeugt.
 */
function anweisungAbend(person: Person, lage: string, liegt: string): string {
  const wer = person === 'malin' ? 'Malin' : 'Kevin';
  return [
    `Du bist JARVIS und schliesst ${wer}s Tag ab. Er hoert gleich auf zu arbeiten.`,
    '',
    'AUFTRAG: Sieh dir die Lage an und schlage HOECHSTENS DREI Dinge vor, die den morgigen Start leichter machen.',
    'Woran du dich haeltst:',
    '- Was heute faellig war und offen blieb, gehoert auf morgen datiert — aber nur, wenn es wirklich draengt.',
    '- Was morgen frueh einen Termin hat, braucht heute Abend vielleicht eine Vorbereitung.',
    '- Ein Fokusblock fuer den Vormittag, wenn morgen frueh noch nichts geschuetzt ist.',
    '',
    'STRENG: Keine Wiederholung dessen, was schon als Aufgabe offen ist oder schon im Stapel liegt.',
    'Keine Tagesrueckblicke, keine Motivation.',
    liegt,
    'Findest du nichts, schlage NICHTS vor — ein leerer Abendstapel ist ein gutes Ergebnis.',
    '',
    'Schreibe ZUERST hoechstens zwei Saetze: was heute stehen geblieben ist und was morgen zuerst drankommt.',
    'Dann erst die Werkzeuge. Kein Gruss, keine Aufzaehlung, keine Ueberschriften.',
    '',
    `Heute ist ${localDay()}.`,
    '',
    'LAGE:',
    lage,
  ].join('\n');
}

export async function POST(req: Request) {
  if (!hasAnthropicKey()) return NextResponse.json({ ok: false, error: 'Kein Anthropic-Schlüssel.' }, { status: 200 });
  const person = personAus(req);
  const origin = innenAdresse(req);
  let body: { zeit?: Tageszeit } = {};
  try { body = await req.json(); } catch { /* ohne Rumpf gilt Morgen */ }
  const zeit: Tageszeit = body.zeit === 'abend' ? 'abend' : 'morgen';

  let lage = '';
  try {
    lage = promptBrain(await gatherBrain(undefined, person));
    // Haushalt (24.09.): Kevin hat Beträge im Briefing ausdrücklich erlaubt — nur mit benannter Person.
    const hz = await haushaltVon(req).catch(() => null);
    if (hz) lage += `\n\n${blockHaushalt(await ladeHaushalt(hz.haushalt))}`;
  } catch {
    return NextResponse.json({ ok: false, error: 'Lage nicht lesbar.' }, { status: 200 });
  }

  // Was schon im Stapel liegt, geht mit in den Prompt. Ohne das hat der
  // Abendlauf am 07.09. zwei Vorschläge des Morgenlaufs wortgleich wiederholt
  // — der Dublettenschlüssel greift dagegen nicht, weil zwei Modell-Läufe
  // dieselbe Sache anders formulieren („2.661€ heute begleichen" gegen
  // „2.661 € begleichen"). Gegen Wiederholung hilft nur Wissen, nicht Prüfen.
  const offeneVorschlaege = await liesStapel('offen').catch(() => []);
  const liegt = offeneVorschlaege.length
    ? `LIEGT SCHON IN SEINEM STAPEL (nicht noch einmal vorschlagen, auch nicht anders formuliert):\n`
      + offeneVorschlaege.map(v => `- ${v.nachher}`).join('\n')
    : '';

  const r = await askText({
    system: anweisung(person, lage, zeit, liegt),
    user: zeit === 'abend' ? 'Schliess den Tag ab.' : 'Bereite den Tag vor.',
    maxTokens: 1500,
    tools: WERKZEUGE,
    timeoutMs: 150_000,
    zweck: zeit === 'abend' ? 'abendlauf' : 'morgenlauf',
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error?.slice(0, 200) ?? 'Modell nicht erreichbar.' }, { status: 200 });

  interface Block { type: string; name?: string; input?: Record<string, unknown> }
  const bloecke: Block[] = Array.isArray((r.raw as { content?: Block[] })?.content) ? (r.raw as { content: Block[] }).content : [];
  const gewuenscht = bloecke.filter(b => b.type === 'tool_use' && (ERLAUBT as readonly string[]).includes(b.name ?? '')).slice(0, zeit === 'abend' ? 3 : 5);

  // Alles wird gestapelt, nichts ausgeführt — auch die sonst freien Werkzeuge.
  const ergebnisse = await Promise.all(gewuenscht.map(b =>
    fuehreAus(b.name!, b.input ?? {}, origin, {
      vorschlagen: true, person, quelle: 'lauf',
      anlass: String(b.input?.why ?? (zeit === 'abend' ? 'Abendlauf' : 'Morgenlauf')),
    }).catch(() => null),
  ));

  const gestapelt = ergebnisse.filter(x => x?.gestapelt).length;
  // Bleibt der Bericht leer, weil das Modell seine Ausgabe ganz in die
  // Werkzeuge gesteckt hat, sagen wir wenigstens ehrlich, was da liegt —
  // ein Stapel ohne ein Wort dazu ist morgens wertlos.
  const bericht = (r.text ?? '').trim()
    || (gestapelt
      ? `${gestapelt} Vorschläge vorbereitet — die Begründung steht an jedem einzelnen.`
      : zeit === 'abend'
        ? 'Nichts blieb liegen, das morgen drängt.'
        : 'Nichts Belastbares gefunden. Der Tag ist frei von meiner Seite.');
  return NextResponse.json({
    ok: true,
    zeit,
    bericht: bericht.slice(0, 700),
    gestapelt,
    offen: await offeneAnzahl().catch(() => 0),
  });
}
