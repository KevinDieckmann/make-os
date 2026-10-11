'use client';

// ─── Unternehmen › Ereignis-Assistent „Was ist passiert?“ (11.10.) ──────────────────────────────────────────────────────────────────
// Eine Antwort → die ganze Folgekette als Bild (Phasen Beschluss → Notar → Einlage → Handelsregister → Transparenzregister → Behörden → informieren →
// intern), jeder Schritt mit Frist. „Als Vorschläge anlegen“ schreibt NUR über die vorhandenen Wege: der Beschluss als Entwurf ins Beschluss-Buch
// (Register), das Ereignis mit den angehakten Zusatz-Schritten in den Pflichten-Kalender (Schild) — daraus Kalender-Fristen und, im Vorlauf, Aufgaben.
// Nichts geht nach außen. Regeln: lib/gesellschaften/schild/assistent.ts. Hinweis, keine Rechtsberatung.

import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT, RAND, TIEF, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Pillen, Feldzeile, Klappbar, eingabe } from '../../ui';
import { WEG } from '@/lib/wege';
import { SITUATIONEN, situationVon, folgekette, zusatzWahl, beschlussEntwurf, ereignisEintraege, ASSISTENT_HINWEIS, type Situation } from '@/lib/gesellschaften/schild/assistent';
import { beschlussVorlageVon } from '@/lib/gesellschaften/beschluss-vorlagen';
import type { Lage } from '@/lib/gesellschaften/schild/ampel';
import { tagText } from '@/lib/gesellschaften/schild/zeit';
import { useSchreiber, type GAnzeige, type RegisterDaten } from '../teile';
import { useSchildSchreiber, SCHILD_EREIGNIS, type SEintrag, type SchildDaten } from '../schild/daten';
import { WasSeheIch, beschriftung, klein } from './teile';

export function Assistent({ lage, daten, schild, gewaehlt, situation, heute, waehle, ersetzenRegister, ersetzenSchild, schliessen }: {
  lage: Lage; daten: RegisterDaten; schild: SchildDaten; gewaehlt?: string; situation?: string; heute: string;
  waehle: (q: { w?: string; e?: string }) => void; ersetzenRegister: (g: GAnzeige) => void; ersetzenSchild: (e: SEintrag) => void; schliessen: () => void;
}) {
  const liste = lage.gesellschaften;
  const gid = liste.find(x => x.id === gewaehlt)?.id ?? liste.find(x => x.kontext.aktiv)?.id ?? liste[0]?.id;
  const sit = situationVon(situation);
  const g = daten.gesellschaften.find(x => x.id === gid);
  return (
    <Karte ton={C.aktiv}>
      <Ueberschrift erklaerung="unternehmen.assistent" rechts={<Knopf leise onClick={schliessen}>Schließen</Knopf>}>Was ist passiert?</Ueberschrift>
      <span style={klein}>Wähle die Gesellschaft und was passiert ist — MAKE OS zeigt die ganze Kette von Schritten mit Fristen und legt sie auf Klick an.</span>
      {liste.length > 1 && <div style={{ marginTop: 10 }}><Pillen liste={liste.map(x => ({ id: x.id, label: x.name }))} aktiv={gid ?? null} onWahl={w => waehle({ w, e: situation })} /></div>}
      <div role="group" aria-label="Was ist passiert?" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', marginTop: 12 }}>
        {SITUATIONEN.map(s => {
          const an = s.id === sit?.id;
          return (
            <button key={s.id} type="button" aria-pressed={an} onClick={() => waehle({ w: gid, e: s.id })} className="fassbar"
              style={{ textAlign: 'left', display: 'grid', gap: 4, minHeight: 64, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', fontFamily: SCHRIFT.text, color: C.ink,
                background: an ? TIEF.flaeche(C.aktiv) : 'rgba(255,255,255,.03)', border: `1px solid ${an ? TIEF.rand(C.aktiv) : RAND.flaeche}` }}>
              <span style={{ fontSize: TYP.body, fontWeight: 600 }}>{s.label}</span>
              <span style={{ ...klein }}>{s.frage}</span>
            </button>
          );
        })}
      </div>
      {sit && g && gid && <Kette key={`${gid}:${sit.id}`} sit={sit} lage={lage} g={g} e={schild.eintraege.find(x => x.id === gid) ?? ({ id: gid, stand: '' } as SEintrag)} heute={heute} ersetzenRegister={ersetzenRegister} ersetzenSchild={ersetzenSchild} />}
      <div style={{ ...klein, marginTop: 10 }}>{ASSISTENT_HINWEIS}</div>
    </Karte>
  );
}

