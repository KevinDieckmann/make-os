'use client';

// ─── Fulfillment › Fall — Bausteine des früheren „Überblicks“ (Paket C1, 10.10.; 11.10. neu gezeichnet; seit 17.10. verteilt auf die Reise) ───────────
// Rückmeldung 17.10.: „Es dupliziert sich — lieber wenig und klar.“ Den Reiter „Überblick“ gibt es nicht mehr (Adresse leitet auf die Reise). Seine Teile
// stehen dort, wo sie hingehören — sie bleiben HIER als Bausteine:
//   · Onboarding: die acht Schritte sind die Kästchen der ersten Phase (Fluss) — hier nur der Zähler (`OnboardingZaehler`, dieselbe Zählung wie Cockpit und
//     Kopf: nur, was für „fertig“ zählt) und das „⋯“ eines Onboarding-Schritts (`OnboardingMehr`: entfällt mit Grund, wieder offen, Vermerk „gesendet“ zurück).
//   · `WillkommenKarte` — das Detail der Nachricht „Willkommen“ (Vorlage der Bibliothek, drei freie Kick-off-Zeiten, Playbook-Link — gesendet nur per Klick).
//   · `KickoffFragen` — das Detail des Termins „Kick-off“.
//   · `AusAnalyse` — an der Analyse-Phase: was die geprüfte Diagnose noch für den Fall hat (Quick Wins, Fragen, Maßnahmen), je ein Klick.
//   · `QuickWins` — unter „Ziele & Wirkung“ (Quick Wins und erste Erfolge).
//   · `VorlageGeaendert`, `FallStatus`, `KeinFall` — am Rand der Reise (Hinweis oben, Status unten, ohne Fall „Onboarding starten“).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Zeile, Chip, Pillen, HakenZiel, Erklaert, LEUCHT } from '../../ui';
import { willkommenMail, WILLKOMMEN_GERUEST, TAG_WILLKOMMEN, obKnotenId, onboardingZaehlung, type OnboardingSchrittStand } from '@/lib/fulfillment/prozesse/onboarding';
import { fallStartTag, diffVorschau } from '@/lib/fulfillment/prozesse/fall';
import type { OnboardingSchluessel } from '@/lib/fulfillment/muster';
import { linkAdresseAus } from '@/lib/fulfillment/kunde/link';
import { useUebersichtKurz, fallOps, fallAktion, vorlagenOps, holeJson, fehlerText, tagKurz, neueAnfrageId, type FallAntwort } from './daten';
import { Wahl } from '../../crm/Wahl';
import { localDay } from '@/lib/zeit';
import { StartDialog } from './Onboarding';
import { MailSenden, type MailEntwurf } from './MailSenden';
import { klein, feld, Leiste } from './teile';
import { MehrKnopf } from '../reise/teile';
import { inDenFall, NACH_FALL_TEXT, type NachFallWas } from '../analyse/daten';
import { WEG } from '@/lib/wege';
import type { FallMeldung, Ops } from './FallAblauf';

const STATUS = [{ id: 'laeuft' as const, label: 'läuft' }, { id: 'pausiert' as const, label: 'pausiert' }, { id: 'abgeschlossen' as const, label: 'abgeschlossen' }];

/** Der Zähler des Onboardings — nur die Schritte, die für „fertig“ zählen (das Playbook darf noch laufen; 15.10., Abnahme C16). */
export function OnboardingZaehler({ schritte }: { schritte: readonly OnboardingSchrittStand[] }) {
  const z = onboardingZaehlung(schritte);
  return <span>Onboarding {z.erledigt} von {z.gesamt}</span>;
}

