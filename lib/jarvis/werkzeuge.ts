// ─── MAKE OS — Jarvis' Werkzeuge (Implementierungen) ────────────────────────
// Bis 07.09. steckten diese Funktionen in app/api/kimmi/route.ts. Sie stehen
// jetzt für sich, weil das Register (register.ts) sie mit Risiko-Stufe,
// Trockenlauf und Protokoll umgibt — und weil eine 711-Zeilen-Route, in der
// Werkzeug, Schleife und Ausführung durcheinanderliegen, nicht prüfbar ist.
//
// Diese Datei enthält NUR die Wirkung. Was ein Werkzeug darf, entscheidet
// register.ts; ob es ausgeführt oder in den Stapel gelegt wird, entscheidet
// die Route.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import type { FaktArt } from './gedaechtnis';

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
/** Privates gehört seit 24.09. in die Haushaltsfinanzen, nicht in den Finanzplan der Firmen. */
const istPrivatAngabe = (rein: unknown) => /privat|haushalt|malin|n26/i.test(String(rein ?? ''));
const PRIVAT_HINWEIS = 'Nicht erfasst: Das ist privat. Private Zahlungen und Rechnungen gehören in die Haushaltsfinanzen (Zahlen → Privat) — dafür gibt es eigene Werkzeuge.';

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
  if (istPrivatAngabe(input.firma)) return PRIVAT_HINWEIS;
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
  if (istPrivatAngabe(input.firma)) return PRIVAT_HINWEIS;
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

// ── Gesundheit (23.09.): die Griffe, die ein Satz auslöst ───────────────────
// Kevin antwortet abends auf Telegram mit „Reha gemacht, Juckreiz 4, sauber,
// dankbar für den Anruf mit Malin" — und Jarvis schreibt vier Bestände. Jedes
// Werkzeug ist frei: es erfasst nur, was die Person selbst gesagt hat.

const HEUTE_ODER = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : localDay());

async function hakeRoutine(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { routineAusZuruf } = await import('@/lib/gesundheit/eintraege');
  const { speicherFuer } = await import('./raum');
  const wer = person ?? 'kevin';
  const f = await loadJson<{ routinen?: { id: string; label: string; aktiv: boolean }[] }>('routinen');
  const alle = (f?.routinen ?? []).filter(r => r.aktiv);
  const zurufe = Array.isArray(input.routinen) ? (input.routinen as unknown[]).map(String) : [String(input.routine ?? '')];
  const ids = zurufe.map(z => routineAusZuruf(z, alle)).filter((x): x is string => !!x);
  if (!ids.length) return `Keine Routine passt zu „${zurufe.join(', ')}". Es gibt: ${alle.map(r => r.label).join(' · ')}`;
  const erledigt = input.erledigt !== false;
  const datum = HEUTE_ODER(input.datum);
  await updateJson<Record<string, string[]>>(speicherFuer('health-log', wer), current => {
    const log = current ?? {};
    const tag = new Set(log[datum] ?? []);
    for (const id of ids) { if (erledigt) tag.add(id); else tag.delete(id); }
    return { ...log, [datum]: Array.from(tag) };
  });
  const namen = ids.map(id => alle.find(r => r.id === id)?.label ?? id);
  return `${erledigt ? 'Abgehakt' : 'Zurückgenommen'}: ${namen.join(', ')} (${datum === localDay() ? 'heute' : datum}).`;
}

async function hautEintrag(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { saeubereHaut, hautTrend } = await import('@/lib/gesundheit/eintraege');
  const { speicherFuer } = await import('./raum');
  const e = saeubereHaut(input, new Date().toISOString());
  if (!e) return 'Fehlgeschlagen: juckreiz (0–10) fehlt.';
  const datum = HEUTE_ODER(input.datum);
  const log = await updateJson<Record<string, typeof e>>(speicherFuer('haut', person ?? 'kevin'), current => ({ ...(current ?? {}), [datum]: e }));
  const t = hautTrend(log, localDay());
  const trend = t.richtung === 'besser' ? ' Die Woche ist besser als die davor.' : t.richtung === 'schlechter' ? ' Die Woche ist schlechter als die davor.' : '';
  return `Haut notiert: Juckreiz ${e.juckreiz}/10${e.schub ? ', Schub' : ''}${e.ausloeser ? `, Auslöser ${e.ausloeser}` : ''}.${trend}`;
}

async function journalEintrag(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { speicherFuer } = await import('./raum');
  const datum = HEUTE_ODER(input.datum);
  const t = (v: unknown, n = 800) => { const s = String(v ?? '').trim().slice(0, n); return s || undefined; };
  const z = (v: unknown) => { const n = Number(v); return isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : undefined; };
  const neu = {
    ...(t(input.gut) ? { gut: t(input.gut) } : {}),
    ...(t(input.dankbar) ? { dankbar: t(input.dankbar) } : {}),
    ...(t(input.hart) ? { hart: t(input.hart) } : {}),
    ...(t(input.text, 2000) ? { text: t(input.text, 2000) } : {}),
    ...(z(input.stimmung) ? { mood: z(input.stimmung) } : {}),
    ...(z(input.energie) ? { energy: z(input.energie) } : {}),
    ...(z(input.stress) ? { stress: z(input.stress) } : {}),
  };
  if (!Object.keys(neu).length) return 'Fehlgeschlagen: nichts zum Eintragen (gut, dankbar, hart, text, stimmung, energie, stress).';
  await updateJson<Record<string, Record<string, unknown>>>(speicherFuer('journal', person ?? 'kevin'), current => {
    const log = current ?? {};
    return { ...log, [datum]: { ...(log[datum] ?? {}), ...neu, at: new Date().toISOString() } };
  });
  return `Journal ${datum === localDay() ? 'heute' : datum}: ${Object.keys(neu).join(', ')} festgehalten.`;
}

