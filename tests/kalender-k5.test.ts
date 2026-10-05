// Kalender K5 (29.09.): „Ein Kalender, Planen als Modus“ — Blöcke sind iCloud-Termine (Art Fokus/Block), Übernahme der
// alten Wochenplan-Blöcke, Spiegel von Event/Familie mit echter UID, Umschalter Kalender | Aufgaben. Reine Regeln;
// Server-Abläufe mit gemocktem iCloud in tests/kalender-k5-server.test.ts. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { planArtVon, icsVonPlanArt, blockAusTermin, bloeckeAus, blockAnfrage, wochenStunden, gehoertZu, planArtAusTitel, wochenTage } from '../lib/planung/bloecke';
import { altBloecke, istZukuenftig, uidFuerBlock, uebernahmePlanen, archivBloecke, standSauber, altName, LEER_STAND } from '../lib/planung/wochenplan-uebernahme';
import { baueTermin, termineAus, aendereTermin, icsZusatz } from '../lib/kalender/ics';
import { anlegenPruefen, aendernPruefen } from '../lib/kalender/eingabe';
import { ICS_ARTEN, TERMIN_ARTEN, istBlockArt } from '../lib/kalender/arten';
import { eventSoll, dateSoll, gespraechSoll, spiegelAbweichung, spiegelUid, istScheinUid, gespraecheUmziehen } from '../lib/kalender/spiegel';
import { modusAusAdresse, kalenderLink, faelligGruppe, faelligGruppen, aufgabenVorfiltern } from '../lib/kalender/modus';
import { wendeFamilieAn, setzeFelder, startBestand } from '../lib/familie/speicher';
import { KalenderAufgabenSchalter } from '../components/os/KalenderAufgabenSchalter';
import type { Task } from '../types/tasks';

const K = { kalender: 'Probe', kalenderId: 'k1', href: '', serie: false, mitTeilnehmern: false, bearbeitbar: true, beschaeftigt: true, sichtbarkeit: 'standard' as const };
const termin = (id: string, start: string, ende: string, x: Record<string, unknown> = {}) => ({ id, uid: id, titel: `T ${id}`, start, ende, ganztags: false, art: 'termin', ...K, ...x });

