// ─── Fulfillment · Prozesse — Schreibregeln des Vorlagen-Bestands `fulfillment--<h>` (C1, 10.10.; FULFILLMENT_KONZEPT.md 2.3, 2.7, 7.1, 9) ─
// EINE reine Funktion `vorlagenAnwenden(datei, ops, kontext)` für alle Änderungen an Vorlagen (Landkarte · Pakete · Abläufe), Knoten,
// Übergängen, Bausteinen, Ritualen, der Zuordnung Produkt → Vorlage, den Agent-Zusätzen und den Einstellungen. Alles oder nichts:
// Unsinn 400, Recht 403, unbekannt 404, Stand/Regel 409, Grenze 413 — nie still gekürzt. Der Server (Route) schreibt über
// `fulfillmentAendern('vorlagen', …)` in EINER Sperre.
//
// Regeln der fünf Ebenen (2.3), gegen den ENDstand jeder berührten Vorlage geprüft:
//   · genau eine Wurzel (Ebene 1) · höchstens fünf Ebenen · kein Kreis (400)
//   · Ebene 5 trägt immer `bausteinId` (Baustein der Bibliothek) und sonst nur Titel, Rang, Sichtbarkeit; Ebene 1–4 nie einen Baustein
//   · Geschwister über `rang` lückenlos (1, 2, 3 …) — nach jedem Einfügen/Verschieben neu nummeriert
//   · Übergänge nur in Abläufen und nur zwischen Knoten DERSELBEN Ebene (Kreise sind dort erlaubt — das sind Rückwege)
// „Aus Muster anlegen“ kopiert die neutralen Muster (lib/fulfillment/muster.ts) mit NEUEN Kennungen; Marken `muster:<musterId>` halten fest,
// was schon angelegt ist (zweimal klicken legt nichts doppelt an). Rein und client-sicher; Fingerabdruck und Kennungen kommen über den Kontext.

import type { Baustein, Freigabepunkt, ProzessKnoten, ProzessVorlage, RitualVorlage, Rolle, Uebergang, VorlagenDatei, AnwendenErgebnis, AnalyseAgentId, Rhythmus } from '../typen';
import { GRENZEN, ID_FREI, KENNUNG, TEXT_MAX } from '../grenzen';
import { ANALYSE_AGENTEN, KREISLAUF_IDS, ABLAUF_FORMEN, RITUAL_RHYTHMEN } from '../lesen';
import { ebeneVon, kinderVon, kreisBei, teilbaum, EBENEN_MAX, KREIS, markeOnboardingAus } from '../regeln';
import { MUSTER_LANDKARTE, MUSTER_P1, MUSTER_P2, MUSTER_P3, MUSTER_RITUALE, MUSTER_PLAYBOOK } from '../muster';
import { istOrt } from '../orte';
import { bausteinAusEingabe, markeUrheberGeprueft, MESSE_NACHFASS_TAGE } from './bausteine';
import { ausfuehren, istObj, mischen, nein, optBool, optText, optWahl, optZahl, pflichtText, standPruefen, textListe } from './pruefen';

export interface VorlagenKontext {
  person: string;
  jetzt: string;
  heute: string;
  /** Fingerabdruck eines Eintrags (Server: lib/fulfillment/speicher.ts `eintragStand`). */
  standVon: (x: object) => string;
  neueId: (praefix: 'fp' | 'fk' | 'fb' | 'fr') => string;
  /** Produkte des Katalogs (Kennungen) — die Zuordnung Produkt → Vorlage nur auf diese. Fehlt: keine Prüfung (Tests). */
  leistungen?: readonly string[];
}

export type VorlagenOp = { op: string } & Record<string, unknown>;

/** Stand eines Vorlagen-Kopfs (ohne Knoten und Übergänge — Knoten haben ihren eigenen Stand). */
export const vorlageKopf = (v: ProzessVorlage) => ({ ...v, knoten: [], uebergaenge: [] });

const MUSTER = { landkarte: MUSTER_LANDKARTE, p1: MUSTER_P1, p2: MUSTER_P2, p3: MUSTER_P3 } as const;
export type MusterWahl = keyof typeof MUSTER;
export const MUSTER_WAHL: readonly { id: MusterWahl; titel: string }[] = [
  { id: 'landkarte', titel: MUSTER_LANDKARTE.titel }, { id: 'p1', titel: MUSTER_P1.titel }, { id: 'p2', titel: MUSTER_P2.titel }, { id: 'p3', titel: MUSTER_P3.titel },
];
export const markeMuster = (musterId: string) => `muster:${musterId}`;

const KNOTEN_TEXTE: readonly [keyof ProzessKnoten, 'titel' | 'ziel' | 'ergebnis' | 'kurz' | 'beschreibung'][] = [
  ['ziel', 'ziel'], ['warum', 'ziel'], ['eingang', 'ergebnis'], ['ergebnis', 'ergebnis'], ['kennzahl', 'kurz'], ['rolle', 'kurz'], ['heute', 'kurz'],
  ['dokumentation', 'beschreibung'], ['ausgang', 'kurz'], ['original', 'kurz'],
];
const KNOTEN_FELDER = new Set(['id', 'elternId', 'vor', 'titel', 'zone', 'kreislauf', 'ort', 'verweis', 'ziel', 'warum', 'eingang', 'ergebnis', 'kennzahl', 'zustaendig', 'rolle', 'dauerTage', 'aufwandStunden', 'freigabe', 'kundeSichtbar', 'phaseId', 'bausteinId', 'heute', 'werkzeuge', 'dokumentation', 'art', 'optional', 'ausgang', 'original', 'beleg']);
/** Felder, die ein Baustein-Knoten (Ebene 5) tragen darf. */
const EBENE5_FELDER = new Set(['id', 'elternId', 'titel', 'rang', 'kundeSichtbar', 'bausteinId']);

