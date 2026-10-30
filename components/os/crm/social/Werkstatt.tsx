'use client';

// ─── Markttraktion · Social › Werkstatt (28.10.2026, Malin-Paket) ───────────────────────────────────────────────────────────────────────
// Kevin 28.10.: „Reels schneiden, erstellen lassen, planen — das Maximale rausbekommen.“ Aus Fotos und Videos der Medien-Ablage wird ein Reel
// (9:16) oder ein Bild (4:5 · 1:1 · 9:16): Ausschnitte wählen, Untertitel auf dem Server erkennen lassen und korrigieren, Hook/Einblendungen,
// Schnittvorschlag der KI (übernehmen nur per Klick), rendern. Das Ergebnis ist ein neues Medium — raus erst nach der Freigabe eines Menschen.
// Daten nur über `/api/social/werkstatt` (Aufträge) und `/api/medien` (Freigabe). Am Handy zuerst gedacht: alles untereinander, Ziele ≥ 44 px.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { Karte, Ueberschrift, Liste, Zeile, Chip, Knopf, Hinweis, Leerzustand, Feldzeile, feld, eingabe, Segmente } from '../../ui';
import { WERKSTATT_FORMATE, gesamtDauer, untertitelZeilen, type WerkstattAuftrag, type WerkstattClip, type Einblendung, type QuellInfo, type WerkstattFormat, type Segment } from '@/lib/social/werkstatt/regeln';
import type { SocialKanal } from '@/lib/social/typen';
import type { MitStand, SocialApi } from './daten';
import { AblageWahl, Vorschau, useAblage, vorschauUrl, fuerSocialFreigeben } from './Medien';

type Auftrag = WerkstattAuftrag & { stand: string; pruefung: string[] };
interface WerkstattLage { auftraege: Auftrag[]; quellen: Record<string, QuellInfo | null>; bereit: { rendern: boolean; untertitel: boolean } }

/** Start aus einem Beitrag (Social.tsx): einmal anlegen, dann öffnen. */
export interface WerkstattStart { folgeId?: string; medien: string[]; titel: string; ziel: 'reel' | 'bild' }

