// ─── Prozesse — einen Prozess prüfen: speichern, veröffentlichen, aktiv schalten (Etappe B1, 21.10.; ANALYSE_100.md Punkte 6, 10, 43, 45, 53–55, 62) ────
// EINE Stelle, die alle Regeln über einer Definition zusammenführt und ALLE Befunde liefert (die Werkstatt zeigt sie am Knoten):
//   fehler   gegen eine Regel bzw. unlesbar — wird nicht gespeichert (auch nicht als Entwurf); `nurWert` = nur ein eingegebener Wert ist falsch → der
//            Entwurf speichert trotzdem (24.10., „nie Eingaben verlieren“), veröffentlichen nein
//   offen    unvollständig — Entwurf ja, veröffentlichen nein
//   hinweis  nur ein Rat
// `definitionPruefen` (Entwurf und Veröffentlichen), `aktivBefunde` (aktiv schalten: veröffentlicht, Eigner aus dem Team, Start- und Endkriterium, als wer
// der Lauf schreibt). Was nur der Server weiß (Team, Konten, Skills, andere Prozesse, Werkzeug-Bereiche, angebundene Modelle), kommt über `PruefKontext`.
// Rein und client-sicher; Tests: tests/prozesse-modell.test.ts, tests/prozesse-versionen.test.ts.

import {
  ABFRAGE_MIT_TAGEN, BEREICH_IDS, CRM_ABFRAGE_ARTEN, FALL_ART_IDS, FELD_KENNUNG, PROZESS_GRENZEN, PROZESS_TEXT, SCORE_PRUEFUNGEN, TEMPERATUREN, ZETTEL_FARBEN,
  type Befund, type FallArt, type ProzessDefinition, type ProzessEintrag, type ProzessForm, type ProzessKnoten, type ProzessSchnittstelle,
} from './definition';
import { katalogEintrag, maskeSaeubern, platzhalterFuer, type AuswahlQuelle } from './baustein-katalog';
import { agentAus, vertragAus, WARUM_MIN, type AgentKontext } from './agent-schritt';
import { ausloeserAus, datumsFelderFuer, ereignisStartetProzess, FALL_FELDER, webhookFeldSchluessel } from './ausloeser';
import { bedingungenAus } from './bedingung';
import { alleSchritte, flussPruefen, phasen, startKnoten, wurzel } from './fluss';
import { schlossFehlt } from './schloss';
import { modellWahlAus } from './modell-wahl';
import { laufPerson, type TeamKurz } from './rollen';
import { istEreignisArt } from '@/lib/ereignisse/arten';

type K = ProzessKnoten<ProzessForm>;

/** Was nur der Server weiß — ohne Angabe wird nur die Form geprüft. */
export interface PruefKontext extends AgentKontext {
  team?: readonly TeamKurz[];
  /** Speichernamen der Konten des Haushalts. */
  konten?: readonly string[];
  /** Andere Prozesse (Teilprozess, Schleife, Übergabe): veröffentlicht? Schnittstelle? */
  prozess?: (id: string) => { titel: string; veroeffentlicht: boolean; schnittstelle?: ProzessSchnittstelle } | null;
  /** Gültige Werte einer Auswahlquelle (Masken). */
  auswahl?: (q: AuswahlQuelle) => readonly string[] | null;
  /** Arten eines CRM-Vorschlags (lib/zoe/crm-vorschlag.ts `VORSCHLAG_ARTEN`) — feste Werte der CRM-Bausteine. */
  vorschlagArten?: readonly string[];
}

/** Bringt schon der Auslöser fremden Text in den Lauf? (Webhook, neue Mail, neue WhatsApp — „fremd gelesen“ gilt für den ganzen Lauf, Punkt 56.) */
export function laufFremd(d: Pick<ProzessDefinition, 'knoten'>): boolean {
  return startKnoten(d).some(s => s.ausloeser?.art === 'webhook' || (s.ausloeser?.art === 'ereignis' && (s.ausloeser.ereignis === 'neue-mail' || s.ausloeser.ereignis === 'neue-whatsapp')));
}

