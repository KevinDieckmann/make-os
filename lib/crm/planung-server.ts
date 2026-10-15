// ─── Markttraktion · Planung — Bestand und Lage (Server, 10.10.) ─────────────────────────────────────────────────
// Bestand `markttraktion-planung--<haushalt>` (Haushalt des Inhabers — dieselbe Grenze wie Kalender, Kapazität und Business-Index; Bereich
// Business, Speicher-Register). Gespeichert wird nur, was es sonst nirgends gibt (lib/crm/planung-daten.ts); alles andere kommt aus den
// VORHANDENEN Lesewegen und wird hier nur zusammengetragen — gerechnet wird in lib/crm/planung.ts:
//   Kartei            `kontakteFuerVerarbeitung` (Art. 18: eingeschränkte Personen fehlen ganz)
//   CRM               `ladeCrm` (Deals, Mandate, Produkte, Kampagnen, Events, Teilnahmen, Scoring)
//   Leads             `leads` (lib/crm/leads.ts) — dieselben Zeilen wie die Leads-Liste
//   Follow-up         `faellige` (lib/crm/followup.ts) — DIE Fälligkeitsliste
//   Kapazität         `kapaStandFuer` (lib/kapazitaet/server.ts) — freie Stunden je Person, nur Zahlen
//   Zahlenziele       Business-Jahresziele mit Zielwert (Planung › Jahr) — nur lesen, als Vorschlag
// Die Antwort enthält nie Privates: Umsatzziele nur für Business-Gesellschaften (Selbstständigkeit = Privat → 400 beim Schreiben, nie in der
// Auswahl), Zahlenziele nur mit wirksamem Bereich Business. Die Markttraktion selbst ist Business (Entscheidung 09.10. spät).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { kontakteFuerVerarbeitung, eingeschraenkteKennungen } from './verarbeitung';
import { ladeCrm } from './speicher';
import { leads } from './leads';
import { faellige } from './followup';
import { zyklus } from './deal-auswertung';
import { reihenDerInstanz } from './reihen-server';
import { TEAM } from './team-liste';
import { SCORE_ZIELE } from './scoreboard';
import { BUSINESS_GESELLSCHAFTEN, finanzOrtName, istRegisterKennung } from '@/lib/einheiten';
import { wirksamerSpace } from '@/lib/planung/bereich';
import { zielJahr } from '@/lib/planung/zeitstrahl';
import type { ZieleDatei } from '@/lib/planung/typen';
import {
  planungAus, planungAnwenden, KANAL_HERKUNFT, PLAN_QUOTEN, CHALLENGE_ARTEN, NACH_LEISTUNG, ZEITEN_LABEL, PLANUNG_GRENZEN,
  type PlanungDatei, type AnwendenErgebnis,
} from './planung-daten';
import {
  zuordnen, kanalStaende, kreislauf, zielLage, bedarfJePerson, kapaVergleich, wochenziele, wochenIst, challengeStand, challengeVorschlaege,
  ruhendeKontakte, standardQuoten, wocheVon, vorwocheVon, passtKanal, jeWelt,
} from './planung';

/** Der Bestandsname eines Haushalts (ohne gültigen Haushalt: der Inhaber-Bestand — wie die Kapazität). */
export const planungSpeicherFuer = (h: string | null | undefined) => (h && HAUSHALT_OK.test(h) ? `markttraktion-planung--${h}` : 'markttraktion-planung--inhaber');
export async function planungSpeicher(): Promise<string> {
  return planungSpeicherFuer(await haushaltDesInhabers());
}
export async function ladePlanung(): Promise<PlanungDatei> {
  return planungAus(await loadJson<unknown>(await planungSpeicher()));
}

/** Stand eines Eintrags (Fingerabdruck) — der Browser schickt ihn zurück; passt er nicht mehr, 409. */
export const eintragStand = (x: object): string => fingerabdruck(x as Record<string, unknown>);
/** Die Datei für den Browser: jeder Eintrag mit `stand`, die Zeiten mit `zeitenStand`. */
export function mitStaenden(d: PlanungDatei) {
  const s = <T extends object>(l: T[]) => l.map(x => ({ ...x, stand: eintragStand(x) }));
  return { ...d, kanaele: s(d.kanaele), ziele: s(d.ziele), challenges: s(d.challenges), zeitenStand: eintragStand(d.zeiten) };
}

