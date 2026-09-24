'use client';

// ─── CRM · Kartei — Personen und Firmen ────────────────────────────────────
// Personen: Kennzahlen im Kopf, gespeicherte Ansichten, Suche, Tastatur
// (/ sucht, j/k blättert, Enter öffnet, Esc schließt), Anlegen mit
// Dublettenprüfung. Die Karteikarte hat vier Reiter: Überblick (Kanäle,
// Beziehung, nächster Schritt, Chancen, Entwurf) · Verlauf (Notizvorlage,
// Filter) · Stammdaten (alle Felder der Masterdatei) · Recht (Art. 6/14/15/
// 17/21, Einwilligungen, Werbesperre). Quelle ist die Masterdatei — das
// Adressbuch der Kontakte-App bleibt bewusst draußen.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip, Punkt, feld, Spalten, Spalte, useBreit, LEUCHT } from '../schlank';
import {
  anzeigename, STUFE_LABEL, STUFEN, KREIS_TAKT, HERKUNFT, RECHTSGRUNDLAGEN,
  type Kontakt, type Kreis, type Lebensphase, type Einwilligung, type EinwilligungKanal, type Grundlage, type Stufe, type Herkunft, type Rechtsgrundlage, type AktivitaetArt,
} from '@/lib/make-one/crm';
import { ampel as kanalAmpel, art14, besterKanal } from '@/lib/crm/recht';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { dubletten } from '@/lib/crm/dubletten';
import { type CrmApi, neueId, datum, euro } from './daten';
import { KanalAmpel, Grund, NotizFormular, Verlauf, Feldzeile, Pillen, Feld, AMPEL_FARBE } from './teile';
import { Firmen, neueFirma } from './Firmen';

type Modus = 'personen' | 'firmen';
type Ansicht = 'alle' | 'kunden' | 'kreis' | 'prio' | 'chancen' | 'mail' | 'anreichern' | 'art14' | 'gesperrt' | 'dubletten';
const PHASEN: { id: Lebensphase; label: string }[] = [
  { id: 'kontakt', label: 'Kontakt' }, { id: 'interessent', label: 'Interessent' }, { id: 'kunde', label: 'Kunde' }, { id: 'ex_kunde', label: 'Ex-Kunde' }, { id: 'partner', label: 'Partner' }, { id: 'multiplikator', label: 'Multiplikator' },
];
const KREISE: { id: Kreis; label: string }[] = (['A', 'B', 'C', 'D'] as Kreis[]).map(k => ({ id: k, label: `${k} · ${KREIS_TAKT[k]} T` }));
const EW_KANAL: { id: EinwilligungKanal; label: string }[] = [{ id: 'mail', label: 'Mail' }, { id: 'telefon', label: 'Telefon' }, { id: 'social', label: 'LinkedIn/Social' }, { id: 'newsletter', label: 'Newsletter' }, { id: 'einladung', label: 'Einladungen' }];
const GRUNDLAGEN: { id: Grundlage; label: string }[] = [{ id: 'einwilligung', label: 'Einwilligung' }, { id: 'anfrage', label: 'Anfrage' }, { id: 'intro_akzeptiert', label: 'Intro akzeptiert' }, { id: 'vertrag', label: 'Vertrag' }];
const phaseFarbe = (p?: string) => (p === 'kunde' ? LEUCHT.gut : p === 'partner' || p === 'multiplikator' ? LEUCHT.agenten : p === 'interessent' ? LEUCHT.business : p === 'ex_kunde' ? C.inkLeise : LEUCHT.puls);
const phaseLabel = (p?: string) => PHASEN.find(x => x.id === p)?.label ?? 'Kontakt';

