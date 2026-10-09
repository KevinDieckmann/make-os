'use client';

// ─── Fotos & Videos — die Seite (09.10., Paket 5; Kevin: „eigene Seite ‚Fotos & Videos‘“) ─────────────────────────────────
// Handy zuerst: oben die Hauptaktion „Aufnehmen“ (+ „Aus Mediathek“), darunter die Warteschlange (was noch gesendet wird, App offen lassen),
// Alben als Pillen, Filter, die Galerie (Raster, verschlüsselt geladen, privat zwischengespeichert). Ein Medium öffnet das Detail-Fenster.
// Was die Person sieht, entscheidet der Server (`medienFuerBetrachter`) — die Seite blendet nichts selbst aus.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ImageIcon, Video, Star, CloudUpload, FolderPlus, Signpost } from 'lucide-react';
import { Seite, Karte, Ueberschrift, Pillen, Knopf, Hinweis, Leerzustand, Feldzeile, Segmente, eingabe, auswahl } from '../ui';
import { Fenster } from '../Fenster';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { useSpace } from '@/hooks/useSpace';
import { geteilteMedienSchlange, altHinweis, type MedienEintrag } from '@/lib/medien/warteschlange';
import { TEXTE, KANAL_NAME, type MediumSicht, type Bereich } from '@/lib/medien/typen';
import { useMedien, inhaltUrl, medienAktion, groesseText } from './daten';
import { AufnehmenKnoepfe } from './Aufnehmen';
import { MediumDetail } from './MediumDetail';

type Filter = 'alle' | 'business' | 'privat' | 'favoriten' | 'freigegeben' | 'gesperrt' | 'roh' | 'papierkorb';
const FILTER: { id: Filter; label: string }[] = [
  { id: 'alle', label: 'Alle' }, { id: 'business', label: 'Business' }, { id: 'privat', label: 'Privat' }, { id: 'favoriten', label: 'Favoriten' },
  { id: 'freigegeben', label: 'Freigegeben' }, { id: 'gesperrt', label: 'Gesperrt' }, { id: 'roh', label: 'Mit Personen, offen' }, { id: 'papierkorb', label: 'Papierkorb' },
];

function passt(m: MediumSicht, f: Filter): boolean {
  switch (f) {
    case 'business': case 'privat': return m.bereich === f;
    case 'favoriten': return m.meineWahl === 'favorit';
    case 'freigegeben': return m.marketing.wirksam === 'freigegeben';
    case 'gesperrt': return m.marketing.wirksam === 'gesperrt' || m.marketing.wirksam === 'abgelaufen';
    case 'roh': return m.erkennbarePersonen === 'ja' && m.marketing.wirksam !== 'freigegeben';
    default: return true;
  }
}

