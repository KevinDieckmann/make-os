'use client';

// ─── Innovations-Check — die Strecke im Browser (24.10., Branch `innovations-check`) ─────────────────────────────
// Ein Gespräch mit Zoe (feste Texte, Kennzeichnung „KI-Assistentin“ dauerhaft im Kopf): Frage 1 ist ein Klick, eine Frage je
// Bildschirm, Klick springt weiter, „Zurück“ und „ändern“ jederzeit, Fortschritt „n von 15“. Nach dem Kurzcheck die Kontaktdaten
// (überspringbar — das Kurzergebnis bleibt frei sichtbar), dann die Wahl, auf Wunsch die Vertiefung, am Ende das Ergebnis mit
// hochzählender Zahl, Stufen-Skala und Netzdiagramm und direkt darunter der Weg ins 90-Tage-Umsetzungsgespräch.
// Welche Frage als nächste kommt, sagt NUR der Server (`schritt`); Zahlen kommen NUR vom Server. Die Sitzung entsteht mit dem
// ersten Klick; Kennung + Token liegen im Speicher des Browsers (Weitermachen nach dem Neuladen), nie in der Adresse.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import s from './check.module.css';
import { Netzdiagramm } from './Netzdiagramm';
import type { OeffentlicherKatalog, OeffentlicheFrage } from '@/lib/check/oeffentlich';
import type { Schritt } from '@/lib/check/ablauf';
import type { ErgebnisAnsicht } from '@/lib/check/ergebnis';

interface Antwort { optionIds?: string[]; freitext?: string; zusatz?: boolean; optionText?: string }
interface Strom {
  schritt: Schritt;
  fortschritt: { kurz: number; kurzVon: number; prozent: number };
  antworten: Record<string, Antwort>;
  uebersprungen: string[];
  kontakt: 'offen' | 'erfasst' | 'uebersprungen';
  vorname?: string;
  wahl?: 'ergebnis' | 'mehr';
}
interface Props {
  marke: string;
  katalog: OeffentlicherKatalog;
  zoe: { begruessung: string[]; kontakt: string[]; wahl: string; gespraech: string };
  hinweis: { zeilen: string[]; link: string | null; fassung: string };
  stufen: { stufe: number; name: string }[];
  quelle?: string;
}
interface Sitzung { id: string; token: string }

const SPEICHER = 'make-check:innovations-check';
const FREITEXT_MAX = 2000;
const QUITTUNG = ['Danke.', 'Notiert.', 'Gut zu wissen.', 'Verstanden.', 'Alles klar.'];

function sitzungLesen(): Sitzung | null {
  try { const r = localStorage.getItem(SPEICHER); const v = r ? JSON.parse(r) as Sitzung : null; return v && typeof v.id === 'string' && typeof v.token === 'string' ? v : null; } catch { return null; }
}
function sitzungMerken(x: Sitzung | null) {
  try { if (x) localStorage.setItem(SPEICHER, JSON.stringify(x)); else localStorage.removeItem(SPEICHER); } catch { /* ohne Speicher: Weitermachen nach dem Neuladen geht dann nicht */ }
}
async function rufe(body: Record<string, unknown>): Promise<{ status: number; d: Record<string, unknown> }> {
  try {
    const r = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    return { status: r.status, d: await r.json().catch(() => ({})) };
  } catch { return { status: 0, d: { fehler: 'Keine Verbindung — bitte gleich noch einmal.' } }; }
}
const bewegungAus = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Zählt einmal von 0 auf den Wert hoch (~1,5 s) — sofort der Wert bei „Bewegung reduzieren“. */
function useHochzaehlen(ziel: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (bewegungAus()) { setN(ziel); return; }
    let rahmen = 0; const start = performance.now();
    const schritt = (t: number) => { const p = Math.min(1, (t - start) / 1500); setN(Math.round(ziel * (1 - Math.pow(1 - p, 3)))); if (p < 1) rahmen = requestAnimationFrame(schritt); };
    rahmen = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(rahmen);
  }, [ziel]);
  return n;
}

