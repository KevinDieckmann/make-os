// ─── Fulfillment · Prozesse — Import von Bausteinen und Abläufen (C1, 10.10.; FULFILLMENT_KONZEPT.md 2.6, 2.7) ──────────────────────
// Zwei Dateiformate, EIN Weg (Vorschau → Übernehmen → Rückgängig):
//   · Bausteine: `{ meta?, quellenverzeichnis?, vorlagen: [...] }` (Format von vorlagen.json, _2, _3, _4 und dem späteren konsolidierten Katalog)
//   · Abläufe:   `{ <schlüssel>: { titel, form, stufen[], uebergaenge[], phasen?, quelle?, vorbehalt?, zeichenhinweis[], ein_ausstiege? } }`
// Unbekannte Zusatzfelder werden toleriert (ignoriert). NIE übernommen: `quellenverzeichnis`, `link`-Felder (private Ablage-Adressen),
// `instanzwerte`/`instanzspezifisch` (Preise — die gehören in den Produktkatalog; die Vorschau zeigt sie als Hinweis). Die Schlüssel der
// Ablauf-Datei (Prozessnamen früherer Unternehmen) werden NIE Kennung oder Titel — die Kennung entsteht aus dem Titel (`fp-imp-<slug>`).
//
// Bausteine bekommen die Kennung `fb-imp-<quell-id>` (Präfixe s2-/s3-/s4- der Dateien bleiben drin → keine Kollision; derselbe Import
// noch einmal aktualisiert statt zu verdoppeln). Vorhandene Bausteine mit gleicher Kennung: nur LEERE Felder werden ergänzt (Entscheidung 10.10.);
// abweichende Inhalte stehen in der Vorschau („abweichend“ bzw. „Konflikt“, wenn von Hand geändert) und gehen nur mit „Import nehmen“ rein.
// Marken: „vor Einsatz rechtlich prüfen“ (`rechtVorschlag`), „vor Verkauf prüfen“ (gekauftes/fremdes Material, `pruefen_vor_verkauf`),
// „nur intern“ (`nur_intern`). Grenzen: ≤ 400 Bausteine bzw. ≤ 20 Abläufe je Datei (413), sonst wird abgelehnt — nie still gekürzt.
// Rein und client-sicher; die Route (app/api/fulfillment/import) prüft Größe (≤ 4 MB) und Stand (vorschauId → 409).
//
// Seit 17.10. (Prozess-Editor, Bibliothek) ein drittes Format, derselbe Weg:
//   · Pakete:    `{ format?: 'make-os/pakete', pakete: [ { schluessel?, titel, beschreibung?, vorbehalt?, quelle?, abstimmungen?, rollen?, phasen: [
//                  { id, titel, abstimmung?, dauerTage?, ziel?, warum?, kundeSichtbar?, kreislauf?, fluss: [ Schritt | { gruppe, id, fluss: [Schritt] } ] } ] } ],
//                  vorlagen?: [...] }`
//     Schritt = `{ id, titel, form?, frist?, zweige?: { ja?, nein? }, zustaendig?, kundeSichtbar?, ziel?, ergebnis?, kennzahl?, rolle?, dauerTage?, abstimmung?,
//     versuche?, pos?: { x, y }, pfeilText?: { weiter?, ja?, nein? }, bausteine?: [Kennung] }` — Formen, Fristen, Zweige, Versuche (1–20), Lage und Pfeil-
//     Beschriftung wie im Editor (dieselben Werkzeuge, `zweigePruefen`, `vorlageStrukturPruefen`, `lageAus`, `pfeilTextAus`; seit 17.10. spät), Bausteine per
//     Kennung der Quelle (→ `fb-imp-<id>`) oder als vorhandene Kennung `fb-…`; sie müssen in der Bibliothek ODER im `vorlagen`-Teil derselben Datei stehen,
//     sonst blockiert die Datei (nichts still ohne Baustein). Eine Paket-Vorlage bekommt `fp-imp-pk-<slug>`, ihre Knoten feste Kennungen aus den Quell-Kennungen
//     (wiederholbar, ändert nichts doppelt) und `phasenVonHand` (die Reihenfolge der Datei gilt). Folgende Schritte ohne Gruppe bilden EINEN Strang; trägt einer
//     davon Bausteine, stehen sie in einem Sammel-Teilprozess (heißt wie die Phase — dieselbe Form, die der Editor anlegt). Eine Phase darf `pos` tragen (Rahmen
//     auf der Fläche, mit `b`/`h`), ein Paket `zusatz: true` (Zusatzmodul — hängt an einen laufenden Fall an, startet ohne Onboarding). `verbindungen` (freie
//     Pfeile) kennt das Format nicht — wie jedes unbekannte Feld ignoriert.
// Ein JSON-Array auf oberster Ebene gilt als Bausteine-Liste (`vorlagen`). `pruefgrund` einer Quelle wird der Grund von „vor Verkauf prüfen“, `zusatz` ein
// Schlagwort `zusatz:<wert>`, `siehe_auch` (bzw. `sieheAuch`, 17.10. spät) die Verweise „Siehe auch“ (Kennungen der Quelle → `fb-imp-<id>`; nur, was in der
// Bibliothek bzw. der Datei steht — die übrigen nennt die Vorschau und lässt sie weg). Die Vorschau zählt zusätzlich (`zahlen`) und nennt mögliche Duplikate
// (gleicher Titel, andere Kennung) — beide bleiben.

import type { AnwendenErgebnis, Baustein, BausteinArt, Freigabepunkt, ImportLauf, KnotenForm, ProzessKnoten, ProzessVorlage, Rolle, Uebergang, VorlagenDatei, Zweige } from '../typen';
import { BAUSTEIN_ARTEN, KNOTEN_FORMEN, KREISLAUF_IDS, vorlageAus } from '../lesen';
import { GRENZEN, ID_FREI, KENNUNG, TEXT_MAX } from '../grenzen';
import { ebeneVon, kinderVon, vorfahren } from '../regeln';
import { PHASEN, SAMMEL_ALLGEMEIN, SAMMEL_SCHRITT, WEITERE_BAUSTEINE, phaseEinfuegen, phaseFinden, phaseTitel, phaseVon } from './phasen';
import { TAG_NUR_INTERN, TAG_VOR_VERKAUF, GLIEDERUNG_PUNKT_MAX } from './bausteine';
import { vorlageStrukturPruefen } from './vorlagen-anwenden';
import { zweigePruefen } from './fluss-struktur';
import { FRIST_MAX, lageAus, pfeilTextAus } from './editor';
import { rahmenOrdnen, umrissVon } from './flaeche-lage';
import { ausfuehren, fnv, istObj, nein, optBool, optText, optWahl, optZahl, pflichtText, slug, titelForm } from './pruefen';
import { anzahl } from '@/lib/text/zahlwort';

export const IMPORT_GRENZEN = { bytes: 4 * 1024 * 1024, bausteine: 400, ablaeufe: 20, laufTage: 30 } as const;
const QUELL_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export type ImportFormat = 'bausteine' | 'ablaeufe' | 'pakete';
export type BausteinStatus = 'neu' | 'gleich' | 'ergaenzt' | 'abweichend' | 'konflikt';

export interface ImportBausteinVorschau {
  id: string; quelle: string; titel: string; art: BausteinArt; status: BausteinStatus;
  /** Ergänzte bzw. abweichende Felder. */
  felder: string[];
  recht?: string; urheber?: string; nurIntern: boolean; preis: boolean;
  pakete: string[]; giltFuer: string[]; phase?: string; unterphase?: string;
}
export interface ImportAblaufVorschau { id: string; titel: string; form: NonNullable<ProzessVorlage['form']>; stufen: number; uebergaenge: number; ergaenzungen: number; status: 'neu' | 'gleich' | 'aktualisiert' | 'konflikt' }
/** Eine Paket-Vorlage der Datei (Format „Pakete“, 17.10.) — Zahlen je Form, damit vor dem Übernehmen klar ist, was entsteht. */
export interface ImportPaketVorschau {
  id: string; titel: string; status: 'neu' | 'gleich' | 'aktualisiert' | 'konflikt';
  phasen: number; schritte: number; entscheidungen: number; erinnerungen: number; nachrichten: number; termine: number;
  /** Abstimmungspunkte (zwischen den Phasen und im Fluss). */
  abstimmungen: number;
  /** Verweise auf Bausteine (Knoten auf Ebene 5). */
  bausteine: number;
  /** Bausteine, die weder in der Bibliothek noch in der Datei stehen (dann blockiert die Datei). */
  fehlend: string[];
}
export interface ImportVorschau {
  format: ImportFormat; datei: string;
  bausteine: ImportBausteinVorschau[]; ablaeufe: ImportAblaufVorschau[];
  /** Paket-Vorlagen der Datei (Format „Pakete“) — nicht verwechseln mit `pakete` (Paket-Schlüssel der Bausteine zum Einsortieren). */
  paketVorlagen: ImportPaketVorschau[];
  pakete: string[]; giltFuer: string[];
  /** Einträge, die NICHT übernommen werden können (Bausteine: übersprungen; Abläufe und Pakete: blockieren die Datei). */
  fehler: string[];
  hinweise: string[];
  /** Mögliche Duplikate (gleicher Titel, andere Kennung — in der Datei oder gegen die Bibliothek); beide bleiben, nichts wird zusammengelegt. */
  duplikate: string[];
  zaehler: Record<BausteinStatus | 'aktualisiert', number>;
  /** Auf einen Blick: Abläufe (Pakete + gezeichnete), Bausteine, Marken nach Vorschlag. */
  zahlen: { ablaeufe: number; bausteine: number; vorVerkauf: number; nurIntern: number; recht: number; duplikate: number };
}
export interface ImportWahl {
  /** Quell-Kennung → Marke „rechtlich prüfen“ setzen (true) oder nicht (false); fehlt: Vorschlag gilt. */
  recht?: Record<string, boolean>;
  urheber?: Record<string, boolean>;
  /** Kennung (fb-imp-…/fp-imp-…) → „Import nehmen“ bei abweichend/Konflikt. */
  nehmen?: Record<string, boolean>;
  /** Paket-Schlüssel (`pakete`) → Paket-Vorlage der Instanz zum Einsortieren. */
  pakete?: Record<string, string>;
  /** `gilt_fuer`-Wert → Paket-Vorlage (älteres Format ohne `pakete`). */
  giltFuer?: Record<string, string>;
}
export interface ImportKontext { person: string; jetzt: string; heute: string; datei: string; laufId: string }