function useWerkstatt() {
  const [lage, setLage] = useState<WerkstattLage | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/social/werkstatt', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.ok) { setFehler(j.fehler ?? 'Die Werkstatt ließ sich nicht laden.'); return; }
      setLage(j as WerkstattLage);
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const aktion = useCallback(async (body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    try {
      const r = await fetch('/api/social/werkstatt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.auftraege) setLage(j as WerkstattLage);
      if (!r.ok || !j.ok) { setFehler(j.fehler ?? 'Nicht gespeichert.'); if (r.status === 409) void laden(); return null; }
      setFehler(null);
      return j;
    } catch { setFehler('Keine Verbindung — nichts gespeichert.'); return null; }
  }, [laden]);
  return { lage, fehler, setFehler, laden, aktion };
}

const STATUS: Record<WerkstattAuftrag['status'], { text: string; farbe: string }> = {
  entwurf: { text: 'Entwurf', farbe: C.inkDim }, arbeitet: { text: 'arbeitet …', farbe: C.aktiv }, fertig: { text: 'fertig', farbe: LEUCHT.gut }, fehler: { text: 'Fehler', farbe: LEUCHT.kritisch },
};
const sek = (n: number) => `${n.toFixed(1).replace('.', ',')} s`;

export function Werkstatt({ api, kanal, start, onStartVerbraucht }: { api: SocialApi; kanal: MitStand<SocialKanal>; start?: WerkstattStart | null; onStartVerbraucht?: () => void }) {
  const w = useWerkstatt();
  const [offen, setOffen] = useState<string | null>(null);
  const [neu, setNeu] = useState<'reel' | 'bild' | null>(null);
  const [wahl, setWahl] = useState<string[]>([]);
  const ablage = useAblage(neu !== null);

  // Start aus einem Beitrag: Auftrag anlegen und öffnen (einmal).
  const { aktion, laden } = w;
  const geladen = !!w.lage;
  useEffect(() => {
    if (!start || !geladen) return;
    onStartVerbraucht?.();
    void (async () => {
      const j = await aktion({ aktion: 'anlegen', kanalId: kanal.id, folgeId: start.folgeId, titel: start.titel, ziel: start.ziel, medien: start.medien });
      if (j?.auftrag) setOffen(String(j.auftrag));
    })();
  }, [start, geladen, kanal.id, aktion, onStartVerbraucht]);

  // Solange etwas arbeitet: alle 5 s nachsehen.
  const arbeitet = w.lage?.auftraege.some(a => a.status === 'arbeitet');
  useEffect(() => { if (!arbeitet) return; const t = setInterval(() => { void laden(); }, 5000); return () => clearInterval(t); }, [arbeitet, laden]);

  if (!w.lage) return w.fehler ? <Hinweis art="kritisch">{w.fehler}</Hinweis> : <Karte><span style={{ color: C.inkLeise }}>Lädt …</span></Karte>;
  const auftraege = w.lage.auftraege.filter(a => !a.kanalId || a.kanalId === kanal.id).sort((x, y) => y.geaendert.localeCompare(x.geaendert));
  const auf = offen ? w.lage.auftraege.find(a => a.id === offen) : undefined;

  if (auf) return <AuftragEditor key={auf.stand} w={w} api={api} a={auf} onZu={() => setOffen(null)} />;
  return (
    <>
      {w.fehler && <Hinweis art="achtung" aktion={<Knopf leise onClick={() => w.setFehler(null)}>OK</Knopf>}>{w.fehler}</Hinweis>}
      {!w.lage.bereit.rendern && <Hinweis art="info" titel="Rendern ist auf dieser Instanz noch aus">Ihr könnt Aufträge schon anlegen, schneiden und Einblendungen setzen — gerendert wird, sobald der Server eingerichtet ist (ffmpeg, Sprachmodell; UPDATES.md).</Hinweis>}
      <Karte>
        <Ueberschrift rechts={<span style={{ display: 'flex', gap: 8 }}><Knopf onClick={() => { setNeu('reel'); setWahl([]); }}>+ Reel</Knopf><Knopf leise onClick={() => { setNeu('bild'); setWahl([]); }}>+ Bild</Knopf></span>}>Werkstatt</Ueberschrift>
        {neu && (
          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{neu === 'reel' ? 'Clips und Fotos in der Reihenfolge antippen, in der sie laufen sollen.' : 'Ein Foto wählen — es wird aufs Format zugeschnitten und als JPEG gespeichert.'}</span>
            <AblageWahl ablage={ablage} gewaehlt={wahl} alleVorgabe onWahl={id => setWahl(l => (l.includes(id) ? l.filter(x => x !== id) : neu === 'bild' ? [id] : [...l, id]))} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Knopf haupt aus={!wahl.length} onClick={async () => {
                const j = await w.aktion({ aktion: 'anlegen', kanalId: kanal.id, ziel: neu, medien: wahl });
                if (j?.auftrag) { setOffen(String(j.auftrag)); setNeu(null); }
              }}>{neu === 'reel' ? `Reel aus ${wahl.length || '…'} anlegen` : 'Bild anlegen'}</Knopf>
              <Knopf leise onClick={() => setNeu(null)}>Abbrechen</Knopf>
            </div>
          </div>
        )}
        {auftraege.length === 0 && !neu
          ? <Leerzustand symbol="✂" titel="Noch nichts in der Werkstatt" aktion={<Knopf onClick={() => setNeu('reel')}>Erstes Reel anlegen</Knopf>}>Aus euren Clips wird ein Reel: Ausschnitte, Untertitel, Hook, Lautheit — gerendert auf dem eigenen Server.</Leerzustand>
          : <Liste>{auftraege.map(a => (
            <Zeile key={a.id} onClick={() => setOffen(a.id)} titel={a.titel}
              links={a.clips[0] ? <Vorschau id={a.ergebnis ?? a.clips[0].mediumId} art={a.ziel === 'bild' ? 'bild' : 'video'} groesse={44} /> : undefined}
              unter={<span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip farbe={STATUS[a.status].farbe}>{STATUS[a.status].text}</Chip>
                <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{a.ziel === 'reel' ? `Reel · ${sek(gesamtDauer(a.clips))} · ${a.clips.length} Clip${a.clips.length === 1 ? '' : 's'}` : `Bild · ${a.format}`}</span>
              </span>} />
          ))}</Liste>}
      </Karte>
    </>
  );
}

type W = ReturnType<typeof useWerkstatt>;

function AuftragEditor({ w, api, a, onZu }: { w: W; api: SocialApi; a: Auftrag; onZu: () => void }) {
  const quellen = w.lage!.quellen;
  const bereit = w.lage!.bereit;
  const [titel, setTitel] = useState(a.titel);
  const [format, setFormat] = useState<WerkstattFormat>(a.format);
  const [clips, setClips] = useState<WerkstattClip[]>(a.clips);
  const [einbl, setEinbl] = useState<Einblendung[]>(a.einblendungen);
  const [untertitel, setUntertitel] = useState(a.untertitel);
  const [laut, setLaut] = useState(a.laut);
  const [clipWahl, setClipWahl] = useState(false);
  const ablage = useAblage(clipWahl);
  const geaendert = JSON.stringify([titel, format, clips, einbl, untertitel, laut]) !== JSON.stringify([a.titel, a.format, a.clips, a.einblendungen, a.untertitel, a.laut]);
  const dauer = gesamtDauer(clips);
  const zeilen = useMemo(() => untertitelZeilen({ clips, transkripte: a.transkripte }), [clips, a.transkripte]);
  const folge = a.folgeId ? api.lage?.datei.folgen.find(f => f.id === a.folgeId) : undefined;
  const ohneTranskript = clips.filter(c => quellen[c.mediumId]?.art === 'video' && quellen[c.mediumId]?.ton === 'an' && !a.transkripte[c.mediumId]).length;

  const speichern = async () => w.aktion({ aktion: 'aendern', id: a.id, stand: a.stand, felder: { titel, format, clips, einblendungen: einbl, untertitel, laut } });
  const setClip = (i: number, t: Partial<WerkstattClip>) => setClips(l => l.map((c, j) => (j === i ? { ...c, ...t } : c)));
  const schiebe = (i: number, d: -1 | 1) => setClips(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });

  return (
    <>
      {w.fehler && <Hinweis art="achtung" aktion={<Knopf leise onClick={() => w.setFehler(null)}>OK</Knopf>}>{w.fehler}</Hinweis>}
      <Karte>
        <Ueberschrift rechts={<Knopf leise onClick={onZu}>← Werkstatt</Knopf>}>{a.ziel === 'reel' ? 'Reel' : 'Bild'}: {a.titel}</Ueberschrift>
        <div style={{ display: 'grid', gap: 12 }}>
          {a.status === 'arbeitet' && <Hinweis art="info" titel={a.arbeit?.art === 'transkript' ? 'Untertitel werden erkannt …' : 'Wird gerendert …'}>Läuft auf dem Server — ihr könnt die Seite verlassen, die Glocke meldet sich, wenn es fertig ist.</Hinweis>}
          {a.status === 'fehler' && a.fehler && <Hinweis art="kritisch">{a.fehler}</Hinweis>}
          {a.fehler && a.status !== 'fehler' && <Hinweis art="achtung">{a.fehler}</Hinweis>}
          {folge && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Gehört zum Beitrag „{folge.titel}“ — das Ergebnis wird dort angehängt (die Freigabe des Beitrags fällt dabei zurück: neuer Inhalt, neuer Blick).</span>}
          <Feldzeile label="Titel"><input style={eingabe} value={titel} onChange={e => setTitel(e.target.value)} maxLength={120} /></Feldzeile>
          <Segmente liste={WERKSTATT_FORMATE.map(f => ({ id: f, label: f === '9:16' ? '9:16 Reel/Story' : f === '4:5' ? '4:5 Feed' : '1:1 Quadrat' }))} aktiv={format} onWahl={(f: WerkstattFormat) => setFormat(f)} umbrechen />
        </div>
      </Karte>

      <Karte>
        <Ueberschrift rechts={<span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{a.ziel === 'reel' ? `gesamt ${sek(dauer)}` : ''}</span>}>{a.ziel === 'reel' ? 'Clips' : 'Foto'}</Ueberschrift>
        <div style={{ display: 'grid', gap: 14 }}>
          {clips.map((c, i) => {
            const q = quellen[c.mediumId];
            return (
              <div key={c.id} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'auto 1fr', alignItems: 'start' }}>
                <Vorschau id={c.mediumId} art={q?.art ?? 'video'} groesse={64} />
                <div style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{q ? `${q.art === 'video' ? `Video · ${sek(q.dauerSek ?? 0)}${q.ton === 'an' ? ' · mit Ton' : ' · ohne Ton'}` : 'Foto (Standbild)'}${q.name ? ` · ${q.name}` : ''}` : 'Quelle fehlt'}</span>
                  {a.ziel === 'reel' && <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 120px), 1fr))' }}>
                    <Feldzeile label={q?.art === 'bild' ? 'Start' : 'von (s)'}><input style={eingabe} type="number" inputMode="decimal" step="0.1" min={0} value={c.von} disabled={q?.art === 'bild'} onChange={e => setClip(i, { von: Number(e.target.value) })} /></Feldzeile>
                    <Feldzeile label={q?.art === 'bild' ? 'Dauer (s)' : 'bis (s)'}><input style={eingabe} type="number" inputMode="decimal" step="0.1" min={0.5} value={q?.art === 'bild' ? c.bis - c.von : c.bis} onChange={e => setClip(i, q?.art === 'bild' ? { bis: c.von + Number(e.target.value) } : { bis: Number(e.target.value) })} /></Feldzeile>
                  </div>}
                  {q?.art === 'video' && <video src={`${vorschauUrl(c.mediumId, 'original')}#t=${c.von},${c.bis}`} controls preload="none" playsInline style={{ width: '100%', maxWidth: 280, borderRadius: 12, background: '#000' }} />}
                  {a.ziel === 'reel' && <div style={{ display: 'flex', gap: 4 }}>
                    <Knopf leise onClick={() => schiebe(i, -1)} ariaLabel="früher">▲</Knopf>
                    <Knopf leise onClick={() => schiebe(i, 1)} ariaLabel="später">▼</Knopf>
                    <Knopf leise onClick={() => setClips(l => l.filter((_, j) => j !== i))} ariaLabel="Clip entfernen">✕</Knopf>
                  </div>}
                </div>
              </div>
            );
          })}
          {a.ziel === 'reel' && <Knopf leise onClick={() => setClipWahl(x => !x)}>{clipWahl ? 'Auswahl schließen' : '+ Clip oder Foto'}</Knopf>}
          {clipWahl && <AblageWahl ablage={ablage} gewaehlt={clips.map(c => c.mediumId)} alleVorgabe onWahl={id => {
            const m = ablage.medien?.find(x => x.id === id);
            if (!m) return;
            setClips(l => [...l, { id: `wc-neu-${l.length}-${Date.now().toString(36)}`, mediumId: id, von: 0, bis: m.art === 'bild' ? 3 : Math.max(0.5, Math.round((m.dauerSek ?? 10) * 10) / 10) }]);
          }} />}
        </div>
      </Karte>

      <Karte>
        <Ueberschrift>Text im Bild</Ueberschrift>
        <div style={{ display: 'grid', gap: 12 }}>
          {a.ziel === 'reel' && <>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}><input type="checkbox" checked={untertitel.an} onChange={e => setUntertitel(u => ({ ...u, an: e.target.checked }))} /> Untertitel einbrennen</label>
            {untertitel.an && <Segmente liste={[{ id: 'klar', label: 'Klar (weiß, Kontur)' }, { id: 'kraeftig', label: 'Kräftig (im Kasten)' }]} aktiv={untertitel.stil} onWahl={(s: 'klar' | 'kraeftig') => setUntertitel(u => ({ ...u, stil: s }))} umbrechen />}
            {untertitel.an && !clips.some(c => quellen[c.mediumId]?.art === 'video' && quellen[c.mediumId]?.ton === 'an') && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Untertitel entstehen aus dem Ton — dafür ein Video mit Ton „an“ hinzufügen. Einblendungen gehen auch ohne.</span>}
            {untertitel.an && clips.some(c => quellen[c.mediumId]?.art === 'video' && quellen[c.mediumId]?.ton === 'an') && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Knopf aus={!bereit.untertitel || geaendert || a.status === 'arbeitet'} onClick={() => w.aktion({ aktion: 'untertitel', id: a.id, stand: a.stand })}>
                  {ohneTranskript ? `Untertitel erkennen (${ohneTranskript} Clip${ohneTranskript === 1 ? '' : 's'})` : 'Untertitel neu erkennen'}
                </Knopf>
                <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{!bereit.untertitel ? 'Auf dieser Instanz noch nicht eingerichtet.' : geaendert ? 'Erst speichern.' : 'Läuft auf dem eigenen Server — nichts verlässt ihn. Nur Videos mit Ton „an“.'}</span>
              </div>
            )}
            {untertitel.an && Object.keys(a.transkripte).length > 0 && <TranskriptEditor w={w} a={a} />}
            {untertitel.an && zeilen.length > 0 && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{zeilen.length} Untertitel-Zeilen im fertigen Reel.</span>}
          </>}
          <strong style={{ fontSize: TYP.bedien }}>Einblendungen (Hook oben, Hinweise)</strong>
          {einbl.map((e, i) => (
            <div key={e.id} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))', alignItems: 'end' }}>
              <Feldzeile label="Text"><input style={eingabe} value={e.text} maxLength={300} onChange={x => setEinbl(l => l.map((y, j) => (j === i ? { ...y, text: x.target.value } : y)))} /></Feldzeile>
              {a.ziel === 'reel' && <Feldzeile label="von (s)"><input style={eingabe} type="number" inputMode="decimal" step="0.1" min={0} value={e.von} onChange={x => setEinbl(l => l.map((y, j) => (j === i ? { ...y, von: Number(x.target.value) } : y)))} /></Feldzeile>}
              {a.ziel === 'reel' && <Feldzeile label="bis (s)"><input style={eingabe} type="number" inputMode="decimal" step="0.1" min={0} value={e.bis} onChange={x => setEinbl(l => l.map((y, j) => (j === i ? { ...y, bis: Number(x.target.value) } : y)))} /></Feldzeile>}
              <Feldzeile label="Lage">
                <select style={feld} value={e.lage} onChange={x => setEinbl(l => l.map((y, j) => (j === i ? { ...y, lage: x.target.value as Einblendung['lage'] } : y)))}>
                  <option value="oben">oben</option><option value="mitte">Mitte</option><option value="unten">unten</option>
                </select>
              </Feldzeile>
              <Knopf leise onClick={() => setEinbl(l => l.filter((_, j) => j !== i))} ariaLabel="Einblendung entfernen">✕</Knopf>
            </div>
          ))}
          <Knopf leise onClick={() => setEinbl(l => [...l, { id: `we-neu-${l.length}-${Date.now().toString(36)}`, text: '', von: 0, bis: 3, lage: 'oben' }])}>+ Einblendung</Knopf>
          {a.ziel === 'reel' && <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}><input type="checkbox" checked={laut} onChange={e => setLaut(e.target.checked)} /> Lautheit angleichen (gleich laut wie andere Reels)</label>}
        </div>
      </Karte>

      {a.ziel === 'reel' && <Karte>
        <Ueberschrift>Schnittvorschlag (KI)</Ueberschrift>
        <div style={{ display: 'grid', gap: 10 }}>
          <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Die KI liest die Untertitel (nicht das Bild) und schlägt Ausschnitte, Reihenfolge und Hook vor — übernommen wird nur per Klick. Ohne Untertitel schneidet sie nur nach Länge.</span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Knopf aus={geaendert || a.status === 'arbeitet'} onClick={() => w.aktion({ aktion: 'vorschlagen', id: a.id })}>Schnitt vorschlagen</Knopf>
            {geaendert && <span style={{ color: C.inkLeise, fontSize: TYP.bedien, alignSelf: 'center' }}>Erst speichern.</span>}
          </div>
          {a.vorschlag && (
            <Hinweis art="info" titel={`Vorschlag: ${a.vorschlag.clips.length} Ausschnitt${a.vorschlag.clips.length === 1 ? '' : 'e'} · ${sek(gesamtDauer(a.vorschlag.clips))}`}
              aktion={<Knopf aus={geaendert} onClick={() => w.aktion({ aktion: 'vorschlag-uebernehmen', id: a.id, stand: a.stand })}>Übernehmen</Knopf>}>
              {a.vorschlag.warum ?? ''}{a.vorschlag.einblendungen[0] ? ` Hook: „${a.vorschlag.einblendungen[0].text}“` : ''}
            </Hinweis>
          )}
        </div>
      </Karte>}

      <Karte>
        <div style={{ display: 'grid', gap: 10 }}>
          {a.pruefung.map((g, i) => <Hinweis key={i} art="achtung">{g}</Hinweis>)}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Knopf haupt aus={!geaendert} onClick={speichern}>Speichern</Knopf>
            <Knopf aus={geaendert || !bereit.rendern || a.pruefung.length > 0 || a.status === 'arbeitet'} onClick={() => w.aktion({ aktion: 'rendern', id: a.id, stand: a.stand })}>{a.ergebnis ? 'Neu rendern' : a.ziel === 'reel' ? 'Reel rendern' : 'Bild erzeugen'}</Knopf>
            <Knopf leise onClick={async () => { if (await w.aktion({ aktion: 'weg', id: a.id, stand: a.stand })) onZu(); }}>Auftrag entfernen</Knopf>
          </div>
          {!bereit.rendern && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Rendern ist auf dieser Instanz noch nicht eingerichtet.</span>}
        </div>
      </Karte>

      {a.ergebnis && <Ergebnis a={a} folgeTitel={folge?.titel} onFertig={() => { void w.laden(); void api.laden(); }} />}
    </>
  );
}

