// ─── ZOE unterstützt die Markttraktion — nur Vorschläge, erst der Klick übernimmt (28.09., Paket C7) ───
// Vorgabe 28.09.: „ZOE soll alles sehen und unterstützen können.“ Unterstützen heißt hier: ZOE bereitet vor, der
// Mensch entscheidet. Das Werkzeug `crm_vorschlag` ÄNDERT NICHTS am CRM — es prüft die Eingabe gegen den aktuellen
// Bestand (Art. 18, Werbesperre, Kanal-Ampel), rechnet Vorher/Nachher und legt einen Vorschlag der Stapel-Art „crm“
// ab (`lege({ …, bezug: { art: 'crm', id } })`, lib/zoe/stapel.ts). Übernommen wird nur per Klick im Stapel bzw. in
// der Karte „ZOE-Vorschläge“ an Kontakt/Firma: `CRM_STAPEL_ART.freigeben` (lib/zoe/stapel-arten.ts) — das
// Übernehmen ist bewusst KEIN Werkzeug, damit kein eingeschleuster Aufruf einen Vorschlag selbst freigibt.
//
// Freigeben führt über die NORMALEN Schreibwege aus: die Route wird im Prozess mit Dienstschlüssel und
// `x-make-person` der freigebenden Person aufgerufen (Regel 7) — dieselben Prüfungen wie ein Klick in der Oberfläche
// (Haushalt, Stand/409, Art. 18, Werbesperre, Anlass-Pflicht, Deal-Regeln, Löschsperren), im Änderungsprotokoll als
// `{ art: 'zoe', person }`. Was einen Stand hat (Kontakt, Deal, Lead, Produkt, Angebot, Dubletten), wird beim
// Vorschlagen festgehalten; hat sich der Datensatz seitdem geändert → 409, der Vorschlag bleibt offen.
// Nichts geht nach außen: Nachrichten, Leitfäden, Einladungen sind Text zum Kopieren; ein Angebot bleibt Entwurf
// (nie „stellen“). Ablehnen mit Grund übernimmt die Stapel-Route.

import { loadJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { suchPasst } from '@/lib/text/such-norm';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, ChancenStufe, FollowUpArt, FollowUpBezugArt, SegmentKriterien } from '@/lib/crm/typen';
import { lege, entscheide, beanspruche, loslassen } from './stapel';
import { notiere } from './protokoll';
import type { StapelArtFreigabe, ArtErgebnis } from './stapel-arten';
import type { Risiko, Vorschau } from './register';
import { crmSicht, eindeutig, EINGESCHRAENKT_NAME, NICHT_IM_HINTERGRUND, karteiFuerPruefung, type CrmSicht } from './crm-sicht';
import { BEIDE, TEAM } from '@/lib/crm/team-liste';
import { GESELLSCHAFTEN } from '@/lib/einheiten';
import { innen, type InnenAntwort } from './innen';
import { brauchtFreigabe, fehlschlag, istWerkzeugErgebnis, type WerkzeugErgebnis, type WerkzeugRueckgabe } from '@/lib/werkzeuge/vertrag';

/** Kennungen des CRM-Teams der Instanz (lib/crm/team-liste.ts) — nie feste Namen im Code (09.10., „neutral-rest-2“). */
const teamIds = (): string[] => TEAM.map(t => t.id);

type Eingabe = Record<string, unknown>;
type Lauf = (input: Eingabe, origin: string, person?: string) => Promise<WerkzeugRueckgabe>;
type Status = 400 | 403 | 404 | 409 | 413;

export const CRM_VORSCHLAG_WERKZEUG = 'crm_vorschlag';

/** Die Arten eines CRM-Vorschlags — was ZOE vorbereiten darf. Neue Art: planen + ausführen unten ergänzen. */
export const VORSCHLAG_ARTEN = [
  // Kontakte, Deals, Follow-up (CRM)
  'aktivitaet', 'followup', 'followup_verschieben', 'deal_anlegen', 'deal_aendern', 'kontakt_felder', 'aufgabe',
  // Qualifizierung
  'qualifizierung',
  // Datenqualität
  'dubletten', 'reparatur', 'import_konflikt',
  // Angebot (nur Entwurf, nie stellen)
  'angebot_entwurf',
  // Sales / Make.One / allgemein: Text zum Kopieren — kein Versand
  'nachricht_entwurf', 'anruf_leitfaden', 'powerhour_reihenfolge', 'einladung_entwurf', 'danke_entwurf',
  // Marketing
  'beitrag_entwurf', 'newsletter_entwurf', 'segment',
  // Make.One
  'gaesteliste',
  // Stammdaten
  'leistungstext',
  // Heads (Sales, Marketing, Event): ihren Vorschlag annehmen oder mit Grund ablehnen — über ihre eigene Route
  'head_entscheiden',
  // Kundengewinnung (22.10., Vorlagen der Prozesse — research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 5.2 N4, N5, N6, N9, N10): Firmen-Stammdaten aus einer
  // Recherche, Lead parken, Mandat aus gewonnenem Deal, Kampagnen-Ergebnis, Anfrage aus einem Webhook — jeweils über den VORHANDENEN Schreibweg.
  'firma_felder', 'lead_parken', 'mandat_anlegen', 'kampagnen_ergebnis', 'anfrage_anlegen',
] as const;
export type VorschlagArt = typeof VORSCHLAG_ARTEN[number];
/** Arten, die nichts schreiben — Freigabe heißt „übernommen, zum Kopieren“, nichts wird versendet. */
export const NUR_TEXT: ReadonlySet<VorschlagArt> = new Set(['nachricht_entwurf', 'anruf_leitfaden', 'powerhour_reihenfolge', 'einladung_entwurf', 'danke_entwurf']);

const ART_TITEL: Record<VorschlagArt, string> = {
  aktivitaet: 'Aktivität festhalten', followup: 'Follow-up anlegen', followup_verschieben: 'Follow-up verschieben',
  deal_anlegen: 'Deal anlegen', deal_aendern: 'Deal ändern', kontakt_felder: 'Kontakt ergänzen', aufgabe: 'Aufgabe anlegen',
  qualifizierung: 'Qualifizierung ergänzen', dubletten: 'Dubletten zusammenführen', reparatur: 'Datenqualität reparieren',
  import_konflikt: 'Import-Konflikt entscheiden', angebot_entwurf: 'Angebots-Entwurf', nachricht_entwurf: 'Nachricht entwerfen',
  anruf_leitfaden: 'Anruf-Leitfaden', powerhour_reihenfolge: 'Power-Hour-Reihenfolge', einladung_entwurf: 'Einladung entwerfen',
  danke_entwurf: 'Danke-Nachricht entwerfen', beitrag_entwurf: 'Beitrag entwerfen', newsletter_entwurf: 'Newsletter entwerfen',
  segment: 'Segment anlegen', gaesteliste: 'Gästeliste vormerken', leistungstext: 'Leistungstext für ein Produkt', head_entscheiden: 'Head-Vorschlag entscheiden',
  firma_felder: 'Firma ergänzen', lead_parken: 'Lead parken', mandat_anlegen: 'Mandat anlegen', kampagnen_ergebnis: 'Kampagnen-Ergebnis festhalten', anfrage_anlegen: 'Anfrage übernehmen',
};

/**
 * Felder, die „Karte ergänzen“ (Kundengewinnung, N4) an Kontakt bzw. Firma vorschlagen darf — Texte aus Recherche bzw. Agent (fremder Text: nur per Klick).
 * Nie Einwilligungen, Werbesperre, Einschränkung, Zahlungsdaten, Lead oder Personenbezüge anderer. Webseite/LinkedIn nur https.
 */
export const KARTE_KONTAKT_FELDER = ['aufhaenger', 'signale', 'marktinfo', 'recherche', 'steckbrief', 'vorgestelltDurch'] as const;
export const KARTE_FIRMA_FELDER = ['branche', 'branchen', 'mitarbeiter', 'stadt', 'webseite', 'linkedin'] as const;
const KARTE_TEXT_MAX: Readonly<Record<string, number>> = { aufhaenger: 600, signale: 600, marktinfo: 800, recherche: 60, steckbrief: 400, vorgestelltDurch: 160, branche: 160, mitarbeiter: 40, stadt: 120, webseite: 300, linkedin: 300 };
const httpsOk = (v: string) => /^https:\/\/[^\s]{3,}$/.test(v);

const text = (v: unknown, n = 300) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const tagOk = (v: unknown) => (typeof v === 'string' && TAG.test(v) ? v : undefined);
const kurz = (t: string, n = 90) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const stand = (e: unknown) => (e ? fingerabdruck(e as Record<string, unknown>) : '');
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => text(x, 120)).filter(Boolean) : typeof v === 'string' && v.trim() ? v.split(',').map(x => x.trim()).filter(Boolean) : []);

/** Was ein geplanter Vorschlag trägt (normalisiert — Kennungen statt Namen). */
interface Plan { titel: string; vorher?: string; nachher: string; eingabe: Eingabe; bezugId: string }
/** Geplant — oder ein typisierter Fehlschlag (V3: nie mehr ein Satz, aus dem jemand den Ausgang rät). */
type Geplant = Plan | WerkzeugErgebnis;

// ── Rohbestände für Stände (vor jeder Sicht: der Server rechnet den Stand am gespeicherten Datensatz) ──
async function rohKontakt(id: string): Promise<Kontakt | undefined> {
  return (await karteiFuerPruefung()).find(k => k.id === id);
}
async function rohCrm(): Promise<CrmBestand> { return (await import('@/lib/crm/speicher')).ladeCrm(); }

// ── Finden in der Sicht (Art. 18 ausgeblendet) ────────────────────────────

function kontaktAus(s: CrmSicht, roh: unknown, pflicht = true): Kontakt | WerkzeugErgebnis | null {
  const h = text(roh, 160);
  if (!h) return pflicht ? fehlschlag('eingabe', 'Fehlgeschlagen: kontakt fehlt (Kennung c-… oder Name).') : null;
  if (s.eingeschraenkt.has(h)) return fehlschlag('sperre', 'Nicht vorgeschlagen: Die Verarbeitung dieser Person ist eingeschränkt (Art. 18 DSGVO).');
  const r = eindeutig(s.kontakte, h, k => [anzeigename(k), k.firma, k.email], suchPasst);
  if (!r) return fehlschlag('nicht_gefunden', `Fehlgeschlagen: Kein Kontakt zu „${kurz(h, 40)}“ — erst mit crm_suche nachsehen.`);
  if (Array.isArray(r)) return fehlschlag('eingabe', `Fehlgeschlagen: Mehrdeutig — ${r.map(k => `${anzeigename(k)} [${k.id}]`).join(' oder ')}. Bitte mit Kennung.`);
  return r;
}
function firmaAus(s: CrmSicht, roh: unknown) {
  const h = text(roh, 160);
  if (!h) return null;
  const r = eindeutig(s.crm.firmen, h, f => [f.name, f.domain], suchPasst);
  if (!r) return fehlschlag('nicht_gefunden', `Fehlgeschlagen: Keine Firma zu „${kurz(h, 40)}“.`);
  if (Array.isArray(r)) return fehlschlag('eingabe', `Fehlgeschlagen: Mehrdeutig — ${r.map(f => `${f.name} [${f.id}]`).join(' oder ')}.`);
  return r;
}
function dealAus(s: CrmSicht, roh: unknown) {
  const h = text(roh, 160);
  if (!h) return null;
  const r = eindeutig(s.crm.chancen, h, c => [c.titel, c.firma], suchPasst);
  if (!r) return fehlschlag('nicht_gefunden', `Fehlgeschlagen: Kein Deal zu „${kurz(h, 40)}“.`);
  if (Array.isArray(r)) return fehlschlag('eingabe', `Fehlgeschlagen: Mehrdeutig — ${r.map(c => `${c.titel} [${c.id}]`).join(' oder ')}.`);
  return r;
}
const istFehler = (x: unknown): x is WerkzeugErgebnis => istWerkzeugErgebnis(x);
const WERBESPERRE = (k: Kontakt) => fehlschlag('sperre', `Nicht vorgeschlagen: ${anzeigename(k)} hat eine Werbesperre seit ${k.werbesperre!.seit} (Art. 21) — keine Ansprache, keine Entwürfe.`);

