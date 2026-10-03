'use client';

import { TermineAkte } from '../kalender/TermineAkte';
import Link from 'next/link';
import { WEG, eventLink } from '@/lib/wege';

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
import { dealZuFirma, mandatZuFirma } from '@/lib/crm/firmen-bezug';
import { eventsFuerKunde, erfassteTeilnahmen, begegnungenFuerFirma } from '@/lib/crm/besuche';
import { istBesuch } from '@/lib/crm/besuche-form';
import type { Firma, FirmaRolle } from '@/lib/crm/typen';
import { type CrmApi, datum, euro, nurFelder } from './daten';
import { Feldzeile, Pillen, Feld, Verlauf } from './teile';
import { Wahl } from './Wahl';
import { BeanWahl, useOffeneAngebote } from './bean-teile';
import { beanFirma } from '@/lib/crm/bean';
import { Person } from './team';
import { LeadBlock } from './Leads';
import { haeltBeziehung, nameVon } from '@/lib/crm/team';
import { personenJeFirma, personenAufteilen, stationIn, stationenVon, aktivitaetZurFirma, STATION_ART_LABEL } from '@/lib/crm/stationen';
import { useFirmaWechselFrage } from './kontakt/FirmaWechselFrage';
import { firmenGruppe, muetter, toechter as toechterVon } from '@/lib/crm/konzern';
import { beanGruppe, BEAN_LABEL } from '@/lib/crm/bean';
import { AufgabenAkte } from '../aufgaben/AufgabenAkte';
import { ZoeVorschlaege, ZoeFragenKnopf } from './ZoeFragen';

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
  const firmen = useMemo(() => api.crm?.stand.firmen ?? [], [api.crm]);
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  // Personen einer Firma nur über die Stationen (28.09.) — laufende Stationen.
  const personenJe = useMemo(() => new Map(Array.from(personenJeFirma(kontakte, { nurAktiv: true }).entries()).map(([id, l]) => [id, l.length])), [kontakte]);
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
      {auswahl === x.id && <div style={{ padding: '8px 0 18px' }}><FirmenKarte f={x} api={api} zuPerson={zuPerson} zuFirma={setAuswahl} /></div>}
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
            {f ? <FirmenKarte f={f} api={api} zuPerson={zuPerson} zuFirma={setAuswahl} /> : <Leer>Eine Firma anklicken — Stammdaten, Personen, Chancen und Verlauf erscheinen hier.</Leer>}
          </Karte>
        </Spalte>
      )}
    </Spalten>
  );
}

export function neueFirma(name: string): Firma {
  return { id: firmenId(name), name: name.trim(), rolle: 'offen', geaendert: new Date().toISOString() };
}

