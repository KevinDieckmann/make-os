// ─── Markttraktion · LinkedIn-Netzwerk (25.09.) ─────────────────────────────
// GET  ?kampagne=kp-…            → die Vernetzen-Runde für die anfragende Person
//                                 (Karten und Zahlen, lib/crm/netzwerk.ts)
// POST { aktion, id, … }         → ein Schritt an einer Person, für das Profil
//                                 der anfragenden Person (kevin, malin):
//   profil { url }               LinkedIn-Profil eintragen (nur Personenprofile)
//   nicht_gefunden               beim Anreichern kein Profil gefunden
//   angefragt { kampagneId? }    Vernetzungsanfrage ist raus
//   vernetzt                     angenommen
//   geschrieben { text, kampagneId? }  Nachricht nach der Annahme ist raus —
//                                 zählt als echter Kontakt, nächster Schritt
//                                 „auf Antwort schauen“ nach den Folgetagen
//   antwort { art: ja|gespraech|kein_interesse, wortlaut? }  Reaktion; ein
//                                 Ja wird Einwilligung (LinkedIn) mit Wortlaut
//   zurueckgezogen | abgelehnt   Anfrage erledigt ohne Vernetzung
// POST { aktion: 'import', csv, uebernehmen? }  LinkedIn-Export
//                                 (Connections.csv) der anfragenden Person:
//                                 ohne `uebernehmen` nur die Vorschau.
// MAKE OS versendet nichts — es merkt sich, was Kevin oder Malin in LinkedIn tun.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay, tagePlus } from '@/lib/zeit';
import { fuerPerson, wendeAktivitaetAn, vonHandMarkieren, type Kontakt, type Aktivitaet } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { netzRunde, profilAdresse, exportLesen, exportAbgleich, exportAnwenden, netzSchrittGesperrt, linkedinEinwilligung, type NetzStand } from '@/lib/crm/netzwerk';
import { nameVon } from '@/lib/crm/team';
import type { KampagnenErgebnis } from '@/lib/crm/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Bestand = { kontakte: Kontakt[] };
const kpOk = (v: unknown) => (/^kp-[a-z0-9-]{1,60}$/.test(String(v ?? '')) ? String(v) : undefined);

/** Größter LinkedIn-Export, der gelesen wird (Zeichen) — darüber 413, nie abschneiden (28.09.). */
const CSV_MAX = 5_000_000;

export async function GET(req: Request) {
  // Person aus dem Zugang (28.09., Regel 5): Sitzung oder Dienstweg MIT Person — kein Rückfall auf „kevin“.
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const person = zugang.person;
  const kampagneId = kpOk(new URL(req.url).searchParams.get('kampagne'));
  const [kontakte, crm] = await Promise.all([loadJson<Bestand>('kontakte').then(f => f?.kontakte ?? []), ladeCrm()]);
  const kampagne = kampagneId ? crm.kampagnen.find(k => k.id === kampagneId) : undefined;
  const r = netzRunde(kontakte, person, localDay(), { kampagne });
  return NextResponse.json({ ok: true, profil: person, kampagne: kampagne ? { id: kampagne.id, name: kampagne.name, vernetzen: kampagne.vernetzen ?? null } : null, zahlen: r.zahlen, karten: r.karten.map(k => ({ id: k.kontakt.id, stufe: k.stufe, grund: k.grund })) });
}

/**
 * Einen Kontakt ändern — nur, was der Schritt braucht; der Rest bleibt, wie er auf dem Server steht.
 * Datenschutz (28.09., W8) IN der Sperre: Art. 18 → nichts; Werbesperre → keine werblichen Schritte (`netzSchrittGesperrt`).
 */
async function aendere(id: string, pruefe: (k: Kontakt) => string | null, mut: (k: Kontakt) => Kontakt | null): Promise<{ kontakt: Kontakt | null; gesperrt: string | null }> {
  let neu: Kontakt | null = null;
  let gesperrt: string | null = null;
  await updateJson<Bestand>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    const i = f.kontakte.findIndex(k => k.id === id);
    if (i < 0) return f;
    gesperrt = pruefe(f.kontakte[i]);
    if (gesperrt) return f;
    const n = mut(f.kontakte[i]);
    if (n) { f.kontakte[i] = n; neu = n; }
    return f;
  });
  return { kontakt: neu, gesperrt };
}

const stand = (k: Kontakt, p: string): NetzStand | undefined => k.netzwerk?.[p];
const mitStand = (k: Kontakt, p: string, s: NetzStand, heute: string): Kontakt => ({ ...k, netzwerk: { ...(k.netzwerk ?? {}), [p]: s }, geaendertAm: heute });
/** Ein Eintrag im Verlauf, ohne „letzter Kontakt“ und Stufe anzufassen (Vernetzen ist noch kein Gespräch). */
const vermerk = (k: Kontakt, text: string, von: string, bezug?: string): Kontakt => ({ ...k, aktivitaeten: [...(k.aktivitaeten ?? []), { am: new Date().toISOString(), art: 'linkedin', text, von, ...(bezug ? { bezug } : {}) } as Aktivitaet] });

