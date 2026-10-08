// ─── MAKE OS — Kapazität: die Rechnung (rein, getestet, client-sicher) ──────
// EINE Stelle für „Wie viel Zeit haben wir — und reicht sie für das, was wir uns vorgenommen haben?“
//
// Je Person und Tag (ab heute, WOCHEN_STANDARD Wochen):
//   Soll       = Grundwert (Stunden je Woche ÷ 5 an Werktagen) · sonst Wochenvorlage (Planung › Routinen) · sonst Annahme 40 h
//   − Abwesend = Urlaub (Ausnahme), Feiertag, ganztägig abwesend (Kalender)
//   − Termine  = Termine im Arbeitsfenster (Kalender, überlappungsfrei)
//   − Umschalten = 15 min je Termin (Meeting-Last)
//   − Blöcke   = feste Blöcke (Ausnahme, Stunden je Woche)
//   = Netto
//   × Kopf & Energie (nur die nächsten 14 Tage; Team-Faktor aus geteilter Erholung)  = belastbar
//   − gebunden = Zuweisungen (Mandat/Kunde, Stunden je Woche)                         = frei für Meilensteine/Ziele
//
// Machbarkeit je Meilenstein/Ziel (der Reihe nach: Überfälliges, dann nach Termin und Rang — „nicht schon verplante Kapa“):
//   Rest = Aufwand × (1 − Fortschritt) · frei = freie Stunden der Personen bis zum Termin
//   Rest ≤ 70 % von frei → machbar · ≤ 90 % → eng · darüber → nicht machbar („bräuchte N h/Tag“ = Rest ÷ Personen-Arbeitstage)
//   Ohne Aufwand → „Aufwand fehlt“, ohne Termin → „Termin fehlt“ — nie geraten.
// Der Rest wird anteilig auf die freie Zeit gelegt (wer Urlaub hat, bekommt nichts); reicht sie nicht, liegt der Rest
// trotzdem in den Wochen — so wird die Überlast sichtbar statt versteckt.

import { montagVon, tagPlus, wochentag, feiertag } from '@/lib/zeit/kalender-kern';
import type { Verfuegbarkeit } from '@/lib/kalender/verfuegbarkeit-regeln';
import {
  ANNAHME_STUNDEN_WOCHE, UMSCHALTEN_STUNDEN, KOPF_TAGE, MACHBAR_BIS, ENG_BIS, WOCHEN_STANDARD,
  type KapaEingabe, type KapaStand, type PersonStand, type WochePerson, type WocheTeam, type Machbarkeit, type PostenEingabe,
  type KapaKennzahlen, type LastStufe, type Ausnahme, type MachbarStatus, type Zuweisung, type TagEingabe, type PlanPerson,
} from './typen';
import { treueAusPlaenen } from './plan';

const r1 = (n: number) => Math.round(n * 10) / 10;
const zahl = (n: number) => r1(n).toLocaleString('de-DE', { maximumFractionDigits: 1 });
const tagKurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;

// ── Kalender → Tage ─────────────────────────────────────────────────────────

const minuten = (wand: string) => Number(wand.slice(11, 13)) * 60 + Number(wand.slice(14, 16));
/** Überlappungsfreie Länge (Minuten) von Spannen, geschnitten auf Fenster. */
function geschnitten(spannen: { s: number; e: number }[], fenster: { s: number; e: number }[]): number {
  const teile: { s: number; e: number }[] = [];
  for (const sp of spannen) for (const f of fenster) {
    const s = Math.max(sp.s, f.s), e = Math.min(sp.e, f.e);
    if (e > s) teile.push({ s, e });
  }
  teile.sort((a, b) => a.s - b.s);
  let summe = 0, bisher = -1;
  for (const t of teile) {
    const s = Math.max(t.s, bisher);
    if (t.e > s) { summe += t.e - s; bisher = t.e; }
  }
  return summe;
}
/** Standard-Arbeitsfenster, wenn keine Wochenvorlage da ist: 09–18 Uhr. */
const STANDARD_FENSTER = [{ s: 9 * 60, e: 18 * 60 }];

