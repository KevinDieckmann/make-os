// ─── Fulfillment — ein Fall je Mandat (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 3, 7, 9) ───────────────────────────────────────────────
// GET  ?m=<mandat> → Fall (wie er wirkt), Stand je Eintrag, Onboarding-Stand mit 24-h-Uhr, Vorlagen-Diff, „wartet auf euch“, Wert-Konto-Zeilen,
//        Bausteine der Knoten (Titel, Marken), Stakeholder-Namen aus der Kartei (Lese-Protokoll „fulfillment“), Rituale, nächste Termine;
//        seit 12.10. auch `reports` (erstellte Fortschritts-Reports: Kennung + Zeit), `followups` (am Mandat: Text, Tag, Stand), `analyse` (was aus
//        der Diagnose noch nicht im Fall steht) und `nachsorge` (Plan ab Mandatsende) — nur lesen.
//      ?m=&willkommen=1 → Grundlage der Willkommensmail (Vorlage der Bibliothek, Empfänger, Du/Sie, drei freie Kick-off-Zeiten — nur Zeiten).
//      ?m=&nachricht=<Knoten> → Entwurf einer Nachricht des Ablaufs (17.10. abends, Ausführung): Mail-Baustein des Knotens mit gefüllten Platzhaltern,
//        Empfänger = erste Ansprechperson mit Adresse; Art. 18 bzw. Werbesperre → kein Entwurf, nur `gesperrt`. Gesendet wird nur per Klick (Inbox).
//      Seit 17.10. abends trägt die Antwort `ablauf` (Stand der Ausführung je Knoten: dran, Runde, Frist, Aufgabe und ihr Stand).
// POST { aktion: 'starten', mandatId, vorlageId, start?, anfrageId }  → Fall anlegen (Kopie der Paket-Vorlage), idempotent über anfrageId; ein Zusatzmodul
//        (17.10. spät, `zusatz`) hängt an einen laufenden Fall an (Antwort `angehaengt: true`) bzw. startet ohne Onboarding
//      { aktion: 'vorlage-uebernehmen', mandatId, vorlageId? }        → neue Fassung der Vorlage (bzw. eines angehängten Zusatzmoduls) übernehmen (nie entfernen)
//      { aktion: 'nachziehen', mandatId }                             → Phase/Lieferobjekte noch einmal nachziehen (idempotent)
// PATCH { mandatId, ops }  → Ops (lib/fulfillment/prozesse/fall.ts `fallAnwenden` + `ziel-neu` in fall-server.ts), Stand je Eintrag (409).
//        Ops: knoten-status { id, status?, grund?, faelligAm?, am?, stand? } · knoten-extra { eintrag | id+weg } · freigabe { id, kunde?: { wie, am },
//        notiz?, am?, zuruecknehmen? } · vereinbarung { felder, stand? } · stakeholder { eintrag | id+weg } · entscheidung { eintrag (+ am?) | id+weg } ·
//        ritual-merken { ritualId, terminUid } · mitschrift { eintrag | id+weg } · quickwins-setzen { quickWins: [{ text, bis?, quelle? }] } ·
//        quickwin { id, erledigt?, am?, bis?, weg? } · kickoff-fragen { fragen: [{ frage, an?, warum?, quelle? }] } · kickoff-frage { id, erledigt?, weg? } ·
//        wert-ziel { zielId, felder: { ausgang?, ausgangZahl?, zielZahl?, einheit?, richtung?, zielBis?, festlegen? } } · ziel-neu { text, ziel?, felder? } ·
//        wert-messung { zielId, wert, am?, weg? } · befaehigung { id?, text?, erfuellt?, am?, weg? } · willkommen-gesendet { zuruecknehmen? } ·
//        (12.10.: `am` = nachtragen, was schon passiert ist — ein Tag, nie in der Zukunft; ohne `am` gilt heute.)
//        fall-status { status } · onboarding-aus { aus } (ohne Fall: Karte „Kundenonboarding starten“ ausblenden) ·
//        antwort { id, antwort: 'ja'|'nein', am?, stand? } (17.10. abends: Entscheidung im Ablauf — „nein“ startet ihre Erinnerung).
// Nur per Sitzung (Dienstweg 403), Bau-Kennung, nur Mandate von Business-Gesellschaften. Wirkung nach außen: keine (Mails gehen per Klick
// über /api/inbox/senden, danach `willkommen-gesendet`).

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';
import { fulfillmentAendern, fulfillmentLesen, eintragStand } from '@/lib/fulfillment/speicher';
import { fallUmfeld, ableitungFuer, fallSchreiben, fallStartenOderAnhaengen, fallVorlageUebernehmen, fallNachziehen, FallFehler } from '@/lib/fulfillment/prozesse/fall-server';
import { fallWirksam, onboardingStand, willkommenVorlage, vorschlagText, istKickoff } from '@/lib/fulfillment/prozesse/onboarding';
import { vorlagenDiff, zusatzDiff, fallFreigaben } from '@/lib/fulfillment/prozesse/fall';
import { vorlagenAnwenden } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { nurIntern, rechtOffen, vorVerkaufOffen } from '@/lib/fulfillment/prozesse/bausteine';
import { naechsterTermin } from '@/lib/fulfillment/prozesse/rituale';
import { wartetAufEuch, wertKontoZeilen, aktuellerKnoten, fallFortschritt, unterschriftAm } from '@/lib/fulfillment/regeln';
import { MANDAT_ID } from '@/lib/fulfillment/grenzen';
import { MUSTER_FREIGABEN } from '@/lib/fulfillment/muster';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { einmalig } from '@/lib/store/anfragen';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { mandatZieleLesen } from '@/lib/crm/mandat-ziele';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehlerAntwort = (e: unknown) => {
  if (e instanceof FallFehler) return NextResponse.json({ ok: false, fehler: e.message, ...((e as FallFehler & { konflikte?: unknown }).konflikte ? { konflikte: (e as FallFehler & { konflikte?: unknown }).konflikte } : {}) }, { status: e.status });
  throw e;
};

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  const url = new URL(req.url);
  const m = url.searchParams.get('m') ?? '';
  if (!MANDAT_ID.test(m)) return NextResponse.json({ ok: false, fehler: 'Mandat fehlt (?m=).' }, { status: 400 });
  const jetzt = new Date(), iso = jetzt.toISOString(), heute = localDay(jetzt);
  const { crm, vorlagen, faelle, kunde, termine: kalender } = await fallUmfeld([m]);
  const { istBusinessMandat } = await import('@/lib/fulfillment/regeln');
  // Prüf-Fund 11.10.: Mandate einer Privat-Einheit (z. B. die Selbstständigkeit) gibt es hier nicht — 404 VOR jedem Aufbau, derselbe Satz wie „fehlt“.
  const mandat = crm.mandate.find(x => x.id === m && !x.geloeschtAm && istBusinessMandat(x.gesellschaft));
  if (!mandat) return NextResponse.json({ ok: false, fehler: 'Dieses Mandat gibt es nicht (mehr).' }, { status: 404 });
  const mandatKurz = { id: mandat.id, titel: mandat.titel, kunde: mandat.kunde, firmaId: mandat.firmaId ?? null, kontaktIds: mandat.kontaktIds, leistungId: mandat.leistungId ?? null, ziele: mandatZieleLesen(mandat.ziele), gesellschaft: mandat.gesellschaft, status: mandat.status, start: mandat.start ?? null, zustaendig: mandat.zustaendig ?? null, business: true };
  const f = faelle.faelle[m];
  const u = unterschriftAm(mandat, crm, f?.gestartetAm);
  // Lese-Protokoll immer, wenn Firma/Kontakte des Mandats ausgeliefert werden (Prüf-Fund 11.10.: vorher nur mit Stakeholdern).
  if (!f) { leseZugriff(req, 'fulfillment', { ids: [mandat.id], anzahl: mandat.kontaktIds.length }); return NextResponse.json({ ok: true, fall: null, mandat: mandatKurz, unterschrift: u, inhaber: await istInhaber(z.person) }); }

  const nachricht = url.searchParams.get('nachricht');
  if (nachricht) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(nachricht)) return NextResponse.json({ ok: false, fehler: 'Schritt fehlt.' }, { status: 400 });
    const w0 = fallWirksam(f, ableitungFuer(f, mandat, crm, vorlagen, kunde[m], iso, kalender[m]));
    const { nachrichtGrundlage } = await import('@/lib/fulfillment/prozesse/ausfuehrung-server');
    const g = await nachrichtGrundlage({ h: z.haushalt, crm, vorlagen, faelle, kunde, termine: kalender }, w0, mandat, nachricht, z.person, heute);
    leseZugriff(req, 'fulfillment', { anzahl: g.ok && g.entwurf?.an ? 1 : 0 });
    return g.ok ? NextResponse.json(g) : NextResponse.json({ ok: false, fehler: g.fehler }, { status: g.status });
  }

  if (url.searchParams.get('willkommen') === '1') {
    // Empfänger: erste Ansprechperson des Mandats mit Adresse, die verarbeitet werden darf (Art. 18 fehlt ganz) — Du/Sie aus ihrer Akte.
    const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
    const kontakte = await kontakteFuerVerarbeitung();
    const entscheider = f.stakeholder.filter(s => s.rolle === 'entscheider').map(s => s.kontaktId);
    const k = [...entscheider, ...mandat.kontaktIds].map(id => kontakte.find(x => x.id === id)).find(x => !!x?.email);
    const anrede = k?.anrede === 'Du' ? 'Du' : 'Sie';
    const vorlage = willkommenVorlage(vorlagen.bausteine, anrede);
    const kickoff = vorlagen.rituale.find(istKickoff);
    let vorschlaege: string[] = [];
    try {
      const { freieZeitFuer } = await import('@/lib/kalender/freie-zeit');
      // Drei Termine an drei verschiedenen Tagen (Gesamtprüfung 12.10.): vorher füllten die ersten zwei Tage die Grenze von 30 Plätzen,
      // nach dem Filter „ein Platz je Tag“ blieben nur zwei Vorschläge. Jetzt begrenzt die Suche selbst je Tag (`maxJeTag`).
      const r = await freieZeitFuer({ personen: [z.person], dauerMin: kickoff?.dauerMin ?? 90, von: localDay(new Date(Date.now() + 86_400_000)), tage: 10, vorlaufMin: 0, rasterMin: 30, grenze: 3, maxJeTag: 1 });
      vorschlaege = r.vorschlaege.slice(0, 3).map(x => vorschlagText(x.start, x.ende));
    } catch { vorschlaege = []; }
    leseZugriff(req, 'fulfillment', { anzahl: k ? 1 : 0 });
    // Absender unter dem Gruß (18.10., C7): der Vorname der Person, die gerade vorbereitet (Konto, `vornameVon`) — nie ein fester Name.
    const { vornameVon } = await import('@/lib/zoe/grundauftrag');
    const absender = await vornameVon(z.person);
    return NextResponse.json({
      ok: true, anrede, vorlage: vorlage ? { id: vorlage.id, titel: vorlage.titel, text: vorlage.text ?? '' } : null, absender,
      an: k?.email ? { email: k.email, kontaktId: k.id, ...(k.vorname || k.nachname ? { name: `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim() } : {}) } : null,
      ...(k?.vorname ? { vorname: k.vorname } : {}), ...(k?.nachname ? { nachname: k.nachname } : {}),
      ...(k ? {} : { ohneEmpfaenger: mandat.kontaktIds.length ? 'Keine Ansprechperson mit Mail-Adresse, die wir anschreiben dürfen (Adresse fehlt oder Verarbeitung eingeschränkt).' : 'Am Mandat ist keine Ansprechperson eingetragen.' }),
      vorschlaege, gesellschaft: mandat.gesellschaft, gesendetAm: f.onboarding.willkommenGesendetAm ?? null,
    });
  }

  const abl = ableitungFuer(f, mandat, crm, vorlagen, kunde[m], iso, kalender[m]);
  const w = fallWirksam(f, abl);
  const v = vorlagen.prozesse.find(p => p.id === f.vorlageId);
  // Abstimmungspunkte des Pakets UND der angehängten Zusatzmodule (17.10. spät) — EINE Stelle (`fallFreigaben`).
  const fg = v ? fallFreigaben(f, vorlagen.prozesse) : MUSTER_FREIGABEN;
  const ids = new Set(w.knoten.map(x => x.bausteinId).filter((x): x is string => !!x));
  const bausteine = vorlagen.bausteine.filter(b => ids.has(b.id)).map(b => ({ id: b.id, titel: b.titel, art: b.art, kundeFuellt: !!b.kundeFuellt, nurIntern: nurIntern(b), rechtOffen: rechtOffen(b), vorVerkaufOffen: vorVerkaufOffen(b, vorlagen), lieferobjekt: b.lieferobjekt ?? null }));
  // Stakeholder: Namen nur aus der Kartei (Art. 18: eingeschränkte erscheinen nur als Kennung, ohne Namen).
  const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
  const kontakte = await kontakteFuerVerarbeitung();
  const { personenDerFirma } = await import('@/lib/crm/stationen');
  // Wählbar sind Ansprechpersonen des Mandats und Personen der Firma (laufende Station) — eingeschränkte fehlen schon in `kontakteFuerVerarbeitung`.
  const personenIds = new Set([...w.stakeholder.map(s => s.kontaktId), ...mandat.kontaktIds, ...(mandat.firmaId ? personenDerFirma(kontakte, mandat.firmaId, { nurAktiv: true }).map(k => k.id) : [])]);
  const personen = kontakte.filter(k => personenIds.has(k.id)).map(k => ({ id: k.id, name: `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim() || k.email || 'Kontakt', position: k.position ?? null, email: k.email ?? null, firmaId: k.firmaId ?? null }));
  leseZugriff(req, 'fulfillment', { ids: [mandat.id], anzahl: personen.length });
  // Die Termine des Kunden — EINE Lesestelle (`fallTermine`, 15.10., Abnahme B3): mit Bezug zum Mandat bzw. zur Firma, auch ohne Ritual.
  const terminTage = kalender[m] ?? [];
  const { zuordnen } = await import('@/lib/fulfillment/prozesse/termine');
  const { montagVon } = await import('@/lib/zeit/kalender-kern');
  const treppe = await import('@/lib/crm/treppe-server').then(t => t.ladeTreppe(heute)).catch(() => null);
  // 12.10. (lose Enden): Report-Zeitachse (erstellte Reports aus der Dateiablage — nur Tag + Kennung), was aus der Diagnose noch nicht im Fall steht,
  // die Nachsorge als Plan (ab Mandatsende) und die Follow-ups am Mandat (Nachsorge, Puls-Gespräch, Empfehlung) — nur Text, Tag, Stand.
  const reports = await import('@/lib/dateien/ablage').then(a => a.ablageListe(z.haushalt)).then(l => l.filter(e => e.mandatId === m && e.bericht === 'fortschritt').map(e => ({ id: e.id, am: e.hochgeladenAm })).sort((a, b) => (a.am < b.am ? -1 : 1))).catch(() => []);
  const dossier = await fulfillmentLesen('dossiers', z.haushalt).then(d => d.dossiers[m]).catch(() => undefined);
  const { diagnoseUebergabe } = await import('@/lib/fulfillment/analyse/nach-fall');
  const ue = diagnoseUebergabe(dossier?.diagnose, w);
  const { nachsorgePlan } = await import('@/lib/fulfillment/prozesse/ansichten');
  const { mandatsEnde } = await import('@/lib/fulfillment/regeln');
  const ende = mandatsEnde(mandat);
  const followups = (crm.followups ?? []).filter(x => x.bezug?.art === 'mandat' && x.bezug.id === m).sort((a, b) => (a.faellig < b.faellig ? 1 : -1)).slice(0, 12)
    .map(x => ({ id: x.id, text: x.text, faellig: x.faellig, status: x.status }));
  return NextResponse.json({
    ok: true, inhaber: await istInhaber(z.person), mandat: mandatKurz, unterschrift: u,
    fall: { ...w, knoten: w.knoten.map(x => ({ ...x, stand: eintragStand(f.knoten.find(y => y.id === x.id) ?? x) })), stakeholder: w.stakeholder.map(s => ({ ...s, stand: eintragStand(s) })), entscheidungen: w.entscheidungen.map(e => ({ ...e, stand: eintragStand(e) })) },
    staende: { vereinbarung: eintragStand(f.vereinbarung ?? {}), wertKonto: Object.fromEntries(mandatZieleLesen(mandat.ziele).map(zl => [zl.id, eintragStand(f.wertKonto[zl.id] ?? { messungen: [] })])) },
    // Ohne Onboarding (aus einem Zusatzmodul gestartet, 17.10. spät): kein Onboarding-Stand — die Reise zeigt dann kein Band.
    ...(f.ohneOnboarding ? {} : { onboarding: onboardingStand(f, abl) }), diff: v ? vorlagenDiff(f, v) : null,
    // Alte Fälle ohne Formen (17.10. abends): die Ausführung startet erst mit „Vorlage übernehmen“ — der Fall zeigt dann einen Hinweis mit dem Weg dorthin.
    ausfuehrungWartet: v ? await import('@/lib/fulfillment/prozesse/ausfuehrung').then(a => a.ausfuehrungNachUebernahme(w, v, vorlagenDiff(f, v))) : false,
    vorlage: v ? { id: v.id, titel: v.titel, fassung: v.fassung, freigaben: fg, rollen: v.rollen, ...(v.zusatz ? { zusatz: true } : {}) } : { id: f.vorlageId, titel: 'Vorlage entfernt', fassung: f.vorlageFassung, freigaben: MUSTER_FREIGABEN, rollen: [] },
    // Angehängte Zusatzmodule (17.10. spät): je Modul Titel, Starttag und — bei neuer Fassung — der Diff („Vorlage geändert — übernehmen?“).
    zusaetze: (f.zusaetze ?? []).map(z => { const zv = vorlagen.prozesse.find(p => p.id === z.vorlageId); return { vorlageId: z.vorlageId, titel: zv?.titel ?? z.titel, startAm: z.startAm, fassung: z.vorlageFassung, diff: zv ? zusatzDiff(f, zv) : null }; }),
    wartet: wartetAufEuch(w, heute), wertKonto: wertKontoZeilen(w, mandat), fortschritt: fallFortschritt(w), aktuell: aktuellerKnoten(w),
    bausteine, personen, rituale: vorlagen.rituale,
    termine: Object.fromEntries(w.rituale.map(r => [r.ritualId, naechsterTermin(terminTage, r.terminUids, heute) ?? null])),
    // Takt (15.10., Abnahme B3): alle Termine mit dem Kunden ab dem Montag dieser Woche (auch die schon gelaufenen) — je mit Ritual, wenn er an einem hängt.
    kalender: zuordnen(terminTage.filter(t => t.tag >= montagVon(heute)), w.rituale),
    // Was der Kunde als Nächstes liest (15.10., Abnahme B1) — derselbe Punkt, wenn er geteilt ist (`gleich`); sonst der nächste geteilte (der Fall-Kopf erklärt es).
    kundeNaechster: await (async () => {
      const [{ kundenTeile, kundenNaechsterPunkt }, { kundenGesperrt }] = await Promise.all([import('@/lib/fulfillment/kunde/bild'), import('@/lib/fulfillment/prozesse/bausteine')]);
      const gesperrt = kundenGesperrt(vorlagen.bausteine, vorlagen);
      const np = kundenNaechsterPunkt(w, v ? fg : [], gesperrt, heute);
      const text = kundenTeile({ fall: w, mandat, heute, anrede: 'sie', gesperrt, ...(v ? { freigaben: fg } : {}) }).naechstes[0] ?? null;
      return { text, gleich: !!np?.text && !np.anzeigeId, wartet: np?.punkt.zustand === 'wartet_kunde' };
    })(),
    kunde: kunde[m] ?? null, report: treppe?.reports[m] ?? null,
    reports, followups,
    analyse: dossier ? { f2: !!dossier.f2, diagnose: !!dossier.diagnose, quickWins: ue.quickWins, fragen: ue.fragen.length, massnahmen: ue.massnahmen.map(x => x.text), ziel: ue.ziel?.titel ?? null } : null,
    nachsorge: { ende, plan: nachsorgePlan({ mandatId: m, ende, tage: vorlagen.einstellungen.nachsorgeTage, marken: f.marken, heute }) },
    // Ausführung der Abläufe (17.10. abends): je Knoten mit Form — dran, Runde, Frist, Aufgabe und ihr Stand (über die Sicht der Person).
    ablauf: await import('@/lib/fulfillment/prozesse/ausfuehrung-server').then(a => a.ablaufAnsicht(w, heute, z.person)).catch(() => ({ aktiv: false, knoten: {} })),
  });
}

export async function POST(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const wer = werAus(req);
  try {
    if (b.aktion === 'starten') {
      const r = await einmalig<Record<string, unknown>>('fulfillment-starten', b.anfrageId, async () => {
        try {
          const { fall, art } = await fallStartenOderAnhaengen({ mandatId: b.mandatId, vorlageId: b.vorlageId, start: b.start, person: z.person, wer });
          const text = art === 'angehaengt' ? 'Zusatzmodul an den laufenden Fall angehängt — ohne zweites Onboarding.' : fall.ohneOnboarding ? 'Fall angelegt — das Zusatzmodul läuft ohne Onboarding.' : 'Fall angelegt — Onboarding beginnt.';
          return { status: 200, body: { ok: true, fall, text, ...(art === 'angehaengt' ? { angehaengt: true } : {}) } };
        } catch (e) { if (e instanceof FallFehler) return { status: e.status, body: { ok: false, fehler: e.message } }; throw e; }
      }, undefined, { wer: z.person });
      return NextResponse.json(r.body, { status: r.status });
    }
    if (b.aktion === 'vorlage-uebernehmen') return NextResponse.json({ ok: true, fall: await fallVorlageUebernehmen(b.mandatId, z.person, wer, new Date(), b.vorlageId) });
    if (b.aktion === 'nachziehen') return NextResponse.json({ ok: true, nachzug: await fallNachziehen(b.mandatId, z.person, wer) });
    return NextResponse.json({ ok: false, fehler: 'aktion: starten, vorlage-uebernehmen oder nachziehen.' }, { status: 400 });
  } catch (e) { return fehlerAntwort(e); }
}

export async function PATCH(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: { mandatId?: unknown; ops?: unknown };
  try { b = await jsonBegrenzt(req, 512 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const wer = werAus(req);
  const ops = Array.isArray(b.ops) ? b.ops : [];
  // Ohne Fall gibt es nur „Karte ausblenden“ (Marke im Vorlagen-Bestand).
  const aus = ops.find(o => o && typeof o === 'object' && (o as { op?: unknown }).op === 'onboarding-aus') as { aus?: unknown } | undefined;
  if (aus) {
    if (ops.length > 1) return NextResponse.json({ ok: false, fehler: '„onboarding-aus“ steht allein.' }, { status: 400 });
    if (typeof b.mandatId !== 'string' || !MANDAT_ID.test(b.mandatId)) return NextResponse.json({ ok: false, fehler: 'Mandat fehlt.' }, { status: 400 });
    const faelle = await fulfillmentLesen('faelle', z.haushalt);
    if (faelle.faelle[b.mandatId]) return NextResponse.json({ ok: false, fehler: 'Für dieses Mandat läuft schon ein Fall.' }, { status: 409 });
    const jetzt = new Date();
    const r = await fulfillmentAendern('vorlagen', d => vorlagenAnwenden(d, [{ op: 'onboarding-aus', mandatId: b.mandatId, aus: aus.aus !== false }], {
      person: z.person, jetzt: jetzt.toISOString(), heute: localDay(jetzt), standVon: eintragStand, neueId: p => neueKennung(p),
    }), wer, z.haushalt);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
  }
  try {
    const r = await fallSchreiben(b.mandatId, ops, z.person, wer);
    return NextResponse.json({ ok: true, fall: r.fall, geaendert: r.geaendert, nachzug: r.nachzug, stand: eintragStand(r.fall) });
  } catch (e) { return fehlerAntwort(e); }
}
