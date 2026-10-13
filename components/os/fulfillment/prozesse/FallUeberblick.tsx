'use client';

// ─── Fulfillment › Fall › Überblick (Paket C1, 10.10.; neu gezeichnet 11.10. — FULFILLMENT_KONZEPT.md 3.2, 7.2, 1.3) ───────────────────
// Über dem Reiter steht der Kopf des Falls (components/os/fulfillment/reise/FallKopf.tsx: Phasen-Strahl, „Als Nächstes“, „Hängt etwas?“ und die
// eine Hauptaktion). Hier darunter nur, was im Überblick zu tun ist: das Onboarding als Band (grün/gelb/rot) mit NUR den offenen Schritten
// (jeder mit Sprung dorthin, wo er erfüllt wird; „entfällt“ hinter „⋯“, erledigte klappen weg), die Willkommensmail solange sie fehlt (Vorlage
// der Bibliothek, drei freie Kick-off-Zeiten, Playbook-Link aus C2 — gesendet nur per Klick), „wartet auf euch“, Quick Wins, Kick-off-Fragen,
// Status. „Vorlage geändert“ mit Übernehmen bleibt oben. Ohne Fall: „Onboarding starten“.
// 12.10. (kundenreif): „Aus der Analyse“ — was die geprüfte Diagnose noch für den Fall hat (Quick Wins, Fragen, Maßnahmen), je ein Klick.

import { useEffect, useState, type ReactNode } from 'react';
import { FARBE as C, TYP, MIKRO, TIEF, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Zeile, Chip, Punkt, Pillen, HakenZiel, Erklaert, ZeileAktionen, LEUCHT, useHandy } from '../../ui';
import { willkommenMail, WILLKOMMEN_GERUEST, TAG_WILLKOMMEN, obKnotenId, type OnboardingSchrittStand } from '@/lib/fulfillment/prozesse/onboarding';
import { ONBOARDING_SPRUNG, seitTagen } from '@/lib/fulfillment/prozesse/reise';
import type { OnboardingSchluessel } from '@/lib/fulfillment/muster';
import { linkAdresseAus } from '@/lib/fulfillment/kunde/link';
import { useFall, useUebersichtKurz, fallOps, fallAktion, vorlagenOps, holeJson, fehlerText, tagKurz, type FallAntwort } from './daten';
import { StartDialog } from './Onboarding';
import { MailSenden, type MailEntwurf } from './MailSenden';
import { klein, feld, Leiste, Meldung, useTextFrage } from './teile';
import { useFallSprung } from '../reise/FallKopf';
import { useSprung, insBild } from '../reise/sprung';
import { inDenFall, NACH_FALL_TEXT, type NachFallWas } from '../analyse/daten';
import { WEG } from '@/lib/wege';

const STATUS = [{ id: 'laeuft' as const, label: 'läuft' }, { id: 'pausiert' as const, label: 'pausiert' }, { id: 'abgeschlossen' as const, label: 'abgeschlossen' }];
const schrittFarbe = (s: OnboardingSchrittStand) => (s.erfuellt || s.entfaellt ? LEUCHT.gut : s.ueberfaellig ? LEUCHT.kritisch : s.zaehlt ? LEUCHT.achtung : C.inkLeise);

