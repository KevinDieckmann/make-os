// ─── MAKE OS — Austausch am Meilenstein: Speicher (Server, 30.09.) ───────────
// Bestand `meilenstein-raum--<haushalt>` (Regeln rein in lib/planung/meilenstein-raum.ts). Eine Sperre je Schreiben,
// Änderungsprotokoll nur mit Kennung + Feldnamen (nie Texte), Glocke bei Erwähnung (@Name) und bei Antworten.
// Art. 15/17: Nachrichten und Notizen können Dritte nennen → im Register als „tilgen“ (lib/crm/speicher-register.ts,
// lib/crm/person-weitere.ts). Der Raum bleibt beim Meilenstein, auch wenn der gelöscht/archiviert wird (Rückgängig).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { melde } from '@/lib/meldungen/melden';
import { WEG } from '@/lib/wege';
import { neueKennung } from '@/lib/kennung';
import { haushaltPersonen } from '@/lib/aufgaben/speicher';
import { RAUM_PRAEFIX, RAUM_GRENZEN, anwenden, leererRaum, type Raum, type RaumAktion, type RaumDatei, type RaumErgebnis } from './meilenstein-raum';

export const raumName = (haushalt: string): string => {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error('Unzulässiger Haushalt.');
  return `${RAUM_PRAEFIX}${haushalt}`;
};

export async function raumLaden(haushalt: string, msId: string): Promise<Raum> {
  const f = await loadJson<RaumDatei>(raumName(haushalt));
  return f?.raeume?.[msId] ?? leererRaum();
}

/** Personen des Haushalts mit ihren Namen für @-Erwähnungen (Vorname + Speichername — Namen nie im Code). */
export async function erwaehnbar(): Promise<{ speicher: string; name: string; namen: string[] }[]> {
  return (await haushaltPersonen()).map(p => {
    const vorname = (p.name ?? '').trim().split(/\s+/)[0] || p.speicher;
    return { speicher: p.speicher, name: vorname, namen: Array.from(new Set([vorname, p.speicher])) };
  });
}

const kurz = (t: string) => (t.length > 80 ? `${t.slice(0, 79)}…` : t);

/** Eine Aktion schreiben (eine Sperre), danach Protokoll + Meldungen. `titel` = Titel des Meilensteins (für die Glocke). */
export async function raumAendern(haushalt: string, msId: string, titel: string, a: RaumAktion, person: string, jetzt = new Date().toISOString()): Promise<RaumErgebnis> {
  const personen = await erwaehnbar();
  let erg: RaumErgebnis = { ok: false, status: 400, fehler: 'Nichts geändert.' };
  await updateJson<RaumDatei>(raumName(haushalt), cur => {
    const raeume = { ...(cur?.raeume ?? {}) };
    if (!raeume[msId] && Object.keys(raeume).length >= RAUM_GRENZEN.raeume) { erg = { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${RAUM_GRENZEN.raeume} Meilenstein-Räume.` }; return cur ?? { raeume }; }
    erg = anwenden(raeume[msId] ?? leererRaum(), a, person, jetzt, () => neueKennung(a.art === 'link' ? 'ln' : 'mn'), personen);
    if (!erg.ok) return cur ?? { raeume };
    raeume[msId] = erg.raum;
    return { ...(cur ?? {}), raeume };
  });
  // Nach der Sperre: TypeScript sieht die Zuweisung in der Sperre nicht — ausdrücklich als Ergebnis lesen.
  const e = erg as RaumErgebnis;
  if (!e.ok) return e;
  const feld = a.art === 'notiz' ? 'notiz' : a.art === 'link' || a.art === 'link-entfernen' ? 'links' : 'nachrichten';
  await protokolliere(raumName(haushalt), [{ op: 'geaendert', id: msId, felder: [feld] }], { art: 'person', person });
  const ich = personen.find(p => p.speicher === person)?.name ?? person;
  const link = WEG.meilenstein(msId, 'verlauf');
  const gemeldet = new Set<string>();
  for (const an of e.erwaehnt) {
    if (an === person || !personen.some(p => p.speicher === an)) continue;
    gemeldet.add(an);
    await melde({ an, art: 'erwaehnung', titel: `${ich} hat dich am Meilenstein „${kurz(titel)}“ erwähnt`, link, von: person });
  }
  if (e.antwortAn && !gemeldet.has(e.antwortAn) && e.antwortAn !== person && personen.some(p => p.speicher === e.antwortAn)) {
    const an = e.antwortAn;
    await melde({ an, art: 'kommentar', titel: `${ich} hat dir am Meilenstein „${kurz(titel)}“ geantwortet`, link, von: person });
  }
  return e;
}
