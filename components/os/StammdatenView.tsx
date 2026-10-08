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
// 08.10. spät (Datenschutz vor dem Upload): Steuer-ID, SV-Nummer und IBAN kommen nur bei der Person selbst an (Server,
// lib/stammdaten/regeln.ts) — fremde stehen als „nur für die Person selbst“ (`geschuetzt`), nicht bearbeitbar. Gespeichert wird
// je Feld als Einzeländerung mit Stand (PATCH, nacheinander) — nie mehr der ganze Bestand.

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
type Op = { op: 'teil'; id: string; felder: Record<string, string | null> } | { op: 'upsert'; eintrag: Satz } | { op: 'delete'; id: string };
/** Ist dieses Feld des Satzes für mich verdeckt (gehört einer anderen Person)? */
const fremdGeschuetzt = (s: Satz, key: string) => (s.geschuetzt ?? '').split(',').includes(key);

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
  // Seit 08.10. spät: je Änderung EIN PATCH mit dem Stand des Satzes aus der letzten Server-Antwort, nacheinander (Kette).
  const dRef = useRef(d); dRef.current = d;
  const kette = useRef<Promise<void>>(Promise.resolve());
  const schicke = useCallback((liste: Kartei['id'], bauen: (b: Bestand) => Op | null, vorab?: (b: Bestand) => Bestand) => {
    if (ladeFehler) return;
    if (vorab && dRef.current) setD(vorab(dRef.current));
    kette.current = kette.current.then(async () => {
      const b = dRef.current;
      const op = b ? bauen(b) : null;
      if (!op || !b) return;
      const stand = op.op === 'upsert' ? undefined : b[liste].find(x => x.id === op.id)?.stand;
      try {
        const r = await fetch('/api/state/stammdaten', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liste, ops: [{ ...op, ...(stand ? { stand } : {}) }] }),
        });
        const x = await r.json().catch(() => ({})) as { ansicht?: Bestand; fehler?: string };
        if (x.ansicht && Array.isArray(x.ansicht.firmen)) { const neu = { ...LEER, ...x.ansicht }; dRef.current = neu; setD(neu); }
        setFehler(r.ok ? null : r.status === 409 && !x.fehler?.startsWith('Nicht gespeichert') ? 'Jemand hat inzwischen geändert — der neue Stand ist geladen, bitte noch einmal.' : (x.fehler ?? `Nicht gespeichert (${r.status}).`).slice(0, 240));
      } catch { setFehler('Nicht gespeichert — läuft die Software noch?'); }
    });
  }, [ladeFehler]);
  /** Ein Feld setzen (leer = entfernen). */
  const setzeFeld = (liste: Kartei['id'], id: string, key: string, wert: string) =>
    schicke(liste, () => ({ op: 'teil', id, felder: { [key]: wert === '' ? null : wert } }),
      b => ({ ...b, [liste]: b[liste].map(x => (x.id === id ? { ...x, [key]: wert } : x)) }));

  // Archiv & Papierkorb (04.10.): Marken am Satz — „Rückgängig“ läuft später, darum immer auf dem jüngsten Bestand.
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const marke = (kartei: Kartei['id'], id: string, feld: 'archiviertAm' | 'geloeschtAm', wert: string | null) =>
    schicke(kartei, () => ({ op: 'teil', id, felder: { [feld]: wert } }));
  const ablage: Ablage = {
    melden,
    archivieren: (k, sz) => { const t = sz[k.titelFeld] || 'Diese Karte'; if (sz.archiviertAm) { marke(k.id, sz.id, 'archiviertAm', null); melden(`„${t}“ ist zurück`, () => marke(k.id, sz.id, 'archiviertAm', new Date().toISOString())); return; } marke(k.id, sz.id, 'archiviertAm', new Date().toISOString()); melden(`„${t}“ archiviert — unten unter „Archiv“`, () => marke(k.id, sz.id, 'archiviertAm', null)); },
    loeschen: (k, sz) => { const t = sz[k.titelFeld] || 'Diese Karte'; marke(k.id, sz.id, 'geloeschtAm', new Date().toISOString()); melden(`„${t}“ im Papierkorb — unten wiederherstellbar`, () => marke(k.id, sz.id, 'geloeschtAm', null)); },
    wiederherstellen: (k, sz) => { const t = sz[k.titelFeld] || 'Diese Karte'; marke(k.id, sz.id, 'geloeschtAm', null); melden(`„${t}“ wiederhergestellt`, () => marke(k.id, sz.id, 'geloeschtAm', new Date().toISOString())); },
    endgueltig: (k, sz) => fragen({ titel: `„${sz[k.titelFeld] || 'Diese Karte'}“ endgültig löschen?`, text: 'Die Karte verschwindet ganz, mit allen Angaben. Das lässt sich nicht rückgängig machen.', wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => schicke(k.id, () => ({ op: 'delete', id: sz.id })) }] }),
    neu: k => { const id = `${k.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; schicke(k.id, () => ({ op: 'upsert', eintrag: { id, [k.titelFeld]: '' } as Satz }), b => ({ ...b, [k.id]: [...b[k.id], { id, [k.titelFeld]: '' } as Satz] })); },
  };

  const karteien = KARTEIEN.filter(k => modus === 'alles' || k.modus === 'beides' || k.modus === modus);

  return (
    <Seite titel="Stammdaten" unter="Die Angaben, die man dreimal im Jahr braucht und dann sucht — täglich gesichert, gehen nirgendwohin.">
      <Karte i={0}>
        <Ueberschrift farbe={LEUCHT.gut}>Verdeckt, bis du hinschaust</Ueberschrift>
        <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, margin: 0 }}>
          Steuer-ID, Sozialversicherungsnummer und IBAN sieht nur die Person, der die Karte gehört — auch auf dem Server.
          Die eigenen stehen verdeckt; zum Ansehen einmal auf das Auge tippen.
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
          setzen={(id, key, wert) => setzeFeld(k.id, id, key, wert)}
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
  neu: (k: Kartei) => void;
}

function KarteiBlock({ i, kartei, saetze: alle, offen, aufdecken, setzen: setzeFeld, gesperrt, ablage }: {
  i: number; kartei: Kartei; saetze: Satz[]; offen: Record<string, boolean>;
  aufdecken: (id: string) => void; setzen: (id: string, key: string, wert: string) => void; gesperrt: boolean; ablage: Ablage;
}) {
  // Nur die laufenden Karten stehen offen; Archiv und Papierkorb unten als kurze Zeilen.
  const saetze = alle.filter(x => !x.archiviertAm && !x.geloeschtAm);
  const archiv = alle.filter(x => x.archiviertAm && !x.geloeschtAm);
  const korb = alle.filter(x => x.geloeschtAm);
  const kurz = (x: Satz, rechts: ReactNode) => (
    <div key={x.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: `1px solid ${HAAR}`, fontSize: TYP.bedien }}>
      <span style={{ minWidth: 0, color: C.inkDim }}>{x[kartei.titelFeld] || 'Ohne Namen'}</span>{rechts}
    </div>
  );
  const neu = () => ablage.neu(kartei);

  return (
    <Karte i={i}>
      <Ueberschrift rechts={<Knopf leise onClick={neu} aus={gesperrt}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Plus size={13} /> Neu</span></Knopf>}>
        {kartei.titel}
      </Ueberschrift>
      <p style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5, margin: '0 0 6px' }}>{kartei.satz}</p>
      {/* 04.10.: die eigenen Gesellschaften führt das Register (Business › Unternehmen) — ein Weg statt zwei; was hier steht, bleibt lesbar. */}
      {kartei.id === 'firmen' && <div style={{ margin: '4px 0 10px' }}><Hinweis art="info" titel="Eigene Gesellschaften jetzt im Register" aktion={<Knopf href={WEG.unternehmen()}>Zu Unternehmen</Knopf>}>Steckbrief, Gesellschafter, Verträge und Absender der Angebote pflegst du unter Business › Unternehmen. Die Karten hier bleiben unverändert stehen — übertrage sie bei Gelegenheit.</Hinweis></div>}

      {saetze.length === 0 && <Leer>Noch nichts eingetragen. Über „Neu“ die erste Karte anlegen.</Leer>}

      {saetze.map(s => (
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
                fremd={fremdGeschuetzt(s, f.key)}
                umschalten={() => aufdecken(`${s.id}.${f.key}`)}
                setzen={(v) => setzeFeld(s.id, f.key, v)}
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

function FeldZeile({ feld: f, wert, sichtbar, fremd, umschalten, setzen }: {
  feld: Feld; wert: string; sichtbar: boolean; fremd: boolean; umschalten: () => void; setzen: (v: string) => void;
}) {
  // Beim Tippen nur lokal — gespeichert wird beim Verlassen des Feldes.
  const [entwurf, setEntwurf] = useState(wert);
  useEffect(() => { setEntwurf(wert); }, [wert]);

  // Geschützte Werte (IBAN, Steuer-ID) in gleichbreiter Schrift — das sind Codes, keine Sätze.
  const eingabe: CSSProperties = { ...feld, padding: '9px 12px', fontSize: TYP.bedien, fontFamily: f.schutz ? SCHRIFT.mono : SCHRIFT.text };

  const spalte = f.art === 'lang' ? { gridColumn: '1 / -1' } : undefined;

  // Persönliche Kennung einer anderen Person (08.10. spät): der Server liefert sie nicht (IBAN nur maskiert) — nicht bearbeitbar.
  if (fremd) {
    return (
      <div style={spalte}>
        <div style={{ ...beschriftung, marginBottom: 4 }}>{f.label}</div>
        <div style={{ ...eingabe, color: C.inkLeise, letterSpacing: '.02em' }}>{wert ? `${wert} · ` : ''}nur für die Person selbst sichtbar</div>
      </div>
    );
  }

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
