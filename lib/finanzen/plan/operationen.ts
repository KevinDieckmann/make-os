// ─── Finanzplanung jetzt — Änderungen als Operationen (rein, getestet) ───────
// Konzept § 6.3: Nie das ganze Dokument zurückschreiben („der Letzte gewinnt“),
// sondern kleine Schritte mit Stand-Prüfung. Der Browser schickt
//   { basisStand, ops: [{ pfad, alt?, neu?, feld? }] }
// Der Server prüft basisStand gegen den gespeicherten Stand (sonst 409), wendet
// die Schritte IN der Schreibsperre an, schreibt Protokoll (wer/wann/feld/alt/
// neu) und die Zellen-Meta (wer hat eine Planzelle zuletzt geändert) und
// vergibt einen neuen Stand. Rückgängig hält die Oberfläche lokal — die
// Gegenoperation ist einfach { pfad, neu: alt }.
//
// Pfad-Grammatik (an JSON Pointer angelehnt, „/“ trennt, weil Zellen-Schlüssel
// wie „p.b.miete:3“ Punkte und Doppelpunkte tragen):
//   /plan/p.b.miete:3          Zelle setzen (neu) oder zurücksetzen (neu fehlt)
//   /fokus/schritte/id=st1/erledigt   Element einer Liste über seine Kennung
//   /fokus/schritte/-          anhängen (neu = der neue Eintrag)
//   /fokus/schritte/id=st1     Element entfernen (neu fehlt)
//   /regeln/rewe               Regel merken → wirkt rückwirkend auf alle Buchungen
//                              dieses Empfängers (lerneRegel im Rechenkern)
//   /planszenarien/id=ps1/bausteine/id=b1/preis   Szenario-Baukasten (27.09.)
//   /arbeitsplan               Kennung des Planszenarios, das als Arbeitsplan gilt (oder null)
//   /steuern/ug/zeilen/kst/satz   Welche Steuern gelten (02.10., lib/finanzen/steuern.ts) — wird nach jeder Änderung bereinigt
//   /planszenarien/id=ps1/annahmen/steuern/ug/…   dieselben Felder nur für ein Szenario (Überlagerung, ebenso bereinigt)
//   /schwellen/runwayWarnMonate   eigene Ampel-Schwellen (02.10., lib/finanzen/schwellen.ts)
// Nicht änderbar: version, stand, monate, historie, meta, protokoll.

import type { Aenderung, FinanzDaten, Szenario } from '@/lib/finanzen/rechenkern';
import { lerneRegel } from '@/lib/finanzen/rechenkern';
import { pruefePlanszenarien } from '@/lib/finanzen/szenarien';
import { pruefeSteuern } from '@/lib/finanzen/steuern';
import { pruefeSchwellen } from '@/lib/finanzen/schwellen';
import { KAL, istUnterseite } from './hilfen';

import { localDay } from '@/lib/zeit';
export interface Operation {
  pfad: string;
  /** Wert vorher — für Protokoll und Rückgängig; der Server nimmt den echten Vorwert, wenn er ihn kennt. */
  alt?: unknown;
  /** Wert nachher. Fehlt er, wird der Schlüssel bzw. das Listenelement entfernt. */
  neu?: unknown;
  /** Lesbarer Name fürs Protokoll („Miete · Nov 26“); sonst der Pfad. */
  feld?: string;
}

export const MAX_OPS = 500;
const MAX_TEXT = 4000;
const MAX_WERT_JSON = 40_000;
const PROTOKOLL_MAX = 500;
const GESPERRT = new Set(['version', 'stand', 'monate', 'historie', 'meta', 'protokoll']);
const ERLAUBT = new Set(['aktiv', 'schulden', 'abschluesse', 'einstellungen', 'buchungen', 'regeln', 'ziele', 'check', 'notizen', 'annahmen', 'sachkosten', 'privatEinnahmen', 'privatBudget', 'privatSchulden', 'szenarien', 'selbst', 'posten', 'fokus', 'plan', 'ist', 'planszenarien', 'arbeitsplan', 'steuern', 'schwellen']);
const GEFAEHRLICH = new Set(['__proto__', 'constructor', 'prototype']);

