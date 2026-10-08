// ZOE auf WhatsApp (08.10., Roadmap Lücke 5) — die reinen Teile ohne Netz und ohne Bestände: Konfiguration (aus, Konflikt mit der
// Business-Nummer, Vorlage), Nummer lesen/maskieren, was eine Nachricht bedeutet, Sicht für den Browser (nie die volle Nummer, nie der
// Code), sicherer Text ohne Ausnahme, Vorlagen-Regel (Kosten/Ruhe), Vorlage prüfen, Webhook lesen, Befunde des Head of IT, neutrale Texte.
import { describe, it, expect } from 'vitest';
import { ZOE_WA_ENV, zoeWhatsappFehlend, zoeWhatsappKonfig, zoeWhatsappKonflikt, VORLAGE_VORGABE } from '@/lib/zoe-whatsapp/konfig';
import { KANAL_TEXTE, EINWILLIGUNG_TEXT, INHALTE_TEXT, codeAus, deuten, kanalSicht, leererKanal, notizTitel, nummerAus, nummerMaskiert, waMeLink, type ZoeKanal } from '@/lib/zoe-whatsapp/kanal';
import { sichererText, nurSammeln } from '@/lib/zoe-whatsapp/senden';
import { briefingVorlagePruefen } from '@/lib/zoe-whatsapp/meta';
import { eingangAus, webhookLesen } from '@/lib/zoe-whatsapp/webhook';
import { zoeWhatsappLageAus } from '@/lib/zoe-whatsapp/lage';
import { zoeWhatsappBefunde, einrichtungBefunde } from '@/lib/hoi/lage';
import { telegramInhalteFinden } from '@/lib/datenschutz/telegram-text';
import type { Vorlage, WaNachricht } from '@/lib/whatsapp/typen';

const ENV = {
  [ZOE_WA_ENV.telefonnummerId]: '900800700600500', [ZOE_WA_ENV.wabaId]: '800700600500400', [ZOE_WA_ENV.zugriff]: 'EAAGzoe' + 'Z'.repeat(80),
  [ZOE_WA_ENV.appGeheimnis]: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', [ZOE_WA_ENV.verifyToken]: 'v'.repeat(48),
} as unknown as NodeJS.ProcessEnv;

