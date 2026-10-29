// ─── Social — Malin-Paket (28.10.): Medien am Beitrag, Instagram, Reel-Werkstatt, Kommentare & DMs ──────────────────────────────────
// Eigener Datenordner, erfundene Personen (@example.invalid), Meta, ffmpeg/whisper und die Medien-Ablage nachgebaut — nie ein echter Aufruf.
//   · Medien: Freigabe „Social Media“ als Prüfer-Befund, was Instagram aus welchen Medien posten kann (JPEG, Werkstatt-Video, 2–20)
//   · Link: öffentlich nur mit Token (Fingerabdruck), läuft ab, dieselbe Form in Middleware und Route
//   · Instagram: Container → Status → veröffentlichen; Reel wartet über Läufe hinweg; Karussell mit Kindern; KI-Kennzeichnung; 190 → neu verbinden
//   · Werkstatt: Zeitachse, ASS (keine Override-Blöcke aus Text), ffmpeg-Argumente, Prüfung, Vorschlag nur aus vorhandenen Quellen,
//     Rendern legt ein Medium ab und hängt es an den Beitrag (Freigabe fällt zurück), Untertitel aus whisper-JSON
//   · Community: Kommentare/DMs lesen, Fenster, Not-Aus, Limits, Personenmarke; Wächter: fremder „nur ich“-Kanal liefert nichts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync, readFileSync, promises as fs } from 'node:fs';

const { ordner } = vi.hoisted(() => {
  const o = `${(process.env.TMPDIR ?? '/tmp').replace(/\/+$/, '')}/make-os-social-ig-${process.pid}-${Date.now()}`;
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-social-ig';
  process.env.MAKE_OS_OHNE_APPLE = '1';
  process.env.INSTAGRAM_APP_ID = 'app-pruef';
  process.env.INSTAGRAM_APP_SECRET = 'geheim-pruef';
  process.env.MAKE_OS_ADRESSE = 'https://make.example.invalid';
  process.env.MAKE_OS_WERKSTATT_TMP = `${o}-tmp`;
  return { ordner: o };
});

// ── Medien-Ablage nachgebaut (Lese-Form für Social, Quellen für die Werkstatt) ──
const ablage = vi.hoisted(() => ({ medien: new Map<string, Record<string, unknown>>(), abgelegt: [] as Record<string, unknown>[] }));
vi.mock('@/lib/social/medien', async orig => {
  const echt = await orig<typeof import('@/lib/social/medien')>();
  return { ...echt, socialMedienLesen: async (ids: readonly string[]) => new Map(ids.map(id => [id, (ablage.medien.get(id) as never) ?? null])) };
});
vi.mock('@/lib/medien/server', async orig => {
  const echt = await orig<typeof import('@/lib/medien/server')>();
  return {
    ...echt,
    betrachterFuer: async (p: string) => ({ person: p, haushalt: 'h-pruef', voll: true, marketing: true }),
    mediumFinden: async (_b: unknown, id: string) => {
      const m = ablage.medien.get(id);
      return m ? { medium: { id, art: m.art, bereich: 'business', dauerSek: m.dauerSek, ton: m.ton ?? 'an', name: m.name, personen: [], marketing: { status: 'intern' } }, quelle: {}, name: 'medien--h-pruef' } : null;
    },
  };
});
vi.mock('@/lib/medien/upload-server', async orig => {
  const echt = await orig<typeof import('@/lib/medien/upload-server')>();
  return {
    ...echt,
    inhaltLesen: async () => ({ ok: true, mitPersonen: false, ki: false, inhalt: { status: 200, kopf: { 'Content-Type': 'video/mp4', 'Content-Length': '4' }, strom: new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2, 3, 4])); c.close(); } }) } }),
  };
});
vi.mock('@/lib/medien/schnitt-ablage', () => ({
  schnittMediumAblegen: async (e: Record<string, unknown>) => { ablage.abgelegt.push(e); return { ok: true, medium: { id: 'md-00000000-0000-4000-8000-0000000000aa' } }; },
}));
// ── Werkzeuge nachgebaut: ffmpeg schreibt eine Datei an die Ausgabe (letztes Argument), whisper ein JSON ──
const werkzeug = vi.hoisted(() => ({ aufrufe: [] as { bin: string; args: string[] }[], whisper: { transcription: [] as unknown[] } }));
vi.mock('@/lib/social/werkstatt/werkzeuge', async orig => {
  const echt = await orig<typeof import('@/lib/social/werkstatt/werkzeuge')>();
  const { promises: f } = await import('node:fs');
  return {
    ...echt,
    werkzeugStand: async () => ({ ffmpeg: true, whisper: true, modell: true }),
    ausfuehren: async (bin: string, args: string[]) => {
      werkzeug.aufrufe.push({ bin, args });
      if (bin.includes('whisper')) { const of = args[args.indexOf('-of') + 1]; await f.writeFile(`${of}.json`, JSON.stringify(werkzeug.whisper)); }
      else await f.writeFile(args[args.length - 1], Buffer.from('fake-mp4'));
      return { ok: true, code: 0, fehler: '', zeitUeber: false };
    },
  };
});
const modell = vi.hoisted(() => ({ text: '' }));
vi.mock('@/lib/anthropic', async orig => {
  const echt = await orig<typeof import('@/lib/anthropic')>();
  return { ...echt, askText: async () => ({ ok: true, status: 200, text: modell.text }) };
});

import { instagramMedien, medienBefunde, type SocialMedium } from '@/lib/social/medien';
import { untertitelZeilen, assDatei, assText, reelArgumente, werkstattPruefen, whisperSegmente, type WerkstattAuftrag } from '@/lib/social/werkstatt/regeln';
import { vorschlagAus, vorschlagAuftrag } from '@/lib/social/werkstatt/vorschlag';
import { kommentareAus, nachrichtenAus, faedenAus, antwortenErlaubt, antwortTextPruefen, type CommunityDatei } from '@/lib/social/community';
import { LEITPLANKEN_VORGABE, type SocialKanal } from '@/lib/social/typen';

