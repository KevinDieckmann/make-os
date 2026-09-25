// ─── CRM — Export der Kartei als CSV ────────────────────────────────────────
// Für Kevins eigene Weiterverarbeitung (z. B. Brevo später). Ohne Privatnotiz,
// ohne Verlauf; gesperrte Personen stehen mit Markierung drin, damit eine
// Werbeliste sie ausschließen kann — nie stillschweigend weglassen.

import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { kanalStatus } from '@/lib/crm/recht';
import { csvZelle } from '@/lib/crm/marketing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPALTEN: [string, (k: Kontakt, f?: { name: string; branche?: string; stadt?: string; webseite?: string }) => string | undefined][] = [
  ['VORNAME', k => k.vorname], ['NACHNAME', k => k.nachname], ['ANREDE', k => k.anrede], ['EMAIL', k => k.email], ['TELEFON', k => k.telefon ?? k.sms], ['LINKEDIN', k => k.linkedin],
  ['POSITION', k => k.position ?? k.jobtitel], ['FIRMA', (k, f) => f?.name ?? k.firma], ['BRANCHE', (k, f) => f?.branche ?? k.firmaBranche], ['STADT', (k, f) => f?.stadt ?? k.firmaStadt], ['WEBSEITE', (k, f) => f?.webseite ?? k.firmaWebseite],
  ['PRIORITAET', k => k.prio], ['KREIS', k => k.kreis], ['LEBENSPHASE', k => k.lebensphase], ['STUFE', k => k.stufe], ['LETZTER_KONTAKT', k => k.letzterKontakt],
  ['NAECHSTER_SCHRITT', k => k.naechsterSchritt ? `${k.naechsterSchritt.datum} ${k.naechsterSchritt.text}` : undefined],
  ['MAIL_ERLAUBT', k => kanalStatus(k, 'mail').farbe === 'gruen' ? 'ja' : 'nein'], ['NEWSLETTER_DOI', k => kanalStatus(k, 'newsletter').farbe === 'gruen' ? 'ja' : 'nein'],
  ['WERBESPERRE', k => (k.werbesperre ? `seit ${k.werbesperre.seit}` : '')], ['QUELLE', k => k.quelle],
];
// Dieselbe Zelle wie im Marketing-Export: maskiert ; und " und entschärft Formeln (=, @, +/- vor Buchstaben).
const zelle = (v?: string) => csvZelle((v ?? '').replace(/\r?\n/g, ' '));

export async function GET() {
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const firmen = new Map((await ladeCrm()).firmen.map(f => [f.id, f]));
  const zeilen = [SPALTEN.map(s => s[0]).join(';'), ...kontakte.map(k => SPALTEN.map(([, f]) => zelle(f(k, k.firmaId ? firmen.get(k.firmaId) : undefined))).join(';'))];
  return new Response('﻿' + zeilen.join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="MAKE-OS-Kartei-${localDay()}.csv"` } });
}
