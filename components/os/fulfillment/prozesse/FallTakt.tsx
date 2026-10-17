'use client';

// ─── Fulfillment › Fall › Takt (Paket C1, 10.10.; 12.10. neu gezeichnet; seit 17.10. Teil von „Menschen & Termine“ — FULFILLMENT_KONZEPT.md 5.1) ─────────
// Rückmeldung 17.10.: „Lieber wenig und klar.“ Den Reiter „Takt“ gibt es nicht mehr (Adresse leitet auf Menschen & Termine, `#stelle-takt-leiste`). Hier die
// Karten des Takts, die FallMenschen.tsx einhängt:
//   · Rituale als Kalender-Leiste über sechs Wochen (echter Termin gefüllt, im Rhythmus erwartete gestrichelt — nie ein erfundener Termin ohne Kalender);
//     „Termin anlegen“ öffnet den VORHANDENEN Anlege-Dialog des Kalenders (vorbelegt: Titel, Dauer, Bezug zum Mandat, Gäste aus der Stakeholder-Karte —
//     eingeladen wird erst nach der Rückfrage im Dialog); danach merkt sich der Fall die Termin-Kennung.
//   · Mitschriften im 4-Zeilen-Standard (Anlass · Ergebnis · nächster Schritt · Frist) — per Klick ins Entscheidungs-Log oder als Aufgabe.
// Befähigung und Wirkungsbericht stehen am Ende der Reise (der Abschluss hängt an der letzten Phase).

import { useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, MIKRO, TIEF, RAND, ECKE } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Feldzeile, ZeileAktionen, LEUCHT, useHandy } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { NeuerTermin } from '../../kalender/NeuerTermin';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import { RHYTHMUS_TEXT, ritualVorgabe, mitschriftAlsAufgabe, mitschriftAlsEntscheidung } from '@/lib/fulfillment/prozesse/rituale';
import { taktLeiste, type TaktZeile } from '@/lib/fulfillment/prozesse/ansichten';
import type { Mitschrift, RitualVorlage } from '@/lib/fulfillment/typen';
import type { Vorgabe } from '@/lib/kalender/formular';
import { fehlerText, holeJson, tagKurz, tagLang, type FallAntwort } from './daten';
import { klein, feld, Leiste } from './teile';
import { MehrKnopf } from '../reise/teile';
import { JETZT } from '../reise/bilder';

export type Melde = (text: string | null, art?: 'gut' | 'kritisch' | 'achtung', aufgabe?: string) => void;
export type TaktOps = (o: Record<string, unknown>[], gut?: string) => Promise<boolean>;
type Ops = TaktOps;

/** Die Vorgabe für den Anlege-Dialog eines Rituals (Gäste: Stakeholder mit Adresse — eingeschränkte Personen fehlen schon in der Liste der Personen). */
export function ritualTermin(daten: FallAntwort, r: RitualVorlage, heute: string): { ritual: RitualVorlage; vorgabe: Vorgabe; wiederholung: string | null } {
  const f = daten.fall!;
  const namen = new Map((daten.personen ?? []).map(p => [p.id, p]));
  const gaeste = f.stakeholder.map(s => namen.get(s.kontaktId)).filter((p): p is NonNullable<typeof p> => !!p?.email).map(p => ({ email: p.email!, name: p.name, kontaktId: p.id }));
  return { ritual: r, ...ritualVorgabe(r, { mandatId: daten.mandat.id, ...(daten.mandat.firmaId ? { firmaId: daten.mandat.firmaId } : {}), kunde: daten.mandat.kunde, heute, gaeste }) };
}

/** Der Anlege-Dialog des Kalenders für ein Ritual — danach merkt sich der Fall die Termin-Kennung. */
export function RitualTerminDialog({ termin, heute, ops, melde, onZu }: { termin: ReturnType<typeof ritualTermin>; heute: string; ops: Ops; melde: Melde; onZu: () => void }) {
  return (
    <>
      {termin.wiederholung && <Hinweis art="info">Rhythmus „{termin.wiederholung}“ — im Dialog unter „Wiederholt sich nicht ▾“ einstellen.</Hinweis>}
      <NeuerTermin vorgabe={termin.vorgabe} heute={heute} standardDauer={termin.ritual.dauerMin} kalender={[]} bereich="business"
        onZu={onZu}
        onAngelegt={was => {
          const r = termin.ritual;
          if (was.uid) void ops([{ op: 'ritual-merken', ritualId: r.id, terminUid: was.uid }], `Termin „${r.titel}“ angelegt und am Fall vermerkt.`);
          else melde(was.hinweis ?? 'Angelegt.', 'achtung');
        }} />
    </>
  );
}

