// ─── Heute & Glocke: was ansteht — Server (K6a, 29.09.) ───────────────────────
// Liest die vorhandenen Quellen (nie Kopien, nie ein Netzaufruf) und rechnet über lib/heute/anstehend.ts:
//   Termine          `termineLesen` (gespeicherter iCloud- bzw. Mac-Stand, Bezüge) → `maskieren` für die Person
//   Nachbereitung    Kartei über `kontakteFuerVerarbeitung` (Art. 18 fehlt) + Meeting-Zeiten aus denselben Terminen
//   Fristen          `fristenLesen` (lib/kalender/fristen-server.ts — dieselbe Stelle wie die Fristen-Ebene im Kalender)
//   Follow-ups       `faellige` (lib/crm/followup.ts)
//   Buchungen        `ladeBuchungBestand` (nur lesen, eigene Seiten, Status „angefragt“)
//   ZOE-Vorschläge   `lies('offen')` aus dem Stapel (Zahl, Art „kalender“)
//   Geburtstage      `geburtstageIm` (Familie + CRM, eine Stelle je Person)
// Genutzt von GET /api/heute/anstehend (Heute) und lib/meldungen/speicher.ts (Glocke). Wirft nie — eine Quelle, die
// fehlt, fehlt einfach. Konto „nur Business“ (Nachprüfung 18.10., N1-Rest): IMMER die Business-Sicht (`anstehendFuerSpace`) — vorher kam ein
// Termin aus dem Kalender „Privat“ mit Titel an (wie im Fluss), dazu Privat-Fristen und Geburtstage aus der Familie.

import { speicherStand } from '@/lib/store/local-db';
import { ladeEinstellungen } from '@/lib/kalender/einstellungen';
import { spaceVonKalender } from '@/lib/kalender/space';
import { termineLesen } from '@/lib/kalender/termine-lesen';
import { maskieren } from '@/lib/kalender/bezug';
import { wandzeit, tagPlus, tagVon } from '@/lib/kalender/zeit';
import { fristenLesen } from '@/lib/kalender/fristen-server';
import { geburtstageIm } from '@/lib/kalender/quellen-geburtstage-server';
import { kontakteFuerVerarbeitung, eingeschraenkteKennungen } from '@/lib/crm/verarbeitung';
import { ladeCrm } from '@/lib/crm/speicher';
import { faellige } from '@/lib/crm/followup';
import { nachbereitung } from '@/lib/crm/erfassen';
import { zeitenAus } from '@/lib/crm/aktivitaeten';
import { haeltBeziehung, BEIDE } from '@/lib/crm/team';
import { dankeZeilen, dankeOffen } from '@/lib/crm/netzwerken';
import { eventsOhneTermin } from '@/lib/crm/besuche';
import { WEG } from '@/lib/wege';
import {
  termineHeute, fristenAnstehend, followupsAnstehend, nachbereitenAnstehend, geburtstageVorlauf, anstehendFuerSpace, laufzeitAnstehend, type Anstehend, type ABuchung, type ADanke, type AVorschlaege,
} from './anstehend';
import { privatAusgeblendetFuer } from '@/lib/zugang/konto-sicht-server';

const sicher = async <T>(p: Promise<T>, sonst: T): Promise<T> => { try { return await p; } catch { return sonst; } };

/**
 * Offene Buchungsanfragen der eigenen Seiten (Status „angefragt“ — „vorläufig“ wartet noch auf den Gast). Dazu (R2-1 Fund 5, 02.11.): wer die Arbeit
 * steuern darf (`darfSteuern`), sieht ab der 24-h-Erinnerung (`lange`) auch die Anfragen der Seiten ANDERER — gekennzeichnet `fremd` (die Glocke
 * spricht dann neutral von „einer Entscheidung“). Nur Titel der Seite und Zeit, nie der Gast. Nur Business (Privat leert `buchungen`).
 */
