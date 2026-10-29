// ─── Prozesse · Bausteine mit eigenem Weg — Server (22.10. spät; research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 5.2 N6–N10) ───────────────────────────
// Bausteine, die im Lauf bisher nur eine Aufgabe für einen Menschen wurden, gehen jetzt über den VORHANDENEN Schreibweg — als Vorschlag, auf den der Lauf
// wartet (lib/prozesse/lauf-regeln.ts `VorschlagWirkung`). Zwei Stellen:
//   wirkungVorlegen      beim Vorlegen (lib/prozesse/lauf-server.ts, Wirkung „vorschlag“): ergänzen, was nur der Server weiß (Gäste aus `gaesteVorschlag`,
//                        Felder des Webhook-Eingangs, abgeleitetes Kampagnen-Ergebnis, freie Zeit und Kalender, Ablauf der Produkt-Karte), prüfen wie ein
//                        Klick (CRM: `crmVorschlagPlanen` — Art. 18, Werbesperre, Kanal-Ampel, Stände) und den Text des Vorschlags bauen. Nichts zu tun →
//                        der Lauf geht weiter (Grund am Schritt); kein eigener Weg (kein Ablauf, keine freie Zeit, kein Kalender) → Ersatz „von Hand“.
//   wirkungUebernehmen   bei der Freigabe (lib/prozesse/lauf-stapel.ts) — NUR aus der Sitzung der freigebenden Person: CRM über `crmVorschlagUebernehmen`
//                        (dieselben Routen wie ein Klick), Fall über `mandatFallStarten` (Paket oder Prozess des Produkts), Termin über den Termin-Schreibweg (POST /api/kalender/termin) mit
//                        `einladungBestaetigt` — die Freigabe IST die Rückfrage „Einladung an n Personen …?“, der Dienstweg lädt nie ein.
// Läufe rechnen mit der Person des Vorschlags (für wen er ist) bzw. der Person des Laufs — nie mit dem Inhaber als Rückfall (Regel 5). Nur Business.

