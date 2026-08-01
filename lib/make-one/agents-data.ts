// ─── MAKE OS — Agenten-Organisation & Verwaltung (recherchiert 2026) ─────────
// 3 Ebenen: MAKE (Orchestrator) → Abteilungsleiter → Spezialist-Worker.
// Jeder Agent: Status, Autonomie, Modell, Funktionen, Bauplan, Freigabe-Gate.

export type AgentStatus = 'live' | 'teil' | 'geplant';
export const STATUS_LABEL: Record<AgentStatus, string> = { live: 'live', teil: 'teil-live', geplant: 'geplant' };

export type Autonomy = 'autonom' | 'entwurf' | 'freigabe' | 'vorschlag';
export const AUTONOMY_ORDER: Autonomy[] = ['vorschlag', 'entwurf', 'freigabe', 'autonom'];
export const AUTONOMY_LABEL: Record<Autonomy, string> = {
  vorschlag: 'nur Vorschlag', entwurf: 'Entwurf', freigabe: 'mit Freigabe', autonom: 'autonom',
};

export type ModelTier = 'schnell' | 'ausgewogen' | 'stark';
export const MODEL_LABEL: Record<ModelTier, string> = { schnell: 'schnell (klein)', ausgewogen: 'ausgewogen', stark: 'stark (Reasoning)' };

export interface DeptAgent {
  id: string; name: string; role: string;
  status: AgentStatus; autonomy: Autonomy; model: ModelTier;
  gate?: string; funktionen: string[]; bauplan: string; href?: string;
}
export interface Department { id: string; name: string; mission: string; color: string; lead: string; agents: DeptAgent[]; }

export const ORCHESTRATOR = {
  name: 'JARVIS · Chief of Staff',
  note: 'Nimmt deinen Auftrag entgegen, routet an die Abteilungen, hält den geteilten Kontext, führt Ergebnisse zusammen und verwaltet ALLE Freigaben zentral. Großes Modell, volle Autonomie im Delegieren — null Autonomie nach außen.',
};

