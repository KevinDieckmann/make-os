// ─── Medien — Konto-Export (Art. 15/20) und Instanz-Export (AVV § 11) (09.10., Nachzug Paket 5/4c) ───────────────────────────
// Konto › Meine Daten (lib/datenschutz/konto-daten.ts `kontoExport`) bekommt die Medien der Person als METADATEN:
//   · Privat: der ganze eigene Katalog `medien-privat--<person>` (Alben „nur ich“/„Haushalt“, alle Medien, auch Papierkorb) — er gehört ihr;
//   · Business: Medien, die sie selbst aufgenommen hat, auf denen sie (als Konto) markiert ist oder die sie als Favorit/abgelehnt markiert hat —
//     von anderen Markierungen nur die ANZAHL (Kennungen Dritter gehören nicht in ihre Datei);
//   · Einwilligungen, die sie selbst gegeben hat (`person.konto`) — von Einwilligungen, die sie für andere festgehalten hat, nur die Anzahl;
//   · die Dateien selbst NIE im JSON (Videos bis 2 GB) — als Liste mit Download-Weg über die vorhandenen Routen (`/api/medien/inhalt`,
//     `/api/medien/beleg`), die dieselbe Sicht prüfen und ins Lese-Protokoll schreiben.
// Der Instanz-Export (lib/datenschutz/instanz-export.ts) bekommt die Kataloge OHNE die Schlüssel je Medium (`katalogOhneSchluessel`) und dazu
// die Liste der Objekte im Medienspeicher (`medienInstanzExport`: Bucket bzw. Ordner, Größe, Abgleich mit den Katalogen).
// Nie im Export: Schlüssel je Medium (DEK, auch gewickelt), im Konto-Export auch keine Objekt-Namen und Salze. Hinweis, keine Rechtsberatung.

import {
  medienBestand, medienPrivatBestand, leererKatalog, VARIANTEN,
  type Album, type MedienKatalog, type Medium, type PersonImBild, type Variante, type KiHerkunft,
} from './typen';

// ── Konto-Export ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface MediumExport {
  id: string;
  art: Medium['art'];
  bereich: Medium['bereich'];
  /** Wer aufgenommen bzw. hochgeladen hat (Speichername). */
  von: string;
  album?: string; albumTitel?: string;
  aufgenommen?: string; hochgeladen: string;
  typ: string; groesse: number;
  name?: string; notiz?: string;
  breite?: number; hoehe?: number; dauerSek?: number;
  ortsdatenEntfernt: boolean; ton?: Medium['ton']; original?: boolean;
  erkennbarePersonen?: Medium['erkennbarePersonen'];
  /** Privat: alle Markierungen (eigener Katalog). Business: nur die eigene. */
  personen?: PersonImBild[];
  /** Business: wie viele Markierungen es insgesamt gibt (ohne Kennungen Dritter). */
  personenAnzahl?: number;
  meineWahl?: 'favorit' | 'abgelehnt';
  urheber: { art: Medium['urheber']['art']; name?: string; lizenz?: { name: string; am: string; typ: string; bytes: number }; ki?: KiHerkunft };
  marketing: Medium['marketing'];
  heads: Medium['heads'];
  texte?: Medium['texte'];
  vorschlaege?: Medium['vorschlaege'];
  abgeleitetVon?: Medium['abgeleitetVon'];
  geloeschtAm?: string;
  geaendert: string;
  /** Welche Fassungen es gibt (Klartext-Größe, Fingerabdruck) — die Dateien stehen unter `dateien`. */
  varianten: { variante: Variante; typ: string; bytes: number; sha256: string }[];
}

export interface AlbumExport { id: string; bereich: Album['bereich']; art: Album['art']; titel: string; sicht: Album['sicht']; angelegt: string; bezugId?: string; oeffentlich?: boolean; geloeschtAm?: string }

export interface EinwilligungExport {
  id: string; am: string; zwecke: string[]; album?: string; albumTitel?: string; wortlaut: string; fassung: string;
  sorgeberechtigt?: string; unterschrift: boolean; widerrufen?: { am: string; grund?: string };
}

/** Eine Datei zum Herunterladen — nie der Inhalt selbst. `weg` = Adresse in MAKE OS (Anmeldung nötig, dieselbe Sicht wie in der App). */
export interface DateiWeg {
  bezug: string;
  art: Variante | 'lizenz' | 'unterschrift';
  typ: string;
  /** Klartext-Größe in Bytes. */
  bytes: number;
  sha256?: string;
  weg?: string;
  /** Warum es (gerade) keinen Weg gibt. */
  hinweis?: string;
}

