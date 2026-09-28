// ─── Löschfristen: der tägliche Takt-Lauf (28.09., U2 #52, Server) ───────────
// Einmal am Tag (lib/zoe/takt.ts → Systemlauf „loeschfristen“, Tagesmarke im Bestand
// `crm-loeschfristen`). Zwei Wirkungen, streng getrennt:
//
//  · PERSONEN werden NIE automatisch gelöscht. Stehen Kontakte über der Frist
//    (lib/crm/loeschfristen.ts `kontakteUeberFrist`), gibt es EINE laufende Aufgabe
//    „n Kontakte über der Löschfrist — prüfen: löschen oder begründen“ mit Link auf
//    Stammdaten › Datenschutz (dort die Liste mit Kennungen und „Frist verlängern mit
//    Grund“). Keine Kennung und kein Name in der Aufgabe. Ist die Liste leer, wird sie erledigt.
//  · TECHNISCHE Bestände werden nach Frist bereinigt — mit Protokolleintrag „System“:
//    Import-Konflikte, Import-Läufe, Heads-Replay, Signal-Texte (Betreff/Titel), Monatsdateien
//    des Änderungsprotokolls. Eingeschränkte Personen (Art. 18) fasst der Lauf nicht an.

import { promises as fs } from 'fs';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from './speicher';
import { KONFLIKT_SPEICHER, type KonfliktStand } from './import-konflikte';
import { laufHaushalte, laufName, laeufeAufraeumen, type LaufBestand } from './import-lauf';
import { HEADS } from '@/lib/heads/prompt';
import type { ReplayStand } from '@/lib/heads/lauf';
import type { SignalStand } from './person-bestaende';
import { ladeKonten } from '@/lib/zugang/konten';
import { protokolliere, PROTOKOLL_PRAEFIX, type ProtokollDatei } from '@/lib/store/aenderungsprotokoll';
import {
  LOESCHFRISTEN_SPEICHER, fristenWirksam, stichtag, kontakteUeberFrist, signalTexteBereinigen, replayBereinigen, protokollMonateUeberFrist,
  type LoeschfristenBestand,
} from './loeschfristen';

/** Kennung der einen laufenden Aufgabe (nie mehrere, nie mit Personen). */
export const LOESCHFRIST_AUFGABE = 'loeschfrist-kontakte';

interface Aufgabe { id: string; title: string; description?: string; status: string; priority: string; assignee?: string; tags?: string[]; subTasks?: unknown[]; dependencies?: unknown[]; sortOrder?: number; createdAt?: string; updatedAt?: string; space?: 'privat' | 'business' }

const SYSTEM = { art: 'system' as const };
const PROTOKOLL_DATEI = new RegExp(`^${PROTOKOLL_PRAEFIX}--([a-z0-9-]+)--(\\d{4}-\\d{2})\\.json$`);

export interface LaufErgebnis { ok: boolean; uebersprungen?: boolean; ueberFrist: number; bereinigt: Record<string, number>; aufgabe: 'neu' | 'aktualisiert' | 'erledigt' | 'unveraendert' | 'keine'; text: string }

/**
 * Den Lauf ausführen. `erzwingen` übergeht die Tagesmarke (Knopf, Tests). Wirft nie wegen eines einzelnen
 * Bestands — was scheitert, steht im Server-Log, der Rest läuft weiter.
 */