export function MedienSeite() {
  const such = useSearchParams();
  const router = useRouter();
  const { space } = useSpace();
  const [filter, setFilter] = useState<Filter>(((FILTER.find(x => x.id === such.get('filter'))?.id) ?? 'alle') as Filter);
  const [album, setAlbum] = useState<string>(such.get('album') ?? '');
  const { daten, fehler, laden } = useMedien(filter === 'papierkorb');
  const [offen, setOffen] = useState<string | null>(such.get('id'));
  const [albumNeu, setAlbumNeu] = useState(false);
  const [schild, setSchild] = useState(false);
  const [einwilligungen, setEinwilligungen] = useState(false);
  const [schlange, setSchlange] = useState<MedienEintrag[]>([]);
  const [fortschritt, setFortschritt] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const q = geteilteMedienSchlange();
    let fertig = q.fertigZahl;
    const neu = () => {
      void q.alle().then(setSchlange).catch(() => {});
      setFortschritt(new Map(q.fortschritt));
      if (q.fertigZahl !== fertig) { fertig = q.fertigZahl; void laden(); }
    };
    neu();
    const ab = q.beiAenderung(neu);
    window.addEventListener('make-medien-neu', neu);
    return () => { ab(); window.removeEventListener('make-medien-neu', neu); };
  }, [laden]);

  const liste = useMemo(() => (daten?.medien ?? []).filter(m => (filter === 'papierkorb' || passt(m, filter)) && (!album || m.album === album)), [daten, filter, album]);
  const aktuell = daten?.medien.find(m => m.id === offen) ?? null;
  const vorgabeBereich: Bereich = daten?.rechte.privat && (filter === 'privat' || (filter !== 'business' && space === 'privat')) ? 'privat' : 'business';
  const albumEintrag = daten?.alben.find(a => a.id === album);
  const oeffnen = (id: string | null) => { setOffen(id); const p = new URLSearchParams(such.toString()); if (id) p.set('id', id); else p.delete('id'); router.replace(`/os/medien${p.toString() ? `?${p}` : ''}`, { scroll: false }); };

  return (
    <Seite titel="Fotos & Videos" ton={LEUCHT.agenten} unter="Unterwegs aufnehmen, geordnet ablegen, fürs Marketing freigeben."
      rechts={<Knopf leise onClick={() => setSchild(true)} ariaLabel="Hinweisschild für Veranstaltungen"><Signpost size={16} aria-hidden /> Schild</Knopf>}>
      <Karte ton={LEUCHT.agenten}>
        <AufnehmenKnoepfe haupt farbe={LEUCHT.agenten} privat={!!daten?.rechte.privat} ich={daten?.ich ?? null} alben={daten?.alben}
          vorgabe={{ bereich: albumEintrag?.bereich ?? vorgabeBereich, ...(albumEintrag ? { album: albumEintrag.id, albumTitel: albumEintrag.titel } : {}) }} />
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 10, lineHeight: 1.5 }}>Fotos ohne Ortsdaten; Videos ohne Ton, außer du schaltest ihn bewusst an. Empfehlung: Kamera auf 1080p/30 (HEVC).</div>
      </Karte>

      {schlange.length > 0 && <Schlange liste={schlange} fortschritt={fortschritt} />}
      {fehler && <Hinweis art="achtung" rolle="alert">{fehler}</Hinweis>}
      {daten?.speicher.modus === 'aus' && <Hinweis art="achtung">Medien sind auf dieser Instanz ausgeschaltet.</Hinweis>}
      {daten?.speicher.voll && <Hinweis art="achtung">Der Medienspeicher ist fast voll — neue Uploads werden bald abgelehnt. Object Storage einrichten (Einstellungen › Betrieb) oder den Papierkorb leeren.</Hinweis>}

      <Karte>
        <Ueberschrift rechts={<Knopf leise onClick={() => setAlbumNeu(true)} ariaLabel="Album anlegen"><FolderPlus size={16} aria-hidden /> Album</Knopf>}>Alben</Ueberschrift>
        <Pillen einzeilig liste={[{ id: '', label: 'Alle' }, ...(daten?.alben ?? []).map(a => ({ id: a.id, label: `${a.titel}${a.anzahl ? ` · ${a.anzahl}` : ''}` }))]} aktiv={album} onWahl={setAlbum} />
        <div style={{ marginTop: 12 }}><Pillen einzeilig liste={FILTER.filter(f => daten?.rechte.privat || (f.id !== 'privat'))} aktiv={filter} onWahl={setFilter} /></div>
        {daten?.rechte.freigeben && <div style={{ marginTop: 12 }}><Knopf leise onClick={() => setEinwilligungen(true)}>Einwilligungen ({daten.einwilligungen.length})</Knopf></div>}
      </Karte>

      {daten && !liste.length ? (
        <Leerzustand symbol={<ImageIcon size={26} />} titel={filter === 'papierkorb' ? 'Der Papierkorb ist leer' : 'Noch keine Fotos oder Videos'}>{filter === 'papierkorb' ? 'Gelöschtes bleibt hier 30 Tage wiederherstellbar.' : '„Aufnehmen“ öffnet die Kamera; „Aus Mediathek“ nimmt, was schon auf dem Handy ist.'}</Leerzustand>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 30vw), 1fr))', gap: 8 }}>
          {liste.map(m => <Kachel key={m.id} m={m} onClick={() => oeffnen(m.id)} />)}
        </div>
      )}

      {aktuell && daten && <MediumDetail m={aktuell} daten={daten} onZu={() => oeffnen(null)} onGeaendert={() => void laden()} />}
      {albumNeu && <AlbumNeu privat={!!daten?.rechte.privat} onZu={() => setAlbumNeu(false)} onFertig={id => { setAlbumNeu(false); void laden().then(() => setAlbum(id)); }} />}
      {schild && <Schild onZu={() => setSchild(false)} />}
      {einwilligungen && daten && <Einwilligungen daten={daten} onZu={() => setEinwilligungen(false)} onGeaendert={() => void laden()} />}
    </Seite>
  );
}

