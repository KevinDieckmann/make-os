'use client';

// ─── Unternehmen › Gründungsfahrplan (04.10., Paket 4) ──────────────────────────────────────────────────────────
// Ein Klick „Fahrplan anlegen“ → Jahresziel (Business, Einheit = diese Gesellschaft) + neun Meilensteine mit Kette + Aufgaben
// — Vorlage rein in lib/gesellschaften/fahrplan.ts. Geschrieben wird nur über die bestehenden Wege (Ziele-PATCH,
// Meilensteine-PATCH, /api/tasks/create mit meilensteinId); feste Kennungen → ein zweiter Klick ergänzt nur, was fehlt.
// Gibt es das Ziel schon, führt der Knopf hin. Die Einzahlung des Stammkapitals ist nur ein Weg in den Finanzplan.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Route } from 'lucide-react';
import { Karte, Ueberschrift, Knopf, Hinweis, Leer } from '../ui';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { einheitAusGesellschaft } from '@/lib/einheiten';
import { fahrplanFuer, fahrplanZielId, FAHRPLAN_SCHRITTE } from '@/lib/gesellschaften/fahrplan';
import { klein, type GAnzeige, type RegisterDaten } from './teile';

const json = (r: Response) => r.json().catch(() => ({ ok: false, error: `Antwort ${r.status}.` }));

export function FahrplanKarte({ g, daten }: { g: GAnzeige; daten: RegisterDaten }) {
  const zielId = fahrplanZielId(g.id);
  const [da, setDa] = useState<boolean | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const pruefen = useCallback(async () => {
    const d = await fetch('/api/state/ziele', { cache: 'no-store' }).then(json).catch(() => null);
    setDa(Array.isArray(d?.jahr) ? d.jahr.some((z: { id: string }) => z.id === zielId) : false);
  }, [zielId]);
  useEffect(() => { void pruefen(); }, [pruefen]);
  const vorgaenger = g.vorgaengerId ? daten.gesellschaften.find(x => x.id === g.vorgaengerId)?.name : undefined;

  const anlegen = async () => {
    setFehler(null);
    const f = fahrplanFuer(g.id, { name: g.name, vorgaenger, art: vorgaenger ? 'umfirmierung' : 'gruendung' }, einheitAusGesellschaft(g.id) ?? g.name, localDay());
    try {
      setLaeuft('Ziel …');
      const ziele = await fetch('/api/state/ziele', { cache: 'no-store' }).then(json);
      if (!(ziele.jahr ?? []).some((z: { id: string }) => z.id === f.ziel.id)) {
        const r = await fetch('/api/state/ziele', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horizont: 'jahr', ops: [{ op: 'upsert', eintrag: f.ziel }] }) }).then(json);
        if (r.ok === false) throw new Error(r.error ?? 'Ziel nicht angelegt.');
      }
      setLaeuft('Meilensteine …');
      const ms = await fetch('/api/state/meilensteine', { cache: 'no-store' }).then(json);
      const vorhanden = new Set(((ms.meilensteine ?? []) as { id: string }[]).map(m => m.id));
      const neu = f.meilensteine.filter(m => !vorhanden.has(m.id));
      if (neu.length) {
        const r = await fetch('/api/state/meilensteine', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: neu.map(m => ({ op: 'upsert', eintrag: m })) }) }).then(json);
        if (r.ok === false) throw new Error(r.error ?? 'Meilensteine nicht angelegt.');
      }
      // Aufgaben nacheinander — gleicher Titel in derselben Meilenstein-Liste wird erkannt (kein Doppel bei einem zweiten Klick).
      let n = 0;
      for (const a of f.aufgaben) {
        setLaeuft(`Aufgaben ${++n}/${f.aufgaben.length} …`);
        const r = await fetch('/api/tasks/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: a.titel, meilensteinId: a.meilensteinId }) }).then(json);
        if (r.ok === false || r.error) throw new Error(r.error ?? 'Aufgabe nicht angelegt.');
      }
      setDa(true);
    } catch (e) {
      setFehler(`${e instanceof Error ? e.message : 'Nicht angelegt.'} Was schon steht, bleibt — ein zweiter Klick ergänzt nur, was fehlt.`);
    } finally { setLaeuft(null); }
  };

  return (
    <Karte>
      <Ueberschrift>Gründungsfahrplan</Ueberschrift>
      {da === null ? <Leer>lädt …</Leer> : da ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={klein}>Der Fahrplan steht in der Planung: Ziel mit {FAHRPLAN_SCHRITTE.length} Meilensteinen und Aufgaben — Termine und Reihenfolge dort anpassen.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf href={WEG.ziel(zielId)}>Fahrplan öffnen ›</Knopf>
            <Knopf leise onClick={anlegen} aus={!!laeuft}>Fehlendes ergänzen</Knopf>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={klein}>Vorlage „{vorgaenger ? 'Umfirmierung' : 'GmbH-Gründung'}“: ein Ziel für {g.name} mit {FAHRPLAN_SCHRITTE.length} Meilensteinen in fester Reihenfolge — Vertrag, Notar, Konto und Stammkapital, Handelsregister{vorgaenger ? ` (aus ${vorgaenger})` : ''}, Transparenzregister, Finanzamt, IHK, Buchhaltung, Website — samt Aufgaben. Termine sind Vorschläge ab heute.</div>
          <div><Knopf onClick={anlegen} aus={!!laeuft}><Route size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />Fahrplan anlegen</Knopf></div>
        </div>
      )}
      {laeuft && <div role="status" style={{ ...klein, marginTop: 8 }}>legt an: {laeuft}</div>}
      {fehler && <div style={{ marginTop: 8 }}><Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis></div>}
      <div style={{ ...klein, marginTop: 10 }}>Stammkapital-Einzahlung: im Finanzplan als Zahlung vormerken — <Link href={WEG.liquiditaet()} style={{ color: 'inherit' }}>Liquidität öffnen ›</Link></div>
    </Karte>
  );
}

/**
 * Der Weg zurück (Ziel-Detail eines Fahrplans → Gesellschaft im Register). Die Gesellschaft wird über die feste Kennung des
 * Fahrplan-Ziels gefunden; ohne Zugang zum Register (anderes Konto, 403) erscheint nichts.
 */
export function FahrplanHerkunft({ zielId }: { zielId: string }) {
  const [g, setG] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    let lebt = true;
    fetch('/api/gesellschaften?wahl=1', { cache: 'no-store' }).then(json).then(d => {
      const treffer = ((d?.gesellschaften ?? []) as { id: string; name: string }[]).find(x => fahrplanZielId(x.id) === zielId);
      if (lebt) setG(treffer ?? null);
    }).catch(() => undefined);
    return () => { lebt = false; };
  }, [zielId]);
  if (!g) return null;
  return <Link href={WEG.unternehmen(g.id)} style={{ color: 'inherit' }}>Gründungsfahrplan von {g.name} ›</Link>;
}
