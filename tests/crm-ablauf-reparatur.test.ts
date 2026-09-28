// Ablaufprüfung 28.09. (Reparaturen W1–W8, a–i, Kleines) — die reinen Teile. Alle Daten erfunden.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, FollowUp, Kampagne, Firma } from '@/lib/crm/typen';
import { leererBestand } from '@/lib/crm/speicher';
import { aktivitaetImCrm, dealZurAktivitaet } from '@/lib/crm/aktivitaet-folgen';
import { dealBauen, dealTitel, kontaktPhaseNachDeal, DEAL_PERSONEN_MAX } from '@/lib/crm/deal-anlegen';
import { EINGESCHRAENKT_FEHLER } from '@/lib/crm/einschraenkung';
import { konflikteZusammenfuehren, leererKonfliktStand } from '@/lib/crm/import-konflikte';
import { firmenRueckgaengig, firmaAbdruck, laufOhne, rueckgaengigRechnen, type ImportLauf } from '@/lib/crm/import-lauf';
import { crmSchnappschuesse, schnappschuesse, schnappschussKonflikte, schnappschuesseAnwenden, zusammenLauf, rueckgaengigGruende } from '@/lib/crm/zusammenfuehren-lauf';
import { zusammenfuehren, zusammenfuehrenPruefen, wasWandert, wanderungText, PRIVAT_NOTIZ_MAX } from '@/lib/crm/dubletten';
import { personUmbiegen as crmUm } from '@/lib/crm/person-verweise';
import { notizAnhaengen, anfrageBauen, LEAD_NOTIZ_MAX } from '@/lib/crm/anfragen';
import { neuanlageSperre, sperrlisteMit, SPERR_HINWEIS } from '@/lib/crm/sperrliste';
import { werIstDran } from '@/lib/crm/heute';
import { fingerabdruck } from '@/lib/store/fingerabdruck';

const HEUTE = '2026-09-28';
const JETZT = '2026-09-28T09:00:00.000Z';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: 'Testa', nachname: `Muster${id}`, eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({
  id, titel: `Deal ${id}`, kontaktIds: ['c-a'], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'qualifiziert', historie: [],
  qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'offen', besitzer: 'kevin', angelegt: '2026-09-01T10:00:00.000Z', geaendert: '2026-09-01T10:00:00.000Z', letzteAktivitaet: '2026-09-01', ...x,
});
const fu = (id: string, x: Partial<FollowUp> = {}): FollowUp => ({ id, bezug: { art: 'kontakt', id: 'c-a' }, kontaktId: 'c-a', art: 'mail', text: 'Nachfassen', faellig: HEUTE, zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: JETZT, geaendert: JETZT, ...x });
const kp = (id: string, x: Partial<Kampagne> = {}): Kampagne => ({ id, name: `Kampagne ${id}`, playbook: 'x', ziel: 'y', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds: ['c-a', 'c-b'], ergebnisse: [], von: 'hand', geaendert: JETZT, ...x } as Kampagne);
const crmMit = (x: Partial<CrmBestand>): CrmBestand => ({ ...leererBestand(), ...x });