/** Kennung des obersten Knotens (Ebene 1) einer Vorlage. */
const wurzelId = (v: ProzessVorlage): string | undefined => v.knoten.find(k => !k.elternId)?.id;

/** Geschwister lückenlos nummerieren; `vorId` setzt `id` direkt davor (sonst ans Ende, wenn `ansEnde`). */
function rangNeu(liste: ProzessKnoten[], elternId: string | undefined, id?: string, vorId?: string | null, ansEnde = false): ProzessKnoten[] {
  const geschwister = kinderVon(elternId, liste).filter(k => k.id !== id);
  const ich = id ? liste.find(k => k.id === id) : undefined;
  if (ich) {
    const i = vorId ? geschwister.findIndex(k => k.id === vorId) : -1;
    if (i >= 0) geschwister.splice(i, 0, ich);
    else if (ansEnde || vorId === null) geschwister.push(ich);
    else geschwister.splice(Math.max(0, Math.min(geschwister.length, (ich.rang ?? geschwister.length + 1) - 1)), 0, ich);
  }
  const rang = new Map(geschwister.map((k, i) => [k.id, i + 1]));
  return liste.map(k => (rang.has(k.id) ? { ...k, rang: rang.get(k.id)! } : k));
}

/** Die Struktur einer Vorlage gegen die Regeln prüfen (2.3) — wirft `Abgelehnt`. */
export function vorlageStrukturPruefen(v: ProzessVorlage, d: Pick<VorlagenDatei, 'bausteine' | 'prozesse'>): void {
  const ids = new Set<string>();
  for (const k of v.knoten) { if (ids.has(k.id)) nein(`Knoten-Kennung „${k.id}“ doppelt in „${v.titel}“.`); ids.add(k.id); }
  for (const k of v.knoten) if (k.elternId && !ids.has(k.elternId)) nein(`„${k.titel}“ hängt an einem Knoten, den es nicht gibt.`);
  const kreis = kreisBei(v.knoten);
  if (kreis) nein(`Kreis in „${v.titel}“ — ein Knoten kann nicht unter sich selbst hängen. Nichts gespeichert.`);
  const wurzeln = v.knoten.filter(k => !k.elternId);
  if (wurzeln.length !== 1) nein(`„${v.titel}“ braucht genau einen obersten Knoten (Ebene 1) — jetzt ${wurzeln.length}.`);
  const bausteine = new Set(d.bausteine.map(b => b.id));
  const freigaben = new Set(v.freigaben.map(f => f.id));
  for (const k of v.knoten) {
    const e = ebeneVon(k, v.knoten);
    if (e === KREIS) nein('Kreis in der Vorlage.');
    if (e > EBENEN_MAX) nein(`„${k.titel}“ läge auf Ebene ${e} — höchstens ${EBENEN_MAX} Ebenen (Gesamtprozess · Prozess · Teilprozess · Einzelschritt · Baustein).`);
    if (e === EBENEN_MAX) {
      if (!k.bausteinId) nein(`„${k.titel}“ steht auf Ebene 5 — dort hängen nur Bausteine aus der Bibliothek. Lege einen Einzelschritt auf Ebene 4 an und hänge den Baustein darunter.`);
      const fremd = Object.keys(k).filter(f => !EBENE5_FELDER.has(f));
      if (fremd.length) nein(`Ein Baustein-Knoten trägt nur Titel, Reihenfolge und Sichtbarkeit — „${k.titel}“ hat zusätzlich: ${fremd.join(', ')}.`);
    } else if (k.bausteinId) nein(`„${k.titel}“ (Ebene ${e}) kann keinen Baustein tragen — Bausteine hängen auf Ebene 5 unter einem Einzelschritt.`);
    if (k.bausteinId && !bausteine.has(k.bausteinId)) nein(`„${k.titel}“ verweist auf einen Baustein, den es nicht gibt.`);
    if (k.ort !== undefined && !istOrt(k.ort)) nein(`„${k.titel}“: unbekannter Ort.`);
    if (k.verweis !== undefined) {
      const z = d.prozesse.find(p => p.id === k.verweis);
      if (!z || z.art !== 'paket' || z.id === v.id) nein(`„${k.titel}“ verweist auf keine Paket-Vorlage.`);
    }
    if (k.freigabe !== undefined && !freigaben.has(k.freigabe)) nein(`„${k.titel}“ verweist auf die Freigabe „${k.freigabe}“, die die Vorlage nicht kennt.`);
  }
  if (v.uebergaenge.length && v.art !== 'ablauf') nein('Übergänge gibt es nur in Abläufen.');
  for (const u of v.uebergaenge) {
    const a = v.knoten.find(k => k.id === u.von), b = v.knoten.find(k => k.id === u.nach);
    if (!a || !b) nein('Ein Übergang zeigt auf einen Knoten, den es nicht gibt.');
    if (a!.id === b!.id) nein('Ein Übergang braucht zwei verschiedene Stufen.');
    if (ebeneVon(a!, v.knoten) !== ebeneVon(b!, v.knoten)) nein(`Übergang „${a!.titel}“ → „${b!.titel}“: nur zwischen Stufen derselben Ebene.`);
  }
  if (v.knoten.length > GRENZEN.knotenJeVorlage) nein(`Knoten in „${v.titel}“: höchstens ${GRENZEN.knotenJeVorlage} (jetzt ${v.knoten.length}). Nichts gespeichert.`, 413);
  if (v.uebergaenge.length > GRENZEN.uebergaengeJeAblauf) nein(`Übergänge in „${v.titel}“: höchstens ${GRENZEN.uebergaengeJeAblauf}. Nichts gespeichert.`, 413);
}

