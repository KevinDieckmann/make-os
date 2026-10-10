// ─── Erholung „überall einstellbar“ (10.10., Kevin) — Kalender & Planen, Routinen & Aufgaben, Ziele/Fokus/Heute, Kapazität & Zeit ──────
// Wächter je Andock-Stelle, rein bzw. über den Quelltext: Block-Unterart `erholung` (Altbestand `reha` zählt gleich), andere sehen
// Erholungs-Blöcke nur „Belegt“ (ohne Unterart); Routine-Kategorie „Erholung“ (fremde Routinen bleiben „Belegt“, ohne Kategorie);
// Aufgaben-Marke nur Privat; Kapazität zieht geplante Erholung nur als Stunden ab (kein Termin, keine Art, kein Titel); Zeit-Bereich
// „Erholung“; Heute-Widget nur in der Privat-Sicht; Register, Konto-Bestände, Routen-Register; ZOE nur mit Einwilligung (b).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { istErholungsArt, istErholungsBlock, istBlockArt } from '@/lib/kalender/arten';
import { planArtVon, blockAnfrage, blockAusTermin, planArtAusTitel } from '@/lib/planung/bloecke';
import { maskieren, type TerminMitBezug } from '@/lib/kalender/bezug';
import { rehaFehltHeute, rehaGewohnt } from '@/lib/planung/reha-regel';
import { verfuegbarkeitAus } from '@/lib/kalender/verfuegbarkeit-regeln';
import { tageAusVerfuegbarkeit } from '@/lib/kapazitaet/modell';
import { sauberRoutine, routinenFuerBetrachter, istGesundheitsKategorie } from '@/lib/planung/routinen';
import { istArbeitsBlock } from '@/lib/arbeitsrahmen/regel';
import { taskSauber } from '@/lib/aufgaben/saeubern';
import { ERHOLUNG_ZEIT_SCHLUESSEL } from '@/lib/zeitmessung/erholung';
import { bereichLabel } from '@/lib/zeitmessung/kennzahlen';
import { registerEintrag } from '@/lib/crm/speicher-register';
import { PERSON_BESTAENDE } from '@/lib/datenschutz/konto-daten';
import { ROUTEN_REGISTER } from '@/lib/zugang/routen-register';
import { WEG } from '@/lib/wege';
import { SEITEN_SUCHE } from '@/lib/make-one/seiten';
import { ART_FARBE, PLAN_ARTEN } from '@/types/planer';
import type { Routine } from '@/lib/planung/typen';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const TAG = '2026-10-07';

const termin = (x: Partial<TerminMitBezug> & { wer?: string }): TerminMitBezug & { wer?: string } => ({
  id: `kal|${x.uid ?? 'u1'}`, uid: 'u1', titel: 'Erholung', start: `${TAG}T10:00:00`, ende: `${TAG}T11:00:00`, ganztags: false, kalender: 'Anna', serie: false,
  beschaeftigt: true, art: 'block', ...x,
} as never);

describe('(a) Kalender & Planen', () => {
  it('Unterart erholung ist ein Block; reha bleibt gültig und zählt als Erholung', () => {
    expect(PLAN_ARTEN).toContain('erholung');
    expect(PLAN_ARTEN).toContain('reha');
    expect(ART_FARBE.erholung).toBe(ART_FARBE.reha);
    expect(istBlockArt('erholung')).toBe(true);
    expect(istErholungsArt('erholung') && istErholungsArt('reha')).toBe(true);
    expect(istErholungsArt('pause') || istErholungsArt('fokus')).toBe(false);
    expect(istErholungsBlock({ art: 'block', blockArt: 'erholung' })).toBe(true);
    expect(istErholungsBlock({ art: 'fokus', blockArt: 'erholung' })).toBe(false);
    expect(planArtVon({ art: 'block', blockArt: 'erholung', ganztags: false })).toBe('erholung');
    expect(planArtAusTitel('Erholung am Abend')).toBe('erholung');
    expect(istArbeitsBlock('block', 'erholung')).toBe(false);
    expect(istArbeitsBlock('block', 'reha')).toBe(false);
  });

  it('neue Erholungs-Blöcke sind privat; Fokus nicht', () => {
    expect(blockAnfrage({ date: TAG, startMin: 600, dauerMin: 30, titel: 'Erholung', art: 'erholung' }, 'anna')).toMatchObject({ art: 'block', blockArt: 'erholung', sichtbarkeit: 'privat' });
    expect(blockAnfrage({ date: TAG, startMin: 600, dauerMin: 30, titel: 'Fokus', art: 'fokus' })).not.toHaveProperty('sichtbarkeit');
  });

  it('andere Personen sehen Erholungs-Blöcke nur „Belegt“ — ohne Titel und ohne Unterart, auch ohne CLASS:PRIVATE', () => {
    const t = termin({ blockArt: 'erholung', titel: 'GEHEIM-ERHOLUNG', von: 'anna', wer: 'anna' } as never);
    const fremd = maskieren(t, 'ben');
    expect(fremd).toMatchObject({ titel: 'Belegt', maskiert: true });
    expect(JSON.stringify(fremd)).not.toContain('GEHEIM-ERHOLUNG');
    expect(fremd).not.toHaveProperty('blockArt');
    expect(blockAusTermin(fremd as never)?.art).toBe('block');
    expect(maskieren(t, 'anna').titel).toBe('GEHEIM-ERHOLUNG');
    // Ein normaler Block derselben Person bleibt sichtbar (keine Verschärfung über Erholung hinaus).
    expect(maskieren(termin({ blockArt: 'pause', titel: 'Pause', von: 'anna', wer: 'anna' } as never), 'ben').titel).toBe('Pause');
  });

  it('Reha-Schild und „Durchgeplant“ zählen jeden Erholungs-Block', () => {
    const vorher = [{ date: '2026-09-30', art: 'erholung' }];
    expect(rehaGewohnt(vorher, TAG)).toBe(true);
    expect(rehaFehltHeute([...vorher, { date: TAG, art: 'fokus' }], TAG)).toBe(true);
    expect(rehaFehltHeute([...vorher, { date: TAG, art: 'reha' }], TAG)).toBe(false);
    expect(rehaFehltHeute([...vorher, { date: TAG, art: 'erholung' }], TAG)).toBe(false);
  });

  it('Planen und Tagesplan bieten den Baustein Erholung', () => {
    expect(lies('components/os/kalender/Planen.tsx')).toMatch(/art: 'erholung', titel: 'Erholung'/);
    expect(lies('components/os/kalender/Planen.tsx')).toContain("(['block', 'fokus', 'erholung', 'pause'] as const)");
    expect(lies('components/os/TagesplanView.tsx')).toMatch(/art: 'erholung', titel: 'Erholung'/);
  });
});

