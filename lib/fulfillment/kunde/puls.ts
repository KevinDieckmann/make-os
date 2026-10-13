// ─── Fulfillment · Kunde — Kunden-Puls (rein, client-sicher; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.5) ─────────────────────────────────────────────
// Eine Puls-Anfrage (`pa-…`) entsteht beim Senden eines Reports (5.2) oder von Hand — mit EIGENEM Token (Fragment `#p=…`), 14 Tage gültig, nimmt EINE
// Antwort an. Eine neue Anfrage schließt eine noch offene desselben Mandats (der neueste Link gilt). Antwort: ganze Zahl 0–10 + optional ein Satz
// (≤ 500 Zeichen, sonst 413 — nie gekürzt). Ein Wert bis zur Schwelle (Vorgabe 6, `pulsStufe` in lib/fulfillment/regeln.ts) löst auf dem Server
// eine neutrale Glocke und einen Stapel-Vorschlag „Gespräch anbieten“ aus (lib/fulfillment/kunde/server.ts) — hier wird nur gerechnet.

import { tagePlus } from '@/lib/zeit';
import { TEXT_MAX, KENNUNG, MANDAT_ID } from '../grenzen';
import type { AnwendenErgebnis, KundeDatei, Puls, PulsAnfrage } from '../typen';

/** So viele Tage nimmt eine Puls-Anfrage eine Antwort an. */
export const PULS_TAGE = 14;

/** Die offene Anfrage eines Mandats (nicht beantwortet, heute noch gültig) — die jüngste. */
export function offeneAnfrage(d: Pick<KundeDatei, 'pulsAnfragen'>, mandatId: string, heute: string): PulsAnfrage | null {
  return d.pulsAnfragen.filter(a => a.mandatId === mandatId && !a.beantwortetAm && a.offenBis >= heute).sort((a, b) => (a.erstelltAm < b.erstelltAm ? 1 : -1))[0] ?? null;
}

/** Der jüngste Puls eines Mandats (Link oder von Hand). */
export function letzterPuls(d: Pick<KundeDatei, 'puls'>, mandatId: string): Puls | null {
  return d.puls.filter(p => p.mandatId === mandatId).sort((a, b) => (a.am < b.am ? 1 : a.am > b.am ? -1 : a.id < b.id ? 1 : -1))[0] ?? null;
}

/** Wert und Satz prüfen (ganze Zahl 0–10, Satz ≤ 500 Zeichen). */
export function pulsPruefen(wert: unknown, satz: unknown): { ok: true; wert: number; satz?: string } | { ok: false; status: 400 | 413; fehler: string } {
  if (typeof wert !== 'number' || !Number.isInteger(wert) || wert < 0 || wert > 10) return { ok: false, status: 400, fehler: 'Bitte eine Zahl von 0 bis 10 wählen.' };
  if (satz !== undefined && satz !== null && typeof satz !== 'string') return { ok: false, status: 400, fehler: 'Der Satz ist kein Text.' };
  const s = typeof satz === 'string' ? satz.replace(/\r\n?/g, '\n').trim() : '';
  if (s.length > TEXT_MAX.pulsSatz) return { ok: false, status: 413, fehler: `Der Satz hat höchstens ${TEXT_MAX.pulsSatz} Zeichen (jetzt ${s.length}). Nichts gespeichert.` };
  return { ok: true, wert, ...(s ? { satz: s } : {}) };
}

/** Neue Anfrage anlegen; eine offene desselben Mandats gilt ab dann nicht mehr (offen bis gestern). */
export function anfrageAnlegen(d: KundeDatei, a: { id: string; mandatId: string; tokenHash: string; jetzt: string; heute: string }): AnwendenErgebnis<KundeDatei> {
  if (!KENNUNG.pulsAnfrage.test(a.id) || !MANDAT_ID.test(a.mandatId) || !/^[a-f0-9]{64}$/.test(a.tokenHash)) return { ok: false, status: 400, fehler: 'Unzulässige Puls-Anfrage.' };
  const gestern = tagePlus(a.heute, -1);
  const geaendert: string[] = [];
  const alt = d.pulsAnfragen.map(x => {
    if (x.mandatId !== a.mandatId || x.beantwortetAm || x.offenBis < a.heute) return x;
    geaendert.push(x.id);
    return { ...x, offenBis: gestern };
  });
  const neu: PulsAnfrage = { id: a.id, mandatId: a.mandatId, tokenHash: a.tokenHash, erstelltAm: a.jetzt, offenBis: tagePlus(a.heute, PULS_TAGE) };
  return { ok: true, datei: { ...d, pulsAnfragen: [...alt, neu] }, geaendert: [...geaendert, a.id] };
}

