// ─── Geburtstage lesen — für ALLE Module (29.09., Paket K2, Server) ─────────
// `geburtstageIm({ von, bis }, person)` ist die eine Lesefunktion: Kalender (Quelle „Geburtstage“), Glocke (Meldung am
// Vortag und am Tag), Heute (Anlässe), ZOE (Live-Zustand), Familie, Kontaktakte. Regeln (Vorrang Familie, Art. 18,
// „nur ich“) in quellen-geburtstage.ts.
//
// Wer was sieht: Familie nur die Person selbst in ihrem Haushalt (`haushaltFuer`, streng; „nur ich“ über `sichtFuer`),
// CRM nur Personen im Haushalt des Inhabers (wie jede Kartei-Sicht) und nur über `kontakteFuerVerarbeitung()` —
// eingeschränkte Kontakte (Art. 18) fehlen. Gelesen wird nur; der Familien-Bestand wird hier nie angelegt.

import { loadJson } from '@/lib/store/local-db';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { familieName } from '@/lib/familie/speicher';
import { sichtFuer } from '@/lib/familie/logik';
import type { Familie } from '@/lib/familie/typen';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { haeltBeziehung } from '@/lib/crm/team';
import { WEG } from '@/lib/wege';
import { familieQuellen, crmQuellen, quellenVereinen, geburtstageAus, type Geburtstag, type GeburtstagQuelle } from './quellen-geburtstage';

/** Alle Personen mit Geburtstag, die `person` sehen darf — Familie + CRM, vereint (eine Stelle je Person). */
export async function geburtstagsQuellen(person: string): Promise<GeburtstagQuelle[]> {
  const [zugang, crmErlaubt] = await Promise.all([haushaltFuer(person).catch(() => null), personImHaushaltDesInhabers(person).catch(() => false)]);
  const [familie, kontakte] = await Promise.all([
    zugang ? loadJson<Partial<Familie>>(familieName(zugang.haushalt)).catch(() => null) : Promise.resolve(null),
    crmErlaubt ? kontakteFuerVerarbeitung().catch(() => []) : Promise.resolve([]),
  ]);
  const fam = familie ? familieQuellen({ menschen: sichtFuer(familie.menschen ?? [], person), tage: sichtFuer(familie.tage ?? [], person) }, { mensch: WEG.menschen(), tag: '/os/familie' }) : [];
  const crm = crmQuellen(kontakte, WEG.akte, k => haeltBeziehung(k));
  // Familie: jeder, der den Eintrag sieht, wird erinnert.
  return quellenVereinen(fam.map(q => ({ ...q, zustaendig: person })), crm);
}

/**
 * Die Geburtstage im Zeitraum [von, bis) für `person`. `nur` schränkt auf einen Space ein (Privat = Familie,
 * Business = CRM). Wirft nie — bei einem Fehler ist die Liste leer.
 */
export async function geburtstageIm(zeitraum: { von: string; bis: string }, person: string, opt: { nur?: 'privat' | 'business' } = {}): Promise<Geburtstag[]> {
  try {
    const liste = geburtstageAus(await geburtstagsQuellen(person), zeitraum.von, zeitraum.bis);
    return opt.nur ? liste.filter(g => g.space === opt.nur) : liste;
  } catch {
    return [];
  }
}
