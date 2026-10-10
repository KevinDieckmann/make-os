'use client';

// ─── „+ Mandat“ mit Lead · „Firma zuordnen“ (Produkte & Mandate, 10.10.) ──────────────────────────────────────────────────
// Entscheidung 10.10.: beim Anlegen eines Kunden/Mandats IMMER Firma + Ansprechperson — vorhandene per Klick wählen (Wahl-Chip mit Suche) oder
// direkt neu anlegen („„…“ anlegen“ im Menü). Geschrieben wird erst mit „Mandat anlegen“, über EINEN Server-Weg (POST /api/crm/lead
// `mandat-neu` bzw. `mandat-firma`, lib/crm/mandat-anlegen-server.ts): Firma ohne Dublette, Person über „Person anlegen“, Firma/Lead → Kunde,
// Personen → Lebensphase Kunde. Dublette → „Diese Person nehmen“; eingeschränkte Personen (Art. 18) stehen nicht zur Wahl (der Server lehnt sie ab).
// Aus einer Stufe der Leistungstreppe heraus ist Produkt + Stufe vorbelegt. „Firma zuordnen“ = derselbe Dialog für ein Mandat ohne Firma.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Hinweis, Pillen, feld } from '../ui';
import { Fenster } from '../Fenster';
import { Wahl } from './Wahl';
import { GesellschaftWahl } from './GesellschaftWahl';
import { anzeigename } from '@/lib/make-one/crm';
import { bestehendeFirma } from '@/lib/crm/firmen';
import { personenDerFirma } from '@/lib/crm/stationen';
import type { Gesellschaft } from '@/lib/crm/typen';
import type { CrmApi } from './daten';

const NEU_FIRMA = 'neu:firma';
const NEU_PERSON = 'neu:person';
const beschriftung = { fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: C.inkLeise };
const neueId = () => `mandat-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('-')}`;

export interface MandatAnlegenProps {
  api: CrmApi;
  /** „neu“ = „+ Mandat“; „zuordnen“ = Firma (+ Person) an ein bestehendes Mandat ohne Firma. */
  modus: 'neu' | 'zuordnen';
  mandatId?: string;
  gesellschaft?: Gesellschaft;
  /** Aus einer Stufe der Leistungstreppe: Produkt und Stufe vorbelegt. */
  stufe?: { id: string; name: string; leistungId?: string };
  /** Zuständig für das neue Mandat (Team-Kürzel) — sonst die Sales-Verantwortung. */
  zustaendig?: string;
  onZu: () => void;
  onFertig: (mandatId: string) => void;
}

