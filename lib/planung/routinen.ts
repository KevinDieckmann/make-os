// ─── MAKE OS — Planung: Routinen säubern, sehen, fällig ─────────────────────
// Der Schreibweg (Route) und die Ansichten teilen sich hier eine Regel:
// fehlendes `space` = privat, fehlender Rhythmus = täglich, fehlender Owner =
// beide (Altbestand bleibt gültig). Blöcke (Wochenvorlage) genauso.
// Tests: tests/planung-routinen.test.ts.

import { istSpace } from '@/lib/make-one/space-regeln';
import { OWNER_BEIDE, istRhythmus, type Block, type Routine, type RoutinePause, type SpaceId, type Wochentag } from './typen';
import { faelligkeit, regelSaeubern, rhythmusAusRegel, tagesZielVon, ROUTINE_GRENZEN, type Faelligkeit } from './rhythmus';
import { sauberEinheit } from './einheiten';
import { neueKennung } from '@/lib/kennung';
import { speicherSpace, wirksamerSpace, hatPrivatEinheit } from './bereich';

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
const UHR = /^([01]\d|2[0-3]):[0-5]\d$/;
const PERSON = /^[a-z0-9-]{1,40}$/;

export function sauberOwner(roh: unknown): string {
  const s = String(roh ?? '').trim();
  return s === OWNER_BEIDE || PERSON.test(s) ? s : OWNER_BEIDE;
}

/** Eine Routine, geprüft — additiv: alte Einträge bleiben gültig. */
export function sauberRoutine(roh: unknown): Routine | null {
  const r = (roh ?? {}) as Partial<Routine> & Record<string, unknown>;
  const label = String(r.label ?? '').trim().slice(0, 120);
  if (!label) return null;
  const rang = Number(r.rang);
  const aus: Routine = {
    id: String(r.id ?? '').slice(0, 60) || neueKennung('r'),
    label,
    wann: (['morgen', 'tag', 'abend'] as const).includes(r.wann as Routine['wann']) ? r.wann as Routine['wann'] : 'morgen',
    kategorie: (['gesundheit', 'erholung', 'leben', 'business'] as const).includes(r.kategorie as Routine['kategorie']) ? r.kategorie as Routine['kategorie'] : 'leben',
    dauerMin: Math.max(5, Math.min(120, Math.round(Number(r.dauerMin)) || 15)),
    aktiv: r.aktiv !== false,
  };
  // Speicherform (05.10. abends): Privat + Privat-Einheit (Selbstständigkeit) → Business + Einheit, wie der alte Stand sie kennt.
  let wunsch = istSpace(r.space) ? r.space : undefined;
  // Prüf-Fund 11.10.: Gesundheit und Erholung sind Privat (Art. 9; „Business zeigt keine Gesundheits-Routine“) — eine solche Routine, die im
  // Business stehen soll, wird Privat (die Business-Einheit fällt dann weg). Nur im Schreibweg; Gelesenes bleibt, wie es gespeichert ist.
  if ((aus.kategorie === 'gesundheit' || aus.kategorie === 'erholung') && wunsch === 'business' && !hatPrivatEinheit(r)) wunsch = 'privat';
  const space = speicherSpace(wunsch, r.einheit);
  if (space) aus.space = space;
  if (r.owner !== undefined && r.owner !== null && r.owner !== '') aus.owner = sauberOwner(r.owner);
  // Routinen 2 (10.10.): eine Regel, die sich GENAU als alter Rhythmus schreiben lässt, wird als alter Rhythmus gespeichert (die Form, die
  // der alte Stand kennt) — `regel` steht nur, wo es nötig ist. Ohne (gültige) Regel gilt wie bisher `rhythmus`.
  const regel = r.regel !== undefined && r.regel !== null ? regelSaeubern(r.regel) : null;
  const alt = regel ? rhythmusAusRegel(regel) : null;
  if (regel) { if (alt && alt !== 'taeglich') aus.rhythmus = alt; }
  else if (istRhythmus(r.rhythmus) && r.rhythmus !== 'taeglich') aus.rhythmus = r.rhythmus;
  // „Nächstes Mal am“ nur, wo ab dem letzten Mal gerechnet wird (wöchentlich … jährlich, alle n Tage/Wochen/Monate).
  const abLetztem = regel && !alt ? regel.art === 'intervall' : !!aus.rhythmus && aus.rhythmus !== '3x-woche';
  if (abLetztem && typeof r.naechstesMal === 'string' && ISO_TAG.test(r.naechstesMal)) aus.naechstesMal = r.naechstesMal;
  if (Number.isInteger(rang) && rang > 0) aus.rang = rang;
  // Einheit (27.09.): nur im Business, Namen aus der einen Quelle — Privat verwirft sie.
  const einheit = aus.space === 'business' ? sauberEinheit(r.einheit) : null;
  if (einheit) aus.einheit = einheit;
  // ── Routinen 2 (10.10.): alles optional und erst HIER angehängt — ein Eintrag ohne diese Felder kommt bit-gleich heraus. ──
  if (regel && !alt) aus.regel = regel;
  return Object.assign(aus, routineZusatzSaeubern(r, aus.owner));
}

