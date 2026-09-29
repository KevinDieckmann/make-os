// ─── Kalender — Termine zu einem Kontakt, einer Firma, einem Deal, einem Mandat (rein, 30.09., Paket K3) ─
// Die Akten im CRM zeigen kommende und vergangene Termine — gelesen NUR über den Bezug (`kalender-bezug`: Kennungen +
// Gast-Kontakte), nie über den Namen im Titel. Hier die reine Auswahl + Form; der Server (app/api/kalender/bezug) liest
// die Termine ohne Abgleich (`termineLesen`) und maskiert private Termine der anderen Person („Belegt“, ohne Bezug →
// fallen hier heraus).

import type { TerminMitBezug } from './bezug';
import type { Teilnehmer } from './gaeste';

export interface TermineZuFrage { kontakte?: readonly string[]; firmen?: readonly string[]; deals?: readonly string[]; mandate?: readonly string[] }

/** Ein Termin in der Akte — Zeit, Ort, Titel aus dem Termin; Klick öffnet ihn im Kalender (`WEG.termin`). */
export interface AkteTermin {
  id: string; uid: string; titel: string; start: string; ende: string; ganztags: boolean; ort?: string; kalender: string;
  vergangen: boolean; serie: boolean;
  bezug: { kontaktId?: string; firmaId?: string; dealId?: string; mandatId?: string };
  gastKontakte?: string[];
  /** Zusagen/Absagen (nur Status und Name — die Adressen bleiben im Kalender). */
  antworten?: Pick<Teilnehmer, 'status' | 'name'>[];
  /** Abgesagt (STATUS:CANCELLED oder selbst abgelehnt) — steht in der Liste, ist aber nie der „nächste Termin“. */
  abgesagt?: true;
}

/** Passt ein Termin zur Frage? (Kontakt direkt oder als Gast, Firma, Deal, Mandat) */
export function passtZu(t: Pick<TerminMitBezug, 'bezug' | 'gastKontakte'>, f: TermineZuFrage): boolean {
  const b = t.bezug ?? {};
  const k = new Set(f.kontakte ?? []);
  if (k.size && ((b.kontaktId && k.has(b.kontaktId)) || (t.gastKontakte ?? []).some(x => k.has(x)))) return true;
  if (b.firmaId && (f.firmen ?? []).includes(b.firmaId)) return true;
  if (b.dealId && (f.deals ?? []).includes(b.dealId)) return true;
  if (b.mandatId && (f.mandate ?? []).includes(b.mandatId)) return true;
  return false;
}

/** Auswahl + Form für die Akte: kommende aufsteigend, vergangene absteigend, je höchstens `max`. `jetzt` = Berliner Wandzeit. */
export function termineZu(termine: readonly TerminMitBezug[], f: TermineZuFrage, jetztWand: string, max = 20): { kommend: AkteTermin[]; vergangen: AkteTermin[] } {
  const passend = termine.filter(t => !t.maskiert && passtZu(t, f)).map(t => {
    const vergangen = (t.ganztags ? t.ende.slice(0, 10) <= jetztWand.slice(0, 10) : t.ende <= jetztWand);
    const antworten = (t.teilnehmer ?? []).map(x => ({ status: x.status, ...(x.name ? { name: x.name } : {}) }));
    return {
      id: t.id, uid: t.uid, titel: t.titel, start: t.start, ende: t.ende, ganztags: t.ganztags, ...(t.ort ? { ort: t.ort } : {}), kalender: t.kalender,
      vergangen, serie: t.serie, bezug: { ...(t.bezug?.kontaktId ? { kontaktId: t.bezug.kontaktId } : {}), ...(t.bezug?.firmaId ? { firmaId: t.bezug.firmaId } : {}), ...(t.bezug?.dealId ? { dealId: t.bezug.dealId } : {}), ...(t.bezug?.mandatId ? { mandatId: t.bezug.mandatId } : {}) },
      ...(t.gastKontakte?.length ? { gastKontakte: t.gastKontakte } : {}), ...(antworten.length ? { antworten } : {}),
      ...(t.abgesagt ? { abgesagt: true as const } : {}),
    } satisfies AkteTermin;
  });
  return {
    kommend: passend.filter(t => !t.vergangen).sort((a, b) => a.start.localeCompare(b.start)).slice(0, max),
    vergangen: passend.filter(t => t.vergangen).sort((a, b) => b.start.localeCompare(a.start)).slice(0, max),
  };
}

/**
 * Der nächste Termin einer Akte (Kalender-Gesamtprüfung F3, 29.09.): der früheste kommende, der nicht abgesagt ist.
 * EINE Quelle für den Kopf der Kontaktakte, die Karteikarte und den Verlauf — dieselbe Auswahl wie die Liste
 * (`termineZu`, über den Bezug, maskiert je Person). Der frühere Zwischenspeicher `crm-signale.kommend` ist abgelöst.
 */
export function naechsterTermin(kommend: readonly AkteTermin[]): AkteTermin | null {
  return kommend.find(t => !t.abgesagt) ?? null;
}
