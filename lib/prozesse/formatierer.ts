// ─── Feste Formatierer der Textvorlagen (rein, client-sicher, ohne Abhängigkeiten) ─────────────────────────────────────────────────────────────
// EINE Stelle für `{{feld | datum}}` & Co. — die Werkstatt (lib/prozesse/baustein-katalog.ts) und die Texte je Produkt (lib/crm/vorlage-platzhalter.ts:
// Einleitung, Begleit-Mail, Willkommensmail) formatieren gleich. 25.10. (kleine Bauten) aus baustein-katalog.ts hierher gezogen, damit die Produkt-Texte
// nicht den ganzen Katalog laden; baustein-katalog.ts reicht alles unverändert weiter. Kein Nutzer-Code — nur diese festen Namen.

export type FormatiererId = 'datum' | 'datum-lang' | 'betrag' | 'zahl' | 'gross' | 'klein';
export const FORMATIERER: readonly { id: FormatiererId; titel: string; beispiel: string }[] = [
  { id: 'datum', titel: 'Datum', beispiel: '24.10.2026' },
  { id: 'datum-lang', titel: 'Datum mit Wochentag', beispiel: 'Samstag, 24. Oktober 2026' },
  { id: 'betrag', titel: 'Betrag (aus Cent)', beispiel: '1.234,50 €' },
  { id: 'zahl', titel: 'Zahl', beispiel: '1.234' },
  { id: 'gross', titel: 'GROSS', beispiel: 'TEXT' },
  { id: 'klein', titel: 'klein', beispiel: 'text' },
];
export const FORMATIERER_IDS: ReadonlySet<string> = new Set<string>(FORMATIERER.map(f => f.id));
export const istFormatierer = (x: string | undefined): x is FormatiererId => !!x && FORMATIERER_IDS.has(x);
const TAG = /^(\d{4})-(\d{2})-(\d{2})/;
/** Einen Wert formatieren (rein, deutsch, Berliner Kalendertag aus `YYYY-MM-DD`). Unpassender Wert → als Text. */
export function formatieren(art: FormatiererId, wert: unknown): string {
  const text = wert === undefined || wert === null ? '' : String(wert);
  switch (art) {
    case 'datum': { const m = TAG.exec(text); return m ? `${m[3]}.${m[2]}.${m[1]}` : text; }
    case 'datum-lang': {
      const m = TAG.exec(text);
      if (!m) return text;
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
      return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
    }
    case 'betrag': { const n = typeof wert === 'number' ? wert : Number(text); return Number.isFinite(n) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Math.round(n) / 100) : text; }
    case 'zahl': { const n = typeof wert === 'number' ? wert : Number(text); return Number.isFinite(n) ? new Intl.NumberFormat('de-DE').format(n) : text; }
    case 'gross': return text.toLocaleUpperCase('de-DE');
    case 'klein': return text.toLocaleLowerCase('de-DE');
  }
}
