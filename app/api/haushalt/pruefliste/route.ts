// ─── Prüfliste: Privates aus den Business-Speichern aufräumen ───────────────
// GET  → die Liste mit Vorschlägen (gegen die Haushaltsdaten abgeglichen)
// POST { entscheidungen: [{ quelle, id, aktion }] } → archiviert die Business-
//      Speicher nach .data/archiv, dann verschieben/entfernen/zuordnen.
// Eigene Route mit Absicht: der Schrumpf-Schutz der Firmen-Speicher würde das
// Aufräumen (9 → 1 Zahlungen) sonst zu Recht ablehnen.

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { haushaltVon, KEIN_ZUGANG } from '@/lib/finanzen/haushalt/zugriff';
import { ladeHaushalt, aendereBuchungen, aendereSchulden, speicherName } from '@/lib/finanzen/haushalt/speicher';
import { pruefliste, type Aktion, type Businessbestand, type Quelle } from '@/lib/finanzen/haushalt/entflechtung';
import type { Beleg, Buchung, Schuld } from '@/lib/finanzen/haushalt/typen';
import { fingerabdruck } from '@/lib/finanzen/haushalt/import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function bestand(): Promise<Businessbestand> {
  const [finanzplan, buchungen, liquiplan] = await Promise.all([loadJson<Businessbestand['finanzplan']>('finanzplan'), loadJson<Businessbestand['buchungen']>('buchungen'), loadJson<Businessbestand['liquiplan']>('liquiplan')]);
  return { finanzplan, buchungen, liquiplan };
}

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const h = await ladeHaushalt(z.haushalt);
  return NextResponse.json({ ok: true, posten: pruefliste(await bestand(), h), haushaltLeer: !h.buchungen.length });
}