describe('Blöcke sind Termine (lib/planung/bloecke.ts)', () => {
  it('Art ↔ Plan-Art: Fokus = fokus, Reha/Routine/Pause/Aufgabe = block + Unterart, Blockzeit = block', () => {
    expect(icsVonPlanArt('fokus')).toEqual({ art: 'fokus' });
    expect(icsVonPlanArt('block')).toEqual({ art: 'block' });
    expect(icsVonPlanArt('reha')).toEqual({ art: 'block', blockArt: 'reha' });
    expect(planArtVon({ art: 'block', blockArt: 'reha', ganztags: false })).toBe('reha');
    expect(planArtVon({ art: 'block', blockArt: 'quatsch', ganztags: false })).toBe('block');
    expect(planArtVon({ art: 'termin', ganztags: false })).toBeNull();
    expect(planArtVon({ art: 'fokus', ganztags: true })).toBeNull();
    // „Block“ ist eine iCloud-Art, aber kein Reiter im Anlege-Dialog (Blöcke entstehen im Modus „Planen“).
    expect(ICS_ARTEN).toContain('block');
    expect(TERMIN_ARTEN).not.toContain('block');
    expect(istBlockArt('pause')).toBe(true);
  });

  it('ein Termin wird zum Block — Tag, Minuten, Dauer, verknüpfte Aufgabe; über Mitternacht bis 24:00', () => {
    const b = blockAusTermin(termin('u1', '2026-10-06T09:00:00', '2026-10-06T10:30:00', { art: 'block', blockArt: 'aufgabe', bezug: { aufgabeId: 't-1' }, wer: 'kevin' }));
    expect(b).toMatchObject({ id: 'u1', uid: 'u1', quelle: 'kalender', date: '2026-10-06', startMin: 540, dauerMin: 90, art: 'aufgabe', taskId: 't-1', wer: 'kevin' });
    expect(blockAusTermin(termin('u2', '2026-10-06T23:00:00', '2026-10-07T01:00:00', { art: 'fokus' }))?.dauerMin).toBe(60);
    expect(bloeckeAus([termin('u3', '2026-10-06T09:00:00', '2026-10-06T10:00:00')])).toEqual([]);
  });

  it('Anfrage für POST /api/kalender/termin: Raster 15 Min, Dauer 15 Min … 8 h, beschäftigt, Aufgabe nur als Bezug', () => {
    expect(blockAnfrage({ date: '2026-10-06', startMin: 547, dauerMin: 50, titel: '  Reha ', art: 'reha', taskId: 't-9' }, 'malin')).toEqual({
      titel: 'Reha', start: '2026-10-06T09:00:00', ende: '2026-10-06T09:45:00', ganztags: false, art: 'block', blockArt: 'reha', beschaeftigt: true, wer: 'malin', bezug: { aufgabeId: 't-9' },
    });
    expect(blockAnfrage({ date: '2026-10-06', startMin: 600, dauerMin: 9999, titel: '', art: 'fokus' })).toMatchObject({ titel: 'Fokus', ende: '2026-10-06T18:00:00', art: 'fokus' });
  });

  it('Stunden der Woche: Termine und Blöcke getrennt, frei gestellte und Arbeitsorte zählen nicht', () => {
    const tage = wochenTage('2026-10-05');
    const s = wochenStunden([
      termin('a', '2026-10-05T09:00:00', '2026-10-05T10:00:00'),
      termin('b', '2026-10-05T10:00:00', '2026-10-05T11:30:00', { art: 'fokus' }),
      termin('c', '2026-10-06T12:00:00', '2026-10-06T13:00:00', { beschaeftigt: false }),
      termin('d', '2026-10-06T00:00:00', '2026-10-07T00:00:00', { ganztags: true, art: 'arbeitsort' }),
      termin('e', '2026-10-11T23:00:00', '2026-10-12T02:00:00', { art: 'block' }),
    ], tage);
    expect(s).toMatchObject({ terminMin: 60, blockMin: 150, gesamtMin: 210 });
    expect(s.jeTag['2026-10-05']).toBe(150);
  });

  it('wem gehört ein Block: wer ihn angelegt hat, sonst der Kalender (gemeinsam ohne `von` → beide)', () => {
    expect(gehoertZu({ von: 'malin', wer: 'beide' }, 'kevin')).toBe(false);
    expect(gehoertZu({ wer: 'beide' }, 'kevin')).toBe(true);
    expect(gehoertZu({ wer: 'kevin' }, 'malin')).toBe(false);
    expect(planArtAusTitel('Reha / Rücken')).toBe('reha');
    expect(planArtAusTitel('Deep Work')).toBe('fokus');
  });

  it('iCloud-Text: X-MAKE-ART:block + X-MAKE-BLOCK; eine andere Art nimmt die Unterart mit weg', () => {
    const ics = baueTermin({ uid: 'UID-K5-1', titel: 'Reha', start: '2026-10-06T09:00:00', ende: '2026-10-06T09:30:00', art: 'block', blockArt: 'reha' }, new Date('2026-10-01T00:00:00Z'));
    expect(ics).toContain('X-MAKE-ART:block');
    expect(ics).toContain('X-MAKE-BLOCK:reha');
    expect(ics).toContain('TRANSP:OPAQUE');
    const t = termineAus({ href: 'h', ics }, { id: 'k', name: 'Probe' }, '2026-10-01', '2026-10-10')[0];
    expect(t).toMatchObject({ art: 'block', blockArt: 'reha', beschaeftigt: true });
    expect(icsZusatz(ics)).toMatchObject({ art: 'block', blockArt: 'reha' });
    const neu = aendereTermin(ics, { art: 'termin' });
    expect('ics' in neu && neu.ics).not.toContain('X-MAKE-BLOCK');
    const pause = aendereTermin(ics, { blockArt: 'pause' });
    expect('ics' in pause && pause.ics).toContain('X-MAKE-BLOCK:pause');
  });

  it('Termin-Route prüft die Unterart', () => {
    const a = anlegenPruefen({ titel: 'Reha', start: '2026-10-06T09:00', ende: '2026-10-06T09:30', art: 'block', blockArt: 'reha' });
    expect(a.ok && a.e).toMatchObject({ art: 'block', blockArt: 'reha', beschaeftigt: true });
    const ohne = anlegenPruefen({ titel: 'X', start: '2026-10-06T09:00', ende: '2026-10-06T09:30', art: 'termin', blockArt: 'reha' });
    expect(ohne.ok && ohne.e.blockArt).toBeUndefined();
    expect(aendernPruefen({ uid: 'u', blockArt: 'quatsch' })).toMatchObject({ ok: false });
    expect(aendernPruefen({ uid: 'u', blockArt: null })).toMatchObject({ ok: true, e: { termin: { blockArt: null } } });
  });
});

