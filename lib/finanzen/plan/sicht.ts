// ─── Finanzplanung — Sichten Privat und Business (rein, getestet) ─────────────────────────────────
// Kevin 04.10.: „Teile die Finanzplanung … einmal bei Privat, wo man das Ganze sehen kann, und einmal Business bei Business.
// Business ist bei Business sichtbar, kein Privat. Bei Privat kann man aber alles sehen, also auch die Firmen … Im Business-Bereich
// sieht man aber Privat nicht.“
//
// EINE Stelle für die Trennung: `businessSicht()` filtert das Plan-Dokument, BEVOR es den Server verlässt (GET /api/finanzplan
// ?sicht=business, auch die 409-Antwort), und `businessPfadErlaubt()` lehnt Schreibschritte auf private Teile ab (PATCH ?sicht=business
// → 403). So ist Privat nicht nur versteckt, sondern gar nicht ausgeliefert — die Business-Sicht kann später auch Teammitgliedern ohne
// Privatzugang gezeigt werden.
// 04.10. spät (Kevin: „im Business meine Planung haben … immer sehen können“): Die Sicht entscheidet der Server aus dem KONTO
// (`planZugangFuer` in lib/finanzen/haushalt/zugriff.ts, Feld `finanzRecht`), nie aus der Adresse. Der Haushalt des Inhabers sieht in
// beiden Bereichen alles; nur Konten mit `finanzRecht: 'business'` bekommen diese gefilterte Sicht. Die Adresse wählt nur den BEREICH
// (Privat/Business) mit eigenem Szenario, eigener Ansicht und eigenen Kennzahlen (`bereiche` im Dokument).
//
// Was privat ist: Privat-Zeilen (Einnahmen, Budget, Schulden), private Buchungen/Posten/Schulden/Ziele/Ereignisse, Wochen-Check,
// Entscheidung der Woche, Abschlüsse, Regeln (Empfänger aus dem Privatkonto), die Netto-Tabelle, die pauschale Steuer auf die
// Ausschüttung (wirkt nur privat), Ampel-Schwellen, alle Plan-/IST-/Notiz-/Meta-Schlüssel privater Zeilen und gerechneter Privat-
// und Gruppenwerte (`p.*`, `g.*`) und Protokolleinträge, die nicht sicher Business sind. Der Kern rechnet die Business-Zahlen ohne
// Privat genauso (MAKE und KD Ventures hängen nicht an Privat) — Test: tests/finanzplan-sicht.test.ts.
//
// 05.10. (Kevin: „Selbstständigkeit und Privat können zusammengeführt werden. Das wird am Ende ja auch zusammen gerechnet und besteuert. Somit
// wäre bei Business nur noch KD Ventures und MAKE Innovation GmbH.“): Die Selbstständigkeit ist PRIVAT — ihr Abschluss (`selbst`), ihre
// Sachkosten-Zeilen, Bausteine, Posten, Buchungen, Schulden, ihr Steuerprofil, die Entnahme-Regel und alle Werte `kdc.*`/`ab.*` gehen nie in die
// Business-Sicht. Darlehen mit privater Seite zeigt die Business-Sicht nur von der Gesellschaft aus (die private Seite heißt „außerhalb des Plans“).
//
// 02.11. (Kevin: „Selbstständigkeit komplett wieder ins Business … ESt bleibt gemeinsam privat“): Ob die Selbstständigkeit Business ist, entscheidet die
// Instanz (`selbstImBusiness()` aus lib/einheiten.ts, Variable `NEXT_PUBLIC_MAKE_OS_EINHEITEN`) — ohne Einstellung bit-gleich wie seit 05.10. Steht sie im
// Business, gehören ihre Werte `kdc.*`/`ab.*`, Sachkosten-Zeilen, Bausteine, Posten, Buchungen, Schulden, Darlehen, ihr Abschluss (Posten, Konto-Start) und
// ihr Steuerprofil (Gewerbesteuer, USt) zur Business-Sicht, die Entnahme-Regel ebenso (Abfluss aus dem Business). PRIVAT bleiben die gemeinsame
// Einkommensteuer (ESt-Zeile des Profils, Tarif, Veranlagung, Gehalt-Einbezug, Werte `kdc.est`/`kdc.soli`/`kdc.anrechnung`/`kdc.steuer`/
// `kdc.steuerRuecklage`/`kdc.verlustvortrag`, `ab.zve`/`ab.est`/`ab.frei`/`ab.nachConsors`), die Gehälter vor dem Plan, Vorsorge, Sonderausgaben,
// Sicherheit, Ablösung und die ESt-Vorauszahlungen. Die Business-Sicht rechnet die Achse deshalb OHNE Einkommensteuer (Zeile `est` aus).

import type { Aenderung, Einheit, FinanzDaten, Zeile } from '@/lib/finanzen/rechenkern';
import type { Steuern, Steuerprofil } from '@/lib/finanzen/steuern';
import { HAND_FELDER, zelleTeile } from '@/lib/finanzen/handwerte';
import { lies } from './operationen';
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { darlehenBusinessAenderbar, darlehenFuerBusiness } from '@/lib/finanzen/darlehen';
import { BUSINESS_GESELLSCHAFTEN, istBusinessGesellschaft, kernEinheitAus, selbstImBusiness } from '@/lib/einheiten';