export function Kartei({ api, name, modus, auswahl, setAuswahl, zuKontakt, zuFirma, start }: { api: CrmApi; name: (p: string) => string; modus: Modus; auswahl: string | null; setAuswahl: (id: string | null) => void; zuKontakt: (id: string) => void; zuFirma: (id: string) => void; start?: string }) {
  const breit = useBreit();
  const [suche, setSuche] = useState('');
  const [ansicht, setAnsicht] = useState<Ansicht>(start === 'dubletten' ? 'dubletten' : 'alle');
  const [mehr, setMehr] = useState(80);
  const [markiert, setMarkiert] = useState(0);
  const [anlegen, setAnlegen] = useState(false);
  const sucheRef = useRef<HTMLInputElement>(null);
  const kontakte = api.kontakte ?? [];
  const crm = api.crm;
  const heute = crm?.heute ?? new Date().toISOString().slice(0, 10);
  const firmen = useMemo(() => new Map((crm?.stand.firmen ?? []).map(f => [f.id, f])), [crm]);
  const mitChance = useMemo(() => new Set((crm?.stand.chancen ?? []).filter(c => OFFENE_STUFEN.includes(c.stufe)).flatMap(c => c.kontaktIds)), [crm]);
  const mitMandat = useMemo(() => new Set((crm?.stand.mandate ?? []).filter(m => m.status === 'aktiv').flatMap(m => m.kontaktIds)), [crm]);
  const paare = useMemo(() => dubletten(kontakte), [kontakte]);
  useEffect(() => { if (start === 'dubletten') setAnsicht('dubletten'); }, [start]);

  const filter: Record<Ansicht, (k: Kontakt) => boolean> = {
    alle: () => true, kunden: k => k.lebensphase === 'kunde', kreis: k => k.kreis === 'A' || k.kreis === 'B', prio: k => k.prio === 'A',
    chancen: k => mitChance.has(k.id), mail: k => !!k.email, anreichern: k => !k.email && !k.telefon && !k.sms || !k.firma,
    art14: k => !!art14(k, heute)?.faellig, gesperrt: k => !!k.werbesperre, dubletten: k => paare.some(([a, b]) => a.id === k.id || b.id === k.id),
  };
  const ANSICHTEN: { id: Ansicht; label: string }[] = ([
    ['alle', 'Alle'], ['kunden', 'Kunden'], ['kreis', 'Kreis A/B'], ['prio', 'Prio A'], ['chancen', 'Mit Chance'], ['mail', 'Mit E-Mail'], ['anreichern', 'Anreichern'], ['art14', 'Art. 14'], ['gesperrt', 'Gesperrt'], ['dubletten', 'Dubletten'],
  ] as [Ansicht, string][]).map(([id, l]) => ({ id, label: `${l} ${kontakte.filter(filter[id]).length}` }));

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    let l = kontakte.filter(filter[ansicht]);
    if (q) l = l.filter(k => [anzeigename(k), k.firma ?? '', k.email ?? '', k.firmaBranche ?? '', k.position ?? '', k.firmaStadt ?? '', k.telefon ?? ''].join(' ').toLowerCase().includes(q));
    const rang = (k: Kontakt) => (k.lebensphase === 'kunde' ? 0 : k.kreis === 'A' ? 1 : k.kreis === 'B' ? 2 : k.prio === 'A' ? 3 : k.prio === 'B' ? 4 : 5);
    return [...l].sort((a, b) => (ansicht === 'dubletten' ? anzeigename(a).localeCompare(anzeigename(b)) : rang(a) - rang(b) || anzeigename(a).localeCompare(anzeigename(b))));
  }, [kontakte, suche, ansicht, mitChance, heute, paare]); // eslint-disable-line react-hooks/exhaustive-deps
  const sichtbar = treffer.slice(0, mehr);
  const erreichbar = kontakte.filter(k => k.email || k.telefon || k.sms).length;
  const freigegeben = kontakte.filter(k => kanalAmpel(k, { hatMandat: mitMandat.has(k.id) }).some(s => s.kanal === 'mail' && s.farbe === 'gruen')).length;

  // Tastatur wie in einer guten Liste: / sucht, j/k blättert, Enter öffnet, Esc schließt.
  useEffect(() => {
    if (modus !== 'personen') return;
    const taste = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const imFeld = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      if (e.key === 'Escape') { if (imFeld) (t as HTMLInputElement).blur(); else setAuswahl(null); return; }
      if (imFeld) return;
      if (e.key === '/') { e.preventDefault(); sucheRef.current?.focus(); }
      else if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setMarkiert(m => Math.min(sichtbar.length - 1, m + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setMarkiert(m => Math.max(0, m - 1)); }
      else if (e.key === 'Enter' && sichtbar[markiert]) setAuswahl(sichtbar[markiert].id);
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [modus, sichtbar, markiert, setAuswahl]);
  useEffect(() => { setMarkiert(0); }, [suche, ansicht]);

  const zusammen = async (behalten: string, weg: string) => {
    const r = await fetch('/api/crm/dubletten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ behalten, weg }) }).then(x => x.json()).catch(() => null);
    if (r?.ok) { await api.laden(); setAuswahl(behalten); } else api.setFehler(r?.fehler ?? 'Nicht zusammengeführt.');
  };

  const k = auswahl && !auswahl.startsWith('f-') ? kontakte.find(x => x.id === auswahl) ?? null : null;
  const kopf = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input ref={sucheRef} value={suche} onChange={e => setSuche(e.target.value)} placeholder={modus === 'personen' ? 'Suchen: Name, Firma, Branche, Ort …  ( / )' : 'Firma, Domain, Branche, Ort …'} aria-label="Suchen" style={{ ...feld, flex: 1, minWidth: 200, padding: '9px 13px', fontSize: TYP.bedien }} />
      {modus === 'personen' ? <Knopf onClick={() => setAnlegen(!anlegen)}>+ Person</Knopf>
        : <Knopf onClick={() => { const n = window.prompt('Name der Firma'); if (n?.trim()) { const f = neueFirma(n); void api.setze('firmen', f as unknown as { id: string } & Record<string, unknown>).then(() => zuFirma(f.id)); } }}>+ Firma</Knopf>}
    </div>
  );

  if (modus === 'firmen') {
    return (
      <>
        <Karte i={0}>{kopf}</Karte>
        <Firmen api={api} auswahl={auswahl?.startsWith('f-') ? auswahl : null} setAuswahl={setAuswahl} zuPerson={zuKontakt} suche={suche} />
      </>
    );
  }

  return (
    <>
      <Karte i={0}>
        {kopf}
        {anlegen && <Anlegen api={api} heute={heute} onFertig={id => { setAnlegen(false); if (id) setAuswahl(id); }} />}
      </Karte>
      <Spalten verhaeltnis="3:2">
        <Spalte>
          <Karte i={1}>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10 }}>
              <span><b style={{ color: C.ink }}>{suche || ansicht !== 'alle' ? treffer.length : kontakte.length}</b> {suche || ansicht !== 'alle' ? 'Treffer' : 'Personen'}</span>
              <span title="Mail oder Telefon vorhanden"><b style={{ color: C.ink }}>{erreichbar}</b> erreichbar</span>
              <span title="Werbung per Mail zulässig (Einwilligung oder Bestandskunde)"><b style={{ color: C.ink }}>{freigegeben}</b> Mail freigegeben</span>
              {breit && <span style={{ marginLeft: 'auto', color: C.inkLeise, fontSize: 12 }}>/ suchen · j k blättern · Enter öffnen</span>}
            </div>
            <div style={{ marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={ANSICHTEN} aktiv={ansicht} onWahl={a => { setAnsicht(a); setMehr(80); }} /></div>
            {ansicht === 'dubletten' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {paare.map(([a, b]) => (
                  <div key={`${a.id}|${b.id}`} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 8 }}>
                    {[a, b].map(x => <div key={x.id} style={{ fontSize: TYP.bedien }}><b style={{ fontWeight: 600 }}>{anzeigename(x)}</b> <span style={{ color: C.inkLeise }}>· {x.email ?? 'ohne Mail'} · {x.firma ?? '—'} · {(x.aktivitaeten ?? []).length} Einträge</span></div>)}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Knopf leise onClick={() => zusammen(a.id, b.id)}>Erste behalten</Knopf><Knopf leise onClick={() => zusammen(b.id, a.id)}>Zweite behalten</Knopf></div>
                  </div>
                ))}
                {!paare.length && <Leer>Keine Dubletten.</Leer>}
                <div style={{ fontSize: 12, color: C.inkLeise }}>Gleicher Name und ein zweites Merkmal (Firma, Domain, LinkedIn, Telefon). Verlauf, Einwilligungen und die zweite Mailadresse bleiben erhalten; eine Sperre gilt weiter.</div>
              </div>
            ) : (
              <>
                {breit && (
                  <div style={{ display: 'grid', gridTemplateColumns: KARTEI_SPALTEN, gap: 12, padding: '0 8px 6px', fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    <span /><span>Name</span><span>Firma</span><span>Phase</span><span>Kanal</span><span style={{ textAlign: 'right' }}>Zuletzt</span>
                  </div>
                )}
                <div>
                  {sichtbar.map((x, i) => (
                    <div key={x.id}>
                      <KarteiZeile k={x} firma={x.firmaId ? firmen.get(x.firmaId)?.name : undefined} breit={breit} aktiv={auswahl === x.id} markiert={i === markiert && breit}
                        chance={mitChance.has(x.id)} mandat={mitMandat.has(x.id)} heute={heute} onClick={() => { setMarkiert(i); setAuswahl(auswahl === x.id ? null : x.id); }} />
                      {auswahl === x.id && !breit && <div style={{ padding: '8px 0 18px' }}><Karteikarte k={x} api={api} name={name} zuFirma={zuFirma} /></div>}
                    </div>
                  ))}
                </div>
                {treffer.length > mehr && <div style={{ marginTop: 10 }}><Knopf leise onClick={() => setMehr(mehr + 150)}>Weitere {Math.min(150, treffer.length - mehr)} zeigen</Knopf></div>}
                {!treffer.length && <Leer>Niemand gefunden. Suche zurücksetzen oder eine andere Ansicht wählen.</Leer>}
              </>
            )}
          </Karte>
        </Spalte>
        {breit && (
          <Spalte klebt>
            <Karte i={2} akzent={k ? phaseFarbe(k.lebensphase) : undefined}>
              {k ? <Karteikarte k={k} api={api} name={name} zuFirma={zuFirma} /> : <Leer>Eine Person anklicken oder mit j/k wählen und Enter — Verlauf, Notiz, Kanäle, Stammdaten und Recht erscheinen hier.</Leer>}
            </Karte>
          </Spalte>
        )}
      </Spalten>
    </>
  );
}