/** „⋯“ eines Onboarding-Schritts: entfällt (mit Grund) bzw. wieder offen, und bei der Willkommensmail „Vermerk ‚gesendet‘ zurücknehmen“. */
export function OnboardingMehr({ daten, schluessel, fragen }: { daten: FallAntwort; schluessel: OnboardingSchluessel; fragen: (titel: string) => Promise<string | null> }) {
  const f = daten.fall!;
  const k = f.knoten.find(x => x.id === obKnotenId(schluessel));
  const s = daten.onboarding?.schritte.find(x => x.schluessel === schluessel);
  if (!k || !s) return null;
  const gesendet = schluessel === 'willkommen' ? f.onboarding.willkommenGesendetAm : undefined;
  return (
    <MehrKnopf titel={s.titel} mehr={[
      ...(k.status === 'entfaellt'
        ? [{ id: 'offen', label: 'Wieder offen', tun: async () => { await fallOps(daten.mandat.id, [{ op: 'knoten-status', id: k.id, status: 'offen', stand: k.stand }]); } }]
        : !s.erfuellt ? [{ id: 'entfaellt', label: 'Entfällt für diesen Fall …', hinweis: 'Mit Grund — der Schritt zählt dann nicht mehr.', tun: async () => { const grund = await fragen('Warum entfällt dieser Schritt?'); if (grund) await fallOps(daten.mandat.id, [{ op: 'knoten-status', id: k.id, status: 'entfaellt', grund, stand: k.stand }]); } }] : []),
      ...(gesendet ? [{ id: 'zurueck', label: 'Vermerk „gesendet“ zurücknehmen', tun: async () => { await fallOps(daten.mandat.id, [{ op: 'willkommen-gesendet', zuruecknehmen: true }]); } }] : []),
      // Kick-off ohne eigenen Kalender (17.10., Gesamtprüfung L1 B6): der Kunde lädt ein (Teams/Outlook) — vermerken statt ewig offen.
      ...(schluessel === 'kickoff' && !s.erfuellt ? [{ id: 'kickoff-vermerken', label: 'Termin steht anderswo — Kick-off vermerken', hinweis: 'z. B. der Kunde hat eingeladen', tun: async () => { await fallOps(daten.mandat.id, [{ op: 'kickoff-vermerkt' }]); } }] : []),
      ...(schluessel === 'kickoff' && f.onboarding.kickoffAm ? [{ id: 'kickoff-zurueck', label: 'Vermerk „Kick-off“ zurücknehmen', tun: async () => { await fallOps(daten.mandat.id, [{ op: 'kickoff-vermerkt', zuruecknehmen: true }]); } }] : []),
    ]} />
  );
}

/**
 * Die Vorlage des Falls hat eine neue Fassung — „Vorlage geändert — übernehmen?“ mit Vorschau dessen, was sich ändert (neu, geändert mit Feldern, neue
 * Reihenfolge, in der Vorlage entfernt). Nichts geschieht automatisch: erst „Übernehmen“ schreibt — erledigte Schritte bleiben erledigt, nichts geht verloren
 * (Prozess-Editor, 17.10.; Regel lib/fulfillment/prozesse/fall.ts `vorlageUebernehmen`).
 */
export function VorlageGeaendert({ daten, onMeldung }: { daten: FallAntwort; onMeldung: (m: FallMeldung) => void }) {
  // Das Paket des Falls und jedes angehängte Zusatzmodul (17.10. spät) — je eine Neuigkeit mit derselben Vorschau und demselben „Übernehmen“.
  return (
    <>
      {daten.diff && <DiffHinweis d={daten.diff} titel="Vorlage geändert" mandatId={daten.mandat.id} onMeldung={onMeldung} />}
      {(daten.zusaetze ?? []).map(z => z.diff && <DiffHinweis key={z.vorlageId} d={z.diff} titel={`Zusatzmodul „${z.titel}“ geändert`} mandatId={daten.mandat.id} vorlageId={z.vorlageId} onMeldung={onMeldung} />)}
    </>
  );
}

