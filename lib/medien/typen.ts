// ─── Medien unterwegs — Typen, Grenzen, Bestände (09.10., Paket 5 V1; AGENTEN_KONZEPT.md C11) ─────────────────────────
// Kevin 08.10. spät: „Über die App Bilder und Videos machen, wenn wir unterwegs sind — einfach über die Kamera. Dann gehen die Sachen
// geordnet, z. B. über ein Event, direkt auf den Server, entweder Business oder Privat. Mit denen können wir dann im Marketing arbeiten,
// wenn sie dazu freigegeben wurden … Die gehen dann direkt an die Head ofs, um sie zu bearbeiten, wenn gewollt.“
// Richtung: ENTSCHEIDUNGEN_FRAGEBOGEN.md › Fragerunde Teil 2 (09.10. nachts) + „Rückfragen geklärt“; Recherche research/agenten/MEDIEN.md,
// Recht research/agenten/RECHT.md (Hinweis, keine Rechtsberatung).
//
// EINE Stelle für Typen und Grenzen — rein und client-sicher (Browser und Server). Der Vertrag aus Paket 0 (`Medium` in
// lib/agenten/typen.ts) bleibt die Lese-Form für andere Pakete: `MediumSicht` erfüllt ihn (Projektion `alsSicht`, lib/medien/regeln.ts).
//
// Bestände (Speicher-Register, lib/crm/speicher-register.ts):
//   medien--<haushalt>        Business des Haushalts: Alben, Medien, Einwilligungen der abgebildeten Personen
//   medien-privat--<person>   Privat der Person: Alben („nur ich“ | „Haushalt“) und Medien — gehört der Person (Konto löschen entfernt alles)
//   medien-uploads            offene Upload-Sitzungen der Instanz (Stückliste, keine Inhalte), verfallen nach 7 Tagen
// Die Dateien selbst liegen NIE im Datenordner-Bestand: im Medienspeicher (Hetzner Object Storage, ohne Einrichtung Ordner `<daten>/medien`,
// der von der Nachtsicherung ausgenommen ist), verschlüsselt je Segment mit einem Schlüssel je Medium (lib/medien/krypto.ts).

import type { Bereich, Medium as VertragMedium, MedienAntwort } from '@/lib/agenten/typen';
import type { AnbieterId } from '@/lib/ki/anbieter';
import type { SichtbarAngabe } from '@/lib/ki/kennzeichnung';

export { medienBestand, medienPrivatBestand } from '@/lib/agenten/typen';
export type { Bereich };

/** Offene Upload-Sitzungen (je Instanz, ohne Suffix — Personen stehen im Eintrag). */
export const MEDIEN_UPLOADS = 'medien-uploads';

// ── Grenzen (Kevin 09.10.: Stücke 8 MB, Videos höchstens 2 GB) ───────────────────────────────────────────────────────────

const MIB = 1024 * 1024;
export const GRENZEN = {
  /** Upload-Stück: unter der 10-MB-Grenze der Next-Middleware, über dem S3-Minimum von 5 MiB. */
  teil: 8 * MIB,
  /** Segment der Verschlüsselung (Muster age/STREAM): 64 KiB Klartext + 16 Byte Prüfwert. */
  segment: 64 * 1024,
  /** Video je Datei (Kevin: „höchstens 2 GB“). */
  video: 2 * 1024 * MIB,
  /** Foto je Datei (ProRAW ausgenommen — kommt nicht durch die Typprüfung). */
  bild: 50 * MIB,
  /** Vorschaubild/Poster (Canvas, JPEG) je Datei. */
  vorschau: 2 * MIB,
  /** Lizenz-Nachweis (PDF/JPEG/PNG) bzw. Unterschrift (PNG) — ein Stück, unter der Middleware-Grenze. */
  beleg: 8 * MIB,
  /** Kantenlänge der Ansicht — zugleich das, was ein Head sieht (Claude-Vision Standard-Stufe ≤ 1568 px). */
  ansichtPx: 1568,
  /** Kantenlänge des Rasters in der Galerie. */
  rasterPx: 480,
  /** Upload-Sitzung verfällt (Frist „medien-upload“, Vorgabe). */
  sitzungTage: 7,
  /** Texte. */
  name: 120, notiz: 2000, altText: 500, bildunterschrift: 1000, post: 3000, grund: 400, albumTitel: 120,
  /** Listen am Medium — darüber 413, nie gekürzt. */
  personen: 60, heads: 20, verlauf: 500, vorschlaege: 50,
  /** Höchstens so viele Einträge je Liste in EINER Aktion. */
  ops: 50,
} as const;

