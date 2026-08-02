// ─── MAKE OS — MAKE (echte KI, Chief of Staff) ─────────────────────────────
// Direkter Aufruf der Anthropic Messages API (kein SDK nötig). Läuft, sobald
// ANTHROPIC_API_KEY in .env.local steht. Ohne Key antwortet MAKE freundlich
// statt zu crashen — die App bleibt benutzbar.

import { NextResponse } from 'next/server';
import { agentRoster, LIVE_AGENTS } from '@/lib/make-one/agents-data';
import { gatherBrain, promptBrain } from '@/lib/brain';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent } from '@/lib/agent-config';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';



// Live-Bewusstsein kommt jetzt aus dem Brain — derselben Kontextschicht, die
// auch Loops und Tageslauf nutzen. Eine Wahrheit statt vier Sammler.
async function liveContext(): Promise<string> {
  try {
    const b = await gatherBrain();
    return promptBrain(b);
  } catch {
    return '(Brain gerade nicht erreichbar — antworte vorsichtig und sag das offen.)';
  }
}

// ── Jarvis führt Agenten SELBST aus (read-only/Entwurf — Freigaben bleiben) ──
// Jede Ausführung respektiert die Agenten-Verwaltung: abgeschaltete Agenten
// verweigern; alles, was nach außen schreibt, hängt weiter an der Autonomie-
// Stufe des jeweiligen Agenten (z. B. Kalender-Eintrag nur bei „autonom").
const AUSFUEHRBAR = ['research', 'board', 'okr', 'controlling', 'fokus', 'kalender'] as const;
type Ausfuehrbar = typeof AUSFUEHRBAR[number];

async function runAgent(id: Ausfuehrbar, auftrag: string, origin: string): Promise<string> {
  const cfg = await resolveAgent(id);
  if (!cfg.enabled) return `${cfg.name} ist ausgeschaltet (unter /os/agenten aktivierbar).`;

  const H = { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '' };
  const post = async (pfad: string, body: unknown, timeoutMs = 90_000) => {
    const r = await fetch(`${origin}${pfad}`, {
      method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    });
    return r.json();
  };
  const kuerze = (t: unknown, n = 1600) => String(t ?? '').slice(0, n);

  try {
    switch (id) {
      case 'research': {
        const d = await post('/api/research', { query: auftrag || 'Aktuelle Lage' }, 160_000);
        return d.reply ? `RESEARCH-ERGEBNIS${d.webUsed ? ' (mit Web-Suche)' : ''}:\n${kuerze(d.reply, 2200)}` : `Research fehlgeschlagen: ${kuerze(d.error, 200)}`;
      }
      case 'board': {
        const d = await post('/api/board', {});
        if (!d.headline) return `Board fehlgeschlagen: ${kuerze(d.error, 200)}`;
        const sekt = (d.sektionen ?? []).map((x: { titel: string; punkte?: string[] }) => `${x.titel}: ${(x.punkte ?? []).join(' · ')}`).join('\n');
        return `BOARD-PACK:\n${d.headline}\n${sekt}\nRisiken: ${(d.risiken ?? []).join(' · ')}\nNächste Woche: ${(d.naechsteWoche ?? []).join(' · ')}`;
      }
      case 'okr': {
        const d = await post('/api/okr', {});
        if (!d.lage) return `OKR fehlgeschlagen: ${kuerze(d.error, 200)}`;
        const obj = (d.objectives ?? []).map((o: { titel?: string; luecke?: string }) => `${o.titel}${o.luecke ? ` (Lücke: ${o.luecke})` : ''}`).join('\n');
        return `OKR-ZIELBAUM:\n${d.lage}\n${obj}`;
      }
      case 'controlling': {
        const d = await post('/api/controlling/analyse', {});
        if (!d.briefing) return `Controlling fehlgeschlagen: ${kuerze(d.error, 200)}`;
        return `CONTROLLING-LAGE:\n${d.briefing}\nFokus: ${(d.fokus ?? []).join(' · ')}\nRisiken: ${(d.risiken ?? []).join(' · ')}`;
      }
      case 'fokus': {
        const d = await post('/api/fokus', {});
        return d.reply ? `TAGESFORM (${d.zone}, Recovery ${d.recovery}%):\n${kuerze(d.reply, 1600)}` : `Fokus fehlgeschlagen: ${kuerze(d.error, 200)}`;
      }
      case 'kalender': {
        const d = await post('/api/kalender/analyse', {}, 120_000);
        if (!d.briefing && !d.vorschlaege) return `Kalender fehlgeschlagen: ${kuerze(d.error, 200)}`;
        const v = (d.vorschlaege ?? []).map((x: { title: string; date: string; startHour: number }) => `${x.title} ${x.date} ${x.startHour}:00`).join(' · ');
        return `KALENDER-ANALYSE:\n${d.briefing ?? ''}\nKonflikte: ${(d.conflicts ?? []).length}\nVorschläge: ${v || 'keine'}${d.eingetragen ? '\n(Blöcke wurden automatisch eingetragen — Kalender-Agent steht auf autonom.)' : '\n(Eintragen braucht Kevins Klick — Kalender-Agent steht auf Freigabe.)'}`;
      }
    }
  } catch (err) {
    return `${id} nicht erreichbar: ${err instanceof Error ? err.message.slice(0, 150) : 'Fehler'}`;
  }
  return 'Unbekannter Agent.';
}

