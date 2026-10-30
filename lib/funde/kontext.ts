// ─── Funde — Absender, Datenschutz-Angaben und Angebot für Vorschau und Mail (nur Server) ───────────────────────────────────
// Alles aus den Beständen der Instanz: Gesellschaft (Register, Name über `mitVorgaben`), Verantwortlicher (Datenschutz-Einrichtung), Produkt
// (Katalog `crm.leistungen`). Nie ein fester Name im Code.

import { ladeCrm } from '@/lib/crm/speicher';
import { gesellschaftenLaden } from '@/lib/crm/angebot-server';
import { mitVorgaben } from '@/lib/crm/gesellschaften';
import { datenschutzAngabenAus } from '@/lib/crm/netzwerken-recht';
import { BUSINESS_GESELLSCHAFTEN } from '@/lib/einheiten';
import { preisKurz, type AngebotKurz, type EntwurfKontext } from './entwurf';
import type { FundeEinstellungen } from './typen';

export interface FundKontext extends Omit<EntwurfKontext, 'link' | 'abmelden' | 'unterschrift'> { gesellschaft: string; datenschutzFehlt: boolean }

export async function fundKontext(e: FundeEinstellungen, h: string): Promise<FundKontext> {
  const gesellschaften = await gesellschaftenLaden(h).catch(() => []);
  const gId = e.gesellschaft ?? (BUSINESS_GESELLSCHAFTEN as readonly string[])[0] ?? 'ug';
  const g = gesellschaften.find(x => x.id === gId) ?? { id: gId };
  const absender = mitVorgaben(g as Parameters<typeof mitVorgaben>[0]).name;
  const { verantwortlicherLaden } = await import('@/lib/datenschutz/einrichtung-server');
  const ds = datenschutzAngabenAus((await verantwortlicherLaden()).v);
  let angebot: AngebotKurz | null = null;
  if (e.produktId) {
    const p = (await ladeCrm()).leistungen.find(l => l.id === e.produktId && l.status !== 'eingestellt');
    if (p) { const preis = preisKurz(p.preis); angebot = { name: p.name, ...(preis ? { preis } : {}) }; }
  }
  return {
    gesellschaft: gId, absender, angebot, datenschutzFehlt: !!ds.fehlt,
    datenschutz: { mail: ds.mail, ...(ds.verantwortlich ? { verantwortlich: ds.verantwortlich } : {}), ...(ds.seite ? { seite: ds.seite } : {}) },
  };
}
