'use client';

// ─── Fulfillment › Fall › Schritte im Detail (Paket C1, 10.10.; 11.10. neu gezeichnet; seit 17.10. das Detail zum Fluss — FULFILLMENT_KONZEPT.md 7.2–7.4) ──
// Bis 17.10. war das der Reiter „Ablauf“ (jede Phase als aufklappbare Liste). Rückmeldung 17.10.: „Es dupliziert sich — lieber wenig und klar.“ Der Ablauf ist
// jetzt der Fluss einer Phase in der Reise (components/os/fulfillment/reise/{FallReise,Fluss}.tsx); ein Tipp auf einen Knoten öffnet HIER sein Detail:
//   · `SchrittDetail` — der Schritt mit Haken (Schritt UND Bausteine in EINER Anfrage, `statusOps`), Status (offen · in Arbeit · wartet auf Kunde ·
//     erledigt · entfällt mit Grund), Bausteinen als Chip, Frist, „macht der Kunde“, dem Verweis auf die Stelle, die ihn führt (Quick Wins, Befähigung,
//     Wirkungsbericht, Diagnose, Dossier); Seltenes hinter „⋯“. Onboarding-Schritte werden abgeleitet (nie von Hand „erledigt“).
//   · `FreigabeMeilenstein` + `FreigabeDialog` — der Abstimmungspunkt (vermerken, wie bestätigt, zurücknehmen hinter „⋯“).
//   · `ExtraDialog` — „+ Zusatz-Schritt“ EINMAL je Phase.
// Am Handy brechen Kopfzeile, Chips und die Aktionsspalte um (Klassen `ff-ablauf…`, globals.css — 15.10., Abnahme B2). Gerechnet in
// lib/fulfillment/prozesse/reise.ts; geschrieben nur über die vorhandenen Fall-Ops.

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Knopf, Chip, Feldzeile, Pillen, HakenZiel, Punkt, Zeile, ZeileAktionen, LEUCHT, Erklaert, type ZeilenMehr } from '../../ui';
import { Fenster } from '../../Fenster';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { anzahl, wort } from '@/lib/text/zahlwort';
import { localDay } from '@/lib/zeit';
import { phasenVon, statusOps, FREIGABE_WER, ONBOARDING_SPRUNG, type SchrittZeile } from '@/lib/fulfillment/prozesse/reise';
import { abstimmungName, abstimmungsNummern, anzeigeTitel } from '@/lib/fulfillment/prozesse/darstellung';
import { obSchluessel } from '@/lib/fulfillment/prozesse/onboarding';
import { schrittVerweis, type SchrittVerweis } from '@/lib/fulfillment/prozesse/ansichten';
import { kinderVon } from '@/lib/fulfillment/regeln';
import { OB_TEIL_ID } from '@/lib/fulfillment/prozesse/fall';
import type { FallKnoten, KnotenStatus } from '@/lib/fulfillment/typen';
import { fallOps, fehlerText, tagKurz, STATUS_TEXT, type FallAntwort } from './daten';
import { klein, feld, Leiste, BausteinMarken } from './teile';
import { FreigabeRaute } from '../reise/bilder';
import { useFallSprung } from '../reise/FallKopf';
import type { FallReiter } from '@/lib/fulfillment/adresse';

const STATUS_FARBE: Record<KnotenStatus, string> = { offen: C.inkLeise, in_arbeit: LEUCHT.planung, wartet_kunde: LEUCHT.achtung, erledigt: LEUCHT.gut, entfaellt: C.inkLeise };
const WIE = [{ id: 'kickoff' as const, label: 'im Kick-off' }, { id: 'termin' as const, label: 'im Termin' }, { id: 'mail' as const, label: 'per Mail' }, { id: 'link' as const, label: 'über den Link' }];

export type Ops = (o: Record<string, unknown>[]) => Promise<void>;
type Bausteine = Map<string, NonNullable<FallAntwort['bausteine']>[number]>;
export type FallMeldung = { text: string; art: 'gut' | 'kritisch' | 'achtung' } | null;

