// ─── Medien — Regeln (rein, getestet; 09.10., Paket 5) ──────────────────────────────────────────────────────────────────────
// EINE Filterstelle `medienFuerBetrachter` (Plattform-Regel „Trennung serverseitig, nie nur versteckt“) für jede Antwort, dazu die
// Freigabe-Regeln (Kevin 09.10.: Marketing-Verantwortliche bzw. volles Mitglied; bei erkennbaren Personen Vier-Augen; Kanäle + bis-Datum,
// danach automatisch gesperrt; fremde Fotografen nur mit Lizenz-Nachweis; Porträts/nicht öffentliche Events nur mit Einwilligung;
// Minderjährige nie ohne Eltern; Widerruf und Art. 18 sperren sofort) und die Aktionen am Katalog. Kein Zugriff auf Platte oder Netz —
// der Server (lib/medien/server.ts) liest, ruft hier, schreibt.
//
// Wer sieht was (research/agenten/MEDIEN.md Teil F):
//   Business                       jedes Konto im Haushalt des Inhabers (die Route lässt nur diese herein) — auch „nur Business“
//   Privat der eigenen Person      alles (Album „nur ich“ und „Haushalt“, Unsortiert)
//   Privat einer anderen Person    nur volle Mitglieder (ohne `finanzRecht: 'business'`), nur Alben „Haushalt“ — nie Unsortiert,
//                                  nie „nur ich“, nicht einmal die Anzahl
//   Heads                          nur Business, nur ausdrücklich „an Head gegeben“ mit Auftrag (`medienFuerHeadRein`)
// Rechtliche Einordnung: Hinweis, keine Rechtsberatung (research/agenten/RECHT.md Teil 3, 7).

import {
  GRENZEN, KANAELE, KANAL_NAME, HEAD_AUFTRAEGE, ZWECKE, KANTE_OHNE_ORIGINAL, TEXTE, istMedienHead, MEDIEN_HEADS,
  type Album, type AlbumSicht, type AlbumSichtEintrag, type Bereich, type EinwilligungSicht, type FreigabeStatus, type HeadAuftragArt,
  type HeadZugang, type Kanal, type MarketingFreigabe, type MedienEinwilligung, type MedienKatalog, type Medium, type MediumSicht,
  type PersonImBild, type SperrGrund, type Variante, type EinwilligungZweck, type Zuschnitt,
} from './typen';
import { headDef } from '@/lib/agenten/katalog';

// ── Wer schaut ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Betrachter {
  person: string;
  /** Haushalt des Inhabers (Business-Bestand). */
  haushalt: string;
  /** Volles Mitglied: Haushalt ohne Einschränkung „nur Business“ — sieht Privat-Alben „Haushalt“ der anderen. */
  voll: boolean;
  /** Marketing-Verantwortliche (Team-Zuordnung der Instanz) — darf freigeben, auch ohne volles Mitglied zu sein. */
  marketing: boolean;
}

/** Ein geladener Katalog mit Herkunft. */
export interface Quelle { art: Bereich; besitzer?: string; katalog: MedienKatalog }

/** Was über Personen im Bild bekannt ist (Server: Kartei über `kontakteFuerVerarbeitung`, Einwilligungen). */
export interface Lage {
  heute: string;
  einwilligungen: readonly MedienEinwilligung[];
  /** Sperre einer Kontakt-Kennung: gelöscht (Art. 17), eingeschränkt (Art. 18), Werbesperre — sonst null. */
  kontaktSperre: (kontaktId: string) => 'art17' | 'art18' | 'werbesperre' | null;
}

const GELOESCHT = '[gelöscht]';

// ── Sicht ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Sieht diese Person das Album? */
export function albumSichtbar(a: Album, q: Quelle, b: Betrachter): boolean {
  if (q.art === 'business') return true;
  if (q.besitzer === b.person) return true;
  return b.voll && a.sicht === 'haushalt';
}

/** Sieht diese Person das Medium? (Unsortiert im Privat einer anderen Person: nie.) */
export function mediumSichtbar(m: Medium, q: Quelle, b: Betrachter): boolean {
  if (q.art === 'business') return m.bereich === 'business';
  if (m.bereich !== 'privat') return false;
  if (q.besitzer === b.person) return true;
  if (!b.voll || !m.album) return false;
  const a = q.katalog.alben.find(x => x.id === m.album);
  return !!a && !a.geloeschtAm && a.sicht === 'haushalt';
}

/** Darf diese Person das Medium ordnen (Album, Personen, Texte, Freigabe anfragen, an Heads geben)? */
export function darfAendern(m: Medium, q: Quelle, b: Betrachter): boolean {
  if (q.art === 'business') return true;
  return q.besitzer === b.person;
}

/** Darf diese Person fürs Marketing freigeben (nicht: ob die Freigabe inhaltlich geht — das sagt `freigabeGruende`)? */
export const darfFreigeben = (b: Betrachter): boolean => b.voll || b.marketing;

export interface Sichtbar { medium: Medium; quelle: Quelle }

/**
 * DIE Filterstelle: was eine Person aus allen geladenen Katalogen bekommt. `papierkorb`: nur Gelöschtes (das sie sonst sähe).
 * Jede Antwort (Liste, Inhalt, 409-Konflikt, Heads) läuft hierdurch.
 */
export function medienFuerBetrachter(quellen: readonly Quelle[], b: Betrachter, opt: { papierkorb?: boolean } = {}): { medien: Sichtbar[]; alben: { album: Album; quelle: Quelle }[] } {
  const medien: Sichtbar[] = [];
  const alben: { album: Album; quelle: Quelle }[] = [];
  for (const q of quellen) {
    if (q.art === 'privat' && q.besitzer !== b.person && !b.voll) continue;
    for (const a of q.katalog.alben) if (!a.geloeschtAm && albumSichtbar(a, q, b)) alben.push({ album: a, quelle: q });
    for (const m of q.katalog.medien) {
      if (!!m.geloeschtAm !== !!opt.papierkorb) continue;
      if (mediumSichtbar(m, q, b)) medien.push({ medium: m, quelle: q });
    }
  }
  return { medien, alben };
}

