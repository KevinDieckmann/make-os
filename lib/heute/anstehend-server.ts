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
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { ladeCrm } from '@/lib/crm/speicher';
import { faellige } from '@/lib/crm/followup';
import { nachbereitung } from '@/lib/crm/erfassen';
import { zeitenAus } from '@/lib/crm/aktivitaeten';
import { haeltBeziehung, BEIDE } from '@/lib/crm/team';
import {
  termineHeute, fristenAnstehend, followupsAnstehend, nachbereitenAnstehend, geburtstageVorlauf, type Anstehend, type ABuchung,
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

/** Was für die Person ansteht (heute). */
export async function anstehendLesen(person: string, jetzt: Date = new Date()): Promise<Anstehend> {
  const jetztWand = wandzeit(jetzt), heute = tagVon(jetztWand);
  const einst = await sicher(ladeEinstellungen(), null);
  const vorlauf = einst?.kuendigungVorlaufTage ?? 14;
  const [gelesen, kontakte, crm, fristen, buchungen, vorschlaege, geburtstage] = await Promise.all([
    einst ? sicher(termineLesen(einst, tagPlus(heute, -4), tagPlus(heute, 2)), null) : Promise.resolve(null),
    sicher(kontakteFuerVerarbeitung(), []),
    sicher(ladeCrm(), null),
    sicher(fristenLesen(heute, tagPlus(heute, Math.max(2, vorlauf + 1)), heute), []),
    sicher(buchungenLesen(person), []),
    sicher(vorschlaegeZaehlen(person), { kalender: 0, gesamt: 0 }),
    // Ab heute; 61 Tage, damit ein längerer Vorlauf eines Wichtigen Tages (Familie, ≤ 60) greift — `geburtstageVorlauf` schneidet.
    sicher(geburtstageIm({ von: heute, bis: tagPlus(heute, 61) }, person), []),
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
    fristen: fristenAnstehend(fristen, person, heute, vorlauf),
    followups: crm ? followupsAnstehend(faellige(kontakte, crm, heute, { horizont: 0, wertelisten: crm.wertelisten }), person, mitAufgabe, zeiten) : [],
    buchungen,
    vorschlaege,
    geburtstage: geburtstageVorlauf(geburtstage, person, heute),
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
  const namen = ['kalender-icloud', 'calendar-cache', 'kalender-bezug', 'kalender-einstellungen', 'crm', 'kontakte', 'finanzplan', 'meilensteine', 'backlog', 'steuern', 'zoe-stapel', ...(h ? [`buchung--${h}`, familieName(h)] : [])];
  return `${wandzeit(jetzt).slice(0, 15)}:${await sicher(speicherStand(namen), '0')}`;
}