describe('W1 · letzte Aktivität am Deal', () => {
  it('Bezug auf einen offenen Deal setzt letzteAktivitaet = heute (nie rückwärts)', () => {
    const crm = crmMit({ chancen: [deal('ch-1'), deal('ch-2')] });
    const r = aktivitaetImCrm(crm, { kontakt: k('a'), bezug: 'ch-2', von: 'kevin', heute: HEUTE, jetzt: JETZT });
    expect(r.dealId).toBe('ch-2');
    expect(r.crm.chancen.find(c => c.id === 'ch-2')?.letzteAktivitaet).toBe(HEUTE);
    expect(r.crm.chancen.find(c => c.id === 'ch-1')?.letzteAktivitaet).toBe('2026-09-01');
    const spaeter = crmMit({ chancen: [deal('ch-1', { letzteAktivitaet: '2026-09-30' })] });
    expect(aktivitaetImCrm(spaeter, { kontakt: k('a'), bezug: 'ch-1', von: 'kevin', heute: HEUTE, jetzt: JETZT }).geaendert).toBe(false);
  });
  it('ohne Bezug nur bei genau EINEM offenen Deal der Person; geplantes Meeting zählt nicht', () => {
    expect(dealZurAktivitaet(crmMit({ chancen: [deal('ch-1')] }), 'c-a')).toBe('ch-1');
    expect(dealZurAktivitaet(crmMit({ chancen: [deal('ch-1'), deal('ch-2')] }), 'c-a')).toBeNull();
    expect(dealZurAktivitaet(crmMit({ chancen: [deal('ch-1', { stufe: 'gewonnen' })] }), 'c-a')).toBeNull();
    expect(aktivitaetImCrm(crmMit({ chancen: [deal('ch-1')] }), { kontakt: k('a'), von: 'kevin', heute: HEUTE, jetzt: JETZT, geplant: true }).geaendert).toBe(false);
  });
});

describe('(f) Ergebnis „Sperre“', () => {
  it('sagt offene werbliche Follow-ups ab, nimmt die Person aus aktiven/Entwurfs-Kampagnen — Ergebnis zählt vorher', () => {
    const crm = crmMit({
      followups: [fu('fu-mail'), fu('fu-anruf', { art: 'anruf', status: 'verpasst' }), fu('fu-termin', { art: 'termin' }), fu('fu-fremd', { kontaktId: 'c-b', bezug: { art: 'kontakt', id: 'c-b' } }), fu('fu-erledigt', { status: 'erledigt' })],
      kampagnen: [kp('kp-1'), kp('kp-2', { status: 'entwurf' }), kp('kp-3', { status: 'abgeschlossen' as Kampagne['status'] })],
    });
    const gesperrt = k('a', { werbesperre: { seit: HEUTE, grund: 'Widerspruch' } });
    const r = aktivitaetImCrm(crm, { kontakt: gesperrt, bezug: 'kp-1', ergebnis: 'sperre', von: 'malin', heute: HEUTE, jetzt: JETZT });
    const st = Object.fromEntries(r.crm.followups.map(f => [f.id, f.status]));
    expect(st).toEqual({ 'fu-mail': 'abgesagt', 'fu-anruf': 'abgesagt', 'fu-termin': 'offen', 'fu-fremd': 'offen', 'fu-erledigt': 'erledigt' });
    expect(r.crm.followups.find(f => f.id === 'fu-mail')?.notiz).toMatch(/Werbewiderspruch/);
    expect(r.crm.kampagnen.find(x => x.id === 'kp-1')?.kontaktIds).toEqual(['c-b']);
    expect(r.crm.kampagnen.find(x => x.id === 'kp-2')?.kontaktIds).toEqual(['c-b']);
    expect(r.crm.kampagnen.find(x => x.id === 'kp-3')?.kontaktIds).toEqual(['c-a', 'c-b']);
    expect(r.crm.kampagnen.find(x => x.id === 'kp-1')?.ergebnisse).toEqual([{ kontaktId: 'c-a', ergebnis: 'kein_interesse', am: HEUTE, von: 'malin' }]);
    expect(r).toMatchObject({ abgesagt: 2, kampagnen: 2 });
  });
});

