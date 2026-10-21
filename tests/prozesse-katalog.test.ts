// ─── Prozesse B1 — der Baustein-Katalog als Daten (21.10.) ──────────────────────────────────────────────────────────────────────────────────────────
// Entscheidung 21.10.: jede vorhandene Anbindung ist ein Baustein mit eigener Maske; die Klasse kommt vom Werkzeug (nie doppelt gepflegt); Kundengewinnung
// (nächtlicher Prospecting-Lauf) ist abgedeckt; Ansprache prüft Kanal-Ampel, Werbesperre und Art. 18; Masken ohne Nutzer-Code (feste Formatierer).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BAUSTEIN_KATALOG, KATALOG_KATEGORIEN, katalogEintrag, katalogSelbstpruefung, klasseVonEintrag, brauchtSchloss, maskeSaeubern, textvorlageFuellen,
  textvorlagePruefen, platzhalterFuer, formatieren, kategorienVonEintrag,
} from '@/lib/prozesse/baustein-katalog';
import { EINORDNUNG } from '@/lib/werkzeuge/einordnung';
import { PROZESS_FORMEN } from '@/lib/prozesse/definition';
import { anspracheUrteil, anspracheKanal } from '@/lib/prozesse/ansprache';
import { FACH_AGENTEN } from '@/lib/prozesse/agent-schritt';
import type { Kontakt } from '@/lib/make-one/crm';

describe('Katalog: Form und Herkunft der Klasse', () => {
  it('die Selbstprüfung ist leer (eindeutig, genau eine Quelle der Klasse, Werkzeug gibt es, Masken gültig)', () => {
    expect(katalogSelbstpruefung()).toEqual([]);
  });
  it('Werkzeug-Bausteine: Klasse = die Einordnung des Werkzeugs — keine eigene Angabe, keine eigene KI-Kategorie', () => {
    for (const e of BAUSTEIN_KATALOG.filter(x => x.werkzeug)) {
      expect(e.rechte, e.id).toBeUndefined();
      expect(e.ki, e.id).toBeUndefined();
      expect(klasseVonEintrag(e), e.id).toBe(EINORDNUNG[e.werkzeug!].rechte);
      expect(EINORDNUNG[e.werkzeug!].herkunft, e.id).toBe('zoe');
    }
  });
  it('jedes Werkzeug hat einen Vertrag im Register (Server) und gehört nicht zu Privat', async () => {
    const { vertragVon } = await import('@/lib/werkzeuge/register');
    for (const e of BAUSTEIN_KATALOG.filter(x => x.werkzeug)) {
      const v = vertragVon(e.werkzeug!);
      expect(v, e.id).toBeTruthy();
      expect(v!.bereich, e.id).not.toBe('privat');
    }
  });
  it('der Server löst Klasse und KI-Kategorien auf (vom Werkzeug)', async () => {
    const { katalogAufgeloest } = await import('@/lib/prozesse/werkstatt-server');
    const k = await katalogAufgeloest();
    const deal = k.find(x => x.id === 'crm.deal-anlegen')!;
    expect(deal.klasse).toBe('intern');
    expect(deal.kategorien).toEqual(['crm']);
    expect(k.find(x => x.id === 'rechnung.erfassen')!.klasse).toBe('geld');
    expect(kategorienVonEintrag(katalogEintrag('inbox.mail-entwurf')!, () => null)).toEqual(['postfach', 'crm']);
  });
  it('die Fach-Agenten sind vorhandene, ausführbare Agenten (keine zweite Agentenwelt)', async () => {
    const { AUSFUEHRBAR } = await import('@/lib/zoe/agenten');
    for (const f of FACH_AGENTEN) expect(AUSFUEHRBAR as readonly string[], f.id).toContain(f.id);
  });
  it('die Arten der CRM-Vorschläge gibt es', async () => {
    const { VORSCHLAG_ARTEN } = await import('@/lib/zoe/crm-vorschlag');
    for (const e of BAUSTEIN_KATALOG.filter(x => x.fest?.art)) expect(VORSCHLAG_ARTEN as readonly string[], e.id).toContain(e.fest!.art);
  });
});

