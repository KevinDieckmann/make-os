// ─── Brain-Inbox: Vorschläge von Jarvis mit Freigabe (Server, 27.09.) ───────
// Kevins Entscheidung 27.09.: Jarvis schreibt frei nur sein Episoden-Log
// (Jarvis_Log); alles andere — neue Notizen, Ergänzungen, Regeln — legt er als
// VORSCHLAG ab: <Brain>/_inbox/jarvis/<datum>-<kennung>.md mit Begründung und
// Quelle. Kevin oder Malin nehmen an (dann entsteht die Notiz / der Update-Block
// / die Regel — mit Provenienz) oder lehnen ab (Vorschlag wandert nach
// _inbox/abgelehnt, der Grund bleibt dran). _inbox ist aus der Suche
// ausgeschlossen: ein Vorschlag ist kein Wissen, bis ihn ein Mensch freigibt.

import { readFile, writeFile, mkdir, readdir, rename, appendFile, access } from 'node:fs/promises';
import { join, basename, dirname, relative, sep } from 'node:path';
import { BRAIN, leseKopf, darfSehen, bestand, bestandVergessen, type Sicht } from '@/lib/jarvis/vault';
import { regelAnlegen, type Prioritaet, type GiltFuer } from './regeln';
import { localDay } from '@/lib/zeit';

export type Ziel = 'neu' | 'ergaenzung' | 'regel';
export type Vertraulichkeit = 'gemeinsam' | 'privat-kevin' | 'privat-malin';
export interface Vorschlag {
  id: string; titel: string; text: string; ziel: Ziel;
  /** Bei „ergaenzung“: Titel oder Kennung der Zielnotiz; bei „neu“: Zielordner (relativ zum Brain). */
  zielNotiz?: string; zielOrdner?: string;
  begruendung: string; quelle: string; vertraulichkeit: Vertraulichkeit;
  erstelltVon: string; erstelltAm: string; status: 'offen' | 'angenommen' | 'abgelehnt';
  entschiedenVon?: string; entschiedenAm?: string; grund?: string;
  /** Bei Regel-Vorschlägen. */
  prioritaet?: Prioritaet; giltFuer?: GiltFuer;
}
export interface NeuerVorschlag { titel: string; text: string; ziel: Ziel; zielNotiz?: string; zielOrdner?: string; begruendung: string; quelle: string; vertraulichkeit?: Vertraulichkeit; prioritaet?: Prioritaet; giltFuer?: GiltFuer; erstelltVon?: string }

export const INBOX = () => join(BRAIN, '_inbox', 'jarvis');
const ERLEDIGT = () => join(BRAIN, '_inbox', 'erledigt');
const ABGELEHNT = () => join(BRAIN, '_inbox', 'abgelehnt');
const PROTOKOLLE = join('03. Protokolle', 'Protokolle');