const ZIEL_ID = /^[A-Za-z0-9_~.:-]{1,80}$/;
const PAUSE_GRUENDE: readonly NonNullable<RoutinePause['grund']>[] = ['urlaub', 'krank', 'sonst'];
const STEUERZEICHEN = /[\u0000-\u001f\u007f]/g;

/** Die Zusatz-Felder von Routinen 2 — nur Gültiges, in fester Reihenfolge (der Stand-Fingerabdruck bleibt stabil). Nie gekürzt: Listen
 *  über den Grenzen lehnt die Route vorher ab (`routineGrenzenFehler`). */
function routineZusatzSaeubern(r: Partial<Routine> & Record<string, unknown>, owner: string | undefined): Partial<Routine> {
  const z: Partial<Routine> = {};
  const ziel = Number(r.tagesZiel);
  if (Number.isInteger(ziel) && ziel >= 2 && ziel <= ROUTINE_GRENZEN.tagesZiel) z.tagesZiel = ziel;
  const wort = typeof r.zaehlWort === 'string' ? r.zaehlWort.replace(STEUERZEICHEN, ' ').trim() : '';
  if (wort && wort.length <= ROUTINE_GRENZEN.zaehlWort) z.zaehlWort = wort;
  const uhr = Array.isArray(r.uhrzeiten) ? [...new Set(r.uhrzeiten.filter((u): u is string => typeof u === 'string' && UHR.test(u)))].sort() : [];
  if (uhr.length) z.uhrzeiten = uhr;
  const zr = (r.zeitraum && typeof r.zeitraum === 'object' ? r.zeitraum : {}) as { von?: unknown; bis?: unknown };
  const von = typeof zr.von === 'string' && ISO_TAG.test(zr.von) ? zr.von : undefined;
  const bis = typeof zr.bis === 'string' && ISO_TAG.test(zr.bis) ? zr.bis : undefined;
  if ((von || bis) && !(von && bis && bis < von)) z.zeitraum = { ...(von ? { von } : {}), ...(bis ? { bis } : {}) };
  const pausen = (Array.isArray(r.pausen) ? r.pausen : [])
    .map((x): RoutinePause | null => {
      const o = (x ?? {}) as Partial<RoutinePause>;
      if (typeof o.von !== 'string' || typeof o.bis !== 'string' || !ISO_TAG.test(o.von) || !ISO_TAG.test(o.bis) || o.bis < o.von) return null;
      return { von: o.von, bis: o.bis, ...(PAUSE_GRUENDE.includes(o.grund as NonNullable<RoutinePause['grund']>) ? { grund: o.grund } : {}) };
    })
    .filter((x): x is RoutinePause => !!x)
    .sort((a, b) => a.von.localeCompare(b.von) || a.bis.localeCompare(b.bis))
    .filter((x, i, l) => i === 0 || x.von !== l[i - 1].von || x.bis !== l[i - 1].bis);
  if (pausen.length) z.pausen = pausen;
  if (typeof r.zielId === 'string' && ZIEL_ID.test(r.zielId)) z.zielId = r.zielId;
  if (r.erinnerung === true) z.erinnerung = true;
  // Kalender-Block nur an der Routine EINER Person (der Block landet in ihrem Kalender) — gemeinsame tragen ihn nicht.
  if (r.kalender === true && owner && owner !== OWNER_BEIDE) z.kalender = true;
  if (typeof r.angelegtAm === 'string' && ISO_TAG.test(r.angelegtAm)) z.angelegtAm = r.angelegtAm;
  return z;
}