const KARTEI_SPALTEN = '10px minmax(0,1.6fr) minmax(0,1.2fr) 96px 64px 64px';

function KarteiZeile({ k, firma, breit, aktiv, markiert, chance, mandat, heute, onClick }: { k: Kontakt; firma?: string; breit: boolean; aktiv: boolean; markiert: boolean; chance: boolean; mandat: boolean; heute: string; onClick: () => void }) {
  const kanal = besterKanal(k, { hatMandat: mandat, hatChance: chance });
  const a14 = art14(k, heute);
  const f = firma ?? k.firma;
  if (!breit) {
    return (
      <div onClick={onClick} className="zeile zeile-klick fassbar" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', background: aktiv ? 'rgba(255,255,255,.05)' : 'transparent', borderRadius: aktiv ? 10 : 0 }}>
        <Punkt farbe={k.werbesperre ? LEUCHT.kritisch : phaseFarbe(k.lebensphase)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: TYP.body, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anzeigename(k)}{f && <span style={{ color: C.inkLeise }}> · {f}</span>}</div>
          <div style={{ fontSize: 12.5, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[k.position ?? k.jobtitel, k.naechsterSchritt ? `→ ${k.naechsterSchritt.text}` : ''].filter(Boolean).join(' · ')}</div>
        </div>
        {chance && <Chip farbe={LEUCHT.business}>Chance</Chip>}
      </div>
    );
  }
  return (
    <div onClick={onClick} className="fassbar" title={[anzeigename(k), k.position, f].filter(Boolean).join(' · ')}
      style={{ display: 'grid', gridTemplateColumns: KARTEI_SPALTEN, gap: 12, alignItems: 'center', padding: '8px 8px', minHeight: 44, borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', fontSize: TYP.bedien,
        background: aktiv ? 'rgba(255,255,255,.07)' : markiert ? 'rgba(88,217,205,.07)' : 'transparent', borderRadius: aktiv || markiert ? 8 : 0 }}>
      <Punkt farbe={k.werbesperre ? LEUCHT.kritisch : phaseFarbe(k.lebensphase)} groesse={8} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anzeigename(k)}{k.prio === 'A' && <span style={{ color: LEUCHT.gut, marginLeft: 6, fontSize: 11 }}>A</span>}{a14?.faellig && <span style={{ color: LEUCHT.kritisch, marginLeft: 6, fontSize: 11 }}>Art. 14</span>}</div>
        <div style={{ fontSize: 12, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.naechsterSchritt ? `→ ${k.naechsterSchritt.text}` : (k.position ?? k.jobtitel ?? '')}</div>
      </div>
      <div style={{ color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f ?? '—'}</div>
      <div style={{ color: k.lebensphase && k.lebensphase !== 'kontakt' ? phaseFarbe(k.lebensphase) : C.inkLeise, fontSize: 12, whiteSpace: 'nowrap' }}>{phaseLabel(k.lebensphase)}{k.kreis ? ` · ${k.kreis}` : ''}{chance ? ' ·◆' : ''}</div>
      <div title={kanal ? `${kanal.kanal}: ${kanal.grund}` : 'kein zulässiger Kanal'} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.inkDim }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: kanal ? AMPEL_FARBE[kanal.farbe] : C.inkLeise }} />{kanal ? ({ telefon: 'Tel', mail: 'Mail', linkedin: 'LI', vernetzen: 'Netz', newsletter: 'NL', einladung: 'Einl' } as Record<string, string>)[kanal.kanal] : '—'}
      </div>
      <div style={{ textAlign: 'right', fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{k.letzterKontakt ? datum(k.letzterKontakt, heute) : '—'}</div>
    </div>
  );
}

function Anlegen({ api, heute, onFertig }: { api: CrmApi; heute: string; onFertig: (id: string | null) => void }) {
  const [e, setE] = useState({ vorname: '', nachname: '', email: '', telefon: '', position: '', firma: '', lebensphase: 'kontakt' as Lebensphase, herkunft: undefined as Herkunft | undefined, anrede: 'Sie' as 'Sie' | 'Du' });
  const firmen = api.crm?.stand.firmen ?? [];
  const dublette = e.email.includes('@') ? (api.kontakte ?? []).find(k => (k.email ?? '').toLowerCase() === e.email.trim().toLowerCase()) : undefined;
  const namensgleich = e.nachname.trim() ? (api.kontakte ?? []).find(k => `${k.vorname} ${k.nachname}`.trim().toLowerCase() === `${e.vorname} ${e.nachname}`.trim().toLowerCase()) : undefined;
  const firma = firmen.find(f => f.name.toLowerCase() === e.firma.trim().toLowerCase());
  const ok = e.nachname.trim() && !dublette;
  const anlegen = async () => {
    if (!ok) return;
    let firmaId = firma?.id;
    if (!firmaId && e.firma.trim()) { const f = neueFirma(e.firma); firmaId = f.id; await api.setze('firmen', f as unknown as { id: string } & Record<string, unknown>); }
    const id = `c-neu-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const herk = HERKUNFT.find(h => h.id === e.herkunft);
    await api.kontaktSetzen({
      id, vorname: e.vorname.trim(), nachname: e.nachname.trim(), ...(e.email.trim() ? { email: e.email.trim().toLowerCase() } : {}), ...(e.telefon.trim() ? { telefon: e.telefon.trim() } : {}),
      ...(e.position.trim() ? { position: e.position.trim() } : {}), ...(e.firma.trim() ? { firma: firma?.name ?? e.firma.trim(), firmaId } : {}),
      eignung: '', prio: '', stufe: 'neu', lebensphase: e.lebensphase, anrede: e.anrede, besitzer: 'kevin', ...(e.herkunft ? { herkunft: e.herkunft, ...(herk?.fremd ? { fremddaten: true } : {}) } : {}),
      quelle: 'Von Hand angelegt', aktivitaeten: [{ am: new Date().toISOString(), art: 'system', text: 'Angelegt', von: 'kevin' }], importiertAm: heute, geaendertAm: heute,
    });
    onFertig(id);
  };
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 14, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 8 }}>
        <Feld wert={e.vorname} platzhalter="Vorname" onFertig={vorname => setE({ ...e, vorname })} />
        <Feld wert={e.nachname} platzhalter="Nachname *" onFertig={nachname => setE({ ...e, nachname })} />
        <Feld wert={e.email} platzhalter="E-Mail (Dublettenschlüssel)" onFertig={email => setE({ ...e, email })} />
        <Feld wert={e.telefon} platzhalter="Telefon" onFertig={telefon => setE({ ...e, telefon })} />
        <Feld wert={e.position} platzhalter="Position" onFertig={position => setE({ ...e, position })} />
        <div>
          <input list="crm-firmen" value={e.firma} onChange={x => setE({ ...e, firma: x.target.value })} placeholder="Firma (bestehend oder neu)" aria-label="Firma" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <datalist id="crm-firmen">{firmen.slice(0, 400).map(f => <option key={f.id} value={f.name} />)}</datalist>
        </div>
      </div>
      <Feldzeile label="Lebensphase"><Pillen liste={PHASEN} aktiv={e.lebensphase} onWahl={lebensphase => setE({ ...e, lebensphase })} /></Feldzeile>
      <Feldzeile label="Herkunft"><Pillen liste={HERKUNFT.map(h => ({ id: h.id, label: h.label }))} aktiv={e.herkunft} onWahl={herkunft => setE({ ...e, herkunft })} /></Feldzeile>
      <Feldzeile label="Anrede"><Pillen liste={[{ id: 'Sie', label: 'Sie' }, { id: 'Du', label: 'Du' }]} aktiv={e.anrede} onWahl={a => setE({ ...e, anrede: a as 'Sie' | 'Du' })} /></Feldzeile>
      {dublette && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>Diese Mail gehört schon zu {anzeigename(dublette)} — nicht doppelt anlegen.</div>}
      {!dublette && namensgleich && <div style={{ fontSize: 12.5, color: LEUCHT.achtung }}>Achtung: {anzeigename(namensgleich)}{namensgleich.firma ? ` (${namensgleich.firma})` : ''} gibt es schon — gleiche Person?</div>}
      {e.firma.trim() && !firma && <div style={{ fontSize: 12, color: C.inkLeise }}>Neue Firma „{e.firma.trim()}“ wird mit angelegt.</div>}
      <div style={{ display: 'flex', gap: 8 }}><Knopf aus={!ok} onClick={anlegen}>Anlegen</Knopf><Knopf leise onClick={() => onFertig(null)}>Abbrechen</Knopf><span style={{ fontSize: 12, color: C.inkLeise, alignSelf: 'center' }}>* Pflichtfeld · Herkunft bestimmt die Art.-14-Pflicht</span></div>
    </div>
  );
}

type Reiter = 'ueberblick' | 'verlauf' | 'stamm' | 'recht';
function Karteikarte({ k, api, name, zuFirma }: { k: Kontakt; api: CrmApi; name: (p: string) => string; zuFirma: (id: string) => void }) {
  const crm = api.crm;
  const heute = crm?.heute ?? new Date().toISOString().slice(0, 10);
  const [reiter, setReiter] = useState<Reiter>('ueberblick');
  const [notiz, setNotiz] = useState(false);
  const [artFilter, setArtFilter] = useState<'alle' | AktivitaetArt>('alle');
  const [ew, setEw] = useState<{ kanal: EinwilligungKanal; grundlage: Grundlage; nachweis: string } | null>(null);
  const [entwurf, setEntwurf] = useState<{ betreff: string; email: string; linkedin: string; hinweis: string } | 'laedt' | null>(null);
  useEffect(() => { setEntwurf(null); setNotiz(false); setEw(null); }, [k.id]);
  const firma = k.firmaId ? crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const chancen = (crm?.stand.chancen ?? []).filter(c => c.kontaktIds.includes(k.id));
  const mandate = (crm?.stand.mandate ?? []).filter(m => m.kontaktIds.includes(k.id));
  const ctx = { hatMandat: mandate.some(m => m.status === 'aktiv'), hatChance: chancen.some(c => OFFENE_STUFEN.includes(c.stufe)) };
  const ampel = kanalAmpel(k, ctx);
  const a14 = art14(k, heute);
  const setze = (teil: Partial<Kontakt>) => api.kontaktSetzen({ ...k, ...teil });
  const log = (art: string, extra: Record<string, unknown> = {}) => api.aktivitaet({ id: k.id, art, ...extra });
  const mailOk = ampel.some(s => s.kanal === 'mail' && s.farbe !== 'rot');
  const entwerfen = async () => {
    setEntwurf('laedt');
    const r = await fetch('/api/crm/entwurf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id }) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    if (r.error) { api.setFehler(r.error); setEntwurf(null); return; }
    setEntwurf(r);
  };
  const verlauf = (k.aktivitaeten ?? []).filter(a => artFilter === 'alle' || a.art === artFilter);
  const arten = Array.from(new Set((k.aktivitaeten ?? []).map(a => a.art)));
  const F = (label: string, feldname: keyof Kontakt): ReactNode => (
    <Feldzeile key={feldname} label={label}><Feld wert={String(k[feldname] ?? '')} onFertig={v => setze({ [feldname]: (feldname === 'email' ? v.trim().toLowerCase() : v.trim()) || undefined } as Partial<Kontakt>)} /></Feldzeile>
  );

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontFamily: SCHRIFT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-.015em' }}>{anzeigename(k)}</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>
          {k.position ?? k.jobtitel ?? ''}{(k.position ?? k.jobtitel) && (firma || k.firma) ? ' · ' : ''}
          {firma ? <button onClick={() => zuFirma(firma.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.2)', fontSize: TYP.bedien }}>{firma.name}</button> : k.firma}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <Chip farbe={phaseFarbe(k.lebensphase)}>{phaseLabel(k.lebensphase)}</Chip>{k.kreis && <Chip farbe={LEUCHT.beziehung}>Kreis {k.kreis}</Chip>}
          <Chip farbe={C.inkDim}>{STUFE_LABEL[k.stufe]}</Chip>{k.prio && <Chip farbe={C.inkDim}>Prio {k.prio}</Chip>}
        </div>
      </div>
      {k.werbesperre && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${LEUCHT.kritisch}18`, color: LEUCHT.kritisch, fontSize: TYP.bedien }}>Werbesperre seit {datum(k.werbesperre.seit)} — {k.werbesperre.grund}. Kein Kanal, keine Liste, kein Agent.</div>}
      {a14 && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${a14.faellig ? LEUCHT.kritisch : LEUCHT.achtung}14`, fontSize: TYP.bedien, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: a14.faellig ? LEUCHT.kritisch : LEUCHT.achtung }}>Art. 14: Daten stammen nicht von der Person — seit {a14.tage} Tagen nicht informiert (Frist ein Monat).</span>
        <Knopf leise onClick={() => setze({ art14InformiertAm: heute })}>Informiert</Knopf>
      </div>}
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen liste={[{ id: 'ueberblick', label: 'Überblick' }, { id: 'verlauf', label: `Verlauf ${(k.aktivitaeten ?? []).length}` }, { id: 'stamm', label: 'Stammdaten' }, { id: 'recht', label: 'Recht' }]} aktiv={reiter} onWahl={setReiter} farbe={LEUCHT.business} einzeilig /></div>

      {reiter === 'ueberblick' && (
        <>
          <div><Ueberschrift>Kanäle</Ueberschrift><KanalAmpel ampel={ampel} ziele={{ telefon: k.telefon ?? k.sms, email: k.email, linkedin: k.linkedin }} /><Grund ampel={ampel} /></div>
          <div>
            <Ueberschrift rechts={k.naechsterSchritt ? <button onClick={() => setze({ naechsterSchritt: undefined })} style={{ background: 'none', border: 'none', color: LEUCHT.gut, cursor: 'pointer', fontSize: 12 }}>✓ erledigt</button> : undefined}>Nächster Schritt</Ueberschrift>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><Feld wert={k.naechsterSchritt?.text} platzhalter="Was als Nächstes passiert" onFertig={text => setze({ naechsterSchritt: text.trim() ? { text: text.trim(), datum: k.naechsterSchritt?.datum ?? heute } : undefined })} /></div>
              <Feld typ="date" wert={k.naechsterSchritt?.datum} breite={150} platzhalter="Datum" onFertig={d2 => k.naechsterSchritt && setze({ naechsterSchritt: { ...k.naechsterSchritt, datum: d2 } })} />
            </div>
          </div>
          <div>
            <Ueberschrift>Beziehung</Ueberschrift>
            <Feldzeile label="Kreis"><Pillen liste={KREISE} aktiv={k.kreis} onWahl={kreis => setze({ kreis: kreis === k.kreis ? undefined : kreis })} farbe={LEUCHT.beziehung} /></Feldzeile>
            <Feldzeile label="Phase"><Pillen liste={PHASEN} aktiv={k.lebensphase ?? 'kontakt'} onWahl={lebensphase => setze({ lebensphase })} /></Feldzeile>
            <Feldzeile label="Stufe"><Pillen liste={STUFEN.map(s => ({ id: s, label: STUFE_LABEL[s] }))} aktiv={k.stufe} onWahl={(stufe: Stufe) => setze({ stufe })} /></Feldzeile>
            <Feldzeile label="Anrede"><Pillen liste={[{ id: 'Sie', label: 'Sie' }, { id: 'Du', label: 'Du' }]} aktiv={k.anrede} onWahl={anrede => setze({ anrede: anrede as 'Sie' | 'Du' })} /></Feldzeile>
            <Feldzeile label="Hält die Beziehung"><Pillen liste={[{ id: 'kevin', label: 'Kevin' }, { id: 'malin', label: 'Malin' }, { id: 'beide', label: 'Beide' }]} aktiv={k.besitzer} onWahl={besitzer => setze({ besitzer })} /></Feldzeile>
          </div>
          <div>
            <Ueberschrift rechts={<Knopf leise onClick={() => void api.setze('chancen', { id: neueId('ch'), titel: firma?.name ?? k.firma ?? anzeigename(k), kontaktIds: [k.id], ...(firma || k.firma ? { firma: firma?.name ?? k.firma } : {}), art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'qualifiziert', historie: [], qualifizierung: {}, gesellschaft: 'offen', besitzer: k.besitzer && k.besitzer !== 'beide' ? k.besitzer : 'kevin', angelegt: new Date().toISOString() })}>+ Chance</Knopf>}>Chancen & Mandate</Ueberschrift>
            {chancen.map(c => <div key={c.id} style={{ fontSize: TYP.bedien, padding: '5px 0' }}><Punkt farbe={crm?.ampel[c.id]?.ampel === 'rot' ? LEUCHT.kritisch : crm?.ampel[c.id]?.ampel === 'gelb' ? LEUCHT.achtung : LEUCHT.gut} groesse={7} /> <b style={{ fontWeight: 600 }}>{c.titel}</b> <span style={{ color: C.inkLeise }}>· {crm?.stufen.find(s => s.id === c.stufe)?.label} · {c.wert.betrag ? euro(c.wert.betrag) + (c.wert.basis === 'monat' ? '/Monat' : '') : 'ohne Wert'}</span></div>)}
            {mandate.map(m => <div key={m.id} style={{ fontSize: TYP.bedien, padding: '5px 0' }}><Punkt farbe={LEUCHT.geld} groesse={7} /> <b style={{ fontWeight: 600 }}>{m.titel.slice(0, 70)}</b> <span style={{ color: C.inkLeise }}>· Mandat {m.status}</span></div>)}
            {!chancen.length && !mandate.length && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Noch keine Chance.</div>}
          </div>
          {(k.aufhaenger || k.signale || k.marktinfo) && (
            <div>
              <Ueberschrift>Einordnung</Ueberschrift>
              {k.aufhaenger && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginBottom: 6 }}><span style={{ color: C.inkLeise }}>Aufhänger:</span> {k.aufhaenger}</div>}
              {k.signale && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginBottom: 6 }}><span style={{ color: C.inkLeise }}>Signale:</span> {k.signale}</div>}
              {k.marktinfo && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}><span style={{ color: C.inkLeise }}>Markt:</span> {k.marktinfo}</div>}
            </div>
          )}
          {!k.werbesperre && (
            <div>
              <Ueberschrift>Entwurf</Ueberschrift>
              {!entwurf && <Knopf leise onClick={entwerfen}>Jarvis entwerfen lassen</Knopf>}
              {entwurf === 'laedt' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Jarvis schreibt …</span>}
              {entwurf && entwurf !== 'laedt' && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>{entwurf.betreff}</div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.55 }}>{entwurf.email}</pre>
                  {entwurf.linkedin && <pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.55, borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 8 }}>{entwurf.linkedin}</pre>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {mailOk && <Knopf onClick={() => fetch('/api/apple-mail/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: k.email ?? '', subject: entwurf.betreff, body: entwurf.email }) })}>In Mail öffnen</Knopf>}
                    <Knopf leise onClick={() => { try { void navigator.clipboard.writeText(entwurf.linkedin || entwurf.email); } catch { /* egal */ } }}>Text kopieren</Knopf>
                    <Knopf leise onClick={() => setEntwurf(null)}>Verwerfen</Knopf>
                  </div>
                  <div style={{ fontSize: 12, color: C.inkLeise }}>{mailOk ? entwurf.hinweis : 'Mail ist für diese Person nicht freigegeben (Ampel) — den Text nur für ein persönliches Gespräch oder eine Vernetzungsanfrage ohne Werbung nutzen.'}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {reiter === 'verlauf' && (
        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {!notiz && <Knopf onClick={() => setNotiz(true)}>+ Gesprächsnotiz</Knopf>}
            {[['anruf', 'Angerufen'], ['mail', 'Mail geschickt'], ['linkedin', 'LinkedIn'], ['antwort', 'Antwort erhalten'], ['termin', 'Termin']].map(([a, l]) => <Knopf key={a} leise onClick={() => void log(a)}>{l}</Knopf>)}
          </div>
          {notiz && <div style={{ marginBottom: 10 }}><NotizFormular heute={heute} onAbbruch={() => setNotiz(false)} onFertig={x => { void log('gespraech', { notiz: x.notiz, naechster: x.naechster }); setNotiz(false); }} /></div>}
          {arten.length > 1 && <div style={{ marginBottom: 8 }}><Pillen liste={[{ id: 'alle', label: 'Alle' }, ...arten.map(a => ({ id: a, label: a }))] as { id: 'alle' | AktivitaetArt; label: string }[]} aktiv={artFilter} onWahl={setArtFilter} /></div>}
          <Verlauf liste={verlauf} name={name} heute={heute} max={60} />
        </div>
      )}

      {reiter === 'stamm' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div><Ueberschrift>Person</Ueberschrift>
            {F('Vorname', 'vorname')}{F('Nachname', 'nachname')}{F('Position', 'position')}{F('Jobtitel', 'jobtitel')}{F('Seniorität', 'senioritaet')}
            {F('E-Mail', 'email')}{F('Telefon', 'telefon')}{F('Mobil / SMS', 'sms')}{F('LinkedIn', 'linkedin')}{F('Über die Person', 'personInfo')}
          </div>
          <div><Ueberschrift rechts={firma ? <button onClick={() => zuFirma(firma.id)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>Firma öffnen ›</button> : undefined}>Firma</Ueberschrift>
            <Feldzeile label="Firma">
              <div>
                <input list="crm-firmen-karte" defaultValue={firma?.name ?? k.firma ?? ''} key={k.id} aria-label="Firma" placeholder="Firma zuordnen …"
                  onBlur={async e => { const n = e.target.value.trim(); if (n === (firma?.name ?? k.firma ?? '')) return; if (!n) return void setze({ firma: undefined, firmaId: undefined }); const f = (crm?.stand.firmen ?? []).find(x => x.name.toLowerCase() === n.toLowerCase()) ?? neueFirma(n); if (!(crm?.stand.firmen ?? []).some(x => x.id === f.id)) await api.setze('firmen', f as unknown as { id: string } & Record<string, unknown>); void setze({ firma: f.name, firmaId: f.id }); }}
                  style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
                <datalist id="crm-firmen-karte">{(crm?.stand.firmen ?? []).slice(0, 400).map(f => <option key={f.id} value={f.name} />)}</datalist>
              </div>
            </Feldzeile>
            {firma && <div style={{ fontSize: 12.5, color: C.inkLeise, padding: '4px 0' }}>{[firma.branche, firma.stadt, firma.mitarbeiter ? `${firma.mitarbeiter} MA` : '', firma.webseite].filter(Boolean).join(' · ') || 'Firmendetails in der Firmenkarte pflegen'}</div>}
          </div>
          <div><Ueberschrift>Einordnung</Ueberschrift>
            <Feldzeile label="Prio"><Pillen liste={[{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C' }, { id: '', label: '—' }]} aktiv={k.prio} onWahl={p => setze({ prio: p as Kontakt['prio'] })} /></Feldzeile>
            <Feldzeile label="Eignung"><Pillen liste={[{ id: 'ja', label: 'ja' }, { id: 'vielleicht', label: 'vielleicht' }, { id: 'nein', label: 'nein' }, { id: '', label: '—' }]} aktiv={k.eignung} onWahl={x => setze({ eignung: x as Kontakt['eignung'] })} /></Feldzeile>
            {F('Typ', 'typ')}{F('Kategorie', 'kategorie')}{F('Aufhänger', 'aufhaenger')}{F('Signale', 'signale')}{F('Marktinfo', 'marktinfo')}{F('KI-Bezug', 'kiBezug')}{F('Steckbrief', 'steckbrief')}
            {F('Vorgestellt durch', 'vorgestelltDurch')}{F('Notiz', 'notiz')}
          </div>
          <div><Ueberschrift>Herkunft der Daten</Ueberschrift>
            {F('Quelle', 'quelle')}{F('Recherche-Stand', 'recherche')}{F('Owner (Import)', 'owner')}{F('Lifecycle (Import)', 'lifecycle')}{F('HubSpot-ID', 'hubspotId')}
            <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 4 }}>Importiert {datum(k.importiertAm)} · geändert {datum(k.geaendertAm)} · Kennung {k.id}</div>
          </div>
          <div><Ueberschrift>Privat</Ueberschrift><Feldzeile label="Nie an Agenten"><Feld wert={k.privatNotiz} onFertig={privatNotiz => setze({ privatNotiz: privatNotiz || undefined })} /></Feldzeile></div>
        </div>
      )}

      {reiter === 'recht' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div><Ueberschrift>Grundlage</Ueberschrift>
            <Feldzeile label="Rechtsgrundlage (Art. 6)"><Pillen liste={RECHTSGRUNDLAGEN.map(r => ({ id: r.id, label: r.label }))} aktiv={k.rechtsgrundlage} onWahl={(r: Rechtsgrundlage) => setze({ rechtsgrundlage: r })} /></Feldzeile>
            <Feldzeile label="Herkunft (Art. 14)"><Pillen liste={HERKUNFT.map(h => ({ id: h.id, label: h.label }))} aktiv={k.herkunft} onWahl={(h: Herkunft) => setze({ herkunft: h, ...(HERKUNFT.find(x => x.id === h)?.fremd ? { fremddaten: true } : { fremddaten: undefined }) })} /></Feldzeile>
            {k.fremddaten && <Feldzeile label="Informiert"><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 12.5, color: C.inkDim }}>{k.art14InformiertAm ? `am ${datum(k.art14InformiertAm)}` : 'noch nicht'}</span>{!k.art14InformiertAm && <Knopf leise onClick={() => setze({ art14InformiertAm: heute })}>Heute informiert</Knopf>}</div></Feldzeile>}
          </div>
          <div>
            <Ueberschrift rechts={!ew ? <Knopf leise onClick={() => setEw({ kanal: 'mail', grundlage: 'einwilligung', nachweis: '' })}>+ Einwilligung</Knopf> : undefined}>Einwilligungen</Ueberschrift>
            {(k.einwilligungen ?? []).map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, padding: '4px 0', color: e.widerrufenAm ? C.inkLeise : C.ink }}>
                <span>{EW_KANAL.find(x => x.id === e.kanal)?.label} · {GRUNDLAGEN.find(x => x.id === e.grundlage)?.label ?? e.grundlage} · {datum(e.erteiltAm)}{e.nachweis ? ` · „${e.nachweis.slice(0, 60)}“` : ''}{e.widerrufenAm ? ` · widerrufen ${datum(e.widerrufenAm)}` : ''}</span>
                {!e.widerrufenAm && <button onClick={() => setze({ einwilligungen: (k.einwilligungen ?? []).map((x, j) => (j === i ? { ...x, widerrufenAm: heute } : x)) })} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>Widerruf</button>}
              </div>
            ))}
            {!(k.einwilligungen ?? []).length && !ew && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Keine. Einwilligung im Gespräch einholen und den Wortlaut festhalten.</div>}
            {ew && (
              <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
                <Pillen liste={EW_KANAL} aktiv={ew.kanal} onWahl={kanal => setEw({ ...ew, kanal })} />
                <Pillen liste={GRUNDLAGEN} aktiv={ew.grundlage} onWahl={grundlage => setEw({ ...ew, grundlage })} />
                <input value={ew.nachweis} onChange={e => setEw({ ...ew, nachweis: e.target.value })} placeholder="Nachweis: Wortlaut oder Beleg („im Gespräch am …: Darf ich Ihnen … schicken? — ja“)" aria-label="Nachweis" style={{ ...feld, fontSize: TYP.bedien }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Knopf aus={!ew.nachweis.trim()} onClick={() => { const neu: Einwilligung = { kanal: ew.kanal, grundlage: ew.grundlage, erteiltAm: heute, nachweis: ew.nachweis.trim() }; void setze({ einwilligungen: [...(k.einwilligungen ?? []), neu], ...(ew.grundlage === 'einwilligung' ? { rechtsgrundlage: 'einwilligung' as Rechtsgrundlage } : {}) }); setEw(null); }}>Festhalten</Knopf>
                  <Knopf leise onClick={() => setEw(null)}>Abbrechen</Knopf>
                </div>
                <div style={{ fontSize: 12, color: C.inkLeise }}>Eine Visitenkarte ist keine Einwilligung. Newsletter nur per Double-Opt-in.</div>
              </div>
            )}
          </div>
          <div>
            <Ueberschrift>Werbewiderspruch (Art. 21)</Ueberschrift>
            {!k.werbesperre
              ? <Knopf leise onClick={() => { if (window.confirm('Werbewiderspruch eintragen? Die Person wird aus allen Listen genommen — dauerhaft.')) void setze({ werbesperre: { seit: heute, grund: 'Widerspruch' }, wiedervorlage: undefined, naechsterSchritt: undefined }); }}>Werbesperre eintragen</Knopf>
              : <Knopf leise onClick={() => { if (window.confirm('Sperre aufheben? Nur, wenn die Person ausdrücklich wieder eingewilligt hat.')) void setze({ werbesperre: undefined }); }}>Sperre aufheben (nur nach neuer Einwilligung)</Knopf>}
          </div>
          <div>
            <Ueberschrift>Betroffenenrechte</Ueberschrift>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf leise onClick={() => { window.location.href = `/api/crm/datenschutz?id=${k.id}`; }}>Auskunft (Art. 15) als Datei</Knopf>
              <Knopf leise onClick={async () => {
                if (!window.confirm(`${anzeigename(k)} endgültig löschen (Art. 17)? Besser oft: Werbesperre — dann bleibt „nicht anschreiben“ erhalten.`)) return;
                const grund = window.prompt('Grund (für das Löschprotokoll, ohne Personendaten)', 'Löschverlangen Art. 17') ?? '';
                const r = await fetch('/api/crm/datenschutz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, grund }) }).then(x => x.json()).catch(() => null);
                if (r?.ok) void api.laden(); else api.setFehler('Nicht gelöscht.');
              }}>Löschen (Art. 17)</Knopf>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
