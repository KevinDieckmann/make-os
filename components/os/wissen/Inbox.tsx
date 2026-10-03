'use client';

// ─── Wissen › Inbox: Vorschläge von ZOE mit Freigabe (27.09.) ────────────
// Kevins Entscheidung: ZOE schreibt frei nur sein Log; alles andere wartet
// hier. Annehmen macht daraus Wissen (Notiz, Update-Block oder Regel) mit
// Provenienz; Ablehnen bewahrt den Grund. Darunter der Stand des Brain-Index
// (Volltext + Embeddings) und der Knopf für die Konsolidierung auf Zuruf.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Segmente, Zahl, Hinweis, feld, LEUCHT } from '../ui';

interface Vorschlag { id: string; titel: string; text: string; ziel: 'neu' | 'ergaenzung' | 'regel'; zielNotiz?: string; zielOrdner?: string; begruendung: string; quelle: string; vertraulichkeit: string; erstelltVon: string; erstelltAm: string; status: string; entschiedenVon?: string; entschiedenAm?: string; grund?: string }
interface IndexStand { ok: boolean; notizen: number; chunks: number; vektoren: number; letzterLauf: string | null; dauerMs: number | null; embeddings?: { aktiv: boolean; modell: string; hinweis: string | null; offen: number } }
const ZIEL: Record<Vorschlag['ziel'], { label: string; farbe: string }> = { neu: { label: 'neue Notiz', farbe: LEUCHT.agenten }, ergaenzung: { label: 'Ergänzung', farbe: LEUCHT.puls }, regel: { label: 'Regel', farbe: LEUCHT.achtung } };

