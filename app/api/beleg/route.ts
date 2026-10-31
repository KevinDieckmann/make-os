// ─── MAKE OS — Beleg lesen ──────────────────────────────────────────────────
// Ansage: „Dateien an ZOE geben — Rechnung fotografieren, Zahlen
// landen im System."
//
// Diese Route LIEST nur. Sie schreibt bewusst nichts: aus einem Foto gezogene
// Zahlen sind ein Vorschlag, kein Beleg. Ein Mensch bestätigt, dann wird gebucht —
// sonst schleichen sich Erkennungsfehler unbemerkt in die Buchhaltung.
// Prompt ohne Persönliches (09.10., Nahtstellen — Plattform-Regel/„Datenschutz vor dem Upload“): keine Namen, keine festen Firmen;
// die eigenen Gesellschaften kommen zur Laufzeit aus lib/einheiten.ts und dem Gesellschafts-Register (`gesellschaftenSatz`).
//
// Kann Fotos (JPEG/PNG/WebP) und PDFs — seit 31.10. auch E-Rechnungen: ZUGFeRD/Factur-X (XML in der PDF) und reine XML (CII/UBL/XRechnung)
// werden ohne Modell aus der Datei gelesen (lib/finanzen/erechnung).

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { privatFinanzZugang, keinFinanzZugang } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { loadJson } from '@/lib/store/local-db';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { modellSchranke } from '@/lib/zugang/umfang';
import { gesellschaftenSatz } from '@/lib/zoe/grundauftrag';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { belegAusERechnung, type BelegAusXml } from '@/lib/finanzen/erechnung/beleg';
import { XML_MAX_BYTES } from '@/lib/finanzen/erechnung/xml';
import { alleGesellschaften, gesellschaftenName, mitVorgaben, type GesellschaftenDatei } from '@/lib/crm/gesellschaften';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BILD = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_MB = 8;

const XML_TYPEN = ['application/xml', 'text/xml'];

/** E-Rechnung in der Datei? PDF: eingebettete XML; XML: direkt. Eigene Gesellschaften für die Richtung aus dem Register des Haushalts. */
async function eRechnungAusDatei(bytes: Buffer, istXml: boolean, haushalt: string): Promise<{ beleg?: BelegAusXml; fehler?: string }> {
  const { eRechnungLesen, XmlFehler } = await import('@/lib/finanzen/erechnung/lesen');
  let xml: string | null = null;
  let eingebettet = false;
  if (istXml) {
    if (bytes.length > XML_MAX_BYTES) return { fehler: 'Die XML ist zu groß für eine Rechnung.' };
    xml = new TextDecoder('utf-8').decode(bytes);
  } else {
    const { eingebetteteXml } = await import('@/lib/finanzen/erechnung/pdf');
    const ein = await eingebetteteXml(new Uint8Array(bytes));
    if (ein) { xml = ein.xml; eingebettet = true; }
  }
  if (!xml) return {};
  try {
    const e = eRechnungLesen(xml);
    if (!e) return { fehler: 'Diese XML ist keine E-Rechnung (weder CII noch UBL).' };
    const roh = await loadJson<GesellschaftenDatei>(gesellschaftenName(haushalt)).catch(() => null);
    const g = alleGesellschaften(roh);
    const eigen = {
      namen: g.map(x => mitVorgaben(x).name).filter(Boolean), ustIds: g.map(x => x.ustId).filter((x): x is string => !!x),
      steuernummern: g.map(x => x.steuernummer).filter((x): x is string => !!x),
    };
    return { beleg: belegAusERechnung(e, eigen, { eingebettet }) };
  } catch (err) {
    if (err instanceof XmlFehler) return { fehler: `Die E-Rechnung ist nicht lesbar: ${err.message}` };
    throw err;
  }
}

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

/** Der feste Teil des Auftrags — ohne Namen und ohne feste Firmen; die eigenen Gesellschaften setzt `systemText` zur Laufzeit ein. */
const systemText = (gesellschaften: string) => [
  'Du liest einen Beleg (Rechnung, Quittung, Kontoauszug-Ausschnitt) für das Betriebssystem dieses Haushalts und gibst die Zahlen strukturiert zurück.',
  'WICHTIG: Nichts erfinden. Was du nicht sicher lesen kannst, lässt du weg und schreibst das Feld in "unsicher". Ein fehlendes Feld ist besser als eine geratene Zahl in einer Buchhaltung.',
  'RICHTUNG: "eingang" = eine eigene Gesellschaft bzw. der Haushalt muss zahlen (Lieferantenrechnung, Quittung, Einkauf). "ausgang" = eine eigene Gesellschaft hat die Rechnung gestellt, jemand schuldet ihr Geld. Im Zweifel "unklar".',
  gesellschaften,
  'Steht eine eigene Gesellschaft als Absender/Rechnungssteller → "ausgang". Steht sie als Empfänger → "eingang".',
  'BETRÄGE als Zahl ohne Währungszeichen, Punkt als Dezimaltrennung (1234.56). Deutsche Schreibweise 1.234,56 also korrekt umrechnen.',
  'DATUM immer als YYYY-MM-DD.',
  'KATEGORIE: ein kurzes deutsches Wort, das zur Buchhaltung passt (z. B. Software, Büro, Reise, Beratung, Miete, Versicherung, Telefon, Fortbildung, Bewirtung).',
  'Antworte als reines JSON, ohne Erklärung drumherum:',
  '{"richtung":"eingang|ausgang|unklar","partner":"…","datum":"YYYY-MM-DD","betragBrutto":0,"betragNetto":0,"ustSatz":19,"waehrung":"EUR","rechnungsnummer":"…","zweck":"kurz, was geliefert/geleistet wurde","faellig":"YYYY-MM-DD","kategorie":"…","unsicher":["feld1"]}',
].join('\n');