export type PlanSicht = 'privat' | 'business';
export const PLAN_SICHTEN: PlanSicht[] = ['privat', 'business'];
/** Sicht aus der Anfrage: `?sicht=business` → Business, sonst die volle (Privat-)Sicht. Später: je Person erzwingbar. */
/** Bereich der Oberfläche aus der Adresse (`space=business` → Business, sonst Privat) — wählt NUR Szenario/Ansicht/Kennzahlen, nie die Daten. */
export type PlanBereich = 'privat' | 'business';
export const bereichAus = (wert: string | null | undefined): PlanBereich => (wert === 'business' ? 'business' : 'privat');

/**
 * Die Datensicht einer Anfrage (05.10., Kevin: „Bei Business kann ich niemals auf Privat gehen … Privat kann Business sehen, aufrufen und
 * bearbeiten, aber nicht umgekehrt.“): Business, wenn die Anfrage aus dem Business-Bereich kommt (`?sicht=business` — eine SICHT-Entscheidung,
 * gilt für jeden, auch den Inhaber) ODER das Konto kein Privat-Recht hat (`finanzRecht: 'business'` — eine RECHTE-Entscheidung, die keine
 * Adresse aufheben kann). Sonst die volle Sicht (Privat sieht alles, auch Business).
 */
export function wirksameSicht(recht: PlanSicht, anfrage: string | null | undefined): PlanSicht {
  return recht === 'business' || anfrage === 'business' ? 'business' : 'privat';
}

/**
 * Business = die Business-Gesellschaften der Instanz (lib/einheiten.ts `BUSINESS_GESELLSCHAFTEN`) in der Schreibweise des Kerns — die Selbstständigkeit
 * nur, wenn die Instanz sie ins Business stellt (02.11.; Vorgabe: Privat). Zusätzlich die Schreibweise der Bausteine/Darlehen (`kdc`).
 */
const SELBST = selbstImBusiness();
const BUSINESS_EINHEITEN: Einheit[] = BUSINESS_GESELLSCHAFTEN.map(kernEinheitAus).filter(e => SELBST || e !== 'selbststaendigkeit');
export const istBusinessEinheit = (e: unknown): boolean => typeof e === 'string' && ((BUSINESS_EINHEITEN as string[]).includes(e) || (SELBST && istBusinessGesellschaft(e)));
/** Steht die Selbstständigkeit in dieser Instanz im Business? (Oberflächen und Tests — eine Stelle.) */
export const selbstInBusinessSicht = (): boolean => SELBST;
/**
 * Werte der Selbstständigkeit, die auch mit ihr im Business PRIVAT bleiben — die gemeinsame Einkommensteuer und alles, was sie enthält
 * (Steuerzahlung/Rücklage = ESt + GewSt, Verlustvortrag der ESt, Abschluss nach ESt).
 */
export const SELBST_PRIVAT_WERTE: ReadonlySet<string> = new Set([
  'kdc.est', 'kdc.soli', 'kdc.anrechnung', 'kdc.steuer', 'kdc.steuerRuecklage', 'kdc.verlustvortrag', 'ab.zve', 'ab.est', 'ab.frei', 'ab.nachConsors',
]);

/** Planzeilen, die zum Business gehören (Sachkosten der Gesellschaften — die der Selbstständigkeit sind seit 05.10. privat). */
const businessZeilen = (d: Pick<FinanzDaten, 'sachkosten'>): Set<string> => new Set(d.sachkosten.filter(z => istBusinessEinheit(z.einheit)).map(z => z.id));

/**
 * Ist eine Zeilen-/Wert-Kennung Business? Gerechnete Werte nach ihrem Ort (lib/finanzen/handwerte.ts), Planzeilen nach ihrer Liste.
 * Unbekannt = privat (sicher ist sicher).
 */
export function kennungIstBusiness(id: string, d: Pick<FinanzDaten, 'sachkosten'>): boolean {
  const f = HAND_FELDER[id];
  if (f) {
    if (f.ort === 'ug' || f.ort === 'kdv') return true;
    // kdc.* und ab.* (Selbstständigkeit, Abschluss): seit 05.10. privat — Business nur, wenn die Instanz die Selbstständigkeit dorthin stellt (02.11.), ohne die ESt.
    return SELBST && (f.ort === 'kdc' || f.ort === 'abschluss') && !SELBST_PRIVAT_WERTE.has(id);
  }
  return businessZeilen(d).has(id);
}
/** Zellen-Schlüssel `<kennung>:<monat>` → Business? */
/** Zellen-Schlüssel `<kennung>:<monat>` oder `<kennung>@<szenario>:<monat>` (Handwert nur in einem Szenario) → Business? */
const schluesselIstBusiness = (k: string, d: Pick<FinanzDaten, 'sachkosten'>): boolean => { const t = zelleTeile(k); return !!t && kennungIstBusiness(t.id, d); };
const nurBusiness = <T>(o: Record<string, T>, d: Pick<FinanzDaten, 'sachkosten'>): Record<string, T> => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => schluesselIstBusiness(k, d)));

