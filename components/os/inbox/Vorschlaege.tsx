'use client';

// ─── Inbox — Aufgaben-Vorschläge aus Mails/WhatsApp (10.10.2026, Roadmap Phase 1) ──────────────────────────────────
// Eine schmale Zeile unter dem Lagebild: „Vorschläge holen“ (prüft jetzt), Schalter „automatisch“ (Takt alle 15 Min., nur für mich) und
// wie viele Vorschläge in MEINEN Freigaben warten (Sprung dorthin). Erkannt wird auf dem Server ohne KI (lib/inbox/aufgaben-vorschlag*.ts);
// angelegt wird erst im Freigabe-Stapel per Klick. Die Oberfläche zeigt nur den eigenen Stand (GET /api/inbox/vorschlaege).

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, KUGEL, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { Knopf, Schalter } from '../ui';
import { holen, senden } from './daten';

interface Stand { ok: boolean; automatisch: boolean; letzterLauf?: string; offen: number; fehler?: string }

export function AufgabenVorschlaege({ meldung, space }: { meldung: (t: string) => void; space?: 'privat' | 'business' }) {
  const [s, setS] = useState<Stand | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const laden = useCallback(async () => {
    const r = await holen<Stand>('/api/inbox/vorschlaege');
    setS(r.d.ok ? r.d as Stand : null);
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  if (!s) return null; // ohne Haushalt (403) oder Fehler: keine Zeile
  const holenJetzt = async () => {
    setLaeuft(true);
    const r = await senden<{ text?: string }>('/api/inbox/vorschlaege', { aktion: 'holen' });
    setLaeuft(false);
    meldung(r.d.ok ? String(r.d.text ?? 'Geprüft.') : String(r.d.fehler ?? 'Das ging gerade nicht.'));
    await laden();
  };
  const umschalten = async (an: boolean) => {
    setS({ ...s, automatisch: an });
    const r = await senden<{ text?: string }>('/api/inbox/vorschlaege', { aktion: 'automatisch', an });
    meldung(r.d.ok ? String(r.d.text ?? 'Gespeichert.') : String(r.d.fehler ?? 'Das ging gerade nicht.'));
    await laden();
  };
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }} data-inbox="aufgaben-vorschlaege">
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Aufgaben aus der Post:</span>
      <Knopf leise onClick={holenJetzt} aus={laeuft}>{laeuft ? 'prüft …' : 'Vorschläge holen'}</Knopf>
      {s.offen > 0 && <Knopf leise farbe={KUGEL.granat} href={WEG.freigaben(undefined, space)}>{s.offen === 1 ? '1 Vorschlag wartet' : `${s.offen} Vorschläge warten`} ›</Knopf>}
      <Schalter an={s.automatisch} onChange={an => void umschalten(an)} erklaerung="postfach.aufgabenVorschlaege">automatisch</Schalter>
    </div>
  );
}
