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

import type { Aenderung, Einheit, FinanzDaten, Zeile } from '@/lib/finanzen/rechenkern';
import type { Steuern } from '@/lib/finanzen/steuern';
import { HAND_FELDER, zelleTeile } from '@/lib/finanzen/handwerte';
import { lies } from './operationen';
import { darlehenBusinessAenderbar, darlehenFuerBusiness } from '@/lib/finanzen/darlehen';

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

/** Business = nur die Gesellschaften (seit 05.10. ohne die Selbstständigkeit — sie gehört zu Privat). */
const BUSINESS_EINHEITEN: Einheit[] = ['ug', 'kdv'];
const istBusinessEinheit = (e: unknown): boolean => typeof e === 'string' && (BUSINESS_EINHEITEN as string[]).includes(e);

/** Planzeilen, die zum Business gehören (Sachkosten der Gesellschaften — die der Selbstständigkeit sind seit 05.10. privat). */
const businessZeilen = (d: Pick<FinanzDaten, 'sachkosten'>): Set<string> => new Set(d.sachkosten.filter(z => istBusinessEinheit(z.einheit)).map(z => z.id));

/**
 * Ist eine Zeilen-/Wert-Kennung Business? Gerechnete Werte nach ihrem Ort (lib/finanzen/handwerte.ts), Planzeilen nach ihrer Liste.
 * Unbekannt = privat (sicher ist sicher).
 */
