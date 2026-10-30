// ─── Wächter „Neutral für Testkunden“ (30.10. nachts, Branch nacht-neutral) ─────────────────────────────────────────────────────────────────
// Kevin 30.10.: „Neutralisieren für Testkunden“ (ROADMAP_Q4.md Phase 3: feste Kevin/Malin-Stellen vollständig neutralisieren, damit eine
// leere Kunden-Instanz sauber startet). Dieser Wächter liest JEDE Datei unter app/, lib/, components/, hooks/, context/ (ohne Kommentare)
// und wird rot, sobald dort neu auftaucht:
//   1. eine feste Personen-Kennung als Text-Literal ('kevin', "malin", `kevin`) — Personen kommen aus Konten/Team (lib/make-one/fach-namen.ts
//      für die zwei Fächer des Altbestands, `teamVon`, `haushaltsPersonen`);
//   2. ein Vor-/Nachname der gewachsenen Instanz in Code, Texten oder Prompts;
//   3. ein fremder Firmen-/Produktname oder eine feste Domain/Adresse der Instanz;
//   4. die Veranstaltungsmarke oder Gesellschaftsnamen außerhalb ihrer EINEN Stelle (lib/crm/marke.ts, lib/einheiten.ts).
// Ausnahmen stehen je Datei MIT GRUND in den Listen unten — und jede Ausnahme muss noch einen Fund haben (sonst ist sie veraltet: streichen).
// Dazu Verhalten mit erfundenen Personen (Pia, Olaf): Fächer, Besitz/Zuständigkeit, Beleg-Aufgaben — Altbestand liest sich bit-gleich.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.MAKE_OS_DATEN_DIR = mkdtempSync(path.join(tmpdir(), 'make-os-neutral-nacht-'));
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const WURZEL = path.resolve(__dirname, '..');
const ORDNER = ['app', 'lib', 'components', 'hooks', 'context'];
function dateien(): string[] {
  const raus: string[] = [];
  const lauf = (rel: string) => {
    for (const n of readdirSync(path.join(WURZEL, rel))) {
      const r = `${rel}/${n}`;
      if (statSync(path.join(WURZEL, r)).isDirectory()) lauf(r);
      else if (/\.(tsx?|mjs|js|json)$/.test(n)) raus.push(r);
    }
  };
  for (const o of ORDNER) lauf(o);
  return raus;
}
/** Zeilen ohne Kommentare (Block, Zeile, JSX) — Zeilennummern bleiben gleich. */
const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, '')).split('\n')
  .map(z => (/^\s*(\/\/|\*|\{\/\*)/.test(z) ? '' : z.replace(/\s\/\/ .*$/, '')));
const ALLE = dateien();
const TEXTE = new Map(ALLE.map(d => [d, ohneKommentare(readFileSync(path.join(WURZEL, d), 'utf8'))]));
function funde(muster: RegExp): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [d, zeilen] of TEXTE) zeilen.forEach((z, i) => { if (muster.test(z)) m.set(d, [...(m.get(d) ?? []), `${i + 1}: ${z.trim().slice(0, 120)}`]); });
  return m;
}
function pruefe(muster: RegExp, ausnahmen: Record<string, string>) {
  const f = funde(muster);
  const neu = [...f.entries()].filter(([d]) => !(d in ausnahmen)).flatMap(([d, z]) => z.map(x => `${d}:${x}`));
  const veraltet = Object.keys(ausnahmen).filter(d => !f.has(d));
  return { neu, veraltet };
}