function Kachel({ m, onClick }: { m: MediumSicht; onClick: () => void }) {
  const markiert = m.marketing.wirksam === 'freigegeben' ? LEUCHT.gut : m.marketing.wirksam === 'gesperrt' || m.marketing.wirksam === 'abgelaufen' ? LEUCHT.kritisch : m.marketing.wirksam === 'angefragt' ? LEUCHT.achtung : null;
  return (
    <button type="button" onClick={onClick} className="fassbar" aria-label={`${m.art === 'video' ? 'Video' : 'Foto'} ${m.name ?? ''} öffnen`}
      style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', border: `1px solid ${markiert ? `${markiert}66` : 'rgba(255,255,255,.08)'}`, padding: 0, background: 'rgba(255,255,255,.04)', cursor: 'pointer', minHeight: 48 }}>
      {m.varianten.includes('raster')
        // eslint-disable-next-line @next/next/no-img-element -- verschlüsselte Inhalte über die eigene Route
        ? <img src={inhaltUrl(m.id, 'raster')} alt={m.texte?.alt ?? ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: m.meineWahl === 'abgelehnt' ? 0.4 : 1 }} />
        // Ohne Vorschau (z. B. KI-Video — der Server wandelt nichts um): ruhiges Symbol statt eines leeren Bildes.
        : <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: C.inkDim }}>{m.art === 'video' ? <Video size={28} aria-hidden /> : <ImageIcon size={28} aria-hidden />}</span>}
      {m.urheber.art === 'ki' && <span title="KI-generiert (KI-VO Art. 50)" style={{ position: 'absolute', right: 6, top: 6, background: 'rgba(0,0,0,.6)', borderRadius: 8, padding: '1px 6px', color: '#fff', fontSize: TYP.bedien, fontWeight: 700 }}>KI{m.urheber.ki?.vorschlag === 'offen' ? ' · Vorschlag' : ''}</span>}
      <span style={{ position: 'absolute', left: 6, bottom: 6, display: 'flex', gap: 4 }}>
        {m.art === 'video' && <span style={{ background: 'rgba(0,0,0,.6)', borderRadius: 8, padding: '2px 6px', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: TYP.bedien }}><Video size={13} aria-hidden />{m.dauerSek ? `${Math.floor(m.dauerSek / 60)}:${String(Math.round(m.dauerSek % 60)).padStart(2, '0')}` : ''}</span>}
        {m.meineWahl === 'favorit' && <span style={{ background: 'rgba(0,0,0,.6)', borderRadius: 8, padding: '2px 5px', color: LEUCHT.achtung, display: 'inline-flex' }}><Star size={13} aria-hidden /></span>}
      </span>
    </button>
  );
}

function Schlange({ liste, fortschritt }: { liste: MedienEintrag[]; fortschritt: Map<string, number> }) {
  const q = geteilteMedienSchlange();
  const bytes = liste.reduce((s, e) => s + e.bytes, 0);
  return (
    <Karte>
      <Ueberschrift>Wird gesendet · {liste.length} · {groesseText(bytes)}</Ueberschrift>
      <div style={{ display: 'grid', gap: 8 }}>
        <Hinweis art="info">{TEXTE.appOffen}</Hinweis>
        {liste.map(e => (
          <div key={e.id} style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minHeight: 44 }}>
              <CloudUpload size={16} aria-hidden color={e.status === 'fehler' ? LEUCHT.kritisch : C.inkDim} />
              <span style={{ fontSize: TYP.body, flex: 1, minWidth: 120 }}>{e.anzeige.name} · {groesseText(e.bytes)}{fortschritt.get(e.id) ? ` · ${Math.round((fortschritt.get(e.id) ?? 0) * 100)} %` : ''}</span>
              {e.status === 'fehler' && <Knopf leise onClick={() => q.erneut(e.id)}>Erneut</Knopf>}
              <Knopf leise onClick={() => q.verwerfen(e.id)}>Verwerfen</Knopf>
            </div>
            {(e.hinweis || altHinweis(e)) && <span style={{ fontSize: TYP.bedien, color: e.status === 'fehler' ? LEUCHT.kritisch : C.inkDim }}>{altHinweis(e) ?? e.hinweis}</span>}
          </div>
        ))}
      </div>
    </Karte>
  );
}

