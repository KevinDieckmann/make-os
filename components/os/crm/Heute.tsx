'use client';

// ─── Markttraktion · Sales › Heute — wer ist dran? (Power Hour) ───────────────────
// Die Liste baut der Code (lib/crm/heute.ts): Versprechen → Signale →
// Chancen → Kunden → Pflege → Neu. Mit „Power Hour starten“ läuft eine
// Stunde im Fokus: Karte für Karte, weicher 4-Minuten-Takt je Karte,
// Ergebnis-Knopf setzt per Regel den nächsten Schritt, nach einem echten
// Gespräch sind Notiz und nächster Schritt Pflicht. Am Ende das Protokoll.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Leer, LEUCHT } from '../schlank';
import type { Ergebnis, Aktivitaet } from '@/lib/make-one/crm';
import type { KanalStatus } from '@/lib/crm/recht';
import { type CrmApi, neueId, datum } from './daten';
import { KanalAmpel, Grund, NotizFormular, Verlauf } from './teile';
import { HeadPanel } from './HeadPanel';

interface HeuteKarte {
  id: string; name: string; firma?: string; position?: string; kategorie: string; punkte: number; gruende: string[];
  kanal: KanalStatus | null; ampel: KanalStatus[]; telefon?: string; email?: string; linkedin?: string; aufhaenger?: string;
  kreis?: string; stufe: string; anrede?: string; naechsterSchritt?: { text: string; datum: string }; letzterKontakt?: string;
  letzte: Aktivitaet[]; chance?: { id: string; titel: string; stufe: string }; bezug?: string;
}
interface HeuteAntwort { heute: string; person: string; kategorien: { id: string; label: string; warum: string }[]; karten: HeuteKarte[]; ausgefiltert: { sperre: number; ohneKanal: number; kuerzlich: number }; sitzungen: { id: string; datum: string; karten: { ergebnis?: string }[] }[] }

const KAT_FARBE: Record<string, string> = { versprechen: LEUCHT.kritisch, signale: LEUCHT.achtung, chancen: LEUCHT.business, kunden: LEUCHT.geld, pflege: LEUCHT.beziehung, neu: LEUCHT.puls };
const ERGEBNIS_KNOEPFE: { id: Ergebnis; label: string; notiz: boolean }[] = [
  { id: 'gespraech', label: 'Gespräch', notiz: true }, { id: 'termin', label: 'Termin', notiz: true }, { id: 'rueckruf', label: 'Rückruf', notiz: true },
  { id: 'mailbox', label: 'Mailbox', notiz: false }, { id: 'nicht_erreicht', label: 'Nicht erreicht', notiz: false }, { id: 'kein_bedarf', label: 'Kein Bedarf', notiz: false }, { id: 'sperre', label: 'Sperre', notiz: false },
];

function Uhr({ bis }: { bis: number }) {
  const [jetzt, setJetzt] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setJetzt(Date.now()), 1000); return () => clearInterval(t); }, []);
  const rest = Math.max(0, Math.round((bis - jetzt) / 1000));
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}</span>;
}

