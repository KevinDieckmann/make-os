// ─── MAKE OS — Werkzeug ausführen (die eine Stelle) ─────────────────────────
// Baustein 1/2 (07.09.). Hier — und nur hier — wird entschieden, ob eine
// Wirkung eintritt. ZOE' Schleife und die Freigabe aus dem Stapel gehen
// beide durch diese Funktion; dadurch gibt es keinen Pfad, der am Protokoll
// oder an der Risiko-Stufe vorbeiführt.

import { WERKZEUGE } from './werkzeuge';
import { REGISTER, risikoFuerAufruf, gruppeVon, vorschauVon } from './register';
import { notiere } from './protokoll';
import { lege } from './stapel';
import type { Person } from './raum';
import { SELBST_GEKAPSELT } from './fremd';
import { LESEND } from './gespraech-schutz';
import { ZOE_BUSINESS_GRUPPEN, ZOE_ZURUECKGEHALTEN } from '@/lib/arbeitsrahmen/regel';

export interface Lauf {
  /** Was dem Modell (oder dem Aufrufer) zurückgemeldet wird. */
  text: string;
  ok: boolean;
  /** true, wenn statt der Wirkung ein Vorschlag entstanden ist. */
  gestapelt: boolean;
}

/**
 * Führt ein Werkzeug aus — oder legt es in den Stapel, wenn es eine Freigabe
 * braucht. `erzwingen` gibt es genau für einen Fall: die Freigabe selbst.
 */
