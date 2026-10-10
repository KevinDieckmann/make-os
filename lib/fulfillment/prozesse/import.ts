// ─── Fulfillment · Prozesse — Import von Bausteinen und Abläufen (C1, 10.10.; FULFILLMENT_KONZEPT.md 2.6, 2.7) ──────────────────────
// Zwei Dateiformate, EIN Weg (Vorschau → Übernehmen → Rückgängig):
//   · Bausteine: `{ meta?, quellenverzeichnis?, vorlagen: [...] }` (Format von vorlagen.json, _2, _3, _4 und dem späteren konsolidierten Katalog)
//   · Abläufe:   `{ <schlüssel>: { titel, form, stufen[], uebergaenge[], phasen?, quelle?, vorbehalt?, zeichenhinweis[], ein_ausstiege? } }`
// Unbekannte Zusatzfelder werden toleriert (ignoriert). NIE übernommen: `quellenverzeichnis`, `link`-Felder (private Ablage-Adressen),
// `instanzwerte`/`instanzspezifisch` (Preise — die gehören in den Produktkatalog; die Vorschau zeigt sie als Hinweis). Die Schlüssel der
// Ablauf-Datei (Prozessnamen früherer Unternehmen) werden NIE Kennung oder Titel — die Kennung entsteht aus dem Titel (`fp-imp-<slug>`).
//
// Bausteine bekommen die Kennung `fb-imp-<quell-id>` (Präfixe s2-/s3-/s4- der Dateien bleiben drin → keine Kollision; derselbe Import
// noch einmal aktualisiert statt zu verdoppeln). Vorhandene Bausteine mit gleicher Kennung: nur LEERE Felder werden ergänzt (Kevin 10.10.);
// abweichende Inhalte stehen in der Vorschau („abweichend“ bzw. „Konflikt“, wenn von Hand geändert) und gehen nur mit „Import nehmen“ rein.
// Marken: „vor Einsatz rechtlich prüfen“ (`rechtVorschlag`), „vor Verkauf prüfen“ (gekauftes/fremdes Material, `pruefen_vor_verkauf`),
// „nur intern“ (`nur_intern`). Grenzen: ≤ 400 Bausteine bzw. ≤ 20 Abläufe je Datei (413), sonst wird abgelehnt — nie still gekürzt.
// Rein und client-sicher; die Route (app/api/fulfillment/import) prüft Größe (≤ 4 MB) und Stand (vorschauId → 409).

import type { AnwendenErgebnis, Baustein, BausteinArt, ImportLauf, ProzessKnoten, ProzessVorlage, Uebergang, VorlagenDatei } from '../typen';
import { BAUSTEIN_ARTEN } from '../lesen';
import { GRENZEN, TEXT_MAX } from '../grenzen';
import { ebeneVon, kinderVon, vorfahren } from '../regeln';
import { TAG_NUR_INTERN, TAG_VOR_VERKAUF, GLIEDERUNG_PUNKT_MAX } from './bausteine';
import { vorlageStrukturPruefen } from './vorlagen-anwenden';
import { ausfuehren, fnv, istObj, nein, slug, titelForm } from './pruefen';

export const IMPORT_GRENZEN = { bytes: 4 * 1024 * 1024, bausteine: 400, ablaeufe: 20, laufTage: 30 } as const;
const QUELL_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export type ImportFormat = 'bausteine' | 'ablaeufe';
export type BausteinStatus = 'neu' | 'gleich' | 'ergaenzt' | 'abweichend' | 'konflikt';

