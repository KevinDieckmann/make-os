// ─── MAKE OS — Onboarding: der echte Zustand ────────────────────────────────
// Die Selbstprüfung des Onboardings. Liegt hier und nicht in der Route, weil
// auch die Startfläche den Fortschritt zeigt — eine Quelle, kein zweiter Satz
// Regeln, der auseinanderläuft.

import { loadJson } from "@/lib/store/local-db";
import { localDay } from "@/lib/zeit";
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { ladePostfaecher } from '@/lib/postfach/register';
import { SCHRITTE } from "@/lib/make-one/onboarding-data";

export interface Handisch { erledigt: Record<string, { at: string; von: string }> }
export interface Befund { erfuellt: boolean; wert: string }

const nein = (wert: string): Befund => ({ erfuellt: false, wert });
const ja = (wert: string): Befund => ({ erfuellt: true, wert });
const PERSON = /^[a-z0-9-]{1,40}$/;

/**
 * Persönliche Prüfungen — IMMER nur für `person` (die Person der Sitzung), nie für eine andere (08.10., Sicht-Regel).
 * Sie lesen nur „ist eingerichtet ja/nein“ bzw. eigene Zähler: keine Gesundheitswerte, keine Adressen, keine Inhalte.
 * Ohne Person (Systemlauf) fehlen sie ganz.
 */
export const PERSOENLICHE_PRUEFUNGEN = ['zwei-faktor', 'gesundheit-einwilligung', 'icloud', 'postfach', 'telegram', 'aufgaben-ich', 'zoe'] as const;
/** Prüfungen über die Instanz bzw. den gemeinsamen Haushalt (für alle im Haushalt gleich). */
export const GEMEINSAME_PRUEFUNGEN = ['sicherung', 'zwei-faktor-pflicht', 'kalender', 'kontakte', 'aufgaben', 'kompass', 'fokus', 'ziele', 'agenten', 'konten', 'posten'] as const;
export const ALLE_PRUEFUNGEN: readonly string[] = [...PERSOENLICHE_PRUEFUNGEN, ...GEMEINSAME_PRUEFUNGEN];

/** Wer eine Prüfung wirft, bekommt „nicht prüfbar“ — nie bricht die ganze Seite. */
async function sicher(f: () => Promise<Befund>): Promise<Befund> {
  try { return await f(); } catch { return nein('nicht prüfbar'); }
}

async function persoenlich(person: string): Promise<Record<string, Befund>> {
  const [
    { kontoFuerSpeicher }, { gesundheitNachweis }, { ladeVerbindung, hauptPerson, hauptZugangLaden },
    { ladeGmailStand }, { ladeStand: ladeTelegram, chatsFuerPerson },
  ] = await Promise.all([
    import('@/lib/zugang/konten'), import('@/lib/datenschutz/gesundheit-einwilligung'), import('@/lib/kalender/icloud-person'),
    import('@/lib/gmail/stand'), import('@/lib/telegram'),
  ]);
  const heute = localDay();
  const [zweiFaktor, einwilligung, icloud, postfach, telegram, aufgabenIch, zoe] = await Promise.all([
    sicher(async () => ((await kontoFuerSpeicher(person))?.zweiterFaktor ? ja('bei dir an') : nein('bei dir noch aus'))),
    // Nur „erklärt ja/nein“ zu (a) — nie, was erklärt wurde, nie ein Gesundheitswert.
    sicher(async () => ((await gesundheitNachweis(person)).some(e => e.zweck === 'verarbeiten') ? ja('von dir erklärt') : nein('von dir noch nicht erklärt'))),
    sicher(async () => {
      if (await ladeVerbindung(person)) return ja('dein Kalender ist verbunden');
      if ((await hauptPerson()) === person) {
        const { quelle } = await hauptZugangLaden();
        if (quelle === 'oberflaeche' || quelle === 'umgebung') return ja('dein Kalender ist verbunden');
      }
      return nein('bei dir noch nicht verbunden');
    }),
    sicher(async () => {
      const n = (await ladePostfaecher(person)).filter(p => p.quelle === 'imap').length + ((await ladeGmailStand(person)) ? 1 : 0);
      return n > 0 ? ja(`${n} ${n === 1 ? 'Postfach' : 'Postfächer'} bei dir`) : nein('bei dir noch keins');
    }),
    sicher(async () => (chatsFuerPerson(await ladeTelegram(), person).length ? ja('bei dir gekoppelt') : nein('bei dir nicht gekoppelt (optional)'))),
    sicher(async () => {
      const t = await ladeAufgabenSicht(person);
      const meine = (t?.tasks ?? []).filter(x => x.status !== 'done' && x.status !== 'cancelled' && x.assignee === person);
      const ueber = meine.filter(x => x.dueDate && x.dueDate < heute).length;
      if (!meine.length) return ja('nichts offen auf dich');
      return ueber ? nein(`${ueber} von ${meine.length} auf dich überfällig`) : ja(`${meine.length} offen auf dich, nichts überfällig`);
    }),
    sicher(async () => {
      const v = await loadJson<{ gespraeche?: { person?: string }[] }>('zoe-verlauf');
      const n = (v?.gespraeche ?? []).filter(g => g?.person === person).length;
      return n ? ja(`${n} ${n === 1 ? 'Gespräch' : 'Gespräche'} von dir`) : nein('noch kein Gespräch von dir');
    }),
  ]);
  return { 'zwei-faktor': zweiFaktor, 'gesundheit-einwilligung': einwilligung, icloud, postfach, telegram, 'aufgaben-ich': aufgabenIch, zoe };
}

