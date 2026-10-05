'use client';

// ─── MAKE OS — „Demo zurücksetzen“ (System, nur in einer Demo-Instanz, 05.10.) ─────────────────────────────────────────
// Fragt GET /api/demo: in jeder Nicht-Demo-Instanz 404 → die Karte erscheint nicht (der Weg existiert serverseitig nicht).
// In der Demo sieht nur der Inhaber den Knopf; Rückfrage, dann POST — danach lädt die Seite neu (alle Daten sind frisch).

import { useEffect, useState } from 'react';
import { Karte, Ueberschrift, Knopf, Hinweis, useRueckfrage } from './ui';
import { FARBE as C, TYP } from '@/lib/make-one/design';

interface Lage { demo: true; inhaber: boolean; darf: boolean; gruende: string[]; angelegt: string | null }

export function DemoKarte({ i = 0 }: { i?: number }) {
  const [lage, setLage] = useState<Lage | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [gruende, setGruende] = useState<string[]>([]);
  const { bestaetigen, dialog } = useRueckfrage();
  useEffect(() => {
    let lebt = true;
    fetch('/api/demo', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => { if (lebt && d?.demo) setLage(d as Lage); }).catch(() => undefined);
    return () => { lebt = false; };
  }, []);
  if (!lage?.inhaber) return null;

  const zuruecksetzen = async () => {
    if (!(await bestaetigen({ titel: 'Demo zurücksetzen?', text: 'Alle Daten dieser Demo-Instanz gehen auf den Ausgangsstand zurück — Kontakte, Aufgaben, Planung, Finanzen, alles, was seit dem letzten Zurücksetzen geändert wurde.\n\nDie Anmeldung bleibt. Echte Daten gibt es hier nicht.', ja: 'Zurücksetzen', gefahr: true }))) return;
    setMeldung('Setzt zurück …'); setGruende([]);
    const r = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'zuruecksetzen', bestaetigt: true }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok === false) { setMeldung(d.fehler ?? 'Zurücksetzen fehlgeschlagen.'); setGruende(Array.isArray(d.gruende) ? d.gruende : []); return; }
    setMeldung('Zurückgesetzt — lädt neu …');
    window.location.reload();
  };

  return (
    <Karte i={i} id="demo">
      <Ueberschrift>Demo-Instanz</Ueberschrift>
      <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.55, marginBottom: 12 }}>
        Diese Instanz zeigt nur erfundene Beispieldaten. Alles ist bearbeitbar und löschbar — nach einer Vorführung stellt „Demo zurücksetzen“ den Ausgangsstand wieder her.
        {lage.angelegt ? ` Zuletzt gesät: ${new Date(lage.angelegt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}.` : ''}
      </div>
      {!lage.darf && lage.gruende.length > 0 && (
        <Hinweis art="kritisch" titel="Zurücksetzen gesperrt">{lage.gruende.map(g => <div key={g}>· {g}</div>)}</Hinweis>
      )}
      <Knopf onClick={zuruecksetzen} aus={!lage.darf} farbe={C.kritisch}>Demo zurücksetzen</Knopf>
      {meldung && <div role="status" style={{ marginTop: 10, fontSize: TYP.bedien, color: C.inkDim }}>{meldung}</div>}
      {gruende.length > 0 && <Hinweis art="kritisch">{gruende.map(g => <div key={g}>· {g}</div>)}</Hinweis>}
      {dialog}
    </Karte>
  );
}
