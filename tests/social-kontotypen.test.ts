// ─── Social — Kontotypen, Freigaben, Sicht und Ziele (rein) — 27.10.2026 ───────────────────────────────────────────────────────────
// Erfundene Kanäle, Personen (Speichernamen pa/pb) und Zahlen. Geprüft wird:
//   · Personenmarke: nur die Person selbst gibt Formate frei, schaltet Stufe 2 ein, stellt auf „nur ich“ und bestätigt eigene Erlebnisse
//   · Sicht X bekommt nichts aus Y: ein „nur ich“-Kanal fehlt für alle anderen (Lesen) und ist „nicht gefunden“ (Schreiben)
//   · Absender: Privat-Einheit → 400, unbekannte Gesellschaft → 400; Firmenaccount ohne Absender bremst Stufe 2
//   · Folgen-Freigabe: gestempelt vom Server, fällt bei jeder Inhaltsänderung weg; „bereit“ statt „selbst“
//   · Ziele: Startwert vom Server, Linie/Ampel, laufende Ziele, Kontostände; Vorlagen legen Kanal + Formate in einem Schritt an
import { describe, it, expect } from 'vitest';
import { socialAnwenden, socialFuerPerson, socialOhnePerson, socialEintraegeVon, kanalSichtbar, type AnwendenKontext } from '@/lib/social/daten';
import { folgePruefen, kanalPruefen } from '@/lib/social/pruefer';
import { autonomieFuer } from '@/lib/social/autonomie';
import { zielStand, zielIst, tageZwischen } from '@/lib/social/ziele';
import { SOCIAL_VORLAGEN, vorlageVon } from '@/lib/social/vorlagen';
import { lageAus } from '@/lib/social/server';
import { leereSocial, SOCIAL_GRENZEN, KONTO_ARTEN, type SocialDatei, type SocialKanal, type KanalZiel } from '@/lib/social/typen';

let n = 0;
const HEUTE = '2026-10-27';
const ctx = (person = 'pa', extra: Partial<AnwendenKontext> = {}): AnwendenKontext => ({
  person, jetzt: `${HEUTE}T10:00:00.000Z`, heute: HEUTE, personen: ['pa', 'pb'], gesellschaften: ['kdv', 'ug', 'g-beispiel-1'],
  standVon: x => JSON.stringify(x), neueId: p => `${p}-t${++n}`, ...extra,
});
const ok = (d: SocialDatei, ops: unknown[], person = 'pa', extra: Partial<AnwendenKontext> = {}): SocialDatei => {
  const r = socialAnwenden(d, ops, ctx(person, extra));
  if (!r.ok) throw new Error(`${r.status} ${r.fehler}`);
  return r.datei;
};
const nein = (d: SocialDatei, ops: unknown[], person = 'pa') => { const r = socialAnwenden(d, ops, ctx(person)); if (r.ok) throw new Error('hätte abgelehnt werden müssen'); return r; };
const stand = (x: object) => JSON.stringify(x);

const personenmarke = (extra: Record<string, unknown> = {}) => ok(leereSocial(), [{ op: 'kanal', eintrag: { name: 'Marke (Beispiel)', art: 'person', person: 'pa', plattformen: ['linkedin', 'instagram'], ...extra } }]);

describe('Kontotypen', () => {
  it('Art wird gesäubert: Person nur bei Personenmarke, „nur ich“ nur mit Person, faceless ohne Feld', () => {
    const d = ok(leereSocial(), [
      { op: 'kanal', eintrag: { name: 'A', art: 'firma', person: 'pa', sichtbarkeit: 'person', gesellschaft: 'ug' } },
      { op: 'kanal', eintrag: { name: 'B' } },
    ]);
    expect(d.kanaele[0]).toMatchObject({ art: 'firma', gesellschaft: 'ug' });
    expect(d.kanaele[0].person).toBeUndefined();
    expect(d.kanaele[0].sichtbarkeit).toBeUndefined();
    expect(d.kanaele[1].art).toBeUndefined(); // fehlt = faceless (Altbestand bleibt bit-gleich)
    expect(KONTO_ARTEN).toEqual(['faceless', 'person', 'firma']);
  });
  it('Personenmarke nur für eine Person des Haushalts', () => {
    expect(nein(leereSocial(), [{ op: 'kanal', eintrag: { name: 'X', art: 'person', person: 'fremd' } }]).status).toBe(400);
  });
  it('Absender: Privat-Einheit (Selbstständigkeit) → 400, unbekannte Gesellschaft → 400, Register-Gesellschaft geht', () => {
    expect(nein(leereSocial(), [{ op: 'kanal', eintrag: { name: 'X', gesellschaft: 'kdc' } }]).status).toBe(400);
    expect(nein(leereSocial(), [{ op: 'kanal', eintrag: { name: 'X', gesellschaft: 'g-unbekannt-9' } }]).status).toBe(400);
    expect(ok(leereSocial(), [{ op: 'kanal', eintrag: { name: 'X', art: 'firma', gesellschaft: 'g-beispiel-1' } }]).kanaele[0].gesellschaft).toBe('g-beispiel-1');
  });
});

