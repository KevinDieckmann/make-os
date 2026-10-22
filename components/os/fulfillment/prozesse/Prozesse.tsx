'use client';

// ─── Fulfillment › Landkarte — Kunden in Lieferung, Hochhaus, Paket-Vorlagen, Drill-down (Paket C1, 10.10.; 11.10.; seit 17.10. mit der früheren „Visualisierung“) ─
// Rückmeldung 17.10.: „Es dupliziert sich — lieber wenig und klar.“ Der Start von Fulfillment (Unter-Reiter „Landkarte“, Kennung `prozesse`): oben die Kunden in
// Lieferung (je Kunde EINE Karte, wer Aufmerksamkeit braucht zuerst — `Cockpit`, Visualisierung.tsx), dann das Hochhaus (Landkarte) mit Legende (Dach =
// Steuerung · Etagen = Weg eines Kunden durch uns · Fundament = was alles trägt), je Etage die Kunden dort mit Ampel (`knotenAmpel`). Ein Klick öffnet
// `?k=<knoten>`: Ebenen-Leiter mit Brotkrumen, Steckbrief, welche Kunden gerade dort stehen (Sprung in den Fall), die Kinder als nächste Ebene. Darunter die
// Paket-Vorlagen als Karten (Phasen-Kette mit Abstimmungspunkten, Zahl der Schritte und Bausteine, Produkt, Kunden darin) mit Editor, ganz unten die
// Erfolgsmaße (zugeklappt). „Aus Muster anlegen“ legt das neutrale Gerüst an. Rechnen nur in lib/fulfillment/prozesse/*.
// 17.10. spät („maximal einfach für uns“, Branch `ff-einfach`): ganz oben „Heute im Fulfillment“ — EINE Liste mit dem Handgriff in der Zeile (die Hauptaktion
// der Seite); die Kunden-Karten zeigen nur noch, wo jeder steht (kein „Als Nächstes“/„Hängt“ doppelt); die Abläufe heißen „Abläufe“ (vorher „Paket-Vorlagen“);
// das Hochhaus ist zugeklappt (im Alltag selten gebraucht) und öffnet sich von selbst, sobald ein Kasten gewählt ist (`?k=`).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO, TIEF, ECKE, FLAECHE_STIL, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Leerzustand, Liste, Zeile, Chip, Punkt, Klappbar, LEUCHT, useRueckfrage, Erklaert } from '../../ui';
import { paketBearbeitenLink } from '@/lib/fulfillment/prozesse/werkstatt-marke';
import { WEG } from '@/lib/wege';
import { anzahl } from '@/lib/text/zahlwort';
import { ortHref, ORTE, istOrt } from '@/lib/fulfillment/orte';
import { ebeneVon, inReihenfolge, kinderVon, wurzelVon } from '@/lib/fulfillment/regeln';
import { brotkrumen } from '@/lib/fulfillment/prozesse/landkarte';
import { bausteinArtName } from '@/lib/fulfillment/prozesse/bausteine';
import { knotenAmpel, paketSteckbrief, EBENEN_NAME, abstimmungsNummern, abstimmungName, titelOhneZusatz, titelZusatz } from '@/lib/fulfillment/prozesse/darstellung';
import type { ProzessKnoten, Zone } from '@/lib/fulfillment/typen';
import { Wahl } from '../../crm/Wahl';
import { useUebersicht, useCockpit, vorlagenOps, fehlerText, holeJson, geaendert, neueAnfrageId, type Uebersicht, type VorlageMitStand, type MitStand } from './daten';
import { Landkarte, ZONE_TEXT, ZONE_FARBE } from './Zeichnung';
import { KnotenFormular, Meldung, klein, Leiste, useTextFrage } from './teile';
import { Legende, FreigabeRaute, AMPEL_FARBE } from '../reise/bilder';
import { insBild } from '../reise/sprung';
import { PraesentationWahl } from '../reise/Praesentation';
import { Cockpit, Erfolgsmasse } from './Visualisierung';
import { HeuteImFulfillment } from '../reise/HeuteListe';

