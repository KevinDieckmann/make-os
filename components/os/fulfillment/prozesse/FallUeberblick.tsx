'use client';

// ─── Fulfillment › Fall › Überblick (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 3.2, 7.2, 1.3) ──────────────────────────────────────────
// Kopf (Fortschritt, aktuelle Phase, wartet auf euch, Status), „Vorlage geändert“ mit Übernehmen, die acht Onboarding-Schritte (Stand
// abgeleitet, je mit Sprung dorthin, wo man ihn erfüllt), die Willkommensmail (Vorlage der Bibliothek, drei freie Kick-off-Zeiten, Playbook-Link
// aus C2 — gesendet nur per Klick), „wartet auf euch“, Quick Wins und Kick-off-Fragen. Ohne Fall: „Onboarding starten“.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Zeile, Chip, Punkt, Raster, Kennzahl, Pillen, HakenZiel, Erklaert, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { willkommenMail, WILLKOMMEN_GERUEST, TAG_WILLKOMMEN, obKnotenId } from '@/lib/fulfillment/prozesse/onboarding';
import type { OnboardingSchluessel } from '@/lib/fulfillment/muster';
import { linkAdresseAus } from '@/lib/fulfillment/kunde/link';
import type { FallReiter } from '@/lib/fulfillment/adresse';
import { useFall, useUebersichtKurz, fallOps, fallAktion, vorlagenOps, holeJson, fehlerText, tagKurz, type FallAntwort } from './daten';
import { StartDialog } from './Onboarding';
import { MailSenden, type MailEntwurf } from './MailSenden';
import { klein, feld, Leiste, Meldung, useTextFrage } from './teile';

const SPRUNG: Record<OnboardingSchluessel, { reiter: FallReiter; text: string }> = {
  willkommen: { reiter: 'ueberblick', text: 'Mail vorbereiten' }, kickoff: { reiter: 'takt', text: 'Kick-off terminieren' }, vereinbarung: { reiter: 'menschen', text: 'Vereinbarung' },
  playbook: { reiter: 'kunde', text: 'Kunden-Link' }, stakeholder: { reiter: 'menschen', text: 'Stakeholder' }, wertkonto: { reiter: 'wert', text: 'Wert-Konto' },
  entscheidungslog: { reiter: 'menschen', text: 'Entscheidungen' }, f0: { reiter: 'ablauf', text: 'Freigabe vermerken' },
};
const STATUS = [{ id: 'laeuft' as const, label: 'läuft' }, { id: 'pausiert' as const, label: 'pausiert' }, { id: 'abgeschlossen' as const, label: 'abgeschlossen' }];

export function FallUeberblick({ mandatId }: { mandatId: string }) {
  const router = useRouter();
  const { daten, fehler } = useFall(mandatId);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'achtung' } | null>(null);
  const [mail, setMail] = useState(false);
  const frage = useTextFrage();
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
      <Raster min={160}>
        <Kennzahl wert={`${daten.fortschritt ?? 0} %`} label="Fortschritt" erklaerung="fulfillment.fortschritt" />
        <Kennzahl wert={daten.aktuell?.phase?.titel ?? '—'} label="Aktuelle Phase" unter={daten.aktuell?.schritt?.titel} />
        <Kennzahl wert={String(daten.wartet?.length ?? 0)} label="Wartet auf euch" unter={daten.wartet?.[0]?.tage ? `ältester ${daten.wartet[0].tage} Tage` : undefined} erklaerung="fulfillment.wartetAufEuch" />
        <Kennzahl wert={daten.vorlage?.titel ?? '—'} label="Paket" unter={`Fassung ${f.vorlageFassung}`} />
      </Raster>
      <Karte i={1} akzent={ob.fertig ? LEUCHT.gut : LEUCHT.planung}>
        <Ueberschrift farbe={ob.fertig ? LEUCHT.gut : LEUCHT.planung} rechts={<span>{ob.fertig ? 'fertig' : `${ob.offen} offen`}</span>}>Onboarding</Ueberschrift>
        <Liste>
          {ob.schritte.map(s => (
            <Zeile key={s.schluessel} umbrechen links={<Punkt farbe={s.erfuellt || s.entfaellt ? LEUCHT.gut : s.ueberfaellig ? LEUCHT.kritisch : s.zaehlt ? LEUCHT.achtung : C.inkLeise} />}
              titel={<span>{s.titel}{!s.zaehlt && <span style={{ color: C.inkLeise }}> · darf noch laufen</span>}</span>} unter={s.text}
              rechts={<Leiste>
                {!s.erfuellt && (s.schluessel === 'willkommen' ? <Knopf leise onClick={() => setMail(true)}>Mail vorbereiten</Knopf> : <Knopf leise onClick={() => router.push(WEG.fall(mandatId, SPRUNG[s.schluessel].reiter), { scroll: false })}>{SPRUNG[s.schluessel].text} ›</Knopf>)}
                {!s.erfuellt && <Knopf leise onClick={() => entfaellt(s.schluessel)}>{s.entfaellt ? 'wieder offen' : 'entfällt'}</Knopf>}
              </Leiste>} />
          ))}
        </Liste>
      </Karte>
      <WillkommenKarte daten={daten} oeffnen={mail} setOeffnen={setMail} onMeldung={setMeldung} />
      {(daten.wartet?.length ?? 0) > 0 && (
        <Karte i={2}>
          <Ueberschrift erklaerung="fulfillment.wartetAufEuch" rechts={<span>{daten.wartet!.length}</span>}>Wartet auf euch</Ueberschrift>
          <Liste>{daten.wartet!.map(w => <Zeile key={w.id} titel={w.titel} unter={`${w.art === 'entscheidung' ? 'Entscheidung' : w.art === 'freigabe' ? 'Freigabe' : 'Schritt'}${w.tage !== undefined ? ` · seit ${w.tage} Tagen` : ''}`} />)}</Liste>
        </Karte>
      )}
      <QuickWins daten={daten} ops={ops} />
      <KickoffFragen daten={daten} ops={ops} />
      <Karte i={5}>
        <Ueberschrift>Status des Falls</Ueberschrift>
        <Pillen liste={STATUS} aktiv={f.status === 'onboarding' ? null : f.status} onWahl={status => ops([{ op: 'fall-status', status }])} />
        <div style={klein}>Gestartet am {tagKurz(f.gestartetAm)}{daten.unterschrift ? ` · Unterschrift ${tagKurz(daten.unterschrift.am)}` : ''}. Im Onboarding wechselt der Fall von selbst auf „läuft“, sobald die Schritte erfüllt sind.</div>
      </Karte>
      {frage.dialog}
    </div>
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
    <Karte i={1} akzent={uhr.ueberfaellig ? LEUCHT.kritisch : LEUCHT.gut}>
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
                <Knopf haupt onClick={vorbereiten}>Mail ansehen und senden</Knopf>
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

function QuickWins({ daten, ops }: { daten: FallAntwort; ops: (o: Record<string, unknown>[]) => Promise<void> }) {
  const [text, setText] = useState('');
  const [bis, setBis] = useState('');
  const f = daten.fall!;
  return (
    <Karte i={3}>
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
