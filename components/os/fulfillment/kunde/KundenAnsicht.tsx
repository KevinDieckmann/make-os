'use client';

// ─── Fulfillment · Kunde — die Kunden-Ansicht (C2, 10.10.; neu gestaltet 12.10. „Fulfillment extern“; FULFILLMENT_KONZEPT.md 5.4, 6.4) ─────────────────
// EINE Komponente für die öffentliche Seite (`/kunde/kl-…`, components/os/fulfillment/kunde/KundenSeite.tsx), die interne Vorschau „So sieht der Kunde
// es“ UND die Präsentation „Dem Kunden zeigen“ (`praesentation`: Vollbild am großen Bildschirm, nichts zum Ausfüllen) — alle bekommen dasselbe, serverseitig
// gefilterte Objekt (`KundenSicht`, Positivliste in lib/fulfillment/kunde/sicht.ts). Die Komponente zeichnet nur, sie rechnet nichts und lädt nichts.
//
// Seit 17.10. (Miro-Standard: „lieber wenig und klar … es dupliziert sich“): Kopf (Projekt, Anbieter) · „So weit sind wir“ (Lage + die Reise als EINE
// Zeile — dieselbe Zeichnung wie intern, `ReiseBild`, mit „als Nächstes“ als Kästchen unter der laufenden Phase und dem Band „was bei Ihnen liegt“) · darunter
// höchstens: „Das braucht es von euch“ (wartet, mit Frist; Formulare, Unterlagen und die Puls-Frage direkt darunter) · „Euer Ziel“ (Wert-Konto und erste
// Erfolge) · „Nächster Termin“ (Takt, gemeinsam Entschiedenes, Ansprechperson). Nichts doppelt.
// Du/Sie aus der Sicht (`WORTE`), keine internen Begriffe (die säubert der Server), Handy zuerst (eine Spalte, Tippziele ≥ 44 px, Eingaben 16 px), ab
// ~900 px zwei Spalten, druckbar (globals.css `.kunde-ansicht` @media print). Kein Tracking, keine Speicherung im Browser.
// Wichtig: das Token steht im Fragment der Adresse — Sprünge innerhalb der Seite NIE über `#…` (das Fragment bliebe sonst ohne Token), nur `scrollIntoView`.

import { useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, MIKRO, TIEF, RAND } from '@/lib/make-one/design';
import { Karte, Knopf, Hinweis, Ueberschrift, Chip, Leer, Erfolg, Fortschritt, eingabe, LEUCHT } from '../../ui';
import type { KundenFormular, KundenFrage, KundenSicht } from '@/lib/fulfillment/kunde/sicht';
import { WORTE, brauchtAnzahl, entscheidungenTeilen, formularOffen, formularZaehlung, fragenText, kundenReise, uploadText, wertModell, type Worte } from '@/lib/fulfillment/kunde/bild';
import { KUNDE_ANNEHMEN, KUNDE_TYPEN_TEXT } from '@/lib/fulfillment/kunde/upload';
import { KundenWertBalken, LageBlock, FortschrittZahl, WEG_FARBE } from './bilder';
import { ReiseBild } from '../../ui/reise/ReiseBild';

export interface SpeicherErgebnis { ok: boolean; fehler?: string; neuLaden?: boolean }
export interface KundenAktionen {
  formular: (f: KundenFormular, antworten: Record<string, string>, abschnitt?: { schluessel: string; fertig: boolean }) => Promise<SpeicherErgebnis>;
  upload: (datei: File, zweck: 'playbook' | 'register' | 'sonstig') => Promise<SpeicherErgebnis>;
  puls: (wert: number, satz: string) => Promise<SpeicherErgebnis>;
}

const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const text = { fontSize: TYP.body, color: C.ink, lineHeight: 1.55 } as const;
const STATUS_TEXT = { offen: 'offen', entschieden: 'entschieden', verworfen: 'verworfen' } as const;

