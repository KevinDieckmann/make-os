// ─── ZOE arbeitet ihre Aufgaben ab (Paket C4, 28.09. spät) ─────────────────
// Ausgelöst per Knopf „ZOE jetzt arbeiten lassen“ (Route /api/aufgaben/zoe, aktion „arbeiten“, nur eigene
// Aufträge) und einmal am Tag im Takt (Systemlauf `zoe-aufgaben`, alle Auftraggeberinnen des Haushalts).
//
// Je offener ZOE-Aufgabe: Auftrag bauen (Titel, Beschreibung, Notiz, Unteraufgaben, Projekt-Notiz, Unterlagen aus der
// Aufgaben-Ablage, CRM-Kurzinfo ohne Privates — alles Text Dritter-fähige mit `fremd()` gekapselt, mit Größengrenze), EIN Modellaufruf ohne
// Werkzeuge (nur JSON), Antwort säubern → NUR ein Vorschlag im bestehenden Freigabe-Stapel (Stapel-Art „aufgabe“,
// Kennung `aufgabe_uebernehmen`, Bezug { art: 'aufgabe', id }), Aufgabe → „wartet auf Freigabe“ (Verlauf durch ZOE),
// Meldung an die Auftraggeberin. Die Aufgabe selbst ändert sich inhaltlich NICHT — erst der Klick übernimmt.
// Grenzen: höchstens `LAUF_MAX` Aufgaben je Lauf, ohne Schlüssel/Guthaben kein Aufruf (nichts verändert),
// ein Lauf zur Zeit je Prozess. Kosten laufen über askText (Zweck „zoe-aufgaben“, Verbrauchs-Mitschrift).

import type { Task, TasksState } from '@/types/tasks';
import { askText, extractJson, fremd, FREMD_REGEL, guthabenLeer, hasAnthropicKey } from '@/lib/anthropic';
import { loadJson } from '@/lib/store/local-db';
import { ladeAufgabenSicht } from '@/lib/aufgaben/speicher';
import { statusVon } from '@/lib/aufgaben/struktur';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { melde } from '@/lib/meldungen/melden';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { auftraggeberinVon, vorschlagSauber, vorschlagZeile, zoeHinweis, zoeZuBearbeiten, ZOE_AUFGABE_WERKZEUG, type ZoeVorschlagInhalt } from '@/lib/aufgaben/zoe';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { aufgabenDateienListe, aufgabenDateiLesen, type AufgabenDatei } from '@/lib/dateien/aufgaben-ablage';
import { aufgabenDateienFuer, typGruppe, TYP_LABEL, ZOE_ZEICHEN } from '@/lib/dateien/aufgaben-regeln';
import { groesseText } from '@/lib/dateien/regeln';
import { textAuslesen } from '@/lib/dateien/text-auslesen';
import { UNTERLAGEN_QUELLE } from './aufgaben-unterlagen';
import { aufgabeZoeAendern } from './aufgaben-werkzeuge';
import { lege, hole } from './stapel';
import { notiere } from './protokoll';

/** Standard und Obergrenze je Lauf — jeder Auftrag ist ein Modellaufruf. */
export const LAUF_STANDARD = 3;
export const LAUF_MAX = 5;
/** Zeichen je Textteil im Auftrag (Beschreibung, Notiz, Projekt-Notiz) — was darüber liegt, sieht ZOE nicht. */
export const AUFTRAG_TEXT_MAX = 6000;
const PROJEKT_NOTIZ_MAX = 3000;

export interface LaufErgebnis {
  ok: boolean;
  /** Vorbereitet (liegt im Stapel). */
  bearbeitet: { id: string; titel: string; stapelId: string }[];
  /** Nicht bearbeitet, mit Grund. */
  uebersprungen: { id: string; grund: string }[];
  /** Ohne Modell (kein Schlüssel / Guthaben leer / Lauf läuft schon) — nichts wurde verändert. */
  ohneKi?: string;
  /** Wie viele danach noch offen warten. */
  rest: number;
}

