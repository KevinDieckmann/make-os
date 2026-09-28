// ─── MAKE OS — Finanzplan (lokal) ───────────────────────────────────────────
// Der lebende Finanz-Organismus: beide Firmen (KD Ventures + Kevin Dieckmann
// Consulting) mit Konten (Vivid, Stand von Hand — Anbindung steht im Bauplan),
// die Rechnungs-Pipeline (geplant → gestellt → bezahlt) und Merkposten wie der
// Björn-Kredit. Das Controlling (/os/controlling) bleibt die Ist-Buchhaltung
// je Monat — hier lebt die Planung/Verwaltung davor.

import { NextResponse } from 'next/server';
import { loadJson, updateJson, updateJsonAsync, updateGeschuetztListen } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import {
  SEED, sauberFile, ueberGrenze, istGrenzFehler, bezahltAnwenden,
  type FinanzplanFile, type BezahltErgebnis, type RechnungsBuchung,
} from '@/lib/finanzen/finanzplan-bestand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Business-Zahlen gehören zum Haushalt des Inhabers — wie der Business-Index (26.09.).
const KEIN_HAUSHALT = { ok: false, error: 'Kein Zugang zu den Business-Zahlen — sie gehören zum Haushalt des Inhabers (System → Konto).' };

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  let f = await loadJson<FinanzplanFile>('finanzplan');
  if (!f || !Array.isArray(f.firmen) || !f.firmen.length) {
    f = await updateJson<FinanzplanFile>('finanzplan', () => SEED);
  } else if (!Array.isArray(f.produkte) || !f.produkte.length || !Array.isArray(f.uhrwerk?.agenda) || !f.uhrwerk.agenda.length) {
    // Bestand aus der Zeit vor Produkten/Uhrwerk → neue Abschnitte nachziehen.
    f = await updateJson<FinanzplanFile>('finanzplan', current => ({
      ...SEED,
      ...(current ?? {}),
      produkte: Array.isArray(current?.produkte) && current.produkte.length ? current.produkte : SEED.produkte,
      uhrwerk: current?.uhrwerk?.agenda?.length ? current.uhrwerk : SEED.uhrwerk,
      zahlungen: Array.isArray(current?.zahlungen) ? current.zahlungen : [],
    }));
  }
  return NextResponse.json(sauberFile(f));
}

