// ─── MAKE OS — Onboarding: der echte Zustand ────────────────────────────────
// Die Selbstprüfung der Einrichtung. Liegt hier und nicht in der Route, weil auch die Startfläche und die Karte auf Heute den
// Fortschritt zeigen — eine Quelle, kein zweiter Satz Regeln, der auseinanderläuft.
//
// Regeln (ONBOARDING_PLAN.md A1, Paket B0/B3 Teil 1, Nachbesserung 08.10. spät):
//   · Prüfungen liefern NUR ja/nein und Zähler — nie Werte, Beträge, Adressen, Namen oder Gesundheitsinhalte.
//   · Persönliche Prüfungen gelten IMMER nur der Person der Sitzung (nie einer anderen); ohne Person fehlen sie ganz.
//   · Inhaber-Prüfungen (Altbestand) bekommt NUR die Inhaber-Sitzung; Instanz-Befunde (Server-Einstellungen) sehen alle anderen nur als
//     „Instanz eingerichtet: ja/nein“.
//   · „Verbunden UND gesund“: ein Zustand „getrennt“ oder „Anmeldung abgelehnt“ zählt nicht — und nichts ist grün ohne getane Arbeit.
//   · Die Kartei nur über `kontakteFuerVerarbeitung` (Art. 18), Firmen-Posten nur über den 0-Punkt (`mitEroeffnung`), Ziele aus der
//     Planung — nie aus einer Vorgabe im Code.
//   · Jede Prüfung für sich (`sicher`): ein fehlerhafter Bestand macht EINEN Befund „nicht prüfbar“, nie die ganze Seite.
//   · Lesen schreibt nie (WHOOP wird roh gelesen — `whoopStatus` würde den alten Zugang übernehmen).
//   · Teuer (1 vCPU): einmal je Person für 60 s merken (`merken`, Person im Schlüssel).

import { loadJson, beschaedigt } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import { localDay } from '@/lib/zeit';
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { ladePostfaecher } from '@/lib/postfach/register';
import { BUSINESS_GESELLSCHAFTEN, bereichVonFirma } from '@/lib/einheiten';
import { fortschrittVon, schritteFuer, type Kontext } from '@/lib/make-one/onboarding-data';
import { hakenLesen } from '@/lib/onboarding-haken';

export interface Befund { erfuellt: boolean; wert: string }

const nein = (wert: string): Befund => ({ erfuellt: false, wert });
const ja = (wert: string): Befund => ({ erfuellt: true, wert });
const PERSON = /^[a-z0-9-]{1,40}$/;
const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(`${bis.slice(0, 10)}T12:00:00Z`) - Date.parse(`${von.slice(0, 10)}T12:00:00Z`)) / 864e5);
/** Höchstes Alter eines Kontostands (Tage), damit er als frisch gilt. */
export const KONTOSTAND_FRISCH_TAGE = 7;
/** Bis zu diesem Tag stand persönlicher Altbestand im Code (Übernahme lib/altbestand/*): ein Inhaber-Konto davor hat einen. */
export const ALTBESTAND_BIS = '2026-10-09';

/** Persönliche Prüfungen — IMMER nur für `person` (die Person der Sitzung), nie für eine andere. */
export const PERSOENLICHE_PRUEFUNGEN = ['zwei-faktor', 'gesundheit-einwilligung', 'icloud', 'google', 'gmail', 'postfach', 'whoop', 'aufgaben-ich', 'zoe'] as const;
/** Inhaber-Prüfungen — nur die Inhaber-Sitzung bekommt sie, nie eine andere Person. */
export const INHABER_PRUEFUNGEN = ['altbestand'] as const;
/** Instanz-Befunde (Server-Einstellungen): an andere als den Inhaber nur „Instanz eingerichtet: ja/nein“. */
export const INSTANZ_PRUEFUNGEN = ['sicherung', 'pepper', 'adresse', 'whoop-konfig', 'google-konfig'] as const;
/** Prüfungen über die Instanz bzw. den gemeinsamen Haushalt (für alle im Haushalt gleich). */
export const GEMEINSAME_PRUEFUNGEN = [
  ...INSTANZ_PRUEFUNGEN, 'zwei-faktor-pflicht', 'personen', 'haushalt', 'eroeffnung', 'konten', 'posten', 'kontakte', 'ziele', 'fokus', 'kompass',
] as const;
export const ALLE_PRUEFUNGEN: readonly string[] = [...PERSOENLICHE_PRUEFUNGEN, ...INHABER_PRUEFUNGEN, ...GEMEINSAME_PRUEFUNGEN];

