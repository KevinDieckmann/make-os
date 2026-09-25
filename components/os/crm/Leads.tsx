'use client';

// ─── Markttraktion · Sales › Leads (Ebene 1) — qualifizieren bis zum SQL ────
// Kevin (25.09.): „Dort arbeiten wir über die Kontakt-/Firmen-Ebene, wo wir
// qualifizieren und es ein SQL-Lead wird.“ Je Firma eine Zeile (mit ihren
// Personen), Personen ohne Firma einzeln. Rechts die Qualifizierung: Status,
// sechs Kernfragen (ja/nein/unklar, mit der Frage, die man stellt), und sobald
// Schmerz + Entscheider + Budget oder Zeitpunkt geklärt sind: „Zum SQL → Deal
// anlegen“ — der Deal steht dann in der Pipeline (Ebene 2). Logik in
// lib/crm/leads.ts, Schreibwege über /api/crm/lead.
// Dazu `SalesTrichter`: die Leiste über allen Sales-Ansichten — Kontaktiert →
// Im Gespräch → Qualifizierung → Deals → Gewonnen → Kunden, mit Umwandlungen.

import { useLinkAuswahl } from '../Verlauf';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { markttraktion } from '@/lib/crm/adresse';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip, Punkt, Spalten, Spalte, useBreit, feld, LEUCHT } from '../schlank';
import type { LeadStatus, Kriterien, Qual, ChancenArt } from '@/lib/crm/typen';
import { leads, LEAD_STATUS, KRITERIEN, sqlBereit, fehltBisSql, geklaert, statusLabel, type LeadZeile, type Trichter } from '@/lib/crm/leads';
import { STUFEN } from '@/lib/crm/pipeline';
import { type CrmApi, datum, euro, plusTage, holeMitStand } from './daten';
import { Pillen, Feldzeile } from './teile';
import { Person, ZustaendigWahl, WerFilter, useWerFilter, passtWer } from './team';
import { HeadPanel } from './HeadPanel';

interface Daten { leads: LeadZeile[]; trichter: Trichter }
const STATUS_FARBE: Record<LeadStatus, string> = { neu: C.inkLeise, kontaktiert: LEUCHT.puls, im_gespraech: LEUCHT.business, qualifizierung: LEUCHT.achtung, sql: LEUCHT.gut, kunde: LEUCHT.geld, kein_fit: C.inkLeise, ruht: C.inkLeise };
const Q_FARBE: Record<Qual, string> = { ja: LEUCHT.gut, nein: LEUCHT.kritisch, unklar: 'rgba(255,255,255,.18)' };
const ARTEN: { id: ChancenArt; label: string }[] = [{ id: 'retainer', label: 'Retainer' }, { id: 'projekt', label: 'Projekt' }, { id: 'workshop', label: 'Workshop' }, { id: 'vermittlung', label: 'Vermittlung' }, { id: 'software', label: 'Software' }];
const SCHRITTE = ['Bedarfsgespräch mit dem Entscheider', 'Diagnose-Termin vereinbaren', 'Angebot besprechen'];

/** Leads laden — geteilt von der Trichter-Leiste und der Leads-Ansicht; lädt neu, wenn sich der Bestand ändert. */
export function useLeads(api: CrmApi) {
  const [d, setD] = useState<Daten | null>(null);
  const staende = useRef(new Map<string, string>());
  // Unverändert (304) bleibt der bisherige Stand stehen.
  const laden = useCallback(() => holeMitStand<Daten & { ok?: boolean }>('/api/crm/lead', staende.current).then(x => { if (x?.ok) setD(x); }).catch(() => {}), []);
  useEffect(() => { void laden(); }, [laden, api.crm, api.kontakte]);
  return { d, laden };
}