export async function POST(req: Request) {
  const zugang = await privatFinanzZugang(req);
  if (!zugang) return keinFinanzZugang();
  if (zuGross(req, 12000000)) return ZU_GROSS(12000000);

  let body: { datei?: string; medientyp?: string; name?: string };
  try { body = await jsonBegrenzt(req, 12000000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein JSON.' }, { status: 400 }); }

  const datei = String(body.datei ?? '').replace(/^data:[^;]+;base64,/, '');
  const medientyp = String(body.medientyp ?? '');
  if (!datei) return NextResponse.json({ ok: false, error: 'Keine Datei übergeben.' }, { status: 400 });

  const mb = (datei.length * 3) / 4 / 1024 / 1024;
  if (mb > MAX_MB) {
    return NextResponse.json({ ok: false, error: `Die Datei ist ${mb.toFixed(1)} MB groß — bis ${MAX_MB} MB geht es. Beim Fotografieren eine Stufe kleiner wählen.` }, { status: 200 });
  }

  // E-Rechnung (31.10.): eine ZUGFeRD-/Factur-X-PDF (eingebettete XML) oder reine XML (CII/UBL/XRechnung) belegt den Vorschlag aus der Datei
  // vor — kein Modell, keine Texterkennung. Fremde XML: sicher gelesen (keine DTD/Entitäten, Größe begrenzt), nichts ausgeführt, nichts geschrieben.
  const istXml = XML_TYPEN.includes(medientyp) || /\.xml$/i.test(String(body.name ?? ''));
  if (istXml || medientyp === 'application/pdf') {
    const e = await eRechnungAusDatei(Buffer.from(datei, 'base64'), istXml, zugang.haushalt);
    if (e.beleg) return NextResponse.json({ ok: true, beleg: e.beleg });
    if (istXml) return NextResponse.json({ ok: false, error: e.fehler ?? 'Diese XML ist keine lesbare E-Rechnung (CII oder UBL).' }, { status: 200 });
  }

  const schranke = modellSchranke(req); if (schranke) return schranke;
  if (!hasAnthropicKey()) {
    return NextResponse.json({ ok: false, error: 'Kein ANTHROPIC_API_KEY — ohne den kann ZOE den Beleg nicht lesen.' }, { status: 200 });
  }

  const istBild = BILD.includes(medientyp);
  const istPdf = medientyp === 'application/pdf';
  if (!istBild && !istPdf) {
    return NextResponse.json({ ok: false, error: `Dateityp ${medientyp || 'unbekannt'} wird nicht gelesen — Foto (JPG/PNG), PDF oder E-Rechnung (XML).` }, { status: 200 });
  }

  const inhalt = [
    istPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: datei } }
      : { type: 'image', source: { type: 'base64', media_type: medientyp, data: datei } },
    { type: 'text', text: `Lies diesen Beleg${body.name ? ` (Dateiname: ${String(body.name).slice(0, 120)})` : ''} und gib die Zahlen als JSON zurück.` },
  ];

  // Die Kategorien, die der Haushalt wirklich benutzt — sonst erfindet das Modell
  // jedes Mal neue und die Buchhaltung franst aus.
  const bestand = await loadJson<{ buchungen?: { kategorie?: string }[] }>('buchungen');
  const kategorien = Array.from(new Set((bestand?.buchungen ?? []).map(x => x.kategorie).filter(Boolean))).slice(0, 40);

  const r = await askText({
    system: systemText(await gesellschaftenSatz()) + (kategorien.length
      ? `\nKATEGORIE bitte aus dieser Liste wählen, wenn eine passt — nur wenn wirklich keine passt, eine neue vorschlagen:\n${kategorien.join(' · ')}`
      : ''),
    user: 'Beleg lesen.',
    messages: [{ role: 'user', content: inhalt }],
    zweck: 'beleg', ki: kiAus(req, ['finanzen'], { anzahl: 1 }),
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
