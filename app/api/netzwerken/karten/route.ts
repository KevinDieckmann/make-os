// ─── Netzwerken · Meine Visitenkarten (02.10., Paket B) ─────────────────────────
// GET   → { ok, karten (mit `stand`), gesellschaften (Firma-Vorschläge), konto { name, email } }
// PATCH { ops: [{ op: 'upsert', eintrag, stand? } | { op: 'teil', id, felder, stand? } | { op: 'delete', id, stand? }] }
//       → { ok, karten } · 409 mit `konflikte` und dem aktuellen Stand, wenn inzwischen jemand geändert hat
//         (zweites Gerät!) · 400 mit einem Satz je ungültigem Feld · 413 bei zu vielen Änderungen/Profilen (nie gekürzt).
// Je Person ein Bestand (`visitenkarten--<person>`): die Person kommt aus der Sitzung, nie aus dem Body — fremde Profile
// sind nicht erreichbar. AUSNAHME (Kevin 02.10.): `?fuer=<person>` — die Inhaberin/der Inhaber des Haushalts darf Profile für eine
// andere Person DES HAUSHALTS anlegen und bearbeiten („für Malin anlegen“); alle anderen bekommen 403, auch wer nur im Haushalt ist.
// Das Protokoll (listePatchen) nennt Kennung + Feldnamen und `wer` = die schreibende Person, nie Werte. Zugang nur mit Haushalt
// (wie Familie); schreibend zusätzlich `bauPruefen`. Logos: SVG wird gesäubert (lib/netzwerken/svg.ts), alles Weitere in
// `pruefeKarte`. Firmen-Vorschläge: Name, Anschrift, Web — nie Bank/Steuer.