/** Fall-Ops mit Meldung (Fehler, „nicht nachgezogen“, Phase am Mandat mitgezogen) — EIN Weg für das Detail der Reise. */
export function fallOpsMitMeldung(mandatId: string, setMeldung: (m: FallMeldung) => void): Ops {
  return async o => {
    if (!o.length) return;
    const a = await fallOps(mandatId, o);
    if (!a.ok) setMeldung({ text: fehlerText(a), art: 'kritisch' });
    else if (a.j.nachzug?.fehler) setMeldung({ text: `Gespeichert, aber nicht nachgezogen: ${a.j.nachzug.fehler}`, art: 'achtung' });
    else setMeldung(a.j.nachzug?.phase === 'gesetzt' ? { text: 'Die Phase am Mandat ist mitgezogen.', art: 'gut' } : null);
  };
}

/**
 * Das Detail eines Schritts (ein Knoten des Flusses): Kopf (Phase, Titel, Abstimmungspunkt) und die Schritt-Zeile mit Haken, Status, Bausteinen und
 * dem Weg dorthin, wo er erfüllt wird. `haupt` = der Schritt ist „hier“ — dann trägt sein Handgriff die Hauptaktion der Ansicht.
 */
export function SchrittDetail({ z, phase, daten, status, ops, onFreigabe, haupt, mehr, zusatz }: {
  z: SchrittZeile; phase?: string; daten: FallAntwort; status: (z: SchrittZeile, s: KnotenStatus) => Promise<void>; ops: Ops; onFreigabe: (id: string) => void; haupt?: boolean;
  /** Seltenes für diesen Schritt (z. B. „⋯“ eines Onboarding-Schritts) — rechts im Kopf. */
  mehr?: ReactNode;
  /** Ein Satz unter dem Schritt (z. B. die Erinnerung „beim Kunden nachfassen“). */
  zusatz?: ReactNode;
}) {
  const f = daten.fall!;
  const nummern = abstimmungsNummern(f.knoten);
  const fg = z.knoten.freigabe ? daten.vorlage?.freigaben.find(x => x.id === z.knoten.freigabe) : undefined;
  const bausteine: Bausteine = new Map((daten.bausteine ?? []).map(b => [b.id, b]));
  return (
    <Karte i={0} className="ff-ablauf" id="ff-detail">
      <div className="ff-ablauf-kopf" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
          {phase && <span style={{ ...MIKRO }}>{phase}</span>}
          <b style={{ fontSize: TYP.body, color: C.ink, overflowWrap: 'break-word' }}>{anzeigeTitel(z.knoten.titel, nummern)}</b>
        </span>
        {z.knoten.freigabe && (
          <span className="ff-ablauf-raute" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: f.freigaben[z.knoten.freigabe] ? LEUCHT.gut : C.inkDim, maxWidth: 'min(260px, 46%)', minWidth: 0 }}>
            <FreigabeRaute gegeben={!!f.freigaben[z.knoten.freigabe]} aktiv />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{abstimmungName(z.knoten.freigabe, nummern, fg?.titel)}</span>
          </span>
        )}
        {mehr}
      </div>
      <div className="ff-ablauf-schritte" style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        <SchrittZeileAnsicht z={z} daten={daten} bausteine={bausteine} status={status} ops={ops} onFreigabe={onFreigabe} haupt={haupt} />
        {zusatz}
      </div>
    </Karte>
  );
}

