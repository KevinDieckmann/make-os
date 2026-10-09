'use client';

// ─── Gesundheit: eigene Unterlagen (09.10.; Auftrag: „… Oder eine Datei hochgeladen werden kann.“) ─────────────────────────────────────────
// Hochladen, Liste, Herunterladen, Löschen — NUR die eigenen (die Route liefert nichts anderes; Trennung serverseitig). Daten nur über
// /api/gesundheit/unterlagen. Ohne Einwilligung (a) speichert der Server nichts (403) — die Karte zeigt dann den Weg zur Einwilligung.
// Ob der Gesundheits-Agent den Text lesen darf (Einwilligung (b)), sagt `ki.an` — die Karte nennt es ruhig. Eingebettet unter Gesundheit
// (Kachel „unterlagen“, nur in der EIGENEN Ansicht) und im Agenten-Bereich beim Gesundheits-Head (Info › Unterlagen). Bausteine aus ../ui.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, ABSTAND, TYP, ZIEL } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { groesseText, MAX_UNTERLAGE_BYTES, UNTERLAGEN_ANNEHMEN, type Unterlage } from '@/lib/gesundheit/unterlagen';
import { Hinweis, Knopf, Leer, Liste, Zeile, useRueckfrage } from '../ui';

interface Stand { unterlagen: Unterlage[]; ki: { an: boolean } }
const PFAD = '/api/gesundheit/unterlagen';
const tag = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
const art = (typ: string) => (typ === 'application/pdf' ? 'PDF' : typ.startsWith('image/') ? 'Bild' : 'Text');

