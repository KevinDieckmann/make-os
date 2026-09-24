'use client';

// ─── CRM · Marketing › Redaktionsplan — Themen aus Kundengesprächen ────────
// Beiträge wandern Idee → Entwurf → Geplant → Veröffentlicht. Themen kommen
// aus der „Stimme der Kunden“ (Bedarf/Schmerz aus den Gesprächsnotizen) —
// ein Klick macht daraus eine Idee, die Person bleibt als Quelle verknüpft,
// ihr Name steht nie im Text. Wirkung wird je Person erfasst: Reaktion,
// Gespräch, Anfrage. Gespräch und Anfrage landen zusätzlich im Verlauf der
// Person (Bezug = Beitrag) — so steht die Zuordnung auch in der Kartei.
// MAKE OS veröffentlicht nichts: Text kopieren, selbst posten, hier eintragen.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Raster, feld, LEUCHT } from '../../schlank';
import { anzeigename } from '@/lib/make-one/crm';
import type { Beitrag, MarketingEinstellung } from '@/lib/crm/typen';
import {
  BEITRAG_STATUS, BEITRAG_KANAELE, WIRKUNG_ARTEN, planFenster, imFenster, nachStatus, wirkungZahlen, stimmenAus, ideeAusStimme, schonUebernommen, einstellungAus,
  type PlanSicht,
} from '@/lib/crm/marketing';
import { type CrmApi, neueId, datum } from '../daten';
import { Pillen, Feld, Feldzeile } from '../teile';
import { PersonWahl, Textfeld, kopieren } from './gemeinsam';

const STATUS_FARBE: Record<Beitrag['status'], string> = { idee: C.inkDim, entwurf: LEUCHT.puls, geplant: LEUCHT.achtung, veroeffentlicht: LEUCHT.gut };
const SICHTEN: { id: PlanSicht; label: string }[] = [{ id: 'woche', label: 'Woche' }, { id: 'monat', label: 'Monat' }, { id: 'alle', label: 'Alle' }];
const kanalLabel = (k: string) => BEITRAG_KANAELE.find(x => x.id === k)?.label ?? k;
const alsEintrag = (b: Beitrag) => b as unknown as { id: string } & Record<string, unknown>;

