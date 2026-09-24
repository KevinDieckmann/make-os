'use client';

// ─── Event · Checkliste — sechs Wochen Vorlauf, Nachfassen, Wirkung ─────────
// Jeder Punkt hat einen Vorlauf in Tagen (negativ = nach dem Event); fällig
// ist er am Eventdatum minus Vorlauf. „Als Aufgaben anlegen“ macht aus jedem
// offenen Punkt eine Aufgabe in der Aufgabenliste (wiederholbar, nie
// doppelt); wird ein verknüpfter Punkt hier abgehakt, zieht die Aufgabe mit.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Chip, Leer, Haken, Fortschritt, feld, LEUCHT } from '../../schlank';
import { checklisteFaellig, checklisteStand, vorlageAnwenden, VORLAGEN, type FaelligerPunkt } from '@/lib/crm/eventplanung';
import type { Event } from '@/lib/crm/typen';
import { neueId, datum } from '../daten';
import { Feld } from '../teile';
import { eventSetzen, Leise, type ReiterProps } from './gemeinsam';

type Punkt = NonNullable<Event['checkliste']>[number];
const vorlauf = (t: number) => (t > 0 ? `${t} T vorher` : t === 0 ? 'am Tag' : `${-t} T danach`);

export function Checkliste({ e, api }: ReiterProps) {
  const crm = api.crm!;
  const heute = crm.heute;
  const [text, setText] = useState('');
  const [tage, setTage] = useState('7');
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const liste = checklisteFaellig(e, heute);
  const stand = checklisteStand(e, heute);
  const offen = liste.filter(p => !p.erledigt);
  const erledigt = liste.filter(p => p.erledigt);

  const speichern = (neu: Punkt[]) => eventSetzen(api, e, { checkliste: neu });
  const aendern = (id: string, teil: Partial<Punkt>) => speichern((e.checkliste ?? []).map(p => (p.id === id ? { ...p, ...teil } : p)));
  const post = (body: Record<string, unknown>) => fetch('/api/crm/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: e.id, ...body }) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));

  const abhaken = async (p: FaelligerPunkt) => {
    await aendern(p.id, { erledigt: !p.erledigt });
    if (p.aufgabeId) {
      const r = await post({ aktion: 'aufgabe-status', punktId: p.id, erledigt: !p.erledigt });
      if (r.ok && r.geaendert) setMeldung(!p.erledigt ? 'Aufgabe mit abgehakt.' : 'Aufgabe wieder geöffnet.');
    }
  };
  const alsAufgaben = async () => {
    setLaeuft(true); setMeldung('');
    const r = await post({ aktion: 'checkliste-aufgaben' });
    setLaeuft(false);
    setMeldung(!r.ok ? (r.fehler ?? 'Nicht angelegt.')
      : [r.angelegt ? `${r.angelegt} Aufgaben angelegt` : '', r.schonDa ? `${r.schonDa} gab es schon — verknüpft` : '', r.abgehakt ? `${r.abgehakt} in der Aufgabenliste erledigt — hier abgehakt` : ''].filter(Boolean).join(' · ') || 'Nichts zu tun — alle offenen Punkte haben schon eine Aufgabe.');
    await api.laden();
  };
  const dazu = () => {
    const t = Number(tage);
    if (!text.trim() || !Number.isFinite(t)) return;
    void speichern([...(e.checkliste ?? []), { id: neueId('cl'), text: text.trim(), tageVorher: Math.max(-30, Math.min(120, Math.round(t))), erledigt: false }]);
    setText('');
  };

  const zeile = (p: FaelligerPunkt) => {
    const farbe = p.erledigt ? C.inkLeise : p.ueberfaellig ? LEUCHT.kritisch : p.tage <= 3 ? LEUCHT.achtung : C.inkDim;
    return (
      <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
        <Haken an={p.erledigt} onChange={() => void abhaken(p)} farbe={p.ueberfaellig ? LEUCHT.kritisch : undefined} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: TYP.bedien, color: p.erledigt ? C.inkLeise : C.ink, textDecoration: p.erledigt ? 'line-through' : undefined }}>{p.text}</div>
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 2 }}>fällig {datum(p.faelligAm, heute)} · {vorlauf(p.tageVorher)}{p.aufgabeId ? ' · als Aufgabe angelegt' : ''}</div>
        </div>
        {!p.erledigt && <Chip farbe={farbe}>{p.ueberfaellig ? `${-p.tage} T überfällig` : p.tage === 0 ? 'heute' : `in ${p.tage} T`}</Chip>}
        <Feld typ="number" wert={String(p.tageVorher)} breite={70} platzhalter="Tage vorher" onFertig={v => { const n = Math.round(Number(v)); if (Number.isFinite(n) && n !== p.tageVorher) void aendern(p.id, { tageVorher: Math.max(-30, Math.min(120, n)) }); }} />
        <button onClick={() => speichern((e.checkliste ?? []).filter(x => x.id !== p.id))} aria-label="Punkt entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.body }}>×</button>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Ueberschrift rechts={<Knopf leise aus={laeuft || !stand.ohneAufgabe} onClick={alsAufgaben}>{laeuft ? 'legt an …' : `Als Aufgaben anlegen${stand.ohneAufgabe ? ` (${stand.ohneAufgabe})` : ''}`}</Knopf>}>
        Checkliste{stand.ueberfaellig ? ` · ${stand.ueberfaellig} überfällig` : ''}
      </Ueberschrift>
      {meldung && <div style={{ fontSize: 12.5, color: C.inkDim }}>{meldung}</div>}
      {liste.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
          <Fortschritt anteil={stand.gesamt ? stand.erledigt / stand.gesamt : 0} farbe={stand.ueberfaellig ? LEUCHT.achtung : LEUCHT.gut} />
          <span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{stand.erledigt} / {stand.gesamt}</span>
        </div>
      )}
      <div>{offen.map(zeile)}</div>
      {!liste.length && (
        <Leer>
          Noch keine Checkliste. Die Vorlage legt sechs Wochen Vorlauf an: Ziel (42 Tage), Gästeliste (28), persönliche Einladungen (21), Erinnerung (7), Technik (1), Nachfassen in 48 h, Wirkung nach 30 Tagen.
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {VORLAGEN.map(v => <Knopf key={v.id} leise onClick={() => api.setze('events', vorlageAnwenden(e, v.id) as unknown as { id: string } & Record<string, unknown>)}>{v.label}</Knopf>)}
          </div>
        </Leer>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={text} onChange={x => setText(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') dazu(); }} placeholder="Neuer Punkt, z. B. Co-Host briefen" aria-label="Neuer Punkt"
          style={{ ...feld, flex: 1, minWidth: 200, width: 'auto', fontSize: TYP.bedien, padding: '8px 11px' }} />
        <input type="number" value={tage} onChange={x => setTage(x.target.value)} aria-label="Tage vorher" title="Tage vor dem Event (negativ = danach)" style={{ ...feld, width: 90, fontSize: TYP.bedien, padding: '8px 11px' }} />
        <span style={{ fontSize: 12, color: C.inkLeise }}>Tage vorher</span>
        <Knopf leise aus={!text.trim()} onClick={dazu}>+ Punkt</Knopf>
      </div>
      {erledigt.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim }}>Erledigt ({erledigt.length})</summary>
          <div style={{ marginTop: 6 }}>{erledigt.map(zeile)}</div>
        </details>
      )}
      <div style={{ fontSize: 12, color: C.inkLeise }}>
        Aufgaben erscheinen in der Aufgabenliste mit Fälligkeit und den Stichworten „crm“ und „event“.
        {!stand.ohneAufgabe && offen.some(p => p.aufgabeId) && <> <Leise onClick={() => void alsAufgaben()}>In der Aufgabenliste Erledigtes übernehmen</Leise></>}
      </div>
    </div>
  );
}