/** Rituale (Kalender-Leiste) und Mitschriften — die Termine des Falls unter „Menschen & Termine“. */
export function TaktKarten({ daten, ops, melde, schreiben, setSchreiben, onTermin }: { daten: FallAntwort; ops: Ops; melde: Melde; schreiben: boolean; setSchreiben: (b: boolean) => void; onTermin: (r: RitualVorlage) => void }) {
  const f = daten.fall!;
  const heute = localDay();
  const rituale = daten.rituale ?? [];
  const leiste = taktLeiste({ rituale, fallRituale: f.rituale, termine: daten.termine ?? {}, heute, vorlageId: f.vorlageId, ...(daten.kalender ? { kalender: daten.kalender } : {}) });
  return (
    <>
      <KalenderLeiste leiste={leiste} rituale={rituale} heute={heute} onTermin={onTermin} />
      <MitschriftenKarte daten={daten} ops={ops} melde={melde} schreiben={schreiben} setSchreiben={setSchreiben} />
    </>
  );
}

// ─── Rituale als Kalender-Leiste ─────────────────────────────────────────────────────────────────────────────────────────────────────
function KalenderLeiste({ leiste, rituale, heute, onTermin }: { leiste: ReturnType<typeof taktLeiste>; rituale: RitualVorlage[]; heute: string; onTermin: (r: RitualVorlage) => void }) {
  const handy = useHandy();
  const wochen = handy ? leiste.wochen.slice(0, 3) : leiste.wochen;
  const ende = tagPlus(wochen.at(-1)!, 6);
  if (!rituale.length) return (
    <Karte i={1} id="takt-leiste">
      <Ueberschrift erklaerung="fulfillment.rituale">Rituale</Ueberschrift>
      <div style={klein}>Die Bibliothek hat noch keine Rituale — unter Fulfillment › Prozesse „Aus Muster anlegen“.</div>
    </Karte>
  );
  // Am Handy steht der Name des Rituals als eigene Zeile über seinen Wochen — eine schmale Namensspalte bräche die Wörter.
  const spalten = handy ? `repeat(${wochen.length}, minmax(0, 1fr))` : `minmax(0, 1.6fr) repeat(${wochen.length}, minmax(0, 1fr))`;
  const lageImTag = (t: string, woche: string) => { const d = Math.round((Date.parse(`${t}T12:00:00Z`) - Date.parse(`${woche}T12:00:00Z`)) / 864e5); return d >= 0 && d < 7 ? d : -1; };
  return (
    <Karte i={1} id="takt-leiste">
      <Ueberschrift erklaerung="fulfillment.rituale" rechts={<span>nächste {wochen.length} Wochen</span>}>Rituale</Ueberschrift>
      <div role="table" aria-label={`Rituale bis ${tagLang(ende)}`} style={{ display: 'grid', gridTemplateColumns: spalten, gap: '6px 4px', alignItems: 'center' }}>
        <span role="row" style={{ display: 'contents' }}>
          {!handy && <span role="columnheader" style={MIKRO}>Ritual</span>}
          {wochen.map(w => <span key={w} role="columnheader" style={{ ...MIKRO, textAlign: 'center', color: heute >= w && heute <= tagPlus(w, 6) ? JETZT : C.inkLeise }}>{heute >= w && heute <= tagPlus(w, 6) ? 'diese Woche' : `ab ${tagKurz(w)}`}</span>)}
        </span>
        {leiste.zeilen.map(z => {
          const r = rituale.find(x => x.id === z.ritualId)!;
          return (
            <span key={z.ritualId} role="row" style={{ display: 'contents' }}>
              <span role="rowheader" style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, minHeight: 44, ...(handy ? { gridColumn: '1 / -1', marginTop: 4 } : {}) }}>
                <span style={{ display: 'grid', gap: 1, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink, overflowWrap: 'break-word' }}>{z.titel}</span>
                  <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{RHYTHMUS_TEXT[z.rhythmus]} · {z.dauerMin} Min.</span>
                </span>
                <MehrKnopf titel={z.titel} mehr={[{ id: 'termin', label: z.naechster ? 'Weiteren Termin anlegen' : 'Termin anlegen', hinweis: 'Öffnet den Kalender-Dialog — Gäste erst nach der Rückfrage.', tun: () => onTermin(r) }]} />
              </span>
              {z.rhythmus === 'einmal' && z.angelegt && !z.tage.some(t => wochen.some(w => lageImTag(t.tag, w) >= 0))
                // Ein einmaliges Ritual außerhalb des Fensters: ein Satz statt leerer Zellen.
                ? <span role="cell" style={{ gridColumn: `span ${wochen.length}`, display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 10px', borderRadius: ECKE.eingabe, border: `1px solid ${RAND.haar}`, fontSize: TYP.bedien, color: C.inkDim }}>
                    {z.naechster ? `Einmalig — Termin am ${tagKurz(z.naechster)}` : 'Einmalig — schon gelaufen'}
                  </span>
                : wochen.map(w => <WochenZelle key={w} z={z} woche={w} lage={lageImTag} onTermin={() => onTermin(r)} />)}
            </span>
          );
        })}
        {leiste.weitere.length > 0 && (
          // 15.10. (Abnahme B3): Termine mit dem Kunden, die an keinem Ritual hängen (z. B. „Cockpit-Abstimmung“) — der Fall kennt sie trotzdem.
          <span role="row" style={{ display: 'contents' }}>
            <span role="rowheader" style={{ display: 'grid', gap: 1, minWidth: 0, minHeight: 44, alignContent: 'center', ...(handy ? { gridColumn: '1 / -1', marginTop: 4 } : {}) }}>
              <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink }}>Weitere Termine</span>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>mit dem Kunden im Kalender</span>
            </span>
            {wochen.map(w => {
              const tage = leiste.weitere.filter(t => lageImTag(t.tag, w) >= 0);
              return <TerminZelle key={w} tage={tage.map(t => ({ tag: t.tag, erwartet: false, titel: `${t.titel ?? 'Termin'}${t.von ? ` · ${t.von}` : ''}` }))} woche={w} lage={lageImTag} name="Weitere Termine" />;
            })}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: TYP.bedien, color: C.inkDim }}>
        <span><span aria-hidden style={{ color: LEUCHT.gut, marginRight: 6 }}>●</span>Termin im Kalender</span>
        <span><span aria-hidden style={{ color: C.inkDim, marginRight: 6 }}>○</span>im Rhythmus erwartet (noch kein eigener Termin)</span>
        <span><span aria-hidden style={{ color: C.inkLeise, marginRight: 6 }}>+</span>noch kein Termin — antippen legt ihn an</span>
      </div>
    </Karte>
  );
}

