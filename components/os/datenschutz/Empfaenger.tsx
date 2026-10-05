'use client';

// ─── System › Datenschutz · Empfänger und Auftragsverarbeiter (05.10.) ──────
// Vorgabe-Liste (Startwerte) → bearbeitbar je Instanz. Je Eintrag Rolle, Zweck, Datenkategorien, Drittland/Garantie und der
// AVV-Nachweis (offen / bestätigt am + Unterlage). EINE Quelle für Verzeichnis-Export, Auskunft (Art. 15 Abs. 1 lit. c) und
// Selbstprüfung. Zeilen-Aktionen wie überall: Archivieren (= nicht in Gebrauch, zurückholbar) und Löschen (mit Rückfrage).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Liste, Zeile, Punkt, Feldzeile, feld, auswahl, LEUCHT, ZeileAktionen, useRueckfrage } from '../ui';
import { ROLLEN, GARANTIEN, avvText, rolleText, garantieText, empfaengerPruefen, type Empfaenger, type AvvStatus } from '@/lib/datenschutz/einrichtung';

const AVV_FARBE = (e: Empfaenger) => (e.archiviert ? C.inkLeise : e.rolle !== 'auftragsverarbeiter' ? C.inkDim : e.avv.status === 'bestaetigt' ? LEUCHT.gut : LEUCHT.achtung);

async function senden(body: unknown): Promise<{ ok: boolean; fehler?: string; empfaenger?: Empfaenger[] }> {
  return fetch('/api/datenschutz/einrichtung', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
}

export function EmpfaengerKarte({ liste, darf, onGeaendert, i = 1 }: { liste: Empfaenger[]; darf: boolean; onGeaendert: () => void; i?: number }) {
  const [offen, setOffen] = useState<string | null>(null);
  const [neu, setNeu] = useState<Empfaenger | null>(null);
  const [meldung, setMeldung] = useState('');
  const { bestaetigen, dialog } = useRueckfrage();
  const aktiv = liste.filter(e => !e.archiviert), archiv = liste.filter(e => e.archiviert);
  const offeneAvv = aktiv.filter(e => e.rolle === 'auftragsverarbeiter' && e.avv.status !== 'bestaetigt').length;
  const tun = async (body: unknown, ok: string) => { const r = await senden(body); setMeldung(r.ok ? ok : r.fehler ?? 'Nicht gespeichert.'); if (r.ok) onGeaendert(); return r.ok; };
  const zeile = (e: Empfaenger) => (
    <div key={e.id}>
      <ZeileAktionen titel={e.name} darf={darf} archiviert={e.archiviert}
        onArchivieren={() => tun({ aktion: 'empfaenger-archiv', id: e.id, archiviert: !e.archiviert }, e.archiviert ? `„${e.name}“ ist wieder in Gebrauch.` : `„${e.name}“ ist archiviert (nicht in Gebrauch).`)}
        onLoeschen={async () => { if (await bestaetigen({ titel: `„${e.name}“ löschen?`, text: 'Der Eintrag und sein AVV-Nachweis verschwinden aus dem Register. Wird der Dienst nur nicht mehr genutzt, ist „Archivieren“ besser — der Nachweis bleibt.', ja: 'Löschen', gefahr: true })) await tun({ aktion: 'empfaenger-weg', id: e.id }, `„${e.name}“ gelöscht.`); }}>
        <Zeile onClick={() => setOffen(offen === e.id ? null : e.id)} aktiv={offen === e.id} links={<Punkt farbe={AVV_FARBE(e)} />} titel={e.name}
          unter={`${rolleText(e.rolle)} · ${e.drittland ? `${e.drittland} (${garantieText(e.garantie)})` : 'EU/EWR'}${e.rolle === 'auftragsverarbeiter' ? ` · AVV ${avvText(e.avv)}` : ''}`}
          rechts={<Chip farbe={AVV_FARBE(e)}>{e.archiviert ? 'archiviert' : e.rolle === 'auftragsverarbeiter' ? (e.avv.status === 'bestaetigt' ? 'AVV bestätigt' : 'AVV offen') : e.avv.status === 'nicht-noetig' ? 'kein AVV nötig' : rolleText(e.rolle).split(' ')[0]}</Chip>} />
      </ZeileAktionen>
      {offen === e.id && <Bearbeiten e={e} darf={darf} onSpeichern={async x => { if (await tun({ aktion: 'empfaenger', empfaenger: x }, `„${x.name}“ gespeichert.`)) setOffen(null); }} />}
    </div>
  );
  return (
    <Karte i={i} id="empfaenger" akzent={offeneAvv ? LEUCHT.achtung : undefined}>
      <Ueberschrift rechts={darf ? <Knopf leise onClick={() => setNeu({ id: `e-${Date.now().toString(36)}`, name: '', rolle: 'auftragsverarbeiter', zweck: '', daten: '', drittland: '', garantie: 'eu', avv: { status: 'offen' }, dritte: true })}>+ Empfänger</Knopf> : undefined}>Empfänger und Auftragsverarbeiter</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: offeneAvv ? LEUCHT.achtung : C.inkLeise, marginBottom: 8, lineHeight: 1.5 }}>
        {offeneAvv ? `${offeneAvv} Auftragsverarbeiter ohne bestätigten AVV (Art. 28 Abs. 3) — öffnen, „bestätigt“ mit Tag und Unterlage eintragen.` : 'Alle Auftragsverarbeiter in Gebrauch haben einen bestätigten AVV.'} Diese Liste speist das Verzeichnis, die Auskunft an Betroffene und die Selbstprüfung.
      </div>
      {neu && <Bearbeiten e={neu} darf={darf} neu onAbbrechen={() => setNeu(null)} onSpeichern={async x => { if (await tun({ aktion: 'empfaenger', empfaenger: x }, `„${x.name}“ angelegt.`)) setNeu(null); }} />}
      <Liste>{aktiv.map(zeile)}</Liste>
      {archiv.length > 0 && <><div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '12px 0 4px' }}>Nicht in Gebrauch (archiviert)</div><Liste>{archiv.map(zeile)}</Liste></>}
      {meldung && <div role="status" style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
      {dialog}
    </Karte>
  );
}

