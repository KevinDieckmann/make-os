// ─── Ist-Stand Finanzen — die Checkliste (24.09., für den 25.09.) ───────────
// Kevin: „dass wir morgen abend einen klaren Ist-Stand haben, an dem wir
// arbeiten können.“ Klar heißt prüfbar: jeder Punkt ist aus den Daten
// abgeleitet (nicht abgehakt), sagt, was fehlt, wer es tut und wo.

export interface Schritt {
  id: string; bereich: 'privat' | 'business' | 'gemeinsam';
  titel: string; erledigt: boolean; detail: string; wer: 'kevin' | 'malin' | 'beide'; link: string;
}

export interface IstStandEingaben {
  heute: string;
  firmen: { id: string; name: string; kontostand: number | null; stand: string | null }[];
  offeneRechnungen: { kunde: string; faellig?: string }[];
  leereControllingMonate: string[] | null;   // null = kein Controlling
  grundlageStand: string | null;
  planposten: number; zuKlaeren: number;
  rechtsform: { kdv: string | null; kdc: string | null };
  haushalt?: {
    umzug: boolean; buchungen: number; letzteBuchung: string | null; ohneKategorie: number;
    pruefposten: number; steuerquote: number | null; mitglieder: string[];
  } | null;
}

const tage = (von: string, bis: string) => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von.slice(0, 10)}T12:00:00Z`)) / 864e5);

export function istStand(e: IstStandEingaben): Schritt[] {
  const s: Schritt[] = [];
  const h = e.haushalt;
  if (h) {
    s.push({ id: 'umzug', bereich: 'privat', titel: 'Haushaltsdaten aus Malins Cockpit übernommen', erledigt: h.umzug && h.buchungen > 0, wer: 'beide', link: '/os/finanzen?s=privat',
      detail: h.umzug ? `${h.buchungen} Buchungen übernommen` : 'Zahlen › Privat › „Aus Malins Cockpit“ — mit dem Cockpit-Login: Probelauf, dann Übernehmen' });
    const alt = h.letzteBuchung ? tage(h.letzteBuchung, e.heute) : null;
    s.push({ id: 'auszuege', bereich: 'privat', titel: 'Kontoauszüge bis heute eingelesen', erledigt: alt !== null && alt <= 7, wer: 'malin', link: '/os/finanzen?s=privat&t=buchungen',
      detail: alt === null ? 'noch keine Buchungen' : alt <= 7 ? `letzte Buchung vor ${alt} Tagen` : `letzte Buchung vor ${alt} Tagen — N26-Auszüge seitdem einlesen` });
    const anteil = h.buchungen ? h.ohneKategorie / h.buchungen : 1;
    s.push({ id: 'zuordnung', bereich: 'privat', titel: 'Buchungen zugeordnet', erledigt: h.buchungen > 0 && anteil <= 0.05, wer: 'malin', link: '/os/finanzen?s=privat&t=buchungen',
      detail: h.buchungen ? `${h.ohneKategorie} ohne Kategorie (${Math.round(anteil * 100)} %) — Ziel höchstens 5 %` : 'kommt nach dem Umzug' });
    s.push({ id: 'entflechtung', bereich: 'gemeinsam', titel: 'Private Einträge aus den Business-Listen geräumt', erledigt: h.pruefposten === 0, wer: 'kevin', link: '/os/finanzen?s=privat',
      detail: h.pruefposten ? `${h.pruefposten} Einträge zu entscheiden — „Aufräumen“ in der Leiste unter Privat` : 'nichts mehr offen' });
    s.push({ id: 'steuerquote', bereich: 'gemeinsam', titel: 'Steuerrücklage als Annahme gesetzt', erledigt: h.steuerquote !== null, wer: 'kevin', link: '/os/finanzen?s=gesamt',
      detail: h.steuerquote !== null ? `${h.steuerquote} % vom Gewinn` : 'Zahlen › Gesamt — sonst gibt es keinen Mindestumsatz' });
    s.push({ id: 'malin', bereich: 'gemeinsam', titel: 'Malin hat Zugang zum Haushalt', erledigt: h.mitglieder.includes('malin'), wer: 'kevin', link: '/os/konto',
      detail: h.mitglieder.includes('malin') ? 'Konto mit Haushalt' : 'Einladen (Konto › Einladung), danach Haushalt „kevin-malin“ zuweisen' });
  }
  const konten = e.firmen.filter(f => f.id !== 'privat');
  const unklar = konten.filter(f => f.kontostand === null || !f.stand || tage(f.stand, e.heute) > 7);
  s.push({ id: 'kontostaende', bereich: 'business', titel: 'Kontostände aller Firmenkonten, höchstens 7 Tage alt', erledigt: konten.length > 0 && !unklar.length, wer: 'kevin', link: '/os/finanzen/liquiditaet',
    detail: unklar.length ? `offen: ${unklar.map(f => `${f.name} (${f.kontostand === null ? 'kein Stand' : !f.stand ? 'ohne Datum' : `vom ${f.stand.slice(8, 10)}.${f.stand.slice(5, 7)}.`})`).join(', ')}` : 'alle aktuell' });
  const ohneFrist = e.offeneRechnungen.filter(r => !r.faellig);
  s.push({ id: 'rechnungen', bereich: 'business', titel: 'Offene Rechnungen mit Fälligkeit', erledigt: !ohneFrist.length, wer: 'kevin', link: '/os/finanzen/planung',
    detail: ohneFrist.length ? `ohne Fälligkeit: ${ohneFrist.map(r => r.kunde).join(', ')}` : `${e.offeneRechnungen.length} offen, alle mit Datum` });
  s.push({ id: 'controlling', bereich: 'business', titel: 'Controlling-Monate gepflegt', erledigt: e.leereControllingMonate !== null && !e.leereControllingMonate.length, wer: 'kevin', link: '/os/controlling',
    detail: e.leereControllingMonate === null ? 'noch kein Controlling' : e.leereControllingMonate.length ? `es fehlen: ${e.leereControllingMonate.join(', ')}` : 'alle Monate seit Start da' });
  const gAlt = e.grundlageStand ? tage(e.grundlageStand, e.heute) : null;
  s.push({ id: 'grundlage', bereich: 'business', titel: 'Business-Grundlage (Malins V1-Export) aktuell', erledigt: gAlt !== null && gAlt <= 14, wer: 'malin', link: '/os/finanzen/grundlage',
    detail: gAlt === null ? 'kein Export geladen' : gAlt <= 14 ? `Stand vor ${gAlt} Tagen` : `Stand vor ${gAlt} Tagen — neuen Export laden` });
  s.push({ id: 'planung', bereich: 'business', titel: 'Liquiditätsplanung geklärt', erledigt: e.planposten > 0 && e.zuKlaeren === 0, wer: 'beide', link: '/os/finanzen/liquiditaet',
    detail: !e.planposten ? 'keine Planposten' : e.zuKlaeren ? `${e.zuKlaeren} Posten „zu klären“ — bestätigen (sicher) oder streichen` : `${e.planposten} Posten, alle geklärt` });
  const rf = [e.rechtsform.kdv ? null : 'KD Ventures', e.rechtsform.kdc ? null : 'Consulting'].filter(Boolean);
  s.push({ id: 'rechtsform', bereich: 'business', titel: 'Rechtsform und Steuer-Annahmen', erledigt: !rf.length, wer: 'kevin', link: '/os/finanzen?s=chef',
    detail: rf.length ? `Rechtsform fehlt: ${rf.join(', ')}` : 'eingetragen — USt-Rhythmus und Vorauszahlungen mit dem Steuerberater prüfen' });
  return s;
}