describe('(b) Routinen & Aufgaben', () => {
  it('Routine-Kategorie „Erholung“ wird gespeichert und zählt zur Gesundheit', () => {
    expect(sauberRoutine({ id: 'r-1', label: 'Dehnen', kategorie: 'erholung', owner: 'anna' })?.kategorie).toBe('erholung');
    expect(istGesundheitsKategorie('erholung') && istGesundheitsKategorie('gesundheit') && istGesundheitsKategorie(undefined)).toBe(true);
    expect(istGesundheitsKategorie('business')).toBe(false);
    expect(lies('components/os/RoutinenPlanerView.tsx')).toContain("{ id: 'erholung', label: 'Erholung'");
  });

  it('fremde Erholungs-Routinen bleiben „Belegt“ — ohne Titel und ohne Kategorie', () => {
    const r: Routine = { id: 'r-geheim', label: 'GEHEIM-ROUTINE', wann: 'abend', kategorie: 'erholung', dauerMin: 20, aktiv: true, owner: 'anna', space: 'privat' };
    const [fuerBen] = routinenFuerBetrachter([r], 'ben');
    expect(fuerBen).toMatchObject({ belegt: true, kategorie: 'leben' });
    expect(JSON.stringify(fuerBen)).not.toMatch(/GEHEIM|erholung/);
    expect(routinenFuerBetrachter([r], 'anna')[0].kategorie).toBe('erholung');
  });

  it('Aufgaben-Marke „Erholung“ nur im Privaten — im Business fällt sie weg', () => {
    const basis = { id: 't-1', title: 'Spaziergang', projectId: 'p', status: 'done', priority: 'low', assignee: 'anna', tags: [], subTasks: [], dependencies: [], sortOrder: 0 };
    expect(taskSauber({ ...basis, erholung: true, spaceId: 'privat' })?.erholung).toBe(true);
    expect(taskSauber({ ...basis, erholung: true })?.erholung).toBe(true);
    expect(taskSauber({ ...basis, erholung: true, spaceId: 'ug' })).not.toHaveProperty('erholung');
    expect(taskSauber({ ...basis, erholung: true, space: 'business' })).not.toHaveProperty('erholung');
    expect(taskSauber({ ...basis, erholung: 'ja', spaceId: 'privat' })).not.toHaveProperty('erholung');
    expect(lies('components/os/aufgaben/AufgabeDetail.tsx')).toContain("aendern({ erholung: t.erholung ? undefined : true })");
  });
});