async function streakEintrag(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { saeubereStreak, streakStand } = await import('@/lib/gesundheit/eintraege');
  const { speicherFuer } = await import('./raum');
  const e = saeubereStreak({ ...input, craving: input.verlangen ?? input.craving }, new Date().toISOString());
  if (!e) return 'Fehlgeschlagen: sauber (true/false) fehlt.';
  const datum = HEUTE_ODER(input.datum);
  const log = await updateJson<Record<string, typeof e>>(speicherFuer('streak', person ?? 'kevin'), current => ({ ...(current ?? {}), [datum]: e }));
  const st = streakStand(log, localDay());
  if (!e.sauber) return 'Notiert. Ein Datum, kein Urteil — morgen zählt wieder von vorn.';
  return `Sauber seit ${st.sauberTage} Tag${st.sauberTage === 1 ? '' : 'en'}${typeof e.craving === 'number' ? `, Verlangen ${e.craving}/10` : ''}.`;
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

/**
 * Postfach lesen — Kevins Ansage: „Wenn ich ihm sage, hol dir die Infos, soll
 * er den Agenten wirklich angreifen und die Information rausholen."
 *
 * Vorher hat Jarvis auf den Inbox-Agenten verwiesen. Jetzt liest er selbst:
 * erst der Kopf (billig), Text nur bei Treffern. Read-only — es wird nie
 * geantwortet, verschoben oder gelöscht.
 */
async function liesPostfach(input: Record<string, unknown>, origin: string): Promise<string> {
  const suche = String(input.suche ?? '').trim().slice(0, 60);
  const anzahl = Math.min(5, Math.max(1, Number(input.anzahl) || 1));
  const H = { 'x-make-key': process.env.MAKE_OS_KEY ?? '' };

  try {
    if (!suche) {
      // Ohne Suchbegriff reicht die Übersicht — Betreffzeilen, kein Text.
      const r = await fetch(`${origin}/api/apple-mail`, { headers: H, signal: AbortSignal.timeout(60_000) });
      const d = await r.json();
      if (!Array.isArray(d)) return `Postfach nicht lesbar: ${String(d?.error ?? 'unbekannt').slice(0, 160)}`;
      const zeilen = d.slice(0, 20).map((m: { sender?: string; subject?: string; receivedAt?: string }) =>
        `• ${String(m.sender ?? '').replace(/<.*>/, '').trim().slice(0, 40)} — ${String(m.subject ?? '').slice(0, 80)}`).join('\n');
      return `POSTFACH (neueste ${Math.min(20, d.length)} von ${d.length}):\n${zeilen}`;
    }

    const r = await fetch(
      `${origin}/api/apple-mail/inhalt?suche=${encodeURIComponent(suche)}&anzahl=${anzahl}&laenge=3000`,
      { headers: H, signal: AbortSignal.timeout(100_000) },
    );
    const d = await r.json();
    if (!d.ok) return `Postfach nicht lesbar: ${String(d.error ?? '').slice(0, 200)}`;
    if (!d.gefunden) return `Keine Mail zu „${suche}" unter den ${d.durchsucht} neuesten Nachrichten.`;
    return `MAIL-TREFFER zu „${suche}" (${d.gefunden}):\n` + d.mails
      .map((m: { sender: string; betreff: string; datum: string; text: string }) =>
        `VON ${m.sender}\nBETREFF ${m.betreff}\nDATUM ${m.datum}\n---\n${m.text.slice(0, 2500)}`)
      .join('\n\n═══\n\n');
  } catch (err) {
    return `Postfach nicht erreichbar: ${err instanceof Error ? err.message.slice(0, 160) : 'Fehler'}`;
  }
}

/**
 * Tagesform eintragen — damit Jarvis Werte, die er gerade gelesen oder von
 * Kevin gehört hat, direkt ablegen kann, statt ihn auf /os/gesundheit zu
 * schicken. Nur was übergeben wurde, wird geschrieben.
 */
async function setzeVitalwerte(input: Record<string, unknown>, origin: string): Promise<string> {
  const zahl = (v: unknown, min: number, max: number) => {
    const n = Number(v);
    return isFinite(n) && n >= min && n <= max ? n : undefined;
  };
  const vitals = {
    rec: zahl(input.recovery, 0, 100),
    sleep: zahl(input.schlaf, 0, 24),
    hrv: zahl(input.hrv, 0, 300),
    rhr: zahl(input.ruhepuls, 20, 200),
    ...(input.notiz ? { note: String(input.notiz).slice(0, 400) } : {}),
  };
  const gesetzt = Object.entries(vitals).filter(([, v]) => v !== undefined);
  if (!gesetzt.length) return 'Fehlgeschlagen: keine gültigen Werte übergeben (recovery 0–100, schlaf 0–24, hrv, ruhepuls).';

  const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(input.datum ?? '')) ? String(input.datum) : localDay();
  try {
    const r = await fetch(`${origin}/api/state/vitals`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '' },
      body: JSON.stringify({ date: datum, vitals }),
      signal: AbortSignal.timeout(30_000),
    });
    const d = await r.json();
    if (!d.ok) return `Nicht gespeichert: ${String(d.error ?? '').slice(0, 200)}`;
    const text = [
      vitals.rec != null ? `Recovery ${vitals.rec}%` : null,
      vitals.sleep != null ? `Schlaf ${vitals.sleep} h` : null,
      vitals.hrv != null ? `HRV ${vitals.hrv}` : null,
      vitals.rhr != null ? `Ruhepuls ${vitals.rhr}` : null,
    ].filter(Boolean).join(' · ');
    return `Eingetragen für ${datum}: ${text}. Steht jetzt im Gesundheits-Cockpit und in jeder Tagesform-Rechnung.`;
  } catch (err) {
    return `Nicht gespeichert: ${err instanceof Error ? err.message.slice(0, 160) : 'Fehler'}`;
  }
}

