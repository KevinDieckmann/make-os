'use client';

// ─── Markttraktion · Sales › Heute — wer ist dran? (Power Hour) ───────────────────
// Die Liste baut der Code (lib/crm/heute.ts): Versprechen → Signale →
// Chancen → Kunden → Pflege → Neu. Mit „Power Hour starten“ läuft eine
// Stunde im Fokus: Karte für Karte, weicher 4-Minuten-Takt je Karte,
// Ergebnis-Knopf setzt per Regel den nächsten Schritt, nach einem echten
// Gespräch sind Notiz und nächster Schritt Pflicht. Am Ende das Protokoll.
// Zu zweit (25.09.): Jede/r hat die eigene Liste („Deine Power Hour“) — die
// Karten der anderen Person tauchen nicht auf, nur ihre Zahl; ansehen lässt
// sich die andere Liste trotzdem (nur lesen — beide sehen alles). Wer Sales
// verantwortet, sieht die Team-Zeile. Jede Karte zeigt, wem sie gehört, und
// lässt sich übergeben.
// Erfassen ohne Reibung (25.09.): In der Kartei standen bei 453 Personen zwei
// echte Aktivitäten — die Gespräche fanden statt, kamen aber nie hier an. Jetzt
// hat jede Karte einen großen „Anrufen“-Knopf (tel:, nur wenn die Ampel
// Telefon erlaubt; am Handy der Hauptweg), die Karte bleibt danach stehen und
// darunter die Ergebnis-Knöpfe. Oben steht „Nachbereiten“: Termine aus dem
// Geschäftskalender der letzten drei Tage, nach denen noch nichts festgehalten
// ist — ein Tipp: gut gelaufen, kein Bedarf, fand nicht statt. Fällt im
// Gespräch ein ausdrückliches Ja zur Mail, wird es als Einwilligung übernommen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Leer, LEUCHT } from '../schlank';
import type { Ergebnis, Aktivitaet } from '@/lib/make-one/crm';
import type { KanalStatus } from '@/lib/crm/recht';
import type { TeamTag } from '@/lib/crm/pipeline';
import { nameVon, anderer, BEIDE } from '@/lib/crm/team';
import { markttraktion } from '@/lib/crm/adresse';
import { kanalLink, nachbereitung, type Nachbereitung } from '@/lib/crm/erfassen';
import { type CrmApi, neueId, datum } from './daten';
import { KanalAmpel, Grund, NotizFormular, Verlauf, festhalten, hatMailEinwilligung, ERGEBNIS_KNOEPFE, type NotizErgebnis } from './teile';
import { Person, Uebergeben } from './team';
import { HeadPanel } from './HeadPanel';

interface HeuteKarte {
  id: string; name: string; firma?: string; position?: string; kategorie: string; punkte: number; gruende: string[];
  kanal: KanalStatus | null; ampel: KanalStatus[]; telefon?: string; email?: string; linkedin?: string; aufhaenger?: string;
  kreis?: string; stufe: string; anrede?: string; naechsterSchritt?: { text: string; datum: string }; letzterKontakt?: string;
  letzte: Aktivitaet[]; chance?: { id: string; titel: string; stufe: string }; bezug?: string;
  /** Wem die Karte gehört (kevin, malin, beide) und wer die Beziehung hält. */
  gehoert: string; beziehung: string; bezugArt?: 'mandat' | 'kampagne' | 'event';
}
interface HeuteAntwort {
  heute: string;
  /** Wessen Liste es ist — und wer fragt. Bei nurLesen ist es die Liste der anderen Person. */
  person: string; ich: string; nurLesen: boolean; verantwortlich: string;
  kategorien: { id: string; label: string; warum: string }[]; karten: HeuteKarte[];
  ausgefiltert: { sperre: number; ohneKanal: number; kuerzlich: number; beiAnderen: number };
  sitzungen: { id: string; datum: string; karten: { ergebnis?: string }[] }[];
  team: TeamTag[];
}

