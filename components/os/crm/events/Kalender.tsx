'use client';

// ─── Event · Kalender — Datei zum Herunterladen und Termin im gemeinsamen Kalender ──
// Zwei Wege, beide nur auf Klick: die Kalender-Datei (RFC 5545, gästetauglich,
// lib/crm/eventplanung.ts) und ein Termin im Kalender „Gemeinsam“ über den
// bestehenden Weg /api/apple-calendar/create — nur Titel (mit Ort), Datum,
// Uhrzeit und drei Stunden; keine Gäste, keine Einladungen. Ob der Termin
// schon steht, weiß das Event selbst (`kalenderUid`, 27.09.) — für ältere Events
// ohne Kennung fragt der Kalender-Cache (/api/apple-calendar, Titel + Tag).

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Knopf, Chip, LEUCHT } from '../../schlank';
import { kalenderTermin, terminBekannt } from '@/lib/crm/event-bruecke';
import type { Event } from '@/lib/crm/typen';

type Lage = 'prueft' | 'bekannt' | 'frei' | 'kein-zugang' | 'nicht-erreichbar';

export function Kalender({ e }: { e: Event }) {
  const [lage, setLage] = useState<Lage>('prueft');
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const termin = kalenderTermin(e);
  const { titel, datum } = e;

  // Geprüft wird je Titel und Tag — nicht bei jedem Abgleich des Bestands (alle 20 s).
  const pruefen = useCallback(async () => {
    if (e.kalenderUid) { setLage('bekannt'); return; }
    try {
      const r = await fetch('/api/apple-calendar', { cache: 'no-store' });
      if (r.status === 403) { setLage('kein-zugang'); return; }
      if (!r.ok) { setLage('nicht-erreichbar'); return; }
      const liste = (await r.json()) as unknown;
      setLage(Array.isArray(liste) && terminBekannt(liste as { title?: unknown; startDate?: unknown }[], { titel, datum }) ? 'bekannt' : 'frei');
    } catch { setLage('nicht-erreichbar'); }
  }, [titel, datum, e.kalenderUid]);
  useEffect(() => { void pruefen(); }, [pruefen]);

  const anlegen = async () => {
    if (!termin || laeuft) return;
    setLaeuft(true); setMeldung('');
    type Antwort = { ok: boolean; created?: number; error?: string; fehler?: string; teilweise?: string };
    const r: Antwort = await fetch('/api/apple-calendar/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [termin] }) })
      .then(x => x.json() as Promise<Antwort>).catch((): Antwort => ({ ok: false, error: 'Kalender nicht erreichbar.' }));
    setLaeuft(false);
    if (r.ok && r.created) {
      setLage('bekannt'); setMeldung('Termin steht im Kalender „Gemeinsam“ — drei Stunden, ohne Gäste.');
      // /create liefert keine Termin-Kennung — die Marke am Event verhindert trotzdem einen zweiten Termin.
      void fetch('/api/crm/bestand', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [{ liste: 'events', op: 'teil', id: e.id, felder: { kalenderUid: `mac-${Date.now().toString(36)}` } }] }) }).catch(() => {});
    }
    else setMeldung(r.error ?? r.fehler ?? 'Termin nicht angelegt.');
  };

  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {lage === 'bekannt' && <Chip farbe={LEUCHT.gut}>im Kalender</Chip>}
        {lage === 'frei' && termin && <Knopf leise aus={laeuft} onClick={() => void anlegen()}>{laeuft ? 'trägt ein …' : 'Termin anlegen (Kalender Gemeinsam)'}</Knopf>}
        <Knopf leise onClick={() => { window.location.href = `/api/crm/events?ics=${encodeURIComponent(e.id)}`; }}>Kalender-Datei</Knopf>
      </div>
      {lage === 'frei' && !termin && <span style={{ fontSize: 12, color: C.inkLeise }}>Uhrzeit setzen (Überblick), dann lässt sich der Termin anlegen.</span>}
      {lage === 'kein-zugang' && <span style={{ fontSize: 12, color: C.inkLeise }}>Termin anlegen geht nur im Haushalt des Inhabers — die Kalender-Datei immer.</span>}
      {lage === 'nicht-erreichbar' && <span style={{ fontSize: 12, color: C.inkLeise }}>Kalender gerade nicht erreichbar — die Kalender-Datei geht immer.</span>}
      {meldung && <span style={{ fontSize: 12, color: lage === 'bekannt' ? LEUCHT.gut : LEUCHT.achtung }}>{meldung}</span>}
    </div>
  );
}