// ── Wirksamer Status (Sperren gelten sofort — gespeichert wird im täglichen Lauf) ─────────────────────────────────────────

const SPERR_TEXT: Record<SperrGrund, string> = {
  art18: 'Eine abgebildete Person hat die Einschränkung der Verarbeitung verlangt (Art. 18).',
  widerruf: 'Eine abgebildete Person hat ihre Einwilligung widerrufen.',
  werbesperre: 'Eine abgebildete Person hat der Werbung widersprochen.',
  ablauf: 'Die Freigabe ist abgelaufen.',
  art17: 'Eine abgebildete Person wurde gelöscht (Art. 17) — bitte prüfen.',
  hand: 'Von Hand gesperrt.',
};
export const sperrText = (g: SperrGrund): string => SPERR_TEXT[g];

const einwilligungVon = (l: Lage, id?: string) => (id ? l.einwilligungen.find(e => e.id === id) : undefined);

/** Sperrt eine markierte Person das Medium gerade (Art. 17/18, Werbesperre, Widerruf)? */
export function personenSperre(m: Pick<Medium, 'personen'>, l: Lage): SperrGrund | null {
  for (const p of m.personen) {
    if (p.kontaktId === GELOESCHT || p.konto === GELOESCHT) return 'art17';
    if (p.art === 'kontakt' && p.kontaktId) {
      const s = l.kontaktSperre(p.kontaktId);
      if (s) return s;
    }
    const e = einwilligungVon(l, p.einwilligungId);
    if (e?.widerruf) return 'widerruf';
    if (p.einwilligungId === GELOESCHT) return 'art17';
  }
  return null;
}

/** Der Status, der JETZT gilt: Sperren durch Personen sofort, Ablauf am Tag nach `bis`. */
export function wirksamerStatus(m: Pick<Medium, 'marketing' | 'personen' | 'bereich'>, l: Lage): { status: FreigabeStatus; grund?: SperrGrund } {
  const f = m.marketing;
  if (f.status === 'gesperrt') return { status: 'gesperrt', grund: f.sperrGrund ?? 'hand' };
  const s = personenSperre(m, l);
  if (s) return { status: 'gesperrt', grund: s };
  if (f.status === 'freigegeben' && f.bis && f.bis < l.heute) return { status: 'abgelaufen', grund: 'ablauf' };
  return { status: f.status };
}

// ── Freigabe-Pflichten ────────────────────────────────────────────────────────────────────────────────────────────────

const deckt = (e: MedienEinwilligung, kanaele: readonly Kanal[]) => kanaele.every(k => e.zwecke.includes(k));

/**
 * Warum dieses Medium (noch) nicht fürs Marketing freigegeben werden kann — leer = es kann. Ganze Sätze; die Oberfläche zeigt sie,
 * der Server lehnt mit dem ersten ab (400). `album` = sein Album (öffentliches Event?).
 */
export function freigabeGruende(m: Medium, album: Album | undefined, kanaele: readonly Kanal[], bis: string | undefined, l: Lage, opt: { kiZeichenBestaetigt?: boolean } = {}): string[] {
  const g: string[] = [];
  if (m.bereich !== 'business') g.push('Nur Business-Medien gehen ins Marketing — Privates bleibt im Haushalt.');
  if (m.geloeschtAm) g.push('Das Medium liegt im Papierkorb.');
  // KI-generiert (Paket 4c, KI-VO Art. 50): nie ohne Kennzeichen nach außen; ein offener Agenten-Vorschlag ist noch kein Medium des Haushalts.
  if (m.urheber.art === 'ki') {
    if (m.urheber.ki?.vorschlag === 'offen') g.push(TEXTE.kiVorschlag);
    if (m.urheber.ki?.zeichenNoetig && !opt.kiZeichenBestaetigt) g.push(TEXTE.kiZeichen);
  }
  if (!m.ortsdatenEntfernt) g.push('Ortsdaten wurden nicht sicher entfernt — so geht es nicht nach außen. Bitte erneut hochladen.');
  if (m.art === 'video' && m.ton === 'nicht-freigegeben') g.push('Der Ton ist nicht freigegeben (§ 201 StGB) — ohne Ton neu hochladen oder Ton freigeben.');
  if (!kanaele.length) g.push('Bitte mindestens einen Kanal wählen.');
  if (kanaele.some(k => !KANAELE.includes(k))) g.push('Unbekannter Kanal.');
  if (!bis || !/^\d{4}-\d{2}-\d{2}$/.test(bis) || bis <= l.heute) g.push('Bitte ein Datum in der Zukunft wählen, bis wann die Freigabe gilt.');
  if (m.urheber.art === 'extern' && !m.urheber.lizenz) g.push('Fremde Fotografin bzw. fremder Fotograf: bitte zuerst den Lizenz-Nachweis als Datei ablegen.');
  if (!m.erkennbarePersonen) g.push('Bitte zuerst beantworten: Sind Personen erkennbar?');
  if (m.erkennbarePersonen === 'unklar') g.push('„Erkennbare Personen: unklar“ — bitte klären (ja/nein), sonst geht es nicht nach außen.');
  const sperre = personenSperre(m, l);
  if (sperre) g.push(sperrText(sperre));
  if (m.erkennbarePersonen === 'ja') {
    if (!m.personen.length) g.push('Erkennbare Personen: bitte markieren, wer zu sehen ist (oder als Unbekannte).');
    const oeffentlich = album?.art === 'event' && album.oeffentlich === true;
    for (const p of m.personen) {
      const e = einwilligungVon(l, p.einwilligungId);
      const gueltig = !!e && !e.widerruf;
      if (p.minderjaehrig) {
        if (!gueltig || !e!.sorgeberechtigt) g.push('Minderjährige Person: nur mit Einwilligung der Sorgeberechtigten.');
        else if (!deckt(e!, kanaele)) g.push('Die Einwilligung der Sorgeberechtigten deckt nicht alle gewählten Kanäle.');
        continue;
      }
      const braucht = p.rolle === 'haupt' || !oeffentlich;
      if (p.art === 'unbekannt') {
        if (braucht) g.push(p.rolle === 'haupt' ? 'Eine unbekannte Hauptperson (Porträt) geht nur mit Einwilligung — bitte die Person markieren und ihre Einwilligung festhalten.' : 'Nicht öffentliche Veranstaltung: erkennbare Unbekannte gehen nur mit Einwilligung.');
        continue;
      }
      if (!braucht) continue;
      if (!gueltig) g.push(p.rolle === 'haupt' ? 'Porträt bzw. Hauptperson: nur mit Einwilligung — bitte festhalten.' : 'Nicht öffentliche Veranstaltung: erkennbare Personen nur mit Einwilligung.');
      else if (!deckt(e!, kanaele)) g.push(`Die Einwilligung deckt nicht alle Kanäle (${kanaele.filter(k => !e!.zwecke.includes(k)).map(k => KANAL_NAME[k]).join(', ')}).`);
    }
  }
  return Array.from(new Set(g));
}

