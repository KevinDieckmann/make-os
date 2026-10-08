'use client';

// ─── Fotos & Videos — Aufnehmen und Auswählen (09.10., Paket 5) ──────────────────────────────────────────────────────────
// Kevin 09.10.: „System-Kamera + ‚Aus Mediathek‘“ · „Album vorbelegt (‚Heute bei …‘), danach änderbar“ · „Ton standardmäßig aus (§ 201 StGB)“
// · „Empfehlung 1080p/30 HEVC; 4K nur bei ‚Original‘“ · „Videos starten nur auf Knopfdruck“.
// Zwei Datei-Felder: Kamera (`capture`) und Mediathek (`multiple`). `image/heic` steht bewusst NICHT in `accept` — dann liefert iOS JPEG.
// Nach der Wahl: ein Blatt mit Bereich, Album, Ton, Original, „Erkennbare Personen?“ — dann wird vorbereitet (Exif/GPS raus, Ort- und
// Ton-Spuren im Video genullt, Vorschauen per Canvas), verschlüsselt auf dem Gerät abgelegt und gesendet.

import { useRef, useState } from 'react';
import { Camera, Images } from 'lucide-react';
import { Knopf, Hinweis, Schalter, Segmente, Feldzeile, auswahl } from '../ui';
import { Fenster } from '../Fenster';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { geteilteMedienSchlange } from '@/lib/medien/warteschlange';
import { TEXTE, KANTE_OHNE_ORIGINAL, type AlbumSichtEintrag, type Bereich } from '@/lib/medien/typen';
import { groesseText } from './daten';

const ACCEPT = 'image/jpeg,image/png,video/*';

export interface AufnehmenVorgabe { bereich: Bereich; album?: string; albumTitel?: string; /** Event-Album, das beim ersten Upload entsteht (auch ohne Netz aufgenommen). */ eventNeu?: { eventId: string; titel: string } }

/** Die zwei Knöpfe (Kamera, Mediathek). `haupt` = die Hauptaktion der Ansicht (48 px). */
export function AufnehmenKnoepfe({ vorgabe, alben, privat, ich, haupt, farbe }: { vorgabe: AufnehmenVorgabe; alben?: readonly AlbumSichtEintrag[]; privat: boolean; ich: string | null; haupt?: boolean; farbe?: string }) {
  const kamera = useRef<HTMLInputElement>(null);
  const mediathek = useRef<HTMLInputElement>(null);
  const [dateien, setDateien] = useState<File[] | null>(null);
  const gewaehlt = (l: FileList | null) => { if (l && l.length) setDateien(Array.from(l)); };
  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Knopf haupt={haupt} farbe={farbe} onClick={() => kamera.current?.click()} ariaLabel="Foto oder Video aufnehmen"><Camera size={18} aria-hidden /> Aufnehmen</Knopf>
        <Knopf leise onClick={() => mediathek.current?.click()} ariaLabel="Aus der Mediathek wählen"><Images size={18} aria-hidden /> Aus Mediathek</Knopf>
      </div>
      <input ref={kamera} type="file" accept={ACCEPT} capture="environment" hidden onChange={e => { gewaehlt(e.currentTarget.files); e.currentTarget.value = ''; }} />
      <input ref={mediathek} type="file" accept={ACCEPT} multiple hidden onChange={e => { gewaehlt(e.currentTarget.files); e.currentTarget.value = ''; }} />
      {dateien && <AufnehmenBlatt dateien={dateien} vorgabe={vorgabe} alben={alben ?? []} privat={privat} ich={ich} onZu={() => setDateien(null)} />}
    </>
  );
}

