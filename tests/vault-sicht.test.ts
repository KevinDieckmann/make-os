// ─── Wer im Obsidian-Brain was sieht ────────────────────────────────────────
// Die Regeln des Vaults (00. Fundament/Vertraulichkeitsregeln.md): „Agenten bekommen nie privat." Und AGENTS.md: Notizen ohne
// Kennzeichnung gelten mindestens als intern. Dieser Test hält fest, dass die Software genau das tut — und dass eine Notiz ihren
// gültigen Stand oben trägt.
//
// Seit 09.10. (Plattform-Regel, PRIVATE_INHALTE_SUCHE.md Paket 5 „Vault- und Brain-Sicht“) kommen die Personen aus den KONTEN
// der Instanz (`vaultPersonenAus` → `sichtAus` → `darfSehen`), nie aus festen Namen. Geprüft wird:
//   (a) eine Kundeninstanz mit anderen Speichernamen: die Inhaberin sieht ihre `intern`-Notizen, die zweite Person nie das
//       `privat` der ersten (und umgekehrt), die Ordner der zweiten Person werden nicht geöffnet;
//   (b) Altbestand: mit den gewachsenen Speichernamen als Konten liefert die neue Sicht GENAU dasselbe wie der alte Code
//       (Gold-Vergleich gegen die wörtlich kopierten Funktionen in tests/fixtures/vault-sicht-alt.ts);
//   (c) ein Systemlauf ohne Person sieht nie `privat` — auch nicht das des Vault-Eigentümers.
// Erfundene Notizen und Konten; eigener Datenordner und Test-Vault, nie der echte; kein Index, keine Embeddings, kein Netz.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  AGENT_ALT, darfSehenAlt, istPrivatAlt, anhaengenErlaubtAlt, vertrAlt, darfVorschlagSehenAlt, annehmenZielAlt, vorschlagGiltAlt,
  giltAlt, regelOwnerAlt, regelPasstAlt,
} from './fixtures/vault-sicht-alt';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-vault-sicht-'));
const VAULT = path.join(wurzel, 'Vault', 'Brain');
process.env.MAKE_OS_DATEN_DIR = path.join(wurzel, 'daten');
process.env.MAKE_VAULT_DIR = VAULT;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const V = await import('../lib/zoe/vault');
const { darfSehen, sichtAus, vaultPersonenAus, ordnerRegel, istPrivat, anhaengenErlaubt, leseKopf, obersterBlock, bereichVon, gekuerzt, AGENT } = V;
const I = await import('../lib/brain/inbox');
const R = await import('../lib/brain/regeln');
const K = await import('../lib/brain/konsolidierung');
afterAll(() => fs.rm(wurzel, { recursive: true, force: true }));