export class OperationUngueltig extends Error {}

export function pfadTeile(pfad: string): string[] {
  if (typeof pfad !== 'string' || !pfad.startsWith('/') || pfad.length > 300) throw new OperationUngueltig(`Pfad unbrauchbar: ${String(pfad).slice(0, 60)}`);
  const teile = pfad.slice(1).split('/');
  if (!teile.length || teile.some(t => t === '' || GEFAEHRLICH.has(t))) throw new OperationUngueltig(`Pfad unbrauchbar: ${pfad}`);
  if (GESPERRT.has(teile[0])) throw new OperationUngueltig(`„${teile[0]}“ ändert nur der Server.`);
  if (!ERLAUBT.has(teile[0])) throw new OperationUngueltig(`Unbekannter Bereich „${teile[0]}“.`);
  return teile;
}

/** Wert prüfen: endlich, nicht zu groß, keine Funktionen. */
function pruefeWert(v: unknown, pfad: string): void {
  if (v === undefined || v === null) return;
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new OperationUngueltig(`Keine Zahl bei ${pfad}.`); return; }
  if (typeof v === 'string') { if (v.length > MAX_TEXT) throw new OperationUngueltig(`Text zu lang bei ${pfad}.`); return; }
  if (typeof v === 'boolean') return;
  if (typeof v === 'object') {
    const text = JSON.stringify(v);
    if (text.length > MAX_WERT_JSON) throw new OperationUngueltig(`Wert zu groß bei ${pfad}.`);
    if (/__proto__|"constructor"|"prototype"/.test(text)) throw new OperationUngueltig(`Wert unbrauchbar bei ${pfad}.`);
    return;
  }
  throw new OperationUngueltig(`Wert unbrauchbar bei ${pfad}.`);
}

type Beliebig = Record<string, unknown>;
const istObjekt = (v: unknown): v is Beliebig => !!v && typeof v === 'object' && !Array.isArray(v);

/** Ein Listenelement über „id=…“ oder Index finden. */
function listenIndex(liste: unknown[], teil: string): number {
  if (teil.startsWith('id=')) { const id = teil.slice(3); return liste.findIndex(e => istObjekt(e) && e.id === id); }
  const i = Number(teil);
  return Number.isInteger(i) && i >= 0 && i < liste.length ? i : -1;
}

/** Wert an einem Pfad lesen — undefined, wenn es ihn nicht gibt. */
export function lies(doc: unknown, teile: string[]): unknown {
  let o: unknown = doc;
  for (const t of teile) {
    if (Array.isArray(o)) { const i = listenIndex(o, t); if (i < 0) return undefined; o = o[i]; }
    else if (istObjekt(o)) o = o[t];
    else return undefined;
  }
  return o;
}

/** Setzt oder entfernt einen Wert. Ändert `doc` an Ort und Stelle (der Aufrufer arbeitet auf einer Kopie). */
export function setze(doc: Beliebig, teile: string[], neu: unknown): void {
  let o: unknown = doc;
  for (let i = 0; i < teile.length - 1; i++) {
    const t = teile[i];
    if (Array.isArray(o)) { const k = listenIndex(o, t); if (k < 0) throw new OperationUngueltig(`Eintrag „${t}“ gibt es nicht mehr.`); o = o[k]; }
    else if (istObjekt(o)) {
      if (!(t in o) || o[t] == null) {
        if (neu === undefined) return; // löschen, was es nicht gibt: nichts zu tun
        // Fehlende Zwischenstufe anlegen — eine Liste, wenn der nächste Schritt ein Listenschritt ist (z. B. ereignisse/-).
        const n = teile[i + 1];
        o[t] = n === '-' || n.startsWith('id=') || /^\d+$/.test(n) ? [] : {};
      }
      o = o[t];
    } else throw new OperationUngueltig(`Pfad führt ins Leere: ${teile.slice(0, i + 1).join('/')}`);
  }
  const letzter = teile[teile.length - 1];
  if (Array.isArray(o)) {
    if (letzter === '-') { if (neu === undefined) throw new OperationUngueltig('Anhängen ohne Wert.'); o.push(neu); return; }
    const k = listenIndex(o, letzter);
    if (k < 0) { if (neu === undefined) return; throw new OperationUngueltig(`Eintrag „${letzter}“ gibt es nicht mehr.`); }
    if (neu === undefined) o.splice(k, 1); else o[k] = neu;
    return;
  }
  if (!istObjekt(o) || letzter === '-' || letzter.startsWith('id=')) throw new OperationUngueltig('Pfad führt ins Leere.');
  if (neu === undefined) delete o[letzter]; else o[letzter] = neu;
}