export async function fuehreAus(
  name: string,
  input: Record<string, unknown>,
  origin: string,
  opt: { erzwingen?: boolean; anlass?: string; person?: Person; vorschlagen?: boolean; quelle?: 'gespraech' | 'lauf'; hintergrund?: boolean; freigegebenVon?: string;
    /** Das ZOE-Gespräch des Aufrufs (Thread + Marken, Paket 4a) — nur vom Server gesetzt, geht als Kontext an das Werkzeug (nie in den Stapel). */
    zoe?: { fadenId?: string; fremdGelesen?: boolean; vertraulich?: boolean };
    /** Der Agent, der aufruft (Anlass „<Head>: …“) — nur vom Agenten-Bereich gesetzt; geht als Kontext an selbst stapelnde Werkzeuge. */
    herkunft?: string } = {},
): Promise<Lauf> {
  const werk = WERKZEUGE[name];
  if (!werk) return { text: `Unbekanntes Werkzeug: ${name}.`, ok: false, gestapelt: false };

  // Stufe je Aufruf (29.09., #90/#93): z. B. create_task für eine andere Person → Freigabe.
  const risiko = risikoFuerAufruf(name, input, opt.person);
  const gruppe = gruppeVon(name);

  if (risiko === 'nie' && !opt.erzwingen) {
    await notiere({ werkzeug: name, gruppe, risiko, eingabe: input, ergebnis: 'gesperrt', ok: false, quelle: 'zoe', person: opt.person });
    return { text: `${name} ist gesperrt und wird nicht ausgeführt.`, ok: false, gestapelt: false };
  }

  // Datenschutz (05.10.): ein für ZOE ausgeschalteter Bereich und Gesundheit ohne Einwilligung (b) — hier, an der EINEN
  // Stelle zur Wirkung, damit kein Weg (Gespräch, Auftrag, Hintergrund) daran vorbeiführt. Die Freigabe aus dem Stapel
  // (`erzwingen`) gibt nichts an das Modell zurück und bleibt erlaubt — außer Gesundheit ohne Einwilligung.
  {
    const { werkzeugSperreFuer, kategorieVonWerkzeug } = await import('@/lib/datenschutz/ki-werkzeuge');
    const k = kategorieVonWerkzeug(name, gruppe);
    const sperre = k && (!opt.erzwingen || k === 'gesundheit') ? await werkzeugSperreFuer(k, opt.person) : null;
    if (sperre) {
      await notiere({ werkzeug: name, gruppe, risiko, eingabe: {}, ergebnis: 'gesperrt (Datenschutz)', ok: false, quelle: 'zoe', person: opt.person });
      return { text: sperre, ok: false, gestapelt: false };
    }
  }

  // Business-frei (08.10., Lücke 7): Läufe im Hintergrund (Morgen, Abend, Tageslauf, Agenten) legen in einer Business-freien Zeit
  // der Person (ohne Person: des Haushalts) keine Business-Vorschläge an und schreiben nichts im Business — lesen dürfen sie. Das
  // Gespräch (die Person fragt selbst) und die Freigabe aus dem Stapel (`erzwingen`, ein Klick) bleiben frei.
  if (!opt.erzwingen && (opt.quelle === 'lauf' || opt.hintergrund) && ZOE_BUSINESS_GRUPPEN.has(gruppe) && !LESEND.has(name)) {
    const { businessFreiJetzt, haushaltBusinessFreiJetzt } = await import('@/lib/arbeitsrahmen/server');
    const frei = await (opt.person ? businessFreiJetzt(opt.person) : haushaltBusinessFreiJetzt()).catch(() => ({ frei: false }));
    if (frei.frei) {
      await notiere({ werkzeug: name, gruppe, risiko, eingabe: {}, ergebnis: 'zurückgehalten (Business-frei)', ok: true, quelle: 'zoe', person: opt.person });
      return { text: ZOE_ZURUECKGEHALTEN, ok: true, gestapelt: false };
    }
  }

  // Der Trockenlauf liest denselben Bestand wie die Ausführung. Er läuft immer
  // — bei freien Werkzeugen, damit das Protokoll eine lesbare Zeile bekommt,
  // bei freigabepflichtigen, weil er das Vorher/Nachher im Stapel ist.
  const vs = await vorschauVon(name, input, opt.person);

  // `vorschlagen` stapelt AUCH freie Werkzeuge. Gebraucht wird das vom
  // Morgenlauf: was ZOE nachts von allein erarbeitet, soll ein Mensch einmal
  // gesehen haben, bevor es passiert — auch wenn er es tagsüber im Gespräch
  // einfach durchlaufen ließe. Der Unterschied ist nicht das Werkzeug,
  // sondern dass niemand danach gefragt hat.
  if ((risiko === 'freigabe' || opt.vorschlagen) && !opt.erzwingen) {
    const v = await lege({
      werkzeug: name, gruppe, titel: vs.titel, vorher: vs.vorher, nachher: vs.nachher,
      eingabe: input,
      ...(opt.anlass ? { anlass: opt.anlass } : {}),
      ...(opt.person ? { person: opt.person } : {}),
      // Ohne Angabe: aus dem Gespräch. Die Läufe sagen es ausdrücklich.
      quelle: opt.quelle ?? 'gespraech',
    });
    await notiere({
      werkzeug: name, gruppe, risiko, eingabe: input,
      ergebnis: `in den Stapel gelegt (${v.id})`, ok: true, quelle: 'zoe', ruecknahme: null,
      person: opt.person,
    });
    return {
      text: `VORGESCHLAGEN, NICHT AUSGEFÜHRT — ${vs.titel}: ${vs.vorher ? `${vs.vorher} → ` : ''}${vs.nachher}. `
        + 'Das liegt jetzt im Freigabe-Stapel der Person, die dich beauftragt hat. Sag knapp, was du vorbereitet hast, und dass es auf die Freigabe wartet — behaupte NICHT, es sei erledigt.',
      ok: true, gestapelt: true,
    };
  }

  // Die Vertraulichkeitsregeln im Vault: „Agenten bekommen nie privat."
  // Was ohne Gespräch im Hintergrund läuft, liest das Brain deshalb in der
  // Agenten-Sicht (ohne Person). Geschrieben wird weiterhin für die Person.
  // Projekt-/Aufgaben-Dateien (28.09., C2) liest ZOE im Hintergrund gar nicht: ohne Person lehnt das Werkzeug ab.
  const leseSicht = (opt.hintergrund || opt.quelle === 'lauf') && ((gruppe === 'wissen' && (name === 'suche_wissen' || name === 'lies_notiz')) || gruppe === 'aufgaben-dateien');
  // Bei der Freigabe (erzwingen) erfährt das Werkzeug, WER freigegeben hat (#94) — nie aus der Eingabe des Modells.
  const kontext = opt.erzwingen || opt.zoe || opt.herkunft ? { ...(opt.erzwingen ? { freigegebenVon: opt.freigegebenVon ?? opt.person } : {}), ...(opt.zoe && !opt.erzwingen ? { zoe: opt.zoe } : {}), ...(opt.herkunft && !opt.erzwingen ? { herkunft: opt.herkunft.slice(0, 200) } : {}) } : undefined;
  const text = await werk.lauf(input, origin, leseSicht ? undefined : opt.person, kontext);
  // Ebenfalls nur der Anfang: die Werkzeuge stellen ihre Fehlermeldung voran,
  // im weiteren Text dürfen dieselben Wörter harmlos vorkommen.
  // Nachschliff 09.10.: „Nicht eingeplant“ (plan_block in einer Business-freien Zeit) ist ein Fehlschlag — vorher galt der Vorschlag im Stapel als
  // „freigegeben“, obwohl kein Block angelegt war.
  const ok = !/fehlgeschlagen|nicht erreichbar|nicht lesbar|nicht angelegt|nicht eingeplant|Kollision|Kein Meilenstein|Nicht ausgeführt/i.test(text.slice(0, 200));
  await notiere({
    // Selbst gekapselte Leser (Dateien, Notizen): nur die Kopfzeile — nie Inhalte ins Protokoll.
    werkzeug: name, gruppe, risiko, eingabe: input, ergebnis: (SELBST_GEKAPSELT.has(name) ? text.split('\n')[0] : text).slice(0, 600), ok,
    quelle: opt.erzwingen ? 'stapel' : 'zoe',
    person: opt.person,
    ruecknahme: ok && vs.zurueck
      ? { werkzeug: vs.zurueck.werkzeug, eingabe: vs.zurueck.eingabe, text: `Zurück auf ${vs.vorher ?? 'den vorherigen Stand'}` }
      : null,
  });
  return { text, ok, gestapelt: false };
}

/** Für die Anzeige: welche Werkzeuge gibt es, und was darf jedes. */
export function uebersicht(): { name: string; gruppe: string; risiko: string }[] {
  return Object.keys(WERKZEUGE).map(name => ({
    name, gruppe: gruppeVon(name), risiko: REGISTER[name]?.risiko ?? 'freigabe',
  }));
}
