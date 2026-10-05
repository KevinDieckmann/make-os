// ─── Konto › Meine Daten — Auskunft (Art. 15), Herunterladen (Art. 20), Konto löschen (Art. 17) (05.10., Betroffenenrechte v2) ──
// GET                 → JSON-Datei „Meine Daten“: alle Bestände mit Bezug zur Person (lib/datenschutz/konto-daten.ts, über das
//                       Speicher-Register) + die Angaben nach Art. 15 Abs. 1 a–h (`art15`). Maschinenlesbar (Art. 20).
// GET ?format=html    → dieselbe Auskunft druckbar (Browser › Drucken › als PDF), ohne Skripte.
// POST { aktion: 'loeschen', passwort, code?, bestaetigung: 'LÖSCHEN' } → das eigene Konto löschen: Passwort + (wenn an) zweiter
//                       Faktor (lib/zugang/erneut.ts), Inhaber nur ohne andere Konten (409), Grabstein, alle Bestände laut Register,
//                       Protokolle mit „[gelöscht]“. Antwort meldet ab (Cookie weg).
// NUR die Person der Sitzung (x-make-user) — der Dienstweg (ZOE, Takt) bekommt hier nie etwas (403), und niemand fragt für andere.
// Jeder Export steht im Lese-Protokoll (Bereich „export“, betroffen = die Person) und im Anmeldeprotokoll.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { istDienst } from '@/lib/zugang/dienst';
import { personDerSitzung } from '@/lib/zugang/tor';
import { ladeKonten } from '@/lib/zugang/konten';
import { erneutPruefen } from '@/lib/zugang/erneut';
import { notiere, adresseGekuerzt, FRIST_MONATE } from '@/lib/zugang/anmeldungen';
import { adresse } from '@/lib/zugang/drossel';
import { ohneSitzung } from '@/lib/zugang/antwort';
import { protokolliereLesen, LESE_AUFBEWAHRUNG_MONATE } from '@/lib/store/leseprotokoll';
import { kontoExport, kontoLoeschen, loeschenErlaubt } from '@/lib/datenschutz/konto-daten';
import { auskunftAngaben } from '@/lib/datenschutz/auskunft-server';
import { auskunftHtml, HTML_KOPF } from '@/lib/datenschutz/art15';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (fehler: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, ...extra }, { status });

/** Nur die Person der Sitzung — nie der Dienstweg, nie eine Person aus einem Kopf, den ein Aufrufer setzen könnte. */
function sitzungsPerson(req: Request): string | null {
  if (istDienst(req)) return null;
  return personDerSitzung(req);
}

/** Herkunft (Art. 15 Abs. 1 lit. g) und Fristen der Konto-Bestände — Text aus Sicht der Person. */
const KONTO_HERKUNFT = [
  'Von Ihnen selbst: Angaben beim Einrichten des Kontos und alles, was Sie in MAKE OS erfassen.',
  'Aus Diensten, die Sie selbst verbinden (z. B. Google-Kalender/-Postfach, WHOOP) — nur solange die Verbindung besteht.',
  'Von Personen Ihres Haushalts bzw. Teams: z. B. Aufgaben, die Ihnen zugewiesen werden, und Ihre Rolle im Team.',
  'Von der Software selbst: Anmeldungen, Lese- und Änderungsprotokolle, KI-Aufrufe (nur Metadaten).',
];
const KONTO_FRISTEN = [
  { bereich: 'Konto und Ihre eigenen Bestände', frist: 'bis Sie sie löschen bzw. Ihr Konto löschen (Konto › Meine Daten)' },
  { bereich: 'Anmeldeprotokoll', frist: `${FRIST_MONATE} Monate` },
  { bereich: 'Lese-Protokoll', frist: `${LESE_AUFBEWAHRUNG_MONATE} Monate` },
  { bereich: 'KI-Protokoll', frist: '12 Monate' },
  { bereich: 'Änderungsprotokoll', frist: '36 Monate (Monatsdateien, nur Kennungen und Feldnamen)' },
  { bereich: 'Nachweis Ihrer Einwilligungen (Gesundheit)', frist: 'solange das Konto besteht; danach ohne Ihre Kennung als Nachweis' },
];

export async function GET(req: Request) {
  const person = sitzungsPerson(req);
  if (!person) return nein('Nur für die angemeldete Person selbst.', 403);
  const daten = await kontoExport(person);
  if (!daten) return nein('Konto nicht gefunden.', 401);
  const art15 = await auskunftAngaben('konto', { herkunft: KONTO_HERKUNFT, fristen: KONTO_FRISTEN });
  // Nachweis: wer hat wann seine Daten geholt (nie Inhalte) — Lese-Protokoll und Anmeldeprotokoll.
  await protokolliereLesen(req, 'export', { betroffen: person, anzahl: Object.keys(daten.bestaende).length });
  await notiere({ speicher: person, art: 'daten-export', ok: true, adresse: adresseGekuerzt(adresse(req)) });
  if (new URL(req.url).searchParams.get('format') === 'html') {
    return new Response(auskunftHtml({ titel: 'Meine Daten — Auskunft nach Art. 15 DSGVO', erstellt: daten.erstellt, angaben: art15, daten, hinweis: 'maschinenlesbar zusätzlich als JSON-Datei („Meine Daten herunterladen“)' }), { headers: HTML_KOPF });
  }
  return new Response(JSON.stringify({ ...daten, art15 }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `attachment; filename="Meine-Daten-${localDay()}.json"` },
  });
}

export async function POST(req: Request) {
  const person = sitzungsPerson(req);
  if (!person) return nein('Nur für die angemeldete Person selbst.', 403);
  let b: { aktion?: unknown; passwort?: unknown; code?: unknown; bestaetigung?: unknown };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? nein('Kein gültiges JSON.', 400); }
  if (b?.aktion !== 'loeschen') return nein('aktion = loeschen', 400);
  if (String(b.bestaetigung ?? '').trim().toUpperCase() !== 'LÖSCHEN') return nein('Zur Bestätigung „LÖSCHEN“ eintippen.', 400);
  const { konten } = await ladeKonten();
  const ich = konten.find(k => k.speicher === person);
  if (!ich) return nein('Konto nicht gefunden.', 401);
  const darf = loeschenErlaubt(ich, konten);
  if (!darf.ok) return nein(darf.fehler, 409);
  const p = await erneutPruefen(req, ich, { passwort: b.passwort, code: b.code }, 'konto-loeschen');
  if (!p.ok) {
    const res = nein(p.fehler, p.status, p.zweiterFaktor ? { zweiterFaktor: true } : {});
    if (p.warteSek) res.headers.set('Retry-After', String(p.warteSek));
    return res;
  }
  // Erst notieren, dann löschen: der Eintrag bleibt als Nachweis — die Kennung wird beim Löschen selbst zu „[gelöscht]“.
  await notiere({ speicher: person, art: 'konto-loeschen', ok: true, adresse: adresseGekuerzt(adresse(req)) });
  const bericht = await kontoLoeschen(person);
  if (!bericht) return nein('Konto nicht gefunden.', 404);
  const res = ohneSitzung();
  const raus = NextResponse.json({ ok: true, bericht: { bestaende: bericht.bestaende.length, eintraege: bericht.eintraege, protokolle: bericht.protokolle, aufgabenZugewiesen: bericht.aufgabenZugewiesen, google: bericht.google } }, { headers: { 'Cache-Control': 'no-store' } });
  for (const c of res.cookies.getAll()) raus.cookies.set(c);
  return raus;
}
