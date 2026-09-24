// ─── MAKE OS — Jarvis führt die Fach-Agenten aus ────────────────────────────
// Bis 07.09. erreichte Jarvis sechs von 22 Agenten; der Rest lief nur auf
// Knopfdruck in der Oberfläche. Kevins Ansage: „dass er dann wirklich die
// Agents auch einfach angreift." Also stehen hier alle, die ohne Eingabe vor
// Ort laufen können — mit derselben Regel wie vorher: die Autonomie-Stufe des
// Agenten bleibt maßgeblich, nichts geht ohne Freigabe nach außen.

import { resolveAgent } from '@/lib/agent-config';
import { localDay } from '@/lib/zeit';

/** Agenten, die Jarvis selbst starten darf. */
export const AUSFUEHRBAR = [
  'research', 'board', 'okr', 'controlling', 'finanzchef', 'fokus', 'kalender',
  'inbox', 'task', 'prospect', 'planung', 'ernaehrung', 'performance', 'content', 'meeting', 'outreach', 'crm',
  'head-sales', 'head-marketing', 'head-event',
  // Systemläufe: kein Fach-Agent, sondern der Takt selbst. Sie stehen hier,
  // damit der Arbeiter sie wie alles andere aus der Warteschlange holt.
  'tagesstart', 'tageslauf', 'verbesserung', 'morgen', 'abend', 'selbstbild', 'gesundheit',
] as const;
export type Ausfuehrbar = typeof AUSFUEHRBAR[number];

/** Was Jarvis dem Modell über jeden Agenten sagen muss, damit es den
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
  crm: 'Wer ist heute im CRM dran — Tagesliste mit Grund, Aufhänger und Kanal',
  'head-sales': 'Head of Sales — Vertriebslage, Pipeline, Mandate, wer heute dran ist (auftrag = Frage, oder modus:power_hour | deal_review | kundenreview | wochenreview)',
  'head-marketing': 'Head of Marketing — Einwilligungsbestand, Art.-14-Fristen, Themen aus der Stimme der Kunden (auftrag = Frage, oder modus:wochenplan | monatsreview)',
  'head-event': 'Head of Event — Events planen, Gäste, Nachfassen in 48 h, Wirkung (auftrag = Frage, oder modus:planung | einladung | nachfassen | wirkung)',
  tagesstart: 'Der Morgenlauf — Kalender auffrischen, Lage bauen (einmal am Tag)',
  tageslauf: 'Ein Durchgang des Tageslaufs (auftrag = voll | kurz | puls)',
  verbesserung: 'Der Verbesserungs-Loop über Nutzung, Fehler und Bauplan',
  morgen: 'Der Morgenlauf — sieht die Lage an und legt Vorschläge in den Stapel',
  abend: 'Der Abendlauf — was blieb liegen, was muss morgen früh stehen',
  selbstbild: 'Schreibt fort, was die Software über sich selbst im Gehirn hat',
  gesundheit: 'Der Gesundheits-Takt — schickt Kevin und Malin morgens, mittags, abends die Nachricht aufs Handy (auftrag = morgen | mittag | abend | woche, sonst was fällig ist)',
};

/**
 * Läufe, die kein Fach-Agent sind — für sie gibt es keinen Schalter unter
 * /os/agenten, sie gehören zum Takt des Systems.
 *
 * Exportiert, damit der Verzeichnis-Test dieselbe Liste benutzt statt einer
 * eigenen Kopie. Eine zweite Liste hätte genau einen Zweck: irgendwann von
 * dieser abzuweichen.
 */
export const SYSTEM_LAEUFE = ['tagesstart', 'tageslauf', 'verbesserung', 'morgen', 'abend', 'selbstbild', 'gesundheit'] as const;
const SYSTEM = new Set<string>(SYSTEM_LAEUFE);

const kuerze = (t: unknown, n = 1600) => String(t ?? '').slice(0, n);

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

