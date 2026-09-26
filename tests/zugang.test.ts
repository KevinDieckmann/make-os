// ─── Zugang: Konten, Sitzungen, Passwörter ──────────────────────────────────
// Das hier ist die Tür. Jeder Test schützt einen Weg, auf dem jemand hinein
// käme, der nicht hinein soll — oder einen, auf dem Kevin ausgesperrt bliebe.

import { describe, it, expect } from 'vitest';
import { speicherName, emailSauber, passwortTauglich, neuerEinladungscode, passwortHashen, passwortStimmt } from '../lib/zugang/konten';
import { sitzungAusstellen, sitzungPruefen, kontoStand } from '../lib/zugang/sitzung';

describe('Speichername', () => {
  it('macht aus Kevin „kevin" und aus Malin „malin" — damit die alten Dateien passen', () => {
    expect(speicherName('Kevin Dieckmann', [])).toBe('kevin');
    expect(speicherName('Malin', ['kevin'])).toBe('malin');
  });

  it('ersetzt Umlaute und hängt bei Dopplung eine Zahl an', () => {
    expect(speicherName('Jörg', [])).toBe('joerg');
    expect(speicherName('Jörg', ['joerg'])).toBe('joerg2');
  });

  it('gibt nie einen leeren Namen zurück', () => {
    expect(speicherName('!!!', [])).toBe('person');
  });
});

describe('Eingaben', () => {
  it('nimmt nur echte E-Mails, klein geschrieben', () => {
    expect(emailSauber(' K.Dieckmann@Beispiel.DE ')).toBe('k.dieckmann@beispiel.de');
    expect(emailSauber('kein-at')).toBeNull();
  });

  it('verlangt beim Passwort Länge, keine Sonderzeichenregeln', () => {
    expect(passwortTauglich('kurz')).toBe(false);
    expect(passwortTauglich('zehn zeichen lang')).toBe(true);
  });

  it('erzeugt Einladungscodes ohne verwechselbare Zeichen', () => {
    for (let i = 0; i < 40; i++) expect(neuerEinladungscode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });
});

describe('Passwort', () => {
  it('erkennt das richtige und lehnt das falsche ab', async () => {
    const k = await passwortHashen('TESTPASSWORT-nur-fuer-den-test');
    expect(await passwortStimmt('TESTPASSWORT-nur-fuer-den-test', k)).toBe(true);
    expect(await passwortStimmt('TESTPASSWORT-nur-fuer-den-tesT', k)).toBe(false);
  });

  it('hasht dasselbe Passwort zweimal verschieden (Salz)', async () => {
    const a = await passwortHashen('gleiches passwort');
    const b = await passwortHashen('gleiches passwort');
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('Sitzung', () => {
  const G = 'TESTGEHEIMNIS-nicht-echt';
  const ST = 'abcdef012345';

  it('stellt einen Zettel aus, den nur dasselbe Geheimnis prüft', async () => {
    const z = await sitzungAusstellen(G, 'kevin', ST, 1_000_000, 'abcdefabcdef');
    expect(await sitzungPruefen(G, z, 1_000_000)).toMatchObject({ speicher: 'kevin', stand: ST, sid: 'abcdefabcdef', ausgestellt: 1_000_000 });
    expect(await sitzungPruefen('anderes', z)).toBeNull();
  });

  it('lehnt einen veränderten Zettel ab', async () => {
    const z = await sitzungAusstellen(G, 'kevin', ST);
    expect(await sitzungPruefen(G, z.replace('kevin', 'malin'))).toBeNull();
    expect(await sitzungPruefen(G, z.replace(ST, 'abcdef012346'))).toBeNull();
    // Letztes Zeichen wirklich ändern — endet die Signatur zufällig auf 0,
    // wäre „+ '0'" keine Veränderung (Zufallsfehler vom 23.09.).
    expect(await sitzungPruefen(G, z.slice(0, -1) + (z.endsWith('0') ? '1' : '0'))).toBeNull();
  });

  it('lässt Zettel ablaufen', async () => {
    const z = await sitzungAusstellen(G, 'kevin', ST, Date.now() - 40 * 864e5);
    expect(await sitzungPruefen(G, z)).toBeNull();
  });

  it('nimmt keinen Speichernamen mit fremden Zeichen', async () => {
    const z = await sitzungAusstellen(G, '../etc', ST);
    expect(await sitzungPruefen(G, z)).toBeNull();
  });

  it('Zettel ohne Passwort-Stand (vor 26.09.) gelten nicht mehr; der Stand folgt dem Salz', async () => {
    const alt = `kevin.${Date.now() + 864e5}.` ;
    expect(await sitzungPruefen(G, `${alt}deadbeef`)).toBeNull();
    expect(await sitzungPruefen(G, `${alt}${ST}.deadbeef`)).toBeNull();
    const a = await kontoStand('salz-1'), b = await kontoStand('salz-2');
    expect(a).toMatch(/^[a-f0-9]{12}$/);
    expect(a).not.toBe(b);
    expect(await kontoStand('salz-1')).toBe(a);
  });
});
