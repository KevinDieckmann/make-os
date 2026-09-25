'use client';

// ─── Markttraktion · Marketing › Newsletter — nur mit Double-Opt-in ──────────────────
// Empfänger sind ausschließlich Personen mit Newsletter-Einwilligung per
// Double-Opt-in (R6/R7) — eine Mail-Einwilligung oder ein Mandat reicht nicht.
// MAKE OS versendet nichts: Ausgabe hier schreiben, Empfänger exportieren,
// im Versandwerkzeug verschicken, danach Empfänger, Antworten und
// Abmeldungen von Hand eintragen. Öffnungsraten zählen hier bewusst nicht.
//
// Zu zweit (25.09.): Jede Ausgabe hat eine Zuständige (ohne Eintrag Malin als
// Verantwortliche für Marketing) und auf Wunsch eine Freigabe — Ziel wählbar,
// Kevin oder Malin. Ist sie angefragt, geht die Ausgabe erst mit Okay auf
// „Bereit“ oder „Versendet“ (lib/crm/marketing.ts, ausgabeStatusWechsel).
// Jede Änderung ist eine Einzeländerung (api.teil).

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Zahl, Raster, feld, LEUCHT } from '../../schlank';
import type { NewsletterAusgabe, Beitrag } from '@/lib/crm/typen';
import { TEAM, anderer, nameVon } from '@/lib/crm/team';
import {
  AUSGABE_STATUS, newsletterEmpfaenger, abmeldequote, quotenAmpel, prozent,
  autorVon, ausgabeFreigabeStand, ausgabeSperre, ausgabeStatusWechsel, ausgabeNachTextAenderung, ausgabeNaechsterSchritt, freigabeAnfrage, freigabeOk, aenderungsWunsch, type Teil,
} from '@/lib/crm/marketing';
import { type CrmApi, neueId, datum } from '../daten';
import { Pillen, Feld, Feldzeile } from '../teile';
import { Person, ZustaendigWahl, Uebergeben, WerFilter, useWerFilter, passtWer, type WerWahl } from '../team';
import { KPI_FARBE, Textfeld, kopieren, FreigabeChip, FreigabeBlock, AlsNaechstes } from './gemeinsam';

const STATUS_FARBE: Record<NewsletterAusgabe['status'], string> = { entwurf: C.inkDim, bereit: LEUCHT.achtung, versendet: LEUCHT.gut };
const alsEintrag = (a: NewsletterAusgabe) => a as unknown as { id: string } & Record<string, unknown>;
/** Filter „Alle · Meins · …“: nach Zuständigkeit — und was auf dein Okay wartet, gehört auch zu dir. */
function passtAusgabe(a: NewsletterAusgabe, wahl: WerWahl, ich: string | null): boolean {
  if (passtWer(wahl, a.zustaendig, 'marketing', ich)) return true;
  return wahl !== 'alle' && a.freigabe?.status === 'offen' && a.freigabe.an === (wahl === 'ich' ? ich : wahl);
}

export function Newsletter({ api, fokus }: { api: CrmApi; fokus?: string }) {
  const [offen, setOffen] = useState<string | null>(fokus ?? null);
  const [titel, setTitel] = useState('');
  const [meldung, setMeldung] = useState('');
  const [wer, setWer] = useWerFilter('marketing-newsletter');
  useEffect(() => { if (fokus) setOffen(fokus); }, [fokus]);
  const crm = api.crm;
  const ich = api.ich;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const empfaenger = useMemo(() => newsletterEmpfaenger(kontakte).length, [kontakte]);
  const ausgaben = useMemo(() => {
    const rang = { entwurf: 0, bereit: 0, versendet: 1 } as const;
    return [...(crm?.stand.newsletter ?? [])].sort((a, b) => rang[a.status] - rang[b.status] || (b.datum ?? '9999').localeCompare(a.datum ?? '9999') || b.geaendert.localeCompare(a.geaendert));
  }, [crm]);
  const zahlen = useMemo(() => {
    const z: Record<string, number> = { alle: ausgaben.length };
    if (ich) { z.ich = ausgaben.filter(a => passtAusgabe(a, 'ich', ich)).length; z[anderer(ich)] = ausgaben.filter(a => passtAusgabe(a, anderer(ich), ich)).length; }
    return z;
  }, [ausgaben, ich]);
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const heute = crm.heute;
  const sichtbar = ausgaben.filter(a => passtAusgabe(a, wer, ich));
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
        <Ueberschrift rechts={<WerFilter wahl={wer} onWahl={setWer} ich={ich} zahlen={zahlen} />}>Ausgaben · {ausgaben.length}</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input value={titel} maxLength={200} onChange={e => setTitel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void anlegen(); }} placeholder="Neue Ausgabe: Titel eingeben, Enter" aria-label="Titel der Ausgabe" style={{ ...feld, flex: 1, minWidth: 220, fontSize: TYP.bedien, padding: '9px 13px' }} />
          <Knopf aus={!titel.trim()} onClick={() => void anlegen()}>+ Ausgabe</Knopf>
        </div>
        {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 8 }}>{meldung}</div>}
        <Liste>
          {sichtbar.map(a => {
            const q = abmeldequote(a);
            const stand = a.status === 'versendet' ? 'nicht_noetig' : ausgabeFreigabeStand(a);
            return (
              <div key={a.id}>
                <Zeile onClick={() => setOffen(offen === a.id ? null : a.id)} aktiv={offen === a.id} titel={a.titel} links={<Person id={autorVon(a)} groesse={20} />}
                  unter={[a.datum ? datum(a.datum, heute) : 'ohne Datum', a.beitragIds.length ? `${a.beitragIds.length} Beiträge` : '', a.status === 'versendet' && a.empfaenger ? `${a.empfaenger} Empfänger` : '', a.antworten ? `${a.antworten} Antworten` : '', q !== null ? `Abmeldungen ${prozent(q)}` : ''].filter(Boolean).join(' · ')}
                  rechts={<span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{stand !== 'ok' && <FreigabeChip stand={stand} an={a.freigabe?.an} />}<Chip farbe={STATUS_FARBE[a.status]}>{AUSGABE_STATUS.find(s => s.id === a.status)?.label}</Chip></span>} />
                {offen === a.id && <AusgabeFormular a={a} api={api} heute={heute} empfaenger={empfaenger} beitraege={crm.stand.beitraege ?? []} schliessen={() => setOffen(null)} melde={setMeldung} />}
              </div>
            );
          })}
        </Liste>
        {!ausgaben.length && <Leer>Noch keine Ausgabe. Eine Ausgabe bündelt Beiträge und eine eigene Einsicht — Themen kommen aus der Stimme der Kunden.</Leer>}
        {ausgaben.length > 0 && !sichtbar.length && <Leer>Nichts für diese Auswahl — „Alle“ zeigt jede Ausgabe.</Leer>}
      </Karte>
    </>
  );
}

