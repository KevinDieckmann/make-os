// ─── CRM — Kunden, Mandate und Leistungen aus dem Brain übernehmen ─────────
// Eingabe ist die Auswertung der Brain-Notizen (Firmen, Kunden mit
// Ansprechpartnern, Mandate, Produkte) — Widersprüche stehen dort je Mandat
// unter „offen“ und bleiben sichtbar, statt geglättet zu werden.
// Wiederholbar: feste Kennungen; was schon da ist, bleibt, wie es ist (eigene
// Änderungen gehen nie verloren). Ansprechpartner kommen in die Kartei.

import { schluessel, type Kontakt, type Lebensphase } from '@/lib/make-one/crm';
import type { CrmBestand, Mandat, Leistung, ChancenArt, Gesellschaft, LeistungTyp } from './typen';

export interface BrainDaten {
  kunden?: { name: string; kurz?: string; branche?: string; ansprechpartner?: { name: string; rolle?: string }[]; status?: string; ueber_firma?: string | null; quelle?: string }[];
  mandate?: { kunde: string; titel: string; art?: string; honorar?: { betrag?: number | null; einheit?: string; netto?: boolean | null }; start?: string | null; ende?: string | null; status?: string; vertrag_unterschrieben?: boolean | null; leistungen?: string[]; offen?: string[]; quelle?: string }[];
  produkte?: { name: string; kategorie?: string; preis?: { betrag?: number | null; einheit?: string }; beschreibung?: string; lieferumfang?: string[]; quelle?: string }[];
}

function hash(t: string): string { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).slice(0, 6); }
const slug = (t: string, n = 24) => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, n).replace(/-$/, '');
/** „Grzegorz Augustyn ('Gregor', im CRM 'Gregosch')“ → „Grzegorz Augustyn“ */
export const sauberName = (n: string) => n.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
const norm = (t: string) => sauberName(t).toLowerCase();
/** Rolle aus Brain-Notizen: nur der Titel, ohne Quellenvermerke („laut …“, „(… 17.09.)“, „ — …“). */
export const sauberRolle = (r?: string) => (r ?? '').replace(/\(.*?\)/g, '').split(/ — |; | laut |\. /)[0].replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim().slice(0, 120) || undefined;

function art(a?: string): ChancenArt {
  if (a === 'provision' || a === 'vermittlung') return 'vermittlung';
  return (['retainer', 'projekt', 'workshop', 'software'] as const).includes(a as never) ? (a as ChancenArt) : 'projekt';
}
function statusAus(s?: string): Mandat['status'] {
  return (['angebot', 'verhandlung', 'aktiv', 'pausiert', 'beendet'] as const).includes(s as never) ? (s as Mandat['status']) : 'verhandlung';
}
function leistungTyp(p: NonNullable<BrainDaten['produkte']>[number]): { typ: LeistungTyp; stufe: Leistung['stufe'] } {
  const n = `${p.name} ${p.kategorie ?? ''} ${p.preis?.einheit ?? ''}`.toLowerCase();
  if (/provision|vermittl/.test(n)) return { typ: 'vermittlung', stufe: 'kern' };
  if (/sprint/.test(n)) return { typ: 'sprint', stufe: 'einstieg' };
  if (/workshop|webinar/.test(n)) return { typ: 'workshop', stufe: 'einstieg' };
  if (/programm|deck/.test(n)) return { typ: 'workshop', stufe: 'einstieg' };
  if (/exit|umsetzung/.test(n) || (p.preis?.betrag ?? 0) >= 3000) return { typ: 'retainer', stufe: 'premium' };
  return { typ: 'retainer', stufe: 'kern' };
}

export interface UmzugErgebnis { bestand: CrmBestand; kontakte: Kontakt[]; neu: { mandate: number; leistungen: number; kontakte: number }; vorhanden: { mandate: number; leistungen: number; kontakte: number } }

