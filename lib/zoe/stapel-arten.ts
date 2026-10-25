// ─── MAKE OS — Arten im Freigabe-Stapel (28.09., Paket C4) ──────────────────
// Der Stapel kannte bisher nur Werkzeug-Vorschläge: Freigeben = `fuehreAus(werkzeug, eingabe, { erzwingen })`.
// Vorschläge mit `bezug` (lib/zoe/stapel.ts `StapelBezug`) gehören einer ART mit eigener Freigabe-Funktion —
// z. B. „aufgabe“ (ZOE hat eine Aufgabe vorbereitet, Paket C4). Sie laufen bewusst NICHT über ein Werkzeug:
// so kann kein Werkzeug-Aufruf aus dem Gespräch (auch kein eingeschleuster) einen solchen Vorschlag erzeugen,
// denn `bezug` setzt nur der Server-Lauf der Art selbst (`lege({ …, bezug })`).
//
// Vertrag je Art:
//   freigeben   — prüft (Person, noch offen, passt zum Bezug), übernimmt über den Schreibweg der Art und
//                 entscheidet den Eintrag SELBST als „freigegeben“ (mit Ergebnis). Schlägt es fehl, bleibt er offen.
//   nachAblehnen — optional: Folgeschritt am Bezug, nachdem die Route den Eintrag „abgelehnt“ gesetzt hat.
// Neue Art: `StapelArt` in stapel.ts ergänzen und hier einen Eintrag in `ARTEN` (per dynamischem Import, damit
// der Stapel keine Fach-Module in jedes Bündel zieht und keine Import-Kreise entstehen).

import type { StapelArt, Vorschlag } from './stapel';

export type ArtErgebnis = { ok: true; text: string } | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };

export interface StapelArtFreigabe {
  /**
   * `sammel` = Kennung einer Sammelfreigabe (29.09., #97) — alle darin freigegebenen Einträge tragen sie. `sitzung` (21.10., Prozesse C1): die Freigabe
   * kommt aus der Sitzung der Person selbst (nicht über den Dienstweg) — nur dann darf eine Art nach außen senden (N12).
   */
  freigeben: (v: Vorschlag, person: string, opt: { eingabe?: Record<string, unknown> | null; sammel?: string; sitzung?: boolean }) => Promise<ArtErgebnis>;
  nachAblehnen?: (v: Vorschlag, person: string) => Promise<unknown>;
}

