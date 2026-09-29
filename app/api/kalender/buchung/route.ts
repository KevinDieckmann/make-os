// ─── Kalender — Buchungsseiten verwalten (Haushalt, 29.09., Paket K4) ────────
// GET  → { ok, seiten (+ Pfad), buchungen (ohne Token-Hash), vorschlaege }
// POST { aktion: 'seite', seite: {…, id?} }            anlegen/ändern (neue bekommen eine nicht erratbare Adresse)
//      { aktion: 'seite-loeschen', id }                 nur ohne Buchungen (sonst erst deaktivieren — Löschfrist räumt)
//      { aktion: 'freigeben', id }                      fester Termin + CRM (lib/kalender/buchung-ablauf.ts)
//      { aktion: 'ablehnen', id, grund? }               Buchender sieht den Status (und den Grund) auf seiner Seite
// Nur der Haushalt des Inhabers (wie der Kalender). Versendet wird nichts.

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { bauPruefen } from '@/lib/bau/pruefen';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { ladeCrm } from '@/lib/crm/speicher';
import { neueKennung } from '@/lib/kennung';
import { seiteSauber, GRENZEN, OFFEN, type Buchung, type BuchungsSeite } from '@/lib/kalender/buchung';
import { ladeBuchungBestand, aendereBuchungBestand, buchungProtokoll, neuerSlug } from '@/lib/kalender/buchung-speicher';
import { buchungFreigeben, folgeVorschlag, FreigabeFehler } from '@/lib/kalender/buchung-ablauf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z]{1,4}-[a-z0-9-]{8,80}$/;
const nein = (fehler: string, status = 400) => NextResponse.json({ ok: false, fehler }, { status });
/** Was die Oberfläche von einer Buchung sieht — nie der Token-Hash. */
const sicht = ({ tokenHash: _t, ...b }: Buchung) => b;

export async function GET(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const bestand = await ladeBuchungBestand();
  // Folge-Vorschläge (nur Vorschlag): für bestätigte Buchungen mit Kontakt.
  const mitKontakt = bestand.buchungen.filter(b => b.status === 'bestaetigt' && b.kontaktId);
  const vorschlaege: Record<string, ReturnType<typeof folgeVorschlag>> = {};
  if (mitKontakt.length) {
    // Art. 18: eingeschränkte Personen fehlen hier — für sie gibt es keinen Vorschlag.
    const [kartei, crm] = await Promise.all([kontakteFuerVerarbeitung(), ladeCrm()]);
    const kontakte = new Map(kartei.map(k => [k.id, k]));
    for (const b of mitKontakt) {
      const k = kontakte.get(b.kontaktId!);
      const firma = k?.firmaId ? crm.firmen.find(f => f.id === k.firmaId) : undefined;
      const v = folgeVorschlag(k, firma?.lead, crm.chancen);
      if (v) vorschlaege[b.id] = v;
    }
  }
  return NextResponse.json({
    ok: true,
    seiten: bestand.seiten.map(s => ({ ...s, pfad: `/buchen/${s.slug}` })),
    buchungen: [...bestand.buchungen].sort((a, b) => a.start.localeCompare(b.start)).map(sicht),
    vorschlaege,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const zugang = await kalenderZugang(req);
  if (!zugang) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const alt = bauPruefen(req); if (alt) return alt;
  const person = zugang.person;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return nein('Kein JSON.'); }
  const jetzt = new Date();
  const jetztIso = jetzt.toISOString();

  if (b.aktion === 'seite') {
    const roh = (b.seite && typeof b.seite === 'object' ? b.seite : {}) as Record<string, unknown>;
    const id = typeof roh.id === 'string' && ID.test(roh.id) ? roh.id : null;
    let fehler = '', status = 400, gespeichert: BuchungsSeite | null = null;
    await aendereBuchungBestand(bs => {
      const vorher = id ? bs.seiten.find(s => s.id === id) : undefined;
      if (id && !vorher) { fehler = 'Buchungsseite nicht gefunden.'; status = 404; return bs; }
      if (!vorher && bs.seiten.length >= GRENZEN.seiten) { fehler = `Höchstens ${GRENZEN.seiten} Buchungsseiten.`; status = 413; return bs; }
      const titel = typeof roh.titel === 'string' ? roh.titel : '';
      const fest = vorher ? { id: vorher.id, slug: vorher.slug, angelegt: vorher.angelegt } : { id: neueKennung('bs'), slug: neuerSlug(titel), angelegt: jetztIso };
      const r = seiteSauber(roh, fest, person, jetztIso);
      if (!r.ok) { fehler = r.fehler; return bs; }
      gespeichert = r.seite;
      return { ...bs, seiten: vorher ? bs.seiten.map(s => (s.id === vorher.id ? r.seite : s)) : [...bs.seiten, r.seite] };
    }, jetzt);
    if (!gespeichert) return nein(fehler || 'Nicht gespeichert.', status);
    const s = gespeichert as BuchungsSeite;
    await buchungProtokoll([{ liste: 'seiten', op: id ? 'geaendert' : 'neu', id: s.id }], { art: 'person', person });
    return NextResponse.json({ ok: true, seite: { ...s, pfad: `/buchen/${s.slug}` } });
  }

  if (b.aktion === 'seite-loeschen') {
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
    let fehler = '', status = 400;
    await aendereBuchungBestand(bs => {
      if (!bs.seiten.some(s => s.id === id)) { fehler = 'Buchungsseite nicht gefunden.'; status = 404; return bs; }
      if (bs.buchungen.some(x => x.seiteId === id)) { fehler = 'An dieser Seite hängen noch Buchungen — erst deaktivieren; löschen geht, wenn die Löschfrist sie geräumt hat.'; status = 409; return bs; }
      return { ...bs, seiten: bs.seiten.filter(s => s.id !== id) };
    }, jetzt);
    if (fehler) return nein(fehler, status);
    await buchungProtokoll([{ liste: 'seiten', op: 'geloescht', id }], { art: 'person', person });
    return NextResponse.json({ ok: true });
  }

  if (b.aktion === 'freigeben') {
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
    try {
      await buchungFreigeben(id, person, jetzt);
    } catch (e) {
      if (e instanceof FreigabeFehler) return nein(e.message, e.status);
      const text = e instanceof Error ? e.message.slice(0, 200) : 'Fehler';
      return nein(`Freigabe nicht vollständig (${text}) — sie wird automatisch fortgesetzt.`, 502);
    }
    return NextResponse.json({ ok: true });
  }

  if (b.aktion === 'ablehnen') {
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
    const grund = typeof b.grund === 'string' ? b.grund.replace(/\s+/g, ' ').trim() : '';
    if (grund.length > 300) return nein('Grund höchstens 300 Zeichen.', 413);
    let fehler = '', status = 400;
    await aendereBuchungBestand(bs => {
      const x = bs.buchungen.find(y => y.id === id);
      if (!x) { fehler = 'Buchung nicht gefunden.'; status = 404; return bs; }
      if (!OFFEN.includes(x.status)) { fehler = 'Diese Buchung ist nicht mehr offen.'; status = 409; return bs; }
      return { ...bs, buchungen: bs.buchungen.map(y => (y.id === id ? { ...y, status: 'abgelehnt' as const, statusAm: jetztIso, entschiedenAm: jetztIso, entschiedenVon: person, ...(grund ? { grund } : {}) } : y)) };
    }, jetzt);
    if (fehler) return nein(fehler, status);
    await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['status'] }], { art: 'person', person });
    return NextResponse.json({ ok: true });
  }

  return nein('Unbekannte Aktion.');
}
