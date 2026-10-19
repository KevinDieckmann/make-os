'use client';

// ─── Produkte · Leistungstreppe — Kundenreise, Zielbild, Roadmap, Positionierung (10.10.) ──────────────────────────
// Kundenreise   die Stationen als Kreislauf (Rechner: Kette mit Rückpfeil zum Anfang, Handy: Liste) — je Station Messgröße, Ziel, Ist
//               (aus der verknüpften Stufe bzw. von Hand)
// Zielbild      Ziel gegen Ist je Stufe im Zieljahr (Umsatz, Kunden), Übergänge zwischen den Stufen, Aufwand je Woche gegen freie Stunden
// Roadmap       Produkt-Entwicklung: geplante Pakete mit Zeitplan und Status
// Positionierung & Story   Claim, Zielgruppe, Problem, Versprechen, Story — der Head of Sales liest sie im Datenpaket (Daten, nie Anweisung)
// Gerechnet wird nichts hier (lib/crm/treppe.ts); geschrieben über Einzel-Schritte mit Stand (daten.ts).

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { FARBE as C, SCHRIFT, TYP, TIEF } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Hinweis, Leer, Liste, Zeile, Zahl, Raster, LEUCHT, useHandy, useRueckfrage } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { Feld } from '../../crm/teile';
import type { PaketStatus, PositionierungFeld } from '@/lib/crm/treppe-daten';
import { euro, monat, type TreppeApi, type TreppeLage } from './daten';
import { TextFeld, farbeVonEbene } from './bausteine';

