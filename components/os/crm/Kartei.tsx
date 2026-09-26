'use client';

// ─── Markttraktion · Kontakte und Firmen (die Kartei) ────────────────────────────────────
// Personen: Kennzahlen im Kopf, gespeicherte Ansichten, Suche, Tastatur
// (/ sucht, j/k blättert, Enter öffnet, Esc schließt), Anlegen mit
// Dublettenprüfung. Die Karteikarte hat vier Reiter: Überblick (Kanäle,
// Beziehung, nächster Schritt, Deals, Entwurf) · Verlauf (Notizvorlage,
// Filter) · Stammdaten (die Matrix aller Felder der Masterdatei) · Recht
// (Art. 6/14/15/17/21, Einwilligungen, Werbesperre). Oben rechts „Akte
// öffnen“: dieselbe Person auf einer ganzen Seite (Akte.tsx), mit Zurück in die
// Kartei. Die Bausteine teilen sich Karte und Akte (kontakt-teile.tsx).
// Quelle ist die Masterdatei — das Adressbuch der Kontakte-App bleibt bewusst draußen.
// Zu zweit (25.09.): Filter „Alle · Meins · Malin“ nach „Hält die Beziehung“
// (ohne Eintrag: Sales-Verantwortung, Kevin), gefilterte Kontakte gesammelt
// übergeben, je Person „Übergeben“ und „Malin ist gerade hier“. Die private
// Notiz sieht nur, wer sie schrieb (serverseitig).

import { useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip, Punkt, feld, Spalten, Spalte, useBreit, LEUCHT } from '../schlank';
import { anzeigename, STUFE_LABEL, HERKUNFT, type Kontakt, type Lebensphase, type Herkunft, rollenVon, ROLLE_LABEL } from '@/lib/make-one/crm';
import { ampel as kanalAmpel, art14, besterKanal } from '@/lib/crm/recht';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { dubletten } from '@/lib/crm/dubletten';
import { type CrmApi, datum } from './daten';
import { KanalAmpel, Grund, Feldzeile, Pillen, Feld, AMPEL_FARBE } from './teile';
import { Firmen, neueFirma } from './Firmen';
import { Person, WerFilter, useWerFilter, passtWer, Uebergeben, AuchHier } from './team';
import { VisitenkarteKnopf } from './Visitenkarte';
import { LeadBlock } from './Leads';
import { PHASEN, phaseFarbe, phaseLabel, Hinweise, NaechsterSchrittTeil, BeziehungTeil, DealsTeil, EntwurfTeil, VerlaufTeil, RechtTeil, Matrix, LinkedInTeil } from './kontakt-teile';
import { gleicherName } from '@/lib/crm/visitenkarte';
import { haeltBeziehung, anderer, nameVon } from '@/lib/crm/team';

type Modus = 'personen' | 'firmen';
type Ansicht = 'alle' | 'kunden' | 'kreis' | 'prio' | 'chancen' | 'mail' | 'anreichern' | 'art14' | 'gesperrt' | 'dubletten';
const ANSICHT_IDS: Ansicht[] = ['alle', 'kunden', 'kreis', 'prio', 'chancen', 'mail', 'anreichern', 'art14', 'gesperrt', 'dubletten'];
const istAnsicht = (a?: string): a is Ansicht => !!a && (ANSICHT_IDS as string[]).includes(a);