/** Ein Schritt: Haken (setzt Schritt + Bausteine), Titel, Bausteine als Chips, Fälligkeit, Status-Wahl; Seltenes hinter „⋯“. */
function SchrittZeileAnsicht({ z, daten, bausteine, status, ops, onFreigabe, haupt }: {
  z: SchrittZeile; daten: FallAntwort; bausteine: Bausteine; status: (z: SchrittZeile, s: KnotenStatus) => Promise<void>; ops: Ops; onFreigabe: (id: string) => void; haupt?: boolean;
}) {
  const router = useRouter();
  const geh = useFallSprung(daten.mandat.id, 'reise');
  const k = z.knoten;
  const f = daten.fall!;
  const sprung = obSchluessel(k.id);
  const nummern = abstimmungsNummern(f.knoten);
  const titel = anzeigeTitel(k.titel, nummern);
  const eigeneFreigabe = k.freigabe ? daten.vorlage?.freigaben.find(x => x.id === k.freigabe) ?? { id: k.freigabe, titel: '', wer: 'beide' as const } : undefined;
  const fgName = eigeneFreigabe ? abstimmungName(eigeneFreigabe.id, nummern) : '';
  const sperreErledigt = !!k.freigabe;
  const setzbar = !z.abgeleitet;
  const wahl = (Object.keys(STATUS_TEXT) as KnotenStatus[]).filter(s => !(s === 'erledigt' && sperreErledigt));
  const mehr: ZeilenMehr[] = [
    ...z.bausteine.filter(b => b.bausteinId && bausteine.get(b.bausteinId)).map(b => ({ id: `b-${b.id}`, label: `Baustein „${bausteine.get(b.bausteinId!)!.titel}“ öffnen`, tun: () => router.push(WEG.fulfillment('bausteine', { b: b.bausteinId! })) })),
    ...(z.abgeleitet ? z.bausteine.filter(b => !b.freigabe).map(b => ({
      id: `s-${b.id}`, label: `Stand von „${b.titel}“`, hinweis: STATUS_TEXT[b.status],
      auswahl: { titel: `Stand von „${b.titel}“`, eintraege: (Object.keys(STATUS_TEXT) as KnotenStatus[]).filter(s => s !== 'entfaellt').map(s => ({ id: s, label: STATUS_TEXT[s], punkt: STATUS_FARBE[s] })), waehlen: (s: string) => { const st = f.knoten.find(x => x.id === b.id)?.stand; void ops([{ op: 'knoten-status', id: b.id, status: s, ...(st ? { stand: st } : {}) }]); } },
    })) : []),
    ...(k.extra && !z.abgeleitet && k.id !== OB_TEIL_ID ? [
      { id: 'sichtbar', label: k.kundeSichtbar ? 'Für den Kunden verbergen' : 'Für den Kunden sichtbar machen', hinweis: k.kundeSichtbar ? 'Steht dann nicht mehr in seiner Reise und im Report.' : 'Steht dann in seiner Reise („als Nächstes“) und im Report.', tun: () => ops([{ op: 'knoten-extra', eintrag: { id: k.id, kundeSichtbar: !k.kundeSichtbar }, ...(f.knoten.find(x => x.id === k.id)?.stand ? { stand: f.knoten.find(x => x.id === k.id)!.stand } : {}) }]) },
      { id: 'weg', label: 'Zusatz-Schritt entfernen', gefahr: true, tun: () => ops([{ op: 'knoten-extra', id: k.id, weg: true }]) },
    ] : []),
    ...(eigeneFreigabe && f.freigaben[eigeneFreigabe.id] ? [{ id: 'fg-weg', label: `${fgName} zurücknehmen`, tun: () => ops([{ op: 'freigabe', id: eigeneFreigabe.id, zuruecknehmen: true }]) }] : []),
  ];
  const kunde = k.zustaendig === 'kunde';
  const verweis = schrittVerweis(k);
  const v = verweis ? verweisAnzeige(verweis, daten) : null;
  const zuOnboarding = (s: NonNullable<typeof sprung>) => {
    if (s === 'f0') return onFreigabe('F0');
    if (s === 'willkommen') return geh('reise', { art: 'willkommen' });
    const ziel = ONBOARDING_SPRUNG[s];
    return geh(ziel.reiter, ziel.stelle ? { art: 'stelle', wert: ziel.stelle } : undefined);
  };
  return (
    <ZeileAktionen titel={titel} mehr={mehr}>
      <Zeile umbrechen
        links={setzbar && !sperreErledigt
          ? <HakenZiel an={z.zustand === 'erledigt'} farbe={LEUCHT.gut} label={titel} onChange={() => status(z, z.zustand === 'erledigt' ? 'offen' : 'erledigt')} />
          : <span style={{ width: 44, display: 'inline-grid', placeItems: 'center', flex: '0 0 auto' }}><Punkt farbe={STATUS_FARBE[z.zustand]} /></span>}
        titel={<span style={{ color: z.fertig ? C.inkDim : C.ink, textDecoration: z.zustand === 'entfaellt' ? 'line-through' : 'none' }}>{titel}</span>}
        unter={(z.bausteine.length || k.faelligAm || kunde || k.grund || (k.extra && !z.abgeleitet) || (sprung && !z.fertig) || v) ? (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {z.bausteine.map(b => {
              const bb = b.bausteinId ? bausteine.get(b.bausteinId) : undefined;
              const name = bb ? (bb.titel === k.titel ? `${bb.art} öffnen` : bb.titel) : b.bausteinId ? `${b.titel} (Baustein entfernt)` : b.titel;
              return (
                <span key={b.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {bb ? <Link href={WEG.fulfillment('bausteine', { b: bb.id })} style={{ color: C.aktiv, fontSize: TYP.bedien }} onClick={e => e.stopPropagation()}>▤ {name}</Link> : <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>▤ {name}</span>}
                  {bb && <BausteinMarken b={bb} />}
                </span>
              );
            })}
            {k.faelligAm && !z.fertig && <Chip farbe={z.ueberfaellig ? LEUCHT.kritisch : C.inkDim}>{z.ueberfaellig ? 'überfällig ' : 'bis '}{tagKurz(k.faelligAm)}</Chip>}
            {kunde && !z.fertig && <Chip farbe={LEUCHT.achtung}>macht der Kunde</Chip>}
            {v && (
              <button type="button" className="fassbar" onClick={e => { e.stopPropagation(); geh(v.reiter, v.stelle ? { art: 'stelle', wert: v.stelle } : undefined); }}
                style={{ background: 'none', border: 'none', padding: '4px 0', minHeight: 44, cursor: 'pointer', color: v.farbe, fontSize: TYP.bedien, fontFamily: SCHRIFT.text, textAlign: 'left' }}>
                {v.text} ›
              </button>
            )}
            {k.extra && !z.abgeleitet && k.id !== OB_TEIL_ID && <Chip farbe={C.inkDim}>Zusatz{k.kundeSichtbar ? ' · für den Kunden sichtbar' : ''}</Chip>}
            {z.zustand === 'entfaellt' && k.grund && <span style={klein}>Entfällt: {k.grund}</span>}
            {sprung && !z.fertig && <span style={{ ...klein, color: C.inkLeise }}>wird automatisch erledigt, sobald es da ist</span>}
          </span>
        ) : undefined}
        rechts={
          <span className="ff-ablauf-aktion" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0, maxWidth: '100%' }}>
            {eigeneFreigabe && !f.freigaben[eigeneFreigabe.id] && !sprung && <Erklaert erklaerung="fulfillment.freigabe" name={fgName}><Knopf haupt={haupt} leise={!haupt} onClick={() => onFreigabe(eigeneFreigabe.id)}>{fgName} vermerken</Knopf></Erklaert>}
            {eigeneFreigabe && f.freigaben[eigeneFreigabe.id] && <Chip farbe={LEUCHT.gut}>{fgName} vermerkt {tagKurz(f.freigaben[eigeneFreigabe.id].am)}</Chip>}
            {setzbar
              ? <Wahl<KnotenStatus> label="Status" klein liste={wahl.map(s => ({ id: s, label: STATUS_TEXT[s] }))} wert={z.zustand} farbe={STATUS_FARBE[z.zustand]} onWahl={s => status(z, s)} />
              : sprung && !z.fertig
                ? <Knopf haupt={haupt} leise={!haupt} onClick={() => zuOnboarding(sprung)}>{ONBOARDING_SPRUNG[sprung].text}{sprung === 'f0' || sprung === 'willkommen' ? '' : ' ›'}</Knopf>
                : <Chip farbe={STATUS_FARBE[z.zustand]}>{STATUS_TEXT[z.zustand]} · automatisch</Chip>}
          </span>
        } />
    </ZeileAktionen>
  );
}