export function SalesTrichter({ api, zuBereich }: { api: CrmApi; zuBereich: (s: string, a?: string) => void }) {
  const { d } = useLeads(api);
  if (!d) return null;
  const t = d.trichter;
  const EBENE = { 1: 'Leads · qualifizieren', 2: 'Deals · Closing', 3: 'Kunden' } as const;
  return (
    <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', minWidth: 'min-content' }}>
        {t.stufen.map((s, i) => {
          const neueEbene = i === 0 || t.stufen[i - 1].ebene !== s.ebene;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
              {i > 0 && <span aria-hidden style={{ alignSelf: 'center', color: C.inkLeise, fontSize: 12 }}>{neueEbene ? '⟩⟩' : '›'}</span>}
              <button onClick={() => zuBereich(s.ziel.s, s.ziel.a)} className="fassbar" style={{ display: 'grid', gap: 2, textAlign: 'left', padding: '8px 12px', borderRadius: 12, cursor: 'pointer', border: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.03)', color: C.ink, fontFamily: SCHRIFT.text, minWidth: 104 }}>
                <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: neueEbene ? C.inkDim : 'transparent', fontWeight: 600, whiteSpace: 'nowrap' }}>{EBENE[s.ebene]}</span>
                <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.anzahl}</span>
                <span style={{ fontSize: 12, color: C.inkDim, whiteSpace: 'nowrap' }}>{s.label}{s.wert ? ` · ${euro(s.wert)}` : ''}</span>
              </button>
            </div>
          );
        })}
        <div style={{ alignSelf: 'center', display: 'grid', gap: 2, fontSize: 12, color: C.inkLeise, paddingLeft: 8, whiteSpace: 'nowrap' }}>
          <span>Gespräch → SQL <b style={{ color: C.ink }}>{t.gespraechZuSql === null ? '—' : `${t.gespraechZuSql} %`}</b></span>
          <span>SQL → gewonnen <b style={{ color: C.ink }}>{t.sqlZuGewonnen === null ? '—' : `${t.sqlZuGewonnen} %`}</b></span>
        </div>
      </div>
    </div>
  );
}