const ZUST: Record<string, string> = { intern: 'wir', kunde: 'Kunde', beide: 'beide' };
const ZonenZeichen = ({ zone }: { zone: Zone }) => <span aria-hidden style={{ display: 'inline-block', width: 18, height: 12, borderRadius: 4, background: `${ZONE_FARBE[zone]}30`, border: `1px solid ${ZONE_FARBE[zone]}` }} />;

export function Prozesse({ k }: { k?: string }) {
  const router = useRouter();
  const { daten, fehler } = useUebersicht();
  const cockpit = useCockpit();
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' } | null>(null);
  const [hochhausAuf, setHochhausAuf] = useState(false);
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  const landkarte = daten.prozesse.find(p => p.art === 'landkarte');
  const pakete = daten.prozesse.filter(p => p.art === 'paket');
  const ausMuster = async () => {
    const a = await vorlagenOps([{ op: 'aus-muster' }]);
    setMeldung(a.ok ? { text: 'Gerüst angelegt — Landkarte, Abläufe, Rituale und Playbook-Formular stehen bereit.', art: 'gut' } : { text: fehlerText(a), art: 'kritisch' });
  };
  const offen = (id: string) => router.push(WEG.fulfillment('prozesse', { k: id }), { scroll: false });
  const inVorlage = k ? daten.prozesse.find(p => p.knoten.some(x => x.id === k)) : undefined;
  const ampel = landkarte ? knotenAmpel(daten.zaehler[landkarte.id] ?? {}, cockpit.daten?.zeilen ?? []) : {};
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Meldung text={meldung?.text ?? null} art={meldung?.art} />
      {!landkarte && !pakete.length ? (
        <Leerzustand symbol="▦" ton={LEUCHT.business} titel="Noch keine Prozesse"
          aktion={<Erklaert erklaerung="fulfillment.vorlageAusMuster" name="Aus Muster anlegen"><Knopf haupt onClick={ausMuster}>Aus Muster anlegen</Knopf></Erklaert>}>
          Das Gerüst legt die Landkarte als Hochhaus und drei Abläufe an — Inhalte kommen per Import oder Editor dazu.
        </Leerzustand>
      ) : daten.musterOffen.length > 0 && (
        <Hinweis art="info" aktion={<Erklaert erklaerung="fulfillment.vorlageAusMuster" name="Aus Muster ergänzen"><Knopf leise onClick={ausMuster}>Fehlendes aus Muster anlegen</Knopf></Erklaert>}>
          Noch nicht angelegt: {daten.musterOffen.length} Teil{daten.musterOffen.length === 1 ? '' : 'e'} aus dem Muster.
        </Hinweis>
      )}
      {!k && (landkarte || pakete.length > 0) && <HeuteImFulfillment i={0} />}
      {!k && (landkarte || pakete.length > 0) && <Cockpit />}
      {landkarte && (
        <Klappbar id="ff-hochhaus" titel="Unser Unternehmen als Hochhaus — wo die Kunden stehen" offen={hochhausAuf || !!k} umschalten={() => setHochhausAuf(!hochhausAuf)}>
        <Karte i={1} akzent={LEUCHT.business}>
          <Ueberschrift farbe={LEUCHT.business} erklaerung="fulfillment.landkarte" rechts={<span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><span>{(n => `${n} Kunde${n === 1 ? '' : 'n'}`)(Object.values(daten.faelle).filter(f => f.status !== 'abgeschlossen').length)}</span><PraesentationWahl faelle={Object.values(daten.faelle)} /></span>}>{landkarte.titel}</Ueberschrift>
          <Legende eintraege={[
            { zeichen: <ZonenZeichen zone="dach" />, text: 'Dach — was steuert' },
            { zeichen: <ZonenZeichen zone="etage" />, text: 'Etagen — der Weg eines Kunden durch uns, von unten nach oben' },
            { zeichen: <ZonenZeichen zone="fundament" />, text: 'Fundament — was alles trägt' },
            { zeichen: <Punkt farbe={AMPEL_FARBE.gruen} groesse={8} />, text: 'Kunden dort, Farbe = Ampel' },
          ]} />
          <Landkarte vorlage={landkarte} zaehler={daten.zaehler[landkarte.id] ?? {}} aktiv={k} onKnoten={offen} ampel={ampel} />
          {!k && <div style={klein}>Tippe auf einen Kasten — darunter öffnet sich, was dort passiert und welche Kunden gerade dort stehen.</div>}
        </Karte>
        </Klappbar>
      )}
      {k && inVorlage && <Steckbrief vorlage={inVorlage} id={k} daten={daten} onKnoten={offen} />}
      {k && !inVorlage && <Hinweis art="achtung">Diesen Schritt gibt es nicht (mehr).</Hinweis>}
      <PaketKarten pakete={pakete} daten={daten} onKnoten={offen} />
      {!k && daten.kennzahlen.length > 0 && <Erfolgsmasse kennzahlen={daten.kennzahlen} />}
    </div>
  );
}