/** Die Netto-Tabelle (Brutto → Netto privat) ist privat — die Business-Sicht trägt den Platzhalter (rechenbar, ohne Wert). */
const NETTO_PLATZHALTER: [number, number][] = [[0, 0], [1, 1]];
/** Die Selbstständigkeit ist privat — die Business-Sicht trägt einen leeren Abschluss (rechenbar, ohne Wert). */
const SELBST_LEER: FinanzDaten['selbst'] = { posten: [], vorsorge: 0, sonderausgaben: 0, sicherheit: 0, darlehenAnUG: 0, consorsAbloesung: 0, kontoStart: 0 };
/** Bausteine der Business-Gesellschaften (MAKE, KD Ventures; die Selbstständigkeit nur im Business, 02.11.) — private fallen weg. */
export const BUSINESS_BAUSTEIN = (e: unknown): boolean => istBusinessGesellschaft(e);
/**
 * Das Steuerprofil der Selbstständigkeit für die Business-Sicht (02.11.): Rechtsform, Gewerbesteuer, USt und die Regeln der Gewerbesteuer —
 * die Einkommensteuer-Zeile ist aus (sie läuft gemeinsam unter Privat), Tarif/Veranlagung/Gehalt-Einbezug/Soli-Freigrenze/Anrechnung fehlen.
 */
export function selbstSteuernBusiness(p: Steuerprofil | undefined, estAus = true): Steuerprofil {
  const zeilen = { ...(p?.zeilen ?? {}) };
  delete zeilen.est; delete zeilen.soli;
  const pa = p?.param ?? {};
  const param = Object.fromEntries(Object.entries({ freibetrag: pa.freibetrag, zahlweise: pa.zahlweise, zahlMonat: pa.zahlMonat, verlustvortrag: pa.verlustvortrag }).filter(([, v]) => v !== undefined));
  // Das Profil des Plans schaltet die ESt aus; eine Szenario-Überlagerung trägt sie gar nicht (sonst schriebe ein im Business angelegtes Szenario „ESt aus“ für Privat).
  const z = estAus ? { ...zeilen, est: { an: false } } : zeilen;
  return { ...(p?.rechtsform ? { rechtsform: p.rechtsform } : {}), ...(Object.keys(z).length ? { zeilen: z } : {}), ...(Object.keys(param).length ? { param } : {}) };
}
/** Der private Rest dieses Profils (alles, was `selbstSteuernBusiness` weglässt) — für den Vergleich im Schreibweg. */
export function selbstSteuernPrivat(p: Steuerprofil | undefined): unknown {
  if (!p) return null;
  const { freibetrag: _f, zahlweise: _z, zahlMonat: _m, verlustvortrag: _v, ...param } = p.param ?? {};
  const r = { est: p.zeilen?.est ?? null, soli: p.zeilen?.soli ?? null, param };
  return r.est !== null || r.soli !== null || Object.keys(param).length > 0 ? r : null;   // nichts Privates = null (Anlegen im Business stört den Vergleich nicht)
}
/** Trägt ein Steuerprofil der Selbstständigkeit etwas von der gemeinsamen ESt? */
const selbstSteuernHatPrivates = (p: unknown): boolean => istObj(p) && selbstSteuernPrivat(p as Steuerprofil) !== null;
/** Steuerprofile nur der Business-Gesellschaften (Privat fällt weg; die Selbstständigkeit nur im Business und ohne ESt); leer → undefined. */
function nurBusinessSteuern(st: Steuern | undefined, plan = false): Steuern | undefined {
  if (!st && !plan) return undefined;
  const { privat: _p, kdc, ...rest } = st ?? {};
  const selbst = SELBST && (kdc || plan) ? selbstSteuernBusiness(kdc, plan) : undefined;
  const out: Steuern = { ...rest, ...(selbst && Object.keys(selbst).length ? { kdc: selbst } : {}) };
  return Object.keys(out).length ? out : undefined;
}
const istObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Ziele, die nur Business messen (MAKE frei, Partnerdarlehen) — „Privat angespart“ und „Gruppe“ enthalten Privat. */
export const ZIEL_QUELLEN_BUSINESS = ['ug.frei', 'kdv.bjoern'];

/**
 * Das Dokument für die Business-Sicht: alles Private entfernt, Business vollständig (Rechnung der Gesellschaften unverändert).
 * Rein — der Aufrufer bekommt eine neue Struktur, das Original bleibt.
 */