/** Eingabe eines Knotens prüfen → Teil-Felder (null = entfernen). */
function knotenTeil(roh: Record<string, unknown>, v: ProzessVorlage): Record<string, unknown> {
  for (const f of Object.keys(roh)) if (!KNOTEN_FELDER.has(f)) nein(`Unbekanntes Feld „${f}“ am Knoten.`);
  const t: Record<string, unknown> = {};
  if (roh.titel !== undefined) t.titel = pflichtText(roh.titel, 'titel', 'Titel');
  for (const [f, feld] of KNOTEN_TEXTE) { const x = optText(roh[f], feld, String(f)); if (x !== undefined) t[f] = x; }
  const zone = optWahl(roh.zone, ['dach', 'etage', 'fundament'] as const, 'Zone'); if (zone !== undefined) t.zone = zone;
  if (roh.kreislauf !== undefined) {
    if (roh.kreislauf === null) t.kreislauf = null;
    else if (!Array.isArray(roh.kreislauf) || roh.kreislauf.some(x => !(KREISLAUF_IDS as readonly unknown[]).includes(x))) nein('Kreislauf: unbekannte Stufe.');
    else t.kreislauf = roh.kreislauf.length ? Array.from(new Set(roh.kreislauf as string[])) : null;
  }
  if (roh.ort !== undefined) t.ort = roh.ort === null || roh.ort === '' ? null : istOrt(roh.ort) ? roh.ort : nein('Ort: unbekannte Kennung.');
  if (roh.verweis !== undefined) t.verweis = roh.verweis === null || roh.verweis === '' ? null : typeof roh.verweis === 'string' && KENNUNG.vorlage.test(roh.verweis) ? roh.verweis : nein('Verweis: keine Vorlage.');
  const z = optWahl(roh.zustaendig, ['intern', 'kunde', 'beide'] as const, 'Zuständig'); if (z !== undefined) t.zustaendig = z;
  const dt = optZahl(roh.dauerTage, 0, 3650, 'Dauer (Tage)'); if (dt !== undefined) t.dauerTage = dt === null ? null : Math.round(dt);
  const as = optZahl(roh.aufwandStunden, 0, 10000, 'Aufwand (Stunden)'); if (as !== undefined) t.aufwandStunden = as;
  if (roh.freigabe !== undefined) t.freigabe = roh.freigabe === null || roh.freigabe === '' ? null : typeof roh.freigabe === 'string' && v.freigaben.some(f => f.id === roh.freigabe) ? roh.freigabe : nein('Freigabe: die Vorlage kennt diesen Freigabepunkt nicht.');
  const ks = optBool(roh.kundeSichtbar, 'Für Kunden sichtbar'); if (ks !== undefined) t.kundeSichtbar = ks;
  if (roh.phaseId !== undefined) t.phaseId = roh.phaseId === null || roh.phaseId === '' ? null : typeof roh.phaseId === 'string' && roh.phaseId.length <= 80 ? roh.phaseId : nein('Phase: Kennung zu lang.');
  if (roh.bausteinId !== undefined) t.bausteinId = roh.bausteinId === null || roh.bausteinId === '' ? null : typeof roh.bausteinId === 'string' && KENNUNG.baustein.test(roh.bausteinId) ? roh.bausteinId : nein('Baustein: unbekannte Kennung.');
  const wz = textListe(roh.werkzeuge, 'kurz', 'Werkzeuge', 20); if (wz !== undefined) t.werkzeuge = wz.length ? wz : null;
  const art = optWahl(roh.art, ['einstieg', 'stufe', 'ausstieg', 'routine'] as const, 'Art der Stufe'); if (art !== undefined) t.art = art;
  const op = optBool(roh.optional, 'Optional'); if (op !== undefined) t.optional = op || null;
  const beleg = optWahl(roh.beleg, ['quelle', 'ergaenzung'] as const, 'Beleg'); if (beleg !== undefined) t.beleg = beleg;
  return t;
}

function freigabenAus(v: unknown): Freigabepunkt[] {
  if (!Array.isArray(v)) return nein('Freigaben: Liste erwartet.');
  if (v.length > 30) return nein('Freigaben: höchstens 30.', 413);
  const ids = new Set<string>();
  return v.map((x, i) => {
    if (!istObj(x)) return nein(`Freigabe ${i + 1}: Objekt erwartet.`);
    const id = typeof x.id === 'string' && ID_FREI.test(x.id) ? x.id : nein(`Freigabe ${i + 1}: Kennung (z. B. F3) fehlt.`);
    if (ids.has(id)) nein(`Freigabe „${id}“ doppelt.`);
    ids.add(id);
    return { id, titel: pflichtText(x.titel, 'titel', `Freigabe ${id}`), wer: optWahl(x.wer, ['intern', 'kunde', 'beide'] as const, `Freigabe ${id}: wer`) ?? 'beide' };
  });
}
function rollenAus(v: unknown): Rolle[] {
  if (!Array.isArray(v)) return nein('Rollen: Liste erwartet.');
  if (v.length > 30) return nein('Rollen: höchstens 30.', 413);
  return v.map((x, i) => {
    if (!istObj(x)) return nein(`Rolle ${i + 1}: Objekt erwartet.`);
    const id = typeof x.id === 'string' && ID_FREI.test(x.id) ? x.id : nein(`Rolle ${i + 1}: Kennung fehlt.`);
    const r: Rolle = { id, titel: pflichtText(x.titel, 'titel', `Rolle ${id}`) };
    const a = optText(x.aufgabe, 'ziel', `Rolle ${id}: Aufgabe`); if (a) r.aufgabe = a;
    return r;
  });
}
const RHYTHMEN: readonly Rhythmus[] = RITUAL_RHYTHMEN;
const TEILNEHMENDE = ['intern', 'entscheider', 'tagesverantwortlich', 'team'] as const;

