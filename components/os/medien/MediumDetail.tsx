'use client';

// ─── Fotos & Videos — ein Medium (09.10., Paket 5) ──────────────────────────────────────────────────────────────────────
// Ansehen (Videos nur auf Knopfdruck, Ton nur, wenn er freigegeben ist), Auswahl je Person (Favorit/Ablehnen), ordnen (Name, Album, Bereich),
// „Erkennbare Personen?“ + Personen von Hand markieren (keine Gesichtserkennung), Freigabe fürs Marketing (Kanäle + bis-Datum, Vier-Augen bei
// erkennbaren Personen, Lizenz-Nachweis bei fremden Fotografen), an einen Head geben (mit Auftrag), Texte, Vorschläge der Heads (Zuschnitt
// führt erst der Klick aus), Papierkorb. Der Server prüft alles — die Oberfläche zeigt nur die Gründe vorab.
// Paket 4c (09.10.): KI-Medien tragen die KI-Marke, Herkunft (Modell, Kennzeichnung) und die Herkunftsangabe zum Laden; Freigabe nur mit
// bestätigter Kennzeichnung (sichtbar bei realistischen Personen/Orten); ein offener Agenten-Vorschlag verweist in den Freigabe-Stapel.
// „An Head geben …“ nur an Heads mit Medien-Bezug (MEDIEN_HEADS) und legt dort einen Thread mit Auftrag + Medium an (POST /api/agenten/faden).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, X, Play, Download, Trash2, RotateCcw, Scissors } from 'lucide-react';
import { Knopf, Hinweis, Segmente, MehrfachPillen, Feldzeile, Chip, eingabe, auswahl, Beschriftung, useRueckfrage } from '../ui';
import { Fenster } from '../Fenster';
import { KiMarke } from '../KiMarke';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { headDef } from '@/lib/agenten/katalog';
import { WEG } from '@/lib/wege';
import { freigabeGruende, sperrText } from '@/lib/medien/regeln';
import { geteilteMedienSchlange } from '@/lib/medien/warteschlange';
import { suchPasst } from '@/lib/text/such-norm';
import { localDay, tagePlus } from '@/lib/zeit';
import { KANAELE, KANAL_NAME, HEAD_AUFTRAEGE, MEDIEN_HEADS, TEXTE, type MediumSicht, type MedienListeAntwort, type Kanal, type HeadAuftragArt, type Medium, type Album, type MedienEinwilligung } from '@/lib/medien/typen';
import { inhaltUrl, medienAktion, groesseText } from './daten';
import { EinwilligungFenster } from './Einwilligung';

const STATUS_TEXT: Record<string, string> = { intern: 'intern', angefragt: 'Freigabe angefragt', freigegeben: 'freigegeben', gesperrt: 'gesperrt', abgelaufen: 'abgelaufen' };
const STATUS_FARBE: Record<string, string> = { intern: C.inkDim, angefragt: LEUCHT.achtung, freigegeben: LEUCHT.gut, gesperrt: LEUCHT.kritisch, abgelaufen: LEUCHT.kritisch };
const AUFTRAG_NAME: Record<HeadAuftragArt, string> = { auswahl: 'Beste auswählen', zuschnitt: 'Zuschnitte vorschlagen', text: 'Alt-Text & Post' };
const inZweiJahren = () => tagePlus(localDay(), 730);

interface KontaktKurz { id: string; name: string }

