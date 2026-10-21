// ─── Prozesse · Kundengewinnung — „Aus Vorlage anlegen“ (22.10.; ANALYSE_100.md Punkt 72) ─────────────────────────────────────────────────────────────
// Übernimmt eine Vorlage der Bibliothek als eigene Prozesse des Haushalts (rein, alles oder nichts — die Route schreibt in EINER Sperre):
//   · jede Übernahme bekommt NEUE Kennungen (`pz-<uuid>`, `fk-<uuid>`; Schlösser nach der EINEN Regel `schlossKennung`) — zweimal übernehmen = zwei Prozesse;
//   · Teilprozesse zuerst (sie werden zuerst veröffentlicht — aufgerufen wird immer die veröffentlichte Version), dann der Hauptprozess;
//   · Verweise innen (Zweige, Schlösser, „erneut ab“, `abfrage:<Knoten>` einer Schleife) zeigen auf die neuen Kennungen; Teilprozess-Verweise auf die neuen Teile;
//   · eine Übergabe an eine andere Vorlage zeigt auf den eigenen Prozess aus dieser Vorlage (Herkunft) — gibt es ihn (noch) nicht, wird sie „Ziel erreicht“
//     mit Hinweis (kein toter Verweis);
//   · Eigner = eine Person aus dem Team (die Rolle der Vorlage wählt sie im Fenster); Schritte behalten ihre Rollen (`rolle:zustaendig` …), der Lauf löst sie auf;
//   · ohne offene Punkte und mit dem Recht dazu wird Version 1 „Aus Vorlage“ veröffentlicht und der Prozess steht im Probelauf (er schreibt nie) — sonst bleibt er
//     Entwurf, und die Antwort nennt, was fehlt.
// Rein und client-sicher.

import {
  PROZESS_GRENZEN, type Befund, type ProzessDefinition, type ProzessEintrag, type ProzessForm, type ProzessKnoten, type ProzesseDatei,
} from '../definition';
import { definitionPruefen, laufFremd, sperrtSpeichern, sperrtVeroeffentlichen, type PruefKontext } from '../definition-pruefen';
import { schlossKennung, schlossSetzen } from '../schloss';
import { veroeffentlichen } from '../versionen';
import type { ProzessRechte } from '../rollen';
import { istVorlageRef, vorlageAusRef, type KgVorlage } from './bau';
import { vorlageVon } from './bibliothek';

type K = ProzessKnoten<ProzessForm>;

export interface UebernahmeKontext {
  person: string;
  jetzt: string;
  rechte: ProzessRechte;
  /** Neue Kennung (`pz-<uuid>` bzw. `fk-<uuid>`). */
  neueKennung: (praefix: 'pz' | 'fk') => string;
  /** Eigner (Team-Kennung) — gewählt im Fenster; ohne bleibt er offen (der Prozess wird dann nicht aktiv). */
  eigner?: string;
  pruef?: PruefKontext;
}
export type UebernahmeErgebnis =
  | { ok: true; datei: ProzesseDatei; haupt: ProzessEintrag; teile: ProzessEintrag[]; befunde: Befund[]; hinweise: string[]; probelauf: boolean }
  | { ok: false; status: 400 | 403 | 404 | 413; fehler: string; befunde?: Befund[] };

/** Der eigene (nicht archivierte) Prozess, der aus einer Vorlage stammt — jüngster zuerst. */
export function prozessAusVorlage(datei: ProzesseDatei, vorlageId: string): ProzessEintrag | null {
  const l = datei.prozesse.filter(p => p.status !== 'archiviert' && p.entwurf.herkunft?.art === 'muster' && p.entwurf.herkunft.quelleIds?.includes(vorlageId));
  return l.sort((a, b) => b.angelegtAm.localeCompare(a.angelegtAm))[0] ?? null;
}
/** Welche Vorlagen schon übernommen sind (Galerie: „schon da“) — Kennung der Vorlage → Prozess. */
export const uebernommene = (datei: ProzesseDatei): Record<string, string> =>
  Object.fromEntries(datei.prozesse.filter(p => p.status !== 'archiviert' && p.entwurf.herkunft?.art === 'muster').flatMap(p => (p.entwurf.herkunft?.quelleIds ?? []).map(q => [q, p.id])));

