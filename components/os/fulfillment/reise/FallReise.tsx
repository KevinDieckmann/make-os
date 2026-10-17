'use client';

// ─── Fulfillment › Fall › Reise (17.10. — Miro-Standard; ersetzt die Reiter Überblick, Ablauf, Analyse und Abschluss & Kreislauf) ────────────
// Rückmeldung 17.10.: „So möchte ich das beim Fulfillment auch haben. Es soll nicht überladen sein, sondern sehr klar. Lieber wenig und klar.“ Der Standard-Reiter:
//   1. Die Reise als EINE Zeile (ReiseBild): Phasen nebeneinander, je höchstens vier Kästchen, Abstimmungspunkte als Raute dazwischen, Band „Kunde“ unten,
//      Hier-Marke, der nächste Schritt hervorgehoben, Hänger rot markiert. Darunter EINE Zeile „läuft immer mit“ (der Takt).
//   2. Ein Tipp auf eine Phase → darunter ihr Fluss (oben → unten, feste Formen — Fluss.tsx), die Formen-Legende EINMAL.
//   3. Ein Tipp auf ein Kästchen/einen Knoten → daneben (am Handy darunter) das vorhandene Detail: Schritt abhaken, Status, Baustein öffnen, Abstimmungspunkt
//      vermerken, Willkommensmail, Kick-off-Fragen, Befähigung, Wirkungsbericht, Nachsorge, Kreislauf.
//   4. Die Analyse (Läufe A0–A13 mit Klartext, Dossier, Recht) hängt an der Phase „Analyse“ (bzw. „Diagnose“), der Abschluss an der letzten Phase.
// Rechnet nichts selbst (lib/fulfillment/prozesse/reise-bild.ts); Schreiben nur über die vorhandenen Fall-Ops. Sprünge (`#phase-…`, `#freigabe-…`,
// `#willkommen`, `#stelle-…`, auch aus früheren Adressen wie `r=analyse`) wählen Phase und Knoten.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCw, BellRing } from 'lucide-react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Klappbar, Erklaert, LEUCHT, useHandy } from '../../ui';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { alleSchritte, phasenVon, type SchrittZeile } from '@/lib/fulfillment/prozesse/reise';
import { reiseZeile, phasenFluss, flussKnoten, analysePhaseId, abschlussPhaseId, bandTexte, BAND_NICHTS, type FallStelleId, type FlussKnoten, type ReiseBildEingabe, type ReiseZeile } from '@/lib/fulfillment/prozesse/reise-bild';
import { obSchluessel } from '@/lib/fulfillment/prozesse/onboarding';
import { bestaetigungTitel, BESTAETIGUNG } from '@/lib/fulfillment/prozesse/darstellung';
import { RHYTHMUS_TEXT } from '@/lib/fulfillment/prozesse/rituale';
import { useFall, fallOps, fehlerText, type FallAntwort } from '../prozesse/daten';
import { klein, Meldung, useTextFrage } from '../prozesse/teile';
import { SchrittDetail, FreigabeMeilenstein, FreigabeDialog, ExtraDialog, fallOpsMitMeldung, statusSetzer, type FallMeldung } from '../prozesse/FallAblauf';
import { WillkommenKarte, KickoffFragen, AusAnalyse, KeinFall, VorlageGeaendert, AusfuehrungWartet, FallStatus, OnboardingZaehler, OnboardingMehr, ZusatzAnhaengen } from '../prozesse/FallUeberblick';
import { AbschlussDetail, type AbschlussOps, type AbschlussStelle } from '../prozesse/FallKreislauf';
import { FallAnalyse } from '../analyse/FallAnalyse';
import { ReiseBild, type BildSpalte } from '../../ui/reise/ReiseBild';
import { Fluss, FormenLegende } from '../../ui/reise/Fluss';
import { useSprung, sprungAus, insBild, type Sprung } from './sprung';
import { AblaufKarte } from './AblaufKarte';

const ABSCHLUSS: ReadonlySet<FallStelleId> = new Set(['befaehigung', 'wirkung', 'abschliessen', 'mandat', 'nachsorge', 'kreislauf']);
/** Frühere Stellen (bis 17.10. eigene Reiter) → Stelle im Fluss. */
const ALTE_STELLE: Record<string, FallStelleId> = { 'kreislauf-wirkung': 'wirkung', 'kreislauf-befaehigung': 'befaehigung', 'kreislauf-nachher': 'nachsorge', ausanalyse: 'analyse' };