/** Wer eine Prüfung wirft, bekommt „nicht prüfbar“ — nie bricht die ganze Seite. */
async function sicher(f: () => Promise<Befund>): Promise<Befund> {
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

async function persoenlich(person: string): Promise<Record<string, Befund>> {
  const heute = localDay();
  const google = einmal(async () => (await import('@/lib/google/verbindung')).googleStatus(person));
  const befunde = await Promise.all([
    sicher(async () => ((await (await import('@/lib/zugang/konten')).kontoFuerSpeicher(person))?.zweiterFaktor ? ja('bei dir an') : nein('bei dir noch aus'))),
    // Nur „erklärt ja/nein“ zu (a) — der STAND (ein Widerruf zählt), nie was erklärt wurde, nie ein Gesundheitswert.
    sicher(async () => ((await (await import('@/lib/datenschutz/gesundheit-einwilligung')).gesundheitStandFuer(person)).verarbeiten.an ? ja('von dir erklärt') : nein('von dir nicht erklärt (oder widerrufen)'))),
    sicher(async () => {
      const s = await (await import('@/lib/kalender/icloud-person')).icloudStatus(person);
      if (!s.verbunden) return nein(s.quelle === 'getrennt' ? 'bei dir getrennt' : 'bei dir noch nicht verbunden');
      if (s.anmeldung) return nein('Apple nimmt das App-Passwort nicht an — Verbindung erneuern');
      if (s.quelle === 'umgebung') return nein('über die Server-Umgebung verbunden — hier in der Oberfläche eintragen, dann die ICLOUD-Zeilen aus der .env nehmen');
      return ja('dein Kalender ist verbunden');
    }),
    sicher(async () => {
      const s = await google();
      if (!s.konfiguriert) return nein('Google ist auf dieser Instanz noch nicht eingerichtet');
      if (s.getrennt) return nein('Verbindung getrennt — neu verbinden');
      if (!s.verbunden) return nein('bei dir noch nicht verbunden');
      return s.bereit.includes('kalender') ? ja('dein Google-Kalender ist verbunden') : nein('Kalender-Freigabe fehlt — neu verbinden');
    }),
    sicher(async () => {
      const s = await google();
      if (!s.konfiguriert) return nein('Google ist auf dieser Instanz noch nicht eingerichtet');
      if (s.getrennt) return nein('Verbindung getrennt — neu verbinden');
      if (!s.verbunden || !s.funktionen.includes('gmail')) return nein('bei dir noch nicht verbunden');
      if (!s.bereit.includes('gmail')) return nein('Gmail-Freigabe fehlt — neu verbinden');
      return (await (await import('@/lib/gmail/stand')).ladeGmailStand(person))?.fehlerAnmeldung ? nein('Google nimmt die Anmeldung nicht an — Verbindung erneuern') : ja('dein Gmail ist verbunden');
    }),
    sicher(async () => {
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
    }),
    sicher(async () => {
      // Roh gelesen (Lesen schreibt nie): `whoopStatus` würde beim Inhaber einen alten gemeinsamen Zugang übernehmen.
      const { whoopFehlt, verbindungName } = await import('@/lib/whoop/konfig');
      const { scopesFehlen } = await import('@/lib/whoop/verbindung');
      if (whoopFehlt().length) return nein('WHOOP ist auf dieser Instanz noch nicht eingerichtet (optional)');
      const v = await loadJson<{ v?: number; status?: string; scopes?: string[]; refreshToken?: string }>(verbindungName(person));
      if (!v || v.v !== 1 || typeof v.refreshToken !== 'string') return nein('bei dir nicht verbunden (optional)');
      if (v.status !== 'verbunden') return nein('Verbindung getrennt — neu verbinden');
      return (v.scopes?.length ? scopesFehlen(v.scopes) : []).length ? nein('neu verbinden — es fehlen Rechte') : ja('dein WHOOP ist verbunden');
    }),
    sicher(async () => {
      const t = await ladeAufgabenSicht(person);
      const meine = (t?.tasks ?? []).filter(x => x.status !== 'done' && x.status !== 'cancelled' && x.assignee === person);
      const ueber = meine.filter(x => x.dueDate && x.dueDate < heute).length;
      if (!meine.length) return ja('nichts offen auf dich');
      return ueber ? nein(`${ueber} von ${meine.length} auf dich überfällig`) : ja(`${meine.length} offen auf dich, nichts überfällig`);
    }),
    sicher(async () => {
      const v = await loadJson<{ gespraeche?: { person?: string }[] }>('zoe-verlauf');
      const z = (v?.gespraeche ?? []).filter(g => g?.person === person).length;
      return z ? ja(`${n(z, 'Gespräch', 'Gespräche')} von dir`) : nein('noch kein Gespräch von dir');
    }),
  ]);
  return Object.fromEntries(PERSOENLICHE_PRUEFUNGEN.map((k, i) => [k, befunde[i]]));
}

/** Altbestand (Schritt 0.5) — NUR für die Inhaber-Sitzung: drei Teile (Körper, Nordstern, Kernziel), nur ja/nein und Zähler. */
async function inhaberBefunde(person: string, haushalt: string | undefined): Promise<Record<string, Befund>> {
  return {
    altbestand: await sicher(async () => {
      const { koerperLaden } = await import('@/lib/gesundheit/koerper-server');
      const { koerperHatInhalt } = await import('@/lib/gesundheit/koerper');
      const { nordsternName } = await import('@/lib/planung/nordstern-server');
      const k = (await koerperLaden(person)).koerper;
      const ns = haushalt ? await loadJson<{ altbestand?: { nordstern?: string; kernziel?: string } }>(nordsternName(haushalt)) : null;
      const teile = [!!k && (!!k.altbestand || koerperHatInhalt(k)), !!ns?.altbestand?.nordstern, !!ns?.altbestand?.kernziel];
      const da = teile.filter(Boolean).length;
      return da === 3 ? ja('3 von 3 Teilen übernommen bzw. entschieden') : nein(`${da} von 3 Teilen übernommen bzw. entschieden`);
    }),
  };
}

type FirmaRoh = { id: string; name?: string; kontostand?: number | null; stand?: string | null };
type RechnungRoh = { id: string; firmaId?: string; status?: string; faellig?: string; datum?: string; bezahltAm?: string };
type ZahlungRoh = { id: string; firmaId?: string; status?: string; faellig?: string };
type SicherungsDatei = { zeit?: string; ok?: boolean; verfahren?: string; ping?: string } | null;

async function gemeinsam(): Promise<Record<string, Befund>> {
  const heute = localDay();
  const laufend = Number(heute.slice(0, 4));
  const konten = einmal(async () => (await import('@/lib/zugang/konten')).ladeKonten());
  const plan = einmal(() => lesen<{ firmen?: FirmaRoh[]; rechnungen?: RechnungRoh[]; zahlungen?: ZahlungRoh[] }>('finanzplan'));
  const geltende = einmal(async () => (await import('@/lib/business/eroeffnung-server')).geltendeLaden());
  const abNull = einmal(async () => (await import('@/lib/business/eroeffnung-server')).mitEroeffnung({ firmen: [...((await plan())?.firmen ?? [])], rechnungen: (await plan())?.rechnungen ?? [], zahlungen: (await plan())?.zahlungen ?? [] }, await geltende()));
  const ziele = einmal(() => lesen<{ jahr?: { archiviertAm?: string; jahr?: unknown; termin?: unknown; zielwert?: number }[]; fokus?: Record<string, string> }>('ziele'));
  const business = (firmaId?: string) => bereichVonFirma(firmaId) === 'business';
  const nB = BUSINESS_GESELLSCHAFTEN.length;

  const pruefungen: Record<(typeof GEMEINSAME_PRUEFUNGEN)[number], () => Promise<Befund>> = {
    // Nachtsicherung (Statusdatei von deploy/sicherung.sh): grün NUR, wenn der letzte Lauf gelungen, mit age verschlüsselt, den Wächter
    // (Healthchecks) erreicht hat und höchstens 36 h alt ist — sonst steht da, was fehlt.
    sicherung: async () => {
      const s: SicherungsDatei = await (await import('@/lib/datenschutz/umfeld')).sicherungsDatei();
      if (!s) return nein('noch keine Nachtsicherung gemeldet');
      const zeit = s.zeit ? Date.parse(s.zeit) : NaN;
      const fehlt = [
        s.ok !== true ? 'letzter Lauf nicht gelungen' : '',
        s.verfahren !== 'age' ? 'nicht mit age verschlüsselt' : '',
        s.ping !== 'ok' ? (s.ping === 'fehler' ? 'Wächter-Ping gescheitert' : 'Wächter-Ping nicht eingerichtet') : '',
        !(Number.isFinite(zeit) && Date.now() - zeit <= 36 * 3600_000) ? 'nicht frisch (älter als 36 Stunden)' : '',
      ].filter(Boolean);
      return fehlt.length ? nein(fehlt.join(' · ')) : ja(`letzte Nachtsicherung ${s.zeit!.slice(0, 10)}, mit age, Wächter meldet`);
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
    'zwei-faktor-pflicht': async () => ((await konten()).einstellungen?.zweiFaktorPflichtSeit ? ja('Pflicht ist an') : nein('Pflicht ist noch aus')),
    personen: async () => {
      const alle = (await konten()).konten;
      return alle.length >= 2 ? ja(`${alle.length} Konten`) : nein(alle.length === 1 ? 'erst ein Konto (arbeitet ihr allein, entfällt der Schritt)' : 'noch kein Konto');
    },
    haushalt: async () => {
      const alle = (await konten()).konten;
      const inhaber = alle.find(k => k.rolle === 'inhaber');
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
      return !nB ? ja('keine Business-Gesellschaft') : frisch === nB ? ja(satz) : nein(satz);
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
  };
  const namen = Object.keys(pruefungen) as (keyof typeof pruefungen)[];
  const werte = await Promise.all(namen.map(k => sicher(pruefungen[k])));
  return Object.fromEntries(namen.map((k, i) => [k, werte[i]]));
}

/** Rolle, Zahl der Konten, Privat-Finanzen und Altbestand — bestimmt, welche Schritte und Befunde eine Person bekommt. */
export async function kontextFuer(person: string | null): Promise<(Kontext & { haushalt?: string }) | null> {
  if (!person || !PERSON.test(person)) return null;
  const { konten } = await (await import('@/lib/zugang/konten')).ladeKonten();
  const k = konten.find(x => x.speicher === person);
  if (!k) return null;
  const inhaber = konten.find(x => x.rolle === 'inhaber');
  return {
    inhaber: k.rolle === 'inhaber',
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
 * Alle Befunde — die gemeinsamen für den Haushalt (Instanz-Befunde für Nicht-Inhaber nur ja/nein), die persönlichen NUR für `person`,
 * die Inhaber-Befunde NUR für die Inhaber-Sitzung. Ohne Person (Systemlauf) gibt es weder persönliche noch Inhaber-Befunde. 60 s je Person.
 */
export async function pruefeAlles(person: string | null): Promise<Record<string, Befund>> {
  const p = person && PERSON.test(person) ? person : null;
  return merken(`onboarding-befunde:${p ?? 'system'}`, 60_000, async () => {
    const k = await kontextFuer(p).catch(() => null);
    const [g, ich, inh] = await Promise.all([
      gemeinsam(),
      p ? persoenlich(p) : Promise.resolve({}),
      p && k?.inhaber ? inhaberBefunde(p, k.haushalt) : Promise.resolve({}),
    ]);
    if (!k?.inhaber) for (const id of INSTANZ_PRUEFUNGEN) if (g[id]) g[id] = { erfuellt: g[id].erfuellt, wert: g[id].erfuellt ? 'Instanz eingerichtet: ja' : 'Instanz eingerichtet: nein' };
    return { ...g, ...ich, ...inh };
  });
}

/** Wie weit die Einrichtung für diese Person ist (Freitag + Samstag-Kern; Späteres zählt erst, wenn getan). */
export async function fortschritt(person: string | null): Promise<{ fertig: number; gesamt: number; offeneMinuten: number }> {
  const [kontext, haken, befunde] = await Promise.all([kontextFuer(person), hakenLesen(person), pruefeAlles(person)]);
  const f = fortschrittVon(schritteFuer(kontext), { erledigt: haken.erledigt, befunde });
  return { fertig: f.fertig, gesamt: f.gesamt, offeneMinuten: f.offeneMinuten };
}
