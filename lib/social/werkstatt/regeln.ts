// ─── MAKE OS — Social: Reel-Werkstatt — Regeln (rein, Browser UND Server) — 28.10.2026, Malin-Paket ──────────────────────────────────────
// Kevin 28.10.: „Reels schneiden, erstellen lassen … ich will am Ende überall das Maximale rausbekommen.“ Entscheidungen (Klickrunde 28.10.):
// Untertitel lokal auf dem Server (whisper.cpp, nichts verlässt den Server), Rendern auf dem Server (ffmpeg, Server wird größer), Material =
// eure eigenen Clips (+ KI-Bilder aus der Ablage, immer gekennzeichnet).
// Ein Auftrag = Ziel (Reel | Bild), Format (9:16 · 4:5 · 1:1), Clips aus der Medien-Ablage (Quelle + Ausschnitt), Untertitel aus den
// Transkripten der Quellen (EINE Wahrheit: Texte korrigiert man im Transkript, die Zeilen rechnet `untertitelZeilen`), Einblendungen
// (Hook oben, Hinweis unten), Lautheit. Hier liegt NUR, was sich ohne Netz und ohne Werkzeuge rechnen lässt: Säubern, Zeitachse, ASS-Datei,
// ffmpeg-Argumente. Ausführen: werkzeuge.ts; Bestand und Ablauf: server.ts.
// Instagram-Vorgaben (research/social/FAKTEN_MALIN_PAKET.md): MP4, H.264 + AAC, 23–60 fps, Breite ≤ 1920, ≤ 25 Mbit/s, 3 s–15 min, ≤ 300 MB,
// `moov` vorne (faststart), 9:16 empfohlen. Bilder nur JPEG.

export type WerkstattZiel = 'reel' | 'bild';
export type WerkstattFormat = '9:16' | '4:5' | '1:1';
export const WERKSTATT_FORMATE: readonly WerkstattFormat[] = ['9:16', '4:5', '1:1'];
export const FORMAT_MASSE: Record<WerkstattFormat, { breite: number; hoehe: number }> = {
  '9:16': { breite: 1080, hoehe: 1920 }, '4:5': { breite: 1080, hoehe: 1350 }, '1:1': { breite: 1080, hoehe: 1080 },
};
export type UntertitelStil = 'klar' | 'kraeftig';
export type EinblendungLage = 'oben' | 'mitte' | 'unten';

export interface Segment { von: number; bis: number; text: string }
export interface Transkript { segmente: Segment[]; sprache: 'de' | 'en'; am: string }
export interface WerkstattClip { id: string; mediumId: string; von: number; bis: number }
export interface Einblendung { id: string; text: string; von: number; bis: number; lage: EinblendungLage }

export type WerkstattStatus = 'entwurf' | 'arbeitet' | 'fertig' | 'fehler';
export type AutoSchritt = 'transkript' | 'schnitt' | 'render' | 'beitrag' | 'fertig';
export const AUTO_SCHRITTE: readonly AutoSchritt[] = ['transkript', 'schnitt', 'render', 'beitrag', 'fertig'];
export interface WerkstattArbeit { art: 'transkript' | 'render'; seit: string; versuche: number; gestartet?: string }

export interface SchnittVorschlag {
  clips: Omit<WerkstattClip, 'id'>[];
  einblendungen: Omit<Einblendung, 'id'>[];
  /** Titel und Beschriftung (Text unter dem Reel, mit Hashtags) — für den Beitrag, den Auto-Reel anlegt. */
  titel?: string;
  beschriftung?: string;
  /** Begründung in einem Satz (für die Person, warum so geschnitten). */
  warum?: string;
  am: string;
}

