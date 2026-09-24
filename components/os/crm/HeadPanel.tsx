'use client';

// ─── Ein Head im CRM: Lauf starten, Lage lesen, Vorschläge entscheiden ──────
// Angenommen wird ein Vorschlag mit Person und Frist zum nächsten Schritt
// an der Person (erscheint dann in der Power Hour), sonst zur Aufgabe.
// Entwürfe lassen sich kopieren — versendet wird hier nichts.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, LEUCHT } from '../schlank';
import type { HeadVorschlag, HeadBericht } from '@/lib/heads/stand';
import { datum } from './daten';

interface Stand { ok: boolean; name: string; modi: { id: string; label: string }[]; vorschlaege: HeadVorschlag[]; berichte: HeadBericht[]; ruhig: { zeit: string; text: string } | null }
const STATUS_FARBE = { ruhig: LEUCHT.gut, beobachten: LEUCHT.achtung, handeln: LEUCHT.kritisch } as const;

export function HeadPanel({ head, standardModus, zuKontakt, i = 0, nachEntscheid }: { head: 'sales' | 'marketing' | 'event'; standardModus: string; zuKontakt?: (id: string) => void; i?: number; nachEntscheid?: () => void }) {
  const [s, setS] = useState<Stand | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState('');
  const [frage, setFrage] = useState('');
  const [offen, setOffen] = useState(false);
  const [sicht, setSicht] = useState<string | null>(null);
  const laden = useCallback(() => fetch(`/api/heads/${head}`, { cache: 'no-store' }).then(r => r.json()).then(d => d.ok && setS(d)).catch(() => {}), [head]);
  useEffect(() => { void laden(); }, [laden]);

  const lauf = async (modus: string) => {
    setLaeuft(modus); setMeldung('');
    const r = await fetch(`/api/heads/${head}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'lauf', modus, ...(modus === 'frage' ? { frage } : {}) }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
    setLaeuft(null);
    setMeldung(!r.ok ? r.fehler : r.ohneKi ? r.ruhigText : `${r.neu ?? 0} neue Vorschläge${r.bericht?.pruefung?.gestrichen?.length ? ` · ${r.bericht.pruefung.gestrichen.length} vom Prüfer gestrichen` : ''}`);
    if (modus === 'frage') setFrage('');
    void laden(); setOffen(true);
  };
  const entscheide = async (id: string, status: string) => {
    const r = await fetch(`/api/heads/${head}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'entscheiden', id, status }) }).then(x => x.json()).catch(() => null);
    if (r?.wohin) setMeldung(`Angenommen → ${r.wohin}.`);
    void laden(); nachEntscheid?.();
  };

  const bericht = s?.berichte[0];
  const vorschlaege = (s?.vorschlaege ?? []).filter(v => v.status === 'offen').sort((a, b) => ['hoch', 'mittel', 'niedrig'].indexOf(a.prioritaet) - ['hoch', 'mittel', 'niedrig'].indexOf(b.prioritaet));
  const name = s?.name ?? (head === 'sales' ? 'Head of Sales' : head === 'marketing' ? 'Head of Marketing' : 'Head of Event');

  return (
    <Karte i={i} akzent={LEUCHT.agenten}>
      <Ueberschrift farbe={LEUCHT.agenten} rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {bericht && <Chip farbe={STATUS_FARBE[bericht.antwort.status]}>{bericht.antwort.status}</Chip>}
        <Knopf leise aus={!!laeuft} onClick={() => lauf(standardModus)}>{laeuft === standardModus ? 'denkt …' : s?.modi.find(m => m.id === standardModus)?.label ?? 'Lauf'}</Knopf>
      </span>}>{name}{vorschlaege.length ? ` · ${vorschlaege.length} zur Freigabe` : ''}</Ueberschrift>
      {bericht ? <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5, margin: 0 }}>{bericht.antwort.zusammenfassung}</p>
        : s?.ruhig ? <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: 0 }}>{s.ruhig.text}</p>
        : <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: 0 }}>Noch kein Lauf. Der Head liest Kartei und CRM, ordnet ein und legt Vorschläge zur Freigabe vor — versendet wird nichts.</p>}
      {bericht && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>{datum(bericht.zeit)} · {s?.modi.find(m => m.id === bericht.modus)?.label ?? bericht.modus}{bericht.pruefung.gestrichen.length ? ` · ${bericht.pruefung.gestrichen.length} vom Prüfer gestrichen` : ''}{bericht.pruefung.unbelegt.length ? ` · ${bericht.pruefung.unbelegt.length} Zahl(en) unbelegt` : ''}</div>}
      {meldung && <div style={{ fontSize: 12.5, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}

      {vorschlaege.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {vorschlaege.slice(0, offen ? 20 : 3).map(v => (
            <div key={v.id} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <b style={{ fontSize: TYP.body, fontWeight: 600 }}>{v.titel}</b>
                <Chip farbe={v.prioritaet === 'hoch' ? LEUCHT.kritisch : v.prioritaet === 'mittel' ? LEUCHT.achtung : C.inkDim}>{v.prioritaet}</Chip>
                {v.frist && <span style={{ fontSize: 12, color: C.inkLeise }}>bis {datum(v.frist)}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>{v.begruendung}</div>
              {v.entwurf && (
                <div style={{ borderLeft: `2px solid ${LEUCHT.agenten}55`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 11, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.06em' }}>Entwurf · {v.entwurf.kanal}</div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: '4px 0 0', lineHeight: 1.5 }}>{v.entwurf.text}</pre>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Knopf onClick={() => entscheide(v.id, 'angenommen')}>Annehmen</Knopf>
                <Knopf leise onClick={() => entscheide(v.id, 'abgelehnt')}>Ablehnen</Knopf>
                {v.entwurf && <Knopf leise onClick={() => { try { void navigator.clipboard.writeText(v.entwurf!.text); setMeldung('Entwurf kopiert — Versand bleibt bei dir.'); } catch { /* egal */ } }}>Entwurf kopieren</Knopf>}
                {v.kontakt_id && zuKontakt && <Knopf leise onClick={() => zuKontakt(v.kontakt_id!)}>Zur Person</Knopf>}
              </div>
            </div>
          ))}
          {vorschlaege.length > 3 && <button onClick={() => setOffen(!offen)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, textAlign: 'left', padding: 0 }}>{offen ? 'weniger' : `alle ${vorschlaege.length} zeigen`}</button>}
        </div>
      )}

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim }}>Weitere Läufe & Frage</summary>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {(s?.modi ?? []).filter(m => m.id !== 'frage' && m.id !== standardModus).map(m => <Knopf key={m.id} leise aus={!!laeuft} onClick={() => lauf(m.id)}>{laeuft === m.id ? 'denkt …' : m.label}</Knopf>)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input value={frage} onChange={e => setFrage(e.target.value)} placeholder={`Frage an den ${name} …`} aria-label="Frage" onKeyDown={e => { if (e.key === 'Enter' && frage.trim()) void lauf('frage'); }}
            style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 11px', color: C.ink, fontSize: TYP.bedien }} />
          <Knopf leise aus={!frage.trim() || !!laeuft} onClick={() => lauf('frage')}>Fragen</Knopf>
        </div>
        {bericht?.modus === 'frage' && bericht.antwort.antwort && <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginTop: 10, whiteSpace: 'pre-wrap' }}>{bericht.antwort.antwort}</p>}
        {bericht && bericht.antwort.befunde.length > 0 && (
          <div style={{ display: 'grid', gap: 4, marginTop: 10 }}>
            {bericht.antwort.befunde.map((b, j) => <div key={j} style={{ fontSize: 12.5, color: C.inkDim }}><b style={{ color: C.ink, fontWeight: 600 }}>{b.titel}:</b> {b.text}</div>)}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <button onClick={async () => { if (sicht) return setSicht(null); const r = await fetch(`/api/heads/${head}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'daten', modus: standardModus }) }).then(x => x.json()).catch(() => null); setSicht(r?.ok ? JSON.stringify(r.daten, null, 1) : 'nicht erreichbar'); }}
            style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>{sicht ? 'Datenpaket ausblenden' : 'Was der Head sieht (Datenpaket)'}</button>
          {sicht && <pre style={{ maxHeight: 320, overflow: 'auto', fontSize: 11.5, color: C.inkDim, background: 'rgba(0,0,0,.25)', padding: 10, borderRadius: 10, marginTop: 6 }}>{sicht}</pre>}
        </div>
        {bericht && bericht.pruefung.gestrichen.length > 0 && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Gestrichen: {bericht.pruefung.gestrichen.map(g => `„${g.titel}“ (${g.grund})`).join(' · ')}</div>}
      </details>
    </Karte>
  );
}
