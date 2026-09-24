'use client';

// ─── MAKE OS — Zusammenarbeit & programmierfreie Zonen ──────────────────────
// Kevins Ansage: „Wir müssen aufpassen, dass wenn ich gleichzeitig im Programm
// rumprogrammiere, wir nicht was kaputtmachen — programmierfreie Zonen."
//
// Zwei Dinge stehen hier: die Abmachung (drei Zonen) und der Schalter, der sie
// sichtbar macht. Steht Bauzeit an, zeigt die Software auf jeder Seite einen
// Hinweis — Malin muss nicht raten, ob gerade gebaut wird.
// 24.09.: auf das lebendige Muster umgezogen.

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { ZONEN } from '@/lib/make-one/onboarding-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, feld, LEUCHT } from './schlank';

const ZONENFARBE: Record<string, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch };
const PERSONFARBE: Record<string, string> = { Malin: LEUCHT.beziehung, Kevin: LEUCHT.puls };
const linkKnopf: CSSProperties = {
  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, whiteSpace: 'nowrap',
  background: 'rgba(255,255,255,.06)', color: C.ink, textDecoration: 'none',
};
const absatz: CSSProperties = { fontSize: TYP.body, color: C.inkDim, lineHeight: 1.7, margin: 0 };
const punkt: CSSProperties = { fontSize: TYP.body, color: C.inkDim, lineHeight: 1.7 };

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

  const aktiv = !!b?.aktiv;

  return (
    <Seite titel="Zusammenarbeit" unter="Kevin baut weiter an der Software, während Malin damit arbeitet. Damit dabei nichts verloren geht, gibt es drei Zonen und einen Schalter."
      rechts={<Link href="/os/onboarding" className="fassbar" style={linkKnopf}>Onboarding ›</Link>}>

      {/* Der Schalter */}
      <Karte i={0} akzent={aktiv ? LEUCHT.achtung : undefined}>
        <Ueberschrift farbe={aktiv ? LEUCHT.achtung : C.inkLeise}
          rechts={aktiv
            ? <Knopf leise onClick={() => setzen(false, woran)}>Bauzeit beenden</Knopf>
            : <Knopf farbe={LEUCHT.achtung} onClick={() => setzen(true, woran)}>Bauzeit starten</Knopf>}>
          Bauzeit
        </Ueberschrift>
        <div style={{ fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.01em', color: aktiv ? LEUCHT.achtung : C.ink }}>
          {aktiv ? 'Kevin baut gerade' : 'Kein Umbau — alles sicher'}
        </div>
        <p style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.55, margin: '4px 0 0' }}>
          {aktiv
            ? <>Seit {b?.seit ? `${b.seit.slice(11, 16)} Uhr` : 'gerade eben'}{b?.woran ? ` · ${b.woran}` : ''}. Der Hinweis steht jetzt auf jeder Seite.</>
            : 'Einschalten, bevor du am Code arbeitest. Malin sieht den Hinweis dann überall.'}
        </p>
        <input
          value={woran}
          onChange={e => setWoran(e.target.value)}
          onBlur={() => { if (b?.aktiv && woran !== b.woran) setzen(true, woran); }}
          placeholder="Woran baust du gerade? z. B. Finanzen-Import umbauen"
          aria-label="Woran gerade gebaut wird"
          style={{ ...feld, marginTop: 14 }} />
      </Karte>

      {/* Die drei Zonen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {ZONEN.map((z, i) => (
          <Karte key={z.farbe} i={1 + i}>
            <Ueberschrift farbe={ZONENFARBE[z.farbe]}>{z.titel}</Ueberschrift>
            <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, margin: '0 0 10px' }}>{z.satz}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {z.beispiele.map(b2 => <Chip key={b2} farbe={C.inkDim}>{b2}</Chip>)}
            </div>
          </Karte>
        ))}
      </div>

      {/* Wer führt die Daten */}
      <Karte i={4}>
        <Ueberschrift farbe={LEUCHT.geld}>Wer führt die Daten</Ueberschrift>
        <p style={absatz}>
          Das ist die Regel, an der es sonst scheitert: <strong style={{ color: C.ink, fontWeight: 600 }}>zwei Rechner dürfen nicht gleichzeitig in dieselbe Datei schreiben.</strong> Der
          iCloud-Ordner löst Schreibkonflikte nicht auf — er behält eine Fassung und benennt die andere um. Deshalb:
        </p>
        <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
          <li style={punkt}><strong style={{ color: C.ink, fontWeight: 600 }}>Code und Dokumente</strong> liegen im iCloud-Ordner — den darf jeder lesen.</li>
          <li style={punkt}><strong style={{ color: C.ink, fontWeight: 600 }}>Die Daten (.data)</strong> liegen genau einmal: auf dem Rechner, der gerade die Instanz betreibt.</li>
          <li style={punkt}><strong style={{ color: C.ink, fontWeight: 600 }}>Solange Kevins Rechner läuft</strong>, arbeitet Malin über das Netzwerk auf derselben Instanz — dann gibt es nur eine Wahrheit.</li>
          <li style={punkt}><strong style={{ color: C.ink, fontWeight: 600 }}>Eigene Kopie</strong> nur zum Ansehen. Was Malin dort einträgt, bleibt dort und ist nach dem nächsten Abgleich weg.</li>
          <li style={punkt}><strong style={{ color: C.ink, fontWeight: 600 }}>Dauerhaft</strong> gehört das auf den Hetzner-Server: eine Instanz, zwei Zugänge, kein Rechner muss laufen.</li>
        </ul>
      </Karte>

      {/* Wer hat was geändert */}
      <Aenderungen />

      {/* Wenn doch etwas kaputtgeht */}
      <Karte i={6}>
        <Ueberschrift farbe={LEUCHT.kritisch}>Wenn doch etwas kaputtgeht</Ueberschrift>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={punkt}>Jede Datei wird täglich gesichert, 14 Stände bleiben liegen — in <span style={{ fontFamily: SCHRIFT.mono, fontSize: TYP.bedien }}>.data/backup</span>.</li>
          <li style={punkt}>Beim Schreiben schützt eine Sperre: Wer plötzlich viel weniger Daten schickt als gespeichert sind, wird abgelehnt.</li>
          <li style={punkt}>Sieht eine Seite kaputt aus: Bildschirmfoto an Kevin. Nicht selbst reparieren.</li>
        </ul>
      </Karte>
    </Seite>
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
    <Karte i={5}>
      <Ueberschrift farbe={LEUCHT.beziehung} rechts={liste?.length ? `${liste.length} Einträge` : undefined}>Wer hat was geändert</Ueberschrift>
      {liste === null && <Leer>lädt …</Leer>}
      {liste?.length === 0 && (
        <Leer>
          Noch nichts mitgeschrieben. Ab jetzt hält die Software fest, wer welchen Bestand ändert — damit ihr bei einer
          Abweichung nicht raten müsst.
        </Leer>
      )}
      <Liste>
        {zeigen.map((e, i) => (
          <Zeile key={e.at + i}
            links={<Chip farbe={PERSONFARBE[e.person] ?? C.inkDim}>{e.person}</Chip>}
            titel={<>{BESTAND_NAME[e.bestand] ?? e.bestand}{e.art === 'DELETE' && <span style={{ color: LEUCHT.kritisch, fontSize: 12, fontWeight: 400 }}> · gelöscht</span>}</>}
            rechts={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' }}><Punkt farbe={C.inkLeise} groesse={6} />{wann(e.at)}</span>} />
        ))}
      </Liste>
      {liste && liste.length > 8 && (
        <div style={{ marginTop: 12 }}>
          <Knopf leise onClick={() => setAlle(!alle)}>{alle ? 'Weniger zeigen' : `Alle ${liste.length} zeigen`}</Knopf>
        </div>
      )}
    </Karte>
  );
}