/** 4K: ab dieser Kantenlänge nur mit „Original“ (Kevin: „4K nur bei Original“). Empfehlung 1080p/30 HEVC. */
export const KANTE_OHNE_ORIGINAL = 1920;

/** Wie viele Stücke eine Datei dieser Größe hat. */
export const teileVon = (bytes: number): number => Math.max(1, Math.ceil(bytes / GRENZEN.teil));
/** Klartext-Länge des Stücks `nr` (0-basiert). */
export const teilLaenge = (bytes: number, nr: number): number => Math.max(0, Math.min(GRENZEN.teil, bytes - nr * GRENZEN.teil));

// ── Grundtypen ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type MedienArt = VertragMedium['art']; // 'bild' | 'video'
/** Varianten eines Mediums im Speicher: Original, Ansicht (≤ 1568 px), Raster (Galerie), Poster (Video). */
export type Variante = 'original' | 'ansicht' | 'raster' | 'poster';
export const VARIANTEN: readonly Variante[] = ['original', 'ansicht', 'raster', 'poster'];
/** Kleine Varianten (eigenes Stück, nur Bild-Typen). */
export type VorschauVariante = Exclude<Variante, 'original'>;
export const VORSCHAU_VARIANTEN: readonly VorschauVariante[] = ['ansicht', 'raster', 'poster'];

/** Inhaltstypen — erkannt aus dem INHALT (Magic Bytes), nie aus der Endung. HEIC kommt nicht in Frage: Safari wandelt in JPEG (accept-Liste). */
export type BildTyp = 'image/jpeg' | 'image/png';
export type VideoTyp = 'video/quicktime' | 'video/mp4';
export type MedienTyp = BildTyp | VideoTyp;
export const BILD_TYPEN: readonly BildTyp[] = ['image/jpeg', 'image/png'];
export const VIDEO_TYPEN: readonly VideoTyp[] = ['video/quicktime', 'video/mp4'];

/** Kanäle einer Marketing-Freigabe — dieselben Zwecke trägt die Einwilligung (plus „ki“). */
export type Kanal = 'website' | 'social' | 'newsletter' | 'presse' | 'druck';
export const KANAELE: readonly Kanal[] = ['website', 'social', 'newsletter', 'presse', 'druck'];
export const KANAL_NAME: Record<Kanal, string> = { website: 'Website', social: 'Social Media', newsletter: 'Newsletter', presse: 'Presse', druck: 'Druck' };
/** Zwecke einer Einwilligung: die Kanäle + KI-Bearbeitung über Zuschnitt und Farbe hinaus (RECHT.md 3.1, eigenes Häkchen). */
export type EinwilligungZweck = Kanal | 'ki';
export const ZWECKE: readonly EinwilligungZweck[] = [...KANAELE, 'ki'];

/** Wer ein Album sieht: Business = „team“ (Haushalt), Privat = „nur ich“ (Vorgabe) oder „haushalt“ (Familienalbum). */
export type AlbumSicht = 'nur-ich' | 'haushalt' | 'team';
export type AlbumArt = 'event' | 'mandat' | 'projekt' | 'frei';

