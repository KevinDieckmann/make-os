// ─── Der Prüfer der Heads (rein, getestet) ─────────────────────────────────
// Bevor ein Mensch etwas sieht:
//   1. Form: erlaubte Werte, Längen, höchstens fünf Vorschläge.
//   2. Kennungen: jede kontakt_id/chance_id/mandat_id/event_id muss existieren
//      — sonst wird der Vorschlag gestrichen (keine erfundenen Personen).
//   3. Kanal: ein Entwurf über einen Kanal, der für die Person nicht erlaubt
//      ist, wird GESTRICHEN (nicht nur markiert) — § 7 UWG ist kein Hinweis.
//   4. Werbesperre: Vorschläge zu gesperrten Personen fallen weg.
//   5. Vollzug: „habe gesendet / eingeladen“ ist verboten — der Head führt nichts aus.
//   6. Zahlen im Text müssen im Datenpaket stehen (wie beim Head of Finance).
//   7. Qualität (25.09.): Frist, Beleg, tragfähige Begründung; Entwurf mit
//      richtiger Anrede (Sie/Du laut Kartei), ohne Platzhalter, ohne verbotene
//      Wörter, höchstens 90 Wörter. Mängel gehen in die Korrekturrunde; ein
//      Entwurf, der danach noch falsch anredet oder Platzhalter trägt, wird
//      entfernt — der Vorschlag bleibt.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';
import { kanalStatus, type Kanal } from '@/lib/crm/recht';
import { pruefeText } from '@/lib/finanzen/chef/pruefung';
import { ARTEN, SIGNAL_TYPEN, type HeadId } from './prompt';
import { PLAYBOOKS } from '@/lib/crm/kampagnen';

const PLAYBOOK_IDS = new Set([...PLAYBOOKS.map(p => p.id), 'eigen']);

export interface Vorschlag {
  art: string; titel: string; begruendung: string;
  kontakt_id: string | null; chance_id: string | null; mandat_id: string | null; event_id: string | null;
  frist: string | null; prioritaet: 'hoch' | 'mittel' | 'niedrig'; dedup_schluessel: string; quelle: string[];
  entwurf: { kanal: 'mail' | 'linkedin' | 'telefon' | 'vernetzen' | 'persoenlich'; text: string } | null;
  /** Nur bei art „kampagne_planen“: Playbook, Name, Ziel und die ausgewählten Personen. */
  kampagne?: { playbook: string; name: string; ziel: string; kontakt_ids: string[] } | null;
  /** Das datierte Warum-jetzt (Pflicht für Priorität „hoch“, außer bei Frist/Zusage/Pflicht). */
  signal?: { typ: typeof SIGNAL_TYPEN[number]; datum: string | null; text: string } | null;
  /** Auszüge aus den Quellen — so sieht man in der Freigabe, worauf der Vorschlag steht. */
  belege?: string[];
  /** Woher: Regelwerk (Grundlauf) oder Modell. */
  herkunft?: 'regelwerk' | 'ki';
  /** Hinweise der Qualitätsprüfung, die nicht zum Streichen reichen. */
  maengel?: string[];
  /** Wer es tun soll — vom Code gesetzt (Beziehung/Zuständigkeit, sonst Verantwortung der Welt). */
  fuer?: string;
}
export interface Antwort { status: 'ruhig' | 'beobachten' | 'handeln'; zusammenfassung: string; befunde: { titel: string; text: string; quelle: string[] }[]; vorschlaege: Vorschlag[]; fragen: string[]; datenluecken: string[]; antwort: string; /** Grundlauf-Vorschläge, die das Modell bewusst verworfen hat — mit Grund. */ verworfen?: { dedup_schluessel: string; grund: string }[] }
export interface Pruefung { gestrichen: { titel: string; grund: string }[]; unbelegt: string[]; verstoesse: string[]; geprueft: number; /** Qualitätsmängel je Vorschlag (Titel → Mängel). */ maengel?: { titel: string; maengel: string[] }[] }