type Filter = 'aktiv' | LeadStatus;
export function Leads({ api, zuKontakt, zuDeal }: { api: CrmApi; zuKontakt: (id: string) => void; zuDeal: () => void }) {
  const breit = useBreit();
  const { d, laden } = useLeads(api);
  const [filter, setFilter] = useState<Filter>('aktiv');
  const [suche, setSuche] = useState('');
  // Offener Lead im Link (k) — aus Kartei und Firmen „Qualifizieren“, und Zurück schließt ihn wieder.
  const [wahl, setWahl] = useLinkAuswahl();
  const [wer, setWer] = useWerFilter('leads');
  const ich = api.ich;
  const zeilen = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return (d?.leads ?? []).filter(z => (filter === 'aktiv' ? LEAD_STATUS.find(s => s.id === z.status)?.aktiv : filter === 'ruht' ? z.status === 'ruht' || z.status === 'kein_fit' : z.status === filter))
      .filter(z => passtWer(wer, z.besitzer, 'sales', ich))
      .filter(z => !q || [z.name, ...z.personen.map(p => p.name), z.branche ?? '', z.stadt ?? ''].join(' ').toLowerCase().includes(q));
  }, [d, filter, suche, wer, ich]);
  if (!d) return <Karte i={0}><Leer>Lädt die Leads …</Leer></Karte>;
  const zahl = (f: Filter) => (d.leads ?? []).filter(z => (f === 'aktiv' ? LEAD_STATUS.find(s => s.id === z.status)?.aktiv : f === 'ruht' ? z.status === 'ruht' || z.status === 'kein_fit' : z.status === f)).length;
  const FILTER: { id: Filter; label: string }[] = [
    { id: 'aktiv', label: `In Arbeit ${zahl('aktiv')}` }, { id: 'im_gespraech', label: `Im Gespräch ${zahl('im_gespraech')}` }, { id: 'qualifizierung', label: `Qualifizierung ${zahl('qualifizierung')}` },
    { id: 'kontaktiert', label: `Kontaktiert ${zahl('kontaktiert')}` }, { id: 'sql', label: `SQL ${zahl('sql')}` }, { id: 'neu', label: `Neu ${zahl('neu')}` }, { id: 'kunde', label: `Kunde ${zahl('kunde')}` }, { id: 'ruht', label: `Ruht · kein Fit ${zahl('ruht')}` },
  ];
  const aktiv = wahl ? d.leads.find(z => z.id === wahl) ?? null : breit ? zeilen[0] ?? null : null;
  // Gewählt über die Adresse, aber im aktuellen Filter nicht sichtbar? Dann oben zeigen.
  const zeigen = aktiv && !zeilen.some(z => z.id === aktiv.id) ? [aktiv, ...zeilen] : zeilen;

  const liste = (
    <Karte i={1}>
      <Ueberschrift rechts={<WerFilter wahl={wer} onWahl={setWer} ich={ich} />}>Leads · Ebene 1</Ueberschrift>
      <div style={{ fontSize: 12.5, color: C.inkLeise, marginBottom: 10, lineHeight: 1.5 }}>Qualifizieren, bis es ein SQL ist: Schmerz und Entscheider geklärt, dazu Budget oder Zeitpunkt. Dann wird es ein Deal in der Pipeline.</div>
      <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Firma, Person, Branche, Ort …" aria-label="Leads suchen" style={{ ...feld, fontSize: TYP.bedien, padding: '9px 13px', marginBottom: 10 }} />
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 8 }}><Pillen einzeilig liste={FILTER} aktiv={filter} onWahl={f => { setFilter(f); setWahl(null); }} farbe={LEUCHT.business} /></div>
      {!zeilen.length && <Leer>{filter === 'aktiv' ? 'Gerade nichts in Arbeit. Neue Leads kommen aus der Power Hour, Events und Kampagnen.' : 'Keine Leads in diesem Status.'}</Leer>}
      <div>
        {zeigen.slice(0, 120).map(z => (
          <div key={z.id}>
            <div onClick={() => setWahl(aktiv?.id === z.id && !breit ? null : z.id)} className="zeile zeile-klick fassbar"
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 6px', margin: '0 -6px', borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', borderRadius: aktiv?.id === z.id ? 10 : 0, background: aktiv?.id === z.id ? 'rgba(255,255,255,.05)' : 'transparent' }}>
              <Person id={z.besitzer} groesse={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: TYP.body, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.name}</div>
                <div style={{ fontSize: 12, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[z.art === 'firma' ? z.personen.map(p => p.name).join(', ') : z.personen[0]?.position, z.naechsterSchritt ? `→ ${z.naechsterSchritt.text}` : '', z.letzterKontakt ? `zuletzt ${datum(z.letzterKontakt)}` : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
              <KriterienPunkte k={z.kriterien} />
              <Chip farbe={STATUS_FARBE[z.status]}>{statusLabel(z.status)}</Chip>
            </div>
            {!breit && aktiv?.id === z.id && <div style={{ padding: '10px 0 18px' }}><Qualifizierung z={z} api={api} laden={laden} zuKontakt={zuKontakt} zuDeal={zuDeal} /></div>}
          </div>
        ))}
        {zeilen.length > 120 && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>{zeilen.length - 120} weitere — Suche eingrenzen.</div>}
      </div>
    </Karte>
  );
  // Der Head of Sales qualifiziert mit (Modus „Leads qualifizieren“) — oben, wie in jeder Sales-Ansicht.
  const head = <HeadPanel head="sales" standardModus="lead_review" zuKontakt={zuKontakt} i={0} nachEntscheid={() => void laden()} />;
  if (!breit) return <>{head}{liste}</>;
  return (
    <>{head}
    <Spalten verhaeltnis="1:1">
      <Spalte>{liste}</Spalte>
      <Spalte klebt>
        <Karte i={2} akzent={aktiv ? STATUS_FARBE[aktiv.status] : undefined}>
          {aktiv ? <Qualifizierung key={aktiv.id} z={aktiv} api={api} laden={laden} zuKontakt={zuKontakt} zuDeal={zuDeal} /> : <Leer>Einen Lead wählen — rechts erscheinen Status, die sechs Kernfragen und der Weg zum SQL.</Leer>}
        </Karte>
      </Spalte>
    </Spalten>
    </>
  );
}

