'use client';

// ─── Markttraktion · Marketing › Anfragen — Schalter des Kontaktformulars der Website (31.10., Website-Anbau) ─────────────────────────
// Das Formular unter /anfrage (auch unter der Adresse der Website) kommt AUS. Nachrichten landen als Anfrage „über Website“ unten in der Liste,
// mit Follow-up „Anfrage beantworten“. Umschalten nur Inhaber und volle Mitglieder (02.11., Server: /api/kontaktformular/intern), alle anderen sehen den Stand.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Hinweis, Schalter } from '../../ui';
import { WEG } from '@/lib/wege';

interface Stand { aktiv: boolean; bereit: boolean; gruende: string[]; pfad: string; istInhaber?: boolean }

export function KontaktformularKarte() {
  const [d, setD] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState('');
  const laden = useCallback(async () => {
    const r = await fetch('/api/kontaktformular/intern', { cache: 'no-store' }).catch(() => null);
    if (r?.ok) setD(await r.json() as Stand);
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  if (!d) return null;
  const schalten = async (an: boolean) => {
    setFehler('');
    const r = await fetch('/api/kontaktformular/intern', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktiv: an }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setFehler(String(j.fehler ?? 'Nicht gespeichert.'));
    await laden();
  };
  return (
    <Karte i={0}>
      <Ueberschrift rechts={<span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{d.aktiv ? `öffentlich unter ${d.pfad}` : 'aus'}</span>}>Kontaktformular der Website</Ueberschrift>
      <div style={{ display: 'grid', gap: 8 }}>
        <Schalter an={d.aktiv} aus={!d.istInhaber} onChange={an => void schalten(an)} erklaerung="kontaktformular.oeffentlich">Formular öffentlich</Schalter>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Nachrichten kommen hier als Anfrage „über Website“ an, mit Follow-up „Anfrage beantworten“. Keine Werbe-Einwilligung, keine Mail — geantwortet wird von Hand.</span>
        {!d.istInhaber && <Hinweis art="info">Einschalten dürfen Inhaber und volle Mitglieder des Haushalts — du siehst den Stand.</Hinweis>}
        {d.gruende.length > 0 && <Hinweis art="achtung" titel="Verantwortlicher fehlt">{d.gruende.join(' ')} <Link href={WEG.datenschutz('verantwortlicher')} style={{ color: C.aktiv }}>Jetzt eintragen</Link></Hinweis>}
        {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      </div>
    </Karte>
  );
}