describe('Personenmarke — nur die Person selbst', () => {
  it('Format freigeben: andere 403, die Person selbst ja', () => {
    let d = personenmarke();
    d = ok(d, [{ op: 'format', eintrag: { kanalId: d.kanaele[0].id, name: 'Lektion der Woche', art: 'text' } }]);
    const f = d.formate[0];
    expect(nein(d, [{ op: 'format-freigeben', id: f.id, freigeben: true, stand: stand(f) }], 'pb').status).toBe(403);
    expect(ok(d, [{ op: 'format-freigeben', id: f.id, freigeben: true, stand: stand(f) }], 'pa').formate[0].freigegebenVon).toBe('pa');
  });
  it('Stufe 2: andere 403 (herunterschalten dürfen alle), die Person selbst ja', () => {
    const d = personenmarke();
    const k = d.kanaele[0];
    expect(nein(d, [{ op: 'kanal', eintrag: { id: k.id, leitplanken: { ...k.leitplanken, autonomie: 2 } }, stand: stand(k) }], 'pb').status).toBe(403);
    const zwei = ok(d, [{ op: 'kanal', eintrag: { id: k.id, leitplanken: { ...k.leitplanken, autonomie: 2 } }, stand: stand(k) }], 'pa');
    const k2 = zwei.kanaele[0];
    expect(ok(zwei, [{ op: 'kanal', eintrag: { id: k2.id, leitplanken: { ...k2.leitplanken, autonomie: 0 } }, stand: stand(k2) }], 'pb').kanaele[0].leitplanken.autonomie).toBe(0);
  });
  it('„nur ich“ stellt nur die Person der Marke ein', () => {
    expect(nein(leereSocial(), [{ op: 'kanal', eintrag: { name: 'X', art: 'person', person: 'pa', sichtbarkeit: 'person' } }], 'pb').status).toBe(403);
    expect(personenmarke({ sichtbarkeit: 'person' }).kanaele[0].sichtbarkeit).toBe('person');
  });
  it('Format einer Personenmarke, das nicht sie freigab, trägt keine Stufe 2', () => {
    const d = personenmarke();
    const kanal: SocialKanal = { ...d.kanaele[0], leitplanken: { ...d.kanaele[0].leitplanken, autonomie: 2 } };
    const format = { id: 'sf-x', kanalId: kanal.id, name: 'F', freigegebenAm: 'x', freigegebenVon: 'pb', geaendert: '' };
    const folge = { id: 'sv-x', kanalId: kanal.id, formatId: 'sf-x', titel: 'T', skript: 'Ein Gedanke zum Mitnehmen.', hooks: [{ id: 'hk-1', text: 'Hook' }], quellen: [], kiInhalt: false, status: 'entwurf' as const, veroeffentlicht: [], messungen: [], geaendert: '' };
    const w = autonomieFuer(folge, { kanal, format, befunde: [], heutePosts: 0 });
    expect(w.weg).toBe('stapel');
    expect(autonomieFuer(folge, { kanal, format: { ...format, freigegebenVon: 'pa' }, befunde: [], heutePosts: 0 }).weg).toBe('selbst');
  });
  it('eigenes Erlebnis: Prüfer holt die Person — bis SIE freigibt; eine andere Freigabe klärt es nicht', () => {
    let d = personenmarke();
    d = ok(d, [{ op: 'folge', eintrag: { kanalId: d.kanaele[0].id, titel: 'Woche', skript: 'Letzte Woche habe ich einen Kunden verloren.', hooks: [{ text: 'Ich habe einen Fehler gemacht.' }], status: 'entwurf' } }]);
    const kanal = d.kanaele[0];
    const pruef = (f: typeof d.folgen[0]) => folgePruefen(f, { kanal, andere: d.folgen }).map(b => b.code);
    expect(pruef(d.folgen[0])).toContain('erlebnis');
    const vonB = ok(d, [{ op: 'folge', eintrag: { id: d.folgen[0].id, status: 'freigegeben' }, stand: stand(d.folgen[0]) }], 'pb');
    expect(vonB.folgen[0].freigegebenVon).toBe('pb');
    expect(pruef(vonB.folgen[0])).toContain('erlebnis');
    const lb = lageAus(vonB, HEUTE, 'pb');
    expect(lb.folgen[vonB.folgen[0].id].weg.weg).toBe('stapel');
    const vonA = ok(d, [{ op: 'folge', eintrag: { id: d.folgen[0].id, status: 'freigegeben' }, stand: stand(d.folgen[0]) }], 'pa');
    expect(pruef(vonA.folgen[0])).not.toContain('erlebnis');
    expect(lageAus(vonA, HEUTE, 'pa').folgen[vonA.folgen[0].id].weg.weg).toBe('bereit');
  });
});