export function ausBrain(d: BrainDaten, bestand: CrmBestand, kartei: Kontakt[], heute: string, jetzt: string, person: string, verknuepfung: Record<string, string> = {}): UmzugErgebnis {
  const neu = { mandate: 0, leistungen: 0, kontakte: 0 }, vorhanden = { mandate: 0, leistungen: 0, kontakte: 0 };
  const kontakte = [...kartei];
  const kundeKontakte = new Map<string, string[]>();

  for (const ku of d.kunden ?? []) {
    const phase: Lebensphase = ku.status === 'aktiv' ? 'kunde' : ku.status === 'beendet' ? 'ex_kunde' : 'interessent';
    const firma = sauberName(ku.name);
    const idsHier: string[] = [];
    for (const ap of ku.ansprechpartner ?? []) {
      const name = sauberName(ap.name);
      if (!name) continue;
      const teile = name.split(' ');
      const vorname = teile.length > 1 ? teile.slice(0, -1).join(' ') : teile[0];
      const nachname = teile.length > 1 ? teile[teile.length - 1] : '';
      const da = kontakte.find(k => norm(`${k.vorname} ${k.nachname}`) === norm(name));
      if (da) {
        vorhanden.kontakte++; idsHier.push(da.id);
        // Nur ergänzen, was fehlt — Lebensphase „Kunde“ gewinnt über „Kontakt“.
        const i = kontakte.indexOf(da);
        kontakte[i] = { ...da, ...(da.lebensphase && da.lebensphase !== 'kontakt' ? {} : { lebensphase: phase }), ...(da.kreis ? {} : { kreis: phase === 'kunde' ? 'A' : 'B' }), ...(da.firma ? {} : { firma }), ...(da.position ? {} : sauberRolle(ap.rolle) ? { position: sauberRolle(ap.rolle) } : {}) };
        continue;
      }
      const k: Kontakt = {
        id: '', vorname, nachname, firma, position: sauberRolle(ap.rolle), typ: 'Kunde', kategorie: 'Kunde (Brain)', quelle: 'Brain-Auswertung 24.09.', eignung: '', prio: '',
        kreis: phase === 'kunde' ? 'A' : 'B', besitzer: person === 'malin' ? 'beide' : 'kevin', lebensphase: phase, anrede: 'Sie', stufe: phase === 'kunde' ? 'gewonnen' : 'gespraech',
        aktivitaeten: [{ am: jetzt, art: 'system', text: `Aus dem Brain übernommen (${firma})`, von: person }], importiertAm: heute, geaendertAm: heute,
      };
      const key = schluessel(k);
      k.id = `c-${key.replace(/[^a-z0-9]/g, '').slice(0, 40)}-${hash(key)}`;
      kontakte.push(k); idsHier.push(k.id); neu.kontakte++;
    }
    kundeKontakte.set(norm(ku.name), idsHier);
  }

  const leistungen = [...bestand.leistungen];
  for (const p of d.produkte ?? []) {
    const id = `l-${slug(p.name)}-${hash(p.name)}`;
    if (leistungen.some(l => l.id === id)) { vorhanden.leistungen++; continue; }
    const t = leistungTyp(p);
    leistungen.push({
      id, name: p.name.slice(0, 160), typ: t.typ, stufe: t.stufe, preis: { betrag: Number(p.preis?.betrag) || 0, einheit: (p.preis?.einheit ?? '').slice(0, 80) || 'offen' },
      ...(p.beschreibung ? { beschreibung: p.beschreibung.slice(0, 1500) } : {}), lieferumfang: (p.lieferumfang ?? []).slice(0, 20).map(x => x.slice(0, 300)),
      gesellschaft: 'offen', status: (Number(p.preis?.betrag) || 0) > 0 ? 'aktiv' : 'entwurf', ...(p.quelle ? { quelle: p.quelle.slice(0, 600) } : {}), geaendert: jetzt,
    });
    neu.leistungen++;
  }

  const mandate = [...bestand.mandate];
  for (const m of d.mandate ?? []) {
    const id = `m-${slug(sauberName(m.kunde), 16)}-${hash(`${m.kunde}|${m.titel}`)}`;
    if (mandate.some(x => x.id === id)) { vorhanden.mandate++; continue; }
    const einheit = (m.honorar?.einheit ?? '').toLowerCase();
    const monat = einheit.startsWith('monat');
    const pauschal = einheit.startsWith('pauschal');
    const betrag = monat || pauschal ? Number(m.honorar?.betrag) || 0 : 0;
    const offen = [...(m.offen ?? [])];
    if (!monat && !pauschal && m.honorar?.betrag) offen.unshift(`Vergütung: ${m.honorar.betrag} ${m.honorar.einheit} — nicht als Monatshonorar abbildbar`);
    const ges: Gesellschaft = 'kdc'; // Laut Brain stellt die Selbstständigkeit alle laufenden Rechnungen.
    mandate.push({
      id, kunde: sauberName(m.kunde).slice(0, 160), kontaktIds: kundeKontakte.get(norm(m.kunde)) ?? [], titel: m.titel.slice(0, 200), art: art(m.art),
      gesellschaft: ges, status: statusAus(m.status), vertragUnterschrieben: m.vertrag_unterschrieben === true,
      ...(m.start ? { start: m.start } : {}), ...(m.ende ? { ende: m.ende } : {}), verlaengerung: 'offen',
      honorar: { betrag, basis: monat ? 'monat' : 'einmalig', netto: m.honorar?.netto !== false }, ustSatz: 19,
      ...(verknuepfung[id] ? { planpostenId: verknuepfung[id] } : {}),
      rechnungsrhythmus: monat ? 'monatlich' : 'einmalig', zahlungszielTage: 14, ziele: [],
      health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null },
      leistungen: (m.leistungen ?? []).slice(0, 30).map(x => x.slice(0, 400)), offen: offen.slice(0, 30).map(x => x.slice(0, 800)),
      ...(m.quelle ? { quelle: m.quelle.slice(0, 600) } : {}), geaendert: jetzt,
    });
    neu.mandate++;
  }
  return { bestand: { ...bestand, leistungen, mandate }, kontakte, neu, vorhanden };
}
