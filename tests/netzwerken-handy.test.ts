// ─── Netzwerken · Kontakt aufs Handy (03.10.) ────────────────────────────────────
// vCard 3.0 aus der erfassten Karte (Felder, Escaping, Umlaute, NOTE ohne interne Angaben), Anschrift, Art. 18 gesperrt,
// Teilen (Web Share mit Datei / Download-Rückfall) und die Knöpfe in Erfassen (Schalter, Fertig-Knopf) und Kontaktakte.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ampel } from '@/lib/crm/recht';
import type { Kontakt } from '@/lib/make-one/crm';
import { handyKarteAusErfassung, handyKarteAusKontakt, handyTeilen, anschriftTeile, kennengelernt, ART18_GRUND, type HandyKarte } from '@/lib/netzwerken/handy';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

const ENTFALTET = (t: string) => t.replace(/\r\n /g, '');
const ort = { event: 'Kölner Gründerabend', datum: '2026-10-03' };
const voll = {
  vorname: 'Jürgen', nachname: 'Müller-Lüdenscheidt', firma: 'Schmidt, Söhne & Co; KG', position: 'Geschäftsführer', email: 'Juergen.Mueller@Beispiel.invalid',
  telefon: '0221 1234567', mobil: '0171 9876543', webseite: 'beispiel.invalid/ueber-uns', anschrift: 'Hauptstraße 5\n50667 Köln', linkedin: 'linkedin.com/in/juergen-mueller',
};
const kontakt = (x: Partial<Kontakt> = {}): Kontakt => ({ id: 'c-test', vorname: 'Anna', nachname: 'Test', firmaId: 'f-1', email: 'anna@test.invalid', telefon: '+49 30 1234567', stufe: 'gespraech', kreis: 'B', aktivitaeten: [], ...x } as unknown as Kontakt);

