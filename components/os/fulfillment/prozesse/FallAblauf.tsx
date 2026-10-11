'use client';

// ─── Fulfillment › Fall › Ablauf (Paket C1, 10.10.; neu gezeichnet 11.10. — FULFILLMENT_KONZEPT.md 7.2–7.4) ───────────────────────────────
// Rückmeldung 11.10.: „eine endlose Liste mit ‚+ Zusatz-Schritt‘ an jeder Zeile … man sieht nicht, wo der Kunde steht.“ Jetzt: jede Phase (Ebene 2) als
// Zeile mit Zustand, Zähler und Freigabe-Raute; die laufende Phase ist aufgeklappt mit ihren nächsten Schritten, erledigte Phasen sind zu (ein
// Tipp öffnet). Teilprozesse (Ebene 3) sind Zwischenüberschriften, Bausteine (Ebene 5) hängen als Chip am Schritt (keine doppelte Zeile mehr).
// Der Freigabe-Punkt steht als Meilenstein am Ende der Phase („vermerken“ bzw. vermerkt + „⋯ › zurücknehmen“). „+ Zusatz-Schritt“ gibt es
// EINMAL je Phase; alles Seltene (Zusatz entfernen, Baustein öffnen, Status eines Bausteins) steht hinter „⋯“ (ZeileAktionen).
// Status (offen · in Arbeit · wartet auf Kunde · erledigt · entfällt mit Grund) setzt Schritt UND Bausteine darunter in EINER Anfrage
// (`statusOps`, vorhandene Fall-Ops). Onboarding-Schritte werden abgeleitet (nie von Hand „erledigt“). Gerechnet in lib/fulfillment/prozesse/reise.ts.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, TIEF, RAND, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Chip, Feldzeile, Pillen, HakenZiel, Punkt, Zeile, ZeileAktionen, LEUCHT, Erklaert, type ZeilenMehr } from '../../ui';
import { Fenster } from '../../Fenster';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { fallReise, phaseGruppen, phasenVon, statusOps, FREIGABE_WER, ONBOARDING_SPRUNG, type ReisePhase, type SchrittZeile } from '@/lib/fulfillment/prozesse/reise';
import { obSchluessel } from '@/lib/fulfillment/prozesse/onboarding';
import { kinderVon } from '@/lib/fulfillment/regeln';
import { OB_TEIL_ID } from '@/lib/fulfillment/prozesse/fall';
import type { FallKnoten, KnotenStatus } from '@/lib/fulfillment/typen';
import { useFall, fallOps, fallAktion, fehlerText, tagKurz, STATUS_TEXT, type FallAntwort } from './daten';
import { klein, feld, Leiste, Meldung, useTextFrage } from './teile';
import { FreigabeRaute, JETZT, ZUSTAND_FARBE } from '../reise/bilder';
import { useSprung, insBild } from '../reise/sprung';
import { useFallSprung } from '../reise/FallKopf';

const STATUS_FARBE: Record<KnotenStatus, string> = { offen: C.inkLeise, in_arbeit: LEUCHT.planung, wartet_kunde: LEUCHT.achtung, erledigt: LEUCHT.gut, entfaellt: C.inkLeise };
const WIE = [{ id: 'kickoff' as const, label: 'im Kick-off' }, { id: 'termin' as const, label: 'im Termin' }, { id: 'mail' as const, label: 'per Mail' }, { id: 'link' as const, label: 'über den Link' }];
/** So viele offene Schritte zeigt die laufende Phase, bevor „alle zeigen“ kommt. */
const NAECHSTE = 5;

type Ops = (o: Record<string, unknown>[]) => Promise<void>;
type Bausteine = Map<string, NonNullable<FallAntwort['bausteine']>[number]>;

