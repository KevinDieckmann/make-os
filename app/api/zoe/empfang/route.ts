// ─── MAKE OS — Der Empfang ──────────────────────────────────────────────────
// Zwei Sätze zur Begrüßung: was heute zählt. Dieselbe Grundlage wie der
// Morgenlauf — echte Zahlen, Kalender, Stapel — nur kurz und zum Vorlesen.
//
// ZWISCHENGESPEICHERT je Stunde. Man macht den Bildschirm am Tag mehrfach
// auf; ohne das kostete jedes Öffnen einen Modellaufruf. Bei rund drei Cent je
// Aufruf ist das der Unterschied zwischen „läuft nebenbei mit" und „ich mache
// die Software lieber nicht so oft auf".

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { gatherBrain, promptBrain, brainKategorien } from '@/lib/brain';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { ladeHaushalt } from '@/lib/finanzen/haushalt/speicher';
import { blockHaushalt } from '@/lib/finanzen/haushalt/zoe';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { offeneAnzahlFuer } from '@/lib/zoe/stapel';
import { vornameVon } from '@/lib/zoe/grundauftrag';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { kiSchalterFuer, type KiKategorie } from '@/lib/datenschutz/ki-einstellungen';

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

/** 08.10. spät: Name aus dem Konto der auslösenden Person, EINE Anrede für alle (vorher je Person fest im Code). */
function anweisung(name: string, offen: number): string {
  return [
    `Du bist ZOE. ${name} hat gerade die Software geöffnet und sieht dich als Erstes.`,
    // Ohne diese Zeile grüßte er am 07.09. um halb drei nachmittags mit
    // „Guten Morgen" — er hat keine Uhr, er weiß nur, was im Prompt steht.
    `Es ist ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr, also ${tageszeit(new Date().getHours())}. Grüße passend dazu.`,
    `Sprich ${name} mit dem Vornamen an — ruhig, warm und direkt.`,
    '',
    'AUFTRAG: Begrüße kurz und sag in HÖCHSTENS ZWEI SÄTZEN, was heute zählt.',
    'Nimm die EINE wichtigste Sache aus der Lage — nicht drei. Nenne eine konkrete Zahl, wenn es eine gibt.',
    offen ? `Erwähne beiläufig, dass ${offen} Vorschläge auf Freigabe warten.` : '',
    '',
    'Das wird VORGELESEN: kein Markdown, keine Aufzählung, keine Klammern, keine Abkürzungen.',
    'Zahlen zum Hören schreiben: „null Monate" statt „0.0 Monaten", „zweitausendsechshunderteinundsechzig Euro"',
    'darf ruhig „rund zweitausendsiebenhundert Euro" werden. Lieber gerundet und verständlich als exakt und sperrig.',
    'DUZEN: „auf deine Freigabe", nie „auf Ihre".',
    'Schreib, wie du sprechen würdest. Höchstens 45 Wörter.',
  ].filter(Boolean).join('\n');
}

export async function GET(req: Request) {
  // Regel 5 (08.10. abends): die Person kommt aus dem Tor (Sitzung bzw. Dienstweg MIT Person) — nie der Rückfall von `personAus`.
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  const person = zugang.person;
  const stunde = stundeJetzt();
  const schluessel = `${person}:${stunde}`;

  const gehalten = await loadJson<Stand>('zoe-empfang');
  const da = gehalten?.je?.[schluessel];
  if (da?.text) return NextResponse.json({ text: da.text, gehalten: true });

  if (!hasAnthropicKey()) {
    return NextResponse.json({ text: 'Ich bin da. Mir fehlt nur der Schlüssel zum Denken — trag ihn in die Datei .env.local ein.' });
  }

  // Nur die Vorschläge, die diese Person sieht (Sicherheitsprüfung 09.10.: vorher zählte die Zahl die der anderen Person mit).
  const offen = await offeneAnzahlFuer(person).catch(() => 0);
  const name = await vornameVon(person);
  let lage = '';
  // KI-Schalter (05.10.): nur erlaubte Bereiche, Gesundheit nur mit Einwilligung (b) — `kategorien` = was drinsteht.
  const kiS = await kiSchalterFuer(person);
  let kategorien: KiKategorie[] = ['allgemein'];
  try { const b = await gatherBrain(undefined, person); lage = promptBrain(b, { bereiche: kiS.bereiche }); kategorien = brainKategorien(b, { bereiche: kiS.bereiche }); } catch { /* ohne Lage geht es auch */ }
  // Privat-Finanzen (09.10., Anbieter-Tor): nur mit erlaubtem Zugang (mit Tor: nur EU) — sonst ohne den Haushalt.
  try { const hz = kiS.bereiche.finanzen && (await (await import('@/lib/ki/tor')).kategorienMoeglich(['finanzen-privat'])) ? await haushaltVon(req) : null; if (hz) { lage += `\n\n${blockHaushalt(await ladeHaushalt(hz.haushalt))}`; kategorien = [...kategorien, 'finanzen', 'finanzen-privat']; } } catch { /* ohne Haushalt geht es auch */ }

  const r = await askText({
    zweck: 'empfang', ki: kiAus(req, kategorien, { person }),
    system: anweisung(name, offen),
    user: lage ? `LAGE:\n${lage}` : 'Begrüße kurz, die Lage ist gerade nicht lesbar.',
    maxTokens: 300,
    timeoutMs: 60_000,
  });

  const text = (r.text ?? '').trim()
    || `Schön, dass du da bist, ${name}. Womit fangen wir an?`;

  // Je Person ändern (09.10., Agenten-Datenschicht): vorher ersetzte `saveJson` die ganze Datei mit nur diesem Schlüssel — der Gruß der
  // anderen Person derselben Stunde war weg (und kostete beim nächsten Öffnen einen zweiten Modellaufruf). Jetzt ein Teil-Merge in der
  // Sperre: der eigene Eintrag kommt dazu, behalten werden nur Einträge der laufenden Stunde (die Datei wächst nicht mit jeder Stunde).
  await updateJson<Stand>('zoe-empfang', cur => ({
    je: { ...Object.fromEntries(Object.entries(cur?.je ?? {}).filter(([k, v]) => k !== schluessel && v?.stunde === stunde)), [schluessel]: { stunde, text } },
  }));
  return NextResponse.json({ text, gehalten: false });
}
