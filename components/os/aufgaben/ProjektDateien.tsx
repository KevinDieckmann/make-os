'use client';
// ─── Dateien an Projekt und Aufgabe (28.09., Paket C2) ───────────────────────
// Kevin: „Mit Dateien, Uploads etc. — da muss alles möglich sein.“ Ziehen & Ablegen oder Knopf, Liste mit Typ,
// Größe, wer/wann, Vorschau (Bild über eine Blob-URL, PDF im neuen Tab), Umbenennen, Beschreibung, Löschen mit
// Rückfrage. Server: /api/aufgaben/dateien (verschlüsselt je Haushalt, eigener Bestand — nie die CRM-Ablage).
// Privat und Business bleiben getrennt: `space` geht als Bereich mit, der Server prüft ihn gegen den Space.
// Dateien einer Aufgabe schreiben ihren Verlauf („Datei hinzugefügt/entfernt“) — danach lädt der Aufgaben-Stand neu.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { Download, Eye, File as DateiIcon, FileImage, FileSpreadsheet, FileText, Paperclip, Pencil, Presentation, Trash2, Upload } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { groesseText, type DateiEintrag } from '@/lib/dateien/regeln';
import { AUFGABEN_ANNEHMEN, AUFGABEN_TYPEN, MAX_AUFGABEN_DATEI_BYTES, TYP_LABEL, typGruppe, vorschauArt, type TypGruppe } from '@/lib/dateien/aufgaben-regeln';

type Eintrag = DateiEintrag & { datei: NonNullable<DateiEintrag['datei']> };
const WEG = '/api/aufgaben/dateien';
const ENDUNGEN = new Set<string>(Object.values(AUFGABEN_TYPEN).flat());

const ICON: Record<TypGruppe, typeof DateiIcon> = { pdf: FileText, bild: FileImage, word: FileText, excel: FileSpreadsheet, praesentation: Presentation, tabelle: FileSpreadsheet, text: DateiIcon };
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const leise: CSSProperties = { background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: C.inkDim, display: 'inline-flex', alignItems: 'center', borderRadius: 8 };
const eingabe: CSSProperties = { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: C.ink, fontFamily: SCHRIFT.text, fontSize: 13, padding: '5px 8px', minWidth: 0, flex: 1 };
const wann = (iso: string) => { try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return iso.slice(0, 10); } };
const person = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const endungVon = (n: string) => (/\.([a-z0-9]{1,5})$/i.exec(n)?.[1] ?? '').toLowerCase();

/** Vor dem Hochladen im Browser prüfen (der Server prüft am Inhalt noch einmal). */
function vorpruefen(f: File): string | null {
  if (!ENDUNGEN.has(endungVon(f.name))) return `„${f.name}“: dieser Typ geht nicht — PDF, Bilder, Word, Excel, PowerPoint, CSV, TXT oder Markdown.`;
  if (f.size > MAX_AUFGABEN_DATEI_BYTES) return `„${f.name}“ ist zu groß (höchstens ${MAX_AUFGABEN_DATEI_BYTES / 1024 / 1024} MB).`;
  if (!f.size) return `„${f.name}“ ist leer.`;
  return null;
}

