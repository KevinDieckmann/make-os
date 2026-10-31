// ─── Bausteine bestellen — Katalog, Einstellungen, Bestellung, Freigabe, Download (nur Server, 31.10.) ───────────────────────────────────
// Regeln und Texte: lib/bausteine/regeln.ts (Kopf). Katalog und Dateien liegen im Repo-Ordner `unterlagen/bausteine/` (NICHT öffentlich — Caddy liefert
// nur `fokusinnovation/` statisch aus), Ort folgt `MAKE_OS_UNTERLAGEN_DIR` (Tests). Bestände: `bausteine-einstellungen` (Schalter, Gesellschaft,
// Zahlungsziel, Bedingungen — kein Bezug zu Dritten) und `baustein-bestellungen` (Bestellungen mit Rechnungsdaten der bestellenden Person).
//
// Eiserne Regel 3 — was automatisch hinausgeht und was nicht:
//   · Eingangsbestätigung: automatisch, aber NUR über den Website-Absender (`websiteMailSenden`: an die selbst eingetragene Adresse, fester Text,
//     Grenze je Adresse und Tag, nie an Art. 18/Werbesperre/Sperrliste) — dieselbe dokumentierte Ausnahme wie Unterlagen und Check.
//   · Rechnung und Download-Links: NUR nach dem Klick „Freigeben und senden“ einer Person mit Sitzung (`bestellungFreigeben`). Vorher gibt es nur den
//     ENTWURF (Rechnung „geplant“, ohne Nummer). Gestellt wird über den EINEN Stell-Weg (`rechnungStellen`: Nummer, PDF, E-Rechnung), gesendet über den
//     EINEN Sendeweg (`inboxSenden` mit Beleg — der Anhang muss genau das PDF dieser Rechnung sein). Kein Klick = nichts geht raus.
//   · Absage: nur, wenn beim Ablehnen „Absage-Mail senden“ gewählt ist (neutraler fester Text über den Website-Absender) — sonst geht nichts hinaus.
// Download-Link: zustandslos und signiert — `b1.<bestell-kennung>.<ablauf base36>.<HMAC>` (Sitzungsgeheimnis, eigener Zweck `baustein-link`); trägt nie die
// Adresse; gilt nur, solange die Bestellung geliefert ist und ihre Rechnung nicht storniert. Unterlagen-Tokens (`u1.…`, Zweck `unterlage-link`) gelten hier nie
// und Baustein-Tokens nie dort.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { sitzungsGeheimnis } from '@/lib/zugang/sitzung';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { BUSINESS_GESELLSCHAFTEN, istBusinessGesellschaft, istGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { WEG } from '@/lib/wege';
import { unterlagenOrdner } from '@/lib/unterlagen/server';
import type { WebsiteLage } from '@/lib/oeffentlich/website-post';
import {
  BESTELLUNGEN, EINSTELLUNGEN, LINK_TAGE, UST_SATZ, BESTELL_ID_OK, BAUSTEIN_ID_OK, DATEIEN_MAX,
  anfrageText, absageMail, auslandPruefen, bedingungenFassung, bedingungenTextPruefen, bedingungenZeilen, bestellHinweis, betraege, eingangMail,
  inArbeitLaeuft, katalogPruefen, lieferMail, nachFrist, teileVon, wirksamerStatus, zahlungszielVon,
  type Baustein, type BausteineEinstellungen, type BausteinArt, type BestellDatei, type Besteller, type Bestellung, type WirksamerStatus,
} from './regeln';

/** Fachfehler mit Status (die Routen geben `fehler` und den Status weiter). */
export class BausteinFehler extends Error {
  constructor(msg: string, readonly status: number) { super(msg); }
}

// ── Katalog ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const bausteineOrdner = (): string => path.join(unterlagenOrdner(), 'bausteine');
/** Katalog nicht lesbar (kaputtes JSON) — die Route antwortet 503, nie still „gibt es nicht“. */
export class KatalogKaputt extends Error {}

let gemeldet = '';
/** Den Katalog lesen — fehlt die Datei, ist er leer. Verworfene Einträge gehen (einmal je Fassung) ins Log, ohne Inhalte. */
export async function katalogLaden(): Promise<Baustein[]> {
  let roh: string;
  try { roh = await fs.readFile(path.join(bausteineOrdner(), 'katalog.json'), 'utf8'); }
  catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return []; throw new KatalogKaputt('katalog.json nicht lesbar'); }
  let json: unknown;
  try { json = JSON.parse(roh); } catch { throw new KatalogKaputt('katalog.json ist kein JSON'); }
  const { bausteine, fehler } = katalogPruefen(json);
  if (fehler.length && gemeldet !== roh) { gemeldet = roh; console.warn(`[bausteine] katalog.json: ${fehler.length} Eintrag/Einträge verworfen — ${fehler.slice(0, 5).join(' | ')}`); }
  return bausteine;
}

export async function bausteinVon(id: unknown): Promise<Baustein | null> {
  if (typeof id !== 'string' || !BAUSTEIN_ID_OK.test(id)) return null;
  return (await katalogLaden()).find(b => b.id === id) ?? null;
}

/**
 * Die Datei einer Art eines (Einzel-)Bausteins lesen — nur, wenn sie wirklich IM Ordner liegt (auch nach Auflösen von Verknüpfungen), eine Datei ist und
 * unter der Grenze bleibt. Sonst null (die Route antwortet 404).
 */