export const DEPARTMENTS: Department[] = [
  {
    id: 'ops', name: 'Operations', mission: 'Alles am Laufen halten — Inbox, Aufgaben, Zeit, Wissen.', color: '#21B5AA', lead: 'Ops Lead',
    agents: [
      { id: 'inbox', name: 'Inbox-Agent', role: 'Postfach triagieren & Antworten entwerfen', status: 'live', autonomy: 'entwurf', model: 'ausgewogen', gate: 'Versand ✋', href: '/os/inbox',
        funktionen: ['Triage nach Dringlichkeit', 'Zusammenfassung + Kontext', 'Antwort-Entwurf in deiner Stimme', 'In Aufgabe/Delegation wandeln'],
        bauplan: 'Apple Mail (osascript) + M365 lesen; Anthropic für Triage & Draft; Entwurf öffnet in Mail.app (Versand = du). Läuft.' },
      { id: 'task', name: 'Task-Agent', role: 'Aus allem Aufgaben machen & nachhalten', status: 'live', autonomy: 'freigabe', model: 'schnell', href: '/os/aufgaben',
        funktionen: ['Aus Zuruf/Mail Aufgabe anlegen', 'Priorität & Owner setzen', 'Fällig & Erinnern'],
        bauplan: 'Tool-Use create_task → lokaler Store, Bestätigungs-Button. Läuft.' },
      { id: 'kalender', name: 'Kalender-Agent', role: 'Zeit schützen, Blöcke legen', status: 'live', autonomy: 'freigabe', model: 'schnell', gate: 'Einladungen ✋', href: '/os/kalender',
        funktionen: ['Echte Termine lesen (Apple Kalender)', 'Konflikte/Überlappungen markieren', 'Reha- & Fokus-Blöcke in freie Lücken vorschlagen', 'Auf Klick in den Kalender eintragen'],
        bauplan: 'LIVE: osascript liest+schreibt Apple Kalender, Konflikt-Erkennung deterministisch in JS, Schutz-Blöcke von Anthropic (Reha wg. Bandscheibe + Deep-Work). Eintragen mit Freigabe. M365-Write folgt. → /os/kalender' },
      { id: 'meeting', name: 'Meeting-Agent', role: 'Mitschreiben → Action-Items', status: 'live', autonomy: 'entwurf', model: 'ausgewogen', href: '/os/meeting',
        funktionen: ['Transkript/Notizen → Protokoll', 'Zusammenfassung + Entscheidungen', 'Action-Items mit Owner/Prio/Projekt', 'Auf Klick in echte Aufgaben übernehmen'],
        bauplan: 'LIVE: Transkript einfügen → Anthropic (streng JSON: Titel/Summary/Entscheidungen/ActionItems) → Übernahme in echten Task-Store (/api/tasks/create), Human-in-the-Loop. Auto-Mitschrift (Granola/Fireflies) als Zusatz. → /os/meeting' },
      { id: 'wissen', name: 'Dokument-/Wissens-Agent', role: 'Ablage, Verträge, Suche im Vault', status: 'geplant', autonomy: 'autonom', model: 'schnell',
        funktionen: ['Vault/Brain durchsuchen', 'Verträge finden & ablegen', 'Kontext für MAKE liefern'],
        bauplan: 'RAG über KEMA_Brain + Vault-Dateien (lokal, Embeddings), read-only. Braucht Indexierung.' },
    ],
  },
  {
    id: 'sales', name: 'Sales / Revenue', mission: 'Direkt am 1-Mio-Nordstern — Leads, Pipeline, Abschluss.', color: '#4A6CF7', lead: 'Revenue Lead',
    agents: [
      { id: 'prospect', name: 'Prospecting-Agent', role: 'Signalbasierte Zielliste (CAPOS-Persona)', status: 'live', autonomy: 'autonom', model: 'schnell', href: '/os/prospecting',
        funktionen: ['Zielliste + editierbares ICP (CapOS)', 'KI-Qualifizierung: Score + Fit + Aufhänger', 'Pipeline: Neu → Qualifiziert → Kontaktiert', 'Echte Firmen via Explorium/Vibe seeden'],
        bauplan: 'LIVE: Anthropic bewertet jede Firma gegen dein ICP (Score 0–100, Fit, Aufhänger), lokal gespeichert. Datenzufuhr aktuell über die Session (Explorium/Vibe), Direktanbindung folgt. → /os/prospecting' },
      { id: 'crm', name: 'CRM-/Pipeline-Agent', role: 'Deals, Forecast, Next-Best-Action', status: 'geplant', autonomy: 'freigabe', model: 'ausgewogen',
        funktionen: ['Deals aktuell halten', 'Forecast', 'Next-Best-Action vorschlagen'],
        bauplan: 'HubSpot-API-Anbindung; Schreib-Aktionen mit Freigabe.' },
      { id: 'outreach', name: 'Outreach-Agent', role: 'Personalisierte Ansprache-Entwürfe', status: 'live', autonomy: 'entwurf', model: 'ausgewogen', gate: 'Versand ✋', href: '/os/prospecting',
        funktionen: ['E-Mail + LinkedIn-Erstansprache in Kevins Stimme', 'Aufhänger aus dem Scoring', 'Übergabe an Apple Mail — Versand bei Kevin'],
        bauplan: 'Läuft: /api/outreach aus Score/Fit/Aufhänger + ICP; Entwurf in der Zielliste, Versand nur durch Kevin.' },
    ],
  },
  {
    id: 'marketing', name: 'Marketing', mission: 'Inbound & Marke bei Solo-Kapazität.', color: '#AC9D80', lead: 'Marketing Lead',
    agents: [
      { id: 'content', name: 'Content-/Brand-Agent', role: 'Artikel, Social, Landingpages in deiner CI', status: 'live', autonomy: 'entwurf', model: 'ausgewogen', gate: 'Publizieren ✋', href: '/os/content',
        funktionen: ['LinkedIn-Post / Fachartikel / Landingpage / Kalt-E-Mail', 'In KEMARIS-CI (Sprachregeln verbindlich)', 'Thema + Notizen → fertiger Entwurf', 'Kopieren & selbst veröffentlichen'],
        bauplan: 'LIVE: Anthropic mit Brand-Voice-Prompt (KEMARIS-Terminologie: NIEMALS Dashboard/Tool/Disruption…, Macht-Vokabular Souveränität/Alpha/Capital Readiness). Entwurf-Autonomie, Publish bleibt dein Klick. → /os/content' },
      { id: 'funnel', name: 'Kampagnen-/Funnel-Agent', role: 'E-Mail-Sequenzen, Funnel', status: 'geplant', autonomy: 'entwurf', model: 'ausgewogen', gate: 'Versand ✋',
        funktionen: ['E-Mail-Sequenzen entwerfen', 'Funnel-Logik', 'A/B-Vorschläge'],
        bauplan: 'Sequenz-Templates + Anthropic; an Leadmaschine/HubSpot andocken.' },
      { id: 'seo', name: 'SEO-/Analytics-Agent', role: 'Performance & Sichtbarkeit', status: 'geplant', autonomy: 'autonom', model: 'schnell',
        funktionen: ['Keyword-/Sichtbarkeits-Check', 'Performance-Report', 'Content-Lücken'],
        bauplan: 'Read-only Analytics-Pull + Anthropic-Synthese.' },
    ],
  },
  {
    id: 'finance', name: 'Finance', mission: 'Zahlen, Liquidität, Kapital-Kurs.', color: '#00C9B8', lead: 'Finance Lead',
    agents: [
      { id: 'controlling', name: 'Controlling-Agent', role: 'Umsatz gg. 1-Mio-Ziel, Runway', status: 'live', autonomy: 'autonom', model: 'schnell', href: '/os/controlling',
        funktionen: ['Umsatz vs. 1-Mio-Ziel + Fortschritt', 'Nötige Run-Rate & Runway (live gerechnet)', 'KI-Lagebericht: Fokus + Risiken', 'Monatsverlauf gg. Ziel-Linie'],
        bauplan: 'LIVE: Ist-Zahlen pflegst du, Kennzahlen deterministisch in JS (computeMetrics), Lagebericht von Anthropic (rechnet nichts, interpretiert nur). DATEV/Bank-Anbindung später. → /os/controlling' },
      { id: 'board', name: 'Reporting-/Board-Agent', role: 'Kennzahlen, Board-Packs, Cap-Table-Sicht', status: 'live', autonomy: 'entwurf', model: 'stark', href: '/os/board',
        funktionen: ['Kennzahlen aus Controlling + Pipeline + Aufgaben', 'Executive Summary + Sektionen', 'Risiken + Fokus nächste Woche', 'Wochen-/Board-Pack auf Knopfdruck'],
        bauplan: 'LIVE: aggregiert Finance + Prospects + Tasks (Kennzahlen deterministisch in JS), Anthropic schreibt das Narrativ. Cap-Table-Sicht später. → /os/board' },
    ],
  },
  {
    id: 'strategie', name: 'Strategie / Ventures', mission: 'Richtung, Markt-Edge, KD-Ventures-Pipeline.', color: '#005F73', lead: 'Strategy Lead',
    agents: [
      { id: 'research', name: 'Markt-/Research-Agent', role: 'Belegte Recherche, Wettbewerb (parallel)', status: 'live', autonomy: 'autonom', model: 'schnell', href: '/os/research',
        funktionen: ['Markt-/Wettbewerbs-Recherche mit Web-Suche', 'Belegte Reports mit Quellen', 'Förder-/BSFZ-Fragen recherchieren'],
        bauplan: 'LIVE: Anthropic Messages + server-seitiges web_search-Tool, read-only → keine Freigabe. Fällt ohne Suchtool sauber auf reine Antwort zurück. → /os/research' },
      { id: 'brain', name: 'Kontext-/Brain-Agent', role: 'Team, Tasks & Meilensteine aus Miro spiegeln', status: 'teil', autonomy: 'autonom', model: 'schnell',
        funktionen: ['Miro-Board spiegeln', 'Widersprüche flaggen', 'Delegation vorschlagen'],
        bauplan: 'Miro-API (später) → geteilter Kontext; aktuell manueller Snapshot. Teils da.' },
      { id: 'okr', name: 'OKR-/Ziel-Agent', role: 'Weg zum 1-Mio-Ziel, MSI-Anbindung', status: 'live', autonomy: 'vorschlag', model: 'stark', href: '/os/okr',
        funktionen: ['Nordstern → Objectives + Key Results', 'Echte Aufgaben den Zielen zuordnen', 'Lücken flaggen (wo nichts einzahlt)', 'Live gegen Controlling-Zahlen'],
        bauplan: 'LIVE: liest Controlling-Zahlen + echte Aufgaben, Anthropic baut OKR-Baum, ordnet vorhandene Tasks zu & benennt Lücken. Vorschlag — du entscheidest. → /os/okr' },
    ],
  },
  {
    id: 'product', name: 'Product (CapOS / MAKE OS)', mission: 'Das Produkt bauen & schärfen.', color: '#7BC950', lead: 'Product Lead',
    agents: [
      { id: 'roadmap', name: 'Roadmap-/Spec-Agent', role: 'PRDs, Priorisierung', status: 'geplant', autonomy: 'entwurf', model: 'stark',
        funktionen: ['PRDs entwerfen', 'RICE-Priorisierung', 'Roadmap-Vorschlag'],
        bauplan: 'Anthropic-Draft aus Feedback + Zielen; Entwurf.' },
      { id: 'feedback', name: 'Research-/Feedback-Agent', role: 'User-Insights synthetisieren', status: 'geplant', autonomy: 'autonom', model: 'schnell',
        funktionen: ['Feedback sammeln (Inbox/HubSpot)', 'Themen clustern', 'Top-Insights'],
        bauplan: 'Sammelt Feedback → Anthropic-Themen; read-only.' },
      { id: 'engqa', name: 'Eng-/QA-Agent', role: 'Architektur & Review', status: 'geplant', autonomy: 'freigabe', model: 'stark',
        funktionen: ['Architektur-Entscheide', 'Code-Review', 'Förderfähige Pakete markieren'],
        bauplan: 'Claude-Code-Muster; Änderungen mit Freigabe.' },
    ],
  },
  {
    id: 'people', name: 'People / Founder-Care', mission: 'Team — und dich. Ruhe, Fokus, Gesundheit.', color: '#1A4A3A', lead: 'People Lead',
    agents: [
      { id: 'fokus', name: 'Fokus-/Entscheidungs-Agent', role: 'Recovery × Prioritäten → Tagesform', status: 'live', autonomy: 'entwurf', model: 'stark', href: '/os/fokus',
        funktionen: ['Tag nach Recovery takten', 'Die EINE nächste Aktion', 'Overload verhindern'],
        bauplan: 'Whoop + Store-Tasks → Anthropic-Empfehlung. Läuft (/os/fokus).' },
      { id: 'health', name: 'Health-Agent', role: 'Whoop, Journal, Routinen, Reha', status: 'teil', autonomy: 'autonom', model: 'schnell',
        funktionen: ['Recovery-Nudges', 'Reha spine-safe führen', 'Trigger-Tagebuch für Ärzte'],
        bauplan: 'Journal/Routinen/Whoop lokal (läuft); Whoop-Coach-Kopplung als Nächstes.' },
      { id: 'team', name: 'Team-/HR-Agent', role: 'Team-Struktur, Onboarding (Miro)', status: 'geplant', autonomy: 'vorschlag', model: 'schnell',
        funktionen: ['Team-Verantwortung aus Miro', 'Onboarding-Skripte', 'Delegations-Vorschläge'],
        bauplan: 'Aus Miro-Team + HubSpot; Vorschläge.' },
    ],
  },
];