describe('vCard aus der erfassten Karte', () => {
  const r = handyKarteAusErfassung(voll, ort);
  if (!r.ok) throw new Error('vCard fehlt');
  const v = ENTFALTET(r.karte.inhalt);
  it('ist eine vCard 3.0 mit allen erfassten Feldern', () => {
    expect(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(v.endsWith('END:VCARD\r\n')).toBe(true);
    expect(v).toContain('N:Müller-Lüdenscheidt;Jürgen;;;');
    expect(v).toContain('FN:Jürgen Müller-Lüdenscheidt');
    expect(v).toContain('TITLE:Geschäftsführer');
    expect(v).toContain('EMAIL;TYPE=INTERNET,WORK:juergen.mueller@beispiel.invalid');
    expect(v).toMatch(/TEL;TYPE=CELL:.*171 ?9876543/);
    expect(v).toMatch(/TEL;TYPE=WORK,VOICE:.*221 ?1234567/);
    expect(v).toContain('URL:https://beispiel.invalid/ueber-uns');
    expect(v).toContain('URL;TYPE=LinkedIn:https://www.linkedin.com/in/juergen-mueller');
    expect(v).toContain('ADR;TYPE=WORK:;;Hauptstraße 5;Köln;;50667;');
  });
  it('maskiert Komma und Semikolon und lässt Umlaute als UTF-8 stehen', () => {
    expect(v).toContain('ORG:Schmidt\\, Söhne & Co\\; KG');
    expect(r.karte.inhalt).not.toMatch(/=C3=|\\u00/);
  });
  it('die NOTE nennt nur Event und Datum — keine internen Angaben', () => {
    expect(v).toContain('NOTE:Kennengelernt bei Kölner Gründerabend\\, 03.10.2026 · MAKE OS');
    expect(kennengelernt(ort)).toBe('Kennengelernt bei Kölner Gründerabend, 03.10.2026 · MAKE OS');
    const note = v.split('NOTE:')[1].split('\r\n')[0];
    expect(note).not.toMatch(/Schritt|Follow|Termin|zuständig|Info|Lead|Score|Einwilligung/i);
    // ohne Event keine Notiz
    const ohne = handyKarteAusErfassung(voll, {});
    expect(ohne.ok && ohne.karte.inhalt).not.toContain('NOTE:');
  });
  it('Dateiname und Titel stammen aus dem Namen', () => {
    expect(r.karte.dateiname).toBe('jurgen-muller-ludenscheidt.vcf');
    expect(r.karte.titel).toBe('Jürgen Müller-Lüdenscheidt');
  });
  it('lange Zeilen sind gefaltet (≤ 75 Oktette), nie mitten im Umlaut', () => {
    const lang = handyKarteAusErfassung({ nachname: 'Ö'.repeat(60), vorname: 'Ä' }, ort);
    expect(lang.ok).toBe(true);
    if (!lang.ok) return;
    for (const z of lang.karte.inhalt.split('\r\n')) expect(new TextEncoder().encode(z).length).toBeLessThanOrEqual(75);
    expect(ENTFALTET(lang.karte.inhalt)).toContain(`N:${'Ö'.repeat(60)};Ä;;;`);
  });
  it('nur gesetzte Felder; Zeilenumbrüche und Steuerzeichen in Eingaben brechen die Karte nicht', () => {
    const k = handyKarteAusErfassung({ nachname: 'Test\r\nEND:VCARD\r\nBEGIN:VCARD', vorname: 'A\u0000' }, {});
    expect(k.ok).toBe(true);
    if (!k.ok) return;
    // Eingeschleuste Zeilenwechsel werden zu Leerzeichen — es bleibt bei EINER Karte (Zeilen, die genau so beginnen/enden).
    const zeilen = k.karte.inhalt.split('\r\n');
    expect(zeilen.filter(z => z === 'BEGIN:VCARD')).toHaveLength(1);
    expect(zeilen.filter(z => z === 'END:VCARD')).toHaveLength(1);
    for (const nicht of ['URL', 'ADR', 'TEL', 'EMAIL', 'ORG']) expect(k.karte.inhalt).not.toContain(nicht);
  });
  it('ohne jede Angabe gibt es keine Datei, nur einen Grund', () => {
    expect(handyKarteAusErfassung({}, ort).ok).toBe(false);
  });
});

describe('Anschrift', () => {
  it('zerlegt Straße / PLZ Ort / Land', () => {
    expect(anschriftTeile('Hauptstraße 5\n50667 Köln')).toEqual({ strasse: 'Hauptstraße 5', plz: '50667', ort: 'Köln' });
    expect(anschriftTeile('Hauptstraße 5\n50667 Köln\nDeutschland')).toEqual({ strasse: 'Hauptstraße 5', plz: '50667', ort: 'Köln', land: 'Deutschland' });
    expect(anschriftTeile('50667 Köln')).toEqual({ plz: '50667', ort: 'Köln' });
    expect(anschriftTeile('Musterweg 1\nBerlin')).toEqual({ strasse: 'Musterweg 1', ort: 'Berlin' });
    expect(anschriftTeile(undefined)).toEqual({});
  });
});

describe('Kontaktakte → vCard, Art. 18', () => {
  it('baut die vCard aus den Kartei-Daten', () => {
    const r = handyKarteAusKontakt(kontakt({ sms: '+49 171 1112223', position: 'CFO', firma: 'Beispiel GmbH' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.karte.inhalt).toContain('FN:Anna Test');
    expect(r.karte.inhalt).toContain('TEL;TYPE=CELL:+49 171 1112223');
    expect(r.karte.inhalt).toContain('TEL;TYPE=WORK,VOICE:+49 30 1234567');
    expect(r.karte.inhalt).toContain('TITLE:CFO');
    expect(r.karte.inhalt).not.toContain('NOTE:');
  });
  it('eingeschränkte Personen (Art. 18) bekommen keine Datei', () => {
    const r = handyKarteAusKontakt(kontakt({ eingeschraenkt: { seit: '2026-10-01' } } as Partial<Kontakt>));
    expect(r).toEqual({ ok: false, grund: ART18_GRUND });
  });
});

describe('Teilen', () => {
  const karte: HandyKarte = { inhalt: 'BEGIN:VCARD\r\nEND:VCARD\r\n', dateiname: 'anna-test.vcf', titel: 'Anna Test' };
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('teilt die .vcf-Datei über die Web Share API, wenn der Browser es kann', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => true });
    expect(await handyTeilen(karte)).toBe('geteilt');
    const arg = share.mock.calls[0][0] as { files: File[]; title: string };
    expect(arg.files[0].name).toBe('anna-test.vcf');
    expect(arg.files[0].type).toBe('text/vcard');
    expect(await arg.files[0].text()).toBe(karte.inhalt);
  });
  it('Abbruch im Teilen-Blatt ist keine Störung und lädt nichts', async () => {
    const klick = vi.fn();
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })), canShare: () => true });
    vi.stubGlobal('document', { createElement: () => ({ click: klick }), body: { appendChild: () => {} } });
    expect(await handyTeilen(karte)).toBe('abgebrochen');
    expect(klick).not.toHaveBeenCalled();
  });
  it('ohne Web Share lädt es die Datei herunter (Blob, name.vcf)', async () => {
    const a = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', { createElement: () => a, body: { appendChild: () => {} } });
    const url = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    expect(await handyTeilen(karte)).toBe('heruntergeladen');
    expect(a.download).toBe('anna-test.vcf');
    expect(a.click).toHaveBeenCalledOnce();
    expect((url.mock.calls[0][0] as File).type).toBe('text/vcard');
  });
});

