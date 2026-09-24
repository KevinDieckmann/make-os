'use client';

// ─── MAKE OS — Ernährung ────────────────────────────────────────────────────
// Kevins crit-Hebel (Ernährung 38, unregelmäßig): eine Essens-Woche, die er
// wirklich durchhält. 7 Tage × 3 Mahlzeiten editierbar, Jarvis schlägt die
// Woche nach den Grundsätzen vor (anti-entzündlich, regelmäßig, einfach),
// Einkaufsliste abhakbar + kopierbar (für Malin/REWE). Privat — kein Business.
// 24.09.: auf das lebendige Muster umgezogen. `eingebettet` liefert nur die
// Abschnitte (GesundheitView legt die Karte drumherum).

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { TAGE, TAG_LABEL, type ErnaehrungFile, type Mahlzeiten, type Tag } from '@/lib/make-one/ernaehrung-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Haken, feld, LEUCHT, Spalten, Spalte } from './schlank';

const M_LABEL: { k: keyof Mahlzeiten; label: string }[] = [
  { k: 'fruehstueck', label: 'Früh' }, { k: 'mittag', label: 'Mittag' }, { k: 'abend', label: 'Abend' },
];
const link: CSSProperties = { color: C.inkDim, textDecoration: 'none' };
const klein: CSSProperties = { ...feld, padding: '8px 11px', fontSize: TYP.bedien };
const nackt: CSSProperties = { background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: C.inkLeise, fontSize: TYP.bedien };

/** Eingebettet: nur ein Abschnitt mit Luft nach oben. Frei: eine eigene Karte. */
function Abschnitt({ eingebettet, i, akzent, children }: { eingebettet: boolean; i: number; akzent?: string; children: ReactNode }) {
  // 24.09.: auch eingebettet eigene Karten — die Gesundheitsseite legt keine Karte mehr drumherum.
  void eingebettet;
  return <Karte i={i} akzent={akzent}>{children}</Karte>;
}