export function MediumDetail({ m, daten, onZu, onGeaendert }: { m: MediumSicht; daten: MedienListeAntwort; onZu: () => void; onGeaendert: () => void }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [abspielen, setAbspielen] = useState(false);
  const [kontakte, setKontakte] = useState<KontaktKurz[] | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();
  const alben = daten.alben.filter(a => a.bereich === m.bereich);
  const album = alben.find(a => a.id === m.album);
  const tun = async (a: Record<string, unknown>, ok?: string) => {
    setFehler(null); setText(null);
    const r = await medienAktion({ id: m.id, stand: m.stand, ...a });
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht gespeichert.'); return false; }
    if (ok || r.text) setText(ok ?? r.text ?? null);
    onGeaendert();
    return true;
  };
  useEffect(() => {
    if (kontakte || (!m.personen.some(p => p.kontaktId) && m.bereich !== 'business')) return;
    void fetch('/api/aufgaben/crm', { cache: 'no-store' }).then(r => r.json()).then((d: { kontakte?: KontaktKurz[] }) => setKontakte(d.kontakte ?? [])).catch(() => setKontakte([]));
  }, [kontakte, m.personen, m.bereich]);
  const nameVon = (id?: string) => (id ? kontakte?.find(k => k.id === id)?.name ?? 'Kontakt' : '');

  return (
    <Fenster titel={m.name || (m.art === 'video' ? 'Video' : 'Foto')} onZu={onZu} breit={880}>
      {dialog}
      <Ansicht m={m} abspielen={abspielen} setAbspielen={setAbspielen} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip farbe={m.bereich === 'business' ? LEUCHT.business : LEUCHT.beziehung}>{m.bereich === 'business' ? 'Business' : 'Privat'}</Chip>
        {album && <Chip farbe={C.inkDim}>{album.titel}</Chip>}
        <Chip farbe={STATUS_FARBE[m.marketing.wirksam]}>{STATUS_TEXT[m.marketing.wirksam]}</Chip>
        <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{groesseText(m.groesse)}{m.aufgenommen ? ` · ${new Date(m.aufgenommen).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' })}` : ''}</span>
      </div>
      {m.urheber.art === 'ki' && m.urheber.ki && <KiHerkunft m={m} />}
      {m.marketing.wirksamGrund && <Hinweis art="kritisch" rolle="status">{m.marketing.wirksamGrund}</Hinweis>}
      {fehler && <Hinweis art="achtung" rolle="alert">{fehler}</Hinweis>}
      {text && <Hinweis art="gut" rolle="status">{text}</Hinweis>}

      {m.geloeschtAm ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf onClick={() => tun({ aktion: 'wiederherstellen' }, 'Wiederhergestellt.')}><RotateCcw size={16} aria-hidden /> Wiederherstellen</Knopf>
          {m.darfAendern && <Knopf ton="warn" onClick={async () => { if (await bestaetigen({ titel: 'Endgültig löschen?', text: 'Datei und Eintrag werden gelöscht — das lässt sich nicht rückgängig machen.', ja: 'Endgültig löschen', gefahr: true })) await tun({ aktion: 'endgueltig' }, 'Endgültig gelöscht.'); }}>Endgültig löschen</Knopf>}
        </div>
      ) : (
        <>
          <Auswahl m={m} tun={tun} />
          {m.darfAendern && <Ordnen m={m} alben={alben} privat={daten.rechte.privat} tun={tun} />}
          <Personen m={m} daten={daten} kontakte={kontakte} nameVon={nameVon} tun={tun} />
          {m.bereich === 'business' && <Freigabe m={m} daten={daten} album={album} tun={tun} />}
          {m.bereich === 'business' && m.darfAendern && <AnHead m={m} onGeaendert={onGeaendert} />}
          <Texte m={m} tun={tun} />
          {!!m.vorschlaege?.length && <Vorschlaege m={m} onGeaendert={onGeaendert} />}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {/* Download als echter Link (kein next/link: dessen Vorab-Laden zöge sonst das ganze Original). */}
            {!(m.art === 'video' && m.ton === 'nicht-freigegeben') && <a href={inhaltUrl(m.id, 'original', true)} download className="ui-knopf fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.05)', color: C.ink, textDecoration: 'none', fontSize: TYP.bedien }}><Download size={16} aria-hidden /> Original laden</a>}
            {m.darfAendern && <Knopf leise onClick={async () => { if (await bestaetigen({ titel: 'In den Papierkorb?', text: 'Bleibt 30 Tage wiederherstellbar. Head-Aufträge fallen weg.', ja: 'In den Papierkorb', gefahr: true })) { if (await tun({ aktion: 'loeschen' })) onZu(); } }}><Trash2 size={16} aria-hidden /> Löschen</Knopf>}
          </div>
        </>
      )}
    </Fenster>
  );
}

