// ─── MAKE OS — ZOE führt die Fach-Agenten aus ────────────────────────────
// Bis 07.09. erreichte ZOE sechs von 22 Agenten; der Rest lief nur auf
// Knopfdruck in der Oberfläche. Kevins Ansage: „dass er dann wirklich die
// Agents auch einfach angreift." Also stehen hier alle, die ohne Eingabe vor
// Ort laufen können — mit derselben Regel wie vorher: die Autonomie-Stufe des
// Agenten bleibt maßgeblich, nichts geht ohne Freigabe nach außen.

import { resolveAgent } from '@/lib/agent-config';
import { localDay } from '@/lib/zeit';
import { hintergrundKopf, laufImKontext } from '@/lib/datenschutz/ki-lauf';

/** Agenten, die ZOE selbst starten darf. */
export const AUSFUEHRBAR = [
  'research', 'board', 'okr', 'controlling', 'finanzchef', 'fokus', 'kalender',
  'inbox', 'task', 'prospect', 'planung', 'ernaehrung', 'performance', 'content', 'meeting', 'outreach', 'crm',
  'head-sales', 'head-marketing', 'head-event',
  // Systemläufe: kein Fach-Agent, sondern der Takt selbst. Sie stehen hier,
  // damit der Arbeiter sie wie alles andere aus der Warteschlange holt.
  'tagesstart', 'tageslauf', 'verbesserung', 'morgen', 'abend', 'selbstbild', 'gesundheit', 'markttraktion', 'hoi', 'konsolidierung', 'loeschfristen', 'zoe-aufgaben', 'durchsicht', 'absichten',
  'ki-medien',
  // Agenten-Bereich (09.10., Paket 1): EIN Lauf-Name für Mitarbeiter-, Skill- und Plan-Läufe (lib/agenten/typen.ts `LAUF_AGENT`).
  'faden',
] as const;
export type Ausfuehrbar = typeof AUSFUEHRBAR[number];

/** Was ZOE dem Modell über jeden Agenten sagen muss, damit es den
 *  richtigen wählt — kurz, weil es in jeden Prompt geht. */
export const AGENT_ZWECK: Record<Ausfuehrbar, string> = {
  research: 'Recherche mit Web-Suche',
  board: 'Wochenlage aus Zahlen, Pipeline und Aufgaben',
  okr: 'Zielbaum und Lücken zum Jahresziel',
  controlling: 'Umsatz-Lage, Run-Rate, Runway',
  finanzchef: 'Head of Finance — Finanzlage Business mit Befunden und Vorschlägen zur Freigabe (auftrag = Frage, oder modus:tagescheck | wochenreview | monatsabschluss | steuercheck)',
  fokus: 'Tagesform aus Recovery × Prioritäten',
  kalender: 'Termine prüfen, Konflikte, Schutzblöcke',
  inbox: 'Postfach einstufen (wichtig / Rauschen)',
  task: 'Aufgaben durchsehen, Delegation vorschlagen',
  prospect: 'Zielliste gegen das ICP bewerten',
  planung: 'Wochenplan-Vorschlag aus Kalender und Aufgaben',
  ernaehrung: 'Essensplan und Einkaufsliste für die Woche',
  performance: 'Wachstums-Score neu rechnen und einordnen',
  content: 'Text-Entwurf in der Marken-Sprache (auftrag = Thema)',
  meeting: 'Transkript zu Protokoll und Aufgaben (auftrag = Transkript)',
  outreach: 'Erstansprache entwerfen (auftrag = Name oder Firma — aus dem CRM, sonst aus der Zielliste)',
  crm: 'Wer ist heute in der Markttraktion dran — Tagesliste mit Grund, Aufhänger und Kanal',
  'head-sales': 'Head of Sales — Vertriebslage, Pipeline, Mandate, wer heute dran ist (auftrag = Frage, oder modus:power_hour | deal_review | kundenreview | wochenreview)',
  'head-marketing': 'Head of Marketing — Einwilligungsbestand, Art.-14-Fristen, Themen aus der Stimme der Kunden (auftrag = Frage, oder modus:wochenplan | monatsreview)',
  'head-event': 'Head of Event — Events planen, Gäste, Nachfassen in 48 h, Wirkung (auftrag = Frage, oder modus:planung | einladung | nachfassen | wirkung)',
  tagesstart: 'Der Morgenlauf — Kalender auffrischen, Lage bauen (einmal am Tag)',
  tageslauf: 'Ein Durchgang des Tageslaufs (auftrag = voll | kurz | puls)',
  verbesserung: 'Der Verbesserungs-Loop über Nutzung, Fehler und Bauplan',
  morgen: 'Der Morgenlauf — sieht die Lage an und legt Vorschläge in den Stapel',
  abend: 'Der Abendlauf — was blieb liegen, was muss morgen früh stehen',
  selbstbild: 'Schreibt fort, was die Software über sich selbst im Gehirn hat',
  gesundheit: 'Der Gesundheits-Takt — schickt den Personen des Haushalts morgens, mittags, abends die Nachricht aufs Handy (auftrag = morgen | mittag | abend | woche, sonst was fällig ist)',
  markttraktion: 'Der Markttraktion-Takt — schickt den Personen des Teams werktags morgens, was in der Markttraktion bei ihnen liegt, und freitags das Wochen-Scoreboard aufs Handy (auftrag = morgen | woche, optional person:<Kennung aus dem Team> — schickt sofort; leer = was fällig ist)',
  hoi: 'Der Head of IT — Lagebild aus Server, App, Sicherheit und Außenblick; ohne KI (auftrag = bericht | pruefen)',
  konsolidierung: 'Die nächtliche Brain-Konsolidierung — verdichtet Fakten, Log und Protokolle des Tages zu Vorschlägen in der Brain-Inbox (auftrag = jetzt erzwingt)',
  'zoe-aufgaben': 'ZOE bereitet die Aufgaben vor, die an sie gegeben wurden — nur Vorschläge in den Stapel, übernommen wird erst nach Freigabe (mit Person: nur deren Aufträge)',
  absichten: 'Abgebrochene Vorgänge über mehrere Bestände fertigstellen (Absichtsprotokoll: Art. 17, Import, Dubletten, Kennungs-Umzug, Angebot) — ohne KI, nur Zahlen (auftrag = jetzt nimmt auch junge)',
  durchsicht: 'Die nächtliche Durchsicht der Bestände (Datenschicht) — jeden Bestand entschlüsseln, parsen, zählen, Zeilen-Sprünge und Verbindungsprüfung für den Head of IT; ohne KI, nur Zahlen (auftrag = jetzt erzwingt)',
  faden: 'Agenten-Bereich: ein Thread-Lauf (Mitarbeiter, Skill, Hintergrundaufgabe) — NUR mit einem Lauf-Auftrag als JSON (Thread/Skill/Hintergrundaufgabe der Person), ein freier Text wird abgelehnt; Ergebnis steht im Thread',
  loeschfristen: 'Der Löschfristen-Lauf (Datenschutz, einmal am Tag) — Kontakte über der Frist nur als Aufgabe (nie automatisch löschen), technische Bestände nach Frist bereinigen; ohne KI (auftrag = jetzt erzwingt)',
  'ki-medien': 'Holt laufende Video- und Tiefenbericht-Aufträge beim KI-Anbieter ab und legt sie verschlüsselt ab — startet nichts Neues, kostet nichts zusätzlich',
};

