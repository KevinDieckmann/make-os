'use client';

// ─── Event · Kalender — Datei zum Herunterladen und Termin im gemeinsamen Kalender ──
// Zwei Wege, beide nur auf Klick: die Kalender-Datei (RFC 5545, gästetauglich, lib/crm/eventplanung.ts) und ein
// Termin im Kalender „Gemeinsam“. Seit 29.09. (K5, Verbindungskarte Befund 4) über POST /api/kalender/spiegel: ein
// echter iCloud-Termin mit ECHTER, fester UID (`kalenderUid`), Titel, Ort, Tag, Uhrzeit, drei Stunden, Bezug `eventId`
// (kalender-bezug) — keine Gäste, keine Einladungen. Ändert jemand Datum/Uhrzeit/Titel/Ort im Event oder sagt es ab,
// zieht der Server den Termin nach bzw. löscht ihn (lib/kalender/spiegel-server.ts). Kommt die Absage anders (ZOE, Heads),
// meldet der Takt sie nur in die Glocke — gelöscht wird dann hier per Klick („Termin im Kalender löschen“, U1 B3).
// Alte Events mit erfundener Kennung (`mac-…`) werden NUR per Klick „Mit dem Kalender verknüpfen“ mit ihrem Termin
// verknüpft, wenn er eindeutig ist.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Chip, LEUCHT, useRueckfrage } from '../../ui';
import type { Event } from '@/lib/crm/typen';

type Lage = 'prueft' | 'da' | 'fehlt' | 'schein' | 'keiner' | 'ohne-icloud' | 'kein-zugang' | 'nicht-erreichbar';

export function Kalender({ e }: { e: Event }) {
  const [lage, setLage] = useState<Lage>('prueft');
  const [grund, setGrund] = useState('');
  const [warDa, setWarDa] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const { bestaetigen, dialog } = useRueckfrage();
  const [meldung, setMeldung] = useState('');
  const { id, datum, uhrzeit, status } = e;

  // Geprüft wird je Event, Tag, Uhrzeit, Status und Kennung — nicht bei jedem Abgleich des Bestands (alle 20 s).
  const pruefen = useCallback(async () => {
    try {
      const r = await fetch(`/api/kalender/spiegel?art=event&id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (r.status === 403) { setLage('kein-zugang'); return; }
      const d = await r.json() as { ok?: boolean; lage?: Lage; uid?: string; grund?: string };
      if (!r.ok || !d.ok || !d.lage) { setLage('nicht-erreichbar'); return; }
      setLage(d.lage); setGrund(d.grund ?? ''); setWarDa(!!d.uid);
    } catch { setLage('nicht-erreichbar'); }
  }, [id]);
  useEffect(() => { void pruefen(); }, [pruefen, datum, uhrzeit, status, e.kalenderUid]);

  const anlegen = async () => {
    if (laeuft) return;
    setLaeuft(true); setMeldung('');
    const r = await fetch('/api/kalender/spiegel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ art: 'event', id }) })
      .then(x => x.json() as Promise<{ ok: boolean; fehler?: string }>).catch(() => ({ ok: false, fehler: 'Kalender nicht erreichbar.' }));
    setLaeuft(false);
    if (r.ok) { setMeldung('Termin steht im Kalender „Gemeinsam“ — drei Stunden, ohne Gäste. Änderungen am Event zieht er mit.'); void pruefen(); }
    else setMeldung(r.fehler ?? 'Termin nicht angelegt.');
  };

  const loeschen = async () => {
    if (laeuft || !(await bestaetigen({ titel: 'Termin im Kalender löschen?', text: 'Der Termin dieses abgesagten Events wird im Kalender „Gemeinsam“ gelöscht. Das Event selbst bleibt.', ja: 'Löschen', gefahr: true }))) return;
    setLaeuft(true); setMeldung('');
    const r = await fetch('/api/kalender/spiegel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ art: 'event', id, aktion: 'loeschen' }) })
      .then(x => x.json() as Promise<{ ok: boolean; fehler?: string }>).catch(() => ({ ok: false, fehler: 'Kalender nicht erreichbar.' }));
    setLaeuft(false);
    setMeldung(r.ok ? 'Termin gelöscht.' : r.fehler ?? 'Termin nicht gelöscht.');
    void pruefen();
  };

  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {lage === 'da' && <Chip farbe={status === 'abgesagt' ? LEUCHT.achtung : LEUCHT.gut}>im Kalender</Chip>}
        {lage === 'da' && status === 'abgesagt' && <Knopf leise aus={laeuft} onClick={() => void loeschen()}>{laeuft ? 'löscht …' : 'Termin im Kalender löschen'}</Knopf>}
        {lage === 'schein' && <Knopf leise aus={laeuft} onClick={() => void anlegen()}>{laeuft ? 'verknüpft …' : 'Mit dem Kalender verknüpfen'}</Knopf>}
        {lage === 'fehlt' && status !== 'abgesagt' && <Knopf leise aus={laeuft} onClick={() => void anlegen()}>{laeuft ? 'trägt ein …' : warDa ? 'Termin neu anlegen' : 'Termin anlegen (Kalender Gemeinsam)'}</Knopf>}
        <Knopf leise onClick={() => { window.location.href = `/api/crm/events?ics=${encodeURIComponent(id)}`; }}>Kalender-Datei</Knopf>
      </div>
      {lage === 'fehlt' && warDa && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Der Termin ist nicht mehr im Kalender (in Apple gelöscht?).</span>}
      {lage === 'schein' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Alter Eintrag ohne echte Kennung — verknüpfen sucht den Termin (Tag + Titel) oder legt ihn neu an.</span>}
      {lage === 'keiner' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{grund || 'Uhrzeit setzen (Überblick), dann lässt sich der Termin anlegen.'}</span>}
      {lage === 'ohne-icloud' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Ohne iCloud kein Termin — die Kalender-Datei geht immer.</span>}
      {lage === 'kein-zugang' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Termin anlegen geht nur im Haushalt des Inhabers — die Kalender-Datei immer.</span>}
      {lage === 'nicht-erreichbar' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Kalender gerade nicht erreichbar — die Kalender-Datei geht immer.</span>}
      {meldung && <span style={{ fontSize: TYP.bedien, color: lage === 'da' ? LEUCHT.gut : LEUCHT.achtung }}>{meldung}</span>}
      {dialog}
    </div>
  );
}