/** Kompletten Stand setzen (die Seite verwaltet die Listen). */
export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  let body: Partial<FinanzplanFile>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const sauber = sauberFile(body);
  if (!sauber.firmen.length) return NextResponse.json({ ok: false, error: 'firmen darf nicht leer sein.' }, { status: 400 });
  // Zu viele Einträge: ablehnen, nie kürzen (28.09.).
  const grenze = ueberGrenze(sauber);
  if (grenze) return NextResponse.json({ ok: false, error: grenze }, { status: 413 });
  // Kontostand-Änderung stempelt automatisch das Stand-Datum.
  const vorher = await loadJson<FinanzplanFile>('finanzplan');
  for (const fa of sauber.firmen) {
    const alt = vorher?.firmen?.find(x => x.id === fa.id);
    if (fa.kontostand !== null && fa.kontostand !== (alt?.kontostand ?? null)) fa.stand = localDay();
  }
  // Hier hängt Geld dran: Rechnungen, offene Zahlungen, Merkposten. Ein Client
  // mit halb geladenem Stand darf das nicht überschreiben — jede Liste wird
  // einzeln geprüft, eine schrumpfende reicht zur Ablehnung.
  const { ok, next, verloren } = await updateGeschuetztListen<FinanzplanFile>(
    'finanzplan', sauber, ['firmen', 'rechnungen', 'zahlungen', 'merkposten', 'produkte'],
  );
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: `Abgelehnt: das hätte über die Hälfte von ${verloren} gelöscht.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, ...next });
}

/**
 * Einzelne Einträge ändern statt der ganzen Datei.
 *
 * Zwei-Fenster-Fundament: Malin pflegt Rechnungen, Kevin lässt nebenher einen
 * Beleg von ZOE buchen — vorher schrieb jeder Weg den KOMPLETTEN Finanzplan
 * zurück und überschrieb still die Arbeit des anderen. Jetzt geht nur der eine
 * geänderte Eintrag raus, und zwar in der benannten Liste.
 *
 * Format: { ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: {…} }, … ] }
 */
const PATCHBAR = ['firmen', 'rechnungen', 'zahlungen', 'merkposten', 'produkte'] as const;
type PatchListe = typeof PATCHBAR[number];

export async function PATCH(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  let body: { ops?: unknown; felder?: Record<string, unknown>; aktion?: unknown; rechnungId?: unknown; am?: unknown; stand?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (body.aktion === 'bezahlt') return bezahlt(body);
  if (body.aktion !== undefined) return NextResponse.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 });
  // Zu viele Änderungen auf einmal: ablehnen statt still nur die ersten 100 zu nehmen (28.09.).
  if (Array.isArray(body.ops) && body.ops.length > MAX_OPS) {
    return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_OPS} Änderungen je Aufruf (geschickt: ${body.ops.length}).` }, { status: 413 });
  }
  const roh = Array.isArray(body.ops) ? body.ops : (body.felder ? [] : null);
  if (!roh) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });
  // Zu zweit (24.09.): Einzelfelder außerhalb der Listen — derzeit nur das Uhrwerk.
  const uhrwerk = body.felder && typeof body.felder.uhrwerk === 'object' && body.felder.uhrwerk ? body.felder.uhrwerk : null;

  interface Op { liste: PatchListe; op: 'upsert' | 'delete'; eintrag?: Record<string, unknown>; id?: string }
  const ops: Op[] = [];
  for (const o of roh as Record<string, unknown>[]) {
    const l = String(o?.liste ?? '') as PatchListe;
    if (!(PATCHBAR as readonly string[]).includes(l)) continue;
    if (o.op === 'delete' && typeof o.id === 'string') ops.push({ liste: l, op: 'delete', id: o.id });
    else if (o.op === 'upsert' && o.eintrag && typeof o.eintrag === 'object') {
      ops.push({ liste: l, op: 'upsert', eintrag: o.eintrag as Record<string, unknown> });
    }
  }
  if (!ops.length && !uhrwerk) return NextResponse.json({ ok: false, error: 'Keine gültigen Änderungen.' }, { status: 400 });

  let angewandt = 0;
  let grenze: string | null = null;
  const next = await updateJson<FinanzplanFile>('finanzplan', current => {
    // Immer vom gesäuberten Bestand ausgehen — nie vom Rohzustand. Die Säuberung kürzt nichts (28.09.).
    const f = sauberFile(current);
    for (const o of ops) {
      const liste = f[o.liste] as { id: string }[];
      const nachId = new Map(liste.map(x => [x.id, x]));
      if (o.op === 'delete') { if (nachId.delete(o.id!)) angewandt++; }
      else {
        // Einzelnen Eintrag über sauberFile schleusen: dieselben Regeln wie
        // beim Vollschreiben, kein zweiter Satz Prüfungen.
        const geprueft = (sauberFile({ [o.liste]: [o.eintrag] } as Partial<FinanzplanFile>)[o.liste] as { id: string }[])[0];
        if (geprueft) { nachId.set(geprueft.id, geprueft); angewandt++; }
      }
      (f[o.liste] as unknown) = Array.from(nachId.values());
    }
    if (uhrwerk) { f.uhrwerk = sauberFile({ uhrwerk } as unknown as Partial<FinanzplanFile>).uhrwerk; angewandt++; }
    // Kontostand-Änderung stempelt das Stand-Datum, wie beim Vollschreiben.
    const alt = sauberFile(current);
    for (const fa of f.firmen) {
      const vorher = alt.firmen.find(x => x.id === fa.id);
      if (fa.kontostand !== null && fa.kontostand !== (vorher?.kontostand ?? null)) fa.stand = localDay();
    }
    // Über der Grenze: ablehnen, den Bestand unverändert lassen (in der Sperre geprüft).
    grenze = ueberGrenze(f, alt);
    if (grenze) { angewandt = 0; return current ?? alt; }
    return f;
  });

  if (grenze) return NextResponse.json({ ok: false, error: grenze }, { status: istGrenzFehler(grenze) ? 413 : 400 });
  return NextResponse.json({ ok: true, angewandt, ...next, stand: next });
}