function DiffHinweis({ d, titel, mandatId, vorlageId, onMeldung }: { d: NonNullable<FallAntwort['diff']>; titel: string; mandatId: string; vorlageId?: string; onMeldung: (m: FallMeldung) => void }) {
  const [auf, setAuf] = useState(false);
  if (!(d.neu.length + d.geaendert.length + (d.reihenfolge?.length ?? 0))) return null;
  const reihe = d.reihenfolge ?? [];
  const teile = [d.neu.length ? `${d.neu.length} neu` : '', d.geaendert.length ? `${d.geaendert.length} geändert` : '', reihe.length ? `neue Reihenfolge in ${reihe.length}` : '', d.entfernt.length ? `${d.entfernt.length} in der Vorlage entfernt (bleiben im Fall)` : ''].filter(Boolean);
  const inhalt = (
    <Hinweis art="info" titel={`${titel} — übernehmen? (Fassung ${d.von} → ${d.nach})`}
      aktion={<Erklaert erklaerung="fulfillment.vorlageDiff" name="Vorlage übernehmen"><Knopf leise onClick={async () => { const a = await fallAktion({ aktion: 'vorlage-uebernehmen', mandatId, ...(vorlageId ? { vorlageId } : {}) }); onMeldung(a.ok ? { text: 'Neue Fassung übernommen — erledigte Schritte bleiben, wie sie sind.', art: 'gut' } : { text: fehlerText(a), art: 'kritisch' }); }}>Übernehmen</Knopf></Erklaert>}>
      <span>{teile.join(' · ')} — erledigte Schritte bleiben erledigt, nichts geht verloren. </span>
      <button type="button" className="fassbar" aria-expanded={auf} onClick={() => setAuf(!auf)} style={{ minHeight: 44, background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', padding: 0, fontSize: TYP.bedien }}>{auf ? 'Vorschau schließen' : 'Was sich ändert ›'}</button>
      {auf && (
        <div data-ff-vorschau style={{ display: 'grid', gap: 8, marginTop: 6 }}>
          {diffVorschau(d).map(a => (
            <div key={a.titel} style={{ display: 'grid', gap: 2 }}>
              <span style={MIKRO}>{a.titel}</span>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 2 }}>{a.zeilen.map((e, i) => <li key={i} style={{ fontSize: TYP.bedien, color: C.ink, overflowWrap: 'break-word' }}>{e}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </Hinweis>
  );
  // Der Sprung „Vorlage übernehmen, damit die Ausführung startet“ zielt auf die Übernahme des PAKETS — ein Zusatzmodul hat keine Marke.
  return vorlageId ? inhalt : <div id="ff-vorlage-geaendert" style={{ scrollMarginTop: 80 }}>{inhalt}</div>;
}

/**
 * Ein alter Fall ohne Formen (17.10. abends): die Ausführung (Aufgaben, Entwürfe, Erinnerungen) startet erst, wenn die neue Fassung der Vorlage übernommen ist.
 * Ein Satz und EIN Knopf — er führt zur vorhandenen Übernahme („Vorlage geändert — übernehmen?“ oben an der Reise); geschrieben wird erst dort.
 */
export function AusfuehrungWartet({ daten }: { daten: FallAntwort }) {
  if (!daten.ausfuehrungWartet || !daten.diff) return null;
  return (
    <Hinweis art="info" titel="Ausführung startet nach der Übernahme"
      aktion={<Knopf leise onClick={() => { const el = document.getElementById('ff-vorlage-geaendert'); el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); Array.from(el?.querySelectorAll<HTMLElement>('button') ?? []).find(b => b.textContent?.trim() === 'Übernehmen')?.focus({ preventScroll: true }); }}>Vorlage übernehmen, damit die Ausführung startet ›</Knopf>}>
      Dieser Fall stammt aus einer älteren Fassung ohne Formen — Aufgaben, Entwürfe und Erinnerungen entstehen erst mit der neuen Fassung.
    </Hinweis>
  );
}

/** Der Status des Falls (läuft · pausiert · abgeschlossen) — ruhig am Ende der Reise; darunter die angehängten Zusatzmodule („anhängen“ steht seit 17.10. spät an der Reise). */
export function FallStatus({ daten, ops }: { daten: FallAntwort; ops: Ops }) {
  const f = daten.fall!;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center' }}>
        <span style={{ ...MIKRO }}>Status des Falls</span>
        <Pillen liste={STATUS} aktiv={f.status === 'onboarding' ? null : f.status} onWahl={status => ops([{ op: 'fall-status', status }])} />
        {/* Abnahme B8: der Starttag des Falls (`fallStartTag` — der gewählte, nicht der Tag des Anlegens), Unterschrift zuerst. */}
        <span style={klein}>{daten.unterschrift ? `Unterschrift ${tagKurz(daten.unterschrift.am)} · ` : ''}Fall gestartet {tagKurz(fallStartTag(f))}{f.status === 'onboarding' ? ' · wechselt nach dem Onboarding von selbst auf „läuft“' : ''}{f.ohneOnboarding ? ' · Zusatzmodul ohne Onboarding' : ''}</span>
      </div>
      {!!daten.zusaetze?.length && <span style={klein}>Zusatzmodule: {daten.zusaetze.map(z => `${z.titel} (ab ${tagKurz(z.startAm)})`).join(' · ')}</span>}
    </div>
  );
}

/**
 * „Zusatzmodul anhängen“ (17.10. spät): ein Paket mit „Zusatzmodul“ an diesen laufenden Fall hängen — kein zweiter Fall, kein zweites Onboarding. Derselbe
 * Weg wie „Fall starten“ (POST starten, idempotent über die Anfrage-Kennung); der Server entscheidet, dass es anhängt.
 * Seit 17.10. spät (`ff-einfach`) direkt an der Reise (vorher ganz unten unter dem Status, und nur sichtbar, wenn es schon ein Zusatzmodul gab): der Knopf steht
 * immer da; gibt es noch keins, sagt er, wo man einen Ablauf zum Zusatzmodul macht.
 */
export function ZusatzAnhaengen({ daten }: { daten: FallAntwort }) {
  const kurz = useUebersichtKurz();
  const f = daten.fall!;
  const [auf, setAuf] = useState(false);
  const [wahl, setWahl] = useState<string | null>(null);
  const [tag, setTag] = useState(localDay());
  const [fehler, setFehler] = useState<string | null>(null);
  const [anfrage, setAnfrage] = useState(neueAnfrageId);
  const dran = new Set([f.vorlageId, ...(daten.zusaetze ?? []).map(z => z.vorlageId)]);
  const zusatzModule = (kurz.daten?.prozesse ?? []).filter(p => p.art === 'paket' && p.zusatz && !dran.has(p.id));
  if (f.status === 'abgeschlossen' || !kurz.daten) return null;
  if (!auf) return <div><Erklaert erklaerung="fulfillment.zusatzAnhaengen" name="Zusatzmodul anhängen"><Knopf leise onClick={() => { setAuf(true); setWahl(zusatzModule[0]?.id ?? null); }}>+ Zusatzmodul anhängen</Knopf></Erklaert></div>;
  if (!zusatzModule.length) {
    return (
      <Hinweis art="info" aktion={<span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}><Knopf leise href={`${WEG.fulfillment()}#ff-ablaeufe`}>Zu den Abläufen ›</Knopf><Knopf leise onClick={() => setAuf(false)}>Schließen</Knopf></span>}>
        Noch kein Zusatzmodul. Einen Ablauf zum Zusatzmodul machen: unter „Abläufe“ auf „Bearbeiten“ und oben den Schalter „Zusatzmodul“ einschalten — dann steht er hier zur Wahl.
      </Hinweis>
    );
  }
  const los = async () => {
    if (!wahl) { setFehler('Bitte ein Zusatzmodul wählen.'); return; }
    const a = await fallAktion({ aktion: 'starten', mandatId: daten.mandat.id, vorlageId: wahl, start: tag, anfrageId: anfrage });
    if (a.ok) { setAuf(false); setFehler(null); setAnfrage(neueAnfrageId()); } else setFehler(fehlerText(a));
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void los(); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Wahl label="Zusatzmodul" liste={zusatzModule.map(p => ({ id: p.id, label: p.titel }))} wert={wahl} onWahl={setWahl} />
      <input type="date" value={tag} onChange={e => setTag(e.target.value)} aria-label="Start des Zusatzmoduls" style={feld} />
      <Knopf haupt typ="submit" aus={!wahl}>Anhängen</Knopf>
      <Knopf leise onClick={() => setAuf(false)}>Abbrechen</Knopf>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <span style={klein}>Die Phasen kommen als eigener Abschnitt hinten an diesen Fall und laufen neben dem Paket — ohne zweites Onboarding.</span>
    </form>
  );
}

export function KeinFall({ daten }: { daten: FallAntwort }) {
  const kurz = useUebersichtKurz();
  const [start, setStart] = useState(false);
  const pakete = (kurz.daten?.prozesse ?? []).filter(p => p.art === 'paket').map(p => ({ id: p.id, titel: p.titel, ...(p.zusatz ? { zusatz: true as const } : {}) }));
  const zu = daten.mandat.leistungId ? kurz.daten?.zuordnung[daten.mandat.leistungId]?.vorlageId : undefined;
  const v = pakete.find(p => p.id === zu);
  if (!daten.mandat.business) return <Hinweis art="info">Fulfillment gibt es nur für Mandate einer Business-Gesellschaft — dieses Mandat gehört zu Privat.</Hinweis>;
  return (
    <Karte i={1}>
      <Ueberschrift>Noch kein Fall</Ueberschrift>
      <div style={klein}>Für „{daten.mandat.titel}“ läuft noch kein Fulfillment. Der Fall kopiert den Ablauf des Produkts und legt die Onboarding-Schritte an — Mandate ohne Fall bleiben genau wie bisher.</div>
      <div><Knopf haupt onClick={() => setStart(true)}>Fall starten</Knopf></div>
      {start && <StartDialog k={{ mandatId: daten.mandat.id, kunde: daten.mandat.kunde, ...(v ? { vorlage: { id: v.id, titel: v.titel } } : {}) }} pakete={pakete} onZu={() => setStart(false)} />}
    </Karte>
  );
}

interface WillkommenGrundlage { anrede: 'Du' | 'Sie'; vorlage: { id: string; titel: string; text: string } | null; an: { email: string; name?: string; kontaktId?: string } | null; vorname?: string; nachname?: string; ohneEmpfaenger?: string; vorschlaege: string[]; gesellschaft: string; gesendetAm: string | null }

/** Willkommensmail: Vorlage der Bibliothek (Schlagwort „willkommen“), Kick-off-Vorschläge, Playbook-Link (C2), dann Senden per Klick. */
export function WillkommenKarte({ daten, oeffnen, setOeffnen, onMeldung, haupt }: { daten: FallAntwort; oeffnen: boolean; setOeffnen: (b: boolean) => void; onMeldung: (m: FallMeldung) => void; haupt?: boolean }) {
  const m = daten.mandat.id;
  const uhr = daten.onboarding!.willkommen;
  const [g, setG] = useState<WillkommenGrundlage | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkAus, setLinkAus] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<MailEntwurf | null>(null);
  const laden = async () => {
    const a = await holeJson<WillkommenGrundlage>(`/api/fulfillment/fall?m=${encodeURIComponent(m)}&willkommen=1`);
    if (a.ok) setG(a.j); else onMeldung({ text: fehlerText(a), art: 'kritisch' });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Öffnen laden
  useEffect(() => { if (oeffnen && !g) void laden(); }, [oeffnen]);
  const gesendet = daten.fall?.onboarding.willkommenGesendetAm;
  const geruest = async () => {
    if (!g) return;
    const a = await vorlagenOps([{ op: 'baustein', eintrag: { art: 'mail', titel: `Willkommen (${g.anrede})`, text: WILLKOMMEN_GERUEST[g.anrede], tags: [TAG_WILLKOMMEN, g.anrede.toLowerCase()], wer: 'intern' } }]);
    if (a.ok) await laden(); else onMeldung({ text: fehlerText(a), art: 'kritisch' });
  };
  const linkAnlegen = async () => {
    // Paket C2: Kunden-Link anlegen — das Token steht genau einmal in der Antwort (`url` bzw. `pfad`, gelesen NUR über `linkAdresseAus`).
    // Bei ausgeschaltetem Schalter (409): kein Absatz zum Playbook.
    const a = await holeJson<{ url?: string; pfad?: string }>('/api/fulfillment/kunde', { method: 'POST', body: JSON.stringify({ aktion: 'link-anlegen', mandatId: m }) });
    const url = a.ok ? linkAdresseAus(a.j, window.location.origin) : null;
    if (url) setLink(url); else setLinkAus(a.ok ? 'Der Link kam ohne Adresse zurück.' : fehlerText(a));
  };
  const vorbereiten = () => {
    if (!g?.vorlage) return;
    const mail = willkommenMail(g.vorlage.text, { anrede: g.anrede, ...(g.vorname ? { vorname: g.vorname } : {}), ...(g.nachname ? { nachname: g.nachname } : {}), kickoffVorschlaege: g.vorschlaege, ...(link ? { playbookLink: link } : {}) });
    setEntwurf({ ...mail, an: g.an, gesellschaft: g.gesellschaft });
  };
  const vermerken = async () => { const a = await fallOps(m, [{ op: 'willkommen-gesendet' }]); onMeldung(a.ok ? { text: 'Willkommensmail als gesendet vermerkt.', art: 'gut' } : { text: fehlerText(a), art: 'kritisch' }); };
  return (
    <Karte i={1} id="willkommen" akzent={uhr.ueberfaellig ? LEUCHT.kritisch : LEUCHT.achtung}>
      <Ueberschrift erklaerung="fulfillment.willkommen24h" rechts={gesendet ? <Chip farbe={LEUCHT.gut}>gesendet {tagKurz(gesendet)}</Chip> : uhr.ueberfaellig ? <Chip farbe={LEUCHT.kritisch}>überfällig</Chip> : uhr.faellig ? <Chip farbe={LEUCHT.achtung}>bis {tagKurz(uhr.faellig)}</Chip> : undefined}>Willkommensmail</Ueberschrift>
      {gesendet ? <div style={klein}>Die Willkommensmail ist raus. <Knopf leise onClick={async () => { await fallOps(m, [{ op: 'willkommen-gesendet', zuruecknehmen: true }]); }}>Vermerk zurücknehmen</Knopf></div> : !oeffnen ? (
        <Leiste>
          <Knopf haupt={haupt} onClick={() => setOeffnen(true)}>Mail vorbereiten</Knopf>
          <Knopf leise onClick={vermerken}>Schon anders gesendet — vermerken</Knopf>
          {uhr.ueberfaellig && <span style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>überfällig — bitte heute senden</span>}
        </Leiste>
      ) : !g ? <div style={klein}>Lädt …</div> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {g.ohneEmpfaenger && <Hinweis art="achtung">{g.ohneEmpfaenger}</Hinweis>}
          {!g.vorlage ? (
            <Hinweis art="info" titel="Noch keine Willkommens-Vorlage" aktion={<Knopf leise onClick={geruest}>Vorlage aus Gerüst anlegen</Knopf>}>
              Die Vorlage ist ein Baustein der Bibliothek (Art „Mail“, Schlagwort „willkommen“) mit den Platzhaltern {'{{anrede}}'}, {'{{kickoff_vorschlaege}}'} und {'{{playbook_link}}'}.
            </Hinweis>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={MIKRO}>Kick-off-Vorschläge (freie Zeiten, nur Zeiten)</span>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{g.vorschlaege.length ? g.vorschlaege.join(' · ') : 'Keine freien Zeiten gefunden — im Text von Hand ergänzen.'}</span>
              </div>
              <Leiste>
                {link ? <Chip farbe={LEUCHT.gut}>Playbook-Link angelegt</Chip> : linkAus ? <Chip farbe={C.inkLeise}>Playbook-Link: aus</Chip> : <Knopf leise onClick={linkAnlegen}>Playbook-Link anlegen</Knopf>}
                <Knopf onClick={vorbereiten}>Mail ansehen und senden</Knopf>
              </Leiste>
              {linkAus && <div style={klein}>Ohne Kunden-Link fällt der Absatz zum Playbook weg ({linkAus}).</div>}
            </>
          )}
        </div>
      )}
      {entwurf && <MailSenden titel="Willkommensmail senden" entwurf={entwurf} onZu={() => setEntwurf(null)} onGesendet={async () => { await fallOps(m, [{ op: 'willkommen-gesendet' }]); setOeffnen(false); }} />}
    </Karte>
  );
}

/**
 * Aus der Analyse (12.10., „keine losen Enden“): was die geprüfte Diagnose (nach F2) für den Fall liefert und noch nicht drin ist — Quick Wins, Kick-off-
 * Fragen, Maßnahmen (Zusatz-Schritte der Phase nach der Diagnose). Ein Klick je Teil. Ohne Dossier/Diagnose: nichts. Seit 17.10. an der Analyse-Phase.
 */
export function AusAnalyse({ daten, onMeldung }: { daten: FallAntwort; onMeldung: (m: FallMeldung) => void }) {
  const a = daten.analyse;
  const [laeuft, setLaeuft] = useState<NachFallWas | null>(null);
  if (!a || !a.diagnose) return null;
  const offen = a.quickWins.length + a.fragen + a.massnahmen.length;
  if (a.f2 && !offen) return null;
  const tun = async (was: NachFallWas) => { setLaeuft(was); const f = await inDenFall(daten.mandat.id, was); setLaeuft(null); onMeldung(f ? { text: f, art: 'kritisch' } : { text: NACH_FALL_TEXT[was], art: 'gut' }); };
  return (
    <Karte i={2} id="ausanalyse" akzent={LEUCHT.agenten}>
      <Ueberschrift farbe={LEUCHT.agenten} erklaerung="fulfillment.ausAnalyse" rechts={<span>{offen}</span>}>Aus der Analyse</Ueberschrift>
      {!a.f2 ? (
        <Hinweis art="info">Der Diagnose-Entwurf liegt vor — erst das Dossier prüfen („Dossier geprüft“, unten unter Recht & Prüfung), dann gehen Quick Wins, Fragen und Maßnahmen per Klick in den Fall.</Hinweis>
      ) : (
        <Liste>
          {a.quickWins.length > 0 && <Zeile umbrechen titel={`${a.quickWins.length} Quick Win${a.quickWins.length === 1 ? '' : 's'}`} unter={a.quickWins.join(' · ')} rechts={<Knopf leise aus={!!laeuft} onClick={() => tun('quickwins')}>Übernehmen</Knopf>} />}
          {a.fragen > 0 && <Zeile umbrechen titel={`${a.fragen} Frage${a.fragen === 1 ? '' : 'n'} fürs Kick-off`} unter="an Entscheider, Gründer oder Vertrieb — mit dem Warum" rechts={<Knopf leise aus={!!laeuft} onClick={() => tun('fragen')}>Übernehmen</Knopf>} />}
          {a.massnahmen.length > 0 && <Zeile umbrechen titel={`${a.massnahmen.length} Maßnahme${a.massnahmen.length === 1 ? '' : 'n'} der Diagnose`} unter={`als Zusatz-Schritte in „${a.ziel ?? 'die nächste Phase'}“ — zuerst nur intern · ${a.massnahmen.join(' · ')}`} rechts={<Knopf leise aus={!!laeuft} onClick={() => tun('massnahmen')}>In den Ablauf</Knopf>} />}
        </Liste>
      )}
    </Karte>
  );
}

/** Quick Wins (30 Tage) und erste Erfolge — erledigte zuerst als Erfolg, darunter „Neuer Quick Win“. */
export function QuickWins({ daten, ops }: { daten: FallAntwort; ops: Ops }) {
  const [text, setText] = useState('');
  const [bis, setBis] = useState('');
  const f = daten.fall!;
  const liste = [...f.quickWins].sort((a, b) => (a.erledigtAm ? 0 : 1) - (b.erledigtAm ? 0 : 1));
  return (
    <Karte i={3} id="quickwins">
      <Ueberschrift erklaerung="fulfillment.quickWins" rechts={<span>{f.quickWins.filter(q => q.erledigtAm).length} von {f.quickWins.length} erreicht</span>}>Quick Wins &amp; erste Erfolge</Ueberschrift>
      {liste.length > 0 && (
        <Liste>
          {liste.map(q => (
            <Zeile key={q.id} links={<HakenZiel an={!!q.erledigtAm} onChange={() => ops([{ op: 'quickwin', id: q.id, erledigt: !q.erledigtAm }])} label={q.text} />} titel={q.text} umbrechen
              unter={`${q.erledigtAm ? `erreicht ${tagKurz(q.erledigtAm)}` : `bis ${tagKurz(q.bis)}`}${q.quelle === 'analyse' ? ' · aus der Analyse' : ''}`} rechts={<Knopf leise ariaLabel="entfernen" onClick={() => ops([{ op: 'quickwin', id: q.id, weg: true }])}>×</Knopf>} />
          ))}
        </Liste>
      )}
      <form onSubmit={e => { e.preventDefault(); if (text.trim()) void ops([{ op: 'quickwins-setzen', quickWins: [{ text: text.trim(), ...(bis ? { bis } : {}), quelle: 'hand' }] }]).then(() => { setText(''); setBis(''); }); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Neuer Quick Win" aria-label="Neuer Quick Win" style={{ ...feld, flex: '1 1 220px', minWidth: 0 }} />
        <input type="date" value={bis} onChange={e => setBis(e.target.value)} aria-label="bis" style={{ ...feld, flex: '0 0 170px', width: 170 }} />
        <Knopf typ="submit" aus={!text.trim()}>Hinzufügen</Knopf>
      </form>
    </Karte>
  );
}

const AN = [{ id: 'entscheider' as const, label: 'an Entscheider' }, { id: 'gruender' as const, label: 'an Gründer' }, { id: 'vertrieb' as const, label: 'an Vertrieb' }];
/** Fragen fürs Kick-off — das Detail des Termins „Kick-off“ in der Reise. */
export function KickoffFragen({ daten, ops }: { daten: FallAntwort; ops: Ops }) {
  const [frage, setFrage] = useState('');
  const [an, setAn] = useState<'entscheider' | 'gruender' | 'vertrieb'>('entscheider');
  const f = daten.fall!;
  return (
    <Karte i={2}>
      <Ueberschrift rechts={<span>{f.kickoffFragen.filter(q => q.erledigt).length} von {f.kickoffFragen.length}</span>}>Fragen fürs Kick-off</Ueberschrift>
      {f.kickoffFragen.length > 0 && (
        <Liste>
          {f.kickoffFragen.map(q => (
            <Zeile key={q.id} links={<HakenZiel an={!!q.erledigt} onChange={() => ops([{ op: 'kickoff-frage', id: q.id, erledigt: !q.erledigt }])} label={q.frage} />} titel={q.frage} umbrechen
              unter={`${AN.find(x => x.id === q.an)?.label ?? ''}${q.warum ? ` · ${q.warum}` : ''}${q.quelle === 'analyse' ? ' · aus der Analyse' : ''}`} rechts={<Knopf leise ariaLabel="entfernen" onClick={() => ops([{ op: 'kickoff-frage', id: q.id, weg: true }])}>×</Knopf>} />
          ))}
        </Liste>
      )}
      <form onSubmit={e => { e.preventDefault(); if (frage.trim()) void ops([{ op: 'kickoff-fragen', fragen: [{ frage: frage.trim(), an, quelle: 'hand' }] }]).then(() => setFrage('')); }} style={{ display: 'grid', gap: 8 }}>
        <input value={frage} onChange={e => setFrage(e.target.value)} placeholder="Neue Frage" aria-label="Neue Frage" style={feld} />
        <Leiste><Pillen liste={AN} aktiv={an} onWahl={setAn} /><Knopf typ="submit" aus={!frage.trim()}>Hinzufügen</Knopf></Leiste>
      </form>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Den Termin legt ihr unter <Link href={WEG.fall(daten.mandat.id, 'menschen', 'stelle-takt-leiste')} style={{ color: C.aktiv }}>Menschen &amp; Termine</Link> an.</div>
    </Karte>
  );
}