export interface ImportBausteinVorschau {
  id: string; quelle: string; titel: string; art: BausteinArt; status: BausteinStatus;
  /** Ergänzte bzw. abweichende Felder. */
  felder: string[];
  recht?: string; urheber?: string; nurIntern: boolean; preis: boolean;
  pakete: string[]; giltFuer: string[]; phase?: string; unterphase?: string;
}
export interface ImportAblaufVorschau { id: string; titel: string; form: NonNullable<ProzessVorlage['form']>; stufen: number; uebergaenge: number; ergaenzungen: number; status: 'neu' | 'gleich' | 'aktualisiert' | 'konflikt' }
export interface ImportVorschau {
  format: ImportFormat; datei: string;
  bausteine: ImportBausteinVorschau[]; ablaeufe: ImportAblaufVorschau[];
  pakete: string[]; giltFuer: string[];
  /** Einträge, die NICHT übernommen werden können (Bausteine: übersprungen; Abläufe: blockieren die Datei). */
  fehler: string[];
  hinweise: string[];
  zaehler: Record<BausteinStatus | 'aktualisiert', number>;
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
/** Vorschlag „vor Verkauf prüfen“ (Material Dritter). */
export function urheberVorschlag(x: { herkunft?: string; pruefenVorVerkauf?: boolean }): string | undefined {
  if (x.pruefenVorVerkauf) return 'Gekauftes bzw. fremdes Material — vor Verkauf prüfen.';
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
  const tags = [
    ...(phase ? [`phase:${tagWert(phase)}`] : []), ...(unterphase ? [`unterphase:${tagWert(unterphase)}`] : []),
    ...giltFuer.map(g => `fuer:${g}`), ...pakete.map(p => `paket:${p}`),
    ...(typeof x.paket_haupt === 'string' && tagWert(x.paket_haupt) ? [`paket-haupt:${tagWert(x.paket_haupt)}`] : []),
    ...(nurInt ? [TAG_NUR_INTERN] : []), ...(x.pruefen_vor_verkauf === true ? [TAG_VOR_VERKAUF] : []),
  ];
  // Quellen: nur kurze Kennungen wie „D4“ — nie Adressen.
  const quelleIds = (Array.isArray(x.quelle) ? x.quelle : typeof x.quelle === 'string' ? x.quelle.split(/[,;]\s*/) : [])
    .filter((y): y is string => typeof y === 'string').map(y => y.trim()).filter(y => /^[A-Za-z0-9._-]{1,20}$/.test(y));
  const b: Gelesen['b'] = {
    id: `fb-imp-${q}`, art, titel, gliederung, platzhalter, wer: 'intern', kundeSichtbar: false, tags: Array.from(new Set(tags)),
    ...(zweck ? { zweck } : {}), ...(hinweis ? { hinweis } : {}), ...(kennzahl ? { kennzahl } : {}), ...(herkunftText ? { herkunftText } : {}), ...(text ? { text } : {}),
  };
  const recht = rechtVorschlag({ art, titel, ...(unterphase ? { unterphase } : {}), ...(hinweis ? { hinweis } : {}), ...(zweck ? { zweck } : {}) });
  const urheber = urheberVorschlag({ ...(herkunftText ? { herkunft: herkunftText } : {}), pruefenVorVerkauf: x.pruefen_vor_verkauf === true });
  return {
    q, b, quelleIds, nurIntern: nurInt, preis: x.instanzwerte !== undefined || x.instanzspezifisch === true,
    pakete, giltFuer, ...(recht ? { recht } : {}), ...(urheber ? { urheber } : {}), ...(phase ? { phase } : {}), ...(unterphase ? { unterphase } : {}),
  };
}

type Form = NonNullable<ProzessVorlage['form']>;
/** Zeichenform aus dem Text der Datei — die Daten nennen sie teils frei („drei Spalten mit Weichen …“). Unbekannt: Fluss. */
export function formAus(v: unknown): Form {
  const t = typeof v === 'string' ? v.toLowerCase() : '';
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

export interface ImportGelesen { format: ImportFormat; bausteine: Gelesen[]; ablaeufe: AblaufGelesen[]; fehler: string[]; blockiert: boolean }

/** Eine Datei lesen (Format erkennen). Wirft nie — Fehler stehen in `fehler`; `blockiert` heißt: so nicht übernehmbar (Abläufe, Grenzen). */
export function importLesen(roh: unknown): ImportGelesen {
  if (istObj(roh) && Array.isArray(roh.vorlagen)) {
    const fehler: string[] = [];
    const liste = roh.vorlagen.filter(istObj);
    if (liste.length > IMPORT_GRENZEN.bausteine) return { format: 'bausteine', bausteine: [], ablaeufe: [], fehler: [`Die Datei hat ${liste.length} Einträge — höchstens ${IMPORT_GRENZEN.bausteine} je Datei. Bitte teilen. Nichts übernommen.`], blockiert: true };
    const bausteine: Gelesen[] = [];
    const ids = new Set<string>();
    for (const x of liste) {
      try {
        const g = bausteinLesen(x);
        if (ids.has(g.b.id)) { fehler.push(`„${g.q}“ steht doppelt in der Datei — der zweite Eintrag wird übersprungen.`); continue; }
        ids.add(g.b.id); bausteine.push(g);
      } catch (e) { fehler.push(`${e instanceof Error ? e.message : 'Eintrag unlesbar'} — übersprungen.`); }
    }
    return { format: 'bausteine', bausteine, ablaeufe: [], fehler, blockiert: !bausteine.length };
  }
  if (istObj(roh)) {
    const eintraege = Object.entries(roh).filter(([, v]) => istObj(v) && Array.isArray((v as Record<string, unknown>).stufen));
    if (!eintraege.length) return { format: 'ablaeufe', bausteine: [], ablaeufe: [], fehler: ['Unbekanntes Format: erwartet wird eine Bausteine-Datei („vorlagen“: […]) oder eine Ablauf-Datei (je Ablauf „stufen“ und „uebergaenge“).'], blockiert: true };
    if (eintraege.length > IMPORT_GRENZEN.ablaeufe) return { format: 'ablaeufe', bausteine: [], ablaeufe: [], fehler: [`${eintraege.length} Abläufe — höchstens ${IMPORT_GRENZEN.ablaeufe} je Datei. Nichts übernommen.`], blockiert: true };
    const fehler: string[] = [];
    const ablaeufe: AblaufGelesen[] = [];
    for (const [k, v] of eintraege) {
      try {
        const a = ablaufLesen(k, v as Record<string, unknown>);
        if (ablaeufe.some(x => x.v.id === a.v.id)) { fehler.push(`Zwei Abläufe heißen „${a.v.titel}“ — bitte einen umbenennen.`); continue; }
        ablaeufe.push(a);
      } catch (e) { fehler.push(e instanceof Error ? e.message : 'Ablauf unlesbar.'); }
    }
    return { format: 'ablaeufe', bausteine: [], ablaeufe, fehler, blockiert: fehler.length > 0 || !ablaeufe.length };
  }
  return { format: 'bausteine', bausteine: [], ablaeufe: [], fehler: ['Die Datei ist kein JSON-Objekt.'], blockiert: true };
}

// ── Vergleich mit dem Bestand ───────────────────────────────────────────────────────────────────────────────────────────────────────

const IMPORT_FELDER = ['art', 'titel', 'zweck', 'hinweis', 'kennzahl', 'herkunftText', 'text', 'gliederung', 'platzhalter'] as const;
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
const ablaufStruktur = (v: Pick<ProzessVorlage, 'titel' | 'form' | 'knoten' | 'uebergaenge' | 'vorbehalt' | 'quelleHinweis' | 'zeichenhinweise'>) =>
  JSON.stringify({ t: v.titel, f: v.form, k: v.knoten, u: v.uebergaenge, v: v.vorbehalt ?? null, q: v.quelleHinweis ?? null, z: v.zeichenhinweise ?? [] });
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
  const hinweise: string[] = [];
  const preise = bausteine.filter(b => b.preis).length;
  if (preise) hinweise.push(`${preise} Einträge tragen Instanzwerte (z. B. Preise) — die werden nicht übernommen und gehören in den Produktkatalog.`);
  const intern = bausteine.filter(b => b.nurIntern).length;
  if (intern) hinweise.push(`${intern} Einträge sind „nur intern“ — sie erscheinen nie beim Kunden, im Report oder in einem Export.`);
  if (istObj(roh) && roh.quellenverzeichnis !== undefined) hinweise.push('Das Quellenverzeichnis der Datei (mit Ablage-Adressen) wird nicht übernommen — nur die Kennungen der Quellen.');
  return {
    format: g.format, datei, bausteine, ablaeufe,
    pakete: Array.from(new Set(g.bausteine.flatMap(x => x.pakete))).sort(), giltFuer: Array.from(new Set(g.bausteine.flatMap(x => x.giltFuer))).sort(),
    fehler: g.fehler, hinweise, zaehler,
  };
}

// ── Übernehmen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const PHASE_TITEL: Record<string, string> = {
  vorlauf: 'Vorlauf / Onboarding', analyse: 'Analyse', diagnose: 'Diagnose', aufbau: 'Aufbau', recruiting: 'Recruiting (nur Prozess)', umsetzung: 'Umsetzung',
  fuehrung: 'Führung', uebergabe: 'Follow-up / Übergabe',
};
const UNTER_TITEL: Record<string, string> = { prozess: 'Prozess', crm: 'CRM', skripte: 'Skripte', einwaende: 'Einwände', kennzahlen: 'Kennzahlen', zielgruppe_leads: 'Zielgruppe & Leads' };
const schoen = (k: string) => k.replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase()).slice(0, TEXT_MAX.titel);
/** Passt ein Knoten-Titel zu einem Schlüssel der Daten (Titel-Abgleich ohne Groß-/Kleinschreibung, Umlaute gefaltet)? */
export function titelPasst(titel: string, schluessel: string): boolean {
  const t = titelForm(titel), s2 = titelForm(schluessel);
  return t === s2 || t.split(' ').includes(s2) || t.startsWith(`${s2} `) || (s2.includes(' ') && t.includes(s2));
}

