// ─── Agenten-Bereich: Plan-Freigabe auch über den Stapel (09.10., Paket 4b; Stapel-Art `plan`) ─────────────────────────────
// R14 (Fragerunde Teil 1 Nr. 10): vor großen Aufträgen (mehr als 2 Mitarbeiter in einem Zug oder Schätzung über der Schwelle) legt der Head
// eine Plan-Freigabe in seinen Thread (`Faden.plaene`, lib/agenten/delegation.ts). Bisher entschied man sie nur im Thread — jetzt steht sie
// zusätzlich unter „Wartet auf dich“ bzw. in den Freigaben, wie jeder andere Vorschlag (EIN Stapel, eine Entscheidung, Handy-Daumen).
//
//   • Bezug `{ art: 'plan', id: '<fadenId>:<planId>' }` — eindeutig je Plan; `lege` legt dieselbe Wirkung nie doppelt.
//   • Wer: nur die Besitzerin des Threads (die Person, für die der Head plante) — der Stapel-Eintrag trägt sie als `person`.
//   • Freigeben/Ablehnen im Stapel → `planEntscheiden` (dieselbe Schreibstelle wie der Knopf im Thread, Stand des Threads egal: geprüft wird,
//     dass der Plan noch offen ist). Entscheiden im Thread → der Stapel-Eintrag wird mit erledigt (`planStapelErledigen`).
//   • Der Eintrag nennt nur die Ziele der Aufträge (Text des Heads, gekürzt) und die Schätzung — keine Daten Dritter aus dem Thread.

import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import type { Vorschlag } from '@/lib/zoe/stapel';
import type { FadenKern } from './faeden';
import { istFadenId } from './faeden';
import { headDef } from './katalog';

export const PLAN_WERKZEUG = 'plan_freigabe';
export const AGENTEN_GRUPPE_PLAN = 'agenten';
const PLAN_ID = /^[a-z0-9][a-z0-9-]{2,80}$/;
const kurz = (t: string, n: number) => { const e = t.replace(/\s+/g, ' ').trim(); return e.length > n ? `${e.slice(0, n - 1)}…` : e; };

/** Bezug eines Plans im Stapel (rein). */
export const planBezug = (fadenId: string, planId: string) => ({ art: 'plan' as const, id: `${fadenId}:${planId}` });
/** Bezug zurück in Thread und Plan (rein) — oder null. */
export function planAusBezug(id: string): { fadenId: string; planId: string } | null {
  const i = id.indexOf(':');
  if (i < 0) return null;
  const fadenId = id.slice(0, i), planId = id.slice(i + 1);
  return istFadenId(fadenId) && PLAN_ID.test(planId) ? { fadenId, planId } : null;
}

/** Die Stapel-Einträge für die offenen Pläne eines Threads (rein): Titel, Nachher-Text, Eingabe. */
export function planEintraege(f: Pick<FadenKern, 'id' | 'besitzer' | 'agent' | 'plaene' | 'titel'>): Omit<Vorschlag, 'id' | 'zeit' | 'tag' | 'status'>[] {
  if (f.agent.art !== 'head') return [];
  const head = headDef(f.agent.headId);
  return (f.plaene ?? []).filter(p => p.status === 'offen').map(p => ({
    werkzeug: PLAN_WERKZEUG, gruppe: AGENTEN_GRUPPE_PLAN,
    titel: `Plan von ${head?.name ?? 'einem Head'}: ${p.auftraege.length} ${p.auftraege.length === 1 ? 'Auftrag' : 'Aufträge'} an Mitarbeiter`,
    nachher: [...p.auftraege.slice(0, 6).map(a => `• ${kurz(a.auftrag.ziel, 160)}`), ...(p.auftraege.length > 6 ? [`• … und ${p.auftraege.length - 6} weitere`] : []), ...(typeof p.schaetzungCent === 'number' ? [`Schätzung: ca. ${(Math.round(p.schaetzungCent) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`] : [])].join('\n'),
    eingabe: { fadenId: f.id, planId: p.id },
    anlass: kurz(p.grund || 'Plan-Freigabe vor einem großen Auftrag', 300),
    person: f.besitzer,
    quelle: 'lauf' as const,
    bezug: planBezug(f.id, p.id),
  }));
}