/**
 * Grenzen von Routinen 2 (10.10.) — darüber lehnt der Schreibweg die GANZE Änderung ab (413), statt still zu kürzen. `null` = in Ordnung.
 * Genutzt von PATCH/PUT `/api/state/routinen` vor der Säuberung.
 */
export function routineGrenzenFehler(roh: unknown): string | null {
  const r = (roh ?? {}) as Record<string, unknown>;
  if (Array.isArray(r.uhrzeiten) && r.uhrzeiten.length > ROUTINE_GRENZEN.uhrzeiten) return `Abgelehnt: höchstens ${ROUTINE_GRENZEN.uhrzeiten} Uhrzeiten je Routine. Nichts gespeichert.`;
  if (Array.isArray(r.pausen) && r.pausen.length > ROUTINE_GRENZEN.pausen) return `Abgelehnt: höchstens ${ROUTINE_GRENZEN.pausen} Pausen je Routine — alte Pausen bitte entfernen. Nichts gespeichert.`;
  if (r.tagesZiel !== undefined && r.tagesZiel !== null && Number(r.tagesZiel) > ROUTINE_GRENZEN.tagesZiel) return `Abgelehnt: das Tagesziel geht bis ${ROUTINE_GRENZEN.tagesZiel}. Nichts gespeichert.`;
  if (typeof r.zaehlWort === 'string' && r.zaehlWort.trim().length > ROUTINE_GRENZEN.zaehlWort) return `Abgelehnt: das Wort für den Zähler hat höchstens ${ROUTINE_GRENZEN.zaehlWort} Zeichen. Nichts gespeichert.`;
  return null;
}

export function sauberBlock(roh: unknown): Block | null {
  const b = (roh ?? {}) as Partial<Block> & Record<string, unknown>;
  const owner = String(b.owner ?? '').trim();
  if (!PERSON.test(owner)) return null;
  const wt = Number(b.wochentag);
  if (!Number.isInteger(wt) || wt < 1 || wt > 7) return null;
  const von = String(b.von ?? ''), bis = String(b.bis ?? '');
  if (!UHR.test(von) || !UHR.test(bis) || bis <= von) return null;
  const rang = Number(b.rang);
  const titel = String(b.titel ?? '').trim().slice(0, 60);
  // Arbeit für eine Privat-Einheit (Selbstständigkeit) ist ein Arbeits-Block (05.10. abends: zählt WEITER als Arbeit) — gespeichert wie bisher.
  const art: SpaceId = speicherSpace(b.art === 'business' ? 'business' : 'privat', b.einheit) ?? 'privat';
  // Einheit (28.09.): wie bei Routinen nur im Business, Namen aus der einen Quelle — Privat verwirft sie.
  const einheit = art === 'business' ? sauberEinheit(b.einheit) : null;
  return {
    id: String(b.id ?? '').slice(0, 60) || neueKennung('bl'),
    owner, wochentag: wt as Wochentag, von, bis,
    art,
    ...(titel ? { titel } : {}),
    ...(Number.isInteger(rang) && rang > 0 ? { rang } : {}),
    ...(einheit ? { einheit } : {}),
  };
}

/** Der Bereich einer Routine: fehlt `space` → privat; eine Privat-Einheit (Selbstständigkeit) → privat (05.10. abends, abgeleitet). */
export const spaceVonRoutine = (r: Pick<Routine, 'space' | 'einheit'>): SpaceId => wirksamerSpace(r) ?? 'privat';
export const ownerVonRoutine = (r: Pick<Routine, 'owner'>): string => r.owner || OWNER_BEIDE;
export const istGemeinsam = (r: Pick<Routine, 'owner'>): boolean => ownerVonRoutine(r) === OWNER_BEIDE;

/** Welche Routinen eine Person sieht und abhakt: die eigenen und die gemeinsamen. */
export function sichtbarFuer<R extends Pick<Routine, 'owner'>>(routinen: readonly R[], person: string): R[] {
  return routinen.filter(r => { const o = ownerVonRoutine(r); return o === OWNER_BEIDE || o === person; });
}

/** Titel einer verdeckten Routine der anderen Person. */
export const ROUTINE_BELEGT = 'Belegt';

