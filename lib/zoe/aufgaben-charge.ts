// ─── ZOE an Aufgaben: Chargen und „Charge rückgängig“ (29.09., #97) ─────────
// Jeder ZOE-Lauf bekommt eine Charge (`eingabe._charge`, lib/zoe/aufgaben-lauf.ts), jede Sammelfreigabe eine eigene
// (`eingabe._sammel`, app/api/zoe/stapel). Die Freigabe legt in den Stapel-Eintrag, was sie an der Aufgabe änderte
// (`_vorher`/`_nachher` — Status, Deadline, Länge der Notiz — und `_neue`: angelegte Unteraufgaben; nie Texte).
// „Charge rückgängig“ nimmt alle freigegebenen Vorschläge einer Charge der Person zurück — je Aufgabe nur die Felder,
// die noch genau den freigegebenen Wert tragen (inzwischen von jemandem geändert → bleibt, mit Hinweis), angelegte
// Unteraufgaben gehen in den Papierkorb, solange sie unberührt sind. Idempotent über `zoe-chargen--<haushalt>`.
// Schreiben nur über den Aufgaben-Schreibweg (Verlauf, Protokoll).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { ZOE_AUFGABE_WERKZEUG } from '@/lib/aufgaben/zoe';
import { aufgabenAendern, ladeAufgabenSicht, type AufgabenOps } from '@/lib/aufgaben/speicher';
import type { Task } from '@/types/tasks';
import { lies, type Vorschlag } from './stapel';
import { notiere } from './protokoll';
import { aufgabeZoeAendern, type FreigabeVorher } from './aufgaben-werkzeuge';

export const CHARGE_ID = /^ch-[a-z0-9-]{6,60}$/;
const chargenSpeicher = (haushalt: string) => `zoe-chargen--${haushalt}`;
interface ChargenBestand { zurueck: Record<string, { am: string; von: string; charge: string }> }
const bestand = (roh: ChargenBestand | null | undefined): ChargenBestand => ({ zurueck: roh?.zurueck && typeof roh.zurueck === 'object' ? roh.zurueck : {} });

/** Die Charge eines freigegebenen Eintrags: Sammelfreigabe vor Lauf. */
export const chargeVon = (v: Pick<Vorschlag, 'eingabe'>): string | null => {
  const s = v.eingabe?._sammel, c = v.eingabe?._charge;
  return typeof s === 'string' && CHARGE_ID.test(s) ? s : typeof c === 'string' && CHARGE_ID.test(c) ? c : null;
};

function vorherLesen(v: Pick<Vorschlag, 'eingabe'>): FreigabeVorher | null {
  const e = v.eingabe ?? {};
  const vo = e._vorher as FreigabeVorher['vorher'] | undefined, na = e._nachher as FreigabeVorher['nachher'] | undefined;
  if (!vo || typeof vo !== 'object' || !na || typeof na !== 'object') return null;
  return { vorher: vo, nachher: na, neue: Array.isArray(e._neue) ? e._neue.filter((x): x is string => typeof x === 'string') : [] };
}

export interface ChargeSicht { charge: string; art: 'lauf' | 'sammel'; am: string; eintraege: { stapelId: string; aufgabeId: string; titel: string; zurueck: boolean }[] }

/** Die Chargen der Person (freigegebene Aufgaben-Vorschläge, die sie entschieden hat), neueste zuerst. */
export async function chargenFuer(person: string): Promise<ChargeSicht[]> {
  const h = (await haushaltFuer(person))?.haushalt;
  const zurueck = h ? bestand(await loadJson<ChargenBestand>(chargenSpeicher(h))).zurueck : {};
  const je = new Map<string, ChargeSicht>();
  for (const v of await lies('freigegeben')) {
    if (v.werkzeug !== ZOE_AUFGABE_WERKZEUG || v.bezug?.art !== 'aufgabe' || v.person !== person || !vorherLesen(v)) continue;
    const c = chargeVon(v);
    if (!c) continue;
    const s = je.get(c) ?? { charge: c, art: typeof v.eingabe._sammel === 'string' ? 'sammel' as const : 'lauf' as const, am: v.entschiedenAm ?? v.zeit, eintraege: [] };
    s.eintraege.push({ stapelId: v.id, aufgabeId: v.bezug.id, titel: v.titel, zurueck: !!zurueck[v.id] });
    if ((v.entschiedenAm ?? v.zeit) > s.am) s.am = v.entschiedenAm ?? v.zeit;
    je.set(c, s);
  }
  return Array.from(je.values()).sort((a, b) => b.am.localeCompare(a.am));
}

export interface ChargeBericht { zurueck: number; teilweise: { titel: string; grund: string }[]; schon: number }