// ── 1. Feste Personen-Kennungen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const KENNUNG = /['"`](kevin|malin)['"`]/;
const FINANZKERN = 'Fach-Kennung des Finanzkerns (Felder `kevinBrutto`, `malinNetto`, Konten/„wer“) — Umbenennen braucht Kevins Wort (Kern-Regel); angezeigt wird der Vorname aus den Konten (`personName`)';
const KALENDERFACH = 'Fach-Kennung der Kalender-Zuordnung (`kalender.kevin/malin/beide` in den Einstellungen, nie umbenennen) — Namen über lib/make-one/fach-namen.ts';
const KENNUNG_AUSNAHMEN: Record<string, string> = {
  'lib/make-one/fach-namen.ts': 'die EINE Stelle der zwei Fächer (`FAECHER`) — Kennungen aus dem Altbestand',
  'lib/zoe/raum.ts': 'ERSTKONTO: Bestände des gewachsenen Erstkontos ohne Suffix (`speicherFuer`) — braucht eine Daten-Migration (Plattform-Schuld, UPDATES.md neutral-rest-2)',
  'lib/zugang/konten.ts': 'RESERVIERTE_SPEICHER: die Fach-Kennungen werden nur über eine gebundene Einladung vergeben — schützt die Zuordnung „gleicher Speichername gewinnt“ (fach-namen.ts)',
  'lib/make-one/crm.ts': 'privatNotizVerfasser: private Notizen aus dem Altbestand ohne `privatNotizVon` stammen vom Erstkonto; neue tragen immer die Person (Server)',
  'lib/planung/wochenplan-uebernahme.ts': 'Altbestand: einmalige Übernahme des alten Wochenplans (Bestand ohne Suffix = Erstkonto) — fällt mit der Übernahme weg',
  'lib/planung/wochenplan-uebernahme-server.ts': 'Altbestand: einmalige Übernahme des alten Wochenplans (Personen = Fächer der Zuordnung) — fällt mit der Übernahme weg',
  'lib/kalender/apple-altweg.ts': 'Fach-Kennungen als Kategorie/Besitzer im calendar-cache (Leser färben danach) — Namen kommen aus Einstellungen/Konten',
  'lib/kalender/belegt.ts': KALENDERFACH,
  'lib/kalender/einstellungen.ts': KALENDERFACH,
  'lib/kalender/schnell.ts': KALENDERFACH,
  'components/os/kalender/teile.tsx': KALENDERFACH,
  'components/os/finanzplan/Gesamt.tsx': FINANZKERN,
  'components/os/finanzplan/Baukasten.tsx': FINANZKERN,
  'components/os/finanzplan/Auswerten.tsx': FINANZKERN,
  'components/os/finanzplan/Geschaeft.tsx': FINANZKERN,
  'components/os/finanzplan/Planen.tsx': FINANZKERN,
  'components/os/finanzplan/Annahmen.tsx': FINANZKERN,
  'components/os/finanzplan/Blatt.tsx': FINANZKERN,
  'components/os/finanzplan/Monat.tsx': FINANZKERN,
  'components/os/finanzplan/Ueberblick.tsx': FINANZKERN,
  'components/os/finanzplan/Verpflichtungen.tsx': FINANZKERN,
  'components/os/finanzplan/teile.tsx': FINANZKERN,
};

// ── 2. Namen der gewachsenen Instanz ────────────────────────────────────────────────────────────────────────────────────────────────────────
const NAMEN = /\b(Kevin|Malin|Kevins|Malins)\b|Dieckmann|Würriehausen/;
const NAMEN_AUSNAHMEN: Record<string, string> = {
  'lib/altbestand/nordstern-uebernahme.ts': 'hält den früheren Nordstern-Text nur bis zur einmaligen Übernahme in die Daten — wird mit dem übernächsten Upload gelöscht (CLAUDE.md › Nordstern)',
};

