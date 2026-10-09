// ─── Ist-Stand Finanzen — die Checkliste (24.09., für den 25.09.) ───────────
// Kevin: „dass wir morgen abend einen klaren Ist-Stand haben, an dem wir
// arbeiten können.“ Klar heißt prüfbar: jeder Punkt ist aus den Daten
// abgeleitet (nicht abgehakt), sagt, was fehlt, wer es tut und wo.
// Plattform-Regel (09.10., KI-Etiketten K4): keine festen Personen mehr — „wer“ ist der Speichername der zuständigen Person aus den Konten
// (Inhaber der Instanz) oder „beide“ (alle Personen des Haushalts); `werName` ist der Anzeigename aus dem Konto. Vorher standen hier zwei
// feste Namen und ein Schritt „<Person> hat Zugang zum Haushalt“.
import { WEG } from '@/lib/wege';
import { finanzOrtName } from '@/lib/einheiten';

export interface Schritt {
  id: string; bereich: 'privat' | 'business' | 'gemeinsam';
  titel: string; erledigt: boolean; detail: string;
  /** Speichername der zuständigen Person (aus den Konten) oder „beide“ = alle Personen des Haushalts. */
  wer: string;
  /** Anzeigename dazu („beide“ bleibt „beide“). */
  werName: string;
  link: string;
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
    /** Konten der Instanz ohne Haushalt und ohne „nur Business“ — noch nicht eingeordnet (fehlt = 0). */
    ohneHaushalt?: number;
  } | null;
  /** Wer die Inhaber-Schritte macht — aus den Konten (Speichername + Vorname); fehlt = „beide“. */
  inhaber?: { kennung: string; name: string } | null;
}