async function buchungenLesen(person: string, jetzt = new Date()): Promise<ABuchung[]> {
  const [{ ladeBuchungBestand }, { anfrageWartet }, { darfSteuern }] = await Promise.all([import('@/lib/kalender/buchung-speicher'), import('@/lib/kalender/buchung'), import('@/lib/zugang/steuern')]);
  const b = await ladeBuchungBestand(jetzt);
  const alle = new Map(b.seiten.map(s => [s.id, s]));
  const steuert = await darfSteuern(person).catch(() => false);
  return b.buchungen.filter(x => x.status === 'angefragt' && alle.has(x.seiteId))
    .map(x => { const s = alle.get(x.seiteId)!, w = anfrageWartet(x.angefragtAm ?? x.statusAm, x.start, jetzt); return { x, s, w, fremd: s.person !== person }; })
    .filter(({ fremd, w }) => !fremd || (steuert && w.lange))
    .map(({ x, s, w, fremd }) => ({ id: x.id, titel: s.titel, start: x.start, href: '/os/kalender?buchungen=1', ...(w.lange ? { lange: true as const } : {}), ...(w.bald ? { bald: true as const } : {}), ...(fremd ? { fremd: true as const } : {}) }))
    .sort((a, c) => a.start.localeCompare(c.start));
}

/**
 * Offene ZOE-Vorschläge der Person: alle und die Kalender-Vorschläge — dieselbe Sichtregel wie der Stapel selbst
 * (`vorschlagSichtbar`, F2 M6): eigene und die des Systems, nie die der anderen Person.
 */
async function vorschlaegeZaehlen(person: string): Promise<AVorschlaege> {
  // EINE Konto-Sicht (09.10., E4): ein Konto „nur Business“ zählt keine Vorschläge des Systems aus dem Privat-Bereich (`vorschlaegeFuer`).
  const [{ vorschlaegeFuer }, { passtZurSicht }] = await Promise.all([import('@/lib/zoe/stapel'), import('@/lib/zoe/bereich')]);
  const offen = await vorschlaegeFuer(person, 'offen');
  const zahl = (l: typeof offen) => ({ gesamt: l.length, kalender: l.filter(v => v.bezug?.art === 'kalender' || v.gruppe === 'kalender').length });
   // Je Bereich (09.10. spät): Heute › Privat bzw. Business zählt die Vorschläge dieses Bereichs und die unklaren (`passtZurSicht`, wie der Stapel).
  return { ...zahl(offen), jeBereich: { privat: zahl(offen.filter(v => passtZurSicht(v, 'privat'))), business: zahl(offen.filter(v => passtZurSicht(v, 'business'))) } };
}

/**
 * Danke-Mails nach einem Event (Netzwerken, 02.10.): je Event die Zahl der noch nicht verschickten mit Adresse — ab dem Folgetag. Exportiert (24.10., Paket Ü 2):
 * EINE Rechnung auch für den Kern des überführten Event-Nachfassens (lib/crm/nachfassen-server.ts).
 */
export function dankeAnstehend(crm: { events: Parameters<typeof dankeZeilen>[0]['events']; teilnahmen: Parameters<typeof dankeZeilen>[0]['teilnahmen'] } | null, kontakte: Parameters<typeof dankeZeilen>[0]['kontakte'], heute: string, person: string): ADanke[] {
  if (!crm) return [];
  const zeilen = dankeZeilen({ events: crm.events, teilnahmen: crm.teilnahmen, kontakte, heute, person });
  const je = new Map<string, typeof zeilen>();
  for (const z of zeilen) je.set(z.event.id, [...(je.get(z.event.id) ?? []), z]);
  return Array.from(je.entries()).map(([id, l]) => ({ id: `danke-${id}`, n: dankeOffen(l), eventTitel: l[0].event.titel, href: WEG.netzwerken({ bericht: id }) })).filter(d => d.n > 0);
}

/**
 * Leads aus verlorenen Deals, deren Wiedervorlage erreicht ist (R2-1 Fund 6, 02.11.) — eine Zeile „Kundengewinnung“ mit der Zahl, an die Zuständige
 * des Leads (wie „Für dich“: besitzer = Person oder „beide“). Neutral, ohne Namen; die Kennung trägt die Zahl (neue → Glocke meldet sich neu).
 */