type Rolle = 'inhaber' | 'mitglied';
const konto = (speicher: string, name: string, rolle: Rolle, haushalt?: string, extra: Record<string, unknown> = {}) =>
  ({ id: `k-${speicher}`, speicher, email: `${speicher}@example.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] as string[] }, ...(haushalt ? { haushalt } : {}), ...extra });

// Der gewachsene Stand: die beiden Speichernamen als Konten (Erstkonto = Haupt-Inhaber), ein „nur Business“-Partner im selben
// Haushalt, ein Konto in einem anderen Haushalt. Die Speichernamen sind Kennungen des Altbestands — keine Daten.
const ALT_KONTEN = { konten: [konto('kevin', 'Kevin Probe', 'inhaber', 'h-alt'), konto('malin', 'Malin Probe', 'mitglied', 'h-alt'), konto('partner', 'Partner Probe', 'mitglied', 'h-alt', { finanzRecht: 'business' }), konto('testmitglied', 'Test Probe', 'mitglied', 'test')] };
// Dieselben Konten, die zweite Person als gleichwertige zweite Inhaberin (R9) — der Haupt-Inhaber bleibt das Erstkonto.
const ALT_KONTEN_R9 = { konten: ALT_KONTEN.konten.map(k => (k.speicher === 'malin' ? { ...k, rolle: 'inhaber' as const } : k)), einstellungen: { hauptInhaber: 'kevin' } };
// Eine Kundeninstanz mit ganz anderen Speichernamen.
const KUNDE = { konten: [konto('pia', 'Pia Probe', 'inhaber', 'h-kunde'), konto('olaf', 'Olaf Probe', 'mitglied', 'h-kunde'), konto('gast', 'Gast Probe', 'mitglied', 'anders')] };

const ALT = vaultPersonenAus(ALT_KONTEN);
const KD = vaultPersonenAus(KUNDE);
const s = (person: string, p = ALT, agent = false) => sichtAus(agent ? { person, agent } : { person }, p);

describe('Personen der Vault-Sicht aus den Konten', () => {
  it('Eigentümer = Haupt-Inhaber; Haushalt = volle Mitglieder (ohne „nur Business“, ohne fremden Haushalt); Namen = Vorname aus dem Konto', () => {
    expect(ALT).toEqual({ eigentuemer: 'kevin', haushalt: ['kevin', 'malin'], namen: { kevin: 'Kevin', malin: 'Malin' } });
    expect(KD).toEqual({ eigentuemer: 'pia', haushalt: ['pia', 'olaf'], namen: { pia: 'Pia', olaf: 'Olaf' } });
    expect(vaultPersonenAus({ konten: [] })).toEqual({ eigentuemer: null, haushalt: [], namen: {} });
  });
  it('ungültige Person = keine Person; aufgelöste Sicht trägt Haushalt und Eigentümer', () => {
    expect(s('Kevin ')).toEqual({ person: '', haushalt: false, eigentuemer: 'kevin' });
    expect(s('olaf', KD)).toEqual({ person: 'olaf', haushalt: true, eigentuemer: 'pia' });
    expect(sichtAus(AGENT, KD)).toEqual({ person: '', agent: true, haushalt: true, eigentuemer: 'pia' });
  });
});

describe('(a) Kundeninstanz mit anderen Speichernamen', () => {
  it('die Inhaberin sieht ihre internen Notizen (und Notizen ohne Kennzeichnung); die zweite Person auch', () => {
    expect(darfSehen({ scope: 'intern', owner: 'pia' }, s('pia', KD))).toBe(true);
    expect(darfSehen({}, s('pia', KD))).toBe(true);
    expect(darfSehen({ scope: 'intern' }, s('olaf', KD))).toBe(true);
    expect(darfSehen({ scope: 'team' }, s('olaf', KD))).toBe(true);
  });
  it('privat ist symmetrisch: niemand sieht das private der anderen Person — ohne owner gehört es der Inhaberin', () => {
    expect(darfSehen({ scope: 'privat', owner: 'pia' }, s('olaf', KD))).toBe(false);
    expect(darfSehen({ scope: 'privat', owner: 'olaf' }, s('pia', KD))).toBe(false);
    expect(darfSehen({ scope: 'privat', owner: 'olaf' }, s('olaf', KD))).toBe(true);
    expect(darfSehen({ scope: 'privat' }, s('pia', KD))).toBe(true);
    expect(darfSehen({ scope: 'privat' }, s('olaf', KD))).toBe(false);
  });
  it('ein Konto außerhalb des Haushalts sieht nur Familie und Öffentliches; die festen Namen des Altbestands öffnen hier nichts', () => {
    for (const p of ['gast', 'kevin', 'malin', 'unbekannt']) {
      expect(darfSehen({ scope: 'intern' }, s(p, KD)), p).toBe(false);
      expect(darfSehen({}, s(p, KD)), p).toBe(false);
      expect(darfSehen({ scope: 'familie' }, s(p, KD)), p).toBe(true);
      expect(darfSehen({ scope: 'oeffentlich' }, s(p, KD)), p).toBe(true);
    }
    expect(darfSehen({ scope: 'privat' }, s('kevin', KD))).toBe(false); // ohne owner gehört es der Inhaberin dieser Instanz
  });
  it('Ordner-Regel: die Ordner der zweiten Person bleiben zu, gemeinsame mit der Inhaberin sind offen', () => {
    const regel = ordnerRegel(KD);
    expect(regel).toEqual({ eigentuemer: ['pia'], andere: ['olaf'] });
    for (const o of ['02. Olaf', 'Olaf', 'olaf-notizen', 'Ziele Olaf']) expect(istPrivat(o, regel), o).toBe(true);
    for (const o of ['Olaf & Pia', 'Olaf_Pia_Brain', '01 Start', 'Pia', 'Malin']) expect(istPrivat(o, regel), o).toBe(false);
    // Kurze Namen nur als ganzes Wort (sonst fiele „Projekte“ unter „jo“).
    const kurz = ordnerRegel(vaultPersonenAus({ konten: [konto('pia', 'Pia', 'inhaber', 'h'), konto('jo', 'Jo', 'mitglied', 'h')] }));
    expect(istPrivat('Projekte', kurz)).toBe(false);
    expect(istPrivat('Jo privat', kurz)).toBe(true);
  });
  it('ohne Konten: keine Ordner-Regel, keine Haushalts-Sicht (nie „alle“)', () => {
    const leer = vaultPersonenAus({ konten: [] });
    expect(ordnerRegel(leer)).toEqual({ eigentuemer: [], andere: [] });
    expect(darfSehen({ scope: 'intern' }, sichtAus({ person: 'pia' }, leer))).toBe(false);
    expect(darfSehen({ scope: 'privat' }, sichtAus({ person: 'pia' }, leer))).toBe(false);
  });
});

describe('(b) Altbestand mit den gewachsenen Speichernamen — Gold-Vergleich gegen den alten Code', () => {
  const SCOPES = [undefined, '', 'privat', 'intern', 'familie', 'oeffentlich', 'team', 'geheim'];
  const OWNER = [undefined, '', 'kevin', 'malin', 'partner', 'testmitglied', 'fremd'];
  const PERSONEN = ['kevin', 'malin', 'partner', 'testmitglied', 'unbekannt', '', 'Kevin'];
  const NOTIZEN = SCOPES.flatMap(scope => OWNER.map(owner => ({ ...(scope !== undefined ? { scope } : {}), ...(owner !== undefined ? { owner } : {}) })));

  for (const [name, konten] of [['zweite Person als Mitglied', ALT_KONTEN], ['zweite Person als zweite Inhaberin (R9)', ALT_KONTEN_R9]] as const) {
    it(`darfSehen: jede Notiz × jede Person × Gespräch/Agent liefert dasselbe (${name})`, () => {
      const p = vaultPersonenAus(konten);
      let n = 0;
      for (const notiz of NOTIZEN) for (const person of PERSONEN) for (const agent of [false, true]) {
        // `{ person: '', agent: true }` IST jetzt der Systemlauf (`AGENT`) — früher war das fest das Erstkonto mit `agent`
        // (`AGENT_ALT`, eine Zeile weiter unten verglichen); ein leerer Name kam als Agent sonst nirgends vor.
        if (agent && person === '') continue;
        const roh = agent ? { person, agent } : { person };
        expect(darfSehen(notiz, sichtAus(roh, p)), JSON.stringify({ notiz, roh })).toBe(darfSehenAlt(notiz, roh));
        n++;
      }
      // Der Agent ohne Person (früher: fest das Erstkonto mit `agent`) sieht dasselbe.
      for (const notiz of NOTIZEN) expect(darfSehen(notiz, sichtAus(AGENT, p)), JSON.stringify(notiz)).toBe(darfSehenAlt(notiz, AGENT_ALT));
      expect(n).toBe(NOTIZEN.length * (PERSONEN.length * 2 - 1));
    });
  }

  it('anhängen an ein Protokoll: dieselbe Entscheidung', () => {
    for (const notiz of NOTIZEN) for (const person of ['kevin', 'malin', 'testmitglied']) for (const scope of [undefined, 'intern', 'privat'] as const) {
      expect(anhaengenErlaubt(notiz, s(person), scope), JSON.stringify({ notiz, person, scope })).toBe(anhaengenErlaubtAlt(notiz, person, scope));
    }
  });

  it('Ordner-Regel: dieselben Ordner bleiben zu (alle Fälle des alten Wächters und mehr)', () => {
    const regel = ordnerRegel(ALT);
    const ORDNER = ['02. Malin', 'Malin', 'Malin an Kevin ', 'malin-notizen', '05 Ziele Malin', '03_Malin_Kevin_Brain', 'Malin & Kevin', 'Malin und Kevin',
      'Kevin & Malin', 'MalinNotizen', 'Malinowski', 'malin_und_kevin', 'Malin&Kevin Brain', 'Malin Kevin Brain', 'MALIN', '01 Start', 'Make.Claude',
      'Projects Kopie', 'KEMARIS', '05 Wissen', 'Kevin', 'Kevin privat', 'Notiz über Malin.md', 'Partner', 'Test'];
    for (const o of ORDNER) expect(istPrivat(o, regel), o).toBe(istPrivatAlt(o));
  });

  it('Brain-Inbox: Vertraulichkeit lesen, sehen und der Eigentümer der angenommenen Notiz — dasselbe', () => {
    for (const v of ['gemeinsam', 'privat-kevin', 'privat-malin', '', 'privat', 'Privat-Kevin', 'öffentlich', 'privat-kevin malin']) {
      expect(I.vertr(v), v).toBe(vertrAlt(v));
      const gelesen = I.vertr(v);
      for (const person of ['kevin', 'malin', 'partner', 'testmitglied', 'unbekannt']) for (const agent of [false, true]) {
        const roh = agent ? { person, agent } : { person };
        expect(I.darfVorschlagSehen({ vertraulichkeit: gelesen }, sichtAus(roh, ALT)), JSON.stringify({ v, roh })).toBe(darfVorschlagSehenAlt({ vertraulichkeit: vertrAlt(v) }, roh));
      }
      const alt = annehmenZielAlt(vertrAlt(v));
      expect({ scope: gelesen === 'gemeinsam' ? 'intern' : 'privat', owner: I.privatVon(gelesen) ?? ALT.eigentuemer }, v).toEqual(alt);
    }
  });

  it('Regeln: „gilt für“ lesen, Eigentümer ohne owner, Filter im Prompt-Block — dasselbe', () => {
    for (const g of ['kevin', 'malin', 'beide', 'zoe', '', 'Kevin', 'alle', 'partner', 'testmitglied', 'kevin malin', undefined]) {
      expect(R.giltAus(g, ALT.haushalt), String(g)).toBe(giltAlt(g));
      expect(R.giltGueltig(g, ALT.haushalt), String(g)).toBe(vorschlagGiltAlt(g));
      for (const person of ['kevin', 'malin', 'partner', '']) {
        const regel = { id: 'r.md', titel: 'T', text: 'x', prioritaet: 2 as const, giltFuer: R.giltAus(g, ALT.haushalt), status: 'aktiv' as const, scope: 'intern', owner: 'kevin', erstelltVon: 'kevin', erstelltAm: '', geaendertVon: 'kevin', geaendertAm: '', freigegebenVon: 'kevin' };
        const block = R.regelnBlock(null, [regel], person, 6000, ['kevin', 'malin']);
        expect(block.includes('] T:'), JSON.stringify({ g, person })).toBe(regelPasstAlt(giltAlt(g), person));
      }
    }
  });

  it('Konsolidierung: Vertraulichkeit und „gilt für“ aus der Antwort des Modells — dasselbe wie die feste Liste', () => {
    for (const v of ['gemeinsam', 'privat-kevin', 'privat-malin', 'privat-partner', 'privat-x', '', undefined]) {
      const alt = v === 'privat-kevin' || v === 'privat-malin' ? v : 'gemeinsam';
      expect(K.modellVertraulichkeit(v, ALT.haushalt), String(v)).toBe(alt);
    }
    for (const g of ['kevin', 'malin', 'beide', 'zoe', 'partner', 'alle', '', undefined]) {
      expect(K.modellGiltFuer(g, ALT.haushalt), String(g)).toBe((['kevin', 'malin', 'beide', 'zoe'] as const).find(x => x === g));
    }
    expect(K.personenZeile(ALT.haushalt)).toContain('<daten quelle="personen">kevin, malin</daten>');
    expect(K.personenZeile([])).not.toContain('<daten');
  });
});

describe('(c) Systemlauf ohne Person', () => {
  it('sieht nie privat — auch nicht das des Vault-Eigentümers oder ohne owner; intern sieht er als Haushalt', () => {
    for (const p of [ALT, KD, vaultPersonenAus({ konten: [] })]) {
      const sys = sichtAus(AGENT, p);
      for (const owner of [undefined, '', 'kevin', 'malin', 'pia', 'olaf', p.eigentuemer ?? undefined]) expect(darfSehen({ scope: 'privat', ...(owner !== undefined ? { owner } : {}) }, sys)).toBe(false);
      expect(darfSehen({ scope: 'intern' }, sys)).toBe(true);
      expect(darfSehen({}, sys)).toBe(true);
    }
  });
  it('ein Agent im Auftrag einer Person sieht deren privat nicht, Inbox-Vorschläge nur gemeinsame', () => {
    expect(darfSehen({ scope: 'privat', owner: 'olaf' }, s('olaf', KD, true))).toBe(false);
    expect(I.darfVorschlagSehen({ vertraulichkeit: 'privat-olaf' }, s('olaf', KD, true))).toBe(false);
    expect(I.darfVorschlagSehen({ vertraulichkeit: 'gemeinsam' }, sichtAus(AGENT, KD))).toBe(true);
  });
});

describe('Kundeninstanz von Ende zu Ende (Test-Vault + Konten)', () => {
  let db: typeof import('@/lib/store/local-db');
  const notiz = (rel: string, kopf: string, text: string) => fs.mkdir(path.dirname(path.join(VAULT, rel)), { recursive: true }).then(() => fs.writeFile(path.join(VAULT, rel), `---\n${kopf}\n---\n# ${path.basename(rel, '.md')}\n\n${text}\n`, 'utf8'));
  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { ...KUNDE, einladungen: [] });
    await fs.mkdir(path.join(path.dirname(VAULT), '.obsidian'), { recursive: true });
    await notiz('01 Wissen/Ablauf Lager.md', 'type: notiz\nscope: intern\nowner: pia', 'Lagerplan Wellblech.');
    await notiz('01 Wissen/Geschenk.md', 'type: notiz\nscope: privat\nowner: pia', 'Wellblech als Geschenkidee.');
    await notiz('01 Wissen/Eigene Idee.md', 'type: notiz\nscope: privat\nowner: olaf', 'Wellblech für den Garten.');
    await notiz('01 Wissen/Ohne Owner.md', 'type: notiz\nscope: privat', 'Wellblech ohne Eigentümer.');
    await notiz('02. Olaf/Tagebuch.md', 'type: notiz\nscope: intern', 'Wellblech im Tagebuch.');
    await notiz('Olaf & Pia/Gemeinsam.md', 'type: notiz\nscope: intern', 'Wellblech gemeinsam.');
    V.bestandVergessen();
  });
  const titel = async (sicht: Parameters<typeof V.sucheOhneIndex>[2]) => (await V.sucheOhneIndex('Wellblech', 20, sicht)).treffer.map(t => t.titel).sort();

  it('die Inhaberin findet ihr Internes und ihr Privates, nie das der zweiten Person; der Ordner der zweiten Person ist zu', async () => {
    expect(await titel({ person: 'pia' })).toEqual(['Ablauf Lager', 'Gemeinsam', 'Geschenk', 'Ohne Owner']);
    expect((await V.bestand(true)).privatUebersprungen).toBe(1);
  });
  it('die zweite Person sieht Internes und nur ihr eigenes Privates', async () => {
    expect(await titel({ person: 'olaf' })).toEqual(['Ablauf Lager', 'Eigene Idee', 'Gemeinsam']);
  });
  it('Systemlauf und fremder Haushalt: nie privat; der fremde Haushalt nicht einmal intern', async () => {
    expect(await titel(AGENT)).toEqual(['Ablauf Lager', 'Gemeinsam']);
    expect(await titel({ person: 'gast' })).toEqual([]);
    expect(await titel({ person: 'kevin' })).toEqual([]); // ein Name des Altbestands öffnet in einer fremden Instanz nichts
  });
  it('Notiz lesen und neueste: dieselbe Sicht', async () => {
    expect((await V.notiz('Geschenk', 1000, { person: 'olaf' })).ok).toBe(false);
    expect((await V.notiz('Geschenk', 1000, { person: 'pia' })).ok).toBe(true);
    expect((await V.neueste({ person: 'olaf' }, 20)).map(n => n.titel).sort()).toEqual(['Ablauf Lager', 'Eigene Idee', 'Gemeinsam']);
  });
  it('Brain-Inbox: privat-<Speichername> sieht nur diese Person, gemeinsam der Haushalt', async () => {
    await I.vorschlagAblegen({ titel: 'Nur für Olaf', text: 'x', ziel: 'neu', begruendung: 'b', quelle: 'q', vertraulichkeit: 'privat-olaf' });
    await I.vorschlagAblegen({ titel: 'Für alle', text: 'y', ziel: 'neu', begruendung: 'b', quelle: 'q', vertraulichkeit: 'gemeinsam' });
    expect((await I.vorschlaegeLesen({ person: 'olaf' })).map(v => v.titel).sort()).toEqual(['Für alle', 'Nur für Olaf']);
    expect((await I.vorschlaegeLesen({ person: 'pia' })).map(v => v.titel)).toEqual(['Für alle']);
    expect(await I.vorschlaegeLesen({ person: 'gast' })).toEqual([]);
    const privat = (await I.vorschlaegeLesen({ person: 'olaf' })).find(v => v.titel === 'Nur für Olaf')!;
    expect((await I.vorschlagAnnehmen(privat.id, 'pia', { person: 'pia' })).ok).toBe(false);
    expect((await I.vorschlagAnnehmen(privat.id, 'olaf', { person: 'olaf' })).ok).toBe(true);
    const neu = (await fs.readdir(path.join(VAULT, '03. Protokolle', 'Protokolle'))).find(f => f.includes('Nur für Olaf'))!;
    const text = await fs.readFile(path.join(VAULT, '03. Protokolle', 'Protokolle', neu), 'utf8');
    expect(text).toContain('scope: privat'); expect(text).toContain('owner: olaf'); expect(text).toContain('freigegeben_von: olaf');
    const gemeinsam = (await I.vorschlaegeLesen({ person: 'pia' })).find(v => v.titel === 'Für alle')!;
    expect((await I.vorschlagAnnehmen(gemeinsam.id, 'olaf', { person: 'olaf' })).ok).toBe(true);
    const neu2 = (await fs.readdir(path.join(VAULT, '03. Protokolle', 'Protokolle'))).find(f => f.includes('Für alle'))!;
    expect(await fs.readFile(path.join(VAULT, '03. Protokolle', 'Protokolle', neu2), 'utf8')).toContain('owner: pia'); // gemeinsam = Eigentümer des Vaults
  });
  it('Regeln: „gilt für“ nur Haushalt, ZOE oder eine Person des Haushalts; Anzeige mit dem Vornamen aus dem Konto', async () => {
    expect((await R.regelAnlegen({ titel: 'Für Olaf', text: 'Kurz antworten.', giltFuer: 'olaf', status: 'aktiv' }, 'pia')).ok).toBe(true);
    expect((await R.regelAnlegen({ titel: 'Für Fremde', text: 'x', giltFuer: 'gast', status: 'aktiv' }, 'pia')).ok).toBe(false);
    expect((await R.regelAnlegen({ titel: 'Ohne Person', text: 'x' }, '')).ok).toBe(false);
    expect(await R.regelnFuerPrompt('olaf')).toContain('[P2 · Olaf · freigegeben von pia] Für Olaf');
    expect(await R.regelnFuerPrompt('pia')).not.toContain('Für Olaf');
    expect(R.giltLabel('beide')).toBe('Haushalt');
    expect(R.giltLabel('zoe')).toBe('ZOE');
    // Eine private Regel ohne owner gehört dem Vault-Eigentümer.
    await fs.writeFile(path.join(VAULT, '00. Fundament', 'Regeln', 'ohne-owner.md'), '---\ntype: regel\ntitel: Ohne Owner\nprioritaet: 2\ngilt_fuer: beide\nstatus: entwurf\nscope: privat\n---\n\n# Ohne Owner\n\nText.\n');
    expect((await R.regelnLesen({ person: 'pia' })).map(r => r.titel)).toContain('Ohne Owner');
    expect((await R.regelnLesen({ person: 'olaf' })).map(r => r.titel)).not.toContain('Ohne Owner');
  });
  it('ins Brain schreiben: ohne Person (Systemlauf) im Namen der Inhaberin, nie an Privates angehängt', async () => {
    const a = await V.legeAn('Systemnotiz', 'Erster Eintrag.', {});
    expect(a.ok).toBe(true);
    const datei = path.join(VAULT, a.pfad!.split('/').slice(2).join('/'));
    expect(await fs.readFile(datei, 'utf8')).toContain('owner: pia');
    const p = await V.legeAn('Privatnotiz', 'Nur für mich.', { person: 'olaf', scope: 'privat' });
    expect(p.ok).toBe(true);
    // Der Systemlauf hängt an das private Protokoll gleichen Titels nicht an — er legt ein eigenes an.
    const sys = await V.legeAn('Privatnotiz', 'Vom Takt.', { scope: 'privat' });
    expect(sys.ok).toBe(true); expect(sys.pfad).not.toBe(p.pfad);
  });
});

