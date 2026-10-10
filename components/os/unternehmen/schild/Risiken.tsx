'use client';

// ─── Unternehmen › Risiken: Register mit Bewertung, Quartals-Runde und Neubewertung bei Ereignissen (10.10.) ───────────
// Kevin 10.10.: „das Risiko immer wieder mitbewerten“ — Eintritt × Wirkung (1–5, Skala der Recherche), brutto/netto, Behandlung,
// Maßnahmen, verantwortlich (Person des Haushalts und/oder Rolle), Verlauf der Bewertungen (nur anhängen). Oben: was neu zu bewerten ist
// (Quartal, Anlässe), die Matrix 5 × 5 und die Aggregation gegen die Tragfähigkeit. Startkatalog mit 17 generischen Risiken.

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { FARBE as C, TYP, RAND, TIEF } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leerzustand, Pillen, Segmente, MehrfachPillen, ZeileAktionen, useRueckgaengig, eingabe, feld } from '../../ui';
import { neueKennung } from '@/lib/kennung';
import { RISIKO_KATEGORIEN, BEHANDLUNGEN, RISIKO_STATUS, ROLLEN, type Risiko, type Massnahme, type RisikoKategorie, type Behandlung, type RisikoStatus, type Rolle, type Stufe } from '@/lib/gesellschaften/schild/typen';
import { RISIKO_KATALOG, EINTRITT_STUFEN, WIRKUNG_STUFEN, ampelVon, score, type RisikoZeile } from '@/lib/gesellschaften/schild/risiken';
import type { GesellschaftLage } from '@/lib/gesellschaften/schild/ampel';
import { euroText } from '@/lib/gesellschaften/modell';
import { TextFeld, Felder, Feldzeile, centEingabe } from '../teile';
import type { SEintrag, Schreiben } from './daten';
import { AmpelChip, AMPEL_FARBE, SchildFuss, datum, klein } from './teile';

const kategorie = (k: string) => RISIKO_KATEGORIEN.find(x => x.id === k)?.label ?? k;
const STUFEN: { id: string; label: string }[] = [1, 2, 3, 4, 5].map(n => ({ id: String(n), label: String(n) }));