async function gemeinsam(): Promise<Record<string, Befund>> {
  const heute = localDay();
  const [{ sicherungsStatus }, { ladeKonten }] = await Promise.all([import('@/lib/datenschutz/umfeld'), import('@/lib/zugang/konten')]);
  const [sich, konten, netz, cal, tasks, kompass, ziele, finance, plan, agenten] = await Promise.all([
    sicherungsStatus().catch(() => null),
    ladeKonten().catch(() => null),
    loadJson<{ kontakte?: unknown[] }>('netzwerk'),
    loadJson<{ events?: unknown[] }>('calendar-cache'),
    ladeAufgabenSicht(null), // Systemsicht: ohne „nur ich“ (29.09.)
    loadJson<{ modus?: string; eigene?: Record<string, unknown> }>('kompass'),
    loadJson<{ fokus?: Record<string, string> }>('ziele'),
    loadJson<{ zielUmsatz?: number; startMonat?: number }>('finance'),
    loadJson<{ firmen?: { name?: string; kontostand?: number | null }[]; zahlungen?: { status?: string; faellig?: string }[] }>('finanzplan'),
    loadJson<Record<string, unknown>>('agents-config'),
  ]);

  // Nachtsicherung: Statusdatei von deploy/sicherung.sh (nur Verfahren + Zeit). Älter als 36 h = nicht frisch.
  const sicherungZeit = sich?.zeit ? Date.parse(sich.zeit) : NaN;
  const sicherung = !sich ? nein('noch keine Nachtsicherung gemeldet')
    : Number.isFinite(sicherungZeit) && Date.now() - sicherungZeit <= 36 * 3600_000
      ? ja(`letzte Nachtsicherung ${sich.zeit!.slice(0, 10)}${sich.verfahren ? `, verschlüsselt (${sich.verfahren})` : ''}`)
      : nein(sich.zeit ? `letzte Nachtsicherung ${sich.zeit.slice(0, 10)} — nicht frisch` : 'Zeit der letzten Sicherung unbekannt');

  const offen = (tasks?.tasks ?? []).filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const ueberfaellig = offen.filter(t => t.dueDate && t.dueDate < heute).length;

  const firmen = (plan?.firmen ?? []).filter(f => (f as { id?: string }).id !== 'privat');
  const ohneStand = firmen.filter(f => f.kontostand == null).length;
  const offeneZahlungen = (plan?.zahlungen ?? []).filter(z => z.status === 'offen' && (z as { firmaId?: string }).firmaId !== 'privat');
  const ohneFrist = offeneZahlungen.filter(z => !z.faellig).length;

  const horizonte = ['jahr', 'quartal', 'monat', 'woche'] as const;
  const gesetzt = horizonte.filter(h => (ziele?.fokus?.[h] ?? '').trim()).length;
  const reglerEigen = Object.keys(kompass?.eigene ?? {}).length;

  return {
    sicherung,
    'zwei-faktor-pflicht': konten?.einstellungen?.zweiFaktorPflichtSeit ? ja('Pflicht ist an') : nein('Pflicht ist noch aus'),
    kalender: (cal?.events?.length ?? 0) > 0 ? ja(`${cal!.events!.length} Termine`) : nein('kein Kalender verbunden'),
    kontakte: (netz?.kontakte?.length ?? 0) > 0 ? ja(`${netz!.kontakte!.length} Kontakte`) : nein('keine Kontakte'),
    aufgaben: ueberfaellig === 0 ? ja(`${offen.length} offen, nichts überfällig`) : nein(`${ueberfaellig} überfällig von ${offen.length}`),
    kompass: kompass?.modus && reglerEigen >= 3
      ? ja(`Lage ${kompass.modus}, ${reglerEigen} Regler eigen gestellt`)
      : nein(kompass?.modus ? `Lage ${kompass.modus}, aber nur ${reglerEigen} Regler gestellt` : 'noch nicht gestellt'),
    fokus: gesetzt >= 3 ? ja(`${gesetzt} von 4 Horizonten gesetzt`) : nein(`nur ${gesetzt} von 4 Horizonten gesetzt`),
    ziele: (finance?.zielUmsatz ?? 0) > 0 && finance?.startMonat != null
      ? ja(`Ziel steht, Start ab Monat ${finance.startMonat + 1}`)
      : nein('Jahresziel oder Startmonat fehlt'),
    agenten: Object.keys(agenten ?? {}).length >= 6
      ? ja(`${Object.keys(agenten!).length} Agenten eingestellt`)
      : nein(`erst ${Object.keys(agenten ?? {}).length} eingestellt`),
    konten: firmen.length && ohneStand === 0 ? ja(`${firmen.length} Konten gepflegt`) : nein(`${ohneStand} von ${firmen.length} Konten ohne Stand`),
    posten: offeneZahlungen.length === 0
      ? ja('keine offenen Posten')
      : ohneFrist === 0 ? ja(`${offeneZahlungen.length} offen, alle mit Frist`) : nein(`${ohneFrist} von ${offeneZahlungen.length} ohne Fälligkeit`),
  };
}