/**
 * Läufe, die kein Fach-Agent sind — für sie gibt es keinen Schalter unter
 * /os/agenten, sie gehören zum Takt des Systems.
 *
 * Exportiert, damit der Verzeichnis-Test dieselbe Liste benutzt statt einer
 * eigenen Kopie. Eine zweite Liste hätte genau einen Zweck: irgendwann von
 * dieser abzuweichen.
 */
export const SYSTEM_LAEUFE = ['tagesstart', 'tageslauf', 'verbesserung', 'morgen', 'abend', 'selbstbild', 'gesundheit', 'markttraktion', 'hoi', 'konsolidierung', 'loeschfristen', 'zoe-aufgaben', 'durchsicht', 'absichten', 'ki-medien', 'faden'] as const;
const SYSTEM = new Set<string>(SYSTEM_LAEUFE);

const kuerze = (t: unknown, n = 1600) => String(t ?? '').slice(0, n);

/**
 * Ergebnisse halb gebauter Agenten bekommen einen Platz (27.09.): statt einer Textwand in der
 * Warteschlange werden sie Vorschläge im Stapel — über dasselbe Werkzeug, das Kevin auch im
 * Gespräch freigäbe (`vorschlagen: true`, Quelle „lauf“). Nichts davon wird ausgeführt.
 */
async function stapleAlle(liste: readonly (readonly [string, Record<string, unknown>])[], origin: string, person: string | undefined, anlass: string): Promise<number> {
  if (!liste.length) return 0;
  const { fuehreAus } = await import('./ausfuehren');
  let n = 0;
  for (const [werkzeug, eingabe] of liste) {
    try { const r = await fuehreAus(werkzeug, eingabe, origin, { vorschlagen: true, quelle: 'lauf', anlass, ...(person ? { person: person as import('./raum').Person } : {}) }); if (r.gestapelt) n++; }
    catch { /* ein Vorschlag weniger — der Text des Laufs sagt, wie viele liegen */ }
  }
  return n;
}

/**
 * Ergebnis eines Agentenlaufs.
 *
 * Warum nicht einfach ein Text: die Warteschlange hat am 07.09. ein
 * einwandfreies Board-Pack als Fehlschlag gewertet und dreimal wiederholt,
 * weil im Analysetext der Satz „… ist mit dem aktuellen Aufbau nicht
 * erreichbar" stand. Wer Erfolg an Wörtern im Fließtext festmacht, liegt
 * früher oder später falsch. Also sagt der Lauf es selbst.
 */
export interface AgentLauf { ok: boolean; text: string }
const gut = (text: string): AgentLauf => ({ ok: true, text });
const fehl = (text: string): AgentLauf => ({ ok: false, text });