export function Kartei({ api, name, modus, auswahl, setAuswahl, zuKontakt, zuFirma, start, zuRunde, zuAkte }: { api: CrmApi; name: (p: string) => string; modus: Modus; auswahl: string | null; setAuswahl: (id: string | null) => void; zuKontakt: (id: string) => void; zuFirma: (id: string) => void; start?: string; zuRunde?: (art: 'kreis' | 'chancen' | 'vernetzen') => void; zuAkte?: (id: string) => void }) {
  const breit = useBreit();
  const [suche, setSuche] = useState('');
  // Die Ansicht kommt aus der Adresse (?a=art14|anreichern|gesperrt|…) — Befunde, Index-Punkte und Übergaben landen so auf der richtigen Liste (26.09.).
  const [ansicht, setAnsicht] = useState<Ansicht>(istAnsicht(start) ? start : 'alle');
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
  useEffect(() => { if (istAnsicht(start)) setAnsicht(start); }, [start]);
  const [wer, setWer] = useWerFilter('kontakte');
  // Aus einer Übergabe-Aufgabe (…&wer=malin) direkt in die übergebenen Kontakte.
  useEffect(() => { const w = new URLSearchParams(window.location.search).get('wer'); if (w) setWer(w === api.ich ? 'ich' : w); }, [api.ich]); // eslint-disable-line react-hooks/exhaustive-deps
  const ich = api.ich;

  const filter: Record<Ansicht, (k: Kontakt) => boolean> = {
    alle: () => true, kunden: k => k.lebensphase === 'kunde', kreis: k => k.kreis === 'A' || k.kreis === 'B', prio: k => k.prio === 'A',
    chancen: k => mitChance.has(k.id), mail: k => !!k.email, anreichern: k => !k.email && !k.telefon && !k.sms || !k.firma,
    art14: k => !!art14(k, heute)?.faellig, gesperrt: k => !!k.werbesperre, dubletten: k => paare.some(([a, b]) => a.id === k.id || b.id === k.id),
  };
  const ANSICHTEN: { id: Ansicht; label: string }[] = ([
    ['alle', 'Alle'], ['kunden', 'Kunden'], ['kreis', 'Kreis A/B'], ['prio', 'Prio A'], ['chancen', 'Mit Deal'], ['mail', 'Mit E-Mail'], ['anreichern', 'Anreichern'], ['art14', 'Art. 14'], ['gesperrt', 'Gesperrt'], ['dubletten', 'Dubletten'],
  ] as [Ansicht, string][]).map(([id, l]) => ({ id, label: `${l} ${kontakte.filter(filter[id]).length}` }));

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    let l = kontakte.filter(filter[ansicht]).filter(k => passtWer(wer, k.besitzer, 'sales', ich));
    if (q) l = l.filter(k => [anzeigename(k), k.firma ?? '', k.email ?? '', k.firmaBranche ?? '', k.position ?? '', k.firmaStadt ?? '', k.telefon ?? ''].join(' ').toLowerCase().includes(q));
    const rang = (k: Kontakt) => (k.lebensphase === 'kunde' ? 0 : k.kreis === 'A' ? 1 : k.kreis === 'B' ? 2 : k.prio === 'A' ? 3 : k.prio === 'B' ? 4 : 5);
    return [...l].sort((a, b) => (ansicht === 'dubletten' ? anzeigename(a).localeCompare(anzeigename(b)) : rang(a) - rang(b) || anzeigename(a).localeCompare(anzeigename(b))));
  }, [kontakte, suche, ansicht, mitChance, heute, paare, wer, ich]); // eslint-disable-line react-hooks/exhaustive-deps
  const sichtbar = treffer.slice(0, mehr);
  const erreichbar = kontakte.filter(k => k.email || k.telefon || k.sms).length;
  const freigegeben = kontakte.filter(k => kanalAmpel(k, { hatMandat: mitMandat.has(k.id) }).some(s => s.kanal === 'mail' && s.farbe === 'gruen')).length;
  const werZahlen = ich ? { alle: kontakte.length, ich: kontakte.filter(k => passtWer('ich', k.besitzer, 'sales', ich)).length, [anderer(ich)]: kontakte.filter(k => passtWer(anderer(ich), k.besitzer, 'sales', ich)).length } : undefined;
  // Gesammelt übergeben geht nur mit einer Eingrenzung — nie aus Versehen die ganze Kartei.
  const eingegrenzt = !!suche.trim() || ansicht !== 'alle' || wer !== 'alle';
  const sammel = eingegrenzt && treffer.length > 0 && treffer.length <= 300 ? treffer.filter(k => !k.werbesperre) : [];

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
  // Zurück aus der Akte (oder ein Link mit ?k=): die gewählte Person steht einmal sichtbar in der Liste — späteres Anklicken springt nicht.
  const erstesMal = useRef(true);
  useEffect(() => {
    if (!erstesMal.current || modus !== 'personen' || !kontakte.length) return;
    const i = auswahl ? treffer.findIndex(x => x.id === auswahl) : -1;
    if (i >= mehr) { setMehr(i + 20); return; }
    erstesMal.current = false;
    if (i < 0) return;
    setMarkiert(i);
    // Erst scrollen, wenn das Layout steht: useBreit meldet die Spalten einen Takt nach dem ersten Zeichnen.
    setTimeout(() => document.querySelector(`[data-kid="${auswahl}"]`)?.scrollIntoView({ block: 'center' }), 150);
  }, [modus, auswahl, treffer, mehr, kontakte.length]);

  const zusammen = async (behalten: string, weg: string) => {
    const r = await fetch('/api/crm/dubletten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ behalten, weg }) }).then(x => x.json()).catch(() => null);
    if (r?.ok) { await api.laden(); setAuswahl(behalten); } else api.setFehler(r?.fehler ?? 'Nicht zusammengeführt.');
  };

  const k = auswahl && !auswahl.startsWith('f-') ? kontakte.find(x => x.id === auswahl) ?? null : null;
  const kopf = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input ref={sucheRef} value={suche} onChange={e => setSuche(e.target.value)} placeholder={modus === 'personen' ? 'Suchen: Name, Firma, Branche, Ort …  ( / )' : 'Firma, Domain, Branche, Ort …'} aria-label="Suchen" style={{ ...feld, flex: 1, minWidth: 200, padding: '9px 13px', fontSize: TYP.bedien }} />
      {modus === 'personen' && zuRunde && <><Knopf leise onClick={() => zuRunde('kreis')}>Kreis-Runde</Knopf><Knopf leise onClick={() => zuRunde('chancen')}>Qualifizierungs-Runde</Knopf><Knopf leise onClick={() => zuRunde('vernetzen')}>Vernetzen-Runde</Knopf></>}
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
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <WerFilter wahl={wer} onWahl={w => { setWer(w); setMehr(80); }} ich={ich} zahlen={werZahlen} />
              <span style={{ fontSize: 12, color: C.inkLeise }}>nach „Hält die Beziehung“ · ohne Eintrag bei {nameVon('kevin')} (Sales-Verantwortung)</span>
            </div>
            <div style={{ marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={ANSICHTEN} aktiv={ansicht} onWahl={a => { setAnsicht(a); setMehr(80); }} /></div>
            {sammel.length > 0 && ansicht !== 'dubletten' && (
              <div style={{ marginBottom: 10 }}>
                <Uebergeben api={api} art="kontakte" ids={sammel.map(x => x.id)} titel={`Diese ${sammel.length} übergeben`} klein />
              </div>
            )}
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
                    <span /><span /><span>Name</span><span>Firma</span><span>Phase</span><span>Kanal</span><span style={{ textAlign: 'right' }}>Zuletzt</span>
                  </div>
                )}
                <div>
                  {sichtbar.map((x, i) => (
                    <div key={x.id} data-kid={x.id}>
                      <KarteiZeile k={x} firma={x.firmaId ? firmen.get(x.firmaId)?.name : undefined} breit={breit} aktiv={auswahl === x.id} markiert={i === markiert && breit}
                        chance={mitChance.has(x.id)} mandat={mitMandat.has(x.id)} heute={heute} onClick={() => { setMarkiert(i); setAuswahl(auswahl === x.id ? null : x.id); }} />
                      {auswahl === x.id && !breit && <div style={{ padding: '8px 0 18px' }}><Karteikarte k={x} api={api} name={name} zuFirma={zuFirma} zuAkte={zuAkte} /></div>}
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
              {k ? <Karteikarte k={k} api={api} name={name} zuFirma={zuFirma} zuAkte={zuAkte} /> : <Leer>Eine Person anklicken oder mit j/k wählen und Enter — Verlauf, Notiz, Kanäle, Stammdaten und Recht erscheinen hier. „Akte öffnen“ zeigt alles auf einer Seite.</Leer>}
            </Karte>
          </Spalte>
        )}
      </Spalten>
    </>
  );
}

