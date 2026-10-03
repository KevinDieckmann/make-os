// ─── Kalender — Business-Termine aus iCloud nach Google umziehen (Server, 03.10.2026) ─
// Kevin 03.10.: Business/MAKE gehört künftig in den Google Kalender der Person. Bestehende Business-Termine in iCloud
// ziehen NICHT automatisch um, sondern als eigene Aktion mit VORSCHAU und SICHERUNG:
//   1. Vorschau: je gewähltem iCloud-Kalender (Business, schreibbar, gehört der Person) was umzieht und was bleibt —
//      mit Grund (Serie, Gäste, Block/Fokus aus dem Planen, nicht änderbar, abgesagt). Nichts wird geschrieben.
//   2. Ausführen (nur mit ausdrücklichem Klick): ZUERST die Sicherung (der iCloud-Text jedes Termins, verschlüsselt, 30 Tage:
//      `kalender-umzug-sicherung--<person>`), dann je Termin: im Google Kalender anlegen (feste neue UID — idempotent),
//      Bezüge + CRM-Meetings + Follow-ups + Events/Teilnahmen/Buchungen auf die neue Kennung setzen, ERST DANN in iCloud
//      löschen. Bricht etwas ab, steht der Termin höchstens doppelt da (nie weg) — ein zweiter Lauf macht ihn fertig.
// Es zieht nur um, was die Person gewählt hat; nie Termine mit Gästen, nie Serien (dort fehlt die Gewähr, dass Google sie
// gleich abbildet — bitte in Apple/Google neu anlegen), nie Blöcke/Fokuszeit des Plans (sie gehören zur Planung).
// Zeitzone: Zeit und Dauer bleiben (Berliner Wandzeit).

import { createHash } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { ladeStand, termineImZeitraum, findeObjekt, anlegen, loeschen, verbunden, HOLEN_BIS, type IcloudStand } from '../icloud';
import { ladeEinstellungen, wemGehoert, spaceVonKalender } from '../einstellungen';
import { objektSchluessel, schluesselTeile } from '../bezug';
import { ladeBezuege, bezuegeUmhaengen } from '../bezug-server';
import { arbeitsortAusTitel } from '../arten';
import { tagPlus } from '../zeit';
import { localDay } from '@/lib/zeit';
import { googleKalenderNamen } from './namen';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { aendereCrm } from '@/lib/crm/speicher';
import { aendereBuchungBestand } from '../buchung-speicher';
import { protokolliere, type Wer as ProtokollWer } from '@/lib/store/aenderungsprotokoll';
import type { Kontakt } from '@/lib/make-one/crm';

export const sicherungName = (person: string) => `kalender-umzug-sicherung--${person}`;
/** So viele Tage hebt MAKE OS die Sicherung auf (danach räumt der Takt sie weg). */
export const SICHERUNG_TAGE = 30;
/** Höchstens so viele Termine je Lauf (der Rest folgt im nächsten Klick). */
export const UMZUG_MAX = 300;

export interface UmzugTermin { schluessel: string; uid: string; titel: string; start: string; ende: string; ganztags: boolean; kalender: string }
export interface UmzugBleibt extends UmzugTermin { grund: string }
export interface UmzugQuelle { name: string; business: boolean; umzieht: number; bleibt: number }
export interface UmzugVorschau {
  /** Zielkalender bei Google. */
  ziel: string | null;
  /** Alle iCloud-Kalender, aus denen man wählen kann (schreibbar, der Person oder nicht zugeordnet). */
  quellen: UmzugQuelle[];
  umzieht: UmzugTermin[];
  bleibt: UmzugBleibt[];
  /** Mehr als `UMZUG_MAX`: so viele bleiben für den nächsten Klick. */
  uebrig: number;
  hinweis?: string;
}

/** Die neue, feste UID eines umgezogenen Termins — aus dem alten Schlüssel abgeleitet, damit ein zweiter Lauf nichts doppelt anlegt. */
export const neueUidFuer = (altSchluessel: string): string => `makeos-um-${createHash('sha256').update(altSchluessel).digest('hex').slice(0, 24)}`;