function AlbumNeu({ privat, onZu, onFertig }: { privat: boolean; onZu: () => void; onFertig: (id: string) => void }) {
  const [art, setArt] = useState<'frei' | 'event' | 'mandat'>('frei');
  const [bereich, setBereich] = useState<Bereich>('business');
  const [sicht, setSicht] = useState<'nur-ich' | 'haushalt'>('nur-ich');
  const [titel, setTitel] = useState('');
  const [bezug, setBezug] = useState('');
  const [oeffentlich, setOeffentlich] = useState(false);
  const [wahl, setWahl] = useState<{ id: string; titel: string }[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    if (art === 'event') void fetch('/api/medien?events=1', { cache: 'no-store' }).then(r => r.json()).then(d => setWahl((d.events ?? []).map((e: { id: string; titel: string; datum: string }) => ({ id: e.id, titel: `${e.titel} · ${e.datum.split('-').reverse().join('.')}` })))).catch(() => setWahl([]));
    else if (art === 'mandat') void fetch('/api/aufgaben/crm', { cache: 'no-store' }).then(r => r.json()).then(d => setWahl((d.mandate ?? []).map((m: { id: string; titel: string; kunde?: string }) => ({ id: m.id, titel: m.kunde ? `${m.kunde} · ${m.titel}` : m.titel })))).catch(() => setWahl([]));
    else setWahl([]);
    setBezug('');
  }, [art]);
  const speichern = async () => {
    const t = titel.trim() || wahl.find(w => w.id === bezug)?.titel || '';
    const r = await medienAktion({ aktion: 'album-anlegen', art, bereich: art === 'frei' ? bereich : 'business', ...(art !== 'frei' ? { bezugId: bezug } : {}), titel: t, sicht, ...(art === 'event' ? { oeffentlich } : {}) });
    if (!r.ok || !r.album) { setFehler(r.fehler ?? 'Nicht angelegt.'); return; }
    onFertig(r.album.id);
  };
  return (
    <Fenster titel="Neues Album" onZu={onZu} breit={520}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Segmente liste={[{ id: 'frei' as const, label: 'Frei' }, { id: 'event' as const, label: 'Event' }, { id: 'mandat' as const, label: 'Kunde/Mandat' }]} aktiv={art} onWahl={setArt} />
        {art === 'frei' && privat && <Segmente liste={[{ id: 'business' as const, label: 'Business' }, { id: 'privat' as const, label: 'Privat' }]} aktiv={bereich} onWahl={setBereich} />}
        {art === 'frei' && bereich === 'privat' && <Segmente liste={[{ id: 'nur-ich' as const, label: 'Nur ich' }, { id: 'haushalt' as const, label: 'Haushalt' }]} aktiv={sicht} onWahl={setSicht} />}
        {art !== 'frei' && (
          <Feldzeile label={art === 'event' ? 'Event' : 'Kunde/Mandat'}>
            <select value={bezug} onChange={e => setBezug(e.target.value)} style={{ ...auswahl, width: '100%', fontSize: 16, minHeight: 48 }}>
              <option value="">— wählen —</option>
              {wahl.map(w => <option key={w.id} value={w.id}>{w.titel}</option>)}
            </select>
          </Feldzeile>
        )}
        {art === 'event' && <Segmente liste={[{ id: 'nein' as const, label: 'Nicht öffentlich' }, { id: 'ja' as const, label: 'Öffentlich (Publikum, Bühne)' }]} aktiv={oeffentlich ? 'ja' : 'nein'} onWahl={v => setOeffentlich(v === 'ja')} umbrechen />}
        <Feldzeile label="Titel"><input value={titel} onChange={e => setTitel(e.target.value)} maxLength={120} placeholder={art === 'frei' ? 'z. B. Messe, Büro, Sommerfest' : 'ohne Angabe: Name des Bezugs'} style={eingabe} /></Feldzeile>
        {fehler && <Hinweis art="achtung" rolle="alert">{fehler}</Hinweis>}
        <Knopf haupt voll farbe={LEUCHT.agenten} aus={(art !== 'frei' && !bezug) || (art === 'frei' && !titel.trim())} onClick={speichern}>Anlegen</Knopf>
      </div>
    </Fenster>
  );
}

