// ─── Eine Person über ALLE Speicher: aufzählen, entfernen, umbiegen (28.09., F2) ─
// Prüfbericht 28.09.: Art. 17 (Löschen) und Art. 15 (Auskunft) kannten nur die
// Kartei (`kontakte`) und den CRM-Bestand (`crm`). Eine Person steht aber auch in
// der Dateiablage, in den Import-Konflikten, in den Freigabe-Listen und Replay-
// Fällen der Heads, bei den kommenden Terminen (`crm-signale`) und in Aufgaben.
// Ab jetzt kennt GENAU DIESE Datei alle Speicher mit Personenbezug — jeder neue
// Speicher, der eine Kontakt-Kennung hält, gehört hier hinein (CLAUDE.md).
//
//   Speicher                       entfernen (Art. 17)                        umbiegen (Dubletten)
//   kontakte                       Eintrag raus                               (macht die Dubletten-Route)
//   crm                            lib/crm/person-verweise.ts + voller Name   dito
//                                  in Deal-Titeln/Kundennamen → „[gelöscht]“
//                                  (`crmNamenTilgen`, 28.09.)
//   crm-dateien--<haushalt>        nur Personen-Bezug: Eintrag + Datei weg;   kontaktId → neu
//     + dateien/<haushalt>/*.bin   mit Firma/Mandat/Deal/Rechnung: nur der
//                                  Personen-Bezug fällt (Geschäftsunterlage,
//                                  Aufbewahrung § 257 HGB / § 147 AO)
//   crm-import-konflikte           Konflikte + mögliche Dubletten der Person  kontaktId/mitId → neu (ohne Doppelte)
//   head-<head>                    Vorschläge mit kontakt_id raus, Person aus kontakt_id/kontakt_ids → neu
//                                  Kampagnen-Listen; Berichte, die sie danach
//                                  noch nennen (Kennung oder voller Name), raus
//   heads-replay-<head>            Fälle, die die Person enthalten, raus      Kennung im Fall → neu
//   crm-signale                    kommender Termin der Person raus           Schlüssel → neu (früherer Termin gewinnt)
//                                  (Altbestand: seit F3, 29.09., schreibt der Signal-Lauf `kommend` nicht mehr — der
//                                  nächste Termin kommt aus dem Kalender; bis zum nächsten Lauf kann er noch dastehen)
//   tasks                          nur EINDEUTIG zugeordnete Aufgaben         Link k=<alt> → k=<neu> (Beschreibung +
//                                  (Head-Aufgabe hd-<Vorschlag der Person>,   Kommentare), bezug.kontaktId → neu
//                                  Link k=<id> oder bezug.kontaktId, 28.09.
//                                  abends): voller Name → „[gelöscht]“ (auch
//                                  in Kommentaren), Link raus, bezug.kontaktId
//                                  raus; Aufgabe bleibt (eure Arbeit).
//                                  Nur-Namens-Treffer werden gemeldet, nie geändert.
//   crm-import-laeufe--<haushalt>  Vorher-Stand/Kennung/Fingerabdruck der      bewusst NICHT (Vorher-Stände sind Geschichte;
//     (K2, „Import rückgängig“)    Person aus jedem Lauf raus                  „rückgängig“ meldet den Zusammengeführten als Konflikt)
//   crm-sperrliste--<haushalt>     Person KOMMT HINZU (Grund „loeschung“, nur  —
//     (K2; seit 29.09. HMAC v2)    Fingerabdrücke): ein erneuter Import legt sie
//                                  nicht wieder an (#60). Keine Klartexte.
//   <grabsteine>/grabsteine.json   Grabstein KOMMT HINZU (HMAC der Kennung +    —
//     (29.09., D-B #70, AUSSERHALB Merkmale) — wendet die Löschung nach jedem
//      des Datenordners)           Restore erneut an (lib/datenschutz/grabsteine.ts)
//
// 29.09. (Paket D-B #69/#74, Kevin „Top 1 %“): ALLE weiteren Speicher mit Personenbezug — Behandlung und Grund je
// Speicher stehen im Register `lib/crm/speicher-register.ts` (ein Wächtertest gleicht jeden Bestandsnamen im Code
// dagegen ab), umgesetzt in `lib/crm/person-weitere.ts`:
//   netzwerk · kunden · stammdaten (Altbestände)      Datensätze der Person raus, Rest getilgt
//   inbox-absender · inbox-triage · apple-mail-cache  Mails/Einträge der Person raus (Zwischenspeicher; das Postfach
//     · m365-postfach · microsoft-inbox                selbst liegt beim Anbieter — Art. 17 dort gesondert)
//   kemaris-calendar · meetings                        getilgt (Termin bleibt, Name/Adresse → „[gelöscht]“)
//   calendar-cache · kalender-icloud · Apple-Spiegel   NICHT geändert — gezählt, Meldung „in Apple löschen“ (29.09., K2)
//   zoe-verlauf · zoe-auftraege · zoe-empfang         getilgt
//   zoe-gedaechtnis · zoe-protokoll · zoe-stapel      Einträge, die die Person nennen, raus
//   zoe-entscheidungen--* · aenderungsprotokoll--*    getilgt: Fingerabdrücke (v2 + v1) → `c#geloescht`, Name → „[gelöscht]“
//   crm-import-laeufe--* (auch Zusammenführ-Läufe)    zusätzlich zu `laufOhne` getilgt (Namen in Schnappschüssen)
//   agent-log · client-fehler · meldungen--*          getilgt
//   archiv/*.json (Umzugs-Kopien)                     Kartei-Eintrag raus, Rest getilgt (Frist 30 Tage: archiv-umzug)
//   app_chunks (Such-Index, lib/brain/app-index.ts)   sofort nachgezogen (inkrementell; `secure_delete` überschreibt)
//   _App-Spiegel im Vault                             neu erzeugt, wenn eingeschaltet (MAKE_OS_APP_SPIEGEL=an)
//   crm-loeschprotokoll                               nur Protokoll-ID `lp-…`, Tag, Grund, Person — nie die Kennung
// Bewusst NICHT hier (Grund im Register): Sicherungen (14 Tage „beyond use“, Grabsteine wenden die Löschung nach einem
// Restore an), Vault + Git-Historie (Verfahren in DATENARCHITEKTUR.md), Finanz-/Buchungsbestände (§ 147 AO / § 257 HGB).
//
// U2 (28.09., Datenschutz vollständig): Einwilligungs-Nachweise, Einschränkung (Art. 18), „geprüft“, Hinweis bei
// Erhebung und Fristverlängerung liegen AM KONTAKT (kein neuer Speicher mit Personenbezug) — Art. 17 nimmt sie mit
// dem Eintrag, die Auskunft (app/api/crm/datenschutz) listet sie eigens (`nachweisAuskunft`), die Dubletten-
// Zusammenführung hat eigene Regeln (lib/crm/dubletten.ts). Eine eingeschränkte Person wird nicht gelöscht und
// nicht zusammengeführt (die Routen lehnen mit 409 ab). `crm-loeschfristen` hält nur Fristen und die Tagesmarke —
// keine Kennungen; die Löschfrist-Aufgabe (`loeschfrist-kontakte`) nennt weder Kennung noch Namen.
//
// Jede Funktion ist idempotent (zweimal laufen ändert nichts mehr) und nimmt je
// Speicher genau EINE Schreibsperre (updateJson). Reine Teile sind exportiert und getestet.
//
// 29.09. (Paket D-C #17/#21/#35): `personEntfernen` ist ein Vorgang mit Absichtsprotokoll (lib/store/absichten.ts) —
// 13 Schritte, jeder idempotent und abgehakt, Name/Adressen liegen bis zum Ende in der Absicht; ein scheiternder Bestand
// hält die anderen nicht auf (Löschprotokoll „unvollständig“), die Wiederaufnahme vollendet. `personenUmbiegen` biegt
// viele Paare in EINER Sperre je Speicher um (Kennungs-Umzug; mit `umzug: true` auch Läufe, übrige Bestände, Fingerabdrücke).
//   absichten--<haushalt>         andere Absichten getilgt, die eigene Art.-17-Absicht bleibt bis zum Abschluss (person-weitere)
//   kennung-alias--<haushalt>     Zeilen der Person raus; ihre alten Kennungen bekommen vorher eigene Grabsteine

import { promises as fs } from 'fs';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from './typen';
import { aendereCrm, ladeCrm } from './speicher';
import { personEntfernen as crmOhne, personUmbiegen as crmUm, personVerweise } from './person-verweise';
import { KONFLIKT_SPEICHER, leererKonfliktStand, type KonfliktStand } from './import-konflikte';
import { ablageName, dateiPfad } from '@/lib/dateien/ablage';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { HEADS, type HeadId } from '@/lib/heads/prompt';
import { leererStand, standName, type HeadStand, type HeadBericht } from '@/lib/heads/stand';
import type { ReplayStand } from '@/lib/heads/lauf';
import { laufHaushalte, laufName, laufOhne, type LaufBestand } from './import-lauf';
import type { Schnappschuss } from './import-lauf';
import { crmSchnappschuesse, schnappschuesse, schnappschussKonflikte, schnappschuesseAnwenden, nachSpeicher } from './zusammenfuehren-lauf';
import { CRM_LISTEN } from './typen';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { sperren } from './sperrliste';
import { merkmaleVon, weitereEntfernen, weitereAufzaehlen } from './person-weitere';
import { neueProtokollId } from './loeschprotokoll';
import { kennungenErsetzen, fingerabdrueckeErsetzen, umkehren, vorkommendePaare } from './kennungen-ersetzen';
import type { AufgabeBezug, AufgabeKommentar } from '@/types/tasks';

