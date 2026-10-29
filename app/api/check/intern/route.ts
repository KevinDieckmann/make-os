// ─── Innovations-Check — intern (24.10., Branch `innovations-check`) ─────────────────────────────────────────────
// Nur der Haushalt des Inhabers (mit Person, Dienstweg ohne Person 403):
// GET            → { einstellungen, buchungsseiten, verantwortlichDa, liste } — eingegangene Checks (Stufe, Kontakt, CRM-Stand, offene Belege)
// GET ?id=ck-…   → { sitzung } mit allen Antworten im Klartext der Fragen (für Kevin: Beleg-Texte lesen und bewerten)
// POST { aktion: 'einstellungen', aktiv?, buchungSlug?, gastgeber?, marke? }  → nur der Inhaber; einschalten nur mit Verantwortlichem der Instanz
// POST { aktion: 'beleg', id, frage: C5 | D6, score: 0–4 }            → Bewertung nach Rubrik, Ergebnis-Stand neu gerechnet
// POST { aktion: 'crm', id }                                          → Lead noch einmal anlegen (nach Fehler)
// POST { aktion: 'loeschen', id }                                     → Sitzung entfernen (z. B. auf Wunsch der Person)
// Zahlen nur aus lib/check/auswertung.ts. Nichts geht an den Teilnehmer (kein Versand aus dieser Route).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurInhaber } from '@/lib/zugang/haushalt-inhaber';
import { nurHaushalt, nurDerInhaber } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { updateJson } from '@/lib/store/local-db';
import { ladeBuchungBestand } from '@/lib/kalender/buchung-speicher';
import { slugOk } from '@/lib/kalender/buchung';
import { vorlageVon } from '@/lib/check/katalog';
import { frageVon, kurzFertig } from '@/lib/check/ablauf';
import { ergebnisAnsicht } from '@/lib/check/ergebnis';
import { leadPunkte } from '@/lib/check/auswertung';
import { ladeCheckBestand, ladeCheckEinstellungen, speichereCheckEinstellungen, sitzungIntern, SITZUNGEN, ID_OK, type CheckBestand, type CheckSitzung } from '@/lib/check/speicher';
import { ablaufStand, hinweisLaden, leadAnlegen } from '@/lib/check/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BELEG_FRAGEN = ['C5', 'D6'];
const SPEICHER_OK = /^[a-z0-9][a-z0-9-]{0,40}$/;

function zeile(s: CheckSitzung) {
  const offen = BELEG_FRAGEN.filter(id => s.antworten[id]?.freitext && !Number.isInteger(s.antworten[id]?.belegScore)).length;
  return {
    id: s.id, vorlage: s.vorlage, gestartet: s.gestartet, geaendert: s.geaendert, quelle: s.quelle ?? null,
    beantwortet: Object.keys(s.antworten).length, kontaktStand: s.kontaktStand,
    kontakt: s.kontakt ? { vorname: s.kontakt.vorname, firma: s.kontakt.firma, email: s.kontakt.email, telefon: s.kontakt.telefon ?? null, newsletterWunsch: s.kontakt.newsletterWunsch } : null,
    ergebnis: s.ergebnis ?? null, abgeschlossen: s.abgeschlossen ?? null,
    crm: s.crm ? { status: s.crm.status, kontaktId: s.crm.kontaktId ?? null, ...(s.crm.status !== 'ok' && s.crm.grund ? { grund: s.crm.grund } : {}) } : null,
    belegeOffen: offen,
  };
}

