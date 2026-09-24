// ─── Prüfliste: Privates in den Business-Speichern ──────────────────────────
// Vor dem Umzug lagen private Posten mitten in den Firmen-Speichern:
// die Firma „privat“ im Finanzplan, private Zahlungen und Kredite, private
// Buchungen, ein privater Planposten. Die Business-Rechnung ignoriert sie seit
// 24.09. — hier werden sie aufgeräumt: gegen die Haushaltsdaten abgeglichen,
// mit Vorschlag, und erst nach eurer Entscheidung je Eintrag verschoben.
// Nichts geht still verloren: vorher wird archiviert.

import type { Haushalt } from './typen';
import { normal } from './regeln';

export type Quelle = 'firma' | 'zahlung' | 'merkposten' | 'rechnung' | 'buchung' | 'planposten';
export type Aktion = 'dublette' | 'uebernehmen' | 'entfernen' | 'behalten' | 'kdv' | 'kdc' | 'kemaris';
export const AKTION_TEXT: Record<Aktion, string> = {
  dublette: 'ist schon im Haushalt — aus Business entfernen',
  uebernehmen: 'in den Haushalt übernehmen',
  entfernen: 'entfernen (wird archiviert)',
  behalten: 'so lassen',
  kdv: 'gehört zu KD Ventures', kdc: 'gehört zur Selbstständigkeit', kemaris: 'gehört zu Kemaris',
};

export interface Pruefposten {
  quelle: Quelle; id: string; titel: string; unter: string; betrag: number | null; datum: string | null;
  vorschlag: Aktion; aktionen: Aktion[]; treffer: string | null; grund: string;
}

export interface Businessbestand {
  finanzplan: { firmen?: { id: string; name: string; kontostand: number | null }[]; zahlungen?: { id: string; an: string; titel: string; betrag: number; status: string; faellig?: string; firmaId?: string }[]; merkposten?: { id: string; titel: string; betrag: number; art: string; notiz?: string; firmaId?: string }[]; rechnungen?: { id: string; kunde: string; titel: string; betrag: number; status: string; faellig?: string; firmaId?: string }[] } | null;
  buchungen: { buchungen?: { id: string; datum: string; wer?: string; betrag: number; kategorie?: string; zweck?: string; ort?: string }[] } | null;
  liquiplan: { posten?: { id: string; titel: string; betrag: number; rhythmus: string; firmaId?: string; kategorie?: string }[] } | null;
}

const cent = (euro: number) => Math.round((Number(euro) || 0) * 100);
const aehnlich = (a: string, b: string) => { const x = normal(a), y = normal(b); if (!x || !y) return false; return x.includes(y) || y.includes(x) || x.split(' ')[0] === y.split(' ')[0]; };

