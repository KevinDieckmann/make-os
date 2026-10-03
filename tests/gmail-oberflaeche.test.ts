// Gmail-Oberfläche (serverseitig gerendert, ohne Browser): Fremdtext wird nie als HTML eingefügt, Links nur http(s) mit rel=noopener,
// die Verbinden-Karte kennt ihre drei Zustände, die Inbox kennt Gmail als Quelle ohne die gemeinsame ZOE-Einstufung.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GmailText } from '@/components/os/inbox/GmailText';
import { GmailVerbinden, type GmailMeta } from '@/components/os/inbox/GmailVerbinden';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const quelle = (d: string) => readFileSync(path.resolve(__dirname, '..', d), 'utf8');

describe('GmailText — Fremdtext ist Text', () => {
  it('HTML im Text wird maskiert, nie eingefügt; Links nur http(s) mit rel, nie javascript:', () => {
    const m = html(createElement(GmailText, { text: 'Hallo <img src=x onerror=alert(1)> <script>alert(2)</script>\nhttps://x.example.invalid/pfad?a=1&b=2, javascript:alert(3)' }));
    expect(m).not.toMatch(/<img|<script/);
    expect(m).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(m).toContain('<a href="https://x.example.invalid/pfad?a=1&amp;b=2" target="_blank" rel="noopener noreferrer nofollow"');
    expect(m).not.toMatch(/href="javascript/);
    expect((m.match(/<a /g) ?? []).length).toBe(1);
  });
  it('Hinweise: nicht geladene Bilder (Tracking) und gekürzter Text', () => {
    expect(html(createElement(GmailText, { text: 'x', bilder: 3 }))).toContain('3 Bilder aus der Mail wurden nicht geladen');
    expect(html(createElement(GmailText, { text: 'x', bilder: 1 }))).toContain('1 Bild aus der Mail wurde nicht geladen');
    expect(html(createElement(GmailText, { text: 'x', gekuerzt: true }))).toContain('gekürzt');
    expect(html(createElement(GmailText, { text: 'nur Text' }))).not.toContain('nicht geladen');
  });
});

describe('GmailVerbinden — die Zustände', () => {
  const noop = () => undefined;
  const meta = (x: Partial<GmailMeta>): GmailMeta => ({ konfiguriert: true, verbunden: false, bereit: false, ...x });
  it('nicht eingerichtet: ein Satz mit Verweis auf die Anleitung, kein Knopf', () => {
    const m = html(createElement(GmailVerbinden, { meta: meta({ konfiguriert: false }), onGeaendert: noop, meldung: noop }));
    expect(m).toContain('GOOGLE_GMAIL_EINRICHTEN.md');
    expect(m).not.toContain('<button');
  });
  it('nicht verbunden: Karte mit „Gmail verbinden“ und ehrlichem Text (was MAKE OS darf — und was nicht)', () => {
    const m = html(createElement(GmailVerbinden, { meta: meta({}), onGeaendert: noop, meldung: noop }));
    expect(m).toContain('Gmail verbinden');
    expect(m).toMatch(/Gesendet wird nur, wenn du auf „Senden“ klickst/);
    expect(m).toMatch(/nicht das endgültige Löschen/);
    const getrennt = html(createElement(GmailVerbinden, { meta: meta({ getrennt: { grund: 'widerrufen' } }), onGeaendert: noop, meldung: noop }));
    expect(getrennt).toContain('Neu verbinden'); expect(getrennt).toContain('widerrufen');
  });
  it('verbunden: Statuszeile (maskiert), Abgleich, Push, „Jetzt abgleichen“ und „Gmail ausschalten“ — nie ein Token', () => {
    const m = html(createElement(GmailVerbinden, { meta: meta({ verbunden: true, bereit: true, konto: 'k***@makeinnovation.de', abgleich: { vorMin: 3, veraltet: false }, push: 'aktiv' }), onGeaendert: noop, meldung: noop }));
    expect(m).toContain('k***@makeinnovation.de');
    expect(m).toContain('vor 3 Min.');
    expect(m).toContain('Push aktiv');
    expect(m).toContain('Jetzt abgleichen'); expect(m).toContain('Gmail ausschalten');
    const alt = html(createElement(GmailVerbinden, { meta: meta({ verbunden: true, bereit: true, konto: 'k***@x.de', abgleich: { vorMin: 90, veraltet: true, fehler: 'Google bittet um Pause' }, push: 'aus' }), onGeaendert: noop, meldung: noop }));
    expect(alt).toContain('(veraltet)'); expect(alt).toContain('alle 2 Minuten'); expect(alt).toContain('Google bittet um Pause');
  });
});

describe('Inbox: Quelle Gmail', () => {
  it('Antworten sendet nur der Einzelklick — im Editor kein automatisches Senden, Verwerfen fragt, Aufgabe/Follow-up/Termin/Kontakt über die vorhandenen Wege', () => {
    const antwort = quelle('components/os/inbox/GmailAntwort.tsx');
    expect(antwort).toMatch(/Gesendet wird nur mit dem Klick auf „Senden“/);
    expect(antwort.match(/\/api\/gmail\/senden/g)?.length).toBe(1);        // genau EIN Sendeweg, ausgelöst vom Knopf
    expect(antwort).toMatch(/onClick=\{\(\) => senden\(false\)\}/);
    expect(antwort).not.toMatch(/useEffect\([^)]*senden/);
    const detail = quelle('components/os/inbox/GmailDetail.tsx');
    expect(detail).toMatch(/\/api\/crm\/followup/); expect(detail).toMatch(/\/api\/crm\/anfrage/); expect(detail).toMatch(/NeuerTermin/); expect(detail).toMatch(/type: 'ADD_TASK'/);
    expect(detail).not.toMatch(/dangerouslySetInnerHTML/);
    for (const f of ['GmailText', 'GmailAntwort', 'GmailDetail', 'GmailVerbinden']) expect(quelle(`components/os/inbox/${f}.tsx`), f).not.toMatch(/dangerouslySetInnerHTML|innerHTML|document\.write/);
  });
  it('Tasten und Tippziele: Knöpfe der Mail ≥ 44 px (schlank.Knopf) bzw. eigene Felder 16 px', () => {
    const antwort = quelle('components/os/inbox/GmailAntwort.tsx');
    expect(antwort).toMatch(/fontSize: 16, minHeight: 44/);
  });
});