/** Zu einem Abschnitt der Seite springen — ohne das Fragment anzufassen (dort steht das Token). */
function springe(id: string) {
  if (typeof document === 'undefined') return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function KundenAnsicht({ sicht, vorschau, praesentation, aktionen }: { sicht: KundenSicht; vorschau?: boolean; praesentation?: boolean; aktionen?: KundenAktionen }) {
  const aus = !!vorschau || !!praesentation || !aktionen;
  const w = WORTE[sicht.anrede ?? 'sie'];
  const klasse = `kunde-ansicht${praesentation ? ' kunde-praesentation' : ''}`;
  if (sicht.modus === 'puls') {
    return (
      <div className={klasse}>
        <Kopf sicht={sicht} w={w} />
        <PulsKarte offen={!!sicht.puls?.offen} aus={aus} aktionen={aktionen} w={w} />
        {!praesentation && <Datenschutz sicht={sicht} />}
      </div>
    );
  }
  // EINE Zählung mit der Lage („Von Ihnen brauchen wir …“ — `brauchtAnzahl`, lib/fulfillment/kunde/bild.ts): nie zugleich „nichts nötig“ und „1 offen“.
  const offeneFormulare = sicht.formulare.filter(formularOffen);
  const braucht = brauchtAnzahl(sicht.wartet, offeneFormulare.map(f => f.schluessel));
  // 16.10. (Abnahme 2 · C6): „Gemeinsam entschieden“ zeigt nur Entschiedenes, Offenes steht darunter unter „Noch offen“ — EINE Regel `entscheidungenTeilen`.
  const ent = entscheidungenTeilen(sicht.entscheidungen);
  const reise = kundenReise(sicht.zeitstrahl, sicht.naechstes, braucht);
  return (
    <div className={klasse}>
      {vorschau && <Hinweis art="info" titel="Vorschau">So sieht der Kunde seine Seite — mit denselben Daten, die der Server ihm schickt. Hier lässt sich nichts ausfüllen.</Hinweis>}
      <Kopf sicht={sicht} w={w} gross={praesentation} />

      {/* So weit sind wir — die Lage in drei Sätzen und die Reise als EINE Zeile (17.10., Miro-Standard; dieselbe Zeichnung wie intern) */}
      <Karte className="kunde-held">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ ...MIKRO, color: WEG_FARBE }}>{w.soWeit}</div>
          {sicht.fortschritt != null && <FortschrittZahl prozent={sicht.fortschritt} gross={praesentation} />}
        </div>
        {sicht.lage && <div style={{ marginTop: 4 }}><LageBlock lage={sicht.lage} gross={praesentation} /></div>}
        {sicht.zeitstrahl.length > 0 && (
          <div style={{ marginTop: 22, display: 'grid', gap: 10 }}>
            <ReiseBild spalten={reise} hierText="hier stehen wir" bandTitel={w.beiEuch} gross={praesentation} label="Unser gemeinsamer Weg durch die Phasen" flow="still" />
            {sicht.erledigt.length > 0 && <div style={klein}><span style={{ ...MIKRO, marginRight: 8 }}>Erledigt in den letzten 14 Tagen</span>{sicht.erledigt.join(' · ')}</div>}
            {reise.some(p => p.raute) && <div style={{ ...klein, color: C.inkLeise }}>◇ Bestätigung — hier bestätigen wir gemeinsam, bevor es weitergeht.</div>}
          </div>
        )}
        {!sicht.lage && !sicht.zeitstrahl.length && <div style={{ marginTop: 8 }}><Leer>Wir richten das Projekt gerade ein — hier erscheint bald der Weg mit allen Phasen.</Leer></div>}
      </Karte>

      <div className="kunde-raster">
        {/* Das braucht es von euch — was beim Kunden liegt, mit Frist, direkt erledigen */}
        <Karte id="kunde-braucht" className="kunde-breit" ton={braucht ? LEUCHT.achtung : undefined}>
          <Ueberschrift rechts={braucht ? <Chip farbe={LEUCHT.achtung}>{braucht} offen</Chip> : <Chip farbe={LEUCHT.gut}>alles da</Chip>}>{w.braucht}</Ueberschrift>
          {braucht === 0 ? <Leer symbol="✓">{w.wartetLeer}</Leer> : (
            <ul className="kunde-braucht">
              {sicht.wartet.map((x, i) => (
                <li key={`w-${i}`}>
                  <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: '1 1 220px' }}>
                    <span style={{ ...text, fontWeight: 600, overflowWrap: 'anywhere' }}>{x.titel}</span>
                    <span style={klein}>{[x.seit ? `wartet seit ${x.seit}` : null, x.frist ? `Frist ${x.frist}` : null].filter(Boolean).join(' · ') || w.wartetAuf}</span>
                  </div>
                  {x.ueberfaellig && <Chip farbe={LEUCHT.kritisch}>Frist überschritten</Chip>}
                  {x.formular && !praesentation && <Knopf leise onClick={() => springe(x.formular!)}>Jetzt ausfüllen</Knopf>}
                </li>
              ))}
              {offeneFormulare.filter(f => !sicht.wartet.some(x => x.formular === f.schluessel)).map(f => {
                const z = formularZaehlung(f.abschnitte.flatMap(a => a.fragen), f.antworten);
                const alle = z.gesamt > 0 && z.beantwortet === z.gesamt;
                return (
                  <li key={f.schluessel}>
                    <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: '1 1 220px' }}>
                      <span style={{ ...text, fontWeight: 600, overflowWrap: 'anywhere' }}>{f.titel} {alle ? 'abschließen' : 'ausfüllen'}</span>
                      <span style={klein}>{alle ? 'Alle Fragen sind beantwortet — es fehlt nur noch der Abschluss.' : fragenText(z)}</span>
                    </div>
                    {!praesentation && <Knopf leise onClick={() => springe(f.schluessel)}>{alle ? 'Abschließen' : 'Jetzt ausfüllen'}</Knopf>}
                  </li>
                );
              })}
            </ul>
          )}
          {sicht.upload?.erlaubt && !praesentation && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={klein}>Unterlagen für uns? Sie gehen verschlüsselt direkt an uns.</span>
              <Knopf leise onClick={() => springe('kunde-unterlagen')}>Unterlage hochladen</Knopf>
            </div>
          )}
        </Karte>

        {/* Das Ausfüllen gehört zu „Das brauchen wir“ — die Formulare, die Ablage und die Puls-Frage (nur, wenn gefragt) stehen direkt darunter. */}
        {!praesentation && sicht.formulare.map(f => <div key={f.schluessel} className="kunde-breit" id={f.schluessel}><FormularKarte f={f} aus={aus} speichern={aktionen?.formular} w={w} /></div>)}
        {sicht.upload && !praesentation && <UploadKarte upload={sicht.upload} aus={aus} aktionen={aktionen} w={w} />}
        {sicht.puls?.offen && !praesentation && <PulsKarte offen aus={aus} aktionen={aktionen} w={w} />}

        {/* Euer Ziel — das Wert-Konto und die ersten Erfolge */}
        <Karte>
          <Ueberschrift>{w.ziel}</Ueberschrift>
          {sicht.wertKonto.length ? (
            <div style={{ display: 'grid', gap: 18 }}>
              {sicht.wertKonto.map(z => <KundenWertBalken key={z.name} w={z} gross={praesentation} />)}
              {/* Nur mit Werten: bei leeren Zielen steht schon der ruhige Satz („legen wir im Kick-off fest“) — kein Erklärsatz für Striche. */}
              {sicht.wertKonto.some(z => !wertModell(z).leer) && <div style={{ ...klein, color: C.inkLeise }}>{w.zielSatz}</div>}
            </div>
          ) : <Leer symbol="◎">{w.zielLeer}</Leer>}
          <div style={{ height: 16 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ ...MIKRO }}>{w.erfolge}</span>
            {sicht.quickWins.length > 0 && <Chip farbe={LEUCHT.gut}>{sicht.quickWins.filter(q => q.erledigt).length} von {sicht.quickWins.length} erreicht</Chip>}
          </div>
          {sicht.quickWins.length ? (
            <ul className="kunde-erfolge">
              {sicht.quickWins.map((q, i) => (
                <li key={i}>
                  <span aria-hidden className="kunde-erfolg-zeichen" style={{ background: q.erledigt ? LEUCHT.gut : 'transparent', borderColor: q.erledigt ? LEUCHT.gut : C.inkLeise, color: C.grund }}>{q.erledigt ? '✓' : ''}</span>
                  <span style={{ minWidth: 0, flex: 1, ...text, color: q.erledigt ? C.ink : C.inkDim, overflowWrap: 'anywhere' }}>{q.text}</span>
                  <span style={{ ...klein, flex: '0 0 auto', color: q.erledigt ? LEUCHT.gut : C.inkLeise }}>{q.erledigt ? `erreicht${q.am ? ` ${q.am.slice(0, 6)}` : ''}` : q.bis ? `bis ${q.bis.slice(0, 6)}` : 'geplant'}</span>
                </li>
              ))}
            </ul>
          ) : <Leer symbol="✦">{w.erfolgeLeer}</Leer>}
        </Karte>

        {/* Nächster Termin, unser Takt und was gemeinsam entschieden ist */}
        <Karte>
          <Ueberschrift>{sicht.naechsterTermin ? w.termin : w.takt}</Ueberschrift>
          {sicht.naechsterTermin && (
            <div style={{ display: 'grid', gap: 2, marginBottom: sicht.rituale.length ? 14 : 0 }}>
              <span style={{ fontFamily: SCHRIFT.display, fontSize: praesentation ? 26 : TYP.titel, fontWeight: 700, color: C.ink }}>{sicht.naechsterTermin.am}</span>
              <span style={text}>{sicht.naechsterTermin.titel}</span>
            </div>
          )}
          {sicht.rituale.length > 0 ? (<>
            {sicht.naechsterTermin && <div style={{ ...MIKRO, marginBottom: 6 }}>{w.takt}</div>}
            <ul className="kunde-liste kunde-takt">
              {sicht.rituale.map((r, i) => <li key={i}><span style={{ fontWeight: 600 }}>{r.titel}</span> <span style={klein}>· {r.rhythmus}{r.naechster ? ` · nächster ${r.naechster}` : ''}</span></li>)}
            </ul>
          </>) : !sicht.naechsterTermin && <Leer symbol="◷">Die festen Termine stimmen wir gemeinsam ab — sie erscheinen dann hier.</Leer>}
          {/* 16.10. (Abnahme 2 · C6): „Gemeinsam entschieden“ zeigt nur Entschiedenes, Offenes steht darunter unter „Noch offen“ — EINE Regel `entscheidungenTeilen`. */}
          {ent.entschieden.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...MIKRO, marginBottom: 6 }}>{w.entscheidungen}</div>
              <ul className="kunde-liste">
                {ent.entschieden.map((e, i) => <li key={i}><span style={{ fontWeight: 600 }}>{e.titel}</span> <span style={klein}>· {e.am} · {STATUS_TEXT[e.status]}</span>{e.inhalt ? <div style={klein}>{e.inhalt}</div> : null}</li>)}
              </ul>
            </div>
          )}
          {ent.offen.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...MIKRO, marginBottom: 6 }}>{w.entscheidungenOffen}</div>
              <ul className="kunde-liste">
                {ent.offen.map((e, i) => <li key={i}><span style={{ fontWeight: 600 }}>{e.titel}</span> <span style={klein}>· seit {e.am}</span>{e.inhalt ? <div style={klein}>{e.inhalt}</div> : null}</li>)}
              </ul>
            </div>
          )}
          {(sicht.ansprechperson || sicht.anbieter?.email || sicht.anbieter?.telefon) && !praesentation && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${RAND.haar}`, display: 'grid', gap: 6 }}>
              {sicht.ansprechperson && <span style={klein}>{w.ansprechperson}: <b style={{ color: C.ink }}>{sicht.ansprechperson}</b></span>}
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {sicht.anbieter?.email && <a className="kunde-link" href={`mailto:${sicht.anbieter.email}`}>{sicht.anbieter.email}</a>}
                {sicht.anbieter?.telefon && <a className="kunde-link" href={`tel:${sicht.anbieter.telefon.replace(/[^+0-9]/g, '')}`}>{sicht.anbieter.telefon}</a>}
              </span>
            </div>
          )}
        </Karte>
      </div>
      {!praesentation && <Datenschutz sicht={sicht} />}
    </div>
  );
}

function Kopf({ sicht, w, gross }: { sicht: KundenSicht; w: Worte; gross?: boolean }) {
  const a = sicht.anbieter;
  const titel = sicht.mandat || sicht.firma;
  return (
    <header className="kunde-kopf">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {a?.logo
            // eslint-disable-next-line @next/next/no-img-element -- Bild-Daten aus dem Server (data:), kein Abruf von außen; next/image braucht hier nichts
            ? <img src={a.logo} alt={a.name} className="kunde-logo" />
            : a ? <span aria-hidden className="kunde-monogramm" style={{ background: TIEF.flaeche(WEG_FARBE), border: `1px solid ${TIEF.rand(WEG_FARBE)}`, color: WEG_FARBE }}>{a.name.trim().charAt(0).toUpperCase()}</span> : null}
          {a && <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim, overflowWrap: 'anywhere' }}>{a.name}</span>}
        </span>
        <span style={{ ...MIKRO }}>Stand {sicht.stand}</span>
      </div>
      <h1 style={{ fontFamily: SCHRIFT.display, fontSize: gross ? 44 : 30, fontWeight: 700, letterSpacing: '-.02em', margin: '18px 0 0', color: C.ink, lineHeight: 1.12, overflowWrap: 'anywhere' }}>{titel}</h1>
      <div style={{ ...text, color: C.inkDim, marginTop: 6, fontSize: gross ? 19 : TYP.body }}>
        {sicht.mandat ? <>{w.fuerEuch} <b style={{ color: C.ink, fontWeight: 600 }}>{sicht.firma}</b></> : null}{sicht.paket ? <>{sicht.mandat ? ' · ' : ''}{sicht.paket}</> : null}
      </div>
    </header>
  );
}

/** Der Honigtopf: ein Feld, das Menschen nie sehen (und Vorleser überspringen). */
export function Honigtopf({ wert, setWert }: { wert: string; setWert: (v: string) => void }) {
  return (
    <div aria-hidden style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
      <label>Webseite<input tabIndex={-1} autoComplete="off" value={wert} onChange={e => setWert(e.target.value)} name="webseite" /></label>
    </div>
  );
}

function FrageFeld({ q, wert, setWert, aus, nr }: { q: KundenFrage; wert: string; setWert: (v: string) => void; aus: boolean; nr: number }) {
  const id = `frage-${q.id}`;
  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <label htmlFor={id} style={{ ...text, fontWeight: 600 }}><span style={{ color: C.inkLeise, fontWeight: 600, marginRight: 6 }}>{nr}.</span>{q.frage}{q.pflicht ? <span style={{ color: LEUCHT.achtung }} title="Pflichtfrage"> *</span> : ''}</label>
      {q.hilfe && <span style={klein}>{q.hilfe}</span>}
      {q.art === 'langtext' && <textarea id={id} rows={4} value={wert} disabled={aus} maxLength={4000} onChange={e => setWert(e.target.value)} style={{ ...eingabe, minHeight: 112, resize: 'vertical', lineHeight: 1.5 }} />}
      {(q.art === 'text' || q.art === 'zahl') && <input id={id} value={wert} disabled={aus} maxLength={4000} inputMode={q.art === 'zahl' ? 'decimal' : 'text'} onChange={e => setWert(e.target.value)} style={eingabe} />}
      {q.art === 'auswahl' && (
        <select id={id} value={wert} disabled={aus} onChange={e => setWert(e.target.value)} style={{ ...eingabe, colorScheme: 'dark' }}>
          <option value="">— bitte wählen —</option>
          {(q.optionen ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {q.art === 'ja-nein' && (
        <div role="radiogroup" aria-labelledby={id} id={id} style={{ display: 'flex', gap: 8 }}>
          {(['ja', 'nein'] as const).map(o => <Knopf key={o} leise={wert !== o} aus={aus} onClick={() => setWert(wert === o ? '' : o)}>{o === 'ja' ? 'Ja' : 'Nein'}</Knopf>)}
        </div>
      )}
    </div>
  );
}

/**
 * Ein Formular (Playbook, Workbook) je Abschnitt — auf der Kunden-Seite und intern („gemeinsam ausfüllen“) derselbe Baustein. Fortschritt „3 von 8 Fragen“,
 * Zwischenspeichern (auch beim Wechsel des Abschnitts), Pflichtfragen vor „Abschnitt abschließen“, verständliche Fehler, Bestätigung am Ende.
 */
export function FormularKarte({ f, aus, speichern: speichernAn, w = WORTE.du }: { f: KundenFormular; aus: boolean; speichern?: KundenAktionen['formular']; w?: Worte }) {
  const [werte, setWerte] = useState<Record<string, string>>({ ...f.antworten });
  const [gespeichert, setGespeichert] = useState<Record<string, string>>({ ...f.antworten });
  const [offen, setOffen] = useState<string | null>(f.abschnitte.find(a => !a.fertig)?.schluessel ?? null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'achtung'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const alleFragen = useMemo(() => f.abschnitte.flatMap(a => a.fragen), [f.abschnitte]);
  const zaehlung = formularZaehlung(alleFragen, werte);
  const offenAbschnitte = f.abschnitte.filter(a => !a.fertig).length;
  const geaendert = (a?: KundenFormular['abschnitte'][number]) => (a ? a.fragen : alleFragen).some(q => (werte[q.id] ?? '') !== (gespeichert[q.id] ?? ''));
  const ungespeichert = !aus && !!speichernAn && geaendert();
  const nr = useMemo(() => new Map(alleFragen.map((q, i) => [q.id, i + 1])), [alleFragen]);

  // Ungespeicherte Eingaben nicht still verlieren: beim Verlassen der Seite nachfragen (der Browser zeigt seinen eigenen Satz).
  const ungespeichertRef = useRef(ungespeichert);
  ungespeichertRef.current = ungespeichert;
  useEffect(() => {
    if (aus || !speichernAn) return;
    const vorher = (e: BeforeUnloadEvent) => { if (ungespeichertRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', vorher);
    return () => window.removeEventListener('beforeunload', vorher);
  }, [aus, speichernAn]);

  const speichern = async (a: KundenFormular['abschnitte'][number], fertig?: boolean): Promise<boolean> => {
    if (!speichernAn) return false;
    if (fertig) {
      const z = formularZaehlung(a.fragen, werte);
      if (z.pflichtOffen.length) { setMeldung({ art: 'achtung', text: `Bitte noch beantworten: ${z.pflichtOffen.map(x => `„${x.length > 70 ? `${x.slice(0, 69)}…` : x}“`).join(', ')}.` }); return false; }
    }
    setLaeuft(true);
    const antworten = Object.fromEntries(a.fragen.map(q => [q.id, werte[q.id] ?? '']));
    const r = await speichernAn(f, antworten, fertig === undefined ? undefined : { schluessel: a.schluessel, fertig });
    setLaeuft(false);
    if (r.ok) {
      setGespeichert(g => ({ ...g, ...antworten }));
      setMeldung({ art: 'gut', text: fertig ? `„${a.titel}“ ist abgeschlossen — danke!` : fertig === false ? `„${a.titel}“ ist wieder offen.` : 'Zwischengespeichert.' });
      if (fertig) setOffen(f.abschnitte.find(x => !x.fertig && x.schluessel !== a.schluessel)?.schluessel ?? null);
    } else setMeldung({ art: r.neuLaden ? 'achtung' : 'kritisch', text: r.neuLaden ? `${r.fehler ?? 'Nicht gespeichert.'} Ihre Eingaben bleiben in den Feldern.` : (r.fehler ?? 'Nicht gespeichert — bitte noch einmal versuchen.') });
    return r.ok;
  };
  const umschalten = async (a: KundenFormular['abschnitte'][number]) => {
    const jetzt = f.abschnitte.find(x => x.schluessel === offen);
    // Beim Wechsel wird der offene Abschnitt zwischengespeichert, wenn sich etwas geändert hat.
    if (jetzt && jetzt.schluessel !== a.schluessel && !aus && speichernAn && geaendert(jetzt)) await speichern(jetzt);
    setOffen(offen === a.schluessel ? null : a.schluessel);
  };
  const fertigAlles = f.abschnitte.length > 0 && offenAbschnitte === 0;
  return (
    <Karte>
      <Ueberschrift rechts={fertigAlles ? <Chip farbe={LEUCHT.gut}>vollständig</Chip> : <Chip farbe={WEG_FARBE}>{zaehlung.beantwortet} / {zaehlung.gesamt}</Chip>}>{f.titel}</Ueberschrift>
      {f.zweck && <div style={{ ...text, color: C.inkDim, marginBottom: 10 }}>{f.zweck}</div>}
      <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
        <Fortschritt anteil={zaehlung.gesamt ? zaehlung.beantwortet / zaehlung.gesamt : 0} farbe={fertigAlles ? LEUCHT.gut : WEG_FARBE} />
        <span style={klein}>{fragenText(zaehlung)}{f.abschnitte.length > 1 ? ` · ${f.abschnitte.length - offenAbschnitte} von ${f.abschnitte.length} Abschnitten abgeschlossen` : ''}</span>
      </div>
      {fertigAlles && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 14, background: TIEF.flaeche(LEUCHT.gut), border: `1px solid ${TIEF.rand(LEUCHT.gut)}`, marginBottom: 10 }}>
          <Erfolg groesse={26} />
          <span style={{ ...text }}>{w.formularFertig}</span>
        </div>
      )}
      {!aus && speichernAn && !fertigAlles && <div style={{ ...klein, marginBottom: 8 }}>{w.formularHinweis}</div>}
      <div style={{ display: 'grid', gap: 4 }}>
        {f.abschnitte.map(a => {
          const z = formularZaehlung(a.fragen, werte);
          const auf = offen === a.schluessel;
          return (
            <div key={a.schluessel} style={{ borderTop: `1px solid ${RAND.haar}`, paddingTop: 4 }}>
              <button type="button" onClick={() => void umschalten(a)} aria-expanded={auf} className="kunde-abschnitt-knopf">
                <span aria-hidden className="kunde-erfolg-zeichen" style={{ background: a.fertig ? LEUCHT.gut : 'transparent', borderColor: a.fertig ? LEUCHT.gut : z.beantwortet ? WEG_FARBE : C.inkLeise, color: C.grund }}>{a.fertig ? '✓' : ''}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{a.titel}</span>
                <span style={{ ...klein, flex: '0 0 auto' }}>{a.fertig ? 'abgeschlossen' : `${z.beantwortet}/${z.gesamt}`}</span>
                <span aria-hidden style={{ color: C.inkLeise, flex: '0 0 auto', width: 14, textAlign: 'center' }}>{auf ? '–' : '+'}</span>
              </button>
              {auf && (
                <div style={{ display: 'grid', gap: 16, padding: '10px 0 8px' }}>
                  {a.fragen.map(q => <FrageFeld key={q.id} q={q} nr={nr.get(q.id) ?? 0} aus={aus} wert={werte[q.id] ?? ''} setWert={v => setWerte(x => ({ ...x, [q.id]: v }))} />)}
                  {!aus && speichernAn && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <Knopf leise aus={laeuft || !geaendert(a)} onClick={() => speichern(a)}>Zwischenspeichern</Knopf>
                      <Knopf aus={laeuft} onClick={() => speichern(a, !a.fertig)}>{a.fertig ? 'Wieder öffnen' : 'Abschnitt abschließen'}</Knopf>
                      {geaendert(a) && <span style={{ ...klein, color: LEUCHT.achtung }}>noch nicht gespeichert</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis></div>}
    </Karte>
  );
}

function UploadKarte({ upload, aus, aktionen, w }: { upload: NonNullable<KundenSicht['upload']>; aus: boolean; aktionen?: KundenAktionen; w: Worte }) {
  const [datei, setDatei] = useState<File | null>(null);
  const [zweck, setZweck] = useState<'playbook' | 'register' | 'sonstig'>('sonstig');
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [zieht, setZieht] = useState(false);
  const feld = useRef<HTMLInputElement>(null);
  const senden = async () => {
    if (!datei || !aktionen) return;
    setLaeuft(true);
    const r = await aktionen.upload(datei, zweck);
    setLaeuft(false);
    setMeldung(r.ok ? { art: 'gut', text: w.uploadDanke } : { art: 'kritisch', text: r.fehler ?? 'Nicht hochgeladen — bitte noch einmal versuchen.' });
    if (r.ok) { setDatei(null); if (feld.current) feld.current.value = ''; }
  };
  const groesse = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const geprueft = upload.geprueft ?? 0, offen = upload.offen ?? 0;
  return (
    <Karte id="kunde-unterlagen">
      <Ueberschrift rechts={upload.eingegangen ? <Chip farbe={offen ? LEUCHT.achtung : LEUCHT.gut}>{offen ? `${offen} in Prüfung` : 'alle geprüft'}</Chip> : undefined}>{w.unterlagen}</Ueberschrift>
      <div style={{ ...text, color: C.inkDim }}>{w.uploadText}</div>
      {upload.eingegangen > 0 && (
        <div className="kunde-zahlen" style={{ marginTop: 12 }}>
          <span><b>{upload.eingegangen}</b> eingegangen</span>
          <span style={{ color: LEUCHT.gut }}><b>{geprueft}</b> geprüft</span>
          <span style={{ color: offen ? LEUCHT.achtung : C.inkDim }}><b>{offen}</b> in Prüfung</span>
        </div>
      )}
      {upload.erlaubt ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <label className={`kunde-ablage${zieht ? ' kunde-ablage-aktiv' : ''}${aus ? ' kunde-ablage-aus' : ''}`}
            onDragOver={e => { if (aus) return; e.preventDefault(); setZieht(true); }} onDragLeave={() => setZieht(false)}
            onDrop={e => { if (aus) return; e.preventDefault(); setZieht(false); const x = e.dataTransfer.files?.[0]; if (x) setDatei(x); }}>
            <input ref={feld} type="file" accept={KUNDE_ANNEHMEN} disabled={aus} onChange={e => setDatei(e.target.files?.[0] ?? null)} className="kunde-ablage-feld" aria-label="Datei wählen" />
            <span aria-hidden style={{ fontSize: 22, color: WEG_FARBE, lineHeight: 1 }}>⇪</span>
            <span style={{ ...text, fontWeight: 600 }}>{datei ? datei.name : 'Datei wählen'}</span>
            <span style={klein}>{datei ? groesse(datei.size) : 'oder hierher ziehen'}</span>
          </label>
          <select value={zweck} disabled={aus} onChange={e => setZweck(e.target.value as typeof zweck)} style={{ ...eingabe, colorScheme: 'dark' }} aria-label="Worum geht es?">
            <option value="sonstig">Unterlage zum Projekt</option>
            <option value="playbook">Zum Playbook</option>
            <option value="register">Registerauszug</option>
          </select>
          {!aus && <Knopf haupt voll aus={!datei || laeuft} onClick={senden}>{laeuft ? 'Wird sicher übertragen …' : 'Sicher hochladen'}</Knopf>}
        </div>
      ) : <div style={{ marginTop: 10 }}><Leer>{w.uploadVoll}</Leer></div>}
      <div style={{ ...klein, color: C.inkLeise, marginTop: 10 }}>{upload.eingegangen ? '' : `${uploadText(upload)} `}Erlaubt: {KUNDE_TYPEN_TEXT}, je Datei bis 25 MB. Verschlüsselt gespeichert; Fotos ohne Ortsangaben. Die Liste der Dateien bleibt bei uns.</div>
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis></div>}
    </Karte>
  );
}

function PulsKarte({ offen, aus, aktionen, w }: { offen: boolean; aus: boolean; aktionen?: KundenAktionen; w: Worte }) {
  const [wert, setWert] = useState<number | null>(null);
  const [satz, setSatz] = useState('');
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  if (!offen || fertig) {
    return (
      <Karte ton={LEUCHT.gut} id="kunde-puls">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Erfolg groesse={28} />
          <div style={{ display: 'grid', gap: 2 }}><span style={{ ...text, fontWeight: 700 }}>Danke!</span><span style={text}>{fertig ? w.pulsDanke : w.pulsZu}</span></div>
        </div>
      </Karte>
    );
  }
  const senden = async () => {
    if (wert === null || !aktionen) return;
    setLaeuft(true);
    const r = await aktionen.puls(wert, satz);
    setLaeuft(false);
    if (r.ok) setFertig(true); else setFehler(r.fehler ?? 'Nicht gesendet — bitte noch einmal versuchen.');
  };
  return (
    <Karte id="kunde-puls" ton={WEG_FARBE}>
      <Ueberschrift>{w.puls}</Ueberschrift>
      <div style={text}>{w.pulsFrage}</div>
      <div role="radiogroup" aria-label="Zufriedenheit von 0 bis 10" className="kunde-puls-skala">
        {Array.from({ length: 11 }, (_, i) => (
          <button key={i} type="button" role="radio" aria-checked={wert === i} disabled={aus} onClick={() => setWert(i)}
            style={{ minHeight: 44, borderRadius: 12, fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 700, cursor: aus ? 'default' : 'pointer', color: wert === i ? C.grund : C.ink, background: wert === i ? C.aktiv : 'rgba(255,255,255,.05)', border: `1px solid ${wert === i ? C.aktiv : RAND.stark}` }}>{i}</button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...MIKRO, marginTop: 6 }}><span>gar nicht</span><span>sehr</span></div>
      <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
        <span style={klein}>Ein Satz dazu (freiwillig)</span>
        <textarea rows={2} maxLength={500} value={satz} disabled={aus} onChange={e => setSatz(e.target.value)} style={{ ...eingabe, minHeight: 72, resize: 'vertical' }} />
      </label>
      {fehler && <div style={{ marginTop: 10 }}><Hinweis art="kritisch">{fehler}</Hinweis></div>}
      {!aus && <div style={{ marginTop: 12 }}><Knopf haupt voll aus={wert === null || laeuft} onClick={senden}>Antwort senden</Knopf></div>}
    </Karte>
  );
}

function Datenschutz({ sicht }: { sicht: KundenSicht }) {
  const d = sicht.datenschutz;
  return (
    <details className="kunde-datenschutz">
      <summary>Datenschutz &amp; Hinweise</summary>
      <div style={{ display: 'grid', gap: 8, ...klein, marginTop: 10 }}>
        <div><b style={{ color: C.ink }}>Verantwortlich:</b> {d.verantwortlich}</div>
        {d.absaetze.map((a, i) => <p key={i} style={{ margin: 0 }}>{a}</p>)}
        {d.seite && /^https:\/\//.test(d.seite) && <a href={d.seite} rel="noopener noreferrer nofollow" target="_blank" className="kunde-link">Ausführlicher Datenschutzhinweis ›</a>}
        <div style={{ color: C.inkLeise }}>Fassung {d.fassung}</div>
      </div>
    </details>
  );
}