export function pruefliste(b: Businessbestand, h: Haushalt): Pruefposten[] {
  const raus: Pruefposten[] = [];
  const fp = b.finanzplan ?? {};
  for (const f of fp.firmen ?? []) {
    if (f.id !== 'privat') continue;
    raus.push({ quelle: 'firma', id: f.id, titel: f.name, unter: 'Konto „Privat“ im Finanzplan der Firmen', betrag: f.kontostand === null ? null : cent(f.kontostand), datum: null, vorschlag: 'entfernen', aktionen: ['entfernen', 'behalten'], treffer: null, grund: 'Der Haushalt führt keine Kontostände — er rechnet aus den Buchungen.' });
  }
  for (const z of fp.zahlungen ?? []) {
    if (z.firmaId !== 'privat') continue;
    const beleg = h.belege.find(x => x.art === 'rechnung' && aehnlich(x.empfaenger ?? x.bezeichnung, z.an) && x.betrag !== null && Math.abs(x.betrag - cent(z.betrag)) <= 50);
    const offen = z.status === 'offen';
    raus.push({ quelle: 'zahlung', id: z.id, titel: z.an, unter: `${z.titel}${z.faellig ? ` · fällig ${z.faellig}` : ''} · ${z.status}`, betrag: cent(z.betrag), datum: z.faellig ?? null,
      vorschlag: beleg ? 'dublette' : offen ? 'uebernehmen' : 'entfernen', aktionen: ['dublette', 'uebernehmen', 'entfernen', 'behalten'],
      treffer: beleg ? `Rechnung „${beleg.bezeichnung}“ im Haushalt` : null, grund: beleg ? 'Gleicher Empfänger, gleicher Betrag.' : offen ? 'Offene private Zahlung — gehört unter „Offene Rechnungen“.' : 'Erledigt — nur noch Ballast.' });
  }
  for (const m of fp.merkposten ?? []) {
    if (m.firmaId !== 'privat') continue;
    const schuld = h.schulden.find(s => aehnlich(s.bezeichnung, m.titel) || Math.abs(s.restbetrag - Math.abs(cent(m.betrag))) <= 100);
    raus.push({ quelle: 'merkposten', id: m.id, titel: m.titel, unter: `${m.art}${m.notiz ? ` · ${m.notiz}` : ''}`, betrag: cent(m.betrag), datum: null,
      vorschlag: schuld ? 'dublette' : m.art === 'kredit' ? 'uebernehmen' : 'entfernen', aktionen: ['dublette', 'uebernehmen', 'entfernen', 'behalten'],
      treffer: schuld ? `Schuld „${schuld.bezeichnung}“ im Haushalt` : null, grund: schuld ? 'Gleicher Name oder gleicher Restbetrag.' : 'Privater Kredit — gehört unter „Schulden“.' });
  }
  for (const r of fp.rechnungen ?? []) {
    if (r.firmaId !== 'privat') continue;
    raus.push({ quelle: 'rechnung', id: r.id, titel: r.kunde, unter: `${r.titel} · ${r.status}`, betrag: cent(r.betrag), datum: r.faellig ?? null, vorschlag: 'entfernen', aktionen: ['entfernen', 'behalten'], treffer: null, grund: 'Private Forderung im Firmen-Finanzplan.' });
  }
  for (const x of b.buchungen?.buchungen ?? []) {
    const ort = x.ort ?? 'privat';
    if (ort !== 'privat') continue;
    const c = cent(x.betrag);
    const gleich = h.buchungen.find(hb => hb.datum === x.datum && Math.sign(hb.betrag) === Math.sign(c) && Math.abs(hb.betrag - c) <= 50);
    raus.push({ quelle: 'buchung', id: x.id, titel: x.zweck || x.kategorie || 'Buchung', unter: `${x.datum} · ${x.wer ?? ''} · ${x.kategorie ?? ''}`.replace(/ · $/, ''), betrag: c, datum: x.datum,
      vorschlag: gleich ? 'dublette' : h.stamm.konten.length ? 'uebernehmen' : 'behalten', aktionen: h.stamm.konten.length ? ['dublette', 'uebernehmen', 'entfernen', 'behalten'] : ['entfernen', 'behalten'],
      treffer: gleich ? `„${gleich.empfaenger}“ am selben Tag im Haushalt` : null, grund: gleich ? 'Gleiches Datum, Betrag bis 0,50 € gleich (alte Buchungen waren gerundet).' : h.stamm.konten.length ? 'Im Haushalt nicht gefunden.' : 'Erst den Umzug machen — dann erkennt die Liste Doppelte.' });
  }
  for (const p of b.liquiplan?.posten ?? []) {
    const privat = p.firmaId === 'privat' || p.kategorie === 'privat';
    if (!privat && p.firmaId) continue;
    raus.push({ quelle: 'planposten', id: p.id, titel: p.titel, unter: `${p.rhythmus}${privat ? ' · privat' : ' · ohne Firma'}`, betrag: cent(p.betrag), datum: null,
      vorschlag: privat ? 'entfernen' : 'behalten', aktionen: privat ? ['entfernen', 'behalten'] : ['kdv', 'kdc', 'kemaris', 'entfernen', 'behalten'], treffer: null,
      grund: privat ? 'Privater Planposten — der Haushalt plant über „Ist gegen Soll“ und Budgets.' : 'Ohne Firma zählt er als Business. Bitte zuordnen.' });
  }
  return raus;
}