describe('(b) Altbestand über die echten Lesewege — Gold gegen den alten Code', () => {
  // Dieselben Daten wie ein gewachsener Vault: owner/scope/gilt_fuer/privat-<x> mit den Speichernamen, ein Ordner der zweiten
  // Person, ein gemeinsamer Ordner. Gelesen über Suche, Regeln und Inbox — erwartet wird, was die alten Funktionen sagen.
  const NOTIZEN = [
    { rel: '10 Alt/A Intern.md', scope: 'intern', owner: 'kevin' }, { rel: '10 Alt/B Ohne.md' }, { rel: '10 Alt/C Privat K.md', scope: 'privat', owner: 'kevin' },
    { rel: '10 Alt/D Privat M.md', scope: 'privat', owner: 'malin' }, { rel: '10 Alt/E Privat ohne.md', scope: 'privat' }, { rel: '10 Alt/F Familie.md', scope: 'familie', owner: 'malin' },
    { rel: '10 Alt/G Team.md', scope: 'team' }, { rel: '02. Malin/H Ordner.md', scope: 'intern' }, { rel: 'Malin & Kevin/I Gemeinsam.md', scope: 'intern' },
    { rel: '05 Ziele Malin/J Ziel.md', scope: 'familie' },
  ];
  const titelVon = (rel: string) => path.basename(rel, '.md');
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { ...ALT_KONTEN, einladungen: [] });
    for (const n of NOTIZEN) {
      const kopf = ['type: notiz', ...(n.scope ? [`scope: ${n.scope}`] : []), ...(n.owner ? [`owner: ${n.owner}`] : [])].join('\n');
      await fs.mkdir(path.dirname(path.join(VAULT, n.rel)), { recursive: true });
      await fs.writeFile(path.join(VAULT, n.rel), `---\n${kopf}\n---\n# ${titelVon(n.rel)}\n\nRotbuche im Altbestand.\n`, 'utf8');
    }
    const regel = (id: string, gilt: string, scope: string, owner?: string) => fs.writeFile(path.join(VAULT, '00. Fundament', 'Regeln', `${id}.md`),
      `---\ntype: regel\ntitel: ${id}\nprioritaet: 2\ngilt_fuer: ${gilt}\nstatus: aktiv\nscope: ${scope}\n${owner ? `owner: ${owner}\n` : ''}freigegeben_von: kevin\nfreigegeben_am: 2026-10-01\n---\n\n# ${id}\n\nText.\n`, 'utf8');
    await regel('alt-k', 'kevin', 'intern', 'kevin'); await regel('alt-m', 'malin', 'intern', 'malin'); await regel('alt-b', 'beide', 'intern');
    await regel('alt-z', 'zoe', 'intern'); await regel('alt-pk', 'kevin', 'privat'); await regel('alt-pm', 'malin', 'privat', 'malin'); await regel('alt-x', 'Alle', 'intern');
    V.bestandVergessen();
  });

  it('Suche: jede Person (Gespräch und Agent) findet genau, was der alte Code zeigte', async () => {
    for (const roh of [{ person: 'kevin' }, { person: 'malin' }, { person: 'partner' }, { person: 'testmitglied' }, { person: 'kevin', agent: true }, { person: 'malin', agent: true }]) {
      const neu = (await V.sucheOhneIndex('Rotbuche', 50, roh)).treffer.map(t => t.titel).sort();
      const alt = NOTIZEN.filter(n => !n.rel.split('/').slice(0, -1).some(istPrivatAlt) && darfSehenAlt(n, roh)).map(n => titelVon(n.rel)).sort();
      expect(neu, JSON.stringify(roh)).toEqual(alt);
    }
    const neuAgent = (await V.sucheOhneIndex('Rotbuche', 50, AGENT)).treffer.map(t => t.titel).sort();
    expect(neuAgent).toEqual(NOTIZEN.filter(n => !n.rel.split('/').slice(0, -1).some(istPrivatAlt) && darfSehenAlt(n, AGENT_ALT)).map(n => titelVon(n.rel)).sort());
  });

  it('Regeln: sichtbar, Eigentümer ohne owner und „gilt für“ wie vorher; der Prompt-Block nimmt dieselben', async () => {
    for (const person of ['kevin', 'malin', 'testmitglied']) {
      const neu = (await R.regelnLesen({ person })).filter(r => r.id.startsWith('alt-'));
      expect(neu.map(r => r.id).sort(), person).toEqual(['alt-b', 'alt-k', 'alt-m', 'alt-pk', 'alt-pm', 'alt-x', 'alt-z']
        .filter(id => { const owner = id === 'alt-pk' ? undefined : id === 'alt-pm' ? 'malin' : undefined; const scope = id.startsWith('alt-p') ? 'privat' : 'intern'; return darfSehenAlt({ scope, owner: regelOwnerAlt(owner) }, { person }); })
        .map(id => `${id}.md`).sort());
      for (const r of neu) {
        expect(r.giltFuer, r.id).toBe(giltAlt({ 'alt-k': 'kevin', 'alt-m': 'malin', 'alt-b': 'beide', 'alt-z': 'zoe', 'alt-pk': 'kevin', 'alt-pm': 'malin', 'alt-x': 'Alle' }[r.id.replace('.md', '')]));
        if (r.id === 'alt-pk.md') expect(r.owner).toBe(regelOwnerAlt(undefined));
      }
      const block = await R.regelnFuerPrompt(person);
      for (const r of neu) expect(block.includes(`] ${r.titel}:`), `${person} ${r.id}`).toBe(regelPasstAlt(giltAlt(r.giltFuer), person));
    }
  });
});