export async function loeschfristenLauf(jetzt = new Date(), erzwingen = false): Promise<LaufErgebnis> {
  const heute = localDay(jetzt);
  const jetztIso = jetzt.toISOString();
  const b = (await loadJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER)) ?? {};
  if (!erzwingen && b.lauf?.tag === heute) return { ok: true, uebersprungen: true, ueberFrist: b.lauf.ueberFrist, bereinigt: {}, aufgabe: 'unveraendert', text: 'Heute schon gelaufen.' };
  const f = fristenWirksam(b.fristen);
  const bereinigt: Record<string, number> = {};
  const zaehle = (name: string, n: number) => { if (n) bereinigt[name] = (bereinigt[name] ?? 0) + n; };
  const schritt = async (name: string, tun: () => Promise<void>) => { try { await tun(); } catch (e) { console.error(`[loeschfristen] ${name}:`, e instanceof Error ? e.message : e); } };

  // 1 · Personen über der Frist → Aufgabe (nie löschen)
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const ueber = kontakteUeberFrist(kontakte, crm, heute, f.kontakte);
  const aufgabe = await aufgabeAbgleichen(ueber.length, f.kontakte, jetztIso);

  // 2 · Import-Konflikte
  await schritt('import-konflikte', async () => {
    const grenze = stichtag('import-konflikte', f['import-konflikte'], heute);
    let n = 0;
    if ((await loadJson<KonfliktStand>(KONFLIKT_SPEICHER)) === null) return; // nie einen leeren Bestand anlegen
    await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => {
      const s = cur!;
      if (!s.stand || s.stand.slice(0, 10) >= grenze || (!s.konflikte.length && !s.moeglicheDubletten.length)) return s;
      n = s.konflikte.length + s.moeglicheDubletten.length;
      return { ...s, konflikte: [], moeglicheDubletten: [] };
    });
    if (n) { zaehle(KONFLIKT_SPEICHER, n); await protokolliere(KONFLIKT_SPEICHER, [{ op: 'geaendert', id: 'loeschfrist', felder: ['konflikte', 'moeglicheDubletten'] }], SYSTEM); }
  });

  // 3 · Import-Läufe (Frist aus der Tabelle, sonst räumt nur das nächste Ablegen auf)
  await schritt('import-laeufe', async () => {
    for (const h of await laufHaushalte()) {
      let n = 0;
      await updateJson<LaufBestand>(laufName(h), cur => {
        const vorher = cur?.laeufe ?? [];
        const nachher = laeufeAufraeumen(vorher, jetztIso, f['import-laeufe']);
        n = vorher.length - nachher.length;
        return n ? { laeufe: nachher } : (cur ?? { laeufe: [] });
      });
      if (n) { zaehle(laufName(h), n); await protokolliere(laufName(h), [{ op: 'geloescht', id: 'loeschfrist', felder: ['laeufe'] }], SYSTEM); }
    }
  });

  // 4 · Heads-Replay
  await schritt('heads-replay', async () => {
    const grenze = stichtag('heads-replay', f['heads-replay'], heute);
    for (const h of HEADS) {
      const name = `heads-replay-${h}`;
      if ((await loadJson<ReplayStand>(name)) === null) continue;
      let n = 0;
      await updateJson<ReplayStand>(name, cur => { const r = replayBereinigen(cur?.faelle ?? [], grenze); n = r.n; return n ? { faelle: r.faelle } : (cur ?? { faelle: [] }); });
      if (n) { zaehle(name, n); await protokolliere(name, [{ op: 'geloescht', id: 'loeschfrist', felder: ['faelle'] }], SYSTEM); }
    }
  });

  // 5 · Signale: Betreff/Termintitel an den Personen (Ereignis bleibt) und veraltete kommende Termine
  await schritt('signale', async () => {
    const grenze = stichtag('signale', f.signale, heute);
    let n = 0;
    const geaendert: string[] = [];
    await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
      const bestand = cur ?? { kontakte: [] };
      let anders = false;
      const neu = bestand.kontakte.map(k => {
        if (k.eingeschraenkt) return k; // Art. 18: aufbewahren, nicht anfassen
        const r = signalTexteBereinigen(k, grenze);
        if (!r.n) return k;
        n += r.n; anders = true; geaendert.push(k.id);
        return r.kontakt;
      });
      return anders ? { ...bestand, kontakte: neu } : bestand;
    });
    if (n) { zaehle('kontakte (Signal-Texte)', n); await protokolliere('kontakte', geaendert.map(id => ({ op: 'geaendert' as const, id, felder: ['aktivitaeten'] })), SYSTEM); }
    if ((await loadJson<SignalStand>('crm-signale')) !== null) {
      let m = 0;
      await updateJson<SignalStand>('crm-signale', cur => {
        const kommend = cur?.kommend ?? {};
        const bleiben = Object.fromEntries(Object.entries(kommend).filter(([, t]) => (t.start ?? '').slice(0, 10) >= grenze));
        m = Object.keys(kommend).length - Object.keys(bleiben).length;
        return m ? { ...(cur ?? {}), kommend: bleiben } : (cur ?? {});
      });
      if (m) { zaehle('crm-signale', m); await protokolliere('crm-signale', [{ op: 'geaendert', id: 'loeschfrist', felder: ['kommend'] }], SYSTEM); }
    }
  });

  // 6 · Änderungsprotokoll: Monatsdateien ganz vor der Frist leeren (Vermerk bleibt, die Datei nicht gelöscht)
  await schritt('aenderungsprotokoll', async () => {
    const grenze = stichtag('aenderungsprotokoll', f.aenderungsprotokoll, heute);
    const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
    const jeHaushalt = new Map<string, string[]>();
    for (const d of namen) { const m = PROTOKOLL_DATEI.exec(d); if (m) jeHaushalt.set(m[1], [...(jeHaushalt.get(m[1]) ?? []), m[2]]); }
    for (const [h, monate] of Array.from(jeHaushalt)) {
      for (const monat of protokollMonateUeberFrist(monate, grenze)) {
        const name = `${PROTOKOLL_PRAEFIX}--${h}--${monat}`;
        let n = 0;
        await updateJson<ProtokollDatei & { bereinigt?: { am: string; eintraege: number; grund: string } }>(name, cur => {
          n = cur?.eintraege?.length ?? 0;
          return n ? { eintraege: [], bereinigt: { am: jetztIso, eintraege: n, grund: `Löschfrist ${f.aenderungsprotokoll} Monate (System)` } } : (cur ?? { eintraege: [] });
        });
        zaehle(name, n);
      }
    }
  });

  await updateJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER, cur => ({ ...(cur ?? {}), lauf: { tag: heute, am: jetztIso, ueberFrist: ueber.length, bereinigt } }));
  const summe = Object.values(bereinigt).reduce((a, x) => a + x, 0);
  return {
    ok: true, ueberFrist: ueber.length, bereinigt, aufgabe,
    text: `${ueber.length} ${ueber.length === 1 ? 'Kontakt' : 'Kontakte'} über der Frist (Aufgabe ${aufgabe}) · ${summe} technische Einträge bereinigt`,
  };
}

