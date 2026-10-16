// ─── Laufzeit-Probe: kein Betreiber-Wissen in einer Demo-Instanz (15.10., Abnahme 2 A2/C22 — Wächter zu tests/oberflaeche-neutral.test.ts) ─
// Kevin: „Betreiber-Inhalte nur in der eigenen Instanz.“ Eine frisch gesäte Demo (MAKE_OS_DEMO=1 — der Demo-Riegel macht sie nie zur
// Betreiber-Instanz, auch nicht mit MAKE_OS_BETREIBER=an) wird über die echten Routen gelesen: Head of IT, Selbstprüfung, Empfänger-Register,
// Verzeichnis, Nachweise, Einrichtung (Schritte, Etappen, Zonen), Verbindungen (WhatsApp, ZOE-WhatsApp, WHOOP, Google, OAuth) und das
// Bauplan-Board. In keiner Antwort und in keinem Text, den die Oberfläche daraus zeigt, steht Betreiber-Wissen (`BETREIBER_WISSEN` +
// Hersteller-Sätze des Bauplans). Eigener Datenordner (vi.hoisted — vor allen Imports), erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const { wurzel } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-betreiber-probe-'));
  const ordner = p.join(wurzel, 'daten');
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: ordner, MAKE_VAULT_DIR: p.join(ordner, 'wissen'), MAKE_OS_KEY: 'pruef-schluessel-betreiber', MAKE_OS_OHNE_APPLE: '1',
    MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_INTERN: 'http://127.0.0.1:3999',
    NEXT_PUBLIC_MAKE_OS_CRM_TEAM: JSON.stringify([{ id: 'lena', name: 'Lena', farbe: '#58D9CD', verantwortet: ['sales'] }, { id: 'jonas', name: 'Jonas', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] }]),
    NEXT_PUBLIC_MAKE_OS_EINHEITEN: JSON.stringify({ kdc: { label: 'Beispiel Beratung', kurz: 'Beratung' }, kdv: { label: 'Beispiel Holding', kurz: 'Holding' }, ug: { label: 'Beispiel Labs GmbH', kurz: 'Labs' } }),
  });
  delete process.env.MAKE_OS_DATENSCHLUESSEL; delete process.env.MAKE_OS_DEMO; delete process.env.MAKE_OS_BETREIBER; delete process.env.MAKE_OS_ADRESSE;
  for (const k of ['ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN', 'WHOOP_CLIENT_ID', 'WHOOP_CLIENT_SECRET', 'MS_CLIENT_ID',
    'WHATSAPP_TELEFONNUMMER_ID', 'WHATSAPP_ZUGRIFFSSCHLUESSEL', 'WHATSAPP_ZOE_TELEFONNUMMER_ID']) delete process.env[k];
  return { wurzel };
});

import { BETREIBER_WISSEN } from '@/lib/betrieb/betreiber';
import { localDay } from '@/lib/zeit';

const BETREIBER_TEXT = new RegExp(`${BETREIBER_WISSEN.source}|Claude baut|baut Claude`);
type Handler = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const treffer = (wo: string, x: unknown): string | null => { const m = (typeof x === 'string' ? x : JSON.stringify(x)).match(BETREIBER_TEXT); return m ? `${wo}: „${m[0]}“` : null; };

beforeAll(async () => {
  const server = await import('@/lib/demo/server');
  await server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-betreiber', heute: localDay() });
  process.env.MAKE_OS_DEMO = '1';
  process.env.MAKE_OS_BETREIBER = 'an'; // der Demo-Riegel gewinnt — auch so keine Betreiber-Instanz
}, 300_000);
afterAll(() => {
  delete process.env.MAKE_OS_DEMO; delete process.env.MAKE_OS_BETREIBER;
  rmSync(wurzel, { recursive: true, force: true });
});