export function InnovationsCheck({ marke, katalog, zoe, hinweis, stufen, quelle }: Props) {
  const fragen = useMemo(() => new Map(katalog.fragen.map(f => [f.id, f])), [katalog]);
  const kurz = useMemo(() => katalog.fragen.filter(f => f.kurz), [katalog]);
  const [sitzung, setSitzung] = useState<Sitzung | null>(null);
  const [strom, setStrom] = useState<Strom | null>(null);
  const [ansicht, setAnsicht] = useState<ErgebnisAnsicht | null>(null);
  const [gespraech, setGespraech] = useState<{ satz: string; pfad?: string } | null>(null);
  const [bearbeite, setBearbeite] = useState<string | null>(null);
  const [kontaktFuerTermin, setKontaktFuerTermin] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState('');
  const [bereit, setBereit] = useState(false);
  const ende = useRef<HTMLDivElement>(null);

  // Weitermachen nach dem Neuladen: gemerkte Sitzung fragen — weg (abgelaufen, gelöscht) → frisch beginnen.
  useEffect(() => {
    const alt = sitzungLesen();
    if (!alt) { setBereit(true); return; }
    void rufe({ aktion: 'stand', sitzung: alt.id, token: alt.token }).then(({ status, d }) => {
      if (status === 200 && d.ok) { setSitzung(alt); setStrom(d as unknown as Strom); } else sitzungMerken(null);
      setBereit(true);
    });
  }, []);

  // Das Ergebnis holen, sobald der Server sagt „Ergebnis“ (und es noch nicht da ist) — einmal je neuem Stand, nie in einer Schleife.
  const ergebnisFuer = useRef<Strom | null>(null);
  useEffect(() => {
    if (!sitzung || !strom || strom.schritt.art !== 'ergebnis' || ansicht || ergebnisFuer.current === strom) return;
    ergebnisFuer.current = strom;
    setLaedt(true);
    void rufe({ aktion: 'ergebnis', sitzung: sitzung.id, token: sitzung.token }).then(({ d }) => {
      setLaedt(false);
      if (d.ok) { const neu = d as unknown as Strom; ergebnisFuer.current = neu; setAnsicht(d.ansicht as ErgebnisAnsicht); setGespraech(d.gespraech as { satz: string; pfad?: string }); setStrom(neu); }
      else setFehler(String(d.fehler ?? 'Das Ergebnis ließ sich gerade nicht laden.'));
    });
  }, [sitzung, strom, ansicht]);

  // Neuer Schritt → sanft dorthin scrollen.
  useEffect(() => { ende.current?.scrollIntoView({ behavior: bewegungAus() ? 'auto' : 'smooth', block: 'end' }); }, [strom?.schritt, bearbeite, ansicht, kontaktFuerTermin]);

  /** Eine Aktion mit Sitzung — die Sitzung entsteht beim ersten Mal. */
  const sende = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    setFehler(''); setLaedt(true);
    let x = sitzung;
    if (!x) {
      const st = await rufe({ aktion: 'start', vorlage: katalog.vorlage, ...(quelle ? { quelle } : {}), webseite: '' });
      if (!st.d.ok) { setLaedt(false); setFehler(String(st.d.fehler ?? 'Der Check ließ sich gerade nicht starten.')); return false; }
      x = { id: String(st.d.sitzung), token: String(st.d.token) };
      setSitzung(x); sitzungMerken(x);
    }
    const r = await rufe({ ...body, sitzung: x.id, token: x.token });
    setLaedt(false);
    if (r.status === 404) { sitzungMerken(null); setSitzung(null); setStrom(null); setFehler(String(r.d.fehler ?? 'Die Sitzung ist abgelaufen — bitte neu starten.')); return false; }
    if (!r.d.ok) { setFehler(String(r.d.fehler ?? 'Das hat nicht geklappt.')); return false; }
    setStrom(r.d as unknown as Strom);
    return true;
  }, [sitzung, katalog.vorlage, quelle]);

  const beantworten = async (f: OeffentlicheFrage, a: Antwort) => {
    if (await sende({ aktion: 'antwort', frage: f.id, ...a })) { setBearbeite(null); setAnsicht(null); }
  };
  const ueberspringen = async (f: OeffentlicheFrage) => { if (await sende({ aktion: 'ueberspringen', frage: f.id })) { setBearbeite(null); setAnsicht(null); } };

  // Der Verlauf: beantwortete Fragen in der Reihenfolge der Strecke (Kurzcheck zuerst, dann der Rest in Katalog-Reihenfolge).
  const erledigt = useMemo(() => {
    if (!strom) return [] as string[];
    // Die Rolle (A5) kommt mit dem Kontaktformular — im Verlauf steht sie dann nicht noch einmal als eigene Frage.
    const da = (id: string) => (!!strom.antworten[id] || strom.uebersprungen.includes(id)) && !(id === 'A5' && strom.kontakt === 'erfasst');
    return [...kurz.map(f => f.id), ...katalog.fragen.filter(f => !f.kurz).map(f => f.id)].filter(da);
  }, [strom, kurz, katalog.fragen]);

  const aktuell: Schritt = strom?.schritt ?? { art: 'frage', frageId: kurz[0]?.id ?? '', phase: 'kurzcheck', nummer: 1, von: kurz.length };
  const imKurz = !strom || aktuell.art === 'frage' && aktuell.phase === 'kurzcheck';
  const kurzGeschafft = !!strom && (aktuell.art === 'kontakt' || aktuell.art === 'wahl');
  const fort = strom?.fortschritt ?? { kurz: 0, kurzVon: kurz.length, prozent: 0 };
  const aenderbar = (id: string) => !!fragen.get(id)?.kurz || strom?.wahl === 'mehr';
  const vorige = (id: string | null): string | null => {
    const i = id ? erledigt.indexOf(id) : erledigt.length;
    return i > 0 ? erledigt[i - 1] : null;
  };

  if (!bereit) return <main className={s.seite}><div className={s.rahmen} /></main>;

  return (
    <main className={s.seite}>
      <div className={s.rahmen}>
        <header className={s.kopf}>
          <div className={s.kopfZeile}>
            <span className={s.marke}>{marke}</span>
            <span className={s.titel}>Innovations-Check</span>
          </div>
          <div className={s.balken} aria-hidden><div className={s.balkenFuell} style={{ width: `${kurzGeschafft || ansicht ? 100 : imKurz ? Math.round((fort.kurz / Math.max(1, fort.kurzVon)) * 100) : fort.prozent}%` }} /></div>
          <div className={s.stand} aria-live="polite">
            {ansicht ? 'Ihr Ergebnis' : kurzGeschafft ? 'Kurzcheck geschafft' : imKurz ? `Frage ${Math.min(fort.kurz + 1, fort.kurzVon)} von ${fort.kurzVon} · noch etwa ${Math.max(1, Math.round((fort.kurzVon - fort.kurz) * 0.6))} Min.` : `${fort.prozent} % geschafft`}
            {' · '}<span className={s.kiMarke}>Zoe · KI-Assistentin</span>
          </div>
        </header>

        {!strom && (
          <section className={s.einstieg}>
            <h1 className={s.einstiegTitel}>Wie innovativ ist Ihr Unternehmen wirklich?</h1>
            <p className={s.einstiegText}>Spielt Ihr Team nur mit KI, oder nutzen Sie KI und Automatisierung wirklich im Alltag? Der Check zeigt Ihnen, wo Sie im Vergleich zu Ihrer Branche stehen.</p>
            <ul className={s.versprechen}><li>kostenlos</li><li>rund 10 Minuten</li><li>Ergebnis sofort</li><li>Antworten per Klick</li></ul>
          </section>
        )}

        <div className={s.verlauf} aria-live="polite">
          <Zoe zeilen={zoe.begruessung} />
          {erledigt.map((id, i) => {
            const f = fragen.get(id);
            if (!f) return null;
            const vorher = i > 0 ? fragen.get(erledigt[i - 1]) : undefined;
            return (
              <div key={id} style={{ display: 'contents' }}>
                <Zoe zeilen={[...(vorher?.abschnitt !== f.abschnitt && katalog.abschnittSatz[f.abschnitt] && i > 0 ? [katalog.abschnittSatz[f.abschnitt]] : []), f.text]} leise />
                <div className={s.ichZeile}>
                  <div className={s.ich}>{antwortText(f, strom?.antworten[id], strom?.uebersprungen.includes(id))}</div>
                  {aenderbar(id) && !ansicht && <button type="button" className={s.aendern} onClick={() => setBearbeite(id)}>ändern</button>}
                </div>
                {i === kurz.length - 1 && strom && strom.kontakt !== 'offen' && (
                  <div className={s.ichZeile}><div className={s.ich}>{strom.kontakt === 'erfasst' ? `Bericht an mich, ${strom.vorname ?? ''}`.trim() : 'Ohne Bericht weiter'}</div></div>
                )}
              </div>
            );
          })}

          {bearbeite && fragen.get(bearbeite) ? (
            <FrageKarte key={`b-${bearbeite}`} f={fragen.get(bearbeite)!} satz={katalog.abschnittSatz[fragen.get(bearbeite)!.abschnitt]} a={strom?.antworten[bearbeite]} laedt={laedt}
              ueberspringbar={fragen.get(bearbeite)!.typ === 'beleg' || fragen.get(bearbeite)!.typ === 'offen' || !fragen.get(bearbeite)!.kurz}
              zurueck={vorige(bearbeite) ? () => setBearbeite(vorige(bearbeite)) : undefined} abbrechen={() => setBearbeite(null)}
              antworten={a => beantworten(fragen.get(bearbeite)!, a)} ueberspringen={() => ueberspringen(fragen.get(bearbeite)!)} />
          ) : aktuell.art === 'frage' && fragen.get(aktuell.frageId) ? (
            <FrageKarte key={aktuell.frageId} f={fragen.get(aktuell.frageId)!} laedt={laedt}
              satz={(() => { const f = fragen.get(aktuell.frageId)!; const letzte = erledigt.length ? fragen.get(erledigt[erledigt.length - 1]) : undefined; return letzte && letzte.abschnitt !== f.abschnitt ? katalog.abschnittSatz[f.abschnitt] : letzte ? QUITTUNG[erledigt.length % QUITTUNG.length] : undefined; })()}
              a={strom?.antworten[aktuell.frageId]} ueberspringbar={aktuell.phase !== 'kurzcheck' || fragen.get(aktuell.frageId)!.typ === 'beleg' || fragen.get(aktuell.frageId)!.typ === 'offen'}
              zurueck={vorige(null) && aenderbar(vorige(null)!) ? () => setBearbeite(vorige(null)) : undefined}
              ergebnisZeigen={aktuell.phase !== 'kurzcheck' ? () => void sende({ aktion: 'wahl', wahl: 'ergebnis' }) : undefined}
              antworten={a => beantworten(fragen.get(aktuell.frageId)!, a)} ueberspringen={() => ueberspringen(fragen.get(aktuell.frageId)!)} />
          ) : aktuell.art === 'kontakt' ? (
            <>
              <Zoe zeilen={zoe.kontakt} />
              <KontaktKarte rollen={fragen.get('A5')?.optionen ?? []} laedt={laedt}
                senden={k => sende({ aktion: 'kontakt', ...k })} ohne={() => void sende({ aktion: 'ohne-kontakt' })} />
            </>
          ) : aktuell.art === 'wahl' ? (
            <>
              <Zoe zeilen={[zoe.wahl]} />
              <div className={`${s.karte} ${s.neu}`}>
                <div className={s.zeile} style={{ marginTop: 0 }}>
                  <button type="button" className={s.knopf} disabled={laedt} onClick={() => void sende({ aktion: 'wahl', wahl: 'ergebnis' })}>Ergebnis jetzt sehen</button>
                  <button type="button" className={s.zweit} disabled={laedt} onClick={() => void sende({ aktion: 'wahl', wahl: 'mehr' })}>Noch ein paar Fragen mehr</button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {ansicht && !bearbeite && (
          <ErgebnisKarte ansicht={ansicht} stufen={stufen} gespraech={gespraech} kontaktDa={strom?.kontakt === 'erfasst'} laedt={laedt}
            mehr={() => { setAnsicht(null); void sende({ aktion: 'wahl', wahl: 'mehr' }); }}
            termin={() => setKontaktFuerTermin(true)} />
        )}
        {ansicht && kontaktFuerTermin && strom?.kontakt !== 'erfasst' && (
          <div style={{ marginTop: 12 }}>
            <Zoe zeilen={['Damit Sie den Termin buchen können und Ihren Bericht bekommen, brauche ich noch kurz Ihre Angaben.']} />
            <KontaktKarte rollen={fragen.get('A5')?.optionen ?? []} laedt={laedt} ohneText="Doch nicht"
              senden={async k => { const ok = await sende({ aktion: 'kontakt', ...k }); if (ok) { setKontaktFuerTermin(false); setAnsicht(null); } return ok; }} ohne={() => setKontaktFuerTermin(false)} />
          </div>
        )}

        {laedt && aktuell.art === 'ergebnis' && !ansicht && <Zoe zeilen={['Ich rechne Ihr Ergebnis aus …']} />}
        {fehler && <p className={s.fehler} role="alert">{fehler}</p>}
        <div ref={ende} />

        <details className={s.datenschutz} open={!strom}>
          <summary>Datenschutz in Kürze</summary>
          {hinweis.zeilen.map((z, i) => <p key={i}>{z}</p>)}
          {hinweis.link && <p><a className={s.link} href={hinweis.link} target="_blank" rel="noopener noreferrer">Datenschutzerklärung</a></p>}
        </details>
      </div>
    </main>
  );
}

function antwortText(f: OeffentlicheFrage, a: Antwort | undefined, uebersprungen?: boolean): string {
  if (uebersprungen && !a) return 'übersprungen';
  if (!a) return '';
  if (a.freitext) return a.freitext;
  const texte = (a.optionIds ?? []).map(id => f.optionen?.find(o => o.id === id)?.text ?? '').filter(Boolean);
  const t = texte.join(', ') + (a.optionText ? `: ${a.optionText}` : '');
  return a.zusatz === true ? `${t} · Start-up` : t;
}

function Zoe({ zeilen, leise }: { zeilen: readonly string[]; leise?: boolean }) {
  if (!zeilen.length) return null;
  return (
    <div className={`${s.zoeZeile} ${leise ? '' : s.neu}`}>
      <span className={`${s.zoe} ${leise ? '' : s.zoeAtmet}`} aria-hidden />
      <div className={s.blase}>
        {zeilen.map((z, i) => <p key={i} className={leise && i < zeilen.length - 1 ? s.blaseLeise : undefined}>{z}</p>)}
      </div>
    </div>
  );
}

function FrageKarte({ f, satz, a, laedt, ueberspringbar, zurueck, abbrechen, ergebnisZeigen, antworten, ueberspringen }: {
  f: OeffentlicheFrage; satz?: string; a?: Antwort; laedt: boolean; ueberspringbar: boolean;
  zurueck?: () => void; abbrechen?: () => void; ergebnisZeigen?: () => void;
  antworten: (a: Antwort) => void; ueberspringen: () => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<string[]>(a?.optionIds ?? []);
  const [text, setText] = useState(a?.freitext ?? '');
  const [optionText, setOptionText] = useState(a?.optionText ?? '');
  const [zusatz, setZusatz] = useState(a?.zusatz ?? false);
  const freiOption = f.optionen?.find(o => o.freitext);
  const sonstigeOffen = !!freiOption && gewaehlt[0] === freiOption.id;

  const klick = (id: string) => {
    if (f.typ === 'mehrfach') {
      const o = f.optionen?.find(x => x.id === id);
      setGewaehlt(g => (g.includes(id) ? g.filter(x => x !== id) : o?.exklusiv ? [id] : [...g.filter(x => !f.optionen?.find(y => y.id === x)?.exklusiv), id]));
      return;
    }
    if (freiOption && id === freiOption.id) { setGewaehlt([id]); return; }
    antworten({ optionIds: [id], ...(f.zusatz ? { zusatz } : {}) });
  };

  return (
    <>
      <Zoe zeilen={[...(satz ? [satz] : []), f.text]} />
      <div className={`${s.karte} ${s.neu2}`}>
        {f.zusatz && (
          <div className={s.haken} style={{ marginTop: 0, marginBottom: 10, alignItems: 'center' }}>
            <span>{f.zusatz.text}</span>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={zusatz} onChange={e => setZusatz(e.target.checked)} />Ja</label>
          </div>
        )}
        {f.hilfe && <p className={s.hilfe}>{f.hilfe}</p>}
        {(f.typ === 'einfach' || f.typ === 'mehrfach') && (
          <div className={`${s.optionen} ${(f.optionen?.length ?? 0) > 6 ? s.zweiSpalten : ''}`} role={f.typ === 'mehrfach' ? 'group' : 'radiogroup'} aria-label={f.text}>
            {f.optionen?.map(o => (
              <button key={o.id} type="button" className={`${s.option} ${gewaehlt.includes(o.id) ? s.optionGewaehlt : ''}`} disabled={laedt}
                aria-pressed={gewaehlt.includes(o.id)} onClick={() => klick(o.id)}>{o.text}</button>
            ))}
          </div>
        )}
        {sonstigeOffen && (
          <div style={{ marginTop: 10 }}>
            <input className={s.eingabe} value={optionText} onChange={e => setOptionText(e.target.value)} maxLength={120} placeholder="Welche Branche?" aria-label="Welche Branche?" />
          </div>
        )}
        {(f.typ === 'beleg' || f.typ === 'offen') && (
          <>
            {!!f.bausteine?.length && (
              <div className={s.chips}>
                {f.bausteine.map(b => <button key={b} type="button" className={s.chip} onClick={() => setText(t => (t.trim() ? `${t.trim()} ${b}` : b))}>{b.replace(/: $/, ' …')}</button>)}
              </div>
            )}
            <textarea className={s.textfeld} value={text} onChange={e => setText(e.target.value)} maxLength={FREITEXT_MAX} aria-label={f.text} placeholder="Ein, zwei Sätze reichen." />
            <div className={s.zaehler}>{text.length} / {FREITEXT_MAX}</div>
          </>
        )}
        <div className={s.zeile}>
          {(f.typ === 'mehrfach' || sonstigeOffen) && (
            <button type="button" className={s.knopf} disabled={laedt || !gewaehlt.length} onClick={() => antworten({ optionIds: gewaehlt, ...(sonstigeOffen && optionText.trim() ? { optionText: optionText.trim() } : {}), ...(f.zusatz ? { zusatz } : {}) })}>Weiter</button>
          )}
          {(f.typ === 'beleg' || f.typ === 'offen') && (
            <button type="button" className={s.knopf} disabled={laedt || !text.trim()} onClick={() => antworten({ freitext: text.trim() })}>Weiter</button>
          )}
          {ueberspringbar && <button type="button" className={s.leiseKnopf} disabled={laedt} onClick={ueberspringen}>Überspringen</button>}
          {zurueck && <button type="button" className={s.leiseKnopf} disabled={laedt} onClick={zurueck}>Zurück</button>}
          {abbrechen && <button type="button" className={s.leiseKnopf} disabled={laedt} onClick={abbrechen}>Abbrechen</button>}
          {ergebnisZeigen && <button type="button" className={s.zweit} disabled={laedt} onClick={ergebnisZeigen}>Ergebnis zeigen</button>}
        </div>
      </div>
    </>
  );
}

function KontaktKarte({ rollen, laedt, senden, ohne, ohneText }: {
  rollen: NonNullable<OeffentlicheFrage['optionen']>; laedt: boolean; ohneText?: string;
  senden: (k: Record<string, unknown>) => Promise<boolean>; ohne: () => void;
}) {
  const [vorname, setVorname] = useState('');
  const [email, setEmail] = useState('');
  const [firma, setFirma] = useState('');
  const [rolle, setRolle] = useState('');
  const [telefon, setTelefon] = useState('');
  const [newsletter, setNewsletter] = useState(false);
  const [falle, setFalle] = useState('');
  const fertig = vorname.trim() && /.+@.+\..+/.test(email.trim()) && firma.trim() && rolle;
  return (
    <form className={`${s.karte} ${s.neu2}`} onSubmit={async e => {
      e.preventDefault();
      if (!fertig) return;
      const ok = await senden({ vorname: vorname.trim(), email: email.trim(), firma: firma.trim(), rolle, ...(telefon.trim() ? { telefon: telefon.trim() } : {}), newsletter, webseite: falle });
      // Für die Buchungsseite einmal vorbelegen (nur dieser Browser-Tab, nie in der Adresse; die Seite löscht es beim Lesen).
      if (ok) try { sessionStorage.setItem('make-check-vorbelegung', JSON.stringify({ name: vorname.trim(), email: email.trim(), firma: firma.trim() })); } catch { /* ohne Speicher: leere Felder */ }
    }}>
      <div className={s.felder}>
        <label><span className={s.feldName}>Vorname</span><input className={s.eingabe} value={vorname} onChange={e => setVorname(e.target.value)} maxLength={60} autoComplete="given-name" required /></label>
        <label><span className={s.feldName}>E-Mail</span><input className={s.eingabe} type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={200} autoComplete="email" required /></label>
        <label><span className={s.feldName}>Firma</span><input className={s.eingabe} value={firma} onChange={e => setFirma(e.target.value)} maxLength={120} autoComplete="organization" required /></label>
        <div>
          <span className={s.feldName}>Ihre Rolle</span>
          <div className={s.chips} role="radiogroup" aria-label="Ihre Rolle">
            {rollen.map(o => <button key={o.id} type="button" className={`${s.chip} ${rolle === o.id ? s.optionGewaehlt : ''}`} aria-pressed={rolle === o.id} onClick={() => setRolle(o.id)}>{o.text}</button>)}
          </div>
        </div>
        <label><span className={s.feldName}>Telefon (freiwillig)</span><input className={s.eingabe} type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} maxLength={40} autoComplete="tel" /></label>
      </div>
      <div className={s.falle} aria-hidden><label>Webseite<input tabIndex={-1} autoComplete="off" value={falle} onChange={e => setFalle(e.target.value)} name="webseite" /></label></div>
      <label className={s.haken}><input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)} /><span>Ich möchte den Newsletter (alle paar Wochen, jederzeit abbestellbar). Er kommt erst nach Ihrer Bestätigung per E-Mail.</span></label>
      <p className={s.hilfe} style={{ marginTop: 10 }}>Ihre Angaben nutzen wir für Ihren Bericht und Ihr Gespräch. Mehr im Datenschutzhinweis unten.</p>
      <div className={s.zeile}>
        <button type="submit" className={s.knopf} disabled={laedt || !fertig}>Bericht anfordern</button>
        <button type="button" className={s.leiseKnopf} disabled={laedt} onClick={ohne}>{ohneText ?? 'Ohne Bericht zum Ergebnis'}</button>
      </div>
    </form>
  );
}

