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
//
// 29.09. (Paket D-B): zuerst — auch wenn der Tageslauf schon gelaufen ist — die GRABSTEINE anwenden, sobald sie sich seit
// dem letzten Mal geändert haben (nach einem Restore: immer, lib/datenschutz/grabsteine.ts). Danach im Tageslauf:
// Fingerabdrücke v1 → v2 umrechnen (einmal je Pepper: Sperrliste, Änderungsprotokoll, ZOE-Entscheidungen — nur für
// Kontakte, die es noch gibt), Löschprotokoll ohne Klartext-Kennung, und die neuen Löschklassen (ZOE-Arbeitslisten,
// ZOE-Entscheidungen, ZOE-Verlauf, ZOE-Gedächtnis, Postfach-/Kalender-Zwischenspeicher, Umzugs-Kopien im Archiv,
// Grabsteine); der Altbestand Netzwerk zählt in die Löschfrist-Aufgabe (nie automatisch).

import { promises as fs } from 'fs';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import { systemAufgabenAendern } from '@/lib/aufgaben/system-schreiben';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from './speicher';
import { netzwerkenMedienAufraeumen, infoBereinigen, protokolleBereinigen, netzwerkenKontakteUeberFrist } from './netzwerken-loeschen';
import { journalAufraeumen } from './uebergabe-journal';
import { KONFLIKT_SPEICHER, type KonfliktStand } from './import-konflikte';
import { laufHaushalte, laufName, laeufeAufraeumen, type LaufBestand } from './import-lauf';
import { HEADS } from '@/lib/heads/prompt';
import type { ReplayStand } from '@/lib/heads/lauf';
import type { SignalStand } from './person-bestaende';
import { ladeKonten } from '@/lib/zugang/konten';
import { protokolliere, PROTOKOLL_PRAEFIX, type ProtokollDatei } from '@/lib/store/aenderungsprotokoll';
import {
  LOESCHFRISTEN_SPEICHER, fristenWirksam, stichtag, kontakteUeberFrist, signalTexteBereinigen, replayBereinigen, protokollMonateUeberFrist,
  vorGrenzeRaus, istUmzugsKopie, archivTag, netzwerkUeberFrist, type LoeschfristenBestand,
} from './loeschfristen';
import path from 'path';
import { ENTSCHEIDUNGEN_PRAEFIX } from '@/lib/zoe/entscheidungen';
import { protokollKennungV1, protokollKennung } from '@/lib/store/aenderungsprotokoll';
import { pepperFingerabdruck } from '@/lib/datenschutz/pepper';
import { formatModus } from '@/lib/store/huelle.mjs';
import { sperrlisteMigrieren } from './sperrliste';
import { loeschprotokollBereinigen } from './loeschprotokoll';

/** Kennung der einen laufenden Aufgabe (nie mehrere, nie mit Personen). */
export const LOESCHFRIST_AUFGABE = 'loeschfrist-kontakte';


const SYSTEM = { art: 'system' as const };
const PROTOKOLL_DATEI = new RegExp(`^${PROTOKOLL_PRAEFIX}--([a-z0-9-]+)--(\\d{4}-\\d{2})\\.json$`);

export interface LaufErgebnis { ok: boolean; uebersprungen?: boolean; ueberFrist: number; bereinigt: Record<string, number>; aufgabe: 'neu' | 'aktualisiert' | 'erledigt' | 'unveraendert' | 'keine'; text: string; grabsteine?: { entfernt: number; uebersprungen: boolean } }

/** Marke der einmaligen Umrechnung v1 → v2 je Pepper (nur Zahlen). */
export const MIGRATION_SPEICHER = 'datenschutz-migration';
interface Migration { v2?: { pepper: string; am: string; sperrliste: number; protokoll: number } }
const ENTSCHEIDUNGS_DATEI = new RegExp(`^${ENTSCHEIDUNGEN_PRAEFIX}--([a-z0-9-]+)--(\\d{4}-\\d{2})\\.json$`);