/** Felder, die eine Raute nach Regel nennen darf: Felder des Falls, des Webhook-Auslösers und die Ausgaben der Agenten-Schritte (`agent.<feld>`). */
export function rautenFelder(d: Pick<ProzessDefinition, 'knoten' | 'fallArt'>): string[] {
  const fall: FallArt = d.fallArt ?? 'mandat';
  const raus = new Set<string>(FALL_FELDER[fall].map(f => f.id));
  for (const s of startKnoten(d)) if (s.ausloeser?.art === 'webhook') for (const f of s.ausloeser.felder) raus.add(webhookFeldSchluessel(f.id));
  for (const k of d.knoten) for (const f of k.agent?.ausgabe ?? []) raus.add(`agent.${f.id}`);
  return Array.from(raus);
}

const b = (stufe: Befund['stufe'], text: string, knotenId?: string, feld?: string): Befund => ({ stufe, text, ...(knotenId ? { knotenId } : {}), ...(feld ? { feld } : {}) });
const ganz = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Die Befunde EINES Knotens (rein). */
export function knotenBefunde(k: K, d: ProzessDefinition, kx: PruefKontext = {}): Befund[] {
  const raus: Befund[] = [];
  const fall: FallArt = d.fallArt ?? 'mandat';
  const titel = `„${k.titel}“`;
  if (k.titel.length > PROZESS_TEXT.titel) raus.push(b('fehler', `${titel}: Titel höchstens ${PROZESS_TEXT.titel} Zeichen.`, k.id));
  // Baustein des Katalogs
  const e = katalogEintrag(k.katalog?.id);
  if (k.katalog && !e) raus.push(b('fehler', `${titel}: diesen Baustein gibt es nicht.`, k.id));
  if (e && e.form !== (k.form ?? 'schritt')) raus.push(b('fehler', `${titel}: der Baustein „${e.name}“ passt nicht zur Form.`, k.id));
  if (e?.fest?.art && kx.vorschlagArten && !kx.vorschlagArten.includes(e.fest.art)) raus.push(b('fehler', `${titel}: Vorschlags-Art „${e.fest.art}“ gibt es nicht.`, k.id));
  if (e && !e.feld) raus.push(...maskeSaeubern(e, k.katalog?.werte, { auswahl: kx.auswahl, platzhalter: platzhalterFuer(fall, webhookFelderVon(d)) }, k.id).befunde);
  // Die Formen mit eigenem Feld
  switch (k.form) {
    case 'ausloeser':
      if (!k.ausloeser) raus.push(b('offen', `${titel}: wie startet der Prozess?`, k.id));
      else raus.push(...ausloeserAus(k.ausloeser, fall, k.id).befunde);
      break;
    case 'agent': {
      if (!k.agent) { raus.push(b('offen', `${titel}: wähle ZOE, einen Head, einen Skill oder einen Fach-Agenten.`, k.id)); break; }
      raus.push(...agentAus(k.agent, kx, k.id).befunde);
      if (e?.agentFest) {
        const w = e.agentFest.wer;
        if (JSON.stringify(k.agent.wer) !== JSON.stringify(w)) raus.push(b('fehler', `${titel}: dieser Baustein arbeitet nur mit ${w.art === 'fach' ? w.agentId : w.art}.`, k.id));
        if (e.agentFest.ergebnis === 'vorschlag' && k.agent.ergebnis !== 'vorschlag') raus.push(b('fehler', `${titel}: das Ergebnis ist hier immer ein Vorschlag.`, k.id));
        if (e.agentFest.ergebnis === 'vorschlag' && !k.agent.vorschlagFelder?.length) raus.push(b('offen', `${titel}: welche Felder soll der Vorschlag füllen?`, k.id, 'vorschlagFelder'));
      }
      break;
    }
    case 'entscheidung': {
      const r = k.raute;
      if (!r) break; // ein Mensch entscheidet
      if (r.art === 'regel') {
        const x = bedingungenAus(r.bedingungen, rautenFelder(d), titel);
        raus.push(...x.befunde.map(y => ({ ...y, knotenId: k.id, feld: 'bedingungen' })));
        if (!r.bedingungen.length) raus.push(b('offen', `${titel}: mindestens eine Bedingung.`, k.id));
      } else if (r.art === 'modell') {
        if (!r.frage.trim()) raus.push(b('offen', `${titel}: die Frage an das Modell fehlt.`, k.id));
        if (r.frage.length > PROZESS_TEXT.frage) raus.push(b('fehler', `${titel}: Frage höchstens ${PROZESS_TEXT.frage} Zeichen.`, k.id));
        if (r.warumKeineRegel.trim().length < WARUM_MIN) raus.push(b('offen', `${titel}: „Warum reicht keine Regel?“ — mindestens ${WARUM_MIN} Zeichen.`, k.id, 'warumKeineRegel'));
        if (!ganz(r.budgetCent, 1, PROZESS_GRENZEN.budgetCentMax)) raus.push(b('offen', `${titel}: Budget 1 bis ${PROZESS_GRENZEN.budgetCentMax} Cent.`, k.id, 'budgetCent'));
        raus.push(...modellWahlAus(r.modellWahl, kx.modelle, k.id).befunde);
        raus.push(b('hinweis', `${titel}: eine Modell-Raute ist eigens markiert — eine Regel über Felder ist billiger und prüfbar.`, k.id));
      } else {
        if (!(SCORE_PRUEFUNGEN as readonly string[]).includes(r.pruefung)) raus.push(b('fehler', `${titel}: unbekannte Score-Prüfung.`, k.id));
        if (fall !== 'lead' && fall !== 'firma') raus.push(b('offen', `${titel}: Score, Temperatur und SQL gibt es nur für Leads (Fall Lead oder Firma).`, k.id));
        if (r.pruefung === 'score' && !ganz(r.schwelle, 0, 100)) raus.push(b('offen', `${titel}: Schwelle 0 bis 100.`, k.id, 'schwelle'));
        if (r.pruefung === 'temperatur' && !(r.temperatur?.length && r.temperatur.every(t => (TEMPERATUREN as readonly string[]).includes(t)))) raus.push(b('offen', `${titel}: welche Temperatur?`, k.id, 'temperatur'));
      }
      break;
    }
    case 'warten': {
      const w = k.warten;
      if (!w) { raus.push(b('offen', `${titel}: wie lange bzw. worauf wird gewartet?`, k.id)); break; }
      if (w.art === 'dauer') {
        if (!ganz(w.tage, 0, PROZESS_GRENZEN.wartenTageMax) || (w.stunden !== undefined && !ganz(w.stunden, 0, 23)) || (w.tage === 0 && !w.stunden)) raus.push(b('offen', `${titel}: Dauer 0 bis ${PROZESS_GRENZEN.wartenTageMax} Tage (und Stunden), nicht null.`, k.id));
      } else {
        // C1 (21.10., M1): beim Warten auf ein Ereignis darf die Obergrenze auch in Stunden stehen (1 bis 720).
        const stunden = w.art === 'ereignis' && w.hoechstensStunden !== undefined;
        if (stunden && !ganz((w as { hoechstensStunden?: number }).hoechstensStunden, 1, PROZESS_GRENZEN.wartenStundenMax)) raus.push(b('offen', `${titel}: Obergrenze 1 bis ${PROZESS_GRENZEN.wartenStundenMax} Stunden.`, k.id, 'hoechstensStunden'));
        else if (!stunden && !ganz(w.hoechstensTage, 1, PROZESS_GRENZEN.wartenTageMax)) raus.push(b('offen', `${titel}: jedes Warten braucht eine Obergrenze (1 bis ${PROZESS_GRENZEN.wartenTageMax} Tage).`, k.id, 'hoechstensTage'));
        if (w.art === 'datum' && !datumsFelderFuer(fall).includes(w.feld)) raus.push(b('offen', `${titel}: dieses Datum gibt es bei diesem Fall nicht.`, k.id));
        if (w.art === 'ereignis') {
          if (!istEreignisArt(w.ereignis) || !ereignisStartetProzess(w.ereignis)) raus.push(b('offen', `${titel}: auf dieses Ereignis kann ein Prozess nicht warten.`, k.id));
          raus.push(...bedingungenAus(w.bedingungen, rautenFelder(d), titel).befunde.map(y => ({ ...y, knotenId: k.id, feld: 'bedingungen' })));
        }
      }
      break;
    }
    case 'schleife': {
      const s = k.schleife;
      if (!s) { raus.push(b('offen', `${titel}: über welche Liste, mit welchem Teilprozess?`, k.id)); break; }
      if (s.liste.startsWith('abfrage:')) {
        const q = d.knoten.find(x => x.id === s.liste.slice(8));
        if (!q?.abfrage) raus.push(b('offen', `${titel}: die CRM-Abfrage gibt es nicht (mehr).`, k.id, 'liste'));
      } else if (!FELD_KENNUNG.test(s.liste)) raus.push(b('offen', `${titel}: welche Liste?`, k.id, 'liste'));
      raus.push(...teilprozessBefunde(s.prozessId, d, kx, titel, k.id));
      if (!ganz(s.hoechstens, 1, PROZESS_GRENZEN.schleifeHoechstens)) raus.push(b('offen', `${titel}: höchstens 1 bis ${PROZESS_GRENZEN.schleifeHoechstens} je Lauf.`, k.id, 'hoechstens'));
      break;
    }
    case 'teilprozess': {
      const t = k.teilprozess;
      if (!t) { raus.push(b('offen', `${titel}: welcher Prozess?`, k.id)); break; }
      raus.push(...teilprozessBefunde(t.prozessId, d, kx, titel, k.id));
      const ziel = kx.prozess?.(t.prozessId);
      if (ziel?.schnittstelle) {
        const ein = ziel.schnittstelle.eingaben;
        for (const key of Object.keys(t.eingaben ?? {})) if (!ein.some(f => f.id === key)) raus.push({ ...b('fehler', `${titel}: „${key}“ ist keine Eingabe von „${ziel.titel}“.`, k.id), nurWert: true });
        for (const f of ein) if (f.pflicht && !t.eingaben?.[f.id]) raus.push(b('offen', `${titel}: die Eingabe „${f.id}“ fehlt.`, k.id));
      }
      break;
    }
    case 'ende':
      if (k.ende?.ergebnis === 'uebergabe') {
        if (!k.ende.uebergabeAn) raus.push(b('offen', `${titel}: an welchen Prozess wird übergeben?`, k.id));
        else if (kx.prozess && !kx.prozess(k.ende.uebergabeAn)) raus.push(b('offen', `${titel}: diesen Prozess gibt es nicht (mehr).`, k.id));
      }
      break;
    default: break;
  }
  // CRM-Abfrage, erneut ab
  if (k.abfrage) {
    const q = k.abfrage;
    if (!(CRM_ABFRAGE_ARTEN as readonly string[]).includes(q.art)) raus.push(b('fehler', `${titel}: unbekannte Abfrage.`, k.id));
    if (!ganz(q.hoechstens, 1, PROZESS_GRENZEN.abfrageHoechstens)) raus.push(b('offen', `${titel}: höchstens 1 bis ${PROZESS_GRENZEN.abfrageHoechstens} Fälle.`, k.id, 'hoechstens'));
    if (ABFRAGE_MIT_TAGEN.includes(q.art) && !ganz(q.tage, 1, 3650)) raus.push(b('offen', `${titel}: seit wie vielen Tagen?`, k.id, 'tage'));
  } else if (e?.feld === 'abfrage') raus.push(b('offen', `${titel}: was soll abgefragt werden?`, k.id));
  if (k.erneut) {
    const ab = d.knoten.find(x => x.id === k.erneut!.ab);
    const reihe = alleSchritte(d).map(x => x.schritt.id);
    if (!ab || ab.form === 'ausloeser' || ab.id === k.id || reihe.indexOf(ab.id) < 0 || reihe.indexOf(ab.id) > reihe.indexOf(k.id)) raus.push(b('offen', `${titel}: ab einem früheren Schritt dieses Prozesses.`, k.id, 'ab'));
    if (!ganz(k.erneut.hoechstens, 1, PROZESS_GRENZEN.erneutHoechstens)) raus.push(b('offen', `${titel}: höchstens 1 bis ${PROZESS_GRENZEN.erneutHoechstens}-mal.`, k.id, 'hoechstens'));
  } else if (e?.feld === 'erneut') raus.push(b('offen', `${titel}: ab welchem Schritt?`, k.id));
  return raus;
}

