// ─── App → Brain: Material aus den Arbeitsbeständen (29.09., B2) ─────────────────────────────────
// Kevin: „Alle Infos müssen immer sauber gespeichert werden — online in unserem Brain.“ Hier steht EINMAL, was aus
// der App ins Brain darf und wie es gesammelt wird — für den App-Tagesbericht (Vorschlag in der Brain-Inbox,
// lib/brain/app-bericht.ts) und den `_App/`-Spiegel (lib/brain/app-spiegel.ts).
//
// Leitplanken (an EINER Stelle, `sichtbar`):
//   · nichts, was an einem eingeschränkten Kontakt hängt (Art. 18) — gezählt als „ausgeblendet“, nie genannt
//   · keine Kontakt-Notizen (auch keine privaten anderer), keine Kontaktdaten, keine IBAN — nur Titel, Status, Links
//   · keine Aufgaben mit Sichtbarkeit „nur ich“ (Feld kommt mit dem Aufgaben-Paket — `nurIch` liest es tolerant)
//   · nichts aus dem Papierkorb (`geloeschtAm`, tolerant)
//   · Privat-Space nur, wenn der Haushalt es zulässt (`brain-bruecke--<haushalt>`, Standard „anzahl“: nur Zahlen)
//   · Zeit-Auswertung einer Person (`_App/Woche`) nur mit IHRER ausdrücklichen Einwilligung (`zeitFreigabe`, Standard: niemand)
// Alles hier ist rein bis auf `appDatenLaden` und die Einstellung.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { tagVon } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import { alleSpaces, bereichVonSpace, istSonstigeProjekt } from '@/lib/aufgaben/struktur';
import type { Task, Project, TasksState } from '@/types/tasks';
import { istNurIch } from '@/lib/aufgaben/sicht';
import type { CrmBestand, ChancenStufe } from '@/lib/crm/typen';
import type { DauerEintrag } from '@/lib/zoe/entscheidungen';
import type { ZeitJeMandat } from '@/lib/zeitmessung/mandate';
import { appLink } from './vault-ziel';
import { speicherFuer } from '@/lib/zoe/raum';

// ── Einstellung des Haushalts ──────────────────────────────────────────────

/** „anzahl“ (Standard): aus dem Privat-Space nur Zahlen · „voll“: Titel und Notizen wie im Business. */
export type PrivatStufe = 'anzahl' | 'voll';
export interface BrueckeEinstellung {
  privat: PrivatStufe;
  /**
   * Personen (Speichername), deren Zeit-Auswertung der Woche in den gemeinsamen Vault (`_App/Woche`) darf (F2 H1, 29.09.).
   * Standard leer = von niemandem. Jede Person schaltet NUR sich selbst ein/aus (`zeitFreigabeSetzen`) — die Zeit ist
   * persönlich; ohne Einwilligung steht von dieser Person nichts im Wochenrückblick.
   */
  zeitFreigabe: string[];
  geaendertVon?: string; geaendertAm?: string;
}
export const EINSTELLUNG_STANDARD: BrueckeEinstellung = { privat: 'anzahl', zeitFreigabe: [] };
export const einstellungName = (haushalt: string) => `brain-bruecke--${haushalt.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+/, '') || 'ohne-haushalt'}`;

const PERSON_RE = /^[a-z0-9-]{1,40}$/;
function einstellungAus(e: Partial<BrueckeEinstellung> | null | undefined): BrueckeEinstellung {
  const zf = Array.isArray(e?.zeitFreigabe) ? [...new Set(e!.zeitFreigabe.filter((p): p is string => typeof p === 'string' && PERSON_RE.test(p)))].sort() : [];
  return { ...EINSTELLUNG_STANDARD, ...(e ?? {}), privat: e?.privat === 'voll' ? 'voll' : 'anzahl', zeitFreigabe: zf };
}