export function kennungIstBusiness(id: string, d: Pick<FinanzDaten, 'sachkosten'>): boolean {
  const f = HAND_FELDER[id];
  if (f) return f.ort === 'ug' || f.ort === 'kdv';   // kdc.* und ab.* (Selbstständigkeit, Abschluss) sind seit 05.10. privat
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
/** Bausteine der Gesellschaften (MAKE, KD Ventures) — private und die der Selbstständigkeit fallen weg. */
const BUSINESS_BAUSTEIN = (e: unknown): boolean => e === 'ug' || e === 'kdv';
/** Steuerprofile nur der Gesellschaften (Privat und Selbstständigkeit fallen weg); leer → undefined. */
function nurBusinessSteuern(st: Steuern | undefined): Steuern | undefined {
  if (!st) return undefined;
  const { privat: _p, kdc: _k, ...rest } = st;
  return Object.keys(rest).length ? rest : undefined;
}
const istObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Ziele, die nur Business messen (MAKE frei, Partnerdarlehen) — „Privat angespart“ und „Gruppe“ enthalten Privat. */
const ZIEL_QUELLEN_BUSINESS = ['ug.frei', 'kdv.bjoern'];

/**
 * Das Dokument für die Business-Sicht: alles Private entfernt, Business vollständig (Rechnung der Gesellschaften unverändert).
 * Rein — der Aufrufer bekommt eine neue Struktur, das Original bleibt.
 */
export function businessSicht(d: FinanzDaten): FinanzDaten {
  const protokoll = d.protokoll.filter(p => typeof p.pfad === 'string' && pfadIstBusiness(p.pfad, d));
  // Ampel-Schwellen sind gemeinsam mit Privat (Luft, Notgroschen) — nicht in der Business-Sicht; Steuern und Darlehen nur gefiltert.
  const { schwellen: _schwellen, steuern: _steuern, darlehen: _darlehen, ...rest } = d;
  const steuern = nurBusinessSteuern(d.steuern);
  const darlehen = (d.darlehen ?? []).map(darlehenFuerBusiness).filter((l): l is NonNullable<typeof l> => !!l);
  return {
    ...rest,
    ...(steuern ? { steuern } : {}),
    ...(darlehen.length ? { darlehen } : {}),
    selbst: { ...SELBST_LEER, posten: [] },
    // Einstellung je Bereich: nur der Business-Bereich bleibt.
    ...(d.bereiche ? { bereiche: d.bereiche.business ? { business: d.bereiche.business } : {} } : {}),
    planszenarien: (d.planszenarien ?? []).map(ps => {
      // Steuer auf die Ausschüttung und Entnahme der Selbstständigkeit wirken nur privat; Steuer-Überlagerung nur der Gesellschaften.
      const { ausschuettungSteuer: _privat, entnahme: _entnahme, steuern: stn, ...annahmen } = ps.annahmen;
      const st = nurBusinessSteuern(stn);
      return { ...ps, bausteine: ps.bausteine.filter(b => BUSINESS_BAUSTEIN(b.einheit)), annahmen: { ...annahmen, ...(st ? { steuern: st } : {}) } };
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
export const PRIVAT_KENNZAHLEN = ['privatLuftMin', 'privatKumDez28', 'privatAngespartDez27', 'gruppeDez28', 'runwayPrivat', 'privatLuftOkt', 'kdcFreiDez28'] as const;
export function kennzahlenFuerSicht<T extends Record<string, unknown>>(k: T, sicht: PlanSicht): T {
  if (sicht !== 'business') return k;
  const raus: Record<string, unknown> = {};
  // Seit 05.10. gehört die Selbstständigkeit (kdc) zu Privat — ihre Kennzahlen fallen in der Business-Sicht ebenso weg.
  for (const [s, v] of Object.entries(k)) if (!(PRIVAT_KENNZAHLEN as readonly string[]).includes(s) && !/privat|kdc|selbst|gruppe/i.test(s)) raus[s] = v;
  return raus as T;
}

const teileVon = (pfad: string): string[] => (typeof pfad === 'string' && pfad.startsWith('/') ? pfad.slice(1).split('/') : []);
/** Listenelement über `id=…` finden. */
const finde = <T extends { id: string }>(liste: T[] | undefined, teil: string | undefined): T | undefined => (teil?.startsWith('id=') ? (liste ?? []).find(x => x.id === teil.slice(3)) : undefined);

/** Bereiche, die nur Privat sind — in der Business-Sicht weder lesbar noch schreibbar. */
const NUR_PRIVAT = new Set(['privatEinnahmen', 'privatBudget', 'privatSchulden', 'check', 'fokus', 'abschluesse', 'regeln', 'schwellen', 'selbst']);

/**
 * Darf ein Pfad in der Business-Sicht geändert werden? Geprüft gegen das gespeicherte Dokument (bestehende Einträge) und den neuen Wert
 * (angehängte/ersetzte Einträge). Liefert null (erlaubt) oder den Grund.
 */
export function businessPfadErlaubt(pfad: string, d: FinanzDaten, neu?: unknown): string | null {
  const t = teileVon(pfad);
  const b = t[0];
  if (!b) return 'Pfad unbrauchbar.';
  if (NUR_PRIVAT.has(b)) return `„${b}“ gehört zu Privat.`;
  const neuObj = neu && typeof neu === 'object' && !Array.isArray(neu) ? (neu as Record<string, unknown>) : null;
  const neuEinheit = neuObj ? (neuObj.einheit ?? neuObj.e) : undefined;
  switch (b) {
    case 'plan': case 'ist': case 'notizen': case 'meta':
      return t.length === 2 && schluesselIstBusiness(t[1], d) ? null : 'Diese Zelle gehört zu Privat.';
    case 'annahmen':
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
      if (t[2] === 'ereignisse') {
        const e = finde(finde(d.szenarien, t[1])?.ereignisse, t[3]);
        if (e?.einheit === 'privat') return 'Privates Ereignis.';
        if (t[3] === '-' && neuEinheit === 'privat') return 'Privates Ereignis.';
        if (t[4] === 'einheit' && neu === 'privat') return 'Privates Ereignis.';
        if (t.length === 3) return 'Ereignisse ganz ersetzen geht nur in der Privat-Sicht.';
      }
      return null;
    }
    case 'planszenarien': {
      const ps = finde(d.planszenarien, t[1]);
      if (t[2] === 'annahmen' && t[3] === 'ausschuettungSteuer') return 'Die Steuer auf die Ausschüttung gehört zu Privat.';
      if (t[2] === 'annahmen' && t[3] === 'entnahme') return 'Die Entnahme der Selbstständigkeit gehört zu Privat.';
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
      if (t.length === 2 && t[1] !== '-') return 'Ein Planszenario ganz ersetzen geht nur in der Privat-Sicht.';
      if (t[1] === '-' && neuObj && Array.isArray(neuObj.bausteine) && (neuObj.bausteine as { einheit?: string }[]).some(x => privatB(x.einheit))) return 'Privater Baustein.';
      if (t[1] === '-' && neuObj && istObj(neuObj.annahmen) && ('entnahme' in neuObj.annahmen || 'ausschuettungSteuer' in neuObj.annahmen)) return 'Diese Annahme gehört zu Privat.';
      return null;
    }
    case 'steuern':
      return t[1] === 'privat' || t[1] === 'kdc' || t.length === 1 ? 'Diese Steuern gehören zu Privat (Privat und Selbstständigkeit).' : null;
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
    case 'aktiv': case 'arbeitsplan': case 'einstellungen':
      return null;
    default:
      return `„${b}“ ist in der Business-Sicht nicht änderbar.`;
  }
}

/** Ist ein (protokollierter) Pfad Business? — für das Protokoll der Business-Sicht. Ohne Pfad (ältere Einträge): nein. */
export function pfadIstBusiness(pfad: string, d: FinanzDaten): boolean {
  const t = teileVon(pfad);
  if (!t.length || NUR_PRIVAT.has(t[0])) return false;
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
export const protokollBusiness = (p: Aenderung, d: FinanzDaten): boolean => typeof p.pfad === 'string' && pfadIstBusiness(p.pfad, d);

/** Punkte aus „Was jetzt zu entscheiden ist“ / „Noch offen“, die Privat betreffen — die Business-Sicht zeigt sie nicht. */
export const PRIVATE_PUNKTE = new Set(['privat-minus', 'privat-runway', 'konten', 'netto', 'umsatz-kdc']);   // umsatz-kdc: die Selbstständigkeit gehört seit 05.10. zu Privat
export const nurBusinessPunkte = <T extends { id: string }>(liste: T[]): T[] => liste.filter(p => !PRIVATE_PUNKTE.has(p.id) && !p.id.startsWith('privat'));
/** Termine des Zahlungskalenders ohne Privat (Gehälter netto, Ausschüttung netto, private Raten …) und — seit 05.10. — ohne die Selbstständigkeit. */
export const nurBusinessTermine = <T extends { einheit: Einheit }>(liste: T[]): T[] => liste.filter(t => istBusinessEinheit(t.einheit));