function WochenZelle({ z, woche, lage, onTermin }: { z: TaktZeile; woche: string; lage: (t: string, w: string) => number; onTermin: () => void }) {
  const tage = z.tage.filter(t => lage(t.tag, woche) >= 0);
  if (!tage.length && !z.naechster && (z.rhythmus !== 'einmal' || !z.angelegt)) {
    return <button type="button" role="cell" className="fassbar" onClick={onTermin} aria-label={`${z.titel}: noch kein Termin — anlegen`} style={{ ...ZELLE, cursor: 'pointer', color: C.inkLeise, fontSize: TYP.body, background: 'transparent', borderStyle: 'dashed' }}>+</button>;
  }
  return <TerminZelle tage={tage} woche={woche} lage={lage} name={z.titel} />;
}

const ZELLE = { minHeight: 44, borderRadius: ECKE.eingabe, border: `1px solid ${RAND.haar}`, position: 'relative' as const, background: 'rgba(255,255,255,.02)' };

/**
 * Eine Woche als Zelle: je Termin ein Punkt am Wochentag (oben), darunter EIN Datum — so liegen Punkt und Datum nie übereinander (15.10., Abnahme C3:
 * „Takt-Punkt über 20.10.“). Gefüllt = Termin im Kalender, Umriss = im Rhythmus erwartet.
 */