function Schild({ onZu }: { onZu: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [fehlt, setFehlt] = useState(false);
  useEffect(() => { void fetch('/api/medien?vorlage=schild&kanaele=website,social', { cache: 'no-store' }).then(r => r.json()).then(d => { setText(d.text ?? null); setFehlt(!!d.verantwortlicherFehlt); }).catch(() => setText(null)); }, []);
  return (
    <Fenster titel="Hinweisschild für Veranstaltungen" onZu={onZu} breit={620}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Hinweis art="info">Das Schild informiert (Art. 13) — es ersetzt keine Einwilligung. Porträts und nicht öffentliche Veranstaltungen nur mit Einwilligung. Entwurf, einmal anwaltlich gegenlesen. {TEXTE.hinweis}</Hinweis>
        {fehlt && <Hinweis art="achtung">Verantwortlicher fehlt — unter System › Datenschutz eintragen.</Hinweis>}
        {text && <div style={{ fontSize: TYP.body, lineHeight: 1.6, color: C.ink, background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: '14px 16px' }}>{text}</div>}
        {text && <Knopf leise onClick={async () => { try { await navigator.clipboard.writeText(text); } catch { /* ohne Zwischenablage */ } }}>Text kopieren</Knopf>}
      </div>
    </Fenster>
  );
}

function Einwilligungen({ daten, onZu, onGeaendert }: { daten: { einwilligungen: { id: string; am: string; zwecke: string[]; person: { kontaktId?: string; name?: string }; widerruf?: { am: string }; sorgeberechtigt?: string; unterschrift: boolean }[] }; onZu: () => void; onGeaendert: () => void }) {
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <Fenster titel="Einwilligungen abgebildeter Personen" onZu={onZu} breit={680}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Hinweis art="info">Nur anhängend: Ein Widerruf bleibt als Nachweis stehen und sperrt sofort alle Medien mit dieser Einwilligung.</Hinweis>
        {!daten.einwilligungen.length && <span style={{ fontSize: TYP.body, color: C.inkDim }}>Noch keine Einwilligungen — festgehalten werden sie am Medium (Personen im Bild).</span>}
        {daten.einwilligungen.map(e => (
          <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minHeight: 44 }}>
            <span style={{ fontSize: TYP.body, flex: 1, minWidth: 160 }}>{e.person.name ?? 'Kontakt'} · {e.am.slice(0, 10).split('-').reverse().join('.')} · {e.zwecke.map(z => (z === 'ki' ? 'KI' : KANAL_NAME[z as keyof typeof KANAL_NAME] ?? z)).join(', ')}{e.sorgeberechtigt ? ' · Sorgeberechtigte' : ''}{e.widerruf ? ` · widerrufen am ${e.widerruf.am.slice(0, 10).split('-').reverse().join('.')}` : ''}</span>
            {e.unterschrift && <a href={`/api/medien/beleg?art=unterschrift&id=${encodeURIComponent(e.id)}`} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Unterschrift</a>}
            {!e.widerruf && <Knopf leise ton="warn" onClick={async () => { const r = await medienAktion({ aktion: 'einwilligung-widerrufen', id: e.id }); if (!r.ok) setFehler(r.fehler ?? 'Nicht gespeichert.'); else onGeaendert(); }}>Widerruf eintragen</Knopf>}
          </div>
        ))}
        {fehler && <Hinweis art="achtung" rolle="alert">{fehler}</Hinweis>}
        <Link href={WEG.medien({ filter: 'gesperrt' })} onClick={onZu} style={{ color: C.aktiv, fontSize: TYP.bedien, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Gesperrte Medien ansehen ›</Link>
      </div>
    </Fenster>
  );
}

