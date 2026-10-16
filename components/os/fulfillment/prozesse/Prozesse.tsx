'use client';

// ─── Fulfillment › Prozesse — Landkarte, Paket-Vorlagen, Drill-down (Paket C1, 10.10.; Design-Überarbeitung 11.10.; FULFILLMENT_KONZEPT.md 2.2–2.5, 6.2) ─
// Oben das Hochhaus (Landkarte) mit Legende (Dach = Steuerung · Etagen = Weg eines Kunden durch uns · Fundament = was alles trägt), je Etage die
// Kunden dort mit Ampel (`knotenAmpel` aus dem Cockpit). Ein Klick öffnet `?k=<knoten>`: Ebenen-Leiter (Gesamt › Prozess › Teilprozess › Schritt ›
// Baustein) mit Brotkrumen, Steckbrief (Zuständig, Eingang/Ergebnis, Kennzahl, Freigabe, „wohnt heute in …“), welche Kunden gerade dort stehen
// (Sprung in den Fall), die Kinder als nächste Ebene. Darunter die Paket-Vorlagen als Karten (Phasen-Kette mit Freigaben, Zahl der Schritte und
// Bausteine, Produkt, Kunden darin) mit Editor (Knoten anlegen, ändern, verschieben, löschen — Regeln der fünf Ebenen prüft der Server).
// „Aus Muster anlegen“ legt das neutrale Gerüst an. Rechnen nur in lib/fulfillment/prozesse/*.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO, TIEF, ECKE, FLAECHE_STIL, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Leerzustand, Liste, Zeile, Chip, Punkt, LEUCHT, useRueckfrage, Erklaert } from '../../ui';
import { WEG } from '@/lib/wege';
import { anzahl } from '@/lib/text/zahlwort';
import { ortHref, ORTE, istOrt } from '@/lib/fulfillment/orte';
import { ebeneVon, inReihenfolge, kinderVon, wurzelVon } from '@/lib/fulfillment/regeln';
import { brotkrumen } from '@/lib/fulfillment/prozesse/landkarte';
import { knotenAmpel, paketSteckbrief, EBENEN_NAME, abstimmungsNummern, abstimmungName, titelOhneZusatz, titelZusatz } from '@/lib/fulfillment/prozesse/darstellung';
import type { ProzessKnoten, Zone } from '@/lib/fulfillment/typen';
import { useUebersicht, useCockpit, vorlagenOps, fehlerText, type Uebersicht, type VorlageMitStand, type MitStand } from './daten';
import { Landkarte, ZONE_TEXT, ZONE_FARBE } from './Zeichnung';
import { KnotenFormular, Meldung, klein, Leiste, useTextFrage } from './teile';
import { Legende, FreigabeRaute, AMPEL_FARBE } from '../reise/bilder';
import { insBild } from '../reise/sprung';
import { PraesentationWahl } from '../reise/Praesentation';

const ZUST: Record<string, string> = { intern: 'wir', kunde: 'Kunde', beide: 'beide' };
const ZonenZeichen = ({ zone }: { zone: Zone }) => <span aria-hidden style={{ display: 'inline-block', width: 18, height: 12, borderRadius: 4, background: `${ZONE_FARBE[zone]}30`, border: `1px solid ${ZONE_FARBE[zone]}` }} />;