export interface WerkstattAuftrag {
  id: string;
  /** Kanal (für Plattform-Hinweise) und optional der Beitrag, an den das Ergebnis gehängt wird. */
  kanalId?: string;
  folgeId?: string;
  titel: string;
  ziel: WerkstattZiel;
  format: WerkstattFormat;
  clips: WerkstattClip[];
  /** Je Quelle (Medium) das Transkript — EINE Wahrheit für die Untertitel. */
  transkripte: Record<string, Transkript>;
  untertitel: { an: boolean; stil: UntertitelStil };
  einblendungen: Einblendung[];
  /** Lautheit angleichen (loudnorm). */
  laut: boolean;
  status: WerkstattStatus;
  /** Wartende bzw. laufende Arbeit (Transkript oder Rendern) — setzt nur der Server. */
  arbeit?: WerkstattArbeit;
  /** Fertiges Ergebnis (Medium `md-…`) — setzt nur der Server. */
  ergebnis?: string;
  fehler?: string;
  vorschlag?: SchnittVorschlag;
  /** Auto-Reel (28.10.): der Auftrag läuft ohne Klick weiter — Schritt der Kette (setzt nur der Server). */
  auto?: { schritt: AutoSchritt; titel?: string; beschriftung?: string; hook?: string };
  von: string;
  angelegt: string;
  geaendert: string;
  geaendertVon?: string;
}

/** Quelle eines Clips, wie die Werkstatt sie kennt (aus der Medien-Ablage gelesen). */
export interface QuellInfo { id: string; art: 'bild' | 'video'; dauerSek?: number; ton?: string; name?: string; breite?: number; hoehe?: number }

export const WERKSTATT_GRENZEN = {
  clips: 30, einblendungen: 12, segmente: 2000, text: 300, titel: 120,
  /** Ein Reel: 3 s bis 15 min (Instagram); Bild-Clips im Reel 0,5–30 s. */
  reelMin: 3, reelMax: 900, bildClipMin: 0.5, bildClipMax: 30, bildClipVorgabe: 3,
  /** Instagram: ≤ 300 MB. */
  bytesMax: 300 * 1024 * 1024,
} as const;
const G = WERKSTATT_GRENZEN;

const zahl = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '');
const KENNUNG = /^[a-z]{2}-[a-z0-9-]{4,80}$/;
const MEDIUM = /^md-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ── Zeitachse ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const clipDauer = (c: Pick<WerkstattClip, 'von' | 'bis'>) => Math.max(0, c.bis - c.von);
export const gesamtDauer = (clips: readonly Pick<WerkstattClip, 'von' | 'bis'>[]) => Math.round(clips.reduce((s, c) => s + clipDauer(c), 0) * 100) / 100;

/** Wo jeder Clip im fertigen Video beginnt. */
export function clipVersatz(clips: readonly Pick<WerkstattClip, 'von' | 'bis'>[]): number[] {
  const raus: number[] = [];
  let t = 0;
  for (const c of clips) { raus.push(t); t += clipDauer(c); }
  return raus;
}

/**
 * Untertitel-Zeilen im fertigen Video (rein): je Clip die Segmente des Transkripts seiner Quelle, die in den Ausschnitt fallen — auf die
 * Ausgabe-Zeit verschoben und am Ausschnitt abgeschnitten. Sehr kurze Reste (< 0,3 s) fallen weg (nicht lesbar).
 */
export function untertitelZeilen(a: Pick<WerkstattAuftrag, 'clips' | 'transkripte'>): Segment[] {
  const versatz = clipVersatz(a.clips);
  const raus: Segment[] = [];
  a.clips.forEach((c, i) => {
    for (const s of a.transkripte[c.mediumId]?.segmente ?? []) {
      const von = Math.max(s.von, c.von), bis = Math.min(s.bis, c.bis);
      if (bis - von < 0.3 || !s.text.trim()) continue;
      raus.push({ von: Math.round((von - c.von + versatz[i]) * 100) / 100, bis: Math.round((bis - c.von + versatz[i]) * 100) / 100, text: s.text.trim() });
    }
  });
  return raus;
}

