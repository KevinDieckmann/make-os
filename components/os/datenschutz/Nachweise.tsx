'use client';

// ─── MAKE OS — System › Nachweise (05.10., Paket „Verschlüsselung lückenlos + Protokolle nachweisfest“) ──────────────
// Für den Inhaber: wer hat Gesundheit/Erholung, Finanzen, Kontakt-/Firmenakten und das Gesellschafts-Register gelesen
// (Lese-Protokoll, 12 Monate), ist die Protokoll-Kette unverändert (Änderungs-, Lese-, Anmeldeprotokoll), wie steht die
// Verschlüsselung (Schreibformat, Brain-Index, Bilder) und was fehlt noch für das Format v2. Nur Metadaten, nie Inhalte.
// Eigenständig (eigene Route /api/datenschutz/nachweise) — als Karten-Gruppe auch in die Datenschutz-Seite einbaubar
// (`<NachweiseKarten />`).

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, LEUCHT } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Hinweis, Knopf, Pillen, Chip, Leer } from '../ui';
import type { LeseEintrag, LeseBereich } from '@/lib/store/leseprotokoll';
import type { KettenPruefung } from '@/lib/store/protokoll-kette';
import type { V2Bereitschaft } from '@/lib/datenschutz/nachweise';
import type { BrainIndexLage } from '@/lib/hoi/lage';

interface Antwort {
  ok: true;
  bereiche: Record<LeseBereich, { label: string; art9?: true }>;
  lesen: { tage: number; eintraege: LeseEintrag[]; gesamt: number; gekuerzt: boolean; zaehlung: Record<string, number>; aufbewahrungMonate: number };
  kette: KettenPruefung | null;
  verschluesselung: { modus: 'kompatibel' | 'v2'; unbekannt: boolean; schluesselQuelle: string; verschluesselt: boolean; pepper: boolean };
  brainIndex: BrainIndexLage | null;
  bilder: { verschluesselt: number; klartext: number };
  v2: V2Bereitschaft;
}

const zeit = (iso: string) => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const STAND_FARBE = { ok: LEUCHT.gut, offen: LEUCHT.kritisch, hinweis: C.inkLeise } as const;
const ORT = { tmpfs: 'tmpfs (nur Arbeitsspeicher)', arbeitsspeicher: 'Arbeitsspeicher des Prozesses', platte: 'Datei auf der Platte' } as const;

