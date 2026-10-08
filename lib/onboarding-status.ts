// ─── MAKE OS — Onboarding: der echte Zustand ────────────────────────────────
// Die Selbstprüfung der Einrichtung. Liegt hier und nicht in der Route, weil auch die Startfläche und die Karte auf Heute den
// Fortschritt zeigen — eine Quelle, kein zweiter Satz Regeln, der auseinanderläuft.
//
// Regeln (ONBOARDING_PLAN.md A1, Paket B0/B3 Teil 1, 08.10. spät):
//   · Prüfungen liefern NUR ja/nein und Zähler — nie Werte, Beträge, Adressen, Namen oder Gesundheitsinhalte.
//   · Persönliche Prüfungen gelten IMMER nur der Person der Sitzung (nie einer anderen); ohne Person fehlen sie ganz.
//   · „Verbunden UND gesund“: ein Zustand „getrennt“ oder „Anmeldung abgelehnt“ zählt nicht — so bleibt die Einrichtung danach die
//     dauerhafte Ampel.
//   · Die Kartei nur über `kontakteFuerVerarbeitung` (Art. 18), Firmen-Posten nur über den 0-Punkt (`mitEroeffnung`), Ziele aus der
//     Planung — nie aus einer Vorgabe im Code.
//   · Teuer (1 vCPU): einmal je Person für 60 s merken (`merken`, Person im Schlüssel).

import { loadJson } from '@/lib/store/local-db';
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

/**
 * Persönliche Prüfungen — IMMER nur für `person` (die Person der Sitzung), nie für eine andere (08.10., Sicht-Regel).
 * Sie lesen nur „eingerichtet ja/nein“ bzw. eigene Zähler.
 */
export const PERSOENLICHE_PRUEFUNGEN = ['zwei-faktor', 'gesundheit-einwilligung', 'icloud', 'google', 'gmail', 'postfach', 'whoop', 'aufgaben-ich', 'zoe'] as const;
/** Prüfungen über die Instanz bzw. den gemeinsamen Haushalt (für alle im Haushalt gleich). */
export const GEMEINSAME_PRUEFUNGEN = [
  'sicherung', 'pepper', 'adresse', 'whoop-konfig', 'google-konfig', 'zwei-faktor-pflicht', 'personen', 'haushalt',
  'eroeffnung', 'konten', 'posten', 'kontakte', 'ziele', 'fokus', 'kompass', 'agenten',
] as const;
export const ALLE_PRUEFUNGEN: readonly string[] = [...PERSOENLICHE_PRUEFUNGEN, ...GEMEINSAME_PRUEFUNGEN];

/** Wer eine Prüfung wirft, bekommt „nicht prüfbar“ — nie bricht die ganze Seite. */
async function sicher(f: () => Promise<Befund>): Promise<Befund> {
  try { return await f(); } catch { return nein('nicht prüfbar'); }
}