// ── Prüfen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Was am Auftrag noch fehlt bzw. nicht geht — leer = renderbar. Sätze für die Oberfläche; der Server lehnt mit dem ersten ab. */
export function werkstattPruefen(a: WerkstattAuftrag, quellen: ReadonlyMap<string, QuellInfo | null>): string[] {
  const g: string[] = [];
  if (!a.clips.length) g.push('Noch kein Clip — Fotos oder Videos aus der Medien-Ablage hinzufügen.');
  if (a.ziel === 'bild' && a.clips.length !== 1) g.push('Ein Bild entsteht aus genau einer Quelle.');
  a.clips.forEach((c, i) => {
    const q = quellen.get(c.mediumId);
    const nr = a.clips.length > 1 ? ` ${i + 1}` : '';
    if (!q) { g.push(`Clip${nr}: die Quelle gibt es nicht mehr in der Business-Ablage.`); return; }
    if (q.art === 'video' && q.ton === 'nicht-freigegeben') g.push(`Clip${nr}: der Ton des Videos ist nicht freigegeben — so wird es nie verarbeitet.`);
    if (a.ziel === 'bild' && q.art !== 'bild') g.push('Ein Bild braucht ein Foto als Quelle.');
    if (q.art === 'video' && q.dauerSek && c.bis > q.dauerSek + 0.05) g.push(`Clip${nr} endet nach dem Ende des Videos (${q.dauerSek.toFixed(1)} s).`);
    if (c.bis - c.von < (q.art === 'bild' ? G.bildClipMin : 0.3)) g.push(`Clip${nr} ist zu kurz.`);
    if (q.art === 'bild' && c.bis - c.von > G.bildClipMax) g.push(`Clip${nr}: ein Foto steht höchstens ${G.bildClipMax} s.`);
  });
  if (a.ziel === 'reel' && a.clips.length) {
    const d = gesamtDauer(a.clips);
    if (d < G.reelMin) g.push(`Das Reel ist ${d.toFixed(1)} s lang — Instagram verlangt mindestens ${G.reelMin} s.`);
    if (d > G.reelMax) g.push(`Das Reel ist ${Math.round(d)} s lang — Instagram nimmt höchstens 15 Minuten.`);
  }
  return g;
}

// ── Säubern (Schreibweg) ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export class WerkstattAbgelehnt extends Error { constructor(public status: number, text: string) { super(text); } }
const nein = (t: string, status = 400): never => { throw new WerkstattAbgelehnt(status, t); };

function segmentAus(o: unknown): Segment | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  const von = zahl(x.von), bis = zahl(x.bis);
  if (von === null || bis === null || von < 0 || bis <= von) return null;
  return { von, bis, text: text(x.text, G.text) };
}

/** Clips aus der Eingabe: Medium-Kennung, Ausschnitt ≥ 0 — Grenzen → 413 (nie gekürzt). */
export function clipsAus(v: unknown, neueId: () => string): WerkstattClip[] {
  if (!Array.isArray(v)) return [];
  if (v.length > G.clips) nein(`Höchstens ${G.clips} Clips je Auftrag.`, 413);
  return v.map(o => {
    const x = (o ?? {}) as Record<string, unknown>;
    if (typeof x.mediumId !== 'string' || !MEDIUM.test(x.mediumId)) nein('Ein Clip braucht ein Medium aus der Ablage.');
    const von = zahl(x.von) ?? 0, bis = zahl(x.bis);
    if (von < 0 || bis === null || bis <= von) nein('Ein Clip braucht einen Ausschnitt (von < bis).');
    return { id: typeof x.id === 'string' && KENNUNG.test(x.id) ? x.id : neueId(), mediumId: x.mediumId as string, von, bis: bis as number };
  });
}