/** Die Ebenen-Leiter: Gesamt › Prozess › Teilprozess › Schritt › Baustein — die aktuelle Ebene hervorgehoben. */
function EbenenLeiter({ ebene }: { ebene: number }) {
  return (
    <Erklaert erklaerung="fulfillment.ebenen" name="Ebenen">
      <span aria-label={`Ebene ${ebene} von 5: ${EBENEN_NAME[ebene - 1] ?? ''}`} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {EBENEN_NAME.map((n, i) => (
          <span key={n} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <span style={{ ...MIKRO, color: i + 1 === ebene ? LEUCHT.business : i + 1 < ebene ? C.inkDim : C.inkLeise, padding: '3px 8px', borderRadius: 10,
              background: i + 1 === ebene ? TIEF.flaeche(LEUCHT.business) : 'transparent', border: `1px solid ${i + 1 === ebene ? TIEF.rand(LEUCHT.business) : 'transparent'}` }}>{n}</span>
            {i < EBENEN_NAME.length - 1 && <span aria-hidden style={{ color: C.inkLeise }}>›</span>}
          </span>
        ))}
      </span>
    </Erklaert>
  );
}

/** Steckbrief eines Knotens im Drill-down (Ebene 1 → 5). */
function Steckbrief({ vorlage, id, daten, onKnoten }: { vorlage: VorlageMitStand; id: string; daten: Uebersicht; onKnoten: (id: string) => void }) {
  const router = useRouter();
  useEffect(() => { insBild('ff-steckbrief'); }, [id]);
  const kn = vorlage.knoten.find(x => x.id === id)!;
  const kinder = kinderVon(id, vorlage.knoten);
  const kunden = daten.zaehler[vorlage.id]?.[id] ?? [];
  const ort = istOrt(kn.ort) ? { titel: ORTE[kn.ort].titel, href: ortHref(kn.ort)! } : null;
  const verweis = kn.verweis ? daten.prozesse.find(p => p.id === kn.verweis) : undefined;
  const baustein = kn.bausteinId ? daten.bausteine.find(b => b.id === kn.bausteinId) : undefined;
  const freigabe = kn.freigabe ? vorlage.freigaben.find(f => f.id === kn.freigabe) : undefined;
  const ebene = ebeneVon(kn, vorlage.knoten);
  const nummern = abstimmungsNummern(vorlage.knoten);
  const zusatz = titelZusatz(kn.titel);
  const e = (label: string, wert?: string | number | null) => (wert === undefined || wert === null || wert === '' ? null : (
    <div style={{ display: 'grid', gap: 2 }}><span style={MIKRO}>{label}</span><span style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>{wert}</span></div>
  ));
  return (
    <Karte i={2} id="ff-steckbrief">
      <EbenenLeiter ebene={ebene} />
      <nav aria-label="Ebenen" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: TYP.bedien }}>
        {brotkrumen(vorlage, id).map((b, i, l) => (
          <span key={b.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {i < l.length - 1 ? <button type="button" onClick={() => onKnoten(b.id)} className="fassbar" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', padding: '6px 0', minHeight: 44, fontSize: TYP.bedien }}>{titelOhneZusatz(b.titel)}</button> : <b style={{ color: C.ink, fontSize: TYP.body }}>{titelOhneZusatz(b.titel)}</b>}
            {i < l.length - 1 && <span style={{ color: C.inkLeise }}>›</span>}
          </span>
        ))}
      </nav>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {kn.zone && <Chip farbe={ZONE_FARBE[kn.zone]}>{ZONE_TEXT[kn.zone]}</Chip>}
        {kn.zustaendig && <Chip farbe={LEUCHT.planung}>Zuständig: {ZUST[kn.zustaendig]}</Chip>}
        {freigabe && <Chip farbe={LEUCHT.achtung}>◆ {abstimmungName(freigabe.id, nummern, freigabe.titel)}</Chip>}
        {kn.kundeSichtbar && <Chip farbe={LEUCHT.gut}>für Kunden sichtbar</Chip>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {e('Ziel', kn.ziel)}{e('Warum', kn.warum ?? (zusatz ? `${zusatz.charAt(0).toUpperCase()}${zusatz.slice(1)}.` : undefined))}{e('Eingang', kn.eingang)}{e('Ergebnis', kn.ergebnis)}{e('Kennzahl', kn.kennzahl)}{e('Rolle', kn.rolle)}
        {e('Dauer', kn.dauerTage ? anzahl(kn.dauerTage, 'Tag', 'Tage') : null)}{e('Aufwand', kn.aufwandStunden ? anzahl(kn.aufwandStunden, 'Stunde', 'Stunden') : null)}
      </div>
      <Leiste>
        {ort && <Link href={ort.href} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Wohnt heute in: {ort.titel} — öffnen ›</Link>}
        {verweis && <Knopf leise onClick={() => onKnoten(verweis.knoten.find(x => !x.elternId)?.id ?? '')}>Ablauf „{verweis.titel}“ öffnen ›</Knopf>}
        {baustein && <Link href={WEG.fulfillment('bausteine', { b: baustein.id })} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Baustein „{baustein.titel}“ öffnen ›</Link>}
      </Leiste>
      {kunden.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={MIKRO}>Kunden, die gerade hier stehen</span>
          <Liste>
            {kunden.map(m => <Zeile key={m} titel={daten.mandate[m]?.kunde ?? 'Mandat'} unter={daten.faelle[m]?.phase ?? daten.mandate[m]?.titel} onClick={() => router.push(WEG.fall(m))} />)}
          </Liste>
        </div>
      )}
      {kinder.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={MIKRO}>Eine Ebene tiefer: {EBENEN_NAME[ebene] ?? 'Schritte'}</span>
          <Liste>
            {kinder.map(x => <Zeile key={x.id} titel={titelOhneZusatz(x.titel)} unter={x.ergebnis ?? (x.bausteinId ? 'Baustein' : x.freigabe ? `◆ endet mit ${abstimmungName(x.freigabe, nummern, vorlage.freigaben.find(f => f.id === x.freigabe)?.titel)}` : titelZusatz(x.titel))} rechts={(daten.zaehler[vorlage.id]?.[x.id]?.length ?? 0) > 0 ? <Chip farbe={LEUCHT.business}>{daten.zaehler[vorlage.id][x.id].length}</Chip> : undefined} onClick={() => onKnoten(x.id)} />)}
          </Liste>
        </div>
      )}
    </Karte>
  );
}