describe('W6/W8/(d)/(e) · Deal anlegen', () => {
  const firmen: Pick<Firma, 'id' | 'name'>[] = [{ id: 'f-acme', name: 'Acme GmbH' }];
  const ctx = (kontakte: Kontakt[]) => ({ kontakte, firmen, chancen: [] as Chance[], leadZeilen: [], person: 'kevin', jetzt: JETZT });
  const schritt = { text: 'Bedarfsgespräch', datum: '2026-10-01' };
  it('W8: eingeschränkte Person → 409 mit EINGESCHRAENKT_FEHLER', () => {
    const r = dealBauen({ kontaktIds: ['c-a'], schritt }, ctx([k('a', { eingeschraenkt: { seit: HEUTE, grund: 'Richtigkeit bestritten', von: 'kevin' } })]));
    expect(r).toMatchObject({ ok: false, status: 409, fehler: EINGESCHRAENKT_FEHLER });
  });
  it('(e) mehr als 20 Personen → 413 mit Grund, nichts gekürzt', () => {
    const ids = Array.from({ length: DEAL_PERSONEN_MAX + 1 }, (_, i) => `c-p${i + 10}`);
    const r = dealBauen({ kontaktIds: ids, schritt }, ctx(ids.map(id => k(id.slice(2)))));
    expect(r).toMatchObject({ ok: false, status: 413 });
    expect(dealBauen({ kontaktIds: ids.slice(0, DEAL_PERSONEN_MAX), schritt }, ctx(ids.map(id => k(id.slice(2))))).ok).toBe(true);
  });
  it('(d) Titel ohne Firma trägt keinen vollen Personennamen', () => {
    const r = dealBauen({ kontaktIds: ['c-a'], schritt, art: 'projekt' }, ctx([k('a', { nachname: 'Beispielmann' })]));
    expect(r.ok && r.chance.titel).toBe('Deal · Projekt · B.');
    expect(dealTitel('retainer', { name: 'Acme GmbH' }, undefined)).toBe('Acme GmbH · Retainer');
    expect(dealTitel('workshop', undefined, undefined)).toBe('Deal · Workshop');
  });
  it('W6: gesetzte Phase unter Opportunity wird Opportunity, leer bleibt leer, höhere bleibt', () => {
    expect(kontaktPhaseNachDeal('mql')).toBe('opportunity');
    expect(kontaktPhaseNachDeal('lead')).toBe('opportunity');
    expect(kontaktPhaseNachDeal(undefined)).toBeUndefined();
    expect(kontaktPhaseNachDeal('opportunity')).toBeUndefined();
    expect(kontaktPhaseNachDeal('kunde')).toBeUndefined();
  });
});

describe('(a) Import-Konflikte zusammenführen statt ersetzen', () => {
  it('offene Konflikte früherer Listen bleiben; je Person und Feld gewinnt der jüngste Listenwert', () => {
    const alt = { ...leererKonfliktStand(), konflikte: [{ kontaktId: 'c-a', feld: 'notiz', online: 'O', liste: 'Liste 1' }, { kontaktId: 'c-b', feld: 'typ', online: 'X', liste: 'Y' }], moeglicheDubletten: [{ kontaktId: 'c-a', mitId: 'c-z', grund: 'gleicher Name' }] };
    const neu = { ...leererKonfliktStand(), konflikte: [{ kontaktId: 'c-a', feld: 'notiz', online: 'O', liste: 'Liste 2' }], moeglicheDubletten: [{ kontaktId: 'c-a', mitId: 'c-z', grund: 'gleicher Name' }], ohneBesitzer: 3, stand: JETZT, quelle: 'Upload: b.csv' };
    const r = konflikteZusammenfuehren(alt, neu);
    expect(r.konflikte).toEqual([{ kontaktId: 'c-a', feld: 'notiz', online: 'O', liste: 'Liste 2' }, { kontaktId: 'c-b', feld: 'typ', online: 'X', liste: 'Y' }]);
    expect(r.moeglicheDubletten).toHaveLength(1);
    expect(r).toMatchObject({ ohneBesitzer: 3, quelle: 'Upload: b.csv' });
    expect(konflikteZusammenfuehren(null, neu).konflikte).toHaveLength(1);
  });
});