export function einblendungenAus(v: unknown, neueId: () => string): Einblendung[] {
  if (!Array.isArray(v)) return [];
  if (v.length > G.einblendungen) nein(`Höchstens ${G.einblendungen} Einblendungen.`, 413);
  return v.map(o => {
    const x = (o ?? {}) as Record<string, unknown>;
    const t = text(x.text, G.text);
    if (!t) nein('Eine Einblendung braucht einen Text.');
    const von = zahl(x.von) ?? 0, bis = zahl(x.bis) ?? von + 3;
    if (von < 0 || bis <= von) nein('Eine Einblendung braucht von < bis.');
    return { id: typeof x.id === 'string' && KENNUNG.test(x.id) ? x.id : neueId(), text: t, von, bis, lage: x.lage === 'mitte' || x.lage === 'unten' ? x.lage : 'oben' };
  });
}

/** Ein Transkript, das die Person korrigiert hat (nur Texte und Zeiten, Reihenfolge nach Zeit). */
export function transkriptAus(v: unknown, sprache: unknown, am: string): Transkript {
  if (!Array.isArray(v)) nein('Transkript ohne Segmente.');
  const l = v as unknown[];
  if (l.length > G.segmente) nein(`Höchstens ${G.segmente} Untertitel-Zeilen je Quelle.`, 413);
  const segmente = l.map(segmentAus).filter((s): s is Segment => !!s).sort((x, y) => x.von - y.von);
  return { segmente, sprache: sprache === 'en' ? 'en' : 'de', am };
}

/** Den gespeicherten Auftrag lesen — Unlesbares fällt weg, nie das Ganze. */
export function auftragAus(o: unknown): WerkstattAuftrag | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  if (typeof x.id !== 'string' || !/^wk-[0-9a-f-]{36}$/.test(x.id) || typeof x.von !== 'string') return null;
  const transkripte: Record<string, Transkript> = {};
  for (const [k, t] of Object.entries((x.transkripte ?? {}) as Record<string, unknown>)) {
    if (!MEDIUM.test(k) || !t || typeof t !== 'object') continue;
    const tt = t as Record<string, unknown>;
    transkripte[k] = { segmente: (Array.isArray(tt.segmente) ? tt.segmente : []).map(segmentAus).filter((s): s is Segment => !!s), sprache: tt.sprache === 'en' ? 'en' : 'de', am: typeof tt.am === 'string' ? tt.am : '' };
  }
  let clips: WerkstattClip[] = [], einbl: Einblendung[] = [];
  try { clips = clipsAus(x.clips, () => 'wc-ungueltig'); einbl = einblendungenAus(x.einblendungen, () => 'we-ungueltig'); } catch { /* beschädigt: leer lesen */ }
  const ziel: WerkstattZiel = x.ziel === 'bild' ? 'bild' : 'reel';
  const status: WerkstattStatus = x.status === 'arbeitet' || x.status === 'fertig' || x.status === 'fehler' ? x.status : 'entwurf';
  const arbeit = x.arbeit && typeof x.arbeit === 'object' ? x.arbeit as WerkstattArbeit : undefined;
  return {
    id: x.id, kanalId: typeof x.kanalId === 'string' ? x.kanalId : undefined, folgeId: typeof x.folgeId === 'string' ? x.folgeId : undefined,
    titel: text(x.titel, G.titel) || 'Ohne Titel', ziel, format: (WERKSTATT_FORMATE as readonly unknown[]).includes(x.format) ? x.format as WerkstattFormat : ziel === 'bild' ? '4:5' : '9:16',
    clips, transkripte,
    untertitel: { an: (x.untertitel as { an?: unknown } | undefined)?.an !== false, stil: (x.untertitel as { stil?: unknown } | undefined)?.stil === 'kraeftig' ? 'kraeftig' : 'klar' },
    einblendungen: einbl, laut: x.laut !== false, status,
    ...(arbeit && (arbeit.art === 'transkript' || arbeit.art === 'render') ? { arbeit: { art: arbeit.art, seit: String(arbeit.seit), versuche: Number(arbeit.versuche) || 0, ...(arbeit.gestartet ? { gestartet: String(arbeit.gestartet) } : {}) } } : {}),
    ...(typeof x.ergebnis === 'string' && MEDIUM.test(x.ergebnis) ? { ergebnis: x.ergebnis } : {}),
    ...(typeof x.fehler === 'string' ? { fehler: x.fehler.slice(0, 400) } : {}),
    ...(x.vorschlag && typeof x.vorschlag === 'object' ? { vorschlag: x.vorschlag as SchnittVorschlag } : {}),
    ...(x.auto && typeof x.auto === 'object' && (AUTO_SCHRITTE as readonly unknown[]).includes((x.auto as { schritt?: unknown }).schritt) ? { auto: {
      schritt: (x.auto as { schritt: AutoSchritt }).schritt,
      ...(['titel', 'beschriftung', 'hook'] as const).reduce((o, f) => { const v = (x.auto as Record<string, unknown>)[f]; return typeof v === 'string' && v.trim() ? { ...o, [f]: v.trim().slice(0, f === 'beschriftung' ? 2200 : 300) } : o; }, {}),
    } } : {}),
    von: x.von, angelegt: String(x.angelegt ?? ''), geaendert: String(x.geaendert ?? ''), ...(typeof x.geaendertVon === 'string' ? { geaendertVon: x.geaendertVon } : {}),
  };
}