// ── Heads ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Darf das Medium an einen Head gegeben werden? Gründe als Sätze (leer = ja). Minderjährige nie an Bild-KI (RECHT.md 7 #17). */
export function anHeadGruende(m: Medium, l: Lage): string[] {
  const g: string[] = [];
  if (m.bereich !== 'business') g.push('Nur Business-Medien gehen an Heads.');
  if (m.geloeschtAm) g.push('Das Medium liegt im Papierkorb.');
  if (!m.erkennbarePersonen) g.push('Bitte zuerst beantworten: Sind Personen erkennbar?');
  if (m.erkennbarePersonen === 'unklar') g.push('„Erkennbare Personen: unklar“ — bitte vorher klären.');
  if (m.personen.some(p => p.minderjaehrig)) g.push('Minderjährige gehen nie an eine Bild-KI.');
  if (m.art === 'video' && m.ton === 'nicht-freigegeben') g.push('Video mit nicht freigegebenem Ton.');
  if (m.urheber.art === 'ki' && m.urheber.ki?.vorschlag === 'offen') g.push(TEXTE.kiVorschlag);
  const w = wirksamerStatus(m, l);
  if (w.status === 'gesperrt') g.push(sperrText(w.grund ?? 'hand'));
  return g;
}

/**
 * Darf das BILD dieses Mediums (Pixel) an einen KI-Anbieter (Paket 4c: Bild bearbeiten, ein Head sieht die Vorschau)? Gründe als Sätze (leer = ja).
 * Kevin 08.10./09.10.: Medien mit erkennbaren Personen nur, wenn die Einwilligung die KI-Bearbeitung deckt (Zweck „ki“ — RECHT.md 3.1); Privat nie an
 * Business-Heads; Gesundheits- und Familienbilder nie (sie liegen im Privat-Bereich); Minderjährige nie (RECHT.md 7 #17); Unbekannte können nicht
 * einwilligen. Den Schalter der Person („Bilder an die KI“, KI-Kategorie `medien`) prüft das KI-Tor — hier nur, was am Medium hängt.
 * Hinweis, keine Rechtsberatung.
 */
export function anKiGruende(m: Medium, l: Lage): string[] {
  const g: string[] = [];
  if (m.bereich !== 'business') g.push('Private Medien gehen nie an die KI der Heads — Privates bleibt im Haushalt.');
  if (m.geloeschtAm) g.push('Das Medium liegt im Papierkorb.');
  if (m.art !== 'bild') g.push('Nur Fotos gehen als Vorlage an die KI.');
  if (m.urheber.art === 'extern') g.push('Fremde Fotografin bzw. fremder Fotograf: die Lizenz deckt keine KI-Bearbeitung — nicht an die KI.');
  if (m.urheber.art === 'ki' && m.urheber.ki?.vorschlag === 'offen') g.push(TEXTE.kiVorschlag);
  if (!m.erkennbarePersonen) g.push('Bitte zuerst beantworten: Sind Personen erkennbar?');
  if (m.erkennbarePersonen === 'unklar') g.push('„Erkennbare Personen: unklar“ — bitte vorher klären.');
  if (m.personen.some(p => p.minderjaehrig)) g.push('Minderjährige gehen nie an eine Bild-KI.');
  const w = wirksamerStatus(m, l);
  if (w.status === 'gesperrt') g.push(sperrText(w.grund ?? 'hand'));
  if (m.erkennbarePersonen === 'ja') {
    if (!m.personen.length) g.push('Erkennbare Personen: bitte markieren, wer zu sehen ist.');
    for (const p of m.personen) {
      if (p.art === 'unbekannt') { g.push('Erkennbare unbekannte Personen können nicht einwilligen — so geht das Bild nicht an die KI.'); continue; }
      const e = einwilligungVon(l, p.einwilligungId);
      if (!e || e.widerruf) g.push('Eine abgebildete Person hat keine (gültige) Einwilligung — ohne sie geht das Bild nicht an die KI.');
      else if (!e.zwecke.includes('ki')) g.push('Die Einwilligung einer abgebildeten Person deckt keine KI-Bearbeitung (Zweck „KI“ fehlt).');
    }
  }
  return Array.from(new Set(g));
}

export interface HeadEintrag { medium: Medium; zugang: HeadZugang; mitPersonen: boolean }

/** Was ein Head unter einem Auftrag sieht — nur Business, nur mit genau diesem Auftrag, nur was (noch) an Heads gehen darf. */
export function medienFuerHeadRein(business: MedienKatalog | null, headId: string, auftragId: string, l: Lage): HeadEintrag[] {
  const raus: HeadEintrag[] = [];
  for (const m of business?.medien ?? []) {
    const z = m.heads.find(h => h.head === headId && h.auftragId === auftragId);
    if (!z || m.bereich !== 'business' || anHeadGruende(m, l).length) continue;
    raus.push({ medium: m, zugang: z, mitPersonen: m.erkennbarePersonen === 'ja' });
  }
  return raus;
}