describe('W7 · neue Firmen beim Import-Rückgängig', () => {
  const f = (id: string, x: Record<string, unknown> = {}) => ({ id, name: id, rolle: 'offen', geaendert: JETZT, ...x });
  it('nur unverändert und verweisfrei — sonst Konflikt, die Firma bleibt', () => {
    const lauf = { firmenNeu: { 'f-frei': firmaAbdruck(f('f-frei')), 'f-geaendert': firmaAbdruck(f('f-geaendert')), 'f-verknuepft': firmaAbdruck(f('f-verknuepft')), 'f-weg': 'egal' } };
    const firmen = [f('f-frei'), f('f-geaendert', { branche: 'Handel' }), f('f-verknuepft'), f('f-alt')];
    const r = firmenRueckgaengig(firmen, lauf, id => id === 'f-verknuepft');
    expect(r.weg).toEqual(['f-frei']);
    expect(r.konflikte).toEqual([{ id: 'f-geaendert', grund: 'seitdem geändert' }, { id: 'f-verknuepft', grund: 'inzwischen verknüpft' }]);
  });
  it('ein Dubletten-Lauf geht nie über den Import-Weg zurück', () => {
    const l = { id: 'imp-x', am: JETZT, person: 'kevin', quelle: 'Dubletten', art: 'zusammenfuehren', neu: [], vorher: [k('a')], nachher: {} } as ImportLauf;
    expect(rueckgaengigRechnen([k('a', { notiz: 'jetzt' })], l, () => false)).toMatchObject({ zurueck: 0, konflikte: [] });
  });
});