describe('Übernahme der alten Wochenplan-Blöcke (rein)', () => {
  const datei = {
    '2026-09-28': [
      { id: 'pb-alt', date: '2026-10-01', startMin: 540, dauerMin: 60, titel: 'Vergangen', art: 'fokus' as const },
      { id: 'pb-heute-frueh', date: '2026-10-05', startMin: 420, dauerMin: 30, titel: 'Heute früh', art: 'reha' as const },
    ],
    '2026-10-05': [
      { id: 'pb-1', date: '2026-10-06', startMin: 540, dauerMin: 90, titel: 'Fokus', art: 'fokus' as const, appleUid: 'APPLE-1' },
      { id: 'pb-2', date: '2026-10-07', startMin: 600, dauerMin: 60, titel: 'Aufgabe X', art: 'aufgabe' as const, taskId: 't-1', appleUid: 'APPLE-WEG' },
      { id: 'pb-1', date: '2026-10-08', startMin: 600, dauerMin: 60, titel: 'Doppelt', art: 'block' as const },
      { id: '', date: '2026-10-08', startMin: 600, dauerMin: 60, titel: 'ohne Kennung', art: 'block' as const },
    ],
  };
  const jetzt = '2026-10-05T08:00:00';

  it('liest den Bestand gesäubert, je Kennung einmal; zukünftig = Beginn ≥ jetzt (Berliner Wandzeit)', () => {
    expect(altBloecke(datei).map(b => b.id)).toEqual(['pb-alt', 'pb-heute-frueh', 'pb-1', 'pb-2']);
    expect(istZukuenftig({ date: '2026-10-05', startMin: 420 }, jetzt)).toBe(false);
    expect(istZukuenftig({ date: '2026-10-05', startMin: 480 }, jetzt)).toBe(true);
    expect(altName('kevin')).toBe('wochenplan');
    expect(altName('malin')).toBe('wochenplan--malin');
  });

  it('feste, echte UID je Person + Block (für iCloud gültig, wiederholbar)', () => {
    const u = uidFuerBlock('malin', 'pb-1a2b/ä');
    expect(u).toBe(uidFuerBlock('malin', 'pb-1a2b/ä'));
    expect(u).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{7,120}$/);
    expect(u).not.toBe(uidFuerBlock('kevin', 'pb-1a2b/ä'));
  });

  it('plant nur zukünftige; vorhandene Apple-Kopie wird DER Block, gelöschte wird neu angelegt; Übernommenes zählt nur', () => {
    const p = uebernahmePlanen('kevin', datei, LEER_STAND, jetzt, uid => uid === 'APPLE-1');
    expect(p.vergangen).toBe(2);
    expect(p.offen.map(e => [e.block.id, e.weg, e.uid])).toEqual([['pb-1', 'apple', 'APPLE-1'], ['pb-2', 'neu', uidFuerBlock('kevin', 'pb-2')]]);
    const stand = standSauber({ version: 1, personen: { kevin: { bloecke: { 'pb-1': 'APPLE-1' } } } });
    expect(uebernahmePlanen('kevin', datei, stand, jetzt, () => true)).toMatchObject({ schon: 1 });
  });

  it('Archiv: nicht Übernommenes im Zeitraum, zukünftige als „wartet“, Apple-Kopien markiert', () => {
    const vor = archivBloecke('kevin', datei, LEER_STAND, '2026-10-01', '2026-10-08', jetzt);
    expect(vor.map(b => [b.id, !!b.wartet, !!b.gespiegelt])).toEqual([['archiv:kevin:pb-alt', false, false], ['archiv:kevin:pb-heute-frueh', false, false], ['archiv:kevin:pb-1', true, true], ['archiv:kevin:pb-2', true, true]]);
    expect(vor[0]).toMatchObject({ quelle: 'archiv', wer: 'kevin' });
    expect(vor.some(b => 'appleUid' in b)).toBe(false);
    const nach = archivBloecke('kevin', datei, standSauber({ version: 1, personen: { kevin: { bloecke: { 'pb-1': 'x', 'pb-2': 'y' } } } }), '2026-10-01', '2026-10-08', jetzt);
    expect(nach.map(b => b.id)).toEqual(['archiv:kevin:pb-alt', 'archiv:kevin:pb-heute-frueh']);
  });
});

