// Ernährung & Einkauf zu zweit (26.09.): Säubern (auch die alte Datei), Kategorien
// raten, Posten parsen, Vorrat/Liste abgleichen, fehlende Zutaten, Warenkorb-Text,
// Änderungen in kleinen Schritten mit Profil-Schutz. Nur erfundene Daten.
import { describe, it, expect } from 'vitest';
import {
  zutatenAusText, schritteAusText, gerichteFiltern, tagsHaeufig, imPlan, gerichtZuName,
  sauberDatei, kategorieRaten, postenParsen, gleichesLebensmittel, fehlendeZutaten, warenkorbText, gruppiert, wendeAn, postenAus, gefuellt, type ErnaehrungFile } from '../lib/ernaehrung/modell';

const J = '2026-09-26T10:00:00.000Z';
const leer = (): ErnaehrungFile => sauberDatei(null, J);

describe('Ernährung · Modell', () => {
  it('säubert die alte Datei (nur Grundsätze, Plan, Posten mit Text) ohne Verlust', () => {
    const alt = { grundsaetze: 'anti-entzündlich', plan: { mo: { fruehstueck: 'Porridge', mittag: '', abend: 'Fisch' } }, einkauf: [{ id: 'e1', text: 'Lachs', erledigt: false }] } as unknown as Partial<ErnaehrungFile>;
    const f = sauberDatei(alt, J);
    expect(f.plan.mo).toEqual({ fruehstueck: 'Porridge', mittag: '', abend: 'Fisch' });
    expect(f.plan.di).toEqual({ fruehstueck: '', mittag: '', abend: '' });
    expect(f.einkauf).toEqual([{ id: 'e1', text: 'Lachs', erledigt: false }]);
    expect(f.profile).toEqual([]); expect(f.vorrat).toEqual([]); expect(f.gerichte).toEqual([]); expect(f.lebensmittel).toEqual([]);
    expect(gefuellt(f)).toBe(2);
  });

  it('rät Kategorien aus dem Namen und parst Mengen', () => {
    expect(kategorieRaten('Tomaten')).toBe('obst-gemuese');
    expect(kategorieRaten('Lachs (Wildlachs TK)')).toBe('tiefkuehl');
    expect(kategorieRaten('Haferflocken')).toBe('vorrat');
    expect(kategorieRaten('Griechischer Joghurt')).toBe('frische');
    expect(kategorieRaten('Spülmittel')).toBe('haushalt');
    expect(kategorieRaten('Dings')).toBe('sonst');
    expect(postenParsen('2x Tomaten')).toEqual({ text: 'Tomaten', menge: '2×' });
    expect(postenParsen('500 g Lachs')).toEqual({ text: 'Lachs', menge: '500 g' });
    expect(postenParsen('Tomaten 2 Stück')).toEqual({ text: 'Tomaten', menge: '2 Stück' });
    expect(postenParsen('Olivenöl')).toEqual({ text: 'Olivenöl' });
  });

  it('erkennt dasselbe Lebensmittel trotz Plural, Klammern und Mengen — aber nicht Tomatenmark als Tomate', () => {
    expect(gleichesLebensmittel('Tomaten', 'Tomate')).toBe(true);
    expect(gleichesLebensmittel('Lachs (TK)', 'Lachs · Wildlachs')).toBe(true);
    expect(gleichesLebensmittel('Haferflocken 500 g', 'Haferflocken')).toBe(true);
    expect(gleichesLebensmittel('Tomatenmark', 'Tomaten')).toBe(false);
    expect(gleichesLebensmittel('Öl', 'Olivenöl')).toBe(false);
  });

  it('fehlende Zutaten: Vorrat und offene Liste zählen, abgehakte nicht', () => {
    const g = { zutaten: [{ name: 'Lachs', menge: '2 Filets' }, { name: 'Brokkoli', menge: '1' }, { name: 'Quinoa', menge: '200 g' }, { name: 'Olivenöl', menge: '' }] };
    const vorrat = [{ id: 'v1', name: 'Quinoa', menge: '1 kg', kategorie: 'vorrat' as const, seit: J, von: 'kevin' }, { id: 'v2', name: 'Olivenöl · Bio', menge: '', kategorie: 'vorrat' as const, seit: J, von: 'kevin' }];
    const einkauf = [{ id: 'e1', text: 'Brokkoli', erledigt: false }, { id: 'e2', text: 'Lachs', erledigt: true }];
    expect(fehlendeZutaten(g, vorrat, einkauf).map(z => z.name)).toEqual(['Lachs']);
  });

  it('Stammliste liefert Hinweis, Kategorie und Standardmenge für einen Posten', () => {
    const stamm = [{ id: 'l1', name: 'Haferflocken', hinweis: 'Bio, grob', kategorie: 'vorrat' as const, menge: '500 g', bevorzugt: true, von: 'kevin' }];
    expect(postenAus('haferflocken', stamm)).toMatchObject({ text: 'Haferflocken · Bio, grob', kategorie: 'vorrat', menge: '500 g', erledigt: false });
    expect(postenAus('Gurke', stamm)).toMatchObject({ text: 'Gurke', kategorie: 'obst-gemuese' });
  });

  it('Warenkorb-Text: je Kategorie ein Block, Menge vor dem Posten, nur Offenes', () => {
    const t = warenkorbText([
      { id: '1', text: 'Tomaten', erledigt: false, menge: '6', kategorie: 'obst-gemuese' },
      { id: '2', text: 'Lachs · Wildlachs TK', erledigt: false, menge: '500 g', kategorie: 'tiefkuehl' },
      { id: '3', text: 'Brot', erledigt: true, kategorie: 'vorrat' },
    ], new Date('2026-09-26T12:00:00Z'));
    expect(t).toContain('2 Posten');
    expect(t).toContain('Obst & Gemüse:\n– 6 Tomaten');
    expect(t).toContain('Tiefkühl:\n– 500 g Lachs · Wildlachs TK');
    expect(t).not.toContain('Brot');
    expect(gruppiert([{ id: '1', text: 'x', erledigt: false }]).map(g => g.kategorie)).toEqual(['sonst']);
  });

  it('Änderungen: Posten, Plan mit Rezept, Abgehaktes in den Vorrat — Profile nur eigene', () => {
    let f = leer();
    let r = wendeAn(f, [
      { liste: 'einkauf', op: 'upsert', eintrag: { text: 'Tomaten', menge: '6', kategorie: 'obst-gemuese' } },
      { liste: 'gerichte', op: 'upsert', eintrag: { id: 'g1', name: 'Lachs mit Ofengemüse', zutaten: [{ name: 'Lachs', menge: '2 Filets' }], zubereitung: ['Ofen auf 200 °C', 'Alles aufs Blech'], dauerMin: 25, portionen: 2 } },
      { feld: 'plan', tag: 'mo', mahlzeit: 'abend', wert: 'Lachs mit Ofengemüse', gerichtId: 'g1' },
      { liste: 'profile', op: 'upsert', eintrag: { name: 'Kevin', bedarf: 'anti-entzündlich', nie: ['Zucker'] } },
      { liste: 'profile', op: 'upsert', eintrag: { person: 'malin', name: 'Malin', bedarf: 'x' } },
      { liste: 'profile', op: 'upsert', eintrag: { person: 'gast-oma', name: 'Oma', bedarf: 'weich', konto: false } },
    ], 'kevin', J);
    f = r.datei;
    expect(r.abgelehnt).toEqual(['profile:fremd']);
    expect(f.einkauf[0]).toMatchObject({ text: 'Tomaten', menge: '6', von: 'kevin' });
    expect(f.gerichte[0]).toMatchObject({ id: 'g1', portionen: 2, dauerMin: 25, quelle: 'jarvis' });
    expect(f.plan.mo.abend).toBe('Lachs mit Ofengemüse');
    expect(f.planGerichte.mo?.abend).toBe('g1');
    expect(f.profile.map(p => [p.person, p.konto])).toEqual([['kevin', true], ['gast-oma', false]]);
    // Malin pflegt ihr eigenes; den Gast darf auch sie ändern
    r = wendeAn(f, [{ liste: 'profile', op: 'upsert', eintrag: { name: 'Malin', bedarf: 'viel Gemüse' } }, { liste: 'profile', op: 'upsert', eintrag: { person: 'gast-oma', bedarf: 'weich, wenig Salz' } }], 'malin', J);
    expect(r.abgelehnt).toEqual([]);
    expect(r.datei.profile.find(p => p.person === 'malin')).toMatchObject({ bedarf: 'viel Gemüse', konto: true });
    expect(r.datei.profile.find(p => p.person === 'gast-oma')?.bedarf).toBe('weich, wenig Salz');
    // Abgehaktes wandert in den Vorrat (einmal), Liste wird leer
    f = r.datei;
    f = wendeAn(f, [{ liste: 'einkauf', op: 'upsert', eintrag: { id: f.einkauf[0].id, erledigt: true } }], 'malin', J).datei;
    f = wendeAn(f, [{ feld: 'erledigtInVorrat', von: 'malin' }], 'malin', J).datei;
    expect(f.einkauf).toEqual([]);
    expect(f.vorrat).toHaveLength(1);
    expect(f.vorrat[0]).toMatchObject({ name: 'Tomaten', menge: '6', kategorie: 'obst-gemuese', von: 'malin' });
    // Plan-Feld leeren löst das Rezept
    f = wendeAn(f, [{ feld: 'plan', tag: 'mo', mahlzeit: 'abend', wert: '' }], 'kevin', J).datei;
    expect(f.planGerichte.mo?.abend).toBeUndefined();
  });

  it('Gerichte-Bibliothek: Favorit & Notiz, Freitext-Zutaten, Suche, Wo-im-Plan, Löschen', () => {
    let f = leer();
    f = wendeAn(f, [
      { liste: 'gerichte', op: 'upsert', eintrag: { id: 'g1', name: 'Lachs mit Ofengemüse', zutaten: [{ name: 'Lachs', menge: '2 Filets' }, { name: 'Zucchini', menge: '1' }], zubereitung: ['Ofen an'], tags: ['schnell', 'abends'], quelle: 'hand' } },
      { liste: 'gerichte', op: 'upsert', eintrag: { id: 'g2', name: 'Porridge', zutaten: [{ name: 'Haferflocken', menge: '80 g' }], zubereitung: ['Kochen'], tags: ['schnell', 'früh'], angelegt: '2026-09-20T06:00:00.000Z' } },
      { feld: 'plan', tag: 'di', mahlzeit: 'abend', wert: 'Lachs mit Ofengemüse', gerichtId: 'g1' },
      { feld: 'plan', tag: 'fr', mahlzeit: 'abend', wert: 'Lachs mit Ofengemüse', gerichtId: 'g1' },
    ], 'kevin', J).datei;
    expect(f.gerichte.map(g => [g.id, g.favorit, g.notiz, g.quelle])).toEqual([['g1', false, '', 'hand'], ['g2', false, '', 'jarvis']]);
    // Stern und Notiz ändern nur das Feld — Zutaten bleiben
    f = wendeAn(f, [{ liste: 'gerichte', op: 'upsert', eintrag: { id: 'g2', favorit: true } }, { liste: 'gerichte', op: 'upsert', eintrag: { id: 'g1', notiz: 'Malin ohne Feta' } }], 'malin', J).datei;
    expect(f.gerichte.find(g => g.id === 'g2')).toMatchObject({ favorit: true, zutaten: [{ name: 'Haferflocken', menge: '80 g' }] });
    expect(f.gerichte.find(g => g.id === 'g1')?.notiz).toBe('Malin ohne Feta');
    // Ordnung: Liebling zuerst, dann das Neueste; Suche über Zutaten; Tag-Filter
    expect(gerichteFiltern(f.gerichte).map(g => g.id)).toEqual(['g2', 'g1']);
    expect(gerichteFiltern(f.gerichte, 'zucchini').map(g => g.id)).toEqual(['g1']);
    expect(gerichteFiltern(f.gerichte, '', 'früh').map(g => g.id)).toEqual(['g2']);
    expect(tagsHaeufig(f.gerichte)).toEqual(['schnell', 'abends', 'früh']);
    expect(imPlan(f.planGerichte, 'g1')).toEqual([{ tag: 'di', mahlzeit: 'abend' }, { tag: 'fr', mahlzeit: 'abend' }]);
    expect(gerichtZuName(f.gerichte, 'porridge')?.id).toBe('g2');
    expect(gerichtZuName(f.gerichte, 'Pizza')).toBeUndefined();
    // Freitext für die Hand-Eingabe
    expect(zutatenAusText('200 g Lachs\nZitrone\nSalz: 1 Prise\nOlivenöl – 2 EL')).toEqual([
      { name: 'Lachs', menge: '200 g' }, { name: 'Zitrone', menge: '' }, { name: 'Salz', menge: '1 Prise' }, { name: 'Olivenöl', menge: '2 EL' },
    ]);
    expect(schritteAusText('1. Ofen an\n2) Fisch würzen\n- 20 Min backen\n\n')).toEqual(['Ofen an', 'Fisch würzen', '20 Min backen']);
    // Löschen nimmt das Gericht aus der Bibliothek; der Plan-Text bleibt, das Feld zeigt kein Rezept mehr
    f = wendeAn(f, [{ liste: 'gerichte', op: 'delete', id: 'g1' }], 'kevin', J).datei;
    expect(f.gerichte.map(g => g.id)).toEqual(['g2']);
    expect(f.plan.di.abend).toBe('Lachs mit Ofengemüse');
    expect(imPlan(f.planGerichte, 'g1')).toHaveLength(2);
  });
});