export interface MedienKontoExport {
  hinweis: string;
  privat: { alben: AlbumExport[]; medien: MediumExport[] };
  business: { medien: MediumExport[] };
  einwilligungen: EinwilligungExport[];
  /** Einwilligungen ANDERER Personen, die diese Person festgehalten hat — nur die Zahl (die Angaben betreffen Dritte). */
  einwilligungenErfasst: number;
  dateien: DateiWeg[];
}

export const KONTO_EXPORT_HINWEIS = 'Fotos und Videos: hier stehen die Angaben (Metadaten). Die Dateien selbst liegen verschlüsselt im Medienspeicher — '
  + 'herunterladen über „dateien“ (Adresse in MAKE OS, nur angemeldet) oder in der App unter Fotos & Videos. Business-Medien: die selbst aufgenommenen, '
  + 'die, auf denen Sie markiert sind, und die Sie bewertet haben; Markierungen anderer Personen nur als Anzahl. Hinweis, keine Rechtsberatung.';

const REIHENFOLGE: readonly Variante[] = ['original', 'ansicht', 'raster', 'poster'];

/** Ein Medium für den Konto-Export (rein) — ohne Schlüssel, Objekt-Namen, Salze. `ganz` = eigener Privat-Katalog (alle Markierungen). */
export function mediumFuerKonto(m: Medium, k: MedienKatalog, speicher: string, ganz: boolean): MediumExport {
  const album = m.album ? k.alben.find(a => a.id === m.album) : undefined;
  const ich = m.personen.filter(p => p.konto === speicher);
  const l = m.urheber.lizenz;
  return {
    id: m.id, art: m.art, bereich: m.bereich, von: m.von,
    ...(m.album ? { album: m.album } : {}), ...(album ? { albumTitel: album.titel } : {}),
    ...(m.aufgenommen ? { aufgenommen: m.aufgenommen } : {}), hochgeladen: m.hochgeladen, typ: m.typ, groesse: m.groesse,
    ...(m.name ? { name: m.name } : {}), ...(m.notiz ? { notiz: m.notiz } : {}),
    ...(m.breite ? { breite: m.breite } : {}), ...(m.hoehe ? { hoehe: m.hoehe } : {}), ...(m.dauerSek ? { dauerSek: m.dauerSek } : {}),
    ortsdatenEntfernt: m.ortsdatenEntfernt, ...(m.ton ? { ton: m.ton } : {}), ...(m.original ? { original: true } : {}),
    ...(m.erkennbarePersonen ? { erkennbarePersonen: m.erkennbarePersonen } : {}),
    ...(ganz ? { personen: m.personen } : { ...(ich.length ? { personen: ich } : {}), personenAnzahl: m.personen.length }),
    ...(m.auswahl?.[speicher] ? { meineWahl: m.auswahl[speicher] } : {}),
    urheber: { art: m.urheber.art, ...(m.urheber.name ? { name: m.urheber.name } : {}), ...(l ? { lizenz: { name: l.name, am: l.am, typ: l.typ, bytes: l.bytes } } : {}), ...(m.urheber.ki ? { ki: m.urheber.ki } : {}) },
    marketing: m.marketing, heads: m.heads, ...(m.texte ? { texte: m.texte } : {}), ...(m.vorschlaege?.length ? { vorschlaege: m.vorschlaege } : {}),
    ...(m.abgeleitetVon ? { abgeleitetVon: m.abgeleitetVon } : {}), ...(m.geloeschtAm ? { geloeschtAm: m.geloeschtAm } : {}), geaendert: m.geaendert,
    varianten: REIHENFOLGE.filter(v => m.varianten[v]).map(v => ({ variante: v, typ: m.varianten[v]!.typ, bytes: m.varianten[v]!.bytes, sha256: m.varianten[v]!.sha256 })),
  };
}

/** Die Download-Wege eines Mediums (rein) — genau so, wie die Inhalt-Route sie ausliefert (Papierkorb, Ton nicht freigegeben). */
export function dateiWege(m: Medium, basis = ''): DateiWeg[] {
  const raus: DateiWeg[] = [];
  for (const v of REIHENFOLGE) {
    const x = m.varianten[v];
    if (!x) continue;
    const d: DateiWeg = { bezug: m.id, art: v, typ: x.typ, bytes: x.bytes, sha256: x.sha256 };
    if (v === 'original' && m.geloeschtAm) d.hinweis = 'Liegt im Papierkorb — erst wiederherstellen, dann herunterladen.';
    else if (v === 'original' && m.art === 'video' && m.ton === 'nicht-freigegeben') d.hinweis = 'Ton nicht freigegeben (§ 201 StGB) — das Original wird nicht ausgeliefert; Ton freigeben oder ohne Ton neu hochladen.';
    else d.weg = `${basis}/api/medien/inhalt?id=${encodeURIComponent(m.id)}&v=${v}&download=1`;
    raus.push(d);
  }
  const l = m.urheber.lizenz;
  if (l) raus.push({ bezug: m.id, art: 'lizenz', typ: l.typ, bytes: l.bytes, weg: `${basis}/api/medien/beleg?art=lizenz&id=${encodeURIComponent(m.id)}` });
  return raus;
}