/** Der Abstimmungspunkt am Ende der Phase: wer bestätigt, Knopf „vermerken“ bzw. vermerkt (zurücknehmen hinter „⋯“). */
export function FreigabeMeilenstein({ fg, gegeben, onVermerken, onZurueck, haupt }: {
  fg: { id: string; nr?: number; titel: string; wer: keyof typeof FREIGABE_WER }; gegeben?: NonNullable<FallAntwort['fall']>['freigaben'][string]; onVermerken: () => void; onZurueck: () => void; haupt?: boolean;
}) {
  const wie = gegeben?.kunde ? WIE.find(w => w.id === gegeben.kunde!.wie)?.label : undefined;
  return (
    <Karte i={0} className="ff-ablauf" id="ff-detail">
      <ZeileAktionen titel={`Bestätigung${fg.nr ? ` ${fg.nr}` : ''}`} mehr={gegeben ? [{ id: 'zurueck', label: 'Vermerk zurücknehmen', hinweis: 'Die Bestätigung gilt dann wieder als offen.', tun: onZurueck }] : []}>
        <Zeile umbrechen
          links={<span style={{ width: 44, display: 'inline-grid', placeItems: 'center', flex: '0 0 auto' }}><FreigabeRaute gegeben={!!gegeben} aktiv groesse={16} /></span>}
          titel={<span>Bestätigung{fg.nr ? ` ${fg.nr}` : ''}{fg.titel ? ` · ${fg.titel}` : ''}</span>}
          unter={gegeben ? `${gegeben.kunde ? `bestätigt am ${tagKurz(gegeben.kunde.am)}${wie ? ` ${wie}` : ''} · ` : ''}vermerkt am ${tagKurz(gegeben.am)}${gegeben.notiz ? ` · ${gegeben.notiz}` : ''}` : `Haltepunkt am Ende der Phase — ${FREIGABE_WER[fg.wer]}, dann geht es weiter.`}
          rechts={gegeben ? <Chip farbe={LEUCHT.gut}>vermerkt</Chip> : <Erklaert erklaerung="fulfillment.freigabe" name="Bestätigung"><Knopf haupt={haupt} onClick={onVermerken}>Bestätigung vermerken</Knopf></Erklaert>} />
      </ZeileAktionen>
    </Karte>
  );
}

