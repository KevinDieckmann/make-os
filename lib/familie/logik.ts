// ─── Familie & Partnerschaft — Logik (rein, getestet) ───────────────────────
// Pflege-Rhythmus statt „Beziehungs-Score“: gemessen werden gemeinsame
// Rhythmen des Paares über 28 Tage, nie eine einzelne Person, nie Gefühle.
// Recherche 24.09.: Gewichte nach Wirksamkeit (Paar-Gespräch, Paarzeit,
// tägliche Rituale, Neues, Wertschätzung, Reparatur, Grenzen, Mental Load,
// wichtige Tage).

import type { Familie, WichtigerTag, Mensch, Gespraech, Einstellungen } from './typen';

const tag = (d: Date) => d.toISOString().slice(0, 10);
const plus = (datum: string, n: number) => { const d = new Date(`${datum}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return tag(d); };
const zwischen = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

export interface Baustein { id: string; titel: string; gewicht: number; wert: number; text: string }
export interface Rhythmus { score: number | null; stufe: 'im-takt' | 'stabil' | 'aus-dem-takt' | 'fundament' | 'pause' | 'leer'; bausteine: Baustein[]; hinweis: string }

export function pflegeRhythmus(f: Familie, heute: string): Rhythmus {
  if (f.einstellungen.ausnahmeBis && f.einstellungen.ausnahmeBis >= heute) {
    return { score: null, stufe: 'pause', bausteine: [], hinweis: `Pausiert bis ${f.einstellungen.ausnahmeBis} — Ausnahmezeit, der Rhythmus zählt nicht.` };
  }
  const von = plus(heute, -27);
  const imFenster = (d: string) => d >= von && d <= heute;
  const gehalten = f.gespraeche.filter(g => g.status === 'gehalten' && imFenster(g.datum)).length;
  const dates = f.dates.filter(d => d.status === 'stattgefunden' && imFenster(d.datum));
  const neu60 = f.dates.some(d => d.status === 'stattgefunden' && d.neuesErlebnis && d.datum >= plus(heute, -59) && d.datum <= heute);
  const ritualTage = f.ritualtage.filter(r => imFenster(r.datum) && r.erledigt.length > 0).length;
  const wertTage = new Set(f.wertschaetzungen.filter(w => w.sichtbarkeit !== 'nur-ich' && imFenster(w.datum)).map(w => w.datum)).size;
  const reparaturOffen = f.reparaturen.filter(r => !r.abgeschlossen && zwischen(r.datum, heute) > 7).length;
  const grenzen = f.gespraeche.filter(g => imFenster(g.datum) && g.businessGrenzeGehalten !== null);
  const karten = f.karten.filter(k => k.aktiv);
  const kartenOk = karten.length ? karten.filter(k => k.inhaber && k.geprueft && zwischen(k.geprueft, heute) <= 90).length / karten.length : null;
  const tageFaellig = wichtigeTage(f.tage, heute, 28).filter(t => t.faelligAb <= heute);
  const tageOk = tageFaellig.length ? tageFaellig.filter(t => t.erledigt).length / tageFaellig.length : null;

  const q = (x: number) => Math.max(0, Math.min(1, x));
  const b: Baustein[] = [
    { id: 'gespraech', titel: 'Paar-Gespräch', gewicht: 20, wert: q(gehalten / 4), text: `${gehalten} von 4 Wochen gehalten` },
    { id: 'paarzeit', titel: 'Paarzeit & Dates', gewicht: 20, wert: q(dates.length / 4), text: `${dates.length} Dates in 4 Wochen` },
    { id: 'rituale', titel: 'Tägliche Verbindung', gewicht: 15, wert: q(ritualTage / (28 * 0.8)), text: `an ${ritualTage} von 28 Tagen` },
    { id: 'neues', titel: 'Neues erlebt', gewicht: 10, wert: neu60 ? 1 : 0, text: neu60 ? 'in den letzten 60 Tagen' : 'seit 60 Tagen nichts Neues' },
    { id: 'wertschaetzung', titel: 'Wertschätzung', gewicht: 10, wert: q(wertTage / 12), text: `an ${wertTage} Tagen ausgesprochen` },
    { id: 'reparatur', titel: 'Reparatur', gewicht: 10, wert: reparaturOffen ? 0 : 1, text: reparaturOffen ? `${reparaturOffen} länger als 7 Tage offen` : 'nichts offen' },
    { id: 'grenzen', titel: 'Business-Grenzen', gewicht: 5, wert: grenzen.length ? grenzen.filter(g => g.businessGrenzeGehalten).length / grenzen.length : 1, text: grenzen.length ? `${grenzen.filter(g => g.businessGrenzeGehalten).length} von ${grenzen.length} Wochen gehalten` : 'noch nicht gefragt' },
    { id: 'karten', titel: 'Aufgaben verteilt', gewicht: 5, wert: kartenOk ?? 1, text: kartenOk === null ? 'keine Karten aktiv' : `${Math.round(kartenOk * 100)} % mit Inhaber und geprüft` },
    { id: 'tage', titel: 'Wichtige Tage', gewicht: 5, wert: tageOk ?? 1, text: tageOk === null ? 'nichts fällig' : `${Math.round(tageOk * 100)} % rechtzeitig vorbereitet` },
  ];
  const leer = !f.gespraeche.length && !f.dates.length && !f.ritualtage.length && !f.wertschaetzungen.length;
  if (leer) return { score: null, stufe: 'leer', bausteine: b, hinweis: 'Noch nichts eingetragen. Der Anfang: einen festen Termin fürs Paar-Gespräch setzen.' };
  const score = Math.round(b.reduce((s, x) => s + x.gewicht * x.wert, 0));
  const schwach = b.filter(x => x.wert < 1).sort((x, y) => (y.gewicht * (1 - y.wert)) - (x.gewicht * (1 - x.wert)))[0];
  const stufe = score >= 80 ? 'im-takt' : score >= 60 ? 'stabil' : score >= 40 ? 'aus-dem-takt' : 'fundament';
  const hinweis = stufe === 'im-takt' ? 'Im Takt.'
    : stufe === 'fundament' ? 'Das Fundament braucht Zeit zu zweit — zuerst ein ruhiges Gespräch und ein Date, alles andere danach.'
    : schwach ? `Am meisten bringt gerade: ${schwach.titel} (${schwach.text}).` : '';
  return { score, stufe, bausteine: b, hinweis };
}

/** Nächstes Datum eines wiederkehrenden Tages (MM-TT oder JJJJ-MM-TT). */
export function naechstes(datum: string, heute: string): string {
  const mt = datum.length === 5 ? datum : datum.slice(5);
  const j = Number(heute.slice(0, 4));
  const kandidat = `${j}-${mt}`;
  return kandidat >= heute ? kandidat : `${j + 1}-${mt}`;
}

export function wichtigeTage(tage: WichtigerTag[], heute: string, horizont = 60) {
  return tage.map(t => {
    const am = naechstes(t.datum, heute);
    const faelligAb = plus(am, -t.vorlaufTage);
    return { ...t, am, faelligAb, inTagen: zwischen(heute, am), erledigt: t.erledigt.includes(Number(am.slice(0, 4))) };
  }).filter(t => t.inTagen <= horizont).sort((a, b) => a.am.localeCompare(b.am));
}

/** Wer ist mit einem Anruf/Besuch dran? */
export function kontaktFaellig(menschen: Mensch[], heute: string) {
  return menschen.filter(m => m.kontaktAlleTage).map(m => {
    const seit = m.letzterKontakt ? zwischen(m.letzterKontakt, heute) : null;
    return { ...m, seit, faellig: seit === null || seit >= (m.kontaktAlleTage as number) };
  }).filter(m => m.faellig).sort((a, b) => (b.seit ?? 999) - (a.seit ?? 999));
}

/** Das nächste Paar-Gespräch nach Einstellung (Wochentag 0 = Sonntag). */
export function naechstesGespraech(e: Einstellungen, heute: string, gespraeche: Gespraech[]): { datum: string; laufend: Gespraech | null } {
  const d = new Date(`${heute}T12:00:00Z`);
  const diff = (e.gespraech.wochentag - d.getUTCDay() + 7) % 7;
  const datum = plus(heute, diff);
  const laufend = gespraeche.find(g => g.status === 'geplant' && g.datum <= datum && g.datum >= plus(heute, -6)) ?? null;
  return { datum, laufend };
}

/** Für Jarvis: die Agenda des nächsten Gesprächs, vorbereitet aus den Daten (sortiert, nicht bewertet). */
export function agendaVorbereiten(f: Familie, heute: string, person: string) {
  const offeneThemen = f.themen.filter(t => (t.status === 'offen' || t.status === 'geparkt') && t.hut === 'privat' && (t.sichtbarkeit !== 'nur-ich' || t.von === person));
  const offeneVereinbarungen = f.vereinbarungen.filter(v => v.status === 'offen');
  const businessThemen = f.themen.filter(t => t.status === 'offen' && t.hut === 'business');
  const tage = wichtigeTage(f.tage, heute, 14);
  const faelligeKarten = f.karten.filter(k => k.aktiv && (!k.inhaber || !k.geprueft || zwischen(k.geprueft, heute) > 90));
  return { offeneThemen, offeneVereinbarungen, businessThemen, tage, faelligeKarten };
}

/** Was eine Person sehen darf: alles „paar“, dazu eigenes „nur-ich“. */
export function sichtFuer<T extends { von: string; sichtbarkeit?: string }>(liste: T[], person: string): T[] {
  return liste.filter(x => x.sichtbarkeit !== 'nur-ich' || x.von === person);
}