/** Gehört die Routine einer ANDEREN Person (nicht „beide“, nicht der Betrachter)? */
export const istFremdeRoutine = (r: Pick<Routine, 'owner'>, betrachter: string): boolean => {
  const o = ownerVonRoutine(r);
  return o !== OWNER_BEIDE && o !== betrachter;
};

/**
 * Die verdeckte Form einer fremden Routine (08.10., Kevin: „Routinen der anderen Person nur als Belegt“). Bleibt nur, was
 * Planung und Belegung brauchen: Kennung, Besitz, Tageszeit, Dauer, aktiv/pausiert, Rhythmus + nächstes Mal (wann sie
 * belegt — wie ein „Belegt“-Termin im Kalender seine Zeit behält) und der wirksame Bereich (Privat/Business, damit der
 * Bereichsfilter des Planers stimmt). Fällt weg, was etwas verrät: Titel, Kategorie (z. B. „Gesundheit“ — Art. 9),
 * Einheit, Rang. Die Kategorie ist Pflichtfeld des Typs und steht neutral auf „leben“; `belegt: true` sagt der
 * Oberfläche, dass sie nichts davon zeigen soll.
 */
export function routineBelegt(r: Routine): Routine {
  const space = spaceVonRoutine(r);
  return {
    id: r.id, label: ROUTINE_BELEGT, wann: r.wann, kategorie: 'leben', dauerMin: r.dauerMin, aktiv: r.aktiv,
    owner: ownerVonRoutine(r),
    ...(space === 'business' ? { space } : {}),
    ...(r.rhythmus ? { rhythmus: r.rhythmus } : {}),
    ...(r.naechstesMal ? { naechstesMal: r.naechstesMal } : {}),
    // Routinen 2 (10.10.): WANN sie belegt — Regel, Uhrzeiten, Zeitraum, Pausen (ohne Grund: „krank“ wäre eine Gesundheitsangabe). Nicht:
    // Zähler, Wort, Ziel, Erinnerung, Kalender-Schalter.
    ...(r.regel ? { regel: r.regel } : {}),
    ...(r.uhrzeiten?.length ? { uhrzeiten: r.uhrzeiten } : {}),
    ...(r.zeitraum ? { zeitraum: r.zeitraum } : {}),
    ...(r.pausen?.length ? { pausen: r.pausen.map(x => ({ von: x.von, bis: x.bis })) } : {}),
    belegt: true,
  };
}

/**
 * DIE Filterstelle für Antworten an eine Person (08.10.): eigene und gemeinsame Routinen voll, fremde nur als „Belegt“
 * (`routineBelegt`). `betrachter` null = Systemlauf ohne Person (Takt, ZOE-Hintergrund) → unverändert wie bisher.
 * Rein; genutzt von GET/PATCH/PUT `/api/state/routinen`. Tests: tests/routinen-belegt.test.ts.
 */
export function routinenFuerBetrachter(routinen: readonly Routine[], betrachter: string | null): Routine[] {
  if (betrachter === null) return [...routinen];
  return routinen.map(r => (istFremdeRoutine(r, betrachter) ? routineBelegt(r) : r));
}

/**
 * Die verdeckte Form eines fremden Blocks der Wochenvorlage (08.10., Kevin: „Blöcke der anderen Person nur als Belegt“).
 * Bleibt, was Kapazität, Verfügbarkeit und der Planer brauchen: Kennung, Besitz, Wochentag, von/bis, `art` und Rang.
 * `art` (privat | business) verrät nur den Bereich des Zeitfensters — genau das, wofür die Wochenvorlage da ist („wann ist
 * Arbeit, wann Privat“); Kapazität/Verfügbarkeit zählen Business-Blöcke als Soll-Arbeitszeit (wie ein „Belegt“-Termin seine
 * Zeit und frei/beschäftigt behält). Fällt weg: Titel (freier Text) und eine Business-Einheit. Eine Privat-Einheit (bei uns
 * die Selbstständigkeit) bleibt, weil ohne sie der abgeleitete Bereich und „zählt als Arbeit“ kippten (lib/planung/bereich.ts:
 * gespeichert ist sie als `business` + Einheit). `belegt: true` sagt der Oberfläche: grau „Belegt“, keine Bedienung.
 */