export function FreigabeDialog({ id, daten, onZu, ops }: { id: string; daten: FallAntwort; onZu: () => void; ops: Ops }) {
  const fg = daten.vorlage?.freigaben.find(x => x.id === id);
  const name = abstimmungName(id, abstimmungsNummern(daten.fall?.knoten ?? []), fg?.titel);
  const [wie, setWie] = useState<typeof WIE[number]['id'] | null>(null);
  const [am, setAm] = useState(localDay());
  const [notiz, setNotiz] = useState('');
  return (
    <Fenster titel={`${name} vermerken`} onZu={onZu} breit={520}>
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
export function ExtraDialog({ phaseId, fall, onZu, ops }: { phaseId: string; fall: NonNullable<FallAntwort['fall']>; onZu: () => void; ops: Ops }) {
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

/** Status eines Schritts setzen (bei „entfällt“ mit Grund) — Schritt UND Bausteine in EINER Anfrage. */
export function statusSetzer(f: NonNullable<FallAntwort['fall']>, ops: Ops, fragen: (titel: string) => Promise<string | null>) {
  const stand = (k: FallKnoten) => f.knoten.find(x => x.id === k.id)?.stand;
  return async (z: SchrittZeile, s: KnotenStatus) => {
    if (s === 'entfaellt') { const grund = await fragen(`Warum entfällt „${z.knoten.titel}“?`); if (grund) await ops(statusOps(z, s, grund, stand)); return; }
    await ops(statusOps(z, s, undefined, stand));
  };
}

/**
 * Ein Schritt, den der Fall selbst führt (Quick Wins, Befähigung, Wirkungsbericht, Diagnose, Dossier), zeigt seinen Stand und führt dorthin (12.10.,
 * „keine losen Enden“). Seit 17.10.: Quick Wins unter „Ziele & Wirkung“, Analyse und Abschluss an ihrer Phase in der Reise.
 */
function verweisAnzeige(v: SchrittVerweis, d: FallAntwort): { text: string; reiter: FallReiter; stelle?: string; farbe: string } {
  const f = d.fall!;
  switch (v) {
    case 'quickwins': {
      const n = f.quickWins.length, e = f.quickWins.filter(q => q.erledigtAm).length;
      if (n) return { text: e === n ? `${n === 1 ? 'Quick Win' : `alle ${n} Quick Wins`} erledigt — Schritt abhaken` : `${e} von ${n} ${wort(n, 'Quick Win', 'Quick Wins')} erledigt`, reiter: 'ziele', stelle: 'quickwins', farbe: e === n ? LEUCHT.gut : C.aktiv };
      return d.analyse?.quickWins.length
        ? { text: `${anzahl(d.analyse.quickWins.length, 'Quick Win', 'Quick Wins')} aus der Analyse bereit`, reiter: 'reise', stelle: 'analyse', farbe: LEUCHT.achtung }
        : { text: 'Quick Wins festlegen', reiter: 'ziele', stelle: 'quickwins', farbe: C.aktiv };
    }
    case 'befaehigung': {
      const n = f.befaehigung.length, e = f.befaehigung.filter(b => b.erfuellt).length;
      return { text: `Befähigung: ${e} von ${n} ${wort(n, 'Kriterium', 'Kriterien')} erfüllt`, reiter: 'reise', stelle: 'kreislauf-befaehigung', farbe: n && e === n ? LEUCHT.gut : C.aktiv };
    }
    case 'wirkung':
      return f.wirkung
        ? { text: `Wirkungsbericht vom ${tagKurz(f.wirkung.erstelltAm)}`, reiter: 'reise', stelle: 'kreislauf-wirkung', farbe: LEUCHT.gut }
        : { text: 'Wirkungsbericht erstellen', reiter: 'reise', stelle: 'kreislauf-wirkung', farbe: C.aktiv };
    case 'diagnose':
      return !d.analyse?.diagnose
        ? { text: 'Der Diagnose-Entwurf kommt aus der Analyse', reiter: 'reise', stelle: 'analyse', farbe: C.aktiv }
        : d.analyse.massnahmen.length
          ? { text: `${d.analyse.massnahmen.length} Maßnahme${d.analyse.massnahmen.length === 1 ? '' : 'n'} der Diagnose noch nicht im Fall`, reiter: 'reise', stelle: 'analyse', farbe: LEUCHT.achtung }
          : { text: 'Diagnose-Entwurf im Fall — Maßnahmen stehen im Ablauf', reiter: 'reise', stelle: 'analyse', farbe: LEUCHT.gut };
    case 'dossier':
      return !d.analyse ? { text: 'Dossier anlegen', reiter: 'reise', stelle: 'analyse', farbe: C.aktiv } : d.analyse.f2 ? { text: 'Dossier geprüft', reiter: 'reise', stelle: 'analyse', farbe: LEUCHT.gut } : { text: 'Dossier in Arbeit', reiter: 'reise', stelle: 'analyse', farbe: C.aktiv };
  }
}