/** Grund, warum ein Termin NICHT umzieht — oder null. Rein. */
export function bleibtGrund(t: { serie: boolean; mitTeilnehmern: boolean; bearbeitbar: boolean; abgesagt?: boolean; art: string; kalenderSchreibbar: boolean }): string | null {
  if (t.abgesagt) return 'abgesagt';
  if (t.serie) return 'Serie — in Google neu anlegen';
  if (t.mitTeilnehmern) return 'hat Gäste — Einladungen ziehen nicht um';
  if (t.art === 'block' || t.art === 'fokus') return 'gehört zur Planung (Block/Fokuszeit) — bleibt in iCloud';
  if (!t.kalenderSchreibbar || !t.bearbeitbar) return 'in iCloud nicht änderbar';
  return null;
}

async function sicht(person: string): Promise<{ s: IcloudStand; einst: Awaited<ReturnType<typeof ladeEinstellungen>>; ziel: string | null }> {
  const [s, einst, namen] = await Promise.all([ladeStand(), ladeEinstellungen(), googleKalenderNamen()]);
  return { s, einst, ziel: namen[person] ?? null };
}

/**
 * Vorschau — schreibt nichts. `kalender` = die gewählten iCloud-Kalender (Namen); `mitVergangenen`: auch Termine der
 * letzten 90 Tage (Standard: ab heute).
 */
export async function umzugVorschau(person: string, o: { kalender?: readonly string[]; mitVergangenen?: boolean } = {}, heute = localDay()): Promise<UmzugVorschau> {
  return (await vorschauMit(person, o, heute)).vorschau;
}

async function vorschauMit(person: string, o: { kalender?: readonly string[]; mitVergangenen?: boolean }, heute: string) {
  const { s, einst, ziel } = await sicht(person);
  // Wählbar: iCloud-Kalender, schreibbar, der Person (oder nicht zugeordnet) — nie der private Kalender der anderen Person.
  const quellen = s.kalender.filter(k => !k.quelle && k.schreibbar && wemGehoert(einst, k.name) === person);
  const auswahl = new Set((o.kalender ?? []).map(n => n.trim().toLowerCase()));
  const gewaehlt = quellen.filter(k => auswahl.has(k.name.trim().toLowerCase()));
  const von = o.mitVergangenen ? tagPlus(heute, -90) : heute;
  const bis = tagPlus(heute, HOLEN_BIS);
  const alle = gewaehlt.length ? termineImZeitraum(s, von, bis).filter(t => gewaehlt.some(k => k.id === t.kalenderId)) : [];
  const umzieht: UmzugTermin[] = [], bleibt: UmzugBleibt[] = [];
  for (const t of alle) {
    const kal = s.kalender.find(k => k.id === t.kalenderId);
    const eintrag: UmzugTermin = { schluessel: objektSchluessel(t), uid: t.uid, titel: t.titel, start: t.start, ende: t.ende, ganztags: t.ganztags, kalender: t.kalender };
    const grund = bleibtGrund({ serie: t.serie, mitTeilnehmern: t.mitTeilnehmern, bearbeitbar: t.bearbeitbar, abgesagt: !!t.abgesagt, art: t.art, kalenderSchreibbar: !!kal?.schreibbar });
    if (grund) bleibt.push({ ...eintrag, grund }); else umzieht.push(eintrag);
  }
  // Eine Serie steht mit allen Vorkommen in der Liste — je Objekt (Schlüssel) zählt sie einmal.
  const eindeutig = <T extends UmzugTermin>(l: T[]): T[] => Array.from(new Map(l.map(x => [x.schluessel, x] as const)).values());
  const u = eindeutig(umzieht), b = eindeutig(bleibt);
  const zaehl = (l: UmzugTermin[], name: string) => l.filter(x => x.kalender === name).length;
  const vorschau: UmzugVorschau = {
    ziel,
    quellen: quellen.map(k => ({ name: k.name, business: spaceVonKalender(einst, k.name) === 'business', umzieht: zaehl(u, k.name), bleibt: zaehl(b, k.name) })),
    umzieht: u.slice(0, UMZUG_MAX), bleibt: b, uebrig: Math.max(0, u.length - UMZUG_MAX),
    ...(ziel ? {} : { hinweis: 'Dein Google Kalender ist noch nicht verbunden — erst unter Kalender › Einstellungen › Google verbinden.' }),
  };
  return { vorschau, s, termine: new Map(alle.map(t => [objektSchluessel(t), t] as const)) };
}