describe('Sicht X bekommt nichts aus Y', () => {
  const zwei = () => {
    let d = personenmarke({ sichtbarkeit: 'person' });
    const geheim = d.kanaele[0].id;
    d = ok(d, [
      { op: 'format', eintrag: { kanalId: geheim, name: 'Geheimes Format' } },
      { op: 'folge', eintrag: { kanalId: geheim, titel: 'Geheime Folge', skript: 'x', hooks: [{ text: 'h' }] } },
      { op: 'kanal', eintrag: { name: 'Offen' } },
    ]);
    return { d, geheim };
  };
  it('Lesen: der „nur ich“-Kanal samt Formaten und Folgen fehlt für die andere Person — auch in der Lage', () => {
    const { d, geheim } = zwei();
    const fuerB = socialFuerPerson(d, 'pb');
    expect(fuerB.kanaele.map(k => k.name)).toEqual(['Offen']);
    expect(fuerB.formate).toEqual([]);
    expect(fuerB.folgen).toEqual([]);
    const lage = JSON.stringify(lageAus(d, HEUTE, 'pb'));
    expect(lage).not.toContain(geheim);
    expect(lage).not.toMatch(/Geheim/);
    expect(socialFuerPerson(d, 'pa').kanaele).toHaveLength(2);
    expect(socialFuerPerson(d, null).kanaele.map(k => k.name)).toEqual(['Offen']); // Systemlauf ohne Person sieht ihn auch nicht
  });
  it('Schreiben: jeder Schritt auf den fremden Kanal ist „nicht gefunden“ (404), nichts geändert', () => {
    const { d, geheim } = zwei();
    const k = d.kanaele.find(x => x.id === geheim)!;
    const f = d.formate[0], v = d.folgen[0];
    for (const op of [
      { op: 'kanal', eintrag: { id: geheim, name: 'Übernommen' }, stand: stand(k) },
      { op: 'notaus', id: geheim, posten: true, stand: stand(k) },
      { op: 'kanal-archiv', id: geheim, archiv: true, stand: stand(k) },
      { op: 'format', eintrag: { kanalId: geheim, name: 'Neu' } },
      { op: 'format-freigeben', id: f.id, freigeben: true, stand: stand(f) },
      { op: 'folge', eintrag: { id: v.id, titel: 'Neu' }, stand: stand(v) },
      { op: 'folge', eintrag: { kanalId: geheim, titel: 'Neu' } },
      { op: 'messung', folgeId: v.id, messung: { plattform: 'linkedin', am: HEUTE, views: 1 } },
      { op: 'ziel', kanalId: geheim, eintrag: { metrik: 'posts-woche', zielwert: 3 }, stand: stand(k) },
      { op: 'kontostand', kanalId: geheim, plattform: 'linkedin', am: HEUTE, follower: 5 },
    ]) {
      const r = nein(d, [op], 'pb');
      expect([400, 404]).toContain(r.status);
      expect(r.fehler).not.toMatch(/Geheim|Marke \(Beispiel\)/);
    }
    expect(kanalSichtbar(k, 'pb')).toBe(false);
  });
  it('Konto der Person gelöscht: der Kanal bleibt, ohne Person und ohne „nur ich“ (sonst sähe ihn niemand); Export nennt ihn', () => {
    const { d } = zwei();
    expect(socialEintraegeVon(d, 'pa').some(e => e.art === 'Personenmarke')).toBe(true);
    const { neu } = socialOhnePerson(d, 'pa');
    const k = neu.kanaele.find(x => x.name === 'Marke (Beispiel)')!;
    expect(k.person).toBeUndefined();
    expect(k.sichtbarkeit).toBeUndefined();
    expect(socialFuerPerson(neu, 'pb').kanaele).toHaveLength(2);
  });
});

