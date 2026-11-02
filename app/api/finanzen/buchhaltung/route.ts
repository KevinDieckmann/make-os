// ─── /api/finanzen/buchhaltung — Regeln, Kategorien, Vorschläge, Buchhaltungs-Paket (02.11.) ───────────────────────────────────────────
// GET  → Regeln + eigene Kategorien (mit Stand), Vorschläge für gespeicherte Umbuchungen, Zahl „zu prüfen“ — in der Sicht des Kontos.
// POST → `aktion`: regel-lernen · regel-weg · kategorie-dazu · rueckwirkend-vorschau · rueckwirkend-anwenden · paket-vorschau · paket-uebernehmen.
// Zugang wie die Buchungen (Konto mit Haushalt UND Haushalt des Inhabers; Business-Konto sieht/ändert nur Business-Gesellschaften), nie der
// Dienstweg (403). Schreibt nur mit Build-Kennung (`bauPruefen`), Stand je Bestand (409), Protokoll ohne Werte. Verwendungszwecke sind fremder
// Text — sie gehen nirgends an ZOE.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { istDienst, planZugangVon } from '@/lib/zugang/tor';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { istBusinessGesellschaft, istGesellschaft } from '@/lib/einheiten';
import { wirksameSicht } from '@/lib/finanzen/plan/sicht';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliere, werAusKoepfen, type Aenderung } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { bauPruefen } from '@/lib/bau/pruefen';
import { neueKennung } from '@/lib/kennung';
import { ladeRegister } from '@/lib/finanzen/konten/server';
import { sichtbarIn } from '@/lib/finanzen/konten/register';
import { kategorienFuer } from '@/lib/finanzen/buchhaltung/kategorien';
import { eigeneKategorieDazu, regelPruefen, rueckwirkend, REGELN_MAX, regelFuer, regelDarf, type RegelBestand } from '@/lib/finanzen/buchhaltung/regeln';
import { umbuchungVorschlaege } from '@/lib/finanzen/buchhaltung/gegenkonto';
import { zuPruefen } from '@/lib/finanzen/buchhaltung/pruefung';
import { paketPlanen, paketPruefen, paketSatz, type PaketPlan } from '@/lib/finanzen/buchhaltung/paket';
import { buchungenAendern, buchungenLaden, mitStand, regelnAendern, regelnLaden, regelnName, regelnStand, sichtbarFuer, type Sicht } from '@/lib/finanzen/buchhaltung/server';
import type { BhBuchung } from '@/lib/finanzen/buchhaltung/arbeitsliste';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, error: 'Kein Zugang zu den Business-Buchungen — sie gehören zum Haushalt des Inhabers (Einstellungen › Konto).' };
const RUECKWIRKEND_MAX = 5000;

async function zugang(req: Request): Promise<{ person: string; haushalt: string; sicht: Sicht } | null> {
  if (istDienst(req)) return null;
  const z = await planZugangVon(req);
  if (!z || z.haushalt !== (await haushaltDesInhabers())) return null;
  return { person: z.person, haushalt: z.haushalt, sicht: wirksameSicht(z.sicht, new URL(req.url).searchParams.get('sicht')) };
}
const nein = (status: number, error: string, mehr: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...mehr }, { status });
/** Regeln in der Sicht: Business sieht nur Regeln einer Business-Gesellschaft. */
const regelnFuer = (b: RegelBestand, sicht: Sicht): RegelBestand => (sicht === 'privat' ? b : { ...b, regeln: b.regeln.filter(r => !!r.ort && istBusinessGesellschaft(r.ort)) });
const ortErlaubt = (sicht: Sicht) => (o: string) => istGesellschaft(o) && (sicht === 'privat' || istBusinessGesellschaft(o));

async function lage(z: { haushalt: string; sicht: Sicht }) {
  const [bestand, alle] = await Promise.all([regelnLaden(z.haushalt), buchungenLaden()]);
  const sichtbar = alle.filter(b => sichtbarFuer(b, z.sicht) && b.ort && istGesellschaft(b.ort));
  return {
    regeln: regelnFuer(bestand, z.sicht).regeln, eigene: bestand.kategorien, kategorien: kategorienFuer(bestand.kategorien), stand: regelnStand(bestand),
    vorschlaege: umbuchungVorschlaege(sichtbar),
    zuPruefen: sichtbar.filter(zuPruefen).length,
  };
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return nein(403, KEIN_ZUGANG.error);
  const l = await lage(z);
  leseZugriff(req, 'konten', { anzahl: l.vorschlaege.length });
  return NextResponse.json({ ok: true, sicht: z.sicht, ...l });
}