async function persoenlich(person: string): Promise<Record<string, Befund>> {
  const [
    { kontoFuerSpeicher }, { gesundheitNachweis }, { icloudStatus },
    { googleStatus }, { ladeGmailStand }, { whoopStatus },
  ] = await Promise.all([
    import('@/lib/zugang/konten'), import('@/lib/datenschutz/gesundheit-einwilligung'), import('@/lib/kalender/icloud-person'),
    import('@/lib/google/verbindung'), import('@/lib/gmail/stand'), import('@/lib/whoop/verbindung'),
  ]);
  const heute = localDay();
  const google = googleStatus(person);
  const [zweiFaktor, einwilligung, icloud, gKalender, gmail, postfach, whoop, aufgabenIch, zoe] = await Promise.all([
    sicher(async () => ((await kontoFuerSpeicher(person))?.zweiterFaktor ? ja('bei dir an') : nein('bei dir noch aus'))),
    // Nur „erklärt ja/nein“ zu (a) — nie, was erklärt wurde, nie ein Gesundheitswert.
    sicher(async () => ((await gesundheitNachweis(person)).some(e => e.zweck === 'verarbeiten') ? ja('von dir erklärt') : nein('von dir noch nicht erklärt'))),
    sicher(async () => {
      const s = await icloudStatus(person);
      if (!s.verbunden) return nein(s.quelle === 'getrennt' ? 'bei dir getrennt' : 'bei dir noch nicht verbunden');
      return s.anmeldung ? nein('Apple nimmt das App-Passwort nicht an — Verbindung erneuern') : ja('dein Kalender ist verbunden');
    }),
    sicher(async () => {
      const s = await google;
      if (!s.konfiguriert) return nein('Google ist auf dieser Instanz noch nicht eingerichtet');
      if (s.getrennt) return nein('Verbindung getrennt — neu verbinden');
      if (!s.verbunden) return nein('bei dir noch nicht verbunden');
      return s.bereit.includes('kalender') ? ja('dein Google-Kalender ist verbunden') : nein('Kalender-Freigabe fehlt — neu verbinden');
    }),
    sicher(async () => {
      const s = await google;
      if (!s.konfiguriert) return nein('Google ist auf dieser Instanz noch nicht eingerichtet');
      if (s.getrennt) return nein('Verbindung getrennt — neu verbinden');
      if (!s.verbunden || !s.funktionen.includes('gmail')) return nein('bei dir noch nicht verbunden');
      if (!s.bereit.includes('gmail')) return nein('Gmail-Freigabe fehlt — neu verbinden');
      return (await ladeGmailStand(person))?.fehlerAnmeldung ? nein('Google nimmt die Anmeldung nicht an — Verbindung erneuern') : ja('dein Gmail ist verbunden');
    }),
    sicher(async () => {
      const { ladeImapStand } = await import('@/lib/postfach/spiegel');
      const [register, gs, imap] = await Promise.all([ladePostfaecher(person), google, ladeImapStand(person).catch(() => null)]);
      const eigene = register.filter(p => p.quelle === 'imap');
      const gmailDa = gs.verbunden && gs.funktionen.includes('gmail');
      const n = eigene.length + (gmailDa ? 1 : 0);
      if (!n) return nein('bei dir noch keins');
      const ohneBereich = eigene.filter(p => !p.bereich).length + (gmailDa && !register.some(p => p.quelle === 'gmail' && p.bereich) ? 1 : 0);
      const anmeldung = eigene.filter(p => imap?.postfaecher?.[p.id]?.fehlerAnmeldung).length;
      if (anmeldung) return nein(`${anmeldung} von ${n} ${n === 1 ? 'Postfach' : 'Postfächern'}: Anmeldung abgelehnt — Verbindung erneuern`);
      if (ohneBereich) return nein(`${ohneBereich} von ${n} ${n === 1 ? 'Postfach' : 'Postfächern'} ohne Bereich`);
      return ja(`${n} ${n === 1 ? 'Postfach' : 'Postfächer'} bei dir, jedes mit Bereich`);
    }),
    sicher(async () => {
      const s = await whoopStatus(person);
      if (!s.konfiguriert) return nein('WHOOP ist auf dieser Instanz noch nicht eingerichtet (optional)');
      if (s.getrennt) return nein('Verbindung getrennt — neu verbinden');
      if (!s.verbunden) return nein('bei dir nicht verbunden (optional)');
      return s.scopesFehlen.length ? nein('neu verbinden — es fehlen Rechte') : ja('dein WHOOP ist verbunden');
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
      const n = (v?.gespraeche ?? []).filter(g => g?.person === person).length;
      return n ? ja(`${n} ${n === 1 ? 'Gespräch' : 'Gespräche'} von dir`) : nein('noch kein Gespräch von dir');
    }),
  ]);
  return { 'zwei-faktor': zweiFaktor, 'gesundheit-einwilligung': einwilligung, icloud, google: gKalender, gmail, postfach, whoop, 'aufgaben-ich': aufgabenIch, zoe };
}

type FirmaRoh = { id: string; name?: string; kontostand?: number | null; stand?: string | null };
type RechnungRoh = { id: string; firmaId?: string; status?: string; faellig?: string; datum?: string; bezahltAm?: string };
type ZahlungRoh = { id: string; firmaId?: string; status?: string; faellig?: string };