const MD = (n: number) => `md-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sm = (id: string, x: Partial<SocialMedium> = {}): SocialMedium => ({ id, art: 'bild', typ: 'image/jpeg', ki: false, schnitt: false, status: 'freigegeben', social: true, geloescht: false, ...x });
const karte = (l: SocialMedium[]) => new Map(l.map(m => [m.id, m]));

describe('Medien am Beitrag (rein)', () => {
  it('Prüfer: nicht freigegeben, nicht für Social, KI ohne Kennzeichnung, gelöscht → stopp', () => {
    const m = karte([sm(MD(1), { status: 'intern' }), sm(MD(2), { social: false }), sm(MD(3), { ki: true })]);
    const b = medienBefunde({ medien: [MD(1), MD(2), MD(3), MD(4)], kiInhalt: false }, m);
    expect(b.map(x => x.code)).toEqual(['medium-freigabe', 'medium-kanal', 'medium-ki', 'medium-weg']);
    expect(b.every(x => x.stufe === 'stopp')).toBe(true);
    expect(medienBefunde({ medien: [MD(3)], kiInhalt: true }, m)).toEqual([]);
  });
  it('Instagram: Bild = ein JPEG, Reel = ein Werkstatt-Video, Karussell 2–20, kein Textpost', () => {
    const m = karte([sm(MD(1)), sm(MD(2), { typ: 'image/png' }), sm(MD(3), { art: 'video', typ: 'video/mp4' }), sm(MD(4), { art: 'video', typ: 'video/mp4', schnitt: true })]);
    expect(instagramMedien({ medien: [MD(1)] }, { art: 'bild' }, m)).toMatchObject({ ok: true, art: 'bild' });
    expect(instagramMedien({ medien: [MD(2)] }, { art: 'bild' }, m)).toMatchObject({ ok: false, grund: expect.stringMatching(/JPEG/) });
    expect(instagramMedien({ medien: [MD(3)] }, { art: 'video' }, m)).toMatchObject({ ok: false, grund: expect.stringMatching(/Werkstatt/) });
    expect(instagramMedien({ medien: [MD(4)] }, { art: 'video' }, m)).toMatchObject({ ok: true, art: 'reel' });
    expect(instagramMedien({ medien: [MD(1), MD(4)] }, { art: 'karussell' }, m)).toMatchObject({ ok: true, art: 'karussell' });
    expect(instagramMedien({ medien: [MD(1)] }, { art: 'karussell' }, m).ok).toBe(false);
    expect(instagramMedien({ medien: [MD(1)] }, { art: 'text' }, m).ok).toBe(false);
    expect(instagramMedien({ medien: [] }, { art: 'bild' }, m).ok).toBe(false);
  });
});

describe('Öffentlicher Medien-Link', () => {
  it('Token nur als Fingerabdruck, läuft ab; Middleware und Route nutzen dieselbe Form', async () => {
    const { linkAnlegen, linkAufloesen, LINK_PFAD, linksAufraeumen } = await import('@/lib/social/medien-link');
    const pfad = await linkAnlegen(MD(1), 'jpg', 1_000_000);
    expect(pfad).toMatch(LINK_PFAD);
    const token = pfad.split('/').pop()!;
    expect(await linkAufloesen(token, 1_000_001)).toBe(MD(1));
    expect(await linkAufloesen(token, 1_000_000 + 61 * 60_000)).toBeNull();
    expect(await linkAufloesen('sm-' + '0'.repeat(32), 1_000_001)).toBeNull();
    const roh = readFileSync(`${ordner}/social-medien-links.json`, 'utf8');
    expect(roh).not.toContain(token.replace('.jpg', ''));
    expect(await linksAufraeumen(1_000_000 + 61 * 60_000)).toBe(1);
    const mw = readFileSync('middleware.ts', 'utf8');
    expect(mw).toContain(String.raw`/^\/api\/social\/medien\/sm-[a-f0-9]{32}(\.(jpg|mp4))?$/`);
    expect(LINK_PFAD.source).toBe(String.raw`^\/api\/social\/medien\/sm-[a-f0-9]{32}(\.(jpg|mp4))?$`);
  });
});

// ── Meta nachgebaut ──
type Aufruf = { methode: string; pfad: string; params: Record<string, string> };
const meta = { aufrufe: [] as Aufruf[], status: new Map<string, string[]>(), naechste: 100, fehler190: false };
function metaFetch(): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    const params = init?.body ? Object.fromEntries(new URLSearchParams(String(init.body))) : Object.fromEntries(u.searchParams);
    const methode = init?.method ?? 'GET';
    const pfad = u.pathname.replace(/^\/v\d+\.\d+\//, '');
    meta.aufrufe.push({ methode, pfad, params });
    const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    if (meta.fehler190) return json({ error: { message: 'Session expired', code: 190 } }, 400);
    if (methode === 'POST' && pfad === 'me/media') return json({ id: String(++meta.naechste) });
    if (methode === 'POST' && pfad === 'me/media_publish') return json({ id: '9001' });
    if (methode === 'GET' && params.fields === 'status_code,status') { const l = meta.status.get(pfad) ?? []; return json({ status_code: l.shift() ?? 'FINISHED' }); }
    if (methode === 'GET' && params.fields === 'permalink') return json({ permalink: 'https://www.instagram.com/p/beispiel/' });
    return json({ error: { message: 'unbekannt', code: 100 } }, 400);
  }) as typeof fetch;
}

describe('Instagram (nachgebaut)', () => {
  const kanal = { id: 'sk-1' } as SocialKanal;
  const folge = (x: Record<string, unknown> = {}) => ({ id: 'sv-1', kanalId: 'sk-1', titel: 'T', skript: 'S', hooks: [], quellen: [], kiInhalt: false, status: 'geplant', veroeffentlicht: [], messungen: [], geaendert: '', ...x }) as never;
  const link = async (m: SocialMedium) => `https://make.example.invalid/api/social/medien/sm-${'a'.repeat(32)}.${m.art === 'bild' ? 'jpg' : 'mp4'}#${m.id}`;
  it('Bild: Container mit image_url + caption → fertig → veröffentlichen, Permalink', async () => {
    const { instagramAnbieter, _instagramFetchSetzen } = await import('@/lib/social/anbieter/instagram');
    _instagramFetchSetzen(metaFetch());
    meta.aufrufe = [];
    const r = await instagramAnbieter.posten({ accessToken: 'tok', autor: '17841' }, { kanal, folge: folge({ medien: [MD(1)] }), format: { art: 'bild' } as never, text: 'Hallo #welt', medien: [sm(MD(1))], link });
    expect(r).toEqual({ ok: true, externeId: '9001', link: 'https://www.instagram.com/p/beispiel/' });
    expect(meta.aufrufe[0]).toMatchObject({ methode: 'POST', pfad: 'me/media', params: { caption: 'Hallo #welt', image_url: expect.stringMatching(/\.jpg/) } });
    expect(meta.aufrufe[0].params.is_ai_generated).toBeUndefined();
    expect(meta.aufrufe.some(a => a.pfad === 'me/media_publish' && a.params.creation_id === String(meta.naechste))).toBe(true);
  });
  it('Reel: Container verarbeitet noch → „warten“, der nächste Lauf veröffentlicht; KI-Inhalt gekennzeichnet', async () => {
    const { instagramAnbieter } = await import('@/lib/social/anbieter/instagram');
    meta.aufrufe = [];
    meta.status.set(String(meta.naechste + 1), ['IN_PROGRESS']);
    const e = { kanal, folge: folge({ medien: [MD(4)], kiInhalt: true }), format: { art: 'video' } as never, text: 'Reel', medien: [sm(MD(4), { art: 'video', typ: 'video/mp4', schnitt: true })], link };
    const r = await instagramAnbieter.posten({ accessToken: 'tok', autor: '17841' }, e);
    expect(r.ok).toBe('warten');
    expect(meta.aufrufe[0].params).toMatchObject({ media_type: 'REELS', share_to_feed: 'true', is_ai_generated: 'true' });
    expect(meta.aufrufe.some(a => a.pfad === 'me/media_publish')).toBe(false);
    const w = (r as { warten: string }).warten;
    expect(w).not.toMatch(/tok/);
    const r2 = await instagramAnbieter.weiter!({ accessToken: 'tok', autor: '17841' }, w, e);
    expect(r2).toMatchObject({ ok: true, externeId: '9001' });
  });
  it('Karussell: je Element ein Kind (is_carousel_item, Video als VIDEO), dann CAROUSEL mit children und caption', async () => {
    const { instagramAnbieter } = await import('@/lib/social/anbieter/instagram');
    meta.aufrufe = [];
    const r = await instagramAnbieter.posten({ accessToken: 'tok', autor: '17841' }, { kanal, folge: folge({ medien: [MD(1), MD(4)] }), format: { art: 'karussell' } as never, text: 'Folien', medien: [sm(MD(1)), sm(MD(4), { art: 'video', typ: 'video/mp4', schnitt: true })], link });
    expect(r.ok).toBe(true);
    const kinder = meta.aufrufe.filter(a => a.pfad === 'me/media' && a.params.is_carousel_item === 'true');
    expect(kinder).toHaveLength(2);
    expect(kinder[1].params).toMatchObject({ media_type: 'VIDEO' });
    const eltern = meta.aufrufe.find(a => a.params.media_type === 'CAROUSEL')!;
    expect(eltern.params.children.split(',')).toHaveLength(2);
    expect(eltern.params.caption).toBe('Folien');
  });
  it('190 → neu verbinden; zu viele Hashtags → nichts gesendet; ohne öffentliche Adresse „kann nicht“', async () => {
    const { instagramAnbieter, igTextPruefen } = await import('@/lib/social/anbieter/instagram');
    meta.fehler190 = true;
    const r = await instagramAnbieter.posten({ accessToken: 'tok', autor: '17841' }, { kanal, folge: folge({ medien: [MD(1)] }), format: { art: 'bild' } as never, text: 'x', medien: [sm(MD(1))], link });
    expect(r).toMatchObject({ ok: false, erneuern: true });
    meta.fehler190 = false;
    expect(igTextPruefen(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' '))).toMatch(/30/);
    const vorher = process.env.MAKE_OS_ADRESSE;
    process.env.MAKE_OS_ADRESSE = '';
    expect(instagramAnbieter.kann(folge({ medien: [MD(1)] }), { art: 'bild' } as never, karte([sm(MD(1))])).ok).toBe(false);
    process.env.MAKE_OS_ADRESSE = vorher;
  });
});