describe('Knöpfe', () => {
  it('Erfassen: Schalter im Bestätigen-Schritt, Knopf auf der Fertig-Ansicht (hervorgehoben, wenn der Schalter an war)', async () => {
    const { HandySchalter, HandyKnopf } = await import('@/components/os/netzwerken/Erfassen');
    const ok = handyKarteAusErfassung(voll, ort);
    const schalter = renderToStaticMarkup(h(HandySchalter, { an: true, onUm: () => {} }));
    expect(schalter).toContain('role="switch"');
    expect(schalter).toContain('aria-checked="true"');
    expect(schalter).toContain('Auch im Handy speichern');
    const knopf = renderToStaticMarkup(h(HandyKnopf, { handy: ok, hervor: true }));
    expect(knopf).toContain('Auch im Handy speichern');
    expect(knopf).not.toContain('disabled');
    expect(knopf).toContain('<svg'); // Symbol Adressbuch
    const leise = renderToStaticMarkup(h(HandyKnopf, { handy: ok, hervor: false }));
    expect(leise).not.toBe(knopf);
    const leer = renderToStaticMarkup(h(HandyKnopf, { handy: handyKarteAusErfassung({}, ort), hervor: true }));
    expect(leer).toContain('disabled');
  });
  it('Kontaktakte: „Ins Handy“ in der Schnellleiste, bei Art. 18 aus mit Hinweis', async () => {
    const { SchnellLeiste } = await import('@/components/os/crm/kontakt/SchnellLeiste');
    const api = { crm: null, kontakte: [], ich: 'kevin' } as unknown as import('@/components/os/crm/daten').CrmApi;
    const render = (k: Kontakt) => renderToStaticMarkup(h(SchnellLeiste, { k, api, heute: '2026-10-03', ampel: ampel(k, { hatMandat: true, hatChance: true }) }));
    const knopfVon = (html: string) => /<button[^>]*data-testid="ins-handy"[^>]*>/.exec(html)?.[0] ?? '';
    const normal = knopfVon(render(kontakt()));
    expect(normal).toContain('min-height:44px');
    expect(normal).not.toContain('disabled');
    const gesperrt = knopfVon(render(kontakt({ eingeschraenkt: { seit: '2026-10-01' } } as Partial<Kontakt>)));
    expect(gesperrt).toContain('disabled=""');
    expect(gesperrt).toContain('Art. 18');
  });
});