/** Einsortieren: Ebene 2 = Phase · Ebene 3 = Unterphase · Ebene 4 = Einzelschritt (Titel des Bausteins) · Ebene 5 = der Baustein. */
function einsortieren(v: ProzessVorlage, b: Baustein, phase: string | undefined, unterphase: string | undefined, neueId: () => string): ProzessVorlage {
  if (v.knoten.some(k => k.bausteinId === b.id)) return v;
  const wurzel = v.knoten.find(k => !k.elternId);
  if (!wurzel) return v;
  let knoten = [...v.knoten];
  const kind = (eltern: string, schluessel: string, titel: string): string => {
    const da = kinderVon(eltern, knoten).find(k => titelPasst(k.titel, schluessel));
    if (da) return da.id;
    const id = neueId();
    knoten.push({ id, elternId: eltern, titel, rang: kinderVon(eltern, knoten).length + 1 });
    return id;
  };
  const p = kind(wurzel.id, phase ?? 'weitere bausteine', phase ? PHASE_TITEL[phase] ?? schoen(phase) : 'Weitere Bausteine');
  const u = kind(p, unterphase ?? 'weitere bausteine', unterphase ? UNTER_TITEL[unterphase] ?? schoen(unterphase) : 'Weitere Bausteine');
  const schritt = neueId();
  knoten.push({ id: schritt, elternId: u, titel: b.titel, rang: kinderVon(u, knoten).length + 1 });
  knoten.push({ id: neueId(), elternId: schritt, titel: b.titel, rang: 1, bausteinId: b.id });
  knoten = knoten.map(k => k);
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
        if (!v || v.art !== 'paket') nein('Einsortieren: die gewählte Paket-Vorlage gibt es nicht (mehr).', 404);
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

/** Rückgängig (30 Tage): nur, was seit dem Import unverändert ist; der Rest bleibt und wird gezählt. */
export function importRueckgaengig(d0: VorlagenDatei, laufId: unknown, jetzt: string): AnwendenErgebnis<VorlagenDatei> & { bericht?: RueckgaengigBericht } {
  let bericht: RueckgaengigBericht = { entfernt: 0, zurueck: 0, geblieben: 0 };
  const r = ausfuehren(() => {
    const lauf = d0.importLaeufe.find(l => l.id === laufId) ?? nein('Diesen Import gibt es nicht (mehr).', 404);
    if (Date.parse(jetzt) - Date.parse(lauf.am) > IMPORT_GRENZEN.laufTage * 86_400_000) nein('Dieser Import ist älter als 30 Tage — Rückgängig geht nicht mehr.', 409);
    const d: VorlagenDatei = JSON.parse(JSON.stringify(d0));
    const b: RueckgaengigBericht = { entfernt: 0, zurueck: 0, geblieben: 0 };
    for (const g of lauf.geaendert) {
      if (g.id.startsWith('fp-')) {
        const p = d.prozesse.find(x => x.id === g.id);
        if (p && p.geaendert === lauf.am) { d.prozesse = d.prozesse.map(x => (x.id === g.id ? g.vorher as ProzessVorlage : x)); b.zurueck++; } else b.geblieben++;
      } else {
        const x = d.bausteine.find(y => y.id === g.id);
        if (x && x.herkunft?.importLauf === lauf.id && !x.vonHand) { d.bausteine = d.bausteine.map(y => (y.id === g.id ? g.vorher as Baustein : y)); b.zurueck++; } else b.geblieben++;
      }
    }
    for (const id of lauf.neu) {
      if (id.startsWith('fp-')) {
        const p = d.prozesse.find(x => x.id === id);
        if (p && p.geaendert === lauf.am) { d.prozesse = d.prozesse.filter(x => x.id !== id); b.entfernt++; } else if (p) b.geblieben++;
      } else {
        const x = d.bausteine.find(y => y.id === id);
        const genutzt = d.prozesse.some(p => p.knoten.some(kn => kn.bausteinId === id));
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