// Werkzeug-Register: Name → Gruppe (für die ⚙-Chips) + Ausführung.
/** Jahresziele und Startmonat setzen — die Grundlage jeder Controlling-Zahl. */
async function setzeZiele(input: Record<string, unknown>): Promise<string> {
  const zielUmsatz = isFinite(Number(input.zielUmsatz)) ? Math.max(0, Math.round(Number(input.zielUmsatz))) : undefined;
  const zielGewinn = isFinite(Number(input.zielGewinn)) ? Math.max(0, Math.round(Number(input.zielGewinn))) : undefined;
  const cash = isFinite(Number(input.cash)) ? Math.round(Number(input.cash)) : undefined;
  const MONATE = ['januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
  let startMonat: number | undefined;
  if (input.startMonat != null) {
    const roh = String(input.startMonat).toLowerCase().trim();
    const alsZahl = Number(roh);
    if (isFinite(alsZahl) && alsZahl >= 0 && alsZahl <= 11) startMonat = Math.round(alsZahl);
    else {
      const i = MONATE.findIndex(m => roh.startsWith(m.slice(0, 3)));
      // „maerz" liegt doppelt in der Liste — Index korrigieren.
      if (i >= 0) startMonat = i > 3 ? i - 1 : i;
    }
  }
  if (zielUmsatz == null && zielGewinn == null && cash == null && startMonat == null) {
    return 'Fehlgeschlagen: nichts zu setzen (zielUmsatz, zielGewinn, cash oder startMonat angeben).';
  }
  const teile: string[] = [];
  await updateJson<{ jahr: number; zielUmsatz: number; zielGewinn: number; cash: number; months: unknown[]; startMonat?: number }>('finance', current => {
    const f = current ?? { jahr: new Date().getFullYear(), zielUmsatz: 0, zielGewinn: 0, cash: 0, months: [] };
    if (zielUmsatz != null) { f.zielUmsatz = zielUmsatz; teile.push(`Ziel-Umsatz ${eurW(zielUmsatz)}`); }
    if (zielGewinn != null) { f.zielGewinn = zielGewinn; teile.push(`Ziel-Gewinn ${eurW(zielGewinn)}`); }
    if (cash != null) { f.cash = cash; teile.push(`Cash ${eurW(cash)}`); }
    if (startMonat != null) { f.startMonat = startMonat; teile.push(`Start ab ${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][startMonat]}`); }
    return f;
  });
  return `Erfasst: ${teile.join(' · ')}. Sichtbar im Controlling — Fortschritt und nötige Run-Rate rechnen sofort neu.`;
}

/** Wiederkehrende Kosten oder Einnahmen für die Liquiditäts-Planung. */
async function erfassePlanposten(input: Record<string, unknown>): Promise<string> {
  if (istPrivatAngabe(input.firma) || String(input.kategorie ?? '') === 'privat') return PRIVAT_HINWEIS;
  const titel = String(input.titel ?? '').trim().slice(0, 160);
  const betrag = Math.round(Number(input.betrag));
  if (!titel || !isFinite(betrag) || betrag === 0) return 'Fehlgeschlagen: titel + betrag nötig (negativ = Ausgabe).';
  const RHY = ['einmalig', 'monatlich', 'quartal', 'jaehrlich'];
  const rhythmus = RHY.includes(String(input.rhythmus)) ? String(input.rhythmus) : 'monatlich';
  const ab = /^\d{4}-\d{2}-\d{2}$/.test(String(input.ab ?? '')) ? String(input.ab) : new Date().toISOString().slice(0, 10);
  const kategorie = input.kategorie ? String(input.kategorie).slice(0, 40) : undefined;
  const firmaId = ['kdv', 'kdc', 'kemaris'].includes(String(input.firma)) ? String(input.firma) : undefined;
  const sicher = input.sicher !== false;

  let aktion = '';
  await updateJson<{ posten: { id: string; titel: string; betrag: number; rhythmus: string; ab: string; sicher: boolean; kategorie?: string; firmaId?: string }[] }>('liquiplan', current => {
    const f = current ?? { posten: [] };
    f.posten = f.posten ?? [];
    const idx = f.posten.findIndex(p => p.titel.toLowerCase() === titel.toLowerCase());
    if (idx >= 0) {
      f.posten[idx] = { ...f.posten[idx], betrag, rhythmus, ab, sicher, ...(kategorie ? { kategorie } : {}), ...(firmaId ? { firmaId } : {}) };
      aktion = `${titel} aktualisiert`;
    } else {
      f.posten.push({ id: `lp-${Date.now().toString(36)}`, titel, betrag, rhythmus, ab, sicher, ...(kategorie ? { kategorie } : {}), ...(firmaId ? { firmaId } : {}) });
      aktion = `${titel} angelegt`;
    }
    return f;
  });
  const wie = rhythmus === 'einmalig' ? 'einmalig' : rhythmus === 'monatlich' ? 'monatlich' : rhythmus === 'quartal' ? 'je Quartal' : 'jährlich';
  return `Erfasst: ${aktion} — ${betrag < 0 ? '−' : '+'}${eurW(Math.abs(betrag))} ${wie} ab ${ab}. Rechnet sofort in der Liquiditäts-Planung mit.`;
}

/**
 * Aufgabe anlegen — seit 07.09. ein echtes Werkzeug statt eines Knopfes.
 *
 * Vorher schlug Jarvis eine Aufgabe vor und Kevin musste sie per Klick
 * bestätigen. Kevins Festlegung vom 06.09.: Aufgaben anlegen ist freie Hand.
 * Die Route hat eine eigene Dublettensperre — dieselbe Aufgabe zweimal
 * anzulegen ist also auch dann ausgeschlossen, wenn zwei Wege sie erzeugen.
 */
async function erstelleAufgabe(input: Record<string, unknown>, origin: string): Promise<string> {
  const title = String(input.title ?? '').trim().slice(0, 300);
  if (!title) return 'Fehlgeschlagen: title fehlt.';
  const PRIOS = ['low', 'medium', 'high', 'critical'];
  const WER = ['kevin', 'malin', 'both'];
  const body = {
    title,
    description: input.why ? String(input.why).slice(0, 800) : undefined,
    priority: PRIOS.includes(String(input.priority)) ? String(input.priority) : 'medium',
    owner: WER.includes(String(input.wer)) ? String(input.wer) : undefined,
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : undefined,
  };
  try {
    const r = await fetch(`${origin}/api/tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const d = await r.json();
    if (!d.ok) return `Aufgabe nicht angelegt: ${String(d.error ?? '').slice(0, 160)}`;
    if (d.duplikat) return `Gab es schon: „${title}" steht bereits offen im Board — keine zweite angelegt.`;
    return `Angelegt: „${title}"${body.priority !== 'medium' ? ` (${body.priority})` : ''}${body.dueDate ? `, fällig ${body.dueDate}` : ''}. Steht im Board.`;
  } catch (err) {
    return `Aufgabe nicht angelegt: ${err instanceof Error ? err.message.slice(0, 140) : 'Fehler'}`;
  }
}

/**
 * Mehrere Agenten auf einmal losschicken — Kevins Bedingung vom 06.09.
 *
 * Der Unterschied zu run_agent: run_agent läuft IN dem Aufruf, auf den Kevin
 * wartet (drei Runden, vier Läufe, dann ist das Zeitfenster zu). Das hier legt
 * die Aufträge in die Warteschlange; der Arbeiter nimmt sie sich und lässt sie
 * nebeneinander laufen, so viele wie die Maschine trägt. Kevin bekommt sofort
 * eine Antwort und sieht die Ergebnisse einlaufen.
 */
async function starteAuftraege(input: Record<string, unknown>, origin: string): Promise<string> {
  const roh = Array.isArray(input.auftraege) ? input.auftraege : [];
  const auftraege = roh
    .map(x => (x && typeof x === 'object' ? x as Record<string, unknown> : null))
    .filter(Boolean)
    .map(x => ({
      art: 'agent' as const,
      name: String(x!.agent ?? '').trim(),
      auftrag: x!.auftrag ? String(x!.auftrag).slice(0, 4000) : undefined,
      anlass: input.anlass ? String(input.anlass).slice(0, 200) : undefined,
    }))
    .filter(a => a.name)
    .slice(0, 20);
  if (!auftraege.length) return 'Fehlgeschlagen: keine Agenten angegeben.';

  try {
    const r = await fetch(`${origin}/api/jarvis/auftraege`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '' },
      body: JSON.stringify({ auftraege }),
      signal: AbortSignal.timeout(20_000),
    });
    const d = await r.json();
    if (!d.ok) return `Aufträge nicht eingereiht: ${String(d.error ?? '').slice(0, 160)}`;
    const namen = auftraege.map(a => a.name).join(', ');
    return `${d.angelegt} Aufträge laufen jetzt im Hintergrund (${namen})`
      + `${d.schonDa ? `, ${d.schonDa} liefen schon` : ''}. `
      + 'Sag Kevin, dass sie parallel laufen und die Ergebnisse unter /os/stapel einlaufen — er muss nicht warten.';
  } catch (err) {
    return `Warteschlange nicht erreichbar: ${err instanceof Error ? err.message.slice(0, 140) : 'Fehler'}`;
  }
}