describe('Demo-Instanz: kein Betreiber-Wissen in Antworten und Texten (Abnahme 2 A2/C22)', () => {
  it('die Demo ist keine Betreiber-Instanz', async () => {
    const { istBetreiberInstanz } = await import('@/lib/betrieb/betreiber-server');
    expect(await istBetreiberInstanz()).toBe(false);
  });

  it('Head of IT, Selbstprüfung, Empfänger-Register, Verzeichnis, Nachweise — Antworten an die Inhaberin', async () => {
    const lesen = async (mod: Promise<{ GET: Handler }>, pfad: string, wer = 'lena') => {
      const r = await (await mod).GET(new Request(`http://test${pfad}`, { headers: sitzung(wer) }));
      expect(r.status, pfad).toBe(200);
      return r.text();
    };
    // Head of IT: was die Seite zeigt (Befunde, Kurzbericht, Gesamtampel) — die Rohzähler darunter tragen nur Zustände (z. B. Modus „entwicklung“
    // des Start-Riegels als Kennung), keinen Text.
    const lage = JSON.parse(await lesen(import('@/app/api/hoi/lage/route') as Promise<{ GET: Handler }>, '/api/hoi/lage')) as { befunde: unknown; kurz: string; gesamt: unknown };
    const funde = [
      treffer('hoi', { befunde: lage.befunde, kurz: lage.kurz, gesamt: lage.gesamt }),
      treffer('pruefung', await lesen(import('@/app/api/datenschutz/pruefung/route') as Promise<{ GET: Handler }>, '/api/datenschutz/pruefung')),
      treffer('einrichtung', await lesen(import('@/app/api/datenschutz/einrichtung/route') as Promise<{ GET: Handler }>, '/api/datenschutz/einrichtung')),
      treffer('verzeichnis', await lesen(import('@/app/api/datenschutz/verzeichnis/route') as Promise<{ GET: Handler }>, '/api/datenschutz/verzeichnis?format=json')),
      treffer('nachweise', await lesen(import('@/app/api/datenschutz/nachweise/route') as Promise<{ GET: Handler }>, '/api/datenschutz/nachweise')),
    ].filter(Boolean);
    expect(funde).toEqual([]);
    // Die Infrastruktur des Betreibers steht nicht als Startwert im Register (C22).
    const reg = JSON.parse(await lesen(import('@/app/api/datenschutz/einrichtung/route') as Promise<{ GET: Handler }>, '/api/datenschutz/einrichtung')) as { empfaenger: { id: string; name: string }[] };
    expect(reg.empfaenger.map(e => e.id)).not.toContain('github');
    expect(reg.empfaenger.map(e => e.name).join(' ')).not.toMatch(/Hetzner|Healthchecks/);
    // Der Head of IT sagt, dass die Quellen am Server beim Betreiber liegen (Seite: neutrale Fassung).
    const hoi = JSON.parse(await lesen(import('@/app/api/hoi/lage/route') as Promise<{ GET: Handler }>, '/api/hoi/lage')) as { betreiber: boolean };
    expect(hoi.betreiber).toBe(false);
  }, 120_000);

  it('Einrichtung: Befunde der Route und alle Texte, die die Seite daraus zeigt (Schritte, Etappen samt Hinweisen, Zonen) — für jede Person', async () => {
    const route = (await import('@/app/api/onboarding/route')) as unknown as { GET: Handler };
    const D = await import('@/lib/make-one/onboarding-data');
    for (const wer of ['lena', 'jonas']) {
      const r = await route.GET(new Request('http://test/api/onboarding', { headers: sitzung(wer) }));
      expect(r.status, wer).toBe(200);
      const d = (await r.json()) as { befunde: unknown; ich: import('@/lib/make-one/onboarding-data').Kontext };
      expect(d.ich.betreiber, wer).toBe(false);
      const texte = D.schritteFuer(d.ich).map(s => D.texteFuer(s, d.ich)).flatMap(s => [s.titel, s.warum, ...s.wie, s.danach ?? '', s.befehl ?? '', s.beispiel ?? '']);
      const etappen = D.etappenFuer(!!d.ich.altbestand, !!d.ich.neustart, d.ich.betreiber);
      const funde = [treffer(`${wer} · Befunde`, d.befunde), treffer(`${wer} · Schritte`, texte.join('\n')), treffer(`${wer} · Etappen`, etappen),
        treffer(`${wer} · Ablauf`, D.ablaufFuer(!!d.ich.altbestand, !!d.ich.neustart, d.ich.betreiber)), treffer(`${wer} · Zonen`, D.zonenFuer(d.ich.betreiber))].filter(Boolean);
      expect(funde, wer).toEqual([]);
      expect(etappen.flatMap(e => e.hinweise ?? []), wer).toEqual([]);
    }
  }, 120_000);

  it('Verbindungen: Status von WhatsApp, ZOE-WhatsApp, WHOOP, Google und OAuth ohne Namen von Umgebungswerten', async () => {
    const funde: (string | null)[] = [];
    const lesen = async (mod: unknown, pfad: string, wer = 'lena') => {
      const r = await (mod as { GET: Handler }).GET(new Request(`http://test${pfad}`, { headers: sitzung(wer) }));
      funde.push(treffer(`${pfad} (${wer}, ${r.status})`, await r.text()));
    };
    for (const wer of ['lena', 'jonas']) {
      await lesen(await import('@/app/api/whatsapp/status/route'), '/api/whatsapp/status', wer);
      await lesen(await import('@/app/api/zoe/whatsapp/route'), '/api/zoe/whatsapp', wer);
      await lesen(await import('@/app/api/whoop/status/route'), '/api/whoop/status', wer);
      await lesen(await import('@/app/api/kalender/google/route'), '/api/kalender/google', wer);
    }
    await lesen(await import('@/app/api/oauth/status/route'), '/api/oauth/status', 'lena');
    expect(funde.filter(Boolean)).toEqual([]);
  }, 120_000);

  it('Bauplan: das Board startet ohne das Entwickler-Backlog des Herstellers', async () => {
    const route = (await import('@/app/api/bauplan/route')) as unknown as { GET: Handler };
    const r = await route.GET(new Request('http://test/api/bauplan', { headers: sitzung('lena') }));
    expect(r.status).toBe(200);
    const d = (await r.json()) as { items: { id: string }[] };
    const { SEED } = await import('@/lib/make-one/backlog-data');
    expect(d.items.filter(k => SEED.some(s => s.id === k.id)).map(k => k.id)).toEqual([]);
    expect(treffer('bauplan', d)).toBeNull();
  });
});
