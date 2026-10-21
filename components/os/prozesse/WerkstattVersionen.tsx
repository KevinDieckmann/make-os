'use client';

// ─── Prozesse · Werkstatt — Veröffentlichen und Versionen (Etappe B2, 21.10.; ANALYSE_100.md Punkt 43) ─────────────────────────────────────────────────────
// Live läuft nur bewusst Veröffentlichtes: die Fläche ist der Entwurf (automatisch gespeichert); „Veröffentlichen“ legt mit Name und Notiz eine unveränderliche
// Version an — gesperrt, solange es Befunde gibt (`sperrtVeroeffentlichen`; die Befunde stehen verständlich darüber) und nur für volle Mitglieder
// (lib/prozesse/rollen.ts — die anderen bauen Entwürfe). Versionen ansehen (die Fläche zeigt sie nur lesend), vergleichen (Entwurf ↔ Version, nur Feldnamen) und
// als Entwurf übernehmen (Rückfrage: der Entwurf wird ersetzt, die Versionen bleiben). Geschrieben wird über den EINEN Schreibweg der Werkstatt.

import { useState } from 'react';
import { Eye, GitCompare, RotateCcw, Upload, ClipboardCheck } from 'lucide-react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, feld, Zeile, Leer } from '../ui';
import { Fenster } from '../Fenster';
import { PROZESS_TEXT, type Befund } from '@/lib/prozesse/definition';
import type { Vergleich } from '@/lib/prozesse/versionen';
import type { VersionKurz } from './werkstatt-daten';
import { BefundListe } from './WerkstattPanel';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
const tag = (iso: string) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }) : iso; };

