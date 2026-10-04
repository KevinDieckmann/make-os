'use client';

// ─── Events (besuchte Veranstaltungen) — gemeinsame Bauteile (03.10.) ────────
// „Für wen“ (MAKE oder Kunde), die Suche für Zielpersonen und kleine Chips. Geschrieben wird wie bei Make.One: nur die
// geänderten Felder (`eventSetzen` → api.teil), nie der ganze Eintrag — Kevin und Malin überschreiben einander nichts.
// Alle Regeln (Säuberung, Schranke Art. 18) stehen im Server (lib/crm/speicher.ts, lib/crm/personen-schranke.ts).

import { useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Chip, LEUCHT, feld, useRueckfrage, type Bestaetigung } from '../../ui';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { fuerVon, fuerFirmaId, zielSchluessel, type ZielAenderung } from '@/lib/crm/besuche-form';
import type { Event, EventZielperson, Firma } from '@/lib/crm/typen';
import type { CrmApi } from '../daten';
import { Wahl } from '../Wahl';
import { eventSetzen, eventsPost } from '../events/gemeinsam';
import { MandantLink } from '../MandantLink';

export type CrmStand = NonNullable<CrmApi['crm']>;
export interface BesuchProps { api: CrmApi; crm: CrmStand; zuKontakt: (id: string) => void; zuFirma: (id: string) => void }

export { eventSetzen };

/**
 * Eine Zielperson ändern — über den Serverweg (`aktion: 'ziel'`), auf dem AKTUELLEN Stand des Events: hinzu · weg · getroffen. Vorher ging die ganze Liste ohne Stand raus,
 * und zwei Geräte am Messestand überschrieben einander. Fehlt der Erfolg, steht der Grund im Kopf (nie still).
 */
export async function zielAenderung(api: CrmApi, e: Event, a: ZielAenderung): Promise<boolean> {
  const r = await eventsPost(e.id, { aktion: 'ziel', aenderung: a });
  if (!r.ok) api.setFehler(typeof r.fehler === 'string' ? r.fehler : 'Nicht gespeichert.');
  await api.laden(true);
  return !!r.ok;
}

/** Feldzeile der Event-Akte: Beschriftung links, am Handy (≤ 560 px, `.bes-zeile` in globals.css) über dem Feld. */
export function BFeld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bes-zeile">
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Name der Kunden-Firma eines Events — oder null (MAKE selbst). */
export function kundenName(e: Event, firmen: readonly Firma[]): string | null {
  const id = fuerFirmaId(e);
  return id ? firmen.find(f => f.id === id)?.name ?? '(Firma gelöscht)' : null;
}

/** Chip „für <Kunde>“ — bei MAKE selbst nichts (Standard). */
export function FuerChip({ e, firmen }: { e: Event; firmen: readonly Firma[] }) {
  const n = kundenName(e, firmen);
  return n ? <Chip farbe={LEUCHT.business}>für {n}</Chip> : null;
}

/** Die Auswahl „Für wen“: MAKE selbst, dann die Firmen der Kartei (Kunden zuerst) — der Name der Firma ist die Beschriftung, die Kennung der Wert. */
export const fuerEintraege = (firmen: readonly Firma[]): { id: string; label: string; hinweis?: string }[] => [
  { id: 'make', label: 'MAKE selbst', hinweis: 'unser eigenes Event' },
  ...[...firmen].sort((a, b) => Number(b.rolle === 'kunde') - Number(a.rolle === 'kunde') || a.name.localeCompare(b.name, 'de')).map(f => ({ id: f.id, label: f.name, ...(f.rolle === 'kunde' ? { hinweis: 'Kunde' } : {}) })),
];

/**
 * „Für wen“: MAKE selbst oder ein Kunde aus der Kartei (Suche im Menü); ist es ein Kunde mit Mandat, kann das Mandat
 * dazu — dann steht darunter der Link in die Mandatsakte. Ändern geht nur auf Klick, nichts wird vorgeschlagen und still gesetzt.
 */
export function FuerWahl({ e, api, crm }: { e: Event; api: CrmApi; crm: CrmStand }) {
  const fuer = fuerVon(e);
  const firmen = crm.stand.firmen;
  const eintraege = useMemo(() => fuerEintraege(firmen), [firmen]);
  const mandate = fuer.art === 'kunde' ? crm.stand.mandate.filter(m => m.firmaId === fuer.firmaId) : [];
  const mandatListe = mandate.map(m => ({ id: m.id, label: m.titel }));
  const { bestaetigen, dialog } = useRueckfrage();
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {dialog}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Wahl label="Für wen" liste={eintraege} wert={fuer.art === 'kunde' ? fuer.firmaId : 'make'} farbe={fuer.art === 'kunde' ? LEUCHT.business : C.aktiv}
          onWahl={async id => { if (!(await fuerAendernOk(e, crm, id === 'make' ? 'MAKE selbst' : firmen.find(f => f.id === id)?.name ?? 'diesen Kunden', bestaetigen))) return; void eventSetzen(api, e, { fuer: id === 'make' ? undefined : { art: 'kunde', firmaId: id } }); }} />
        {fuer.art === 'kunde' && mandatListe.length > 0 && (
          <Wahl label="Mandat" leer="+ Mandat" liste={mandatListe} wert={fuer.mandatId ?? null}
            onWahl={mandatId => void eventSetzen(api, e, { fuer: { art: 'kunde', firmaId: fuer.firmaId, mandatId } })}
            onLeeren={() => void eventSetzen(api, e, { fuer: { art: 'kunde', firmaId: fuer.firmaId } })} />
        )}
      </div>
      {fuer.art === 'kunde' && (
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>
          Die Kontakte bleiben in unserer Kartei und sind diesem Kunden zugeordnet.{' '}
          <MandantLink firmaId={fuer.firmaId} {...(fuer.mandatId ? { mandatId: fuer.mandatId } : {})} name={kundenName(e, firmen) ?? undefined} klein>{fuer.mandatId ? 'Mandat öffnen ›' : 'Firmenakte öffnen ›'}</MandantLink>
        </span>
      )}
    </div>
  );
}

