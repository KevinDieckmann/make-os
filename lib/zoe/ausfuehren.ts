// ─── MAKE OS — Werkzeug ausführen (die eine Stelle) ─────────────────────────
// Baustein 1/2 (07.09.). Hier — und nur hier — wird entschieden, ob eine
// Wirkung eintritt. ZOE' Schleife und die Freigabe aus dem Stapel gehen
// beide durch diese Funktion; dadurch gibt es keinen Pfad, der am Protokoll
// oder an der Risiko-Stufe vorbeiführt.
//
// Seit V3 (10.10., „Werkzeug-Verträge“, AGENTEN_KONZEPT_V2.md C3/C10) ist sie die HÜLLE um jeden Register-Werkzeug-Aufruf:
//   Vertrag (lib/werkzeuge/register.ts) → Bereich gegen die Sicht → Eingabe gegen das Schema (Laufzeitprüfung, nie still klemmen) →
//   Wirkung nach `wirkungsEntscheid` (Rechteklasse + Stufe + Marken: Außenwirkung/Geld/Löschen und alles Schreibende nach fremdem Text
//   nur über den Stapel) → typisiertes Ergebnis (`ergebnis`: erfolg · abgelehnt · fehler · braucht_freigabe, mit Fehlerklasse) → Lauf-Spur.
// Der Erfolg wird NICHT mehr am Antworttext erkannt; nur ein Werkzeug, das noch einen bloßen Fehlersatz liefert, fängt der Rückfall
// `ausAltText` ab — und zählt es in der Spur (`rueckfall`, Ziel 0).

import { WERKZEUGE } from './werkzeuge';
import { REGISTER, risikoFuerAufruf, gruppeVon, vorschauVon } from './register';
import { notiere } from './protokoll';
import { lege } from './stapel';
import type { Person } from './raum';
import { SELBST_GEKAPSELT } from './fremd';
import { LESEND } from './gespraech-schutz';
import { ZOE_BUSINESS_GRUPPEN, ZOE_ZURUECKGEHALTEN } from '@/lib/arbeitsrahmen/regel';
import { bereichAus, BEREICH_NAME, eingabeMitBereich, eingabeInSicht, type Bereich } from './bereich';
import { brauchtFreigabe, fehlschlag, wirkungsEntscheid, type WerkzeugErgebnis } from '@/lib/werkzeuge/vertrag';
import { ausgangVermerken, vertragsPruefung } from '@/lib/werkzeuge/huelle';

export interface Lauf {
  /** Was dem Modell (oder dem Aufrufer) zurückgemeldet wird. */
  text: string;
  ok: boolean;
  /** true, wenn statt der Wirkung ein Vorschlag entstanden ist. */
  gestapelt: boolean;
  /**
   * Kennung des Vorschlags im Stapel (nur mit `gestapelt`, 09.10. „Agenten live“): damit die Vorschlags-Karte im Chat (ZOE, Heads,
   * Mitarbeiter) ihren Eintrag findet und Freigeben/Ablehnen anbietet — vorher stand dort nur „Ein Vorschlag (create_task) …“ ohne Knöpfe.
   */
  vorschlagId?: string;
  /** Das typisierte Ergebnis (V3): Art, Fehlerklasse, Satz, Spur — `text`/`ok`/`gestapelt` sind daraus abgeleitet. */
  ergebnis: WerkzeugErgebnis;
}

/** Ein Ergebnis ohne Lauf des Werkzeugs (Sperre, Vertrag, Eingabe) — vermerkt in der Spur. */
const nein = (name: string, e: WerkzeugErgebnis): Lauf => {
  const r = ausgangVermerken(name, e);
  return { text: r.meldung, ok: r.ok, gestapelt: false, ergebnis: r };
};

/**
 * Führt ein Werkzeug aus — oder legt es in den Stapel, wenn es eine Freigabe
 * braucht. `erzwingen` gibt es genau für einen Fall: die Freigabe selbst.
 */
