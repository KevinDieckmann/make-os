'use client';

// ─── MAKE OS — Zusammenarbeit & programmierfreie Zonen ──────────────────────
// Kevins Ansage: „Wir müssen aufpassen, dass wenn ich gleichzeitig im Programm
// rumprogrammiere, wir nicht was kaputtmachen — programmierfreie Zonen."
//
// Zwei Dinge stehen hier: die Abmachung (drei Zonen) und der Schalter, der sie
// sichtbar macht. Steht Bauzeit an, zeigt die Software auf jeder Seite einen
// Hinweis — Malin muss nicht raten, ob gerade gebaut wird.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { ZONEN } from '@/lib/make-one/onboarding-data';
import { Seitenkopf } from './Seitenkopf';

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const ZONENFARBE: Record<string, string> = { gruen: T.accent, gelb: T.amber, rot: T.crit };

interface Bauzeit { aktiv: boolean; woran: string; seit: string | null; von: string }

export function ZusammenarbeitView() {
  const [b, setB] = useState<Bauzeit | null>(null);
  const [woran, setWoran] = useState('');

  useEffect(() => {
    fetch('/api/state/bauzeit').then(r => r.json()).then((d: Bauzeit) => { setB(d); setWoran(d.woran ?? ''); }).catch(() => {});
  }, []);

  const setzen = (aktiv: boolean, text: string) => {
    const neu: Bauzeit = { aktiv, woran: text, seit: aktiv ? (b?.seit ?? new Date().toISOString()) : null, von: 'Kevin' };
    setB(neu);
    fetch('/api/state/bauzeit', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(neu), keepalive: true,
    }).then(r => r.json()).then(d => { if (d.ok) setB({ aktiv: d.aktiv, woran: d.woran, seit: d.seit, von: d.von }); }).catch(() => {});
  };

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 60px' }}>
        <Link href="/os/onboarding" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Onboarding</Link>
        <Seitenkopf
          rubrik={<>Onboarding</>}
          titel={<>Zusammenarbeit</>}
          satz={<>Kevin baut weiter an der Software, während Malin damit arbeitet. Damit dabei nichts verloren geht, gibt es drei Zonen und einen Schalter.</>}
        />

        {/* Der Schalter */}
        <div style={{ ...panel, borderLeft: `3px solid ${b?.aktiv ? T.amber : T.line}`, padding: '17px 19px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ ...lbl, color: b?.aktiv ? T.amber : T.muted }}>Bauzeit</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: b?.aktiv ? T.amber : T.ink, marginTop: 3 }}>
                {b?.aktiv ? 'Kevin baut gerade' : 'Kein Umbau — alles sicher'}
              </div>
              <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, lineHeight: 1.55 }}>
                {b?.aktiv
                  ? <>Seit {b.seit ? `${b.seit.slice(11, 16)} Uhr` : 'gerade eben'}{b.woran ? ` · ${b.woran}` : ''}. Der Hinweis steht jetzt auf jeder Seite.</>
                  : 'Einschalten, bevor du am Code arbeitest. Malin sieht den Hinweis dann überall.'}
              </div>
            </div>
            <button
              onClick={() => setzen(!b?.aktiv, woran)}
              style={{
                flex: '0 0 auto', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 10, padding: '10px 16px',
                border: `1px solid ${b?.aktiv ? T.line : T.amber}`,
                background: b?.aktiv ? 'transparent' : T.amber,
                color: b?.aktiv ? T.inkDim : T.void,
              }}>
              {b?.aktiv ? 'Bauzeit beenden' : 'Bauzeit starten'}
            </button>
          </div>
          <input
            value={woran}
            onChange={e => setWoran(e.target.value)}
            onBlur={() => { if (b?.aktiv && woran !== b.woran) setzen(true, woran); }}
            placeholder="Woran baust du gerade? z. B. Finanzen-Import umbauen"
            aria-label="Woran gerade gebaut wird"
            style={{
              width: '100%', marginTop: 13, background: T.void, border: `1px solid ${T.line}`, borderRadius: 9,
              padding: '9px 12px', color: T.ink, fontSize: 13, fontFamily: T.sans, outline: 'none',
            }} />
        </div>

        {/* Die drei Zonen */}
        <div style={{ ...lbl, marginBottom: 8 }}>Die drei Zonen</div>
        {ZONEN.map(z => (
          <div key={z.farbe} style={{ ...panel, borderLeft: `3px solid ${ZONENFARBE[z.farbe]}`, padding: '15px 18px', marginBottom: 10 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: ZONENFARBE[z.farbe] }}>{z.titel}</div>
            <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6, margin: '5px 0 9px' }}>{z.satz}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {z.beispiele.map(b2 => (
                <span key={b2} style={{ fontFamily: T.mono, fontSize: 11, color: T.inkDim, border: `1px solid ${T.line}`, borderRadius: 6, padding: '3px 8px' }}>{b2}</span>
              ))}
            </div>
          </div>
        ))}

        {/* Wer führt die Daten */}
        <div style={{ ...panel, padding: '16px 19px', marginTop: 18 }}>
          <div style={{ ...lbl, marginBottom: 8 }}>Wer führt die Daten</div>
          <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.7 }}>
            Das ist die Regel, an der es sonst scheitert: <strong>zwei Rechner dürfen nicht gleichzeitig in dieselbe Datei schreiben.</strong> Der
            iCloud-Ordner löst Schreibkonflikte nicht auf — er behält eine Fassung und benennt die andere um. Deshalb:
          </div>
          <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
            <li style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.7 }}><strong>Code und Dokumente</strong> liegen im iCloud-Ordner — den darf jeder lesen.</li>
            <li style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.7 }}><strong>Die Daten (.data)</strong> liegen genau einmal: auf dem Rechner, der gerade die Instanz betreibt.</li>
            <li style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.7 }}><strong>Solange Kevins Rechner läuft</strong>, arbeitet Malin über das Netzwerk auf derselben Instanz — dann gibt es nur eine Wahrheit.</li>
            <li style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.7 }}><strong>Eigene Kopie</strong> nur zum Ansehen. Was Malin dort einträgt, bleibt dort und ist nach dem nächsten Abgleich weg.</li>
            <li style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.7 }}><strong>Dauerhaft</strong> gehört das auf den Hetzner-Server: eine Instanz, zwei Zugänge, kein Rechner muss laufen.</li>
          </ul>
        </div>

        {/* Wer hat was geändert */}
        <Aenderungen />

        {/* Wenn doch etwas kaputtgeht */}
        <div style={{ ...panel, padding: '16px 19px', marginTop: 12 }}>
          <div style={{ ...lbl, marginBottom: 8 }}>Wenn doch etwas kaputtgeht</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.7 }}>Jede Datei wird täglich gesichert, 14 Stände bleiben liegen — in <span style={{ fontFamily: T.mono, fontSize: 12 }}>.data/backup</span>.</li>
            <li style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.7 }}>Beim Schreiben schützt eine Sperre: Wer plötzlich viel weniger Daten schickt als gespeichert sind, wird abgelehnt.</li>
            <li style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.7 }}>Sieht eine Seite kaputt aus: Bildschirmfoto an Kevin. Nicht selbst reparieren.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Wer hat was geändert ───────────────────────────────────────────────────