const kurz = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') { const t = JSON.stringify(v); return t.length > 120 ? `${t.slice(0, 117)}…` : t; }
  return String(v);
};

export interface Angewandt {
  dokument: FinanzDaten;
  protokoll: Aenderung[];
  /** Zellen-Meta, das sich geändert hat (Schlüssel → wer/wann oder null = entfernt). */
  meta: Record<string, { wer: string; wann: string } | null>;
  /** Der Server hat über die Schritte hinaus geändert (Regel rückwirkend) — der Browser lädt neu. */
  nachladen: boolean;
}

/**
 * Operationen auf eine KOPIE des Dokuments anwenden. Wirft OperationUngueltig,
 * wenn ein Schritt nicht passt — dann wird nichts geschrieben.
 */
export function wendeOperationenAn(doc: FinanzDaten, ops: Operation[], person: string, jetzt: string): Angewandt {
  if (!Array.isArray(ops) || !ops.length) throw new OperationUngueltig('Keine Änderungen.');
  if (ops.length > MAX_OPS) throw new OperationUngueltig(`Höchstens ${MAX_OPS} Schritte auf einmal.`);
  const d = JSON.parse(JSON.stringify(doc)) as FinanzDaten;
  const protokoll: Aenderung[] = [];
  const meta: Angewandt['meta'] = {};
  let nachladen = false;
  for (const op of ops) {
    if (!op || typeof op !== 'object') throw new OperationUngueltig('Schritt unbrauchbar.');
    const teile = pfadTeile(op.pfad);
    pruefeWert(op.neu, op.pfad);
    const feld = typeof op.feld === 'string' && op.feld.trim() ? op.feld.trim().slice(0, 160) : op.pfad;
    // Regel merken: Empfänger → Planzeile, rückwirkend (Cockpit-Logik aus dem Rechenkern).
    if (teile[0] === 'regeln' && teile.length === 2) {
      const k = teile[1].toLowerCase();
      if (op.neu === undefined) {
        const alt = d.regeln[k];
        delete d.regeln[k];
        protokoll.push({ wer: person, wann: jetzt, feld, alt: kurz(alt), neu: 'Regel entfernt' });
        continue;
      }
      if (typeof op.neu !== 'string' || !op.neu) throw new OperationUngueltig('Eine Regel braucht eine Planzeile.');
      const n = lerneRegel(d, k, op.neu);
      if (n) nachladen = true;
      protokoll.push({ wer: person, wann: jetzt, feld, alt: kurz(op.alt), neu: `${op.neu} · Regel gemerkt, ${n} Buchungen angepasst` });
      continue;
    }
    if (teile[0] === 'aktiv') {
      if (teile.length !== 1 || typeof op.neu !== 'string' || !d.szenarien.some(s => s.id === op.neu)) throw new OperationUngueltig('Dieses Szenario gibt es nicht.');
    }
    if (teile[0] === 'szenarien' && teile.length === 2 && op.neu === undefined && d.szenarien.length <= 1) throw new OperationUngueltig('Das letzte Szenario bleibt.');
    if (teile[0] === 'arbeitsplan') {
      if (teile.length !== 1) throw new OperationUngueltig('Arbeitsplan ist eine Kennung.');
      if (op.neu !== undefined && op.neu !== null && (typeof op.neu !== 'string' || !(d.planszenarien ?? []).some(s => s.id === op.neu))) throw new OperationUngueltig('Dieses Planszenario gibt es nicht.');
    }
    if (teile[0] === 'planszenarien' && teile.length === 2 && teile[1] === '-') {
      const n = op.neu;
      if (!istObjekt(n) || typeof n.id !== 'string' || (d.planszenarien ?? []).some(s => s.id === n.id)) throw new OperationUngueltig('Ein neues Planszenario braucht eine freie Kennung.');
    }
    const alt = lies(d, teile);
    if (alt === undefined && op.neu === undefined) continue; // nichts zu tun, nichts zu protokollieren
    setze(d as unknown as Beliebig, teile, op.neu);
    // Wer hat diese Planzelle zuletzt angefasst?
    if (teile[0] === 'plan' && teile.length === 2) {
      if (op.neu === undefined) { delete d.meta[teile[1]]; meta[teile[1]] = null; }
      else { d.meta[teile[1]] = { wer: person, wann: jetzt }; meta[teile[1]] = { wer: person, wann: jetzt }; }
    }
    protokoll.push({ wer: person, wann: jetzt, feld, alt: kurz(alt !== undefined ? alt : op.alt), neu: op.neu === undefined ? 'zurückgesetzt' : kurz(op.neu) });
  }
  // Steuerprofil und Schwellen bereinigen (Sätze begrenzen, Unbekanntes verwerfen); leer = Schlüssel entfernen.
  if (ops.some(o => typeof o.pfad === 'string' && (o.pfad.startsWith('/steuern') || o.pfad.startsWith('/schwellen')))) {
    const st = pruefeSteuern(d.steuern), sw = pruefeSchwellen(d.schwellen);
    if (st) d.steuern = st; else delete d.steuern;
    if (sw) d.schwellen = sw; else delete d.schwellen;
  }
  // Steuer-Überlagerungen der Szenarien (`annahmen.steuern`) ebenso bereinigen.
  if (ops.some(o => typeof o.pfad === 'string' && o.pfad.startsWith('/planszenarien') && o.pfad.includes('/annahmen/steuern'))) {
    for (const ps of d.planszenarien ?? []) { if (!ps.annahmen?.steuern) continue; const st = pruefeSteuern(ps.annahmen.steuern); if (st) ps.annahmen.steuern = st; else delete ps.annahmen.steuern; }
  }
  // Die Netto-Tabelle muss rechenbar bleiben: mindestens zwei Paare, Brutto aufsteigend.
  if (ops.some(o => typeof o.pfad === 'string' && o.pfad.startsWith('/annahmen/nettoTabelle')) && !nettoTabelleOk(d.annahmen.nettoTabelle)) throw new OperationUngueltig('Die Netto-Tabelle braucht mindestens zwei Paare, Brutto von unten nach oben.');
  // Ein gelöschtes Szenario darf nicht aktiv bleiben.
  if (!d.szenarien.length) throw new OperationUngueltig('Ohne Szenario keine Planung.');
  if (!d.szenarien.some(s => s.id === d.aktiv)) d.aktiv = d.szenarien[0].id;
  // Ein gelöschtes Planszenario darf nicht Arbeitsplan bleiben; ein gelöschter Treiber zieht seine Planszenarien auf den aktiven.
  if (d.arbeitsplan && !(d.planszenarien ?? []).some(s => s.id === d.arbeitsplan)) d.arbeitsplan = null;
  for (const ps of d.planszenarien ?? []) if (!d.szenarien.some(s => s.id === ps.basis)) ps.basis = d.aktiv;
  d.protokoll = [...protokoll.slice().reverse(), ...(Array.isArray(d.protokoll) ? d.protokoll : [])].slice(0, PROTOKOLL_MAX);
  return { dokument: d, protokoll, meta, nachladen };
}

