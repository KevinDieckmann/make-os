'use client';

// ─── Produkt-Karte · Ablauf (P2, 19.10.; Prozesse × Fulfillment 22.10.) ─────────────────────────────────────────────────────────────────────────────
// Welcher Ablauf ein neues Mandat dieses Produkts begleitet — genau EINER (Kevin 21.10.: „Fulfillment = das Werkzeug … jedes Produkt zeigt auf seinen Prozess“):
//   · ein Paket des Fulfillments (vorhandene Zuordnung `vorlagenOps` `zuordnung`, PATCH /api/fulfillment) — der Fall startet wie bisher im Fulfillment;
//     „Im Editor öffnen ›“ führt in den vorhandenen Prozess-Editor, „+ neuer Ablauf“ legt eine leere Paket-Vorlage mit dem Namen des Produkts an.
//   · ein Prozess der Werkstatt (`Leistung.prozessId` über `speichern` = `api.teil` mit Stand) — ein neues Mandat startet seinen Lauf im Motor (Probelauf =
//     Schatten, scharf erst nach „scharf schalten“); „In der Werkstatt öffnen ›“, „Prozess für dieses Produkt anlegen“ öffnet „Neuer Prozess“ (Fulfillment,
//     Mandat, Name = Produkt, Eigner wählen) und verknüpft ihn.
// Der Wechsel geht über `ablaufWechsel` (lib/prozesse/produkt-bindung.ts): erst das Neue setzen, dann das Alte lösen. Ohne Fulfillment- bzw. Werkstatt-Zugang
// steht nur, was das Konto sieht. Die alten Phasen (Mandat-Phase) bleiben lesbar und pflegbar — aufgeklappt.

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP, ECKE, FLAECHE_STIL } from '@/lib/make-one/design';
import { Knopf, Hinweis, Chip, SymbolKnopf, Erklaert, LEUCHT } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { neuePhasenId } from '@/lib/crm/produkte';
import type { Leistung, ProduktPhase } from '@/lib/crm/typen';
import { ablaufVon, ablaufWechsel, fuerProduktWaehlbar, type AblaufSchritt } from '@/lib/prozesse/produkt-bindung';
import { useUebersichtKurz, vorlagenOps, holeJson, neueAnfrageId, geaendert, fehlerText } from '../../fulfillment/prozesse/daten';
import { useWerkstattListe } from '../../prozesse/werkstatt-daten';
import { NeuerProzessFenster } from '../../prozesse/WerkstattUebersicht';
import type { Speichern } from './Abschnitte';
import { TextFeld, ZahlFeld } from './felder';

const STATUS_WORT: Readonly<Record<string, string>> = { entwurf: 'Entwurf', probelauf: 'Probelauf', aktiv: 'aktiv', pausiert: 'pausiert', archiviert: 'archiviert' };

/** Pakete (Fulfillment) und wählbare Prozesse (Werkstatt) — beide Listen; `null`, wo das Konto keinen Zugang hat. */
function useAblaeufe() {
  const kurz = useUebersichtKurz();
  const werkstatt = useWerkstattListe();
  const pakete = kurz.daten ? kurz.daten.prozesse.filter(p => p.art === 'paket') : null;
  const prozesse = werkstatt.daten ? werkstatt.daten.prozesse.filter(fuerProduktWaehlbar) : null;
  return { kurz, werkstatt, pakete, prozesse, zuordnung: kurz.daten?.zuordnung ?? null };
}

/** Der Ablauf des Produkts — `undefined` solange geladen wird, `null` ohne jeden Zugang. Für die Zusammenfassung der Karte. */
export function useAblauf(l: Pick<Leistung, 'id' | 'prozessId'>): { titel: string | null; id: string | null } | null | undefined {
  const { kurz, werkstatt, pakete, zuordnung } = useAblaeufe();
  if (!kurz.daten && !werkstatt.daten) return kurz.fehler && werkstatt.fehler ? null : undefined;
  const w = ablaufVon(l, zuordnung);
  if (!w) return { id: null, titel: null };
  // Ein Prozess, den die Liste (noch) nicht kennt: der Verweis zählt — der Titel kommt, sobald die Werkstatt geladen ist.
  const titel = w.art === 'prozess' ? werkstatt.daten?.prozesse.find(p => p.id === w.id)?.titel ?? (werkstatt.daten ? 'Prozess (nicht gefunden)' : null) : pakete?.find(p => p.id === w.id)?.titel ?? null;
  return { id: w.id, titel };
}

