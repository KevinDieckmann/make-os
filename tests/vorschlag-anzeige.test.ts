// Freigaben (Abnahme 14.10., B10): jeder Eintrag zeigt Titel · Was · Wofür · Bezug — nie nur „Einzelheiten in der Inbox“, nie leer.
// Rein, erfundene Daten (@example.invalid).
import { describe, it, expect } from 'vitest';
import { vorschlagAnzeige } from '@/lib/zoe/vorschlag-anzeige';

describe('vorschlagAnzeige', () => {
  it('Inbox-Vorschlag: Titel = vorbereitete Aufgabe (Betreff), Was = anlegen + fällig, Wofür = Absender + Erkanntes, Link ins Gespräch', () => {
    const a = vorschlagAnzeige({
      titel: 'Aufgabe aus der Inbox — Frist 15.10.', nachher: 'Aufgabe aus einer Nachricht · fällig 15.10. — Einzelheiten in der Inbox',
      anlass: 'In der Nachricht steht eine Frist („bis 15.10.“).', quelle: 'lauf', bezug: { art: 'inbox', id: 'm-1' },
      eingabe: { gespraech: 'gm~abc', space: 'business', aufgabe: { title: 'Vertragsentwurf', description: 'Aus der Inbox · Anna Beispiel <anna@example.invalid>\n/os/inbox?offen=gm~abc', dueDate: '2026-10-15', space: 'business' } },
    });
    expect(a.titel).toBe('Vertragsentwurf');
    expect(a.was).toBe('Legt die Aufgabe an · fällig 15.10. — mit Link zurück ins Gespräch.');
    expect(a.wofuer).toBe('Mail von Anna Beispiel — In der Nachricht steht eine Frist („bis 15.10.“).');
    expect(a.wofuer).not.toContain('@');
    expect(a.link).toEqual({ href: '/os/inbox?offen=gm~abc', text: 'Zum Gespräch' });
    expect(JSON.stringify(a)).not.toContain('Einzelheiten in der Inbox');
  });
  it('Leerer Alt-Eintrag: lesbar beschriftet, nie leer; Bereich als Ort', () => {
    const a = vorschlagAnzeige({ titel: '', nachher: '', werkzeug: 'create_task', gruppe: 'aufgaben' });
    expect(a.leer).toBe(true);
    expect(a.titel).toBe('Älterer Vorschlag ohne Beschreibung (create task)');
    expect(a.was).toContain('nicht gespeichert');
    expect(a.wofuer).toBe('ZOE hat keinen Grund genannt.');
    expect(a.link).toEqual({ href: '/os/aufgaben', text: 'Zu Aufgaben' });
  });
  it('Allgemein: Was aus vorher → nachher, Wofür mit Herkunft (anlassText), Bezug Aufgabe → Aufgabe', () => {
    const a = vorschlagAnzeige({ titel: 'Status ändern', vorher: 'offen', nachher: 'in Arbeit', anlass: 'Lücke am Dienstag', quelle: 'lauf', bezug: { art: 'aufgabe', id: 't-1' } });
    expect(a).toMatchObject({ titel: 'Status ändern', was: 'offen → in Arbeit', wofuer: 'ZOE: Lücke am Dienstag', link: { text: 'Zur Aufgabe' } });
    expect(a.link!.href).toContain('t-1');
    // ohne Grund und ohne Bezug: nichts Leeres, Bereich der Gruppe
    const b = vorschlagAnzeige({ titel: 'Aufgabe anlegen', nachher: '„Angebot nachfassen“', gruppe: 'inbox' });
    expect(b).toMatchObject({ titel: 'Aufgabe anlegen', was: '„Angebot nachfassen“', wofuer: 'ZOE hat keinen Grund genannt.', link: { href: '/os/inbox', text: 'Zu Postfach' } });
  });
});
