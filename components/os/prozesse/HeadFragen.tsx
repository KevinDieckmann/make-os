'use client';

// ─── Prozesse · Werkstatt — „Head fragen“ (22.10.; Kundengewinnung „Heads setzen Prozesse mit auf“) ─────────────────────────────────────────────────────
// Ein Head schlägt vor: Bausteine für den offenen Prozess bzw. einen ganzen Entwurf aus Ziel und Steckbrief. Vor dem Klick: ob die KI da ist und was es ungefähr
// kostet (ohne KI: Regelwerk aus der passenden Vorlage, kostenlos). Das Ergebnis liegt IMMER als Vorschlag im ZOE-Stapel (Freigaben) — hier sichtbar mit dem
// Unterschied zum Entwurf; „Übernehmen“ legt einen neuen Prozess an bzw. fügt die Schritte hinzu (bestehende bleiben, wie sie sind), „Ablehnen“ verwirft.
// Daten nur über /api/prozesse/head (bzw. /api/zoe/stapel zum Ablehnen) — rein darstellend.

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, LEUCHT } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, feld, auswahl as auswahlStil, Pillen, Chip, Karte } from '../ui';
import { Fenster } from '../Fenster';
import { KiMarke } from '../KiMarke';
import { neueKennung } from '@/lib/kennung';
import { PROZESS_BEREICHE, FALL_ARTEN, type FallArt, type ProzessBereich } from '@/lib/prozesse/definition';
import type { HeadDiff } from '@/lib/prozesse/kundengewinnung/head';
import { VorschauBild } from './VorlagenGalerie';

const QUELLE = '/api/prozesse/head';
const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
type Offen = { id: string; titel: string; art: 'prozess' | 'baustein'; quelle: 'ki' | 'regelwerk'; zeit: string; diff: HeadDiff; hinweise: string[] };
type Stand = { ki: boolean; grund?: 'schluessel' | 'guthaben'; modell: string; kosten: { cent: number; text: string }; vorschlaege: Offen[]; rechte: { entwurf: boolean } };
export interface HeadProzess { id: string; titel: string; bereich?: ProzessBereich; fallArt?: FallArt; beschreibung?: string; phasen: { id: string; titel: string }[] }

async function senden(url: string, body: Record<string, unknown>): Promise<{ status: number; j: Record<string, unknown> | null }> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  return { status: r?.status ?? 0, j: r ? await r.json().catch(() => null) : null };
}

/** Der Unterschied zum Entwurf — ein ganzer Entwurf als Bild, Bausteine als „+“-Liste mit Ort. */
export function HeadUnterschied({ diff }: { diff: HeadDiff }) {
  if (diff.art === 'prozess') {
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <p style={klein}>{`Neuer Prozess „${diff.titel}“ — ${diff.schritte} Schritte, ${diff.freigaben} Freigabe${diff.freigaben === 1 ? '' : 'n'}. Bestehende Prozesse bleiben unberührt.`}</p>
        <VorschauBild phasen={diff.phasen} />
      </div>
    );
  }
  if (diff.fehlt) return <Hinweis art="achtung">{diff.fehlt}</Hinweis>;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <p style={klein}>{`In „${diff.phase}“ ${diff.wo}:`}</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: TYP.body, color: C.ink }}>{diff.neu.map((s, i) => <li key={`${s.titel}-${i}`}>{`+ ${s.titel}`}</li>)}</ul>
      <p style={klein}>{`Bestehende Schritte bleiben, wie sie sind (${diff.bleiben}).`}</p>
    </div>
  );
}