/** Ergebnis-Stand nach einer Änderung an den Antworten neu rechnen (nur, wenn es schon eins gab). */
function neuGerechnet(s: CheckSitzung): CheckSitzung {
  const v = vorlageVon(s.vorlage);
  if (!v || !s.ergebnis) return s;
  const { ergebnis, profil } = ergebnisAnsicht(v, s.antworten);
  return { ...s, ergebnis: { ...s.ergebnis, gesamt: ergebnis.gesamt, stufe: ergebnis.stufe, stufeName: ergebnis.stufe_name, genauigkeit: ergebnis.genauigkeit, dimensionen: ergebnis.dimensionen as Record<string, number>, lead: leadPunkte(v.leadScoring, profil, ergebnis, {}) } };
}

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  const id = new URL(req.url).searchParams.get('id');
  const b = await ladeCheckBestand();
  if (id) {
    if (!ID_OK.test(id)) return NextResponse.json({ ok: false, fehler: 'Unbekannt.' }, { status: 404 });
    const s = b.sitzungen.find(x => x.id === id);
    const v = s ? vorlageVon(s.vorlage) : null;
    if (!s || !v) return NextResponse.json({ ok: false, fehler: 'Unbekannt.' }, { status: 404 });
    leseZugriff(req, 'kontakte', { anzahl: 1 });
    const antworten = Object.entries(s.antworten).map(([fid, a]) => {
      const f = frageVon(v, fid);
      return {
        frage: fid, text: f?.text ?? fid, typ: f?.typ ?? 'offen', abschnitt: f?.abschnitt ?? '',
        auswahl: (a.optionIds ?? []).map(o => f?.optionen?.find(x => x.id === o)?.text ?? o),
        ...(a.freitext ? { freitext: a.freitext } : {}), ...(a.optionText ? { optionText: a.optionText } : {}), ...(typeof a.zusatz === 'boolean' ? { zusatz: a.zusatz } : {}),
        ...(f?.typ === 'beleg' ? { rubrik: f.rubrik ?? [], ...(Number.isInteger(a.belegScore) ? { belegScore: a.belegScore, belegVon: a.belegVon ?? null } : {}) } : {}),
      };
    });
    return NextResponse.json({ ok: true, sitzung: { ...zeile(s), antworten, uebersprungen: s.uebersprungen, kurzFertig: kurzFertig(v, ablaufStand(s)) } }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const [e, buchung, hinweis] = await Promise.all([ladeCheckEinstellungen(), ladeBuchungBestand(), hinweisLaden()]);
  const liste = [...b.sitzungen].sort((x, y) => y.geaendert.localeCompare(x.geaendert)).map(zeile);
  leseZugriff(req, 'kontakte', { anzahl: liste.filter(z => z.kontakt).length });
  return NextResponse.json({
    ok: true, einstellungen: e, verantwortlichDa: !!hinweis,
    buchungsseiten: buchung.seiten.filter(s => s.aktiv).map(s => ({ slug: s.slug, titel: s.titel })),
    liste,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang || zugang.dienst) return nurHaushalt();
  const bau = bauPruefen(req); if (bau) return bau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 8 * 1024); } catch (x) { return jsonZuGross(x) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const jetzt = new Date().toISOString();

  if (b.aktion === 'einstellungen') {
    if (!(await nurInhaber(req))) return nurDerInhaber();
    const alt = await ladeCheckEinstellungen();
    const aktiv = typeof b.aktiv === 'boolean' ? b.aktiv : alt.aktiv;
    if (aktiv && !(await hinweisLaden())) return NextResponse.json({ ok: false, fehler: 'Erst den Verantwortlichen unter Einstellungen › Datenschutz eintragen — ohne ihn bleibt der Check zu.' }, { status: 409 });
    let buchungSlug = alt.buchungSlug;
    if (b.buchungSlug !== undefined) {
      if (b.buchungSlug === null || b.buchungSlug === '') buchungSlug = undefined;
      else if (typeof b.buchungSlug !== 'string' || !slugOk(b.buchungSlug) || !(await ladeBuchungBestand()).seiten.some(s => s.slug === b.buchungSlug && s.aktiv)) return NextResponse.json({ ok: false, fehler: 'Diese Buchungsseite gibt es nicht (oder sie ist aus).' }, { status: 400 });
      else buchungSlug = b.buchungSlug;
    }
    let gastgeber = alt.gastgeber;
    if (b.gastgeber !== undefined) {
      if (b.gastgeber === null || b.gastgeber === '') gastgeber = undefined;
      else if (typeof b.gastgeber !== 'string' || !SPEICHER_OK.test(b.gastgeber)) return NextResponse.json({ ok: false, fehler: 'Unbekannte Person.' }, { status: 400 });
      else gastgeber = b.gastgeber;
    }
    let marke = alt.marke;
    if (b.marke !== undefined) {
      const m = typeof b.marke === 'string' ? b.marke.trim() : '';
      if (b.marke === null || m === '') marke = undefined;
      else if (m.length > 60 || /[<>{}\n]/.test(m)) return NextResponse.json({ ok: false, fehler: 'Der Name darf höchstens 60 Zeichen haben, ohne Sonderzeichen wie < > { }.' }, { status: 400 });
      else marke = m;
    }
    const e = await speichereCheckEinstellungen({ aktiv, ...(buchungSlug ? { buchungSlug } : {}), ...(gastgeber ? { gastgeber } : {}), ...(marke ? { marke } : {}), geaendert: jetzt, geaendertVon: zugang.person });
    return NextResponse.json({ ok: true, einstellungen: e });
  }

  const id = typeof b.id === 'string' && ID_OK.test(b.id) ? b.id : null;
  if (!id) return NextResponse.json({ ok: false, fehler: 'Unbekannt.' }, { status: 404 });

  if (b.aktion === 'beleg') {
    const frage = typeof b.frage === 'string' && BELEG_FRAGEN.includes(b.frage) ? b.frage : null;
    const score = typeof b.score === 'number' && Number.isInteger(b.score) && b.score >= 0 && b.score <= 4 ? b.score : null;
    if (!frage || score === null) return NextResponse.json({ ok: false, fehler: 'Bitte eine Stufe 0 bis 4 für C5 oder D6.' }, { status: 400 });
    let fehlt = false;
    const s = await sitzungIntern(id, x => {
      if (!x.antworten[frage]?.freitext) { fehlt = true; return x; }
      return neuGerechnet({ ...x, antworten: { ...x.antworten, [frage]: { ...x.antworten[frage], belegScore: score, belegVon: zugang.person } } });
    });
    if (!s) return NextResponse.json({ ok: false, fehler: 'Unbekannt.' }, { status: 404 });
    if (fehlt) return NextResponse.json({ ok: false, fehler: 'Zu dieser Frage gibt es keinen Text.' }, { status: 400 });
    return NextResponse.json({ ok: true, zeile: zeile(s) });
  }

  if (b.aktion === 'crm') {
    const s = (await ladeCheckBestand()).sitzungen.find(x => x.id === id);
    if (!s) return NextResponse.json({ ok: false, fehler: 'Unbekannt.' }, { status: 404 });
    if (!s.kontakt) return NextResponse.json({ ok: false, fehler: 'Ohne Kontaktdaten gibt es keinen Lead.' }, { status: 400 });
    if (s.crm?.status === 'ok') return NextResponse.json({ ok: true, zeile: zeile(s) });
    const v = vorlageVon(s.vorlage);
    const satz = s.ergebnis ? `Stufe ${s.ergebnis.stufe} (${s.ergebnis.stufeName}, ${s.ergebnis.gesamt} von 100)` : 'Kurzcheck ausgefüllt';
    const crm = await leadAnlegen(s, await ladeCheckEinstellungen(), `${v?.name ?? 'Check'} auf der Website: ${satz}.`);
    const neu = await sitzungIntern(id, x => ({ ...x, crm }));
    return NextResponse.json({ ok: crm?.status === 'ok', zeile: neu ? zeile(neu) : null, ...(crm?.status !== 'ok' ? { fehler: crm?.grund ?? 'Nicht angelegt.' } : {}) }, { status: crm?.status === 'ok' ? 200 : 409 });
  }

  if (b.aktion === 'loeschen') {
    let weg = false;
    await updateJson<CheckBestand>(SITZUNGEN, cur => {
      const x = cur ?? { sitzungen: [] };
      const rest = x.sitzungen.filter(s => s.id !== id);
      weg = rest.length !== x.sitzungen.length;
      return weg ? { ...x, sitzungen: rest } : x;
    });
    return weg ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, fehler: 'Unbekannt.' }, { status: 404 });
  }

  return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
}
