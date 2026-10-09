// ─── MAKE OS — Der Morgenlauf: ZOE bereitet vor ──────────────────────────
// Baustein 2+4 zusammengeführt (07.09.). Bis hierher entstand ein Vorschlag
// nur, wenn eine Person etwas angestoßen hat. ZOE konnte handeln — aber nie von
// selbst anfangen.
//
// Die Antwort auf die Frage, woran man merkt, dass es sich lohnt:
// „Morgens liegt der Stapel fertig da." Genau das macht dieser Lauf. Er sieht
// sich die Lage an und legt konkrete Vorschläge in den Stapel — nichts wird
// ausgeführt, alles wartet auf einen Klick.
//
// Wichtig: ALLES wird gestapelt, auch was tagsüber frei durchliefe. Der
// Unterschied ist nicht das Werkzeug, sondern dass niemand danach gefragt hat.
// Was ZOE nachts allein erarbeitet, soll ein Mensch einmal gesehen haben.

import { jsonBegrenzt } from '@/lib/zugang/json-grenze';
import { imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { askText, hasAnthropicKey, guthabenLeer, kiGesperrt, kiSperrText } from '@/lib/anthropic';
import { regelBericht } from '@/lib/zoe/regelwerk';
import { gatherBrain, promptBrain, brainKategorien } from '@/lib/brain';
import { haushaltVon, laufPerson } from '@/lib/finanzen/haushalt/zugriff';
import { ladeHaushalt } from '@/lib/finanzen/haushalt/speicher';
import { blockHaushalt } from '@/lib/finanzen/haushalt/zoe';
import { fuehreAus } from '@/lib/zoe/ausfuehren';
import { offeneAnzahlFuer, lies as liesStapel } from '@/lib/zoe/stapel';
import { vornameVon } from '@/lib/zoe/grundauftrag';
import { localDay } from '@/lib/zeit';
import { innenAdresse } from '@/lib/innen';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { kiSchalterFuer, type KiKategorie } from '@/lib/datenschutz/ki-einstellungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Nur diese Werkzeuge darf der Morgenlauf vorschlagen.
 *
 * Bewusst eng: er soll den Tag vorbereiten, nicht die Buchhaltung umschreiben.
 * Alles, was Geld bewegt, bleibt draußen — dafür fehlt ihm nachts jede
 * Grundlage, und ein Vorschlag ohne Grundlage ist nur Arbeit für die Person.
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
    description: 'Schlägt einen Block im Tagesplan vor — Fokuszeit, Routine, Vorbereitung. Nur in freie Zeit; feste Termine stehen im Live-Zustand. Fenster 06:00–22:00, Raster 15 Minuten.',
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

type Tageszeit = import('@/lib/zoe/regelwerk').Tageszeit;

// 08.10. spät: `wer` = Vorname aus dem Konto der Person, für die der Lauf läuft (vorher: wer nicht die zweite Person war, hieß wie die erste).
function anweisung(wer: string, lage: string, zeit: Tageszeit, liegt: string): string {
  if (zeit === 'abend') return anweisungAbend(wer, lage, liegt);
  return [
    `Du bist ZOE und bereitest den Tag von ${wer} vor, bevor der Rechner aufgeklappt wird.`,
    '',
    'AUFTRAG: Sieh dir die Lage an und schlage HÖCHSTENS FÜNF Dinge vor, die heute wirklich zählen.',
    'Jeder Vorschlag muss aus einer konkreten Stelle der Lage folgen — eine überfällige Zahlung, ein Termin,',
    // S1 #9: kein fester Gesundheitskontext mehr — Gesundheits-Routinen stehen, wenn gepflegt, in der Lage.
    'ein Meilenstein ohne nächsten Schritt, eine ungeschützte Fokuszeit, eine gepflegte Gesundheits-Routine ohne Platz.',
    '',
    'STRENG: Lieber ZWEI gute Vorschläge als fünf mittelmäßige. Nichts vorschlagen, was schon als Aufgabe',
    'offen ist oder schon im Stapel liegt. Keine Allgemeinplätze („Prioritäten prüfen", „Mails checken") —',
    'das ist Arbeit, keine Hilfe.',
    liegt,
    'Findest du nichts Belastbares, schlage NICHTS vor und sag es in einem Satz.',
    '',
    `REIHENFOLGE: Schreibe ZUERST den Lagebericht, DANN rufe die Werkzeuge auf. Ohne Bericht steht ${wer}`,
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
 * Der Abendlauf. Die Vorgabe war „gebuendelt, morgens und abends" — der
 * Morgen bereitet vor, der Abend raeumt nach.
 *
 * Bewusst ein ANDERER Auftrag, nicht derselbe zweimal: abends ist die Frage
 * nicht „was ist heute wichtig", sondern „was ist heute liegengeblieben und
 * was muss morgen frueh stehen". Derselbe Prompt zweimal am Tag haette nur
 * dieselben Vorschlaege ein zweites Mal erzeugt.
 */
function anweisungAbend(wer: string, lage: string, liegt: string): string {
  return [
    `Du bist ZOE und schliesst den Tag von ${wer} ab. Gleich ist Feierabend.`,
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
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  // Regel 5 (08.10. abends): die benannte Person; der Takt ruft ohne Person (lib/zoe/agenten.ts) — dann rechnet der Lauf als
  // Inhaber der Instanz (Rolle aus den Konten, `laufPerson`), nie als fester Name. Gesundheitswerte gehen auch dann nur mit
  // dessen Einwilligung (b) an das Modell (gatherBrain → `gesundheitFrei`). Offen: Morgen-/Abendlauf je Person (CLAUDE.md, Regel 5).
  const person = await laufPerson(req);
  const origin = innenAdresse(req);
  let body: { zeit?: Tageszeit } = {};
  try { body = await jsonBegrenzt(req); } catch { /* ohne Rumpf gilt Morgen */ }
  const zeit: Tageszeit = body.zeit === 'abend' ? 'abend' : 'morgen';

  let lage = '';
  let regel = '';
  const kiS = await kiSchalterFuer(person);
  let kategorien: KiKategorie[] = ['allgemein'];
  try {
    const brain = await gatherBrain(undefined, person);
    regel = regelBericht(brain, zeit);
    // Regelwerk statt Fehlschlag, wenn die KI nicht kann (27.09.).
    if (!hasAnthropicKey() || guthabenLeer()) {
      return NextResponse.json({ ok: true, zeit, ohneKi: true, grund: !hasAnthropicKey() ? 'kein Schlüssel' : 'Guthaben leer', bericht: regelBericht(brain, zeit), gestapelt: 0, offen: await offeneAnzahlFuer(person).catch(() => 0) });
    }
    // KI-Schalter (05.10.): nur erlaubte Bereiche, Gesundheit nur mit Einwilligung (b).
    lage = promptBrain(brain, { bereiche: kiS.bereiche });
    kategorien = brainKategorien(brain, { bereiche: kiS.bereiche });
    // Haushalt (24.09.): Beträge im Briefing sind ausdrücklich erlaubt — nur mit benannter Person.
    // Privat-Finanzen (09.10., Anbieter-Tor): nur mit erlaubtem Zugang (mit Tor: nur EU) — sonst ohne den Haushalt.
    const hz = kiS.bereiche.finanzen && (await (await import('@/lib/ki/tor')).kategorienMoeglich(['finanzen-privat'])) ? await haushaltVon(req).catch(() => null) : null;
    if (hz) { lage += `\n\n${blockHaushalt(await ladeHaushalt(hz.haushalt))}`; kategorien = [...kategorien, 'finanzen', 'finanzen-privat']; }
  } catch {
    return NextResponse.json({ ok: false, error: 'Lage nicht lesbar.' }, { status: 200 });
  }

  // Was schon im Stapel liegt, geht mit in den Prompt. Ohne das hat der
  // Abendlauf am 07.09. zwei Vorschläge des Morgenlaufs wortgleich wiederholt
  // — der Dublettenschlüssel greift dagegen nicht, weil zwei Modell-Läufe
  // dieselbe Sache anders formulieren („1.234€ heute begleichen" gegen
  // „1.234 € begleichen"). Gegen Wiederholung hilft nur Wissen, nicht Prüfen.
  // Sicht-Prüfung 08.10.: nur die eigenen und die des Systems (ohne Person) — die offenen Vorschläge der anderen Person
  // (gemerkte Fakten, Blöcke, Notiz-Titel) gehören nicht in diesen Prompt (Regel wie `vorschlagSichtbar`).
  const offeneVorschlaege = (await liesStapel('offen').catch(() => [])).filter(v => !v.person || v.person === person);
  const liegt = offeneVorschlaege.length
    ? `LIEGT SCHON IN SEINEM STAPEL (nicht noch einmal vorschlagen, auch nicht anders formuliert):\n`
      + offeneVorschlaege.map(v => `- ${v.nachher}`).join('\n')
    : '';

  const r = await askText({
    system: anweisung(await vornameVon(person), lage, zeit, liegt),
    user: zeit === 'abend' ? 'Schliess den Tag ab.' : 'Bereite den Tag vor.',
    maxTokens: 1500,
    tools: WERKZEUGE,
    timeoutMs: 150_000,
    zweck: zeit === 'abend' ? 'abendlauf' : 'morgenlauf',
    ki: kiAus(req, [...kategorien, 'aufgaben'], { person }),
  });
  // Gesperrt (Hintergrund-KI aus, Bereich aus): Regelwerk statt Fehlschlag — wie ohne Schlüssel (05.10.).
  if (kiGesperrt(r)) return NextResponse.json({ ok: true, zeit, ohneKi: true, grund: kiSperrText(r), bericht: regel, gestapelt: 0, offen: await offeneAnzahlFuer(person).catch(() => 0) });
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
    offen: await offeneAnzahlFuer(person).catch(() => 0),
  });
}