const s = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const idOder = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null);
const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const VOLLZUG = /\b(habe|hab|wurde|ist)\b[^.]{0,60}?(gesendet|versendet|verschickt|eingeladen|angerufen|gepostet|veröffentlicht|abgeschickt)(?![a-zäöüß])/i;

export function normalisiere(roh: unknown, head: HeadId): Antwort {
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const liste = (v: unknown) => (Array.isArray(v) ? v : []);
  const vorschlaege = liste(o.vorschlaege).slice(0, 6).map(x => {
    const v = (x ?? {}) as Record<string, unknown>;
    const e = v.entwurf && typeof v.entwurf === 'object' ? v.entwurf as Record<string, unknown> : null;
    const kanal = ['mail', 'linkedin', 'telefon', 'vernetzen', 'persoenlich'].includes(String(e?.kanal)) ? String(e!.kanal) as NonNullable<Vorschlag['entwurf']>['kanal'] : null;
    return {
      // Unbekannte Art → neutrale Handlung der Welt (nie „merken“: ein Merksatz entsteht nur ausdrücklich).
      art: ARTEN[head].includes(String(v.art)) ? String(v.art) : ({ sales: 'daten_pflegen', marketing: 'positionierung_schaerfen', event: 'ziel_schaerfen' } as const)[head],
      titel: s(v.titel, 140), begruendung: s(v.begruendung, 600),
      kontakt_id: idOder(v.kontakt_id), chance_id: idOder(v.chance_id), mandat_id: idOder(v.mandat_id), event_id: idOder(v.event_id),
      frist: tag(v.frist), prioritaet: (['hoch', 'mittel', 'niedrig'].includes(String(v.prioritaet)) ? v.prioritaet : 'mittel') as Vorschlag['prioritaet'],
      dedup_schluessel: s(v.dedup_schluessel, 120) || s(v.titel, 60).toLowerCase(), quelle: liste(v.quelle).map(q => s(q, 120)).slice(0, 6),
      entwurf: e && kanal && s(e.text, 1500) ? { kanal, text: s(e.text, 1500) } : null,
      signal: v.signal && typeof v.signal === 'object' ? (() => { const g = v.signal as Record<string, unknown>; return { typ: (SIGNAL_TYPEN as readonly string[]).includes(String(g.typ)) ? g.typ as typeof SIGNAL_TYPEN[number] : 'sonstiges', datum: tag(g.datum), text: s(g.text, 200) }; })() : null,
      kampagne: v.kampagne && typeof v.kampagne === 'object' ? (() => { const kp = v.kampagne as Record<string, unknown>; return { playbook: s(kp.playbook, 40), name: s(kp.name, 160), ziel: s(kp.ziel, 400), kontakt_ids: liste(kp.kontakt_ids).map(x => s(x, 80)).filter(Boolean).slice(0, 40) }; })() : null,
    } as Vorschlag;
  }).filter(v => v.titel);
  return {
    status: (['ruhig', 'beobachten', 'handeln'].includes(String(o.status)) ? o.status : 'beobachten') as Antwort['status'],
    zusammenfassung: s(o.zusammenfassung, 1200), antwort: s(o.antwort, 4000),
    befunde: liste(o.befunde).slice(0, 8).map(b => { const x = (b ?? {}) as Record<string, unknown>; return { titel: s(x.titel, 140), text: s(x.text, 600), quelle: liste(x.quelle).map(q => s(q, 120)).slice(0, 6) }; }).filter(b => b.titel),
    vorschlaege, fragen: liste(o.fragen).map(f => s(f, 300)).slice(0, 5), datenluecken: liste(o.datenluecken).map(f => s(f, 300)).slice(0, 6),
    verworfen: liste(o.verworfen).map(x => { const w = (x ?? {}) as Record<string, unknown>; return { dedup_schluessel: s(w.dedup_schluessel, 120), grund: s(w.grund, 300) }; }).filter(w => w.dedup_schluessel).slice(0, 10),
  };
}