/** Plan des Pakets in der Sicht (Vorschau und Übernahme rechnen dasselbe). */
async function paketPlan(z: { haushalt: string; sicht: Sicht }, roh: unknown, buchungen: readonly BhBuchung[], bestand: RegelBestand): Promise<{ ok: true; plan: PaketPlan; basis: string } | { ok: false; status: number; error: string }> {
  const p = paketPruefen(roh, { orteErlaubt: ortErlaubt(z.sicht), eigene: bestand.kategorien });
  if (!p.ok) return { ok: false, status: p.status, error: p.fehler };
  const register = await ladeRegister(z.haushalt);
  const konten = register.konten.filter(k => sichtbarIn(k, z.sicht) && k.iban && istGesellschaft(k.ort)).map(k => ({ id: k.id, name: k.name, iban: k.iban!, ort: k.ort }));
  const plan = paketPlanen(p.paket, { buchungen: buchungen.filter(b => sichtbarFuer(b, z.sicht)), konten, regeln: bestand, jetzt: new Date().toISOString(), neueId: () => neueKennung('br') });
  const basis = fingerabdruck({
    a: Array.from(plan.aenderungen.entries()).map(([id, b]) => [id, fingerabdruck(b as unknown as Record<string, unknown>)]),
    r: [...plan.regelnNeu, ...plan.regelnGeaendert].map(r => [r.ort ?? '', r.feld, r.muster, r.kategorie, r.notiz ?? '']),
  });
  return { ok: true, plan, basis };
}
const planAntwort = (plan: PaketPlan, basis: string) => ({
  satz: paketSatz(plan), basis, zugeordnet: plan.zugeordnet, mitAenderung: plan.aenderungen.size, unveraendert: plan.unveraendert, handBehalten: plan.handBehalten,
  ohneBuchung: plan.ohneBuchung, regelnNeu: plan.regelnNeu.length, regelnGeaendert: plan.regelnGeaendert.length, regelnGleich: plan.regelnGleich,
});

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return nein(403, KEIN_ZUGANG.error);
  const bau = bauPruefen(req);
  if (bau) return bau;
  let body: Record<string, unknown>;
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein gültiges JSON.'); }
  if (!body || typeof body !== 'object') return nein(400, 'Kein gültiges JSON.');
  const wer = werAusKoepfen(req.headers);
  const stand = typeof body.stand === 'string' ? body.stand : undefined;
  const regelSchreiben = async (f: (alt: RegelBestand) => RegelBestand | { status: 400 | 403 | 404 | 413; fehler: string } | null, protokoll: (n: RegelBestand) => Aenderung[]) => {
    if (!stand) return nein(400, 'Stand fehlt — bitte neu laden. Nichts gespeichert.');
    let fehler: { status: number; fehler: string } | null = null;
    const r = await regelnAendern(z.haushalt, stand, alt => { const n = f(alt); if (n && 'fehler' in n) { fehler = n; return null; } return n; });
    if (fehler) { const fe = fehler as { status: number; fehler: string }; return nein(fe.status, fe.fehler); }
    if (!r.ok) return nein(409, 'Inzwischen hat jemand die Regeln geändert — neu geladen, nichts gespeichert.', { ...(await lage(z)) });
    await protokolliere(regelnName(z.haushalt), protokoll(r.bestand), wer);
    return NextResponse.json({ ok: true, ...(await lage(z)) });
  };

  switch (body.aktion) {
    case 'regel-lernen': {
      const roh = body.regel as Record<string, unknown> | undefined;
      if (z.sicht === 'business' && !(typeof roh?.ort === 'string' && istBusinessGesellschaft(roh.ort))) return nein(403, 'Aus dem Business-Bereich gilt eine Regel immer für eine Business-Gesellschaft — bitte eine wählen. Nichts gespeichert.');
      const id = neueKennung('br');
      const p = regelPruefen(roh, { id, jetzt: new Date().toISOString(), erlaubteOrte: ortErlaubt(z.sicht) });
      if (!p.ok) return nein(p.status, p.fehler);
      return regelSchreiben(alt => {
        if (alt.regeln.length >= REGELN_MAX) return { status: 413, fehler: `Höchstens ${REGELN_MAX} Regeln — nichts gespeichert.` };
        let b = { ...alt, regeln: [...alt.regeln, p.wert] };
        if (!kategorienFuer(alt.kategorien).includes(p.wert.kategorie)) { const k = eigeneKategorieDazu(b, p.wert.kategorie); if (!k.ok) return k; b = k.wert; }
        return b;
      }, () => [{ liste: 'regeln', op: 'neu', id }]);
    }
    case 'regel-weg': {
      const id = typeof body.id === 'string' ? body.id : '';
      return regelSchreiben(alt => {
        const r = alt.regeln.find(x => x.id === id);
        if (!r) return { status: 404, fehler: 'Die Regel gibt es nicht (mehr) — nichts gespeichert.' };
        if (z.sicht === 'business' && !(r.ort && istBusinessGesellschaft(r.ort))) return { status: 403, fehler: 'Nicht erlaubt: diese Regel gehört nicht zu einer Business-Gesellschaft — nichts gespeichert.' };
        return { ...alt, regeln: alt.regeln.filter(x => x.id !== id) };
      }, () => [{ liste: 'regeln', op: 'geloescht', id }]);
    }
    case 'kategorie-dazu': {
      return regelSchreiben(alt => { const k = eigeneKategorieDazu(alt, body.name); return k.ok ? (k.wert === alt ? null : k.wert) : k; }, () => [{ liste: 'kategorien', op: 'neu', id: 'kategorie' }]);
    }
    case 'rueckwirkend-vorschau': {
      const bestand = await regelnLaden(z.haushalt);
      const regelId = typeof body.regelId === 'string' ? body.regelId : undefined;
      const alle = (await buchungenLaden()).filter(b => sichtbarFuer(b, z.sicht));
      const regeln = regelnFuer(bestand, z.sicht).regeln;
      const wirkung = rueckwirkend(alle, regeln, regelId ? r => r.id === regelId : undefined);
      const staende = new Map(alle.map(b => [b.id, mitStand(b).stand]));
      return NextResponse.json({ ok: true, wirkung: wirkung.map(w => ({ ...w, stand: staende.get(w.id) })) });
    }
    case 'rueckwirkend-anwenden': {
      const ids = Array.isArray(body.ids) ? body.ids as { id?: unknown; stand?: unknown }[] : null;
      if (!ids?.length) return nein(400, 'Keine Buchungen gewählt — nichts gespeichert.');
      if (ids.length > RUECKWIRKEND_MAX) return nein(413, `Höchstens ${RUECKWIRKEND_MAX} Buchungen je Aufruf — gekürzt wird nie, nichts gespeichert.`);
      const staende = new Map<string, string>();
      for (const x of ids) { if (typeof x?.id !== 'string' || typeof x.stand !== 'string') return nein(400, 'Buchung ohne Kennung oder Stand — bitte neu laden. Nichts gespeichert.'); staende.set(x.id, x.stand); }
      const regeln = regelnFuer(await regelnLaden(z.haushalt), z.sicht).regeln;
      const r = await buchungenAendern(staende, alle => {
        const raus = new Map<string, BhBuchung>();
        for (const id of Array.from(staende.keys())) {
          const b = alle.find(x => x.id === id)!;
          if (!sichtbarFuer(b, z.sicht)) return { status: 403, fehler: 'Nicht erlaubt: aus dem Business-Bereich nur Buchungen der Business-Gesellschaften — nichts gespeichert.' };
          const regel = regelDarf(b) ? regelFuer(regeln, b) : undefined;
          if (regel && regel.kategorie !== b.kategorie) raus.set(id, { ...b, kategorie: regel.kategorie, regel: regel.id, ...(regel.notiz && !b.notiz ? { notiz: regel.notiz } : {}) });
        }
        return raus;
      });
      if (!r.ok) return nein(r.status, r.fehler, r.konflikte ? { konflikte: r.konflikte } : {});
      await protokolliere('buchungen', r.geaendert.map(b => ({ liste: 'buchungen', op: 'geaendert' as const, id: b.id, felder: ['kategorie', 'regel'] })), wer);
      return NextResponse.json({ ok: true, geaendert: r.geaendert.length, zeilen: r.geaendert });
    }
    case 'paket-vorschau': {
      const bestand = await regelnLaden(z.haushalt);
      const p = await paketPlan(z, body.paket, await buchungenLaden(), bestand);
      if (!p.ok) return nein(p.status, p.error);
      return NextResponse.json({ ok: true, ...planAntwort(p.plan, p.basis) });
    }
    case 'paket-uebernehmen': {
      const bestand = await regelnLaden(z.haushalt);
      const vorab = await paketPlan(z, body.paket, await buchungenLaden(), bestand);
      if (!vorab.ok) return nein(vorab.status, vorab.error);
      if (typeof body.basis === 'string' && body.basis !== vorab.basis) return nein(409, 'Inzwischen hat sich etwas geändert — die Vorschau ist neu gerechnet, bitte noch einmal prüfen. Nichts eingelesen.', { vorschau: planAntwort(vorab.plan, vorab.basis) });
      // 1) Regeln (eigener Bestand, eigene Sperre — idempotent über den Schlüssel der Regel).
      let regelnGeschrieben = 0;
      if (vorab.plan.regelnNeu.length || vorab.plan.regelnGeaendert.length) {
        let zuViele = false;
        const r = await regelnAendern(z.haushalt, undefined, alt => {
          const frisch = paketPruefen(body.paket, { orteErlaubt: ortErlaubt(z.sicht), eigene: alt.kategorien });
          if (!frisch.ok) return null;
          const plan = paketPlanen(frisch.paket, { buchungen: [], konten: [], regeln: alt, jetzt: new Date().toISOString(), neueId: () => neueKennung('br') });
          if (!plan.regelnNeu.length && !plan.regelnGeaendert.length) return null;
          if (alt.regeln.length + plan.regelnNeu.length > REGELN_MAX) { zuViele = true; return null; }
          const geaendert = new Map(plan.regelnGeaendert.map(x => [x.id, x]));
          regelnGeschrieben = plan.regelnNeu.length + plan.regelnGeaendert.length;
          return { ...alt, regeln: [...alt.regeln.map(x => geaendert.get(x.id) ?? x), ...plan.regelnNeu] };
        });
        if (zuViele) return nein(413, `Mit dem Paket wären es mehr als ${REGELN_MAX} Regeln — gekürzt wird nie, nichts eingelesen.`);
        if (r.ok && regelnGeschrieben) await protokolliere(regelnName(z.haushalt), [{ liste: 'regeln', op: 'geaendert', id: 'paket', felder: [`anzahl:${regelnGeschrieben}`] }], wer);
      }
      // 2) Buchungen — frisch in der Sperre geplant (Hand gewinnt, Lücken füllen), Stände gelten aus genau diesem Stand.
      const register = await ladeRegister(z.haushalt);
      const konten = register.konten.filter(k => sichtbarIn(k, z.sicht) && k.iban && istGesellschaft(k.ort)).map(k => ({ id: k.id, name: k.name, iban: k.iban!, ort: k.ort }));
      const frisch = paketPruefen(body.paket, { orteErlaubt: ortErlaubt(z.sicht), eigene: (await regelnLaden(z.haushalt)).kategorien });
      if (!frisch.ok) return nein(frisch.status, frisch.fehler);
      const r = await buchungenAendern(new Map(), alle => paketPlanen(frisch.paket, { buchungen: alle.filter(b => sichtbarFuer(b, z.sicht)), konten, regeln: { regeln: [], kategorien: [] }, jetzt: '', neueId: () => 'br-x' }).aenderungen);
      if (!r.ok) return nein(r.status, r.fehler);
      await protokolliere('buchungen', r.geaendert.map(b => ({ liste: 'buchungen', op: 'geaendert' as const, id: b.id, felder: ['paket'] })), wer);
      return NextResponse.json({ ok: true, geaendert: r.geaendert.length, regelnGeschrieben, satz: paketSatz(vorab.plan), ...(await lage(z)) });
    }
    default:
      return nein(400, 'Unbekannte Aktion.');
  }
}
