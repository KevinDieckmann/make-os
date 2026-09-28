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
  opt: { erzwingen?: boolean; anlass?: string; person?: Person; vorschlagen?: boolean; quelle?: 'gespraech' | 'lauf'; hintergrund?: boolean; freigegebenVon?: string } = {},
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

  // Der Trockenlauf liest denselben Bestand wie die Ausführung. Er läuft immer
  // — bei freien Werkzeugen, damit das Protokoll eine lesbare Zeile bekommt,
  // bei freigabepflichtigen, weil er das Vorher/Nachher im Stapel ist.
  const vs = await vorschauVon(name, input);

  // `vorschlagen` stapelt AUCH freie Werkzeuge. Gebraucht wird das vom
  // Morgenlauf: was ZOE nachts von allein erarbeitet, soll Kevin einmal
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
        + 'Das liegt jetzt in Kevins Freigabe-Stapel. Sag ihm knapp, was du vorbereitet hast, und dass es auf seine Freigabe wartet — behaupte NICHT, es sei erledigt.',
      ok: true, gestapelt: true,
    };
  }

  // Kevins Vertraulichkeitsregeln im Vault: „Agenten bekommen nie privat."
  // Was ohne Gespräch im Hintergrund läuft, liest das Brain deshalb in der
  // Agenten-Sicht (ohne Person). Geschrieben wird weiterhin für die Person.
  // Projekt-/Aufgaben-Dateien (28.09., C2) liest ZOE im Hintergrund gar nicht: ohne Person lehnt das Werkzeug ab.
  const leseSicht = (opt.hintergrund || opt.quelle === 'lauf') && ((gruppe === 'wissen' && (name === 'suche_wissen' || name === 'lies_notiz')) || gruppe === 'aufgaben-dateien');
  // Bei der Freigabe (erzwingen) erfährt das Werkzeug, WER freigegeben hat (#94) — nie aus der Eingabe des Modells.
  const text = await werk.lauf(input, origin, leseSicht ? undefined : opt.person, opt.erzwingen ? { freigegebenVon: opt.freigegebenVon ?? opt.person } : undefined);
  // Ebenfalls nur der Anfang: die Werkzeuge stellen ihre Fehlermeldung voran,
  // im weiteren Text dürfen dieselben Wörter harmlos vorkommen.
  const ok = !/fehlgeschlagen|nicht erreichbar|nicht lesbar|nicht angelegt|Kollision|Kein Meilenstein|Nicht ausgeführt/i.test(text.slice(0, 200));
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
