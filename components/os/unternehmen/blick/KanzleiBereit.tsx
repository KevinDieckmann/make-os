'use client';

// ─── Unternehmen › „Bereit für Kanzlei und Steuerbüro“ (11.10.) ─────────────────────────────────────────────────────────────────────
// Je Gesellschaft: was für Jahresabschluss und Steuer des letzten Geschäftsjahres vorliegt — Haken-Liste mit Weg, Status in einem Wort. Aus den offenen
// Punkten wird auf Klick die Anwalts-Mappe (vorhandener Weg POST /api/gesellschaften/recht { aktion: 'mappe' } — PDF verschlüsselt in der Ablage der
// Gesellschaft; weitergegeben wird nur, was ihr herunterladet). Gerechnet in lib/gesellschaften/schild/kanzlei.ts.

import Link from 'next/link';
import { useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT, RAND, TIEF } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis } from '../../ui';
import { kanzleiBereit, KANZLEI_TEXT } from '@/lib/gesellschaften/schild/kanzlei';
import type { GesellschaftLage } from '@/lib/gesellschaften/schild/ampel';
import type { RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import { MAPPE_HINWEIS } from '@/lib/recht/typen';
import { dateiLink } from '../schild/daten';
import { WasSeheIch, klein } from './teile';

export function KanzleiBereitKarte({ lage, reg, heute }: { lage: GesellschaftLage; reg?: RegisterGesellschaft; heute: string }) {
  const k = kanzleiBereit(lage, reg, heute);
  const [mappe, setMappe] = useState<{ id: string; name: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const farbe = k.status === 'bereit' ? LEUCHT.gut : k.status === 'fast' ? C.aktiv : C.inkDim;
  const erstellen = async () => {
    setFehler(null); setMappe(null);
    const r = await fetch('/api/gesellschaften/recht?space=business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'mappe', thema: { art: 'gesellschaft', gesellschaftId: lage.id }, fragen: k.fragen.slice(0, 20) }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — keine Mappe erstellt.' }));
    if (r.ok) setMappe(r.datei); else setFehler(r.fehler ?? 'Keine Mappe erstellt.');
  };
  return (
    <Karte>
      <Ueberschrift erklaerung="unternehmen.kanzlei" rechts={<span className="ui-chip" style={{ background: `${farbe}22`, color: farbe === C.inkDim ? C.ink : farbe }}>{KANZLEI_TEXT[k.status]}</span>}>Bereit für Kanzlei und Steuerbüro</Ueberschrift>
      <span style={klein}>{k.gj ? `Für das ${k.gj.replace('GJ', 'Geschäftsjahr')}` : 'Noch kein abgeschlossenes Geschäftsjahr'} — {k.da} von {k.gesamt} liegen vor.</span>
      <span aria-hidden style={{ display: 'block', height: 8, borderRadius: 4, background: 'rgba(255,255,255,.07)', overflow: 'hidden', margin: '8px 0' }}>
        <span style={{ display: 'block', height: '100%', width: `${k.gesamt ? Math.max(4, (k.da / k.gesamt) * 100) : 0}%`, background: TIEF.verlauf(farbe === C.inkDim ? C.aktiv : farbe), borderRadius: 4 }} />
      </span>
      <div style={{ display: 'grid' }}>
        {k.punkte.map(p => (
          <Link key={p.id} href={p.weg} className="fassbar" style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, padding: '4px 2px', borderTop: `1px solid ${RAND.haar}`, color: C.ink, textDecoration: 'none' }}>
            <span aria-label={p.da ? 'liegt vor' : 'fehlt noch'} style={{ width: 22, height: 22, borderRadius: 11, flex: '0 0 auto', display: 'grid', placeItems: 'center', color: p.da ? LEUCHT.gut : C.inkLeise, background: p.da ? TIEF.flaeche(LEUCHT.gut) : 'transparent' }}>{p.da ? <Check size={14} /> : <Circle size={14} />}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'grid' }}>
              <span style={{ fontSize: TYP.bedien, color: p.da ? C.inkDim : C.ink, overflowWrap: 'anywhere' }}>{p.text}</span>
              {!p.da && p.hinweis && <span style={{ ...klein, overflowWrap: 'anywhere' }}>{p.hinweis}</span>}
            </span>
            <span aria-hidden style={{ color: C.inkLeise }}>›</span>
          </Link>
        ))}
      </div>
      {fehler && <Hinweis art="achtung">{fehler}</Hinweis>}
      {mappe && <Hinweis art="gut" titel="Mappe erstellt">„{mappe.name}“ liegt in der Ablage der Gesellschaft. <a href={dateiLink(mappe.id)} style={{ color: 'inherit' }}>Herunterladen</a></Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <Knopf leise onClick={erstellen}>Mappe für die Kanzlei erstellen</Knopf>
      </div>
      <WasSeheIch>Was Kanzlei und Steuerbüro für den Abschluss des letzten Geschäftsjahres brauchen — ein Haken heißt: liegt in MAKE OS vor. Die Mappe nimmt die offenen Punkte als Fragen mit.</WasSeheIch>
      <div style={{ ...klein, marginTop: 4 }}>{MAPPE_HINWEIS}</div>
    </Karte>
  );
}
