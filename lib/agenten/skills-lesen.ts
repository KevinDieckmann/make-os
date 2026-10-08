// ─── Agenten-Bereich: Lese-Schnittstelle der Werkstatt (08.10. spät, Paket 0 „Vertrag“ — STUB) ────────────────
// Was der Kern (Paket 1: Head-Chat, Delegation, GET /api/agenten) aus der Werkstatt braucht: Skills (Name + Beschreibung immer,
// Anleitung nur bei Bedarf), Mitarbeiter eines Heads, Gedächtnis (Merksätze), Einstellungen. Paket 3 füllt diese Funktionen
// (liest `agenten-skills--<haushalt>`, `agenten-skills-privat--<person>`, `agenten-einstellung--<haushalt>`, baut die eingebauten
// Skills aus den Modi) — die SIGNATUREN bleiben, damit Paket 1 parallel dagegen bauen kann (AGENTEN_KONZEPT.md C11).
// Sichtbarkeit prüft der Aufrufer VORHER (lib/agenten/sicht.ts, Paket 1) — hier wird nur gelesen, nie geschrieben.

import { headDef, vorlagenFuer } from './katalog';
import { EINSTELLUNG_VORGABE, type AgentRef, type AgentenEinstellung, type Merksatz, type Mitarbeiter, type Skill, type SkillKurz, type Umfang } from './typen';

/** Skills eines Heads (eigene + eingebaute), nur Name und Beschreibung — das, was immer im Prompt steht. Stub: keine. */
export async function skillsFuerHead(_headId: string, _umfang: Umfang): Promise<SkillKurz[]> {
  return [];
}

/** Ein Skill mit Anleitung (`skill_laden`) — oder null (unbekannt bzw. nicht dieser Umfang). Stub: keiner. */
export async function skillLesen(_skillId: string, _umfang: Umfang): Promise<Skill | null> {
  return null;
}

/**
 * Die Mitarbeiter, die einem Head zur Verfügung stehen: eigene und Aushilfen (`auchFuer`), Vorlagen mit Überschreibungen und
 * selbst angelegte. Stub: nur die Vorlagen aus dem Katalog, alle an, ohne Gedächtnis.
 */
export async function mitarbeiterFuerHead(headId: string, _umfang: Umfang): Promise<Mitarbeiter[]> {
  if (!headDef(headId)) return [];
  return vorlagenFuer(headId).map(({ vorlage: v, heimat }) => ({
    id: v.id,
    headId: heimat,
    vorlageId: v.id,
    name: v.name,
    rolle: v.rolle,
    werkzeuge: [...v.werkzeuge],
    auchFuer: [...(v.auchFuer ?? [])],
    ...(v.agentId ? { agentId: v.agentId } : {}),
    stufe: v.stufe,
    ...(v.anbieter ? { anbieter: v.anbieter } : {}),
    aktiv: true,
    gedaechtnis: [],
    quelle: 'vorlage' as const,
  }));
}

/** Gedächtnis (Merksätze) eines Heads bzw. Mitarbeiters. Stub: leer. */
export async function gedaechtnisFuer(_agent: AgentRef, _umfang: Umfang): Promise<Merksatz[]> {
  return [];
}

/** Einstellungen der Heads eines Haushalts (an/aus, Modell, Budget, Not-Aus …). Stub: die Vorgabe. */
export async function einstellungFuer(_haushalt: string | null): Promise<AgentenEinstellung> {
  return { ...EINSTELLUNG_VORGABE, heads: {} };
}
