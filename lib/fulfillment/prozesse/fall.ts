// ─── Fulfillment · Prozesse — der Fall: Start (Kopie), Änderungen, Vorlagen-Diff (C1, 10.10.; FULFILLMENT_KONZEPT.md 7.2–7.5) ────────
// Ein Fall ist die Ausführung EINER Paket-Vorlage an EINEM Mandat. Beim Start kopiert er die STRUKTUR der Vorlage (Knoten mit Titel, Ziel,
// Ergebnis, Kennzahl, Zuständig, Freigabe, Sichtbarkeit, Phase, Baustein, Rang) und merkt sich Kennung + Fassung — so ändert sich der Plan,
// den der Kunde sieht, nie still, wenn jemand die Vorlage für künftige Kunden verbessert. Lange Texte (Gliederung, Skript, Fragen) liest der
// Fall LIVE aus der Bibliothek über `bausteinId`. Neue Fassung der Vorlage → `vorlagenDiff` zeigt neue/geänderte/entfernte Knoten,
// „Übernehmen“ fügt hinzu und ändert — erledigte oder entfallene Knoten werden nie entfernt.
// Onboarding: unter dem Teilprozess „Onboarding“ (Ebene 3; fehlt er, legt der Start ihn an — als `fk-obt` unter einer Phase „Onboarding“
// bzw. unter der neuen Phase `fk-ob`) stehen die acht Schritte als Einzelschritte (Ebene 4) `fk-ob-*` (`extra`, zählen im Fortschritt mit); ihr
// Stand wird abgeleitet (lib/fulfillment/prozesse/onboarding.ts) — nie von Hand „erledigt“. Unter „Kunden-Playbook“ hängt (Ebene 5) das
// Playbook-Formular der Bibliothek (`fk-obf-playbook`, `bausteinId`) — das füllt der Kunde über seinen Link bzw. wir gemeinsam im Kick-off
// (Paket C2 liest Formulare NUR aus Knoten mit `bausteinId`; zusammengeführt 11.10.).
// Alle Änderungen über `fallAnwenden(fall, ops, kontext)` (rein, alles oder nichts); geschrieben wird in lib/fulfillment/prozesse/fall-server.ts.

import type { AnwendenErgebnis, Fall, FallKnoten, KnotenStatus, ProzessKnoten, ProzessVorlage, Stakeholder, Entscheidung, Mitschrift, WertKontoEintrag, Vereinbarung } from '../typen';
import { GRENZEN } from '../grenzen';
import { ebeneVon, inReihenfolge, kinderVon, teilbaum, EBENEN_MAX } from '../regeln';
import { MUSTER_BEFAEHIGUNG, MUSTER_ONBOARDING } from '../muster';
import { OB_PRAEFIX, obKnotenId, obSchluessel } from './onboarding';
import { ausfuehren, istObj, mischen, nein, optBool, optTag, optText, optWahl, optZahl, pflichtText, standPruefen, titelForm } from './pruefen';
import { tagPlus } from '@/lib/kalender/zeit';

/** Felder, die beim Start aus der Vorlage kopiert werden (7.2). */
export const STRUKTUR_FELDER = ['elternId', 'titel', 'rang', 'ziel', 'ergebnis', 'kennzahl', 'zustaendig', 'freigabe', 'kundeSichtbar', 'phaseId', 'bausteinId', 'dauerTage'] as const;
/** Felder, die ein Diff vergleicht (ohne Rang — die Reihenfolge darf der Fall behalten). */
const DIFF_FELDER = STRUKTUR_FELDER.filter(f => f !== 'rang');

const kopie = (k: ProzessKnoten): FallKnoten => {
  const x: Record<string, unknown> = { id: k.id, status: 'offen' };
  for (const f of STRUKTUR_FELDER) if (k[f] !== undefined) x[f] = k[f];
  return x as unknown as FallKnoten;
};

export interface StartEingabe {
  mandatId: string; vorlage: ProzessVorlage; person: string; jetzt: string;
  /** Starttag (YYYY-MM-DD) — Fälligkeiten der Phasen zählen ab hier (`dauerTage` hintereinander). */
  start: string;
  /** Bis wann die Willkommensmail raus sein soll (Unterschrift + 24 h, Tag) — Fälligkeit des ersten Schritts. */
  willkommenBis?: string;
  /** Kennung des Kunden-Playbooks in der Bibliothek (`playbookBaustein`) — hängt als Formular unter dem Schritt „Kunden-Playbook“. */
  playbookId?: string;
  neueId: (p: string) => string;
}
/** Teilprozess, den der Start anlegt, wenn die Vorlage keinen „Onboarding“-Knoten auf Ebene 3 hat (die Schritte stehen immer auf Ebene 4). */
export const OB_TEIL_ID = 'fk-obt';
/** Der Formular-Knoten (Ebene 5) unter „Kunden-Playbook“. */
export const OB_PLAYBOOK_FORMULAR_ID = 'fk-obf-playbook';