// ── Projektion für den Browser (nie Schlüssel, Objekte, Salze; Auswahl der anderen nur als Zahl) ─────────────────────────

const ALBUM_BEZUG: Partial<Record<Album['art'], 'event' | 'projekt'>> = { event: 'event', projekt: 'projekt' };

export function alsSicht(m: Medium, q: Quelle, b: Betrachter, l: Lage): MediumSicht {
  const album = m.album ? q.katalog.alben.find(a => a.id === m.album) : undefined;
  const w = wirksamerStatus(m, l);
  const varianten = (Object.keys(m.varianten) as Variante[]).filter(v => m.varianten[v]);
  const bezugArt = album?.bezugId ? ALBUM_BEZUG[album.art] : undefined;
  const eigen = q.art === 'privat' ? q.besitzer === b.person : m.von === b.person;
  return {
    id: m.id, art: m.art, bereich: m.bereich, von: m.von, ...(m.aufgenommen ? { aufgenommen: m.aufgenommen } : {}), hochgeladen: m.hochgeladen,
    typ: m.typ, groesse: m.groesse, ...(m.name ? { name: m.name } : {}), ...(m.notiz ? { notiz: m.notiz } : {}),
    ...(bezugArt && album?.bezugId ? { bezug: { art: bezugArt, id: album.bezugId } } : {}),
    freigabe: { marketing: w.status === 'freigegeben', ...(m.marketing.freigegebenAm ? { am: m.marketing.freigegebenAm } : {}), ...(m.marketing.freigegebenVon ? { von: m.marketing.freigegebenVon } : {}) },
    anHeads: Array.from(new Set(m.heads.map(h => h.head))),
    ...(m.album ? { album: m.album } : {}), ...(album ? { albumTitel: album.titel } : {}),
    ...(m.breite ? { breite: m.breite } : {}), ...(m.hoehe ? { hoehe: m.hoehe } : {}), ...(m.dauerSek ? { dauerSek: m.dauerSek } : {}),
    ortsdatenEntfernt: m.ortsdatenEntfernt, ...(m.ton ? { ton: m.ton } : {}), ...(m.original ? { original: true } : {}),
    varianten, stand: m.geaendert,
    ...(m.auswahl?.[b.person] ? { meineWahl: m.auswahl[b.person] } : {}),
    favoriten: Object.values(m.auswahl ?? {}).filter(x => x === 'favorit').length,
    ...(m.erkennbarePersonen ? { erkennbarePersonen: m.erkennbarePersonen } : {}),
    personen: m.personen,
    urheber: { art: m.urheber.art, ...(m.urheber.name ? { name: m.urheber.name } : {}), ...(m.urheber.lizenz ? { lizenz: { name: m.urheber.lizenz.name, am: m.urheber.lizenz.am } } : {}), ...(m.urheber.ki ? { ki: m.urheber.ki } : {}) },
    marketing: { ...m.marketing, wirksam: w.status, ...(w.grund ? { wirksamGrund: sperrText(w.grund) } : {}) },
    heads: m.heads, ...(m.texte ? { texte: m.texte } : {}), ...(m.vorschlaege?.length ? { vorschlaege: m.vorschlaege } : {}),
    ...(m.abgeleitetVon ? { abgeleitetVon: m.abgeleitetVon } : {}), ...(m.geloeschtAm ? { geloeschtAm: m.geloeschtAm } : {}),
    darfAendern: darfAendern(m, q, b), meins: eigen,
  };
}

export function albumAlsSicht(a: Album, q: Quelle, b: Betrachter, anzahl: number): AlbumSichtEintrag {
  return {
    id: a.id, bereich: a.bereich, art: a.art, ...(a.bezugId ? { bezugId: a.bezugId } : {}), titel: a.titel, sicht: a.sicht,
    ...(a.oeffentlich !== undefined ? { oeffentlich: a.oeffentlich } : {}), ...(a.vorgabe ? { vorgabe: a.vorgabe } : {}),
    meins: q.art === 'privat' ? q.besitzer === b.person : a.von === b.person, anzahl, ...(a.geloeschtAm ? { geloeschtAm: a.geloeschtAm } : {}),
  };
}

export const einwilligungAlsSicht = (e: MedienEinwilligung): EinwilligungSicht => ({
  id: e.id, am: e.am, erfasstVon: e.erfasstVon, person: e.person, zwecke: e.zwecke, ...(e.album ? { album: e.album } : {}), fassung: e.fassung,
  ...(e.sorgeberechtigt ? { sorgeberechtigt: e.sorgeberechtigt } : {}), unterschrift: !!e.unterschrift, ...(e.widerruf ? { widerruf: e.widerruf } : {}),
});

// ── Alben ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const BEZUG_OK = /^[a-z0-9][a-z0-9-]{0,80}$/;
/** Feste Kennung je Bezug (idempotent: dasselbe Event bekommt immer dasselbe Album). */
export function albumKennung(art: Album['art'], bezugId?: string): string | null {
  if (art === 'frei' || !bezugId || !BEZUG_OK.test(bezugId)) return null;
  return `al-${art === 'event' ? 'ev' : art === 'mandat' ? 'ma' : 'pr'}-${bezugId}`.slice(0, 96);
}
export const ALBUM_ID_OK = /^al-[a-z0-9][a-z0-9-]{0,94}$/;

// ── Säubern von Eingaben ──────────────────────────────────────────────────────────────────────────────────────────────