const KAT_FARBE: Record<string, string> = { versprechen: LEUCHT.kritisch, signale: LEUCHT.achtung, chancen: LEUCHT.business, kunden: LEUCHT.geld, pflege: LEUCHT.beziehung, neu: LEUCHT.puls };

function Uhr({ bis }: { bis: number }) {
  const [jetzt, setJetzt] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setJetzt(Date.now()), 1000); return () => clearInterval(t); }, []);
  const rest = Math.max(0, Math.round((bis - jetzt) / 1000));
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}</span>;
}

/** Team-Zeile: Power Hours und echte Gespräche je Person, heute · sieben Tage. */
function TeamZeile({ team }: { team: TeamTag[] }) {
  return (
    <div style={{ display: 'grid', gap: 6, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>Team · heute / 7 Tage</div>
      {team.map(t => (
        <div key={t.person} style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: C.inkDim }}>
          <span style={{ minWidth: 76 }}><Person id={t.person} name groesse={18} /></span>
          <span>Power Hours <b style={{ color: t.powerHours.heute ? LEUCHT.gut : C.ink }}>{t.powerHours.heute}</b> / {t.powerHours.woche}</span>
          <span>Gespräche <b style={{ color: t.gespraeche.heute ? LEUCHT.gut : C.ink }}>{t.gespraeche.heute}</b> / {t.gespraeche.woche}</span>
          {!t.powerHours.woche && <span style={{ color: C.inkLeise }}>noch keine Power Hour diese Woche</span>}
        </div>
      ))}
    </div>
  );
}

