// ─── Unternehmen › Schild: Marken, Domains, Versicherungen — Laufzeiten, Verlängerung, Kündigung (rein, client-sicher, 10.10.) ──
// Research › 4a–4c. Gespeichert: was auf der Urkunde, beim Registrar bzw. in der Police steht. GERECHNET: Schutzende einer Marke
// (§ 47 Abs. 1 MarkenG: 10 Jahre ab Anmeldetag, endet am letzten Tag des Monats; EUIPO/WIPO: 10 Jahre ab Anmeldetag), Verlängerungsfenster
// (6 Monate vorher), Nachfrist (6 Monate danach), Ende der Benutzungsschonfrist (5 Jahre, § 26 MarkenG); Domain-Ablauf; bei Versicherungen
// die laufende Periode (stillschweigende Verlängerung, § 11 Abs. 1 VVG höchstens 1 Jahr), „kündigen bis“ (Frist 1–3 Monate, § 11 Abs. 3)
// und das Sonderkündigungsrecht nach drei Jahren (§ 11 Abs. 4 VVG). Nie Passwörter oder Zugangskennungen. Hinweis, keine Rechtsberatung.

import { aktiveEintraege } from '@/lib/gesellschaften/modell';
import type { Domain, Marke, SchildGesellschaft, Versicherung } from './typen';
import { jahrePlus, monatePlus, monatsletzter, tagePlus } from './zeit';

export const VORGABE_VERLAENGERUNG_MONATE = 12;
export const VORGABE_KUENDIGUNGSFRIST_MONATE = 3;
/** Vorlauf der Erinnerungen (Tage vor dem Stichtag). */
export const SCHUTZ_VORLAUF = { domain: 30, versicherung: 30, marke: 0 } as const;

// ── Marken ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface MarkeFristen {
  schutzEnde?: string;
  /** Verlängerung ab (6 Monate vor Schutzende) — Antrag/Zahlung ist ab hier möglich. */
  verlaengerungAb?: string;
  /** Nachfrist (6 Monate nach Schutzende, mit Zuschlag). */
  nachfristBis?: string;
  /** Ende der Benutzungsschonfrist (5 Jahre) — danach Benutzung nachweisen. */
  schonfristEnde?: string;
  /** Schonfrist aus dem Eintragungstag + 3 Monate geschätzt (Widerspruchsende fehlt). */
  schonfristGeschaetzt?: true;
  zustand: 'ok' | 'verlaengern' | 'nachfrist' | 'abgelaufen' | 'unbekannt';
}

export function markeFristen(m: Marke, heute: string): MarkeFristen {
  let schutzEnde = m.schutzBis;
  if (!schutzEnde && m.anmeldetag) {
    const zehn = jahrePlus(m.anmeldetag, 10);
    schutzEnde = (m.amt ?? 'dpma') === 'dpma' ? monatsletzter(Number(zehn.slice(0, 4)), Number(zehn.slice(5, 7))) : zehn;
  }
  const widerspruch = m.widerspruchsEnde ?? (m.eintragungstag ? monatePlus(m.eintragungstag, 3) : undefined);
  const schon = widerspruch ? jahrePlus(widerspruch, 5) : undefined;
  const basis = { ...(schon ? { schonfristEnde: schon } : {}), ...(!m.widerspruchsEnde && m.eintragungstag ? { schonfristGeschaetzt: true as const } : {}) };
  if (!schutzEnde) return { ...basis, zustand: 'unbekannt' };
  const verlaengerungAb = monatePlus(schutzEnde, -6), nachfristBis = monatePlus(schutzEnde, 6);
  const zustand = heute > nachfristBis ? 'abgelaufen' : heute > schutzEnde ? 'nachfrist' : heute >= verlaengerungAb ? 'verlaengern' : 'ok';
  return { ...basis, schutzEnde, verlaengerungAb, nachfristBis, zustand };
}

// ── Domains ──────────────────────────────────────────────────────────────────────────────────────────────────────

export function domainZustand(d: Domain, heute: string): 'ok' | 'bald' | 'abgelaufen' | 'unbekannt' {
  if (!d.laeuftBis) return 'unbekannt';
  if (d.laeuftBis < heute) return d.autoVerlaengerung ? 'bald' : 'abgelaufen';
  return tagePlus(d.laeuftBis, -SCHUTZ_VORLAUF.domain) <= heute ? 'bald' : 'ok';
}

// ── Versicherungen ───────────────────────────────────────────────────────────────────────────────────────────────

export interface PoliceFristen {
  /** Ende der laufenden Periode (nach stillschweigenden Verlängerungen). */
  periodeEnde?: string;
  kuendigenBis?: string;
  /** Sonderkündigung nach § 11 Abs. 4 VVG möglich (Vertrag länger als drei Jahre). */
  sonderkuendigung?: string;
  zustand: 'ok' | 'kuendigen-bald' | 'gekuendigt' | 'abgelaufen' | 'unbekannt';
}

