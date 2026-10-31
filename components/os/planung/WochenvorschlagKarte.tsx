'use client';

// ─── Planung mit ZOE — Wochenvorschlag (31.10.) ─────────────────────────────────────────────────────────────────────────────────
// Kevin 31.10.: „Planung mit ZOE.“ ZOE schlägt für die Woche Fokus-Blöcke für die wichtigsten Aufgaben und Meilensteine in freie Zeit vor (Regelwerk,
// lib/planung/wochenvorschlag.ts), dazu die Top 3 der Woche und den Hinweis „nicht machbar“ aus der Kapazität. Angelegt wird NICHTS ohne Klick:
// „Alles übernehmen“, einzeln abwählen oder verschieben — die Blöcke entstehen über den einen Schreibweg (`blockAnlegen`), mit festen Kennungen
// (ein zweiter Klick legt nichts doppelt an). Daten nur über GET/POST /api/planung/wochenvorschlag (nur die eigene Person).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Leer, Chip, HakenZiel, LEUCHT, auswahl as auswahlStil } from '../ui';
import { tagKurzWv, uhrWv, type Wochenvorschlag, type WvBereich, type WvHinweisArt, type WvVerschoben } from '@/lib/planung/wochenvorschlag';
import { tagPlus } from '@/lib/kalender/zeit';

const HINWEIS_ART: Record<WvHinweisArt, 'kritisch' | 'achtung' | 'info'> = { 'nicht-machbar': 'kritisch', ueberfaellig: 'kritisch', eng: 'achtung', 'kein-platz': 'achtung', woche: 'info' };
const UHRZEITEN = Array.from({ length: (22 - 6) * 4 }, (_, i) => 6 * 60 + i * 15);

interface Antwort { ok: boolean; vorschlag?: Wochenvorschlag; uebernommen?: string[]; bereitgelegt?: boolean; hinweis?: string; error?: string; aktuell?: Antwort }

