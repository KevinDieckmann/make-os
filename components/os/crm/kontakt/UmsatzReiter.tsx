'use client';

// ─── Kontakt öffnen · Reiter „Umsatz“ (28.09., Paket H2) ────────────────────
// Kevin (HubSpot als Vorbild, „Vom Angebot bis zum Zahlungseingang“): „Eine Kachel
// mit dem Umsatz, den wir mit dem Kunden gemacht haben, aber auch die Zahlungs-
// möglichkeiten. Eine Kachel mit Verträgen, die wir hochladen können. Angebote,
// Rechnung und Zahlungseingang jedes Mal mit einer eigenen Kachel.“
//
// Sechs Kacheln, je einklappbar (Merker `mt-umsatz-zu`), Reihenfolge wie HubSpot:
// Umsatz · Zahlungsmöglichkeiten · Verträge · Angebote · Rechnungen · Zahlungseingang.
// Rechnen: lib/crm/umsatz.ts (rein). Zahlungsdaten: lib/crm/zahlung.ts (die IBAN kommt vom
// Server nur maskiert, 28.09. H4). Dateien: /api/crm/dateien (verschlüsselt je Haushalt, nie an KI).
// Rechnungen schreiben nur über den Finanzplan-PATCH (`liste: 'rechnungen'`).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Zahlungsdaten, Zahlungsweg } from '@/lib/crm/typen';
import type { CrmApi } from '../daten';
import { euro, datum, plusTage } from '../daten';
import { Karte, Leer, Knopf, Chip, Balken, Zahl, feld, LEUCHT } from '../../ui';
import { Feldzeile, Feld } from '../teile';
import { Wahl, type WahlEintrag } from '../Wahl';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import { umsatzBezug, umsatzKennzahlen, angeboteListe, ablageFilter, kundenName, rechnungsFirma, rechnungVorbelegung, rechnungAusFormular, type UmsatzRechnung, type ZugeordneteRechnung, type AngebotZeile } from '@/lib/crm/umsatz';
import { ZAHLUNGSWEGE, ZAHLUNGSWEG_LABEL, ibanGueltig, ibanMaskiert, zahlungsQuelle, zahlungLuecken } from '@/lib/crm/zahlung';
import { ANNEHMEN, MAX_DATEI_BYTES, VERTRAGSARTEN, ANGEBOT_STATUS, groesseText, istBeleg, type DateiEintrag, type DateiArt, type Vertragsart, type AngebotStatus } from '@/lib/dateien/regeln';
import { einheitAusGesellschaft, istGesellschaft, NUR_GRUNDDATEN, type Gesellschaftskennung } from '@/lib/einheiten';
import { inGruppe } from '@/lib/crm/konzern';
import Link from 'next/link';
import { angebotLink } from '@/lib/crm/adresse';
import { angeboteZu, ANGEBOT_STATUS_LABEL } from '@/lib/crm/angebote';
import { neueKennung } from '@/lib/kennung';
import { useRouter } from 'next/navigation';
import { entwurfAnlegen } from '../../rechnung/daten';

export interface UmsatzReiterProps {
  k: Kontakt;
  api: CrmApi;
  zuDeal?: (id: string) => void;
}

type Plan = { rechnungen: UmsatzRechnung[]; firmen: { id: string; name: string }[] };
type Kachel = 'umsatz' | 'zahlung' | 'vertraege' | 'angebote' | 'rechnungen' | 'eingang';
const MERKER = 'mt-umsatz-zu';

// ── Kleine Bausteine ─────────────────────────────────────────────────────────

function useZugeklappt(): [Set<Kachel>, (id: Kachel) => void] {
  const [zu, setZu] = useState<Set<Kachel>>(new Set());
  useEffect(() => { try { const l = JSON.parse(localStorage.getItem(MERKER) ?? '[]'); if (Array.isArray(l)) setZu(new Set(l)); } catch { /* ohne Merker */ } }, []);
  const umschalten = useCallback((id: Kachel) => setZu(alt => {
    const n = new Set(alt); if (n.has(id)) n.delete(id); else n.add(id);
    try { localStorage.setItem(MERKER, JSON.stringify(Array.from(n))); } catch { /* ohne Merker */ }
    return n;
  }), []);
  return [zu, umschalten];
}