export function FallAblauf({ mandatId }: { mandatId: string }) {
  const { daten, fehler } = useFall(mandatId);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'achtung' } | null>(null);
  const [freigabe, setFreigabe] = useState<string | null>(null);
  const [extra, setExtra] = useState<string | null>(null);
  const [auf, setAuf] = useState<Record<string, boolean>>({});
  const frage = useTextFrage();
  useSprung(s => {
    if (s.art === 'phase') { setAuf(a => ({ ...a, [s.wert]: true })); insBild(`phase-${s.wert}`); }
    if (s.art === 'freigabe') setFreigabe(s.wert);
  });
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  if (!daten.fall) return <Hinweis art="info">Für dieses Mandat läuft noch kein Fall — unter „Überblick“ das Onboarding starten.</Hinweis>;
  const f = daten.fall;
  const heute = localDay();
  const ops: Ops = async o => {
    if (!o.length) return;
    const a = await fallOps(mandatId, o);
    if (!a.ok) setMeldung({ text: fehlerText(a), art: 'kritisch' });
    else if (a.j.nachzug?.fehler) setMeldung({ text: `Gespeichert, aber nicht nachgezogen: ${a.j.nachzug.fehler}`, art: 'achtung' });
    else setMeldung(a.j.nachzug?.phase === 'gesetzt' ? { text: 'Die Phase am Mandat ist mitgezogen.', art: 'gut' } : null);
  };
  const stand = (k: FallKnoten) => f.knoten.find(x => x.id === k.id)?.stand;
  const status = async (z: SchrittZeile, s: KnotenStatus) => {
    if (s === 'entfaellt') { const grund = await frage.fragen(`Warum entfällt „${z.knoten.titel}“?`); if (grund) await ops(statusOps(z, s, grund, stand)); return; }
    await ops(statusOps(z, s, undefined, stand));
  };
  const reise = fallReise(f, daten.vorlage?.freigaben ?? [], heute);
  const bausteine: Bausteine = new Map((daten.bausteine ?? []).map(b => [b.id, b]));
  const istAuf = (p: ReisePhase) => auf[p.id] ?? p.zustand === 'jetzt';
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Meldung text={meldung?.text ?? null} art={meldung?.art} />
      {meldung?.art === 'achtung' && <div><Knopf leise onClick={async () => { const a = await fallAktion({ aktion: 'nachziehen', mandatId }); setMeldung(a.ok ? { text: 'Nachgezogen.', art: 'gut' } : { text: fehlerText(a), art: 'kritisch' }); }}>Erneut nachziehen</Knopf></div>}
      <Karte i={1}>
        <Ueberschrift erklaerung="fulfillment.ablaufPhasen" rechts={<Erklaert erklaerung="fulfillment.fortschritt" name="Fortschritt"><span>{reise.phasen.filter(p => p.zustand === 'fertig').length} von {reise.phasen.length} Phasen · {reise.fortschritt} %</span></Erklaert>}>{daten.vorlage?.titel ?? 'Ablauf'}</Ueberschrift>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid' }}>
          {reise.phasen.map((p, i) => {
            const vorher = reise.phasen.slice(0, i).find(x => x.freigabe && !x.freigabe.gegeben && x.zustand !== 'offen');
            return (
              <PhaseBlock key={p.id} p={p} letzte={i === reise.phasen.length - 1} offen={istAuf(p)} umschalten={() => setAuf(a => ({ ...a, [p.id]: !istAuf(p) }))}
                daten={daten} heute={heute} bausteine={bausteine} status={status} ops={ops} onFreigabe={setFreigabe} onExtra={setExtra}
                freigabeOffenVor={p.zustand === 'jetzt' && vorher ? vorher : undefined} />
            );
          })}
        </ol>
        {!reise.phasen.length && <div style={klein}>Diese Vorlage hat keine Phasen — Schritte kommen über den Editor der Paket-Vorlage dazu.</div>}
      </Karte>
      {freigabe && <FreigabeDialog id={freigabe} daten={daten} onZu={() => setFreigabe(null)} ops={ops} />}
      {extra && <ExtraDialog phaseId={extra} fall={f} onZu={() => setExtra(null)} ops={ops} />}
      {frage.dialog}
    </div>
  );
}