/** Die offenen Pläne eines eigenen Threads in den Stapel legen (idempotent: dieselbe Wirkung liegt nie doppelt da). Liefert die Zahl neuer. */
export async function planStapeln(person: string, fadenId: string): Promise<number> {
  const { eigenerFaden } = await import('./faeden-server');
  const f = await eigenerFaden(person, fadenId);
  if (!f || f.besitzer !== person) return 0;
  const eintraege = planEintraege(f);
  if (!eintraege.length) return 0;
  const { lege, lies } = await import('@/lib/zoe/stapel');
  const schon = new Set((await lies()).filter(v => v.bezug?.art === 'plan').map(v => v.bezug!.id));
  let n = 0;
  for (const e of eintraege) {
    if (schon.has(e.bezug!.id)) continue; // auch ein schon entschiedener Eintrag kommt nicht wieder
    await lege(e);
    n++;
  }
  return n;
}

/** Im Thread entschieden → den offenen Stapel-Eintrag mit erledigen (gleiche Entscheidung). Wirft nie. */
export async function planStapelErledigen(person: string, fadenId: string, planId: string, entscheidung: 'freigeben' | 'ablehnen'): Promise<void> {
  try {
    const { lies, entscheide } = await import('@/lib/zoe/stapel');
    const id = planBezug(fadenId, planId).id;
    for (const v of await lies('offen')) {
      if (v.bezug?.art !== 'plan' || v.bezug.id !== id || v.person !== person) continue;
      await entscheide(v.id, entscheidung === 'freigeben' ? 'freigegeben' : 'abgelehnt', { von: person, ergebnis: 'Im Thread entschieden.' });
    }
  } catch (e) { console.error('[agenten-plan-stapel] Eintrag nicht erledigt:', e instanceof Error ? e.message.slice(0, 120) : e); }
}

const NUR_DIE_PERSON_TEXT = 'Diesen Plan entscheidet nur die Person, für die der Head plante.';

/** Freigabe der Stapel-Art `plan` (lib/zoe/stapel-arten.ts): über `planEntscheiden` — dieselbe Schreibstelle wie im Thread. */
export const PLAN_STAPEL_ART: StapelArtFreigabe = {
  freigeben: async (v, person) => {
    const { beanspruche, entscheide, loslassen } = await import('@/lib/zoe/stapel');
    const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    if (!person || !(await personImHaushaltDesInhabers(person))) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
    const a = await beanspruche(v.id, person, x => {
      if (x.bezug?.art !== 'plan' || x.werkzeug !== PLAN_WERKZEUG || !planAusBezug(x.bezug.id)) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (!x.person || x.person !== person) return { status: 403, fehler: NUR_DIE_PERSON_TEXT };
      return null;
    });
    if (!a.ok) return { ok: false, status: a.status, fehler: a.fehler };
    try {
      const b = planAusBezug(a.v.bezug!.id)!;
      const { planEntscheiden } = await import('./delegation');
      const r = await planEntscheiden({ person, fadenId: b.fadenId, planId: b.planId, entscheidung: 'freigeben' });
      if (!r.ok) {
        await loslassen(a.v.id);
        return { ok: false, status: (r.status === 413 ? 409 : r.status) as 400 | 403 | 404 | 409, fehler: r.fehler };
      }
      const text = r.gestartet ? `Plan freigegeben — ${r.gestartet} ${r.gestartet === 1 ? 'Mitarbeiter arbeitet' : 'Mitarbeiter arbeiten'}.` : 'Plan freigegeben.';
      const e = await entscheide(a.v.id, 'freigegeben', { ergebnis: text, von: person, ausArbeit: true });
      return e ? { ok: true, text } : { ok: false, status: 409, fehler: 'Schon entschieden.' };
    } catch (e) {
      await loslassen(a.v.id);
      throw e;
    }
  },
  nachAblehnen: async (v, person) => {
    const b = v.bezug ? planAusBezug(v.bezug.id) : null;
    if (!b || v.person !== person) return;
    const { planEntscheiden } = await import('./delegation');
    await planEntscheiden({ person, fadenId: b.fadenId, planId: b.planId, entscheidung: 'ablehnen' }).catch(() => null);
  },
};