/** Ton eines Videos (Kevin: „Ton standardmäßig aus“, § 201 StGB). */
export type Ton =
  | 'keiner'               // keine Tonspur in der Datei
  | 'entfernt'             // die Tonspur wurde im Browser verworfen (Bytes genullt, Spur entfernt)
  | 'an'                   // Ton bewusst behalten — nach Schalter mit Hinweis § 201 StGB
  | 'nicht-freigegeben';   // Ton liegt drin, ließ sich nicht entfernen und ist nicht freigegeben: nie abspielen, nie teilen, nie an Heads

export type FreigabeStatus = 'intern' | 'angefragt' | 'freigegeben' | 'gesperrt' | 'abgelaufen';
export type SperrGrund = 'art18' | 'widerruf' | 'werbesperre' | 'ablauf' | 'art17' | 'hand';

/** Verweis auf ein verschlüsseltes Objekt im Medienspeicher (nie an den Browser). */
export interface ObjektVerweis {
  /** Schlüssel im Speicher: `<präfix>/<medium>/<variante>` — zufällige Kennung, kein Dateiname, keine Metadaten. */
  objekt: string;
  /** Klartext-Länge. */
  bytes: number;
  /** Inhaltstyp des Klartexts. */
  typ: string;
  /** Salz je Stück (8 Hex-Zeichen) — Teil der Nonce, je Versuch neu (Nonce nie doppelt). */
  salze: string[];
  /** Fingerabdruck des Klartexts (Vorschau: SHA-256; Original: SHA-256 über die Stück-Prüfsummen) — auch ETag. */
  sha256: string;
}

/** Schlüssel je Medium (DEK), gewickelt mit dem Datenschlüssel der Instanz (`kid`); ohne Datenschlüssel (lokal) `kid: null`. */
export interface GewickelterSchluessel { kid: string | null; dek: string }

export interface PersonImBild {
  /** `pb-<uuid>`. */
  id: string;
  /** Kontakt der Kartei, Konto des Haushalts (Team) oder Unbekannte (Anzahl). Keine Gesichtserkennung — nur von Hand. */
  art: 'kontakt' | 'konto' | 'unbekannt';
  kontaktId?: string;
  konto?: string;
  anzahl?: number;
  /** Hauptperson (Porträt, Nahaufnahme) oder Beiwerk (Publikum, Raum). */
  rolle: 'haupt' | 'beiwerk';
  minderjaehrig?: boolean;
  /** Einwilligung (`ew-…`) aus dem Business-Bestand. */
  einwilligungId?: string;
  markiertVon: string;
  am: string;
}

export interface MarketingFreigabe {
  status: FreigabeStatus;
  kanaele?: Kanal[];
  /** Nutzbar bis (Kalendertag) — danach automatisch „abgelaufen“ + Aufgabe. */
  bis?: string;
  angefragtVon?: string; angefragtAm?: string;
  /** Redaktionell verantwortlich (RECHT.md 7 #6) — nie ein Agent, nie der Dienstweg. */
  freigegebenVon?: string; freigegebenAm?: string;
  /**
   * KI-generiertes Medium (Paket 4c, KI-VO Art. 50): beim Freigeben bestätigt, dass es nach außen gekennzeichnet wird — `sichtbar` = das sichtbare
   * Zeichen „KI-generiert“ ist Pflicht (realistische Personen/Orte), sonst genügt die maschinenlesbare Kennzeichnung in der Datei.
   */
  kiKennzeichnung?: { sichtbar: boolean; bestaetigtVon: string; am: string };
  sperrGrund?: SperrGrund; gesperrtAm?: string;
  /** Nur der Server, nur anhängend. */
  verlauf: { am: string; von: string; nach: FreigabeStatus; grund?: string }[];
}

/**
 * Business-Heads mit Medien-Bezug (09.10., Paket 4c — Kevin 08.10.: „gehen dann direkt an die Head ofs … wenn gewollt“): nur diese bekommen Medien
 * per „An Head geben …“ (Server: `mediumAktion` › `an-head`; Oberfläche: Detailansicht). Andere Business-Heads arbeiten nicht mit Bildern.
 */
