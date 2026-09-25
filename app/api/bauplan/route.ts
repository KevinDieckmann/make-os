// ─── Bauplan (25.09.) — das Board für die Verbesserung von MAKE OS ──────────
// GET                              → { items, etappen, warteschlange }
// POST { aktion, … }               → eine Handlung (Person aus der Sitzung):
//   anlegen { titel, art, bereich, prio, problem, wunsch, warum, fertigWenn, seite, bilder, ziel }
//   teil { id, felder }             Felder ändern (lib/bauplan/board.ts felderSaeubern)
//   verschieben { id, spalte, index }   ziehen im Board (Spalte neu nummeriert)
//   daumen { id }                   hochstufen an/aus (je Person)
//   kommentar { id, text }
//   abgeben { id, ergebnis, testen } Claude: gebaut → „Zum Testen“
//   abnahme { id, ok, text? }       ok → „Fertig“; sonst mit Kommentar zurück nach „Bereit“
//   etappe { id?, name, ziel?, beschreibung? } · etappe_weg { id }
// Versendet wird nichts; Bilder über /api/bauplan/bild.

import { NextResponse } from 'next/server';
import { personAus } from '@/lib/jarvis/raum';
import { ladeBauplan, aendereBauplan, karteAnlegen } from '@/lib/bauplan/speicher';
import { verschieben, felderSaeubern, statusAus, warteschlange, SPALTEN, type Spalte, type Etappe } from '@/lib/bauplan/board';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const d = await ladeBauplan();
  return NextResponse.json({ ok: true, items: d.items, etappen: d.etappen ?? [], warteschlange: warteschlange(d.items).map(i => i.id) });
}

const txt = (v: unknown, n: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const person = personAus(req);
  const jetzt = new Date().toISOString();
  const id = txt(b.id, 80);

  if (b.aktion === 'anlegen') {
    const k = await karteAnlegen(b, person);
    return k ? NextResponse.json({ ok: true, karte: k }) : NextResponse.json({ ok: false, fehler: 'Titel fehlt.' }, { status: 400 });
  }

  if (b.aktion === 'etappe') {
    const name = txt(b.name, 80);
    if (!name) return NextResponse.json({ ok: false, fehler: 'Name fehlt.' }, { status: 400 });
    const e: Etappe = { id: /^e-[a-z0-9-]{2,40}$/.test(id) ? id : `e-${Date.now().toString(36)}`, name, ...(/^\d{4}-\d{2}-\d{2}$/.test(String(b.ziel ?? '')) ? { ziel: String(b.ziel) } : {}), ...(txt(b.beschreibung, 400) ? { beschreibung: txt(b.beschreibung, 400) } : {}) };
    const d = await aendereBauplan(x => ({ ...x, etappen: [...(x.etappen ?? []).filter(y => y.id !== e.id), e] }));
    return NextResponse.json({ ok: true, etappen: d.etappen });
  }
  if (b.aktion === 'etappe_weg') {
    const d = await aendereBauplan(x => ({ ...x, etappen: (x.etappen ?? []).filter(y => y.id !== id), items: x.items.map(i => (i.etappe === id ? { ...i, etappe: undefined } : i)) }));
    return NextResponse.json({ ok: true, etappen: d.etappen });
  }

  let fehler: string | null = null;
  const d = await aendereBauplan(x => {
    const i = x.items.findIndex(k => k.id === id);
    if (i < 0) { fehler = 'Karte nicht gefunden.'; return x; }
    const k = x.items[i];
    const setze = (neu: typeof k) => ({ ...x, items: x.items.map((y, j) => (j === i ? { ...neu, geaendert: jetzt } : y)) });
    switch (b.aktion) {
      case 'teil': return setze({ ...k, ...felderSaeubern((b.felder ?? {}) as Record<string, unknown>) });
      case 'verschieben': {
        const ziel = SPALTEN.some(s => s.id === b.spalte) ? (b.spalte as Spalte) : null;
        if (!ziel) { fehler = 'Unbekannte Spalte.'; return x; }
        return { ...x, items: verschieben(x.items, id, ziel, Math.max(0, Number(b.index) || 0), jetzt) };
      }
      case 'daumen': {
        const d0 = k.daumen ?? [];
        return setze({ ...k, daumen: d0.includes(person) ? d0.filter(p => p !== person) : [...d0, person] });
      }
      case 'kommentar': {
        const text = txt(b.text, 1500);
        if (!text) { fehler = 'Kommentar ist leer.'; return x; }
        return setze({ ...k, kommentare: [...(k.kommentare ?? []), { von: person, am: jetzt, text }].slice(-60) });
      }
      case 'abgeben': {
        // Claude gibt ab: was gebaut wurde und wie ihr es testet — die Karte wandert nach „Zum Testen“ (oben).
        const zwischen = { ...x, items: x.items.map((y, j) => (j === i ? { ...y, ergebnis: txt(b.ergebnis, 2000) || y.ergebnis, testen: txt(b.testen, 1500) || y.testen } : y)) };
        return { ...zwischen, items: verschieben(zwischen.items, id, 'test', 0, jetzt) };
      }
      case 'abnahme': {
        const text = txt(b.text, 1500);
        if (b.ok === true) {
          const z = verschieben(x.items, id, 'fertig', 0, jetzt);
          return { ...x, items: z.map(y => (y.id === id ? { ...y, abgenommen: { von: person, am: jetzt }, ...(text ? { kommentare: [...(y.kommentare ?? []), { von: person, am: jetzt, text }] } : {}) } : y)) };
        }
        if (!text) { fehler = 'Bitte kurz schreiben, was noch nicht passt.'; return x; }
        const z = verschieben(x.items, id, 'bereit', 0, jetzt);
        return { ...x, items: z.map(y => (y.id === id ? { ...y, abgenommen: undefined, kommentare: [...(y.kommentare ?? []), { von: person, am: jetzt, text: `Passt noch nicht: ${text}` }] } : y)) };
      }
      default: fehler = 'Unbekannte Aktion.'; return x;
    }
  });
  if (fehler) return NextResponse.json({ ok: false, fehler }, { status: 400 });
  const karte = d.items.find(k => k.id === id);
  // Status immer passend zur Spalte (Roadmap, Selbstbild und Loop lesen ihn).
  return NextResponse.json({ ok: true, karte: karte ? { ...karte, status: karte.spalte ? statusAus(karte.spalte) : karte.status } : null });
}
