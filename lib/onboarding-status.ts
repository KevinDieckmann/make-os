// ─── MAKE OS — Onboarding: der echte Zustand ────────────────────────────────
// Die Selbstprüfung der Einrichtung. Liegt hier und nicht in der Route, weil auch die Startfläche, die Karte auf Heute und die Datenbasis
// den Stand zeigen — eine Quelle, kein zweiter Satz Regeln, der auseinanderläuft.
//
// Regeln (ONBOARDING_PLAN.md A1, Paket B0/B3 Teil 1, Nachbesserung 08.10. spät, B3 Teil 2 + B11 für Update 2 am 16.10.):
//   · Prüfungen liefern NUR ja/nein und Zähler — nie Werte, Beträge, Adressen, Namen oder Gesundheitsinhalte.
//   · Persönliche Prüfungen gelten IMMER nur der Person der Sitzung (nie einer anderen); ohne Person fehlen sie ganz.
//   · Inhaber-Prüfungen (Altbestand) bekommt NUR die Sitzung des Haupt-Inhabers (der Altbestand ist seiner — seit 09.10. kann es mehrere
//     Inhaber geben); Instanz-Befunde (Server-Einstellungen) sehen alle Nicht-Inhaber nur als „Instanz eingerichtet: ja/nein“.
//   · B11 — Rechte auf dem Server: Befunde über private Finanzen (Finanzplan, Haushalt, Privat-Konten) nur mit `privatFinanzZugangFuer`,
//     Familie nur mit Haushaltszugang (`haushaltFuer` — dieselbe Regel wie /api/familie). Wer das Recht nicht hat, bekommt den Befund gar
//     nicht (nicht einmal einen Zähler). Wächter: tests/onboarding-u2.test.ts „Business-Partner bekommt keine Privat-Befunde“.
//   · „Verbunden UND gesund“: ein Zustand „getrennt“ oder „Anmeldung abgelehnt“ zählt nicht — und nichts ist grün ohne getane Arbeit.
//     Gibt es (noch) nichts zu prüfen (kein laufendes Mandat, noch kein Monatsabschluss fällig), ist der Befund `leer` — dann entscheidet
//     das Häkchen (lib/make-one/onboarding-data.ts `istFertig`), nie ein „grün ohne Arbeit“.
//   · Die Kartei nur über `kontakteFuerVerarbeitung` (Art. 18), Firmen-Posten nur über den 0-Punkt (`mitEroeffnung`), Ziele aus der
//     Planung — nie aus einer Vorgabe im Code. Befunde des Head of IT werden wiederverwendet (lib/hoi, nur lesen), nie nachgebaut.
//   · Jede Prüfung für sich (`sicher`): ein fehlerhafter Bestand macht EINEN Befund „nicht prüfbar“, nie die ganze Seite.
//   · Lesen schreibt nie (WHOOP, Familie, KI-Einstellungen werden roh gelesen — ihre Lader legen sonst Startbestände an). Geschrieben wird
//     nur im Morgenlauf: `einrichtungFesthalten` merkt, welche Schritte schon einmal grün waren (B10, lib/onboarding-haken.ts).
//   · Teuer (1 vCPU): einmal je Person für 60 s merken (`merken`, Person im Schlüssel); das Lagebild des Head of IT (ohne Personen) einmal
//     je 5 Minuten für alle (`hoiLage`).

import { loadJson, beschaedigt } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import { localDay } from '@/lib/zeit';
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { ladePostfaecher } from '@/lib/postfach/register';
import { BUSINESS_GESELLSCHAFTEN, bereichVonFirma } from '@/lib/einheiten';
import { fortschrittVon, istFertig, schritteFuer, type Kontext, type PruefBefund } from '@/lib/make-one/onboarding-data';
import { gruenFesthalten, hakenLesen } from '@/lib/onboarding-haken';
import { hauptInhaber, istWirksamerInhaber, kontenImHaushaltDerInhaber, wirksameInhaber } from '@/lib/zugang/inhaber';
import type { SpaceId } from '@/lib/make-one/space-regeln';

export type Befund = PruefBefund;

const nein = (wert: string): Befund => ({ erfuellt: false, wert });
const ja = (wert: string): Befund => ({ erfuellt: true, wert });
/** Nichts zu prüfen — das Häkchen entscheidet. */
const leer = (wert: string): Befund => ({ erfuellt: false, wert, leer: true });
/** Rot, weil ein Stand zu alt ist (für das Bild der Datenbasis). */
const veraltet = (wert: string): Befund => ({ erfuellt: false, wert, veraltet: true });
const PERSON = /^[a-z0-9-]{1,40}$/;
const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(`${bis.slice(0, 10)}T12:00:00Z`) - Date.parse(`${von.slice(0, 10)}T12:00:00Z`)) / 864e5);
/** Höchstes Alter eines Kontostands (Tage), damit er als frisch gilt. */
export const KONTOSTAND_FRISCH_TAGE = 7;
/** Höchstes Alter eines Stands im Konten-Register für Privat- und gemeinsame Konten (Tage, ONBOARDING_PLAN.md 3.10). */
export const PRIVATKONTO_FRISCH_TAGE = 31;
/** Bis zu diesem Tag stand persönlicher Altbestand im Code (Übernahme lib/altbestand/*): ein Inhaber-Konto davor hat einen. */
export const ALTBESTAND_BIS = '2026-10-09';

/** Persönliche Prüfungen — IMMER nur für `person` (die Person der Sitzung), nie für eine andere. */
export const PERSOENLICHE_PRUEFUNGEN = ['zwei-faktor', 'gesundheit-einwilligung', 'icloud', 'google', 'gmail', 'postfach', 'whoop', 'aufgaben-ich', 'zoe', 'konten-register', 'arbeitsrahmen', 'routinen'] as const;
/** Inhaber-Prüfungen — nur die Sitzung des Haupt-Inhabers bekommt sie (sein Altbestand), nie eine andere Person. */
export const INHABER_PRUEFUNGEN = ['altbestand'] as const;
/** Aus dem Lagebild des Head of IT (lib/hoi, nur lesen) — Instanz-Befunde. */
export const HOI_PRUEFUNGEN = ['ki', 'vault', 'abholung', 'hoi'] as const;
/** Instanz-Befunde (Server-Einstellungen): an andere als den Inhaber nur „Instanz eingerichtet: ja/nein“. */
export const INSTANZ_PRUEFUNGEN = ['sicherung', 'pepper', 'adresse', 'whoop-konfig', 'google-konfig', 'medien', 'datenschutz', ...HOI_PRUEFUNGEN] as const;
/** B11: Befunde über private Finanzen — nur mit Zugang zu den Privat-Finanzen (`privatFinanzZugangFuer`), sonst gar nicht. */
export const PRIVAT_PRUEFUNGEN = ['finanzplan', 'haushalt-fixkosten', 'konten-register'] as const;
/** B11: Befunde über die Familie — nur mit Haushaltszugang (`haushaltFuer`, wie /api/familie), sonst gar nicht. */
export const HAUSHALT_PRUEFUNGEN = ['familie-rahmen', 'familie-menschen'] as const;
/** Prüfungen über die Instanz bzw. den gemeinsamen Haushalt (für alle mit demselben Recht gleich). */
export const GEMEINSAME_PRUEFUNGEN = [
  ...INSTANZ_PRUEFUNGEN, 'zwei-faktor-pflicht', 'personen', 'haushalt', 'inhaber', 'eroeffnung', 'konten', 'posten', 'kontakte', 'ziele', 'fokus', 'kompass',
  'monatsabschluss', 'mandate', 'produkte', 'kapazitaet', 'business-einstellungen', 'agenten', 'brain', 'finanzplan', 'haushalt-fixkosten', ...HAUSHALT_PRUEFUNGEN,
] as const;
export const ALLE_PRUEFUNGEN: readonly string[] = [...PERSOENLICHE_PRUEFUNGEN, ...INHABER_PRUEFUNGEN, ...GEMEINSAME_PRUEFUNGEN];

