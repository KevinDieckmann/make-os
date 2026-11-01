// ─── Kampagnen-Motor — Sequenz je Ziel (rein, client-sicher, 31.10., Welle A · KUNDENGEWINNUNG_PLAN.md › S3) ──────────────────────
// Kevin 31.10.: „vom E-Mails schreiben bis Upselling … maximal automatisiert und klug.“ Bis heute galten die Schritte einer Kampagne für die ganze
// Kampagne, das Ergebnis je Person stand von Hand. Hier: eine SEQUENZ (Schritte mit Tag-Abstand und Kanal) und je Ziel (Person ODER Firma) ein
// Stand — welcher Schritt dran ist, wann, und ob das Ziel noch läuft. Takten, stoppen, weiterschalten ist reine Rechnung (diese Datei); was daraus
// entsteht (Mail-Entwurf im Stapel, Follow-up für Anruf/LinkedIn/Besuch, Brief in der Druckliste), macht der Motor (lib/crm/kampagnen-motor.ts).
//
//   offen    der Schritt `schritt` steht an `faelligAm` an — noch nichts erzeugt
//   wartet   er liegt vor (Entwurf im Stapel bzw. Follow-up) — weiter erst, wenn gesendet bzw. erledigt
//   reagiert Antwort kam (Rückfluss) — die Sequenz stoppt, ein Follow-up „Antwort bearbeiten“ steht an
//   gestoppt Abmeldung, Werbesperre, unzustellbar, „kein Interesse“, von Hand gestoppt
//   fertig   alle Schritte durch
//
// Grenzen: nie kürzen — über der Grenze lehnt der Schreibweg ab (413).

import type { Kampagne, KampagnenZiel, SequenzKanal, SequenzSchritt, ZielStand, ZielStatus, ZielVerlaufWas } from './typen';
import { mailTextePruefen, PRODUKT_TEXT_GRENZEN } from './vorlage-platzhalter';
import { tagePlus } from '@/lib/zeit';

export const SEQUENZ_KANAELE: { id: SequenzKanal; label: string; was: string }[] = [
  { id: 'mail', label: 'Mail', was: 'Entwurf im Mail-Stapel — gesendet nach der Freigabe' },
  { id: 'anruf', label: 'Anruf', was: 'Follow-up mit Leitfaden (Power Hour)' },
  { id: 'linkedin', label: 'LinkedIn', was: 'Follow-up „LinkedIn-Nachricht“' },
  { id: 'brief', label: 'Brief', was: 'Druckliste (Anschrift + Text)' },
  { id: 'besuch', label: 'Besuch', was: 'Follow-up „vor Ort vorbeigehen“' },
];
export const istSequenzKanal = (v: unknown): v is SequenzKanal => SEQUENZ_KANAELE.some(k => k.id === v);
/** Schritte mit Text-Vorlage (Mail und Brief) — Anruf/LinkedIn/Besuch tragen einen Leitfaden. */
export const MIT_VORLAGE: readonly SequenzKanal[] = ['mail', 'brief'];

export const SEQUENZ_GRENZEN = { schritte: 12, tagAbstand: 120, leitfaden: 2000, staende: 5000, verlauf: 60, neuJeTag: 200 } as const;
/** So viele Ziele starten je Tag, wenn die Kampagne nichts anderes sagt — dieselbe Zahl wie die „Neu“-Karten der Power Hour (lib/crm/heute.ts). */
export const NEU_JE_TAG_VORGABE = 4;
export const neuJeTagVon = (k: Pick<Kampagne, 'neuJeTag'>): number => (Number.isInteger(k.neuJeTag) && k.neuJeTag! >= 1 && k.neuJeTag! <= SEQUENZ_GRENZEN.neuJeTag ? k.neuJeTag! : NEU_JE_TAG_VORGABE);

const ENDE: readonly ZielStatus[] = ['reagiert', 'gestoppt', 'fertig'];
export const istEnde = (s: Pick<ZielStand, 'status'>): boolean => ENDE.includes(s.status);

const txt = (v: unknown, n: number): string | undefined => (typeof v === 'string' && v.trim() ? v.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, n) : undefined);
const zeile = (v: unknown, n: number): string | undefined => (typeof v === 'string' && v.trim() ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : undefined);

