// ─── Konto: eigene Daten herunterladen (Art. 15/20) und Konto löschen (Art. 17) — 05.10., Paket „Betroffenenrechte v2“ ─────
// Kevin 05.10.: „Die Software muss auf allen Standards der DSGVO sein, damit wir auch die Daten der Kunden aufnehmen können.“
// Jede Person mit Konto bekommt ihre Daten selbst (Konto › Meine Daten) und kann ihr Konto selbst löschen — ohne den Inhaber.
//
// Welche Bestände zur Person gehören, folgt dem Speicher-Register (lib/crm/speicher-register.ts):
//   PERSON_BESTAENDE  Bestände JE PERSON (`<basis>--<speicher>`, beim Erstkonto auch `<basis>` — `speicherFuer`): gehen ganz in den
//                     Export und werden beim Löschen ganz entfernt (Datei + Tagessicherungen, `bestandEntfernen`).
//   GETEILTE_BESTAENDE geteilte Bestände mit Einträgen je Person (Feld `person` o. ä. — u. a. zoe-verlauf, telegram, tasks, agent-log
//                     seit 08.10.): im Export nur die eigenen Einträge; beim Löschen
//                     fallen sie weg bzw. die Kennung wird „[gelöscht]“ (Nachweise/Protokolle — rechtmäßige Umschreibung, die Hash-Kette
//                     zählt solche Einträge als „getilgt“, lib/store/protokoll-kette.ts).
//   NICHT_PERSOENLICH jedes andere Register-Muster `…--*` mit Grund (Haushalt, Kartei, Monat) — der Wächtertest
//                     tests/betroffenenrechte.test.ts verlangt, dass JEDES `--*`-Muster des Registers hier eingeordnet ist.
// Gelöscht wird nie ohne Rückfrage + Passwort/zweiten Faktor (Route app/api/konto/daten). Der Inhaber kann sein Konto nicht löschen,
// solange es andere Konten gibt. Ein Grabstein (nur HMAC der Konto-Kennung, lib/datenschutz/grabsteine.ts) sorgt dafür, dass ein
// Zurückspielen einer Sicherung das Konto nicht zurückholt (`kontenNachGrabstein`).

import { promises as fs } from 'fs';
import { datenOrdner, loadJson, updateJson, bestandEntfernen } from '@/lib/store/local-db';
import { aendereKonten, ladeKonten, oeffentlich, type Konto } from '@/lib/zugang/konten';
import { speicherFuer } from '@/lib/zoe/raum';
import { teamSpeicherName } from '@/lib/make-one/team-speicher';
import { KONTO_PRAEFIX } from '@/lib/make-one/team-typen';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { grabsteinKennung, grabsteinSetzen, type Grabstein } from './grabsteine';
import { kennungsVersion } from './pepper';
import { familieName } from '@/lib/familie/speicher';

export const GELOESCHT = '[gelöscht]';

/**
 * Bestände je Person — `export: false` = nie in eine Datei (Zugangsschlüssel), beim Löschen trotzdem weg. `nurMitSuffix`: der Bestand
 * heißt IMMER `<basis>--<speicher>` — `<basis>` selbst ist ein GETEILTER Bestand (Onboarding: `onboarding` = gemeinsame Häkchen) und
 * gehört nie einer Person (sonst fiele er beim Erstkonto über `speicherFuer` in Export und Löschen).
 */