describe('W4 · Zusammenführen mit Rückgängig', () => {
  const a = k('a', { email: 'testa@example.invalid', firma: 'Acme' });
  const b = k('b', { email: 'testa.b@example.invalid', firma: 'Acme', einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'x' }], aktivitaeten: [{ am: '2026-09-02T10:00:00.000Z', art: 'anruf', von: 'kevin' }] });
  const crm = crmMit({ chancen: [deal('ch-1', { kontaktIds: ['c-b'] }), deal('ch-2', { kontaktIds: ['c-a', 'c-b'] }), deal('ch-3', { kontaktIds: ['c-x'] })], followups: [fu('fu-1', { kontaktId: 'c-b', bezug: { art: 'kontakt', id: 'c-b' } })], kampagnen: [kp('kp-1')] });

  it('Vorschau: was wandert (Anzahlen)', () => {
    const w = wasWandert(crm, b, 2);
    expect(w).toEqual({ deals: 2, aktivitaeten: 1, followups: 1, dateien: 2, einwilligungen: 1, kampagnen: 1 });
    expect(wanderungText(w)).toBe('2 Deals · 1 Aktivität · 1 Follow-up · 2 Dateien · 1 Einwilligung · 1 Kampagne');
  });

  it('Schnappschüsse: nur geänderte Einträge — Rückgängig stellt sie exakt wieder her (auch „beide an einem Deal“)', () => {
    const nachher = crmUm(crm, 'c-b', 'c-a');
    const s = crmSchnappschuesse(crm, nachher);
    expect(s.map(x => `${x.speicher}:${x.id}`).sort()).toEqual(['crm:chancen:ch-1', 'crm:chancen:ch-2', 'crm:followups:fu-1', 'crm:kampagnen:kp-1']);
    const chancen = s.filter(x => x.speicher === 'crm:chancen');
    expect(schnappschussKonflikte(chancen, nachher.chancen as never)).toEqual([]);
    expect(schnappschuesseAnwenden(nachher.chancen as never, chancen)).toEqual(crm.chancen);
    // Seitdem geändert → Konflikt.
    const spaeter = nachher.chancen.map(c => (c.id === 'ch-1' ? { ...c, notiz: 'neu' } : c));
    expect(schnappschussKonflikte(chancen, spaeter as never).map(x => x.id)).toEqual(['ch-1']);
    // Neu entstanden / weggefallen.
    expect(schnappschuesse('tasks', [{ id: 't1' }], [{ id: 't2' }]).map(x => [x.id, x.vorher === null, x.nachher === null])).toEqual([['t1', false, true], ['t2', true, false]]);
  });

  it('Rückgängig-Gründe: behaltener Eintrag geändert, zweiter wieder da, Verweis geändert — sonst frei', () => {
    const ergebnis = zusammenfuehren(a, b, 'kevin', JETZT);
    const nachher = crmUm(crm, 'c-b', 'c-a');
    const lauf = zusammenLauf({ id: 'imp-1', am: JETZT, person: 'kevin', a, b, ergebnis, verweise: crmSchnappschuesse(crm, nachher) });
    const aktuell = (liste: typeof nachher) => (sp: string) => (liste[sp.slice(4) as 'chancen'] ?? []) as never;
    expect(rueckgaengigGruende(lauf, [ergebnis, k('x')], aktuell(nachher))).toEqual([]);
    expect(rueckgaengigGruende(lauf, [{ ...ergebnis, notiz: 'danach' }], aktuell(nachher))[0]).toMatch(/seit dem Zusammenführen geändert/);
    expect(rueckgaengigGruende(lauf, [ergebnis, b], aktuell(nachher))[0]).toMatch(/wieder/);
    const geaendert = { ...nachher, followups: nachher.followups.map(x => ({ ...x, text: 'anders' })) };
    expect(rueckgaengigGruende(lauf, [ergebnis], aktuell(geaendert))[0]).toMatch(/1 verknüpfter Eintrag \(followups\)/);
    // Art. 17: der Lauf verliert seinen Inhalt und kann nicht mehr zurück.
    const r = laufOhne(lauf, 'c-b');
    expect(r.n).toBe(1);
    expect(r.lauf).toMatchObject({ vorher: [], verfallen: true, zusammen: { verweise: [] } });
    expect(JSON.stringify(r.lauf)).not.toContain('c-b');
    expect(rueckgaengigGruende(r.lauf, [ergebnis], aktuell(nachher))).toHaveLength(1);
    expect(laufOhne(lauf, 'c-zzz').n).toBe(0);
  });

  it('(h) ablehnen statt kürzen; Berliner Tag', () => {
    const lang = 'x'.repeat(PRIVAT_NOTIZ_MAX - 10);
    const pa = { ...a, privatNotiz: lang, privatNotizVon: 'kevin' }, pb = { ...b, privatNotiz: 'noch etwas Längeres', privatNotizVon: 'kevin' };
    expect(zusammenfuehrenPruefen(pa, pb)).toMatch(/länger als 2\.000/);
    expect(zusammenfuehrenPruefen({ ...a, privatNotiz: 'A', privatNotizVon: 'kevin' }, { ...b, privatNotiz: 'B', privatNotizVon: 'malin' })).toMatch(/verschiedenen Personen/);
    expect(zusammenfuehrenPruefen(a, b)).toBeNull();
    // 00:30 Uhr Berliner Zeit am 29.09. = 22:30 UTC am 28.09.
    expect(zusammenfuehren(a, b, 'kevin', '2026-09-28T22:30:00.000Z').geaendertAm).toBe('2026-09-29');
  });
});

