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
import { willkommenMail, WILLKOMMEN_GERUEST, TAG_WILLKOMMEN, obKnotenId, type OnboardingSchrittStand } from '@/lib/fulfillment/prozesse/onboarding';
import { fallStartTag } from '@/lib/fulfillment/prozesse/fall';
import type { OnboardingSchluessel } from '@/lib/fulfillment/muster';
import { linkAdresseAus } from '@/lib/fulfillment/kunde/link';
import { useUebersichtKurz, fallOps, fallAktion, vorlagenOps, holeJson, fehlerText, tagKurz, type FallAntwort } from './daten';
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
  const erledigt = schritte.filter(s => s.erfuellt || s.entfaellt);
  return <span>Onboarding {erledigt.filter(s => s.zaehlt).length} von {schritte.filter(s => s.zaehlt).length}</span>;
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
    ]} />
  );
}

/** Die Vorlage des Falls hat eine neue Fassung — übernehmen (erledigte Schritte bleiben). */
export function VorlageGeaendert({ daten, onMeldung }: { daten: FallAntwort; onMeldung: (m: FallMeldung) => void }) {
  if (!daten.diff || !(daten.diff.neu.length + daten.diff.geaendert.length)) return null;
  return (
    <Hinweis art="info" titel={`Vorlage geändert (Fassung ${daten.diff.von} → ${daten.diff.nach})`}
      aktion={<Erklaert erklaerung="fulfillment.vorlageDiff" name="Vorlage übernehmen"><Knopf leise onClick={async () => { const a = await fallAktion({ aktion: 'vorlage-uebernehmen', mandatId: daten.mandat.id }); onMeldung(a.ok ? { text: 'Neue Fassung übernommen — erledigte Schritte bleiben, wie sie sind.', art: 'gut' } : { text: fehlerText(a), art: 'kritisch' }); }}>Übernehmen</Knopf></Erklaert>}>
      {daten.diff.neu.length} neu · {daten.diff.geaendert.length} geändert{daten.diff.entfernt.length ? ` · ${daten.diff.entfernt.length} in der Vorlage entfernt (bleiben im Fall)` : ''}
    </Hinweis>
  );
}

/** Der Status des Falls (läuft · pausiert · abgeschlossen) — ruhig am Ende der Reise. */
export function FallStatus({ daten, ops }: { daten: FallAntwort; ops: Ops }) {
  const f = daten.fall!;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center' }}>
      <span style={{ ...MIKRO }}>Status des Falls</span>
      <Pillen liste={STATUS} aktiv={f.status === 'onboarding' ? null : f.status} onWahl={status => ops([{ op: 'fall-status', status }])} />
      {/* Abnahme B8: der Starttag des Falls (`fallStartTag` — der gewählte, nicht der Tag des Anlegens), Unterschrift zuerst. */}
      <span style={klein}>{daten.unterschrift ? `Unterschrift ${tagKurz(daten.unterschrift.am)} · ` : ''}Fall gestartet {tagKurz(fallStartTag(f))}{f.status === 'onboarding' ? ' · wechselt nach dem Onboarding von selbst auf „läuft“' : ''}</span>
    </div>
  );
}

export function KeinFall({ daten }: { daten: FallAntwort }) {
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