/** Kanal-Ampel prüfen — rot lehnt ab (mit Grund), gelb wird zum Hinweis. */
async function kanalPruefen(s: CrmSicht, k: Kontakt, kanal: 'mail' | 'linkedin' | 'telefon' | 'einladung' | 'newsletter'): Promise<{ fehler?: string; hinweis?: string; farbe: string }> {
  const { kanalStatus } = await import('@/lib/crm/recht');
  const { OFFENE_STUFEN } = await import('@/lib/crm/pipeline');
  const ctx = { hatMandat: s.crm.mandate.some(m => m.status === 'aktiv' && m.kontaktIds.includes(k.id)), hatChance: s.crm.chancen.some(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(k.id)) };
  const st = kanalStatus(k, kanal, ctx);
  if (st.farbe === 'rot') return { fehler: `Nicht vorgeschlagen: Kanal ${kanal} bei ${anzeigename(k)} nicht zulässig — ${st.grund} (Kanal-Ampel, keine Rechtsberatung).`, farbe: 'rot' };
  return { farbe: st.farbe, ...(st.farbe === 'gelb' ? { hinweis: `Kanal ${kanal} gelb: ${st.grund}` } : {}) };
}

// ── Planen je Art (liest, prüft, ändert nichts) ───────────────────────────