export function policeFristen(v: Versicherung, heute: string): PoliceFristen {
  if (v.gekuendigtZum) return { periodeEnde: v.gekuendigtZum, zustand: v.gekuendigtZum < heute ? 'abgelaufen' : 'gekuendigt' };
  if (!v.ablauf) return { zustand: 'unbekannt' };
  const schritt = Math.min(12, Math.max(1, v.verlaengerungMonate ?? VORGABE_VERLAENGERUNG_MONATE));
  const frist = Math.min(3, Math.max(1, v.kuendigungsfristMonate ?? VORGABE_KUENDIGUNGSFRIST_MONATE));
  let ende = v.ablauf;
  // Stillschweigende Verlängerung: die laufende Periode ist die erste, die nach „heute − Frist“ endet (sonst ist die Kündigung schon vorbei).
  for (let i = 0; i < 600 && monatePlus(ende, -frist) < heute; i++) ende = monatePlus(ende, schritt);
  const kuendigenBis = monatePlus(ende, -frist);
  const lang = v.beginn && jahrePlus(v.beginn, 3) < ende;
  return {
    periodeEnde: ende, kuendigenBis,
    ...(lang ? { sonderkuendigung: 'Vertrag länger als drei Jahre: zum Ende des dritten und jedes weiteren Jahres mit drei Monaten kündbar (§ 11 Abs. 4 VVG).' } : {}),
    zustand: tagePlus(kuendigenBis, -SCHUTZ_VORLAUF.versicherung) <= heute ? 'kuendigen-bald' : 'ok',
  };
}

// ── Stichtage für Kalender und Erinnerung ────────────────────────────────────────────────────────────────────────

export interface SchutzStichtag { id: string; tag: string; titel: string; art: 'marke' | 'domain' | 'versicherung'; eintragId: string; kuendigung?: true; vorlauf: number }

/** Alle Stichtage aus Marken, Domains, Versicherungen einer Gesellschaft (rein). */
export function schutzStichtage(s: SchildGesellschaft | null | undefined, heute: string): SchutzStichtag[] {
  const raus: SchutzStichtag[] = [];
  for (const m of aktiveEintraege(s?.marken)) {
    const f = markeFristen(m, heute);
    if (f.verlaengerungAb) raus.push({ id: `mk-verl-${m.id}`, tag: f.verlaengerungAb, titel: `Marke verlängern ab: ${m.bezeichnung}`, art: 'marke', eintragId: m.id, vorlauf: SCHUTZ_VORLAUF.marke });
    if (f.schutzEnde) raus.push({ id: `mk-ende-${m.id}`, tag: f.schutzEnde, titel: `Markenschutz endet: ${m.bezeichnung}`, art: 'marke', eintragId: m.id, kuendigung: true, vorlauf: 60 });
    if (f.schonfristEnde) raus.push({ id: `mk-schon-${m.id}`, tag: f.schonfristEnde, titel: `Benutzungsschonfrist endet: ${m.bezeichnung}`, art: 'marke', eintragId: m.id, vorlauf: 30 });
  }
  for (const d of aktiveEintraege(s?.domains)) {
    if (d.laeuftBis) raus.push({ id: `dm-${d.id}`, tag: d.laeuftBis, titel: `${d.autoVerlaengerung ? 'Domain verlängert sich' : 'Domain läuft ab'}: ${d.domain}`, art: 'domain', eintragId: d.id, ...(d.autoVerlaengerung ? {} : { kuendigung: true as const }), vorlauf: SCHUTZ_VORLAUF.domain });
  }
  for (const v of aktiveEintraege(s?.versicherungen)) {
    const f = policeFristen(v, heute);
    const name = [v.versicherer, v.vertragsNr ? `Nr. ${v.vertragsNr}` : undefined].filter(Boolean).join(' · ');
    const art = v.art;
    if (f.kuendigenBis && f.zustand !== 'gekuendigt') raus.push({ id: `vs-kuend-${v.id}`, tag: f.kuendigenBis, titel: `Versicherung kündigen bis: ${artLabel(art)}${name ? ` (${name})` : ''}`, art: 'versicherung', eintragId: v.id, kuendigung: true, vorlauf: SCHUTZ_VORLAUF.versicherung });
    if (f.periodeEnde) raus.push({ id: `vs-ende-${v.id}`, tag: f.periodeEnde, titel: `${f.zustand === 'gekuendigt' ? 'Versicherung endet' : 'Versicherungsperiode endet'}: ${artLabel(art)}`, art: 'versicherung', eintragId: v.id, vorlauf: 0 });
  }
  return raus;
}

const ARTEN: Record<string, string> = {
  betriebshaftpflicht: 'Betriebshaftpflicht', vermoegensschaden: 'Vermögensschaden-Haftpflicht', do: 'D&O', cyber: 'Cyber', inhalt: 'Inhalt/Elektronik',
  rechtsschutz: 'Rechtsschutz', keyperson: 'Key-Person', kfz: 'Kfz', sonstige: 'Versicherung',
};
export const artLabel = (a: string) => ARTEN[a] ?? 'Versicherung';