const s = (f: Record<string, string | string[]>, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);
const yaml = (v: string) => (/[:#\[\]{}"']|^\s|\s$/.test(v) ? JSON.stringify(v) : v);
const kennung = (t: string) => t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'vorschlag';
const ziel = (v: unknown): Ziel => ((['neu', 'ergaenzung', 'regel'] as const).includes(String(v) as Ziel) ? (String(v) as Ziel) : 'neu');
const vertr = (v: unknown): Vertraulichkeit => ((['gemeinsam', 'privat-kevin', 'privat-malin'] as const).includes(String(v) as Vertraulichkeit) ? (String(v) as Vertraulichkeit) : 'gemeinsam');
const sicherRel = (p?: string) => { const r = String(p ?? '').replace(/\\/g, '/').replace(/^\/+/, ''); return r && !r.split('/').some(t => t === '..' || t.startsWith('.')) ? r : ''; };

function vorschlagText(v: Vorschlag): string {
  const kopf = [
    'type: vorschlag', `titel: ${yaml(v.titel)}`, `ziel: ${v.ziel}`, ...(v.zielNotiz ? [`ziel_notiz: ${yaml(v.zielNotiz)}`] : []), ...(v.zielOrdner ? [`ziel_ordner: ${yaml(v.zielOrdner)}`] : []),
    `begruendung: ${yaml(v.begruendung)}`, `quelle: ${yaml(v.quelle)}`, `vertraulichkeit: ${v.vertraulichkeit}`,
    ...(v.prioritaet !== undefined ? [`prioritaet: ${v.prioritaet}`] : []), ...(v.giltFuer ? [`gilt_fuer: ${v.giltFuer}`] : []),
    `erstellt_von: ${v.erstelltVon}`, `erstellt_am: ${v.erstelltAm}`, `status: ${v.status}`,
    ...(v.entschiedenVon ? [`entschieden_von: ${v.entschiedenVon}`, `entschieden_am: ${v.entschiedenAm}`] : []), ...(v.grund ? [`grund: ${yaml(v.grund)}`] : []),
    'tags: [vorschlag, jarvis]',
  ];
  return `---\n${kopf.join('\n')}\n---\n\n# ${v.titel}\n\n${v.text.trim()}\n`;
}

function vorschlagAus(id: string, text: string): Vorschlag | null {
  const { kopf, rumpf } = leseKopf(text);
  if (kopf.typ !== 'vorschlag') return null;
  const f = kopf.felder;
  return {
    id, titel: s(f, 'titel') ?? basename(id, '.md'), text: rumpf.replace(/^\s*#\s+.+\n/, '').trim(), ziel: ziel(f.ziel), zielNotiz: s(f, 'ziel_notiz'), zielOrdner: s(f, 'ziel_ordner'),
    begruendung: s(f, 'begruendung') ?? '', quelle: s(f, 'quelle') ?? '', vertraulichkeit: vertr(f.vertraulichkeit),
    prioritaet: f.prioritaet !== undefined && [0, 1, 2, 3].includes(Number(f.prioritaet)) ? (Number(f.prioritaet) as Prioritaet) : undefined,
    giltFuer: (['kevin', 'malin', 'beide', 'jarvis'] as const).includes(String(f.gilt_fuer) as GiltFuer) ? (String(f.gilt_fuer) as GiltFuer) : undefined,
    erstelltVon: s(f, 'erstellt_von') ?? 'jarvis', erstelltAm: s(f, 'erstellt_am') ?? '', status: (['offen', 'angenommen', 'abgelehnt'] as const).find(x => x === s(f, 'status')) ?? 'offen',
    entschiedenVon: s(f, 'entschieden_von'), entschiedenAm: s(f, 'entschieden_am'), grund: s(f, 'grund'),
  };
}

/** Sieht diese Person den Vorschlag? privat-kevin nur Kevin, privat-malin nur Malin, gemeinsam beide. */
export function darfVorschlagSehen(v: Pick<Vorschlag, 'vertraulichkeit'>, sicht: Sicht): boolean {
  if (sicht.agent) return v.vertraulichkeit === 'gemeinsam';
  if (v.vertraulichkeit === 'gemeinsam') return sicht.person === 'kevin' || sicht.person === 'malin';
  return v.vertraulichkeit === `privat-${sicht.person}`;
}

/** Vorschlag ablegen (Jarvis oder ein Lauf). Gleicher Titel am selben Tag = derselbe Vorschlag (kein Zweiter). */
export async function vorschlagAblegen(neu: NeuerVorschlag): Promise<{ ok: boolean; id?: string; schonDa?: boolean; fehler?: string }> {
  const titel = neu.titel.trim().slice(0, 120); const text = neu.text.trim().slice(0, 8000);
  if (!titel || !text) return { ok: false, fehler: 'Titel und Text sind Pflicht.' };
  const heute = localDay();
  const id = `${heute}-${kennung(titel)}.md`;
  const v: Vorschlag = { id, titel, text, ziel: ziel(neu.ziel), zielNotiz: neu.zielNotiz?.trim().slice(0, 160) || undefined, zielOrdner: sicherRel(neu.zielOrdner) || undefined,
    begruendung: neu.begruendung.trim().slice(0, 600), quelle: neu.quelle.trim().slice(0, 300), vertraulichkeit: vertr(neu.vertraulichkeit),
    ...(neu.prioritaet !== undefined ? { prioritaet: neu.prioritaet } : {}), ...(neu.giltFuer ? { giltFuer: neu.giltFuer } : {}),
    erstelltVon: neu.erstelltVon && /^[a-z0-9-]{1,40}$/.test(neu.erstelltVon) ? neu.erstelltVon : 'jarvis', erstelltAm: heute, status: 'offen' };
  try {
    await mkdir(INBOX(), { recursive: true });
    try { await access(join(INBOX(), id)); return { ok: true, id, schonDa: true }; } catch { /* neu */ }
    await writeFile(join(INBOX(), id), vorschlagText(v), { encoding: 'utf8', flag: 'wx' });
    return { ok: true, id };
  } catch (err) { return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 160) : 'nicht schreibbar' }; }
}

/** Offene Vorschläge, die die Sicht sehen darf — neueste zuerst. */
export async function vorschlaegeLesen(sicht: Sicht, welche: 'offen' | 'erledigt' | 'abgelehnt' = 'offen'): Promise<Vorschlag[]> {
  const ordner = welche === 'offen' ? INBOX() : welche === 'erledigt' ? ERLEDIGT() : ABGELEHNT();
  let dateien: string[] = [];
  try { dateien = (await readdir(ordner)).filter(f => f.endsWith('.md')); } catch { return []; }
  const raus: Vorschlag[] = [];
  for (const f of dateien) { try { const v = vorschlagAus(f, await readFile(join(ordner, f), 'utf8')); if (v && darfVorschlagSehen(v, sicht)) raus.push(v); } catch { /* überspringen */ } }
  return raus.sort((a, b) => b.id.localeCompare(a.id));
}

async function verschiebe(v: Vorschlag, nach: string): Promise<void> {
  await mkdir(nach, { recursive: true });
  await writeFile(join(INBOX(), v.id), vorschlagText(v), 'utf8');
  await rename(join(INBOX(), v.id), join(nach, v.id));
}

const zwei = (n: number) => String(n).padStart(2, '0');
const heuteDE = () => { const d = new Date(); return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`; };

/**
 * Annehmen: aus dem Vorschlag wird Wissen — mit Provenienz (erstellt_von jarvis, freigegeben_von Mensch).
 *  neu        → neue Notiz im Zielordner (Standard: Protokolle), Frontmatter nach AGENTS.md §3
 *  ergaenzung → datierter „## 🔴 UPDATE“-Block an der Zielnotiz (nur, wenn die Person sie sehen darf)
 *  regel      → Regel (aktiv, freigegeben von der Person) im Regelregister
 */
export async function vorschlagAnnehmen(id: string, person: string, sicht: Sicht, opt: { zielNotiz?: string; zielOrdner?: string } = {}): Promise<{ ok: boolean; fehler?: string; ergebnis?: string }> {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+\.md$/.test(id)) return { ok: false, fehler: 'Ungültige Kennung.' };
  let v: Vorschlag | null = null;
  try { v = vorschlagAus(id, await readFile(join(INBOX(), id), 'utf8')); } catch { return { ok: false, fehler: 'Vorschlag nicht (mehr) offen.' }; }
  if (!v || !darfVorschlagSehen(v, sicht)) return { ok: false, fehler: 'Vorschlag nicht gefunden.' };
  const p = /^[a-z0-9-]{1,40}$/.test(person) ? person : 'kevin';
  const heute = localDay();
  const scope = v.vertraulichkeit === 'gemeinsam' ? 'intern' : 'privat';
  const owner = v.vertraulichkeit === 'privat-malin' ? 'malin' : 'kevin';
  let ergebnis = '';
  try {
    if (v.ziel === 'regel') {
      const r = await regelAnlegen({ titel: v.titel, text: v.text, prioritaet: v.prioritaet, giltFuer: v.giltFuer, status: 'aktiv', quelle: `Vorschlag von ${v.erstelltVon} (${v.erstelltAm}): ${v.quelle}`.slice(0, 200), scope: scope as 'intern' | 'privat' }, p);
      if (!r.ok) return { ok: false, fehler: r.fehler };
      ergebnis = `Regel „${v.titel}“ angelegt (aktiv, freigegeben von ${p}).`;
    } else if (v.ziel === 'ergaenzung') {
      const zielName = (opt.zielNotiz ?? v.zielNotiz ?? '').trim();
      if (!zielName) return { ok: false, fehler: 'Zielnotiz fehlt.' };
      const b = await bestand(true);
      const klein = zielName.toLowerCase().replace(/^\[\[|\]\]$/g, '');
      const n = b.notizen.find(x => x.wurzel === 'make' && (x.id === zielName || x.titel.toLowerCase() === klein || x.id.toLowerCase().endsWith(klein)) && darfSehen(x, sicht));
      if (!n) return { ok: false, fehler: `Zielnotiz „${zielName}“ nicht gefunden oder nicht sichtbar.` };
      await appendFile(n.pfad, `\n\n## 🔴 UPDATE ${heuteDE()} · Vorschlag von ${v.erstelltVon}, freigegeben von ${p}\n\n${v.text.trim()}\n\n*Quelle: ${v.quelle || '—'} · Begründung: ${v.begruendung || '—'}*\n`, 'utf8');
      ergebnis = `An „${n.titel}“ angehängt (Update-Block, freigegeben von ${p}).`;
    } else {
      const ordner = sicherRel(opt.zielOrdner ?? v.zielOrdner) || PROTOKOLLE;
      const name = v.titel.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100);
      const pfad = join(BRAIN, ordner, `${heute} ${name}.md`);
      if (!pfad.startsWith(BRAIN + sep)) return { ok: false, fehler: 'Zielordner liegt außerhalb des Brains.' };
      await mkdir(dirname(pfad), { recursive: true });
      const kopf = `---\ntype: notiz\nscope: ${scope}\nowner: ${owner}\nstand: ${heute}\nerstellt_von: ${v.erstelltVon}\nerstellt_am: ${v.erstelltAm}\nfreigegeben_von: ${p}\nfreigegeben_am: ${heute}\nquelle: ${yaml(v.quelle || 'Vorschlag')}\ntags: [jarvis, freigegeben]\n---\n\n# ${name}\n\n`;
      await writeFile(pfad, `${kopf}${v.text.trim()}\n\n*Begründung des Vorschlags: ${v.begruendung || '—'}*\n`, { encoding: 'utf8', flag: 'wx' });
      ergebnis = `Notiz „${name}“ angelegt in ${ordner} (freigegeben von ${p}).`;
    }
    await verschiebe({ ...v, status: 'angenommen', entschiedenVon: p, entschiedenAm: heute }, ERLEDIGT());
    bestandVergessen();
    return { ok: true, ergebnis };
  } catch (err) { return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 160) : 'nicht schreibbar' }; }
}

export async function vorschlagAblehnen(id: string, person: string, sicht: Sicht, grund?: string): Promise<{ ok: boolean; fehler?: string }> {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+\.md$/.test(id)) return { ok: false, fehler: 'Ungültige Kennung.' };
  let v: Vorschlag | null = null;
  try { v = vorschlagAus(id, await readFile(join(INBOX(), id), 'utf8')); } catch { return { ok: false, fehler: 'Vorschlag nicht (mehr) offen.' }; }
  if (!v || !darfVorschlagSehen(v, sicht)) return { ok: false, fehler: 'Vorschlag nicht gefunden.' };
  const p = /^[a-z0-9-]{1,40}$/.test(person) ? person : 'kevin';
  try { await verschiebe({ ...v, status: 'abgelehnt', entschiedenVon: p, entschiedenAm: localDay(), grund: grund?.trim().slice(0, 300) || undefined }, ABGELEHNT()); return { ok: true }; }
  catch (err) { return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 160) : 'nicht verschiebbar' }; }
}

/** Relative Kennung einer Datei im Brain (für Links). */
export const brainRel = (pfad: string) => relative(dirname(BRAIN), pfad).split(sep).join('/');