/** Antwort über den Link annehmen — genau einmal je Anfrage. */
export function pulsAnnehmen(d: KundeDatei, e: { anfrageId: string; id: string; wert: unknown; satz?: unknown; jetzt: string; heute: string }): AnwendenErgebnis<KundeDatei> & { puls?: Puls } {
  const i = d.pulsAnfragen.findIndex(a => a.id === e.anfrageId);
  if (i < 0) return { ok: false, status: 404, fehler: 'Diese Puls-Anfrage gibt es nicht (mehr).' };
  const a = d.pulsAnfragen[i];
  if (a.beantwortetAm) return { ok: false, status: 409, fehler: 'Danke — eure Antwort ist schon da.' };
  if (a.offenBis < e.heute) return { ok: false, status: 404, fehler: 'Diese Puls-Anfrage ist abgelaufen.' };
  const p = pulsPruefen(e.wert, e.satz);
  if (!p.ok) return p;
  if (!KENNUNG.puls.test(e.id)) return { ok: false, status: 400, fehler: 'Unzulässige Kennung.' };
  const puls: Puls = { id: e.id, mandatId: a.mandatId, am: e.jetzt, wert: p.wert, ...(p.satz ? { satz: p.satz } : {}), anfrageId: a.id, quelle: 'link' };
  const anfragen = [...d.pulsAnfragen];
  anfragen[i] = { ...a, beantwortetAm: e.jetzt };
  return { ok: true, datei: { ...d, pulsAnfragen: anfragen, puls: [...d.puls, puls] }, geaendert: [a.id, puls.id], puls };
}

/** Puls von Hand (z. B. im Wochen-Check erfragt). */
export function pulsHand(d: KundeDatei, e: { mandatId: string; id: string; wert: unknown; satz?: unknown; am: string }): AnwendenErgebnis<KundeDatei> & { puls?: Puls } {
  if (!MANDAT_ID.test(e.mandatId)) return { ok: false, status: 400, fehler: 'Unzulässige Mandat-Kennung.' };
  const p = pulsPruefen(e.wert, e.satz);
  if (!p.ok) return p;
  if (!KENNUNG.puls.test(e.id)) return { ok: false, status: 400, fehler: 'Unzulässige Kennung.' };
  const puls: Puls = { id: e.id, mandatId: e.mandatId, am: e.am, wert: p.wert, ...(p.satz ? { satz: p.satz } : {}), quelle: 'hand' };
  return { ok: true, datei: { ...d, puls: [...d.puls, puls] }, geaendert: [puls.id], puls };
}

/**
 * Die Puls-Frage als eigene, kurze Mail (12.10., Fulfillment extern) — wenn sie nicht mit dem 2-Wochen-Report rausgeht. Du/Sie nach der Akte (ohne
 * Angabe Sie), ein Satz, ein Klick. Versendet wird NICHTS: die Oberfläche kopiert den Text, gesendet wird per Klick aus dem eigenen Postfach.
 */
export function pulsMail(e: { anrede?: 'Du' | 'Sie'; vorname?: string; nachname?: string; link: string; absender?: string }): { betreff: string; text: string } {
  const du = e.anrede === 'Du';
  const gruss = du ? `Hey${e.vorname ? ` ${e.vorname}` : ''},` : e.nachname ? `Guten Tag ${[e.vorname, e.nachname].filter(Boolean).join(' ')},` : 'Guten Tag,';
  const text = du ? [
    gruss, '', 'eine kurze Frage, die uns hilft, noch besser zu werden: Wie zufrieden bist du gerade mit unserer Zusammenarbeit — von 0 bis 10?', '',
    'Ein Klick genügt, es dauert keine Minute:', e.link, '', 'Danke dir!', 'Viele Grüße', ...(e.absender ? [e.absender] : []),
  ] : [
    gruss, '', 'eine kurze Frage, die uns hilft, noch besser zu werden: Wie zufrieden sind Sie gerade mit unserer Zusammenarbeit — von 0 bis 10?', '',
    'Ein Klick genügt, es dauert keine Minute:', e.link, '', 'Vielen Dank!', 'Freundliche Grüße', ...(e.absender ? [e.absender] : []),
  ];
  return { betreff: 'Eine kurze Frage zu unserer Zusammenarbeit', text: text.join('\n') };
}

/** Puls-Werte eines Mandats, jüngste zuerst (für die interne Ansicht). */
export const pulsListe = (d: Pick<KundeDatei, 'puls'>, mandatId: string): Puls[] =>
  d.puls.filter(p => p.mandatId === mandatId).sort((a, b) => (a.am < b.am ? 1 : a.am > b.am ? -1 : 0));