export function Risiken({ lage, e, sw, personen }: { lage: GesellschaftLage; e: SEintrag; sw: Schreiben; personen: { id: string; name: string }[] }) {
  const { melden, hinweis } = useRueckgaengig();
  const [offen, setOffen] = useState<string | null>(null);
  const [neu, setNeu] = useState(false);
  const fehlen = RISIKO_KATALOG.filter(r => !(e.risiken ?? []).some(x => !x.geloeschtAm && x.katalogId === r.id));
  const [wahl, setWahl] = useState<string[]>([]);
  const uebernehmen = async (ids: string[]) => { const r = await sw.schreibe({ katalog: ids }); if (r.ok) setWahl([]); };
  const weg = async (r: Risiko) => { const x = await sw.schreibe({ liste: 'risiken', eintragId: r.id, aktion: 'loeschen' }); if (x.ok) melden(`„${r.titel}“ im Papierkorb`, () => void sw.schreibe({ liste: 'risiken', eintragId: r.id, aktion: 'wiederherstellen' })); };
  const z = lage.risiken.find(x => x.r.id === offen);
  return (
    <>
      {lage.runde.faellig && <Hinweis art="achtung" titel={`Quartals-Runde ${lage.runde.quartal.replace('-', ' ')}`}>{lage.runde.anzahl} Risiko{lage.runde.anzahl === 1 ? '' : 's'} {lage.runde.anzahl === 1 ? 'ist' : 'sind'} neu zu bewerten (alle drei Monate).</Hinweis>}
      {lage.anlaesse.length > 0 && <Hinweis art="achtung" titel="Sofort neu bewerten">Seit der letzten Bewertung: {lage.anlaesse.map(a => `${a.text} (${datum(a.am)})`).join(' · ')}.</Hinweis>}
      {lage.aggregation.warnung && <Hinweis art="kritisch" titel="Zusammen bestandsgefährdend?">Die Netto-Wirkungen der roten und gelben Risiken ({euroText(lage.aggregation.summeCent)}) übersteigen die Tragfähigkeit ({lage.aggregation.anteil} %). Mit Steuerbüro oder Kanzlei besprechen.</Hinweis>}
      <Karte>
        <Ueberschrift rechts={!neu && <Knopf leise onClick={() => setNeu(true)}>+ Risiko</Knopf>}>Risiko-Register</Ueberschrift>
        {neu && <RisikoForm sw={sw} personen={personen} fertig={() => setNeu(false)} />}
        {!lage.risiken.length ? <Leerzustand symbol={<ShieldAlert size={22} />} titel="Noch kein Risiko erfasst">Unten den Startkatalog übernehmen — 17 typische Risiken für kleine Gesellschaften, ohne Namen und Zahlen — und bewerten.</Leerzustand> : (
          <Liste>{lage.risiken.map(x => (
            <ZeileAktionen key={x.r.id} titel={x.r.titel} onLoeschen={() => weg(x.r)}>
              <Zeile umbrechen titel={x.r.titel} aktiv={offen === x.r.id} onClick={() => setOffen(o => (o === x.r.id ? null : x.r.id))}
                unter={[kategorie(x.r.kategorie), x.bewertung ? `E ${x.bewertung.eintritt} × W ${x.bewertung.wirkung} = ${x.score} (${x.bewertung.art})` : 'nicht bewertet', x.naechste ? `${x.ueberfaellig ? 'prüfen seit' : 'nächste Prüfung'} ${datum(x.naechste)}` : undefined, x.ohneMassnahme ? 'ohne offene Maßnahme' : undefined].filter(Boolean).join(' · ')}
                rechts={<AmpelChip a={x.ampel} />} />
            </ZeileAktionen>
          ))}</Liste>
        )}
        {z && <RisikoDetail key={z.r.id} z={z} sw={sw} personen={personen} />}
        <SchildFuss>Skala: Eintritt (Wahrscheinlichkeit im Jahr) × Wirkung (relativ zur Tragfähigkeit); rot ab 15 oder Wirkung 5, gelb 8–14 — Annahmen der Recherche.</SchildFuss>
      </Karte>
      <Matrix risiken={lage.risiken} />
      <Karte>
        <Ueberschrift>Tragfähigkeit und Aggregation</Ueberschrift>
        <Felder>
          <Feldzeile label="Risikotragfähigkeit (€)"><TextFeld label="Risikotragfähigkeit in Euro" wert={centEingabe(e.profil?.tragfaehigkeitCent)} platzhalter="größter Verlust ohne Bestandsgefährdung" onFertig={t => void sw.schreibe({ profil: { tragfaehigkeitCent: t || null } })} /></Feldzeile>
        </Felder>
        <div style={{ ...klein, marginTop: 8 }}>
          Summe der Netto-Wirkungen (rot/gelb): {euroText(lage.aggregation.summeCent)}{lage.aggregation.anteil !== undefined ? ` — ${lage.aggregation.anteil} % der Tragfähigkeit` : ''}.
          {lage.aggregation.ohneBetrag > 0 ? ` ${lage.aggregation.ohneBetrag} bewertete Risiken ohne Betrag zählen nicht mit.` : ''} Konzept nach IDW PS 340 (Fachmeinung).
        </div>
      </Karte>
      {fehlen.length > 0 && (
        <Karte>
          <Ueberschrift rechts={<Knopf leise onClick={() => void uebernehmen(fehlen.map(r => r.id))}>Alle {fehlen.length} übernehmen</Knopf>}>Startkatalog</Ueberschrift>
          <div style={{ ...klein, marginBottom: 8 }}>Generische Risiken (Recherche › 3b) — übernommen werden Titel, Kategorie, Indikator und ein Schild als erste Maßnahme. Bewerten müsst ihr selbst.</div>
          <MehrfachPillen liste={fehlen.map(r => ({ id: r.id, label: `${r.id} · ${r.titel}` }))} aktiv={wahl} onWahl={setWahl} />
          {wahl.length > 0 && <div style={{ marginTop: 10 }}><Knopf onClick={() => void uebernehmen(wahl)}>{wahl.length} übernehmen</Knopf></div>}
        </Karte>
      )}
      {hinweis}
    </>
  );
}