let laeuft = false;

const schnitt = (s: string | undefined, n: number) => {
  const t = (s ?? '').trim();
  return t.length > n ? `${t.slice(0, n)}\n[… gekürzt, ${t.length - n} Zeichen mehr]` : t;
};

// ── Kontext: CRM-Kurzinfo ohne Privates ───────────────────────────────────

interface KontaktKurz { id: string; vorname?: string; nachname?: string; position?: string; firma?: string; stufe?: string; naechsterSchritt?: { text: string; datum: string }; werbesperre?: unknown; eingeschraenkt?: unknown }
interface CrmKurz { firmen?: { id: string; name: string; rolle?: string; branche?: string }[]; mandate?: { id: string; titel: string; kunde?: string; status?: string }[]; chancen?: { id: string; titel: string; stufe?: string }[] }

/**
 * Was ZOE zu einer verknüpften Person/Firma/Mandat/Deal sieht: Name, Rolle, Stufe, nächster Schritt — nie Notizen
 * (`notiz`, `privatNotiz`), Kontaktdaten, Zahlungsdaten, Aktivitäten. Werbesperre oder Einschränkung (Art. 18):
 * gar nichts außer dem Hinweis, dass jemand verknüpft ist.
 */
export function crmKurzinfo(bezug: Task['bezug'], kontakte: readonly KontaktKurz[], crm: CrmKurz): string {
  if (!bezug) return '';
  const zeilen: string[] = [];
  if (bezug.kontaktId) {
    const k = kontakte.find(x => x.id === bezug.kontaktId);
    if (!k) zeilen.push('Kontakt: (nicht mehr in der Kartei)');
    else if (k.werbesperre || k.eingeschraenkt) zeilen.push('Kontakt: verknüpft — gesperrt, keine Angaben (Werbesperre/Einschränkung).');
    else zeilen.push(`Kontakt: ${[`${k.vorname ?? ''} ${k.nachname ?? ''}`.trim(), k.position, k.firma, k.stufe ? `Stufe ${k.stufe}` : ''].filter(Boolean).join(' · ')}${k.naechsterSchritt ? ` · nächster Schritt „${schnitt(k.naechsterSchritt.text, 120)}“ am ${k.naechsterSchritt.datum}` : ''}`);
  }
  if (bezug.firmaId) {
    const f = (crm.firmen ?? []).find(x => x.id === bezug.firmaId);
    zeilen.push(f ? `Firma: ${[f.name, f.rolle, f.branche].filter(Boolean).join(' · ')}` : 'Firma: (nicht mehr im CRM)');
  }
  if (bezug.mandatId) {
    const m = (crm.mandate ?? []).find(x => x.id === bezug.mandatId);
    zeilen.push(m ? `Mandat: ${[m.titel, m.kunde, m.status].filter(Boolean).join(' · ')}` : 'Mandat: (nicht mehr im CRM)');
  }
  if (bezug.dealId) {
    const d = (crm.chancen ?? []).find(x => x.id === bezug.dealId);
    zeilen.push(d ? `Deal: ${[d.titel, d.stufe ? `Stufe ${d.stufe}` : ''].filter(Boolean).join(' · ')}` : 'Deal: (nicht mehr im CRM)');
  }
  return zeilen.join('\n');
}

// ── Der Auftrag ────────────────────────────────────────────────────────────

