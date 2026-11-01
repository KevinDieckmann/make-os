// ─── Funde — Lage je Firma (31.10.2026): Vertriebsleitung mit Beleg, Bedarf, Potenzial, Segment, Lead-Score ───────────────────────
// Rein. Eingabe sind nur öffentliche Signale (Team-/Über-uns-Seite, Stellenanzeigen, Presse-Titel, Website-Merkmale, offene Register).
// Keine Namen, keine Profile Einzelner — nur Rollen, Zahlen und Quellen-Adressen.

export type VertriebsleitungStatus = 'besetzt' | 'gesucht' | 'team-ohne-leitung' | 'keine-sichtbar' | 'unbekannt';
export type LageSegment = 'jetzt' | 'aufbauen' | 'beobachten' | 'kein-fokus';

export const VERTRIEBSLEITUNG_TEXT: Record<VertriebsleitungStatus, string> = {
  besetzt: 'besetzt',
  gesucht: 'wird gesucht',
  'team-ohne-leitung': 'Vertrieb ohne sichtbare Leitung',
  'keine-sichtbar': 'keine sichtbar',
  unbekannt: 'unbekannt',
};
export const SEGMENT_TEXT: Record<LageSegment, string> = {
  jetzt: 'Jetzt ansprechen',
  aufbauen: 'Aufbauen',
  beobachten: 'Beobachten (Vertrieb steht)',
  'kein-fokus': 'Kein Fokus',
};

/** Die Regeln, so wie `lageBewerten` und `leadScoreTief` sie rechnen — zum Anzeigen. */
export const LAGE_REGELN = {
  vertriebsleitung: 'Beleg-Leiter: besetzt (Team-/Über-uns-Seite oder Pressemeldung zur Besetzung) · wird gesucht (Stellenanzeige für die Leitung) · Vertrieb ohne sichtbare Leitung (Vertriebsstellen, Vertriebsrollen oder Vertriebskontakt, aber keine Leitung) · keine sichtbar (Team-Seite gelesen, keine Leitung) · unbekannt',
  bedarf: 'Bedarf 0–100: Leitung gesucht 35 · Vertrieb ohne Leitung 30 · keine Leitung sichtbar 25 · unbekannt 10 · Vertriebsstellen offen 15 (ab 3: 20) · Demo-Vertrieb ohne CRM 10 · Finanzierung in den letzten 12 Monaten 15 · laufendes EU-Projekt ohne Referenzen 10 · keine Referenzen 5',
  potenzial: 'Potenzial 0–100: Finanzierung in 24 Monaten 20 (ab 5 Mio. +5) · offene Stellen 5/10/15 (ab 1/3/10) · Mitarbeitende 10–49: 10, 50–249: 15, ab 250: 10 · Website-Reichweite (Tranco Top 200.000: 10, Top 1 Mio.: 5) · international 8 · ab 50 Kunden 7 · laufendes EU-Projekt 7 · Wachstums-/Pressemeldungen 8 · Innovationspreis/Auszeichnung in den letzten 2 Jahren 10 · Zertifikat 5 · Website gepflegt 5 · 2–10 Jahre alt 5 · übernommen −20',
  segment: 'Jetzt ansprechen: Bedarf ab 40 und Potenzial ab 30 (oder Bedarf ab 55 und Potenzial ab 20) · Beobachten: Vertriebsleitung besetzt · Kein Fokus: Passung unter 35 oder Bedarf unter 25 und Potenzial unter 15 · sonst Aufbauen',
  leadScore: 'Lead-Score = 45 % Passung + 25 % Bedarf + 20 % Potenzial + Erreichbarkeit (Handy 10 · Festnetz 6 · nur Mail 3)',
} as const;

export interface LageSignale {
  /** ICP-Passung 0–100. */
  passung: number;
  /** Ergebnis der Team-Seite. */
  vertriebsleitungTeam?: 'ja' | 'nein' | 'unbekannt';
  rolleTeam?: string;
  teamUrl?: string;
  /** Leitungsrolle auf einer Über-uns-/Management-Seite. */
  leitungWebsite?: { rolle: string; url: string };
  /** Pressemeldung zur Besetzung der Vertriebsleitung. */
  leitungPresse?: { titel: string; datum: string; url?: string };
  /** Stellenanzeige für die Vertriebsleitung. */
  leitungGesucht?: { titel: string; url?: string };
  stellen?: number;
  vertriebsstellen?: number;
  vertriebRollen?: number;
  vertriebKontakt?: boolean;
  crm?: boolean;
  demoGefuehrt?: boolean;
  belege?: boolean;
  /** Jüngste Finanzierungsmeldung (Tag JJJJ-MM-TT, Betrag „12 Mio.“). */
  finanzierung?: { datum: string; betrag?: string };
  uebernahme?: boolean;
  wachstumsMeldungen?: number;
  euLaufend?: number;
  tranco?: number;
  versionen12?: number;
  international?: boolean;
  laender?: number;
  kunden?: number;
  mitarbeitende?: number;
  zertifikate?: number;
  /** Jüngste Innovations-Auszeichnung (Preis, Wettbewerb, Ranking) laut Quelle. */
  auszeichnung?: { jahr: number; titel: string };
  gruendungsjahr?: number;
  /** Stichtag JJJJ-MM-TT. */
  heute: string;
}