async function planen(art: VorschlagArt, i: Eingabe, s: CrmSicht): Promise<Geplant> {
  const { heute, crm } = s;
  switch (art) {
    case 'aktivitaet': {
      const k = kontaktAus(s, i.kontakt); if (istFehler(k) || !k) return k ?? fehlschlag('eingabe', 'Fehlgeschlagen: kontakt fehlt.');
      const { AKTIVITAET_ARTEN, ERGEBNISSE, wannSaeubern } = await import('@/lib/make-one/crm');
      const a = text(i.aktivitaet_art, 20) || 'notiz';
      if (!AKTIVITAET_ARTEN.includes(a as never) || ['stufe', 'system', 'uebergabe', 'event'].includes(a)) return fehlschlag('eingabe', 'Fehlgeschlagen: aktivitaet_art ist mail, linkedin, anruf, antwort, termin, gespraech oder notiz.');
      const t = text(i.text, 3000); if (!t) return fehlschlag('eingabe', 'Fehlgeschlagen: text fehlt (was passiert ist).');
      const erg = ERGEBNISSE.includes(i.ergebnis as never) ? String(i.ergebnis) : undefined;
      const anlass = text(i.anlass, 600) || undefined;
      if (a === 'anruf' && !anlass) {
        const { anlassPflicht } = await import('@/lib/crm/recht');
        const { OFFENE_STUFEN } = await import('@/lib/crm/pipeline');
        if (anlassPflicht(k, { hatMandat: crm.mandate.some(m => m.status === 'aktiv' && m.kontaktIds.includes(k.id)), hatChance: crm.chancen.some(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(k.id)) }))
          return fehlschlag('eingabe', 'Fehlgeschlagen: Ein Anruf bei gelber Telefon-Ampel braucht einen konkreten Anlass aus der Beziehung (anlass).');
      }
      const naechster = text(i.naechster_schritt) && tagOk(i.faellig) ? { text: text(i.naechster_schritt), datum: String(i.faellig) } : undefined;
      const wann = wannSaeubern(i.wann);
      return {
        titel: `${ART_TITEL.aktivitaet}: ${a} · ${anzeigename(k)}`, bezugId: `kontakt:${k.id}`,
        nachher: [t, erg && `Ergebnis ${erg}`, naechster && `nächster Schritt ${naechster.datum}: ${naechster.text}`, erg === 'sperre' && 'setzt eine WERBESPERRE'].filter(Boolean).join(' · '),
        eingabe: { art, kontaktId: k.id, aktivitaetArt: a, text: t, ...(erg ? { ergebnis: erg } : {}), ...(anlass ? { anlass } : {}), ...(naechster ? { naechster } : {}), ...(wann ? { wann } : {}) },
      };
    }
    case 'followup': {
      const { istWerblich } = await import('@/lib/crm/followup');
      const f = tagOk(i.faellig); const t = text(i.text, 300);
      if (!t || !f) return fehlschlag('eingabe', 'Fehlgeschlagen: text und faellig (YYYY-MM-DD) sind Pflicht.');
      if (f < heute) return fehlschlag('eingabe', `Fehlgeschlagen: ${f} liegt in der Vergangenheit.`);
      const fa = (['anruf', 'mail', 'linkedin', 'termin', 'nachricht', 'sonstig'] as FollowUpArt[]).includes(i.followup_art as FollowUpArt) ? i.followup_art as FollowUpArt : 'sonstig';
      const deal = dealAus(s, i.deal); if (istFehler(deal)) return deal;
      const mandat = text(i.mandat, 80) ? crm.mandate.find(m => m.id === text(i.mandat, 80) || suchPasst([m.titel, m.kunde], text(i.mandat, 80))) : undefined;
      const firma = firmaAus(s, i.firma); if (istFehler(firma)) return firma;
      const k = kontaktAus(s, i.kontakt, false); if (istFehler(k)) return k;
      const bezug: { art: FollowUpBezugArt; id: string } | null = deal ? { art: 'chance', id: deal.id } : mandat ? { art: 'mandat', id: mandat.id } : firma ? { art: 'firma', id: firma.id } : k ? { art: 'kontakt', id: k.id } : null;
      if (!bezug) return fehlschlag('eingabe', 'Fehlgeschlagen: Bezug fehlt (kontakt, firma, deal oder mandat).');
      let hinweis = '';
      if (k && istWerblich({ art: fa, bezug })) {
        if (k.werbesperre) return WERBESPERRE(k);
        const kp = await kanalPruefen(s, k, fa === 'anruf' ? 'telefon' : fa === 'linkedin' ? 'linkedin' : 'mail');
        if (kp.fehler) return fehlschlag('sperre', kp.fehler);
        hinweis = kp.hinweis ?? '';
      }
      const zust = text(i.zustaendig, 20);
      return {
        titel: `${ART_TITEL.followup}: ${kurz(t, 60)}`, bezugId: k ? `kontakt:${k.id}` : `${bezug.art === 'chance' ? 'deal' : bezug.art}:${bezug.id}`,
        nachher: [`${f} · ${fa}`, k && anzeigename(k), zust && `zuständig ${zust}`, hinweis].filter(Boolean).join(' · '),
        eingabe: { art, bezug, ...(k ? { kontaktId: k.id } : {}), ...(firma ? { firmaId: firma.id } : {}), followupArt: fa, text: t, faellig: f, ...(zust ? { zustaendig: zust } : {}) },
      };
    }
    case 'followup_verschieben': {
      const id = text(i.followup, 120); const f = tagOk(i.faellig);
      if (!id || !f) return fehlschlag('eingabe', 'Fehlgeschlagen: followup (Kennung aus der Akte) und faellig sind Pflicht.');
      if (f < heute) return fehlschlag('eingabe', `Fehlgeschlagen: ${f} liegt in der Vergangenheit.`);
      const echt = crm.followups.find(x => x.id === id);
      if (echt?.kontaktId && s.eingeschraenkt.has(echt.kontaktId)) return fehlschlag('sperre', 'Nicht vorgeschlagen: Die Verarbeitung dieser Person ist eingeschränkt (Art. 18 DSGVO).');
      if (!echt && !id.startsWith('v:')) return fehlschlag('nicht_gefunden', 'Fehlgeschlagen: Follow-up nicht gefunden.');
      return {
        titel: `${ART_TITEL.followup_verschieben}${echt ? `: ${kurz(echt.text, 60)}` : ''}`, bezugId: echt?.kontaktId ? `kontakt:${echt.kontaktId}` : 'markttraktion',
        vorher: echt?.faellig, nachher: f,
        eingabe: { art, followupId: id, faellig: f, ...(echt ? { _stand: stand((await rohCrm()).followups.find(x => x.id === id)) } : {}) },
      };
    }
    case 'deal_anlegen': {
      const k = kontaktAus(s, i.kontakt); if (istFehler(k) || !k) return k ?? fehlschlag('eingabe', 'Fehlgeschlagen: kontakt fehlt.');
      const schritt = text(i.naechster_schritt), datum = tagOk(i.faellig);
      if (!schritt || !datum) return fehlschlag('eingabe', 'Fehlgeschlagen: naechster_schritt und faellig sind Pflicht — ohne nächsten Schritt verliert sich der Deal.');
      const { STUFEN } = await import('@/lib/crm/pipeline');
      const stufe = STUFEN.some(x => x.id === i.stufe && x.offen) ? String(i.stufe) : undefined;
      const monat = Number(i.wert_monat) > 0 ? Math.round(Number(i.wert_monat)) : 0, einmal = Number(i.wert_einmalig) > 0 ? Math.round(Number(i.wert_einmalig)) : 0;
      const wert = monat ? { betrag: monat, basis: 'monat' } : { betrag: einmal, basis: 'einmalig' };
      const titel = text(i.titel, 160);
      return {
        titel: `${ART_TITEL.deal_anlegen}: ${titel || anzeigename(k)}`, bezugId: `kontakt:${k.id}`,
        nachher: [`Stufe ${stufe ?? 'SQL'}`, wert.betrag ? `${wert.betrag} € ${wert.basis === 'monat' ? 'im Monat' : 'einmalig'}` : 'ohne Wert', `nächster Schritt ${datum}: ${schritt}`].join(' · '),
        eingabe: { art, kontaktId: k.id, ...(k.firmaId ? { firmaId: k.firmaId } : {}), ...(titel ? { titel } : {}), wert, schritt: { text: schritt, datum }, ...(stufe ? { stufe } : {}), ...(tagOk(i.erwartet_am) ? { erwartetAm: i.erwartet_am } : {}), ...(text(i.zustaendig, 20) ? { besitzer: text(i.zustaendig, 20) } : {}) },
      };
    }
    case 'deal_aendern': {
      const d = dealAus(s, i.deal); if (istFehler(d) || !d) return d ?? fehlschlag('eingabe', 'Fehlgeschlagen: deal fehlt.');
      const { STUFEN } = await import('@/lib/crm/pipeline');
      const felder: Eingabe = {};
      if (i.stufe !== undefined) { if (!STUFEN.some(x => x.id === i.stufe)) return fehlschlag('eingabe', 'Fehlgeschlagen: unbekannte Stufe.'); felder.stufe = i.stufe as ChancenStufe; }
      if ((felder.stufe === 'verloren' || felder.stufe === 'geparkt') && !text(i.grund)) return fehlschlag('eingabe', 'Fehlgeschlagen: verloren/geparkt braucht einen Grund (grund).');
      if (text(i.grund)) felder.grund = text(i.grund, 300);
      if (text(i.naechster_schritt) && tagOk(i.faellig)) felder.naechsterSchritt = { text: text(i.naechster_schritt), datum: i.faellig };
      if (tagOk(i.erwartet_am)) felder.erwartetAm = i.erwartet_am;
      if (tagOk(i.wiedervorlage)) felder.wiedervorlage = i.wiedervorlage;
      if (!Object.keys(felder).length) return fehlschlag('eingabe', 'Fehlgeschlagen: nichts zu ändern (stufe, grund, naechster_schritt+faellig, erwartet_am, wiedervorlage).');
      const roh = (await rohCrm()).chancen.find(c => c.id === d.id);
      return {
        titel: `${ART_TITEL.deal_aendern}: ${kurz(d.titel, 60)}`, bezugId: `deal:${d.id}`,
        vorher: [`Stufe ${d.stufe}`, d.naechsterSchritt && `nächster Schritt ${d.naechsterSchritt.datum}: ${d.naechsterSchritt.text}`, d.erwartetAm && `Entscheidung bis ${d.erwartetAm}`].filter(Boolean).join(' · '),
        nachher: Object.entries(felder).map(([a, b]) => `${a} ${typeof b === 'object' ? `${(b as { datum: string }).datum}: ${(b as { text: string }).text}` : String(b)}`).join(' · '),
        eingabe: { art, dealId: d.id, felder, _stand: stand(roh), ...(d.firmaId ? { firmaId: d.firmaId } : {}) },
      };
    }
    case 'kontakt_felder': {
      const k = kontaktAus(s, i.kontakt); if (istFehler(k) || !k) return k ?? fehlschlag('eingabe', 'Fehlgeschlagen: kontakt fehlt.');
      const roh = (i.felder && typeof i.felder === 'object' && !Array.isArray(i.felder) ? i.felder : {}) as Eingabe;
      const { werteSaeubern, typenVon, kategorienVon, labelsVon } = await import('@/lib/crm/mehrfach');
      const { wer } = await import('@/lib/crm/team');
      const { istLifecycle } = await import('@/lib/crm/lifecycle');
      const { istBean } = await import('@/lib/crm/bean');
      const { LEBENSPHASEN } = await import('@/lib/make-one/crm');
      const felder: Eingabe = {}; const vorher: string[] = []; const nachher: string[] = [];
      const setze = (f: string, neu: unknown, alt: unknown) => { felder[f] = neu; vorher.push(`${f} ${Array.isArray(alt) ? alt.join(', ') || '—' : String(alt ?? '—')}`); nachher.push(`${f} ${Array.isArray(neu) ? neu.join(', ') : String(neu)}`); };
      for (const f of ['typen', 'kategorien', 'labels'] as const) if (roh[f] !== undefined) { const w = werteSaeubern(liste(roh[f])); if (w) setze(f, w, f === 'typen' ? typenVon(k) : f === 'kategorien' ? kategorienVon(k) : labelsVon(k)); }
      if (roh.zustaendig !== undefined || roh.besitzer !== undefined) { const w = wer(roh.zustaendig ?? roh.besitzer); if (!w) return fehlschlag('eingabe', `Fehlgeschlagen: zustaendig ist ${[...teamIds(), BEIDE].join(', ')}.`); setze('besitzer', w, k.besitzer); }
      if (roh.phase !== undefined) { if (!istLifecycle(roh.phase)) return fehlschlag('eingabe', 'Fehlgeschlagen: phase ist lead, mql, sql, opportunity, angebot, kunde oder follow_up.'); setze('phase', roh.phase, k.phase); }
      if (roh.bean !== undefined) { if (!istBean(roh.bean)) return fehlschlag('eingabe', 'Fehlgeschlagen: bean ist B, E, A oder N.'); setze('bean', roh.bean, k.bean); }
      if (roh.kreis !== undefined) { if (!['A', 'B', 'C', 'D'].includes(String(roh.kreis))) return fehlschlag('eingabe', 'Fehlgeschlagen: kreis ist A, B, C oder D.'); setze('kreis', roh.kreis, k.kreis); }
      if (roh.anrede !== undefined) { if (roh.anrede !== 'Sie' && roh.anrede !== 'Du') return fehlschlag('eingabe', 'Fehlgeschlagen: anrede ist Sie oder Du.'); setze('anrede', roh.anrede, k.anrede); }
      if (roh.prio !== undefined) { if (!['A', 'B', 'C', ''].includes(String(roh.prio))) return fehlschlag('eingabe', 'Fehlgeschlagen: prio ist A, B oder C.'); setze('prio', roh.prio, k.prio); }
      if (roh.lebensphase !== undefined) { if (!LEBENSPHASEN.includes(roh.lebensphase as never)) return fehlschlag('eingabe', `Fehlgeschlagen: lebensphase ist ${LEBENSPHASEN.join(', ')}.`); setze('lebensphase', roh.lebensphase, k.lebensphase); }
      for (const f of ['position', 'jobtitel', 'telefon', 'linkedin'] as const) if (roh[f] !== undefined) { const t = text(roh[f], 200); if (t) setze(f, t, k[f]); }
      // Kundengewinnung (22.10., N4 „Karte ergänzen“): Ergebnisse aus Recherche bzw. Agent — Texte, die nur per Klick in die Akte gehen.
      for (const f of KARTE_KONTAKT_FELDER) if (roh[f] !== undefined) { const t = text(roh[f], KARTE_TEXT_MAX[f]); if (t) setze(f, t, (k as unknown as Record<string, unknown>)[f]); }
      if (roh.firma !== undefined) {
        const fi = firmaAus(s, roh.firma); if (istFehler(fi) || !fi) return fi ?? fehlschlag('eingabe', 'Fehlgeschlagen: firma fehlt.');
        const { istFirmaWechsel, firmaWechselFehlt } = await import('@/lib/crm/stationen');
        const absicht = roh.firma_wechsel ?? i.firma_wechsel;
        const kroh = await rohKontakt(k.id);
        if (!istFirmaWechsel(absicht) && firmaWechselFehlt(kroh, { firmaId: fi.id })) return fehlschlag('eingabe', 'Fehlgeschlagen: Firma ändern braucht firma_wechsel (jobwechsel, zusaetzlich oder korrektur).');
        setze('firmaId', fi.id, k.firmaId); if (istFirmaWechsel(absicht)) felder.firmaWechsel = absicht;
      }
      if (!Object.keys(felder).length) return fehlschlag('eingabe', 'Fehlgeschlagen: keine erlaubten Felder (typen, kategorien, labels, zustaendig, phase, bean, kreis, anrede, prio, lebensphase, position, jobtitel, telefon, linkedin, aufhaenger, signale, marktinfo, recherche, steckbrief, vorgestelltDurch, firma + firma_wechsel). Einwilligungen, Werbesperre und Einschränkung ändert ZOE nie.');
      return {
        titel: `${ART_TITEL.kontakt_felder}: ${anzeigename(k)}`, bezugId: `kontakt:${k.id}`, vorher: vorher.join(' · '), nachher: nachher.join(' · '),
        eingabe: { art, kontaktId: k.id, felder, _stand: stand(await rohKontakt(k.id)), ...(k.firmaId ? { firmaId: k.firmaId } : {}) },
      };
    }
    case 'aufgabe': {
      const t = text(i.titel, 300); if (!t) return fehlschlag('eingabe', 'Fehlgeschlagen: titel fehlt.');
      const k = kontaktAus(s, i.kontakt, false); if (istFehler(k)) return k;
      const fi = firmaAus(s, i.firma); if (istFehler(fi)) return fi;
      const d = dealAus(s, i.deal); if (istFehler(d)) return d;
      const m = text(i.mandat, 80) ? crm.mandate.find(x => x.id === text(i.mandat, 80) || suchPasst([x.titel, x.kunde], text(i.mandat, 80))) : undefined;
      const bezug = { ...(k ? { kontaktId: k.id } : {}), ...(fi ? { firmaId: fi.id } : d?.firmaId ? { firmaId: d.firmaId } : {}), ...(d ? { dealId: d.id } : {}), ...(m ? { mandatId: m.id } : {}) };
      const faellig = tagOk(i.faellig);
      // Für wen: Kennung aus dem Team bzw. „beide“ (→ „both“ im Aufgaben-Schreibweg) — genau wie die Werkzeug-Beschreibung, sonst keine Angabe.
      const owner = i.zustaendig === BEIDE ? 'both' : typeof i.zustaendig === 'string' && teamIds().includes(i.zustaendig) ? i.zustaendig : undefined;
      return {
        titel: `${ART_TITEL.aufgabe}: ${kurz(t, 70)}`, bezugId: k ? `kontakt:${k.id}` : fi ? `firma:${fi.id}` : d ? `deal:${d.id}` : m ? `mandat:${m.id}` : 'markttraktion',
        nachher: [faellig && `fällig ${faellig}`, owner && `für ${owner}`, k && anzeigename(k), fi && fi.name, d && `Deal ${d.titel}`].filter(Boolean).join(' · ') || 'ohne Frist',
        eingabe: { art, titel: t, ...(text(i.text, 3000) ? { beschreibung: text(i.text, 3000) } : {}), ...(faellig ? { faellig } : {}), ...(owner ? { owner } : {}), bezug, ...(bezug.firmaId ? { firmaId: bezug.firmaId } : {}) },
      };
    }
    case 'qualifizierung': {
      const { leads, KRITERIEN, LEAD_STATUS } = await import('@/lib/crm/leads');
      const h = text(i.lead ?? i.firma ?? i.kontakt, 160); if (!h) return fehlschlag('eingabe', 'Fehlgeschlagen: lead fehlt (Firma f-… oder Person c-…).');
      if (s.eingeschraenkt.has(h)) return fehlschlag('sperre', 'Nicht vorgeschlagen: Die Verarbeitung dieser Person ist eingeschränkt (Art. 18 DSGVO).');
      const r = eindeutig(leads(s.kontakte, crm, heute), h, z => [z.name], suchPasst);
      if (!r) return fehlschlag('nicht_gefunden', 'Fehlgeschlagen: Kein Lead zu dieser Angabe (qualifizierung_lage zeigt, wer dran ist).');
      if (Array.isArray(r)) return fehlschlag('eingabe', `Fehlgeschlagen: Mehrdeutig — ${r.map(z => `${z.name} [${z.id}]`).join(' oder ')}.`);
      const felder: Eingabe = {};
      const kr = (i.kriterien && typeof i.kriterien === 'object' ? i.kriterien : {}) as Eingabe;
      const k2: Eingabe = {}; for (const x of KRITERIEN) if (['ja', 'nein', 'unklar'].includes(String(kr[x.id]))) k2[x.id] = kr[x.id];
      if (Object.keys(k2).length) felder.kriterien = k2;
      const an = (i.antworten && typeof i.antworten === 'object' ? i.antworten : {}) as Eingabe;
      const a2: Eingabe = {}; for (const x of KRITERIEN) if (text(an[x.id], 600)) a2[x.id] = text(an[x.id], 600);
      if (Object.keys(a2).length) felder.antworten = a2;
      if (i.lead_status !== undefined) { if (!LEAD_STATUS.some(x => x.id === i.lead_status)) return fehlschlag('eingabe', 'Fehlgeschlagen: unbekannter lead_status.'); felder.status = i.lead_status; }
      if (['ja', 'nein', 'unklar'].includes(String(i.fit))) felder.fit = i.fit;
      if (text(i.text, 1500)) felder.notiz = text(i.text, 1500);
      if (!Object.keys(felder).length) return fehlschlag('eingabe', 'Fehlgeschlagen: nichts zu ergänzen (kriterien, antworten, lead_status, fit, text als Notiz).');
      const rc = await rohCrm();
      const rohLead = r.art === 'firma' ? rc.firmen.find(f => f.id === r.id)?.lead : (await rohKontakt(r.id))?.lead;
      return {
        titel: `${ART_TITEL.qualifizierung}: ${r.name}`, bezugId: r.art === 'firma' ? `firma:${r.id}` : `kontakt:${r.id}`,
        vorher: `Status ${r.status} · ${Object.entries(r.kriterien).map(([a, b]) => `${a} ${b}`).join(', ')}`,
        nachher: [felder.status && `Status ${String(felder.status)}`, felder.kriterien && Object.entries(felder.kriterien as Eingabe).map(([a, b]) => `${a} ${String(b)}`).join(', '), felder.antworten && Object.entries(felder.antworten as Eingabe).map(([a, b]) => `${a}: ${String(b)}`).join(' | '), felder.fit && `Fit ${String(felder.fit)}`].filter(Boolean).join(' · '),
        eingabe: { art, leadId: r.id, felder, _stand: stand(rohLead ?? {}), ...(r.art === 'firma' ? { firmaId: r.id } : {}) },
      };
    }
    case 'dubletten': {
      const a = kontaktAus(s, i.behalten); if (istFehler(a) || !a) return a ?? fehlschlag('eingabe', 'Fehlgeschlagen: behalten fehlt.');
      const b = kontaktAus(s, i.weg); if (istFehler(b) || !b) return b ?? fehlschlag('eingabe', 'Fehlgeschlagen: weg fehlt.');
      if (a.id === b.id) return fehlschlag('eingabe', 'Fehlgeschlagen: behalten und weg sind dieselbe Person.');
      const { zusammenfuehrenPruefen, wasWandert, wanderungText } = await import('@/lib/crm/dubletten');
      const ra = await rohKontakt(a.id), rb = await rohKontakt(b.id);
      const nein = ra && rb ? zusammenfuehrenPruefen(ra, rb) : 'nicht gefunden';
      if (nein) return fehlschlag(ra && rb ? 'sperre' : 'nicht_gefunden', `Nicht vorgeschlagen: ${nein}`);
      return {
        titel: `${ART_TITEL.dubletten}: ${anzeigename(b)} → ${anzeigename(a)}`, bezugId: `kontakt:${a.id}`,
        vorher: `${a.id} und ${b.id} getrennt`, nachher: `${b.id} geht in ${a.id} auf · es wandert: ${wanderungText(wasWandert(crm, b))} · rückgängig über Stammdaten › Dubletten`,
        eingabe: { art, behalten: a.id, weg: b.id, _stand: { behalten: stand(ra), weg: stand(rb) } },
      };
    }
    case 'reparatur': {
      const { istReparierbar, REPARIERBAR, verbindungenReparieren } = await import('@/lib/crm/verbindungen');
      const { ladeVerbindungsBestaende } = await import('@/lib/crm/verbindungen-laden');
      const ids = liste(i.befunde).filter(istReparierbar);
      if (!ids.length) return fehlschlag('eingabe', `Fehlgeschlagen: befunde braucht reparierbare Kennungen (${REPARIERBAR.join(', ')}) — siehe datenqualitaet.`);
      const vs = verbindungenReparieren(await ladeVerbindungsBestaende(heute, s.person), ids, new Date().toISOString(), s.person);
      return {
        titel: `${ART_TITEL.reparatur}: ${ids.join(', ')}`, bezugId: 'markttraktion',
        nachher: vs.aenderungen.map(a => `${a.text} (${a.anzahl})`).join(' · ') || 'nichts zu reparieren (schon sauber)',
        eingabe: { art, befunde: ids },
      };
    }
    case 'import_konflikt': {
      const k = kontaktAus(s, i.kontakt); if (istFehler(k) || !k) return k ?? fehlschlag('eingabe', 'Fehlgeschlagen: kontakt fehlt.');
      const feld = text(i.feld, 40); const wahl = i.wahl === 'online' || i.wahl === 'liste' ? i.wahl : null;
      if (!feld || !wahl) return fehlschlag('eingabe', 'Fehlgeschlagen: feld und wahl (online | liste) sind Pflicht.');
      const { KONFLIKT_SPEICHER } = await import('@/lib/crm/import-konflikte');
      const kf = ((await loadJson<import('@/lib/crm/import-konflikte').KonfliktStand>(KONFLIKT_SPEICHER))?.konflikte ?? []).find(x => x.kontaktId === k.id && x.feld === feld);
      if (!kf) return fehlschlag('konflikt', 'Fehlgeschlagen: Dieser Konflikt ist nicht (mehr) offen.');
      const fw = ['jobwechsel', 'zusaetzlich', 'korrektur'].includes(String(i.firma_wechsel)) ? String(i.firma_wechsel) : undefined;
      return {
        titel: `${ART_TITEL.import_konflikt}: ${anzeigename(k)} · ${feld}`, bezugId: `kontakt:${k.id}`,
        vorher: `online „${kurz(String(kf.online ?? ''), 60)}“ ↔ Liste „${kurz(String(kf.liste ?? ''), 60)}“`, nachher: wahl === 'online' ? 'online behalten' : 'Liste übernehmen',
        eingabe: { art, kontaktId: k.id, feld, wahl, ...(fw ? { firmaWechsel: fw } : {}) },
      };
    }
    case 'angebot_entwurf': {
      const A = await import('@/lib/crm/angebote');
      const alt = text(i.angebot, 80) ? (crm.angebote ?? []).find(a => a.id === text(i.angebot, 80)) : undefined;
      if (text(i.angebot, 80) && !alt) return fehlschlag('nicht_gefunden', 'Fehlgeschlagen: Angebot nicht gefunden.');
      if (alt && alt.status !== 'entwurf') return fehlschlag('konflikt', `Fehlgeschlagen: Das Angebot ist ${alt.status} — ändern nur als neue Version im Angebots-Tool. ZOE bereitet nur Entwürfe vor.`);
      const k = kontaktAus(s, i.kontakt, false); if (istFehler(k)) return k;
      if (k?.werbesperre) return WERBESPERRE(k);
      const fi = firmaAus(s, i.firma); if (istFehler(fi)) return fi;
      const d = dealAus(s, i.deal); if (istFehler(d)) return d;
      const g = text(i.gesellschaft, 3) || alt?.gesellschaft;
      if (!A.istGesellschaft(g)) return fehlschlag('eingabe', `Fehlgeschlagen: gesellschaft ist ${GESELLSCHAFTEN.join(', ')}.`);
      const pos = Array.isArray(i.positionen) ? (i.positionen as Eingabe[]).slice(0, A.ANGEBOT_GRENZEN.positionen).map((p, n) => ({
        id: `p${n + 1}`, titel: text(p.titel, A.ANGEBOT_GRENZEN.titel), text: text(p.text, A.ANGEBOT_GRENZEN.text), menge: Number(p.menge) > 0 ? Number(p.menge) : 1, einheit: text(p.einheit, 30) || 'pauschal',
        einzelpreisCent: Math.round((Number(p.einzelpreis) || 0) * 100), ustSatz: [19, 7, 0].includes(Number(p.ust_satz)) ? Number(p.ust_satz) : 19,
        basis: ['einmalig', 'monat', 'jahr'].includes(String(p.basis)) ? String(p.basis) : 'einmalig', ...(Number(p.laufzeit_monate) > 0 ? { laufzeitMonate: Math.round(Number(p.laufzeit_monate)) } : {}),
        ...(text(p.leistung, 80) && crm.leistungen.some(l => l.id === text(p.leistung, 80)) ? { leistungId: text(p.leistung, 80) } : {}),
      })).filter(p => p.titel) : [];
      if (!pos.length && !alt) return fehlschlag('eingabe', 'Fehlgeschlagen: positionen fehlen (titel, text, menge, einheit, einzelpreis in €, ust_satz, basis).');
      const felder: Eingabe = {
        gesellschaft: g, ...(k ? { kontaktId: k.id } : {}), ...(fi ? { firmaId: fi.id } : k?.firmaId ? { firmaId: k.firmaId } : {}), ...(d ? { dealId: d.id } : {}),
        ...(text(i.titel, 200) ? { titel: text(i.titel, 200) } : {}), ...(pos.length ? { positionen: pos } : {}),
        ...(text(i.einleitung, 6000) ? { einleitung: text(i.einleitung, 6000) } : {}), ...(text(i.schluss, 6000) ? { schluss: text(i.schluss, 6000) } : {}),
        ...(tagOk(i.gueltig_bis) ? { gueltigBis: i.gueltig_bis } : {}),
      };
      const summe = pos.length ? A.angebotSummen({ positionen: pos as never }) : null;
      const rohA = alt ? (await rohCrm()).angebote.find(a => a.id === alt.id) : undefined;
      return {
        titel: `${ART_TITEL.angebot_entwurf}${alt ? ' (ändern)' : ''}: ${text(i.titel, 80) || alt?.titel || 'neues Angebot'}`, bezugId: k ? `kontakt:${k.id}` : alt ? `angebot:${alt.id}` : fi ? `firma:${fi.id}` : d ? `deal:${d.id}` : 'markttraktion',
        nachher: [`Entwurf ${g}`, summe && `netto ${A.euroCent(summe.gesamt.netto)}`, `${pos.length} Positionen`, 'bleibt Entwurf — stellen nur im Angebots-Tool'].filter(Boolean).join(' · '),
        eingabe: { art, ...(alt ? { angebotId: alt.id, _stand: stand(rohA) } : {}), felder, ...(felder.firmaId ? { firmaId: felder.firmaId } : {}) },
      };
    }
    case 'nachricht_entwurf': case 'anruf_leitfaden': case 'einladung_entwurf': case 'danke_entwurf': {
      const k = kontaktAus(s, i.kontakt); if (istFehler(k) || !k) return k ?? fehlschlag('eingabe', 'Fehlgeschlagen: kontakt fehlt.');
      if (k.werbesperre) return WERBESPERRE(k);
      const t = text(i.text, 6000); if (!t) return fehlschlag('eingabe', 'Fehlgeschlagen: text fehlt.');
      const kanal = art === 'anruf_leitfaden' ? 'telefon' : art === 'einladung_entwurf' ? 'einladung' : i.kanal === 'linkedin' ? 'linkedin' : 'mail';
      const kp = await kanalPruefen(s, k, kanal as 'mail' | 'linkedin' | 'telefon' | 'einladung');
      // Danke nach einem Event ist Beziehungspflege, keine Werbung — trotzdem nur, wo der Kanal nicht rot ist.
      if (kp.fehler) return fehlschlag('sperre', kp.fehler);
      const betreff = text(i.betreff, 200);
      const { mailtoLink } = await import('@/lib/crm/angebote');
      const mailto = kanal === 'mail' || kanal === 'einladung' ? (k.email ? mailtoLink(k.email, betreff, t) : undefined) : undefined;
      return {
        titel: `${ART_TITEL[art]}: ${anzeigename(k)}${betreff ? ` · ${kurz(betreff, 50)}` : ''}`, bezugId: `kontakt:${k.id}`,
        nachher: [`Kanal ${kanal} (${kp.farbe})`, kp.hinweis, 'nur Text zum Kopieren — nichts wird versendet'].filter(Boolean).join(' · '),
        eingabe: { art, kontaktId: k.id, kanal, ...(betreff ? { betreff } : {}), text: t, ...(mailto ? { _mailto: mailto } : {}), ...(text(i.event, 80) ? { eventId: text(i.event, 80) } : {}), ...(k.firmaId ? { firmaId: k.firmaId } : {}) },
      };
    }
    case 'powerhour_reihenfolge': {
      const ids = liste(i.kontakte);
      if (!ids.length) return fehlschlag('eingabe', 'Fehlgeschlagen: kontakte (Kennungen in der vorgeschlagenen Reihenfolge) fehlen.');
      const raus: string[] = []; const drin: string[] = [];
      for (const id of ids) { const k = s.kontakt(id); if (!k || k.werbesperre) raus.push(id); else drin.push(k.id); }
      if (!drin.length) return fehlschlag('sperre', 'Fehlgeschlagen: keiner der Kontakte ist ansprechbar (eingeschränkt, gesperrt oder unbekannt).');
      return {
        titel: `${ART_TITEL.powerhour_reihenfolge}: ${drin.length} Anrufe`, bezugId: 'markttraktion',
        nachher: `${drin.map((id, n) => `${n + 1}. ${s.name(id)}`).join(' · ')}${raus.length ? ` · ${raus.length} ausgelassen (eingeschränkt, gesperrt oder unbekannt)` : ''}`,
        eingabe: { art, kontaktIds: drin, ...(text(i.text, 4000) ? { text: text(i.text, 4000) } : {}) },
      };
    }
    case 'beitrag_entwurf': {
      const t = text(i.titel, 200); const inhalt = text(i.text, 8000);
      if (!t || !inhalt) return fehlschlag('eingabe', 'Fehlgeschlagen: titel und text sind Pflicht.');
      const kanal = ['linkedin', 'newsletter', 'blog', 'podcast', 'vortrag', 'sonstig'].includes(String(i.beitrag_kanal)) ? String(i.beitrag_kanal) : 'linkedin';
      const stimme = [...teamIds(), 'marke'].includes(String(i.stimme)) ? String(i.stimme) : undefined;
      return {
        titel: `${ART_TITEL.beitrag_entwurf}: ${kurz(t, 70)}`, bezugId: 'markttraktion',
        nachher: [`Entwurf · ${kanal}`, stimme && `Stimme ${stimme}`, 'veröffentlicht wird nichts'].filter(Boolean).join(' · '),
        eingabe: { art, titel: t, text: inhalt, kanal, ...(stimme ? { stimme } : {}), ...(text(i.saeule, 60) ? { saeule: text(i.saeule, 60) } : {}), ...(tagOk(i.faellig) ? { datum: i.faellig } : {}) },
      };
    }
    case 'newsletter_entwurf': {
      const t = text(i.titel, 200); const inhalt = text(i.text, 20000);
      if (!t || !inhalt) return fehlschlag('eingabe', 'Fehlgeschlagen: titel und text sind Pflicht.');
      const { newsletterEmpfaenger } = await import('@/lib/crm/marketing');
      const n = newsletterEmpfaenger(s.kontakte).length;
      return {
        titel: `${ART_TITEL.newsletter_entwurf}: ${kurz(t, 70)}`, bezugId: 'markttraktion',
        nachher: `Entwurf · ${n} Empfänger mit Double-Opt-in (nur sie) · versendet wird nichts`,
        eingabe: { art, titel: t, inhalt, ...(tagOk(i.faellig) ? { datum: i.faellig } : {}) },
      };
    }
    case 'segment': {
      const name = text(i.name ?? i.titel, 80); if (!name) return fehlschlag('eingabe', 'Fehlgeschlagen: name fehlt.');
      const kr = (i.kriterien && typeof i.kriterien === 'object' && !Array.isArray(i.kriterien) ? i.kriterien : {}) as SegmentKriterien;
      const { kriterienSauber, kriterienText } = await import('@/lib/crm/marketing');
      const { segmentAuswerten, kontextAus } = await import('@/lib/crm/segmente');
      const sauber = kriterienSauber(kr);
      const a = segmentAuswerten(s.kontakte, sauber, kontextAus(crm, heute));
      return {
        titel: `${ART_TITEL.segment}: ${name}`, bezugId: 'markttraktion',
        nachher: `${kriterienText(sauber) || 'ohne Kriterien'} · ${a.anzahl} Personen · zulässig erreichbar: Mail ${a.kanaele.mail}, Newsletter ${a.kanaele.newsletter}, Einladung ${a.kanaele.einladung} (Werbesperre und Einschränkung zählen nie)`,
        eingabe: { art, name, ...(text(i.text, 300) ? { beschreibung: text(i.text, 300) } : {}), kriterien: sauber },
      };
    }
    case 'gaesteliste': {
      const e = s.crm.events.find(x => x.id === text(i.event, 80) || suchPasst([x.titel], text(i.event, 80)));
      if (!e) return fehlschlag('nicht_gefunden', 'Fehlgeschlagen: event nicht gefunden (Kennung aus events_lage).');
      const schon = new Set(crm.teilnahmen.filter(t => t.eventId === e.id).map(t => t.kontaktId));
      const drin: string[] = []; const raus: string[] = [];
      for (const id of liste(i.kontakte)) {
        const k = s.kontakt(id);
        if (!k || k.werbesperre || schon.has(k.id)) { raus.push(id); continue; }
        // Einladen ist werblich: nur mit zulässigem Einladungskanal (Ampel nicht rot).
        if ((await kanalPruefen(s, k, 'einladung')).fehler) { raus.push(id); continue; }
        drin.push(k.id);
      }
      if (!drin.length) return fehlschlag('sperre', 'Fehlgeschlagen: niemand vorzumerken (gesperrt, ohne Grundlage für eine Einladung, schon auf der Liste oder unbekannt).');
      return {
        titel: `${ART_TITEL.gaesteliste}: ${e.titel} (${drin.length})`, bezugId: `event:${e.id}`,
        nachher: `${drin.map(id => s.name(id)).join(', ')} als „vorgemerkt“${raus.length ? ` · ${raus.length} ausgelassen (Werbesperre, keine Grundlage, schon dabei oder unbekannt)` : ''} · eingeladen wird nichts`,
        eingabe: { art, eventId: e.id, kontaktIds: drin },
      };
    }
    case 'leistungstext': {
      const l = crm.leistungen.find(x => x.id === text(i.leistung, 80) || suchPasst([x.name], text(i.leistung, 80)));
      if (!l) return fehlschlag('nicht_gefunden', 'Fehlgeschlagen: leistung (Produkt) nicht gefunden — siehe stammdaten_lage.');
      const lt = text(i.text, 6000); if (!lt) return fehlschlag('eingabe', 'Fehlgeschlagen: text (Leistungstext) fehlt.');
      const angebot = { ...(l.angebot ?? {}), leistungstext: lt, ...(text(i.titel, 200) ? { titel: text(i.titel, 200) } : {}), ...(text(i.einleitung, 3000) ? { einleitung: text(i.einleitung, 3000) } : {}) };
      const aktiv = i.aktiv_setzen === true && l.status !== 'aktiv';
      const roh = (await rohCrm()).leistungen.find(x => x.id === l.id);
      return {
        titel: `${ART_TITEL.leistungstext}: ${l.name}`, bezugId: 'markttraktion',
        vorher: l.angebot?.leistungstext ? kurz(l.angebot.leistungstext, 120) : 'kein Leistungstext',
        nachher: `${kurz(lt, 160)}${aktiv ? ' · Produkt danach aktiv' : ''}`,
        eingabe: { art, leistungId: l.id, angebot, ...(aktiv ? { aktiv: true } : {}), _stand: stand(roh) },
      };
    }
    case 'head_entscheiden': {
      const { HEADS, HEAD_NAME } = await import('@/lib/heads/prompt');
      const { standName } = await import('@/lib/heads/stand');
      const { ABLEHNGRUENDE } = await import('@/lib/heads/lernen');
      const h = HEADS.find(x => x === i.head);
      if (!h) return fehlschlag('eingabe', 'Fehlgeschlagen: head ist sales, marketing oder event.');
      const st = await loadJson<import('@/lib/heads/stand').HeadStand>(standName(h));
      const hv = (st?.vorschlaege ?? []).find(x => x.id === text(i.vorschlag, 80));
      if (!hv) return fehlschlag('nicht_gefunden', 'Fehlgeschlagen: Vorschlag des Heads nicht gefunden (Kennung aus heads_lage).');
      if (hv.status !== 'offen') return fehlschlag('konflikt', `Fehlgeschlagen: schon entschieden (${hv.status}).`);
      if (hv.kontakt_id && s.eingeschraenkt.has(hv.kontakt_id)) return fehlschlag('sperre', 'Nicht vorgeschlagen: Die Verarbeitung dieser Person ist eingeschränkt (Art. 18 DSGVO).');
      const status = i.entscheidung === 'abgelehnt' ? 'abgelehnt' : 'angenommen';
      const grund = status === 'abgelehnt' ? ABLEHNGRUENDE.find(g => g.id === i.grund)?.id : undefined;
      if (status === 'abgelehnt' && !grund) return fehlschlag('eingabe', `Fehlgeschlagen: Ablehnen braucht grund (${ABLEHNGRUENDE.map(g => g.id).join(', ')}) — daraus lernt der Head.`);
      const k = hv.kontakt_id ? s.kontakt(hv.kontakt_id) : undefined;
      if (status === 'angenommen' && k?.werbesperre && hv.entwurf) return WERBESPERRE(k);
      return {
        titel: `${ART_TITEL.head_entscheiden}: ${HEAD_NAME[h]} · ${kurz(hv.titel, 60)}`, bezugId: hv.kontakt_id ? `kontakt:${hv.kontakt_id}` : 'markttraktion',
        vorher: `offen · ${hv.art}${hv.frist ? ` · Frist ${hv.frist}` : ''}`,
        nachher: status === 'angenommen' ? 'annehmen — wird nächster Schritt an der Person bzw. Aufgabe/Kampagnen-Entwurf wie im Head-Fenster; nichts wird versendet' : `ablehnen (${grund}) — der Head lernt daraus`,
        eingabe: { art, head: h, vorschlagId: hv.id, status, ...(grund ? { grund } : {}), ...(k?.firmaId ? { firmaId: k.firmaId } : {}) },
      };
    }
    // ── Kundengewinnung (22.10.) ──
    case 'firma_felder': {
      const fi = firmaAus(s, i.firma); if (istFehler(fi) || !fi) return fi ?? fehlschlag('eingabe', 'Fehlgeschlagen: firma fehlt.');
      const roh = (i.felder && typeof i.felder === 'object' && !Array.isArray(i.felder) ? i.felder : {}) as Eingabe;
      const felder: Eingabe = {}; const vorher: string[] = []; const nachher: string[] = [];
      const alt = fi as unknown as Record<string, unknown>;
      for (const f of KARTE_FIRMA_FELDER) {
        if (roh[f] === undefined) continue;
        if (f === 'branchen') { const l = liste(roh[f]).map(x => text(x, 80)).filter(Boolean).slice(0, 20); if (l.length) { felder[f] = l; vorher.push(`${f} ${(fi.branchen ?? []).join(', ') || '—'}`); nachher.push(`${f} ${l.join(', ')}`); } continue; }
        const t = text(roh[f], KARTE_TEXT_MAX[f] ?? 200);
        if (!t) continue;
        if ((f === 'webseite' || f === 'linkedin') && !httpsOk(t)) return fehlschlag('eingabe', `Fehlgeschlagen: ${f} nur als https-Adresse.`);
        felder[f] = t; vorher.push(`${f} ${String(alt[f] ?? '—')}`); nachher.push(`${f} ${t}`);
      }
      if (!Object.keys(felder).length) return fehlschlag('eingabe', `Fehlgeschlagen: keine erlaubten Felder (${KARTE_FIRMA_FELDER.join(', ')}).`);
      const quelle = text(i.quelle, 300);
      const roh2 = (await rohCrm()).firmen.find(x => x.id === fi.id);
      return {
        titel: `${ART_TITEL.firma_felder}: ${fi.name}`, bezugId: `firma:${fi.id}`, vorher: vorher.join(' · '), nachher: [nachher.join(' · '), quelle && `Quelle: ${quelle}`].filter(Boolean).join(' · '),
        eingabe: { art, firmaId: fi.id, felder, _stand: stand(roh2), ...(quelle ? { quelle } : {}) },
      };
    }
    case 'lead_parken': {
      const { leads: alleLeads, ausscheidenGesperrt } = await import('@/lib/crm/leads');
      const { istGrundParken } = await import('@/lib/crm/lead-grund');
      const { tagePlus } = await import('@/lib/zeit');
      const h = text(i.lead ?? i.firma ?? i.kontakt, 160); if (!h) return fehlschlag('eingabe', 'Fehlgeschlagen: lead fehlt (Firma f-… oder Person c-…).');
      if (s.eingeschraenkt.has(h)) return fehlschlag('sperre', 'Nicht vorgeschlagen: Die Verarbeitung dieser Person ist eingeschränkt (Art. 18 DSGVO).');
      const r = eindeutig(alleLeads(s.kontakte, crm, heute), h, z => [z.name], suchPasst);
      if (!r) return fehlschlag('nicht_gefunden', 'Fehlgeschlagen: Kein Lead zu dieser Angabe.');
      if (Array.isArray(r)) return fehlschlag('eingabe', `Fehlgeschlagen: Mehrdeutig — ${r.map(z => `${z.name} [${z.id}]`).join(' oder ')}.`);
      const gesperrt = ausscheidenGesperrt(r);
      if (gesperrt) return fehlschlag('konflikt', `Nicht vorgeschlagen: ${gesperrt}`);
      const tage = Number(i.park_tage ?? i.parkTage);
      const bis = tagOk(i.bis) ?? (Number.isInteger(tage) && tage >= 1 && tage <= 365 ? tagePlus(heute, tage) : undefined);
      if (!bis || bis < heute) return fehlschlag('eingabe', 'Fehlgeschlagen: bis (YYYY-MM-DD ab heute) oder park_tage (1–365) ist Pflicht.');
      const grundArt = istGrundParken(i.grund_art ?? i.grundArt) ? String(i.grund_art ?? i.grundArt) : 'spaeter';
      const grund = text(i.grund, 300);
      return {
        titel: `${ART_TITEL.lead_parken}: ${r.name}`, bezugId: r.art === 'firma' ? `firma:${r.id}` : `kontakt:${r.id}`,
        vorher: `Status ${r.status}`, nachher: `ruht bis ${bis} (${grundArt}) · danach zurück in der Runde · Follow-up „Wiedervorlage Qualifizierung“`,
        eingabe: { art, leadId: r.id, bis, grundArt, ...(grund ? { grund } : {}), ...(r.art === 'firma' ? { firmaId: r.id } : {}) },
      };
    }
    case 'mandat_anlegen': {
      const d = dealAus(s, i.deal); if (istFehler(d) || !d) return d ?? fehlschlag('eingabe', 'Fehlgeschlagen: deal fehlt.');
      if (d.stufe !== 'gewonnen') return fehlschlag('konflikt', 'Nicht vorgeschlagen: Nur ein gewonnener Deal wird Mandat.');
      if (crm.mandate.some(m => m.chanceId === d.id)) return fehlschlag('konflikt', 'Nicht vorgeschlagen: Zu diesem Deal gibt es schon ein Mandat.');
      if (d.kontaktIds.some(id => s.eingeschraenkt.has(id))) return fehlschlag('sperre', 'Nicht vorgeschlagen: Die Verarbeitung einer Person des Deals ist eingeschränkt (Art. 18 DSGVO).');
      return {
        titel: `${ART_TITEL.mandat_anlegen}: ${kurz(d.titel, 70)}`, bezugId: `deal:${d.id}`,
        vorher: 'gewonnen, ohne Mandat', nachher: 'Mandat aus dem Deal (Vorbelegung aus dem angenommenen Angebot bzw. der Produkt-Karte) · Honorar zählt danach in MRR und Index',
        eingabe: { art, dealId: d.id, ...(d.firmaId ? { firmaId: d.firmaId } : {}) },
      };
    }
    case 'kampagnen_ergebnis': {
      const kp = crm.kampagnen.find(x => x.id === text(i.kampagne, 80) || suchPasst([x.name], text(i.kampagne, 80)));
      if (!kp) return fehlschlag('nicht_gefunden', 'Fehlgeschlagen: kampagne nicht gefunden (Kennung aus kampagnen_lage).');
      const k = kontaktAus(s, i.kontakt); if (istFehler(k) || !k) return k ?? fehlschlag('eingabe', 'Fehlgeschlagen: kontakt fehlt.');
      if (!kp.kontaktIds.includes(k.id)) return fehlschlag('eingabe', 'Fehlgeschlagen: Die Person gehört nicht zu dieser Kampagne.');
      const ERG = ['angesprochen', 'reagiert', 'gespraech', 'chance', 'kein_interesse'];
      const erg = ERG.includes(String(i.ergebnis)) ? String(i.ergebnis) : null;
      if (!erg) return fehlschlag('eingabe', `Fehlgeschlagen: ergebnis ist ${ERG.join(', ')}.`);
      return {
        titel: `${ART_TITEL.kampagnen_ergebnis}: ${kp.name} · ${anzeigename(k)}`, bezugId: `kontakt:${k.id}`,
        nachher: `${erg}${erg === 'chance' ? ' · der Lead geht in die Qualifizierung' : ''}`,
        eingabe: { art, kampagneId: kp.id, kontaktId: k.id, ergebnis: erg, ...(k.firmaId ? { firmaId: k.firmaId } : {}) },
      };
    }
    case 'anfrage_anlegen': {
      const { anfrageBauen, ANFRAGE_KANAELE } = await import('@/lib/crm/anfragen');
      const kanal = String(i.kanal ?? 'website');
      if (!ANFRAGE_KANAELE.some(x => x.id === kanal)) return fehlschlag('eingabe', `Fehlgeschlagen: kanal ist ${ANFRAGE_KANAELE.map(x => x.id).join(', ')}.`);
      const t = text(i.text, 3000); if (!t) return fehlschlag('eingabe', 'Fehlgeschlagen: text (was angefragt wurde) fehlt.');
      // Vorhandene Person (Kennung) — oder neu aus den Feldern (Webhook: fremder Text — darum nur als Vorschlag; Dublette, Art. 18, Werbesperre prüft anfrageBauen).
      const kid = text(i.kontakt, 80);
      const vorhanden = kid ? s.kontakte.find(x => x.id === kid) : undefined;
      if (kid && s.eingeschraenkt.has(kid)) return fehlschlag('sperre', 'Nicht vorgeschlagen: Die Verarbeitung dieser Person ist eingeschränkt (Art. 18 DSGVO).');
      if (kid && !vorhanden) return fehlschlag('nicht_gefunden', 'Fehlgeschlagen: Kontakt nicht gefunden.');
      const neu = vorhanden ? undefined : { vorname: text(i.vorname, 80), nachname: text(i.nachname, 80), email: text(i.email, 160), firma: text(i.firma_name ?? i.firma, 160), telefon: text(i.telefon, 60) };
      const probe = anfrageBauen({ ...(vorhanden ? { kontaktId: vorhanden.id } : { neu }), kanal: kanal as never, text: t }, { kontakte: await karteiFuerPruefung(), crm: await rohCrm(), person: s.person, heute, jetzt: new Date().toISOString(), ids: { kontakt: 'c-probe', followUp: 'fu-probe' } });
      if (!probe.ok) return fehlschlag('eingabe', `Nicht vorgeschlagen: ${probe.fehler}`);
      const wer = vorhanden ? anzeigename(vorhanden) : [neu?.vorname, neu?.nachname].filter(Boolean).join(' ') || neu?.firma || neu?.email || 'neue Person';
      return {
        titel: `${ART_TITEL.anfrage_anlegen}: ${kurz(wer, 60)} (${kanal})`, bezugId: vorhanden ? `kontakt:${vorhanden.id}` : 'markttraktion',
        nachher: [probe.bau.neuePerson ? 'neue Person in der Kartei' : 'an die vorhandene Person', `Kanal ${kanal}`, 'Follow-up „Anfrage beantworten“ heute', 'versendet wird nichts'].join(' · '),
        eingabe: { art, kanal, text: t, ...(vorhanden ? { kontaktId: vorhanden.id } : { neu }) },
      };
    }
  }
}

