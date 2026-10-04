'use client';

// ─── Unternehmen › eine Gesellschaft: Reiter Steckbrief · Gesellschafter · Beteiligungen · Verträge · Unterlagen · Absender ──
// Steckbrief speichert feldweise beim Verlassen (Kette mit Stand, 409 → neu geladen, Meldung bleibt sichtbar).
// „Hervorgegangen aus“ in zwei Klicks: vorhandene Gesellschaft wählen ODER Namen eintippen → „Anlegen und verknüpfen“.
// Der Reiter „Absender“ (nur die drei festen Gesellschaften) ist die bisherige Absender-Pflege der Angebote — derselbe Eintrag.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { Seite, Karte, Ueberschrift, Knopf, Hinweis, Reiter, Pillen, Zahl, Raster, eingabe } from '../ui';
import { istGesellschaft } from '@/lib/einheiten';
import { zufallsUuid } from '@/lib/kennung';
import { gesellschaftenGeaendert } from '@/lib/gesellschaften/client';
import {
  GES_STATUS, GES_ROLLEN, RECHTSFORMEN, MIT_STAMMKAPITAL, anteile, eingezahltLautGesellschaftern, nachfolger, vorgaengerErlaubt, vorgaengerKette, statusLabel, rechtsformLabel,
  type GesStatus, type GesRolle, type Rechtsform,
} from '@/lib/gesellschaften/modell';
import { Gesellschaften as Absender } from '../crm/stammdaten/Gesellschaften';
import { useSchreiber, TextFeld, Auswahl, Felder, Feldzeile, klein, centText, centEingabe, tagText, type GAnzeige, type RegisterDaten } from './teile';
import { StatusPille } from './UnternehmenView';
import { GesellschafterReiter } from './Gesellschafter';
import { BeteiligungenReiter, VertraegeReiter, UnterlagenReiter } from './Vertraege';
import { FahrplanKarte } from './Fahrplan';
import { OrganeReiter } from './Organe';

type ReiterId = 'steckbrief' | 'gesellschafter' | 'organe' | 'beteiligungen' | 'vertraege' | 'unterlagen' | 'absender';
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function Detail({ g, daten, reiter, onReiter, zurueck, onNeu, neuLaden, oeffne }: {
  g: GAnzeige; daten: RegisterDaten; reiter: string; onReiter: (r: ReiterId) => void; zurueck: () => void; onNeu: (g: GAnzeige) => void; neuLaden: () => Promise<void>; oeffne: (id: string) => void;
}) {
  const fest = istGesellschaft(g.id);
  const sw = useSchreiber(g, onNeu);
  const aktive = g.gesellschafter?.filter(x => !x.geloeschtAm && !x.ausgeschiedenAm).length ?? 0;
  const vertraege = g.vertraege?.filter(v => !v.geloeschtAm && v.status !== 'beendet').length ?? 0;
  const liste: { id: ReiterId; label: string }[] = [
    { id: 'steckbrief', label: 'Steckbrief' }, { id: 'gesellschafter', label: `Gesellschafter${aktive ? ` · ${aktive}` : ''}` }, { id: 'organe', label: 'Organe & Beschlüsse' },
    { id: 'beteiligungen', label: 'Beteiligungen' }, { id: 'vertraege', label: `Verträge${vertraege ? ` · ${vertraege}` : ''}` },
    { id: 'unterlagen', label: 'Unterlagen' }, ...(fest ? [{ id: 'absender' as const, label: 'Absender' }] : []),
  ];
  const aktiv: ReiterId = liste.find(x => x.id === reiter)?.id ?? 'steckbrief';
  return (
    <Seite titel={g.name} unter={[rechtsformLabel(g.rechtsform), g.sitz || g.ort, g.geloeschtAm ? 'im Papierkorb' : undefined].filter(Boolean).join(' · ') || 'Eigene Gesellschaft'}
      rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><StatusPille s={g.status} /><Knopf leise onClick={zurueck}>‹ Alle</Knopf></span>}>
      <Reiter liste={liste} aktiv={aktiv} onWahl={onReiter} ariaLabel="Bereiche der Gesellschaft" />
      {sw.meldung && <Hinweis art="achtung" rolle="alert">{sw.meldung}</Hinweis>}
      {sw.unterwegs > 0 && <div role="status" style={klein}>speichert …</div>}
      {aktiv === 'steckbrief' && <Steckbrief g={g} daten={daten} schreibe={sw.schreibe} neuLaden={neuLaden} oeffne={oeffne} />}
      {aktiv === 'gesellschafter' && <GesellschafterReiter g={g} daten={daten} schreibe={sw.schreibe} />}
      {aktiv === 'organe' && <OrganeReiter g={g} daten={daten} schreibe={sw.schreibe} />}
      {aktiv === 'beteiligungen' && <BeteiligungenReiter g={g} daten={daten} schreibe={sw.schreibe} oeffne={oeffne} />}
      {aktiv === 'vertraege' && <VertraegeReiter g={g} daten={daten} schreibe={sw.schreibe} />}
      {aktiv === 'unterlagen' && <UnterlagenReiter g={g} />}
      {aktiv === 'absender' && fest && <Absender nur={g.id as 'kdc' | 'kdv' | 'ug'} onGeaendert={() => void neuLaden()} />}
    </Seite>
  );
}