describe('Kopf und gültiger Stand', () => {
  const text = [
    '---', 'type: steckbrief', 'scope: Privat', 'owner: kevin', 'stand: 2026-09-21', 'tags: [firma, "kemaris"]', '---',
    '# Titel', '', '## 🔴 UPDATE 21.09.2026 · ZOE für kevin — Neu', 'gilt jetzt', '', '## Alt', 'veraltet',
  ].join('\n');

  it('liest den YAML-Kopf ohne Zusatzpaket', () => {
    const { kopf, rumpf } = leseKopf(text);
    expect(kopf).toMatchObject({ typ: 'steckbrief', scope: 'privat', owner: 'kevin', stand: '2026-09-21', tags: ['firma', 'kemaris'] });
    // Seit 27.09. liegen alle Felder roh bei (Regeln, Vorschläge, Provenienz)
    expect(kopf.felder.type).toBe('steckbrief');
    expect(rumpf.startsWith('# Titel')).toBe(true);
  });

  it('der oberste 🔴-Block ist der gültige Stand', () => {
    const { rumpf } = leseKopf(text);
    expect(obersterBlock(rumpf)).toBe('## 🔴 UPDATE 21.09.2026 · ZOE für kevin — Neu\ngilt jetzt');
    expect(obersterBlock('# ohne Update')).toBe('');
  });

  it('ordnet Bereiche nach dem Ordner', () => {
    expect(bereichVon('make/Make.Claude/01. KD Ventures Brain/X.md')).toBe('Business');
    expect(bereichVon('make/Make.Claude/00. Fundament/Y.md')).toBe('Fundament');
    expect(bereichVon('make/Make.Claude/02. MAKE Brain privat/Z.md')).toBe('Privat');
    expect(bereichVon('make/Make.Claude/03. Protokolle/P.md')).toBe('Protokolle');
    expect(bereichVon('makeos/05 Wissen/A.md')).toBe('MAKE OS');
  });
});

describe('Kürzen langer Notizen', () => {
  const lang = `ANFANG ${'x'.repeat(5000)} ENDE`;
  it('Wissensnotiz: der Anfang bleibt', () => {
    const k = gekuerzt(lang, 1000, false);
    expect(k.startsWith('ANFANG')).toBe(true);
    expect(k).not.toContain('ENDE');
  });
  it('Log: Anfang und vor allem das Ende bleiben', () => {
    const k = gekuerzt(lang, 1000, true);
    expect(k.startsWith('ANFANG')).toBe(true);
    expect(k.endsWith('ENDE')).toBe(true);
    expect(k).toContain('ältere Einträge ausgelassen');
  });
  it('Kurzes bleibt, wie es ist', () => expect(gekuerzt('kurz', 1000, true)).toBe('kurz'));
});