/**
 * Die Verfügbarkeit einer Person (K1, `verfuegbarkeitFuer`) als Kalendertage für die Kapazität. Termine zählen, wenn sie
 * beschäftigen (Art „termin“ oder Abwesenheit mit Uhrzeit) — Fokus und Blöcke sind geplante Arbeit, keine Abzüge.
 */
export function tageAusVerfuegbarkeit(v: Pick<Verfuegbarkeit, 'tage'>): { tage: TagEingabe[]; hatVorlage: boolean } {
  const hatVorlage = v.tage.some(t => t.arbeitszeit.length > 0);
  const tage = v.tage.map(t => {
    const fenster = t.arbeitszeit.length
      ? t.arbeitszeit.map(a => ({ s: a.start.slice(0, 10) === t.tag ? minuten(a.start) : 0, e: a.ende.slice(0, 10) === t.tag ? minuten(a.ende) : 1440 }))
      : STANDARD_FENSTER;
    const belegt = t.beschaeftigt.filter(b => !b.ganztags && (b.art === 'termin' || b.art === 'abwesend'));
    const spannen = belegt.map(b => ({ s: b.start.slice(0, 10) === t.tag ? minuten(b.start) : 0, e: b.ende.slice(0, 10) === t.tag ? minuten(b.ende) : 1440 }));
    const vorlage = t.arbeitszeit.reduce((s, a) => s + Math.max(0, (Date.parse(`${a.ende}Z`) - Date.parse(`${a.start}Z`)) / 3_600_000), 0);
    return {
      tag: t.tag,
      vorlageStunden: hatVorlage ? r1(vorlage) : null,
      frei: !!t.feiertag || t.ganzAbwesend,
      ...(t.feiertag ? { feiertag: t.feiertag } : {}),
      terminStunden: r1(geschnitten(spannen, fenster) / 60),
      terminAnzahl: belegt.filter(b => b.art === 'termin').length,
    };
  });
  return { tage, hatVorlage };
}

// ── Kopf & Energie ──────────────────────────────────────────────────────────

/** Erholung (Ø Recovery 0–100) → Faktor auf die belastbare Zeit: grün 1,0 · gelb 0,9 · rot 0,75 (Whoop-Zonen). */
export function erholungFaktor(rec: number): number {
  return rec >= 67 ? 1 : rec >= 34 ? 0.9 : 0.75;
}

// ── Hilfen ──────────────────────────────────────────────────────────────────

const inBereich = (tag: string, von: string, bis?: string) => tag >= von && (!bis || tag <= bis);
const urlaubAm = (aus: readonly Ausnahme[], tag: string) => aus.some(a => a.art === 'urlaub' && inBereich(tag, a.von, a.bis ?? a.von));
const bloeckeAm = (aus: readonly Ausnahme[], tag: string) => aus.filter(a => a.art === 'block' && inBereich(tag, a.von, a.bis)).reduce((s, a) => s + (a.stundenWoche ?? 0), 0);
const zuweisungAm = (z: Zuweisung, tag: string) => (!z.von || tag >= z.von) && (!z.bis || tag <= z.bis);

const STATUS_RANG: Record<MachbarStatus, number> = { 'nicht-machbar': 0, ueberfaellig: 1, eng: 2, 'aufwand-fehlt': 3, 'termin-fehlt': 4, machbar: 5, erledigt: 6 };
/** Der schlechtere von zwei Status (für Ziel = Ziel selbst + seine Meilensteine). */
export const schlechter = (a: MachbarStatus, b: MachbarStatus): MachbarStatus => (STATUS_RANG[a] <= STATUS_RANG[b] ? a : b);

export function stufeVon(belastbar: number, bedarf: number): LastStufe {
  if (belastbar <= 0 && bedarf <= 0) return 'leer';
  if (belastbar <= 0) return 'ueber';
  const a = bedarf / belastbar;
  return a <= 0.85 ? 'gut' : a <= 1 ? 'eng' : 'ueber';
}

// ── Die Rechnung ────────────────────────────────────────────────────────────

interface PersonRechnung {
  id: string; soll: number[]; abw: number[]; term: number[]; anz: number[]; umsch: number[]; block: number[]; netto: number[]; belastbar: number[]; gebunden: number[]; alloc: number[]; rest: number[]; arbeitstag: boolean[];
  /** Laufende Woche (für den festgehaltenen Wochenplan): verplante Stunden je Posten und gebundene je Zuweisung. */
  planPosten: Map<string, { art: 'meilenstein' | 'ziel'; id: string; stunden: number }>; planZuweisung: Map<string, number>;
}