function teilprozessBefunde(id: string, d: ProzessDefinition, kx: PruefKontext, titel: string, knotenId: string): Befund[] {
  if (id === d.id) return [b('fehler', `${titel}: ein Prozess ruft sich nicht selbst auf.`, knotenId)];
  const p = kx.prozess?.(id);
  if (kx.prozess && !p) return [b('offen', `${titel}: diesen Prozess gibt es nicht (mehr).`, knotenId)];
  if (p && !p.veroeffentlicht) return [b('offen', `${titel}: „${p.titel}“ ist noch nicht veröffentlicht — aufgerufen wird immer die veröffentlichte Version.`, knotenId)];
  return [];
}

const webhookFelderVon = (d: Pick<ProzessDefinition, 'knoten'>): string[] =>
  startKnoten(d).flatMap(s => (s.ausloeser?.art === 'webhook' ? s.ausloeser.felder.map(f => f.id) : []));

/**
 * Alle Befunde einer Definition (rein): Aufbau (eine Wurzel, Phasen, eindeutige Kennungen, Grenzen), Steckbrief (Bereich, Fall, Eigner, Kriterien,
 * Schnittstelle, Zettel), jeder Knoten, der Fluss, Auslöser (mindestens einer, höchstens ein Webhook) und die Freigabe-Schlösser.
 */