/** Die Kästchen des Modells als Spalten der Zeichnung (Zähler, Raute, Band „Kunde“ mit Satz — `bandTexte`). */
export function bildSpalten(z: ReiseZeile): BildSpalte[] {
  const band = bandTexte(z);
  return z.spalten.map((s, i) => ({
    id: s.id, nr: s.nr, titel: s.titel, zustand: s.zustand, kaestchen: s.kaestchen, mehr: s.mehr, ...(s.haengt ? { haengt: s.haengt } : {}),
    unter: s.zustand === 'fertig' ? 'erledigt' : s.gesamt ? `${s.erledigt} von ${s.gesamt}` : undefined,
    ...(s.abstimmung ? { raute: { titel: bestaetigungTitel(s.abstimmung.nr, s.abstimmung.titel || undefined), gegeben: s.abstimmung.gegeben, hier: s.abstimmung.hier, ...(s.abstimmung.haengt ? { haengt: s.abstimmung.haengt } : {}) } } : {}),
    band: { ...(band[i] ? { text: band[i] } : {}), ...(band[i] && band[i] !== BAND_NICHTS ? { achtung: true } : {}), intern: !s.band.sieht },
    // Phasen eines angehängten Zusatzmoduls (17.10. spät): eigener Abschnitt der Reise mit dem Titel des Moduls.
    ...(s.modul ? { abschnitt: { id: s.modul.id, titel: s.modul.titel } } : {}),
  }));
}