/** Die Sequenz säubern (Form — die Prüfung `sequenzPruefen` lehnt vorher ab). Ohne gültigen Schritt: undefined. */
export function sequenzSaeubern(v: unknown): SequenzSchritt[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const raus: SequenzSchritt[] = [];
  for (const [i, x] of v.slice(0, SEQUENZ_GRENZEN.schritte).entries()) {
    const o = x && typeof x === 'object' ? x as Record<string, unknown> : null;
    if (!o || !istSequenzKanal(o.kanal)) continue;
    const t = Number(o.tagAbstand);
    const id = typeof o.id === 'string' && /^[a-z0-9-]{1,40}$/.test(o.id) && !raus.some(y => y.id === o.id) ? o.id : `q${i + 1}`;
    const betreff = zeile(o.betreff, PRODUKT_TEXT_GRENZEN.betreff), text = txt(o.text, PRODUKT_TEXT_GRENZEN.text), leitfaden = txt(o.leitfaden, SEQUENZ_GRENZEN.leitfaden);
    raus.push({ id, tagAbstand: Number.isInteger(t) && t >= 0 && t <= SEQUENZ_GRENZEN.tagAbstand ? t : 0, kanal: o.kanal, ...(betreff ? { betreff } : {}), ...(text ? { text } : {}), ...(leitfaden ? { leitfaden } : {}) });
  }
  return raus.length ? raus : undefined;
}

/** Eine Sequenz prüfen, bevor sie gespeichert wird: Form, Grenzen (413), Platzhalter (400), Mail braucht Betreff + Text. Leer = in Ordnung. */
export function sequenzPruefen(v: unknown): { status: 400 | 413; text: string }[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return [{ status: 400, text: 'Die Sequenz ist eine Liste von Schritten.' }];
  if (v.length > SEQUENZ_GRENZEN.schritte) return [{ status: 413, text: `Höchstens ${SEQUENZ_GRENZEN.schritte} Schritte — nichts gespeichert.` }];
  const f: { status: 400 | 413; text: string }[] = [];
  v.forEach((x, i) => {
    const o = x && typeof x === 'object' ? x as Record<string, unknown> : {};
    const wo = `Schritt ${i + 1}`;
    if (!istSequenzKanal(o.kanal)) { f.push({ status: 400, text: `${wo}: Kanal fehlt (Mail, Anruf, LinkedIn, Brief oder Besuch).` }); return; }
    const t = Number(o.tagAbstand);
    if (!Number.isInteger(t) || t < 0 || t > SEQUENZ_GRENZEN.tagAbstand) f.push({ status: 400, text: `${wo}: Tag-Abstand 0 bis ${SEQUENZ_GRENZEN.tagAbstand}.` });
    if (MIT_VORLAGE.includes(o.kanal)) {
      f.push(...mailTextePruefen({ betreff: o.betreff, text: o.text }, 'kampagne', wo));
      if (!(typeof o.text === 'string' && o.text.trim())) f.push({ status: 400, text: `${wo}: der Text fehlt.` });
      if (o.kanal === 'mail' && !(typeof o.betreff === 'string' && o.betreff.trim())) f.push({ status: 400, text: `${wo}: der Betreff fehlt.` });
    }
    if (typeof o.leitfaden === 'string' && o.leitfaden.trim().length > SEQUENZ_GRENZEN.leitfaden) f.push({ status: 413, text: `${wo}: der Leitfaden ist zu lang (höchstens ${SEQUENZ_GRENZEN.leitfaden} Zeichen).` });
  });
  return f;
}

/** Die Ziele einer Kampagne: Personen, dann Firmen — jede Kennung einmal. */
export function zieleDerKampagne(k: Pick<Kampagne, 'kontaktIds' | 'firmaIds'>): KampagnenZiel[] {
  const raus: KampagnenZiel[] = [];
  const da = new Set<string>();
  for (const id of k.kontaktIds ?? []) if (!da.has(`kontakt:${id}`)) { da.add(`kontakt:${id}`); raus.push({ art: 'kontakt', id }); }
  for (const id of k.firmaIds ?? []) if (!da.has(`firma:${id}`)) { da.add(`firma:${id}`); raus.push({ art: 'firma', id }); }
  return raus;
}
export const zielSchluessel = (z: KampagnenZiel): string => `${z.art}:${z.id}`;
export const gleichesZiel = (a: KampagnenZiel, b: KampagnenZiel): boolean => a.art === b.art && a.id === b.id;

const verlaufDazu = (s: ZielStand, was: ZielVerlaufWas, am: string, extra: { schritt?: string; von?: string } = {}): ZielStand['verlauf'] =>
  // Nie still kürzen: über der Grenze bleibt der älteste Eintrag „start“ und die jüngsten — der Verlauf ist Anzeige, nicht Nachweis (der steht im
  // Änderungsprotokoll und an der Akte). Die Grenze ist hoch genug für 12 Schritte × 3 Ereignisse.
  [...s.verlauf, { am, was, ...(extra.schritt ? { schritt: extra.schritt } : {}), ...(extra.von ? { von: extra.von } : {}) }].slice(-SEQUENZ_GRENZEN.verlauf);