/**
 * Sich etwas merken. Kevins Entscheidung vom 06.09.: sofort, nicht auf
 * Nachfrage — dafür sichtbar in einer Liste, aus der er rauswerfen kann.
 */
async function faktMerken(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  const ARTEN = ['person', 'firma', 'vorliebe', 'entscheidung', 'termin', 'zahl', 'sonstiges'];
  const thema = String(input.thema ?? '').trim().slice(0, 120);
  const satz = String(input.satz ?? '').trim().slice(0, 500);
  if (!thema || !satz) return 'Fehlgeschlagen: thema und satz nötig.';
  const { merke } = await import('./gedaechtnis');
  const GEMEINSAM = ['gemeinsam', 'beide', 'both'];
  const { neu } = await merke({
    art: (ARTEN.includes(String(input.art)) ? String(input.art) : 'sonstiges') as FaktArt,
    raum: GEMEINSAM.includes(String(input.raum ?? '')) ? 'gemeinsam' : (person ?? 'kevin'),
    thema, satz,
    woher: input.woher ? String(input.woher).slice(0, 200) : undefined,
    bis: /^\d{4}-\d{2}-\d{2}$/.test(String(input.bis ?? '')) ? String(input.bis) : undefined,
  });
  return neu
    ? `Gemerkt: ${thema} — ${satz}`
    : `Wusste ich schon: ${thema} — ${satz} (nicht doppelt abgelegt).`;
}