const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const zahl = (t: string): number | null => { const n = Number(t.replace(/\./g, '').replace(',', '.')); return t.trim() === '' || !Number.isFinite(n) ? null : n; };
const anteil = (ist: number, ziel?: number) => (ziel ? Math.min(100, Math.round((100 * ist) / ziel)) : null);
function Balken({ wert, farbe }: { wert: number | null; farbe: string }) {
  return <span aria-hidden style={{ display: 'block', height: 6, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${wert ?? 0}%`, background: TIEF.verlauf(farbe) }} /></span>;
}

// ── Kundenreise ──────────────────────────────────────────────────────────────────────────────────────────────────

export function Kundenreise({ api, lage }: { api: TreppeApi; lage: TreppeLage }) {
  const handy = useHandy();
  const { fragen, dialog } = useRueckfrage();
  const [offen, setOffen] = useState<string | null>(null);
  const stationen = lage.datei.kreislauf;
  const reise = lage.kundenreise;
  const stufen = lage.katalog.stufen.map(s => ({ id: s.id, label: s.name })); // aus dem Katalog (19.10., P2)
  const neu = () => api.schreibe([{ op: 'station', eintrag: { name: `Station ${stationen.length + 1}` } }]);
  const st = stationen.find(s => s.id === offen);
  return (
    <Karte i={2}>
      <Ueberschrift rechts={stationen.length < lage.auswahl.grenzen.stationen ? <Knopf leise onClick={neu}>+ Station</Knopf> : undefined}>Kundenreise als Kreislauf</Ueberschrift>
      {!stationen.length ? <Leer symbol="↺">Noch keine Stationen — die Reise eines Kunden vom ersten Sichtbarwerden über die Stufen bis zur Empfehlung, die neue Kunden bringt. Mit „+ Station“ anlegen oder aus einem Dokument übernehmen.</Leer> : handy ? (
        <Liste>
          {reise.map((s, i) => <Zeile key={s.id} aktiv={s.id === offen} onClick={() => setOffen(s.id === offen ? null : s.id)} titel={`${i + 1}. ${s.name}`} unter={[s.messgroesse, s.ziel !== undefined ? `Ziel ${s.ziel}` : '', s.ist !== null ? `Ist ${s.ist}` : ''].filter(Boolean).join(' · ') || 'ohne Messgröße'} />)}
        </Liste>
      ) : (
        <div role="group" aria-label="Kundenreise — die Stationen im Kreis" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 8 }}>
          {reise.map((s, i) => {
            const stufe = lage.katalog.stufen.find(x => x.id === stationen.find(y => y.id === s.id)?.stufeId);
            const f = stufe ? farbeVonEbene(stufe.ebene) : C.aktiv;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" aria-pressed={s.id === offen} onClick={() => setOffen(s.id === offen ? null : s.id)} className="fassbar"
                  style={{ textAlign: 'left', minHeight: 44, minWidth: 150, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', fontFamily: SCHRIFT.text, color: C.ink, background: s.id === offen ? `${f}2E` : TIEF.flaeche(f), border: `1px solid ${TIEF.rand(f)}`, display: 'grid', gap: 3 }}>
                  <span style={{ fontSize: TYP.body, fontWeight: 700 }}>{s.name}</span>
                  <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{s.messgroesse ?? 'ohne Messgröße'}</span>
                  <span style={{ fontSize: TYP.bedien, color: f }}>{s.ist !== null ? `Ist ${s.ist.toLocaleString('de-DE')}` : 'Ist —'}{s.ziel !== undefined ? ` · Ziel ${s.ziel.toLocaleString('de-DE')}` : ''}</span>
                </button>
                <span aria-hidden style={{ color: C.inkLeise, fontSize: TYP.titel }}>{i < reise.length - 1 ? '›' : '↺'}</span>
              </div>
            );
          })}
        </div>
      )}
      {stationen.length > 0 && <div style={{ ...klein, marginTop: 10 }}>Der letzte Pfeil führt zurück an den Anfang: zufriedene Kunden machen uns sichtbar. Ist kommt aus der verknüpften Stufe (Kunden im Zieljahr) oder wird von Hand gepflegt.</div>}
      {st && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
          <Feld wert={st.name} platzhalter="Name der Station" onFertig={t => t.trim() && void api.schreibe([{ op: 'station', eintrag: { id: st.id, name: t.trim() }, stand: st.stand }])} />
          <Feld wert={st.messgroesse ?? ''} platzhalter="Messgröße" onFertig={t => void api.schreibe([{ op: 'station', eintrag: { id: st.id, messgroesse: t.trim() || null }, stand: st.stand }])} />
          <Feld wert={st.ziel !== undefined ? String(st.ziel) : ''} platzhalter="Ziel (Zahl)" onFertig={t => void api.schreibe([{ op: 'station', eintrag: { id: st.id, ziel: zahl(t) }, stand: st.stand }])} />
          {!st.stufeId && <Feld wert={st.ist !== undefined ? String(st.ist) : ''} platzhalter="Ist von Hand" onFertig={t => void api.schreibe([{ op: 'station', eintrag: { id: st.id, ist: zahl(t) }, stand: st.stand }])} />}
          <Wahl label="Stufe" liste={stufen} wert={st.stufeId} leerenLabel="ohne Stufe" onLeeren={() => void api.schreibe([{ op: 'station', eintrag: { id: st.id, stufeId: null }, stand: st.stand }])} onWahl={v => void api.schreibe([{ op: 'station', eintrag: { id: st.id, stufeId: v }, stand: st.stand }])} />
          <Knopf leise onClick={() => fragen({ titel: `Station „${st.name}“ entfernen?`, text: 'Nur die Station fällt weg — Stufen und Kunden bleiben.', wahl: [{ label: 'Entfernen', ton: 'gefahr', tun: () => { void api.schreibe([{ op: 'station-weg', id: st.id, stand: st.stand }]); setOffen(null); } }] })}>Station entfernen</Knopf>
        </div>
      )}
      {dialog}
    </Karte>
  );
}

// ── Zielbild (+ Kapazität) ───────────────────────────────────────────────────────────────────────────────────────

export function Zielbild({ api, lage }: { api: TreppeApi; lage: TreppeLage }) {
  const z = lage.zielbild;
  const k = lage.kapa;
  const jahr = Number(lage.heute.slice(0, 4));
  const jahre = [jahr - 1, jahr, jahr + 1, jahr + 2].map(j => ({ id: String(j), label: String(j) }));
  const stand = (id: string) => lage.datei.stufen.find(s => s.id === id)?.stand;
  const karteVon = (id: string): string | null => { const h = lage.katalog.herkunft[id]; return h?.karte && h.leistungId ? h.leistungId : null; };
  const ziel = (id: string, feld: 'umsatz' | 'kunden', t: string) => void api.schreibe([{ op: 'stufe', eintrag: { id, ziel: { [feld]: zahl(t) } }, stand: stand(id) }]);
  return (
    <>
      <Karte i={2}>
        <Ueberschrift rechts={<Wahl label="Zieljahr" liste={jahre} wert={String(z.jahr)} onWahl={v => void api.schreibe([{ op: 'zieljahr', jahr: Number(v) }])} />}>Zielbild {z.jahr}</Ueberschrift>
        <Raster min={160}>
          <Zahl wert={euro(z.summe.istUmsatz)} label={`Umsatz bisher · Ziel ${euro(z.summe.zielUmsatz)}`} farbe={LEUCHT.geld} />
          <Zahl wert={String(z.summe.istKunden)} label={`Kunden · Ziel ${z.summe.zielKunden}`} farbe={LEUCHT.business} />
          <Zahl wert={`${k.stundenWoche} h`} label={`Aufwand je Woche · frei ${k.frei == null ? '—' : `${k.frei} h`}`} farbe={k.ueber ? LEUCHT.kritisch : LEUCHT.gut} />
        </Raster>
        {!lage.katalog.stufen.length ? <div style={{ ...klein, marginTop: 10 }}>Erst Stufen anlegen — dann bekommt jede ihr Ziel.</div> : (
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {z.zeilen.map(r => {
              const f = farbeVonEbene(r.ebene);
              return (
                <div key={r.stufeId} style={{ display: 'grid', gap: 6, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: TYP.body, fontWeight: 600 }}>{r.ebene}. {r.name}</span>
                    {/* Stufe aus einer Produkt-Karte (19.10., P2): das Ziel steht EINMAL — an der Karte (dort ändern); sonst an der gespeicherten Stufe. */}
                    {karteVon(r.stufeId) ? <Link href={WEG.produkt(karteVon(r.stufeId)!)} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Ziel in der Karte ändern ›</Link> : (
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Feld typ="text" breite={130} wert={r.ziel.umsatz ? String(r.ziel.umsatz) : ''} platzhalter="Umsatzziel €" onFertig={t => ziel(r.stufeId, 'umsatz', t)} />
                        <Feld typ="text" breite={110} wert={r.ziel.kunden ? String(r.ziel.kunden) : ''} platzhalter="Kundenziel" onFertig={t => ziel(r.stufeId, 'kunden', t)} />
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
                    <div style={{ display: 'grid', gap: 4 }}><span style={klein}>Umsatz {euro(r.ist.umsatz)}{r.ziel.umsatz ? ` von ${euro(r.ziel.umsatz)}` : ''}</span><Balken wert={anteil(r.ist.umsatz, r.ziel.umsatz)} farbe={LEUCHT.geld} /></div>
                    <div style={{ display: 'grid', gap: 4 }}><span style={klein}>Kunden {r.ist.kunden}{r.ziel.kunden ? ` von ${r.ziel.kunden}` : ''}</span><Balken wert={anteil(r.ist.kunden, r.ziel.kunden)} farbe={f} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ ...klein, marginTop: 10 }}>Umsatz: Monatshonorare der Mandate in der Stufe (bis heute) und einmalige im Startjahr; Kunden: Mandate und Deals auf den Produkten der Stufe, je Firma einmal.</div>
      </Karte>
      <Karte i={3}>
        <Ueberschrift>Übergänge & Kapazität</Ueberschrift>
        {z.uebergaenge.length ? (
          <Liste>{z.uebergaenge.map(u => <Zeile key={`${u.von}>${u.nach}`} titel={`${u.von} › ${u.nach}`} rechts={<Chip farbe={LEUCHT.gut}>{u.anzahl}</Chip>} />)}</Liste>
        ) : <div style={klein}>Noch keine Übergänge im Zieljahr — sie entstehen, wenn ihr einen Kunden im Mandat in die nächste Stufe hebt.</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {k.jeStufe.filter(x => x.kunden || x.max).map(x => <Chip key={x.stufeId} farbe={x.ueber ? LEUCHT.kritisch : x.voll ? LEUCHT.achtung : C.inkDim}>{x.name}: {x.kunden}{x.max ? `/${x.max}` : ''} · {x.stundenWoche} h/Woche</Chip>)}
        </div>
        {k.ueber && <div style={{ marginTop: 10 }}><Hinweis art="achtung">Die Kunden in den Paketen brauchen mehr Zeit, als das Team frei hat ({k.stundenWoche} h gegen {k.frei} h je Woche) — Planung › Kapazität prüfen.</Hinweis></div>}
        {(k.ohneAufwand.length > 0 || k.annahmeDauer.length > 0) && <div style={{ ...klein, marginTop: 8 }}>{k.ohneAufwand.length ? `Ohne Aufwand: ${k.ohneAufwand.join(', ')}. ` : ''}{k.annahmeDauer.length ? `Ohne Dauer (Annahme vier Wochen): ${k.annahmeDauer.join(', ')}.` : ''}</div>}
      </Karte>
    </>
  );
}

// ── Roadmap ──────────────────────────────────────────────────────────────────────────────────────────────────────

const STATUS_FARBE: Record<PaketStatus, string> = { idee: C.inkDim, geplant: LEUCHT.business, in_arbeit: LEUCHT.achtung, fertig: LEUCHT.gut };
export function Roadmap({ api, lage }: { api: TreppeApi; lage: TreppeLage }) {
  const { fragen, dialog } = useRueckfrage();
  const pakete = [...lage.datei.roadmap].sort((a, b) => (a.start ?? '9999').localeCompare(b.start ?? '9999') || a.titel.localeCompare(b.titel));
  const [offen, setOffen] = useState<string | null>(null);
  const p = pakete.find(x => x.id === offen);
  const stufen = lage.katalog.stufen.map(s => ({ id: s.id, label: s.name })); // aus dem Katalog (19.10., P2)
  const set = (id: string, stand: string, teil: Record<string, unknown>) => void api.schreibe([{ op: 'paket', eintrag: { id, ...teil }, stand }]);
  const monatOk = (t: string) => (/^\d{4}-\d{2}$/.test(t.trim()) ? t.trim() : t.trim() === '' ? null : undefined);
  return (
    <Karte i={2}>
      <Ueberschrift rechts={pakete.length < lage.auswahl.grenzen.roadmap ? <Knopf leise onClick={() => api.schreibe([{ op: 'paket', eintrag: { titel: 'Neues Paket', status: 'idee' } }])}>+ Paket</Knopf> : undefined}>Produkt-Roadmap</Ueberschrift>
      {!pakete.length ? <Leer symbol="◇">Noch keine geplanten Pakete — was als Nächstes ins Angebot kommt, mit Zeitplan und warum.</Leer> : (
        <Liste>
          {pakete.map(x => (
            <Zeile key={x.id} aktiv={x.id === offen} onClick={() => setOffen(x.id === offen ? null : x.id)} titel={x.titel}
              unter={[x.start || x.fertig ? `${x.start ? monat(x.start) : '?'} – ${x.fertig ? monat(x.fertig) : '?'}` : 'ohne Zeitplan', x.stufeId ? lage.katalog.stufen.find(s => s.id === x.stufeId)?.name : '', x.warum].filter(Boolean).join(' · ')}
              rechts={<Chip farbe={STATUS_FARBE[x.status]}>{lage.auswahl.paketStatus.find(s => s.id === x.status)?.label ?? x.status}</Chip>} />
          ))}
        </Liste>
      )}
      {p && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
          <Feld wert={p.titel} platzhalter="Titel" onFertig={t => t.trim() && set(p.id, p.stand, { titel: t.trim() })} />
          <Wahl<PaketStatus> label="Status" liste={lage.auswahl.paketStatus.map(s => ({ id: s.id, label: s.label }))} wert={p.status} onWahl={v => set(p.id, p.stand, { status: v })} />
          <Feld wert={p.start ?? ''} platzhalter="Start JJJJ-MM" onFertig={t => { const m = monatOk(t); if (m !== undefined) set(p.id, p.stand, { start: m }); else api.setHinweis('Start: Monat als JJJJ-MM.'); }} />
          <Feld wert={p.fertig ?? ''} platzhalter="Fertig JJJJ-MM" onFertig={t => { const m = monatOk(t); if (m !== undefined) set(p.id, p.stand, { fertig: m }); else api.setHinweis('Fertig: Monat als JJJJ-MM.'); }} />
          <Wahl label="Stufe" liste={stufen} wert={p.stufeId} leerenLabel="ohne Stufe" onLeeren={() => set(p.id, p.stand, { stufeId: null })} onWahl={v => set(p.id, p.stand, { stufeId: v })} />
          <Knopf leise onClick={() => fragen({ titel: `Paket „${p.titel}“ entfernen?`, text: 'Es verschwindet aus der Roadmap.', wahl: [{ label: 'Entfernen', ton: 'gefahr', tun: () => { void api.schreibe([{ op: 'paket-weg', id: p.id, stand: p.stand }]); setOffen(null); } }] })}>Paket entfernen</Knopf>
          <div style={{ gridColumn: '1 / -1' }}><TextFeld wert={p.warum ?? ''} platzhalter="Warum dieses Paket — wohin es führt" onFertig={t => set(p.id, p.stand, { warum: t.trim() || null })} /></div>
        </div>
      )}
      {dialog}
    </Karte>
  );
}

// ── Positionierung & Story ───────────────────────────────────────────────────────────────────────────────────────

export function PositionierungKarte({ api, lage }: { api: TreppeApi; lage: TreppeLage }) {
  const p = lage.datei.positionierung;
  const setze = (f: PositionierungFeld, t: string) => void api.schreibe([{ op: 'positionierung', felder: { [f]: t.trim() || null }, stand: lage.datei.positionierungStand }]);
  const feldVon = (f: PositionierungFeld, label: string): ReactNode => (
    <label key={f} style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>{label}</span>
      {f === 'claim'
        ? <Feld wert={p.claim ?? ''} platzhalter="Ein Satz, der hängen bleibt" onFertig={t => setze('claim', t)} />
        : <TextFeld wert={p[f] ?? ''} zeilen={f === 'story' ? 6 : 3} platzhalter={label} onFertig={t => setze(f, t)} />}
    </label>
  );
  return (
    <Karte i={2}>
      <Ueberschrift>Positionierung & Story</Ueberschrift>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
        {lage.auswahl.positionierung.map(x => feldVon(x.id, x.label))}
      </div>
      <div style={{ ...klein, marginTop: 10 }}>Der Head of Sales liest diese Seite im Datenpaket — als Wissen, nie als Anweisung. Er ordnet Vorschläge damit ein (welche Stufe als Nächstes passt).{p.geaendert ? ` Zuletzt geändert am ${p.geaendert.slice(8, 10)}.${p.geaendert.slice(5, 7)}.` : ''}</div>
    </Karte>
  );
}