import type { CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { LaufGrund, ProzessLauf } from './lauf-typen';
import type { VorschlagWirkung } from './lauf-regeln';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';

/** Was beim Vorlegen herauskommt. */
export type Vorlage =
  | { art: 'vorlegen'; titel: string; vorher?: string; nachher: string; wirkung: VorschlagWirkung }
  | { art: 'von-hand'; nachher: string }
  | { art: 'weiter'; grund: LaufGrund }
  | { art: 'fehler'; grund: LaufGrund; voruebergehend?: true };

const RANG: Readonly<Record<string, number>> = { angesprochen: 1, reagiert: 2, gespraech: 3, chance: 4, kein_interesse: 5 };

/**
 * Das Ergebnis einer Person in einer Kampagne aus ihrem Verlauf seit dem Start des Laufs (rein): neuer offener Deal → Chance, „kein Bedarf“ → kein Interesse,
 * Termin bzw. Gespräch → Gespräch, eingehende Antwort → reagiert, sonst angesprochen (die Playbook-Schritte davor sind getan).
 */
export function ergebnisAbleiten(k: Kontakt, crm: Pick<CrmBestand, 'chancen'>, seit: string, offeneStufen: readonly string[]): string {
  const a = (k.aktivitaeten ?? []).filter(x => x.am >= seit);
  if (crm.chancen.some(c => c.kontaktIds.includes(k.id) && offeneStufen.includes(c.stufe) && c.angelegt >= seit.slice(0, 10))) return 'chance';
  if (a.some(x => x.ergebnis === 'kein_bedarf')) return 'kein_interesse';
  if (a.some(x => x.art === 'termin' || x.art === 'gespraech' || (x.art === 'anruf' && (x.ergebnis === 'gespraech' || x.ergebnis === 'termin')))) return 'gespraech';
  if (a.some(x => x.art === 'antwort')) return 'reagiert';
  return 'angesprochen';
}

/** Name aus einem Feld „Name“ (Webhook) — letzte Wortgruppe = Nachname (rein). */
export function nameTeilen(name: string): { vorname: string; nachname: string } {
  const t = name.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (t.length < 2) return { vorname: '', nachname: t[0] ?? '' };
  return { vorname: t.slice(0, -1).join(' '), nachname: t.at(-1)! };
}

/** Die Felder eines Webhook-Eingangs als Anfrage (rein) — nur bekannte Namen, alles fremder Text (der Vorschlag prüft Dublette, Art. 18, Werbesperre). */
export function anfrageAusWebhook(f: Readonly<Record<string, unknown>>): { neu: Record<string, string>; text: string } {
  const s = (k: string) => (typeof f[k] === 'string' ? (f[k] as string).trim() : '');
  const n = s('name') ? nameTeilen(s('name')) : { vorname: s('vorname'), nachname: s('nachname') };
  const neu: Record<string, string> = {};
  if (n.vorname) neu.vorname = n.vorname;
  if (n.nachname) neu.nachname = n.nachname;
  for (const [k, z] of [['email', 'email'], ['firma', 'firma_name'], ['telefon', 'telefon']] as const) if (s(k)) neu[z] = s(k);
  return { neu, text: s('nachricht') || s('text') || s('anliegen') };
}

const wochentag = (tag: string) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${tag}T12:00:00Z`).getUTCDay()];
const wann = (start: string, ende: string) => `${wochentag(start.slice(0, 10))}, ${start.slice(8, 10)}.${start.slice(5, 7)}. ${start.slice(11, 16)}–${ende.slice(11, 16)} Uhr`;

async function crmLaden(): Promise<CrmBestand | null> { return (await import('@/lib/crm/speicher')).ladeCrm().catch(() => null); }

/** Beim Vorlegen: Wirkung ergänzen und prüfen, Text bauen (siehe Kopf). Wirft nie — ein Lesefehler ist vorübergehend. */
export async function wirkungVorlegen(w: VorschlagWirkung, l: Pick<ProzessLauf, 'start' | 'daten' | 'person'>, o: { fuer: string | null; kennung: string; h: string; jetzt: Date }): Promise<Vorlage> {
  const person = o.fuer ?? l.person;
  if (!person) return { art: 'fehler', grund: 'person-fehlt' };
  try {
    if (w.art === 'crm') return await crmVorlegen(w, l, person, o);
    if (w.art === 'fulfillment') return await fallVorlegen(w, person, o);
    if (w.art === 'geld') return await geldVorlegen(w);
    return await terminVorlegen(w, person, o);
  } catch (e) {
    console.error(`[prozesse/bausteine] vorlegen — ${e instanceof Error ? e.message.slice(0, 160) : 'Fehler'}`);
    return { art: 'fehler', grund: 'voruebergehend', voruebergehend: true };
  }
}

async function crmVorlegen(w: Extract<VorschlagWirkung, { art: 'crm' }>, l: Pick<ProzessLauf, 'start' | 'daten'>, person: string, o: { h: string; jetzt: Date }): Promise<Vorlage> {
  const crm = await crmLaden();
  if (!crm) return { art: 'fehler', grund: 'voruebergehend', voruebergehend: true };
  const eingabe: Record<string, unknown> = { ...w.eingabe };
  const art = String(eingabe.art ?? '');
  if (art === 'gaesteliste' && w.gaeste) {
    const e = crm.events.find(x => x.id === eingabe.event);
    if (!e || e.status === 'abgesagt') return { art: 'weiter', grund: 'nichts-vorzuschlagen' };
    const [{ istNetzwerkenEvent }, { gaesteVorschlag }, { kontakteFuerVerarbeitung }] = await Promise.all([import('@/lib/crm/marke'), import('@/lib/crm/eventplanung'), import('@/lib/crm/verarbeitung')]);
    // Zu besuchten Events (Netzwerken) laden wir niemanden ein — die Gästeliste gibt es nur für eigene Abende.
    if (istNetzwerkenEvent(e)) return { art: 'weiter', grund: 'nichts-vorzuschlagen' };
    const kontakte = await kontakteFuerVerarbeitung();
    const vorschlag = gaesteVorschlag(kontakte, crm, { ...e, mixZiel: e.mixZiel ?? { zielkunden: w.gaeste.zielkunden, kunden: w.gaeste.kunden } }, localDay(o.jetzt), undefined, w.gaeste.n);
    if (!vorschlag.length) return { art: 'weiter', grund: 'nichts-vorzuschlagen' };
    eingabe.kontakte = vorschlag.map(g => g.kontakt.id);
  }
  if (art === 'kampagnen_ergebnis') {
    const kp = (crm.kampagnen ?? []).find(x => x.id === eingabe.kampagne);
    // Nur verarbeitbare Personen (Art. 18 fehlt hier — die Wache des Laufs beendet ihn ohnehin).
    const k = (await (await import('@/lib/crm/verarbeitung')).kontakteFuerVerarbeitung()).find(x => x.id === eingabe.kontakt);
    if (!kp || !k || !kp.kontaktIds.includes(k.id)) return { art: 'weiter', grund: 'daten-fehlen' };
    const { OFFENE_STUFEN } = await import('@/lib/crm/pipeline');
    const ergebnis = typeof eingabe.ergebnis === 'string' ? eingabe.ergebnis : ergebnisAbleiten(k, crm, l.start, OFFENE_STUFEN);
    const da = (kp.ergebnisse ?? []).filter(x => x.kontaktId === k.id).sort((a, b) => (a.am < b.am ? 1 : -1))[0];
    // Steht schon dasselbe bzw. ein weiteres Ergebnis da (in der Kampagne von Hand gesetzt), ist nichts vorzuschlagen.
    if (da && ((RANG[da.ergebnis] ?? 0) >= (RANG[ergebnis] ?? 0) || da.ergebnis === 'kein_interesse')) return { art: 'weiter', grund: 'schon-erledigt' };
    eingabe.ergebnis = ergebnis;
  }
  if (art === 'mandat_anlegen') {
    const d = crm.chancen.find(x => x.id === eingabe.deal);
    if (!d) return { art: 'weiter', grund: 'daten-fehlen' };
    if (crm.mandate.some(m => m.chanceId === d.id && !m.geloeschtAm)) return { art: 'weiter', grund: 'schon-erledigt' };
  }
  if (art === 'anfrage_anlegen' && w.webhook) {
    const { webhooksLesen } = await import('./werkstatt-server');
    const eingang = (await webhooksLesen(o.h)).eingaenge.find(x => x.id === l.daten['bezug.eingangid']);
    if (!eingang) return { art: 'weiter', grund: 'daten-fehlen' };
    const a = anfrageAusWebhook(eingang.felder);
    if (!a.text || !Object.keys(a.neu).length) return { art: 'weiter', grund: 'daten-fehlen' };
    Object.assign(eingabe, a.neu, { text: a.text });
  }
  const { crmVorschlagPlanen } = await import('@/lib/zoe/crm-vorschlag');
  const r = await crmVorschlagPlanen(eingabe, person);
  if ('fehler' in r) {
    const klasse = r.fehler.klasse;
    if (klasse === 'voruebergehend') return { art: 'fehler', grund: 'voruebergehend', voruebergehend: true };
    // Gesperrt (Werbesperre, keine Grundlage, niemand vorzumerken): nichts vorzuschlagen — die Ampel hat entschieden.
    if (klasse === 'sperre') return { art: 'weiter', grund: 'nichts-vorzuschlagen' };
    return { art: 'fehler', grund: 'vorschlag-abgelehnt' };
  }
  return { art: 'vorlegen', titel: r.plan.titel, ...(r.plan.vorher ? { vorher: r.plan.vorher } : {}), nachher: r.plan.nachher, wirkung: { art: 'crm', eingabe: r.plan.eingabe } };
}

async function mandatZum(w: Extract<VorschlagWirkung, { art: 'fulfillment' }>, crm: CrmBestand) {
  return crm.mandate.find(m => !m.geloeschtAm && (w.mandatId ? m.id === w.mandatId : m.chanceId === w.dealId));
}

async function fallVorlegen(w: Extract<VorschlagWirkung, { art: 'fulfillment' }>, person: string, o: { h: string }): Promise<Vorlage> {
  const crm = await crmLaden();
  if (!crm) return { art: 'fehler', grund: 'voruebergehend', voruebergehend: true };
  const m = await mandatZum(w, crm);
  if (!m) return { art: 'weiter', grund: 'daten-fehlen' };
  const [{ fulfillmentLesen, fulfillmentAendern }, { ablaufFuerMandat }, { markeOnboardingVorschlag }, { lies }, { istFulfillmentMandat }] = await Promise.all([
    import('@/lib/fulfillment/speicher'), import('@/lib/fulfillment/prozesse/fall-server'), import('@/lib/fulfillment/prozesse/server'), import('@/lib/zoe/stapel'), import('@/lib/fulfillment/regeln'),
  ]);
  // Mandate mit Fulfillment (25.10.: auch die Privat-Arbeits-Einheit) — eine Privat-Einheit ohne Arbeit bekommt keinen Vorschlag.
  if (!istFulfillmentMandat(m.gesellschaft)) return { art: 'weiter', grund: 'nichts-vorzuschlagen' };
  const [faelle, vorlagen] = await Promise.all([fulfillmentLesen('faelle', o.h), fulfillmentLesen('vorlagen', o.h)]);
  if (faelle.faelle[m.id]) return { art: 'weiter', grund: 'schon-erledigt' };
  // Schlägt der Morgenlauf ihn schon vor (offen im Stapel), nicht noch einmal.
  if ((await lies()).some(v => v.status === 'offen' && v.bezug?.art === 'fulfillment' && v.bezug.id === `p:onboarding:${m.id}`)) return { art: 'weiter', grund: 'schon-erledigt' };
  // 29.10. (Kreislauf, F-B3): DIESELBE Regel wie der Fall-Dialog (`startVorbelegung`) — der Prozess des Produkts (Werkstatt), sonst das Paket des Produkts.
  const v = await ablaufFuerMandat(m, crm, vorlagen);
  if (!v) return { art: 'weiter', grund: 'kein-ablauf' };
  // Die Marke, die auch der Morgenlauf setzt — damit er denselben Fall nicht noch einmal vorschlägt (ein Vorschlag je Mandat).
  await fulfillmentAendern('vorlagen', d => (d.marken[markeOnboardingVorschlag(m.id)] ? { ok: true, datei: d, geaendert: [] } : { ok: true, datei: { ...d, marken: { ...d.marken, [markeOnboardingVorschlag(m.id)]: localDay() } }, geaendert: [markeOnboardingVorschlag(m.id)] }), { art: 'person', person }, o.h).catch(() => null);
  return {
    art: 'vorlegen', titel: `Fall starten: ${m.kunde}`.slice(0, 200), nachher: `Fall nach „${v.titel}“ anlegen — die Willkommensmail bereitest du danach im Fall vor, gesendet wird erst per Klick.`,
    wirkung: { art: 'fulfillment', mandatId: m.id, vorlageId: v.id },
  };
}

async function terminVorlegen(w: Extract<VorschlagWirkung, { art: 'termin' }>, person: string, o: { kennung: string; jetzt: Date }): Promise<Vorlage> {
  const [{ kalenderZiel }, { freieZeitFuer }, { kurzHash }] = await Promise.all([import('@/lib/kalender/google/ziel'), import('@/lib/kalender/freie-zeit'), import('./lauf-regeln')]);
  const ziel = await kalenderZiel(person, 'business').catch(() => null);
  if (!ziel?.kalender) return { art: 'von-hand', nachher: `Für dich ist kein Business-Kalender hinterlegt — den Termin „${w.titel}“ mit ${w.an.name} bitte von Hand vereinbaren (Einladung erst nach deiner Rückfrage im Kalender).` };
  const frei = await freieZeitFuer({ personen: [person], dauerMin: w.dauerMin, von: tagPlus(localDay(o.jetzt), 1), tage: 14, maxJeTag: 1, grenze: 3, jetzt: o.jetzt });
  const slot = frei.vorschlaege[0];
  if (!slot) return { art: 'von-hand', nachher: `Keine freie Zeit in den nächsten 14 Tagen — den Termin „${w.titel}“ mit ${w.an.name} bitte von Hand vereinbaren.` };
  return {
    art: 'vorlegen', titel: `Termin mit Einladung: ${w.titel} · ${w.an.name}`.slice(0, 200),
    nachher: `Termin „${w.titel}“ am ${wann(slot.start, slot.ende)} (${w.dauerMin} Min.) im Kalender „${ziel.kalender}“ — Gast: ${w.an.name} <${w.an.email}>.\n\nEinladung an 1 Person über den Kalender senden? Freigeben = Termin anlegen und einladen (nur aus deiner Sitzung). Passt die Zeit nicht: ablehnen und im Kalender selbst planen.`.slice(0, 8000),
    wirkung: { ...w, start: slot.start, ende: slot.ende, kalender: ziel.kalender, uid: `makeos-prozess-${kurzHash(o.kennung)}` },
  };
}

type Uebernahme = { ok: true; text: string } | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };
const status = (n: number): 400 | 403 | 404 | 409 | 413 => (n === 400 || n === 403 || n === 404 || n === 413 ? n : 409);

/** Bei der Freigabe (nur aus der Sitzung der Person — prüft lib/prozesse/lauf-stapel.ts): die Wirkung über den vorhandenen Schreibweg. */
export async function wirkungUebernehmen(person: string, w: VorschlagWirkung, o: { vid: string; kennung: string }): Promise<Uebernahme> {
  if (w.art === 'crm') {
    const { crmVorschlagUebernehmen } = await import('@/lib/zoe/crm-vorschlag');
    const r = await crmVorschlagUebernehmen(w.eingabe, person, o.vid);
    return r.ok ? { ok: true, text: r.text } : { ok: false, status: status(r.status), fehler: r.fehler };
  }
  if (w.art === 'fulfillment') {
    const [{ fulfillmentLesen }, { mandatFallStarten, FallFehler }] = await Promise.all([import('@/lib/fulfillment/speicher'), import('@/lib/fulfillment/prozesse/fall-server')]);
    if (!w.mandatId || !w.vorlageId) return { ok: false, status: 409, fehler: 'Ohne Mandat bzw. Ablauf lässt sich kein Fall starten — nichts angelegt.' };
    if ((await fulfillmentLesen('faelle')).faelle[w.mandatId]) return { ok: true, text: 'Für dieses Mandat läuft schon ein Fall — nichts doppelt angelegt.' };
    try {
      // 29.10. (Kreislauf, F-B3): EIN Start — Paket oder Prozess des Produkts (`vorlageId` = `pz-…`).
      const r = await mandatFallStarten({ mandatId: w.mandatId, ablauf: w.vorlageId, person });
      return { ok: true, text: r.ablauf === 'prozess' ? 'Fall angelegt — Onboarding beginnt; die Schritte kommen aus dem Ablauf des Produkts.' : 'Fall angelegt — unter Fulfillment › Fall: Willkommensmail vorbereiten (gesendet wird erst per Klick).' };
    } catch (e) {
      if (e instanceof FallFehler) return { ok: false, status: e.status, fehler: e.message };
      throw e;
    }
  }
  if (w.art === 'geld') return geldUebernehmen(person, w);
  return terminUebernehmen(person, w);
}

// ══ Geld-Bausteine (29.10., Kreislauf W-B2 — Regeln: lib/prozesse/geld-bausteine.ts) ═════════════════════════════════════════════════════════════════

/** Den Finanzplan lesen (nur die Rechnungen) — derselbe Bestand wie das Rechnungswesen. */
async function rechnungenLesen() {
  const [{ loadJson }, { sauberFile }] = await Promise.all([import('@/lib/store/local-db'), import('@/lib/finanzen/finanzplan-bestand')]);
  return sauberFile(await loadJson<import('@/lib/finanzen/finanzplan-bestand').FinanzplanFile>('finanzplan')).rechnungen;
}

/** Beim Vorlegen: welcher Entwurf gemeint ist (der jüngste des Falls) und der Text — keiner bzw. schon erledigt → der Lauf geht weiter. */
async function geldVorlegen(w: Extract<VorschlagWirkung, { art: 'geld' }>): Promise<Vorlage> {
  const crm = await crmLaden();
  if (!crm) return { art: 'fehler', grund: 'voruebergehend', voruebergehend: true };
  const { GELD_TEXT, rechnungZumStellen, angebotZumStellen } = await import('./geld-bausteine');
  const m = w.mandatId ? crm.mandate.find(x => x.id === w.mandatId && !x.geloeschtAm) : undefined;
  if (w.aktion === 'rechnung-entwurf') {
    if (!m) return { art: 'weiter', grund: 'daten-fehlen' };
    return { art: 'vorlegen', titel: `Rechnung erstellen: ${m.kunde}`.slice(0, 200), nachher: `Der Prozess ${GELD_TEXT[w.aktion]}${w.monat ? ` (${w.monat})` : ''} — Mandat „${m.titel}“. Gestellt wird nicht.`, wirkung: w };
  }
  if (w.aktion === 'rechnung-stellen') {
    const id = rechnungZumStellen(await rechnungenLesen(), m?.id);
    if (!m || !id) return { art: 'weiter', grund: 'daten-fehlen' };
    return { art: 'vorlegen', titel: `Rechnung stellen: ${m.kunde}`.slice(0, 200), nachher: `Der Prozess ${GELD_TEXT[w.aktion]} — der jüngste Entwurf des Mandats „${m.titel}“. Fehlen Pflichtangaben, bleibt der Vorschlag offen.`, wirkung: { ...w, rechnungId: id } };
  }
  const id = angebotZumStellen(crm.angebote ?? [], { ...(w.dealId ? { dealId: w.dealId } : {}), ...(w.mandatId ? { mandatId: w.mandatId } : {}) });
  const a = id ? (crm.angebote ?? []).find(x => x.id === id) : undefined;
  if (!a) return { art: 'weiter', grund: 'daten-fehlen' };
  return { art: 'vorlegen', titel: `Angebot stellen: ${a.titel || 'Entwurf'}`.slice(0, 200), nachher: `Der Prozess ${GELD_TEXT[w.aktion]} — Entwurf „${a.titel || a.id}“.`, wirkung: { ...w, angebotId: a.id } };
}

/**
 * Bei der Freigabe (nur aus der Sitzung der Person): über die vorhandenen Schreibwege des Rechnungswesens bzw. des Angebots-Tools — mit der Sicht der Person
 * (`planZugangFuer`: „nur Business“ sieht und schreibt nur Business-Rechnungen, stellt nie ein Angebot). Fehler (Pflichtangaben, Stand) → der Vorschlag bleibt offen.
 */
async function geldUebernehmen(person: string, w: Extract<VorschlagWirkung, { art: 'geld' }>): Promise<Uebernahme> {
  const [{ planZugangFuer }, { haushaltDesInhabers }] = await Promise.all([import('@/lib/finanzen/haushalt/zugriff'), import('@/lib/zugang/haushalt-inhaber')]);
  const z = await planZugangFuer(person);
  if (!z || z.haushalt !== await haushaltDesInhabers()) return { ok: false, status: 403, fehler: 'Rechnungen und Angebote nur im Haushalt des Inhabers — nichts geändert.' };
  const wer = { art: 'person' as const, person };
  try {
    if (w.aktion === 'rechnung-entwurf') {
      if (!w.mandatId) return { ok: false, status: 409, fehler: 'Ohne Mandat entsteht kein Rechnungsentwurf — nichts angelegt.' };
      const { entwurfNeu } = await import('@/lib/finanzen/rechnung/server');
      const r = await entwurfNeu({ quelle: 'mandat', mandatId: w.mandatId, ...(w.monat ? { monat: w.monat } : {}), person, haushalt: z.haushalt, sicht: z.sicht, wer });
      return { ok: true, text: r.vorhanden ? 'Den Rechnungsentwurf für diesen Monat gibt es schon — nichts doppelt angelegt.' : 'Rechnungsentwurf angelegt — unter Finanzen › Rechnungen prüfen; gestellt wird erst dort bzw. im nächsten Schritt.' };
    }
    if (w.aktion === 'rechnung-stellen') {
      if (!w.rechnungId) return { ok: false, status: 409, fehler: 'Kein Rechnungsentwurf gewählt — nichts gestellt.' };
      const [{ rechnungStellen }, { fassung }] = await Promise.all([import('@/lib/finanzen/rechnung/server'), import('@/lib/finanzen/finanzplan-bestand')]);
      const r0 = (await rechnungenLesen()).find(r => r.id === w.rechnungId);
      if (!r0) return { ok: false, status: 404, fehler: 'Diesen Rechnungsentwurf gibt es nicht mehr — nichts gestellt.' };
      if (r0.status !== 'geplant') return { ok: true, text: `Die Rechnung ist schon gestellt${r0.nummer ? ` (${r0.nummer})` : ''} — nichts doppelt.` };
      const r = await rechnungStellen({ id: r0.id, stand: fassung(r0), person, haushalt: z.haushalt, sicht: z.sicht, wer });
      return { ok: true, text: `Rechnung ${r.rechnung.nummer ?? ''} gestellt — das PDF liegt bei der Rechnung; die Mail an den Kunden bereitet der nächste Schritt vor.`.replace('  ', ' ') };
    }
    if (z.sicht === 'business') return { ok: false, status: 403, fehler: 'Angebote stellt ein volles Haushaltsmitglied — nichts gestellt.' };
    if (!w.angebotId) return { ok: false, status: 409, fehler: 'Kein Angebots-Entwurf gewählt — nichts gestellt.' };
    const crm = await crmLaden();
    const a = crm?.angebote?.find(x => x.id === w.angebotId);
    if (!a) return { ok: false, status: 404, fehler: 'Diesen Angebots-Entwurf gibt es nicht mehr — nichts gestellt.' };
    if (a.status !== 'entwurf') return { ok: true, text: `Das Angebot ist schon ${a.status} — nichts doppelt.` };
    const { angebotStellen } = await import('@/lib/crm/angebot-server');
    const r = await angebotStellen({ id: a.id, person, haushalt: z.haushalt, wer });
    return { ok: true, text: `Angebot ${r.angebot.nummer ?? ''} gestellt — PDF und Nachfass-Follow-up sind da; die Mail an den Kunden bereitet der nächste Schritt vor.`.replace('  ', ' ') };
  } catch (e) {
    const s = (e as { status?: unknown })?.status;
    if (e instanceof Error && typeof s === 'number') return { ok: false, status: status(s), fehler: e.message };
    throw e;
  }
}

/**
 * Termin mit Einladung: erst prüfen, ob die vorgeschlagene Zeit noch frei ist (sonst 409 — der Vorschlag bleibt offen, „ablehnen“ plant von Hand), dann über den
 * Termin-Schreibweg (dieselbe Route wie der Klick im Kalender: Gäste gegen die Kartei, Art. 18 → 409, Kalender der Person, Business-frei, Protokoll, Meeting
 * im CRM) — mit der Person als Sitzung, weil die Freigabe aus ihrer Sitzung kam. Feste UID: ein zweiter Klick legt nichts doppelt an.
 */
async function terminUebernehmen(person: string, w: Extract<VorschlagWirkung, { art: 'termin' }>): Promise<Uebernahme> {
  if (!w.start || !w.ende || !w.kalender || !w.uid || !w.an.email) return { ok: false, status: 409, fehler: 'Dem Vorschlag fehlen Zeit bzw. Kalender — bitte ablehnen und im Kalender planen. Nichts angelegt.' };
  const { freieZeitFuer } = await import('@/lib/kalender/freie-zeit');
  const frei = await freieZeitFuer({ personen: [person], dauerMin: w.dauerMin, von: w.start.slice(0, 10), tage: 1, grenze: 200 }).catch(() => null);
  if (!frei?.vorschlaege.some(x => x.start <= w.start! && x.ende >= w.ende!)) return { ok: false, status: 409, fehler: 'Die vorgeschlagene Zeit ist inzwischen belegt — bitte ablehnen und im Kalender neu planen. Nichts angelegt.' };
  const { POST } = await import('@/app/api/kalender/termin/route');
  const body = {
    uid: w.uid, titel: w.titel, start: w.start, ende: w.ende, kalender: w.kalender, art: 'termin', bereich: 'business',
    gaeste: [{ email: w.an.email, name: w.an.name }], einladungBestaetigt: true, bezug: w.bezug,
  };
  const res = await POST(new Request('http://intern/api/kalender/termin', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': person }, body: JSON.stringify(body) }));
  const j = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (res.status >= 400 || j.ok === false) return { ok: false, status: status(res.status), fehler: `${String(j.fehler ?? 'Termin nicht angelegt.')} Der Vorschlag bleibt offen.` };
  return { ok: true, text: `Termin angelegt und ${w.an.name} eingeladen${j.schonDa ? ' (stand schon da)' : ''}.` };
}

/** „Karte ergänzen“ ohne Agent davor: welche Felder an der Firma bzw. am Kontakt des Falls leer sind (rein über die übergebenen Einträge). */
export function karteLueckenAus(o: { firma?: Record<string, unknown> | null; kontakt?: Record<string, unknown> | null }) {
  const leer = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
  return (ziel: 'firma' | 'kontakt', felder: readonly string[]): string[] | null => {
    const e = ziel === 'firma' ? o.firma : o.kontakt;
    if (!e) return null;
    return felder.filter(f => leer(e[f]));
  };
}

/** Die Firma bzw. den Kontakt des Falls für „Karte ergänzen“ finden (Firma: Fall Firma/Lead einer Firma, sonst Firma des Deals, Mandats bzw. Kontakts). */
export function karteZiele(crm: CrmBestand | null, l: Pick<ProzessLauf, 'fall' | 'daten'>, kontakt: Kontakt | null): { firma: Record<string, unknown> | null; kontakt: Record<string, unknown> | null } {
  if (!crm) return { firma: null, kontakt: kontakt as unknown as Record<string, unknown> | null };
  const id = l.fall.id;
  const firmaId = (l.fall.art === 'firma' || (l.fall.art === 'lead' && id?.startsWith('f-'))) ? id
    : l.fall.art === 'deal' ? crm.chancen.find(c => c.id === id)?.firmaId
      : l.fall.art === 'mandat' ? crm.mandate.find(m => m.id === id)?.firmaId
        : l.daten['bezug.firmaid'] ?? kontakt?.firmaId;
  const firma = firmaId ? crm.firmen.find(f => f.id === firmaId) ?? null : null;
  return { firma: firma as unknown as Record<string, unknown> | null, kontakt: kontakt as unknown as Record<string, unknown> | null };
}