/** Antwort an die Sicht Privat (Prüf-Funde 11.10.) — ohne Titel, ohne Namen, ohne Vorher/Nachher. */
export const PRIVAT_VORGESCHLAGEN = 'VORGESCHLAGEN, NICHT AUSGEFÜHRT — Der Vorschlag liegt unter „Business“ im Freigabe-Stapel (Markttraktion). Sag der Person nur das: ein Vorschlag für die Markttraktion wartet unter Business auf ihre Freigabe — ohne Inhalte, die gehören zu Business. Behaupte NICHT, es sei erledigt.';
export const PRIVAT_NICHT_VORGESCHLAGEN = 'Nicht vorgeschlagen: Die Prüfung in der Markttraktion hat nicht gepasst. Details gehören zu Business — sag der Person, dass sie es oben unter „Business“ fragen kann.';

/** Das Werkzeug `crm_vorschlag`: prüfen, Vorher/Nachher rechnen, als Stapel-Art „crm“ ablegen — ändert nichts. */
export async function crmVorschlag(input: Eingabe, _origin: string, person?: string, kontext?: { herkunft?: string; sicht?: 'privat' | 'business' }): Promise<WerkzeugRueckgabe> {
  try {
    const s = await crmSicht(person);
    if (!s || !person) return fehlschlag('rechte', NICHT_IM_HINTERGRUND);
    const art = String(input.art ?? '') as VorschlagArt;
    if (!(VORSCHLAG_ARTEN as readonly string[]).includes(art)) return fehlschlag('eingabe', `Fehlgeschlagen: art ist eine von ${VORSCHLAG_ARTEN.join(', ')}.`);
    // Sicht Privat (Prüf-Funde 11.10.): crm_vorschlag darf dort nur ABLEGEN — Titel, Vorher/Nachher und Prüf-Sätze nennen Namen und Stände aus der
    // Markttraktion und gehören nicht ins Modell bzw. in den Privat-Thread. Die Antwort sagt nur, dass (bzw. dass nicht) etwas unter Business liegt.
    const privatSicht = kontext?.sicht === 'privat';
    const p = await planen(art, input, s);
    if (istWerkzeugErgebnis(p)) return privatSicht && !p.ok ? fehlschlag(p.klasse ?? 'eingabe', PRIVAT_NICHT_VORGESCHLAGEN) : p;
    const v = await lege({
      werkzeug: CRM_VORSCHLAG_WERKZEUG, gruppe: 'crm', titel: p.titel, ...(p.vorher ? { vorher: p.vorher } : {}), nachher: p.nachher,
      eingabe: p.eingabe, person, quelle: 'gespraech', bezug: { art: 'crm', id: p.bezugId },
      // Aus dem Agenten-Bereich (Durchstich 09.10.): „<Head>: …“ vorne — der Vorschlag zählt dann beim Head (Zähler, Annahmequote).
      ...(kontext?.herkunft || text(input.begruendung, 400) ? { anlass: [kontext?.herkunft, text(input.begruendung, 400)].filter(Boolean).join(' — ').slice(0, 600) } : {}),
    });
    if (privatSicht) return brauchtFreigabe(PRIVAT_VORGESCHLAGEN, v.id);
    return brauchtFreigabe(`VORGESCHLAGEN, NICHT AUSGEFÜHRT — ${p.titel}: ${p.vorher ? `${p.vorher} → ` : ''}${p.nachher}. Liegt als Vorschlag ${v.id} im Freigabe-Stapel (und an der Kontakt-/Firmenakte). Sag knapp, was du vorbereitet hast, und dass es auf die Freigabe wartet — behaupte NICHT, es sei erledigt oder versendet.`, v.id);
  } catch (e) {
    console.error('[zoe/crm-vorschlag]', e instanceof Error ? e.message : e);
    return fehlschlag('voruebergehend', 'Fehlgeschlagen: Der Vorschlag konnte gerade nicht vorbereitet werden.');
  }
}