/** Höchstzahl Einzeländerungen je PATCH — darüber 413 statt still abschneiden. */
const MAX_OPS = 1000;

/** Nichts schreiben: bricht updateJsonAsync ab, ohne dass der Bestand angefasst wird. */
class KeinSchreiben extends Error {}

/**
 * `PATCH { aktion: 'bezahlt', rechnungId, am?, stand? }` (28.09.): Status + `bezahltAm`
 * setzen UND die Buchung `bu-re-<id>` anlegen — in EINER Sperre über dem Finanzplan,
 * die Buchung zuerst (idempotent: gibt es sie schon, bleibt sie, wie sie ist). Schlägt
 * die Buchung fehl, bleibt die Rechnung unverändert; ein Wiederholen heilt alles.
 */
async function bezahlt(body: { rechnungId?: unknown; am?: unknown; stand?: unknown }) {
  const id = typeof body.rechnungId === 'string' ? body.rechnungId.slice(0, 40) : '';
  if (!id) return NextResponse.json({ ok: false, error: 'rechnungId fehlt.' }, { status: 400 });
  const am = typeof body.am === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.am) ? body.am : localDay();
  const stand = typeof body.stand === 'string' && body.stand ? body.stand : undefined;
  let erg: BezahltErgebnis | null = null;
  let gebucht: 'neu' | 'vorhanden' | null = null;
  try {
    await updateJsonAsync<FinanzplanFile>('finanzplan', async current => {
      if (!current) { erg = { ok: false, status: 404, fehler: 'Noch kein Finanzplan angelegt.' }; throw new KeinSchreiben(); }
      const e = bezahltAnwenden(sauberFile(current), id, am, stand);
      erg = e;
      if (!e.ok) throw new KeinSchreiben();
      if (e.buchung) gebucht = await buchungAnlegen(e.buchung);
      return e.schonBezahlt ? current : e.datei;
    });
  } catch (err) {
    if (!(err instanceof KeinSchreiben)) {
      console.error('[finanzplan] bezahlt fehlgeschlagen', err);
      return NextResponse.json({ ok: false, error: 'Nicht gespeichert — Rechnung und Buchung sind unverändert. Bitte noch einmal.' }, { status: 500 });
    }
  }
  const e = erg as BezahltErgebnis | null;
  if (!e) return NextResponse.json({ ok: false, error: 'Nicht gespeichert.' }, { status: 500 });
  if (!e.ok) return NextResponse.json({ ok: false, error: e.fehler, ...(e.aktuell ? { aktuell: e.aktuell } : {}) }, { status: e.status });
  const stand2 = sauberFile(await loadJson<FinanzplanFile>('finanzplan'));
  return NextResponse.json({ ok: true, rechnung: e.rechnung, schonBezahlt: e.schonBezahlt, buchung: e.buchung ? { id: e.buchung.id, gebucht } : null, ...stand2, stand: stand2 });
}

/** Die Buchung zur Rechnung anlegen, wenn es sie noch nicht gibt (Kennung `bu-re-<id>`). */
async function buchungAnlegen(b: RechnungsBuchung): Promise<'neu' | 'vorhanden'> {
  let ergebnis: 'neu' | 'vorhanden' = 'vorhanden';
  await updateJson<{ buchungen: RechnungsBuchung[] }>('buchungen', cur => {
    const liste = Array.isArray(cur?.buchungen) ? cur!.buchungen : [];
    if (liste.some(x => x.id === b.id)) return cur ?? { buchungen: liste };
    ergebnis = 'neu';
    return { ...(cur ?? {}), buchungen: [...liste, b].sort((x, y) => y.datum.localeCompare(x.datum)) };
  });
  return ergebnis;
}
