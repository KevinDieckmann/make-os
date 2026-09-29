// ─── Restpunkte 29.09. (nach der Kalender-Schlussprüfung) — die reinen Regeln ─────────────────────────────────────
//   a) Glocke „Termin entfernen?“: Bezug `buchung-termin`, Regel „Termin gelöst“ in `buchungenErledigen` (Route-Test:
//      tests/kalender-f1-freigabe.test.ts „Restpunkte“).
//   b) „Termin entfernen“ erledigt „Termin vorbereiten“ an diesem Termin (`vorbereitenErledigen`).
//   c) Datum mit Jahreszahl nur außerhalb des laufenden Jahres — eine Regel (`tagKurz`) für Aufgaben-Modus, Agenda,
//      Glocke und Heute.
//   d) „Termin vorschlagen“ im Angebot ohne Titel: Nummer/Kunde statt „Angebot besprechen: Angebot“.
import { describe, it, expect } from 'vitest';
import { tagKurz, anderesJahr } from '@/lib/zeit/kalender-kern';
import { buchungenErledigen, pruefeEingabe, leererBestand, faelligAbleiten, anstehendAbleiten, type Meldung } from '@/lib/meldungen/regeln';
import { vorbereitenErledigen, VORBEREITEN_ERLEDIGT_NOTIZ } from '@/lib/kalender/buchung';
import type { FollowUp } from '@/lib/crm/typen';
import { angebotTerminTitel, vorgabeAusFreierZeit } from '../components/os/crm/angebot/TerminVorschlag';

const HEUTE = '2026-09-29';

describe('a) Glocke „Termin entfernen?“ — Regel „Termin gelöst“', () => {
  const m = (id: string, bezug?: Meldung['bezug']): Meldung => ({ id, art: 'buchung', titel: id, link: '/os/kalender', am: '2026-09-29T08:00:00Z', ...(bezug ? { bezug } : {}) });
  it('Bezug `buchung-termin` ist gültig; eine erfundene Art nicht', () => {
    expect(pruefeEingabe({ an: 'kevin', art: 'buchung', titel: 'Termin entfernen?', link: '/os/kalender?buchungen=1', bezug: { art: 'buchung-termin', id: 'bu-1' } })).toEqual({ ok: true });
    expect(pruefeEingabe({ an: 'kevin', art: 'buchung', titel: 'x', link: '/os/kalender', bezug: { art: 'termin' as never, id: 'bu-1' } }).ok).toBe(false);
  });
  it('erledigt, sobald die Buchung nicht mehr „mit Termin“ ist; die Anfrage-Regel bleibt unberührt', () => {
    const b = { ...leererBestand(), eintraege: [
      m('steht', { art: 'buchung-termin', id: 'bu-a' }),
      m('geloest', { art: 'buchung-termin', id: 'bu-b' }),
      m('anfrage-offen', { art: 'buchung', id: 'bu-b' }),
      m('ohne-bezug'),
    ] };
    const e = buchungenErledigen(b, { offen: new Set(['bu-b']), mitTermin: new Set(['bu-a']) });
    expect(e.eintraege.map(x => [x.id, !!x.gelesen])).toEqual([['steht', false], ['geloest', true], ['anfrage-offen', false], ['ohne-bezug', false]]);
    expect(buchungenErledigen(b, null)).toBe(b);
  });
});

describe('b) „Termin entfernen“ erledigt „Termin vorbereiten“', () => {
  const fu = (x: Partial<FollowUp>): FollowUp => ({ id: 'fu-1', bezug: { art: 'kontakt', id: 'c-a' }, kontaktId: 'c-a', art: 'termin', text: 'Termin vorbereiten — „Erstgespräch“', faellig: '2026-10-05', zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: HEUTE, geaendert: HEUTE, ...x });
  it('nur offene „Termin vorbereiten“ an DIESEM Termin — erledigt mit Notiz, nichts gelöscht', () => {
    const liste = [
      fu({ id: 'fu-vorb', terminUid: 'kal|U-1', notiz: 'Anliegen: Test' }),
      fu({ id: 'fu-anderer', terminUid: 'kal|U-2' }),
      fu({ id: 'fu-ohne' }),
      fu({ id: 'fu-mail', art: 'mail', text: 'Nachfassen', terminUid: 'kal|U-1' }),
      fu({ id: 'fu-schon', terminUid: 'kal|U-1', status: 'erledigt' }),
    ];
    const r = vorbereitenErledigen(liste, { terminUid: 'kal|U-1', vorbereitenId: 'fu-vorb' }, 'kevin', '2026-09-29T10:00:00Z');
    expect(r.followups).toHaveLength(liste.length);
    expect(r.erledigt.map(f => f.id)).toEqual(['fu-vorb']);
    expect(r.followups.find(f => f.id === 'fu-vorb')).toMatchObject({ status: 'erledigt', erledigtAm: '2026-09-29T10:00:00Z', notiz: `Anliegen: Test\n${VORBEREITEN_ERLEDIGT_NOTIZ}`, geaendertVon: 'kevin' });
    expect(r.followups.find(f => f.id === 'fu-anderer')!.status).toBe('offen');
    expect(r.followups.find(f => f.id === 'fu-mail')!.status).toBe('offen'); // kein „Termin vorbereiten“
  });
  it('alter Verweis (nur UID) trifft auch; nichts passend → dieselbe Liste', () => {
    const liste = [fu({ id: 'fu-x', terminUid: 'U-9' })];
    expect(vorbereitenErledigen(liste, { terminUid: 'kal|U-9' }, 'malin', 'j').erledigt).toHaveLength(1);
    const leer = [fu({ id: 'fu-y', terminUid: 'kal|U-8' })];
    expect(vorbereitenErledigen(leer, { terminUid: 'kal|U-9' }, 'malin', 'j').followups).toBe(leer);
  });
});