export function UnterlagenKarte({ kurz = false }: { kurz?: boolean }) {
  const [s, setS] = useState<Stand | null>(null);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'achtung' | 'kritisch' } | null>(null);
  const [einwilligung, setEinwilligung] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const waehler = useRef<HTMLInputElement>(null);
  const { bestaetigen, dialog } = useRueckfrage();

  const laden = useCallback(async () => {
    const d = await fetch(PFAD, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null) as ({ ok?: boolean } & Stand) | null;
    setLadeFehler(!d?.ok);
    if (d?.ok) setS({ unterlagen: d.unterlagen, ki: d.ki });
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const hochladen = async (liste: FileList) => {
    const dateien = Array.from(liste);
    if (!dateien.length) return;
    setMeldung(null);
    setLaeuft(true);
    const probleme: string[] = [];
    let gut = 0;
    for (const f of dateien) {
      if (f.size > MAX_UNTERLAGE_BYTES) { probleme.push(`„${f.name}“ ist zu groß (höchstens ${MAX_UNTERLAGE_BYTES / 1024 / 1024} MB).`); continue; }
      const form = new FormData();
      form.append('datei', f, f.name);
      const r = await fetch(PFAD, { method: 'POST', body: form }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) as { ok?: boolean; fehler?: string; einwilligung?: string } : { fehler: 'Keine Verbindung.' };
      if (d.einwilligung === 'gesundheit') { setEinwilligung(true); break; }
      if (!r?.ok || !d.ok) probleme.push(`„${f.name}“: ${d.fehler ?? 'nicht gespeichert.'}`); else gut++;
    }
    setLaeuft(false);
    if (probleme.length) setMeldung({ text: probleme.join(' '), art: 'kritisch' });
    else if (gut) setMeldung({ text: gut === 1 ? 'Gespeichert — verschlüsselt, nur für dich.' : `${gut} Unterlagen gespeichert — verschlüsselt, nur für dich.`, art: 'gut' });
    if (gut) await laden();
  };

  const entfernen = async (u: Unterlage) => {
    if (!(await bestaetigen({ titel: `„${u.name}“ löschen?`, text: 'Die Datei ist danach weg — auch der Gesundheits-Agent liest sie nicht mehr.', ja: 'Löschen', gefahr: true }))) return;
    const r = await fetch(`${PFAD}?id=${encodeURIComponent(u.id)}`, { method: 'DELETE' }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) as { ok?: boolean; fehler?: string } : { fehler: 'Keine Verbindung.' };
    setMeldung(r?.ok && d.ok ? { text: `„${u.name}“ gelöscht.`, art: 'gut' } : { text: d.fehler ?? 'Nicht gelöscht.', art: 'kritisch' });
    await laden();
  };

  return (
    <div style={{ display: 'grid', gap: ABSTAND.m, minWidth: 0 }}>
      {!kurz && <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.55 }}>Arztbrief, Laborwerte, Trainingsplan — als PDF, Bild oder Text. Verschlüsselt gespeichert, nur für dich; auch wer Gesundheit mit dir teilt, sieht sie nicht.</div>}
      {s && (s.ki.an
        ? <Hinweis art="info">Dein Gesundheits-Agent darf den Text lesen (Einwilligung „An die KI geben“) — nur, wenn er ihn für deine Frage braucht.</Hinweis>
        : <Hinweis art="info" aktion={<Link href={WEG.datenschutz('gesundheit')}>Einwilligung</Link>}>Gespeichert, aber nicht an die KI: der Gesundheits-Agent liest Unterlagen erst mit deiner Einwilligung (b) „An die KI geben“.</Hinweis>)}
      {einwilligung && <Hinweis art="achtung" titel="Erst die Einwilligung" aktion={<Link href={WEG.datenschutz('gesundheit')}>Zur Einwilligung</Link>}>Gesundheits-Unterlagen speichert MAKE OS erst, wenn du der Verarbeitung deiner Gesundheitsdaten (a) zugestimmt hast. Nichts gespeichert.</Hinweis>}
      {meldung && <Hinweis art={meldung.art} rolle={meldung.art === 'kritisch' ? 'alert' : 'status'}>{meldung.text}</Hinweis>}
      {ladeFehler && !s && <Hinweis art="achtung">Die Unterlagen lassen sich gerade nicht laden.</Hinweis>}
      {s && (s.unterlagen.length ? (
        <Liste>
          {s.unterlagen.map(u => (
            <Zeile key={u.id} titel={u.name} unter={`${art(u.typ)} · ${groesseText(u.groesse)} · ${tag(u.hochgeladen)}${u.notiz ? ` · ${u.notiz}` : ''}`}
              rechts={(
                <span style={{ display: 'inline-flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>
                  {/* Herunterladen ist keine Navigation (attachment) — ein schlichtes Download-Ziel, nie ein Link mit Vorabruf. */}
                  <a href={`${PFAD}?id=${encodeURIComponent(u.id)}`} download={u.name} className="ui-knopf fassbar" aria-label={`${u.name} herunterladen`} style={{ color: C.ink, textDecoration: 'none', fontSize: TYP.bedien, fontWeight: 600, padding: `0 ${ABSTAND.m}px`, minHeight: ZIEL.handy, display: 'inline-flex', alignItems: 'center' }}>Laden</a>
                  <Knopf leise onClick={() => entfernen(u)} ariaLabel={`${u.name} löschen`}>Löschen</Knopf>
                </span>
              )} />
          ))}
        </Liste>
      ) : <Leer symbol="📄">Noch keine Unterlage. PDF, PNG, JPG, HEIC, TXT oder Markdown — bis {MAX_UNTERLAGE_BYTES / 1024 / 1024} MB.</Leer>)}
      <div>
        <Knopf haupt onClick={() => waehler.current?.click()} aus={laeuft}>{laeuft ? 'Lädt hoch …' : 'Unterlage hochladen'}</Knopf>
        <input ref={waehler} type="file" multiple accept={UNTERLAGEN_ANNEHMEN} hidden aria-label="Unterlage auswählen" onChange={ev => { if (ev.target.files) void hochladen(ev.target.files); ev.target.value = ''; }} />
      </div>
      {dialog}
    </div>
  );
}