export function AblaufTeil({ l, mandateJePhase, speichern }: { l: Leistung; mandateJePhase: (phaseId: string) => number; speichern: Speichern }) {
  const router = useRouter();
  const { kurz, werkstatt, pakete, prozesse, zuordnung } = useAblaeufe();
  const [fehler, setFehler] = useState<string | null>(null);
  const [phasenAuf, setPhasenAuf] = useState(false);
  const [neuOffen, setNeuOffen] = useState(false);
  const anfrage = useRef(neueAnfrageId());
  const wahl = ablaufVon(l, zuordnung);
  const paket = wahl?.art === 'paket' ? pakete?.find(p => p.id === wahl.id) : undefined;
  const prozess = wahl?.art === 'prozess' ? werkstatt.daten?.prozesse.find(p => p.id === wahl.id) : undefined;
  const darfAnlegen = !!werkstatt.daten?.rechte.entwurf;

  /** Die Schritte nacheinander (erst das Neue, dann das Alte) — beim ersten Fehler steht der Satz da, der Rest unterbleibt. */
  const ausfuehren = async (schritte: readonly AblaufSchritt[]): Promise<boolean> => {
    for (const s of schritte) {
      if (s.art === 'produkt') {
        if (!(await speichern({ prozessId: s.prozessId }))) { setFehler('Der Prozess ließ sich nicht am Produkt speichern.'); return false; }
      } else {
        const a = await vorlagenOps([{ op: 'zuordnung', leistungId: l.id, vorlageId: s.vorlageId }]);
        if (!a.ok) { setFehler(fehlerText(a)); return false; }
      }
    }
    setFehler(null);
    if (schritte.some(s => s.art === 'zuordnung')) geaendert();
    void werkstatt.laden();
    return true;
  };
  const waehlen = (id: string | null) => ausfuehren(ablaufWechsel(l, zuordnung, id));

  const neuerAblauf = async () => {
    const a = await holeJson<{ vorlageId?: string }>('/api/fulfillment/editor', { method: 'POST', body: JSON.stringify({ aktion: 'neu', titel: l.name, anfrageId: anfrage.current }) });
    if (!a.ok || !a.j.vorlageId) { setFehler(fehlerText(a)); return; }
    if (!(await ausfuehren(ablaufWechsel(l, zuordnung, a.j.vorlageId)))) return;
    anfrage.current = neueAnfrageId();
    router.push(WEG.fulfillment('prozesse', { e: a.j.vorlageId }));
  };
  /** „Prozess für dieses Produkt anlegen“: angelegt über den EINEN Schreibweg der Werkstatt, dann verknüpft, dann in die Werkstatt. */
  const prozessAngelegt = async (id: string) => {
    setNeuOffen(false);
    if (await ausfuehren(ablaufWechsel(l, zuordnung, id))) router.push(WEG.prozesse({ p: id, ansicht: 'werkstatt' }));
  };

  const liste = [
    ...(pakete ?? []).map(p => ({ id: p.id, label: p.titel, hinweis: p.zusatz ? 'Ablauf (Fulfillment) · Zusatzmodul' : 'Ablauf (Fulfillment)' })),
    ...(prozesse ?? []).map(p => ({ id: p.id, label: p.titel, hinweis: `Prozess (Werkstatt) · ${p.status ? STATUS_WORT[p.status] ?? p.status : 'Entwurf'}` })),
  ];
  // Ein Prozess, der nicht (mehr) wählbar ist (archiviert, andere Fall-Art), bleibt sichtbar gewählt — mit Hinweis, nie still gelöst.
  if (wahl?.art === 'prozess' && !liste.some(x => x.id === wahl.id)) liste.push({ id: wahl.id, label: prozess?.titel ?? 'Prozess (nicht gefunden)', hinweis: 'passt nicht mehr' });
  const laedt = !kurz.daten && !werkstatt.daten && !(kurz.fehler && werkstatt.fehler);
  const ohneZugang = !kurz.daten && !werkstatt.daten && kurz.fehler && werkstatt.fehler;
  const passtNicht = wahl?.art === 'prozess' && werkstatt.daten && !(prozesse ?? []).some(p => p.id === wahl.id);
  const phasen = l.phasen ?? [];
  const setzePhasen = (neu: ProduktPhase[]) => speichern({ phasen: neu });
  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      {ohneZugang && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Abläufe (Fulfillment) und Prozesse sind für dieses Konto nicht freigeschaltet.</div>}
      {laedt && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Abläufe laden …</div>}
      {!laedt && !ohneZugang && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Erklaert erklaerung="fulfillment.zuordnung" name="Ablauf für neue Fälle">
              <Wahl label="Ablauf für neue Fälle" liste={liste} wert={wahl?.id ?? null} leer="kein Ablauf zugeordnet" onWahl={id => void waehlen(id)} onLeeren={() => void waehlen(null)} leerenLabel="ohne Ablauf" />
            </Erklaert>
            {paket && <Link href={WEG.fulfillment('prozesse', { e: paket.id })} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Im Editor öffnen ›</Link>}
            {wahl?.art === 'prozess' && <Link href={WEG.prozesse({ p: wahl.id, ansicht: 'werkstatt' })} style={{ color: C.aktiv, fontSize: TYP.bedien }}>In der Werkstatt öffnen ›</Link>}
            {pakete && <Knopf leise onClick={neuerAblauf}>+ neuer Ablauf</Knopf>}
            {darfAnlegen && <Knopf leise onClick={() => setNeuOffen(true)}>Prozess für dieses Produkt anlegen</Knopf>}
          </div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
            {paket ? `Ein neuer Kunde dieses Produkts bekommt den Ablauf „${paket.titel}“ als Fall.`
              : wahl?.art === 'prozess' ? `Ein neues Mandat mit diesem Produkt${l.rolle === 'zusatz' || l.rolle === 'beides' ? ' (bzw. dieses Produkt als gebuchtes Zusatzmodul)' : ''} startet den Prozess „${prozess?.titel ?? '…'}“${prozess ? (prozess.status === 'aktiv' ? '.' : prozess.status === 'probelauf' ? ' — im Probelauf zuerst ohne Wirkung (Schatten).' : ' — sobald er veröffentlicht und im Probelauf bzw. aktiv ist.') : '.'}`
              : 'Ohne Ablauf startet ein neuer Kunde ohne Fall — „+ neuer Ablauf“ legt einen Ablauf im Fulfillment mit dem Namen des Produkts an, „Prozess für dieses Produkt anlegen“ einen Prozess in der Werkstatt.'}
          </div>
          {passtNicht && <Hinweis art="achtung">Dieser Prozess passt nicht mehr zu einem Produkt (archiviert oder hängt nicht mehr an einem Mandat) — ein neues Mandat startet ihn nicht. Bitte einen anderen wählen oder lösen.</Hinweis>}
        </>
      )}
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      {neuOffen && <NeuerProzessFenster fuerProdukt={{ name: l.name }} onZu={() => setNeuOffen(false)} onAngelegt={prozessAngelegt} />}
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