export const MEDIEN_HEADS = ['marketing', 'event', 'sales'] as const;
export type MedienHead = (typeof MEDIEN_HEADS)[number];
export const istMedienHead = (h: unknown): h is MedienHead => typeof h === 'string' && (MEDIEN_HEADS as readonly string[]).includes(h);

/** „An Head gegeben“ — ausdrücklich, mit Auftrag (Kevin: Heads sehen nur das). */
export type HeadAuftragArt = 'auswahl' | 'zuschnitt' | 'text';
export const HEAD_AUFTRAEGE: readonly HeadAuftragArt[] = ['auswahl', 'zuschnitt', 'text'];
export interface HeadZugang {
  head: string;
  /** `ha-<uuid>` — der Auftrag, unter dem der Head die Medien liest (`medienFuerHead`). */
  auftragId: string;
  auftrag: HeadAuftragArt[];
  notiz?: string;
  von: string;
  am: string;
}

/** Ein Rechteck (Anteile 0–1 des Bildes), z. B. Zuschnitt 4:5 für Social Media. */
export interface Rechteck { x: number; y: number; b: number; h: number }
export interface Zuschnitt { format: string; rechteck: Rechteck; begruendung?: string }

/** Ein freigegebener Vorschlag eines Heads am Medium (Stapel-Art `medien`); Zuschnitte führt erst ein Klick im Browser aus. */
export interface HeadVorschlagAmMedium {
  vorschlagId: string;
  head: string;
  auftragId: string;
  begruendung?: string;
  zuschnitte: Zuschnitt[];
  /** Kennungen der Medien, die aus diesem Vorschlag schon zugeschnitten wurden. */
  ausgefuehrt?: string[];
  freigegebenVon: string;
  am: string;
}

export interface MedienTexte {
  alt?: string;
  bildunterschrift?: string;
  post?: string;
  /** `mensch` = von Hand; `ki` = aus einem freigegebenen Head-Vorschlag (KI-VO Art. 50: Kennzeichen in der Oberfläche). */
  herkunft: 'mensch' | 'ki';
  head?: string;
  am: string;
  von: string;
}

/**
 * Von der KI erzeugt (Paket 4c — EINE Ablage: KI-Bilder und -Videos sind Medien wie alle anderen, nur mit dieser Herkunft). Die Bytes des Anbieters
 * liegen UNVERÄNDERT als Original (SynthID in den Pixeln, C2PA in den Metadaten — nie umkodieren, nie säubern); diese Angaben sind die zweite,
 * eigene Schicht der Kennzeichnung (lib/ki/kennzeichnung.ts `herkunftsAngabe`). Nie änderbar — auch nicht von Hand auf „von uns aufgenommen“.
 */
export interface KiHerkunft {
  anbieter: AnbieterId;
  modell: string;
  erzeugtAm: string;
  /** Was der Anbieter einbettet + unsere eigene Marke. */
  kennzeichnung: { synthid: boolean; c2pa: boolean; eigeneMarke: true };
  /** Angabe beim Erzeugen (realistische Personen/Orte → sichtbares Zeichen beim Veröffentlichen). */
  sichtbar?: SichtbarAngabe;
  zeichenNoetig: boolean;
  /** Eigener Auftragstext (der Person bzw. des Agenten) — ≤ 4.000 Zeichen, kein Text Dritter. */
  prompt: string;
  kosten?: { euroCent: number; geschaetzt: boolean };
  /** Vorgeschlagen von einem Head bzw. Mitarbeiter (`agentSchluessel`) — dann gilt `vorschlag`, bis ein Mensch im Stapel entscheidet. */
  agent?: string;
  /** offen = liegt im Freigabe-Stapel (nicht freigebbar, nicht an Heads) · uebernommen · verworfen (Papierkorb). */
  vorschlag?: 'offen' | 'uebernommen' | 'verworfen';
  /** Übernommen aus der früheren Ablage `ki-medien--<haushalt>` (Kennung `km-…`). */
  alt?: string;
}