export const ZOE_AUFGABEN_SYSTEM = [
  'Du bist ZOE, die Assistentin von MAKE OS. Eine Person hat dir eine Aufgabe gegeben. Du bereitest sie VOR — du erledigst nichts selbst.',
  'Dein Ergebnis ist ausschließlich ein Vorschlag, den die Person prüft und freigibt: ein Entwurf oder eine Recherche-Notiz (Markdown: Überschriften, Listen, Checklisten „- [ ]“, Links), vorgeschlagene Unteraufgaben, und nur wenn es klar folgt ein neuer Status oder eine Deadline.',
  'Du versendest nichts, schreibst niemandem, löschst nichts und änderst keine anderen Aufgaben. Ein Mail- oder Nachrichtentext ist immer nur ein ENTWURF zum Kopieren.',
  'Erfinde keine Fakten, Zahlen, Namen oder Quellen. Fehlt dir etwas, schreib es als offene Frage in den Entwurf.',
  'Sprache: Deutsch, knapp und konkret. Unteraufgaben: höchstens 8, imperativ, je unter 80 Zeichen, keine Wiederholung vorhandener.',
  'Status nur aus: todo (Offen), in-progress (In Arbeit), blocked (Wartend), done (Erledigt) — leer lassen, wenn unklar. Deadline nur als YYYY-MM-DD und nur, wenn sie aus dem Auftrag folgt.',
  FREMD_REGEL,
  'Antworte NUR mit JSON: {"zusammenfassung": "1–2 Sätze, was du vorbereitet hast", "entwurf": "…", "unteraufgaben": ["…"], "status": "", "deadline": "", "begruendung": "ein Satz"}.',
].join('\n');

const SCHEMA = {
  type: 'object',
  properties: {
    zusammenfassung: { type: 'string' }, entwurf: { type: 'string' }, unteraufgaben: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['', 'todo', 'in-progress', 'blocked', 'done'] }, deadline: { type: 'string' }, begruendung: { type: 'string' },
  },
  required: ['zusammenfassung', 'entwurf', 'unteraufgaben', 'status', 'deadline', 'begruendung'],
  additionalProperties: false,
} as const;

/**
 * Der Auftrag an das Modell (rein, getestet): alles aus Bestand und Kartei steht in `<fremde_daten>` — Titel,
 * Beschreibung, Notiz, Unteraufgaben, Projekt, CRM. Nur der Hinweis und der Ablehnungsgrund der Auftraggeberin
 * stehen außerhalb (ihre eigenen Worte an ZOE), begrenzt.
 */
export function auftragText(t: Task, ctx: { state: Pick<TasksState, 'tasks' | 'projects' | 'statusEigen'>; heute: string; crm?: string; hinweis?: string | null; abgelehnt?: string | null; /** Unterlagen aus der Aufgaben-Ablage (schon begrenzt). */ dateien?: string }): string {
  const eltern = t.parentId ? ctx.state.tasks.find(x => x.id === t.parentId) : undefined;
  const unter = ctx.state.tasks.filter(x => x.parentId === t.id);
  const projekt = ctx.state.projects.find(p => p.id === t.projectId);
  const aufgabe = [
    `Titel: ${t.title}`,
    `Status: ${statusVon(t, ctx.state.statusEigen ?? []).label} · Priorität: ${t.priority}${t.dueDate ? ` · Deadline: ${t.dueDate.slice(0, 10)}` : ''}${t.startDate ? ` · Start: ${t.startDate}` : ''}`,
    ...(eltern ? [`Teil von: ${eltern.title}`] : []),
    ...(t.description?.trim() ? [`Beschreibung:\n${schnitt(t.description, AUFTRAG_TEXT_MAX)}`] : []),
    ...(t.notiz?.trim() ? [`Notiz:\n${schnitt(t.notiz, AUFTRAG_TEXT_MAX)}`] : []),
    ...(unter.length ? [`Vorhandene Unteraufgaben:\n${unter.slice(0, 40).map(u => `- [${u.status === 'done' ? 'x' : ' '}] ${u.title}`).join('\n')}`] : []),
  ].join('\n');
  const teile = [
    `Heute ist ${ctx.heute}. Bereite diese Aufgabe vor:`,
    fremd('aufgabe', aufgabe),
    ...(projekt ? [fremd('projekt', [`Projekt: ${projekt.title}`, ...((projekt.notiz ?? projekt.beschreibung)?.trim() ? [`Projekt-Notiz:\n${schnitt(projekt.notiz ?? projekt.beschreibung, PROJEKT_NOTIZ_MAX)}`] : [])].join('\n'))] : []),
    ...(ctx.crm ? [fremd('crm', ctx.crm)] : []),
    // Projekt-/Aufgaben-Dateien (Paket C2): nur die Aufgaben-Ablage, gekapselt, höchstens ZOE_ZEICHEN Inhalt.
    ...(ctx.dateien ? [fremd(UNTERLAGEN_QUELLE, ctx.dateien)] : []),
    ...(ctx.abgelehnt ? [`Dein letzter Vorschlag zu dieser Aufgabe wurde abgelehnt. Grund der Auftraggeberin: „${schnitt(ctx.abgelehnt, 400)}“ — mach es diesmal anders.`] : []),
    ...(ctx.hinweis ? [`Hinweis der Auftraggeberin: „${schnitt(ctx.hinweis, 1000)}“`] : []),
  ];
  return teile.join('\n\n');
}

