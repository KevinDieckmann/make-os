'use client';

// ─── Stammdaten › Wertelisten — pflegen, woran die Regeln hängen ────────────
// Pipeline-Stufen (Wahrscheinlichkeit, wie bisher) · Verlustgründe (fest +
// eigene) · Kadenz je Kreis (wirkt im Follow-up › Kadenz) · Gesprächsergebnisse
// (fest + eigene) · Ziele je Monat mit dem Ist daneben. Jede Änderung geht
// sofort in die Anzeige (optimistisch) und per POST auf den Server; lehnt er
// ab, springt die Anzeige zurück und der Grund steht sichtbar darunter.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Chip, Knopf, Liste, Zeile, LEUCHT, feld } from '../../schlank';
import { Feld } from '../teile';
import { euro } from '../daten';
import { KREISE, KREIS_WORT, ZIEL_FELDER, KADENZ_MIN, KADENZ_MAX, GRUND_MIN, GRUND_MAX, ERGEBNIS_MIN, ERGEBNIS_MAX } from '@/lib/crm/wertelisten';
import { HERKUNFT, RECHTSGRUNDLAGEN } from '@/lib/make-one/crm';
import type { WertelistenAntwort, StammdatenPost } from './typen';

const hinweis = { fontSize: 12, color: C.inkLeise, lineHeight: 1.5 } as const;

/** Eingabe + Knopf für einen neuen Listenwert — Enter oder Klick, danach leer. */
function NeuerWert({ platzhalter, max, aus, onNeu }: { platzhalter: string; max: number; aus?: boolean; onNeu: (t: string) => void }) {
  const [t, setT] = useState('');
  const ab = () => { const x = t.replace(/\s+/g, ' ').trim(); if (!x) return; onNeu(x); setT(''); };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
      <input value={t} maxLength={max} placeholder={platzhalter} aria-label={platzhalter} disabled={aus} onChange={e => setT(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ab(); } }}
        style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'min(100%, 280px)' }} />
      <Knopf leise aus={aus || !t.trim()} onClick={ab}>Hinzufügen</Knopf>
    </div>
  );
}

/** Ein Wert als Chip — feste Werte ohne Kreuz, eigene mit „entfernen“. */
function WertChip({ text, fest, farbe, onWeg }: { text: string; fest: boolean; farbe?: string; onWeg?: () => void }) {
  return (
    <Chip farbe={farbe ?? (fest ? C.inkDim : C.aktiv)}>
      <span title={fest ? 'Fest — daran hängen Regeln im Code' : 'Eigener Wert'}>{text}</span>
      {!fest && onWeg && <button onClick={onWeg} aria-label={`${text} entfernen`} title="Entfernen" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 13, opacity: .8 }}>×</button>}
    </Chip>
  );
}