export async function einstellungLesen(haushalt: string): Promise<BrueckeEinstellung> {
  return einstellungAus(await loadJson<Partial<BrueckeEinstellung>>(einstellungName(haushalt)));
}
/** Privat-Stufe des Haushalts ändern — die Zeit-Einwilligungen der Personen bleiben unberührt. */
export async function einstellungSetzen(haushalt: string, privat: PrivatStufe, von: string): Promise<BrueckeEinstellung> {
  return updateJson<BrueckeEinstellung>(einstellungName(haushalt), cur => ({ ...einstellungAus(cur), privat, geaendertVon: von, geaendertAm: new Date().toISOString() }));
}
/** Einwilligung EINER Person für ihre eigene Zeit-Auswertung im Wochenrückblick (nur für sich selbst aufrufen). */
export async function zeitFreigabeSetzen(haushalt: string, person: string, an: boolean, von: string = person): Promise<BrueckeEinstellung> {
  if (!PERSON_RE.test(person)) throw new Error('Ungültige Person.');
  return updateJson<BrueckeEinstellung>(einstellungName(haushalt), cur => {
    const e = einstellungAus(cur);
    const zf = new Set(e.zeitFreigabe);
    if (an) zf.add(person); else zf.delete(person);
    return { ...e, zeitFreigabe: [...zf].sort(), geaendertVon: von, geaendertAm: new Date().toISOString() };
  });
}

/**
 * Bestände, aus denen `_App/Woche` die Zeit rechnet (für den Riegel des Spiegels): Kalender-Stand (iCloud/Mac), Bezüge,
 * Einstellungen, Wochenvorlage und `zeit`/`zeit--<person>` der eingewilligten Personen. Ohne Einwilligung: keine.
 */
export function zeitBestaende(zeitFreigabe: readonly string[]): string[] {
  if (!zeitFreigabe.length) return [];
  return ['kalender-icloud', 'calendar-cache', 'kalender-bezug', 'kalender-einstellungen', 'routinen', ...zeitFreigabe.map(p => speicherFuer('zeit', p))];
}

// ── Die Daten ──────────────────────────────────────────────────────────────

export interface AppDaten {
  haushalt: string;
  /** Berliner Tag, für den gesammelt wird. */
  heute: string;
  state: TasksState;
  crm: CrmBestand;
  /** Kennungen eingeschränkter Kontakte (Art. 18) — nur zum Ausblenden. */
  eingeschraenkt: ReadonlySet<string>;
  /** Dauerhafte ZOE-Entscheidungen der geladenen Monate (lib/zoe/entscheidungen.ts). */
  entscheidungen: DauerEintrag[];
  zeitWoche: ZeitJeMandat | null;
  zeitMonat: ZeitJeMandat | null;
  zeitVormonat: ZeitJeMandat | null;
  einstellung: BrueckeEinstellung;
  /**
   * Zeit-Auswertung der Woche je Person des Haushalts (K6a, 29.09. — `auswertungMarkdown`, lib/kalender/auswertung.ts)
   * für `_App/Woche`. Nur Zahlen, Firmen und Mandate — keine Termin-Titel, keine Kontakte. Nur mit `mitZeit` geladen und
   * nur für Personen mit Einwilligung (`einstellung.zeitFreigabe`, F2 H1).
   */
  zeitAuswertung?: { person: string; name: string; markdown: string }[];
}

