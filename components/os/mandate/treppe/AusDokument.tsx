'use client';

// ─── Produkte · Leistungstreppe — „Aus Dokument übernehmen“ (10.10.) ────────────────────────────────────────────────
// Datei hochladen (PDF, Word, PowerPoint, Markdown/Text) → der Head of Sales liest sie und legt einen Vorschlag in den Freigabe-Stapel
// (POST /api/crm/treppe/dokument). Die Vorschau zeigt jeden Teil mit Häkchen (Stufen, Stationen der Kundenreise, Felder der Positionierung);
// erst „Übernehmen“ schreibt — über den Stapel (POST /api/zoe/stapel, nur die angehakten Teile), „Verwerfen“ lehnt ihn ab. Ohne KI: der Hinweis
// auf die leere Vorlage. Die hochgeladene Datei wird nicht gespeichert.

import { useRef, useState } from 'react';
import { FARBE as C, TYP, TIEF } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, LEUCHT } from '../../ui';
import { Fenster } from '../../Fenster';
import { KiMarke } from '../../KiMarke';
import { vorschlagTeile } from '@/lib/crm/treppe-daten';
import { preisText } from '@/lib/crm/treppe';
import { TREPPE_EREIGNIS, type TreppeLage } from './daten';
import { farbeVonEbene } from './bausteine';

const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;

/** Knopf + Upload. Nach dem Lesen erscheint die Vorschau über der Kundenreise (die Lage lädt neu). */
export function AusDokument({ ki }: { ki: boolean }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'achtung' | 'kritisch'; text: string } | null>(null);
  const hochladen = async (datei: File) => {
    setLaeuft(true);
    try {
      const form = new FormData();
      form.append('datei', datei);
      const r = await fetch('/api/crm/treppe/dokument', { method: 'POST', body: form });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setMeldung({ art: 'gut', text: `Der Head of Sales hat einen Vorschlag gemacht${j.gekuerzt ? ' (das Dokument war lang — gelesen wurde der Anfang)' : ''}. Er steht jetzt oben zur Prüfung — angehakte Teile übernehmt ihr mit einem Klick.` });
        window.dispatchEvent(new Event(TREPPE_EREIGNIS));
      } else setMeldung({ art: j.ohneKi ? 'achtung' : 'kritisch', text: String(j.fehler ?? `Nicht gelesen (${r.status}).`) });
    } catch { setMeldung({ art: 'kritisch', text: 'Keine Verbindung — das Dokument wurde nicht gelesen.' }); }
    finally { setLaeuft(false); if (eingabe.current) eingabe.current.value = ''; }
  };
  return (
    <>
      <input ref={eingabe} type="file" accept=".pdf,.docx,.pptx,.md,.txt" hidden aria-hidden onChange={e => { const f = e.target.files?.[0]; if (f) void hochladen(f); }} />
      <Knopf leise aus={laeuft} titel={ki ? 'Der Head of Sales liest das Dokument und schlägt eine Treppe vor' : 'Ohne KI liest niemand das Dokument — die leere Vorlage geht immer'}
        onClick={() => { if (!ki) setMeldung({ art: 'achtung', text: 'Gerade ist keine KI verfügbar (Schlüssel, Guthaben oder ausgeschaltet) — legt die leere Vorlage an und füllt sie aus.' }); else eingabe.current?.click(); }}>
        {laeuft ? 'Head of Sales liest …' : 'Aus Dokument übernehmen'}
      </Knopf>
      {meldung && (
        <Fenster titel="Aus Dokument übernehmen" onZu={() => setMeldung(null)} breit={520}>
          <Hinweis art={meldung.art}>{meldung.text}</Hinweis>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}><Knopf onClick={() => setMeldung(null)}>Ok</Knopf></div>
        </Fenster>
      )}
    </>
  );
}

type Vorschlag = TreppeLage['vorschlaege'][number];

