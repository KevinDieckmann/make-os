'use client';

// ─── MAKE OS — Zusammenarbeit & programmierfreie Zonen ──────────────────────
// Kevins Ansage: „Wir müssen aufpassen, dass wenn ich gleichzeitig im Programm
// rumprogrammiere, wir nicht was kaputtmachen — programmierfreie Zonen."
//
// Zwei Dinge stehen hier: die Abmachung (drei Zonen) und der Schalter „Update läuft“.
// 08.10. (Server-Stand): gebaut wird lokal auf „entwicklung“, online ist „main“ — die
// Instanz merkt vom Bauen nichts; heikel ist nur das Ausrollen eines Updates.
// 24.09.: auf das lebendige Muster umgezogen.

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { ZONEN } from '@/lib/make-one/onboarding-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, feld, LEUCHT } from './ui';

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
    <Seite titel="Zusammenarbeit" unter="Am Code wird weitergebaut, während alle mit der Instanz arbeiten. Gebaut wird lokal, online geht ein Update nur auf das Wort des Inhabers — drei Zonen und ein Schalter halten das auseinander."
      rechts={<Link href="/os/onboarding" className="fassbar" style={linkKnopf}>Onboarding ›</Link>}>

      {/* Der Schalter */}
      <Karte i={0} ton={aktiv ? LEUCHT.achtung : undefined}>
        <Ueberschrift farbe={aktiv ? LEUCHT.achtung : C.inkLeise}
          rechts={aktiv
            ? <Knopf leise onClick={() => setzen(false, woran)}>Update fertig</Knopf>
            : <Knopf farbe={LEUCHT.achtung} onClick={() => setzen(true, woran)}>Update läuft</Knopf>}>
          Update
        </Ueberschrift>
        <div style={{ fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.01em', color: aktiv ? LEUCHT.achtung : C.ink }}>
          {aktiv ? 'Update läuft' : 'Kein Update — alles sicher'}
        </div>
        <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: '4px 0 0' }}>
          {aktiv
            ? <>Seit {b?.seit ? `${b.seit.slice(11, 16)} Uhr` : 'gerade eben'}{b?.woran ? ` · ${b.woran}` : ''}. Bitte bis „fertig“ nichts in großen Mengen schreiben.</>
            : 'Einschalten, bevor ein Update ausgerollt wird (dauert etwa fünf Minuten). Lokales Bauen braucht den Schalter nicht — davon merkt die Instanz nichts.'}
        </p>
        <input
          value={woran}
          onChange={e => setWoran(e.target.value)}
          onBlur={() => { if (b?.aktiv && woran !== b.woran) setzen(true, woran); }}
          placeholder="Was kommt mit dem Update? z. B. Whoop je Person"
          aria-label="Was mit dem Update kommt"
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

      {/* Wo die Daten liegen */}
      <Karte i={4}>
        <Ueberschrift farbe={LEUCHT.geld}>Wo die Daten liegen</Ueberschrift>
        <p style={absatz}>
          <strong style={{ color: C.ink, fontWeight: 600 }}>Eine Instanz, eine Wahrheit:</strong> MAKE OS läuft auf einem eigenen Server in Deutschland, alle arbeiten auf demselben Stand —
          vom Laptop wie vom Handy, ohne dass ein Rechner laufen muss.
        </p>
        <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
          <li style={punkt}><strong style={{ color: C.ink, fontWeight: 600 }}>Die Daten</strong> liegen nur auf dem Server, verschlüsselt — keine Kopie in einem Cloud-Ordner, keine auf einem Rechner.</li>
          <li style={punkt}><strong style={{ color: C.ink, fontWeight: 600 }}>Der Code</strong> wird lokal auf dem Stand „entwicklung“ gebaut. Online ist der Stand „main“ — ein Update geht nur auf ausdrückliches Wort des Inhabers raus.</li>
          <li style={punkt}><strong style={{ color: C.ink, fontWeight: 600 }}>Gleichzeitig arbeiten</strong> ist sicher: Änderungen gehen einzeln mit Stand an den Server. Hat jemand anderes dieselbe Zeile inzwischen geändert, bleibt deine Fassung sichtbar stehen statt still überschrieben zu werden.</li>
          <li style={punkt}><strong style={{ color: C.ink, fontWeight: 600 }}>Privates</strong> trennt der Server: was nur dir gehört (private Notizen, „nur ich“-Aufgaben, private Termine, Gesundheit ohne Teilen), kommt bei den anderen gar nicht erst an.</li>
        </ul>
      </Karte>

      {/* Wer hat was geändert */}
      <Aenderungen />

      {/* Wenn doch etwas kaputtgeht */}
      <Karte i={6}>
        <Ueberschrift farbe={LEUCHT.kritisch}>Wenn doch etwas kaputtgeht</Ueberschrift>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={punkt}>Jede Nacht sichert der Server alles verschlüsselt; dazu kommen tägliche Abbilder beim Anbieter und — sobald eingerichtet — eine zweite Kopie außerhalb des Servers. Den Stand zeigt der <Link href="/os/hoi" style={{ color: C.ink, textDecoration: 'none', fontWeight: 600 }}>Head of IT</Link>.</li>
          <li style={punkt}>Gelöschte Aufgaben und Projekte liegen 30 Tage im Papierkorb und lassen sich wiederherstellen.</li>
          <li style={punkt}>Sieht eine Seite kaputt aus: unten links „Problem oder Idee melden“, mit Bildschirmfoto. Nicht selbst reparieren.</li>
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
  bauzeit: 'Bauzeit', 'kalender-einstellungen': 'Kalender-Einstellungen', 'zoe-verlauf': 'ZOE-Verlauf',
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
            titel={<>{BESTAND_NAME[e.bestand] ?? e.bestand}{e.art === 'DELETE' && <span style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien, fontWeight: 400 }}> · gelöscht</span>}</>}
            rechts={<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap' }}><Punkt farbe={C.inkLeise} groesse={6} />{wann(e.at)}</span>} />
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
