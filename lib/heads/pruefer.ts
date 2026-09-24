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

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';
import { kanalStatus, type Kanal } from '@/lib/crm/recht';
import { pruefeText } from '@/lib/finanzen/chef/pruefung';
import { ARTEN, type HeadId } from './prompt';
import { PLAYBOOKS } from '@/lib/crm/kampagnen';

const PLAYBOOK_IDS = new Set([...PLAYBOOKS.map(p => p.id), 'eigen']);

export interface Vorschlag {
  art: string; titel: string; begruendung: string;
  kontakt_id: string | null; chance_id: string | null; mandat_id: string | null; event_id: string | null;
  frist: string | null; prioritaet: 'hoch' | 'mittel' | 'niedrig'; dedup_schluessel: string; quelle: string[];
  entwurf: { kanal: 'mail' | 'linkedin' | 'telefon' | 'vernetzen' | 'persoenlich'; text: string } | null;
  /** Nur bei art „kampagne_planen“: Playbook, Name, Ziel und die ausgewählten Personen. */
  kampagne?: { playbook: string; name: string; ziel: string; kontakt_ids: string[] } | null;
}
export interface Antwort { status: 'ruhig' | 'beobachten' | 'handeln'; zusammenfassung: string; befunde: { titel: string; text: string; quelle: string[] }[]; vorschlaege: Vorschlag[]; fragen: string[]; datenluecken: string[]; antwort: string }
export interface Pruefung { gestrichen: { titel: string; grund: string }[]; unbelegt: string[]; verstoesse: string[]; geprueft: number }

const s = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const idOder = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null);
const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const VOLLZUG = /\b(habe|hab|wurde|ist)\b[^.]{0,60}?(gesendet|versendet|verschickt|eingeladen|angerufen|gepostet|veröffentlicht|abgeschickt)(?![a-zäöüß])/i;

export function normalisiere(roh: unknown, head: HeadId): Antwort {
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const liste = (v: unknown) => (Array.isArray(v) ? v : []);
  const vorschlaege = liste(o.vorschlaege).slice(0, 5).map(x => {
    const v = (x ?? {}) as Record<string, unknown>;
    const e = v.entwurf && typeof v.entwurf === 'object' ? v.entwurf as Record<string, unknown> : null;
    const kanal = ['mail', 'linkedin', 'telefon', 'vernetzen', 'persoenlich'].includes(String(e?.kanal)) ? String(e!.kanal) as NonNullable<Vorschlag['entwurf']>['kanal'] : null;
    return {
      art: ARTEN[head].includes(String(v.art)) ? String(v.art) : ARTEN[head][ARTEN[head].length - 1],
      titel: s(v.titel, 140), begruendung: s(v.begruendung, 600),
      kontakt_id: idOder(v.kontakt_id), chance_id: idOder(v.chance_id), mandat_id: idOder(v.mandat_id), event_id: idOder(v.event_id),
      frist: tag(v.frist), prioritaet: (['hoch', 'mittel', 'niedrig'].includes(String(v.prioritaet)) ? v.prioritaet : 'mittel') as Vorschlag['prioritaet'],
      dedup_schluessel: s(v.dedup_schluessel, 120) || s(v.titel, 60).toLowerCase(), quelle: liste(v.quelle).map(q => s(q, 120)).slice(0, 6),
      entwurf: e && kanal && s(e.text, 1500) ? { kanal, text: s(e.text, 1500) } : null,
      kampagne: v.kampagne && typeof v.kampagne === 'object' ? (() => { const kp = v.kampagne as Record<string, unknown>; return { playbook: s(kp.playbook, 40), name: s(kp.name, 160), ziel: s(kp.ziel, 400), kontakt_ids: liste(kp.kontakt_ids).map(x => s(x, 80)).filter(Boolean).slice(0, 40) }; })() : null,
    } as Vorschlag;
  }).filter(v => v.titel);
  return {
    status: (['ruhig', 'beobachten', 'handeln'].includes(String(o.status)) ? o.status : 'beobachten') as Antwort['status'],
    zusammenfassung: s(o.zusammenfassung, 1200), antwort: s(o.antwort, 4000),
    befunde: liste(o.befunde).slice(0, 8).map(b => { const x = (b ?? {}) as Record<string, unknown>; return { titel: s(x.titel, 140), text: s(x.text, 600), quelle: liste(x.quelle).map(q => s(q, 120)).slice(0, 6) }; }).filter(b => b.titel),
    vorschlaege, fragen: liste(o.fragen).map(f => s(f, 300)).slice(0, 5), datenluecken: liste(o.datenluecken).map(f => s(f, 300)).slice(0, 6),
  };
}

export function pruefe(a: Antwort, daten: unknown, kontakte: Kontakt[], crm: CrmBestand): { antwort: Antwort; pruefung: Pruefung } {
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
  const alle = [a.zusammenfassung, a.antwort, ...a.befunde.map(b => b.text), ...bleiben.flatMap(v => [v.titel, v.begruendung, v.entwurf?.text ?? ''])].join('\n');
  const verstoesse: string[] = [];
  if (VOLLZUG.test(alle)) verstoesse.push('Vollzugsformulierung — der Head führt nichts aus, er schlägt vor.');
  const z = pruefeText(alle, daten);
  return { antwort: { ...a, vorschlaege: bleiben }, pruefung: { gestrichen, unbelegt: z.unbelegt.map(f => f.text), verstoesse, geprueft: z.geprueft } };
}

export function korrekturAuftrag(p: Pruefung): string {
  return [
    'Der Prüfer hat Folgendes gefunden. Korrigiere die Antwort im selben Schema:',
    ...p.unbelegt.map(t => `- Zahl nicht im Datenpaket: „${t}“ — streichen oder aus den Daten belegen.`),
    ...p.verstoesse.map(t => `- ${t}`),
    ...p.gestrichen.map(g => `- Vorschlag „${g.titel}“ gestrichen: ${g.grund}. Nur IDs und Kanäle aus den Daten verwenden.`),
  ].join('\n');
}