// ── Der Lauf ───────────────────────────────────────────────────────────────

/**
 * Unterlagen aus der Aufgaben-Ablage (Paket C2, nie die CRM-Ablage): Dateien an der Aufgabe mit Textinhalt (zusammen
 * höchstens `ZOE_ZEICHEN`, darüber mit Hinweis statt still gekürzt), Dateien am Projekt nur als Angaben. Der Lauf
 * liest direkt über die Ablage (die Gesprächs-Werkzeuge laufen nie im Hintergrund) — in der Auftraggeberin Haushalt.
 */
async function unterlagenFuer(t: Task, auftraggeberin: string): Promise<string> {
  try {
    const h = (await haushaltFuer(auftraggeberin))?.haushalt;
    if (!h) return '';
    const alle = await aufgabenDateienListe(h);
    const eigene = aufgabenDateienFuer(alle, { aufgabeId: t.id });
    const amProjekt = aufgabenDateienFuer(alle, { projektId: t.projectId }).filter(d => !d.aufgabeId);
    if (!eigene.length && !amProjekt.length) return '';
    const zeile = (d: AufgabenDatei) => `${d.datei.name} · ${TYP_LABEL[typGruppe(d.datei.typ)]} · ${groesseText(d.datei.groesse)}${d.notiz ? ` · Beschreibung: ${d.notiz}` : ''}`;
    let rest = ZOE_ZEICHEN;
    const teile: string[] = [];
    for (const d of eigene) {
      teile.push(`Datei an der Aufgabe: ${zeile(d)}`);
      if (rest <= 0) { teile.push('(Inhalt nicht gelesen — Grenze für diesen Auftrag erreicht)'); continue; }
      try {
        const x = await aufgabenDateiLesen(h, d.id);
        const inhalt = x ? await textAuslesen(x.bytes, x.eintrag.datei.typ) : null;
        if (!inhalt?.text) { teile.push('(kein Text lesbar)'); continue; }
        const text = inhalt.text.slice(0, rest);
        rest -= text.length;
        teile.push(`${text}${inhalt.text.length > text.length ? `\n[… weitere ${inhalt.text.length - text.length} Zeichen nicht gelesen]` : ''}`);
      } catch { teile.push('(Inhalt nicht lesbar)'); }
    }
    for (const d of amProjekt) teile.push(`Datei am Projekt: ${zeile(d)} (Inhalt nicht gelesen)`);
    return teile.join('\n\n');
  } catch { return ''; }
}