/** Fremde Fotografen: Lizenz-Nachweis als Datei ist Pflicht vor jeder Freigabe (Kevin 09.10.). KI: `ki` statt Lizenz (Paket 4c). */
export interface Urheber {
  art: 'team' | 'extern' | 'ki';
  name?: string;
  lizenz?: ObjektVerweis & { name: string; am: string; von: string; schluessel: GewickelterSchluessel };
  ki?: KiHerkunft;
}

export interface Medium {
  /** `md-<uuid>` — dieselbe UUID wie die Upload-Sitzung (idempotent). */
  id: string;
  art: MedienArt;
  bereich: Bereich;
  /** Wer aufgenommen/hochgeladen hat (Speichername) — setzt NUR der Server. Konto gelöscht → „[gelöscht]“. */
  von: string;
  /** Album (`al-…`); fehlt = „Unsortiert“ des Bereichs. Der Bereich folgt dem Album. */
  album?: string;
  aufgenommen?: string;
  hochgeladen: string;
  typ: MedienTyp;
  groesse: number;
  name?: string;
  notiz?: string;
  breite?: number; hoehe?: number; dauerSek?: number;
  /** Exif-Drehung (1–8) aus dem Foto VOR dem Säubern — bleibt als einzige Angabe in der Datei. */
  drehung?: number;
  /** Ort aus der Datei entfernt (Foto: Exif/GPS; Video: Orts-Atome) — `false` → nie für das Marketing freigebbar. */
  ortsdatenEntfernt: boolean;
  /** Nur Video. */
  ton?: Ton;
  /** 4K bewusst als „Original“ hochgeladen. */
  original?: boolean;
  schluessel: GewickelterSchluessel;
  varianten: Partial<Record<Variante, ObjektVerweis>>;
  /** Favorit/Ablehnen JE PERSON (Speichername → Wahl). Ablehnen ≠ löschen. */
  auswahl?: Record<string, 'favorit' | 'abgelehnt'>;
  /** Pflichtfrage vor jeder Freigabe und Weitergabe an Heads. */
  erkennbarePersonen?: 'ja' | 'nein' | 'unklar';
  personen: PersonImBild[];
  urheber: Urheber;
  marketing: MarketingFreigabe;
  heads: HeadZugang[];
  texte?: MedienTexte;
  vorschlaege?: HeadVorschlagAmMedium[];
  /** `zuschnitt` = im Browser zugeschnitten; `ki` = von der KI bearbeitet (Paket 4c — Personen und Einwilligungen gehen mit). */
  abgeleitetVon?: { id: string; art: 'zuschnitt' | 'ki'; vorschlagId?: string };
  geloeschtAm?: string; geloeschtVon?: string;
  geaendert: string; geaendertVon?: string;
}

export interface Album {
  /** `al-<uuid>` frei · `al-ev-<event>` · `al-ma-<mandat>` · `al-pr-<projekt>` (fest je Bezug, idempotent). */
  id: string;
  bereich: Bereich;
  art: AlbumArt;
  bezugId?: string;
  /** Bei Bezug aus dem Bezug abgeleitet; nie Personennamen. */
  titel: string;
  sicht: AlbumSicht;
  von: string;
  angelegt: string;
  /** Nur Event: öffentliche Veranstaltung (Publikum, Bühne)? Sonst gilt: erkennbare Personen nur mit Einwilligung. */
  oeffentlich?: boolean;
  /** Vorgabe für Freigaben in diesem Album. */
  vorgabe?: { kanaele?: Kanal[]; bisMonate?: number };
  geloeschtAm?: string;
}