/** Den Fall anlegen: Struktur-Kopie + Onboarding-Schritte + Befähigungs-Kriterien (Vorgabe, je Fall änderbar). */
export function fallStarten(e: StartEingabe): Fall {
  const v = e.vorlage;
  let knoten = inReihenfolge(v.knoten).map(kopie);
  // Fälligkeiten der Phasen (Ebene 2) hintereinander ab Start.
  let tag = e.start;
  for (const p of kinderVon(knoten.find(k => !k.elternId)?.id, knoten)) {
    if (!p.dauerTage) continue;
    tag = tagPlus(tag, p.dauerTage);
    knoten = knoten.map(k => (k.id === p.id ? { ...k, faelligAm: tag } : k));
  }
  // Onboarding: ein Knoten (Ebene 2 oder 3), der „Onboarding“ heißt — bevorzugt einer ohne eigene Schritte (bei „Vorlauf / Onboarding“ mit dem
  // Unterschritt „Onboarding“ also der Unterschritt) —, sonst eine neue Phase ganz vorn. Die acht Schritte kommen hinter vorhandene.
  const wurzel = knoten.find(k => !k.elternId);
  const passend = knoten.filter(k => { const eb = ebeneVon(k, knoten); return (eb === 2 || eb === 3) && titelForm(k.titel).split(' ').includes('onboarding'); });
  let container = passend.find(k => kinderVon(k.id, knoten).length === 0) ?? passend[0];
  if (!container && wurzel) {
    container = { id: 'fk-ob', elternId: wurzel.id, titel: 'Onboarding', rang: 0, status: 'offen', extra: true, kundeSichtbar: true };
    knoten = [...knoten, container].map(k => (k.elternId === wurzel.id ? { ...k, rang: k.id === 'fk-ob' ? 1 : k.rang + 1 } : k));
  }
  // Die Schritte stehen auf Ebene 4 (Einzelschritt) — liegt der Container auf Ebene 2, kommt ein Teilprozess dazwischen. Nur so kann das
  // Playbook-Formular (ein Baustein, Ebene 5) unter „Kunden-Playbook“ hängen.
  if (container && ebeneVon(container, knoten) === 2 && !knoten.some(k => k.id.startsWith(OB_PRAEFIX) && k.elternId)) {
    const teil: FallKnoten = { id: OB_TEIL_ID, elternId: container.id, titel: 'Onboarding-Schritte', rang: kinderVon(container.id, knoten).length + 1, status: 'offen', extra: true, kundeSichtbar: true };
    knoten = [...knoten, teil];
    container = teil;
  }
  if (container && ebeneVon(container, knoten) < EBENEN_MAX - 1 && !knoten.some(k => k.id.startsWith(OB_PRAEFIX) && k.elternId)) {
    const c = container;
    const vorhanden = kinderVon(c.id, knoten).length;
    MUSTER_ONBOARDING.forEach((s, i) => {
      knoten.push({
        id: obKnotenId(s.schluessel), elternId: c.id, titel: s.titel, rang: vorhanden + i + 1, status: 'offen', extra: true, zustaendig: s.zustaendig,
        ...(s.freigabe ? { freigabe: s.freigabe } : {}), ...(s.schluessel === 'willkommen' && e.willkommenBis ? { faelligAm: e.willkommenBis } : {}),
        ...(s.schluessel === 'playbook' ? { kundeSichtbar: true } : {}),
      });
    });
    const pb = knoten.find(k => k.id === obKnotenId('playbook'));
    if (e.playbookId && pb && ebeneVon(pb, knoten) === EBENEN_MAX - 1) {
      // Nicht „für Kunden sichtbar“ als Schritt — der Kunde sieht das Formular selbst (C2), im Zeitstrahl steht der Schritt „Kunden-Playbook“.
      knoten.push({ id: OB_PLAYBOOK_FORMULAR_ID, elternId: pb.id, titel: 'Kunden-Playbook (Formular)', rang: 1, status: 'offen', extra: true, bausteinId: e.playbookId });
    }
  }
  return {
    mandatId: e.mandatId, vorlageId: v.id, vorlageFassung: v.fassung, gestartetAm: e.jetzt, gestartetVon: e.person, status: 'onboarding',
    knoten, freigaben: {}, onboarding: {}, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {},
    befaehigung: MUSTER_BEFAEHIGUNG.map((text, i) => ({ id: `bf-${i + 1}`, text, erfuellt: false })),
    marken: {}, geaendert: e.jetzt, geaendertVon: e.person,
    // Phasen der Vorlage von Hand geordnet (12.10.) → der Fall behält diese Reihenfolge (sonst ordnet der Säuberer nach ./phasen.ts).
    ...(v.phasenVonHand ? { phasenVonHand: true as const } : {}),
  };
}

// ── Vorlagen-Diff (7.2) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface VorlagenDiff { von: number; nach: number; neu: { id: string; titel: string }[]; geaendert: { id: string; titel: string; felder: string[] }[]; entfernt: { id: string; titel: string }[] }

