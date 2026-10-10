'use client';

// ─── Fulfillment · Kunde — die Kunden-Ansicht (C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4, 6.4) ──────────────────────────────────────────────────────
// EINE Komponente für die öffentliche Seite (`/kunde/kl-…`, components/os/fulfillment/kunde/KundenSeite.tsx) UND die interne Vorschau „So sieht der
// Kunde es“ — beide bekommen dasselbe, serverseitig gefilterte Objekt (`KundenSicht`, Positivliste in lib/fulfillment/kunde/sicht.ts). Die Komponente
// zeichnet nur, sie rechnet nichts und lädt nichts. Handy zuerst (eine Spalte, Tippziele ≥ 44 px, Eingaben 16 px), kein Tracking.
// Interaktiv nur mit den Rückrufen der Seite (`aktionen`); in der Vorschau (`vorschau`) ist alles gesperrt.

import { useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Knopf, Hinweis, Ueberschrift, Chip, Leer, eingabe, LEUCHT } from '../../ui';
import type { KundenFormular, KundenFrage, KundenSicht } from '@/lib/fulfillment/kunde/sicht';
import { KUNDE_ANNEHMEN, KUNDE_TYPEN_TEXT } from '@/lib/fulfillment/kunde/upload';

export interface SpeicherErgebnis { ok: boolean; fehler?: string; neuLaden?: boolean }
export interface KundenAktionen {
  formular: (f: KundenFormular, antworten: Record<string, string>, abschnitt?: { schluessel: string; fertig: boolean }) => Promise<SpeicherErgebnis>;
  upload: (datei: File, zweck: 'playbook' | 'register' | 'sonstig') => Promise<SpeicherErgebnis>;
  puls: (wert: number, satz: string) => Promise<SpeicherErgebnis>;
}

const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const text = { fontSize: TYP.body, color: C.ink, lineHeight: 1.55 } as const;
const STAND_FARBE = { erledigt: LEUCHT.gut, aktuell: C.aktiv, kommt: C.inkLeise } as const;
const STAND_TEXT = { erledigt: 'erledigt', aktuell: 'gerade dran', kommt: 'kommt' } as const;
const STATUS_TEXT = { offen: 'offen', entschieden: 'entschieden', verworfen: 'verworfen' } as const;

function Punkte({ liste, leer }: { liste: readonly ReactNode[]; leer: string }) {
  if (!liste.length) return <Leer>{leer}</Leer>;
  return <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, ...text }}>{liste.map((x, i) => <li key={i} style={{ overflowWrap: 'anywhere' }}>{x}</li>)}</ul>;
}