// ── Jarvis plant SELBST: Block in den Wochenplan legen (Kevins Ansage:
// „dass da auch drin geplant werden kann"). Interne Planung, frei verschiebbar
// — aber NIE über feste Termine (harte Kollisionsprüfung vor dem Schreiben).
const PLAN_ARTEN = ['fokus', 'reha', 'routine', 'pause', 'aufgabe', 'block'] as const;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

async function planBlock(input: Record<string, unknown>): Promise<string> {
  const date = String(input.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Fehlgeschlagen: date muss YYYY-MM-DD sein.';
  if (date < localDay()) return `Fehlgeschlagen: ${date} liegt in der Vergangenheit — plane ab heute (${localDay()}).`;
  const startMin = Math.max(6 * 60, Math.min(22 * 60 - 15, Math.round(Number(input.startMin) / 15) * 15 || 9 * 60));
  const dauerMin = Math.max(15, Math.min(240, Math.round(Number(input.dauerMin) / 15) * 15 || 60));
  const titel = String(input.titel ?? '').slice(0, 120) || 'Block';
  const art = (PLAN_ARTEN as readonly string[]).includes(String(input.art)) ? String(input.art) : 'block';
  const ende = startMin + dauerMin;

  // Feste Termine beider Kalender an diesem Tag — nichts wird überplant.
  const [cal, kem] = await Promise.all([
    loadJson<{ events?: { title?: string; startDate?: string; endDate?: string; allDay?: boolean }[] }>('calendar-cache'),
    loadJson<{ events?: { title?: string; start?: string; end?: string }[] }>('kemaris-calendar'),
  ]);
  const fest = [
    ...(cal?.events ?? []).filter(e => !e.allDay && e.startDate?.slice(0, 10) === date).map(e => ({ titel: e.title ?? '', s: e.startDate!, e: e.endDate })),
    ...(kem?.events ?? []).filter(e => e.start?.slice(0, 10) === date).map(e => ({ titel: e.title ?? '', s: e.start!, e: e.end })),
  ].map(x => {
    const s = new Date(x.s);
    const sMin = s.getHours() * 60 + s.getMinutes();
    const eMin = x.e ? (d => d.getHours() * 60 + d.getMinutes())(new Date(x.e)) : sMin + 60;
    return { titel: x.titel, s: sMin, e: Math.max(eMin, sMin + 15) };
  });
  const kollision = fest.find(f => startMin < f.e && f.s < ende);
  if (kollision) return `Kollision mit festem Termin „${kollision.titel}" (${hhmm(kollision.s)}–${hhmm(kollision.e)}) am ${date} — nicht eingeplant. Schlage Kevin eine freie Zeit vor.`;

  const mo = new Date(`${date}T12:00:00`);
  mo.setDate(mo.getDate() - ((mo.getDay() + 6) % 7));
  const woche = localDay(mo);
  interface PB { id: string; date: string; startMin: number; dauerMin: number; titel: string; art: string }
  const block: PB = { id: `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, date, startMin, dauerMin, titel, art };
  await updateJson<Record<string, PB[]>>('wochenplan', current => {
    const f = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    const liste = Array.isArray(f[woche]) ? f[woche] : [];
    if (liste.length >= 120) return f;
    return { ...f, [woche]: [...liste, block] };
  });
  return `Eingeplant: „${titel}" am ${date}, ${hhmm(startMin)}–${hhmm(ende)} (${art}). Kevin sieht den Block sofort im Planer und kann ihn frei verschieben.`;
}

// ─── Jarvis als Eingabe-Schicht: Kevin ruft zu, Jarvis schreibt in die Stores.
// Interne Buchführung (nichts geht nach außen) — jede Erfassung wird im Chat
// knapp bestätigt und erscheint sofort in Finanzplanung/Meilensteinen/CRM.

const eurW = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n || 0));
const firmaId = (rein: unknown): 'kdv' | 'kdc' => (/ventures|kdv/i.test(String(rein ?? '')) ? 'kdv' : 'kdc');