/** KI-generiert (Paket 4c, KI-VO Art. 50): Marke, Modell, Kennzeichnung, Herkunftsangabe — und der offene Vorschlag eines Agenten. */
function KiHerkunft({ m }: { m: MediumSicht }) {
  const k = m.urheber.ki!;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <KiMarke text={`KI-generiert · ${k.modell}`} />
        <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Kennzeichnung in der Datei: {[k.kennzeichnung.synthid && 'SynthID', k.kennzeichnung.c2pa && 'C2PA'].filter(Boolean).join(' + ') || '—'} · bleibt unverändert</span>
        <a href={`/api/medien/inhalt?id=${encodeURIComponent(m.id)}&herkunft=1&download=1`} style={{ color: C.aktiv, fontSize: TYP.bedien, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Herkunftsangabe laden</a>
      </div>
      {k.zeichenNoetig && <Hinweis art="info">Realistische Personen oder Orte: beim Veröffentlichen sichtbar „KI-generiert“ zeigen (KI-VO Art. 50 Abs. 4).</Hinweis>}
      {k.vorschlag === 'offen' && <Hinweis art="achtung">{TEXTE.kiVorschlag} <Link href={WEG.freigaben()} style={{ color: C.aktiv }}>Zum Freigabe-Stapel ›</Link></Hinweis>}
    </div>
  );
}

function Ansicht({ m, abspielen, setAbspielen }: { m: MediumSicht; abspielen: boolean; setAbspielen: (b: boolean) => void }) {
  const tonGesperrt = m.art === 'video' && m.ton === 'nicht-freigegeben';
  const bild = m.varianten.includes('ansicht') ? 'ansicht' : m.varianten.includes('poster') ? 'poster' : 'raster';
  const rahmen = { width: '100%', maxHeight: '62vh', objectFit: 'contain' as const, borderRadius: 14, background: 'rgba(0,0,0,.35)', display: 'block' };
  if (m.art === 'video' && abspielen && !tonGesperrt) {
    // Videos starten NUR auf Knopfdruck (Kevin 09.10.); ohne freigegebenen Ton stumm. Range-Antworten liefert der Server (Safari).
    // eslint-disable-next-line jsx-a11y/media-has-caption -- eigene Aufnahmen ohne Untertitel (V2: Transkript/SRT)
    return <video src={inhaltUrl(m.id, 'original')} poster={inhaltUrl(m.id, 'poster')} controls autoPlay playsInline muted={m.ton !== 'an'} style={rahmen} />;
  }
  return (
    <div style={{ position: 'relative' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- verschlüsselte Inhalte über die eigene Route, kein next/image */}
      <img src={inhaltUrl(m.id, bild)} alt={m.texte?.alt ?? (m.name || '')} style={rahmen} />
      {m.art === 'video' && (tonGesperrt
        ? <div style={{ marginTop: 8 }}><Hinweis art="achtung">{TEXTE.tonGesperrt}</Hinweis></div>
        : <button type="button" onClick={() => setAbspielen(true)} className="fassbar" aria-label="Video abspielen" style={{ position: 'absolute', inset: 0, margin: 'auto', width: 72, height: 72, borderRadius: 36, border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Play size={30} aria-hidden /></button>)}
    </div>
  );
}

type Tun = (a: Record<string, unknown>, ok?: string) => Promise<boolean>;

function Auswahl({ m, tun }: { m: MediumSicht; tun: Tun }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <Knopf leise={m.meineWahl !== 'favorit'} farbe={LEUCHT.achtung} onClick={() => tun({ aktion: 'auswahl', wahl: m.meineWahl === 'favorit' ? null : 'favorit' })} ariaLabel="Favorit"><Star size={16} aria-hidden /> Favorit{m.favoriten > 1 ? ` (${m.favoriten})` : ''}</Knopf>
      <Knopf leise={m.meineWahl !== 'abgelehnt'} farbe={LEUCHT.kritisch} onClick={() => tun({ aktion: 'auswahl', wahl: m.meineWahl === 'abgelehnt' ? null : 'abgelehnt' })} ariaLabel="Ablehnen"><X size={16} aria-hidden /> Ablehnen</Knopf>
      {m.art === 'video' && m.ton === 'nicht-freigegeben' && m.meins && <TonFreigeben tun={tun} />}
    </div>
  );
}

function TonFreigeben({ tun }: { tun: Tun }) {
  const { bestaetigen, dialog } = useRueckfrage();
  return (
    <>
      {dialog}
      <Knopf leise onClick={async () => { if (await bestaetigen({ titel: 'Ton freigeben?', text: `${TEXTE.tonHinweis} Nur freigeben, wenn alle Gesprochenen einverstanden sind.`, ja: 'Alle sind einverstanden' })) await tun({ aktion: 'ton-freigeben', bestaetigt: true }, 'Ton freigegeben.'); }}>Ton freigeben</Knopf>
    </>
  );
}

function Ordnen({ m, alben, privat, tun }: { m: MediumSicht; alben: MedienListeAntwort['alben']; privat: boolean; tun: Tun }) {
  const [name, setName] = useState(m.name ?? '');
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Beschriftung>Ordnen</Beschriftung>
      <Feldzeile label="Name"><input value={name} onChange={e => setName(e.target.value)} onBlur={() => { if (name !== (m.name ?? '')) void tun({ aktion: 'aendern', name }); }} maxLength={120} style={eingabe} /></Feldzeile>
      <Feldzeile label="Album">
        <select value={m.album ?? ''} onChange={e => void tun({ aktion: 'aendern', album: e.target.value || null })} style={{ ...auswahl, width: '100%', fontSize: 16, minHeight: 48 }}>
          <option value="">Unsortiert</option>
          {alben.map(a => <option key={a.id} value={a.id}>{a.titel}</option>)}
        </select>
      </Feldzeile>
      {m.meins && (privat || m.bereich === 'privat') && (
        <div><Knopf leise onClick={() => tun({ aktion: 'bereich-wechseln', bereich: m.bereich === 'business' ? 'privat' : 'business' }, 'Bereich gewechselt — Personen und Freigabe beginnen neu.')}>Nach {m.bereich === 'business' ? 'Privat' : 'Business'} verschieben</Knopf></div>
      )}
    </div>
  );
}

function Personen({ m, daten, kontakte, nameVon, tun }: { m: MediumSicht; daten: MedienListeAntwort; kontakte: KontaktKurz[] | null; nameVon: (id?: string) => string; tun: Tun }) {
  const [suche, setSuche] = useState('');
  const [rolle, setRolle] = useState<'haupt' | 'beiwerk'>('beiwerk');
  const [einwilligung, setEinwilligung] = useState(false);
  const treffer = useMemo(() => (suche.trim().length >= 2 ? (kontakte ?? []).filter(k => suchPasst([k.name], suche)).slice(0, 8) : []), [suche, kontakte]);
  const einwVon = (kontaktId?: string) => daten.einwilligungen.filter(e => e.person.kontaktId && e.person.kontaktId === kontaktId && !e.widerruf);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Beschriftung>Personen im Bild</Beschriftung>
      <Segmente liste={[{ id: 'nein' as const, label: 'Keine erkennbar' }, { id: 'ja' as const, label: 'Ja, erkennbar' }, { id: 'unklar' as const, label: 'Unklar' }]} aktiv={(m.erkennbarePersonen ?? 'unklar') as 'nein' | 'ja' | 'unklar'} onWahl={e => void tun({ aktion: 'aendern', erkennbarePersonen: e })} umbrechen />
      {!m.erkennbarePersonen && <Hinweis art="info">Pflichtfrage vor jeder Freigabe und Weitergabe an Heads: Sind Personen erkennbar? Markiert wird nur von Hand — keine Gesichtserkennung.</Hinweis>}
      {m.personen.map(p => (
        <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minHeight: 44 }}>
          <span style={{ fontSize: TYP.body, flex: 1, minWidth: 140 }}>{p.art === 'kontakt' ? nameVon(p.kontaktId) : p.art === 'konto' ? 'Team' : `${p.anzahl ?? 1} unbekannt`}{p.minderjaehrig ? ' · minderjährig' : ''}</span>
          {m.darfAendern && <Segmente liste={[{ id: 'beiwerk' as const, label: 'Beiwerk' }, { id: 'haupt' as const, label: 'Hauptperson' }]} aktiv={p.rolle} onWahl={r => void tun({ aktion: 'person-aendern', personId: p.id, rolle: r })} />}
          {m.darfAendern && p.art === 'kontakt' && (
            <select value={p.einwilligungId ?? ''} onChange={e => void tun({ aktion: 'person-aendern', personId: p.id, einwilligungId: e.target.value || null })} style={{ ...auswahl, fontSize: 16, minHeight: 44 }} aria-label="Einwilligung">
              <option value="">ohne Einwilligung</option>
              {einwVon(p.kontaktId).map(e => <option key={e.id} value={e.id}>Einwilligung {e.am.slice(0, 10)} ({e.zwecke.join(', ')})</option>)}
            </select>
          )}
          {m.darfAendern && <Knopf leise onClick={() => tun({ aktion: 'person-aendern', personId: p.id, minderjaehrig: !p.minderjaehrig })}>{p.minderjaehrig ? 'nicht minderjährig' : 'minderjährig'}</Knopf>}
          {m.darfAendern && <Knopf leise onClick={() => tun({ aktion: 'person-entfernen', personId: p.id })} ariaLabel="Markierung entfernen"><X size={16} aria-hidden /></Knopf>}
        </div>
      ))}
      {m.darfAendern && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Kontakt suchen …" aria-label="Kontakt suchen" style={{ ...eingabe, flex: 1, minWidth: 180 }} />
            <Segmente liste={[{ id: 'beiwerk' as const, label: 'Beiwerk' }, { id: 'haupt' as const, label: 'Hauptperson' }]} aktiv={rolle} onWahl={setRolle} />
          </div>
          {treffer.map(k => <Knopf key={k.id} leise onClick={async () => { if (await tun({ aktion: 'person-markieren', person: { art: 'kontakt', kontaktId: k.id, rolle } })) setSuche(''); }}>{k.name} markieren</Knopf>)}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf leise onClick={() => tun({ aktion: 'person-markieren', person: { art: 'unbekannt', anzahl: 1, rolle } })}>+ Unbekannte Person</Knopf>
            {m.bereich === 'business' && daten.rechte.freigeben && <Knopf leise onClick={() => setEinwilligung(true)}>Einwilligung festhalten</Knopf>}
          </div>
        </div>
      )}
      {einwilligung && <EinwilligungFenster albumId={m.album} anlass={m.albumTitel} kontakte={kontakte ?? []} onZu={() => setEinwilligung(false)} onFertig={() => { setEinwilligung(false); }} />}
    </div>
  );
}