/** Im eigenen Gedächtnis nachsehen, bevor geraten wird. */
async function fragGedaechtnis(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  const { lies } = await import('./gedaechtnis');
  const thema = input.thema ? String(input.thema).slice(0, 120) : undefined;
  // Nur der eigene und der gemeinsame Raum — aus dem der anderen Person nichts.
  const treffer = await lies({ thema, anzahl: 30, raum: person ?? 'kevin' });
  if (!treffer.length) return thema ? `Nichts gemerkt zu „${thema}".` : 'Das Gedächtnis ist noch leer.';
  return `GEDÄCHTNIS (${treffer.length}):\n` + treffer.map(f => `• [${f.art}] ${f.thema}: ${f.satz}${f.woher ? ` (${f.woher})` : ''}`).join('\n');
}

// ── Das Gehirn: Kevins Notizen (Baustein 4b) ──────────────────────────────

// Die Sicht: im Gespräch die Person, für die Jarvis arbeitet; ohne Person
// (Hintergrundlauf) ein Agent — und Agenten bekommen nie Privates (Vertraulichkeitsregeln §1).
const sichtFuer = (person?: string) => (person ? { person } : { person: 'kevin', agent: true });

async function sucheWissen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const frage = String(input.frage ?? '').trim().slice(0, 300);
  if (!frage) return 'Fehlgeschlagen: frage fehlt.';
  const { suche } = await import('./vault');
  const { treffer, durchsucht } = await suche(frage, Math.min(8, Math.max(1, Number(input.anzahl) || 5)), sichtFuer(person));
  if (!treffer.length) return `Nichts gefunden zu „${frage}" (${durchsucht} Notizen durchsucht).`;
  return `WISSEN — ${treffer.length} von ${durchsucht} Notizen:\n\n` + treffer.map(t =>
    `QUELLE ${t.id}\nTITEL ${t.titel} · ${t.bereich}${t.scope === 'privat' ? ' · 🔒 PRIVAT' : ''}${t.stand ? ` · Stand ${t.stand}` : ''}${t.ueberschriften.length ? `\nABSCHNITTE ${t.ueberschriften.slice(0, 4).join(' · ')}` : ''}\n${t.ausschnitt}`,
  ).join('\n\n───\n\n')
  + '\n\nNenne die Quelle, aus der du zitierst. 🔒 PRIVAT heißt: nur im Gespräch mit der Person selbst verwenden — nie in Mails, Entwürfe, Briefings oder Texte nach außen.';
}

async function liesNotiz(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const id = String(input.notiz ?? '').trim();
  if (!id) return 'Fehlgeschlagen: notiz fehlt.';
  const { notiz } = await import('./vault');
  const d = await notiz(id, 12_000, sichtFuer(person));
  if (!d.ok) return `Notiz nicht lesbar: ${d.fehler}`;
  return `NOTIZ ${d.pfad} — ${d.titel}${d.scope === 'privat' ? ' · 🔒 PRIVAT' : ''}${d.stand ? ` · Stand ${d.stand}` : ''}${d.oben ? `\nGÜLTIGER STAND (oberster 🔴-Block):\n${d.oben}\n───` : ''}\n\n${d.text}`;
}

async function notizAnlegen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { legeAn } = await import('./vault');
  const d = await legeAn(String(input.titel ?? ''), String(input.text ?? ''), { person, scope: input.privat === true ? 'privat' : 'intern' });
  return d.ok ? `Protokoll angelegt: ${d.pfad} — steht in deinem Obsidian-Brain.` : `Nicht angelegt: ${d.fehler}`;
}