/** Schritte anwenden — in EINER Sperre, alles oder nichts, protokolliert ohne Werte. */
export async function planungSchreiben(ops: unknown, person: string, wer?: Wer, jetzt = new Date()): Promise<AnwendenErgebnis> {
  const name = await planungSpeicher();
  let ergebnis: AnwendenErgebnis = { ok: false, status: 400, fehler: 'Nichts geändert.' };
  let vorher: PlanungDatei | null = null;
  const nachher = await updateJson<PlanungDatei>(name, cur => {
    const d = planungAus(cur);
    vorher = d;
    ergebnis = planungAnwenden(d, ops, { person, jetzt: jetzt.toISOString(), heute: localDay(jetzt), standVon: eintragStand, neueId: p => neueKennung(p) });
    return ergebnis.ok ? ergebnis.datei : (cur as PlanungDatei | null) ?? d;
  });
  if (ergebnis.ok) await protokolliereBestand(name, vorher, nachher, wer);
  return ergebnis;
}

/**
 * Business-Gesellschaften zur Wahl: die festen mit Bereich Business und die Register-Gesellschaften (`g-…`) — nie die Selbstständigkeit;
 * Register-Gesellschaften nur für Personen mit Zugang zur Firmen-Akte (15.10., Abnahme 2 A1 — `einheitenSichtFuer`).
 */
async function gesellschaftenZurWahl(person: string): Promise<{ id: string; name: string }[]> {
  const feste = BUSINESS_GESELLSCHAFTEN.map(g => ({ id: g as string, name: finanzOrtName(g) }));
  try {
    const h = await haushaltDesInhabers();
    if (!h || !(await (await import('@/lib/gesellschaften/sicht-server')).einheitenSichtFuer(person)).register) return feste;
    const { ladeRegister } = await import('@/lib/gesellschaften/server');
    const reg = await ladeRegister(h);
    const weitere = (reg?.gesellschaften ?? []).filter(g => istRegisterKennung(g.id) && !(g as { geloeschtAm?: string }).geloeschtAm && g.status !== 'aufgeloest').map(g => ({ id: g.id as string, name: g.name ?? g.id }));
    return [...feste, ...weitere];
  } catch { return feste; }
}

/** Business-Zahlenziele der Planung (Jahr, laufendes und nächstes) mit Zielwert — nur zum Vorschlagen eines Umsatzziels. */
async function zahlenziele(heute: string): Promise<{ id: string; titel: string; zielwert: number; jahr: number }[]> {
  const d = await loadJson<ZieleDatei>('ziele');
  const jahr = Number(heute.slice(0, 4));
  return (d?.jahr ?? [])
    .filter(z => wirksamerSpace(z) === 'business' && !z.archiviertAm && !z.erledigt && typeof z.zielwert === 'number' && z.zielwert > 0 && zielJahr(z, jahr) >= jahr && zielJahr(z, jahr) <= jahr + 1)
    .map(z => ({ id: z.id, titel: z.titel, zielwert: z.zielwert as number, jahr: zielJahr(z, jahr) }));
}

/** Freie Stunden je Team-Person (Ø nächste vier Wochen: belastbar − verplant) aus der Kapazität — null, wenn sie nicht zu lesen ist. */
async function freieStunden(person: string, heute: string): Promise<Record<string, number | null> | null> {
  try {
    const { kapaStandFuer } = await import('@/lib/kapazitaet/server');
    const { stand } = await kapaStandFuer(person, heute);
    const raus: Record<string, number | null> = {};
    for (const t of TEAM) {
      const p = stand.personen.find(x => x.id === `konto-${t.id}`);
      const w = (p?.wochen ?? []).slice(0, 4);
      raus[t.id] = p && !p.ohneKapa && w.length ? Math.round((w.reduce((a, x) => a + (x.belastbar - x.bedarf), 0) / w.length) * 10) / 10 : null;
    }
    return raus;
  } catch { return null; }
}

/**
 * Die ganze Lage für den Schnellknopf „Planung“ — eine Minute gemerkt je Haushalt, Person, Tag und Filter (jede Schreibung setzt zurück).
 * `filter` = Kennung eines Leadkanals, `'ohne'` = Leads ohne Kanal, null = alle.
 */