/** `person` = für wen der Lauf arbeitet (Sitzung bzw. Auftrag). Ohne Person ist es ein Systemlauf des Takts (26.09.). */
export async function runAgent(id: Ausfuehrbar, auftrag: string, origin: string, person?: string, opt: { hintergrund?: boolean } = {}): Promise<AgentLauf> {
  // Der Agenten-Schalter unter /os/agenten gilt weiterhin. Ausgeschaltet ist
  // ausgeschaltet — auch für ZOE.
  if (!SYSTEM.has(id)) {
    // Seit 07.09. stehen planung, ernaehrung und performance mit eigener id im
    // Verzeichnis. Vorher fragten sie hier nach FREMDEN Konfigurationen
    // (health, kalender, fokus) — der Schalter auf /os/agenten hätte für sie
    // also nichts bewirkt, obwohl er dastand.
    const cfg = await resolveAgent(id);
    if (!cfg.enabled) return fehl(`${cfg.name} ist ausgeschaltet (unter /os/agenten aktivierbar).`);
  }

  // Datenschutz (05.10.): ein Lauf des Takts trägt `x-make-lauf: hintergrund` mit — die Routen geben das dem KI-Tor weiter
  // (Schalter „Hintergrund-KI“, Pseudonymisierung). Vom Gespräch/Knopf ausgelöst bleibt es ein Aufruf.
  const hintergrund = opt.hintergrund || laufImKontext() === 'hintergrund';
  const H = { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '', ...(person ? { 'x-make-person': person } : {}), ...hintergrundKopf(hintergrund) };
  // Ein „person:x“ im Auftragstext darf nur der Takt setzen (Systemlauf ohne Person) — sonst könnte
  // ein Konto als jemand anderes laufen lassen (26.09.).
  const personAusText = (text: string) => person ?? /person:([a-z0-9-]{1,40})/.exec(text)?.[1];
  // ok-Vertrag (27.09.): eine Route, die mit Fehlerstatus, { ok:false } oder { error } antwortet, ist ein
  // FEHLSCHLAG des Laufs — vorher wurde so etwas in einigen Fällen als „0 Vorschläge“ oder „niemand
  // fällig“ gelesen und stand als Erfolg in der Warteschlange (verbesserung, task, crm, tagesstart).
  // Die Routen antworten unterschiedlich geformt — die Fälle unten lesen die Felder selbst (wie vorher r.json()).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gepruft = async (r: Response, pfad: string): Promise<any> => {
    const d = await r.json().catch(() => ({})) as Record<string, unknown>;
    const fehltext = typeof d.error === 'string' ? d.error : typeof d.fehler === 'string' ? d.fehler : '';
    if (!r.ok) throw new Error(`${pfad} antwortet ${r.status}${fehltext ? `: ${kuerze(fehltext, 160)}` : ''}`);
    if (d.ok === false || (fehltext && d.ok !== true && !('reply' in d) && !('headline' in d))) throw new Error(kuerze(fehltext || `${pfad}: nicht ok`, 200));
    return d;
  };
  const post = async (pfad: string, body: unknown, timeoutMs = 90_000) => gepruft(await fetch(`${origin}${pfad}`, {
    method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  }), pfad);
  const get = async (pfad: string, timeoutMs = 60_000) => gepruft(await fetch(`${origin}${pfad}`, { headers: H, signal: AbortSignal.timeout(timeoutMs) }), pfad);

  try {
    switch (id) {
      case 'research': {
        const d = await post('/api/research', { query: auftrag || 'Aktuelle Lage' }, 160_000);
        return d.reply ? gut(`RESEARCH-ERGEBNIS${d.webUsed ? ' (mit Web-Suche)' : ''}:\n${kuerze(d.reply, 2200)}`) : fehl(`Research fehlgeschlagen: ${kuerze(d.error, 200)}`);
      }
      case 'board': {
        const d = await post('/api/board', {});
        if (!d.headline) return fehl(`Board fehlgeschlagen: ${kuerze(d.error, 200)}`);
        const sekt = (d.sektionen ?? []).map((x: { titel: string; punkte?: string[] }) => `${x.titel}: ${(x.punkte ?? []).join(' · ')}`).join('\n');
        return gut(`BOARD-PACK:\n${d.headline}\n${sekt}\nRisiken: ${(d.risiken ?? []).join(' · ')}\nNächste Woche: ${(d.naechsteWoche ?? []).join(' · ')}`);
      }
      case 'okr': {
        const d = await post('/api/okr', {});
        if (!d.lage) return fehl(`OKR fehlgeschlagen: ${kuerze(d.error, 200)}`);
        const obj = (d.objectives ?? []).map((o: { titel?: string; luecke?: string }) => `${o.titel}${o.luecke ? ` (Lücke: ${o.luecke})` : ''}`).join('\n');
        return gut(`OKR-ZIELBAUM:\n${d.lage}\n${obj}`);
      }
      case 'controlling': {
        const d = await post('/api/controlling/analyse', {});
        if (!d.briefing) return fehl(`Controlling fehlgeschlagen: ${kuerze(d.error, 200)}`);
        return gut(`CONTROLLING-LAGE:\n${d.briefing}\nFokus: ${(d.fokus ?? []).join(' · ')}\nRisiken: ${(d.risiken ?? []).join(' · ')}`);
      }
      case 'fokus': {
        const d = await post('/api/fokus', {});
        return d.reply ? gut(`TAGESFORM (${d.zone}, Recovery ${d.recovery}%):\n${kuerze(d.reply, 1600)}`) : fehl(`Fokus fehlgeschlagen: ${kuerze(d.error, 200)}`);
      }
      case 'kalender': {
        const d = await post('/api/kalender/analyse', {}, 120_000);
        if (!d.briefing && !d.vorschlaege) return fehl(`Kalender fehlgeschlagen: ${kuerze(d.error, 200)}`);
        const v = (d.vorschlaege ?? []).map((x: { title: string; date: string; startHour: number }) => `${x.title} ${x.date} ${x.startHour}:00`).join(' · ');
        // 29.09. (#K2): der Agent trägt nie selbst ein — die Blöcke liegen im Freigabe-Stapel (Art „kalender“).
        return gut(`KALENDER-ANALYSE:\n${d.briefing ?? ''}\nKonflikte: ${(d.conflicts ?? []).length}\nVorschläge: ${v || 'keine'}${d.gestapelt ? `\n(${d.gestapelt} Blöcke liegen im Freigabe-Stapel — eingetragen wird erst per Klick. Behaupte nicht, sie stünden schon im Kalender.)` : v ? '\n(Nichts eingetragen — Eintragen braucht einen Klick.)' : ''}`);
      }

      // ── Neu ab 07.09.: die Agenten, die ZOE bisher nicht erreichte ──
      case 'inbox': {
        // Inbox 2 (06.10.): kein Modell, keine Triage — die Fächer stehen fest (lib/inbox/faecher.ts). Der Agent liest die Lage der
        // eigenen Postfächer der Person, für die er läuft; ohne Person (Systemlauf) liest er keine Post.
        const wer = person ?? null;
        if (!wer) return gut('INBOX: läuft je Person — ohne Person wird keine Post gelesen.');
        const { inboxLage, lageText } = await import('@/lib/inbox/zoe-sicht');
        const l = await inboxLage(wer);
        if (!l.postfaecher) return gut('INBOX: noch kein Postfach verbunden (Inbox › Postfach verbinden).');
        return gut(`INBOX-LAGE:\n${l.lage.map(z => lageText(z, z.bereich ? l.bereichNamen[z.bereich] ?? z.bereich : 'Ohne Bereich')).join('\n')}\nZOE: ${l.zoe}\n(Alles nur Vorschlag — erledigt, beantwortet und zugeordnet wird in der Inbox per Klick.)`);
      }
      case 'task': {
        const d = await post('/api/delegation', { ablegen: true }, 120_000);
        const v = (d.vorschlaege ?? []) as { titel?: string; an?: string; warum?: string }[];
        if (!v.length) return gut(`DELEGATION: nichts zum Abgeben gefunden${d.privatAnzahl ? ` (${d.privatAnzahl} private Aufgaben bleiben außen vor)` : ''}.`);
        return gut(`DELEGATION — ${v.length} Vorschläge${d.abgelegt ? ' (liegen unter Aufgaben › Delegation)' : ''}:\n` + v.slice(0, 8).map(x => `• ${x.titel} → ${x.an}${x.warum ? ` (${x.warum})` : ''}`).join('\n'));
      }
      case 'prospect': {
        const st = await get('/api/state/prospects');
        const liste = (st?.state?.prospects ?? st?.prospects ?? []) as { id?: string; company?: string; score?: number; stand?: string }[];
        const offen = liste.filter(p => p.score == null).slice(0, 5);
        if (!offen.length) return gut(`PROSPECTING: alle ${liste.length} Firmen sind bereits bewertet.`);
        const icp = String(st?.state?.icp ?? st?.icp ?? '');
        const ergebnisse = await Promise.all(offen.map(p => post('/api/prospecting/score', { prospect: p, icp }).catch(() => null)));
        const zeilen = offen.map((p, i) => {
          const e = ergebnisse[i] as { score?: number; fit?: string } | null;
          return e?.score != null ? `• ${p.company}: ${e.score}/100 — ${kuerze(e.fit, 90)}` : `• ${p.company}: nicht bewertbar`;
        });
        // Feinschliff 09.10.: Einzeländerungen MIT Stand (PATCH, Woche 2 · 1.14) statt die ganze Liste zurückzuschreiben (PUT) — hat jemand die
        // Zeile seit dem Lesen geändert, lehnt die Route ab (409) und nichts wird überschrieben; die Werte stehen dann nur hier im Ergebnis.
        const ops = offen.flatMap((p, i) => {
          const e = ergebnisse[i] as { score?: number; fit?: string; angle?: string } | null;
          if (!e || e.score == null || typeof p.id !== 'string' || typeof p.stand !== 'string') return [];
          return [{ op: 'teil', id: p.id, stand: p.stand, felder: { score: e.score, fit: e.fit ?? '', angle: e.angle ?? '' } }];
        });
        let gespeichert = 0, konflikt = false;
        if (ops.length) {
          try {
            const r = await fetch(`${origin}/api/state/prospects`, { method: 'PATCH', headers: H, body: JSON.stringify({ ops }), signal: AbortSignal.timeout(30_000) });
            if (r.ok) gespeichert = ops.length; else konflikt = r.status === 409;
          } catch { gespeichert = 0; }
        }
        const fuss = gespeichert ? `${gespeichert} Werte in der Zielliste gespeichert.` : konflikt ? 'Nicht gespeichert: die Zielliste wurde inzwischen geändert — Werte oben, bitte neu bewerten lassen.' : 'Speichern in die Zielliste nicht gelungen — Werte oben.';
        return gut(`PROSPECTING — ${offen.length} von ${liste.length} bewertet:\n${zeilen.join('\n')}\n(${fuss})`);
      }
      case 'planung': {
        const mo = new Date(); mo.setDate(mo.getDate() - ((mo.getDay() + 6) % 7));
        const d = await post('/api/planung/vorschlag', { woche: localDay(mo), hinweis: auftrag || undefined }, 150_000);
        const b = (d.bloecke ?? []) as { titel?: string; date?: string; startMin?: number }[];
        if (!b.length) return fehl(`Planungs-Vorschlag fehlgeschlagen: ${kuerze(d.error ?? d.begruendung, 200)}`);
        const hh = (m?: number) => `${String(Math.floor((m ?? 0) / 60)).padStart(2, '0')}:${String((m ?? 0) % 60).padStart(2, '0')}`;
        // Ein Platz für das Ergebnis (27.09.): jeder Block wird ein plan_block-Vorschlag im Stapel (Gruppe Planung) —
        // vorher stand der Plan nur als Text in der Warteschlange, und niemand konnte ihn annehmen.
        const gestapelt = await stapleAlle(b.slice(0, 6).map(x => ['plan_block', { date: x.date, startMin: x.startMin, dauerMin: (x as { dauerMin?: number }).dauerMin ?? 60, titel: x.titel, art: (x as { art?: string }).art ?? 'block' }] as const), origin, person, `Wochenplan-Agent: ${kuerze(d.begruendung, 140)}`);
        return gut(`WOCHENPLAN-VORSCHLAG (${b.length} Blöcke${d.verworfen ? `, ${d.verworfen} wegen Kollision verworfen` : ''}):\n${kuerze(d.begruendung, 500)}\n`
          + b.slice(0, 10).map(x => `• ${x.date} ${hh(x.startMin)} — ${x.titel}`).join('\n')
          + `\n(${gestapelt} Blöcke liegen als Vorschläge im Stapel — Freigeben trägt sie ein.)`);
      }
      case 'ernaehrung': {
        const d = await post('/api/ernaehrung/vorschlag', { hinweis: auftrag || undefined, ablegen: true }, 240_000);
        if (!d.begruendung && !d.plan) return fehl(`Ernährung fehlgeschlagen: ${kuerze(d.error, 200)}`);
        const tage = Array.isArray(d.plan) ? d.plan.length : 0;
        return gut(`ESSENSPLAN (${tage} Tage):\n${kuerze(d.begruendung, 500)}\nEinkaufsliste: ${(d.einkauf ?? []).length} Posten. ${d.abgelegt ? 'Wartet unter Gesundheit › Ernährung auf „Übernehmen“.' : 'Steht unter /os/ernaehrung.'}`);
      }
      case 'performance': {
        const d = await post('/api/performance', { analyse: true }, 150_000);
        const a = d.aktuell;
        if (!a) return fehl(`Performance fehlgeschlagen: ${kuerze(d.error, 200)}`);
        return gut(`MAKE SCORE: ${a.index} (${a.label}), ${Math.round((a.abdeckung ?? 0) * 100)} % echte Daten.`
          + `${a.hebel ? ` Größter Hebel: ${a.hebel}.` : ''}${d.lage ? `\n${kuerze(d.lage, 700)}` : ''}`);
      }
      case 'content': {
        if (!auftrag) return fehl('Content-Agent braucht ein Thema — frag Kevin, worüber geschrieben werden soll.');
        const d = await post('/api/content', { thema: auftrag, format: 'linkedin', ablegen: true }, 150_000);
        if (!d.reply || d.needsKey) return fehl(`Content fehlgeschlagen: ${kuerze(d.error ?? d.reply, 200)}`);
        return gut(`ENTWURF (${d.format}):\n${kuerze(d.reply, 2000)}\n(${d.abgelegt ? 'Liegt unter Content › Entwürfe von ZOE. ' : ''}Veröffentlichen bleibt bei Kevin.)`);
      }
      // ── Systemläufe ──
      case 'tagesstart': {
        const d = await post('/api/tagesstart', {}, 200_000);
        if (d.uebersprungen) return gut('TAGESSTART: heute schon gelaufen, nichts doppelt getan.');
        const schritte = (d.schritte ?? []) as { name: string; ok: boolean; info?: string }[];
        return gut(`TAGESSTART: ${schritte.filter(x => x.ok).length} von ${schritte.length} Schritten. `
          + schritte.map(x => `${x.name} ${x.ok ? '✓' : '✕'}${x.info ? ` (${x.info})` : ''}`).join(' · '));
      }
      case 'tageslauf': {
        const art = ['voll', 'kurz', 'puls'].includes(auftrag) ? auftrag : 'puls';
        const d = await post('/api/tageslauf', { art }, 220_000);
        if (!d.lauf) return fehl(`Tageslauf fehlgeschlagen: ${kuerze(d.error, 200)}`);
        return gut(`TAGESLAUF (${art}): ${kuerze(d.lauf.alarm ?? d.lauf.zusammenfassung ?? 'durchgelaufen', 400)}`);
      }
      case 'verbesserung': {
        const d = await post('/api/loop/verbesserung', {}, 200_000);
        if (d.uebersprungen) return gut('VERBESSERUNGS-LOOP: noch nicht fällig (läuft im Sieben-Tage-Takt).');
        return gut(`VERBESSERUNGS-LOOP: ${d.anzahl ?? 0} Vorschläge in den Bauplan gelegt.`);
      }
      case 'morgen': {
        const d = await post('/api/zoe/morgen', {}, 200_000);
        if (!d.ok) return fehl(`Morgenlauf fehlgeschlagen: ${kuerze(d.error, 200)}`);
        if (d.ohneKi) return gut(`MORGENLAUF (Regelwerk, ${d.grund}): ${kuerze(d.bericht, 500)}`);
        return gut(`MORGENLAUF: ${d.gestapelt ?? 0} Vorschläge im Stapel. ${kuerze(d.bericht, 500)}`);
      }
      case 'abend': {
        const d = await post('/api/zoe/morgen', { zeit: 'abend' }, 200_000);
        if (!d.ok) return fehl(`Abendlauf fehlgeschlagen: ${kuerze(d.error, 200)}`);
        if (d.ohneKi) return gut(`ABENDLAUF (Regelwerk, ${d.grund}): ${kuerze(d.bericht, 500)}`);
        return gut(`ABENDLAUF: ${d.gestapelt ?? 0} Vorschläge für morgen. ${kuerze(d.bericht, 500)}`);
      }
      case 'crm': {
        const d = await get('/api/crm/ansprechen?n=8');
        const liste = (d?.liste ?? []) as { kontakt: { id: string; vorname: string; nachname: string; firma?: string; position?: string; aufhaenger?: string; stufe: string; prio: string }; grund: string; kanaele: { art: string }[] }[];
        const st = d?.stand ?? {};
        if (!liste.length) return gut(`Markttraktion: niemand fällig. Stand: ${st.gesamt ?? 0} Kontakte, ${st.ansprechbar ?? 0} ansprechbar.`);
        return gut(`HEUTE ANSPRECHEN — ${liste.length} von ${st.ansprechbar ?? '?'} ansprechbaren (${st.gesamt ?? '?'} gesamt):\n\n` + liste.map((p, i) =>
          `${i + 1}. ${p.kontakt.vorname} ${p.kontakt.nachname}${p.kontakt.firma ? ` · ${p.kontakt.firma}` : ''}${p.kontakt.position ? ` · ${p.kontakt.position}` : ''} [${p.kontakt.id}]\n   ${p.grund} · Kanal: ${p.kanaele.map(c => c.art).join(', ')}\n   Aufhänger: ${kuerze(p.kontakt.aufhaenger, 200)}`,
        ).join('\n\n') + '\n\nEntwurf je Kontakt mit entwurf_ansprache; Versand bleibt bei Kevin.');
      }
      case 'outreach': {
        // Erst das CRM — dort sind die Menschen, die Kevin wirklich meint.
        // Die Zielliste (Prospecting) ist der Rückfall für reine Firmennamen.
        if (auftrag) {
          const kk = await get('/api/state/kontakte');
          const { findeKontakte, anzeigename } = await import('@/lib/make-one/crm');
          const k = findeKontakte((kk?.kontakte ?? []) as import('@/lib/make-one/crm').Kontakt[], auftrag, 1)[0];
          if (k) {
            const d = await post('/api/crm/entwurf', { id: k.id }, 150_000);
            if (!d.email) return fehl(`Entwurf fehlgeschlagen: ${kuerze(d.error, 200)}`);
            return gut(`ANSPRACHE-ENTWURF für ${anzeigename(k)}${k.firma ? ` (${k.firma})` : ''} [${k.id}]:\nBETREFF: ${d.betreff}\n\n${kuerze(d.email, 1500)}\n\nLINKEDIN: ${kuerze(d.linkedin, 600)}\n(Versand bleibt bei Kevin — nichts geht ohne ihn raus. Danach: notiere_kontakt.)`);
          }
        } else {
          const heute = await get('/api/crm/ansprechen?n=1');
          const p = heute?.liste?.[0];
          if (p?.kontakt?.id) {
            const d = await post('/api/crm/entwurf', { id: p.kontakt.id }, 150_000);
            if (!d.email) return fehl(`Entwurf fehlgeschlagen: ${kuerze(d.error, 200)}`);
            return gut(`ANSPRACHE-ENTWURF für ${p.kontakt.vorname} ${p.kontakt.nachname}${p.kontakt.firma ? ` (${p.kontakt.firma})` : ''} [${p.kontakt.id}] — ${p.grund}:\nBETREFF: ${d.betreff}\n\n${kuerze(d.email, 1500)}\n\nLINKEDIN: ${kuerze(d.linkedin, 600)}\n(Versand bleibt bei Kevin.)`);
          }
        }
        const st = await get('/api/state/prospects');
        const liste = (st?.state?.prospects ?? st?.prospects ?? []) as { company?: string; score?: number; status?: string }[];
        const ziel = auftrag
          ? liste.find(p => (p.company ?? '').toLowerCase().includes(auftrag.toLowerCase()))
          : liste.filter(p => p.status !== 'kontaktiert').sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
        if (!ziel) return fehl(auftrag ? `Weder in der Kartei noch in der Zielliste: „${auftrag}".` : 'Niemand fällig in der Markttraktion und kein unkontaktierter Treffer in der Zielliste.');
        const d = await post('/api/outreach', { prospect: ziel, icp: String(st?.state?.icp ?? st?.icp ?? '') }, 150_000);
        const entwurf = d.reply ?? d.entwurf ?? d.text ?? d.email;
        if (!entwurf) return fehl(`Outreach fehlgeschlagen: ${kuerze(d.error, 200)}`);
        return gut(`ANSPRACHE-ENTWURF für ${ziel.company}:\n${kuerze(entwurf, 2000)}\n(Versand bleibt bei Kevin — nichts geht ohne ihn raus.)`);
      }
      case 'gesundheit': {
        // Der Takt aufs Handy — deterministisch, ohne Modell. Siehe
        // lib/gesundheit/lauf.ts. Ein Slot-Name als Auftrag erzwingt genau den.
        const { gesundheitsLauf } = await import('@/lib/gesundheit/lauf');
        const slot = (['morgen', 'mittag', 'abend', 'woche'] as const).find(s => s === auftrag);
        const r = await gesundheitsLauf(origin, slot);
        return r.ok ? gut(r.text) : fehl(r.text);
      }
      case 'markttraktion': {
        // Morgen-Nachricht und Freitags-Scoreboard — deterministisch, ohne
        // Modell, nur an Kevin und Malin selbst (siehe markttraktionLauf).
        return await markttraktionLauf(auftrag, new Date(), person);
      }
      case 'hoi': {
        // Head of IT (27.09.): ohne Modell. „bericht“ = Tagesbericht aufs Handy (einmal je Tag), „pruefen“ = nur
        // melden, was NEU rot ist. Riegel in hoi-meldung.json; die Nachricht geht an den Inhaber, nie an Dritte.
        const { lage } = await import('@/lib/hoi/innen');
        const l = await lage();
        const rot = l.befunde.filter(b => b.ampel === 'rot').map(b => b.id);
        const { loadJson, updateJson } = await import('@/lib/store/local-db');
        const heute = localDay();
        interface HoiMeldung { berichtTag?: string; gemeldet?: string[]; zuletzt?: string; ampel?: string }
        const r = (await loadJson<HoiMeldung>('hoi-meldung')) ?? {};
        const bericht = auftrag === 'bericht';
        const neuRot = rot.filter(x => !(r.gemeldet ?? []).includes(x));
        let telegram = '';
        // EIN Sendeweg (08.10.): ZOE auf WhatsApp, sonst Telegram (lib/zoe/an-person.ts) — ohne Boten wie bisher nichts.
        const { anPersonMelden, botenEingerichtet } = await import('./an-person');
        if ((await botenEingerichtet()) && ((bericht && r.berichtTag !== heute) || neuRot.length)) {
          // An JEDEN Inhaber (09.10., R9 — mehrere Inhaber): fällt einer aus, sieht die andere den roten Befund.
          const { alleInhaberSpeicher } = await import('@/lib/zugang/haushalt-inhaber');
          const zustellungen: string[] = [];
          for (const inhaber of await alleInhaberSpeicher()) { const s = await anPersonMelden(inhaber, 'hoi', l.kurz, { link: '/os/hoi' }); zustellungen.push(s.erreicht > 0 ? `Bote gesendet (${s.kanal === 'whatsapp' ? 'WhatsApp' : 'Telegram'})` : `Bote: ${s.fehler ?? 'nicht zugestellt'}`); }
          telegram = [...new Set(zustellungen)].join(' · ');
        }
        await updateJson<HoiMeldung>('hoi-meldung', cur => ({ ...(cur ?? {}), gemeldet: rot, ...(bericht ? { berichtTag: heute } : {}), zuletzt: new Date().toISOString(), ampel: l.gesamt.ampel }));
        return gut(`HEAD OF IT (${bericht ? 'Tagesbericht' : 'Stundenblick'}): ${l.gesamt.ampel} — ${l.gesamt.rot} rot · ${l.gesamt.gelb} gelb · ${l.gesamt.gruen} grün${neuRot.length ? ` · neu rot: ${neuRot.join(', ')}` : ''}${telegram ? ` · ${telegram}` : ''}`);
      }
      case 'konsolidierung': {
        // Brain (27.09.): schreibt nur in die Inbox; ohne KI Regelwerk. „jetzt“ übergeht den Tages-Riegel.
        const { konsolidieren } = await import('@/lib/brain/konsolidierung');
        const k = await konsolidieren(new Date().toISOString(), auftrag === 'jetzt');
        return k.ok ? gut(`BRAIN-KONSOLIDIERUNG${k.ohneKi ? ' (Regelwerk)' : ''}: ${k.text}${k.app ? ` · ${k.app}` : ''}`) : fehl(`Konsolidierung: ${k.text}`);
      }
      case 'loeschfristen': {
        // Datenschutz (28.09., U2 #52): Personen nie automatisch löschen — nur die Aufgabe; technische Bestände bereinigen.
        const { loeschfristenLauf } = await import('@/lib/crm/loeschfristen-lauf');
        const r = await loeschfristenLauf(new Date(), auftrag === 'jetzt');
        return r.ok ? gut(`LÖSCHFRISTEN${r.uebersprungen ? ' (heute schon gelaufen)' : ''}: ${r.text}`) : fehl(`Löschfristen: ${r.text}`);
      }
      case 'faden': {
        // Agenten-Bereich (09.10., Paket 1): der Arbeiter reicht den Lauf-Auftrag als Text weiter (`auftrag` = JSON). Ein freier Text
        // (z. B. von ZOE über run_agent) ist kein Lauf. Ausgeführt wird NUR über /api/agenten/faden/lauf — für die Person des Auftrags,
        // nie als Systemlauf; die Route prüft, dass Thread/Skill/Aufgabe ihr gehören. Zurück kommen nur Metadaten (der Inhalt steht im Thread).
        if (!person) return fehl('Agenten-Lauf braucht eine Person (kein Systemlauf).');
        let lauf: unknown;
        try { lauf = JSON.parse(auftrag); } catch { return fehl('Agenten-Lauf abgelehnt: kein Lauf-Auftrag (freier Text wird nicht ausgeführt).'); }
        if (!lauf || typeof lauf !== 'object') return fehl('Agenten-Lauf abgelehnt: kein Lauf-Auftrag.');
        const d = await post('/api/agenten/faden/lauf', lauf, 330_000);
        return gut(`AGENTEN-LAUF: ${kuerze(d.laufStatus ?? 'fertig', 40)}${d.fadenId ? ` (Thread ${kuerze(d.fadenId, 60)})` : ''} — das Ergebnis steht im Thread.`);
      }
      case 'absichten': {
        // Paket D-C (29.09., #17): offene Absichten fertigstellen — Schritte idempotent, nach 3 Fehlversuchen „gescheitert“ (HOI rot).
        const { offeneFertigstellen, MINDEST_ALTER_MS } = await import('@/lib/store/absichten-fortsetzen');
        const r = await offeneFertigstellen({ mindestAlterMs: auftrag === 'jetzt' ? 0 : MINDEST_ALTER_MS });
        const text = `${r.gefunden} aufgenommen · ${r.fertig} fertig · ${r.weiterOffen} weiter offen · ${r.gescheitert} gescheitert`;
        return r.gescheitert || r.weiterOffen ? fehl(`Absichten: ${text}`) : gut(`ABSICHTEN: ${text}`);
      }
      case 'ki-medien': {
        // Anbieter-Tor (09.10., Paket 6a): laufende Video-/Tiefenbericht-Aufträge abholen, verschlüsselt ablegen, Kosten buchen.
        const { kiAuftraegeAbholen } = await import('@/lib/ki/aufruf');
        const r = await kiAuftraegeAbholen();
        return gut(`KI-MEDIEN: ${r.fertig} abgeholt · ${r.offen} laufen noch · ${r.fehler} gescheitert`);
      }
      case 'durchsicht': {
        // Paket D-A (29.09.): Datenschicht-Durchsicht — nur lesen und zählen, Ergebnis in hoi-durchsicht (Head of IT).
        const { durchsichtLauf } = await import('@/lib/store/durchsicht');
        const r = await durchsichtLauf(new Date(), auftrag === 'jetzt');
        return r.ok ? gut(`DURCHSICHT${r.uebersprungen ? ' (heute schon gelaufen)' : ''}: ${r.text}`) : fehl(`Durchsicht: ${r.text}`);
      }
      case 'zoe-aufgaben': {
        // Paket C4: ZOE bereitet ihre Aufgaben vor — nur Vorschläge (Stapel), nie Übernahme. Mit Person nur deren Aufträge.
        const { zoeAufgabenLauf } = await import('./aufgaben-lauf');
        const r = await zoeAufgabenLauf({ person: person ?? null });
        if (!r.ok) return fehl(`ZOE-Aufgaben: ${kuerze(r.uebersprungen.map(u => u.grund).join(' · '), 200)}`);
        if (r.ohneKi) return gut(`ZOE-AUFGABEN: nichts vorbereitet (${r.ohneKi}); ${r.rest} warten.`);
        return gut(`ZOE-AUFGABEN: ${r.bearbeitet.length} vorbereitet (warten auf Freigabe)${r.uebersprungen.length ? `, ${r.uebersprungen.length} übersprungen` : ''}${r.rest ? `, ${r.rest} noch offen` : ''}.`);
      }
      case 'selbstbild': {
        const d = await post('/api/zoe/selbstbild', {}, 120_000);
        if (!d.ok) return fehl(`Selbstbild fehlgeschlagen: ${kuerze(d.ergebnisse?.[0]?.fehler ?? d.error, 200)}`);
        return gut(`SELBSTBILD: ${d.geschrieben} von ${d.von} Blättern im Vault aktualisiert.`);
      }
      case 'finanzchef': {
        // Der Takt gibt Modus und Person vor („modus:wochenreview person:kevin“) —
        // dann läuft er mit Haushalt, und das Ergebnis hier trägt KEINE Beträge,
        // weil die Warteschlange allen Konten gehört. Ohne Person (ZOE): nur Business.
        const modus = /modus:(tagescheck|wochenreview|monatsabschluss|steuercheck)/.exec(auftrag)?.[1];
        const fuer = personAusText(auftrag);
        const r = await fetch(`${origin}/api/finanzchef`, {
          method: 'POST', headers: { ...H, ...(fuer ? { 'x-make-person': fuer } : {}) },
          body: JSON.stringify(modus ? { aktion: 'lauf', modus, ausgeloest: 'takt' } : { aktion: 'lauf', modus: 'frage', frage: auftrag || 'Wie ist die Finanzlage?', ausgeloest: 'zoe', umfang: 'business' }),
          signal: AbortSignal.timeout(400_000),
        });
        const d = await r.json();
        if (!d.ok) return fehl(`Head of Finance: ${kuerze(d.fehler, 200)}`);
        if (d.ohneKi) return gut(`HEAD OF FINANCE · Tagescheck: ${d.ruhigText}`);
        const a = d.bericht?.antwort;
        const zahlen = `${a?.befunde?.length ?? 0} Befunde, ${d.neu ?? 0} neue Vorschläge zur Freigabe`;
        if (d.bericht?.umfang !== 'business') return gut(`HEAD OF FINANCE · ${modus}: Status ${a?.status} · ${zahlen} — Bericht unter Finanzen › Head of Finance.`);
        return gut(`HEAD OF FINANCE (Business):
${kuerze(a?.antwort ?? a?.zusammenfassung, 1600)}
${(a?.vorschlaege ?? []).map((v: { titel: string }) => `→ ${v.titel}`).join('\n')}
(${zahlen}; Prüfung: ${d.bericht?.pruefung?.geprueft ?? 0} Zahlen, ${d.bericht?.pruefung?.unbelegt?.length ?? 0} unbelegt)`);
      }
      case 'head-sales':
      case 'head-marketing':
      case 'head-event': {
        // Takt: „modus:power_hour“ — sonst eine Frage von ZOE (Antwort im Gespräch, keine Freigabe-Liste).
        const head = id.slice(5);
        const modus = /modus:([a-z_]+)/.exec(auftrag)?.[1];
        // „person:malin“ — die Power Hour wird je Person vorbereitet (ihre Karten, ihre Freigabe).
        const fuer = personAusText(auftrag);
        const r = await fetch(`${origin}/api/heads/${head}`, {
          method: 'POST', headers: { ...H, ...(fuer ? { 'x-make-person': fuer } : {}) },
          body: JSON.stringify(modus ? { aktion: 'lauf', modus, ausgeloest: 'takt' } : { aktion: 'lauf', modus: 'frage', frage: auftrag || 'Wie ist die Lage?', ausgeloest: 'zoe' }),
          signal: AbortSignal.timeout(400_000),
        });
        const d = await r.json();
        if (!d.ok) return fehl(`${id}: ${kuerze(d.fehler, 200)}`);
        if (d.ohneKi) return gut(`${id.toUpperCase()}: ${d.ruhigText}`);
        const a = d.bericht?.antwort;
        return gut(`${id.toUpperCase()} · ${modus ?? 'frage'}: ${kuerze(a?.antwort || a?.zusammenfassung, 1400)}
${(a?.vorschlaege ?? []).map((v: { titel: string }) => `→ ${v.titel}`).join('\n')}
(${d.neu ?? 0} neu in der Freigabe-Liste · ${d.bericht?.pruefung?.gestrichen?.length ?? 0} vom Prüfer gestrichen)`);
      }
      case 'meeting': {
        if (!auftrag || auftrag.length < 80) return fehl('Meeting-Agent braucht ein Transkript oder ausführliche Notizen — bitte Kevin, sie einzusprechen oder einzufügen.');
        const d = await post('/api/meeting', { transcript: auftrag }, 180_000);
        if (d.error) return fehl(`Meeting fehlgeschlagen: ${kuerze(d.error, 200)}`);
        const items = (d.actionItems ?? []) as { titel?: string; owner?: string; prio?: string; due?: string }[];
        // Ein Platz für das Ergebnis (27.09.): die Aufgaben aus dem Protokoll werden create_task-Vorschläge im Stapel.
        const gestapelt = await stapleAlle(items.slice(0, 8).filter(x => x.titel).map(x => ['create_task', { title: x.titel, why: `Aus dem Meeting „${kuerze(d.titel ?? 'Meeting', 80)}“`, priority: x.prio, wer: x.owner, faellig: x.due, space: 'business' }] as const), origin, person, `Meeting-Agent: ${kuerze(d.titel ?? 'Protokoll', 100)}`);
        return gut(`PROTOKOLL: ${kuerze(d.titel ?? d.summary, 300)}\nEntscheidungen: ${(d.entscheidungen ?? []).join(' · ') || 'keine'}\n`
          + `Aufgaben (${items.length}): ${items.slice(0, 8).map(x => `${x.titel}${x.owner ? ` (${x.owner})` : ''}`).join(' · ')}\n(${gestapelt} davon liegen als Aufgaben-Vorschläge im Stapel.)`);
      }
    }
  } catch (err) {
    return fehl(`${id} fehlgeschlagen: ${err instanceof Error ? err.message.slice(0, 200) : 'Fehler'}`);
  }
  return fehl('Unbekannter Agent.');
}

