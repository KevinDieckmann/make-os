// ─── MAKE OS — Onboarding: der echte Zustand ────────────────────────────────
// Die Selbstprüfung des Onboardings. Liegt hier und nicht in der Route, weil
// auch die Startfläche den Fortschritt zeigt — eine Quelle, kein zweiter Satz
// Regeln, der auseinanderläuft.

import fs from "node:fs/promises";
import path from "node:path";
import { loadJson } from "@/lib/store/local-db";
import { localDay } from "@/lib/zeit";
import { hasAnthropicKey } from "@/lib/anthropic";
import { lesen, type MalinExport } from "@/lib/make-one/grundlage";
import { SCHRITTE } from "@/lib/make-one/onboarding-data";

export interface Handisch { erledigt: Record<string, { at: string; von: string }> }
export interface Befund { erfuellt: boolean; wert: string }


const nein = (wert: string): Befund => ({ erfuellt: false, wert });
const ja = (wert: string): Befund => ({ erfuellt: true, wert });

export async function pruefeAlles(): Promise<Record<string, Befund>> {
  const heute = localDay();
  const [netz, cal, inbox, tasks, kompass, ziele, finance, plan, health, agenten, verlauf, grund] = await Promise.all([
    loadJson<{ kontakte?: unknown[] }>('netzwerk'),
    loadJson<{ events?: unknown[] }>('calendar-cache'),
    loadJson<{ messages?: unknown[]; nachrichten?: unknown[] }>('microsoft-inbox'),
    loadJson<{ tasks?: { status?: string; dueDate?: string; assignee?: string }[] }>('tasks'),
    loadJson<{ modus?: string; eigene?: Record<string, unknown> }>('kompass'),
    loadJson<{ fokus?: Record<string, string>; jahr?: unknown[] }>('ziele'),
    loadJson<{ zielUmsatz?: number; startMonat?: number }>('finance'),
    loadJson<{ firmen?: { name?: string; kontostand?: number | null }[]; zahlungen?: { status?: string; faellig?: string }[]; rechnungen?: unknown[] }>('finanzplan'),
    loadJson<Record<string, string[]>>('health-log'),
    loadJson<Record<string, unknown>>('agents-config'),
    loadJson<{ gespraeche?: unknown[] }>('jarvis-verlauf'),
    loadJson<{ roh: MalinExport; stand: string }>('grundlage'),
  ]);

  // Sicherung: liegen Stände von heute im Ordner?
  let sicherung = nein('kein Ordner .data/backup');
  try {
    const dir = path.join(process.cwd(), '.data', 'backup');
    const dateien = await fs.readdir(dir);
    const vonHeute = dateien.filter(f => f.includes(heute)).length;
    sicherung = vonHeute
      ? ja(`${dateien.length} Sicherungen, ${vonHeute} von heute`)
      : nein(`${dateien.length} Sicherungen, aber keine von heute`);
  } catch { /* Ordner entsteht beim ersten Schreiben */ }

  const offen = (tasks?.tasks ?? []).filter(t => t.status !== 'done');
  const ueberfaellig = offen.filter(t => t.dueDate && t.dueDate < heute).length;
  const malinAufgaben = offen.filter(t => t.assignee === 'malin' || t.assignee === 'beide').length;

  const g = grund?.roh ? lesen(grund.roh, grund.stand) : null;
  const kvPv = g?.konfiguration.kvPvKevinMonat ?? 0;
  const malinBrutto = g?.konfiguration.malinBruttoMonat ?? 0;

  const firmen = (plan?.firmen ?? []).filter(f => (f as { id?: string }).id !== 'privat');
  const ohneStand = firmen.filter(f => f.kontostand == null).length;
  const offeneZahlungen = (plan?.zahlungen ?? []).filter(z => z.status === 'offen' && (z as { firmaId?: string }).firmaId !== 'privat');
  const ohneFrist = offeneZahlungen.filter(z => !z.faellig).length;

  const horizonte = ['jahr', 'quartal', 'monat', 'woche'] as const;
  const gesetzt = horizonte.filter(h => (ziele?.fokus?.[h] ?? '').trim()).length;

  const letzte7 = Object.keys(health ?? {}).filter(d => d >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).length;
  const reglerEigen = Object.keys(kompass?.eigene ?? {}).length;
  const postfach = (inbox?.messages?.length ?? inbox?.nachrichten?.length ?? 0);

  return {
    schluessel: process.env.MAKE_OS_KEY && hasAnthropicKey()
      ? ja('beide Schlüssel gesetzt')
      : nein(process.env.MAKE_OS_KEY ? 'ANTHROPIC_API_KEY fehlt' : 'MAKE_OS_KEY fehlt'),
    sicherung,
    grundlage: g ? ja(`Stand ${grund!.stand}, ${g.umsatz.length + g.kosten.length + g.entnahmen.length} Positionen`) : nein('noch kein Export geladen'),
    kalender: (cal?.events?.length ?? 0) > 0 ? ja(`${cal!.events!.length} Termine`) : nein('kein Kalender verbunden'),
    postfach: postfach > 0 ? ja(`${postfach} Nachrichten`) : nein('kein Postfach verbunden'),
    kontakte: (netz?.kontakte?.length ?? 0) > 0 ? ja(`${netz!.kontakte!.length} Kontakte`) : nein('keine Kontakte'),
    aufgaben: ueberfaellig === 0 ? ja(`${offen.length} offen, nichts überfällig`) : nein(`${ueberfaellig} überfällig von ${offen.length}`),
    kompass: kompass?.modus && reglerEigen >= 3
      ? ja(`Lage ${kompass.modus}, ${reglerEigen} Regler eigen gestellt`)
      : nein(kompass?.modus ? `Lage ${kompass.modus}, aber nur ${reglerEigen} Regler gestellt` : 'noch nicht gestellt'),
    fokus: gesetzt >= 3 ? ja(`${gesetzt} von 4 Horizonten gesetzt`) : nein(`nur ${gesetzt} von 4 Horizonten gesetzt`),
    ziele: (finance?.zielUmsatz ?? 0) > 0 && finance?.startMonat != null
      ? ja(`Ziel steht, Start ab Monat ${finance.startMonat + 1}`)
      : nein('Jahresziel oder Startmonat fehlt'),
    gesundheit: letzte7 >= 3 ? ja(`${letzte7} von 7 Tagen erfasst`) : nein(`nur ${letzte7} von 7 Tagen erfasst`),
    agenten: Object.keys(agenten ?? {}).length >= 6
      ? ja(`${Object.keys(agenten!).length} Agenten eingestellt`)
      : nein(`erst ${Object.keys(agenten ?? {}).length} von 12 eingestellt`),
    jarvis: (verlauf?.gespraeche?.length ?? 0) > 0 ? ja(`${verlauf!.gespraeche!.length} Gespräche gespeichert`) : nein('noch kein Gespräch'),
    luecken: kvPv > 0 && malinBrutto > 0
      ? ja('KV/PV und Gehalt hinterlegt')
      : nein([kvPv > 0 ? null : 'Kevins KV+PV = 0 €', malinBrutto > 0 ? null : 'Malins Gehalt = 0 €'].filter(Boolean).join(' · ')),
    konten: firmen.length && ohneStand === 0 ? ja(`${firmen.length} Konten gepflegt`) : nein(`${ohneStand} von ${firmen.length} Konten ohne Stand`),
    posten: offeneZahlungen.length === 0
      ? ja('keine offenen Posten')
      : ohneFrist === 0 ? ja(`${offeneZahlungen.length} offen, alle mit Frist`) : nein(`${ohneFrist} von ${offeneZahlungen.length} ohne Fälligkeit`),
    'malin-aufgaben': malinAufgaben > 0 ? ja(`${malinAufgaben} Aufgaben auf Malin`) : nein('nichts auf Malin zugewiesen'),
  };
}

/** Wie weit das Onboarding insgesamt ist — für die Kachel auf der Startfläche. */
export async function fortschritt(): Promise<{ fertig: number; gesamt: number; offeneMinuten: number }> {
  const [handisch, befunde] = await Promise.all([loadJson<Handisch>("onboarding"), pruefeAlles()]);
  const erledigt = handisch?.erledigt ?? {};
  const fertigeSchritte = SCHRITTE.filter(s => (s.pruefung && befunde[s.pruefung]?.erfuellt) || !!erledigt[s.id]);
  const offen = SCHRITTE.filter(s => !fertigeSchritte.includes(s));
  return { fertig: fertigeSchritte.length, gesamt: SCHRITTE.length, offeneMinuten: offen.reduce((n, s) => n + s.minuten, 0) };
}
