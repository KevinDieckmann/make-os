// ─── MAKE OS — Gesellschafts-Register: Lesen und Schreiben (Server, 04.10.) ──────────────────────────────────────
// EINE Schreibstelle für den Speicher `gesellschaften--<haushalt>` — die Register-Route (/api/gesellschaften) und die
// Absender-Route (/api/crm/gesellschaften) schreiben beide hierüber: eine Sperre, ein Stand (Fingerabdruck des ganzen
// Eintrags), ein Protokoll. Regeln rein in ./modell.ts.
// Zugang entscheidet die Route (Haushalt des Inhabers + Person mit Haushalt); hier wird nur noch je Haushalt gelesen.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { gesellschaftenName } from '@/lib/crm/gesellschaften';
import { istGesellschaft, type GesellschaftId, type Gesellschaftskennung } from '@/lib/einheiten';
import { inPapierkorb, ausPapierkorb, imPapierkorb } from '@/lib/eintraege/sicher';
import {
  alleGesellschaften, gesellschaftVon, steckbriefAnwenden, gesellschafterSaeubern, beteiligungSaeubern, vertragSaeubern,
  eintragAktion, gesellschaftArchiv, gesellschaftVerweise, verweiseAnzahl, verweiseSatz, registerAufraeumen, eintragVerweise, eintragVerweiseSatz, GRENZEN, PRAEFIX,
  type RegisterDatei, type RegisterGesellschaft, type RegisterFehler, type RegisterListe, type EintragAktion, type CrmVerweisTeil,
  beschlussSaeubern, organSaeubern, fassungSaeubern, faelligeErinnerungen, geloeschtVermerken, operativeBusinessGesellschaft,
  type Gesellschafter, type FremdBeteiligung, type Vertrag, type Beschluss, type Organ, type Fassung, type ListenEintrag,
} from './modell';
import { braucheNummer, naechsteNummer, steckbriefNachziehen } from './beschluesse';

export const registerName = gesellschaftenName;
export const standVon = (g: RegisterGesellschaft) => fingerabdruck(g as unknown as Record<string, unknown>);

export async function ladeRegister(haushalt: string): Promise<RegisterDatei | null> {
  return loadJson<RegisterDatei>(registerName(haushalt));
}

/**
 * Vorgabe für Absender und Rechnung dieses Haushalts (08.10., Sofort-Paket 3.2): die operative Business-Gesellschaft aus dem Register
 * (`operativeBusinessGesellschaft`, Holding-Rückfall wie im Business-Index), sonst `null` — dann wählt der Mensch.
 */
export async function absenderVorgabe(haushalt: string | null | undefined): Promise<Gesellschaftskennung | null> {
  const { HOLDING_VORGABE } = await import('@/lib/business/register');
  return operativeBusinessGesellschaft(haushalt ? await ladeRegister(haushalt) : null, HOLDING_VORGABE);
}

/** Nur die Felder, die Deals/Mandate/Produkte für die Verweis-Prüfung brauchen (ohne Personendaten). */
export async function crmVerweisTeil(): Promise<CrmVerweisTeil> {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const c = await ladeCrm().catch(() => null);
  return { chancen: c?.chancen ?? [], mandate: c?.mandate ?? [], leistungen: c?.leistungen ?? [] };
}

export interface Ergebnis { g?: RegisterGesellschaft; konflikt?: RegisterGesellschaft; fehler?: RegisterFehler[]; status?: number; weg?: true }
/** Was eine Änderung tun will: neuer Eintrag, `null` = endgültig entfernen, oder Fehler (mit Status, Standard 400). */
export type Aenderung = (alt: RegisterGesellschaft, alle: RegisterGesellschaft[]) => { g?: RegisterGesellschaft | null; fehler?: RegisterFehler[]; status?: number };

/**
 * Einen Eintrag ändern — in EINER Sperre, mit Stand (409 + aktueller Eintrag bei veraltetem Stand). Unbekannte Kennung → 404.
 * Andere Einträge und unbekannte Felder bleiben, wie sie sind (Rückweg zum Online-Stand).
 */