/** Eine Definition mit neuen Kennungen (rein). `teil` = Vorlage-Kennung eines Teils → neue Prozess-Kennung; `uebergabe` = Vorlage → eigener Prozess bzw. null. */
export function mitNeuenKennungen(d: ProzessDefinition, a: { id: string; neu: () => string; teil: Record<string, string>; uebergabe: (vorlage: string) => string | null; eigner?: string; person: string; jetzt: string; vorlage: string }): { definition: ProzessDefinition; hinweise: string[] } {
  const hinweise: string[] = [];
  const karte = new Map<string, string>();
  // Erst die eigentlichen Knoten (keine Schlösser) — die Schlösser bekommen ihre Kennung aus dem neuen Knoten (feste Regel).
  for (const k of d.knoten) if (!k.schloss) karte.set(k.id, a.neu());
  for (const k of d.knoten) if (k.schloss) karte.set(k.id, schlossKennung(karte.get(k.schloss.fuer) ?? k.schloss.fuer));
  const m = (x: string | undefined) => (x ? karte.get(x) ?? x : x);
  const ref = (x: string): string => (istVorlageRef(x) ? a.teil[vorlageAusRef(x)] ?? x : x);
  const knoten: K[] = d.knoten.map(k => {
    const n: K = { ...k, id: m(k.id)! };
    if (k.elternId) n.elternId = m(k.elternId);
    if (k.zweige) n.zweige = Object.fromEntries(Object.entries(k.zweige).map(([z, v]) => [z, m(v)])) as K['zweige'];
    if (k.schloss) n.schloss = { ...k.schloss, fuer: m(k.schloss.fuer)! };
    if (k.erneut) n.erneut = { ...k.erneut, ab: m(k.erneut.ab)! };
    if (k.schleife) n.schleife = { ...k.schleife, liste: k.schleife.liste.startsWith('abfrage:') ? `abfrage:${m(k.schleife.liste.slice(8))}` : k.schleife.liste, prozessId: ref(k.schleife.prozessId) };
    if (k.teilprozess) n.teilprozess = { ...k.teilprozess, prozessId: ref(k.teilprozess.prozessId) };
    if (k.ende?.ergebnis === 'uebergabe' && k.ende.uebergabeAn && istVorlageRef(k.ende.uebergabeAn)) {
      const ziel = vorlageAusRef(k.ende.uebergabeAn);
      const eigen = a.uebergabe(ziel);
      if (eigen) n.ende = { ergebnis: 'uebergabe', uebergabeAn: eigen };
      else {
        // Kein toter Verweis: ohne eigenen Prozess aus der Ziel-Vorlage endet der Lauf hier — die Übergabe lässt sich später im Knoten wählen.
        n.ende = { ergebnis: 'erfolg' };
        n.katalog = { id: 'ende.ziel' };
        const t = vorlageVon(ziel);
        hinweise.push(`„${k.titel}“: die Übergabe an „${t?.titel ?? ziel}“ steht als „Ziel erreicht“, bis diese Vorlage übernommen ist — dann im Knoten „Übergabe“ wählen.`);
      }
    }
    return n;
  });
  const zettel = d.zettel?.map(z => ({ ...z, id: a.neu(), von: a.person, am: a.jetzt }));
  const def: ProzessDefinition = {
    ...d, id: a.id, knoten, ...(zettel ? { zettel } : {}), fassung: 1, geaendert: a.jetzt, geaendertVon: a.person,
    ...(a.eigner ? { eigner: a.eigner } : {}),
    herkunft: { art: 'muster', quelleIds: [a.vorlage], am: a.jetzt },
  };
  // Die Schlösser nach der EINEN Regel (idempotent — sie stehen schon richtig; ändert sich nichts, bleibt die Definition dieselbe).
  return { definition: schlossSetzen(def, { laufFremd: laufFremd(def) }).definition, hinweise };
}

/** Ein neuer Eintrag aus einer Definition (Status Entwurf). */
const eintragAus = (d: ProzessDefinition, kx: UebernahmeKontext): ProzessEintrag => ({ id: d.id, entwurf: d, versionen: [], status: 'entwurf', angelegtAm: kx.jetzt, angelegtVon: kx.person, entwurfAm: kx.jetzt, entwurfVon: kx.person });

/**
 * „Aus Vorlage anlegen“ (rein, alles oder nichts): Teile, dann Hauptprozess — neue Kennungen, Eigner, Herkunft; veröffentlichen + Probelauf, wenn nichts offen ist
 * und die Person veröffentlichen darf. Grenzen → 413, unbekannte Vorlage → 404, ohne Recht → 403.
 */
