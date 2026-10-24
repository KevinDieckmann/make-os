'use client';

// ─── Prozesse — die Stellschrauben eines System-Prozesses (22.10., Branch `prozesse-stellschrauben`) ─────────────────────────────────────────────────────────
// Entscheidung 22.10.: „Alles muss anpassbar sein und immer mal wieder zu bearbeiten.“ Öffnet man einen System-Prozess (Bild, Liste oder Werkstatt), steht neben dem
// Steckbrief, welche Einstellungen dieser Ablauf liest: Wert, Vorgabe, Einheit, Erklärung, wo gespeichert — und, wer darf, ein Feld mit „Speichern“ und
// „Vorgabe“. Geändert wird IMMER über die vorhandene Route des Bestands (lib/prozesse/stellschrauben.ts `anfrageFuer` — gleiche Rechte, Stand/409, Protokoll
// dort); wo die Fachseite schon eine Maske hat, führt ein Link hin. Gesetzlich Festes steht als „fest (Gesetz)“. Rechnet nichts selbst — Werte und Rechte kommen
// vom Server (GET /api/prozesse/landkarte: `stellschrauben` je Prozess, `stellschraubenRechte`, `stellschraubenStand`).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SlidersHorizontal, RotateCcw, Check } from 'lucide-react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Knopf, Chip, Hinweis, Schalter, Klappbar, auswahl as auswahlStil, feld as feldStil } from '../ui';
import {
  abweichend, anfrageFuer, darfAendern, aenderbar, eingabeLesen, wertText, ortSatz, WOCHENTAGE,
  type Stellschraube, type StellschraubenRechte, type StellschraubeWert,
} from '@/lib/prozesse/stellschrauben';
import type { ProzessDef } from '@/lib/prozesse/typen';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
/** Wochentage in der Reihenfolge Mo … So (gespeichert wie getDay: 0 = Sonntag). */
const WOCHE_REIHE = [1, 2, 3, 4, 5, 6, 0] as const;

/** Was eine Änderung bewirkt hat — eine Zeile unter dem Feld. */
type Meldung = { art: 'gut' | 'fehler' | 'konflikt'; text: string } | null;

/** Eine Anfrage an die vorhandene Route schicken (Netzfehler → Satz, nie geworfen). */
async function senden(s: Stellschraube, wert: StellschraubeWert | 'vorgabe', stand: string | undefined): Promise<Meldung> {
  const a = anfrageFuer(s, wert, stand);
  if (!a) return { art: 'fehler', text: 'Diese Stellschraube lässt sich hier nicht ändern.' };
  const r = await fetch(a.url, { method: a.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(a.body) }).catch(() => null);
  if (!r) return { art: 'fehler', text: 'Keine Verbindung — nichts gespeichert.' };
  const j = await r.json().catch(() => null) as { ok?: boolean; fehler?: string; error?: string } | null;
  if (r.status === 409) return { art: 'konflikt', text: j?.fehler ?? 'Inzwischen hat jemand anders geändert — der aktuelle Stand ist geladen. Nichts gespeichert.' };
  if (!r.ok || j?.ok === false) return { art: 'fehler', text: String(j?.fehler ?? j?.error ?? `Nicht gespeichert (${r.status}).`) };
  return { art: 'gut', text: wert === 'vorgabe' ? 'Auf die Vorgabe zurückgesetzt.' : 'Gespeichert.' };
}

/** Warum eine Person eine Stellschraube nicht ändern darf — ein Satz je Weg. */
const OHNE_RECHT: Readonly<Record<string, string>> = {
  prozesse: 'Ändern dürfen volle Mitglieder des Haushalts.',
  mahntage: 'Die Mahnstufen ändert, wer vollen Zugang zu den Finanzen hat.',
};

