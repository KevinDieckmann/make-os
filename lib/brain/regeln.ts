// ─── Brain: Konstitution + Regelregister (Server, 27.09.) ───────────────────
// Kevins Entscheidung 27.09.: eine kurze KONSTITUTION.md (Werte, Rangfolge,
// harte Grenzen — immer geladen) plus einzelne Regel-Notizen mit Frontmatter
// (Priorität 0–3, gilt_fuer, Status), anlegbar in MAKE OS, geladen nach
// Relevanz. Beides lebt als Markdown IM VAULT (Wahrheit bleibt Obsidian,
// Versionen kommen aus dem Git-Repo des Vaults):
//   <Brain>/00. Fundament/KONSTITUTION.md
//   <Brain>/00. Fundament/Regeln/<kennung>.md
// Schreiben tun hier MENSCHEN (Kevin, Malin über die Wissen-Seite). ZOE legt
// Regeln nur als Vorschlag in die Inbox (lib/brain/inbox.ts). Regeln sind — anders
// als gewöhnliche Notizen — Anweisungen an ZOE: darum trägt jede den Namen
// der Person, die sie freigegeben hat, und nur „aktiv“ wird geladen.

import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { BRAIN, leseKopf, darfSehen, bestandVergessen, type Sicht } from '@/lib/zoe/vault';
import { localDay } from '@/lib/zeit';

export type Prioritaet = 0 | 1 | 2 | 3;
export type GiltFuer = 'kevin' | 'malin' | 'beide' | 'zoe';
export type RegelStatus = 'entwurf' | 'aktiv' | 'abgeloest';
export const PRIORITAET_LABEL: Record<Prioritaet, string> = { 0: 'hart', 1: 'Sicherheit & Privatsphäre', 2: 'Haus-Regel', 3: 'Vorliebe' };
export const GILT_LABEL: Record<GiltFuer, string> = { kevin: 'Kevin', malin: 'Malin', beide: 'beide', zoe: 'ZOE' };

export interface Regel {
  id: string; titel: string; text: string; prioritaet: Prioritaet; giltFuer: GiltFuer; status: RegelStatus;
  quelle?: string; scope: string; owner: string;
  erstelltVon: string; erstelltAm: string; geaendertVon: string; geaendertAm: string; freigegebenVon?: string; freigegebenAm?: string;
}
export interface Konstitution { text: string; stand?: string; geaendertVon?: string; geaendertAm?: string; zeilen: number }

export const REGELN_ORDNER = () => join(BRAIN, '00. Fundament', 'Regeln');
export const KONSTITUTION_PFAD = () => join(BRAIN, '00. Fundament', 'KONSTITUTION.md');
export const KONSTITUTION_MAX_ZEILEN = 250;