/** Monat (JJJJ-MM) eines Tages und der davor. */
export const monatVon = (tag: string) => tag.slice(0, 7);
export function vormonatVon(tag: string): string {
  const [j, m] = tag.split('-').map(Number);
  return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`;
}

/** Alles laden (Server). Ohne Haushalt des Inhabers: null — dann schreibt niemand etwas. */
export async function appDatenLaden(heute: string, opt: { mitZeit?: boolean } = {}): Promise<AppDaten | null> {
  const { ladeKonten } = await import('@/lib/zugang/konten');
  const { hauptInhaber } = await import('@/lib/zugang/inhaber');
  const st = await ladeKonten();
  const konten = st.konten;
  // Der Haupt-Inhaber (bei mehreren Inhabern genau einer, lib/zugang/inhaber.ts) — sein Haushalt ist der der Inhaber.
  const inhaber = hauptInhaber(st);
  const haushalt = inhaber?.haushalt;
  if (!inhaber || !haushalt) return null;
  const { ladeAufgabenSicht } = await import('@/lib/aufgaben/sicht'); // ohne Papierkorb, ohne Archiv („Neu anfangen“), ohne „nur ich“
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const { entscheidungenMonat } = await import('@/lib/zoe/entscheidungen');
  const zeit = async (zeitraum: 'woche' | 'monat', stichtag: string) => {
    try { const { zeitJeMandatFuer } = await import('@/lib/zeitmessung/mandate-server'); return await zeitJeMandatFuer(inhaber.speicher, zeitraum, stichtag); } catch { return null; }
  };
  const vorTag = `${vormonatVon(heute)}-15`;
  const [state, crm, kartei, e1, e2, zeitWoche, zeitMonat, zeitVormonat, einstellung] = await Promise.all([
    // Geteilter Spiegel/Index: Systemsicht — keine „nur ich“-Aufgabe und keine ihrer Unteraufgaben (29.09., lib/aufgaben/sicht.ts).
    ladeAufgabenSicht(null), ladeCrm(), loadJson<{ kontakte?: { id: string; eingeschraenkt?: unknown }[] }>('kontakte'),
    entscheidungenMonat(haushalt, vormonatVon(heute)), entscheidungenMonat(haushalt, monatVon(heute)),
    zeit('woche', heute), zeit('monat', heute), zeit('monat', vorTag), einstellungLesen(haushalt),
  ]);
  return {
    haushalt, heute, state, crm,
    eingeschraenkt: new Set((kartei?.kontakte ?? []).filter(k => k.eingeschraenkt).map(k => k.id)),
    entscheidungen: [...e1, ...e2], zeitWoche, zeitMonat, zeitVormonat, einstellung,
    // F2 H1: nur Personen dieses Haushalts, die selbst eingewilligt haben — ohne Einwilligung wird ihre Zeit gar nicht gelesen.
    ...(opt.mitZeit ? { zeitAuswertung: await zeitAuswertungLaden(konten.filter(k => k.haushalt === haushalt && einstellung.zeitFreigabe.includes(k.speicher)), heute) } : {}),
  };
}

/**
 * Zeit-Auswertung je Person (K6a): die EINE Rechnung `zeitAuswertungFuer` (lib/kalender/auswertung-server.ts, Termine ohne
 * Abgleich + Fokus-Blöcke) → `auswertungMarkdown` mit Firmen-/Mandatsnamen. Kontakte fallen heraus (keine Namen Dritter im
 * Wochenrückblick). Wirft nie — ohne Kalender fehlt die Person.
 */
async function zeitAuswertungLaden(personen: readonly { speicher: string; name: string }[], heute: string): Promise<{ person: string; name: string; markdown: string }[]> {
  const { zeitAuswertungFuer } = await import('@/lib/kalender/auswertung-server');
  const { auswertungMarkdown } = await import('@/lib/kalender/auswertung');
  const raus: { person: string; name: string; markdown: string }[] = [];
  for (const p of personen) {
    try {
      const a = await zeitAuswertungFuer(p.speicher, heute);
      const ohneKontakte = { ...a, woche: { ...a.woche, kontakte: [] } };
      raus.push({ person: p.speicher, name: p.name.split(' ')[0] || p.speicher, markdown: auswertungMarkdown(ohneKontakte, { einheit: k => a.namen.einheiten[k] ?? k, mandat: id => a.namen.mandate[id] ?? 'Mandat' }) });
    } catch { /* ohne Kalender/Zeit: diese Person fehlt */ }
  }
  return raus;
}

// ── Leitplanken ────────────────────────────────────────────────────────────

const im = (x: object, feld: string): unknown => (x as Record<string, unknown>)[feld];
export const imPapierkorb = (x: object): boolean => { const g = im(x, 'geloeschtAm'); return typeof g === 'string' && g.length > 0; };
/** Sichtbarkeit „nur ich“ (29.09., Paket T1): `Task.sichtbarkeit === 'nur-ich'` — eine Regel, lib/aufgaben/sicht.ts `istNurIch`. */
export function nurIch(t: object): boolean {
  return istNurIch(t as Pick<Task, 'sichtbarkeit'>);
}
export const privatAufgabe = (t: Pick<Task, 'spaceId' | 'space'>) => bereichVonSpace(t.spaceId ?? (t.space === 'privat' ? 'privat' : undefined)) === 'privat';
export const privatProjekt = (p: Pick<Project, 'spaceId'>) => bereichVonSpace(p.spaceId) === 'privat';

/** Darf diese Aufgabe überhaupt ins Brain? (Papierkorb, „nur ich“, Art. 18 am Bezug, Projekt im Papierkorb) */
export function aufgabeSichtbar(t: Task, d: Pick<AppDaten, 'eingeschraenkt' | 'state'>): boolean {
  if (imPapierkorb(t) || nurIch(t)) return false;
  if (t.bezug?.kontaktId && d.eingeschraenkt.has(t.bezug.kontaktId)) return false;
  const p = d.state.projects.find(x => x.id === t.projectId);
  return !(p && imPapierkorb(p));
}
const kontaktGesperrt = (d: Pick<AppDaten, 'eingeschraenkt'>, ids: readonly (string | undefined)[]) => ids.some(id => !!id && d.eingeschraenkt.has(id));

// ── Text für Markdown ──────────────────────────────────────────────────────

/** Eine Zeile Text sicher ins Markdown: keine Zeilenumbrüche, keine Wikilinks/HTML aus Daten, begrenzt. */
export function md(t: unknown, n = 160): string {
  const s = String(t ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim()
    .replace(/\[\[/g, '[ [').replace(/\]\]/g, '] ]').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '/');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
/** Mehrzeiliger Text (Projekt-Notiz) als Zitat — bleibt als Block erkennbar Daten, Überschriften/Wikilinks entschärft. */
export function zitat(t: unknown, n = 4000): string {
  const s = String(t ?? '').replace(/\u0000/g, '').trim();
  if (!s) return '';
  const kurz = s.length > n ? `${s.slice(0, n - 1)}…` : s;
  return kurz.split(/\r?\n/).map(z => `> ${z.replace(/\[\[/g, '[ [').replace(/\]\]/g, '] ]').replace(/</g, '&lt;').replace(/^---\s*$/, '—')}`).join('\n');
}
export const link = (text: string, pfad: string) => `[${md(text, 120).replace(/[[\]]/g, '')}](${appLink(pfad)})`;
export const stunden = (sek: number) => `${(Math.round((sek / 3600) * 10) / 10).toLocaleString('de-DE')} h`;
/** Kurzfassung eines Notiztexts: erste Zeilen ohne Markdown-Zeichen. */
export const kurzfassung = (t: unknown, n = 200) => md(String(t ?? '').replace(/^#+\s*/gm, '').replace(/[*_`>]/g, '').replace(/- \[[ x]\]/g, '•'), n);