// ── Lesen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Gelesen {
  q: string; b: Omit<Baustein, 'fassung' | 'geaendert' | 'geaendertVon' | 'herkunft'>; quelleIds: string[];
  recht?: string; urheber?: string; nurIntern: boolean; preis: boolean; pakete: string[]; giltFuer: string[]; phase?: string; unterphase?: string;
}
const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const tagWert = (v: string) => v.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const RECHT_RE = /recht|§\s?7|UWG|Provision|Tippgeber|Einwilligung|Kaltakquise/i;
const ANSPRACHE_RE = /telefon|anruf|mail|netzwerk|empfehlung|linkedin|ansprache|akquise/i;
const URHEBER_RE = /gekauft|Urheberrecht|Seminar|Playbook eines|Workbook eines/i;

/** Vorschlag „vor Einsatz rechtlich prüfen“ (2.7) — ein Satz als Grund, sonst undefined. */
export function rechtVorschlag(x: { art: string; titel: string; unterphase?: string; hinweis?: string; zweck?: string }): string | undefined {
  if (x.art === 'mail') return 'Mail an Dritte — vor Einsatz rechtlich prüfen (§ 7 UWG).';
  if (x.art === 'skript' && (x.unterphase === 'skripte' || x.unterphase === 'zielgruppe_leads' || ANSPRACHE_RE.test(x.titel))) return 'Ansprache-Skript — vor Einsatz rechtlich prüfen (§ 7 UWG).';
  if (RECHT_RE.test(`${x.hinweis ?? ''} ${x.zweck ?? ''}`)) return 'Der Hinweis nennt Recht, Provision oder Einwilligung — vor Einsatz rechtlich prüfen.';
  return undefined;
}
/** Vorschlag „vor Verkauf prüfen“ (Material Dritter) — mit `grund` (Feld `pruefgrund` der Quelle, 17.10.) als Text der Marke. */
export function urheberVorschlag(x: { herkunft?: string; pruefenVorVerkauf?: boolean; grund?: string }): string | undefined {
  if (x.pruefenVorVerkauf) return x.grund ? `${x.grund.charAt(0).toUpperCase()}${x.grund.slice(1)}` : 'Gekauftes bzw. fremdes Material — vor Verkauf prüfen.';
  return x.herkunft && URHEBER_RE.test(x.herkunft) ? 'Herkunft nennt Material Dritter — vor Verkauf prüfen.' : undefined;
}

function textListe(v: unknown, max: number, maxLaenge: number, was: string, q: string): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new Error(`„${q}“: ${was} ist keine Liste.`);
  const l = v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim());
  if (l.length > max) throw new Error(`„${q}“: ${was} hat ${l.length} Punkte (höchstens ${max}).`);
  const lang = l.find(x => x.length > maxLaenge);
  if (lang) throw new Error(`„${q}“: ein Punkt in ${was} ist länger als ${maxLaenge} Zeichen.`);
  return l;
}
function laenge(v: string | undefined, max: number, was: string, q: string): string | undefined {
  if (v && v.length > max) throw new Error(`„${q}“: ${was} ist länger als ${max.toLocaleString('de-DE')} Zeichen.`);
  return v;
}

function bausteinLesen(x: Record<string, unknown>): Gelesen {
  const q = typeof x.id === 'string' ? x.id : '';
  if (!QUELL_ID.test(q)) throw new Error(`Ein Eintrag hat keine gültige Kennung (${JSON.stringify(String(x.id ?? '')).slice(0, 40)}).`);
  const art = typeof x.art === 'string' && (BAUSTEIN_ARTEN as readonly string[]).includes(x.art) ? x.art as BausteinArt : (() => { throw new Error(`„${q}“: unbekannte Art „${String(x.art ?? '')}“.`); })();
  const titel = s(x.titel);
  if (!titel) throw new Error(`„${q}“: Titel fehlt.`);
  laenge(titel, TEXT_MAX.titel, 'der Titel', q);
  const zweck = laenge(s(x.zweck), TEXT_MAX.ziel, 'der Zweck', q);
  const hinweis = laenge(s(x.hinweis), TEXT_MAX.hinweis, 'der Hinweis', q);
  const kennzahl = laenge(s(x.kennzahl), TEXT_MAX.kurz, 'die Kennzahl', q);
  const herkunftText = laenge(s(x.herkunft), TEXT_MAX.hinweis, 'die Herkunft', q);
  const text = typeof x.text === 'string' && x.text.trim() ? x.text : undefined;
  if (text && text.length > GRENZEN.text) throw new Error(`„${q}“: der Text ist länger als ${GRENZEN.text.toLocaleString('de-DE')} Zeichen.`);
  const gliederung = textListe(x.gliederung, GRENZEN.gliederung, GLIEDERUNG_PUNKT_MAX, 'die Gliederung', q);
  const platzhalter = textListe(x.platzhalter, 60, TEXT_MAX.kurz, 'die Platzhalter', q);
  const phase = s(x.phase), unterphase = s(x.unterphase);
  const giltFuer = Array.isArray(x.gilt_fuer) ? x.gilt_fuer.filter((y): y is string => typeof y === 'string').map(tagWert).filter(Boolean) : [];
  const pakete = Array.isArray(x.pakete) ? x.pakete.filter((y): y is string => typeof y === 'string').map(tagWert).filter(Boolean) : [];
  const nurInt = x.nur_intern === true;
  const pruefgrund = laenge(s(x.pruefgrund), TEXT_MAX.kurz, 'der Prüfgrund', q);
  const zusatz = typeof x.zusatz === 'string' ? tagWert(x.zusatz) : '';
  const tags = [
    ...(phase ? [`phase:${tagWert(phase)}`] : []), ...(unterphase ? [`unterphase:${tagWert(unterphase)}`] : []),
    ...giltFuer.map(g => `fuer:${g}`), ...pakete.map(p => `paket:${p}`),
    ...(typeof x.paket_haupt === 'string' && tagWert(x.paket_haupt) ? [`paket-haupt:${tagWert(x.paket_haupt)}`] : []),
    ...(zusatz ? [`zusatz:${zusatz}`] : []),
    ...(nurInt ? [TAG_NUR_INTERN] : []), ...(x.pruefen_vor_verkauf === true ? [TAG_VOR_VERKAUF] : []),
  ];
  // „Siehe auch“ (17.10. spät): Kennungen der Quelle bzw. `fb-…`, nie der Baustein selbst — ob es sie gibt, prüft `sieheAuchAufloesen` gegen Bibliothek + Datei.
  const saRoh = x.siehe_auch ?? x.sieheAuch;
  if (saRoh !== undefined && saRoh !== null && !Array.isArray(saRoh)) throw new Error(`„${q}“: „siehe auch“ ist keine Liste.`);
  const sieheAuch = Array.from(new Set(((saRoh as unknown[] | undefined) ?? []).map(y => {
    if (typeof y !== 'string' || !(QUELL_ID.test(y) || KENNUNG.baustein.test(y))) throw new Error(`„${q}“: „${String(y).slice(0, 40)}“ in „siehe auch“ ist keine Baustein-Kennung.`);
    return bausteinKennung(y);
  }))).filter(y => y !== `fb-imp-${q}`);
  if (sieheAuch.length > GRENZEN.sieheAuch) throw new Error(`„${q}“: „siehe auch“ hat ${sieheAuch.length} Verweise (höchstens ${GRENZEN.sieheAuch}).`);
  // Quellen: nur kurze Kennungen wie „D4“ — nie Adressen.
  const quelleIds = (Array.isArray(x.quelle) ? x.quelle : typeof x.quelle === 'string' ? x.quelle.split(/[,;]\s*/) : [])
    .filter((y): y is string => typeof y === 'string').map(y => y.trim()).filter(y => /^[A-Za-z0-9._-]{1,20}$/.test(y));
  const b: Gelesen['b'] = {
    id: `fb-imp-${q}`, art, titel, gliederung, platzhalter, wer: 'intern', kundeSichtbar: false, tags: Array.from(new Set(tags)),
    ...(zweck ? { zweck } : {}), ...(hinweis ? { hinweis } : {}), ...(kennzahl ? { kennzahl } : {}), ...(herkunftText ? { herkunftText } : {}), ...(text ? { text } : {}),
    ...(sieheAuch.length ? { sieheAuch } : {}),
  };
  const recht = rechtVorschlag({ art, titel, ...(unterphase ? { unterphase } : {}), ...(hinweis ? { hinweis } : {}), ...(zweck ? { zweck } : {}) });
  const urheber = urheberVorschlag({ ...(herkunftText ? { herkunft: herkunftText } : {}), pruefenVorVerkauf: x.pruefen_vor_verkauf === true, ...(pruefgrund ? { grund: pruefgrund } : {}) });
  return {
    q, b, quelleIds, nurIntern: nurInt, preis: x.instanzwerte !== undefined || x.instanzspezifisch === true,
    pakete, giltFuer, ...(recht ? { recht } : {}), ...(urheber ? { urheber } : {}), ...(phase ? { phase } : {}), ...(unterphase ? { unterphase } : {}),
  };
}

type Form = NonNullable<ProzessVorlage['form']>;
/**
 * Zeichenform aus dem Text der Datei — die Daten nennen sie teils frei („drei Spalten mit Weichen …“, „Kreis im Uhrzeigersinn …“). Unbekannt: Fluss.
 * „kreis“ (Sales Circle) bis 11.10. als Fluss abgebildet — jetzt eine eigene Form (Entscheidung: „schön visualisieren“).
 */
export function formAus(v: unknown): Form {
  const t = typeof v === 'string' ? v.toLowerCase() : '';
  if (/kreis|circle|zyklus|uhrzeigersinn/.test(t)) return 'kreis';
  if (/trichter/.test(t)) return 'trichter';
  if (/zeitachse|zeitstrahl/.test(t)) return 'zeitachse';
  if (/^baum$/.test(t)) return 'baum';
  return 'fluss';
}
const UEBERGANG_ART: Record<string, Uebergang['art']> = { vorwaerts: 'weiter', weiter: 'weiter', rueckweg: 'rueckweg', ausstieg: 'ausstieg', schleife: 'schleife', kreislauf: 'kreislauf' };
const STUFEN_ART = ['einstieg', 'stufe', 'ausstieg', 'routine'] as const;