/** Wer eine Prüfung wirft, bekommt „nicht prüfbar“ — nie bricht die ganze Seite. `null` = dieser Befund gehört der Person nicht (Recht). */
async function sicher(f: () => Promise<Befund | null>): Promise<Befund | null> {
  try { return await f(); } catch { return nein('nicht prüfbar'); }
}
/**
 * Einen Bestand lesen — liegt er beschädigt beiseite (local-db legt einen unlesbaren Bestand als `.corrupt-…` ab und liefert danach
 * null), ist das „nicht prüfbar“, nie „leer und damit grün“.
 */
async function lesen<T>(name: string): Promise<T | null> {
  const d = await loadJson<T>(name);
  if (d === null && await beschaedigt(name)) throw new Error(`${name} beschädigt`);
  return d;
}
/** Einmal laden, von mehreren Prüfungen geteilt — ein Fehler trifft nur die Prüfungen, die den Bestand brauchen. */
function einmal<T>(f: () => Promise<T>): () => Promise<T> { let p: Promise<T> | null = null; return () => (p ??= f()); }
const n = (z: number, eins: string, viele: string) => `${z} ${z === 1 ? eins : viele}`;
/** Monat vor dem Monat von `tag` (JJJJ-MM). */
const vormonat = (tag: string) => { const j = Number(tag.slice(0, 4)), m = Number(tag.slice(5, 7)); return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`; };
const monatName = (monat: string) => new Date(`${monat}-15T12:00:00Z`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** So lange gilt ein Lagebild des Head of IT für die Einrichtung (Server-Zustände ändern sich langsam; die Seite /os/hoi rechnet immer frisch). */
export const HOI_MERKEN_MS = 5 * 60_000;
type HoiLage = Awaited<ReturnType<typeof import('@/lib/hoi/innen').lage>>;
let hoiMerk: { bis: number; lage: Promise<HoiLage> } | null = null;
/**
 * Lagebild des Head of IT — enthält keine Personen, Adressen oder Inhalte (lib/hoi), darum EIN Eintrag für alle. Bewusst NICHT über `merken`
 * (das jede Schreibung leert): das Lagebild liest viele Bestände und ändert sich nicht mit jeder Eingabe — 5 Minuten (1 vCPU). Ein Fehler wird
 * nicht gemerkt.
 */
const hoiLage = (): Promise<HoiLage> => {
  const jetzt = Date.now();
  if (!hoiMerk || hoiMerk.bis < jetzt) {
    const lage = import('@/lib/hoi/innen').then(m => m.lage());
    hoiMerk = { bis: jetzt + HOI_MERKEN_MS, lage };
    lage.catch(() => { if (hoiMerk?.lage === lage) hoiMerk = null; });
  }
  return hoiMerk.lage;
};
/** Ein Befund aus dem HOI-Lagebild (fehlt = null). */
const hoiBefund = async (id: string) => (await hoiLage()).befunde.find(b => b.id === id) ?? null;
/** Ein Aufzählungs-Objekt (Einstellungen je Head) — wie viele wurden bewusst geändert (Server-Stempel `geaendertAm`)? */
const gestempelt = (o: unknown): number => Object.values(o && typeof o === 'object' ? o as Record<string, unknown> : {})
  .filter(x => !!x && typeof x === 'object' && typeof (x as { geaendertAm?: unknown }).geaendertAm === 'string').length;

/** Wessen Befunde und mit welchen Rechten (aus dem Konto — nie aus der Adresse). */
interface Umfang {
  person: string | null;
  /** Haushalt der Person, sonst der des Inhabers (Agenten-Einstellungen, Brain-Brücke). */
  haushalt: string | null;
  /** Haushalt, wenn die Person die Privat-Finanzen sehen darf (`privatFinanzZugangFuer`) — sonst null (B11). */
  privat: string | null;
  /** Haushalt, wenn die Person die Familie sehen darf (`haushaltFuer`) — sonst null (B11). */
  familie: string | null;
}

async function umfangFuer(person: string | null, k: (Kontext & { haushalt?: string }) | null): Promise<Umfang> {
  const z = await import('@/lib/finanzen/haushalt/zugriff');
  const [pz, hz, inh] = await Promise.all([
    person ? z.privatFinanzZugangFuer(person).catch(() => null) : null,
    person ? z.haushaltFuer(person).catch(() => null) : null,
    k?.haushalt ? null : (await import('@/lib/zugang/haushalt-inhaber')).haushaltDesInhabers().catch(() => null),
  ]);
  return { person, haushalt: k?.haushalt ?? inh ?? null, privat: pz?.haushalt ?? null, familie: hz?.haushalt ?? null };
}

type Pruefungen = Record<string, () => Promise<Befund | null>>;
async function ausfuehren(p: Pruefungen): Promise<Record<string, Befund>> {
  const namen = Object.keys(p);
  const werte = await Promise.all(namen.map(k => sicher(p[k])));
  return Object.fromEntries(namen.map((k, i) => [k, werte[i]]).filter((e): e is [string, Befund] => e[1] !== null));
}

async function persoenlich(person: string, u: Umfang): Promise<Record<string, Befund>> {
  const heute = localDay();
  const google = einmal(async () => (await import('@/lib/google/verbindung')).googleStatus(person));
  const routinen = einmal(() => lesen<{ routinen?: { aktiv?: boolean; owner?: string }[]; bloecke?: { owner?: string; art?: string; einheit?: string }[] }>('routinen'));
  const pruefungen: Record<(typeof PERSOENLICHE_PRUEFUNGEN)[number], () => Promise<Befund | null>> = {
    'zwei-faktor': async () => ((await (await import('@/lib/zugang/konten')).kontoFuerSpeicher(person))?.zweiterFaktor ? ja('bei dir an') : nein('bei dir noch aus')),
    // Nur „erklärt ja/nein“ zu (a) — der STAND (ein Widerruf zählt), nie was erklärt wurde, nie ein Gesundheitswert.
    'gesundheit-einwilligung': async () => ((await (await import('@/lib/datenschutz/gesundheit-einwilligung')).gesundheitStandFuer(person)).verarbeiten.an ? ja('von dir erklärt') : nein('von dir nicht erklärt (oder widerrufen)')),
    icloud: async () => {
      const s = await (await import('@/lib/kalender/icloud-person')).icloudStatus(person);
      if (!s.verbunden) return nein(s.quelle === 'getrennt' ? 'bei dir getrennt' : 'bei dir noch nicht verbunden');
      if (s.anmeldung) return nein('Apple nimmt das App-Passwort nicht an — Verbindung erneuern');
      if (s.quelle === 'umgebung') return nein('über die Server-Umgebung verbunden — hier in der Oberfläche eintragen, dann die ICLOUD-Zeilen aus der .env nehmen');
      return ja('dein Kalender ist verbunden');
    },
    google: async () => {
      const s = await google();
      if (!s.konfiguriert) return nein('Google ist auf dieser Instanz noch nicht eingerichtet');
      if (s.getrennt) return nein('Verbindung getrennt — neu verbinden');
      if (!s.verbunden) return nein('bei dir noch nicht verbunden');
      return s.bereit.includes('kalender') ? ja('dein Google-Kalender ist verbunden') : nein('Kalender-Freigabe fehlt — neu verbinden');
    },
    gmail: async () => {
      const s = await google();
      if (!s.konfiguriert) return nein('Google ist auf dieser Instanz noch nicht eingerichtet');
      if (s.getrennt) return nein('Verbindung getrennt — neu verbinden');
      if (!s.verbunden || !s.funktionen.includes('gmail')) return nein('bei dir noch nicht verbunden');
      if (!s.bereit.includes('gmail')) return nein('Gmail-Freigabe fehlt — neu verbinden');
      return (await (await import('@/lib/gmail/stand')).ladeGmailStand(person))?.fehlerAnmeldung ? nein('Google nimmt die Anmeldung nicht an — Verbindung erneuern') : ja('dein Gmail ist verbunden');
    },
    postfach: async () => {
      const { ladeImapStand } = await import('@/lib/postfach/spiegel');
      const [register, gs, imap] = await Promise.all([ladePostfaecher(person), google().catch(() => null), ladeImapStand(person).catch(() => null)]);
      const eigene = register.filter(p => p.quelle === 'imap');
      const gmailDa = !!gs?.verbunden && gs.funktionen.includes('gmail');
      const zahl = eigene.length + (gmailDa ? 1 : 0);
      if (!zahl) return nein('bei dir noch keins');
      const ohneBereich = eigene.filter(p => !p.bereich).length + (gmailDa && !register.some(p => p.quelle === 'gmail' && p.bereich) ? 1 : 0);
      const anmeldung = eigene.filter(p => imap?.postfaecher?.[p.id]?.fehlerAnmeldung).length;
      if (anmeldung) return nein(`${anmeldung} von ${n(zahl, 'Postfach', 'Postfächern')}: Anmeldung abgelehnt — Verbindung erneuern`);
      if (ohneBereich) return nein(`${ohneBereich} von ${n(zahl, 'Postfach', 'Postfächern')} ohne Bereich`);
      return ja(`${n(zahl, 'Postfach', 'Postfächer')} bei dir, jedes mit Bereich`);
    },
    whoop: async () => {
      // Roh gelesen (Lesen schreibt nie): `whoopStatus` würde beim Inhaber einen alten gemeinsamen Zugang übernehmen.
      const { whoopFehlt, verbindungName } = await import('@/lib/whoop/konfig');
      const { scopesFehlen } = await import('@/lib/whoop/verbindung');
      if (whoopFehlt().length) return nein('WHOOP ist auf dieser Instanz noch nicht eingerichtet (optional)');
      const v = await loadJson<{ v?: number; status?: string; scopes?: string[]; refreshToken?: string }>(verbindungName(person));
      if (!v || v.v !== 1 || typeof v.refreshToken !== 'string') return nein('bei dir nicht verbunden (optional)');
      if (v.status !== 'verbunden') return nein('Verbindung getrennt — neu verbinden');
      return (v.scopes?.length ? scopesFehlen(v.scopes) : []).length ? nein('neu verbinden — es fehlen Rechte') : ja('dein WHOOP ist verbunden');
    },
    'aufgaben-ich': async () => {
      const t = await ladeAufgabenSicht(person);
      const meine = (t?.tasks ?? []).filter(x => x.status !== 'done' && x.status !== 'cancelled' && x.assignee === person);
      const ueber = meine.filter(x => x.dueDate && x.dueDate < heute).length;
      if (!meine.length) return ja('nichts offen auf dich');
      return ueber ? nein(`${ueber} von ${meine.length} auf dich überfällig`) : ja(`${meine.length} offen auf dich, nichts überfällig`);
    },
    zoe: async () => {
      // Seit Paket 4a (09.10.) sind ZOE-Gespräche Threads der Person; der alte Bestand zählt, solange er noch nicht übernommen ist.
      const { fadenBestand } = await import('@/lib/agenten/typen');
      const b = await loadJson<{ faeden?: { agent?: { art?: string } }[]; zoeUebernahme?: unknown }>(fadenBestand(person));
      const v = b?.zoeUebernahme ? null : await loadJson<{ gespraeche?: { person?: string }[] }>('zoe-verlauf');
      const z = (b?.faeden ?? []).filter(f => f?.agent?.art === 'zoe').length + (v?.gespraeche ?? []).filter(g => g?.person === person).length;
      return z ? ja(`${n(z, 'Gespräch', 'Gespräche')} von dir`) : nein('noch kein Gespräch von dir');
    },
    // 3.10 (B11: nur mit Zugang zu den Privat-Finanzen): im Konten-Register die eigenen (privat, der Person oder ohne Person) und die
    // gemeinsamen Konten — jedes mit einem Stand, der höchstens 31 Tage alt ist. Nur Zähler, nie Beträge oder Namen.
    'konten-register': async () => {
      if (!u.privat) return null;
      const [{ ladeRegister }, { geltenderStand }] = await Promise.all([import('@/lib/finanzen/konten/server'), import('@/lib/finanzen/konten/register')]);
      const r = await ladeRegister(u.privat);
      const meine = r.konten.filter(k => !k.archiviertAm && (k.ort === 'gemeinsam' || (k.ort === 'privat' && (!k.person || k.person === person))));
      if (!meine.length) return nein('noch kein Konto von dir oder gemeinsam im Konten-Register');
      const frisch = meine.filter(k => { const s = geltenderStand(k); return !!s && tageZwischen(s.datum, heute) <= PRIVATKONTO_FRISCH_TAGE; }).length;
      const satz = `${frisch} von ${n(meine.length, 'Konto', 'Konten')} mit Stand ≤ ${PRIVATKONTO_FRISCH_TAGE} Tage`;
      return frisch === meine.length ? ja(satz) : veraltet(satz);
    },
    // 5.7: Grundwert der Person in der Kapazität oder Arbeits-Blöcke in ihrer Wochenvorlage — sonst gilt die Annahme.
    arbeitsrahmen: async () => {
      const [{ ladeKapaDatei, kapaIdVon }, { zaehltAlsArbeit }, rt] = await Promise.all([import('@/lib/kapazitaet/server'), import('@/lib/planung/bereich'), routinen()]);
      const grund = ((await ladeKapaDatei()).personen[kapaIdVon(person)]?.stundenWoche ?? 0) > 0;
      if (grund) return ja('Grundwert in der Kapazität gesetzt');
      const bloecke = (rt?.bloecke ?? []).filter(b => b?.owner === person && zaehltAlsArbeit({ space: b.art as SpaceId | undefined, einheit: b.einheit })).length;
      return bloecke ? ja(`${n(bloecke, 'Arbeits-Block', 'Arbeits-Blöcke')} in deiner Wochenvorlage`) : nein('noch kein Grundwert und keine Arbeits-Blöcke — es gilt die Annahme (40 h, Mo–Fr 9–18)');
    },
    // 5.9: mindestens eine aktive eigene Routine (fremde und gemeinsame zählen nicht).
    routinen: async () => {
      const eigene = ((await routinen())?.routinen ?? []).filter(r => r?.aktiv && r.owner === person).length;
      return eigene ? ja(`${n(eigene, 'aktive Routine', 'aktive Routinen')} von dir`) : nein('noch keine eigene aktive Routine');
    },
  };
  return ausfuehren(pruefungen);
}

/** Altbestand (Schritt 0.5) — NUR für die Sitzung des Haupt-Inhabers: drei Teile (Körper, Nordstern, Kernziel), nur ja/nein und Zähler. */
async function inhaberBefunde(person: string, haushalt: string | undefined): Promise<Record<string, Befund>> {
  return ausfuehren({
    altbestand: async () => {
      const { koerperLaden } = await import('@/lib/gesundheit/koerper-server');
      const { koerperHatInhalt } = await import('@/lib/gesundheit/koerper');
      const { nordsternName } = await import('@/lib/planung/nordstern-server');
      const k = (await koerperLaden(person)).koerper;
      const ns = haushalt ? await loadJson<{ altbestand?: { nordstern?: string; kernziel?: string } }>(nordsternName(haushalt)) : null;
      const teile = [!!k && (!!k.altbestand || koerperHatInhalt(k)), !!ns?.altbestand?.nordstern, !!ns?.altbestand?.kernziel];
      const da = teile.filter(Boolean).length;
      return da === 3 ? ja('3 von 3 Teilen übernommen bzw. entschieden') : nein(`${da} von 3 Teilen übernommen bzw. entschieden`);
    },
  });
}

type FirmaRoh = { id: string; name?: string; kontostand?: number | null; stand?: string | null };
type RechnungRoh = { id: string; firmaId?: string; status?: string; faellig?: string; datum?: string; bezahltAm?: string };
type ZahlungRoh = { id: string; firmaId?: string; status?: string; faellig?: string };
type SicherungsDatei = { zeit?: string; ok?: boolean; verfahren?: string; ping?: string } | null;
type FamilieRoh = { einstellungen?: { kalenderTermine?: Record<string, string> }; menschen?: { von: string; sichtbarkeit?: string; archiviertAm?: string; geburtstag?: string | null }[] };

async function gemeinsam(u: Umfang): Promise<Record<string, Befund>> {
  const heute = localDay();
  const laufend = Number(heute.slice(0, 4));
  const konten = einmal(async () => (await import('@/lib/zugang/konten')).ladeKonten());
  const plan = einmal(() => lesen<{ firmen?: FirmaRoh[]; rechnungen?: RechnungRoh[]; zahlungen?: ZahlungRoh[] }>('finanzplan'));
  const geltende = einmal(async () => (await import('@/lib/business/eroeffnung-server')).geltendeLaden());
  const abNull = einmal(async () => (await import('@/lib/business/eroeffnung-server')).mitEroeffnung({ firmen: [...((await plan())?.firmen ?? [])], rechnungen: (await plan())?.rechnungen ?? [], zahlungen: (await plan())?.zahlungen ?? [] }, await geltende()));
  const ziele = einmal(() => lesen<{ jahr?: { archiviertAm?: string; jahr?: unknown; termin?: unknown; zielwert?: number }[]; fokus?: Record<string, string> }>('ziele'));
  const crm = einmal(async () => (await import('@/lib/crm/speicher')).ladeCrm());
  const familie = einmal(async () => (u.familie ? lesen<FamilieRoh>((await import('@/lib/familie/speicher')).familieName(u.familie)) : null));
  const business = (firmaId?: string) => bereichVonFirma(firmaId) === 'business';
  const nB = BUSINESS_GESELLSCHAFTEN.length;
  /** Ein HOI-Befund als Onboarding-Befund: grün = ja, sonst der Zustand (fehlt → `fehlt`). Nur mit Person (der Systemlauf braucht ihn nicht). */
  const ausHoi = async (id: string, fehlt: string, gruen: (wert: string) => string): Promise<Befund | null> => {
    if (!u.person) return null;
    const b = await hoiBefund(id);
    if (!b || b.ampel === 'grau') return nein(fehlt);
    return b.ampel === 'gruen' ? ja(gruen(b.wert)) : (b.ampel === 'gelb' ? veraltet : nein)(b.wert);
  };

  const pruefungen: Record<(typeof GEMEINSAME_PRUEFUNGEN)[number], () => Promise<Befund | null>> = {
    // Nachtsicherung (Statusdatei von deploy/sicherung.sh): grün NUR, wenn der letzte Lauf gelungen, mit age verschlüsselt, den Wächter
    // (Healthchecks) erreicht hat und höchstens 36 h alt ist — sonst steht da, was fehlt.
    sicherung: async () => {
      const s: SicherungsDatei = await (await import('@/lib/datenschutz/umfeld')).sicherungsDatei();
      if (!s) return nein('noch keine Nachtsicherung gemeldet');
      const zeit = s.zeit ? Date.parse(s.zeit) : NaN;
      const alt = !(Number.isFinite(zeit) && Date.now() - zeit <= 36 * 3600_000);
      const fehlt = [
        s.ok !== true ? 'letzter Lauf nicht gelungen' : '',
        s.verfahren !== 'age' ? 'nicht mit age verschlüsselt' : '',
        s.ping !== 'ok' ? (s.ping === 'fehler' ? 'Wächter-Ping gescheitert' : 'Wächter-Ping nicht eingerichtet') : '',
        alt ? 'nicht frisch (älter als 36 Stunden)' : '',
      ].filter(Boolean);
      return fehlt.length ? (fehlt.length === 1 && alt ? veraltet : nein)(fehlt.join(' · ')) : ja(`letzte Nachtsicherung ${s.zeit!.slice(0, 10)}, mit age, Wächter meldet`);
    },
    // Server-Einstellungen: nur „gesetzt ja/nein“ — nie ein Wert.
    pepper: async () => {
      const [{ pepperGesetzt }, { riegelModus }] = await Promise.all([import('@/lib/datenschutz/pepper'), import('@/lib/zugang/start-riegel')]);
      const streng = riegelModus() === 'streng', p = pepperGesetzt();
      return p && streng ? ja('Pepper gesetzt, Start-Riegel streng')
        : nein(p ? 'Pepper gesetzt, Start-Riegel noch nicht streng' : streng ? 'Start-Riegel streng, Pepper fehlt' : 'Pepper fehlt, Start-Riegel nicht streng');
    },
    adresse: async () => {
      const adr = process.env.MAKE_OS_ADRESSE ?? '';
      return !adr ? nein('nicht gesetzt') : /^https:\/\/[^/\s]+$/.test(adr) ? ja('gesetzt, mit https') : nein(adr.startsWith('https://') ? 'gesetzt, aber mit Pfad oder Schrägstrich am Ende' : 'gesetzt, aber ohne https');
    },
    'whoop-konfig': async () => ((await import('@/lib/whoop/konfig')).whoopKonfiguriert() ? ja('eingerichtet') : nein('noch nicht eingerichtet')),
    'google-konfig': async () => ((await import('@/lib/google/verbindung')).googleKonfiguriert() ? ja('eingerichtet') : nein('noch nicht eingerichtet')),
    // Medienspeicher (Paket 5): nur „Object Storage eingerichtet ja/nein“ — nie Endpunkt, Bucket oder Schlüssel.
    medien: async () => {
      const { medienKonfig, s3Unvollstaendig } = await import('@/lib/medien/speicher');
      const k = medienKonfig();
      if (k.modus === 's3') return ja('Object Storage eingerichtet');
      if (k.modus === 'aus') return leer('Medien sind auf dieser Instanz aus');
      return nein(s3Unvollstaendig() ? 'Object Storage halb eingerichtet — es läuft der Ordner auf dem Server' : 'noch der Ordner auf dem Server (außerhalb der Nachtsicherung)');
    },
    // Datenschutz der Instanz (1.5): DIE Selbstprüfung (lib/crm/datenschutz.ts) — hier nur ihre Punkte „Verantwortlicher“ und „AVV“ (beide hängen
    // nur am Umfeld, nicht an der Kartei; darum ohne Kontakte gerechnet). Nur Zähler, keine Dienste-Namen.
    datenschutz: async () => {
      const [{ selbstpruefung }, { leererBestand }, { datenschutzUmfeld }, { avvOffen, drittlandOhneGarantie }] = await Promise.all([
        import('@/lib/crm/datenschutz'), import('@/lib/crm/speicher'), import('@/lib/datenschutz/umfeld'), import('@/lib/datenschutz/einrichtung'),
      ]);
      const umfeld = await datenschutzUmfeld();
      const punkte = selbstpruefung([], leererBestand(), heute, { konten: 0, mitPasswort: 0 }, 24, umfeld);
      const verantwortlich = punkte.find(x => x.id === 'verantwortlicher')?.status === 'erfuellt';
      const avv = punkte.find(x => x.id === 'avv')?.status === 'erfuellt';
      const inGebrauch = umfeld.empfaenger.filter(e => !e.archiviert && e.rolle === 'auftragsverarbeiter').length;
      const avvSatz = `${inGebrauch - avvOffen(umfeld.empfaenger).length} von ${inGebrauch} Auftragsverarbeitern mit bestätigtem Vertrag`;
      const ohneGarantie = drittlandOhneGarantie(umfeld.empfaenger).length;
      if (verantwortlich && avv) return ja(`Verantwortlicher benannt · ${avvSatz}`);
      return nein([verantwortlich ? '' : 'Verantwortlicher fehlt', avvSatz, ohneGarantie ? `${ohneGarantie} im Drittland ohne Garantie` : ''].filter(Boolean).join(' · '));
    },
    // Aus dem Lagebild des Head of IT (nur lesen): KI-Guthaben, Vault-Abgleich, Abholung am Mac, Gesamtampel.
    ki: async () => {
      if (!u.person) return null;
      const b = await hoiBefund('ki');
      if (!b || b.ampel === 'grau') return nein('kein KI-Schlüssel — ZOE und die Heads laufen nur mit dem Regelwerk');
      if (b.ampel !== 'gruen') return nein('KI-Guthaben leer — aufladen');
      // Roh gelesen: der Lader der KI-Einstellungen schreibt beim ersten Lesen die Vorgabe fest.
      const { KI_EINSTELLUNGEN } = await import('@/lib/datenschutz/ki-einstellungen');
      const d = await lesen<{ instanz?: Record<string, unknown> }>(KI_EINSTELLUNGEN);
      return d?.instanz && Object.keys(d.instanz).length ? ja('Schlüssel und Guthaben da, Schalter der Instanz gesetzt') : nein('Schlüssel und Guthaben da — die Schalter der Instanz noch nicht bewusst gesetzt');
    },
    vault: async () => ausHoi('vault', 'noch kein Vault-Abgleich gemeldet (Lage-Sammler am Server)', w => `Abgleich läuft (${w})`),
    abholung: async () => ausHoi('abholung', 'noch keine Meldung vom Server (Lage-Sammler)', w => `der Mac holt ab (${w})`),
    hoi: async () => {
      if (!u.person) return null;
      const l = await hoiLage();
      const grau = (id: string) => { const b = l.befunde.find(x => x.id === id); return !b || b.ampel === 'grau'; };
      const fehlt = [l.gesamt.rot ? `${n(l.gesamt.rot, 'roter Befund', 'rote Befunde')}` : '', grau('host') ? 'Lage-Sammler meldet nicht' : '', grau('aussen') ? 'Außenblick meldet nicht' : ''].filter(Boolean);
      return fehlt.length ? nein(fehlt.join(' · ')) : ja('kein roter Befund, Lage-Sammler und Außenblick melden');
    },
    'zwei-faktor-pflicht': async () => ((await konten()).einstellungen?.zweiFaktorPflichtSeit ? ja('Pflicht ist an') : nein('Pflicht ist noch aus')),
    personen: async () => {
      const alle = (await konten()).konten;
      return alle.length >= 2 ? ja(`${alle.length} Konten`) : nein(alle.length === 1 ? 'erst ein Konto (arbeitet ihr allein, entfällt der Schritt)' : 'noch kein Konto');
    },
    // Mehrere gleichwertige Inhaber (09.10., R9): nur der Zähler, nie Namen.
    inhaber: async () => {
      const z = wirksameInhaber(await konten()).length;
      return z >= 2 ? ja(`${z} Inhaber`) : nein(z === 1 ? 'ein Inhaber' : 'noch kein Inhaber');
    },
    haushalt: async () => {
      const st = await konten();
      const alle = st.konten;
      const inhaber = hauptInhaber(st);
      const imHaushalt = alle.filter(k => !!inhaber?.haushalt && k.haushalt === inhaber.haushalt).length;
      return !alle.length ? nein('noch kein Konto') : !inhaber?.haushalt ? nein('der Inhaber hat noch keinen Haushalt')
        : imHaushalt === alle.length ? ja(`${imHaushalt} von ${alle.length} Konten im Haushalt`) : nein(`${imHaushalt} von ${alle.length} Konten im Haushalt`);
    },
    // 0-Punkt, Konten, Posten — nur Business-Gesellschaften, alles ab dem 0-Punkt (mitEroeffnung).
    eroeffnung: async () => {
      const g = (await geltende()) as Record<string, unknown>;
      const da = BUSINESS_GESELLSCHAFTEN.filter(x => g[x]).length;
      return !nB ? ja('keine Business-Gesellschaft') : da === nB ? ja(`${da} von ${nB} Business-Gesellschaften eröffnet`) : nein(`${da} von ${nB} Business-Gesellschaften eröffnet`);
    },
    konten: async () => {
      const ab = await abNull();
      const frisch = BUSINESS_GESELLSCHAFTEN.map(g => (ab.firmen ?? []).find(f => f.id === g))
        .filter(f => f && typeof f.kontostand === 'number' && typeof f.stand === 'string' && tageZwischen(f.stand, heute) <= KONTOSTAND_FRISCH_TAGE).length;
      const satz = `${frisch} von ${nB} Geschäftskonten mit Stand ≤ ${KONTOSTAND_FRISCH_TAGE} Tage`;
      return !nB ? ja('keine Business-Gesellschaft') : frisch === nB ? ja(satz) : veraltet(satz);
    },
    // Offene Posten des 0-Punkts (`er-…`) stehen nicht in „Rechnungen & Zahlungen“ — sie werden eigens ausgewiesen (dort Fälligkeit bzw.
    // „bezahlt“ über eine neue Fassung). Je offenem Posten des 0-Punkts zählt auch eine fehlende Fälligkeit.
    posten: async () => {
      const { istEroeffnungsKennung } = await import('@/lib/business/eroeffnung');
      const ab = await abNull();
      const rechn = (ab.rechnungen ?? []).filter(r => business(r.firmaId) && r.status === 'gestellt');
      const zahl = (ab.zahlungen ?? []).filter(z => business(z.firmaId) && z.status === 'offen');
      const ueber = rechn.filter(r => !!r.faellig && r.faellig < heute);
      const ohneFrist = [...zahl.filter(z => !z.faellig), ...rechn.filter(r => istEroeffnungsKennung(r.id) && !r.faellig)];
      const ausNull = [...ueber, ...ohneFrist].filter(x => istEroeffnungsKennung(x.id)).length;
      if (!ueber.length && !ohneFrist.length) return ja(zahl.length + rechn.length ? `${zahl.length + rechn.length} offen, alle mit Frist, nichts überfällig` : 'nichts überfällig, nichts ohne Frist');
      const teile = [ueber.length ? `${n(ueber.length, 'Rechnung', 'Rechnungen')} überfällig` : '', ohneFrist.length ? `${n(ohneFrist.length, 'Posten', 'Posten')} ohne Fälligkeit` : ''].filter(Boolean).join(' · ');
      return nein(ausNull ? `${teile} — davon ${ausNull} aus dem 0-Punkt (dort Fälligkeit bzw. neue Fassung)` : teile);
    },
    // Kartei (Art. 18: eingeschränkte Personen zählen nicht) und offene Import-Konflikte — der Schritt verlangt zusätzlich ein Häkchen.
    kontakte: async () => {
      const [{ kontakteFuerVerarbeitung }, { KONFLIKT_SPEICHER }] = await Promise.all([import('@/lib/crm/verarbeitung'), import('@/lib/crm/import-konflikte')]);
      const [kartei, konf] = await Promise.all([kontakteFuerVerarbeitung(), lesen<{ konflikte?: unknown[] }>(KONFLIKT_SPEICHER)]);
      if (!kartei.length && await beschaedigt('kontakte')) return nein('nicht prüfbar');
      const nK = kartei.length, nKonf = Array.isArray(konf?.konflikte) ? konf!.konflikte!.length : 0;
      return !nK ? nein('keine Kontakte in der Kartei') : nKonf ? nein(`${n(nK, 'Kontakt', 'Kontakte')} · ${nKonf} Import-Konflikte offen`) : ja(`${n(nK, 'Kontakt', 'Kontakte')}, keine offenen Import-Konflikte`);
    },
    // Jahresziele aus der Planung (laufendes Jahr, nicht archiviert) — nie die Vorgabe des Controllings.
    ziele: async () => {
      const { zielJahr } = await import('@/lib/planung/zeitstrahl');
      const j = ((await ziele())?.jahr ?? []).filter(z => !z.archiviertAm && zielJahr(z, laufend) === laufend);
      const mitZahl = j.filter(z => typeof z.zielwert === 'number' && z.zielwert > 0).length;
      return j.length ? ja(`${j.length} Jahresziele für ${laufend}, ${mitZahl} mit Zahl`) : nein(`noch kein Jahresziel für ${laufend}`);
    },
    // Fokus je Horizont — gemeinsam oder je Bereich, das Jahr auch je Jahr (lib/planung/jahr-fokus.ts).
    fokus: async () => {
      const { fokusFuerLaufendesJahr } = await import('@/lib/planung/jahr-fokus');
      const alle = fokusFuerLaufendesJahr((await ziele())?.fokus ?? {}, laufend);
      const gesetzt = (['jahr', 'quartal', 'monat', 'woche'] as const).filter(h => ['', 'privat:', 'business:'].some(p => (alle[`${p}${h}`] ?? '').trim())).length;
      return gesetzt >= 3 ? ja(`${gesetzt} von 4 Horizonten gesetzt`) : nein(`nur ${gesetzt} von 4 Horizonten gesetzt`);
    },
    kompass: async () => {
      const k = await lesen<{ modus?: string; eigene?: Record<string, unknown> }>('kompass');
      const eigen = Object.keys(k?.eigene ?? {}).length;
      return k?.modus && eigen >= 3 ? ja(`Lage gewählt, ${eigen} Regler eigen gestellt`) : nein(k?.modus ? `Lage gewählt, aber nur ${eigen} Regler gestellt` : 'noch nicht gestellt');
    },
    // Monatsabschluss (3.7) — erst ab dem 0-Punkt: fällig ist der Vormonat je Business-Gesellschaft, sobald er im Stichtag-Monat oder danach
    // liegt. Ist noch keiner fällig (oder kein 0-Punkt da), gibt es nichts zu prüfen — dann zählt das Häkchen (Termin festgelegt).
    monatsabschluss: async () => {
      if (!nB) return leer('keine Business-Gesellschaft');
      const g = await geltende();
      const vm = vormonat(heute);
      const eroeffnet = BUSINESS_GESELLSCHAFTEN.filter(x => g[x]);
      if (!eroeffnet.length) return leer('noch kein 0-Punkt — ab ihm zählt der Abschluss des Vormonats');
      const faellig = eroeffnet.filter(x => vm >= g[x]!.stichtag.slice(0, 7));
      if (!faellig.length) {
        const erster = eroeffnet.map(x => g[x]!.stichtag.slice(0, 7)).sort()[0];
        return leer(`noch keiner fällig — der erste (${monatName(erster)}) nach Monatsende`);
      }
      const ab = await (await import('@/lib/business/speicher')).ladeAbschluesse('business');
      const da = faellig.filter(x => ab.some(a => a.firma === x && a.monat === vm)).length;
      const satz = `${da} von ${n(faellig.length, 'Abschluss', 'Abschlüssen')} für ${monatName(vm)} da`;
      return da === faellig.length ? ja(satz) : nein(satz);
    },
    // Laufende Mandate (4.4): Firma aus der Kartei, Honorar, Gesellschaft (nicht „offen“). Ohne laufendes Mandat nichts zu prüfen.
    mandate: async () => {
      const aktiv = (await crm()).mandate.filter(m => m.status === 'aktiv');
      if (!aktiv.length) return leer('kein laufendes Mandat — abhaken, wenn das stimmt');
      const voll = aktiv.filter(m => !!m.firmaId && (m.honorar?.betrag ?? 0) > 0 && !!m.gesellschaft && m.gesellschaft !== 'offen').length;
      const satz = `${voll} von ${n(aktiv.length, 'laufendem Mandat', 'laufenden Mandaten')} mit Firma, Honorar und Gesellschaft`;
      return voll === aktiv.length ? ja(satz) : nein(satz);
    },
    // Produkte (4.3): mindestens ein aktives Produkt mit Leistungstext (ohne ihn kein Angebot — `produktAngebotFehlt`).
    produkte: async () => {
      const { produktAngebotFehlt } = await import('@/lib/crm/angebote');
      const aktiv = (await crm()).leistungen.filter(l => l.status === 'aktiv');
      const gut = aktiv.filter(l => !produktAngebotFehlt(l).length).length;
      return gut ? ja(`${n(gut, 'aktives Produkt', 'aktive Produkte')} mit Leistungstext`) : nein(aktiv.length ? `${aktiv.length} aktiv, aber ohne Leistungstext` : 'noch kein aktives Produkt');
    },
    // Kapazität (5.8): jedes laufende Mandat mit einer (nicht abgelaufenen) Zuweisung. Ohne laufendes Mandat nichts zu prüfen.
    kapazitaet: async () => {
      const aktiv = (await crm()).mandate.filter(m => m.status === 'aktiv');
      if (!aktiv.length) return leer('kein laufendes Mandat — abhaken, wenn das stimmt');
      const kapa = await (await import('@/lib/kapazitaet/server')).ladeKapaDatei();
      const mit = aktiv.filter(m => kapa.zuweisungen.some(z => z.art === 'mandat' && z.bezugId === m.id && (!z.bis || z.bis >= heute))).length;
      const satz = `${mit} von ${n(aktiv.length, 'laufendem Mandat', 'laufenden Mandaten')} mit Zuweisung`;
      return mit === aktiv.length ? ja(satz) : nein(satz);
    },
    // Grundlagen des Business-Index (3.9): Köpfe und Jahresziel je Business-Gesellschaft.
    'business-einstellungen': async () => {
      if (!nB) return leer('keine Business-Gesellschaft');
      const e = await (await import('@/lib/business/speicher')).ladeEinstellungen();
      const voll = BUSINESS_GESELLSCHAFTEN.filter(g => (e.fte[g] ?? 0) > 0 && (e.ziele?.[g] ?? 0) > 0).length;
      const satz = `${voll} von ${nB} Business-Gesellschaften mit Köpfen und Jahresziel`;
      return voll === nB ? ja(satz) : nein(satz);
    },
    // Agenten (7.1, neuer Agenten-Bereich): mindestens ein Head bewusst eingestellt (Server-Stempel) — sonst zählt ein eigener Thread mit einem
    // Head. Einstellungen der Privat-Heads und Threads nur der eigenen Person.
    agenten: async () => {
      if (!u.person) return null;
      const { einstellungBestand, fadenBestand } = await import('@/lib/agenten/typen');
      const e = u.haushalt ? await lesen<{ heads?: unknown; personen?: Record<string, { heads?: unknown }> }>(einstellungBestand(u.haushalt)) : null;
      const heads = gestempelt(e?.heads) + gestempelt(e?.personen?.[u.person]?.heads);
      if (heads) return ja(`${n(heads, 'Head', 'Heads')} eingestellt`);
      const f = await lesen<{ faeden?: { agent?: { art?: string } }[] }>(fadenBestand(u.person));
      const mitHead = (f?.faeden ?? []).filter(x => x?.agent?.art === 'head' || x?.agent?.art === 'mitarbeiter').length;
      return mitHead ? ja(`noch kein Head eingestellt — du arbeitest in ${n(mitHead, 'Thread', 'Threads')} mit einem Head`) : nein('noch kein Head eingestellt, noch kein Thread mit einem Head');
    },
    // Brain (7.3): mindestens eine freigegebene Regel, die die Person sieht (Freigabe von einem bekannten Konto) und die App-Brücke bewusst gesetzt.
    brain: async () => {
      if (!u.person) return null;
      const [{ regelnLesen, regelFreigegeben }, { einstellungLesen }] = await Promise.all([import('@/lib/brain/regeln'), import('@/lib/brain/app-material')]);
      const bekannt = (await konten()).konten.map(k => k.speicher);
      const frei = (await regelnLesen({ person: u.person })).filter(r => regelFreigegeben(r, bekannt)).length;
      const bruecke = u.haushalt ? !!(await einstellungLesen(u.haushalt)).geaendertAm : false;
      const satz = `${n(frei, 'freigegebene Regel', 'freigegebene Regeln')} · App-Brücke ${bruecke ? 'gesetzt' : 'noch nicht gesetzt'}`;
      return frei && bruecke ? ja(satz) : nein(satz);
    },
    // ── B11: private Finanzen — nur mit Zugang zu den Privat-Finanzen ──
    // Finanzplan (5.4): Dokument da und die Netto-Tabelle kein Platzhalter (roh gelesen und geprüft — ohne Konten-Register, ohne Rechnung).
    finanzplan: async () => {
      if (!u.privat) return null;
      const [{ speicherName }, { pruefeDokument, nettoTabellePlatzhalter }] = await Promise.all([import('@/lib/finanzen/plan/speicher'), import('@/lib/finanzen/plan/operationen')]);
      const roh = await lesen<unknown>(speicherName(u.privat));
      if (!roh) return nein('noch kein Dokument — hochladen oder leer beginnen');
      const p = pruefeDokument(roh);
      if (!p.ok) return nein('nicht prüfbar');
      return nettoTabellePlatzhalter(p.dokument) ? nein('Dokument da — die Netto-Tabelle ist noch der Platzhalter') : ja('Dokument da, Netto-Tabelle eingetragen');
    },
    // Haushalt (3.11): Buchungen da, keine wiederkehrende Zahlung mit „Rhythmus unklar“, jede offene Schuld mit Rate, eine Rücklage (Register
    // oder eingetragen). Nur Zähler.
    'haushalt-fixkosten': async () => {
      if (!u.privat) return null;
      const [{ ladeHaushalt }, { wiederkehrend }, { ladePrivatDatei }, { ruecklageAusRegister }] = await Promise.all([
        import('@/lib/finanzen/haushalt/speicher'), import('@/lib/finanzen/haushalt/fixkosten'), import('@/lib/privat/speicher'), import('@/lib/finanzen/konten/server'),
      ]);
      const h = await ladeHaushalt(u.privat);
      if (!h.buchungen.length) return nein('noch keine Buchungen im Haushalt');
      const unklar = wiederkehrend(h.buchungen, () => '', heute).filter(w => w.unsicher).length;
      const ohneRate = h.schulden.filter(s => (s.restbetrag ?? 0) > 0 && !((s.rate ?? 0) > 0)).length;
      const ruecklage = !!(await ruecklageAusRegister(u.privat)) || !!(await ladePrivatDatei(u.privat)).ruecklage;
      const fehlt = [unklar ? `${unklar} mit „Rhythmus unklar“` : '', ohneRate ? `${n(ohneRate, 'Schuld', 'Schulden')} ohne Rate` : '', ruecklage ? '' : 'keine Rücklage gesetzt'].filter(Boolean);
      return fehlt.length ? nein(fehlt.join(' · ')) : ja('Rhythmus überall klar, Schulden mit Rate, Rücklage gesetzt');
    },
    // ── B11: Familie — nur mit Haushaltszugang ──
    // Rahmen (6.3): steht das nächste Paar-Gespräch im gemeinsamen Kalender (gespiegelt)? Roh gelesen — der Lader legt sonst den Startbestand an.
    'familie-rahmen': async () => {
      if (!u.familie) return null;
      const f = await familie();
      if (!f) return nein('Familie noch nicht eingerichtet');
      const kommend = Object.keys(f.einstellungen?.kalenderTermine ?? {}).filter(d => d >= heute).length;
      return kommend ? ja('das nächste Paar-Gespräch steht im gemeinsamen Kalender') : nein('Paar-Gespräch noch nicht im gemeinsamen Kalender');
    },
    // Menschen (6.4): mindestens ein Mensch mit Geburtstag — nur Einträge, die die Person sehen darf („nur ich“ der anderen zählt nie).
    'familie-menschen': async () => {
      if (!u.familie || !u.person) return null;
      const [f, { sichtFuer }] = await Promise.all([familie(), import('@/lib/familie/logik')]);
      const m = sichtFuer((f?.menschen ?? []).filter(x => !!x && !x.archiviertAm), u.person).filter(x => !!x.geburtstag).length;
      return m ? ja(`${n(m, 'Mensch', 'Menschen')} mit Geburtstag`) : nein('noch kein Mensch mit Geburtstag');
    },
  };
  return ausfuehren(pruefungen);
}

/** Rolle, Zahl der Konten, Privat-Finanzen und Altbestand — bestimmt, welche Schritte und Befunde eine Person bekommt. */
export async function kontextFuer(person: string | null): Promise<(Kontext & { haushalt?: string }) | null> {
  if (!person || !PERSON.test(person)) return null;
  const st = await (await import('@/lib/zugang/konten')).ladeKonten();
  const konten = st.konten;
  const k = konten.find(x => x.speicher === person);
  if (!k) return null;
  // Der Haupt-Inhaber (lib/zugang/inhaber.ts) — sein Haushalt ist der der Inhaber, an ihm hängt der Altbestand. Inhaber-Rechte hat JEDER
  // Inhaber (09.10., R9); „eingeladen“ = jedes Konto außer dem Haupt-Inhaber (das Erstkonto richtete die Instanz ein).
  const inhaber = hauptInhaber(st);
  return {
    inhaber: istWirksamerInhaber(st, person),
    haupt: inhaber?.speicher === person,
    eingeladen: !!inhaber && inhaber.speicher !== person,
    personen: konten.length,
    // Wie `privatFinanzZugang`: Haushaltsmitglied ohne „nur Business“ UND Haushalt des Inhabers.
    privatFinanzen: k.finanzRecht !== 'business' && !!k.haushalt && k.haushalt === inhaber?.haushalt,
    // Die einfachste korrekte Regel für Schritt 0.5: Altbestand gab es nur auf einer Instanz, deren Inhaber-Konto vor dem Tag angelegt
    // wurde, an dem die Inhalte den Code verließen — neue Kunden- und Demo-Instanzen haben keinen (dort fehlt der Schritt ganz).
    altbestand: process.env.MAKE_OS_DEMO !== '1' && !!inhaber && String(inhaber.angelegt ?? '').slice(0, 10) < ALTBESTAND_BIS,
    ...(k.haushalt ? { haushalt: k.haushalt } : {}),
  };
}

/**
 * Alle Befunde — die gemeinsamen für den Haushalt (Instanz-Befunde für Nicht-Inhaber nur ja/nein, private Finanzen und Familie nur mit Recht),
 * die persönlichen NUR für `person`, die Inhaber-Befunde NUR für die Inhaber-Sitzung. Ohne Person (Systemlauf) gibt es weder persönliche
 * noch Inhaber-Befunde. 60 s je Person.
 */
export async function pruefeAlles(person: string | null): Promise<Record<string, Befund>> {
  const p = person && PERSON.test(person) ? person : null;
  return merken(`onboarding-befunde:${p ?? 'system'}`, 60_000, async () => {
    const k = await kontextFuer(p).catch(() => null);
    const u = await umfangFuer(p, k);
    const [g, ich, inh] = await Promise.all([
      gemeinsam(u),
      p ? persoenlich(p, u) : Promise.resolve({}),
      p && k?.inhaber && k.haupt ? inhaberBefunde(p, k.haushalt) : Promise.resolve({}),
    ]);
    if (!k?.inhaber) for (const id of INSTANZ_PRUEFUNGEN) {
      const b = g[id];
      if (b) g[id] = { erfuellt: b.erfuellt, wert: b.erfuellt ? 'Instanz eingerichtet: ja' : 'Instanz eingerichtet: nein', ...(b.leer ? { leer: true as const } : {}) };
    }
    return { ...g, ...ich, ...inh };
  });
}

/** Wie weit die Einrichtung für diese Person ist (Freitag + Samstag-Kern; Späteres zählt erst, wenn getan). */
export async function fortschritt(person: string | null): Promise<{ fertig: number; gesamt: number; offeneMinuten: number }> {
  const [kontext, haken, befunde] = await Promise.all([kontextFuer(person), hakenLesen(person), pruefeAlles(person)]);
  const f = fortschrittVon(schritteFuer(kontext), { erledigt: haken.erledigt, befunde });
  return { fertig: f.fertig, gesamt: f.gesamt, offeneMinuten: f.offeneMinuten };
}

/**
 * B10 „dauerhafte Ampel“ (Morgenlauf, nie beim Lesen): je Konto im Haushalt der Inhaber die Schritte mit Prüfung, die gerade fertig sind
 * (`istFertig` — DIE Fertig-Regel), als „schon einmal grün“ im persönlichen Bestand festhalten. Fällt so ein Schritt später auf Rot, zeigt die
 * Karte auf Heute „braucht dich“ (lib/make-one/onboarding-data.ts `zurueckgefallen`). Nur Kennungen und Tage. Idempotent.
 */
export async function einrichtungFesthalten(heute = localDay()): Promise<{ personen: number; neu: number }> {
  const st = await (await import('@/lib/zugang/konten')).ladeKonten();
  const personen = kontenImHaushaltDerInhaber(st).map(k => k.speicher).filter(p => PERSON.test(p));
  let neu = 0;
  for (const p of personen) {
    const [k, haken, befunde] = await Promise.all([kontextFuer(p), hakenLesen(p), pruefeAlles(p)]);
    const z = { erledigt: haken.erledigt, befunde };
    neu += await gruenFesthalten(p, schritteFuer(k).filter(s => !!s.pruefung && istFertig(s, z)).map(s => s.id), heute);
  }
  return { personen: personen.length, neu };
}
