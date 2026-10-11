'use client';

// ─── Fulfillment › Fall › Ablauf (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 7.2–7.4) ──────────────────────────────────────────────────
// Der Plan des Falls (Kopie der Vorlage) als Baum: je Schritt Status (offen · in Arbeit · wartet auf Kunde · erledigt · entfällt mit Grund),
// Fälligkeit, Baustein (Titel live aus der Bibliothek, Marken), „Freigabe vermerken“ an Schritten mit Freigabepunkt (Tag, wie bestätigt, Notiz —
// die nächste Phase darf vorher beginnen, dann ein Hinweis), Zusatz-Schritte. Onboarding-Schritte werden abgeleitet (nie von Hand „erledigt“).
// Nach jedem Klick zieht der Server Phase und Lieferobjekte ins Vorhandene nach.

import { useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Chip, Feldzeile, Pillen, LEUCHT, Erklaert } from '../../ui';
import { Fenster } from '../../Fenster';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { ebeneVon, inReihenfolge, kinderVon } from '@/lib/fulfillment/regeln';
import { obSchluessel } from '@/lib/fulfillment/prozesse/onboarding';
import { localDay } from '@/lib/zeit';
import type { FallKnoten, KnotenStatus } from '@/lib/fulfillment/typen';
import { useFall, fallOps, fallAktion, fehlerText, tagKurz, STATUS_TEXT, type FallAntwort, type MitStand } from './daten';
import { klein, feld, Leiste, Meldung, useTextFrage } from './teile';

const STATUS_FARBE: Record<KnotenStatus, string> = { offen: C.inkLeise, in_arbeit: LEUCHT.planung, wartet_kunde: LEUCHT.achtung, erledigt: LEUCHT.gut, entfaellt: C.inkLeise };
const WIE = [{ id: 'kickoff' as const, label: 'im Kick-off' }, { id: 'termin' as const, label: 'im Termin' }, { id: 'mail' as const, label: 'per Mail' }, { id: 'link' as const, label: 'über den Link' }];