async function setzeKontostand(input: Record<string, unknown>): Promise<string> {
  const betrag = Number(input.betrag);
  if (!isFinite(betrag)) return 'Fehlgeschlagen: betrag fehlt oder ist keine Zahl.';
  const fid = firmaId(input.firma);
  let name: string = fid;
  await updateJson<{ firmen: { id: string; name: string; kontostand: number | null; stand: string | null }[] }>('finanzplan', current => {
    const f = current ?? { firmen: [] };
    f.firmen = (f.firmen ?? []).map(x => {
      if (x.id !== fid) return x;
      name = x.name;
      return { ...x, kontostand: Math.round(betrag), stand: localDay() };
    });
    return f;
  });
  return `Erfasst: Kontostand ${name} = ${eurW(betrag)} (Stand heute).`;
}

async function erfasseRechnung(input: Record<string, unknown>): Promise<string> {
  const kunde = String(input.kunde ?? '').trim().slice(0, 120);
  if (!kunde) return 'Fehlgeschlagen: kunde fehlt.';
  const status = ['geplant', 'gestellt', 'bezahlt'].includes(String(input.status)) ? String(input.status) : undefined;
  const betrag = isFinite(Number(input.betrag)) ? Math.max(0, Math.round(Number(input.betrag))) : undefined;
  const faellig = /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : undefined;
  const titel = input.titel ? String(input.titel).slice(0, 200) : undefined;
  let aktion = '';
  await updateJson<{ rechnungen: { id: string; firmaId: string; kunde: string; titel: string; betrag: number; status: string; faellig?: string }[] }>('finanzplan', current => {
    const f = current ?? { rechnungen: [] };
    f.rechnungen = f.rechnungen ?? [];
    const idx = f.rechnungen.findIndex(r => r.kunde.toLowerCase() === kunde.toLowerCase() && (!titel || r.titel.toLowerCase().includes(titel.toLowerCase())));
    if (idx >= 0) {
      const r = f.rechnungen[idx];
      f.rechnungen[idx] = { ...r, ...(betrag != null ? { betrag } : {}), ...(status ? { status } : {}), ...(faellig ? { faellig } : {}), ...(titel ? { titel } : {}) };
      aktion = `Rechnung ${kunde} aktualisiert: ${betrag != null ? eurW(betrag) : eurW(f.rechnungen[idx].betrag)}${status ? `, Status ${status}` : ''}${faellig ? `, fällig ${faellig}` : ''}`;
    } else {
      f.rechnungen.push({ id: `r-${Date.now().toString(36)}`, firmaId: firmaId(input.firma), kunde, titel: titel ?? 'Leistung', betrag: betrag ?? 0, status: status ?? 'geplant', ...(faellig ? { faellig } : {}) });
      aktion = `Neue Rechnung angelegt: ${kunde} ${betrag != null ? eurW(betrag) : 'ohne Betrag'} [${status ?? 'geplant'}]`;
    }
    return f;
  });
  return `Erfasst: ${aktion}. Sichtbar in der Finanzplanung.`;
}

async function erfasseZahlung(input: Record<string, unknown>): Promise<string> {
  const an = String(input.an ?? '').trim().slice(0, 120);
  const betrag = Number(input.betrag);
  if (!an || !isFinite(betrag)) return 'Fehlgeschlagen: an + betrag nötig.';
  const faellig = /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : undefined;
  await updateJson<{ zahlungen: { id: string; firmaId: string; an: string; titel: string; betrag: number; status: string; faellig?: string }[] }>('finanzplan', current => {
    const f = current ?? { zahlungen: [] };
    f.zahlungen = [...(f.zahlungen ?? []), { id: `z-${Date.now().toString(36)}`, firmaId: firmaId(input.firma), an, titel: String(input.titel ?? '').slice(0, 200), betrag: Math.max(0, Math.round(betrag)), status: 'offen', ...(faellig ? { faellig } : {}) }];
    return f;
  });
  return `Erfasst: Zahlung an ${an} über ${eurW(betrag)}${faellig ? `, fällig ${faellig}` : ''} — steht in der Prioritätenliste.`;
}