export function Heute({ api, name, zuKontakt }: { api: CrmApi; name: (p: string) => string; zuKontakt: (id: string) => void }) {
  const [d, setD] = useState<HeuteAntwort | null>(null);
  const [fokus, setFokus] = useState<{ id: string; start: string; bis: number; ziel: { gespraeche: number; termine: number }; index: number; ergebnisse: Record<string, string>; kartenStart: number } | null>(null);
  const [ende, setEnde] = useState(false);
  const [gelernt, setGelernt] = useState('');
  const [offen, setOffen] = useState<{ id: string; ergebnis: Ergebnis } | null>(null);
  const [meldung, setMeldung] = useState('');
  /** Karte, auf der gerade „Anrufen“ getippt wurde — sie bleibt stehen, das Ergebnis kommt danach. */
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  /** Die Liste der anderen Person ansehen (nur lesen) — null = die eigene. */
  const [fuer, setFuer] = useState<string | null>(null);
  const zug = useRef(0);

  const laden = useCallback(async () => {
    const nr = ++zug.current;
    try {
      const x = await fetch(`/api/crm/heute?n=12${fuer ? `&fuer=${encodeURIComponent(fuer)}` : ''}`, { cache: 'no-store' }).then(r => r.json());
      // Nur die jüngste Antwort zählt — sonst stünde nach dem Umschalten kurz die falsche Liste da.
      if (nr === zug.current && x.ok) setD(x);
    } catch { /* bleibt beim letzten Stand */ }
  }, [fuer]);
  // Neu laden, wenn sich der Bestand ändert (Übergabe, Abgleich alle 20 s, die andere Person arbeitet) — nie mitten in der Power Hour.
  const ruhig = !fokus;
  useEffect(() => { if (ruhig) void laden(); }, [laden, ruhig, api.crm, api.kontakte]);

  // „Wie lief's?“ — aus der Kartei auf der Seite, damit ein Tipp die Karte sofort verschwinden lässt.
  const nachbereiten = useMemo(() => (d ? nachbereitung(api.kontakte ?? [], d.heute, d.ich) : []), [api.kontakte, d]);

  const serie = useMemo(() => {
    const tage = new Set((d?.sitzungen ?? []).map(s => s.datum));
    let n = 0; const t = new Date(`${d?.heute ?? '2000-01-01'}T12:00:00Z`);
    if (!tage.has(d?.heute ?? '')) t.setUTCDate(t.getUTCDate() - 1);
    for (let i = 0; i < 60; i++) { const k = t.toISOString().slice(0, 10); const w = t.getUTCDay(); if (w !== 0 && w !== 6) { if (tage.has(k)) n++; else break; } t.setUTCDate(t.getUTCDate() - 1); }
    return n;
  }, [d]);

  if (!d) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const karten = fokus ? d.karten.filter((_, i) => i >= fokus.index).slice(0, 1) : d.karten;
  const gezaehlt = fokus ? Object.values(fokus.ergebnisse) : [];
  const zaehl = (x: string) => gezaehlt.filter(e => e === x).length;

  async function erfassen(k: HeuteKarte, ergebnis: Ergebnis, x?: NotizErgebnis) {
    if (ergebnis === 'sperre' && !window.confirm(`${k.name} widerspricht Werbung? Die Person wird gesperrt und taucht nirgends mehr auf.`)) return;
    const art = ergebnis === 'gespraech' || ergebnis === 'termin' ? (k.kanal?.kanal === 'telefon' || !k.kanal ? 'anruf' : 'gespraech') : 'anruf';
    const r = await festhalten(api, { id: k.id, art: ergebnis === 'termin' ? 'termin' : art, ergebnis, bezug: k.chance?.id ?? k.bezug, ...(x ? { notiz: x.notiz, naechster: x.naechster } : {}) }, x?.einwilligung, d!.heute);
    setMeldung([r.hinweis ?? (r.error ? r.error : ''), x?.einwilligung && r.kontakt ? 'Einwilligung für Mail festgehalten.' : ''].filter(Boolean).join(' '));
    setOffen(null); setGewaehlt(null);
    // Ohne Power Hour lädt die Liste über den geänderten Bestand neu.
    if (fokus) setFokus({ ...fokus, ergebnisse: { ...fokus.ergebnisse, [k.id]: ergebnis }, index: fokus.index + 1, kartenStart: Date.now() });
  }

  async function sitzungSpeichern() {
    if (!fokus) return;
    await api.setze('sitzungen', {
      id: fokus.id, person: d!.ich, datum: d!.heute, start: fokus.start, ende: new Date().toISOString(), ziel: fokus.ziel,
      karten: d!.karten.map(k => ({ kontaktId: k.id, kategorie: k.kategorie, ...(fokus.ergebnisse[k.id] ? { ergebnis: fokus.ergebnisse[k.id] } : {}) })), ...(gelernt.trim() ? { gelernt: gelernt.trim() } : {}),
    });
    setFokus(null); setEnde(false); setGelernt('');
  }

  const lesen = d.nurLesen;
  const andere = anderer(d.ich);
  const verantwortet = d.ich === d.verantwortlich;
  const kopf = (
    <Karte i={0} akzent={fokus ? LEUCHT.gut : lesen ? C.inkDim : undefined}>
      <Ueberschrift farbe={fokus ? LEUCHT.gut : LEUCHT.business} rechts={fokus ? <span style={{ fontSize: 22, fontWeight: 700, color: C.ink }}><Uhr bis={fokus.bis} /></span> : `${d.karten.length} Karten${serie ? ` · Serie ${serie}` : ''}`}>
        {fokus ? `Power Hour läuft · ${nameVon(d.ich)}` : lesen ? `${nameVon(d.person)}s Liste · nur lesen` : `Deine Power Hour · ${nameVon(d.ich)}`}
      </Ueberschrift>
      {!fokus ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {d.kategorien.map(k => { const n = d.karten.filter(x => x.kategorie === k.id).length; return n ? <Chip key={k.id} farbe={KAT_FARBE[k.id]}>{k.label} · {n}</Chip> : null; })}
          </div>
          {lesen ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Knopf onClick={() => setFuer(null)}>Zurück zu deiner Power Hour</Knopf>
              <span style={{ fontSize: 12.5, color: C.inkLeise }}>So sieht {nameVon(d.person)} die Liste heute. Festhalten kann nur {nameVon(d.person)} selbst — Karten verteilst du über „Übergeben“ oder in der Kartei.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Knopf farbe={LEUCHT.gut} aus={!d.karten.length} onClick={() => setFokus({ id: neueId('ph'), start: new Date().toISOString(), bis: Date.now() + 60 * 60_000, ziel: { gespraeche: 4, termine: 1 }, index: 0, ergebnisse: {}, kartenStart: Date.now() })}>Power Hour starten</Knopf>
              <span style={{ fontSize: 12.5, color: C.inkLeise }}>{d.karten.length ? 'Eine Stunde, Karte für Karte. Ziel: 4 Gespräche, 1 Termin.' : 'Heute liegt keine Karte bei dir.'}</span>
            </div>
          )}
          {!lesen && d.ausgefiltert.beiAnderen > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: C.inkDim }}>
              <Person id={andere} groesse={18} />
              <span>{d.ausgefiltert.beiAnderen} {d.ausgefiltert.beiAnderen === 1 ? 'Karte liegt' : 'Karten liegen'} bei {nameVon(andere)} — die ruft niemand doppelt an.</span>
              {andere !== d.ich && <button onClick={() => setFuer(andere)} style={{ background: 'none', border: 'none', color: LEUCHT.business, cursor: 'pointer', fontSize: 12.5, padding: 0 }}>{nameVon(andere)}s Liste ansehen →</button>}
            </div>
          )}
          {verantwortet && d.team.length > 1 && <TeamZeile team={d.team} />}
          {(d.ausgefiltert.ohneKanal > 0 || d.ausgefiltert.sperre > 0) && (
            <div style={{ fontSize: 12.5, color: C.inkLeise }}>Nicht auf der Liste: {d.ausgefiltert.ohneKanal} ohne zulässigen Kanal{d.ausgefiltert.sperre ? ` · ${d.ausgefiltert.sperre} mit Werbesperre` : ''}{d.ausgefiltert.kuerzlich ? ` · ${d.ausgefiltert.kuerzlich} kürzlich gesprochen` : ''}. Grundlage klären in der Kartei.</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontSize: TYP.bedien }}>
          <span>Karte <b>{Math.min(fokus.index + 1, d.karten.length)}</b> von {d.karten.length}</span>
          <span style={{ color: zaehl('gespraech') + zaehl('termin') >= fokus.ziel.gespraeche ? LEUCHT.gut : C.ink }}>Gespräche <b>{zaehl('gespraech') + zaehl('termin')}</b>/{fokus.ziel.gespraeche}</span>
          <span style={{ color: zaehl('termin') >= fokus.ziel.termine ? LEUCHT.gut : C.ink }}>Termine <b>{zaehl('termin')}</b>/{fokus.ziel.termine}</span>
          <span>Versuche <b>{gezaehlt.length}</b></span>
          {fokus.index < d.karten.length && <span style={{ color: C.inkLeise }}>diese Karte: <Uhr bis={fokus.kartenStart + 4 * 60_000} /></span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {fokus.index < d.karten.length && <Knopf leise onClick={() => setFokus({ ...fokus, index: fokus.index + 1, kartenStart: Date.now() })}>Überspringen</Knopf>}
            <Knopf leise onClick={() => setEnde(true)}>Beenden</Knopf>
          </span>
        </div>
      )}
      {meldung && <div style={{ marginTop: 10, fontSize: 12.5, color: C.inkDim }}>{meldung}</div>}
    </Karte>
  );

  if (fokus && (ende || fokus.index >= d.karten.length)) {
    return (
      <>
        {kopf}
        <Karte i={1} akzent={LEUCHT.gut}>
          <Ueberschrift farbe={LEUCHT.gut}>Protokoll</Ueberschrift>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: TYP.body, marginBottom: 14 }}>
            <span>Versuche <b>{gezaehlt.length}</b></span><span>Gespräche <b>{zaehl('gespraech') + zaehl('termin')}</b></span><span>Termine <b>{zaehl('termin')}</b></span><span>Rückrufe <b>{zaehl('rueckruf')}</b></span>
          </div>
          <textarea rows={2} value={gelernt} onChange={e => setGelernt(e.target.value)} placeholder="Ein Satz: Was habe ich gelernt?" aria-label="Was habe ich gelernt" style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '11px 14px', color: C.ink, fontSize: TYP.body }} />
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}><Knopf farbe={LEUCHT.gut} onClick={sitzungSpeichern}>Power Hour abschließen</Knopf><Knopf leise onClick={() => setEnde(false)}>Zurück</Knopf></div>
        </Karte>
      </>
    );
  }

  return (
    <>
      {kopf}
      {!fokus && !lesen && <Nachbereiten liste={nachbereiten} api={api} heute={d.heute} zuKontakt={zuKontakt} />}
      {!fokus && !lesen && <HeadPanel head="sales" standardModus="power_hour" zuKontakt={zuKontakt} i={1} nachEntscheid={() => { void laden(); void api.laden(); }} />}
      {!karten.length && (
        <Karte i={1}>
          <Leer>{leerText(d)}</Leer>
          <Link href={markttraktion('kontakte')} style={{ fontSize: TYP.bedien, color: LEUCHT.business, textDecoration: 'none' }}>{lesen ? 'Kontakte verteilen →' : 'Zur Kartei →'}</Link>
        </Karte>
      )}
      {karten.map((k, i) => {
        const f = KAT_FARBE[k.kategorie] ?? C.inkDim;
        const notizOffen = offen?.id === k.id;
        const tel = k.ampel.find(s => s.kanal === 'telefon');
        const anruf = tel ? kanalLink(tel, { telefon: k.telefon }) : null;
        const kk = api.kontakte?.find(x => x.id === k.id);
        return (
          <Karte key={k.id} i={i + 1} akzent={fokus ? f : undefined}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span title={k.gehoert === BEIDE ? 'gehört euch beiden' : `gehört ${nameVon(k.gehoert)}`} style={{ display: 'inline-flex' }}><Person id={k.gehoert} groesse={20} /></span>
                  <Chip farbe={f}>{d.kategorien.find(c => c.id === k.kategorie)?.label}</Chip>
                  {k.kreis && <Chip farbe={C.inkDim}>Kreis {k.kreis}</Chip>}
                  {k.anrede && <Chip farbe={C.inkDim}>{k.anrede}</Chip>}
                </div>
                <div style={{ fontSize: fokus ? 24 : 18, fontWeight: 700, marginTop: 8, letterSpacing: '-.01em' }}>{k.name}</div>
                <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{[k.position, k.firma].filter(Boolean).join(' · ')}</div>
              </div>
              <KanalAmpel ampel={k.ampel} ziele={{ telefon: k.telefon, email: k.email, linkedin: k.linkedin }} />
            </div>
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, display: 'grid', gap: 3 }}>
              {k.gruende.map((g, j) => <li key={j} style={{ fontSize: TYP.bedien, color: j === 0 ? C.ink : C.inkDim }}>{g}</li>)}
            </ul>
            {k.aufhaenger && <div style={{ marginTop: 10, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}><span style={{ color: C.inkLeise }}>Aufhänger:</span> {k.aufhaenger}</div>}
            {k.naechsterSchritt && <div style={{ marginTop: 6, fontSize: TYP.bedien, color: C.inkDim }}><span style={{ color: C.inkLeise }}>Zugesagt:</span> {k.naechsterSchritt.text} · {datum(k.naechsterSchritt.datum, d.heute)}</div>}
            <Grund ampel={k.ampel} />
            {k.letzte.length > 0 && <div style={{ marginTop: 10 }}><Verlauf liste={[...k.letzte].reverse()} name={name} max={3} heute={d.heute} /></div>}
            {!lesen && anruf && tel && (
              <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
                <a href={anruf} onClick={() => setGewaehlt(k.id)} className="fassbar" title={tel.grund}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, width: '100%', maxWidth: 460, borderRadius: 14, textDecoration: 'none', fontWeight: 800, fontSize: 17, letterSpacing: '-.005em',
                    background: LEUCHT.gut, color: C.grund, boxShadow: `0 8px 22px -8px ${LEUCHT.gut}aa` }}>
                  Anrufen<span style={{ fontWeight: 600, fontSize: 14, opacity: .75, fontVariantNumeric: 'tabular-nums' }}>{k.telefon}</span>
                </a>
                {tel.farbe === 'gelb' && <span style={{ fontSize: 12, color: C.inkLeise }}>Nur mit konkretem Anlass aus der Beziehung — {tel.grund}.</span>}
                {gewaehlt === k.id && !notizOffen && <span style={{ fontSize: 12.5, color: LEUCHT.gut }}>Wie lief’s? Ergebnis tippen — dann ist es festgehalten.</span>}
              </div>
            )}
            {!lesen && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
                {ERGEBNIS_KNOEPFE.map(e => (
                  <Knopf key={e.id} leise={!(notizOffen && offen?.ergebnis === e.id)} farbe={e.id === 'sperre' ? LEUCHT.kritisch : e.id === 'termin' || e.id === 'gespraech' ? LEUCHT.gut : undefined}
                    onClick={() => (e.notiz ? setOffen({ id: k.id, ergebnis: e.id }) : void erfassen(k, e.id))}>{e.label}</Knopf>
                ))}
                <span style={{ marginLeft: 'auto' }}><KarteUebergeben k={k} api={api} /></span>
              </div>
            )}
            {lesen && <div style={{ marginTop: 12 }}><Knopf leise onClick={() => zuKontakt(k.id)}>Zur Person</Knopf></div>}
            {notizOffen && offen && (
              <div style={{ marginTop: 12 }}>
                <NotizFormular heute={d.heute} ergebnis={offen.ergebnis} knopf="Festhalten" onAbbruch={() => setOffen(null)} einwilligung={!hatMailEinwilligung(kk)} anrede={kk?.anrede ?? k.anrede as 'Sie' | 'Du' | undefined}
                  onFertig={x => void erfassen(k, offen.ergebnis, x)} />
              </div>
            )}
          </Karte>
        );
      })}
    </>
  );
}