// ── Freigeben: über die normalen Schreibwege (Route im Prozess, Dienstweg mit Person) ──

// Seit 09.10. liegt der interne Hop an EINER Stelle (lib/zoe/innen.ts) — dieselbe für die Finanz-, Planungs- und CRM-Altwerkzeuge.
type Antwort = InnenAntwort;
export { innen };

const fehlerText = (a: Antwort) => String(a.json.fehler ?? a.json.error ?? `Abgelehnt (${a.status}).`);
const statusVon = (n: number): Status => (n === 400 || n === 403 || n === 404 || n === 409 || n === 413 ? n : 409);
const KONFLIKT: ArtErgebnis = { ok: false, status: 409, fehler: 'Inzwischen geändert — der Datensatz ist nicht mehr so wie beim Vorschlag. Nichts übernommen; bitte ZOE neu vorschlagen lassen oder von Hand ändern.' };
type Ergebnis = { ok: true; text: string } | Extract<ArtErgebnis, { ok: false }>;
const ok = (t: string): Ergebnis => ({ ok: true, text: t });
const aus = (a: Antwort, erfolg: string): Ergebnis => (a.status >= 400 || a.json.ok === false ? { ok: false, status: statusVon(a.status), fehler: fehlerText(a) } : ok(erfolg));