// Zwei Leute, eine Instanz: wenn morgen eine Zahl anders aussieht, soll man
// nicht raten müssen. Bewusst nur wer/was/wann — keine Inhalte.

const BESTAND_NAME: Record<string, string> = {
  tasks: 'Aufgaben', finanzplan: 'Finanzplan', buchungen: 'Buchungen', grundlage: 'Finanz-Grundlage',
  rechnungen: 'Rechnungen', kompass: 'Kompass', inbox: 'Inbox', loops: 'Loops', bauplan: 'Bauplan',
  meetings: 'Meetings', startflaeche: 'Startfläche', labels: 'Bezeichnungen', gesundheit: 'Gesundheit',
  bauzeit: 'Bauzeit', 'kalender-einstellungen': 'Kalender-Einstellungen', 'jarvis-verlauf': 'Jarvis-Verlauf',
};

interface Aenderung { at: string; person: string; bestand: string; seite?: string; art: string }

function Aenderungen() {
  const [liste, setListe] = useState<Aenderung[] | null>(null);
  const [alle, setAlle] = useState(false);

  useEffect(() => {
    fetch('/api/state/aenderungen', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setListe(Array.isArray(d.eintraege) ? d.eintraege : []))
      .catch(() => setListe([]));
  }, []);

  const wann = (iso: string) => {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'gerade eben';
    if (min < 60) return `vor ${min} Min.`;
    if (min < 60 * 20) return `vor ${Math.round(min / 60)} Std.`;
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }) + ', '
      + new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const zeigen = liste ? (alle ? liste.slice(0, 60) : liste.slice(0, 8)) : [];

  return (
    <div style={{ ...panel, padding: '16px 19px', marginTop: 12 }}>
      <div style={{ ...lbl, marginBottom: 8 }}>Wer hat was geändert</div>
      {liste === null && <div style={{ fontSize: 12.5, color: T.muted }}>lädt …</div>}
      {liste?.length === 0 && (
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          Noch nichts mitgeschrieben. Ab jetzt hält die Software fest, wer welchen Bestand ändert — damit ihr bei einer
          Abweichung nicht raten müsst.
        </div>
      )}
      {zeigen.map((e, i) => (
        <div key={e.at + i} style={{
          display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0',
          borderTop: i === 0 ? 'none' : `1px solid ${T.line}`,
        }}>
          <span style={{
            fontFamily: T.mono, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
            color: e.person === 'Malin' ? T.amber : T.accent, flex: '0 0 46px',
          }}>{e.person}</span>
          <span style={{ fontSize: 13, color: T.ink, flex: 1, minWidth: 0 }}>
            {BESTAND_NAME[e.bestand] ?? e.bestand}
            {e.art === 'DELETE' && <span style={{ color: T.crit, fontSize: 11.5 }}> · gelöscht</span>}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, flex: '0 0 auto' }}>{wann(e.at)}</span>
        </div>
      ))}
      {liste && liste.length > 8 && (
        <button onClick={() => setAlle(!alle)} style={{
          marginTop: 9, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8,
          padding: '6px 11px', color: T.inkDim, fontSize: 12, fontFamily: T.sans, cursor: 'pointer',
        }}>{alle ? 'Weniger zeigen' : `Alle ${liste.length} zeigen`}</button>
      )}
    </div>
  );
}