function KriterienPunkte({ k }: { k: Kriterien }) {
  return (
    <span title={KRITERIEN.map(x => `${x.label}: ${k[x.id]}`).join(' · ')} style={{ display: 'inline-flex', gap: 3, alignItems: 'center', flex: '0 0 auto' }}>
      {KRITERIEN.map(x => <span key={x.id} style={{ width: 7, height: 7, borderRadius: '50%', background: Q_FARBE[k[x.id]] }} />)}
      {sqlBereit(k) && <span style={{ fontSize: 11, color: LEUCHT.gut, fontWeight: 700, marginLeft: 4 }}>SQL-bereit</span>}
    </span>
  );
}

function Qualifizierung({ z, api, laden, zuKontakt, zuDeal }: { z: LeadZeile; api: CrmApi; laden: () => void; zuKontakt: (id: string) => void; zuDeal: () => void }) {
  const heute = api.crm?.heute ?? new Date().toISOString().slice(0, 10);
  const [k, setK] = useState<Kriterien>(z.kriterien);
  const [status, setStatus] = useState<LeadStatus>(z.status);
  const [notiz, setNotiz] = useState(z.notiz ?? '');
  const [meldung, setMeldung] = useState('');
  const [deal, setDeal] = useState({ titel: z.name.replace(/ \(.*\)$/, ''), art: 'retainer' as ChancenArt, betrag: '', basis: 'monat' as 'monat' | 'einmalig', schritt: '', datum: plusTage(heute, 3), erwartetAm: '', besitzer: z.besitzer === 'beide' ? api.ich ?? 'kevin' : z.besitzer });
  const [trotzdem, setTrotzdem] = useState(false);
  const post = (body: Record<string, unknown>) => fetch('/api/crm/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
  const setze = async (felder: Record<string, unknown>) => { const r = await post({ aktion: 'setze', id: z.id, felder }); if (!r.ok) setMeldung(r.fehler); void laden(); };
  const kriterium = (id: keyof Kriterien, w: Qual) => {
    const neu = { ...k, [id]: w };
    setK(neu);
    // Wer qualifiziert, ist in der Qualifizierung — der Status zieht mit, solange er davor steht.
    const nachStatus = ['neu', 'kontaktiert', 'im_gespraech'].includes(status) ? 'qualifizierung' : status;
    if (nachStatus !== status) setStatus(nachStatus as LeadStatus);
    void setze({ kriterien: { [id]: w }, ...(nachStatus !== status ? { status: nachStatus } : {}) });
  };
  const bereit = sqlBereit(k);
  const zumSql = async () => {
    const r = await post({ aktion: 'sql', id: z.id, trotzdem: !bereit, deal: { titel: deal.titel, art: deal.art, betrag: Number(deal.betrag.replace(',', '.')) || 0, basis: deal.basis, schritt: { text: deal.schritt, datum: deal.datum }, ...(deal.erwartetAm ? { erwartetAm: deal.erwartetAm } : {}), besitzer: deal.besitzer } });
    setMeldung(r.ok ? r.text : r.fehler);
    if (r.ok) { setStatus('sql'); void laden(); void api.laden(); }
  };
  const eingabe = { ...feld, fontSize: TYP.bedien, padding: '8px 11px' } as const;
  const inDeal = z.deal?.offen;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontFamily: SCHRIFT.display, fontSize: 20, fontWeight: 700, letterSpacing: '-.015em' }}>{z.name}</div>
        <div style={{ fontSize: 12.5, color: C.inkDim, marginTop: 2 }}>{[z.art === 'firma' ? 'Firma' : 'Person ohne Firma', z.branche, z.stadt].filter(Boolean).join(' · ')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {z.personen.map(p => <button key={p.id} onClick={() => zuKontakt(p.id)} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 999, padding: '4px 10px', color: C.ink, cursor: 'pointer', fontSize: 12.5 }}>{p.name}{p.position ? <span style={{ color: C.inkLeise }}> · {p.position.slice(0, 40)}</span> : null} ›</button>)}
        </div>
      </div>

      {z.deal && (
        <div style={{ padding: '10px 12px', borderRadius: 12, background: `${z.deal.offen ? LEUCHT.gut : C.inkLeise}14`, fontSize: TYP.bedien, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Ebene 2 · Deal „{z.deal.titel}“ · {STUFEN.find(s => s.id === z.deal!.stufe)?.label}{z.deal.wert ? ` · ${euro(z.deal.wert)}` : ' · ohne Wert'}</span>
          <Knopf leise onClick={zuDeal}>Zum Deal</Knopf>
        </div>
      )}

      <div>
        <Ueberschrift>Status</Ueberschrift>
        <Pillen liste={LEAD_STATUS.filter(s => s.id !== 'sql' && s.id !== 'kunde').map(s => ({ id: s.id, label: s.label }))} aktiv={status === 'sql' || status === 'kunde' ? undefined : status}
          onWahl={s => { setStatus(s); void setze({ status: s, ...(s === 'kein_fit' || s === 'ruht' ? { grund: window.prompt(s === 'kein_fit' ? 'Warum kein Fit? (kurz)' : 'Warum ruht es? (kurz)') ?? '' } : {}) }); }} />
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>{status === 'sql' ? 'SQL — der Deal läuft in der Pipeline.' : status === 'kunde' ? 'Kunde — siehe Produkte & Mandate.' : `Weiter, wenn: ${LEAD_STATUS.find(s => s.id === status)?.weiterWenn}`}{z.grund ? ` · Grund: ${z.grund}` : ''}{!z.gesetzt ? ' · Status aus den Personen abgeleitet' : ''}</div>
      </div>

      <div>
        <Ueberschrift rechts={<span>{geklaert(k)} von 6 geklärt</span>}>Qualifizierung</Ueberschrift>
        <div style={{ display: 'grid', gap: 8 }}>
          {KRITERIEN.map(x => (
            <div key={x.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{x.label}</div>
                <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.4 }}>{x.frage}</div>
              </div>
              <span style={{ display: 'inline-flex', gap: 3 }}>
                {(['ja', 'unklar', 'nein'] as Qual[]).map(w => (
                  <button key={w} onClick={() => kriterium(x.id, w)} aria-pressed={k[x.id] === w} style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SCHRIFT.text,
                    border: `1px solid ${k[x.id] === w ? Q_FARBE[w] : 'rgba(255,255,255,.1)'}`, background: k[x.id] === w ? `${w === 'unklar' ? '#ffffff' : Q_FARBE[w]}1f` : 'transparent', color: k[x.id] === w ? C.ink : C.inkDim }}>{w}</button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!inDeal && status !== 'kunde' && (
        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: bereit ? `${LEUCHT.gut}10` : 'rgba(255,255,255,.03)', border: `1px solid ${bereit ? `${LEUCHT.gut}44` : 'rgba(255,255,255,.06)'}` }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Punkt farbe={bereit ? LEUCHT.gut : C.inkLeise} />
            <b style={{ fontSize: TYP.body }}>{bereit ? 'SQL-bereit — ab ins Closing' : 'Noch kein SQL'}</b>
            {!bereit && <span style={{ fontSize: 12.5, color: C.inkDim }}>es fehlt: {fehltBisSql(k).join(', ')}</span>}
          </div>
          {(bereit || trotzdem) ? (
            <>
              <Feldzeile label="Deal"><input value={deal.titel} onChange={e => setDeal({ ...deal, titel: e.target.value })} aria-label="Titel des Deals" style={eingabe} /></Feldzeile>
              <Feldzeile label="Art"><Pillen liste={ARTEN} aktiv={deal.art} onWahl={art => setDeal({ ...deal, art })} /></Feldzeile>
              <Feldzeile label="Wert">
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="number" inputMode="decimal" min={0} value={deal.betrag} onChange={e => setDeal({ ...deal, betrag: e.target.value })} placeholder="€ (optional)" aria-label="Wert in Euro" style={{ ...eingabe, width: 130 }} />
                  <Pillen liste={[{ id: 'monat', label: 'je Monat' }, { id: 'einmalig', label: 'einmalig' }]} aktiv={deal.basis} onWahl={basis => setDeal({ ...deal, basis: basis as 'monat' | 'einmalig' })} />
                </span>
              </Feldzeile>
              <Feldzeile label="Nächster Schritt">
                <span style={{ display: 'grid', gap: 6 }}>
                  <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input value={deal.schritt} onChange={e => setDeal({ ...deal, schritt: e.target.value })} placeholder="Pflicht — was passiert als Nächstes?" aria-label="Nächster Schritt" style={{ ...eingabe, flex: 1, minWidth: 160 }} />
                    <input type="date" value={deal.datum} onChange={e => setDeal({ ...deal, datum: e.target.value })} aria-label="Datum" style={{ ...eingabe, width: 150 }} />
                  </span>
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{SCHRITTE.map(s => <button key={s} onClick={() => setDeal({ ...deal, schritt: s })} style={{ background: 'none', border: '1px dashed rgba(255,255,255,.18)', borderRadius: 8, padding: '3px 8px', color: C.inkDim, cursor: 'pointer', fontSize: 12 }}>{s}</button>)}</span>
                </span>
              </Feldzeile>
              <Feldzeile label="Entscheidung bis"><input type="date" value={deal.erwartetAm} onChange={e => setDeal({ ...deal, erwartetAm: e.target.value })} aria-label="Entscheidung bis" style={{ ...eingabe, width: 150 }} /></Feldzeile>
              <Feldzeile label="Führt den Deal"><ZustaendigWahl wert={deal.besitzer} welt="sales" beide={false} onWahl={besitzer => setDeal({ ...deal, besitzer })} /></Feldzeile>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Knopf farbe={LEUCHT.gut} aus={!deal.schritt.trim() || !deal.datum} onClick={zumSql}>Zum SQL → Deal anlegen</Knopf>
                {!bereit && <span style={{ fontSize: 12, color: LEUCHT.achtung }}>ohne alle Kriterien — wird im Lead vermerkt</span>}
              </div>
            </>
          ) : (
            <button onClick={() => setTrotzdem(true)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0, textAlign: 'left' }}>trotzdem schon als SQL übergeben …</button>
          )}
        </div>
      )}

      <div>
        <Ueberschrift>Notiz zum Lead</Ueberschrift>
        <textarea value={notiz} onChange={e => setNotiz(e.target.value)} onBlur={() => { if (notiz !== (z.notiz ?? '')) void setze({ notiz }); }} rows={3} placeholder="Was wir über die Firma und den Bedarf wissen …" aria-label="Notiz zum Lead" style={{ ...eingabe, width: '100%', lineHeight: 1.5 }} />
      </div>
      {meldung && <div style={{ fontSize: 12.5, color: C.inkDim }}>{meldung}</div>}
    </div>
  );
}