// ── Material eines Zeitraums (Tagesbericht, Wochenrückblick) ───────────────

export interface Material {
  von: string; bis: string;
  erledigt: { projekt: string; link: string; aufgaben: { titel: string; link: string }[] }[];
  privatErledigt: number;
  projekte: { titel: string; link: string; kurz: string }[];
  privatProjekte: number;
  angebote: { was: 'gestellt' | 'angenommen' | 'abgelehnt'; titel: string; firma?: string; link: string }[];
  deals: { titel: string; von?: ChancenStufe; nach: ChancenStufe; link: string }[];
  mandateNeu: { titel: string; link: string }[];
  mandateBeendet: { titel: string; link: string }[];
  entscheidungen: DauerEintrag[];
  zeit: { label: string; sek: number; link: string }[];
  zeitOhneSek: number;
  zeitLabel: string | null;
  /** Wegen Art. 18 / „nur ich“ nicht genannt — nur die Zahl. */
  ausgeblendet: number;
}

const imZeitraum = (iso: string | undefined, von: string, bis: string) => { if (!iso) return false; const t = iso.length === 10 ? iso : tagVon(iso); return t >= von && t <= bis; };

export function projektName(d: Pick<AppDaten, 'state' | 'crm'>, projektId: string | undefined, spaceId?: string): string {
  const p = projektId ? d.state.projects.find(x => x.id === projektId) : undefined;
  if (p) return p.title;
  const spaces = alleSpaces(d.crm, d.state.tasks);
  const s = spaces.find(x => x.id === (spaceId ?? (projektId && istSonstigeProjekt(projektId) ? projektId.slice('sonstige-'.length) : undefined)));
  return `Sonstige${s ? ` (${s.label})` : ''}`;
}

