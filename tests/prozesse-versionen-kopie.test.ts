// ─── Prozesse · alles an einer Vorlage bearbeitbar: Versionen zurückholen, Kopie, eigene Vorlagen, Masken vollständig (22.10.) ─────────────────────────────
// Versionen: eine alte Version zurückholen = neuer ENTWURF (Versionen, Status und die Version neuer Fälle bleiben; Läufe unberührt) → normal veröffentlichen.
// Kopie: neue Kennungen überall (Zweige, Schlösser, „erneut ab“, Abfrage-Listen folgen), Verweise auf andere Prozesse bleiben, Original unverändert, einmalig.
// Eigene Vorlage: ohne Personen und Fall-Daten (kein Eigner, kein „läuft als“, Rollen statt Personen, kein eigenes Postfach, Zettel ohne Verfasser), in der
// Galerie, übernehmbar mit neuen Kennungen, löschen nur volle Mitglieder. Masken: jeder Wert jeder Vorlage der Kundengewinnung steht in der Maske und überlebt
// Lesen → Schreiben; jeder „Einstellbar“-Wert mit Knoten ist änderbar. Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { veroeffentlichen, versionenVergleichen, juengsteVersion, entwurfGeaendert } from '@/lib/prozesse/versionen';
import { neuerProzess, werkstattAnwenden, leerProzesse, type WerkstattKontext } from '@/lib/prozesse/bestand';
import { prozessRechte } from '@/lib/prozesse/rollen';
import { schlossSetzen, schlossKennung } from '@/lib/prozesse/schloss';
import { laufFremd } from '@/lib/prozesse/definition-pruefen';
import { KUNDENGEWINNUNG_VORLAGEN } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { katalogEintrag, ROLLE_ZUSTAENDIG, ROLLE_EIGNER, POSTFACH_DES_LAUFS } from '@/lib/prozesse/baustein-katalog';
import { maskeAnwenden, maskeWerte } from '@/lib/prozesse/werkstatt-maske';
import { voran, starten, type LaufUmfeld } from '@/lib/prozesse/lauf-regeln';
import { leereLaeufe } from '@/lib/prozesse/lauf-typen';
import {
  EIGENE_VORLAGEN_GRENZE, alsEigeneVorlage, ausEigenerVorlage, eigeneVorlageLoeschen, eigeneVorlagenAus, leereEigeneVorlagen, mitNeuenKnoten, ohnePersonen, prozessKopieren,
  type EigeneVorlage,
} from '@/lib/prozesse/kopie';
import type { MaskenWert, ProzessDefinition, ProzessEintrag, ProzessForm, ProzessKnoten, ProzesseDatei } from '@/lib/prozesse/definition';
import { definition, fk, schritt, PZ, PZ2, J, konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-kopie-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-kopie';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

type K = ProzessKnoten<ProzessForm>;
const VOLL = prozessRechte({ imHaushalt: true, vollesMitglied: true, inhaber: true, nurBusiness: false });
const NUR_BUSINESS = prozessRechte({ imHaushalt: true, vollesMitglied: false, inhaber: false, nurBusiness: true });
const FK = /^fk-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let n = 1000;
const kennung = (p: 'pz' | 'fk' | 'ev') => `${p}-00000000-0000-4000-9000-${String(n++).padStart(12, '0')}`;
const kx = (rechte = VOLL) => ({ person: 'pia', jetzt: J, rechte, neueKennung: kennung });
const stabil = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(stabil).join(',')}]`;
  if (v && typeof v === 'object') { const o = v as Record<string, unknown>; return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stabil(o[k])}`).join(',')}}`; }
  return JSON.stringify(v ?? null);
};

// ── Masken: alles an einer übernommenen Vorlage ist änderbar ──────────────────────────────────────────────────────────────────────────────────────────

describe('Masken der Vorlagen sind vollständig (22.10.)', () => {
  const alleKnoten = KUNDENGEWINNUNG_VORLAGEN.flatMap(v => [v.definition, ...v.teile.map(t => t.definition)].flatMap(d => d.knoten.map(k => ({ v, k }))));
  it('jeder Wert jedes Schritts steht in seiner Maske und überlebt Lesen → Schreiben (nichts fällt beim Bearbeiten weg)', () => {
    let geprueft = 0;
    for (const { v, k } of alleKnoten) {
      const e = katalogEintrag(k.katalog?.id);
      if (!e) continue;
      for (const f of Object.keys(k.katalog?.werte ?? {})) expect(e.maske.some(m => m.id === f), `${v.nr} ${k.id}: Wert „${f}“ ohne Eingabe`).toBe(true);
      expect(stabil(maskeAnwenden(k, e, maskeWerte(k, e))), `${v.nr} ${k.id} (${e.id})`).toBe(stabil(k));
      geprueft++;
    }
    expect(geprueft).toBeGreaterThan(200);
  });
  it('jeder Einstellbar-Wert mit Knoten hat eine Eingabe, zeigt die Vorgabe und lässt sich ändern', () => {
    let geprueft = 0;
    for (const v of KUNDENGEWINNUNG_VORLAGEN) {
      const defs = [v.definition, ...v.teile.map(t => t.definition)];
      for (const x of v.einstellbar) {
        if (!x.knoten || !x.feld) continue;
        const k = defs.flatMap(d => d.knoten).find(y => y.id.endsWith(`:${x.knoten}`))!;
        expect(k, `${v.nr} ${x.id}`).toBeTruthy();
        const e = katalogEintrag(k.katalog?.id)!;
        expect(e.maske.some(m => m.id === x.feld), `${v.nr} ${x.id}: „${x.feld}“ fehlt in der Maske von ${e.id}`).toBe(true);
        const w = maskeWerte(k, e);
        const ist = w[x.feld];
        if (typeof x.vorgabe === 'number') expect(Math.abs(Number(ist)), `${v.nr} ${x.id}`).toBe(Math.abs(x.vorgabe));
        else expect(ist, `${v.nr} ${x.id}`).toBe(x.vorgabe);
        const neu: MaskenWert = typeof x.vorgabe === 'number' ? (Number(ist) < 0 ? Number(ist) - 1 : Number(ist) + 1) : typeof x.vorgabe === 'string' ? '09:15' : !x.vorgabe;
        const k2 = maskeAnwenden(k, e, { ...w, [x.feld]: neu });
        expect(maskeWerte(k2, e)[x.feld], `${v.nr} ${x.id} geändert`).toBe(neu);
        geprueft++;
      }
    }
    expect(geprueft).toBeGreaterThan(40);
  });
  it('Warten: „Höchstens (Stunden)“ und „Arbeitszeit zählen“ stehen im Panel und bleiben beim Ändern eines anderen Felds', () => {
    const e = katalogEintrag('warten.ereignis')!;
    const k: K = { id: fk(50), titel: 'Antwort abwarten', rang: 1, form: 'warten', katalog: { id: e.id }, warten: { art: 'ereignis', ereignis: 'antwort-gesendet', hoechstensTage: 1, hoechstensStunden: 4, arbeitszeit: true } };
    const w = maskeWerte(k, e);
    expect(w).toMatchObject({ hoechstensStunden: 4, arbeitszeit: true });
    const k2 = maskeAnwenden(k, e, { ...w, hoechstensTage: 2 });
    expect(k2.warten).toEqual({ art: 'ereignis', ereignis: 'antwort-gesendet', hoechstensTage: 2, hoechstensStunden: 4, arbeitszeit: true });
    const d = katalogEintrag('warten.dauer')!;
    const k3: K = { id: fk(51), titel: 'Zwei Werktage', rang: 1, form: 'warten', katalog: { id: d.id }, warten: { art: 'dauer', tage: 2, arbeitszeit: true } };
    expect(maskeAnwenden(k3, d, { ...maskeWerte(k3, d), tage: 3 }).warten).toEqual({ art: 'dauer', tage: 3, arbeitszeit: true });
    expect(maskeAnwenden(k3, d, { ...maskeWerte(k3, d), arbeitszeit: false }).warten).toEqual({ art: 'dauer', tage: 2 });
  });
  it('Entscheidung (Mensch): „Entscheiden binnen (Tagen)“ — aus der Maske, für ältere Übernahmen aus dem Knoten; der Motor nimmt die Frist', () => {
    const e = katalogEintrag('entscheidung.mensch')!;
    expect(e.maske.some(f => f.id === 'fristTage')).toBe(true);
    // Altbestand: nur `frist` am Knoten → die Maske zeigt sie, beim Speichern steht sie in den Werten.
    const alt: K = { id: fk(12), elternId: fk(2), titel: 'Passt es?', rang: 3, form: 'entscheidung', frist: 5, katalog: { id: e.id, werte: { frage: 'Passt es?' } }, zweige: { nein: fk(20) } };
    expect(maskeWerte(alt, e).fristTage).toBe(5);
    expect(maskeAnwenden(alt, e, { ...maskeWerte(alt, e), fristTage: 2 }).katalog?.werte?.fristTage).toBe(2);
    const umfeld: LaufUmfeld = { jetzt: J, titel: 'Probe', daten: {} };
    const bis = (k: K) => {
      const def = definition([schritt(10, 'Anrufen', 1), k, schritt(13, 'Fertig', 4, { form: 'ende', ende: { ergebnis: 'erfolg' } }), schritt(20, 'Abgesagt', 5, { form: 'ende', ende: { ergebnis: 'abbruch' } })]);
      const r = starten(leereLaeufe(), { id: 'pl-00000000-0000-4000-8000-000000000001', prozessId: PZ, version: 1, def, fall: { art: 'deal', id: 'ch-probe' }, modus: 'scharf', person: 'pia', ausloeser: { art: 'hand', knoten: fk(3) }, automatisch: false, jetzt: J });
      if (!r.ok) throw new Error(r.grund);
      const l = { ...r.lauf, aktuell: k.id };
      const a = voran(l, def, umfeld).aktion as { bis?: string } | null;
      return a?.bis;
    };
    const tag = (n: number) => new Date(Date.parse(J) + n * 86_400_000).toISOString();
    expect(bis(alt)).toBe(tag(5));
    expect(bis({ ...alt, katalog: { id: e.id, werte: { frage: 'Passt es?', fristTage: 2 } } })).toBe(tag(2));
    // Die Vorlagen tragen sie jetzt auch in der Maske.
    const v08 = KUNDENGEWINNUNG_VORLAGEN.find(v => v.nr === 'V08')!.definition.knoten.find(k => k.id.endsWith(':a6'))!;
    expect(v08.katalog?.werte?.fristTage).toBe(5);
  });
});

// ── Versionen: eine alte Version zurückholen ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const stand = (e: ProzessEintrag) => stabil(e);
const wkx = (): WerkstattKontext => ({ person: 'pia', jetzt: J, rechte: VOLL, standVon: stand, neueKennung: p => kennung(p) });

describe('Versionen: alte Version als neuen Entwurf zurückholen', () => {
  it('der Entwurf wird die alte Fassung; Versionen, Status und die Version neuer Fälle bleiben — dann normal veröffentlichen', () => {
    let e = neuerProzess({ id: PZ, titel: 'Lead-Eingang', bereich: 'sales', fallArt: 'lead', von: 'pia', jetzt: J, kennung: () => kennung('fk') });
    const v1 = veroeffentlichen(e, { name: 'Eins', von: 'pia', jetzt: J });
    if (!v1.ok) throw new Error(v1.fehler);
    e = v1.eintrag;
    const phase = e.entwurf.knoten.find(k => k.elternId && !k.form)!.id;
    e = { ...e, entwurf: { ...e.entwurf, knoten: [...e.entwurf.knoten, schritt(90, 'Nachfassen', 5, {}, phase)] } };
    const v2 = veroeffentlichen(e, { name: 'Zwei', notiz: 'mit Nachfassen', von: 'olaf', jetzt: J });
    if (!v2.ok) throw new Error(v2.fehler);
    e = { ...v2.eintrag, status: 'aktiv', statusAm: J, statusVon: 'pia' };
    const versionenVorher = stabil(e.versionen);
    const datei: ProzesseDatei = { v: 1, prozesse: [e] };
    const r = werkstattAnwenden(datei, { aktion: 'version-uebernehmen', id: PZ, stand: stand(e), nr: 1 }, wkx());
    if (!r.ok) throw new Error(r.fehler);
    expect(stabil(r.eintrag.versionen)).toBe(versionenVorher);
    expect(r.eintrag.status).toBe('aktiv');
    expect(juengsteVersion(r.eintrag)?.nr).toBe(2);
    expect(entwurfGeaendert(r.eintrag)).toBe(true);
    const vg = versionenVergleichen(r.eintrag.versionen[0].definition, r.eintrag.entwurf);
    expect(vg.knoten).toEqual({ neu: [], weg: [], geaendert: [] });
    // Normal veröffentlichen → Version 3 mit dem Inhalt von Version 1.
    const v3 = werkstattAnwenden(r.datei, { aktion: 'veroeffentlichen', id: PZ, stand: stand(r.eintrag), name: 'Zurück zu Eins' }, wkx());
    if (!v3.ok) throw new Error(v3.fehler);
    expect(v3.eintrag.versionen.map(v => v.nr)).toEqual([1, 2, 3]);
    expect(versionenVergleichen(v3.eintrag.versionen[0].definition, v3.eintrag.versionen[2].definition).knoten).toEqual({ neu: [], weg: [], geaendert: [] });
  });
});

// ── Kopie ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Prozess mit allem, was Kennungen trägt: Raute mit Nein-Zweig, Mail (Schloss dahinter), „erneut ab“, Schleife über eine Abfrage, Teilprozess, Zettel. */
function voll(): ProzessDefinition {
  const d = definition([
    schritt(10, 'Leads holen', 1, { form: 'schritt', katalog: { id: 'crm.abfragen' }, abfrage: { art: 'leads', hoechstens: 10 } }),
    schritt(11, 'Passt es?', 2, { form: 'entscheidung', zweige: { nein: fk(20) }, katalog: { id: 'entscheidung.mensch', werte: { frage: 'Passt es?', wer: 'konto-pia', fristTage: 3 } } }),
    schritt(12, 'Mail', 3, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: { postfach: 'pf-00000000-0000-4000-8000-000000000009', an: 'fall.kontakt', betreff: 'Hallo {{kontakt.vorname}}', text: 'Kurz nachgefragt' } } }),
    schritt(13, 'Je Lead', 4, { form: 'schleife', katalog: { id: 'schleife.je-eintrag' }, schleife: { liste: `abfrage:${fk(10)}`, prozessId: PZ2, hoechstens: 10 } }),
    schritt(14, 'Nochmal', 5, { form: 'schritt', katalog: { id: 'lauf.erneut-ab' }, erneut: { ab: fk(11), hoechstens: 2 } }),
    schritt(15, 'Melden', 6, { form: 'nachricht', katalog: { id: 'telegram.hinweis', werte: { an: 'pia', hinweis: 'fertig' } } }),
    schritt(16, 'Glocke', 7, { form: 'nachricht', katalog: { id: 'glocke.melden', werte: { wer: ROLLE_EIGNER, text: 'Fertig' } } }),
    schritt(20, 'Abgesagt', 8, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
  ], { eigner: 'konto-pia', laeuftAls: 'pia', zettel: [{ id: fk(99), text: 'Recht: nur mit Grundlage', pos: { x: 0, y: 0 }, von: 'pia', am: J }] });
  return schlossSetzen(d, { laufFremd: laufFremd(d) }).definition;
}
const eintrag = (d: ProzessDefinition): ProzessEintrag => ({ id: d.id, entwurf: d, versionen: [], status: 'entwurf', angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia' });

describe('Kopieren (rein)', () => {
  it('neue Kennungen überall, Verweise innen folgen, Verweise auf andere Prozesse bleiben, das Original bleibt unverändert', () => {
    const d = voll();
    const vorher = stabil(d);
    const datei: ProzesseDatei = { v: 1, prozesse: [eintrag(d)] };
    const r = prozessKopieren(datei, PZ, kx());
    if (!r.ok) throw new Error(r.fehler);
    expect(stabil(datei.prozesse[0].entwurf)).toBe(vorher);
    expect(r.datei.prozesse).toHaveLength(2);
    const k = r.eintrag.entwurf;
    expect(r.eintrag.id).not.toBe(PZ);
    expect(k.id).toBe(r.eintrag.id);
    expect(k.titel).toBe('Probe (Kopie)');
    expect(k.herkunft).toMatchObject({ art: 'hand', quelleIds: [PZ] });
    const alt = new Set(d.knoten.map(x => x.id));
    const neu = new Set(k.knoten.map(x => x.id));
    for (const x of k.knoten) { expect(alt.has(x.id), x.titel).toBe(false); expect(x.id).toMatch(FK); }
    expect(neu.size).toBe(d.knoten.length);
    for (const x of k.knoten) {
      if (x.elternId) expect(neu.has(x.elternId)).toBe(true);
      for (const z of Object.values(x.zweige ?? {})) expect(neu.has(z!), `${x.titel} → ${z}`).toBe(true);
      if (x.schloss) { expect(neu.has(x.schloss.fuer)).toBe(true); expect(x.id).toBe(schlossKennung(x.schloss.fuer)); }
    }
    const nach = (t: string) => k.knoten.find(x => x.titel === t)!;
    expect(nach('Nochmal').erneut?.ab).toBe(nach('Passt es?').id);
    expect(nach('Je Lead').schleife).toMatchObject({ liste: `abfrage:${nach('Leads holen').id}`, prozessId: PZ2 });
    expect(k.knoten.filter(x => x.schloss).length).toBe(d.knoten.filter(x => x.schloss).length);
    expect(k.zettel?.[0].id).not.toBe(fk(99));
    // Kopie im Haushalt: Eigner, „läuft als“ und Personen bleiben (dasselbe Team).
    expect(k).toMatchObject({ eigner: 'konto-pia', laeuftAls: 'pia' });
  });
  it('Version 1 im Probelauf, wenn nichts offen ist und das Recht reicht — sonst Entwurf; nie scharf; Rechte und Grenzen', () => {
    const d = voll();
    const datei: ProzesseDatei = { v: 1, prozesse: [eintrag(d)] };
    const r = prozessKopieren(datei, PZ, kx());
    if (!r.ok) throw new Error(r.fehler);
    expect(['probelauf', 'entwurf']).toContain(r.eintrag.status);
    expect(r.eintrag.status).not.toBe('aktiv');
    if (r.probelauf) expect(r.eintrag.versionen.map(v => v.name)).toEqual(['Kopie']);
    const b = prozessKopieren(datei, PZ, kx(NUR_BUSINESS));
    expect(b.ok && b.eintrag.status).toBe('entwurf');
    expect(prozessKopieren(datei, PZ, kx(prozessRechte(null)))).toMatchObject({ ok: false, status: 403 });
    expect(prozessKopieren(datei, PZ2, kx())).toMatchObject({ ok: false, status: 404 });
    const voll200: ProzesseDatei = { v: 1, prozesse: Array.from({ length: 200 }, () => eintrag(d)) };
    expect(prozessKopieren(voll200, PZ, kx())).toMatchObject({ ok: false, status: 413 });
  });
  it('mitNeuenKnoten führt auch Werte der Masken, die auf einen Schritt zeigen, mit', () => {
    const d = definition([schritt(10, 'A', 1), schritt(11, 'B', 2, { katalog: { id: 'lauf.erneut-ab', werte: { ab: fk(10) } } })]);
    const { definition: k, karte } = mitNeuenKnoten(d, { id: PZ2, neu: () => kennung('fk') });
    expect(k.knoten.find(x => x.titel === 'B')!.katalog?.werte?.ab).toBe(karte.get(fk(10)));
  });
});

// ── Eigene Vorlagen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Als eigene Vorlage speichern (rein): ohne Personen und Fall-Daten', () => {
  it('kein Eigner, kein „läuft als“, Rollen statt Personen, Postfach des Laufs, Konto leer, Zettel ohne Verfasser, neue Kennungen', () => {
    const d = voll();
    const prozesse: ProzesseDatei = { v: 1, prozesse: [{ ...eintrag(d), versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: d }] }] };
    const r = alsEigeneVorlage(leereEigeneVorlagen(), prozesse, { id: PZ, titel: 'Nachfassen (Vorlage)' }, kx());
    if (!r.ok) throw new Error(r.fehler);
    const v = r.vorlage;
    expect(v.id).toMatch(/^ev-/);
    expect(v.definition.id).toBe(v.id);
    expect(v.definition.eigner).toBeUndefined();
    expect(v.definition.laeuftAls).toBeUndefined();
    expect(v.definition.herkunft).toBeUndefined();
    expect(v.definition.geaendertVon).toBe('');
    const nach = (t: string) => v.definition.knoten.find(x => x.titel === t)!;
    expect(nach('Passt es?').katalog?.werte).toMatchObject({ wer: ROLLE_ZUSTAENDIG, fristTage: 3 });
    expect(nach('Glocke').katalog?.werte?.wer).toBe(ROLLE_EIGNER);
    expect(nach('Mail').katalog?.werte).toMatchObject({ postfach: POSTFACH_DES_LAUFS, betreff: 'Hallo {{kontakt.vorname}}' });
    expect(nach('Melden').katalog?.werte?.an).toBeUndefined();
    expect(v.definition.zettel?.[0]).toEqual({ id: v.definition.zettel![0].id, text: 'Recht: nur mit Grundlage', pos: { x: 0, y: 0 } });
    expect(v.definition.knoten.some(x => d.knoten.some(y => y.id === x.id))).toBe(false);
    const text = JSON.stringify(v.definition);
    expect(text).not.toMatch(/"pia"|konto-pia|pf-00000000/);
    expect(text).not.toContain('versionen');
    expect(r.hinweise.length).toBeGreaterThan(0);
    // Gesäubert gelesen bleibt sie gleich.
    expect(stabil(eigeneVorlagenAus(r.datei).vorlagen[0])).toBe(stabil(v));
  });
  it('übernehmen: neue Kennungen, Herkunft = die Vorlage, Eigner aus dem Fenster; Grenzen und Rechte', () => {
    const d = voll();
    const prozesse: ProzesseDatei = { v: 1, prozesse: [eintrag(d)] };
    const s = alsEigeneVorlage(leereEigeneVorlagen(), prozesse, { id: PZ }, kx());
    if (!s.ok) throw new Error(s.fehler);
    const r = ausEigenerVorlage(prozesse, s.vorlage, { ...kx(), eigner: 'konto-olaf' });
    if (!r.ok) throw new Error(r.fehler);
    expect(r.eintrag.entwurf.herkunft).toMatchObject({ art: 'muster', quelleIds: [s.vorlage.id] });
    expect(r.eintrag.entwurf.eigner).toBe('konto-olaf');
    expect(r.eintrag.entwurf.knoten.some(x => s.vorlage.definition.knoten.some(y => y.id === x.id))).toBe(false);
    expect(ausEigenerVorlage(prozesse, null, kx())).toMatchObject({ ok: false, status: 404 });
    const fuenfzig = { v: 1 as const, vorlagen: Array.from({ length: EIGENE_VORLAGEN_GRENZE }, (): EigeneVorlage => s.vorlage) };
    expect(alsEigeneVorlage(fuenfzig, prozesse, { id: PZ }, kx())).toMatchObject({ ok: false, status: 413 });
    expect(alsEigeneVorlage(leereEigeneVorlagen(), prozesse, { id: PZ, titel: 'x'.repeat(121) }, kx())).toMatchObject({ ok: false, status: 413 });
    expect(eigeneVorlageLoeschen(s.datei, s.vorlage.id, NUR_BUSINESS)).toMatchObject({ ok: false, status: 403 });
    expect(eigeneVorlageLoeschen(s.datei, s.vorlage.id, VOLL)).toMatchObject({ ok: true, datei: { vorlagen: [] } });
    expect(ohnePersonen(d).definition.eigner).toBeUndefined();
  });
});

// ── Route ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type H = (r: Request) => Promise<Response>;
const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
async function rufe(methode: 'GET' | 'POST', k: Record<string, string>, body?: unknown, suche = '') {
  const m = await import('@/app/api/prozesse/werkstatt/route') as unknown as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/prozesse/werkstatt${suche}`, { method: methode, headers: k, ...(methode === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}) }));
  return { status: r.status, j: await r.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('Werkstatt-Route: zurückholen, kopieren, eigene Vorlagen', () => {
  let id = '';
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [
      konto('k1', 'pia', 'inhaber', { haushalt: 'haus-kv' }),
      konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-kv' }),
      konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-kv', finanzRecht: 'business' }),
      konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
    ], einladungen: [] });
    const a = await rufe('POST', kopf('pia'), { aktion: 'anlegen', titel: 'Nachfassen', bereich: 'sales', fallArt: 'deal', anfrageId: 'a-kopie-anlegen-0001' });
    id = a.j.eintrag.id;
    const v1 = await rufe('POST', kopf('pia'), { aktion: 'veroeffentlichen', id, stand: a.j.stand, name: 'Eins' });
    expect(v1.status).toBe(200);
    // Ein Lauf auf Version 1 (nur Kennungen) — darf sich durch Zurückholen und Kopieren nicht ändern.
    await db.saveJson('prozess-laeufe--haus-kv', { v: 1, laeufe: [{ id: 'pl-00000000-0000-4000-8000-000000000001', prozessId: id, version: 1, status: 'wartet' }], stand: {} });
  });

  it('eine alte Version zurückholen: Entwurf = die alte Fassung, Versionen und Läufe unberührt', async () => {
    const g = await rufe('GET', kopf('pia'), undefined, `?id=${id}`);
    const steck = await rufe('POST', kopf('pia'), { aktion: 'steckbrief', id, stand: g.j.stand, felder: { beschreibung: 'Neu beschrieben' } });
    const v2 = await rufe('POST', kopf('pia'), { aktion: 'veroeffentlichen', id, stand: steck.j.stand, name: 'Zwei' });
    expect(v2.j.eintrag.versionen.map((v: { nr: number }) => v.nr)).toEqual([1, 2]);
    const laeufeVorher = JSON.stringify(await (await import('@/lib/store/local-db')).loadJson('prozess-laeufe--haus-kv'));
    const z = await rufe('POST', kopf('olaf'), { aktion: 'version-uebernehmen', id, stand: v2.j.stand, nr: 1 });
    expect(z.status).toBe(200);
    expect(z.j.eintrag.entwurf.beschreibung).toBeUndefined();
    expect(z.j.eintrag.versionen.map((v: { nr: number; von: string }) => [v.nr, v.von])).toEqual([[1, 'pia'], [2, 'pia']]);
    expect(z.j.entwurfGeaendert).toBe(true);
    expect(JSON.stringify(await (await import('@/lib/store/local-db')).loadJson('prozess-laeufe--haus-kv'))).toBe(laeufeVorher);
    const alt = await rufe('GET', kopf('pia'), undefined, `?id=${id}&version=1`);
    expect(alt.j.version).toMatchObject({ nr: 1, name: 'Eins', von: 'pia' });
  });

  it('kopieren: einmalig über die anfrageId, neue Kennungen; Dienstweg und fremder Haushalt → 403', async () => {
    expect((await rufe('POST', dienst('pia'), { aktion: 'kopieren', id, anfrageId: 'a-kopie-0001' })).status).toBe(403);
    expect((await rufe('POST', kopf('gast'), { aktion: 'kopieren', id, anfrageId: 'a-kopie-0001' })).status).toBe(403);
    const k1 = await rufe('POST', kopf('partnerin'), { aktion: 'kopieren', id, anfrageId: 'a-kopie-0002' });
    expect(k1.status).toBe(200);
    const k2 = await rufe('POST', kopf('partnerin'), { aktion: 'kopieren', id, anfrageId: 'a-kopie-0002' });
    expect(k2.j.eintrag.id).toBe(k1.j.eintrag.id);
    expect(k1.j.eintrag.id).not.toBe(id);
    expect(k1.j.eintrag.status).toBe('entwurf'); // „nur Business“ veröffentlicht nicht
    const liste = await rufe('GET', kopf('pia'));
    expect(liste.j.prozesse.filter((p: { quelle: string }) => p.quelle === 'werkstatt')).toHaveLength(2);
  });

  it('als Vorlage speichern → Galerie „Eigene Vorlagen“ → übernehmen → löschen (nur volle Mitglieder); nichts Persönliches im Bestand', async () => {
    const s = await rufe('POST', kopf('partnerin'), { aktion: 'als-vorlage', id, titel: 'Nachfassen · Vorlage', anfrageId: 'a-vorlage-0001' });
    expect(s.status).toBe(200);
    const vid = s.j.vorlage.id;
    const g = await rufe('GET', kopf('pia'), undefined, '?vorlagen=1');
    expect(g.j.eigene).toEqual([expect.objectContaining({ id: vid, titel: 'Nachfassen · Vorlage', bereich: 'sales' })]);
    const det = await rufe('GET', kopf('pia'), undefined, `?vorlage=${vid}`);
    expect(det.j.vorlage).toMatchObject({ id: vid, eigen: true });
    expect(Array.isArray(det.j.vorlage.vorschau)).toBe(true);
    const roh = JSON.stringify(await (await import('@/lib/store/local-db')).loadJson('prozess-vorlagen--haus-kv'));
    expect(roh).not.toMatch(/"(eigner|laeuftAls|versionen)"/);
    const u = await rufe('POST', kopf('olaf'), { aktion: 'aus-vorlage', vorlageId: vid, eigner: 'konto-olaf', anfrageId: 'a-aus-eigener-0001' });
    expect(u.status).toBe(200);
    expect(u.j.eintrag.entwurf.herkunft).toMatchObject({ art: 'muster', quelleIds: [vid] });
    expect((await rufe('GET', kopf('pia'), undefined, '?vorlagen=1')).j.uebernommen[vid]).toBe(u.j.eintrag.id);
    expect((await rufe('POST', kopf('partnerin'), { aktion: 'vorlage-loeschen', vorlageId: vid })).status).toBe(403);
    expect((await rufe('POST', dienst('pia'), { aktion: 'vorlage-loeschen', vorlageId: vid })).status).toBe(403);
    expect((await rufe('POST', kopf('olaf'), { aktion: 'vorlage-loeschen', vorlageId: vid })).status).toBe(200);
    expect((await rufe('GET', kopf('pia'), undefined, '?vorlagen=1')).j.eigene).toEqual([]);
    // Der übernommene Prozess bleibt.
    expect((await rufe('GET', kopf('pia'), undefined, `?id=${u.j.eintrag.id}`)).status).toBe(200);
  });

  it('Sicht Privat → 403; Konto löschen tilgt den Speichernamen in den eigenen Vorlagen', async () => {
    expect((await rufe('GET', kopf('pia'), undefined, '?vorlagen=1&space=privat')).status).toBe(403);
    const s = await rufe('POST', kopf('olaf'), { aktion: 'als-vorlage', id, anfrageId: 'a-vorlage-0002' });
    expect(s.status).toBe(200);
    const { vorlagenKontoLoeschen, eigeneVorlagenLesen } = await import('@/lib/prozesse/eigene-vorlagen-server');
    expect(await vorlagenKontoLoeschen('haus-kv', 'olaf')).toBe(1);
    expect((await eigeneVorlagenLesen('haus-kv')).vorlagen[0].angelegtVon).toBe('[gelöscht]');
  });
});

it('Fixture: leerer Bestand ist ein gültiger Bestand', () => { expect(leerProzesse()).toEqual({ v: 1, prozesse: [] }); });