async function kampagnenErgebnis(kampagneId: string | undefined, kontaktId: string, ergebnis: KampagnenErgebnis, heute: string, von: string) {
  if (!kampagneId) return;
  await aendereCrm(c => ({ ...c, kampagnen: c.kampagnen.map(k => (k.id === kampagneId && k.kontaktIds.includes(kontaktId) ? { ...k, ergebnisse: [...k.ergebnisse, { kontaktId, ergebnis, am: heute, von }], geaendert: new Date().toISOString(), geaendertVon: von } : k)) }));
}

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: { aktion?: string; id?: string; url?: string; kampagneId?: string; text?: string; art?: string; wortlaut?: string; csv?: string; uebernehmen?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const person = zugang.person;
  const profilName = nameVon(person);
  const heute = localDay();
  const kampagneId = kpOk(b.kampagneId);

  if (b.aktion === 'import') {
    const csv = String(b.csv ?? '');
    // Nie abschneiden (28.09.): ein zu großer Export wird abgelehnt, statt still nur den Anfang zu lesen.
    if (csv.length > CSV_MAX) return NextResponse.json({ ok: false, fehler: `Der Export ist zu groß (${Math.round(csv.length / 1e6)} MB, höchstens ${CSV_MAX / 1e6} MB) — bitte in Teilen hochladen.` }, { status: 413 });
    const zeilen = exportLesen(csv);
    if (!zeilen.length) return NextResponse.json({ ok: false, fehler: 'Das ist kein LinkedIn-Export — erwartet wird „Connections.csv“ mit den Spalten First Name, Last Name, URL.' }, { status: 400 });
    const kontakte = (await loadJson<Bestand>('kontakte'))?.kontakte ?? [];
    const plan = exportAbgleich(kontakte, zeilen, person);
    const vorschau = { zeilen: plan.zeilen, treffer: plan.treffer.length, neueProfile: plan.treffer.filter(t => t.neuesProfil).length, neuVernetzt: plan.treffer.filter(t => t.wirdVernetzt).length, ohneTreffer: plan.ohneTreffer, profil: profilName,
      beispiele: plan.treffer.slice(0, 8).map(t => ({ name: `${t.zeile.vorname} ${t.zeile.nachname}`.trim(), wie: t.wie })) };
    if (!b.uebernehmen) return NextResponse.json({ ok: true, vorschau });
    const nach = new Map(plan.treffer.map(t => [t.kontaktId, t]));
    await updateJson<Bestand>('kontakte', cur => {
      const f = cur ?? { kontakte: [] };
      // „Online gewinnt“ (Prüfbericht F1): ein übernommenes Profil ist Handarbeit — der Masterlisten-Import überschreibt es nicht.
      // Art. 18 (28.09.): eingeschränkte Personen überspringt der Import — an ihnen wird nichts festgehalten.
      return { ...f, kontakte: f.kontakte.map(k => { const t = nach.get(k.id); return t && !k.eingeschraenkt ? vonHandMarkieren(k, { ...exportAnwenden(k, t, person, heute), geaendertAm: heute }) : k; }) };
    });
    return NextResponse.json({ ok: true, vorschau, text: `${vorschau.treffer} Kontakte abgeglichen: ${vorschau.neueProfile} Profile ergänzt, ${vorschau.neuVernetzt} jetzt als vernetzt mit ${profilName} markiert.` });
  }

  const id = String(b.id ?? '');
  if (!/^c-[a-z0-9-]{2,80}$/.test(id)) return NextResponse.json({ ok: false, fehler: 'Unbekannte Person.' }, { status: 400 });
  let fehler: string | null = null;
  let kErgebnis: KampagnenErgebnis | null = null;
  // Die Folgetage der Kampagne bestimmen, wann nach der Nachricht nachgefasst wird.
  const kampagnen = b.aktion === 'geschrieben' ? (await ladeCrm()).kampagnen : [];

  const jetztIso = new Date().toISOString();
  const { kontakt: k, gesperrt } = await aendere(id, alt => netzSchrittGesperrt(alt, b.aktion, b.art), alt => {
    const s = stand(alt, person);
    switch (b.aktion) {
      case 'profil': {
        const url = profilAdresse(b.url);
        if (!url) { fehler = 'Das ist keine LinkedIn-Profiladresse (linkedin.com/in/…).'; return null; }
        // Von Hand eingetragen: `vonHand` bekommt „linkedin“ — sonst überschriebe der nächste Import das Profil (F1).
        return vonHandMarkieren(alt, { ...alt, linkedin: url, linkedinNichtGefunden: undefined, geaendertAm: heute });
      }
      case 'nicht_gefunden':
        return { ...alt, linkedinNichtGefunden: heute, geaendertAm: heute };
      case 'angefragt':
        if (!profilAdresse(alt.linkedin)) { fehler = 'Erst das LinkedIn-Profil eintragen.'; return null; }
        return vermerk(mitStand(alt, person, { status: 'angefragt', angefragtAm: heute, ...(kampagneId ? { kampagneId } : {}), quelle: 'hand' }, heute), `Vernetzungsanfrage gesendet (Profil ${profilName})`, person, kampagneId);
      case 'vernetzt':
        return vermerk(mitStand(alt, person, { ...(s ?? {}), status: 'vernetzt', vernetztAm: heute, quelle: s?.quelle ?? 'hand' }, heute), `Vernetzt (Profil ${profilName})`, person, s?.kampagneId);
      case 'zurueckgezogen': case 'abgelehnt':
        return vermerk(mitStand(alt, person, { ...(s ?? { angefragtAm: heute }), status: b.aktion }, heute), b.aktion === 'abgelehnt' ? `Vernetzung abgelehnt (Profil ${profilName})` : `Anfrage zurückgezogen (Profil ${profilName})`, person, s?.kampagneId);
      case 'geschrieben': {
        if (s?.status !== 'vernetzt') { fehler = 'Erst vernetzen — geschrieben wird nach der Annahme.'; return null; }
        const text = String(b.text ?? '').trim().slice(0, 2000);
        const kp = kampagneId ?? s.kampagneId;
        const folge = kampagnen.find(x => x.id === kp)?.vernetzen?.folgeTage ?? 7;
        // Echter Kontakt: letzter Kontakt, Stufe „angesprochen“, nächster Schritt nach den Folgetagen.
        let n = wendeAktivitaetAn(alt, { art: 'linkedin', text: `Nachricht nach der Vernetzung (Profil ${profilName})${text ? `:\n${text}` : ''}`, von: person, ...(kp ? { bezug: kp } : {}) }, heute, new Date().toISOString(), tagePlus);
        n = mitStand(n, person, { ...s, geschriebenAm: heute, ...(kp ? { kampagneId: kp } : {}) }, heute);
        if (!n.naechsterSchritt) n = { ...n, naechsterSchritt: { text: 'LinkedIn: Antwort da? Sonst nachfassen oder anrufen', datum: tagePlus(heute, folge) } };
        kErgebnis = 'angesprochen';
        return n;
      }
      case 'antwort': {
        const art = b.art === 'ja' || b.art === 'gespraech' || b.art === 'kein_interesse' ? b.art : null;
        if (!art) { fehler = 'art: ja, gespraech oder kein_interesse.'; return null; }
        const text = art === 'ja' ? 'Antwort auf LinkedIn: Ja — wir dürfen schreiben' : art === 'gespraech' ? 'Antwort auf LinkedIn: Gespräch vereinbart' : 'Antwort auf LinkedIn: kein Interesse';
        let n = wendeAktivitaetAn(alt, { art: 'antwort', text, von: person, ...(s?.kampagneId ? { bezug: s.kampagneId } : {}) }, heute, new Date().toISOString(), tagePlus);
        if (art === 'ja') {
          const wortlaut = String(b.wortlaut ?? '').trim().slice(0, 300) || 'Frage nach der Vernetzung: „Darf ich Ihnen kurz schreiben, woran wir arbeiten?“ — Ja';
          // Voller Nachweis (28.09., W8): Wortlaut, Beleg, Zeitpunkt, wer — gestempelt wie in der Kartei.
          n = linkedinEinwilligung(alt, n, wortlaut, profilName, person, heute, jetztIso);
        }
        if (art === 'kein_interesse') n = { ...n, naechsterSchritt: undefined };
        kErgebnis = art === 'ja' ? 'reagiert' : art === 'gespraech' ? 'gespraech' : 'kein_interesse';
        return n;
      }
      default:
        fehler = 'aktion: profil, nicht_gefunden, angefragt, vernetzt, geschrieben, antwort, zurueckgezogen, abgelehnt oder import.';
        return null;
    }
  });
  if (gesperrt) return NextResponse.json({ ok: false, fehler: gesperrt }, { status: 409 });
  if (fehler) return NextResponse.json({ ok: false, fehler }, { status: 400 });
  if (!k) return NextResponse.json({ ok: false, fehler: 'Person nicht gefunden.' }, { status: 404 });
  const kontakt = k as Kontakt;
  if (kErgebnis) await kampagnenErgebnis(kampagneId ?? kontakt.netzwerk?.[person]?.kampagneId, id, kErgebnis, heute, person);
  return NextResponse.json({ ok: true, kontakt: fuerPerson(kontakt, person) });
}