// ── 3. Fremde Firmen/Produkte, feste Domains ────────────────────────────────────────────────────────────────────────────────────────────────
const FIRMEN = /KEMARIS|POINCAP|CapOS|ASTARNA|KD Management|Grant Pilot|Innovation Group|One ?Buddy|onebanking|Liquido/i;
const KERN_ALT = 'Feldname im Finanzkern (`astarna`, Provisionskunden) — angezeigt wird „Provision“; Umbenennen braucht Kevins Wort (Kern-Regel)';
const BESTAND_ALT = 'Name eines Altbestands (`kemaris-calendar`) — Register/Löschfrist/Art. 17 müssen ihn kennen, solange er auf Instanzen liegt';
const FIRMEN_AUSNAHMEN: Record<string, string> = {
  'lib/einheiten.ts': 'die EINE Stelle der Gesellschaften: Altnamen werden beim Lesen erkannt (`UG_ALTNAMEN`, KD Management → kdv)',
  'lib/finanzen/haushalt/typen.ts': 'Altvokabular der Privat-Finanzen beim Lesen (`ug` = KD Management UG = kdv, CLAUDE.md › Finanzen EINE Einheitenliste)',
  'lib/finanzen/rechenkern.ts': KERN_ALT, 'lib/finanzen/plan/operationen.ts': KERN_ALT, 'lib/finanzen/annahmen-felder.ts': KERN_ALT,
  'lib/finanzen/handwerte.ts': KERN_ALT, 'components/os/finanzplan/Auswerten.tsx': KERN_ALT, 'components/os/finanzplan/Geschaeft.tsx': KERN_ALT,
  'components/os/finanzplan/Planen.tsx': KERN_ALT,
  'lib/crm/loeschfristen-lauf.ts': BESTAND_ALT, 'lib/crm/person-weitere.ts': BESTAND_ALT, 'lib/crm/speicher-register.ts': BESTAND_ALT,
  'lib/zugang/routen-register.ts': BESTAND_ALT, 'lib/neustart/umzug.mjs': BESTAND_ALT,
  'lib/make-one/alt-projekte.ts': 'Kennungen alter Projekte im Altbestand (`proj-…`) → Säule/Thema — nur Zuordnung, kein Anzeigename',
  'lib/kalender/space.ts': 'OFFEN für Kevin: Business-Erkennung am Kalendernamen kennt Firma/Nachname der gewachsenen Instanz — neutral nur mit Zuordnung in den Kalender-Einstellungen der Live-Instanz (NEUTRAL_NACHT_3010.md)',
};
const DOMAINS = /makeinnovation\.de|fokusinnovation\.de|sslip\.io|2\.28\.108\.162|@makeinnovation/i;

// ── 4. Marke und Gesellschaftsnamen nur an ihrer Stelle ─────────────────────────────────────────────────────────────────────────────────────
const MARKE = /Make\.One/;
const GESELLSCHAFTEN = /KD[ -]Ventures|MAKE Innovation|Fokus Innovation/;
const GESELLSCHAFT_AUSNAHMEN: Record<string, string> = {
  'lib/einheiten.ts': 'die EINE Stelle der Gesellschaftsnamen (Vorgabe der gewachsenen Instanz, je Instanz über NEXT_PUBLIC_MAKE_OS_EINHEITEN)',
  'lib/altbestand/nordstern-uebernahme.ts': NAMEN_AUSNAHMEN['lib/altbestand/nordstern-uebernahme.ts'],
  'lib/check/vorlagen/innovations-check/scoring.json': 'OFFEN für Kevin: Siegel-Name der Innovationscheck-Vorlage ist Produktinhalt (eigene Vorlage je Instanz?)',
};

