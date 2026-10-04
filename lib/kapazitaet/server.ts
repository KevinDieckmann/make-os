// ─── MAKE OS — Kapazität: Laden, Speichern, Stand (Server) ──────────────────
// Bestand `kapazitaet--<haushalt>` (Haushalt des Inhabers — dieselbe Grenze wie Kalender und Business-Index).
// Alle Eingaben kommen aus den VORHANDENEN Lesewegen, hier wird nichts zweites gerechnet:
//   Personen     Team des Haushalts (teamStand: Konten + Team-Speicher, nie Platzhalter)
//   Kalender     verfuegbarkeitFuer (K1: Wochenvorlage, Abwesend, Feiertage, Termine) — nur Konten
//   Erholung     Whoop-Recovery (`vitals[--person]`), NUR wenn die Person ihre Gesundheit mit allen anderen Konten
//                des Haushalts teilt — und dann nur als Team-Faktor (fuerBetrachter entfernt Einzelwerte)
//   Ist          bewusste Business-Fokuszeit (`zeit--<person>`, Fokus-Blöcke), je Meilenstein über die Aufgaben-Liste
//   Posten       Meilensteine (Business) und Jahresziele mit Aufwand
// Die Rechnung selbst ist rein: lib/kapazitaet/modell.ts.

import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import { localDay } from '@/lib/zeit';
import { tagPlus, montagVon } from '@/lib/zeit/kalender-kern';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { ladeKonten } from '@/lib/zugang/konten';
import { haushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { teamStand, teamSpeicherName, type TeamDatei } from '@/lib/make-one/team-speicher';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { verfuegbarkeitFuer } from '@/lib/kalender/verfuegbarkeit';
import { speicherFuer } from '@/lib/zoe/raum';
import type { VitalsLog } from '@/lib/vitals';
import { ladeZeit } from '@/lib/zeitmessung/speicher';
import { bloeckeImZeitraum, berlinTag } from '@/lib/zeitmessung/einheiten';
import { ladeAufgaben } from '@/lib/aufgaben/sicht';
import { ladeCrm } from '@/lib/crm/speicher';
import { mandatKurzListe, mandatLabel } from '@/lib/planung/mandat';
import { meilensteinSpace } from '@/lib/planung/meilensteine';
import { meilensteinVonAufgabe, zielVonMeilenstein } from '@/lib/planung/meilenstein-aufgaben';
import { zielJahr } from '@/lib/planung/zeitstrahl';
import type { Meilenstein, ZieleDatei } from '@/lib/planung/typen';
import { kapazitaetRechnen, tageAusVerfuegbarkeit, fuerBetrachter, ohneGesundheit } from './modell';
import { sauberKapaDatei, kapaAendern, type Ergebnis } from './aendern';
import { kapaLoeschPlan, kapaOhnePersonen, kapaAuskunft, type KapaAuskunft } from './aufraeumen';
import { WOCHEN_STANDARD, type KapaDatei, type KapaStand, type PersonEingabe, type PostenEingabe, type KapaKennzahlen } from './typen';

const KONTO = 'konto-';

/** Der Bestandsname eines Haushalts (ohne gültigen Haushalt: der Inhaber-Bestand). */
export const kapaSpeicherFuer = (h: string | null | undefined) => (h && HAUSHALT_OK.test(h) ? `kapazitaet--${h}` : 'kapazitaet--inhaber');

/** Der Bestandsname des Haushalts des Inhabers (ohne Haushalt: der Inhaber-Bestand). */
export async function kapaSpeicher(): Promise<string> {
  return kapaSpeicherFuer(await haushaltDesInhabers());
}

export async function ladeKapaDatei(): Promise<KapaDatei> {
  return sauberKapaDatei(await loadJson<KapaDatei>(await kapaSpeicher()));
}

/** Personen der Kapazität: das Team des Haushalts des Inhabers (Konten + gepflegte Team-Personen, aktiv, nie Platzhalter). */
export async function kapaPersonen(): Promise<{ id: string; name: string; quelle: 'konto' | 'team'; speicher?: string; kreis: 'kern' | 'partner' }[]> {
  const h = await haushaltDesInhabers();
  const { team } = await teamStand(h);
  return team.filter(t => t.quelle !== 'platzhalter' && t.aktiv).map(t => ({
    id: t.id, name: t.name, quelle: t.quelle === 'konto' ? 'konto' as const : 'team' as const, ...(t.speicher ? { speicher: t.speicher } : {}), kreis: t.kreis,
  }));
}

/** Die Kapa-Kennung einer angemeldeten Person (Speichername). */
export const kapaIdVon = (speicher: string) => `${KONTO}${speicher}`;

/** Ändern (Ops) — Rechte rein in aendern.ts; hier nur Wer, Team und die Sperre. */
export async function kapaSchreiben(person: string, ops: unknown): Promise<Ergebnis> {
  const [personen, inhaber, name] = await Promise.all([kapaPersonen(), istInhaber(person), kapaSpeicher()]);
  const ids = new Set(personen.map(p => p.id));
  let ergebnis: Ergebnis = { ok: false, status: 400, fehler: 'Keine Änderung.' };
  await updateJson<KapaDatei>(name, alt => {
    ergebnis = kapaAendern(alt, ops, { ich: kapaIdVon(person), inhaber }, ids);
    return ergebnis.ok ? ergebnis.datei : (alt as KapaDatei);
  });
  return ergebnis;
}

const tageZurueck = (heute: string, n: number) => Array.from({ length: n }, (_, i) => tagPlus(heute, -i));

/** Ø Recovery der letzten 7 Tage (mind. 3 Werte, wie die Kennzahl „Recovery“) — sonst null. */
function erholungAus(v: VitalsLog | null, heute: string): number | null {
  const l = tageZurueck(heute, 7).map(t => v?.[t]?.rec).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return l.length >= 3 ? l.reduce((a, b) => a + b, 0) / l.length : null;
}

const sicher = async <T>(f: () => Promise<T>, rueck: T): Promise<T> => { try { return await f(); } catch { return rueck; } };

/** Alles laden und rechnen — ungefiltert (nur Server). Wer ausliefert, nimmt `kapaStandFuer`. */
async function kapaStandRoh(heute: string): Promise<{ stand: KapaStand; bezuege: { art: 'mandat' | 'kunde'; id: string; label: string }[] }> {
  const ende = tagPlus(montagVon(heute), 7 * WOCHEN_STANDARD);
  const istAb = tagPlus(montagVon(heute), -28);
  const [personen, konten, datei, msDatei, zieleDatei, aufgaben, crm] = await Promise.all([
    kapaPersonen(),
    ladeKonten().then(k => k.konten),
    ladeKapaDatei(),
    loadJson<{ meilensteine?: Meilenstein[] }>('meilensteine'),
    loadJson<ZieleDatei>('ziele'),
    sicher(() => ladeAufgaben(), { tasks: [], projects: [] } as unknown as Awaited<ReturnType<typeof ladeAufgaben>>),
    sicher(() => ladeCrm(), null),
  ]);
  const ms = (msDatei?.meilensteine ?? []).filter(m => meilensteinSpace(m) === 'business');
  // Teilen-Regel gegen ALLE Konten des Haushalts (auch solche, die gerade nicht im aktiven Team stehen) — jedes davon darf
  // /api/kapazitaet lesen und sähe den Team-Faktor (DSGVO-Prüfung 04.10., Art. 9).
  const haushalt = await haushaltDesInhabers();
  const kontoSpeicher = new Set(konten.filter(k => haushalt ? k.haushalt === haushalt : personen.some(p => p.speicher === k.speicher)).map(k => k.speicher));

  // Ist: bewusste Business-Fokuszeit je Person und Tag (4 Wochen zurück) und je Meilenstein (über die Aufgaben-Liste).
  const ist: { person: string; tag: string; stunden: number }[] = [];
  const istJeMs = new Map<string, number>();
  const aufgabeNach = new Map((aufgaben?.tasks ?? []).map(t => [t.id, t]));
  const eingaben: PersonEingabe[] = await Promise.all(personen.map(async p => {
    if (!p.speicher) return { id: p.id, name: p.name, quelle: 'team' as const };
    const sp = p.speicher;
    const [v, vitals, zeit] = await Promise.all([
      sicher(() => verfuegbarkeitFuer(sp, heute, ende), null),
      sicher(() => loadJson<VitalsLog>(speicherFuer('vitals', sp)), null),
      sicher(() => ladeZeit(sp), null),
    ]);
    const t = v ? tageAusVerfuegbarkeit(v) : { tage: [], hatVorlage: false };
    // Erholung zählt nur, wenn die Person SELBST eingewilligt hat (Kapazität › „Erholung berücksichtigen“, Art. 9 Abs. 2 lit. a —
    // Vorgabe aus, DSGVO-Prüfung 04.10.) UND ihre Gesundheit mit allen anderen Konten des Haushalts teilt.
    const k = konten.find(x => x.speicher === sp);
    const andere = [...kontoSpeicher].filter(x => x !== sp);
    const teilt = !!k && andere.every(a => k.teilt?.gesundheit?.includes(a)) && !!datei.personen[p.id]?.erholungAm;
    if (zeit) {
      for (const b of bloeckeImZeitraum(zeit, tagPlus(heute, -400), heute)) {
        const tag = berlinTag(b.von);
        if (tag >= istAb) ist.push({ person: p.id, tag, stunden: b.sek / 3600 });
        const task = b.aufgabeId ? aufgabeNach.get(b.aufgabeId) : undefined;
        const m = task ? meilensteinVonAufgabe(task, ms) : null;
        if (m) istJeMs.set(m.id, (istJeMs.get(m.id) ?? 0) + b.sek / 3600);
      }
    }
    return { id: p.id, name: p.name, quelle: 'konto' as const, tage: t.tage, hatVorlage: t.hatVorlage, ...(teilt ? { erholung: erholungAus(vitals, heute) } : {}) };
  }));

  const laufend = Number(heute.slice(0, 4));
  const posten: PostenEingabe[] = [
    ...ms.map(m => ({
      art: 'meilenstein' as const, id: m.id, titel: m.titel, ...(m.faellig ? { termin: m.faellig } : {}), ...(m.aufwand ? { aufwand: m.aufwand } : {}),
      ...(m.personen?.length ? { personen: m.personen } : {}), fortschritt: m.erledigt ? 100 : m.fortschritt, erledigt: m.erledigt,
      ...(m.rang ? { rang: m.rang } : {}), ...(zielVonMeilenstein(m) ? { zielId: zielVonMeilenstein(m) } : {}),
      ...(istJeMs.has(m.id) ? { istStunden: istJeMs.get(m.id) } : {}),
    })),
    // Jahresziele mit eigenem Aufwand (zusätzlich zu ihren Meilensteinen); Termin = Frist, sonst Ende des Zieljahres.
    ...(zieleDatei?.jahr ?? []).filter(z => z.space !== 'privat' && (z.aufwand ?? 0) > 0).map(z => ({
      art: 'ziel' as const, id: z.id, titel: z.titel, termin: z.termin ?? `${zielJahr(z, laufend)}-12-31`, aufwand: z.aufwand,
      ...(z.personen?.length ? { personen: z.personen } : {}), fortschritt: z.erledigt ? 100 : z.fortschritt, erledigt: !!z.erledigt, ...(z.rang ? { rang: z.rang } : {}),
    })),
  ];

  // Bezüge für Zuweisungen: Mandate (aktiv/pausiert) und ihre Kunden — Namen nur zur Anzeige, gespeichert wird die Kennung.
  const mandate = mandatKurzListe(crm);
  const bezugNamen: Record<string, string> = {};
  for (const m of mandate) bezugNamen[m.id] = mandatLabel(m);
  for (const f of crm?.firmen ?? []) bezugNamen[f.id] = f.name;
  const bezuege = [
    ...mandate.filter(m => m.aktiv || m.status === 'pausiert').map(m => ({ art: 'mandat' as const, id: m.id, label: mandatLabel(m) })),
    ...Array.from(new Map(mandate.filter(m => m.aktiv && m.firmaId).map(m => [m.firmaId as string, { art: 'kunde' as const, id: m.firmaId as string, label: m.firma }])).values()),
  ];

  return { stand: kapazitaetRechnen({ heute, personen: eingaben, datei, posten, ist, bezugNamen }), bezuege };
}

/** Gemerkt (60 s) — jede Schreibung über local-db setzt den Speicher zurück. Schlüssel: Haushalt + Tag (ungefiltert, gefiltert wird danach). */
const gemerkt = async (heute: string) => merken(`kapazitaet:${await kapaSpeicher()}:${heute}`, 60_000, () => kapaStandRoh(heute));

/** Der Stand für eine Person (Plattform-Regel: serverseitig gefiltert — Erholung/Titel nur die eigenen). */
export async function kapaStandFuer(person: string, heute = localDay()) {
  const { stand, bezuege } = await gemerkt(heute);
  return { stand: fuerBetrachter(stand, kapaIdVon(person)), bezuege };
}

/**
 * Nur die Kennzahlen der Säule „Kapazität“ (Business-Index) — Summen, nie Einzelwerte. Fehler → null (Säule zählt nicht).
 * Ohne Gesundheits-Ableitung (DSGVO-Prüfung 04.10., Art. 9): der Index geht an ZOE, in den Verlauf und in Berichte — der
 * Erholungs-Faktor bleibt in der Kapazität (`ohneGesundheit`).
 */
export async function kapaKennzahlenFuerIndex(heute = localDay()): Promise<KapaKennzahlen | null> {
  try { return ohneGesundheit(fuerBetrachter((await gemerkt(heute)).stand, null).kennzahlen); } catch { return null; }
}

// ── DSGVO-Nachtrag 04.10.: Löschfrist deaktivierter Team-Personen + Auskunft (Regeln rein in ./aufraeumen.ts) ──

export interface KapaAufraeumBericht { gestempelt: number; personen: number; teile: number }

/**
 * Morgenlauf-Schritt „Kapazität deaktivierter Personen“: alte deaktivierte Einträge ohne Zeitpunkt stempeln (Frist beginnt),
 * nach 30 Tagen die Kapazitätsdaten der Person löschen. Liest erst ohne Sperre; schreibt nur, wenn etwas fällig ist. Beides
 * in der Sperre des Team-Bestands (ein gleichzeitiges Reaktivieren über /api/team wartet). Protokoll „System“ (nur Kennungen).
 */
export async function kapaDeaktivierteAufraeumen(haushalt: string, jetzt = new Date()): Promise<KapaAufraeumBericht> {
  const iso = jetzt.toISOString();
  const teamName = teamSpeicherName(haushalt);
  const kapaName = kapaSpeicherFuer(haushalt);
  const vorab = kapaLoeschPlan((await loadJson<TeamDatei>(teamName))?.team ?? [], iso);
  if (!vorab.stempeln.length && !vorab.faellig.length) return { gestempelt: 0, personen: 0, teile: 0 };
  const bericht: KapaAufraeumBericht = { gestempelt: 0, personen: 0, teile: 0 };
  let geloescht: string[] = [];
  let gestempelt: string[] = [];
  await updateJsonAsync<TeamDatei>(teamName, async cur => {
    if (!cur || !Array.isArray(cur.team)) return cur as TeamDatei;
    const plan = kapaLoeschPlan(cur.team, iso);
    const stempeln = new Set(plan.stempeln);
    if (plan.faellig.length) {
      const ids = new Set(plan.faellig);
      await updateJson<KapaDatei>(kapaName, alt => {
        const r = kapaOhnePersonen(alt, ids);
        bericht.personen = r.personen.length; bericht.teile = r.teile; geloescht = r.personen;
        return r.teile ? r.datei : (alt as KapaDatei);
      });
    }
    bericht.gestempelt = stempeln.size; gestempelt = plan.stempeln;
    return stempeln.size ? { ...cur, team: cur.team.map(e => (stempeln.has(e.id) ? { ...e, deaktiviertAm: iso } : e)) } : cur;
  });
  if (bericht.gestempelt) await protokolliere(teamName, gestempelt.map(id => ({ op: 'geaendert' as const, id, felder: ['deaktiviertAm'] })), { art: 'system' });
  if (geloescht.length) await protokolliere(kapaName, geloescht.map(id => ({ op: 'geloescht' as const, id })), { art: 'system' });
  return bericht;
}

/** Meilensteine (Business) und Jahresziele mit `personen` — nur Verweise für die Auskunft. */
async function postenMitPersonen() {
  const [ms, ziele] = await Promise.all([loadJson<{ meilensteine?: Meilenstein[] }>('meilensteine'), loadJson<ZieleDatei>('ziele')]);
  return [
    ...(ms?.meilensteine ?? []).filter(m => meilensteinSpace(m) === 'business' && m.personen?.length).map(m => ({ art: 'meilenstein' as const, id: m.id, titel: m.titel, personen: m.personen })),
    ...(ziele?.jahr ?? []).filter(z => z.space !== 'privat' && z.personen?.length).map(z => ({ art: 'ziel' as const, id: z.id, titel: z.titel, personen: z.personen })),
  ];
}

/** Anzeigenamen der Mandate/Kunden (CRM) — nur für die Auskunft. */
async function bezugNamenLaden(): Promise<Record<string, string>> {
  const crm = await sicher(() => ladeCrm(), null);
  const namen: Record<string, string> = {};
  for (const m of mandatKurzListe(crm)) namen[m.id] = mandatLabel(m);
  for (const f of crm?.firmen ?? []) namen[f.id] = f.name;
  return namen;
}

/**
 * Art. 15 — Kapazitätsdaten einer Person des Teams (auch deaktiviert). Rechte entscheidet die Route; hier: unbekannt → null.
 * Team des Haushalts des Inhabers (Konten + gepflegte Personen, nie Platzhalter).
 */
export async function kapaAuskunftLaden(personId: string, jetzt = new Date()): Promise<{ auskunft: KapaAuskunft; konto: boolean } | null> {
  const h = await haushaltDesInhabers();
  const { team } = await teamStand(h);
  const e = team.find(t => t.quelle !== 'platzhalter' && t.id === personId);
  if (!e) return null;
  const [datei, posten, bezugNamen] = await Promise.all([ladeKapaDatei(), postenMitPersonen(), bezugNamenLaden()]);
  return { auskunft: kapaAuskunft({ eintrag: e, datei, posten, bezugNamen, jetzt: jetzt.toISOString() }), konto: e.quelle === 'konto' };
}

/**
 * Für die Kontakt-Auskunft (lib/crm/person-bestaende.ts): Team-Personen OHNE Konto, deren E-Mail eine der Adressen der
 * Person ist — deren Kapazitätsdaten als Kopie. Konten nie (die Person sieht ihre Daten selbst). Fehler → leer.
 */
export async function kapaAuskunftFuerAdressen(adressen: readonly string[], jetzt = new Date()): Promise<KapaAuskunft[]> {
  const a = new Set(adressen.map(x => x.trim().toLowerCase()).filter(Boolean));
  if (!a.size) return [];
  try {
    const { team } = await teamStand(await haushaltDesInhabers());
    const treffer = team.filter(t => t.quelle === 'daten' && t.email && a.has(t.email.toLowerCase()));
    if (!treffer.length) return [];
    const [datei, posten, bezugNamen] = await Promise.all([ladeKapaDatei(), postenMitPersonen(), bezugNamenLaden()]);
    return treffer.map(e => kapaAuskunft({ eintrag: e, datei, posten, bezugNamen, jetzt: jetzt.toISOString() }));
  } catch { return []; }
}