const KARTEI_SPALTEN = '10px 22px minmax(0,1.6fr) minmax(0,1.2fr) 96px 64px 64px';

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
        <span style={{ opacity: k.besitzer ? 1 : 0.45, display: 'inline-flex' }}><Person id={haeltBeziehung(k)} groesse={18} /></span>
      </div>
    );
  }
  return (
    <div onClick={onClick} className="fassbar" title={[anzeigename(k), k.position, f].filter(Boolean).join(' · ')}
      style={{ display: 'grid', gridTemplateColumns: KARTEI_SPALTEN, gap: 12, alignItems: 'center', padding: '8px 8px', minHeight: 44, borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', fontSize: TYP.bedien,
        background: aktiv ? 'rgba(255,255,255,.07)' : markiert ? 'rgba(88,217,205,.07)' : 'transparent', borderRadius: aktiv || markiert ? 8 : 0 }}>
      <Punkt farbe={k.werbesperre ? LEUCHT.kritisch : phaseFarbe(k.lebensphase)} groesse={8} />
      <span title={`Hält die Beziehung: ${nameVon(haeltBeziehung(k))}${k.besitzer ? '' : ' (Sales-Verantwortung)'}`} style={{ opacity: k.besitzer ? 1 : 0.45, display: 'inline-flex' }}><Person id={haeltBeziehung(k)} groesse={18} /></span>
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
  // linkedin/webseite/mobil kommen nur von der Visitenkarte (keine eigenen Eingabefelder) und werden mit gespeichert.
  const [e, setE] = useState({ vorname: '', nachname: '', email: '', telefon: '', position: '', firma: '', lebensphase: 'kontakt' as Lebensphase, herkunft: undefined as Herkunft | undefined, anrede: 'Sie' as 'Sie' | 'Du', linkedin: '', webseite: '', mobil: '', vonKarte: false });
  const firmen = api.crm?.stand.firmen ?? [];
  const dublette = e.email.includes('@') ? (api.kontakte ?? []).find(k => (k.email ?? '').toLowerCase() === e.email.trim().toLowerCase()) : undefined;
  // Ohne Titel verglichen: „Dr. Anna Weber“ von der Karte ist „Anna Weber“ in der Kartei.
  const namensgleich = e.nachname.trim() ? (api.kontakte ?? []).find(k => gleicherName(k, e)) : undefined;
  const firma = firmen.find(f => f.name.toLowerCase() === e.firma.trim().toLowerCase());
  const ok = e.nachname.trim() && !dublette;
  const anlegen = async () => {
    if (!ok) return;
    let firmaId = firma?.id;
    if (!firmaId && e.firma.trim()) { const f = { ...neueFirma(e.firma), ...(e.webseite ? { webseite: e.webseite } : {}) }; firmaId = f.id; await api.setze('firmen', f as unknown as { id: string } & Record<string, unknown>); }
    const id = `c-neu-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const herk = HERKUNFT.find(h => h.id === e.herkunft);
    await api.kontaktSetzen({
      id, vorname: e.vorname.trim(), nachname: e.nachname.trim(), ...(e.email.trim() ? { email: e.email.trim().toLowerCase() } : {}), ...(e.telefon.trim() ? { telefon: e.telefon.trim() } : {}),
      ...(e.position.trim() ? { position: e.position.trim() } : {}), ...(e.firma.trim() ? { firma: firma?.name ?? e.firma.trim(), firmaId } : {}),
      ...(e.mobil ? { sms: e.mobil } : {}), ...(e.linkedin ? { linkedin: e.linkedin } : {}), ...(e.webseite ? { firmaWebseite: e.webseite } : {}),
      eignung: '', prio: '', stufe: 'neu', lebensphase: e.lebensphase, anrede: e.anrede, ...(api.ich ? { besitzer: api.ich } : {}), ...(e.herkunft ? { herkunft: e.herkunft, ...(herk?.fremd ? { fremddaten: true } : {}) } : {}),
      quelle: e.vonKarte ? 'Visitenkarte' : 'Von Hand angelegt', aktivitaeten: [{ am: new Date().toISOString(), art: 'system', text: e.vonKarte ? 'Per Visitenkarte angelegt' : 'Von Hand angelegt', von: 'system' }], importiertAm: heute, geaendertAm: heute,
    });
    onFertig(id);
  };
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 14, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      {/* Visitenkarte fotografieren → Felder vorausgefüllt; die Karte kam von der Person selbst (keine Art.-14-Pflicht, aber keine Einwilligung). */}
      <VisitenkarteKnopf onErkannt={d => setE({ ...e, vorname: d.vorname ?? e.vorname, nachname: d.nachname ?? e.nachname, email: d.email ?? e.email, telefon: d.telefon ?? e.telefon, position: d.position ?? e.position, firma: d.firma ?? e.firma, linkedin: d.linkedin ?? e.linkedin, webseite: d.webseite ?? e.webseite, mobil: d.mobil ?? e.mobil, vonKarte: true, herkunft: e.herkunft ?? 'selbst' })} />
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
function Karteikarte({ k, api, name, zuFirma, zuAkte }: { k: Kontakt; api: CrmApi; name: (p: string) => string; zuFirma: (id: string) => void; zuAkte?: (id: string) => void }) {
  const crm = api.crm;
  const heute = crm?.heute ?? new Date().toISOString().slice(0, 10);
  const [reiter, setReiter] = useState<Reiter>('ueberblick');
  const firma = k.firmaId ? crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const chancen = (crm?.stand.chancen ?? []).filter(c => c.kontaktIds.includes(k.id));
  const mandate = (crm?.stand.mandate ?? []).filter(m => m.kontaktIds.includes(k.id));
  const ctx = { hatMandat: mandate.some(m => m.status === 'aktiv'), hatChance: chancen.some(c => OFFENE_STUFEN.includes(c.stufe)) };
  const ampel = kanalAmpel(k, ctx);
  const setze = (teil: Partial<Kontakt>) => api.kontaktSetzen({ ...k, ...teil });
  const mailOk = ampel.some(s => s.kanal === 'mail' && s.farbe !== 'rot');

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-.015em' }}>{anzeigename(k)}</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>
            {k.position ?? k.jobtitel ?? ''}{(k.position ?? k.jobtitel) && (firma || k.firma) ? ' · ' : ''}
            {firma ? <button onClick={() => zuFirma(firma.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.2)', fontSize: TYP.bedien }}>{firma.name}</button> : k.firma}
          </div>
        </div>
        {/* Kevin 25.09.: „rechts in dem Feld oben“ — die ganze Akte auf einer Seite, mit Zurück in die Kartei. */}
        {zuAkte && <button onClick={() => zuAkte(k.id)} className="fassbar" title="Alle Stammdaten, der ganze Verlauf und jede Verbindung auf einer Seite"
          style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 11, cursor: 'pointer', border: `1px solid ${LEUCHT.business}55`, background: `${LEUCHT.business}14`, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, whiteSpace: 'nowrap' }}>
          Akte öffnen <span aria-hidden style={{ color: LEUCHT.business }}>⤢</span>
        </button>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: -6, flexWrap: 'wrap' }}>
        <Chip farbe={phaseFarbe(k.lebensphase)}>{phaseLabel(k.lebensphase)}</Chip>{rollenVon(k).map(r => <Chip key={r} farbe={LEUCHT.business}>{ROLLE_LABEL[r]}</Chip>)}{k.kreis && <Chip farbe={LEUCHT.beziehung}>Kreis {k.kreis}</Chip>}
        <Chip farbe={C.inkDim}>{STUFE_LABEL[k.stufe]}</Chip>{k.prio && <Chip farbe={C.inkDim}>Prio {k.prio}</Chip>}
        <AuchHier passt={p => p.includes(`k=${k.id}`)} was="bei dieser Person" />
      </div>
      <Hinweise k={k} heute={heute} setze={setze} />
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen liste={[{ id: 'ueberblick', label: 'Überblick' }, { id: 'verlauf', label: `Verlauf ${(k.aktivitaeten ?? []).length}` }, { id: 'stamm', label: 'Stammdaten' }, { id: 'recht', label: 'Recht' }]} aktiv={reiter} onWahl={setReiter} farbe={LEUCHT.business} einzeilig /></div>

      {reiter === 'ueberblick' && (
        <>
          {crm?.termine?.[k.id] && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${LEUCHT.puls}14`, fontSize: TYP.bedien, color: C.ink }}>Nächster Termin: <b style={{ fontWeight: 600 }}>{crm.termine[k.id].titel}</b> · {datum(crm.termine[k.id].start.slice(0, 10), heute)} {crm.termine[k.id].start.slice(11, 16)}</div>}
          <div><Ueberschrift>Kanäle</Ueberschrift><KanalAmpel ampel={ampel} ziele={{ telefon: k.telefon ?? k.sms, email: k.email, linkedin: k.linkedin }} /><Grund ampel={ampel} /></div>
          <NaechsterSchrittTeil k={k} heute={heute} setze={setze} />
          <LinkedInTeil k={k} api={api} />
          <LeadBlock api={api} leadId={k.firmaId ?? k.id} />
          <BeziehungTeil k={k} api={api} setze={setze} />
          <DealsTeil k={k} api={api} />
          {(k.aufhaenger || k.signale || k.marktinfo) && (
            <div>
              <Ueberschrift>Einordnung</Ueberschrift>
              {k.aufhaenger && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginBottom: 6 }}><span style={{ color: C.inkLeise }}>Aufhänger:</span> {k.aufhaenger}</div>}
              {k.signale && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginBottom: 6 }}><span style={{ color: C.inkLeise }}>Signale:</span> {k.signale}</div>}
              {k.marktinfo && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}><span style={{ color: C.inkLeise }}>Markt:</span> {k.marktinfo}</div>}
            </div>
          )}
          <EntwurfTeil k={k} mailOk={mailOk} />
        </>
      )}

      {reiter === 'verlauf' && <VerlaufTeil k={k} api={api} name={name} heute={heute} />}
      {reiter === 'stamm' && <Matrix k={k} api={api} setze={setze} zuFirma={zuFirma} />}
      {reiter === 'recht' && <RechtTeil k={k} api={api} heute={heute} setze={setze} />}
    </div>
  );
}