export function Prozesse({ k }: { k?: string }) {
  const router = useRouter();
  const { daten, fehler } = useUebersicht();
  const cockpit = useCockpit();
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' } | null>(null);
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  const landkarte = daten.prozesse.find(p => p.art === 'landkarte');
  const pakete = daten.prozesse.filter(p => p.art === 'paket');
  const ausMuster = async () => {
    const a = await vorlagenOps([{ op: 'aus-muster' }]);
    setMeldung(a.ok ? { text: 'Gerüst angelegt — Landkarte, Paket-Vorlagen, Rituale und Playbook-Formular stehen bereit.', art: 'gut' } : { text: fehlerText(a), art: 'kritisch' });
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
          Das Gerüst legt die Landkarte als Hochhaus und drei Paket-Vorlagen an — Inhalte kommen per Import oder Editor dazu.
        </Leerzustand>
      ) : daten.musterOffen.length > 0 && (
        <Hinweis art="info" aktion={<Erklaert erklaerung="fulfillment.vorlageAusMuster" name="Aus Muster ergänzen"><Knopf leise onClick={ausMuster}>Fehlendes aus Muster anlegen</Knopf></Erklaert>}>
          Noch nicht angelegt: {daten.musterOffen.length} Muster-Vorlage{daten.musterOffen.length === 1 ? '' : 'n'}.
        </Hinweis>
      )}
      {landkarte && (
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
      )}
      {k && inVorlage && <Steckbrief vorlage={inVorlage} id={k} daten={daten} onKnoten={offen} />}
      {k && !inVorlage && <Hinweis art="achtung">Diesen Schritt gibt es nicht (mehr).</Hinweis>}
      <PaketKarten pakete={pakete} daten={daten} onKnoten={offen} />
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
        {verweis && <Knopf leise onClick={() => onKnoten(verweis.knoten.find(x => !x.elternId)?.id ?? '')}>Paket „{verweis.titel}“ öffnen ›</Knopf>}
        {baustein && <Link href={WEG.fulfillment('bausteine', { b: baustein.id })} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Baustein „{baustein.titel}“ öffnen ›</Link>}
      </Leiste>
      {kunden.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={MIKRO}>Kunden, die gerade hier stehen</span>
          <Liste>
            {kunden.map(m => <Zeile key={m} titel={daten.mandate[m]?.kunde ?? 'Mandat'} unter={daten.faelle[m]?.phase ?? daten.mandate[m]?.titel} onClick={() => router.push(WEG.fall(m, 'ablauf'))} />)}
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

/** Die Paket-Vorlagen als Karten: Phasen-Kette mit Freigaben, Zahlen, Produkt, Kunden darin — „Ansehen“ öffnet den Drill-down, „Bearbeiten“ den Editor. */
function PaketKarten({ pakete, daten, onKnoten }: { pakete: VorlageMitStand[]; daten: Uebersicht; onKnoten: (id: string) => void }) {
  const [offen, setOffen] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const frage = useTextFrage();
  const neu = async () => {
    const titel = await frage.fragen('Titel der neuen Paket-Vorlage');
    if (!titel?.trim()) return;
    const a = await vorlagenOps([{ op: 'vorlage', eintrag: { art: 'paket', titel: titel.trim() } }]);
    setMeldung(a.ok ? null : fehlerText(a));
  };
  const produkte = (vid: string) => Object.entries(daten.zuordnung).filter(([, z]) => z.vorlageId === vid).map(([l]) => daten.leistungen.find(x => x.id === l)?.name).filter((x): x is string => !!x);
  const kundenIn = (vid: string) => Object.values(daten.faelle).filter(f => f.vorlageId === vid && f.status !== 'abgeschlossen');
  const bearbeitet = pakete.find(p => p.id === offen);
  return (
    <Karte i={3}>
      <Ueberschrift erklaerung="fulfillment.paketKarten" rechts={<Knopf leise onClick={neu}>+ Paket-Vorlage</Knopf>}>Paket-Vorlagen</Ueberschrift>
      <Meldung text={meldung} art="kritisch" />
      {!pakete.length ? (
        <Leerzustand symbol="▦" ton={LEUCHT.business} titel="Noch keine Paket-Vorlage">„Aus Muster anlegen“ (oben) oder „+ Paket-Vorlage“ — jede Vorlage beschreibt, wie ein Produkt geliefert wird.</Leerzustand>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
          {pakete.map(p => {
            const sb = paketSteckbrief(p);
            const pr = produkte(p.id);
            const kunden = kundenIn(p.id);
            const wurzel = wurzelVon(p.knoten);
            return (
              <div key={p.id} style={{ ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, padding: 14, display: 'grid', gap: 10, alignContent: 'start', minWidth: 0,
                ...(offen === p.id ? { border: `1px solid ${TIEF.rand(LEUCHT.business)}` } : {}) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <b style={{ fontFamily: SCHRIFT.display, fontSize: TYP.body, color: C.ink, overflowWrap: 'anywhere' }}>{p.titel}</b>
                  <span style={{ ...MIKRO, whiteSpace: 'nowrap' }}>Fassung {p.fassung}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {pr.length ? pr.map(n => <Chip key={n} farbe={LEUCHT.gut}>liefert {n}</Chip>) : <Chip farbe={LEUCHT.achtung}>noch keinem Produkt zugeordnet</Chip>}
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
                <span style={{ ...klein, color: C.inkLeise }}>{sb.phasen.length} Phasen · {sb.schritte} Schritte · {sb.bausteine} Bausteine{sb.freigaben ? ` · ${sb.freigaben} Abstimmungspunkt${sb.freigaben === 1 ? '' : 'e'} (◆)` : ''}</span>
                <Leiste>
                  {wurzel && <Knopf leise onClick={() => onKnoten(wurzel.id)}>Ansehen ›</Knopf>}
                  <Knopf leise onClick={() => setOffen(offen === p.id ? null : p.id)}>{offen === p.id ? 'Editor schließen' : 'Bearbeiten'}</Knopf>
                </Leiste>
              </div>
            );
          })}
        </div>
      )}
      {bearbeitet && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={MIKRO}>Bearbeiten: {bearbeitet.titel}</span>
          <VorlageEditor vorlage={bearbeitet} daten={daten} />
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
        {vorlage.art !== 'landkarte' && <Knopf leise onClick={loeschen}>Vorlage löschen</Knopf>}
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
                {x.titel}{x.freigabe ? ` · ${x.freigabe}` : ''}{b ? ` · ${b.art}` : ''}
              </span>
              {x.elternId && <Knopf leise ariaLabel="nach oben" aus={i <= 0} onClick={() => op({ op: 'knoten-rang', vorlageId: vorlage.id, id: x.id, richtung: 'hoch' })}>▲</Knopf>}
              {x.elternId && <Knopf leise ariaLabel="nach unten" aus={i >= g.length - 1} onClick={() => op({ op: 'knoten-rang', vorlageId: vorlage.id, id: x.id, richtung: 'runter' })}>▼</Knopf>}
              <Knopf leise ariaLabel="bearbeiten" onClick={() => setForm({ knoten: x })}>✎</Knopf>
              {eb < 5 && <Knopf leise ariaLabel="Schritt darunter anlegen" onClick={() => setForm({ elternId: x.id })}>+</Knopf>}
              {x.elternId && <Knopf leise ariaLabel="entfernen" onClick={async () => { if (await bestaetigen({ titel: `„${x.titel}“ entfernen?`, text: kinderVon(x.id, vorlage.knoten).length ? 'Alle Schritte darunter fallen mit weg.' : 'Der Schritt fällt aus der Vorlage.', ja: 'Entfernen', gefahr: true })) await op({ op: 'knoten-weg', vorlageId: vorlage.id, id: x.id, stand: x.stand }); }}>×</Knopf>}
            </li>
          );
        })}
      </ol>
      {form && <KnotenFormular vorlage={vorlage} knoten={form.knoten} elternId={form.elternId} bausteine={daten.bausteine} onZu={() => setForm(null)} />}
      {dialog}{frage.dialog}
    </div>
  );
}