describe('Folgen-Freigabe', () => {
  it('Status „Freigegeben“ stempelt der Server; Inhalt geändert → Freigabe weg, zurück zu „Entwurf“', () => {
    let d = ok(leereSocial(), [{ op: 'kanal', eintrag: { name: 'K', plattformen: ['tiktok'] } }]);
    d = ok(d, [{ op: 'folge', eintrag: { kanalId: d.kanaele[0].id, titel: 'T', skript: 'Ein Satz.', hooks: [{ text: 'H' }], status: 'freigegeben', freigegebenVon: 'gefaelscht' } }]);
    expect(d.folgen[0]).toMatchObject({ status: 'freigegeben', freigegebenVon: 'pa', freigegebenAm: `${HEUTE}T10:00:00.000Z` });
    const nurStatus = ok(d, [{ op: 'folge', eintrag: { id: d.folgen[0].id, saeule: 'Neu' }, stand: stand(d.folgen[0]) }]);
    expect(nurStatus.folgen[0].freigegebenVon).toBe('pa'); // Säule ist kein Inhalt
    const geaendert = ok(d, [{ op: 'folge', eintrag: { id: d.folgen[0].id, skript: 'Ein anderer Satz.' }, stand: stand(d.folgen[0]) }], 'pb');
    expect(geaendert.folgen[0].freigegebenAm).toBeUndefined();
    expect(geaendert.folgen[0].status).toBe('entwurf');
  });
  it('Personen im Bild ohne Einwilligung und Werbung: eine Person muss ran; die Einwilligung bleibt auch nach Freigabe Pflicht', () => {
    let d = ok(leereSocial(), [{ op: 'kanal', eintrag: { name: 'Firma', art: 'firma', gesellschaft: 'ug', plattformen: ['instagram'] } }]);
    d = ok(d, [{ op: 'folge', eintrag: { kanalId: d.kanaele[0].id, titel: 'Team', skript: 'Unser Team stellt sich vor.', hooks: [{ text: 'H' }], personenImBild: 'offen', werbung: true, status: 'freigegeben' } }]);
    const codes = folgePruefen(d.folgen[0], { kanal: d.kanaele[0], andere: d.folgen }).map(b => b.code);
    expect(codes).toEqual(expect.arrayContaining(['personen', 'werbung']));
    expect(lageAus(d, HEUTE, 'pa').folgen[d.folgen[0].id].weg.weg).toBe('stapel');
  });
  it('Länge prüft der Prüfer nur bei Video', () => {
    const d = ok(leereSocial(), [{ op: 'kanal', eintrag: { name: 'K' } }]);
    const k = d.kanaele[0];
    const f = { id: 'sv-1', kanalId: k.id, titel: 'T', skript: 'kurz', hooks: [{ id: 'hk-1', text: 'h' }], quellen: [], kiInhalt: false, status: 'entwurf' as const, veroeffentlicht: [], messungen: [], geaendert: '' };
    const fmt = { id: 'sf-1', kanalId: k.id, name: 'F', laengeSek: 60, geaendert: '' };
    expect(folgePruefen(f, { kanal: k, format: fmt, andere: [] }).map(b => b.code)).toContain('laenge');
    expect(folgePruefen(f, { kanal: k, format: { ...fmt, art: 'karussell' }, andere: [] }).map(b => b.code)).not.toContain('laenge');
  });
});

