// ─── Brain: nächtliche Konsolidierung (Server, 27.09.) ──────────────────────
// Kevins Entscheidung 27.09.: nächtlich, Vorschläge morgens in der Brain-Inbox.
// Der Lauf liest, was der Tag hinterlassen hat — neue Fakten im Gedächtnis,
// das ZOE-Log, heute geänderte Protokolle — und verdichtet es zu höchstens
// fünf Vorschlägen (neue Notiz, Ergänzung einer bestehenden, Regel), jeder mit
// Begründung und Quelle. Er schreibt NUR in die Inbox (lib/brain/inbox.ts);
// annehmen tun Menschen. Ohne KI-Guthaben läuft er als Regelwerk: ein Vorschlag
// „Fakten vom <Tag>“ mit allem Neuen. Riegel: Bestand brain-konsolidierung
// (letzter Tag), der Takt fragt ihn (lib/zoe/takt.ts).
// 29.09. (B2): zuerst die Brücke App → Brain — ein Vorschlag „App-Tagesbericht“ (lib/brain/app-bericht.ts) und der
// _App-Spiegel im Server-Vault (lib/brain/app-spiegel.ts). Beide schreiben nur in einen konfigurierten Server-Vault.

import { askText, hasAnthropicKey, guthabenLeer, fremd, FREMD_REGEL, extractJson } from '@/lib/anthropic';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { lies as fakten, type Fakt } from '@/lib/zoe/gedaechtnis';
import { bestand, notiz, obersterBlock, AGENT } from '@/lib/zoe/vault';
import { vorschlaegeLesen, vorschlagAblegen, type NeuerVorschlag } from './inbox';
import { localDay } from '@/lib/zeit';

export const RIEGEL = 'brain-konsolidierung';
export interface KonsolidierungStand { letzterTag?: string; letzterLauf?: string; letztesErgebnis?: string }
export interface Ergebnis { ok: boolean; abgelegt: number; schonDa: number; ohneKi: boolean; text: string; /** App → Brain (29.09.): Tagesbericht + _App-Spiegel. */ app?: string }

const STUNDE = 3_600_000;

/** Was der Tag hinterlassen hat — rein, damit der Fall „nichts Neues“ testbar bleibt. */
export function tagesernte(alleFakten: Fakt[], jetzt: string, stundenZurueck = 26): Fakt[] {
  const ab = Date.parse(jetzt) - stundenZurueck * STUNDE;
  return alleFakten.filter(f => !f.geloeschtAm && Date.parse(f.zeit) >= ab);
}

/** Was der Lauf überhaupt verarbeiten darf: nur Fakten des gemeinsamen Raums (rein). Persönliche Räume bleiben im Gedächtnis. */
export function nurGemeinsam(fakten: Fakt[]): Fakt[] {
  return fakten.filter(f => f.raum === 'gemeinsam');
}

/** Regelwerk ohne KI: ein Vorschlag mit den neuen Fakten (nur gemeinsame Räume; Persönliches bleibt im Gedächtnis). */
export function regelVorschlag(neu: Fakt[], heute: string): NeuerVorschlag | null {
  // Sicht-Prüfung 08.10.: NUR der gemeinsame Raum. Vorher zählte der Raum „kevin“ mit (aus der Zeit mit einem Konto) — so
  // landeten persönliche Fakten einer Person als „gemeinsam“ in der Brain-Inbox, sichtbar für die andere.
  const gemeinsam = nurGemeinsam(neu);
  if (!gemeinsam.length) return null;
  const zeilen = gemeinsam.slice(0, 40).map(f => `- **${f.thema}** (${f.art}): ${f.satz}${f.woher ? ` — _${f.woher}_` : ''}`);
  return { titel: `Fakten vom ${heute}`, text: `ZOE hat sich gestern Folgendes gemerkt. Was davon ins Brain gehört, bitte annehmen (als Protokoll) — oder ablehnen.\n\n${zeilen.join('\n')}`,
    ziel: 'neu', zielOrdner: '03. Protokolle/Protokolle', begruendung: 'Regelwerk ohne KI: neue Gedächtnis-Einträge des Tages, unverdichtet.', quelle: 'ZOE-Gedächtnis', vertraulichkeit: 'gemeinsam', erstelltVon: 'zoe' };
}