export function HeadFragenFenster({ prozess, onZu, onUebernommen, gesperrt }: {
  /** Der offene Prozess (Bausteine) — ohne: nur „ganzer Entwurf“. */
  prozess?: HeadProzess | null;
  onZu: () => void;
  onUebernommen: (r: { art: 'prozess' | 'baustein'; prozessId: string; text: string }) => Promise<void> | void;
  /** Warum Bausteine gerade nicht übernommen werden (z. B. ungespeicherte Änderungen). */
  gesperrt?: string | null;
}) {
  const [modus, setModus] = useState<'baustein' | 'prozess'>(prozess ? 'baustein' : 'prozess');
  const [ziel, setZiel] = useState(prozess && !prozess.phasen.length ? prozess.beschreibung ?? '' : '');
  const [bereich, setBereich] = useState<ProzessBereich>(prozess?.bereich ?? 'sales');
  const [fallArt, setFallArt] = useState<FallArt>(prozess?.fallArt ?? 'lead');
  const [phaseId, setPhaseId] = useState(prozess?.phasen.at(-1)?.id ?? '');
  const [mitKi, setMitKi] = useState(true);
  const [stand, setStand] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [anfrageId, setAnfrageId] = useState(() => neueKennung('pzh'));

  const laden = useCallback(async () => {
    const url = modus === 'baustein' && prozess ? `${QUELLE}?prozess=${encodeURIComponent(prozess.id)}` : QUELLE;
    const r = await fetch(url, { cache: 'no-store' }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (r?.ok && j?.ok) setStand(j as Stand); else setFehler(String(j?.fehler ?? 'Der Head ist gerade nicht erreichbar.'));
  }, [modus, prozess]);
  useEffect(() => { void laden(); }, [laden]);

  const fragen = async () => {
    setFehler(null); setMeldung(null); setLaeuft(true);
    const r = await senden(QUELLE, {
      aktion: 'fragen', art: modus, ziel: ziel.trim(), bereich, fallArt, anfrageId, ki: mitKi && !!stand?.ki,
      ...(modus === 'baustein' && prozess ? { prozessId: prozess.id, ...(phaseId ? { phaseId } : {}) } : {}),
    });
    setLaeuft(false);
    setAnfrageId(neueKennung('pzh'));
    if (r.status === 200 && r.j?.ok) { setMeldung('Der Vorschlag liegt jetzt auch in den Freigaben — hier übernehmen oder ablehnen.'); await laden(); return; }
    setFehler(String(r.j?.fehler ?? 'Der Head konnte gerade nichts vorschlagen.'));
  };
  const uebernehmen = async (v: Offen) => {
    setFehler(null);
    const r = await senden(QUELLE, { aktion: 'uebernehmen', id: v.id });
    const pid = typeof r.j?.prozessId === 'string' ? r.j.prozessId : null;
    if (r.status === 200 && r.j?.ok && pid) { await onUebernommen({ art: v.art, prozessId: pid, text: String(r.j.ergebnis ?? 'Übernommen.') }); await laden(); return; }
    setFehler(String(r.j?.fehler ?? 'Nicht übernommen.'));
  };
  const ablehnen = async (v: Offen) => {
    setFehler(null);
    const r = await senden('/api/zoe/stapel', { id: v.id, entscheidung: 'ablehnen' });
    if (r.status === 200 && r.j?.ok) { await laden(); return; }
    setFehler(String(r.j?.error ?? r.j?.fehler ?? 'Nicht abgelehnt.'));
  };

  const offen = stand?.vorschlaege ?? [];
  const ohneKiText = stand?.grund === 'guthaben' ? 'Das KI-Guthaben ist gerade leer — der Head schlägt aus dem Regelwerk vor (passende Vorlage).' : 'Ohne KI-Zugang schlägt der Head aus dem Regelwerk vor (passende Vorlage).';
  return (
    <Fenster titel="Head fragen" onZu={onZu} breit={760}>
      <p style={klein}>Ein Head schlägt vor — übernommen wird erst mit deinem Klick. Bausteine kommen nur dazu (bestehende Schritte bleiben, wie sie sind); ein ganzer Entwurf wird ein neuer Prozess.</p>
      {prozess && <Pillen<'baustein' | 'prozess'> liste={[{ id: 'baustein', label: `Bausteine für „${prozess.titel}“` }, { id: 'prozess', label: 'Ganzer Entwurf (neuer Prozess)' }]} aktiv={modus} onWahl={setModus} />}
      <Feldzeile label={modus === 'prozess' ? 'Ziel des Prozesses (in eigenen Worten) *' : 'Wunsch (optional) — was soll dazukommen?'}>
        <textarea aria-label="Ziel" value={ziel} maxLength={1000} rows={3} onChange={e => setZiel(e.target.value)} style={{ ...feld, resize: 'vertical' }}
          placeholder={modus === 'prozess' ? 'z. B. Neue Anfragen innerhalb eines Tages beantworten und qualifizieren' : 'z. B. eine Erinnerung, wenn keine Antwort kommt'} />
      </Feldzeile>
      {modus === 'prozess' && (
        <>
          <Feldzeile label="Bereich"><Pillen liste={PROZESS_BEREICHE.map(b => ({ id: b.id, label: b.titel }))} aktiv={bereich} onWahl={setBereich} /></Feldzeile>
          <Feldzeile label="Woran hängt ein Lauf?"><Pillen liste={FALL_ARTEN.map(f => ({ id: f.id, label: f.titel }))} aktiv={fallArt} onWahl={setFallArt} /></Feldzeile>
        </>
      )}
      {modus === 'baustein' && prozess && prozess.phasen.length > 1 && (
        <Feldzeile label="In welche Phase?">
          <select aria-label="Phase" value={phaseId} onChange={e => setPhaseId(e.target.value)} style={{ ...auswahlStil, width: '100%' }}>
            {prozess.phasen.map(p => <option key={p.id} value={p.id}>{p.titel}</option>)}
          </select>
        </Feldzeile>
      )}
      {stand && (stand.ki
        ? <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, color: C.inkDim, minHeight: 44 }}>
            <input type="checkbox" checked={mitKi} onChange={e => setMitKi(e.target.checked)} />
            {mitKi ? `Mit KI (Stufe des Heads) — ${stand.kosten.text}. Ans Modell geht nur der Aufbau, nie Kontaktdaten.` : 'Ohne KI — Vorschlag aus dem Regelwerk (kostenlos).'}
          </label>
        : <p style={klein}>{ohneKiText}</p>)}
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      {meldung && <Hinweis art="gut">{meldung}</Hinweis>}
      <div><Knopf haupt aus={laeuft || !stand?.rechte.entwurf || (modus === 'prozess' && ziel.trim().length < 3)} onClick={fragen}><span className="pz-knopf-inhalt"><Sparkles size={16} aria-hidden />{laeuft ? 'Der Head denkt …' : 'Head fragen'}</span></Knopf></div>
      {offen.length > 0 && (
        <section style={{ display: 'grid', gap: 12, marginTop: 8 }} aria-label="Offene Vorschläge des Heads">
          <div style={{ ...MIKRO }}>Offene Vorschläge</div>
          {offen.map(v => (
            <Karte key={v.id} flach dicht style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <b style={{ fontSize: TYP.body, color: C.ink }}>{v.titel}</b>
                <Chip farbe={v.quelle === 'ki' ? LEUCHT.business : C.inkDim}>{v.quelle === 'ki' ? 'KI-Vorschlag' : 'Regelwerk'}</Chip>
              </div>
              {v.quelle === 'ki' && <KiMarke />}
              <HeadUnterschied diff={v.diff} />
              {v.hinweise.length > 0 && <ul style={{ ...klein, paddingLeft: 18 }}>{v.hinweise.slice(0, 6).map((h, i) => <li key={i}>{h}</li>)}</ul>}
              {v.art === 'baustein' && gesperrt && <Hinweis art="achtung">{gesperrt}</Hinweis>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Knopf haupt aus={(v.art === 'baustein' && !!gesperrt) || (v.diff.art === 'baustein' && !!v.diff.fehlt)} onClick={() => uebernehmen(v)}><span className="pz-knopf-inhalt"><Check size={16} aria-hidden />Übernehmen</span></Knopf>
                <Knopf leise onClick={() => ablehnen(v)}><span className="pz-knopf-inhalt"><X size={16} aria-hidden />Ablehnen</span></Knopf>
              </div>
            </Karte>
          ))}
        </section>
      )}
    </Fenster>
  );
}