export function MandatAnlegen({ api, modus, mandatId, gesellschaft, stufe, zustaendig, onZu, onFertig }: MandatAnlegenProps) {
  const firmen = useMemo(() => (api.crm?.stand.firmen ?? []).filter(f => !f.geloeschtAm), [api.crm]);
  const kontakte = useMemo(() => (api.kontakte ?? []).filter(k => !k.eingeschraenkt), [api.kontakte]);
  const [ges, setGes] = useState<Gesellschaft>(gesellschaft ?? 'offen');
  const [firmaId, setFirmaId] = useState<string | null>(null);
  const [firmaNeu, setFirmaNeu] = useState('');
  const [personId, setPersonId] = useState<string | null>(null);
  const [neu, setNeu] = useState({ vorname: '', nachname: '', email: '', position: '', anrede: 'Sie' as 'Sie' | 'Du' });
  const [titel, setTitel] = useState('');
  const [leistungId, setLeistungId] = useState<string | null>(stufe?.leistungId ?? null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [dublette, setDublette] = useState<{ id: string; name: string } | null>(null);
  const anfrageId = useRef(neueId());

  const firmenListe = [...(firmaNeu ? [{ id: NEU_FIRMA, label: `${firmaNeu} (neu)` }] : []), ...firmen.map(f => ({ id: f.id, label: f.name }))];
  // Personen der gewählten Firma zuerst (aktuelle Stationen), danach alle übrigen — Suche im Menü.
  const derFirma = firmaId && firmaId !== NEU_FIRMA ? personenDerFirma(kontakte, firmaId, { nurAktiv: true }) : [];
  const rest = kontakte.filter(k => !derFirma.some(x => x.id === k.id));
  const personenListe = [
    ...(personId === NEU_PERSON ? [{ id: NEU_PERSON, label: `${[neu.vorname, neu.nachname].filter(Boolean).join(' ') || 'Neue Person'} (neu)` }] : []),
    ...derFirma.map(k => ({ id: k.id, label: `${anzeigename(k)} · ${firmen.find(f => f.id === firmaId)?.name ?? ''}` })),
    ...rest.map(k => ({ id: k.id, label: `${anzeigename(k)}${k.firma ? ` · ${k.firma}` : ''}` })),
  ];
  const leistungen = (api.crm?.stand.leistungen ?? []).filter(l => !l.geloeschtAm && l.status !== 'eingestellt').map(l => ({ id: l.id, label: l.name }));

  const firmaAnlegen = async (text: string): Promise<string | null> => {
    // Gibt es die Firma schon (auch mit anderer Rechtsform/Schreibweise)? Dann diese — nie eine Dublette.
    const da = bestehendeFirma(firmen, text);
    if (da) { setFirmaNeu(''); setFehler(null); return da.id; }
    setFirmaNeu(text.trim());
    return NEU_FIRMA;
  };
  const personAnlegen = async (text: string): Promise<string | null> => {
    const teile = text.trim().split(/\s+/);
    setNeu(n => ({ ...n, vorname: teile.length > 1 ? teile.slice(0, -1).join(' ') : '', nachname: teile[teile.length - 1] ?? '' }));
    return NEU_PERSON;
  };
  const firmaWert = firmaId === NEU_FIRMA ? { name: firmaNeu } : firmaId ? { id: firmaId } : null;
  const personWert = personId === NEU_PERSON ? { neu: { ...neu } } : personId ? { id: personId } : null;
  // Die Gesellschaft wird VOR dem Anlegen gewählt (08.10., 3.13) — sonst landete die Rechnung still bei der Vorgabe.
  const fertig = !!firmaWert && (modus === 'zuordnen' || (!!personWert && ges !== 'offen')) && (personId !== NEU_PERSON || !!(neu.vorname || neu.nachname));

  const anlegen = async () => {
    if (!firmaWert) { setFehler('Bitte eine Firma wählen oder neu anlegen.'); return; }
    if (modus === 'neu' && !personWert) { setFehler('Bitte eine Ansprechperson wählen oder neu anlegen.'); return; }
    const body = modus === 'neu'
      ? { aktion: 'mandat-neu', firma: firmaWert, person: personWert, gesellschaft: ges, ...(titel.trim() ? { titel: titel.trim() } : {}), ...(leistungId ? { leistungId } : {}), ...(stufe ? { stufeId: stufe.id } : {}), ...(zustaendig ? { zustaendig } : {}), anfrageId: anfrageId.current }
      : { aktion: 'mandat-firma', mandatId, firma: firmaWert, ...(personWert ? { person: personWert } : {}) };
    const r = await fetch('/api/crm/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || !j.ok) {
      anfrageId.current = neueId();
      setDublette(j.dublette ?? null);
      setFehler(String(j.fehler ?? 'Nicht angelegt — bitte noch einmal.'));
      return;
    }
    setFehler(null);
    await api.laden(true);
    window.dispatchEvent(new Event('make-treppe-geaendert'));
    onFertig(String(j.mandatId));
  };

  const reihe = (label: string, kind: ReactNode) => <label style={{ display: 'grid', gap: 6, minWidth: 0 }}><span style={beschriftung}>{label}</span>{kind}</label>;
  const input = (k: keyof typeof neu, platzhalter: string, typ = 'text') => <input value={String(neu[k])} type={typ} placeholder={platzhalter} aria-label={platzhalter} onChange={e => setNeu(n => ({ ...n, [k]: e.target.value }))} style={{ ...feld, fontSize: 16 }} />;
  return (
    <Fenster titel={modus === 'neu' ? (stufe ? `Neuer Kunde in „${stufe.name}“` : 'Neues Mandat') : 'Firma zuordnen'} onZu={onZu} breit={620}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
          {modus === 'neu' ? 'Ein Mandat hängt immer an einem Lead: Firma und Ansprechperson. Vorhandene wählen oder im Menü neu anlegen — danach steht die Firma unter den Kunden.' : 'Das Mandat bekommt eine Firma (und optional eine Ansprechperson). Sonst bleibt am Mandat alles, wie es ist.'}
        </div>
        {fehler && <Hinweis art={dublette ? 'achtung' : 'kritisch'} aktion={dublette ? <Knopf leise onClick={() => { setPersonId(dublette.id); setDublette(null); setFehler(null); }}>Diese Person nehmen</Knopf> : undefined}>{fehler}</Hinweis>}
        {modus === 'neu' && reihe('Gesellschaft', <GesellschaftWahl wert={ges} onWahl={setGes} />)}
        {reihe('Firma', <Wahl label="Firma" liste={firmenListe} wert={firmaId} leer="Firma wählen oder anlegen" onWahl={v => { setFirmaId(v); if (v !== NEU_FIRMA) setFirmaNeu(''); }} onNeu={firmaAnlegen} />)}
        {reihe(modus === 'neu' ? 'Ansprechperson' : 'Ansprechperson (optional)', <Wahl label="Ansprechperson" liste={personenListe} wert={personId} leer="Person wählen oder anlegen" onWahl={setPersonId} onNeu={personAnlegen} {...(modus === 'zuordnen' ? { onLeeren: () => setPersonId(null) } : {})} />)}
        {personId === NEU_PERSON && (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
            {input('vorname', 'Vorname')}
            {input('nachname', 'Nachname')}
            {input('email', 'E-Mail', 'email')}
            {input('position', 'Position')}
            <div style={{ display: 'grid', gap: 6 }}><span style={beschriftung}>Anrede</span><Pillen liste={[{ id: 'Sie' as const, label: 'Sie' }, { id: 'Du' as const, label: 'Du' }]} aktiv={neu.anrede} onWahl={a => setNeu(n => ({ ...n, anrede: a }))} /></div>
          </div>
        )}
        {modus === 'neu' && reihe('Titel (optional)', <input value={titel} placeholder={leistungId ? leistungen.find(l => l.id === leistungId)?.label : 'z. B. Begleitung 2027'} onChange={e => setTitel(e.target.value)} style={{ ...feld, fontSize: 16 }} />)}
        {modus === 'neu' && reihe('Produkt (optional)', <Wahl label="Produkt" liste={leistungen} wert={leistungId} leer="ohne Produkt" onWahl={setLeistungId} onLeeren={() => setLeistungId(null)} />)}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf haupt aus={!fertig} onClick={anlegen}>{modus === 'neu' ? 'Mandat anlegen' : 'Firma zuordnen'}</Knopf>
        </div>
      </div>
    </Fenster>
  );
}

/** Knopf „Firma zuordnen“ am Mandat ohne Firma — öffnet denselben Dialog (nur auf Klick; sonst bleibt das Mandat, wie es ist). */
export function FirmaZuordnen({ api, mandatId }: { api: CrmApi; mandatId: string }) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <Knopf leise onClick={() => setOffen(true)}>Firma zuordnen</Knopf>
      {offen && <MandatAnlegen api={api} modus="zuordnen" mandatId={mandatId} onZu={() => setOffen(false)} onFertig={() => setOffen(false)} />}
    </>
  );
}