export async function registerAendern(haushalt: string, person: string, id: string, stand: unknown, wer: Wer, mut: Aenderung): Promise<Ergebnis> {
  let vorher: RegisterDatei | null = null;
  let ergebnis: Ergebnis = {};
  const nachher = await updateJson<RegisterDatei>(registerName(haushalt), cur => {
    vorher = cur;
    const l = cur?.gesellschaften ?? [];
    const alt = gesellschaftVon(cur, id);
    if (!alt) { ergebnis = { fehler: [{ feld: 'id', text: 'Gesellschaft nicht gefunden.' }], status: 404 }; return cur ?? { gesellschaften: [] }; }
    if (typeof stand !== 'string' || standVon(alt) !== stand) { ergebnis = { konflikt: alt }; return cur ?? { gesellschaften: [] }; }
    const r = mut(alt, alleGesellschaften(cur, { mitPapierkorb: true }));
    if (r.fehler?.length) { ergebnis = { fehler: r.fehler, status: r.status ?? 400 }; return cur ?? { gesellschaften: [] }; }
    // Endgültig Gelöschtes (Gesellschaft, Vertrag) bleibt als Vermerk lesbar — die Unterlagen in der Ablage bleiben (§ 257 HGB).
    const jetzt = new Date().toISOString();
    if (r.g === null) { ergebnis = { weg: true }; return geloeschtVermerken(cur, { ...(cur ?? {}), gesellschaften: l.filter(g => g.id !== id) }, jetzt); }
    const neu: RegisterGesellschaft = { ...r.g!, geaendert: jetzt, geaendertVon: person };
    ergebnis = { g: neu };
    const i = l.findIndex(g => g.id === id);
    return geloeschtVermerken(cur, { ...(cur ?? {}), gesellschaften: i >= 0 ? l.map(g => (g.id === id ? neu : g)) : [...l, neu] }, jetzt);
  });
  if (ergebnis.g || ergebnis.weg) await protokolliereBestand(registerName(haushalt), vorher, nachher, wer);
  return ergebnis;
}

/** Eine neue Gesellschaft (`g-…`) anlegen — Name Pflicht, weitere Steckbrief-Felder optional. */
export async function registerAnlegen(haushalt: string, person: string, felder: Record<string, unknown>, wer: Wer): Promise<Ergebnis> {
  let vorher: RegisterDatei | null = null;
  let ergebnis: Ergebnis = {};
  const nachher = await updateJson<RegisterDatei>(registerName(haushalt), cur => {
    vorher = cur;
    const l = cur?.gesellschaften ?? [];
    if (l.filter(g => !istGesellschaft(g.id)).length >= GRENZEN.gesellschaften) { ergebnis = { fehler: [{ feld: 'id', text: `Höchstens ${GRENZEN.gesellschaften} weitere Gesellschaften.` }], status: 413 }; return cur ?? { gesellschaften: [] }; }
    const jetzt = new Date().toISOString();
    const leer: RegisterGesellschaft = { id: neueKennung('g') as GesellschaftId, angelegt: jetzt };
    const r = steckbriefAnwenden(leer, { status: 'geplant', ...felder, name: felder.name ?? '' }, alleGesellschaften(cur, { mitPapierkorb: true }));
    if (r.fehler.length) { ergebnis = { fehler: r.fehler, status: 400 }; return cur ?? { gesellschaften: [] }; }
    const neu = { ...r.g, geaendert: jetzt, geaendertVon: person };
    ergebnis = { g: neu };
    return { ...(cur ?? {}), gesellschaften: [...l, neu] };
  });
  if (ergebnis.g) await protokolliereBestand(registerName(haushalt), vorher, nachher, wer);
  return ergebnis;
}

// ── Änderungen als reine Bausteine (die Route setzt sie zusammen) ────────────────────────────────────────────────

export const steckbrief = (felder: Record<string, unknown>): Aenderung => (alt, alle) => {
  const r = steckbriefAnwenden(alt, felder, alle);
  return r.fehler.length ? { fehler: r.fehler } : { g: r.g };
};

type Eintrag = ListenEintrag;

/**
 * Einen Listeneintrag anlegen (ohne `eintragId`, Kennung vom Server) oder ändern. `person` = wer schreibt (Fassungen: `von`).
 * Beschluss-Buch (10.10.): die Nummer vergibt NUR diese Stelle (beim ersten „nicht mehr Entwurf“, je Gesellschaft und Jahr, nie umgeschrieben);
 * Fassungen werden nie geändert (409) — eine NEUE Fassung, die heute gilt und die jüngste ihres Merkmals ist, zieht das Steckbrief-Feld im selben
 * Schreiben nach (der Steckbrief zeigt die gültige Fassung).
 */