export function businessSicht(d: FinanzDaten): FinanzDaten {
  const protokoll = d.protokoll.filter(p => protokollBusiness(p, d));
  // Ampel-Schwellen sind gemeinsam mit Privat (Luft, Notgroschen) — nicht in der Business-Sicht; Steuern und Darlehen nur gefiltert.
  // Alte Handwerte (`handAlt`, nur Abschluss/Selbstständigkeit) sind privat; das Ist aus dem Konten-Register (`kontenIst`: Privat-Konten,
  // Selbstständigkeit, 08.10.) ebenso — die Business-Sicht trägt es nie.
  // Haushalt → Finanzplanung (31.10.): der Schalter und die Quelle (was aus dem Haushalt kommt) sind privat — die übernommenen Zeilen, Schulden und
  // Buchungen tragen Einheit privat und fallen unten mit den übrigen privaten weg.
  const { schwellen: _schwellen, steuern: _steuern, darlehen: _darlehen, handAlt: _handAlt, kontenIst: _kontenIst, haushaltBruecke: _hb, haushaltQuelle: _hq, ...rest } = d;
  // Mit der Selbstständigkeit im Business trägt die Sicht ihr Profil immer (ESt aus) — sonst rechnete die Achse die ESt mit der Vorgabe.
  const steuern = nurBusinessSteuern(d.steuern, true);
  const darlehen = (d.darlehen ?? []).map(darlehenFuerBusiness).filter((l): l is NonNullable<typeof l> => !!l);
  // 02.11.: Steht die Selbstständigkeit im Business, liest die Sicht ihr Ist aus dem Konten-Register („Kontostand heute“) — die Privat-Konten nie.
  const selbstIst = SELBST ? d.kontenIst?.selbststaendigkeit : undefined;
  return {
    ...rest,
    ...(steuern ? { steuern } : {}),
    ...(darlehen.length ? { darlehen } : {}),
    ...(selbstIst ? { kontenIst: { selbststaendigkeit: selbstIst } } : {}),
    // Mit der Selbstständigkeit im Business (02.11.): ihr Abschluss (Posten), Konto-Start und Darlehen an die GmbH bleiben — Vorsorge, Sonderausgaben,
    // Sicherheit, Ablösung, Gehälter vor dem Plan und ESt-Vorauszahlungen sind die gemeinsame ESt und bleiben privat.
    selbst: SELBST ? { ...SELBST_LEER, posten: d.selbst.posten, kontoStart: d.selbst.kontoStart, darlehenAnUG: d.selbst.darlehenAnUG } : { ...SELBST_LEER, posten: [] },
    // Einstellung je Bereich: nur der Business-Bereich bleibt.
    ...(d.bereiche ? { bereiche: d.bereiche.business ? { business: d.bereiche.business } : {} } : {}),
    planszenarien: (d.planszenarien ?? []).map(ps => {
      // Steuer auf die Ausschüttung und Entnahme der Selbstständigkeit wirken nur privat; Steuer-Überlagerung nur der Gesellschaften.
      // 02.11.: Mit der Selbstständigkeit im Business ist die Entnahme ein Abfluss aus dem Business (sichtbar, änderbar); ihre Steuer-Überlagerung ohne ESt.
      const { ausschuettungSteuer: _privat, entnahme, steuern: stn, ...annahmen } = ps.annahmen;
      const st = nurBusinessSteuern(stn);
      return { ...ps, bausteine: ps.bausteine.filter(b => BUSINESS_BAUSTEIN(b.einheit)), annahmen: { ...annahmen, ...(SELBST && entnahme !== undefined ? { entnahme } : {}), ...(st ? { steuern: st } : {}) } };
    }),
    schulden: d.schulden.filter(s => istBusinessEinheit(s.einheit)),
    meta: nurBusiness(d.meta, d),
    abschluesse: [],
    buchungen: d.buchungen.filter(b => istBusinessEinheit(b.e)),   // ohne Einheit = privat (wie im Kern)
    regeln: {},
    ziele: d.ziele.filter(z => z.einheit !== 'privat' && ZIEL_QUELLEN_BUSINESS.includes(z.quelle)),
    check: { punkte: [], eintraege: [] },
    notizen: nurBusiness(d.notizen, d),
    annahmen: { ...d.annahmen, nettoTabelle: NETTO_PLATZHALTER.map(p => [...p] as [number, number]) },
    sachkosten: d.sachkosten.filter(z => istBusinessEinheit(z.einheit)),
    privatEinnahmen: [], privatBudget: [], privatSchulden: [],
    szenarien: d.szenarien.map(s => ({ ...s, ereignisse: (s.ereignisse ?? []).filter(e => e.einheit !== 'privat') })),
    posten: d.posten.filter(p => istBusinessEinheit(p.einheit)),
    fokus: { saetze: [], regeln: [], schritte: [] },
    plan: nurBusiness(d.plan, d),
    ist: nurBusiness(d.ist, d),
    protokoll,
  };
}

/** Sicht anwenden (Privat = alles). */
export const fuerSicht = (d: FinanzDaten, sicht: PlanSicht): FinanzDaten => (sicht === 'business' ? businessSicht(d) : d);

/**
 * Verdichtete Kennzahlen (GET ?nur=kennzahlen) in der Business-Sicht (DSGVO-Prüfung 04.10.): vorher galt `?sicht=business` dort
 * nicht — die Antwort trug Privat-Luft, private Rücklage, Privat-Runway. Jetzt fallen alle privaten bzw. mit Privat gemischten
 * Werte weg (die Liste ist abschließend: unbekannt = bleibt nur, wenn sie nicht nach Privat klingt — Wächter im Test).
 */