describe('(c) Ziele, Fokus & Heute', () => {
  it('Heute-Widget „Erholung heute“ steht im Katalog und im Standard NUR der Privat-Sicht', () => {
    const v = lies('components/os/HeuteView.tsx');
    const std = v.slice(v.indexOf('export const HEUTE_STANDARD'));
    const privat = std.slice(std.indexOf('privat: ['), std.indexOf('business: ['));
    const business = std.slice(std.indexOf('business: ['), std.indexOf('\n};'));
    expect(privat).toContain("{ id: 'erholung', art: 'erholung', breite: 2 }");
    expect(business).not.toContain("art: 'erholung'");
    const w = lies('components/os/flaeche/widgets.tsx');
    expect(w).toContain("erholung: { art: 'erholung', label: 'Erholung heute', bereich: 'Gesundheit'");
    // Das Widget liest nur die eigene Erholung (kein ?fuer) über die Erholungs-Route.
    const h = lies('components/os/gesundheit/ErholungHeute.tsx');
    expect(h).toContain('useErholung()');
    expect(h).toContain('if (!d || !d.eigene) return null;');
  });

  it('Reiter „Erholung“ unter Gesundheit, Weg und Suche', () => {
    expect(lies('components/os/GesundheitView.tsx')).toContain("{ id: 'erholung', label: 'Erholung' }");
    expect(WEG.erholung()).toBe('/os/gesundheit?s=erholung');
    expect(WEG.erholung('ben')).toBe('/os/gesundheit?s=erholung&fuer=ben');
    expect(SEITEN_SUCHE.some(x => x.href === WEG.erholung())).toBe(true);
  });

  it('ZOE bekommt die Erholung nur mit Einwilligung (b) über gatherBrain', () => {
    const b = lies('lib/brain.ts');
    expect(b).toContain("const erholung = gesundheitFrei ? await erholungZoeFuer(person, heute).catch(() => '') : '';");
    expect(b).toMatch(/b\.erholung \? `\$\{koerper\}\\n\$\{daten\('erholung', b\.erholung\)\}` : koerper/);
  });
});

describe('(d) Kapazität & Zeit', () => {
  it('geplante Erholung im Arbeitsfenster zieht ab — nur als Stunden, kein Termin, keine Art, kein Titel', () => {
    const v = verfuegbarkeitAus({
      person: 'anna', von: TAG, bis: '2026-10-08',
      termine: [
        termin({ uid: 'e', titel: 'GEHEIM-ERHOLUNG', blockArt: 'erholung', wer: 'anna', start: `${TAG}T10:00:00`, ende: `${TAG}T11:30:00` } as never),
        termin({ uid: 'f', titel: 'Fokus', art: 'fokus', wer: 'anna', start: `${TAG}T13:00:00`, ende: `${TAG}T14:00:00` } as never),
        termin({ uid: 't', titel: 'Kunde', art: 'termin', wer: 'anna', start: `${TAG}T15:00:00`, ende: `${TAG}T15:30:00` } as never),
      ],
      bloecke: [{ id: 'b', owner: 'anna', wochentag: 3, von: '09:00', bis: '18:00', art: 'business' }],
    });
    expect(v.tage[0].beschaeftigt.filter(b => b.erholung)).toHaveLength(1);
    const { tage } = tageAusVerfuegbarkeit(v);
    expect(tage[0]).toMatchObject({ terminStunden: 2, terminAnzahl: 1 }); // 1,5 h Erholung + 0,5 h Termin; Fokus zählt nicht
    expect(JSON.stringify(tage)).not.toMatch(/GEHEIM|erholung/);
  });

  it('Erholung ist ein eigener Zeitbereich im Privaten', () => {
    expect(ERHOLUNG_ZEIT_SCHLUESSEL).toBe('privat:erholung');
    expect(bereichLabel('erholung')).toBe('Erholung');
    expect(lies('lib/zeitmessung/fokus-laufend.ts')).toContain('if (t.erholung) { fokusMerken({ von: new Date().toISOString(), schluessel: ERHOLUNG_ZEIT_SCHLUESSEL');
  });
});

describe('Daten & Recht', () => {
  it('Bestand je Person, Art. 9, Bereich „person“, Export/Löschen mit Suffix, Route im Register (Klasse person)', () => {
    const e = registerEintrag('erholung--anna');
    expect(e?.kategorie).toContain('art9');
    expect(e?.bereich).toBe('person');
    expect(e?.rechtsgrundlage).toMatch(/Art\. 9/);
    expect(PERSON_BESTAENDE.find(b => b.basis === 'erholung')).toEqual({ basis: 'erholung', nurMitSuffix: true });
    const r = ROUTEN_REGISTER['gesundheit/erholung'];
    expect(r.methoden).toMatchObject({ GET: 'person', PATCH: 'person' });
  });

  it('keine persönlichen Inhalte im Code der Erholung (Wortliste der Gesundheits-Module)', () => {
    const KONKRET = /chronisch|entzündlich|kortison|salbe|tablette|medikament|infusion|spritze|dermatolog|neurolog|orthopäd|hautarzt|nikotin|tabak|rücken|ruecken|nacken|hüfte|gelenk/i;
    for (const f of ['lib/gesundheit/erholung.ts', 'lib/gesundheit/erholung-lage.ts', 'lib/gesundheit/erholung-server.ts', 'lib/gesundheit/erholung-zoe.ts', 'components/os/gesundheit/Erholung.tsx', 'components/os/gesundheit/ErholungHeute.tsx', 'components/os/gesundheit/erholung-daten.ts', 'app/api/gesundheit/erholung/route.ts']) {
      expect(lies(f), f).not.toMatch(KONKRET);
      expect(lies(f), f).not.toMatch(/\bkevin\b|\bmalin\b/i);
    }
  });
});
