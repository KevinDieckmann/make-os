// ─── Agenten-Bereich: Leistung, Kosten, Autonomie (09.10., Paket 3; Fragerunde Teil 1 Antworten 15–17) ──────────────────────
// Antworten 08.10. spät (ENTSCHEIDUNGEN_FRAGEBOGEN.md › Fragerunde Teil 1):
//   15 Autonomie: „Boden wie heute + Stufe je Head (nur verschärfen) · mehr Freiheit erst nach Annahmequote · zurück automatisch,
//      hoch per Klick · Höchstzahl Auto-Läufe.“
//   16 Kosten: „erster Monat nur messen · Grenze je Lauf · Schätzung vor großen Aufträgen mit Klick · Euro · bei 100 % Regelwerk +
//      Glocke · Budget-Balken.“
//   17 Leistung: „Daumen · Annahmequote · Erfolgsquote je Skill · Kosten je Ergebnis · monatlicher Review von ZOE · Tests vor jeder Änderung.“
//
// Oben rein (Server UND Browser), unten der Server-Teil (Imports nur dynamisch, damit die Oberfläche die reinen Teile nutzen kann).
// Nur ZAHLEN — nie Inhalte, Namen oder Texte Dritter (auch nicht im Review-Bericht für ZOE).
//
// Kosten (seit Paket 4b): `kostenCent` rechnet über das Anbieter-Tor (lib/ki/kosten.ts — Katalogpreise aus lib/ki/modelle.ts, Kurs der
// Instanz `MAKE_OS_KI_USD_EUR`) mit dem Modell hinter der Stufe (`stufenModelle`, Vorgabe bzw. Umgebung) — keine zweite Preisrechnung.
// Gemessene Kosten (Threads, `LaufZustand.kostenCent`) gehen vor: „aus dem gemessenen Mittel, nie geraten“ (ARCHITEKTUR 6.2.7).

import type { AgentenEinstellung, AutonomieStufe, Daumen, Faden, HeadDef, HeadEinstellung, ModelTier, Nachricht, Skill } from './typen';
import { inEuroCent, kostenUsdCent, usdEurKurs } from '@/lib/ki/kosten';
import { stufenModelle } from '@/lib/ki/modelle';

// ── Kosten ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ab dieser Schätzung (Cent) fragt die Oberfläche vor dem Start: „kostet ca. … — starten?“ (Antwort 16, R14 Plan-Freigabe). */
export const GROSS_AB_CENT = 50;
/** Token-Annahme je Lauf-Art, solange nichts gemessen ist (Mitarbeiter-Lauf: bis 6 Runden, R5). */
export const TOKEN_ANNAHME = { probelauf: { ein: 4_000, aus: 800 }, lauf: { ein: 48_000, aus: 9_000 } } as const;

/**
 * Stufe + Token → Euro-Cent (ungerundet) — über das Anbieter-Tor (lib/ki/kosten.ts): Modell der Stufe aus `stufenModelle` (Umgebung,
 * sonst Vorgabe), Katalogpreis, Kurs der Instanz. `env` nur für Tests.
 */
export function kostenCent(o: { stufe: ModelTier; tokenEin: number; tokenAus: number }, env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}): number {
  const modell = stufenModelle(env)[o.stufe];
  return inEuroCent(kostenUsdCent(modell, { 'token-ein': Math.max(0, o.tokenEin), 'token-aus': Math.max(0, o.tokenAus) }), usdEurKurs(env));
}