export const eintragSchreiben = (liste: RegisterListe, roh: unknown, eintragId?: string, person = ''): Aenderung => alt => {
  const l = (alt[liste] ?? []) as Eintrag[];
  const vorhanden = eintragId ? l.find(e => e.id === eintragId) : undefined;
  if (eintragId && !vorhanden) return { fehler: [{ feld: 'eintragId', text: 'Eintrag nicht gefunden.' }], status: 404 };
  // Nie still doppelt (Fund 12.10.): ohne `eintragId` vergibt der Server die Kennung — trägt der Körper aber die Kennung eines schon vorhandenen Eintrags
  // (auch im Papierkorb), wäre das ein gemeinter Änderungsversuch ohne `eintragId`; der würde sonst eine Dublette mit neuer Kennung anhängen.
  const mitgeschickt = !eintragId && roh && typeof roh === 'object' ? (roh as { id?: unknown }).id : undefined;
  if (typeof mitgeschickt === 'string' && mitgeschickt && l.some(e => e.id === mitgeschickt)) {
    return { fehler: [{ feld: 'eintragId', text: 'Diesen Eintrag gibt es schon — zum Ändern die eintragId mitschicken. Es wurde nichts angelegt.' }], status: 409 };
  }
  if (!vorhanden && l.length >= GRENZEN[liste]) return { fehler: [{ feld: liste, text: `Höchstens ${GRENZEN[liste]} Einträge.` }], status: 413 };
  const mitId = vorhanden ? roh : { ...((roh && typeof roh === 'object' ? roh : {}) as object), id: neueKennung(PRAEFIX[liste]) };
  const jetzt = new Date().toISOString();
  const heute = localDay();
  if (liste === 'fassungen') {
    if (vorhanden) return { fehler: [{ feld: 'eintragId', text: 'Eine Fassung wird nie überschrieben — lege eine neue Fassung an; eine falsche geht in den Papierkorb.' }], status: 409 };
    const f = fassungSaeubern(mitId, { jetzt, person, beschluesse: alt.beschluesse ?? [] });
    if (f.fehler.length || !f.e) return { fehler: f.fehler };
    const mitFassung: RegisterGesellschaft = { ...alt, fassungen: [...l as Fassung[], f.e] };
    const nach = steckbriefNachziehen(mitFassung, f.e, heute);
    // Eine Herabsetzung unter das schon Eingezahlte zieht der Steckbrief nicht still nach — die Karte zeigt die Abweichung („Steckbrief angleichen“).
    const passt = nach && !(nach.feld === 'stammkapitalCent' && typeof alt.eingezahltCent === 'number' && alt.eingezahltCent > (nach.wert as number));
    return { g: nach && passt ? { ...mitFassung, [nach.feld]: nach.wert } : mitFassung };
  }
  const r: { e?: Eintrag; fehler: RegisterFehler[] } = liste === 'gesellschafter' ? gesellschafterSaeubern(mitId, alt.id, vorhanden as Gesellschafter | undefined)
    : liste === 'beteiligungen' ? beteiligungSaeubern(mitId, vorhanden as FremdBeteiligung | undefined)
      : liste === 'beschluesse' ? beschlussSaeubern(mitId, vorhanden as Beschluss | undefined, alt, { jetzt, heute })
        : liste === 'organe' ? organSaeubern(mitId, vorhanden as Organ | undefined)
          : vertragSaeubern(mitId, vorhanden as Vertrag | undefined);
  if (r.fehler.length || !r.e) return { fehler: r.fehler };
  let e = r.e;
  if (liste === 'beschluesse' && braucheNummer(e as Beschluss, vorhanden as Beschluss | undefined)) {
    const b = e as Beschluss;
    e = { ...b, nummer: naechsteNummer((l as Beschluss[]).filter(x => x.id !== b.id), Number(b.datum.slice(0, 4))) };
  }
  const neu = vorhanden ? l.map(x => (x.id === vorhanden.id ? e : x)) : [...l, e];
  return { g: { ...alt, [liste]: neu } };
};

