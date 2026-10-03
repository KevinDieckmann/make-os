'use client';

// ─── Event · Start ohne Daten — das erste Event in einem Zug ────────────────
// Solange kein Event angelegt ist, steht statt einer leeren Liste ein
// geführter Start: Vorlage wählen (Ablauf, Checkliste mit sechs Wochen
// Vorlauf, Budgetposten und Soll-Mischung sind dann vorbereitet), Titel,
// Datum und Uhrzeit, Ort, das Ziel (Pflicht — „Netzwerken“ ist keins),
// Kapazität und Soll-Mischung. Angelegt wird über denselben Weg wie sonst
// (api.setze), danach springt die Ansicht ins Event. Ab dem ersten Event
// zeigt die Liste wieder „+ Event“.

import { localDay } from '@/lib/zeit';
import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../../ui';
import { VORLAGEN, vorlageAnwenden, zielHinweis, MIX_STANDARD, type VorlageId } from '@/lib/crm/eventplanung';
import { verantwortlich, nameVon } from '@/lib/crm/team';
import type { Event } from '@/lib/crm/typen';
import { type CrmApi, neueId, plusTage } from '../daten';
import { Feldzeile } from '../teile';
import { Wahl as WahlChip } from '../Wahl';
import { ZustaendigWahl } from '../team';
import { FORMATE, MarkeWahl, ReiheWahl } from './gemeinsam';
import { MARKE_EVENTS, reiheName, eventTitelVorschlag } from '@/lib/crm/marke';

type Wahl = VorlageId | 'ohne';
const OHNE = { id: 'ohne' as const, label: 'Ohne Vorlage' };

/** Blockiert nur, was kein Ziel ist: leer oder „Netzwerken“ ohne Zahl. Eine fehlende Zahl ist ein Hinweis, kein Stopp. */
const zielReicht = (ziel: string, hinweis: string | null) => !!ziel.trim() && !(hinweis && /kein Ziel/.test(hinweis));

