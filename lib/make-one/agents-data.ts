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
    id: 'ops', name: 'Operations', mission: 'Alles am Laufen halten — Inbox, Aufgaben, Zeit, Wissen.', color: '#58D9CD', lead: 'Ops Lead',
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
      { id: 'planung', name: 'Wochenplan-Agent', role: 'Die Woche aus Kalender, Aufgaben und Routinen bauen', status: 'live', autonomy: 'vorschlag', model: 'stark', href: '/os/planung/woche',
        funktionen: ['Freie Zeit gegen Termine prüfen', 'Fokus, Reha und Routinen einplanen', 'Kollisionen verwerfen statt überplanen', 'Vorschlag — Kevin bestätigt im Planer'],
        bauplan: 'LIVE: /api/planung/vorschlag baut aus beiden Kalendern, Aufgaben, Routinen und den Fokus-Reglern einen Wochenvorschlag; Blöcke mit Kollision werden verworfen, nicht überschrieben. Jarvis startet ihn selbst (run_agent planung).' },
      { id: 'wissen', name: 'Dokument-/Wissens-Agent', role: 'Kevins Notizen durchsuchen und ergänzen', status: 'live', autonomy: 'autonom', model: 'schnell', href: '/os/stapel',
        funktionen: ['355 Notizen aus drei Vaults durchsuchen', 'Notiz vollständig lesen', 'Neue Notiz anlegen', 'An bestehende Notiz anhängen', 'Quelle bei jeder Antwort nennen'],
        bauplan: 'LIVE seit 07.09.: lib/jarvis/vault.ts. BEWUSST ohne Vektor-Datenbank — bei 355 Notizen schlägt gute Volltextsuche die RAG-Maschinerie, ist immer aktuell und hat keine Teile, die veralten. Kopien werden beim Lesen erkannt (346 von 701 Dateien), private Ordner gar nicht erst geöffnet. Überschreiben und Löschen gibt es bewusst nicht. Jarvis nutzt es über suche_wissen / lies_notiz / notiz_anlegen / notiz_ergaenzen.' },
    ],
  },
  {
    id: 'sales', name: 'Sales / Revenue', mission: 'Direkt am 1-Mio-Nordstern — Leads, Pipeline, Abschluss.', color: '#4A6CF7', lead: 'Revenue Lead',
    agents: [
      { id: 'prospect', name: 'Prospecting-Agent', role: 'Signalbasierte Zielliste (CAPOS-Persona)', status: 'live', autonomy: 'autonom', model: 'schnell', href: '/os/prospecting',
        funktionen: ['Zielliste + editierbares ICP (CapOS)', 'KI-Qualifizierung: Score + Fit + Aufhänger', 'Pipeline: Neu → Qualifiziert → Kontaktiert', 'Echte Firmen via Explorium/Vibe seeden'],
        bauplan: 'LIVE: Anthropic bewertet jede Firma gegen dein ICP (Score 0–100, Fit, Aufhänger), lokal gespeichert. Datenzufuhr aktuell über die Session (Explorium/Vibe), Direktanbindung folgt. → /os/prospecting' },
      { id: 'crm', name: 'CRM-/Pipeline-Agent', role: 'Wer ist heute dran — Tagesliste, Pipeline, Wiedervorlagen', status: 'live', autonomy: 'entwurf', model: 'ausgewogen', gate: 'Versand ✋', href: '/os/crm',
        funktionen: ['Tagesliste: fällige Wiedervorlagen, dann Prio A/B mit Aufhänger und Kanal', 'Pipeline Neu → Angesprochen → Gespräch → Termin → Angebot', 'Aktivitäten je Kontakt, Stufe nur vorwärts', 'Import der Masterliste (443 Kontakte), idempotent'],
        bauplan: 'LIVE seit 18.09.: /os/crm. Quelle ist die CRM_MASTER_Hauptdatei vom Schreibtisch; die Pipeline lebt nur hier und wird beim Abgleich nicht angefasst. Jarvis: suche_kontakt, notiere_kontakt, entwurf_ansprache. Kein Werkzeug zum Versenden — Kevin schickt selbst. Offen: die 731 Adressbuch-Kontakte aus /os/netzwerk daneben oder hinein.' },
      { id: 'head-sales', name: 'Head of Sales', role: 'Vertrieb und Kundenbetreuung — Power Hour vorbereiten, Deal- und Kundenreview, Vorschläge zur Freigabe', status: 'live', autonomy: 'vorschlag', model: 'stark', href: '/os/crm',
        gate: 'Versendet nichts. Entwürfe nur über Kanäle, die die Ampel erlaubt; angenommen wird ein Vorschlag zum nächsten Schritt an der Person.',
        funktionen: ['Power Hour vorbereiten (werktags 7 Uhr)', 'Deal-Review: was hängt, welche Qualifizierungsfrage fehlt', 'Kundenreview: Laufzeit, Health, Widersprüche (Monatsanfang)', 'Wochenreview (freitags)'],
        bauplan: 'LIVE (24.09.): lib/heads/ — Datenpaket aus Kartei + CRM (Code rechnet), Prompt nach Recherche, Prüfer streicht erfundene IDs, unzulässige Kanäle, Werbesperren und Vollzug; Freigabe-Liste mit Dedup. → /os/crm' },
      { id: 'outreach', name: 'Outreach-Agent', role: 'Personalisierte Ansprache-Entwürfe', status: 'live', autonomy: 'entwurf', model: 'ausgewogen', gate: 'Versand ✋', href: '/os/prospecting',
        funktionen: ['E-Mail + LinkedIn-Erstansprache in Kevins Stimme', 'Aufhänger aus dem Scoring', 'Übergabe an Apple Mail — Versand bei Kevin'],
        bauplan: 'Läuft: /api/outreach aus Score/Fit/Aufhänger + ICP; Entwurf in der Zielliste, Versand nur durch Kevin.' },
    ],
  },
  {
    id: 'marketing', name: 'Marketing', mission: 'Inbound & Marke bei Solo-Kapazität.', color: '#AC9D80', lead: 'Marketing Lead',
    agents: [
      { id: 'head-marketing', name: 'Head of Marketing', role: 'Ansprechbar sein statt laut — Einwilligungen, Fristen, Themen aus Kundengesprächen', status: 'live', autonomy: 'vorschlag', model: 'ausgewogen', href: '/os/crm?s=marketing',
        gate: 'Veröffentlicht und versendet nichts. Newsletter nur mit Double-Opt-in.',
        funktionen: ['Wochenplan (montags): drei Themen aus der Stimme der Kunden', 'Art.-14-Fristen und alte Einwilligungen', 'Quellen der Chancen statt Likes', 'Monatsreview'],
        bauplan: 'LIVE (24.09.): lib/heads/ (gemeinsamer Rahmen mit Sales und Event). → /os/crm?s=marketing' },
      { id: 'head-event', name: 'Head of Event', role: 'Stammtische, Workshops, Dinner — Ziel, Gästemischung, Nachfassen in 48 h, Wirkung', status: 'live', autonomy: 'vorschlag', model: 'ausgewogen', href: '/os/crm?s=events',
        gate: 'Lädt nicht selbst ein. Einladung per Mail nur mit Grundlage; Teilnahme ist keine Einwilligung.',
        funktionen: ['Countdown in den 7 Tagen vor dem Event', 'Nachfassen am Tag danach', 'Gästeliste aus der Kartei mit Einladungsweg', 'Wirkung nach 30/90 Tagen'],
        bauplan: 'LIVE (24.09.): lib/heads/. → /os/crm?s=events' },
      { id: 'content', name: 'Content-/Brand-Agent', role: 'Artikel, Social, Landingpages in deiner CI', status: 'live', autonomy: 'entwurf', model: 'ausgewogen', gate: 'Publizieren ✋', href: '/os/content',
        funktionen: ['LinkedIn-Post / Fachartikel / Landingpage / Kalt-E-Mail', 'In KEMARIS-CI (Sprachregeln verbindlich)', 'Thema + Notizen → fertiger Entwurf', 'Kopieren & selbst veröffentlichen'],
        bauplan: 'LIVE: Anthropic mit Brand-Voice-Prompt (KEMARIS-Terminologie: NIEMALS Dashboard/Tool/Disruption…, Macht-Vokabular Souveränität/Alpha/Capital Readiness). Entwurf-Autonomie, Publish bleibt dein Klick. → /os/content' },
      { id: 'funnel', name: 'Kampagnen-/Funnel-Agent', role: 'E-Mail-Sequenzen, Funnel', status: 'geplant', autonomy: 'entwurf', model: 'ausgewogen', gate: 'Versand ✋',
        funktionen: ['E-Mail-Sequenzen entwerfen', 'Funnel-Logik', 'A/B-Vorschläge'],
        bauplan: 'NICHT GEBAUT und aktuell ohne Aufgabe: E-Mail-Sequenzen brauchen erst das CRM und einen Versandweg (Brevo). Vorher gibt es nichts zu automatisieren. Kommt nach dem CRM, nicht davor.' },
      { id: 'seo', name: 'SEO-/Analytics-Agent', role: 'Performance & Sichtbarkeit', status: 'geplant', autonomy: 'autonom', model: 'schnell',
        funktionen: ['Keyword-/Sichtbarkeits-Check', 'Performance-Report', 'Content-Lücken'],
        bauplan: 'NICHT GEBAUT und ohne Grundlage: es gibt keine angebundene Website und keine Analytics-Quelle. Solange nichts gemessen wird, kann auch nichts ausgewertet werden. Bewusst nicht angefangen.' },
    ],
  },
  {
    id: 'finance', name: 'Finance', mission: 'Zahlen, Liquidität, Kapital-Kurs.', color: '#00C9B8', lead: 'Finance Lead',
    agents: [
      { id: 'finanzchef', name: 'Head of Finance', role: 'Finanzchef für Haushalt und Business — Lage, Fristen, Vorschläge zur Freigabe', status: 'live', autonomy: 'vorschlag', model: 'stark', href: '/os/finanzen?s=chef',
        gate: 'Bewegt kein Geld. Jeder Vorschlag geht in die Freigabe-Liste; angenommen wird er zur Aufgabe.',
        funktionen: ['Tagescheck, Wochenreview, Monatsabschluss, Steuercheck — vom Takt geplant', 'Finanzbild: Business, Haushalt, Brücke, Steuertermine, Datenqualität — deterministisch gerechnet', 'Prüfer: jede Zahl, Quelle und Frist gegen die Daten, eine Korrekturrunde', 'Freigabe-Liste mit Dedup; Fragen an den Head of Finance'],
        bauplan: 'LIVE (24.09.): lib/finanzen/chef/ — finanzbild (Code rechnet), prompt (recherchierter System-Prompt, 5 Modi, JSON-Schema), pruefer (Zahlen/Quellen/Fristen/Vollzug/Anlage), lauf (Werkzeuge rechne + buchungen_suchen, Korrekturrunde), plan (Takt). Haushalt nur für Mitglieder, eigener Speicher je Haushalt. → /os/finanzen?s=chef' },
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
      { id: 'brain', name: 'Kontext-/Gedächtnis-Agent', role: 'Was dauerhaft gilt, behalten und einbringen', status: 'live', autonomy: 'autonom', model: 'schnell', href: '/os/stapel',
        funktionen: ['Fakten aus Gesprächen sofort merken', 'In jeden Zug einbringen', 'Nach Raum trennen (Kevin/Malin/gemeinsam)', 'Auf Klick vergessen'],
        bauplan: 'LIVE seit 07.09.: lib/jarvis/gedaechtnis.ts. Strukturierte Fakten statt Vektorsuche — „wann habe ich Frank zuletzt gesprochen" ist eine Frage nach einem Feld, keine nach Ähnlichkeit. Geht auf 1.800 Zeichen gedeckelt in jeden Prompt. Sichtbar und einzeln löschbar unter /os/stapel. OFFEN: das Spiegeln des Miro-Boards — das braucht die Miro-Anbindung.' },
      { id: 'performance', name: 'Score-Agent', role: 'Den Wachstums-Score rechnen und einordnen', status: 'live', autonomy: 'autonom', model: 'stark', href: '/os/wachstum',
        funktionen: ['Fünf Säulen aus echten Daten rechnen', 'Messlücken ausweisen statt raten', 'Verlauf mitschreiben', 'Größten Hebel benennen'],
        bauplan: 'LIVE: /api/performance. Rechnet je Person getrennt (seit 07.09.), weil Gesundheit und Journal persönlich sind. Was nicht gemessen ist, wird als Messlücke ausgewiesen und zählt nicht als schlechter Wert. Jarvis startet ihn selbst.' },
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
        bauplan: 'NICHT GEBAUT — und beim Nachsehen am 07.09. stellt sich heraus: die Aufgabe ist schon vergeben. Der Bauplan unter /os/bauplan IST die Roadmap, und der Verbesserungs-Loop schreibt wöchentlich hinein. Ein zweiter Agent daneben würde dieselbe Liste ein zweites Mal führen. Eher streichen als bauen.' },
      { id: 'feedback', name: 'Research-/Feedback-Agent', role: 'User-Insights synthetisieren', status: 'geplant', autonomy: 'autonom', model: 'schnell',
        funktionen: ['Feedback sammeln (Inbox/HubSpot)', 'Themen clustern', 'Top-Insights'],
        bauplan: 'NICHT GEBAUT und ohne Eingabe: es gibt noch keine Nutzer, deren Rückmeldungen man synthetisieren könnte. Sinnvoll ab den ersten F&F-Testkunden, vorher nicht.' },
      { id: 'engqa', name: 'Eng-/QA-Agent', role: 'Architektur & Review', status: 'geplant', autonomy: 'freigabe', model: 'stark',
        funktionen: ['Architektur-Entscheide', 'Code-Review', 'Förderfähige Pakete markieren'],
        bauplan: 'NICHT GEBAUT — und die Aufgabe erledigt heute die Sitzung mit Claude selbst (Architektur, Review, Tests). Ein eigener Agent dafür wäre eine schwächere Kopie davon. Erst interessant, wenn Kevin ohne Claude an der Software arbeitet.' },
    ],
  },
  {
    id: 'people', name: 'People / Founder-Care', mission: 'Team — und dich. Ruhe, Fokus, Gesundheit.', color: '#1A4A3A', lead: 'People Lead',
    agents: [
      { id: 'fokus', name: 'Fokus-/Entscheidungs-Agent', role: 'Recovery × Prioritäten → Tagesform', status: 'live', autonomy: 'entwurf', model: 'stark', href: '/os/fokus',
        funktionen: ['Tag nach Recovery takten', 'Die EINE nächste Aktion', 'Overload verhindern'],
        bauplan: 'Whoop + Store-Tasks → Anthropic-Empfehlung. Läuft (/os/fokus).' },
      { id: 'health', name: 'Health-Agent', role: 'Der Tagestakt aufs Handy — Whoop, Haut, Streak, Routinen, Journal', status: 'live', autonomy: 'autonom', model: 'schnell', href: '/os/gesundheit',
        funktionen: ['Morgens Lage + Routinen, mittags „schon gegessen?", abends Journal/Haut/Reha/Streak — per Telegram', 'Haut-Tagebuch mit Trend und Auslösern (für den Hautarzt)', 'Streak: Tage seit dem letzten Rückfall, nie wertend', 'Whoop nachts holen, sobald verbunden'],
        bauplan: 'LIVE seit 23.09. — Kevins Entscheidung: „Gesundheit ist die Basis, deswegen bauen wir ihn zuerst." Takt in lib/gesundheit/takt.ts, Bote bote.mjs, Werkzeuge hake_routine / haut_eintrag / journal_eintrag / streak_eintrag. Braucht TELEGRAM_BOT_TOKEN und je Person einmal /start CODE. Whoop: wartet auf Kevins Developer-Zugang.' },
      { id: 'ernaehrung', name: 'Ernährungs-Agent', role: 'Essensplan und Einkaufsliste für die Woche', status: 'live', autonomy: 'vorschlag', model: 'ausgewogen', href: '/os/ernaehrung',
        funktionen: ['Wochenplan aus den Ernährungs-Regeln', 'Einkaufsliste daraus ableiten', 'Anti-entzündlich wegen Psoriasis', 'Hinweis von Kevin einarbeiten'],
        bauplan: 'LIVE: /api/ernaehrung/vorschlag. Jarvis startet ihn selbst (run_agent ernaehrung) und nimmt einen Hinweis für die Woche entgegen.' },
      { id: 'team', name: 'Team-/HR-Agent', role: 'Team-Struktur, Onboarding (Miro)', status: 'geplant', autonomy: 'vorschlag', model: 'schnell',
        funktionen: ['Team-Verantwortung aus Miro', 'Onboarding-Skripte', 'Delegations-Vorschläge'],
        bauplan: 'NICHT GEBAUT, blockiert von außen: braucht die Miro-Anbindung (steht im Bauplan als miro-api und wartet auf Kevins Zugang). Ohne Miro gibt es keine Team-Struktur zum Spiegeln.' },
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