async function wiederDranLesen(kontakte: Parameters<typeof import('@/lib/crm/leads').leads>[0], crm: Parameters<typeof import('@/lib/crm/leads').leads>[1], heute: string, person: string): Promise<import('./anstehend').AMotor[]> {
  const { leads, ausVerlorenWiederDran, wiederDranSatz } = await import('@/lib/crm/leads');
  const n = leads(kontakte, crm, heute).filter(z => (z.besitzer === person || z.besitzer === BEIDE) && ausVerlorenWiederDran(z, heute)).length;
  return n ? [{ id: 'wieder', n, titel: `${wiederDranSatz(n)} — neu qualifizieren`, href: WEG.qualifizierung() }] : [];
}

/** Rückfall (4.8): ohne Liste der Eingeschränkten fallen alle echten Follow-ups weg, deren Person die verarbeitbare Kartei nicht kennt. */
function ohneSichtbareKennung(crm: { followups?: { kontaktId?: string }[] }, kontakte: readonly { id: string }[]): Set<string> {
  const da = new Set(kontakte.map(k => k.id));
  return new Set((crm.followups ?? []).map(f => f.kontaktId).filter((id): id is string => !!id && !da.has(id)));
}

/** Was für die Person ansteht (heute). */
export async function anstehendLesen(person: string, jetzt: Date = new Date()): Promise<Anstehend> {
  const jetztWand = wandzeit(jetzt), heute = tagVon(jetztWand);
  const einst = await sicher(ladeEinstellungen(), null);
  const vorlauf = einst?.kuendigungVorlaufTage ?? 14;
  // Unlesbarer Konten-Bestand → wie „nur Business“ (fail-closed, wie der Fluss).
  const nurBusiness = await sicher(privatAusgeblendetFuer(person), true);
  const [gelesen, kontakte, crm, fristen, buchungen, vorschlaege, geburtstage, ausgeblendet] = await Promise.all([
    einst ? sicher(termineLesen(einst, tagPlus(heute, -4), tagPlus(heute, 2)), null) : Promise.resolve(null),
    sicher(kontakteFuerVerarbeitung(), []),
    sicher(ladeCrm(), null),
    sicher(fristenLesen(heute, tagPlus(heute, Math.max(2, vorlauf + 1)), heute, person), []),
    sicher(buchungenLesen(person, jetzt), []),
    sicher(vorschlaegeZaehlen(person), { kalender: 0, gesamt: 0 }),
    // Ab heute; 61 Tage, damit ein längerer Vorlauf eines Wichtigen Tages (Familie, ≤ 60) greift — `geburtstageVorlauf` schneidet.
    sicher(geburtstageIm({ von: heute, bis: tagPlus(heute, 61) }, person), []),
    // 4.8 (08.10.): Follow-ups eingeschränkter Personen nie in Glocke/Heute — die verarbeitbare Kartei kennt sie nicht, also die Kennungen.
    // Scheitert das Lesen, zeigt die Liste lieber KEINE echten Follow-ups ohne bekannte Person (siehe unten), statt Namen zu verraten.
    sicher<Set<string> | null>(eingeschraenkteKennungen(), null),
  ]);
  const sicht = (gelesen?.termine ?? []).map(t => maskieren(t, person));
  const kalenderVon = new Map(sicht.map(t => [t.id, t.kalender]));
  const mitAufgabe = new Set((crm?.followups ?? []).filter(f => f.aufgabeId).map(f => f.id));
  const zeiten = zeitenAus(sicht);
  // N3 (F2): Zeiten nur für Meetings an Kontakten, deren Nachbereitung bei DIESER Person liegt (wie `nachbereitung` mit `person`).
  const eigene = kontakte.filter(k => { const f = haeltBeziehung(k); return f === person || f === BEIDE; });
  const verwiesen = new Set(eigene.flatMap(k => (k.aktivitaeten ?? []).filter(a => a.art === 'termin').map(a => a.terminUid).filter((x): x is string => !!x)));
  const a: Anstehend = {
    heute,
    // Bereich je Termin (10.10.): aus dem Kalender (Zuordnung der Kalender-Einstellungen) — die Sicht Privat · Business filtert damit.
    termine: termineHeute(sicht, person, heute, jetztWand).map(t => { const k = kalenderVon.get(t.id); return k ? { ...t, bereich: spaceVonKalender(einst, k) } : t; }),
    // M4 (F2): ein offenes Follow-up am selben Termin (`terminUid`) ist „in Arbeit“ — keine zweite Meldung.
    nachbereiten: nachbereitenAnstehend(nachbereitung(kontakte, heute, person, zeiten, jetztWand, crm?.followups)),
    nachbereitZeiten: Object.fromEntries(Object.entries(zeiten).filter(([k]) => verwiesen.has(k))),
    // Dazu (N5): besuchte Events, bei denen wir „angemeldet“ sind, aber noch kein Termin im Kalender steht — sonst fährt niemand hin, der es im Kalender sieht.
    fristen: [...fristenAnstehend(fristen, person, heute, vorlauf), ...(crm ? eventsOhneTermin(crm.events, heute, person).map(x => ({ id: `event-ohne-termin-${x.id}`, art: 'event' as const, tag: x.tag, titel: `Event „${x.titel}“: angemeldet, aber kein Termin im Kalender`, href: WEG.besuch(x.id), inTagen: x.inTagen, business: true as const })) : []),
      // 02.11. (Prüfung C): Mandate mit abgelaufener Laufzeit ohne Entscheidung — bis jemand verlängert oder beendet.
      ...(crm ? laufzeitAnstehend(crm.mandate, person, heute) : [])],
    followups: crm ? followupsAnstehend(faellige(kontakte, crm, heute, { horizont: 0, wertelisten: crm.wertelisten, ausgeblendet: ausgeblendet ?? ohneSichtbareKennung(crm, kontakte) }), person, mitAufgabe, zeiten) : [],
    buchungen,
    vorschlaege,
    geburtstage: geburtstageVorlauf(geburtstage, person, heute),
    danke: dankeAnstehend(crm, kontakte, heute, person),
    // Kundengewinnung (02.11., Prüfung D): Mail-Stapel, Druckliste, Homepage-Funde — an die Zuständige (lib/crm/motor-dran.ts), nur Business.
    motor: [...await sicher((await import('@/lib/crm/motor-dran-server')).motorDranLesen(person, crm), []), ...(crm ? await sicher(wiederDranLesen(kontakte, crm, heute, person), []) : [])],
  };
  return nurBusiness ? anstehendFuerSpace(a, 'business') : a;
}