/**
 * Den Lauf ausführen. `erzwingen` übergeht die Tagesmarke (Knopf, Tests). Wirft nie wegen eines einzelnen
 * Bestands — was scheitert, steht im Server-Log, der Rest läuft weiter.
 */
export async function loeschfristenLauf(jetzt = new Date(), erzwingen = false): Promise<LaufErgebnis> {
  const heute = localDay(jetzt);
  const jetztIso = jetzt.toISOString();
  // 0 · Grabsteine (29.09., #70) — vor der Tagesmarke: nach einem Restore sofort beim nächsten Takt.
  let grabsteine: LaufErgebnis['grabsteine'];
  try {
    const { grabsteineAnwenden } = await import('@/lib/datenschutz/grabsteine');
    const r = await grabsteineAnwenden({ jetzt });
    grabsteine = { entfernt: r.entfernt, uebersprungen: r.uebersprungen };
  } catch (e) { console.error('[loeschfristen] Grabsteine nicht angewendet:', e instanceof Error ? e.message : e); }
  const b = (await loadJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER)) ?? {};
  if (!erzwingen && b.lauf?.tag === heute) return { ok: true, uebersprungen: true, ueberFrist: b.lauf.ueberFrist, bereinigt: {}, aufgabe: 'unveraendert', text: 'Heute schon gelaufen.', ...(grabsteine ? { grabsteine } : {}) };
  const f = fristenWirksam(b.fristen);
  const bereinigt: Record<string, number> = {};
  const zaehle = (name: string, n: number) => { if (n) bereinigt[name] = (bereinigt[name] ?? 0) + n; };
  const schritt = async (name: string, tun: () => Promise<void>) => { try { await tun(); } catch (e) { console.error(`[loeschfristen] ${name}:`, e instanceof Error ? e.message : e); } };

  // 1 · Personen über der Frist → Aufgabe (nie löschen)
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const ueber = kontakteUeberFrist(kontakte, crm, heute, f.kontakte);
  const netz = netzwerkUeberFrist((await loadJson<{ kontakte?: { letzterKontakt?: string }[] }>('netzwerk'))?.kontakte, heute, f.netzwerk);
  // Netzwerken (03.10.): Personen aus „Netzwerken“ ohne Interaktion seit 12 Monaten — eigene, kürzere Frist, dieselbe Prüf-Aufgabe (nie löschen).
  const nwUeber = netzwerkenKontakteUeberFrist(kontakte, crm, heute, f['netzwerken-kontakte'], new Set(ueber.map(x => x.id)));
  const aufgabe = await aufgabeAbgleichen(ueber.length, f.kontakte, jetztIso, netz, nwUeber.length, f['netzwerken-kontakte']);

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

  // 7 · Fingerabdrücke v1 → v2 (29.09., #71/#68) — einmal je Pepper, nur für Kontakte, die es noch gibt.
  // Nicht im Kompatibilitätsmodus (MAKE_OS_FORMAT, Standard): der alte Stand aeb4964 prüft Sperren nur mit v1 und löst im
  // Änderungsprotokoll nur v1-Kennungen auf. Die Marke bleibt dann ungesetzt — nach der Umstellung auf v2 läuft es von selbst.
  await schritt('migration-v2', async () => {
    const pf = pepperFingerabdruck();
    if (!pf || formatModus() !== 'v2') return;
    const m = (await loadJson<Migration>(MIGRATION_SPEICHER)) ?? {};
    if (m.v2?.pepper === pf) return;
    const sperr = await sperrlisteMigrieren(kontakte);
    const karte = new Map(kontakte.filter(k => /^c-/.test(k.id)).map(k => [protokollKennungV1(k.id), protokollKennung(k.id)]));
    let prot = 0;
    const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
    for (const d of namen) {
      const name = PROTOKOLL_DATEI.test(d) || ENTSCHEIDUNGS_DATEI.test(d) ? d.slice(0, -5) : null;
      if (!name || !karte.size) continue;
      await updateJson<{ eintraege?: { id?: string; bezug?: { art: string; id: string } }[] } & Record<string, unknown>>(name, cur => {
        let n = 0;
        const um = (x: string) => x.split(':').map(t => { const v = karte.get(t); if (v) n++; return v ?? t; }).join(':');
        const eintraege = (cur?.eintraege ?? []).map(e => {
          const id = typeof e.id === 'string' ? um(e.id) : e.id;
          const bezug = e.bezug ? { ...e.bezug, id: um(e.bezug.id) } : e.bezug;
          return id === e.id && (!e.bezug || bezug!.id === e.bezug.id) ? e : { ...e, id, ...(bezug ? { bezug } : {}) };
        });
        prot += n;
        return n ? { ...(cur ?? {}), eintraege } : (cur as never);
      });
    }
    await updateJson<Migration>(MIGRATION_SPEICHER, cur => ({ ...(cur ?? {}), v2: { pepper: pf, am: jetztIso, sperrliste: sperr, protokoll: prot } }));
    zaehle('v2-umgerechnet', sperr + prot);
  });

  // 8 · Löschprotokoll ohne Klartext-Kennung (29.09., #30)
  await schritt('loeschprotokoll', async () => { zaehle('crm-loeschprotokoll', await loeschprotokollBereinigen()); });

  // 9 · ZOE-Arbeitslisten (90 Tage): Protokoll + entschiedene Vorschläge — nur dauerhaft Festgehaltenes (#93)
  await schritt('zoe-arbeitslisten', async () => {
    const grenze = stichtag('zoe-arbeitslisten', f['zoe-arbeitslisten'], heute);
    const { protokollFrist } = await import('@/lib/zoe/protokoll');
    const { stapelFrist } = await import('@/lib/zoe/stapel');
    zaehle('zoe-protokoll', await protokollFrist(grenze));
    zaehle('zoe-stapel', await stapelFrist(grenze));
  });

  // 10 · ZOE-Entscheidungen (36 Monate): Monatsdateien vor der Frist leeren (Vermerk bleibt)
  await schritt('zoe-entscheidungen', async () => {
    const grenzMonat = stichtag('zoe-entscheidungen', f['zoe-entscheidungen'], heute).slice(0, 7);
    for (const d of await fs.readdir(datenOrdner()).catch(() => [] as string[])) {
      const m = ENTSCHEIDUNGS_DATEI.exec(d);
      if (!m || m[2] >= grenzMonat) continue;
      let n = 0;
      await updateJson<{ eintraege: unknown[]; bereinigt?: unknown }>(d.slice(0, -5), cur => {
        n = cur?.eintraege?.length ?? 0;
        return n ? { eintraege: [], bereinigt: { am: jetztIso, eintraege: n, grund: `Löschfrist ${f['zoe-entscheidungen']} Monate (System)` } } : (cur ?? { eintraege: [] });
      });
      zaehle(d.slice(0, -5), n);
    }
  });

  // 11 · Gespräche, Gedächtnis, Postfach- und Kalender-Zwischenspeicher (nur Bestände, die es gibt)
  const kuerzen = async <T,>(name: string, feld: string, frist: Parameters<typeof stichtag>[0], tagVon: (x: T) => unknown) => {
    await schritt(name, async () => {
      if ((await loadJson<unknown>(name)) === null) return;
      const grenze = stichtag(frist, f[frist], heute);
      let n = 0;
      await updateJson<Record<string, unknown>>(name, cur => {
        const r = vorGrenzeRaus<T>((cur?.[feld] as T[]) ?? [], grenze, tagVon);
        n = r.n;
        return n ? { ...(cur ?? {}), [feld]: r.liste } : (cur as Record<string, unknown>);
      });
      if (n) { zaehle(name, n); await protokolliere(name, [{ op: 'geloescht', id: 'loeschfrist', felder: [feld] }], SYSTEM); }
    });
  };
  await kuerzen<{ zuletzt?: string }>('zoe-verlauf', 'gespraeche', 'zoe-verlauf', g => g.zuletzt);
  await kuerzen<{ tag?: string; zeit?: string }>('zoe-gedaechtnis', 'fakten', 'zoe-gedaechtnis', x => x.tag ?? x.zeit);
  await kuerzen<{ receivedAt?: string }>('m365-postfach', 'mails', 'postfach-caches', x => x.receivedAt);
  await kuerzen<{ receivedAt?: string }>('microsoft-inbox', 'emails', 'postfach-caches', x => x.receivedAt);
  await kuerzen<{ receivedAt?: string }>('apple-mail-cache', 'daten', 'postfach-caches', x => x.receivedAt);
  await kuerzen<{ startDate?: string }>('calendar-cache', 'events', 'kalender-caches', x => x.startDate);
  await kuerzen<{ start?: string }>('kemaris-calendar', 'events', 'kalender-caches', x => x.start);
  await schritt('inbox-triage', async () => {
    if ((await loadJson<unknown>('inbox-triage')) === null) return;
    const grenze = stichtag('postfach-caches', f['postfach-caches'], heute);
    let n = 0;
    await updateJson<Record<string, { at?: string }>>('inbox-triage', cur => {
      const alle = Object.entries(cur ?? {});
      const rest = alle.filter(([, v]) => !v?.at || String(v.at).slice(0, 10) >= grenze);
      n = alle.length - rest.length;
      return n ? Object.fromEntries(rest) : (cur ?? {});
    });
    zaehle('inbox-triage', n);
  });

  // 11b · Mail-Spiegel (Gmail in der Inbox, 03.10.): Nachrichten vor der Frist (180 Tage) fallen im Spiegel weg — das Original bleibt in Gmail.
  await schritt('mail-spiegel', async () => {
    const { gmailAufraeumen } = await import('@/lib/gmail/aufraeumen');
    zaehle('gmail-spiegel', await gmailAufraeumen(stichtag('mail-spiegel', f['mail-spiegel'], heute)));
  });

  // 12 · Umzugs- und Aufräum-Kopien im Archiv (30 Tage) — andere Archiv-Dateien bleiben (dokumentiert)
  await schritt('archiv-umzug', async () => {
    const grenze = stichtag('archiv-umzug', f['archiv-umzug'], heute);
    const ordner = path.join(datenOrdner(), 'archiv');
    for (const d of await fs.readdir(ordner).catch(() => [] as string[])) {
      if (!istUmzugsKopie(d)) continue;
      const tag = archivTag(d) ?? localDay(new Date((await fs.stat(path.join(ordner, d)).catch(() => null))?.mtimeMs ?? Date.now()));
      if (tag >= grenze) continue;
      await fs.unlink(path.join(ordner, d));
      zaehle('archiv', 1);
    }
  });

  // 13 · Grabsteine (13 Monate) — außerhalb des Datenordners; die Sperrliste bleibt
  await schritt('grabsteine', async () => {
    const { grabsteineAufraeumen } = await import('@/lib/datenschutz/grabsteine');
    zaehle('grabsteine', await grabsteineAufraeumen(stichtag('grabsteine', f.grabsteine, heute)));
  });

  // 14 · Terminbuchungen der Buchungsseiten (29.09., K4): Endzustände nach der Frist, bestätigte die Frist nach dem Termin.
  await schritt('buchungen', async () => {
    const { buchungenLoeschfrist } = await import('@/lib/kalender/buchung-speicher');
    zaehle('buchung (Terminbuchungen)', await buchungenLoeschfrist(jetzt, f.buchungen));
  });

  // 15 · Netzwerken (03.10., netz-recht): Kartenfotos (6 Monate) und Sprachnotizen (90 Tage), Gesprächs-Info und Zielpersonen (12 Monate nach dem Event),
  //      Übergabe-Protokolle (36 Monate). Personen werden hier nie angefasst (die Prüf-Aufgabe oben).
  await schritt('netzwerken-medien', async () => {
    const r = await netzwerkenMedienAufraeumen(stichtag('netzwerken-karten', f['netzwerken-karten'], heute), stichtag('netzwerken-sprachnotizen', f['netzwerken-sprachnotizen'], heute));
    zaehle('netzwerken-kartenfotos', r.karten); zaehle('netzwerken-sprachnotizen', r.sprachnotizen);
  });
  await schritt('netzwerken-info', async () => {
    const grenze = stichtag('netzwerken-info', f['netzwerken-info'], heute);
    const vorab = infoBereinigen(await ladeCrm(), grenze);
    if (!vorab.info && !vorab.ziele) return; // nichts zu tun: nicht sperren, nichts schreiben
    let info = 0, ziele = 0;
    await aendereCrm(c => { const r = infoBereinigen(c, grenze); info = r.info; ziele = r.ziele; return r.crm; }, SYSTEM);
    zaehle('netzwerken-info', info); zaehle('netzwerken-zielpersonen', ziele);
  });
  await schritt('uebergabe-protokolle', async () => {
    const grenze = stichtag('uebergabe-protokolle', f['uebergabe-protokolle'], heute);
    if (protokolleBereinigen(await ladeCrm(), grenze).n) {
      let n = 0;
      await aendereCrm(c => { const r = protokolleBereinigen(c, grenze); n = r.n; return r.crm; }, SYSTEM);
      zaehle('uebergabe-protokolle', n);
    }
    zaehle('uebergabe-journal', await journalAufraeumen(heute, f['uebergabe-protokolle']));
  });

  // 16 · Bauplan-Bildschirmfotos (05.10., DSGVO-Grundlagen): können Personendaten zeigen — fertige/verworfene Karten nach der Frist,
  //      verwaiste nach 7 Tagen (lib/bauplan/bilder-frist.ts).
  await schritt('bauplan-bilder', async () => {
    const { bauplanBilderAufraeumen } = await import('@/lib/bauplan/speicher');
    zaehle('bauplan-bilder', await bauplanBilderAufraeumen(stichtag('bauplan-bilder', f['bauplan-bilder'], heute), jetzt));
  });

  // 17 · Löschprotokoll selbst (05.10., Zusatz): abgeschlossene Einträge nach der Frist (laufende/unvollständige bleiben).
  await schritt('loeschprotokoll', async () => {
    const { LOESCHPROTOKOLL, protokollUeberFrist } = await import('@/lib/crm/loeschprotokoll');
    const grenze = stichtag('loeschprotokoll', f.loeschprotokoll, heute);
    const vorab = await loadJson<{ eintraege: import('@/lib/crm/loeschprotokoll').LoeschEintrag[] }>(LOESCHPROTOKOLL);
    if (!vorab || !protokollUeberFrist(vorab.eintraege ?? [], grenze).n) return;
    let n = 0;
    await updateJson<{ eintraege: import('@/lib/crm/loeschprotokoll').LoeschEintrag[] }>(LOESCHPROTOKOLL, cur => { const r = protokollUeberFrist(cur?.eintraege ?? [], grenze); n = r.n; return r.n ? { ...(cur ?? {}), eintraege: r.eintraege } : (cur ?? { eintraege: [] }); });
    zaehle('loeschprotokoll', n);
  });
  // 18 · Pannen-Register (05.10., Zusatz): abgeschlossene Pannen nach der Frist ab Abschluss.
  await schritt('pannen', async () => {
    const { PANNEN_SPEICHER, pannenUeberFrist } = await import('@/lib/datenschutz/pannen');
    const grenze = stichtag('pannen', f.pannen, heute);
    const vorab = await loadJson<import('@/lib/datenschutz/pannen').PannenDatei>(PANNEN_SPEICHER);
    if (!vorab || !pannenUeberFrist(vorab, grenze).n) return;
    let n = 0;
    await updateJson<import('@/lib/datenschutz/pannen').PannenDatei>(PANNEN_SPEICHER, cur => { const r = pannenUeberFrist(cur, grenze); n = r.n; return r.n ? r.datei : (cur ?? { pannen: [] }); });
    zaehle('pannen', n);
  });

  await updateJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER, cur => ({ ...(cur ?? {}), lauf: { tag: heute, am: jetztIso, ueberFrist: ueber.length, bereinigt } }));
  const summe = Object.values(bereinigt).reduce((a, x) => a + x, 0);
  return {
    ok: true, ueberFrist: ueber.length, bereinigt, aufgabe, ...(grabsteine ? { grabsteine } : {}),
    text: `${ueber.length} ${ueber.length === 1 ? 'Kontakt' : 'Kontakte'} über der Frist${netz ? ` (+ ${netz} im Altbestand Netzwerk)` : ''}${nwUeber.length ? ` (+ ${nwUeber.length} aus Netzwerken ohne Interaktion)` : ''} (Aufgabe ${aufgabe}) · ${summe} technische Einträge bereinigt${grabsteine && !grabsteine.uebersprungen ? ` · Grabsteine angewendet (${grabsteine.entfernt} erneut entfernt)` : ''}`,
  };
}