function TranskriptEditor({ w, a }: { w: W; a: Auftrag }) {
  const [quelle, setQuelle] = useState(Object.keys(a.transkripte)[0]);
  const t = a.transkripte[quelle];
  const [seg, setSeg] = useState<Segment[]>(t?.segmente ?? []);
  useEffect(() => { setSeg(a.transkripte[quelle]?.segmente ?? []); }, [quelle, a.transkripte]);
  if (!t) return null;
  const ids = Object.keys(a.transkripte);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {ids.length > 1 && <Segmente liste={ids.map((id, i) => ({ id, label: `Clip-Quelle ${i + 1}` }))} aktiv={quelle} onWahl={setQuelle} umbrechen />}
      <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Erkannte Sätze — Tippfehler hier korrigieren (gilt für jeden Clip aus dieser Quelle).</span>
      <div style={{ display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
        {seg.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 8, alignItems: 'center' }}>
            <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{sek(s.von)}</span>
            <input style={eingabe} value={s.text} maxLength={300} onChange={e => setSeg(l => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          </div>
        ))}
      </div>
      <div><Knopf onClick={() => w.aktion({ aktion: 'transkript', id: a.id, stand: a.stand, mediumId: quelle, segmente: seg, sprache: t.sprache })}>Untertitel speichern</Knopf></div>
    </div>
  );
}