/** Hängen schon erfasste Personen am Event, fragt „Für wen ändern“ vorher nach („n Personen hängen dann an …“) — ein Etikett mit Folgen (Export für Kunden, Auftragsverarbeitung). */
async function fuerAendernOk(e: Event, crm: CrmStand, name: string, bestaetigen: (b: Bestaetigung) => Promise<boolean>): Promise<boolean> {
  const n = crm.stand.teilnahmen.filter(t => t.eventId === e.id && t.netzwerken).length;
  if (!n) return true;
  return bestaetigen({ titel: 'Für wen wirklich ändern?', text: `${n === 1 ? 'Eine erfasste Person hängt' : `${n} erfasste Personen hängen`} dann an ${name} — auch ihr Export „An Kunden übergeben“ ändert sich.`, ja: 'Ändern' });
}

/** Wie eine Zielperson heißt — Person (Name · Firma) oder Firma. */
export function zielName(z: EventZielperson, kontakte: Map<string, Kontakt>, firmen: Map<string, Firma>): { name: string; unter?: string; tot: boolean } {
  if (z.kontaktId) {
    const k = kontakte.get(z.kontaktId);
    return k ? { name: anzeigename(k), ...(k.firma ? { unter: k.firma } : {}), tot: false } : { name: '(Person gelöscht)', tot: true };
  }
  const f = z.firmaId ? firmen.get(z.firmaId) : undefined;
  return f ? { name: f.name, unter: 'Firma', tot: false } : { name: '(Firma gelöscht)', tot: true };
}

/**
 * Suche für „wen wollen wir treffen“: Personen und Firmen der Kartei (ab zwei Zeichen, höchstens acht Treffer). Gesperrte Personen
 * (Art. 18, Werbesperre) erscheinen nie; wer schon auf der Liste steht, auch nicht.
 */
export function ZielSuche({ api, crm, e }: { api: CrmApi; crm: CrmStand; e: Event }) {
  const [suche, setSuche] = useState('');
  const drin = new Set((e.zielpersonen ?? []).map(zielSchluessel));
  const q = suche.trim().toLowerCase();
  const personen = q.length >= 2 ? (api.kontakte ?? []).filter(k => !ausgenommen(k) && !drin.has(`k:${k.id}`) && `${k.vorname} ${k.nachname} ${k.firma ?? ''}`.toLowerCase().includes(q)).slice(0, 5) : [];
  const firmen = q.length >= 2 ? crm.stand.firmen.filter(f => !drin.has(`f:${f.id}`) && f.name.toLowerCase().includes(q)).slice(0, 3) : [];
  const setze = (z: EventZielperson) => { void zielAenderung(api, e, { op: 'hinzu', ...(z.kontaktId ? { kontaktId: z.kontaktId } : { firmaId: z.firmaId }) }); setSuche(''); };
  const zeile = { display: 'flex', alignItems: 'center', minHeight: 44, width: '100%', textAlign: 'left' as const, background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: '4px 2px', borderBottom: '1px solid rgba(255,255,255,.05)' };
  return (
    <div>
      <input value={suche} onChange={x => setSuche(x.target.value)} placeholder="Person oder Firma aus der Kartei suchen …" aria-label="Zielperson oder Zielfirma suchen" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
      {personen.map(k => <button key={k.id} type="button" onClick={() => setze({ kontaktId: k.id })} style={zeile}>+ {anzeigename(k)}{k.firma ? <span style={{ color: C.inkLeise }}> · {k.firma}</span> : null}</button>)}
      {firmen.map(f => <button key={f.id} type="button" onClick={() => setze({ firmaId: f.id })} style={zeile}>+ {f.name}<span style={{ color: C.inkLeise }}> · Firma</span></button>)}
      {q.length >= 2 && !personen.length && !firmen.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '8px 2px' }}>Nichts gefunden — oder die Person ist gesperrt (Art. 18 / Werbesperre).</div>}
    </div>
  );
}

/** Der Auftragsverarbeitungs-Hinweis (Kontakte für Kunden) — sichtbar in der Event-Akte und im Reiter „Für Kunden“. */
export function AvvHinweis({ text }: { text: string }) {
  return (
    <div role="note" style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${LEUCHT.achtung}55`, background: `${LEUCHT.achtung}10`, fontSize: TYP.bedien, lineHeight: 1.5, color: C.inkDim }}>
      <b style={{ color: LEUCHT.achtung }}>Datenschutz · </b>{text}
    </div>
  );
}