export function FallReise({ mandatId, anker }: { mandatId: string; anker?: string }) {
  const { daten, fehler } = useFall(mandatId);
  const [meldung, setMeldung] = useState<FallMeldung>(null);
  const [wahl, setWahl] = useState<{ phase: string | null; knoten: string | null }>({ phase: null, knoten: null });
  const [freigabe, setFreigabe] = useState<string | null>(null);
  const [extra, setExtra] = useState<string | null>(null);
  const [willkommenAuf, setWillkommenAuf] = useState(false);
  const [analyseAuf, setAnalyseAuf] = useState<boolean | null>(null);
  const [offenerSprung, setOffenerSprung] = useState<Sprung | null>(() => (anker ? sprungAus(anker) : null));
  const frage = useTextFrage();
  const handy = useHandy();
  useSprung(s => setOffenerSprung(s));
  const f = daten?.fall ?? null;
  const heute = localDay();
  const eingabe: ReiseBildEingabe | null = f ? {
    fall: f, freigaben: daten?.vorlage?.freigaben ?? [], heute,
    bausteinArt: id => daten?.bausteine?.find(b => b.id === id)?.art,
    willkommenUeberfaellig: !!daten?.onboarding?.willkommen.ueberfaellig,
    ...(daten?.nachsorge ? { nachsorge: daten.nachsorge } : {}),
  } : null;
  const zeile = eingabe ? reiseZeile(eingabe) : null;
  const analyseId = f ? analysePhaseId(f) : null;
  const abschlussId = f ? abschlussPhaseId(f) : null;
  const standard = zeile ? (zeile.hier?.phaseId ?? zeile.spalten.find(s => s.zustand === 'jetzt')?.id ?? zeile.spalten.at(-1)?.id ?? null) : null;
  const phase = wahl.phase ?? standard;
  const knoten = wahl.phase ? wahl.knoten : (wahl.knoten ?? (zeile?.hier && zeile.hier.phaseId === phase ? zeile.hier.id : null));
  const fluss = eingabe && phase ? phasenFluss(eingabe, phase, daten?.unterschrift?.am ?? null) : null;
  const knotenListe = fluss ? flussKnoten(fluss) : [];

  // Einen Sprung auflösen, sobald der Fall da ist (Adresse beim Öffnen, Ereignis aus dem Kopf/Detail).
  useEffect(() => {
    if (!offenerSprung || !f || !zeile || !eingabe) return;
    const s = offenerSprung;
    setOffenerSprung(null);
    const finde = (stelle: FallStelleId): { phase: string; id: string } | null => {
      for (const sp of zeile.spalten) {
        const fl = phasenFluss(eingabe, sp.id);
        const k = fl ? flussKnoten(fl).find(x => x.stelle === stelle) : undefined;
        if (k) return { phase: sp.id, id: k.id };
      }
      return null;
    };
    if (s.art === 'phase') { setWahl({ phase: s.wert, knoten: null }); insBild('ff-fluss'); return; }
    // 17.10. abends (Ausführung): `#schritt-<Knoten>` aus Aufgabe bzw. Glocke — den Knoten im Fluss seiner Phase wählen.
    if (s.art === 'schritt') {
      const sp = zeile.spalten.find(x => { const fl = phasenFluss(eingabe, x.id); return !!fl && flussKnoten(fl).some(k => k.id === s.wert); });
      if (sp) { setWahl({ phase: sp.id, knoten: s.wert }); insBild('ff-detail'); }
      return;
    }
    if (s.art === 'freigabe') {
      const sp = zeile.spalten.find(x => x.abstimmung?.id === s.wert);
      const schritt = f.knoten.find(k => k.freigabe === s.wert && k.id !== sp?.id);
      if (sp) setWahl({ phase: sp.id, knoten: `fg-${s.wert}` });
      else if (schritt) { const z = zeile.spalten.find(x => alleSchritte(f, x.id, heute).some(y => y.knoten.id === schritt.id)); if (z) setWahl({ phase: z.id, knoten: schritt.id }); }
      setFreigabe(s.wert);
      return;
    }
    if (s.art === 'willkommen') { const t = finde('willkommen'); if (t) setWahl({ phase: t.phase, knoten: t.id }); setWillkommenAuf(true); insBild('willkommen'); return; }
    const wert: string = ALTE_STELLE[s.wert] ?? s.wert;
    if (wert === 'analyse') { if (analyseId) setWahl({ phase: analyseId, knoten: null }); setAnalyseAuf(true); insBild('ff-analyse'); return; }
    if (wert === 'abschluss') {
      if (abschlussId) {
        const hier = zeile.hier?.phaseId === abschlussId ? zeile.hier.id : null;
        setWahl({ phase: abschlussId, knoten: hier ?? finde('wirkung')?.id ?? null });
      }
      insBild('ff-fluss');
      return;
    }
    const t = finde(wert as FallStelleId);
    if (t) { setWahl({ phase: t.phase, knoten: t.id }); insBild('ff-detail'); return; }
    insBild(wert);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nur, wenn ein Sprung kommt oder die Daten da sind
  }, [offenerSprung, !!f]);

  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  if (!f || !zeile) return <KeinFall daten={daten} />;
  const ops = fallOpsMitMeldung(mandatId, setMeldung);
  const status = statusSetzer(f, ops, frage.fragen);
  const abschlussOps: AbschlussOps = async (o, gut) => { const a = await fallOps(mandatId, o); setMeldung(a.ok ? (gut ? { text: gut, art: 'gut' } : null) : { text: fehlerText(a), art: 'kritisch' }); return a.ok; };
  const melde = (text: string | null, art: 'gut' | 'kritisch' | 'achtung' = 'gut') => setMeldung(text ? { text, art } : null);
  const sp = zeile.spalten.find(s => s.id === phase) ?? null;
  const waehle = (p: string, k: string | null) => { setWahl({ phase: p, knoten: k }); if (handy && k) insBild('ff-detail'); };
  const phaseWaehlen = (p: string) => { setWahl({ phase: p, knoten: zeile.hier?.phaseId === p ? zeile.hier.id : null }); insBild('ff-fluss'); };
  const gewaehlt = knotenListe.find(k => k.id === knoten) ?? null;
  const istAnalyse = !!phase && phase === analyseId;
  const analyseOffen = analyseAuf ?? (istAnalyse && sp?.zustand === 'jetzt');
  const fallRituale = (f.rituale ?? []).map(r => (daten.rituale ?? []).find(x => x.id === r.ritualId)).filter((r): r is NonNullable<typeof r> => !!r);
  const onboarding = daten.onboarding;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Meldung text={meldung?.text ?? null} art={meldung?.art} />
      <VorlageGeaendert daten={daten} onMeldung={setMeldung} />
      <Karte i={0} flach>
        <Ueberschrift erklaerung="fulfillment.reise" rechts={<Erklaert erklaerung="fulfillment.fortschritt" name="Fortschritt"><span>{daten.vorlage?.titel ?? ''}{daten.vorlage?.titel ? ' · ' : ''}{zeile.fortschritt} %</span></Erklaert>}>Reise des Kunden</Ueberschrift>
        <ReiseBild spalten={bildSpalten(zeile)} aktiv={phase} gewaehlt={knoten} onPhase={phaseWaehlen} onKaestchen={waehle} onRaute={p => { const s = zeile.spalten.find(x => x.id === p); if (s?.abstimmung) waehle(p, `fg-${s.abstimmung.id}`); }} />
        {/* Was immer mitläuft (Vorbild: „CRM/Datenpflege“ zwischen den Stufen) — EIN Satz, ein Tipp führt zu den Terminen. */}
        <Link href={WEG.fall(mandatId, 'menschen', 'stelle-takt-leiste')} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minHeight: 44, fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none' }}>
          <RotateCw size={14} aria-hidden color={C.inkLeise} />
          <span style={{ ...MIKRO }}>Läuft immer mit</span>
          <span>{fallRituale.length ? fallRituale.map(r => `${r.titel} (${RHYTHMUS_TEXT[r.rhythmus]})`).join(' · ') : 'noch kein Ritual im Kalender'} · Report alle 14 Tage ›</span>
        </Link>
        {/* 17.10. spät (`ff-einfach`): ein Zusatzmodul hängt sich an DIESE Reise — der Knopf steht hier statt ganz unten unter dem Status. */}
        <ZusatzAnhaengen daten={daten} />
      </Karte>

      {fluss && sp && (
        <div className="ff-fall-raster">
          <Karte i={1} id="ff-fluss">
            <Ueberschrift erklaerung="fulfillment.ablaufPhasen" rechts={sp.nr === 1 && onboarding ? <Erklaert erklaerung="fulfillment.onboardingBand" name="Onboarding"><OnboardingZaehler schritte={onboarding.schritte} /></Erklaert> : <span>{sp.zustand === 'fertig' ? 'erledigt' : `${sp.erledigt} von ${sp.gesamt}`}</span>}>
              Phase {sp.nr} · {sp.titel}
            </Ueberschrift>
            <Fluss fluss={fluss} gewaehlt={knoten} onWahl={k => waehle(phase!, k.id)}
              onEnde={fluss.ende.phaseId ? () => phaseWaehlen(fluss.ende.phaseId!) : fluss.ende.stelle === 'kreislauf' ? () => waehle(phase!, 'ff-kreislauf') : undefined}
              fuss={<Knopf leise onClick={() => setExtra(phase)}>+ Zusatz-Schritt in „{sp.titel}“</Knopf>} />
            <FormenLegende />
          </Karte>
          <div className="ff-fall-detail" style={{ display: 'grid', gap: 14, minWidth: 0 }}>
            <AusfuehrungWartet daten={daten} />
            <Detail daten={daten} phase={sp.titel} knoten={knoten} gewaehlt={gewaehlt} ops={ops} status={status} abschlussOps={abschlussOps} melde={melde}
              onFreigabe={setFreigabe} willkommenAuf={willkommenAuf} setWillkommenAuf={setWillkommenAuf} setMeldung={setMeldung} fragen={frage.fragen} />
          </div>
        </div>
      )}

      {istAnalyse && (
        <Klappbar id="ff-analyse" titel="Analyse dieser Phase — Läufe, Dossier, Recht" offen={analyseOffen} umschalten={() => setAnalyseAuf(!analyseOffen)} erklaerung="fulfillment.wellen">
          <div style={{ display: 'grid', gap: 14 }}>
            <AusAnalyse daten={daten} onMeldung={setMeldung} />
            <FallAnalyse mandatId={mandatId} />
          </div>
        </Klappbar>
      )}

      <FallStatus daten={daten} ops={ops} />
      {freigabe && <FreigabeDialog id={freigabe} daten={daten} onZu={() => setFreigabe(null)} ops={ops} />}
      {extra && <ExtraDialog phaseId={extra} fall={f} onZu={() => setExtra(null)} ops={ops} />}
      {frage.dialog}
    </div>
  );
}

