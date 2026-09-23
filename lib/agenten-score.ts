// ─── MAKE OS — Der Agenten-Score ────────────────────────────────────────────
// Kevin, 24.09.: „Ich möchte oben bei den Scores auch noch einen Agenten-Score
// mit reinnehmen." — Die sechste Säule des Wachstums-Scores: Wie viel nehmen
// Jarvis und die Agenten wirklich ab? Fünf Faktoren, alle aus vorhandenen
// Daten, nichts erfunden:
//   Agenten live        · wie viele der gebauten Agenten laufen
//   Läufe diese Woche   · Einträge im Agenten-Log der letzten 7 Tage
//   Aufträge erledigt   · fertige gegen fehlgeschlagene Aufträge des Arbeiters
//   Stapel fließt       · bleiben Vorschläge liegen (ab 6 offenen wird es eng)
//   Bote erreicht dich  · ist Telegram gekoppelt
// Reine Rechnung ohne Dateizugriff — testbar. Das Laden steht in performance.ts.

export interface Faktor { label: string; wert: number; echt: boolean; quelle: string }

export interface AgentenEingabe {
  agenten: { live: number; gesamt: number };
  laeufe7: number;
  auftraege7: { fertig: number; fehler: number };
  stapel: { offen: number; entschieden7: number };
  bote: { konfiguriert: boolean; gekoppelt: boolean };
}

/** Zwei Läufe je Tag gelten als voller Betrieb. */
export const LAEUFE_ZIEL_7 = 14;
/** Bis hierhin gilt der Stapel als „fließt"; jeder weitere offene Vorschlag kostet zehn Punkte. */
export const STAPEL_OK = 5;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function agentenFaktoren(e: AgentenEingabe): Faktor[] {
  const a = e.auftraege7.fertig + e.auftraege7.fehler;
  const hatStapel = e.stapel.offen + e.stapel.entschieden7 > 0;
  return [
    { label: 'Agenten live', wert: e.agenten.gesamt ? clamp((e.agenten.live / e.agenten.gesamt) * 100) : 0, echt: e.agenten.gesamt > 0,
      quelle: `${e.agenten.live} von ${e.agenten.gesamt} Agenten live` },
    { label: 'Läufe diese Woche', wert: clamp((e.laeufe7 / LAEUFE_ZIEL_7) * 100), echt: e.laeufe7 > 0,
      quelle: e.laeufe7 ? `${e.laeufe7} Läufe in 7 Tagen (voller Betrieb ab ${LAEUFE_ZIEL_7})` : 'kein Lauf in 7 Tagen' },
    { label: 'Aufträge erledigt', wert: a ? clamp((e.auftraege7.fertig / a) * 100) : 0, echt: a > 0,
      quelle: a ? `${e.auftraege7.fertig} von ${a} Aufträgen fertig${e.auftraege7.fehler ? `, ${e.auftraege7.fehler} mit Fehler` : ''}` : 'kein Auftrag in 7 Tagen' },
    { label: 'Stapel fließt', wert: hatStapel ? clamp(100 - Math.max(0, e.stapel.offen - STAPEL_OK) * 10) : 0, echt: hatStapel,
      quelle: hatStapel ? `${e.stapel.offen} offen, ${e.stapel.entschieden7} in 7 Tagen entschieden` : 'noch kein Vorschlag im Stapel' },
    { label: 'Bote erreicht dich', wert: e.bote.gekoppelt ? 100 : 0, echt: e.bote.konfiguriert,
      quelle: !e.bote.konfiguriert ? 'kein Telegram-Token — Konto → Bote' : e.bote.gekoppelt ? 'Telegram gekoppelt' : 'Telegram noch nicht gekoppelt' },
  ];
}

/** Aus den Rohbeständen die Eingabe der letzten sieben Tage (heute eingeschlossen). */
export function agentenEingabe(roh: {
  agenten: { status: string }[];
  log: { ts: string }[];
  auftraege: { zeit: string; status: string }[];
  vorschlaege: { zeit?: string; status: string; entschiedenAm?: string }[];
  boteKonfiguriert: boolean;
  boteGekoppelt: boolean;
}, heute: string): AgentenEingabe {
  const start = new Date(`${heute}T12:00:00`); start.setDate(start.getDate() - 6);
  const ab = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const inWoche = (iso?: string) => !!iso && iso.slice(0, 10) >= ab && iso.slice(0, 10) <= heute;
  const auftraege = roh.auftraege.filter(x => inWoche(x.zeit));
  return {
    agenten: { live: roh.agenten.filter(x => x.status === 'live').length, gesamt: roh.agenten.length },
    laeufe7: roh.log.filter(x => inWoche(x.ts)).length,
    auftraege7: { fertig: auftraege.filter(x => x.status === 'fertig').length, fehler: auftraege.filter(x => x.status === 'fehler').length },
    stapel: { offen: roh.vorschlaege.filter(v => v.status === 'offen').length, entschieden7: roh.vorschlaege.filter(v => v.status !== 'offen' && inWoche(v.entschiedenAm ?? v.zeit)).length },
    bote: { konfiguriert: roh.boteKonfiguriert, gekoppelt: roh.boteGekoppelt },
  };
}