export function Inbox({ ich, oeffne }: { ich: string; oeffne: (id: string) => void }) {
  const [welche, setWelche] = useState<'offen' | 'erledigt' | 'abgelehnt'>('offen');
  const [liste, setListe] = useState<Vorschlag[] | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [grund, setGrund] = useState<Record<string, string>>({});
  const [meldung, setMeldung] = useState('');
  const [index, setIndex] = useState<IndexStand | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [konsolidierung, setKonsolidierung] = useState<{ letzterTag?: string; letztesErgebnis?: string } | null>(null);

  const laden = useCallback(async () => {
    try { const d = await fetch(`/api/brain/inbox?welche=${welche}`, { cache: 'no-store' }).then(r => r.json()); setListe(d.ok ? d.vorschlaege : []); if (!d.ok) setMeldung(d.fehler ?? ''); } catch { setListe([]); }
  }, [welche]);
  const ladeIndex = useCallback(async () => {
    try { setIndex(await fetch('/api/brain/index', { cache: 'no-store' }).then(r => r.json())); } catch { /* still */ }
    try { setKonsolidierung(await fetch('/api/brain/konsolidierung', { cache: 'no-store' }).then(r => r.json())); } catch { /* still */ }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { void ladeIndex(); }, [ladeIndex]);

  const entscheide = async (v: Vorschlag, aktion: 'annehmen' | 'ablehnen') => {
    setBusy(v.id);
    const d = await fetch('/api/brain/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion, id: v.id, grund: grund[v.id] }) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Nicht erreichbar.' }));
    setBusy(null);
    setMeldung(d.ok ? (d.ergebnis ?? (aktion === 'ablehnen' ? `Abgelehnt: ${v.titel}` : 'Angenommen.')) : d.fehler ?? 'Nicht gespeichert.');
    setOffen(null);
    await laden();
  };
  const wann = (iso: string | null) => (iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  return (
    <>
      <Karte i={1} akzent={welche === 'offen' && liste?.length ? LEUCHT.achtung : undefined}>
        <Ueberschrift rechts={<Segmente liste={[{ id: 'offen', label: 'Offen' }, { id: 'erledigt', label: 'Angenommen' }, { id: 'abgelehnt', label: 'Abgelehnt' }]} aktiv={welche} onWahl={w => setWelche(w as typeof welche)} />}>Vorschläge von ZOE</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10 }}>ZOE schreibt nichts von selbst ins Brain — er legt es hier ab, mit Begründung und Quelle. Annehmen macht daraus Wissen mit deinem Namen dran.</div>
        {meldung && <div style={{ marginBottom: 10 }}><Hinweis art="info">{meldung}</Hinweis></div>}
        {liste === null && <Leer>Lese die Inbox …</Leer>}
        {liste && !liste.length && <Leer>{welche === 'offen' ? 'Nichts offen. Die nächtliche Konsolidierung legt hier ab, was der Tag hinterlässt.' : 'Noch nichts.'}</Leer>}
        <Liste>
          {(liste ?? []).map(v => (
            <div key={v.id}>
              <Zeile onClick={() => setOffen(o => (o === v.id ? null : v.id))} aktiv={offen === v.id} links={<Punkt farbe={ZIEL[v.ziel].farbe} />}
                titel={<span>{v.titel} {v.vertraulichkeit !== 'gemeinsam' && <span aria-label="privat">🔒</span>}</span>}
                unter={`${ZIEL[v.ziel].label}${v.zielNotiz ? ` an „${v.zielNotiz}“` : ''} · ${v.erstelltAm} · ${v.begruendung.slice(0, 90)}${v.status !== 'offen' ? ` · ${v.status} von ${v.entschiedenVon ?? '—'}${v.grund ? ` (${v.grund})` : ''}` : ''}`}
                rechts={<Chip farbe={ZIEL[v.ziel].farbe}>{ZIEL[v.ziel].label}</Chip>} />
              {offen === v.id && (
                <div style={{ padding: '6px 2px 14px 26px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: TYP.bedien, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{v.text}</div>
                  <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Begründung: {v.begruendung || '—'} · Quelle: {v.quelle || '—'}{v.zielNotiz && <> · Ziel: <button onClick={() => oeffne(v.zielNotiz!)} style={{ background: 'none', border: 'none', padding: 0, color: LEUCHT.agenten, cursor: 'pointer', font: 'inherit' }}>{v.zielNotiz}</button></>}</div>
                  {welche === 'offen' && (
                    <>
                      <input value={grund[v.id] ?? ''} onChange={e => setGrund(g => ({ ...g, [v.id]: e.target.value }))} placeholder="Grund fürs Ablehnen (optional) — bleibt am Vorschlag" aria-label="Grund" style={{ ...feld, fontSize: 13 }} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Knopf farbe={LEUCHT.gut} aus={busy === v.id} onClick={() => void entscheide(v, 'annehmen')}>Annehmen als {ich}</Knopf>
                        <Knopf leise aus={busy === v.id} onClick={() => void entscheide(v, 'ablehnen')}>Ablehnen</Knopf>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </Liste>
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts={<Knopf leise aus={busy === 'index'} onClick={async () => { setBusy('index'); await fetch('/api/brain/index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'aufbauen' }) }).catch(() => {}); setBusy(null); void ladeIndex(); }}>{busy === 'index' ? 'baut …' : 'Jetzt abgleichen'}</Knopf>}>Brain-Index</Ueberschrift>
        {!index ? <Leer>Lese den Index …</Leer> : !index.ok ? <Leer>Index nicht lesbar.</Leer> : (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Zahl wert={String(index.notizen)} label="Notizen" /><Zahl wert={String(index.chunks)} label="Abschnitte" /><Zahl wert={String(index.vektoren)} label="Embeddings" farbe={index.vektoren ? LEUCHT.gut : undefined} />
            </div>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>
              Letzter Abgleich {wann(index.letzterLauf)}{index.dauerMs ? ` (${index.dauerMs} ms)` : ''} · alle 10 Minuten vom Takt. Volltext (FTS5) sofort; Embeddings ({index.embeddings?.modell ?? '—'}) {index.embeddings?.aktiv ? (index.embeddings.hinweis ? `pausiert: ${index.embeddings.hinweis}` : `${index.embeddings.offen} Abschnitte offen`) : 'aus'}.
            </div>
          </>
        )}
      </Karte>

      <Karte i={3}>
        <Ueberschrift rechts={<Knopf leise aus={busy === 'kons'} onClick={async () => { setBusy('kons'); const d = await fetch('/api/brain/konsolidierung', { method: 'POST' }).then(r => r.json()).catch(() => ({ ok: false, text: 'Nicht erreichbar.' })); setBusy(null); setMeldung(d.text ?? d.fehler ?? ''); void laden(); void ladeIndex(); }}>{busy === 'kons' ? 'läuft …' : 'Jetzt verdichten'}</Knopf>}>Nächtliche Konsolidierung</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Ab 21 Uhr verdichtet ZOE den Tag — neue Fakten, sein Log, geänderte Protokolle — zu höchstens fünf Vorschlägen. Ohne KI-Guthaben als Regelwerk (die Fakten des Tages als ein Vorschlag).</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>Zuletzt: {konsolidierung?.letzterTag ?? 'noch nie'}{konsolidierung?.letztesErgebnis ? ` · ${konsolidierung.letztesErgebnis}` : ''}</div>
      </Karte>
    </>
  );
}