/** Brutto → Netto: mindestens zwei Paare, endlich, Brutto streng aufsteigend (sonst teilt `netto()` durch null). */
export function nettoTabelleOk(t: unknown): boolean {
  if (!Array.isArray(t) || t.length < 2) return false;
  for (let i = 0; i < t.length; i++) {
    const p = t[i];
    if (!Array.isArray(p) || p.length !== 2 || !zahl(p[0]) || !zahl(p[1]) || p[0] < 0 || p[1] < 0) return false;
    if (i > 0 && !(p[0] > (t[i - 1] as number[])[0])) return false;
  }
  return true;
}

/** Neuer Stand: Zeitstempel, immer größer als der alte (auch bei zwei Schreibungen in derselben Millisekunde). */
export function neuerStand(alt: string | undefined, jetzt = new Date()): string {
  const s = jetzt.toISOString();
  if (!alt || s > alt) return s;
  const t = Date.parse(alt);
  return Number.isFinite(t) ? new Date(t + 1).toISOString() : s;
}

// ── Dokument prüfen (Import) ─────────────────────────────────────────────────

export type Pruefung = { ok: true; dokument: FinanzDaten } | { ok: false; fehler: string };

const zahl = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const liste = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const objekt = (v: unknown): Beliebig => (istObjekt(v) ? v : {});