/** Einwilligung einer abgebildeten Person (Business) — Wortlaut, Fassung, Nachweis; nur anhängend (Widerruf als eigener Vermerk). */
export interface MedienEinwilligung {
  /** `ew-<uuid>`. */
  id: string;
  am: string;
  erfasstVon: string;
  /** Kontakt der Kartei, Konto des Haushalts (Team, Beschäftigte: schriftlich bzw. elektronisch) oder — ohne Akte — nur der Name. */
  person: { kontaktId?: string; konto?: string; name?: string };
  zwecke: EinwilligungZweck[];
  album?: string;
  wortlaut: string;
  fassung: string;
  /** Minderjährig: Einwilligung der Sorgeberechtigten (Name) — sonst nie freigebbar. */
  sorgeberechtigt?: string;
  /** Unterschrift am Handy (PNG, verschlüsselt im Medienspeicher). */
  unterschrift?: ObjektVerweis & { schluessel: GewickelterSchluessel };
  widerruf?: { am: string; von: string; grund?: string };
}

export interface MedienKatalog {
  v: 1;
  alben: Album[];
  medien: Medium[];
  /** Nur im Business-Bestand. */
  einwilligungen?: MedienEinwilligung[];
}
export const leererKatalog = (): MedienKatalog => ({ v: 1, alben: [], medien: [] });

/** Offene Upload-Sitzung (Bestand `medien-uploads`). */
export interface UploadSitzung {
  /** `up-<uuid>` — die UUID kommt vom Gerät (idempotent). */
  id: string;
  person: string;
  haushalt: string;
  mediumId: string;
  bereich: Bereich;
  album?: string;
  art: MedienArt;
  typ: MedienTyp;
  bytes: number;
  teile: number;
  objekt: string;
  /** Kennung des mehrteiligen Uploads im Speicher. */
  speicherUpload: string;
  schluessel: GewickelterSchluessel;
  erhalten: { nr: number; sha256: string; salz: string; etag: string }[];
  vorschau: Partial<Record<VorschauVariante, ObjektVerweis>>;
  meta: UploadMeta;
  angelegt: string;
  laeuftAb: string;
}

/** Was das Gerät beim Anlegen mitschickt (gesäubert im Server). */
export interface UploadMeta {
  name?: string;
  aufgenommen?: string;
  breite?: number; hoehe?: number; dauerSek?: number; drehung?: number;
  ortsdatenEntfernt: boolean;
  ton?: Ton;
  original?: boolean;
  erkennbarePersonen?: 'ja' | 'nein' | 'unklar';
  urheber?: { art: 'team' | 'extern'; name?: string };
  abgeleitetVon?: { id: string; art: 'zuschnitt' | 'ki'; vorschlagId?: string };
}

// ── Was der Browser bekommt (nie Schlüssel, nie Objekt-Namen, nie Salze) ──────────────────────────────────────────────

/** Ein Medium aus Sicht des Betrachters — erfüllt den Vertrag `Medium` aus Paket 0 (lib/agenten/typen.ts). */
export interface MediumSicht extends VertragMedium {
  album?: string;
  albumTitel?: string;
  breite?: number; hoehe?: number; dauerSek?: number;
  ortsdatenEntfernt: boolean;
  ton?: Ton;
  original?: boolean;
  /** Welche Varianten es gibt (für Raster/Ansicht/Poster/Original-Links). */
  varianten: Variante[];
  /** Fingerabdrücke der Varianten (ETag der Inhalte). */
  stand: string;
  meineWahl?: 'favorit' | 'abgelehnt';
  /** Wie viele Personen ihn als Favorit markiert haben (ohne Namen der anderen). */
  favoriten: number;
  erkennbarePersonen?: 'ja' | 'nein' | 'unklar';
  personen: PersonImBild[];
  urheber: { art: 'team' | 'extern' | 'ki'; name?: string; lizenz?: { name: string; am: string }; ki?: KiHerkunft };
  marketing: MarketingFreigabe & { wirksam: FreigabeStatus; wirksamGrund?: string };
  heads: HeadZugang[];
  texte?: MedienTexte;
  vorschlaege?: HeadVorschlagAmMedium[];
  abgeleitetVon?: Medium['abgeleitetVon'];
  geloeschtAm?: string;
  /** Darf die betrachtende Person das Medium ändern (Album, Personen, Freigabe anfragen …)? */
  darfAendern: boolean;
  /** Gehört es der betrachtenden Person? */
  meins: boolean;
}

