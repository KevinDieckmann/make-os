'use client';

// ─── Innovations-Check — die Strecke im Browser (24.10., Branch `innovations-check`) ─────────────────────────────
// Ein Gespräch mit Zoe (feste Texte, Kennzeichnung „KI-Assistentin“ dauerhaft im Kopf): Frage 1 ist ein Klick, eine Frage je
// Bildschirm, Klick springt weiter, „Zurück“ und „ändern“ jederzeit, Fortschritt „n von 17“. Nach dem Kurzcheck die Kontaktdaten
// (überspringbar — das Kurzergebnis bleibt frei sichtbar), dann die Wahl, auf Wunsch die Vertiefung, am Ende das Ergebnis (30.10.,
// Kevin: „Ergebnis mit nächsten Schritten“, „Alle drei Säulen“, „Gestaltung und Texte“): Gesamtwert mit Stufe, die drei Säulen,
// zwei nächste Schritte mit dem passenden Angebot der Instanz, das Erstgespräch mit den nächsten freien Terminen, aufklappbar die
// Innovation im Detail (Stufe, Netzdiagramm, Branchenvergleich).
// Ausführlich (31.10., Kevin: „die größeren brauchen eine e-mail“): ohne Kontaktdaten schickt der Server nur die Vorschau (Zahl, Stufe, Skala,
// Namen der Bereiche) — die Seite zeigt darunter, was im vollständigen Bericht steht, und gleich das Formular; nach dem Absenden die volle Ansicht.
// Welche Frage als nächste kommt, sagt NUR der Server (`schritt`); Zahlen kommen NUR vom Server. Die Sitzung entsteht mit dem
// ersten Klick; Kennung + Token liegen im Speicher des Browsers (Weitermachen nach dem Neuladen), nie in der Adresse.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ZoeBegleiterin } from '@/components/oeffentlich/ZoeBegleiterin';
import Link from 'next/link';
import s from './check.module.css';
import { Netzdiagramm } from './Netzdiagramm';
import type { OeffentlicherKatalog, OeffentlicheFrage } from '@/lib/check/oeffentlich';
import type { Schritt } from '@/lib/check/ablauf';
import type { ErgebnisAnsicht, ErgebnisVorschau } from '@/lib/check/ergebnis';

interface Antwort { optionIds?: string[]; freitext?: string; zusatz?: boolean; optionText?: string; anmerkung?: string }
interface Strom {
  schritt: Schritt;
  fortschritt: { kurz: number; kurzVon: number; prozent: number };
  antworten: Record<string, Antwort>;
  uebersprungen: string[];
  kontakt: 'offen' | 'erfasst' | 'uebersprungen';
  vorname?: string;
  wahl?: 'ergebnis' | 'mehr';
  umfang?: 'kurz' | 'lang';
}
interface Props {
  marke: string;
  /** Texte der Seite aus der Vorlage (Einstieg, Bereiche, Dauer). */
  seite: { titel: string; text: string; bereiche?: { name: string; text: string }[]; minuten: number; minuten_lang?: number; umfang?: { frage: string; kurz: { name: string; text: string }; lang: { name: string; text: string } } };
  /** Die anderen Checks der Instanz (Name, Pfad, Bereiche) — in der Karte über dem Gespräch. */
  weitere?: { name: string; pfad: string; text: string }[];
  /** Leitsatz unter dem Namen (Einstellung der Instanz) — ohne Angabe keiner. */
  claim?: string;
  katalog: OeffentlicherKatalog;
  zoe: { begruessung: string[]; kontakt: string[]; kontaktLang?: string[]; wahl: string; gespraech: string };
  hinweis: { zeilen: string[]; link: string | null; fassung: string };
  /** Kopf wie auf der Website (30.10.): Logo, Link zur Website, Erstgespräch — alles aus den Einstellungen der Instanz, alles optional. */
  kopf?: { logo?: string; website?: string; erstgespraech?: string };
  /** Newsletter-Anmeldung der Instanz (30.10.) — nur wenn sie läuft; Wortlaut und Fassung der Einwilligung. Sonst kein Häkchen. */
  newsletter?: { wortlaut: string; fassung: string };
  quelle?: string;
  /** Zoe-Begleiterin unten rechts (31.10., Website-Anbau; feste Texte, components/oeffentlich/ZoeBegleiterin.tsx) — Gastgeber und Weg zum Kontaktformular. */
  begleiter?: { gastgeber: string; kontakt?: string | null };
}
type Angebot = { titel: string; text?: string; link?: string };
type Schritt2 = ErgebnisAnsicht['schritte'][number] & { angebot?: Angebot };
type Ansicht = Omit<ErgebnisAnsicht, 'schritte'> & { schritte: Schritt2[] };
type Gespraech = { satz: string; pfad?: string; slug?: string };
/** Ob der Bericht per Mail kommt — nur die eigene Adresse, maskiert (vom Server, nur mit erfasstem Kontakt). */
type Bericht = { perMail: boolean; an?: string };
interface Sitzung { id: string; token: string }