export async function dateiLesen(b: Baustein, art: BausteinArt): Promise<{ inhalt: Buffer; name: string } | null> {
  const d = b.dateien.find(x => x.art === art);
  if (!d) return null;
  try {
    const ordner = await fs.realpath(bausteineOrdner());
    const ziel = await fs.realpath(path.join(ordner, d.datei));
    if (path.dirname(ziel) !== ordner) return null;
    const st = await fs.stat(ziel);
    if (!st.isFile() || st.size > 30 * 1024 * 1024) return null;
    return { inhalt: await fs.readFile(ziel), name: d.name };
  } catch { return null; }
}

// ── Einstellungen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function ladeEinstellungen(): Promise<BausteineEinstellungen> {
  const e = await loadJson<BausteineEinstellungen>(EINSTELLUNGEN);
  return {
    aktiv: e?.aktiv === true,
    ...(istGesellschaft(e?.gesellschaft) ? { gesellschaft: e!.gesellschaft } : {}),
    ...(typeof e?.zahlungszielTage === 'number' ? { zahlungszielTage: zahlungszielVon(e) } : {}),
    ...(e?.bedingungenText ? { bedingungenText: e.bedingungenText } : {}),
    ...(e?.geaendert ? { geaendert: e.geaendert, ...(e.geaendertVon ? { geaendertVon: e.geaendertVon } : {}) } : {}),
  };
}

/** Einstellungen ändern (nur Inhaber — prüft die Route). Felder fehlen = unverändert; `''` für die Gesellschaft/den Text = leeren. Wirft BausteinFehler. */
export async function einstellungenSetzen(teil: Record<string, unknown>, von: string): Promise<BausteineEinstellungen> {
  const alt = await ladeEinstellungen();
  const neu: BausteineEinstellungen = { ...alt };
  if ('aktiv' in teil) { if (typeof teil.aktiv !== 'boolean') throw new BausteinFehler('aktiv: true oder false.', 400); neu.aktiv = teil.aktiv; }
  if ('gesellschaft' in teil) {
    if (teil.gesellschaft === '' || teil.gesellschaft === null) delete neu.gesellschaft;
    // Nur eine Business-Gesellschaft: Bausteine laufen über die Markttraktion (Business) — nie eine Einheit des Privat-Bereichs (05.10.).
    else if (istGesellschaft(teil.gesellschaft) && istBusinessGesellschaft(teil.gesellschaft)) neu.gesellschaft = teil.gesellschaft;
    else throw new BausteinFehler('Gesellschaft: eine der Business-Gesellschaften der Instanz.', 400);
  }
  if ('zahlungszielTage' in teil) {
    const z = teil.zahlungszielTage;
    if (typeof z !== 'number' || !Number.isInteger(z) || z < 0 || z > 90) throw new BausteinFehler('Zahlungsziel: ganze Tage von 0 bis 90.', 400);
    neu.zahlungszielTage = z;
  }
  if ('bedingungenText' in teil) {
    const t = bedingungenTextPruefen(teil.bedingungenText);
    if (!t.ok) throw new BausteinFehler(t.fehler, t.status);
    if (t.text) neu.bedingungenText = t.text; else delete neu.bedingungenText;
  }
  if (neu.aktiv) {
    // Einschalten (bzw. eingeschaltet lassen) nur, wenn alles da ist — sonst nähme die Website Bestellungen an, die niemand liefern kann.
    const { gruende } = await gruendeFuer(neu);
    if (gruende.length) throw new BausteinFehler(gruende.join(' '), 409);
  }
  const fertig: BausteineEinstellungen = { ...neu, geaendert: new Date().toISOString(), geaendertVon: von };
  await updateJson<BausteineEinstellungen>(EINSTELLUNGEN, () => fertig);
  return fertig;
}

