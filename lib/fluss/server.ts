// ─── Überblick „Für dich“ — Reihen serverseitig laden und filtern (04.10.2026 abends) ─
// EINE Stelle, die liest (nie schreibt, nie ein Netzaufruf): je Bereich die vorhandene Lesefunktion, die vorhandene Sicht-Regel
// und dann die reine Reihe aus lib/fluss/bereiche.ts. Plattform-Regel (Kevin 04.10.: „Trennung serverseitig, nie nur
// versteckt“): die Antwort enthält nur, was die Sicht sehen darf —
//   · Person aus der Sitzung (Route), nie ein Rückfall; Haushalt des Inhabers (`haushaltDesInhabers`).
//   · Privat nie im Business: Finanzen Business nur Gesellschaften (`istGesellschaft`, `ohnePrivat`), Privat nur Einheit
//     `privat`; Planung mit `space` nur Ziele/Meilensteine dieses Space.
//   · „nur ich“ nie bei der anderen Person: Aufgaben über `ladeAufgabenSicht(person)` (`sichtFuer`/`nurIchBesitzer`),
//     Familie über `sichtFuer`, eigene Ziele der anderen Person fallen weg, Kalender über `termineFuerZoe` (maskiert) und nur
//     eigene/gemeinsame Termine, Gesundheit nur die eigene Person, Inbox nur das eigene Postfach.
// Wächter: tests/fluss.test.ts (je Bereich „Sicht X bekommt nichts aus Y“).

import { loadJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { WEG } from '@/lib/wege';
import type { SpaceId } from '@/lib/make-one/space-regeln';
import { OFFENE_STUFEN, gesamtwert, wahrscheinlichkeit } from '@/lib/crm/pipeline';
import type { CrmBestand } from '@/lib/crm/typen';
import type { FlussBereich, FlussReihe } from './modell';
import {
  flussAufgaben, flussFamilie, flussFinanzenBusiness, flussFinanzenPrivat, flussGesundheit, flussInbox, flussKalender, flussMarkttraktion,
  flussNetzwerken, flussPlanung, type BekannteAusgabe, type MomentPunkt, type PlanPunkt,
} from './bereiche';

const BEIDE = 'beide';
const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const monatPlus = (d: string, n: number) => { const x = new Date(`${d.slice(0, 7)}-01T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const tag = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
/** Fenster der Reihen: 13 Wochen bzw. 3 Monate zurück und voraus (mit Rand). */
const ZURUECK = 100, VORAUS = 100;

export interface FlussAnfrage { bereich: FlussBereich; person: string; heute: string; space?: SpaceId | null }

/** Die Reihe eines Bereichs für eine Person — null, wenn der Bereich keine Daten hat bzw. die Person nicht im Haushalt ist. */
export async function flussLaden(a: FlussAnfrage): Promise<FlussReihe | null> {
  switch (a.bereich) {
    case 'markttraktion': return markttraktion(a.heute);
    case 'finanzen-privat': return finanzenPrivat(a.heute);
    case 'finanzen-business': return finanzenBusiness(a.heute);
    case 'planung': return planung(a.person, a.heute, a.space ?? null);
    case 'aufgaben': return aufgaben(a.person, a.heute);
    case 'kalender': return kalender(a.person, a.heute);
    case 'gesundheit': return gesundheit(a.person, a.heute);
    case 'familie': return familie(a.person, a.heute);
    case 'netzwerken': return netzwerken(a.heute);
    case 'inbox': return inbox(a.person, a.heute);
  }
}

// ── Markttraktion (Haushalt, Business) ───────────────────────────────────────
async function markttraktion(heute: string): Promise<FlussReihe> {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  return flussAusCrm(await ladeCrm(), heute);
}
/** Der Fluss der Markttraktion aus dem schon geladenen CRM-Bestand (auch für GET /api/crm/traktion — kein zweites Laden). */
export function flussAusCrm(crm: Pick<CrmBestand, 'chancen' | 'wahrscheinlichkeiten'>, heute: string): FlussReihe {
  return flussMarkttraktion({
    heute,
    deals: crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe) || c.stufe === 'gewonnen').map(c => {
      const wert = gesamtwert(c);
      // Gewonnen am: der letzte Stufenwechsel auf „gewonnen“ (dieselbe Regel wie `winRate`), sonst die letzte Änderung.
      const gewonnenAm = c.stufe === 'gewonnen' ? tag(c.historie.filter(h => h.stufe === 'gewonnen').pop()?.am ?? c.geaendert) : null;
      return {
        id: c.id, titel: c.titel, wert, gewichtet: Math.round(wert * wahrscheinlichkeit(c.stufe, crm.wahrscheinlichkeiten) / 100), stufe: c.stufe,
        erwartetAm: tag(c.erwartetAm), gewonnenAm, offen: OFFENE_STUFEN.includes(c.stufe), link: WEG.deal(c.id),
      };
    }),
  });
}

// ── Finanzen ─────────────────────────────────────────────────────────────────
async function finanzenPrivat(heute: string): Promise<FlussReihe | null> {
  const h = await haushaltDesInhabers();
  if (!h) return null;
  const [{ ladeHaushalt }, { wiederkehrend }, { katNamen }] = await Promise.all([
    import('@/lib/finanzen/haushalt/speicher'), import('@/lib/finanzen/haushalt/fixkosten'), import('@/lib/finanzen/haushalt/einordnung'),
  ]);
  const hh = await ladeHaushalt(h);
  // NUR die Einheit „privat“ — Firmen-Buchungen derselben Datei gehören ins Business.
  const privat = hh.buchungen.filter(b => b.einheit === 'privat' && !b.ist_umbuchung);
  const ausgaben = privat.filter(b => b.betrag < 0 && b.datum >= tagPlus(heute, -ZURUECK)).map(b => ({ tag: b.datum, wert: -b.betrag / 100 }));
  const bis = monatPlus(heute, 4);
  const bekannt: BekannteAusgabe[] = [];
  for (const s of hh.schulden) {
    const ab = tag(s.naechste_faelligkeit);
    if (s.einheit !== 'privat' || !s.rate || !ab) continue;
    // Monatlich ab der nächsten Fälligkeit bis zum Ende (Tag im Monat höchstens 28 — jeder Monat hat ihn).
    const tagImMonat = String(Math.min(28, Number(ab.slice(8, 10)))).padStart(2, '0');
    for (let i = 0; i < 6; i++) {
      const d = `${monatPlus(ab, i).slice(0, 7)}-${tagImMonat}`;
      if (d >= bis || (s.endet_am && d > s.endet_am)) break;
      bekannt.push({ titel: s.bezeichnung || 'Rate', tag: d, wert: s.rate / 100, art: 'rate' });
    }
  }
  for (const b of hh.belege) {
    if (b.einheit !== 'privat' || b.erledigt || b.art !== 'rechnung' || !b.betrag || !tag(b.faellig_am)) continue;
    bekannt.push({ titel: b.bezeichnung, tag: b.faellig_am!.slice(0, 10), wert: b.betrag / 100, art: 'rechnung' });
  }
  // Feste Kosten: erkannte Rhythmen der eigenen Buchungen (≥ 3 Treffer, Schwankung ≤ 20 %) — je Monat ihr Monatsbetrag.
  for (const w of wiederkehrend(privat, katNamen(hh.stamm), heute).filter(x => !x.unsicher && x.proMonat > 0)) {
    for (let m = 0; m < 4; m++) bekannt.push({ titel: w.name, tag: `${monatPlus(heute, m).slice(0, 7)}-15`, wert: w.proMonat / 100, art: 'fix' });
  }
  return flussFinanzenPrivat({ heute, ausgaben, bekannt, link: WEG.privat() });
}

async function finanzenBusiness(heute: string): Promise<FlussReihe> {
  const [{ vorschau, nurBusiness }, { istGesellschaft }] = await Promise.all([import('@/lib/make-one/liquiditaet'), import('@/lib/einheiten')]);
  type Plan = { firmen?: Parameters<typeof vorschau>[0]; rechnungen?: Parameters<typeof vorschau>[1]; zahlungen?: Parameters<typeof vorschau>[2]; merkposten?: Parameters<typeof vorschau>[3] };
  const [plan, liqui, buch] = await Promise.all([
    loadJson<Plan>('finanzplan').catch(() => null),
    loadJson<{ posten?: Parameters<typeof vorschau>[7] }>('liquiplan').catch(() => null),
    loadJson<{ buchungen?: { datum?: string; betrag?: number; ort?: string }[] }>('buchungen').catch(() => null),
  ]);
  // Nur Gesellschaften — eine Buchung ohne `ort` ist privat und gehört nie ins Business.
  const saldo = (buch?.buchungen ?? []).filter(b => istGesellschaft(b.ort) && tag(b.datum) && Number.isFinite(b.betrag)).map(b => ({ tag: b.datum!, wert: b.betrag! }));
  const v = plan ? vorschau(plan.firmen ?? [], plan.rechnungen ?? [], plan.zahlungen ?? [], plan.merkposten ?? [], heute, 13, false, liqui?.posten ?? [], 'real', undefined, true) : null;
  const rechnungen = nurBusiness((plan?.rechnungen ?? []) as (Parameters<typeof vorschau>[1][number] & { firmaId?: string })[]).filter(r => r.status !== 'bezahlt' && r.status !== 'storniert' && r.betrag > 0 && tag(r.faellig));
  const zahlungen = nurBusiness(plan?.zahlungen ?? []).filter(z => z.status === 'offen' && tag(z.faellig));
  return flussFinanzenBusiness({
    heute, saldo, link: WEG.liquiditaet(),
    vorschau: (v?.wochen ?? []).map(w => ({ tag: w.von, wert: Math.round(w.eingang - w.ausgang) })),
    faellig: [
      ...rechnungen.map(r => ({ id: `r:${r.id}`, titel: r.titel, tag: r.faellig!.slice(0, 10), wert: r.betrag, eingang: true })),
      ...zahlungen.map(z => ({ id: `z:${z.id}`, titel: z.titel, tag: z.faellig!.slice(0, 10), wert: z.betrag, eingang: false })),
    ].filter(f => f.tag <= tagPlus(heute, 30)),
  });
}

// ── Planung ──────────────────────────────────────────────────────────────────
async function planung(person: string, heute: string, space: SpaceId | null): Promise<FlussReihe> {
  const [{ haushaltsZiele }, { meilensteinSpace }, { zielVonMeilenstein }, { spaceVonZiel, zielWurzeln }] = await Promise.all([
    import('@/lib/planung/ziel-farben-server'), import('@/lib/planung/meilensteine'), import('@/lib/planung/meilenstein-aufgaben'), import('@/lib/lichtfaeden/modell'),
  ]);
  const [ziele, ms] = await Promise.all([haushaltsZiele(), loadJson<{ meilensteine?: import('@/lib/planung/typen').Meilenstein[] }>('meilensteine').catch(() => null)]);
  // Eigene Ziele der ANDEREN Person gibt es für diese Person nicht (wie Lichtfäden `knotenFuerBetrachter`) — samt ihrer Meilensteine.
  const sichtbar = ziele.filter(z => z.person === BEIDE || z.person === person);
  const fremd = new Set(ziele.filter(z => !sichtbar.includes(z)).map(z => z.id));
  const wurzel = zielWurzeln(ziele);
  const zielSpace = new Map(ziele.map(z => [z.id, spaceVonZiel(z)]));
  const imSpace = (s: SpaceId) => !space || s === space;
  const punkte: PlanPunkt[] = [];
  for (const z of sichtbar) {
    if (!z.termin || z.abgeleitetVon || !imSpace(spaceVonZiel(z))) continue;
    punkte.push({ id: `ziel:${z.id}`, titel: z.titel, art: 'ziel', faellig: z.termin, erledigt: !!z.erledigt, erledigtAm: z.erledigtAm ?? null, link: WEG.ziel(z.id) });
  }
  for (const m of ms?.meilensteine ?? []) {
    const zid = zielVonMeilenstein(m);
    if (zid && (fremd.has(zid) || fremd.has(wurzel.get(zid) ?? ''))) continue;
    if (!imSpace(meilensteinSpace(m)) || (zid && zielSpace.has(zid) && !imSpace(zielSpace.get(zid)!) && !m.space)) continue;
    punkte.push({ id: `ms:${m.id}`, titel: m.titel, art: 'meilenstein', faellig: m.faellig ?? null, erledigt: !!m.erledigt, erledigtAm: m.erledigtAm ?? null, link: WEG.meilenstein(m.id) });
  }
  return flussPlanung({ heute, punkte });
}

// ── Aufgaben ─────────────────────────────────────────────────────────────────
async function aufgaben(person: string, heute: string): Promise<FlussReihe> {
  const { ladeAufgabenSicht } = await import('@/lib/aufgaben/sicht');
  // Die Sicht DIESER Person: fremde „nur ich“ (samt Unteraufgaben) sind schon heraus, Papierkorb auch.
  const s = await ladeAufgabenSicht(person);
  return flussAufgaben({
    heute, link: WEG.aufgaben(),
    aufgaben: s.tasks.filter(t => t.status !== 'cancelled').map(t => ({
      id: t.id, titel: t.title, erledigt: t.status === 'done', faellig: tag(t.dueDate), erledigtAm: tag(t.completedAt ?? (t.status === 'done' ? t.updatedAt : null)),
    })),
  });
}

// ── Kalender ─────────────────────────────────────────────────────────────────
async function kalender(person: string, heute: string): Promise<FlussReihe> {
  const { termineFuerZoe } = await import('@/lib/kalender/zoe-sicht-server');
  const k = await termineFuerZoe(person, tagPlus(heute, -ZURUECK), tagPlus(heute, VORAUS));
  // Nur eigene und gemeinsame Termine — „Belegt“ der anderen Person ist ihre Zeit, nicht meine.
  const meine = [...k.termine, ...k.kemaris].filter(t => !t.maskiert && (!t.wer || t.wer === person || t.wer === BEIDE));
  return flussKalender({ heute, link: WEG.kalender(), termine: meine.map(t => ({ id: t.id, titel: t.titel, start: t.start, ende: t.ende, ganztags: t.ganztags })) });
}

// ── Gesundheit (nur die eigene Person) ───────────────────────────────────────
async function gesundheit(person: string, heute: string): Promise<FlussReihe> {
  const { sichtbarFuer } = await import('@/lib/planung/routinen');
  type Sport = Partial<Pick<import('@/lib/sport/modell').SportStand, 'hyrox' | 'laeufe' | 'gym' | 'woche' | 'planStart' | 'ziele' | 'einstieg'>>;
  const [sport, r] = await Promise.all([
    loadJson<Sport>(speicherFuer('sport', person)).catch(() => null),
    loadJson<import('@/lib/planung/typen').RoutinenDatei>('routinen').catch(() => null),
  ]);
  const einheiten = [...(sport?.hyrox ?? []), ...(sport?.laeufe ?? []), ...(sport?.gym?.einheiten ?? [])].map(e => tag(e.datum)).filter((t): t is string => !!t);
  const planJeWoche = sport?.einstieg?.fertig && sport.woche ? Object.values(sport.woche).filter(p => p && p.art !== 'ruhe' && p.art !== 'frei').length : 0;
  const routinen = sichtbarFuer(r?.routinen ?? [], person).filter(x => x.aktiv && x.kategorie === 'gesundheit' && tag(x.naechstesMal));
  return flussGesundheit({
    heute, planJeWoche, planAb: tag(sport?.planStart), link: WEG.gesundheit(),
    einheiten,
    termine: [
      ...(sport?.ziele ?? []).filter(z => tag(z.datum) && !z.erledigt).map(z => ({ id: `sport:${z.id}`, titel: z.titel, tag: z.datum!.slice(0, 10) })),
      ...routinen.map(x => ({ id: `routine:${x.id}`, titel: x.label, tag: x.naechstesMal!.slice(0, 10) })),
    ],
  });
}

// ── Familie ──────────────────────────────────────────────────────────────────
async function familie(person: string, heute: string): Promise<FlussReihe | null> {
  const h = await haushaltDesInhabers();
  if (!h) return null;
  const [{ familieName }, { sichtFuer, naechstes }] = await Promise.all([import('@/lib/familie/speicher'), import('@/lib/familie/logik')]);
  // Nur lesen (ladeFamilie legte bei fehlender Datei einen Start-Bestand an); „nur ich“ der anderen Person fällt über `sichtFuer` heraus.
  const f = await loadJson<import('@/lib/familie/typen').Familie>(familieName(h)).catch(() => null);
  if (!f) return flussFamilie({ heute, gewesen: [], geplant: [] });
  const gewesen: MomentPunkt[] = [
    ...sichtFuer(f.dates ?? [], person).filter(d => d.status === 'stattgefunden').map(d => ({ id: `date:${d.id}`, titel: d.titel, tag: d.datum, art: 'date' as const })),
    ...sichtFuer(f.gespraeche ?? [], person).filter(g => g.status === 'gehalten').map(g => ({ id: `gespraech:${g.id}`, titel: 'Paar-Gespräch', tag: g.datum, art: 'gespraech' as const })),
    ...sichtFuer(f.wertschaetzungen ?? [], person).map(w => ({ id: `ws:${w.id}`, titel: 'Wertschätzung', tag: w.datum, art: 'wertschaetzung' as const })),
  ].filter(m => tag(m.tag));
  const geplant: MomentPunkt[] = [
    ...sichtFuer(f.dates ?? [], person).filter(d => d.status === 'geplant').map(d => ({ id: `date:${d.id}`, titel: d.titel, tag: d.datum, art: 'date' as const })),
    ...sichtFuer(f.gespraeche ?? [], person).filter(g => g.status === 'geplant').map(g => ({ id: `gespraech:${g.id}`, titel: 'Paar-Gespräch', tag: g.datum, art: 'gespraech' as const })),
    ...sichtFuer(f.vereinbarungen ?? [], person).filter(v => v.status === 'offen' && v.faellig).map(v => ({ id: `v:${v.id}`, titel: v.text, tag: v.faellig!, art: 'vereinbarung' as const })),
    ...sichtFuer(f.tage ?? [], person).map(t => ({ id: `tag:${t.id}`, titel: t.titel, tag: naechstes(t.datum, heute) ?? '', art: 'tag' as const })),
  ].filter(m => tag(m.tag) && m.tag <= tagPlus(heute, VORAUS));
  return flussFamilie({ heute, gewesen, geplant, link: '/os/familie' });
}

// ── Netzwerken (Haushalt, Business) ──────────────────────────────────────────
async function netzwerken(heute: string): Promise<FlussReihe> {
  const [{ ladeCrm }, { kontakteFuerVerarbeitung }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/verarbeitung')]);
  const crm = await ladeCrm();
  // Eingeschränkte Kontakte (Art. 18) zählen mit, erscheinen aber nie mit Namen.
  const kontakte = new Map((await kontakteFuerVerarbeitung().catch(() => [])).map(k => [k.id, k]));
  const erfasst = crm.teilnahmen.filter(t => t.netzwerken && tag(t.netzwerken.erfasstAm)).map(t => t.netzwerken!.erfasstAm.slice(0, 10));
  const nachfassen = crm.teilnahmen.filter(t => t.netzwerken && tag(t.followUpAm) && !t.nachfassenVerzichtet).map(t => {
    const k = kontakte.get(t.kontaktId);
    return { id: `nf:${t.id}`, titel: k ? [k.vorname, k.nachname].filter(Boolean).join(' ') || 'Kontakt' : 'Kontakt', tag: t.followUpAm!.slice(0, 10) };
  });
  return flussNetzwerken({ heute, erfasst, nachfassen, link: WEG.netzwerken() });
}

// ── Inbox (nur das eigene Postfach) ──────────────────────────────────────────
async function inbox(person: string, heute: string): Promise<FlussReihe> {
  const [{ ladeGmailStand }] = await Promise.all([import('@/lib/gmail/stand')]);
  const g = await ladeGmailStand(person).catch(() => null);
  const koepfe = Object.values(g?.koepfe ?? {});
  const eingang = koepfe.filter(k => k.labels.includes('INBOX')).map(k => tag(k.am)).filter((t): t is string => !!t);
  // Wiedervorlagen: der Status-Bestand ist EIN Bestand für alle — gezählt wird nur, was zu Nachrichten DIESES Postfachs gehört.
  const status = await loadJson<Record<string, { status?: string; bis?: string }>>('inbox-status').catch(() => null);
  // Schlüssel der Inbox-Zeilen: `gmail-<Thread>` (components/os/InboxSchlank.tsx).
  const eigene = new Set(koepfe.flatMap(k => [`gmail-${k.threadId}`, `gmail-${k.id}`]));
  const wiedervorlagen = Object.entries(status ?? {}).filter(([id, s]) => eigene.has(id) && s?.status === 'snoozed' && tag(s.bis)).map(([, s]) => s.bis!.slice(0, 10));
  const offen = koepfe.filter(k => k.labels.includes('INBOX') && k.labels.includes('UNREAD')).length;
  return flussInbox({ heute, eingang, wiedervorlagen, offen, verbunden: !!g, link: '/os/inbox' });
}