const wer = (p?: string) => (p && /^[a-z0-9-]{1,40}$/.test(p) ? p : 'kevin');
const prio = (v: unknown): Prioritaet => ([0, 1, 2, 3].includes(Number(v)) ? (Number(v) as Prioritaet) : 2);
const gilt = (v: unknown): GiltFuer => ((['kevin', 'malin', 'beide', 'zoe'] as const).includes(String(v) as GiltFuer) ? (String(v) as GiltFuer) : 'beide');
const status = (v: unknown): RegelStatus => ((['entwurf', 'aktiv', 'abgeloest'] as const).includes(String(v) as RegelStatus) ? (String(v) as RegelStatus) : 'entwurf');
const s = (f: Record<string, string | string[]>, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);
const kennung = (titel: string) => titel.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'regel';
const yaml = (v: string) => (/[:#\[\]{}"']|^\s|\s$/.test(v) ? JSON.stringify(v) : v);

function regelText(r: Regel): string {
  const kopf = [
    'type: regel', `titel: ${yaml(r.titel)}`, `prioritaet: ${r.prioritaet}`, `gilt_fuer: ${r.giltFuer}`, `status: ${r.status}`,
    `scope: ${r.scope}`, `owner: ${r.owner}`, ...(r.quelle ? [`quelle: ${yaml(r.quelle)}`] : []),
    `erstellt_von: ${r.erstelltVon}`, `erstellt_am: ${r.erstelltAm}`, `geaendert_von: ${r.geaendertVon}`, `geaendert_am: ${r.geaendertAm}`,
    ...(r.freigegebenVon ? [`freigegeben_von: ${r.freigegebenVon}`, `freigegeben_am: ${r.freigegebenAm}`] : []),
    `stand: ${r.geaendertAm}`, 'tags: [regel]',
  ];
  return `---\n${kopf.join('\n')}\n---\n\n# ${r.titel}\n\n${r.text.trim()}\n`;
}

function regelAus(id: string, text: string): Regel | null {
  const { kopf, rumpf } = leseKopf(text);
  if (kopf.typ !== 'regel') return null;
  const f = kopf.felder;
  const koerper = rumpf.replace(/^\s*#\s+.+\n/, '').trim();
  return {
    id, titel: s(f, 'titel') ?? basename(id, '.md'), text: koerper, prioritaet: prio(f.prioritaet), giltFuer: gilt(f.gilt_fuer), status: status(f.status),
    quelle: s(f, 'quelle'), scope: kopf.scope ?? 'intern', owner: kopf.owner ?? 'kevin',
    erstelltVon: s(f, 'erstellt_von') ?? 'kevin', erstelltAm: s(f, 'erstellt_am') ?? '', geaendertVon: s(f, 'geaendert_von') ?? s(f, 'erstellt_von') ?? 'kevin', geaendertAm: s(f, 'geaendert_am') ?? s(f, 'stand') ?? '',
    freigegebenVon: s(f, 'freigegeben_von'), freigegebenAm: s(f, 'freigegeben_am'),
  };
}

/** Alle Regeln, die die Sicht sehen darf — hart zuerst, dann neueste. */
export async function regelnLesen(sicht: Sicht): Promise<Regel[]> {
  let dateien: string[] = [];
  try { dateien = (await readdir(REGELN_ORDNER())).filter(f => f.endsWith('.md')); } catch { return []; }
  const raus: Regel[] = [];
  for (const f of dateien) {
    try { const r = regelAus(f, await readFile(join(REGELN_ORDNER(), f), 'utf8')); if (r && darfSehen({ scope: r.scope, owner: r.owner }, sicht)) raus.push(r); } catch { /* überspringen */ }
  }
  return raus.sort((a, b) => a.prioritaet - b.prioritaet || b.geaendertAm.localeCompare(a.geaendertAm));
}

export async function konstitutionLesen(): Promise<Konstitution | null> {
  try {
    const text = await readFile(KONSTITUTION_PFAD(), 'utf8');
    const { kopf, rumpf } = leseKopf(text);
    return { text: rumpf.trim(), stand: kopf.stand, geaendertVon: s(kopf.felder, 'geaendert_von'), geaendertAm: s(kopf.felder, 'geaendert_am'), zeilen: rumpf.trim().split('\n').length };
  } catch { return null; }
}

/** Konstitution schreiben — nur Menschen, höchstens KONSTITUTION_MAX_ZEILEN Zeilen (sie ist immer geladen). */
export async function konstitutionSchreiben(text: string, person: string): Promise<{ ok: boolean; fehler?: string }> {
  const t = text.replace(/\r\n/g, '\n').trim();
  if (!t) return { ok: false, fehler: 'Leer.' };
  if (t.split('\n').length > KONSTITUTION_MAX_ZEILEN) return { ok: false, fehler: `Höchstens ${KONSTITUTION_MAX_ZEILEN} Zeilen — die Konstitution ist immer geladen. Details gehören in Regeln.` };
  const p = wer(person); const heute = localDay();
  const alt = await konstitutionLesen();
  const kopf = `---\ntype: konstitution\nscope: intern\nowner: kevin\nstand: ${heute}\nerstellt_am: ${alt ? (alt.stand ?? heute) : heute}\ngeaendert_von: ${p}\ngeaendert_am: ${heute}\ntags: [konstitution, regel]\n---\n\n`;
  try { await mkdir(join(BRAIN, '00. Fundament'), { recursive: true }); await writeFile(KONSTITUTION_PFAD(), kopf + t + '\n', 'utf8'); bestandVergessen(); return { ok: true }; }
  catch (err) { return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 160) : 'nicht schreibbar' }; }
}

export interface NeueRegel { titel: string; text: string; prioritaet?: Prioritaet; giltFuer?: GiltFuer; status?: RegelStatus; quelle?: string; scope?: 'intern' | 'privat' }

/** Regel anlegen (Mensch). `status: aktiv` gilt als Freigabe durch diese Person. */
export async function regelAnlegen(neu: NeueRegel, person: string): Promise<{ ok: boolean; id?: string; fehler?: string }> {
  const titel = neu.titel.trim().slice(0, 120); const text = neu.text.trim().slice(0, 4000);
  if (!titel || !text) return { ok: false, fehler: 'Titel und Text sind Pflicht.' };
  const p = wer(person); const heute = localDay();
  const st = status(neu.status ?? 'entwurf');
  const r: Regel = { id: '', titel, text, prioritaet: prio(neu.prioritaet), giltFuer: gilt(neu.giltFuer), status: st, quelle: neu.quelle?.trim().slice(0, 200) || undefined,
    scope: neu.scope === 'privat' ? 'privat' : 'intern', owner: p, erstelltVon: p, erstelltAm: heute, geaendertVon: p, geaendertAm: heute, ...(st === 'aktiv' ? { freigegebenVon: p, freigegebenAm: heute } : {}) };
  try {
    await mkdir(REGELN_ORDNER(), { recursive: true });
    let id = `${kennung(titel)}.md`;
    for (let i = 2; i < 50; i++) { try { await readFile(join(REGELN_ORDNER(), id)); id = `${kennung(titel)}-${i}.md`; } catch { break; } }
    r.id = id;
    await writeFile(join(REGELN_ORDNER(), id), regelText(r), { encoding: 'utf8', flag: 'wx' });
    bestandVergessen();
    return { ok: true, id };
  } catch (err) { return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 160) : 'nicht schreibbar' }; }
}