// ── ASS-Datei (Untertitel + Einblendungen) ───────────────────────────────────────────────────────────────────────────────────────────

/** Zeit im ASS-Format h:mm:ss.cc. */
export function assZeit(s: number): string {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), sek = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(sek).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
/** Text sicher für ASS: keine Override-Blöcke `{…}`, kein Backslash-Befehl; Zeilenumbruch = `\N`. */
export const assText = (t: string): string => t.replace(/\\/g, '/').replace(/[{}]/g, m => (m === '{' ? '(' : ')')).replace(/\r?\n/g, '\\N');

/** Schrift: libass sucht sie über fontconfig (Docker: fonts-dejavu-core) — auf dem Mac nimmt CoreText eine ähnliche. */
export const SCHRIFT = 'DejaVu Sans';

/**
 * Die ASS-Datei des Auftrags (rein). Stile: „Untertitel“ unten (über der Bedienleiste von Instagram, ~18 % vom Rand), „Einblendung“ oben/
 * mitte/unten mit Kasten. `kraeftig` = Untertitel ebenfalls im Kasten (gut lesbar auf unruhigem Hintergrund).
 */
export function assDatei(a: Pick<WerkstattAuftrag, 'format' | 'untertitel' | 'einblendungen' | 'clips' | 'transkripte' | 'ziel'>): string | null {
  const { breite: W, hoehe: H } = FORMAT_MASSE[a.format];
  const zeilen = a.ziel === 'reel' && a.untertitel.an ? untertitelZeilen(a) : [];
  if (!zeilen.length && !a.einblendungen.length) return null;
  const gross = Math.round(H * 0.042), hook = Math.round(H * 0.05);
  const rand = Math.round(H * 0.18), oben = Math.round(H * 0.12);
  const kasten = a.untertitel.stil === 'kraeftig';
  // Farben ASS: &HAABBGGRR. Weiß, Schwarz, Kasten halbtransparent schwarz.
  const stil = (name: string, groesse: number, ausrichtung: number, randV: number, mitKasten: boolean) =>
    `Style: ${name},${SCHRIFT},${groesse},&H00FFFFFF,&H00FFFFFF,&H00000000,${mitKasten ? '&H80000000' : '&H64000000'},-1,0,0,0,100,100,0,0,${mitKasten ? 3 : 1},${mitKasten ? Math.round(groesse * 0.25) : Math.max(3, Math.round(groesse * 0.07))},0,${ausrichtung},${Math.round(W * 0.07)},${Math.round(W * 0.07)},${randV},1`;
  const kopf = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    stil('Untertitel', gross, 2, rand, kasten),
    stil('Oben', hook, 8, oben, true), stil('Mitte', hook, 5, 0, true), stil('Unten', hook, 2, rand, true),
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const ende = a.ziel === 'bild' ? 1 : gesamtDauer(a.clips);
  const ev = [
    ...zeilen.map(z => `Dialogue: 0,${assZeit(z.von)},${assZeit(Math.min(z.bis, ende))},Untertitel,,0,0,0,,${assText(z.text)}`),
    ...a.einblendungen.map(e => `Dialogue: 1,${assZeit(a.ziel === 'bild' ? 0 : e.von)},${assZeit(a.ziel === 'bild' ? 1 : Math.min(e.bis, ende))},${e.lage === 'oben' ? 'Oben' : e.lage === 'mitte' ? 'Mitte' : 'Unten'},,0,0,0,,${assText(e.text)}`),
  ];
  return [...kopf, ...ev, ''].join('\n');
}