async function gemeinsam(): Promise<Record<string, Befund>> {
  const heute = localDay();
  const laufend = Number(heute.slice(0, 4));
  const [
    { sicherungsStatus }, { ladeKonten }, { pepperGesetzt }, { riegelModus }, { whoopKonfiguriert }, { googleKonfiguriert },
    { geltendeLaden, mitEroeffnung }, { kontakteFuerVerarbeitung }, { KONFLIKT_SPEICHER }, { zielJahr }, { fokusFuerLaufendesJahr },
  ] = await Promise.all([
    import('@/lib/datenschutz/umfeld'), import('@/lib/zugang/konten'), import('@/lib/datenschutz/pepper'), import('@/lib/zugang/start-riegel'),
    import('@/lib/whoop/konfig'), import('@/lib/google/verbindung'), import('@/lib/business/eroeffnung-server'), import('@/lib/crm/verarbeitung'),
    import('@/lib/crm/import-konflikte'), import('@/lib/planung/zeitstrahl'), import('@/lib/planung/jahr-fokus'),
  ]);
  const [sich, konten, kompass, ziele, plan, agenten, geltende, kartei, konflikte] = await Promise.all([
    sicherungsStatus().catch(() => null),
    ladeKonten().catch(() => null),
    loadJson<{ modus?: string; eigene?: Record<string, unknown> }>('kompass'),
    loadJson<{ jahr?: { archiviertAm?: string; jahr?: unknown; termin?: unknown; zielwert?: number }[]; fokus?: Record<string, string> }>('ziele'),
    loadJson<{ firmen?: FirmaRoh[]; rechnungen?: RechnungRoh[]; zahlungen?: ZahlungRoh[] }>('finanzplan'),
    loadJson<Record<string, unknown>>('agents-config'),
    geltendeLaden().catch(() => ({})),
    kontakteFuerVerarbeitung().catch(() => null),
    loadJson<{ konflikte?: unknown[] }>(KONFLIKT_SPEICHER).catch(() => null),
  ]);

  // Nachtsicherung: Statusdatei von deploy/sicherung.sh (nur Verfahren + Zeit). Älter als 36 h = nicht frisch.
  const sicherungZeit = sich?.zeit ? Date.parse(sich.zeit) : NaN;
  const sicherung = !sich ? nein('noch keine Nachtsicherung gemeldet')
    : Number.isFinite(sicherungZeit) && Date.now() - sicherungZeit <= 36 * 3600_000
      ? ja(`letzte Nachtsicherung ${sich.zeit!.slice(0, 10)}${sich.verfahren ? `, verschlüsselt (${sich.verfahren})` : ''}`)
      : nein(sich.zeit ? `letzte Nachtsicherung ${sich.zeit.slice(0, 10)} — nicht frisch` : 'Zeit der letzten Sicherung unbekannt');

  // Server-Einstellungen: nur „gesetzt ja/nein“ — nie ein Wert.
  const streng = riegelModus() === 'streng';
  const pepper = pepperGesetzt() && streng ? ja('Pepper gesetzt, Start-Riegel streng')
    : nein(pepperGesetzt() ? 'Pepper gesetzt, Start-Riegel noch nicht streng' : streng ? 'Start-Riegel streng, Pepper fehlt' : 'Pepper fehlt, Start-Riegel nicht streng');
  const adr = process.env.MAKE_OS_ADRESSE ?? '';
  const adresse = !adr ? nein('nicht gesetzt') : /^https:\/\/[^/\s]+$/.test(adr) ? ja('gesetzt, mit https') : nein(adr.startsWith('https://') ? 'gesetzt, aber mit Pfad oder Schrägstrich am Ende' : 'gesetzt, aber ohne https');

  // Konten und Haushalt: nur Zähler.
  const alle = konten?.konten ?? [];
  const inhaber = alle.find(k => k.rolle === 'inhaber');
  const imHaushalt = alle.filter(k => !!inhaber?.haushalt && k.haushalt === inhaber.haushalt).length;
  const personen = alle.length >= 2 ? ja(`${alle.length} Konten`) : nein(alle.length === 1 ? 'erst ein Konto (arbeitet ihr allein, entfällt der Schritt)' : 'noch kein Konto');
  const haushalt = !alle.length ? nein('noch kein Konto') : !inhaber?.haushalt ? nein('der Inhaber hat noch keinen Haushalt')
    : imHaushalt === alle.length ? ja(`${imHaushalt} von ${alle.length} Konten im Haushalt`) : nein(`${imHaushalt} von ${alle.length} Konten im Haushalt`);

  // 0-Punkt, Konten, Posten — nur Business-Gesellschaften, alles ab dem 0-Punkt (mitEroeffnung).
  const nB = BUSINESS_GESELLSCHAFTEN.length;
  const eroeffnet = BUSINESS_GESELLSCHAFTEN.filter(g => (geltende as Record<string, unknown>)[g]).length;
  const eroeffnung = !nB ? ja('keine Business-Gesellschaft') : eroeffnet === nB ? ja(`${eroeffnet} von ${nB} Business-Gesellschaften eröffnet`) : nein(`${eroeffnet} von ${nB} Business-Gesellschaften eröffnet`);
  const ab = await mitEroeffnung({ firmen: [...(plan?.firmen ?? [])], rechnungen: plan?.rechnungen ?? [], zahlungen: plan?.zahlungen ?? [] }, geltende);
  const geschaeftskonten = BUSINESS_GESELLSCHAFTEN.map(g => (ab.firmen ?? []).find(f => f.id === g));
  const frisch = geschaeftskonten.filter(f => f && typeof f.kontostand === 'number' && typeof f.stand === 'string' && tageZwischen(f.stand, heute) <= KONTOSTAND_FRISCH_TAGE).length;
  const konten_ = !nB ? ja('keine Business-Gesellschaft') : frisch === nB
    ? ja(`${frisch} von ${nB} Geschäftskonten mit Stand ≤ ${KONTOSTAND_FRISCH_TAGE} Tage`)
    : nein(`${frisch} von ${nB} Geschäftskonten mit Stand ≤ ${KONTOSTAND_FRISCH_TAGE} Tage`);
  const business = (firmaId?: string) => bereichVonFirma(firmaId) === 'business';
  const ueberfaellig = (ab.rechnungen ?? []).filter(r => business(r.firmaId) && r.status === 'gestellt' && !!r.faellig && r.faellig < heute).length;
  const offeneZ = (ab.zahlungen ?? []).filter(z => business(z.firmaId) && z.status === 'offen');
  const ohneFrist = offeneZ.filter(z => !z.faellig).length;
  const posten = ueberfaellig || ohneFrist
    ? nein([ueberfaellig ? `${ueberfaellig} ${ueberfaellig === 1 ? 'Rechnung' : 'Rechnungen'} überfällig` : '', ohneFrist ? `${ohneFrist} ${ohneFrist === 1 ? 'Zahlung' : 'Zahlungen'} ohne Fälligkeit` : ''].filter(Boolean).join(' · '))
    : ja(offeneZ.length ? `${offeneZ.length} offen, alle mit Frist, nichts überfällig` : 'nichts überfällig, keine offene Zahlung ohne Frist');

  // Kartei (Art. 18: eingeschränkte Personen zählen nicht) und offene Import-Konflikte.
  const nK = kartei?.length ?? 0;
  const nKonf = Array.isArray(konflikte?.konflikte) ? konflikte!.konflikte!.length : 0;
  const kontakte = !kartei ? nein('nicht prüfbar') : !nK ? nein('keine Kontakte in der Kartei')
    : nKonf ? nein(`${nK} ${nK === 1 ? 'Kontakt' : 'Kontakte'} · ${nKonf} Import-Konflikte offen`) : ja(`${nK} ${nK === 1 ? 'Kontakt' : 'Kontakte'}, keine offenen Import-Konflikte`);

  // Jahresziele aus der Planung (laufendes Jahr, nicht archiviert) — nie die Vorgabe des Controllings.
  const jahresziele = (ziele?.jahr ?? []).filter(z => !z.archiviertAm && zielJahr(z, laufend) === laufend);
  const mitZahl = jahresziele.filter(z => typeof z.zielwert === 'number' && z.zielwert > 0).length;
  const ziele_ = jahresziele.length ? ja(`${jahresziele.length} Jahresziele für ${laufend}, ${mitZahl} mit Zahl`) : nein(`noch kein Jahresziel für ${laufend}`);

  // Fokus je Horizont — gemeinsam oder je Bereich, das Jahr auch je Jahr (lib/planung/jahr-fokus.ts).
  const fokusAlle = fokusFuerLaufendesJahr(ziele?.fokus ?? {}, laufend);
  const horizonte = ['jahr', 'quartal', 'monat', 'woche'] as const;
  const gesetzt = horizonte.filter(h => ['', 'privat:', 'business:'].some(p => (fokusAlle[`${p}${h}`] ?? '').trim())).length;
  const reglerEigen = Object.keys(kompass?.eigene ?? {}).length;

  return {
    sicherung, pepper, adresse,
    'whoop-konfig': whoopKonfiguriert() ? ja('eingerichtet') : nein('noch nicht eingerichtet'),
    'google-konfig': googleKonfiguriert() ? ja('eingerichtet') : nein('noch nicht eingerichtet'),
    'zwei-faktor-pflicht': konten?.einstellungen?.zweiFaktorPflichtSeit ? ja('Pflicht ist an') : nein('Pflicht ist noch aus'),
    personen, haushalt, eroeffnung, konten: konten_, posten, kontakte, ziele: ziele_,
    fokus: gesetzt >= 3 ? ja(`${gesetzt} von 4 Horizonten gesetzt`) : nein(`nur ${gesetzt} von 4 Horizonten gesetzt`),
    kompass: kompass?.modus && reglerEigen >= 3
      ? ja(`Lage gewählt, ${reglerEigen} Regler eigen gestellt`)
      : nein(kompass?.modus ? `Lage gewählt, aber nur ${reglerEigen} Regler gestellt` : 'noch nicht gestellt'),
    agenten: Object.keys(agenten ?? {}).length >= 6
      ? ja(`${Object.keys(agenten!).length} Agenten eingestellt`)
      : nein(`erst ${Object.keys(agenten ?? {}).length} eingestellt`),
  };
}

