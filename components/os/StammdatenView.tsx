'use client';

// ─── MAKE OS — Stammdaten ───────────────────────────────────────────────────
// Vier Karteien, ein Aufbau. Die Felder stehen in stammdaten-data.ts, damit
// eine neue Angabe eine Zeile ist und keine neue Ansicht.
//
// Zwei Dinge sind hier bewusst so gebaut:
// 1. Geschützte Felder (Steuer-ID, SV-Nummer, IBAN) stehen verdeckt. Zeigen
//    ist ein bewusster Klick — nicht der Normalzustand, wenn jemand mitguckt.
// 2. Gespeichert wird erst beim Verlassen des Feldes, nicht bei jedem Zeichen.
// 24.09.: auf das lebendige Muster umgezogen.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { KARTEIEN, verdecken, type Feld, type Kartei } from '@/lib/make-one/stammdaten-data';
import { modusLesen, beiWechsel } from '@/lib/make-one/arbeitsplatz-browser';
import { Seite, Karte, Ueberschrift, Leer, Knopf, feld, LEUCHT } from './schlank';

const HAAR = 'rgba(255,255,255,.06)';
const beschriftung: CSSProperties = { fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const nackt: CSSProperties = { background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: C.inkLeise, display: 'flex' };

type Satz = Record<string, string> & { id: string };
type Bestand = { firmen: Satz[]; konten: Satz[]; personen: Satz[]; partner: Satz[] };
const LEER: Bestand = { firmen: [], konten: [], personen: [], partner: [] };

export function StammdatenView() {
  const [d, setD] = useState<Bestand | null>(null);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  const [modus, setModus] = useState<'privat' | 'business' | 'alles'>('alles');

  useEffect(() => { setModus(modusLesen()); return beiWechsel(() => setModus(modusLesen())); }, []);

  useEffect(() => {
    fetch('/api/state/stammdaten', { cache: 'no-store' })
      .then(r => r.json())
      .then((x: Bestand) => {
        if (!Array.isArray(x?.firmen)) throw new Error('kein Bestand');
        setD({ ...LEER, ...x });
      })
      .catch(() => setLadeFehler(true));
  }, []);

  // Speichern erst nach dem Laden — sonst überschreibt eine leere Ansicht den
  // echten Bestand. Derselbe Schutz wie im Bauplan.
  const sichern = useCallback((next: Bestand) => {
    if (ladeFehler) return;
    setD(next);
    fetch('/api/state/stammdaten', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
    })
      .then(async r => { setFehler(r.ok ? null : (await r.text()).slice(0, 200)); })
      .catch(() => setFehler('Nicht gespeichert — läuft die Software noch?'));
  }, [ladeFehler]);

  const karteien = KARTEIEN.filter(k => modus === 'alles' || k.modus === 'beides' || k.modus === modus);

  return (
    <Seite titel="Stammdaten" unter="Die Angaben, die man dreimal im Jahr braucht und dann sucht. Sie liegen hier auf dem Rechner, werden täglich gesichert und gehen nirgendwohin.">
      <Karte i={0}>
        <Ueberschrift farbe={LEUCHT.gut}>Verdeckt, bis du hinschaust</Ueberschrift>
        <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, margin: 0 }}>
          Steuer-ID, Sozialversicherungsnummer und IBAN stehen verdeckt. Zum Ansehen einmal auf das Auge tippen —
          so steht nichts offen auf dem Bildschirm, wenn jemand danebensitzt.
        </p>
      </Karte>

      {ladeFehler && (
        <Karte i={1} akzent={LEUCHT.kritisch}>
          <Ueberschrift farbe={LEUCHT.kritisch}>Stammdaten nicht geladen</Ueberschrift>
          <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: 0 }}>
            Damit nichts überschrieben wird, ist das Speichern gesperrt. Seite neu laden.
          </p>
        </Karte>
      )}
      {fehler && !ladeFehler && (
        <Karte i={1} akzent={LEUCHT.achtung}>
          <Ueberschrift farbe={LEUCHT.achtung}>Nicht gespeichert</Ueberschrift>
          <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: 0 }}>{fehler}</p>
        </Karte>
      )}

      {d === null && !ladeFehler && <Karte i={1}><Leer>lädt …</Leer></Karte>}

      {d && karteien.map((k, i) => (
        <KarteiBlock
          key={k.id}
          i={i + 1}
          kartei={k}
          saetze={d[k.id]}
          offen={offen}
          aufdecken={(id) => setOffen(o => ({ ...o, [id]: !o[id] }))}
          aendern={(saetze) => sichern({ ...d, [k.id]: saetze })}
          gesperrt={ladeFehler}
        />
      ))}
    </Seite>
  );
}