export const PRIVAT_KENNZAHLEN = ['privatLuftMin', 'privatKumDez28', 'privatAngespartDez27', 'gruppeDez28', 'runwayPrivat', 'privatLuftOkt', ...(SELBST ? [] : ['kdcFreiDez28'])] as const;
export function kennzahlenFuerSicht<T extends Record<string, unknown>>(k: T, sicht: PlanSicht): T {
  if (sicht !== 'business') return k;
  const raus: Record<string, unknown> = {};
  // Seit 05.10. gehört die Selbstständigkeit (kdc) zu Privat — ihre Kennzahlen fallen in der Business-Sicht ebenso weg; steht sie im Business (02.11.), bleiben sie.
  const privatMuster = SELBST ? /privat|gruppe/i : /privat|kdc|selbst|gruppe/i;
  for (const [s, v] of Object.entries(k)) if (!(PRIVAT_KENNZAHLEN as readonly string[]).includes(s) && !privatMuster.test(s)) raus[s] = v;
  return raus as T;
}

const teileVon = (pfad: string): string[] => (typeof pfad === 'string' && pfad.startsWith('/') ? pfad.slice(1).split('/') : []);
/** Listenelement über `id=…` finden. */
const finde = <T extends { id: string }>(liste: T[] | undefined, teil: string | undefined): T | undefined => (teil?.startsWith('id=') ? (liste ?? []).find(x => x.id === teil.slice(3)) : undefined);

/** Bereiche, die nur Privat sind — in der Business-Sicht weder lesbar noch schreibbar. `selbst` nur, solange die Selbstständigkeit privat ist (02.11.). */
const NUR_PRIVAT = new Set(['privatEinnahmen', 'privatBudget', 'privatSchulden', 'check', 'fokus', 'abschluesse', 'regeln', 'schwellen', ...(SELBST ? [] : ['selbst']), 'handAlt', 'haushaltBruecke']);
/** Felder des Abschlusses der Selbstständigkeit, die mit ihr im Business änderbar sind (02.11.) — der Rest ist die gemeinsame ESt. */
const SELBST_BUSINESS_FELDER = new Set(['posten', 'kontoStart', 'darlehenAnUG']);
/** Regeln der Gewerbesteuer, die das Business für die Selbstständigkeit setzen darf (02.11.); Tarif, Veranlagung, Gehalt-Einbezug, Anrechnung, Soli = ESt. */
const SELBST_STEUER_PARAM = new Set(['freibetrag', 'zahlweise', 'zahlMonat', 'verlustvortrag']);
/** Darf die Business-Sicht diesen Teilpfad des Steuerprofils der Selbstständigkeit ändern? (`t` = Teile NACH `kdc`) */
function selbstSteuerPfadOk(t: string[]): boolean {
  if (!SELBST) return false;
  if (t[0] === 'rechtsform' && t.length === 1) return true;
  if (t[0] === 'zeilen' && (t[1] === 'gewst' || t[1] === 'ust') && t.length >= 2) return true;
  if (t[0] === 'param' && t.length === 2 && SELBST_STEUER_PARAM.has(t[1])) return true;
  return false;
}
/** Annahmen eines Planszenarios, die privat sind (wirken nur auf Privat bzw. die Selbstständigkeit). */
const PRIVATE_PS_ANNAHMEN = ['ausschuettungSteuer', ...(SELBST ? [] : ['entnahme'])];
/** Enthalten Szenario-Annahmen etwas Privates (Steuer auf die Ausschüttung, Entnahme, Steuerprofil Privat/Selbstständigkeit)? */
export const psAnnahmenPrivat = (a: unknown): boolean => istObj(a) && (PRIVATE_PS_ANNAHMEN.some(k => k in a)
  || (istObj(a.steuern) && ('privat' in a.steuern || ('kdc' in a.steuern && (!SELBST || selbstSteuernHatPrivates(a.steuern.kdc))))));

/**
 * Darf ein Pfad in der Business-Sicht geändert werden? Geprüft gegen das gespeicherte Dokument (bestehende Einträge) und den neuen Wert
 * (angehängte/ersetzte Einträge). Liefert null (erlaubt) oder den Grund.
 * Gegenprüfung 05.10. (Fund 4): Ganze Objekte/Listen, die Privates enthalten können (`/annahmen`, `/szenarien`, `/szenarien/id=…`,
 * `/planszenarien`, `/planszenarien/id=…`, `…/annahmen`, `/steuern`, jede ganze Liste), ersetzt die Business-Sicht NIE — sie kennt den privaten
 * Teil nicht und würde ihn überschreiben. Erlaubt sind Blattpfade und reine Business-Teilbäume. Wächter-Tabelle: tests/finanzplan-gegenpruefung.test.ts.
 * Zusätzlich prüft der Schreibweg nach dem Anwenden, dass sich am privaten Teil nichts geändert hat (`privatTeil`, lib/finanzen/plan/business-schreiben.ts).
 */