interface AblaufGelesen { v: Omit<ProzessVorlage, 'fassung' | 'geaendert' | 'geaendertVon' | 'herkunft'>; ergaenzungen: number }
function ablaufLesen(schluessel: string, p: Record<string, unknown>): AblaufGelesen {
  const titel = s(p.titel);
  if (!titel) throw new Error('Ein Ablauf hat keinen Titel.');
  if (titel.length > TEXT_MAX.titel) throw new Error(`Ablauf „${titel.slice(0, 40)}…“: Titel länger als ${TEXT_MAX.titel} Zeichen.`);
  const id = `fp-imp-${slug(titel, 60)}`;
  const h = fnv(id).slice(0, 8);
  const stufen = Array.isArray(p.stufen) ? p.stufen.filter(istObj) : [];
  if (!stufen.length) throw new Error(`Ablauf „${titel}“: keine Stufen.`);
  const phasen = Array.isArray(p.phasen) ? p.phasen.filter(istObj) : [];
  const knoten: ProzessKnoten[] = [{ id: `fk-i${h}-w`, titel, rang: 1 }];
  const quelleZuKnoten = new Map<string, string>();
  const nimm = (quelle: string, knotenId: string, wo: string) => {
    if (quelleZuKnoten.has(quelle)) throw new Error(`Ablauf „${titel}“: Kennung „${quelle}“ doppelt (${wo}).`);
    quelleZuKnoten.set(quelle, knotenId);
  };
  phasen.forEach((ph, i) => {
    const pid = typeof ph.id === 'string' ? ph.id : `phase-${i + 1}`;
    const name = s(ph.name) ?? `Phase ${i + 1}`;
    if (name.length > TEXT_MAX.titel) throw new Error(`Ablauf „${titel}“: Name der Phase ${i + 1} zu lang.`);
    const kid = `fk-i${h}-p${fnv(pid).slice(0, 8)}`;
    nimm(pid, kid, `Phase ${i + 1}`);
    knoten.push({ id: kid, elternId: `fk-i${h}-w`, titel: name, rang: i + 1, ...(s(ph.dauer) ? { dokumentation: `Dauer: ${s(ph.dauer)}`.slice(0, TEXT_MAX.beschreibung) } : {}) });
  });
  const phaseVonStufe = new Map<string, string>();
  for (const ph of phasen) if (Array.isArray(ph.stufen) && typeof ph.id === 'string') for (const st of ph.stufen) if (typeof st === 'string') phaseVonStufe.set(st, ph.id);
  const rangJe = new Map<string, number>();
  let ergaenzungen = 0;
  stufen.forEach((st, i) => {
    const sid = typeof st.id === 'string' && st.id ? st.id : `stufe-${i + 1}`;
    const name = s(st.name);
    if (!name) throw new Error(`Ablauf „${titel}“, Stufe ${i + 1}: Name fehlt.`);
    if (name.length > TEXT_MAX.titel) throw new Error(`Ablauf „${titel}“, Stufe ${i + 1}: Name länger als ${TEXT_MAX.titel} Zeichen.`);
    const art = st.art === undefined ? 'stufe' : (STUFEN_ART as readonly unknown[]).includes(st.art) ? st.art as typeof STUFEN_ART[number] : (() => { throw new Error(`Ablauf „${titel}“, Stufe ${i + 1} („${name}“): unbekannte Art „${String(st.art)}“.`); })();
    const phaseQ = typeof st.phase === 'string' ? st.phase : phaseVonStufe.get(sid);
    const eltern = phaseQ ? quelleZuKnoten.get(phaseQ) : `fk-i${h}-w`;
    if (!eltern) throw new Error(`Ablauf „${titel}“, Stufe ${i + 1}: Phase „${phaseQ}“ unbekannt.`);
    const rang = (rangJe.get(eltern) ?? 0) + 1;
    rangJe.set(eltern, rang);
    const kid = `fk-i${h}-s${fnv(sid).slice(0, 8)}`;
    nimm(sid, kid, `Stufe ${i + 1}`);
    const beleg = st.herkunft === 'ergaenzung' ? 'ergaenzung' as const : st.herkunft === 'quelle' ? 'quelle' as const : undefined;
    if (beleg === 'ergaenzung') ergaenzungen++;
    const t = (v: unknown, max: number) => { const x = s(v); return x ? x.slice(0, max) : undefined; };
    const zweck = s(st.zweck);
    if (zweck && zweck.length > TEXT_MAX.ziel) throw new Error(`Ablauf „${titel}“, Stufe „${name}“: Zweck zu lang.`);
    knoten.push({
      id: kid, elternId: eltern, titel: name, rang, art,
      ...(zweck ? { ziel: zweck } : {}), ...(t(st.rolle, TEXT_MAX.kurz) ? { rolle: t(st.rolle, TEXT_MAX.kurz) } : {}),
      ...(t(st.kennzahl, TEXT_MAX.kurz) ? { kennzahl: t(st.kennzahl, TEXT_MAX.kurz) } : {}), ...(t(st.ausgang, TEXT_MAX.kurz) ? { ausgang: t(st.ausgang, TEXT_MAX.kurz) } : {}),
      ...(st.optional === true ? { optional: true } : {}), ...(t(st.original, TEXT_MAX.kurz) ? { original: t(st.original, TEXT_MAX.kurz) } : {}),
      ...(t(st.entspricht_make, TEXT_MAX.kurz) ? { heute: t(st.entspricht_make, TEXT_MAX.kurz) } : {}), ...(beleg ? { beleg } : {}),
    });
  });
  const uebergaenge: Uebergang[] = [];
  const roheU = Array.isArray(p.uebergaenge) ? p.uebergaenge.filter(istObj) : [];
  if (roheU.length > GRENZEN.uebergaengeJeAblauf) throw new Error(`Ablauf „${titel}“: ${roheU.length} Übergänge (höchstens ${GRENZEN.uebergaengeJeAblauf}).`);
  roheU.forEach((u, i) => {
    const art = typeof u.art === 'string' ? UEBERGANG_ART[u.art] : 'weiter';
    if (!art) throw new Error(`Ablauf „${titel}“, Übergang ${i + 1}: unbekannte Art „${String(u.art)}“.`);
    let von = typeof u.von === 'string' ? quelleZuKnoten.get(u.von) : undefined;
    let nach = typeof u.nach === 'string' ? quelleZuKnoten.get(u.nach) : undefined;
    if (!von || !nach) throw new Error(`Ablauf „${titel}“, Übergang ${i + 1}: unbekannte Stufe (${String(u.von)} → ${String(u.nach)}).`);
    // Nur zwischen Stufen derselben Ebene (2.3): die tiefere Seite wird auf ihren Vorfahren derselben Ebene gehoben.
    const ev = ebeneVon(knoten.find(k => k.id === von)!, knoten), en = ebeneVon(knoten.find(k => k.id === nach)!, knoten);
    if (ev > en) von = [von, ...vorfahren(von, knoten)][ev - en];
    if (en > ev) nach = [nach, ...vorfahren(nach, knoten)][en - ev];
    if (von === nach) return;
    const beleg = u.herkunft === 'ergaenzung' ? 'ergaenzung' as const : u.herkunft === 'quelle' ? 'quelle' as const : undefined;
    if (beleg === 'ergaenzung') ergaenzungen++;
    const weiche = s(u.bedingung)?.slice(0, TEXT_MAX.kurz);
    if (uebergaenge.some(x => x.von === von && x.nach === nach)) return;
    uebergaenge.push({ von, nach, art, ...(weiche ? { weiche } : {}), ...(beleg ? { beleg } : {}) });
  });
  if (knoten.length > GRENZEN.knotenJeVorlage) throw new Error(`Ablauf „${titel}“: zu viele Stufen (höchstens ${GRENZEN.knotenJeVorlage}).`);
  const form = formAus(p.form);
  const zh = (Array.isArray(p.zeichenhinweis) ? p.zeichenhinweis : []).filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim().slice(0, TEXT_MAX.kurz)).slice(0, 18);
  const formText = typeof p.form === 'string' ? p.form.trim() : '';
  if (formText && formText.toLowerCase() !== form) zh.push(`Zeichenform laut Quelle: ${formText}`.slice(0, TEXT_MAX.kurz));
  const quelle = typeof p.quelle === 'string' ? p.quelle.trim() : Array.isArray(p.quelle) ? p.quelle.filter(x => typeof x === 'string').join(', ') : '';
  const vorbehalt = s(p.vorbehalt);
  // Der Datei-Schlüssel wird bewusst nicht verwendet (Prozessnamen früherer Unternehmen) — nur Titel und Inhalt.
  void schluessel;
  return {
    v: {
      id, art: 'ablauf', titel, form, knoten, uebergaenge, freigaben: [], rollen: [],
      ...(quelle ? { quelleHinweis: `Quelle: ${quelle}`.slice(0, TEXT_MAX.kurz) } : {}), ...(vorbehalt ? { vorbehalt: vorbehalt.slice(0, TEXT_MAX.hinweis) } : {}),
      ...(zh.length ? { zeichenhinweise: zh } : {}),
    },
    ergaenzungen,
  };
}

// ── Pakete (17.10.): Paket-Vorlagen im Format des Prozess-Editors ───────────────────────────────────────────────────────────────────

const ZUST = ['intern', 'kunde', 'beide'] as const;
/** Texte an einem Schritt (Feld → Textgrenze) — dieselben Grenzen wie das Knoten-Formular (`KNOTEN_TEXTE` im Vorlagen-Schreibweg). */
const SCHRITT_TEXTE = [['ziel', 'ziel'], ['ergebnis', 'ergebnis'], ['kennzahl', 'kurz'], ['rolle', 'kurz']] as const;
/** Höchstens so viele Abstimmungspunkte je Paket (wie im Editor). */
const ABSTIMMUNGEN_MAX = 30;

interface PaketGelesen {
  /** Die Vorlage OHNE Baustein-Knoten — die entstehen beim Binden (`paketBinden`), ihr Titel kommt aus Datei bzw. Bibliothek. */
  v: Omit<ProzessVorlage, 'fassung' | 'geaendert' | 'geaendertVon' | 'herkunft'>;
  /** Je Schritt die Baustein-Verweise der Datei (Kennung der Quelle oder `fb-…`), in Reihenfolge. */
  verweise: { knotenId: string; schritt: string; refs: string[] }[];
}

/** Ganze Tage in einer Spanne (oder nichts) — wie die Frist im Editor (`schrittFelder`). */
function ganzeTage(v: unknown, max: number, name: string): number | undefined {
  const x = optZahl(v, 0, max, name);
  if (x === null || x === undefined) return undefined;
  if (!Number.isInteger(x)) nein(`${name}: ganze Tage von 0 bis ${max}.`);
  return x;
}
/** Objekt ohne `undefined`-Felder (optionale Felder fehlen ganz — wie im Säuberer). */
const ohneLeer = <T>(o: Record<string, unknown>): T => Object.fromEntries(Object.entries(o).filter(([, w]) => w !== undefined && w !== null)) as T;