/** Eine Muster-Vorlage mit NEUEN Kennungen (Knoten, Eltern, Verweise über `verweise`). */
function musterKopie(m: ProzessVorlage, k: VorlagenKontext, verweise: (musterId: string) => string | undefined): ProzessVorlage {
  const map = new Map<string, string>(m.knoten.map(x => [x.id, k.neueId('fk')]));
  const knoten: ProzessKnoten[] = m.knoten.map(x => {
    const { verweis, ...rest } = x;
    const neu: ProzessKnoten = { ...rest, id: map.get(x.id)!, ...(x.elternId ? { elternId: map.get(x.elternId)! } : {}) };
    if (!x.elternId) delete neu.elternId;
    const v = verweis ? verweise(verweis) : undefined;
    return v ? { ...neu, verweis: v } : neu;
  });
  // Messe-Nachfasstakt (Entscheidung 00:20): unter „Nach der Messe“ je ein Einzelschritt für Tag 1, 3, 7, 14, 30.
  if (m.id === MUSTER_P3.id) {
    const nach = map.get('fk-muster-p3-messen-nach');
    if (nach) MESSE_NACHFASS_TAGE.forEach((t, i) => knoten.push({ id: k.neueId('fk'), elternId: nach, titel: `Nachfassen Tag ${t}`, rang: i + 1, dauerTage: t }));
  }
  return { ...m, id: k.neueId('fp'), knoten, herkunft: { art: 'muster', am: k.jetzt }, fassung: 1, geaendert: k.jetzt, geaendertVon: k.person };
}

/**
 * Die Änderungen anwenden — alles oder nichts. Ops (je `{ op, … }`):
 *   aus-muster { welche? }                  · vorlage { eintrag, stand? } · vorlage-weg { id, stand? } · kopie { id } (z. B. Ablauf → Paket)
 *   knoten { vorlageId, eintrag (id? = ändern), stand? } · knoten-weg { vorlageId, id } · knoten-rang { vorlageId, id, richtung: hoch|runter }
 *   uebergang { vorlageId, eintrag } · uebergang-weg { vorlageId, von, nach }
 *   baustein { eintrag (id? = ändern), stand? } · baustein-weg { id, stand? } · recht-geprueft { id, notiz } · urheber-geprueft { id }
 *   ritual { eintrag, stand? } · ritual-weg { id } · zuordnung { leistungId, vorlageId|null } · agent-zusatz { agent, text|null }
 *   einstellungen { felder } (Kunden-Link nur Inhaber) · onboarding-aus { mandatId, aus }
 */