async function crmFuer(t: Task): Promise<string> {
  if (!t.bezug) return '';
  try {
    const kontakte = t.bezug.kontaktId ? ((await loadJson<{ kontakte?: KontaktKurz[] }>('kontakte'))?.kontakte ?? []) : [];
    const crm = (t.bezug.firmaId || t.bezug.mandatId || t.bezug.dealId) ? ((await loadJson<CrmKurz>('crm')) ?? {}) : {};
    return crmKurzinfo(t.bezug, kontakte, crm);
  } catch { return ''; }
}

/** Zurück auf „offen“ (Modell nicht erreichbar, leere Antwort) — die Aufgabe geht beim nächsten Lauf wieder mit. */
async function zurueckAufOffen(t: Task, person: string): Promise<void> {
  await aufgabeZoeAendern(t.id, x => (x.zoe?.status === 'in_arbeit' ? { task: { ...x, zoe: { ...x.zoe, status: 'offen' } } } : { status: 409, fehler: 'nicht mehr in Arbeit' }), { person, zoe: true }).catch(() => null);
}

/**
 * Den Lauf ausführen. `person` = nur deren Aufträge (Knopf); `null` = Systemlauf (alle Auftraggeberinnen des
 * Haushalts, je Auftrag in deren Namen). Wirft nicht.
 */
