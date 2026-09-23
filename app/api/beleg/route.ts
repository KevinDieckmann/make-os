// ─── MAKE OS — Beleg lesen ──────────────────────────────────────────────────
// Kevins Ansage: „Dateien an Jarvis geben — Rechnung fotografieren, Zahlen
// landen im System."
//
// Diese Route LIEST nur. Sie schreibt bewusst nichts: aus einem Foto gezogene
// Zahlen sind ein Vorschlag, kein Beleg. Kevin bestätigt, dann wird gebucht —
// sonst schleichen sich Erkennungsfehler unbemerkt in die Buchhaltung.
//
// Kann Fotos (JPEG/PNG/WebP) und PDFs.

import { NextResponse } from 'next/server';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { loadJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BILD = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_MB = 8;

export interface BelegDaten {
  richtung: 'eingang' | 'ausgang' | 'unklar';
  partner: string;
  datum?: string;
  betragBrutto?: number;
  betragNetto?: number;
  ustSatz?: number;
  waehrung?: string;
  rechnungsnummer?: string;
  zweck?: string;
  faellig?: string;
  kategorie?: string;
  /** Was das Modell NICHT sicher lesen konnte — ehrlicher als stilles Raten. */
  unsicher?: string[];
}

const SYSTEM = [
  'Du liest einen Beleg (Rechnung, Quittung, Kontoauszug-Ausschnitt) für Kevins privates Betriebssystem und gibst die Zahlen strukturiert zurück.',
  'WICHTIG: Nichts erfinden. Was du nicht sicher lesen kannst, lässt du weg und schreibst das Feld in "unsicher". Ein fehlendes Feld ist besser als eine geratene Zahl in einer Buchhaltung.',
  'RICHTUNG: "eingang" = Kevin/seine Firma muss zahlen (Lieferantenrechnung, Quittung, Einkauf). "ausgang" = Kevin hat die Rechnung gestellt, jemand schuldet ihm Geld. Im Zweifel "unklar".',
  'Kevins Firmen: KD Ventures UG, Kevin Dieckmann Consulting, KEMARIS. Steht eine davon als Absender/Rechnungssteller → "ausgang". Steht eine davon als Empfänger → "eingang".',
  'BETRÄGE als Zahl ohne Währungszeichen, Punkt als Dezimaltrennung (1234.56). Deutsche Schreibweise 1.234,56 also korrekt umrechnen.',
  'DATUM immer als YYYY-MM-DD.',
  'KATEGORIE: ein kurzes deutsches Wort, das zur Buchhaltung passt (z. B. Software, Büro, Reise, Beratung, Miete, Versicherung, Telefon, Fortbildung, Bewirtung).',
  'Antworte als reines JSON, ohne Erklärung drumherum:',
  '{"richtung":"eingang|ausgang|unklar","partner":"…","datum":"YYYY-MM-DD","betragBrutto":0,"betragNetto":0,"ustSatz":19,"waehrung":"EUR","rechnungsnummer":"…","zweck":"kurz, was geliefert/geleistet wurde","faellig":"YYYY-MM-DD","kategorie":"…","unsicher":["feld1"]}',
].join('\n');

export async function POST(req: Request) {
  if (!hasAnthropicKey()) {
    return NextResponse.json({ ok: false, error: 'Kein ANTHROPIC_API_KEY — ohne den kann Jarvis den Beleg nicht lesen.' }, { status: 200 });
  }

  let body: { datei?: string; medientyp?: string; name?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein JSON.' }, { status: 400 }); }

  const datei = String(body.datei ?? '').replace(/^data:[^;]+;base64,/, '');
  const medientyp = String(body.medientyp ?? '');
  if (!datei) return NextResponse.json({ ok: false, error: 'Keine Datei übergeben.' }, { status: 400 });

  const mb = (datei.length * 3) / 4 / 1024 / 1024;
  if (mb > MAX_MB) {
    return NextResponse.json({ ok: false, error: `Die Datei ist ${mb.toFixed(1)} MB groß — bis ${MAX_MB} MB geht es. Beim Fotografieren eine Stufe kleiner wählen.` }, { status: 200 });
  }

  const istBild = BILD.includes(medientyp);
  const istPdf = medientyp === 'application/pdf';
  if (!istBild && !istPdf) {
    return NextResponse.json({ ok: false, error: `Dateityp ${medientyp || 'unbekannt'} wird nicht gelesen — Foto (JPG/PNG) oder PDF.` }, { status: 200 });
  }

  const inhalt = [
    istPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: datei } }
      : { type: 'image', source: { type: 'base64', media_type: medientyp, data: datei } },
    { type: 'text', text: `Lies diesen Beleg${body.name ? ` (Dateiname: ${String(body.name).slice(0, 120)})` : ''} und gib die Zahlen als JSON zurück.` },
  ];

  // Die Kategorien, die Kevin wirklich benutzt — sonst erfindet das Modell
  // jedes Mal neue und die Buchhaltung franst aus.
  const bestand = await loadJson<{ buchungen?: { kategorie?: string }[] }>('buchungen');
  const kategorien = Array.from(new Set((bestand?.buchungen ?? []).map(x => x.kategorie).filter(Boolean))).slice(0, 40);

  const r = await askText({
    system: SYSTEM + (kategorien.length
      ? `\nKATEGORIE bitte aus dieser Liste wählen, wenn eine passt — nur wenn wirklich keine passt, eine neue vorschlagen:\n${kategorien.join(' · ')}`
      : ''),
    user: 'Beleg lesen.',
    messages: [{ role: 'user', content: inhalt }],
    maxTokens: 1500,
    timeoutMs: 120_000,
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: (r.error ?? 'Lesen fehlgeschlagen').slice(0, 220) }, { status: 200 });

  let beleg: BelegDaten;
  try {
    const roh = r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1);
    beleg = JSON.parse(roh) as BelegDaten;
  } catch {
    return NextResponse.json({ ok: false, error: 'Der Beleg war nicht lesbar — schärferes Foto oder gerade von oben aufnehmen.' }, { status: 200 });
  }

  // Nachputzen: nur plausible Werte durchlassen.
  const zahl = (v: unknown) => { const n = Number(v); return isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) / 100 : undefined; };
  const datum = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : undefined);

  const sauber: BelegDaten = {
    richtung: ['eingang', 'ausgang'].includes(String(beleg.richtung)) ? beleg.richtung : 'unklar',
    partner: String(beleg.partner ?? '').slice(0, 140),
    datum: datum(beleg.datum),
    betragBrutto: zahl(beleg.betragBrutto),
    betragNetto: zahl(beleg.betragNetto),
    ustSatz: zahl(beleg.ustSatz),
    waehrung: String(beleg.waehrung ?? 'EUR').slice(0, 6).toUpperCase(),
    rechnungsnummer: beleg.rechnungsnummer ? String(beleg.rechnungsnummer).slice(0, 60) : undefined,
    zweck: beleg.zweck ? String(beleg.zweck).slice(0, 200) : undefined,
    faellig: datum(beleg.faellig),
    kategorie: beleg.kategorie ? String(beleg.kategorie).slice(0, 40) : undefined,
    unsicher: Array.isArray(beleg.unsicher) ? beleg.unsicher.map(x => String(x).slice(0, 40)).slice(0, 8) : undefined,
  };

  // Plausibilität: Brutto sollte ≥ Netto sein. Stimmt das nicht, ist eher die
  // Erkennung schief als der Beleg — dann lieber melden als still rechnen.
  if (sauber.betragBrutto != null && sauber.betragNetto != null && sauber.betragNetto > sauber.betragBrutto) {
    sauber.unsicher = [...(sauber.unsicher ?? []), 'betragNetto größer als Brutto — bitte prüfen'];
  }

  return NextResponse.json({ ok: true, beleg: sauber });
}