export const PERSON_BESTAENDE: readonly { basis: string; export?: false; grund?: string; nurMitSuffix?: true }[] = [
  { basis: 'zeit' }, { basis: 'fokus-laufend' }, { basis: 'wochenplan' }, { basis: 'sport' }, { basis: 'vitals' }, { basis: 'haut' },
  { basis: 'streak' }, { basis: 'health-log' }, { basis: 'journal' }, { basis: 'ziele-eigen' }, { basis: 'visitenkarten' },
  { basis: 'meldungen' }, { basis: 'performance' }, { basis: 'flaeche' }, { basis: 'kalender-google' }, { basis: 'gmail-stand' }, { basis: 'gmail-text' },
  { basis: 'imap-stand' }, { basis: 'imap-text' }, { basis: 'postfaecher' }, { basis: 'inbox-zustand' },
  { basis: 'postfach-zugang', export: false, grund: 'Passwörter der Postfächer (verschlüsselt) — nie in einer Datei; beim Löschen entfernt' },
  { basis: 'google-verbindung', export: false, grund: 'Zugangsschlüssel zu Google (verschlüsselte Token) — nie in einer Datei; beim Löschen widerrufen und entfernt' },
  // iCloud je Person (06.10.): der Spiegel der eigenen Kalender gehört der Person; der Zugang (App-Passwort) nie in eine Datei.
  { basis: 'kalender-icloud' },
  { basis: 'icloud-verbindung', export: false, grund: 'Zugang zu iCloud (Apple-ID + app-spezifisches Passwort, verschlüsselt) — nie in einer Datei; beim Löschen entfernt (das App-Passwort bitte zusätzlich bei Apple widerrufen)' },
  // WHOOP je Person (08.10.): der Spiegel der eigenen Werte gehört der Person (Export); der Zugang (Token) nie in eine Datei.
  { basis: 'whoop-stand' },
  { basis: 'whoop-verbindung', export: false, grund: 'Zugang zu WHOOP (verschlüsselte Token) — nie in einer Datei; beim Löschen bei WHOOP widerrufen und entfernt' },
  // Körper-Profil (08.10. abends, Fragebogen Teil 3): gehört allein der Person — Export und Löschen mit dem Konto.
  { basis: 'gesundheit-koerper' },
  // Onboarding (08.10. spät): persönliche Häkchen der Einrichtung — `onboarding` ohne Suffix sind die GEMEINSAMEN (geteilter Bestand).
  { basis: 'onboarding', nurMitSuffix: true },
  // Seit 08.10. spät je Person (Datenschutz vor dem Upload): Tagesläufe mit Ausrichtung, Arbeits- und Gesundheits-Schalter.
  { basis: 'tageslauf' }, { basis: 'arbeitsmodus' }, { basis: 'gesundheitszeit' },
  // Business-frei (08.10., Lücke 7): die eigene Ergänzung des Arbeitsrahmens — immer mit Suffix (`arbeitsrahmen--<speicher>`).
  { basis: 'arbeitsrahmen', nurMitSuffix: true },
];

/** Register-Muster `…--*`, die NICHT je Person sind — mit Grund (Wächter: jedes Muster ist eingeordnet). */
export const NICHT_PERSOENLICH: Readonly<Record<string, string>> = {
  'absichten--*': 'Absichtsprotokoll je Haushalt (technisch, kurzlebig)',
  'aenderungsprotokoll--*': 'Protokoll je Haushalt und Monat — im Export die eigenen Einträge, beim Löschen Kennung „[gelöscht]“',
  'leseprotokoll--*': 'Protokoll je Haushalt und Monat — im Export die eigenen Einträge, beim Löschen Kennung „[gelöscht]“',
  'ki-protokoll--*': 'KI-Protokoll je Monat — im Export die eigenen Einträge, beim Löschen Kennung „[gelöscht]“',
  'zoe-entscheidungen--*': 'Entscheidungen je Haushalt und Monat (Rechenschaft)',
  'aufgaben-dateien--*': 'Dateien zu Aufgaben je Haushalt',
  'brain-bruecke--*': 'Einstellung je Haushalt',
  'buchung--*': 'Buchungsseiten und Buchungen Dritter',
  'crm-dateien--*': 'Dateiablage der Kartei je Haushalt',
  'crm-import-laeufe--*': 'Import-Läufe der Kartei',
  'crm-sperrliste--*': 'Sperrliste (nur Fingerabdrücke)',
  'familie--*': 'Familie je Haushalt',
  'finanzen-plan--*': 'Finanzplan je Haushalt (Aufbewahrungspflicht)',
  'gesellschaften--*': 'Gesellschafts-Register je Haushalt',
  'haushalt-*--*': 'Haushaltsfinanzen je Haushalt',
  'haushalt-umzug--*': 'Umzugskopie der Haushaltsfinanzen',
  'kalender-umzug-sicherung--*': 'Umzugssicherung des Kalenders (30 Tage)',
  'kapazitaet--*': 'Kapazität je Haushalt — im Export die eigenen Werte, beim Löschen weg (Morgenlauf-Regel sofort angewendet)',
  'kapazitaet-plan--*': 'Wochenpläne je Haushalt — wie Kapazität',
  'kennung-alias--*': 'Weiterleitung alter Kontakt-Kennungen',
  'konten--*': 'Konten-Register je Haushalt (08.10.) — im Export die eigenen Konten (IBAN maskiert), beim Löschen bleiben die Konten des Haushalts, die Personen-Kennung wird „[gelöscht]“',
  'meilenstein-raum--*': 'Austausch je Meilenstein (Arbeit des Haushalts)',
  'netzwerken-erfassungen--*': 'Journal der Erfassungen (technisch)',
  'planung-einheiten--*': 'Einheiten der Planung je Haushalt',
  'nordstern--*': 'Nordstern je Haushalt (gemeinsames Ziel, Freitext ohne Personen-Feld — kann Vornamen nennen, wird beim Konto-Löschen nicht automatisch getilgt, ändern unter Planung › Jahr) — wer ihn geändert hat, steht nur im Änderungsprotokoll',
  'team--*': 'Team je Haushalt — der Eintrag des Kontos fällt beim Löschen weg',
  'uebergabe-journal--*': 'Übergaben an Kunden (Kartei)',
  'zoe-chargen--*': 'ZOE-Chargen je Haushalt (nur Kennungen)',
};

