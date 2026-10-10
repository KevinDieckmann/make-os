// ─── Fulfillment — Grenzen, Textlängen, Kennungen (C0, 10.10.; FULFILLMENT_KONZEPT.md 8.2/8.3) ─────────────────────────────────────────
// Über einer Grenze wird ABGELEHNT (413 mit Satz), nie still gekürzt — weder beim Schreiben noch beim Lesen (CLAUDE.md › Datenschicht).
// Die Säuberer (lib/fulfillment/lesen.ts) kürzen deshalb keine Listen; die Schreibwege der Pakete prüfen mit `grenzenPruefen` / `textZuLang`.
// Rein und client-sicher.

import type { FulfillmentArt, FulfillmentDateien } from './typen';

export const GRENZEN = {
  vorlagen: 60,
  knotenJeVorlage: 400,
  uebergaengeJeAblauf: 200,
  bausteine: 1500,
  gliederung: 80,
  text: 30_000,
  fragenJeFormular: 150,
  rituale: 30,
  faelle: 500,
  knotenJeFall: 600,
  stakeholder: 60,
  entscheidungen: 500,
  mitschriften: 1000,
  messungenJeZiel: 104,
  links: 1000,
  formularStaende: 3000,
  puls: 10_000,
  unterlagen: 5000,
  dossiers: 500,
  aussagenJeAbschnitt: 200,
  quellenJeDossier: 600,
  laeufeJeDossier: 80,
  personenkarten: 2000,
  opsJeAnfrage: 60,
} as const;

/** Textgrenzen je Feld (Zeichen) — darüber 413 im Schreibweg. `text` = Langtext eines Bausteins (Skript, Mail, Dokument). */
export const TEXT_MAX = {
  titel: 120,
  notiz: 300,
  kurz: 300,
  ziel: 1000,
  ergebnis: 1000,
  beschreibung: 2000,
  hinweis: 2000,
  frage: 1000,
  antwort: 4000,
  pulsSatz: 500,
  agenda: 300,
  gliederungPunkt: 300,
  text: GRENZEN.text,
  agentZusatz: 4000,
  aussage: 2000,
} as const;
export type TextFeld = keyof typeof TEXT_MAX;

/** Kennungen (8.2). Muster-Kennungen (`fp-muster-*` …) stehen nur im Code und bekommen beim Anlegen neue Kennungen. */
const K = (p: string) => new RegExp(`^${p}-[a-z0-9][a-z0-9-]{0,99}$`);
export const KENNUNG = {
  vorlage: K('fp'),
  knoten: K('fk'),
  baustein: K('fb'),
  ritual: K('fr'),
  importLauf: K('fi'),
  stakeholder: K('fs'),
  entscheidung: K('fe'),
  mitschrift: K('fn'),
  quickWin: K('fq'),
  kickoffFrage: K('fx'),
  /** Öffentliche Kennung des Kunden-Links: genau 24 hex (96 Bit) — dieselbe Form wie in der Middleware (`KUNDE_OFFEN`). */
  kundenLink: /^kl-[a-f0-9]{24}$/,
  pulsAnfrage: K('pa'),
  puls: K('pu'),
  unterlage: K('ud'),
  analyseLauf: K('al'),
  aussage: K('da'),
  quelle: K('dq'),
  personenkarte: K('pp'),
} as const;
/** Mandat-Kennungen kommen aus dem CRM (`m-<uuid>`, Altbestand frei) — nur die Form prüfen. */
export const MANDAT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
/** Allgemeine Kennung (Freigabe-Punkte F0–F7, Rollen, Fragen, Ziele): Buchstaben, Ziffern, Bindestrich. */
export const ID_FREI = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

/** Gruppe der Stapel-Vorschläge aus Fulfillment — liegt in `BUSINESS_GRUPPEN` (lib/zoe/bereich.ts), damit sie immer Business sind. */
export const STAPEL_GRUPPE = 'kunden';

/** Ist ein Text zu lang? → Satz für die 413-Antwort, sonst null. Nie kürzen. */
export function textZuLang(feld: TextFeld, wert: string | undefined | null, name?: string): string | null {
  if (typeof wert !== 'string') return null;
  const max = TEXT_MAX[feld];
  return wert.length > max ? `${name ?? feld}: höchstens ${max.toLocaleString('de-DE')} Zeichen (jetzt ${wert.length.toLocaleString('de-DE')}). Nichts gespeichert.` : null;
}