/** Regel ändern (Mensch): Felder überschreiben, Status wechseln (aktiv = Freigabe durch diese Person, abgelöst bleibt lesbar). */
export async function regelAendern(id: string, felder: Partial<NeueRegel>, person: string, sicht: Sicht): Promise<{ ok: boolean; fehler?: string; regel?: Regel }> {
  if (!/^[a-z0-9-]+\.md$/.test(id)) return { ok: false, fehler: 'Ungültige Kennung.' };
  const pfad = join(REGELN_ORDNER(), id);
  let alt: Regel | null = null;
  try { alt = regelAus(id, await readFile(pfad, 'utf8')); } catch { return { ok: false, fehler: 'Regel nicht gefunden.' }; }
  if (!alt || !darfSehen({ scope: alt.scope, owner: alt.owner }, sicht)) return { ok: false, fehler: 'Regel nicht gefunden.' };
  const p = wer(person); const heute = localDay();
  const st = felder.status ? status(felder.status) : alt.status;
  const neu: Regel = { ...alt,
    ...(felder.titel?.trim() ? { titel: felder.titel.trim().slice(0, 120) } : {}), ...(felder.text?.trim() ? { text: felder.text.trim().slice(0, 4000) } : {}),
    ...(felder.prioritaet !== undefined ? { prioritaet: prio(felder.prioritaet) } : {}), ...(felder.giltFuer ? { giltFuer: gilt(felder.giltFuer) } : {}),
    ...(felder.quelle !== undefined ? { quelle: felder.quelle.trim().slice(0, 200) || undefined } : {}), status: st, geaendertVon: p, geaendertAm: heute,
    ...(st === 'aktiv' && alt.status !== 'aktiv' ? { freigegebenVon: p, freigegebenAm: heute } : {}) };
  try { await writeFile(pfad, regelText(neu), 'utf8'); bestandVergessen(); return { ok: true, regel: neu }; }
  catch (err) { return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 160) : 'nicht schreibbar' }; }
}

/** Regel in den Ordner „abgelöst“ verschieben (löschen gibt es nicht — Regeln sind Geschichte). */
export async function regelArchivieren(id: string, person: string, sicht: Sicht): Promise<{ ok: boolean; fehler?: string }> {
  const r = await regelAendern(id, { status: 'abgeloest' }, person, sicht);
  if (!r.ok) return r;
  try { await mkdir(join(REGELN_ORDNER(), '_abgeloest'), { recursive: true }); await rename(join(REGELN_ORDNER(), id), join(REGELN_ORDNER(), '_abgeloest', id)); bestandVergessen(); return { ok: true }; }
  catch (err) { return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 160) : 'nicht verschiebbar' }; }
}

/**
 * Was in JEDEN ZOE-Prompt geht: die Konstitution (ganz) und die aktiven Regeln, die
 * für diese Person gelten (oder für ZOE selbst) — hart zuerst, gedeckelt. Rein.
 */
export function regelnBlock(konstitution: Konstitution | null, regeln: Regel[], person: string, maxZeichen = 6000): string {
  const passende = regeln.filter(r => r.status === 'aktiv' && (r.giltFuer === 'beide' || r.giltFuer === 'zoe' || r.giltFuer === person)).sort((a, b) => a.prioritaet - b.prioritaet);
  const teile: string[] = [];
  if (konstitution?.text) teile.push(`── KONSTITUTION (gilt immer; Rangfolge: hart > Sicherheit/Privatsphäre > Haus-Regel > Vorliebe) ──\n${konstitution.text}`);
  if (passende.length) teile.push(`── REGELN (aktiv, freigegeben) ──\n` + passende.map(r => `- [P${r.prioritaet} · ${GILT_LABEL[r.giltFuer]}${r.freigegebenVon ? ` · freigegeben von ${r.freigegebenVon}` : ''}] ${r.titel}: ${r.text.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n'));
  const text = teile.join('\n\n');
  return text.length > maxZeichen ? `${text.slice(0, maxZeichen)}\n[… Regelblock gekürzt]` : text;
}

/** Konstitution + Regeln für eine Person laden und als Block liefern (leer, wenn nichts da ist). */
export async function regelnFuerPrompt(person: string): Promise<string> {
  const [k, r] = await Promise.all([konstitutionLesen(), regelnLesen({ person: wer(person) })]);
  return regelnBlock(k, r, wer(person));
}