// ── Lage: läuft der Bestellweg? ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Firmierung der Gesellschaft aus dem Register (Einrichtung) — nie ein Name aus dem Code; ohne Eintrag null. */
async function gesellschaftAusRegister(g: string | undefined): Promise<import('@/lib/crm/gesellschaften').Gesellschaft | null> {
  if (!istGesellschaft(g)) return null;
  const { haushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  const h = await haushaltDesInhabers();
  if (!h) return null;
  const { alleGesellschaften, gesellschaftenName } = await import('@/lib/crm/gesellschaften');
  return alleGesellschaften(await loadJson(gesellschaftenName(h))).find(x => x.id === g) ?? null;
}

/** Was fehlt, damit der Bestellweg laufen darf (leer = alles da), dazu die Lage der Website. Wirft nie. */
async function gruendeFuer(e: BausteineEinstellungen): Promise<{ gruende: string[]; lage: WebsiteLage | null }> {
  const g: string[] = [];
  if (!istGesellschaft(e.gesellschaft)) g.push('Gesellschaft fehlt — welche Gesellschaft stellt die Rechnung?');
  else if (!istBusinessGesellschaft(e.gesellschaft)) g.push('Die gewählte Gesellschaft gehört zum Bereich Privat — bitte eine Business-Gesellschaft wählen.');
  const { websiteLagePruefen } = await import('@/lib/oeffentlich/website-post');
  const w = await websiteLagePruefen().catch(() => ({ lage: null, gruende: ['Die Lage der Website ließ sich nicht prüfen.'] }));
  g.push(...w.gruende);
  const { haushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  if (!(await haushaltDesInhabers().catch(() => null))) g.push('Kein Haushalt des Inhabers eingerichtet.');
  if (istGesellschaft(e.gesellschaft)) {
    // Absender der Gesellschaft vollständig? Sonst ließe sich keine Rechnung stellen — geprüft mit einem Probe-Entwurf (nur die Absender-Punkte zählen).
    const reg = await gesellschaftAusRegister(e.gesellschaft).catch(() => null);
    const { pflichtFehlt } = await import('@/lib/finanzen/rechnung/regeln');
    const probe = { firmaId: e.gesellschaft, leistungVon: localDay(), positionen: [{ id: 'p1', titel: 'Probe', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100, ustSatz: UST_SATZ }], empfaenger: { firma: 'Probe', strasse: 'Probe 1', plz: '00000', ort: 'Probe' } };
    const absender = pflichtFehlt(probe, reg).filter(x => x.weg || /^Absender/.test(x.text));
    if (absender.length) g.push(`Rechnungs-Absender der Gesellschaft unvollständig: ${absender.map(x => x.text).join(' ')}`);
  }
  return { gruende: g, lage: w.lage };
}

export interface BausteineLage {
  e: BausteineEinstellungen;
  /** Leer = der Bestellweg läuft (eingeschaltet vorausgesetzt). */
  gruende: string[];
  lage: WebsiteLage | null;
  bedingungen: { fassung: string; zeilen: string[] };
  hinweis: { zeilen: string[]; link: string | null };
  ustSatz: number;
  zahlungszielTage: number;
}

/** Die ganze Lage (für Website und Oberfläche). Ohne Fehler (wirft nie). */
export async function bausteineLage(): Promise<BausteineLage> {
  const e = await ladeEinstellungen().catch(() => ({ aktiv: false } as BausteineEinstellungen));
  const { gruende, lage } = await gruendeFuer(e);
  const reg = await gesellschaftAusRegister(e.gesellschaft).catch(() => null);
  const zeilen = bedingungenZeilen(e);
  return {
    e, gruende, lage,
    bedingungen: { fassung: bedingungenFassung(zeilen), zeilen },
    hinweis: { zeilen: lage ? bestellHinweis(lage.verantwortlich, lage.datenschutzLink, reg?.firmierung?.trim() || null) : [], link: lage?.datenschutzLink ?? null },
    ustSatz: reg?.kleinunternehmer ? 0 : UST_SATZ,
    zahlungszielTage: zahlungszielVon(e),
  };
}

/** Läuft der Bestellweg (eingeschaltet UND alles da)? — dann die Lage, sonst null. */
export async function bausteineBereit(): Promise<(BausteineLage & { lage: WebsiteLage }) | null> {
  const l = await bausteineLage();
  return l.e.aktiv && !l.gruende.length && l.lage ? l as BausteineLage & { lage: WebsiteLage } : null;
}

/** Zur Wahl in den Einstellungen: die Business-Gesellschaften (Kennung + Anzeigename) — nur an den Haushalt. */
export const gesellschaftWahl = async (): Promise<{ id: string; name: string }[]> => {
  const { finanzOrtName } = await import('@/lib/einheiten');
  return BUSINESS_GESELLSCHAFTEN.map(id => ({ id, name: finanzOrtName(id) }));
};

/** Für das Verzeichnis (Art. 30): eingeschaltet — dann findet die Verarbeitung statt. Wirft nie. */
export async function bausteineEingerichtet(): Promise<boolean> {
  try { return (await ladeEinstellungen()).aktiv; } catch { return false; }
}

// ── Formular-Stempel (Mindestzeit wie Buchung, Check, Kontaktformular — eigener Zweck) ─────────────────────────────────────────

const stempelSig = (ms: number) => createHmac('sha256', `${sitzungsGeheimnis()}|baustein-bestellung`).update(String(ms)).digest('base64url');
/** „<ms>.<signatur>“ — mit GET ausgegeben; zu schnell (< 3 s) oder zu alt (> 2 h) zählt nicht (`ausfuellZeitOk`). */
export const bestellStempel = (ms = Date.now()): string => `${ms}.${stempelSig(ms)}`;
/** Zeit aus einem Stempel — null, wenn gefälscht oder kaputt. */
export function stempelZeit(stempel: unknown): number | null {
  if (typeof stempel !== 'string' || stempel.length > 80) return null;
  const [ms, sig] = stempel.split('.');
  const n = Number(ms);
  if (!Number.isInteger(n) || !sig) return null;
  const soll = Buffer.from(stempelSig(n)), ist = Buffer.from(sig);
  return soll.length === ist.length && timingSafeEqual(soll, ist) ? n : null;
}

// ── Download-Token ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

const TOKEN_FORM = /^b1\.(bb-[0-9a-f-]{36})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{43})$/;
const signatur = (id: string, ablauf: number) => createHmac('sha256', `${sitzungsGeheimnis()}|baustein-link`).update(`b1|${id}|${ablauf}`).digest('base64url');

/** Ein Download-Token für die Bestellung `id`, gültig `LINK_TAGE` Tage ab `jetzt`. */
export function linkToken(id: string, jetzt = new Date()): string {
  const ablauf = Math.floor(jetzt.getTime() / 1000) + LINK_TAGE * 86_400;
  return `b1.${id}.${ablauf.toString(36)}.${signatur(id, ablauf)}`;
}

/** Ein Token prüfen (zeitkonstant): `ok` mit der Bestell-Kennung; sonst `abgelaufen` (echt, aber zu alt) bzw. `ungueltig`. */
export function tokenPruefen(t: unknown, jetzt = new Date()): { ok: true; id: string } | { ok: false; grund: 'abgelaufen' | 'ungueltig' } {
  if (typeof t !== 'string' || t.length > 140) return { ok: false, grund: 'ungueltig' };
  const m = TOKEN_FORM.exec(t);
  if (!m) return { ok: false, grund: 'ungueltig' };
  const [, id, ab36, sig] = m;
  const ablauf = parseInt(ab36, 36);
  if (!Number.isSafeInteger(ablauf)) return { ok: false, grund: 'ungueltig' };
  const soll = Buffer.from(signatur(id, ablauf)), ist = Buffer.from(sig);
  if (soll.length !== ist.length || !timingSafeEqual(soll, ist)) return { ok: false, grund: 'ungueltig' };
  if (ablauf * 1000 < jetzt.getTime()) return { ok: false, grund: 'abgelaufen' };
  return { ok: true, id };
}

/** Download-Link einer Datei über die Website (`/api/baustein/laden`, Caddy leitet den Pfad an die App). */
export const downloadLink = (website: string, token: string, bausteinId: string, art: BausteinArt): string =>
  `${website}/api/baustein/laden?t=${encodeURIComponent(token)}&b=${encodeURIComponent(bausteinId)}&d=${art}`;

/**
 * Was ein Link liefern darf (rein über den Bestand): die Bestellung ist geliefert, ihre Rechnung nicht storniert, der Baustein gehört zu ihr (bei einem Paket:
 * einer seiner Teile, wie beim Eingang festgehalten) und es gibt ihn noch im Katalog. Sonst null.
 */
export async function downloadZiel(bestellId: string, bausteinId: unknown): Promise<Baustein | null> {
  if (typeof bausteinId !== 'string' || !BAUSTEIN_ID_OK.test(bausteinId)) return null;
  const b = (await bestellungenLaden()).find(x => x.id === bestellId);
  if (!b || b.status !== 'geliefert' || !b.teile.includes(bausteinId)) return null;
  if (b.rechnungId) {
    const { rechnungLesen } = await import('@/lib/finanzen/rechnung/server');
    if ((await rechnungLesen(b.rechnungId))?.status === 'storniert') return null;
  }
  const k = await bausteinVon(bausteinId);
  return k && !k.paket ? k : null;
}

// ── Bestand ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function bestellungenLaden(): Promise<Bestellung[]> {
  const d = await loadJson<BestellDatei>(BESTELLUNGEN);
  return Array.isArray(d?.bestellungen) ? d.bestellungen : [];
}