export function ausVorlageAnwenden(datei: ProzesseDatei, vorlageId: unknown, kx: UebernahmeKontext): UebernahmeErgebnis {
  if (!kx.rechte.entwurf) return { ok: false, status: 403, fehler: 'Prozesse bauen nur Personen im Haushalt.' };
  const v: KgVorlage | null = typeof vorlageId === 'string' ? vorlageVon(vorlageId) : null;
  if (!v) return { ok: false, status: 404, fehler: 'Diese Vorlage gibt es nicht.' };
  if (datei.prozesse.length + v.teile.length + 1 > PROZESS_GRENZEN.prozesse) return { ok: false, status: 413, fehler: `Höchstens ${PROZESS_GRENZEN.prozesse} Prozesse — nichts angelegt.` };
  const hinweise: string[] = [];
  const teil: Record<string, string> = {};
  for (const t of v.teile) teil[t.id] = kx.neueKennung('pz');
  const hauptId = kx.neueKennung('pz');
  const uebergabe = (ziel: string) => prozessAusVorlage(datei, ziel)?.id ?? null;
  const neu = () => kx.neueKennung('fk');
  const entwuerfe: ProzessEintrag[] = [];
  for (const t of v.teile) {
    const r = mitNeuenKennungen(t.definition, { id: teil[t.id], neu, teil, uebergabe, eigner: kx.eigner, person: kx.person, jetzt: kx.jetzt, vorlage: t.id });
    hinweise.push(...r.hinweise);
    entwuerfe.push(eintragAus(r.definition, kx));
  }
  const rh = mitNeuenKennungen(v.definition, { id: hauptId, neu, teil, uebergabe, eigner: kx.eigner, person: kx.person, jetzt: kx.jetzt, vorlage: v.id });
  hinweise.push(...rh.hinweise);
  // Prüfen und (wo es geht) veröffentlichen: Teile zuerst — der Hauptprozess sieht sie dann als veröffentlicht.
  let stand: ProzessEintrag[] = [...datei.prozesse];
  const pruef = (): PruefKontext => ({
    ...(kx.pruef ?? {}),
    prozess: (id: string) => {
      const p = stand.find(x => x.id === id) ?? entwuerfe.find(x => x.id === id);
      if (!p) return kx.pruef?.prozess?.(id) ?? null;
      const ver = p.versionen.at(-1);
      return { titel: p.entwurf.titel, veroeffentlicht: !!ver && p.status !== 'archiviert', ...(ver?.definition.schnittstelle ? { schnittstelle: ver.definition.schnittstelle } : {}) };
    },
  });
  const fertig: ProzessEintrag[] = [];
  let alleImProbelauf = kx.rechte.veroeffentlichen && kx.rechte.status;
  const anlegen = (e: ProzessEintrag): { eintrag: ProzessEintrag; befunde: Befund[] } | { fehler: Befund[] } => {
    const befunde = definitionPruefen(e.entwurf, pruef());
    if (sperrtSpeichern(befunde)) return { fehler: befunde };
    if (!kx.rechte.veroeffentlichen || !kx.rechte.status || sperrtVeroeffentlichen(befunde)) { alleImProbelauf = false; return { eintrag: e, befunde }; }
    const ver = veroeffentlichen(e, { name: 'Aus Vorlage', notiz: `Übernommen aus der Vorlage „${v.titel}“ (${v.nr}).`, von: kx.person, jetzt: kx.jetzt });
    if (!ver.ok) { alleImProbelauf = false; return { eintrag: e, befunde }; }
    return { eintrag: { ...ver.eintrag, status: 'probelauf', statusAm: kx.jetzt, statusVon: kx.person }, befunde };
  };
  for (const e of entwuerfe) {
    const r = anlegen(e);
    if ('fehler' in r) return { ok: false, status: 400, fehler: r.fehler.find(x => x.stufe === 'fehler')?.text ?? 'Die Vorlage ist nicht speicherbar.', befunde: r.fehler };
    fertig.push(r.eintrag);
    stand = [...stand, r.eintrag];
  }
  const rHaupt = anlegen(eintragAus(rh.definition, kx));
  if ('fehler' in rHaupt) return { ok: false, status: 400, fehler: rHaupt.fehler.find(x => x.stufe === 'fehler')?.text ?? 'Die Vorlage ist nicht speicherbar.', befunde: rHaupt.fehler };
  if (!kx.eigner) hinweise.push('Noch ohne Eigner — im Steckbrief eine Person aus dem Team wählen (ohne Eigner wird kein Prozess aktiv).');
  if (!kx.rechte.veroeffentlichen) hinweise.push('Veröffentlichen und Probelauf gibt es nur für volle Mitglieder — der Prozess steht als Entwurf bereit.');
  else if (!alleImProbelauf) hinweise.push('Noch offen — erst diese Punkte erledigen, dann veröffentlichen und den Probelauf starten.');
  for (const o of v.offen) hinweise.push(`${o.punkt}: ${o.text}`);
  return {
    ok: true, datei: { ...datei, prozesse: [...datei.prozesse, ...fertig, rHaupt.eintrag] }, haupt: rHaupt.eintrag, teile: fertig, befunde: rHaupt.befunde, hinweise,
    probelauf: alleImProbelauf && rHaupt.eintrag.status === 'probelauf',
  };
}
