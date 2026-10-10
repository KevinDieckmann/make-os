'use client';

// ─── Fulfillment › Prozesse — Landkarte, Paket-Vorlagen, Drill-down (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 2.2–2.5, 6.2) ─────────────
// Oben das Hochhaus (Landkarte) — ein Klick öffnet `?k=<knoten>`: Brotkrumen über die Ebenen, Steckbrief (Zuständig, Eingang/Ergebnis,
// Kennzahl, Freigabe, „wohnt heute in …“), welche Kunden gerade dort stehen (Sprung in den Fall), die Kinder als nächste Ebene. Darunter die
// Paket-Vorlagen mit Editor (Knoten anlegen, ändern, verschieben, löschen — Regeln der fünf Ebenen prüft der Server). „Aus Muster anlegen“
// legt das neutrale Gerüst an. Rechnen nur in lib/fulfillment/prozesse/*.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Leerzustand, Liste, Zeile, Chip, LEUCHT, useRueckfrage, Erklaert } from '../../ui';
import { WEG } from '@/lib/wege';
import { ortHref, ORTE, istOrt } from '@/lib/fulfillment/orte';
import { ebeneVon, inReihenfolge, kinderVon } from '@/lib/fulfillment/regeln';
import { brotkrumen } from '@/lib/fulfillment/prozesse/landkarte';
import type { ProzessKnoten } from '@/lib/fulfillment/typen';
import { useUebersicht, vorlagenOps, fehlerText, type Uebersicht, type VorlageMitStand, type MitStand } from './daten';
import { Landkarte, ZONE_TEXT } from './Zeichnung';
import { KnotenFormular, Meldung, klein, Leiste, useTextFrage } from './teile';

const ZUST: Record<string, string> = { intern: 'wir', kunde: 'Kunde', beide: 'beide' };

export function Prozesse({ k }: { k?: string }) {
  const router = useRouter();
  const { daten, fehler } = useUebersicht();
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
          <Ueberschrift farbe={LEUCHT.business} erklaerung="fulfillment.landkarte" rechts={<span>{Object.keys(daten.faelle).length} Fälle</span>}>{landkarte.titel}</Ueberschrift>
          <Landkarte vorlage={landkarte} zaehler={daten.zaehler[landkarte.id] ?? {}} aktiv={k} onKnoten={offen} />
        </Karte>
      )}
      {k && inVorlage && <Steckbrief vorlage={inVorlage} id={k} daten={daten} onKnoten={offen} />}
      {k && !inVorlage && <Hinweis art="achtung">Diesen Schritt gibt es nicht (mehr).</Hinweis>}
      <PaketListe pakete={pakete} daten={daten} />
    </div>
  );
}