function AusgabeFormular({ a, api, heute, empfaenger, beitraege, schliessen, melde }: {
  a: NewsletterAusgabe; api: CrmApi; heute: string; empfaenger: number; beitraege: Beitrag[]; schliessen: () => void; melde: (t: string) => void;
}) {
  const [statusHinweis, setStatusHinweis] = useState('');
  const ich = api.ich;
  const jetzt = () => new Date().toISOString();
  /** Nur diese Felder — der Server vereint mit dem Stand, den die/der andere gerade hat. */
  const teil = (x: Teil<NewsletterAusgabe>) => api.teil('newsletter', a.id, x);
  /** Titel und Inhalt: Ein Okay gilt dem freigegebenen Text — ändert jemand anderes, liegt es wieder bei der freigebenden Person. */
  const textAendern = (x: Teil<NewsletterAusgabe>) => { const f = ausgabeNachTextAenderung(a, ich, jetzt()); if (f) melde(`Geändert — die Freigabe liegt wieder bei ${nameVon(f.an)}.`); return teil(f ? { ...x, freigabe: f } : x); };
  const statusWahl = (neu: NewsletterAusgabe['status']) => {
    const x = ausgabeStatusWechsel(a, neu, ich, heute, jetzt());
    if (!x.ok) { setStatusHinweis(x.grund); return; }
    setStatusHinweis('');
    void teil(x.felder);
  };
  const zahl = (t: string) => { if (t.trim() === '') return null; const n = Math.round(Number(t)); return Number.isFinite(n) && n >= 0 ? n : null; };
  const autor = autorVon(a);
  const stand = ausgabeFreigabeStand(a);
  const sperre = ausgabeSperre(a, ich);
  // Um Freigabe bitten kann man jede Person im Team außer sich selbst — auch die Zuständige, wenn jemand anderes mitgeschrieben hat.
  const ziele = TEAM.map(t => t.id).filter(id => id !== ich);
  const q = abmeldequote(a);
  const waehlbar = [...beitraege].filter(b => b.status !== 'idee' || a.beitragIds.includes(b.id)).sort((x, y) => (y.datum ?? '').localeCompare(x.datum ?? '')).slice(0, 30);
  const gewaehlt = beitraege.filter(b => a.beitragIds.includes(b.id));
  const text = [a.titel, '', a.inhalt, ...(gewaehlt.length ? ['', ...gewaehlt.map(b => `– ${b.titel}${b.link ? ` ${b.link}` : ''}`)] : [])].join('\n').trim();
  return (
    <div style={{ display: 'grid', gap: 6, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', margin: '6px 0 12px' }}>
      <AlsNaechstes>{ausgabeNaechsterSchritt(a, ich, empfaenger)}</AlsNaechstes>
      <Feldzeile label="Titel"><Feld wert={a.titel} platzhalter="Titel" onFertig={t => { if (t.trim()) void textAendern({ titel: t.trim() }); }} /></Feldzeile>
      <Feldzeile label="Zuständig">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ZustaendigWahl wert={a.zustaendig} welt="marketing" onWahl={z => void teil({ zustaendig: z })} />
          <Uebergeben api={api} art="newsletter" id={a.id} jetzt={autor} klein />
        </div>
      </Feldzeile>
      <Feldzeile label="Freigabe">
        <FreigabeBlock f={a.freigabe} stand={stand} an={a.freigabe?.an ?? null} ich={ich} heute={heute} erledigt={a.status === 'versendet'} ziele={ziele}
          ohne={a.status === 'versendet' ? 'Ohne Freigabe versendet.' : 'Keine Freigabe angefragt — wer mitlesen soll:'}
          onAnfragen={an => { void teil({ freigabe: freigabeAnfrage(an, ich, jetzt()) }); melde(`„${a.titel}“ liegt jetzt bei ${nameVon(an)} zur Freigabe.`); }}
          onFreigeben={() => { if (a.freigabe) void teil({ freigabe: freigabeOk(a.freigabe, a.freigabe.an, jetzt()) }); }}
          onAenderung={n => { const f = a.freigabe ? aenderungsWunsch(a.freigabe, a.freigabe.an, n, jetzt()) : null; if (f) void teil({ freigabe: f }); }} />
      </Feldzeile>
      <Feldzeile label="Status"><Pillen liste={AUSGABE_STATUS} aktiv={a.status} farbe={STATUS_FARBE[a.status]} onWahl={statusWahl} /></Feldzeile>
      {(statusHinweis || (a.status === 'bereit' && sperre)) && <div style={{ fontSize: 12.5, color: LEUCHT.achtung, margin: '2px 0 6px', lineHeight: 1.5 }}>{statusHinweis || `Bereit, aber: ${sperre}`}</div>}
      <Feldzeile label="Datum"><Feld typ="date" breite={170} wert={a.datum ?? ''} platzhalter="Datum" onFertig={d => void teil({ datum: d || null })} /></Feldzeile>
      <div style={{ marginTop: 4 }}><Textfeld wert={a.inhalt} zeilen={10} max={20000} platzhalter="Inhalt der Ausgabe — eine Einsicht, konkret, in deiner Stimme" onFertig={t => void textAendern({ inhalt: t })} /></div>
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 12.5, color: C.inkLeise, marginBottom: 6 }}>Beiträge in dieser Ausgabe</div>
        {waehlbar.length ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {waehlbar.map(b => <Pillen key={b.id} liste={[{ id: b.id, label: b.titel.length > 48 ? `${b.titel.slice(0, 47)}…` : b.titel }]} aktiv={a.beitragIds.includes(b.id) ? b.id : null}
              onWahl={id => void teil({ beitragIds: a.beitragIds.includes(id) ? a.beitragIds.filter(x => x !== id) : [...a.beitragIds, id].slice(0, 20) })} />)}
          </div>
        ) : <div style={{ fontSize: 12.5, color: C.inkLeise }}>Noch keine Beiträge über das Ideen-Stadium hinaus.</div>}
      </div>
      {a.status !== 'entwurf' && !empfaenger && <div style={{ fontSize: 12.5, color: LEUCHT.achtung, marginTop: 6 }}>Ohne Empfänger mit Double-Opt-in nicht versenden.</div>}
      {a.status === 'versendet' && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12.5, color: C.inkLeise, marginBottom: 4 }}>Zahlen aus dem Versandwerkzeug — von Hand</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Feld typ="number" breite={130} wert={a.empfaenger == null ? '' : String(a.empfaenger)} platzhalter="Empfänger" onFertig={t => void teil({ empfaenger: zahl(t) })} />
            <Feld typ="number" breite={130} wert={a.antworten == null ? '' : String(a.antworten)} platzhalter="Antworten" onFertig={t => void teil({ antworten: zahl(t) })} />
            <Feld typ="number" breite={130} wert={a.abmeldungen == null ? '' : String(a.abmeldungen)} platzhalter="Abmeldungen" onFertig={t => void teil({ abmeldungen: zahl(t) })} />
            {q !== null ? <Chip farbe={KPI_FARBE[quotenAmpel(q)]}>Abmeldequote {prozent(q)}</Chip> : <span style={{ fontSize: 12, color: C.inkLeise }}>Quote erscheint mit Empfängern und Abmeldungen · Ziel &lt; 0,5 %</span>}
          </div>
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Abmeldungen im Versandwerkzeug sind Widerrufe — die Einwilligung in der Karteikarte der Person widerrufen, damit sie aus dem nächsten Export fällt.</div>
        </div>
      )}
      {a.geaendertVon && <div style={{ fontSize: 11.5, color: C.inkLeise, marginTop: 4 }}>Zuletzt geändert von {nameVon(a.geaendertVon)} · {datum(a.geaendert.slice(0, 10), heute)}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <Knopf leise aus={!a.inhalt.trim()} onClick={async () => melde((await kopieren(text)) ? 'Ausgabe kopiert — Versand im Versandwerkzeug, nicht hier.' : 'Kopieren nicht möglich.')}>Ausgabe kopieren</Knopf>
        <Knopf leise onClick={schliessen}>Schließen</Knopf>
        <Knopf leise onClick={async () => { if (!window.confirm(`Ausgabe „${a.titel}“ löschen?`)) return; await api.weg('newsletter', a.id); schliessen(); melde(`„${a.titel}“ gelöscht.`); }}>Löschen</Knopf>
      </div>
    </div>
  );
}