const PERSON = /^[a-z0-9-]{1,40}$/;

/** Die Namen der persönlichen Bestände einer Person (rein): `<basis>--<p>` und, wo der Code es so liest, `<basis>` (Erstkonto). */
export function personBestandNamen(speicher: string, vorhanden: readonly string[]): { name: string; export: boolean }[] {
  if (!PERSON.test(speicher)) return [];
  const da = new Set(vorhanden);
  const raus = new Map<string, boolean>();
  for (const b of PERSON_BESTAENDE) {
    for (const n of b.nurMitSuffix ? [`${b.basis}--${speicher}`] : [`${b.basis}--${speicher}`, speicherFuer(b.basis, speicher)]) if (da.has(n)) raus.set(n, b.export !== false);
  }
  return Array.from(raus, ([name, ex]) => ({ name, export: ex })).sort((a, b) => a.name.localeCompare(b.name));
}

async function bestandsNamen(): Promise<string[]> {
  return (await fs.readdir(datenOrdner()).catch(() => [] as string[])).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)).sort();
}

const PROTOKOLL = /^(aenderungsprotokoll|leseprotokoll)--[a-z0-9-]+--\d{4}-\d{2}$|^ki-protokoll--\d{4}-\d{2}$/;
const PERSON_FELDER = ['person', 'speicher', 'betroffen', 'von'] as const;

/** Nennt ein Protokoll-Eintrag die Person (in einem der Personen-Felder)? Rein. */
export const eintragDerPerson = (e: unknown, speicher: string): boolean => !!e && typeof e === 'object' && PERSON_FELDER.some(f => (e as Record<string, unknown>)[f] === speicher);
/** Personen-Felder mit der Kennung → „[gelöscht]“ (rechtmäßige Umschreibung, Art. 17). Rein; derselbe Wert, wenn nichts zu tun war. */
export function eintragTilgen<T>(e: T, speicher: string): T {
  if (!eintragDerPerson(e, speicher)) return e;
  const o = { ...(e as Record<string, unknown>) };
  for (const f of PERSON_FELDER) if (o[f] === speicher) o[f] = GELOESCHT;
  return o as T;
}

type Obj = Record<string, unknown>;
const liste = (o: Obj | null | undefined, feld: string): unknown[] => (o && Array.isArray(o[feld]) ? (o[feld] as unknown[]) : []);

// ── Export (Art. 15 Abs. 3 / Art. 20) ─────────────────────────────────────────

export interface KontoExport {
  erstellt: string;
  konto: ReturnType<typeof oeffentlich> & { haushalt?: string };
  /** Bestände, die ganz der Person gehören (Name → Inhalt). */
  bestaende: Record<string, unknown>;
  /** Eigene Einträge aus geteilten Beständen. */
  eintraege: Record<string, unknown[]>;
  /** Eigene Einträge aus Protokollen (Anmeldungen, Änderungen, Lesezugriffe, KI-Aufrufe). */
  protokolle: Record<string, unknown[]>;
  /** Nicht in der Datei — mit Grund. */
  nichtEnthalten: { bestand: string; grund: string }[];
}