/** Die Brücke App → Brain im nächtlichen Lauf: Tagesbericht (Vorschlag) und _App-Spiegel (direkt, falls eingeschaltet). */
async function appInsBrain(heute: string): Promise<string> {
  const teile: string[] = [];
  try { teile.push((await (await import('./app-bericht')).appTagesbericht(heute)).text); } catch (e) { teile.push(`Tagesbericht: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`); }
  try { teile.push((await (await import('./app-spiegel')).appSpiegel({ erzwingen: true, heute })).text); } catch (e) { teile.push(`_App-Spiegel: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`); }
  return teile.join(' · ');
}

interface ModellVorschlag { titel?: string; text?: string; ziel?: string; ziel_notiz?: string; begruendung?: string; quelle?: string; vertraulichkeit?: string; prioritaet?: number; gilt_fuer?: string }

/** Der Lauf. `erzwingen` übergeht den Tages-Riegel (Knopf auf der Wissen-Seite). */
export async function konsolidieren(jetzt = new Date().toISOString(), erzwingen = false): Promise<Ergebnis> {
  const heute = localDay(new Date(jetzt));
  const riegel = (await loadJson<KonsolidierungStand>(RIEGEL)) ?? {};
  if (!erzwingen && riegel.letzterTag === heute) return { ok: true, abgelegt: 0, schonDa: 0, ohneKi: false, text: 'heute schon gelaufen' };
  // App → Brain (29.09., B2): Tagesbericht als Vorschlag in der Inbox + _App-Spiegel (nur mit Server-Vault; wirft nie).
  const app = await appInsBrain(heute);
  const alle = await fakten({ anzahl: 500 }).catch(() => [] as Fakt[]);
  const neu = nurGemeinsam(tagesernte(alle, jetzt)); // auch fürs Modell nur der gemeinsame Raum (08.10.)
  const offen = await vorschlaegeLesen(AGENT).catch(() => []);
  const merke = async (e: Omit<Ergebnis, 'ok'>) => { await updateJson<KonsolidierungStand>(RIEGEL, cur => ({ ...(cur ?? {}), letzterTag: heute, letzterLauf: jetzt, letztesErgebnis: `${e.text} · ${app}` })); return { ok: true, ...e, app }; };

  if (!hasAnthropicKey() || guthabenLeer()) {
    const v = regelVorschlag(neu, heute);
    if (!v) return merke({ abgelegt: 0, schonDa: 0, ohneKi: true, text: 'Regelwerk: nichts Neues im Gedächtnis.' });
    const r = await vorschlagAblegen(v);
    return merke({ abgelegt: r.ok && !r.schonDa ? 1 : 0, schonDa: r.schonDa ? 1 : 0, ohneKi: true, text: r.ok ? `Regelwerk: ${neu.length} Fakten als ein Vorschlag abgelegt.` : `Regelwerk: ${r.fehler}` });
  }

  // Mit KI: Log-Ende, heute geänderte Protokolle, neue Fakten → höchstens fünf Vorschläge.
  const log = await notiz('Zoe_Log', 5000, AGENT).catch(() => null);
  const b = await bestand().catch(() => null);
  const ab = Date.parse(jetzt) - 26 * STUNDE;
  const protokolle = (b?.notizen ?? []).filter(n => n.wurzel === 'make' && n.typ === 'protokoll' && Date.parse(n.geaendert) >= ab && n.scope !== 'privat').slice(0, 5);
  const protokollTexte: string[] = [];
  for (const p of protokolle) { const d = await notiz(p.id, 3000, AGENT).catch(() => null); if (d?.ok && d.text) protokollTexte.push(`PROTOKOLL ${d.titel}\n${(d.oben || obersterBlock(d.text) || d.text).slice(0, 2500)}`); }
  const material = [
    neu.length ? `NEUE FAKTEN (${neu.length}):\n` + neu.slice(0, 60).map(f => `- [${f.art}] ${f.thema}: ${f.satz}${f.woher ? ` (${f.woher})` : ''}`).join('\n') : 'NEUE FAKTEN: keine',
    log?.ok && log.text ? `ZOE-LOG (Ende):\n${log.text.slice(-3500)}` : '',
    protokollTexte.join('\n\n'),
    offen.length ? `SCHON OFFEN IN DER INBOX (nicht noch einmal vorschlagen):\n` + offen.map(v => `- ${v.titel}`).join('\n') : '',
  ].filter(Boolean).join('\n\n');
  if (!neu.length && !protokollTexte.length) return merke({ abgelegt: 0, schonDa: 0, ohneKi: false, text: 'Nichts Neues zu verdichten.' });

  const system = [
    'Du bist der nächtliche Konsolidierungs-Lauf des Brains von Kevin und Malin (MAKE OS). Du liest, was der Tag hinterlassen hat, und machst daraus höchstens FÜNF Vorschläge für das Wissens-Brain.',
    'Ein Vorschlag ist entweder eine NEUE Notiz (ziel "neu"), eine ERGÄNZUNG einer bestehenden Notiz (ziel "ergaenzung", ziel_notiz = Titel) oder eine REGEL (ziel "regel", prioritaet 0–3, gilt_fuer kevin|malin|beide|zoe) — nur, wenn etwas mehrfach oder ausdrücklich als Regel gesagt wurde.',
    'Jeder Vorschlag trägt eine Begründung (warum das ins Brain gehört) und die Quelle (welcher Fakt, welches Protokoll). Vertraulichkeit: "gemeinsam", wenn es beide betrifft; "privat-kevin"/"privat-malin", wenn es nur eine Person angeht.',
    'Nichts erfinden, nichts verallgemeinern. Widersprüche zu dem, was im Material steht, nennst du als eigenen Vorschlag mit ziel "ergaenzung". Findest du nichts Belastbares, gib eine leere Liste zurück.',
    'Antworte NUR als JSON: {"vorschlaege":[{"titel":"…","text":"… (Markdown, knapp)","ziel":"neu|ergaenzung|regel","ziel_notiz":"…","begruendung":"…","quelle":"…","vertraulichkeit":"gemeinsam|privat-kevin|privat-malin","prioritaet":2,"gilt_fuer":"beide"}]}',
    FREMD_REGEL,
  ].join('\n');
  // Datenschutz (05.10.): der nächtliche Lauf ist Hintergrund-KI (Schalter, Pseudonymisierung der Kontaktnamen); gesperrt → Regelwerk.
  const r = await askText({ zweck: 'brain-konsolidierung', system, user: fremd('tagesmaterial', material), maxTokens: 3000, timeoutMs: 150_000,
    ki: { lauf: erzwingen ? 'aufruf' : 'hintergrund', person: null, kategorien: ['brain', 'allgemein'] } });
  if (!r.ok) {
    const v = regelVorschlag(neu, heute);
    const a = v ? await vorschlagAblegen(v) : null;
    return merke({ abgelegt: a?.ok && !a.schonDa ? 1 : 0, schonDa: a?.schonDa ? 1 : 0, ohneKi: true, text: `KI nicht erreichbar (${r.error ?? r.status}) — Regelwerk${a ? '' : ', nichts Neues'}.` });
  }
  const d = extractJson<{ vorschlaege?: ModellVorschlag[] }>(r.text);
  const liste = Array.isArray(d?.vorschlaege) ? d!.vorschlaege!.slice(0, 5) : [];
  let abgelegt = 0, schonDa = 0;
  for (const v of liste) {
    if (!v?.titel || !v.text) continue;
    const a = await vorschlagAblegen({ titel: String(v.titel), text: String(v.text), ziel: v.ziel === 'ergaenzung' || v.ziel === 'regel' ? v.ziel : 'neu', zielNotiz: v.ziel_notiz ? String(v.ziel_notiz) : undefined,
      begruendung: String(v.begruendung ?? ''), quelle: String(v.quelle ?? 'Konsolidierung'), vertraulichkeit: v.vertraulichkeit === 'privat-kevin' || v.vertraulichkeit === 'privat-malin' ? v.vertraulichkeit : 'gemeinsam',
      prioritaet: [0, 1, 2, 3].includes(Number(v.prioritaet)) ? (Number(v.prioritaet) as 0 | 1 | 2 | 3) : undefined, giltFuer: (['kevin', 'malin', 'beide', 'zoe'] as const).find(x => x === v.gilt_fuer), erstelltVon: 'zoe' });
    if (a.ok && a.schonDa) schonDa++; else if (a.ok) abgelegt++;
  }
  return merke({ abgelegt, schonDa, ohneKi: false, text: `${abgelegt} Vorschläge in der Brain-Inbox${schonDa ? ` (${schonDa} lagen schon)` : ''}${liste.length ? '' : ' — das Modell fand nichts Belastbares'}.` });
}