// ── ffmpeg-Argumente ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface RenderEingabe { pfad: string; art: 'bild' | 'video'; ton: boolean }
/** Pfade in Filtern: nur sichere Zeichen (die Werkstatt legt eigene Ordner an) — sonst lehnen wir ab statt zu maskieren. */
const SICHERER_PFAD = /^[A-Za-z0-9/_.-]+$/;
/** Lautheit: −14 LUFS ist verbreitete Praxis für Social-Video (keine Vorgabe von Instagram belegt), True Peak −1,5 dB. */
export const LAUTHEIT = 'loudnorm=I=-14:TP=-1.5:LRA=11';

/**
 * Argumente für ein Reel (rein): je Clip ein Eingang mit Ausschnitt (`-ss`/`-t` vor `-i`), Fotos als Standbild, Stille, wo kein Ton ist;
 * Bild auf das Format füllen und mittig zuschneiden, 30 fps, yuv420p; alles aneinander (concat-Filter: verträgt verschiedene Größen/Codecs),
 * Untertitel/Einblendungen aus der ASS-Datei, Lautheit, H.264 High + AAC 48 kHz, faststart. Threads begrenzt (kleiner Server).
 */
export function reelArgumente(a: Pick<WerkstattAuftrag, 'clips' | 'format' | 'laut'>, ein: readonly RenderEingabe[], ass: string | null, ausgabe: string, threads = 2): string[] {
  if (ein.length !== a.clips.length) throw new Error('Eingänge passen nicht zu den Clips.');
  for (const p of [...ein.map(e => e.pfad), ausgabe, ...(ass ? [ass] : [])]) if (!SICHERER_PFAD.test(p)) throw new Error('Unsicherer Pfad.');
  const { breite: W, hoehe: H } = FORMAT_MASSE[a.format];
  const args: string[] = ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y'];
  const filter: string[] = [];
  let n = 0;
  const audioEingang: number[] = [];
  a.clips.forEach((c, i) => {
    const d = (clipDauer(c)).toFixed(2);
    if (ein[i].art === 'bild') args.push('-loop', '1', '-framerate', '30', '-t', d, '-i', ein[i].pfad);
    else args.push('-ss', c.von.toFixed(2), '-t', d, '-i', ein[i].pfad);
    const v = n++;
    let au: number;
    if (ein[i].art === 'video' && ein[i].ton) au = v;
    else { args.push('-f', 'lavfi', '-t', d, '-i', 'anullsrc=r=48000:cl=stereo'); au = n++; }
    audioEingang.push(au);
    filter.push(`[${v}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p,trim=duration=${d},setpts=PTS-STARTPTS[v${i}]`);
    filter.push(`[${au}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=duration=${d},asetpts=PTS-STARTPTS[a${i}]`);
  });
  filter.push(`${a.clips.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${a.clips.length}:v=1:a=1[vc][ac]`);
  filter.push(ass ? `[vc]subtitles=filename=${ass}[vo]` : '[vc]null[vo]');
  filter.push(a.laut ? `[ac]${LAUTHEIT},aresample=48000[ao]` : '[ac]anull[ao]');
  args.push('-filter_complex', filter.join(';'), '-map', '[vo]', '-map', '[ao]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-maxrate', '10M', '-bufsize', '20M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', '-threads', String(threads), ausgabe);
  return args;
}