/**
 * Alle Befunde — die gemeinsamen für den Haushalt, die persönlichen NUR für `person` (Person der Sitzung).
 * Ohne Person (Systemlauf) gibt es keine persönlichen Befunde.
 */
export async function pruefeAlles(person: string | null): Promise<Record<string, Befund>> {
  const [g, p] = await Promise.all([gemeinsam(), person && PERSON.test(person) ? persoenlich(person) : Promise.resolve({})]);
  return { ...g, ...p };
}

/** Wie weit das Onboarding insgesamt ist — für die Kachel auf der Startfläche. */
export async function fortschritt(person: string | null): Promise<{ fertig: number; gesamt: number; offeneMinuten: number }> {
  const [handisch, befunde] = await Promise.all([loadJson<Handisch>("onboarding"), pruefeAlles(person)]);
  const erledigt = handisch?.erledigt ?? {};
  const fertigeSchritte = SCHRITTE.filter(s => (s.pruefung && befunde[s.pruefung]?.erfuellt) || !!erledigt[s.id]);
  const offen = SCHRITTE.filter(s => !fertigeSchritte.includes(s));
  return { fertig: fertigeSchritte.length, gesamt: SCHRITTE.length, offeneMinuten: offen.reduce((n, s) => n + s.minuten, 0) };
}