const VERBOTEN = /\b(dashboard|tool|disruption|reporting)\b|einfach zu bedienen/i;
const PLATZHALTER = /\[[^\]]{1,30}\]|\{\{|\bXXX\b|<(name|firma|vorname)>/i;
const DU = /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|euch|euer)\b/i;
const SIE_FORMELL = /(?:^|[.!?]\s+|,\s*)?\b(Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer)\b/;
const woerter = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Pflicht-Signale (Frist, Zusage, Vertrag, Pflicht, Kunde) tragen „hoch“ auch älter; sonst höchstens 14 Tage. */
const PFLICHT_SIGNAL = new Set(['frist', 'zusage', 'pflicht', 'kunde']);
export function signalTraegt(v: Pick<Vorschlag, 'signal'>, heute: string): boolean {
  if (!v.signal) return false;
  if (PFLICHT_SIGNAL.has(v.signal.typ)) return true;
  if (!v.signal.datum) return false;
  const alter = (Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${v.signal.datum}T12:00:00Z`)) / 864e5;
  return alter <= 14;
}

/** Qualitätsrubrik je Vorschlag (rein): Mängel, und welche davon den Entwurf unbrauchbar machen. */
export function qualitaet(v: Vorschlag, k: Kontakt | undefined, heute: string): { maengel: string[]; entwurfUnbrauchbar: boolean } {
  const m: string[] = [];
  let weg = false;
  if (!v.frist) m.push('ohne Frist');
  else if (v.frist < heute) m.push('Frist liegt in der Vergangenheit');
  if (!v.quelle.length) m.push('ohne Beleg (quelle)');
  if (v.begruendung.trim().length < 30) m.push('Begründung zu dünn — warum gerade jetzt?');
  if (VERBOTEN.test(`${v.titel} ${v.begruendung}`)) m.push('verbotenes Wort im Titel oder in der Begründung');
  if (v.prioritaet === 'hoch' && !signalTraegt(v, heute)) m.push('„hoch“ ohne frisches Signal (höchstens 14 Tage) — auf „mittel“ gesetzt');
  if (v.entwurf) {
    const t = v.entwurf.text;
    if (PLATZHALTER.test(t)) { m.push('Platzhalter im Entwurf'); weg = true; }
    if (VERBOTEN.test(t)) { m.push('verbotenes Wort im Entwurf'); weg = true; }
    if (woerter(t) > 90) m.push(`Entwurf zu lang (${woerter(t)} Wörter, höchstens 90)`);
    const anrede = k?.anrede ?? 'Sie';
    if (anrede === 'Sie' && DU.test(t)) { m.push('Anrede falsch: Du statt Sie'); weg = true; }
    if (anrede === 'Du' && SIE_FORMELL.test(t)) { m.push('Anrede falsch: Sie statt Du'); weg = true; }
  }
  return { maengel: m, entwurfUnbrauchbar: weg };
}

export function pruefe(a: Antwort, daten: unknown, kontakte: Kontakt[], crm: CrmBestand, heuteArg?: string): { antwort: Antwort; pruefung: Pruefung } {
  const heute = heuteArg ?? String((daten as { meta?: { heute?: string } } | null)?.meta?.heute ?? new Date().toISOString().slice(0, 10));
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const gestrichen: Pruefung['gestrichen'] = [];
  const mandatJe = new Set(crm.mandate.filter(m => m.status === 'aktiv').flatMap(m => m.kontaktIds));
  const bleiben = a.vorschlaege.filter(v => {
    const weg = (grund: string) => { gestrichen.push({ titel: v.titel, grund }); return false; };
    if (v.chance_id && !crm.chancen.some(c => c.id === v.chance_id)) return weg('Chance gibt es nicht');
    if (v.mandat_id && !crm.mandate.some(m => m.id === v.mandat_id)) return weg('Mandat gibt es nicht');
    if (v.event_id && !crm.events.some(e => e.id === v.event_id)) return weg('Event gibt es nicht');
    if (v.kontakt_id) {
      const k = nachId.get(v.kontakt_id);
      if (!k) return weg('Person gibt es nicht');
      if (k.werbesperre) return weg('Person hat eine Werbesperre');
      if (v.entwurf && v.entwurf.kanal !== 'persoenlich') {
        const st = kanalStatus(k, v.entwurf.kanal as Kanal, { hatMandat: mandatJe.has(k.id), hatChance: crm.chancen.some(c => c.kontaktIds.includes(k.id)) });
        if (st.farbe === 'rot') return weg(`Kanal ${v.entwurf.kanal} nicht zulässig: ${st.grund}`);
      }
    } else if (v.entwurf && v.entwurf.kanal !== 'persoenlich') return weg('Entwurf ohne Person');
    if (v.kampagne) {
      if (!PLAYBOOK_IDS.has(v.kampagne.playbook)) return weg(`unbekanntes Vorgehen „${v.kampagne.playbook}“`);
      // Nur echte, nicht gesperrte Personen — Rest still aussortieren.
      v.kampagne.kontakt_ids = v.kampagne.kontakt_ids.filter(id => { const k = nachId.get(id); return k && !k.werbesperre; });
    }
    return true;
  });
  const maengel: NonNullable<Pruefung['maengel']> = [];
  for (const v of bleiben) {
    const q = qualitaet(v, v.kontakt_id ? nachId.get(v.kontakt_id) : undefined, heute);
    v.maengel = q.maengel.length ? q.maengel : undefined;
    if (q.maengel.length) maengel.push({ titel: v.titel, maengel: q.maengel });
    if (v.frist && v.frist < heute) v.frist = heute;
    // „hoch“ braucht ein frisches Signal — sonst wird es „mittel“ (Priorität vom Code, nicht vom Bauchgefühl des Modells).
    if (v.prioritaet === 'hoch' && !signalTraegt(v, heute)) v.prioritaet = 'mittel';
  }
  const alle = [a.zusammenfassung, a.antwort, ...a.befunde.map(b => b.text), ...bleiben.flatMap(v => [v.titel, v.begruendung, v.entwurf?.text ?? ''])].join('\n');
  const verstoesse: string[] = [];
  // „X ist noch nicht eingeladen“ ist ein Befund, keine Vollzugsmeldung.
  const vollzug = Array.from(alle.matchAll(new RegExp(VOLLZUG.source, 'gi'))).some(m => !/\b(nicht|noch kein|kein|keine)\b/i.test(m[0]));
  if (vollzug) verstoesse.push('Vollzugsformulierung — der Head führt nichts aus, er schlägt vor.');
  const z = pruefeText(alle, daten);
  return { antwort: { ...a, vorschlaege: bleiben }, pruefung: { gestrichen, unbelegt: z.unbelegt.map(f => f.text), verstoesse, geprueft: z.geprueft, ...(maengel.length ? { maengel } : {}) } };
}

export function korrekturAuftrag(p: Pruefung): string {
  return [
    'Der Prüfer hat Folgendes gefunden. Korrigiere die Antwort im selben Schema:',
    ...p.unbelegt.map(t => `- Zahl nicht im Datenpaket: „${t}“ — streichen oder aus den Daten belegen.`),
    ...p.verstoesse.map(t => `- ${t}`),
    ...p.gestrichen.map(g => `- Vorschlag „${g.titel}“ gestrichen: ${g.grund}. Nur IDs und Kanäle aus den Daten verwenden.`),
    ...(p.maengel ?? []).map(q => `- „${q.titel}“: ${q.maengel.join('; ')}.`),
  ].join('\n');
}
