'use client';

// ─── Paar-Gespräch — die Agenda als geführter Ablauf ────────────────────────
// Sechs Schritte, jeder mit Zeitbox (Berger „Marriage Meetings“, Gottman).
// Das Gespräch wird beim Start als Eintrag angelegt und nach jedem Schritt
// gespeichert — wer abbricht, macht später genau dort weiter.

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Liste, Zeile, Haken, LEUCHT } from '../schlank';
import { AGENDA } from '@/lib/familie/katalog';
import type { Gespraech as G } from '@/lib/familie/typen';
import { type FamilieApi, datumLang } from './daten';
import { Eingabe, Textfeld, Klein, Reihe, Symbol, Wahl } from './teile';

const ROSA = LEUCHT.beziehung;

function Uhr({ minuten, schritt }: { minuten: number; schritt: number }) {
  const [rest, setRest] = useState(minuten * 60);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { setRest(minuten * 60); setLaeuft(false); }, [minuten, schritt]);
  useEffect(() => {
    if (!laeuft) return;
    const t = setInterval(() => setRest(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [laeuft]);
  const mm = Math.floor(rest / 60), ss = rest % 60;
  return (
    <button onClick={() => setLaeuft(!laeuft)} className="fassbar" title={laeuft ? 'Anhalten' : 'Zeitbox starten'} style={{ background: 'rgba(255,255,255,.05)', border: `1px solid ${rest === 0 ? ROSA : 'rgba(255,255,255,.08)'}`, borderRadius: 10, padding: '6px 12px', color: rest === 0 ? ROSA : C.ink, fontVariantNumeric: 'tabular-nums', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
      {laeuft ? '❚❚' : '▶'} {mm}:{String(ss).padStart(2, '0')}
    </button>
  );
}

export function Gespraech({ api, onZu }: { api: FamilieApi; onZu: () => void }) {
  const d = api.d!;
  const f = d.familie;
  const ich = d.person;
  const [schritt, setSchritt] = useState(0);
  const [ende, setEnde] = useState(false);
  /** Meist sitzt ihr an einem Gerät — wer gerade spricht, wählt ihr hier. */
  const [sprecher, setSprecher] = useState(ich);

  // Laufendes Gespräch fortsetzen oder heute eines anlegen.
  const g: G = useMemo(() => d.gespraech.laufend ?? f.gespraeche.find(x => x.id === `g-${d.heute}`) ?? {
    id: `g-${d.heute}`, von: ich, am: '', datum: d.heute, status: 'geplant', wertschaetzungen: [], lief_gut: [], orga: [], themenIds: [], wuensche: [], schoeneZeit: '', businessGrenzeGehalten: null, notiz: '',
  }, [d.gespraech.laufend, f.gespraeche, d.heute, ich]);
  useEffect(() => { if (!f.gespraeche.some(x => x.id === g.id)) void api.setze('gespraeche', g); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aendere = (teil: Partial<G>) => api.setze('gespraeche', { ...g, ...teil });
  const a = AGENDA[schritt];
  const themen = f.themen.filter(t => t.hut === 'privat' && (t.status === 'offen' || t.status === 'geparkt' || g.themenIds.includes(t.id)));

  const Punkte = ({ liste, onNeu, onWeg, platz }: { liste: { von?: string; text: string }[]; onNeu: (t: string) => void; onWeg: (i: number) => void; platz: string }) => (
    <div style={{ display: 'grid', gap: 8 }}>
      {liste.map((x, i) => (
        <Reihe key={i}><span style={{ flex: 1, fontSize: TYP.body, lineHeight: 1.45 }}>{x.von && <b style={{ color: C.inkDim }}>{api.name(x.von)}: </b>}{x.text}</span><Symbol titel="Entfernen" onClick={() => onWeg(i)}>×</Symbol></Reihe>
      ))}
      <Eingabe leeren platzhalter={platz} onFertig={onNeu} />
    </div>
  );

  return (
    <Karte i={0} akzent={ROSA}>
      <Ueberschrift farbe={ROSA} rechts={<Symbol titel="Schließen" onClick={onZu}>✕</Symbol>}>Paar-Gespräch · {datumLang(g.datum)}</Ueberschrift>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {AGENDA.map((x, i) => (
          <button key={x.id} onClick={() => { setSchritt(i); setEnde(false); }} style={{ fontSize: 12, fontWeight: 600, padding: '6px 11px', borderRadius: 999, cursor: 'pointer', border: 'none', background: !ende && i === schritt ? ROSA : i < schritt || ende ? `${ROSA}22` : 'rgba(255,255,255,.05)', color: !ende && i === schritt ? C.grund : i < schritt || ende ? ROSA : C.inkDim }}>{i + 1} · {x.titel}</button>
        ))}
        <button onClick={() => setEnde(true)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 11px', borderRadius: 999, cursor: 'pointer', border: 'none', background: ende ? ROSA : 'rgba(255,255,255,.05)', color: ende ? C.grund : C.inkDim }}>Abschluss</button>
      </div>

      {!ende ? (
        <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
          <Reihe gap={12}>
            <div style={{ fontSize: TYP.titel, fontWeight: 700 }}>{a.titel}</div>
            <Chip farbe={C.inkDim}>{a.minuten} Min</Chip>
            <Uhr minuten={a.minuten} schritt={schritt} />
          </Reihe>
          <Klein>{a.hilfe}</Klein>

          {(a.id === 'wertschaetzung' || a.id === 'ausblick') && d.mitglieder.length > 1 && (
            <Reihe><Klein>Es spricht:</Klein><Wahl liste={d.mitglieder.map(m => ({ id: m.person, label: m.name }))} aktiv={sprecher} onWahl={setSprecher} farbe={ROSA} /></Reihe>
          )}

          {a.id === 'wertschaetzung' && <Punkte liste={g.wertschaetzungen} platz={`${api.name(sprecher)}: „… — das zeigt mir, dass du …“`}
            onNeu={text => aendere({ wertschaetzungen: [...g.wertschaetzungen, { von: sprecher, text }] })} onWeg={i => aendere({ wertschaetzungen: g.wertschaetzungen.filter((_, j) => j !== i) })} />}

          {a.id === 'gut' && <Punkte liste={g.lief_gut.map(text => ({ text }))} platz="Was lief gut?"
            onNeu={text => aendere({ lief_gut: [...g.lief_gut, text] })} onWeg={i => aendere({ lief_gut: g.lief_gut.filter((_, j) => j !== i) })} />}

          {a.id === 'orga' && (
            <>
              {(d.tage.length > 0 || d.agenda.faelligeKarten.length > 0 || d.agenda.offeneVereinbarungen.length > 0) && (
                <div style={{ display: 'grid', gap: 4, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
                  {d.tage.filter(t => t.inTagen <= 14).map(t => <Klein key={t.id}>📅 {t.titel} — {datumLang(t.am, d.heute)}{t.erledigt ? ' · vorbereitet' : ` · ${api.name(t.wer)} kümmert sich`}</Klein>)}
                  {d.agenda.offeneVereinbarungen.map(v => <Klein key={v.id}>↻ {v.text} — {api.name(v.wer)}</Klein>)}
                  {d.agenda.faelligeKarten.slice(0, 6).map(k => <Klein key={k.id}>▢ {k.titel} — {k.inhaber ? `${api.name(k.inhaber)}, prüfen` : 'noch ohne Inhaber'}</Klein>)}
                </div>
              )}
              <Punkte liste={g.orga.map(text => ({ text }))} platz="Absprache für die Woche"
                onNeu={text => aendere({ orga: [...g.orga, text] })} onWeg={i => aendere({ orga: g.orga.filter((_, j) => j !== i) })} />
              {d.agenda.businessThemen.length > 0 && <Klein>{d.agenda.businessThemen.length} Business-Themen liegen im Parkplatz — die gehören in einen eigenen Termin, nicht hierher.</Klein>}
            </>
          )}

          {a.id === 'zeit' && (
            <>
              <Textfeld wert={g.schoeneZeit} zeilen={2} platzhalter="Nächstes Date, Eigenzeit für jeden …" onFertig={schoeneZeit => aendere({ schoeneZeit })} />
              <Klein>Das Date selbst unter „Zeit zu zweit“ festmachen — wer plant, plant komplett.</Klein>
            </>
          )}

          {a.id === 'themen' && (
            <>
              <Klein>Höchstens zwei. Einer spricht, der andere gibt wieder, bis sich der erste verstanden fühlt — erst dann Lösungen.</Klein>
              <Liste>
                {themen.map(t => {
                  const an = g.themenIds.includes(t.id);
                  const um = () => aendere({ themenIds: an ? g.themenIds.filter(x => x !== t.id) : [...g.themenIds, t.id] });
                  return (
                    <Zeile key={t.id} links={<Haken an={an} onChange={um} farbe={ROSA} />} titel={<span style={{ whiteSpace: 'normal' }}>{t.titel}</span>} unter={`${api.name(t.von)} · ${t.status}`}
                      rechts={an ? <Reihe gap={4}>
                        <Knopf leise onClick={() => api.setze('themen', { ...t, status: 'besprochen' })}>Besprochen</Knopf>
                        <Knopf leise onClick={() => api.setze('themen', { ...t, status: 'geparkt' })}>Parken</Knopf>
                      </Reihe> : undefined} />
                  );
                })}
              </Liste>
              {!themen.length && <Klein>Keine Themen im Parkplatz — dann bleibt mehr Zeit füreinander.</Klein>}
              <Eingabe leeren platzhalter="Daraus folgt (Vereinbarung) …" onFertig={text => api.setze('vereinbarungen', { id: `v-${Date.now().toString(36)}`, text, wer: ich, faellig: null, status: 'offen' })} />
            </>
          )}

          {a.id === 'ausblick' && <Punkte liste={g.wuensche} platz={`${api.name(sprecher)}: Was brauche ich nächste Woche, um mich geliebt zu fühlen?`}
            onNeu={text => aendere({ wuensche: [...g.wuensche, { von: sprecher, text }] })} onWeg={i => aendere({ wuensche: g.wuensche.filter((_, j) => j !== i) })} />}

          <Reihe>
            {schritt > 0 && <Knopf leise onClick={() => setSchritt(schritt - 1)}>Zurück</Knopf>}
            <Knopf farbe={ROSA} onClick={() => (schritt < AGENDA.length - 1 ? setSchritt(schritt + 1) : setEnde(true))}>Weiter</Knopf>
          </Reihe>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
          <div style={{ fontSize: TYP.titel, fontWeight: 700 }}>Abschluss</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <Klein>Ist Business diese Woche draußen geblieben — abends, am Wochenende, in diesem Gespräch?</Klein>
            <Reihe>
              <Knopf leise={g.businessGrenzeGehalten !== true} farbe={LEUCHT.gut} onClick={() => aendere({ businessGrenzeGehalten: true })}>Ja</Knopf>
              <Knopf leise={g.businessGrenzeGehalten !== false} farbe={LEUCHT.achtung} onClick={() => aendere({ businessGrenzeGehalten: false })}>Nicht ganz</Knopf>
            </Reihe>
          </div>
          <Textfeld wert={g.notiz} zeilen={2} platzhalter="Notiz (optional)" onFertig={notiz => aendere({ notiz })} />
          <Reihe>
            <Knopf farbe={ROSA} onClick={() => { void aendere({ status: 'gehalten' }); onZu(); }}>Gespräch abschließen</Knopf>
            <Knopf leise onClick={() => { void aendere({ status: 'ausgefallen' }); onZu(); }}>Ist ausgefallen</Knopf>
          </Reihe>
          <Klein>{g.wertschaetzungen.length} Wertschätzungen · {g.lief_gut.length} gute Dinge · {g.themenIds.length} Themen · {g.wuensche.length} Wünsche</Klein>
        </div>
      )}
    </Karte>
  );
}