/** Was im Zeitraum [von, bis] (Berliner Tage) passiert ist — mit allen Leitplanken (rein, getestet). */
export function material(d: AppDaten, von: string, bis: string, zeit: ZeitJeMandat | null): Material {
  const voll = d.einstellung.privat === 'voll';
  let ausgeblendet = 0;
  // Erledigte Hauptaufgaben je Projekt.
  const jeProjekt = new Map<string, Material['erledigt'][number]>();
  let privatErledigt = 0;
  for (const t of d.state.tasks) {
    if (t.parentId || t.status !== 'done' || !imZeitraum(t.completedAt, von, bis)) continue;
    if (!aufgabeSichtbar(t, d)) { if (!imPapierkorb(t)) ausgeblendet++; continue; }
    if (privatAufgabe(t) && !voll) { privatErledigt++; continue; }
    const key = t.projectId || `sonstige-${t.spaceId ?? ''}`;
    const e = jeProjekt.get(key) ?? { projekt: projektName(d, t.projectId, t.spaceId), link: t.spaceId ? WEG.aufgaben({ s: t.spaceId, ...(d.state.projects.some(p => p.id === t.projectId) ? { p: t.projectId } : {}) }) : WEG.aufgaben(), aufgaben: [] };
    e.aufgaben.push({ titel: t.title, link: WEG.aufgabe(t.id) });
    jeProjekt.set(key, e);
  }
  // Neue/geänderte Projekt-Notizen: nur Titel + Kurzfassung (keine Dateien).
  const projekte: Material['projekte'] = [];
  let privatProjekte = 0;
  for (const p of d.state.projects) {
    if (imPapierkorb(p) || !imZeitraum(p.updatedAt, von, bis) || !(p.notiz || p.beschreibung || p.description)) continue;
    if (privatProjekt(p) && !voll) { privatProjekte++; continue; }
    projekte.push({ titel: p.title, link: p.spaceId ? WEG.aufgaben({ s: p.spaceId, p: p.id }) : WEG.aufgaben(), kurz: kurzfassung(p.notiz || p.beschreibung || p.description) });
  }
  const firmaName = (id?: string) => (id ? d.crm.firmen.find(f => f.id === id)?.name : undefined);
  // Angebote gestellt / angenommen / abgelehnt.
  const angebote: Material['angebote'] = [];
  for (const a of d.crm.angebote ?? []) {
    const was = (['gestellt', 'angenommen', 'abgelehnt'] as const).filter(w => imZeitraum(w === 'gestellt' ? a.gestelltAm : w === 'angenommen' ? a.angenommenAm : a.abgelehntAm, von, bis));
    if (!was.length) continue;
    if (kontaktGesperrt(d, [a.kontaktId])) { ausgeblendet++; continue; }
    for (const w of was) angebote.push({ was: w, titel: `${a.nummer ? `${a.nummer} · ` : ''}${a.titel}`, firma: firmaName(a.firmaId), link: WEG.angebot({ angebotId: a.id }) });
  }
  // Deal-Stufenwechsel.
  const deals: Material['deals'] = [];
  for (const c of d.crm.chancen) {
    const h = c.historie ?? [];
    const neu = h.map((x, i) => ({ x, vor: h[i - 1]?.stufe })).filter(({ x }) => imZeitraum(x.am, von, bis));
    if (!neu.length) continue;
    if (kontaktGesperrt(d, c.kontaktIds ?? [])) { ausgeblendet++; continue; }
    for (const { x, vor } of neu) deals.push({ titel: c.titel, ...(vor ? { von: vor } : {}), nach: x.stufe, link: WEG.deal(c.id) });
  }
  // Mandate neu / beendet.
  const mandateNeu: Material['mandateNeu'] = [], mandateBeendet: Material['mandateBeendet'] = [];
  for (const m of d.crm.mandate) {
    const neu = imZeitraum(m.start, von, bis);
    const ende = m.status === 'beendet' && (imZeitraum(m.ende, von, bis) || (!m.ende && imZeitraum(m.geaendert, von, bis)));
    if (!neu && !ende) continue;
    if (kontaktGesperrt(d, m.kontaktIds ?? [])) { ausgeblendet++; continue; }
    const z = { titel: `${m.kunde} · ${m.titel}`, link: WEG.mandat(m.id) };
    if (neu) mandateNeu.push(z);
    if (ende) mandateBeendet.push(z);
  }
  const entscheidungen = d.entscheidungen.filter(e => e.typ === 'entscheidung' && imZeitraum(e.at, von, bis));
  const zeilen = (zeit?.gesamt.zeilen ?? []).filter(z => z.art !== 'ohne' && z.sek > 0);
  return {
    von, bis, erledigt: Array.from(jeProjekt.values()).sort((a, b) => b.aufgaben.length - a.aufgaben.length || a.projekt.localeCompare(b.projekt, 'de')),
    privatErledigt, projekte, privatProjekte, angebote, deals, mandateNeu, mandateBeendet, entscheidungen,
    zeit: zeilen.map(z => ({ label: z.label, sek: z.sek, link: z.art === 'mandat' ? WEG.mandat(z.id) : WEG.mandat() })),
    zeitOhneSek: zeit ? zeit.gesamt.sek - zeit.gesamt.mitMandatSek : 0,
    zeitLabel: zeit ? `${zeit.label} (${zeit.von} bis ${zeit.bis})` : null,
    ausgeblendet,
  };
}

