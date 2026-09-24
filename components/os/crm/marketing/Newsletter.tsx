'use client';

// ─── CRM · Marketing › Newsletter — nur mit Double-Opt-in ──────────────────
// Empfänger sind ausschließlich Personen mit Newsletter-Einwilligung per
// Double-Opt-in (R6/R7) — eine Mail-Einwilligung oder ein Mandat reicht nicht.
// MAKE OS versendet nichts: Ausgabe hier schreiben, Empfänger exportieren,
// im Versandwerkzeug verschicken, danach Empfänger, Antworten und
// Abmeldungen von Hand eintragen. Öffnungsraten zählen hier bewusst nicht.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Zahl, Raster, feld, LEUCHT } from '../../schlank';
import type { NewsletterAusgabe, Beitrag } from '@/lib/crm/typen';
import { AUSGABE_STATUS, newsletterEmpfaenger, abmeldequote, quotenAmpel, prozent } from '@/lib/crm/marketing';
import { type CrmApi, neueId, datum } from '../daten';
import { Pillen, Feld, Feldzeile } from '../teile';
import { KPI_FARBE, Textfeld, kopieren } from './gemeinsam';

const STATUS_FARBE: Record<NewsletterAusgabe['status'], string> = { entwurf: C.inkDim, bereit: LEUCHT.achtung, versendet: LEUCHT.gut };
const alsEintrag = (a: NewsletterAusgabe) => a as unknown as { id: string } & Record<string, unknown>;

