'use client';

// ─── MAKE OS — ZOE › Freigaben › Protokoll (08.10., Phase 0) ────────────────
// Bis 08.10. die eigene Seite /os/stapel/voll („Aufträge & Freigaben · voll“, Baustein 2 vom 07.09.). Kevin 08.10.: die
// Vollansicht wird ein Reiter der Freigaben (`WEG.freigaben('protokoll')`, alte Adresse leitet in next.config.mjs hierher).
// Was hier steht, gab es nur dort:
//   - Was ZOE von allein (oder nach Freigabe) getan hat — mit dem Knopf, es zurückzunehmen,
//   - alles, was ZOE sich gemerkt hat (mit „bis“), jeweils „vergessen“,
//   - woraus ZOE sein Wissen zieht (Notizen, übersprungene Kopien, private Pfade).
// „Ändern & freigeben“ steht seitdem direkt an den offenen Vorschlägen (Reiter „Offen“, lib/zoe/stapel-aendern.ts);
// Freigeben, Ablehnen mit Grund, „alle durcharbeiten“, Selbst machen, der Arbeiter und der Verbrauch ebenfalls dort.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, Zahl, Hinweis, LEUCHT, Spalten, Spalte } from './ui';

interface Fakt { id: string; tag: string; art: string; thema: string; satz: string; woher?: string; bis?: string }
interface Eintrag {
  id: string; zeit: string; werkzeug: string; gruppe: string; risiko: string;
  ergebnis: string; ok: boolean; quelle: 'zoe' | 'stapel';
  ruecknahme?: { text: string } | null; zurueckgenommenAm?: string;
}
interface Gehirn { notizen: number; dubletten: number; privatUebersprungen: number }

/** Tag und Uhrzeit — das Protokoll reicht über mehrere Tage. */
const wann = (iso: string) => {
  try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};
/** Leiser Textknopf in einer Zeile — „vergessen“, wie im Reiter „Offen“. */
const textKnopf: React.CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: 0, minHeight: 44 };

