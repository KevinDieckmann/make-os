// ─── Familie & Partnerschaft — Logik (rein, getestet) ───────────────────────
// Pflege-Rhythmus statt „Beziehungs-Score“: gemessen werden gemeinsame
// Rhythmen des Paares über 28 Tage, nie eine einzelne Person, nie Gefühle.
// Recherche 24.09.: Gewichte nach Wirksamkeit (Paar-Gespräch, Paarzeit,
// tägliche Rituale, Neues, Wertschätzung, Reparatur, Grenzen, Mental Load,
// wichtige Tage).

import { LISTEN, type Familie, type WichtigerTag, type Mensch, type Gespraech, type Einstellungen } from './typen';
import { alsTagesSchluessel } from '@/lib/kalender/geburtstag';

const tag = (d: Date) => d.toISOString().slice(0, 10);
const plus = (datum: string, n: number) => { const d = new Date(`${datum}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return tag(d); };
const TAGES_FORM = /^(\d{4}-)?\d{2}-\d{2}$/;
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
  const tageFaellig = wichtigeTage(f.tage, heute, 28, f.menschen).filter(t => t.faelligAb <= heute);
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

/**
 * Das Datum eines wichtigen Tages (MM-TT oder JJJJ-MM-TT): ein Geburtstag mit `menschId` liest es vom Menschen (der Mensch
 * führt, 29.09. K2); fehlt der Mensch oder sein Geburtstag, gibt es keins (null).
 */
export function tagDatum(t: Pick<WichtigerTag, 'datum' | 'menschId'>, menschen: readonly Pick<Mensch, 'id' | 'geburtstag'>[] = []): string | null {
  if (t.menschId) return alsTagesSchluessel(menschen.find(m => m.id === t.menschId)?.geburtstag);
  return TAGES_FORM.test(t.datum ?? '') ? t.datum : null;
}

/**
 * Rückweg-Kopie (Upload U1 B2, 29.09.): ein Geburtstag mit `menschId` trägt im Bestand IMMER auch `datum` („MM-TT“ bzw.
 * „JJJJ-MM-TT“, gespiegelt vom Menschen) — der alte Online-Stand af4679a kennt `menschId` nicht und rechnet mit `datum`
 * (`naechstes('')` warf dort RangeError). Gelesen wird weiter über `tagDatum` (der Mensch hat Vorrang). Rein.
 * - Mensch mit Geburtstag → `datum` = sein Tages-Schlüssel.
 * - Mensch ohne Geburtstag / gelöscht → die letzte gültige Kopie bleibt stehen.
 * - Gar kein gültiges Datum: NEUE Einträge (nicht in `bekannt`) fallen weg (`verworfen`), vorhandene bleiben unverändert.
 */
export function tageDatumSpiegeln(tage: WichtigerTag[], menschen: readonly Pick<Mensch, 'id' | 'geburtstag'>[], bekannt: ReadonlySet<string>): { tage: WichtigerTag[]; verworfen: number; geaendert: number } {
  let verworfen = 0, geaendert = 0;
  const aus = tage.flatMap(t => {
    if (!t.menschId) return [t];
    const datum = alsTagesSchluessel(menschen.find(m => m.id === t.menschId)?.geburtstag) ?? (TAGES_FORM.test(t.datum ?? '') ? t.datum : null);
    if (!datum) {
      if (bekannt.has(t.id)) return [t];
      verworfen++;
      return [];
    }
    if (datum === t.datum) return [t];
    geaendert++;
    return [{ ...t, datum }];
  });
  return { tage: aus, verworfen, geaendert };
}

export function wichtigeTage(tage: WichtigerTag[], heute: string, horizont = 60, menschen: readonly Pick<Mensch, 'id' | 'geburtstag'>[] = []) {
  return tage.flatMap(t => {
    const datum = tagDatum(t, menschen);
    if (!datum) return [];
    const am = naechstes(datum, heute);
    const faelligAb = plus(am, -t.vorlaufTage);
    return [{ ...t, datum, am, faelligAb, inTagen: zwischen(heute, am), erledigt: t.erledigt.includes(Number(am.slice(0, 4))) }];
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

/** Für ZOE: die Agenda des nächsten Gesprächs, vorbereitet aus den Daten (sortiert, nicht bewertet). */
export function agendaVorbereiten(f: Familie, heute: string, person: string) {
  const offeneThemen = f.themen.filter(t => (t.status === 'offen' || t.status === 'geparkt') && t.hut === 'privat' && (t.sichtbarkeit !== 'nur-ich' || t.von === person));
  const offeneVereinbarungen = f.vereinbarungen.filter(v => v.status === 'offen');
  const businessThemen = f.themen.filter(t => t.status === 'offen' && t.hut === 'business');
  const tage = wichtigeTage(f.tage, heute, 14, f.menschen);
  const faelligeKarten = f.karten.filter(k => k.aktiv && (!k.inhaber || !k.geprueft || zwischen(k.geprueft, heute) > 90));
  return { offeneThemen, offeneVereinbarungen, businessThemen, tage, faelligeKarten };
}

/** Was eine Person sehen darf: alles „paar“, dazu eigenes „nur-ich“. */
export function sichtFuer<T extends { von: string; sichtbarkeit?: string }>(liste: T[], person: string): T[] {
  return liste.filter(x => x.sichtbarkeit !== 'nur-ich' || x.von === person);
}

/**
 * Der ganze Bestand, wie ihn `person` sehen darf — die EINE Filterstelle des Familien-Moduls (vorher lokal in app/api/familie):
 * jede Liste über `sichtFuer` („nur ich“ der anderen Person nie), Reparatur-Reflexionen der anderen erst, wenn sie geteilt sind.
 * Route (Antwort) und Agenten-Kontext (Head „Familie & Partnerschaft“) lesen NUR hierüber.
 */
export function familieFuerPerson(f: Familie, person: string): Familie {
  const s = { ...f } as Familie & Record<string, unknown>;
  for (const l of LISTEN) (s as Record<string, unknown>)[l] = sichtFuer(((f[l] ?? []) as unknown as { von: string; sichtbarkeit?: string }[]), person);
  s.reparaturen = s.reparaturen.map(r => ({ ...r, reflexionen: r.reflexionen.filter(x => x.person === person || x.geteilt) }));
  return s;
}

const kurzText = (t: unknown, n: number) => { const e = String(t ?? '').replace(/\s+/g, ' ').trim(); return e.length > n ? `${e.slice(0, n - 1)}…` : e; };

/**
 * Auszug für die KI (Head „Familie & Partnerschaft“, 09.10. Feinschliff): NUR Titel, Datum, Art und Status — nie Gefühle, Reflexionen,
 * Wertschätzungen, Wünsche, Love-Map, Profile, Visionen oder Notizen. Läuft selbst durch `familieFuerPerson` (nie roh); Archiviertes fällt weg.
 * Rein — die Kapselung (`daten`) und die Freigabe der KI-Kategorie macht der Aufrufer.
 */
export function familieAuszug(roh: Familie, person: string, heute: string): { text: string; eintraege: number } {
  const f = familieFuerPerson(roh, person);
  const aktiv = <T extends { archiviertAm?: string }>(l: readonly T[] | undefined) => (l ?? []).filter(x => !x.archiviertAm);
  const zeilen: string[] = [];
  let n = 0;
  const block = (titel: string, l: string[]) => { if (l.length) { zeilen.push(`${titel}:`, ...l.map(x => `- ${x}`)); n += l.length; } };
  const g = naechstesGespraech(f.einstellungen, heute, f.gespraeche);
  zeilen.push(`Nächstes Paar-Gespräch: ${g.datum}${g.laufend ? ' (geplant)' : ''}${f.einstellungen.ausnahmeBis && f.einstellungen.ausnahmeBis >= heute ? ` · Ausnahmezeit bis ${f.einstellungen.ausnahmeBis}` : ''}`);
  block('Dates (nächste 60 Tage und die letzten 30)', aktiv(f.dates).filter(d => d.datum >= plus(heute, -30) && d.datum <= plus(heute, 60)).sort((a, b) => a.datum.localeCompare(b.datum))
    .slice(0, 20).map(d => `${d.datum} · ${kurzText(d.titel, 80)} · ${d.status}`));
  block('Wichtige Tage (60 Tage)', wichtigeTage(aktiv(f.tage), heute, 60, aktiv(f.menschen)).slice(0, 20)
    .map(t => `${t.am} · ${kurzText(t.titel, 80)} · ${t.art} · Aktion ${t.aktion}${t.erledigt ? ' · vorbereitet' : t.faelligAb <= heute ? ' · jetzt vorbereiten' : ''}`));
  block('Kontakt fällig', kontaktFaellig(aktiv(f.menschen), heute).slice(0, 10).map(m => `${kurzText(m.name, 60)} (${m.rolle}) · ${m.seit === null ? 'noch nie' : `seit ${m.seit} Tagen`}`));
  block('Offene Themen fürs Gespräch', aktiv(f.themen).filter(t => t.status === 'offen' || t.status === 'geparkt').slice(0, 15).map(t => `${kurzText(t.titel, 80)} · ${t.art} · ${t.status}`));
  block('Offene Vereinbarungen', aktiv(f.vereinbarungen).filter(v => v.status === 'offen').slice(0, 15).map(v => `${kurzText(v.text, 80)}${v.faellig ? ` · bis ${v.faellig}` : ''}`));
  block('Date-Ideen', aktiv(f.ideen).slice(0, 15).map(i => `${kurzText(i.titel, 60)} · ${i.dauer}${i.neu ? ' · neu' : ''}${i.tags.length ? ` · ${i.tags.slice(0, 3).join(', ')}` : ''}`));
  return { text: zeilen.join('\n'), eintraege: n };
}