export async function POST(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  let b: { entscheidungen?: { quelle: Quelle; id: string; aktion: Aktion }[] };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  const h = await ladeHaushalt(z.haushalt);
  const vorher = await bestand();
  const liste = pruefliste(vorher, h);
  const erlaubt = new Map(liste.map(p => [`${p.quelle}|${p.id}`, p]));
  const ent = (b.entscheidungen ?? []).filter(e => erlaubt.get(`${e.quelle}|${e.id}`)?.aktionen.includes(e.aktion) && e.aktion !== 'behalten');
  if (!ent.length) return NextResponse.json({ ok: true, angewandt: 0 });

  const zeit = new Date().toISOString();
  const ordner = path.join(process.cwd(), '.data', 'archiv');
  await fs.mkdir(ordner, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(ordner, `business-vor-entflechtung-${zeit.replace(/[:.]/g, '-')}.json`), JSON.stringify({ _zeit: zeit, _von: z.person, entscheidungen: ent, ...vorher }, null, 1), { mode: 0o600 });

  const weg = (q: Quelle) => new Set(ent.filter(e => e.quelle === q && e.aktion !== 'kdv' && e.aktion !== 'kdc' && e.aktion !== 'kemaris').map(e => e.id));
  const neuFirma = new Map(ent.filter(e => ['kdv', 'kdc', 'kemaris'].includes(e.aktion)).map(e => [e.id, e.aktion]));
  const uebernehmen = (q: Quelle) => new Set(ent.filter(e => e.quelle === q && e.aktion === 'uebernehmen').map(e => e.id));

  // In den Haushalt: offene Zahlungen → Rechnungen, Kredite → Schulden, Buchungen → Buchungen.
  const zahlungen = (vorher.finanzplan?.zahlungen ?? []).filter(x => uebernehmen('zahlung').has(x.id));
  if (zahlungen.length) await updateJson<{ belege: Beleg[] }>(speicherName('belege', z.haushalt), cur => ({ belege: [...(cur?.belege ?? []), ...zahlungen.map(x => ({ id: randomUUID(), stand: 1, art: 'rechnung' as const, bezeichnung: x.titel || x.an, empfaenger: x.an, betrag: Math.round(x.betrag * 100), faellig_am: x.faellig ?? null, verursacher: null, einheit: 'privat' as const, erledigt: x.status !== 'offen', bezahlt_am: null, notiz: 'Aus dem Firmen-Finanzplan übernommen (24.09.)', buchung_id: null }))] }));
  const kredite = (vorher.finanzplan?.merkposten ?? []).filter(x => uebernehmen('merkposten').has(x.id));
  if (kredite.length) await aendereSchulden(z.haushalt, l => [...l, ...kredite.map(m => { const rate = (m.notiz ?? '').match(/Rate\s+([\d.,]+)/i); return { id: randomUUID(), stand: 1, bezeichnung: m.titel, glaeubiger: null, einheit: 'privat', startbetrag: Math.abs(Math.round(m.betrag * 100)), restbetrag: Math.abs(Math.round(m.betrag * 100)), rate: rate ? Math.round(Number(rate[1].replace(/\./g, '').replace(',', '.')) * 100) : null, zinssatz: null, rhythmus: 'monatlich', naechste_faelligkeit: null, endet_am: null, notiz: `Aus dem Firmen-Finanzplan übernommen (24.09.)${m.notiz ? ` — ${m.notiz}` : ''}`, aus_buchung_id: null } as Schuld; })]);
  const alteBuchungen = (vorher.buchungen?.buchungen ?? []).filter(x => uebernehmen('buchung').has(x.id));
  if (alteBuchungen.length) {
    const konto = (wer?: string) => h.stamm.konten.find(k => (k.inhaber ?? '').toLowerCase() === (wer ?? '').toLowerCase())?.id ?? h.stamm.konten.find(k => k.inhaber === 'gemeinsam')?.id ?? h.stamm.konten[0]?.id;
    await aendereBuchungen(z.haushalt, l => [...l, ...alteBuchungen.map(x => { const k = konto(x.wer)!; const c = Math.round(x.betrag * 100); const text = x.zweck || x.kategorie || 'Buchung'; return { id: randomUUID(), stand: 1, konto_id: k, datum: x.datum, betrag: c, beschreibung: text, empfaenger: text, kategorie_id: null, ist_umbuchung: false, ist_fixkosten: false, turnus: 'monatlich', einheit: 'privat', zeilen_hash: `${fingerabdruck(k, x.datum, c, text)}#alt`, notiz: 'Aus den Firmen-Buchungen übernommen (24.09.) — Betrag war gerundet', import_id: 'entflechtung', erfasst_von: z.person, geaendert: zeit } as Buchung; })]);
  }

  // Aus den Business-Speichern: entfernen bzw. Firma zuordnen.
  await updateJson<Record<string, unknown>>('finanzplan', cur => {
    const f = (cur ?? {}) as NonNullable<Businessbestand['finanzplan']> & Record<string, unknown>;
    return { ...f, firmen: (f.firmen ?? []).filter(x => !weg('firma').has(x.id)), zahlungen: (f.zahlungen ?? []).filter(x => !weg('zahlung').has(x.id)), merkposten: (f.merkposten ?? []).filter(x => !weg('merkposten').has(x.id)), rechnungen: (f.rechnungen ?? []).filter(x => !weg('rechnung').has(x.id)) };
  });
  await updateJson<Record<string, unknown>>('buchungen', cur => ({ ...(cur ?? {}), buchungen: ((cur?.buchungen ?? []) as { id: string }[]).filter(x => !weg('buchung').has(x.id)) }));
  await updateJson<Record<string, unknown>>('liquiplan', cur => ({ ...(cur ?? {}), posten: ((cur?.posten ?? []) as { id: string; firmaId?: string }[]).filter(x => !weg('planposten').has(x.id)).map(x => (neuFirma.has(x.id) ? { ...x, firmaId: neuFirma.get(x.id) } : x)) }));
  return NextResponse.json({ ok: true, angewandt: ent.length });
}