function ErgebnisKarte({ ansicht, stufen, gespraech, kontaktDa, laedt, mehr, termin }: {
  ansicht: ErgebnisAnsicht; stufen: Props['stufen']; gespraech: { satz: string; pfad?: string } | null; kontaktDa: boolean; laedt: boolean;
  mehr: () => void; termin: () => void;
}) {
  const zahl = useHochzaehlen(ansicht.gesamt);
  return (
    <section className={`${s.ergebnis} ${s.neu}`} aria-labelledby="ergebnis-titel">
      <div className={s.zahlZeile}>
        <span className={s.grosseZahl} aria-hidden>{zahl}</span><span className={s.vonHundert}>von 100</span>
      </div>
      <h2 id="ergebnis-titel" className={s.stufeName}>Stufe {ansicht.stufe}: {ansicht.stufeName}</h2>
      <p className={s.stufeKurz}>{ansicht.stufeKurz}</p>
      <div className={s.skala} aria-hidden>{stufen.map(x => <span key={x.stufe} className={`${s.skalaTeil} ${x.stufe <= ansicht.stufe ? s.skalaAn : ''}`} />)}</div>
      <div className={s.skalaNamen} aria-hidden>{stufen.map(x => <span key={x.stufe} className={x.stufe === ansicht.stufe ? s.skalaNameAn : undefined}><span className={s.skalaNr}>{x.stufe}</span><span className={s.skalaWort}>{x.name.replace(/ \(.*\)$/, '')}</span></span>)}</div>
      <Netzdiagramm achsen={ansicht.achsen} />
      {ansicht.branchenSatz && <p className={s.branchenSatz}>{ansicht.branchenSatz}</p>}
      <div style={{ marginTop: 14 }}><Zoe zeilen={ansicht.zoe} /></div>
      {ansicht.genauigkeit === 'vorlaeufig' && (
        <div className={s.vorlaeufig}>
          Weiter, wo Sie aufgehört haben — Ihre Antworten bleiben gespeichert.
          <div className={s.zeile}><button type="button" className={s.zweit} disabled={laedt} onClick={mehr}>Weitere Fragen beantworten</button></div>
        </div>
      )}
      {gespraech && (
        <div className={s.gespraech}>
          <p className={s.gespraechTitel}>Kostenloses 90-Tage-Umsetzungsgespräch</p>
          <p className={s.hilfe}>{gespraech.satz}</p>
          {kontaktDa ? (
            gespraech.pfad
              ? <Link className={s.knopf} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={gespraech.pfad}>Gespräch buchen</Link>
              : <p className={s.hilfe}>Wir melden uns bei Ihnen für einen Termin.</p>
          ) : (
            <button type="button" className={s.knopf} onClick={termin}>Gespräch buchen</button>
          )}
          {kontaktDa && <p className={s.hilfe} style={{ marginTop: 10 }}>Ihr Bericht kommt per E-Mail.</p>}
        </div>
      )}
    </section>
  );
}