function paketLesen(p: Record<string, unknown>, nr: number): PaketGelesen {
  const titel = pflichtText(p.titel, 'titel', `Paket ${nr}: Titel`);
  const wo = `Paket „${titel}“`;
  const id = `fp-imp-pk-${slug(typeof p.schluessel === 'string' && p.schluessel.trim() ? p.schluessel : titel, 50)}`;
  const h = fnv(id).slice(0, 8);
  const wurzel = `fk-i${h}-w`;
  const knoten: ProzessKnoten[] = [{ id: wurzel, titel, rang: 1 }];
  const quellen = new Set<string>();
  const quelle = (v: unknown, was: string): string => {
    if (typeof v !== 'string' || !QUELL_ID.test(v)) return nein(`${wo}: ${was} braucht eine Kennung (a–z, 0–9, Bindestrich).`);
    if (quellen.has(v)) return nein(`${wo}: die Kennung „${v}“ steht doppelt.`);
    quellen.add(v);
    return v;
  };
  // Abstimmungspunkte und Rollen
  if (p.abstimmungen !== undefined && !Array.isArray(p.abstimmungen)) nein(`${wo}: „abstimmungen“ ist keine Liste.`);
  const freigaben: Freigabepunkt[] = ((p.abstimmungen as unknown[] | undefined) ?? []).map((a, i) => {
    if (!istObj(a) || typeof a.id !== 'string' || !ID_FREI.test(a.id)) return nein(`${wo}: Bestätigung ${i + 1} braucht eine Kennung (z. B. F0 oder A1).`);
    return { id: a.id, titel: pflichtText(a.titel, 'titel', `${wo}, Bestätigung ${a.id}: Titel`), wer: optWahl(a.wer, ZUST, `${wo}, Bestätigung ${a.id}: wer`) ?? 'beide' };
  });
  if (new Set(freigaben.map(f => f.id)).size !== freigaben.length) nein(`${wo}: eine Bestätigung steht doppelt.`);
  if (freigaben.length > ABSTIMMUNGEN_MAX) nein(`${wo}: höchstens ${ABSTIMMUNGEN_MAX} Bestätigungen (jetzt ${freigaben.length}).`, 413);
  if (p.rollen !== undefined && !Array.isArray(p.rollen)) nein(`${wo}: „rollen“ ist keine Liste.`);
  const rollen: Rolle[] = ((p.rollen as unknown[] | undefined) ?? []).map((r, i) => {
    if (!istObj(r) || typeof r.id !== 'string' || !ID_FREI.test(r.id)) return nein(`${wo}: Rolle ${i + 1} braucht eine Kennung.`);
    const aufgabe = optText(r.aufgabe, 'kurz', `${wo}, Rolle ${r.id}: Aufgabe`);
    return { id: r.id, titel: pflichtText(r.titel, 'titel', `${wo}, Rolle ${r.id}: Titel`), ...(aufgabe ? { aufgabe } : {}) };
  });
  if (new Set(rollen.map(r => r.id)).size !== rollen.length) nein(`${wo}: eine Rolle steht doppelt.`);
  const abstimmung = (v: unknown, was: string): string | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v !== 'string' || !freigaben.some(f => f.id === v)) return nein(`${was}: die Bestätigung „${String(v)}“ kennt das Paket nicht (Liste „abstimmungen“).`);
    return v;
  };

  const verweise: PaketGelesen['verweise'] = [];
  const schrittKnoten = new Map<string, string>();
  const zweigeRoh: { knotenId: string; wo: string; z: unknown }[] = [];
  const schritt = (x: Record<string, unknown>, eltern: string, rang: number, mitBausteinen: boolean) => {
    if (x.gruppe !== undefined) nein(`${wo}: Gruppen stehen nur direkt in einer Phase, nicht in einer Gruppe.`);
    const sq = quelle(x.id, 'Ein Schritt');
    const w = `${wo}, Schritt „${sq}“`;
    const freigabe = abstimmung(x.abstimmung, w);
    const form = (optWahl(x.form, KNOTEN_FORMEN, `${w}: Form`) ?? (freigabe ? 'abstimmung' : 'schritt')) as KnotenForm;
    const texte: Record<string, string> = {};
    for (const [f, feld] of SCHRITT_TEXTE) { const t = optText(x[f], feld, `${w}: ${f}`); if (t) texte[f] = t; }
    if (x.bausteine !== undefined && !Array.isArray(x.bausteine)) nein(`${w}: „bausteine“ ist keine Liste.`);
    const refs = ((x.bausteine as unknown[] | undefined) ?? []).map(r => (typeof r === 'string' && (QUELL_ID.test(r) || KENNUNG.baustein.test(r)) ? r : nein(`${w}: „${String(r)}“ ist keine Baustein-Kennung.`)));
    if (new Set(refs).size !== refs.length) nein(`${w}: ein Baustein steht doppelt.`);
    // Bausteine hängen auf Ebene 5 unter einem Einzelschritt (Ebene 4) — der Strang steht dann im Sammel-Teilprozess (`mitBausteinen`).
    if (refs.length && !mitBausteinen) nein(`${w}: Bausteine nur an Schritten im Strang oder in einer Gruppe.`);
    const kid = `fk-i${h}-s${fnv(sq).slice(0, 8)}`;
    // Versuche (Runden auf dem Nein-Pfad), Lage auf der Fläche und Beschriftung der Pfeile — geprüft wie im Editor (17.10. spät; vorher fielen sie weg).
    const versuche = optZahl(x.versuche, 1, 20, `${w}: Versuche`);
    if (versuche !== undefined && versuche !== null && !Number.isInteger(versuche)) nein(`${w}: Versuche — ganze Zahl von 1 bis 20.`);
    knoten.push(ohneLeer<ProzessKnoten>({
      id: kid, elternId: eltern, titel: pflichtText(x.titel, 'titel', `${w}: Titel`), rang, form,
      frist: ganzeTage(x.frist, FRIST_MAX, `${w}: Frist (Tage)`), dauerTage: ganzeTage(x.dauerTage, 3650, `${w}: Dauer (Tage)`),
      zustaendig: optWahl(x.zustaendig, ZUST, `${w}: Verantwortung`), kundeSichtbar: optBool(x.kundeSichtbar, `${w}: für den Kunden sichtbar`), freigabe, ...texte,
      versuche, pos: x.pos === undefined ? undefined : lageAus(x.pos, false), pfeilText: pfeilTextAus(x.pfeilText ?? x.pfeil_text, `${w}: Beschriftung der Pfeile`),
    }));
    schrittKnoten.set(sq, kid);
    if (x.zweige !== undefined) zweigeRoh.push({ knotenId: kid, wo: w, z: x.zweige });
    if (refs.length) verweise.push({ knotenId: kid, schritt: sq, refs });
    // `verbindungen` (freie Pfeile) und jedes andere unbekannte Feld: ignoriert.
  };

  if (!Array.isArray(p.phasen) || !p.phasen.length) nein(`${wo}: keine Phasen („phasen“: […]).`);
  (p.phasen as unknown[]).forEach((ph, i) => {
    if (!istObj(ph)) nein(`${wo}: Phase ${i + 1} ist kein Objekt.`);
    const P = ph as Record<string, unknown>;
    const pq = quelle(P.id, `Phase ${i + 1}`);
    const w = `${wo}, Phase „${pq}“`;
    const ptitel = pflichtText(P.titel, 'titel', `${w}: Titel`);
    if (P.kreislauf !== undefined && (!Array.isArray(P.kreislauf) || P.kreislauf.some(k => !(KREISLAUF_IDS as readonly unknown[]).includes(k)))) nein(`${w}: Kreislauf — unbekannte Stufe.`);
    const kreislauf = Array.isArray(P.kreislauf) && P.kreislauf.length ? (Array.from(new Set(P.kreislauf as string[])) as ProzessKnoten['kreislauf']) : undefined;
    const pid = `fk-i${h}-p${fnv(pq).slice(0, 8)}`;
    knoten.push(ohneLeer<ProzessKnoten>({
      id: pid, elternId: wurzel, titel: ptitel, rang: i + 1, kundeSichtbar: optBool(P.kundeSichtbar, `${w}: für den Kunden sichtbar`) ?? true,
      freigabe: abstimmung(P.abstimmung, w), dauerTage: ganzeTage(P.dauerTage, 3650, `${w}: Dauer (Tage)`), kreislauf,
      ziel: optText(P.ziel, 'ziel', `${w}: Ziel`), warum: optText(P.warum, 'ziel', `${w}: Warum`), zustaendig: optWahl(P.zustaendig, ZUST, `${w}: Verantwortung`),
      pos: P.pos === undefined ? undefined : lageAus(P.pos, true),
    }));
    if (P.fluss !== undefined && !Array.isArray(P.fluss)) nein(`${w}: „fluss“ ist keine Liste.`);
    let rang = 0;
    let strang: Record<string, unknown>[] = [];
    // Folgende Schritte ohne Gruppe = EIN Strang; mit Bausteinen im Sammel-Teilprozess (heißt wie die Phase), sonst direkt in der Phase (Ebene 3).
    const strangAbschliessen = () => {
      if (!strang.length) return;
      if (strang.some(x => Array.isArray(x.bausteine) && x.bausteine.length)) {
        const tid = `fk-i${h}-t${fnv(`${pq}:${rang}`).slice(0, 8)}`;
        knoten.push({ id: tid, elternId: pid, titel: ptitel, rang: ++rang });
        strang.forEach((x, j) => schritt(x, tid, j + 1, true));
      } else strang.forEach(x => schritt(x, pid, ++rang, false));
      strang = [];
    };
    for (const x of (P.fluss as unknown[] | undefined) ?? []) {
      if (!istObj(x)) nein(`${w}: ein Eintrag im Fluss ist kein Objekt.`);
      const X = x as Record<string, unknown>;
      if (X.gruppe === undefined) { strang.push(X); continue; }
      strangAbschliessen();
      const gq = quelle(X.id, `Eine Gruppe in Phase „${ptitel}“`);
      const gtitel = pflichtText(X.gruppe, 'titel', `${w}, Gruppe „${gq}“: Titel`);
      const gs = Array.isArray(X.fluss) ? X.fluss : [];
      if (!gs.length || gs.some(s => !istObj(s))) nein(`${w}: die Gruppe „${gtitel}“ braucht Schritte („fluss“: […]).`);
      const gid = `fk-i${h}-g${fnv(gq).slice(0, 8)}`;
      knoten.push(ohneLeer<ProzessKnoten>({ id: gid, elternId: pid, titel: gtitel, rang: ++rang, ziel: optText(X.ziel, 'ziel', `${w}, Gruppe „${gq}“: Ziel`) }));
      (gs as Record<string, unknown>[]).forEach((s, j) => schritt(s, gid, j + 1, true));
    }
    strangAbschliessen();
  });

  // Zweige: Kennungen der Quelle → Knoten; geprüft wie im Editor (nur an Entscheidungen/Erinnerungen, dieselbe Phase, Schleife nur über eine Erinnerung).
  for (const { knotenId, wo: w, z } of zweigeRoh) {
    if (!istObj(z)) nein(`${w}: „zweige“ ist kein Objekt ({ ja, nein }).`);
    const zw: Zweige = {};
    for (const art of ['ja', 'nein'] as const) {
      const ziel = (z as Record<string, unknown>)[art];
      if (ziel === undefined || ziel === null || ziel === '') continue;
      const k = typeof ziel === 'string' ? schrittKnoten.get(ziel) : undefined;
      if (!k) nein(`${w}: der ${art === 'ja' ? 'Ja' : 'Nein'}-Zweig zeigt auf „${String(ziel)}“ — diesen Schritt gibt es im Paket nicht.`);
      zw[art] = k;
    }
    if (zw.ja || zw.nein) { const i = knoten.findIndex(x => x.id === knotenId); knoten[i] = { ...knoten[i], zweige: zw }; }
  }
  zweigePruefen(knoten);
  const beschreibung = optText(p.beschreibung, 'beschreibung', `${wo}: Beschreibung`);
  const vorbehalt = optText(p.vorbehalt, 'hinweis', `${wo}: Vorbehalt`);
  const q = optText(p.quelle, 'kurz', `${wo}: Quelle`);
  const zusatz = optBool(p.zusatz, `${wo}: Zusatzmodul`);
  // Die Rahmen auf der Fläche bleiben in der Reihenfolge der Phasen — dieselbe Regel wie im Editor (./flaeche-lage.ts).
  const geordnet = rahmenOrdnen(knoten, x => umrissVon(x.form ?? 'schritt'));
  return {
    v: {
      id, art: 'paket', titel, knoten: geordnet, uebergaenge: [], freigaben, rollen, phasenVonHand: true, ...(zusatz ? { zusatz: true as const } : {}),
      ...(beschreibung ? { beschreibung } : {}), ...(vorbehalt ? { vorbehalt } : {}), ...(q ? { quelleHinweis: `Quelle: ${q}`.slice(0, TEXT_MAX.kurz) } : {}),
    },
    verweise,
  };
}

