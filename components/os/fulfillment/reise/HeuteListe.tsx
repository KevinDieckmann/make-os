'use client';

// ─── Fulfillment — „Heute im Fulfillment“: EINE Liste über alle Fälle, der Handgriff direkt in der Zeile (17.10. spät, Branch `ff-einfach`) ──────────────
// Rückmeldung 17.10.: „Ich will, dass das Fulfillment wirklich maximal einfach für uns ist.“ Gemessen (Bericht ~/make-os-demo/einfach-1710): „Was muss ich heute tun?“
// kostete von Heute aus zwei Klicks bis zum Start, dann je Kunde eine Karte lesen und den Fall öffnen; eine Entscheidung fünf Klicks, ein Mail-Entwurf vier. Jetzt:
//   · oben auf dem Fulfillment-Start (Hauptaktion der Seite) und als Karte auf Heute › Business (Widget `fulfillment`) dieselbe Liste;
//   · je Zeile, was zu tun ist (Kunde, Phase, worauf gewartet wird, Frist), der Handgriff rechts: abhaken (Rückgängig 10 s), Ja/Nein, Entwurf öffnen (senden nur per
//     Klick), Fall starten, sonst „öffnen“ an der Stelle im Fall. Ein Tipp auf den Titel springt an die Stelle im Fall.
//   · „Demnächst“ (Punkte mit späterer Frist) zugeklappt darunter — der Tag zeigt nur, was jetzt dran ist.
// Rechnet nichts (lib/fulfillment/prozesse/heute.ts aus dem Cockpit); schreibt nur über die vorhandenen Fall-Ops und den vorhandenen Start-Dialog.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, SCHRIFT, MIKRO } from '@/lib/make-one/design';
import { useIch, usePersonen } from '../../aufgaben/hilfe';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Punkt, Leerzustand, HakenZiel, Klappbar, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { heuteImFulfillment, heuteZahlen, meineHeute, type HeuteEintrag } from '@/lib/fulfillment/prozesse/heute';
import { useCockpit, useUebersichtKurz, fallOps, holeJson, fehlerText, tagKurz, geaendert, startMandat } from '../prozesse/daten';
import { MailSenden, type MailEntwurf } from '../prozesse/MailSenden';
import { StartDialog } from '../prozesse/Onboarding';

interface Grundlage { entwurf: MailEntwurf | null; gesperrt?: string; hinweis?: string; fehler?: string }
type Meldung = { text: string; art: 'gut' | 'kritisch' | 'achtung' | 'info'; zurueck?: () => Promise<void> } | null;

/** Datum in Worten für eine Zeile: „überfällig seit 15.10.“, „bis heute“, „bis 22.10.“. */
function frist(e: HeuteEintrag, heute: string): string | null {
  if (e.seit && e.haengt) return `seit ${tagKurz(e.seit)}`;
  if (!e.faelligAm) return null;
  if (e.ueberfaellig || e.faelligAm < heute) return `überfällig seit ${tagKurz(e.faelligAm)}`;
  return e.faelligAm === heute ? 'bis heute' : `bis ${tagKurz(e.faelligAm)}`;
}

/**
 * Die Liste. `kompakt` (Heute-Karte): nur was jetzt dran ist, höchstens `max` Zeilen, Kopf-Link zum Fulfillment. Ohne laufenden Fall und ohne wartenden Start
 * zeichnet die Heute-Karte nichts; auf dem Fulfillment-Start steht dann ein Leerzustand mit dem nächsten Schritt.
 */