export function definitionPruefen(d: ProzessDefinition, kx: PruefKontext = {}): Befund[] {
  const raus: Befund[] = [];
  if (d.art !== 'paket') raus.push(b('fehler', 'Ein Prozess ist ein Ablauf mit Phasen (Art „paket“).'));
  if (!d.titel.trim()) raus.push(b('offen', 'Der Prozess braucht einen Namen.'));
  if (d.titel.length > PROZESS_TEXT.titel) raus.push(b('fehler', `Name höchstens ${PROZESS_TEXT.titel} Zeichen.`));
  if ((d.beschreibung ?? '').length > PROZESS_TEXT.beschreibung) raus.push(b('fehler', `Beschreibung höchstens ${PROZESS_TEXT.beschreibung} Zeichen.`));
  if (!d.bereich || !BEREICH_IDS.includes(d.bereich)) raus.push(b('offen', 'Bereich: Marketing, Sales, Übergabe, Fulfillment, Ausbau, Führung oder Unterstützung.'));
  if (!d.fallArt || !FALL_ART_IDS.includes(d.fallArt)) raus.push(b('offen', 'Woran hängt ein Lauf? (Lead, Deal, Mandat, Event, Firma oder ohne Fall)'));
  for (const [f, n] of [['startKriterium', 'Startkriterium'], ['endKriterium', 'Endkriterium']] as const) if ((d[f] ?? '').length > PROZESS_TEXT.kriterium) raus.push(b('fehler', `${n} höchstens ${PROZESS_TEXT.kriterium} Zeichen.`));
  if (d.eigner && kx.team && !kx.team.some(t => t.id === d.eigner && t.aktiv)) raus.push(b('offen', 'Den Eigner gibt es im Team nicht (mehr).', undefined, 'eigner'));
  if (d.laeuftAls && kx.konten && !kx.konten.includes(d.laeuftAls)) raus.push(b('offen', '„Läuft als“: dieses Konto gibt es im Haushalt nicht (mehr).', undefined, 'laeuftAls'));
  if (d.schnittstelle) {
    raus.push(...vertragAus(d.schnittstelle.eingaben, 'Schnittstelle › Eingaben').befunde, ...vertragAus(d.schnittstelle.ausgaben, 'Schnittstelle › Ausgaben').befunde);
  }
  if ((d.zettel?.length ?? 0) > PROZESS_GRENZEN.zettel) raus.push(b('fehler', `Höchstens ${PROZESS_GRENZEN.zettel} Notiz-Zettel.`));
  for (const z of d.zettel ?? []) {
    if (z.text.length > PROZESS_TEXT.zettel) raus.push(b('fehler', `Ein Notiz-Zettel hat höchstens ${PROZESS_TEXT.zettel} Zeichen.`));
    if (z.farbe && !(ZETTEL_FARBEN as readonly string[]).includes(z.farbe)) raus.push(b('fehler', 'Unbekannte Farbe eines Notiz-Zettels.'));
  }
  // Aufbau
  if (d.knoten.length > PROZESS_GRENZEN.knotenJeProzess) raus.push(b('fehler', `Höchstens ${PROZESS_GRENZEN.knotenJeProzess} Knoten (jetzt ${d.knoten.length}).`));
  const ids = new Set<string>();
  for (const k of d.knoten) { if (ids.has(k.id)) raus.push(b('fehler', `Die Kennung ${k.id} kommt doppelt vor.`, k.id)); ids.add(k.id); }
  const wurzeln = d.knoten.filter(k => !k.elternId || !ids.has(k.elternId));
  if (wurzeln.length !== 1) raus.push(b('fehler', 'Ein Prozess hat genau einen obersten Knoten.'));
  const w = wurzel(d.knoten);
  if (w && w.form) raus.push(b('fehler', 'Der oberste Knoten ist der Prozess selbst — ohne Form.'));
  const ps = phasen(d);
  if (!ps.length) raus.push(b('offen', 'Mindestens eine Phase.'));
  for (const p of ps) if (p.form) raus.push(b('fehler', `„${p.titel}“ ist eine Phase — ohne Form.`, p.id));
  // Knoten, Fluss, Auslöser
  for (const { schritt } of alleSchritte(d)) raus.push(...knotenBefunde(schritt, d, kx));
  raus.push(...flussPruefen(d, PROZESS_GRENZEN.schritteHinweis));
  const starts = startKnoten(d);
  if (!starts.length) raus.push(b('offen', 'Der Prozess braucht einen Auslöser (Startmarke).'));
  if (starts.length > PROZESS_GRENZEN.ausloeserJeProzess) raus.push(b('fehler', `Höchstens ${PROZESS_GRENZEN.ausloeserJeProzess} Auslöser.`));
  if (starts.filter(s => s.ausloeser?.art === 'webhook').length > 1) raus.push(b('fehler', 'Höchstens ein Webhook je Prozess (eine Adresse, ein Schlüssel).'));
  if (schlossFehlt(d, { ...kx, laufFremd: laufFremd(d) })) raus.push(b('fehler', 'Hinter einer Außenwirkung fehlt die Freigabe (Schloss) — bitte speichern, die Regel setzt sie.'));
  return raus;
}