function Matrix({ risiken }: { risiken: RisikoZeile[] }) {
  const bewertet = risiken.filter(x => x.bewertung && x.r.status !== 'erledigt');
  if (!bewertet.length) return null;
  const zelle = (e: number, w: number) => bewertet.filter(x => x.bewertung!.eintritt === e && x.bewertung!.wirkung === w);
  return (
    <Karte>
      <Ueberschrift>Matrix (Eintritt × Wirkung)</Ueberschrift>
      <div role="table" aria-label="Risiko-Matrix" style={{ display: 'grid', gridTemplateColumns: '64px repeat(5, minmax(0, 1fr))', gap: 4, fontSize: TYP.bedien }}>
        {[5, 4, 3, 2, 1].map(e => (
          <div key={e} role="row" style={{ display: 'contents' }}>
            <span role="rowheader" style={{ color: C.inkDim, alignSelf: 'center' }}>Eintritt {e}</span>
            {[1, 2, 3, 4, 5].map(w => {
              const l = zelle(e, w);
              const a = ampelVon({ eintritt: e as Stufe, wirkung: w as Stufe });
              return (
                <span key={w} role="cell" title={l.map(x => x.r.titel).join(' · ') || undefined} style={{ minHeight: 40, borderRadius: 8, display: 'grid', placeItems: 'center', border: `1px solid ${RAND.flaeche}`, background: l.length ? TIEF.flaeche(AMPEL_FARBE[a]) : 'transparent', color: l.length ? C.ink : C.inkLeise, fontWeight: l.length ? 700 : 400 }}>
                  {l.length || '·'}
                </span>
              );
            })}
          </div>
        ))}
        <span />
        {[1, 2, 3, 4, 5].map(w => <span key={w} style={{ color: C.inkDim, textAlign: 'center' }}>Wirkung {w}</span>)}
      </div>
    </Karte>
  );
}