function KachelKarte({ id, i, titel, farbe, kurz, zu, umschalten, rechts, children }: { id: Kachel; i: number; titel: string; farbe: string; kurz?: ReactNode; zu: boolean; umschalten: (id: Kachel) => void; rechts?: ReactNode; children: ReactNode }) {
  return (
    <Karte i={i} id={`umsatz-${id}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: zu ? 0 : 12 }}>
        <button onClick={() => umschalten(id)} aria-expanded={!zu} className="fassbar" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.inkDim, textAlign: 'left' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: farbe, flex: '0 0 auto' }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>{titel}</span>
          {kurz && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {kurz}</span>}
          <span aria-hidden style={{ marginLeft: 'auto', color: C.inkLeise, fontSize: TYP.bedien }}>{zu ? '▸' : '▾'}</span>
        </button>
        {!zu && rechts}
      </div>
      {!zu && children}
    </Karte>
  );
}

function ZeileKlein({ titel, unter, rechts }: { titel: ReactNode; unter?: ReactNode; rechts?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <div style={{ fontSize: TYP.bedien, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{titel}</div>
        {unter && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 2 }}>{unter}</div>}
      </div>
      {rechts && <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{rechts}</div>}
    </div>
  );
}

const leiseLink = { color: C.aktiv, fontSize: TYP.bedien, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none', padding: 0 } as const;
const STATUS_FARBE: Record<string, string> = { storniert: C.inkLeise, bezahlt: LEUCHT.gut, gestellt: LEUCHT.puls, geplant: C.inkLeise, offen: LEUCHT.achtung, angenommen: LEUCHT.gut, abgelehnt: C.inkLeise, ueberfaellig: LEUCHT.kritisch };

/** Löschen mit Rückfrage — erst „Löschen“, dann „Wirklich? Ja · Nein“. */
/** Löschen mit Rückfrage. Belege (hängen an Rechnung/Mandat, 28.09. K3) werden nicht gelöscht, nur vom Bezug gelöst. */
function LoeschKnopf({ onJa, beleg }: { onJa: () => void; beleg?: boolean }) {
  const [frage, setFrage] = useState(false);
  if (!frage) return <button onClick={() => setFrage(true)} style={{ ...leiseLink, color: C.inkLeise }} title={beleg ? 'Hängt an einer Rechnung oder einem Mandat — wird nicht gelöscht, nur vom Bezug gelöst' : undefined}>{beleg ? 'vom Bezug lösen' : 'Löschen'}</button>;
  return <span style={{ fontSize: TYP.bedien, color: C.inkDim, display: 'inline-flex', gap: 8 }}>{beleg ? 'Von Rechnung/Mandat lösen?' : 'Wirklich löschen?'} <button onClick={() => { setFrage(false); onJa(); }} style={{ ...leiseLink, color: LEUCHT.kritisch }}>Ja</button><button onClick={() => setFrage(false)} style={leiseLink}>Nein</button></span>;
}

/** Stornieren mit Grund und Rückfrage — ersetzt das Löschen ab „gestellt“ (28.09., K3). */
function StornoKnopf({ onJa }: { onJa: (grund: string) => Promise<void> }) {
  const [grund, setGrund] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  if (grund === null) return <button onClick={() => setGrund('')} style={{ ...leiseLink, color: C.inkLeise }}>stornieren</button>;
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={grund} onChange={e => setGrund(e.target.value)} placeholder="Grund des Stornos" aria-label="Grund des Stornos" style={{ ...feld, fontSize: TYP.bedien, padding: '6px 10px', width: 'min(200px, 100%)' }} />
      <button disabled={laeuft || grund.trim().length < 3} onClick={async () => { setLaeuft(true); await onJa(grund.trim()); setLaeuft(false); setGrund(null); }} style={{ ...leiseLink, color: LEUCHT.kritisch }}>{laeuft ? '…' : 'wirklich stornieren'}</button>
      <button onClick={() => setGrund(null)} style={leiseLink}>Abbrechen</button>
    </span>
  );
}

function DateiLink({ e }: { e: DateiEintrag }) {
  if (!e.datei) return null;
  return <a href={`/api/crm/dateien?id=${encodeURIComponent(e.id)}`} download={e.datei.name} style={leiseLink} title={`${e.datei.name} · ${groesseText(e.datei.groesse)}`}>↓ {e.datei.name.length > 28 ? `${e.datei.name.slice(0, 26)}…` : e.datei.name}</a>;
}

/** Datei wählen (unsichtbares Feld) — prüft Größe schon hier, der Server prüft Typ und Inhalt. */
function DateiWahl({ datei, setDatei, text = 'PDF wählen' }: { datei: File | null; setDatei: (f: File | null) => void; text?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input ref={ref} type="file" accept={ANNEHMEN} hidden onChange={e => setDatei(e.target.files?.[0] ?? null)} />
      <Knopf leise onClick={() => ref.current?.click()}>{datei ? 'andere Datei' : text}</Knopf>
      {datei && <span style={{ fontSize: TYP.bedien, color: datei.size > MAX_DATEI_BYTES ? LEUCHT.kritisch : C.inkDim }}>{datei.name} · {groesseText(datei.size)}{datei.size > MAX_DATEI_BYTES ? ' — zu groß (max. 15 MB)' : ''}</span>}
    </span>
  );
}

async function hochladen(meta: Record<string, unknown>, datei: File | null): Promise<{ ok: boolean; fehler?: string; eintrag?: DateiEintrag }> {
  if (datei && datei.size > MAX_DATEI_BYTES) return { ok: false, fehler: 'Datei zu groß (höchstens 15 MB).' };
  try {
    if (datei) {
      const f = new FormData();
      f.append('datei', datei);
      f.append('meta', JSON.stringify(meta));
      return await fetch('/api/crm/dateien', { method: 'POST', body: f }).then(r => r.json());
    }
    return await fetch('/api/crm/dateien', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meta }) }).then(r => r.json());
  } catch { return { ok: false, fehler: 'Keine Verbindung.' }; }
}

/**
 * Die Vorgabe-Gesellschaft für Rechnungen ohne Mandat (08.10., Sofort-Paket 3.2): die operative Business-Gesellschaft aus dem Register
 * (GET /api/crm/gesellschaften › vorgabe). `null` = nicht eindeutig oder nicht erreichbar — dann wird gewählt, nie still `kdc`.
 */
function useRechnungsVorgabe(): Gesellschaftskennung | null {
  const [v, setV] = useState<Gesellschaftskennung | null>(null);
  useEffect(() => {
    let aktiv = true;
    fetch('/api/crm/gesellschaften', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then((d: { vorgabe?: unknown } | null) => { if (aktiv && istGesellschaft(d?.vorgabe)) setV(d!.vorgabe as Gesellschaftskennung); }).catch(() => {});
    return () => { aktiv = false; };
  }, []);
  return v;
}

// ── Der Reiter ───────────────────────────────────────────────────────────────

export function UmsatzReiter({ k, api, zuDeal }: UmsatzReiterProps) {
  const heute = api.crm?.heute ?? localDay();
  const [zu, umschalten] = useZugeklappt();
  const [plan, setPlan] = useState<Plan | null | 'kein' | 'fehler'>(null);
  const [ablage, setAblage] = useState<DateiEintrag[] | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  // „Ganze Gruppe“ (28.09., #7): Umsatz, Deals und Rechnungen von Mutter- und Tochterfirmen zusammenfassen.
  const [gruppe, setGruppe] = useState(false);
  const vorgabe = useRechnungsVorgabe();
  const router = useRouter();
  /**
   * Rechnung schreiben mit PDF (08.10.): legt den Entwurf an (vorbelegt aus Kontakt, Firma, Mandat bzw. dem angenommenen Angebot)
   * und öffnet den Editor unter Finanzen › Rechnungen & Zahlungen — dort wird gestellt (Nummer + PDF).
   */
  const rechnungSchreibenOeffnen = useCallback(async (body: Parameters<typeof entwurfAnlegen>[0]) => {
    const e = await entwurfAnlegen(body);
    if (!e.id) { setMeldung(e.fehler ?? 'Rechnung nicht angelegt.'); return; }
    router.push(WEG.rechnungSchreiben(e.id));
  }, [router]);

  const planLaden = useCallback(async (): Promise<Plan | null> => {
    try {
      const r = await fetch('/api/state/finanzplan', { cache: 'no-store' });
      if (r.status === 403) { setPlan('kein'); return null; }
      const d = await r.json() as Plan;
      const p = { rechnungen: Array.isArray(d.rechnungen) ? d.rechnungen : [], firmen: Array.isArray(d.firmen) ? d.firmen : [] };
      setPlan(p); return p;
    } catch { setPlan('fehler'); return null; }
  }, []);
  useEffect(() => { void planLaden(); }, [planLaden]);

  const stand = api.crm?.stand;
  const hatGruppe = !!stand && !!k.firmaId && inGruppe(stand.firmen, k.firmaId);
  const bezug = useMemo(() => (stand ? umsatzBezug(k, stand, plan && typeof plan === 'object' ? plan.rechnungen : [], heute, { gruppe: gruppe && hatGruppe }) : null), [k, stand, plan, heute, gruppe, hatGruppe]);
  const kennzahlen = useMemo(() => (bezug ? umsatzKennzahlen(bezug) : null), [bezug]);
  const filter = useMemo(() => (bezug ? ablageFilter(k, bezug) : null), [k, bezug]);
  const filterText = filter ? new URLSearchParams({ kontakt: filter.kontaktId, ...(filter.firmaId ? { firma: filter.firmaId } : {}), mandat: filter.mandatIds.join(','), deal: filter.dealIds.join(','), rechnung: filter.rechnungIds.join(',') }).toString() : '';

  const ablageLaden = useCallback(async () => {
    if (!filterText) return;
    try {
      const r = await fetch(`/api/crm/dateien?${filterText}`, { cache: 'no-store' });
      const d = await r.json();
      setAblage(d.ok ? d.eintraege : []);
      if (!d.ok) setMeldung(d.fehler ?? 'Ablage nicht erreichbar.');
    } catch { setAblage([]); setMeldung('Ablage nicht erreichbar.'); }
  }, [filterText]);
  useEffect(() => { void ablageLaden(); }, [ablageLaden]);

  if (!stand || !bezug || !kennzahlen) return <Karte i={0}><Leer>lade …</Leer></Karte>;

  // Bezüge für Uploads und neue Vorgänge: Mandate und Deals dieses Kontakts.
  const bezugListe: WahlEintrag<string>[] = [
    ...bezug.mandate.map(m => ({ id: `m:${m.id}`, label: m.titel, hinweis: `Mandat · ${m.kunde}` })),
    ...bezug.deals.map(c => ({ id: `c:${c.id}`, label: c.titel, hinweis: `Deal · ${c.stufe}` })),
  ];
  const bezugFelder = (wahl: string | null) => ({ kontaktId: k.id, ...(bezug.firma ? { firmaId: bezug.firma.id } : {}), ...(wahl?.startsWith('m:') ? { mandatId: wahl.slice(2) } : {}), ...(wahl?.startsWith('c:') ? { dealId: wahl.slice(2) } : {}) });
  const bezugText = (e: Pick<DateiEintrag, 'mandatId' | 'dealId'>) => (e.mandatId ? bezug.mandate.find(m => m.id === e.mandatId)?.titel : e.dealId ? bezug.deals.find(c => c.id === e.dealId)?.titel : undefined);

  const kein = plan === 'kein';
  const rechnungen = bezug.rechnungen;
  const offen = rechnungen.filter(z => z.r.status === 'gestellt');
  const bezahlt = rechnungen.filter(z => z.r.status === 'bezahlt');
  // Angebote (28.09.): aus dem Angebots-Tool (crm.angebote) + Altbestand (Finanzplan, Deals, Ablage) — lesbar wie bisher.
  const angebote = angeboteListe(bezug, ablage ?? [], angeboteZu(api.crm?.stand.angebote, { kontaktId: k.id, firmaId: bezug.firma?.id }));
  const offenZahl = angebote.filter(a => (a.quelle === 'tool' ? a.toolStatus === 'gestellt' : a.status === 'offen')).length;
  const vertraege = (ablage ?? []).filter(e => e.art === 'vertrag');
  const rechnungsPdf = new Map((ablage ?? []).filter(e => e.art === 'rechnung' && e.rechnungId).map(e => [e.rechnungId!, e]));
  const zahlung = zahlungsQuelle(k, bezug.firma) === 'firma' ? bezug.firma?.zahlung : k.zahlung;
  const zielTage = zahlung?.zielTage ?? bezug.mandate.find(m => m.status === 'aktiv')?.zahlungszielTage ?? 14;

  /** Ablage-Eintrag entfernen: Belege (Rechnung/Mandat) nur vom Bezug lösen, alles andere löschen (28.09., K3). */
  async function eintragLoeschen(e: DateiEintrag) {
    if (istBeleg(e)) { await eintragAendern(e.id, { rechnungId: null, mandatId: null }); return; }
    const r = await fetch(`/api/crm/dateien?id=${encodeURIComponent(e.id)}`, { method: 'DELETE' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (!r.ok) setMeldung(r.fehler ?? 'Nicht gelöscht.');
    await ablageLaden();
  }
  async function eintragAendern(id: string, felder: Record<string, unknown>) {
    const r = await fetch('/api/crm/dateien', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, felder }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (!r.ok) setMeldung(r.fehler ?? 'Nicht gespeichert.');
    await ablageLaden();
  }
  /** Rechnung anlegen/ändern — nur über den Finanzplan-PATCH, ein Eintrag. */
  async function rechnungSchreiben(eintrag: Record<string, unknown>): Promise<boolean> {
    const r = await fetch('/api/state/finanzplan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [{ liste: 'rechnungen', op: 'upsert', eintrag }] }) }).then(x => x.json()).catch(() => ({ ok: false, error: 'Keine Verbindung.' }));
    if (!r.ok || !r.angewandt) { setMeldung(r.error ?? 'Rechnung nicht gespeichert.'); await planLaden(); return false; }
    await planLaden();
    return true;
  }
  /**
   * Als bezahlt markieren (28.09.): EIN Aufruf — der Server setzt Status + Datum am aktuellen Eintrag
   * und legt die Buchung `bu-re-<id>` in derselben Sperre an (idempotent). Kein zweiter Aufruf, der verloren gehen kann.
   */
  async function alsBezahlt(id: string, am: string) {
    const r = await fetch('/api/state/finanzplan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'bezahlt', rechnungId: id, am }) })
      .then(x => x.json()).catch(() => ({ ok: false, error: 'Keine Verbindung — nichts geändert.' }));
    if (!r.ok) setMeldung(r.error ?? 'Nicht gespeichert.');
    else if (r.schonBezahlt) setMeldung('Schon als bezahlt markiert — Stand neu geladen.');
    await planLaden();
  }
  /**
   * Stornieren (28.09., K3): gestellte/bezahlte Rechnungen werden nicht gelöscht. Ein Aufruf — der Server setzt
   * Status, Datum, Grund und bucht bei vorhandenem Zahlungseingang die Gegenbuchung. Mit der Fassung, die wir kannten.
   */
  async function stornieren(r: UmsatzRechnung, grund: string) {
    const stand = r.fassung;
    const d = await fetch('/api/state/finanzplan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'storno', rechnungId: r.id, grund, ...(stand ? { stand } : {}) }) })
      .then(x => x.json()).catch(() => ({ ok: false, error: 'Keine Verbindung — nichts geändert.' }));
    if (!d.ok) setMeldung(d.error ?? 'Nicht storniert.');
    else setMeldung(d.stornoRechnung ? `Storniert — Stornorechnung ${d.stornoRechnung.nummer ?? ''} mit eigenem PDF angelegt.` : d.gegenbuchung === 'neu' ? 'Storniert — zum Zahlungseingang ist die Gegenbuchung angelegt.' : 'Storniert — die Rechnung bleibt als Beleg stehen.');
    await planLaden();
    await ablageLaden();
  }

  const planHinweis = kein ? <Leer>Rechnungen gehören zu den Business-Zahlen des Haushalts — für dieses Konto nicht freigegeben.</Leer>
    : plan === 'fehler' ? <Leer>Finanzplan nicht erreichbar.</Leer> : plan === null ? <Leer>lade …</Leer> : null;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {meldung && <Karte i={0} akzent={LEUCHT.achtung}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: TYP.bedien, color: C.inkDim }}><span>{meldung}</span><button onClick={() => setMeldung(null)} style={leiseLink}>ok</button></div></Karte>}

      {hatGruppe && (
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim, cursor: 'pointer' }}>
          <input type="checkbox" checked={gruppe} onChange={e => setGruppe(e.target.checked)} />
          Ganze Gruppe zusammenfassen{bezug.gruppe ? ` (${bezug.gruppe.map(f => f.name).join(' · ')})` : ' (Mutter- und Tochterfirmen)'}
        </label>
      )}
      <UmsatzKachel i={0} zu={zu.has('umsatz')} umschalten={umschalten} kz={kennzahlen} hinweis={planHinweis} />

      <ZahlungKachel i={1} zu={zu.has('zahlung')} umschalten={umschalten} k={k} api={api} firma={bezug.firma} zahlung={zahlung} heute={heute} />

      <KachelKarte id="vertraege" i={2} titel="Verträge" farbe={LEUCHT.agenten} kurz={vertraege.length ? `${vertraege.length}` : undefined} zu={zu.has('vertraege')} umschalten={umschalten}>
        <VertragNeu bezugListe={bezugListe} bezugFelder={bezugFelder} onFertig={ablageLaden} setMeldung={setMeldung} />
        {ablage === null ? <Leer>lade …</Leer> : !vertraege.length ? <Leer>Noch kein Vertrag abgelegt.</Leer> : vertraege.map(e => {
          const endetBald = e.vertrag?.bis && e.vertrag.bis >= heute && e.vertrag.bis <= plusTage(heute, 60);
          const abgelaufen = e.vertrag?.bis && e.vertrag.bis < heute;
          return (
            <ZeileKlein key={e.id} titel={e.titel || e.datei?.name || 'Vertrag'}
              unter={[VERTRAGSARTEN.find(a => a.id === e.vertrag?.vertragsart)?.label, e.vertrag?.von || e.vertrag?.bis ? `gültig ${e.vertrag?.von ? datum(e.vertrag.von) : '…'} – ${e.vertrag?.bis ? datum(e.vertrag.bis) : 'offen'}` : null, e.vertrag?.kuendigungsfrist ? `Kündigung ${e.vertrag.kuendigungsfrist}` : null, bezugText(e)].filter(Boolean).join(' · ')}
              rechts={<>{abgelaufen ? <Chip farbe={C.inkLeise}>abgelaufen</Chip> : endetBald ? <Chip farbe={LEUCHT.achtung}>endet {datum(e.vertrag!.bis!, heute)}</Chip> : null}<DateiLink e={e} /><LoeschKnopf beleg={istBeleg(e)} onJa={() => void eintragLoeschen(e)} /></>} />
          );
        })}
      </KachelKarte>

      <KachelKarte id="angebote" i={3} titel="Angebote" farbe={LEUCHT.business} kurz={angebote.length ? `${offenZahl} offen · ${angebote.length} gesamt` : undefined} zu={zu.has('angebote')} umschalten={umschalten}
        rechts={<Link href={angebotLink({ kontaktId: k.id, firmaId: bezug.firma?.id })} style={leiseLink}>+ Angebot</Link>}>
        <AngebotNeu bezugListe={bezugListe} bezugFelder={bezugFelder} heute={heute} onFertig={ablageLaden} setMeldung={setMeldung} />
        {!angebote.length ? <Leer>Noch kein Angebot — „+ Angebot“ oben rechts öffnet das Angebots-Tool.</Leer> : angebote.map(a => (
          <AngebotZeileAnsicht key={a.schluessel} a={a} heute={heute} zuDeal={zuDeal} aendern={eintragAendern} loeschen={eintragLoeschen}
            rechnungAusAngebot={kein ? undefined : (angebotId: string) => rechnungSchreibenOeffnen({ quelle: 'angebot', angebotId })}
            alsRechnung={plan === null || typeof plan !== 'object' ? undefined : async () => {
              const e = a.eintrag!;
              const mandat = e.mandatId ? bezug.mandate.find(m => m.id === e.mandatId) : bezug.mandate[0];
              // Register-Gesellschaft (04.10.): noch nicht im Finanzplan — Hinweis statt still bei der Selbstständigkeit. Ohne Mandat bzw.
              // Mandat „offen“: die operative Business-Gesellschaft (08.10.), sonst wählen über „+ Rechnung“ — nie still `kdc`.
              const rf = rechnungsFirma(mandat, vorgabe);
              if (rf.nurGrunddaten) { setMeldung(NUR_GRUNDDATEN); return; }
              const finanzFirma = rf.firmaId;
              if (!finanzFirma) { setMeldung('Keine eindeutige Gesellschaft für diese Rechnung — bitte unter Rechnungen „+ Rechnung“ nutzen und die Gesellschaft wählen.'); return; }
              const id = neueKennung('r');
              const ok = await rechnungSchreiben({ id, firmaId: finanzFirma, kunde: kundenName(k, bezug.firma), titel: e.titel || `Angebot ${e.angebot?.nummer ?? ''}`.trim(), betrag: e.angebot?.betrag ?? 0, status: 'geplant', ...(e.angebot?.nummer ? { angebot: e.angebot.nummer } : {}), ...(e.angebot?.datum ? { angebotAm: e.angebot.datum } : {}), ...(mandat ? { mandatId: mandat.id } : {}) });
              if (ok) await eintragAendern(e.id, { rechnungId: id });
            }} />
        ))}
      </KachelKarte>

      <KachelKarte id="rechnungen" i={4} titel="Rechnungen" farbe={LEUCHT.puls} kurz={rechnungen.length ? `${offen.length} offen · ${rechnungen.length} gesamt` : undefined} zu={zu.has('rechnungen')} umschalten={umschalten}
        rechts={<span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
          {!kein && <button onClick={() => { const m = bezug.mandate.find(x => x.status === 'aktiv') ?? bezug.mandate[0]; const rf = rechnungsFirma(m, vorgabe); void rechnungSchreibenOeffnen({ quelle: 'frei', kontaktId: k.id, ...(bezug.firma ? { kundeFirmaId: bezug.firma.id } : {}), ...(m ? { mandatId: m.id } : {}), ...(rf.firmaId ? { firmaId: rf.firmaId } : {}) }); }} style={leiseLink}>+ Rechnung schreiben (PDF)</button>}
          <a href={WEG.rechnungen()} style={leiseLink}>in den Finanzen ›</a>
        </span>}>
        {planHinweis ?? <>
          <RechnungNeu k={k} bezug={bezug} zielTage={zielTage} heute={heute} firmen={(plan as Plan).firmen} vorgabe={vorgabe} schreiben={rechnungSchreiben} />
          {!rechnungen.length ? <Leer>Noch keine Rechnung für {kundenName(k, bezug.firma) || 'diesen Kontakt'} im Finanzplan.</Leer> : rechnungen.map(z => (
            <RechnungZeile key={z.r.id} z={z} heute={heute} pdf={rechnungsPdf.get(z.r.id)} kontaktId={k.id} firmaId={bezug.firma?.id} onFertig={ablageLaden} setMeldung={setMeldung} loeschen={eintragLoeschen} stornieren={stornieren} />
          ))}
        </>}
      </KachelKarte>

      <KachelKarte id="eingang" i={5} titel="Zahlungseingang" farbe={LEUCHT.gut} kurz={bezahlt.length ? `${euro(kennzahlen.bezahlt)} eingegangen` : undefined} zu={zu.has('eingang')} umschalten={umschalten}>
        {planHinweis ?? <>
          {offen.length > 0 && <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '0 0 4px' }}>Offen</div>
            {offen.map(z => <OffeneZeile key={z.r.id} z={z} heute={heute} alsBezahlt={alsBezahlt} />)}
          </div>}
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '4px 0' }}>Eingegangen{kennzahlen.verzugSchnitt != null ? ` · im Schnitt ${kennzahlen.verzugSchnitt > 0 ? `${kennzahlen.verzugSchnitt} Tage nach Fälligkeit` : kennzahlen.verzugSchnitt < 0 ? `${-kennzahlen.verzugSchnitt} Tage vor Fälligkeit` : 'pünktlich'}` : ''}</div>
          {!bezahlt.length ? <Leer>Noch kein Zahlungseingang.</Leer> : bezahlt.map(z => (
            <ZeileKlein key={z.r.id} titel={<>{euro(z.r.betrag)} <span style={{ color: C.inkLeise, fontWeight: 500 }}>· {z.r.nummer ? `Nr. ${z.r.nummer} · ` : ''}{z.r.titel}</span></>}
              unter={`eingegangen ${z.r.bezahltAm ? datum(z.r.bezahltAm, heute) : 'ohne Datum'}${z.r.faellig ? ` · fällig war ${datum(z.r.faellig, heute)}` : ''}${z.perName ? ' · per Name zugeordnet' : ''}`}
              rechts={z.verzugTage != null ? <Chip farbe={z.verzugTage > 0 ? LEUCHT.achtung : LEUCHT.gut}>{z.verzugTage > 0 ? `${z.verzugTage} T Verzug` : 'pünktlich'}</Chip> : undefined} />
          ))}
        </>}
      </KachelKarte>
    </div>
  );
}

// ── Kachel: Umsatz mit dem Kunden ────────────────────────────────────────────

function UmsatzKachel({ i, zu, umschalten, kz, hinweis }: { i: number; zu: boolean; umschalten: (id: Kachel) => void; kz: ReturnType<typeof umsatzKennzahlen>; hinweis: ReactNode }) {
  const maxJahr = Math.max(1, ...kz.jeJahr.map(j => j.bezahlt));
  const maxEinheit = Math.max(1, ...kz.jeEinheit.map(e => e.bezahlt + e.offen));
  return (
    <KachelKarte id="umsatz" i={i} titel="Umsatz mit dem Kunden" farbe={LEUCHT.geld} kurz={kz.bezahlt ? euro(kz.bezahlt) : undefined} zu={zu} umschalten={umschalten}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14, marginBottom: 14 }}>
        <Zahl wert={euro(kz.bezahlt)} label="Umsatz (bezahlt)" farbe={LEUCHT.geld} />
        <Zahl wert={euro(kz.offen)} label="offen" />
        <Zahl wert={euro(kz.ueberfaellig)} label={`überfällig${kz.anzahlUeberfaellig ? ` (${kz.anzahlUeberfaellig})` : ''}`} farbe={kz.ueberfaellig ? LEUCHT.kritisch : undefined} />
        <Zahl wert={euro(kz.monatswert)} label={`Monatswert · ${kz.aktiveMandate} ${kz.aktiveMandate === 1 ? 'aktives Mandat' : 'aktive Mandate'}`} />
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10 }}>
        {kz.gewonneneDeals ? `${kz.gewonneneDeals} gewonnene ${kz.gewonneneDeals === 1 ? 'Deal' : 'Deals'} · ${euro(kz.gewonnenWert)}` : 'Noch kein gewonnener Deal'}
        {kz.geplant ? ` · ${euro(kz.geplant)} geplant` : ''}
        {kz.perName ? ` · ${kz.perName} ${kz.perName === 1 ? 'Rechnung' : 'Rechnungen'} per Name zugeordnet` : ''}
      </div>
      {hinweis}
      {kz.jeJahr.length > 0 && <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>je Jahr</div>
        <Balken werte={kz.jeJahr.map(j => j.bezahlt)} max={maxJahr} farbe={LEUCHT.geld} hoehe={40} titel={kz.jeJahr.map(j => `${j.jahr}: ${euro(j.bezahlt)}`)} />
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>{kz.jeJahr.map(j => <span key={j.jahr} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: C.inkLeise }}>{j.jahr}</span>)}</div>
      </div>}
      {kz.jeEinheit.length > 0 && <div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>je Einheit</div>
        {kz.jeEinheit.map(e => (
          <div key={e.einheit} style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 150px) 1fr auto', gap: 10, alignItems: 'center', padding: '4px 0', fontSize: TYP.bedien }}>
            <span style={{ color: C.inkDim }}>{e.einheit}</span>
            <span style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden', display: 'flex' }}>
              <span style={{ width: `${(e.bezahlt / maxEinheit) * 100}%`, background: LEUCHT.geld }} />
              <span style={{ width: `${(e.offen / maxEinheit) * 100}%`, background: `${LEUCHT.puls}88` }} />
            </span>
            <span style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{euro(e.bezahlt)}{e.offen ? <span style={{ color: C.inkLeise }}> + {euro(e.offen)} offen</span> : null}</span>
          </div>
        ))}
      </div>}
    </KachelKarte>
  );
}

// ── Kachel: Zahlungsmöglichkeiten ────────────────────────────────────────────

function ZahlungKachel({ i, zu, umschalten, k, api, firma, zahlung, heute }: { i: number; zu: boolean; umschalten: (id: Kachel) => void; k: Kontakt; api: CrmApi; firma?: { id: string; name: string }; zahlung?: Zahlungsdaten; heute: string }) {
  const quelle = zahlungsQuelle(k, firma);
  const z = zahlung ?? {};
  const [ibanNeu, setIbanNeu] = useState<string | null>(null);
  const [ibanFehler, setIbanFehler] = useState<string | null>(null);
  const luecken = zahlungLuecken(zahlung);

  // IBAN (28.09., H4): der Browser kennt sie nur maskiert. Zurück geht sie maskiert — der Server liest das als
  // „unverändert“; eine neue gültige IBAN ersetzt, Entfernen nur mit `ibanEntfernen: true`.
  function speichern(teil: Partial<Zahlungsdaten>) {
    const { ibanGesetzt: _g, ibanEntfernen: _e, ...basis } = z;
    const neu: Zahlungsdaten = { ...basis, ...teil, geaendert: heute, ...(api.ich ? { geaendertVon: api.ich } : {}) };
    if (quelle === 'firma' && firma) void api.teil('firmen', firma.id, { zahlung: neu });
    else void api.kontaktTeil(k.id, { zahlung: neu });
  }
  const empf = (feldName: 'name' | 'email' | 'anschrift') => (t: string) => speichern({ empfaenger: { ...(z.empfaenger ?? {}), [feldName]: t.trim() || undefined } });

  return (
    <KachelKarte id="zahlung" i={i} titel="Zahlungsmöglichkeiten" farbe={LEUCHT.planung} kurz={z.weg ? `${ZAHLUNGSWEG_LABEL[z.weg]}${z.zielTage != null ? ` · ${z.zielTage} Tage` : ''}` : undefined} zu={zu} umschalten={umschalten}>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 8 }}>
        {quelle === 'firma' ? `Gilt für alle Personen von ${firma!.name} — gespeichert an der Firma.` : 'Gespeichert an dieser Person (keine Firma hinterlegt).'}
        {luecken.length ? ` Fehlt noch: ${luecken.join(', ')}.` : ''}
      </div>
      <Feldzeile label="Zahlungsweg">
        <Wahl<Zahlungsweg> liste={ZAHLUNGSWEGE} wert={z.weg} label="Zahlungsweg" onWahl={w => speichern({ weg: w })} onLeeren={() => speichern({ weg: undefined })} />
      </Feldzeile>
      <Feldzeile label="Zahlungsziel (Tage)"><Feld typ="number" wert={z.zielTage != null ? String(z.zielTage) : ''} platzhalter="z. B. 14" breite="min(120px, 100%)" onFertig={t => speichern({ zielTage: t.trim() === '' ? undefined : Number(t) })} /></Feldzeile>
      <Feldzeile label="Rechnungsempfänger"><Feld wert={z.empfaenger?.name ?? ''} platzhalter="Name / Abteilung" onFertig={empf('name')} /></Feldzeile>
      <Feldzeile label="Rechnungs-E-Mail"><Feld typ="email" wert={z.empfaenger?.email ?? ''} platzhalter="rechnung@…" onFertig={empf('email')} /></Feldzeile>
      <Feldzeile label="Anschrift"><Feld wert={z.empfaenger?.anschrift ?? ''} platzhalter="Straße, PLZ Ort" onFertig={empf('anschrift')} /></Feldzeile>
      <Feldzeile label="USt-IdNr."><Feld wert={z.ustId ?? ''} platzhalter="DE…" breite="min(200px, 100%)" onFertig={t => speichern({ ustId: t.trim() || undefined })} /></Feldzeile>
      <Feldzeile label="Bestellnr. / Referenz"><Feld wert={z.referenz ?? ''} platzhalter="Referenz des Kunden" onFertig={t => speichern({ referenz: t.trim() || undefined })} /></Feldzeile>
      {z.weg === 'karte' && <Feldzeile label="Zahlungslink"><Feld wert={z.link ?? ''} platzhalter="https://…" onFertig={t => speichern({ link: t.trim() || undefined })} /></Feldzeile>}
      {(z.weg === 'sepa' || z.weg === 'ueberweisung' || z.iban) && <Feldzeile label="IBAN">
        {ibanNeu === null ? (
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums', color: z.iban ? C.ink : C.inkLeise }}>{z.iban ? ibanMaskiert(z.iban) : 'keine'}</span>
            <button onClick={() => { setIbanNeu(''); setIbanFehler(null); }} style={leiseLink}>{z.iban ? 'ersetzen' : '+ IBAN'}</button>
            {z.iban && <LoeschKnopf onJa={() => speichern({ iban: undefined, ibanEntfernen: true })} />}
          </span>
        ) : (
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={ibanNeu} onChange={e => setIbanNeu(e.target.value)} placeholder="IBAN eingeben" aria-label="IBAN" autoComplete="off" spellCheck={false} style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(260px, 100%)' }} />
            <Knopf onClick={() => { if (!ibanGueltig(ibanNeu)) { setIbanFehler('Prüfziffer stimmt nicht — bitte prüfen.'); return; } speichern({ iban: ibanNeu }); setIbanNeu(null); }}>Speichern</Knopf>
            <button onClick={() => setIbanNeu(null)} style={leiseLink}>Abbrechen</button>
            {ibanFehler && <span style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{ibanFehler}</span>}
          </span>
        )}
      </Feldzeile>}
      {z.weg === 'sepa' && <>
        <Feldzeile label="Mandatsreferenz"><Feld wert={z.sepa?.mandatsreferenz ?? ''} platzhalter="SEPA-Mandatsreferenz" onFertig={t => speichern({ sepa: { ...(z.sepa ?? {}), mandatsreferenz: t.trim() || undefined } })} /></Feldzeile>
        <Feldzeile label="Mandat erteilt am"><Feld typ="date" wert={z.sepa?.datum ?? ''} breite="min(170px, 100%)" onFertig={t => speichern({ sepa: { ...(z.sepa ?? {}), datum: t || undefined } })} /></Feldzeile>
      </>}
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Die IBAN steht nur maskiert hier, liegt verschlüsselt im Bestand und geht in keinen Export und an keinen Agenten.</div>
    </KachelKarte>
  );
}

// ── Verträge: neu ablegen ────────────────────────────────────────────────────

type BezugFelder = (wahl: string | null) => Record<string, string>;

function VertragNeu({ bezugListe, bezugFelder, onFertig, setMeldung }: { bezugListe: WahlEintrag<string>[]; bezugFelder: BezugFelder; onFertig: () => Promise<void>; setMeldung: (t: string) => void }) {
  const [offen, setOffen] = useState(false);
  const [datei, setDatei] = useState<File | null>(null);
  const [f, setF] = useState<{ titel: string; vertragsart: Vertragsart | null; von: string; bis: string; kuendigungsfrist: string; bezug: string | null }>({ titel: '', vertragsart: null, von: '', bis: '', kuendigungsfrist: '', bezug: null });
  const [laeuft, setLaeuft] = useState(false);
  if (!offen) return <div style={{ marginBottom: 6 }}><button onClick={() => setOffen(true)} style={leiseLink}>+ Vertrag hochladen</button></div>;
  async function los() {
    if (!datei) { setMeldung('Bitte zuerst eine Datei wählen.'); return; }
    setLaeuft(true);
    const r = await hochladen({ art: 'vertrag' satisfies DateiArt, titel: f.titel || undefined, vertrag: { vertragsart: f.vertragsart ?? 'sonstig', von: f.von || undefined, bis: f.bis || undefined, kuendigungsfrist: f.kuendigungsfrist || undefined }, ...bezugFelder(f.bezug) }, datei);
    setLaeuft(false);
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht hochgeladen.'); return; }
    setDatei(null); setF({ titel: '', vertragsart: null, von: '', bis: '', kuendigungsfrist: '', bezug: null }); setOffen(false);
    await onFertig();
  }
  return (
    <div style={{ padding: '6px 0 12px', borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 6 }}>
      <Feldzeile label="Datei"><DateiWahl datei={datei} setDatei={setDatei} text="Datei wählen (PDF, DOCX, Bild)" /></Feldzeile>
      <Feldzeile label="Titel"><input value={f.titel} onChange={e => setF({ ...f, titel: e.target.value })} placeholder="z. B. Rahmenvertrag 2026" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} /></Feldzeile>
      <Feldzeile label="Art"><Wahl<Vertragsart> liste={VERTRAGSARTEN} wert={f.vertragsart} label="Vertragsart" onWahl={v => setF({ ...f, vertragsart: v })} /></Feldzeile>
      <Feldzeile label="Gültig"><span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}><input type="date" value={f.von} onChange={e => setF({ ...f, von: e.target.value })} aria-label="gültig von" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(160px, 100%)' }} /><input type="date" value={f.bis} onChange={e => setF({ ...f, bis: e.target.value })} aria-label="gültig bis" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(160px, 100%)' }} /></span></Feldzeile>
      <Feldzeile label="Kündigungsfrist"><input value={f.kuendigungsfrist} onChange={e => setF({ ...f, kuendigungsfrist: e.target.value })} placeholder="z. B. 3 Monate zum Quartalsende" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} /></Feldzeile>
      {bezugListe.length > 0 && <Feldzeile label="Bezug"><Wahl<string> liste={bezugListe} wert={f.bezug} label="Mandat oder Deal" leer="+ Mandat/Deal" onWahl={v => setF({ ...f, bezug: v })} onLeeren={() => setF({ ...f, bezug: null })} /></Feldzeile>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><Knopf onClick={() => void los()} aus={laeuft || !datei}>{laeuft ? 'lädt …' : 'Hochladen'}</Knopf><Knopf leise onClick={() => setOffen(false)}>Abbrechen</Knopf></div>
    </div>
  );
}

// ── Angebote ─────────────────────────────────────────────────────────────────

function AngebotNeu({ bezugListe, bezugFelder, heute, onFertig, setMeldung }: { bezugListe: WahlEintrag<string>[]; bezugFelder: BezugFelder; heute: string; onFertig: () => Promise<void>; setMeldung: (t: string) => void }) {
  const [offen, setOffen] = useState(false);
  const [datei, setDatei] = useState<File | null>(null);
  const leer = { nummer: '', titel: '', datum: heute, betrag: '', bezug: null as string | null };
  const [f, setF] = useState(leer);
  const [laeuft, setLaeuft] = useState(false);
  if (!offen) return <div style={{ marginBottom: 6 }}><button onClick={() => setOffen(true)} style={{ ...leiseLink, color: C.inkLeise, fontWeight: 500 }}>+ Angebot ablegen (Datei, Altbestand)</button></div>;
  async function los() {
    setLaeuft(true);
    const r = await hochladen({ art: 'angebot' satisfies DateiArt, titel: f.titel || undefined, angebot: { nummer: f.nummer || undefined, datum: f.datum || undefined, betrag: f.betrag === '' ? undefined : Number(f.betrag.replace(',', '.')), status: 'offen' }, ...bezugFelder(f.bezug) }, datei);
    setLaeuft(false);
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht gespeichert.'); return; }
    setDatei(null); setF(leer); setOffen(false);
    await onFertig();
  }
  return (
    <div style={{ padding: '6px 0 12px', borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 6 }}>
      <Feldzeile label="Nummer"><input value={f.nummer} onChange={e => setF({ ...f, nummer: e.target.value })} placeholder="z. B. A-2026-014" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(220px, 100%)' }} /></Feldzeile>
      <Feldzeile label="Titel"><input value={f.titel} onChange={e => setF({ ...f, titel: e.target.value })} placeholder="Leistung" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} /></Feldzeile>
      <Feldzeile label="Datum · Betrag"><span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}><input type="date" value={f.datum} onChange={e => setF({ ...f, datum: e.target.value })} aria-label="Angebotsdatum" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(160px, 100%)' }} /><input inputMode="decimal" value={f.betrag} onChange={e => setF({ ...f, betrag: e.target.value })} placeholder="Betrag €" aria-label="Betrag" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(130px, 100%)' }} /></span></Feldzeile>
      {bezugListe.length > 0 && <Feldzeile label="Bezug"><Wahl<string> liste={bezugListe} wert={f.bezug} label="Mandat oder Deal" leer="+ Mandat/Deal" onWahl={v => setF({ ...f, bezug: v })} onLeeren={() => setF({ ...f, bezug: null })} /></Feldzeile>}
      <Feldzeile label="PDF (optional)"><DateiWahl datei={datei} setDatei={setDatei} /></Feldzeile>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><Knopf onClick={() => void los()} aus={laeuft || (!f.nummer && !f.titel && !f.betrag && !datei)}>{laeuft ? 'speichert …' : 'Anlegen'}</Knopf><Knopf leise onClick={() => setOffen(false)}>Abbrechen</Knopf></div>
    </div>
  );
}

function AngebotZeileAnsicht({ a, heute, zuDeal, aendern, loeschen, alsRechnung, rechnungAusAngebot }: { a: AngebotZeile; heute: string; zuDeal?: (id: string) => void; aendern: (id: string, felder: Record<string, unknown>) => Promise<void>; loeschen: (e: DateiEintrag) => Promise<void>; alsRechnung?: () => Promise<void>; /** Angebots-Tool (08.10.): angenommen → Rechnungsentwurf mit den Positionen. */ rechnungAusAngebot?: (angebotId: string) => Promise<void> }) {
  const e = a.eintrag;
  // Aus dem Angebots-Tool (28.09.): Status des Tools, öffnen im Tool (dort annehmen/ablehnen/neue Version).
  if (a.quelle === 'tool' && a.angebot) {
    const st = a.toolStatus ?? a.angebot.status;
    const farbe = st === 'gestellt' ? LEUCHT.achtung : st === 'angenommen' ? LEUCHT.gut : st === 'entwurf' ? C.inkDim : C.inkLeise;
    return (
      <ZeileKlein titel={<>{a.nummer ? `${a.nummer} · ` : ''}{a.titel}</>}
        unter={[a.datum ? datum(a.datum, heute) : null, a.betrag != null ? `${euro(a.betrag)} Gesamtwert` : null, `bis ${datum(a.angebot.gueltigBis)}`].filter(Boolean).join(' · ')}
        rechts={<><Chip farbe={farbe}>{ANGEBOT_STATUS_LABEL[st]}</Chip><Link href={angebotLink({ angebotId: a.angebot.id })} style={leiseLink}>öffnen ›</Link>{a.dealId && zuDeal && <button onClick={() => zuDeal(a.dealId!)} style={leiseLink}>Deal ›</button>}{st === 'angenommen' && rechnungAusAngebot && <button onClick={() => void rechnungAusAngebot(a.angebot!.id)} style={leiseLink}>→ Rechnung schreiben</button>}</>} />
    );
  }
  const quelle = a.quelle === 'deal' ? 'aus dem Deal' : a.quelle === 'rechnung' ? 'im Finanzplan' : e?.datei ? 'abgelegt' : 'erfasst';
  return (
    <ZeileKlein
      titel={<>{a.nummer ? `${a.nummer} · ` : ''}{a.titel}</>}
      unter={[a.datum ? datum(a.datum, heute) : null, a.betrag != null ? euro(a.betrag) : null, quelle].filter(Boolean).join(' · ')}
      rechts={<>
        {e ? <Wahl<AngebotStatus> klein liste={ANGEBOT_STATUS} wert={a.status} label="Status" farbe={STATUS_FARBE[a.status]} onWahl={s => void aendern(e.id, { angebot: { ...(e.angebot ?? {}), status: s } })} />
          : <Chip farbe={STATUS_FARBE[a.status]}>{a.status}</Chip>}
        {a.quelle === 'deal' && a.dealId && zuDeal && <button onClick={() => zuDeal(a.dealId!)} style={leiseLink}>Deal ›</button>}
        {a.rechnungId && <a href={WEG.rechnung(a.rechnungId)} style={leiseLink}>Rechnung ›</a>}
        {e && a.status === 'angenommen' && !e.rechnungId && alsRechnung && <button onClick={() => void alsRechnung()} style={leiseLink}>→ als Rechnung planen</button>}
        {e && <DateiLink e={e} />}
        {e && <LoeschKnopf beleg={istBeleg(e)} onJa={() => void loeschen(e)} />}
      </>} />
  );
}

// ── Rechnungen ───────────────────────────────────────────────────────────────

function RechnungNeu({ k, bezug, zielTage, heute, firmen, vorgabe, schreiben }: { k: Kontakt; bezug: ReturnType<typeof umsatzBezug>; zielTage: number; heute: string; firmen: { id: string; name: string }[]; vorgabe: Gesellschaftskennung | null; schreiben: (e: Record<string, unknown>) => Promise<boolean> }) {
  const [offen, setOffen] = useState(false);
  const aktiv = bezug.mandate.find(m => m.status === 'aktiv') ?? bezug.mandate[0];
  // Wählbar sind die Gesellschaften des Finanzplans (ohne Privat) — die Vorbelegung rechnet `rechnungVorbelegung` (lib/crm/umsatz.ts):
  // Brutto aus dem Netto-Honorar, Gesellschaft des Mandats bzw. die operative Business-Gesellschaft, Status „geplant“ (08.10., 3.2/3.9).
  const eigene = firmen.filter(f => f.id !== 'privat').map(f => ({ id: f.id, label: einheitAusGesellschaft(f.id) ?? f.name, hinweis: f.name }));
  type Form = { nummer: string; titel: string; betrag: string; datum: string; faellig: string; mandatId: string | null; firmaId: string | null; status: 'gestellt' | 'geplant'; nurGrunddaten: boolean };
  const ausMandat = (m: (typeof bezug.mandate)[number] | undefined) => { const v = rechnungVorbelegung(m, vorgabe); return { titel: v.titel, betrag: v.betrag, mandatId: v.mandatId, firmaId: v.firmaId && eigene.some(e => e.id === v.firmaId) ? v.firmaId : null, nurGrunddaten: v.nurGrunddaten }; };
  const start = (): Form => ({ nummer: '', datum: heute, faellig: plusTage(heute, zielTage), status: 'geplant', ...ausMandat(aktiv) });
  const [f, setF] = useState(start);
  const [laeuft, setLaeuft] = useState(false);
  if (!offen) return <div style={{ marginBottom: 6 }}><button onClick={() => { setF(start()); setOffen(true); }} style={leiseLink}>+ Rechnung</button></div>;
  const mandatListe = bezug.mandate.map(m => ({ id: m.id, label: m.titel, hinweis: m.kunde }));
  const mandat = f.mandatId ? bezug.mandate.find(m => m.id === f.mandatId) : undefined;
  // „gestellt“ nur mit Nummer — eine gestellte Rechnung ohne Nummer gibt es nicht (sie ist ab dann festgeschrieben).
  const fehlt = [!f.betrag.trim() ? 'Betrag' : '', !f.firmaId ? 'Gesellschaft' : '', f.status === 'gestellt' && !f.nummer.trim() ? 'Rechnungsnummer (für „gestellt“)' : ''].filter(Boolean);
  async function los() {
    if (!f.firmaId || fehlt.length) return;
    setLaeuft(true);
    const ok = await schreiben(rechnungAusFormular({ ...f, firmaId: f.firmaId }, mandat, { id: neueKennung('r'), kunde: kundenName(k, bezug.firma) }));
    setLaeuft(false);
    if (ok) setOffen(false);
  }
  return (
    <div style={{ padding: '6px 0 12px', borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 6 }}>
      <Feldzeile label="Status"><Wahl<'gestellt' | 'geplant'> liste={[{ id: 'gestellt', label: 'gestellt' }, { id: 'geplant', label: 'geplant' }]} wert={f.status} label="Status" onWahl={s => setF({ ...f, status: s })} /></Feldzeile>
      <Feldzeile label="Nummer"><input value={f.nummer} onChange={e => setF({ ...f, nummer: e.target.value })} placeholder="Rechnungsnummer" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(220px, 100%)' }} /></Feldzeile>
      <Feldzeile label="Titel"><input value={f.titel} onChange={e => setF({ ...f, titel: e.target.value })} placeholder="Leistung" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} /></Feldzeile>
      <Feldzeile label="Betrag € brutto"><input inputMode="decimal" value={f.betrag} onChange={e => setF({ ...f, betrag: e.target.value })} placeholder="brutto" aria-label="Betrag brutto in Euro" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(140px, 100%)' }} />{mandat?.honorar.netto && mandat.honorar.betrag ? <span style={{ fontSize: TYP.bedien, color: C.inkLeise, marginLeft: 8 }}>Honorar {euro(mandat.honorar.betrag)} netto + {mandat.ustSatz} % USt</span> : null}</Feldzeile>
      <Feldzeile label="Datum · fällig"><span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}><input type="date" value={f.datum} onChange={e => setF({ ...f, datum: e.target.value, faellig: e.target.value ? plusTage(e.target.value, zielTage) : f.faellig })} aria-label="Rechnungsdatum" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(160px, 100%)' }} /><input type="date" value={f.faellig} onChange={e => setF({ ...f, faellig: e.target.value })} aria-label="fällig am" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(160px, 100%)' }} /></span></Feldzeile>
      {mandatListe.length > 0 && <Feldzeile label="Mandat"><Wahl<string> liste={mandatListe} wert={f.mandatId} label="Mandat" onWahl={v => setF({ ...f, ...ausMandat(bezug.mandate.find(x => x.id === v)), mandatId: v })} onLeeren={() => setF({ ...f, mandatId: null, nurGrunddaten: false })} /></Feldzeile>}
      {eigene.length > 0 && <Feldzeile label="Gesellschaft"><Wahl<string> liste={eigene} wert={f.firmaId} label="Gesellschaft" leer="Gesellschaft wählen ▾" onWahl={v => setF({ ...f, firmaId: v, nurGrunddaten: false })} /></Feldzeile>}
      {f.nurGrunddaten && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, margin: '4px 0' }}>{NUR_GRUNDDATEN}</div>}
      {!f.firmaId && !f.nurGrunddaten && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, margin: '4px 0' }}>Keine eindeutige Gesellschaft — bitte wählen, bei welcher Gesellschaft die Rechnung in den Finanzplan geht.</div>}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '4px 0' }}>Geht in den Finanzplan (Kunde „{kundenName(k, bezug.firma)}“){f.mandatId ? ', mit Bezug zum Mandat' : ' — ohne Mandat wird sie per Name zugeordnet'}.</div>
      {fehlt.length > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '4px 0' }}>fehlt: {fehlt.join(', ')}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><Knopf onClick={los} aus={laeuft || fehlt.length > 0}>{laeuft ? 'speichert …' : 'Anlegen'}</Knopf><Knopf leise onClick={() => setOffen(false)}>Abbrechen</Knopf></div>
    </div>
  );
}

function RechnungZeile({ z, heute, pdf, kontaktId, firmaId, onFertig, setMeldung, loeschen, stornieren }: { z: ZugeordneteRechnung; heute: string; pdf?: DateiEintrag; kontaktId: string; firmaId?: string; onFertig: () => Promise<void>; setMeldung: (t: string) => void; loeschen: (e: DateiEintrag) => Promise<void>; stornieren: (r: UmsatzRechnung, grund: string) => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [laeuft, setLaeuft] = useState(false);
  const status = z.ueberfaellig ? 'ueberfaellig' : z.r.status;
  async function pdfHoch(datei: File | null) {
    if (!datei) return;
    setLaeuft(true);
    const r = await hochladen({ art: 'rechnung', titel: z.r.nummer ? `Rechnung ${z.r.nummer}` : z.r.titel, rechnungId: z.r.id, kontaktId, ...(firmaId ? { firmaId } : {}), ...(z.r.mandatId ? { mandatId: z.r.mandatId } : {}) }, datei);
    setLaeuft(false);
    if (!r.ok) setMeldung(r.fehler ?? 'Nicht hochgeladen.');
    await onFertig();
  }
  return (
    <ZeileKlein
      titel={<>{z.r.nummer ? `Nr. ${z.r.nummer} · ` : ''}{z.r.titel} <span style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>· {euro(z.r.betrag)}</span></>}
      unter={[z.r.datum ? `vom ${datum(z.r.datum, heute)}` : null, z.r.faellig ? `fällig ${datum(z.r.faellig, heute)}` : null, z.r.bezahltAm ? `bezahlt ${datum(z.r.bezahltAm, heute)}` : null, z.r.storniertAm ? `storniert ${datum(z.r.storniertAm, heute)}${z.r.stornoGrund ? ` (${z.r.stornoGrund})` : ''}` : null, z.einheit, z.perName ? 'per Name zugeordnet' : null].filter(Boolean).join(' · ')}
      rechts={<>
        <Chip farbe={STATUS_FARBE[status] ?? C.inkLeise}>{status === 'ueberfaellig' ? 'überfällig' : status}</Chip>
        {(z.r.status === 'gestellt' || z.r.status === 'bezahlt') && <StornoKnopf onJa={grund => stornieren(z.r, grund)} />}
        {z.r.status === 'geplant' && <Link href={WEG.rechnungSchreiben(z.r.id)} style={leiseLink}>Rechnung schreiben ›</Link>}
        {pdf ? <><DateiLink e={pdf} />{!pdf.rechnungsPdf && <LoeschKnopf beleg={istBeleg(pdf)} onJa={() => void loeschen(pdf)} />}</> : <>
          <input ref={ref} type="file" accept={ANNEHMEN} hidden onChange={e => void pdfHoch(e.target.files?.[0] ?? null)} />
          <button onClick={() => ref.current?.click()} style={leiseLink} disabled={laeuft}>{laeuft ? 'lädt …' : '+ PDF'}</button>
        </>}
        <a href={WEG.rechnung(z.r.id)} style={leiseLink}>Finanzen ›</a>
      </>} />
  );
}

function OffeneZeile({ z, heute, alsBezahlt }: { z: ZugeordneteRechnung; heute: string; alsBezahlt: (id: string, am: string) => Promise<void> }) {
  const [am, setAm] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  return (
    <ZeileKlein
      titel={<>{euro(z.r.betrag)} <span style={{ color: C.inkLeise, fontWeight: 500 }}>· {z.r.nummer ? `Nr. ${z.r.nummer} · ` : ''}{z.r.titel}</span></>}
      unter={`${z.r.faellig ? `fällig ${datum(z.r.faellig, heute)}` : 'ohne Fälligkeit'}${z.ueberfaellig ? ' · überfällig' : ''}${z.perName ? ' · per Name zugeordnet' : ''}`}
      rechts={am === null
        ? <button onClick={() => setAm(heute)} style={leiseLink}>als bezahlt markieren</button>
        : <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={am} max={heute} onChange={e => setAm(e.target.value)} aria-label="bezahlt am" style={{ ...feld, fontSize: TYP.bedien, padding: '6px 10px', width: 'min(150px, 100%)' }} />
          <Knopf onClick={async () => { setLaeuft(true); await alsBezahlt(z.r.id, am || heute); setLaeuft(false); setAm(null); }} aus={laeuft || !am}>{laeuft ? '…' : 'bezahlt'}</Knopf>
          <button onClick={() => setAm(null)} style={leiseLink}>Abbrechen</button>
        </span>} />
  );
}