function TerminZelle({ tage, woche, lage, name }: { tage: { tag: string; erwartet: boolean; titel?: string }[]; woche: string; lage: (t: string, w: string) => number; name: string }) {
  const echte = tage.filter(t => !t.erwartet);
  return (
    <span role="cell" aria-label={tage.length ? `${name}: ${tage.map(t => `${tagKurz(t.tag)}${t.titel ? ` ${t.titel}` : ''}${t.erwartet ? ' (erwartet)' : ''}`).join(', ')}` : `${name}: kein Termin in dieser Woche`} style={ZELLE}>
      {tage.slice(0, 7).map(t => {
        const d = lage(t.tag, woche);
        return <span key={`${t.tag}-${t.titel ?? ''}`} aria-hidden title={`${tagKurz(t.tag)}${t.titel ? ` · ${t.titel}` : ''}${t.erwartet ? ' · im Rhythmus erwartet' : ' · im Kalender'}`} style={{ position: 'absolute', left: `calc(${((d + 0.5) / 7) * 100}% - 5px)`, top: 7, width: 10, height: 10, borderRadius: 5, background: t.erwartet ? 'transparent' : LEUCHT.gut, border: `2px solid ${t.erwartet ? C.inkDim : LEUCHT.gut}`, boxShadow: t.erwartet ? undefined : TIEF.schein(LEUCHT.gut, 8) }} />;
      })}
      {echte.length === 1 && <span style={{ position: 'absolute', left: 6, right: 4, bottom: 3, fontSize: TYP.bedien, lineHeight: 1.2, color: C.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tagKurz(echte[0].tag)}</span>}
      {echte.length > 1 && <span style={{ position: 'absolute', left: 6, right: 4, bottom: 3, fontSize: TYP.bedien, lineHeight: 1.2, color: C.inkDim }}>{echte.length} Termine</span>}
      {/* 15.10. (Abnahme B7): ein Termin im Kalender führt in den Kalender an diesen Tag. */}
      {echte[0] && <Link href={WEG.kalender(echte[0].tag)} aria-label={`${name} am ${tagKurz(echte[0].tag)} im Kalender öffnen`} className="fassbar" style={{ position: 'absolute', inset: 0, borderRadius: ECKE.eingabe }} />}
    </span>
  );
}

// ─── Mitschriften ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function MitschriftenKarte({ daten, ops, melde, schreiben, setSchreiben }: { daten: FallAntwort; ops: Ops; melde: Melde; schreiben: boolean; setSchreiben: (b: boolean) => void }) {
  const f = daten.fall!;
  const leer = { anlass: '', ergebnis: '', naechster: '', frist: '', ritualId: null as string | null };
  const [w, setW] = useState(leer);
  const [alle, setAlle] = useState(false);
  const rituale = daten.rituale ?? [];
  const liste = [...f.mitschriften].sort((a, b) => (a.am < b.am ? 1 : -1));
  const sichtbar = alle ? liste : liste.slice(0, 3);
  const alsAufgabe = async (m: Mitschrift) => {
    const spaceId = daten.mandat.firmaId ? `m-${daten.mandat.firmaId}` : daten.mandat.gesellschaft;
    const a = await holeJson<{ id?: string; hinweis?: string }>('/api/tasks/create', { method: 'POST', body: JSON.stringify({ ...mitschriftAlsAufgabe(m, daten.mandat.id), spaceId }) });
    if (a.ok) melde(a.j.hinweis ?? `Aufgabe „${m.naechster.slice(0, 60)}“ angelegt.`, 'gut', typeof a.j.id === 'string' ? a.j.id : undefined);
    else melde(fehlerText(a), 'kritisch');
  };
  const offen = schreiben || !liste.length;
  return (
    <Karte i={2} id="takt-mitschriften">
      <Ueberschrift erklaerung="fulfillment.mitschrift" rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span>{f.mitschriften.length}</span>{!offen && <Knopf leise onClick={() => setSchreiben(true)}>+ Mitschrift</Knopf>}</span>}>Mitschriften</Ueberschrift>
      {offen && (
        <form onSubmit={e => { e.preventDefault(); void ops([{ op: 'mitschrift', eintrag: { anlass: w.anlass, ergebnis: w.ergebnis, naechster: w.naechster, ...(w.frist ? { frist: w.frist } : {}), ...(w.ritualId ? { ritualId: w.ritualId } : {}) } }], 'Mitschrift gespeichert.').then(ok => { if (ok) { setW(leer); setSchreiben(false); } }); }} style={{ display: 'grid', gap: 8 }}>
          <Feldzeile label="Anlass"><input value={w.anlass} maxLength={300} onChange={e => setW({ ...w, anlass: e.target.value })} style={feld} /></Feldzeile>
          <Feldzeile label="Ergebnis"><input value={w.ergebnis} maxLength={300} onChange={e => setW({ ...w, ergebnis: e.target.value })} style={feld} /></Feldzeile>
          <Feldzeile label="Nächster Schritt"><input value={w.naechster} maxLength={300} onChange={e => setW({ ...w, naechster: e.target.value })} style={feld} /></Feldzeile>
          <Leiste>
            <Feldzeile label="Frist"><input type="date" value={w.frist} onChange={e => setW({ ...w, frist: e.target.value })} style={{ ...feld, width: 170 }} /></Feldzeile>
            {rituale.length > 0 && <Wahl label="Ritual" liste={rituale.map(r => ({ id: r.id, label: r.titel }))} wert={w.ritualId} onWahl={ritualId => setW({ ...w, ritualId })} onLeeren={() => setW({ ...w, ritualId: null })} leerenLabel="ohne Ritual" />}
          </Leiste>
          <div style={klein}>Kein Freitext über Personen — nur, was besprochen und vereinbart ist.</div>
          <Leiste><Knopf typ="submit" aus={!w.anlass.trim() || !w.ergebnis.trim() || !w.naechster.trim()}>Mitschrift speichern</Knopf>{liste.length > 0 && <Knopf leise onClick={() => setSchreiben(false)}>Abbrechen</Knopf>}</Leiste>
        </form>
      )}
      {liste.length > 0 && (
        <Liste>
          {sichtbar.map(m => (
            <ZeileAktionen key={m.id} titel={m.anlass} mehr={[
              { id: 'entscheidung', label: 'Ins Entscheidungs-Log', hinweis: 'Das Ergebnis wird eine entschiedene Entscheidung (nur intern).', tun: () => ops([{ op: 'entscheidung', eintrag: mitschriftAlsEntscheidung(m) }], 'Ins Entscheidungs-Log übernommen.') },
              { id: 'aufgabe', label: 'Nächsten Schritt als Aufgabe', hinweis: 'Mit Bezug zum Mandat, Frist als Deadline.', tun: () => alsAufgabe(m) },
              { id: 'weg', label: 'Mitschrift entfernen', gefahr: true, tun: () => ops([{ op: 'mitschrift', id: m.id, weg: true }]) },
            ]}>
              <div style={{ display: 'grid', gap: 3, padding: '8px 0' }}>
                <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{tagLang(m.am)}{m.ritualId ? ` · ${rituale.find(r => r.id === m.ritualId)?.titel ?? 'Ritual'}` : ''}{m.frist ? ` · Frist ${tagKurz(m.frist)}` : ''}</div>
                <div style={{ fontSize: TYP.body, color: C.ink, overflowWrap: 'anywhere' }}><b>{m.anlass}</b> — {m.ergebnis}</div>
                <div style={{ fontSize: TYP.bedien, color: C.inkDim, overflowWrap: 'anywhere' }}>Nächster Schritt: {m.naechster}</div>
              </div>
            </ZeileAktionen>
          ))}
        </Liste>
      )}
      {liste.length > 3 && <div><Knopf leise onClick={() => setAlle(!alle)}>{alle ? 'Weniger zeigen' : `Alle ${liste.length} zeigen`}</Knopf></div>}
    </Karte>
  );
}