describe('Werkstatt (rein)', () => {
  const a = (x: Partial<WerkstattAuftrag> = {}): WerkstattAuftrag => ({
    id: 'wk-00000000-0000-4000-8000-000000000001', titel: 'T', ziel: 'reel', format: '9:16', untertitel: { an: true, stil: 'klar' }, einblendungen: [], laut: true, status: 'entwurf', von: 'pa', angelegt: '', geaendert: '',
    clips: [{ id: 'wc-aaaa', mediumId: MD(1), von: 2, bis: 6 }, { id: 'wc-bbbb', mediumId: MD(2), von: 0, bis: 3 }],
    transkripte: { [MD(1)]: { segmente: [{ von: 1, bis: 3, text: 'Erster Satz' }, { von: 3, bis: 5.5, text: 'Zweiter Satz' }, { von: 5.9, bis: 9, text: 'zu spät' }], sprache: 'de', am: '' } },
    ...x,
  });
  it('Untertitel auf der Ausgabe-Zeit: abgeschnitten am Ausschnitt, kurze Reste fallen weg', () => {
    expect(untertitelZeilen(a())).toEqual([{ von: 0, bis: 1, text: 'Erster Satz' }, { von: 1, bis: 3.5, text: 'Zweiter Satz' }]);
  });
  it('ASS: Text kann keine Override-Blöcke einschleusen; ohne Text keine Datei', () => {
    expect(assText('Hallo {\\pos(1,1)} \\N du')).toBe('Hallo (/pos(1,1)) /N du');
    const d = assDatei(a({ einblendungen: [{ id: 'we-aaaa', text: 'Hook {x}', von: 0, bis: 2, lage: 'oben' }] }))!;
    expect(d).toContain('PlayResY: 1920');
    expect(d).toContain('Dialogue: 1,0:00:00.00,0:00:02.00,Oben,,0,0,0,,Hook (x)');
    expect(assDatei(a({ untertitel: { an: false, stil: 'klar' }, einblendungen: [] }))).toBeNull();
  });
  it('ffmpeg-Argumente: Ausschnitt je Eingang, Stille ohne Ton, concat, Untertitel, Lautheit, H.264/AAC, faststart; unsichere Pfade abgelehnt', () => {
    const args = reelArgumente(a(), [{ pfad: '/t/a.bin', art: 'video', ton: true }, { pfad: '/t/b.bin', art: 'bild', ton: false }], '/t/text.ass', '/t/aus.mp4', 2);
    const s = args.join(' ');
    expect(s).toContain('-ss 2.00 -t 4.00 -i /t/a.bin');
    expect(s).toContain('-loop 1 -framerate 30 -t 3.00 -i /t/b.bin');
    expect(s).toContain('anullsrc=r=48000:cl=stereo');
    expect(s).toContain('concat=n=2:v=1:a=1');
    expect(s).toContain('subtitles=filename=/t/text.ass');
    expect(s).toContain('loudnorm=I=-14');
    expect(s).toContain('-c:v libx264');
    expect(s).toContain('+faststart');
    expect(args[args.length - 1]).toBe('/t/aus.mp4');
    expect(() => reelArgumente(a(), [{ pfad: "/t/a'.bin", art: 'video', ton: true }, { pfad: '/t/b.bin', art: 'bild', ton: false }], null, '/t/aus.mp4')).toThrow();
  });
  it('Prüfung: Ton nicht freigegeben, Clip länger als Video, Reel unter 3 s', () => {
    const q = new Map([[MD(1), { id: MD(1), art: 'video' as const, dauerSek: 5, ton: 'nicht-freigegeben' }], [MD(2), { id: MD(2), art: 'bild' as const }]]);
    const g = werkstattPruefen(a(), q);
    expect(g.some(x => /Ton/.test(x))).toBe(true);
    expect(g.some(x => /endet nach dem Ende/.test(x))).toBe(true);
    expect(werkstattPruefen(a({ clips: [{ id: 'wc-cccc', mediumId: MD(2), von: 0, bis: 1 }] }), q).some(x => /mindestens 3/.test(x))).toBe(true);
  });
  it('whisper-JSON → Segmente (Geräusche in Klammern fallen weg)', () => {
    expect(whisperSegmente({ transcription: [{ offsets: { from: 0, to: 1200 }, text: ' Hallo zusammen' }, { offsets: { from: 1200, to: 1800 }, text: '[Musik]' }] })).toEqual([{ von: 0, bis: 1.2, text: 'Hallo zusammen' }]);
  });
  it('Vorschlag: nur vorhandene Quellen, Ausschnitt in der Länge, Hook oben; Transkript als Daten gekapselt', () => {
    const quellen = new Map([[MD(1), { id: MD(1), art: 'video' as const, dauerSek: 8, ton: 'an' }], [MD(2), { id: MD(2), art: 'bild' as const }]]);
    const { text, namen } = vorschlagAuftrag(a(), quellen, null, null);
    expect(text).toMatch(/<fremde_daten quelle="transkript-Q1">/);
    expect(text).not.toContain(MD(1));
    const v = vorschlagAus({ clips: [{ quelle: 'Q1', von: 1, bis: 99 }, { quelle: 'Q9', von: 0, bis: 2 }, { quelle: 'Q2', von: 0, bis: 20 }], hook: 'Stark rein', einblendungen: [] }, namen, quellen, 'jetzt')!;
    expect(v.clips).toEqual([{ mediumId: MD(1), von: 1, bis: 8 }, { mediumId: MD(2), von: 0, bis: 5 }]);
    expect(v.einblendungen[0]).toMatchObject({ text: 'Stark rein', lage: 'oben', von: 0 });
    expect(vorschlagAus({ clips: [{ quelle: 'Q9', von: 0, bis: 2 }] }, namen, quellen, 'jetzt')).toBeNull();
  });
});