const albumExport = (a: Album): AlbumExport => ({
  id: a.id, bereich: a.bereich, art: a.art, titel: a.titel, sicht: a.sicht, angelegt: a.angelegt,
  ...(a.bezugId ? { bezugId: a.bezugId } : {}), ...(a.oeffentlich !== undefined ? { oeffentlich: a.oeffentlich } : {}), ...(a.geloeschtAm ? { geloeschtAm: a.geloeschtAm } : {}),
});

/** Gehört ein Business-Medium (auch) zu dieser Person? Selbst aufgenommen, als Konto markiert oder selbst bewertet. */
export const businessMediumDerPerson = (m: Medium, speicher: string): boolean =>
  m.von === speicher || m.personen.some(p => p.konto === speicher) || !!m.auswahl?.[speicher];

/** Der Konto-Export der Medien (rein). `null`, wenn die Person keine Medien und keine eigene Einwilligung hat. */
export function medienKontoExportRein(business: MedienKatalog, privat: MedienKatalog, speicher: string, basis = ''): MedienKontoExport | null {
  const privatMedien = privat.medien.map(m => mediumFuerKonto(m, privat, speicher, true));
  const eigene = business.medien.filter(m => businessMediumDerPerson(m, speicher));
  const businessMedien = eigene.map(m => mediumFuerKonto(m, business, speicher, false));
  const alleEinw = business.einwilligungen ?? [];
  const einwilligungen = alleEinw.filter(e => e.person.konto === speicher).map((e): EinwilligungExport => {
    const album = e.album ? business.alben.find(a => a.id === e.album) : undefined;
    return {
      id: e.id, am: e.am, zwecke: [...e.zwecke], ...(e.album ? { album: e.album } : {}), ...(album ? { albumTitel: album.titel } : {}),
      wortlaut: e.wortlaut, fassung: e.fassung, ...(e.sorgeberechtigt ? { sorgeberechtigt: e.sorgeberechtigt } : {}), unterschrift: !!e.unterschrift,
      ...(e.widerruf ? { widerrufen: { am: e.widerruf.am, ...(e.widerruf.grund ? { grund: e.widerruf.grund } : {}) } } : {}),
    };
  });
  const einwilligungenErfasst = alleEinw.filter(e => e.erfasstVon === speicher && e.person.konto !== speicher).length;
  if (!privatMedien.length && !privat.alben.length && !businessMedien.length && !einwilligungen.length && !einwilligungenErfasst) return null;
  const dateien: DateiWeg[] = [...privat.medien, ...eigene].flatMap(m => dateiWege(m, basis));
  for (const e of alleEinw) {
    if (e.person.konto !== speicher || !e.unterschrift) continue;
    dateien.push({ bezug: e.id, art: 'unterschrift', typ: e.unterschrift.typ, bytes: e.unterschrift.bytes, weg: `${basis}/api/medien/beleg?art=unterschrift&id=${encodeURIComponent(e.id)}` });
  }
  return {
    hinweis: KONTO_EXPORT_HINWEIS,
    privat: { alben: privat.alben.map(albumExport), medien: privatMedien },
    business: { medien: businessMedien },
    einwilligungen, einwilligungenErfasst, dateien,
  };
}

/** Konto-Export der Medien (Server). Business nur, wenn die Person zum Haushalt des Inhabers gehört (dort liegen die Business-Medien). */
export async function medienKontoExport(speicher: string, basis = (process.env.MAKE_OS_ADRESSE ?? '').trim().replace(/\/+$/, '')): Promise<MedienKontoExport | null> {
  const { ladeKatalog, haushaltsPersonen } = await import('./server');
  const { karteiHaushalt } = await import('@/lib/crm/sperrliste');
  const privat = await ladeKatalog(medienPrivatBestand(speicher));
  const business = (await haushaltsPersonen()).includes(speicher) ? await ladeKatalog(medienBestand(await karteiHaushalt())) : leererKatalog();
  return medienKontoExportRein(business, privat, speicher, basis);
}

// ── Instanz-Export ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Bestände, deren Inhalt Schlüssel je Medium trägt (Kataloge, offene Upload-Sitzungen). */
export const istMedienBestand = (name: string): boolean => /^medien(-privat)?--[a-z0-9-]+$/.test(name) || name === 'medien-uploads';

