'use client';

import Link from 'next/link';
import { WEG } from '@/lib/wege';

// ─── Markttraktion · Firmen — ein Unternehmen, alle Beziehungen ─────────────
// Die Firma ist eigene Stammdaten (lib/crm/firmen.ts): Branche, Größe, Ort,
// Webseite an EINER Stelle. Die Karteikarte zeigt alle Personen, Chancen,
// Mandate und den gemeinsamen Verlauf. Rolle wird aus den Personen
// abgeleitet, bis sie von Hand gesetzt wird.

import { useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Zeile, Leer, Knopf, Chip, Punkt, Spalten, Spalte, useBreit, feld, LEUCHT } from '../schlank';
import { anzeigename, type Aktivitaet } from '@/lib/make-one/crm';
import { firmenId, firmenDubletten } from '@/lib/crm/firmen';
import type { Firma, FirmaRolle } from '@/lib/crm/typen';
import { type CrmApi, datum, euro } from './daten';
import { Feldzeile, Pillen, Feld, Verlauf } from './teile';
import { Person } from './team';
import { LeadBlock } from './Leads';
import { haeltBeziehung, nameVon } from '@/lib/crm/team';

export const ROLLEN: { id: FirmaRolle; label: string; farbe: string }[] = [
  { id: 'kunde', label: 'Kunde', farbe: LEUCHT.gut }, { id: 'zielkunde', label: 'Zielkunde', farbe: LEUCHT.business }, { id: 'partner', label: 'Partner', farbe: LEUCHT.agenten },
  { id: 'netzwerk', label: 'Netzwerk', farbe: LEUCHT.beziehung }, { id: 'dienstleister', label: 'Dienstleister', farbe: LEUCHT.puls }, { id: 'investor', label: 'Investor', farbe: LEUCHT.geld },
  { id: 'ex_kunde', label: 'Ex-Kunde', farbe: C.inkDim }, { id: 'wettbewerb', label: 'Wettbewerb', farbe: LEUCHT.kritisch }, { id: 'offen', label: 'offen', farbe: C.inkLeise },
];
const RECHTSFORMEN = ['GmbH', 'UG (haftungsbeschränkt)', 'GmbH & Co. KG', 'AG', 'SE', 'KG', 'OHG', 'GbR', 'e. K.', 'Einzelunternehmen', 'Freiberufler', 'e. V.', 'eG', 'Ltd.', 'Körperschaft öffentl. Rechts'];
const rolle = (r: FirmaRolle) => ROLLEN.find(x => x.id === r) ?? ROLLEN[ROLLEN.length - 1];

type Ansicht = 'alle' | FirmaRolle | 'ohne_branche' | 'dubletten';
const FIRMEN_SPALTEN = '10px minmax(0,1.5fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,.8fr) 44px 84px';