export interface Lage {
  vertriebsleitung: VertriebsleitungStatus;
  /** Woran es zu sehen ist (Rolle bzw. Meldungs-/Stellentitel), mit Quelle. */
  beleg?: { text: string; url?: string };
  bedarf: number;
  potenzial: number;
  segment: LageSegment;
  /** Die Lage in einem Satz. */
  satz: string;
  gruendeBedarf: string[];
  gruendePotenzial: string[];
}

const monateZwischen = (von: string, bis: string) => (Date.parse(bis) - Date.parse(von)) / (30.44 * 864e5);
const mio = (b?: string) => { const m = /^(\d+(?:[.,]\d+)?)\s*(Mio|Mrd)/.exec(b ?? ''); return m ? Number(m[1].replace(',', '.')) * (m[2] === 'Mrd' ? 1000 : 1) : 0; };

export function vertriebsleitungStatus(s: LageSignale): { status: VertriebsleitungStatus; beleg?: Lage['beleg'] } {
  if (s.leitungWebsite) return { status: 'besetzt', beleg: { text: `${s.leitungWebsite.rolle} (Website)`, url: s.leitungWebsite.url } };
  if (s.vertriebsleitungTeam === 'ja') return { status: 'besetzt', beleg: { text: `${s.rolleTeam ?? 'Vertriebsleitung'} (Team-Seite)`, url: s.teamUrl } };
  if (s.leitungPresse) return { status: 'besetzt', beleg: { text: `Pressemeldung ${s.leitungPresse.datum}: ${s.leitungPresse.titel}`, url: s.leitungPresse.url } };
  if (s.leitungGesucht) return { status: 'gesucht', beleg: { text: `Stellenanzeige: ${s.leitungGesucht.titel}`, url: s.leitungGesucht.url } };
  if ((s.vertriebsstellen ?? 0) > 0 || (s.vertriebRollen ?? 0) > 0 || s.vertriebKontakt) {
    const teile = [(s.vertriebsstellen ?? 0) > 0 && `${s.vertriebsstellen} Vertriebsstelle${s.vertriebsstellen === 1 ? '' : 'n'} offen`, (s.vertriebRollen ?? 0) > 0 && 'Vertriebsrollen auf der Website', s.vertriebKontakt && 'Vertriebskontakt'].filter(Boolean);
    return { status: 'team-ohne-leitung', beleg: { text: teile.join(', ') } };
  }
  if (s.vertriebsleitungTeam === 'nein') return { status: 'keine-sichtbar', beleg: { text: 'Team-Seite gelesen, keine Vertriebsleitung', url: s.teamUrl } };
  return { status: 'unbekannt' };
}

