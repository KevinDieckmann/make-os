// ─── Traktions-Index — die Quellen außerhalb des CRM-Bestands (rein, 02.11., Marketing-Projekt M3) ─────────────────────────────────────
// Kevin 01.11.: „Zahlen stimmen nicht ganz: Social zählt im Traktions-Index nicht, … Kampagnen-Mails fehlen.“ Zwei Quellen kommen neben der
// Website (lib/crm/webseite-zahlen.ts) hinzu — jede nur als Zähler, Kennung und eigener Titel, nie Adressen oder Texte Dritter:
//   social  veröffentlichte Social-Folgen (Marketing › Social, Bestand `social--<haushalt>`) — sie zählen in „Veröffentlichungen · 7 Tage“
//           (EINE Zählung mit Redaktionsplan und Newsletter: `veroeffentlichungen` in lib/crm/marketing.ts, verknüpfte Folgen nur einmal)
//   motor   gesendete Mails des Kampagnen-Motors (Mail-Stapel, Bestand `kampagnen-post--<haushalt>`) und Antworten darauf — zwei eigene
//           Kennzahlen in Marketing, nur im Modell, wenn der Motor schon einmal gesendet hat (sonst bleibt der Index genau der bisherige)
// Geladen über EINE Stelle (lib/crm/traktion-quellen-server.ts `traktionQuellenLaden`) für alle Aufrufer des Index.

import type { Kpi, KpiAmpel } from './kennzahlen';
import type { Detail } from '@/lib/kennzahlen/kern';
import type { SocialVeroeffentlichung } from './marketing';
import type { Kampagne } from './typen';
import { WEG } from '@/lib/wege';

export interface SocialStand { posts: SocialVeroeffentlichung[] }

/** Eine gesendete Mail des Mail-Stapels — nur Tag, Kampagne und ob eine Antwort kam. */
export interface MotorMail { kampagneId: string; tag: string; antwort: boolean }
export interface MotorStand { mails: MotorMail[] }

export const MOTOR_TAGE = 30;
/** Antwortquote erst ab so vielen gesendeten Mails im Fenster — darunter ist es Rauschen. */
export const MOTOR_MINDEST = 5;

const tagMinus = (heute: string, n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const stufe = (v: number, gruen: number, gelb: number): KpiAmpel => (v >= gruen ? 'gruen' : v >= gelb ? 'gelb' : 'rot');
const pz = (q: number) => `${String(Number(q.toFixed(1))).replace('.', ',')} %`;

/** Läuft der Motor (hat er je gesendet)? Nur dann gehören seine Kennzahlen ins Modell. */
export const motorAktiv = (m: MotorStand | undefined): boolean => !!m && m.mails.length > 0;

/** Nur Mails von Kampagnen, die es (noch) gibt — eine Kampagne im Papierkorb zählt nicht mehr. */
export function motorImBestand(m: MotorStand | undefined, kampagnen: readonly Pick<Kampagne, 'id'>[]): MotorStand | undefined {
  if (!m) return m;
  const da = new Set(kampagnen.map(k => k.id));
  return { mails: m.mails.filter(x => da.has(x.kampagneId)) };
}

const imFenster = (m: MotorStand, heute: string) => { const ab = tagMinus(heute, MOTOR_TAGE - 1); return m.mails.filter(x => x.tag >= ab && x.tag <= heute); };

/** Die zwei Kennzahlen (Kpi-Form) — ohne laufenden Motor „grau“ (Lücke). Die Quote ist in Prozent (0–100). */
export function motorKennzahlen(m: MotorStand | undefined, heute: string): Kpi[] {
  const grau = (id: string, label: string, ziel: string): Kpi => ({ id, label, wert: null, anzeige: '—', ampel: 'grau', ziel, quelle: 'Der Mail-Stapel hat noch nichts gesendet' });
  if (!motorAktiv(m)) return [grau('motor_gesendet', 'Kampagnen-Mails gesendet · 30 Tage', '≥ 20'), grau('motor_antworten', 'Antwortquote Kampagnen-Mails · 30 Tage', '≥ 5 %')];
  const l = imFenster(m!, heute);
  const antworten = l.filter(x => x.antwort).length;
  const q = l.length >= MOTOR_MINDEST ? (antworten / l.length) * 100 : null;
  return [
    { id: 'motor_gesendet', label: 'Kampagnen-Mails gesendet · 30 Tage', wert: l.length, anzeige: String(l.length), ampel: stufe(l.length, 20, 5), ziel: '≥ 20', quelle: 'Mail-Stapel des Kampagnen-Motors (nur nach Freigabe gesendet)' },
    q === null
      ? { id: 'motor_antworten', label: 'Antwortquote Kampagnen-Mails · 30 Tage', wert: null, anzeige: '—', ampel: 'grau', ziel: '≥ 5 %', quelle: `Quote erst ab ${MOTOR_MINDEST} gesendeten Mails in 30 Tagen (${l.length} gesendet, ${antworten} Antworten)` }
      : { id: 'motor_antworten', label: 'Antwortquote Kampagnen-Mails · 30 Tage', wert: q, anzeige: pz(q), ampel: stufe(q, 5, 2), ziel: '≥ 5 %', quelle: `${antworten} Antworten auf ${l.length} gesendete Mails` },
  ];
}

/** Die Punkte dahinter: je Kampagne gesendet · Antworten (höchstens 4, mit Weg). */
export function motorDetails(m: MotorStand | undefined, heute: string, kampagnen: readonly Pick<Kampagne, 'id' | 'name'>[]): Detail[] {
  if (!motorAktiv(m)) return [];
  const l = imFenster(m!, heute);
  const name = new Map(kampagnen.map(k => [k.id, k.name]));
  const je = new Map<string, { n: number; a: number }>();
  for (const x of l) { const z = je.get(x.kampagneId) ?? { n: 0, a: 0 }; z.n++; if (x.antwort) z.a++; je.set(x.kampagneId, z); }
  return Array.from(je.entries()).sort((a, b) => b[1].n - a[1].n).slice(0, 4)
    .map(([id, z]) => ({ titel: name.get(id) ?? 'Kampagne', wert: `${z.n} gesendet`, unter: `${z.a} ${z.a === 1 ? 'Antwort' : 'Antworten'}`, href: WEG.kampagne(id) }));
}