describe('Community (rein)', () => {
  const kanal = (x: Partial<SocialKanal> = {}): SocialKanal => ({ id: 'sk-1', name: 'K', ziele: [], staende: [], sprache: 'de', plattformen: ['instagram'], kiKanal: false, marke: { nieSagen: ['billig'], saeulen: [] }, leitplanken: { ...LEITPLANKEN_VORGABE, antwortenProTag: 2, dmsProTag: 1 }, status: 'aktiv', geaendert: '', ...x });
  it('Kommentare mit Antworten: eigene = „aus“; DMs: Gegenüber; Fäden mit ungelesen, offen und 24-h-Fenster', () => {
    const k = kommentareAus([{ id: '11', text: 'Super!', timestamp: '2026-10-28T08:00:00+0000', from: { id: '501', username: 'lea' }, replies: { data: [{ id: '12', text: 'Danke', timestamp: '2026-10-28T09:00:00+0000', from: { id: '999' } }] } }], 'sk-1', '77', '999');
    expect(k.map(e => [e.id, e.richtung, e.gegen.name])).toEqual([['11', 'ein', 'lea'], ['12', 'aus', 'lea']]);
    const d = nachrichtenAus([{ id: 'm1', message: 'Frage?', created_time: '2026-10-28T10:00:00+0000', from: { id: '502', username: 'tom' }, to: { data: [{ id: '999' }] } }], 'sk-1', '999');
    const datei: CommunityDatei = { eintraege: Object.fromEntries([...k, ...d].map(e => [e.id, e])), faeden: {} };
    const f = faedenAus(datei, new Set(['sk-1']), Date.parse('2026-10-28T12:00:00Z'));
    expect(f.find(x => x.art === 'dm')).toMatchObject({ titel: '@tom', ungelesen: 1, offen: true, fensterOffen: true });
    expect(f.find(x => x.art === 'kommentar')).toMatchObject({ offen: false, ungelesen: 1 });
    expect(faedenAus(datei, new Set(['sk-1']), Date.parse('2026-10-30T12:00:00Z')).find(x => x.art === 'dm')?.fensterOffen).toBe(false);
    expect(faedenAus(datei, new Set(['sk-andere']))).toEqual([]);
  });
  it('Antworten: Not-Aus, Personenmarke nur die Person, Tageslimit; Text: leer, zu lang, „sagen wir nie“', () => {
    expect(antwortenErlaubt(kanal({ leitplanken: { ...LEITPLANKEN_VORGABE, antwortenAus: true } }), 'pa', 'kommentar', 0)).toMatch(/Not-Aus/);
    expect(antwortenErlaubt(kanal({ art: 'person', person: 'pa' }), 'pb', 'dm', 0)).toMatch(/Person selbst/);
    expect(antwortenErlaubt(kanal(), 'pa', 'dm', 1)).toMatch(/Tageslimit/);
    expect(antwortenErlaubt(kanal(), 'pa', 'kommentar', 1)).toBeNull();
    expect(antwortTextPruefen('   ', 'dm', kanal())).toMatch(/leer/);
    expect(antwortTextPruefen('ä'.repeat(600), 'dm', kanal())).toMatch(/Bytes/);
    expect(antwortTextPruefen('Das ist billig', 'kommentar', kanal())).toMatch(/sagen wir nie/);
  });
});

// ── Server: Veröffentlicher mit Instagram, Werkstatt, Community-Sicht ──
type Route = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
const anfrage = (url: string, person: string, body?: unknown) => new Request(url, body === undefined ? { headers: { 'x-make-user': person } } : { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': person }, body: JSON.stringify(body) });

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
  ], einladungen: [] });
  await (await import('@/lib/zugang/konten')).ladeKonten();
  const { _instagramFetchSetzen } = await import('@/lib/social/anbieter/instagram');
  _instagramFetchSetzen(metaFetch());
});
afterAll(async () => { rmSync(ordner, { recursive: true, force: true }); await fs.rm(`${ordner}-tmp`, { recursive: true, force: true }).catch(() => {}); });

describe('Veröffentlicher mit Instagram (Server)', () => {
  it('Reel: erster Lauf legt den Container an und wartet, der nächste veröffentlicht — genau einmal; Medium-Sperre hält an', async () => {
    const { socialSchreiben, eintragStand, ladeSocial } = await import('@/lib/social/server');
    const jetzt = new Date('2026-11-02T08:00:00Z');
    let r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Insta', plattformen: ['instagram'], leitplanken: { autonomie: 2 }, marke: { saeulen: [], nieSagen: [] } } }], 'pa', undefined, jetzt);
    if (!r.ok) throw new Error(r.fehler);
    const kanalId = r.geaendert[0];
    r = await socialSchreiben([{ op: 'format', eintrag: { kanalId, name: 'Reel', art: 'video' } }], 'pa', undefined, jetzt);
    if (!r.ok) throw new Error(r.fehler);
    const fmt = r.datei.formate.find(f => f.kanalId === kanalId)!;
    r = await socialSchreiben([{ op: 'format-freigeben', id: fmt.id, freigeben: true, stand: eintragStand(fmt) }], 'pa', undefined, jetzt);
    if (!r.ok) throw new Error(r.fehler);
    ablage.medien.set(MD(10), sm(MD(10), { art: 'video', typ: 'video/mp4', schnitt: true }) as never);
    r = await socialSchreiben([{ op: 'folge', eintrag: { kanalId, formatId: fmt.id, titel: 'Erstes Reel', skript: 'Kurz und klar erzählt, ohne Zahlen.', hooks: [{ text: 'Kennst du das?' }], cta: 'Folgen', medien: [MD(10)], kiInhalt: false, status: 'geplant', geplantAm: '2026-11-03', geplantUm: '09:00' } }], 'pa', undefined, jetzt);
    if (!r.ok) throw new Error(r.fehler);
    const folgeId = r.geaendert[0];
    const { verbindungSetzen } = await import('@/lib/social/verbindungen');
    await verbindungSetzen({ kanalId, plattform: 'instagram', anbieter: 'instagram', konto: '@probe', verbundenVon: 'pa', geheim: { accessToken: 'tok', autor: '17841', ablauf: Date.parse('2026-12-30T00:00:00Z') } });
    const { socialVeroeffentlichenLauf } = await import('@/lib/social/veroeffentlichen-server');
    meta.aufrufe = [];
    meta.status.set(String(meta.naechste + 1), ['IN_PROGRESS']);
    const lauf1 = await socialVeroeffentlichenLauf(new Date('2026-11-03T08:05:00Z'));
    expect(lauf1.gepostet).toHaveLength(0);
    let f = (await ladeSocial()).folgen.find(x => x.id === folgeId)!;
    expect(f.versuche?.[0]).toMatchObject({ zustand: 'laeuft', warten: expect.any(String) });
    expect(meta.aufrufe[0].params.video_url).toMatch(/^https:\/\/make\.example\.invalid\/api\/social\/medien\/sm-[a-f0-9]{32}\.mp4$/);
    const lauf2 = await socialVeroeffentlichenLauf(new Date('2026-11-03T08:06:00Z'));
    expect(lauf2.gepostet).toEqual([{ folgeId, plattform: 'instagram' }]);
    f = (await ladeSocial()).folgen.find(x => x.id === folgeId)!;
    expect(f.veroeffentlicht[0]).toMatchObject({ plattform: 'instagram', externeId: '9001', durch: 'automatik' });
    expect((await socialVeroeffentlichenLauf(new Date('2026-11-03T08:07:00Z'))).gepostet).toHaveLength(0);
    // Widerruf in der Ablage: die nächste Folge mit diesem Medium geht nicht raus (Prüfer stoppt).
    ablage.medien.set(MD(10), sm(MD(10), { art: 'video', typ: 'video/mp4', schnitt: true, status: 'gesperrt' }) as never);
    r = await socialSchreiben([{ op: 'folge', eintrag: { kanalId, formatId: fmt.id, titel: 'Zweites Reel', skript: 'Ein ganz anderer Gedanke über Ruhe am Morgen.', hooks: [{ text: 'Morgens?' }], cta: 'Folgen', medien: [MD(10)], kiInhalt: false, status: 'geplant', geplantAm: '2026-11-04', geplantUm: '09:00' } }], 'pa', undefined, jetzt);
    if (!r.ok) throw new Error(r.fehler);
    expect((await socialVeroeffentlichenLauf(new Date('2026-11-04T08:05:00Z'))).gepostet).toHaveLength(0);
  });
});