function Bearbeiten({ e, darf, neu, onSpeichern, onAbbrechen }: { e: Empfaenger; darf: boolean; neu?: boolean; onSpeichern: (e: Empfaenger) => void | Promise<void>; onAbbrechen?: () => void }) {
  const [x, setX] = useState<Empfaenger>(e);
  const [fehler, setFehler] = useState('');
  const setze = <K extends keyof Empfaenger>(k: K, v: Empfaenger[K]) => setX(a => ({ ...a, [k]: v }));
  const text = (k: 'name' | 'zweck' | 'daten' | 'drittland' | 'notiz', label: string, platz?: string) => (
    <Feldzeile label={label}><input value={String(x[k] ?? '')} onChange={ev => setze(k, ev.target.value)} placeholder={platz} disabled={!darf} style={feld} /></Feldzeile>
  );
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', padding: '10px 2px 16px' }}>
      {text('name', 'Name')}
      <Feldzeile label="Rolle"><select value={x.rolle} disabled={!darf} onChange={ev => setze('rolle', ev.target.value as Empfaenger['rolle'])} style={auswahl}>{ROLLEN.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Feldzeile>
      {text('zweck', 'Zweck')}
      {text('daten', 'Datenkategorien')}
      {text('drittland', 'Drittland (leer = EU/EWR)')}
      <Feldzeile label="Garantie"><select value={x.garantie} disabled={!darf} onChange={ev => setze('garantie', ev.target.value as Empfaenger['garantie'])} style={auswahl}>{GARANTIEN.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></Feldzeile>
      <Feldzeile label="AVV-Status"><select value={x.avv.status} disabled={!darf} onChange={ev => setze('avv', { ...x.avv, status: ev.target.value as AvvStatus })} style={auswahl}>
        <option value="offen">offen</option><option value="bestaetigt">bestätigt</option><option value="nicht-noetig">nicht nötig (kein Auftragsverarbeiter)</option>
      </select></Feldzeile>
      {x.avv.status === 'bestaetigt' && <Feldzeile label="Bestätigt am"><input type="date" value={x.avv.am ?? ''} disabled={!darf} onChange={ev => setze('avv', { ...x.avv, am: ev.target.value })} style={feld} /></Feldzeile>}
      {x.avv.status === 'bestaetigt' && <Feldzeile label="Unterlage (Datei, Ablage oder Link)"><input value={x.avv.unterlage ?? ''} disabled={!darf} onChange={ev => setze('avv', { ...x.avv, unterlage: ev.target.value })} style={feld} /></Feldzeile>}
      {text('notiz', 'Notiz')}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
        <input type="checkbox" checked={x.dritte} disabled={!darf} onChange={ev => setze('dritte', ev.target.checked)} /> Daten Dritter kommen dort an (steht in der Auskunft)
      </label>
      {darf && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Knopf onClick={async () => { const p = empfaengerPruefen(x); if (!p.ok) { setFehler(p.fehler); return; } setFehler(''); await onSpeichern(p.e); }}>{neu ? 'Anlegen' : 'Speichern'}</Knopf>
        {onAbbrechen && <Knopf leise onClick={onAbbrechen}>Abbrechen</Knopf>}
        {fehler && <span role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{fehler}</span>}
      </div>}
    </div>
  );
}