/** EINE Änderung an einer Bestellung (in der Sperre, Frist rollend angewendet). `aendern` gibt null zurück = nichts ändern. */
async function bestellungAendern(id: string, aendern: (b: Bestellung) => Bestellung | null): Promise<Bestellung | null> {
  let neu: Bestellung | null = null;
  await updateJson<BestellDatei>(BESTELLUNGEN, cur => {
    const liste = Array.isArray(cur?.bestellungen) ? cur!.bestellungen : [];
    const i = liste.findIndex(x => x.id === id);
    if (i < 0) return cur ?? { bestellungen: [] };
    const n = aendern(liste[i]);
    if (!n) { neu = liste[i]; return cur!; }
    neu = n;
    return { bestellungen: liste.map((x, j) => (j === i ? n : x)) };
  });
  return neu;
}

// ── Eingang ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Eine Bestellung annehmen und SOFORT festhalten (vor der Antwort an den Gast — ein Speicherfehler sagt es offen, 503; nie geht eine Bestellung still
 * verloren). Was danach kommt (Anfrage, Entwurf, Bestätigung, Glocke), macht `eingangVorbereiten` nach der Antwort.
 */
export async function bestellungAnnehmen(p: { baustein: Baustein; katalog: readonly Baustein[]; besteller: Besteller; fassung: string; ustSatz: number }, jetzt = new Date()): Promise<Bestellung> {
  const teile = teileVon(p.baustein, p.katalog).map(t => t.id);
  if (!teile.length) throw new BausteinFehler('Dieser Baustein hat gerade keine Dateien.', 404);
  const am = jetzt.toISOString();
  const b: Bestellung = {
    id: neueKennung('bb'), am, bausteinId: p.baustein.id, titel: p.baustein.titel, preisCent: p.baustein.preis, ustSatz: p.ustSatz, teile,
    besteller: p.besteller, unternehmer: true, bedingungen: { fassung: p.fassung, am }, status: 'neu',
  };
  await updateJson<BestellDatei>(BESTELLUNGEN, cur => ({ bestellungen: [...nachFrist(Array.isArray(cur?.bestellungen) ? cur!.bestellungen : [], jetzt), b] }));
  await protokolliere(BESTELLUNGEN, [{ op: 'neu', id: b.id, felder: ['bausteinId', 'besteller', 'bedingungen'] }], { art: 'system' });
  return b;
}

/** Wer im CRM als „erfasst von“ steht: der Gastgeber der Website (Check-Einstellungen), sonst der Inhaber — nie ein fester Name. */
async function erfassendePerson(): Promise<string> {
  const { ladeCheckEinstellungen } = await import('@/lib/check/speicher');
  const { gastgeberVon } = await import('@/lib/check/server');
  return (await gastgeberVon(await ladeCheckEinstellungen()).catch(() => null)) ?? 'system';
}

/**
 * Anfrage im CRM und Rechnungs-Entwurf — idempotent je Schritt (am Eintrag festgehalten), auch ein zweites Mal aus der Freigabe heraus. Ein Fehlschlag
 * steht als `problem` an der Bestellung (ohne Adresse), nie beim Gast.
 */
