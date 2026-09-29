// ─── Kalender — Zeit-Auswertung lesen (29.09., Paket K2, Server) ────────────
// Liest NUR aus vorhandenen Bestandsfunktionen und gibt an die reine Rechnung (auswertung.ts) weiter:
//   Termine     `termineLesen` (iCloud-Stand über `termineImZeitraum`, sonst Mac-Stand — OHNE Abgleich, nie ein Netzaufruf),
//               Art/frei-beschäftigt aus dem Termin-Modell (K1), Mandat/Kontakt aus `kalender-bezug` (`mitBezug`).
//               Wer: dieselbe Regel wie die Verfügbarkeit (`betrifft`, K1), Space über `spaceVonKalender`.
//   Arbeitszeit Soll aus der Wochenvorlage über `verfuegbarkeitAus` (K1, ohne Feiertage/ganz abwesende Tage) — hat die
//               Person dort keine Business-Blöcke: Kalender-Einstellungen (vonStunde/bisStunde, Mo–Fr).
//   Fokus       `ladeZeit(person)` — bewusste Blöcke aller Spaces; Einheit über `einheitVonBlock` (Aufgabe/Mandat live),
//               Aufgaben aus `aufgabenKurz`, Mandate aus `mandateKurz` (dieselben Wege wie Zeit je Einheit/Mandat).
// Die Zeit ist persönlich (wie in der Zeitmessung): ausgewertet wird die angemeldete Person.

import { termineLesen } from './termine-lesen';
import { kontakteVon } from './bezug';
import { ladeEinstellungen } from './einstellungen';
import { spaceVonKalender } from './space';
import { tagPlus } from './zeit';
import { istFeiertag } from './quellen-feiertage';
import { betrifft, verfuegbarkeitAus } from './verfuegbarkeit-regeln';
import { loadJson } from '@/lib/store/local-db';
import type { RoutinenDatei } from '@/lib/planung/typen';
import { zeitAuswertung, montagDer, type ATermin, type ABlock, type Auswertung } from './auswertung';
import { ladeZeit, aufgabenKurz } from '@/lib/zeitmessung/speicher';
import { einheitVonBlock } from '@/lib/zeitmessung/einheiten';
import { teile, type ZeitDatei } from '@/lib/zeitmessung/modell';
import { mandateKurz } from '@/lib/planung/mandat-server';
import { mandatLabel } from '@/lib/planung/mandat';
import { einheitName } from '@/lib/einheiten';

export interface AuswertungAntwort extends Auswertung {
  quelle: 'icloud' | 'mac' | 'ohne-kalender';
  /** Anzeigenamen zu Einheit/Mandat (Mandat → Firma · Titel, gelöschte als „Mandat (gelöscht)“). */
  namen: { einheiten: Record<string, string>; mandate: Record<string, string> };
}


/** Blöcke im Zeitraum [von, bis) (Berliner Tage, großzügig nach Datei-Tag gefiltert — die Rechnung schneidet exakt). */
function bloeckeIn(d: ZeitDatei, von: string, bis: string) {
  const vorher = tagPlus(von, -1), nachher = tagPlus(bis, 1);
  return Object.entries(d.tage ?? {}).filter(([tag]) => tag >= vorher && tag <= nachher).flatMap(([, t]) => t.bloecke ?? []).filter(b => b.sek > 0);
}

export async function zeitAuswertungFuer(person: string, stichtag: string, wochen = 4): Promise<AuswertungAntwort> {
  const mo = montagDer(stichtag);
  const von = tagPlus(mo, -7 * wochen), bis = tagPlus(mo, 7);
  const einst = await ladeEinstellungen();
  const [zeit, aufgaben, mandate, gelesen, routinen] = await Promise.all([
    ladeZeit(person).catch(() => ({ tage: {} }) as ZeitDatei),
    aufgabenKurz().catch(() => []),
    mandateKurz().catch(() => new Map()),
    termineLesen(einst, von, bis).catch(() => ({ quelle: 'leer' as const, termine: [], kalender: [] })),
    loadJson<RoutinenDatei>('routinen').catch(() => null),
  ]);

  const eigene = gelesen.termine.filter(t => betrifft(t, person));
  const termine: ATermin[] = eigene.map(t => ({
    id: t.id, start: t.start, ende: t.ende, ganztags: t.ganztags, space: spaceVonKalender(einst, t.kalender), mitTeilnehmern: t.mitTeilnehmern,
    art: t.art, ...(t.beschaeftigt === false ? { frei: true } : {}),
    ...(t.bezug?.mandatId ? { mandatId: t.bezug.mandatId } : {}),
    // K3 (30.09.): Kontakt am Termin + Gäste aus dem CRM (`gastKontakte`) — je Person einmal.
    ...(kontakteVon({ ...(t.bezug?.kontaktId ? { kontaktId: t.bezug.kontaktId } : {}), ...(t.gastKontakte ? { gastKontakte: t.gastKontakte } : {}) }).length
      ? { kontakte: kontakteVon({ ...(t.bezug?.kontaktId ? { kontaktId: t.bezug.kontaktId } : {}), ...(t.gastKontakte ? { gastKontakte: t.gastKontakte } : {}) }) } : {}),
  }));
  // Soll-Arbeitszeit aus der Wochenvorlage (K1) — nur wenn die Person dort Business-Blöcke hat.
  const bloeckeVorlage = Array.isArray(routinen?.bloecke) ? routinen!.bloecke : [];
  const mitVorlage = bloeckeVorlage.some(b => b.owner === person && b.art === 'business');
  const arbeitszeitJeTag = mitVorlage ? Object.fromEntries(verfuegbarkeitAus({ person, von, bis, termine: eigene, bloecke: bloeckeVorlage }).tage.map(t => [t.tag, t.arbeitszeit])) : undefined;

  const aufgabenKarte = new Map(aufgaben.map(a => [a.id, a]));
  const bloecke: ABlock[] = bloeckeIn(zeit, von, bis).map(b => {
    const space = teile(b.schluessel).space;
    const einheit = space === 'business' ? einheitVonBlock(b, aufgabenKarte, mandate) : undefined;
    return { von: b.von, bis: b.bis, space, ...(einheit ? { einheit } : {}), ...(space === 'business' && b.mandatId ? { mandatId: b.mandatId } : {}) };
  });

  const a = zeitAuswertung({ termine, bloecke, arbeitszeit: { vonStunde: einst.vonStunde, bisStunde: einst.bisStunde }, ...(arbeitszeitJeTag ? { arbeitszeitJeTag } : {}), feiertag: istFeiertag }, stichtag, wochen);
  const einheiten: Record<string, string> = {};
  const mandatNamen: Record<string, string> = {};
  for (const w of [a.woche, ...a.vorher]) {
    for (const e of w.jeEinheit) einheiten[e.einheit] ??= einheitName(e.einheit) ?? e.einheit;
    for (const m of w.jeMandat) { const k = mandate.get(m.mandatId); mandatNamen[m.mandatId] ??= k ? mandatLabel(k) : 'Mandat (gelöscht)'; }
  }
  return { ...a, quelle: gelesen.quelle === 'leer' ? 'ohne-kalender' : gelesen.quelle, namen: { einheiten, mandate: mandatNamen } };
}