/**
 * Archivieren/Zurückholen/Papierkorb/Wiederherstellen eines Listeneintrags; `endgueltig` nur aus dem Papierkorb und nur ohne Verweise
 * (Prüf-Fund 11.10.: Beschlüsse auf Gesellschafter/Organe/Verträge, Fassungen auf Beschlüsse, `ereignisVerweise` = Schild-Ereignisse auf
 * einen Beschluss) — sonst 409 mit der Anzahl.
 */
export const eintragHandeln = (liste: RegisterListe, eintragId: string, aktion: EintragAktion | 'endgueltig', ereignisVerweise = 0): Aenderung => alt => {
  const l = (alt[liste] ?? []) as Eintrag[];
  const e = l.find(x => x.id === eintragId);
  if (!e) return { fehler: [{ feld: 'eintragId', text: 'Eintrag nicht gefunden.' }], status: 404 };
  if (liste === 'fassungen' && (aktion === 'archivieren' || aktion === 'zurueckholen')) return { fehler: [{ feld: 'aktion', text: 'Fassungen werden nicht archiviert — eine neue Fassung löst die alte ab; eine falsche geht in den Papierkorb.' }], status: 400 };
  if (aktion === 'endgueltig') {
    if (!imPapierkorb(e)) return { fehler: [{ feld: 'aktion', text: 'Endgültig löschen geht nur aus dem Papierkorb.' }], status: 409 };
    const n = eintragVerweise(alt, liste, eintragId);
    if (n || ereignisVerweise) return { fehler: [{ feld: 'aktion', text: eintragVerweiseSatz(liste, n, ereignisVerweise) }], status: 409 };
    return { g: { ...alt, [liste]: l.filter(x => x.id !== eintragId) } };
  }
  const neu = eintragAktion(liste, e, aktion, localDay(), new Date().toISOString());
  return { g: { ...alt, [liste]: l.map(x => (x.id === eintragId ? neu : x)) } };
};

/**
 * Die Gesellschaft selbst: archivieren (ruhend/aufgelöst), zurückholen, in den Papierkorb, wiederherstellen, endgültig.
 * Die drei festen Gesellschaften lassen sich nur archivieren (sie kommen aus lib/einheiten.ts). Endgültig nur aus dem
 * Papierkorb und nur ohne Verweise (Deals, Mandate, Produkte, Gesellschafter-/Vertrags-Verweise, Nachfolger) → sonst 409.
 */
export const gesellschaftHandeln = (aktion: EintragAktion | 'endgueltig', crm: CrmVerweisTeil, ziel?: 'ruhend' | 'aufgeloest'): Aenderung => (alt, alle) => {
  if (aktion === 'archivieren' || aktion === 'zurueckholen') return { g: gesellschaftArchiv(alt, aktion, ziel) };
  if (istGesellschaft(alt.id)) return { fehler: [{ feld: 'aktion', text: 'Die drei festen Gesellschaften lassen sich nicht löschen — „ruhend“ oder „aufgelöst“ stellen.' }], status: 409 };
  if (aktion === 'loeschen') return { g: inPapierkorb(alt, new Date().toISOString()) };
  if (aktion === 'wiederherstellen') return { g: ausPapierkorb(alt) };
  if (!imPapierkorb(alt)) return { fehler: [{ feld: 'aktion', text: 'Endgültig löschen geht nur aus dem Papierkorb.' }], status: 409 };
  const v = gesellschaftVerweise(alt.id, alle, crm);
  if (verweiseAnzahl(v)) return { fehler: [{ feld: 'aktion', text: `${verweiseSatz(v)} Erst die Verweise lösen — so lange bleibt sie im Papierkorb.` }], status: 409 };
  return { g: null };
};

/** Kennungen der Beschlüsse, auf die ein Ereignis des Schilds zeigt (`Ereignis.beschlussId`, auch im Papierkorb des Schilds). Wirft nie. */
export async function schildBeschlussVerweise(haushalt: string, gesellschaftId?: string): Promise<Set<string>> {
  try {
    const { ladeSchild } = await import('./schild-server');
    const d = await ladeSchild(haushalt);
    return new Set((d?.gesellschaften ?? []).filter(x => !gesellschaftId || x.id === gesellschaftId).flatMap(x => (x.ereignisse ?? []).map(e => e.beschlussId).filter((b): b is string => !!b)));
  } catch { return new Set(); }
}