function Freigabe({ m, daten, album, tun }: { m: MediumSicht; daten: MedienListeAntwort; album?: MedienListeAntwort['alben'][number]; tun: Tun }) {
  const f = m.marketing;
  const [kanaele, setKanaele] = useState<Kanal[]>(f.kanaele ?? album?.vorgabe?.kanaele ?? ['website', 'social']);
  const [bis, setBis] = useState(f.bis ?? inZweiJahren());
  const [kiZeichen, setKiZeichen] = useState(false);
  const heute = localDay();
  const kiPflicht = m.urheber.art === 'ki' && !!m.urheber.ki?.zeichenNoetig;
  // Vorab dieselben Gründe wie der Server (der prüft trotzdem — auch Art. 18 und Werbesperre, die die Oberfläche nicht kennt).
  const gruende = freigabeGruende(
    { ...(m as unknown as Medium), urheber: { art: m.urheber.art, ...(m.urheber.lizenz ? { lizenz: {} as NonNullable<Medium['urheber']['lizenz']> } : {}), ...(m.urheber.ki ? { ki: m.urheber.ki } : {}) } },
    album ? ({ ...album, von: '', angelegt: '' } as unknown as Album) : undefined, kanaele, bis,
    { heute, einwilligungen: daten.einwilligungen as unknown as MedienEinwilligung[], kontaktSperre: () => null },
    { kiZeichenBestaetigt: kiZeichen },
  ).filter(g => !kiPflicht || g !== TEXTE.kiZeichen);
  const vierAugen = m.erkennbarePersonen === 'ja' && f.status === 'angefragt' && f.angefragtVon === daten.ich;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Beschriftung>Freigabe fürs Marketing</Beschriftung>
      {f.wirksam === 'freigegeben' && <Hinweis art="gut">Freigegeben für {(f.kanaele ?? []).map(k => KANAL_NAME[k]).join(', ')} bis {f.bis}{f.freigegebenVon ? ` (von ${f.freigegebenVon === daten.ich ? 'dir' : 'einer anderen Person'})` : ''}.</Hinweis>}
      {(f.wirksam === 'intern' || f.wirksam === 'angefragt' || f.wirksam === 'abgelaufen') && (
        <>
          <MehrfachPillen liste={KANAELE.map(k => ({ id: k, label: KANAL_NAME[k] }))} aktiv={kanaele} onWahl={setKanaele} />
          <Feldzeile label="Nutzbar bis"><input type="date" value={bis} min={heute} onChange={e => setBis(e.target.value)} style={eingabe} /></Feldzeile>
          {kiPflicht && (
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontSize: TYP.body, color: C.ink }}>
              <input type="checkbox" checked={kiZeichen} onChange={e => setKiZeichen(e.target.checked)} style={{ width: 22, height: 22 }} />
              Beim Veröffentlichen zeige ich sichtbar „KI-generiert“ (Pflicht bei realistischen Personen/Orten).
            </label>
          )}
          {gruende.map((g, i) => <Hinweis key={i} art="achtung">{g}</Hinweis>)}
          {vierAugen && <Hinweis art="info">Vier-Augen-Prinzip: Erkennbare Personen — freigeben muss eine andere Person.</Hinweis>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {f.status !== 'angefragt' && <Knopf leise onClick={() => tun({ aktion: 'freigabe', schritt: 'anfragen', kanaele, bis }, 'Freigabe angefragt.')}>Freigabe anfragen</Knopf>}
            {daten.rechte.freigeben && <Knopf haupt farbe={LEUCHT.gut} aus={gruende.length > 0 || (kiPflicht && !kiZeichen) || vierAugen || (m.erkennbarePersonen === 'ja' && f.status !== 'angefragt')} onClick={() => tun({ aktion: 'freigabe', schritt: 'freigeben', kanaele, bis, ...(m.urheber.art === 'ki' ? { kiZeichenBestaetigt: kiZeichen || !kiPflicht } : {}) }, 'Freigegeben.')}>Freigeben</Knopf>}
            {daten.rechte.freigeben && f.status === 'angefragt' && <Knopf leise onClick={() => tun({ aktion: 'freigabe', schritt: 'ablehnen' }, 'Abgelehnt.')}>Ablehnen</Knopf>}
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {f.wirksam !== 'gesperrt' && f.status !== 'intern' && <Knopf leise onClick={() => tun({ aktion: 'freigabe', schritt: 'sperren' }, 'Gesperrt.')}>Sperren</Knopf>}
        {f.status === 'gesperrt' && (f.sperrGrund === 'hand' || !f.sperrGrund) && <Knopf leise onClick={() => tun({ aktion: 'freigabe', schritt: 'entsperren' }, 'Entsperrt.')}>Entsperren</Knopf>}
        {f.status === 'gesperrt' && f.sperrGrund && f.sperrGrund !== 'hand' && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{sperrText(f.sperrGrund)}</span>}
      </div>
      {m.urheber.art !== 'ki' && <Urheber m={m} tun={tun} />}
    </div>
  );
}