describe('Spiegel Event/Familie (lib/kalender/spiegel.ts)', () => {
  it('Event: Titel, Ort als Feld, drei Stunden; ohne Uhrzeit keiner; abgesagt → weg', () => {
    expect(eventSoll({ titel: 'Stammtisch', datum: '2026-10-10', uhrzeit: '18:30', ort: 'Probehaus', status: 'geplant' })).toEqual({ art: 'soll', t: { titel: 'Stammtisch', start: '2026-10-10T18:30:00', ende: '2026-10-10T21:30:00', ganztags: false, ort: 'Probehaus' } });
    expect(eventSoll({ titel: 'X', datum: '2026-10-10', status: 'geplant' }).art).toBe('keiner');
    expect(eventSoll({ titel: 'X', datum: '2026-10-10', uhrzeit: '18:30', status: 'abgesagt' }).art).toBe('weg');
  });
  it('Date ganztägig, Gespräch mit Uhrzeit/Dauer; abgesagt/ausgefallen → weg, gehalten/stattgefunden bleibt', () => {
    expect(dateSoll({ titel: 'Kino', datum: '2026-10-09', status: 'geplant' })).toEqual({ art: 'soll', t: { titel: 'Date: Kino', start: '2026-10-09T00:00:00', ende: '2026-10-10T00:00:00', ganztags: true } });
    expect(dateSoll({ titel: 'Kino', datum: '2026-10-09', status: 'abgesagt' }).art).toBe('weg');
    expect(dateSoll({ titel: 'Kino', datum: '2026-10-09', status: 'stattgefunden' }).art).toBe('bleibt');
    expect(gespraechSoll('2026-10-11', { uhrzeit: '19:00', dauerMin: 45 })).toMatchObject({ art: 'soll', t: { start: '2026-10-11T19:00:00', ende: '2026-10-11T19:45:00' } });
    expect(gespraechSoll('2026-10-11', { uhrzeit: '19:00', dauerMin: 45 }, 'ausgefallen').art).toBe('weg');
  });
  it('Abweichung nur für Zeit, Titel, Ort; ganztägig ↔ mit Uhrzeit bleibt Apple', () => {
    const ist = { titel: 'Stammtisch · Probehaus', start: '2026-10-10T18:30:00', ende: '2026-10-10T21:30:00', ganztags: false };
    expect(spiegelAbweichung(ist, { titel: 'Stammtisch', start: '2026-10-11T18:30:00', ende: '2026-10-11T21:30:00', ganztags: false, ort: 'Probehaus' })).toEqual({ start: '2026-10-11T18:30:00', ende: '2026-10-11T21:30:00', titel: 'Stammtisch', ort: 'Probehaus' });
    expect(spiegelAbweichung({ ...ist, titel: 'Stammtisch', ort: 'Probehaus' }, { titel: 'Stammtisch', start: ist.start, ende: ist.ende, ganztags: false, ort: 'Probehaus' })).toBeNull();
    expect(spiegelAbweichung({ ...ist, ganztags: true }, { titel: 'x', start: ist.start, ende: ist.ende, ganztags: false })).toBeNull();
  });
  it('feste UID, Schein-Kennung, Gesprächs-Umzug bei neuem Wochentag', () => {
    expect(spiegelUid('event', 'ev-1')).toBe('makeos-event-ev-1');
    expect(istScheinUid('mac-0f3c')).toBe(true);
    expect(istScheinUid('makeos-event-ev-1')).toBe(false);
    expect(gespraecheUmziehen({ '2026-10-11': 'U' }, '2026-10-08', '2026-10-05', new Set())).toEqual({ von: '2026-10-11', nach: '2026-10-08' });
    expect(gespraecheUmziehen({ '2026-10-11': 'U' }, '2026-10-11', '2026-10-05', new Set())).toBeNull();
    expect(gespraecheUmziehen({ '2026-10-11': 'U' }, '2026-10-08', '2026-10-05', new Set(['2026-10-11']))).toBeNull();
  });
  it('Familie: die Termin-UID schreibt nur der Server — Browser kann sie weder setzen noch verlieren', () => {
    const jetzt = '2026-10-05T08:00:00.000Z';
    const f = { ...startBestand(jetzt), dates: [{ id: 'd-1', titel: 'Kino', ideeId: null, datum: '2026-10-09', planer: 'kevin', status: 'geplant' as const, neuesErlebnis: false, nachklang: [], von: 'kevin', am: jetzt, kalenderUid: 'makeos-date-d-1' }] };
    const ohne = wendeFamilieAn(f, [{ liste: 'dates', op: 'upsert', eintrag: { id: 'd-1', titel: 'Kino', datum: '2026-10-10', status: 'abgesagt' } }], 'malin', jetzt).familie;
    expect(ohne.dates[0]).toMatchObject({ status: 'abgesagt', kalenderUid: 'makeos-date-d-1' });
    const fremd = wendeFamilieAn(f, [{ liste: 'dates', op: 'upsert', eintrag: { id: 'd-2', titel: 'Neu', datum: '2026-10-12', status: 'geplant', kalenderUid: 'ERFUNDEN' } }], 'kevin', jetzt).familie;
    expect(fremd.dates.find(d => d.id === 'd-2')?.kalenderUid).toBeUndefined();
    const e = setzeFelder({ ...f, einstellungen: { ...f.einstellungen, kalenderTermine: { '2026-10-11': 'U-1' } } }, { einstellungen: { ...f.einstellungen, kinder: true, kalenderTermine: {} } }, 'kevin', jetzt);
    expect(e.einstellungen).toMatchObject({ kinder: true, kalenderTermine: { '2026-10-11': 'U-1' } });
  });
});