export function Redaktionsplan({ api, zuKontakt }: { api: CrmApi; zuKontakt: (id: string) => void }) {
  const [sicht, setSicht] = useState<PlanSicht>('monat');
  const [versatz, setVersatz] = useState(0);
  const [offen, setOffen] = useState<string | null>(null);
  const [titel, setTitel] = useState('');
  const [meldung, setMeldung] = useState('');
  const [alleStimmen, setAlleStimmen] = useState(false);
  const crm = api.crm;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const heute = crm?.heute ?? new Date().toISOString().slice(0, 10);
  const beitraege = useMemo(() => crm?.stand.beitraege ?? [], [crm]);
  const einstellung = useMemo(() => einstellungAus(crm?.stand ?? {}), [crm]);
  const fenster = useMemo(() => planFenster(heute, sicht, versatz), [heute, sicht, versatz]);
  const gruppen = useMemo(() => nachStatus(beitraege.filter(b => imFenster(b, fenster))), [beitraege, fenster]);
  const stimmen = useMemo(() => stimmenAus(kontakte, 30), [kontakte]);
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;

  const anlegen = async () => {
    const t = titel.trim();
    if (!t) return;
    const b: Beitrag = { id: neueId('bt'), titel: t.slice(0, 200), kanal: 'linkedin', status: 'idee', wirkung: [], quellen: [], geaendert: new Date().toISOString() };
    await api.setze('beitraege', alsEintrag(b));
    setTitel(''); setOffen(b.id);
  };
  const aktuell = offen ? beitraege.find(b => b.id === offen) ?? null : null;
  const siebenTage = beitraege.filter(b => b.status === 'veroeffentlicht' && b.datum && b.datum <= heute && b.datum >= new Date(Date.parse(`${heute}T12:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10)).length;

  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<span style={{ color: siebenTage >= 2 ? LEUCHT.gut : siebenTage === 1 ? LEUCHT.achtung : C.inkLeise }}>{siebenTage} veröffentlicht in 7 Tagen · Ziel ≥ 2</span>}>Redaktionsplan</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={titel} maxLength={200} onChange={e => setTitel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void anlegen(); }} placeholder="Neue Idee: Titel eingeben, Enter" aria-label="Titel des Beitrags" style={{ ...feld, flex: 1, minWidth: 220, fontSize: TYP.bedien, padding: '9px 13px' }} />
          <Knopf aus={!titel.trim()} onClick={() => void anlegen()}>+ Beitrag</Knopf>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <Pillen liste={SICHTEN} aktiv={sicht} onWahl={s => { setSicht(s); setVersatz(0); }} />
          {fenster && (
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Knopf leise onClick={() => setVersatz(versatz - 1)}>‹</Knopf>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, minWidth: 150, textAlign: 'center' }}>{fenster.label}</span>
              <Knopf leise onClick={() => setVersatz(versatz + 1)}>›</Knopf>
              {versatz !== 0 && <button onClick={() => setVersatz(0)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>heute</button>}
            </span>
          )}
        </div>
        {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Beiträge ohne Datum stehen in jeder Ansicht. MAKE OS veröffentlicht nichts — Text kopieren, selbst posten, Status und Wirkung hier eintragen.</div>
      </Karte>

      {aktuell && <BeitragKarte key={aktuell.id} b={aktuell} api={api} einstellung={einstellung} heute={heute} zuKontakt={zuKontakt} schliessen={() => setOffen(null)} melde={setMeldung} />}

      <Raster min={220}>
        {BEITRAG_STATUS.map((s, i) => (
          <Karte key={s.id} i={i + 1}>
            <Ueberschrift farbe={STATUS_FARBE[s.id]} rechts={String(gruppen[s.id].length)}>{s.label}</Ueberschrift>
            <Liste>
              {gruppen[s.id].map(b => {
                const w = wirkungZahlen(b);
                const saeule = einstellung.saeulen.find(x => x.id === b.saeule)?.name ?? b.saeule;
                return (
                  <Zeile key={b.id} onClick={() => setOffen(offen === b.id ? null : b.id)} aktiv={offen === b.id} titel={b.titel}
                    unter={[kanalLabel(b.kanal), b.datum ? datum(b.datum, heute) : '', saeule, w.reaktionen ? `${w.reaktionen} Reakt.` : '', w.gespraeche + w.anfragen ? `${w.gespraeche + w.anfragen} Gespr./Anfr.` : ''].filter(Boolean).join(' · ')} />
                );
              })}
            </Liste>
            {!gruppen[s.id].length && <Leer>{s.id === 'idee' ? 'Ideen kommen aus der Stimme der Kunden (unten).' : 'Nichts in diesem Zeitraum.'}</Leer>}
          </Karte>
        ))}
      </Raster>

      <Karte i={5}>
        <Ueberschrift rechts={stimmen.length ? `${stimmen.length} Notizen` : undefined}>Themen aus der Stimme der Kunden</Ueberschrift>
        {stimmen.length ? (
          <Liste>
            {(alleStimmen ? stimmen : stimmen.slice(0, 8)).map((s, i) => {
              const drin = schonUebernommen(s, beitraege);
              return (
                <div key={`${s.kontaktId}-${s.am}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>„{s.bedarf}“</div>
                    <button onClick={() => zuKontakt(s.kontaktId)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>{s.name} · {datum(s.am, heute)}</button>
                  </div>
                  {drin ? <Chip farbe={LEUCHT.gut}>übernommen</Chip>
                    : <Knopf leise onClick={async () => { const b = ideeAusStimme(s, neueId('bt'), new Date().toISOString()); await api.setze('beitraege', alsEintrag(b)); setMeldung(`Idee „${b.titel}“ angelegt.`); }}>Als Idee übernehmen</Knopf>}
                </div>
              );
            })}
          </Liste>
        ) : <Leer>Sobald Gesprächsnotizen das Feld „Bedarf / Schmerz“ haben, stehen hier die Themen — echte Probleme, mit eigener Einsicht beantwortet.</Leer>}
        {stimmen.length > 8 && <button onClick={() => setAlleStimmen(!alleStimmen)} style={{ marginTop: 8, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>{alleStimmen ? 'weniger' : `alle ${stimmen.length} zeigen`}</button>}
      </Karte>
    </>
  );
}