export function businessPfadErlaubt(pfad: string, d: FinanzDaten, neu?: unknown): string | null {
  const t = teileVon(pfad);
  const b = t[0];
  if (!b) return 'Pfad unbrauchbar.';
  if (NUR_PRIVAT.has(b)) return `„${b}“ gehört zu Privat.`;
  if (b === 'selbst') return t.length >= 2 && SELBST_BUSINESS_FELDER.has(t[1]) ? null : 'Das gehört zur gemeinsamen Einkommensteuer (Privat).';
  const neuObj = neu && typeof neu === 'object' && !Array.isArray(neu) ? (neu as Record<string, unknown>) : null;
  const neuEinheit = neuObj ? (neuObj.einheit ?? neuObj.e) : undefined;
  switch (b) {
    case 'plan': case 'ist': case 'notizen': case 'meta':
      return t.length === 2 && schluesselIstBusiness(t[1], d) ? null : 'Diese Zelle gehört zu Privat.';
    case 'annahmen':
      if (t.length === 1) return 'Die Annahmen ganz ersetzen geht nur in der Privat-Sicht (die Netto-Tabelle ist privat).';
      return t[1] === 'nettoTabelle' ? 'Die Netto-Tabelle gehört zu Privat.' : null;
    case 'sachkosten': {
      // Neue Zeilen ohne Einheit sind MAKE-Zeilen (wie im Kern); Privat und Selbstständigkeit gehören zu Privat.
      const privatE = (e: unknown) => e !== undefined && !istBusinessEinheit(e);
      if (t[1] === '-') return privatE(neuEinheit) ? 'Private Zeile.' : null;
      const z = finde(d.sachkosten, t[1]);
      if (z && !istBusinessEinheit(z.einheit)) return 'Private Zeile.';
      if (t.length === 2 && neuObj && privatE(neuEinheit)) return 'Private Zeile.';
      if (t[2] === 'einheit' && !istBusinessEinheit(neu)) return 'Private Zeile.';
      if (t.length === 1) return 'Die ganze Liste gehört auch zu Privat.';
      return null;
    }
    case 'szenarien': {
      // Ein Treiber trägt private Lebensereignisse — ganz ersetzen nie, löschen nur ohne private Ereignisse, neu nur ohne private.
      if (t.length === 1) return 'Die ganze Liste gehört auch zu Privat.';
      const privatE = (l: unknown) => Array.isArray(l) && l.some(e => istObj(e) && e.einheit === 'privat');
      if (t[1] === '-') return t.length === 2 && neuObj && privatE(neuObj.ereignisse) ? 'Privates Ereignis.' : null;
      if (t.length === 2) {
        if (neu !== undefined) return 'Einen Treiber ganz ersetzen geht nur in der Privat-Sicht.';
        return privatE(finde(d.szenarien, t[1])?.ereignisse) ? 'Dieser Treiber hat private Ereignisse — löschen nur in der Privat-Sicht.' : null;
      }
      if (t[2] === 'ereignisse') {
        const e = finde(finde(d.szenarien, t[1])?.ereignisse, t[3]);
        if (e?.einheit === 'privat') return 'Privates Ereignis.';
        if ((t[3] === '-' || t.length === 4) && neuEinheit === 'privat') return 'Privates Ereignis.';
        if (t[4] === 'einheit' && neu === 'privat') return 'Privates Ereignis.';
        if (t.length === 3) return 'Ereignisse ganz ersetzen geht nur in der Privat-Sicht.';
      }
      return null;
    }
    case 'planszenarien': {
      if (t.length === 1) return 'Die ganze Liste gehört auch zu Privat.';
      const ps = finde(d.planszenarien, t[1]);
      if (t.length === 2 && t[1] !== '-' && neu === undefined && ps && (ps.bausteine.some(x => !BUSINESS_BAUSTEIN(x.einheit) && x.einheit !== undefined) || psAnnahmenPrivat(ps.annahmen)))
        return 'Dieses Planszenario enthält Privates — löschen nur in der Privat-Sicht.';
      if (t[2] === 'annahmen' && t[3] === 'ausschuettungSteuer') return 'Die Steuer auf die Ausschüttung gehört zu Privat.';
      if (t[2] === 'annahmen' && t[3] === 'entnahme' && !SELBST) return 'Die Entnahme der Selbstständigkeit gehört zu Privat.';
      if (t[2] === 'annahmen' && t[3] === 'steuern' && t[4] === 'kdc' && t.length > 5 && selbstSteuerPfadOk(t.slice(5))) return null;
      if (t[2] === 'annahmen' && t[3] === 'steuern' && (t.length === 4 || t[4] === 'privat' || t[4] === 'kdc')) return 'Diese Steuern gehören zu Privat.';
      if (t[2] === 'annahmen' && t.length === 3) return 'Die Annahmen ganz ersetzen geht nur in der Privat-Sicht.';
      // Bausteine ohne Einheit liest der Säuberer als MAKE — sie sind Business; Privat und Selbstständigkeit nicht.
      const privatB = (e: unknown) => e !== undefined && !BUSINESS_BAUSTEIN(e);
      if (t[2] === 'bausteine') {
        const bs = finde(ps?.bausteine, t[3]);
        if (bs && !BUSINESS_BAUSTEIN(bs.einheit)) return 'Privater Baustein.';
        if (t[3] === '-' && privatB(neuEinheit)) return 'Privater Baustein.';
        if (t.length === 4 && t[3] !== '-' && neuObj && privatB(neuEinheit)) return 'Privater Baustein.';
        if (t[4] === 'einheit' && !BUSINESS_BAUSTEIN(neu)) return 'Privater Baustein.';
        if (t.length === 3) return 'Bausteine ganz ersetzen geht nur in der Privat-Sicht.';
      }
      if (t.length === 2 && t[1] !== '-' && neu !== undefined) return 'Ein Planszenario ganz ersetzen geht nur in der Privat-Sicht.';
      if (t[1] === '-' && neuObj && Array.isArray(neuObj.bausteine) && (neuObj.bausteine as { einheit?: string }[]).some(x => !istObj(x) || privatB(x.einheit))) return 'Privater Baustein.';
      // Neues Planszenario mit privaten Annahmen (Entnahme, Steuer auf die Ausschüttung, Steuerprofil Privat/Selbstständigkeit) → Privat.
      if (t[1] === '-' && neuObj && psAnnahmenPrivat(neuObj.annahmen)) return 'Diese Annahme gehört zu Privat.';
      if (t[1] === '-' && !neuObj) return 'Ein neues Planszenario ist ein Objekt.';
      return null;
    }
    case 'steuern':
      if (t[1] === 'kdc' && t.length > 2 && selbstSteuerPfadOk(t.slice(2))) return null;
      return t[1] === 'privat' || t[1] === 'kdc' || t.length === 1 ? 'Diese Steuern gehören zu Privat (Privat und die gemeinsame Einkommensteuer).' : null;
    case 'darlehen': {
      if (t.length === 1) return 'Die ganze Liste gehört auch zu Privat.';
      const l = finde(d.darlehen, t[1]);
      if (l && !darlehenBusinessAenderbar(l)) return 'Dieses Darlehen hat eine private Seite — ändern nur in der Privat-Sicht.';
      const seiten = (o: Record<string, unknown> | null) => !!o && darlehenBusinessAenderbar({ geber: o.geber as never, nehmer: o.nehmer as never });
      if ((t[1] === '-' || (t.length === 2 && neuObj)) && !seiten(neuObj)) return 'Ein Darlehen mit privater Seite gehört zu Privat.';
      if ((t[2] === 'geber' || t[2] === 'nehmer') && l && !darlehenBusinessAenderbar({ ...l, [t[2]]: neu as never })) return 'Ein Darlehen mit privater Seite gehört zu Privat.';
      if (t[1] !== '-' && !l) return 'Unbekanntes Darlehen.';
      return null;
    }
    case 'schulden': case 'posten': {
      const liste = (b === 'schulden' ? d.schulden : d.posten) as { id: string; einheit: Einheit }[];
      const x = finde(liste, t[1]);
      if (x && !istBusinessEinheit(x.einheit)) return 'Privater Eintrag.';
      if ((t[1] === '-' || (t.length === 2 && neuObj)) && !istBusinessEinheit(neuEinheit)) return 'Privater Eintrag.';
      if (t[2] === 'einheit' && !istBusinessEinheit(neu)) return 'Privater Eintrag.';
      if (t.length === 1) return 'Die ganze Liste gehört auch zu Privat.';
      return null;
    }
    case 'buchungen': {
      const x = finde(d.buchungen, t[1]);
      if (x && !istBusinessEinheit(x.e)) return 'Private Buchung.';
      if ((t[1] === '-' || (t.length === 2 && neuObj)) && !istBusinessEinheit(neuEinheit)) return 'Private Buchung.';
      if (t[2] === 'e' && !istBusinessEinheit(neu)) return 'Private Buchung.';
      if (t.length === 1) return 'Die ganze Liste gehört auch zu Privat.';
      return null;
    }
    case 'ziele': {
      const z = finde(d.ziele, t[1]);
      const ok = (q: unknown, e: unknown) => ZIEL_QUELLEN_BUSINESS.includes(String(q)) && e !== 'privat';
      if (z && !ok(z.quelle, z.einheit)) return 'Privates Ziel.';
      if ((t[1] === '-' || (t.length === 2 && neuObj)) && !ok(neuObj?.quelle, neuObj?.einheit)) return 'Privates Ziel.';
      if (t[2] === 'quelle' && !ZIEL_QUELLEN_BUSINESS.includes(String(neu))) return 'Diese Messgröße enthält Privat.';
      if (t[2] === 'einheit' && neu === 'privat') return 'Privates Ziel.';
      if (t.length === 1) return 'Die ganze Liste gehört auch zu Privat.';
      return null;
    }
    case 'bereiche':
      return t[1] === 'business' ? null : 'Die Einstellung des Privat-Bereichs gehört zu Privat.';
    // Gemeinsame Wahl (Kevin 05.10. spät: Business ändert NIE etwas, das Privat rechnet): das aktive Szenario fließt in die ESt aufs Gehalt
    // (lohnJahre), der gemeinsame Arbeitsplan gilt für Privat, solange Privat keinen eigenen hat. Business setzt seinen Plan nur über
    // /bereiche/business/arbeitsplan (die Oberfläche lenkt dorthin um). Erlaubt: die Reserve (nur Töpfe der GmbH, toepfeUG) und der
    // Stichtag „auf heute setzen“ — nur auf den echten heutigen Tag (Europe/Berlin).
    case 'aktiv': case 'arbeitsplan':
      return 'Gilt auch für Privat — im Business-Bereich wird das eigene Planszenario gesetzt.';
    case 'einstellungen':
      return t.length === 2 && (t[1] === 'reserveMonate' || (t[1] === 'heute' && neu === heuteBerlin())) ? null : 'Diese Einstellung gilt auch für Privat — bitte im Privat-Bereich ändern.';
    default:
      return `„${b}“ ist in der Business-Sicht nicht änderbar.`;
  }
}