export function NachweiseKarten({ i = 0 }: { i?: number }) {
  const [d, setD] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [tage, setTage] = useState<'7' | '30' | '365'>('30');
  const [bereich, setBereich] = useState<string>('alle');
  const [fremde, setFremde] = useState(false);
  const [pruefe, setPruefe] = useState(false);

  const laden = useCallback(async () => {
    setFehler(null);
    const q = new URLSearchParams({ tage, ...(bereich !== 'alle' ? { bereich } : {}), ...(fremde ? { fremde: '1' } : {}) });
    const r = await fetch(`/api/datenschutz/nachweise?${q}`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) setD(r as Antwort); else setFehler(r.fehler ?? 'Nicht geladen.');
  }, [tage, bereich, fremde]);
  useEffect(() => { void laden(); }, [laden]);

  const kettePruefen = async () => {
    setPruefe(true);
    const r = await fetch('/api/datenschutz/nachweise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'kette-pruefen' }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setPruefe(false);
    if (r.ok) setD(alt => (alt ? { ...alt, kette: r.kette } : alt)); else setFehler(r.fehler ?? 'Prüfung gescheitert.');
  };

  if (fehler) return <Karte i={i}><Hinweis art="kritisch" titel="Nachweise nicht geladen" aktion={<Knopf leise onClick={() => void laden()}>Nochmal</Knopf>}>{fehler}</Hinweis></Karte>;
  if (!d) return <Karte i={i}><Leer>Nachweise werden geladen …</Leer></Karte>;
  const k = d.kette;
  const v = d.verschluesselung;
  const bereiche = [{ id: 'alle', label: 'Alle' }, ...Object.entries(d.bereiche).map(([id, b]) => ({ id, label: `${b.label}${d.lesen.zaehlung[id] ? ` · ${d.lesen.zaehlung[id]}` : ''}` }))];

  return (
    <>
      <Karte i={i}>
        <Ueberschrift rechts={<Knopf leise onClick={() => void kettePruefen()} aus={pruefe}>{pruefe ? 'Prüft …' : 'Jetzt prüfen'}</Knopf>}>Protokolle — Hash-Kette</Ueberschrift>
        {!k ? <Hinweis art="info" titel="Noch nicht geprüft">Die nächtliche Durchsicht prüft Änderungs-, Lese- und Anmeldeprotokoll ab 4 Uhr.</Hinweis>
          : k.ok ? <Hinweis art={k.warnungen ? 'achtung' : 'gut'} titel="Protokoll unverändert ✓">{`${k.dateien} Dateien · ${k.eintraege} Einträge · geprüft ${zeit(k.zeit)}${k.getilgt ? ` · ${k.getilgt} nach Art. 17 getilgt` : ''}${k.warnungen ? ` · ${k.warnungen} noch ohne vollständiges Siegel` : ''}`}</Hinweis>
          : <Hinweis art="kritisch" rolle="alert" titel={`${k.fehler} Datei${k.fehler === 1 ? '' : 'en'} mit Bruch`}>Ein Protokoll wurde verändert, gekürzt, vertauscht oder zurückgespielt. Mit den Sicherungen vom Vortag vergleichen und als mögliche Datenpanne prüfen (datenschutz/DATENPANNEN.md).</Hinweis>}
        {k && k.befunde.length > 0 && (
          <Liste>
            {k.befunde.map(b => <Zeile key={b.name} titel={b.name} unter={b.hinweis ?? b.stand} umbrechen rechts={<Chip farbe={b.stand === 'fehler' ? STAND_FARBE.offen : C.inkLeise}>{b.stand}</Chip>} />)}
          </Liste>
        )}
      </Karte>

      <Karte i={i + 1}>
        <Ueberschrift>Lese-Protokoll</Ueberschrift>
        <p style={{ color: C.inkLeise, margin: '0 0 10px' }}>Wer Gesundheit, Erholung, Finanzen, Kontakte, Firmen und das Gesellschafts-Register gelesen hat — nur Zeit, Person, Bereich und wessen Daten; nie Inhalte. Gleicher Zugriff höchstens alle 10 Minuten, Aufbewahrung {d.lesen.aufbewahrungMonate} Monate.</p>
        <Pillen liste={[{ id: '7' as const, label: '7 Tage' }, { id: '30' as const, label: '30 Tage' }, { id: '365' as const, label: '12 Monate' }]} aktiv={tage} onWahl={setTage} />
        <Pillen liste={bereiche} aktiv={bereich} onWahl={setBereich} />
        <Pillen liste={[{ id: 'alle' as const, label: 'Alle Zugriffe' }, { id: 'fremde' as const, label: 'Nur auf Daten anderer' }]} aktiv={fremde ? 'fremde' : 'alle'} onWahl={x => setFremde(x === 'fremde')} />
        {d.lesen.eintraege.length === 0 ? <Leer>Keine Zugriffe im Zeitraum.</Leer> : (
          <Liste>
            {d.lesen.eintraege.map((e, n) => (
              <Zeile key={`${e.at}#${n}`} umbrechen
                titel={`${d.bereiche[e.bereich]?.label ?? e.bereich}${e.betroffen ? ` · Daten von ${e.betroffen}` : ''}`}
                unter={[e.wer === 'person' ? e.person : e.wer === 'zoe' ? `ZOE für ${e.person}` : 'System', e.ids?.length ? `${e.ids.length} Kennung${e.ids.length === 1 ? '' : 'en'}` : '', e.weg ?? ''].filter(Boolean).join(' · ')}
                rechts={<span style={{ color: C.inkLeise, whiteSpace: 'nowrap' }}>{zeit(e.at)}</span>} />
            ))}
          </Liste>
        )}
        {d.lesen.gekuerzt && <p style={{ color: C.inkLeise }}>Die neuesten 500 von {d.lesen.gesamt} — Zeitraum oder Bereich enger wählen.</p>}
      </Karte>

      <Karte i={i + 2}>
        <Ueberschrift>Verschlüsselung im Ruhezustand</Ueberschrift>
        <Liste>
          <Zeile titel="Bestände" unter={v.verschluesselt ? `AES-256-GCM je Datei · Schlüssel aus ${v.schluesselQuelle === 'datei' ? 'Datei (0400)' : v.schluesselQuelle === 'umgebung' ? 'der Umgebung (.env)' : '—'}` : 'kein Datenschlüssel — Klartext'} rechts={<Chip farbe={v.verschluesselt ? STAND_FARBE.ok : STAND_FARBE.offen}>{v.verschluesselt ? 'an' : 'aus'}</Chip>} />
          <Zeile titel="Schreibformat" unter={v.modus === 'v2' ? 'v2 — Schlüssel-ID + AAD' : `Kompatibilitätsmodus (v1)${v.unbekannt ? ' — MAKE_OS_FORMAT unbekannt' : ''}`} rechts={<Chip farbe={v.modus === 'v2' ? STAND_FARBE.ok : C.inkLeise}>{v.modus}</Chip>} />
          {d.brainIndex && <Zeile umbrechen titel="Brain-Index (Suche)" unter={`${ORT[d.brainIndex.ort]} · ${d.brainIndex.groesseMb.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB${d.brainIndex.grenzeMb ? ` von ${d.brainIndex.grenzeMb} MB` : ''} · ${d.brainIndex.notizen} Notizen`} rechts={<Chip farbe={d.brainIndex.klartextAufPlatte || d.brainIndex.altDateiDa ? STAND_FARBE.offen : STAND_FARBE.ok}>{d.brainIndex.klartextAufPlatte || d.brainIndex.altDateiDa ? 'Klartext' : 'nie auf Platte'}</Chip>} />}
          <Zeile titel="Bilder (Gerichte, Bauplan)" unter={`${d.bilder.verschluesselt} verschlüsselt${d.bilder.klartext ? ` · ${d.bilder.klartext} alt im Klartext` : ''}`} rechts={<Chip farbe={d.bilder.klartext ? STAND_FARBE.offen : STAND_FARBE.ok}>{d.bilder.klartext ? 'offen' : 'ok'}</Chip>} />
        </Liste>
      </Karte>

      <Karte i={i + 3}>
        <Ueberschrift>Format v2 — Bereitschaft</Ueberschrift>
        <Hinweis art={d.v2.modus === 'v2' ? 'gut' : d.v2.bereit ? 'info' : 'achtung'} titel={d.v2.modus === 'v2' ? 'v2 ist aktiv' : d.v2.bereit ? 'Bereit für die Umstellung' : 'Vor der Umstellung offen'}>
          {d.v2.modus === 'v2' ? 'Jede Hülle trägt Schlüssel-ID und Bestandsnamen.' : 'Umstellen nur auf Kevins Wort: Anleitung in UPDATES.md (05.10.) — .env MAKE_OS_FORMAT=v2, einmal --verschluesseln.'}
        </Hinweis>
        <Liste>
          {d.v2.punkte.map(p => <Zeile key={p.id} umbrechen titel={p.titel} unter={p.text} rechts={<Chip farbe={STAND_FARBE[p.stand]}>{p.stand}</Chip>} />)}
        </Liste>
      </Karte>
    </>
  );
}

/** Eigene Seite (System › Nachweise) — bis die Datenschutz-Seite die Karten aufnimmt. */
export function NachweiseView() {
  return (
    <Seite titel="Nachweise" unter="Lese-Protokoll, Protokoll-Kette und Verschlüsselung — nur für den Inhaber, nur Metadaten.">
      <NachweiseKarten />
    </Seite>
  );
}
