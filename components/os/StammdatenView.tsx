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
// 04.10. (Kevin: „alles anpassbar“): jede Karte hängt mit ihrem Kopf am Baustein `ZeileAktionen` — Archivieren (`archiviertAm`,
// unten „Archiv“, zurückholbar) und Löschen = Papierkorb (`geloeschtAm`, mit „Rückgängig“; endgültig nur aus dem Papierkorb,
// hinter einer Rückfrage). Beide Marken sind einfache Textfelder des Satzes — der Speicher nimmt sie ohne Umbau mit.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { KARTEIEN, verdecken, type Feld, type Kartei } from '@/lib/make-one/stammdaten-data';
import { modusLesen, beiWechsel } from '@/lib/make-one/arbeitsplatz-browser';
import { Seite, Karte, Ueberschrift, Leer, Knopf, Hinweis, feld, LEUCHT, ZeileAktionen, useRueckgaengig, useRueckfrage, type Rueckgaengig } from './ui';
import { WEG } from '@/lib/wege';

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

  // Archiv & Papierkorb (04.10.): Marken am Satz — „Rückgängig“ läuft später, darum immer auf dem jüngsten Bestand.
  const dRef = useRef(d); dRef.current = d;
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const marke = (kartei: Kartei['id'], id: string, feld: 'archiviertAm' | 'geloeschtAm', wert: string | null) => {
    const b = dRef.current;
    if (!b) return;
    sichern({ ...b, [kartei]: b[kartei].map(x => { if (x.id !== id) return x; const n = { ...x } as Satz; if (wert) n[feld] = wert; else delete n[feld]; return n; }) });
  };
  const ablage: Ablage = {
    melden,
    archivieren: (k, sz) => { const t = sz[k.titelFeld] || 'Diese Karte'; if (sz.archiviertAm) { marke(k.id, sz.id, 'archiviertAm', null); melden(`„${t}“ ist zurück`, () => marke(k.id, sz.id, 'archiviertAm', new Date().toISOString())); return; } marke(k.id, sz.id, 'archiviertAm', new Date().toISOString()); melden(`„${t}“ archiviert — unten unter „Archiv“`, () => marke(k.id, sz.id, 'archiviertAm', null)); },
    loeschen: (k, sz) => { const t = sz[k.titelFeld] || 'Diese Karte'; marke(k.id, sz.id, 'geloeschtAm', new Date().toISOString()); melden(`„${t}“ im Papierkorb — unten wiederherstellbar`, () => marke(k.id, sz.id, 'geloeschtAm', null)); },
    wiederherstellen: (k, sz) => { const t = sz[k.titelFeld] || 'Diese Karte'; marke(k.id, sz.id, 'geloeschtAm', null); melden(`„${t}“ wiederhergestellt`, () => marke(k.id, sz.id, 'geloeschtAm', new Date().toISOString())); },
    endgueltig: (k, sz) => fragen({ titel: `„${sz[k.titelFeld] || 'Diese Karte'}“ endgültig löschen?`, text: 'Die Karte verschwindet ganz, mit allen Angaben. Das lässt sich nicht rückgängig machen.', wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => { const b = dRef.current; if (b) sichern({ ...b, [k.id]: b[k.id].filter(x => x.id !== sz.id) }); } }] }),
  };

  const karteien = KARTEIEN.filter(k => modus === 'alles' || k.modus === 'beides' || k.modus === modus);

  return (
    <Seite titel="Stammdaten" unter="Die Angaben, die man dreimal im Jahr braucht und dann sucht — täglich gesichert, gehen nirgendwohin.">
      <Karte i={0}>
        <Ueberschrift farbe={LEUCHT.gut}>Verdeckt, bis du hinschaust</Ueberschrift>
        <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, margin: 0 }}>
          Steuer-ID, Sozialversicherungsnummer und IBAN stehen verdeckt. Zum Ansehen einmal auf das Auge tippen —
          so steht nichts offen auf dem Bildschirm, wenn jemand danebensitzt.
        </p>
      </Karte>

      {ladeFehler && <Hinweis art="kritisch" titel="Stammdaten nicht geladen">Damit nichts überschrieben wird, ist das Speichern gesperrt. Seite neu laden.</Hinweis>}
      {fehler && !ladeFehler && <Hinweis art="achtung" titel="Nicht gespeichert">{fehler}</Hinweis>}

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
          ablage={ablage}
        />
      ))}
      {dialog}
      {hinweis}
    </Seite>
  );
}