// ── Reine Helfer ─────────────────────────────────────────────────────────────

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Die Kennung als ganzes Wort (nicht als Teil einer längeren Kennung). */
const kennungMuster = (id: string, flags = '') => new RegExp(`(?<![A-Za-z0-9_-])${esc(id)}(?![A-Za-z0-9_-])`, flags);

/** Kommt die Kennung irgendwo (Schlüssel oder Text) in diesem Wert vor? */
export function enthaeltKennung(wert: unknown, id: string): boolean {
  if (!id) return false;
  return kennungMuster(id).test(JSON.stringify(wert ?? null));
}

/** Kennung überall (Schlüssel und Texte) von alt auf neu umschreiben. */
export function kennungErsetzen<T>(wert: T, alt: string, neu: string): T {
  if (!alt || alt === neu || !enthaeltKennung(wert, alt)) return wert;
  return JSON.parse(JSON.stringify(wert).replace(kennungMuster(alt, 'g'), neu)) as T;
}

/** Voller Name (Vor- und Nachname), wenn er eindeutig genug zum Suchen ist — sonst null. */
export function vollerName(k: Pick<Kontakt, 'vorname' | 'nachname'> | undefined): string | null {
  const v = (k?.vorname ?? '').trim(), n = (k?.nachname ?? '').trim();
  return v && n.length >= 3 ? `${v} ${n}` : null;
}
const nameMuster = (name: string, flags = 'i') => new RegExp(`(?<![\\p{L}\\p{N}])${esc(name).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, `u${flags}`);
const nenntNamen = (wert: unknown, name: string | null) => !!name && nameMuster(name).test(JSON.stringify(wert ?? null));

// ── CRM-Freitexte (28.09., Integritätsprüfung K2) ──
// `person-verweise.ts` nimmt die KENNUNG aus dem CRM-Bestand. Der Name stand aber weiter in Deal-Titeln
// („Beratung Anna Beispiel“) und im Kundennamen eines Mandats (Privatkunde) — Art. 17 verlangt, dass er geht.
// Ersetzt wird nur der volle Name (`vollerName`) als ganzes Wort, durch „[gelöscht]“. Trägt eine ANDERE Person
// der Kartei denselben vollen Namen, nur dort, wo die gelöschte Person verknüpft war (`crmVerknuepft`).

export interface CrmNamenBezug { chancen: Set<string>; mandate: Set<string> }
/** Welche Deals und Mandate die Person nennen (vor dem Entfernen der Kennung zu bestimmen). */
export const crmVerknuepft = (crm: Pick<CrmBestand, 'chancen' | 'mandate'>, id: string): CrmNamenBezug => ({
  chancen: new Set((crm.chancen ?? []).filter(c => (c.kontaktIds ?? []).includes(id)).map(c => c.id)),
  mandate: new Set((crm.mandate ?? []).filter(m => (m.kontaktIds ?? []).includes(id)).map(m => m.id)),
});

/** Nennt ein Deal-Titel oder Kundenname den vollen Namen? */
export function crmNenntNamen(crm: Pick<CrmBestand, 'chancen' | 'mandate'>, name: string | null, nur?: CrmNamenBezug): boolean {
  if (!name) return false;
  const m = nameMuster(name);
  return (crm.chancen ?? []).some(c => (!nur || nur.chancen.has(c.id)) && m.test(c.titel ?? ''))
    || (crm.mandate ?? []).some(x => (!nur || nur.mandate.has(x.id)) && m.test(x.kunde ?? ''));
}

/** Voller Name → „[gelöscht]“ in `chancen[].titel` und `mandate[].kunde`. Idempotent; unverändert → derselbe Bestand. */
export function crmNamenTilgen<T extends Pick<CrmBestand, 'chancen' | 'mandate'>>(crm: T, name: string | null, nur?: CrmNamenBezug): T {
  if (!crmNenntNamen(crm, name, nur)) return crm;
  const weg = (t: string) => t.replace(nameMuster(name!, 'gi'), '[gelöscht]');
  return {
    ...crm,
    chancen: (crm.chancen ?? []).map(c => ((!nur || nur.chancen.has(c.id)) && nameMuster(name!).test(c.titel ?? '') ? { ...c, titel: weg(c.titel) } : c)),
    mandate: (crm.mandate ?? []).map(x => ((!nur || nur.mandate.has(x.id)) && nameMuster(name!).test(x.kunde ?? '') ? { ...x, kunde: weg(x.kunde) } : x)),
  };
}

// ── Dateiablage ──

/** Hat der Eintrag außer der Person noch einen geschäftlichen Bezug? */
const andererBezug = (e: DateiEintrag) => !!(e.firmaId || e.mandatId || e.dealId || e.rechnungId || e.angebotId); // Angebots-PDF (28.09.) = Geschäftsunterlage

/**
 * Art. 17 in der Ablage: Einträge NUR mit Personenbezug fallen weg (samt Datei); Einträge, die zugleich an
 * Firma/Mandat/Deal/Rechnung hängen, verlieren nur den Personenbezug (Geschäftsunterlage mit Aufbewahrungspflicht).
 */
export function ablageOhne(eintraege: DateiEintrag[], id: string): { eintraege: DateiEintrag[]; weg: DateiEintrag[]; geloest: number } {
  const weg: DateiEintrag[] = [];
  let geloest = 0;
  const bleiben: DateiEintrag[] = [];
  for (const e of eintraege) {
    if (e.kontaktId !== id) { bleiben.push(e); continue; }
    if (andererBezug(e)) { const { kontaktId: _k, ...rest } = e; bleiben.push(rest); geloest++; } else weg.push(e);
  }
  return { eintraege: bleiben, weg, geloest };
}
export function ablageUm(eintraege: DateiEintrag[], alt: string, neu: string): { eintraege: DateiEintrag[]; n: number } {
  let n = 0;
  return { eintraege: eintraege.map(e => (e.kontaktId === alt ? (n++, { ...e, kontaktId: neu }) : e)), n };
}
/** Für die Auskunft: nur Metadaten, nie Dateiinhalte. */
export const ablageAuskunft = (eintraege: DateiEintrag[], id: string) => eintraege.filter(e => e.kontaktId === id).map(e => ({
  id: e.id, art: e.art, ...(e.titel ? { titel: e.titel } : {}), ...(e.datei ? { datei: { name: e.datei.name, typ: e.datei.typ, groesse: e.datei.groesse } } : {}),
  ...(e.vertrag ? { vertrag: e.vertrag } : {}), ...(e.angebot ? { angebot: e.angebot } : {}), ...(e.notiz ? { notiz: e.notiz } : {}),
  hochgeladenAm: e.hochgeladenAm, ...(e.firmaId ? { firmaId: e.firmaId } : {}), ...(e.mandatId ? { mandatId: e.mandatId } : {}), ...(e.dealId ? { dealId: e.dealId } : {}), ...(e.rechnungId ? { rechnungId: e.rechnungId } : {}),
}));

// ── Import-Konflikte ──

export function konflikteOhne(st: KonfliktStand, id: string): { stand: KonfliktStand; n: number } {
  const konflikte = st.konflikte.filter(k => k.kontaktId !== id);
  const moeglicheDubletten = st.moeglicheDubletten.filter(d => d.kontaktId !== id && d.mitId !== id);
  const n = st.konflikte.length - konflikte.length + st.moeglicheDubletten.length - moeglicheDubletten.length;
  return { stand: n ? { ...st, konflikte, moeglicheDubletten } : st, n };
}
export function konflikteUm(st: KonfliktStand, alt: string, neu: string): { stand: KonfliktStand; n: number } {
  let n = 0;
  const gesehen = new Set(st.konflikte.filter(k => k.kontaktId === neu).map(k => k.feld));
  const konflikte = st.konflikte.flatMap(k => {
    if (k.kontaktId !== alt) return [k];
    n++;
    if (gesehen.has(k.feld)) return []; // Die behaltene Person hat für das Feld schon einen offenen Konflikt.
    gesehen.add(k.feld);
    return [{ ...k, kontaktId: neu }];
  });
  const paar = new Set<string>();
  const moeglicheDubletten = st.moeglicheDubletten.flatMap(d => {
    const um = d.kontaktId === alt || d.mitId === alt;
    const x = um ? { ...d, kontaktId: d.kontaktId === alt ? neu : d.kontaktId, ...(d.mitId ? { mitId: d.mitId === alt ? neu : d.mitId } : {}) } : d;
    if (um) n++;
    if (x.mitId && x.mitId === x.kontaktId) return []; // das eben zusammengeführte Paar
    const s = `${x.kontaktId}|${x.mitId ?? ''}|${x.grund}`;
    if (paar.has(s)) return [];
    paar.add(s);
    return [x];
  });
  return { stand: n ? { ...st, konflikte, moeglicheDubletten } : st, n };
}
/** Für die Auskunft: nur die Feldnamen und die beiden Werte der Person. */
export const konflikteAuskunft = (st: KonfliktStand, id: string) => ({
  konflikte: st.konflikte.filter(k => k.kontaktId === id).map(k => ({ feld: k.feld, online: k.online, liste: k.liste })),
  moeglicheDubletten: st.moeglicheDubletten.filter(d => d.kontaktId === id || d.mitId === id).length,
});

// ── Heads ──

type Kampagne = { kontakt_ids: string[] } | null | undefined;
const kampagneOhne = <V extends { kampagne?: Kampagne }>(v: V, id: string): V => (v.kampagne?.kontakt_ids.includes(id) ? { ...v, kampagne: { ...v.kampagne, kontakt_ids: v.kampagne.kontakt_ids.filter(x => x !== id) } } : v);

/** Freigabe-Liste und Berichte eines Heads ohne die Person. `aufgaben` = Kennungen der Aufgaben, die zu entfernten Vorschlägen gehören. */
export function headStandOhne(st: HeadStand, id: string, name: string | null): { stand: HeadStand; n: number; aufgaben: string[] } {
  const aufgaben: string[] = [];
  let n = 0;
  const vorschlaege = st.vorschlaege.filter(v => {
    if (v.kontakt_id !== id) return true;
    n++;
    aufgaben.push(v.auto?.rueckgaengig?.aufgabeId ?? `hd-${v.id}`);
    return false;
  }).map(v => { const x = kampagneOhne(v, id); if (x !== v) n++; return x; });
  const berichte = st.berichte.flatMap((b): HeadBericht[] => {
    const antwort = {
      ...b.antwort,
      vorschlaege: b.antwort.vorschlaege.filter(v => v.kontakt_id !== id).map(v => kampagneOhne(v, id)),
      befunde: b.antwort.befunde.filter(f => !enthaeltKennung(f, id) && !nenntNamen(f, name)),
    };
    const neu = { ...b, antwort };
    if (enthaeltKennung(neu, id) || nenntNamen(neu, name)) { n++; return []; } // nennt die Person noch im Freitext: ganzer Bericht raus
    if (antwort.vorschlaege.length !== b.antwort.vorschlaege.length || antwort.befunde.length !== b.antwort.befunde.length || JSON.stringify(antwort.vorschlaege) !== JSON.stringify(b.antwort.vorschlaege)) n++;
    return [neu];
  });
  return { stand: n ? { ...st, vorschlaege, berichte } : st, n, aufgaben };
}
export function headStandUm(st: HeadStand, alt: string, neu: string): { stand: HeadStand; n: number } {
  if (!enthaeltKennung({ v: st.vorschlaege, b: st.berichte }, alt)) return { stand: st, n: 0 };
  return { stand: { ...st, vorschlaege: kennungErsetzen(st.vorschlaege, alt, neu), berichte: kennungErsetzen(st.berichte, alt, neu) }, n: 1 };
}
export function replayOhne(st: ReplayStand, id: string, name: string | null): { stand: ReplayStand; n: number } {
  const faelle = st.faelle.filter(f => !enthaeltKennung(f, id) && !nenntNamen(f, name));
  return { stand: faelle.length === st.faelle.length ? st : { ...st, faelle }, n: st.faelle.length - faelle.length };
}
export function replayUm(st: ReplayStand, alt: string, neu: string): { stand: ReplayStand; n: number } {
  const n = st.faelle.filter(f => enthaeltKennung(f, alt)).length;
  return { stand: n ? { ...st, faelle: kennungErsetzen(st.faelle, alt, neu) } : st, n };
}

// ── Signale (kommende Termine je Person — Altbestand bis F3, 29.09.; der Lauf überschreibt ohne `kommend`) ──

export interface SignalStand { letzter?: string; kommend?: Record<string, { titel: string; start: string }>; neu?: number }
export function signaleOhne(st: SignalStand, id: string): { stand: SignalStand; n: number } {
  if (!st.kommend?.[id]) return { stand: st, n: 0 };
  const { [id]: _weg, ...rest } = st.kommend;
  return { stand: { ...st, kommend: rest }, n: 1 };
}
export function signaleUm(st: SignalStand, alt: string, neu: string): { stand: SignalStand; n: number } {
  const a = st.kommend?.[alt];
  if (!a) return { stand: st, n: 0 };
  const { [alt]: _weg, ...rest } = st.kommend!;
  const b = rest[neu];
  return { stand: { ...st, kommend: { ...rest, [neu]: b && b.start <= a.start ? b : a } }, n: 1 };
}

// ── Aufgaben ──

interface Aufgabe { id: string; title?: string; description?: string; status?: string; dueDate?: string; bezug?: AufgabeBezug; kommentare?: AufgabeKommentar[]; [k: string]: unknown }
const linkMuster = (id: string) => new RegExp(`[?&]k=${esc(id)}(?![A-Za-z0-9_-])`);
const linkWeg = (id: string) => new RegExp(`\\S*[?&]k=${esc(id)}(?![A-Za-z0-9_-])\\S*`, 'g');
/** Der CRM-Bezug einer Aufgabe ohne den Kontakt — leer → undefined (das Feld fällt dann weg). */
const bezugOhneKontakt = (b: AufgabeBezug): AufgabeBezug | undefined => { const { kontaktId: _k, ...rest } = b; return Object.keys(rest).length ? rest : undefined; };

/**
 * Welche Aufgaben gehören zur Person? EINDEUTIG ist eine Aufgabe, wenn sie mit ihr im CRM verknüpft ist
 * (`bezug.kontaktId`, 28.09. abends), aus einem Head-Vorschlag an genau diese Person stammt (`hd-<Vorschlag>`)
 * oder einen Link auf sie trägt (`k=<id>`). Ein Name im Titel, in der Beschreibung oder in einem Kommentar
 * allein ist KEIN Beweis (Namensgleichheit, „Müller“ kann die Firma sein) — solche Aufgaben werden nur gemeldet.
 */
export function aufgabenZuordnen(tasks: Aufgabe[], id: string, headAufgaben: string[], name: string | null): { eindeutig: Aufgabe[]; nurName: Aufgabe[] } {
  const hd = new Set(headAufgaben);
  const eindeutig: Aufgabe[] = [], nurName: Aufgabe[] = [];
  for (const t of tasks) {
    if (t.bezug?.kontaktId === id || hd.has(t.id) || linkMuster(id).test(t.description ?? '')) eindeutig.push(t);
    else if (name && nameMuster(name).test([t.title ?? '', t.description ?? '', ...(t.kommentare ?? []).map(k => k.text ?? '')].join('\n'))) nurName.push(t);
  }
  return { eindeutig, nurName };
}
/**
 * Eindeutige Aufgaben entpersonalisieren: voller Name → „[gelöscht]“ (Titel, Beschreibung, Kommentare), Link auf
 * die Person raus, `bezug.kontaktId` raus (Firma/Mandat/Deal bleiben; leerer Bezug → Feld weg). Die Aufgabe bleibt.
 */
export function aufgabenAnonymisieren(tasks: Aufgabe[], id: string, headAufgaben: string[], name: string | null): { tasks: Aufgabe[]; n: number; pruefen: string[] } {
  const z = aufgabenZuordnen(tasks, id, headAufgaben, name);
  const ids = new Set(z.eindeutig.map(t => t.id));
  let n = 0;
  const neu = tasks.map(t => {
    if (!ids.has(t.id)) return t;
    const weg = (s?: string) => { let x = (s ?? '').replace(linkWeg(id), '').replace(/[ \t]+\n/g, '\n').trimEnd(); if (name) x = x.replace(nameMuster(name, 'gi'), '[gelöscht]'); return x; };
    const title = weg(t.title) || 'Aufgabe (Person gelöscht)';
    const description = t.description !== undefined ? weg(t.description) : undefined;
    let kommentareGeaendert = false;
    const kommentare = t.kommentare?.map(k => {
      const text = weg(k.text) || '[gelöscht]';
      if (text === k.text) return k;
      kommentareGeaendert = true;
      return { ...k, text };
    });
    const bezugWeg = t.bezug?.kontaktId === id;
    if (title === t.title && description === t.description && !kommentareGeaendert && !bezugWeg) return t;
    n++;
    const { bezug: _b, ...ohneBezug } = t;
    const bezug = t.bezug ? (bezugWeg ? bezugOhneKontakt(t.bezug) : t.bezug) : undefined;
    return {
      ...ohneBezug, title, ...(description !== undefined ? { description } : {}), ...(bezug ? { bezug } : {}),
      ...(kommentareGeaendert ? { kommentare } : {}), updatedAt: new Date().toISOString(),
    };
  });
  return { tasks: n ? neu : tasks, n, pruefen: z.nurName.map(t => t.id) };
}
/** Dubletten: Link `k=<alt>` (Beschreibung, Kommentare) und `bezug.kontaktId` → `neu`. Je geänderter Aufgabe zählt 1. */
export function aufgabenUm(tasks: Aufgabe[], alt: string, neu: string): { tasks: Aufgabe[]; n: number } {
  let n = 0;
  const r = () => new RegExp(`([?&]k=)${esc(alt)}(?![A-Za-z0-9_-])`, 'g');
  const um = (s: string) => s.replace(r(), `$1${neu}`);
  const l = tasks.map(t => {
    const link = !!t.description && r().test(t.description);
    const bezug = t.bezug?.kontaktId === alt;
    const komm = (t.kommentare ?? []).some(k => r().test(k.text ?? ''));
    if (!link && !bezug && !komm) return t;
    n++;
    return {
      ...t,
      ...(link ? { description: um(t.description!) } : {}),
      ...(bezug ? { bezug: { ...t.bezug, kontaktId: neu } } : {}),
      ...(komm ? { kommentare: t.kommentare!.map(k => (r().test(k.text ?? '') ? { ...k, text: um(k.text) } : k)) } : {}),
    };
  });
  return { tasks: n ? l : tasks, n };
}

// ── Speicher ─────────────────────────────────────────────────────────────────

const ABLAGE_DATEI = /^crm-dateien--([a-z0-9][a-z0-9-]{0,39})\.json$/;
/** Alle Haushalte mit Dateiablage (aus den Dateinamen, ohne Inhalte zu lesen). */
async function ablageHaushalte(): Promise<string[]> {
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  return namen.map(n => ABLAGE_DATEI.exec(n)?.[1]).filter((h): h is string => !!h).sort();
}
const replayName = (h: HeadId) => `heads-replay-${h}`;
/** Nur Speicher anfassen, die es gibt — nie einen leeren anlegen. */
const da = async (name: string) => (await loadJson<unknown>(name)) !== null;
type Tasks = { tasks?: Aufgabe[] } & Record<string, unknown>;

/** Was je Speicher geändert wurde (nur Zahlen und Kennungen — nie Personendaten). */
export interface PersonBericht {
  speicher: Record<string, number>;
  /** Aufgaben, die die Person nur beim Namen nennen — von Hand prüfen (nicht geändert). */
  aufgabenPruefen: string[];
  /** Grabstein gesetzt (29.09., #70) — false: Schreiben scheiterte (Löschung trotzdem geschehen, Warnung). Fehlt = nicht verlangt. */
  grabstein?: boolean;
  /** Speicher bzw. Schritte, in denen das Tilgen scheiterte (29.09.) — die Wiederaufnahme holt sie nach. */
  fehler?: string[];
  /** Je Schritt des Art.-17-Vorgangs: erledigt („ok“), schon früher erledigt („schon“) oder gescheitert („fehler“) — #21. */
  schritte?: Record<string, 'ok' | 'schon' | 'fehler'>;
  /** Alle Schritte bestätigt? false = Löschprotokoll „unvollständig“, die Absicht bleibt offen und wird wieder aufgenommen. */
  vollstaendig?: boolean;
  /** Protokoll-ID des Löschprotokolls (nur, wenn verlangt). */
  protokollId?: string;
  /**
   * Apple-Spiegel (29.09., K2): je Spiegel (calendar-cache, kalender-icloud, Erinnerungen, Kontakte) die Zahl der Einträge,
   * die die Person nennen — NICHT geändert (Löschung nur in Apple, sonst baut der Abgleich sie neu). Anzeige: „in Apple löschen“.
   */
  nurInApple?: Record<string, number>;
}
const zaehle = (b: PersonBericht, name: string, n: number) => { if (n) b.speicher[name] = (b.speicher[name] ?? 0) + n; };

// ── Art. 17 als Vorgang mit Absichtsprotokoll (29.09., Paket D-C #17/#21) ────
// Vorher: etwa zehn einzelne Sperren nacheinander, die Kartei zuerst. Brach der Lauf danach ab (Absturz, Deploy,
// beschädigter Bestand), war die Person aus der Kartei weg — und mit ihr der Name: ein zweiter Lauf tilgte nur noch
// nach der Kennung, Namen in Deal-Titeln, Heads und Aufgaben blieben; das Löschprotokoll wurde nie geschrieben.
// Jetzt liegt VOR dem ersten Schritt eine Absicht (lib/store/absichten.ts) mit allem, was die Schritte brauchen
// (Kennung, Name, Adressen, HubSpot, Firma, alte Kennungen aus dem Umzug, Protokoll-ID). Jeder Schritt ist idempotent
// und wird abgehakt; ein gescheiterter Bestand hält die anderen nicht auf (#21) — das Löschprotokoll steht dann auf
// „unvollständig“ (mit den Schrittnamen), und die Wiederaufnahme (Start, Takt, nächtliche Durchsicht) holt es nach.

type Bekannt = Pick<Kontakt, 'vorname' | 'nachname'> & Partial<Pick<Kontakt, 'email' | 'emails' | 'hubspotId' | 'firma'>>;
/** Nur die Merkmale, die die Schritte brauchen (Name, Adressen, HubSpot, Firma) — nicht der ganze Kontakt. */
const merkmalFelder = (k: Bekannt | Kontakt | undefined | null): Bekannt | null => (k ? {
  vorname: k.vorname ?? '', nachname: k.nachname ?? '',
  ...(k.email ? { email: k.email } : {}), ...(k.emails?.length ? { emails: k.emails } : {}),
  ...(k.hubspotId ? { hubspotId: k.hubspotId } : {}), ...(k.firma ? { firma: k.firma } : {}),
} : null);

export const ART17_SCHRITTE = ['protokoll', 'kartei', 'sperrliste', 'grabstein', 'laeufe', 'crm', 'ablage', 'konflikte', 'heads', 'signale', 'tasks', 'weitere', 'index'] as const;
type Art17Schritt = (typeof ART17_SCHRITTE)[number];
/** Welche Schritte auf einen anderen warten (braucht dessen Ergebnis). */
const WARTET_AUF: Partial<Record<Art17Schritt, Art17Schritt>> = { tasks: 'heads' };

export interface Art17Optionen {
  /** false: keinen Grabstein setzen (die Grabstein-Anwendung selbst). */
  grabstein?: boolean;
  /** Löschprotokoll schreiben (nur Protokoll-ID, Tag, Grund, wer) — die Route Art. 17. Nur, wenn die Kartei die Person noch kennt. */
  protokoll?: { datum: string; grund: string; von: string };
  /** Wer den Vorgang auslöste (für die Absicht). */
  person?: string;
}

/**
 * Art. 17: die Person aus ALLEN Speichern entfernen (auch aus der Kartei). Idempotent. Liefert, was wo geändert wurde,
 * je Schritt ok/fehler und ob alles bestätigt ist. `bekannt`: der Aufrufer hat die Kartei schon selbst geleert (PATCH
 * /api/state/kontakte, op 'delete') und reicht die Merkmale nach.
 */
export async function personEntfernen(id: string, bekannt?: Bekannt, opt: Art17Optionen = {}): Promise<PersonBericht> {
  if (!id) return { speicher: {}, aufgabenPruefen: [] };
  const { karteiHaushalt } = await import('./sperrliste');
  const haushalt = await karteiHaushalt();
  const vorab = ((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(k => k.id === id);
  const person = merkmalFelder(vorab ?? bekannt);
  const { alteKennungenVon } = await import('./kennung-alias');
  const { absichtBeginnen, absichtenLaden, absichtDatenSetzen, fluechtigeAbsicht, istOffen } = await import('@/lib/store/absichten');
  const schritte = [...ART17_SCHRITTE];
  const daten = {
    id, person, alteKennungen: await alteKennungenVon(id), grabstein: opt.grabstein !== false,
    ...(opt.protokoll && vorab ? { protokoll: opt.protokoll, protokollId: neueProtokollId() } : {}),
  };
  // Nichts Schützenswertes (Person unbekannt, keine offene Absicht): ein zweiter Lauf räumt nur nach der Kennung —
  // flüchtig, ohne Spur im Absichtsprotokoll (idempotent ohne Änderung).
  const offen = (await absichtenLaden(haushalt)).find(a => a.art === 'art17' && a.schluessel === id && istOffen(a));
  if (!person && !offen) return art17Lauf(haushalt, fluechtigeAbsicht({ art: 'art17', schluessel: id, schritte, daten }), false);
  const { absicht, neu } = await absichtBeginnen(haushalt, { art: 'art17', schluessel: id, schritte, daten, ...(opt.person ? { person: opt.person } : {}) });
  // Eine offene Absicht (z. B. vom Kartei-Löschen) bekommt das Löschprotokoll nachgereicht, wenn die Route es jetzt verlangt.
  if (!neu && opt.protokoll && !absicht.daten.protokollId && (vorab || absicht.daten.person)) {
    const p = { protokoll: opt.protokoll, protokollId: neueProtokollId() };
    await absichtDatenSetzen(haushalt, absicht.id, p);
    Object.assign(absicht.daten, p);
  }
  return art17Lauf(haushalt, absicht, true);
}

/**
 * Vor dem Löschen in der Kartei (PATCH /api/state/kontakte, op 'delete'): die Absicht mit den Merkmalen festhalten.
 * `quelle: 'kartei'` — die Wiederaufnahme vollendet sie nur, wenn die Kartei die Person wirklich nicht mehr hat.
 */
export async function art17Vormerken(id: string, k: Kontakt, opt: { person?: string; quelle: 'kartei' }): Promise<void> {
  const { karteiHaushalt } = await import('./sperrliste');
  const { alteKennungenVon } = await import('./kennung-alias');
  const { absichtBeginnen } = await import('@/lib/store/absichten');
  await absichtBeginnen(await karteiHaushalt(), {
    art: 'art17', schluessel: id, schritte: ART17_SCHRITTE, ...(opt.person ? { person: opt.person } : {}),
    daten: { id, person: merkmalFelder(k), alteKennungen: await alteKennungenVon(id), grabstein: true, quelle: opt.quelle },
  });
}

/** Eine Vormerkung verfällt (das Löschen fand nicht statt) — nur, solange die Kartei noch nicht angefasst ist. */
export async function art17Verwerfen(id: string, quelle: 'kartei'): Promise<void> {
  const { karteiHaushalt } = await import('./sperrliste');
  const { absichtenLaden, absichtAbschliessen, istOffen, schrittErledigt } = await import('@/lib/store/absichten');
  const h = await karteiHaushalt();
  for (const a of await absichtenLaden(h)) {
    if (a.art === 'art17' && a.schluessel === id && istOffen(a) && a.daten.quelle === quelle && !schrittErledigt(a, 'kartei')) await absichtAbschliessen(h, a.id, 'verworfen');
  }
}

/**
 * Wiederaufnahme einer offenen Art.-17-Absicht (lib/store/absichten-fortsetzen.ts). Ist die Kartei noch nicht
 * angefasst und steht die Person noch darin, gilt: eingeschränkt (Art. 18) → nie löschen; nur vorgemerkt beim
 * Kartei-Löschen (`quelle: 'kartei'`) → das Löschen fand nicht statt, die Absicht verfällt. Ein Löschverlangen über
 * die Route Art. 17 wird dagegen vollendet.
 */
export async function art17Fortsetzen(haushalt: string, absicht: import('@/lib/store/absichten').Absicht): Promise<PersonBericht | null> {
  const { schrittErledigt, absichtAbschliessen } = await import('@/lib/store/absichten');
  if (!schrittErledigt(absicht, 'kartei')) {
    const k = ((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(x => x.id === (absicht.daten.id ?? absicht.schluessel));
    if (k && (k.eingeschraenkt || absicht.daten.quelle === 'kartei')) { await absichtAbschliessen(haushalt, absicht.id, 'verworfen'); return null; }
  }
  return art17Lauf(haushalt, absicht, true);
}

async function art17Lauf(haushalt: string, absicht: import('@/lib/store/absichten').Absicht, speichern: boolean): Promise<PersonBericht> {
  const { mitVorgang, absichtAbschliessen, TestAbbruch } = await import('@/lib/store/absichten');
  return mitVorgang(haushalt, absicht, async v => {
    const b: PersonBericht = { speicher: {}, aufgabenPruefen: [], schritte: {} };
    const id = v.daten<string>('id') ?? absicht.schluessel;
    const lauf = async <T>(name: Art17Schritt, fn: () => Promise<T>, daten?: (r: T) => Record<string, unknown>) => {
      const vor = WARTET_AUF[name];
      if (vor && !v.erledigt(vor)) { b.schritte![name] = 'fehler'; return; }
      if (v.erledigt(name)) { b.schritte![name] = 'schon'; return; }
      try { await v.schritt(name, fn, daten); b.schritte![name] = 'ok'; }
      catch (e) {
        if (e instanceof TestAbbruch) throw e;
        b.schritte![name] = 'fehler';
        console.error(`[art17] Schritt ${name}:`, e instanceof Error ? e.message : e);
      }
    };
    const protokoll = v.daten<{ datum: string; grund: string; von: string }>('protokoll');
    const protokollId = v.daten<string>('protokollId');
    const { loeschungVermerken } = await import('./loeschprotokoll');

    // 1. Löschprotokoll „läuft“ — vor der ersten Wirkung (so ist eine begonnene Löschung auch nach einem Absturz belegt).
    await lauf('protokoll', async () => { if (protokoll && protokollId) await loeschungVermerken({ id: protokollId, ...protokoll, status: 'laeuft' }); });

    // 2. Kartei: Eintrag raus. Die Merkmale aus der Sperre (aktueller als der Vorab-Stand) wandern in die Absicht.
    await lauf('kartei', async () => {
      let kontakt: Kontakt | undefined;
      let andereNamen: string[] = [];
      await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
        const f = cur ?? { kontakte: [] };
        kontakt = f.kontakte.find(k => k.id === id);
        andereNamen = f.kontakte.filter(k => k.id !== id).map(k => (vollerName(k) ?? '').toLowerCase()).filter(Boolean);
        if (!kontakt) return f;
        return { ...f, kontakte: f.kontakte.filter(k => k.id !== id) };
      });
      if (kontakt) zaehle(b, 'kontakte', 1);
      const p = merkmalFelder(kontakt) ?? v.daten<Bekannt | null>('person') ?? null;
      const name = vollerName(p ?? undefined);
      return { person: p, namensgleich: !!name && andereNamen.includes(name.toLowerCase()) };
    }, r => r);
    const person = v.daten<Bekannt | null>('person') ?? null;
    const name = vollerName(person ?? undefined);
    const namensgleich = !!v.daten<boolean>('namensgleich');

    // 3. Sperrliste (K2 #60): nur Hashes der Merkmale — ein erneuter Import der Liste legt die Person nicht wieder an.
    await lauf('sperrliste', async () => { if (person && await sperren([person], 'loeschung', new Date().toISOString())) zaehle(b, 'crm-sperrliste', 1); });

    // 4. Grabstein AUSSERHALB des Datenordners (#70) — auch für alte Kennungen aus dem Kennungs-Umzug (ein Restore von
    //    vor dem Umzug brächte die Person unter der alten Kennung zurück).
    if (person && v.daten<boolean>('grabstein') !== false) {
      await lauf('grabstein', async () => {
        const { grabsteinFuer, grabsteinSetzen } = await import('@/lib/datenschutz/grabsteine');
        const am = new Date().toISOString();
        await grabsteinSetzen(grabsteinFuer(id, person, am));
        // Alte Kennungen je als eigener Grabstein nur mit der Kennung (die Merkmale trägt schon der erste) — sonst
        // vereinte `grabsteinSetzen` sie über die gleichen Merkmale zu EINEM Eintrag mit nur einer Kennung.
        for (const k of v.daten<string[]>('alteKennungen') ?? []) await grabsteinSetzen(grabsteinFuer(k, null, am));
      });
      b.grabstein = v.erledigt('grabstein');
    } else await lauf('grabstein', async () => undefined);

    // 5. Import-Läufe (K2 #25): der Vorher-Stand der Person verschwindet aus jedem Lauf.
    await lauf('laeufe', async () => {
      for (const h of await laufHaushalte()) {
        await updateJson<LaufBestand>(laufName(h), cur => {
          let n = 0;
          const laeufe = (cur?.laeufe ?? []).map(l => { const r = laufOhne(l, id); n += r.n; return r.lauf; });
          zaehle(b, laufName(h), n);
          return n ? { laeufe } : (cur ?? { laeufe: [] });
        });
      }
    });

    // 6. CRM: Kennung raus UND der volle Name aus Deal-Titeln und Kundennamen — in EINER Sperre. Gibt es eine andere
    //    Person mit demselben vollen Namen, nur dort, wo die gelöschte verknüpft war.
    await lauf('crm', async () => {
      const vorher = await ladeCrm();
      if (enthaeltKennung(vorher, id) || crmNenntNamen(vorher, name, namensgleich ? crmVerknuepft(vorher, id) : undefined)) {
        await aendereCrm(c => { const nur = namensgleich ? crmVerknuepft(c, id) : undefined; return crmNamenTilgen(crmOhne(c, id), name, nur); });
        zaehle(b, 'crm', 1);
      }
    });

    // 7. Dateiablage (alle Haushalte) — Eintrag zuerst, dann die Datei (ein Fehler hinterlässt höchstens eine verwaiste,
    //    verschlüsselte Datei, die die Verbindungsprüfung meldet).
    await lauf('ablage', async () => {
      for (const h of await ablageHaushalte()) {
        let weg: DateiEintrag[] = [];
        await updateJson<{ eintraege: DateiEintrag[] }>(ablageName(h), cur => {
          const r = ablageOhne(cur?.eintraege ?? [], id);
          weg = r.weg;
          zaehle(b, `crm-dateien--${h}`, r.weg.length + r.geloest);
          return r.weg.length || r.geloest ? { ...(cur ?? {}), eintraege: r.eintraege } : (cur ?? { eintraege: [] });
        });
        for (const e of weg) if (e.datei) await fs.unlink(dateiPfad(h, e.id)).catch(() => {});
      }
    });

    await lauf('konflikte', async () => {
      if (await da(KONFLIKT_SPEICHER)) await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => { const r = konflikteOhne(cur ?? leererKonfliktStand(), id); zaehle(b, KONFLIKT_SPEICHER, r.n); return r.stand; });
    });

    // 8. Heads — die Aufgaben entfernter Vorschläge (Kennungen) braucht der Aufgaben-Schritt: sie wandern in die Absicht.
    await lauf('heads', async () => {
      const headAufgaben: string[] = [];
      for (const h of HEADS) {
        if (await da(standName(h))) await updateJson<HeadStand>(standName(h), cur => { const r = headStandOhne({ ...leererStand(), ...(cur ?? {}) }, id, name); headAufgaben.push(...r.aufgaben); zaehle(b, standName(h), r.n); return r.n ? r.stand : (cur as HeadStand); });
        if (await da(replayName(h))) await updateJson<ReplayStand>(replayName(h), cur => { const r = replayOhne(cur ?? { faelle: [] }, id, name); zaehle(b, replayName(h), r.n); return r.stand; });
      }
      return headAufgaben;
    }, headAufgaben => ({ headAufgaben: Array.from(new Set([...(v.daten<string[]>('headAufgaben') ?? []), ...headAufgaben])) }));

    await lauf('signale', async () => {
      if (await da('crm-signale')) await updateJson<SignalStand>('crm-signale', cur => { const r = signaleOhne(cur ?? {}, id); zaehle(b, 'crm-signale', r.n); return r.stand; });
    });

    await lauf('tasks', async () => {
      if (!(await da('tasks'))) return;
      const headAufgaben = v.daten<string[]>('headAufgaben') ?? [];
      await updateJson<Tasks>('tasks', cur => {
        const f = cur ?? { tasks: [] };
        const r = aufgabenAnonymisieren(f.tasks ?? [], id, headAufgaben, name);
        zaehle(b, 'tasks', r.n);
        b.aufgabenPruefen = r.pruefen;
        return r.n ? { ...f, tasks: r.tasks } : f;
      });
    });

    // 9. Alle weiteren Speicher (#69) — Register lib/crm/speicher-register.ts, Umsetzung lib/crm/person-weitere.ts —
    //    und die Weiterleitungstabelle des Kennungs-Umzugs (alte Kennung trägt die E-Mail).
    await lauf('weitere', async () => {
      const w = await weitereEntfernen(merkmaleVon(id, person));
      for (const [s, n] of Object.entries(w.speicher)) zaehle(b, s, n);
      if (Object.keys(w.nurInApple).length) b.nurInApple = w.nurInApple;
      const { aliasOhnePerson, aliasName } = await import('./kennung-alias');
      const { karteiHaushalt } = await import('./sperrliste');
      zaehle(b, aliasName(await karteiHaushalt()), await aliasOhnePerson([id, ...(v.daten<string[]>('alteKennungen') ?? [])]));
      if (w.fehler.length) { b.fehler = w.fehler; throw new Error(`weitere Speicher gescheitert: ${w.fehler.join(', ')}`); }
    });

    // 10. Abgeleitete Stände sofort nachziehen (#99): Such-Index (inkrementell; secure_delete überschreibt die freien
    //     Seiten) und — falls eingeschaltet — der _App-Spiegel. Fehler hier machen die Löschung nicht unvollständig
    //     (der Takt zieht den Index ohnehin nach) — deshalb im Schritt aufgefangen.
    await lauf('index', async () => {
      if (!Object.keys(b.speicher).length) return;
      try { const { appIndexAktualisieren } = await import('@/lib/brain/app-index'); await appIndexAktualisieren(true); }
      catch (e) { console.error('[art17] Such-Index nicht nachgezogen (der Takt holt es nach):', e instanceof Error ? e.message : e); }
      if (process.env.MAKE_OS_APP_SPIEGEL?.trim() === 'an') {
        try { const { appSpiegel } = await import('@/lib/brain/app-spiegel'); await appSpiegel({ erzwingen: true }); }
        catch (e) { console.error('[art17] _App-Spiegel nicht neu erzeugt:', e instanceof Error ? e.message : e); }
      }
    });

    // Abschluss: Löschprotokoll-Status (#21) und Absicht. Unvollständig → die Absicht bleibt mit ihren Daten offen.
    const fehlend = ART17_SCHRITTE.filter(s => !v.erledigt(s));
    b.vollstaendig = fehlend.length === 0;
    if (fehlend.length && !b.fehler) b.fehler = fehlend;
    if (protokoll && protokollId) {
      b.protokollId = protokollId;
      try { await loeschungVermerken({ id: protokollId, ...protokoll, status: b.vollstaendig ? 'vollstaendig' : 'unvollstaendig', ...(fehlend.length ? { fehlend } : {}) }); }
      catch (e) { console.error('[art17] Löschprotokoll-Status nicht nachgetragen:', e instanceof Error ? e.message : e); }
    }
    if (speichern) await absichtAbschliessen(haushalt, absicht.id, b.vollstaendig ? 'fertig' : 'unvollstaendig', ['protokollId']);
    return b;
  }, { speichern });
}

/**
 * Dubletten: alle Verweise von `alt` auf `neu` umbiegen — außer in der Kartei selbst (dort führt die
 * Dubletten-Route beide Einträge zusammen und löscht `alt`). Idempotent.
 */
export async function personUmbiegen(alt: string, neu: string): Promise<PersonBericht> {
  return personenUmbiegen(new Map([[alt, neu]]));
}

// ── Viele Kennungen auf einmal umbiegen (29.09., Paket D-C #35: Kennungs-Umzug) ──
// Derselbe Weg wie beim Zusammenführen (die strukturierten `…Um`-Funktionen je Speicher), aber je Speicher EINE Sperre
// für alle Paare. Im Umzug (`umzug: true`) zusätzlich: Resttexte (Links `?k=c-…` in Notizen), Import- und
// Zusammenführ-Läufe (mit nachgezogenen Fingerabdrücken, damit „rückgängig“ weiter geht), alle übrigen Bestände mit
// alten Kennungen (ZOE-Stapel/-Verlauf/-Gedächtnis, Meldungen, Netzwerk …) und die Protokoll-Fingerabdrücke
// (Änderungsprotokoll, ZOE-Entscheidungen: `c2#hmac(alt)` → `c2#hmac(neu)`). Die Kartei selbst macht der Aufrufer.

export const UMBIEGEN_TEILE = ['crm', 'ablage', 'konflikte', 'heads', 'signale', 'tasks'] as const;
export const UMZUG_TEILE = [...UMBIEGEN_TEILE, 'laeufe', 'weitere', 'fingerabdruecke'] as const;
export type UmbiegenTeil = (typeof UMZUG_TEILE)[number];

/** Bestände, die der Umzug NICHT pauschal anfasst: eigene Schritte, das Protokoll des Umzugs selbst, Fingerabdrücke. */
const UMZUG_EIGENE = /^(kontakte|crm|tasks|crm-dateien--.*|crm-import-konflikte|head-.*|heads-replay-.*|crm-signale|crm-import-laeufe--.*|absichten--.*|kennung-alias--.*|aenderungsprotokoll--.*|zoe-entscheidungen--.*)$/;

export interface UmbiegenOptionen {
  umzug?: boolean;
  /** Jeden Teil als Schritt eines Vorgangs ausführen (Absichtsprotokoll) — ohne: direkt nacheinander. */
  schritt?: (teil: UmbiegenTeil, fn: () => Promise<void>) => Promise<void>;
}

export async function personenUmbiegen(paare: ReadonlyMap<string, string>, opt: UmbiegenOptionen = {}): Promise<PersonBericht> {
  const b: PersonBericht = { speicher: {}, aufgabenPruefen: [] };
  const p = new Map(Array.from(paare).filter(([a, n]) => a && n && a !== n));
  if (!p.size) return b;
  const teil = opt.schritt ?? ((_t: UmbiegenTeil, fn: () => Promise<void>) => fn());
  /** Welche Paare kommen in diesem Wert vor? Im Umzug über EINEN Durchgang, sonst je Paar (Kennungen beliebiger Form). */
  const vorhanden = (wert: unknown): [string, string][] => (opt.umzug ? vorkommendePaare(wert, p) : Array.from(p).filter(([a]) => enthaeltKennung(wert, a)));
  const rest = <T>(wert: T): T => (opt.umzug ? kennungenErsetzen(wert, p).wert : wert);

  await teil('crm', async () => {
    const vor = vorhanden(await ladeCrm());
    if (!vor.length) return;
    await aendereCrm(c => { let x = c; for (const [a, n] of vorhanden(c)) x = crmUm(x, a, n); return rest(x); });
    zaehle(b, 'crm', vor.length);
  });
  await teil('ablage', async () => {
    for (const h of await ablageHaushalte()) {
      await updateJson<{ eintraege: DateiEintrag[] }>(ablageName(h), cur => {
        let l = cur?.eintraege ?? [], n = 0;
        for (const [a, x] of vorhanden(l)) { const r = ablageUm(l, a, x); l = r.eintraege; n += r.n; }
        const r2 = kennungenErsetzen(l, opt.umzug ? p : new Map());
        zaehle(b, `crm-dateien--${h}`, n || r2.n);
        return n || r2.n ? { ...(cur ?? {}), eintraege: r2.wert } : (cur ?? { eintraege: [] });
      });
    }
  });
  await teil('konflikte', async () => {
    if (!(await da(KONFLIKT_SPEICHER))) return;
    await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => {
      let st = cur ?? leererKonfliktStand(), n = 0;
      for (const [a, x] of vorhanden(st)) { const r = konflikteUm(st, a, x); st = r.stand; n += r.n; }
      zaehle(b, KONFLIKT_SPEICHER, n);
      return rest(st);
    });
  });
  await teil('heads', async () => {
    for (const h of HEADS) {
      if (await da(standName(h))) await updateJson<HeadStand>(standName(h), cur => {
        let st = { ...leererStand(), ...(cur ?? {}) }, n = 0;
        for (const [a, x] of vorhanden({ v: st.vorschlaege, b: st.berichte })) { const r = headStandUm(st, a, x); st = r.stand; n += r.n; }
        zaehle(b, standName(h), n);
        return n ? rest(st) : (cur as HeadStand);
      });
      if (await da(replayName(h))) await updateJson<ReplayStand>(replayName(h), cur => {
        let st = cur ?? { faelle: [] }, n = 0;
        for (const [a, x] of vorhanden(st.faelle)) { const r = replayUm(st, a, x); st = r.stand; n += r.n; }
        zaehle(b, replayName(h), n);
        return rest(st);
      });
    }
  });
  await teil('signale', async () => {
    if (!(await da('crm-signale'))) return;
    await updateJson<SignalStand>('crm-signale', cur => {
      let st = cur ?? {}, n = 0;
      for (const [a, x] of vorhanden(st)) { const r = signaleUm(st, a, x); st = r.stand; n += r.n; }
      zaehle(b, 'crm-signale', n);
      return rest(st);
    });
  });
  await teil('tasks', async () => {
    if (!(await da('tasks'))) return;
    await updateJson<Tasks>('tasks', cur => {
      const f = cur ?? { tasks: [] };
      let l = f.tasks ?? [], n = 0;
      for (const [a, x] of vorhanden(l)) { const r = aufgabenUm(l, a, x); l = r.tasks; n += r.n; }
      const r2 = kennungenErsetzen(l, opt.umzug ? p : new Map());
      zaehle(b, 'tasks', n || r2.n);
      return n || r2.n ? { ...f, tasks: r2.wert } : f;
    });
  });
  if (!opt.umzug) return b;

  await teil('laeufe', async () => {
    const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
    for (const h of await laufHaushalte()) {
      const laeufe = (await loadJson<LaufBestand>(laufName(h)))?.laeufe ?? [];
      if (!vorkommendePaare(laeufe, p).length) continue;
      const listen = new Map<string, Awaited<ReturnType<typeof schnappschussListe>>>();
      for (const s of Array.from(new Set(laeufe.flatMap(l => (l.zusammen?.verweise ?? []).map(v => v.speicher))))) listen.set(s, await schnappschussListe(s));
      await updateJson<LaufBestand>(laufName(h), cur => {
        const r = laeufeUmziehen(cur?.laeufe ?? [], p, kontakte, s => listen.get(s) ?? null);
        zaehle(b, laufName(h), r.n);
        return r.n ? { laeufe: r.laeufe } : (cur ?? { laeufe: [] });
      });
    }
  });
  await teil('weitere', async () => {
    for (const name of await alleBestandsNamen()) {
      if (UMZUG_EIGENE.test(name)) continue;
      const cur = await loadJson<unknown>(name);
      if (cur === null || !vorkommendePaare(cur, p).length) continue;
      let n = 0;
      await updateJson<unknown>(name, c => { const r = kennungenErsetzen(c, p); n = r.n; return r.wert; });
      zaehle(b, name, n);
    }
  });
  await teil('fingerabdruecke', async () => {
    const { protokollKennung, protokollKennungen } = await import('@/lib/store/aenderungsprotokoll');
    const tabelle = new Map<string, string>();
    for (const [a, n] of Array.from(p)) for (const f of protokollKennungen(a)) if (f !== a) tabelle.set(f, protokollKennung(n));
    for (const name of await alleBestandsNamen()) {
      if (!/^(aenderungsprotokoll|zoe-entscheidungen)--[a-z0-9-]+--\d{4}-\d{2}$/.test(name)) continue;
      let n = 0;
      await updateJson<unknown>(name, c => { const r = fingerabdrueckeErsetzen(c, tabelle); n = r.n; return r.wert; });
      zaehle(b, name, n);
    }
  });
  return b;
}