/**
 * Alle Befunde — die gemeinsamen für den Haushalt, die persönlichen NUR für `person` (Person der Sitzung).
 * Ohne Person (Systemlauf) gibt es keine persönlichen Befunde. Gemerkt 60 s je Person.
 */
export async function pruefeAlles(person: string | null): Promise<Record<string, Befund>> {
  const p = person && PERSON.test(person) ? person : null;
  return merken(`onboarding-befunde:${p ?? 'system'}`, 60_000, async () => {
    const [g, ich] = await Promise.all([gemeinsam(), p ? persoenlich(p) : Promise.resolve({})]);
    return { ...g, ...ich };
  });
}

/** Rolle und Zahl der Konten — bestimmt, welche Schritte eine Person betreffen. */
export async function kontextFuer(person: string | null): Promise<Kontext | null> {
  if (!person || !PERSON.test(person)) return null;
  const { ladeKonten } = await import('@/lib/zugang/konten');
  const { konten } = await ladeKonten();
  const k = konten.find(x => x.speicher === person);
  return k ? { inhaber: k.rolle === 'inhaber', personen: konten.length } : null;
}

/** Wie weit die Einrichtung für diese Person ist (ihre eigenen + gemeinsamen Schritte, beim Inhaber dazu die Instanz). */
export async function fortschritt(person: string | null): Promise<{ fertig: number; gesamt: number; offeneMinuten: number }> {
  const [kontext, erledigt, befunde] = await Promise.all([kontextFuer(person), hakenLesen(person), pruefeAlles(person)]);
  const f = fortschrittVon(schritteFuer(kontext), { erledigt, befunde });
  return { fertig: f.fertig, gesamt: f.gesamt, offeneMinuten: f.offeneMinuten };
}