export function ErnaehrungView({ eingebettet = false }: { eingebettet?: boolean } = {}) {
  const [daten, setDaten] = useState<ErnaehrungFile | null>(null);
  const [neu, setNeu] = useState('');
  const [vorschlag, setVorschlag] = useState<{ begruendung: string; plan: Record<Tag, Mahlzeiten>; einkauf: string[]; hinweis: string } | null>(null);
  const [denkt, setDenkt] = useState(false);
  const [meld, setMeld] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch('/api/state/ernaehrung').then(r => r.json()).then(setDaten).catch(() => {});
  }, []);

  function speichern(next: ErnaehrungFile) {
    setDaten(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/ernaehrung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
    }, 500);
  }

  async function jarvisPlant() {
    setDenkt(true); setVorschlag(null);
    try {
      const r = await fetch('/api/ernaehrung/vorschlag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      if (d.plan) setVorschlag(d);
    } catch { /* still */ }
    setDenkt(false);
  }

  function uebernehmen() {
    if (!daten || !vorschlag) return;
    speichern({
      ...daten,
      plan: vorschlag.plan,
      einkauf: vorschlag.einkauf.map((text, i) => ({ id: `e-${Date.now().toString(36)}-${i}`, text, erledigt: false })),
    });
    setVorschlag(null);
  }

  function listeKopieren() {
    if (!daten) return;
    const offenP = daten.einkauf.filter(p => !p.erledigt).map(p => `– ${p.text}`).join('\n');
    try { navigator.clipboard.writeText(`Einkauf (${new Date().toLocaleDateString('de-DE')}):\n${offenP}`); setMeld('Liste kopiert — ab damit an Malin.'); } catch { setMeld('Kopieren nicht möglich.'); }
    setTimeout(() => setMeld(''), 2500);
  }

  if (!daten) {
    if (eingebettet) return <Leer>lade …</Leer>;
    return (
      <Seite titel="Ernährung" unter="Die Woche, die du durchhältst.">
        <Karte i={0}><Leer>lade …</Leer></Karte>
      </Seite>
    );
  }

  const heuteIdx = (new Date().getDay() + 6) % 7;
  const offeneEinkaeufe = daten.einkauf.filter(p => !p.erledigt).length;
  const geplantN = TAGE.reduce((s, t) => s + M_LABEL.filter(m => daten.plan[t][m.k].trim()).length, 0);

  const inhalt = (
    <Spalten verhaeltnis="2:1">
      <Spalte>
      {/* Essens-Woche + Jarvis */}
      <Abschnitt eingebettet={eingebettet} i={0} akzent={LEUCHT.gut}>
        <Ueberschrift farbe={geplantN >= 15 ? LEUCHT.gut : LEUCHT.achtung} rechts={<Chip farbe={geplantN >= 15 ? LEUCHT.gut : C.inkLeise}>{geplantN}/21 geplant</Chip>}>Essens-Woche</Ueberschrift>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <Knopf onClick={jarvisPlant} aus={denkt} farbe={LEUCHT.agenten}>{denkt ? 'Jarvis plant die Woche …' : '✨ Jarvis plant die Woche'}</Knopf>
          <span style={{ fontSize: 12, color: C.inkLeise }}>Plan die Woche einmal, dann ist Essen keine Tages-Entscheidung mehr.</span>
        </div>

        {vorschlag && (
          <div style={{ background: `${LEUCHT.agenten}14`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
            <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, margin: '0 0 10px' }}>
              <b style={{ color: LEUCHT.agenten }}>Jarvis:</b> {vorschlag.begruendung} <span style={{ color: C.inkLeise }}>({vorschlag.einkauf.length} Einkaufs-Posten)</span>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf onClick={uebernehmen} farbe={LEUCHT.gut}>Übernehmen — ersetzt Plan & Liste</Knopf>
              <Knopf leise onClick={() => setVorschlag(null)}>Verwerfen</Knopf>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TAGE.map((t, i) => {
            const heute = i === heuteIdx;
            return (
              <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '7px 8px', borderRadius: 10, background: heute ? 'rgba(255,255,255,.05)' : 'transparent' }}>
                <span style={{ fontSize: TYP.mikro, fontWeight: 600, color: heute ? LEUCHT.gut : C.inkLeise, width: 78, flex: '0 0 auto', textTransform: 'uppercase', letterSpacing: '.1em' }}>{TAG_LABEL[t]}</span>
                {M_LABEL.map(m => (
                  <input key={m.k} value={(vorschlag ? vorschlag.plan[t][m.k] : daten.plan[t][m.k]) ?? ''}
                    readOnly={!!vorschlag}
                    onChange={e => speichern({ ...daten, plan: { ...daten.plan, [t]: { ...daten.plan[t], [m.k]: e.target.value } } })}
                    placeholder={m.label}
                    style={{ ...klein, width: 'auto', flex: '1 1 130px', minWidth: 110, opacity: vorschlag ? 0.75 : 1, borderStyle: vorschlag ? 'dashed' : 'solid' }} />
                ))}
              </div>
            );
          })}
        </div>
        {vorschlag && <p style={{ fontSize: 12, color: LEUCHT.achtung, margin: '10px 0 0' }}>Vorschau — mit „Übernehmen“ wird sie dein Plan.</p>}
      </Abschnitt>

      </Spalte>
      <Spalte>
        {/* Einkaufsliste */}
        <Abschnitt eingebettet={eingebettet} i={1}>
          <Ueberschrift farbe={LEUCHT.geld} rechts={<><Chip farbe={offeneEinkaeufe ? LEUCHT.achtung : LEUCHT.gut}>{offeneEinkaeufe} offen</Chip><Knopf leise onClick={listeKopieren}>Liste kopieren</Knopf></>}>Einkaufsliste</Ueberschrift>
          {meld && <p style={{ fontSize: 12, color: LEUCHT.gut, margin: '0 0 8px' }}>{meld}</p>}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <Liste>
              {daten.einkauf.map(p => (
                <Zeile key={p.id}
                  links={<Haken an={p.erledigt} onChange={() => speichern({ ...daten, einkauf: daten.einkauf.map(x => x.id === p.id ? { ...x, erledigt: !x.erledigt } : x) })} />}
                  titel={<span style={{ color: p.erledigt ? C.inkLeise : C.ink, textDecoration: p.erledigt ? 'line-through' : 'none' }}>{p.text}</span>}
                  rechts={<button onClick={() => speichern({ ...daten, einkauf: daten.einkauf.filter(x => x.id !== p.id) })} aria-label="Posten entfernen" title="Posten entfernen" style={nackt}>✕</button>} />
              ))}
            </Liste>
            {!daten.einkauf.length && <Leer>Leer — Jarvis füllt sie mit dem Wochenplan, oder unten selbst ergänzen.</Leer>}
          </div>
          <div style={{ marginTop: 10 }}>
            <input value={neu} onChange={e => setNeu(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && neu.trim()) { speichern({ ...daten, einkauf: [...daten.einkauf, { id: `e-${Date.now().toString(36)}`, text: neu.trim(), erledigt: false }] }); setNeu(''); } }}
              placeholder="Posten hinzufügen … (Enter)" style={klein} />
          </div>
          {daten.einkauf.some(p => p.erledigt) && (
            <div style={{ marginTop: 10 }}>
              <Knopf leise onClick={() => speichern({ ...daten, einkauf: daten.einkauf.filter(p => !p.erledigt) })}>Abgehakte entfernen</Knopf>
            </div>
          )}
        </Abschnitt>

        {/* Grundsätze */}
        <Abschnitt eingebettet={eingebettet} i={2}>
          <Ueberschrift farbe={LEUCHT.agenten} rechts="steuern Jarvis' Vorschlag">Grundsätze</Ueberschrift>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600 }}>Grundsätze anzeigen & bearbeiten</summary>
            <textarea value={daten.grundsaetze} onChange={e => speichern({ ...daten, grundsaetze: e.target.value })} rows={5}
              style={{ ...feld, marginTop: 10, color: C.inkDim, fontSize: TYP.bedien, lineHeight: 1.55, resize: 'vertical' }} />
          </details>
          <p style={{ fontSize: 12, color: C.inkLeise, margin: '14px 0 0', lineHeight: 1.5 }}>
            Alltagsküche, kein Medizin- oder Ernährungsrat — Psoriasis-Fragen gehören zu Arzt/Ernährungsberatung.
            {' '}<Link href="/os/gesundheit" style={link}>Zum Cockpit ›</Link>
          </p>
        </Abschnitt>
      </Spalte>
    </Spalten>
  );

  if (eingebettet) return inhalt;

  return (
    <Seite titel="Ernährung" unter="Die Woche, die du durchhältst. Regelmäßig + anti-entzündlich — dein größter Hebel. Plan die Woche einmal, dann ist Essen keine Tages-Entscheidung mehr.">
      {inhalt}
    </Seite>
  );
}
