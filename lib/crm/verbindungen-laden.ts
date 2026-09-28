// ─── Markttraktion · Verbindungsprüfung: Bestände laden (Server, 28.09.) ─────
// Holt alles, was lib/crm/verbindungen.ts prüft, aus den Speichern — nur lesen.
// Die Dateiablage liefert nur Kennungen (Metadaten + welche .bin auf der Platte
// liegen), nie Inhalte. Fokus-Blöcke kommen je Person des Haushalts des Inhabers;
// geprüft wird nur ihr Verweis `aufgabeId`.

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner, loadJson, speicherStand } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import type { TasksState } from '@/types/tasks';
import type { ZeitDatei } from '@/lib/zeitmessung/modell';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { DATEI_ID } from '@/lib/dateien/regeln';
import { ladeCrm, CRM_SPEICHER } from './speicher';
import { KONFLIKT_SPEICHER, type KonfliktStand } from './import-konflikte';
import { ladeKonten } from '@/lib/zugang/konten';
import { speicherFuer } from '@/lib/zoe/raum';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import type { AufgabeKurz, RechnungKurz, VerbindungsBestaende } from './verbindungen';
import { HEADS } from '@/lib/heads/prompt';
import { standName } from '@/lib/heads/stand';

interface Quellen { haushalt: string | null; personen: string[] }

/** Haushalt des Inhabers und seine Personen (für Fokus-Blöcke) — ohne Haushalt nur der Inhaber. */
async function quellen(): Promise<Quellen> {
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  const h = inhaber?.haushalt && HAUSHALT_OK.test(inhaber.haushalt) ? inhaber.haushalt : null;
  const personen = konten.filter(k => k.speicher === inhaber?.speicher || (!!h && k.haushalt === h)).map(k => k.speicher);
  return { haushalt: h, personen: Array.from(new Set(personen)) };
}

/** Die Speicher, deren Stand das ETag der Prüfung bestimmt. */
function speicherNamen(q: Quellen): string[] {
  return ['kontakte', CRM_SPEICHER, 'finanzplan', 'tasks', 'ordnung', KONFLIKT_SPEICHER, 'liquiplan', ...HEADS.map(h => standName(h)),
    ...(q.haushalt ? [`planung-einheiten--${q.haushalt}`, `crm-dateien--${q.haushalt}`] : []),
    ...q.personen.map(p => speicherFuer('zeit', p))];
}

const dateiOrdner = (h: string) => path.join(datenOrdner(), 'dateien', h);

/** Stand aller beteiligten Speicher plus Ordner der Ablage — Grundlage für das ETag (304 ohne Rechnen). */
export async function verbindungsStand(): Promise<string> {
  const q = await quellen();
  const ordner = q.haushalt ? await fs.stat(dateiOrdner(q.haushalt)).then(s => Math.round(s.mtimeMs).toString(36)).catch(() => '0') : '0';
  return `${await speicherStand(speicherNamen(q))}-${ordner}`;
}

/** Kennungen der Dateien, die im Ordner des Haushalts liegen (ohne .tmp). */
async function aufPlatte(h: string): Promise<string[]> {
  try {
    return (await fs.readdir(dateiOrdner(h))).filter(n => n.endsWith('.bin')).map(n => n.slice(0, -4)).filter(id => DATEI_ID.test(id));
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw e;
  }
}

/** Alles, was die Verbindungsprüfung braucht — nur lesen. */
export async function ladeVerbindungsBestaende(heute: string): Promise<VerbindungsBestaende & { haushalt: string | null }> {
  const q = await quellen();
  // Seit 28.09. abends: Planposten-Kennungen (Mandat → Liquiditätsplan) und Head-Vorschläge (nur Kennung, Person, Status).
  const [liquiplan, heads] = await Promise.all([
    loadJson<{ posten?: { id: string }[] }>('liquiplan'),
    Promise.all(HEADS.map(async h => ({ head: h, stand: await loadJson<{ vorschlaege?: { id: string; kontakt_id?: string | null; status?: string }[] }>(standName(h)) }))),
  ]);
  const [kontakte, crm, finanz, tasks, ordnung, einheiten, konflikte, ablage, dateien, zeiten] = await Promise.all([
    loadJson<{ kontakte?: Kontakt[] }>('kontakte'),
    ladeCrm(),
    loadJson<{ rechnungen?: RechnungKurz[]; firmen?: { id: string }[] }>('finanzplan'),
    loadJson<TasksState>('tasks'),
    loadJson<{ orgs?: Record<string, string> }>('ordnung'),
    q.haushalt ? loadJson<{ eigene?: string[] }>(`planung-einheiten--${q.haushalt}`) : Promise.resolve(null),
    loadJson<KonfliktStand>(KONFLIKT_SPEICHER),
    q.haushalt ? loadJson<{ eintraege?: DateiEintrag[] }>(`crm-dateien--${q.haushalt}`) : Promise.resolve(null),
    q.haushalt ? aufPlatte(q.haushalt) : Promise.resolve([] as string[]),
    Promise.all(q.personen.map(async p => ({ person: p, datei: await loadJson<ZeitDatei>(speicherFuer('zeit', p)) }))),
  ]);
  const aufgaben: AufgabeKurz[] = (Array.isArray(tasks?.tasks) ? tasks!.tasks : []).map(t => ({ id: t.id, title: t.title, ...(t.description ? { description: t.description } : {}), projectId: t.projectId, status: t.status, ...(t.space ? { space: t.space } : {}), ...(t.einheit ? { einheit: t.einheit } : {}) }));
  return {
    heute,
    haushalt: q.haushalt,
    kontakte: Array.isArray(kontakte?.kontakte) ? kontakte!.kontakte : [],
    crm,
    finanzplan: finanz ? { rechnungen: Array.isArray(finanz.rechnungen) ? finanz.rechnungen : [], firmen: (Array.isArray(finanz.firmen) ? finanz.firmen : []).map(f => f.id) } : null,
    aufgaben: tasks ? { liste: aufgaben, orte: ordnung?.orgs && typeof ordnung.orgs === 'object' ? ordnung.orgs : {}, eigeneEinheiten: Array.isArray(einheiten?.eigene) ? einheiten!.eigene : [] } : null,
    fokus: zeiten.map(z => ({ person: z.person, bloecke: Object.values(z.datei?.tage ?? {}).flatMap(t => (Array.isArray(t?.bloecke) ? t.bloecke : [])) })),
    dateien: q.haushalt ? { eintraege: Array.isArray(ablage?.eintraege) ? ablage!.eintraege : [], aufPlatte: dateien } : null,
    konflikte: konflikte ?? null,
    liquiplan: liquiplan ? { posten: (Array.isArray(liquiplan.posten) ? liquiplan.posten : []).map(p => p.id) } : null,
    heads: heads.map(h => ({ head: h.head, vorschlaege: (Array.isArray(h.stand?.vorschlaege) ? h.stand!.vorschlaege : []).map(v => ({ id: v.id, ...(v.kontakt_id ? { kontakt_id: v.kontakt_id } : {}), ...(v.status ? { status: v.status } : {}) })) })),
  };
}