/**
 * „Wie lief's?“ — Termine aus dem Geschäftskalender der letzten drei Tage, nach
 * denen noch nichts festgehalten ist (lib/crm/erfassen.ts nachbereitung). Drei
 * Tipps: „Gut gelaufen“ öffnet die Notizvorlage (Gespräch, nächster Schritt
 * Pflicht), „Kein Bedarf“ lässt die Person ruhen, „Fand nicht statt“ notiert
 * genau das. Alles hängt am Termin (bezug) — danach verschwindet er hier.
 */
function Nachbereiten({ liste, api, heute, zuKontakt }: { liste: Nachbereitung[]; api: CrmApi; heute: string; zuKontakt: (id: string) => void }) {
  const [offen, setOffen] = useState<string | null>(null);
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState<string | null>(null);
  async function tipp(n: Nachbereitung, body: Record<string, unknown>, x?: NotizErgebnis) {
    setLaeuft(n.kontaktId);
    try {
      const r = await festhalten(api, { id: n.kontaktId, bezug: n.bezug, art: 'gespraech', ...body }, x?.einwilligung, heute);
      setMeldung(r.error ? r.error : `${n.name}: ${r.hinweis ?? 'festgehalten.'}${x?.einwilligung ? ' Einwilligung für Mail festgehalten.' : ''}`);
      setOffen(null);
    } finally { setLaeuft(null); }
  }
  // Nichts offen: keine Karte — außer der Bestätigung für den letzten Tipp.
  if (!liste.length && !meldung) return null;
  return (
    <Karte i={1} akzent={LEUCHT.puls}>
      <Ueberschrift farbe={LEUCHT.puls} rechts={`${liste.length} ${liste.length === 1 ? 'Termin' : 'Termine'}`}>Nachbereiten · wie lief’s?</Ueberschrift>
      {!liste.length && <Leer>Alle Termine nachbereitet.</Leer>}
      <div style={{ display: 'grid', gap: 12 }}>
        {liste.map(n => {
          const kk = api.kontakte?.find(x => x.id === n.kontaktId);
          const uhr = /T\d{2}:\d{2}/.test(n.am) ? ` · ${n.am.slice(11, 16)}` : '';
          return (
            <div key={n.kontaktId} style={{ display: 'grid', gap: 8, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span title={n.fuer === BEIDE ? 'bei euch beiden' : `bei ${nameVon(n.fuer)}`} style={{ display: 'inline-flex' }}><Person id={n.fuer} groesse={20} /></span>
                <button onClick={() => zuKontakt(n.kontaktId)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.ink, fontSize: TYP.body, fontWeight: 700, textAlign: 'left' }}>{n.name}</button>
                {n.firma && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{n.firma}</span>}
              </div>
              <div style={{ fontSize: TYP.bedien, color: C.inkDim }}><span style={{ color: C.inkLeise }}>{datum(n.tag, heute)}{uhr}:</span> {n.titel}</div>
              {offen !== n.kontaktId ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Knopf farbe={LEUCHT.gut} aus={laeuft === n.kontaktId} onClick={() => setOffen(n.kontaktId)}>Gut gelaufen</Knopf>
                  <Knopf leise aus={laeuft === n.kontaktId} onClick={() => void tipp(n, { ergebnis: 'kein_bedarf' })}>Kein Bedarf</Knopf>
                  <Knopf leise aus={laeuft === n.kontaktId} onClick={() => void tipp(n, { art: 'notiz', text: 'Termin fand nicht statt' })}>Fand nicht statt</Knopf>
                </div>
              ) : (
                <NotizFormular heute={heute} ergebnis="gespraech" knopf="Festhalten" onAbbruch={() => setOffen(null)} einwilligung={!hatMailEinwilligung(kk)} anrede={kk?.anrede}
                  onFertig={x => void tipp(n, { ergebnis: 'gespraech', notiz: x.notiz, naechster: x.naechster }, x)} />
              )}
            </div>
          );
        })}
      </div>
      {meldung && <div style={{ marginTop: 10, fontSize: 12.5, color: C.inkDim }}>{meldung}</div>}
    </Karte>
  );
}