const tage = (von: string, bis: string) => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von.slice(0, 10)}T12:00:00Z`)) / 864e5);

export function istStand(e: IstStandEingaben): Schritt[] {
  const s: Schritt[] = [];
  const h = e.haushalt;
  // Inhaber-Schritte gehen an die Person mit der Rolle Inhaber (aus den Konten), Haushalts-Schritte an alle („beide“).
  const inhaber = e.inhaber ? { wer: e.inhaber.kennung, werName: e.inhaber.name } : { wer: 'beide', werName: 'beide' };
  const alle = { wer: 'beide', werName: 'beide' };
  if (h) {
    s.push({ id: 'umzug', bereich: 'privat', titel: 'Haushaltsdaten aus dem früheren Cockpit übernommen', erledigt: h.umzug && h.buchungen > 0, ...alle, link: '/os/finanzen?s=privat',
      detail: h.umzug ? `${h.buchungen} Buchungen übernommen` : 'Finanzen › Privat › „Übernahme aus dem Altsystem“ — Probelauf, dann Übernehmen' });
    const alt = h.letzteBuchung ? tage(h.letzteBuchung, e.heute) : null;
    s.push({ id: 'auszuege', bereich: 'privat', titel: 'Kontoauszüge bis heute eingelesen', erledigt: alt !== null && alt <= 7, ...alle, link: '/os/finanzen?s=privat&t=buchungen',
      detail: alt === null ? 'noch keine Buchungen' : alt <= 7 ? `letzte Buchung vor ${alt} Tagen` : `letzte Buchung vor ${alt} Tagen — Kontoauszüge seitdem einlesen` });
    const anteil = h.buchungen ? h.ohneKategorie / h.buchungen : 1;
    s.push({ id: 'zuordnung', bereich: 'privat', titel: 'Buchungen zugeordnet', erledigt: h.buchungen > 0 && anteil <= 0.05, ...alle, link: '/os/finanzen?s=privat&t=buchungen',
      detail: h.buchungen ? `${h.ohneKategorie} ohne Kategorie (${Math.round(anteil * 100)} %) — Ziel höchstens 5 %` : 'kommt nach dem Umzug' });
    s.push({ id: 'entflechtung', bereich: 'gemeinsam', titel: 'Private Einträge aus den Business-Listen geräumt', erledigt: h.pruefposten === 0, ...inhaber, link: '/os/finanzen?s=privat',
      detail: h.pruefposten ? `${h.pruefposten} Einträge zu entscheiden — „Aufräumen“ in der Leiste unter Privat` : 'nichts mehr offen' });
    s.push({ id: 'steuerquote', bereich: 'gemeinsam', titel: 'Steuerrücklage als Annahme gesetzt', erledigt: h.steuerquote !== null, ...inhaber, link: '/os/finanzen?s=gesamt',
      detail: h.steuerquote !== null ? `${h.steuerquote} % vom Gewinn` : 'Finanzen › Gesamt — sonst gibt es keinen Mindestumsatz' });
    // Vorher „<feste Person> hat Zugang zum Haushalt“ — jetzt: jedes Konto der Instanz ist eingeordnet (Haushalt oder „nur Business“).
    const offen = h.ohneHaushalt ?? 0;
    s.push({ id: 'zugang', bereich: 'gemeinsam', titel: 'Alle Konten dem Haushalt zugeordnet', erledigt: offen === 0 && h.mitglieder.length > 0, ...inhaber, link: '/os/konto',
      detail: offen ? `${offen} Konto${offen > 1 ? 'en' : ''} ohne Haushalt — unter Konto einem Haushalt zuweisen oder auf „nur Business“ stellen` : `${h.mitglieder.length} Konto${h.mitglieder.length === 1 ? '' : 'en'} im Haushalt` });
  }
  const konten = e.firmen.filter(f => f.id !== 'privat');
  const unklar = konten.filter(f => f.kontostand === null || !f.stand || tage(f.stand, e.heute) > 7);
  s.push({ id: 'kontostaende', bereich: 'business', titel: 'Kontostände aller Firmenkonten, höchstens 7 Tage alt', erledigt: konten.length > 0 && !unklar.length, ...inhaber, link: WEG.liquiditaet(),
    detail: unklar.length ? `offen: ${unklar.map(f => `${f.name} (${f.kontostand === null ? 'kein Stand' : !f.stand ? 'ohne Datum' : `vom ${f.stand.slice(8, 10)}.${f.stand.slice(5, 7)}.`})`).join(', ')}` : 'alle aktuell' });
  const ohneFrist = e.offeneRechnungen.filter(r => !r.faellig);
  s.push({ id: 'rechnungen', bereich: 'business', titel: 'Offene Rechnungen mit Fälligkeit', erledigt: !ohneFrist.length, ...inhaber, link: WEG.rechnungen(),
    detail: ohneFrist.length ? `ohne Fälligkeit: ${ohneFrist.map(r => r.kunde).join(', ')}` : `${e.offeneRechnungen.length} offen, alle mit Datum` });
  s.push({ id: 'controlling', bereich: 'business', titel: 'Controlling-Monate gepflegt', erledigt: e.leereControllingMonate !== null && !e.leereControllingMonate.length, ...inhaber, link: WEG.controlling(),
    detail: e.leereControllingMonate === null ? 'noch kein Controlling' : e.leereControllingMonate.length ? `es fehlen: ${e.leereControllingMonate.join(', ')}` : 'alle Monate seit Start da' });
  const gAlt = e.grundlageStand ? tage(e.grundlageStand, e.heute) : null;
  s.push({ id: 'grundlage', bereich: 'business', titel: 'Business-Grundlage (V1-Export) aktuell', erledigt: gAlt !== null && gAlt <= 14, ...alle, link: WEG.grundlage(),
    detail: gAlt === null ? 'kein Export geladen' : gAlt <= 14 ? `Stand vor ${gAlt} Tagen` : `Stand vor ${gAlt} Tagen — neuen Export laden` });
  s.push({ id: 'planung', bereich: 'business', titel: 'Liquiditätsplanung geklärt', erledigt: e.planposten > 0 && e.zuKlaeren === 0, ...alle, link: WEG.liquiditaet(),
    detail: !e.planposten ? 'keine Planposten' : e.zuKlaeren ? `${e.zuKlaeren} Posten „zu klären“ — bestätigen (sicher) oder streichen` : `${e.planposten} Posten, alle geklärt` });
  // Namen der Gesellschaften aus lib/einheiten.ts (je Instanz) — nie fest im Code.
  const rf = [e.rechtsform.kdv ? null : finanzOrtName('kdv'), e.rechtsform.kdc ? null : finanzOrtName('kdc')].filter(Boolean);
  s.push({ id: 'rechtsform', bereich: 'business', titel: 'Rechtsform und Steuer-Annahmen', erledigt: !rf.length, ...inhaber, link: '/os/finanzen?s=chef',
    detail: rf.length ? `Rechtsform fehlt: ${rf.join(', ')}` : 'eingetragen — USt-Rhythmus und Vorauszahlungen mit dem Steuerberater prüfen' });
  return s;
}