/** Sperrt etwas das Veröffentlichen? (`fehler` oder `offen`) */
export const sperrtVeroeffentlichen = (l: readonly Befund[]): boolean => l.some(x => x.stufe !== 'hinweis');
/**
 * Sperrt etwas das Speichern des Entwurfs? (`fehler` — außer `nurWert`: ein Entwurf speichert auch halb getippte bzw. falsche Werte, Feinschliff 24.10.
 * „nie Eingaben verlieren“; ungültige Form und Größe bleiben gesperrt.)
 */
export const sperrtSpeichern = (l: readonly Befund[]): boolean => l.some(x => x.stufe === 'fehler' && !x.nurWert);

/**
 * Aktiv schalten (Punkt 10): eine veröffentlichte Version ohne Sperre, mit Eigner aus dem Team, Start- und Endkriterium und einer Person, als die der Lauf
 * schreibt (nie Rückfall auf den Inhaber). Liefert die Befunde (leer = darf aktiv werden).
 */
export function aktivBefunde(e: Pick<ProzessEintrag, 'versionen' | 'status'>, kx: PruefKontext = {}): Befund[] {
  const v = e.versionen.at(-1);
  if (!v) return [b('offen', 'Erst veröffentlichen — aktiv läuft nur eine veröffentlichte Version.')];
  if (e.status === 'archiviert') return [b('fehler', 'Ein archivierter Prozess wird nicht aktiv — erst zurückholen.')];
  const d = v.definition;
  const raus = definitionPruefen(d, kx).filter(x => x.stufe !== 'hinweis');
  if (!d.eigner) raus.push(b('offen', 'Ohne Eigner wird kein Prozess aktiv — genau eine verantwortliche Person aus dem Team.', undefined, 'eigner'));
  if (!(d.startKriterium ?? '').trim()) raus.push(b('offen', 'Startkriterium fehlt: wann gehört ein Fall hinein?', undefined, 'startKriterium'));
  if (!(d.endKriterium ?? '').trim()) raus.push(b('offen', 'Endkriterium fehlt: wann ist der Prozess erfüllt?', undefined, 'endKriterium'));
  if (kx.team && kx.konten && !laufPerson(d, kx.team, kx.konten)) raus.push(b('offen', 'Als wer läuft der Prozess? Der Eigner braucht ein Konto — oder „läuft als“ eine Person mit Konto.', undefined, 'laeuftAls'));
  return raus;
}
