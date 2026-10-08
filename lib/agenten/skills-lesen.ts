// ─── Agenten-Bereich: Lese-Schnittstelle der Werkstatt (08.10. spät, Paket 0 „Vertrag“; gefüllt 09.10., Paket 3) ─────────
// Was der Kern (Paket 1: Head-Chat, Delegation, GET /api/agenten) aus der Werkstatt braucht: Skills (Name + Beschreibung immer,
// Anleitung nur bei Bedarf), Mitarbeiter eines Heads, Gedächtnis (Merksätze), Einstellungen. Die SIGNATUREN stehen seit Paket 0 fest.
// Gelesen werden `agenten-skills--<haushalt>` (Ebene Haushalt), `agenten-skills-privat--<person>` (Ebene Person) und
// `agenten-einstellung--<haushalt>`; die eingebauten Skills kommen aus den Modi (lib/agenten/skills.ts `eingebauteSkills`).
// Sichtbarkeit prüft der Aufrufer VORHER (lib/agenten/sicht.ts, Paket 1) — hier wird nur gelesen, nie geschrieben.
// Regeln für den Prompt: nur `aktiv` geht als Skill in den Prompt; `skillLesen` liefert NUR aktive Skills (eine ungeprüfte Anleitung
// ist eine ungeprüfte Anweisung) — den Editor bedient die Route über lib/agenten/skills-server.ts.

import { headDef } from './katalog';
import { EINSTELLUNG_VORGABE, einstellungBestand, werkstattBestandFuer, type AgentRef, type AgentenEinstellung, type Merksatz, type Mitarbeiter, type Skill, type SkillKurz, type Umfang, type WerkstattBestand } from './typen';
import { ausVorlage, eingebauteSkills, mitarbeiterListe, skillKurz, werkstattLesen } from './skills';
import { loadJson } from '@/lib/store/local-db';

const PERSON = /^[a-z0-9-]{1,40}$/;

async function werkstatt(ebene: 'haushalt' | 'person', umfang: Umfang): Promise<WerkstattBestand> {
  if (!PERSON.test(umfang.person)) return werkstattLesen(null);
  const name = werkstattBestandFuer(ebene, umfang);
  return werkstattLesen(name ? await loadJson<WerkstattBestand>(name) : null);
}

/** Skills eines Heads (eingebaute + eigene), nur Name und Beschreibung — `aktiv` sagt, was in den Prompt gehört. */
export async function skillsFuerHead(headId: string, umfang: Umfang): Promise<SkillKurz[]> {
  const h = headDef(headId);
  if (!h) return [];
  const w = await werkstatt(h.ebene, umfang);
  return [...eingebauteSkills(h), ...w.skills.filter(s => s.headId === h.id).map(skillKurz)];
}

/** Ein AKTIVER Skill mit Anleitung (`skill_laden`) — oder null (unbekannt, aus, eingebaut bzw. nicht dieser Umfang). */
export async function skillLesen(skillId: string, umfang: Umfang): Promise<Skill | null> {
  if (!/^sk-[a-z0-9-]{1,60}$/.test(skillId)) return null;
  for (const ebene of ['haushalt', 'person'] as const) {
    const s = (await werkstatt(ebene, umfang)).skills.find(x => x.id === skillId);
    if (s) return s.aktiv && headDef(s.headId)?.ebene === ebene ? s : null;
  }
  return null;
}

/**
 * Die Mitarbeiter, die einem Head zur Verfügung stehen: eigene und Aushilfen (`auchFuer`), Vorlagen mit Überschreibungen und
 * selbst angelegte — mit Gedächtnis. Aus- bzw. abgeschaltete stehen mit `aktiv: false` darin (der Aufrufer entscheidet).
 */
export async function mitarbeiterFuerHead(headId: string, umfang: Umfang): Promise<Mitarbeiter[]> {
  const h = headDef(headId);
  if (!h) return [];
  const [w, einst] = await Promise.all([werkstatt(h.ebene, umfang), einstellungFuer(umfang.haushalt)]);
  const aus = new Set(Object.values(einst.heads).flatMap(e => e?.mitarbeiterAus ?? []));
  return mitarbeiterListe(h.id, w.mitarbeiter).map(m => (aus.has(m.id) ? { ...m, aktiv: false } : m));
}

/** Gedächtnis (Merksätze) eines Heads bzw. Mitarbeiters. */
export async function gedaechtnisFuer(agent: AgentRef, umfang: Umfang): Promise<Merksatz[]> {
  if (agent.art === 'zoe') return [];
  const h = headDef(agent.headId);
  if (!h) return [];
  const w = await werkstatt(h.ebene, umfang);
  if (agent.art === 'head') return [...(w.gedaechtnis[h.id] ?? [])];
  const m = w.mitarbeiter.find(x => x.id === agent.mitarbeiterId) ?? ausVorlage(agent.mitarbeiterId);
  return m ? [...m.gedaechtnis] : [];
}

/** Einstellungen der Heads eines Haushalts (an/aus, Modell, Budget, Not-Aus …) — ohne Bestand die Vorgabe. */
export async function einstellungFuer(haushalt: string | null): Promise<AgentenEinstellung> {
  if (!haushalt || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(haushalt)) return { ...EINSTELLUNG_VORGABE, heads: {} };
  const e = await loadJson<AgentenEinstellung>(einstellungBestand(haushalt));
  if (!e || typeof e !== 'object') return { ...EINSTELLUNG_VORGABE, heads: {} };
  return { ...EINSTELLUNG_VORGABE, ...e, heads: e.heads && typeof e.heads === 'object' ? e.heads : {} };
}