type Schreibe = ReturnType<typeof useSchreiber>['schreibe'];

function Steckbrief({ g, daten, schreibe, neuLaden, oeffne }: { g: GAnzeige; daten: RegisterDaten; schreibe: Schreibe; neuLaden: () => Promise<void>; oeffne: (id: string) => void }) {
  const fest = istGesellschaft(g.id);
  const setze = (felder: Record<string, unknown>) => schreibe({ felder });
  const a = anteile(g);
  const kap = !g.rechtsform || MIT_STAMMKAPITAL.includes(g.rechtsform);
  const eingezahlt = g.eingezahltCent ?? (a.zeilen.length ? eingezahltLautGesellschaftern(g) : undefined);
  const kette = vorgaengerKette(g.id, daten.gesellschaften);
  const nach = nachfolger(g.id, daten.gesellschaften);
  const andere = daten.gesellschaften.filter(x => x.id !== g.id && !x.geloeschtAm && vorgaengerErlaubt(g.id, x.id, daten.gesellschaften));
  const [neuerVorgaenger, setNeuerVorgaenger] = useState('');
  const [anfrageId, setAnfrageId] = useState(() => `ges-${zufallsUuid()}`);
  const [fehler, setFehler] = useState<string | null>(null);
  const name = (id: string) => daten.gesellschaften.find(x => x.id === id)?.name ?? 'Gesellschaft';

  const vorgaengerAnlegen = async () => {
    setFehler(null);
    const r = await fetch('/api/gesellschaften', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anfrageId, felder: { name: neuerVorgaenger, ...(g.rechtsform ? { rechtsform: g.rechtsform } : {}), status: 'eingetragen' } }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts gespeichert.' }));
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht angelegt.'); return; }
    const v = await setze({ vorgaengerId: r.gesellschaft.id });
    if (v.ok) { setNeuerVorgaenger(''); setAnfrageId(`ges-${zufallsUuid()}`); gesellschaftenGeaendert(); await neuLaden(); }
  };

  return (
    <>
      {kap && (
        <Karte ton={SPACE_FARBE.business}>
          <Ueberschrift>Kapital</Ueberschrift>
          <Raster min={150}>
            <Zahl wert={g.stammkapitalCent !== undefined ? centText(g.stammkapitalCent) : '—'} label="Stammkapital" />
            <Zahl wert={eingezahlt !== undefined ? centText(eingezahlt) : '—'} label={g.eingezahltCent !== undefined ? 'eingezahlt' : 'eingezahlt (laut Gesellschaftern)'} />
            <Zahl wert={a.zeilen.length ? `${a.summeProzent.toLocaleString('de-DE')} %` : '—'} label={`${a.zeilen.length} Gesellschafter`} />
          </Raster>
          {a.hinweis && <div style={{ marginTop: 10 }}><Hinweis art="achtung">{a.hinweis}</Hinweis></div>}
        </Karte>
      )}
      {!g.geloeschtAm && <FahrplanKarte g={g} daten={daten} />}
      {g.luecken.length > 0 && <Hinweis art="info" titel="Noch offen">Für einen vollständigen Steckbrief fehlen: {g.luecken.join(', ')}. Hinweis, keine Rechtsberatung.</Hinweis>}
      <Karte>
        <Ueberschrift>Steckbrief</Ueberschrift>
        <div style={{ display: 'grid', gap: 16 }}>
          <Felder>
            {!fest && <Feldzeile label="Name"><TextFeld label="Name" wert={g.name} onFertig={t => void setze({ name: t })} /></Feldzeile>}
            <Feldzeile label="Firmierung (laut Register)"><TextFeld label="Firmierung" wert={g.firmierung ?? ''} platzhalter={fest ? g.name : 'z. B. Musterfirma GmbH'} onFertig={t => void setze({ firmierung: t })} /></Feldzeile>
            <Feldzeile label="Sitz"><TextFeld label="Sitz" wert={g.sitz ?? ''} platzhalter={g.ort || 'Stadt'} onFertig={t => void setze({ sitz: t })} /></Feldzeile>
            <Feldzeile label="Registergericht · HRB"><TextFeld label="Registergericht und HRB" wert={g.register ?? ''} platzhalter="z. B. Amtsgericht … HRB …" onFertig={t => void setze({ register: t })} /></Feldzeile>
            <Feldzeile label="Geschäftsführung"><TextFeld label="Geschäftsführung" wert={g.geschaeftsfuehrung ?? ''} onFertig={t => void setze({ geschaeftsfuehrung: t })} /></Feldzeile>
            <Feldzeile label="Gegründet am"><TextFeld typ="date" label="Gegründet am" wert={g.gegruendetAm ?? ''} onFertig={t => void setze({ gegruendetAm: t })} /></Feldzeile>
            <Feldzeile label="Eingetragen am"><TextFeld typ="date" label="Eingetragen am" wert={g.eingetragenAm ?? ''} onFertig={t => void setze({ eingetragenAm: t })} /></Feldzeile>
            {kap && <Feldzeile label="Stammkapital (gezeichnet, €)"><TextFeld label="Stammkapital in Euro" wert={centEingabe(g.stammkapitalCent)} platzhalter="z. B. 25.000" onFertig={t => void setze({ stammkapitalCent: t })} /></Feldzeile>}
            {kap && <Feldzeile label="Davon eingezahlt (€)"><TextFeld label="Eingezahltes Stammkapital in Euro" wert={centEingabe(g.eingezahltCent)} platzhalter={eingezahlt !== undefined ? centEingabe(eingezahlt) : 'z. B. 12.500'} onFertig={t => void setze({ eingezahltCent: t })} /></Feldzeile>}
            <Feldzeile label="Geschäftsjahr beginnt im"><Auswahl label="Beginn des Geschäftsjahres" wert={String(g.geschaeftsjahrBeginn ?? 1)} liste={MONATE.map((m, i) => ({ id: String(i + 1), label: i === 0 ? 'Januar (Kalenderjahr)' : m }))} onWahl={v => void setze({ geschaeftsjahrBeginn: Number(v) || null })} /></Feldzeile>
          </Felder>
          <Feldzeile label="Rechtsform"><Pillen liste={RECHTSFORMEN.map(x => ({ id: x.id, label: x.label }))} aktiv={g.rechtsform ?? null} onWahl={(r: Rechtsform) => void setze({ rechtsform: r })} /></Feldzeile>
          <Feldzeile label="Rolle"><Pillen liste={GES_ROLLEN.map(r => ({ id: r.id, label: r.label }))} aktiv={g.rolle ?? 'operativ'} onWahl={(r: GesRolle) => void setze({ rolle: r })} /></Feldzeile>
          {g.rolle === 'holding' && <div style={klein}>Als Holding gelten im Business-Index keine operativen Vertriebs- und Produktivitätskennzahlen{fest ? '' : ' (eigene Index-Sicht haben nur die drei festen Gesellschaften)'}.</div>}
          <Feldzeile label="Status"><Pillen liste={GES_STATUS.map(s => ({ id: s.id, label: s.label }))} aktiv={g.status ?? null} onWahl={(s: GesStatus) => void setze({ status: s })} /></Feldzeile>
          <Feldzeile label="Notizen"><TextFeld lang label="Notizen" wert={g.notizen ?? ''} onFertig={t => void setze({ notizen: t })} /></Feldzeile>
        </div>
      </Karte>
      <Karte>
        <Ueberschrift>Hervorgegangen aus</Ueberschrift>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={klein}>Umfirmierung oder Umwandlung: aus welcher Gesellschaft ist diese hervorgegangen? Die Kette läuft nie im Kreis.</div>
          <Auswahl label="Vorgänger" wert={g.vorgaengerId ?? ''} leer="— keiner —" liste={andere.map(x => ({ id: x.id as string, label: `${x.name}${x.status ? ` (${statusLabel(x.status)})` : ''}` }))} onWahl={v => void setze({ vorgaengerId: v || null })} />
          <form onSubmit={e => { e.preventDefault(); if (neuerVorgaenger.trim().length >= 2) void vorgaengerAnlegen(); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={neuerVorgaenger} onChange={e => setNeuerVorgaenger(e.target.value)} aria-label="Name des Vorgängers" placeholder="Noch nicht im Register? Name eintippen" style={{ ...eingabe, flex: '1 1 240px', width: 'auto' }} />
            <Knopf typ="submit" leise aus={neuerVorgaenger.trim().length < 2}>Anlegen und verknüpfen</Knopf>
          </form>
          {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
          {kette.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
              <span>Kette:</span>
              {[...kette].reverse().map(id => <span key={id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Knopf leise onClick={() => oeffne(id)}>{name(id)}</Knopf><span aria-hidden>→</span></span>)}
              <strong style={{ color: C.ink }}>{g.name}</strong>
            </div>
          )}
          {nach.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
              <span>Daraus hervorgegangen:</span>
              {nach.map(x => <Knopf key={x.id} leise onClick={() => oeffne(x.id)}>{x.name}</Knopf>)}
            </div>
          )}
          {g.angelegt && <div style={klein}>Im Register seit {tagText(g.angelegt.slice(0, 10))}.</div>}
        </div>
      </Karte>
    </>
  );
}