/**
 * Neue Ziele in die Sequenz holen: nur bei aktiver Kampagne mit Sequenz, höchstens `neuJeTag` je Tag (gezählt an „start“ von heute). Ziele, die schon
 * einen Stand haben (auch beendet), kommen nie zweimal. `darf` filtert gesperrte Ziele schon hier aus (Art. 18, Werbesperre, Sperrliste).
 */
export function staendeStarten(k: Kampagne, heute: string, jetzt: string, darf: (z: KampagnenZiel) => boolean = () => true): { staende: ZielStand[]; neu: number } {
  const alt = k.zielStaende ?? [];
  if (k.status !== 'aktiv' || !k.sequenz?.length) return { staende: alt, neu: 0 };
  const heuteGestartet = alt.filter(s => s.verlauf.some(v => v.was === 'start' && v.am.slice(0, 10) === heute)).length;
  let frei = Math.max(0, neuJeTagVon(k) - heuteGestartet);
  if (!frei) return { staende: alt, neu: 0 };
  const da = new Set(alt.map(zielSchluessel));
  const dazu: ZielStand[] = [];
  for (const z of zieleDerKampagne(k)) {
    if (!frei) break;
    if (da.has(zielSchluessel(z)) || !darf(z)) continue;
    if (alt.length + dazu.length >= SEQUENZ_GRENZEN.staende) break; // die Grenze lehnt der Schreibweg ab — hier nur nicht darüber hinaus starten
    dazu.push({ ...z, schritt: 0, schrittId: k.sequenz[0].id, faelligAm: tagePlus(heute, k.sequenz[0].tagAbstand), status: 'offen', verlauf: [{ am: jetzt, was: 'start' }] });
    frei--;
  }
  return { staende: dazu.length ? [...alt, ...dazu] : alt, neu: dazu.length };
}

/** Stände, deren Schritt heute (oder früher) dran ist und noch nichts erzeugt hat. */
export const faelligeStaende = (k: Pick<Kampagne, 'zielStaende'>, heute: string): ZielStand[] => (k.zielStaende ?? []).filter(s => s.status === 'offen' && s.faelligAm <= heute);

/**
 * Wo ein Stand in der Sequenz steht (M1, 01.11.): an der Schritt-KENNUNG (`schrittId`) — ein eingefügter oder entfernter Schritt verschiebt so keinen
 * laufenden Stand. Altstand ohne Kennung: der Index (wie bis 01.11.). Kennt die Sequenz die Kennung nicht mehr: -1 (der Lauf beendet das Ziel).
 */
export function schrittIndex(k: Pick<Kampagne, 'sequenz'>, s: Pick<ZielStand, 'schritt' | 'schrittId'>): number {
  const seq = k.sequenz ?? [];
  if (s.schrittId) return seq.findIndex(x => x.id === s.schrittId);
  return Number.isInteger(s.schritt) && s.schritt >= 0 && s.schritt < seq.length ? s.schritt : -1;
}
/** Der aktuelle Schritt eines Stands (oder null, wenn die Sequenz ihn nicht mehr kennt). */
export const schrittVon = (k: Pick<Kampagne, 'sequenz'>, s: Pick<ZielStand, 'schritt' | 'schrittId'>): SequenzSchritt | null => { const i = schrittIndex(k, s); return i >= 0 ? k.sequenz![i] : null; };
/**
 * Altstand übersetzen (rein): der Index wird zur Kennung des Schritts in DIESER Sequenz. Läuft vor jedem Speichern einer geänderten Sequenz
 * (Route `sequenz`) — danach hängt jeder laufende Stand an seinem Schritt, nicht an seiner Stelle. Beendete und schon übersetzte bleiben.
 */
export function standMitKennung(k: Pick<Kampagne, 'sequenz'>, s: ZielStand): ZielStand {
  if (s.schrittId || istEnde(s)) return s;
  const sch = k.sequenz?.[s.schritt];
  return sch ? { ...s, schrittId: sch.id } : s;
}
/** Wie viele Ziele gerade laufen (offen/wartet) — für den Hinweis beim Ändern der Sequenz. */
export const laufendeZiele = (k: Pick<Kampagne, 'zielStaende'>): number => (k.zielStaende ?? []).filter(s => !istEnde(s)).length;

/** Erzeugt (Entwurf/Follow-up/Druckliste) → „wartet“. */
export function wartet(s: ZielStand, am: string, was: ZielVerlaufWas, schritt?: string, von?: string): ZielStand {
  return s.status === 'offen' ? { ...s, status: 'wartet', verlauf: verlaufDazu(s, was, am, { schritt, von }) } : s;
}