/** Eine Aufgabe auf die Werte vor der Freigabe zurück — nur Felder, die noch den freigegebenen Wert tragen. */
function zurueckRechnen(t: Task, p: FreigabeVorher): { task: Task; felder: string[]; bleibt: string[] } {
  const n: Task = { ...t };
  const felder: string[] = [], bleibt: string[] = [];
  if (p.vorher.status !== p.nachher.status || (p.vorher.statusId ?? '') !== (p.nachher.statusId ?? '')) {
    if (t.status === p.nachher.status && (t.statusId ?? '') === (p.nachher.statusId ?? '')) {
      n.status = p.vorher.status;
      if (p.vorher.statusId) n.statusId = p.vorher.statusId; else delete n.statusId;
      if (p.vorher.completedAt) n.completedAt = p.vorher.completedAt; else delete n.completedAt;
      felder.push('Status');
    } else bleibt.push('Status (inzwischen geändert)');
  }
  if ((p.vorher.dueDate ?? '') !== (p.nachher.dueDate ?? '')) {
    if ((t.dueDate ?? '') === (p.nachher.dueDate ?? '')) { if (p.vorher.dueDate) n.dueDate = p.vorher.dueDate; else delete n.dueDate; felder.push('Deadline'); }
    else bleibt.push('Deadline (inzwischen geändert)');
  }
  if (p.nachher.notizLaenge > p.vorher.notizLaenge) {
    // Nur, wenn niemand danach in der Notiz geschrieben hat (gleiche Länge wie nach der Freigabe).
    if ((t.notiz ?? '').length === p.nachher.notizLaenge) { const rest = (t.notiz ?? '').slice(0, p.vorher.notizLaenge); if (rest) n.notiz = rest; else delete n.notiz; felder.push('Notiz'); }
    else bleibt.push('Notiz (inzwischen weitergeschrieben)');
  }
  return { task: n, felder, bleibt };
}

/** „Charge rückgängig“ — nur eigene Freigaben; idempotent. */
export async function chargeZurueck(charge: string, person: string): Promise<ChargeBericht> {
  const h = (await haushaltFuer(person))?.haushalt;
  if (!h || !CHARGE_ID.test(charge)) return { zurueck: 0, teilweise: [], schon: 0 };
  const erledigt = bestand(await loadJson<ChargenBestand>(chargenSpeicher(h))).zurueck;
  const liste = (await lies('freigegeben')).filter(v => v.werkzeug === ZOE_AUFGABE_WERKZEUG && v.bezug?.art === 'aufgabe' && v.person === person && chargeVon(v) === charge);
  const bericht: ChargeBericht = { zurueck: 0, teilweise: [], schon: 0 };
  const jetzt = new Date().toISOString();
  for (const v of liste) {
    if (erledigt[v.id]) { bericht.schon++; continue; }
    const p = vorherLesen(v);
    if (!p) { bericht.teilweise.push({ titel: v.titel, grund: 'ohne Vorher-Werte (vor dem 29.09. freigegeben)' }); continue; }
    let bleibt: string[] = [];
    const r = await aufgabeZoeAendern(v.bezug!.id, t => {
      const x = zurueckRechnen(t, p);
      bleibt = x.bleibt;
      if (!x.felder.length) return { status: 409, fehler: 'nichts mehr zurückzunehmen' };
      return { task: { ...x.task, updatedAt: jetzt } };
    }, { person });
    // Angelegte Unteraufgaben: unberührt (offen, nie geändert) → Papierkorb.
    const sicht = await ladeAufgabenSicht(person);
    const weg = p.neue.filter(id => { const u = sicht.tasks.find(x => x.id === id); return !!u && u.status === 'todo' && u.updatedAt === u.createdAt; });
    if (weg.length) {
      const ops: AufgabenOps = { tasks: weg.map(id => ({ op: 'delete' as const, id })), projects: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] };
      await aufgabenAendern(ops, { person, wer: { art: 'person', person } });
    }
    const unberuehrt = p.neue.length - weg.length;
    if (unberuehrt > 0) bleibt.push(`${unberuehrt} Unteraufgabe${unberuehrt === 1 ? '' : 'n'} (inzwischen bearbeitet)`);
    if (r.ok || weg.length) bericht.zurueck++;
    if (bleibt.length) bericht.teilweise.push({ titel: v.titel, grund: `bleibt: ${bleibt.join(', ')}` });
    else if (!r.ok && !weg.length) bericht.teilweise.push({ titel: v.titel, grund: r.fehler });
    await updateJson<ChargenBestand>(chargenSpeicher(h), cur => { const b = bestand(cur); return { zurueck: { ...b.zurueck, [v.id]: { am: jetzt, von: person, charge } } }; });
  }
  await notiere({ werkzeug: 'charge_rueckgaengig', gruppe: 'aufgaben', risiko: 'freigabe', eingabe: { charge }, ergebnis: `${bericht.zurueck} zurückgenommen${bericht.teilweise.length ? `, ${bericht.teilweise.length} teilweise` : ''}`, ok: true, quelle: 'stapel', person, ruecknahme: null });
  return bericht;
}