export function FirmenKarte({ f, api, zuPerson, zuFirma }: { f: Firma; api: CrmApi; zuPerson: (id: string) => void; zuFirma: (id: string) => void }) {
  const crm = api.crm!;
  const firmen = crm.stand.firmen;
  // Personen nur über die Stationen (28.09.): aktuell (laufende Station) und ehemalig (beendete) getrennt.
  const { aktuell: personen, ehemalig } = personenAufteilen(api.kontakte ?? [], f.id);
  const ids = new Set(personen.map(k => k.id));
  // Mutter- und Tochterfirmen (28.09., #7): „ganze Gruppe“ fasst Deals und Mandate aller Firmen der Gruppe zusammen.
  const gruppe = firmenGruppe(firmen, f.id);
  const [gruppeAn, setGruppeAn] = useState(false);
  const gruppenFirmen = gruppeAn && gruppe.length > 1 ? firmen.filter(x => gruppe.includes(x.id)) : [f];
  const mutter = f.mutterId ? firmen.find(x => x.id === f.mutterId) : undefined;
  const toechter = toechterVon(firmen, f.id);
  // Als Mutter wählbar: jede andere Firma, die nicht selbst (Enkel-)Tochter dieser ist — sonst entstünde ein Kreis.
  const mutterListe = useMemo(() => firmen.filter(x => x.id !== f.id && !muetter(firmen, x.id).includes(f.id)).map(x => ({ id: x.id, label: x.name })), [firmen, f.id]);
  // Per Kennung (dealZuFirma/mandatZuFirma, F1) — der Name nur als Rückfall für Einträge ohne Firmen-Kennung; über
  // die Personen nur, wenn der Eintrag keiner anderen Firma gehört.
  const chancen = crm.stand.chancen.filter(c => gruppenFirmen.some(g => dealZuFirma(c, g)) || (!c.firmaId && c.kontaktIds.some(id => ids.has(id))));
  const mandate = crm.stand.mandate.filter(m => gruppenFirmen.some(g => mandatZuFirma(m, g)) || (!m.firmaId && m.kontaktIds.some(id => ids.has(id))));
  // Begegnungen bei Events (M15): Personen dieser Firma bei Events (auch fremden) + die Firma als Zielfirma eines besuchten Events.
  const begegnungen = useMemo(() => begegnungenFuerFirma(crm.stand.events, crm.stand.teilnahmen, api.kontakte ?? [], f.id), [crm.stand.events, crm.stand.teilnahmen, api.kontakte, f.id]);
  // Zeitlinie (28.09.): Aktivitäten, die bei dieser Firma entstanden — auch von Personen, die inzwischen weitergezogen sind.
  const verlauf: Aktivitaet[] = [...personen, ...ehemalig].flatMap(k => (k.aktivitaeten ?? []).filter(a => a.art !== 'system' && aktivitaetZurFirma(k, a, f.id)).map(a => ({ ...a, text: `${anzeigename(k)}: ${a.text ?? ''}`.replace(/: $/, '') }))).sort((a, b) => a.am.localeCompare(b.am));
  const [zuordnen, setZuordnen] = useState('');
  const firmaName = (id: string) => (id === f.id ? f.name : firmen.find(x => x.id === id)?.name);
  /**
   * Person dieser Firma zuordnen (Kevin 28.09.): ohne bisherige Firma einfach verknüpfen; sonst kurz nachfragen —
   * Jobwechsel · Zusätzliche Firma · Korrektur (`firmaWechsel`, der Server rechnet die Stationen).
   */
  const { frage, dialog: wechselFrage } = useFirmaWechselFrage();
  const zuordnenMit = async (k: (typeof personen)[number]) => {
    if (!stationenVon(k).length) { void api.kontaktTeil(k.id, { firmaId: f.id, firma: f.name }); setZuordnen(''); return; }
    const absicht = await frage({ von: k.firmaId ? firmaName(k.firmaId) ?? k.firma : k.firma, nach: f.name });
    if (!absicht) return;
    void api.kontaktTeil(k.id, { firmaId: f.id, firma: f.name, firmaWechsel: absicht });
    setZuordnen('');
  };
  const angebote = useOffeneAngebote();
  // Nur die geänderten Felder (F1) — ein ganzer Eintrag aus dem Browser-Stand überschrieb gleichzeitige Änderungen (Lead-Qualifizierung).
  const setze = (teil: Partial<Firma>) => api.teil('firmen', f.id, nurFelder(teil));
  const kandidaten = zuordnen.trim().length >= 2 ? (api.kontakte ?? []).filter(k => !ids.has(k.id) && `${anzeigename(k)} ${k.firma ?? ''}`.toLowerCase().includes(zuordnen.toLowerCase())).slice(0, 6) : [];
  const F: [keyof Firma, string, string?][] = [['domain', 'Domain'], ['webseite', 'Webseite'], ['branche', 'Branche'], ['mitarbeiter', 'Mitarbeitende'], ['umsatz', 'Umsatz'], ['stadt', 'Ort'], ['gegruendet', 'Gegründet'], ['telefon', 'Telefon'], ['email', 'E-Mail'], ['linkedin', 'LinkedIn']];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <div style={{ fontFamily: SCHRIFT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-.015em' }}>{f.name}</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>{[f.branche, f.stadt, f.webseite ?? f.domain].filter(Boolean).join(' · ') || '—'}</div>
      </div>
      <Feldzeile label="Rolle"><Wahl label="Rolle" liste={ROLLEN.map(r => ({ id: r.id, label: r.label }))} wert={f.rolle} farbe={ROLLEN.find(r => r.id === f.rolle)?.farbe} onWahl={r => setze({ rolle: r, rolleVonHand: true })} /></Feldzeile>
      {/* BEAN (28.09., H4): abgeleitet aus Mandaten, Deals und Angeboten der Firma und ihrer Personen — von Hand überschreibbar, gilt dann für Personen ohne eigene Wahl. */}
      <Feldzeile label="BEAN"><BeanWahl wert={f.bean} ergebnis={beanFirma(f, crm.stand, api.kontakte ?? [], { angebote })} onSetze={bean => setze({ bean })} /></Feldzeile>
      {/* Mutter- und Tochterfirmen (28.09., #7) — Kreise lehnt der Server ab. */}
      <Feldzeile label="Mutterfirma">
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Wahl label="Mutterfirma" klein liste={mutterListe} wert={f.mutterId} leer="keine ▾" onWahl={mutterId => setze({ mutterId })} onLeeren={f.mutterId ? () => setze({ mutterId: undefined }) : undefined} leerenLabel="keine Mutterfirma" />
          {mutter && <button type="button" onClick={() => zuFirma(mutter.id)} className="fassbar" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12, padding: 0 }}>öffnen ›</button>}
        </span>
      </Feldzeile>
      {toechter.length > 0 && (
        <Feldzeile label="Töchter">
          <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            {toechter.map(t => <button key={t.id} type="button" onClick={() => zuFirma(t.id)} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><Chip farbe={LEUCHT.agenten}>{t.name} ›</Chip></button>)}
          </span>
        </Feldzeile>
      )}
      {gruppe.length > 1 && (() => { const g = beanGruppe(gruppe, crm.stand, api.kontakte ?? [], { angebote }); return (
        <Feldzeile label="Gruppe">
          <span title={g.grund} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
            {gruppe.length} Firmen · BEAN der Gruppe <Chip farbe={LEUCHT.geld}>{g.bean} · {BEAN_LABEL[g.bean]}</Chip>
          </span>
        </Feldzeile>
      ); })()}
      <LeadBlock api={api} leadId={f.id} />
      <div>
        {wechselFrage}
        <Ueberschrift rechts={`${personen.length}`}>Personen · aktuell</Ueberschrift>
        {personen.map(k => { const st = stationIn(k, f.id); return <button key={k.id} onClick={() => zuPerson(k.id)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: '7px 0', textAlign: 'left' }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minWidth: 0 }}><span title={`Zuständig: ${nameVon(haeltBeziehung(k))}`} style={{ opacity: k.besitzer ? 1 : 0.45, display: 'inline-flex' }}><Person id={haeltBeziehung(k)} groesse={18} /></span>{anzeigename(k)} <span style={{ color: C.inkLeise }}>{[st?.rolle ?? (k.firmaId === f.id ? k.position ?? k.jobtitel : undefined), st?.art ? STATION_ART_LABEL[st.art] : undefined, st && !st.haupt ? 'weitere Station' : undefined].filter(Boolean).join(' · ')}</span></span><span style={{ color: C.inkLeise }}>{k.letzterKontakt ? datum(k.letzterKontakt) : ''} ›</span></button>; })}
        {!personen.length && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Niemand ist aktuell zugeordnet.</div>}
        <input value={zuordnen} onChange={e => setZuordnen(e.target.value)} placeholder="Person zuordnen …" aria-label="Person zuordnen" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', marginTop: 8 }} />
        {kandidaten.map(k => (
          <div key={k.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: C.inkDim, padding: '3px 0' }}>
            <span>{anzeigename(k)}{k.firma ? ` · bisher ${k.firma}` : ''}</span>
            <button onClick={() => void zuordnenMit(k)} title={k.firmaId ? 'Jobwechsel, zusätzliche Firma oder Korrektur — wird gefragt' : undefined} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12.5, padding: 0 }}>+ zuordnen</button>
          </div>
        ))}
      </div>
      {ehemalig.length > 0 && (
        <div>
          <Ueberschrift rechts={`${ehemalig.length}`}>Ehemalig</Ueberschrift>
          {ehemalig.map(k => { const st = stationIn(k, f.id); return <button key={k.id} onClick={() => zuPerson(k.id)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: '7px 0', textAlign: 'left' }}><span style={{ minWidth: 0 }}>{anzeigename(k)} <span style={{ color: C.inkLeise }}>{[st?.rolle, st?.bis ? `bis ${datum(st.bis)}` : 'beendet'].filter(Boolean).join(' · ')}</span></span><span style={{ color: C.inkLeise }}>›</span></button>; })}
        </div>
      )}
      {(chancen.length > 0 || mandate.length > 0 || gruppe.length > 1) && (
        <div>
          <Ueberschrift rechts={gruppe.length > 1 ? <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={gruppeAn} onChange={e => setGruppeAn(e.target.checked)} />ganze Gruppe</label> : undefined}>Deals & Mandate</Ueberschrift>
          {chancen.map(c => <Link key={c.id} href={WEG.deal(c.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>{c.titel} <span style={{ color: C.inkLeise }}>· {crm.stufen.find(s => s.id === c.stufe)?.label}{c.wert.betrag ? ` · ${euro(c.wert.betrag)}${c.wert.basis === 'monat' ? '/M' : ''}` : ''} ›</span></Link>)}
          {mandate.map(m => <Link key={m.id} href={WEG.mandat(m.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>{m.titel.slice(0, 80)} <span style={{ color: C.inkLeise }}>· Mandat {m.status}{m.honorar.betrag ? ` · ${euro(m.honorar.betrag)}` : ''} ›</span></Link>)}
        </div>
      )}
      {/* Events für diesen Kunden (03.10.): besuchte Events, die für diese Firma laufen (Reiter „Events“) — mit ihren erfassten Kontakten. */}
      {eventsFuerKunde(crm.stand.events, f.id).length > 0 && (
        <div>
          <Ueberschrift rechts={`${eventsFuerKunde(crm.stand.events, f.id).length}`}>Events für diesen Kunden</Ueberschrift>
          {eventsFuerKunde(crm.stand.events, f.id).map(e => (
            <Link key={e.id} href={WEG.besuch(e.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>{e.titel} <span style={{ color: C.inkLeise }}>· {datum(e.datum, crm.heute)} · {erfassteTeilnahmen(e.id, crm.stand.teilnahmen).length} Kontakte</span></Link>
          ))}
        </div>
      )}
      {/* Begegnungen bei Events (M15): wer von dieser Firma wo dabei war — über alle Events, auch fremde; die Firma als Ziel steht dabei. */}
      {begegnungen.length > 0 && (
        <div>
          <Ueberschrift rechts={`${begegnungen.length}`}>Begegnungen bei Events</Ueberschrift>
          {begegnungen.map(b => (
            <Link key={b.event.id} href={eventLink(b.event)} style={{ display: 'block', fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>{b.event.titel} <span style={{ color: C.inkLeise }}>· {datum(b.event.datum, crm.heute)} · {istBesuch(b.event) ? 'besucht' : 'Make.One'}{b.personen.length ? ` · ${b.personen.map(anzeigename).join(', ')}` : ''}{b.ziel && !b.getroffen ? ' · Ziel, noch nicht getroffen' : b.ziel ? ' · Ziel getroffen' : ''}</span></Link>
          ))}
        </div>
      )}
      {/* Termine (30.09., K3): mit der Firma, ihren Personen, Deals oder Mandaten verknüpft (kalender-bezug). */}
      <div>
        <Ueberschrift>Termine</Ueberschrift>
        <TermineAkte frage={{ firmen: [f.id], kontakte: personen.map(k => k.id), deals: chancen.map(c => c.id), mandate: mandate.map(m => m.id) }} heute={crm.heute} />
      </div>
      {/* Aufgaben (28.09. abends): verknüpft mit der Firma oder einem ihrer Mandate/Deals; bei aktivem Mandat im Mandanten-Space. */}
      <div>
        <Ueberschrift>Aufgaben</Ueberschrift>
        <AufgabenAkte firmaId={f.id} mandatIds={mandate.map(m => m.id)} dealIds={chancen.map(c => c.id)} mandantFirmaId={mandate.some(m => m.status === 'aktiv' && m.firmaId === f.id) ? f.id : undefined} />
      </div>
      {/* ZOE (28.09., C7): fragen mit dieser Firma als Bezug; offene Vorschläge zur Firma und ihren Personen/Deals. */}
      <div style={{ display: 'grid', gap: 10 }}>
        <div><ZoeFragenKnopf bezug={{ art: 'firma', id: f.id }} /></div>
        <ZoeVorschlaege art="firma" id={f.id} onUebernommen={() => void api.laden(true)} />
      </div>
      <div>
        <Ueberschrift>Stammdaten</Ueberschrift>
        <Feldzeile label="Name"><Feld wert={f.name} onFertig={name => name.trim() && setze({ name: name.trim() })} /></Feldzeile>
        <Feldzeile label="Rechtsform">
          <Wahl label="Rechtsform" liste={RECHTSFORMEN.map(r => ({ id: r, label: r }))} wert={f.rechtsform} onWahl={rechtsform => setze({ rechtsform })} onLeeren={() => setze({ rechtsform: undefined })} />
        </Feldzeile>
        {F.map(([k, l]) => <Feldzeile key={k} label={l}><Feld wert={String(f[k] ?? '')} onFertig={v => setze({ [k]: v.trim() || undefined } as Partial<Firma>)} /></Feldzeile>)}
        <Feldzeile label="Marktinfo"><Feld wert={f.marktinfo} onFertig={v => setze({ marktinfo: v || undefined })} /></Feldzeile>
        <Feldzeile label="Notiz"><Feld wert={f.notiz} onFertig={v => setze({ notiz: v || undefined })} /></Feldzeile>
      </div>
      <div>
        <Ueberschrift>Verlauf aller Personen</Ueberschrift>
        <Verlauf liste={verlauf} name={p => p.charAt(0).toUpperCase() + p.slice(1)} max={15} heute={crm.heute} />
      </div>
      {!personen.length && !ehemalig.length && !toechter.length && !chancen.length && !mandate.length && <div><button onClick={() => { if (window.confirm(`Firma „${f.name}“ löschen?`)) void api.weg('firmen', f.id); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>Leere Firma löschen</button></div>}
    </div>
  );
}