function AufnehmenBlatt({ dateien, vorgabe, alben, privat, ich, onZu }: { dateien: File[]; vorgabe: AufnehmenVorgabe; alben: readonly AlbumSichtEintrag[]; privat: boolean; ich: string | null; onZu: () => void }) {
  const [bereich, setBereich] = useState<Bereich>(vorgabe.bereich);
  const [album, setAlbum] = useState<string>(vorgabe.album ?? '');
  const [ton, setTon] = useState(false);
  const [original, setOriginal] = useState(false);
  const [personen, setPersonen] = useState<'offen' | 'ja' | 'nein' | 'unklar'>('offen');
  const [extern, setExtern] = useState(false);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string[]>([]);
  const videos = dateien.filter(d => d.type.startsWith('video/') || /\.(mov|mp4|m4v)$/i.test(d.name));
  const passendeAlben = alben.filter(a => a.bereich === bereich);
  const gesamt = dateien.reduce((s, d) => s + d.size, 0);

  const los = async () => {
    const q = geteilteMedienSchlange();
    q.person ??= ich;
    const person = ich ?? q.person;
    const raus: string[] = [];
    const { vorbereiten } = await import('@/lib/medien/vorbereiten');
    for (const [i, d] of dateien.entries()) {
      setLaeuft(`Bereite vor: ${i + 1} von ${dateien.length}`);
      try {
        const v = await vorbereiten(d, { tonBehalten: ton });
        if (v.art === 'video' && Math.max(v.meta.breite ?? 0, v.meta.hoehe ?? 0) > KANTE_OHNE_ORIGINAL && !original) { raus.push(`${d.name}: 4K-Video — nur mit „Original“ (oder in der Kamera 1080p/30 einstellen).`); continue; }
        const id = crypto.randomUUID();
        await q.ablegen({
          id, ...(person ? { person } : {}), bytes: v.bytes, daten: v.daten, datei: v.datei, patches: v.patches,
          vorschau: { raster: v.vorschau.raster, ...(v.vorschau.ansicht ? { ansicht: v.vorschau.ansicht } : {}), ...(v.vorschau.poster ? { poster: v.vorschau.poster } : {}) },
          anlegen: {
            typ: v.typ, bytes: v.bytes, bereich, ...(album ? { album } : {}), name: d.name.replace(/\.[^.]+$/, '').slice(0, 120),
            ...(album && vorgabe.eventNeu && album === vorgabe.album ? { albumNeu: { art: 'event', bezugId: vorgabe.eventNeu.eventId, titel: vorgabe.eventNeu.titel } } : {}),
            ...v.meta, ...(v.art === 'video' && ton ? { tonBestaetigt: true } : {}), ...(original ? { original: true } : {}),
            ...(personen !== 'offen' ? { erkennbarePersonen: personen } : {}), ...(extern ? { urheber: { art: 'extern' } } : {}),
          },
          anzeige: { name: d.name, art: v.art },
        }, anteil => setLaeuft(`Bereite vor: ${i + 1} von ${dateien.length} (${Math.round(anteil * 100)} %)`));
        if (v.art === 'video' && v.meta.ton === 'nicht-freigegeben') raus.push(`${d.name}: Die Tonspur ließ sich nicht entfernen — das Video wird nicht abgespielt und nicht geteilt, bis der Ton freigegeben ist.`);
        if (!v.meta.ortsdatenEntfernt) raus.push(`${d.name}: Ortsdaten ließen sich nicht sicher entfernen — es geht nicht ins Marketing.`);
      } catch (e) { raus.push(`${d.name}: ${e instanceof Error ? e.message : 'nicht lesbar'}`); }
    }
    setLaeuft(null);
    window.dispatchEvent(new Event('make-medien-neu'));
    if (raus.length) setFehler(raus); else onZu();
  };

  return (
    <Fenster titel={`${dateien.length === 1 ? '1 Datei' : `${dateien.length} Dateien`} hochladen · ${groesseText(gesamt)}`} onZu={onZu} breit={560}>
      <div style={{ display: 'grid', gap: 14 }}>
        {privat && (
          <Feldzeile label="Bereich">
            <Segmente liste={[{ id: 'business' as const, label: 'Business' }, { id: 'privat' as const, label: 'Privat' }]} aktiv={bereich} onWahl={b => { setBereich(b); setAlbum(''); }} />
          </Feldzeile>
        )}
        <Feldzeile label="Album">
          {vorgabe.album && vorgabe.albumTitel && bereich === vorgabe.bereich && !passendeAlben.length
            ? <span style={{ fontSize: TYP.body, color: C.ink }}>{vorgabe.albumTitel}</span>
            : (
              <select value={album} onChange={e => setAlbum(e.target.value)} style={{ ...auswahl, width: '100%', fontSize: 16, minHeight: 48 }} aria-label="Album">
                <option value="">Unsortiert ({bereich === 'privat' ? 'nur ich' : 'Business'})</option>
                {passendeAlben.map(a => <option key={a.id} value={a.id}>{a.titel}{a.bereich === 'privat' ? (a.sicht === 'haushalt' ? ' · Haushalt' : ' · nur ich') : ''}</option>)}
              </select>
            )}
        </Feldzeile>
        <Feldzeile label="Sind Personen erkennbar?">
          <Segmente liste={[{ id: 'offen' as const, label: 'später' }, { id: 'nein' as const, label: 'nein' }, { id: 'ja' as const, label: 'ja' }, { id: 'unklar' as const, label: 'unklar' }]} aktiv={personen} onWahl={setPersonen} />
        </Feldzeile>
        {videos.length > 0 && (
          <>
            <Schalter an={ton} onChange={setTon} karte beschreibung={TEXTE.tonHinweis}>Ton behalten</Schalter>
            <Schalter an={original} onChange={setOriginal} karte beschreibung="Empfohlen: in der Kamera 1080p/30 (HEVC). 4K-Videos nur als „Original“ — sie sind sehr groß.">Original (4K erlauben)</Schalter>
            <Hinweis art="info">{TEXTE.appOffen}</Hinweis>
          </>
        )}
        <Schalter an={extern} onChange={setExtern} karte beschreibung="Dann ist vor jeder Freigabe der Lizenz-Nachweis als Datei Pflicht.">Von einer fremden Fotografin / einem fremden Fotografen</Schalter>
        {fehler.map((f, i) => <Hinweis key={i} art="achtung" rolle="alert">{f}</Hinweis>)}
        {laeuft && <Hinweis art="info" rolle="status">{laeuft}</Hinweis>}
        <Knopf haupt voll farbe={LEUCHT.agenten} aus={!!laeuft} onClick={fehler.length ? onZu : los}>{fehler.length ? 'Fertig' : laeuft ? 'bereitet vor …' : 'Hochladen'}</Knopf>
      </div>
    </Fenster>
  );
}