function Feld({ s, darf, stand, onGespeichert }: { s: Stellschraube; darf: boolean; stand: string | undefined; onGespeichert: () => Promise<void> | void }) {
  const alsText = (w: StellschraubeWert) => (Array.isArray(w) ? w.join(', ') : w === null ? '' : String(w));
  const [text, setText] = useState(() => alsText(s.wert));
  // Neuer Wert vom Server (nach dem Speichern bzw. von jemand anders): das Feld folgt — die Meldung darunter bleibt stehen.
  const wertSchluessel = JSON.stringify(s.wert);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nur, wenn sich der Wert ändert
  useEffect(() => { setText(alsText(s.wert)); }, [wertSchluessel]);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<Meldung>(null);
  // Abweichung zählt nur bei Stellschrauben, die sich ändern lassen (Ansichts-Zeilen haben keine Vorgabe).
  const anders = aenderbar(s) && abweichend(s);
  const vorgabeText = s.vorgabe !== undefined ? wertText(s, s.vorgabe) : null;

  const speichern = async (wert: StellschraubeWert | 'vorgabe') => {
    setLaeuft(true); setMeldung(null);
    const m = await senden(s, wert, stand);
    setMeldung(m);
    // Gespeichert oder von jemand anders geändert: den Stand neu holen (EINE Wahrheit — der Wert kommt vom Server).
    if (m?.art !== 'fehler') await onGespeichert();
    setLaeuft(false);
  };
  const ausText = () => { const e = eingabeLesen(s, text); if (!e.ok) { setMeldung({ art: 'fehler', text: e.fehler }); return; } void speichern(e.wert); };

  let eingabe: ReactNode = null;
  if (darf) {
    if (s.art === 'schalter') {
      eingabe = <Schalter an={s.wert === true} aus={laeuft} onChange={v => void speichern(v)} erklaerung={[{ kopf: s.name, text: s.erklaerung }]}>{s.wert === true ? 'an' : 'aus'}</Schalter>;
    } else if (s.art === 'stunde' || s.art === 'wochentag') {
      const optionen = s.art === 'stunde' ? Array.from({ length: 24 }, (_, h) => ({ v: h, t: `ab ${h} Uhr` })) : WOCHE_REIHE.map(w => ({ v: w, t: WOCHENTAGE[w] }));
      eingabe = (
        <select aria-label={s.name} value={String(s.wert)} disabled={laeuft} style={auswahlStil} onChange={e => void speichern(Number(e.target.value))}>
          {optionen.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>
      );
    } else {
      eingabe = (
        <form className="pz-schraube-form" onSubmit={e => { e.preventDefault(); ausText(); }}>
          <input aria-label={s.name} value={text} disabled={laeuft} inputMode={s.art === 'tage-liste' ? 'text' : 'decimal'} onChange={e => setText(e.target.value)}
            placeholder={vorgabeText && vorgabeText !== '—' ? `Vorgabe ${vorgabeText}` : 'leer = keins'} style={{ ...feldStil, maxWidth: 160 }} />
          {s.einheit && <span style={klein}>{s.einheit}</span>}
          <Knopf typ="submit" leise aus={laeuft}><span className="pz-knopf-inhalt"><Check size={14} aria-hidden />{laeuft ? 'Speichert …' : 'Speichern'}</span></Knopf>
        </form>
      );
    }
  }

  return (
    <li className="pz-schraube">
      <div className="pz-schraube-kopf">
        <span style={{ fontWeight: 600, color: C.ink, minWidth: 0 }}>{s.name}</span>
        <span style={{ color: anders ? C.aktiv : C.ink, fontWeight: 600, whiteSpace: 'nowrap' }}>{wertText(s, s.wert)}</span>
      </div>
      <p style={klein}>{s.erklaerung}</p>
      {s.art === 'fest' ? <Chip farbe={C.inkDim}>{s.fest ?? 'fest (Gesetz)'}</Chip> : null}
      {eingabe && <div className="pz-schraube-eingabe">{eingabe}</div>}
      <div className="pz-schraube-fuss">
        {anders && vorgabeText !== null && <span style={klein}>{`Vorgabe: ${vorgabeText}`}</span>}
        {darf && anders && s.vorgabe !== undefined && (
          <Knopf leise aus={laeuft} onClick={() => speichern('vorgabe')} titel="Zurück auf die Vorgabe — danach ist nichts mehr gespeichert">
            <span className="pz-knopf-inhalt"><RotateCcw size={13} aria-hidden />Vorgabe</span>
          </Knopf>
        )}
        {s.link && <Knopf leise href={s.link.href}>{`${s.link.text} ›`}</Knopf>}
      </div>
      {!darf && aenderbar(s) && s.weg && <p style={{ ...klein, color: C.inkLeise }}>{OHNE_RECHT[s.weg.art] ?? 'Ändern darf, wer die Fachseite bearbeiten darf.'}</p>}
      <p style={{ ...klein, color: C.inkLeise }}>{ortSatz(s.wo)}</p>
      {meldung && <Hinweis art={meldung.art === 'gut' ? 'gut' : meldung.art === 'konflikt' ? 'achtung' : 'kritisch'} rolle={meldung.art === 'gut' ? 'status' : 'alert'}>{meldung.text}</Hinweis>}
    </li>
  );
}

/**
 * Der Abschnitt „Stellschrauben“ — als Ganzes zugeklappt (Feinschliff 1, 23.10.: in „Automationen & Head“ stehen viele System-Prozesse untereinander, offen
 * wurde die Seite sehr lang); aufgeklappt je Gruppe aufklappbar (die erste offen). `offen` = aufgeklappt beginnen. `rechte` = was diese Person je Weg ändern darf
 * (vom Server), `stand` = Stand des Bestands der neuen Stellschrauben (409), `onGespeichert` lädt die Landkarte neu (danach zeigt das Feld den Wert des Servers).
 */
export function StellschraubenKarte({ p, rechte, stand, onGespeichert, offen: offenAnfang = false }: {
  p: ProzessDef; rechte: StellschraubenRechte | undefined; stand: string | undefined; onGespeichert: () => Promise<void> | void; offen?: boolean;
}) {
  const [auf, setAuf] = useState(offenAnfang);
  const gruppen = useMemo(() => {
    const m = new Map<string, Stellschraube[]>();
    for (const s of p.stellschrauben ?? []) { const g = s.gruppe ?? 'Allgemein'; m.set(g, [...(m.get(g) ?? []), s]); }
    return [...m.entries()];
  }, [p.stellschrauben]);
  const [offen, setOffen] = useState<ReadonlySet<string>>(() => new Set(gruppen.slice(0, 1).map(([g]) => g)));
  if (!gruppen.length) return null;
  const einstellbar = (p.stellschrauben ?? []).filter(aenderbar).length;
  const darfIrgendwas = (p.stellschrauben ?? []).some(s => darfAendern(s, rechte));
  const anders = (p.stellschrauben ?? []).filter(s => aenderbar(s) && abweichend(s)).length;
  return (
    <Karte flach>
      <Klappbar id={`pz-schrauben-${p.id}`} titel="Stellschrauben" offen={auf} umschalten={() => setAuf(x => !x)} zaehler={anders}
        rechts={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', ...klein }}><SlidersHorizontal size={13} aria-hidden />{einstellbar ? `${einstellbar} einstellbar` : 'nur ansehen'}</span>}>
      <p style={klein}>
        {darfIrgendwas
          ? 'Was dieser Ablauf liest — hier geändert, wirkt es sofort; gespeichert wird nur, was von der Vorgabe abweicht.'
          : 'Was dieser Ablauf liest. Ändern dürfen es die Personen, die auch die Fachseite bearbeiten dürfen.'}
      </p>
      {gruppen.map(([g, l]) => (
        <Klappbar key={g} id={`pz-schrauben-${p.id}-${g}`} titel={<span style={{ ...MIKRO, textTransform: 'none', letterSpacing: 0, fontSize: TYP.bedien, color: C.ink }}>{g}</span>}
          zaehler={l.filter(s => aenderbar(s) && abweichend(s)).length} offen={offen.has(g)}
          umschalten={() => setOffen(o => { const n = new Set(o); if (n.has(g)) n.delete(g); else n.add(g); return n; })}>
          <ul className="pz-schrauben-liste" aria-label={`Stellschrauben: ${g}`}>
            {l.map(s => <Feld key={s.id} s={s} darf={darfAendern(s, rechte)} stand={stand} onGespeichert={onGespeichert} />)}
          </ul>
        </Klappbar>
      ))}
      </Klappbar>
    </Karte>
  );
}