/** Steckbrief eines Knotens im Drill-down (Ebene 1 → 5). */
function Steckbrief({ vorlage, id, daten, onKnoten }: { vorlage: VorlageMitStand; id: string; daten: Uebersicht; onKnoten: (id: string) => void }) {
  const router = useRouter();
  const kn = vorlage.knoten.find(x => x.id === id)!;
  const kinder = kinderVon(id, vorlage.knoten);
  const kunden = daten.zaehler[vorlage.id]?.[id] ?? [];
  const ort = istOrt(kn.ort) ? { titel: ORTE[kn.ort].titel, href: ortHref(kn.ort)! } : null;
  const verweis = kn.verweis ? daten.prozesse.find(p => p.id === kn.verweis) : undefined;
  const baustein = kn.bausteinId ? daten.bausteine.find(b => b.id === kn.bausteinId) : undefined;
  const freigabe = kn.freigabe ? vorlage.freigaben.find(f => f.id === kn.freigabe) : undefined;
  const e = (label: string, wert?: string | number | null) => (wert === undefined || wert === null || wert === '' ? null : (
    <div style={{ display: 'grid', gap: 2 }}><span style={MIKRO}>{label}</span><span style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>{wert}</span></div>
  ));
  return (
    <Karte i={2}>
      <nav aria-label="Ebenen" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: TYP.bedien }}>
        {brotkrumen(vorlage, id).map((b, i, l) => (
          <span key={b.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {i < l.length - 1 ? <button type="button" onClick={() => onKnoten(b.id)} className="fassbar" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', padding: '6px 0', minHeight: 44, fontSize: TYP.bedien }}>{b.titel}</button> : <b style={{ color: C.ink }}>{b.titel}</b>}
            {i < l.length - 1 && <span style={{ color: C.inkLeise }}>›</span>}
          </span>
        ))}
      </nav>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Chip farbe={C.inkDim}>Ebene {ebeneVon(kn, vorlage.knoten)}</Chip>
        {kn.zone && <Chip farbe={LEUCHT.business}>{ZONE_TEXT[kn.zone]}</Chip>}
        {kn.zustaendig && <Chip farbe={LEUCHT.planung}>Zuständig: {ZUST[kn.zustaendig]}</Chip>}
        {freigabe && <Chip farbe={LEUCHT.achtung}>Freigabe {freigabe.id} · {freigabe.titel}</Chip>}
        {kn.kundeSichtbar && <Chip farbe={LEUCHT.gut}>für Kunden sichtbar</Chip>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {e('Ziel', kn.ziel)}{e('Warum', kn.warum)}{e('Eingang', kn.eingang)}{e('Ergebnis', kn.ergebnis)}{e('Kennzahl', kn.kennzahl)}{e('Rolle', kn.rolle)}
        {e('Dauer', kn.dauerTage ? `${kn.dauerTage} Tage` : null)}{e('Aufwand', kn.aufwandStunden ? `${kn.aufwandStunden} Stunden` : null)}
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
          <span style={MIKRO}>Nächste Ebene</span>
          <Liste>
            {kinder.map(x => <Zeile key={x.id} titel={x.titel} unter={x.ergebnis ?? (x.bausteinId ? 'Baustein' : undefined)} rechts={(daten.zaehler[vorlage.id]?.[x.id]?.length ?? 0) > 0 ? <Chip farbe={LEUCHT.business}>{daten.zaehler[vorlage.id][x.id].length}</Chip> : undefined} onClick={() => onKnoten(x.id)} />)}
          </Liste>
        </div>
      )}
    </Karte>
  );
}

function PaketListe({ pakete, daten }: { pakete: VorlageMitStand[]; daten: Uebersicht }) {
  const [offen, setOffen] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const frage = useTextFrage();
  const neu = async () => {
    const titel = await frage.fragen('Titel der neuen Paket-Vorlage');
    if (!titel?.trim()) return;
    const a = await vorlagenOps([{ op: 'vorlage', eintrag: { art: 'paket', titel: titel.trim() } }]);
    setMeldung(a.ok ? null : fehlerText(a));
  };
  const produkte = (vid: string) => Object.entries(daten.zuordnung).filter(([, z]) => z.vorlageId === vid).map(([l]) => daten.leistungen.find(x => x.id === l)?.name).filter(Boolean);
  return (
    <Karte i={3}>
      <Ueberschrift erklaerung="fulfillment.zuordnung" rechts={<Knopf leise onClick={neu}>+ Paket-Vorlage</Knopf>}>Paket-Vorlagen</Ueberschrift>
      <Meldung text={meldung} art="kritisch" />
      {!pakete.length ? <div style={klein}>Noch keine Paket-Vorlage — „Aus Muster anlegen“ oder „+ Paket-Vorlage“.</div> : (
        <Liste>
          {pakete.map(p => (
            <div key={p.id} style={{ display: 'grid', gap: 8 }}>
              <Zeile titel={p.titel} unter={`Fassung ${p.fassung} · ${p.knoten.length} Schritte${produkte(p.id).length ? ` · liefert ${produkte(p.id).join(', ')}` : ' · noch keinem Produkt zugeordnet'}`}
                rechts={<Knopf leise onClick={() => setOffen(offen === p.id ? null : p.id)}>{offen === p.id ? 'Schließen' : 'Bearbeiten'}</Knopf>} />
              {offen === p.id && <VorlageEditor vorlage={p} daten={daten} />}
            </div>
          ))}
        </Liste>
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