/** Die eine Aufgabe führen: anlegen, Zahl nachziehen oder erledigen. Nie Kennungen oder Namen im Text. */
async function aufgabeAbgleichen(kartei: number, monate: number, jetztIso: string, netz = 0, nw = 0, nwMonate = 12): Promise<LaufErgebnis['aufgabe']> {
  const inhaber = (await ladeKonten()).konten.find(k => k.rolle === 'inhaber')?.speicher;
  let wirkung: LaufErgebnis['aufgabe'] = 'keine';
  const n = kartei + netz + nw;
  // Nichts über der Frist und noch keine Aufgaben-Liste: nichts anlegen.
  if (!n && (await loadJson<unknown>('tasks')) === null) return wirkung;
  const titel = `${kartei} ${kartei === 1 ? 'Kontakt' : 'Kontakte'}${netz ? ` (+ ${netz} im Altbestand Netzwerk)` : ''}${nw ? ` (+ ${nw} aus Netzwerken ohne Interaktion seit ${nwMonate} Monaten)` : ''} über der Löschfrist — prüfen: löschen oder begründen`;
  const beschreibung = `Seit ${monate} Monaten ohne Beziehung und ohne Aktivität (Art. 5 Abs. 1 lit. e DSGVO). Gelöscht wird nie automatisch: je Person löschen (Art. 17) oder „Frist verlängern mit Grund“ — Liste unter ${WEG.stammdaten('datenschutz')}. Hinweis, keine Rechtsberatung.`;
  // Über den Schreibweg (29.09., Paket T1 #12): `completedAt`, Verlauf „durch System“, Protokoll — in EINER Sperre.
  await systemAufgabenAendern(stand => {
    const a = stand.tasks.find(x => x.id === LOESCHFRIST_AUFGABE);
    const offen = !!a && a.status !== 'done' && a.status !== 'cancelled' && !a.geloeschtAm;
    if (!n) {
      if (!offen) { wirkung = 'keine'; return {}; }
      wirkung = 'erledigt';
      return { teile: [{ id: a!.id, felder: { status: 'done' } }] };
    }
    if (offen) {
      if (a!.title === titel) { wirkung = 'unveraendert'; return {}; }
      wirkung = 'aktualisiert';
      return { teile: [{ id: a!.id, felder: { title: titel, description: beschreibung } }] };
    }
    wirkung = 'neu';
    // Erledigte (oder im Papierkorb liegende) Aufgabe gleicher Kennung: wieder öffnen statt eine zweite anlegen.
    if (a) return { teile: [{ id: a.id, felder: { title: titel, description: beschreibung, status: 'todo', geloeschtAm: null, geloeschtMit: null } }] };
    return { neu: [{ id: LOESCHFRIST_AUFGABE, title: titel, description: beschreibung, status: 'todo', priority: 'medium', ...(inhaber ? { assignee: inhaber } : {}), tags: ['datenschutz', 'markttraktion'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetztIso, updatedAt: jetztIso, space: 'business' }] };
  }, { jetzt: jetztIso });
  return wirkung;
}