export function kapazitaetRechnen(e: KapaEingabe): KapaStand {
  const heute = e.heute;
  const n = Math.max(1, Math.min(WOCHEN_STANDARD + 52, e.wochen ?? WOCHEN_STANDARD));
  const start = montagVon(heute);
  const wochen = Array.from({ length: n }, (_, i) => tagPlus(start, 7 * i));
  const ende = tagPlus(start, 7 * n);
  const tage: string[] = [];
  for (let t = heute; t < ende; t = tagPlus(t, 1)) tage.push(t);
  const T = tage.length;
  const wocheIdx = tage.map(t => Math.floor((Date.parse(`${t}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / (7 * 86_400_000)));

  // Kopf & Energie: ein Team-Faktor aus den geteilten Erholungswerten (nie ein Einzelwert nach außen).
  const mitErholung = e.personen.filter(p => typeof p.erholung === 'number' && Number.isFinite(p.erholung));
  const kopfFaktor = mitErholung.length ? r1(mitErholung.reduce((s, p) => s + erholungFaktor(p.erholung as number), 0) / mitErholung.length * 100) / 100 : 1;

  const zuweisungen = e.datei.zuweisungen ?? [];
  const rechnungen: PersonRechnung[] = [];
  const personen: PersonStand[] = e.personen.map(p => {
    const einst = e.datei.personen?.[p.id] ?? {};
    const ausnahmen = einst.ausnahmen ?? [];
    const tagMap = new Map((p.tage ?? []).map(t => [t.tag, t]));
    // Wochenmuster der Vorlage (Wochentag → Stunden), aus Tagen ohne Feiertag/Abwesenheit.
    const muster: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    if (p.hatVorlage) for (const t of p.tage ?? []) if (!t.frei && t.vorlageStunden != null) { const w = wochentag(t.tag); muster[w] = Math.max(muster[w], t.vorlageStunden); }
    const quelle: PersonStand['grundwertQuelle'] | null = typeof einst.stundenWoche === 'number' ? 'einstellung' : p.hatVorlage && muster.some(x => x > 0) ? 'vorlage' : p.quelle === 'konto' ? 'annahme' : null;
    const grundwert = quelle === 'einstellung' ? einst.stundenWoche as number : quelle === 'vorlage' ? r1(muster.reduce((s, x) => s + x, 0)) : quelle === 'annahme' ? ANNAHME_STUNDEN_WOCHE : 0;
    const sollRoh = (tag: string): number => {
      const w = wochentag(tag);
      if (quelle === 'vorlage') return muster[w];
      if (quelle === 'einstellung' || quelle === 'annahme') return w <= 5 ? grundwert / 5 : 0;
      return 0;
    };
    const arbeitstageMuster = Math.max(1, [1, 2, 3, 4, 5, 6, 7].filter(w => (quelle === 'vorlage' ? muster[w] > 0 : w <= 5)).length);
    const r: PersonRechnung = { id: p.id, soll: [], abw: [], term: [], anz: [], umsch: [], block: [], netto: [], belastbar: [], gebunden: [], alloc: [], rest: [], arbeitstag: [], planPosten: new Map(), planZuweisung: new Map() };
    const eigeneZ = zuweisungen.filter(z => z.person === p.id);
    tage.forEach((tag, d) => {
      const ti = tagMap.get(tag);
      const roh = quelle ? sollRoh(tag) : 0;
      const frei = ti ? ti.frei : !!feiertag(tag);
      const weg = frei || urlaubAm(ausnahmen, tag);
      const soll = weg ? 0 : roh;
      const term = Math.min(soll, ti?.terminStunden ?? 0);
      // Termine außerhalb der Arbeitstage (Wochenende, Urlaub) zählen weder als Last noch fürs Umschalten.
      const anz = soll > 0 ? ti?.terminAnzahl ?? 0 : 0;
      const umsch = Math.min(soll - term, anz * UMSCHALTEN_STUNDEN);
      const werktagAnteil = wochentag(tag) <= 5 ? 1 / 5 : 0;
      const block = Math.min(soll - term - umsch, bloeckeAm(ausnahmen, tag) * werktagAnteil);
      const netto = Math.max(0, soll - term - umsch - block);
      const belastbar = netto * (d < KOPF_TAGE ? kopfFaktor : 1);
      const aktiv = soll > 0 ? eigeneZ.filter(z => zuweisungAm(z, tag)) : [];
      const gebunden = aktiv.reduce((s, z) => s + z.stundenWoche / arbeitstageMuster, 0);
      if (wocheIdx[d] === 0) for (const z of aktiv) r.planZuweisung.set(z.id, (r.planZuweisung.get(z.id) ?? 0) + z.stundenWoche / arbeitstageMuster);
      r.soll.push(soll); r.abw.push(weg ? roh : 0); r.term.push(term); r.anz.push(anz); r.umsch.push(umsch); r.block.push(block);
      r.netto.push(netto); r.belastbar.push(belastbar); r.gebunden.push(gebunden); r.alloc.push(0);
      r.rest.push(Math.max(0, belastbar - gebunden)); r.arbeitstag.push(soll > 0);
    });
    rechnungen.push(r);
    const erholung = typeof p.erholung === 'number' && Number.isFinite(p.erholung) ? { wert: Math.round(p.erholung), faktor: erholungFaktor(p.erholung) } : undefined;
    return {
      id: p.id, name: p.name, quelle: p.quelle, grundwert: r1(grundwert), grundwertQuelle: quelle ?? 'einstellung',
      ...(quelle ? {} : { ohneKapa: true }), wochen: [], ausnahmen, ...(erholung ? { erholung } : {}),
      ...(einst.erholungAm ? { erholungAm: einst.erholungAm } : {}),
    };
  });

  // ── Machbarkeit, der Reihe nach ──
  const mitKapa = new Set(personen.filter(p => !p.ohneKapa).map(p => p.id));
  const rechnungVon = new Map(rechnungen.map(r => [r.id, r]));
  const offen = e.posten.filter(p => !p.erledigt);
  const reihe = offen.filter(p => (p.aufwand ?? 0) > 0 && p.termin).sort((a, b) =>
    Number((b.termin as string) < heute) - Number((a.termin as string) < heute) || (a.termin as string).localeCompare(b.termin as string) || (a.rang ?? 1e9) - (b.rang ?? 1e9));
  const ergebnis = new Map<string, Machbarkeit>();
  const schluessel = (p: PostenEingabe) => `${p.art}:${p.id}`;
  const einheit = (n: number) => (n > 1 ? 'h je Person und Arbeitstag' : 'h/Tag');
  /** Stunden eines Postens auf einen Tag legen — in der laufenden Woche zusätzlich je Posten gemerkt (Wochenplan). */
  const buchen = (r: PersonRechnung, d: number, p: PostenEingabe, a: number) => {
    r.alloc[d] += a;
    if (wocheIdx[d] !== 0 || !(a > 0)) return;
    const k = schluessel(p);
    const alt = r.planPosten.get(k);
    r.planPosten.set(k, { art: p.art, id: p.id, stunden: (alt?.stunden ?? 0) + a });
  };

  for (const p of reihe) {
    const P = (p.personen ?? []).filter(id => mitKapa.has(id));
    const wer = (P.length ? P : [...mitKapa]).map(id => rechnungVon.get(id)!).filter(Boolean);
    const rest = r1((p.aufwand as number) * (1 - Math.max(0, Math.min(100, p.fortschritt)) / 100));
    const basis = { art: p.art, id: p.id, titel: p.titel, termin: p.termin, aufwand: p.aufwand, rest, personen: P, ...(p.istStunden != null ? { istStunden: r1(p.istStunden) } : {}), ...(p.zielId ? { zielId: p.zielId } : {}) };
    if (!wer.length) { ergebnis.set(schluessel(p), { ...basis, status: 'nicht-machbar', frei: 0, arbeitstage: 0, text: 'nicht machbar — im Team ist keine Kapazität eingetragen' }); continue; }
    if (rest <= 0) { ergebnis.set(schluessel(p), { ...basis, status: 'machbar', text: 'Rest 0 h — nur noch abschließen' }); continue; }
    const termin = p.termin as string;
    if (termin < heute) {
      // Überfällig: der Rest gehört in die Tage ab heute — sichtbar als Last, ehrlich als Status.
      const tageAb = Math.min(T, 5);
      for (const r of wer) for (let d = 0; d < tageAb; d++) buchen(r, d, p, rest / (wer.length * tageAb));
      ergebnis.set(schluessel(p), { ...basis, status: 'ueberfaellig', text: `überfällig seit ${tagKurz(termin)} — Rest ${zahl(rest)} h` });
      continue;
    }
    const nach = tage.findIndex(t => t > termin);
    const dEnde = nach === -1 ? T - 1 : Math.max(0, nach - 1);
    const jenseits = termin >= ende;
    let frei = 0, arbeitstage = 0;
    for (const r of wer) for (let d = 0; d <= dEnde; d++) { frei += r.rest[d]; if (r.arbeitstag[d]) arbeitstage++; }
    const tageBasis = arbeitstage || wer.length * (dEnde + 1);
    const braeuchte = rest / Math.max(1, tageBasis);
    const freiTag = frei / Math.max(1, tageBasis);
    const quote = frei > 0 ? rest / frei : Infinity;
    const status: MachbarStatus = quote <= MACHBAR_BIS ? 'machbar' : quote <= ENG_BIS ? 'eng' : 'nicht-machbar';
    // Verteilen: anteilig auf die freie Zeit; ohne freie Zeit gleichmäßig auf die Arbeitstage (Überlast wird sichtbar).
    if (frei > 0) {
      for (const r of wer) for (let d = 0; d <= dEnde; d++) {
        if (r.rest[d] <= 0) continue;
        const a = rest * r.rest[d] / frei;
        buchen(r, d, p, a);
        r.rest[d] = Math.max(0, r.rest[d] - a);
      }
    } else {
      const ziele: [PersonRechnung, number][] = [];
      for (const r of wer) for (let d = 0; d <= dEnde; d++) if (r.arbeitstag[d] || !arbeitstage) ziele.push([r, d]);
      for (const [r, d] of ziele) buchen(r, d, p, rest / ziele.length);
    }
    const e1 = einheit(wer.length);
    const zusatz = jenseits ? ' (Termin hinter dem Rechenfenster — gezählt bis dorthin)' : !arbeitstage ? ' — bis zum Termin ist kein Arbeitstag mehr' : '';
    const text = status === 'machbar' ? `machbar — braucht ${zahl(braeuchte)} ${e1}, frei sind ${zahl(freiTag)}${zusatz}`
      : status === 'eng' ? `eng — braucht ${zahl(braeuchte)} von ${zahl(freiTag)} freien ${e1}${zusatz}`
      : `nicht machbar — bräuchte ${zahl(braeuchte)} ${e1}, frei sind ${zahl(freiTag)}${braeuchte > 24 ? ' (mehr, als ein Tag Stunden hat)' : ''}${zusatz}`;
    ergebnis.set(schluessel(p), { ...basis, status, frei: r1(frei), arbeitstage, braeuchteStdTag: r1(braeuchte), freiStdTag: r1(freiTag), text });
  }
  const posten: Machbarkeit[] = e.posten.map(p => {
    const fertig = ergebnis.get(schluessel(p));
    if (fertig) return fertig;
    const basis = { art: p.art, id: p.id, titel: p.titel, ...(p.termin ? { termin: p.termin } : {}), ...(p.aufwand ? { aufwand: p.aufwand } : {}), personen: (p.personen ?? []).filter(id => mitKapa.has(id)), ...(p.istStunden != null ? { istStunden: r1(p.istStunden) } : {}), ...(p.zielId ? { zielId: p.zielId } : {}) };
    if (p.erledigt) return { ...basis, status: 'erledigt' as const, text: 'erledigt' };
    if (!((p.aufwand ?? 0) > 0)) return { ...basis, status: 'aufwand-fehlt' as const, text: 'Aufwand fehlt — ohne Schätzung keine Aussage' };
    return { ...basis, status: 'termin-fehlt' as const, text: 'Termin fehlt — ohne Datum keine Aussage' };
  });

  // ── Wochen je Person und Team ──
  const istJe = new Map<string, number>();
  for (const x of e.ist ?? []) if (x.tag >= start && x.tag < ende) {
    const w = wochen[Math.floor((Date.parse(`${x.tag}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / (7 * 86_400_000))];
    if (w) istJe.set(`${x.person}|${w}`, (istJe.get(`${x.person}|${w}`) ?? 0) + x.stunden);
  }
  personen.forEach((p, i) => {
    const r = rechnungen[i];
    p.wochen = wochen.map((woche, wi) => {
      const z: WochePerson = { woche, brutto: 0, abwesend: 0, termine: 0, termineAnzahl: 0, umschalten: 0, bloecke: 0, netto: 0, belastbar: 0, gebunden: 0, bedarf: 0 };
      for (let d = 0; d < T; d++) {
        if (wocheIdx[d] !== wi) continue;
        z.brutto += r.soll[d] + r.abw[d]; z.abwesend += r.abw[d]; z.termine += r.term[d]; z.termineAnzahl += r.anz[d]; z.umschalten += r.umsch[d];
        z.bloecke += r.block[d]; z.netto += r.netto[d]; z.belastbar += r.belastbar[d]; z.gebunden += r.gebunden[d]; z.bedarf += r.gebunden[d] + r.alloc[d];
      }
      const ist = istJe.get(`${p.id}|${woche}`);
      return { woche, brutto: r1(z.brutto), abwesend: r1(z.abwesend), termine: r1(z.termine), termineAnzahl: z.termineAnzahl, umschalten: r1(z.umschalten), bloecke: r1(z.bloecke), netto: r1(z.netto), belastbar: r1(z.belastbar), gebunden: r1(z.gebunden), bedarf: r1(z.bedarf), ...(ist ? { ist: r1(ist) } : {}) };
    });
  });
  const teamWochen: WocheTeam[] = wochen.map((woche, wi) => {
    const zeilen = personen.map(p => p.wochen[wi]);
    const s = (k: keyof WochePerson) => r1(zeilen.reduce((a, z) => a + (z[k] as number ?? 0), 0));
    const belastbar = s('belastbar'), bedarf = s('bedarf');
    const ist = zeilen.reduce((a, z) => a + (z.ist ?? 0), 0);
    return { woche, brutto: s('brutto'), netto: s('netto'), belastbar, bedarf, frei: r1(belastbar - bedarf), auslastung: belastbar > 0 ? r1(bedarf / belastbar * 100) / 100 : null, stufe: stufeVon(belastbar, bedarf), ...(ist ? { ist: r1(ist) } : {}) };
  });

  // ── Kennzahlen der Säule ──
  const d4 = Math.min(T, 28);
  let bedarf4 = 0, belastbar4 = 0;
  for (const r of rechnungen) for (let d = 0; d < d4; d++) { bedarf4 += r.gebunden[d] + r.alloc[d]; belastbar4 += r.belastbar[d]; }
  const zaehle = (s: MachbarStatus) => posten.filter(p => p.status === s).length;
  const m = { machbar: zaehle('machbar'), eng: zaehle('eng'), nicht: zaehle('nicht-machbar'), ueberfaellig: zaehle('ueberfaellig'), ohneAufwand: zaehle('aufwand-fehlt'), ohneTermin: zaehle('termin-fehlt'), bewertet: 0 };
  m.bewertet = m.machbar + m.eng + m.nicht + m.ueberfaellig;
  const istVor = (e.ist ?? []).filter(x => x.tag >= tagPlus(start, -28) && x.tag < start).reduce((s, x) => s + x.stunden, 0);
  const planWoche = bedarf4 / 4;
  // Plan-Treue: festgehaltene Wochen (Montag-Schnappschuss) vor der Näherung (lib/kapazitaet/plan.ts).
  const treueWochen = treueAusPlaenen(e.plaene ?? [], e.ist ?? [], heute);
  const tw = treueWochen.length;
  const twPlan = treueWochen.reduce((s, w) => s + w.geplant, 0), twIst = treueWochen.reduce((s, w) => s + w.ist, 0);
  const naeherung = planWoche > 0 && istVor > 0 ? Math.min(200, r1(istVor / 4 / planWoche * 100)) : null;
  const kritisch = posten.filter(p => ['nicht-machbar', 'ueberfaellig', 'eng'].includes(p.status))
    .sort((a, b) => STATUS_RANG[a.status] - STATUS_RANG[b.status] || (a.termin ?? '').localeCompare(b.termin ?? '')).slice(0, 5)
    .map(p => ({ id: p.id, art: p.art, titel: p.titel, status: p.status, text: p.text }));
  const kennzahlen: KapaKennzahlen = {
    last4: bedarf4 > 0 ? (belastbar4 > 0 ? Math.min(300, r1(bedarf4 / belastbar4 * 100)) : 300) : null,
    bedarf4: r1(bedarf4), belastbar4: r1(belastbar4),
    machbar: m,
    machbarAnteil: m.bewertet ? r1((m.machbar + m.eng / 2) / m.bewertet * 100) : null,
    ...(tw
      ? { planTreue: Math.min(200, r1(twIst / twPlan * 100)), istStdWoche: r1(twIst / tw), planStdWoche: r1(twPlan / tw), planTreueQuelle: 'festgehalten' as const }
      : { planTreue: naeherung, istStdWoche: istVor > 0 ? r1(istVor / 4) : null, planStdWoche: r1(planWoche), planTreueQuelle: 'naeherung' as const }),
    treueWochen,
    pufferStdWoche: bedarf4 > 0 ? r1((belastbar4 - bedarf4) / 4) : null,
    erholung: mitErholung.length ? Math.round(kopfFaktor * 100) : null,
    erholungPersonen: mitErholung.length,
    engpassWochen: teamWochen.slice(0, 12).filter(w => w.stufe === 'eng' || w.stufe === 'ueber').map(w => w.woche),
    kritisch,
  };

  // ── Der Plan der laufenden Woche (ab heute) — hält der Morgenlauf fest. Verfügbar = Netto, OHNE Kopf & Energie (Art. 9). ──
  const planPersonen: PlanPerson[] = personen.flatMap((p, i) => {
    if (p.ohneKapa) return [];
    const r = rechnungen[i], w0 = p.wochen[0];
    return [{
      id: p.id, quelle: p.quelle, verfuegbar: w0?.netto ?? 0, geplant: w0?.bedarf ?? 0, gebunden: w0?.gebunden ?? 0,
      posten: Array.from(r.planPosten.values()).map(x => ({ ...x, stunden: r1(x.stunden) })).filter(x => x.stunden > 0),
      zuweisungen: Array.from(r.planZuweisung.entries()).map(([id, h]) => ({ id, stunden: r1(h) })).filter(x => x.stunden > 0),
    }];
  });

  return {
    heute, wochen, personen,
    team: { wochen: teamWochen, kopf: { faktor: kopfFaktor, personen: mitErholung.length, tage: KOPF_TAGE } },
    posten,
    wochenPlan: { woche: start, ab: heute, personen: planPersonen },
    zuweisungen: zuweisungen.map(z => ({ ...z, label: e.bezugNamen?.[z.bezugId] ?? (z.art === 'mandat' ? 'Mandat' : 'Kunde') })),
    kennzahlen,
  };
}

/** Machbarkeit eines Ziels: das Ziel selbst (mit eigenem Aufwand) und alle seine Meilensteine — der schlechteste Status zählt. */
export function zielMachbarkeit(stand: Pick<KapaStand, 'posten'>, zielId: string): { status: MachbarStatus; posten: Machbarkeit[] } | null {
  const liste = stand.posten.filter(p => (p.art === 'ziel' && p.id === zielId) || (p.art === 'meilenstein' && p.zielId === zielId));
  const zaehlen = liste.filter(p => p.status !== 'erledigt');
  if (!zaehlen.length) return liste.length ? { status: 'erledigt', posten: liste } : null;
  return { status: zaehlen.map(p => p.status).reduce(schlechter), posten: liste };
}

/**
 * Was eine Person sehen darf (Plattform-Regel, serverseitig): den eigenen Erholungswert und die Titel der eigenen
 * Ausnahmen nur sie selbst — andere sehen nur den Team-Faktor und „Urlaub“/„Block“. `betrachter` null = niemand
 * (Business-Index, ZOE-Summen).
 */
export function fuerBetrachter(stand: KapaStand, betrachter: string | null): KapaStand {
  return {
    ...stand,
    personen: stand.personen.map(p => {
      if (p.id === betrachter) return p;
      const { erholung: _weg, erholungAm: _am, ...rest } = p;
      return { ...rest, ausnahmen: p.ausnahmen.map(({ titel: _t, ...a }) => a) };
    }),
  };
}

/** Titel eines Postens aus dem Privat-Bereich für Konten ohne Privatzugang (05.10. abends). */
export const PRIVAT_BELEGT = 'Privat (belegt)';
/** Schlüssel eines Postens für `ohnePrivatePosten` — Meilenstein und Ziel haben getrennte Kennungen. */
export const postenSchluessel = (p: { art: 'meilenstein' | 'ziel'; id: string }): string => `${p.art}:${p.id}`;

/**
 * Posten aus dem Privat-Bereich (05.10. abends: die Selbstständigkeit — zählt als Arbeit, gehört aber zu Privat) für Konten ohne Privatzugang
 * (`finanzRecht: 'business'`) und den Business-Index: die Stunden bleiben in Last und Machbarkeit (die Zeit ist belegt), Titel und Ziel-Bezug
 * nicht; in der Liste „kritisch“ (geht an den Business-Index, ZOE, Berichte) fehlen sie ganz. Rein; `privat` = `postenSchluessel`.
 */
export function ohnePrivatePosten(stand: KapaStand, privat: ReadonlySet<string>): KapaStand {
  if (!privat.size) return stand;
  return {
    ...stand,
    posten: stand.posten.map(p => {
      if (!privat.has(postenSchluessel(p))) return p;
      const { zielId: _z, ...rest } = p;
      return { ...rest, titel: PRIVAT_BELEGT };
    }),
    kennzahlen: ohnePrivateKennzahlen(stand.kennzahlen, privat),
  };
}
/**
 * Verborgene Posten (08.10., Gegenprüfung — eigene Ziele nur geteilt): ein Meilenstein an einem nicht geteilten eigenen Ziel einer anderen
 * Person (Altbestand) kommt beim Betrachter gar nicht an — kein Titel, keine Kennung, kein Termin, kein Aufwand, nicht in „kritisch“ und
 * nicht im Wochenplan. Seine Stunden bleiben in den Summen (Last je Person/Team, Machbarkeits-Zähler) — die Zeit ist ja belegt.
 * Rein; `verborgen` = `postenSchluessel`.
 */
export function ohneVerborgenePosten(stand: KapaStand, verborgen: ReadonlySet<string>): KapaStand {
  if (!verborgen.size) return stand;
  const weg = (p: { art: 'meilenstein' | 'ziel'; id: string }) => verborgen.has(postenSchluessel(p));
  return {
    ...stand,
    posten: stand.posten.filter(p => !weg(p)),
    kennzahlen: ohnePrivateKennzahlen(stand.kennzahlen, verborgen),
    ...(stand.wochenPlan ? { wochenPlan: { ...stand.wochenPlan, personen: stand.wochenPlan.personen.map(p => ({ ...p, posten: p.posten.filter(x => !weg(x)) })) } } : {}),
  };
}

/** Kennzahlen ohne die Titel privater Posten (Liste „kritisch“). */
export function ohnePrivateKennzahlen(k: KapaKennzahlen, privat: ReadonlySet<string>): KapaKennzahlen {
  return privat.size ? { ...k, kritisch: k.kritisch.filter(p => !privat.has(postenSchluessel(p))) } : k;
}

/**
 * Kennzahlen ohne Gesundheits-Ableitung (DSGVO-Prüfung 04.10., Art. 9): `erholung`/`erholungPersonen` fallen weg, bevor die
 * Summen den Kapazitäts-Bereich verlassen (Business-Index → ZOE, Verlauf, Berichte). Bei einer einzigen teilenden Person
 * wäre der Team-Faktor sonst ihr Einzelwert.
 */
export function ohneGesundheit(k: KapaKennzahlen): KapaKennzahlen {
  return { ...k, erholung: null, erholungPersonen: 0 };
}