export function StapelProtokoll() {
  const [protokoll, setProtokoll] = useState<Eintrag[]>([]);
  const [fakten, setFakten] = useState<Fakt[]>([]);
  const [gehirn, setGehirn] = useState<Gehirn | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);

  const laden = useCallback(async () => {
    try {
      const [p, g] = await Promise.all([
        fetch('/api/zoe/protokoll?anzahl=40').then(r => r.json()),
        fetch('/api/zoe/gedaechtnis').then(r => r.json()),
      ]) as [Record<string, unknown>, Record<string, unknown>];
      setProtokoll(Array.isArray(p.eintraege) ? (p.eintraege as Eintrag[]) : []);
      setFakten(Array.isArray(g.fakten) ? (g.fakten as Fakt[]) : []);
    } catch { /* offline — der alte Stand bleibt stehen */ }
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  // Der Stand des Gehirns — einmal beim Öffnen, er ändert sich selten.
  useEffect(() => { fetch('/api/zoe/wissen').then(r => r.json()).then(d => { if (d.ok) setGehirn(d); }).catch(() => {}); }, []);

  async function zurueck(id: string) {
    setBusy(id);
    try {
      const d = await fetch('/api/zoe/protokoll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(r => r.json());
      setMeldung(d.ok ? { text: 'Zurückgenommen.', gut: true } : { text: d.error ?? 'Ging nicht.', gut: false });
    } catch { setMeldung({ text: 'Nicht erreichbar.', gut: false }); }
    setBusy(null);
    void laden();
  }
  async function vergiss(id: string) {
    setBusy(id);
    try {
      const d = await fetch(`/api/zoe/gedaechtnis?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).then(r => r.json());
      setMeldung(d.ok ? { text: 'Vergessen.', gut: true } : { text: d.error ?? 'Ging nicht.', gut: false });
    } catch { setMeldung({ text: 'Nicht erreichbar.', gut: false }); }
    setBusy(null);
    void laden();
  }

  return (
    <>
      {meldung && <Hinweis art={meldung.gut ? 'gut' : 'kritisch'} rolle={meldung.gut ? 'status' : 'alert'}>{meldung.text}</Hinweis>}
      <Spalten verhaeltnis="2:1">
        <Spalte>
          {/* ── Was ZOE getan hat — mit Rückgängig ── */}
          <Karte i={0}>
            <Ueberschrift farbe={protokoll.length ? LEUCHT.schlaf : C.inkLeise} rechts={protokoll.length ? `${protokoll.length}` : undefined}>Was ZOE getan hat</Ueberschrift>
            {!laedt && !protokoll.length ? <Leer>Noch nichts protokolliert.</Leer> : (
              <Liste>
                {protokoll.map(e => (
                  // Nur die erste Zeile: eine gelesene Notiz bringt sonst 600 Zeichen mit und das Protokoll wird unlesbar. Der Rest im Tooltip.
                  <div key={e.id} title={e.ergebnis}>
                    <Zeile links={<Punkt farbe={e.ok ? LEUCHT.gut : LEUCHT.kritisch} />}
                      titel={e.ergebnis.split('\n')[0].slice(0, 150)}
                      unter={`${wann(e.zeit)} · ${e.quelle === 'stapel' ? 'nach Freigabe' : 'von allein'}`}
                      rechts={e.zurueckgenommenAm
                        ? <Chip farbe={C.inkLeise}>zurückgenommen</Chip>
                        : e.ruecknahme
                          ? <Knopf leise onClick={() => zurueck(e.id)} aus={busy !== null}>↺ {e.ruecknahme.text}</Knopf>
                          : null} />
                  </div>
                ))}
              </Liste>
            )}
          </Karte>
        </Spalte>
        <Spalte>
          {/* ── Was ZOE sich gemerkt hat — Kevins Bedingung: sofort merken, dafür sichtbar und löschbar. ── */}
          <Karte i={1}>
            <Ueberschrift farbe={LEUCHT.agenten} rechts={fakten.length ? `${fakten.length}` : undefined}>Was ZOE sich gemerkt hat</Ueberschrift>
            {!laedt && !fakten.length ? <Leer>ZOE hat sich noch nichts gemerkt. Sag ihm „merk dir …“.</Leer> : (
              <Liste>
                {fakten.slice(0, 40).map(f => (
                  <div key={f.id} title={f.satz}>
                    <Zeile titel={f.satz} unter={`${f.art} · ${f.thema} · ${f.tag}`}
                      rechts={<span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {f.bis && <Chip farbe={LEUCHT.achtung}>bis {f.bis}</Chip>}
                        <button onClick={() => vergiss(f.id)} disabled={busy !== null} title="Stimmt nicht — vergessen" style={textKnopf}>vergessen</button>
                      </span>} />
                  </div>
                ))}
              </Liste>
            )}
          </Karte>
          {/* ── Das Gehirn: woraus ZOE sein Wissen zieht ── */}
          {gehirn && (
            <Karte i={2}>
              <Ueberschrift farbe={LEUCHT.agenten}>Woraus ZOE weiß</Ueberschrift>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                <Zahl wert={gehirn.notizen ? String(gehirn.notizen) : undefined} label="Notizen durchsuchbar" farbe={LEUCHT.agenten} />
                <Zahl wert={gehirn.dubletten ? String(gehirn.dubletten) : undefined} label="Kopien übersprungen" />
                <Zahl wert={gehirn.privatUebersprungen ? String(gehirn.privatUebersprungen) : undefined} label="private Pfade zu" />
              </div>
              <Leer>Aus dem Brain (Nummer eins) und der MAKE-OS-Doku. Private Ordner anderer Personen werden gar nicht erst geöffnet.</Leer>
            </Karte>
          )}
        </Spalte>
      </Spalten>
    </>
  );
}