async function setzeMeilenstein(input: Record<string, unknown>): Promise<string> {
  const suche = String(input.titel ?? '').trim().toLowerCase();
  if (!suche) return 'Fehlgeschlagen: titel fehlt.';
  const fortschritt = isFinite(Number(input.fortschritt)) ? Math.max(0, Math.min(100, Math.round(Number(input.fortschritt)))) : undefined;
  const erledigt = input.erledigt === true;
  let ergebnis = '';
  await updateJson<{ meilensteine: { titel: string; fortschritt: number; erledigt: boolean; erledigtAm?: string }[] }>('meilensteine', current => {
    const f = current ?? { meilensteine: [] };
    const m = (f.meilensteine ?? []).find(x => x.titel.toLowerCase().includes(suche));
    if (!m) {
      ergebnis = `Kein Meilenstein passt zu „${input.titel}". Offene: ${(f.meilensteine ?? []).filter(x => !x.erledigt).slice(0, 5).map(x => x.titel).join(' · ')}`;
      return f;
    }
    if (erledigt) { m.erledigt = true; m.fortschritt = 100; m.erledigtAm = localDay(); ergebnis = `Meilenstein „${m.titel}" abgehakt ✓`; }
    else if (fortschritt != null) { m.fortschritt = fortschritt; ergebnis = `Meilenstein „${m.titel}" auf ${fortschritt}% gesetzt.`; }
    else ergebnis = `Nichts geändert — fortschritt oder erledigt angeben.`;
    return f;
  });
  return `Erfasst: ${ergebnis}`;
}

async function setzeFokus(input: Record<string, unknown>): Promise<string> {
  const h = String(input.horizont ?? '');
  if (!['tag', 'woche', 'monat', 'quartal', 'jahr'].includes(h)) return 'Fehlgeschlagen: horizont tag|woche|monat|quartal|jahr nötig.';
  const text = String(input.text ?? '').slice(0, 300);
  await updateJson<{ fokus?: Record<string, string> } & Record<string, unknown>>('ziele', current => {
    const f = current ?? {};
    return { ...f, fokus: { ...(f.fokus ?? {}), [h]: text } };
  });
  return `Erfasst: Fokus (${h}) = „${text}". Steht auf dem Dashboard und lenkt die Planung.`;
}

async function setzeKunde(input: Record<string, unknown>): Promise<string> {
  const name = String(input.name ?? '').trim().slice(0, 120);
  if (!name) return 'Fehlgeschlagen: name fehlt.';
  const status = ['aktiv', 'gespraech', 'ruht'].includes(String(input.status)) ? String(input.status) : undefined;
  const cashflow = isFinite(Number(input.cashflow)) && Number(input.cashflow) > 0 ? Math.round(Number(input.cashflow)) : undefined;
  const schritt = input.naechsterSchritt ? String(input.naechsterSchritt).slice(0, 300) : undefined;
  let aktion = '';
  await updateJson<{ kunden: { id: string; name: string; status: string; cashflow?: number; naechsterSchritt?: string }[] }>('kunden', current => {
    const f = current ?? { kunden: [] };
    f.kunden = f.kunden ?? [];
    const k = f.kunden.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (k) {
      if (status) k.status = status;
      if (cashflow != null) k.cashflow = cashflow;
      if (schritt) k.naechsterSchritt = schritt;
      aktion = `${k.name} aktualisiert${status ? ` (${status})` : ''}${cashflow != null ? `, ${eurW(cashflow)}/Monat` : ''}${schritt ? `, nächster Schritt: ${schritt}` : ''}`;
    } else {
      f.kunden.push({ id: `k-${Date.now().toString(36)}`, name, status: status ?? 'gespraech', ...(cashflow != null ? { cashflow } : {}), ...(schritt ? { naechsterSchritt: schritt } : {}) });
      aktion = `${name} als Kunde angelegt (${status ?? 'gespraech'})`;
    }
    return f;
  });
  return `Erfasst: ${aktion}. Sichtbar im CRM.`;
}

// Werkzeug-Register: Name → Gruppe (für die ⚙-Chips) + Ausführung.
const WERKZEUGE: Record<string, { gruppe: string; lauf: (input: Record<string, unknown>) => Promise<string> }> = {
  plan_block: { gruppe: 'planer', lauf: planBlock },
  setze_kontostand: { gruppe: 'finanzen', lauf: setzeKontostand },
  erfasse_rechnung: { gruppe: 'finanzen', lauf: erfasseRechnung },
  erfasse_zahlung: { gruppe: 'finanzen', lauf: erfasseZahlung },
  setze_meilenstein: { gruppe: 'meilensteine', lauf: setzeMeilenstein },
  setze_fokus: { gruppe: 'fokus', lauf: setzeFokus },
  setze_kunde: { gruppe: 'kunden', lauf: setzeKunde },
};