function BeitragKarte({ b, api, einstellung, heute, zuKontakt, schliessen, melde }: {
  b: Beitrag; api: CrmApi; einstellung: MarketingEinstellung; heute: string; zuKontakt: (id: string) => void; schliessen: () => void; melde: (t: string) => void;
}) {
  const [art, setArt] = useState<Beitrag['wirkung'][number]['art']>('reaktion');
  const [notiz, setNotiz] = useState('');
  const [hinweis, setHinweis] = useState('');
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const nachId = useMemo(() => new Map(kontakte.map(k => [k.id, k])), [kontakte]);
  const setze = (x: Partial<Beitrag>) => api.setze('beitraege', alsEintrag({ ...b, ...x }));
  const w = wirkungZahlen(b);
  const name = (id: string) => { const k = nachId.get(id); return k ? anzeigename(k) : 'nicht mehr in der Kartei'; };
  const SAEULEN = [{ id: '', label: 'keine' }, ...einstellung.saeulen.map(s => ({ id: s.id, label: s.name }))];

  const eintragen = async (kontaktId: string) => {
    if (b.wirkung.some(x => x.kontaktId === kontaktId && x.art === art)) { setHinweis('Schon eingetragen.'); return; }
    const neu = { kontaktId, art, am: heute, ...(notiz.trim() ? { notiz: notiz.trim().slice(0, 300) } : {}) };
    await setze({ wirkung: [...b.wirkung, neu] });
    // Gespräch und Anfrage gehören in den Verlauf der Person — mit Bezug auf den Beitrag.
    if (art !== 'reaktion') {
      const r = await api.aktivitaet({ id: kontaktId, art: art === 'anfrage' ? 'antwort' : 'gespraech', text: `Aus Beitrag „${b.titel}“${notiz.trim() ? ` — ${notiz.trim()}` : ''}`.slice(0, 3000), bezug: b.id }).catch(() => null);
      setHinweis(r?.ok ? `${WIRKUNG_ARTEN.find(x => x.id === art)?.label} bei ${name(kontaktId)} eingetragen — steht auch im Verlauf.` : 'Wirkung eingetragen, der Verlauf der Person war nicht erreichbar.');
    } else setHinweis(`Reaktion von ${name(kontaktId)} eingetragen.`);
    setNotiz('');
  };

  return (
    <Karte i={0} akzent={STATUS_FARBE[b.status]}>
      <Ueberschrift farbe={STATUS_FARBE[b.status]} rechts={<Knopf leise onClick={schliessen}>Schließen</Knopf>}>Beitrag</Ueberschrift>
      <Feldzeile label="Titel"><Feld wert={b.titel} platzhalter="Titel" onFertig={t => { if (t.trim()) void setze({ titel: t.trim() }); }} /></Feldzeile>
      <Feldzeile label="Status"><Pillen liste={BEITRAG_STATUS} aktiv={b.status} farbe={STATUS_FARBE[b.status]} onWahl={status => void setze({ status, ...(status === 'veroeffentlicht' && !b.datum ? { datum: heute } : {}) })} /></Feldzeile>
      <Feldzeile label="Kanal"><Pillen liste={BEITRAG_KANAELE} aktiv={b.kanal} onWahl={kanal => void setze({ kanal })} /></Feldzeile>
      <Feldzeile label="Säule">{einstellung.saeulen.length ? <Pillen liste={SAEULEN} aktiv={b.saeule ?? ''} onWahl={s => void setze({ saeule: s || undefined })} /> : <span style={{ fontSize: 12.5, color: C.inkLeise }}>Themensäulen legst du unter „Positionierung“ an.</span>}</Feldzeile>
      <Feldzeile label="Datum"><Feld typ="date" breite={170} wert={b.datum ?? ''} platzhalter="Datum" onFertig={d => void setze({ datum: d || undefined })} /></Feldzeile>
      <Feldzeile label="Link"><Feld wert={b.link ?? ''} platzhalter="https://… (nach dem Veröffentlichen)" onFertig={l => void setze({ link: l.trim() || undefined })} /></Feldzeile>
      <div style={{ marginTop: 6 }}><Textfeld wert={b.text ?? ''} zeilen={8} max={8000} platzhalter="Text des Beitrags" onFertig={t => void setze({ text: t || undefined })} /></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <Knopf leise aus={!b.text} onClick={async () => melde((await kopieren(`${b.text ?? ''}`)) ? 'Text kopiert — veröffentlichen bleibt bei dir.' : 'Kopieren nicht möglich.')}>Text kopieren</Knopf>
        {b.link && <Knopf leise onClick={() => window.open(b.link, '_blank', 'noopener')}>Link öffnen</Knopf>}
        <Knopf leise onClick={async () => { if (!window.confirm(`Beitrag „${b.titel}“ löschen?`)) return; await api.weg('beitraege', b.id); schliessen(); melde(`„${b.titel}“ gelöscht.`); }}>Löschen</Knopf>
      </div>

      {b.quellen.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: C.inkLeise }}>
          Thema aus Gesprächen mit: {b.quellen.map((id, i) => <span key={id}>{i ? ', ' : ''}<button onClick={() => zuKontakt(id)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: 0 }}>{name(id)}</button></span>)}
          <span> — Namen nur mit Freigabe der Person nennen.</span>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Ueberschrift rechts={`${w.reaktionen} Reaktionen · ${w.gespraeche} Gespräche · ${w.anfragen} Anfragen`}>Wirkung</Ueberschrift>
        {b.wirkung.length > 0 && (
          <div style={{ display: 'grid', gap: 0, marginBottom: 10 }}>
            {b.wirkung.map((x, i) => (
              <div key={`${x.kontaktId}-${x.art}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: TYP.bedien }}>
                <Punkt farbe={x.art === 'reaktion' ? LEUCHT.puls : LEUCHT.gut} groesse={7} />
                <button onClick={() => zuKontakt(x.kontaktId)} style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: 0, textAlign: 'left' }}>{name(x.kontaktId)}</button>
                <span style={{ color: C.inkDim }}>{WIRKUNG_ARTEN.find(a => a.id === x.art)?.label}</span>
                <span style={{ color: C.inkLeise, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{datum(x.am, heute)}{x.notiz ? ` · ${x.notiz}` : ''}</span>
                <button onClick={() => void setze({ wirkung: b.wirkung.filter((_, j) => j !== i) })} title="Eintrag entfernen (der Verlauf der Person bleibt)" aria-label="Eintrag entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 13 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
          <Pillen liste={WIRKUNG_ARTEN} aktiv={art} onWahl={setArt} />
          <input value={notiz} maxLength={300} onChange={e => setNotiz(e.target.value)} placeholder="Notiz (optional): was hat die Person gesagt?" aria-label="Notiz zur Wirkung" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <PersonWahl kontakte={kontakte} onWahl={k => void eintragen(k.id)} platzhalter="Wer? Person suchen und anklicken" />
          <div style={{ fontSize: 12, color: C.inkLeise }}>{art === 'reaktion' ? 'Reaktionen zählen am Beitrag.' : 'Gespräch und Anfrage stehen zusätzlich im Verlauf der Person — sie zählen als durch Content ausgelöst.'}</div>
          {hinweis && <div style={{ fontSize: 12.5, color: C.inkDim }}>{hinweis}</div>}
        </div>
      </div>
    </Karte>
  );
}