async function anfrageUndEntwurf(id: string, wer: Wer, jetzt: Date): Promise<Bestellung | null> {
  let b = (await bestellungenLaden()).find(x => x.id === id) ?? null;
  if (!b || b.status !== 'neu') return b;
  if (!b.kontaktId) {
    const { anfrageAnlegen } = await import('@/lib/crm/anfrage-anlegen');
    const s = b.besteller;
    const r = await anfrageAnlegen(
      { neu: { vorname: s.vorname, nachname: s.nachname, email: s.email, firma: s.firma, ...(s.telefon ? { telefon: s.telefon } : {}) }, kanal: 'website', text: anfrageText(b.titel, b.preisCent) },
      { person: await erfassendePerson(), wer: { art: 'system' }, oeffentlich: true },
    ).catch(e => ({ ok: false as const, fehler: e instanceof Error ? e.message : 'Fehler' }));
    if (!r.ok) {
      const grund = `Kartei: ${r.fehler.slice(0, 160)}`;
      console.warn('[bausteine] Anfrage nicht angelegt:', grund);
      return bestellungAendern(id, x => ({ ...x, problem: grund }));
    }
    // Nur bei einer NEUEN Person hängt die Rechnung auch an ihrer Firma — eine vorhandene Person (Adresse unbestätigt) kann zu einer anderen Firma gehören.
    const firmaId = r.bau.neuePerson ? r.bau.kontakt.firmaId : undefined;
    b = await bestellungAendern(id, x => ({ ...x, kontaktId: r.bau.kontakt.id, ...(r.bau.unbestaetigt ? { unbestaetigt: true as const } : {}), ...(firmaId ? { kundeFirmaId: firmaId } : {}), problem: undefined }));
    if (!b) return null;
  }
  if (!b.rechnungId) {
    const e = await ladeEinstellungen();
    if (!istGesellschaft(e.gesellschaft)) return bestellungAendern(id, x => ({ ...x, problem: 'Für Bausteine ist keine Gesellschaft eingestellt — Rechnung nicht vorbereitet.' }));
    const { haushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    const haushalt = await haushaltDesInhabers();
    if (!haushalt) return bestellungAendern(id, x => ({ ...x, problem: 'Kein Haushalt des Inhabers — Rechnung nicht vorbereitet.' }));
    const katalog = await katalogLaden().catch(() => [] as Baustein[]);
    const teilTitel = b.teile.map(t => katalog.find(k => k.id === t)?.titel ?? t);
    const s = b.besteller;
    try {
      const { entwurfAusBestellung } = await import('@/lib/finanzen/rechnung/server');
      const kundeFirmaId = b.kundeFirmaId;
      const r = await entwurfAusBestellung({
        bestellId: b.id, firmaId: e.gesellschaft as Gesellschaftskennung, titel: `Baustein: ${b.titel}`.slice(0, 200),
        empfaenger: { name: `${s.vorname} ${s.nachname}`, firma: s.firma, strasse: s.strasse, plz: s.plz, ort: s.ort, ...(s.land !== 'DE' ? { land: s.land } : {}), ...(s.ustid ? { ustId: s.ustid } : {}), email: s.email },
        positionen: [{ id: 'p1', titel: b.titel.slice(0, 200), text: b.teile.length > 1 ? `Paket: ${teilTitel.join(' · ')}`.slice(0, 6000) : 'Digitales Arbeitspaket (Download)', menge: 1, einheit: 'pauschal', einzelpreisCent: b.preisCent, ustSatz: b.ustSatz }],
        zahlungszielTage: zahlungszielVon(e), leistungVon: localDay(jetzt), kontaktId: b.kontaktId, ...(kundeFirmaId ? { kundeFirmaId } : {}), haushalt, wer, jetzt,
      });
      b = await bestellungAendern(id, x => ({ ...x, rechnungId: r.rechnung.id, problem: undefined }));
    } catch (x) {
      const grund = `Rechnung: ${(x instanceof Error ? x.message : 'Fehler').slice(0, 200)}`;
      console.warn('[bausteine] Entwurf nicht angelegt:', grund);
      return bestellungAendern(id, y => ({ ...y, problem: grund }));
    }
  }
  return b;
}

/**
 * Nach der Antwort an den Gast: Anfrage im CRM, Rechnungs-Entwurf, Eingangsbestätigung (Website-Absender), Glocke an den Haushalt (neutral, ohne Namen
 * und Beträge — der Titel geht so auch an Telegram). Wirft nie weiter als ins Log.
 */
export async function eingangVorbereiten(id: string, lage: WebsiteLage | null, jetzt = new Date()): Promise<void> {
  const b = await anfrageUndEntwurf(id, { art: 'system' }, jetzt);
  if (!b) return;
  if (!b.bestaetigung && lage) {
    const { websiteMailSenden } = await import('@/lib/oeffentlich/website-post');
    const m = eingangMail({ marke: lage.marke, verantwortlich: lage.verantwortlich, datenschutzLink: lage.datenschutzLink, vorname: b.besteller.vorname, titel: b.titel, b: betraege(b.preisCent, b.ustSatz) });
    const r = await websiteMailSenden({ an: b.besteller.email, vorname: b.besteller.vorname, betreff: m.betreff, text: m.text, art: 'bestellung', lage }, jetzt);
    await bestellungAendern(id, x => ({ ...x, bestaetigung: { am: jetzt.toISOString(), ok: r.ok, ...(r.ok ? {} : { grund: r.grund }) } }));
  }
  const [{ haushaltsSpeicher }, { melde }] = await Promise.all([import('@/lib/aufgaben/sicht'), import('@/lib/meldungen/melden')]);
  for (const an of await haushaltsSpeicher().catch(() => [] as string[])) await melde({ an, art: 'angebot', titel: 'Neue Baustein-Bestellung — wartet auf deine Freigabe', link: WEG.marketing('anfragen') });
}

// ── Freigabe („Freigeben und senden“) ───────────────────────────────────────────────────────────────────────────────────────────

const name = (s: Besteller) => `${s.vorname} ${s.nachname}`;

async function linksFuer(b: Bestellung, lage: WebsiteLage, jetzt: Date) {
  const katalog = await katalogLaden();
  const token = linkToken(b.id, jetzt);
  const links: { titel: string; name: string; art: BausteinArt; link: string }[] = [];
  for (const t of b.teile) {
    const k = katalog.find(x => x.id === t && !x.paket);
    if (!k) throw new BausteinFehler(`Ein Teil der Bestellung steht nicht mehr im Katalog (${t}) — nichts gesendet.`, 409);
    for (const d of k.dateien.slice(0, DATEIEN_MAX)) links.push({ titel: k.titel, name: d.name, art: d.art, link: downloadLink(lage.website, token, k.id, d.art) });
  }
  return links;
}

/**
 * Der EINE Klick: Rechnung stellen (Nummer, PDF + E-Rechnung über `rechnungStellen`) → Mail mit Rechnung als Anhang + Download-Links an die bestellende
 * Person (über `inboxSenden` vom Website-Absender, Beleg geprüft) → Status „geliefert“. Idempotent: geliefert → nichts mehr (`schon: true`); ist die Mail
 * schon raus (`versandt`), geht sie nie ein zweites Mal; ist die Rechnung schon gestellt, wird sie nicht neu gestellt. Gegen den Doppelklick: `inArbeit`.
 */
export async function bestellungFreigeben(p: { id: string; person: string; wer: Wer; jetzt?: Date }): Promise<{ bestellung: Bestellung; schon: boolean; nummer?: string }> {
  const jetzt = p.jetzt ?? new Date();
  if (!BESTELL_ID_OK.test(p.id)) throw new BausteinFehler('Bestellung nicht gefunden.', 404);
  const vorher = (await bestellungenLaden()).find(x => x.id === p.id);
  if (!vorher) throw new BausteinFehler('Bestellung nicht gefunden.', 404);
  if (vorher.status === 'geliefert') return { bestellung: vorher, schon: true };
  if (vorher.status === 'abgelehnt') throw new BausteinFehler('Diese Bestellung ist abgelehnt.', 409);
  const { websiteLage } = await import('@/lib/oeffentlich/website-post');
  const lage = await websiteLage();
  if (!lage) throw new BausteinFehler('Kein Website-Absender eingerichtet — es kann nichts hinausgehen (Marketing › Newsletter › Absender-Postfach).', 409);
  // Beanspruchen (in der Sperre): nur eine Freigabe zugleich.
  let belegt = false;
  const beansprucht = await bestellungAendern(p.id, x => {
    if (x.status !== 'neu' || inArbeitLaeuft(x, jetzt)) { belegt = true; return null; }
    return { ...x, inArbeit: { am: jetzt.toISOString(), von: p.person } };
  });
  if (!beansprucht || belegt) {
    if (beansprucht?.status === 'geliefert') return { bestellung: beansprucht, schon: true };
    throw new BausteinFehler('Diese Bestellung wird gerade freigegeben — bitte kurz warten und neu laden.', 409);
  }
  const loslassen = () => bestellungAendern(p.id, x => ({ ...x, inArbeit: undefined }));
  try {
    const b0 = await anfrageUndEntwurf(p.id, p.wer, jetzt);
    if (!b0?.rechnungId) throw new BausteinFehler(`Die Rechnung ist nicht vorbereitet${b0?.problem ? ` — ${b0.problem}` : ''}. Nichts gestellt, nichts gesendet.`, 409);
    const server = await import('@/lib/finanzen/rechnung/server');
    const { haushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    const haushalt = await haushaltDesInhabers();
    if (!haushalt) throw new BausteinFehler('Kein Haushalt des Inhabers.', 409);
    let r = await server.rechnungLesen(b0.rechnungId);
    if (!r) throw new BausteinFehler('Der Rechnungs-Entwurf ist nicht mehr da (gelöscht?) — bitte ablehnen oder neu anlegen lassen.', 409);
    if (r.status === 'storniert') throw new BausteinFehler('Die Rechnung dieser Bestellung ist storniert.', 409);
    if (r.status === 'geplant') {
      // Leistungsdatum = Tag der Lieferung (die Freigabe), nicht der Eingang.
      const heute = localDay(jetzt);
      if (r.leistungVon !== heute) r = await server.entwurfSpeichern({ id: r.id, felder: { leistungVon: heute }, stand: r.fassung, haushalt, sicht: 'privat', wer: p.wer });
      try { r = (await server.rechnungStellen({ id: r.id, stand: r.fassung, person: p.person, haushalt, sicht: 'privat', wer: p.wer, jetzt })).rechnung; }
      catch (x) { if (x instanceof server.RechnungFehler) throw new BausteinFehler(x.message, x.status); throw x; }
    }
    if (!r.pdfDateiId || !r.nummer) throw new BausteinFehler('Die Rechnung hat kein PDF aus MAKE OS — nichts gesendet.', 409);
    let b = (await bestellungenLaden()).find(x => x.id === p.id)!;
    if (!b.versandt) {
      const links = await linksFuer(b, lage, jetzt);
      const m = lieferMail({ marke: lage.marke, verantwortlich: lage.verantwortlich, datenschutzLink: lage.datenschutzLink, vorname: b.besteller.vorname, titel: b.titel, nummer: r.nummer, faellig: r.faellig ?? '', links });
      const { inboxSenden } = await import('@/lib/inbox/senden-server');
      const s = await inboxSenden(lage.absender.person, {
        neu: { postfach: lage.absender.postfach, betreff: m.betreff }, an: [{ email: b.besteller.email, name: name(b.besteller) }], text: m.text,
        anhaenge: [{ datei: r.pdfDateiId }], beleg: { art: 'rechnung', id: r.id },
        // Vertragliche Lieferung auf die eigene Bestellung der Person, fester Text — keine Werbung (§ 7 UWG gilt hier nicht); Art. 18 prüft der Sendeweg.
        uwgBestaetigt: true,
      }, p.wer).catch(e => ({ status: 502, body: { fehler: e instanceof Error ? e.message : 'Versand gescheitert.' } as Record<string, unknown> }));
      if (s.status !== 200 || s.body.ok !== true) throw new BausteinFehler(`Rechnung ${r.nummer} ist gestellt, die Mail ging aber nicht raus: ${String(s.body.fehler ?? 'unbekannter Fehler').slice(0, 200)} — „Freigeben und senden“ versucht nur noch das Senden.`, s.status >= 400 && s.status < 600 ? s.status : 502);
      const { adresseMaskiert } = await import('@/lib/zugang/konten');
      b = (await bestellungAendern(p.id, x => ({ ...x, versandt: { am: jetzt.toISOString(), von: p.person, ueber: adresseMaskiert(String(s.body.von ?? '')) } })))!;
    }
    const fertig = (await bestellungAendern(p.id, x => ({ ...x, status: 'geliefert', geliefert: { am: jetzt.toISOString(), von: p.person, ueber: x.versandt?.ueber ?? lage.ueber }, inArbeit: undefined, problem: undefined })))!;
    await protokolliere(BESTELLUNGEN, [{ op: 'geaendert', id: p.id, felder: ['status', 'geliefert', 'versandt', 'rechnungId'] }], p.wer);
    return { bestellung: fertig, schon: false, nummer: r.nummer };
  } catch (x) {
    await loslassen().catch(() => null);
    throw x;
  }
}

/** Neue Download-Links schicken (der Link der Liefer-Mail ist abgelaufen) — nur geliefert, nicht storniert, nur per Klick. Fester Text, kein Anhang. */
export async function linksNeuSenden(p: { id: string; person: string; wer: Wer; jetzt?: Date }): Promise<Bestellung> {
  const jetzt = p.jetzt ?? new Date();
  const b = (await bestellungenLaden()).find(x => x.id === p.id);
  if (!b) throw new BausteinFehler('Bestellung nicht gefunden.', 404);
  if (b.status !== 'geliefert') throw new BausteinFehler('Neue Links gibt es nur für gelieferte Bestellungen.', 409);
  const { rechnungLesen } = await import('@/lib/finanzen/rechnung/server');
  const r = b.rechnungId ? await rechnungLesen(b.rechnungId) : null;
  if (r?.status === 'storniert') throw new BausteinFehler('Die Rechnung ist storniert — keine neuen Links.', 409);
  const { websiteLage } = await import('@/lib/oeffentlich/website-post');
  const lage = await websiteLage();
  if (!lage) throw new BausteinFehler('Kein Website-Absender eingerichtet.', 409);
  const links = await linksFuer(b, lage, jetzt);
  const m = lieferMail({ marke: lage.marke, verantwortlich: lage.verantwortlich, datenschutzLink: lage.datenschutzLink, vorname: b.besteller.vorname, titel: b.titel, nummer: r?.nummer ?? '', faellig: r?.faellig ?? '', links });
  // Ohne Anhang: der Satz zur Rechnung entfällt (die Rechnung kam schon mit der Lieferung).
  const text = m.text.split('\n').filter(z => !z.startsWith('Die Rechnung ')).join('\n');
  const { inboxSenden } = await import('@/lib/inbox/senden-server');
  const s = await inboxSenden(lage.absender.person, { neu: { postfach: lage.absender.postfach, betreff: `Neue Download-Links: ${b.titel}` }, an: [{ email: b.besteller.email, name: name(b.besteller) }], text, uwgBestaetigt: true }, p.wer)
    .catch(e => ({ status: 502, body: { fehler: e instanceof Error ? e.message : 'Versand gescheitert.' } as Record<string, unknown> }));
  if (s.status !== 200 || s.body.ok !== true) throw new BausteinFehler(`Nicht gesendet: ${String(s.body.fehler ?? 'unbekannter Fehler').slice(0, 200)}`, 502);
  await protokolliere(BESTELLUNGEN, [{ op: 'geaendert', id: p.id, felder: ['links-neu'] }], p.wer);
  return b;
}

/**
 * Ablehnen: den Rechnungs-Entwurf löschen (eine schon GESTELLTE Rechnung wird nie gelöscht → 409, erst stornieren), Status „abgelehnt“. Nach außen geht
 * nichts — außer `absage` ist gewählt: dann EINE neutrale Absage (fester Text) über den Website-Absender.
 */
export async function bestellungAblehnen(p: { id: string; person: string; wer: Wer; grund?: unknown; absage?: boolean; jetzt?: Date }): Promise<Bestellung> {
  const jetzt = p.jetzt ?? new Date();
  const grund = typeof p.grund === 'string' ? p.grund.replace(/\s+/g, ' ').trim() : '';
  if (grund.length > 300) throw new BausteinFehler('Grund: höchstens 300 Zeichen — nichts gekürzt.', 413);
  const b = (await bestellungenLaden()).find(x => x.id === p.id);
  if (!b) throw new BausteinFehler('Bestellung nicht gefunden.', 404);
  if (b.status === 'abgelehnt') return b;
  if (b.status === 'geliefert') throw new BausteinFehler('Schon geliefert — die Rechnung storniert man unter Finanzen › Rechnungen.', 409);
  if (inArbeitLaeuft(b, jetzt)) throw new BausteinFehler('Diese Bestellung wird gerade freigegeben.', 409);
  if (b.rechnungId) {
    const server = await import('@/lib/finanzen/rechnung/server');
    const r = await server.rechnungLesen(b.rechnungId);
    if (r && r.status !== 'geplant' && r.status !== 'storniert') throw new BausteinFehler(`Die Rechnung ${r.nummer ?? ''} ist schon gestellt — erst unter Finanzen › Rechnungen stornieren, dann ablehnen.`.replace('  ', ' '), 409);
    if (r?.status === 'geplant') {
      try { await server.entwurfLoeschen({ id: r.id, stand: r.fassung, sicht: 'privat', wer: p.wer }); }
      catch (x) { if (x instanceof server.RechnungFehler) throw new BausteinFehler(x.message, x.status); throw x; }
    }
  }
  let absage = false;
  if (p.absage) {
    const { websiteLage, websiteMailSenden } = await import('@/lib/oeffentlich/website-post');
    const lage = await websiteLage();
    if (lage) {
      const m = absageMail({ marke: lage.marke, verantwortlich: lage.verantwortlich, datenschutzLink: lage.datenschutzLink, vorname: b.besteller.vorname, titel: b.titel });
      absage = (await websiteMailSenden({ an: b.besteller.email, vorname: b.besteller.vorname, betreff: m.betreff, text: m.text, art: 'absage', lage }, jetzt)).ok;
    }
  }
  const fertig = (await bestellungAendern(p.id, x => ({ ...x, status: 'abgelehnt', abgelehnt: { am: jetzt.toISOString(), von: p.person, ...(grund ? { grund } : {}), ...(absage ? { absage: true } : {}) }, inArbeit: undefined })))!;
  await protokolliere(BESTELLUNGEN, [{ op: 'geaendert', id: p.id, felder: ['status', 'abgelehnt'] }], p.wer);
  return fertig;
}

// ── Für die Oberfläche (nur Haushalt — prüft die Route) ─────────────────────────────────────────────────────────────────────────

export interface BestellZeile {
  id: string; am: string; titel: string; status: WirksamerStatus;
  firma: string; name: string; email: string; ort: string; land: string;
  netto: number; brutto: number; ustSatz: number;
  rechnung?: { id: string; nummer?: string; status: string };
  unbestaetigt?: true; ausland?: true; problem?: string;
  bestaetigung?: { ok: boolean; grund?: string };
  geliefert?: { am: string; von: string; ueber: string };
  abgelehnt?: { am: string; von: string; grund?: string; absage?: boolean };
  kontaktId?: string;
}

export async function bestellungenStand(): Promise<{ offen: BestellZeile[]; erledigt: BestellZeile[] }> {
  const [liste, { rechnungLesen }] = await Promise.all([bestellungenLaden(), import('@/lib/finanzen/rechnung/server')]);
  const zeilen: BestellZeile[] = [];
  for (const b of [...liste].sort((x, y) => y.am.localeCompare(x.am))) {
    const r = b.rechnungId ? await rechnungLesen(b.rechnungId) : null;
    const s = b.besteller;
    const bt = betraege(b.preisCent, b.ustSatz);
    zeilen.push({
      id: b.id, am: b.am, titel: b.titel, status: wirksamerStatus(b, r?.status), firma: s.firma, name: name(s), email: s.email, ort: s.ort, land: s.land,
      netto: bt.netto, brutto: bt.brutto, ustSatz: b.ustSatz, ...(r ? { rechnung: { id: r.id, ...(r.nummer ? { nummer: r.nummer } : {}), status: r.status } } : {}),
      ...(b.unbestaetigt ? { unbestaetigt: true as const } : {}), ...(auslandPruefen(s) ? { ausland: true as const } : {}), ...(b.problem ? { problem: b.problem } : {}),
      ...(b.bestaetigung ? { bestaetigung: { ok: b.bestaetigung.ok, ...(b.bestaetigung.grund ? { grund: b.bestaetigung.grund } : {}) } } : {}),
      ...(b.geliefert ? { geliefert: b.geliefert } : {}), ...(b.abgelehnt ? { abgelehnt: b.abgelehnt } : {}), ...(b.kontaktId ? { kontaktId: b.kontaktId } : {}),
    });
  }
  return { offen: zeilen.filter(z => z.status === 'neu'), erledigt: zeilen.filter(z => z.status !== 'neu') };
}

// ── Art. 15 (Bestellungen einer Person) ─────────────────────────────────────────────────────────────────────────────────────────

/** Die Bestellungen der Person (Kennung oder eine ihrer Adressen) — Kopie nach Art. 15 Abs. 3. */
export async function bestellungenAuskunft(m: { id: string; emails: string[] }): Promise<{ am: string; baustein: string; status: string; rechnung?: string; besteller: Besteller; bedingungen: { fassung: string; am: string } }[]> {
  const liste = await bestellungenLaden().catch(() => [] as Bestellung[]);
  const { rechnungLesen } = await import('@/lib/finanzen/rechnung/server');
  const raus = [];
  for (const b of liste.filter(x => x.kontaktId === m.id || m.emails.includes(x.besteller.email.toLowerCase()))) {
    const r = b.rechnungId ? await rechnungLesen(b.rechnungId).catch(() => null) : null;
    raus.push({ am: b.am, baustein: b.titel, status: wirksamerStatus(b, r?.status), ...(r?.nummer ? { rechnung: r.nummer } : {}), besteller: b.besteller, bedingungen: b.bedingungen });
  }
  return raus;
}
