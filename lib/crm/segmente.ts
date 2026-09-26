// ─── CRM — Segmente: gespeicherte Filter über die Kartei (rein, getestet) ──
// Ein Segment beantwortet „wen meinen wir?“ — für Kampagnen, Einladungen,
// Newsletter. Gesperrte Personen sind NIE Mitglied (Art. 21). Mit einem
// Kanal-Kriterium zählen nur die, die über diesen Kanal zulässig erreichbar
// sind (Ampel grün); ohne Kanal zeigt die Auswertung die Aufteilung.

import type { Kontakt } from '@/lib/make-one/crm';
import { rollenVon } from '@/lib/make-one/crm';
import type { CrmBestand, Firma, SegmentKriterien } from './typen';
import { kanalStatus } from './recht';
import { OFFENE_STUFEN } from './pipeline';

export interface SegmentKontext { firmen: Map<string, Firma>; mitChance: Set<string>; mitMandat: Set<string>; heute: string }

export function kontextAus(crm: CrmBestand, heute: string): SegmentKontext {
  return {
    firmen: new Map(crm.firmen.map(f => [f.id, f])),
    mitChance: new Set(crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe)).flatMap(c => c.kontaktIds)),
    mitMandat: new Set(crm.mandate.filter(m => m.status === 'aktiv').flatMap(m => m.kontaktIds)),
    heute,
  };
}

const enthaelt = (feld: string | undefined, such?: string) => !such || (feld ?? '').toLowerCase().includes(such.toLowerCase());
const tage = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5);

export function imSegment(k: Kontakt, kr: SegmentKriterien, ctx: SegmentKontext): boolean {
  if (k.werbesperre) return false;
  const f = k.firmaId ? ctx.firmen.get(k.firmaId) : undefined;
  if (kr.lebensphase?.length && !kr.lebensphase.includes(k.lebensphase ?? 'kontakt')) return false;
  if (kr.rollen?.length && !rollenVon(k).some(r => kr.rollen!.includes(r))) return false;
  if (kr.kreis?.length && !kr.kreis.includes(k.kreis ?? '')) return false;
  if (kr.prio?.length && !kr.prio.includes(k.prio)) return false;
  if (kr.herkunft?.length && !kr.herkunft.includes(k.herkunft ?? '')) return false;
  if (kr.firmaRolle?.length && !kr.firmaRolle.includes(f?.rolle ?? 'offen')) return false;
  if (!enthaelt(f?.branche ?? k.firmaBranche, kr.branche)) return false;
  if (!enthaelt(f?.stadt ?? k.firmaStadt, kr.stadt)) return false;
  if (kr.stichwort && ![k.vorname, k.nachname, k.firma, k.position, k.aufhaenger, k.notiz, k.kategorie].some(x => enthaelt(x, kr.stichwort))) return false;
  if (kr.mitChance !== undefined && ctx.mitChance.has(k.id) !== kr.mitChance) return false;
  if (kr.ohneKontaktSeitTagen && k.letzterKontakt && tage(k.letzterKontakt, ctx.heute) < kr.ohneKontaktSeitTagen) return false;
  if (kr.kanal) {
    const st = kanalStatus(k, kr.kanal, { hatMandat: ctx.mitMandat.has(k.id), hatChance: ctx.mitChance.has(k.id) });
    if (st.farbe !== 'gruen') return false;
  }
  return true;
}

export interface SegmentAuswertung { mitglieder: Kontakt[]; anzahl: number; kanaele: { mail: number; telefon: number; linkedin: number; newsletter: number; einladung: number; nurPersoenlich: number } }

export function segmentAuswerten(kontakte: Kontakt[], kr: SegmentKriterien, ctx: SegmentKontext): SegmentAuswertung {
  const mitglieder = kontakte.filter(k => imSegment(k, kr, ctx));
  const gruen = (k: Kontakt, kanal: 'mail' | 'telefon' | 'linkedin' | 'newsletter' | 'einladung') => kanalStatus(k, kanal, { hatMandat: ctx.mitMandat.has(k.id), hatChance: ctx.mitChance.has(k.id) }).farbe === 'gruen';
  const z = { mail: 0, telefon: 0, linkedin: 0, newsletter: 0, einladung: 0, nurPersoenlich: 0 };
  for (const k of mitglieder) {
    const g = { mail: gruen(k, 'mail'), telefon: gruen(k, 'telefon'), linkedin: gruen(k, 'linkedin'), newsletter: gruen(k, 'newsletter'), einladung: gruen(k, 'einladung') };
    for (const x of Object.keys(g) as (keyof typeof g)[]) if (g[x]) z[x]++;
    if (!Object.values(g).some(Boolean)) z.nurPersoenlich++;
  }
  return { mitglieder, anzahl: mitglieder.length, kanaele: z };
}
