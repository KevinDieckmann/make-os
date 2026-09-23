// ─── MAKE OS — Der Empfang ──────────────────────────────────────────────────
// Zwei Sätze zur Begrüßung: was heute zählt. Dieselbe Grundlage wie der
// Morgenlauf — echte Zahlen, Kalender, Stapel — nur kurz und zum Vorlesen.
//
// ZWISCHENGESPEICHERT je Stunde. Kevin macht den Bildschirm am Tag mehrfach
// auf; ohne das kostete jedes Öffnen einen Modellaufruf. Bei rund drei Cent je
// Aufruf ist das der Unterschied zwischen „läuft nebenbei mit" und „ich mache
// die Software lieber nicht so oft auf".

import { NextResponse } from 'next/server';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { gatherBrain, promptBrain } from '@/lib/brain';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { offeneAnzahl } from '@/lib/jarvis/stapel';
import { personAus, type Person } from '@/lib/jarvis/raum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Stand { je: Record<string, { stunde: string; text: string }> }

/** Volle Stunde als Schlüssel — feiner braucht es die Begrüßung nicht. */
const stundeJetzt = () => new Date().toISOString().slice(0, 13);

/** Wie man um diese Uhrzeit grüßt. */
function tageszeit(h: number): string {
  if (h < 5) return 'mitten in der Nacht';
  if (h < 11) return 'am Morgen';
  if (h < 14) return 'am Mittag';
  if (h < 18) return 'am Nachmittag';
  if (h < 22) return 'am Abend';
  return 'spät abends';
}

function anweisung(person: Person, offen: number): string {
  const wer = person === 'malin' ? 'Malin' : 'Kevin';
  const anrede = person === 'malin' ? 'Sprich sie mit Namen an, warm und direkt.' : 'Sprich ihn mit „Sir" an, ruhig und souverän.';
  return [
    `Du bist JARVIS. ${wer} hat gerade die Software geöffnet und sieht dich als Erstes.`,
    // Ohne diese Zeile grüßte er am 07.09. um halb drei nachmittags mit
    // „Guten Morgen" — er hat keine Uhr, er weiß nur, was im Prompt steht.
    `Es ist ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr, also ${tageszeit(new Date().getHours())}. Grüße passend dazu.`,
    anrede,
    '',
    'AUFTRAG: Begrüße kurz und sag in HÖCHSTENS ZWEI SÄTZEN, was heute zählt.',
    'Nimm die EINE wichtigste Sache aus der Lage — nicht drei. Nenne eine konkrete Zahl, wenn es eine gibt.',
    offen ? `Erwähne beiläufig, dass ${offen} Vorschläge auf Freigabe warten.` : '',
    '',
    'Das wird VORGELESEN: kein Markdown, keine Aufzählung, keine Klammern, keine Abkürzungen.',
    'Zahlen zum Hören schreiben: „null Monate" statt „0.0 Monaten", „zweitausendsechshunderteinundsechzig Euro"',
    'darf ruhig „rund zweitausendsiebenhundert Euro" werden. Lieber gerundet und verständlich als exakt und sperrig.',
    `DUZEN: „Sir" ist die Anrede, kein Grund zum Siezen. Also „auf deine Freigabe", nie „auf Ihre".`,
    'Schreib, wie du sprechen würdest. Höchstens 45 Wörter.',
  ].filter(Boolean).join('\n');
}

export async function GET(req: Request) {
  const person = personAus(req);
  const stunde = stundeJetzt();
  const schluessel = `${person}:${stunde}`;

  const gehalten = await loadJson<Stand>('jarvis-empfang');
  const da = gehalten?.je?.[schluessel];
  if (da?.text) return NextResponse.json({ text: da.text, gehalten: true });

  if (!hasAnthropicKey()) {
    return NextResponse.json({ text: 'Ich bin da. Mir fehlt nur der Schlüssel zum Denken — trag ihn in die Datei .env.local ein.' });
  }

  const offen = await offeneAnzahl().catch(() => 0);
  let lage = '';
  try { lage = promptBrain(await gatherBrain(undefined, person)); } catch { /* ohne Lage geht es auch */ }

  const r = await askText({
    zweck: 'empfang',
    system: anweisung(person, offen),
    user: lage ? `LAGE:\n${lage}` : 'Begrüße kurz, die Lage ist gerade nicht lesbar.',
    maxTokens: 300,
    timeoutMs: 60_000,
  });

  const text = (r.text ?? '').trim()
    || (person === 'malin' ? 'Schön, dass du da bist, Malin. Womit fangen wir an?' : 'Ich bin bereit, Sir. Womit fangen wir an?');

  // Nur den aktuellen und den vorherigen Schlüssel behalten — die Datei soll
  // nicht mit jeder Stunde wachsen.
  await saveJson<Stand>('jarvis-empfang', { je: { [schluessel]: { stunde, text } } });
  return NextResponse.json({ text, gehalten: false });
}