const ueber = (was: string, n: number, max: number) => (n > max ? `${was}: höchstens ${max.toLocaleString('de-DE')} (jetzt ${n.toLocaleString('de-DE')}). Nichts gespeichert.` : null);

/**
 * Die Listen-Grenzen einer ganzen Datei prüfen (nach dem Anwenden der Ops, vor dem Schreiben) — der erste Verstoß als Satz (→ 413), sonst null.
 * Prüft nur Listen, keine Texte (die prüft der Schreibweg je Feld mit `textZuLang`).
 */
export function grenzenPruefen<A extends FulfillmentArt>(art: A, d: FulfillmentDateien[A]): string | null {
  const erst = (...x: (string | null)[]) => x.find(Boolean) ?? null;
  if (art === 'vorlagen') {
    const v = d as FulfillmentDateien['vorlagen'];
    return erst(
      ueber('Prozess-Vorlagen', v.prozesse.length, GRENZEN.vorlagen),
      ueber('Bausteine', v.bausteine.length, GRENZEN.bausteine),
      ueber('Rituale', v.rituale.length, GRENZEN.rituale),
      ...v.prozesse.map(p => ueber(`Knoten in „${p.titel}“`, p.knoten.length, GRENZEN.knotenJeVorlage)),
      ...v.prozesse.map(p => ueber(`Übergänge in „${p.titel}“`, p.uebergaenge.length, GRENZEN.uebergaengeJeAblauf)),
      ...v.bausteine.map(b => ueber(`Gliederung von „${b.titel}“`, b.gliederung.length, GRENZEN.gliederung)),
      ...v.bausteine.map(b => ueber(`Fragen in „${b.titel}“`, b.fragen?.length ?? 0, GRENZEN.fragenJeFormular)),
      ...v.bausteine.map(b => ueber(`Text von „${b.titel}“`, b.text?.length ?? 0, GRENZEN.text)),
    );
  }
  if (art === 'faelle') {
    const f = Object.values((d as FulfillmentDateien['faelle']).faelle);
    return erst(
      ueber('Fälle', f.length, GRENZEN.faelle),
      ...f.flatMap(x => [
        ueber('Knoten im Fall', x.knoten.length, GRENZEN.knotenJeFall),
        ueber('Stakeholder', x.stakeholder.length, GRENZEN.stakeholder),
        ueber('Entscheidungen', x.entscheidungen.length, GRENZEN.entscheidungen),
        ueber('Mitschriften', x.mitschriften.length, GRENZEN.mitschriften),
        ...Object.values(x.wertKonto).map(w => ueber('Messungen je Ziel', w.messungen.length, GRENZEN.messungenJeZiel)),
      ]),
    );
  }
  if (art === 'kunde') {
    const k = d as FulfillmentDateien['kunde'];
    return erst(
      ueber('Kunden-Links', k.links.length, GRENZEN.links),
      ueber('Formular-Stände', k.formulare.length, GRENZEN.formularStaende),
      ueber('Puls-Antworten', k.puls.length + k.pulsAnfragen.length, GRENZEN.puls),
      ueber('Unterlagen', k.unterlagen.length, GRENZEN.unterlagen),
    );
  }
  if (art === 'dossiers') {
    const ds = Object.values((d as FulfillmentDateien['dossiers']).dossiers);
    return erst(
      ueber('Dossiers', ds.length, GRENZEN.dossiers),
      ...ds.flatMap(x => [
        ueber('Quellen im Dossier', x.quellen.length, GRENZEN.quellenJeDossier),
        ueber('Läufe im Dossier', x.laeufe.length, GRENZEN.laeufeJeDossier),
        ...Object.values(x.abschnitte).map(a => (a ? ueber('Aussagen je Abschnitt', a.aussagen.length, GRENZEN.aussagenJeAbschnitt) : null)),
      ]),
    );
  }
  return ueber('Personenkarten', (d as FulfillmentDateien['personen']).karten.length, GRENZEN.personenkarten);
}