describe('Konfiguration der ZOE-Nummer', () => {
  it('ohne Werte aus — fehlende nur als NAMEN', () => {
    expect(zoeWhatsappKonfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(zoeWhatsappFehlend({} as NodeJS.ProcessEnv)).toEqual([ZOE_WA_ENV.telefonnummerId, ZOE_WA_ENV.wabaId, ZOE_WA_ENV.zugriff, ZOE_WA_ENV.appGeheimnis, ZOE_WA_ENV.verifyToken]);
  });
  it('vollständig → eingerichtet, Vorlage „briefing_bereit“ (de) als Vorgabe, einstellbar', () => {
    expect(zoeWhatsappKonfig(ENV)?.vorlage).toEqual(VORLAGE_VORGABE);
    expect(zoeWhatsappKonfig({ ...ENV, [ZOE_WA_ENV.vorlage]: 'zoe_hinweis', [ZOE_WA_ENV.vorlageSprache]: 'de_DE' })?.vorlage).toEqual({ name: 'zoe_hinweis', sprache: 'de_DE' });
    expect(zoeWhatsappFehlend({ ...ENV, [ZOE_WA_ENV.vorlage]: 'Nicht Gültig' })).toEqual([ZOE_WA_ENV.vorlage]);
  });
  it('NIE dieselbe Nummer wie die Business-Nummer: Konflikt → aus', () => {
    const gleich = { ...ENV, WHATSAPP_TELEFONNUMMER_ID: ENV[ZOE_WA_ENV.telefonnummerId] } as NodeJS.ProcessEnv;
    expect(zoeWhatsappKonflikt(gleich)).toBe(true);
    expect(zoeWhatsappKonfig(gleich)).toBeNull();
    expect(zoeWhatsappKonflikt({ ...ENV, WHATSAPP_TELEFONNUMMER_ID: '100200300400500' } as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe('Nummer, Code, Bedeutung', () => {
  it('Handynummer → wa_id (Inland mit Vorwahl-Parameter), Unsinn → null; maskiert nur Vorwahl + drei Ziffern', () => {
    expect(nummerAus('+49 170 1234567')).toBe('491701234567');
    expect(nummerAus('0170 1234567')).toBe('491701234567');
    expect(nummerAus('0043 660 1234567')).toBe('436601234567');
    expect(nummerAus('0660 1234567', '43')).toBe('436601234567');
    expect(nummerAus('1701234567')).toBeNull(); // ohne +, 00 oder 0 nicht eindeutig
    expect(nummerAus('+49 abc')).toBeNull();
    expect(nummerMaskiert('491701234567')).toBe('+49 ••• 567');
  });
  it('Code nur in Form „ZOE ABC234“ bzw. „ABC234“', () => {
    expect(codeAus('ZOE 7K4P2Q')).toBe('7K4P2Q');
    expect(codeAus('  zoe: 7k4p2q ')).toBe('7K4P2Q');
    expect(codeAus('7K4P2Q')).toBe('7K4P2Q');
    expect(codeAus('Hallo 7K4P2Q bitte')).toBeNull();
  });
  it('STOP, ja/nein mit Kennung, Aufgabe:/Notiz:, Quittung, Frage', () => {
    expect(deuten('STOP')).toEqual({ art: 'stop' });
    expect(deuten('stopp!')).toEqual({ art: 'stop' });
    expect(deuten('ja A7K2')).toEqual({ art: 'ja', kennung: 'A7K2' });
    expect(deuten('Nein, b9q3')).toEqual({ art: 'nein', kennung: 'B9Q3' });
    expect(deuten('ja')).toEqual({ art: 'ja' });
    expect(deuten('Aufgabe: Steuerberater anrufen')).toEqual({ art: 'aufgabe', text: 'Steuerberater anrufen' });
    expect(deuten('notiz – Idee für den Abend\nzweite Zeile')).toEqual({ art: 'notiz', text: 'Idee für den Abend\nzweite Zeile' });
    expect(deuten('ok')).toEqual({ art: 'quittung' });
    expect(deuten('Was steht heute an?')).toEqual({ art: 'frage', text: 'Was steht heute an?' });
    expect(deuten('ja, und was steht morgen eigentlich alles im Kalender an?').art).toBe('frage');
  });
  it('Notiz-Titel: erste Zeile, an der Wortgrenze gekürzt — der Text bleibt ganz', () => {
    expect(notizTitel('Kurz\nmehr')).toBe('Kurz');
    expect(notizTitel('Wort '.repeat(40)).length).toBeLessThanOrEqual(82);
  });
  it('wa.me-Link mit dem Code als Text — nur mit gültiger Nummer', () => {
    expect(waMeLink('+49 30 1234 5678', 'ABC234')).toBe('https://wa.me/493012345678?text=ZOE%20ABC234');
    expect(waMeLink(undefined, 'ABC234')).toBeNull();
  });
});

describe('Sicht für den Browser', () => {
  const k: ZoeKanal = { ...leererKanal(), status: 'verbunden', nummer: '491701234567', verbundenSeit: '2026-10-08T07:00:00.000Z', zuletztEingehend: new Date().toISOString(),
    code: { hash: 'h'.repeat(64), bis: '2099-01-01T00:00:00.000Z', versuche: 0 }, ausstehend: { gesundheit: { text: 'Recovery 22 %', am: '2026-10-08T07:00:00.000Z' } },
    eingang: [{ wamid: 'wamid.X1', am: '2026-10-08T07:00:00.000Z', art: 'text', text: 'geheimer Text' }],
    ereignisse: [{ zeit: '2026-10-08T06:00:00.000Z', art: 'einwilligung', von: 'jonas', quelle: 'app', fassung: 'f', wortlaut: 'w' }] };
  it('nie die volle Nummer, nie Code/Hash, nie Eingang oder Ausstehendes', () => {
    const t = JSON.stringify(kanalSicht(k));
    expect(t).not.toContain('491701234567');
    expect(t).not.toContain('h'.repeat(64));
    expect(t).not.toContain('geheimer Text');
    expect(t).not.toContain('Recovery');
    expect(kanalSicht(k).nummer).toBe('+49 ••• 567');
    expect(kanalSicht(k).fenster.offen).toBe(true);
  });
  it('abgelaufener Code → wieder „aus“, ohne Nummer', () => {
    const w: ZoeKanal = { ...leererKanal(), status: 'wartet', nummer: '491701234567', code: { hash: 'x', bis: '2000-01-01T00:00:00.000Z', versuche: 0 } };
    expect(kanalSicht(w)).toMatchObject({ status: 'aus' });
    expect(kanalSicht(w).nummer).toBeUndefined();
  });
});

describe('Senden: neutral ohne Ausnahme, Vorlage höchstens einmal je 20 h', () => {
  it('Text mit Gesundheitswerten/Beträgen ohne Ausnahme → nur der Hinweis mit Link; mit Ausnahme der Text', () => {
    expect(sichererText({}, 'Recovery 22 %, Schlaf 5 h', 'https://x.test/os')).toBe('Neue Nachricht in MAKE OS — https://x.test/os');
    expect(sichererText({}, 'Rechnung über 1.200 € offen', 'https://x.test/os')).toMatch(/^Neue Nachricht in MAKE OS/);
    expect(sichererText({}, 'Dein Morgen-Check wartet in MAKE OS', 'l')).toBe('Dein Morgen-Check wartet in MAKE OS');
    expect(sichererText({ inhalte: { seit: '2026-10-08', fassung: 'f' } }, 'Recovery 22 %', 'l')).toBe('Recovery 22 %');
  });
  it('nach einer unbeantworteten Vorlage wird gesammelt — außer Sicherheits-Hinweise; nach Antwort wieder Vorlage', () => {
    const jetzt = Date.parse('2026-10-08T12:00:00.000Z');
    const vor = (h: number) => new Date(jetzt - h * 3600_000).toISOString();
    expect(nurSammeln({}, 'gesundheit', jetzt)).toBe(false);
    expect(nurSammeln({ letzteVorlage: vor(2), zuletztEingehend: vor(30) }, 'gesundheit', jetzt)).toBe(true);
    expect(nurSammeln({ letzteVorlage: vor(2), zuletztEingehend: vor(30) }, 'sicherheit', jetzt)).toBe(false);
    expect(nurSammeln({ letzteVorlage: vor(25), zuletztEingehend: vor(30) }, 'gesundheit', jetzt)).toBe(false);
    expect(nurSammeln({ letzteVorlage: vor(30), zuletztEingehend: vor(26) }, 'gesundheit', jetzt)).toBe(false);
  });
  it('Vorlage „Briefing bereit“: genehmigt, nicht Werbung, höchstens ein Platzhalter (der Link)', () => {
    const v = (x: Partial<Vorlage>): Vorlage => ({ name: 'briefing_bereit', sprache: 'de', status: 'APPROVED', kategorie: 'UTILITY', text: 'Bereit: {{1}}', parameter: ['1'], ...x });
    expect(briefingVorlagePruefen([v({})], 'briefing_bereit', 'de').ok).toBe(true);
    expect(briefingVorlagePruefen([v({ status: 'PENDING' })], 'briefing_bereit', 'de')).toMatchObject({ ok: false });
    expect(briefingVorlagePruefen([v({ kategorie: 'MARKETING' })], 'briefing_bereit', 'de')).toMatchObject({ ok: false });
    expect(briefingVorlagePruefen([v({ parameter: ['1', '2'] })], 'briefing_bereit', 'de')).toMatchObject({ ok: false });
    expect(briefingVorlagePruefen([v({ sprache: 'en' })], 'briefing_bereit', 'de')).toMatchObject({ ok: false });
  });
});

describe('Webhook lesen', () => {
  const k = (werte: Record<string, unknown>, id = '900800700600500') => ({ object: 'whatsapp_business_account', entry: [{ id: 'w', changes: [{ field: 'messages', value: { metadata: { phone_number_id: id }, ...werte } }] }] });
  it('nur unsere Telefonnummer-ID; Text, Sprachnachricht, Sonstiges (ohne Inhalt); fehlgeschlagene Zustellung gezählt', () => {
    const r = webhookLesen(k({ messages: [
      { from: '491701234567', id: 'wamid.A0000001', timestamp: '1760000000', type: 'text', text: { body: 'Hallo' } },
      { from: '491701234567', id: 'wamid.A0000002', timestamp: '1760000000', type: 'audio', audio: { id: '123456', mime_type: 'audio/ogg; codecs=opus', voice: true } },
      { from: '491701234567', id: 'wamid.A0000003', timestamp: '1760000000', type: 'image', image: { id: '654321', mime_type: 'image/jpeg', caption: 'Bild mit Text' } },
    ], statuses: [{ id: 'wamid.O1', status: 'failed' }] }) as never, '900800700600500', new Date().toISOString());
    expect(r.nachrichten.map(m => m.art)).toEqual(['text', 'sprachnachricht', 'bild']);
    expect(r.fehlgeschlagen).toBe(1);
    const e = r.nachrichten.map(eingangAus);
    expect(e[0]).toMatchObject({ art: 'text', text: 'Hallo' });
    expect(e[1]).toMatchObject({ art: 'sprachnachricht', medium: { mediaId: '123456' } });
    expect(e[2]).toEqual({ wamid: 'wamid.A0000003', am: e[2].am, art: 'sonstiges' }); // keine Bildunterschrift, kein Medium
    expect(webhookLesen(k({ messages: [{ from: '491701234567', id: 'wamid.B1', type: 'text', text: { body: 'x' } }] }, '111') as never, '900800700600500', '').nachrichten).toEqual([]);
  });
  it('eine Nachricht als Eintrag: Antwort auf eine Nachricht von ZOE bleibt erhalten', () => {
    const m: WaNachricht = { id: 'wamid.C1', nummer: '491701234567', richtung: 'ein', am: '2026-10-08T07:00:00.000Z', art: 'text', text: 'ja', antwortAuf: 'wamid.Z1' };
    expect(eingangAus(m)).toEqual({ wamid: 'wamid.C1', am: m.am, art: 'text', text: 'ja', antwortAuf: 'wamid.Z1' });
  });
});

describe('Head of IT — nur Zähler und Zustände', () => {
  const lage = (x: Partial<ReturnType<typeof zoeWhatsappLageAus>> = {}) => ({ ...zoeWhatsappLageAus({ v: 1, webhook: { anzahl: 3, abgelehnt: 0, zuletzt: new Date().toISOString() } }, [{ ...leererKanal(), status: 'verbunden', nummer: '491701234567' }], null, Date.now()), ...x });
  it('Konflikt und Schlüssel = rot; fehlende Vorlage mit verbundenen Personen = gelb; sonst grün', () => {
    expect(zoeWhatsappBefunde({ ...lage(), konflikt: true })[0].ampel).toBe('rot');
    expect(zoeWhatsappBefunde(lage({ token: true }))[0].ampel).toBe('rot');
    expect(zoeWhatsappBefunde(lage({ vorlage: 'fehlt' }))[0].ampel).toBe('gelb');
    expect(zoeWhatsappBefunde(lage({ vorlage: 'ok' }))[0].ampel).toBe('gruen');
    expect(zoeWhatsappBefunde(null)).toEqual([]);
  });
  it('nie Nummern im Lagebild', () => {
    expect(JSON.stringify(zoeWhatsappBefunde(lage({ fremd: 4 })))).not.toMatch(/\d{8,}/);
  });
  it('Einrichtung: grau, wenn die ZOE-Nummer fehlt (nur mit dem neuen Feld)', () => {
    expect(einrichtungBefunde({ google: true, whatsapp: true, whoop: true, zoeWhatsapp: false }).map(b => b.id)).toContain('einrichtung-zoe-whatsapp');
    expect(einrichtungBefunde({ google: true, whatsapp: true, whoop: true }).map(b => b.id)).not.toContain('einrichtung-zoe-whatsapp');
  });
});

describe('Texte an die Person — neutral', () => {
  it('keine Namen, keine Werte, keine Beträge, keine Adressen (Plattform-Regel)', () => {
    const texte = [
      ...(Object.values(KANAL_TEXTE) as unknown[]).filter((t): t is string => typeof t === 'string'),
      KANAL_TEXTE.sprachnachricht('https://x.test/os/konto'), KANAL_TEXTE.antwortInApp('https://x.test/zoe'), KANAL_TEXTE.vorschlag('A7K2', 'aufgabe', 'https://x.test/os/stapel'),
      KANAL_TEXTE.freigegeben('A7K2', 'https://x.test'), KANAL_TEXTE.welcher(['A7K2']), EINWILLIGUNG_TEXT.text, INHALTE_TEXT.text,
    ];
    for (const t of texte) {
      expect(t, t).not.toMatch(/Kevin|Malin|Dieckmann/);
      if (t !== INHALTE_TEXT.text) expect(telegramInhalteFinden(t), t).toEqual([]);
    }
  });
});