export function FallUeberblick({ mandatId }: { mandatId: string }) {
  const { daten, fehler } = useFall(mandatId);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'achtung' } | null>(null);
  const [mail, setMail] = useState(false);
  const frage = useTextFrage();
  const geh = useFallSprung(mandatId, 'ueberblick');
  useSprung(s => { if (s.art === 'willkommen') { setMail(true); insBild('willkommen'); } if (s.art === 'stelle') insBild(s.wert); });
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  if (!daten.fall) return <KeinFall daten={daten} />;
  const f = daten.fall, ob = daten.onboarding!;
  const ops = async (o: Record<string, unknown>[]) => {
    const a = await fallOps(mandatId, o);
    if (!a.ok) setMeldung({ text: fehlerText(a), art: 'kritisch' });
    else if (a.j.nachzug?.fehler) setMeldung({ text: `Gespeichert, aber nicht nachgezogen: ${a.j.nachzug.fehler}`, art: 'achtung' });
    else setMeldung(null);
  };
  const entfaellt = async (s: OnboardingSchluessel) => {
    const k = f.knoten.find(x => x.id === obKnotenId(s));
    if (!k) return;
    if (k.status === 'entfaellt') { await ops([{ op: 'knoten-status', id: k.id, status: 'offen', stand: k.stand }]); return; }
    const grund = await frage.fragen('Warum entfällt dieser Schritt?');
    if (grund) await ops([{ op: 'knoten-status', id: k.id, status: 'entfaellt', grund, stand: k.stand }]);
  };
  const zuSchritt = (s: OnboardingSchluessel) => {
    if (s === 'willkommen') { setMail(true); insBild('willkommen'); return; }
    if (s === 'f0') { geh('ablauf', { art: 'freigabe', wert: 'F0' }); return; }
    geh(ONBOARDING_SPRUNG[s].reiter);
  };
  const gesendet = f.onboarding.willkommenGesendetAm;
  const kickoffOffen = f.kickoffFragen.some(q => !q.erledigt);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Meldung text={meldung?.text ?? null} art={meldung?.art} />
      {meldung?.art === 'achtung' && <div><Knopf leise onClick={async () => { const a = await fallAktion({ aktion: 'nachziehen', mandatId }); setMeldung(a.ok ? null : { text: fehlerText(a), art: 'kritisch' }); }}>Erneut nachziehen</Knopf></div>}
      {daten.diff && (daten.diff.neu.length + daten.diff.geaendert.length) > 0 && (
        <Hinweis art="info" titel={`Vorlage geändert (Fassung ${daten.diff.von} → ${daten.diff.nach})`}
          aktion={<Erklaert erklaerung="fulfillment.vorlageDiff" name="Vorlage übernehmen"><Knopf leise onClick={async () => { const a = await fallAktion({ aktion: 'vorlage-uebernehmen', mandatId }); setMeldung(a.ok ? { text: 'Neue Fassung übernommen — erledigte Schritte bleiben, wie sie sind.', art: 'gut' } : { text: fehlerText(a), art: 'kritisch' }); }}>Übernehmen</Knopf></Erklaert>}>
          {daten.diff.neu.length} neu · {daten.diff.geaendert.length} geändert{daten.diff.entfernt.length ? ` · ${daten.diff.entfernt.length} in der Vorlage entfernt (bleiben im Fall)` : ''}
        </Hinweis>
      )}
      <OnboardingKarte schritte={ob.schritte} fertig={ob.fertig} gesendetAm={gesendet} onSchritt={zuSchritt} onEntfaellt={entfaellt}
        onWillkommenZurueck={async () => { await fallOps(mandatId, [{ op: 'willkommen-gesendet', zuruecknehmen: true }]); }} />
      {!gesendet && <WillkommenKarte daten={daten} oeffnen={mail} setOeffnen={setMail} onMeldung={setMeldung} />}
      {(daten.wartet?.length ?? 0) > 0 && (
        <Karte i={2} akzent={LEUCHT.achtung}>
          <Ueberschrift farbe={LEUCHT.achtung} erklaerung="fulfillment.wartetAufEuch" rechts={<span>{daten.wartet!.length}</span>}>Wartet auf euch</Ueberschrift>
          <Liste>{daten.wartet!.map(w => (
            <Zeile key={w.id} umbrechen links={<Punkt farbe={(w.tage ?? 0) > 7 ? LEUCHT.kritisch : LEUCHT.achtung} />} titel={w.titel}
              unter={w.art === 'entscheidung' ? 'Entscheidung des Kunden' : w.art === 'freigabe' ? 'Freigabe des Kunden' : 'Schritt beim Kunden'}
              rechts={w.tage !== undefined ? <Chip farbe={(w.tage ?? 0) > 7 ? LEUCHT.kritisch : C.inkDim}>{seitTagen(w.tage)}</Chip> : undefined}
              onClick={() => geh(w.art === 'entscheidung' ? 'menschen' : 'ablauf')} />
          ))}</Liste>
        </Karte>
      )}
      <AusAnalyse daten={daten} onMeldung={setMeldung} />
      <QuickWins daten={daten} ops={ops} />
      {(!ob.fertig || kickoffOffen || !f.kickoffFragen.length) ? <KickoffFragen daten={daten} ops={ops} /> : <KickoffZu anzahl={f.kickoffFragen.length}><KickoffFragen daten={daten} ops={ops} /></KickoffZu>}
      <Karte i={5} flach>
        <Ueberschrift>Status des Falls</Ueberschrift>
        <Pillen liste={STATUS} aktiv={f.status === 'onboarding' ? null : f.status} onWahl={status => ops([{ op: 'fall-status', status }])} />
        <div style={klein}>Gestartet am {tagKurz(f.gestartetAm)}{daten.unterschrift ? ` · Unterschrift ${tagKurz(daten.unterschrift.am)}` : ''} — im Onboarding wechselt der Fall von selbst auf „läuft“, sobald die Schritte erfüllt sind.</div>
      </Karte>
      {frage.dialog}
    </div>
  );
}