async function notizErgaenzen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { haengeAn } = await import('./vault');
  const d = await haengeAn(String(input.notiz ?? ''), String(input.text ?? ''), { titel: input.titel ? String(input.titel) : undefined, person });
  return d.ok ? `Ergänzt: ${d.pfad} — als datierter Block angehängt, nichts überschrieben.` : `Nicht ergänzt: ${d.fehler}`;
}


// ── CRM: Kontakte finden, notieren, ansprechen ──────────────────────────────
// Kevins Ansage vom 18.09.: „damit wir Kunden ansprechen können." Drei
// Werkzeuge, alle frei — sie schaffen Struktur und Entwürfe. Es gibt bewusst
// KEIN Werkzeug zum Versenden: das bleibt eiserne Regel 3.

async function ladeKontakte() {
  const { loadJson } = await import('@/lib/store/local-db');
  const f = await loadJson<{ kontakte: import('@/lib/make-one/crm').Kontakt[] }>('kontakte');
  return f?.kontakte ?? [];
}

async function kontaktFinden(hinweis: string) {
  const { findeKontakte } = await import('@/lib/make-one/crm');
  const alle = await ladeKontakte();
  const direkt = alle.find(k => k.id === hinweis);
  if (direkt) return { treffer: direkt, alle };
  const l = findeKontakte(alle, hinweis, 3);
  return { treffer: l[0], alle, mehrere: l.length > 1 ? l : undefined };
}

async function sucheKontakt(input: Record<string, unknown>): Promise<string> {
  const frage = String(input.frage ?? '').trim().slice(0, 200);
  if (!frage) return 'Fehlgeschlagen: frage fehlt.';
  const { findeKontakte, anzeigename, STUFE_LABEL, kanaele } = await import('@/lib/make-one/crm');
  const alle = await ladeKontakte();
  if (!alle.length) return 'Das CRM ist leer — die Masterliste wurde noch nicht importiert (/os/crm → Import).';
  const l = findeKontakte(alle, frage, Math.min(8, Math.max(1, Number(input.anzahl) || 5)));
  if (!l.length) return `Kein Kontakt zu „${frage}" (${alle.length} durchsucht).`;
  return `KONTAKTE — ${l.length} Treffer:\n\n` + l.map(k =>
    `ID ${k.id}\n${anzeigename(k)}${k.position ? ` · ${k.position}` : ''}${k.firma ? ` · ${k.firma}` : ''}` +
    `\nStufe ${STUFE_LABEL[k.stufe]} · Prio ${k.prio || '–'} · Eignung ${k.eignung || '–'}` +
    `${k.wiedervorlage ? ` · Wiedervorlage ${k.wiedervorlage}` : ''}${k.letzterKontakt ? ` · zuletzt ${k.letzterKontakt}` : ''}` +
    `\nKanäle: ${kanaele(k).map(c => c.art).join(', ') || 'keine'}` +
    `${k.aufhaenger ? `\nAufhänger: ${k.aufhaenger.slice(0, 220)}` : ''}`,
  ).join('\n\n───\n\n');
}

async function notiereKontakt(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  const hinweis = String(input.kontakt ?? '').trim().slice(0, 160);
  const art = String(input.art ?? 'notiz');
  if (!hinweis) return 'Fehlgeschlagen: kontakt fehlt (Name, Firma oder ID).';
  if (!['mail', 'linkedin', 'anruf', 'antwort', 'termin', 'notiz', 'stufe'].includes(art)) return 'Fehlgeschlagen: art muss mail|linkedin|anruf|antwort|termin|notiz|stufe sein.';
  const { treffer, mehrere } = await kontaktFinden(hinweis);
  if (!treffer) return `Kein Kontakt zu „${hinweis}" gefunden — erst mit suche_kontakt nachsehen.`;
  if (mehrere) {
    const { anzeigename } = await import('@/lib/make-one/crm');
    return `Mehrdeutig — meinst du ${mehrere.map(k => `${anzeigename(k)}${k.firma ? ` (${k.firma})` : ''} [${k.id}]`).join(' oder ')}? Bitte mit der ID erneut.`;
  }
  const { wendeAktivitaetAn, STUFEN, STUFE_LABEL, anzeigename } = await import('@/lib/make-one/crm');
  const { updateJson } = await import('@/lib/store/local-db');
  const { localDay, tagePlus } = await import('@/lib/zeit');
  const stufe = STUFEN.includes(input.stufe as never) ? (input.stufe as import('@/lib/make-one/crm').Stufe) : undefined;
  const wv = /^\d{4}-\d{2}-\d{2}$/.test(String(input.wiedervorlage ?? '')) ? String(input.wiedervorlage) : undefined;
  let nachher: import('@/lib/make-one/crm').Kontakt | null = null;
  await updateJson<{ kontakte: import('@/lib/make-one/crm').Kontakt[] }>('kontakte', current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(k => k.id === treffer.id);
    if (i < 0) return f;
    nachher = wendeAktivitaetAn(f.kontakte[i], {
      art: art as import('@/lib/make-one/crm').AktivitaetArt,
      text: String(input.text ?? '').trim().slice(0, 1200) || undefined,
      von: person ?? 'jarvis', stufe, wiedervorlage: wv,
    }, localDay(), new Date().toISOString(), tagePlus);
    f.kontakte[i] = nachher;
    return f;
  });
  if (!nachher) return 'Fehlgeschlagen: Kontakt beim Schreiben nicht mehr gefunden.';
  const n = nachher as import('@/lib/make-one/crm').Kontakt;
  return `Notiert: ${anzeigename(n)} · ${art} · jetzt ${STUFE_LABEL[n.stufe]}${n.wiedervorlage ? ` · Wiedervorlage ${n.wiedervorlage}` : ''}.`;
}