function Urheber({ m, tun }: { m: MediumSicht; tun: Tun }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const hochladen = async (f: File | null) => {
    if (!f) return;
    setLaeuft(true); setFehler(null);
    try {
      const r = await fetch(`/api/medien/beleg?id=${encodeURIComponent(m.id)}&name=${encodeURIComponent(f.name.slice(0, 120))}`, { method: 'POST', body: f });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) setFehler(d?.fehler ?? 'Nachweis nicht gespeichert.'); else await tun({ aktion: 'aendern' });
    } catch { setFehler('Kein Netz — bitte noch einmal.'); }
    setLaeuft(false);
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Segmente liste={[{ id: 'team' as const, label: 'Von uns aufgenommen' }, { id: 'extern' as const, label: 'Fremde Fotografin/Fotograf' }]} aktiv={m.urheber.art === 'extern' ? 'extern' : 'team'} onWahl={a => void tun({ aktion: 'aendern', urheber: { art: a, ...(m.urheber.name ? { name: m.urheber.name } : {}) } })} umbrechen />
      {m.urheber.art === 'extern' && (
        m.urheber.lizenz
          ? <a href={`/api/medien/beleg?art=lizenz&id=${encodeURIComponent(m.id)}`} style={{ color: C.aktiv, fontSize: TYP.bedien, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Lizenz-Nachweis: {m.urheber.lizenz.name} ›</a>
          : <label style={{ display: 'grid', gap: 6, fontSize: TYP.bedien, color: C.inkDim }}>Lizenz-Nachweis (PDF, JPEG, PNG — Pflicht vor der Freigabe)
              <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={laeuft} onChange={e => void hochladen(e.currentTarget.files?.[0] ?? null)} style={{ fontSize: 16, minHeight: 44 }} />
            </label>
      )}
      {fehler && <Hinweis art="achtung" rolle="alert">{fehler}</Hinweis>}
    </div>
  );
}

/**
 * „An Head geben …“ (Paket 4c): nur an Heads mit Medien-Bezug. Erst die Aktion am Medium (der Server prüft, ob es an Heads darf, und vergibt den
 * Auftrag), dann EIN Thread beim Head über den vorhandenen Weg (POST /api/agenten/faden, im Hintergrund) mit Auftrag und dem Medium als Anhang.
 */
function AnHead({ m, onGeaendert }: { m: MediumSicht; onGeaendert: () => void }) {
  const heads = MEDIEN_HEADS.map(id => headDef(id)).filter((h): h is NonNullable<typeof h> => !!h);
  const [head, setHead] = useState<string>(heads[0]?.id ?? '');
  const [auftrag, setAuftrag] = useState<HeadAuftragArt[]>(['auswahl', 'text']);
  const [notiz, setNotiz] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [faden, setFaden] = useState<{ head: string; id: string } | null>(null);
  const entziehen = async (h: { head: string; auftragId: string }) => {
    setFehler(null);
    const r = await medienAktion({ id: m.id, stand: m.stand, aktion: 'head-entziehen', auftragId: h.auftragId, head: h.head });
    if (!r.ok) setFehler(r.fehler ?? 'Nicht gespeichert.'); else onGeaendert();
  };
  const geben = async () => {
    setFehler(null); setFaden(null);
    const r = await medienAktion({ id: m.id, stand: m.stand, aktion: 'an-head', head, auftrag, ...(notiz ? { notiz } : {}) });
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht gespeichert.'); return; }
    const neu = (r.medium as MediumSicht | undefined)?.heads.filter(h => h.head === head).slice(-1)[0];
    const name = headDef(head)?.name ?? head;
    const text = [
      `Medien-Auftrag aus „Fotos & Videos“: ${auftrag.map(a => AUFTRAG_NAME[a]).join(', ')}.`,
      `Medium: ${m.name ? `„${m.name}“ ` : ''}(${m.id})${m.albumTitel ? ` · Album „${m.albumTitel}“` : ''}${neu ? ` · Auftrag ${neu.auftragId}` : ''}.`,
      notiz ? `Notiz: ${notiz}` : '',
      'Bitte nur vorschlagen — übernommen wird per Klick.',
    ].filter(Boolean).join('\n');
    try {
      const t = await fetch('/api/agenten/faden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'senden', agent: { art: 'head', headId: head }, text, anhaenge: [{ art: 'medium', id: m.id, ...(m.name ? { name: m.name } : {}) }], hintergrund: true, anfrageId: crypto.randomUUID() }) });
      const d = await t.json().catch(() => null);
      if (!t.ok || !d?.ok) setFehler(`An ${name} gegeben — der Thread ließ sich nicht anlegen: ${d?.fehler ?? `Fehler ${t.status}`}. Im Agenten-Bereich neu senden.`);
      else setFaden({ head, id: d.faden.id });
    } catch { setFehler(`An ${name} gegeben — der Thread ließ sich ohne Netz nicht anlegen. Im Agenten-Bereich neu senden.`); }
    setNotiz('');
    onGeaendert();
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Beschriftung>An einen Head geben</Beschriftung>
      {m.heads.map(h => (
        <div key={`${h.head}-${h.auftragId}`} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minHeight: 44 }}>
          <span style={{ fontSize: TYP.body, flex: 1 }}>{headDef(h.head)?.name ?? h.head} · {h.auftrag.map(a => AUFTRAG_NAME[a]).join(', ')}</span>
          <Knopf leise onClick={() => entziehen(h)}>Entziehen</Knopf>
        </div>
      ))}
      <select value={head} onChange={e => setHead(e.target.value)} style={{ ...auswahl, width: '100%', fontSize: 16, minHeight: 48 }} aria-label="Head">
        {heads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
      <MehrfachPillen liste={HEAD_AUFTRAEGE.map(a => ({ id: a, label: AUFTRAG_NAME[a] }))} aktiv={auftrag} onWahl={setAuftrag} />
      <input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="Notiz zum Auftrag (optional)" maxLength={2000} style={eingabe} aria-label="Notiz zum Auftrag" />
      <Hinweis art="info">Der Head sieht nur dieses Medium (Vorschau, nie das Original) und schlägt nur vor — übernommen wird erst nach deinem Klick. Es entsteht ein Thread beim Head.{m.erkennbarePersonen === 'ja' ? ' Erkennbare Personen: an die Bild-KI geht das Foto nur mit deren Einwilligung „KI“ und deinem Schalter „Bilder an die KI“.' : ''}</Hinweis>
      {fehler && <Hinweis art="achtung" rolle="alert">{fehler}</Hinweis>}
      {faden && <Hinweis art="gut" rolle="status">An {headDef(faden.head)?.name ?? faden.head} gegeben. <Link href={WEG.agenten({ h: faden.head, f: faden.id })} style={{ color: C.aktiv }}>Zum Thread ›</Link></Hinweis>}
      <div><Knopf onClick={geben} aus={!auftrag.length || !head}>An Head geben</Knopf></div>
    </div>
  );
}

function Texte({ m, tun }: { m: MediumSicht; tun: Tun }) {
  const [alt, setAlt] = useState(m.texte?.alt ?? '');
  const [bu, setBu] = useState(m.texte?.bildunterschrift ?? '');
  const [post, setPost] = useState(m.texte?.post ?? '');
  if (!m.darfAendern && !m.texte) return null;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Beschriftung rechts={m.texte?.herkunft === 'ki' ? <KiMarke /> : undefined}>Texte</Beschriftung>
      <Feldzeile label="Alt-Text (Barrierefreiheit)"><textarea value={alt} onChange={e => setAlt(e.target.value)} maxLength={500} rows={2} style={{ ...eingabe, minHeight: 64 }} disabled={!m.darfAendern} /></Feldzeile>
      <Feldzeile label="Bildunterschrift"><textarea value={bu} onChange={e => setBu(e.target.value)} maxLength={1000} rows={2} style={{ ...eingabe, minHeight: 64 }} disabled={!m.darfAendern} /></Feldzeile>
      <Feldzeile label="Post-Entwurf"><textarea value={post} onChange={e => setPost(e.target.value)} maxLength={3000} rows={4} style={{ ...eingabe, minHeight: 110 }} disabled={!m.darfAendern} /></Feldzeile>
      {m.darfAendern && <div><Knopf leise onClick={() => tun({ aktion: 'texte', alt, bildunterschrift: bu, post }, 'Texte gespeichert.')}>Texte speichern</Knopf></div>}
    </div>
  );
}