const PFLICHT_ANNAHMEN = ['kevinBrutto', 'kevinAb', 'malinBrutto', 'malinAb', 'agAnteil', 'stammkapital', 'gruendungskosten', 'darlehenKevin', 'darlehenRueckMonat', 'retainerVerzug', 'astarnaProvision', 'steuerUG', 'ust', 'steuerMonat', 'holdingKosten', 'holdingAb', 'kdvStart', 'bjoernBetrag', 'bjoernRate', 'bjoernRateVon', 'bjoernRateBis', 'bjoernSchluss', 'bjoernSchlussMonat', 'bjoernZinsMonat', 'bjoernZinsDeckel', 'exitSteuer'];

/** Die Annahmen ohne gelöschte Altfelder (`ruecklage5a`) — alles andere bleibt, wie es ist. */
function annahmenOhneAlt(a: Record<string, unknown>): FinanzDaten['annahmen'] {
  const { ruecklage5a: _alt, ...rest } = a;
  return rest as unknown as FinanzDaten['annahmen'];
}

function pruefeSzenario(s: unknown, i: number): string | null {
  if (!istObjekt(s)) return `Szenario ${i + 1} ist kein Objekt.`;
  if (typeof s.id !== 'string' || !s.id || typeof s.name !== 'string') return `Szenario ${i + 1}: id und name fehlen.`;
  const l = objekt(s.ob);
  if (!zahl(l.betrag) || !zahl(l.start) || !zahl(l.laufzeit)) return `Szenario „${s.name}“: ob (betrag/start/laufzeit) fehlt.`;
  if (!Array.isArray(s.retainer) || s.retainer.some(r => !istObjekt(r) || !zahl(r.betrag) || !zahl(r.start) || !zahl(r.laufzeit))) return `Szenario „${s.name}“: retainer unvollständig.`;
  for (const k of ['astarna', 'events', 'erhoehung', 'unterstuetzung']) { const a = objekt(s[k]); if (!zahl(a.betrag) || !zahl(a.ab)) return `Szenario „${s.name}“: ${k} (betrag/ab) fehlt.`; }
  for (const k of ['exit1', 'exit2']) { const e = objekt(s[k]); if (!zahl(e.betrag) || !zahl(e.monat)) return `Szenario „${s.name}“: ${k} (betrag/monat) fehlt.`; }
  return null;
}

/**
 * Format strikt prüfen: version 3, szenarien als Array, annahmen als Objekt,
 * Zeitachse passend zum Rechenkern (Historie Jan–Sep 26, Plan ab Okt 26).
 * Fehlende Nebenlisten werden leer ergänzt — sie kommen aus der Arbeit.
 */