// ── Sicherung ───────────────────────────────────────────────────────────────

interface SicherungsBestand { eintraege: Record<string, { ics: string; kalender: string; am: string }> }

async function sichern(person: string, s: IcloudStand, termine: readonly UmzugTermin[], jetzt: Date): Promise<void> {
  const rein: Record<string, { ics: string; kalender: string; am: string }> = {};
  for (const t of termine) { const f = findeObjekt(s, t.schluessel); if (f) rein[t.schluessel] = { ics: f.obj.ics, kalender: t.kalender, am: jetzt.toISOString() }; }
  await updateJson<SicherungsBestand>(sicherungName(person), cur => ({ eintraege: { ...(cur?.eintraege ?? {}), ...rein } }));
}

/** Sicherungen älter als `SICHERUNG_TAGE` entfernen (Takt) — liefert die Zahl der entfernten. */
export async function sicherungAufraeumen(person: string, jetzt = Date.now()): Promise<number> {
  const b = await loadJson<SicherungsBestand>(sicherungName(person));
  if (!b?.eintraege) return 0;
  const grenze = jetzt - SICHERUNG_TAGE * 86_400_000;
  const behalten = Object.fromEntries(Object.entries(b.eintraege).filter(([, e]) => Date.parse(e.am) >= grenze));
  const weg = Object.keys(b.eintraege).length - Object.keys(behalten).length;
  if (weg) await updateJson<SicherungsBestand>(sicherungName(person), () => ({ eintraege: behalten }));
  return weg;
}

// ── Kennungen umhängen (alter → neuer Schlüssel) ────────────────────────────

/** Verweise auf einen Termin in CRM, Kartei und Buchungen vom alten auf den neuen Schlüssel setzen. Idempotent, nur Kennungen. */
export async function verweiseUmhaengen(paare: readonly (readonly [string, string])[], wer: ProtokollWer): Promise<void> {
  if (!paare.length) return;
  const karte = new Map(paare.map(([a, n]) => [a, n] as const));
  // Auch die alte nackte UID (ohne Kalender) gilt als Verweis auf genau diesen Termin.
  const nach = (v: string | undefined): string | undefined => (v ? karte.get(v) ?? karte.get(schluesselTeile(v).uid) : undefined);
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    let n = 0;
    const kontakte = (f.kontakte ?? []).map(k => {
      if (!(k.aktivitaeten ?? []).some(a => nach(a.terminUid))) return k;
      return { ...k, aktivitaeten: (k.aktivitaeten ?? []).map(a => { const x = nach(a.terminUid); if (!x) return a; n++; return { ...a, terminUid: x }; }) };
    });
    return n ? { ...f, kontakte } : f;
  }, wer);
  await aendereCrm(c => ({
    ...c,
    followups: (c.followups ?? []).map(f => { const x = nach(f.terminUid); return x ? { ...f, terminUid: x } : f; }),
    // Netzwerken (03.10.): die Angabe an der Teilnahme trägt den Schlüssel des Termins (Link „Termin öffnen“), auch in den früheren Begegnungen.
    teilnahmen: (c.teilnahmen ?? []).map(t => {
      const a = t.netzwerken;
      if (!a) return t;
      const x = nach(a.terminId);
      const vorher = a.vorher?.some(v => nach(v.terminId)) ? a.vorher.map(v => { const y = nach(v.terminId); return y ? { ...v, terminId: y } : v; }) : a.vorher;
      return x || vorher !== a.vorher ? { ...t, netzwerken: { ...a, ...(x ? { terminId: x } : {}), ...(vorher ? { vorher } : {}) } } : t;
    }),
    // Events und Familie verweisen mit der UID (`kalenderUid`) — die feste UID des Spiegels bleibt nicht erhalten (siehe oben): neue UID eintragen.
    events: (c.events ?? []).map(e => { const x = nach(e.kalenderUid); return x ? { ...e, kalenderUid: schluesselTeile(x).uid } : e; }),
  }), wer);
  const gebucht = (v: string | undefined) => !!v && !!nach(v);
  await aendereBuchungBestand(b => (b.buchungen.some(x => gebucht(x.terminUid))
    ? { ...b, buchungen: b.buchungen.map(x => { const y = nach(x.terminUid); return y ? { ...x, terminUid: y, terminKalender: undefined } : x; }) }
    : b)).catch(() => { /* ohne Buchungen nichts zu tun */ });
}