export async function planungLage(person: string, filter: string | null, heute = localDay()) {
  const name = await planungSpeicher();
  return merken(`mt-planung:${name}:${person}:${heute}:${filter ?? '-'}`, 60_000, async () => {
    const [datei, kontakte, crm, ausgeblendet, gesellschaften, zz, frei] = await Promise.all([
      ladePlanung(), kontakteFuerVerarbeitung(), ladeCrm(), eingeschraenkteKennungen(), gesellschaftenZurWahl(person),
      // Gründungsfahrplan nur mit Zugang zur Firmen-Akte (15.10., Abnahme 2 A1) — dieselbe Regel wie die Ziele-Route.
      zahlenziele(heute).then(async l => (await import('@/lib/planung/bereich-sicht-server')).ohneFahrplanFuer(l, person, 'ziel')), freieStunden(person, heute),
    ]);
    // Fortschritt im Paket (10.10., Leistungstreppe unter Produkte & Mandate) — Fulfillment und „Nach der Leistung“ zeigen ihn; Fehler → wie bisher.
    const fortschritt = await (await import('./treppe-server')).fortschrittFuerKreislauf(crm, heute).catch(() => ({}));
    const zeilen = leads(kontakte, crm, heute);
    const zo = zuordnen(datei.kanaele, zeilen, crm);
    const kontaktNach = new Map(kontakte.map(k => [k.id, k]));
    // Follow-up je Lead (über die Person) — damit der Kanal-Filter auch hier gilt.
    const leadVonPerson = new Map<string, string>();
    for (const z of zeilen) for (const p of z.personen) if (!leadVonPerson.has(p.id)) leadVonPerson.set(p.id, z.id);
    const f = faellige(kontakte, crm, heute, { wertelisten: crm.wertelisten, ausgeblendet })
      .filter(x => x.faellig <= heute && (filter === null || passtKanal(x.kontaktId ? zo.lead.get(leadVonPerson.get(x.kontaktId) ?? '') : null, filter)));
    const lagen = datei.ziele.map(z => zielLage(z, { heute, kanaele: datei.kanaele, crm }));
    const plan = wochenziele(lagen);
    const bedarf = bedarfJePerson(lagen, datei.kanaele, datei.zeiten);
    const woche = wocheVon(heute), vorwoche = vorwocheVon(heute);
    const istJetzt = wochenIst(kontakte, crm, woche, heute);
    const istVor = wochenIst(kontakte, crm, vorwoche, tagPlus(woche, -1));
    const z = zyklus(crm.chancen);
    return {
      heute, woche, vorwoche,
      team: TEAM.map(t => ({ id: t.id, name: t.name, farbe: t.farbe })),
      datei: mitStaenden(datei),
      auswahl: {
        herkunft: KANAL_HERKUNFT, quoten: PLAN_QUOTEN, challengeArten: CHALLENGE_ARTEN, nachLeistung: NACH_LEISTUNG, zeiten: ZEITEN_LABEL, grenzen: PLANUNG_GRENZEN,
        kampagnen: (crm.kampagnen ?? []).filter(k => !k.geloeschtAm && !k.archiviertAm).map(k => ({ id: k.id, name: k.name })),
        reihen: (await reihenDerInstanz(crm)).map(r => ({ id: r.id, name: r.name })),
        gesellschaften, zahlenziele: zz,
      },
      standard: { quoten: standardQuoten(crm.wahrscheinlichkeiten), dealWert: z.dealGroesse, zyklusWochen: z.median != null ? Math.max(1, Math.round(z.median / 7)) : null },
      kanaele: kanalStaende({ kanaele: datei.kanaele, zeilen, crm, kontaktNach, heute, zuordnung: zo }),
      kreislauf: kreislauf({ heute, kanaele: datei.kanaele, zeilen, crm, kontakte, nachLeistung: datei.nachLeistung, followup: { faellig: f.length, ueberfaellig: f.filter(x => x.faellig < heute).length }, zuordnung: zo, fortschritt }, filter),
      ziele: lagen,
      wochenziele: plan,
      jeWelt: jeWelt(lagen),
      bedarf,
      kapa: kapaVergleich(bedarf, frei),
      challenges: {
        aktuell: datei.challenges.filter(c => c.woche === woche).map(c => challengeStand(c, istJetzt, datei.kanaele)),
        vorwoche: datei.challenges.filter(c => c.woche === vorwoche).map(c => challengeStand(c, istVor, datei.kanaele)),
        vorschlaege: challengeVorschlaege({ woche, plan, lagen, kanaele: datei.kanaele, vorwoche: istVor.team, vorhanden: datei.challenges, ruhend: ruhendeKontakte(kontakte, heute), startwerte: { gespraeche: SCORE_ZIELE.gespraeche, powerhours: SCORE_ZIELE.power_hours } }),
        istWoche: istJetzt.team,
      },
    };
  });
}

/** Nur die Wochenziele (für das Scoreboard der Markttraktion) — null ohne Plan, Fehler → null (das Scoreboard bleibt wie bisher). */
export async function planWochenziele(heute = localDay()) {
  try {
    const d = await ladePlanung();
    if (!d.ziele.length) return null;
    const crm = await ladeCrm();
    return wochenziele(d.ziele.map(z => zielLage(z, { heute, kanaele: d.kanaele, crm })));
  } catch { return null; }
}
