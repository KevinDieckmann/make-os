'use client';

// ─── Akte · Information nach Art. 14 als Entwurf (05.10., Paket „Betroffenenrechte v2“) ──────────────────────────────
// Für Personen, deren Daten nicht bei ihnen selbst erhoben wurden: „Entwurf öffnen“ holt den Text aus der Vorlage der Einrichtung
// (POST /api/crm/datenschutz { aktion: 'art14-entwurf' }) — NICHTS wird versendet. Die Person des Haushalts öffnet ihn im Mail-Programm
// (Einzelklick, mailto) und sagt danach „ist raus“ (`art14-raus` → `art14InformiertAm` + Verlauf, Server-Tag). Wie die Danke-Mail.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../../ui';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmApi } from '../daten';

interface Entwurf { betreff: string; text: string; an: string | null; mailto: string | null; frist?: { bis?: string; tage?: number; stufe?: string } }

export function Art14Entwurf({ k, api }: { k: Kontakt; api: CrmApi }) {
  const [e, setE] = useState<Entwurf | null>(null);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const post = (body: Record<string, unknown>) => fetch('/api/crm/datenschutz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
  async function oeffnen() {
    setLaeuft(true); setFehler('');
    const r = await post({ aktion: 'art14-entwurf', id: k.id });
    setLaeuft(false);
    if (!r.ok) { setFehler(r.fehler ?? 'Kein Entwurf.'); return; }
    setE(r as Entwurf);
  }
  async function raus() {
    setLaeuft(true);
    const r = await post({ aktion: 'art14-raus', id: k.id });
    setLaeuft(false);
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht vermerkt.'); return; }
    setE(null);
    await api.laden(true);
  }
  if (!e) return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Knopf leise aus={laeuft || !!k.eingeschraenkt} onClick={() => void oeffnen()}>Information als Entwurf</Knopf>
      {fehler && <span role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{fehler}</span>}
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 8, padding: 10, border: `1px solid ${C.linie}`, borderRadius: 10 }}>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Entwurf — wird nicht automatisch versendet.{e.frist?.bis ? ` Frist: spätestens ${e.frist.bis.slice(8, 10)}.${e.frist.bis.slice(5, 7)}.${e.frist.bis.slice(0, 4)}.` : ''}{!e.an ? ' Keine Mail-Adresse — Text kopieren und anders zustellen (z. B. Brief).' : ''}</div>
      <input readOnly value={e.betreff} aria-label="Betreff" style={{ ...feld, fontSize: TYP.bedien }} />
      <textarea readOnly value={e.text} rows={9} aria-label="Text" style={{ ...feld, fontSize: TYP.bedien, lineHeight: 1.5, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {e.mailto && <Knopf leise onClick={() => { window.location.href = e.mailto!; }}>Im Mail-Programm öffnen</Knopf>}
        <Knopf leise onClick={() => { try { void navigator.clipboard.writeText(`${e.betreff}\n\n${e.text}`); } catch { /* Text steht oben */ } }}>Text kopieren</Knopf>
        <Knopf aus={laeuft} onClick={() => void raus()}>Ist raus</Knopf>
        <Knopf leise onClick={() => setE(null)}>Schließen</Knopf>
      </div>
      {fehler && <span role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{fehler}</span>}
    </div>
  );
}