export function WochenvorschlagKarte({ bereich, woche, onUebernommen, i = 0 }: { bereich: WvBereich; /** Ein Tag der Woche (Montag wird gerechnet); fehlt = diese Woche. */ woche?: string; onUebernommen?: () => void; i?: number }) {
  const [v, setV] = useState<Wochenvorschlag | null>(null);
  const [uebernommen, setUebernommen] = useState<Set<string>>(new Set());
  const [bereit, setBereit] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [verschoben, setVerschoben] = useState<Record<string, WvVerschoben>>({});
  const [offen, setOffen] = useState<string | null>(null);
  const [formulieren, setFormulieren] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'achtung' | 'kritisch' | 'info'; text: string } | null>(null);
  const [laedt, setLaedt] = useState(true);

  const annehmen = useCallback((d: Antwort) => {
    if (!d.vorschlag) return;
    const ue = new Set(d.uebernommen ?? []);
    setV(d.vorschlag); setUebernommen(ue); setBereit(!!d.bereitgelegt);
    setGewaehlt(new Set(d.vorschlag.bloecke.filter(b => !ue.has(b.id)).map(b => b.id)));
    setVerschoben({}); setOffen(null);
  }, []);

  const laden = useCallback(async () => {
    setLaedt(true);
    const q = new URLSearchParams({ space: bereich, ...(woche ? { woche } : {}) });
    const d: Antwort = await fetch(`/api/planung/wochenvorschlag?${q}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ok: false, error: 'Keine Verbindung.' }));
    if (d.ok) annehmen(d); else setMeldung({ art: 'kritisch', text: d.error ?? 'Der Wochenvorschlag lässt sich gerade nicht laden.' });
    setLaedt(false);
  }, [bereich, woche, annehmen]);
  useEffect(() => { void laden(); }, [laden]);

  const post = (body: Record<string, unknown>): Promise<Antwort & { angelegt?: number; schon?: number; belegt?: { id: string; titel: string }[]; fehler?: { id: string; text: string }[] }> =>
    fetch('/api/planung/wochenvorschlag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ space: bereich, woche: v?.montag ?? woche, ...body }) })
      .then(r => r.json()).catch(() => ({ ok: false, error: 'Keine Verbindung.' }));

  async function planen() {
    setMeldung(null);
    const d = await post({ aktion: 'planen', ...(formulieren ? { formulieren: true } : {}) });
    if (!d.ok) { setMeldung({ art: 'kritisch', text: d.error ?? 'ZOE konnte gerade nicht planen.' }); return; }
    annehmen(d);
    if (d.hinweis) setMeldung({ art: 'info', text: d.hinweis });
  }

  async function uebernehmen(alle: boolean) {
    if (!v) return;
    setMeldung(null);
    const ids = alle ? v.bloecke.filter(b => !uebernommen.has(b.id)).map(b => b.id) : [...gewaehlt].filter(id => !uebernommen.has(id));
    if (!ids.length) { setMeldung({ art: 'info', text: 'Nichts ausgewählt.' }); return; }
    const vs = Object.values(verschoben).filter(x => ids.includes(x.id));
    const d = await post({ aktion: 'uebernehmen', stand: v.stand, ids, ...(vs.length ? { verschoben: vs } : {}) });
    if (!d.ok) {
      setMeldung({ art: 'kritisch', text: d.error ?? 'Übernehmen ging nicht.' });
      if (d.aktuell?.ok) annehmen(d.aktuell);
      return;
    }
    const teile = [d.angelegt ? `${d.angelegt} Block${d.angelegt === 1 ? '' : 'e'} im Kalender angelegt` : '', d.schon ? `${d.schon} stand${d.schon === 1 ? '' : 'en'} schon im Kalender` : '',
      d.belegt?.length ? `${d.belegt.length} nicht angelegt — die Zeit ist inzwischen belegt` : '', d.fehler?.length ? `${d.fehler.length} mit Fehler: ${d.fehler[0].text}` : ''].filter(Boolean);
    setMeldung({ art: d.fehler?.length || d.belegt?.length ? 'achtung' : 'gut', text: `${teile.join(' · ') || 'Nichts angelegt'}.` });
    await laden();
    onUebernommen?.();
  }

  const tage = useMemo(() => (v ? Array.from({ length: 7 }, (_, n) => tagPlus(v.montag, n)) : []), [v]);
  const bloeckeAnzeige = useMemo(() => (v?.bloecke ?? []).map(b => ({ ...b, ...(verschoben[b.id] ?? {}) })), [v, verschoben]);
  const offeneN = (v?.bloecke ?? []).filter(b => !uebernommen.has(b.id)).length;
  const gewaehltN = [...gewaehlt].filter(id => !uebernommen.has(id)).length;
  const umschalten = (id: string) => setGewaehlt(g => { const n = new Set(g); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Karte i={i} akzent={LEUCHT.agenten}>
      <Ueberschrift farbe={LEUCHT.agenten} rechts={v ? <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Woche ab {tagKurzWv(v.montag)}{bereit ? ' · bereitgelegt' : ''}</span> : undefined}>Woche mit ZOE planen</Ueberschrift>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Knopf farbe={LEUCHT.agenten} onClick={planen}>{bereit ? 'Neu planen' : 'Woche mit ZOE planen'}</Knopf>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, color: C.inkDim, cursor: 'pointer' }}>
          <HakenZiel an={formulieren} onChange={() => setFormulieren(f => !f)} farbe={LEUCHT.agenten} ariaLabel={formulieren ? 'Sätze nicht von der KI formulieren lassen' : 'Sätze von der KI formulieren lassen'} />
          Sätze von ZOE formulieren (KI)
        </label>
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5, marginTop: 8 }}>
        Fokus-Blöcke für das Wichtigste — nur in freie Zeit, nie über Termine, Abwesenheit oder Business-frei, mit Puffer. Angelegt wird erst auf deinen Klick.
      </div>

      {meldung && <div style={{ marginTop: 12 }}><Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis></div>}
      {laedt && !v && <div style={{ marginTop: 12 }}><Leer>ZOE rechnet die Woche …</Leer></div>}

      {v && (
        <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
          <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.5 }}>{v.begruendung}{v.formuliert === 'ki' ? ' ' : ''}{v.formuliert === 'ki' && <Chip farbe={LEUCHT.agenten}>von ZOE formuliert</Chip>}</div>

          {v.hinweise.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {v.hinweise.map((h, n) => <Hinweis key={n} art={HINWEIS_ART[h.art]}>{h.text}</Hinweis>)}
            </div>
          )}

          {v.top3.length > 0 && (
            <div>
              <div style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700, marginBottom: 6 }}>Top 3 der Woche</div>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>
                {v.top3.map(t => <li key={t.id} style={{ fontSize: TYP.body, color: C.ink }}>{t.titel}{t.grund ? <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}> · {t.grund}</span> : null}</li>)}
              </ol>
            </div>
          )}

          {v.bloecke.length > 0 && (
            <>
              <div role="list" aria-label="Vorgeschlagene Blöcke der Woche" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 168px), 1fr))' }}>
                {tage.map(tag => {
                  const amTag = bloeckeAnzeige.filter(b => b.date === tag).sort((a, b) => a.startMin - b.startMin);
                  return (
                    <div key={tag} role="listitem" style={{ display: 'grid', gap: 6, alignContent: 'start', minWidth: 0 }}>
                      <div style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: amTag.length ? C.ink : C.inkLeise, fontWeight: 700 }}>{tagKurzWv(tag)}</div>
                      {!amTag.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>—</div>}
                      {amTag.map(b => {
                        const drin = uebernommen.has(b.id);
                        const an = drin || gewaehlt.has(b.id);
                        return (
                          <div key={b.id} style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 12, background: drin ? `${LEUCHT.gut}14` : an ? `${LEUCHT.agenten}14` : 'rgba(255,255,255,.03)', border: `1px solid ${drin ? `${LEUCHT.gut}44` : an ? `${LEUCHT.agenten}44` : 'rgba(255,255,255,.06)'}`, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              {!drin && <HakenZiel an={gewaehlt.has(b.id)} onChange={() => umschalten(b.id)} farbe={LEUCHT.agenten} ariaLabel={`„${b.titel}“ ${gewaehlt.has(b.id) ? 'abwählen' : 'auswählen'}`} />}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.ink, overflowWrap: 'anywhere' }}>{b.titel}</div>
                                <div style={{ fontSize: TYP.bedien, color: verschoben[b.id] ? LEUCHT.achtung : C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{uhrWv(b.startMin)}–{uhrWv(b.startMin + b.dauerMin)}{verschoben[b.id] ? ' · verschoben' : ''}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.4 }}>{b.grund}</div>
                            {drin ? <Chip farbe={LEUCHT.gut}>im Kalender</Chip> : (
                              <button type="button" onClick={() => setOffen(o => (o === b.id ? null : b.id))} aria-expanded={offen === b.id}
                                style={{ justifySelf: 'start', background: 'none', border: 'none', padding: '4px 0', color: C.aktiv, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, cursor: 'pointer', minHeight: 32 }}>verschieben …</button>
                            )}
                            {offen === b.id && !drin && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <select aria-label="Tag" value={b.date} style={auswahlStil} onChange={e => setVerschoben(s => ({ ...s, [b.id]: { id: b.id, date: e.target.value, startMin: b.startMin, dauerMin: b.dauerMin } }))}>
                                  {tage.map(t => <option key={t} value={t}>{tagKurzWv(t)}</option>)}
                                </select>
                                <select aria-label="Beginn" value={b.startMin} style={auswahlStil} onChange={e => setVerschoben(s => ({ ...s, [b.id]: { id: b.id, date: b.date, startMin: Number(e.target.value), dauerMin: b.dauerMin } }))}>
                                  {UHRZEITEN.filter(m => m + b.dauerMin <= 22 * 60).map(m => <option key={m} value={m}>{uhrWv(m)}</option>)}
                                </select>
                                {verschoben[b.id] && <button type="button" onClick={() => setVerschoben(s => { const n = { ...s }; delete n[b.id]; return n; })}
                                  style={{ background: 'none', border: 'none', color: C.inkLeise, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer', minHeight: 32 }}>zurück</button>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              {offeneN > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Knopf haupt farbe={LEUCHT.agenten} onClick={() => uebernehmen(true)}>{`Alles übernehmen (${offeneN})`}</Knopf>
                  {gewaehltN > 0 && gewaehltN < offeneN && <Knopf leise onClick={() => uebernehmen(false)}>{`Auswahl übernehmen (${gewaehltN})`}</Knopf>}
                  <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Die Blöcke landen in deinem Kalender — ziehen, ändern, löschen wie jeder Termin.</span>
                </div>
              ) : <Hinweis art="gut">Alle Blöcke dieser Woche stehen im Kalender.</Hinweis>}
            </>
          )}
        </div>
      )}
    </Karte>
  );
}
