// ─── Buchhaltung — Export-CSV je Gesellschaft und Zeitraum (02.11., rein) ──────────────────────────────────────────────────────────────
// Für die Steuerberatung bzw. die eigene Ablage — bewusst KEIN DATEV-Format (Hinweis, keine Steuerberatung). Semikolon + BOM (Excel öffnet es
// richtig), jedes Feld in Anführungszeichen, Formel-Anfänge neutralisiert wie der Kunden-Export (lib/crm/besuche.ts `csvFeld`) — eine Zahl mit
// Minus bleibt eine Zahl. Konto nur mit maskierter IBAN. Nichts wird gekürzt: der Export trägt jede Buchung des Filters.

import { ibanMaskiert } from '@/lib/crm/zahlung';
import { finanzOrtName, type FinanzOrt } from '@/lib/einheiten';
import type { BhBuchung } from './arbeitsliste';

export const EXPORT_SPALTEN = ['Datum', 'Betrag', 'Gegenseite', 'Verwendungszweck', 'Kategorie', 'Gesellschaft', 'Konto', 'Rechnung', 'Notiz'] as const;

/** Ein CSV-Feld: Anführungszeichen, innere verdoppelt, Zeilenumbrüche zu Leerzeichen, Formel-Anfänge (= + - @ Tab) mit `'` — außer reine Beträge. */
export function feld(v: string | number | undefined): string {
  const t = String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
  const zahl = /^-?\d{1,3}(\.\d{3})*,\d{2}$|^-?\d+,\d{2}$/.test(t);
  const sicher = !zahl && /^[=+\-@\t]/.test(t) ? `'${t}` : t;
  return `"${sicher.replace(/"/g, '""')}"`;
}

/** Betrag in deutscher Schreibweise auf den Cent (1234.5 → „1.234,50“, −12.5 → „-12,50“). */
export function betragDe(euro: number): string {
  const c = Math.round(Number(euro) * 100);
  const abs = Math.abs(c);
  const ganz = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${c < 0 ? '-' : ''}${ganz},${String(abs % 100).padStart(2, '0')}`;
}
const tagDe = (d: string) => d.split('-').reverse().join('.');

export interface ExportWissen {
  /** Kontoname (wie an der Buchung) → IBAN aus dem Konten-Register (wird nur maskiert ausgegeben). */
  kontoIban?: ReadonlyMap<string, string>;
  /** Rechnungs-Kennung → Nummer. */
  rechnungNummer?: ReadonlyMap<string, string>;
}

/** Die CSV (mit BOM). Reihenfolge: wie übergeben (die Route sortiert nach Datum aufsteigend). */
export function exportCsv(liste: readonly BhBuchung[], w: ExportWissen = {}): string {
  const zeilen = [EXPORT_SPALTEN.map(s => feld(s)).join(';')];
  for (const b of liste) {
    const iban = b.konto ? w.kontoIban?.get(b.konto) : undefined;
    const konto = b.konto ? `${b.konto}${iban && ibanMaskiert(iban) ? ` (${ibanMaskiert(iban)})` : ''}` : '';
    const rechnung = b.rechnungId ? w.rechnungNummer?.get(b.rechnungId) ?? b.rechnungId : '';
    zeilen.push([tagDe(b.datum), betragDe(b.betrag), b.wer, b.zweck, b.kategorie, b.ort ? finanzOrtName(b.ort as FinanzOrt) : '', konto, rechnung, b.notiz].map(feld).join(';'));
  }
  return `\uFEFF${zeilen.join('\r\n')}\r\n`;
}

/** Dateiname ohne Namen: Gesellschafts-Kennung + Zeitraum. */
export function exportName(orte: readonly string[], von?: string, bis?: string): string {
  const o = orte.length === 1 ? orte[0] : 'gesellschaften';
  const z = von || bis ? `-${von ?? 'anfang'}-bis-${bis ?? 'heute'}` : '';
  return `buchungen-${o}${z}.csv`.replace(/[^a-z0-9.-]/gi, '-');
}
