// ─── Fulfillment · Analyse — Änderungen am Personenteil (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.5, 8.1) — rein ─────────────────────────────
// Der Personenteil (`fulfillment-personen--<h>`) liegt GETRENNT vom Dossier: eigener Bestand, eigene Löschfrist (Mandatsende + 90 Tage,
// einstellbar), Zugang nur Inhaber bzw. Mitglieder ohne „nur Business“ (lib/fulfillment/zugang.ts `personenteilZugang`), Lese-Protokoll
// „personenrecherche“. Karten entstehen NUR aus einem bestätigten A4-Lauf (Status „Entwurf“) und werden von einem Menschen geprüft.
// Schritte: karte-neu (Server) · pruefen · art14 · verknuepfen · angabe-entfernen · loeschen · loeschtage (Server). Rein und client-sicher.

import type { PersonenDatei, PersonenKarte, AnwendenErgebnis } from '../typen';
import { negativTreffer } from './dsgvo';
import { belegt } from './pruefen';

export type PersonenOp =
  | { op: 'karte-neu'; karte: PersonenKarte }
  | { op: 'pruefen'; id: string; stand: string; loeschAm?: string | null }
  | { op: 'art14'; id: string; stand: string; gegebenAm: string; wie: 'kickoff' | 'mail' | 'erster-kontakt' }
  | { op: 'verknuepfen'; id: string; stand: string; kontaktId: string | null }
  | { op: 'angabe-entfernen'; id: string; stand: string; angabeId: string }
  | { op: 'loeschen'; id: string; stand: string }
  | { op: 'loeschtage'; mandatId: string; loeschAm: string | null };

export interface PersonenKontext { person: string; heute: string; standVon: (k: PersonenKarte) => string }

type E = AnwendenErgebnis<PersonenDatei>;
const nein = (status: 400 | 403 | 404 | 409 | 413, fehler: string): E => ({ ok: false, status, fehler });
const LISTEN = ['werdegang', 'themen', 'auftritte', 'aufhaenger'] as const;
const KONTAKT_ID = /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,119}$/;

/** Warum eine Karte (noch) nicht als „geprüft“ gelten kann — leere Liste = in Ordnung (rein). */
export function karteMaengel(k: PersonenKarte): string[] {
  const raus: string[] = [];
  if (k.identitaet === 'niedrig') raus.push('Zuordnung unsicher — Karte verwerfen.');
  if (!k.art14.faelligAm) raus.push('Art.-14-Plan fehlt.');
  const q = new Map(k.quellen.map(x => [x.id, x]));
  for (const l of LISTEN) for (const a of k[l]) {
    if (negativTreffer(a.text, 'person')) raus.push('Eine Angabe steht auf der Negativliste — entfernen.');
    if (!belegt(a, q)) raus.push('Eine Angabe hat keine Quelle — entfernen.');
  }
  return [...new Set(raus)];
}

export function personenAnwenden(datei: PersonenDatei, op: PersonenOp, k: PersonenKontext): E {
  const mit = (karten: PersonenKarte[], geaendert: string[]): E => ({ ok: true, datei: { ...datei, karten }, geaendert });
  if (op.op === 'karte-neu') {
    if (datei.karten.some(x => x.id === op.karte.id)) return nein(409, 'Diese Karte gibt es schon.');
    return mit([...datei.karten, op.karte], [op.karte.id]);
  }
  if (op.op === 'loeschtage') {
    const karten = datei.karten.map(x => {
      if (x.mandatId !== op.mandatId) return x;
      if (!op.loeschAm) { const { loeschAm: _l, ...rest } = x; return rest; }
      return { ...x, loeschAm: op.loeschAm };
    });
    return mit(karten, karten.filter(x => x.mandatId === op.mandatId).map(x => x.id));
  }
  const karte = datei.karten.find(x => x.id === op.id);
  if (!karte) return nein(404, 'Diese Personenkarte gibt es nicht (mehr).');
  if (op.stand !== k.standVon(karte)) return { ok: false, status: 409, fehler: 'Inzwischen hat jemand die Karte geändert — neu geladen, bitte noch einmal.', konflikte: [{ id: karte.id, stand: k.standVon(karte) }] };
  const ersetze = (neu: PersonenKarte) => mit(datei.karten.map(x => (x.id === karte.id ? neu : x)), [karte.id]);
  switch (op.op) {
    case 'pruefen': {
      const m = karteMaengel(karte);
      if (m.length) return nein(409, `Noch nicht prüfbar: ${m.join(' ')}`);
      return ersetze({ ...karte, status: 'geprueft', ...(op.loeschAm ? { loeschAm: op.loeschAm } : {}) });
    }
    case 'art14': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(op.gegebenAm) || op.gegebenAm > k.heute) return nein(400, 'Datum als JJJJ-MM-TT, nicht in der Zukunft.');
      if (!['kickoff', 'mail', 'erster-kontakt'].includes(op.wie)) return nein(400, 'Wie: Kick-off, Mail oder erster Kontakt.');
      return ersetze({ ...karte, art14: { ...karte.art14, gegebenAm: op.gegebenAm, wie: op.wie, von: k.person } });
    }
    case 'verknuepfen': {
      if (op.kontaktId === null) { const { kontaktId: _k, ...rest } = karte; return ersetze(rest); }
      if (!KONTAKT_ID.test(op.kontaktId)) return nein(400, 'Unbekannter Kontakt.');
      return ersetze({ ...karte, kontaktId: op.kontaktId });
    }
    case 'angabe-entfernen': {
      const neu = { ...karte };
      let gefunden = false;
      for (const l of LISTEN) { const vor = neu[l].length; neu[l] = neu[l].filter(a => a.id !== op.angabeId); if (neu[l].length !== vor) gefunden = true; }
      if (!gefunden) return nein(404, 'Diese Angabe gibt es nicht.');
      const genutzt = new Set(LISTEN.flatMap(l => neu[l].flatMap(a => a.quellen)));
      return ersetze({ ...neu, quellen: neu.quellen.filter(q => genutzt.has(q.id)), status: 'entwurf' });
    }
    case 'loeschen':
      return mit(datei.karten.filter(x => x.id !== karte.id), [karte.id]);
  }
  return nein(400, 'Unbekannter Schritt.');
}