describe('(i) Anfragen', () => {
  it('Notiz anhängen: das Neueste bleibt, der älteste Teil fällt markiert weg', () => {
    expect(notizAnhaengen('alt', 'neu')).toEqual({ text: 'alt\nneu', gekuerzt: false });
    const r = notizAnhaengen('a'.repeat(LEAD_NOTIZ_MAX), 'NEUESTE ZEILE');
    expect(r.gekuerzt).toBe(true);
    expect(r.text.length).toBe(LEAD_NOTIZ_MAX);
    expect(r.text.endsWith('NEUESTE ZEILE')).toBe(true);
    expect(r.text.startsWith('[ältere Notiz gekürzt]')).toBe(true);
  });
  const ctx = (kontakte: Kontakt[], sperre?: Parameters<typeof anfrageBauen>[1]['sperre']) => ({ kontakte, crm: leererBestand(), person: 'kevin', heute: HEUTE, jetzt: JETZT, ids: { kontakt: 'c-neu-1', followUp: 'fu-neu-1' }, ...(sperre ? { sperre } : {}) });
  it('Dublette auch über eine weitere Adresse der Person', () => {
    const vorhanden = k('a', { email: 'haupt@example.invalid', emails: [{ adresse: 'haupt@example.invalid', haupt: true }, { adresse: 'zweit@example.invalid' }] });
    const r = anfrageBauen({ neu: { vorname: 'Testa', email: 'Zweit@example.invalid' }, kanal: 'mail', text: 'Bitte um Rückruf' }, ctx([vorhanden]));
    expect(r.ok && r.bau).toMatchObject({ neuePerson: false, kontakt: { id: 'c-a' } });
  });
  it('neue Person auf der Sperrliste: angelegt mit Werbesperre + Hinweis, nicht blockiert', () => {
    const liste = sperrlisteMit([], { email: 'gesperrt@example.invalid', vorname: 'Testo', nachname: 'Gesperrt' }, 'werbesperre', '2026-01-01').eintraege;
    const r = anfrageBauen({ neu: { vorname: 'Testo', nachname: 'Gesperrt', email: 'gesperrt@example.invalid' }, kanal: 'mail', text: 'Frage' }, ctx([], x => neuanlageSperre(x, liste, HEUTE)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bau.neuePerson).toBe(true);
    expect(r.bau.kontakt.werbesperre).toMatchObject({ seit: HEUTE });
    expect(r.bau.hinweis).toBe(SPERR_HINWEIS);
  });
});

describe('Sperrliste bei Neuanlage', () => {
  it('Treffer → Werbesperre mit Grund, sonst unverändert; eine bestehende Sperre bleibt', () => {
    const liste = sperrlisteMit([], { email: 'weg@example.invalid' }, 'loeschung', '2026-02-01').eintraege;
    const r = neuanlageSperre(k('n', { email: 'weg@example.invalid' }), liste, HEUTE);
    expect(r.kontakt.werbesperre).toEqual({ seit: HEUTE, grund: 'Sperrliste: früher gelöscht (Art. 17)' });
    expect(r.hinweis).toBe(SPERR_HINWEIS);
    expect(neuanlageSperre(k('m', { email: 'frei@example.invalid' }), liste, HEUTE)).toEqual({ kontakt: k('m', { email: 'frei@example.invalid' }) });
  });
});

describe('Heute/Power Hour · Deals ohne Person', () => {
  it('über eine Person der Firma angezeigt — ohne jemanden an der Firma gezählt', () => {
    const person = k('p', { firmaId: 'f-acme', firma: 'Acme GmbH', telefon: '+49 30 1234567', stufe: 'gespraech', einwilligungen: [{ kanal: 'telefon', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'x' }], besitzer: 'kevin', letzterKontakt: '2026-09-01' });
    const crm = crmMit({ firmen: [{ id: 'f-acme', name: 'Acme GmbH', rolle: 'zielkunde', geaendert: JETZT }, { id: 'f-leer', name: 'Leer AG', rolle: 'zielkunde', geaendert: JETZT }],
      chancen: [deal('ch-1', { kontaktIds: [], firmaId: 'f-acme', firma: 'Acme GmbH', naechsterSchritt: { text: 'Angebot nachfassen', datum: HEUTE } }), deal('ch-2', { kontaktIds: [], firmaId: 'f-leer', firma: 'Leer AG', naechsterSchritt: { text: 'Anrufen', datum: HEUTE } })] });
    const r = werIstDran([person], crm, HEUTE, 'kevin');
    const karte = r.karten.find(x => x.chance?.id === 'ch-1');
    expect(karte?.kontakt.id).toBe('c-p');
    expect(karte?.gruende.join(' ')).toMatch(/über Acme GmbH/);
    expect(r.ausgefiltert.ohnePerson).toBe(1);
  });
});

describe('Fingerabdruck der Firmen ist der gemeinsame', () => {
  it('firmaAbdruck = fingerabdruck', () => {
    const f = { id: 'f-a', name: 'A' };
    expect(firmaAbdruck(f)).toBe(fingerabdruck(f));
  });
});
