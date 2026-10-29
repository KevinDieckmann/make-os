'use client';

// ─── Markttraktion · Social — Fotos und Videos eines Beitrags (28.10.2026, Malin-Paket) ─────────────────────────────────────────────────
// Ein Beitrag trägt nur Kennungen aus der EINEN Medien-Ablage (Business). Hier: wählen (aus der Ablage, am Handy antippen), anordnen (▲▼),
// entfernen, sehen, ob jedes Medium raus darf (Freigabe „Social Media“ — Status kommt vom Server, `lage.medien`), und mit einem Tipp in die
// Reel-Werkstatt schicken. Freigeben selbst geschieht in der Ablage bzw. am Werkstatt-Ergebnis — nie hier still.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP, LEUCHT, ECKE } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { Knopf, Chip, Hinweis, Leer } from '../../ui';
import type { SocialMedium } from '@/lib/social/medien';

/** Eintrag der Ablage, wie `/api/medien` ihn liefert (nur die Felder, die Social braucht). */
export interface AblageMedium {
  id: string; art: 'bild' | 'video'; bereich: 'business' | 'privat'; name?: string; typ: string; dauerSek?: number; ton?: string;
  varianten: string[]; geloeschtAm?: string; abgeleitetVon?: { art: string };
  marketing: { wirksam: string; kanaele?: string[] };
  urheber: { art: string };
  albumTitel?: string;
}

export const vorschauUrl = (id: string, v: 'raster' | 'poster' | 'ansicht' | 'original' = 'raster') => `/api/medien/inhalt?id=${encodeURIComponent(id)}&v=${v}`;

/** Die Business-Ablage (nur lesen) — einmal laden, bei Bedarf neu. */
export function useAblage(an: boolean) {
  const [medien, setMedien] = useState<AblageMedium[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/medien', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { setFehler(j.fehler ?? 'Die Ablage ließ sich nicht laden.'); return; }
      setMedien((j.medien as AblageMedium[]).filter(m => m.bereich === 'business' && !m.geloeschtAm));
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => { if (an && !medien) void laden(); }, [an, medien, laden]);
  return { medien, fehler, laden };
}

const freigegebenSocial = (m: Pick<AblageMedium, 'marketing'>) => m.marketing.wirksam === 'freigegeben' && (m.marketing.kanaele ?? []).includes('social');