describe('Reel-Werkstatt (Server, Werkzeuge nachgebaut)', () => {
  let route: Route;
  const URL_W = 'http://test/api/social/werkstatt';
  it('anlegen → Untertitel (whisper) → rendern: Medium abgelegt, an den Beitrag gehängt, Freigabe fällt zurück', async () => {
    route = (await import('@/app/api/social/werkstatt/route')) as unknown as Route;
    ablage.medien.set(MD(20), { id: MD(20), art: 'video', dauerSek: 12, ton: 'an' });
    ablage.medien.set(MD(21), { id: MD(21), art: 'bild' });
    const { socialSchreiben, ladeSocial } = await import('@/lib/social/server');
    let r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Werkstattkanal', plattformen: ['instagram'] } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const kanalId = r.geaendert[0];
    r = await socialSchreiben([{ op: 'folge', eintrag: { kanalId, titel: 'Mit Reel', skript: 'x', hooks: [{ text: 'Hook aus dem Beitrag' }], status: 'freigegeben' } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const folgeId = r.geaendert[0];
    expect((await ladeSocial()).folgen.find(f => f.id === folgeId)!.freigegebenAm).toBeTruthy();
    let res = await route.POST(anfrage(URL_W, 'pa', { aktion: 'anlegen', kanalId, folgeId, ziel: 'reel', medien: [MD(20), MD(21)] }));
    let j = await res.json();
    expect(res.status).toBe(200);
    let a = j.auftraege.find((x: { id: string }) => x.id === j.auftrag);
    expect(a.einblendungen[0]).toMatchObject({ text: 'Hook aus dem Beitrag', lage: 'oben' });
    expect(a.clips.map((c: { bis: number }) => c.bis)).toEqual([12, 3]);
    werkzeug.whisper = { transcription: [{ offsets: { from: 500, to: 2500 }, text: ' Guten Morgen' }] };
    res = await route.POST(anfrage(URL_W, 'pa', { aktion: 'untertitel', id: a.id, stand: a.stand }));
    expect(res.status).toBe(200);
    const { werkstattJobsImTakt, ladeWerkstatt, werkstattLaeuft } = await import('@/lib/social/werkstatt/server');
    // Die Route stößt die Arbeit selbst an — warten, bis der Lauf durch ist (dann noch einmal, falls nichts lief).
    const bisFertig = async () => { for (let i = 0; i < 100 && werkstattLaeuft(); i++) await new Promise(r => setTimeout(r, 20)); await werkstattJobsImTakt(); };
    await bisFertig();
    let neu = (await ladeWerkstatt()).find(x => x.id === a.id)!;
    expect(neu.transkripte[MD(20)].segmente).toEqual([{ von: 0.5, bis: 2.5, text: 'Guten Morgen' }]);
    expect(werkzeug.aufrufe.some(x => x.bin.includes('whisper') && x.args.includes('-l') && x.args.includes('de'))).toBe(true);
    j = await (await route.GET(anfrage(URL_W, 'pa'))).json();
    a = j.auftraege.find((x: { id: string }) => x.id === neu.id);
    res = await route.POST(anfrage(URL_W, 'pa', { aktion: 'rendern', id: a.id, stand: a.stand }));
    expect(res.status).toBe(200);
    await bisFertig();
    neu = (await ladeWerkstatt()).find(x => x.id === a.id)!;
    expect(neu).toMatchObject({ status: 'fertig', ergebnis: 'md-00000000-0000-4000-8000-0000000000aa' });
    const abgelegt = ablage.abgelegt[ablage.abgelegt.length - 1];
    expect(abgelegt).toMatchObject({ person: 'pa', quellen: [MD(20), MD(21)], dauerSek: 15 });
    const ff = werkzeug.aufrufe.find(x => x.args.includes('-filter_complex'))!;
    expect(ff.args.join(' ')).toContain('concat=n=2');
    const folge = (await ladeSocial()).folgen.find(f => f.id === folgeId)!;
    expect(folge.medien).toEqual(['md-00000000-0000-4000-8000-0000000000aa']);
    expect(folge.freigegebenAm).toBeUndefined();
    expect(folge.status).toBe('entwurf');
    // Arbeitsordner ist wieder weg (entschlüsselte Clips liegen nie länger als der Lauf).
    expect((await fs.readdir(`${ordner}-tmp/make-werkstatt`).catch(() => [])).length).toBe(0);
  });
  it('Stand veraltet → 409; Dienstweg → 403; fremder „nur ich“-Kanal: Auftrag unsichtbar', async () => {
    const j = await (await route.GET(anfrage(URL_W, 'pa'))).json();
    const a = j.auftraege[0];
    expect((await route.POST(anfrage(URL_W, 'pa', { aktion: 'aendern', id: a.id, stand: 'alt', felder: { titel: 'x' } }))).status).toBe(409);
    const dienst = new Request(URL_W, { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-social-ig', 'x-make-person': 'pa' }, body: '{}' });
    expect([401, 403]).toContain((await route.POST(dienst)).status);
    const { socialSchreiben } = await import('@/lib/social/server');
    const r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Nur Anna', art: 'person', person: 'pa', sichtbarkeit: 'person', plattformen: ['instagram'] } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const res = await route.POST(anfrage(URL_W, 'pa', { aktion: 'anlegen', kanalId: r.geaendert[0], ziel: 'bild', medien: [MD(21)] }));
    const id = (await res.json()).auftrag;
    const b = await (await route.GET(anfrage(URL_W, 'pb'))).json();
    expect(b.auftraege.some((x: { id: string }) => x.id === id)).toBe(false);
    expect((await route.POST(anfrage(URL_W, 'pb', { aktion: 'anlegen', kanalId: r.geaendert[0], ziel: 'bild', medien: [MD(21)] }))).status).toBe(404);
  });
});

describe('Kommentare & DMs (Server)', () => {
  it('abholen → Fäden; antworten per Klick (Kommentar-Antwort, DM nur im Fenster); fremder „nur ich“-Kanal liefert nichts', async () => {
    const route = (await import('@/app/api/social/community/route')) as unknown as Route;
    const URL_C = 'http://test/api/social/community';
    const { socialSchreiben } = await import('@/lib/social/server');
    const r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Annas Insta', art: 'person', person: 'pa', sichtbarkeit: 'person', plattformen: ['instagram'] } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const kanalId = r.geaendert[0];
    const { verbindungSetzen } = await import('@/lib/social/verbindungen');
    await verbindungSetzen({ kanalId, plattform: 'instagram', anbieter: 'instagram', verbundenVon: 'pa', geheim: { accessToken: 'tok2', autor: '999' } });
    const jetzt = new Date().toISOString();
    const { _instagramFetchSetzen } = await import('@/lib/social/anbieter/instagram');
    const gesendet: Record<string, string>[] = [];
    _instagramFetchSetzen((async (url: string | URL, init?: RequestInit) => {
      const u = new URL(String(url));
      const p = u.pathname.replace(/^\/v\d+\.\d+\//, '');
      const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
      if (init?.method === 'POST') { gesendet.push({ pfad: p, ...Object.fromEntries(new URLSearchParams(String(init.body))) }); return json(p === 'me/messages' ? { message_id: 'mid-x' } : { id: '13' }); }
      if (p === 'me/media') return json({ data: [{ id: '77', caption: 'Morgenroutine' }] });
      if (p === '77/comments') return json({ data: [{ id: '11', text: 'Wie lange machst du das schon?', timestamp: jetzt, from: { id: '501', username: 'lea' } }] });
      if (p === 'me/conversations') return json({ data: [{ messages: { data: [{ id: 'm1', message: 'Hi!', created_time: jetzt, from: { id: '502', username: 'tom' }, to: { data: [{ id: '999' }] } }] } }] });
      return json({});
    }) as typeof fetch);
    let res = await route.POST(anfrage(URL_C, 'pa', { aktion: 'abholen', kanalId }));
    let j = await res.json();
    expect(j.neu).toBe(2);
    const km = j.faeden.find((f: { art: string }) => f.art === 'kommentar');
    const dm = j.faeden.find((f: { art: string }) => f.art === 'dm');
    expect(km.titel).toContain('Morgenroutine');
    res = await route.POST(anfrage(URL_C, 'pa', { aktion: 'antworten', kanalId, faden: km.id, text: 'Seit zwei Jahren!' }));
    expect(res.status).toBe(200);
    expect(gesendet[0]).toMatchObject({ pfad: '11/replies', message: 'Seit zwei Jahren!' });
    res = await route.POST(anfrage(URL_C, 'pa', { aktion: 'antworten', kanalId, faden: dm.id, text: 'Hallo zurück' }));
    expect(res.status).toBe(200);
    expect(gesendet[1].pfad).toBe('me/messages');
    expect(JSON.parse(gesendet[1].recipient)).toEqual({ id: '502' });
    j = await res.json();
    expect(j.faeden.find((f: { id: string }) => f.id === dm.id).offen).toBe(false);
    // Bert sieht den „nur ich“-Kanal nicht — keine Fäden, Antworten 404.
    const b = await (await route.GET(anfrage(URL_C, 'pb'))).json();
    expect(b.faeden).toEqual([]);
    expect((await route.POST(anfrage(URL_C, 'pb', { aktion: 'antworten', kanalId, faden: dm.id, text: 'x' }))).status).toBe(404);
    expect(JSON.stringify(b)).not.toMatch(/tok2|Wie lange/);
  });
});

// ── Malin-Paket Teil 2: Beschriftung, Kalender, beste Zeiten, Auto-Reel ──
describe('Beschriftung, Kalender, beste Zeiten (rein)', () => {
  it('Beschriftung ist der Post-Text; zu viele Hashtags stoppt; der Agent schreibt sie nur für Bild/Karussell/Video', async () => {
    const { postText } = await import('@/lib/social/anbieter/typen');
    expect(postText({ skript: 'Gesprochen', cta: 'Folgen', beschriftung: 'Unter dem Reel #a' })).toBe('Unter dem Reel #a');
    expect(postText({ skript: 'Text', cta: 'Folgen' })).toBe('Text\n\nFolgen');
    const { folgePruefen } = await import('@/lib/social/pruefer');
    const kanal = { id: 'sk-1', name: 'K', ziele: [], staende: [], sprache: 'de', plattformen: ['instagram'], kiKanal: false, marke: { nieSagen: [], saeulen: [] }, leitplanken: LEITPLANKEN_VORGABE, status: 'aktiv', geaendert: '' } as SocialKanal;
    const f = { id: 'sv-1', kanalId: 'sk-1', titel: 'T', skript: 'Ein Satz.', hooks: [{ id: 'hk-1', text: 'H' }], quellen: [], kiInhalt: false, status: 'entwurf', veroeffentlicht: [], messungen: [], geaendert: '', beschriftung: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ') } as never;
    expect(folgePruefen(f, { kanal, andere: [] }).some(b => b.code === 'hashtags' && b.stufe === 'stopp')).toBe(true);
    const { entwurfAus } = await import('@/lib/social/agent');
    const l = { platz: '2026-11-03T18:00' };
    expect(entwurfAus({ titel: 'T', hooks: [{ text: 'H' }], skript: 'S', cta: 'C', beschriftung: 'B #x' }, kanal, l, 'video')).toMatchObject({ beschriftung: 'B #x' });
    expect(entwurfAus({ titel: 'T', hooks: [{ text: 'H' }], skript: 'S', cta: 'C', beschriftung: 'B #x' }, kanal, l, 'text')?.beschriftung).toBeUndefined();
  });
  it('Kalender: Woche Mo–So, Monat volle Wochen; Beiträge + freie Plätze je Tag, Farbe aus den Post-Schritten', async () => {
    const { kalenderTage, kalenderEintraege, tonVon } = await import('@/lib/social/kalender');
    expect(kalenderTage('woche', '2026-11-05')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    const m = kalenderTage('monat', '2026-11-15');
    expect(m[0]).toBe('2026-10-26'); expect(m[m.length - 1]).toBe('2026-12-06'); expect(m.length % 7).toBe(0);
    const folgen = [{ id: 'sv-a', kanalId: 'sk-1', titel: 'A', status: 'geplant', geplantAm: '2026-11-03', geplantUm: '09:00', medien: [MD(1)] }, { id: 'sv-b', kanalId: 'sk-1', titel: 'B', status: 'entwurf', geplantAm: '2026-11-03' }, { id: 'sv-c', kanalId: 'sk-2', titel: 'fremd', status: 'geplant', geplantAm: '2026-11-03' }] as never[];
    const e = kalenderEintraege({ id: 'sk-1', plan: undefined }, folgen, [{ platz: '2026-11-05T18:00', saeule: 'Mut' }], { 'sv-a': [{ plattform: 'instagram', zustand: 'geplant', grund: '' }] }, kalenderTage('woche', '2026-11-05'));
    expect(e.get('2026-11-03')!.map(x => [x.id, x.uhrzeit, x.ton])).toEqual([['sv-a', '09:00', 'automatisch'], ['sv-b', '18:00', 'entwurf']]);
    expect(e.get('2026-11-05')![0]).toMatchObject({ art: 'platz', ton: 'frei', titel: 'frei · Mut' });
    expect(tonVon({ status: 'geplant' }, [{ plattform: 'instagram', zustand: 'unklar', grund: '' }])).toBe('problem');
  });
  it('Beste Zeiten: erst ab 8 eigenen Beiträgen, Median je Tag und Stunde, nie aus fremden Daten', async () => {
    const { besteZeiten } = await import('@/lib/social/zeiten');
    const b = (i: number, tag: string, um: string, views: number) => ({ id: `sv-z${i}`, kanalId: 'sk-1', titel: `${i}`, status: 'veroeffentlicht', geplantAm: tag, geplantUm: um, veroeffentlicht: [{ plattform: 'instagram', am: tag }], messungen: [{ id: `m${i}`, plattform: 'instagram', am: tag, views, quelle: 'api' }] });
    const wenige = besteZeiten({ id: 'sk-1' }, [b(1, '2026-11-03', '18:00', 100)] as never[]);
    expect(wenige.genug).toBe(false);
    // Di 07:00 klar besser als Do 18:00.
    const l = [b(1, '2026-11-03', '07:00', 900), b(2, '2026-11-10', '07:00', 1100), b(3, '2026-11-17', '07:00', 1000), b(4, '2026-11-24', '07:00', 950),
      b(5, '2026-11-05', '18:00', 200), b(6, '2026-11-12', '18:00', 300), b(7, '2026-11-19', '18:00', 250), b(8, '2026-11-26', '18:00', 280)];
    const z = besteZeiten({ id: 'sk-1' }, l as never[]);
    expect(z.genug).toBe(true);
    expect(z.empfehlung).toEqual({ tag: 2, stunde: 7 });
    expect(z.tage[0]).toMatchObject({ name: 'Di', median: 975, beitraege: 4 });
  });
});

describe('Auto-Reel (Server, Werkzeuge und KI nachgebaut)', () => {
  it('neuer Rohclip im Album → Untertitel → KI-Schnitt → Rendern → Entwurf im nächsten freien Termin mit Reel, Hook und Beschriftung; kein zweites Mal', async () => {
    const db = await import('@/lib/store/local-db');
    const { karteiHaushalt } = await import('@/lib/crm/sperrliste');
    const roh = MD(30);
    ablage.medien.set(roh, { id: roh, art: 'video', dauerSek: 40, ton: 'an' });
    await db.saveJson(`medien--${await karteiHaushalt()}`, { medien: [{ id: roh, art: 'video', bereich: 'business', album: 'al-rohclips', hochgeladen: new Date().toISOString(), ton: 'an', personen: [], marketing: { status: 'intern' }, urheber: { art: 'team' } }], alben: [], einwilligungen: [] });
    const { socialSchreiben, ladeSocial, eintragStand } = await import('@/lib/social/server');
    let r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Auto-Kanal', plattformen: ['instagram'], marke: { saeulen: ['Alltag'], nieSagen: [], cta: 'Folgen!' } } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const kanalId = r.geaendert[0];
    const k = r.datei.kanaele.find(x => x.id === kanalId)!;
    r = await socialSchreiben([{ op: 'plan', kanalId, stand: eintragStand(k), plan: { tage: [1, 2, 3, 4, 5, 6, 7], uhrzeit: '18:00', vorlauf: 7, autoReel: true, rohAlbum: 'al-rohclips' } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    werkzeug.whisper = { transcription: [{ offsets: { from: 1000, to: 6000 }, text: ' Mein Morgen beginnt draußen.' }, { offsets: { from: 6000, to: 12000 }, text: ' Zehn Minuten ohne Handy.' }] };
    modell.text = JSON.stringify({ clips: [{ quelle: 'Q1', von: 1, bis: 12 }], hook: 'Mein Morgen ohne Handy', einblendungen: [], titel: 'Morgen draußen', beschriftung: 'Zehn Minuten nur für mich. Wie startest du? #morgenroutine #alltag' });
    const { autoReelScan } = await import('@/lib/social/werkstatt/auto');
    const { werkstattJobsImTakt, werkstattLaeuft, ladeWerkstatt } = await import('@/lib/social/werkstatt/server');
    expect((await autoReelScan()).neu).toBe(1);
    for (let i = 0; i < 4; i++) { for (let j = 0; j < 100 && werkstattLaeuft(); j++) await new Promise(x => setTimeout(x, 20)); await werkstattJobsImTakt(); }
    const a = (await ladeWerkstatt()).find(x => x.clips.some(c => c.mediumId === roh))!;
    expect(a).toMatchObject({ status: 'fertig', auto: { schritt: 'fertig' }, ergebnis: expect.stringMatching(/^md-/) });
    expect(a.clips).toEqual([expect.objectContaining({ mediumId: roh, von: 1, bis: 12 })]);
    const f = (await ladeSocial()).folgen.find(x => x.kanalId === kanalId)!;
    expect(f).toMatchObject({ status: 'entwurf', quelle: 'agent', medien: [a.ergebnis], beschriftung: expect.stringContaining('#morgenroutine'), cta: 'Folgen!', titel: 'Morgen draußen' });
    expect(f.hooks[0].text).toBe('Mein Morgen ohne Handy');
    expect(f.skript).toContain('Zehn Minuten ohne Handy.');
    expect(f.geplantAm).toBeTruthy();
    expect(a.folgeId).toBe(f.id);
    expect((await autoReelScan()).neu).toBe(0);
  });
  it('ohne KI: der Anfang des Clips (≤ 60 s), Beitrag trotzdem als Entwurf', async () => {
    const db = await import('@/lib/store/local-db');
    const { karteiHaushalt } = await import('@/lib/crm/sperrliste');
    const name = `medien--${await karteiHaushalt()}`;
    const kat = await db.loadJson<{ medien: unknown[] }>(name);
    const roh = MD(31);
    ablage.medien.set(roh, { id: roh, art: 'video', dauerSek: 90, ton: 'keiner' });
    await db.saveJson(name, { ...kat, medien: [...(kat?.medien ?? []), { id: roh, art: 'video', bereich: 'business', album: 'al-rohclips', hochgeladen: new Date().toISOString(), ton: 'keiner', personen: [], marketing: { status: 'intern' }, urheber: { art: 'team' } }] });
    modell.text = 'kein json';
    const { autoReelScan } = await import('@/lib/social/werkstatt/auto');
    const { werkstattJobsImTakt, werkstattLaeuft, ladeWerkstatt } = await import('@/lib/social/werkstatt/server');
    expect((await autoReelScan()).neu).toBe(1);
    for (let i = 0; i < 4; i++) { for (let j = 0; j < 100 && werkstattLaeuft(); j++) await new Promise(x => setTimeout(x, 20)); await werkstattJobsImTakt(); }
    const a = (await ladeWerkstatt()).find(x => x.clips.some(c => c.mediumId === roh))!;
    expect(a.clips[0]).toMatchObject({ von: 0, bis: 60 });
    expect(a.auto?.schritt).toBe('fertig');
    expect(a.folgeId).toBeTruthy();
  });
});

// ── Antwort-Agent (28.10.): Auto nur mit Leitplanken, nie bei anderen ──
describe('Antwort-Agent (rein)', () => {
  it('Einordnung: Spam, Beratung/Preis, Kritik → Mensch; Frage und Freundliches → Auto möglich', async () => {
    const { antwortKlasse } = await import('@/lib/social/community-agent');
    expect(antwortKlasse('Check my page https://x.example')).toBe('spam');
    expect(antwortKlasse('Was kostet das Coaching?')).toBe('heikel');
    expect(antwortKlasse('Hilft das bei Rückenschmerzen? Diagnose?')).toBe('heikel');
    expect(antwortKlasse('Ehrlich enttäuscht von dem Video')).toBe('kritik');
    expect(antwortKlasse('Wie lange trainierst du schon?')).toBe('frage');
    expect(antwortKlasse('Mega stark 🔥')).toBe('freundlich');
    expect(antwortKlasse('ok')).toBe('sonst');
  });
  it('Leitplanken: Modus, Not-Aus, DMs nur mit Schalter + Fenster, Limit, Mindestabstand; Hinweis und Zeichen; Ähnlichkeit', async () => {
    const { autoGrund, mitHinweis, zuAehnlich, AGENT } = await import('@/lib/social/community-agent');
    const k = (c: Partial<import('@/lib/social/typen').CommunityEinstellung> = {}, lp = {}) => ({ id: 'sk-1', name: 'K', ziele: [], staende: [], sprache: 'de', plattformen: ['instagram'], kiKanal: false, marke: { nieSagen: [], saeulen: [] }, leitplanken: { ...LEITPLANKEN_VORGABE, antwortenProTag: 3, ...lp }, status: 'aktiv', geaendert: '', community: { modus: 'auto', dmsAuto: false, hinweisDm: 'KI-Hinweis.', zeichen: ' · KI', wunsch: [], fremdJeTag: 3, ...c } }) as SocialKanal;
    const o = { heuteSchon: 0, jetzt: 1_000_000 };
    expect(autoGrund(k({ modus: 'vorschlag' }), { art: 'kommentar' }, 'frage', o)).toMatch(/Vorschlag/);
    expect(autoGrund(k({}, { antwortenAus: true }), { art: 'kommentar' }, 'frage', o)).toMatch(/Not-Aus/);
    expect(autoGrund(k(), { art: 'dm', fensterOffen: true }, 'frage', o)).toMatch(/DMs/);
    expect(autoGrund(k({ dmsAuto: true }), { art: 'dm', fensterOffen: false }, 'frage', o)).toMatch(/24/);
    expect(autoGrund(k(), { art: 'kommentar' }, 'kritik', o)).toMatch(/Kritik/);
    expect(autoGrund(k(), { art: 'kommentar' }, 'frage', { ...o, heuteSchon: 3 })).toMatch(/Tageslimit/);
    expect(autoGrund(k(), { art: 'kommentar' }, 'frage', { ...o, letzteAutoMs: 1_000_000 - 30_000 })).toMatch(/Mindestabstand/);
    expect(autoGrund(k(), { art: 'kommentar' }, 'freundlich', o)).toBeNull();
    expect(mitHinweis('Danke!', k(), { art: 'kommentar', eintraege: [] })).toBe('Danke! · KI');
    expect(mitHinweis('Gern', k(), { art: 'dm', eintraege: [] })).toBe('Gern\n\nKI-Hinweis.');
    expect(mitHinweis('Gern', k(), { art: 'dm', eintraege: [{ richtung: 'aus', durch: AGENT } as never] })).toBe('Gern');
    expect(zuAehnlich('Danke dir, das freut uns sehr!', ['Danke dir, das freut uns sehr! · KI'])).toBe(true);
    expect(zuAehnlich('Seit zwei Jahren, jeden Morgen.', ['Danke dir, das freut uns sehr!'])).toBe(false);
  });
});

describe('Antwort-Agent (Server, Probe)', () => {
  it('Auto: Frage beantwortet ZOE selbst (mit Zeichen), Kritik und DM werden Entwürfe; gleiche Antwort nie zweimal; Personenmarke-Auto nur die Person', async () => {
    const { socialSchreiben, eintragStand } = await import('@/lib/social/server');
    let r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Antwort-Kanal', plattformen: ['instagram'], community: { modus: 'auto', zeichen: ' · KI' } } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const kanalId = r.geaendert[0];
    const res = await (await import('@/app/api/social/route')).POST(new Request('http://test/api/social', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'pa' }, body: JSON.stringify({ aktion: 'probe-verbinden', kanalId, plattform: 'instagram' }) }));
    expect(res.status).toBe(200);
    const db = await import('@/lib/store/local-db');
    const { communitySpeicher, ladeCommunity } = await import('@/lib/social/community');
    const jetzt = new Date();
    const e = (id: string, art: 'kommentar' | 'dm', text: string, mediaId?: string) => ({ id, art, kanalId, richtung: 'ein', gegen: { id: `g-${id}`, name: `n${id}` }, text, am: new Date(jetzt.getTime() - 60_000).toISOString(), ...(mediaId ? { mediaId } : {}) });
    const alt = (await db.loadJson<Record<string, unknown>>(await communitySpeicher())) ?? {};
    await db.saveJson(await communitySpeicher(), { ...alt, eintraege: { ...((alt.eintraege as object) ?? {}), a1: e('a1', 'kommentar', 'Wie oft trainierst du pro Woche?', 'm1'), a2: e('a2', 'kommentar', 'Total enttäuscht von dem Tipp', 'm2'), a3: e('a3', 'dm', 'Hi, eine Frage?') }, faeden: (alt.faeden as object) ?? {} });
    modell.text = 'Meist viermal, mit einem Ruhetag dazwischen.';
    const { communityAgentLauf } = await import('@/lib/social/community-agent');
    const erg = await communityAgentLauf(jetzt);
    expect(erg).toMatchObject({ gesendet: 1, entwuerfe: 2 });
    let d = await ladeCommunity();
    const aus = Object.values(d.eintraege).filter(x => x.kanalId === kanalId && x.richtung === 'aus');
    expect(aus).toHaveLength(1);
    expect(aus[0]).toMatchObject({ durch: 'zoe', text: 'Meist viermal, mit einem Ruhetag dazwischen. · KI', parentId: 'a1' });
    expect(d.entwuerfe![`km~${kanalId}~m2`].grund).toMatch(/Kritik/);
    expect(d.entwuerfe![`dm~${kanalId}~g-a3`].grund).toMatch(/DMs/);
    // Zweiter Lauf: nichts doppelt.
    expect(await communityAgentLauf(new Date(jetzt.getTime() + 200_000))).toMatchObject({ gesendet: 0, entwuerfe: 0 });
    // Neue Frage, gleiche KI-Antwort → zu ähnlich → Entwurf statt Senden.
    d = await ladeCommunity();
    await db.saveJson(await communitySpeicher(), { ...d, eintraege: { ...d.eintraege, a4: { ...e('a4', 'kommentar', 'Wie oft machst du Pause?', 'm3'), am: new Date(jetzt.getTime() + 100_000).toISOString() } } });
    const erg2 = await communityAgentLauf(new Date(jetzt.getTime() + 300_000));
    expect(erg2).toMatchObject({ gesendet: 0, entwuerfe: 1 });
    expect((await ladeCommunity()).entwuerfe![`km~${kanalId}~m3`].grund).toMatch(/ähnlich/);
    // Personenmarke: Auto schaltet nur die Person selbst.
    r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Annas Marke IG', art: 'person', person: 'pa', plattformen: ['instagram'] } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const marke = r.datei.kanaele.find(x => x.id === r.geaendert[0])!;
    const nein = await socialSchreiben([{ op: 'kanal', eintrag: { id: marke.id, community: { modus: 'auto' } }, stand: eintragStand(marke) }], 'pb');
    expect(nein.ok ? 200 : nein.status).toBe(403);
    const ja = await socialSchreiben([{ op: 'kanal', eintrag: { id: marke.id, community: { modus: 'auto' } }, stand: eintragStand(marke) }], 'pa');
    expect(ja.ok).toBe(true);
  });
  it('Bei anderen: nur Beitrags-Links, Entwurf gespeichert, fremder Text NICHT', async () => {
    const route = (await import('@/app/api/social/community/route')) as unknown as Route;
    const { socialSchreiben } = await import('@/lib/social/server');
    const r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Fremd-Kanal', plattformen: ['instagram'] } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const kanalId = r.geaendert[0];
    const URL_C = 'http://test/api/social/community';
    expect((await route.POST(anfrage(URL_C, 'pa', { aktion: 'fremd-entwurf', kanalId, link: 'https://evil.example/p/abc', text: 'x' }))).status).toBe(400);
    modell.text = 'Spannender Gedanke — wie hältst du das im Winter durch?';
    const res = await route.POST(anfrage(URL_C, 'pa', { aktion: 'fremd-entwurf', kanalId, link: 'https://www.instagram.com/p/AbCdEf123/', text: 'GEHEIMER FREMDTEXT über Wintertraining' }));
    expect(res.status).toBe(200);
    const j = await res.json();
    const f = j.fremd.find((x: { kanalId: string }) => x.kanalId === kanalId);
    expect(f).toMatchObject({ entwurf: 'Spannender Gedanke — wie hältst du das im Winter durch?', link: 'https://www.instagram.com/p/AbCdEf123/' });
    const { communitySpeicher } = await import('@/lib/social/community');
    const db = await import('@/lib/store/local-db');
    expect(JSON.stringify(await db.loadJson(await communitySpeicher()))).not.toContain('GEHEIMER FREMDTEXT');
    expect((await route.POST(anfrage(URL_C, 'pa', { aktion: 'fremd-erledigt', kanalId, id: f.id }))).status).toBe(200);
  });
});