export function pruefeDokument(roh: unknown): Pruefung {
  if (!istObjekt(roh)) return { ok: false, fehler: 'Die Datei enthält kein Objekt.' };
  if (roh.version !== 3) return { ok: false, fehler: `Version ${String(roh.version)} passt nicht — erwartet wird das Finanzmodul v3.` };
  if (!Array.isArray(roh.szenarien) || !roh.szenarien.length) return { ok: false, fehler: 'szenarien fehlt oder ist leer.' };
  if (!istObjekt(roh.annahmen)) return { ok: false, fehler: 'annahmen fehlt.' };
  for (let i = 0; i < roh.szenarien.length; i++) { const f = pruefeSzenario(roh.szenarien[i], i); if (f) return { ok: false, fehler: f }; }
  const a = roh.annahmen;
  for (const k of PFLICHT_ANNAHMEN) if (!zahl(a[k])) return { ok: false, fehler: `annahmen.${k} fehlt oder ist keine Zahl.` };
  const nt = a.nettoTabelle;
  if (!Array.isArray(nt) || nt.length < 2 || nt.some(p => !Array.isArray(p) || p.length !== 2 || !zahl(p[0]) || !zahl(p[1]))) return { ok: false, fehler: 'annahmen.nettoTabelle braucht mindestens zwei Paare [brutto, netto].' };
  const monate = liste<string>(roh.monate).filter(x => typeof x === 'string');
  const historie = liste<string>(roh.historie).filter(x => typeof x === 'string');
  if (monate.length < 15 || monate.length > 60) return { ok: false, fehler: 'monate: der Rechenkern erwartet 15 bis 60 Planmonate ab Okt 26.' };
  if (historie.length !== 9) return { ok: false, fehler: 'historie: der Rechenkern erwartet neun IST-Monate (Jan–Sep 26).' };
  const e = objekt(roh.einstellungen);
  const heute = typeof e.heute === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.heute) ? e.heute : localDay();
  const szenarien = roh.szenarien as Szenario[];
  const aktiv = typeof roh.aktiv === 'string' && szenarien.some(s => s.id === roh.aktiv) ? roh.aktiv : szenarien[0].id;
  // Szenario-Baukasten (27.09.): ältere Dokumente haben keinen — dann leer, Arbeitsplan null.
  const planszenarien = pruefePlanszenarien(roh.planszenarien, szenarien.map(s => s.id));
  const arbeitsplan = typeof roh.arbeitsplan === 'string' && planszenarien.some(s => s.id === roh.arbeitsplan) ? roh.arbeitsplan : null;
  const s = objekt(roh.selbst);
  const c = objekt(roh.check);
  const f = objekt(roh.fokus);
  const dokument: FinanzDaten = {
    version: 3,
    stand: typeof roh.stand === 'string' && roh.stand ? roh.stand : heute,
    monate, aktiv, planszenarien, arbeitsplan,
    ...(pruefeSteuern(roh.steuern) ? { steuern: pruefeSteuern(roh.steuern) } : {}),
    ...(pruefeSchwellen(roh.schwellen) ? { schwellen: pruefeSchwellen(roh.schwellen) } : {}),
    schulden: liste(roh.schulden),
    meta: objekt(roh.meta) as FinanzDaten['meta'],
    abschluesse: liste(roh.abschluesse),
    historie,
    einstellungen: { heute, reserveMonate: zahl(e.reserveMonate) ? e.reserveMonate : 1 },
    buchungen: liste(roh.buchungen),
    regeln: objekt(roh.regeln) as Record<string, string>,
    ziele: liste(roh.ziele),
    check: { punkte: liste<string>(c.punkte), eintraege: liste(c.eintraege) },
    notizen: objekt(roh.notizen) as Record<string, string>,
    // `ruecklage5a` (Kern-Umbau 02.10. gelöscht, war ohne Wirkung) wird beim Lesen ignoriert — nie abstürzen, nie mitschreiben.
    annahmen: annahmenOhneAlt(a),
    sachkosten: liste(roh.sachkosten), privatEinnahmen: liste(roh.privatEinnahmen), privatBudget: liste(roh.privatBudget), privatSchulden: liste(roh.privatSchulden),
    szenarien,
    selbst: { posten: liste(s.posten), vorsorge: zahl(s.vorsorge) ? s.vorsorge : 0, sonderausgaben: zahl(s.sonderausgaben) ? s.sonderausgaben : 0, sicherheit: zahl(s.sicherheit) ? s.sicherheit : 0, darlehenAnUG: zahl(s.darlehenAnUG) ? s.darlehenAnUG : 0, consorsAbloesung: zahl(s.consorsAbloesung) ? s.consorsAbloesung : 0, kontoStart: zahl(s.kontoStart) ? s.kontoStart : 0 },
    posten: liste(roh.posten),
    fokus: { saetze: liste<string>(f.saetze), regeln: liste<string>(f.regeln), schritte: liste(f.schritte), ...(typeof f.entscheidung === 'string' ? { entscheidung: f.entscheidung } : {}) },
    plan: objekt(roh.plan) as Record<string, number>, ist: objekt(roh.ist) as Record<string, number>,
    protokoll: liste(roh.protokoll),
  };
  return { ok: true, dokument };
}