/** Nach dem Onboarding sind die Kick-off-Fragen erledigt — sie klappen weg, ein Tipp holt sie zurück. */
function KickoffZu({ anzahl, children }: { anzahl: number; children: ReactNode }) {
  const [auf, setAuf] = useState(false);
  return auf ? <>{children}</> : <div><Knopf leise onClick={() => setAuf(true)}>Fragen fürs Kick-off zeigen ({anzahl}, alle erledigt)</Knopf></div>;
}

/**
 * Das Onboarding als Band: je Schritt ein Abschnitt (grün erfüllt, gelb offen, rot überfällig, grau gestrichelt „darf noch laufen“), darunter
 * NUR die offenen Schritte mit ihrem Weg; Erledigte klappen weg („n erledigt — zeigen“). „entfällt“, „wieder offen“, „Vermerk zurücknehmen“ hinter „⋯“.
 */
function OnboardingKarte({ schritte, fertig, gesendetAm, onSchritt, onEntfaellt, onWillkommenZurueck }: {
  schritte: OnboardingSchrittStand[]; fertig: boolean; gesendetAm?: string; onSchritt: (s: OnboardingSchluessel) => void; onEntfaellt: (s: OnboardingSchluessel) => Promise<void>; onWillkommenZurueck: () => Promise<void>;
}) {
  const [zeigen, setZeigen] = useState(false);
  const handy = useHandy();
  const erledigt = schritte.filter(s => s.erfuellt || s.entfaellt);
  const offen = schritte.filter(s => !s.erfuellt && !s.entfaellt);
  const farbe = fertig ? LEUCHT.gut : offen.some(s => s.ueberfaellig) ? LEUCHT.kritisch : LEUCHT.planung;
  return (
    <Karte i={1} akzent={farbe}>
      <Ueberschrift farbe={farbe} erklaerung="fulfillment.onboardingBand" rechts={<span>{erledigt.length} von {schritte.length}</span>}>Onboarding</Ueberschrift>
      <ol aria-label="Onboarding-Schritte" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, schritte.length)}, minmax(0, 1fr))`, gap: handy ? 4 : 8 }}>
        {schritte.map(s => {
          const f = schrittFarbe(s);
          const voll = s.erfuellt || s.entfaellt;
          return (
            <li key={s.schluessel} style={{ minWidth: 0 }}>
              <button type="button" className="fassbar" onClick={() => (voll ? setZeigen(true) : onSchritt(s.schluessel))} aria-label={`${s.titel}: ${voll ? (s.entfaellt ? 'entfällt' : 'erfüllt') : s.ueberfaellig ? 'überfällig' : 'offen'}`}
                style={{ display: 'grid', gap: 6, alignContent: 'start', width: '100%', minHeight: 44, padding: '6px 2px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text }}>
                <span style={{ display: 'block', height: 8, borderRadius: 4, background: voll || s.zaehlt ? TIEF.verlauf(f) : 'transparent', opacity: voll ? 1 : 0.6, border: s.zaehlt || voll ? 'none' : `1px dashed ${C.inkLeise}` }} />
                {!handy && <span style={{ fontSize: TYP.bedien, lineHeight: 1.3, color: voll ? C.inkDim : C.ink, overflowWrap: 'anywhere' }}>{voll ? '✓ ' : ''}{s.titel}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {fertig && !offen.length && <div style={klein}>Onboarding fertig — alle Schritte sind erfüllt.</div>}
      {offen.length > 0 && (
        <Liste>
          {offen.map(s => (
            <ZeileAktionen key={s.schluessel} titel={s.titel} mehr={[{ id: 'entfaellt', label: 'Entfällt für diesen Fall …', hinweis: 'Mit Grund — der Schritt zählt dann nicht mehr.', tun: () => onEntfaellt(s.schluessel) }]}>
              <Zeile umbrechen links={<Punkt farbe={schrittFarbe(s)} />}
                titel={<span>{s.titel}{!s.zaehlt && <span style={{ color: C.inkLeise }}> · darf noch laufen</span>}</span>} unter={s.text}
                rechts={<Knopf leise onClick={() => onSchritt(s.schluessel)}>{ONBOARDING_SPRUNG[s.schluessel].text}{s.schluessel === 'willkommen' ? '' : ' ›'}</Knopf>} />
            </ZeileAktionen>
          ))}
        </Liste>
      )}
      {erledigt.length > 0 && <div><Knopf leise onClick={() => setZeigen(!zeigen)}>{zeigen ? 'Erledigte ausblenden' : `${erledigt.length} erledigt — zeigen`}</Knopf></div>}
      {zeigen && erledigt.length > 0 && (
        <Liste>
          {erledigt.map(s => (
            <ZeileAktionen key={s.schluessel} titel={s.titel} mehr={[
              ...(s.entfaellt ? [{ id: 'offen', label: 'Wieder offen', tun: () => onEntfaellt(s.schluessel) }] : []),
              ...(s.schluessel === 'willkommen' && gesendetAm ? [{ id: 'zurueck', label: 'Vermerk „gesendet“ zurücknehmen', tun: onWillkommenZurueck }] : []),
            ]}>
              <Zeile umbrechen links={<Punkt farbe={LEUCHT.gut} />} titel={<span style={{ color: C.inkDim, textDecoration: s.entfaellt ? 'line-through' : 'none' }}>{s.titel}</span>}
                unter={s.schluessel === 'willkommen' && gesendetAm ? `Willkommensmail gesendet am ${tagKurz(gesendetAm)}` : s.text} />
            </ZeileAktionen>
          ))}
        </Liste>
      )}
      <span style={{ ...MIKRO }}>Grün erfüllt · Gelb offen · Rot überfällig · Gestrichelt darf noch laufen</span>
    </Karte>
  );
}

function KeinFall({ daten }: { daten: FallAntwort }) {
  const kurz = useUebersichtKurz();
  const [start, setStart] = useState(false);
  const pakete = (kurz.daten?.prozesse ?? []).filter(p => p.art === 'paket');
  const zu = daten.mandat.leistungId ? kurz.daten?.zuordnung[daten.mandat.leistungId]?.vorlageId : undefined;
  const v = pakete.find(p => p.id === zu);
  if (!daten.mandat.business) return <Hinweis art="info">Fulfillment gibt es nur für Mandate einer Business-Gesellschaft — dieses Mandat gehört zu Privat.</Hinweis>;
  return (
    <Karte i={1}>
      <Ueberschrift>Noch kein Fall</Ueberschrift>
      <div style={klein}>Für „{daten.mandat.titel}“ läuft noch kein Fulfillment. Der Fall kopiert die Struktur der Paket-Vorlage und legt die Onboarding-Schritte an — Mandate ohne Fall bleiben genau wie bisher.</div>
      <div><Knopf haupt onClick={() => setStart(true)}>Onboarding starten</Knopf></div>
      {start && <StartDialog k={{ mandatId: daten.mandat.id, kunde: daten.mandat.kunde, ...(v ? { vorlage: { id: v.id, titel: v.titel } } : {}) }} pakete={pakete} onZu={() => setStart(false)} />}
    </Karte>
  );
}

interface WillkommenGrundlage { anrede: 'Du' | 'Sie'; vorlage: { id: string; titel: string; text: string } | null; an: { email: string; name?: string } | null; vorname?: string; nachname?: string; ohneEmpfaenger?: string; vorschlaege: string[]; gesellschaft: string; gesendetAm: string | null }

/** Willkommensmail: Vorlage der Bibliothek (Schlagwort „willkommen“), Kick-off-Vorschläge, Playbook-Link (C2), dann Senden per Klick. */
function WillkommenKarte({ daten, oeffnen, setOeffnen, onMeldung }: { daten: FallAntwort; oeffnen: boolean; setOeffnen: (b: boolean) => void; onMeldung: (m: { text: string; art: 'gut' | 'kritisch' } | null) => void }) {
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
    <Karte i={1} id="willkommen" akzent={uhr.ueberfaellig ? LEUCHT.kritisch : LEUCHT.gut}>
      <Ueberschrift erklaerung="fulfillment.willkommen24h" rechts={gesendet ? <Chip farbe={LEUCHT.gut}>gesendet {tagKurz(gesendet)}</Chip> : uhr.ueberfaellig ? <Chip farbe={LEUCHT.kritisch}>überfällig</Chip> : uhr.faellig ? <Chip farbe={LEUCHT.achtung}>bis {tagKurz(uhr.faellig)}</Chip> : undefined}>Willkommen</Ueberschrift>
      {gesendet ? <div style={klein}>Die Willkommensmail ist raus. <Knopf leise onClick={async () => { await fallOps(m, [{ op: 'willkommen-gesendet', zuruecknehmen: true }]); }}>Vermerk zurücknehmen</Knopf></div> : !oeffnen ? (
        <Leiste>
          <Knopf onClick={() => setOeffnen(true)}>Mail vorbereiten</Knopf>
          <Knopf leise onClick={vermerken}>Schon anders gesendet — vermerken</Knopf>
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
 * Fragen, Maßnahmen (Zusatz-Schritte der Phase nach der Diagnose). Ein Klick je Teil; vorher stand das nur im Dossier. Ohne Dossier/Diagnose: nichts.
 */
function AusAnalyse({ daten, onMeldung }: { daten: FallAntwort; onMeldung: (m: { text: string; art: 'gut' | 'kritisch' | 'achtung' } | null) => void }) {
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
        <Hinweis art="info" aktion={<Knopf leise href={WEG.dossier(daten.mandat.id)}>Zum Dossier ›</Knopf>}>Der Diagnose-Entwurf liegt vor — erst das Dossier prüfen (F2), dann gehen Quick Wins, Fragen und Maßnahmen per Klick in den Fall.</Hinweis>
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

function QuickWins({ daten, ops }: { daten: FallAntwort; ops: (o: Record<string, unknown>[]) => Promise<void> }) {
  const [text, setText] = useState('');
  const [bis, setBis] = useState('');
  const f = daten.fall!;
  return (
    <Karte i={3} id="quickwins">
      <Ueberschrift erklaerung="fulfillment.quickWins" rechts={<span>{f.quickWins.filter(q => q.erledigtAm).length} von {f.quickWins.length}</span>}>Quick Wins (30 Tage)</Ueberschrift>
      {f.quickWins.length > 0 && (
        <Liste>
          {f.quickWins.map(q => (
            <Zeile key={q.id} links={<HakenZiel an={!!q.erledigtAm} onChange={() => ops([{ op: 'quickwin', id: q.id, erledigt: !q.erledigtAm }])} label={q.text} />} titel={q.text} umbrechen
              unter={`bis ${tagKurz(q.bis)}${q.erledigtAm ? ` · erledigt ${tagKurz(q.erledigtAm)}` : ''}${q.quelle === 'analyse' ? ' · aus der Analyse' : ''}`} rechts={<Knopf leise ariaLabel="entfernen" onClick={() => ops([{ op: 'quickwin', id: q.id, weg: true }])}>×</Knopf>} />
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
function KickoffFragen({ daten, ops }: { daten: FallAntwort; ops: (o: Record<string, unknown>[]) => Promise<void> }) {
  const [frage, setFrage] = useState('');
  const [an, setAn] = useState<'entscheider' | 'gruender' | 'vertrieb'>('entscheider');
  const f = daten.fall!;
  return (
    <Karte i={4}>
      <Ueberschrift rechts={<span>{f.kickoffFragen.length}</span>}>Fragen fürs Kick-off</Ueberschrift>
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
    </Karte>
  );
}