export function Newsletter({ api }: { api: CrmApi }) {
  const [offen, setOffen] = useState<string | null>(null);
  const [titel, setTitel] = useState('');
  const [meldung, setMeldung] = useState('');
  const crm = api.crm;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const empfaenger = useMemo(() => newsletterEmpfaenger(kontakte).length, [kontakte]);
  const ausgaben = useMemo(() => {
    const rang = { entwurf: 0, bereit: 0, versendet: 1 } as const;
    return [...(crm?.stand.newsletter ?? [])].sort((a, b) => rang[a.status] - rang[b.status] || (b.datum ?? '9999').localeCompare(a.datum ?? '9999') || b.geaendert.localeCompare(a.geaendert));
  }, [crm]);
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const heute = crm.heute;
  const versendet = ausgaben.filter(a => a.status === 'versendet');
  const antworten = versendet.reduce((s, a) => s + (a.antworten ?? 0), 0);
  const letzteQuote = versendet.map(abmeldequote).find(q => q !== null) ?? null;

  const anlegen = async () => {
    const t = titel.trim();
    if (!t) return;
    const a: NewsletterAusgabe = { id: neueId('nl'), titel: t.slice(0, 200), status: 'entwurf', inhalt: '', beitragIds: [], geaendert: new Date().toISOString() };
    await api.setze('newsletter', alsEintrag(a));
    setTitel(''); setOffen(a.id);
  };

  return (
    <>
      <Karte i={0} akzent={empfaenger ? undefined : LEUCHT.achtung}>
        <Ueberschrift rechts={<Knopf leise aus={!empfaenger} onClick={() => { window.location.href = '/api/crm/marketing?newsletter=empfaenger&format=csv'; }}>Empfänger als CSV</Knopf>}>Empfänger</Ueberschrift>
        <Raster min={150}>
          <Zahl wert={String(empfaenger)} label="mit Double-Opt-in" farbe={empfaenger ? LEUCHT.gut : LEUCHT.achtung} />
          <Zahl wert={versendet.length ? String(versendet.length) : undefined} label="Ausgaben versendet" />
          <Zahl wert={versendet.length ? String(antworten) : undefined} label="Antworten insgesamt" />
          <Zahl wert={letzteQuote === null ? undefined : prozent(letzteQuote)} label="Abmeldequote zuletzt" farbe={letzteQuote === null ? undefined : KPI_FARBE[quotenAmpel(letzteQuote)]} />
        </Raster>
        {!empfaenger && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginTop: 10 }}>0 Empfänger mit Double-Opt-in — ohne DOI kein Newsletter. Die Einwilligung „Newsletter“ mit Nachweis (Bestätigungsklick) hältst du in der Karteikarte unter „Recht“ fest.</div>}
        <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 10, lineHeight: 1.5 }}>MAKE OS versendet nichts. Ausgabe hier schreiben, Empfänger exportieren (nur Name und Adresse, nur Double-Opt-in), im Versandwerkzeug verschicken — mit Abmeldelink. Danach Empfänger, Antworten und Abmeldungen eintragen. Öffnungsraten sind keine Steuergröße.</div>
      </Karte>

      <Karte i={1}>
        <Ueberschrift>Ausgaben · {ausgaben.length}</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input value={titel} maxLength={200} onChange={e => setTitel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void anlegen(); }} placeholder="Neue Ausgabe: Titel eingeben, Enter" aria-label="Titel der Ausgabe" style={{ ...feld, flex: 1, minWidth: 220, fontSize: TYP.bedien, padding: '9px 13px' }} />
          <Knopf aus={!titel.trim()} onClick={() => void anlegen()}>+ Ausgabe</Knopf>
        </div>
        {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 8 }}>{meldung}</div>}
        <Liste>
          {ausgaben.map(a => {
            const q = abmeldequote(a);
            return (
              <div key={a.id}>
                <Zeile onClick={() => setOffen(offen === a.id ? null : a.id)} aktiv={offen === a.id} titel={a.titel}
                  unter={[a.datum ? datum(a.datum, heute) : 'ohne Datum', a.beitragIds.length ? `${a.beitragIds.length} Beiträge` : '', a.status === 'versendet' && a.empfaenger ? `${a.empfaenger} Empfänger` : '', a.antworten ? `${a.antworten} Antworten` : '', q !== null ? `Abmeldungen ${prozent(q)}` : ''].filter(Boolean).join(' · ')}
                  rechts={<Chip farbe={STATUS_FARBE[a.status]}>{AUSGABE_STATUS.find(s => s.id === a.status)?.label}</Chip>} />
                {offen === a.id && <AusgabeFormular a={a} api={api} heute={heute} empfaenger={empfaenger} beitraege={crm.stand.beitraege ?? []} schliessen={() => setOffen(null)} melde={setMeldung} />}
              </div>
            );
          })}
        </Liste>
        {!ausgaben.length && <Leer>Noch keine Ausgabe. Eine Ausgabe bündelt Beiträge und eine eigene Einsicht — Themen kommen aus der Stimme der Kunden.</Leer>}
      </Karte>
    </>
  );
}