/** `listeId` (30.09.): nur die Dateien an dieser Liste des Projekts — so zeigt der Meilenstein seine Dateien. */
export function ProjektDateien({ projektId, aufgabeId, listeId, space }: { projektId: string; aufgabeId?: string; listeId?: string; space: 'privat' | 'business' }) {
  const { rehydrate } = useTasks();
  const [eintraege, setEintraege] = useState<Eintrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(0);
  const [ziehen, setZiehen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<{ id: string; name: string; notiz: string } | null>(null);
  const [loeschen, setLoeschen] = useState<string | null>(null);
  const [bild, setBild] = useState<{ url: string; name: string } | null>(null);
  const etag = useRef<string | null>(null);
  const waehler = useRef<HTMLInputElement>(null);
  const abfrage = aufgabeId ? `aufgabeId=${encodeURIComponent(aufgabeId)}` : `projektId=${encodeURIComponent(projektId)}${listeId ? `&listeId=${encodeURIComponent(listeId)}` : ''}`;

  const laden = useCallback(async (frisch = false) => {
    try {
      const r = await fetch(`${WEG}?${abfrage}`, { cache: 'no-store', headers: !frisch && etag.current ? { 'If-None-Match': etag.current } : {} });
      if (r.status === 304) return;
      const d = await r.json().catch(() => ({ ok: false, fehler: 'Antwort nicht lesbar.' }));
      if (!r.ok || !d.ok) { setFehler(d.fehler ?? 'Dateien nicht erreichbar.'); setEintraege(e => e ?? []); return; }
      etag.current = r.headers.get('etag');
      setEintraege(d.eintraege);
    } catch { setFehler('Keine Verbindung.'); setEintraege(e => e ?? []); }
  }, [abfrage]);

  useEffect(() => { etag.current = null; setEintraege(null); void laden(true); }, [laden]);
  // Blob-URL der Bildvorschau wieder freigeben.
  useEffect(() => () => { if (bild) URL.revokeObjectURL(bild.url); }, [bild]);

  const nachAenderung = async (verlaufGeaendert: boolean) => {
    await laden(true);
    // Der Verlauf der Aufgabe hat sich geändert (und damit ihr Stand) — sonst gäbe die nächste Änderung 409.
    if (verlaufGeaendert && aufgabeId) await rehydrate().catch(() => {});
  };

  const hochladen = async (liste: FileList | File[]) => {
    const dateien = Array.from(liste);
    if (!dateien.length) return;
    setFehler(null);
    const probleme: string[] = [];
    let gut = 0;
    setLaeuft(n => n + dateien.length);
    for (const f of dateien) {
      try {
        const p = vorpruefen(f);
        if (p) { probleme.push(p); continue; }
        const form = new FormData();
        form.append('datei', f, f.name);
        // An einer Aufgabe bestimmt der Server das Projekt aus der Aufgabe (auch „Sonstige“) — nur der Bereich geht zur Prüfung mit.
        form.append('meta', JSON.stringify({ ...(aufgabeId ? { aufgabeId } : { projektId, ...(listeId ? { listeId } : {}) }), bereich: space }));
        const r = await fetch(WEG, { method: 'POST', body: form });
        const d = await r.json().catch(() => ({ ok: false, fehler: `Hochladen fehlgeschlagen (${r.status}).` }));
        if (!r.ok || !d.ok) probleme.push(`„${f.name}“: ${d.fehler ?? 'nicht gespeichert.'}`); else gut++;
      } catch { probleme.push(`„${f.name}“: keine Verbindung.`); }
      finally { setLaeuft(n => n - 1); }
    }
    if (probleme.length) setFehler(probleme.join(' '));
    if (gut) await nachAenderung(true);
  };

  const speichern = async () => {
    if (!bearbeiten) return;
    const r = await fetch(WEG, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bearbeiten.id, felder: { name: bearbeiten.name, notiz: bearbeiten.notiz } }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht gespeichert.'); return; }
    setBearbeiten(null);
    await laden(true);
  };

  const entfernen = async (id: string) => {
    const r = await fetch(`${WEG}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLoeschen(null);
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht gelöscht.'); return; }
    await nachAenderung(true);
  };

  const ansehen = async (e: Eintrag) => {
    const art = vorschauArt(e.datei.typ);
    if (!art) return;
    // PDF: das Fenster sofort öffnen (sonst blockt der Browser das Popup), dann die Blob-URL hineinladen.
    const fenster = art === 'pdf' ? window.open('', '_blank') : null;
    try {
      const r = await fetch(`${WEG}?id=${encodeURIComponent(e.id)}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const blob = new Blob([await r.arrayBuffer()], { type: e.datei.typ });
      const url = URL.createObjectURL(blob);
      if (art === 'bild') { setBild({ url, name: e.datei.name }); return; }
      if (fenster) { fenster.opener = null; fenster.location.href = url; }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { fenster?.close(); setFehler('Vorschau nicht möglich — bitte herunterladen.'); }
  };

  const fallen = (ev: DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    setZiehen(false);
    if (ev.dataTransfer?.files?.length) void hochladen(ev.dataTransfer.files);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Paperclip size={14} color={C.inkLeise} aria-hidden />
        <span style={mikro}>Dateien{eintraege?.length ? ` · ${eintraege.length}` : ''}</span>
      </div>

      <div
        onDragOver={ev => { ev.preventDefault(); setZiehen(true); }}
        onDragLeave={() => setZiehen(false)}
        onDrop={fallen}
        role="group"
        aria-label="Dateien hierher ziehen oder auswählen"
        style={{ border: `1px dashed ${ziehen ? C.aktiv : 'rgba(255,255,255,.14)'}`, background: ziehen ? C.aktivSanft : 'rgba(255,255,255,.02)', borderRadius: 12, padding: '14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', transition: 'background .15s ease, border-color .15s ease' }}
      >
        <span style={{ fontFamily: SCHRIFT.text, fontSize: 13, color: C.inkDim }}>{laeuft ? `Lade hoch … (${laeuft})` : 'Dateien hierher ziehen oder'}</span>
        <button type="button" className="fassbar" onClick={() => waehler.current?.click()} disabled={laeuft > 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '7px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: C.ink, cursor: laeuft ? 'progress' : 'pointer' }}>
          <Upload size={14} aria-hidden /> Auswählen
        </button>
        <input ref={waehler} type="file" multiple accept={AUFGABEN_ANNEHMEN} hidden onChange={ev => { if (ev.target.files) void hochladen(ev.target.files); ev.target.value = ''; }} />
        <span style={{ width: '100%', textAlign: 'center', fontFamily: SCHRIFT.text, fontSize: 11.5, color: C.inkLeise }}>
          PDF, Bilder, Word, Excel, PowerPoint, CSV, TXT, Markdown · bis {MAX_AUFGABEN_DATEI_BYTES / 1024 / 1024} MB · verschlüsselt{space === 'privat' ? ' · privat' : ''}
        </span>
      </div>

      {fehler && <div role="alert" style={{ fontFamily: SCHRIFT.text, fontSize: 12.5, color: C.kritisch }}>{fehler}</div>}

      {eintraege === null ? (
        <div style={{ fontFamily: SCHRIFT.text, fontSize: 12.5, color: C.inkLeise }}>Lade Dateien …</div>
      ) : !eintraege.length ? (
        <div style={{ fontFamily: SCHRIFT.text, fontSize: 12.5, color: C.inkLeise }}>Noch keine Dateien.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {eintraege.map(e => {
            const g = typGruppe(e.datei.typ);
            const Icon = ICON[g];
            const vorschau = vorschauArt(e.datei.typ);
            const inBearbeitung = bearbeiten?.id === e.id;
            return (
              <li key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.linieWeich}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Icon size={18} color={C.inkDim} aria-label={TYP_LABEL[g]} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div title={e.datei.name} style={{ fontFamily: SCHRIFT.text, fontSize: 13.5, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.datei.name}</div>
                    <div style={{ fontFamily: SCHRIFT.text, fontSize: 11.5, color: C.inkLeise }}>
                      {TYP_LABEL[g]} · {groesseText(e.datei.groesse)} · {person(e.hochgeladenVon)} · {wann(e.hochgeladenAm)}{!aufgabeId && e.aufgabeId ? ' · an einer Aufgabe' : ''}
                    </div>
                    {e.notiz && !inBearbeitung && <div style={{ fontFamily: SCHRIFT.text, fontSize: 12, color: C.inkDim, marginTop: 2 }}>{e.notiz}</div>}
                  </div>
                  {vorschau && <button type="button" style={leise} onClick={() => void ansehen(e)} title={vorschau === 'pdf' ? 'Im neuen Tab ansehen' : 'Vorschau'} aria-label={`${e.datei.name} ansehen`}><Eye size={15} /></button>}
                  <a href={`${WEG}?id=${encodeURIComponent(e.id)}`} download={e.datei.name} style={leise} title="Herunterladen" aria-label={`${e.datei.name} herunterladen`}><Download size={15} /></a>
                  <button type="button" style={leise} onClick={() => setBearbeiten(inBearbeitung ? null : { id: e.id, name: e.datei.name, notiz: e.notiz ?? '' })} title="Umbenennen / Beschreibung" aria-label={`${e.datei.name} umbenennen`}><Pencil size={15} /></button>
                  <button type="button" style={{ ...leise, color: loeschen === e.id ? C.kritisch : C.inkDim }} onClick={() => setLoeschen(loeschen === e.id ? null : e.id)} title="Löschen" aria-label={`${e.datei.name} löschen`}><Trash2 size={15} /></button>
                </div>
                {inBearbeitung && bearbeiten && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input aria-label="Dateiname" value={bearbeiten.name} maxLength={120} onChange={ev => setBearbeiten({ ...bearbeiten, name: ev.target.value })} style={eingabe} />
                    <input aria-label="Beschreibung" placeholder="Beschreibung (optional)" value={bearbeiten.notiz} maxLength={600} onChange={ev => setBearbeiten({ ...bearbeiten, notiz: ev.target.value })} style={eingabe} />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" style={{ ...leise, padding: '5px 10px' }} onClick={() => setBearbeiten(null)}>Abbrechen</button>
                      <button type="button" style={{ ...leise, padding: '5px 10px', color: C.aktiv, fontWeight: 700 }} onClick={() => void speichern()}>Speichern</button>
                    </div>
                  </div>
                )}
                {loeschen === e.id && (
                  <div role="alertdialog" aria-label="Löschen bestätigen" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: SCHRIFT.text, fontSize: 12.5, color: C.ink }}>
                    <span style={{ flex: 1 }}>„{e.datei.name}“ endgültig löschen? Das lässt sich nicht rückgängig machen.</span>
                    <button type="button" style={{ ...leise, padding: '5px 10px' }} onClick={() => setLoeschen(null)}>Behalten</button>
                    <button type="button" style={{ ...leise, padding: '5px 10px', color: C.kritisch, fontWeight: 700 }} onClick={() => void entfernen(e.id)}>Löschen</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {bild && (
        <div role="dialog" aria-label={`Vorschau ${bild.name}`} onClick={() => setBild(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Blob-URL einer verschlüsselt abgelegten Datei, kein optimierbares Bild */}
          <img src={bild.url} alt={bild.name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }} />
        </div>
      )}
    </div>
  );
}

