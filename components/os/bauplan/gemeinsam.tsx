'use client';

// ─── Bauplan — gemeinsame Bausteine ─────────────────────────────────────────
// Daten (useBauplan: laden, alle 20 s abgleichen, eine Handlung = ein Aufruf),
// das Fenster (Dialog), Bilder (verkleinern, hochladen, zeigen) und das
// Erfassen-Formular — dasselbe im Bauplan und hinter dem Knopf auf jeder Seite.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../schlank';
import { Pillen } from '../crm/teile';
import { useAbgleich } from '@/hooks/useAbgleich';
import type { BacklogItem } from '@/lib/make-one/backlog-data';
import { ARTEN, BEREICHE, bereichAusSeite, type Art, type Etappe } from '@/lib/bauplan/board';

/** Eine neue Karte ist da (z. B. vom Knopf „Idee“) — ein offener Bauplan lädt nach. */
export const BAUPLAN_NEU = 'make-bauplan-neu';

export const ART_FARBE: Record<Art, string> = { fehler: LEUCHT.kritisch, verbesserung: LEUCHT.business, neu: LEUCHT.agenten, anbindung: LEUCHT.puls, frage: C.inkDim };
export const PRIO: { id: '1' | '2' | '3'; label: string }[] = [{ id: '1', label: 'Jetzt' }, { id: '2', label: 'Bald' }, { id: '3', label: 'Irgendwann' }];
export const klein = { fontSize: 12.5, color: C.inkLeise, lineHeight: 1.5 } as const;
export const titelKlein = { margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.08em', textTransform: 'uppercase' } as const;

export function useBauplan() {
  const [items, setItems] = useState<BacklogItem[] | null>(null);
  const [etappen, setEtappen] = useState<Etappe[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const unterwegs = useRef(0);
  const laden = useCallback(async () => {
    if (unterwegs.current) return;
    try {
      const d = await fetch('/api/bauplan', { cache: 'no-store' }).then(r => r.json());
      if (d.ok) { setItems(d.items); setEtappen(d.etappen ?? []); setFehler(null); }
    } catch { setFehler('Bauplan nicht erreichbar.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  // Kevin und Malin gleichzeitig: alle 20 Sekunden den Stand holen (nie während einer Änderung).
  useAbgleich(laden, { alle: 20_000, pausiert: () => unterwegs.current > 0 });
  /** Eine Handlung — optional sofort sichtbar (vorher), dann der echte Stand vom Server. */
  const tu = useCallback(async (body: Record<string, unknown>, vorher?: (l: BacklogItem[]) => BacklogItem[]) => {
    unterwegs.current++;
    if (vorher) setItems(l => (l ? vorher(l) : l));
    try {
      const r = await fetch('/api/bauplan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'keine Verbindung' }));
      if (!r.ok) setFehler(r.fehler ?? 'Nicht gespeichert.');
      return r as { ok: boolean; fehler?: string; karte?: BacklogItem; etappen?: Etappe[] };
    } finally { unterwegs.current--; void laden(); }
  }, [laden]);
  return { items, etappen, fehler, setFehler, laden, tu };
}

/** Ein Fenster über der Seite: Esc und Klick daneben schließen, am Handy ganzflächig. */
export function Fenster({ titel, onZu, children, breit = 720 }: { titel: ReactNode; onZu: () => void; children: ReactNode; breit?: number }) {
  const [schmal, setSchmal] = useState(false);
  useEffect(() => { const mq = window.matchMedia('(max-width: 640px)'); const an = () => setSchmal(mq.matches); an(); mq.addEventListener('change', an); return () => mq.removeEventListener('change', an); }, []);
  const zu = useRef(onZu); zu.current = onZu;
  // Nur ein Klick, der auch DANEBEN begonnen hat, schließt — wer Text markiert und dabei hinauszieht, verliert nichts.
  const daneben = useRef(false);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); zu.current(); } };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, []);
  return (
    <div onMouseDown={e => { daneben.current = e.target === e.currentTarget; }} onClick={e => { if (daneben.current && e.target === e.currentTarget) zu.current(); }} style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'rgba(5,7,8,.62)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: schmal ? 'stretch' : 'flex-start', padding: schmal ? 0 : '6vh 16px' }}>
      <div role="dialog" aria-modal="true"
        style={{ width: schmal ? '100%' : `min(${breit}px, 100%)`, maxHeight: schmal ? '100%' : '88vh', height: schmal ? '100%' : undefined, overflowY: 'auto', overscrollBehavior: 'contain',
          background: C.flaeche, borderRadius: schmal ? 0 : 18, border: schmal ? 'none' : '1px solid rgba(255,255,255,.07)', boxShadow: '0 30px 80px -20px rgba(0,0,0,.8)',
          padding: schmal ? '14px 16px max(20px, env(safe-area-inset-bottom))' : '18px 22px 22px', color: C.ink, fontFamily: SCHRIFT.text, display: 'grid', gap: 14, alignContent: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontFamily: SCHRIFT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3, minWidth: 0, flex: 1 }}>{titel}</h2>
          <button onClick={onZu} aria-label="Schließen" className="fassbar" style={{ width: 40, height: 40, flex: '0 0 auto', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.inkDim, fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Bild verkleinern (höchstens 1600 px, JPEG) — ein Bildschirmfoto wird so rund 200–400 KB groß. */
async function verkleinern(datei: Blob): Promise<string> {
  const url = URL.createObjectURL(datei);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const f = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

export async function bildHochladen(datei: Blob): Promise<{ name?: string; fehler?: string }> {
  try {
    const daten = await verkleinern(datei);
    const r = await fetch('/api/bauplan/bild', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ daten }) }).then(x => x.json());
    return r.ok ? { name: r.name } : { fehler: r.fehler ?? 'Nicht hochgeladen.' };
  } catch { return { fehler: 'Das Bild ließ sich nicht lesen.' }; }
}

export const bildUrl = (name: string) => `/api/bauplan/bild?name=${encodeURIComponent(name)}`;

/** Bilder einer Karte: Vorschau, groß ansehen, entfernen, hinzufügen (Datei, Kamera oder Einfügen). */
export function Bilder({ namen, onAendern, max = 4 }: { namen: string[]; onAendern?: (n: string[]) => void; max?: number }) {
  const [gross, setGross] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const dazu = async (dateien: Blob[]) => {
    if (!onAendern) return;
    setLaeuft(true); setFehler(null);
    const neu: string[] = [];
    for (const d of dateien.slice(0, max - namen.length)) { const r = await bildHochladen(d); if (r.name) neu.push(r.name); else setFehler(r.fehler ?? null); }
    setLaeuft(false);
    if (neu.length) onAendern([...namen, ...neu]);
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {namen.map(n => (
          <div key={n} style={{ position: 'relative' }}>
            <button onClick={() => setGross(n)} aria-label="Bild groß ansehen" style={{ padding: 0, border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, overflow: 'hidden', cursor: 'zoom-in', background: 'none', display: 'block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bildUrl(n)} alt="Bildschirmfoto" style={{ width: 120, height: 80, objectFit: 'cover', display: 'block' }} />
            </button>
            {onAendern && <button onClick={() => onAendern(namen.filter(x => x !== n))} aria-label="Bild entfernen" style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,.7)', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>}
          </div>
        ))}
        {onAendern && namen.length < max && (
          <label className="fassbar" style={{ width: 120, height: 80, borderRadius: 10, border: '1px dashed rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: C.inkDim, fontSize: 12.5, textAlign: 'center', padding: 6 }}>
            {laeuft ? 'lädt …' : '+ Bild'}
            <input type="file" accept="image/*" multiple onChange={e => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void dazu(f); }} style={{ display: 'none' }} />
          </label>
        )}
      </div>
      {onAendern && <div style={klein}>Bildschirmfoto: Datei wählen oder einfach mit Cmd+V einfügen (höchstens {max}).</div>}
      {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}
      {gross && (
        <div onClick={() => setGross(null)} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.88)', display: 'grid', placeItems: 'center', padding: 20, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bildUrl(gross)} alt="Bildschirmfoto groß" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10 }} />
        </div>
      )}
      <EinfuegenHorcher aktiv={!!onAendern && namen.length < max} onBild={b => void dazu([b])} />
    </div>
  );
}

/** Cmd+V mit einem Bild in der Zwischenablage → hochladen (nur solange das Formular offen ist). */
function EinfuegenHorcher({ aktiv, onBild }: { aktiv: boolean; onBild: (b: Blob) => void }) {
  const ref = useRef(onBild); ref.current = onBild;
  useEffect(() => {
    if (!aktiv) return;
    const f = (e: ClipboardEvent) => { const b = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))?.getAsFile(); if (b) { e.preventDefault(); ref.current(b); } };
    window.addEventListener('paste', f);
    return () => window.removeEventListener('paste', f);
  }, [aktiv]);
  return null;
}

/**
 * Eine Karte anlegen — mit Auswahl statt Freitext, wo es geht: Art, Bereich
 * (aus der Seite vorbelegt), Dringlichkeit; dazu die Vorlage (Problem · Wunsch
 * · Warum · Fertig wenn) und Bildschirmfotos. Pflicht ist nur der Titel.
 */
export function ErfassenFormular({ seite, onFertig, onAbbruch }: { seite?: string; onFertig: (k: BacklogItem) => void; onAbbruch: () => void }) {
  const [f, setF] = useState({ titel: '', art: 'verbesserung' as Art, bereich: bereichAusSeite(seite), prio: '2' as '1' | '2' | '3', problem: '', wunsch: '', warum: '', fertigWenn: '' });
  const [bilder, setBilder] = useState<string[]>([]);
  const [mehr, setMehr] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const titelRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titelRef.current?.focus(); }, []);
  const anlegen = async () => {
    if (!f.titel.trim() || laeuft) return;
    setLaeuft(true); setFehler(null);
    const r = await fetch('/api/bauplan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'anlegen', ...f, prio: Number(f.prio), bilder, ...(seite ? { seite } : {}) }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'keine Verbindung' }));
    setLaeuft(false);
    if (r.ok && r.karte) onFertig(r.karte); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  const eingabe = { ...feld, fontSize: TYP.bedien, padding: '9px 12px' };
  const feldText = (k: 'problem' | 'wunsch' | 'warum' | 'fertigWenn', label: string, platz: string) => (
    <label style={{ display: 'grid', gap: 4 }}><span style={klein}>{label}</span>
      <textarea value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} rows={2} placeholder={platz} style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} /></label>
  );
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <input ref={titelRef} value={f.titel} onChange={e => setF({ ...f, titel: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !mehr)) { e.preventDefault(); void anlegen(); } }}
        placeholder="Was ist dir aufgefallen? (kurz)" aria-label="Titel" style={{ ...eingabe, fontSize: TYP.body, padding: '11px 14px' }} />
      <div><h3 style={titelKlein}>Art</h3><Pillen liste={ARTEN} aktiv={f.art} onWahl={art => setF({ ...f, art })} farbe={ART_FARBE[f.art]} /></div>
      <div><h3 style={titelKlein}>Bereich</h3><Pillen liste={BEREICHE.map(b => ({ id: b, label: b }))} aktiv={f.bereich} onWahl={bereich => setF({ ...f, bereich })} /></div>
      <div><h3 style={titelKlein}>Wie dringend?</h3><Pillen liste={PRIO} aktiv={f.prio} onWahl={prio => setF({ ...f, prio })} /></div>
      {!mehr ? (
        <button onClick={() => setMehr(true)} style={{ justifySelf: 'start', background: 'none', border: 'none', color: LEUCHT.business, cursor: 'pointer', fontSize: TYP.bedien, padding: 0, fontFamily: SCHRIFT.text }}>+ Genauer beschreiben (Problem, Wunsch, woran wir merken, dass es fertig ist)</button>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {feldText('problem', 'Was ist das Problem?', 'z. B. Beim Anlegen einer Person fehlt die Firma …')}
          {feldText('wunsch', 'Was wünschst du dir?', 'z. B. Firma direkt beim Anlegen auswählen')}
          {feldText('warum', 'Warum ist das wichtig?', 'z. B. Ich tippe jede Firma doppelt')}
          {feldText('fertigWenn', 'Fertig, wenn …', 'z. B. Ich lege eine Person an und die Firma ist gleich dabei')}
        </div>
      )}
      <div><h3 style={titelKlein}>Bildschirmfoto</h3><Bilder namen={bilder} onAendern={setBilder} /></div>
      {seite && <div style={klein}>Aufgefallen auf: {seite}</div>}
      {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Knopf aus={!f.titel.trim() || laeuft} onClick={() => void anlegen()}>{laeuft ? 'Speichert …' : 'In den Bauplan'}</Knopf>
        <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>
      </div>
    </div>
  );
}

/** Wer bin ich, wie heißen die anderen — für Daumen, Kommentare und „von“. */
export function useIch() {
  const [ich, setIch] = useState('');
  const [namen, setNamen] = useState<Record<string, string>>({ kevin: 'Kevin', malin: 'Malin' });
  useEffect(() => {
    fetch('/api/konto/ich').then(r => r.json()).then((d: { ich?: { speicher: string; name?: string }; andere?: { speicher: string; name?: string }[] }) => {
      if (!d.ich) return;
      setIch(d.ich.speicher);
      const vor = (n?: string, s?: string) => (n ?? '').split(' ')[0] || s || '';
      setNamen(n => ({ ...n, [d.ich!.speicher]: vor(d.ich!.name, d.ich!.speicher), ...Object.fromEntries((d.andere ?? []).map(a => [a.speicher, vor(a.name, a.speicher)])) }));
    }).catch(() => {});
  }, []);
  return { ich, namen };
}

export const datumKurz = (iso?: string) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '');
export const zeitpunkt = (iso?: string) => (iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

/** Kleiner runder Anfangsbuchstabe — wer die Karte angelegt hat. */
export function Kopf({ name, farbe = C.inkDim }: { name: string; farbe?: string }) {
  return <span title={name} style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: C.grund, background: farbe, flex: '0 0 auto' }}>{(name[0] ?? '?').toUpperCase()}</span>;
}
export const personFarbe = (p?: string) => (p === 'malin' ? LEUCHT.beziehung : p === 'kevin' ? LEUCHT.puls : LEUCHT.agenten);