export async function zoeAufgabenLauf(opt: { person: string | null; max?: number; nur?: string; jetzt?: Date }): Promise<LaufErgebnis> {
  const max = Math.max(1, Math.min(LAUF_MAX, Math.floor(opt.max ?? LAUF_STANDARD)));
  const leer = (ohneKi: string, rest: number): LaufErgebnis => ({ ok: true, bearbeitet: [], uebersprungen: [], ohneKi, rest });
  const jetzt = (opt.jetzt ?? new Date()).toISOString();
  const kandidaten = (state: TasksState) => zoeZuBearbeiten(state.tasks, { person: opt.person, jetzt }).filter(t => !opt.nur || t.id === opt.nur);
  if (laeuft) return leer('ZOE arbeitet schon — gleich noch einmal.', kandidaten(await ladeAufgabenSicht()).length);
  if (!hasAnthropicKey() || guthabenLeer()) return leer(!hasAnthropicKey() ? 'kein Modell-Schlüssel hinterlegt' : 'Guthaben leer', kandidaten(await ladeAufgabenSicht()).length);
  laeuft = true;
  const erg: LaufErgebnis = { ok: true, bearbeitet: [], uebersprungen: [], rest: 0 };
  try {
    const state = await ladeAufgabenSicht();
    const liste = kandidaten(state);
    for (const t of liste.slice(0, max)) {
      const a = auftraggeberinVon(t);
      if (!a || !(await personImHaushaltDesInhabers(a))) { erg.uebersprungen.push({ id: t.id, grund: 'keine Auftraggeberin im Haushalt' }); continue; }
      // 1) In Arbeit nehmen — mit Stand: hat jemand gerade geändert oder ein zweiter Lauf sie genommen, nicht doppelt.
      const genommen = await aufgabeZoeAendern(t.id, x => (x.zoe && (x.zoe.status === 'offen' || x.zoe.status === 'in_arbeit') ? { task: { ...x, zoe: { ...x.zoe, status: 'in_arbeit' } } } : { status: 409, fehler: 'nicht mehr offen' }), { person: a, zoe: true });
      if (!genommen.ok) { erg.uebersprungen.push({ id: t.id, grund: genommen.fehler }); continue; }
      const aktuell = genommen.wert;
      // 2) Auftrag bauen und EIN Modellaufruf — ohne Werkzeuge: ZOE kann hier nichts tun außer antworten.
      const alt = aktuell.zoe?.stapelId ? await hole(aktuell.zoe.stapelId) : null;
      const text = auftragText(aktuell, {
        state: await ladeAufgabenSicht(), heute: localDay(), crm: await crmFuer(aktuell), dateien: await unterlagenFuer(aktuell, a), hinweis: zoeHinweis(aktuell),
        abgelehnt: alt?.status === 'abgelehnt' && alt.bezug?.id === aktuell.id ? (alt.grund ?? 'ohne Grund') : null,
      });
      const r = await askText({ system: ZOE_AUFGABEN_SYSTEM, user: text, schema: SCHEMA as unknown as Record<string, unknown>, maxTokens: 4000, zweck: 'zoe-aufgaben', timeoutMs: 90_000, retries: 1 });
      if (!r.ok) {
        await zurueckAufOffen(aktuell, a);
        erg.uebersprungen.push({ id: t.id, grund: `Modell: ${(r.error ?? 'nicht erreichbar').slice(0, 120)}` });
        if (r.error === 'guthaben-leer' || r.error === 'no-key') break;
        continue;
      }
      const inhalt: ZoeVorschlagInhalt | null = vorschlagSauber(extractJson<Record<string, unknown>>(r.text), aktuell.id);
      if (!inhalt) { await zurueckAufOffen(aktuell, a); erg.uebersprungen.push({ id: t.id, grund: 'Antwort ohne verwertbaren Vorschlag' }); continue; }
      // 3) NUR ein Vorschlag im Stapel — die Aufgabe bleibt inhaltlich, wie sie ist.
      const titel = `ZOE-Vorschlag für „${aktuell.title.length > 80 ? `${aktuell.title.slice(0, 79)}…` : aktuell.title}“ übernehmen`;
      const v = await lege({
        werkzeug: ZOE_AUFGABE_WERKZEUG, gruppe: 'aufgaben', titel, nachher: vorschlagZeile(inhalt),
        eingabe: { ...inhalt } as unknown as Record<string, unknown>, anlass: inhalt.zusammenfassung, person: a, quelle: 'lauf',
        bezug: { art: 'aufgabe', id: aktuell.id },
      });
      await notiere({ werkzeug: ZOE_AUFGABE_WERKZEUG, gruppe: 'aufgaben', risiko: 'freigabe', eingabe: { aufgabeId: aktuell.id }, ergebnis: `in den Stapel gelegt (${v.id})`, ok: true, quelle: 'zoe', person: a, ruecknahme: null });
      const gesetzt = await aufgabeZoeAendern(aktuell.id, x => (x.zoe?.status === 'in_arbeit' ? { task: { ...x, zoe: { ...x.zoe, status: 'wartet_freigabe', stapelId: v.id } } } : { status: 409, fehler: 'nicht mehr in Arbeit' }), { person: a, zoe: true });
      if (!gesetzt.ok) { erg.uebersprungen.push({ id: t.id, grund: `Vorschlag liegt im Stapel, Aufgabe nicht umgestellt: ${gesetzt.fehler}` }); continue; }
      erg.bearbeitet.push({ id: aktuell.id, titel: aktuell.title, stapelId: v.id });
      await melde({ an: a, art: 'zoe', titel: `ZOE hat „${aktuell.title.length > 80 ? `${aktuell.title.slice(0, 79)}…` : aktuell.title}“ vorbereitet`, link: WEG.aufgabe(aktuell.id), von: 'zoe', bezug: { art: 'aufgabe', id: aktuell.id } });
    }
    erg.rest = kandidaten(await ladeAufgabenSicht()).length;
    return erg;
  } catch (e) {
    return { ...erg, ok: false, uebersprungen: [...erg.uebersprungen, { id: '', grund: e instanceof Error ? e.message.slice(0, 160) : 'Fehler' }] };
  } finally {
    laeuft = false;
  }
}

/** Für den Takt: steht heute ein Lauf an? Nur, wenn etwas offen liegt — sonst kein Eintrag in der Warteschlange. */
export async function zoeAufgabenFaellig(jetzt: Date = new Date()): Promise<boolean> {
  const state = await ladeAufgabenSicht();
  return zoeZuBearbeiten(state.tasks, { person: null, jetzt: jetzt.toISOString() }).length > 0;
}