/**
 * Qualifizierungs-Runde (ersetzt die Chancen-Runde, 25.09.): alle Leads in
 * Arbeit (kontaktiert, im Gespräch, Qualifizierung) Karte für Karte — die
 * sechs Kernfragen klicken, bei SQL-bereit direkt „Zum SQL → Deal anlegen“.
 * Die Reihenfolge wird beim Start festgehalten, damit sich die Liste unter der
 * Hand nicht verschiebt, wenn ein Lead zum SQL wird.
 */
export function QualifizierungsRunde({ api, zuKontakt, zurueck }: { api: CrmApi; zuKontakt: (id: string) => void; zurueck: () => void }) {
  const router = useRouter();
  const { d, laden } = useLeads(api);
  const [ids, setIds] = useState<string[] | null>(null);
  const [pos, setPos] = useState(0);
  useEffect(() => { if (d && !ids) setIds(d.leads.filter(z => ['kontaktiert', 'im_gespraech', 'qualifizierung'].includes(z.status)).map(z => z.id)); }, [d, ids]);
  if (!d || !ids) return <Karte i={0}><Leer>Lädt die Leads …</Leer></Karte>;
  const z = ids[pos] ? d.leads.find(x => x.id === ids[pos]) : undefined;
  const sql = ids.filter(id => d.leads.find(x => x.id === id)?.status === 'sql').length;
  const zuDeals = () => router.push(markttraktion('sales', 'pipeline'));
  return (
    <>
      <Karte i={0} akzent={LEUCHT.business}>
        <Ueberschrift farbe={LEUCHT.business} rechts={<span>{Math.min(pos + 1, ids.length)} von {ids.length}</span>}>Qualifizierungs-Runde</Ueberschrift>
        <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>Ebene 1 → 2: Je Lead die sechs Kernfragen klären. Sind Schmerz und Entscheider geklärt, dazu Budget oder Zeitpunkt, wird es ein SQL — und der Deal steht in der Pipeline.</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <Chip farbe={LEUCHT.gut}>{sql} SQL</Chip>
          <span style={{ flex: 1 }} />
          <button onClick={zurueck} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5 }}>Zur Kartei</button>
          {sql > 0 && <Knopf leise onClick={zuDeals}>Zu den Deals</Knopf>}
        </div>
      </Karte>
      {z ? (
        <Karte i={1} akzent={STATUS_FARBE[z.status]}>
          <Qualifizierung key={z.id} z={z} api={api} laden={laden} zuKontakt={zuKontakt} zuDeal={zuDeals} />
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <Knopf onClick={() => setPos(pos + 1)}>Weiter →</Knopf>
            {pos > 0 && <Knopf leise onClick={() => setPos(pos - 1)}>← Zurück</Knopf>}
          </div>
        </Karte>
      ) : (
        <Karte i={1}><Leer>{ids.length ? `Runde durch — ${sql} von ${ids.length} sind SQL. Die Deals laufen jetzt in der Pipeline.` : 'Gerade kein Lead in Arbeit. Neue kommen aus der Power Hour, aus Events und Kampagnen.'}</Leer>{sql > 0 && <Knopf onClick={zuDeals}>Zu den Deals</Knopf>}</Karte>
      )}
    </>
  );
}