describe('Katalog: deckt die Anbindungen und den Baukasten ab', () => {
  it('jede vorhandene Anbindung (Entscheidung 21.10.)', () => {
    const anb = new Set(BAUSTEIN_KATALOG.map(e => e.anbindung));
    for (const a of ['Inbox', 'WhatsApp', 'Kalender', 'CRM', 'Angebot', 'Rechnung', 'Aufgabe', 'Glocke', 'Telegram', 'ZOE', 'Heads', 'Skills', 'Fach-Agenten', 'Webhook']) expect(anb, a).toContain(a);
  });
  it('CRM: Kontakt, Firma, Deal, Lead, Follow-up', () => {
    for (const id of ['crm.kontakt-notiz', 'crm.kontakt-pflegen', 'crm.firma-akte', 'crm.deal-anlegen', 'crm.deal-stufe', 'crm.lead-qualifizieren', 'crm.followup']) expect(katalogEintrag(id), id).toBeTruthy();
  });
  it('jede Kategorie und jede Form hat mindestens einen Baustein', () => {
    for (const k of KATALOG_KATEGORIEN) expect(BAUSTEIN_KATALOG.some(e => e.kategorie === k.id), k.id).toBe(true);
    for (const f of PROZESS_FORMEN.filter(x => x !== 'abstimmung')) expect(BAUSTEIN_KATALOG.some(e => e.form === f), f).toBe(true);
  });
  it('Kundengewinnung: der nächtliche Prospecting-Lauf lässt sich aus Bausteinen legen', () => {
    const kette = ['ausloeser.zeitplan', 'crm.abfragen', 'schleife.je-eintrag', 'entscheidung.regel', 'agent.research', 'entscheidung.score', 'crm.outreach-aufgabe',
      'crm.deal-anlegen', 'glocke.melden', 'telegram.hinweis', 'ausloeser.loop', 'teilprozess.starten', 'lauf.erneut-ab'];
    for (const id of kette) expect(katalogEintrag(id), id).toBeTruthy();
    expect(katalogEintrag('crm.abfragen')!.liest).toMatch(/kontakteFuerVerarbeitung/);
    expect(katalogEintrag('crm.deal-anlegen')!.schreibweg).toMatch(/dealAnlegen/);
    expect(katalogEintrag('entscheidung.score')!.liest).toMatch(/scoringKontext/);
    expect(katalogEintrag('agent.research')!.agentFest).toEqual({ wer: { art: 'fach', agentId: 'research' }, ergebnis: 'vorschlag' });
    // Die Schleife hat eine Obergrenze je Lauf — der Rest bleibt mit Hinweis (nie still gekürzt).
    expect(katalogEintrag('schleife.je-eintrag')!.maske.find(m => m.id === 'hoechstens')).toMatchObject({ pflicht: true, max: 500 });
  });
  it('das Modell-Feld nimmt die Liste der Instanz (Quelle), nie eine feste Liste; Vorgabe ist die Stufe', () => {
    for (const e of BAUSTEIN_KATALOG) {
      const m = e.maske.find(x => x.id === 'modellWahl');
      if (m) { expect(m.quelle, e.id).toBe('modell'); expect(m.optionen, e.id).toBeUndefined(); expect(m.vorgabe, e.id).toBeUndefined(); }
      const s = e.maske.find(x => x.id === 'modell');
      if (s) expect(['schnell', 'ausgewogen'], e.id).toContain(s.vorgabe);
    }
    expect(katalogEintrag('agent.skill')!.maske.find(x => x.id === 'modell')!.vorgabe).toBe('schnell');
    expect(katalogEintrag('agent.head')!.maske.find(x => x.id === 'modell')!.vorgabe).toBe('ausgewogen');
  });
});

describe('Freigabe-Schloss: welche Bausteine es brauchen', () => {
  it('außen, Geld, Löschen ja — interne Aufgaben, Glocke, Lesen nein', () => {
    for (const id of ['inbox.mail-entwurf', 'whatsapp.entwurf', 'kalender.einladung', 'angebot.stellen', 'rechnung.erfassen', 'loeschen.papierkorb']) expect(brauchtSchloss(klasseVonEintrag(katalogEintrag(id)!)), id).toBe(true);
    for (const id of ['aufgabe.anlegen', 'glocke.melden', 'telegram.hinweis', 'crm.abfragen', 'crm.followup', 'entscheidung.regel']) expect(brauchtSchloss(klasseVonEintrag(katalogEintrag(id)!)), id).toBe(false);
  });
});

