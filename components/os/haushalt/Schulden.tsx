'use client';

// Schulden und Rechnungen — zwei Dinge, die oft verwechselt werden:
// RECHNUNG — ihr schuldet noch Geld (Betrag, Fälligkeit). BELEG — der
// Buchhaltung fehlt nur Papier, kein Geldfluss. Belege der Selbstständigkeit
// stehen unter Business; hier steht, was privat ist.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import type { Beleg, Schuld } from '@/lib/finanzen/haushalt/typen';
import { eur, zuCent } from '@/lib/finanzen/haushalt/typen';
import { laufzeit, schuldenfreiAm, sondertilgung } from '@/lib/finanzen/haushalt/schulden';
import { datumDe, tagPlus, heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { Karte, Ueberschrift, Leer, Knopf, Chip, feld, Spalten, Spalte, LEUCHT } from '../schlank';
import { Dialog, Feld, Hinweis, Kachel, Kacheln, Leiste, auswahl, type HaushaltDaten, type Op } from './gemeinsam';

interface Props { h: HaushaltDaten; patch: (teil: string, ops: Op[]) => Promise<boolean>; melde: (art: 'ok' | 'fehler' | 'info', titel: string, text?: string) => void }
const klein = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: '4px 6px' } as const;

export function Schulden({ h, patch, melde }: Props) {
  const heute = heuteBerlin();
  const liste = h.schulden.filter(s => s.einheit === 'privat');
  const rest = liste.reduce((s, x) => s + x.restbetrag, 0), rate = liste.reduce((s, x) => s + (x.rate ?? 0), 0), start = liste.reduce((s, x) => s + x.startbetrag, 0);
  let laengste = 0, unklar = false;
  for (const x of liste) { const l = laufzeit(x.restbetrag, x.rate, x.zinssatz); if (l.monate === null) unklar = true; else laengste = Math.max(laengste, l.monate); }
  const faellig = liste.filter(x => x.naechste_faelligkeit && x.naechste_faelligkeit <= heute);
  const [form, setForm] = useState<Partial<Schuld> | null>(null);
  const [sonder, setSonder] = useState<Schuld | null>(null);
  const [loesch, setLoesch] = useState<{ teil: 'schulden' | 'belege'; id: string; stand: number; text: string } | null>(null);
  const [belegForm, setBelegForm] = useState<Partial<Beleg> | null>(null);
  const [erledigte, setErledigte] = useState(false);

  const belege = h.belege.filter(b => b.einheit === 'privat');
  const anderswo = h.belege.filter(b => b.einheit !== 'privat' && !b.erledigt).length;
  const rechnungen = useMemo(() => belege.filter(b => b.art === 'rechnung' && (erledigte || !b.erledigt)).sort(sortierung), [belege, erledigte]);
  const offeneR = belege.filter(b => b.art === 'rechnung' && !b.erledigt);
  const ueber = offeneR.filter(b => b.faellig_am && b.faellig_am < heute);
  const woche = offeneR.filter(b => b.faellig_am && b.faellig_am >= heute && b.faellig_am <= tagPlus(heute, 7));
  const fehlend = belege.filter(b => b.art === 'beleg' && (erledigte || !b.erledigt)).sort(sortierung);
  const summe = (l: Beleg[]) => l.reduce((s, b) => s + (b.betrag ?? 0), 0);

  return (
    <>
      <Spalten verhaeltnis="1:1">
        <Spalte>
          <Karte i={1} akzent={faellig.length ? LEUCHT.kritisch : undefined}>
            <Ueberschrift farbe={LEUCHT.kritisch} rechts={<Knopf leise onClick={() => setForm({ einheit: 'privat' })}>Neue Schuld</Knopf>}>Schulden</Ueberschrift>
            <Kacheln>
              <Kachel titel="Restschuld" wert={eur(rest)} zusatz={`${liste.length} Verbindlichkeiten`} />
              <Kachel titel="Monatliche Rate" wert={eur(rate)} zusatz="über alle" />
              <Kachel titel="Bereits getilgt" wert={eur(start - rest)} zusatz={start > 0 ? `${Math.round((start - rest) / start * 100)} % der Ursprungssumme` : '–'} />
              <Kachel titel="Schuldenfrei" wert={unklar ? 'unklar' : schuldenfreiAm(laengste, heute)} zusatz={unklar ? 'mindestens eine Rate fehlt oder ist zu niedrig' : 'bei gleichbleibender Rate'} />
            </Kacheln>
            {faellig.length > 0 && <div style={{ color: LEUCHT.kritisch, marginTop: 12, fontSize: TYP.body }}>{faellig.length} Zahlung{faellig.length > 1 ? 'en' : ''} fällig: {faellig.map(x => `${x.bezeichnung} (${datumDe(x.naechste_faelligkeit)})`).join(' · ')}</div>}
            <div style={{ marginTop: 10 }}>
              {!liste.length && <Leer>Noch keine Schulden erfasst.</Leer>}
              {liste.map(x => {
                const l = laufzeit(x.restbetrag, x.rate, x.zinssatz);
                const anteil = x.startbetrag > 0 ? (1 - x.restbetrag / x.startbetrag) * 100 : 0;
                return (
                  <div key={x.id} style={{ padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}><strong>{x.bezeichnung}</strong> <span style={{ fontSize: 12, color: C.inkLeise }}>{x.glaeubiger ?? ''}</span></div>
                      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{eur(x.restbetrag)} <span style={{ color: C.inkLeise, fontSize: 12 }}>von {eur(x.startbetrag)}</span></span>
                    </div>
                    <Leiste anteil={anteil} farbe={LEUCHT.gut} />
                    <div style={{ fontSize: 12.5, color: C.inkDim, marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>Rate {eur(x.rate)}</span>{x.zinssatz ? <span>{x.zinssatz.toLocaleString('de-DE')} % Zins</span> : null}
                      {x.naechste_faelligkeit && <span style={{ color: x.naechste_faelligkeit <= heute ? LEUCHT.kritisch : undefined }}>fällig {datumDe(x.naechste_faelligkeit)}</span>}
                      <span style={{ color: l.monate === null ? LEUCHT.achtung : undefined }}>{l.monate === null ? l.grund : `${l.monate} Monate · bis ${schuldenfreiAm(l.monate, heute)}`}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <button style={klein} onClick={() => setSonder(x)}>Sondertilgung</button>
                      <button style={klein} onClick={() => setForm(x)}>Bearbeiten</button>
                      <button style={{ ...klein, color: LEUCHT.kritisch }} onClick={() => setLoesch({ teil: 'schulden', id: x.id, stand: x.stand, text: `„${x.bezeichnung}“` })}>Löschen</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Karte>
        </Spalte>
        <Spalte>
          <Karte i={2} akzent={ueber.length ? LEUCHT.kritisch : undefined}>
            <Ueberschrift farbe={LEUCHT.achtung} rechts={<Knopf leise onClick={() => setBelegForm({ art: 'rechnung', einheit: 'privat' })}>Neue Rechnung</Knopf>}>Offene Rechnungen</Ueberschrift>
            <Kacheln>
              <Kachel titel="Offen gesamt" wert={eur(summe(offeneR))} zusatz={`${offeneR.length} Rechnung${offeneR.length === 1 ? '' : 'en'}${offeneR.some(b => !b.betrag) ? ' · einige ohne Betrag' : ''}`} />
              <Kachel titel="Überfällig" wert={eur(summe(ueber))} farbe={ueber.length ? LEUCHT.kritisch : undefined} zusatz={ueber.length ? `${ueber.length} sofort kümmern` : 'nichts überfällig'} />
              <Kachel titel="Diese Woche" wert={eur(summe(woche))} zusatz={`${woche.length} in den nächsten 7 Tagen`} />
            </Kacheln>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.inkDim, margin: '12px 0 4px' }}><input type="checkbox" checked={erledigte} onChange={e => setErledigte(e.target.checked)} /> auch bezahlte zeigen</label>
            {!rechnungen.length && <Leer>Keine offenen Rechnungen. Alles bezahlt.</Leer>}
            {rechnungen.map(b => {
              const spaet = !b.erledigt && b.faellig_am && b.faellig_am < heute;
              return (
                <div key={b.id} style={{ padding: '9px 2px', borderBottom: '1px solid rgba(255,255,255,.06)', opacity: b.erledigt ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}><strong>{b.empfaenger || '–'}</strong> <span style={{ fontSize: 12.5, color: C.inkDim }}>{b.bezeichnung}</span></div>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: b.betrag ? C.ink : LEUCHT.achtung }}>{b.betrag ? eur(b.betrag) : 'Betrag fehlt'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: spaet ? LEUCHT.kritisch : C.inkDim, marginTop: 4 }}>
                    <span>{b.faellig_am ? `fällig ${datumDe(b.faellig_am)}${spaet ? ' · überfällig' : ''}` : 'ohne Fälligkeit'}</span>{b.verursacher && <span>· {b.verursacher}</span>}
                    {b.erledigt ? <Chip farbe={LEUCHT.gut}>bezahlt {datumDe(b.bezahlt_am)}</Chip> : null}
                    <span style={{ flex: 1 }} />
                    <button style={klein} onClick={() => void patch('belege', [{ op: 'upsert', stand: b.stand, eintrag: { ...b, erledigt: !b.erledigt, bezahlt_am: b.erledigt ? null : heute } }]).then(ok => ok && melde('ok', b.erledigt ? 'Wieder offen' : 'Als bezahlt vermerkt', b.empfaenger || b.bezeichnung))}>{b.erledigt ? 'Doch nicht' : 'Bezahlt'}</button>
                    <button style={klein} onClick={() => setBelegForm(b)}>Bearbeiten</button>
                    <button style={{ ...klein, color: LEUCHT.kritisch }} onClick={() => setLoesch({ teil: 'belege', id: b.id, stand: b.stand, text: `„${b.bezeichnung}“` })}>Löschen</button>
                  </div>
                </div>
              );
            })}
          </Karte>
          <Karte i={3}>
            <Ueberschrift rechts={<Knopf leise onClick={() => setBelegForm({ art: 'beleg', einheit: 'privat' })}>Beleg nachhalten</Knopf>}>Fehlende Belege</Ueberschrift>
            <div style={{ fontSize: 13, color: C.inkDim, marginBottom: 6 }}>Quittungen, die noch fehlen. Kein Geldfluss — nur Papier.</div>
            {!fehlend.length && <Leer>Nichts offen.</Leer>}
            {fehlend.map(b => (
              <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 2px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <input type="checkbox" aria-label="erledigt" checked={b.erledigt} onChange={e => void patch('belege', [{ op: 'upsert', stand: b.stand, eintrag: { ...b, erledigt: e.target.checked } }])} />
                <span style={{ flex: 1, textDecoration: b.erledigt ? 'line-through' : undefined, color: b.erledigt ? C.inkLeise : C.ink }}>{b.bezeichnung}</span>
                <span style={{ fontSize: 12.5, color: b.faellig_am && b.faellig_am < heute ? LEUCHT.kritisch : C.inkDim }}>{datumDe(b.faellig_am)}</span>
                <button style={klein} onClick={() => setBelegForm(b)}>Bearbeiten</button>
              </div>
            ))}
            {anderswo > 0 && <Hinweis>{anderswo} weitere offene Rechnung{anderswo === 1 ? '' : 'en'} oder Belege gehören zur Selbstständigkeit oder UG — die stehen unter Business.</Hinweis>}
          </Karte>
        </Spalte>
      </Spalten>
      {form && <SchuldForm s={form} patch={patch} melde={melde} onZu={() => setForm(null)} />}
      {sonder && <SonderDialog s={sonder} patch={patch} melde={melde} onZu={() => setSonder(null)} />}
      {belegForm && <BelegForm b={belegForm} patch={patch} melde={melde} onZu={() => setBelegForm(null)} />}
      {loesch && (
        <Dialog titel="Wirklich löschen?" onZu={() => setLoesch(null)} aktionen={<Knopf farbe={LEUCHT.kritisch} onClick={async () => { const ok = await patch(loesch.teil, [{ op: 'delete', id: loesch.id, stand: loesch.stand }]); if (ok) melde('ok', 'Gelöscht'); setLoesch(null); }}>Ja, löschen</Knopf>}>
          <div>{loesch.text} wirklich löschen? Das lässt sich nicht rückgängig machen.</div>
        </Dialog>
      )}
    </>
  );
}

function sortierung(a: Beleg, b: Beleg) {
  if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
  if (!a.faellig_am) return 1;
  if (!b.faellig_am) return -1;
  return a.faellig_am.localeCompare(b.faellig_am);
}

const euroText = (c: number | null | undefined) => (c === null || c === undefined ? '' : String(c / 100).replace('.', ','));

function SchuldForm({ s, patch, melde, onZu }: { s: Partial<Schuld>; patch: Props['patch']; melde: Props['melde']; onZu: () => void }) {
  const [e, setE] = useState({ bezeichnung: s.bezeichnung ?? '', glaeubiger: s.glaeubiger ?? '', start: euroText(s.startbetrag), rest: euroText(s.restbetrag), rate: euroText(s.rate), zins: s.zinssatz ? String(s.zinssatz).replace('.', ',') : '', faellig: s.naechste_faelligkeit ?? '' });
  return (
    <Dialog titel={s.id ? 'Schuld bearbeiten' : 'Neue Schuld'} onZu={onZu} aktionen={<Knopf farbe={LEUCHT.kritisch} onClick={async () => {
      if (!e.bezeichnung.trim()) { melde('fehler', 'Bezeichnung fehlt'); return; }
      const eintrag = { ...s, einheit: s.einheit ?? 'privat', bezeichnung: e.bezeichnung, glaeubiger: e.glaeubiger || null, startbetrag: zuCent(e.start) ?? 0, restbetrag: zuCent(e.rest) ?? 0, rate: zuCent(e.rate), zinssatz: e.zins ? Number(e.zins.replace(',', '.')) : null, naechste_faelligkeit: e.faellig || null };
      if (await patch('schulden', [{ op: 'upsert', stand: s.stand, eintrag }])) { melde('ok', 'Gespeichert'); onZu(); }
    }}>Speichern</Knopf>}>
      <Feld label="Bezeichnung"><input value={e.bezeichnung} onChange={x => setE({ ...e, bezeichnung: x.target.value })} style={feld} /></Feld>
      <Feld label="Gläubiger"><input value={e.glaeubiger} onChange={x => setE({ ...e, glaeubiger: x.target.value })} style={feld} /></Feld>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Feld label="Ursprungsbetrag"><input inputMode="decimal" value={e.start} onChange={x => setE({ ...e, start: x.target.value })} style={feld} /></Feld>
        <Feld label="Restbetrag"><input inputMode="decimal" value={e.rest} onChange={x => setE({ ...e, rest: x.target.value })} style={feld} /></Feld>
        <Feld label="Monatsrate"><input inputMode="decimal" value={e.rate} onChange={x => setE({ ...e, rate: x.target.value })} style={feld} /></Feld>
        <Feld label="Zinssatz % p. a."><input inputMode="decimal" value={e.zins} onChange={x => setE({ ...e, zins: x.target.value })} style={feld} /></Feld>
      </div>
      <Feld label="Nächste Fälligkeit"><input type="date" value={e.faellig} onChange={x => setE({ ...e, faellig: x.target.value })} style={feld} /></Feld>
    </Dialog>
  );
}

function SonderDialog({ s, patch, melde, onZu }: { s: Schuld; patch: Props['patch']; melde: Props['melde']; onZu: () => void }) {
  const [betrag, setBetrag] = useState('1000');
  const cent = zuCent(betrag) ?? 0;
  const r = sondertilgung(s.restbetrag, s.rate, s.zinssatz, cent);
  return (
    <Dialog titel={`Sondertilgung bei „${s.bezeichnung}“`} onZu={onZu} aktionen={<Knopf farbe={LEUCHT.gut} onClick={async () => {
      if (await patch('schulden', [{ op: 'upsert', stand: s.stand, eintrag: { ...s, restbetrag: Math.max(0, s.restbetrag - cent) } }])) { melde('ok', 'Übernommen', `Neuer Restbetrag: ${eur(Math.max(0, s.restbetrag - cent))}`); onZu(); }
    }}>Übernehmen</Knopf>}>
      <Feld label="Betrag der Sondertilgung"><input inputMode="decimal" value={betrag} onChange={e => setBetrag(e.target.value)} style={feld} /></Feld>
      {r ? (
        <div style={{ display: 'grid', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
          <div>Restschuld: <strong>{eur(s.restbetrag)}</strong> → <strong>{eur(r.neuRest)}</strong></div>
          <div>Laufzeit: <strong style={{ color: LEUCHT.gut }}>{r.monateFrueher} Monate früher fertig</strong></div>
          <div>Zinsen gespart: <strong style={{ color: LEUCHT.gut }}>{eur(r.zinsenGespart)}</strong></div>
        </div>
      ) : <div style={{ color: LEUCHT.achtung }}>Nicht berechenbar — Rate oder Zinssatz fehlen.</div>}
      <div style={{ fontSize: 12.5, color: C.inkLeise }}>Zum Rechnen genügt die Eingabe. Erst „Übernehmen“ ändert den Restbetrag.</div>
    </Dialog>
  );
}

function BelegForm({ b, patch, melde, onZu }: { b: Partial<Beleg>; patch: Props['patch']; melde: Props['melde']; onZu: () => void }) {
  const rechnung = b.art === 'rechnung';
  const [e, setE] = useState({ empfaenger: b.empfaenger ?? '', bezeichnung: b.bezeichnung ?? '', betrag: euroText(b.betrag), faellig: b.faellig_am ?? '', verursacher: b.verursacher ?? '', einheit: b.einheit ?? 'privat', notiz: b.notiz ?? '' });
  return (
    <Dialog titel={b.id ? (rechnung ? 'Rechnung bearbeiten' : 'Beleg bearbeiten') : rechnung ? 'Neue offene Rechnung' : 'Fehlenden Beleg nachhalten'} onZu={onZu} aktionen={<Knopf farbe={LEUCHT.achtung} onClick={async () => {
      if (!e.bezeichnung.trim()) { melde('fehler', 'Bezeichnung fehlt', 'Ohne Beschreibung weißt du in drei Wochen nicht mehr, worum es ging.'); return; }
      const betrag = e.betrag.trim() === '' ? null : zuCent(e.betrag);
      if (e.betrag.trim() !== '' && betrag === null) { melde('fehler', 'Betrag ist keine Zahl'); return; }
      const eintrag = { ...b, art: b.art ?? 'beleg', bezeichnung: e.bezeichnung, empfaenger: e.empfaenger || null, betrag, faellig_am: e.faellig || null, verursacher: e.verursacher || null, einheit: e.einheit, notiz: e.notiz || null, erledigt: b.erledigt ?? false };
      if (await patch('belege', [{ op: 'upsert', stand: b.stand, eintrag }])) { melde('ok', 'Gespeichert'); onZu(); }
    }}>Speichern</Knopf>}>
      {rechnung && <Feld label="An wen geht das Geld?"><input value={e.empfaenger} onChange={x => setE({ ...e, empfaenger: x.target.value })} placeholder="z. B. Stadtwerke, Finanzamt, Handwerker" style={feld} /></Feld>}
      <Feld label={rechnung ? 'Wofür?' : 'Welcher Beleg fehlt?'}><input value={e.bezeichnung} onChange={x => setE({ ...e, bezeichnung: x.target.value })} style={feld} /></Feld>
      <div style={{ display: 'grid', gridTemplateColumns: rechnung ? '1fr 1fr' : '1fr', gap: 10 }}>
        {rechnung && <Feld label="Betrag"><input inputMode="decimal" value={e.betrag} onChange={x => setE({ ...e, betrag: x.target.value })} style={feld} /></Feld>}
        <Feld label="Fällig am"><input type="date" value={e.faellig} onChange={x => setE({ ...e, faellig: x.target.value })} style={feld} /></Feld>
      </div>
      <Feld label="Welche Einheit?"><select value={e.einheit} onChange={x => setE({ ...e, einheit: x.target.value as Beleg['einheit'] })} style={auswahl}><option value="privat">Privat</option><option value="selbststaendigkeit">Kevins Selbstständigkeit</option><option value="ug">KD Management UG</option></select></Feld>
      <Feld label="Wer kümmert sich?"><input value={e.verursacher} onChange={x => setE({ ...e, verursacher: x.target.value })} placeholder="Kevin / Malin" style={feld} /></Feld>
      {rechnung && <Feld label="Notiz"><input value={e.notiz} onChange={x => setE({ ...e, notiz: x.target.value })} style={feld} /></Feld>}
    </Dialog>
  );
}
