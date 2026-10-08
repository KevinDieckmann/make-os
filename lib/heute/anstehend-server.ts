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
// fehlt, fehlt einfach.

import { speicherStand } from '@/lib/store/local-db';
import { ladeEinstellungen } from '@/lib/kalender/einstellungen';
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
  termineHeute, fristenAnstehend, followupsAnstehend, nachbereitenAnstehend, geburtstageVorlauf, type Anstehend, type ABuchung, type ADanke,
} from './anstehend';

const sicher = async <T>(p: Promise<T>, sonst: T): Promise<T> => { try { return await p; } catch { return sonst; } };

/** Offene Buchungsanfragen der eigenen Seiten (Status „angefragt“ — „vorläufig“ wartet noch auf den Gast). */
async function buchungenLesen(person: string): Promise<ABuchung[]> {
  const { ladeBuchungBestand } = await import('@/lib/kalender/buchung-speicher');
  const b = await ladeBuchungBestand();
  const seiten = new Map(b.seiten.filter(s => s.person === person).map(s => [s.id, s]));
  return b.buchungen.filter(x => x.status === 'angefragt' && seiten.has(x.seiteId))
    .map(x => ({ id: x.id, titel: seiten.get(x.seiteId)!.titel, start: x.start, href: '/os/kalender?buchungen=1' }))
    .sort((a, c) => a.start.localeCompare(c.start));
}

/**
 * Offene ZOE-Vorschläge der Person: alle und die Kalender-Vorschläge — dieselbe Sichtregel wie der Stapel selbst
 * (`vorschlagSichtbar`, F2 M6): eigene und die des Systems, nie die der anderen Person.
 */
async function vorschlaegeZaehlen(person: string): Promise<{ kalender: number; gesamt: number }> {
  const [{ lies, vorschlagSichtbar }, { personImHaushaltDesInhabers }] = await Promise.all([import('@/lib/zoe/stapel'), import('@/lib/zugang/haushalt-inhaber')]);
  const imHaushalt = await personImHaushaltDesInhabers(person).catch(() => false);
  const offen = (await lies('offen')).filter(v => vorschlagSichtbar(v, person, imHaushalt));
  return { gesamt: offen.length, kalender: offen.filter(v => v.bezug?.art === 'kalender' || v.gruppe === 'kalender').length };
}

/** Danke-Mails nach einem Event (Netzwerken, 02.10.): je Event die Zahl der noch nicht verschickten mit Adresse — ab dem Folgetag. */
function dankeAnstehend(crm: { events: Parameters<typeof dankeZeilen>[0]['events']; teilnahmen: Parameters<typeof dankeZeilen>[0]['teilnahmen'] } | null, kontakte: Parameters<typeof dankeZeilen>[0]['kontakte'], heute: string, person: string): ADanke[] {
  if (!crm) return [];
  const zeilen = dankeZeilen({ events: crm.events, teilnahmen: crm.teilnahmen, kontakte, heute, person });
  const je = new Map<string, typeof zeilen>();
  for (const z of zeilen) je.set(z.event.id, [...(je.get(z.event.id) ?? []), z]);
  return Array.from(je.entries()).map(([id, l]) => ({ id: `danke-${id}`, n: dankeOffen(l), eventTitel: l[0].event.titel, href: WEG.netzwerken({ bericht: id }) })).filter(d => d.n > 0);
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
  const [gelesen, kontakte, crm, fristen, buchungen, vorschlaege, geburtstage, ausgeblendet] = await Promise.all([
    einst ? sicher(termineLesen(einst, tagPlus(heute, -4), tagPlus(heute, 2)), null) : Promise.resolve(null),
    sicher(kontakteFuerVerarbeitung(), []),
    sicher(ladeCrm(), null),
    sicher(fristenLesen(heute, tagPlus(heute, Math.max(2, vorlauf + 1)), heute, person), []),
    sicher(buchungenLesen(person), []),
    sicher(vorschlaegeZaehlen(person), { kalender: 0, gesamt: 0 }),
    // Ab heute; 61 Tage, damit ein längerer Vorlauf eines Wichtigen Tages (Familie, ≤ 60) greift — `geburtstageVorlauf` schneidet.
    sicher(geburtstageIm({ von: heute, bis: tagPlus(heute, 61) }, person), []),
    // 4.8 (08.10.): Follow-ups eingeschränkter Personen nie in Glocke/Heute — die verarbeitbare Kartei kennt sie nicht, also die Kennungen.
    // Scheitert das Lesen, zeigt die Liste lieber KEINE echten Follow-ups ohne bekannte Person (siehe unten), statt Namen zu verraten.
    sicher<Set<string> | null>(eingeschraenkteKennungen(), null),
  ]);
  const sicht = (gelesen?.termine ?? []).map(t => maskieren(t, person));
  const mitAufgabe = new Set((crm?.followups ?? []).filter(f => f.aufgabeId).map(f => f.id));
  const zeiten = zeitenAus(sicht);
  // N3 (F2): Zeiten nur für Meetings an Kontakten, deren Nachbereitung bei DIESER Person liegt (wie `nachbereitung` mit `person`).
  const eigene = kontakte.filter(k => { const f = haeltBeziehung(k); return f === person || f === BEIDE; });
  const verwiesen = new Set(eigene.flatMap(k => (k.aktivitaeten ?? []).filter(a => a.art === 'termin').map(a => a.terminUid).filter((x): x is string => !!x)));
  return {
    heute,
    termine: termineHeute(sicht, person, heute, jetztWand),
    // M4 (F2): ein offenes Follow-up am selben Termin (`terminUid`) ist „in Arbeit“ — keine zweite Meldung.
    nachbereiten: nachbereitenAnstehend(nachbereitung(kontakte, heute, person, zeiten, jetztWand, crm?.followups)),
    nachbereitZeiten: Object.fromEntries(Object.entries(zeiten).filter(([k]) => verwiesen.has(k))),
    // Dazu (N5): besuchte Events, bei denen wir „angemeldet“ sind, aber noch kein Termin im Kalender steht — sonst fährt niemand hin, der es im Kalender sieht.
    fristen: [...fristenAnstehend(fristen, person, heute, vorlauf), ...(crm ? eventsOhneTermin(crm.events, heute, person).map(x => ({ id: `event-ohne-termin-${x.id}`, art: 'event' as const, tag: x.tag, titel: `Event „${x.titel}“: angemeldet, aber kein Termin im Kalender`, href: WEG.besuch(x.id), inTagen: x.inTagen, business: true as const })) : [])],
    followups: crm ? followupsAnstehend(faellige(kontakte, crm, heute, { horizont: 0, wertelisten: crm.wertelisten, ausgeblendet: ausgeblendet ?? ohneSichtbareKennung(crm, kontakte) }), person, mitAufgabe, zeiten) : [],
    buchungen,
    vorschlaege,
    geburtstage: geburtstageVorlauf(geburtstage, person, heute),
    danke: dankeAnstehend(crm, kontakte, heute, person),
  };
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
  const namen = ['kalender-icloud', 'calendar-cache', 'kalender-bezug', 'kalender-einstellungen', 'crm', 'kontakte', 'finanzplan', 'meilensteine', 'ziele', 'konten', 'backlog', 'steuern', 'zoe-stapel', ...(h ? [`buchung--${h}`, familieName(h)] : [])];
  return `${wandzeit(jetzt).slice(0, 15)}:${await sicher(speicherStand(namen), '0')}`;
}