/** Alles mit Bezug zur Person (Konto, eigene Bestände, eigene Einträge, Protokolle). Nie Hash, Salz, zweiter Faktor, Token. */
export async function kontoExport(speicher: string, jetzt = new Date()): Promise<KontoExport | null> {
  const { konten } = await ladeKonten();
  const k = konten.find(x => x.speicher === speicher);
  if (!k) return null;
  const namen = await bestandsNamen();
  const bestaende: Record<string, unknown> = {};
  const nichtEnthalten: KontoExport['nichtEnthalten'] = [];
  for (const b of personBestandNamen(speicher, namen)) {
    if (!b.export) { nichtEnthalten.push({ bestand: b.name, grund: PERSON_BESTAENDE.find(x => b.name.startsWith(x.basis))?.grund ?? 'Zugangsschlüssel' }); continue; }
    bestaende[b.name] = await loadJson<unknown>(b.name);
  }
  const eintraege: Record<string, unknown[]> = {};
  const merke = (name: string, l: unknown[]) => { if (l.length) eintraege[name] = l; };
  const zv = await loadJson<Obj>('zoe-verlauf');
  merke('zoe-verlauf', liste(zv, 'gespraeche').filter(g => (g as Obj).person === speicher));
  const tg = await loadJson<Obj>('telegram');
  merke('telegram', liste(tg, 'kopplungen').filter(x => (x as Obj).person === speicher));
  const ge = await loadJson<Obj>('gesundheit-einwilligungen');
  merke('gesundheit-einwilligungen', liste(ge, 'ereignisse').filter(x => (x as Obj).person === speicher));
  const ki = await loadJson<{ personen?: Record<string, unknown> }>('ki-einstellungen');
  if (ki?.personen?.[speicher]) eintraege['ki-einstellungen'] = [ki.personen[speicher]];
  // WhatsApp (07.10.): selbst gesendete Nachrichten der Business-Nummer (Zeit, Art, Text, Zustellstand — ohne Nummer der Gegenseite).
  const wa = await loadJson<{ nachrichten?: Record<string, Obj> }>('whatsapp-spiegel').catch(() => null);
  merke('whatsapp-spiegel', Object.values(wa?.nachrichten ?? {}).filter(n => n.von === speicher).map(n => ({ am: n.am, art: n.art, text: n.text, status: n.status, ...(n.vorlage ? { vorlage: n.vorlage } : {}) })));
  // Agenten-Läufe je Person (08.10.): die von der Person ausgelösten Läufe (Ergebnisse) — Systemläufe ohne Person nicht.
  const al = await loadJson<Obj>('agent-log').catch(() => null);
  merke('agent-log', liste(al, 'entries').filter(e => (e as Obj).person === speicher));
  // Onboarding (08.10. spät): gemeinsame Häkchen, die die Person gesetzt hat (Schritt, Zeitpunkt).
  const ob = await loadJson<{ erledigt?: Record<string, { at?: string; von?: string }> }>('onboarding').catch(() => null);
  merke('onboarding', Object.entries(ob?.erledigt ?? {}).filter(([, h]) => h?.von === speicher).map(([schritt, h]) => ({ schritt, at: h.at })));
  const tasks = await loadJson<Obj>('tasks');
  merke('tasks', liste(tasks, 'tasks').filter(t => { const x = t as Obj; return x.assignee === speicher || x.angelegtVon === speicher || (Array.isArray(x.beteiligte) && x.beteiligte.includes(speicher)); }));
  if (k.haushalt) {
    // Konten-Register (08.10.): die Konten, die der Person gehören (IBAN maskiert).
    const eigeneKonten = await (await import('@/lib/finanzen/konten/server')).kontenDerPerson(k.haushalt, speicher).catch(() => []);
    if (eigeneKonten.length) eintraege[`konten--${k.haushalt}`] = eigeneKonten;
    const kapa = await loadJson<Obj>(`kapazitaet--${k.haushalt}`).catch(() => null);
    const kid = `${KONTO_PRAEFIX}${speicher}`;
    if (kapa && JSON.stringify(kapa).includes(`"${kid}"`)) eintraege[`kapazitaet--${k.haushalt}`] = [{ hinweis: 'Ihre Kapazitätswerte stehen vollständig in der Kapazitäts-Auskunft (Planung › Kapazität).', person: kid }];
  }
  const protokolle: Record<string, unknown[]> = {};
  const anm = await loadJson<Obj>('anmeldungen');
  const eigeneAnm = liste(anm, 'eintraege').filter(e => (e as Obj).speicher === speicher).map(e => { const { h: _h, ...r } = e as Obj; return r; });
  if (eigeneAnm.length) protokolle.anmeldungen = eigeneAnm;
  for (const n of namen.filter(x => PROTOKOLL.test(x))) {
    const d = await loadJson<Obj>(n).catch(() => null);
    const l = liste(d, 'eintraege').filter(e => eintragDerPerson(e, speicher)).map(e => { const { h: _h, ...r } = e as Obj; return r; });
    if (l.length) protokolle[n] = l;
  }
  return { erstellt: jetzt.toISOString(), konto: { ...oeffentlich(k), ...(k.haushalt ? { haushalt: k.haushalt } : {}) }, bestaende, eintraege, protokolle, nichtEnthalten };
}