export function Start({ api, onFertig }: { api: CrmApi; onFertig: (id: string) => void }) {
  const heute = api.crm?.heute ?? localDay();
  const [wahl, setWahl] = useState<Wahl>('stammtisch');
  const vorlage = VORLAGEN.find(v => v.id === wahl);
  const [titel, setTitel] = useState('');
  const [datum, setDatum] = useState(plusTage(heute, 42));
  const [uhrzeit, setUhrzeit] = useState(VORLAGEN[0].uhrzeit);
  const [ort, setOrt] = useState('');
  const [ziel, setZiel] = useState('');
  const [format, setFormat] = useState<Event['format']>('stammtisch');
  const [kapazitaet, setKapazitaet] = useState(String(VORLAGEN[0].kapazitaet));
  const [mixZiel, setMixZiel] = useState({ ...VORLAGEN[0].mixZiel });
  const [zustaendig, setZustaendig] = useState<string | undefined>(undefined);
  // Marke (27.09.): Vorgabe Make.One — undefined heißt abgeleitet, gespeichert wird sie beim Anlegen trotzdem ausdrücklich.
  const [marke, setMarke] = useState<string | undefined>(undefined);
  // Reihe (03.10., z. B. Fokus Innovation): optional — ohne Wahl ein gewöhnlicher Make.One-Abend.
  const [reihe, setReihe] = useState<string | undefined>(undefined);
  const [laeuft, setLaeuft] = useState(false);
  const hinweis = zielHinweis(ziel);
  const bereit = zielReicht(ziel, hinweis) && /^\d{4}-\d{2}-\d{2}$/.test(datum) && !laeuft;

  /** Vorlage wechseln: Uhrzeit, Kapazität, Mischung und Format folgen — nur, solange niemand etwas anderes getippt hat, sonst bleibt der Wert. */
  const waehle = (w: Wahl) => {
    const alt = VORLAGEN.find(v => v.id === wahl);
    const neu = VORLAGEN.find(v => v.id === w);
    setWahl(w);
    if (!neu) { if (!alt || format === alt.format) setFormat('sonstig'); return; }
    if (!alt || uhrzeit === alt.uhrzeit) setUhrzeit(neu.uhrzeit);
    if (!alt || kapazitaet === String(alt.kapazitaet)) setKapazitaet(String(neu.kapazitaet));
    if (!alt || (mixZiel.zielkunden === alt.mixZiel.zielkunden && mixZiel.kunden === alt.mixZiel.kunden)) setMixZiel({ ...neu.mixZiel });
    if (!alt || format === alt.format) setFormat(neu.format);
  };

  const anlegen = async () => {
    if (!bereit) return;
    setLaeuft(true);
    const kap = Math.round(Number(kapazitaet));
    const basis: Event = {
      id: neueId('ev'), titel: titel.trim() || eventTitelVorschlag(reihe, vorlage?.label), format, ziel: ziel.trim(), datum,
      ...(uhrzeit ? { uhrzeit } : {}), ...(ort.trim() ? { ort: ort.trim() } : {}),
      ...(Number.isFinite(kap) && kap > 0 ? { kapazitaet: kap } : {}),
      mixZiel: { zielkunden: mixZiel.zielkunden, kunden: mixZiel.kunden },
      status: 'geplant', ...(zustaendig ? { zustaendig } : {}), marke: marke ?? MARKE_EVENTS, ...(reihe ? { reihe } : {}), geaendert: new Date().toISOString(),
    };
    const e = vorlage ? vorlageAnwenden(basis, vorlage.id) : basis;
    await api.setze('events', e as unknown as { id: string } & Record<string, unknown>);
    setLaeuft(false);
    onFertig(e.id);
  };

  const prozent = (v: string, n: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 && x <= 100 ? x : n; };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2 }}>Das erste Event</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 6, lineHeight: 1.55 }}>
          Ein Event ist erfolgreich, wenn danach die richtigen Gespräche stattfinden. Deshalb zuerst das Ziel, dann die Gästemischung — mindestens 40 % Zielkunden, 20 % Kunden und Multiplikatoren. Sechs Wochen Vorlauf sind als Checkliste vorbereitet.
        </div>
      </div>

      <Feldzeile label="Vorlage">
        <div style={{ display: 'grid', gap: 6 }}>
          <WahlChip label="Vorlage" liste={[...VORLAGEN.map(v => ({ id: v.id as Wahl, label: v.label })), OHNE]} wert={wahl} onWahl={waehle} farbe={LEUCHT.beziehung} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{vorlage ? `${vorlage.beschreibung} Ablauf, Checkliste (${vorlage.checkliste.length} Punkte) und Budgetposten kommen mit.` : 'Leeres Event — Format, Ablauf und Checkliste baust du selbst auf.'}</span>
        </div>
      </Feldzeile>
      {!vorlage && <Feldzeile label="Format"><WahlChip label="Format" liste={FORMATE} wert={format} onWahl={setFormat} /></Feldzeile>}

      <Feldzeile label="Titel">
        <input value={titel} onChange={x => setTitel(x.target.value)} placeholder={reihe ? `z. B. ${reiheName(reihe)} Hamburg` : vorlage ? `z. B. ${vorlage.label} Maschinenbau Rhein-Main` : 'Titel des Events'} aria-label="Titel" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
      </Feldzeile>
      <Feldzeile label="Wann & wo">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="date" value={datum} onChange={x => setDatum(x.target.value)} aria-label="Datum" style={{ ...feld, width: 150, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <input type="time" value={uhrzeit} onChange={x => setUhrzeit(x.target.value)} aria-label="Uhrzeit" style={{ ...feld, width: 110, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <input value={ort} onChange={x => setOrt(x.target.value)} placeholder="Ort" aria-label="Ort" style={{ ...feld, flex: 1, minWidth: 160, width: 'auto', fontSize: TYP.bedien, padding: '8px 11px' }} />
        </div>
      </Feldzeile>
      <Feldzeile label="Ziel *">
        <div style={{ display: 'grid', gap: 4 }}>
          <input value={ziel} onChange={x => setZiel(x.target.value)} placeholder="Messbar und strittig: „drei Folgegespräche mit Inhabern aus dem Maschinenbau binnen 30 Tagen“" aria-label="Ziel" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <span style={{ fontSize: TYP.bedien, color: hinweis ? LEUCHT.achtung : LEUCHT.gut }}>{hinweis ?? 'Gutes Ziel — daran wird das Event nach 30 Tagen gemessen.'}</span>
        </div>
      </Feldzeile>
      <Feldzeile label="Rahmen">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="number" value={kapazitaet} onChange={x => setKapazitaet(x.target.value)} placeholder="Plätze" aria-label="Plätze" style={{ ...feld, width: 110, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Plätze</span>
        </div>
      </Feldzeile>
      <Feldzeile label="Soll-Mischung">
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>Zielkunden <input type="number" value={mixZiel.zielkunden} onChange={x => setMixZiel({ ...mixZiel, zielkunden: prozent(x.target.value, MIX_STANDARD.zielkunden) })} aria-label="Soll Zielkunden %" style={{ ...feld, width: 70, fontSize: TYP.bedien, padding: '6px 9px' }} /> %</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>Kunden/Multiplikatoren <input type="number" value={mixZiel.kunden} onChange={x => setMixZiel({ ...mixZiel, kunden: prozent(x.target.value, MIX_STANDARD.kunden) })} aria-label="Soll Kunden %" style={{ ...feld, width: 70, fontSize: TYP.bedien, padding: '6px 9px' }} /> %</span>
        </div>
      </Feldzeile>
      <Feldzeile label="Marke"><MarkeWahl wert={marke} onWahl={setMarke} /></Feldzeile>
      <Feldzeile label="Reihe"><ReiheWahl wert={reihe} onWahl={setReihe} /></Feldzeile>
      <Feldzeile label="Zuständig">
        <div style={{ display: 'grid', gap: 4 }}>
          <ZustaendigWahl wert={zustaendig} welt="event" onWahl={setZustaendig} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Ohne Wahl verantwortet {nameVon(verantwortlich('event'))} — beide sehen alles und arbeiten mit.</span>
        </div>
      </Feldzeile>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Knopf farbe={LEUCHT.beziehung} aus={!bereit} onClick={() => void anlegen()}>{laeuft ? 'legt an …' : 'Event anlegen'}</Knopf>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Status „Geplant“ — danach: Gäste aus der Kartei, Checkliste als Aufgaben, Budget in die Liquiditätsplanung, Termin in den Kalender.</span>
      </div>
    </div>
  );
}
