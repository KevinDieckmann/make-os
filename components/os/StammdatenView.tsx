'use client';

// ─── MAKE OS — Stammdaten ───────────────────────────────────────────────────
// Vier Karteien, ein Aufbau. Die Felder stehen in stammdaten-data.ts, damit
// eine neue Angabe eine Zeile ist und keine neue Ansicht.
//
// Zwei Dinge sind hier bewusst so gebaut:
// 1. Geschützte Felder (Steuer-ID, SV-Nummer, IBAN) stehen verdeckt. Zeigen
//    ist ein bewusster Klick — nicht der Normalzustand, wenn jemand mitguckt.
// 2. Gespeichert wird erst beim Verlassen des Feldes, nicht bei jedem Zeichen.

import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { THEME as T } from '@/lib/make-one/os-data';
import { KARTEIEN, verdecken, type Feld, type Kartei } from '@/lib/make-one/stammdaten-data';
import { modusLesen, beiWechsel } from '@/lib/make-one/arbeitsplatz-browser';
import { Seitenkopf } from './Seitenkopf';

const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

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
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 70px' }}>
        <Seitenkopf
          rubrik={<>System</>}
          titel={<>Stammdaten</>}
          satz={<>Die Angaben, die man dreimal im Jahr braucht und dann sucht. Sie liegen hier auf dem Rechner, werden täglich gesichert und gehen nirgendwohin.</>}
        />
        <div style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '11px 15px', marginBottom: 20, maxWidth: 640 }}>
          <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.6 }}>
            Steuer-ID, Sozialversicherungsnummer und IBAN stehen verdeckt. Zum Ansehen einmal auf das Auge tippen —
            so steht nichts offen auf dem Bildschirm, wenn jemand danebensitzt.
          </div>
        </div>

        {ladeFehler && (
          <div style={{ ...panel, borderLeft: `3px solid ${T.crit}`, padding: '13px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.crit }}>Stammdaten nicht geladen</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, lineHeight: 1.55 }}>
              Damit nichts überschrieben wird, ist das Speichern gesperrt. Seite neu laden.
            </div>
          </div>
        )}
        {fehler && !ladeFehler && (
          <div style={{ ...panel, borderLeft: `3px solid ${T.amber}`, padding: '13px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.amber }}>Nicht gespeichert</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, lineHeight: 1.55 }}>{fehler}</div>
          </div>
        )}

        {d === null && !ladeFehler && <div style={{ fontSize: 13, color: T.muted }}>lädt …</div>}

        {d && karteien.map(k => (
          <KarteiBlock
            key={k.id}
            kartei={k}
            saetze={d[k.id]}
            offen={offen}
            aufdecken={(id) => setOffen(o => ({ ...o, [id]: !o[id] }))}
            aendern={(saetze) => sichern({ ...d, [k.id]: saetze })}
            gesperrt={ladeFehler}
          />
        ))}
      </div>
    </div>
  );
}

function KarteiBlock({ kartei, saetze, offen, aufdecken, aendern, gesperrt }: {
  kartei: Kartei; saetze: Satz[]; offen: Record<string, boolean>;
  aufdecken: (id: string) => void; aendern: (s: Satz[]) => void; gesperrt: boolean;
}) {
  const neu = () => aendern([...saetze, { id: `${kartei.id}-${saetze.length + 1}-${saetze.length}`, [kartei.titelFeld]: '' } as Satz]);

  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{kartei.titel}</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2, lineHeight: 1.5 }}>{kartei.satz}</div>
        </div>
        <button onClick={neu} disabled={gesperrt} style={{
          flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 5, background: 'transparent',
          border: `1px solid ${T.line}`, borderRadius: 9, padding: '7px 12px', color: gesperrt ? T.muted : T.inkDim,
          fontSize: 12.5, fontFamily: T.sans, cursor: gesperrt ? 'not-allowed' : 'pointer',
        }}><Plus size={13} /> Neu</button>
      </div>

      {saetze.length === 0 && (
        <div style={{ ...panel, padding: '15px 18px', marginTop: 10, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          Noch nichts eingetragen. Über „Neu" die erste Karte anlegen.
        </div>
      )}

      {saetze.map((s, i) => (
        <div key={s.id} style={{ ...panel, padding: '15px 18px', marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{s[kartei.titelFeld] || 'Ohne Namen'}</div>
              {kartei.untertitelFeld && s[kartei.untertitelFeld] && (
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{s[kartei.untertitelFeld]}</div>
              )}
            </div>
            <button
              onClick={() => { if (confirm(`„${s[kartei.titelFeld] || 'Diese Karte'}" wirklich löschen?`)) aendern(saetze.filter((_, j) => j !== i)); }}
              aria-label="Karte löschen"
              style={{ flex: '0 0 auto', background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', padding: 4 }}>
              <Trash2 size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
            {kartei.felder.map(f => (
              <FeldZeile
                key={f.key} feld={f} wert={s[f.key] ?? ''}
                sichtbar={!f.schutz || !!offen[`${s.id}.${f.key}`]}
                umschalten={() => aufdecken(`${s.id}.${f.key}`)}
                setzen={(v) => aendern(saetze.map((x, j) => j === i ? { ...x, [f.key]: v } : x))}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function FeldZeile({ feld, wert, sichtbar, umschalten, setzen }: {
  feld: Feld; wert: string; sichtbar: boolean; umschalten: () => void; setzen: (v: string) => void;
}) {
  // Beim Tippen nur lokal — gespeichert wird beim Verlassen des Feldes.
  const [entwurf, setEntwurf] = useState(wert);
  useEffect(() => { setEntwurf(wert); }, [wert]);

  const eingabe = {
    width: '100%', background: T.void, border: `1px solid ${T.line}`, borderRadius: 8,
    padding: '8px 10px', color: T.ink, fontSize: 13, fontFamily: feld.schutz ? T.mono : T.sans, outline: 'none',
  } as const;

  const spalte = feld.art === 'lang' ? { gridColumn: '1 / -1' } : undefined;

  return (
    <div style={spalte}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
        <label style={{ ...lbl, fontSize: 11 }}>{feld.label}</label>
        {feld.schutz && (
          <button onClick={umschalten} aria-label={sichtbar ? 'Verdecken' : 'Zeigen'}
            style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, display: 'flex' }}>
            {sichtbar ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
      </div>

      {feld.schutz && !sichtbar ? (
        <div onClick={umschalten} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') umschalten(); }}
          style={{ ...eingabe, cursor: 'pointer', color: wert ? T.inkDim : T.muted, letterSpacing: '.06em' }}>
          {wert ? verdecken(wert) : '—'}
        </div>
      ) : feld.art === 'lang' ? (
        <textarea value={entwurf} onChange={e => setEntwurf(e.target.value)}
          onBlur={() => { if (entwurf !== wert) setzen(entwurf); }}
          rows={2} placeholder={feld.hinweis} style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} />
      ) : (
        <input value={entwurf} onChange={e => setEntwurf(e.target.value)}
          onBlur={() => { if (entwurf !== wert) setzen(entwurf); }}
          type={feld.art === 'datum' ? 'date' : 'text'} placeholder={feld.hinweis} style={eingabe} />
      )}
    </div>
  );
}