export function KundenAnsicht({ sicht, vorschau, aktionen }: { sicht: KundenSicht; vorschau?: boolean; aktionen?: KundenAktionen }) {
  const aus = vorschau || !aktionen;
  if (sicht.modus === 'puls') {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <Kopf sicht={sicht} />
        <PulsKarte offen={!!sicht.puls?.offen} aus={aus} aktionen={aktionen} firma={sicht.firma} />
        <Datenschutz sicht={sicht} />
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {vorschau && <Hinweis art="info" titel="Vorschau">So sieht der Kunde seine Seite — mit denselben Daten, die der Server ihm schickt. Hier lässt sich nichts ausfüllen.</Hinweis>}
      <Kopf sicht={sicht} />
      {sicht.zeitstrahl.length > 0 && (
        <Karte>
          <Ueberschrift>Unser Weg</Ueberschrift>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {sicht.zeitstrahl.map((z, i) => (
              <li key={`${z.titel}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: 999, flex: '0 0 auto', background: z.stand === 'kommt' ? 'transparent' : STAND_FARBE[z.stand], border: `2px solid ${STAND_FARBE[z.stand]}` }} />
                <span style={{ ...text, flex: 1, minWidth: 0, fontWeight: z.stand === 'aktuell' ? 700 : 400 }}>{z.titel}</span>
                <Chip farbe={STAND_FARBE[z.stand]}>{STAND_TEXT[z.stand]}</Chip>
              </li>
            ))}
          </ol>
        </Karte>
      )}
      <Karte>
        <Ueberschrift>Wartet auf euch</Ueberschrift>
        <Punkte liste={sicht.wartet.map(w => <>{w.titel}{w.seit ? <span style={klein}> · seit {w.seit}</span> : null}</>)} leer="Gerade nichts — danke!" />
      </Karte>
      <Karte>
        <Ueberschrift>Erledigt (letzte 14 Tage)</Ueberschrift>
        <Punkte liste={sicht.erledigt} leer="In den letzten zwei Wochen wurde hier noch nichts abgeschlossen." />
        <div style={{ height: 12 }} />
        <Ueberschrift>Als Nächstes</Ueberschrift>
        <Punkte liste={sicht.naechstes} leer="Die nächsten Schritte stimmen wir im nächsten Termin ab." />
      </Karte>
      {sicht.wertKonto.length > 0 && (
        <Karte>
          <Ueberschrift>Wert-Konto</Ueberschrift>
          <div style={klein}>Vorher → jetzt → Ziel. Die Werte tragen wir gemeinsam im Wochen-Check ein — ein Zielbild, keine Garantie.</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {sicht.wertKonto.map(w => (
              <div key={w.name} style={{ display: 'grid', gap: 2 }}>
                <span style={{ ...text, fontWeight: 600, overflowWrap: 'anywhere' }}>{w.name}</span>
                <span style={klein}>{w.vorher} → <b style={{ color: C.ink }}>{w.jetzt}</b> → {w.ziel}{w.bis ? ` (bis ${w.bis})` : ''}</span>
              </div>
            ))}
          </div>
        </Karte>
      )}
      {sicht.formulare.map(f => <FormularKarte key={f.schluessel} f={f} aus={aus} speichern={aktionen?.formular} />)}
      {sicht.upload && <UploadKarte upload={sicht.upload} aus={aus} aktionen={aktionen} />}
      {sicht.puls?.offen && <PulsKarte offen aus={aus} aktionen={aktionen} firma={sicht.firma} />}
      {(sicht.rituale.length > 0 || sicht.entscheidungen.length > 0) && (
        <Karte flach>
          {sicht.rituale.length > 0 && (<>
            <Ueberschrift>Unser Takt</Ueberschrift>
            <Punkte liste={sicht.rituale.map(r => `${r.titel} · ${r.rhythmus}`)} leer="" />
          </>)}
          {sicht.entscheidungen.length > 0 && (<>
            <div style={{ height: 12 }} />
            <Ueberschrift>Entscheidungen</Ueberschrift>
            <Punkte liste={sicht.entscheidungen.map(e => <>{e.titel} <span style={klein}>· {e.am} · {STATUS_TEXT[e.status]}</span>{e.inhalt ? <div style={klein}>{e.inhalt}</div> : null}</>)} leer="" />
          </>)}
        </Karte>
      )}
      <Datenschutz sicht={sicht} />
    </div>
  );
}

function Kopf({ sicht }: { sicht: KundenSicht }) {
  return (
    <header style={{ display: 'grid', gap: 4 }}>
      <h1 style={{ fontFamily: SCHRIFT.display, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: C.ink, overflowWrap: 'anywhere' }}>{sicht.firma}</h1>
      <div style={klein}>{[sicht.mandat, sicht.paket, `Stand ${sicht.stand}`].filter(Boolean).join(' · ')}</div>
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

function FrageFeld({ q, wert, setWert, aus }: { q: KundenFrage; wert: string; setWert: (v: string) => void; aus: boolean }) {
  const id = `frage-${q.id}`;
  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <label htmlFor={id} style={{ ...text, fontWeight: 600 }}>{q.frage}{q.pflicht ? ' *' : ''}</label>
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

/** Ein Formular (Playbook, Workbook) je Abschnitt — auf der Kunden-Seite und intern („gemeinsam ausfüllen“) derselbe Baustein. */
export function FormularKarte({ f, aus, speichern: speichernAn }: { f: KundenFormular; aus: boolean; speichern?: KundenAktionen['formular'] }) {
  const [werte, setWerte] = useState<Record<string, string>>({ ...f.antworten });
  const [offen, setOffen] = useState<string | null>(f.abschnitte.find(a => !a.fertig)?.schluessel ?? null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'achtung'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const speichern = async (a: KundenFormular['abschnitte'][number], fertig?: boolean) => {
    if (!speichernAn) return;
    setLaeuft(true);
    const antworten = Object.fromEntries(a.fragen.map(q => [q.id, werte[q.id] ?? '']));
    const r = await speichernAn(f, antworten, fertig === undefined ? undefined : { schluessel: a.schluessel, fertig });
    setLaeuft(false);
    setMeldung(r.ok ? { art: 'gut', text: fertig ? 'Abschnitt gespeichert und als fertig markiert — danke!' : 'Gespeichert.' } : { art: r.neuLaden ? 'achtung' : 'kritisch', text: r.fehler ?? 'Nicht gespeichert.' });
  };
  return (
    <Karte>
      <Ueberschrift rechts={<Chip farbe={f.prozent >= 100 ? LEUCHT.gut : C.aktiv}>{f.prozent} %</Chip>}>{f.titel}</Ueberschrift>
      {f.zweck && <div style={{ ...klein, marginBottom: 8 }}>{f.zweck}</div>}
      <div style={{ ...klein, marginBottom: 8 }}>Eure Antworten speichern wir je Abschnitt. Ihr könnt jederzeit weitermachen — der Link bleibt gleich.</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {f.abschnitte.map(a => (
          <div key={a.schluessel} style={{ borderTop: `1px solid ${C.linie}`, paddingTop: 8 }}>
            <button type="button" onClick={() => setOffen(offen === a.schluessel ? null : a.schluessel)} aria-expanded={offen === a.schluessel}
              style={{ display: 'flex', width: '100%', minHeight: 44, alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ flex: 1, minWidth: 0 }}>{a.titel}</span>
              {a.fertig && <Chip farbe={LEUCHT.gut}>fertig</Chip>}
              <span aria-hidden>{offen === a.schluessel ? '–' : '+'}</span>
            </button>
            {offen === a.schluessel && (
              <div style={{ display: 'grid', gap: 14, padding: '8px 0 4px' }}>
                {a.fragen.map(q => <FrageFeld key={q.id} q={q} aus={aus} wert={werte[q.id] ?? ''} setWert={v => setWerte(w => ({ ...w, [q.id]: v }))} />)}
                {!aus && speichernAn && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Knopf leise aus={laeuft} onClick={() => speichern(a)}>Speichern</Knopf>
                    <Knopf aus={laeuft} onClick={() => speichern(a, !a.fertig)}>{a.fertig ? 'Wieder öffnen' : 'Abschnitt fertig'}</Knopf>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis></div>}
    </Karte>
  );
}

function UploadKarte({ upload, aus, aktionen }: { upload: NonNullable<KundenSicht['upload']>; aus: boolean; aktionen?: KundenAktionen }) {
  const [datei, setDatei] = useState<File | null>(null);
  const [zweck, setZweck] = useState<'playbook' | 'register' | 'sonstig'>('sonstig');
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const senden = async () => {
    if (!datei || !aktionen) return;
    setLaeuft(true);
    const r = await aktionen.upload(datei, zweck);
    setLaeuft(false);
    setMeldung(r.ok ? { art: 'gut', text: 'Danke — die Datei ist sicher bei uns eingegangen.' } : { art: 'kritisch', text: r.fehler ?? 'Nicht hochgeladen.' });
    if (r.ok) setDatei(null);
  };
  return (
    <Karte>
      <Ueberschrift>Unterlagen</Ueberschrift>
      <div style={klein}>
        {upload.eingegangen ? `${upload.eingegangen} ${upload.eingegangen === 1 ? 'Datei' : 'Dateien'} eingegangen. ` : ''}
        Erlaubt: {KUNDE_TYPEN_TEXT}, je Datei bis 25 MB. Wir öffnen eure Dateien nur zum Lesen; Fotos speichern wir ohne Ortsangaben.
      </div>
      {upload.erlaubt ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <input type="file" accept={KUNDE_ANNEHMEN} disabled={aus} onChange={e => setDatei(e.target.files?.[0] ?? null)} style={{ ...eingabe, padding: 10 }} aria-label="Datei wählen" />
          <select value={zweck} disabled={aus} onChange={e => setZweck(e.target.value as typeof zweck)} style={{ ...eingabe, colorScheme: 'dark' }} aria-label="Was ist das?">
            <option value="sonstig">Unterlage zum Projekt</option>
            <option value="playbook">Zum Playbook</option>
            <option value="register">Registerauszug</option>
          </select>
          {!aus && <Knopf haupt voll aus={!datei || laeuft} onClick={senden}>{laeuft ? 'Wird hochgeladen …' : 'Hochladen'}</Knopf>}
        </div>
      ) : <div style={{ marginTop: 8 }}><Leer>Über diesen Link sind schon so viele Dateien eingegangen, wie er annimmt — bitte schickt weitere über eure Ansprechperson.</Leer></div>}
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis></div>}
    </Karte>
  );
}

function PulsKarte({ offen, aus, aktionen, firma }: { offen: boolean; aus: boolean; aktionen?: KundenAktionen; firma: string }) {
  const [wert, setWert] = useState<number | null>(null);
  const [satz, setSatz] = useState('');
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  if (!offen || fertig) return <Karte ton={LEUCHT.gut}><Ueberschrift>Danke!</Ueberschrift><div style={text}>{fertig ? 'Eure Rückmeldung ist angekommen.' : 'Gerade ist keine Rückfrage offen.'}</div></Karte>;
  const senden = async () => {
    if (wert === null || !aktionen) return;
    setLaeuft(true);
    const r = await aktionen.puls(wert, satz);
    setLaeuft(false);
    if (r.ok) setFertig(true); else setFehler(r.fehler ?? 'Nicht gesendet.');
  };
  return (
    <Karte>
      <Ueberschrift>Eine kurze Frage</Ueberschrift>
      <div style={text}>Wie zufrieden seid ihr bei {firma} gerade mit unserer Zusammenarbeit? 0 = gar nicht, 10 = sehr.</div>
      <div role="radiogroup" aria-label="Zufriedenheit von 0 bis 10" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 6, marginTop: 10 }}>
        {Array.from({ length: 11 }, (_, i) => (
          <button key={i} type="button" role="radio" aria-checked={wert === i} disabled={aus} onClick={() => setWert(i)}
            style={{ minHeight: 44, borderRadius: 12, fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 700, cursor: aus ? 'default' : 'pointer', color: wert === i ? C.grund : C.ink, background: wert === i ? C.aktiv : 'rgba(255,255,255,.05)', border: `1px solid ${wert === i ? C.aktiv : C.linie}` }}>{i}</button>
        ))}
      </div>
      <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
        <span style={klein}>Ein Satz dazu (freiwillig)</span>
        <textarea rows={2} maxLength={500} value={satz} disabled={aus} onChange={e => setSatz(e.target.value)} style={{ ...eingabe, minHeight: 72, resize: 'vertical' }} />
      </label>
      {fehler && <div style={{ marginTop: 10 }}><Hinweis art="kritisch">{fehler}</Hinweis></div>}
      {!aus && <div style={{ marginTop: 12 }}><Knopf haupt voll aus={wert === null || laeuft} onClick={senden}>Senden</Knopf></div>}
    </Karte>
  );
}

function Datenschutz({ sicht }: { sicht: KundenSicht }) {
  const d = sicht.datenschutz;
  return (
    <Karte flach>
      <Ueberschrift>Datenschutz</Ueberschrift>
      <div style={{ display: 'grid', gap: 8, ...klein }}>
        <div><b style={{ color: C.ink }}>Verantwortlich:</b> {d.verantwortlich}</div>
        {d.absaetze.map((a, i) => <p key={i} style={{ margin: 0 }}>{a}</p>)}
        {d.seite && /^https:\/\//.test(d.seite) && <a href={d.seite} rel="noopener noreferrer nofollow" target="_blank" style={{ color: C.aktiv, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Ausführlicher Datenschutzhinweis ›</a>}
        <div style={{ color: C.inkLeise }}>Fassung {d.fassung}</div>
      </div>
    </Karte>
  );
}