/**
 * Die Paket-Vorlagen (Abläufe) als Karten: Phasen-Kette mit Abstimmungspunkten, Zahlen, Produkt, Kunden darin — „Ansehen“ öffnet den Drill-down, „Bearbeiten“
 * den Prozess-Editor im Miro-Stil (17.10., `?e=<Ablauf>`); „Neuer Ablauf“ legt eine leere Vorlage mit einer Phase an und öffnet sie dort.
 */
function PaketKarten({ pakete, daten, onKnoten }: { pakete: VorlageMitStand[]; daten: Uebersicht; onKnoten: (id: string) => void }) {
  const router = useRouter();
  const [meldung, setMeldung] = useState<string | null>(null);
  const frage = useTextFrage();
  const darf = daten.darfBearbeiten !== false;
  // E4 (22.10.): ein Paket mit Marke `werkstatt:` öffnet sich in der Werkstatt, die übrigen im Editor des Fulfillments.
  const editor = (id: string) => router.push(paketBearbeitenLink(id, daten.werkstatt));
  const neu = async () => {
    const titel = await frage.fragen('Name des neuen Ablaufs');
    if (!titel?.trim()) return;
    const a = await holeJson<{ vorlageId?: string }>('/api/fulfillment/editor', { method: 'POST', body: JSON.stringify({ aktion: 'neu', titel: titel.trim(), anfrageId: neueAnfrageId() }) });
    if (a.ok && a.j.vorlageId) { geaendert(); editor(a.j.vorlageId); } else setMeldung(fehlerText(a));
  };
  // Die Produkte, die diesen Ablauf liefern — je mit Weg zur Karte (19.10., B14).
  const produkte = (vid: string) => Object.entries(daten.zuordnung).filter(([, z]) => z.vorlageId === vid).map(([l]) => daten.leistungen.find(x => x.id === l)).filter((x): x is Uebersicht['leistungen'][number] => !!x);
  /** „noch keinem Produkt zugeordnet“ → Produkt wählen: die Zuordnung (dieselbe wie in der Karte, Abschnitt „Ablauf“), danach zur Karte. */
  const produktZuordnen = async (vid: string, leistungId: string) => {
    const a = await vorlagenOps([{ op: 'zuordnung', leistungId, vorlageId: vid }]);
    if (!a.ok) { setMeldung(fehlerText(a)); return; }
    geaendert();
    router.push(WEG.produkt(leistungId));
  };
  // Auch Fälle, an denen das Paket als Zusatzmodul hängt (17.10. spät).
  const kundenIn = (vid: string) => Object.values(daten.faelle).filter(f => (f.vorlageId === vid || !!f.zusaetze?.includes(vid)) && f.status !== 'abgeschlossen');
  return (
    <Karte i={3} id="ff-ablaeufe">
      <Ueberschrift erklaerung="fulfillment.paketKarten" rechts={darf ? <Knopf leise onClick={neu}>+ Neuer Ablauf</Knopf> : undefined}>Abläufe</Ueberschrift>
      <Meldung text={meldung} art="kritisch" />
      {!pakete.length ? (
        <Leerzustand symbol="▦" ton={LEUCHT.business} titel="Noch kein Ablauf" aktion={darf ? <Knopf onClick={neu}>Neuer Ablauf</Knopf> : undefined}>
          Ein Ablauf beschreibt, wie ein Produkt geliefert wird — Phasen und Schritte legst du per Ziehen an.
        </Leerzustand>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
          {pakete.map(p => {
            const sb = paketSteckbrief(p);
            const pr = produkte(p.id);
            const kunden = kundenIn(p.id);
            const wurzel = wurzelVon(p.knoten);
            return (
              <div key={p.id} style={{ ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, padding: 14, display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
                <b style={{ fontFamily: SCHRIFT.display, fontSize: TYP.body, color: C.ink, overflowWrap: 'anywhere' }}>{p.titel}</b>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {p.zusatz && <Chip farbe={LEUCHT.planung}>Zusatzmodul</Chip>}
                  {pr.length ? pr.map(x => <Link key={x.id} href={WEG.produkt(x.id)} title={`Karte von „${x.name}“ öffnen`} style={{ textDecoration: 'none' }}><Chip farbe={LEUCHT.gut}>liefert {x.name} ›</Chip></Link>) : p.zusatz ? null : (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Chip farbe={LEUCHT.achtung}>noch keinem Produkt zugeordnet</Chip>
                      {darf && daten.leistungen.length > 0 && <Wahl label={`Produkt für „${p.titel}“`} klein liste={daten.leistungen.filter(x => x.status !== 'eingestellt').map(x => ({ id: x.id, label: x.name }))} wert={null} leer="Produkt wählen ›" onWahl={id => void produktZuordnen(p.id, id)} />}
                    </span>
                  )}
                  {kunden.length > 0 && <Chip farbe={LEUCHT.business}>{kunden.length} Kund{kunden.length === 1 ? 'e läuft' : 'en laufen'} darin</Chip>}
                </div>
                {sb.phasen.length > 0 && (
                  <ol aria-label={`Phasen von ${p.titel}`} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '6px 4px', alignItems: 'center' }}>
                    {sb.phasen.map((ph, i) => (
                      <li key={ph.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
                        <span style={{ display: 'inline-grid', placeItems: 'center', width: 22, height: 22, borderRadius: 11, fontSize: TYP.bedien, fontWeight: 700, color: C.ink, background: TIEF.flaeche(LEUCHT.business), border: `1px solid ${TIEF.rand(LEUCHT.business)}` }}>{i + 1}</span>
                        <span title={ph.zusatz ? `${ph.titel} — ${ph.zusatz}` : undefined}>{ph.titel}</span>
                        {ph.freigabe && <span title={abstimmungName(ph.freigabe, new Map(ph.nr ? [[ph.freigabe, ph.nr]] : []), p.freigaben.find(f => f.id === ph.freigabe)?.titel)} style={{ display: 'inline-flex', gap: 3, alignItems: 'center', color: C.inkLeise }}><FreigabeRaute gegeben={false} groesse={9} />{ph.nr ?? ''}</span>}
                        {i < sb.phasen.length - 1 && <span aria-hidden style={{ color: C.inkLeise, margin: '0 2px' }}>→</span>}
                      </li>
                    ))}
                  </ol>
                )}
                <span style={{ ...klein, color: C.inkLeise }}>{sb.phasen.length} Phasen · {sb.schritte} Schritte · {sb.bausteine} Bausteine{sb.freigaben ? ` · ${sb.freigaben} ${sb.freigaben === 1 ? 'Bestätigung' : 'Bestätigungen'} (◆)` : ''}</span>
                <Leiste>
                  <Knopf leise onClick={() => editor(p.id)}>{darf ? 'Bearbeiten' : 'Ablauf ansehen'}</Knopf>
                  {wurzel && <Knopf leise onClick={() => onKnoten(wurzel.id)}>Steckbrief ›</Knopf>}
                </Leiste>
              </div>
            );
          })}
        </div>
      )}
      {(() => { const lk = daten.prozesse.find(p => p.art === 'landkarte'); return lk ? <VorlageAufklapp titel="Landkarte bearbeiten" vorlage={lk} daten={daten} /> : null; })()}
      {frage.dialog}
    </Karte>
  );
}

function VorlageAufklapp({ titel, vorlage, daten }: { titel: string; vorlage: VorlageMitStand; daten: Uebersicht }) {
  const [auf, setAuf] = useState(false);
  return <div style={{ display: 'grid', gap: 8 }}><div><Knopf leise onClick={() => setAuf(!auf)}>{auf ? 'Schließen' : titel}</Knopf></div>{auf && <VorlageEditor vorlage={vorlage} daten={daten} />}</div>;
}

/** Der Editor einer Vorlage: Baum in Lese-Reihenfolge, je Knoten ▲ ▼ ✎ + × — die Regeln (Ebenen, Kreis, Ebene 5 = Baustein) prüft der Server. */
export function VorlageEditor({ vorlage, daten }: { vorlage: VorlageMitStand; daten: Uebersicht }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const frage = useTextFrage();
  const [form, setForm] = useState<{ knoten?: MitStand<ProzessKnoten>; elternId?: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const op = async (o: Record<string, unknown>) => { const a = await vorlagenOps([o]); setFehler(a.ok ? null : fehlerText(a)); };
  const reihe = inReihenfolge(vorlage.knoten);
  const loeschen = async () => {
    if (!(await bestaetigen({ titel: `„${vorlage.titel}“ löschen?`, text: 'Laufende Fälle behalten ihre Kopie; Zuordnungen zu Produkten fallen weg.', ja: 'Löschen', gefahr: true }))) return;
    await op({ op: 'vorlage-weg', id: vorlage.id, stand: vorlage.stand });
  };
  const titel = async () => {
    const t = await frage.fragen('Neuer Titel', vorlage.titel);
    if (t?.trim() && t.trim() !== vorlage.titel) await op({ op: 'vorlage', eintrag: { id: vorlage.id, titel: t.trim() }, stand: vorlage.stand });
  };
  return (
    <div style={{ display: 'grid', gap: 8, padding: '8px 0' }}>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <Leiste>
        <Knopf leise onClick={titel}>Titel ändern</Knopf>
        {vorlage.art !== 'landkarte' && <Knopf leise onClick={loeschen}>Ablauf löschen</Knopf>}
      </Leiste>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {reihe.map(x => {
          const eb = ebeneVon(x, vorlage.knoten);
          const g = kinderVon(x.elternId, vorlage.knoten);
          const i = g.findIndex(y => y.id === x.id);
          const b = x.bausteinId ? daten.bausteine.find(y => y.id === x.bausteinId) : undefined;
          return (
            <li key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: (eb - 1) * 16, minHeight: 44, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: TYP.bedien, color: eb === 1 ? C.ink : C.inkDim, fontWeight: eb <= 2 ? 600 : 400, overflowWrap: 'anywhere' }}>
                {x.titel}{x.freigabe ? ` · ${x.freigabe}` : ''}{b ? ` · ${bausteinArtName(b.art)}` : ''}
              </span>
              {x.elternId && <Knopf leise ariaLabel="nach oben" aus={i <= 0} onClick={() => op({ op: 'knoten-rang', vorlageId: vorlage.id, id: x.id, richtung: 'hoch' })}>▲</Knopf>}
              {x.elternId && <Knopf leise ariaLabel="nach unten" aus={i >= g.length - 1} onClick={() => op({ op: 'knoten-rang', vorlageId: vorlage.id, id: x.id, richtung: 'runter' })}>▼</Knopf>}
              <Knopf leise ariaLabel="bearbeiten" onClick={() => setForm({ knoten: x })}>✎</Knopf>
              {eb < 5 && <Knopf leise ariaLabel="Schritt darunter anlegen" onClick={() => setForm({ elternId: x.id })}>+</Knopf>}
              {x.elternId && <Knopf leise ariaLabel="entfernen" onClick={async () => { if (await bestaetigen({ titel: `„${x.titel}“ entfernen?`, text: kinderVon(x.id, vorlage.knoten).length ? 'Alle Schritte darunter fallen mit weg.' : 'Der Schritt fällt aus dem Ablauf.', ja: 'Entfernen', gefahr: true })) await op({ op: 'knoten-weg', vorlageId: vorlage.id, id: x.id, stand: x.stand }); }}>×</Knopf>}
            </li>
          );
        })}
      </ol>
      {form && <KnotenFormular vorlage={vorlage} knoten={form.knoten} elternId={form.elternId} bausteine={daten.bausteine} onZu={() => setForm(null)} />}
      {dialog}{frage.dialog}
    </div>
  );
}