/** Morgenlauf-Schritt „Gesellschaften-Papierkorb“: liest erst ohne Sperre, schreibt nur, wenn etwas fällig ist. */
export async function registerPapierkorbAufraeumen(haushalt: string, jetzt = new Date()): Promise<{ eintraege: number }> {
  const iso = jetzt.toISOString();
  const crm = await crmVerweisTeil();
  // Beschlüsse, auf die ein Ereignis des Schilds zeigt, bleiben im Papierkorb (Prüf-Fund 11.10.).
  const geschuetzt = await schildBeschlussVerweise(haushalt);
  if (!registerAufraeumen(await ladeRegister(haushalt), crm, iso, geschuetzt).n) return { eintraege: 0 };
  let n = 0;
  let vorher: RegisterDatei | null = null;
  const nachher = await updateJson<RegisterDatei>(registerName(haushalt), cur => {
    vorher = cur;
    const r = registerAufraeumen(cur, crm, iso, geschuetzt);
    n = r.n;
    return (r.d ?? cur) as RegisterDatei;
  });
  if (n) await protokolliereBestand(registerName(haushalt), vorher, nachher, { art: 'system' } as Wer);
  return { eintraege: n };
}

/**
 * Erinnerung vor „kündigen bis“ (04.10. Nachtrag): je fälligem Vertrag EINE Aufgabe (feste Kennung `vte-…`, Business, beide)
 * über den Aufgaben-Schreibweg — gibt es sie schon (auch erledigt oder im Papierkorb), passiert nichts — und nur für eine NEU
 * angelegte eine Meldung in der Glocke an jede Person des Haushalts. Läuft im Morgenlauf und nach jeder Vertragsänderung.
 * Wirft nie; ohne Haushalt nichts.
 */
export async function vertragsErinnerungen(haushalt: string, heute = localDay()): Promise<{ neu: number }> {
  try {
    const { alleGesellschaften } = await import('./modell');
    const faellig = faelligeErinnerungen(alleGesellschaften(await ladeRegister(haushalt)), heute);
    if (!faellig.length) return { neu: 0 };
    const [{ systemAufgabenAendern }, { WEG }, { rechtPersonen }] = await Promise.all([import('@/lib/aufgaben/system-schreiben'), import('@/lib/wege'), import('@/lib/recht/server')]);
    // Zuständig/beteiligt nur Konten mit Zugang zur Firmen-Akte (Prüf-Fund 11.10., wie das Schild) — nie Konten „nur Business“.
    const personen = await rechtPersonen(haushalt);
    const zustaendig = personen.length ? { assignee: personen[0], ...(personen.length > 1 ? { beteiligte: personen.slice(1) } : {}) } : { assignee: 'both' };
    const jetzt = new Date().toISOString();
    let neu: typeof faellig = [];
    await systemAufgabenAendern(stand => {
      const da = new Set(stand.tasks.map(t => t.id));
      neu = faellig.filter(e => !da.has(e.aufgabeId));
      return {
        neu: neu.map(e => ({
          id: e.aufgabeId, title: e.titel, description: e.beschreibung, status: 'todo',
          // Der Weg zum Vertrag (kein Datenpunkt ins Leere): Link in der Notiz, sichere Markdown-Teilmenge (lib/aufgaben/notiz.ts).
          notiz: `[Vertrag im Register öffnen](${WEG.unternehmen(e.gesellschaftId, 'vertraege')})`, priority: 'high', ...zustaendig, dueDate: e.kuendigenBis,
          tags: ['vertrag', 'gesellschaft'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, space: 'business',
          ...(istGesellschaft(e.gesellschaftId) ? { spaceId: e.gesellschaftId } : {}),
        })),
      };
    }, { jetzt });
    if (neu.length) {
      // Glocke NUR an Konten mit Zugang zur Firmen-Akte (Prüf-Fund 11.10., wie das Schild) — nie an Konten „nur Business“.
      const { melde } = await import('@/lib/meldungen/melden');
      for (const e of neu) for (const an of personen) await melde({ an, art: 'vertrag', titel: e.titel, link: WEG.unternehmen(e.gesellschaftId, 'vertraege'), bezug: { art: 'aufgabe', id: e.aufgabeId } });
    }
    return { neu: neu.length };
  } catch (e) {
    console.error('[gesellschaften] Erinnerungen nicht angelegt:', e instanceof Error ? e.message : e);
    return { neu: 0 };
  }
}