export function FallAblauf({ mandatId }: { mandatId: string }) {
  const { daten, fehler } = useFall(mandatId);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'achtung' } | null>(null);
  const [freigabe, setFreigabe] = useState<string | null>(null);
  const [extra, setExtra] = useState<string | null>(null);
  const frage = useTextFrage();
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  if (!daten.fall) return <Hinweis art="info">Für dieses Mandat läuft noch kein Fall — unter „Überblick“ das Onboarding starten.</Hinweis>;
  const f = daten.fall;
  const ops = async (o: Record<string, unknown>[]) => {
    const a = await fallOps(mandatId, o);
    if (!a.ok) setMeldung({ text: fehlerText(a), art: 'kritisch' });
    else if (a.j.nachzug?.fehler) setMeldung({ text: `Gespeichert, aber nicht nachgezogen: ${a.j.nachzug.fehler}`, art: 'achtung' });
    else setMeldung(a.j.nachzug?.phase === 'gesetzt' ? { text: 'Die Phase am Mandat ist mitgezogen.', art: 'gut' } : null);
  };
  const status = async (k: MitStand<FallKnoten>, s: KnotenStatus) => {
    if (s === 'entfaellt') { const grund = await frage.fragen(`Warum entfällt „${k.titel}“?`); if (grund) await ops([{ op: 'knoten-status', id: k.id, status: s, grund, stand: k.stand }]); return; }
    await ops([{ op: 'knoten-status', id: k.id, status: s, stand: k.stand }]);
  };
  const reihe = inReihenfolge(f.knoten);
  const bausteine = new Map((daten.bausteine ?? []).map(b => [b.id, b]));
  const phasen = kinderVon(f.knoten.find(x => !x.elternId)?.id, f.knoten);
  const freigabeOffenVor = (k: FallKnoten) => {
    const i = phasen.findIndex(p => p.id === k.id);
    return i > 0 ? phasen.slice(0, i).find(p => p.freigabe && !f.freigaben[p.freigabe]) : undefined;
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Meldung text={meldung?.text ?? null} art={meldung?.art} />
      {meldung?.art === 'achtung' && <div><Knopf leise onClick={async () => { const a = await fallAktion({ aktion: 'nachziehen', mandatId }); setMeldung(a.ok ? { text: 'Nachgezogen.', art: 'gut' } : { text: fehlerText(a), art: 'kritisch' }); }}>Erneut nachziehen</Knopf></div>}
      <Karte i={1}>
        <Ueberschrift erklaerung="fulfillment.fortschritt" rechts={<span>{daten.fortschritt ?? 0} %</span>}>{daten.vorlage?.titel ?? 'Ablauf'}</Ueberschrift>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
          {reihe.map(k => {
            const eb = ebeneVon(k, f.knoten);
            if (eb === 1) return null;
            const b = k.bausteinId ? bausteine.get(k.bausteinId) : undefined;
            const ob = !!obSchluessel(k.id);
            const fg = k.freigabe ? daten.vorlage?.freigaben.find(x => x.id === k.freigabe) : undefined;
            const gegeben = k.freigabe ? f.freigaben[k.freigabe] : undefined;
            const offenVor = eb === 2 && daten.aktuell?.phase?.id === k.id ? freigabeOffenVor(k) : undefined;
            const ueber = k.faelligAm && k.faelligAm < localDay() && k.status !== 'erledigt' && k.status !== 'entfaellt';
            const statusWahl = (Object.keys(STATUS_TEXT) as KnotenStatus[]).filter(s => !(s === 'erledigt' && (ob || k.freigabe)));
            return (
              <li key={k.id} style={{ display: 'grid', gap: 6, padding: '8px 0', paddingLeft: (eb - 2) * 16, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: eb === 2 ? TYP.body : TYP.bedien, fontWeight: eb === 2 ? 600 : 400, color: k.status === 'entfaellt' ? C.inkLeise : C.ink, textDecoration: k.status === 'entfaellt' ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>
                    {b ? <Link href={WEG.fulfillment('bausteine', { b: b.id })} style={{ color: C.aktiv }}>{b.titel}</Link> : k.bausteinId ? `${k.titel} (Baustein entfernt)` : k.titel}
                  </span>
                  {b?.nurIntern && <Chip farbe={LEUCHT.agenten}>nur intern</Chip>}
                  {b?.rechtOffen && <Chip farbe={LEUCHT.achtung}>rechtlich prüfen</Chip>}
                  {k.extra && !ob && <Chip farbe={C.inkDim}>Zusatz</Chip>}
                  {k.faelligAm && <Chip farbe={ueber ? LEUCHT.kritisch : C.inkDim}>{ueber ? 'überfällig ' : 'bis '}{tagKurz(k.faelligAm)}</Chip>}
                  {ob ? <Chip farbe={STATUS_FARBE[k.status]}>{STATUS_TEXT[k.status]} (abgeleitet)</Chip>
                    : <Wahl<KnotenStatus> label="Status" klein liste={statusWahl.map(s => ({ id: s, label: STATUS_TEXT[s] }))} wert={k.status} farbe={STATUS_FARBE[k.status]} onWahl={s => status(k, s)} />}
                </div>
                {k.status === 'entfaellt' && k.grund && <div style={klein}>Entfällt: {k.grund}</div>}
                {fg && (
                  <Leiste>
                    {gegeben ? <Chip farbe={LEUCHT.gut}>{fg.id} vermerkt {tagKurz(gegeben.am)}{gegeben.kunde ? ` · ${WIE.find(w => w.id === gegeben.kunde!.wie)?.label}` : ''}</Chip>
                      : <Erklaert erklaerung="fulfillment.freigabe" name={`Freigabe ${fg.id}`}><Knopf leise onClick={() => setFreigabe(fg.id)}>Freigabe {fg.id} vermerken</Knopf></Erklaert>}
                    {gegeben && <Knopf leise onClick={() => ops([{ op: 'freigabe', id: fg.id, zuruecknehmen: true }])}>zurücknehmen</Knopf>}
                  </Leiste>
                )}
                {offenVor && <Hinweis art="achtung">Diese Phase läuft, obwohl die Freigabe {offenVor.freigabe} der Phase „{offenVor.titel}“ noch nicht vermerkt ist.</Hinweis>}
                {eb <= 3 && !ob && <div><Knopf leise onClick={() => setExtra(k.id)}>+ Zusatz-Schritt</Knopf>{k.extra && !ob && <Knopf leise onClick={() => ops([{ op: 'knoten-extra', id: k.id, weg: true }])}>Zusatz entfernen</Knopf>}</div>}
              </li>
            );
          })}
        </ol>
      </Karte>
      {freigabe && <FreigabeDialog id={freigabe} daten={daten} onZu={() => setFreigabe(null)} ops={ops} />}
      {extra && <ExtraDialog elternId={extra} onZu={() => setExtra(null)} ops={ops} />}
      {frage.dialog}
    </div>
  );
}

function FreigabeDialog({ id, daten, onZu, ops }: { id: string; daten: FallAntwort; onZu: () => void; ops: (o: Record<string, unknown>[]) => Promise<void> }) {
  const fg = daten.vorlage?.freigaben.find(x => x.id === id);
  const [wie, setWie] = useState<typeof WIE[number]['id'] | null>(null);
  const [am, setAm] = useState(localDay());
  const [notiz, setNotiz] = useState('');
  return (
    <Fenster titel={`Freigabe ${id}${fg ? ` · ${fg.titel}` : ''} vermerken`} onZu={onZu} breit={520}>
      <form onSubmit={e => { e.preventDefault(); void ops([{ op: 'freigabe', id, ...(wie ? { kunde: { wie, am } } : {}), ...(notiz.trim() ? { notiz: notiz.trim() } : {}) }]).then(onZu); }} style={{ display: 'grid', gap: 10 }}>
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

function ExtraDialog({ elternId, onZu, ops }: { elternId: string; onZu: () => void; ops: (o: Record<string, unknown>[]) => Promise<void> }) {
  const [titel, setTitel] = useState('');
  const [faellig, setFaellig] = useState('');
  return (
    <Fenster titel="Zusatz-Schritt" onZu={onZu} breit={480}>
      <form onSubmit={e => { e.preventDefault(); if (titel.trim()) void ops([{ op: 'knoten-extra', eintrag: { elternId, titel: titel.trim(), ...(faellig ? { faelligAm: faellig } : {}) } }]).then(onZu); }} style={{ display: 'grid', gap: 10 }}>
        <Feldzeile label="Titel"><input value={titel} autoFocus onChange={e => setTitel(e.target.value)} style={feld} /></Feldzeile>
        <Feldzeile label="Fällig am"><input type="date" value={faellig} onChange={e => setFaellig(e.target.value)} style={feld} /></Feldzeile>
        <div style={klein}>Ein Zusatz-Schritt gilt nur für diesen Fall — die Vorlage bleibt, wie sie ist.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf haupt typ="submit" aus={!titel.trim()}>Anlegen</Knopf>
        </div>
      </form>
    </Fenster>
  );
}