// ── Ausführen ───────────────────────────────────────────────────────────────

export interface UmzugErgebnis { umgezogen: number; schonDa: number; fehler: { schluessel: string; grund: string }[]; uebrig: number; vorschau: Pick<UmzugVorschau, 'ziel'> }

export async function umzugAusfuehren(person: string, o: { kalender: readonly string[]; mitVergangenen?: boolean }, wer: ProtokollWer, jetzt = new Date()): Promise<UmzugErgebnis> {
  if (!verbunden()) throw new Error('iCloud ist nicht verbunden — ohne iCloud gibt es nichts umzuziehen.');
  const { vorschau: v, s, termine } = await vorschauMit(person, o, localDay(jetzt));
  if (!v.ziel) throw new Error('Dein Google Kalender ist noch nicht verbunden.');
  const liste = v.umzieht;
  // 1. Sicherung ZUERST — vor dem ersten Schreiben.
  await sichern(person, s, liste, jetzt);
  const bezuege = await ladeBezuege().catch(() => null);
  let umgezogen = 0, schonDa = 0;
  const fehler: { schluessel: string; grund: string }[] = [];
  for (const t of liste) {
    try {
      const f = findeObjekt(s, t.schluessel);
      const quelle = termine.get(t.schluessel);
      if (!f || !quelle) { fehler.push({ schluessel: t.schluessel, grund: 'nicht mehr in iCloud' }); continue; }
      const r = await anlegen({
        uid: neueUidFuer(t.schluessel), kalender: v.ziel, titel: quelle.titel, start: quelle.start, ende: quelle.ende, ganztags: quelle.ganztags,
        ...(quelle.ort ? { ort: quelle.ort } : {}), ...(quelle.notiz ? { notiz: quelle.notiz } : {}),
        art: quelle.art, ...(quelle.farbeId ? { farbe: quelle.farbeId } : {}), beschaeftigt: quelle.beschaeftigt, sichtbarkeit: quelle.sichtbarkeit,
        erinnerungenMin: quelle.erinnerungen ?? [], ...(quelle.art === 'arbeitsort' ? { arbeitsort: arbeitsortAusTitel(quelle.titel) } : {}),
      });
      if (r.schonDa) schonDa++;
      // 2. Verweise: der Bezug-Eintrag zieht mit (unter dem Schlüssel oder der alten nackten UID), dann CRM/Buchungen.
      const altBezug = [t.schluessel, t.uid].find(k => bezuege?.bezuege[k]);
      if (altBezug) await bezuegeUmhaengen([[altBezug, r.schluessel]]);
      await verweiseUmhaengen([[t.schluessel, r.schluessel], ...(f.eindeutig ? [[t.uid, r.schluessel] as const] : [])], wer);
      // 3. ERST jetzt in iCloud löschen — und protokollieren (Schlüssel, nie Titel).
      await loeschen(t.schluessel);
      await protokolliere('kalender', [{ liste: 'umzug', op: 'geaendert', id: r.schluessel, felder: ['iCloud-nach-Google'] }], wer).catch(() => { /* Protokoll darf den Umzug nicht stoppen */ });
      umgezogen++;
    } catch (e) {
      fehler.push({ schluessel: t.schluessel, grund: e instanceof Error ? e.message.slice(0, 160) : 'nicht umgezogen' });
    }
  }
  return { umgezogen, schonDa, fehler, uebrig: v.uebrig, vorschau: { ziel: v.ziel } };
}