describe('Einrichtung des Kanals', () => {
  it('Firmenaccount ohne Absender, Personenmarke ohne Person, KI-Kanal ohne KI-Hinweis in der Bio bremsen Stufe 2', () => {
    const d = ok(leereSocial(), [
      { op: 'kanal', eintrag: { name: 'F', art: 'firma', plattformen: ['linkedin'] } },
      { op: 'kanal', eintrag: { name: 'P', art: 'person', plattformen: ['linkedin'] } },
      { op: 'kanal', eintrag: { name: 'K', kiKanal: true, plattformen: ['tiktok'], marke: { bio: 'Building in public.' } } },
      { op: 'kanal', eintrag: { name: 'K2', kiKanal: true, plattformen: ['tiktok'], gesellschaft: 'ug', marke: { bio: 'An AI building this channel.' } } },
    ]);
    const c = d.kanaele.map(k => kanalPruefen(k).filter(b => b.stufe !== 'hinweis').map(b => b.code));
    expect(c[0]).toContain('ohne-absender');
    expect(c[1]).toContain('ohne-person');
    expect(c[2]).toContain('ki-bio');
    expect(c[3]).toEqual([]);
  });
});

describe('Ziele', () => {
  const kanalMitZahlen = () => {
    let d = ok(leereSocial(), [{ op: 'kanal', eintrag: { name: 'K', plattformen: ['instagram', 'tiktok'] } }]);
    const id = d.kanaele[0].id;
    d = ok(d, [
      { op: 'kontostand', kanalId: id, plattform: 'instagram', am: '2026-10-01', follower: 1000 },
      { op: 'kontostand', kanalId: id, plattform: 'tiktok', am: '2026-10-01', follower: 500 },
    ]);
    return { d, id };
  };
  it('Startwert rechnet der Server (Browser-Wert zählt nicht), ohne Termin → 400, Plattform muss zum Kanal gehören', () => {
    const { d, id } = kanalMitZahlen();
    const k = d.kanaele[0];
    const z = ok(d, [{ op: 'ziel', kanalId: id, eintrag: { metrik: 'follower', zielwert: 3000, von: '2026-10-01', bis: '2026-12-31', startwert: 99999 }, stand: stand(k) }]).kanaele[0].ziele[0];
    expect(z.startwert).toBe(1500);
    expect(nein(d, [{ op: 'ziel', kanalId: id, eintrag: { metrik: 'follower', zielwert: 3000 }, stand: stand(k) }]).status).toBe(400);
    expect(nein(d, [{ op: 'ziel', kanalId: id, eintrag: { metrik: 'posts-woche', zielwert: 3, plattform: 'youtube' }, stand: stand(k) }]).status).toBe(400);
    expect(nein(d, [{ op: 'ziel', kanalId: id, eintrag: { metrik: 'posts-woche', zielwert: 0 }, stand: stand(k) }]).status).toBe(400);
  });
  it('Linie: auf Kurs, knapp, dahinter, erreicht, Termin vorbei — und „ab jetzt je Woche“', () => {
    const { d } = kanalMitZahlen();
    const k = d.kanaele[0];
    const z: KanalZiel = { id: 'sz-1', metrik: 'follower', zielwert: 2500, von: '2026-10-01', bis: '2026-12-10', startwert: 1500 };
    // 70 Tage, am 27.10. sind 26 vergangen → Soll ≈ 1871; Ist 1500 → dahinter
    const s = zielStand(z, k, [], HEUTE);
    expect(tageZwischen('2026-10-01', '2026-12-10')).toBe(70);
    expect(s.soll).toBe(1871);
    expect(s.ampel).toBe('hinter');
    expect(s.jeWoche).toBeGreaterThan(0);
    const mehr: SocialKanal = { ...k, staende: [...k.staende, { id: 'ks-9', plattform: 'instagram', am: '2026-10-26', follower: 1400, quelle: 'hand' }] };
    expect(zielStand(z, mehr, [], HEUTE).ampel).toBe('auf-kurs'); // 1400 + 500 = 1900 ≥ Soll 1871
    expect(zielStand({ ...z, zielwert: 1800 }, mehr, [], HEUTE).ampel).toBe('erreicht');
    expect(zielStand(z, k, [], '2026-12-11').ampel).toBe('verfehlt');
    expect(zielStand({ ...z, plattform: 'youtube' }, k, [], HEUTE).ampel).toBe('ohne-daten');
  });
  it('laufend: Veröffentlichungen je Woche (letzte 4 Wochen) und Median der Haltequote', () => {
    const { d, id } = kanalMitZahlen();
    let e = d;
    const tage = ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'];
    for (const [i, am] of tage.entries()) {
      e = ok(e, [{ op: 'folge', eintrag: { kanalId: id, titel: `F${i}`, skript: `Satz ${i} anders`, hooks: [{ text: 'h' }] } }]);
      const f = e.folgen.at(-1)!;
      e = ok(e, [{ op: 'veroeffentlicht', folgeId: f.id, plattform: 'instagram', am }, { op: 'messung', folgeId: f.id, messung: { plattform: 'instagram', am, views: 1000, halte3s: 40 + i * 10 } }]);
    }
    const k = e.kanaele[0];
    expect(zielIst({ metrik: 'posts-woche', von: '2026-09-01' }, k, e.folgen, HEUTE)).toBe(1);
    expect(zielIst({ metrik: 'halte3s', von: '2026-09-01' }, k, e.folgen, HEUTE)).toBe(55);
    expect(zielIst({ metrik: 'aufrufe', von: '2026-10-13' }, k, e.folgen, HEUTE)).toBe(3000);
    expect(zielStand({ id: 'sz-2', metrik: 'posts-woche', zielwert: 3, von: '2026-09-01', startwert: 0 }, k, e.folgen, HEUTE).ampel).toBe('hinter');
  });
  it('Kontostand: höchstens bis heute, ein Wert je Plattform und Tag (der neue ersetzt den alten)', () => {
    const { d, id } = kanalMitZahlen();
    expect(nein(d, [{ op: 'kontostand', kanalId: id, plattform: 'instagram', am: '2026-10-28', follower: 1 }]).status).toBe(400);
    const e = ok(d, [{ op: 'kontostand', kanalId: id, plattform: 'instagram', am: '2026-10-01', follower: 1100 }]);
    expect(e.kanaele[0].staende.filter(s => s.plattform === 'instagram')).toEqual([expect.objectContaining({ follower: 1100 })]);
    expect(SOCIAL_GRENZEN.ziele).toBeGreaterThan(0);
  });
});