// ─── Abgeleitete Sichten (für MAKE-Orchestrator, Hub & Navigation) ──────────

/** Alle Agenten flach. */
export const ALL_AGENTS: DeptAgent[] = DEPARTMENTS.flatMap(d => d.agents);

/** Nur die, die wirklich laufen UND eine eigene Oberfläche haben. */
export interface LiveAgent extends DeptAgent { href: string; dept: string; deptColor: string; }
export const LIVE_AGENTS: LiveAgent[] = DEPARTMENTS.flatMap(d =>
  d.agents.filter(a => a.status === 'live' && a.href)
    .map(a => ({ ...a, href: a.href as string, dept: d.name, deptColor: d.color })),
);

/** Kompakte Beschreibung für den Orchestrator-Prompt (welcher Agent kann was). */
export function agentRoster(): string {
  return LIVE_AGENTS.map(a => `- ${a.id} · ${a.name} (${a.href}) — ${a.role}. Kann: ${a.funktionen.slice(0, 3).join(', ')}.`).join('\n');
}

export const ARCHITEKTUR = [
  '3 Ebenen: MAKE (Orchestrator) → Abteilungsleiter → Spezialist-Worker. Nach außen spricht nur der Abteilungsleiter mit MAKE — das begrenzt Kontext-Explosion.',
  'Auf 100–150 skalierst du INNERHALB der Abteilungen (Sales pro Segment/Region, Marketing pro Kanal) — nicht durch neue Abteilungen.',
  'Ein geteilter, versionierter Kontext (Kunden, Projekte, Cap Table, Termini) — statt jeder Agent hat sein eigenes Gedächtnis.',
  'Deterministischer Kontroll-Layer über dem LLM: Guardrails, klare Ownership, Freigabe-Gates an allem Irreversiblen.',
  'Kosten im Griff: günstige Modelle für Worker, das große nur für Orchestrator/Synthese; Budget-Deckel je Agent; Beobachtbarkeit.',
];

export const REALITAET =
  'Ehrlich: vollautonome 100+-Agenten-Systeme sind 2026 noch fehleranfällig (~30 % autonom gelöst) und teuer (~15× Token). Deshalb bauen wir mit kurzen Ketten, Freigaben an teuren Schritten und günstigen Workern — Qualität vor Vollautonomie. Abteilung für Abteilung.';