describe('Modus Kalender · Planen · Aufgaben (lib/kalender/modus.ts)', () => {
  it('Adresse lesen und schreiben — Aufgaben schließt Planen aus, Filter reisen mit', () => {
    expect(modusAusAdresse('?modus=planen&tag=2026-10-06&space=privat')).toEqual({ modus: 'planen', tag: '2026-10-06', space: 'privat' });
    expect(modusAusAdresse('modus=aufgaben&as=kdc&ap=p-1&al=l-1&wer=meine')).toEqual({ modus: 'aufgaben', as: 'kdc', ap: 'p-1', al: 'l-1', wer: 'meine' });
    expect(modusAusAdresse('modus=quatsch&wer=alle&as=<x>&tag=2026-13-99')).toEqual({ modus: 'kalender', wer: 'alle' });
    expect(kalenderLink({ modus: 'aufgaben', as: 'kdc', wer: 'meine' })).toBe('/os/kalender?modus=aufgaben&as=kdc&wer=meine');
    expect(kalenderLink({ modus: 'kalender', space: 'business', wer: 'alle' })).toBe('/os/kalender?space=business');
    expect(kalenderLink()).toBe('/os/kalender');
  });

  it('Gruppen nach Fälligkeit: Überfällig · Heute · Diese Woche (bis Sonntag) · Später · Ohne Datum', () => {
    const heute = '2026-10-07'; // Mittwoch
    expect(['2026-10-06', '2026-10-07', '2026-10-11', '2026-10-12', undefined].map(d => faelligGruppe(d, heute))).toEqual(['ueberfaellig', 'heute', 'woche', 'spaeter', 'ohne']);
    type Z = { id: string; title: string; tag?: string; zeit?: string };
    const g = faelligGruppen<Z>([{ id: 'b', title: 'B', tag: '2026-10-07', zeit: '14:00' }, { id: 'a', title: 'A', tag: '2026-10-07', zeit: '09:00' }, { id: 'c', title: 'C', tag: '2026-10-01' }], [{ id: 'z', title: 'Z' }], heute);
    expect(g.heute.map(x => x.id)).toEqual(['a', 'b']);
    expect(g.ueberfaellig.map(x => x.id)).toEqual(['c']);
    expect(g.ohne.map(x => x.id)).toEqual(['z']);
  });

  it('Vorfilter: Space, Projekt, Liste, meine/beteiligt (der Rest sind K3-Regeln)', () => {
    const t = (id: string, x: Partial<Task>): Task => ({ id, projectId: 'p-1', title: id, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '', updatedAt: '', ...x } as Task);
    const l = [t('a', { spaceId: 'kdc', listeId: 'l-1' }), t('b', { spaceId: 'kdc', assignee: 'malin', beteiligte: ['kevin'] }), t('c', { spaceId: 'privat', projectId: 'p-2' })];
    expect(aufgabenVorfiltern(l, { as: 'kdc', wer: 'alle', ich: 'kevin' }).map(x => x.id)).toEqual(['a', 'b']);
    expect(aufgabenVorfiltern(l, { wer: 'meine', ich: 'kevin' }).map(x => x.id)).toEqual(['a', 'c']);
    expect(aufgabenVorfiltern(l, { wer: 'beteiligt', ich: 'kevin' }).map(x => x.id)).toEqual(['b']);
    expect(aufgabenVorfiltern(l, { al: 'l-1', wer: 'alle', ich: 'kevin' }).map(x => x.id)).toEqual(['a']);
    expect(aufgabenVorfiltern(l, { ap: 'p-2', wer: 'alle', ich: 'kevin' }).map(x => x.id)).toEqual(['c']);
  });

  it('Umschalter rendert zwei Symbole mit Tooltip, der aktive ist markiert (Links bzw. Knöpfe)', () => {
    const html = renderToStaticMarkup(createElement(KalenderAufgabenSchalter, { aktiv: 'aufgaben', kalender: { href: '/os/kalender?space=business' }, aufgaben: { href: '/os/aufgaben' }, tasten: { kalender: 'k', aufgaben: 'u' } }));
    expect(html).toContain('title="Kalender (Taste k)"');
    expect(html).toContain('title="Aufgaben (Taste u)"');
    expect(html).toContain('href="/os/kalender?space=business"');
    expect(html.match(/aria-current="page"/g)?.length).toBe(1);
    expect((html.match(/<svg/g) ?? []).length).toBe(2);
    const knoepfe = renderToStaticMarkup(createElement(KalenderAufgabenSchalter, { aktiv: 'kalender', kalender: { onClick: () => {} }, aufgaben: { onClick: () => {} } }));
    expect(knoepfe).toContain('aria-pressed="true"');
    expect(knoepfe).toContain('aria-pressed="false"');
  });
});