/** Eine Phase: Kopf (Zustand, Zähler, Freigabe-Raute) und — aufgeklappt — ihre Schritte, die Freigabe am Ende und EIN „+ Zusatz-Schritt“. */
function PhaseBlock({ p, letzte, offen, umschalten, daten, heute, bausteine, status, ops, onFreigabe, onExtra, freigabeOffenVor }: {
  p: ReisePhase; letzte: boolean; offen: boolean; umschalten: () => void; daten: FallAntwort; heute: string; bausteine: Bausteine;
  status: (z: SchrittZeile, s: KnotenStatus) => Promise<void>; ops: Ops; onFreigabe: (id: string) => void; onExtra: (phaseId: string) => void; freigabeOffenVor?: ReisePhase;
}) {
  const [alle, setAlle] = useState(p.zustand !== 'jetzt');
  const f = daten.fall!;
  const farbe = ZUSTAND_FARBE[p.zustand];
  const gruppen = offen ? phaseGruppen(f, p.id, heute) : [];
  const zeilen = gruppen.flatMap(g => g.zeilen);
  const offeneZeilen = zeilen.filter(z => !z.fertig);
  const sichtbar = new Set((alle ? zeilen : offeneZeilen.slice(0, NAECHSTE)).map(z => z.knoten.id));
  const verborgen = zeilen.length - sichtbar.size;
  const gegeben = p.freigabe ? f.freigaben[p.freigabe.id] : undefined;
  const zaehler = p.zustand === 'fertig' ? `erledigt${p.gesamt ? ` · ${p.gesamt} Schritt${p.gesamt === 1 ? '' : 'e'}` : ''}` : `${p.erledigt} von ${p.gesamt} erledigt`;
  return (
    <li id={`phase-${p.id}`} style={{ borderBottom: letzte ? 'none' : `1px solid ${RAND.haar}`, scrollMarginTop: 80 }}>
      <button type="button" className="fassbar" aria-expanded={offen} onClick={umschalten}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '10px 2px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text }}>
        <PhasenNummer nr={p.nr} zustand={p.zustand} ueberfaellig={p.ueberfaellig} />
        <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
            <b style={{ fontSize: TYP.body, color: p.zustand === 'offen' ? C.inkDim : C.ink, textDecoration: p.entfaellt ? 'line-through' : 'none' }}>{p.titel}</b>
            {p.zustand === 'jetzt' && <span style={{ ...MIKRO, color: JETZT }}>Sie sind hier</span>}
          </span>
          <span style={{ ...klein, color: C.inkLeise }}>
            {zaehler}{p.faelligAm && p.zustand !== 'fertig' ? ` · bis ${tagKurz(p.faelligAm)}` : ''}{p.wartet ? ` · ${p.wartet} beim Kunden` : ''}{p.ueberfaellig ? ' · überfällig' : ''}
          </span>
          {p.gesamt > 0 && p.zustand !== 'fertig' && (
            <span aria-hidden style={{ display: 'block', height: 4, borderRadius: 2, background: 'rgba(255,255,255,.07)', maxWidth: 320, marginTop: 4 }}>
              <span style={{ display: 'block', height: 4, borderRadius: 2, width: `${Math.round(p.anteil * 100)}%`, background: TIEF.verlauf(p.ueberfaellig ? LEUCHT.kritisch : farbe) }} />
            </span>
          )}
        </span>
        {p.freigabe && (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: p.freigabe.gegeben ? LEUCHT.gut : C.inkDim, whiteSpace: 'nowrap' }} title={`Freigabe ${p.freigabe.id} · ${p.freigabe.titel}`}>
            <FreigabeRaute gegeben={p.freigabe.gegeben} aktiv={p.zustand !== 'offen'} />{p.freigabe.id}
          </span>
        )}
        <span aria-hidden style={{ color: C.inkLeise, display: 'inline-flex' }}>{offen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
      </button>
      {offen && (
        <div style={{ display: 'grid', gap: 8, padding: '0 0 14px clamp(0px, 3vw, 40px)' }}>
          {freigabeOffenVor?.freigabe && <Hinweis art="achtung">Diese Phase läuft, obwohl die Freigabe {freigabeOffenVor.freigabe.id} („{freigabeOffenVor.freigabe.titel}“) der Phase „{freigabeOffenVor.titel}“ noch nicht vermerkt ist.</Hinweis>}
          {gruppen.map((g, gi) => {
            const z = g.zeilen.filter(x => sichtbar.has(x.knoten.id));
            if (!z.length) return null;
            return (
              <div key={g.teil?.id ?? `einzeln-${gi}`} style={{ display: 'grid', gap: 2 }}>
                {g.teil && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', paddingTop: gi ? 6 : 0 }}>
                    <span style={{ ...MIKRO, color: C.inkDim }}>{g.teil.titel}</span>
                    <span style={{ ...klein, color: C.inkLeise }}>{g.erledigt} von {g.gesamt}</span>
                  </div>
                )}
                {z.map(x => <SchrittZeileAnsicht key={x.knoten.id} z={x} phaseFreigabe={p.freigabe?.id} daten={daten} bausteine={bausteine} status={status} ops={ops} onFreigabe={onFreigabe} />)}
              </div>
            );
          })}
          {!zeilen.length && <div style={klein}>Diese Phase hat keine Schritte.</div>}
          {verborgen > 0 && (
            <div><Knopf leise onClick={() => setAlle(!alle)}>{alle ? 'Nur die nächsten offenen zeigen' : `Alle ${zeilen.length} Schritte zeigen (${zeilen.length - offeneZeilen.length} erledigt${offeneZeilen.length > NAECHSTE ? `, ${offeneZeilen.length - NAECHSTE} weitere offen` : ''})`}</Knopf></div>
          )}
          {p.freigabe && (
            <FreigabeMeilenstein p={p} gegeben={gegeben} onVermerken={() => onFreigabe(p.freigabe!.id)} onZurueck={() => ops([{ op: 'freigabe', id: p.freigabe!.id, zuruecknehmen: true }])} />
          )}
          <div><Knopf leise onClick={() => onExtra(p.id)}>+ Zusatz-Schritt in „{p.titel}“</Knopf></div>
        </div>
      )}
    </li>
  );
}

