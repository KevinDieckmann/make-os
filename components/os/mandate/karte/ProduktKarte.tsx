'use client';

// ─── Produkte · die Karte eines Produkts (P2, 19.10. — PRODUKTE_KONZEPT.md „Die Karte“) ─────────────────────────────────────────────
// Kevin 19.10.: „maximal einfach“ — Antwort zuerst, Details auf Klick. Oben: Stufe · Rolle · Status · Gesellschaft (je ein Chip, antippen
// ändert), der ganze Preis in einer Zeile, die Lage (Kunden jetzt, Umsatz, Deals) und was fehlt (mit Weg in den Abschnitt). Darunter die
// Abschnitte zum Aufklappen: Preis · Vertrag · Regeln · Texte · Lieferumfang · Ablauf · Aufwand & Kapazität · Ziel & Planung · Mandate & Deals ·
// Name, Linie & Unterlagen — jeder mit einer kurzen Antwort rechts. Geschrieben wird nur über den Bestand-Schreibweg (`api.teil` mit Stand);
// was der Server ablehnt (400/409/413), steht im Abschnitt, in dem es geändert wurde. Am Handy ganzflächig, ohne Querscrollen (B11).

import { useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, Chip, Hinweis, Lage, Klappbar, LEUCHT, type LageEintrag } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { Fenster } from '../../Fenster';
import { GesellschaftWahl } from '../../crm/GesellschaftWahl';
import { produktKarte, type ProduktRolle } from '@/lib/crm/produkt-karte';
import { kartenLuecken, ebenenWahl, vertragText, regelnText, aufwandText, texteVon, type KartenAbschnitt } from '@/lib/crm/produkt-katalog';
import { produktZahlen, produktZustand } from '@/lib/crm/produkte';
import type { Leistung } from '@/lib/crm/typen';
import type { TreppenStufe } from '@/lib/crm/treppe-daten';
import { kurzEuro, type CrmApi } from '../../crm/daten';
import { TREPPE_EREIGNIS } from '../treppe/daten';
import { PreisTeile } from './PreisTeile';
import { VertragTeil, RegelnTeil, TexteTeil, LieferumfangTeil, AufwandTeil, ZielTeil, MandateTeil, MehrTeil } from './Abschnitte';
import { AblaufTeil, useAblauf } from './Ablauf';

const ROLLEN: { id: ProduktRolle; label: string }[] = [{ id: 'haupt', label: 'Hauptprodukt' }, { id: 'zusatz', label: 'Zusatzmodul' }, { id: 'beides', label: 'Haupt oder Zusatz' }];

export interface ProduktKarteProps {
  api: CrmApi;
  l: Leistung;
  /** Die gespeicherte Treppen-Stufe, die diesem Produkt gehört (füllt Leeres) — null ohne. */
  gespeicherteStufe: TreppenStufe | null;
  /** Gehört dem Produkt eine gespeicherte Stufe? Dann steht es über sie auf der Treppe („ohne Stufe“ geht nicht). */
  besitztStufe: boolean;
  /** Belegung der Stufe (Kunden jetzt, h/Woche zusammen). */
  belegung: { kunden: number; stundenWoche: number } | null;
  ebenen: readonly number[];
  zielJahr?: number;
  linien: readonly string[];
  onZu: () => void;
  onArchivieren: () => void;
  onZurueckholen: () => void;
  onLoeschen: () => void;
}

