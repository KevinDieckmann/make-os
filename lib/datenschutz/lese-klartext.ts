// ─── Lese-Protokoll in Klartext (17.10., Abnahme 3 · C4) ─────────────────────────────────────────────────────────────────────────
// Das Lese-Protokoll speichert je Zugriff den Weg (Pfad der Schnittstelle bzw. `zoe:<werkzeug>`) und Speichernamen — für die Nachweise gut,
// in der Oberfläche aber Technik („lena · /api/gesundheit/koerper“, „Daten von lena“). System › Nachweise zeigt deshalb Klartext:
// den Bereich und das, was gelesen wurde („Gesundheit · Körper-Profil“), und Personen mit dem Namen aus dem Konto. Gespeichert wird
// weiter dasselbe (Hash-Kette, Art. 15) — übersetzt wird nur die Antwort. Rein, Server und Browser.

/** Was hinter einem Weg steht — ohne Pfad. Neue lesende Route mit `leseZugriff` → eine Zeile hier (sonst der allgemeine Rückfall). */
const WEGE: Record<string, string> = {
  '/api/agenten': 'Agenten · Läufe',
  '/api/agenten/faden': 'Agenten · Gespräch',
  '/api/business/eroeffnung': 'Business · 0-Punkt',
  '/api/crm/bestand': 'Markttraktion · Bestand',
  '/api/crm/datenschutz': 'Markttraktion · Datenschutz',
  '/api/crm/gesellschaften': 'Gesellschaften · Absender',
  '/api/crm/planung': 'Markttraktion · Planung',
  '/api/crm/treppe': 'Leistungstreppe',
  '/api/crm/treppe/report': 'Leistungstreppe · Report',
  '/api/finanzen/konten': 'Finanzen · Konten',
  '/api/finanzen/konten/auszug': 'Finanzen · Kontoauszug',
  '/api/finanzplan': 'Finanzen · Planung',
  '/api/fulfillment': 'Fulfillment',
  '/api/fulfillment/cockpit': 'Fulfillment · Lage',
  '/api/fulfillment/dossier': 'Fulfillment · Dossier',
  '/api/fulfillment/fall': 'Fulfillment · Fall',
  '/api/fulfillment/kunde': 'Fulfillment · Kundenseite',
  '/api/fulfillment/kunde/datei': 'Fulfillment · Datei für den Kunden',
  '/api/fulfillment/kunde/vorschau': 'Fulfillment · Vorschau der Kundenseite',
  '/api/fulfillment/personen': 'Fulfillment · Personen',
  '/api/fulfillment/wirkung': 'Fulfillment · Wirkung',
  '/api/gesellschaften': 'Gesellschaften',
  '/api/gesellschaften/beschluesse': 'Gesellschaften · Beschlüsse',
  '/api/gesellschaften/recht': 'Gesellschaften · Recht',
  '/api/gesellschaften/schild': 'Gesellschaften · Übersicht',
  '/api/gesellschaften/unterlagen': 'Gesellschaften · Unterlagen',
  '/api/gesundheit/alltag': 'Gesundheit · Alltag',
  '/api/gesundheit/erholung': 'Gesundheit · Erholung',
  '/api/gesundheit/index': 'Gesundheit · Index',
  '/api/gesundheit/koerper': 'Gesundheit · Körper-Profil',
  '/api/gesundheit/stand': 'Gesundheit · Stand',
  '/api/gesundheit/unterlagen': 'Gesundheit · Unterlagen',
  '/api/haushalt': 'Finanzen · Haushalt',
  '/api/inbox/ablegen': 'Inbox · Ablegen',
  '/api/inbox/anhang': 'Inbox · Anhang',
  '/api/inbox/gespraech': 'Inbox · Gespräch',
  '/api/inbox/suche': 'Inbox · Suche',
  '/api/inbox/uebergaben': 'Inbox · Übergaben',
  '/api/kapazitaet': 'Planung · Kapazität',
  '/api/medien': 'Medien',
  '/api/medien/beleg': 'Medien · Beleg',
  '/api/medien/inhalt': 'Medien · Original',
  '/api/rechnung': 'Finanzen · Rechnungen',
  '/api/sport': 'Gesundheit · Sport',
  '/api/state/ernaehrung': 'Gesundheit · Ernährung',
  '/api/state/finanzplan': 'Finanzen · Rechnungen & Konten',
  '/api/state/haut': 'Gesundheit · Haut-Tagebuch',
  '/api/state/health': 'Gesundheit · Routinen',
  '/api/state/kontakte': 'Kontakte · Kartei',
  '/api/state/kunden': 'Kontakte · Kunden',
  '/api/state/streak': 'Gesundheit · Serie',
  '/api/state/vitals': 'Gesundheit · Vitalwerte',
  '/api/whoop/status': 'Gesundheit · WHOOP',
};

const gross = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** „/api/gesundheit/koerper“ → „Gesundheit · Körper-Profil“; „zoe:fulfillment_lage“ → „ZOE · fulfillment lage“; nie ein Pfad in der Anzeige. */
export function wegKlartext(weg: string | null | undefined): string | null {
  if (!weg) return null;
  if (weg.startsWith('zoe:')) return `ZOE · ${weg.slice(4).replace(/[_-]+/g, ' ').trim()}`;
  const pfad = weg.split('?')[0].replace(/\/+$/, '');
  if (WEGE[pfad]) return WEGE[pfad];
  // Rückfall: die Teile des Weges ohne „/api“ und „state“, groß geschrieben — lesbar, ohne Schrägstriche.
  const teile = pfad.split('/').filter(t => t && t !== 'api' && t !== 'state' && !/^[a-z]+-[0-9a-f-]{8,}$/.test(t));
  return teile.length ? teile.map(t => gross(t.replace(/[_-]+/g, ' '))).join(' · ') : null;
}

/** Ein Speichername → der Name aus dem Konto (Vorname), sonst neutral; „[gelöscht]“ bleibt. */
export function personKlartext(speicher: string | null | undefined, namen: Readonly<Record<string, string>>): string | null {
  if (!speicher) return null;
  if (speicher === '[gelöscht]') return 'gelöschtes Konto';
  return namen[speicher] ?? 'ein Konto ohne Namen';
}