/** Text säubern: trimmen, Steuerzeichen raus; zu lang → `null` (der Aufrufer meldet 413 — nie still kürzen). */
export function text(v: unknown, max: number): string | undefined | null {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex -- Steuerzeichen bewusst entfernen
  const t = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (t.length > max) return null;
  return t || undefined;
}
export const kanaeleAus = (v: unknown): Kanal[] => (Array.isArray(v) ? Array.from(new Set(v.filter((k): k is Kanal => KANAELE.includes(k as Kanal)))) : []);
export const zweckeAus = (v: unknown): EinwilligungZweck[] => (Array.isArray(v) ? Array.from(new Set(v.filter((k): k is EinwilligungZweck => ZWECKE.includes(k as EinwilligungZweck)))) : []);
export const auftragAus = (v: unknown): HeadAuftragArt[] => (Array.isArray(v) ? Array.from(new Set(v.filter((k): k is HeadAuftragArt => HEAD_AUFTRAEGE.includes(k as HeadAuftragArt)))) : []);
const KONTAKT_OK = /^c-[a-z0-9-]{1,62}$/;
const PERSON_OK = /^[a-z0-9-]{1,40}$/;
const KENNUNG_OK = /^[a-z]{1,4}-[a-z0-9-]{4,80}$/;
export const kennungOk = (v: unknown): v is string => typeof v === 'string' && KENNUNG_OK.test(v);

/** 4K ohne „Original“? (Kevin: „4K nur bei Original“ — Empfehlung 1080p/30.) */
export const brauchtOriginal = (breite?: number, hoehe?: number): boolean => Math.max(breite ?? 0, hoehe ?? 0) > KANTE_OHNE_ORIGINAL;

/** Rechteck in Anteilen 0–1, ganz im Bild, nicht winzig. */
export function rechteckOk(r: unknown): r is Zuschnitt['rechteck'] {
  const o = r as Zuschnitt['rechteck'];
  return !!o && [o.x, o.y, o.b, o.h].every(n => typeof n === 'number' && Number.isFinite(n)) && o.x >= 0 && o.y >= 0 && o.b >= 0.05 && o.h >= 0.05 && o.x + o.b <= 1.0001 && o.y + o.h <= 1.0001;
}

// ── Aktionen am Katalog ───────────────────────────────────────────────────────────────────────────────────────────────

export type Fehler = { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };
const F = (status: Fehler['status'], fehler: string): Fehler => ({ ok: false, status, fehler });

export interface Kontext {
  b: Betrachter;
  quelle: Quelle;
  lage: Lage;
  jetzt: string;
  neueId: (praefix: string) => string;
}