export async function runAgent(id: Ausfuehrbar, auftrag: string, origin: string): Promise<AgentLauf> {
  // Der Agenten-Schalter unter /os/agenten gilt weiterhin. Ausgeschaltet ist
  // ausgeschaltet — auch für Jarvis.
  if (!SYSTEM.has(id)) {
    // Seit 07.09. stehen planung, ernaehrung und performance mit eigener id im
    // Verzeichnis. Vorher fragten sie hier nach FREMDEN Konfigurationen
    // (health, kalender, fokus) — der Schalter auf /os/agenten hätte für sie
    // also nichts bewirkt, obwohl er dastand.
    const cfg = await resolveAgent(id);
    if (!cfg.enabled) return fehl(`${cfg.name} ist ausgeschaltet (unter /os/agenten aktivierbar).`);
  }

  const H = { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '' };
  const post = async (pfad: string, body: unknown, timeoutMs = 90_000) => {
    const r = await fetch(`${origin}${pfad}`, {
      method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    });
    return r.json();
  };
  const get = async (pfad: string, timeoutMs = 60_000) => {
    const r = await fetch(`${origin}${pfad}`, { headers: H, signal: AbortSignal.timeout(timeoutMs) });
    return r.json();
  };

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
        return gut(`KALENDER-ANALYSE:\n${d.briefing ?? ''}\nKonflikte: ${(d.conflicts ?? []).length}\nVorschläge: ${v || 'keine'}${d.eingetragen ? '\n(Blöcke wurden automatisch eingetragen — Kalender-Agent steht auf autonom.)' : '\n(Eintragen braucht Kevins Klick — Kalender-Agent steht auf Freigabe.)'}`);
      }

      // ── Neu ab 07.09.: die Agenten, die Jarvis bisher nicht erreichte ──
      case 'inbox': {
        // Triage braucht die Nachrichten — Jarvis holt sie selbst, statt Kevin
        // erst auf /os/inbox zu schicken.
        const mails = await get('/api/apple-mail', 60_000);
        if (!Array.isArray(mails)) return fehl(`Postfach nicht lesbar: ${kuerze((mails as { error?: string })?.error, 160)}`);
        const d = await post('/api/inbox/triage', { nachrichten: mails.slice(0, 40) }, 150_000);
        if (!d.ok) return fehl(`Triage fehlgeschlagen: ${kuerze(d.error, 200)}`);
        const t = d.triage ?? {};
        const zaehl = { wichtig: 0, normal: 0, rauschen: 0 } as Record<string, number>;
        for (const k of Object.keys(t)) { const s = String((t[k] as { stufe?: string })?.stufe ?? 'normal'); zaehl[s] = (zaehl[s] ?? 0) + 1; }
        return gut(`POSTFACH EINGESTUFT (${d.neu ?? 0} neu bewertet):\nwichtig ${zaehl.wichtig} · normal ${zaehl.normal} · Rauschen ${zaehl.rauschen}. Steht in der Inbox, Zero-Durchlauf startet dort.`);
      }
      case 'task': {
        const d = await post('/api/delegation', {}, 120_000);
        const v = (d.vorschlaege ?? []) as { titel?: string; an?: string; warum?: string }[];
        if (!v.length) return gut(`DELEGATION: nichts zum Abgeben gefunden${d.privatAnzahl ? ` (${d.privatAnzahl} private Aufgaben bleiben außen vor)` : ''}.`);
        return gut(`DELEGATION — ${v.length} Vorschläge:\n` + v.slice(0, 8).map(x => `• ${x.titel} → ${x.an}${x.warum ? ` (${x.warum})` : ''}`).join('\n'));
      }
      case 'prospect': {
        const st = await get('/api/state/prospects');
        const liste = (st?.state?.prospects ?? st?.prospects ?? []) as { company?: string; score?: number }[];
        const offen = liste.filter(p => p.score == null).slice(0, 5);
        if (!offen.length) return gut(`PROSPECTING: alle ${liste.length} Firmen sind bereits bewertet.`);
        const icp = String(st?.state?.icp ?? st?.icp ?? '');
        const ergebnisse = await Promise.all(offen.map(p => post('/api/prospecting/score', { prospect: p, icp }).catch(() => null)));
        const zeilen = offen.map((p, i) => {
          const e = ergebnisse[i] as { score?: number; fit?: string } | null;
          return e?.score != null ? `• ${p.company}: ${e.score}/100 — ${kuerze(e.fit, 90)}` : `• ${p.company}: nicht bewertbar`;
        });
        return gut(`PROSPECTING — ${offen.length} von ${liste.length} bewertet:\n${zeilen.join('\n')}\n(Die Werte stehen in der Zielliste.)`);
      }
      case 'planung': {
        const mo = new Date(); mo.setDate(mo.getDate() - ((mo.getDay() + 6) % 7));
        const d = await post('/api/planung/vorschlag', { woche: localDay(mo), hinweis: auftrag || undefined }, 150_000);
        const b = (d.bloecke ?? []) as { titel?: string; date?: string; startMin?: number }[];
        if (!b.length) return fehl(`Planungs-Vorschlag fehlgeschlagen: ${kuerze(d.error ?? d.begruendung, 200)}`);
        const hh = (m?: number) => `${String(Math.floor((m ?? 0) / 60)).padStart(2, '0')}:${String((m ?? 0) % 60).padStart(2, '0')}`;
        return gut(`WOCHENPLAN-VORSCHLAG (${b.length} Blöcke${d.verworfen ? `, ${d.verworfen} wegen Kollision verworfen` : ''}):\n${kuerze(d.begruendung, 500)}\n`
          + b.slice(0, 10).map(x => `• ${x.date} ${hh(x.startMin)} — ${x.titel}`).join('\n')
          + '\n(Kevin bestätigt die Blöcke im Planer.)');
      }
      case 'ernaehrung': {
        const d = await post('/api/ernaehrung/vorschlag', { hinweis: auftrag || undefined }, 120_000);
        if (!d.begruendung && !d.plan) return fehl(`Ernährung fehlgeschlagen: ${kuerze(d.error, 200)}`);
        const tage = Array.isArray(d.plan) ? d.plan.length : 0;
        return gut(`ESSENSPLAN (${tage} Tage):\n${kuerze(d.begruendung, 500)}\nEinkaufsliste: ${(d.einkauf ?? []).length} Posten. Steht unter /os/ernaehrung.`);
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
        const d = await post('/api/content', { thema: auftrag, format: 'linkedin' }, 150_000);
        return d.reply ? gut(`ENTWURF (${d.format}):\n${kuerze(d.reply, 2000)}\n(Veröffentlichen bleibt bei Kevin.)`) : fehl(`Content fehlgeschlagen: ${kuerze(d.error, 200)}`);
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
        const d = await post('/api/jarvis/morgen', {}, 200_000);
        if (!d.ok) return fehl(`Morgenlauf fehlgeschlagen: ${kuerze(d.error, 200)}`);
        return gut(`MORGENLAUF: ${d.gestapelt ?? 0} Vorschläge im Stapel. ${kuerze(d.bericht, 500)}`);
      }
      case 'abend': {
        const d = await post('/api/jarvis/morgen', { zeit: 'abend' }, 200_000);
        if (!d.ok) return fehl(`Abendlauf fehlgeschlagen: ${kuerze(d.error, 200)}`);
        return gut(`ABENDLAUF: ${d.gestapelt ?? 0} Vorschläge für morgen. ${kuerze(d.bericht, 500)}`);
      }
      case 'crm': {
        const d = await get('/api/crm/ansprechen?n=8');
        const liste = (d?.liste ?? []) as { kontakt: { id: string; vorname: string; nachname: string; firma?: string; position?: string; aufhaenger?: string; stufe: string; prio: string }; grund: string; kanaele: { art: string }[] }[];
        const st = d?.stand ?? {};
        if (!liste.length) return gut(`CRM: niemand fällig. Stand: ${st.gesamt ?? 0} Kontakte, ${st.ansprechbar ?? 0} ansprechbar.`);
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
        if (!ziel) return fehl(auftrag ? `Weder im CRM noch in der Zielliste: „${auftrag}".` : 'Niemand fällig im CRM und kein unkontaktierter Treffer in der Zielliste.');
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
      case 'selbstbild': {
        const d = await post('/api/jarvis/selbstbild', {}, 120_000);
        if (!d.ok) return fehl(`Selbstbild fehlgeschlagen: ${kuerze(d.ergebnisse?.[0]?.fehler ?? d.error, 200)}`);
        return gut(`SELBSTBILD: ${d.geschrieben} von ${d.von} Blättern im Vault aktualisiert.`);
      }
      case 'finanzchef': {
        // Der Takt gibt Modus und Person vor („modus:wochenreview person:kevin“) —
        // dann läuft er mit Haushalt, und das Ergebnis hier trägt KEINE Beträge,
        // weil die Warteschlange allen Konten gehört. Ohne Person (Jarvis): nur Business.
        const modus = /modus:(tagescheck|wochenreview|monatsabschluss|steuercheck)/.exec(auftrag)?.[1];
        const person = /person:([a-z0-9-]{1,40})/.exec(auftrag)?.[1];
        const r = await fetch(`${origin}/api/finanzchef`, {
          method: 'POST', headers: { ...H, ...(person ? { 'x-make-person': person } : {}) },
          body: JSON.stringify(modus ? { aktion: 'lauf', modus, ausgeloest: 'takt' } : { aktion: 'lauf', modus: 'frage', frage: auftrag || 'Wie ist die Finanzlage?', ausgeloest: 'jarvis', umfang: 'business' }),
          signal: AbortSignal.timeout(400_000),
        });
        const d = await r.json();
        if (!d.ok) return fehl(`Head of Finance: ${kuerze(d.fehler, 200)}`);
        if (d.ohneKi) return gut(`HEAD OF FINANCE · Tagescheck: ${d.ruhigText}`);
        const a = d.bericht?.antwort;
        const zahlen = `${a?.befunde?.length ?? 0} Befunde, ${d.neu ?? 0} neue Vorschläge zur Freigabe`;
        if (d.bericht?.umfang !== 'business') return gut(`HEAD OF FINANCE · ${modus}: Status ${a?.status} · ${zahlen} — Bericht unter Zahlen › Head of Finance.`);
        return gut(`HEAD OF FINANCE (Business):
${kuerze(a?.antwort ?? a?.zusammenfassung, 1600)}
${(a?.vorschlaege ?? []).map((v: { titel: string }) => `→ ${v.titel}`).join('\n')}
(${zahlen}; Prüfung: ${d.bericht?.pruefung?.geprueft ?? 0} Zahlen, ${d.bericht?.pruefung?.unbelegt?.length ?? 0} unbelegt)`);
      }
      case 'head-sales':
      case 'head-marketing':
      case 'head-event': {
        // Takt: „modus:power_hour“ — sonst eine Frage von Jarvis (Antwort im Gespräch, keine Freigabe-Liste).
        const head = id.slice(5);
        const modus = /modus:([a-z_]+)/.exec(auftrag)?.[1];
        const r = await fetch(`${origin}/api/heads/${head}`, {
          method: 'POST', headers: H,
          body: JSON.stringify(modus ? { aktion: 'lauf', modus, ausgeloest: 'takt' } : { aktion: 'lauf', modus: 'frage', frage: auftrag || 'Wie ist die Lage?', ausgeloest: 'jarvis' }),
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
        const items = (d.actionItems ?? []) as { titel?: string; owner?: string }[];
        return gut(`PROTOKOLL: ${kuerze(d.titel ?? d.summary, 300)}\nEntscheidungen: ${(d.entscheidungen ?? []).join(' · ') || 'keine'}\n`
          + `Aufgaben (${items.length}): ${items.slice(0, 8).map(x => `${x.titel}${x.owner ? ` (${x.owner})` : ''}`).join(' · ')}\n(Übernahme in echte Aufgaben mit Kevins Klick unter /os/meeting.)`);
      }
    }
  } catch (err) {
    return fehl(`${id} nicht erreichbar: ${err instanceof Error ? err.message.slice(0, 150) : 'Fehler'}`);
  }
  return fehl('Unbekannter Agent.');
}