/**
 * Feste Kennungen aus der Vorschlags-Kennung (29.09.): was ohne Stand angelegt wird (Aktivität, Follow-up, Beitrag,
 * Newsletter, Segment, Gäste), trägt die Kennung des Vorschlags — eine zweite Ausführung desselben Vorschlags (Doppelklick,
 * zweites Fenster, verwaister Anspruch nach Absturz) legt nichts doppelt an.
 */
export const ausVorschlag = (praefix: string, vorschlagId: string, i?: number) => `${praefix}-${vorschlagId}${i === undefined ? '' : `-${i}`}`;
const SCHON = (was: string): Ergebnis => ok(`${was} — stand schon da (derselbe Vorschlag), nichts doppelt angelegt.`);

async function ausfuehren(e: Eingabe, person: string, vid: string): Promise<Ergebnis> {
  const art = String(e.art ?? '') as VorschlagArt;
  if (NUR_TEXT.has(art)) {
    if (e.kontaktId) {
      // Auch ein Entwurf nur, solange die Person nicht eingeschränkt/gesperrt ist.
      const k = await rohKontakt(String(e.kontaktId));
      if (!k) return { ok: false, status: 404, fehler: 'Kontakt nicht mehr da.' };
      if (k.eingeschraenkt) return { ok: false, status: 409, fehler: 'Die Verarbeitung dieser Person ist inzwischen eingeschränkt (Art. 18) — nichts übernommen.' };
      if (k.werbesperre) return { ok: false, status: 409, fehler: `Inzwischen Werbesperre seit ${k.werbesperre.seit} — nichts übernommen.` };
    }
    return ok('Entwurf übernommen — nichts wurde versendet. Der Text steht im Vorschlag zum Kopieren.');
  }
  switch (art) {
    case 'aktivitaet': {
      const r = await innen('/api/crm/aktivitaet', 'POST', { id: e.kontaktId, art: e.aktivitaetArt, text: e.text, ergebnis: e.ergebnis, anlass: e.anlass, naechster: e.naechster, wann: e.wann, vorschlagId: vid }, person);
      return r.json.schonDa ? SCHON('Aktivität festgehalten') : aus(r, `Aktivität festgehalten (${String(e.aktivitaetArt)}).`);
    }
    case 'followup': {
      const r = await innen('/api/crm/followup', 'POST', { aktion: 'anlegen', id: ausVorschlag('fu', vid), bezug: e.bezug, kontaktId: e.kontaktId, art: e.followupArt, text: e.text, faellig: e.faellig, zustaendig: e.zustaendig, quelle: 'zoe' }, person);
      return r.json.schonDa ? SCHON('Follow-up angelegt') : aus(r, `Follow-up am ${String(e.faellig)} angelegt.`);
    }
    case 'followup_verschieben': {
      if (e._stand) {
        const jetzt = (await rohCrm()).followups.find(x => x.id === e.followupId);
        if (!jetzt || stand(jetzt) !== e._stand) return KONFLIKT;
      }
      return aus(await innen('/api/crm/followup', 'POST', { aktion: 'verschieben', id: e.followupId, faellig: e.faellig }, person), `Follow-up auf ${String(e.faellig)} verschoben.`);
    }
    case 'deal_anlegen': {
      const r = await innen('/api/crm/deal', 'POST', { aktion: 'anlegen', kontaktIds: [e.kontaktId], ...(e.firmaId ? { firmaId: e.firmaId } : {}), titel: e.titel, art: 'retainer', wert: e.wert, schritt: e.schritt, stufe: e.stufe, erwartetAm: e.erwartetAm, besitzer: e.besitzer ?? person }, person);
      // Quelle aus der Herkunft des Leads (08.10., 2.5); SQL nur bei erfüllten Kriterien (2.3) — die Antwort sagt es.
      return aus(r, r.json?.chance && r.json.text ? String(r.json.text) : 'Deal angelegt.');
    }
    case 'deal_aendern': {
      const r = await innen('/api/crm/bestand', 'PATCH', { ops: [{ liste: 'chancen', op: 'teil', id: e.dealId, stand: e._stand, felder: e.felder }] }, person);
      if (r.status < 400 && Array.isArray(r.json.fehler) && r.json.fehler.length) return { ok: false, status: 409, fehler: (r.json.fehler as unknown[]).map(String).join(' · ') };
      return aus(r, 'Deal geändert.');
    }
    case 'kontakt_felder': {
      const r = await innen('/api/state/kontakte', 'PATCH', { ops: [{ op: 'teil', id: e.kontaktId, stand: e._stand, felder: e.felder }] }, person);
      if (r.status === 409 && Array.isArray(r.json.konflikte)) return KONFLIKT;
      return aus(r, 'Kontakt ergänzt.');
    }
    case 'aufgabe': {
      const r = await innen('/api/tasks/create', 'POST', { title: e.titel, description: e.beschreibung, dueDate: e.faellig, owner: e.owner, bezug: e.bezug, space: 'business' }, person);
      return aus(r, r.json.duplikat ? 'Gleiche offene Aufgabe gab es schon — nicht doppelt angelegt.' : 'Aufgabe angelegt.');
    }
    case 'qualifizierung': {
      const id = String(e.leadId ?? '');
      const rc = await rohCrm();
      const rohLead = id.startsWith('f-') ? rc.firmen.find(f => f.id === id)?.lead : (await rohKontakt(id))?.lead;
      if (stand(rohLead ?? {}) !== e._stand) return KONFLIKT;
      return aus(await innen('/api/crm/lead', 'POST', { aktion: 'setze', id, felder: e.felder }, person), 'Qualifizierung ergänzt.');
    }
    case 'dubletten': {
      const st = (e._stand ?? {}) as { behalten?: string; weg?: string };
      const a = await rohKontakt(String(e.behalten)), b = await rohKontakt(String(e.weg));
      if (!a || !b || stand(a) !== st.behalten || stand(b) !== st.weg) return KONFLIKT;
      return aus(await innen('/api/crm/dubletten', 'POST', { behalten: e.behalten, weg: e.weg }, person), 'Zusammengeführt — rückgängig unter Stammdaten › Dubletten.');
    }
    case 'reparatur':
      return aus(await innen('/api/crm/verbindungen', 'POST', { ids: e.befunde }, person), 'Repariert (nur sichere Fälle, nichts gelöscht).');
    case 'import_konflikt':
      return aus(await innen('/api/crm/import', 'POST', { aktion: 'konflikt', kontaktId: e.kontaktId, feld: e.feld, wahl: e.wahl, firmaWechsel: e.firmaWechsel }, person), 'Konflikt entschieden.');
    case 'angebot_entwurf': {
      // Nur `speichern` — nie `stellen`: die Nummer, das PDF und die Festschreibung macht ein Mensch im Angebots-Tool.
      const r = await innen('/api/crm/angebot', 'POST', { aktion: 'speichern', ...(e.angebotId ? { id: e.angebotId, stand: e._stand } : {}), felder: e.felder }, person);
      const id = (r.json.angebot as { id?: string } | undefined)?.id;
      return aus(r, `Angebots-Entwurf gespeichert${id ? ` (${id})` : ''} — gestellt wird nur im Angebots-Tool.`);
    }
    case 'beitrag_entwurf': {
      const id = ausVorschlag('b', vid);
      if ((await rohCrm()).beitraege?.some(x => x.id === id)) return SCHON('Beitrag angelegt');
      const eintrag = { id, titel: e.titel, kanal: e.kanal, status: 'entwurf', text: e.text, wirkung: [], quellen: [], zustaendig: person, ...(e.stimme ? { stimme: e.stimme } : {}), ...(e.saeule ? { saeule: e.saeule } : {}), ...(e.datum ? { datum: e.datum } : {}) };
      return aus(await innen('/api/crm/bestand', 'PATCH', { ops: [{ liste: 'beitraege', op: 'upsert', eintrag }] }, person), 'Beitrag als Entwurf angelegt — veröffentlicht wird nichts.');
    }
    case 'newsletter_entwurf': {
      const id = ausVorschlag('nl', vid);
      if ((await rohCrm()).newsletter?.some(x => x.id === id)) return SCHON('Newsletter angelegt');
      const eintrag = { id, titel: e.titel, status: 'entwurf', inhalt: e.inhalt, beitragIds: [], zustaendig: person, ...(e.datum ? { datum: e.datum } : {}) };
      return aus(await innen('/api/crm/bestand', 'PATCH', { ops: [{ liste: 'newsletter', op: 'upsert', eintrag }] }, person), 'Newsletter als Entwurf angelegt — versendet wird nichts.');
    }
    case 'segment': {
      const id = ausVorschlag('seg', vid);
      if ((await rohCrm()).segmente?.some(x => x.id === id)) return SCHON('Segment angelegt');
      const eintrag = { id, name: e.name, ...(e.beschreibung ? { beschreibung: e.beschreibung } : {}), kriterien: e.kriterien };
      return aus(await innen('/api/crm/bestand', 'PATCH', { ops: [{ liste: 'segmente', op: 'upsert', eintrag }] }, person), 'Segment angelegt.');
    }
    case 'gaesteliste': {
      // Beim Freigeben neu gegen den Stand: wer inzwischen gesperrt/eingeschränkt ist oder schon dabei, fällt raus.
      const kontakte = await karteiFuerPruefung();
      const rc = await rohCrm();
      if (rc.teilnahmen.some(t => t.id.startsWith(`${ausVorschlag('tn', vid)}-`))) return SCHON('Gäste vorgemerkt');
      const schon = new Set(rc.teilnahmen.filter(t => t.eventId === e.eventId).map(t => t.kontaktId));
      const alleIds = Array.isArray(e.kontaktIds) ? e.kontaktIds.map(String) : [];
      const ids = alleIds.filter(id => { const k = kontakte.find(x => x.id === id); return k && !k.werbesperre && !k.eingeschraenkt && !schon.has(id); });
      if (!ids.length) return { ok: false, status: 409, fehler: 'Niemand mehr vorzumerken (inzwischen gesperrt, eingeschränkt oder schon dabei).' };
      const ops = ids.map(id => ({ liste: 'teilnahmen', op: 'upsert', eintrag: { id: ausVorschlag('tn', vid, alleIds.indexOf(id)), eventId: e.eventId, kontaktId: id, status: 'vorgemerkt' } }));
      return aus(await innen('/api/crm/bestand', 'PATCH', { ops }, person), `${ids.length} Gäste vorgemerkt — eingeladen wird nichts.`);
    }
    case 'leistungstext': {
      const felder = { angebot: e.angebot, ...(e.aktiv ? { status: 'aktiv' } : {}) };
      return aus(await innen('/api/crm/bestand', 'PATCH', { ops: [{ liste: 'leistungen', op: 'teil', id: e.leistungId, stand: e._stand, felder }] }, person), `Leistungstext übernommen${e.aktiv ? ', Produkt aktiv' : ''}.`);
    }
    case 'head_entscheiden': {
      // Noch offen? (Im Head-Fenster kann inzwischen jemand entschieden haben.) Dann über die Route des Heads — wie der Klick dort.
      const { standName } = await import('@/lib/heads/stand');
      const st = await loadJson<import('@/lib/heads/stand').HeadStand>(standName(e.head as import('@/lib/heads/prompt').HeadId));
      const hv = (st?.vorschlaege ?? []).find(x => x.id === e.vorschlagId);
      if (!hv || hv.status !== 'offen') return { ok: false, status: 409, fehler: `Der Vorschlag des Heads ist inzwischen ${hv ? hv.status : 'weg'} — nichts übernommen.` };
      const r = await innen('/api/heads/[head]', 'POST', { aktion: 'entscheiden', id: e.vorschlagId, status: e.status, ...(e.grund ? { grund: e.grund } : {}) }, person, { head: String(e.head) });
      return aus(r, e.status === 'angenommen' ? `Head-Vorschlag angenommen${r.json.wohin ? ` → ${String(r.json.wohin)}` : ''}.` : 'Head-Vorschlag abgelehnt — der Head lernt daraus.');
    }
    // ── Kundengewinnung (22.10.) ──
    case 'firma_felder': {
      const r = await innen('/api/crm/bestand', 'PATCH', { ops: [{ liste: 'firmen', op: 'teil', id: e.firmaId, stand: e._stand, felder: e.felder }] }, person);
      if (r.status === 409) return KONFLIKT;
      if (r.status < 400 && Array.isArray(r.json.fehler) && r.json.fehler.length) return { ok: false, status: 409, fehler: (r.json.fehler as unknown[]).map(String).join(' · ') };
      return aus(r, 'Firma ergänzt.');
    }
    case 'lead_parken': {
      // Die Freigabe im Stapel IST der Klick der Person — dieselbe Regel wie „Parken“ in der Runde (lib/crm/lead-parken-server.ts; der Dienstweg parkt nie selbst).
      const { leadParkenOderRaus } = await import('@/lib/crm/lead-parken-server');
      const r = await leadParkenOderRaus({ aktion: 'parken', id: String(e.leadId ?? ''), bis: e.bis, grundArt: e.grundArt, grund: e.grund }, person, { art: 'zoe', person });
      return r.ok ? ok(r.text) : { ok: false, status: r.status, fehler: r.fehler };
    }
    case 'mandat_anlegen': {
      const r = await innen('/api/crm/lead', 'POST', { aktion: 'mandat', chanceId: e.dealId }, person);
      return aus(r, r.json.text ? String(r.json.text) : 'Mandat angelegt.');
    }
    case 'kampagnen_ergebnis': {
      const kp = (await rohCrm()).kampagnen.find(x => x.id === e.kampagneId);
      if (kp?.ergebnisse.some(x => x.kontaktId === e.kontaktId && x.ergebnis === e.ergebnis)) return SCHON('Ergebnis festgehalten');
      return aus(await innen('/api/crm/kampagnen', 'POST', { aktion: 'ergebnis', id: e.kampagneId, kontaktId: e.kontaktId, ergebnis: e.ergebnis }, person), `Ergebnis „${String(e.ergebnis)}“ festgehalten.`);
    }
    case 'anfrage_anlegen':
      return aus(await innen('/api/crm/anfrage', 'POST', { aktion: 'anlegen', ...(e.kontaktId ? { kontaktId: e.kontaktId } : { neu: e.neu }), kanal: e.kanal, text: e.text }, person), 'Anfrage übernommen — Follow-up „Anfrage beantworten“ steht heute an. Versendet wurde nichts.');
    default:
      return { ok: false, status: 400, fehler: 'Unbekannte Art — nichts übernommen.' };
  }
}