export function vorlagenAnwenden(datei: VorlagenDatei, opsRoh: unknown, k: VorlagenKontext): AnwendenErgebnis<VorlagenDatei> {
  return ausfuehren(() => {
    if (!Array.isArray(opsRoh) || !opsRoh.length) return nein('ops: mindestens eine Änderung.');
    if (opsRoh.length > GRENZEN.opsJeAnfrage) return nein(`Höchstens ${GRENZEN.opsJeAnfrage} Änderungen je Anfrage. Nichts gespeichert.`, 413);
    const d: VorlagenDatei = JSON.parse(JSON.stringify(datei));
    const vorher = new Map(datei.prozesse.map(p => [p.id, JSON.stringify(p)]));
    const beruehrt = new Set<string>();
    const geaendert: string[] = [];
    const vorlage = (id: unknown): ProzessVorlage => d.prozesse.find(p => p.id === id) ?? nein('Diese Vorlage gibt es nicht (mehr).', 404);
    const setze = (v: ProzessVorlage) => { d.prozesse = d.prozesse.map(p => (p.id === v.id ? v : p)); beruehrt.add(v.id); };

    for (const roh of opsRoh) {
      if (!istObj(roh) || typeof roh.op !== 'string') nein('Jede Änderung braucht „op“.');
      const o = roh as VorlagenOp;
      switch (o.op) {
        case 'aus-muster': {
          const welche = Array.isArray(o.welche) ? (o.welche as unknown[]).filter((x): x is MusterWahl => typeof x === 'string' && x in MUSTER) : (Object.keys(MUSTER) as MusterWahl[]);
          if (!welche.length) nein('Kein bekanntes Muster gewählt.');
          // Pakete zuerst — die Landkarte verweist auf sie.
          for (const w of (['p1', 'p2', 'p3', 'landkarte'] as MusterWahl[]).filter(x => welche.includes(x))) {
            const m = MUSTER[w];
            const da = d.marken[markeMuster(m.id)];
            if (da && d.prozesse.some(p => p.id === da)) continue;
            if (w === 'landkarte' && d.prozesse.some(p => p.art === 'landkarte')) continue;
            const v = musterKopie(m, k, musterId => { const id = d.marken[markeMuster(musterId)]; return id && d.prozesse.some(p => p.id === id && p.art === 'paket') ? id : undefined; });
            d.prozesse.push(v); beruehrt.add(v.id); geaendert.push(v.id);
            d.marken[markeMuster(m.id)] = v.id;
          }
          for (const r of MUSTER_RITUALE) {
            const da = d.marken[markeMuster(r.id)];
            if (da && d.rituale.some(x => x.id === da)) continue;
            const neu: RitualVorlage = { ...r, id: k.neueId('fr'), geaendert: k.jetzt, geaendertVon: k.person };
            d.rituale.push(neu); d.marken[markeMuster(r.id)] = neu.id; geaendert.push(neu.id);
          }
          const pb = d.marken[markeMuster(MUSTER_PLAYBOOK.id)];
          if (!pb || !d.bausteine.some(b => b.id === pb)) {
            const neu: Baustein = { ...MUSTER_PLAYBOOK, id: k.neueId('fb'), herkunft: { art: 'muster', am: k.jetzt }, fassung: 1, geaendert: k.jetzt, geaendertVon: k.person };
            d.bausteine.push(neu); d.marken[markeMuster(MUSTER_PLAYBOOK.id)] = neu.id; geaendert.push(neu.id);
          }
          break;
        }
        case 'vorlage': {
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const alt = typeof e.id === 'string' ? d.prozesse.find(p => p.id === e.id) : undefined;
          if (typeof e.id === 'string' && !alt) nein('Diese Vorlage gibt es nicht (mehr).', 404);
          if (alt) standPruefen(o.stand, k.standVon(vorlageKopf(alt)), alt.id);
          const teil: Record<string, unknown> = {};
          if (e.titel !== undefined || !alt) teil.titel = pflichtText(e.titel, 'titel', 'Titel');
          for (const [f, feld] of [['beschreibung', 'beschreibung'], ['vorbehalt', 'hinweis'], ['quelleHinweis', 'kurz']] as const) { const x = optText(e[f], feld, f); if (x !== undefined) teil[f] = x; }
          const form = optWahl(e.form, ABLAUF_FORMEN, 'Zeichenform'); if (form !== undefined) teil.form = form;
          if (e.freigaben !== undefined) teil.freigaben = freigabenAus(e.freigaben);
          if (e.rollen !== undefined) teil.rollen = rollenAus(e.rollen);
          const zh = textListe(e.zeichenhinweise, 'kurz', 'Zeichenhinweise', 20); if (zh !== undefined) teil.zeichenhinweise = zh.length ? zh : null;
          if (alt) {
            if (e.art !== undefined && e.art !== alt.art) nein('Die Art einer Vorlage lässt sich nicht ändern — „Kopie als Paket“ legt eine neue an.');
            const neu = mischen(alt, teil);
            // Wurzel heißt wie die Vorlage (Ebene 1 = Gesamtprozess).
            if (teil.titel) { const w = neu.knoten.find(x => !x.elternId); if (w) neu.knoten = neu.knoten.map(x => (x.id === w.id ? { ...x, titel: teil.titel as string } : x)); }
            const genutzt = new Set(neu.knoten.map(x => x.freigabe).filter(Boolean));
            const weg = [...genutzt].filter(f => !neu.freigaben.some(x => x.id === f));
            if (weg.length) nein(`Freigabe ${weg.join(', ')} wird noch von Knoten genutzt — erst dort lösen.`, 409);
            setze(neu); geaendert.push(neu.id);
          } else {
            const art = optWahl(e.art, ['paket', 'ablauf', 'landkarte'] as const, 'Art') ?? nein('Art der Vorlage fehlt (Paket oder Ablauf).');
            if (art === 'landkarte' && d.prozesse.some(p => p.art === 'landkarte')) nein('Es gibt schon eine Landkarte — je Instanz genau eine.', 409);
            const id = k.neueId('fp');
            const neu = mischen<ProzessVorlage>({ id, art, titel: '', knoten: [{ id: k.neueId('fk'), titel: teil.titel as string, rang: 1 }], uebergaenge: [], freigaben: [], rollen: [], fassung: 0, herkunft: { art: 'hand', am: k.jetzt }, geaendert: k.jetzt, geaendertVon: k.person }, teil);
            d.prozesse.push(neu); beruehrt.add(id); geaendert.push(id);
          }
          break;
        }
        case 'vorlage-weg': {
          const v = vorlage(o.id);
          standPruefen(o.stand, k.standVon(vorlageKopf(v)), v.id);
          d.prozesse = d.prozesse.filter(p => p.id !== v.id);
          // Verweise der Landkarte und Zuordnungen auf diese Vorlage fallen weg — laufende Fälle tragen ihre eigene Kopie.
          for (const p of d.prozesse) if (p.knoten.some(x => x.verweis === v.id)) setze({ ...p, knoten: p.knoten.map(x => { if (x.verweis !== v.id) return x; const { verweis: _v, ...r } = x; return r; }) });
          for (const [l, z] of Object.entries(d.zuordnung)) if (z.vorlageId === v.id) delete d.zuordnung[l];
          for (const [m, id] of Object.entries(d.marken)) if (m.startsWith('muster:') && id === v.id) delete d.marken[m];
          geaendert.push(v.id);
          break;
        }
        case 'kopie': {
          const v = vorlage(o.id);
          if (v.art === 'landkarte') nein('Die Landkarte lässt sich nicht kopieren.');
          const map = new Map(v.knoten.map(x => [x.id, k.neueId('fk')]));
          const knoten = v.knoten.map(x => ({ ...x, id: map.get(x.id)!, ...(x.elternId ? { elternId: map.get(x.elternId)! } : {}) }));
          // Ablauf → Paket: Phasen werden Ebene 2, Stufen Ebene 3; die Übergänge bleiben im Ablauf (Pakete haben keine).
          const neu: ProzessVorlage = {
            ...v, id: k.neueId('fp'), art: 'paket', titel: `${v.titel}`.slice(0, TEXT_MAX.titel), knoten, uebergaenge: [], form: undefined,
            herkunft: { art: 'hand', am: k.jetzt }, fassung: 1, geaendert: k.jetzt, geaendertVon: k.person,
          };
          delete (neu as Partial<ProzessVorlage>).form;
          d.prozesse.push(neu); beruehrt.add(neu.id); geaendert.push(neu.id);
          break;
        }
        case 'knoten': {
          const v = vorlage(o.vorlageId);
          let handGeordnet = false;
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const teil = knotenTeil(e, v);
          let knoten = v.knoten;
          const alt = typeof e.id === 'string' ? knoten.find(x => x.id === e.id) : undefined;
          if (typeof e.id === 'string' && !alt) nein('Diesen Knoten gibt es nicht (mehr).', 404);
          const vor = e.vor === undefined ? undefined : e.vor === null ? null : typeof e.vor === 'string' ? e.vor : nein('vor: Kennung erwartet.');
          if (alt) {
            standPruefen(o.stand, k.standVon(alt), alt.id);
            let eltern = alt.elternId;
            if (e.elternId !== undefined) {
              if (!alt.elternId) nein('Der oberste Knoten bleibt oben.');
              const ziel = typeof e.elternId === 'string' ? knoten.find(x => x.id === e.elternId) : undefined;
              if (!ziel) nein('Neuer Elternknoten unbekannt.');
              if (teilbaum(alt.id, knoten).includes(ziel!.id)) nein('Ein Knoten kann nicht unter sich selbst hängen.');
              eltern = ziel!.id;
            }
            knoten = knoten.map(x => (x.id === alt.id ? { ...mischen<ProzessKnoten>(x, teil), ...(eltern ? { elternId: eltern } : {}) } : x));
            if (eltern !== alt.elternId) knoten = rangNeu(rangNeu(knoten, alt.elternId), eltern, alt.id, vor ?? null, true);
            else if (vor !== undefined) knoten = rangNeu(knoten, eltern, alt.id, vor);
            // Eine Phase (Ebene 2) von Hand an eine Stelle gesetzt → die Reihenfolge der Phasen gehört ab jetzt der Hand (12.10., ./phasen.ts).
            if (eltern && eltern === wurzelId(v) && (eltern !== alt.elternId || typeof vor === 'string')) handGeordnet = true;
          } else {
            if (!teil.titel) nein('Titel fehlt.');
            const eltern = typeof e.elternId === 'string' ? knoten.find(x => x.id === e.elternId) : undefined;
            if (e.elternId !== undefined && !eltern) nein('Elternknoten unbekannt.');
            if (!eltern && knoten.some(x => !x.elternId)) nein('Neue Knoten hängen unter einem vorhandenen (der oberste Knoten ist schon da).');
            const id = k.neueId('fk');
            const neu = mischen<ProzessKnoten>({ id, titel: '', rang: 9999, ...(eltern ? { elternId: eltern.id } : {}) }, teil);
            knoten = rangNeu([...knoten, neu], eltern?.id, id, vor ?? null, true);
            if (eltern && eltern.id === wurzelId(v) && typeof vor === 'string') handGeordnet = true;
          }
          setze({ ...v, knoten, ...(handGeordnet && v.art === 'paket' ? { phasenVonHand: true as const } : {}) }); geaendert.push(v.id);
          break;
        }
        case 'knoten-weg': {
          const v = vorlage(o.vorlageId);
          const x = v.knoten.find(y => y.id === o.id) ?? nein('Diesen Knoten gibt es nicht (mehr).', 404);
          if (!x.elternId) nein('Der oberste Knoten bleibt — die ganze Vorlage löscht man über „Vorlage löschen“.');
          standPruefen(o.stand, k.standVon(x), x.id);
          const weg = new Set(teilbaum(x.id, v.knoten));
          setze({ ...v, knoten: rangNeu(v.knoten.filter(y => !weg.has(y.id)), x.elternId), uebergaenge: v.uebergaenge.filter(u => !weg.has(u.von) && !weg.has(u.nach)) });
          geaendert.push(v.id);
          break;
        }
        case 'knoten-rang': {
          const v = vorlage(o.vorlageId);
          const x = v.knoten.find(y => y.id === o.id) ?? nein('Diesen Knoten gibt es nicht (mehr).', 404);
          const g = kinderVon(x.elternId, v.knoten);
          const i = g.findIndex(y => y.id === x.id);
          const j = o.richtung === 'hoch' ? i - 1 : o.richtung === 'runter' ? i + 1 : nein('richtung: hoch oder runter.');
          if (j < 0 || j >= g.length) break;
          const reihe = g.map(y => y.id);
          [reihe[i], reihe[j]] = [reihe[j], reihe[i]];
          const rang = new Map(reihe.map((id, n) => [id, n + 1]));
          // Eine Phase (Ebene 2) hoch/runter → die Reihenfolge der Phasen gehört ab jetzt der Hand (12.10., ./phasen.ts).
          const phase = v.art === 'paket' && !!x.elternId && x.elternId === wurzelId(v);
          setze({ ...v, knoten: v.knoten.map(y => (rang.has(y.id) ? { ...y, rang: rang.get(y.id)! } : y)), ...(phase ? { phasenVonHand: true as const } : {}) }); geaendert.push(v.id);
          break;
        }
        case 'uebergang': {
          const v = vorlage(o.vorlageId);
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const art = optWahl(e.art, ['weiter', 'rueckweg', 'ausstieg', 'schleife', 'kreislauf'] as const, 'Art des Übergangs') ?? 'weiter';
          if (typeof e.von !== 'string' || typeof e.nach !== 'string') nein('von und nach fehlen.');
          const u: Uebergang = { von: e.von as string, nach: e.nach as string, art };
          const w = optText(e.weiche, 'kurz', 'Weiche'); if (w) u.weiche = w;
          const b = optWahl(e.beleg, ['quelle', 'ergaenzung'] as const, 'Beleg'); if (b) u.beleg = b;
          setze({ ...v, uebergaenge: [...v.uebergaenge.filter(x => !(x.von === u.von && x.nach === u.nach)), u] }); geaendert.push(v.id);
          break;
        }
        case 'uebergang-weg': {
          const v = vorlage(o.vorlageId);
          setze({ ...v, uebergaenge: v.uebergaenge.filter(x => !(x.von === o.von && x.nach === o.nach)) }); geaendert.push(v.id);
          break;
        }
        case 'baustein': {
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const alt = typeof e.id === 'string' ? d.bausteine.find(b => b.id === e.id) : undefined;
          if (typeof e.id === 'string' && !alt) nein('Diesen Baustein gibt es nicht (mehr).', 404);
          if (alt) standPruefen(o.stand, k.standVon(alt), alt.id);
          const id = alt?.id ?? k.neueId('fb');
          const b = bausteinAusEingabe(e, alt, { id, heute: k.heute, jetzt: k.jetzt, person: k.person });
          if (alt && JSON.stringify(b) === JSON.stringify(alt)) break;
          const neu: Baustein = { ...b, fassung: (alt?.fassung ?? 0) + 1, geaendert: k.jetzt, geaendertVon: k.person, ...(alt?.herkunft?.art === 'import' ? { vonHand: true as const } : {}) };
          if (!alt && d.bausteine.length >= GRENZEN.bausteine) nein(`Bausteine: höchstens ${GRENZEN.bausteine}. Nichts gespeichert.`, 413);
          d.bausteine = alt ? d.bausteine.map(x => (x.id === id ? neu : x)) : [...d.bausteine, neu];
          geaendert.push(id);
          break;
        }
        case 'baustein-weg': {
          const b = d.bausteine.find(x => x.id === o.id) ?? nein('Diesen Baustein gibt es nicht (mehr).', 404);
          standPruefen(o.stand, k.standVon(b), b.id);
          d.bausteine = d.bausteine.filter(x => x.id !== b.id);
          // Knoten auf Ebene 5 mit diesem Baustein fallen aus den Vorlagen (laufende Fälle zeigen „Baustein entfernt“).
          for (const p of d.prozesse) if (p.knoten.some(x => x.bausteinId === b.id)) setze({ ...p, knoten: p.knoten.filter(x => x.bausteinId !== b.id) });
          delete d.marken[markeUrheberGeprueft(b.id)];
          geaendert.push(b.id);
          break;
        }
        case 'recht-geprueft': {
          const b = d.bausteine.find(x => x.id === o.id) ?? nein('Diesen Baustein gibt es nicht (mehr).', 404);
          const notiz = pflichtText(o.notiz, 'notiz', 'Notiz zur Prüfung');
          d.bausteine = d.bausteine.map(x => (x.id === b.id ? { ...x, rechtGeprueft: { am: k.heute, von: k.person, notiz }, geaendert: k.jetzt, geaendertVon: k.person } : x));
          geaendert.push(b.id);
          break;
        }
        case 'urheber-geprueft': {
          const b = d.bausteine.find(x => x.id === o.id) ?? nein('Diesen Baustein gibt es nicht (mehr).', 404);
          if (o.zuruecknehmen === true) delete d.marken[markeUrheberGeprueft(b.id)];
          else d.marken[markeUrheberGeprueft(b.id)] = `${k.heute}|${k.person}`;
          geaendert.push(b.id);
          break;
        }
        case 'ritual': {
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const alt = typeof e.id === 'string' ? d.rituale.find(r => r.id === e.id) : undefined;
          if (typeof e.id === 'string' && !alt) nein('Dieses Ritual gibt es nicht (mehr).', 404);
          if (alt) standPruefen(o.stand, k.standVon(alt), alt.id);
          const titel = e.titel !== undefined || !alt ? pflichtText(e.titel, 'titel', 'Titel') : alt.titel;
          const rhythmus = optWahl(e.rhythmus, RHYTHMEN, 'Rhythmus') ?? alt?.rhythmus ?? nein('Rhythmus fehlt.');
          const dauer = optZahl(e.dauerMin, 5, 600, 'Dauer (Minuten)');
          const agenda = textListe(e.agenda, 'agenda', 'Agenda', 40);
          const teiln = e.teilnehmende === undefined ? undefined : Array.isArray(e.teilnehmende) && e.teilnehmende.every(x => (TEILNEHMENDE as readonly unknown[]).includes(x)) ? Array.from(new Set(e.teilnehmende as RitualVorlage['teilnehmende'])) : nein('Teilnehmende: unbekannter Wert.');
          const neu: RitualVorlage = {
            id: alt?.id ?? k.neueId('fr'), titel, rhythmus, dauerMin: Math.round(dauer ?? alt?.dauerMin ?? 30), agenda: agenda ?? alt?.agenda ?? [],
            teilnehmende: teiln ?? alt?.teilnehmende ?? ['intern'], geaendert: k.jetzt, geaendertVon: k.person,
          };
          d.rituale = alt ? d.rituale.map(r => (r.id === neu.id ? neu : r)) : [...d.rituale, neu];
          geaendert.push(neu.id);
          break;
        }
        case 'ritual-weg': {
          const r = d.rituale.find(x => x.id === o.id) ?? nein('Dieses Ritual gibt es nicht (mehr).', 404);
          d.rituale = d.rituale.filter(x => x.id !== r.id);
          geaendert.push(r.id);
          break;
        }
        case 'zuordnung': {
          const l = typeof o.leistungId === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(o.leistungId) ? o.leistungId : nein('Produkt fehlt.');
          if (k.leistungen && !k.leistungen.includes(l)) nein('Dieses Produkt gibt es im Katalog nicht (mehr).', 404);
          if (o.vorlageId === null || o.vorlageId === '') delete d.zuordnung[l];
          else {
            const v = vorlage(o.vorlageId);
            if (v.art !== 'paket') nein('Einem Produkt wird eine Paket-Vorlage zugeordnet (kein Ablauf, keine Landkarte).');
            d.zuordnung[l] = { vorlageId: v.id };
          }
          geaendert.push(`zuordnung:${l}`);
          break;
        }
        case 'agent-zusatz': {
          const a = typeof o.agent === 'string' && (ANALYSE_AGENTEN as readonly string[]).includes(o.agent) ? o.agent as AnalyseAgentId : nein('Unbekannter Agent.');
          const t = optText(o.text, 'agentZusatz', 'Zusatz-Auftrag');
          if (t) d.agentZusatz[a] = t; else delete d.agentZusatz[a];
          geaendert.push(`agent:${a}`);
          break;
        }
        case 'einstellungen': {
          const f = istObj(o.felder) ? o.felder : nein('felder fehlen.');
          // Kunden-Link-Schalter und Puls-Schwelle haben EINEN Schreibweg: POST /api/fulfillment/kunde { aktion: 'schalter' | 'puls-schwelle' }
          // (C2; Schalter nur Inhaber per Sitzung) — zusammengeführt 11.10. Hier nur der Takt des Onboardings.
          if (f.kundenLink !== undefined || f.pulsSchwelle !== undefined) nein('Kunden-Link und Puls-Schwelle stellst du unter Fall › Kunde & Reports ein (dort gilt: Schalter nur der Inhaber).');
          for (const key of Object.keys(f)) if (!['willkommenStunden', 'nachsorgeTage'].includes(key)) nein(`Unbekannte Einstellung „${key}“.`);
          const w = optZahl(f.willkommenStunden, 1, 168, 'Willkommen (Stunden)'); if (w != null) d.einstellungen.willkommenStunden = Math.round(w);
          if (f.nachsorgeTage !== undefined) {
            if (!Array.isArray(f.nachsorgeTage) || !f.nachsorgeTage.length || f.nachsorgeTage.length > 6 || f.nachsorgeTage.some(x => !Number.isInteger(x) || (x as number) < 1 || (x as number) > 365)) nein('Nachsorge: ein bis sechs Tage zwischen 1 und 365.');
            d.einstellungen.nachsorgeTage = Array.from(new Set(f.nachsorgeTage as number[])).sort((a, b) => a - b);
          }
          geaendert.push('einstellungen');
          break;
        }
        case 'onboarding-aus': {
          const m = typeof o.mandatId === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(o.mandatId) ? o.mandatId : nein('Mandat fehlt.');
          if (o.aus === false) delete d.marken[markeOnboardingAus(m)]; else d.marken[markeOnboardingAus(m)] = k.heute;
          geaendert.push(`onboarding:${m}`);
          break;
        }
        default: nein(`Unbekannte Änderung „${o.op}“.`);
      }
    }
    // Endstand jeder berührten Vorlage prüfen, Fassung zählen.
    d.prozesse = d.prozesse.map(p => {
      if (!beruehrt.has(p.id)) return p;
      vorlageStrukturPruefen(p, d);
      const alt = vorher.get(p.id);
      if (alt === JSON.stringify(p)) return p;
      if (!alt) return { ...p, fassung: Math.max(1, p.fassung), geaendert: k.jetzt, geaendertVon: k.person };
      return { ...p, fassung: (JSON.parse(alt) as ProzessVorlage).fassung + 1, geaendert: k.jetzt, geaendertVon: k.person };
    });
    if (d.prozesse.length > GRENZEN.vorlagen) nein(`Prozess-Vorlagen: höchstens ${GRENZEN.vorlagen}. Nichts gespeichert.`, 413);
    return { datei: d, geaendert: Array.from(new Set(geaendert)) };
  });
}