async function alleBestandsNamen(): Promise<string[]> {
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  return namen.filter(n => /^[a-z0-9][a-z0-9-]*\.json$/.test(n)).map(n => n.slice(0, -5)).sort();
}

/**
 * Import- und Zusammenführ-Läufe umziehen (rein): alle Kennungen ersetzen UND die Fingerabdrücke „danach“ nachziehen —
 * sonst meldete „rückgängig“ jeden umgezogenen Eintrag als „seitdem geändert“. Nachgezogen wird nur, wo der Eintrag
 * (auf die alten Kennungen zurückgerechnet) noch genau dem gespeicherten Fingerabdruck entspricht.
 */
export function laeufeUmziehen(laeufe: readonly import('./import-lauf').ImportLauf[], paare: ReadonlyMap<string, string>, kontakte: readonly Kontakt[], liste: (speicher: string) => ({ id: string } & Record<string, unknown>)[] | null): { laeufe: import('./import-lauf').ImportLauf[]; n: number } {
  const rueck = umkehren(paare);
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  /** Neuer Fingerabdruck, wenn der jetzige Eintrag (zurückgerechnet) dem alten entspricht — sonst der alte. */
  const nachziehen = (fp: string, e: Record<string, unknown> | undefined) => {
    if (!e) return fp;
    const vorher = kennungenErsetzen(e, rueck).wert;
    return fingerabdruck(vorher) === fp ? fingerabdruck(kennungenErsetzen(vorher, paare).wert) : fp;
  };
  let n = 0;
  const neu = laeufe.map(l => {
    const nachher = Object.fromEntries(Object.entries(l.nachher ?? {}).map(([id, fp]) => {
      const k = nachId.get(id) ?? nachId.get(paare.get(id) ?? '');
      return [id, nachziehen(fp, k as unknown as Record<string, unknown> | undefined)];
    }));
    const verweise = l.zusammen?.verweise.map(s => {
      if (s.nachher === null) return s;
      const e = (liste(s.speicher) ?? []).find(x => x.id === s.id || x.id === paare.get(s.id));
      return { ...s, nachher: nachziehen(s.nachher, e) };
    });
    const mitAbdruck = { ...l, nachher, ...(l.zusammen && verweise ? { zusammen: { ...l.zusammen, verweise } } : {}) };
    const r = kennungenErsetzen(mitAbdruck, paare);
    const geaendert = r.n > 0 || JSON.stringify(mitAbdruck) !== JSON.stringify(l);
    if (geaendert) n++;
    return geaendert ? r.wert : l;
  });
  return { laeufe: neu, n };
}

