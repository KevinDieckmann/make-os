'use client';

// ─── Markttraktion · Sales › Pipeline — Chancen nach Stufen ───────────────────────────────────
// Oben die Prognose (offen, gewichtet, Commit, Best Case) — jede Zahl mit
// Herleitung. Darunter die Stufen mit ihrem Austrittskriterium: Eine Chance
// rückt vor, wenn auf Kundenseite etwas passiert ist, nicht wenn wir hoffen.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Raster, useBreit, LEUCHT } from '../schlank';
import { anzeigename } from '@/lib/make-one/crm';
import { gesamtwert, VERLUSTGRUENDE } from '@/lib/crm/pipeline';
import type { Chance, ChancenStufe, Qual } from '@/lib/crm/typen';
import { type CrmApi, neueId, datum, euro, kurzEuro, plusTage } from './daten';
import { Feldzeile, Pillen, Feld } from './teile';
import { HeadPanel } from './HeadPanel';

const AMPEL = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;
const ARTEN = [{ id: 'retainer', label: 'Retainer' }, { id: 'projekt', label: 'Projekt' }, { id: 'workshop', label: 'Workshop' }, { id: 'vermittlung', label: 'Vermittlung' }, { id: 'software', label: 'Software' }] as const;
const QUELLEN = [{ id: 'empfehlung', label: 'Empfehlung' }, { id: 'event', label: 'Event' }, { id: 'content', label: 'Content' }, { id: 'outreach', label: 'Ansprache' }, { id: 'bestand', label: 'Bestand' }, { id: 'inbound', label: 'Anfrage' }] as const;
const QUAL: { id: keyof Chance['qualifizierung']; label: string }[] = [
  { id: 'schmerz', label: 'Schmerz' }, { id: 'entscheider', label: 'Entscheider' }, { id: 'budget', label: 'Budget' }, { id: 'zeitpunkt', label: 'Zeitpunkt' }, { id: 'wirkung', label: 'Wirkung' }, { id: 'alternative', label: 'Alternative' },
];
const GES = [{ id: 'kdc', label: 'Selbstständigkeit' }, { id: 'kdv', label: 'KD Ventures' }, { id: 'ug', label: 'Neue UG' }, { id: 'offen', label: 'offen' }] as const;