/** „0,42 €“ bzw. „ca. 0,42 €“ (unter einem Cent „< 0,01 €“). */
export function euroText(cent: number, ca = false): string {
  if (cent > 0 && cent < 1) return `${ca ? 'ca. ' : ''}< 0,01 €`;
  return `${ca ? 'ca. ' : ''}${(Math.round(cent) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export interface KostenSchaetzung {
  /** Euro-Cent (gerundet). */
  cent: number;
  /** `messung` = Mittel der letzten gemessenen Läufe; `annahme` = noch keine Erfahrung. */
  quelle: 'messung' | 'annahme';
  text: string;
  laeufe?: number;
}

/** Kosten VOR dem Start schätzen (rein): gemessenes Mittel der letzten Läufe (≥ 3), sonst Annahme — immer „ca.“. */
export function kostenSchaetzen(o: { stufe: ModelTier; art: 'probelauf' | 'lauf'; anzahl?: number; gemessenCent?: readonly number[] }): KostenSchaetzung {
  const anzahl = Math.max(1, Math.round(o.anzahl ?? 1));
  const gemessen = (o.gemessenCent ?? []).filter(x => Number.isFinite(x) && x >= 0).slice(-20);
  if (gemessen.length >= 3) {
    const mittel = gemessen.reduce((a, b) => a + b, 0) / gemessen.length;
    const cent = Math.round(mittel * anzahl);
    return { cent, quelle: 'messung', text: `${euroText(cent, true)} (Mittel aus ${gemessen.length} Läufen)`, laeufe: gemessen.length };
  }
  const t = TOKEN_ANNAHME[o.art];
  const cent = Math.round(kostenCent({ stufe: o.stufe, tokenEin: t.ein * anzahl, tokenAus: t.aus * anzahl }));
  return { cent, quelle: 'annahme', text: `${euroText(cent, true)} (noch keine Erfahrung — Annahme)` };
}

// ── Daumen je Antwort (Speicher-Format) ───────────────────────────────────────────────────────────────────────────────────

/**
 * Daumen je Antwort (Antwort 17). SPEICHER-FORMAT: am `Nachricht`-Eintrag des Threads als Feld `daumen` (seit Paket 4b im Vertrag,
 * `Nachricht.daumen`; geschrieben über die Aktion `bewerten` der Thread-Route, nur die Besitzerin des Threads, nur an Agenten-Antworten
 * und Berichten). `grund` nur aus `ABLEHNGRUENDE` der Heads (lib/heads/lernen.ts) — nie Freitext Dritter.
 */
export type { Daumen };
export type NachrichtMitDaumen = Nachricht & { daumen?: Daumen };

/** Darf diese Nachricht einen Daumen tragen? Agenten-Antworten und Berichte aus einem Mitarbeiter-Thread. */
export const bewertbar = (n: Pick<Nachricht, 'rolle' | 'verweis'>): boolean => n.rolle === 'agent' || (n.rolle === 'system' && n.verweis?.art === 'bericht');

/** Daumen setzen bzw. entfernen (`null`) — rein, für die Aktion `bewerten` (Thread-Route). Nur bewertbare Nachrichten, sonst null. */
export function daumenSetzen(n: Nachricht, d: Daumen | null): NachrichtMitDaumen | null {
  if (!bewertbar(n)) return null;
  const { daumen: _d, ...rest } = n as NachrichtMitDaumen;
  return d ? { ...rest, daumen: { wert: d.wert, am: d.am, ...(d.grund ? { grund: d.grund.slice(0, 40) } : {}) } } : rest;
}

/** Den Daumen einer Nachricht tolerant lesen. */
export function daumenVon(n: Nachricht): Daumen | null {
  const d = (n as NachrichtMitDaumen).daumen;
  return d && (d.wert === 'hoch' || d.wert === 'runter') && typeof d.am === 'string' ? d : null;
}

// ── Kennzahlen je Head (rein) ────────────────────────────────────────────────────────────────────────────────────────────

/** So viele Entscheidungen braucht eine Quote, bevor sie zählt (sonst „—“). */
export const MIN_ENTSCHEIDUNGEN = 10;
export interface Annahme { angenommen: number; abgelehnt: number; quote: number | null }
export const annahmeAus = (angenommen: number, abgelehnt: number): Annahme => ({ angenommen, abgelehnt, quote: angenommen + abgelehnt >= MIN_ENTSCHEIDUNGEN ? angenommen / (angenommen + abgelehnt) : null });

/** Entscheidungen einer Freigabe-Liste der Heads bzw. des Finanzchefs im Zeitraum — selbst Übernommenes (Autonomie) zählt nicht. */
export function annahmeAusListe(vorschlaege: readonly { status: string; entschieden?: string; aktualisiert?: string; auto?: unknown }[], vonIso: string, bisIso: string): { angenommen: number; abgelehnt: number } {
  let a = 0, b = 0;
  for (const v of vorschlaege) {
    const t = v.entschieden ?? v.aktualisiert ?? '';
    if (!t || t < vonIso || t >= bisIso || v.auto) continue;
    if (v.status === 'angenommen' || v.status === 'erledigt') a++;
    else if (v.status === 'abgelehnt') b++;
  }
  return { angenommen: a, abgelehnt: b };
}

/**
 * Entscheidungen im Stapel zu Vorschlägen eines Heads: Werkstatt-Arten (skill/mitarbeiter/merksatz, `bezug.id` = Head) und — seit dem Durchstich
 * 09.10. — jeder andere Vorschlag aus dem Agenten-Bereich (Aufgabe, CRM, Kalender, Plan …), dessen Eintrag den Head trägt (`agent`). Vorher
 * zählten freigegebene/abgelehnte Werkzeug-Vorschläge der Heads nie — Ablehnen mit Grund blieb ohne Wirkung auf Quote und Autonomie.
 */
export function annahmeAusEntscheidungen(eintraege: readonly { typ: string; entscheidung?: string; bezug?: { art: string; id: string }; agent?: string }[], headId: string): { angenommen: number; abgelehnt: number } {
  let a = 0, b = 0;
  for (const e of eintraege) {
    const werkstatt = !!e.bezug && ['skill', 'mitarbeiter', 'merksatz'].includes(e.bezug.art) && e.bezug.id === headId;
    if (e.typ !== 'entscheidung' || !(werkstatt || e.agent === headId)) continue;
    if (e.entscheidung === 'freigegeben') a++;
    else if (e.entscheidung === 'abgelehnt' || e.entscheidung === 'zurueck') b++;
  }
  return { angenommen: a, abgelehnt: b };
}

/** Läufe, Kosten und Daumen aus Threads eines Heads im Zeitraum (rein). */
/**
 * Läufe, Kosten und Daumen eines Heads in den Threads im Zeitraum (rein). Die Threads messen in US-Cent (`LaufZustand.kostenCent`,
 * `Nachricht.kosten.cent` — wie die Kostenmessung); zurück kommen EURO-Cent (`kostenEuroCent`, `gemessenEuroCent`) über den Kurs der Instanz
 * (lib/ki/kosten.ts `inEuroCent`) — die Einheit der Budgets und Grenzen (Feinschliff 09.10.; vorher wurde US-Cent gegen Euro-Cent verglichen).
 */
export function fadenZahlen(faeden: readonly Faden[], headId: string, vonIso: string, bisIso: string, kurs: number = usdEurKurs(typeof process !== 'undefined' ? process.env : {})): { laeufe: { gesamt: number; fertig: number; fehler: number; abgebrochen: number }; kostenEuroCent: number; gemessenEuroCent: number[]; daumen: { hoch: number; runter: number } } {
  const laeufe = { gesamt: 0, fertig: 0, fehler: 0, abgebrochen: 0 };
  const daumen = { hoch: 0, runter: 0 };
  const gemessen: number[] = [];
  let kosten = 0;
  for (const f of faeden) {
    if (f.agent.art === 'zoe' || f.agent.headId !== headId) continue;
    const l = f.lauf;
    if (l && l.start >= vonIso && l.start < bisIso) {
      laeufe.gesamt++;
      if (l.status === 'fertig') laeufe.fertig++;
      else if (l.status === 'fehler') laeufe.fehler++;
      else if (l.status === 'abgebrochen') laeufe.abgebrochen++;
      if (Number.isFinite(l.kostenCent)) { kosten += l.kostenCent; if (l.status === 'fertig') gemessen.push(Math.round(inEuroCent(l.kostenCent, kurs) * 100) / 100); }
    }
    for (const n of f.nachrichten) {
      if (n.zeit < vonIso || n.zeit >= bisIso) continue;
      if (!l && n.kosten?.cent) kosten += n.kosten.cent;
      const d = daumenVon(n);
      if (d && d.am >= vonIso && d.am < bisIso) daumen[d.wert]++;
    }
  }
  return { laeufe, kostenEuroCent: Math.round(inEuroCent(kosten, kurs) * 100) / 100, gemessenEuroCent: gemessen, daumen };
}

export interface HeadLeistung {
  headId: string;
  von: string;
  bis: string;
  laeufe: { gesamt: number; fertig: number; fehler: number; abgebrochen: number };
  annahme: Annahme;
  daumen: { hoch: number; runter: number };
  /** Erfolgsquote je Skill (angenommen ÷ entschieden inkl. Fehler). */
  skills: { id: string; name: string; laeufe: number; quote: number | null }[];
  kosten: {
    /** Euro-Cent (aus den gemessenen US-Cent der Threads umgerechnet, `fadenZahlen`). */
    cent: number;
    /** Kosten je Ergebnis = Kosten ÷ (fertige Läufe + angenommene Vorschläge) — null ohne Ergebnis. */
    jeErgebnisCent: number | null;
  };
}

/** Alles zusammen (rein). */
export function headLeistung(o: {
  headId: string; von: string; bis: string;
  faden: ReturnType<typeof fadenZahlen>;
  entscheidungen: { angenommen: number; abgelehnt: number }[];
  skills: readonly Pick<Skill, 'id' | 'name' | 'erfolg'>[];
}): HeadLeistung {
  const angenommen = o.entscheidungen.reduce((a, e) => a + e.angenommen, 0);
  const abgelehnt = o.entscheidungen.reduce((a, e) => a + e.abgelehnt, 0);
  const ergebnisse = o.faden.laeufe.fertig + angenommen;
  return {
    headId: o.headId, von: o.von, bis: o.bis,
    laeufe: o.faden.laeufe,
    annahme: annahmeAus(angenommen, abgelehnt),
    daumen: o.faden.daumen,
    skills: o.skills.map(s => { const n = s.erfolg.angenommen + s.erfolg.abgelehnt + s.erfolg.fehler; return { id: s.id, name: s.name, laeufe: s.erfolg.laeufe, quote: n ? s.erfolg.angenommen / n : null }; }),
    kosten: { cent: o.faden.kostenEuroCent, jeErgebnisCent: ergebnisse ? Math.round((o.faden.kostenEuroCent / ergebnisse) * 100) / 100 : null },
  };
}

// ── Autonomie je Head (nur verschärfen über den heutigen Boden) ───────────────────────────────────────────────────────────

/** Strengste zuerst. `vorschlag` = alles als Vorschlag; `intern` = interne Kleinigkeiten selbst (lib/heads/autonomie.ts). */
export const AUTONOMIE_REIHE: readonly AutonomieStufe[] = ['vorschlag', 'intern'];
const rang = (s: AutonomieStufe) => AUTONOMIE_REIHE.indexOf(s);
/** Ab dieser Annahmequote darf eine Person per Klick hochstufen. */
export const QUOTE_HOCH = 0.7;
/** Unter dieser Annahmequote stuft der Server automatisch zurück. */
export const QUOTE_RUNTER = 0.4;

/**
 * Der Boden = wie heute: die Heads mit vorhandenen Modi (lib/heads) erledigen interne Kleinigkeiten selbst (Entscheidung 25.09.), alle anderen
 * schlagen nur vor. Eine Stufe je Head kann darunter bleiben (verschärfen), nie darüber.
 */
export const autonomieBoden = (head: Pick<HeadDef, 'eingebaut'>): AutonomieStufe => (head.eingebaut?.quelle === 'heads' ? 'intern' : 'vorschlag');

/** Einstellung je Head mit dem Vermerk, wer/wann/warum (additiv im Bestand `agenten-einstellung--<haushalt>`). */
export type HeadEinstellungMitAutonomie = HeadEinstellung & { autonomieAm?: string; autonomieVon?: string; autonomieGrund?: 'hand' | 'quote' };

export interface AutonomieLage {
  /** Was gilt. */
  stufe: AutonomieStufe;
  boden: AutonomieStufe;
  /** Gesetzt (ohne Angabe = Boden). */
  gesetzt: AutonomieStufe;
  /** Darf eine Person jetzt per Klick hochstufen? */
  hochMoeglich: boolean;
  /** Ist die Quote so schlecht, dass der Server zurückstuft? */
  zurueck: boolean;
  grund?: string;
}

/** Die Lage eines Heads (rein): wirksam = min(Boden, gesetzt); bei schlechter Quote sofort „vorschlag“ (auch bevor es gespeichert ist). */
export function autonomieLage(head: Pick<HeadDef, 'eingebaut'>, e: HeadEinstellungMitAutonomie | undefined, annahme: Annahme): AutonomieLage {
  const boden = autonomieBoden(head);
  const gesetzt = e?.autonomie && rang(e.autonomie) >= 0 ? e.autonomie : boden;
  let stufe = rang(gesetzt) <= rang(boden) ? gesetzt : boden;
  const schlecht = annahme.quote !== null && annahme.quote < QUOTE_RUNTER;
  const zurueck = schlecht && stufe !== 'vorschlag';
  if (zurueck) stufe = 'vorschlag';
  const hochMoeglich = rang(stufe) < rang(boden) && annahme.quote !== null && annahme.quote >= QUOTE_HOCH;
  const grund = rang(stufe) >= rang(boden) ? undefined
    : schlecht ? `Annahmequote unter ${Math.round(QUOTE_RUNTER * 100)} % — der Head schlägt nur vor.`
    : annahme.quote === null ? `Hochstufen erst ab ${MIN_ENTSCHEIDUNGEN} Entscheidungen mit mindestens ${Math.round(QUOTE_HOCH * 100)} % angenommen.`
    : annahme.quote < QUOTE_HOCH ? `Hochstufen ab ${Math.round(QUOTE_HOCH * 100)} % angenommen (bisher ${Math.round(annahme.quote * 100)} %).` : undefined;
  return { stufe, boden, gesetzt, hochMoeglich, zurueck, ...(grund ? { grund } : {}) };
}

/** Darf diese Stufe per Klick gesetzt werden? Verschärfen immer; lockern nur bis zum Boden und nur mit guter Quote. Rein. */
export function autonomieWunschPruefen(head: Pick<HeadDef, 'eingebaut'>, e: HeadEinstellungMitAutonomie | undefined, wunsch: unknown, annahme: Annahme): { ok: true; stufe: AutonomieStufe } | { ok: false; status: 400 | 409; fehler: string } {
  if (!AUTONOMIE_REIHE.includes(wunsch as AutonomieStufe)) return { ok: false, status: 400, fehler: 'Stufe: „vorschlag“ oder „intern“.' };
  const w = wunsch as AutonomieStufe;
  const lage = autonomieLage(head, e, annahme);
  if (rang(w) > rang(lage.boden)) return { ok: false, status: 409, fehler: 'Mehr Freiheit als heute gibt es nicht — eine Stufe kann nur verschärfen.' };
  if (rang(w) > rang(lage.stufe) && !lage.hochMoeglich) return { ok: false, status: 409, fehler: lage.grund ?? 'Hochstufen geht erst mit guter Annahmequote.' };
  return { ok: true, stufe: w };
}

/** Automatisch zurückstufen (rein): die Einstellungen, die geschrieben werden müssen — leer, wenn nichts zu tun ist. */
export function autonomieZurueckstufen(einst: AgentenEinstellung, heads: readonly HeadDef[], annahmeJe: (headId: string) => Annahme, jetzt: string): { einst: AgentenEinstellung; heads: string[] } {
  const geaendert: string[] = [];
  const neu: AgentenEinstellung = { ...einst, heads: { ...einst.heads } };
  for (const h of heads) {
    const e = einst.heads[h.id] as HeadEinstellungMitAutonomie | undefined;
    const lage = autonomieLage(h, e, annahmeJe(h.id));
    if (!lage.zurueck) continue;
    neu.heads[h.id] = { ...(e ?? {}), autonomie: 'vorschlag', autonomieAm: jetzt, autonomieVon: 'system', autonomieGrund: 'quote' } as HeadEinstellungMitAutonomie;
    geaendert.push(h.id);
  }
  return { einst: geaendert.length ? { ...neu, geaendertAm: jetzt, geaendertVon: 'system' } : einst, heads: geaendert };
}

// ── Monatlicher Review von ZOE (nur Zahlen) ──────────────────────────────────────────────────────────────────────────────

export interface ReviewDaten {
  monat: string;
  heads: (Omit<HeadLeistung, 'skills'> & { skills: { laeufe: number; quote: number | null }[]; autonomie: AutonomieStufe })[];
}

/** Die Daten für ZOEs Monatsreview (rein): keine Namen, keine Texte — Skill-Namen fallen weg, nur Zahlen bleiben. */
export function reviewDatenAus(monat: string, liste: readonly (HeadLeistung & { autonomie: AutonomieStufe })[]): ReviewDaten {
  return { monat, heads: liste.map(l => ({ ...l, skills: l.skills.map(s => ({ laeufe: s.laeufe, quote: s.quote })) })) };
}

// ── Server ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const monatsGrenzen = (monat: string): { von: string; bis: string } => {
  const [j, m] = monat.split('-').map(Number);
  const von = new Date(Date.UTC(j, m - 1, 1)).toISOString();
  const bis = new Date(Date.UTC(m === 12 ? j + 1 : j, m === 12 ? 0 : m, 1)).toISOString();
  return { von, bis };
};

/** Annahmequote eines Heads im Haushalt (90 Tage): Freigabe-Liste des Heads bzw. Finanzchefs + Stapel-Entscheidungen zu seinen Vorschlägen. */
export async function annahmeFuerHead(head: HeadDef, haushalt: string | null, jetzt = new Date(), tage = 90): Promise<Annahme> {
  const { loadJson } = await import('@/lib/store/local-db');
  const vonIso = new Date(jetzt.getTime() - tage * 864e5).toISOString(), bisIso = new Date(jetzt.getTime() + 60_000).toISOString();
  const teile: { angenommen: number; abgelehnt: number }[] = [];
  try {
    if (head.eingebaut?.quelle === 'heads' && ['sales', 'marketing', 'event'].includes(head.id)) {
      const s = await loadJson<{ vorschlaege?: { status: string; entschieden?: string; aktualisiert?: string; auto?: unknown }[] }>(`head-${head.id}`);
      teile.push(annahmeAusListe(s?.vorschlaege ?? [], vonIso, bisIso));
    }
    if (head.id === 'finanzen') {
      const s = await loadJson<{ vorschlaege?: { status: string; entschieden?: string; aktualisiert?: string }[] }>((await import('@/lib/finanzen/chef/stand')).standName(null));
      teile.push(annahmeAusListe(s?.vorschlaege ?? [], vonIso, bisIso));
    }
    if (haushalt) {
      const { entscheidungenMonat } = await import('@/lib/zoe/entscheidungen');
      const { monatBerlin } = await import('@/lib/store/aenderungsprotokoll');
      const monate = new Set<string>();
      for (let t = Date.parse(vonIso); t <= jetzt.getTime(); t += 28 * 864e5) monate.add(monatBerlin(new Date(t)));
      monate.add(monatBerlin(jetzt));
      for (const m of monate) teile.push(annahmeAusEntscheidungen((await entscheidungenMonat(haushalt, m).catch(() => [])).filter(e => e.at >= vonIso), head.id));
    }
  } catch (e) { console.error('[agenten-leistung] Annahme nicht lesbar:', e instanceof Error ? e.message.slice(0, 120) : e); }
  return annahmeAus(teile.reduce((a, x) => a + x.angenommen, 0), teile.reduce((a, x) => a + x.abgelehnt, 0));
}

/** Leistung eines Heads für die Person (eigene Threads; Freigaben des Haushalts) im Monat (Standard: laufender). */
export async function leistungFuerHead(person: string, head: HeadDef, monat?: string, jetzt = new Date()): Promise<HeadLeistung & { autonomie: AutonomieLage }> {
  const { werkstattBestandFuer } = await import('./typen');
  const { faedenSeit } = await import('./faeden-server');
  const { umfangFuer, werkstattLaden } = await import('./skills-server');
  const { einstellungFuer } = await import('./skills-lesen');
  const { monatBerlin } = await import('@/lib/store/aenderungsprotokoll');
  const m = monat && /^\d{4}-(0[1-9]|1[0-2])$/.test(monat) ? monat : monatBerlin(jetzt);
  const { von, bis } = monatsGrenzen(m);
  const umfang = await umfangFuer(person);
  // E3 (09.10.): ganz geladen werden nur die Threads dieses Heads, die seit Monatsbeginn geschrieben wurden (Index → nur die nötigen Dateien).
  const faeden = await faedenSeit(person, f => f.agent.art !== 'zoe' && f.agent.headId === head.id, von).catch(() => [] as Faden[]);
  const name = werkstattBestandFuer(head.ebene, umfang);
  const skills = name ? (await werkstattLaden(name)).skills.filter(s => s.headId === head.id) : [];
  const annahme = await annahmeFuerHead(head, umfang.haushalt, jetzt);
  const einst = await einstellungFuer(umfang.haushalt, person);
  const fz = fadenZahlen(faeden, head.id, von, bis);
  const l = headLeistung({ headId: head.id, von, bis, faden: fz, entscheidungen: [{ angenommen: annahme.angenommen, abgelehnt: annahme.abgelehnt }], skills });
  return { ...l, annahme, autonomie: autonomieLage(head, einst.heads[head.id] as HeadEinstellungMitAutonomie | undefined, annahme) };
}

/** Gemessene Kosten der letzten fertigen Läufe eines Heads (eigene Threads) in EURO-Cent — Grundlage der Schätzung (`kostenSchaetzen`). */
export async function gemesseneKosten(person: string, headId: string): Promise<number[]> {
  const { bestandLesen } = await import('./faeden-server');
  const faeden = (await bestandLesen(person).catch(() => null))?.faeden ?? []; // nur Köpfe (E3) — der Lauf-Zustand steht im Kopf
  return faeden.filter(f => f.agent.art !== 'zoe' && f.agent.headId === headId && f.lauf?.status === 'fertig' && Number.isFinite(f.lauf.kostenCent))
    .sort((a, b) => (a.lauf!.start < b.lauf!.start ? -1 : 1)).map(f => inEuroCent(f.lauf!.kostenCent)).slice(-20);
}

/**
 * Autonomie per Klick setzen (Person aus der Sitzung, nur sichtbare Heads — „Festhalten in den Einstellungen des Haushalts“). Verschärfen
 * immer, lockern nur bis zum Boden und nur mit guter Quote. Seit Paket 4b: Haushalts-Heads nur volle Mitglieder; Privat-Heads (Ebene Person)
 * in den Abschnitt der Person (lib/agenten/einstellung.ts — dieselbe Schreibstelle wie „Einstellungen“).
 */
export async function autonomieSetzen(person: string, headId: unknown, wunsch: unknown): Promise<{ ok: true; autonomie: AutonomieLage } | { ok: false; status: 400 | 403 | 404 | 409; fehler: string }> {
  const { headDef } = await import('./katalog');
  const { headSichtbar, umfangFuer } = await import('./skills-server');
  const { updateJson } = await import('@/lib/store/local-db');
  const { einstellungBestand, EINSTELLUNG_VORGABE } = await import('./typen');
  const { protokolliere } = await import('@/lib/store/aenderungsprotokoll');
  const { headEinstellungVon } = await import('./einstellung');
  const head = typeof headId === 'string' ? headDef(headId) : null;
  if (!head) return { ok: false, status: 404, fehler: 'Diesen Head gibt es nicht.' };
  if (!(await headSichtbar(person, head.id))) return { ok: false, status: 403, fehler: 'Diesen Head siehst du nicht.' };
  const { haushalt } = await umfangFuer(person);
  if (!haushalt) return { ok: false, status: 409, fehler: 'Ohne Haushalt gibt es keine Einstellungen.' };
  if (head.ebene !== 'person') {
    const { haushaltFuer } = await import('@/lib/finanzen/haushalt/zugriff');
    if (!(await haushaltFuer(person))) return { ok: false, status: 403, fehler: 'Die Einstellungen dieses Heads ändern nur volle Mitglieder des Haushalts.' };
  }
  const annahme = await annahmeFuerHead(head, haushalt);
  const jetzt = new Date().toISOString();
  let raus: { ok: true; autonomie: AutonomieLage } | { ok: false; status: 400 | 409; fehler: string } = { ok: false, status: 409, fehler: 'Nicht gespeichert.' };
  await updateJson<AgentenEinstellung>(einstellungBestand(haushalt), cur => {
    const e = cur ?? { ...EINSTELLUNG_VORGABE, heads: {} };
    const alt = headEinstellungVon({ ...e, heads: e.heads ?? {} }, head, person) as HeadEinstellungMitAutonomie;
    const p = autonomieWunschPruefen(head, alt, wunsch, annahme);
    if (!p.ok) { raus = p; return e; }
    const neuH: HeadEinstellungMitAutonomie = { ...alt, autonomie: p.stufe, autonomieAm: jetzt, autonomieVon: person, autonomieGrund: 'hand' };
    raus = { ok: true, autonomie: autonomieLage(head, neuH, annahme) };
    if (head.ebene === 'person') return { ...e, personen: { ...(e.personen ?? {}), [person]: { heads: { ...(e.personen?.[person]?.heads ?? {}), [head.id]: neuH } } } };
    return { ...e, heads: { ...e.heads, [head.id]: neuH }, geaendertAm: jetzt, geaendertVon: person };
  });
  if (raus.ok) await protokolliere(einstellungBestand(haushalt), [{ liste: head.ebene === 'person' ? 'personen' : 'heads', op: 'geaendert', id: head.id, felder: ['autonomie'] }], { art: 'person', person }).catch(() => {});
  return raus;
}

/**
 * Automatisch zurückstufen (Fragerunde 15 „zurück automatisch“): prüft die Quote aller Heads des Haushalts und schreibt die
 * Zurückstufung in die Einstellungen — läuft nach jeder Schreibaktion der Agenten-Routen und ist für den Morgenlauf gedacht.
 * Seit Paket 4b auch in den Abschnitten der Personen (Privat-Heads der Ebene Person).
 */
export async function autonomiePflegen(haushalt: string | null, jetzt = new Date()): Promise<string[]> {
  if (!haushalt) return [];
  const { loadJson, updateJson } = await import('@/lib/store/local-db');
  const { KATALOG } = await import('./katalog');
  const { einstellungBestand } = await import('./typen');
  const name = einstellungBestand(haushalt);
  const einst = await loadJson<AgentenEinstellung>(name).catch(() => null);
  if (!einst) return [];
  const offen = (e: HeadEinstellung | undefined) => !e?.autonomie || e.autonomie !== 'vorschlag';
  const haus = KATALOG.filter(h => h.ebene !== 'person' && offen(einst.heads[h.id]));
  const privat = KATALOG.filter(h => h.ebene === 'person' && Object.values(einst.personen ?? {}).some(p => offen(p?.heads?.[h.id])));
  const quoten = new Map<string, Annahme>();
  for (const h of [...haus, ...privat]) quoten.set(h.id, await annahmeFuerHead(h, haushalt, jetzt));
  const quote = (id: string) => quoten.get(id) ?? annahmeAus(0, 0);
  let geaendert: string[] = [];
  await updateJson<AgentenEinstellung>(name, cur => {
    if (!cur) return cur as unknown as AgentenEinstellung;
    const r = autonomieZurueckstufen(cur, haus, quote, jetzt.toISOString());
    geaendert = [...r.heads];
    let neu = r.einst;
    for (const [p, abschnitt] of Object.entries(cur.personen ?? {})) {
      if (!abschnitt) continue;
      const x = autonomieZurueckstufen({ v: 1, heads: abschnitt.heads ?? {} }, privat, quote, jetzt.toISOString());
      if (!x.heads.length) continue;
      geaendert = [...geaendert, ...x.heads.map(id => `${id}@${p}`)];
      neu = { ...neu, personen: { ...(neu.personen ?? {}), [p]: { heads: x.einst.heads } } };
    }
    return neu;
  });
  return geaendert;
}

/**
 * Die WIRKSAME Autonomie-Stufe eines Haushalts-Heads (Server; 09.10., Agenten-Datenschicht D2) — für den alten Heads-Lauf
 * (lib/heads/lauf.ts `autoUebernehmen`). Vorher las er nur `head-<id>.autonomie === 'aus'`: eine Stufe „vorschlag“ aus den Einstellungen
 * des Agenten-Bereichs (per Klick oder automatisch zurückgestuft, `autonomiePflegen`) erreichte ihn nie. Jetzt dieselbe Regel wie überall
 * (`autonomieLage`: Einstellung, Boden, schlechte Annahmequote → sofort „vorschlag“, auch bevor es gespeichert ist). Privat-Heads (Ebene
 * Person) und Fehler → „vorschlag“: die strengere Stufe gilt.
 */
export async function autonomieWirksam(headId: string, jetzt = new Date()): Promise<AutonomieStufe> {
  try {
    const { headDef } = await import('./katalog');
    const head = headDef(headId);
    if (!head || head.ebene === 'person') return 'vorschlag';
    const [{ loadJson }, { einstellungBestand }, { haushaltDesInhabers }] = await Promise.all([import('@/lib/store/local-db'), import('./typen'), import('@/lib/zugang/haushalt-inhaber')]);
    const haushalt = await haushaltDesInhabers();
    const einst = haushalt ? await loadJson<AgentenEinstellung>(einstellungBestand(haushalt)) : null;
    const annahme = await annahmeFuerHead(head, haushalt, jetzt);
    return autonomieLage(head, einst?.heads?.[head.id] as HeadEinstellungMitAutonomie | undefined, annahme).stufe;
  } catch (e) {
    console.error('[agenten-leistung] Autonomie nicht lesbar — der Head schlägt nur vor:', e instanceof Error ? e.message.slice(0, 120) : e);
    return 'vorschlag';
  }
}

/** Daten für ZOEs Monatsreview (Paket 4 holt sie): Business-Heads des Haushalts + eigene Privat-Heads — nur Zahlen. */
export async function reviewDaten(person: string, monat?: string): Promise<ReviewDaten> {
  const { sichtbareHeads } = await import('./skills-server');
  const { monatBerlin } = await import('@/lib/store/aenderungsprotokoll');
  const m = monat && /^\d{4}-(0[1-9]|1[0-2])$/.test(monat) ? monat : monatBerlin(new Date());
  const liste: (HeadLeistung & { autonomie: AutonomieStufe })[] = [];
  for (const h of await sichtbareHeads(person)) {
    const l = await leistungFuerHead(person, h, m);
    liste.push({ ...l, autonomie: l.autonomie.stufe });
  }
  return reviewDatenAus(m, liste);
}