/** Die Vorschau eines offenen Vorschlags mit Feld-Häkchen — Übernehmen nur die angehakten Teile (Freigabe-Stapel). */
export function DokumentVorschau({ v }: { v: Vorschlag }) {
  const alle = vorschlagTeile(v.vorschlag);
  const [gewaehlt, setGewaehlt] = useState<ReadonlySet<string>>(() => new Set(alle));
  const [fehler, setFehler] = useState<string | null>(null);
  const umschalten = (t: string) => setGewaehlt(g => { const n = new Set(g); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const entscheiden = async (entscheidung: 'freigeben' | 'ablehnen') => {
    const r = await fetch('/api/zoe/stapel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      id: v.id, entscheidung, ...(entscheidung === 'freigeben' ? { stand: v.stand, eingabe: { auswahl: alle.filter(t => gewaehlt.has(t)) } } : { grund: 'In der Vorschau verworfen' }),
    }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || j.ok === false) { setFehler(String(j.error ?? j.fehler ?? 'Nicht übernommen — bitte noch einmal.')); return; }
    setFehler(null);
    window.dispatchEvent(new Event(TREPPE_EREIGNIS));
  };
  const zeile = (t: string, titel: string, unter?: string, farbe: string = C.aktiv) => (
    <label key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 12, cursor: 'pointer', background: gewaehlt.has(t) ? TIEF.flaeche(farbe) : 'transparent', border: `1px solid ${gewaehlt.has(t) ? TIEF.rand(farbe) : 'rgba(255,255,255,.08)'}`, minHeight: 44 }}>
      <input type="checkbox" checked={gewaehlt.has(t)} onChange={() => umschalten(t)} style={{ width: 20, height: 20, marginTop: 2, accentColor: farbe }} />
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}><span style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink }}>{titel}</span>{unter && <span style={{ ...klein, overflowWrap: 'anywhere' }}>{unter}</span>}</span>
    </label>
  );
  const n = alle.filter(t => gewaehlt.has(t)).length;
  return (
    <Karte i={1} ton={LEUCHT.achtung}>
      <Ueberschrift farbe={LEUCHT.achtung} rechts={<span style={{ display: 'flex', gap: 8 }}><Knopf leise onClick={() => entscheiden('ablehnen')}>Verwerfen</Knopf><Knopf aus={!n} onClick={() => entscheiden('freigeben')}>Übernehmen ({n})</Knopf></span>}>Vorschlag aus „{v.datei || 'Dokument'}“</Ueberschrift>
      <div style={{ ...klein, marginBottom: 10 }}>Der Head of Sales hat das Dokument gelesen. Hakt ab, was in die Leistungstreppe soll — Stufen kommen neu dazu (nie überschrieben), Felder der Positionierung ersetzen die vorhandenen. <KiMarke /></div>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <div style={{ display: 'grid', gap: 8 }}>
        {v.vorschlag.stufen.map((s, i) => zeile(`stufe:${i}`, `Stufe ${s.ebene}: ${s.name}`, [preisText(s.preis), s.dauerTage ? `${s.dauerTage} Tage` : '', s.aufgabe ?? '', s.lieferobjekte.length ? `${s.lieferobjekte.length} Lieferobjekte` : ''].filter(Boolean).join(' · '), farbeVonEbene(s.ebene)))}
        {v.vorschlag.kreislauf.map((s, i) => zeile(`station:${i}`, `Kundenreise: ${s.name}`, s.messgroesse))}
        {(Object.entries(v.vorschlag.positionierung) as [string, string][]).map(([f, w]) => zeile(`pos:${f}`, `Positionierung: ${f === 'zielgruppe' ? 'Zielgruppe' : f === 'claim' ? 'Claim' : f === 'problem' ? 'Problem' : f === 'versprechen' ? 'Versprechen' : 'Story'}`, w.length > 220 ? `${w.slice(0, 219)}…` : w, LEUCHT.business))}
      </div>
    </Karte>
  );
}