/** Eine Aktion an EINEM Medium (Kopie des Katalogs zurück, oder ein Fehler). `stand` (optional) = `geaendert` aus der Sicht → sonst 409. */
export function mediumAktion(k: Kontext, mediumId: string, a: Record<string, unknown>): { ok: true; katalog: MedienKatalog; medium: Medium } | Fehler {
  const kat = k.quelle.katalog;
  const i = kat.medien.findIndex(x => x.id === mediumId);
  if (i < 0) return F(404, 'Medium nicht gefunden.');
  const alt = kat.medien[i];
  if (!mediumSichtbar(alt, k.quelle, k.b) && !(alt.geloeschtAm && darfAendern(alt, k.quelle, k.b))) return F(404, 'Medium nicht gefunden.');
  if (typeof a.stand === 'string' && a.stand !== alt.geaendert) return F(409, 'Das Medium wurde inzwischen geändert — bitte neu laden.');
  const aendern = darfAendern(alt, k.quelle, k.b);
  const art = String(a.aktion ?? '');
  const m: Medium = structuredClone(alt);
  const verlauf = (nach: FreigabeStatus, grund?: string) => {
    if (m.marketing.verlauf.length >= GRENZEN.verlauf) return false;
    m.marketing.verlauf.push({ am: k.jetzt, von: k.b.person, nach, ...(grund ? { grund } : {}) });
    return true;
  };

  if (art !== 'auswahl' && !aendern) return F(403, 'Dieses Medium gehört einer anderen Person — ändern kann es nur sie.');
  if (m.geloeschtAm && !['wiederherstellen', 'auswahl'].includes(art)) return F(409, 'Das Medium liegt im Papierkorb — erst wiederherstellen.');

  switch (art) {
    case 'auswahl': {
      const w = a.wahl;
      if (w !== 'favorit' && w !== 'abgelehnt' && w !== null) return F(400, 'Wahl: favorit, abgelehnt oder null.');
      const neu = { ...(m.auswahl ?? {}) };
      if (w === null) delete neu[k.b.person]; else neu[k.b.person] = w;
      if (Object.keys(neu).length) m.auswahl = neu; else delete m.auswahl;
      break;
    }
    case 'aendern': {
      const name = text(a.name, GRENZEN.name), notiz = text(a.notiz, GRENZEN.notiz);
      if (name === null || notiz === null) return F(413, 'Text zu lang.');
      if ('name' in a) { if (name) m.name = name; else delete m.name; }
      if ('notiz' in a) { if (notiz) m.notiz = notiz; else delete m.notiz; }
      if ('erkennbarePersonen' in a) {
        const e = a.erkennbarePersonen;
        if (e !== 'ja' && e !== 'nein' && e !== 'unklar') return F(400, 'Erkennbare Personen: ja, nein oder unklar.');
        if (e === 'nein' && m.personen.some(p => p.art !== 'unbekannt' || p.rolle === 'haupt')) return F(409, 'Es sind Personen markiert — erst die Markierungen entfernen.');
        m.erkennbarePersonen = e;
      }
      if ('album' in a) {
        const ziel = a.album === null ? undefined : String(a.album);
        if (ziel !== undefined) {
          const al = kat.alben.find(x => x.id === ziel && !x.geloeschtAm);
          if (!al || al.bereich !== m.bereich) return F(400, 'Album gibt es in diesem Bereich nicht.');
        }
        if (ziel) m.album = ziel; else delete m.album;
      }
      if ('urheber' in a) {
        // KI-Herkunft bleibt (KI-VO Art. 50) — ein KI-Medium wird nie von Hand zu „von uns aufgenommen“.
        if (m.urheber.art === 'ki') return F(409, 'Von der KI erzeugt — die Herkunft bleibt und lässt sich nicht ändern.');
        const u = a.urheber as { art?: unknown; name?: unknown } | null;
        if (!u || (u.art !== 'team' && u.art !== 'extern')) return F(400, 'Urheber: team oder extern.');
        const n = text(u.name, GRENZEN.name);
        if (n === null) return F(413, 'Name zu lang.');
        m.urheber = { ...m.urheber, art: u.art, ...(n ? { name: n } : {}) };
        if (!n) delete m.urheber.name;
      }
      break;
    }
    case 'texte': {
      const alt2 = text(a.alt, GRENZEN.altText), bu = text(a.bildunterschrift, GRENZEN.bildunterschrift), post = text(a.post, GRENZEN.post);
      if (alt2 === null || bu === null || post === null) return F(413, 'Text zu lang.');
      m.texte = { ...(alt2 ? { alt: alt2 } : {}), ...(bu ? { bildunterschrift: bu } : {}), ...(post ? { post } : {}), herkunft: 'mensch', am: k.jetzt, von: k.b.person };
      break;
    }
    case 'person-markieren': {
      if (m.personen.length >= GRENZEN.personen) return F(413, `Höchstens ${GRENZEN.personen} Personen je Medium.`);
      const p = a.person as Partial<PersonImBild> | undefined;
      const rolle = p?.rolle === 'haupt' ? 'haupt' : p?.rolle === 'beiwerk' ? 'beiwerk' : null;
      if (!p || !rolle) return F(400, 'Rolle: Hauptperson oder Beiwerk.');
      const neu: PersonImBild = { id: k.neueId('pb'), art: 'unbekannt', rolle, markiertVon: k.b.person, am: k.jetzt };
      if (p.art === 'kontakt') {
        if (!p.kontaktId || !KONTAKT_OK.test(p.kontaktId)) return F(400, 'Kontakt-Kennung ungültig.');
        if (k.lage.kontaktSperre(p.kontaktId) === 'art18') return F(409, 'Diese Person hat die Einschränkung der Verarbeitung verlangt (Art. 18) — sie wird nicht markiert.');
        if (m.personen.some(x => x.kontaktId === p.kontaktId)) return F(409, 'Diese Person ist schon markiert.');
        Object.assign(neu, { art: 'kontakt', kontaktId: p.kontaktId });
      } else if (p.art === 'konto') {
        if (!p.konto || !PERSON_OK.test(p.konto)) return F(400, 'Konto ungültig.');
        if (m.personen.some(x => x.konto === p.konto)) return F(409, 'Diese Person ist schon markiert.');
        Object.assign(neu, { art: 'konto', konto: p.konto });
      } else {
        const n = Number(p.anzahl ?? 1);
        if (!Number.isInteger(n) || n < 1 || n > 500) return F(400, 'Anzahl Unbekannter: 1–500.');
        neu.anzahl = n;
      }
      if (p.minderjaehrig === true) neu.minderjaehrig = true;
      if (p.einwilligungId !== undefined) {
        const e = k.lage.einwilligungen.find(x => x.id === p.einwilligungId);
        if (!e) return F(400, 'Einwilligung nicht gefunden.');
        neu.einwilligungId = e.id;
      }
      m.personen.push(neu);
      if (!m.erkennbarePersonen || m.erkennbarePersonen === 'nein' || m.erkennbarePersonen === 'unklar') m.erkennbarePersonen = 'ja';
      break;
    }
    case 'person-aendern': {
      const p = m.personen.find(x => x.id === a.personId);
      if (!p) return F(404, 'Markierung nicht gefunden.');
      if (a.rolle === 'haupt' || a.rolle === 'beiwerk') p.rolle = a.rolle;
      if (typeof a.minderjaehrig === 'boolean') { if (a.minderjaehrig) p.minderjaehrig = true; else delete p.minderjaehrig; }
      if ('einwilligungId' in a) {
        if (a.einwilligungId === null) delete p.einwilligungId;
        else {
          const e = k.lage.einwilligungen.find(x => x.id === a.einwilligungId);
          if (!e) return F(400, 'Einwilligung nicht gefunden.');
          p.einwilligungId = e.id;
        }
      }
      break;
    }
    case 'person-entfernen': {
      const n = m.personen.length;
      m.personen = m.personen.filter(x => x.id !== a.personId);
      if (m.personen.length === n) return F(404, 'Markierung nicht gefunden.');
      break;
    }
    case 'freigabe': {
      const schritt = String(a.schritt ?? '');
      const f: MarketingFreigabe = m.marketing;
      const w = wirksamerStatus(m, k.lage);
      if (m.bereich !== 'business') return F(400, 'Nur Business-Medien gehen ins Marketing.');
      if (schritt === 'anfragen') {
        if (w.status === 'gesperrt' && w.grund !== 'hand') return F(409, sperrText(w.grund!));
        if (f.status === 'angefragt' || f.status === 'freigegeben') return F(409, f.status === 'angefragt' ? 'Die Freigabe ist schon angefragt.' : 'Das Medium ist schon freigegeben.');
        const kan = kanaeleAus(a.kanaele);
        f.status = 'angefragt'; f.angefragtVon = k.b.person; f.angefragtAm = k.jetzt;
        if (kan.length) f.kanaele = kan;
        if (typeof a.bis === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.bis)) f.bis = a.bis;
        delete f.sperrGrund; delete f.gesperrtAm;
        if (!verlauf('angefragt')) return F(413, 'Verlauf voll.');
      } else if (schritt === 'freigeben') {
        if (!darfFreigeben(k.b)) return F(403, 'Freigeben dürfen die Marketing-Verantwortliche und volle Mitglieder des Haushalts.');
        const kan = kanaeleAus(a.kanaele ?? f.kanaele);
        const bis = typeof a.bis === 'string' ? a.bis : f.bis;
        const album = m.album ? kat.alben.find(x => x.id === m.album) : undefined;
        const gruende = freigabeGruende(m, album, kan, bis, k.lage, { kiZeichenBestaetigt: a.kiZeichenBestaetigt === true });
        if (gruende.length) return F(400, gruende[0]);
        if (m.erkennbarePersonen === 'ja') {
          if (f.status !== 'angefragt') return F(409, 'Erkennbare Personen: Vier-Augen-Prinzip — erst anfragen, dann gibt eine andere Person frei.');
          if (f.angefragtVon === k.b.person) return F(403, 'Erkennbare Personen: Vier-Augen-Prinzip — freigeben muss eine andere Person als die, die angefragt hat.');
        }
        Object.assign(f, { status: 'freigegeben', kanaele: kan, bis, freigegebenVon: k.b.person, freigegebenAm: k.jetzt });
        // KI-generiert: die Kennzeichnung nach außen ist Teil der Freigabe (sichtbar bei realistischen Personen/Orten — bestätigt).
        if (m.urheber.art === 'ki') f.kiKennzeichnung = { sichtbar: !!m.urheber.ki?.zeichenNoetig, bestaetigtVon: k.b.person, am: k.jetzt };
        delete f.sperrGrund; delete f.gesperrtAm;
        if (!verlauf('freigegeben')) return F(413, 'Verlauf voll.');
      } else if (schritt === 'ablehnen') {
        if (f.status !== 'angefragt') return F(409, 'Es ist keine Freigabe angefragt.');
        if (!darfFreigeben(k.b)) return F(403, 'Ablehnen dürfen die Marketing-Verantwortliche und volle Mitglieder des Haushalts.');
        const grund = text(a.grund, GRENZEN.grund);
        if (grund === null) return F(413, 'Grund zu lang.');
        f.status = 'intern';
        if (!verlauf('intern', grund ?? 'abgelehnt')) return F(413, 'Verlauf voll.');
      } else if (schritt === 'sperren') {
        const grund = text(a.grund, GRENZEN.grund);
        if (grund === null) return F(413, 'Grund zu lang.');
        Object.assign(f, { status: 'gesperrt', sperrGrund: 'hand', gesperrtAm: k.jetzt });
        if (!verlauf('gesperrt', grund ?? 'von Hand')) return F(413, 'Verlauf voll.');
      } else if (schritt === 'entsperren') {
        if (f.status !== 'gesperrt' && f.status !== 'abgelaufen') return F(409, 'Das Medium ist nicht gesperrt.');
        if (f.status === 'gesperrt' && f.sperrGrund && f.sperrGrund !== 'hand' && f.sperrGrund !== 'ablauf') return F(409, `${sperrText(f.sperrGrund)} Diese Sperre hebt sich nicht von Hand auf.`);
        if (personenSperre(m, k.lage)) return F(409, sperrText(personenSperre(m, k.lage)!));
        f.status = 'intern'; delete f.sperrGrund; delete f.gesperrtAm;
        if (!verlauf('intern', 'entsperrt')) return F(413, 'Verlauf voll.');
      } else return F(400, 'Schritt: anfragen, freigeben, ablehnen, sperren oder entsperren.');
      break;
    }
    case 'an-head': {
      const gruende = anHeadGruende(m, k.lage);
      if (gruende.length) return F(400, gruende[0]);
      const head = String(a.head ?? '');
      if (headDef(head)?.bereich !== 'business') return F(400, 'Head unbekannt — Medien gehen nur an Business-Heads.');
      if (!istMedienHead(head)) return F(400, `Medien gehen nur an Heads, die mit Bildern arbeiten (${MEDIEN_HEADS.map(h => headDef(h)?.kurz ?? h).join(', ')}).`);
      const auftrag = auftragAus(a.auftrag);
      if (!auftrag.length) return F(400, 'Bitte den Auftrag wählen (Auswahl, Zuschnitt, Texte).');
      const notiz = text(a.notiz, GRENZEN.notiz);
      if (notiz === null) return F(413, 'Notiz zu lang.');
      if (m.heads.length >= GRENZEN.heads) return F(413, `Höchstens ${GRENZEN.heads} Head-Aufträge je Medium.`);
      const auftragId = typeof a.auftragId === 'string' && /^ha-[a-z0-9-]{8,60}$/.test(a.auftragId) ? a.auftragId : k.neueId('ha');
      if (!m.heads.some(h => h.head === head && h.auftragId === auftragId)) m.heads.push({ head, auftragId, auftrag, ...(notiz ? { notiz } : {}), von: k.b.person, am: k.jetzt });
      break;
    }
    case 'head-entziehen': {
      const n = m.heads.length;
      m.heads = m.heads.filter(h => !(h.auftragId === a.auftragId && (!a.head || h.head === a.head)));
      if (m.heads.length === n) return F(404, 'Auftrag nicht gefunden.');
      break;
    }
    case 'ton-freigeben': {
      if (m.art !== 'video' || m.ton !== 'nicht-freigegeben') return F(409, 'Hier gibt es keinen Ton freizugeben.');
      if (a.bestaetigt !== true) return F(400, 'Bitte bestätigen: alle Gesprochenen sind mit der Aufnahme einverstanden (§ 201 StGB).');
      if (k.quelle.art === 'business' ? m.von !== k.b.person : k.quelle.besitzer !== k.b.person) return F(403, 'Den Ton gibt nur die Person frei, die aufgenommen hat.');
      m.ton = 'an';
      break;
    }
    case 'loeschen': {
      m.geloeschtAm = k.jetzt; m.geloeschtVon = k.b.person;
      m.heads = [];
      break;
    }
    case 'wiederherstellen': {
      if (!m.geloeschtAm) return F(409, 'Das Medium liegt nicht im Papierkorb.');
      delete m.geloeschtAm; delete m.geloeschtVon;
      if (m.album && !kat.alben.some(x => x.id === m.album && !x.geloeschtAm)) delete m.album;
      break;
    }
    default:
      return F(400, 'Unbekannte Aktion.');
  }
  m.geaendert = k.jetzt; m.geaendertVon = k.b.person;
  const medien = kat.medien.slice();
  medien[i] = m;
  return { ok: true, katalog: { ...kat, medien }, medium: m };
}