/** Die Paket-Vorlage eines Produkts (Zuordnung) — oder null. */
export const vorlageFuerProdukt = (d: Pick<VorlagenDatei, 'zuordnung' | 'prozesse'>, leistungId: string | undefined): ProzessVorlage | null => {
  const id = leistungId ? d.zuordnung[leistungId]?.vorlageId : undefined;
  return (id && d.prozesse.find(p => p.id === id && p.art === 'paket')) || null;
};

/** In welchen Paket-Vorlagen steckt ein Baustein? (Bibliothek: „steckt in …“) */
export function vorlagenMitBaustein(d: Pick<VorlagenDatei, 'prozesse'>, bausteinId: string): { id: string; titel: string }[] {
  return d.prozesse.filter(p => p.knoten.some(k => k.bausteinId === bausteinId)).map(p => ({ id: p.id, titel: p.titel }));
}

/** Für den Browser: Stände je Vorlagen-Kopf, Knoten, Baustein und Ritual (nie gespeichert). */
export function mitStaenden(d: VorlagenDatei, standVon: (x: object) => string) {
  return {
    prozesse: d.prozesse.map(p => ({ ...p, stand: standVon(vorlageKopf(p)), knoten: p.knoten.map(x => ({ ...x, stand: standVon(x) })) })),
    bausteine: d.bausteine.map(b => ({ ...b, stand: standVon(b) })),
    rituale: d.rituale.map(r => ({ ...r, stand: standVon(r) })),
  };
}