const ARTEN: Partial<Record<StapelArt, () => Promise<StapelArtFreigabe>>> = {
  // Paket C4: ZOE hat eine Aufgabe vorbereitet — übernehmen über den Aufgaben-Schreibweg (lib/zoe/aufgaben-werkzeuge.ts).
  aufgabe: async () => (await import('./aufgaben-werkzeuge')).AUFGABE_STAPEL_ART,
  // Paket C7: ZOE hat in der Markttraktion etwas vorbereitet — übernehmen über die normalen CRM-Schreibwege (lib/zoe/crm-vorschlag.ts).
  crm: async () => (await import('./crm-vorschlag')).CRM_STAPEL_ART,
  // Paket 5 (09.10., Medien unterwegs): ein Head hat Auswahl, Zuschnitte und Texte vorgeschlagen — übernehmen am Medium (lib/medien/heads.ts).
  medien: async () => (await import('@/lib/medien/heads')).MEDIEN_STAPEL_ART,
  // Paket R-Z (#K2): der Kalender-Agent hat Blöcke vorgeschlagen — anlegen über den Termin-Schreibweg (lib/zoe/kalender-vorschlag.ts).
  kalender: async () => (await import('./kalender-vorschlag')).KALENDER_STAPEL_ART,
  // Agenten-Bereich (09.10., Paket 3): ein Agent hat einen Skill, einen Mitarbeiter bzw. einen Merksatz vorgeschlagen — übernehmen über
  // die Werkstatt (lib/agenten/skills-server.ts). Ein Skill wird dabei nur ein Entwurf: aktiv erst nach Testlauf und eigenem Klick.
  skill: async () => (await import('@/lib/agenten/skills-server')).SKILL_STAPEL_ART,
  mitarbeiter: async () => (await import('@/lib/agenten/skills-server')).MITARBEITER_STAPEL_ART,
  merksatz: async () => (await import('@/lib/agenten/skills-server')).MERKSATZ_STAPEL_ART,
  // Paket 4b (09.10.): Plan-Freigabe vor großen Aufträgen auch über den Stapel — entschieden über dieselbe Schreibstelle wie im Thread.
  plan: async () => (await import('@/lib/agenten/plan-stapel')).PLAN_STAPEL_ART,
  // Produkte (10.10., Leistungstreppe): Treppe aus einem Dokument übernehmen (nur die angehakten Teile), Fortschritts-Report erstellen (PDF am
  // Mandat — gesendet wird erst per Klick in der Inbox), nächste Stufe als Follow-up am Mandat (lib/crm/treppe-server.ts).
  produkte: async () => (await import('@/lib/crm/treppe-server')).TREPPE_STAPEL_ART,
  // Head of Recht (10.10.): Aufgabe aus dem Recht-Check, Katalog-Risiko übernehmen, Checkliste als Entwurf, Vertragsfrist am Vertrag, Anwalts-Mappe
  // (lib/recht/server.ts) — nur Personen mit Zugang zur Firmen-Akte; über die Schreibstellen von Schild, Register, Aufgaben und Ablage.
  recht: async () => (await import('@/lib/recht/server')).RECHT_STAPEL_ART,
  // Fulfillment (10.10.): Onboarding starten, Nachsorge (C1), Puls → Gespräch anbieten (C2), Analyse-Hinweise (C3) — verteilt nach Präfix
  // der Kennung (lib/fulfillment/stapel.ts); jeder Weg nur über die Schreibstellen des Pakets.
  fulfillment: async () => (await import('@/lib/fulfillment/stapel')).FULFILLMENT_STAPEL_ART,
  // Inbox (10.10., Roadmap Phase 1 „Aufgaben: Vorschläge aus Mails/WhatsApp“): ein Regelwerk hat in einer Nachricht einen Auftrag erkannt —
  // die Aufgabe entsteht erst hier, über den Aufgaben-Weg (/api/tasks/create), nur für die Person, in deren Inbox die Nachricht liegt.
  inbox: async () => (await import('@/lib/inbox/aufgaben-vorschlag-server')).INBOX_STAPEL_ART,
  // Prozesse (21.10., C1 „Laufen intern“): Freigabe bzw. Entscheidung eines Laufs — freigegeben/abgelehnt/abgelaufen treiben den Lauf weiter; eine
  // freigegebene Mail/WhatsApp geht sofort raus, als die freigebende Person aus der Sitzung (nie über den Dienstweg) — lib/prozesse/lauf-stapel.ts.
  prozess: async () => (await import('@/lib/prozesse/lauf-stapel')).PROZESS_STAPEL_ART,
  // Prozesse (22.10., Kundengewinnung): „Head fragen“ in der Werkstatt — ein ganzer Entwurf wird ein NEUER Prozess, Bausteine kommen nur DAZU (auf den aktuellen
  // Entwurf, über `werkstattAnwenden`); nur die anfragende Person, nur aus der Sitzung (lib/prozesse/kundengewinnung/head-server.ts).
  'prozess-entwurf': async () => (await import('@/lib/prozesse/kundengewinnung/head-server')).PROZESS_ENTWURF_STAPEL_ART,
  // Formulare (25.10.): ein angefordertes Angebot wartet auf „Senden“ — nur ein Inhaber, nur aus der Sitzung; stellen und verschicken über die eine
  // Versand-Funktion (lib/crm/angebot-versand.ts), Ablehnen vermerkt es am Eingang (der Entwurf bleibt im Angebots-Tool).
  'angebot-anfrage': async () => (await import('@/lib/crm/formulare-server')).ANGEBOT_ANFRAGE_STAPEL_ART,
};

/** Die Freigabe der Art dieses Vorschlags — `null` für gewöhnliche Werkzeug-Vorschläge (ohne Bezug). */
export async function stapelArtVon(v: Pick<Vorschlag, 'bezug'>): Promise<StapelArtFreigabe | null> {
  const laden = v.bezug ? ARTEN[v.bezug.art] : undefined;
  return laden ? laden() : null;
}

/** Ein Vorschlag mit Bezug, dessen Art (noch) niemand kennt, wird nie über `fuehreAus` ausgeführt. */
export const UNBEKANNTE_ART: ArtErgebnis = { ok: false, status: 409, fehler: 'Diese Art von Vorschlag kann hier nicht freigegeben werden.' };