import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { haushaltVon, haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { loadJson } from '@/lib/store/local-db';
import { listePatchen, opsLesen, opsFehler } from '@/lib/store/patch-liste';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { ladeKonten } from '@/lib/zugang/konten';
import { alleGesellschaften, gesellschaftenName, mitVorgaben, type GesellschaftenDatei } from '@/lib/crm/gesellschaften';
import { MAX_KARTEN, pruefeKarte, KARTEN_TEXTFELDER, type Visitenkarte } from '@/lib/netzwerken/karte';
import { fuerBrowser, ladeKarten, visitenkartenName, type KartenDatei } from '@/lib/netzwerken/karte-speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN = { ok: false, fehler: 'Visitenkarten gibt es nur für Konten mit Haushalt. Der Inhaber schaltet das unter System → Konto frei.' };
/** Höchstens so viele Änderungen je Anruf — darüber 413, nie still gekürzt. */
const OPS_MAX = 40;

/** Firmen-Vorschläge aus den Gesellschaften des Haushalts: nur Name und öffentliche Kontaktangaben. */
async function gesellschaften(haushalt: string) {
  const d = await loadJson<GesellschaftenDatei>(gesellschaftenName(haushalt)).catch(() => null);
  return alleGesellschaften(d).map(mitVorgaben).map(g => ({
    id: g.id, firma: g.name, strasse: g.strasse ?? '', plz: g.plz ?? '', ort: g.ort ?? '', land: g.land ?? '', web: g.web ?? '', telefon: g.telefon ?? '', email: g.email ?? '',
  }));
}

/**
 * Wessen Profile? Standard: die der anfragenden Person. Mit `?fuer=<person>` die einer anderen Person des Haushalts — nur für
 * den Inhaber (Rolle am Konto) und nur, wenn die andere Person im SELBEN Haushalt ist. Sonst die fertige 403-Antwort.
 */
async function zielPerson(req: Request, z: { person: string; haushalt: string }): Promise<{ person: string; fuerAndere: boolean } | NextResponse> {
  const fuer = new URL(req.url).searchParams.get('fuer');
  if (!fuer || fuer === z.person) return { person: z.person, fuerAndere: false };
  if (!/^[a-z0-9-]{1,40}$/.test(fuer)) return NextResponse.json({ ok: false, fehler: 'Ungültige Person.' }, { status: 400 });
  if (!(await istInhaber(z.person))) return NextResponse.json({ ok: false, fehler: 'Profile für andere anlegen darf nur die Inhaberin oder der Inhaber des Haushalts.' }, { status: 403 });
  const ziel = await haushaltFuer(fuer);
  if (!ziel || ziel.haushalt !== z.haushalt) return NextResponse.json({ ok: false, fehler: 'Diese Person gehört nicht zu eurem Haushalt.' }, { status: 403 });
  return { person: fuer, fuerAndere: true };
}

async function antwort(ziel: { person: string; fuerAndere: boolean }, z: { person: string; haushalt: string }, karten: Visitenkarte[]) {
  const konten = (await ladeKonten()).konten;
  const ich = konten.find(k => k.speicher === ziel.person);
  // Die Inhaberin/der Inhaber sieht, für wen sich Profile anlegen lassen (nur Haushalt, nur Namen).
  const personen = (await istInhaber(z.person)) ? konten.filter(k => k.haushalt === z.haushalt).map(k => ({ person: k.speicher, name: k.name, ich: k.speicher === z.person })) : [];
  return { ok: true, person: ziel.person, fuerAndere: ziel.fuerAndere, personen, karten: fuerBrowser(karten), gesellschaften: await gesellschaften(z.haushalt), konto: ich ? { name: ich.name, email: ich.email } : null };
}

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  const ziel = await zielPerson(req, z);
  if (ziel instanceof NextResponse) return ziel;
  return NextResponse.json(await antwort(ziel, z, await ladeKarten(ziel.person)), { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  const alterBau = bauPruefen(req); if (alterBau) return alterBau;
  const ziel = await zielPerson(req, z);
  if (ziel instanceof NextResponse) return ziel;
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  const jetzt = new Date().toISOString();

  // Jede Karte wird geprüft, BEVOR etwas geschrieben wird — ein Fehler benennt das Feld, nichts wird halb gespeichert.
  let pruefFehler: string | null = null;
  const saeubern = (roh: unknown): Visitenkarte | null => {
    const r = pruefeKarte(roh, jetzt);
    if (r.ok) return r.karte;
    pruefFehler ??= r.fehler;
    return null;
  };
  const ops = opsLesen<Visitenkarte>(body.ops, saeubern, OPS_MAX);
  if (!ops) return NextResponse.json({ ok: false, fehler: opsFehler(body.ops, OPS_MAX) ?? 'ops muss eine Liste sein.' }, { status: Array.isArray(body.ops) ? 413 : 400 });
  if (pruefFehler) return NextResponse.json({ ok: false, fehler: pruefFehler }, { status: 400 });
  if (!ops.length) return NextResponse.json({ ok: false, fehler: 'Keine gültigen Änderungen.' }, { status: 400 });

  const r = await listePatchen<Visitenkarte, KartenDatei & Record<string, unknown>>(visitenkartenName(ziel.person), 'karten', ops, 10, undefined, {
    wer: werAus(req),
    // Teiländerung: Felder auf das gespeicherte Profil legen und neu prüfen — die Kennung bleibt.
    teil: (alt, felder) => {
      const roh: Record<string, unknown> = { ...alt, ...felder, id: alt.id };
      // Ein geleertes Feld (leerer Text/null) fällt weg.
      for (const f of [...KARTEN_TEXTFELDER, 'farbe', 'hintergrund', 'textfarbe', 'schrift', 'logo'] as const) if (roh[f] === '' || roh[f] === null) delete roh[f];
      return saeubern(roh);
    },
    pruefen: (liste, o) => {
      const ids = new Set(liste.map(k => k.id));
      for (const x of o) if (x.op === 'upsert' && x.eintrag) ids.add(x.eintrag.id);
      for (const x of o) if (x.op === 'delete' && x.id) ids.delete(x.id);
      return ids.size > MAX_KARTEN ? `Höchstens ${MAX_KARTEN} Profile — bitte erst eines löschen.` : null;
    },
  });
  if (!r.ok) {
    const karten = await ladeKarten(ziel.person);
    // Ein ungültiges Feld in einer Teiländerung (erst innerhalb der Sperre geprüft) ist ein 400 mit Satz, kein Konflikt.
    if (pruefFehler) return NextResponse.json({ ok: false, fehler: pruefFehler }, { status: 400 });
    const status = r.konflikte?.length ? 409 : r.fehler?.startsWith('Höchstens') ? 413 : 400;
    return NextResponse.json({ ...(await antwort(ziel, z, karten)), ok: false, fehler: r.fehler, ...(r.konflikte ? { konflikte: r.konflikte } : {}) }, { status });
  }
  return NextResponse.json({ ...(await antwort(ziel, z, r.next?.karten ?? [])), angewandt: r.angewandt });
}