async function entwurfAnsprache(input: Record<string, unknown>): Promise<string> {
  const hinweis = String(input.kontakt ?? '').trim().slice(0, 160);
  if (!hinweis) return 'Fehlgeschlagen: kontakt fehlt (Name, Firma oder ID).';
  const { treffer, mehrere } = await kontaktFinden(hinweis);
  if (!treffer) return `Kein Kontakt zu „${hinweis}" gefunden.`;
  const { anzeigename, kanaele } = await import('@/lib/make-one/crm');
  if (mehrere) return `Mehrdeutig — ${mehrere.map(k => `${anzeigename(k)} [${k.id}]`).join(' oder ')}? Bitte mit der ID.`;
  const { entwurfFuer } = await import('@/lib/ansprache');
  const r = await entwurfFuer(treffer);
  if (!r.ok) return `Entwurf fehlgeschlagen: ${r.fehler}`;
  const wege = kanaele(treffer).map(c => c.art).join(', ') || 'kein Kanal hinterlegt';
  return `ANSPRACHE-ENTWURF für ${anzeigename(treffer)}${treffer.firma ? ` (${treffer.firma})` : ''} — Kanäle: ${wege}\n\nBETREFF: ${r.entwurf.betreff}\n\nE-MAIL:\n${r.entwurf.email}\n\nLINKEDIN:\n${r.entwurf.linkedin}\n\n${r.entwurf.hinweis}\nNichts wurde versendet. Wenn Kevin es geschickt hat, mit notiere_kontakt (art: mail oder linkedin) festhalten.`;
}

// ─── Haushaltsfinanzen (24.09.) ─────────────────────────────────────────────
// Nur für Personen mit Haushalt. Ohne benannte Person (Hintergrundlauf, Rück-
// nahme aus dem Protokoll) verweigern die Werkzeuge — private Finanzen gibt es
// nie „im Auftrag von niemandem“.

async function haushaltDer(person?: string) {
  const { haushaltFuer } = await import('@/lib/finanzen/haushalt/zugriff');
  return haushaltFuer(person ?? null);
}
const KEIN_HAUSHALT = 'Nicht verfügbar: Die Haushaltsfinanzen gibt es nur im Gespräch mit Kevin oder Malin — nicht im Hintergrund und nicht für andere Konten.';

async function haushaltStand(_i: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const z = await haushaltDer(person); if (!z) return KEIN_HAUSHALT;
  const { ladeHaushalt } = await import('@/lib/finanzen/haushalt/speicher');
  const { standText } = await import('@/lib/finanzen/haushalt/jarvis');
  return standText(await ladeHaushalt(z.haushalt));
}

async function haushaltBuchungen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const z = await haushaltDer(person); if (!z) return KEIN_HAUSHALT;
  const { ladeHaushalt } = await import('@/lib/finanzen/haushalt/speicher');
  const { buchungenSuchen } = await import('@/lib/finanzen/haushalt/jarvis');
  return buchungenSuchen(await ladeHaushalt(z.haushalt), { suche: input.suche ? String(input.suche) : undefined, monat: input.monat ? String(input.monat) : undefined, kategorie: input.kategorie ? String(input.kategorie) : undefined });
}

async function haushaltZuordnen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const z = await haushaltDer(person); if (!z) return KEIN_HAUSHALT;
  const { ladeHaushalt } = await import('@/lib/finanzen/haushalt/speicher');
  const { regelLernen } = await import('@/lib/finanzen/haushalt/aktionen');
  const { normal } = await import('@/lib/finanzen/haushalt/regeln');
  const h = await ladeHaushalt(z.haushalt);
  const kat = h.stamm.kategorien.find(k => normal(k.name) === normal(String(input.kategorie ?? '')));
  if (!kat) return `Fehlgeschlagen: Kategorie „${String(input.kategorie ?? '')}“ gibt es nicht. Vorhanden: ${h.stamm.kategorien.map(k => k.name).join(', ')}.`;
  const e = await regelLernen(z.haushalt, { muster: String(input.muster ?? ''), kategorie_id: kat.id, rueckwirkend: input.rueckwirkend !== false, ganzes_wort: true }, false);
  return `Gemerkt: „${String(input.muster)}“ → ${kat.name}. ${e.geaendert} Buchung${e.geaendert === 1 ? '' : 'en'} zugeordnet.`;
}