/**
 * Schlüssel je Medium aus einem Medien-Bestand entfernen (rein, tief): jedes Feld `schluessel` mit `dek` wird zu `{ kid }` — die Kennung des
 * Datenschlüssels bleibt als Angabe, der (gewickelte) Medien-Schlüssel nie in einer Datei. Alles andere bleibt, wie es ist.
 */
export function ohneMedienSchluessel<T>(x: T): T {
  if (Array.isArray(x)) return x.map(ohneMedienSchluessel) as T;
  if (!x || typeof x !== 'object') return x;
  const raus: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    raus[k] = k === 'schluessel' && v && typeof v === 'object' && 'dek' in (v as object) ? { kid: (v as { kid?: unknown }).kid ?? null } : ohneMedienSchluessel(v);
  }
  return raus as T;
}

/** Alle Objekt-Namen, die ein Katalog nennt (Varianten, Lizenz-Nachweise, Unterschriften) — rein. */
export function katalogObjekte(k: MedienKatalog): Set<string> {
  const s = new Set<string>();
  for (const m of k.medien ?? []) {
    for (const v of VARIANTEN) if (m.varianten?.[v]?.objekt) s.add(m.varianten[v]!.objekt);
    if (m.urheber?.lizenz?.objekt) s.add(m.urheber.lizenz.objekt);
  }
  for (const e of k.einwilligungen ?? []) if (e.unterschrift?.objekt) s.add(e.unterschrift.objekt);
  return s;
}

export interface MedienInstanzExport {
  hinweis: string;
  speicher: { modus: 's3' | 'ordner' | 'aus'; ort: string; praefix: string };
  summe: { medien: number; objekte: number; bytes: number; fremd: number; ohneKatalog: number; fehlen: number };
  /** Objekte im Speicher (zufällige Namen, Chiffrat) — `kennung` = Medium bzw. Einwilligung, `imKatalog` = ein Katalog nennt es. */
  objekte: { objekt: string; bytes: number; kennung?: string; variante?: string; imKatalog: boolean; fremd?: true }[];
  /** Objekte, die ein Katalog nennt, die im Speicher aber fehlen. */
  fehlen: string[];
}

export const INSTANZ_EXPORT_MEDIEN_HINWEIS = 'Medien (Fotos, Videos, Lizenz-Nachweise, Unterschriften): Metadaten stehen in den Beständen medien--* und '
  + 'medien-privat--* (ohne Schlüssel je Medium). Die Dateien liegen verschlüsselt im Medienspeicher (Object Storage bzw. Ordner) und sind hier nur als '
  + 'Liste aufgeführt — zu groß für eine Datei. Herunterladen vor dem Löschen der Instanz einzeln in der App (Fotos & Videos › Original laden). '
  + 'Das Löschskript (scripts/instanz-loeschen.mjs) löscht die Objekte im Speicher mit.';

/** Die Liste der Objekte im Medienspeicher, abgeglichen mit den Katalogen (Server). Wirft, wenn der Speicher nicht erreichbar ist. */
export async function medienInstanzExport(kataloge: readonly MedienKatalog[]): Promise<MedienInstanzExport> {
  const { medienKonfig, medienSpeicher } = await import('./speicher');
  const { medienObjekteListen, ortVon } = await import('./instanz.mjs');
  const k = medienKonfig();
  const genannt = new Set<string>();
  for (const kat of kataloge) for (const o of katalogObjekte(kat)) genannt.add(o);
  const medien = kataloge.reduce((n, kat) => n + (kat.medien?.length ?? 0), 0);
  const leer: MedienInstanzExport = { hinweis: INSTANZ_EXPORT_MEDIEN_HINWEIS, speicher: { modus: k.modus, ort: ortVon(k), praefix: k.praefix }, summe: { medien, objekte: 0, bytes: 0, fremd: 0, ohneKatalog: 0, fehlen: 0 }, objekte: [], fehlen: [] };
  const s = await medienSpeicher();
  if (!s) return { ...leer, fehlen: [...genannt].sort(), summe: { ...leer.summe, fehlen: genannt.size } };
  const liste = await medienObjekteListen(s, k.praefix);
  const da = new Set(liste.map(o => o.objekt));
  const objekte = liste.map(o => ({ ...o, imKatalog: genannt.has(o.objekt) }));
  const fehlen = [...genannt].filter(o => !da.has(o)).sort();
  return {
    ...leer, objekte, fehlen,
    summe: { medien, objekte: objekte.filter(o => !o.fremd).length, bytes: objekte.filter(o => !o.fremd).reduce((n, o) => n + o.bytes, 0), fremd: objekte.filter(o => o.fremd).length, ohneKatalog: objekte.filter(o => !o.fremd && !o.imKatalog).length, fehlen: fehlen.length },
  };
}