/**
 * Art. 15: was die Speicher AUSSER Kartei und Firma über die Person halten. Dateiablage nur als Metadaten
 * (nie Inhalte), Head-Vorschläge nur mit Titel/Status, Aufgaben nur eindeutig zugeordnete (s. `aufgabenZuordnen`,
 * auch über `bezug.kontaktId`).
 */
export async function personAufzaehlen(id: string) {
  const crm = await ladeCrm();
  const dateien: ReturnType<typeof ablageAuskunft> = [];
  for (const h of await ablageHaushalte()) dateien.push(...ablageAuskunft((await loadJson<{ eintraege: DateiEintrag[] }>(ablageName(h)))?.eintraege ?? [], id));
  const importKonflikte = konflikteAuskunft((await loadJson<KonfliktStand>(KONFLIKT_SPEICHER)) ?? leererKonfliktStand(), id);
  const headVorschlaege: { head: HeadId; titel: string; art: string; status: string; erstellt: string }[] = [];
  const headAufgaben: string[] = [];
  for (const h of HEADS) {
    for (const v of (await loadJson<HeadStand>(standName(h)))?.vorschlaege ?? []) {
      if (v.kontakt_id !== id) continue;
      headVorschlaege.push({ head: h, titel: v.titel, art: v.art, status: v.status, erstellt: v.erstellt });
      headAufgaben.push(v.auto?.rueckgaengig?.aufgabeId ?? `hd-${v.id}`);
    }
  }
  // Replay-Fälle der Heads (Datenpakete für Evals): nur die Zahl — der Inhalt ist derselbe Bestand wie oben.
  let headReplayFaelle = 0;
  for (const h of HEADS) headReplayFaelle += ((await loadJson<ReplayStand>(replayName(h)))?.faelle ?? []).filter(f => enthaeltKennung(f, id)).length;
  const kommenderTermin = (await loadJson<SignalStand>('crm-signale'))?.kommend?.[id] ?? null;
  const tasks = (await loadJson<Tasks>('tasks'))?.tasks ?? [];
  const aufgaben = aufgabenZuordnen(tasks, id, headAufgaben, null).eindeutig.map(t => ({ id: t.id, titel: t.title, status: t.status, ...(t.dueDate ? { faellig: t.dueDate } : {}), ...(t.bezug?.kontaktId === id ? { verknuepft: true } : {}) }));
  // Import-Läufe (K2): in wie vielen Läufen ein Vorher-Stand der Person liegt (Inhalt = frühere Fassung derselben Stammdaten).
  let importLaeufe = 0;
  for (const h of await laufHaushalte()) importLaeufe += ((await loadJson<LaufBestand>(laufName(h)))?.laeufe ?? []).filter(l => laufOhne(l, id).n > 0).length;
  // 29.09. (#68/#93): ZOE-Protokoll und -Stapel (nur Zeit, Werkzeug, Status — keine Inhalte), das Änderungsprotokoll
  // (Fingerabdruck v2/v1 → Bestand, Art, Feldnamen, wer) und je weiterem Speicher, wie oft die Person vorkommt.
  const kontakt = ((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(k => k.id === id);
  const m = merkmaleVon(id, kontakt);
  const { nenntPerson } = await import('./person-weitere');
  const zoeProtokoll = ((await loadJson<{ eintraege?: { zeit: string; werkzeug: string; ok: boolean; quelle: string }[] }>('zoe-protokoll'))?.eintraege ?? [])
    .filter(e => nenntPerson(e, m)).map(e => ({ zeit: e.zeit, werkzeug: e.werkzeug, ok: e.ok, quelle: e.quelle }));
  const zoeStapel = ((await loadJson<{ vorschlaege?: { zeit: string; werkzeug: string; status: string; titel: string }[] }>('zoe-stapel'))?.vorschlaege ?? [])
    .filter(v => nenntPerson(v, m)).map(v => ({ zeit: v.zeit, werkzeug: v.werkzeug, status: v.status, titel: v.titel }));
  const aenderungsprotokoll = await protokollDerPerson(m.fingerabdruecke);
  const weitereSpeicher = await weitereAufzaehlen(m);
  // S1 #5 (29.09.): Buchungen, Termin-Bezüge, Meetings und Termin-Follow-ups als KOPIE (Art. 15 Abs. 3) — ohne Geheimnisse
  // (Token-/Link-Hashes) und ohne Wortlaut Dritter (lib/crm/person-auskunft-kalender.ts).
  const kal = await import('./person-auskunft-kalender');
  const [{ ladeBuchungBestand }, { ladeBezuege }] = await Promise.all([import('@/lib/kalender/buchung-speicher'), import('@/lib/kalender/bezug-server')]);
  const buchungen = kal.buchungenAuskunft((await ladeBuchungBestand().catch(() => null))?.buchungen, m);
  const terminBezuege = kal.bezuegeAuskunft(await ladeBezuege().catch(() => null), id);
  const terminSchluessel = kal.terminSchluesselDerPerson(terminBezuege, buchungen, kontakt?.aktivitaeten);
  const meetings = kal.meetingsAuskunft((await loadJson<{ meetings?: import('./person-auskunft-kalender').MeetingRoh[] }>('meetings'))?.meetings, m, terminSchluessel);
  const verweise = personVerweise(crm, id);
  const terminFollowups = kal.terminFollowupsAuskunft(crm.followups, terminSchluessel, new Set(verweise.followups.map(f => f.id)));
  return { ...verweise, terminFollowups, buchungen, terminBezuege, meetings, dateien, importKonflikte, headVorschlaege, headReplayFaelle, kommenderTermin, aufgaben, importLaeufe, zoeProtokoll, zoeStapel, aenderungsprotokoll, weitereSpeicher };
}

/** Änderungsprotokoll-Einträge zu diesen Fingerabdrücken (alle Monatsdateien) — ohne Werte, wie gespeichert. */
async function protokollDerPerson(fps: readonly string[]): Promise<{ at: string; bestand: string; liste?: string; op: string; felder?: string[]; wer: string; person?: string }[]> {
  if (!fps.length) return [];
  const namen = (await fs.readdir(datenOrdner()).catch(() => [] as string[])).filter(n => /^aenderungsprotokoll--[a-z0-9-]+--\d{4}-\d{2}\.json$/.test(n)).sort();
  const raus: { at: string; bestand: string; liste?: string; op: string; felder?: string[]; wer: string; person?: string }[] = [];
  for (const n of namen) {
    for (const e of (await loadJson<{ eintraege?: { at: string; bestand: string; liste?: string; op: string; id: string; felder?: string[]; wer: string; person?: string }[] }>(n.slice(0, -5)))?.eintraege ?? []) {
      if (fps.includes(e.id)) raus.push({ at: e.at, bestand: e.bestand, ...(e.liste ? { liste: e.liste } : {}), op: e.op, ...(e.felder ? { felder: e.felder } : {}), wer: e.wer, ...(e.person ? { person: e.person } : {}) });
    }
  }
  return raus;
}

/**
 * Wo eine Kennung „verknüpft“ sein kann — außer in der Kartei selbst und den Import-Konflikten (Ablaufprüfung 28.09., c):
 * CRM-Bestand, Dateiablage (alle Haushalte), Head-Vorschläge, Termin-Signale, Aufgaben. „Import rückgängig“ fragt damit,
 * ob ein neu angelegter Kontakt (bzw. eine neue Firma) inzwischen irgendwo hängt: `enthaeltKennung(teil, id)` je Teil.
 * Einmal laden, dann für viele Kennungen prüfen.
 */
export interface VerknuepfungsBestaende { crm: import('./typen').CrmBestand; ablage: DateiEintrag[]; heads: HeadStand['vorschlaege']; signale: SignalStand; tasks: Aufgabe[] }
export async function verknuepfungsBestaende(): Promise<VerknuepfungsBestaende> {
  const ablage: DateiEintrag[] = [];
  for (const h of await ablageHaushalte()) ablage.push(...((await loadJson<{ eintraege: DateiEintrag[] }>(ablageName(h)))?.eintraege ?? []));
  const heads: HeadStand['vorschlaege'] = [];
  for (const h of HEADS) heads.push(...((await loadJson<HeadStand>(standName(h)))?.vorschlaege ?? []));
  return { crm: await ladeCrm(), ablage, heads, signale: (await loadJson<SignalStand>('crm-signale')) ?? {}, tasks: (await loadJson<Tasks>('tasks'))?.tasks ?? [] };
}
/** Hängt die Kennung irgendwo (ohne den Eintrag `ohne` im CRM, z. B. die Firma selbst)? Liefert den ersten Bestand oder null. */
export function verknuepftIn(b: VerknuepfungsBestaende, id: string, ohne?: { liste: 'firmen'; id: string }): string | null {
  const crm = ohne ? { ...b.crm, firmen: b.crm.firmen.filter(f => f.id !== ohne.id) } : b.crm;
  if (enthaeltKennung(crm, id)) return 'crm';
  if (b.ablage.some(e => enthaeltKennung(e, id))) return 'dateien';
  if (b.heads.some(v => enthaeltKennung(v, id))) return 'heads';
  if (enthaeltKennung(b.signale, id)) return 'signale';
  if (b.tasks.some(t => enthaeltKennung(t, id))) return 'aufgaben';
  return null;
}

// ── Zusammenführen mit „Rückgängig“ (28.09., Ablaufprüfung W4) ──────────────
// Diese Datei kennt die Speicher — also rechnet sie auch, was `personUmbiegen` in CRM, Dateiablage und Aufgaben
// ändern WIRD (Schnappschüsse für den Zusammenführungs-Lauf), und schreibt die Vorher-Stände beim Rückgängig zurück.

type MitId = { id: string } & Record<string, unknown>;

/** Was `personUmbiegen(alt, neu)` in CRM, Dateiablage und Aufgaben ändern wird — rein auf dem aktuellen Stand gerechnet. */
export async function umbiegenSchnappschuesse(alt: string, neu: string): Promise<Schnappschuss[]> {
  if (!alt || !neu || alt === neu) return [];
  const raus: Schnappschuss[] = [];
  const crm = await ladeCrm();
  if (enthaeltKennung(crm, alt)) raus.push(...crmSchnappschuesse(crm, crmUm(crm, alt, neu)));
  for (const h of await ablageHaushalte()) {
    const e = (await loadJson<{ eintraege: DateiEintrag[] }>(ablageName(h)))?.eintraege ?? [];
    const r = ablageUm(e, alt, neu);
    if (r.n) raus.push(...schnappschuesse(`dateien:${h}`, e as unknown as MitId[], r.eintraege as unknown as MitId[]));
  }
  const tasks = (await loadJson<Tasks>('tasks'))?.tasks ?? [];
  const t = aufgabenUm(tasks, alt, neu);
  if (t.n) raus.push(...schnappschuesse('tasks', tasks as MitId[], t.tasks as MitId[]));
  return raus;
}

const DATEIEN_SPEICHER = /^dateien:([a-z0-9][a-z0-9-]{0,39})$/;
/** Aktueller Stand eines Schnappschuss-Speichers (`crm:<liste>`, `dateien:<haushalt>`, `tasks`) — null, wenn unbekannt. */
export async function schnappschussListe(speicher: string, crm?: CrmBestandT): Promise<MitId[] | null> {
  if (speicher.startsWith('crm:')) {
    const l = speicher.slice(4) as (typeof CRM_LISTEN)[number];
    if (!(CRM_LISTEN as readonly string[]).includes(l)) return null;
    return ((crm ?? await ladeCrm())[l] ?? []) as unknown as MitId[];
  }
  const d = DATEIEN_SPEICHER.exec(speicher);
  if (d) return ((await loadJson<{ eintraege: DateiEintrag[] }>(ablageName(d[1])))?.eintraege ?? []) as unknown as MitId[];
  if (speicher === 'tasks') return ((await loadJson<Tasks>('tasks'))?.tasks ?? []) as MitId[];
  return null;
}
type CrmBestandT = Awaited<ReturnType<typeof ladeCrm>>;

/**
 * Vorher-Stände zurückschreiben — je Speicher EINE Sperre mit erneuter Prüfung (hat inzwischen jemand geschrieben,
 * bleibt dieser Speicher unangetastet und steht in `konflikte`). Das CRM zuerst und als Ganzes (alle Listen in einer Sperre).
 */
export async function schnappschuesseZurueck(s: readonly Schnappschuss[], wer?: Wer): Promise<{ zurueck: number; konflikte: string[] }> {
  let zurueck = 0;
  const konflikte: string[] = [];
  const gruppen = nachSpeicher(s);
  const crmTeile = Array.from(gruppen).filter(([k]) => k.startsWith('crm:'));
  if (crmTeile.length) {
    let passt = true;
    await aendereCrm(c => {
      for (const [k, x] of crmTeile) if (schnappschussKonflikte(x, (c[k.slice(4) as (typeof CRM_LISTEN)[number]] ?? []) as unknown as MitId[]).length) passt = false;
      if (!passt) return c;
      const neu = { ...c } as Record<string, unknown>;
      for (const [k, x] of crmTeile) { neu[k.slice(4)] = schnappschuesseAnwenden((c[k.slice(4) as (typeof CRM_LISTEN)[number]] ?? []) as unknown as MitId[], x); zurueck += x.length; }
      return neu as unknown as CrmBestandT;
    }, wer);
    if (!passt) konflikte.push('crm');
  }
  for (const [k, x] of Array.from(gruppen)) {
    if (k.startsWith('crm:')) continue;
    const d = DATEIEN_SPEICHER.exec(k);
    const name = d ? ablageName(d[1]) : k === 'tasks' ? 'tasks' : null;
    if (!name) { konflikte.push(k); continue; }
    const feld = d ? 'eintraege' : 'tasks';
    let passt = true;
    await updateJson<Record<string, unknown>>(name, cur => {
      const f = cur ?? {};
      const liste = (Array.isArray(f[feld]) ? f[feld] : []) as MitId[];
      if (schnappschussKonflikte(x, liste).length) { passt = false; return f; }
      zurueck += x.length;
      return { ...f, [feld]: schnappschuesseAnwenden(liste, x) };
    });
    if (!passt) konflikte.push(k);
  }
  return { zurueck, konflikte };
}

/** Kurz gerechnet, damit die Oberfläche vor dem Zusammenführen zeigen kann, was wandert: Dateien der Person (alle Haushalte). */
export async function dateienDerPerson(id: string): Promise<number> {
  let n = 0;
  for (const h of await ablageHaushalte()) n += ((await loadJson<{ eintraege: DateiEintrag[] }>(ablageName(h)))?.eintraege ?? []).filter(e => e.kontaktId === id).length;
  return n;
}