/** Das Detail des gewählten Knotens — die vorhandenen Karten, nichts doppelt. Ohne Wahl ein Satz, wie es geht. */
function Detail({ daten, phase, knoten, gewaehlt, ops, status, abschlussOps, melde, onFreigabe, willkommenAuf, setWillkommenAuf, setMeldung, fragen }: {
  daten: FallAntwort; phase: string; knoten: string | null; gewaehlt: FlussKnoten | null;
  ops: ReturnType<typeof fallOpsMitMeldung>; status: ReturnType<typeof statusSetzer>; abschlussOps: AbschlussOps; melde: (t: string | null, art?: 'gut' | 'kritisch' | 'achtung') => void;
  onFreigabe: (id: string) => void; willkommenAuf: boolean; setWillkommenAuf: (b: boolean) => void; setMeldung: (m: FallMeldung) => void; fragen: (t: string) => Promise<string | null>;
}) {
  const f = daten.fall!;
  if (knoten === 'ff-kreislauf') return <AbschlussDetail daten={daten} stelle="kreislauf" melde={melde} ops={abschlussOps} />;
  if (!knoten || !gewaehlt) {
    return (
      <Karte i={0} flach id="ff-detail">
        <Ueberschrift>Details</Ueberschrift>
        <div style={klein}>Ein Kästchen in der Reise oder einen Schritt im Fluss antippen — hier stehen dann der Schritt, sein Stand und der Handgriff (abhaken, Bestätigung vermerken, Mail vorbereiten …).</div>
      </Karte>
    );
  }
  const hier = gewaehlt.zustand === 'hier';
  if (knoten.startsWith('fg-')) {
    const id = knoten.slice(3);
    const fg = daten.vorlage?.freigaben.find(x => x.id === id) ?? { id, titel: '', wer: 'beide' as const };
    const nr = new RegExp(`^${BESTAETIGUNG} (\\d+)`).exec(gewaehlt.titel)?.[1];
    return <FreigabeMeilenstein fg={{ id, titel: fg.titel, wer: fg.wer, ...(nr ? { nr: Number(nr) } : {}) }} gegeben={f.freigaben[id]} haupt={hier} onVermerken={() => onFreigabe(id)} onZurueck={() => ops([{ op: 'freigabe', id, zuruecknehmen: true }])} />;
  }
  if (knoten.startsWith('ff-') && gewaehlt.stelle && ABSCHLUSS.has(gewaehlt.stelle)) {
    return <AbschlussDetail daten={daten} stelle={gewaehlt.stelle as AbschlussStelle} melde={melde} ops={abschlussOps} haupt={hier} />;
  }
  // Die Zeile des Schritts (mit Bausteinen) — dieselbe wie im Fluss.
  const heute = localDay();
  const z: SchrittZeile | undefined = phasenVon(f).map(ph => alleSchritte(f, ph.id, heute).find(y => y.knoten.id === knoten)).find((x): x is SchrittZeile => !!x);
  if (!z) return <Hinweis art="achtung">Diesen Schritt gibt es nicht (mehr).</Hinweis>;
  const ob = obSchluessel(z.knoten.id);
  const stelle = gewaehlt.stelle;
  const gesendet = f.onboarding.willkommenGesendetAm;
  // Ausführung (17.10. abends): an einer Entscheidung bzw. Nachricht, die dran ist, liegt die Hauptaktion in der Ablauf-Karte (Ja/Nein, Entwurf öffnen).
  const ab = daten.ablauf?.aktiv ? daten.ablauf.knoten[z.knoten.id] : undefined;
  const ablaufHaupt = !!ab?.aktiv && (ab.art === 'entscheidung' || ab.art === 'nachricht');
  return (
    <>
      <SchrittDetail z={z} phase={phase} daten={daten} status={status} ops={ops} onFreigabe={onFreigabe} haupt={hier && !ablaufHaupt && !(stelle === 'willkommen' && !gesendet)}
        mehr={ob ? <OnboardingMehr daten={daten} schluessel={ob} fragen={fragen} /> : undefined}
        zusatz={gewaehlt.erinnerung ? <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.ink }}><BellRing size={14} color={LEUCHT.business} aria-hidden />Erinnerung: {gewaehlt.erinnerung.titel}{gewaehlt.erinnerung.unter ? ` — ${gewaehlt.erinnerung.unter}` : ''}</div> : undefined} />
      {ab && <AblaufKarte daten={daten} knotenId={z.knoten.id} ops={ops} />}
      {stelle === 'willkommen' && !gesendet && <WillkommenKarte daten={daten} oeffnen={willkommenAuf} setOeffnen={setWillkommenAuf} onMeldung={setMeldung} haupt={hier} />}
      {stelle === 'kickoff' && <KickoffFragen daten={daten} ops={ops} />}
      {stelle && ABSCHLUSS.has(stelle) && <AbschlussDetail daten={daten} stelle={stelle as AbschlussStelle} melde={melde} ops={abschlussOps} />}
      {stelle === 'analyse' && <Hinweis art="info" titel="Analyse">Läufe, Dossier und Recht stehen an der Phase der Analyse — unten unter „Analyse dieser Phase“ bzw. über den Verweis am Schritt.</Hinweis>}
    </>
  );
}
