'use client';

// ─── Prozesse · Werkstatt — Prozess als Datei sichern bzw. aus einer Datei anlegen (26.10., Bauplan „Import für Werkstatt-Prozesse“) ─────────────────────
// „Aus Datei“ (Übersicht): Datei wählen → Vorschau (Name, Bereich, Fall-Art, Schritte, Auslöser, Agenten, offene Punkte) → „Als Entwurf anlegen“ → in die
// Werkstatt des ersten neuen Prozesses. „Als Datei sichern“ (Steckbrief): der Entwurf ohne Personen als `make-os/prozess`. Beides über den EINEN Schreibweg
// der Werkstatt-Route; gerechnet wird nur in lib/prozesse/datei-import.ts. Gesendet wird nichts nach außen.

import { useRef, useState } from 'react';
import { FileUp, FileDown } from 'lucide-react';
import { FARBE as C, TYP, RAND, ECKE } from '@/lib/make-one/design';
import { Knopf, Hinweis } from '../ui';
import { Fenster } from '../Fenster';
import { neueKennung } from '@/lib/kennung';
import { werkstattSenden, WERKSTATT_QUELLE } from './werkstatt-daten';
import { PROZESS_DATEI_GRENZEN, type ProzessDateiVorschau } from '@/lib/prozesse/datei-import';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;

/** Das Fenster „Prozess aus Datei“. `onAngelegt(id)` führt in die Werkstatt des (ersten) neuen Prozesses. */
export function ProzessAusDatei({ onZu, onAngelegt }: { onZu: () => void; onAngelegt: (id: string) => void }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const [datei, setDatei] = useState<{ name: string; inhalt: unknown } | null>(null);
  const [vorschau, setVorschau] = useState<ProzessDateiVorschau[] | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'info'; text: string } | null>(null);
  const [anfrage, setAnfrage] = useState(() => neueKennung('pza'));
  const [laeuft, setLaeuft] = useState(false);

  const gewaehlt = async (f: File | undefined) => {
    setMeldung(null); setVorschau(null); setDatei(null);
    if (!f) return;
    if (f.size > PROZESS_DATEI_GRENZEN.bytes) { setMeldung({ art: 'kritisch', text: `Die Datei ist größer als ${PROZESS_DATEI_GRENZEN.bytes / 1024 / 1024} MB — nichts gelesen.` }); return; }
    let inhalt: unknown;
    try { inhalt = JSON.parse(await f.text()); } catch { setMeldung({ art: 'kritisch', text: 'Das ist keine JSON-Datei — nichts gelesen.' }); return; }
    setDatei({ name: f.name, inhalt });
    const r = await werkstattSenden(() => ({ aktion: 'datei-vorschau', datei: inhalt }));
    if (r.status === 200 && r.j?.ok) { setVorschau(r.j.vorschau as ProzessDateiVorschau[]); return; }
    setMeldung({ art: 'kritisch', text: String(r.j?.fehler ?? 'Die Datei ließ sich nicht lesen.') });
  };
  const anlegen = async () => {
    if (!datei) return;
    setLaeuft(true); setMeldung(null);
    const r = await werkstattSenden(() => ({ aktion: 'datei-import', datei: datei.inhalt, dateiName: datei.name, anfrageId: anfrage }));
    setLaeuft(false);
    setAnfrage(neueKennung('pza'));
    const angelegt = Array.isArray(r.j?.angelegt) ? (r.j!.angelegt as { id: string }[]) : [];
    if (r.status === 200 && r.j?.ok && angelegt[0]) { onAngelegt(angelegt[0].id); return; }
    setMeldung({ art: 'kritisch', text: String(r.j?.fehler ?? 'Nichts angelegt.') });
  };
  const sperrt = !!vorschau?.some(v => v.sperrt);
  return (
    <Fenster titel="Prozess aus Datei" onZu={onZu} breit={760}>
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={klein}>Eine Datei im Format „make-os/prozess“ (so schreibt sie „Als Datei sichern“). Jeder Prozess bekommt neue Kennungen, Personen fallen weg, und er steht danach als Entwurf in der Werkstatt — nichts läuft von selbst.</p>
        <input ref={eingabe} type="file" accept="application/json,.json" aria-label="Prozess-Datei wählen" onChange={e => void gewaehlt(e.target.files?.[0])} style={{ display: 'none' }} />
        <span><Knopf onClick={() => eingabe.current?.click()}><span className="pz-knopf-inhalt"><FileUp size={16} aria-hidden />{datei ? 'Andere Datei wählen' : 'Datei wählen'}</span></Knopf></span>
        {datei && <p style={klein}>{datei.name}</p>}
        {vorschau && vorschau.map(v => (
          <section key={v.nr} aria-label={v.titel} style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: ECKE.eingabe, border: `1px solid ${RAND.flaeche}` }}>
            <b style={{ fontSize: TYP.body, color: C.ink }}>{v.titel}</b>
            <span style={klein}>{`${v.bereich} · ${v.fallArt} · ${v.schritte} Schritte${v.ausloeser.length ? ` · Auslöser: ${v.ausloeser.join(', ')}` : ' · ohne Auslöser'}${v.agenten ? ` · ${v.agenten} Agent${v.agenten === 1 ? '' : 'en'}` : ''}`}</span>
            {v.befunde.filter(b => b.stufe === 'fehler').map((b, i) => <Hinweis key={`f${i}`} art="kritisch">{b.text}</Hinweis>)}
            {v.befunde.filter(b => b.stufe !== 'fehler').length > 0 && (
              <details><summary style={{ ...klein, cursor: 'pointer' }}>{`${v.befunde.filter(b => b.stufe !== 'fehler').length} offene Punkte vor dem Veröffentlichen`}</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{v.befunde.filter(b => b.stufe !== 'fehler').map((b, i) => <li key={i} style={klein}>{b.text}</li>)}</ul>
              </details>
            )}
            {v.hinweise.map((h, i) => <span key={`h${i}`} style={klein}>{h}</span>)}
          </section>
        ))}
        {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
        {vorschau && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Knopf haupt aus={sperrt || laeuft} onClick={anlegen}>{laeuft ? 'legt an …' : vorschau.length === 1 ? 'Als Entwurf anlegen' : `${vorschau.length} Prozesse als Entwurf anlegen`}</Knopf>
            {sperrt && <span style={klein}>Erst die rot markierten Punkte in der Datei beheben — sonst wird nichts angelegt.</span>}
          </div>
        )}
      </div>
    </Fenster>
  );
}

/** „Als Datei sichern“: lädt den gespeicherten Entwurf ohne Personen als JSON herunter. */
export function ProzessAlsDateiKnopf({ prozessId, vorher }: { prozessId: string; vorher: () => Promise<boolean> }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const sichern = async () => {
    setFehler(null);
    if (!(await vorher())) { setFehler('Erst muss der Entwurf gespeichert sein.'); return; }
    const r = await fetch(`${WERKSTATT_QUELLE}&id=${encodeURIComponent(prozessId)}&datei=1`, { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) { setFehler('Die Datei ließ sich nicht erstellen.'); return; }
    const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? 'prozess.json';
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <>
      <Knopf leise onClick={sichern} titel="Den Entwurf als Datei herunterladen — ohne Personen und Fall-Daten; „Aus Datei“ legt ihn hier oder in einer anderen Instanz wieder an"><span className="pz-knopf-inhalt"><FileDown size={14} aria-hidden />Als Datei sichern</span></Knopf>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
    </>
  );
}