interface Ablage {
  melden: Rueckgaengig['melden'];
  archivieren: (k: Kartei, s: Satz) => void; loeschen: (k: Kartei, s: Satz) => void;
  wiederherstellen: (k: Kartei, s: Satz) => void; endgueltig: (k: Kartei, s: Satz) => void;
}

function KarteiBlock({ i, kartei, saetze: alle, offen, aufdecken, aendern: aendernAlle, gesperrt, ablage }: {
  i: number; kartei: Kartei; saetze: Satz[]; offen: Record<string, boolean>;
  aufdecken: (id: string) => void; aendern: (s: Satz[]) => void; gesperrt: boolean; ablage: Ablage;
}) {
  // Nur die laufenden Karten stehen offen; Archiv und Papierkorb unten als kurze Zeilen.
  const saetze = alle.filter(x => !x.archiviertAm && !x.geloeschtAm);
  const archiv = alle.filter(x => x.archiviertAm && !x.geloeschtAm);
  const korb = alle.filter(x => x.geloeschtAm);
  /** Änderungen an den laufenden Karten — Archiv und Papierkorb bleiben, wie sie sind. */
  const aendern = (neu: Satz[]) => aendernAlle([...neu, ...alle.filter(x => x.archiviertAm || x.geloeschtAm)]);
  const kurz = (x: Satz, rechts: ReactNode) => (
    <div key={x.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: `1px solid ${HAAR}`, fontSize: TYP.bedien }}>
      <span style={{ minWidth: 0, color: C.inkDim }}>{x[kartei.titelFeld] || 'Ohne Namen'}</span>{rechts}
    </div>
  );
  const neu = () => aendern([...saetze, { id: `${kartei.id}-${alle.length + 1}-${Date.now().toString(36)}`, [kartei.titelFeld]: '' } as Satz]);

  return (
    <Karte i={i}>
      <Ueberschrift rechts={<Knopf leise onClick={neu} aus={gesperrt}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Plus size={13} /> Neu</span></Knopf>}>
        {kartei.titel}
      </Ueberschrift>
      <p style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5, margin: '0 0 6px' }}>{kartei.satz}</p>
      {/* 04.10.: die eigenen Gesellschaften führt das Register (Business › Unternehmen) — ein Weg statt zwei; was hier steht, bleibt lesbar. */}
      {kartei.id === 'firmen' && <div style={{ margin: '4px 0 10px' }}><Hinweis art="info" titel="Eigene Gesellschaften jetzt im Register" aktion={<Knopf href={WEG.unternehmen()}>Zu Unternehmen</Knopf>}>Steckbrief, Gesellschafter, Verträge und Absender der Angebote pflegst du unter Business › Unternehmen. Die Karten hier bleiben unverändert stehen — übertrage sie bei Gelegenheit.</Hinweis></div>}

      {saetze.length === 0 && <Leer>Noch nichts eingetragen. Über „Neu“ die erste Karte anlegen.</Leer>}

      {saetze.map((s, idx) => (
        <div key={s.id} style={{ padding: '14px 0 16px', borderTop: `1px solid ${HAAR}` }}>
          <ZeileAktionen titel={s[kartei.titelFeld] || 'Ohne Namen'} darf={!gesperrt} onArchivieren={() => ablage.archivieren(kartei, s)} onLoeschen={() => ablage.loeschen(kartei, s)}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12, minHeight: 44 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{s[kartei.titelFeld] || 'Ohne Namen'}</div>
              {kartei.untertitelFeld && s[kartei.untertitelFeld] && (
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 2 }}>{s[kartei.untertitelFeld]}</div>
              )}
            </div>
          </div>
          </ZeileAktionen>

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

      {archiv.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={beschriftung}>Archiv · {archiv.length}</div>
          {archiv.map(x => (
            <ZeileAktionen key={x.id} titel={x[kartei.titelFeld] || 'Ohne Namen'} archiviert darf={!gesperrt} onArchivieren={() => ablage.archivieren(kartei, x)} onLoeschen={() => ablage.loeschen(kartei, x)}>
              {kurz(x, <Knopf leise onClick={() => ablage.archivieren(kartei, x)} aus={gesperrt}>Zurückholen</Knopf>)}
            </ZeileAktionen>
          ))}
        </div>
      )}
      {korb.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={beschriftung}>Papierkorb · {korb.length}</div>
          {korb.map(x => kurz(x, (
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Knopf leise onClick={() => ablage.wiederherstellen(kartei, x)} aus={gesperrt}>Wiederherstellen</Knopf>
              <Knopf leise farbe={LEUCHT.kritisch} onClick={() => ablage.endgueltig(kartei, x)} aus={gesperrt}>Endgültig löschen</Knopf>
            </span>
          )))}
        </div>
      )}
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
