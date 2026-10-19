'use client';

// ─── Produkt-Karte · Ablauf (P2, 19.10.) ─────────────────────────────────────────────────────────────────────────────────
// Welcher Ablauf (Fulfillment-Vorlage) einen neuen Fall dieses Produkts liefert — über die vorhandene Zuordnung (`vorlagenOps` `zuordnung`,
// PATCH /api/fulfillment). „Ablauf öffnen ›“ führt in den Ablauf, „+ neuer Ablauf“ legt eine leere Vorlage mit dem Namen des Produkts an,
// ordnet sie zu und öffnet den Prozess-Editor. Ohne Fulfillment-Zugang (z. B. Konto ohne Modul) steht nur ein Satz da. Die alten Phasen
// (Mandat-Phase) bleiben lesbar und pflegbar — aufgeklappt.

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP, ECKE, FLAECHE_STIL } from '@/lib/make-one/design';
import { Knopf, Hinweis, Chip, SymbolKnopf, LEUCHT } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { neuePhasenId } from '@/lib/crm/produkte';
import type { Leistung, ProduktPhase } from '@/lib/crm/typen';
import { useUebersichtKurz, vorlagenOps, holeJson, neueAnfrageId, geaendert, fehlerText } from '../../fulfillment/prozesse/daten';
import type { Speichern } from './Abschnitte';
import { TextFeld, ZahlFeld } from './felder';

/** Der zugeordnete Ablauf — `undefined` solange geladen wird, `null` ohne Fulfillment-Zugang. Für die Zusammenfassung der Karte. */
export function useAblauf(leistungId: string): { titel: string | null; id: string | null } | null | undefined {
  const { daten, fehler } = useUebersichtKurz();
  if (!daten) return fehler ? null : undefined;
  const id = daten.zuordnung[leistungId]?.vorlageId ?? null;
  return { id, titel: id ? daten.prozesse.find(p => p.id === id)?.titel ?? null : null };
}

export function AblaufTeil({ l, mandateJePhase, speichern }: { l: Leistung; mandateJePhase: (phaseId: string) => number; speichern: Speichern }) {
  const router = useRouter();
  const { daten, fehler: ladeFehler } = useUebersichtKurz();
  const [fehler, setFehler] = useState<string | null>(null);
  const [phasenAuf, setPhasenAuf] = useState(false);
  const anfrage = useRef(neueAnfrageId());
  const pakete = daten?.prozesse.filter(p => p.art === 'paket') ?? [];
  const vorlageId = daten?.zuordnung[l.id]?.vorlageId ?? null;
  const vorlage = pakete.find(p => p.id === vorlageId);
  const zuordnen = async (id: string | null) => {
    const a = await vorlagenOps([{ op: 'zuordnung', leistungId: l.id, vorlageId: id }]);
    setFehler(a.ok ? null : fehlerText(a));
    if (a.ok) geaendert();
  };
  const neuerAblauf = async () => {
    const a = await holeJson<{ vorlageId?: string }>('/api/fulfillment/editor', { method: 'POST', body: JSON.stringify({ aktion: 'neu', titel: l.name, anfrageId: anfrage.current }) });
    if (!a.ok || !a.j.vorlageId) { setFehler(fehlerText(a)); return; }
    const z = await vorlagenOps([{ op: 'zuordnung', leistungId: l.id, vorlageId: a.j.vorlageId }]);
    if (!z.ok) { setFehler(fehlerText(z)); return; }
    anfrage.current = neueAnfrageId();
    geaendert();
    router.push(WEG.fulfillment('prozesse', { e: a.j.vorlageId }));
  };
  const phasen = l.phasen ?? [];
  const setzePhasen = (neu: ProduktPhase[]) => speichern({ phasen: neu });
  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      {!daten && ladeFehler && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Abläufe (Fulfillment) sind für dieses Konto nicht freigeschaltet.</div>}
      {!daten && !ladeFehler && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Abläufe laden …</div>}
      {daten && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Wahl label="Ablauf für neue Fälle" liste={pakete.map(p => ({ id: p.id, label: p.titel }))} wert={vorlageId} leer="kein Ablauf zugeordnet" onWahl={id => void zuordnen(id)} onLeeren={() => void zuordnen(null)} leerenLabel="ohne Ablauf" />
            {vorlage && <Link href={WEG.fulfillment('prozesse', { k: vorlage.id })} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Ablauf öffnen ›</Link>}
            <Knopf leise onClick={neuerAblauf}>+ neuer Ablauf</Knopf>
          </div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{vorlage ? `Ein neuer Kunde dieses Produkts bekommt den Ablauf „${vorlage.titel}“ als Fall.` : 'Ohne Ablauf startet ein neuer Kunde ohne Fall — „+ neuer Ablauf“ legt einen mit dem Namen des Produkts an.'}</div>
        </>
      )}
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      {phasen.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Phasen am Mandat</span>
            <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{phasen.map(p => p.name).join(' → ')}</span>
            <Knopf leise onClick={() => setPhasenAuf(!phasenAuf)}>{phasenAuf ? 'Fertig' : 'Phasen bearbeiten'}</Knopf>
          </div>
          {phasenAuf && phasen.map((ph, i) => {
            const dort = mandateJePhase(ph.id);
            return (
              <div key={ph.id} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) minmax(0, 110px) auto', gap: 8, alignItems: 'end' }}>
                <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, color: LEUCHT.business, textAlign: 'center', paddingBottom: 12 }}>{i + 1}</span>
                <TextFeld label="Phase" wert={ph.name} max={80} onFertig={async t => (t.trim() ? ((await setzePhasen(phasen.map(x => (x.id === ph.id ? { ...x, name: t.trim() } : x)))) ? undefined : 'Nicht gespeichert.') : 'Name fehlt.')} />
                <ZahlFeld label="Tage" wert={ph.dauerTage} max={730} onFertig={async n => ((await setzePhasen(phasen.map(x => (x.id === ph.id ? { ...x, dauerTage: n ?? undefined } : x)))) ? undefined : 'Nicht gespeichert.')} />
                <span className="ui-symbole" style={{ paddingBottom: 2 }}>
                  {dort > 0 && <Chip farbe={LEUCHT.gut}>{dort} hier</Chip>}
                  <SymbolKnopf ariaLabel={`Phase ${i + 1} entfernen`} gefahr aus={dort > 0} titel={dort ? 'Hier stehen noch Mandate' : undefined} onClick={() => void setzePhasen(phasen.filter(x => x.id !== ph.id))}>×</SymbolKnopf>
                </span>
              </div>
            );
          })}
          {phasenAuf && <div><Knopf leise onClick={() => setzePhasen([...phasen, { id: neuePhasenId(l), name: `Phase ${phasen.length + 1}` }])}>+ Phase</Knopf></div>}
          <span style={{ ...FLAECHE_STIL.leise, fontSize: TYP.bedien, color: C.inkDim, borderRadius: ECKE.eingabe, padding: '6px 10px' }}>Die Phasen zeigen, wo ein Mandat gerade steht — der Ablauf oben ist der Weg für neue Fälle.</span>
        </div>
      )}
    </div>
  );
}