describe('Quelltext (app, lib, components, hooks, context): keine festen Personen, Firmen, Domains', () => {
  it('1. keine festen Personen-Kennungen als Literal — außer den begründeten Fach-/Altbestand-Stellen', () => {
    const r = pruefe(KENNUNG, KENNUNG_AUSNAHMEN);
    expect(r.neu, 'neue feste Kennung — Person aus Konten/Team bzw. FAECHER/fachDerPerson nehmen').toEqual([]);
    expect(r.veraltet, 'Ausnahme ohne Fund — aus der Liste streichen').toEqual([]);
  });
  it('2. keine Namen der gewachsenen Instanz in Code, Texten oder Prompts', () => {
    const r = pruefe(NAMEN, NAMEN_AUSNAHMEN);
    expect(r.neu).toEqual([]);
    expect(r.veraltet).toEqual([]);
  });
  it('3. keine fremden Firmen/Produkte (außer Altbestand-Kennungen) und keine festen Domains/Adressen', () => {
    const r = pruefe(FIRMEN, FIRMEN_AUSNAHMEN);
    expect(r.neu).toEqual([]);
    expect(r.veraltet).toEqual([]);
    expect(pruefe(DOMAINS, {}).neu).toEqual([]);
  });
  it('4. Veranstaltungsmarke nur in lib/crm/marke.ts, Gesellschaftsnamen nur in lib/einheiten.ts', () => {
    expect(pruefe(MARKE, { 'lib/crm/marke.ts': 'MARKE_EVENTS — die EINE Stelle (Vorgabe, je Instanz NEXT_PUBLIC_MAKE_OS_EVENT_MARKE)' }).neu).toEqual([]);
    const g = pruefe(GESELLSCHAFTEN, GESELLSCHAFT_AUSNAHMEN);
    expect(g.neu).toEqual([]);
    expect(g.veraltet).toEqual([]);
  });
  it('deploy/: keine feste Domain der gewachsenen Instanz in den Einrichtungs-Skripten (Adresse aus der .env)', () => {
    const skripte = ['whatsapp-verbinden.sh', 'zoe-whatsapp-verbinden.sh', 'google-verbinden.sh', 'vault-hochladen.sh', 'server-einrichten.sh'];
    for (const s of skripte) {
      const t = readFileSync(path.join(WURZEL, 'deploy', s), 'utf8').split('\n').filter(z => !/^\s*#/.test(z)).join('\n');
      expect(t, s).not.toMatch(/makeinnovation\.de|KevinDieckmann\/|\bKevin\b|MAKE Innovation|KD Ventures/);
    }
  });
});

describe('Verhalten mit erfundenen Personen — Altbestand bit-gleich', () => {
  const pia = { id: 'pia', name: 'Pia' }, olaf = { id: 'olaf', name: 'Olaf' };
  it('Fächer: die Person der Sitzung findet ihr Fach über die Konten, nie über den Speichernamen', async () => {
    const { fachDerPerson } = await import('@/lib/make-one/fach-namen');
    expect(fachDerPerson('pia', [pia, olaf])).toBe('kevin');
    expect(fachDerPerson('olaf', [pia, olaf])).toBe('malin');
    expect(fachDerPerson('gast', [pia, olaf])).toBeNull();
    expect(fachDerPerson(null, [pia])).toBeNull();
    // Konten noch nicht geladen: gleicher Speichername gewinnt (wie fachPersonen) — sonst kein Fach.
    expect([fachDerPerson('malin', []), fachDerPerson('pia', []), fachDerPerson('kevin', [pia])]).toEqual(['malin', null, null]);
    // Altbestand: gleicher Speichername gewinnt — wie vorher.
    expect(fachDerPerson('kevin', [{ id: 'kevin', name: 'K' }, { id: 'malin', name: 'M' }])).toBe('kevin');
    expect(fachDerPerson('malin', [{ id: 'kevin', name: 'K' }, { id: 'malin', name: 'M' }])).toBe('malin');
  });
  it('Projekt-Besitz und Vorlagen-Zuständigkeit: jeder Speichername bleibt (vorher wurde eine fremde Person still „both“)', async () => {
    const { projektSauber, ownerSauber, taskSauber } = await import('@/lib/aufgaben/saeubern');
    const p = (owner: unknown) => projektSauber({ id: 'p1', title: 'Projekt', owner })?.owner;
    expect([p('kevin'), p('malin'), p('both'), p('pia'), p('Pia X'), p(undefined)]).toEqual(['kevin', 'malin', 'both', 'pia', 'both', 'both']);
    expect([ownerSauber('olaf'), ownerSauber('both'), ownerSauber(''), ownerSauber('<x>')]).toEqual(['olaf', 'both', undefined, undefined]);
    // Ohne Zuständigkeit „both“ — der Schreibweg löst es auf eine Person des Haushalts auf (beideAufloesen), nie eine feste.
    expect(taskSauber({ id: 't1', title: 'Aufgabe', projectId: 'p1' })?.assignee).toBe('both');
    expect(taskSauber({ id: 't2', title: 'Aufgabe', projectId: 'p1', assignee: 'kevin' })?.assignee).toBe('kevin');
  });
  it('Beleg-Aufgaben: Verursacher aus dem Altsystem → Person des Haushalts, sonst „both“', async () => {
    const { belegZustaendig } = await import('@/lib/finanzen/haushalt/aufgaben');
    const haus = [{ speicher: 'pia', name: 'Pia Probe' }, { speicher: 'olaf', name: 'Olaf' }];
    expect([belegZustaendig('Pia', haus), belegZustaendig('olaf', haus), belegZustaendig('Malin', haus), belegZustaendig(null, haus)]).toEqual(['pia', 'olaf', 'both', 'both']);
    // Live-Instanz: dieselbe Zuordnung wie die frühere feste Regel (Malin → malin, sonst die erste Person).
    const live = [{ speicher: 'kevin', name: 'Kevin Beispiel' }, { speicher: 'malin', name: 'Malin' }];
    expect([belegZustaendig('Malin', live), belegZustaendig('Kevin', live)]).toEqual(['malin', 'kevin']);
  });
});