/** Der Schritt ist getan (gesendet/erledigt) → nächster Schritt mit seinem Abstand ab heute, sonst „fertig“. Beendete bleiben, wie sie sind. */
export function weiter(k: Pick<Kampagne, 'sequenz'>, s: ZielStand, heute: string, am: string, was: ZielVerlaufWas, von?: string): ZielStand {
  if (istEnde(s)) return s;
  const i = schrittIndex(k, s);
  const jetzt = i >= 0 ? k.sequenz![i] : null;
  const verlauf = verlaufDazu(s, was, am, { schritt: jetzt?.id, von });
  const naechster = i >= 0 ? k.sequenz?.[i + 1] : undefined;
  if (!naechster) return { ...s, status: 'fertig', verlauf: verlaufDazu({ ...s, verlauf }, 'fertig', am) };
  return { ...s, schritt: i + 1, schrittId: naechster.id, status: 'offen', faelligAm: tagePlus(heute, naechster.tagAbstand), verlauf };
}

/** Beenden (reagiert/gestoppt) — mit Grund; schon Beendetes bleibt. */
export function beenden(s: ZielStand, status: 'reagiert' | 'gestoppt', grund: string, am: string, was: ZielVerlaufWas, von?: string): ZielStand {
  if (istEnde(s)) return s;
  return { ...s, status, grund: grund.slice(0, 200), verlauf: verlaufDazu(s, was, am, { von }) };
}

/**
 * Der Schritt ist getan UND das Ziel endet (M1, 01.11.: Anruf-Ergebnis „Gespräch“/„Termin“) — erst „erledigt“ am Schritt vermerken, dann beenden.
 * So zählt der Trichter je Schritt (`kennzahlenJeSchritt`) den Schritt als erreicht und die Reaktion an ihm.
 */
export function erledigtUndBeenden(k: Pick<Kampagne, 'sequenz'>, s: ZielStand, status: 'reagiert' | 'gestoppt', grund: string, am: string, was: ZielVerlaufWas, von?: string): ZielStand {
  if (istEnde(s)) return s;
  const sch = schrittVon(k, s);
  const mit = sch ? { ...s, verlauf: verlaufDazu(s, 'erledigt', am, { schritt: sch.id, von }) } : s;
  return beenden(mit, status, grund, am, was, von);
}

/** Einen Stand im Bestand der Kampagne ersetzen (rein). */
export function standErsetzen(k: Kampagne, s: ZielStand): Kampagne {
  return { ...k, zielStaende: (k.zielStaende ?? []).map(x => (gleichesZiel(x, s) ? s : x)) };
}

/**
 * Kennzahlen je Schritt (Kampagnen-Trichter, Klein-Punkt 8): wie viele Ziele den Schritt erreicht haben (angeschrieben/erledigt), wie viele danach
 * reagierten, und — für Personen — Gespräch/Chance aus den Ergebnissen der Kampagne. Ohne Sequenz: leer.
 */
export interface SchrittZahlen { id: string; kanal: SequenzKanal; erreicht: number; reagiert: number; gespraech: number; chance: number }
export function kennzahlenJeSchritt(k: Pick<Kampagne, 'sequenz' | 'zielStaende' | 'ergebnisse'>): SchrittZahlen[] {
  const seq = k.sequenz ?? [];
  if (!seq.length) return [];
  const letztes = new Map<string, string>();
  for (const e of [...(k.ergebnisse ?? [])].sort((a, b) => a.am.localeCompare(b.am))) letztes.set(e.kontaktId, e.ergebnis);
  const z = seq.map(s => ({ id: s.id, kanal: s.kanal, erreicht: 0, reagiert: 0, gespraech: 0, chance: 0 }));
  for (const st of k.zielStaende ?? []) {
    // Zuletzt getaner Schritt (gesendet/erledigt) — dort zählt die Reaktion.
    let zuletzt = -1;
    for (const v of st.verlauf) {
      if ((v.was === 'gesendet' || v.was === 'erledigt') && v.schritt) {
        const i = seq.findIndex(s => s.id === v.schritt);
        if (i >= 0) { z[i].erreicht++; zuletzt = Math.max(zuletzt, i); }
      }
    }
    if (zuletzt < 0) continue;
    if (st.status === 'reagiert') z[zuletzt].reagiert++;
    if (st.art === 'kontakt') {
      const e = letztes.get(st.id);
      if (e === 'gespraech' || e === 'chance') z[zuletzt].gespraech++;
      if (e === 'chance') z[zuletzt].chance++;
    }
  }
  return z;
}

/** Wie viele Ziele in welchem Zustand sind (Kopf der Ansicht). */
export function staendeZaehlen(k: Pick<Kampagne, 'zielStaende'>): Record<ZielStatus, number> & { gesamt: number } {
  const z = { offen: 0, wartet: 0, reagiert: 0, gestoppt: 0, fertig: 0, gesamt: 0 };
  for (const s of k.zielStaende ?? []) { z[s.status]++; z.gesamt++; }
  return z;
}