export function VersionenFenster({ versionen, befunde, sperrt, darfVeroeffentlichen, entwurfGeaendert, ausstehend, laufHinweise = [], tests, onVeroeffentlichen, onAnsehen, onVergleichen, onUebernehmen, onZu }: {
  versionen: readonly VersionKurz[]; befunde: readonly Befund[]; sperrt: boolean; darfVeroeffentlichen: boolean; entwurfGeaendert: boolean; ausstehend: boolean;
  /** Hinweise für das Laufen (22.10., Punkt 49: Schleifen über eigene Ereignisse, Modell-Rauten, Schleifen-Baustein — lib/prozesse/lauf-regeln.ts `laufBefunde`). */
  laufHinweise?: readonly Befund[];
  /** Testfälle (22.10.): sind sie grün? „Prüfen“ spielt sie auf dem Entwurf ab. */
  tests?: { anzahl: number; stand: { satz: string; bedeutung: 'gut' | 'achtung' | 'info' | 'kritisch' | 'neutral' } | null; onPruefen: () => Promise<void> };
  onVeroeffentlichen: (name: string, notiz: string) => Promise<string | null>;
  onAnsehen: (nr: number) => void;
  onVergleichen: (nr: number) => Promise<Vergleich | null>;
  onUebernehmen: (nr: number) => Promise<string | null>;
  onZu: () => void;
}) {
  const naechste = (versionen.at(-1)?.nr ?? 0) + 1;
  const [name, setName] = useState(`Version ${naechste}`);
  const [notiz, setNotiz] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [vergleich, setVergleich] = useState<{ nr: number; v: Vergleich } | null>(null);
  const [frage, setFrage] = useState<number | null>(null);
  const gesperrt = sperrt || !darfVeroeffentlichen || !entwurfGeaendert || !name.trim();
  const grund = !darfVeroeffentlichen ? 'Veröffentlichen gibt es nur für volle Mitglieder — Entwürfe kannst du bauen.'
    : sperrt ? 'Noch nicht fertig — erst die offenen Punkte unten erledigen.'
      : !entwurfGeaendert ? `Seit Version ${versionen.at(-1)?.nr ?? ''} hat sich nichts geändert.` : null;
  return (
    <Fenster titel="Veröffentlichen und Versionen" onZu={onZu} breit={760}>
      <section style={{ display: 'grid', gap: 10 }}>
        <div style={{ ...MIKRO }}>Neue Version</div>
        <p style={klein}>Die Fläche ist der Entwurf — er läuft nie. Veröffentlicht wird eine unveränderliche Version; neue Fälle laufen auf der jüngsten, laufende bleiben auf ihrer.</p>
        <Feldzeile label="Name der Version *"><input aria-label="Name der Version" value={name} maxLength={PROZESS_TEXT.versionName} onChange={e => setName(e.target.value)} style={feld} /></Feldzeile>
        <Feldzeile label="Notiz (was ist neu?)"><textarea aria-label="Notiz" value={notiz} maxLength={PROZESS_TEXT.notiz} onChange={e => setNotiz(e.target.value)} rows={3} style={{ ...feld, resize: 'vertical' }} /></Feldzeile>
        {grund && <Hinweis art={sperrt ? 'achtung' : 'info'}>{grund}</Hinweis>}
        {ausstehend && <p style={klein}>Ungespeicherte Änderungen werden vorher gespeichert.</p>}
        {sperrt && <BefundListe befunde={befunde.filter(b => b.stufe !== 'hinweis')} />}
        {laufHinweise.length > 0 && (
          <>
            <div style={{ ...MIKRO }}>Beim Laufen beachten</div>
            <BefundListe befunde={laufHinweise} />
          </>
        )}
        {tests && tests.anzahl > 0 && tests.stand && (
          <Hinweis art={tests.stand.bedeutung} aktion={<Knopf leise onClick={tests.onPruefen}><span className="pz-knopf-inhalt"><ClipboardCheck size={14} aria-hidden />Prüfen</span></Knopf>}>
            {tests.stand.satz}
          </Hinweis>
        )}
        {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
        <div><Knopf haupt aus={gesperrt} onClick={async () => { setFehler(null); const f = await onVeroeffentlichen(name.trim(), notiz.trim()); if (f) setFehler(f); }}>
          <span className="pz-knopf-inhalt"><Upload size={16} aria-hidden />Veröffentlichen</span>
        </Knopf></div>
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <div style={{ ...MIKRO }}>Versionen</div>
        {!versionen.length && <Leer>Noch keine Version — der Prozess ist ein Entwurf.</Leer>}
        {[...versionen].reverse().map(v => (
          <div key={v.nr} style={{ display: 'grid', gap: 6 }}>
            <Zeile umbrechen titel={`${v.nr} · ${v.name}`} unter={`${tag(v.am)}${v.notiz ? ` · ${v.notiz}` : ''}`}
              rechts={
                <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                  <Knopf leise onClick={() => onAnsehen(v.nr)} titel="Auf der Fläche ansehen (nur lesen)"><span className="pz-knopf-inhalt"><Eye size={14} aria-hidden />Ansehen</span></Knopf>
                  <Knopf leise onClick={async () => { const x = await onVergleichen(v.nr); if (x) setVergleich({ nr: v.nr, v: x }); }} titel="Mit dem Entwurf vergleichen"><span className="pz-knopf-inhalt"><GitCompare size={14} aria-hidden />Vergleichen</span></Knopf>
                  <Knopf leise onClick={() => setFrage(v.nr)} titel="Diese Version als Entwurf übernehmen"><span className="pz-knopf-inhalt"><RotateCcw size={14} aria-hidden />Als Entwurf</span></Knopf>
                </span>
              } />
            {frage === v.nr && (
              <Hinweis art="achtung" titel={`Version ${v.nr} als Entwurf übernehmen?`}
                aktion={<span style={{ display: 'inline-flex', gap: 8 }}>
                  <Knopf onClick={async () => { const f = await onUebernehmen(v.nr); setFrage(null); if (f) setFehler(f); }}>Übernehmen</Knopf>
                  <Knopf leise onClick={() => setFrage(null)}>Abbrechen</Knopf>
                </span>}>
                Der jetzige Entwurf wird ersetzt. Die Versionen bleiben unverändert — Rückgängig holt den Entwurf zurück.
              </Hinweis>
            )}
            {vergleich?.nr === v.nr && <VergleichAnsicht v={vergleich.v} nr={v.nr} />}
          </div>
        ))}
      </section>
    </Fenster>
  );
}

function VergleichAnsicht({ v, nr }: { v: Vergleich; nr: number }) {
  const leer = !v.steckbrief.length && !v.knoten.neu.length && !v.knoten.weg.length && !v.knoten.geaendert.length && !v.zettel.neu && !v.zettel.weg && !v.zettel.geaendert;
  return (
    <div style={{ display: 'grid', gap: 6, padding: 12, borderRadius: 14, border: `1px solid ${C.linie}` }} aria-label={`Vergleich Version ${nr} mit dem Entwurf`}>
      <div style={{ ...MIKRO }}>{`Version ${nr} → Entwurf`}</div>
      {leer && <p style={klein}>Keine Unterschiede.</p>}
      {v.steckbrief.length > 0 && <p style={klein}>Steckbrief: {v.steckbrief.join(', ')}</p>}
      {v.knoten.neu.length > 0 && <p style={klein}>Neu: {v.knoten.neu.map(k => `„${k.titel}“`).join(', ')}</p>}
      {v.knoten.weg.length > 0 && <p style={klein}>Entfernt: {v.knoten.weg.map(k => `„${k.titel}“`).join(', ')}</p>}
      {v.knoten.geaendert.length > 0 && <p style={klein}>Geändert: {v.knoten.geaendert.map(k => `„${k.titel}“ (${k.felder.join(', ')})`).join('; ')}</p>}
      {(v.zettel.neu + v.zettel.weg + v.zettel.geaendert) > 0 && <p style={klein}>Zettel: {v.zettel.neu} neu, {v.zettel.weg} entfernt, {v.zettel.geaendert} geändert</p>}
    </div>
  );
}