function Kette({ sit, lage, g, e, heute, ersetzenRegister, ersetzenSchild }: { sit: Situation; lage: Lage; g: GAnzeige; e: SEintrag; heute: string; ersetzenRegister: (g: GAnzeige) => void; ersetzenSchild: (e: SEintrag) => void }) {
  const gl = lage.gesellschaften.find(x => x.id === g.id)!;
  const [datum, setDatum] = useState(heute);
  const [notiz, setNotiz] = useState('');
  const [mitBeschluss, setMitBeschluss] = useState(!!sit.beschluss && !sit.beschluss.optional);
  const wahl = zusatzWahl(sit);
  const [zusatz, setZusatz] = useState<string[]>(wahl.filter(z => z.vorgeschlagen).map(z => z.key));
  const [weitere, setWeitere] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<{ ereignisse: number; beschluss: boolean } | null>(null);
  const letzte = useRef<GAnzeige>(g);
  const swReg = useSchreiber(g, x => { letzte.current = x; ersetzenRegister(x); });
  const swSchild = useSchildSchreiber(e, ersetzenSchild);
  const kette = useMemo(() => folgekette(sit, gl.kontext, datum || heute, { beschluss: mitBeschluss, zusatz }), [sit, gl.kontext, datum, heute, mitBeschluss, zusatz]);
  const umschalten = (k: string) => setZusatz(l => (l.includes(k) ? l.filter(x => x !== k) : [...l, k]));
  const vorlage = sit.beschluss ? beschlussVorlageVon(sit.beschluss.vorlage) : undefined;

  const anlegen = async () => {
    setFehler(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) { setFehler('Bitte ein Datum wählen.'); return; }
    let beschlussId: string | undefined;
    if (mitBeschluss && sit.beschluss) {
      const vorher = new Set((letzte.current.beschluesse ?? []).map(b => b.id));
      const eintrag = beschlussEntwurf(sit, letzte.current, datum, heute);
      if (eintrag) {
        const r = await swReg.schreibe({ liste: 'beschluesse', eintrag });
        if (!r.ok) { setFehler(r.fehler ?? 'Beschluss nicht angelegt — nichts weiter geschehen.'); return; }
        beschlussId = (letzte.current.beschluesse ?? []).find(b => !vorher.has(b.id))?.id;
      }
    }
    let n = 0;
    for (const ev of ereignisEintraege(sit, gl.kontext, datum, { beschluss: mitBeschluss, zusatz }, notiz.trim() || undefined)) {
      const r = await swSchild.schreibe({ liste: 'ereignisse', eintrag: ev, ...(beschlussId ? { ausBeschluss: beschlussId } : {}) });
      if (!r.ok) { setFehler(`${r.fehler ?? 'Nicht gespeichert.'}${beschlussId ? ' Der Beschluss-Entwurf liegt schon im Beschluss-Buch.' : ''}`); return; }
      n++;
    }
    window.dispatchEvent(new Event(SCHILD_EREIGNIS));
    setFertig({ ereignisse: n, beschluss: !!beschlussId });
  };

  if (fertig) {
    return (
      <div style={{ marginTop: 14 }}>
        <Hinweis art="gut" titel="Angelegt">
          {fertig.ereignisse} Ereignis{fertig.ereignisse === 1 ? '' : 'se'} im Pflichten-Kalender{fertig.beschluss ? ' und der Beschluss als Entwurf im Beschluss-Buch' : ''}. Die Fristen stehen im Kalender; im Vorlauf entsteht je Schritt eine Aufgabe.
        </Hinweis>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Knopf leise href={WEG.schild('pflichten', g.id)}>Pflichten & Fristen ›</Knopf>
          {fertig.beschluss && <Knopf leise href={WEG.beschluss(g.id)}>Beschluss-Buch ›</Knopf>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
      {kette.giltNicht && <Hinweis art="achtung" titel="Passt nicht zur Rechtsform">„{sit.label}“ gilt so für GmbH und UG. Ist die Rechtsform im Steckbrief richtig eingetragen?</Hinweis>}
      {sit.hinweis && <Hinweis art="info">{sit.hinweis}</Hinweis>}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>
        <Feldzeile label={sit.datumFrage}><input type="date" value={datum} onChange={x => setDatum(x.target.value)} aria-label={sit.datumFrage} style={eingabe} /></Feldzeile>
        <Feldzeile label="Notiz (optional)"><input value={notiz} onChange={x => setNotiz(x.target.value)} aria-label="Notiz zum Ereignis" placeholder="z. B. Anlass, Ansprechpartner" style={eingabe} /></Feldzeile>
      </div>
      {sit.beschluss && vorlage && (
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44, cursor: 'pointer' }}>
          <input type="checkbox" checked={mitBeschluss} onChange={x => setMitBeschluss(x.target.checked)} style={{ width: 22, height: 22, marginTop: 2, accentColor: C.aktiv }} />
          <span style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: TYP.body }}>Beschluss als Entwurf anlegen: {sit.beschluss.titel ?? vorlage.titel}</span>
            <span style={klein}>{sit.beschluss.optional ?? vorlage.wofuer} Aus der Startvorlage, Platzhalter füllst du im Beschluss-Buch.</span>
          </span>
        </label>
      )}

      {/* Die Kette als Bild: Phasen nebeneinander (am Handy umbrechend), darunter die Schritte je Phase mit Frist. */}
      <div>
        <div style={{ ...beschriftung, marginBottom: 6 }}>Die Kette</div>
        <ol aria-label="Phasen der Folgekette" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {kette.phasen.map((p, i) => (
            <li key={p.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {i > 0 && <ArrowRight aria-hidden size={14} color={C.inkLeise} />}
              <span className="ui-chip" style={{ background: 'rgba(255,255,255,.06)', color: C.ink, whiteSpace: 'nowrap' }}>{i + 1}. {p.label} · {p.schritte.length}</span>
            </li>
          ))}
        </ol>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {kette.phasen.map((p, i) => (
          <li key={p.id} style={{ display: 'grid', gap: 2, borderLeft: `2px solid ${RAND.stark}`, paddingLeft: 12 }}>
            <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.ink }}>{i + 1}. {p.label}</span>
            {p.schritte.map(s => (
              <div key={s.key} style={{ display: 'flex', gap: 10, alignItems: 'baseline', minHeight: 40, padding: '4px 0', borderTop: `1px solid ${RAND.haar}` }}>
                <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 1 }}>
                  <span style={{ fontSize: TYP.bedien, lineHeight: 1.45, color: C.ink, overflowWrap: 'anywhere' }}>{s.titel}{s.eskalation ? <span style={{ color: LEUCHT.kritisch }}> · Kanzlei</span> : null}</span>
                  <span style={{ ...klein, overflowWrap: 'anywhere' }}>{s.wann}{s.hinweis ? ` · ${s.hinweis}` : ''}{s.norm && s.norm !== '—' ? <span style={{ color: C.inkLeise }}> · {s.norm}</span> : null}</span>
                </span>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{tagText(s.frist)}</span>
              </div>
            ))}
          </li>
        ))}
      </ol>
      <WasSeheIch>Jede Phase ist ein Schritt der Kette, in der üblichen Reihenfolge. Die Daten rechnen ab dem Tag oben; „(Vorschlag)“ heißt: das Gesetz nennt keine feste Zahl, MAKE OS schlägt eine vor.</WasSeheIch>

      <Klappbar id="assistent-zusatz" titel="Was ihr sonst noch tun solltet" zaehler={zusatz.length} offen={weitere || zusatz.length > 0} umschalten={() => setWeitere(x => !x)}>
        <div style={{ display: 'grid' }}>
          {wahl.filter(z => weitere || z.vorgeschlagen || zusatz.includes(z.key)).map(z => (
            <label key={z.key} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, cursor: 'pointer', borderTop: `1px solid ${RAND.haar}` }}>
              <input type="checkbox" checked={zusatz.includes(z.key)} onChange={() => umschalten(z.key)} style={{ width: 22, height: 22, accentColor: C.aktiv }} />
              <span style={{ fontSize: TYP.bedien, color: C.ink }}>{z.titel}</span>
            </label>
          ))}
          {!weitere && <div><Knopf leise onClick={() => setWeitere(true)}>Weitere Schritte zeigen</Knopf></div>}
        </div>
      </Klappbar>

      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Knopf haupt onClick={anlegen} aus={kette.giltNicht}><Sparkles size={16} aria-hidden /> Als Vorschläge anlegen</Knopf>
        <span style={klein}>Legt {mitBeschluss && sit.beschluss ? 'den Beschluss als Entwurf und ' : ''}{kette.ereignisse.length === 1 ? 'ein Ereignis' : `${kette.ereignisse.length} Ereignisse`} mit {kette.phasen.reduce((n, p) => n + p.schritte.length, 0)} Schritten an — Fristen im Kalender, nichts geht nach außen.</span>
      </div>
    </div>
  );
}