/** Der Kreis vor der Phase: ✓ erledigt, Nummer gefüllt = hier stehen wir, Nummer im Umriss = kommt noch. */
function PhasenNummer({ nr, zustand, ueberfaellig }: { nr: number; zustand: ReisePhase['zustand']; ueberfaellig: boolean }) {
  const f = zustand === 'jetzt' && ueberfaellig ? LEUCHT.kritisch : ZUSTAND_FARBE[zustand];
  const voll = zustand !== 'offen';
  return (
    <span aria-hidden style={{ width: 28, height: 28, borderRadius: 14, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontSize: TYP.bedien, fontWeight: 700, fontFamily: SCHRIFT.display,
      color: voll ? C.ink : C.inkDim, background: voll ? TIEF.flaeche(f) : 'transparent', border: `1.5px solid ${voll ? TIEF.rand(f) : RAND.stark}`, boxShadow: zustand === 'jetzt' ? TIEF.schein(f, 14) : undefined }}>
      {zustand === 'fertig' ? '✓' : nr}
    </span>
  );
}

/** Ein Schritt: Haken (setzt Schritt + Bausteine), Titel, Bausteine als Chips, Fälligkeit, Status-Wahl; Seltenes hinter „⋯“. */
function SchrittZeileAnsicht({ z, phaseFreigabe, daten, bausteine, status, ops, onFreigabe }: {
  z: SchrittZeile; phaseFreigabe?: string; daten: FallAntwort; bausteine: Bausteine; status: (z: SchrittZeile, s: KnotenStatus) => Promise<void>; ops: Ops; onFreigabe: (id: string) => void;
}) {
  const router = useRouter();
  const geh = useFallSprung(daten.mandat.id, 'ablauf');
  const k = z.knoten;
  const f = daten.fall!;
  const sprung = obSchluessel(k.id);
  const eigeneFreigabe = k.freigabe && k.freigabe !== phaseFreigabe ? daten.vorlage?.freigaben.find(x => x.id === k.freigabe) ?? { id: k.freigabe, titel: k.freigabe, wer: 'beide' as const } : undefined;
  const sperreErledigt = !!k.freigabe;
  const setzbar = !z.abgeleitet;
  const wahl = (Object.keys(STATUS_TEXT) as KnotenStatus[]).filter(s => !(s === 'erledigt' && sperreErledigt));
  const mehr: ZeilenMehr[] = [
    ...z.bausteine.filter(b => b.bausteinId && bausteine.get(b.bausteinId)).map(b => ({ id: `b-${b.id}`, label: `Baustein „${bausteine.get(b.bausteinId!)!.titel}“ öffnen`, tun: () => router.push(WEG.fulfillment('bausteine', { b: b.bausteinId! })) })),
    ...(z.abgeleitet ? z.bausteine.filter(b => !b.freigabe).map(b => ({
      id: `s-${b.id}`, label: `Stand von „${b.titel}“`, hinweis: STATUS_TEXT[b.status],
      auswahl: { titel: `Stand von „${b.titel}“`, eintraege: (Object.keys(STATUS_TEXT) as KnotenStatus[]).filter(s => s !== 'entfaellt').map(s => ({ id: s, label: STATUS_TEXT[s], punkt: STATUS_FARBE[s] })), waehlen: (s: string) => { const st = f.knoten.find(x => x.id === b.id)?.stand; void ops([{ op: 'knoten-status', id: b.id, status: s, ...(st ? { stand: st } : {}) }]); } },
    })) : []),
    ...(k.extra && !z.abgeleitet && k.id !== OB_TEIL_ID ? [{ id: 'weg', label: 'Zusatz-Schritt entfernen', gefahr: true, tun: () => ops([{ op: 'knoten-extra', id: k.id, weg: true }]) }] : []),
    ...(eigeneFreigabe && f.freigaben[eigeneFreigabe.id] ? [{ id: 'fg-weg', label: `Freigabe ${eigeneFreigabe.id} zurücknehmen`, tun: () => ops([{ op: 'freigabe', id: eigeneFreigabe.id, zuruecknehmen: true }]) }] : []),
  ];
  const kunde = k.zustaendig === 'kunde';
  return (
    <ZeileAktionen titel={k.titel} mehr={mehr}>
      <Zeile umbrechen
        links={setzbar && !sperreErledigt
          ? <HakenZiel an={z.zustand === 'erledigt'} farbe={LEUCHT.gut} label={k.titel} onChange={() => status(z, z.zustand === 'erledigt' ? 'offen' : 'erledigt')} />
          : <span style={{ width: 44, display: 'inline-grid', placeItems: 'center', flex: '0 0 auto' }}><Punkt farbe={STATUS_FARBE[z.zustand]} /></span>}
        titel={<span style={{ color: z.fertig ? C.inkDim : C.ink, textDecoration: z.zustand === 'entfaellt' ? 'line-through' : 'none' }}>{k.titel}</span>}
        unter={(z.bausteine.length || k.faelligAm || kunde || k.grund || (k.extra && !z.abgeleitet) || (sprung && !z.fertig)) ? (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {z.bausteine.map(b => {
              const bb = b.bausteinId ? bausteine.get(b.bausteinId) : undefined;
              const name = bb ? (bb.titel === k.titel ? `${bb.art} öffnen` : bb.titel) : b.bausteinId ? `${b.titel} (Baustein entfernt)` : b.titel;
              return (
                <span key={b.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {bb ? <Link href={WEG.fulfillment('bausteine', { b: bb.id })} style={{ color: C.aktiv, fontSize: TYP.bedien }} onClick={e => e.stopPropagation()}>▤ {name}</Link> : <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>▤ {name}</span>}
                  {bb?.nurIntern && <Chip farbe={LEUCHT.agenten}>nur intern</Chip>}
                  {bb?.rechtOffen && <Chip farbe={LEUCHT.achtung}>rechtlich prüfen</Chip>}
                </span>
              );
            })}
            {k.faelligAm && !z.fertig && <Chip farbe={z.ueberfaellig ? LEUCHT.kritisch : C.inkDim}>{z.ueberfaellig ? 'überfällig ' : 'bis '}{tagKurz(k.faelligAm)}</Chip>}
            {kunde && !z.fertig && <Chip farbe={LEUCHT.achtung}>macht der Kunde</Chip>}
            {k.extra && !z.abgeleitet && k.id !== OB_TEIL_ID && <Chip farbe={C.inkDim}>Zusatz</Chip>}
            {z.zustand === 'entfaellt' && k.grund && <span style={klein}>Entfällt: {k.grund}</span>}
            {sprung && !z.fertig && <span style={{ ...klein, color: C.inkLeise }}>wird automatisch erledigt, sobald es da ist</span>}
          </span>
        ) : undefined}
        rechts={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {eigeneFreigabe && !f.freigaben[eigeneFreigabe.id] && <Erklaert erklaerung="fulfillment.freigabe" name={`Freigabe ${eigeneFreigabe.id}`}><Knopf leise onClick={() => onFreigabe(eigeneFreigabe.id)}>Freigabe {eigeneFreigabe.id} vermerken</Knopf></Erklaert>}
            {eigeneFreigabe && f.freigaben[eigeneFreigabe.id] && <Chip farbe={LEUCHT.gut}>{eigeneFreigabe.id} vermerkt {tagKurz(f.freigaben[eigeneFreigabe.id].am)}</Chip>}
            {setzbar
              ? <Wahl<KnotenStatus> label="Status" klein liste={wahl.map(s => ({ id: s, label: STATUS_TEXT[s] }))} wert={z.zustand} farbe={STATUS_FARBE[z.zustand]} onWahl={s => status(z, s)} />
              : sprung && !z.fertig
                ? <Knopf leise onClick={() => (sprung === 'f0' ? onFreigabe('F0') : sprung === 'willkommen' ? geh('ueberblick', { art: 'willkommen' }) : geh(ONBOARDING_SPRUNG[sprung].reiter))}>{ONBOARDING_SPRUNG[sprung].text}{sprung === 'f0' ? '' : ' ›'}</Knopf>
                : <Chip farbe={STATUS_FARBE[z.zustand]}>{STATUS_TEXT[z.zustand]} · automatisch</Chip>}
          </span>
        } />
    </ZeileAktionen>
  );
}

/** Die Freigabe am Ende der Phase — der Meilenstein: wer bestätigt, Knopf „vermerken“ bzw. vermerkt (zurücknehmen hinter „⋯“). */
function FreigabeMeilenstein({ p, gegeben, onVermerken, onZurueck }: { p: ReisePhase; gegeben?: NonNullable<FallAntwort['fall']>['freigaben'][string]; onVermerken: () => void; onZurueck: () => void }) {
  const fg = p.freigabe!;
  const wie = gegeben?.kunde ? WIE.find(w => w.id === gegeben.kunde!.wie)?.label : undefined;
  return (
    <ZeileAktionen titel={`Freigabe ${fg.id}`} mehr={gegeben ? [{ id: 'zurueck', label: 'Vermerk zurücknehmen', hinweis: 'Die Freigabe gilt dann wieder als offen.', tun: onZurueck }] : []}>
      <Zeile umbrechen
        links={<span style={{ width: 44, display: 'inline-grid', placeItems: 'center', flex: '0 0 auto' }}><FreigabeRaute gegeben={!!gegeben} aktiv groesse={14} /></span>}
        titel={<span>Freigabe {fg.id} · {fg.titel}</span>}
        unter={gegeben ? `vermerkt am ${tagKurz(gegeben.am)}${wie ? ` · ${wie}` : ''}${gegeben.notiz ? ` · ${gegeben.notiz}` : ''}` : `Haltepunkt am Ende der Phase — ${FREIGABE_WER[fg.wer]}, dann geht es weiter.`}
        rechts={gegeben ? <Chip farbe={LEUCHT.gut}>vermerkt</Chip> : <Erklaert erklaerung="fulfillment.freigabe" name={`Freigabe ${fg.id}`}><Knopf onClick={onVermerken}>Freigabe vermerken</Knopf></Erklaert>} />
    </ZeileAktionen>
  );
}

function FreigabeDialog({ id, daten, onZu, ops }: { id: string; daten: FallAntwort; onZu: () => void; ops: Ops }) {
  const fg = daten.vorlage?.freigaben.find(x => x.id === id);
  const [wie, setWie] = useState<typeof WIE[number]['id'] | null>(null);
  const [am, setAm] = useState(localDay());
  const [notiz, setNotiz] = useState('');
  return (
    <Fenster titel={`Freigabe ${id}${fg ? ` · ${fg.titel}` : ''} vermerken`} onZu={onZu} breit={520}>
      <form onSubmit={e => { e.preventDefault(); void ops([{ op: 'freigabe', id, ...(wie ? { kunde: { wie, am } } : {}), ...(notiz.trim() ? { notiz: notiz.trim() } : {}) }]).then(onZu); }} style={{ display: 'grid', gap: 10 }}>
        {fg && <div style={klein}>{FREIGABE_WER[fg.wer].replace(/^./, c => c.toUpperCase())} — danach gilt die Phase als abgeschlossen.</div>}
        {fg?.wer !== 'intern' && (
          <Feldzeile label="Wie hat der Kunde bestätigt?"><Pillen liste={WIE} aktiv={wie} onWahl={setWie} /></Feldzeile>
        )}
        {wie && <Feldzeile label="Am"><input type="date" value={am} onChange={e => setAm(e.target.value)} style={feld} /></Feldzeile>}
        <Feldzeile label="Notiz (kurz, ohne Privates)"><input value={notiz} maxLength={300} onChange={e => setNotiz(e.target.value)} style={feld} /></Feldzeile>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf haupt typ="submit" aus={fg?.wer !== 'intern' && !wie}>Vermerken</Knopf>
        </div>
      </form>
    </Fenster>
  );
}

/** Zusatz-Schritt für diesen Fall: Wo (die Phase selbst oder einer ihrer Teilprozesse), Titel, Fälligkeit. Die Vorlage bleibt, wie sie ist. */
function ExtraDialog({ phaseId, fall, onZu, ops }: { phaseId: string; fall: NonNullable<FallAntwort['fall']>; onZu: () => void; ops: Ops }) {
  const phase = phasenVon(fall).find(p => p.id === phaseId);
  const orte = [...(phase ? [{ id: phase.id, label: `direkt in „${phase.titel}“` }] : []), ...kinderVon(phaseId, fall.knoten).filter(t => kinderVon(t.id, fall.knoten).length > 0).map(t => ({ id: t.id, label: `unter „${t.titel}“` }))];
  const [eltern, setEltern] = useState(orte[orte.length > 1 ? 1 : 0]?.id ?? phaseId);
  const [titel, setTitel] = useState('');
  const [faellig, setFaellig] = useState('');
  return (
    <Fenster titel="Zusatz-Schritt" onZu={onZu} breit={520}>
      <form onSubmit={e => { e.preventDefault(); if (titel.trim()) void ops([{ op: 'knoten-extra', eintrag: { elternId: eltern, titel: titel.trim(), ...(faellig ? { faelligAm: faellig } : {}) } }]).then(onZu); }} style={{ display: 'grid', gap: 10 }}>
        <Feldzeile label="Titel"><input value={titel} autoFocus onChange={e => setTitel(e.target.value)} style={feld} /></Feldzeile>
        {orte.length > 1 && <Feldzeile label="Wo"><Wahl label="Wo" liste={orte} wert={eltern} onWahl={setEltern} /></Feldzeile>}
        <Feldzeile label="Fällig am"><input type="date" value={faellig} onChange={e => setFaellig(e.target.value)} style={feld} /></Feldzeile>
        <div style={klein}>Ein Zusatz-Schritt gilt nur für diesen Fall — die Vorlage bleibt, wie sie ist.</div>
        <Leiste>
          <span style={{ flex: 1 }} />
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf haupt typ="submit" aus={!titel.trim()}>Anlegen</Knopf>
        </Leiste>
      </form>
    </Fenster>
  );
}