export async function fuehreAus(
  name: string,
  input: Record<string, unknown>,
  origin: string,
  opt: { erzwingen?: boolean; anlass?: string; person?: Person; vorschlagen?: boolean; quelle?: 'gespraech' | 'lauf'; hintergrund?: boolean; freigegebenVon?: string;
    /** Nur bei der Freigabe aus dem Stapel (09.10.): die Kennung des Vorschlags — geht als Kontext an das Werkzeug (feste Kennungen, nichts doppelt). */
    vorschlagId?: string;
    /** Das ZOE-Gespräch des Aufrufs (Thread + Marken, Paket 4a) — nur vom Server gesetzt, geht als Kontext an das Werkzeug (nie in den Stapel). */
    zoe?: { fadenId?: string; fremdGelesen?: boolean; vertraulich?: boolean };
    /** Der Agent, der aufruft (Anlass „<Head>: …“) — nur vom Agenten-Bereich gesetzt; geht als Kontext an selbst stapelnde Werkzeuge. */
    herkunft?: string;
    /**
     * Bereich (09.10. spät, lib/zoe/bereich.ts): im Gespräch der geprüfte Bereich des Gesprächs (Regel (c) beim Ablegen in den Stapel, Sicht
     * des Gedächtnisses beim Lesen); bei der Freigabe (`erzwingen`) der Bereich des Vorschlags — „Fakt merken“ legt den Merksatz dort ab.
     * Nur vom Server gesetzt, nie aus der Eingabe des Modells.
     */
    bereich?: Bereich | null;
    /**
     * Sicht des Laufs (V3): Privat bzw. Business — ein Werkzeug des anderen Bereichs wird abgelehnt (nichts läuft, nichts im Stapel). ZOE: der
     * Space der Seite (ohne: „Alles“, keine Grenze), Heads/Mitarbeiter: der Bereich des Heads. Nicht bei der Freigabe aus dem Stapel (dort hat
     * ein Mensch entschieden, und der Stapel zeigt je Sicht nur ihre Vorschläge).
     */
    sicht?: Bereich | null;
    /** Der Lauf hat fremden Text gelesen (V3, Rule of Two): Schreibendes wirkt dann nur als Vorschlag — auch wenn der Aufrufer es nicht sagt. */
    fremdGelesen?: boolean } = {},
): Promise<Lauf> {
  const werk = WERKZEUGE[name];
  if (!werk) return nein(name, fehlschlag('nicht_gefunden', `Unbekanntes Werkzeug: ${name}.`));
  // Sicht des Laufs (Prüf-Funde 11.10.): Leser mit Bereich „beide“, die den Bereich als Eingabe nehmen (Aufgaben, Unterlagen, Dateien), lesen in
  // einer Sicht NUR deren Bereich — der Server setzt `space` fest wie im Agenten-Bereich (`eingabeInSicht`), was das Modell angibt, gilt nicht.
  // Die übrigen Leser mit Bereich „beide“ (Postfach, Arbeitssuche, Wissen, Routinen, Heads) bekommen die Sicht als Kontext (`kontext.sicht`).
  const sicht = opt.erzwingen ? null : bereichAus(opt.sicht);
  input = eingabeInSicht(name, input, sicht);

  // Stufe je Aufruf (29.09., #90/#93): z. B. create_task für eine andere Person → Freigabe.
  const risiko = risikoFuerAufruf(name, input, opt.person);
  const gruppe = gruppeVon(name);

  if (risiko === 'nie' && !opt.erzwingen) {
    await notiere({ werkzeug: name, gruppe, risiko, eingabe: input, ergebnis: 'gesperrt', ok: false, quelle: 'zoe', person: opt.person });
    return nein(name, fehlschlag('sperre', `${name} ist gesperrt und wird nicht ausgeführt.`));
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
      return nein(name, fehlschlag('sperre', sperre));
    }
  }

  // Vertrag (V3): ohne Vertrag läuft nichts; ein Werkzeug des anderen Bereichs nicht in dieser Sicht; die Eingabe muss zum Schema passen —
  // sonst ein klarer Satz an das Modell bzw. in den Stapel, NICHTS ausgeführt und NICHTS vorgeschlagen (kein ungültiger Vorschlag im Stapel).
  const pruefung = vertragsPruefung(name, opt.erzwingen ? eingabeMitBereich(name, input, bereichAus(opt.bereich)) : input, { sicht });
  if (!pruefung.ok) {
    await notiere({ werkzeug: name, gruppe, risiko, eingabe: {}, ergebnis: pruefung.ergebnis.klasse === 'eingabe' ? 'abgelehnt (Eingabe ungültig)' : pruefung.ergebnis.klasse === 'rechte' ? 'abgelehnt (anderer Bereich)' : 'abgelehnt (ohne Vertrag)', ok: false, quelle: opt.erzwingen ? 'stapel' : 'zoe', person: opt.person });
    return nein(name, pruefung.ergebnis);
  }

  // Business-frei (08.10., Lücke 7): Läufe im Hintergrund (Morgen, Abend, Tageslauf, Agenten) legen in einer Business-freien Zeit
  // der Person (ohne Person: des Haushalts) keine Business-Vorschläge an und schreiben nichts im Business — lesen dürfen sie. Das
  // Gespräch (die Person fragt selbst) und die Freigabe aus dem Stapel (`erzwingen`, ein Klick) bleiben frei.
  if (!opt.erzwingen && (opt.quelle === 'lauf' || opt.hintergrund) && ZOE_BUSINESS_GRUPPEN.has(gruppe) && !LESEND.has(name)) {
    const { businessFreiJetzt, haushaltBusinessFreiJetzt } = await import('@/lib/arbeitsrahmen/server');
    const frei = await (opt.person ? businessFreiJetzt(opt.person) : haushaltBusinessFreiJetzt()).catch(() => ({ frei: false }));
    if (frei.frei) {
      await notiere({ werkzeug: name, gruppe, risiko, eingabe: {}, ergebnis: 'zurückgehalten (Business-frei)', ok: true, quelle: 'zoe', person: opt.person });
      // Eine Entscheidung (Sperre), kein Fehler — die Warteschlange wiederholt sie nicht (`wiederholbar`).
      return nein(name, fehlschlag('sperre', ZOE_ZURUECKGEHALTEN));
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
  // Seit V3 an EINER Stelle (`wirkungsEntscheid`, Rule of Two): Außenwirkung, Geld und Löschen IMMER als Vorschlag; Stufe „freigabe“ und
  // `vorschlagen` wie bisher; nach fremdem Text (Marke des Laufs) wirkt nichts Schreibendes ohne Klick — auch wenn ein Aufrufer vergäße, es zu sagen.
  const wirkung = wirkungsEntscheid({ rechteklasse: pruefung.vertrag.rechteklasse, risiko }, { erzwingen: opt.erzwingen, vorschlagen: opt.vorschlagen, fremdGelesen: !!(opt.fremdGelesen || opt.zoe?.fremdGelesen) });
  if (wirkung === 'vorschlag') {
    const gespraech = bereichAus(opt.bereich);
    const v = await lege({
      werkzeug: name, gruppe, titel: vs.titel, vorher: vs.vorher, nachher: vs.nachher,
      eingabe: input,
      ...(opt.anlass ? { anlass: opt.anlass } : {}),
      ...(opt.person ? { person: opt.person } : {}),
      // Ohne Angabe: aus dem Gespräch. Die Läufe sagen es ausdrücklich.
      quelle: opt.quelle ?? 'gespraech',
    }, { gespraech });
    await notiere({
      werkzeug: name, gruppe, risiko, eingabe: input,
      ergebnis: `in den Stapel gelegt (${v.id})`, ok: true, quelle: 'zoe', ruecknahme: null,
      person: opt.person,
    });
    const erg = ausgangVermerken(name, brauchtFreigabe(
      `VORGESCHLAGEN, NICHT AUSGEFÜHRT — ${vs.titel}: ${vs.vorher ? `${vs.vorher} → ` : ''}${vs.nachher}. `
        + `Das liegt jetzt im Freigabe-Stapel der Person, die dich beauftragt hat${stapelOrtSatz(bereichAus(v.bereich), gespraech)}. Sag knapp, was du vorbereitet hast, und dass es auf die Freigabe wartet — behaupte NICHT, es sei erledigt.`
        + (name === 'fakt_merken' && v.bereichNennt?.length ? ` ${crmWegSatz(v.bereichNennt)}` : ''),
      v.id,
    ));
    return { text: erg.meldung, ok: true, gestapelt: true, vorschlagId: v.id, ergebnis: erg };
  }

  // Die Vertraulichkeitsregeln im Vault: „Agenten bekommen nie privat."
  // Was ohne Gespräch im Hintergrund läuft, liest das Brain deshalb in der
  // Agenten-Sicht (ohne Person). Geschrieben wird weiterhin für die Person.
  // Projekt-/Aufgaben-Dateien (28.09., C2) liest ZOE im Hintergrund gar nicht: ohne Person lehnt das Werkzeug ab.
  const leseSicht = (opt.hintergrund || opt.quelle === 'lauf') && ((gruppe === 'wissen' && (name === 'suche_wissen' || name === 'lies_notiz')) || gruppe === 'aufgaben-dateien');
  // Bei der Freigabe (erzwingen) erfährt das Werkzeug, WER freigegeben hat (#94) — nie aus der Eingabe des Modells.
  // Bereich (09.10. spät): bei der Freigabe der des Vorschlags; sonst für „Fakt merken“ dieselbe Regel wie beim Ablegen (Bezug → Inhalt →
  // Gespräch), für alle anderen der Bereich des Gesprächs (z. B. frag_gedaechtnis liest nur diesen Bereich und Neutrales).
  const bereich = opt.erzwingen ? bereichAus(opt.bereich) : name === 'fakt_merken'
    ? await (async () => { try { const b = await (await import('./bereich-server')).bereichErmitteln({ werkzeug: name, gruppe, titel: vs.titel, nachher: vs.nachher, eingabe: input, ...(opt.anlass ? { anlass: opt.anlass } : {}) }, { gespraech: bereichAus(opt.bereich) }); return b.bereich === 'unklar' ? null : b.bereich; } catch { return bereichAus(opt.bereich); } })()
    : bereichAus(opt.bereich);
  // Sicht (Prüf-Funde 11.10.): Werkzeuge mit Bereich „beide“ liefern in einer Sicht nur deren Daten (lib/zoe/werkzeuge.ts `WerkzeugKontext.sicht`).
  const kontext = opt.erzwingen || opt.zoe || opt.herkunft || bereich || sicht ? { ...(opt.erzwingen ? { freigegebenVon: opt.freigegebenVon ?? opt.person, ...(opt.vorschlagId ? { vorschlagId: opt.vorschlagId } : {}) } : {}), ...(opt.zoe && !opt.erzwingen ? { zoe: opt.zoe } : {}), ...(opt.herkunft && !opt.erzwingen ? { herkunft: opt.herkunft.slice(0, 200) } : {}), ...(bereich ? { bereich } : {}), ...(sicht ? { sicht } : {}) } : undefined;
  // Bei der Freigabe wirkt der Bereich des Vorschlags auf den Ort (eine Aufgabe ohne Ort landet dort, lib/zoe/bereich.ts `eingabeMitBereich`).
  let roh: Awaited<ReturnType<typeof werk.lauf>>;
  try {
    roh = await werk.lauf(opt.erzwingen ? eingabeMitBereich(name, input, bereich) : input, origin, leseSicht ? undefined : opt.person, kontext);
  } catch (e) {
    // Ein Werkzeug, das wirft, zählt als interner Fehler in der Spur — der Fehler geht weiter wie bisher (Stapel: loslassen, Schleife: ein Satz).
    ausgangVermerken(name, fehlschlag('intern', 'Fehlgeschlagen: interner Fehler im Werkzeug.'));
    throw e;
  }
  // Der Ausgang kommt aus dem Werkzeug selbst (`erfolg`/`fehlschlag`, V3) — nicht mehr aus einem Muster über den Text.
  const erg = ausgangVermerken(name, roh);
  const text = erg.meldung;
  const ok = erg.ok;
  await notiere({
    // Selbst gekapselte Leser (Dateien, Notizen): nur die Kopfzeile — nie Inhalte ins Protokoll.
    werkzeug: name, gruppe, risiko, eingabe: input, ergebnis: (SELBST_GEKAPSELT.has(name) ? text.split('\n')[0] : text).slice(0, 600), ok,
    quelle: opt.erzwingen ? 'stapel' : 'zoe',
    person: opt.person,
    ruecknahme: ok && vs.zurueck
      ? { werkzeug: vs.zurueck.werkzeug, eingabe: vs.zurueck.eingabe, text: `Zurück auf ${vs.vorher ?? 'den vorherigen Stand'}` }
      : null,
  });
  // Prüf-Funde 11.10.: legt das Werkzeug SELBST in den Stapel (crm_vorschlag → `brauchtFreigabe`), gilt der Aufruf als gestapelt — mit der
  // Kennung des Vorschlags (Freigeben-Knopf an der Karte im Chat, Spur „gestapelt“). Vorher stand hier immer `gestapelt: false`.
  return { text, ok, gestapelt: erg.art === 'braucht_freigabe', ...(erg.vorschlagId ? { vorschlagId: erg.vorschlagId } : {}), ergebnis: erg };
}

/**
 * Wo der Vorschlag im Stapel steht (09.10. spät) — ZOE sagt es dazu, wenn es nicht die Sicht des Gesprächs ist: sonst sucht die Person ihn
 * unter „Privat“, obwohl er (zu Recht) unter „Business“ liegt. Rein.
 */
export function stapelOrtSatz(bereich: Bereich | null, gespraech: Bereich | null): string {
  if (!bereich) return gespraech ? ` — oben mit „Bereich wählen“ (in Privat und Business), weil der Bereich unklar ist; sag das dazu` : '';
  if (gespraech && bereich !== gespraech) return ` — unter „${BEREICH_NAME[bereich]}“ (nicht unter „${BEREICH_NAME[gespraech]}“), weil es dorthin gehört; sag das dazu`;
  return '';
}

/**
 * Hinweis nach „Fakt merken“ über eine Firma/Person der Markttraktion (09.10. spät): der Fakt gehört (auch) dorthin — ZOE schlägt den
 * passenden Eintrag mit crm_vorschlag vor, nie automatisch. Nur Kennungen, keine Namen. Rein.
 */
export function crmWegSatz(nennt: readonly { art: 'firma' | 'kontakt'; id: string }[]): string {
  const was = nennt.map(n => `${n.art === 'firma' ? 'Firma' : 'Person'} ${n.id}`).join(', ');
  return `HINWEIS: Der Fakt nennt ${nennt.length === 1 ? 'einen Eintrag' : 'Einträge'} der Markttraktion (${was}). Betrifft er diesen Eintrag (gibt es nicht mehr, gewechselt, kein Interesse, neuer Stand), dann schlag ZUSÄTZLICH mit crm_vorschlag den passenden Eintrag dort vor — eine Notiz an der Person bzw. art qualifizierung mit lead_status „ruht“ oder „kein_fit“ und text als Notiz an der Firma —, mit kurzer Begründung. Nichts davon wirkt ohne Klick. Hast du crm_vorschlag in diesem Zug nicht, sag der Person, dass der Fakt auch in die Markttraktion gehört.`;
}

/** Für die Anzeige: welche Werkzeuge gibt es, und was darf jedes. */
export function uebersicht(): { name: string; gruppe: string; risiko: string }[] {
  return Object.keys(WERKZEUGE).map(name => ({
    name, gruppe: gruppeVon(name), risiko: REGISTER[name]?.risiko ?? 'freigabe',
  }));
}