function KarteiBlock({ i, kartei, saetze, offen, aufdecken, aendern, gesperrt }: {
  i: number; kartei: Kartei; saetze: Satz[]; offen: Record<string, boolean>;
  aufdecken: (id: string) => void; aendern: (s: Satz[]) => void; gesperrt: boolean;
}) {
  const neu = () => aendern([...saetze, { id: `${kartei.id}-${saetze.length + 1}-${saetze.length}`, [kartei.titelFeld]: '' } as Satz]);

  return (
    <Karte i={i}>
      <Ueberschrift rechts={<Knopf leise onClick={neu} aus={gesperrt}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Plus size={13} /> Neu</span></Knopf>}>
        {kartei.titel}
      </Ueberschrift>
      <p style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5, margin: '0 0 6px' }}>{kartei.satz}</p>

      {saetze.length === 0 && <Leer>Noch nichts eingetragen. Über „Neu“ die erste Karte anlegen.</Leer>}

      {saetze.map((s, idx) => (
        <div key={s.id} style={{ padding: '14px 0 16px', borderTop: `1px solid ${HAAR}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{s[kartei.titelFeld] || 'Ohne Namen'}</div>
              {kartei.untertitelFeld && s[kartei.untertitelFeld] && (
                <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 2 }}>{s[kartei.untertitelFeld]}</div>
              )}
            </div>
            <button
              onClick={() => { if (confirm(`„${s[kartei.titelFeld] || 'Diese Karte'}" wirklich löschen?`)) aendern(saetze.filter((_, j) => j !== idx)); }}
              aria-label="Karte löschen" title="Karte löschen"
              style={{ ...nackt, flex: '0 0 auto' }}>
              <Trash2 size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
            {kartei.felder.map(f => (
              <FeldZeile
                key={f.key} feld={f} wert={s[f.key] ?? ''}
                sichtbar={!f.schutz || !!offen[`${s.id}.${f.key}`]}
                umschalten={() => aufdecken(`${s.id}.${f.key}`)}
                setzen={(v) => aendern(saetze.map((x, j) => j === idx ? { ...x, [f.key]: v } : x))}
              />
            ))}
          </div>
        </div>
      ))}
    </Karte>
  );
}

function FeldZeile({ feld: f, wert, sichtbar, umschalten, setzen }: {
  feld: Feld; wert: string; sichtbar: boolean; umschalten: () => void; setzen: (v: string) => void;
}) {
  // Beim Tippen nur lokal — gespeichert wird beim Verlassen des Feldes.
  const [entwurf, setEntwurf] = useState(wert);
  useEffect(() => { setEntwurf(wert); }, [wert]);

  // Geschützte Werte (IBAN, Steuer-ID) in gleichbreiter Schrift — das sind Codes, keine Sätze.
  const eingabe: CSSProperties = { ...feld, padding: '9px 12px', fontSize: TYP.bedien, fontFamily: f.schutz ? SCHRIFT.mono : SCHRIFT.text };

  const spalte = f.art === 'lang' ? { gridColumn: '1 / -1' } : undefined;

  return (
    <div style={spalte}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
        <label style={beschriftung}>{f.label}</label>
        {f.schutz && (
          <button onClick={umschalten} aria-label={sichtbar ? 'Verdecken' : 'Zeigen'} title={sichtbar ? 'Verdecken' : 'Zeigen'}
            style={{ ...nackt, padding: 0 }}>
            {sichtbar ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
      </div>

      {f.schutz && !sichtbar ? (
        <div onClick={umschalten} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') umschalten(); }}
          style={{ ...eingabe, cursor: 'pointer', color: wert ? C.inkDim : C.inkLeise, letterSpacing: '.06em' }}>
          {wert ? verdecken(wert) : '—'}
        </div>
      ) : f.art === 'lang' ? (
        <textarea value={entwurf} onChange={e => setEntwurf(e.target.value)}
          onBlur={() => { if (entwurf !== wert) setzen(entwurf); }}
          rows={2} placeholder={f.hinweis} style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} />
      ) : (
        <input value={entwurf} onChange={e => setEntwurf(e.target.value)}
          onBlur={() => { if (entwurf !== wert) setzen(entwurf); }}
          type={f.art === 'datum' ? 'date' : 'text'} placeholder={f.hinweis}
          style={{ ...eingabe, ...(f.art === 'datum' ? { colorScheme: 'dark' as const } : {}) }} />
      )}
    </div>
  );
}