export function blockBelegt(b: Block): Block {
  return {
    id: b.id, owner: b.owner, wochentag: b.wochentag, von: b.von, bis: b.bis, art: b.art,
    ...(b.rang ? { rang: b.rang } : {}),
    ...(b.einheit && hatPrivatEinheit(b) ? { einheit: b.einheit } : {}),
    belegt: true,
  };
}

/**
 * DIE Filterstelle für Blöcke in Antworten an eine Person (08.10.): eigene voll, fremde nur als „Belegt“ (`blockBelegt`).
 * `betrachter` null = Systemlauf ohne Person → unverändert. Rein; genutzt von GET/PATCH/PUT `/api/state/routinen`.
 * Tests: tests/malin-sicht-2.test.ts.
 */
export function bloeckeFuerBetrachter(bloecke: readonly Block[], betrachter: string | null): Block[] {
  if (betrachter === null) return [...bloecke];
  return bloecke.map(b => (b.owner === betrachter ? b : blockBelegt(b)));
}

/** Ablehnungstext für Schreiben auf fremde Routinen (Route → 403). */
export const ROUTINE_FREMD = 'Nicht erlaubt: Routinen der anderen Person ändert nur sie selbst.';

/** Form einer Listen-Änderung (wie `ListenOp` aus lib/store/patch-liste — hier ohne Server-Import). */
interface RoutinenOp { op: 'upsert' | 'delete' | 'teil'; eintrag?: Routine; id?: string; felder?: Record<string, unknown> }

/**
 * In der Sperre (PATCH): betrifft eine Änderung eine fremde Routine — gespeichert oder neu für die andere Person angelegt
 * bzw. ihr zugeschoben (`owner`)? Dann `ROUTINE_FREMD`, die ganze Änderung wird abgelehnt (08.10.). So kann auch ein Schreiben
 * mit dem verdeckten Stand („Belegt“) die echten Werte nie überschreiben.
 */
export function routinenSchreibPruefen(liste: readonly Routine[], ops: readonly RoutinenOp[], ich: string): string | null {
  const nachId = new Map(liste.map(r => [r.id, r]));
  for (const o of ops) {
    const id = o.op === 'upsert' ? o.eintrag?.id : o.id;
    const alt = id ? nachId.get(id) : undefined;
    if (alt && istFremdeRoutine(alt, ich)) return ROUTINE_FREMD;
    if (o.op === 'upsert' && o.eintrag && istFremdeRoutine(o.eintrag, ich)) return ROUTINE_FREMD;
    if (o.op === 'teil' && o.felder && 'owner' in o.felder && istFremdeRoutine({ owner: sauberOwner(o.felder.owner) }, ich)) return ROUTINE_FREMD;
  }
  return null;
}

/**
 * Vollschreiben (Altweg PUT, 08.10.): fremde Routinen bleiben IMMER in ihrer gespeicherten Fassung stehen — auch wenn der
 * Browser sie nur verdeckt kannte oder gar nicht mitschickt. Kommt eine fremde Routine unverändert verdeckt zurück, zählt das
 * nicht als Änderung; jede andere Änderung an ihr (oder eine neue/zugeschobene Routine für die andere Person) → `fremd`.
 */
export function routinenVollSchreiben(alt: readonly Routine[], neu: readonly Routine[], ich: string): { liste: Routine[] } | { fremd: true } {
  const altNachId = new Map(alt.map(r => [r.id, r]));
  const gleich = (a: Routine, b: Routine) => JSON.stringify(sauberRoutine(a)) === JSON.stringify(sauberRoutine(b));
  const aus: Routine[] = [];
  const gesehen = new Set<string>();
  for (const r of neu) {
    const vorher = altNachId.get(r.id);
    if (vorher && istFremdeRoutine(vorher, ich)) {
      if (!gleich(r, routineBelegt(vorher)) && !gleich(r, vorher)) return { fremd: true };
      aus.push(vorher);
    } else {
      if (istFremdeRoutine(r, ich)) return { fremd: true };
      aus.push(r);
    }
    gesehen.add(r.id);
  }
  for (const r of alt) if (!gesehen.has(r.id) && istFremdeRoutine(r, ich)) aus.push(r);
  return { liste: aus };
}