/** Freigegebene Vorschläge der Heads: Zuschnitt erst auf Klick — der Browser schneidet, das Ergebnis ist ein NEUES Medium „abgeleitet von“. */
function Vorschlaege({ m, onGeaendert }: { m: MediumSicht; onGeaendert: () => void }) {
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const ausfuehren = async (vorschlagId: string, z: { format: string; rechteck: { x: number; y: number; b: number; h: number } }) => {
    setLaeuft(z.format); setFehler(null);
    try {
      const r = await fetch(inhaltUrl(m.id, m.varianten.includes('original') ? 'original' : 'ansicht'));
      if (!r.ok) throw new Error('Bild nicht ladbar');
      const { zuschneiden, vorbereiten } = await import('@/lib/medien/vorbereiten');
      const blob = await zuschneiden(await r.blob(), z.rechteck);
      const v = await vorbereiten(new File([blob], `${m.name ?? 'bild'}-${z.format}.jpg`, { type: 'image/jpeg' }), { tonBehalten: false });
      const q = geteilteMedienSchlange();
      await q.ablegen({
        id: crypto.randomUUID(), ...(q.person ? { person: q.person } : {}), bytes: v.bytes, daten: v.daten, datei: null, patches: [], vorschau: { raster: v.vorschau.raster, ...(v.vorschau.ansicht ? { ansicht: v.vorschau.ansicht } : {}) },
        anlegen: { typ: v.typ, bytes: v.bytes, bereich: m.bereich, ...(m.album ? { album: m.album } : {}), name: `${(m.name ?? 'Bild').slice(0, 100)} · ${z.format}`, ...v.meta, ...(m.erkennbarePersonen ? { erkennbarePersonen: m.erkennbarePersonen } : {}), abgeleitetVon: { id: m.id, vorschlagId } },
        anzeige: { name: `Zuschnitt ${z.format}`, art: 'bild' },
      });
      window.dispatchEvent(new Event('make-medien-neu'));
      onGeaendert();
    } catch (e) { setFehler(e instanceof Error ? e.message : 'Zuschnitt nicht möglich.'); }
    setLaeuft(null);
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Beschriftung rechts={<KiMarke />}>Vorschläge der Heads</Beschriftung>
      {m.vorschlaege!.map(v => (
        <div key={v.vorschlagId} style={{ display: 'grid', gap: 6 }}>
          {v.begruendung && <span style={{ fontSize: TYP.body, color: C.inkDim }}>{v.begruendung}</span>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {v.zuschnitte.map((z, i) => <Knopf key={i} leise aus={!!laeuft} onClick={() => ausfuehren(v.vorschlagId, z)}><Scissors size={16} aria-hidden /> {laeuft === z.format ? 'schneidet …' : `Zuschnitt ${z.format}`}</Knopf>)}
            {!!v.ausgefuehrt?.length && <span style={{ fontSize: TYP.bedien, color: C.inkDim, alignSelf: 'center' }}>{v.ausgefuehrt.length} schon zugeschnitten</span>}
          </div>
        </div>
      ))}
      {fehler && <Hinweis art="achtung" rolle="alert">{fehler}</Hinweis>}
    </div>
  );
}
