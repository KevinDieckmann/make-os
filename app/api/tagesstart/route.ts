// ─── MAKE OS — Tagesstart ───────────────────────────────────────────────────
// Einmal pro Tag, beim ersten Öffnen: alles frisch holen und den Morgen-Loop
// laufen lassen. Kevin soll morgens nichts anklicken müssen — er macht auf und
// weiß, wo er steht.
//
// GET  → Status: lief heute schon ein Tagesstart? Was fehlt noch?
// POST → führt ihn aus (Kalender auffrischen + Morgen-Loop) und merkt sich das.
// 28.09.: vorneweg die Angebote — gestellte nach „gültig bis“ → abgelaufen, mit Follow-up-Hinweis
// (lib/crm/angebot-server.ts `ablaufNachziehen`); vorher geschah das nur beim Lesen der Markttraktion.
// 28.09. spät (Paket C3): danach die Aufgaben-Serien — fällige wiederkehrende Listen und nachzuholende
// Serien-Aufgaben (lib/aufgaben/serie-server.ts), nur Haushalt des Inhabers oder Systemlauf.
// S1 (29.09.): kein Rückfall auf „kevin“ mehr (Regel 5) — die internen Hops tragen nur eine ausdrücklich benannte Person
// (`personStreng`), sonst laufen sie als Systemlauf. Der Kalender-Schritt liest nichts mehr aus dem Altweg
// /api/apple-calendar: er stößt den Abgleich an und zählt über `termineFuerZoe` (für die Person gefiltert).

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { recentRuns } from '@/lib/agent-log';
import { resolveVitals, localDay } from '@/lib/vitals';
import { innenAdresse } from '@/lib/innen';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { termineFuerZoe } from '@/lib/kalender/zoe-sicht-server';
import { tagePlus } from '@/lib/zeit';
import { ablaufNachziehen } from '@/lib/crm/angebot-server';
import { imHaushaltOderSystemlauf, haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { aufgabenSerienNachziehen, papierkorbAufraeumen } from '@/lib/aufgaben/serie-server';
import { produktePapierkorbAufraeumen, crmPapierkorbAufraeumen } from '@/lib/crm/produkte-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StartLog { lastRun?: string }

/** Was ist heute schon passiert und was fehlt? */
async function status(today: string) {
  const start = (await loadJson<StartLog>('tagesstart')) ?? {};
  const vitals = await resolveVitals(today);
  const cal = await loadJson<{ at?: string }>('calendar-cache');
  const calAgeH = cal?.at ? (Date.now() - new Date(cal.at).getTime()) / 3_600_000 : null;
  const loops = await recentRuns('loop-morgen', 5);
  const loopHeute = loops.some(e => e.ts.slice(0, 10) === today);

  return {
    today,
    gelaufen: start.lastRun === today,
    loopHeute,
    vitalsHeute: vitals.heute,
    vitalsStand: vitals.stand,
    kalenderAlterStd: calAgeH == null ? null : Math.round(calAgeH),
    // Was Kevin noch selbst tun muss, damit die Zahlen von heute stimmen.
    offen: [
      !vitals.heute ? 'Morgen-Check: Whoop-Werte eintragen (/os/gesundheit)' : null,
      calAgeH == null || calAgeH > 12 ? 'Kalender auffrischen (/os/kalender öffnen)' : null,
    ].filter(Boolean) as string[],
  };
}

export async function GET() {
  return NextResponse.json(await status(localDay()));
}

export async function POST(req: Request) {
  let body: { force?: boolean } = {};
  try { body = await req.json(); } catch { /* Aufruf ohne Body ist ok */ }
  const today = localDay();
  const st = await status(today);

  // Schon gelaufen und kein ausdrücklicher Neustart → nichts doppelt tun.
  if (st.gelaufen && !body.force) {
    const letzte = (await recentRuns('loop-morgen', 1))[0];
    return NextResponse.json({ ...st, uebersprungen: true, loop: letzte?.payload ?? null });
  }

  const origin = innenAdresse(req);
  const schritte: { name: string; ok: boolean; info?: string }[] = [];
  // Interne Hops: Dienstschlüssel + die ausdrücklich benannte Person (Regel 7) — ohne Person ein Systemlauf, nie „kevin“.
  const person = personStreng(req);
  const dienst = { 'x-make-key': process.env.MAKE_OS_KEY ?? '', ...(person ? { 'x-make-person': person } : {}) };

  // 0) Angebote: Ablauf nach „gültig bis“ serverseitig nachziehen (ohne Netz, schreibt nur bei Bedarf, Protokoll „System“).
  try {
    const n = await ablaufNachziehen();
    schritte.push({ name: 'Angebote', ok: true, info: n ? `${n} abgelaufen — Follow-up „nachfassen oder Version 2“` : 'keins abgelaufen' });
  } catch (err) {
    schritte.push({ name: 'Angebote', ok: false, info: err instanceof Error ? err.message : 'Fehler' });
  }

  // 0b) Aufgaben-Serien: fällige wiederkehrende Listen anlegen, Serien-Aufgaben nachholen (ohne Netz, schreibt nur
  //     wenn fällig, höchstens eine neue Liste je Serie und Lauf, Protokoll „System“).
  try {
    if (!(await imHaushaltOderSystemlauf(req))) schritte.push({ name: 'Aufgaben-Serien', ok: false, info: 'nur im Haushalt des Inhabers' });
    else {
      const s = await aufgabenSerienNachziehen();
      const was = [s.listen ? `${s.listen} Liste${s.listen === 1 ? '' : 'n'}` : '', s.aufgaben ? `${s.aufgaben} Aufgabe${s.aufgaben === 1 ? '' : 'n'}` : ''].filter(Boolean).join(', ');
      schritte.push({ name: 'Aufgaben-Serien', ok: true, info: [was ? `angelegt: ${was}` : 'nichts fällig', ...s.hinweise].join(' · ') });
    }
  } catch (err) {
    schritte.push({ name: 'Aufgaben-Serien', ok: false, info: err instanceof Error ? err.message : 'Fehler' });
  }

  // 0c) Aufgaben-Papierkorb (29.09.): älter als 30 Tage → endgültig (samt Kette und Dateien), Protokoll „System“.
  try {
    if (!(await imHaushaltOderSystemlauf(req))) schritte.push({ name: 'Aufgaben-Papierkorb', ok: false, info: 'nur im Haushalt des Inhabers' });
    else {
      const p = await papierkorbAufraeumen();
      const was = [p.projekte ? `${p.projekte} Projekt${p.projekte === 1 ? '' : 'e'}` : '', p.aufgaben ? `${p.aufgaben} Aufgabe${p.aufgaben === 1 ? '' : 'n'}` : '', p.dateien ? `${p.dateien} Datei${p.dateien === 1 ? '' : 'en'}` : ''].filter(Boolean).join(', ');
      schritte.push({ name: 'Aufgaben-Papierkorb', ok: true, info: was ? `endgültig gelöscht: ${was}` : 'nichts älter als 30 Tage' });
    }
  } catch (err) {
    schritte.push({ name: 'Aufgaben-Papierkorb', ok: false, info: err instanceof Error ? err.message : 'Fehler' });
  }

  // 0d) Produkte-Papierkorb (04.10.): älter als 30 Tage und ohne Verweise → endgültig; mit Verweisen bleibt es im Papierkorb.
  try {
    if (!(await imHaushaltOderSystemlauf(req))) schritte.push({ name: 'Produkte-Papierkorb', ok: false, info: 'nur im Haushalt des Inhabers' });
    else {
      const p = await produktePapierkorbAufraeumen();
      schritte.push({ name: 'Produkte-Papierkorb', ok: true, info: p.produkte ? `endgültig gelöscht: ${p.produkte} Produkt${p.produkte === 1 ? '' : 'e'}` : 'nichts älter als 30 Tage' });
    }
  } catch (err) {
    schritte.push({ name: 'Produkte-Papierkorb', ok: false, info: err instanceof Error ? err.message : 'Fehler' });
  }

  // 0e) CRM-Papierkorb der übrigen Listen (04.10., lib/crm/ablage.ts): Firmen, Mandate, Events, Segmente, Beiträge, Ausgaben,
  //     Kampagnen — älter als 30 Tage und ohne Verweise → endgültig; Events mit Kalender-Termin/Übergaben nur von Hand.
  try {
    if (!(await imHaushaltOderSystemlauf(req))) schritte.push({ name: 'CRM-Papierkorb', ok: false, info: 'nur im Haushalt des Inhabers' });
    else {
      const p = await crmPapierkorbAufraeumen();
      schritte.push({ name: 'CRM-Papierkorb', ok: true, info: p.eintraege ? `endgültig gelöscht: ${p.eintraege} Eintr${p.eintraege === 1 ? 'ag' : 'äge'}${p.bleiben ? ` · ${p.bleiben} mit Verweisen bleiben` : ''}` : p.bleiben ? `${p.bleiben} mit Verweisen bleiben im Papierkorb` : 'nichts älter als 30 Tage' });
    }
  } catch (err) {
    schritte.push({ name: 'CRM-Papierkorb', ok: false, info: err instanceof Error ? err.message : 'Fehler' });
  }

  // 0f) Gesellschaften-Papierkorb (04.10., Register): Einträge älter als 30 Tage → endgültig; eine Gesellschaft nur ohne Verweise.
  try {
    const h = (await imHaushaltOderSystemlauf(req)) ? await haushaltDesInhabers() : null;
    if (!h) schritte.push({ name: 'Gesellschaften-Papierkorb', ok: false, info: 'nur im Haushalt des Inhabers' });
    else {
      const { registerPapierkorbAufraeumen, vertragsErinnerungen } = await import('@/lib/gesellschaften/server');
      const p = await registerPapierkorbAufraeumen(h);
      schritte.push({ name: 'Gesellschaften-Papierkorb', ok: true, info: p.eintraege ? `endgültig gelöscht: ${p.eintraege} Eintr${p.eintraege === 1 ? 'ag' : 'äge'}` : 'nichts älter als 30 Tage' });
      // 04.10. Nachtrag: Erinnerung vor „kündigen bis“ (Aufgabe + Glocke, idempotent).
      const e = await vertragsErinnerungen(h);
      schritte.push({ name: 'Vertrags-Erinnerungen', ok: true, info: e.neu ? `${e.neu} neue Erinnerung${e.neu === 1 ? '' : 'en'}` : 'keine fällig' });
    }
  } catch (err) {
    schritte.push({ name: 'Gesellschaften-Papierkorb', ok: false, info: err instanceof Error ? err.message : 'Fehler' });
  }

  // 0g) Kapazität deaktivierter Team-Personen (DSGVO-Nachtrag 04.10.): 30 Tage nach dem Deaktivieren Grundwert, Urlaub/Blöcke,
  //     Zuweisungen und Einwilligung löschen (idempotent, Protokoll „System“); alte Einträge ohne Zeitpunkt bekommen „jetzt“.
  try {
    const h = (await imHaushaltOderSystemlauf(req)) ? await haushaltDesInhabers() : null;
    if (!h) schritte.push({ name: 'Kapazität deaktivierter Personen', ok: false, info: 'nur im Haushalt des Inhabers' });
    else {
      const { kapaDeaktivierteAufraeumen } = await import('@/lib/kapazitaet/server');
      const k = await kapaDeaktivierteAufraeumen(h);
      const was = [k.personen ? `gelöscht: Kapazität von ${k.personen} Person${k.personen === 1 ? '' : 'en'}` : '', k.gestempelt ? `Frist begonnen für ${k.gestempelt}` : ''].filter(Boolean).join(' · ');
      schritte.push({ name: 'Kapazität deaktivierter Personen', ok: true, info: was || 'nichts fällig' });
    }
  } catch (err) {
    schritte.push({ name: 'Kapazität deaktivierter Personen', ok: false, info: err instanceof Error ? err.message : 'Fehler' });
  }

  // 0h) Wochenplan festhalten (Kevin 05.10.): montags bzw. beim ersten Lauf der Woche den Plan je Person ablegen — Grundlage der
  //     echten Plan-Treue „geplant vs. Ist“ (lib/kapazitaet/plan.ts). Idempotent; Wochen älter als 24 Monate fallen weg.
  try {
    const h = (await imHaushaltOderSystemlauf(req)) ? await haushaltDesInhabers() : null;
    if (!h) schritte.push({ name: 'Wochenplan festhalten', ok: false, info: 'nur im Haushalt des Inhabers' });
    else {
      const { kapaPlanFesthalten } = await import('@/lib/kapazitaet/server');
      const p = await kapaPlanFesthalten(h, today);
      const was = [p.neu ? `Woche ab ${p.woche.slice(8, 10)}.${p.woche.slice(5, 7)}. festgehalten (${p.personen} Person${p.personen === 1 ? '' : 'en'})` : 'diese Woche schon festgehalten', p.entfernt ? `${p.entfernt} alte Woche${p.entfernt === 1 ? '' : 'n'} gelöscht` : ''].filter(Boolean).join(' · ');
      schritte.push({ name: 'Wochenplan festhalten', ok: true, info: was });
    }
  } catch (err) {
    schritte.push({ name: 'Wochenplan festhalten', ok: false, info: err instanceof Error ? err.message : 'Fehler' });
  }

  // 1) Kalender auffrischen — nur wenn er wirklich alt ist. Der osascript-Read
  //    ist zäh (bis ~55s), das muss nicht jeden Morgen sein.
  if (st.kalenderAlterStd == null || st.kalenderAlterStd > 12) {
    try {
      // Nur auffrischen (iCloud-Abgleich bzw. Mac-Lesen) — der Inhalt wird hier nicht gelesen. Gezählt wird über den EINEN
      // Lesepfad für Personen (`termineFuerZoe`: privat/Gesundheit der anderen nur „Belegt“).
      const r = await fetch(`${origin}/api/apple-calendar?refresh=1`, { headers: dienst, signal: AbortSignal.timeout(75_000) });
      await r.body?.cancel().catch(() => {});
      const n = r.ok && person ? (await termineFuerZoe(person, today, tagePlus(today, 21))).termine.length : null;
      schritte.push({ name: 'Kalender', ok: r.ok, info: !r.ok ? 'Zugriff fehlt' : n !== null ? `${n} Termine` : 'aufgefrischt' });
    } catch {
      schritte.push({ name: 'Kalender', ok: false, info: 'zu langsam — letzter Stand bleibt' });
    }
  } else {
    schritte.push({ name: 'Kalender', ok: true, info: `Stand ${st.kalenderAlterStd} Std. — frisch genug` });
  }

  // 2) Die volle Kette: Postfächer → Termine → Aufgaben → Lage → Wächter →
  //    Ausrichtung. Ersetzt den einzelnen Morgen-Loop — der Tagesstart IST
  //    jetzt der Einstieg in den Tageslauf.
  let loop: unknown = null;
  try {
    const r = await fetch(`${origin}/api/tageslauf`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...dienst },
      body: JSON.stringify({ art: 'voll' }),
      signal: AbortSignal.timeout(240_000),
    });
    const d = await r.json();
    const lauf = d.lauf as { ausrichtung?: Record<string, unknown>; alarm?: string; schritte?: { name: string; stand: string; kurz: string }[] } | undefined;
    loop = lauf?.ausrichtung ? { ...lauf.ausrichtung, alarm: lauf.alarm } : null;
    schritte.push({ name: 'Tageslauf (volle Kette)', ok: !!lauf?.ausrichtung, info: lauf?.schritte?.map(x => x.name).join(' → ') });
  } catch (err) {
    schritte.push({ name: 'Tageslauf', ok: false, info: err instanceof Error ? err.message : 'Fehler' });
  }

  // 3) Performance-Schnappschuss — nur so entsteht ein Verlauf.
  try {
    await fetch(`${origin}/api/performance`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...dienst }, body: '{}', signal: AbortSignal.timeout(20_000) });
    schritte.push({ name: 'Index', ok: true });
  } catch {
    schritte.push({ name: 'Index', ok: false });
  }

  await updateJson<StartLog>('tagesstart', () => ({ lastRun: today }));

  return NextResponse.json({ ...(await status(today)), schritte, loop });
}