async function haushaltRechnungBezahlt(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const z = await haushaltDer(person); if (!z) return KEIN_HAUSHALT;
  const { ladeHaushalt, patchen } = await import('@/lib/finanzen/haushalt/speicher');
  const { normal } = await import('@/lib/finanzen/haushalt/regeln');
  const { heuteBerlin } = await import('@/lib/finanzen/haushalt/monat');
  const h = await ladeHaushalt(z.haushalt);
  const s = normal(String(input.rechnung ?? ''));
  const r = h.belege.filter(b => b.art === 'rechnung' && !b.erledigt && (normal(b.empfaenger ?? '').includes(s) || normal(b.bezeichnung).includes(s)));
  if (r.length !== 1) return r.length ? `Nicht eindeutig: ${r.map(b => b.empfaenger || b.bezeichnung).join(', ')}.` : `Keine offene Rechnung zu „${String(input.rechnung ?? '')}“.`;
  const e = await patchen(z.haushalt, 'belege', [{ op: 'upsert', stand: r[0].stand, eintrag: { ...r[0], erledigt: true, bezahlt_am: heuteBerlin() } }]);
  return e.ok ? `Als bezahlt vermerkt: ${r[0].empfaenger || r[0].bezeichnung}.` : `Fehlgeschlagen: ${e.fehler}`;
}

async function haushaltRechnungErfassen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const z = await haushaltDer(person); if (!z) return KEIN_HAUSHALT;
  const { patchen } = await import('@/lib/finanzen/haushalt/speicher');
  const betrag = Number(input.betrag);
  const e = await patchen(z.haushalt, 'belege', [{ op: 'upsert', eintrag: {
    art: 'rechnung', empfaenger: String(input.an ?? ''), bezeichnung: String(input.wofuer ?? input.an ?? 'Rechnung'),
    betrag: Number.isFinite(betrag) ? Math.round(betrag * 100) : null, faellig_am: /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : null,
    verursacher: person === 'malin' ? 'Malin' : 'Kevin', einheit: 'privat', erledigt: false,
  } }]);
  return e.ok ? `Offene Rechnung erfasst: ${String(input.an ?? '')}${Number.isFinite(betrag) ? ` über ${eurW(betrag)}` : ''}.` : `Fehlgeschlagen: ${e.fehler}`;
}

export const WERKZEUGE: Record<string, { gruppe: string; lauf: (input: Record<string, unknown>, origin: string, person?: string) => Promise<string> }> = {
  create_task: { gruppe: 'aufgaben', lauf: erstelleAufgabe },
  starte_auftraege: { gruppe: 'auftraege', lauf: starteAuftraege },
  fakt_merken: { gruppe: 'gedaechtnis', lauf: faktMerken },
  suche_wissen: { gruppe: 'wissen', lauf: sucheWissen },
  lies_notiz: { gruppe: 'wissen', lauf: liesNotiz },
  notiz_anlegen: { gruppe: 'wissen', lauf: notizAnlegen },
  notiz_ergaenzen: { gruppe: 'wissen', lauf: notizErgaenzen },
  haushalt_stand: { gruppe: 'haushalt', lauf: haushaltStand },
  haushalt_buchungen: { gruppe: 'haushalt', lauf: haushaltBuchungen },
  haushalt_zuordnen: { gruppe: 'haushalt', lauf: haushaltZuordnen },
  haushalt_rechnung_bezahlt: { gruppe: 'haushalt', lauf: haushaltRechnungBezahlt },
  haushalt_rechnung_erfassen: { gruppe: 'haushalt', lauf: haushaltRechnungErfassen },
  frag_gedaechtnis: { gruppe: 'gedaechtnis', lauf: fragGedaechtnis },
  plan_block: { gruppe: 'planer', lauf: planBlock },
  // Selbst nachsehen statt verweisen — Kevins Ansage.
  lies_postfach: { gruppe: 'inbox', lauf: liesPostfach },
  setze_vitalwerte: { gruppe: 'gesundheit', lauf: setzeVitalwerte },
  setze_ziele: { gruppe: 'finanzen', lauf: setzeZiele },
  erfasse_planposten: { gruppe: 'finanzen', lauf: erfassePlanposten },
  setze_kontostand: { gruppe: 'finanzen', lauf: setzeKontostand },
  erfasse_rechnung: { gruppe: 'finanzen', lauf: erfasseRechnung },
  erfasse_zahlung: { gruppe: 'finanzen', lauf: erfasseZahlung },
  setze_meilenstein: { gruppe: 'meilensteine', lauf: setzeMeilenstein },
  setze_fokus: { gruppe: 'fokus', lauf: setzeFokus },
  setze_kunde: { gruppe: 'kunden', lauf: setzeKunde },
  hake_routine: { gruppe: 'gesundheit', lauf: hakeRoutine },
  haut_eintrag: { gruppe: 'gesundheit', lauf: hautEintrag },
  journal_eintrag: { gruppe: 'gesundheit', lauf: journalEintrag },
  streak_eintrag: { gruppe: 'gesundheit', lauf: streakEintrag },
  suche_kontakt: { gruppe: 'kontakte', lauf: sucheKontakt },
  notiere_kontakt: { gruppe: 'kontakte', lauf: notiereKontakt },
  entwurf_ansprache: { gruppe: 'kontakte', lauf: entwurfAnsprache },
};