/**
 * Der Lead in der Karteikarte (Person) und der Firmenkarte: Ebene 1 auf einen
 * Blick — Status, sechs Kernfragen als Punkte, was bis zum SQL fehlt, ein
 * laufender Deal — und „Qualifizieren“ springt in Sales › Leads zu genau
 * diesem Lead. Mit Firma liegt der Lead an der Firma, sonst an der Person.
 */
export function LeadBlock({ api, leadId }: { api: CrmApi; leadId: string }) {
  const router = useRouter();
  const z = useMemo(() => (api.crm && api.kontakte ? leads(api.kontakte, api.crm.stand).find(x => x.id === leadId) : undefined), [api.crm, api.kontakte, leadId]);
  if (!z) return null;
  const fehlt = fehltBisSql(z.kriterien);
  return (
    <div>
      <Ueberschrift rechts={<Knopf leise onClick={() => router.push(markttraktion('sales', 'leads', z.id))}>{z.status === 'sql' || z.status === 'kunde' ? 'Zum Lead' : 'Qualifizieren'}</Knopf>}>Lead · Ebene 1{z.art === 'firma' ? ' (Firma)' : ''}</Ueberschrift>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>
        <Chip farbe={STATUS_FARBE[z.status]}>{statusLabel(z.status)}</Chip>
        <KriterienPunkte k={z.kriterien} />
        <span style={{ color: C.inkDim }}>{geklaert(z.kriterien)} von 6 geklärt{!sqlBereit(z.kriterien) && z.status !== 'sql' && z.status !== 'kunde' ? ` · bis SQL fehlt: ${fehlt.join(', ')}` : ''}</span>
      </div>
      {z.deal && <div style={{ fontSize: 12.5, color: C.inkDim, marginTop: 6 }}>Ebene 2 · Deal „{z.deal.titel}“ · {STUFEN.find(s => s.id === z.deal!.stufe)?.label}{z.deal.wert ? ` · ${euro(z.deal.wert)}` : ''}</div>}
    </div>
  );
}