/**
 * Ist ein (protokollierter) Pfad Business? — für das Protokoll der Business-Sicht. Ohne Pfad (ältere Einträge): nein.
 * Angehängte Einträge (`…/-`, Gegenprüfung 05.10., Fund 3): geprüft wird der NEUE Eintrag — `eintrag` (Kennung, schreibt der Server seit 05.10.
 * ins Protokoll) ersetzt das `-` durch `id=<eintrag>`, dann gelten Einheit/Bereich des Eintrags. Ohne Kennung (ältere Einträge) oder wenn der Eintrag
 * nicht mehr da ist: nein — vom Unbekannten weiß man nicht, ob es privat war (Name und Preis stehen im Protokoll).
 */
export function pfadIstBusiness(pfad: string, d: FinanzDaten, eintrag?: string): boolean {
  let t = teileVon(pfad);
  if (!t.length || NUR_PRIVAT.has(t[0])) return false;
  if (t.includes('-')) {
    if (typeof eintrag !== 'string' || !eintrag || t.indexOf('-') !== t.length - 1) return false;
    t = [...t.slice(0, -1), `id=${eintrag}`];
    pfad = `/${t.join('/')}`;
  }
  // Ganze Treiber/Planszenarien (angehängt oder ersetzt) sind gemischt — ihr Protokolltext kann private Ereignisse/Bausteine von damals tragen.
  if ((t[0] === 'szenarien' || t[0] === 'planszenarien') && t.length === 2) return false;
  // Jeder Listenschritt muss im Dokument noch auffindbar sein — von Gelöschtem weiß man nicht mehr sicher, ob es privat war.
  for (let i = 1; i < t.length; i++) if (t[i].startsWith('id=') && lies(d, t.slice(0, i + 1)) === undefined) return false;
  // Gelöschte Einträge kennt das Dokument nicht mehr — dann zählt nur der Bereich.
  if (t[0] === 'darlehen' && t[1]?.startsWith('id=')) { const l = finde(d.darlehen, t[1]); return !!l && darlehenBusinessAenderbar(l); }
  if (['schulden', 'posten', 'buchungen', 'ziele'].includes(t[0]) && t[1]?.startsWith('id=')) {
    const liste = (d as unknown as Record<string, { id: string; einheit?: string; e?: string; quelle?: string }[]>)[t[0]] ?? [];
    const x = liste.find(e => e.id === t[1].slice(3));
    if (!x) return false;
    if (t[0] === 'ziele') return ZIEL_QUELLEN_BUSINESS.includes(String(x.quelle)) && x.einheit !== 'privat';
    return istBusinessEinheit(t[0] === 'buchungen' ? x.e : x.einheit);
  }
  return businessPfadErlaubt(pfad, d) === null;
}