// ── Wächter: EIN Kalender, EINE Quelle ───────────────────────────────────────
const WURZEL = path.resolve(__dirname, '..');
function dateien(ordner: string): string[] {
  const raus: string[] = [];
  for (const n of readdirSync(path.join(WURZEL, ordner))) {
    const p = path.join(ordner, n);
    if (statSync(path.join(WURZEL, p)).isDirectory()) raus.push(...dateien(p));
    else if (/\.(ts|tsx|mjs)$/.test(n)) raus.push(p);
  }
  return raus;
}
const QUELLEN = ['app', 'components', 'lib', 'context', 'hooks'].flatMap(dateien);
const lies = (p: string) => readFileSync(path.join(WURZEL, p), 'utf8');

describe('Wächter K5', () => {
  it('den alten Wochenplan-Bestand liest nur noch die Übernahme', () => {
    const erlaubt = new Set(['lib/planung/wochenplan-uebernahme.ts', 'lib/planung/wochenplan-uebernahme-server.ts', 'lib/crm/speicher-register.ts']);
    const leser = QUELLEN.filter(p => !erlaubt.has(p) && /(loadJson|updateJson|saveJson)[^;\n]*\(\s*(speicherFuer\(\s*)?'wochenplan'|'wochenplan--/.test(lies(p)));
    expect(leser).toEqual([]);
    expect(QUELLEN.filter(p => /fetch\([^)]*\/api\/state\/wochenplan/.test(lies(p)))).toEqual([]);
  });
  it('niemand schreibt mehr über die Altwege /api/apple-calendar/{create,termin}', () => {
    // Die Analyse-Route (Kalender-Agent, autonom) repariert Paket R-Z — sie ruft den Altweg danach nicht mehr (410).
    const aufrufer = QUELLEN.filter(p => !p.startsWith('app/api/apple-calendar/') && p !== 'app/api/kalender/analyse/route.ts' && /fetch\([^)]*\/api\/apple-calendar\/(create|termin)/.test(lies(p)));
    expect(aufrufer).toEqual([]);
    // Die 410-Stummel sind seit 05.10. entfernt (Routen-Register, ENTFERNTE_ROUTEN) — Next antwortet dort 404.
    expect(existsSync(path.join(WURZEL, 'app/api/apple-calendar/create/route.ts'))).toBe(false);
    expect(existsSync(path.join(WURZEL, 'app/api/apple-calendar/termin/route.ts'))).toBe(false);
  });
  it('keine KEMARIS-Beispieldaten mehr in Heute, Tagesplan, Energie, Signalen, Vorschlag (M365 kommt echt)', () => {
    // Offen für Paket R-Z: der ZOE-Lesepfad (lib/kalender/zoe-sicht-server.ts, genutzt von Brain, plan_block, Vorschlag,
    // Netzwerk) liest den Bestand noch als `kemaris` — die K5-Leser nehmen nur `termine`. Die Route liefert nichts mehr.
    const leser = QUELLEN.filter(p => /\/api\/kemaris-calendar|'kemaris-calendar'\)/.test(lies(p)) && !['app/api/kemaris-calendar/route.ts', 'lib/brain.ts', 'lib/kalender/zoe-sicht-server.ts'].includes(p));
    expect(leser).toEqual([]);
    expect(lies('app/api/kemaris-calendar/route.ts')).not.toMatch(/saveJson|EVENTS/);
  });
  it('das Alt-Dashboard /calendar und sein Kontext sind weg (kein Abruf auf /anmelden)', () => {
    expect(QUELLEN.filter(p => /CalendarContext|useCalendar\b|MOCK_CALENDAR_EVENTS|components\/calendar\//.test(lies(p)) && !p.startsWith('app/layout.tsx'))).toEqual([]);
    expect(lies('app/layout.tsx')).not.toContain('CalendarProvider>');
  });
  it('der Aufgaben-Modus nutzt den Aufgaben-Schreibweg (K3-Hook), keine eigene Liste', () => {
    const q = lies('components/os/kalender/AufgabenModus.tsx');
    expect(q).toContain('useAufgabenImKalender');
    expect(q).toContain('aufgabenFuerKalender');
    expect(q).not.toMatch(/dispatch\(|fetch\(/);
  });
});