/** Baustein-Verweis der Datei → Kennung in der Bibliothek (`fb-…` bleibt, eine Kennung der Quelle wird `fb-imp-<id>` — wie beim Bausteine-Import). */
const bausteinKennung = (ref: string): string => (ref.startsWith('fb-') ? ref : `fb-imp-${ref}`);

/** Die Baustein-Knoten (Ebene 5) anhängen; ihr Titel ist der des Bausteins. Fehlende Bausteine werden genannt (dann blockiert die Datei). */
function paketBinden(p: PaketGelesen, titelVon: ReadonlyMap<string, string>): { v: PaketGelesen['v']; fehlend: string[] } {
  const h = fnv(p.v.id).slice(0, 8);
  const fehlend: string[] = [];
  const dazu: ProzessKnoten[] = [];
  for (const { knotenId, schritt, refs } of p.verweise) {
    refs.forEach((ref, i) => {
      const bid = bausteinKennung(ref);
      const t = titelVon.get(bid);
      if (t === undefined) { if (!fehlend.includes(ref)) fehlend.push(ref); return; }
      dazu.push({ id: `fk-i${h}-b${fnv(`${schritt}>${bid}`).slice(0, 8)}`, elternId: knotenId, titel: t.slice(0, TEXT_MAX.titel), rang: i + 1, bausteinId: bid });
    });
  }
  return { v: { ...p.v, knoten: [...p.v.knoten, ...dazu] }, fehlend };
}

/** Titel der Bausteine, die nach dem Import da wären: Datei vor Bibliothek (so bleibt der Titel der Knoten wiederholbar gleich). */
function bausteinTitel(d: Pick<VorlagenDatei, 'bausteine'>, g: Pick<ImportGelesen, 'bausteine'>): Map<string, string> {
  return new Map([...d.bausteine.map(b => [b.id, b.titel] as const), ...g.bausteine.map(x => [x.b.id, x.b.titel] as const)]);
}

/** Struktur einer Paket-Vorlage zum Vergleichen (gleich/aktualisiert) — beide Seiten durch DENSELBEN Säuberer, Schlüssel sortiert. */
const paketStruktur = (v: Pick<ProzessVorlage, 'id' | 'art' | 'titel' | 'knoten' | 'uebergaenge' | 'freigaben' | 'rollen'> & Partial<ProzessVorlage>) => {
  const x = vorlageAus(v as unknown as Record<string, unknown>) ?? (v as ProzessVorlage);
  return stabil({ t: x.titel, b: x.beschreibung ?? null, k: x.knoten, f: x.freigaben, r: x.rollen, v: x.vorbehalt ?? null, q: x.quelleHinweis ?? null, h: x.phasenVonHand ?? null, z: x.zusatz ?? null });
};
function paketStatus(alt: ProzessVorlage | undefined, v: PaketGelesen['v']): ImportPaketVorschau['status'] {
  if (!alt) return 'neu';
  if (paketStruktur(alt) === paketStruktur(v as ProzessVorlage)) return 'gleich';
  return vonHandGeaendert(alt) ? 'konflikt' : 'aktualisiert';
}
/** Zahlen einer Paket-Vorlage für die Vorschau (Formen gesetzt oder abgeleitet: Abstimmungspunkt → Abstimmung). */
function paketZahlen(v: Pick<ProzessVorlage, 'knoten'>): Omit<ImportPaketVorschau, 'id' | 'titel' | 'status' | 'fehlend'> {
  const kn = v.knoten;
  const wurzel = kn.find(k => !k.elternId);
  const phasen = kn.filter(k => k.elternId === wurzel?.id);
  const ist = (k: ProzessKnoten) => !k.bausteinId && k.elternId !== wurzel?.id && k.id !== wurzel?.id && !kinderVon(k.id, kn).some(c => !c.bausteinId);
  const schritte = kn.filter(ist);
  const form = (f: KnotenForm) => schritte.filter(k => k.form === f).length;
  return {
    phasen: phasen.length, schritte: schritte.length, entscheidungen: form('entscheidung'), erinnerungen: form('erinnerung'), nachrichten: form('nachricht'), termine: form('termin'),
    abstimmungen: phasen.filter(p => p.freigabe).length + schritte.filter(k => k.freigabe).length, bausteine: kn.filter(k => k.bausteinId).length,
  };
}

export interface ImportGelesen { format: ImportFormat; bausteine: Gelesen[]; ablaeufe: AblaufGelesen[]; pakete: PaketGelesen[]; fehler: string[]; blockiert: boolean }

/** Die Bausteine einer Liste (`vorlagen`) lesen — Fehler je Eintrag überspringen den Eintrag; über der Grenze blockiert die ganze Datei. */
function bausteineLesen(roh: unknown[]): { bausteine: Gelesen[]; fehler: string[]; zuViele: boolean } {
  const fehler: string[] = [];
  const liste = roh.filter(istObj);
  if (liste.length > IMPORT_GRENZEN.bausteine) return { bausteine: [], fehler: [`Die Datei hat ${liste.length} Einträge — höchstens ${IMPORT_GRENZEN.bausteine} je Datei. Bitte teilen. Nichts übernommen.`], zuViele: true };
  const bausteine: Gelesen[] = [];
  const ids = new Set<string>();
  for (const x of liste) {
    try {
      const g = bausteinLesen(x);
      if (ids.has(g.b.id)) { fehler.push(`„${g.q}“ steht doppelt in der Datei — der zweite Eintrag wird übersprungen.`); continue; }
      ids.add(g.b.id); bausteine.push(g);
    } catch (e) { fehler.push(`${e instanceof Error ? e.message : 'Eintrag unlesbar'} — übersprungen.`); }
  }
  return { bausteine, fehler, zuViele: false };
}

/** Eine Datei lesen (Format erkennen). Wirft nie — Fehler stehen in `fehler`; `blockiert` heißt: so nicht übernehmbar (Abläufe, Pakete, Grenzen). */
export function importLesen(roh0: unknown): ImportGelesen {
  // Ein Array auf oberster Ebene ist eine Bausteine-Liste (z. B. ein Katalog ohne Hülle, 17.10.).
  const roh = Array.isArray(roh0) ? { vorlagen: roh0 } : roh0;
  if (istObj(roh) && Array.isArray(roh.pakete)) {
    const b = Array.isArray(roh.vorlagen) ? bausteineLesen(roh.vorlagen) : { bausteine: [], fehler: [], zuViele: false };
    if (b.zuViele) return { format: 'pakete', bausteine: [], ablaeufe: [], pakete: [], fehler: b.fehler, blockiert: true };
    const liste = roh.pakete;
    if (liste.length > IMPORT_GRENZEN.ablaeufe) return { format: 'pakete', bausteine: [], ablaeufe: [], pakete: [], fehler: [`${liste.length} Pakete — höchstens ${IMPORT_GRENZEN.ablaeufe} je Datei. Nichts übernommen.`], blockiert: true };
    const fehler: string[] = [...b.fehler];
    const pakete: PaketGelesen[] = [];
    liste.forEach((p, i) => {
      try {
        if (!istObj(p)) nein(`Paket ${i + 1} ist kein Objekt.`);
        const x = paketLesen(p as Record<string, unknown>, i + 1);
        if (pakete.some(y => y.v.id === x.v.id)) { fehler.push(`Zwei Pakete haben dieselbe Kennung („${x.v.titel}“) — bitte einen Schlüssel ändern.`); return; }
        pakete.push(x);
      } catch (e) { fehler.push(e instanceof Error ? e.message : `Paket ${i + 1} unlesbar.`); }
    });
    return { format: 'pakete', bausteine: b.bausteine, ablaeufe: [], pakete, fehler, blockiert: fehler.length > b.fehler.length || !pakete.length };
  }
  if (istObj(roh) && Array.isArray(roh.vorlagen)) {
    const b = bausteineLesen(roh.vorlagen);
    return { format: 'bausteine', bausteine: b.bausteine, ablaeufe: [], pakete: [], fehler: b.fehler, blockiert: b.zuViele || !b.bausteine.length };
  }
  if (istObj(roh)) {
    const eintraege = Object.entries(roh).filter(([, v]) => istObj(v) && Array.isArray((v as Record<string, unknown>).stufen));
    if (!eintraege.length) return { format: 'ablaeufe', bausteine: [], ablaeufe: [], pakete: [], fehler: ['Unbekanntes Format: erwartet wird eine Bausteine-Datei („vorlagen“: […]), eine Ablauf-Datei (je Ablauf „stufen“ und „uebergaenge“) oder eine Pakete-Datei („pakete“: […]).'], blockiert: true };
    if (eintraege.length > IMPORT_GRENZEN.ablaeufe) return { format: 'ablaeufe', bausteine: [], ablaeufe: [], pakete: [], fehler: [`${eintraege.length} Abläufe — höchstens ${IMPORT_GRENZEN.ablaeufe} je Datei. Nichts übernommen.`], blockiert: true };
    const fehler: string[] = [];
    const ablaeufe: AblaufGelesen[] = [];
    for (const [k, v] of eintraege) {
      try {
        const a = ablaufLesen(k, v as Record<string, unknown>);
        if (ablaeufe.some(x => x.v.id === a.v.id)) { fehler.push(`Zwei Abläufe heißen „${a.v.titel}“ — bitte einen umbenennen.`); continue; }
        ablaeufe.push(a);
      } catch (e) { fehler.push(e instanceof Error ? e.message : 'Ablauf unlesbar.'); }
    }
    return { format: 'ablaeufe', bausteine: [], ablaeufe, pakete: [], fehler, blockiert: fehler.length > 0 || !ablaeufe.length };
  }
  return { format: 'bausteine', bausteine: [], ablaeufe: [], pakete: [], fehler: ['Die Datei ist kein JSON-Objekt.'], blockiert: true };
}