// ── Markttraktion im Takt (25.09.) ─────────────────────────────────────────
// Was der Lauf „markttraktion“ tut: für jede fällige Person (Team, Konto) den Text bauen (lib/crm/scoreboard.ts — morgenText werktags,
// wochenText freitags) und über den EINEN Sendeweg `anPersonMelden` schicken (ZOE auf WhatsApp, sonst Telegram — und seit dem Feinschliff
// 09.10. ohne Boten-Kanal die Glocke), dann den Riegel setzen. Die Nachricht geht an Personen des Teams selbst, nie an Kunden. Zahlen nur mit
// der Ausnahme der Person (`inhalteErlaubtFuer` — WhatsApp „Inhalte senden“, sonst Telegram „vollständig“), sonst ein neutraler Hinweis mit
// Link (Telegram-Regel, Woche 2 · 7.3). Nicht zugestellt → ein Fehlversuch, nach drei ist für den Tag Ruhe (kein Minutentakt).
// Ein Slot als Auftrag („woche“, „morgen person:<speicher>“) schickt sofort — für ZOE auf Zuruf.
async function markttraktionLauf(auftrag: string, jetzt = new Date(), person?: string): Promise<AgentLauf> {
  const { anPersonMelden, inhalteErlaubtFuer } = await import('./an-person');
  const { loadJson, updateJson } = await import('@/lib/store/local-db');
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const { alleSpeicher } = await import('@/lib/zugang/konten');
  const { aussenAdresse } = await import('@/lib/innen');
  const { TEAM, nameVon } = await import('@/lib/crm/team');
  const S = await import('@/lib/crm/scoreboard');

  const heute = localDay(jetzt);
  const [mitKonto, riegel] = await Promise.all([alleSpeicher(), loadJson<unknown>(S.RHYTHMUS_SPEICHER)]);
  // Jede Person im Team mit Konto — ohne Boten-Kanal bekommt sie die Glocke (vorher fiel sie ganz heraus).
  const personen = TEAM.map(t => t.id).filter(p => mitKonto.includes(p));
  const zwang = S.RHYTHMUS_SLOTS.find(s => new RegExp(`(^|\\s)${s}(\\s|$)`).test(auftrag.trim()));
  // Sofort-Versand nur an die Person des Laufs; „person:x“ im Text gilt nur für den Takt (26.09.).
  const nur = person ?? /person:([a-z0-9-]{1,40})/.exec(auftrag)?.[1];
  // Business-frei (08.10., Lücke 7): der Takt schickt in der freien Zeit niemandem eine Markttraktion-Nachricht — der ausdrückliche
  // Sofort-Versand (`zwang`, von Hand) bleibt.
  const { nichtBusinessFrei } = await import('@/lib/arbeitsrahmen/server');
  const dran = zwang
    ? personen.filter(p => !nur || p === nur).map(person => ({ person, slot: zwang }))
    : S.faelligeRhythmen(S.rhythmusStand(riegel), await nichtBusinessFrei(personen, jetzt), jetzt);
  if (!dran.length) return gut(personen.length ? 'MARKTTRAKTION: nichts fällig.' : 'MARKTTRAKTION: niemand im Team hat ein Konto.');

  // Art. 18 zentral (29.09., #72): eingeschränkte Personen stehen nie in der Morgen-/Wochennachricht.
  const [kontakte, crm] = await Promise.all([(await import('@/lib/crm/verarbeitung')).kontakteFuerVerarbeitung(), ladeCrm()]);
  const adresse = aussenAdresse();
  const ergebnisse: { person: string; slot: typeof dran[number]['slot']; ok: boolean; zeile: string }[] = [];
  for (const { person, slot } of dran) {
    // Inhalte (Zahlen) nur mit der Ausnahme DES Kanals, der genutzt wird — ohne Kanal (Glocke) gilt die Vorgabe: neutral.
    const o = { adresse, inhalte: await inhalteErlaubtFuer(person).catch(() => false) };
    const text = slot === 'morgen' ? S.morgenText(person, kontakte, crm, heute, o) : S.wochenText(person, kontakte, crm, heute, o);
    const r = await anPersonMelden(person, slot === 'morgen' ? 'markttraktion' : 'rueckblick', text, { link: S.MARKTTRAKTION_PFAD, glocke: true });
    const zugestellt = r.erreicht > 0 || r.kanal === 'glocke';
    ergebnisse.push({ person, slot, ok: zugestellt, zeile: `${nameVon(person)} · ${slot === 'morgen' ? 'Morgen' : 'Wochen-Scoreboard'}: ${r.kanal === 'glocke' ? 'Glocke' : zugestellt ? 'gesendet' : r.fehler ?? 'nicht zugestellt'}` });
  }
  await updateJson<unknown>(S.RHYTHMUS_SPEICHER, cur => ergebnisse.reduce((s, e) => S.markiereRhythmus(s, e.person, e.slot, heute, e.ok), S.rhythmusStand(cur)));
  return gut(`MARKTTRAKTION: ${ergebnisse.map(e => e.zeile).join(' · ')}`);
}
