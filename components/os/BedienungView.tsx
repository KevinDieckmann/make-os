'use client';

// ─── Einstellungen › Bedienung (10.10., DESIGN_STANDARD.md › Zeilen-Aktionen) ─────────────────────────────────────────────────────
// Kevin 10.10.: „… rechts mit drei Punkten und Einstellungen. Denk drauf rum, was für Einstellungen zusätzlich Sinn machen.“ Je GERÄT
// (Merker im Browser, Regeln in lib/make-one/bedienung.ts): Wisch-Richtungen am Handy, Rückfrage vor dem Löschen, „⋯“ immer sichtbar,
// Dichte der Listen, kurzes Vibrieren. Unten eine Probezeile zum Ausprobieren — sie ändert nichts.

import { Seite, Karte, Ueberschrift, Beschriftung, Segmente, Schalter, Knopf, Hinweis, Liste, Zeile, ZeileAktionen, useRueckgaengig, useBedienung, bedienungAendern, kannVibrieren } from './ui';
import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { BEDIENUNG_VORGABE, DICHTEN, WISCH_WAHLEN, type WischWahl } from '@/lib/make-one/bedienung';

const text = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, margin: '8px 0 0' } as const;

export function BedienungView() {
  const b = useBedienung();
  const { melden, hinweis } = useRueckgaengig();
  const [vibriert, setVibriert] = useState<boolean | null>(null);
  const [gesperrt, setGesperrt] = useState(false);
  useEffect(() => { setVibriert(kannVibrieren()); }, []);
  const setze = (teil: Parameters<typeof bedienungAendern>[0]) => { setGesperrt(!bedienungAendern(teil)); };
  const vorgabe = (Object.keys(BEDIENUNG_VORGABE) as (keyof typeof BEDIENUNG_VORGABE)[]).every(k => b[k] === BEDIENUNG_VORGABE[k]);
  const [probe, setProbe] = useState<'offen' | 'archiv'>('offen');

  return (
    <Seite titel="Bedienung">
      <Hinweis art="info">Gilt für dieses Gerät und diesen Browser — am Handy und am Rechner lässt sich jeweils anders einstellen.</Hinweis>
      {gesperrt && <Hinweis art="achtung">Dieser Browser lässt das Merken nicht zu (privates Fenster?) — die Wahl gilt bis zum Neuladen.</Hinweis>}

      <Karte i={0}>
        <Ueberschrift erklaerung="bedienung.wischen">Wischen am Handy</Ueberschrift>
        <Beschriftung>Nach links wischen</Beschriftung>
        <Segmente<WischWahl> umbrechen liste={[...WISCH_WAHLEN]} aktiv={b.wischenLinks} onWahl={w => setze({ wischenLinks: w })} />
        <div style={{ height: 12 }} />
        <Beschriftung>Nach rechts wischen</Beschriftung>
        <Segmente<WischWahl> umbrechen liste={[...WISCH_WAHLEN]} aktiv={b.wischenRechts} onWahl={w => setze({ wischenRechts: w })} />
        <p style={text}>Ab etwa einem Drittel der Zeile löst das Wischen aus, darunter schnappt sie zurück. Senkrecht scrollen geht immer vor.
          „Aktionen zeigen“ öffnet das Menü „⋯“. Hat eine Liste die Aktion nicht (z. B. kein Archiv), gibt es dort in diese Richtung kein Wischen.</p>
      </Karte>

      <Karte i={1}>
        <Ueberschrift>Löschen</Ueberschrift>
        <Schalter karte erklaerung="bedienung.loeschen" an={b.loeschenNachfragen} onChange={v => setze({ loeschenNachfragen: v })}
          beschreibung="Aus: es wird gleich gelöscht (in den Papierkorb, wo es einen gibt) und unten steht 10 Sekunden „Rückgängig“. Listen, bei denen etwas daran hängt, fragen immer.">
          Vor dem Löschen nachfragen
        </Schalter>
      </Karte>

      <Karte i={2}>
        <Ueberschrift>Menü „⋯“</Ueberschrift>
        <Schalter karte erklaerung="bedienung.mehr" an={b.mehrImmer} onChange={v => setze({ mehrImmer: v })}
          beschreibung="Am Rechner steht „⋯“ sonst nur beim Überfahren der Zeile oder mit der Tastatur (Tab). Am Handy steht es immer.">
          „⋯“ immer sichtbar
        </Schalter>
      </Karte>

      <Karte i={3}>
        <Ueberschrift erklaerung="bedienung.dichte">Listen</Ueberschrift>
        <Beschriftung>Dichte</Beschriftung>
        <Segmente umbrechen liste={[...DICHTEN]} aktiv={b.dichte} onWahl={d => setze({ dichte: d })} />
        <p style={text}>Kompakt zeigt mehr Zeilen auf einmal — jede Zeile bleibt mindestens 44 px hoch (gut zu treffen).</p>
      </Karte>

      <Karte i={4}>
        <Ueberschrift>Rückmeldung</Ueberschrift>
        <Schalter karte erklaerung="bedienung.haptik" an={b.haptik} aus={vibriert === false} onChange={v => setze({ haptik: v })}
          beschreibung={vibriert === false ? 'Dieses Gerät kann das im Browser nicht (iPhone-Safari).' : 'Ein kurzes Vibrieren, sobald das Wischen auslösen wird, und wenn es auslöst.'}>
          Kurz vibrieren beim Wischen
        </Schalter>
      </Karte>

      <Karte i={5}>
        <Ueberschrift>Ausprobieren</Ueberschrift>
        <Liste>
          <ZeileAktionen titel="Probezeile" archiviert={probe === 'archiv'}
            onArchivieren={() => { const vorher = probe; setProbe(vorher === 'archiv' ? 'offen' : 'archiv'); melden(vorher === 'archiv' ? 'Probe: zurückgeholt' : 'Probe: archiviert', () => setProbe(vorher)); }}
            onLoeschen={() => melden('Probe: gelöscht — es ist nichts passiert', () => {})}
            mehr={[{ id: 'bearbeiten', label: 'Bearbeiten', hinweis: 'so sehen Einträge der Liste aus', tun: () => melden('Probe: Bearbeiten') }]}>
            <Zeile titel="Probezeile" unter={probe === 'archiv' ? 'im Archiv' : 'wischen oder „⋯“ — hier passiert nichts Echtes'} />
          </ZeileAktionen>
        </Liste>
      </Karte>

      {!vorgabe && <div><Knopf leise onClick={() => setze({ ...BEDIENUNG_VORGABE })}>Auf Vorgabe zurücksetzen</Knopf></div>}
      {hinweis}
    </Seite>
  );
}