// ── Vergleich mit dem Bestand ───────────────────────────────────────────────────────────────────────────────────────────────────────

const IMPORT_FELDER = ['art', 'titel', 'zweck', 'hinweis', 'kennzahl', 'herkunftText', 'text', 'gliederung', 'platzhalter', 'sieheAuch'] as const;

/**
 * „Siehe auch“ gegen Bibliothek + Datei auflösen (17.10. spät): Verweise auf Bausteine, die es danach nicht gibt, fallen weg — die Vorschau nennt sie. Ändert die
 * gelesenen Bausteine in `g` (rein bis auf dieses Objekt, das nur innerhalb von Vorschau bzw. Übernehmen lebt).
 */
function sieheAuchAufloesen(g: ImportGelesen, d: Pick<VorlagenDatei, 'bausteine'>): number {
  const da = new Set([...d.bausteine.map(b => b.id), ...g.bausteine.map(x => x.b.id)]);
  let weg = 0;
  for (const x of g.bausteine) {
    if (!x.b.sieheAuch) continue;
    const l = x.b.sieheAuch.filter(y => da.has(y));
    weg += x.b.sieheAuch.length - l.length;
    if (l.length) x.b = { ...x.b, sieheAuch: l };
    else { const { sieheAuch: _s, ...rest } = x.b; x.b = rest; }
  }
  return weg;
}
const leer = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function bausteinVergleich(alt: Baustein | undefined, g: Gelesen): { status: BausteinStatus; ergaenzen: string[]; abweichend: string[] } {
  if (!alt) return { status: 'neu', ergaenzen: [], abweichend: [] };
  const ergaenzen: string[] = [], abweichend: string[] = [];
  for (const f of IMPORT_FELDER) {
    const a = alt[f], n = g.b[f];
    if (leer(n)) continue;
    if (leer(a)) ergaenzen.push(f);
    else if (!gleich(a, n)) abweichend.push(f);
  }
  if (g.b.tags.some(t => !alt.tags.includes(t))) ergaenzen.push('tags');
  if (g.recht && !alt.rechtPruefen) ergaenzen.push('rechtPruefen');
  if (g.urheber && !alt.urheberPruefen) ergaenzen.push('urheberPruefen');
  const status: BausteinStatus = abweichend.length ? (alt.vonHand ? 'konflikt' : 'abweichend') : ergaenzen.length ? 'ergaenzt' : 'gleich';
  return { status, ergaenzen, abweichend };
}
/** JSON mit sortierten Schlüsseln (rein) — die Reihenfolge der Felder spielt für „gleich“ keine Rolle. */
function stabil(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stabil).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as Record<string, unknown>).filter(k => (v as Record<string, unknown>)[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stabil((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
/**
 * Struktur eines Ablaufs zum Vergleichen: beide Seiten laufen durch DENSELBEN Säuberer (`vorlageAus`) und werden mit sortierten Schlüsseln verglichen
 * (Prüf-Fund 11.10.: der Re-Import derselben Datei galt wegen anderer Feld-Reihenfolge als „aktualisiert“ — nicht idempotent).
 */
const ablaufStruktur = (v: Pick<ProzessVorlage, 'id' | 'art' | 'titel' | 'form' | 'knoten' | 'uebergaenge' | 'vorbehalt' | 'quelleHinweis' | 'zeichenhinweise'>) => {
  const x = vorlageAus(v as unknown as Record<string, unknown>) ?? (v as ProzessVorlage);
  return stabil({ t: x.titel, f: x.form ?? null, k: x.knoten, u: x.uebergaenge, v: x.vorbehalt ?? null, q: x.quelleHinweis ?? null, z: x.zeichenhinweise ?? [] });
};
/** Wurde eine importierte Vorlage seither von Hand geändert? (Der Import setzt `geaendert` = Zeit des Imports.) */
const vonHandGeaendert = (p: ProzessVorlage) => !(p.herkunft?.art === 'import' && p.herkunft.am === p.geaendert);

function ablaufStatus(alt: ProzessVorlage | undefined, a: AblaufGelesen): ImportAblaufVorschau['status'] {
  if (!alt) return 'neu';
  if (ablaufStruktur(alt) === ablaufStruktur(a.v as ProzessVorlage)) return 'gleich';
  return vonHandGeaendert(alt) ? 'konflikt' : 'aktualisiert';
}

/** Die Vorschau — schreibt nichts. */
export function importVorschau(roh: unknown, d: VorlagenDatei, datei: string): ImportVorschau {
  const g = importLesen(roh);
  const sieheAuchWeg = sieheAuchAufloesen(g, d);
  const zaehler: ImportVorschau['zaehler'] = { neu: 0, gleich: 0, ergaenzt: 0, abweichend: 0, konflikt: 0, aktualisiert: 0 };
  const bausteine = g.bausteine.map(x => {
    const v = bausteinVergleich(d.bausteine.find(b => b.id === x.b.id), x);
    zaehler[v.status]++;
    return {
      id: x.b.id, quelle: x.q, titel: x.b.titel, art: x.b.art, status: v.status, felder: [...v.ergaenzen, ...v.abweichend],
      ...(x.recht ? { recht: x.recht } : {}), ...(x.urheber ? { urheber: x.urheber } : {}), nurIntern: x.nurIntern, preis: x.preis,
      pakete: x.pakete, giltFuer: x.giltFuer, ...(x.phase ? { phase: x.phase } : {}), ...(x.unterphase ? { unterphase: x.unterphase } : {}),
    } satisfies ImportBausteinVorschau;
  });
  const ablaeufe = g.ablaeufe.map(a => {
    const status = ablaufStatus(d.prozesse.find(p => p.id === a.v.id), a);
    zaehler[status === 'aktualisiert' ? 'aktualisiert' : status]++;
    return { id: a.v.id, titel: a.v.titel, form: a.v.form ?? 'fluss', stufen: a.v.knoten.length - 1, uebergaenge: a.v.uebergaenge.length, ergaenzungen: a.ergaenzungen, status } satisfies ImportAblaufVorschau;
  });
  // Pakete (17.10.): binden gegen Bibliothek + Datei; fehlende Bausteine und Regelverstöße (Ebenen, Bausteine) stehen als Fehler da.
  const titelVon = bausteinTitel(d, g);
  const fehler = [...g.fehler];
  const paketVorlagen = g.pakete.map(p => {
    const { v, fehlend } = paketBinden(p, titelVon);
    if (fehlend.length) fehler.push(`Paket „${v.titel}“: ${anzahl(fehlend.length, 'Baustein fehlt', 'Bausteine fehlen')} in der Bibliothek (${fehlend.slice(0, 6).join(', ')}${fehlend.length > 6 ? ' …' : ''}) — bitte zuerst die Bausteine importieren. Nichts übernommen.`);
    else {
      const r = ausfuehren(() => { vorlageStrukturPruefen(v as ProzessVorlage, { bausteine: [...d.bausteine, ...g.bausteine.map(x => x.b as Baustein)], prozesse: d.prozesse }); return { datei: null, geaendert: [] }; });
      if (!r.ok) fehler.push(`Paket „${v.titel}“: ${r.fehler}`);
    }
    const alt = d.prozesse.find(x => x.id === v.id);
    if (alt && alt.art !== 'paket') fehler.push(`Paket „${v.titel}“: eine Vorlage mit dieser Kennung ist kein Paket — bitte den Schlüssel ändern.`);
    const status = paketStatus(alt, v);
    zaehler[status === 'aktualisiert' ? 'aktualisiert' : status]++;
    return { id: v.id, titel: v.titel, status, ...paketZahlen(v), fehlend } satisfies ImportPaketVorschau;
  });
  const hinweise: string[] = [];
  const preise = bausteine.filter(b => b.preis).length;
  if (preise) hinweise.push(`${anzahl(preise, 'Eintrag trägt', 'Einträge tragen')} Instanzwerte (z. B. Preise) — die werden nicht übernommen und gehören in den Produktkatalog.`);
  const intern = bausteine.filter(b => b.nurIntern).length;
  if (intern) hinweise.push(`${anzahl(intern, 'Eintrag ist', 'Einträge sind')} „nur intern“ — sie erscheinen nie beim Kunden, im Report oder in einem Export.`);
  if (istObj(roh) && roh.quellenverzeichnis !== undefined) hinweise.push('Das Quellenverzeichnis der Datei (mit Ablage-Adressen) wird nicht übernommen — nur die Kennungen der Quellen.');
  if (sieheAuchWeg) hinweise.push(`${anzahl(sieheAuchWeg, 'Verweis „siehe auch“ zeigt', 'Verweise „siehe auch“ zeigen')} auf Bausteine, die weder in der Bibliothek noch in der Datei stehen — sie fallen weg.`);
  const zusatzPakete = g.pakete.filter(p => p.v.zusatz).length;
  if (zusatzPakete) hinweise.push(`${anzahl(zusatzPakete, 'Ablauf ist ein Zusatzmodul', 'Abläufe sind Zusatzmodule')}: an einem Mandat mit laufendem Fall hängt es dort an (kein zweites Onboarding), sonst startet es ohne Onboarding.`);
  if (paketVorlagen.length) hinweise.push('Abläufe gelten für neue Fälle; laufende Fälle zeigen „Ablauf geändert — übernehmen?“ erst, wenn sie diesen Ablauf nutzen.');
  // Mögliche Duplikate: gleicher Titel, andere Kennung — in der Datei und gegen die Bibliothek. Es wird nichts zusammengelegt; beide bleiben.
  const duplikate: string[] = [];
  const gesehen = new Map<string, string>();
  for (const x of g.bausteine) {
    const t = titelForm(x.b.titel);
    const doppelt = gesehen.get(t);
    if (doppelt && doppelt !== x.b.id) duplikate.push(`Zwei Bausteine der Datei heißen „${x.b.titel}“.`);
    gesehen.set(t, x.b.id);
    const da = d.bausteine.find(b => b.id !== x.b.id && titelForm(b.titel) === t);
    if (da) duplikate.push(`„${x.b.titel}“ gibt es schon in der Bibliothek (andere Kennung) — beide bleiben.`);
  }
  for (const p of paketVorlagen) {
    const da = d.prozesse.find(x => x.id !== p.id && titelForm(x.titel) === titelForm(p.titel));
    if (da) duplikate.push(`Eine Vorlage „${da.titel}“ gibt es schon — „${p.titel}“ aus der Datei entsteht daneben.`);
  }
  return {
    format: g.format, datei, bausteine, ablaeufe, paketVorlagen,
    pakete: Array.from(new Set(g.bausteine.flatMap(x => x.pakete))).sort(), giltFuer: Array.from(new Set(g.bausteine.flatMap(x => x.giltFuer))).sort(),
    fehler, hinweise, duplikate, zaehler,
    zahlen: {
      ablaeufe: ablaeufe.length + paketVorlagen.length, bausteine: bausteine.length, vorVerkauf: bausteine.filter(b => b.urheber).length,
      nurIntern: intern, recht: bausteine.filter(b => b.recht).length, duplikate: duplikate.length,
    },
  };
}

// ── Übernehmen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const UNTER_TITEL: Record<string, string> = { prozess: 'Prozess', crm: 'CRM', skripte: 'Skripte', einwaende: 'Einwände', kennzahlen: 'Kennzahlen', zielgruppe_leads: 'Zielgruppe & Leads' };
const schoen = (k: string) => k.replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase()).slice(0, TEXT_MAX.titel);
/** Passt ein Knoten-Titel zu einem Schlüssel der Daten (Titel-Abgleich ohne Groß-/Kleinschreibung, Umlaute gefaltet)? */
export function titelPasst(titel: string, schluessel: string): boolean {
  const t = titelForm(titel), s2 = titelForm(schluessel);
  return t === s2 || t.split(' ').includes(s2) || t.startsWith(`${s2} `) || (s2.includes(' ') && t.includes(s2));
}

/**
 * Einsortieren: Ebene 2 = Phase · Ebene 3 = Unterphase (Teilprozess) · Ebene 4 = Schritt · Ebene 5 = der Baustein.
 * Die Phase nach der EINEN Regel (./phasen.ts, 12.10.): eine kanonische Phase (auch über ein Dach-Thema — „strategie“ → Diagnose, „steuerung“ →
 * Führung) landet in der vorhandenen passenden Phase; fehlt sie, entsteht sie mit dem kanonischen Titel an IHRER Stelle (vorher hinten angehängt).
 * Ein unbekannter Schlüssel bleibt wie bisher (Titel-Abgleich, sonst neue eigene Phase).
 *
 * Mit Unterphase (13.10. unverändert): der Teilprozess der Unterphase, darunter ein Einzelschritt mit dem Titel des Bausteins und genau diesem Baustein.
 * OHNE Unterphase (Bausteine ohne passenden Teilprozess; Wurzelfix 13.10.): kein Einzelschritt je Baustein mehr — vorher stand jeder dieser Bausteine
 * unter „Weitere Bausteine“ doppelt (Schritt und Baustein gleichnamig), in der Sammel-Phase sogar „Weitere Bausteine“ unter „Weitere Bausteine“.
 * Jetzt: EIN Sammel-Teilprozess je Phase (Ebene 3, „Weitere Bausteine“; in der Sammel-Phase selbst „Allgemein“), darunter EIN Sammel-Schritt
 * (Ebene 4, „Zugeordnete Bausteine“), darunter die Bausteine als Ebene 5. Kein Titel steht unter einem gleichnamigen Knoten. Gespeicherte Vorlagen
 * werden nicht umgeschrieben (ein Baustein, der schon in der Vorlage steht, bleibt wo er ist); die Anzeige ist für beide Formen tolerant (`istSammelTeil`).
 */
function einsortieren(v: ProzessVorlage, b: Baustein, phase: string | undefined, unterphase: string | undefined, neueId: () => string): ProzessVorlage {
  if (v.knoten.some(k => k.bausteinId === b.id)) return v;
  const wurzel = v.knoten.find(k => !k.elternId);
  if (!wurzel) return v;
  let knoten = [...v.knoten];
  const kind = (eltern: string, schluessel: string, titel: string): string => {
    const da = kinderVon(eltern, knoten).find(k => titelPasst(k.titel, schluessel));
    if (da) return da.id;
    const id = neueId();
    if (eltern === wurzel.id) knoten = phaseEinfuegen(knoten, wurzel.id, { id, elternId: eltern, titel, rang: 0 });
    else knoten.push({ id, elternId: eltern, titel, rang: kinderVon(eltern, knoten).length + 1 });
    return id;
  };
  /** Ein Kind mit GENAU diesem Titel (Vergleichsform) — für die Sammel-Knoten; sonst wird es angelegt. */
  const genau = (eltern: string, titel: string): string => {
    const da = kinderVon(eltern, knoten).find(k => titelForm(k.titel) === titelForm(titel));
    if (da) return da.id;
    const id = neueId();
    knoten.push({ id, elternId: eltern, titel, rang: kinderVon(eltern, knoten).length + 1 });
    return id;
  };
  const kanon = phase ? phaseVon(phase) : null;
  const p = kanon
    ? phaseFinden(kinderVon(wurzel.id, knoten), kanon.id)?.id ?? kind(wurzel.id, PHASEN.find(x => x.id === kanon.id)!.woerter[0], phaseTitel(kanon.id))
    : kind(wurzel.id, phase ?? 'weitere bausteine', phase ? schoen(phase) : WEITERE_BAUSTEINE);
  if (unterphase) {
    const u = kind(p, unterphase, UNTER_TITEL[unterphase] ?? schoen(unterphase));
    const schritt = neueId();
    knoten.push({ id: schritt, elternId: u, titel: b.titel, rang: kinderVon(u, knoten).length + 1 });
    knoten.push({ id: neueId(), elternId: schritt, titel: b.titel, rang: 1, bausteinId: b.id });
  } else {
    // Sammel-Teilprozess (Ebene 3) → Sammel-Schritt (Ebene 4) → Baustein (Ebene 5): jeweils genau einer je Phase, nie gleichnamig mit dem Elternknoten.
    const phaseTitelHier = knoten.find(k => k.id === p)?.titel ?? '';
    const teilTitel = titelForm(phaseTitelHier) === titelForm(WEITERE_BAUSTEINE) ? SAMMEL_ALLGEMEIN : WEITERE_BAUSTEINE;
    const teil = titelForm(teilTitel) === titelForm(WEITERE_BAUSTEINE) ? kind(p, 'weitere bausteine', WEITERE_BAUSTEINE) : genau(p, teilTitel);
    const sammel = genau(teil, SAMMEL_SCHRITT);
    knoten.push({ id: neueId(), elternId: sammel, titel: b.titel, rang: kinderVon(sammel, knoten).length + 1, bausteinId: b.id });
  }
  return { ...v, knoten };
}

/**
 * Übernehmen — alles oder nichts. Bausteine: neu anlegen bzw. leere Felder ergänzen (mit „Import nehmen“: die Fassung der Datei); Marken nach
 * Vorschlag oder Wahl; Einsortieren in die gewählten Paket-Vorlagen. Abläufe: neu, aktualisiert (nur ohne Handänderung) bzw. mit „Import nehmen“.
 * Der Lauf (`fi-…`) merkt neue Kennungen und die Vorher-Fassung geänderter Einträge für „Rückgängig“ (30 Tage).
 */
export function importAnwenden(d0: VorlagenDatei, roh: unknown, wahl: ImportWahl, k: ImportKontext, neueKnotenId: () => string): AnwendenErgebnis<VorlagenDatei> {
  return ausfuehren(() => {
    const g = importLesen(roh);
    if (g.blockiert) return nein(g.fehler[0] ?? 'Nichts zu übernehmen.');
    sieheAuchAufloesen(g, d0);
    const d: VorlagenDatei = JSON.parse(JSON.stringify(d0));
    const lauf: ImportLauf = { id: k.laufId, am: k.jetzt, von: k.person, datei: k.datei.slice(0, 120), neu: [], geaendert: [] };
    const herkunft = (quelleIds?: string[]) => ({ art: 'import' as const, datei: k.datei.slice(0, 120), ...(quelleIds?.length ? { quelleIds } : {}), importLauf: k.laufId, am: k.jetzt });
    const vorherVorlagen = new Map<string, ProzessVorlage>();
    const merkeVorlage = (p: ProzessVorlage) => { if (!vorherVorlagen.has(p.id)) vorherVorlagen.set(p.id, JSON.parse(JSON.stringify(p))); };
    const geaendert: string[] = [];

    for (const x of g.bausteine) {
      const alt = d.bausteine.find(b => b.id === x.b.id);
      const recht = wahl.recht?.[x.q] ?? !!x.recht;
      const urheber = wahl.urheber?.[x.q] ?? !!x.urheber;
      const marken = {
        ...(recht ? { rechtPruefen: alt?.rechtPruefen ?? { seit: k.heute, grund: x.recht ?? 'Beim Import von Hand markiert.' } } : {}),
        ...(urheber ? { urheberPruefen: alt?.urheberPruefen ?? { seit: k.heute, grund: x.urheber ?? 'Beim Import von Hand markiert.' } } : {}),
      };
      if (!alt) {
        const neu: Baustein = { ...x.b, ...marken, herkunft: herkunft(x.quelleIds), fassung: 1, geaendert: k.jetzt, geaendertVon: k.person };
        d.bausteine.push(neu); lauf.neu.push(neu.id); geaendert.push(neu.id);
        continue;
      }
      const v = bausteinVergleich(alt, x);
      const nehmen = wahl.nehmen?.[alt.id] === true && (v.status === 'abweichend' || v.status === 'konflikt');
      if (v.status === 'gleich' && !(recht && !alt.rechtPruefen) && !(urheber && !alt.urheberPruefen)) continue;
      const neu: Baustein = { ...alt };
      const n = neu as unknown as Record<string, unknown>, q = x.b as unknown as Record<string, unknown>;
      for (const f of IMPORT_FELDER) if (!leer(q[f]) && (leer(n[f]) || nehmen)) n[f] = q[f];
      neu.tags = Array.from(new Set([...alt.tags, ...x.b.tags]));
      if (x.nurIntern) neu.kundeSichtbar = false;
      if (marken.rechtPruefen && !alt.rechtPruefen) neu.rechtPruefen = marken.rechtPruefen;
      if (marken.urheberPruefen && !alt.urheberPruefen) neu.urheberPruefen = marken.urheberPruefen;
      if (nehmen) delete neu.vonHand;
      if (JSON.stringify(neu) === JSON.stringify(alt)) continue;
      neu.herkunft = { ...herkunft(x.quelleIds) };
      neu.fassung = alt.fassung + 1; neu.geaendert = k.jetzt; neu.geaendertVon = k.person;
      d.bausteine = d.bausteine.map(b => (b.id === alt.id ? neu : b));
      lauf.geaendert.push({ id: alt.id, vorher: alt }); geaendert.push(alt.id);
    }
    if (d.bausteine.length > GRENZEN.bausteine) nein(`Bausteine: höchstens ${GRENZEN.bausteine} — mit dieser Datei wären es ${d.bausteine.length}. Nichts übernommen.`, 413);

    // Einsortieren in die gewählten Paket-Vorlagen (ein Baustein kann so in mehreren Paketen stecken).
    for (const x of g.bausteine) {
      const ziele = new Set<string>();
      for (const p of x.pakete) { const v = wahl.pakete?.[p]; if (v) ziele.add(v); }
      for (const f of x.giltFuer) { const v = wahl.giltFuer?.[f]; if (v) ziele.add(v); }
      const b = d.bausteine.find(y => y.id === x.b.id);
      if (!b) continue;
      for (const vid of ziele) {
        const v = d.prozesse.find(p => p.id === vid);
        if (!v || v.art !== 'paket') nein('Einsortieren: den gewählten Ablauf gibt es nicht (mehr).', 404);
        const neu = einsortieren(v!, b, x.phase, x.unterphase, neueKnotenId);
        if (neu === v) continue;
        merkeVorlage(v!);
        d.prozesse = d.prozesse.map(p => (p.id === vid ? neu : p));
      }
    }

    for (const a of g.ablaeufe) {
      const alt = d.prozesse.find(p => p.id === a.v.id);
      const status = ablaufStatus(alt, a);
      if (status === 'gleich') continue;
      if (alt && alt.art !== 'ablauf') nein(`„${a.v.titel}“: eine gleichnamige Vorlage ist kein Ablauf — bitte umbenennen.`, 409);
      if (status === 'konflikt' && wahl.nehmen?.[a.v.id] !== true) continue;
      const neu: ProzessVorlage = { ...(a.v as ProzessVorlage), fassung: (alt?.fassung ?? 0) + 1, herkunft: herkunft(), geaendert: k.jetzt, geaendertVon: k.person };
      if (alt) { merkeVorlage(alt); d.prozesse = d.prozesse.map(p => (p.id === alt.id ? neu : p)); }
      else { d.prozesse.push(neu); lauf.neu.push(neu.id); }
      geaendert.push(neu.id);
    }

    // Pakete (17.10.): gegen die Bibliothek NACH den Bausteinen dieser Datei binden — fehlt ein Baustein, wird nichts übernommen.
    const titelVon = bausteinTitel(d, g);
    for (const p of g.pakete) {
      const { v, fehlend } = paketBinden(p, titelVon);
      if (fehlend.length) nein(`Paket „${v.titel}“: ${anzahl(fehlend.length, 'Baustein fehlt', 'Bausteine fehlen')} in der Bibliothek (${fehlend.slice(0, 6).join(', ')}${fehlend.length > 6 ? ' …' : ''}) — bitte zuerst die Bausteine importieren. Nichts übernommen.`);
      const alt = d.prozesse.find(x => x.id === v.id);
      if (alt && alt.art !== 'paket') nein(`„${v.titel}“: eine Vorlage mit dieser Kennung ist kein Paket — bitte den Schlüssel ändern.`, 409);
      const status = paketStatus(alt, v);
      if (status === 'gleich') continue;
      if (status === 'konflikt' && wahl.nehmen?.[v.id] !== true) continue;
      // Der Papierkorb einer schon bearbeiteten Vorlage bleibt (nichts geht still verloren); die Vorher-Fassung merkt der Lauf für „Rückgängig“.
      const neu: ProzessVorlage = { ...(v as ProzessVorlage), ...(alt?.papierkorb ? { papierkorb: alt.papierkorb } : {}), fassung: (alt?.fassung ?? 0) + 1, herkunft: herkunft(), geaendert: k.jetzt, geaendertVon: k.person };
      vorlageStrukturPruefen(neu, d);
      zweigePruefen(neu.knoten);
      if (alt) { merkeVorlage(alt); d.prozesse = d.prozesse.map(x => (x.id === alt.id ? neu : x)); }
      else { d.prozesse.push(neu); lauf.neu.push(neu.id); }
      geaendert.push(neu.id);
    }
    for (const [id, vorher] of vorherVorlagen) {
      const p = d.prozesse.find(x => x.id === id)!;
      vorlageStrukturPruefen(p, d);
      d.prozesse = d.prozesse.map(x => (x.id === id ? { ...x, fassung: vorher.fassung + 1, geaendert: k.jetzt, geaendertVon: k.person } : x));
      lauf.geaendert.push({ id, vorher }); geaendert.push(id);
    }
    for (const id of lauf.neu.filter(i => i.startsWith('fp-'))) vorlageStrukturPruefen(d.prozesse.find(p => p.id === id)!, d);
    if (d.prozesse.length > GRENZEN.vorlagen) nein(`Prozess-Vorlagen: höchstens ${GRENZEN.vorlagen}. Nichts übernommen.`, 413);
    if (!lauf.neu.length && !lauf.geaendert.length) return { datei: d0, geaendert: [] };
    const grenze = Date.parse(k.jetzt) - IMPORT_GRENZEN.laufTage * 86_400_000;
    d.importLaeufe = [...d.importLaeufe.filter(l => Date.parse(l.am) >= grenze), lauf];
    return { datei: d, geaendert: Array.from(new Set(geaendert)) };
  });
}

export interface RueckgaengigBericht { entfernt: number; zurueck: number; geblieben: number }

/**
 * Rückgängig (30 Tage): nur, was seit dem Import unverändert ist; der Rest bleibt und wird gezählt. Zurückgeholte Fassungen bekommen eine NEUE,
 * höhere Fassung (Prüf-Fund 11.10.: vorher sank die Fassung — Formular-Stände und Fälle erkannten die Änderung nicht). Neue Bausteine bleiben, wenn
 * eine Vorlage ODER ein Fall sie nutzt (`inFaellen` = Baustein-Kennungen aus den Knoten aller Fälle und die Vorlagen der Fälle); neue Pakete bleiben, wenn ein Fall,
 * eine Zuordnung oder die Landkarte sie nutzt.
 */
export function importRueckgaengig(d0: VorlagenDatei, laufId: unknown, jetzt: string, inFaellen: ReadonlySet<string> = new Set()): AnwendenErgebnis<VorlagenDatei> & { bericht?: RueckgaengigBericht } {
  let bericht: RueckgaengigBericht = { entfernt: 0, zurueck: 0, geblieben: 0 };
  const r = ausfuehren(() => {
    const lauf = d0.importLaeufe.find(l => l.id === laufId) ?? nein('Diesen Import gibt es nicht (mehr).', 404);
    if (Date.parse(jetzt) - Date.parse(lauf.am) > IMPORT_GRENZEN.laufTage * 86_400_000) nein('Dieser Import ist älter als 30 Tage — Rückgängig geht nicht mehr.', 409);
    const d: VorlagenDatei = JSON.parse(JSON.stringify(d0));
    const b: RueckgaengigBericht = { entfernt: 0, zurueck: 0, geblieben: 0 };
    for (const g of lauf.geaendert) {
      if (g.id.startsWith('fp-')) {
        const p = d.prozesse.find(x => x.id === g.id);
        if (p && p.geaendert === lauf.am) { d.prozesse = d.prozesse.map(x => (x.id === g.id ? { ...(g.vorher as ProzessVorlage), fassung: p.fassung + 1, geaendert: jetzt } : x)); b.zurueck++; } else b.geblieben++;
      } else {
        const x = d.bausteine.find(y => y.id === g.id);
        if (x && x.herkunft?.importLauf === lauf.id && !x.vonHand) { d.bausteine = d.bausteine.map(y => (y.id === g.id ? { ...(g.vorher as Baustein), fassung: x.fassung + 1, geaendert: jetzt } : y)); b.zurueck++; } else b.geblieben++;
      }
    }
    for (const id of lauf.neu) {
      if (id.startsWith('fp-')) {
        const p = d.prozesse.find(x => x.id === id);
        // Ein Paket, an dem ein Fall läuft (Paket oder Zusatzmodul), das ein Produkt nutzt oder auf das die Landkarte zeigt, bleibt (17.10., Gesamtprüfung
        // Schreibwege B5 — vorher fiel es weg, und Fall, Zuordnung und Kasten zeigten ins Leere).
        const genutzt = inFaellen.has(id) || Object.values(d.zuordnung).some(z => z?.vorlageId === id) || d.prozesse.some(q => q.knoten.some(kn => kn.verweis === id));
        if (p && p.geaendert === lauf.am && !genutzt) { d.prozesse = d.prozesse.filter(x => x.id !== id); b.entfernt++; } else if (p) b.geblieben++;
      } else {
        const x = d.bausteine.find(y => y.id === id);
        const genutzt = inFaellen.has(id) || d.prozesse.some(p => p.knoten.some(kn => kn.bausteinId === id));
        if (x && x.herkunft?.importLauf === lauf.id && !x.vonHand && !genutzt) { d.bausteine = d.bausteine.filter(y => y.id !== id); b.entfernt++; } else if (x) b.geblieben++;
      }
    }
    d.importLaeufe = d.importLaeufe.filter(l => l.id !== lauf.id);
    bericht = b;
    return { datei: d, geaendert: [lauf.id] };
  });
  return r.ok ? { ...r, bericht } : r;
}

/** Fingerabdruck einer Datei (für die vorschauId) — stabil über Schlüssel-Reihenfolge hinweg nicht nötig: gleicher Text, gleicher Wert. */
export const dateiFingerabdruck = (text: string): string => fnv(text) + fnv(`${text.length}:${text.slice(0, 64)}`);