export function ProduktKarte({ api, l, gespeicherteStufe, besitztStufe, belegung, ebenen, zielJahr, linien, onZu, onArchivieren, onZurueckholen, onLoeschen }: ProduktKarteProps) {
  const crm = api.crm!;
  const [offen, setOffen] = useState<ReadonlySet<KartenAbschnitt>>(new Set());
  const [fehlerBei, setFehlerBei] = useState<KartenAbschnitt | null>(null);
  const [statusHinweis, setStatusHinweis] = useState<string | null>(null);
  const ablauf = useAblauf(l.id);
  const k = produktKarte(l, gespeicherteStufe, crm.stand.leistungen);
  const z = produktZahlen(l, crm.stand);
  const texte = texteVon(l);
  const luecken = kartenLuecken(l, { ablauf: ablauf === undefined || ablauf === null ? null : !!ablauf.id });
  const zustand = produktZustand(l);
  const auf = (a: KartenAbschnitt) => setOffen(o => new Set(o).add(a));
  /** Aufklappen und hinscrollen (Weg aus der Antwort oben: „Was noch fehlt“, Lage). */
  const zeige = (a: KartenAbschnitt) => { auf(a); requestAnimationFrame(() => document.getElementById(`pk-${a}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })); };
  const umschalten = (a: KartenAbschnitt) => setOffen(o => { const n = new Set(o); if (n.has(a)) n.delete(a); else n.add(a); return n; });

  /** Speichern aus einem Abschnitt: `api.teil` mit Stand; abgelehnt → der Grund steht im Abschnitt, die Anzeige holt den Serverstand. */
  const speichernIn = (a: KartenAbschnitt) => async (felder: Record<string, unknown>): Promise<boolean> => {
    setFehlerBei(null);
    const ok = await api.teil('leistungen', l.id, felder);
    if (!ok) { setFehlerBei(a); auf(a); void api.laden(true); return false; }
    // Die Treppe rechnet mit den Karten (Name, Preis, Plätze, Aufwand) — einmal frisch laden.
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(TREPPE_EREIGNIS));
    return true;
  };
  const kopf = speichernIn('kopf');
  const serverFehler = (a: KartenAbschnitt) => (fehlerBei === a && api.fehler ? <Hinweis art="kritisch" rolle="alert">{api.fehler}</Hinweis> : null);

  const statusWahl = (s: 'aktiv' | 'entwurf') => {
    if (s === l.status) return;
    if (s === 'aktiv' && !texte.leistungstext) { setStatusHinweis('„Aktiv“ geht erst mit Leistungstext — er steht im Abschnitt „Texte“.'); zeige('texte'); return; }
    setStatusHinweis(null);
    void kopf({ status: s });
  };
  const namen = (id: string) => crm.stand.leistungen.find(x => x.id === id)?.name ?? id;
  const lage: LageEintrag[] = [
    { id: 'kunden', wert: String(z.mandateAktiv), label: z.mandateAktiv === 1 ? 'Kunde jetzt' : 'Kunden jetzt', unter: k.regeln.maxGleichzeitig ? `${z.mandateAktiv}/${k.regeln.maxGleichzeitig} Plätze` : `${z.mandateGesamt} Mandate gesamt`,
      bedeutung: k.regeln.maxGleichzeitig && z.mandateAktiv > k.regeln.maxGleichzeitig ? 'kritisch' : undefined, onClick: () => zeige('mandate') },
    { id: 'umsatz', wert: z.mrr ? kurzEuro(z.mrr) : '—', label: 'je Monat', unter: 'aus aktiven Mandaten' },
    { id: 'deals', wert: String(z.dealsOffen), label: z.dealsOffen === 1 ? 'Deal offen' : 'Deals offen', unter: z.quote !== null ? `Abschlussquote ${Math.round(z.quote * 100)} %` : 'noch keine Abschlüsse', onClick: () => zeige('mandate') },
  ];
  const abschnitt = (a: KartenAbschnitt, titel: string, rechts: string, inhalt: ReactNode) => (
    <Klappbar key={a} id={`pk-${a}`} titel={titel} rechts={rechts} offen={offen.has(a)} umschalten={() => umschalten(a)}>
      <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>{serverFehler(a)}{inhalt}</div>
    </Klappbar>
  );
  const aufwand = aufwandText({ aufwand: k.aufwand }, l);
  const n = (x: number, eins: string, viele: string) => `${x} ${x === 1 ? eins : viele}`;

  return (
    <Fenster titel={l.name} onZu={onZu} breit={760}>
      {/* ── Antwort zuerst ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
        <Wahl<string> label="Stufe der Treppe" liste={ebenenWahl(ebenen).map(x => ({ id: String(x), label: `Stufe ${x}` }))} wert={k.ebene ? String(k.ebene) : null} leer="ohne Stufe"
          onWahl={v => void kopf({ ebene: Number(v) })} {...(!besitztStufe && l.ebene != null ? { onLeeren: () => void kopf({ ebene: null }), leerenLabel: 'ohne Stufe' } : {})} />
        <Wahl<ProduktRolle> label="Rolle" liste={ROLLEN} wert={k.rolle} onWahl={r => void kopf({ rolle: r })} />
        {zustand === 'archiv'
          ? <Chip farbe={C.inkDim}>archiviert</Chip>
          : <Wahl<'aktiv' | 'entwurf'> label="Status" liste={[{ id: 'aktiv', label: texte.leistungstext ? 'aktiv' : 'aktiv 🔒' }, { id: 'entwurf', label: 'Entwurf' }]} wert={l.status === 'aktiv' ? 'aktiv' : 'entwurf'}
              farbe={l.status === 'aktiv' ? LEUCHT.gut : LEUCHT.achtung} onWahl={statusWahl} />}
        <GesellschaftWahl wert={l.gesellschaft} onWahl={g => void kopf({ gesellschaft: g })} />
      </div>
      {statusHinweis && <Hinweis art="achtung">{statusHinweis}</Hinweis>}
      {serverFehler('kopf')}
      <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, color: C.ink, lineHeight: 1.35, overflowWrap: 'break-word' }}>{k.preisText}</div>
      <Lage eintraege={lage} label={`Lage von ${l.name}`} />
      {luecken.length > 0 && (
        <Hinweis art="achtung" titel="Was noch fehlt">
          <span style={{ display: 'grid', gap: 4 }}>
            {luecken.map(x => (
              <button key={x.text} type="button" className="fassbar" onClick={() => zeige(x.abschnitt)}
                style={{ textAlign: 'left', background: 'none', border: 'none', padding: '6px 0', minHeight: 32, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer' }}>
                {x.text} <span style={{ color: C.aktiv }}>›</span>
              </button>
            ))}
          </span>
        </Hinweis>
      )}

      {/* ── Details auf Klick ── */}
      {abschnitt('preis', 'Preis', n(k.preise.length, 'Teil', 'Teile'), <PreisTeile l={l} speichern={speichernIn('preis')} />)}
      {abschnitt('vertrag', 'Vertrag', k.vertrag.mindestlaufzeitMonate ? `${k.vertrag.mindestlaufzeitMonate} Monate` : vertragText(k.vertrag) === 'nichts festgelegt' ? 'offen' : 'festgelegt', <VertragTeil l={l} speichern={speichernIn('vertrag')} />)}
      {abschnitt('regeln', 'Regeln', regelnText(l.regeln, namen) === 'keine' ? 'keine' : n([l.regeln?.anrechnung, l.regeln?.maxGleichzeitig, l.regeln?.inklusive?.length].filter(Boolean).length, 'Regel', 'Regeln'),
        <RegelnTeil l={l} alle={crm.stand.leistungen} anrechnungAlt={gespeicherteStufe?.regeln.anrechnung} speichern={speichernIn('regeln')} />)}
      {abschnitt('texte', 'Texte', texte.leistungstext ? 'Leistungstext ✓' : 'Leistungstext fehlt', <TexteTeil l={l} speichern={speichernIn('texte')} />)}
      {abschnitt('liefer', 'Lieferumfang', n(k.lieferumfang.length, 'Punkt', 'Punkte'), <LieferumfangTeil l={l} speichern={speichernIn('liefer')} />)}
      {abschnitt('ablauf', 'Ablauf', ablauf === undefined ? '…' : ablauf === null ? '—' : ablauf.titel ?? 'kein Ablauf',
        <AblaufTeil l={l} speichern={speichernIn('ablauf')} mandateJePhase={id => crm.stand.mandate.filter(m => m.leistungId === l.id && m.status !== 'beendet' && (m.phase ?? l.phasen?.[0]?.id) === id).length} />)}
      {abschnitt('aufwand', 'Aufwand & Kapazität', aufwand.wert, <AufwandTeil l={l} aufwand={k.aufwand} stufe={belegung} speichern={speichernIn('aufwand')} />)}
      {abschnitt('ziel', 'Ziel & Planung', k.ziel ? [k.ziel.umsatz ? kurzEuro(k.ziel.umsatz) : '', k.ziel.kunden ? n(k.ziel.kunden, 'Kunde', 'Kunden') : ''].filter(Boolean).join(' · ') : 'kein Ziel',
        <ZielTeil l={l} ziel={k.ziel} zielJahr={zielJahr} speichern={speichernIn('ziel')} />)}
      {abschnitt('mandate', 'Mandate & Deals', `${z.mandateAktiv} aktiv · ${n(z.dealsOffen, 'Deal', 'Deals')}`, <MandateTeil l={l} crm={crm.stand} stufen={crm.stufen} />)}
      {abschnitt('unterlagen', 'Name, Linie & Unterlagen', n(l.unterlagen?.length ?? 0, 'Unterlage', 'Unterlagen'), <MehrTeil l={l} linien={linien} speichern={speichernIn('unterlagen')} />)}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', paddingTop: 6 }}>
        {zustand === 'archiv'
          ? <Knopf leise onClick={onZurueckholen}>Zurückholen</Knopf>
          : <Knopf leise onClick={onArchivieren}>Archivieren</Knopf>}
        <Knopf leise farbe={LEUCHT.kritisch} onClick={onLoeschen}>In den Papierkorb</Knopf>
        <Knopf onClick={onZu}>Fertig</Knopf>
      </div>
    </Fenster>
  );
}