export function HeuteImFulfillment({ kompakt = false, max = 5, i = 0, titel }: { kompakt?: boolean; max?: number; i?: number; titel?: string }) {
  const router = useRouter();
  const cockpit = useCockpit();
  const kurz = useUebersichtKurz();
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [entwurf, setEntwurf] = useState<{ e: HeuteEintrag; mail: MailEntwurf; hinweis?: string } | null>(null);
  const [start, setStart] = useState<{ mandatId: string; kunde?: string; leistungId?: string } | null>(null);
  const [demnaechstAuf, setDemnaechstAuf] = useState(false);
  const [nurMeine, setNurMeine] = useState(false);
  const ich = useIch();
  const personen = usePersonen();
  useEffect(() => { if (!meldung?.zurueck) return; const t = setTimeout(() => setMeldung(null), 10_000); return () => clearTimeout(t); }, [meldung]);
  const d = cockpit.daten;
  if (!d) return kompakt ? null : cockpit.fehler ? <Hinweis art="kritisch">{cockpit.fehler}</Hinweis> : null;
  const heute = d.heute;
  const alle = heuteImFulfillment(d.zeilen, kurz.daten?.kandidaten ?? [], heute, kurz.daten?.deals ?? []);
  // „Meine“ (17.10., Gesamtprüfung L1 B15): nur, wenn mehr als eine Person im Haushalt ist; die Zeile nennt sonst, wer betreut.
  const mehrere = personen.length > 1;
  const liste = mehrere && nurMeine && ich ? meineHeute(alle, ich) : alle;
  const werName = (e: HeuteEintrag) => (mehrere && e.zustaendig && e.zustaendig !== ich ? (e.zustaendig === 'beide' ? 'beide' : personen.find(p => p.speicher === e.zustaendig)?.name) : undefined);
  const z = heuteZahlen(liste);
  const jetzt = liste.filter(e => e.jetzt);
  const demnaechst = liste.filter(e => !e.jetzt);
  if (kompakt && !jetzt.length) return null;
  const pakete = (kurz.daten?.prozesse ?? []).filter(p => p.art === 'paket').map(p => ({ id: p.id, titel: p.titel, ...(p.zusatz ? { zusatz: true as const } : {}) }));
  // Der Start-Dialog: für einen wartenden Kandidaten mit dessen Vorwahl, für ein eben angelegtes Mandat mit der Zuordnung seines Produkts.
  // Vorbelegung nur nach der EINEN Regel (24.10., `startMandat` → `startVorbelegung`): Kandidat vom Server, sonst aus der Kurzform.
  const kandidat = start ? (kurz.daten?.kandidaten.find(k => k.mandatId === start.mandatId) ?? startMandat(kurz.daten, { mandatId: start.mandatId, kunde: start.kunde ?? 'Kunde', leistungId: start.leistungId })) : undefined;
  const mandatUndStart = async (e: HeuteEintrag, chanceId: string, leistungId?: string) => {
    const a = await holeJson<{ mandatId?: string }>('/api/crm/lead', { method: 'POST', body: JSON.stringify({ aktion: 'mandat', chanceId }) });
    if (!a.ok || !a.j.mandatId) { setMeldung({ text: fehlerText(a), art: 'kritisch' }); return; }
    setStart({ mandatId: a.j.mandatId, kunde: e.kunde, ...(leistungId ? { leistungId } : {}) });
  };

  // Stand und Status der Knoten aus der Cockpit-Zeile (17.10., Schreibwege B3): jeder Haken bzw. jedes Ja/Nein schickt den Stand mit — aus einer veralteten Liste
  // kommt 409 statt still überschrieben; „Rückgängig“ stellt den alten Status wieder her (nicht pauschal „offen“).
  const knotenStand = (mandatId: string) => d.zeilen.find(x => x.mandatId === mandatId)?.knotenStand ?? {};
  const mitStand = (e: HeuteEintrag, liste: Record<string, unknown>[]) => liste.map(o => { const st = knotenStand(e.mandatId)[String(o.id)]?.stand; return st ? { ...o, stand: st } : o; });
  const alterStatus = (e: HeuteEintrag, id: string) => knotenStand(e.mandatId)[id]?.status ?? 'offen';
  const ops = async (e: HeuteEintrag, liste0: Record<string, unknown>[], erfolg: string, zurueck?: Record<string, unknown>[]) => {
    const liste = mitStand(e, liste0);
    const a = await fallOps(e.mandatId, liste);
    if (!a.ok) { setMeldung({ text: fehlerText(a), art: 'kritisch' }); return; }
    setMeldung({ text: erfolg, art: 'gut', ...(zurueck ? { zurueck: async () => { const b = await fallOps(e.mandatId, zurueck); setMeldung(b.ok ? { text: 'Zurückgenommen.', art: 'info' } : { text: fehlerText(b), art: 'kritisch' }); } } : {}) });
  };
  const entwurfOeffnen = async (e: HeuteEintrag, knotenId: string) => {
    const a = await holeJson<Grundlage>(`/api/fulfillment/fall?m=${encodeURIComponent(e.mandatId)}&nachricht=${encodeURIComponent(knotenId)}`);
    if (!a.ok) { setMeldung({ text: String(a.j.fehler ?? 'Der Entwurf ließ sich nicht laden.'), art: 'kritisch' }); return; }
    if (a.j.gesperrt) { setMeldung({ text: a.j.gesperrt, art: 'achtung' }); return; }
    if (!a.j.entwurf) { setMeldung({ text: a.j.hinweis ?? 'Kein Entwurf — im Fall öffnen.', art: 'info' }); return; }
    setEntwurf({ e, mail: a.j.entwurf, ...(a.j.hinweis ? { hinweis: a.j.hinweis } : {}) });
  };

  // EINE Hauptaktion je Ansicht (DESIGN_STANDARD.md): nur der Handgriff der obersten Zeile ist „haupt“, die übrigen sind leise.
  const handgriff = (e: HeuteEintrag, haupt: boolean) => {
    const a = e.aktion;
    switch (a.art) {
      case 'ja-nein': return (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <Knopf haupt={haupt} leise={!haupt} onClick={() => ops(e, [{ op: 'antwort', id: a.knotenId, antwort: 'ja' }], `„${e.titel}“: ja — es geht weiter.`)}>Ja</Knopf>
          <Knopf leise onClick={() => ops(e, [{ op: 'antwort', id: a.knotenId, antwort: 'nein' }], `„${e.titel}“: nein — die Erinnerung läuft.`)}>Nein</Knopf>
        </span>
      );
      case 'entwurf': return <Knopf haupt={haupt} leise={!haupt} onClick={() => entwurfOeffnen(e, a.knotenId)}>Entwurf öffnen</Knopf>;
      case 'abhaken': return (
        <HakenZiel an={false} farbe={e.dringend ? LEUCHT.kritisch : e.ueberfaellig ? LEUCHT.achtung : undefined} label={e.titel}
          onChange={() => void ops(e, a.ids.map(id => ({ op: 'knoten-status', id, status: 'erledigt' })), a.kunde ? `„${e.titel}“ ist da.` : `„${e.titel}“ erledigt.`, a.ids.map(id => ({ op: 'knoten-status', id, status: alterStatus(e, id) })))} />
      );
      case 'starten': return <Knopf haupt={haupt} leise={!haupt} onClick={() => setStart({ mandatId: e.mandatId })}>Fall starten</Knopf>;
      case 'mandat-starten': return <Knopf haupt={haupt} leise={!haupt} onClick={() => mandatUndStart(e, a.chanceId, a.leistungId)}>Mandat anlegen & Fall starten</Knopf>;
      default: return <Knopf haupt={haupt} leise={!haupt} href={e.href}>{a.text} ›</Knopf>;
    }
  };

  const zeile = (e: HeuteEintrag, i = 1) => {
    const f = frist(e, heute);
    const farbe = e.dringend ? LEUCHT.kritisch : e.haengt || e.ueberfaellig ? LEUCHT.achtung : e.jetzt ? LEUCHT.business : C.inkLeise;
    const oeffnen = () => (e.quelle === 'start' ? setStart({ mandatId: e.mandatId }) : e.aktion.art === 'mandat-starten' ? router.push(WEG.deal(e.aktion.chanceId)) : router.push(e.href));
    return (
      <div key={e.id} className="ui-zeile zeile ff-heute-zeile" style={{ alignItems: 'center' }}>
        <Punkt farbe={farbe} groesse={8} />
        <button type="button" className="ui-zeile-text fassbar" onClick={oeffnen} aria-label={`${e.titel} — ${e.kunde}${f ? `, ${f}` : ''} — öffnen`}
          style={{ background: 'none', border: 'none', padding: '4px 0', minHeight: 44, cursor: 'pointer', textAlign: 'left', color: C.ink, fontFamily: SCHRIFT.text, minWidth: 0 }}>
          <span className="ui-zeile-titel" style={{ display: 'block', overflowWrap: 'anywhere' }}>{e.titel} <span style={{ color: C.inkLeise, fontWeight: 400 }}>· {e.kunde}</span></span>
          <span className="ui-zeile-unter" style={{ display: 'block', overflowWrap: 'anywhere', color: e.dringend ? LEUCHT.kritisch : e.ueberfaellig ? LEUCHT.achtung : undefined }}>
            {[e.haengt && e.haengt !== e.titel ? e.haengt : e.unter, f, werName(e)].filter(Boolean).join(' · ')}
          </span>
        </button>
        <span className="ui-zeile-rechts">{handgriff(e, i === 0 && e.jetzt)}</span>
      </div>
    );
  };

  const kopf = (
    <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      {z.jetzt ? <span style={{ color: z.dringend ? LEUCHT.kritisch : C.inkDim }}>{z.jetzt} zu tun{z.dringend ? ` · ${z.dringend} dringend` : ''}</span> : null}
      {mehrere && !kompakt && <Knopf leise onClick={() => setNurMeine(!nurMeine)}>{nurMeine ? 'Alle zeigen' : 'Nur meine'}</Knopf>}
      {kompakt && <Link href={WEG.fulfillment()} style={{ color: C.aktiv, fontSize: TYP.bedien, textDecoration: 'none' }}>Fulfillment ›</Link>}
    </span>
  );
  const sichtbar = kompakt ? jetzt.slice(0, max) : jetzt;
  return (
    <Karte i={i} id="ff-heute" akzent={z.dringend ? LEUCHT.kritisch : LEUCHT.business}>
      <Ueberschrift farbe={LEUCHT.business} rechts={kopf} erklaerung="fulfillment.heute">{titel ?? 'Heute im Fulfillment'}</Ueberschrift>
      {meldung && (
        <Hinweis art={meldung.art} {...(meldung.zurueck ? { aktion: <Knopf leise onClick={async () => { const r = meldung.zurueck!; setMeldung(null); await r(); }}>Rückgängig</Knopf> } : {})}>{meldung.text}</Hinweis>
      )}
      {!jetzt.length ? (
        <Leerzustand symbol="✓" ton={LEUCHT.gut} titel={d.zeilen.length ? 'Heute ist nichts offen' : 'Noch kein Kunde in Lieferung'}
          {...(d.zeilen.length ? {} : { aktion: <Knopf onClick={() => router.push(WEG.deal())}>Gewonnene Deals ansehen ›</Knopf> })}>
          {d.zeilen.length ? 'Alle Fälle sind im Takt — was als Nächstes kommt, steht unter „Demnächst“.' : 'Ein Fall startet, sobald ein Deal gewonnen ist: am Deal „Mandat anlegen & Fall starten“.'}
        </Leerzustand>
      ) : (
        <Liste>{sichtbar.map((e, n) => zeile(e, n))}</Liste>
      )}
      {kompakt && jetzt.length > max && <Link href={`${WEG.fulfillment()}#ff-heute`} style={{ color: C.aktiv, fontSize: TYP.bedien, textDecoration: 'none' }}>+ {jetzt.length - max} weitere ›</Link>}
      {!kompakt && demnaechst.length > 0 && (
        <Klappbar id="ff-heute-demnaechst" titel={`Demnächst · ${demnaechst.length}`} offen={demnaechstAuf} umschalten={() => setDemnaechstAuf(!demnaechstAuf)}>
          <span style={{ ...MIKRO, color: C.inkLeise }}>Als Nächstes je Kunde — mit späterer Frist</span>
          <Liste>{demnaechst.map(e => zeile(e))}</Liste>
        </Klappbar>
      )}
      {entwurf && (
        <MailSenden titel="Nachricht senden" entwurf={entwurf.mail} {...(entwurf.hinweis ? { hinweis: entwurf.hinweis } : {})} onZu={() => setEntwurf(null)}
          onGesendet={async () => { const x = entwurf.e; if (x.aktion.art === 'entwurf') await ops(x, [{ op: 'knoten-status', id: x.aktion.knotenId, status: 'erledigt' }], `„${x.titel}“ gesendet — der Schritt ist erledigt.`); }} />
      )}
      {kandidat && <StartDialog k={kandidat} pakete={pakete} onZu={() => { setStart(null); geaendert(); }} />}
    </Karte>
  );
}