function RisikoForm({ sw, personen, fertig, r }: { sw: Schreiben; personen: { id: string; name: string }[]; fertig: () => void; r?: Risiko }) {
  const [w, setW] = useState({ titel: r?.titel ?? '', kategorie: (r?.kategorie ?? 'recht') as RisikoKategorie, ursache: r?.ursache ?? '', ereignis: r?.ereignis ?? '', wirkungText: r?.wirkungText ?? '', indikator: r?.indikator ?? '', behandlung: (r?.behandlung ?? '') as Behandlung | '', verantwortlich: r?.verantwortlich ?? '', rolle: (r?.rolle ?? '') as Rolle | '', status: (r?.status ?? 'offen') as RisikoStatus });
  const [fehler, setFehler] = useState<string | null>(null);
  const setze = (k: keyof typeof w, v: string) => setW(x => ({ ...x, [k]: v }));
  const speichern = async () => {
    setFehler(null);
    const eintrag = { ...w, behandlung: w.behandlung || null, verantwortlich: w.verantwortlich || null, rolle: w.rolle || null, ursache: w.ursache || null, ereignis: w.ereignis || null, wirkungText: w.wirkungText || null, indikator: w.indikator || null };
    const x = await sw.schreibe({ liste: 'risiken', eintrag, ...(r ? { eintragId: r.id } : {}) });
    if (x.ok) fertig(); else setFehler(x.fehler ?? 'Nicht gespeichert.');
  };
  return (
    <form onSubmit={x => { x.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 12, margin: '6px 0 14px' }}>
      <Feldzeile label="Titel"><input value={w.titel} onChange={x => setze('titel', x.target.value)} aria-label="Titel des Risikos" style={eingabe} /></Feldzeile>
      <Feldzeile label="Kategorie">
        <select value={w.kategorie} onChange={x => setze('kategorie', x.target.value)} aria-label="Kategorie" style={{ ...feld, width: '100%' }}>{RISIKO_KATEGORIEN.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
      </Feldzeile>
      <Felder>
        <Feldzeile label="Ursache"><input value={w.ursache} onChange={x => setze('ursache', x.target.value)} aria-label="Ursache" style={eingabe} /></Feldzeile>
        <Feldzeile label="Ereignis"><input value={w.ereignis} onChange={x => setze('ereignis', x.target.value)} aria-label="Ereignis" style={eingabe} /></Feldzeile>
        <Feldzeile label="Wirkung"><input value={w.wirkungText} onChange={x => setze('wirkungText', x.target.value)} aria-label="Wirkung" style={eingabe} /></Feldzeile>
        <Feldzeile label="Frühwarn-Indikator"><input value={w.indikator} onChange={x => setze('indikator', x.target.value)} aria-label="Frühwarn-Indikator" style={eingabe} /></Feldzeile>
        <Feldzeile label="Verantwortlich (Person)">
          <select value={w.verantwortlich} onChange={x => setze('verantwortlich', x.target.value)} aria-label="Verantwortliche Person" style={{ ...feld, width: '100%' }}><option value="">—</option>{personen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </Feldzeile>
        <Feldzeile label="Rolle">
          <select value={w.rolle} onChange={x => setze('rolle', x.target.value)} aria-label="Verantwortliche Rolle" style={{ ...feld, width: '100%' }}><option value="">—</option>{ROLLEN.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </Feldzeile>
      </Felder>
      <Feldzeile label="Behandlung"><Pillen liste={BEHANDLUNGEN.map(b => ({ id: b.id, label: b.label }))} aktiv={w.behandlung || null} onWahl={(b: Behandlung) => setze('behandlung', b)} /></Feldzeile>
      {r && <Feldzeile label="Status"><Pillen liste={RISIKO_STATUS.map(s => ({ id: s.id, label: s.label }))} aktiv={w.status} onWahl={(s: RisikoStatus) => setze('status', s)} /></Feldzeile>}
      {w.behandlung === 'tragen' && <div style={klein}>Ein rotes Risiko bewusst zu tragen gehört in einen Beschluss der Geschäftsführung bzw. der Gesellschafter (Annahme der Recherche).</div>}
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      <div style={{ display: 'flex', gap: 8 }}><Knopf typ="submit" aus={w.titel.trim().length < 2}>Speichern</Knopf><Knopf leise onClick={fertig}>Abbrechen</Knopf></div>
    </form>
  );
}

function RisikoDetail({ z, sw, personen }: { z: RisikoZeile; sw: Schreiben; personen: { id: string; name: string }[] }) {
  const r = z.r;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [b, setB] = useState({ eintritt: String(z.bewertung?.eintritt ?? 3), wirkung: String(z.bewertung?.wirkung ?? 3), art: 'netto' as 'brutto' | 'netto', wirkungCent: '', grund: '' });
  const [neueMassnahme, setNeueMassnahme] = useState('');
  const bewerten = async () => { const x = await sw.schreibe({ bewertung: { risikoId: r.id, eintritt: Number(b.eintritt), wirkung: Number(b.wirkung), art: b.art, ...(b.wirkungCent ? { wirkungCent: b.wirkungCent } : {}), ...(b.grund ? { grund: b.grund } : {}) } }); if (x.ok) setB(v => ({ ...v, grund: '', wirkungCent: '' })); };
  const massnahmen = (l: Massnahme[]) => sw.schreibe({ liste: 'risiken', eintragId: r.id, eintrag: { massnahmen: l } });
  const vorschau = score({ eintritt: Number(b.eintritt) as Stufe, wirkung: Number(b.wirkung) as Stufe });
  const verlauf = [...(r.bewertungen ?? [])].reverse();
  const name = (p?: string) => personen.find(x => x.id === p)?.name ?? (p === '[gelöscht]' ? '(gelöscht)' : p ?? '—');
  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 12, padding: 12, borderRadius: 14, border: `1px solid ${RAND.flaeche}` }}>
      {bearbeiten ? <RisikoForm r={r} sw={sw} personen={personen} fertig={() => setBearbeiten(false)} /> : (
        <div style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>
          {r.ursache && <span>Ursache: {r.ursache}</span>}{r.ereignis && <span>Ereignis: {r.ereignis}</span>}{r.wirkungText && <span>Wirkung: {r.wirkungText}</span>}
          {r.indikator && <span style={{ color: C.inkDim }}>Indikator: {r.indikator}</span>}
          <span style={{ color: C.inkDim }}>Behandlung: {BEHANDLUNGEN.find(x => x.id === r.behandlung)?.label ?? '—'} · Verantwortlich: {[r.verantwortlich ? name(r.verantwortlich) : undefined, ROLLEN.find(x => x.id === r.rolle)?.label].filter(Boolean).join(' · ') || '—'} · Status: {RISIKO_STATUS.find(x => x.id === r.status)?.label}</span>
          <div><Knopf leise onClick={() => setBearbeiten(true)}>Bearbeiten</Knopf></div>
        </div>
      )}
      <section aria-label="Maßnahmen" style={{ display: 'grid', gap: 6 }}>
        <strong style={{ fontSize: TYP.bedien }}>Maßnahmen („Schild“)</strong>
        {(r.massnahmen ?? []).map(m => (
          <label key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 40, fontSize: TYP.bedien, color: m.erledigt ? C.inkDim : C.ink }}>
            <input type="checkbox" checked={!!m.erledigt} onChange={() => void massnahmen((r.massnahmen ?? []).map(x => (x.id === m.id ? { ...x, erledigt: x.erledigt ? undefined : true } : x)))} />
            <span style={{ flex: 1, textDecoration: m.erledigt ? 'line-through' : undefined }}>{m.text}{m.frist ? ` · bis ${datum(m.frist)}` : ''}</span>
            <Knopf leise onClick={() => void massnahmen((r.massnahmen ?? []).filter(x => x.id !== m.id))}>entfernen</Knopf>
          </label>
        ))}
        <form onSubmit={x => { x.preventDefault(); if (neueMassnahme.trim()) void massnahmen([...(r.massnahmen ?? []), { id: neueKennung('ms'), text: neueMassnahme.trim() }]).then(v => { if (v.ok) setNeueMassnahme(''); }); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={neueMassnahme} onChange={x => setNeueMassnahme(x.target.value)} aria-label="Neue Maßnahme" placeholder="Neue Maßnahme" style={{ ...eingabe, flex: '1 1 220px', width: 'auto' }} />
          <Knopf typ="submit" leise aus={!neueMassnahme.trim()}>Hinzufügen</Knopf>
        </form>
      </section>
      <section aria-label="Bewerten" style={{ display: 'grid', gap: 8 }}>
        <strong style={{ fontSize: TYP.bedien }}>Neu bewerten <span style={{ color: C.inkDim, fontWeight: 400 }}>— ergibt {vorschau}</span> <AmpelChip a={ampelVon({ eintritt: Number(b.eintritt) as Stufe, wirkung: Number(b.wirkung) as Stufe })} /></strong>
        <span style={klein}>Eintritt: {EINTRITT_STUFEN[Number(b.eintritt) as Stufe]}</span>
        <Segmente liste={STUFEN} aktiv={b.eintritt} onWahl={v => setB(x => ({ ...x, eintritt: v }))} />
        <span style={klein}>Wirkung: {WIRKUNG_STUFEN[Number(b.wirkung) as Stufe]}</span>
        <Segmente liste={STUFEN} aktiv={b.wirkung} onWahl={v => setB(x => ({ ...x, wirkung: v }))} />
        <Segmente liste={[{ id: 'netto', label: 'netto (nach Maßnahmen)' }, { id: 'brutto', label: 'brutto (vorher)' }]} aktiv={b.art} onWahl={v => setB(x => ({ ...x, art: v as 'brutto' | 'netto' }))} umbrechen />
        <Felder>
          <Feldzeile label="Wirkung in Euro (optional)"><input value={b.wirkungCent} onChange={x => setB(v => ({ ...v, wirkungCent: x.target.value }))} aria-label="Wirkung in Euro" placeholder="z. B. 20.000" style={eingabe} /></Feldzeile>
          <Feldzeile label="Grund"><input value={b.grund} onChange={x => setB(v => ({ ...v, grund: x.target.value }))} aria-label="Grund der Bewertung" style={eingabe} /></Feldzeile>
        </Felder>
        <div><Knopf onClick={() => void bewerten()}>Bewertung festhalten</Knopf></div>
      </section>
      {verlauf.length > 0 && (
        <section aria-label="Verlauf" style={{ display: 'grid', gap: 4 }}>
          <strong style={{ fontSize: TYP.bedien }}>Verlauf</strong>
          {verlauf.map((x, i) => <span key={`${x.am}-${i}`} style={klein}>{datum(x.am)} · E {x.eintritt} × W {x.wirkung} = {score(x)} ({x.art}){x.wirkungCent !== undefined ? ` · ${euroText(x.wirkungCent)}` : ''} · {name(x.von)}{x.grund ? ` — ${x.grund}` : ''}</span>)}
        </section>
      )}
    </div>
  );
}