// ── Leer beginnen ────────────────────────────────────────────────────────────

const CHECK_PUNKTE = ['Neue Buchungen zugeordnet', 'Töpfe im Rahmen', 'Rechnungen gestellt und Eingänge geprüft', 'Zahlungen der nächsten 14 Tage gedeckt', 'Eine Entscheidung festgehalten'];

/** Monatslabels „Okt 26“ … ab Kalendermonat (1–12) und Jahr. */
export function monatsLabels(vonJahr: number, vonMonat: number, anzahl: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < anzahl; i++) { const idx = vonMonat - 1 + i; out.push(`${KAL[idx % 12]} ${String(vonJahr + Math.floor(idx / 12)).slice(2)}`); }
  return out;
}

/**
 * Ein leeres, rechenbares Dokument: Zeitachse wie der Rechenkern, alle Annahmen
 * null, ein Szenario „Basis“. Die Netto-Tabelle ist ein Platzhalter (Netto =
 * Brutto), bis Kevin und Malin die echte eintragen.
 */
export function leeresDokument(heute: string): FinanzDaten {
  return {
    version: 3, stand: heute, monate: monatsLabels(2026, 10, 27), aktiv: 'basis', planszenarien: [], arbeitsplan: null,
    schulden: [], meta: {}, abschluesse: [], historie: monatsLabels(2026, 1, 9),
    einstellungen: { heute, reserveMonate: 1 },
    buchungen: [], regeln: {}, ziele: [], check: { punkte: CHECK_PUNKTE, eintraege: [] }, notizen: {},
    annahmen: {
      kevinBrutto: 0, kevinAb: 1, malinBrutto: 0, malinAb: 1, agAnteil: 0.2, stammkapital: 0, gruendungskosten: 0, darlehenKevin: 0, darlehenRueckMonat: 0,
      retainerVerzug: 0, astarnaProvision: 0, steuerUG: 0.3, ust: 0.19, steuerMonat: 6, holdingKosten: 0, holdingAb: 99, kdvStart: 0,
      bjoernBetrag: 0, bjoernRate: 0, bjoernRateVon: 0, bjoernRateBis: 0, bjoernSchluss: 0, bjoernSchlussMonat: 0, bjoernZinsMonat: 0, bjoernZinsDeckel: 0,
      exitSteuer: 0, nettoTabelle: [[0, 0], [1, 1]], gehaltTag: 28,
    },
    sachkosten: [], privatEinnahmen: [], privatBudget: [], privatSchulden: [],
    szenarien: [{ id: 'basis', name: 'Basis', ob: { betrag: 0, start: 0, laufzeit: 0 }, retainer: [], astarna: { betrag: 0, ab: 0 }, events: { betrag: 0, ab: 0 }, erhoehung: { betrag: 0, ab: 0 }, unterstuetzung: { betrag: 0, ab: 0 }, exit1: { betrag: 0, monat: 0 }, exit2: { betrag: 0, monat: 0 }, bjoernAbloesen: false, ereignisse: [] }],
    selbst: { posten: [], vorsorge: 0, sonderausgaben: 0, sicherheit: 0, darlehenAnUG: 0, consorsAbloesung: 0, kontoStart: 0 },
    posten: [], fokus: { saetze: [], regeln: [], schritte: [] }, plan: {}, ist: {}, protokoll: [],
  };
}

/** Ist die Netto-Tabelle nur der Platzhalter? Dann zeigt die Seite den Hinweis „Netto = Brutto“. */
export const nettoTabellePlatzhalter = (d: Pick<FinanzDaten, 'annahmen'>): boolean => d.annahmen.nettoTabelle.length < 3;

/** Adresse einer Unterseite prüfen — für Links, die eine Unterseite tragen. */
export const unterseiteAus = (v: unknown) => (istUnterseite(v) ? v : null);