function systemPrompt(extra?: string, live?: string): string {
  return [
    'Du bist JARVIS — die zentrale Intelligenz und Chief of Staff von Kevins persönlichem Betriebssystem „MAKE OS". Kevin hat dich nach dem Vorbild benannt: ruhig, allgegenwärtig, einen Schritt voraus.',
    'ANREDE: Sprich Kevin mit „Sir" an (nicht mit Namen). Ruhig, souverän, ohne Anbiederung — der Ton einer zentralen Intelligenz, die den Überblick hat, nicht der eines Assistenten, der sich anbiedert. Kein Dauergesieze: „Sir" gehört an den Anfang oder wo es natürlich sitzt, nicht in jeden Satz. WICHTIG: Du DUZT Kevin trotzdem („du hast 3 Termine, Sir") — „Sir" ist die Anrede, kein Grund zum Siezen.',
    'Kevin Dieckmann ist Gründer der KEMARIS Innovation Group (IG); Produkt „POINCAP" (Capital Operations System); Holding „KD Management" (KDM).',
    '',
    'HALTUNG & TON: souverän, präzise, klar — institutional grade, kein Startup-Sprech. Antworte auf Deutsch.',
    'Wie ein exzellenter Stabschef: nenne die EINE wichtigste Sache, dann konkrete nächste Schritte, und biete aktiv an,',
    'zu delegieren (Malin = deine rechte Hand, Frank, Alex) oder eine Aufgabe anzulegen. Kein Geschwätz, keine Floskeln.',
    '',
    'AUSGABE-FORMAT (wichtig — Kevin liest das in einem OS, nicht als E-Mail):',
    '- Strukturiere klar: kurze fette Zwischenüberschriften (**so**), knappe Aufzählungen (- oder 1.), ein klarer nächster Schritt am Ende.',
    '- Keine Textwände. Lieber Stichpunkte als Absätze. Nutze **Fettung** für das Wichtigste.',
    '',
    'SPRACHREGELN (KEMARIS-Terminologie, verbindlich):',
    '- NIEMALS diese Wörter: Dashboard, Tool, Disruption, Unicorn, Game Changer, Reporting, „einfach zu bedienen".',
    '- Macht-Vokabular (wo passend): Souveränität, Alpha, Capital Readiness, Single Source of Truth, Institutional Grade, Edge.',
    '- Begriffe: statt „Shadow Cash" → „latentes Kapital / stilles Potenzial"; „die Steuerungslücke"; „Echtzeit-Finanzbild"; „Kapitalstau". POINCAP = „eine Plattform, zwei Nutzertypen". KSI beim ersten Mal kurz erklären.',
    '- MAKE.One (Ma+Ke) = Malin & Kevin privat, KEIN Unternehmen. Whoop-/Gesundheitsdaten nur im MAKE.One-Kontext, nie in Business-Briefings.',
    '',
    // Kein hartkodierter Kontext mehr: Zahlen, Index, Ziele, Team und
    // Meilensteine kommen ausschließlich aus dem Brain (live) — eine Wahrheit.
    live ? `LIVE-ZUSTAND aus dem Brain (deine echten Daten gerade jetzt — beziehe dich konkret darauf, erfinde nichts dazu):\n${live}` : '',
    '',
    'DEIN TEAM — diese Agenten laufen und du dirigierst sie:',
    agentRoster(),
    'SO ARBEITEST DU MIT DEINEN AGENTEN: Will Kevin ein ERGEBNIS (Recherche, Wochenlage, Zielbaum, Umsatz-Lage, Tagesform, Kalender-Analyse), dann führe den Agenten mit run_agent SELBST aus und fasse das Ergebnis zusammen — verweise nicht nur. Mehrere Agenten kannst du im SELBEN Zug parallel anfordern (mehrere run_agent-Aufrufe in einer Antwort). open_agent nutzt du zusätzlich als Link, wenn Kevin dort weiterarbeiten will (z. B. Blöcke bestätigen, Zahlen pflegen). Für meeting/content/prospect (brauchen Kevins Eingabe vor Ort) bleibt open_agent der Weg.',
    'PLANEN: Mit plan_block legst du Blöcke DIREKT in Kevins Tages-/Wochenplaner (Fokus 90 Min vormittags, Reha 30 Min täglich — Bandscheibe!, Pausen, Aufgaben, Blockzeiten). Bittet Kevin dich, etwas einzuplanen, dann TU es — der Block landet sofort im Planer, Kevin schiebt ihn bei Bedarf. Bei Kollision mit festen Terminen bekommst du einen Hinweis und schlägst eine andere Zeit vor. Zeitfenster 06:00–22:00, Raster 15 Minuten.',
    'ERFASSEN PER ZURUF: Nennt Kevin dir Daten, dann SCHREIBE sie sofort mit den Werkzeugen — keine Rückfragen bei eindeutigen Angaben, mehrere Erfassungen gern im selben Zug parallel: setze_kontostand (Kontostände), erfasse_rechnung (Ausgangsrechnungen: angelegt/gestellt/bezahlt), erfasse_zahlung (eigene Zahlungen → Prioritätenliste), setze_meilenstein (Fortschritt/abhaken), setze_fokus (Fokus je Horizont), setze_kunde (CRM: Status/Cashflow/nächster Schritt). Firmen: KD Ventures=kdv, Kevin Dieckmann Consulting=kdc (Standard: kdc). Bestätige danach KNAPP, was du geschrieben hast — keine Nacherzählung.',
    extra ? `\n- Zusatz vom Client: ${extra}` : '',
  ].filter(Boolean).join('\n');
}