// ── Löschen (Art. 17) ──────────────────────────────────────────────────────────

export interface KontoLoeschBericht {
  bestaende: string[];
  eintraege: Record<string, number>;
  protokolle: Record<string, number>;
  /** Aufgaben, die der Person noch als verantwortlich zugewiesen sind (bleiben als Arbeit des Haushalts — neu zuweisen). */
  aufgabenZugewiesen: number;
  google: 'widerrufen' | 'entfernt' | 'keine';
  /** WHOOP (08.10.): Zugang bei WHOOP widerrufen bzw. nur entfernt. */
  whoop?: 'widerrufen' | 'entfernt' | 'keine';
  grabstein: boolean;
}

/** Kennung des Konto-Grabsteins (nur HMAC/SHA der zufälligen Konto-Kennung — nie Name/Adresse; trifft nie einen Kontakt). */
export const kontoGrabsteinKennung = (kontoId: string, v = kennungsVersion()) => grabsteinKennung(`konto:${kontoId}`, v);

/** Darf diese Person ihr Konto löschen? Rein. Inhaber nur, wenn er allein ist. */
export function loeschenErlaubt(k: Pick<Konto, 'speicher' | 'rolle'>, alle: readonly Pick<Konto, 'speicher'>[]): { ok: true } | { ok: false; fehler: string } {
  if (k.rolle === 'inhaber' && alle.some(x => x.speicher !== k.speicher)) return { ok: false, fehler: 'Als Inhaber können Sie Ihr Konto erst löschen, wenn es keine anderen Konten mehr gibt — entfernen Sie zuerst die anderen Konten bzw. lassen Sie sie ihr Konto selbst löschen. Für das Ende der ganzen Instanz gibt es den Instanz-Export und das Löschskript (System › Datenschutz).' };
  return { ok: true };
}

/**
 * Das Konto einer Person löschen — über alle Bestände laut Register. Idempotent (ein zweiter Lauf findet nichts mehr). Wirft bei
 * Schreibfehlern der Konten (dann bleibt das Konto); Fehler in einzelnen anderen Beständen landen im Log, der Rest läuft weiter.
 * `grabstein: false` nur beim erneuten Anwenden nach einem Zurückspielen.
 */