export function Wertelisten({ w, post, laeuft, zuBereich }: { w: WertelistenAntwort; post: StammdatenPost; laeuft: boolean; zuBereich: (b: string, a?: string) => void }) {
  const [lokal, setLokal] = useState(w);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => { setLokal(w); }, [w]);

  /** Teil-Update senden: erst die Anzeige, dann der Server — bei Ablehnung zurück auf den Server-Stand. */
  const sende = async (teil: Record<string, unknown>, optimistisch: (x: WertelistenAntwort) => WertelistenAntwort) => {
    setFehler(null);
    setLokal(optimistisch);
    const r = await post({ aktion: 'wertelisten', wertelisten: teil });
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht gespeichert.'); setLokal(w); }
  };
  const eigeneGruende = lokal.verlustgruende.filter(g => !g.fest).map(g => g.grund);
  const eigeneErgebnisse = lokal.ergebnisse.filter(e => !e.fest).map(e => e.wert);
  const setzeGruende = (liste: string[]) => sende({ verlustgruende: liste }, x => ({ ...x, verlustgruende: [...x.verlustgruende.filter(g => g.fest), ...liste.map(grund => ({ grund, fest: false, anzahl: x.verlustgruende.find(g => g.grund === grund)?.anzahl ?? 0 }))] }));
  const setzeErgebnisse = (liste: string[]) => sende({ ergebnisse: liste }, x => ({ ...x, ergebnisse: [...x.ergebnisse.filter(e => e.fest), ...liste.map(wert => ({ wert, label: wert, fest: false }))] }));
  const setzeKadenz = (kreis: string, wert: string) => {
    const n = wert.trim() === '' ? null : Number(wert);
    return sende({ kadenzTage: { [kreis]: n } }, x => ({ ...x, kadenzTage: { ...x.kadenzTage, [kreis]: n === null || !Number.isFinite(n) ? x.kadenzStandard[kreis] : n } }));
  };
  const setzeZiel = (id: keyof WertelistenAntwort['ziele'], wert: string) => {
    const n = wert.trim() === '' ? null : Number(wert);
    return sende({ ziele: { [id]: n } }, x => { const z = { ...x.ziele }; if (n === null || !Number.isFinite(n)) delete z[id]; else z[id] = n; return { ...x, ziele: z }; });
  };
  const istText = (id: keyof WertelistenAntwort['ziele']) => {
    const i = lokal.ist;
    if (id === 'umsatzNeuMonat') return i.umsatzNeu30 === null ? 'noch kein gewonnener Deal' : `zuletzt ${euro(i.umsatzNeu30)} in 30 Tagen`;
    if (id === 'sqlMonat') return i.sql30 === null ? 'noch kein Deal angelegt' : `zuletzt ${i.sql30} in 30 Tagen`;
    return i.gespraecheWoche === null ? 'noch kein Gespräch im Verlauf' : `zuletzt ${i.gespraecheWoche} in 7 Tagen`;
  };

  return (
    <>
      {fehler && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{fehler}</div>}
      <Karte i={0}>
        <Ueberschrift>Pipeline-Stufen</Ueberschrift>
        <div style={{ ...hinweis, marginBottom: 8 }}>Die Wahrscheinlichkeiten sind vorsichtige Startwerte. Sobald je Stufe genug Abschlüsse da sind, ersetzt du sie durch gemessene Quoten — von Hand gesetzte Werte sind markiert.</div>
        <Liste>
          {lokal.stufen.map(s => (
            <Zeile key={s.id} titel={s.label} unter={s.offen ? `Weiter, wenn: ${s.weiterWenn}` : 'Endzustand'}
              rechts={s.offen ? <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {s.vonHand && <Chip farbe={LEUCHT.achtung}>von Hand</Chip>}
                <Feld typ="number" breite={80} wert={String(s.p)} platzhalter="%" onFertig={x => void post({ aktion: 'wahrscheinlichkeit', stufe: s.id, p: x === '' ? null : Number(x) })} />
                <span style={{ fontSize: 12, color: C.inkLeise }}>%</span>
                {s.vonHand && <button onClick={() => void post({ aktion: 'wahrscheinlichkeit', stufe: s.id, p: null })} title={`Zurück auf ${s.standard} %`} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>↺ {s.standard}</button>}
              </span> : <Chip farbe={C.inkDim}>{s.p} %</Chip>} />
          ))}
        </Liste>
      </Karte>

      <Karte i={1}>
        <Ueberschrift rechts={`${eigeneGruende.length} eigene`}>Verlustgründe</Ueberschrift>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {lokal.verlustgruende.map(v => <WertChip key={v.grund} text={`${v.grund}${v.anzahl ? ` · ${v.anzahl}` : ''}`} fest={v.fest} farbe={v.anzahl ? LEUCHT.kritisch : undefined} onWeg={() => void setzeGruende(eigeneGruende.filter(g => g !== v.grund))} />)}
        </div>
        <NeuerWert platzhalter={`Neuer Verlustgrund (${GRUND_MIN}–${GRUND_MAX} Zeichen)`} max={GRUND_MAX} aus={laeuft} onNeu={t => void setzeGruende([...eigeneGruende, t])} />
        <div style={{ ...hinweis, marginTop: 8 }}>Pflicht beim Verlieren eines Deals — daraus lernt die Pipeline (Win/Loss). Graue Gründe sind fest; eigene stehen sofort in der Pipeline und der Deal-Akte zur Wahl. Ein entfernter Grund bleibt an alten Deals stehen.</div>
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts={<Knopf leise onClick={() => zuBereich('followup', 'kadenz')}>Follow-up › Kadenz</Knopf>}>Kadenz je Kreis</Ueberschrift>
        <div style={{ ...hinweis, marginBottom: 6 }}>Wirkt im Follow-up › Kadenz: nach so vielen Tagen ohne Kontakt wird eine Person fällig. Ein eigener Takt an der Person geht vor. {KADENZ_MIN}–{KADENZ_MAX} Tage; leer = Standard.</div>
        <Liste>
          {KREISE.map(k => {
            const takt = lokal.kadenzTage[k] ?? lokal.kadenzStandard[k];
            const standard = lokal.kadenzStandard[k];
            const eigen = takt !== standard;
            return (
              <Zeile key={k} titel={`${k} · ${KREIS_WORT[k]}`} unter={`${lokal.kadenzPersonen[k] ?? 0} Personen · Standard ${standard} Tage`}
                rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {eigen && <Chip farbe={LEUCHT.achtung}>eigen</Chip>}
                  <Feld typ="number" breite={80} wert={String(takt)} platzhalter="Tage" onFertig={x => void setzeKadenz(k, x)} />
                  <span style={{ fontSize: 12, color: C.inkLeise }}>Tage</span>
                  {eigen && <button onClick={() => void setzeKadenz(k, '')} title={`Zurück auf ${standard} Tage`} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>↺ {standard}</button>}
                </span>} />
            );
          })}
        </Liste>
      </Karte>

      <Karte i={3}>
        <Ueberschrift rechts={`${eigeneErgebnisse.length} eigene`}>Gesprächsergebnisse</Ueberschrift>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {lokal.ergebnisse.map(e => <WertChip key={e.wert} text={e.label} fest={e.fest} onWeg={() => void setzeErgebnisse(eigeneErgebnisse.filter(x => x !== e.wert))} />)}
        </div>
        <NeuerWert platzhalter={`Eigenes Ergebnis (${ERGEBNIS_MIN}–${ERGEBNIS_MAX} Zeichen)`} max={ERGEBNIS_MAX} aus={laeuft} onNeu={t => void setzeErgebnisse([...eigeneErgebnisse, t])} />
        <div style={{ ...hinweis, marginTop: 8 }}>Die festen Ergebnisse setzen per Regel den nächsten Schritt (nicht erreicht → 2 Werktage, Mailbox → 3, Sperre → Werbesperre). Eigene Ergebnisse werden hier geführt und stehen für das Erledigen von Follow-ups bereit.</div>
      </Karte>

      <Karte i={4}>
        <Ueberschrift rechts={`${lokal.ist.dealsOffen} offene Deals`}>Ziele je Monat</Ueberschrift>
        <div style={{ ...hinweis, marginBottom: 6 }}>Die Messlatte für die Kennzahlen: Umsatz neu, neue SQL und echte Gespräche. Daneben steht, was zuletzt gemessen wurde — leer = kein Ziel gesetzt.</div>
        <Liste>
          {ZIEL_FELDER.map(z => (
            <Zeile key={z.id} titel={z.label} unter={istText(z.id)}
              rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Feld typ="number" breite={110} wert={lokal.ziele[z.id] === undefined ? '' : String(lokal.ziele[z.id])} platzhalter="Ziel" onFertig={x => void setzeZiel(z.id, x)} />
                <span style={{ fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' }}>{z.einheit}</span>
              </span>} />
          ))}
        </Liste>
      </Karte>

      <Karte i={5}>
        <Ueberschrift>Herkunft & Rechtsgrundlage</Ueberschrift>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{HERKUNFT.map(h => <Chip key={h.id} farbe={h.fremd ? LEUCHT.achtung : C.inkDim}>{h.label}{h.fremd ? ' · Art. 14' : ''}</Chip>)}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{RECHTSGRUNDLAGEN.map(r => <Chip key={r.id} farbe={C.inkDim}>{r.label} · {r.norm}</Chip>)}</div>
        </div>
        <div style={{ ...hinweis, marginTop: 8 }}>Fest — daran hängen Art. 14, die Kanal-Ampel und die Selbstprüfung.</div>
      </Karte>
    </>
  );
}