describe('c) Jahreszahl nur außerhalb des laufenden Jahres — eine Regel', () => {
  it('tagKurz / anderesJahr', () => {
    expect(tagKurz('2026-09-25', HEUTE)).toBe('25.09.');
    expect(tagKurz('2027-09-25', HEUTE)).toBe('25.09.2027');
    expect(tagKurz('2025-12-31', HEUTE)).toBe('31.12.2025');
    expect(tagKurz('2027-01-05', HEUTE, { ohneNull: true })).toBe('5.1.2027');
    expect(tagKurz('2026-01-05', HEUTE, { ohneNull: true })).toBe('5.1.');
    expect(tagKurz('kaputt', HEUTE)).toBe('');
    expect(anderesJahr('2027-01-01', HEUTE)).toBe(true);
    expect(anderesJahr('2026-12-31', HEUTE)).toBe(false);
  });
  it('Glocke: überfällig aus dem Vorjahr und Frist im nächsten Jahr mit Jahreszahl', () => {
    const heute = '2027-01-04';
    const r = faelligAbleiten([{ id: 'a1', title: 'Belege', assignee: 'kevin', dueDate: '2026-12-28', status: 'todo' }], { person: 'kevin', heute, am: 'x', link: id => `/os/aufgaben?offen=${id}`, tagVonIso: i => i.slice(0, 10) });
    expect(r[0].titel).toBe('„Belege“ ist überfällig — fällig seit 28.12.2026');
    const f = anstehendAbleiten({ termine: [], nachbereiten: [], fristen: [{ id: 'f1', titel: 'Kündigung', tag: '2027-01-20', href: '/os/finanzen', inTagen: 16 }], followups: [] }, { heute: '2027-01-04', jetztWand: '2027-01-04T08:00', am: 'x' });
    expect(f[0].titel).toBe('In 16 Tagen (20.01.): Kündigung');
    const g = anstehendAbleiten({ termine: [], nachbereiten: [], fristen: [{ id: 'f2', titel: 'Kündigung', tag: '2027-01-10', href: '/os/finanzen', inTagen: 12 }], followups: [] }, { heute: '2026-12-29', jetztWand: '2026-12-29T08:00', am: 'x' });
    expect(g[0].titel).toBe('In 12 Tagen (10.01.2027): Kündigung');
  });
});

describe('d) Angebot → Termin-Entwurf ohne Titel', () => {
  it('Titel vor Nummer/Kunde; ohne alles nur „Angebot besprechen“', () => {
    expect(angebotTerminTitel({ titel: 'Retainer', nummer: 'KDC-2026-004', kunde: 'Probe GmbH' })).toBe('Angebot besprechen: Retainer');
    expect(angebotTerminTitel({ titel: '  ', nummer: 'KDC-2026-004', kunde: 'Probe GmbH' })).toBe('Angebot besprechen: KDC-2026-004 · Probe GmbH');
    expect(angebotTerminTitel({ titel: '', kunde: 'Probe GmbH' })).toBe('Angebot besprechen: Probe GmbH');
    expect(angebotTerminTitel({ titel: '' })).toBe('Angebot besprechen');
    expect(vorgabeAusFreierZeit({ start: '2026-10-01T10:00:00', ende: '2026-10-01T10:45:00', tag: '2026-10-01' }, { titel: '', kunde: 'Probe GmbH', kontaktId: 'c-a' }).titel).toBe('Angebot besprechen: Probe GmbH');
  });
});