export function Heute({ api, name, zuKontakt }: { api: CrmApi; name: (p: string) => string; zuKontakt: (id: string) => void }) {
  const [d, setD] = useState<HeuteAntwort | null>(null);
  const [fokus, setFokus] = useState<{ id: string; start: string; bis: number; ziel: { gespraeche: number; termine: number }; index: number; ergebnisse: Record<string, string>; kartenStart: number } | null>(null);
  const [ende, setEnde] = useState(false);
  const [gelernt, setGelernt] = useState('');
  const [offen, setOffen] = useState<{ id: string; ergebnis: Ergebnis } | null>(null);
  const [meldung, setMeldung] = useState('');

  const laden = useCallback(() => fetch('/api/crm/heute?n=12', { cache: 'no-store' }).then(r => r.json()).then(setD).catch(() => {}), []);
  useEffect(() => { void laden(); }, [laden]);

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

  async function erfassen(k: HeuteKarte, ergebnis: Ergebnis, extra: Record<string, unknown> = {}) {
    if (ergebnis === 'sperre' && !window.confirm(`${k.name} widerspricht Werbung? Die Person wird gesperrt und taucht nirgends mehr auf.`)) return;
    const art = ergebnis === 'gespraech' || ergebnis === 'termin' ? (k.kanal?.kanal === 'telefon' || !k.kanal ? 'anruf' : 'gespraech') : 'anruf';
    const r = await api.aktivitaet({ id: k.id, art: ergebnis === 'termin' ? 'termin' : art, ergebnis, bezug: k.chance?.id ?? k.bezug, ...extra });
    setMeldung(r.hinweis ?? (r.error ? r.error : ''));
    setOffen(null);
    if (fokus) setFokus({ ...fokus, ergebnisse: { ...fokus.ergebnisse, [k.id]: ergebnis }, index: fokus.index + 1, kartenStart: Date.now() });
    else void laden();
  }

  async function sitzungSpeichern() {
    if (!fokus) return;
    await api.setze('sitzungen', {
      id: fokus.id, person: d!.person, datum: d!.heute, start: fokus.start, ende: new Date().toISOString(), ziel: fokus.ziel,
      karten: d!.karten.map(k => ({ kontaktId: k.id, kategorie: k.kategorie, ...(fokus.ergebnisse[k.id] ? { ergebnis: fokus.ergebnisse[k.id] } : {}) })), ...(gelernt.trim() ? { gelernt: gelernt.trim() } : {}),
    });
    setFokus(null); setEnde(false); setGelernt(''); void laden();
  }

  const kopf = (
    <Karte i={0} akzent={fokus ? LEUCHT.gut : undefined}>
      <Ueberschrift farbe={fokus ? LEUCHT.gut : LEUCHT.business} rechts={fokus ? <span style={{ fontSize: 22, fontWeight: 700, color: C.ink }}><Uhr bis={fokus.bis} /></span> : `${d.karten.length} Karten${serie ? ` · Serie ${serie}` : ''}`}>
        {fokus ? 'Power Hour läuft' : 'Wer heute dran ist'}
      </Ueberschrift>
      {!fokus ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {d.kategorien.map(k => { const n = d.karten.filter(x => x.kategorie === k.id).length; return n ? <Chip key={k.id} farbe={KAT_FARBE[k.id]}>{k.label} · {n}</Chip> : null; })}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Knopf farbe={LEUCHT.gut} aus={!d.karten.length} onClick={() => setFokus({ id: neueId('ph'), start: new Date().toISOString(), bis: Date.now() + 60 * 60_000, ziel: { gespraeche: 4, termine: 1 }, index: 0, ergebnisse: {}, kartenStart: Date.now() })}>Power Hour starten</Knopf>
            <span style={{ fontSize: 12.5, color: C.inkLeise }}>Eine Stunde, Karte für Karte. Ziel: 4 Gespräche, 1 Termin.</span>
          </div>
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
      {!fokus && <HeadPanel head="sales" standardModus="power_hour" zuKontakt={zuKontakt} i={1} nachEntscheid={() => { void laden(); void api.laden(); }} />}
      {!karten.length && <Karte i={1}><Leer>Heute ist niemand dran. Neue Chancen anlegen, Kreise vergeben oder Einwilligungen klären — dann füllt sich die Liste.</Leer></Karte>}
      {karten.map((k, i) => {
        const f = KAT_FARBE[k.kategorie] ?? C.inkDim;
        const notizOffen = offen?.id === k.id;
        return (
          <Karte key={k.id} i={i + 1} akzent={fokus ? f : undefined}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {ERGEBNIS_KNOEPFE.map(e => (
                <Knopf key={e.id} leise={!(notizOffen && offen?.ergebnis === e.id)} farbe={e.id === 'sperre' ? LEUCHT.kritisch : e.id === 'termin' || e.id === 'gespraech' ? LEUCHT.gut : undefined}
                  onClick={() => (e.notiz ? setOffen({ id: k.id, ergebnis: e.id }) : void erfassen(k, e.id))}>{e.label}</Knopf>
              ))}
            </div>
            {notizOffen && offen && (
              <div style={{ marginTop: 12 }}>
                <NotizFormular heute={d.heute} ergebnis={offen.ergebnis} knopf="Festhalten" onAbbruch={() => setOffen(null)}
                  onFertig={x => void erfassen(k, offen.ergebnis, { notiz: x.notiz, naechster: x.naechster })} />
              </div>
            )}
          </Karte>
        );
      })}
    </>
  );
}