export function Firmen({ api, auswahl, setAuswahl, zuPerson, suche }: { api: CrmApi; auswahl: string | null; setAuswahl: (id: string | null) => void; zuPerson: (id: string) => void; suche: string }) {
  const breit = useBreit();
  const [ansicht, setAnsicht] = useState<Ansicht>('alle');
  const [mehr, setMehr] = useState(80);
  const firmen = api.crm?.stand.firmen ?? [];
  const kontakte = api.kontakte ?? [];
  const personenJe = useMemo(() => { const m = new Map<string, number>(); for (const k of kontakte) if (k.firmaId) m.set(k.firmaId, (m.get(k.firmaId) ?? 0) + 1); return m; }, [kontakte]);
  const dubl = useMemo(() => (ansicht === 'dubletten' ? firmenDubletten(firmen) : []), [ansicht, firmen]);
  const ANSICHTEN: { id: Ansicht; label: string }[] = [
    { id: 'alle', label: `Alle ${firmen.length}` }, ...ROLLEN.filter(r => firmen.some(f => f.rolle === r.id)).map(r => ({ id: r.id as Ansicht, label: `${r.label} ${firmen.filter(f => f.rolle === r.id).length}` })),
    { id: 'ohne_branche', label: 'Ohne Branche' }, { id: 'dubletten', label: 'Dubletten' },
  ];
  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    let l = firmen;
    if (ansicht === 'ohne_branche') l = l.filter(f => !f.branche);
    else if (ansicht === 'dubletten') { const ids = new Set(dubl.flatMap(([a, b]) => [a.id, b.id])); l = l.filter(f => ids.has(f.id)); }
    else if (ansicht !== 'alle') l = l.filter(f => f.rolle === ansicht);
    if (q) l = l.filter(f => `${f.name} ${f.domain ?? ''} ${f.branche ?? ''} ${f.stadt ?? ''}`.toLowerCase().includes(q));
    const R = ['kunde', 'zielkunde', 'partner', 'netzwerk', 'investor', 'dienstleister', 'ex_kunde', 'wettbewerb', 'offen'];
    return [...l].sort((a, b) => R.indexOf(a.rolle) - R.indexOf(b.rolle) || (personenJe.get(b.id) ?? 0) - (personenJe.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [firmen, ansicht, suche, dubl, personenJe]);
  const f = auswahl ? firmen.find(x => x.id === auswahl) ?? null : null;
  const ohneBranche = firmen.filter(x => !x.branche).length;

  // Breit: dichte Tabelle wie in einer guten Adressverwaltung (Firma · Domain · Branche · Ort · Personen · Rolle).
  const zeile = (x: Firma) => breit ? (
    <div key={x.id} onClick={() => setAuswahl(auswahl === x.id ? null : x.id)} className="fassbar" title={[x.name, x.branche, x.stadt].filter(Boolean).join(' · ')}
      style={{ display: 'grid', gridTemplateColumns: FIRMEN_SPALTEN, gap: 12, alignItems: 'center', padding: '8px 8px', minHeight: 40, borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', fontSize: TYP.bedien, background: auswahl === x.id ? 'rgba(255,255,255,.07)' : 'transparent', borderRadius: auswahl === x.id ? 8 : 0 }}>
      <Punkt farbe={rolle(x.rolle).farbe} groesse={8} />
      <span style={{ fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span>
      <span style={{ color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.domain ?? '—'}</span>
      <span style={{ color: x.branche ? C.inkDim : C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.branche ?? '—'}</span>
      <span style={{ color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.stadt ?? '—'}</span>
      <span style={{ textAlign: 'right', color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{personenJe.get(x.id) ?? '—'}</span>
      <span style={{ fontSize: 12, color: rolle(x.rolle).farbe, whiteSpace: 'nowrap' }}>{rolle(x.rolle).label}</span>
    </div>
  ) : (
    <div key={x.id}>
      <Zeile onClick={() => setAuswahl(auswahl === x.id ? null : x.id)} aktiv={auswahl === x.id} links={<Punkt farbe={rolle(x.rolle).farbe} />}
        titel={<>{x.name}{x.domain && <span style={{ color: C.inkLeise }}> · {x.domain}</span>}</>}
        unter={[x.branche, x.stadt, x.mitarbeiter ? `${x.mitarbeiter} MA` : ''].filter(Boolean).join(' · ') || 'keine Details'}
        rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{personenJe.get(x.id) ?? 0} P.</span><Chip farbe={rolle(x.rolle).farbe}>{rolle(x.rolle).label}</Chip></span>} />
      {auswahl === x.id && <div style={{ padding: '8px 0 18px' }}><FirmenKarte f={x} api={api} zuPerson={zuPerson} /></div>}
    </div>
  );

  return (
    <Spalten verhaeltnis="3:2">
      <Spalte>
        <Karte i={0}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10 }}>
            <span><b style={{ color: C.ink }}>{suche ? treffer.length : firmen.length}</b> {suche ? 'Treffer' : 'Firmen'}</span>
            <span><b style={{ color: ohneBranche ? LEUCHT.achtung : C.ink }}>{ohneBranche}</b> ohne Branche</span>
            <span><b style={{ color: C.ink }}>{firmen.filter(x => x.rolle === 'kunde').length}</b> Kunden</span>
          </div>
          <div style={{ marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={ANSICHTEN} aktiv={ansicht} onWahl={a => { setAnsicht(a); setMehr(80); }} /></div>
          {ansicht === 'dubletten' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {dubl.map(([a, b]) => <div key={`${a.id}|${b.id}`} style={{ fontSize: TYP.bedien, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.03)' }}>{a.name} ⇄ {b.name}{a.domain ? ` · ${a.domain}` : ''} <span style={{ color: C.inkLeise }}>— Personen der einen Firma in der Karteikarte der anderen zuordnen, dann die leere löschen.</span></div>)}
              {!dubl.length && <Leer>Keine Firmen-Dubletten.</Leer>}
            </div>
          ) : (
            <>
              {breit && (
                <div style={{ display: 'grid', gridTemplateColumns: FIRMEN_SPALTEN, gap: 12, padding: '0 8px 6px', fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <span /><span>Firma</span><span>Domain</span><span>Branche</span><span>Ort</span><span style={{ textAlign: 'right' }}>Pers.</span><span>Rolle</span>
                </div>
              )}
              <div>{treffer.slice(0, mehr).map(zeile)}</div>
              {treffer.length > mehr && <div style={{ marginTop: 10 }}><Knopf leise onClick={() => setMehr(mehr + 150)}>Weitere {Math.min(150, treffer.length - mehr)} zeigen</Knopf></div>}
              {!treffer.length && <Leer>Keine Firma gefunden.</Leer>}
            </>
          )}
        </Karte>
      </Spalte>
      {breit && (
        <Spalte klebt>
          <Karte i={1} akzent={f ? rolle(f.rolle).farbe : undefined}>
            {f ? <FirmenKarte f={f} api={api} zuPerson={zuPerson} /> : <Leer>Eine Firma anklicken — Stammdaten, Personen, Chancen und Verlauf erscheinen hier.</Leer>}
          </Karte>
        </Spalte>
      )}
    </Spalten>
  );
}

export function neueFirma(name: string): Firma {
  return { id: firmenId(name), name: name.trim(), rolle: 'offen', geaendert: new Date().toISOString() };
}

function FirmenKarte({ f, api, zuPerson }: { f: Firma; api: CrmApi; zuPerson: (id: string) => void }) {
  const crm = api.crm!;
  const personen = (api.kontakte ?? []).filter(k => k.firmaId === f.id);
  const ids = new Set(personen.map(k => k.id));
  const chancen = crm.stand.chancen.filter(c => c.kontaktIds.some(id => ids.has(id)) || (c.firma ?? '').toLowerCase() === f.name.toLowerCase());
  const mandate = crm.stand.mandate.filter(m => m.kontaktIds.some(id => ids.has(id)) || m.kunde.toLowerCase() === f.name.toLowerCase());
  const verlauf: Aktivitaet[] = personen.flatMap(k => (k.aktivitaeten ?? []).filter(a => a.art !== 'system').map(a => ({ ...a, text: `${anzeigename(k)}: ${a.text ?? ''}`.replace(/: $/, '') }))).sort((a, b) => a.am.localeCompare(b.am));
  const [zuordnen, setZuordnen] = useState('');
  const setze = (teil: Partial<Firma>) => api.setze('firmen', { ...f, ...teil } as unknown as { id: string } & Record<string, unknown>);
  const kandidaten = zuordnen.trim().length >= 2 ? (api.kontakte ?? []).filter(k => k.firmaId !== f.id && `${anzeigename(k)} ${k.firma ?? ''}`.toLowerCase().includes(zuordnen.toLowerCase())).slice(0, 6) : [];
  const F: [keyof Firma, string, string?][] = [['domain', 'Domain'], ['webseite', 'Webseite'], ['branche', 'Branche'], ['mitarbeiter', 'Mitarbeitende'], ['umsatz', 'Umsatz'], ['stadt', 'Ort'], ['gegruendet', 'Gegründet'], ['telefon', 'Telefon'], ['email', 'E-Mail'], ['linkedin', 'LinkedIn']];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <div style={{ fontFamily: SCHRIFT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-.015em' }}>{f.name}</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>{[f.branche, f.stadt, f.webseite ?? f.domain].filter(Boolean).join(' · ') || '—'}</div>
      </div>
      <Feldzeile label="Rolle"><Pillen liste={ROLLEN.map(r => ({ id: r.id, label: r.label }))} aktiv={f.rolle} onWahl={r => setze({ rolle: r, rolleVonHand: true })} /></Feldzeile>
      <LeadBlock api={api} leadId={f.id} />
      <div>
        <Ueberschrift rechts={`${personen.length}`}>Personen</Ueberschrift>
        {personen.map(k => <button key={k.id} onClick={() => zuPerson(k.id)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: '7px 0', textAlign: 'left' }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minWidth: 0 }}><span title={`Hält die Beziehung: ${nameVon(haeltBeziehung(k))}`} style={{ opacity: k.besitzer ? 1 : 0.45, display: 'inline-flex' }}><Person id={haeltBeziehung(k)} groesse={18} /></span>{anzeigename(k)} <span style={{ color: C.inkLeise }}>{k.position ?? k.jobtitel ?? ''}</span></span><span style={{ color: C.inkLeise }}>{k.letzterKontakt ? datum(k.letzterKontakt) : ''} ›</span></button>)}
        {!personen.length && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Noch niemand zugeordnet.</div>}
        <input value={zuordnen} onChange={e => setZuordnen(e.target.value)} placeholder="Person zuordnen …" aria-label="Person zuordnen" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', marginTop: 8 }} />
        {kandidaten.map(k => <button key={k.id} onClick={() => { void api.kontaktSetzen({ ...k, firmaId: f.id, firma: f.name }); setZuordnen(''); }} style={{ display: 'block', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: '3px 0' }}>+ {anzeigename(k)}{k.firma ? ` · bisher ${k.firma}` : ''}</button>)}
      </div>
      {(chancen.length > 0 || mandate.length > 0) && (
        <div>
          <Ueberschrift>Deals & Mandate</Ueberschrift>
          {chancen.map(c => <Link key={c.id} href={WEG.deal(c.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>{c.titel} <span style={{ color: C.inkLeise }}>· {crm.stufen.find(s => s.id === c.stufe)?.label}{c.wert.betrag ? ` · ${euro(c.wert.betrag)}${c.wert.basis === 'monat' ? '/M' : ''}` : ''} ›</span></Link>)}
          {mandate.map(m => <Link key={m.id} href={WEG.mandat(m.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>{m.titel.slice(0, 80)} <span style={{ color: C.inkLeise }}>· Mandat {m.status}{m.honorar.betrag ? ` · ${euro(m.honorar.betrag)}` : ''} ›</span></Link>)}
        </div>
      )}
      <div>
        <Ueberschrift>Stammdaten</Ueberschrift>
        <Feldzeile label="Name"><Feld wert={f.name} onFertig={name => name.trim() && setze({ name: name.trim() })} /></Feldzeile>
        <Feldzeile label="Rechtsform">
          <select value={f.rechtsform ?? ''} aria-label="Rechtsform" onChange={e => setze({ rechtsform: e.target.value || undefined })} style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }}>
            <option value="">—</option>{RECHTSFORMEN.map(r => <option key={r} value={r} style={{ background: C.flaeche }}>{r}</option>)}
          </select>
        </Feldzeile>
        {F.map(([k, l]) => <Feldzeile key={k} label={l}><Feld wert={String(f[k] ?? '')} onFertig={v => setze({ [k]: v.trim() || undefined } as Partial<Firma>)} /></Feldzeile>)}
        <Feldzeile label="Marktinfo"><Feld wert={f.marktinfo} onFertig={v => setze({ marktinfo: v || undefined })} /></Feldzeile>
        <Feldzeile label="Notiz"><Feld wert={f.notiz} onFertig={v => setze({ notiz: v || undefined })} /></Feldzeile>
      </div>
      <div>
        <Ueberschrift>Verlauf aller Personen</Ueberschrift>
        <Verlauf liste={verlauf} name={p => p.charAt(0).toUpperCase() + p.slice(1)} max={15} heute={crm.heute} />
      </div>
      {!personen.length && !chancen.length && !mandate.length && <div><button onClick={() => { if (window.confirm(`Firma „${f.name}“ löschen?`)) void api.weg('firmen', f.id); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>Leere Firma löschen</button></div>}
    </div>
  );
}