/**
 * Stapel-Art „crm“ (lib/zoe/stapel-arten.ts): Freigabe per Klick — beansprucht den Vorschlag IN der Sperre (29.09.),
 * übernimmt über den Schreibweg und entscheidet selbst (mit Person, dauerhaft). Scheitert es, wird der Anspruch
 * gelöst — der Vorschlag bleibt offen. Doppelklick, zweites Fenster, „alle freigeben“: der zweite bekommt 409.
 */
export const CRM_STAPEL_ART: StapelArtFreigabe = {
  freigeben: async (vIn, person) => {
    const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    if (!person || !(await personImHaushaltDesInhabers(person))) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
    // Prüfen (wie C4: nur, für wen ZOE ihn vorbereitet hat) und beanspruchen in EINER Sperre.
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== 'crm' || v.werkzeug !== CRM_VORSCHLAG_WERKZEUG) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person && v.person !== person) return { status: 403, fehler: 'Nur die Person, für die ZOE ihn vorbereitet hat, gibt ihn frei.' };
      return null;
    });
    if (!a.ok) return { ok: false, status: a.status, fehler: a.fehler };
    const v = a.v;
    // „Ändern & freigeben“ gibt es für CRM-Vorschläge nicht — übernommen wird genau, was vorbereitet und geprüft wurde.
    let r: Ergebnis;
    try { r = await ausfuehren(v.eingabe, person, v.id); }
    catch (e) { await loslassen(v.id); throw e; }
    if (!r.ok) { await loslassen(v.id); return r; }
    await entscheide(v.id, 'freigegeben', { ergebnis: r.text, von: person, ausArbeit: true });
    await notiere({ werkzeug: CRM_VORSCHLAG_WERKZEUG, gruppe: 'crm', risiko: 'freigabe', eingabe: { art: v.eingabe.art, bezug: v.bezug?.id }, ergebnis: r.text, ok: true, quelle: 'stapel', person, ruecknahme: null });
    return { ok: true, text: r.text };
  },
};

// ── Register-Teile (Spread in werkzeuge.ts / register.ts / kimmi) ────────

/** Stufe „frei“: das Werkzeug selbst legt nur ab (die Freigabe ist der Klick). Vorschau nur fürs Protokoll. */
export const CRM_VORSCHLAG_REGISTER: Record<string, { gruppe: string; risiko: Risiko; vorschau: (i: Eingabe) => Promise<Vorschau> }> = {
  crm_vorschlag: { gruppe: 'crm', risiko: 'frei', vorschau: async i => ({ titel: 'Markttraktion: Vorschlag vorbereiten (nichts wird geändert)', nachher: `${text(i.art, 40)}${i.kontakt ? ` · ${text(i.kontakt, 60)}` : ''}` }) },
};

export const CRM_VORSCHLAG_LAUF: Lauf = crmVorschlag;

export { EINGESCHRAENKT_NAME };