/** Argumente für ein Bild (rein): füllen + mittig zuschneiden, Einblendungen aus der ASS-Datei, JPEG hoher Qualität. */
export function bildArgumente(a: Pick<WerkstattAuftrag, 'format'>, eingang: string, ass: string | null, ausgabe: string): string[] {
  for (const p of [eingang, ausgabe, ...(ass ? [ass] : [])]) if (!SICHERER_PFAD.test(p)) throw new Error('Unsicherer Pfad.');
  const { breite: W, hoehe: H } = FORMAT_MASSE[a.format];
  const vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1${ass ? `,subtitles=filename=${ass}` : ''}`;
  return ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-i', eingang, '-vf', vf, '-frames:v', '1', '-q:v', '2', ausgabe];
}

/** Poster (Vorschau) aus dem fertigen Video: ein Bild bei `sek`, höchstens 1568 px hoch bzw. 480 px (Raster). */
export function posterArgumente(video: string, sek: number, hoehe: number, ausgabe: string): string[] {
  for (const p of [video, ausgabe]) if (!SICHERER_PFAD.test(p)) throw new Error('Unsicherer Pfad.');
  return ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-ss', Math.max(0, sek).toFixed(2), '-i', video, '-frames:v', '1', '-vf', `scale=-2:${hoehe}`, '-q:v', '4', ausgabe];
}

/** Ton einer Quelle als 16-kHz-Mono-WAV für whisper.cpp (Eingangsformat laut Doku). */
export function wavArgumente(video: string, ausgabe: string): string[] {
  for (const p of [video, ausgabe]) if (!SICHERER_PFAD.test(p)) throw new Error('Unsicherer Pfad.');
  return ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', ausgabe];
}

/**
 * whisper.cpp-Ausgabe (`-oj`) → Segmente (rein). Form laut Doku/Beispiel: `{ transcription: [{ offsets: { from, to } (ms), text }] }`.
 * Leere Segmente und Klammer-Geräusche („[Musik]“, „(Applaus)“) fallen weg.
 */
export function whisperSegmente(roh: unknown): Segment[] {
  const l = (roh as { transcription?: unknown })?.transcription;
  if (!Array.isArray(l)) return [];
  const raus: Segment[] = [];
  for (const x of l) {
    const o = x as { offsets?: { from?: unknown; to?: unknown }; text?: unknown };
    const von = typeof o.offsets?.from === 'number' ? o.offsets.from / 1000 : null;
    const bis = typeof o.offsets?.to === 'number' ? o.offsets.to / 1000 : null;
    const t = typeof o.text === 'string' ? o.text.trim() : '';
    if (von === null || bis === null || bis <= von || !t || /^[[(].*[\])]$/.test(t)) continue;
    raus.push({ von: Math.round(von * 100) / 100, bis: Math.round(bis * 100) / 100, text: t.slice(0, G.text) });
  }
  return raus;
}

/** Konto löschen (30.10., Datenprüfung der Nacht): Aufträge bleiben (Arbeit des Haushalts), „angelegt/geändert von“ der Person wird „[gelöscht]“. Rein. */
export function werkstattOhnePerson<T extends Pick<WerkstattAuftrag, 'von' | 'geaendertVon'>>(l: readonly T[], speicher: string): { neu: T[]; n: number } {
  let n = 0;
  const neu = l.map(a => {
    let x = a;
    if (x.von === speicher) { n++; x = { ...x, von: '[gelöscht]' }; }
    if (x.geaendertVon === speicher) { n++; x = { ...x, geaendertVon: '[gelöscht]' }; }
    return x;
  });
  return { neu: n ? neu : [...l], n };
}