export async function POST(req: Request) {
  let payload: { message?: string; context?: string; noTools?: boolean };
  try { payload = await req.json(); } catch { return NextResponse.json({ reply: 'Ich habe die Anfrage nicht verstanden.' }); }
  const message = (payload.message ?? '').trim();
  if (!message) return NextResponse.json({ reply: 'Sag mir, woran ich arbeiten soll.' });

  if (!hasAnthropicKey()) {
    return NextResponse.json({
      reply: 'Ich bin fast bereit — mir fehlt nur dein Anthropic-API-Key. Trag ihn als ANTHROPIC_API_KEY in die Datei .env.local ein und starte den Dev-Server neu, dann denke ich wirklich mit.',
      needsKey: true,
    });
  }

  const live = await liveContext();
  // Werkzeuge nur, wenn nicht ausdrücklich abgeschaltet (z.B. Tagesplan = reiner Text).
  const tools: unknown[] = [];
  if (!payload.noTools) {
    tools.push({
      name: 'create_task',
      description: 'Legt eine Aufgabe in Kevins MAKE OS an. Nutze das, wenn Kevin dich bittet, etwas als Aufgabe/To-do zu erfassen oder anzulegen, oder wenn aus dem Gespräch klar eine konkrete Aufgabe entsteht. Kevin bestätigt die Anlage danach selbst per Klick.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Kurzer, klarer Aufgabentitel (imperativ)' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Priorität' },
          why: { type: 'string', description: '1 kurzer Satz Kontext/Begründung (optional)' },
        },
        required: ['title'],
      },
    });
    tools.push({
      name: 'run_agent',
      description: 'Führt einen Fach-Agenten DIREKT aus und liefert dir sein Ergebnis zurück — nutze das, statt Kevin nur zu verweisen, wenn er ein Ergebnis will (Recherche, Wochenlage, Zielbaum, Umsatz-Lage, Tagesform, Kalender-Analyse). Read-only/Entwurf: nichts geht ohne Freigabe nach außen. Danach fasst du das Ergebnis für Kevin zusammen.',
      input_schema: {
        type: 'object',
        properties: {
          agent: { type: 'string', enum: ['research', 'board', 'okr', 'controlling', 'fokus', 'kalender'], description: 'Welcher Agent laufen soll' },
          auftrag: { type: 'string', description: 'Der konkrete Auftrag (bei research die Recherchefrage; sonst optional)' },
        },
        required: ['agent'],
      },
    });
    tools.push({
      name: 'plan_block',
      description: 'Legt einen Block DIREKT in Kevins Tages-/Wochenplaner. Nutze das, wenn Kevin dich bittet, etwas einzuplanen („plane mir morgen 90 Minuten Fokus", „leg die Reha auf 18 Uhr"). Der Block erscheint sofort im Planer und ist frei verschiebbar. Kollisionen mit festen Terminen werden serverseitig verhindert — bei Kollision bekommst du einen Hinweis und schlägst eine andere Zeit vor.',
      input_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Tag YYYY-MM-DD (heute oder später)' },
          startMin: { type: 'number', description: 'Start in Minuten ab 00:00 (540 = 09:00), Raster 15, Fenster 360–1305' },
          dauerMin: { type: 'number', description: 'Dauer in Minuten (15–240)' },
          titel: { type: 'string', description: 'Kurzer Block-Titel' },
          art: { type: 'string', enum: ['fokus', 'reha', 'routine', 'pause', 'aufgabe', 'block'], description: 'Art des Blocks' },
        },
        required: ['date', 'startMin', 'dauerMin', 'titel'],
      },
    });
    // ── Erfassen per Zuruf: Kevin diktiert, Jarvis schreibt in die Stores ──
    tools.push(
      {
        name: 'setze_kontostand',
        description: 'Setzt den Kontostand einer Firma in der Finanzplanung. Nutze das sofort, wenn Kevin einen Kontostand nennt („Kontostand KDC 18.500").',
        input_schema: { type: 'object', properties: {
          firma: { type: 'string', description: 'kdv (KD Ventures) oder kdc (Kevin Dieckmann Consulting) — bei Unklarheit kdc' },
          betrag: { type: 'number', description: 'Kontostand in Euro' },
        }, required: ['betrag'] },
      },
      {
        name: 'erfasse_rechnung',
        description: 'Legt eine Ausgangsrechnung an oder aktualisiert die bestehende des Kunden (Betrag/Status/Fälligkeit). Nutze das, wenn Kevin sagt „Rechnung X über Y € gestellt/bezahlt/geplant".',
        input_schema: { type: 'object', properties: {
          kunde: { type: 'string' },
          titel: { type: 'string', description: 'Leistung (optional)' },
          betrag: { type: 'number' },
          status: { type: 'string', enum: ['geplant', 'gestellt', 'bezahlt'] },
          faellig: { type: 'string', description: 'YYYY-MM-DD (optional)' },
          firma: { type: 'string', description: 'kdv|kdc (optional, Standard kdc)' },
        }, required: ['kunde'] },
      },
      {
        name: 'erfasse_zahlung',
        description: 'Trägt eine eigene zu zahlende Rechnung in die Zahlungs-Prioritätenliste ein („wir müssen X 2.000 € zahlen bis …").',
        input_schema: { type: 'object', properties: {
          an: { type: 'string', description: 'An wen' },
          titel: { type: 'string' },
          betrag: { type: 'number' },
          faellig: { type: 'string', description: 'YYYY-MM-DD (optional)' },
        }, required: ['an', 'betrag'] },
      },
      {
        name: 'setze_meilenstein',
        description: 'Setzt Fortschritt oder erledigt an einem Meilenstein („setz F&F auf 80%", „Infiltration abhaken"). titel = Teil des Meilenstein-Namens.',
        input_schema: { type: 'object', properties: {
          titel: { type: 'string' },
          fortschritt: { type: 'number', description: '0–100' },
          erledigt: { type: 'boolean' },
        }, required: ['titel'] },
      },
      {
        name: 'setze_fokus',
        description: 'Setzt den Fokus-Satz für einen Horizont („Fokus der Woche: …").',
        input_schema: { type: 'object', properties: {
          horizont: { type: 'string', enum: ['tag', 'woche', 'monat', 'quartal', 'jahr'] },
          text: { type: 'string' },
        }, required: ['horizont', 'text'] },
      },
      {
        name: 'setze_kunde',
        description: 'Aktualisiert oder erfasst einen Kunden im CRM (Status, Cashflow €/Monat, nächster Schritt).',
        input_schema: { type: 'object', properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['aktiv', 'gespraech', 'ruht'] },
          cashflow: { type: 'number', description: '€/Monat' },
          naechsterSchritt: { type: 'string' },
        }, required: ['name'] },
      },
    );
    if (LIVE_AGENTS.length) tools.push({
      name: 'open_agent',
      description: 'Verweist Kevin an den zuständigen Fach-Agenten in MAKE OS. Nutze das, wenn sein Anliegen klar in die Zuständigkeit eines Agenten fällt (Recherche, Umsatz/Runway, Zielbaum, Wochenlage, Meeting-Notizen, Text/Post, Zielliste, Kalender schützen). Beantworte die Frage trotzdem selbst — der Verweis ergänzt nur.',
      input_schema: {
        type: 'object',
        properties: {
          agent: { type: 'string', enum: LIVE_AGENTS.map(a => a.id), description: 'Die id des passenden Agenten' },
          why: { type: 'string', description: '1 kurzer Satz, warum dieser Agent hier hilft' },
        },
        required: ['agent'],
      },
    });
  }

  try {
    // Tool-Use-Schleife: Jarvis darf Agenten ausführen (run_agent), bekommt die
    // Ergebnisse zurück und antwortet erst dann. Max 3 Runden, max 4 Läufe.
    const origin = new URL(req.url).origin;
    const msgs: unknown[] = [{ role: 'user', content: message }];
    interface Block { type: string; id?: string; name?: string; text?: string; input?: Record<string, unknown> }
    let blocks: Block[] = [];
    let reply = '';
    const ran: { agent: string; ok: boolean }[] = [];
    let laufBudget = 4;
    let werkBudget = 10;

    for (let runde = 0; runde < 3; runde++) {
      const r = await askText({ system: systemPrompt(payload.context, live), user: message, messages: msgs, maxTokens: 4000, tools, timeoutMs: 180_000 });
      if (!r.ok) {
        return NextResponse.json(
          { reply: `Anthropic hat abgelehnt (${r.status || 'offline'}). Prüf den Key/das Modell.`, error: r.error?.slice(0, 300) },
          { status: 200 },
        );
      }
      const content: Block[] = Array.isArray((r.raw as { content?: Block[] })?.content) ? (r.raw as { content: Block[] }).content : [];
      blocks = blocks.concat(content);
      reply = [reply, r.text].filter(Boolean).join('\n\n');

      // Ausführbar in der Schleife: Agenten-Läufe UND alle Erfassungs-Werkzeuge.
      const laeufe = content.filter(b => b.type === 'tool_use' && (b.name === 'run_agent' || WERKZEUGE[b.name ?? '']));
      if (!laeufe.length || r.stopReason !== 'tool_use') break;

      // Assistant-Zug + Werkzeug-Ergebnisse zurückreichen
      msgs.push({ role: 'assistant', content });
      // PARALLEL ausführen — zwei Agenten nacheinander sprengen sonst das
      // Zeitfenster (Board + OKR je ~30s). Budget wird VOR dem Start gezogen.
      const zulaessig = laeufe.map(l => {
        const werk = WERKZEUGE[l.name ?? ''];
        if (werk) {
          const gueltig = werkBudget-- > 0;
          return { l, agentId: werk.gruppe, gueltig, lauf: () => werk.lauf(l.input ?? {}) };
        }
        const agentId = String(l.input?.agent ?? '');
        const gueltig = (AUSFUEHRBAR as readonly string[]).includes(agentId) && laufBudget-- > 0;
        return { l, agentId, gueltig, lauf: () => runAgent(agentId as Ausfuehrbar, String(l.input?.auftrag ?? ''), origin) };
      });
      const outs = await Promise.all(zulaessig.map(z =>
        z.gueltig ? z.lauf() : Promise.resolve('Nicht ausgeführt (unbekannter Agent oder Lauf-Budget erschöpft).')
      ));
      const results: unknown[] = zulaessig.map((z, zi) => {
        ran.push({ agent: z.agentId, ok: z.gueltig && !/fehlgeschlagen|nicht erreichbar|Kollision|Nicht ausgeführt|Kein Meilenstein/i.test(outs[zi]) });
        return { type: 'tool_result', tool_use_id: z.l.id, content: outs[zi] };
      });
      // open_agent/create_task in derselben Runde: leere Ergebnisse zurückgeben,
      // damit die API-Konversation gültig bleibt.
      for (const b of content.filter(x => x.type === 'tool_use' && x.name !== 'run_agent' && !WERKZEUGE[x.name ?? ''])) {
        results.push({ type: 'tool_result', tool_use_id: b.id, content: 'Notiert — wird Kevin als Vorschlag angezeigt.' });
      }
      msgs.push({ role: 'user', content: results });
    }

    // Vorschläge aus ALLEN Runden einsammeln (Kevin bestätigt im UI).
    const actions = blocks
      .filter(b => b.type === 'tool_use' && b.name === 'create_task')
      .map(b => ({
        type: 'create_task' as const,
        title: String(b.input?.title ?? 'Aufgabe'),
        priority: String(b.input?.priority ?? 'medium'),
        why: String(b.input?.why ?? ''),
      }));
    const handoffs = blocks
      .filter(b => b.type === 'tool_use' && b.name === 'open_agent')
      .map(b => {
        const a = LIVE_AGENTS.find(x => x.id === String(b.input?.agent ?? ''));
        return a ? { agent: a.id, name: a.name, href: a.href, why: String(b.input?.why ?? '') } : null;
      })
      .filter(Boolean);

    const fallback = actions.length || handoffs.length ? 'Ich habe etwas für dich vorbereitet:' : 'Ich habe gerade keine Antwort erzeugt — frag mich nochmal.';
    return NextResponse.json({ reply: reply || fallback, actions, handoffs, ran });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ reply: 'Ich konnte Anthropic nicht erreichen (offline?). Versuch es gleich nochmal.', error: msg }, { status: 200 });
  }
}