export interface AlbumSichtEintrag {
  id: string; bereich: Bereich; art: AlbumArt; bezugId?: string; titel: string; sicht: AlbumSicht; oeffentlich?: boolean;
  vorgabe?: Album['vorgabe']; meins: boolean; anzahl: number; geloeschtAm?: string;
}

export interface EinwilligungSicht {
  id: string; am: string; erfasstVon: string; person: MedienEinwilligung['person']; zwecke: EinwilligungZweck[]; album?: string;
  fassung: string; sorgeberechtigt?: string; unterschrift: boolean; widerruf?: MedienEinwilligung['widerruf'];
}

/** GET /api/medien — erfüllt `MedienAntwort` aus dem Vertrag (Paket 0). */
export interface MedienListeAntwort extends MedienAntwort {
  medien: MediumSicht[];
  alben: AlbumSichtEintrag[];
  einwilligungen: EinwilligungSicht[];
  /** Was die betrachtende Person darf (Oberfläche blendet danach ein — die Prüfung macht trotzdem der Server). */
  /** Speichername der angemeldeten Person (für die Warteschlange auf dem Gerät: sendet nur ihre eigenen Medien). */
  ich: string;
  rechte: { privat: boolean; freigeben: boolean; heads: boolean };
  speicher: { modus: 'ordner' | 's3' | 'aus'; voll: boolean };
}

/** Kurzform für Heads (Paket 1): nur Medien mit diesem Auftrag; das Bild nur auf Abruf, höchstens 1568 px. */
export interface MediumFuerHead {
  id: string;
  art: MedienArt;
  typ: MedienTyp;
  name?: string;
  aufgenommen?: string;
  albumTitel?: string;
  auftrag: HeadAuftragArt[];
  notiz?: string;
  /** Erkennbare Personen? (ja → der KI-Schalter „Bilder mit Personen“ entscheidet im KI-Tor, Paket 1/6a.) */
  mitPersonen: boolean;
  freigabe: FreigabeStatus;
  kanaele?: Kanal[];
  texte?: MedienTexte;
  /** Von der KI erzeugt (Herkunft, Kennzeichnung) — Paket 4c. */
  ki?: Pick<KiHerkunft, 'anbieter' | 'modell' | 'zeichenNoetig'>;
  /** Ansicht (Foto) bzw. Poster (Video) — JPEG/PNG ≤ 1568 px. */
  vorschauLaden: () => Promise<{ bytes: Buffer; typ: string } | null>;
}

/** Sätze, die mehrfach vorkommen. */
export const TEXTE = {
  nurSelbst: 'Medien lädt und sieht nur die angemeldete Person selbst — nie über den Dienstweg.',
  fehlt: 'Medium nicht gefunden.',
  tonHinweis: 'Gespräche nur mit Zustimmung aller aufnehmen — das nichtöffentlich gesprochene Wort ist geschützt (§ 201 StGB). Ton nur bei Vorträgen oder mit Zustimmung behalten.',
  tonGesperrt: 'Ton nicht freigegeben — das Video wird nicht abgespielt und nicht geteilt. Ton freigeben (nur mit Zustimmung aller) oder ohne Ton neu hochladen.',
  appOffen: 'Für große Videos die App offen lassen — iOS hält Uploads im Hintergrund an. Abgebrochenes geht beim nächsten Öffnen weiter.',
  hinweis: 'Hinweis, keine Rechtsberatung.',
  kiZeichen: 'KI-generiert mit realistischen Personen oder Orten: beim Veröffentlichen sichtbar „KI-generiert“ zeigen (KI-VO Art. 50 Abs. 4) — bitte bestätigen.',
  kiVorschlag: 'Vorschlag eines Agenten — erst im Freigabe-Stapel übernehmen.',
} as const;