/** Vertriebsleitung, Bedarf, Potenzial, Segment und Satz aus öffentlichen Signalen. */
export function lageBewerten(s: LageSignale): Lage {
  const { status, beleg } = vertriebsleitungStatus(s);
  const gb: string[] = [], gp: string[] = [];
  let b = 0, p = 0;
  const B = (ok: unknown, n: number, satz: string) => { if (ok) { b += n; gb.push(satz); } };
  const P = (ok: unknown, n: number, satz: string) => { if (ok) { p += n; gp.push(satz); } };
  B(status === 'gesucht', 35, 'sucht eine Vertriebsleitung');
  B(status === 'team-ohne-leitung', 30, 'verkauft ohne sichtbare Vertriebsleitung');
  B(status === 'keine-sichtbar', 25, 'keine Vertriebsleitung sichtbar');
  B(status === 'unbekannt', 10, 'Vertriebsleitung unbekannt');
  const vs = s.vertriebsstellen ?? 0;
  B(vs >= 3, 20, `${vs} Vertriebsstellen offen`);
  B(vs > 0 && vs < 3, 15, `${vs} Vertriebsstelle${vs === 1 ? '' : 'n'} offen`);
  B(s.demoGefuehrt && !s.crm, 10, 'Demo-Vertrieb ohne erkennbares CRM');
  const fMon = s.finanzierung ? monateZwischen(s.finanzierung.datum, s.heute) : Infinity;
  B(fMon <= 12, 15, 'frisch finanziert — Umsatzdruck');
  B((s.euLaufend ?? 0) > 0 && !s.belege, 10, 'EU-Projekt läuft, noch keine Referenzen');
  B(!s.belege, 5, 'keine Referenzen auf der Website');

  P(fMon <= 24, 20, `Finanzierung ${s.finanzierung?.datum.slice(0, 7)}${s.finanzierung?.betrag ? ` (${s.finanzierung.betrag})` : ''}`);
  P(fMon <= 24 && mio(s.finanzierung?.betrag) >= 5, 5, 'Runde ab 5 Mio.');
  const st = s.stellen ?? 0;
  P(st >= 10, 15, `${st} offene Stellen`);
  P(st >= 3 && st < 10, 10, `${st} offene Stellen`);
  P(st >= 1 && st < 3, 5, `${st} offene Stelle${st === 1 ? '' : 'n'}`);
  const ma = s.mitarbeitende ?? 0;
  P(ma >= 10 && ma < 50, 10, `${ma} Mitarbeitende`);
  P(ma >= 50 && ma < 250, 15, `${ma} Mitarbeitende`);
  P(ma >= 250, 10, `${ma} Mitarbeitende`);
  P(s.tranco && s.tranco <= 200_000, 10, `Website-Reichweite hoch (Tranco ${s.tranco?.toLocaleString('de-DE')})`);
  P(s.tranco && s.tranco > 200_000 && s.tranco <= 1_000_000, 5, `Website im Tranco-Ranking (${s.tranco?.toLocaleString('de-DE')})`);
  P(s.international || (s.laender ?? 0) >= 3, 8, s.laender ? `in ${s.laender} Ländern` : 'international');
  P((s.kunden ?? 0) >= 50, 7, `über ${s.kunden} Kunden`);
  P((s.euLaufend ?? 0) > 0, 7, 'laufendes EU-Projekt');
  P((s.wachstumsMeldungen ?? 0) > 0, 8, 'Wachstum in der Presse');
  P((s.zertifikate ?? 0) > 0, 5, 'Zertifikat/Siegel');
  P(s.auszeichnung && Number(s.heute.slice(0, 4)) - s.auszeichnung.jahr <= 2, 10, `${s.auszeichnung?.titel} ${s.auszeichnung?.jahr}`);
  P((s.versionen12 ?? 0) >= 3, 5, 'Website gepflegt');
  const alter = s.gruendungsjahr ? Number(s.heute.slice(0, 4)) - s.gruendungsjahr : null;
  P(alter !== null && alter >= 2 && alter <= 10, 5, `${alter} Jahre am Markt`);
  if (s.uebernahme) { p -= 20; gp.push('Übernahme gemeldet — Gruppe prüfen'); }

  const bedarf = Math.max(0, Math.min(100, b)), potenzial = Math.max(0, Math.min(100, p));
  const segment: LageSegment = status === 'besetzt' ? 'beobachten'
    : s.passung < 35 || (bedarf < 25 && potenzial < 15) ? 'kein-fokus'
      : (bedarf >= 40 && potenzial >= 30) || (bedarf >= 55 && potenzial >= 20) ? 'jetzt' : 'aufbauen';
  const kopf = { besetzt: `Vertriebsleitung besetzt (${beleg?.text.replace(/ \((Website|Team-Seite)\)$/, '') ?? ''})`, gesucht: 'sucht eine Vertriebsleitung', 'team-ohne-leitung': 'verkauft ohne sichtbare Vertriebsleitung', 'keine-sichtbar': 'keine Vertriebsleitung sichtbar', unbekannt: 'Vertriebsleitung unbekannt' }[status];
  const extra = [...gb.filter(g => /Vertriebsstelle|finanziert|Demo|EU/.test(g)), ...gp.filter(g => /Finanzierung|Stellen|Mitarbeitende|Ländern|international/.test(g))].slice(0, 3);
  const satz = `${kopf.charAt(0).toUpperCase()}${kopf.slice(1)}${extra.length ? `; ${extra.join(', ')}` : ''} — ${SEGMENT_TEXT[segment]}.`;
  return { vertriebsleitung: status, ...(beleg ? { beleg } : {}), bedarf, potenzial, segment, satz, gruendeBedarf: gb, gruendePotenzial: gp };
}

/** Lead-Score für die Ansprache (0–100): 45 % Passung + 25 % Bedarf + 20 % Potenzial + Erreichbarkeit. Ausschluss (Passung 0) → 0. */
export function leadScoreTief(passung: number, lage: Pick<Lage, 'bedarf' | 'potenzial'>, w: { mobil?: string; telefon?: string; email?: string }): number {
  if (passung <= 0) return 0;
  const erreichbar = w.mobil ? 10 : w.telefon ? 6 : w.email ? 3 : 0;
  return Math.min(100, Math.round(passung * 0.45 + lage.bedarf * 0.25 + lage.potenzial * 0.2 + erreichbar));
}