/** Was sich an der Vorlage seit dem Start (bzw. der letzten Übernahme) geändert hat — null, wenn nichts. */
export function vorlagenDiff(fall: Pick<Fall, 'knoten' | 'vorlageFassung'>, v: ProzessVorlage): VorlagenDiff | null {
  if (v.fassung <= fall.vorlageFassung) return null;
  const imFall = new Map(fall.knoten.map(k => [k.id, k]));
  const inVorlage = new Set(v.knoten.map(k => k.id));
  const neu = inReihenfolge(v.knoten).filter(k => !imFall.has(k.id)).map(k => ({ id: k.id, titel: k.titel }));
  const geaendert = v.knoten.filter(k => imFall.has(k.id)).map(k => {
    const f = imFall.get(k.id)!;
    const felder = DIFF_FELDER.filter(x => JSON.stringify(k[x] ?? null) !== JSON.stringify((f as unknown as Record<string, unknown>)[x] ?? null));
    return { id: k.id, titel: k.titel, felder };
  }).filter(x => x.felder.length);
  const entfernt = fall.knoten.filter(k => !k.extra && !inVorlage.has(k.id)).map(k => ({ id: k.id, titel: k.titel }));
  return { von: fall.vorlageFassung, nach: v.fassung, neu, geaendert, entfernt };
}

/** Die neue Fassung übernehmen: neue Knoten dazu (nur unter vorhandenen Eltern), Felder geänderter Knoten übernehmen, nichts entfernen. */
export function vorlageUebernehmen(fall: Fall, v: ProzessVorlage, jetzt: string, person: string): Fall {
  let knoten = [...fall.knoten];
  for (const k of inReihenfolge(v.knoten)) {
    const da = knoten.find(x => x.id === k.id);
    if (!da) {
      if (k.elternId && !knoten.some(x => x.id === k.elternId)) continue;
      knoten.push(kopie(k));
      continue;
    }
    const neu: Record<string, unknown> = { ...da };
    for (const f of DIFF_FELDER) {
      if (f === 'elternId' && (!k.elternId || !knoten.some(x => x.id === k.elternId) || teilbaum(da.id, knoten).includes(k.elternId))) continue;
      if (k[f] === undefined) delete neu[f]; else neu[f] = k[f];
    }
    knoten = knoten.map(x => (x.id === da.id ? neu as unknown as FallKnoten : x));
  }
  if (knoten.some(k => ebeneVon(k, knoten) > EBENEN_MAX)) knoten = fall.knoten; // nie eine kaputte Struktur übernehmen
  return { ...fall, knoten, vorlageFassung: v.fassung, geaendert: jetzt, geaendertVon: person };
}

// ── Änderungen am Fall ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FallKontext {
  person: string; jetzt: string; heute: string;
  standVon: (x: object) => string;
  neueId: (praefix: 'fs' | 'fe' | 'fn' | 'fq' | 'fx' | 'fk' | 'bf') => string;
  /** Ziele des Mandats (Mandat.ziele) — das Wert-Konto nur für diese. */
  ziele: readonly { id: string; ziel?: string }[];
  /** Darf dieser Kontakt als Stakeholder eingetragen werden? (Kartei, Art. 18 eingeschränkte fehlen.) */
  kontaktErlaubt: (id: string) => boolean;
  /** Ritual-Vorlagen der Bibliothek (Kennungen). */
  ritualIds: readonly string[];
  /** Freigabepunkte der Vorlage (Kennungen) — dazu jede Freigabe, die ein Knoten des Falls trägt. */
  freigaben: readonly string[];
}

const KNOTEN_STATUS: readonly KnotenStatus[] = ['offen', 'in_arbeit', 'wartet_kunde', 'erledigt', 'entfaellt'];
const ROLLEN = ['entscheider', 'unterstuetzer', 'skeptiker', 'nutzer', 'einkauf', 'sponsor'] as const;
const WIE = ['kickoff', 'mail', 'link', 'termin'] as const;
const AN = ['gruender', 'entscheider', 'vertrieb'] as const;
const VEREINBARUNG = ['rollen', 'reaktionszeiten', 'wirBrauchen', 'eskalation', 'scopeDrin', 'scopeDraussen', 'entscheidungsrechte'] as const;

export type FallOp = { op: string } & Record<string, unknown>;

/**
 * Änderungen an EINEM Fall — alles oder nichts. Ops: knoten-status · knoten-extra · freigabe · vereinbarung · stakeholder · entscheidung ·
 * ritual-merken · mitschrift · quickwins-setzen · quickwin · kickoff-fragen · kickoff-frage · wert-ziel · wert-messung · befaehigung ·
 * willkommen-gesendet · fall-status (Formen im Kopf von app/api/fulfillment/fall/route.ts und in CLAUDE.md › Fulfillment).
 */