/** Ein Album anlegen (Bezug → feste Kennung, idempotent) — Business = „team“, Privat = „nur ich“ (Vorgabe) oder „haushalt“. */
export function albumAnlegen(k: Kontext, a: Record<string, unknown>): { ok: true; katalog: MedienKatalog; album: Album } | Fehler {
  const kat = k.quelle.katalog;
  const art = (['event', 'mandat', 'projekt', 'frei'] as const).find(x => x === a.art);
  if (!art) return F(400, 'Album-Art: event, mandat, projekt oder frei.');
  const bezugId = typeof a.bezugId === 'string' ? a.bezugId : undefined;
  const titel = text(a.titel, GRENZEN.albumTitel);
  if (titel === null) return F(413, 'Titel zu lang.');
  if (!titel) return F(400, 'Bitte einen Titel angeben.');
  const id = albumKennung(art, bezugId) ?? k.neueId('al');
  if (art !== 'frei' && !albumKennung(art, bezugId)) return F(400, 'Bezug fehlt oder ist ungültig.');
  if (k.quelle.art === 'privat' && (art === 'event' || art === 'mandat')) return F(400, 'Event- und Kunden-Alben gibt es nur im Business.');
  const da = kat.alben.find(x => x.id === id);
  if (da && !da.geloeschtAm) return { ok: true, katalog: kat, album: da };
  const sicht: AlbumSicht = k.quelle.art === 'business' ? 'team' : a.sicht === 'haushalt' ? 'haushalt' : 'nur-ich';
  const album: Album = {
    id, bereich: k.quelle.art, art, ...(bezugId && art !== 'frei' ? { bezugId } : {}), titel, sicht, von: k.b.person, angelegt: k.jetzt,
    ...(art === 'event' ? { oeffentlich: a.oeffentlich === true } : {}),
  };
  const alben = kat.alben.filter(x => x.id !== id);
  alben.push(album);
  return { ok: true, katalog: { ...kat, alben }, album };
}