export function Pipeline({ api, zuKontakt }: { api: CrmApi; zuKontakt: (id: string) => void }) {
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const breit = useBreit();
  const [board, setBoard] = useState(true);
  const [alleVorschlaege, setAlleVorschlaege] = useState(false);
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const p = crm.prognose;
  const offen = crm.stufen.filter(s => s.offen);
  const neu = () => { const id = neueId('ch'); void api.setze('chancen', { id, titel: 'Neue Chance', kontaktIds: [], art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'qualifiziert', historie: [], qualifizierung: {}, gesellschaft: 'offen', besitzer: 'kevin', angelegt: new Date().toISOString() }); setAuswahl(id); };
  const zu = crm.stand.chancen.filter(c => !offen.some(s => s.id === c.stufe));
  // Aus der Kartei: wer laut Masterdatei im Gespräch ist oder ein Angebot hat, aber noch keine Chance.
  const mitChance = new Set(crm.stand.chancen.flatMap(c => c.kontaktIds));
  const vorschlaege = (api.kontakte ?? []).filter(k => ['gespraech', 'termin', 'angebot'].includes(k.stufe) && !mitChance.has(k.id) && !k.werbesperre)
    .sort((a, b) => (a.stufe === 'angebot' ? 0 : 1) - (b.stufe === 'angebot' ? 0 : 1));
  const ausKontakt = (k: NonNullable<CrmApi['kontakte']>[number]) => { const id = neueId('ch'); void api.setze('chancen', { id, titel: k.firma ? `${k.firma}` : anzeigename(k), kontaktIds: [k.id], ...(k.firma ? { firma: k.firma } : {}), art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: k.stufe === 'angebot' ? 'angebot' : 'qualifiziert', historie: [], qualifizierung: {}, quelle: 'bestand', gesellschaft: 'offen', besitzer: 'kevin', angelegt: new Date().toISOString() }); setAuswahl(id); };

  return (
    <>
      <HeadPanel head="sales" standardModus="deal_review" zuKontakt={zuKontakt} i={0} nachEntscheid={() => void api.laden()} />
      <Karte i={0}>
        <Ueberschrift rechts={<Knopf onClick={neu}>+ Chance</Knopf>}>Prognose</Ueberschrift>
        <Raster min={150}>
          <Zahl wert={kurzEuro(p.offen)} label="offen" />
          <Zahl wert={kurzEuro(p.gewichtet)} label="gewichtet" farbe={LEUCHT.business} />
          <Zahl wert={kurzEuro(p.commit)} label="Commit · Abschluss" farbe={LEUCHT.gut} />
          <Zahl wert={kurzEuro(p.bestCase)} label="Best Case · ab Angebot" />
          <Zahl wert={String(p.ohneSchritt)} label="ohne nächsten Schritt" farbe={p.ohneSchritt ? LEUCHT.achtung : undefined} />
          <Zahl wert={crm.gewinnquote.quote !== null ? `${crm.gewinnquote.quote} %` : `${crm.gewinnquote.gewonnen} · ${crm.gewinnquote.verloren}`} label={crm.gewinnquote.quote !== null ? 'Gewinnquote ab Angebot' : 'gewonnen · verloren (Quote ab 10)'} />
        </Raster>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 10 }}>Wert = Monatshonorar × Laufzeit (ohne Angabe 12 Monate), gewichtet mit der Stufen-Wahrscheinlichkeit. Die Wahrscheinlichkeiten sind vorsichtige Startwerte und werden durch gemessene Quoten ersetzt.</div>
      </Karte>

      {breit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Pillen liste={[{ id: 'board', label: 'Board' }, { id: 'liste', label: 'Liste' }]} aktiv={board ? 'board' : 'liste'} onWahl={x => setBoard(x === 'board')} /></div>
      )}

      {breit && board && (() => {
        const sel = auswahl ? crm.stand.chancen.find(c => c.id === auswahl) : null;
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${offen.length}, minmax(0, 1fr))`, gap: 12, alignItems: 'start' }}>
              {offen.map(s => {
                const l = crm.stand.chancen.filter(c => c.stufe === s.id);
                const js = p.jeStufe.find(x => x.stufe === s.id);
                return (
                  <div key={s.id} style={{ background: 'rgba(255,255,255,.025)', borderRadius: 14, padding: 10, minHeight: 160 }}>
                    <div title={`Weiter, wenn: ${s.weiterWenn}`} style={{ padding: '2px 4px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkDim }}><span>{s.label}</span><span style={{ color: C.inkLeise }}>{s.p} %</span></div>
                      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 2 }}>{l.length} · {kurzEuro(js?.wert ?? 0)}{js?.haengt ? <span style={{ color: LEUCHT.kritisch }}> · {js.haengt} hängt</span> : null}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {l.map(c => {
                        const a = crm.ampel[c.id];
                        return (
                          <button key={c.id} onClick={() => setAuswahl(auswahl === c.id ? null : c.id)} className="fassbar" style={{ textAlign: 'left', cursor: 'pointer', border: `1px solid ${auswahl === c.id ? LEUCHT.business : 'rgba(255,255,255,.06)'}`, borderLeft: `3px solid ${a ? AMPEL[a.ampel] : C.inkLeise}`, background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '9px 10px', color: C.ink, display: 'grid', gap: 3 }}>
                            <span style={{ fontSize: TYP.bedien, fontWeight: 600, lineHeight: 1.3 }}>{c.titel}</span>
                            {c.firma && c.firma !== c.titel && <span style={{ fontSize: 12, color: C.inkLeise }}>{c.firma}</span>}
                            <span style={{ fontSize: 12, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{c.wert.betrag ? `${euro(c.wert.betrag)}${c.wert.basis === 'monat' ? '/M' : c.wert.basis === 'jahr' ? '/J' : ''}` : 'ohne Wert'}</span>
                            <span style={{ fontSize: 11.5, color: c.naechsterSchritt && c.naechsterSchritt.datum < crm.heute ? LEUCHT.kritisch : C.inkLeise }}>{c.naechsterSchritt ? `→ ${datum(c.naechsterSchritt.datum, crm.heute)}` : 'kein nächster Schritt'}</span>
                          </button>
                        );
                      })}
                      {!l.length && <div style={{ fontSize: 12, color: C.inkLeise, padding: '4px' }}>—</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            {sel && offen.some(s => s.id === sel.stufe) && (
              <Karte i={2} akzent={LEUCHT.business}>
                <Ueberschrift rechts={<button onClick={() => setAuswahl(null)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 14 }}>✕</button>}>{sel.titel}</Ueberschrift>
                <ChancenDetail c={sel} api={api} personen={sel.kontaktIds.map(id => (api.kontakte ?? []).find(k => k.id === id)).filter((k): k is NonNullable<typeof k> => !!k)} zuKontakt={zuKontakt} />
              </Karte>
            )}
          </>
        );
      })()}

      {(!breit || !board) && offen.map((s, i) => {
        const l = crm.stand.chancen.filter(c => c.stufe === s.id);
        const js = p.jeStufe.find(x => x.stufe === s.id);
        return (
          <Karte key={s.id} i={i + 1}>
            <Ueberschrift rechts={`${s.p} % · ${l.length} · ${kurzEuro(js?.wert ?? 0)}${js?.haengt ? ` · ${js.haengt} hängt` : ''}`}>{s.label}</Ueberschrift>
            <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Weiter, wenn: {s.weiterWenn}</div>
            <Liste>
              {l.map(c => <ChancenZeile key={c.id} c={c} api={api} offen={auswahl === c.id} onKlick={() => setAuswahl(auswahl === c.id ? null : c.id)} zuKontakt={zuKontakt} />)}
            </Liste>
            {!l.length && <div style={{ fontSize: 12.5, color: C.inkLeise, padding: '6px 0' }}>Keine Chance in dieser Stufe.</div>}
          </Karte>
        );
      })}

      {vorschlaege.length > 0 && (
        <Karte i={1}>
          <Ueberschrift rechts={`${vorschlaege.length} aus der Kartei`}>Noch ohne Chance</Ueberschrift>
          <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Laut Masterdatei im Gespräch oder mit Angebot — als Chance anlegen, dann Wert und nächsten Schritt eintragen.</div>
          <Liste>
            {vorschlaege.slice(0, alleVorschlaege ? 40 : 6).map(k => <Zeile key={k.id} titel={<>{anzeigename(k)}{k.firma && <span style={{ color: C.inkLeise }}> · {k.firma}</span>}</>} unter={k.stufe === 'angebot' ? 'Angebot' : k.stufe === 'termin' ? 'Termin' : 'im Gespräch'} rechts={<Knopf leise onClick={() => ausKontakt(k)}>+ Chance</Knopf>} />)}
          </Liste>
          {vorschlaege.length > 6 && <button onClick={() => setAlleVorschlaege(!alleVorschlaege)} style={{ marginTop: 8, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>{alleVorschlaege ? 'weniger' : `alle ${vorschlaege.length} zeigen`}</button>}
        </Karte>
      )}

      <Karte i={7}>
        <Ueberschrift rechts={<button onClick={() => setGeschlossen(!geschlossen)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>{geschlossen ? 'ausblenden' : `${zu.length} zeigen`}</button>}>Gewonnen · Verloren · Geparkt</Ueberschrift>
        {geschlossen && <Liste>{zu.map(c => <ChancenZeile key={c.id} c={c} api={api} offen={auswahl === c.id} onKlick={() => setAuswahl(auswahl === c.id ? null : c.id)} zuKontakt={zuKontakt} />)}</Liste>}
      </Karte>
    </>
  );
}

function ChancenZeile({ c, api, offen, onKlick, zuKontakt }: { c: Chance; api: CrmApi; offen: boolean; onKlick: () => void; zuKontakt: (id: string) => void }) {
  const crm = api.crm!;
  const a = crm.ampel[c.id];
  const kontakte = api.kontakte ?? [];
  const personen = c.kontaktIds.map(id => kontakte.find(k => k.id === id)).filter(Boolean);
  return (
    <div>
      <Zeile onClick={onKlick} aktiv={offen} links={<Punkt farbe={a ? AMPEL[a.ampel] : C.inkLeise} />}
        titel={<>{c.titel}{c.firma && <span style={{ color: C.inkLeise }}> · {c.firma}</span>}</>}
        unter={[c.naechsterSchritt ? `→ ${c.naechsterSchritt.text} · ${datum(c.naechsterSchritt.datum, crm.heute)}` : 'kein nächster Schritt', a?.gruende[0]].filter(Boolean).join(' · ')}
        rechts={<span style={{ fontVariantNumeric: 'tabular-nums', fontSize: TYP.bedien, color: C.inkDim }}>{c.wert.betrag ? `${euro(c.wert.betrag)}${c.wert.basis === 'monat' ? '/M' : c.wert.basis === 'jahr' ? '/J' : ''}` : '—'}</span>} />
      {offen && <ChancenDetail c={c} api={api} personen={personen as NonNullable<typeof personen[number]>[]} zuKontakt={zuKontakt} />}
    </div>
  );
}

function ChancenDetail({ c, api, personen, zuKontakt }: { c: Chance; api: CrmApi; personen: NonNullable<CrmApi['kontakte']>; zuKontakt: (id: string) => void }) {
  const crm = api.crm!;
  const [wechsel, setWechsel] = useState<{ ziel: ChancenStufe; grund: string; wiedervorlage: string } | null>(null);
  const [suche, setSuche] = useState('');
  const setze = (teil: Partial<Chance>) => api.setze('chancen', { ...c, ...teil } as unknown as { id: string } & Record<string, unknown>);
  const wechsle = (ziel: ChancenStufe, extra: { grund?: string; wiedervorlage?: string } = {}) => {
    if (ziel === 'verloren' && !extra.grund) return setWechsel({ ziel, grund: '', wiedervorlage: '' });
    if (ziel === 'geparkt' && !extra.wiedervorlage) return setWechsel({ ziel, grund: '', wiedervorlage: plusTage(crm.heute, 60) });
    const jetzt = new Date().toISOString();
    void setze({ stufe: ziel, historie: [...c.historie, { stufe: ziel, am: jetzt, von: '' /* der Server trägt die angemeldete Person ein */ }], letzteAktivitaet: jetzt.slice(0, 10), ...(extra.grund ? { grund: extra.grund } : {}), ...(extra.wiedervorlage ? { wiedervorlage: extra.wiedervorlage } : {}) });
    setWechsel(null);
  };
  const treffer = suche.trim().length >= 2 ? (api.kontakte ?? []).filter(k => `${anzeigename(k)} ${k.firma ?? ''}`.toLowerCase().includes(suche.toLowerCase())).slice(0, 6) : [];

  return (
    <div style={{ padding: '10px 2px 18px', display: 'grid', gap: 12, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Stufe</div>
        <Pillen liste={crm.stufen.map(s => ({ id: s.id, label: s.label }))} aktiv={c.stufe} onWahl={wechsle} farbe={LEUCHT.business} />
        {wechsel && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
            {wechsel.ziel === 'verloren'
              ? <Pillen liste={VERLUSTGRUENDE.map(g => ({ id: g, label: g }))} aktiv={wechsel.grund} onWahl={grund => wechsle('verloren', { grund })} farbe={LEUCHT.kritisch} />
              : <><input type="date" value={wechsel.wiedervorlage} onChange={e => setWechsel({ ...wechsel, wiedervorlage: e.target.value })} aria-label="Wiedervorlage" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '7px 10px', color: C.ink }} /><Knopf onClick={() => wechsle('geparkt', { wiedervorlage: wechsel.wiedervorlage })}>Parken bis dahin</Knopf></>}
            <Knopf leise onClick={() => setWechsel(null)}>Abbrechen</Knopf>
          </div>
        )}
        {c.historie.length > 1 && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>{c.historie.map(h => `${crm.stufen.find(s => s.id === h.stufe)?.label} ${datum(h.am)}`).join(' → ')}</div>}
      </div>
      <Feldzeile label="Titel"><Feld wert={c.titel} onFertig={titel => titel.trim() && setze({ titel: titel.trim() })} /></Feldzeile>
      <Feldzeile label="Firma"><Feld wert={c.firma} onFertig={firma => setze({ firma: firma || undefined })} /></Feldzeile>
      <Feldzeile label="Art"><Pillen liste={[...ARTEN]} aktiv={c.art} onWahl={art => setze({ art })} /></Feldzeile>
      <Feldzeile label="Wert">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Feld typ="number" wert={c.wert.betrag ? String(c.wert.betrag) : ''} breite={120} platzhalter="Betrag €" onFertig={b => setze({ wert: { ...c.wert, betrag: Number(b) || 0 } })} />
          <Pillen liste={[{ id: 'monat', label: 'je Monat' }, { id: 'jahr', label: 'je Jahr' }, { id: 'einmalig', label: 'einmalig' }]} aktiv={c.wert.basis} onWahl={basis => setze({ wert: { ...c.wert, basis } })} />
          {c.wert.basis !== 'einmalig' && <Feld typ="number" wert={c.wert.laufzeitMonate ? String(c.wert.laufzeitMonate) : ''} breite={110} platzhalter="Monate" onFertig={m => setze({ wert: { ...c.wert, laufzeitMonate: Number(m) || undefined } })} />}
          <span style={{ fontSize: 12.5, color: C.inkLeise }}>= {euro(gesamtwert(c))}</span>
        </div>
      </Feldzeile>
      <Feldzeile label="Nächster Schritt">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><Feld wert={c.naechsterSchritt?.text} platzhalter="Was als Nächstes passiert" onFertig={text => setze({ naechsterSchritt: text.trim() ? { text: text.trim(), datum: c.naechsterSchritt?.datum ?? plusTage(crm.heute, 3) } : undefined })} /></div>
          <Feld typ="date" wert={c.naechsterSchritt?.datum} breite={150} platzhalter="Datum" onFertig={d2 => c.naechsterSchritt && setze({ naechsterSchritt: { ...c.naechsterSchritt, datum: d2 } })} />
        </div>
      </Feldzeile>
      <Feldzeile label="Entscheidung bis"><Feld typ="date" wert={c.erwartetAm} breite={160} platzhalter="Datum" onFertig={erwartetAm => setze({ erwartetAm: erwartetAm || undefined })} /></Feldzeile>
      <div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Qualifizierung — was noch unklar ist, ist die nächste Frage</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {QUAL.map(q => (
            <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: C.inkDim }}>{q.label}</span>
              <Pillen liste={[{ id: 'ja', label: 'ja' }, { id: 'unklar', label: 'unklar' }, { id: 'nein', label: 'nein' }]} aktiv={c.qualifizierung[q.id]} onWahl={(v: Qual) => setze({ qualifizierung: { ...c.qualifizierung, [q.id]: v } })}
                farbe={c.qualifizierung[q.id] === 'ja' ? LEUCHT.gut : c.qualifizierung[q.id] === 'nein' ? LEUCHT.kritisch : LEUCHT.achtung} />
            </div>
          ))}
        </div>
      </div>
      <Feldzeile label="Quelle"><Pillen liste={[...QUELLEN]} aktiv={c.quelle} onWahl={quelle => setze({ quelle })} /></Feldzeile>
      <Feldzeile label="Selbstauskunft"><Feld wert={c.selbstauskunft} platzhalter="„Wie sind Sie auf uns aufmerksam geworden?“" onFertig={s => setze({ selbstauskunft: s || undefined })} /></Feldzeile>
      <Feldzeile label="Gesellschaft"><Pillen liste={[...GES]} aktiv={c.gesellschaft} onWahl={gesellschaft => setze({ gesellschaft })} /></Feldzeile>
      <Feldzeile label="Personen">
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {personen.map(k => <span key={k.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><button onClick={() => zuKontakt(k.id)} style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 999, padding: '5px 10px', color: C.ink, cursor: 'pointer', fontSize: 12.5 }}>{anzeigename(k)}</button><button onClick={() => setze({ kontaktIds: c.kontaktIds.filter(x => x !== k.id) })} aria-label="Person entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>×</button></span>)}
          </div>
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Person hinzufügen …" aria-label="Person hinzufügen" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '7px 10px', color: C.ink, fontSize: TYP.bedien }} />
          {treffer.map(k => <button key={k.id} onClick={() => { void setze({ kontaktIds: Array.from(new Set([...c.kontaktIds, k.id])), ...(c.firma ? {} : k.firma ? { firma: k.firma } : {}) }); setSuche(''); }} style={{ textAlign: 'left', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: '3px 0' }}>+ {anzeigename(k)}{k.firma ? ` · ${k.firma}` : ''}</button>)}
        </div>
      </Feldzeile>
      <Feldzeile label="Notiz"><Feld wert={c.notiz} onFertig={notiz => setze({ notiz: notiz || undefined })} /></Feldzeile>
      {c.grund && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Grund: {c.grund}{c.wiedervorlage ? ` · Wiedervorlage ${datum(c.wiedervorlage)}` : ''}</div>}
      <div><button onClick={() => { if (window.confirm('Chance löschen? Besser: als verloren markieren — dann lernt die Pipeline.')) void api.weg('chancen', c.id); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>Löschen</button> {' '}<Chip farbe={C.inkLeise}>angelegt {datum(c.angelegt)}</Chip></div>
    </div>
  );
}