describe('Ansprache: Kanal-Ampel, Werbesperre, Art. 18 an jedem Baustein, der eine Person anspricht', () => {
  const basis = { id: 'c-probe', vorname: 'Ada', nachname: 'Probe', email: 'ada@example.invalid', stufe: 'gespraech', aktivitaeten: [{ art: 'gespraech', am: '2026-10-01', text: 'x' }] } as unknown as Kontakt;
  it('jeder Baustein mit Ansprache hat einen Kanal (fest oder aus der Maske)', () => {
    for (const e of BAUSTEIN_KATALOG.filter(x => x.ansprache)) {
      if (e.ansprache!.kanal) continue;
      expect(e.maske.some(m => m.id === e.ansprache!.kanalFeld), e.id).toBe(true);
    }
    expect(anspracheKanal(katalogEintrag('crm.outreach-aufgabe')!, { kanal: 'telefon' })).toBe('telefon');
    expect(anspracheKanal(katalogEintrag('aufgabe.anlegen')!, {})).toBeNull();
  });
  it('Werbesperre und Einschränkung (Art. 18) → rot, nicht erlaubt', () => {
    const mail = katalogEintrag('inbox.mail-entwurf')!;
    const sperre = anspracheUrteil(mail, {}, { ...basis, werbesperre: { seit: '2026-09-01' } } as unknown as Kontakt)!;
    expect(sperre).toMatchObject({ farbe: 'rot', erlaubt: false });
    const art18 = anspracheUrteil(mail, {}, { ...basis, eingeschraenkt: { seit: '2026-09-01', grund: 'x', von: 'pia' } } as unknown as Kontakt)!;
    expect(art18).toMatchObject({ farbe: 'rot', erlaubt: false });
    expect(anspracheUrteil(mail, {}, null)).toBeNull();
  });
});

describe('Masken säubern und prüfen; feste Formatierer statt Code', () => {
  const e = katalogEintrag('aufgabe.anlegen')!;
  it('Pflicht fehlt → offen; falscher Typ → fehler; Unbekanntes fällt weg', () => {
    const r = maskeSaeubern(e, { titel: 'Anrufen', wer: 'konto-pia', fristTage: 'drei', unbekannt: 1 });
    expect(r.werte).toEqual({ titel: 'Anrufen', wer: 'konto-pia' });
    expect(r.befunde.some(b => b.stufe === 'fehler' && b.feld === 'fristTage')).toBe(true);
    expect(maskeSaeubern(e, {}).befunde.filter(b => b.stufe === 'offen').map(b => b.feld).sort()).toEqual(['titel', 'wer']);
  });
  it('Auswahl aus dem Bestand: nicht (mehr) vorhanden → offen (der Entwurf bleibt)', () => {
    const r = maskeSaeubern(e, { titel: 'A', wer: 'konto-weg' }, { auswahl: q => (q === 'team-person' ? ['konto-pia'] : null) });
    expect(r.befunde).toEqual([expect.objectContaining({ stufe: 'offen', feld: 'wer' })]);
  });
  it('Textvorlagen: nur bekannte Platzhalter und feste Formatierer; Füllen führt nie etwas aus', () => {
    const erlaubt = platzhalterFuer('deal', ['quelle']);
    expect(textvorlagePruefen('Hallo {{kontakt.vorname}}, {{deal.titel}} am {{heute|datum}}', erlaubt)).toEqual([]);
    expect(textvorlagePruefen('{{process.env}}', erlaubt).join()).toMatch(/gibt es hier nicht/);
    expect(textvorlagePruefen('{{heute|eval}}', erlaubt).join()).toMatch(/Formatierer/);
    expect(textvorlagePruefen('offen {{ kaputt', erlaubt).join()).toMatch(/nicht lesbar/);
    const f = textvorlageFuellen('Hallo {{kontakt.vorname}} — {{deal.wert|betrag}} bis {{heute|datum}}{{fehlt.feld}}', { 'kontakt.vorname': 'Ada', 'deal.wert': 123450, heute: '2026-10-24' });
    expect(f.text.replace(/\u00a0/g, ' ')).toBe('Hallo Ada — 1.234,50 € bis 24.10.2026');
    expect(f.fehlend).toEqual(['fehlt.feld']);
    expect(formatieren('datum-lang', '2026-10-24')).toMatch(/Samstag/);
  });
});

describe('Keine Namen, Firmen oder Beträge im Code des Moduls', () => {
  it('lib/prozesse nennt keine Personen oder festen Firmen', () => {
    const dateien = ['definition', 'baustein-katalog', 'agent-schritt', 'ausloeser', 'bestand', 'schloss', 'fluss', 'versionen', 'webhook', 'webhook-server', 'werkstatt-server', 'modell-wahl', 'ansprache', 'rollen', 'definition-pruefen'];
    for (const d of dateien) {
      const t = readFileSync(path.join(process.cwd(), 'lib/prozesse', `${d}.ts`), 'utf8');
      expect(t, d).not.toMatch(/\b(kevin|malin|kemaris)\b/i);
    }
  });
});