/** Die Tage, an denen eine Routine im Log dieser Person abgehakt ist. */
export function erledigtTage(log: Record<string, string[]> | null | undefined, id: string): string[] {
  return Object.entries(log ?? {}).filter(([, ids]) => Array.isArray(ids) && ids.includes(id)).map(([tag]) => tag).sort();
}

export interface FaelligeRoutine {
  routine: Routine; f: Faelligkeit; heuteErledigt: boolean;
  /** Routinen 2 (10.10.): Tagesziel (1 = einfacher Haken) und wie oft heute schon (Zähler / mehrmals täglich). */
  ziel: number; ist: number;
}

/** Zähler je Tag und Routine (Bestand `routinen-person--<person>`, lib/planung/routinen-person.ts). */
export type ZaehlerLog = Record<string, Record<string, number>>;

/** Wie oft heute: der Zähler, sonst (einfacher Haken) 1 bzw. 0; ein erledigter Tag ohne Zähler (alter Haken) zählt als voll. */
export function heuteIst(routine: Pick<Routine, 'id' | 'tagesZiel' | 'uhrzeiten'>, heuteErledigt: boolean, zaehler: ZaehlerLog | null | undefined, heute: string): number {
  const z = zaehler?.[heute]?.[routine.id];
  const ziel = tagesZielVon(routine);
  return typeof z === 'number' && Number.isInteger(z) && z >= 0 ? (heuteErledigt ? Math.max(z, ziel) : z) : (heuteErledigt ? ziel : 0);
}

/**
 * Was heute für eine Person dran ist: aktiv, sichtbar (eigen oder gemeinsam),
 * im gewünschten Space, nach Rhythmus fällig — heute schon Abgehaktes bleibt
 * in der Liste (als erledigt), damit der Haken nicht verschwindet. Pausen und
 * Zeitraum (Routinen 2) nimmt `faelligkeit` mit; `zaehler` liefert „5 von 8“.
 */
export function heuteFaellig(routinen: readonly Routine[], person: string, log: Record<string, string[]> | null | undefined, heute: string, space: SpaceId | 'alle' = 'alle', zaehler?: ZaehlerLog | null): FaelligeRoutine[] {
  return sichtbarFuer(routinen.filter(r => r.aktiv && (space === 'alle' || spaceVonRoutine(r) === space)), person)
    .map(routine => {
      const tage = erledigtTage(log, routine.id);
      const heuteErledigt = tage.includes(heute);
      return { routine, f: faelligkeit(routine, tage, heute), heuteErledigt, ziel: tagesZielVon(routine), ist: heuteIst(routine, heuteErledigt, zaehler, heute) };
    })
    .filter(x => x.f.faellig || x.heuteErledigt);
}

/** Blöcke einer Person, nach Wochentag, Beginn und Rang. */
export function bloeckeFuer(bloecke: readonly Block[] | undefined, person: string, wochentag?: Wochentag): Block[] {
  return (bloecke ?? [])
    .filter(b => b.owner === person && (wochentag == null || b.wochentag === wochentag))
    .sort((a, b) => a.wochentag - b.wochentag || (a.rang ?? 999) - (b.rang ?? 999) || a.von.localeCompare(b.von));
}

/** Schnellstart: Mo–Fr ein Business-Block — der Rest der Woche ist privat. */
export function standardBloecke(person: string, von = '09:00', bis = '18:00'): Block[] {
  return ([1, 2, 3, 4, 5] as Wochentag[]).map(wt => ({ id: `bl-${person}-${wt}-std`, owner: person, wochentag: wt, von, bis, art: 'business' as const, titel: 'Arbeit', rang: 1 }));
}

/**
 * Gehört eine Routine-Kategorie zur Gesundheit? (10.10.) „Erholung“ ist eine Gesundheits-Kategorie — zählt im Gesundheits-Index, auf der
 * Energie-Seite und in den Lichtfäden wie „Gesundheit“. Ohne Kategorie (Altbestand) gilt wie bisher Gesundheit.
 */
export const istGesundheitsKategorie = (k: unknown): boolean => !k || k === 'gesundheit' || k === 'erholung';

/** Welche Kategorie passt in welchen Bereich (Editor, Prüf-Fund 11.10.): Business nur „Business“, Privat alles außer „Business“. */
export const kategoriePasst = (space: SpaceId | undefined, kategorie: Routine['kategorie']): boolean => (space === 'business' ? kategorie === 'business' : kategorie !== 'business');
