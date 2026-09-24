// ─── Haushaltsfinanzen: Massenänderungen ────────────────────────────────────
// POST { aktion, vorschau?, … } — was viele Zeilen ändert, läuft hier in
// einem Schritt und auf Wunsch erst als Vorschau.
//
//   regel        Zuordnung merken, auf Wunsch rückwirkend
//   import       Kontoauszug (Zeilen aus dem PDF, Text oder CSV)
//   kredit       Kredit-Einnahme als Schuld anlegen (wiederholbar)
//   fixkosten    Empfänger als Fixkosten markieren / Markierung weg
//   turnus       Turnus eines Empfängers setzen
//   steuerquote  Annahme für den Mindestumsatz
//   testdaten    NUR im Haushalt „test“: erfundene Daten einspielen

import { NextResponse } from 'next/server';
import { haushaltVon, KEIN_ZUGANG } from '@/lib/finanzen/haushalt/zugriff';
import { regelLernen, importieren, kreditZuSchuld, fixkostenMarkieren, turnusSetzen } from '@/lib/finanzen/haushalt/aktionen';
import { aendereMeta, setzeHaushalt, Ungueltig } from '@/lib/finanzen/haushalt/speicher';
import { turnusAus } from '@/lib/finanzen/haushalt/regeln';
import { testHaushalt } from '@/lib/finanzen/haushalt/testdaten';
import { vorschlag as katVorschlag, ungenutzt as katUngenutzt, anwenden as katAnwenden } from '@/lib/finanzen/haushalt/kategorien';
import { ladeHaushalt, aendereStamm, aendereBuchungen } from '@/lib/finanzen/haushalt/speicher';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  const vorschau = b.vorschau === true;
  try {
    switch (b.aktion) {
      case 'regel':
        return NextResponse.json({ ok: true, ...(await regelLernen(z.haushalt, {
          muster: String(b.muster ?? ''), kategorie_id: b.kategorie_id ? String(b.kategorie_id) : null,
          ist_umbuchung: b.ist_umbuchung === true, ganzes_wort: b.ganzes_wort !== false, ist_fixkosten: b.ist_fixkosten === true,
          turnus: turnusAus(b.turnus), rueckwirkend: b.rueckwirkend === true, buchungId: b.buchungId ? String(b.buchungId) : null,
        }, vorschau)) });
      case 'import': {
        const e = await importieren(z.haushalt, z.person, {
          konto_id: String(b.konto_id ?? ''), zeilen: Array.isArray(b.zeilen) ? (b.zeilen as unknown[]).map(String) : undefined,
          text: typeof b.text === 'string' ? b.text : undefined, dateiName: typeof b.dateiName === 'string' ? b.dateiName.slice(0, 120) : undefined,
        }, vorschau);
        return NextResponse.json(e, { status: e.ok ? 200 : 400 });
      }
      case 'kredit':
        return NextResponse.json({ ok: true, ...(await kreditZuSchuld(z.haushalt, {
          buchung_id: String(b.buchung_id ?? ''), bezeichnung: b.bezeichnung ? String(b.bezeichnung) : undefined, glaeubiger: b.glaeubiger ? String(b.glaeubiger) : undefined,
          rate: typeof b.rate === 'number' ? b.rate : null, zinssatz: typeof b.zinssatz === 'number' ? b.zinssatz : null,
        })) });
      case 'fixkosten':
        return NextResponse.json({ ok: true, ...(await fixkostenMarkieren(z.haushalt, String(b.name ?? ''), b.an === true, turnusAus(b.turnus))) });
      case 'turnus':
        return NextResponse.json({ ok: true, ...(await turnusSetzen(z.haushalt, String(b.name ?? ''), turnusAus(b.turnus))) });
      case 'steuerquote': {
        const q = typeof b.steuerquote === 'number' && b.steuerquote >= 0 && b.steuerquote < 90 ? b.steuerquote : null;
        const meta = await aendereMeta(z.haushalt, m => ({ ...m, steuerquote: q }));
        return NextResponse.json({ ok: true, steuerquote: meta.steuerquote });
      }
      case 'kategorien': {
        const h = await ladeHaushalt(z.haushalt);
        if (vorschau) return NextResponse.json({ ok: true, vorschlaege: katVorschlag(h.stamm, h.buchungen), ungenutzt: katUngenutzt(h.stamm, h.buchungen).map(k => ({ id: k.id, name: k.name })), anzahl: h.stamm.kategorien.length });
        const paare = Array.isArray(b.paare) ? (b.paare as { von: unknown; nach: unknown }[]).map(p => ({ von: String(p.von), nach: String(p.nach) })) : [];
        const loeschen = new Set(Array.isArray(b.loeschen) ? (b.loeschen as unknown[]).map(String) : []);
        // Vorher archivieren — Kategorien hängen an jeder Buchung.
        const ordner = path.join(process.cwd(), '.data', 'archiv');
        await fs.mkdir(ordner, { recursive: true, mode: 0o700 });
        await fs.writeFile(path.join(ordner, `kategorien-vor-aufraeumen-${z.haushalt}-${Date.now()}.json`), JSON.stringify({ stamm: h.stamm, zuordnung: h.buchungen.map(x => [x.id, x.kategorie_id]) }), { mode: 0o600 });
        const jetzt = new Date().toISOString();
        let geaendert = 0;
        await aendereBuchungen(z.haushalt, l => { const e = katAnwenden(h.stamm, l, paare, jetzt); geaendert = e.geaendert; return e.buchungen; });
        const frei = new Set(katUngenutzt(h.stamm, h.buchungen).map(k => k.id));
        await aendereStamm(z.haushalt, s => { const e = katAnwenden(s, [], paare, jetzt).stamm; return { ...e, kategorien: e.kategorien.filter(k => !(loeschen.has(k.id) && frei.has(k.id))) }; });
        return NextResponse.json({ ok: true, zusammengelegt: paare.length, geaendert, geloescht: Array.from(loeschen).filter(id => frei.has(id)).length });
      }
      case 'testdaten':
        if (z.haushalt !== 'test') return NextResponse.json({ ok: false, fehler: 'Testdaten gibt es nur im Test-Haushalt.' }, { status: 403 });
        await setzeHaushalt('test', testHaushalt(), { steuerquote: 30 });
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
    }
  } catch (err) {
    const fehler = err instanceof Ungueltig ? err.message : 'Das hat nicht geklappt.';
    if (!(err instanceof Ungueltig)) console.error('[haushalt/aktion]', err);
    return NextResponse.json({ ok: false, fehler }, { status: 400 });
  }
}