/**
 * Stand aller Quellen für ETags (Glocke, Heute). Die Uhrzeit fließt in 10-Minuten-Schritten ein: „kommt gleich“ und
 * „vorbei“ ändern sich auch ohne neue Daten.
 */
export async function anstehendStand(jetzt: Date = new Date()): Promise<string> {
  const [{ buchungHaushalt }, { familieName }] = await Promise.all([import('@/lib/kalender/buchung-speicher'), import('@/lib/familie/speicher')]);
  const h = await sicher(buchungHaushalt(), '');
  // F2 N9: alle Quellen von `anstehendLesen` — Bauplan-Etappen (`backlog`), Steuer-Vorlage (`steuern`), Familie (Geburtstage,
  // Wichtige Tage mit Geschenk-Vorlauf) — sonst bliebe das ETag nach einer Änderung dort stehen.
  // 08.10.: Meilensteine an eigenen Zielen hängen an Konten (teilen) und Zielen — beide zählen mit.
  // 02.11. (Prüfung D): Mail-Stapel und Homepage-Funde (Steht an › Kundengewinnung).
  const motor = await sicher((await import('@/lib/crm/motor-dran-server')).motorDranBestaende(), [] as string[]);
  const namen = ['kalender-icloud', 'calendar-cache', 'kalender-bezug', 'kalender-einstellungen', 'crm', 'kontakte', 'finanzplan', 'meilensteine', 'ziele', 'konten', 'backlog', 'steuern', 'zoe-stapel', ...(h ? [`buchung--${h}`, familieName(h)] : []), ...motor];
  return `${wandzeit(jetzt).slice(0, 15)}:${await sicher(speicherStand(namen), '0')}`;
}
