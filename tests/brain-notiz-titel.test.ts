// Brain · Anzeigename einer Notiz (Abnahme 15.10. C19: die Notiz zeigte „Gruendung-Nordlicht-Ventures“). Kopf-Titel → erste Überschrift →
// lesbarer Dateiname; Umlaute nur über sichere Wortstämme, nie geraten.
import { describe, expect, it } from 'vitest';
import { dateinameLesbar, notizAnzeigeTitel } from '@/lib/brain/notiz-titel';

describe('notizAnzeigeTitel', () => {
  it('Titel aus dem Kopf gewinnt (title: bzw. titel:)', () => {
    expect(notizAnzeigeTitel('Gruendung-Nordlicht-Ventures', { title: 'Gründung Nordlicht Ventures' }, '# Anders\n')).toBe('Gründung Nordlicht Ventures');
    expect(notizAnzeigeTitel('x', { titel: '„Plan“ 2027' })).toBe('„Plan“ 2027');
  });
  it('ohne Kopf-Titel die erste Überschrift erster Ebene (ohne Markdown-Zeichen)', () => {
    expect(notizAnzeigeTitel('wochenrhythmus', {}, 'Vorspann\n## Unterpunkt\n# **Unser** Wochenrhythmus #\n')).toBe('Unser Wochenrhythmus');
    expect(notizAnzeigeTitel('a', { title: '   ' }, '# Kopf\n')).toBe('Kopf');
    expect(notizAnzeigeTitel('a', {}, '# Privat_Notiz *neu*\n')).toBe('Privat_Notiz neu');
  });
  it('sonst der Dateiname lesbar — Leerzeichen statt Bindestrich/Unterstrich, Umlaute nur wo sicher', () => {
    expect(notizAnzeigeTitel('Gruendung-Nordlicht-Ventures')).toBe('Gründung Nordlicht Ventures');
    expect(dateinameLesbar('Zoe_Log.md')).toBe('Zoe Log');
    expect(dateinameLesbar('Ueberpruefung-Geschaeftsfuehrung')).toBe('Überprüfung Geschäftsführung');
    expect(dateinameLesbar('Notizen-fuer-den-Rueckblick')).toBe('Notizen für den Rückblick');
    // Mehrdeutige Umschreibungen bleiben (kein Raten).
    for (const w of ['aktuell', 'zuerst', 'Steuer', 'Quelle', 'Michael', 'Poet', 'neue', 'Mauer']) expect(dateinameLesbar(w)).toBe(w);
    expect(dateinameLesbar('Steuerberater-Termine')).toBe('Steuerberater Termine');
  });
});