describe('Vorlagen', () => {
  it('jede Vorlage ist gültig: Art bekannt, Formate da, nichts Persönliches, Kennungen eindeutig', () => {
    expect(new Set(SOCIAL_VORLAGEN.map(v => v.id)).size).toBe(SOCIAL_VORLAGEN.length);
    for (const a of KONTO_ARTEN) expect(SOCIAL_VORLAGEN.some(v => v.art === a)).toBe(true);
    for (const v of SOCIAL_VORLAGEN) {
      expect(v.formate.length).toBeGreaterThanOrEqual(3);
      expect(v.plattformen.length).toBeGreaterThan(0);
      expect(JSON.stringify(v)).not.toMatch(/kevin|malin|kemaris|hyrox|fokus innovation|make innovation/i);
    }
  });
  it('legt Kanal, Formate (nie freigegeben) und Ziel-Vorschläge mit Wert in EINEM Schritt an', () => {
    const v = vorlageVon('person-gruendung')!;
    const d = ok(leereSocial(), [{ op: 'vorlage', vorlageId: v.id, eintrag: { name: 'Meine Marke (Beispiel)', person: 'pa', gesellschaft: 'ug', sichtbarkeit: 'person', freigegebenAm: 'x' } }]);
    const k = d.kanaele[0];
    expect(k).toMatchObject({ art: 'person', person: 'pa', sichtbarkeit: 'person', gesellschaft: 'ug', vorlage: v.id, plattformen: v.plattformen });
    expect(d.formate).toHaveLength(v.formate.length);
    expect(d.formate.every(f => !f.freigegebenAm && f.kanalId === k.id)).toBe(true);
    expect(k.ziele.map(z => z.metrik)).toEqual(['posts-woche']); // Follower-Ziele ohne Wert trägt die Instanz selbst ein
    expect(k.leitplanken.autonomie).toBe(1);
    expect(nein(leereSocial(), [{ op: 'vorlage', vorlageId: 'gibt-es-nicht', eintrag: { name: 'X' } }]).status).toBe(404);
    expect(nein(leereSocial(), [{ op: 'vorlage', vorlageId: v.id, eintrag: { name: 'X', person: 'pa', sichtbarkeit: 'person' } }], 'pb').status).toBe(403);
  });
});