/** Ist eine Planzeile privat? (Oberfläche: Zeilenlisten in der Business-Sicht.) */
export const zeileIstPrivat = (z: Pick<Zeile, 'einheit'>): boolean => z.einheit === 'privat';
/** Protokoll-Eintrag der Business-Sicht? (für Tests und die Oberfläche) */
export const protokollBusiness = (p: Aenderung, d: FinanzDaten): boolean => typeof p.pfad === 'string' && pfadIstBusiness(p.pfad, d, p.eintrag);

/** Punkte aus „Was jetzt zu entscheiden ist“ / „Noch offen“, die Privat betreffen — die Business-Sicht zeigt sie nicht. */
// umsatz-kdc: die Selbstständigkeit gehört seit 05.10. zu Privat — steht sie im Business (02.11.), ist der Punkt Business.
export const PRIVATE_PUNKTE = new Set(['privat-minus', 'privat-runway', 'konten', 'netto', ...(SELBST ? [] : ['umsatz-kdc'])]);
export const nurBusinessPunkte = <T extends { id: string }>(liste: T[]): T[] => liste.filter(p => !PRIVATE_PUNKTE.has(p.id) && !p.id.startsWith('privat'));
/** Termine des Zahlungskalenders ohne Privat (Gehälter netto, Ausschüttung netto, private Raten …) und — seit 05.10. — ohne die Selbstständigkeit (außer sie steht im Business, 02.11.). */
export const nurBusinessTermine = <T extends { einheit: Einheit }>(liste: T[]): T[] => liste.filter(t => istBusinessEinheit(t.einheit));