export const materialLeer = (m: Material) => !m.erledigt.length && !m.privatErledigt && !m.projekte.length && !m.privatProjekte && !m.angebote.length && !m.deals.length
  && !m.mandateNeu.length && !m.mandateBeendet.length && !m.entscheidungen.length && !m.zeit.length;

const ENTSCHEIDUNG_LABEL: Record<string, string> = { freigegeben: 'freigegeben', abgelehnt: 'abgelehnt', fehlgeschlagen: 'fehlgeschlagen', zurueck: 'zurück an ZOE' };
/** Eine Entscheidung als Zeile — bei CRM-Vorschlägen ohne Titel (er kann Namen tragen), nur die Art. */
export function entscheidungZeile(e: DauerEintrag): string {
  const was = e.bezug?.art === 'crm' ? `CRM-Vorschlag (${md(e.vorschlagArt ?? 'crm', 40)})` : e.titel ? `„${md(e.titel, 120)}“` : md(e.werkzeug, 60);
  return `${ENTSCHEIDUNG_LABEL[e.entscheidung ?? ''] ?? md(e.entscheidung, 20)} · ${was}${e.person ? ` · von ${md(e.person, 40)}` : ' · Systemlauf'}${e.grund ? ` · Grund: „${md(e.grund, 200)}“` : ''}`;
}

/** Das Material als Markdown-Abschnitte (Tagesbericht und Wochenrückblick teilen sich das). */
export function materialMarkdown(m: Material): string {
  const teile: string[] = [];
  const liste = (titel: string, zeilen: string[]) => { if (zeilen.length) teile.push(`## ${titel}\n\n${zeilen.join('\n')}`); };
  liste('Erledigte Aufgaben je Projekt', [
    ...m.erledigt.map(e => `- **${link(e.projekt, e.link)}** (${e.aufgaben.length})\n${e.aufgaben.slice(0, 30).map(a => `  - ${link(a.titel, a.link)}`).join('\n')}${e.aufgaben.length > 30 ? `\n  - … und ${e.aufgaben.length - 30} weitere` : ''}`),
    ...(m.privatErledigt ? [`- Privat: ${m.privatErledigt} erledigt (nur als Anzahl)`] : []),
  ]);
  liste('Projekt-Notizen neu oder geändert', [
    ...m.projekte.map(p => `- ${link(p.titel, p.link)}${p.kurz ? ` — „${p.kurz}“` : ''}`),
    ...(m.privatProjekte ? [`- Privat: ${m.privatProjekte} Projekte geändert (nur als Anzahl)`] : []),
  ]);
  liste('Angebote', m.angebote.map(a => `- ${a.was}: ${link(a.titel, a.link)}${a.firma ? ` · ${md(a.firma, 80)}` : ''}`));
  liste('Deal-Stufen', m.deals.map(x => `- ${link(x.titel, x.link)}: ${x.von ? `${x.von} → ` : ''}${x.nach}`));
  liste('Mandate', [...m.mandateNeu.map(x => `- neu: ${link(x.titel, x.link)}`), ...m.mandateBeendet.map(x => `- beendet: ${link(x.titel, x.link)}`)]);
  liste('ZOE-Entscheidungen', m.entscheidungen.map(e => `- ${entscheidungZeile(e)}`));
  if (m.zeitLabel && (m.zeit.length || m.zeitOhneSek)) liste(`Zeit je Mandat · ${m.zeitLabel}`, [...m.zeit.map(z => `- ${link(z.label, z.link)}: ${stunden(z.sek)}`), ...(m.zeitOhneSek ? [`- ohne Mandat: ${stunden(m.zeitOhneSek)}`] : [])]);
  if (m.ausgeblendet) teile.push(`*${m.ausgeblendet} Einträge ausgeblendet (eingeschränkte Verarbeitung nach Art. 18 bzw. „nur ich“).*`);
  return teile.join('\n\n');
}