function AusgabeFormular({ a, api, heute, empfaenger, beitraege, schliessen, melde }: {
  a: NewsletterAusgabe; api: CrmApi; heute: string; empfaenger: number; beitraege: Beitrag[]; schliessen: () => void; melde: (t: string) => void;
}) {
  const setze = (x: Partial<NewsletterAusgabe>) => api.setze('newsletter', alsEintrag({ ...a, ...x }));
  const zahl = (t: string) => { if (t.trim() === '') return undefined; const n = Math.round(Number(t)); return Number.isFinite(n) && n >= 0 ? n : undefined; };
  const q = abmeldequote(a);
  const waehlbar = [...beitraege].filter(b => b.status !== 'idee' || a.beitragIds.includes(b.id)).sort((x, y) => (y.datum ?? '').localeCompare(x.datum ?? '')).slice(0, 30);
  const gewaehlt = beitraege.filter(b => a.beitragIds.includes(b.id));
  const text = [a.titel, '', a.inhalt, ...(gewaehlt.length ? ['', ...gewaehlt.map(b => `– ${b.titel}${b.link ? ` ${b.link}` : ''}`)] : [])].join('\n').trim();
  return (
    <div style={{ display: 'grid', gap: 6, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', margin: '6px 0 12px' }}>
      <Feldzeile label="Titel"><Feld wert={a.titel} platzhalter="Titel" onFertig={t => { if (t.trim()) void setze({ titel: t.trim() }); }} /></Feldzeile>
      <Feldzeile label="Status"><Pillen liste={AUSGABE_STATUS} aktiv={a.status} farbe={STATUS_FARBE[a.status]} onWahl={status => void setze({ status, ...(status === 'versendet' && !a.datum ? { datum: heute } : {}) })} /></Feldzeile>
      <Feldzeile label="Datum"><Feld typ="date" breite={170} wert={a.datum ?? ''} platzhalter="Datum" onFertig={d => void setze({ datum: d || undefined })} /></Feldzeile>
      <div style={{ marginTop: 4 }}><Textfeld wert={a.inhalt} zeilen={10} max={20000} platzhalter="Inhalt der Ausgabe — eine Einsicht, konkret, in deiner Stimme" onFertig={t => void setze({ inhalt: t })} /></div>
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 12.5, color: C.inkLeise, marginBottom: 6 }}>Beiträge in dieser Ausgabe</div>
        {waehlbar.length ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {waehlbar.map(b => <Pillen key={b.id} liste={[{ id: b.id, label: b.titel.length > 48 ? `${b.titel.slice(0, 47)}…` : b.titel }]} aktiv={a.beitragIds.includes(b.id) ? b.id : null}
              onWahl={id => void setze({ beitragIds: a.beitragIds.includes(id) ? a.beitragIds.filter(x => x !== id) : [...a.beitragIds, id].slice(0, 20) })} />)}
          </div>
        ) : <div style={{ fontSize: 12.5, color: C.inkLeise }}>Noch keine Beiträge über das Ideen-Stadium hinaus.</div>}
      </div>
      {a.status !== 'entwurf' && !empfaenger && <div style={{ fontSize: 12.5, color: LEUCHT.achtung, marginTop: 6 }}>Ohne Empfänger mit Double-Opt-in nicht versenden.</div>}
      {a.status === 'versendet' && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12.5, color: C.inkLeise, marginBottom: 4 }}>Zahlen aus dem Versandwerkzeug — von Hand</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Feld typ="number" breite={130} wert={a.empfaenger === undefined ? '' : String(a.empfaenger)} platzhalter="Empfänger" onFertig={t => void setze({ empfaenger: zahl(t) })} />
            <Feld typ="number" breite={130} wert={a.antworten === undefined ? '' : String(a.antworten)} platzhalter="Antworten" onFertig={t => void setze({ antworten: zahl(t) })} />
            <Feld typ="number" breite={130} wert={a.abmeldungen === undefined ? '' : String(a.abmeldungen)} platzhalter="Abmeldungen" onFertig={t => void setze({ abmeldungen: zahl(t) })} />
            {q !== null ? <Chip farbe={KPI_FARBE[quotenAmpel(q)]}>Abmeldequote {prozent(q)}</Chip> : <span style={{ fontSize: 12, color: C.inkLeise }}>Quote erscheint mit Empfängern und Abmeldungen · Ziel &lt; 0,5 %</span>}
          </div>
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Abmeldungen im Versandwerkzeug sind Widerrufe — die Einwilligung in der Karteikarte der Person widerrufen, damit sie aus dem nächsten Export fällt.</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <Knopf leise aus={!a.inhalt.trim()} onClick={async () => melde((await kopieren(text)) ? 'Ausgabe kopiert — Versand im Versandwerkzeug, nicht hier.' : 'Kopieren nicht möglich.')}>Ausgabe kopieren</Knopf>
        <Knopf leise onClick={schliessen}>Schließen</Knopf>
        <Knopf leise onClick={async () => { if (!window.confirm(`Ausgabe „${a.titel}“ löschen?`)) return; await api.weg('newsletter', a.id); schliessen(); melde(`„${a.titel}“ gelöscht.`); }}>Löschen</Knopf>
      </div>
    </div>
  );
}