function Ergebnis({ a, folgeTitel, onFertig }: { a: Auftrag; folgeTitel?: string; onFertig: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [art, setArt] = useState<'gut' | 'achtung'>('gut');
  const freigeben = async () => {
    const r = await fuerSocialFreigeben(a.ergebnis!);
    setArt(r.ok ? 'gut' : 'achtung'); setText(r.ok && r.text === 'Für Social freigegeben.' ? 'Für Social freigegeben — der Beitrag darf es jetzt zeigen.' : r.text);
    if (r.ok) onFertig();
  };
  return (
    <Karte>
      <Ueberschrift>Ergebnis</Ueberschrift>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
        {a.ziel === 'reel'
          ? <video src={vorschauUrl(a.ergebnis!, 'original')} controls playsInline preload="metadata" style={{ width: '100%', maxWidth: 320, borderRadius: 12, background: '#000' }} />
          // eslint-disable-next-line @next/next/no-img-element -- verschlüsseltes Medium aus der eigenen Ablage, keine Bildoptimierung
          : <img src={vorschauUrl(a.ergebnis!, 'original')} alt="" style={{ width: '100%', maxWidth: 320, borderRadius: 12 }} />}
        {a.status !== 'fertig' && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Das ist das letzte Ergebnis — seitdem wurde der Auftrag geändert. Neu rendern, damit es passt.</span>}
        {text && <Hinweis art={art}>{text}</Hinweis>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf haupt onClick={freigeben}>Für Social freigeben</Knopf>
          <Knopf leise href={WEG.medien({ id: a.ergebnis })}>In der Medien-Ablage öffnen</Knopf>
        </div>
        <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{folgeTitel ? `Hängt am Beitrag „${folgeTitel}“.` : 'Am Beitrag anhängen: im Beitrag unter „Fotos und Videos“ wählen.'} Rausgehen darf es erst nach der Freigabe.</span>
      </div>
    </Karte>
  );
}