export async function kontoLoeschen(speicher: string, opt: { grabstein?: boolean; jetzt?: Date } = {}): Promise<KontoLoeschBericht | null> {
  const jetzt = opt.jetzt ?? new Date();
  const konto = (await ladeKonten()).konten.find(k => k.speicher === speicher);
  if (!konto) return null;
  const bericht: KontoLoeschBericht = { bestaende: [], eintraege: {}, protokolle: {}, aufgabenZugewiesen: 0, google: 'keine', grabstein: false };
  const zaehl = (r: Record<string, number>, n: string, x: number) => { if (x) r[n] = (r[n] ?? 0) + x; };

  // 1. Grabstein zuerst — fällt danach etwas aus, holt ein Restore das Konto trotzdem nicht zurück.
  if (opt.grabstein !== false) {
    const g: Grabstein = { k: kontoGrabsteinKennung(konto.id) ?? '', m: [], v: kennungsVersion(), am: jetzt.toISOString().slice(0, 10) };
    await grabsteinSetzen(g);
    bericht.grabstein = true;
  }
  // 2. Google: Token widerrufen (solange die Verbindung noch da ist) — ein Fehler verhindert das Löschen nie.
  try {
    const { googleTrennen } = await import('@/lib/google/verbindung');
    const r = await googleTrennen(speicher);
    if (r.war) bericht.google = r.widerrufen ? 'widerrufen' : 'entfernt';
  } catch (e) { console.error('[konto-loeschen] Google:', e instanceof Error ? e.message : e); }
  // 2b. WHOOP (08.10.): Zugang widerrufen, Verbindung + Spiegel weg — ein Fehler verhindert das Löschen nie.
  try {
    const { whoopTrennen } = await import('@/lib/whoop/verbindung');
    const r = await whoopTrennen(speicher);
    bericht.whoop = r.war ? (r.widerrufen ? 'widerrufen' : 'entfernt') : 'keine';
  } catch (e) { console.error('[konto-loeschen] WHOOP:', e instanceof Error ? e.message : e); }

  // 3. Das Konto selbst: raus aus den Konten, eigene Einladungen weg, aus „teilt Gesundheit / eigene Ziele mit“ der anderen (08.10.).
  await aendereKonten(s => ({
    ...s,
    konten: s.konten.filter(k => k.speicher !== speicher).map(k => (k.teilt?.gesundheit?.includes(speicher) || k.teilt?.ziele?.includes(speicher)
      ? { ...k, teilt: { ...k.teilt, gesundheit: (k.teilt.gesundheit ?? []).filter(x => x !== speicher), ...(k.teilt.ziele ? { ziele: k.teilt.ziele.filter(x => x !== speicher) } : {}) } }
      : k)),
    einladungen: s.einladungen.filter(e => e.von !== speicher && e.speicher !== speicher),
  }));

  // 4. Bestände je Person: ganz entfernen (mit Tagessicherungen).
  const namen = await bestandsNamen();
  for (const b of personBestandNamen(speicher, namen)) {
    try { if (await bestandEntfernen(b.name, { tageskopien: true })) bericht.bestaende.push(b.name); }
    catch (e) { console.error(`[konto-loeschen] ${b.name}:`, e instanceof Error ? e.message : e); }
  }

  // 5. Geteilte Bestände: eigene Einträge raus.
  const sicher = async (name: string, f: () => Promise<number>) => { try { zaehl(bericht.eintraege, name, await f()); } catch (e) { console.error(`[konto-loeschen] ${name}:`, e instanceof Error ? e.message : e); } };
  const nurWenn = async (name: string, f: () => Promise<number>) => { if (namen.includes(name)) await sicher(name, f); };
  await nurWenn('zoe-verlauf', async () => { let n = 0; await updateJson<Obj>('zoe-verlauf', cur => { const l = liste(cur, 'gespraeche'); const r = l.filter(g => (g as Obj).person !== speicher); n = l.length - r.length; return n ? { ...(cur ?? {}), gespraeche: r } : (cur as Obj); }); return n; });
  await nurWenn('telegram', async () => { let n = 0; await updateJson<Obj>('telegram', cur => {
    if (!cur) return cur as unknown as Obj;
    const l = liste(cur, 'kopplungen'); const r = l.filter(x => (x as Obj).person !== speicher);
    const codes = Object.fromEntries(Object.entries((cur.codes ?? {}) as Record<string, { person?: string }>).filter(([, v]) => v?.person !== speicher));
    n = l.length - r.length + Object.keys((cur.codes ?? {}) as object).length - Object.keys(codes).length;
    return n ? { ...cur, kopplungen: r, codes } : cur;
  }); return n; });
  await nurWenn('ki-einstellungen', async () => { let n = 0; await updateJson<{ personen?: Record<string, unknown> } & Obj>('ki-einstellungen', cur => {
    if (!cur?.personen?.[speicher]) return cur as Obj;
    const { [speicher]: _weg, ...rest } = cur.personen; n = 1;
    return { ...cur, personen: rest };
  }); return n; });
  // Einwilligungs-Nachweis (Art. 9): die Ereignisse bleiben als Nachweis (nur anhängend), die Kennung der Person wird „[gelöscht]“.
  await nurWenn('gesundheit-einwilligungen', async () => { let n = 0; await updateJson<Obj>('gesundheit-einwilligungen', cur => {
    const l = liste(cur, 'ereignisse'); const r = l.map(e => eintragTilgen(e, speicher)); n = r.filter((x, i) => x !== l[i]).length;
    return n ? { ...(cur ?? {}), ereignisse: r } : (cur as Obj);
  }); return n; });
  // Onboarding (08.10. spät): gemeinsame Häkchen bleiben (Stand des Haushalts), „wer abgehakt hat“ wird „[gelöscht]“.
  await nurWenn('onboarding', async () => { let n = 0; await updateJson<{ erledigt?: Record<string, { at: string; von: string }> }>('onboarding', cur => {
    if (!cur?.erledigt) return cur as { erledigt?: Record<string, { at: string; von: string }> };
    const erledigt = Object.fromEntries(Object.entries(cur.erledigt).map(([k, h]) => { if (h?.von === speicher) { n++; return [k, { ...h, von: GELOESCHT }]; } return [k, h]; }));
    return n ? { ...cur, erledigt } : cur;
  }); return n; });
  // Agenten-Läufe (08.10.): die Läufe der Person sind ihre Ergebnisse (sieht sonst niemand) — sie fallen ganz weg, kein Nachweis nötig.
  await nurWenn('agent-log', async () => { let n = 0; await updateJson<Obj>('agent-log', cur => { const l = liste(cur, 'entries'); const r = l.filter(e => (e as Obj).person !== speicher); n = l.length - r.length; return n ? { ...(cur ?? {}), entries: r } : (cur as Obj); }); return n; });
  // WhatsApp (07.10.): gesendete Nachrichten bleiben (Geschäftskorrespondenz der Instanz), „wer gesendet hat“ wird „[gelöscht]“.
  await nurWenn('whatsapp-spiegel', async () => { let n = 0; await updateJson<Obj>('whatsapp-spiegel', cur => {
    const alt = (cur?.nachrichten ?? {}) as Record<string, Obj>;
    const neu: Record<string, Obj> = {};
    for (const [id, m] of Object.entries(alt)) { const x = m.von === speicher ? { ...m, von: GELOESCHT } : m; if (x !== m) n++; neu[id] = x; }
    return n ? { ...(cur ?? {}), nachrichten: neu } : (cur as Obj);
  }); return n; });
  // Private Aufgaben der Person („nur ich“) gehen mit — sonst sähe sie niemand mehr. Alle anderen bleiben (Arbeit des Haushalts).
  await nurWenn('tasks', async () => { let weg: string[] = [], beteiligt: string[] = []; await updateJson<Obj>('tasks', cur => {
    const l = liste(cur, 'tasks') as Obj[];
    weg = l.filter(t => t.sichtbarkeit === 'nur-ich' && t.angelegtVon === speicher).map(t => String(t.id));
    bericht.aufgabenZugewiesen = l.filter(t => !weg.includes(String(t.id)) && t.assignee === speicher).length;
    // Als Beteiligte fällt die Person überall heraus (reiner Verweis); Zuständige/Anlegerin bleibt als Geschäftsunterlage stehen.
    const ohneBeteiligt = (t: Obj): Obj => (Array.isArray(t.beteiligte) && t.beteiligte.includes(speicher) ? { ...t, beteiligte: (t.beteiligte as string[]).filter(x => x !== speicher) } : t);
    const rest = l.filter(t => !weg.includes(String(t.id)));
    const neu = rest.map(ohneBeteiligt);
    beteiligt = neu.filter((t, i) => t !== rest[i]).map(t => String(t.id));
    return weg.length || beteiligt.length ? { ...(cur ?? {}), tasks: neu } : (cur as Obj);
  });
  if (weg.length || beteiligt.length) await protokolliere('tasks', [...weg.map(id => ({ op: 'geloescht' as const, id })), ...beteiligt.map(id => ({ op: 'geaendert' as const, id, felder: ['beteiligte'] }))], { art: 'system' });
  return weg.length + beteiligt.length; });
  if (konto.haushalt) {
    const team = teamSpeicherName(konto.haushalt);
    await nurWenn(team, async () => { let n = 0; await updateJson<Obj>(team, cur => { const l = liste(cur, 'team'); const r = l.filter(e => (e as Obj).id !== `${KONTO_PRAEFIX}${speicher}`); n = l.length - r.length; return n ? { ...(cur ?? {}), team: r } : (cur as Obj); }); return n; });
    await sicher('kapazitaet', async () => { const { kapaEntfernteKontenAufraeumen } = await import('@/lib/kapazitaet/server'); return (await kapaEntfernteKontenAufraeumen(konto.haushalt!)).teile; });
    // Konten-Register (08.10.): Konten und Stände bleiben (Finanzen des Haushalts), die Personen-Kennung wird „[gelöscht]“.
    const kr = `konten--${konto.haushalt}`;
    await nurWenn(kr, async () => {
      const { registerOhnePerson } = await import('@/lib/finanzen/konten/server');
      const { registerLesen } = await import('@/lib/finanzen/konten/register');
      let n = 0;
      await updateJson<Obj>(kr, cur => { if (!cur) return cur as unknown as Obj; const r = registerOhnePerson(registerLesen(cur), speicher, GELOESCHT); n = r.anzahl; return n ? (r.register as unknown as Obj) : cur; });
      if (n) await protokolliere(kr, [{ liste: 'konten', op: 'geaendert', id: 'personen', felder: ['person', 'erfasstVon'] }], { art: 'system' });
      return n;
    });
    // Familie (08.10. abends, Fragebogen Teil 3 Frage 11 — erweitert die Vision-Regel der Gegenprüfung 08.10.): Einträge der Person
    // bleiben als gemeinsames Leben des Haushalts (Dates, Vereinbarungen, Themen, Wünsche, Gespräche, Reparatur, Vision …), aber OHNE
    // ihren Namen; ihre „nur ich“-Einträge, ungeteilten Reflexionen und ihr Profil fallen weg (sah nur sie — ohne sie wären sie
    // verwaist). Regeln rein in lib/familie/ohne-person.ts (`familieOhnePerson`); das Protokoll nennt Liste, Kennung, Feldnamen.
    const fam = familieName(konto.haushalt);
    await nurWenn(fam, async () => {
      const { familieOhnePerson } = await import('@/lib/familie/ohne-person');
      let n = 0;
      let aenderungen: import('@/lib/store/aenderungsprotokoll').Aenderung[] = [];
      await updateJson<Obj>(fam, cur => {
        if (!cur) return cur as unknown as Obj;
        const r = familieOhnePerson(cur as unknown as import('@/lib/familie/typen').Familie, speicher);
        n = r.anzahl;
        aenderungen = r.aenderungen;
        return n ? (r.familie as unknown as Obj) : cur;
      });
      if (n) await protokolliere(fam, aenderungen, { art: 'system' });
      return n;
    });
  }

  // 6. Protokolle: Einträge bleiben (Nachweis, Art. 5 Abs. 2), die Kennung der Person wird „[gelöscht]“ — die Hash-Kette zählt solche
  // Einträge als „getilgt“ (rechtmäßige Umschreibung), nicht als Bruch.
  for (const n of ['anmeldungen', ...namen.filter(x => PROTOKOLL.test(x))]) {
    if (!namen.includes(n)) continue;
    try {
      let x = 0;
      await updateJson<Obj>(n, cur => { const l = liste(cur, 'eintraege'); const r = l.map(e => eintragTilgen(e, speicher)); x = r.filter((e, i) => e !== l[i]).length; return x ? { ...(cur ?? {}), eintraege: r } : (cur as Obj); });
      zaehl(bericht.protokolle, n, x);
    } catch (e) { console.error(`[konto-loeschen] ${n}:`, e instanceof Error ? e.message : e); }
  }
  return bericht;
}

/**
 * Nach einem Zurückspielen (Grabsteine anwenden): Konten, deren Kennung auf einem Grabstein steht, erneut löschen — ohne neuen
 * Grabstein. Liefert die Zahl. Aufgerufen aus `grabsteineAnwenden` (lib/datenschutz/grabsteine.ts).
 */
export async function kontenNachGrabstein(g: readonly Grabstein[]): Promise<number> {
  if (!g.length) return 0;
  const ks = new Set(g.map(x => x.k).filter(Boolean));
  let n = 0;
  for (const k of (await ladeKonten()).konten) {
    if (![kontoGrabsteinKennung(k.id, 'v2'), kontoGrabsteinKennung(k.id, 'v1')].some(x => x && ks.has(x))) continue;
    if (await kontoLoeschen(k.speicher, { grabstein: false })) n++;
  }
  return n;
}