/** Die eine Aufgabe führen: anlegen, Zahl nachziehen oder erledigen. Nie Kennungen oder Namen im Text. */
async function aufgabeAbgleichen(n: number, monate: number, jetztIso: string): Promise<LaufErgebnis['aufgabe']> {
  const inhaber = (await ladeKonten()).konten.find(k => k.rolle === 'inhaber')?.speicher;
  let wirkung: LaufErgebnis['aufgabe'] = 'keine';
  // Nichts über der Frist und noch keine Aufgaben-Liste: nichts anlegen.
  if (!n && (await loadJson<unknown>('tasks')) === null) return wirkung;
  const titel = `${n} ${n === 1 ? 'Kontakt' : 'Kontakte'} über der Löschfrist — prüfen: löschen oder begründen`;
  const beschreibung = `Seit ${monate} Monaten ohne Beziehung und ohne Aktivität (Art. 5 Abs. 1 lit. e DSGVO). Gelöscht wird nie automatisch: je Person löschen (Art. 17) oder „Frist verlängern mit Grund“ — Liste unter ${WEG.stammdaten('datenschutz')}. Hinweis, keine Rechtsberatung.`;
  await updateJson<{ tasks?: Aufgabe[] } & Record<string, unknown>>('tasks', cur => {
    const t = cur ?? { tasks: [] };
    const tasks = [...(t.tasks ?? [])];
    const i = tasks.findIndex(a => a.id === LOESCHFRIST_AUFGABE);
    const offen = i >= 0 && tasks[i].status !== 'done';
    if (!n) {
      if (!offen) { wirkung = 'keine'; return t; }
      tasks[i] = { ...tasks[i], status: 'done', updatedAt: jetztIso }; wirkung = 'erledigt';
      return { ...t, tasks };
    }
    if (offen) {
      if (tasks[i].title === titel) { wirkung = 'unveraendert'; return t; }
      tasks[i] = { ...tasks[i], title: titel, description: beschreibung, updatedAt: jetztIso }; wirkung = 'aktualisiert';
      return { ...t, tasks };
    }
    const neu: Aufgabe = { id: LOESCHFRIST_AUFGABE, title: titel, description: beschreibung, status: 'todo', priority: 'medium', ...(inhaber ? { assignee: inhaber } : {}), tags: ['datenschutz', 'markttraktion'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetztIso, updatedAt: jetztIso, space: 'business' };
    if (i >= 0) tasks[i] = { ...tasks[i], ...neu, createdAt: tasks[i].createdAt ?? jetztIso }; else tasks.push(neu);
    wirkung = 'neu';
    return { ...t, tasks };
  });
  return wirkung;
}