/** Kleines Vorschaubild (Raster, beim Video das Poster) — ohne Varianten ein ruhiges Feld mit Symbol. */
export function Vorschau({ id, art, varianten, groesse = 72 }: { id: string; art: 'bild' | 'video'; varianten?: string[]; groesse?: number }) {
  const v = varianten?.includes('raster') ? 'raster' : varianten?.includes('poster') ? 'poster' : art === 'bild' && !varianten ? 'raster' : null;
  return (
    <div style={{ width: groesse, height: Math.round(groesse * 1.25), borderRadius: ECKE.eingabe, background: C.flaeche, overflow: 'hidden', display: 'grid', placeItems: 'center', flexShrink: 0, position: 'relative' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- verschlüsseltes Medium aus der eigenen Ablage */}
      {v ? <img src={vorschauUrl(id, v)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> : <span aria-hidden style={{ color: C.inkLeise, fontSize: 20 }}>{art === 'video' ? '▶' : '◻'}</span>}
      {art === 'video' && v && <span aria-hidden style={{ position: 'absolute', right: 4, bottom: 4, color: '#fff', fontSize: 12, textShadow: '0 0 4px #000' }}>▶</span>}
    </div>
  );
}

function StatusChip({ m }: { m: SocialMedium | null | undefined }) {
  if (!m) return <Chip farbe={LEUCHT.kritisch}>fehlt</Chip>;
  if (m.status !== 'freigegeben') return <Chip farbe={LEUCHT.achtung}>{m.status === 'angefragt' ? 'Freigabe angefragt' : m.status === 'gesperrt' ? 'gesperrt' : m.status === 'abgelaufen' ? 'abgelaufen' : 'nicht freigegeben'}</Chip>;
  if (!m.social) return <Chip farbe={LEUCHT.achtung}>nicht für Social</Chip>;
  return <Chip farbe={LEUCHT.gut}>darf raus</Chip>;
}

/** Medien am Beitrag (im Folgen-Editor). `medien` = gewählte Kennungen (Reihenfolge), `info` = Lese-Form vom Server. */
export function FolgeMedien({ medien, setMedien, info, onWerkstatt }: {
  medien: string[]; setMedien: (l: string[]) => void; info: Record<string, SocialMedium | null>; onWerkstatt?: () => void;
}) {
  const [waehlen, setWaehlen] = useState(false);
  const ablage = useAblage(waehlen || medien.some(id => !(id in info)));
  const nachId = new Map((ablage.medien ?? []).map(m => [m.id, m] as const));
  const schiebe = (i: number, d: -1 | 1) => { const l = [...medien]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setMedien(l); };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: TYP.bedien }}>Fotos und Videos</strong>
        <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Reel = ein Video aus der Werkstatt · Karussell = 2–20 · Bild = eins (Instagram: JPEG)</span>
      </div>
      {medien.length > 0 && (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {medien.map((id, i) => {
            const m = info[id] ?? null;
            const a = nachId.get(id);
            return (
              <div key={id} style={{ display: 'grid', gap: 6, justifyItems: 'center', minWidth: 88 }}>
                <Vorschau id={id} art={m?.art ?? a?.art ?? 'bild'} varianten={a?.varianten} />
                <StatusChip m={m ?? (a ? { id, art: a.art, typ: a.typ, ki: a.urheber.art === 'ki', schnitt: a.abgeleitetVon?.art === 'schnitt', status: a.marketing.wirksam as SocialMedium['status'], social: (a.marketing.kanaele ?? []).includes('social'), geloescht: false } : null)} />
                <div style={{ display: 'flex', gap: 2 }}>
                  <Knopf leise onClick={() => schiebe(i, -1)} ariaLabel="nach vorn">◀</Knopf>
                  <Knopf leise onClick={() => setMedien(medien.filter(x => x !== id))} ariaLabel="entfernen">✕</Knopf>
                  <Knopf leise onClick={() => schiebe(i, 1)} ariaLabel="nach hinten">▶</Knopf>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Knopf onClick={() => setWaehlen(w => !w)}>{waehlen ? 'Auswahl schließen' : '+ Aus der Medien-Ablage'}</Knopf>
        {onWerkstatt && <Knopf onClick={onWerkstatt}>In der Werkstatt schneiden</Knopf>}
        <Knopf leise href={WEG.medien({ aufnehmen: true })}>Neue Fotos/Videos aufnehmen</Knopf>
      </div>
      {waehlen && <AblageWahl ablage={ablage} gewaehlt={medien} onWahl={id => setMedien(medien.includes(id) ? medien.filter(x => x !== id) : [...medien, id])} />}
    </div>
  );
}

/** Raster der Business-Ablage zum Antippen. Vorgabe: nur, was für Social freigegeben ist — umschaltbar auf „alle“ (z. B. Rohclips für die Werkstatt). */
export function AblageWahl({ ablage, gewaehlt, onWahl, alleVorgabe = false }: {
  ablage: ReturnType<typeof useAblage>; gewaehlt: readonly string[]; onWahl: (id: string) => void; alleVorgabe?: boolean;
}) {
  const [alle, setAlle] = useState(alleVorgabe);
  if (ablage.fehler) return <Hinweis art="achtung">{ablage.fehler}</Hinweis>;
  if (!ablage.medien) return <span style={{ color: C.inkLeise }}>Lädt …</span>;
  const liste = ablage.medien.filter(m => alle || freigegebenSocial(m));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, fontSize: TYP.bedien, color: C.inkDim }}>
        <input type="checkbox" checked={alle} onChange={e => setAlle(e.target.checked)} /> auch noch nicht freigegebene zeigen (Rohmaterial für die Werkstatt)
      </label>
      {liste.length === 0
        ? <Leer>{alle ? 'Die Business-Ablage ist leer — unter Medien aufnehmen oder hochladen.' : 'Noch nichts für Social freigegeben — in der Medien-Ablage freigeben oder „auch noch nicht freigegebene“ zeigen.'}</Leer>
        : <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
          {liste.map(m => {
            const an = gewaehlt.includes(m.id);
            return (
              <button key={m.id} type="button" onClick={() => onWahl(m.id)} aria-pressed={an}
                style={{ display: 'grid', gap: 4, justifyItems: 'center', padding: 6, minHeight: 44, borderRadius: ECKE.eingabe, border: `2px solid ${an ? C.aktiv : 'transparent'}`, background: 'transparent', cursor: 'pointer', color: C.ink }}>
                <Vorschau id={m.id} art={m.art} varianten={m.varianten} />
                <span style={{ fontSize: TYP.bedien, color: C.inkLeise, maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.art === 'video' ? `${Math.round(m.dauerSek ?? 0)} s` : 'Foto'}{freigegebenSocial(m) ? ' · ✓' : ''}
                </span>
              </button>
            );
          })}
        </div>}
    </div>
  );
}
