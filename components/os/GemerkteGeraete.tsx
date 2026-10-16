'use client';

// ─── MAKE OS — Gemerkte Geräte (16.10.) ─────────────────────────────────────
// Kevin 16.10.: Code nur noch einmal je Gerät, 90 Tage. Hier sieht die Person, auf welchen Geräten das Passwort ohne Code genügt,
// und kann eines oder alle vergessen. Die Regeln stehen auf dem Server (lib/zugang/geraete.ts, Route /api/konto/geraete) —
// die Liste kommt ohne Hash und ohne Token. Am Handy: Tippziele ≥ 44 px (Knopf), Text ≥ 13 px.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Zeile, Knopf, Hinweis, LEUCHT, useRueckfrage } from './ui';

interface Geraet { id: string; beschreibung: string; angelegt: string; zuletzt: string; bis: string; dieses?: boolean }

const tag = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
};

export function GemerkteGeraete() {
  const { bestaetigen, dialog } = useRueckfrage();
  const [liste, setListe] = useState<Geraet[] | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);

  const laden = () => fetch('/api/konto/geraete').then(r => r.json()).then(d => setListe(Array.isArray(d.geraete) ? d.geraete : [])).catch(() => setListe([]));
  useEffect(() => { void laden(); }, []);

  async function senden(body: { aktion: 'vergessen'; id: string } | { aktion: 'alle' }, ok: string) {
    setMeldung(null);
    const r = await fetch('/api/konto/geraete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(x => x.json()).catch(() => ({ error: 'Der Server ist nicht erreichbar.' }));
    if (r.error) { setMeldung({ text: r.error, gut: false }); return; }
    setListe(Array.isArray(r.geraete) ? r.geraete : []);
    setMeldung({ text: ok, gut: true });
  }
  async function alle() {
    if (!(await bestaetigen({ titel: 'Alle Geräte abmelden?', text: 'Jedes gemerkte Gerät fragt beim nächsten Anmelden wieder nach dem Code. Angemeldete Sitzungen laufen weiter.', ja: 'Alle abmelden', gefahr: true }))) return;
    await senden({ aktion: 'alle' }, 'Alle Geräte vergessen — beim nächsten Anmelden kommt wieder der Code.');
  }

  if (liste === null) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <Ueberschrift farbe={LEUCHT.gut} erklaerung="konto.geraete" rechts={<span>{liste.length}</span>}>Gemerkte Geräte</Ueberschrift>
      {liste.length === 0 && (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>Noch kein Gerät gemerkt. Beim nächsten Anmelden mit Code „Dieses Gerät 90 Tage merken“ angehakt lassen — dann genügt dort das Passwort.</div>
      )}
      {liste.map(g => (
        <Zeile
          key={g.id}
          titel={g.beschreibung}
          unter={`${g.dieses ? 'Dieses Gerät · ' : ''}zuletzt benutzt ${tag(g.zuletzt)} · läuft ab ${tag(g.bis)}`}
          rechts={<Knopf leise onClick={async () => { await senden({ aktion: 'vergessen', id: g.id }, 'Gerät vergessen — dort kommt beim nächsten Anmelden wieder der Code.'); }}>Gerät vergessen</Knopf>}
        />
      ))}
      {liste.length > 0 && <div style={{ marginTop: 10 }}><Knopf leise onClick={alle}>Alle Geräte abmelden</Knopf></div>}
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.gut ? 'gut' : 'kritisch'}>{meldung.text}</Hinweis></div>}
      {dialog}
    </div>
  );
}