/**
 * Übergeben an der Karte — so, dass die Karte auch wirklich wandert: Hängt sie
 * an einer Chance oder einem Mandat, wechselt deren Zuständigkeit; sonst die
 * Beziehung („Hält die Beziehung“). Mit Notiz und Frist wird die Übergabe
 * beim Kontakt zum nächsten Schritt in der Power Hour der anderen Person.
 */
function KarteUebergeben({ k, api }: { k: HeuteKarte; api: CrmApi }) {
  if (k.chance) return <Uebergeben api={api} art="chance" id={k.chance.id} jetzt={k.gehoert} titel="Chance übergeben" klein />;
  if (k.bezugArt === 'mandat' && k.bezug) return <Uebergeben api={api} art="mandat" id={k.bezug} jetzt={k.gehoert} titel="Mandat übergeben" klein />;
  return <Uebergeben api={api} art="kontakt" id={k.id} jetzt={k.beziehung} klein />;
}

/** Leere Liste — sagt, woran es liegt und was als Nächstes zu tun ist. */
function leerText(d: HeuteAntwort): string {
  const v = nameVon(d.verantwortlich);
  if (d.nurLesen) return `Bei ${nameVon(d.person)} liegt heute nichts. Kontakte verteilen: in Markttraktion › Kontakte eingrenzen (Suche oder Ansicht), dann „Diese … übergeben“ — oder einzeln an der Person „Übergeben“.`;
  if (d.ich !== d.verantwortlich) return `Deine Liste ist heute leer. Sales verantwortet ${v}: ${v} verteilt Kontakte an dich (Markttraktion › Kontakte eingrenzen, dann „Diese … übergeben“) oder übergibt einzelne Personen, Deals und Mandate — die tauchen dann hier auf. Eigene Kontakte trägst du in der Kartei unter „Hält die Beziehung“ auf dich ein.`;
  return 'Heute ist niemand dran. Leads qualifizieren, Kreise vergeben oder Einwilligungen klären — dann füllt sich die Liste.';
}