/** Album ändern (Titel, Sicht „nur ich“/„Haushalt“, öffentlich, Vorgabe der Freigabe) bzw. löschen (nur leer). */
export function albumAendern(k: Kontext, a: Record<string, unknown>): { ok: true; katalog: MedienKatalog; album: Album } | Fehler {
  const kat = k.quelle.katalog;
  const i = kat.alben.findIndex(x => x.id === a.id && !x.geloeschtAm);
  if (i < 0) return F(404, 'Album nicht gefunden.');
  const al = structuredClone(kat.alben[i]);
  if (!albumSichtbar(al, k.quelle, k.b)) return F(404, 'Album nicht gefunden.');
  if (k.quelle.art === 'privat' && k.quelle.besitzer !== k.b.person) return F(403, 'Dieses Album gehört einer anderen Person.');
  if (a.loeschen === true) {
    if (kat.medien.some(m => m.album === al.id && !m.geloeschtAm)) return F(409, 'Das Album ist nicht leer — erst die Medien verschieben oder löschen.');
    al.geloeschtAm = k.jetzt;
  } else {
    const titel = text(a.titel, GRENZEN.albumTitel);
    if (titel === null) return F(413, 'Titel zu lang.');
    if (titel) al.titel = titel;
    if (k.quelle.art === 'privat' && (a.sicht === 'nur-ich' || a.sicht === 'haushalt')) al.sicht = a.sicht;
    if (al.art === 'event' && typeof a.oeffentlich === 'boolean') al.oeffentlich = a.oeffentlich;
    if (a.vorgabe && typeof a.vorgabe === 'object') {
      const v = a.vorgabe as { kanaele?: unknown; bisMonate?: unknown };
      const monate = Number(v.bisMonate);
      al.vorgabe = { ...(kanaeleAus(v.kanaele).length ? { kanaele: kanaeleAus(v.kanaele) } : {}), ...(Number.isInteger(monate) && monate >= 1 && monate <= 120 ? { bisMonate: monate } : {}) };
    }
  }
  const alben = kat.alben.slice();
  alben[i] = al;
  return { ok: true, katalog: { ...kat, alben }, album: al };
}

/** Einwilligung widerrufen — nur anhängend (der Eintrag bleibt als Nachweis), sperrt sofort alle Medien mit dieser Einwilligung. */
export function einwilligungWiderrufen(kat: MedienKatalog, id: unknown, von: string, jetzt: string, grund?: string): { ok: true; katalog: MedienKatalog; betroffen: string[] } | Fehler {
  const l = kat.einwilligungen ?? [];
  const i = l.findIndex(e => e.id === id);
  if (i < 0) return F(404, 'Einwilligung nicht gefunden.');
  if (l[i].widerruf) return F(409, 'Diese Einwilligung ist schon widerrufen.');
  const einw = l.slice();
  einw[i] = { ...l[i], widerruf: { am: jetzt, von, ...(grund ? { grund } : {}) } };
  const betroffen: string[] = [];
  const medien = kat.medien.map(m => {
    if (!m.personen.some(p => p.einwilligungId === id)) return m;
    betroffen.push(m.id);
    if (m.marketing.status === 'gesperrt') return m;
    return { ...m, marketing: { ...m.marketing, status: 'gesperrt' as const, sperrGrund: 'widerruf' as const, gesperrtAm: jetzt, verlauf: [...m.marketing.verlauf, { am: jetzt, von, nach: 'gesperrt' as const, grund: 'Einwilligung widerrufen' }] }, geaendert: jetzt, geaendertVon: von };
  });
  return { ok: true, katalog: { ...kat, einwilligungen: einw, medien }, betroffen };
}

/** Neues Medium mit Startwerten (der Server füllt Varianten/Schlüssel). */
export function neuesMedium(x: Omit<Medium, 'personen' | 'urheber' | 'marketing' | 'heads' | 'geaendert'> & { urheber?: Medium['urheber']; jetzt: string }): Medium {
  const { jetzt, urheber, ...rest } = x;
  return { ...rest, personen: [], urheber: urheber ?? { art: 'team' }, marketing: { status: 'intern', verlauf: [] }, heads: [], geaendert: jetzt };
}