/** Gemerkte Sitzung je Check (30.10.: mehrere Checks auf derselben Seite — jeder hat seine eigene). */
const speicherVon = (vorlage: string) => `make-check:${vorlage}`;
const FREITEXT_MAX = 2000;
/** Eigene Antwort zu einer Auswahlfrage — wie ANMERKUNG_MAX in lib/check/ablauf.ts. */
const ANMERKUNG_MAX = 1000;
const QUITTUNG = ['Danke.', 'Notiert.', 'Gut zu wissen.', 'Verstanden.', 'Alles klar.'];

function sitzungLesen(vorlage: string): Sitzung | null {
  try { const r = localStorage.getItem(speicherVon(vorlage)); const v = r ? JSON.parse(r) as Sitzung : null; return v && typeof v.id === 'string' && typeof v.token === 'string' ? v : null; } catch { return null; }
}
function sitzungMerken(vorlage: string, x: Sitzung | null) {
  try { if (x) localStorage.setItem(speicherVon(vorlage), JSON.stringify(x)); else localStorage.removeItem(speicherVon(vorlage)); } catch { /* ohne Speicher: Weitermachen nach dem Neuladen geht dann nicht */ }
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

export function InnovationsCheck({ marke, claim, seite, katalog, zoe, hinweis, newsletter, kopf, quelle, weitere, begleiter }: Props) {
  const fragen = useMemo(() => new Map(katalog.fragen.map(f => [f.id, f])), [katalog]);
  const kurz = useMemo(() => katalog.fragen.filter(f => f.kurz), [katalog]);
  const [sitzung, setSitzung] = useState<Sitzung | null>(null);
  const [strom, setStrom] = useState<Strom | null>(null);
  const [ansicht, setAnsicht] = useState<Ansicht | ErgebnisVorschau | null>(null);
  const [gespraech, setGespraech] = useState<Gespraech | null>(null);
  const [bericht, setBericht] = useState<Bericht | null>(null);
  const [bearbeite, setBearbeite] = useState<string | null>(null);
  const [kontaktFuerTermin, setKontaktFuerTermin] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState('');
  const [bereit, setBereit] = useState(false);
  // Kurz oder ausführlich (30.10. abends) — vor dem Start gewählt, danach steht es an der Sitzung.
  const [umfangWahl, setUmfangWahl] = useState<'kurz' | 'lang' | null>(null);
  const umfang = strom?.umfang ?? umfangWahl;
  const mitWahl = !!seite.umfang;
  const ende = useRef<HTMLDivElement>(null);

  // Weitermachen nach dem Neuladen: gemerkte Sitzung fragen — weg (abgelaufen, gelöscht) → frisch beginnen.
  useEffect(() => {
    const alt = sitzungLesen(katalog.vorlage);
    if (!alt) { setBereit(true); return; }
    void rufe({ aktion: 'stand', sitzung: alt.id, token: alt.token }).then(({ status, d }) => {
      if (status === 200 && d.ok) { setSitzung(alt); setStrom(d as unknown as Strom); } else sitzungMerken(katalog.vorlage, null);
      setBereit(true);
    });
  }, [katalog.vorlage]);

  // Das Ergebnis holen, sobald der Server sagt „Ergebnis“ (und es noch nicht da ist) — einmal je neuem Stand, nie in einer Schleife.
  const ergebnisFuer = useRef<Strom | null>(null);
  useEffect(() => {
    if (!sitzung || !strom || strom.schritt.art !== 'ergebnis' || ansicht || ergebnisFuer.current === strom) return;
    ergebnisFuer.current = strom;
    setLaedt(true);
    void rufe({ aktion: 'ergebnis', sitzung: sitzung.id, token: sitzung.token }).then(({ d }) => {
      setLaedt(false);
      if (d.ok) { const neu = d as unknown as Strom; ergebnisFuer.current = neu; setAnsicht(d.ansicht as Ansicht | ErgebnisVorschau); setGespraech((d.gespraech as Gespraech | undefined) ?? null); setBericht((d.bericht as Bericht | undefined) ?? null); setStrom(neu); }
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
      const st = await rufe({ aktion: 'start', vorlage: katalog.vorlage, ...(quelle ? { quelle } : {}), ...(umfang ? { umfang } : {}), webseite: '' });
      if (!st.d.ok) { setLaedt(false); setFehler(String(st.d.fehler ?? 'Der Check ließ sich gerade nicht starten.')); return false; }
      x = { id: String(st.d.sitzung), token: String(st.d.token) };
      setSitzung(x); sitzungMerken(katalog.vorlage, x);
    }
    const r = await rufe({ ...body, sitzung: x.id, token: x.token });
    setLaedt(false);
    if (r.status === 404) { sitzungMerken(katalog.vorlage, null); setSitzung(null); setStrom(null); setFehler(String(r.d.fehler ?? 'Die Sitzung ist abgelaufen — bitte neu starten.')); return false; }
    if (!r.d.ok) { setFehler(String(r.d.fehler ?? 'Das hat nicht geklappt.')); return false; }
    setStrom(r.d as unknown as Strom);
    return true;
  }, [sitzung, katalog.vorlage, quelle, umfang]);

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
  const langFrage = umfang === 'lang' && aktuell.art === 'frage' && strom ? aktuell : null;
  const aenderbar = (id: string) => !!fragen.get(id)?.kurz || strom?.wahl === 'mehr' || strom?.umfang === 'lang';
  const vorige = (id: string | null): string | null => {
    const i = id ? erledigt.indexOf(id) : erledigt.length;
    return i > 0 ? erledigt[i - 1] : null;
  };

  if (!bereit) return <main className={s.seite}><div className={s.rahmen} /></main>;

  // Wortmarke wie auf der Website: erstes Wort groß, der Rest klein darunter („FOKUS / Innovation“) — aus dem Namen der Instanz.
  const [wort1, ...rest] = marke.split(' ');
  // Bewusst <img>: das Logo liegt meist auf der Website (z. B. /assets/…), nicht in der Anwendung — der Bild-Optimierer fände es dort nicht.
  // eslint-disable-next-line @next/next/no-img-element
  const wortbild = <>{kopf?.logo && <img className={s.logo} src={kopf.logo} alt="" width={34} height={34} />}<span className={s.wortbild}><b>{wort1}</b>{rest.length > 0 && <small>{rest.join(' ')}</small>}</span></>;
  return (
    <main className={s.seite}>
      <header className={s.kopf}>
        <div className={s.kopfInnen}>
          {kopf?.website ? <a className={s.markeLink} href={kopf.website} aria-label={`${marke}, zur Website`}>{wortbild}</a> : <span className={s.markeLink}>{wortbild}</span>}
          <span className={s.titel}>{katalog.name}</span>
          {kopf?.erstgespraech && <a className={s.kopfKnopf} href={kopf.erstgespraech}>Erstgespräch</a>}
        </div>
        <div className={s.kopfStand}>
          <div className={s.balken} aria-hidden><div className={s.balkenFuell} style={{ width: `${kurzGeschafft || ansicht ? 100 : langFrage ? Math.round(((langFrage.nummer - 1) / Math.max(1, langFrage.von)) * 100) : imKurz ? Math.round((fort.kurz / Math.max(1, fort.kurzVon)) * 100) : fort.prozent}%` }} /></div>
          <div className={s.stand} aria-live="polite">
            {/* Ausführlich: Fortschritt in Etappen („Daten und Systeme · Frage 23 von 48 · noch etwa 12 Min.“) statt Prozent (Recherche 30.10.). */}
            {ansicht ? 'Ihr Ergebnis' : kurzGeschafft ? 'Fragen geschafft' : mitWahl && !umfang ? 'Kurz oder ausführlich: Sie wählen' : langFrage ? `${katalog.abschnittName[fragen.get(langFrage.frageId)?.abschnitt ?? ''] ?? ''} · Frage ${langFrage.nummer} von ${langFrage.von} · noch etwa ${Math.max(1, Math.round(((langFrage.von - langFrage.nummer + 1) / Math.max(1, langFrage.von)) * (seite.minuten_lang ?? seite.minuten)))} Min.` : umfang === 'lang' && !strom ? `${katalog.abschnittName.A ?? ''} · Frage 1 · noch etwa ${seite.minuten_lang ?? seite.minuten} Min.` : imKurz ? `Frage ${Math.min(fort.kurz + 1, fort.kurzVon)} von ${fort.kurzVon} · noch etwa ${Math.max(1, Math.round(((fort.kurzVon - fort.kurz) / Math.max(1, fort.kurzVon)) * seite.minuten))} Min.` : `${fort.prozent} % geschafft`}
            {' · '}<span className={s.kiMarke}>Zoe · KI-Assistentin</span>
          </div>
        </div>
      </header>

      <div className={s.rahmen}>
        <div className={s.haupt}>
        {!strom && (
          <section className={s.einstieg}>
            <p className={s.vorzeile}>{katalog.name} · kostenlos · {mitWahl ? `kurz rund ${seite.minuten} oder ausführlich rund ${seite.minuten_lang ?? seite.minuten} Minuten` : `rund ${seite.minuten} Minuten`}</p>
            <h1 className={s.einstiegTitel}>{seite.titel}</h1>
            <p className={s.einstiegText}>{seite.text}</p>
            {/* Kompakt über dem Gespräch (31.10., Prüfung: die Wahl stand erst bei y ≈ 1.050): Bereiche als Leiste, die weiteren Checks am Ende. */}
            <div className={s.checkLeiste} aria-label="Der Check">
              {!!seite.bereiche?.length && <ul className={s.bereichChips} aria-label="Die Bereiche des Checks">{seite.bereiche.map(b => <li key={b.name}>{b.name}</li>)}</ul>}
              <ul className={s.versprechen}><li>kostenlos</li><li>{mitWahl ? `${seite.minuten} oder ${seite.minuten_lang ?? seite.minuten} Minuten` : `rund ${seite.minuten} Minuten`}</li><li>Ergebnis sofort</li><li>Antworten per Klick</li></ul>
            </div>
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
                {i === (umfang === 'lang' ? erledigt.length - 1 : kurz.length - 1) && strom && strom.kontakt !== 'offen' && (
                  <div className={s.ichZeile}><div className={s.ich}>{strom.kontakt === 'erfasst' ? `Bericht an mich, ${strom.vorname ?? ''}`.trim() : umfang === 'lang' ? 'Erst nur die Stufe' : 'Ohne Bericht weiter'}</div></div>
                )}
              </div>
            );
          })}

          {mitWahl && !umfang && !strom && seite.umfang ? (
            <>
              <Zoe zeilen={[seite.umfang.frage]} />
              <div className={`${s.karte} ${s.neu}`}>
                <div className={s.umfangWahl} role="group" aria-label={seite.umfang.frage}>
                  {(['kurz', 'lang'] as const).map(u => (
                    <button key={u} type="button" className={s.umfangKnopf} onClick={() => setUmfangWahl(u)}>
                      <span className={s.umfangKopf}><b>{seite.umfang![u].name}</b><span>rund {u === 'kurz' ? seite.minuten : seite.minuten_lang ?? seite.minuten} Minuten</span></span>
                      <span className={s.umfangText}>{seite.umfang![u].text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : bearbeite && fragen.get(bearbeite) ? (
            <FrageKarte key={`b-${bearbeite}`} f={fragen.get(bearbeite)!} satz={katalog.abschnittSatz[fragen.get(bearbeite)!.abschnitt]} a={strom?.antworten[bearbeite]} laedt={laedt}
              ueberspringbar={!fragen.get(bearbeite)!.pflicht && (fragen.get(bearbeite)!.typ === 'beleg' || fragen.get(bearbeite)!.typ === 'offen' || !fragen.get(bearbeite)!.kurz)}
              zurueck={vorige(bearbeite) ? () => setBearbeite(vorige(bearbeite)) : undefined} abbrechen={() => setBearbeite(null)}
              antworten={a => beantworten(fragen.get(bearbeite)!, a)} ueberspringen={() => ueberspringen(fragen.get(bearbeite)!)} />
          ) : aktuell.art === 'frage' && fragen.get(aktuell.frageId) ? (
            <FrageKarte key={aktuell.frageId} f={fragen.get(aktuell.frageId)!} laedt={laedt}
              satz={(() => { const f = fragen.get(aktuell.frageId)!; const letzte = erledigt.length ? fragen.get(erledigt[erledigt.length - 1]) : undefined; return letzte && letzte.abschnitt !== f.abschnitt ? katalog.abschnittSatz[f.abschnitt] : letzte ? QUITTUNG[erledigt.length % QUITTUNG.length] : undefined; })()}
              a={strom?.antworten[aktuell.frageId]} ueberspringbar={!fragen.get(aktuell.frageId)!.pflicht && (aktuell.phase !== 'kurzcheck' || fragen.get(aktuell.frageId)!.typ === 'beleg' || fragen.get(aktuell.frageId)!.typ === 'offen')}
              zurueck={vorige(null) && aenderbar(vorige(null)!) ? () => setBearbeite(vorige(null)) : undefined}
              ergebnisZeigen={aktuell.phase !== 'kurzcheck' ? () => void sende({ aktion: 'wahl', wahl: 'ergebnis' }) : undefined}
              antworten={a => beantworten(fragen.get(aktuell.frageId)!, a)} ueberspringen={() => ueberspringen(fragen.get(aktuell.frageId)!)} />
          ) : aktuell.art === 'kontakt' ? (
            <>
              {/* Ausführlich (31.10.): ehrlich — ohne Adresse gibt es nur die Stufe, der ganze Bericht kommt per E-Mail. */}
              <Zoe zeilen={umfang === 'lang' ? zoe.kontaktLang ?? zoe.kontakt : zoe.kontakt} />
              <KontaktKarte rollen={fragen.get('A5')?.optionen ?? []} laedt={laedt} newsletter={newsletter}
                {...(umfang === 'lang' ? { knopfText: 'Bericht per E-Mail anfordern', ohneText: 'Nur die Stufe ansehen' } : {})}
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

        {ansicht && 'gesperrt' in ansicht && !bearbeite && (
          <VorschauKarte vorschau={ansicht}>
            <KontaktKarte rollen={fragen.get('A5')?.optionen ?? []} laedt={laedt} newsletter={newsletter} knopfText="Bericht per E-Mail anfordern"
              senden={async k => { const ok = await sende({ aktion: 'kontakt', ...k }); if (ok) setAnsicht(null); return ok; }} />
          </VorschauKarte>
        )}
        {ansicht && !('gesperrt' in ansicht) && !bearbeite && (
          <ErgebnisKarte ansicht={ansicht} gespraech={gespraech} bericht={bericht} kontaktDa={strom?.kontakt === 'erfasst'} laedt={laedt}
            mehr={() => { setAnsicht(null); void sende({ aktion: 'wahl', wahl: 'mehr' }); }}
            termin={() => setKontaktFuerTermin(true)} />
        )}
        {ansicht && kontaktFuerTermin && strom?.kontakt !== 'erfasst' && (
          <div style={{ marginTop: 12 }}>
            <Zoe zeilen={['Damit Sie den Termin buchen können und Ihren Bericht bekommen, brauche ich noch kurz Ihre Angaben.']} />
            <KontaktKarte rollen={fragen.get('A5')?.optionen ?? []} laedt={laedt} newsletter={newsletter} ohneText="Doch nicht"
              senden={async k => { const ok = await sende({ aktion: 'kontakt', ...k }); if (ok) { setKontaktFuerTermin(false); setAnsicht(null); } return ok; }} ohne={() => setKontaktFuerTermin(false)} />
          </div>
        )}

        {laedt && aktuell.art === 'ergebnis' && !ansicht && <Zoe zeilen={['Ich rechne Ihr Ergebnis aus …']} />}
        {fehler && <p className={s.fehler} role="alert">{fehler}</p>}
        <div ref={ende} />

        {!!weitere?.length && (
          <nav className={s.weitereUnten} aria-label="Weitere Checks">
            <p className={s.etikett}>Weitere Checks</p>
            {/* Bewusst <a>: die anderen Checks sind eigene Seitenaufrufe (eigene Vorlage, eigene Sitzung). */}
            <div className={s.weitereListe}>{weitere.map(w => <a key={w.pfad} className={s.weitererCheck} href={w.pfad}><b>{w.name}</b><span>{w.text}</span></a>)}</div>
            {claim && <p className={s.claim}>{claim}</p>}
          </nav>
        )}

        <details className={s.datenschutz} open={!strom}>
          <summary>Datenschutz in Kürze</summary>
          {hinweis.zeilen.map((z, i) => <p key={i}>{z}</p>)}
          {hinweis.link && <p><a className={s.link} href={hinweis.link} target="_blank" rel="noopener noreferrer">Datenschutzerklärung</a></p>}
        </details>
        </div>
      </div>
      {begleiter && <ZoeBegleiterin ort="check" marke={marke} gastgeber={begleiter.gastgeber} erstgespraech={kopf?.erstgespraech} kontakt={begleiter.kontakt}
        schritt={ansicht || aktuell.art === 'ergebnis' ? 'ergebnis' : !strom ? 'start' : aktuell.art === 'kontakt' ? 'kontakt' : aktuell.art === 'wahl' ? 'wahl' : imKurz ? 'kurz' : 'vertiefung'} />}
    </main>
  );
}

function antwortText(f: OeffentlicheFrage, a: Antwort | undefined, uebersprungen?: boolean): string {
  if (uebersprungen && !a) return 'übersprungen';
  if (!a) return '';
  if (a.freitext) return a.freitext;
  const texte = (a.optionIds ?? []).map(id => f.optionen?.find(o => o.id === id)?.text ?? '').filter(Boolean);
  const t = texte.join(', ') + (a.optionText ? `: ${a.optionText}` : '') + (a.zusatz === true ? ' · Start-up' : '');
  return a.anmerkung ? `${t} · „${a.anmerkung}“` : t;
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
  // Eigene Antwort zur Auswahl (31.10., freiwillig): ist das Feld offen, wählt ein Klick nur aus, „Weiter“ schickt beides.
  const [anmerkung, setAnmerkung] = useState(a?.anmerkung ?? '');
  const [anmerkungOffen, setAnmerkungOffen] = useState(!!a?.anmerkung);
  const auswahl = f.typ === 'einfach' || f.typ === 'mehrfach';
  const mitAnmerkung = () => (anmerkungOffen && anmerkung.trim() ? { anmerkung: anmerkung.trim() } : {});
  const freiOption = f.optionen?.find(o => o.freitext);
  const sonstigeOffen = !!freiOption && gewaehlt[0] === freiOption.id;

  const klick = (id: string) => {
    if (f.typ === 'mehrfach') {
      const o = f.optionen?.find(x => x.id === id);
      setGewaehlt(g => (g.includes(id) ? g.filter(x => x !== id) : o?.exklusiv ? [id] : [...g.filter(x => !f.optionen?.find(y => y.id === x)?.exklusiv), id]));
      return;
    }
    if ((freiOption && id === freiOption.id) || anmerkungOffen) { setGewaehlt([id]); return; }
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
        {auswahl && !anmerkungOffen && (
          <button type="button" className={s.ergaenzen} disabled={laedt} onClick={() => setAnmerkungOffen(true)}>+ Eigene Antwort ergänzen</button>
        )}
        {auswahl && anmerkungOffen && (
          <div className={s.anmerkung}>
            <textarea className={`${s.textfeld} ${s.textfeldKlein}`} value={anmerkung} onChange={e => setAnmerkung(e.target.value)} maxLength={ANMERKUNG_MAX}
              aria-label="Eigene Antwort, freiwillig" placeholder="Was Sie dazu sagen möchten, in Ihren Worten (freiwillig)." autoFocus={!a?.anmerkung} />
            {anmerkung.length > ANMERKUNG_MAX * 0.8 && <div className={s.zaehler}>{anmerkung.length} / {ANMERKUNG_MAX}</div>}
          </div>
        )}
        {(f.typ === 'beleg' || f.typ === 'offen') && (
          <>
            {!!f.bausteine?.length && (
              <div className={s.chips}>
                {f.bausteine.map(b => <button key={b} type="button" className={s.chip} onClick={() => setText(t => (t.trim() ? `${t.trim()} ${b}` : b))}>{b.replace(/: $/, ' …')}</button>)}
              </div>
            )}
            <textarea className={s.textfeld} value={text} onChange={e => setText(e.target.value)} maxLength={FREITEXT_MAX} aria-label={f.text} aria-required={f.pflicht ? true : undefined} placeholder="Ein, zwei Sätze reichen." />
            <div className={s.zaehler}>{text.length} / {FREITEXT_MAX}</div>
          </>
        )}
        <div className={s.zeile}>
          {(f.typ === 'mehrfach' || sonstigeOffen || (auswahl && anmerkungOffen)) && (
            <button type="button" className={s.knopf} disabled={laedt || !gewaehlt.length} onClick={() => antworten({ optionIds: gewaehlt, ...(sonstigeOffen && optionText.trim() ? { optionText: optionText.trim() } : {}), ...(f.zusatz ? { zusatz } : {}), ...mitAnmerkung() })}>Weiter</button>
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

function KontaktKarte({ rollen, laedt, senden, ohne, ohneText, knopfText, newsletter: nl }: {
  rollen: NonNullable<OeffentlicheFrage['optionen']>; laedt: boolean; ohneText?: string; knopfText?: string; newsletter?: { wortlaut: string; fassung: string };
  /** Ohne `ohne` gibt es keinen zweiten Knopf (Vorschau des ausführlichen Checks: die Stufe steht schon da). */
  senden: (k: Record<string, unknown>) => Promise<boolean>; ohne?: () => void;
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
      const ok = await senden({ vorname: vorname.trim(), email: email.trim(), firma: firma.trim(), rolle, ...(telefon.trim() ? { telefon: telefon.trim() } : {}), ...(nl && newsletter ? { newsletter: true, newsletterFassung: nl.fassung } : {}), webseite: falle });
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
      {nl && <label className={s.haken}><input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)} /><span>{nl.wortlaut} Der Newsletter kommt erst, wenn Sie die Anmeldung über den Link in unserer E-Mail bestätigen.</span></label>}
      <p className={s.hilfe} style={{ marginTop: 10 }}>Ihre Angaben nutzen wir für Ihren Bericht und Ihr Gespräch. Mehr im Datenschutzhinweis unten.</p>
      <div className={s.zeile}>
        <button type="submit" className={s.knopf} disabled={laedt || !fertig}>{knopfText ?? 'Bericht anfordern'}</button>
        {ohne && <button type="button" className={s.leiseKnopf} disabled={laedt} onClick={ohne}>{ohneText ?? 'Ohne Bericht zum Ergebnis'}</button>}
      </div>
    </form>
  );
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/** „Di, 03.11. · 10:00“ aus Berliner Wandzeit `YYYY-MM-DDTHH:mm` (ohne Zeitzonen-Rechnung — der Server liefert Berliner Zeit). */
const platzText = (start: string) => `${WOCHENTAG[new Date(`${start.slice(0, 10)}T12:00:00Z`).getUTCDay()]}, ${start.slice(8, 10)}.${start.slice(5, 7)}. · ${start.slice(11, 16)}`;

/** Die nächsten freien Termine der Buchungsseite (öffentlich, wie auf der Buchungsseite selbst) — höchstens drei, je Tag einer. */
function useNaechsteTermine(slug: string | undefined, an: boolean): { start: string; ende: string }[] | null {
  const [plaetze, setPlaetze] = useState<{ start: string; ende: string }[] | null>(null);
  useEffect(() => {
    if (!slug || !an) return;
    let aus = false;
    void fetch(`/api/buchung/${slug}`, { cache: 'no-store' }).then(r => r.json()).then((j: { ok?: boolean; plaetze?: { start: string; ende: string }[] }) => {
      if (aus || !j.ok || !Array.isArray(j.plaetze)) return;
      const tage = new Set<string>();
      setPlaetze(j.plaetze.filter(p => { const t = p.start.slice(0, 10); if (tage.has(t)) return false; tage.add(t); return true; }).slice(0, 3));
    }).catch(() => { /* ohne Termine bleibt der Knopf zur Buchungsseite */ });
    return () => { aus = true; };
  }, [slug, an]);
  return plaetze;
}

function ErgebnisKarte({ ansicht, gespraech, bericht, kontaktDa, laedt, mehr, termin }: {
  ansicht: Ansicht; gespraech: Gespraech | null; bericht: Bericht | null; kontaktDa: boolean; laedt: boolean;
  mehr: () => void; termin: () => void;
}) {
  const zahl = useHochzaehlen(ansicht.gesamt);
  const termine = useNaechsteTermine(gespraech?.slug, kontaktDa);
  const iv = ansicht.innovation;
  // Innovations-Check ohne Säulen: das Ergebnis IST die Innovation — kein aufklappbares Detail, die Bereiche stehen offen.
  const nurInnovation = ansicht.saeulen.length <= 1 && !!iv;
  // Ein gewählter Termin fährt auf der Buchungsseite vorgewählt mit (nur dieser Browser-Tab, nie in der Adresse).
  const platzMerken = (p: { start: string; ende: string }) => { try { sessionStorage.setItem('make-check-platz', JSON.stringify(p)); } catch { /* ohne Speicher: die Seite zeigt alle Termine */ } };
  return (
    <section className={`${s.ergebnis} ${s.neu}`} aria-labelledby="ergebnis-titel">
      <p className={s.ergebnisEtikett}>Ihr Ergebnis</p>
      <div className={s.zahlZeile}>
        <span className={s.grosseZahl} aria-hidden>{zahl}</span><span className={s.vonHundert}>von 100</span>
      </div>
      <h2 id="ergebnis-titel" className={s.stufeName}>Stufe {ansicht.stufe}: {ansicht.stufeName}</h2>
      <p className={s.stufeKurz}>{ansicht.stufeKurz}</p>
      <div className={s.skala} aria-hidden>{ansicht.stufen.map(x => <span key={x.stufe} className={`${s.skalaTeil} ${x.stufe <= ansicht.stufe ? s.skalaAn : ''}`} />)}</div>
      <div className={s.skalaNamen} aria-hidden>{ansicht.stufen.map(x => <span key={x.stufe} className={x.stufe === ansicht.stufe ? s.skalaNameAn : undefined}><span className={s.skalaNr}>{x.stufe}</span><span className={s.skalaWort}>{x.name.replace(/ \(.*\)$/, '')}</span></span>)}</div>
      {/* Nur, wenn wirklich verschickt werden kann (Website-Absender eingerichtet) — sonst verspricht die Seite keine Mail. */}
      {kontaktDa && bericht?.perMail && <p className={s.berichtUnterwegs} role="status">Ihr Bericht ist unterwegs an {bericht.an}.</p>}

      {ansicht.saeulen.length > 1 && (
        <div className={s.saeulen} role="list" aria-label="Ihre Bereiche">
          {ansicht.saeulen.map(x => (
            <div key={x.key} className={s.saeule} role="listitem">
              <div className={s.saeuleKopf}><span className={s.saeuleName}>{x.name}</span><span className={s.saeuleWert}>{x.wert ?? '—'}</span></div>
              <div className={s.saeuleBalken} aria-hidden><div className={s.saeuleFuell} style={{ width: `${x.wert ?? 0}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Nur Innovation (30.10. abends): die Bereiche als Balken mit dem Wert Ihrer Branche, darunter das Netzdiagramm und der Vergleich. */}
      {nurInnovation && iv && (
        <>
          <div className={s.saeulen} role="list" aria-label="Ihre Bereiche">
            {iv.achsen.map(x => (
              <div key={x.key} className={s.saeule} role="listitem">
                <div className={s.saeuleKopf}><span className={s.saeuleName}>{x.name}</span><span className={s.saeuleWert}>{x.wert}</span></div>
                <div className={s.saeuleBalken} aria-hidden><div className={s.saeuleFuell} style={{ width: `${x.wert}%` }} /><span className={s.brancheMarke} style={{ left: `${x.branche}%` }} /></div>
                <span className={s.brancheWert}>Branche {x.branche}</span>
              </div>
            ))}
          </div>
          {iv.achsen.length >= 3 && <Netzdiagramm achsen={iv.achsen} />}
          {iv.branchenSatz && <p className={s.branchenSatz}>{iv.branchenSatz}</p>}
        </>
      )}

      <div style={{ marginTop: 18 }}><Zoe zeilen={ansicht.zoe} /></div>

      {ansicht.schritte.length > 0 && (
        <div className={s.schritte}>
          <h3 className={s.abschnittTitel}>Ihre nächsten Schritte</h3>
          {ansicht.schritte.map((x, i) => (
            <article key={x.saeule} className={s.schritt}>
              <p className={s.schrittKopf}><span className={s.schrittNr}>{i + 1}</span>{x.name}<span className={s.schrittWert}>{x.wert} von 100</span></p>
              <p className={s.schrittText}>{x.text}</p>
              {x.angebot && (
                <div className={s.angebot}>
                  <p className={s.angebotTitel}>{x.angebot.titel}</p>
                  {x.angebot.text && <p className={s.hilfe} style={{ margin: 0 }}>{x.angebot.text}</p>}
                  {/* Bewusst <a>: der Link führt auf eine Seite der Website (statisch, außerhalb dieser Anwendung) oder nach außen. */}
                  {x.angebot.link && (/^https:/.test(x.angebot.link)
                    ? <a className={s.textlink} href={x.angebot.link} target="_blank" rel="noopener noreferrer">Mehr erfahren</a>
                    : <a className={s.textlink} href={x.angebot.link}>Mehr erfahren</a>)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {gespraech && (
        <div className={s.gespraech}>
          <h3 className={s.abschnittTitel}>Kostenloses Erstgespräch</h3>
          <p className={s.hilfe}>{gespraech.satz}</p>
          {kontaktDa ? (
            gespraech.pfad ? (
              <>
                {!!termine?.length && (
                  <div className={s.termine} role="list" aria-label="Nächste freie Termine">
                    {termine.map(p => <Link key={p.start} role="listitem" className={s.termin} href={gespraech.pfad!} onClick={() => platzMerken(p)}>{platzText(p.start)}</Link>)}
                  </div>
                )}
                <Link className={s.knopf} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={gespraech.pfad}>{termine?.length ? 'Alle freien Termine' : 'Termin wählen'}</Link>
              </>
            ) : <p className={s.hilfe}>Wir melden uns bei Ihnen für einen Termin.</p>
          ) : (
            <button type="button" className={s.knopf} onClick={termin}>Erstgespräch buchen</button>
          )}
        </div>
      )}

      {ansicht.genauigkeit === 'vorlaeufig' && (
        <div className={s.vorlaeufig}>
          Mit den Fragen der ausführlichen Fassung wird Ihr Ergebnis genauer, dazu kommen Fragen zu Ihrer Branche. Ihre bisherigen Antworten bleiben gespeichert.
          <div className={s.zeile}><button type="button" className={s.zweit} disabled={laedt} onClick={mehr}>Ausführlich weitermachen</button></div>
        </div>
      )}

      {iv && !nurInnovation && (
        <details className={s.detail}>
          <summary>Innovation im Detail: Stufe {iv.stufe}, {iv.stufeName.replace(/ \(.*\)$/, '')}</summary>
          <p className={s.stufeKurz} style={{ marginTop: 8 }}>{iv.stufeKurz}</p>
          <div className={s.skala} aria-hidden>{iv.stufen.map(x => <span key={x.stufe} className={`${s.skalaTeil} ${x.stufe <= iv.stufe ? s.skalaAn : ''}`} />)}</div>
          <div className={s.skalaNamen} aria-hidden>{iv.stufen.map(x => <span key={x.stufe} className={x.stufe === iv.stufe ? s.skalaNameAn : undefined}><span className={s.skalaNr}>{x.stufe}</span><span className={s.skalaWort}>{x.name.replace(/ \(.*\)$/, '')}</span></span>)}</div>
          {iv.achsen.length >= 3 && <Netzdiagramm achsen={iv.achsen} />}
          {iv.branchenSatz && <p className={s.branchenSatz}>{iv.branchenSatz}</p>}
          <div style={{ marginTop: 14 }}><Zoe zeilen={iv.zoe} /></div>
        </details>
      )}
    </section>
  );
}

/**
 * Ausführlicher Check ohne Kontaktdaten (31.10.): Zahl, Stufe und Skala wie im Ergebnis, darunter, was der vollständige Bericht enthält — die Bereiche
 * nur mit Namen und unlesbaren Platzhaltern (die Werte hat der Browser gar nicht) — und direkt das Formular.
 */
function VorschauKarte({ vorschau, children }: { vorschau: ErgebnisVorschau; children: ReactNode }) {
  const zahl = useHochzaehlen(vorschau.gesamt);
  return (
    <section className={`${s.ergebnis} ${s.neu}`} aria-labelledby="ergebnis-titel">
      <p className={s.ergebnisEtikett}>Ihr Ergebnis</p>
      <div className={s.zahlZeile}><span className={s.grosseZahl} aria-hidden>{zahl}</span><span className={s.vonHundert}>von 100</span></div>
      <h2 id="ergebnis-titel" className={s.stufeName}>Stufe {vorschau.stufe}: {vorschau.stufeName}</h2>
      <p className={s.stufeKurz}>{vorschau.stufeKurz}</p>
      <div className={s.skala} aria-hidden>{vorschau.stufen.map(x => <span key={x.stufe} className={`${s.skalaTeil} ${x.stufe <= vorschau.stufe ? s.skalaAn : ''}`} />)}</div>
      <div className={s.skalaNamen} aria-hidden>{vorschau.stufen.map(x => <span key={x.stufe} className={x.stufe === vorschau.stufe ? s.skalaNameAn : undefined}><span className={s.skalaNr}>{x.stufe}</span><span className={s.skalaWort}>{x.name.replace(/ \(.*\)$/, '')}</span></span>)}</div>
      <div style={{ marginTop: 18 }}><Zoe zeilen={vorschau.zoe} /></div>

      <div className={s.berichtBlock}>
        <h3 className={s.abschnittTitel}>Ihr vollständiger Bericht</h3>
        <ul className={s.berichtListe}>
          <li>Je Bereich Ihr Wert und der Vergleich mit Ihrer Branche</li>
          <li>Ihr Profil als Netzdiagramm</li>
          <li>Ihre nächsten Schritte mit passenden Angeboten</li>
        </ul>
        {vorschau.bereiche.length > 0 && (
          <div className={s.saeulen} aria-label="Bereiche im Bericht">
            {vorschau.bereiche.map(name => (
              <div key={name} className={s.saeule}>
                <div className={s.saeuleKopf}><span className={s.saeuleName}>{name}</span><span className={s.platzhalterWert} aria-label="im Bericht">··</span></div>
                {/* Gleichmäßig gestreift statt verschieden lang (31.10.): ein Platzhalter darf nicht wie ein Wert aussehen. */}
                <div className={s.saeuleBalken} aria-hidden><div className={s.platzhalterFuell} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: 18 }}>{children}</div>
    </section>
  );
}