export function fallAnwenden(fall0: Fall, opsRoh: unknown, k: FallKontext): AnwendenErgebnis<Fall> {
  return ausfuehren(() => {
    if (!Array.isArray(opsRoh) || !opsRoh.length) return nein('ops: mindestens eine Änderung.');
    if (opsRoh.length > GRENZEN.opsJeAnfrage) return nein(`Höchstens ${GRENZEN.opsJeAnfrage} Änderungen je Anfrage. Nichts gespeichert.`, 413);
    const f: Fall = JSON.parse(JSON.stringify(fall0));
    const geaendert: string[] = [];
    const knoten = (id: unknown): FallKnoten => f.knoten.find(x => x.id === id) ?? nein('Diesen Schritt gibt es im Fall nicht (mehr).', 404);
    const setzeKnoten = (n: FallKnoten) => { f.knoten = f.knoten.map(x => (x.id === n.id ? n : x)); geaendert.push(n.id); };
    const freigabenErlaubt = new Set([...k.freigaben, ...f.knoten.map(x => x.freigabe).filter((x): x is string => !!x)]);
    const erledigen = (n: FallKnoten): FallKnoten => ({ ...n, status: 'erledigt', seit: k.heute, erledigtAm: k.heute, erledigtVon: k.person });

    for (const roh of opsRoh) {
      if (!istObj(roh) || typeof roh.op !== 'string') nein('Jede Änderung braucht „op“.');
      const o = roh as FallOp;
      switch (o.op) {
        case 'knoten-status': {
          const n = knoten(o.id);
          standPruefen(o.stand, k.standVon(n), n.id);
          let neu: FallKnoten = { ...n };
          const status = optWahl(o.status, KNOTEN_STATUS, 'Status');
          if (status && status !== n.status) {
            if (status === 'erledigt' && obSchluessel(n.id)) nein('Dieser Onboarding-Schritt wird abgeleitet — er wird erledigt, sobald das Dazugehörige da ist.');
            if (status === 'erledigt' && n.freigabe) nein(`Dieser Schritt endet mit der Freigabe ${n.freigabe} — bitte „Freigabe vermerken“.`);
            if (status === 'entfaellt' && !(typeof o.grund === 'string' && o.grund.trim())) nein('„Entfällt“ braucht einen Grund.');
            const { erledigtAm: _a, erledigtVon: _b, grund: _g, ...rest } = n;
            neu = status === 'erledigt' ? erledigen(n) : { ...rest, status, seit: k.heute };
            if (status === 'entfaellt') neu.grund = pflichtText(o.grund, 'notiz', 'Grund');
          }
          const fa = optTag(o.faelligAm, 'Fällig am');
          if (fa !== undefined) { if (fa === null) delete neu.faelligAm; else neu.faelligAm = fa; }
          if (JSON.stringify(neu) !== JSON.stringify(n)) setzeKnoten(neu);
          // Takt ab einem Ereignis (Prüf-Fund 11.10., Messe-Nachfasstakt Tag 1/3/7/14/30): wird ein Knoten erledigt, bekommen die offenen
          // Einzelschritte des NÄCHSTEN Geschwisters mit `dauerTage` und ohne Fälligkeit `faelligAm` = Tag der Erledigung + dauerTage
          // („Während der Messe“ erledigt → „Nach der Messe“: Nachfassen am Tag 1, 3, 7, 14, 30). Gesetzte Fälligkeiten bleiben.
          if (neu.status === 'erledigt' && n.status !== 'erledigt') {
            const geschwister = kinderVon(n.elternId, f.knoten);
            const naechstes = geschwister[geschwister.findIndex(x => x.id === n.id) + 1];
            if (naechstes) for (const s of kinderVon(naechstes.id, f.knoten)) {
              if (s.dauerTage && !s.faelligAm && s.status === 'offen') setzeKnoten({ ...s, faelligAm: tagPlus(k.heute, s.dauerTage) });
            }
          }
          break;
        }
        case 'knoten-extra': {
          if (o.weg === true) {
            const n = knoten(o.id);
            if (!n.extra || obSchluessel(n.id) || n.id === 'fk-ob' || n.id === OB_TEIL_ID || n.id === OB_PLAYBOOK_FORMULAR_ID) nein('Nur eigene Zusatz-Schritte lassen sich entfernen — Schritte der Vorlage entfallen mit Grund.');
            const weg = new Set(teilbaum(n.id, f.knoten));
            f.knoten = f.knoten.filter(x => !weg.has(x.id)); geaendert.push(n.id);
            break;
          }
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const alt = typeof e.id === 'string' ? f.knoten.find(x => x.id === e.id) : undefined;
          if (typeof e.id === 'string' && !alt) nein('Diesen Schritt gibt es im Fall nicht (mehr).', 404);
          if (alt) {
            standPruefen(o.stand, k.standVon(alt), alt.id);
            if (!alt.extra || obSchluessel(alt.id)) nein('Schritte der Vorlage ändert man in der Vorlage (danach „Vorlage übernehmen“).');
          }
          const teil: Record<string, unknown> = {};
          if (e.titel !== undefined || !alt) teil.titel = pflichtText(e.titel, 'titel', 'Titel');
          for (const [x, feld] of [['ziel', 'ziel'], ['ergebnis', 'ergebnis'], ['kennzahl', 'kurz']] as const) { const t = optText(e[x], feld, x); if (t !== undefined) teil[x] = t; }
          const z = optWahl(e.zustaendig, ['intern', 'kunde', 'beide'] as const, 'Zuständig'); if (z !== undefined) teil.zustaendig = z;
          const ks = optBool(e.kundeSichtbar, 'Für Kunden sichtbar'); if (ks !== undefined) teil.kundeSichtbar = ks;
          const fa = optTag(e.faelligAm, 'Fällig am'); if (fa !== undefined) teil.faelligAm = fa;
          if (alt) { setzeKnoten(mischen(alt, teil)); break; }
          const eltern = typeof e.elternId === 'string' ? f.knoten.find(x => x.id === e.elternId) : undefined;
          if (!eltern) nein('Ein Zusatz-Schritt hängt unter einem vorhandenen Schritt.');
          if (ebeneVon(eltern!, f.knoten) >= EBENEN_MAX - 1) nein('Zusatz-Schritte gehen bis Ebene 4 (Einzelschritt).');
          const id = k.neueId('fk');
          const n = mischen<FallKnoten>({ id, elternId: eltern!.id, titel: '', rang: kinderVon(eltern!.id, f.knoten).length + 1, status: 'offen', extra: true }, teil);
          f.knoten.push(n); geaendert.push(id);
          break;
        }
        case 'freigabe': {
          const id = typeof o.id === 'string' && freigabenErlaubt.has(o.id) ? o.id : nein('Diese Freigabe kennt der Fall nicht.');
          if (o.zuruecknehmen === true) {
            delete f.freigaben[id];
            for (const n of f.knoten.filter(x => x.freigabe === id && x.status === 'erledigt')) { const { erledigtAm: _a, erledigtVon: _b, ...r } = n; setzeKnoten({ ...r, status: 'offen', seit: k.heute }); }
            geaendert.push(`freigabe:${id}`);
            break;
          }
          const kunde = o.kunde === undefined || o.kunde === null ? undefined : istObj(o.kunde)
            ? { wie: optWahl(o.kunde.wie, WIE, 'Freigabe: wie') ?? nein('Freigabe: wie bestätigt (Kick-off, Mail, Link, Termin)?'), am: optTag(o.kunde.am, 'Freigabe: am') ?? k.heute }
            : nein('kunde: { wie, am }.');
          const notiz = optText(o.notiz, 'notiz', 'Notiz');
          f.freigaben[id] = { am: k.heute, von: k.person, ...(kunde ? { kunde } : {}), ...(notiz ? { notiz } : {}) };
          for (const n of f.knoten.filter(x => x.freigabe === id && x.status !== 'erledigt' && x.status !== 'entfaellt')) setzeKnoten(erledigen(n));
          geaendert.push(`freigabe:${id}`);
          break;
        }
        case 'vereinbarung': {
          const alt = f.vereinbarung ?? {};
          standPruefen(o.stand, k.standVon(alt), 'vereinbarung');
          const fe = istObj(o.felder) ? o.felder : nein('felder fehlen.');
          const teil: Record<string, unknown> = {};
          for (const x of VEREINBARUNG) { const t = optText(fe[x], 'ergebnis', x); if (t !== undefined) teil[x] = t; }
          const am = optTag(fe.bestaetigtAm, 'Bestätigt am'); if (am !== undefined) teil.bestaetigtAm = am;
          const wie = optWahl(fe.bestaetigtWie, ['kickoff', 'mail', 'termin'] as const, 'Bestätigt wie'); if (wie !== undefined) teil.bestaetigtWie = wie;
          const neu = mischen<Vereinbarung>(alt, teil);
          if (neu.bestaetigtAm && !neu.bestaetigtWie) nein('Wie wurde die Vereinbarung bestätigt (Kick-off, Mail, Termin)?');
          f.vereinbarung = neu; geaendert.push('vereinbarung');
          break;
        }
        case 'stakeholder': {
          if (o.weg === true) {
            const s = f.stakeholder.find(x => x.id === o.id) ?? nein('Diesen Eintrag gibt es nicht (mehr).', 404);
            standPruefen(o.stand, k.standVon(s), s.id);
            f.stakeholder = f.stakeholder.filter(x => x.id !== s.id); geaendert.push(s.id);
            break;
          }
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const alt = typeof e.id === 'string' ? f.stakeholder.find(x => x.id === e.id) : undefined;
          if (typeof e.id === 'string' && !alt) nein('Diesen Eintrag gibt es nicht (mehr).', 404);
          if (alt) standPruefen(o.stand, k.standVon(alt), alt.id);
          const kontaktId = e.kontaktId === undefined && alt ? alt.kontaktId : typeof e.kontaktId === 'string' && k.kontaktErlaubt(e.kontaktId) ? e.kontaktId : nein('Stakeholder sind Kontakte der Kartei — diese Person gibt es nicht oder sie ist eingeschränkt (Art. 18).');
          if (f.stakeholder.some(x => x.kontaktId === kontaktId && x.id !== alt?.id)) nein('Diese Person steht schon auf der Stakeholder-Karte.', 409);
          const rolle = optWahl(e.rolle, ROLLEN, 'Rolle') ?? alt?.rolle ?? nein('Rolle fehlt.');
          const einfluss = e.einfluss === undefined ? alt?.einfluss ?? 2 : e.einfluss === 1 || e.einfluss === 2 || e.einfluss === 3 ? e.einfluss : nein('Einfluss: 1, 2 oder 3.');
          const teil: Record<string, unknown> = { kontaktId, rolle, einfluss };
          const h = optWahl(e.haltung, ['positiv', 'neutral', 'kritisch'] as const, 'Haltung'); if (h !== undefined) teil.haltung = h;
          const n = optText(e.notiz, 'notiz', 'Notiz'); if (n !== undefined) teil.notiz = n;
          const neu = mischen<Stakeholder>(alt ?? { id: k.neueId('fs'), kontaktId, rolle, einfluss }, teil);
          f.stakeholder = alt ? f.stakeholder.map(x => (x.id === neu.id ? neu : x)) : [...f.stakeholder, neu];
          geaendert.push(neu.id);
          break;
        }
        case 'entscheidung': {
          if (o.weg === true) {
            const x = f.entscheidungen.find(y => y.id === o.id) ?? nein('Diesen Eintrag gibt es nicht (mehr).', 404);
            f.entscheidungen = f.entscheidungen.filter(y => y.id !== x.id); geaendert.push(x.id);
            break;
          }
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const alt = typeof e.id === 'string' ? f.entscheidungen.find(x => x.id === e.id) : undefined;
          if (typeof e.id === 'string' && !alt) nein('Diesen Eintrag gibt es nicht (mehr).', 404);
          if (alt) standPruefen(o.stand, k.standVon(alt), alt.id);
          const teil: Record<string, unknown> = {};
          if (e.titel !== undefined || !alt) teil.titel = pflichtText(e.titel, 'titel', 'Titel');
          const inhalt = optText(e.inhalt, 'ergebnis', 'Inhalt'); if (inhalt !== undefined) teil.inhalt = inhalt;
          const st = optWahl(e.status, ['offen', 'entschieden', 'verworfen'] as const, 'Status'); if (st) teil.status = st;
          const wer = optWahl(e.wer, ['intern', 'kunde', 'beide'] as const, 'Wer entscheidet'); if (wer) teil.wer = wer;
          const fr = optTag(e.frist, 'Frist'); if (fr !== undefined) teil.frist = fr;
          const ge = optBool(e.geteilt, 'Mit dem Kunden geteilt'); if (ge !== undefined && ge !== null) teil.geteilt = ge;
          const neu = mischen<Entscheidung>(alt ?? { id: k.neueId('fe'), am: k.heute, titel: '', status: 'offen', wer: 'intern', geteilt: false, von: k.person }, teil);
          f.entscheidungen = alt ? f.entscheidungen.map(x => (x.id === neu.id ? neu : x)) : [...f.entscheidungen, neu];
          geaendert.push(neu.id);
          break;
        }
        case 'ritual-merken': {
          const ritualId = typeof o.ritualId === 'string' && k.ritualIds.includes(o.ritualId) ? o.ritualId : nein('Dieses Ritual gibt es in der Bibliothek nicht (mehr).', 404);
          const uid = typeof o.terminUid === 'string' && /^[^\u0000-\u001f\u007f]{1,300}$/.test(o.terminUid) ? o.terminUid : nein('Kennung des Termins fehlt.');
          const da = f.rituale.find(r => r.ritualId === ritualId);
          if (da?.terminUids.includes(uid)) break;
          f.rituale = da ? f.rituale.map(r => (r.ritualId === ritualId ? { ...r, terminUids: [...r.terminUids, uid].slice(-50) } : r)) : [...f.rituale, { ritualId, terminUids: [uid], angelegtAm: k.heute }];
          geaendert.push(`ritual:${ritualId}`);
          break;
        }
        case 'mitschrift': {
          if (o.weg === true) {
            const x = f.mitschriften.find(y => y.id === o.id) ?? nein('Diese Mitschrift gibt es nicht (mehr).', 404);
            f.mitschriften = f.mitschriften.filter(y => y.id !== x.id); geaendert.push(x.id);
            break;
          }
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const ritualId = e.ritualId === undefined || e.ritualId === null || e.ritualId === '' ? undefined : typeof e.ritualId === 'string' && k.ritualIds.includes(e.ritualId) ? e.ritualId : nein('Ritual unbekannt.');
          const m: Mitschrift = {
            id: k.neueId('fn'), am: optTag(e.am, 'Am') ?? k.heute,
            anlass: pflichtText(e.anlass, 'notiz', 'Anlass'), ergebnis: pflichtText(e.ergebnis, 'notiz', 'Ergebnis'), naechster: pflichtText(e.naechster, 'notiz', 'Nächster Schritt'),
            von: k.person, ...(ritualId ? { ritualId } : {}),
          };
          const fr = optTag(e.frist, 'Frist'); if (fr) m.frist = fr;
          f.mitschriften.push(m); geaendert.push(m.id);
          break;
        }
        case 'quickwins-setzen': {
          const l = Array.isArray(o.quickWins) ? o.quickWins : nein('quickWins: Liste erwartet.');
          if (l.length > 20) nein('Höchstens 20 Quick Wins auf einmal.', 413);
          for (const [i, x] of l.entries()) {
            if (!istObj(x)) nein(`Quick Win ${i + 1}: Objekt erwartet.`);
            const text = pflichtText(x.text, 'kurz', `Quick Win ${i + 1}`);
            if (f.quickWins.some(q => q.text.toLowerCase() === text.toLowerCase())) continue;
            const bis = optTag(x.bis, `Quick Win ${i + 1}: bis`) ?? tagPlus(f.gestartetAm.slice(0, 10), 30);
            f.quickWins.push({ id: k.neueId('fq'), text, bis, quelle: x.quelle === 'analyse' ? 'analyse' : 'hand' });
          }
          geaendert.push('quickwins');
          break;
        }
        case 'quickwin': {
          const q = f.quickWins.find(x => x.id === o.id) ?? nein('Diesen Quick Win gibt es nicht (mehr).', 404);
          if (o.weg === true) f.quickWins = f.quickWins.filter(x => x.id !== q.id);
          else {
            const er = optBool(o.erledigt, 'Erledigt');
            const bis = optTag(o.bis, 'Bis');
            f.quickWins = f.quickWins.map(x => {
              if (x.id !== q.id) return x;
              const { erledigtAm: _e, ...r } = x;
              return { ...(er === true ? { ...r, erledigtAm: x.erledigtAm ?? k.heute } : er === false ? r : x), ...(bis ? { bis } : {}) };
            });
          }
          geaendert.push(q.id);
          break;
        }
        case 'kickoff-fragen': {
          const l = Array.isArray(o.fragen) ? o.fragen : nein('fragen: Liste erwartet.');
          if (l.length > 40) nein('Höchstens 40 Fragen auf einmal.', 413);
          for (const [i, x] of l.entries()) {
            if (!istObj(x)) nein(`Frage ${i + 1}: Objekt erwartet.`);
            const frage = pflichtText(x.frage, 'frage', `Frage ${i + 1}`);
            if (f.kickoffFragen.some(q => q.frage.toLowerCase() === frage.toLowerCase())) continue;
            const warum = optText(x.warum, 'kurz', `Frage ${i + 1}: warum`);
            f.kickoffFragen.push({ id: k.neueId('fx'), frage, an: optWahl(x.an, AN, `Frage ${i + 1}: an`) ?? 'entscheider', quelle: x.quelle === 'analyse' ? 'analyse' : 'hand', ...(warum ? { warum } : {}) });
          }
          if (f.kickoffFragen.length > 200) nein('Höchstens 200 Kick-off-Fragen je Fall.', 413);
          geaendert.push('kickoff-fragen');
          break;
        }
        case 'kickoff-frage': {
          const q = f.kickoffFragen.find(x => x.id === o.id) ?? nein('Diese Frage gibt es nicht (mehr).', 404);
          if (o.weg === true) f.kickoffFragen = f.kickoffFragen.filter(x => x.id !== q.id);
          else f.kickoffFragen = f.kickoffFragen.map(x => { if (x.id !== q.id) return x; const { erledigt: _e, ...r } = x; return o.erledigt === true ? { ...r, erledigt: true as const } : r; });
          geaendert.push(q.id);
          break;
        }
        case 'wert-ziel': {
          const z = k.ziele.find(x => x.id === o.zielId) ?? nein('Dieses Ziel steht nicht (mehr) am Mandat.', 404);
          const alt = f.wertKonto[z.id] ?? { messungen: [] };
          standPruefen(o.stand, k.standVon(alt), z.id);
          const fe = istObj(o.felder) ? o.felder : nein('felder fehlen.');
          const teil: Record<string, unknown> = {};
          const ag = optText(fe.ausgang, 'kurz', 'Ausgang'); if (ag !== undefined) teil.ausgang = ag;
          for (const [x, name] of [['ausgangZahl', 'Ausgangswert'], ['zielZahl', 'Zielwert']] as const) { const n = optZahl(fe[x], -1e12, 1e12, name); if (n !== undefined) teil[x] = n; }
          const eh = optText(fe.einheit, 'titel', 'Einheit'); if (eh !== undefined) teil.einheit = eh && eh.length > 20 ? nein('Einheit: höchstens 20 Zeichen.', 413) : eh;
          const ri = optWahl(fe.richtung, ['hoch', 'runter'] as const, 'Richtung'); if (ri !== undefined) teil.richtung = ri;
          const bis = optTag(fe.zielBis, 'Ziel bis'); if (bis !== undefined) teil.zielBis = bis;
          let neu = mischen<WertKontoEintrag>(alt, teil);
          if (fe.festlegen === true) {
            const fehlt = [!(neu.ausgangZahl !== undefined || neu.ausgang) && 'Ausgangslage', !(neu.zielZahl !== undefined || z.ziel) && 'Zielwert', !neu.zielBis && 'Datum'].filter(Boolean);
            if (fehlt.length) nein(`Zum Festlegen fehlt noch: ${fehlt.join(', ')}.`);
            neu = { ...neu, festgelegtAm: neu.festgelegtAm ?? k.heute };
          } else if (fe.festlegen === false) { const { festgelegtAm: _f, ...r } = neu; neu = r as WertKontoEintrag; }
          if (neu.ausgangZahl !== undefined && neu.zielZahl !== undefined && neu.zielZahl !== neu.ausgangZahl && !neu.richtung) neu.richtung = neu.zielZahl > neu.ausgangZahl ? 'hoch' : 'runter';
          f.wertKonto[z.id] = neu; geaendert.push(`wert:${z.id}`);
          break;
        }
        case 'wert-messung': {
          const z = k.ziele.find(x => x.id === o.zielId) ?? nein('Dieses Ziel steht nicht (mehr) am Mandat.', 404);
          const alt = f.wertKonto[z.id] ?? { messungen: [] };
          const am = optTag(o.am, 'Am') ?? k.heute;
          if (am > k.heute) nein('Eine Messung liegt nie in der Zukunft.');
          if (o.weg === true) { f.wertKonto[z.id] = { ...alt, messungen: alt.messungen.filter(m => m.am !== am) }; geaendert.push(`wert:${z.id}`); break; }
          const wert = optZahl(o.wert, -1e12, 1e12, 'Messwert');
          if (wert == null) nein('Messwert fehlt.');
          // Messwerte trägt nur MAKE ein (Entscheidung 10.10.) — es gibt keinen Kunden-Eingabeweg; Quelle immer „hand“.
          const messungen = [...alt.messungen.filter(m => m.am !== am), { am, wert: wert as number, quelle: 'hand' as const }].sort((a, b) => (a.am < b.am ? -1 : 1));
          f.wertKonto[z.id] = { ...alt, messungen }; geaendert.push(`wert:${z.id}`);
          break;
        }
        case 'befaehigung': {
          if (o.weg === true) { const x = f.befaehigung.find(y => y.id === o.id) ?? nein('Dieses Kriterium gibt es nicht (mehr).', 404); f.befaehigung = f.befaehigung.filter(y => y.id !== x.id); geaendert.push(x.id); break; }
          const alt = typeof o.id === 'string' ? f.befaehigung.find(y => y.id === o.id) : undefined;
          if (typeof o.id === 'string' && !alt) nein('Dieses Kriterium gibt es nicht (mehr).', 404);
          const text = o.text !== undefined || !alt ? pflichtText(o.text, 'kurz', 'Kriterium') : alt.text;
          const er = optBool(o.erfuellt, 'Erfüllt');
          const erfuellt = er === undefined || er === null ? alt?.erfuellt ?? false : er;
          const x = { id: alt?.id ?? k.neueId('bf'), text, erfuellt, ...(erfuellt ? { am: alt?.erfuellt ? alt.am ?? k.heute : k.heute } : {}) };
          f.befaehigung = alt ? f.befaehigung.map(y => (y.id === x.id ? x : y)) : [...f.befaehigung, x];
          if (f.befaehigung.length > 30) nein('Höchstens 30 Befähigungs-Kriterien.', 413);
          geaendert.push(x.id);
          break;
        }
        case 'willkommen-gesendet': {
          if (o.zuruecknehmen === true) { f.onboarding = {}; geaendert.push('willkommen'); break; }
          if (f.onboarding.willkommenGesendetAm) break;
          f.onboarding = { willkommenGesendetAm: k.jetzt, willkommenVon: k.person };
          geaendert.push('willkommen');
          break;
        }
        case 'fall-status': {
          const st = optWahl(o.status, ['laeuft', 'pausiert', 'abgeschlossen'] as const, 'Status') ?? nein('Status fehlt.');
          f.status = st; geaendert.push('status');
          break;
        }
        default: nein(`Unbekannte Änderung „${o.op}“.`);
      }
    }
    if (!geaendert.length) return { datei: fall0, geaendert: [] };
    return { datei: { ...f, geaendert: k.jetzt, geaendertVon: k.person }, geaendert: Array.from(new Set(geaendert)) };
  });
}
