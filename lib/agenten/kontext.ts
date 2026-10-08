// ─── Agenten-Bereich: Kontext je Head — NUR aus seinem Bereich (09.10., Paket 1 „Kern“; AGENTEN_KONZEPT.md C3) ────────────
// Entscheidungen (Fragerunde Teil 1 Nr. 1): „Wenn ich auf Heads bin, chatte ich im nächsten Fenster auch nur mit ihnen.“ Ein Head sieht nur
// die Daten seines Bereichs — gebaut aus den VORHANDENEN Lesewegen, nie aus einem zweiten:
//   heads       Sales · Marketing · Event: das Datenpaket der Heads (lib/heads/paket.ts `vollesPaket`, Modus „frage“) über die Kartei
//               ohne Art.-18-Kontakte (`kontakteFuerVerarbeitung`).
//   finanzchef  Finance: das Finanzbild (lib/finanzen/chef) — Business nur den Business-Teil, Finanzen privat den Haushaltsteil NUR mit
//               privatem Finanzzugang (`KontoSicht.privatFinanzen`).
//   hoi         IT: das Lagebild aus Zählern (lib/hoi) — nie Personen, Adressen, Inhalte.
//   brain       alle anderen: Ausschnitte von `gatherBrain` NUR in den aktiven KI-Kategorien des Heads (Aufgaben nur im Bereich des
//               Heads; Termine nur bei Privat-Heads — Business-Heads fragen `freie_zeit`, das nur Zeiten liefert).
// Ein Recherche-Mitarbeiter mit Web-Agent bekommt KEIN Datenpaket (Map-Reduce, R9: nie Websuche und private Daten im selben Lauf).
// Alles steht in einem Daten-Rahmen; Text Dritter gekapselt. `fremd`/`vertraulich` gehen an den Thread (gespraech-schutz-Regeln).

import { daten } from '@/lib/brain';
import type { HeadDef, KennzahlWert, KiKategorie } from './typen';
import type { KontoSicht } from './sicht';

export interface HeadKontext {
  text: string;
  /** Kategorien, die WIRKLICH im Kontext stehen (KI-Tor, KI-Protokoll). */
  kategorien: KiKategorie[];
  /** Text Dritter im Kontext → am Thread „fremd gelesen“ (schreibende Werkzeuge nur als Vorschlag — im Agenten-Bereich ohnehin). */
  fremd: boolean;
  /** Vertrauliches im Kontext (CRM, Termine, Finanzen, Postfach) → Web-Agenten danach nur als Vorschlag (#91). */
  vertraulich: boolean;
  /** Ruhiger Hinweis, wenn der Bereich nichts liefern darf (Schalter aus, Zugang fehlt). */
  hinweis?: string;
}

const LEER = (hinweis: string): HeadKontext => ({ text: `KONTEXT: ${hinweis}`, kategorien: ['allgemein'], fremd: false, vertraulich: false, hinweis });

/** Kontext für einen Head (bzw. einen Mitarbeiter in dessen Bereich). `kategorien` = die aktiven des Heads (Schalter, Einwilligung). */
export async function kontextFuer(o: { head: HeadDef; sicht: KontoSicht; kategorien: readonly KiKategorie[]; webMitarbeiter?: boolean; heute?: string }): Promise<HeadKontext> {
  const { head, sicht } = o;
  if (o.webMitarbeiter) return { text: 'KONTEXT: Recherche-Auftrag — bewusst ohne Datenpaket (keine privaten Daten im selben Lauf wie die Websuche). Arbeite nur mit dem Auftrag.', kategorien: ['allgemein'], fremd: false, vertraulich: false };
  const { localDay } = await import('@/lib/zeit');
  const heute = o.heute ?? localDay();
  const kats = new Set(o.kategorien);
  try {
    if (head.kontext === 'heads') return await headsKontext(head, sicht.person, kats, heute);
    if (head.kontext === 'finanzchef') return await finanzKontext(head, sicht, kats);
    if (head.kontext === 'hoi') return await hoiKontext();
    return await brainKontext(head, sicht.person, kats, heute);
  } catch (e) {
    return LEER(`Daten des Bereichs gerade nicht lesbar (${e instanceof Error ? e.message.slice(0, 80) : 'Fehler'}) — sag das offen und erfinde nichts.`);
  }
}

async function headsKontext(head: HeadDef, person: string, kats: Set<KiKategorie>, heute: string): Promise<HeadKontext> {
  if (!kats.has('crm')) return LEER('Die Markttraktion ist für die KI ausgeschaltet (System › Datenschutz) — ohne sie hat dieser Head keine Daten.');
  const [{ kontakteFuerVerarbeitung }, { ladeCrm }, { vollesPaket }, { datenBlock, HEADS }, { standName, leererStand }, { loadJson }] = await Promise.all([
    import('@/lib/crm/verarbeitung'), import('@/lib/crm/speicher'), import('@/lib/heads/paket'), import('@/lib/heads/prompt'), import('@/lib/heads/stand'), import('@/lib/store/local-db'),
  ]);
  const id = HEADS.find(h => h === head.id);
  if (!id) return LEER('Für diesen Head gibt es kein Datenpaket.');
  let kontakte = await kontakteFuerVerarbeitung();
  const mitTermin = kats.has('kalender');
  // Termin-Zeiten der Meetings (maskiert je Person) nur, wenn der Kalender für die KI an ist.
  if (mitTermin) { const { kontakteMitTerminZeitenLesen } = await import('@/lib/crm/termin-zeiten-server'); kontakte = await kontakteMitTerminZeitenLesen(kontakte, person); }
  const stand = { ...leererStand(), ...((await loadJson<import('@/lib/heads/stand').HeadStand>(standName(id))) ?? {}) };
  const paket = vollesPaket(id, 'frage', kontakte, await ladeCrm(), heute, person, stand);
  return {
    text: `DATENPAKET DES BEREICHS (Markttraktion, nur lesen — Kennungen aus diesen Daten verwenden):\n${datenBlock(paket)}`,
    kategorien: ['allgemein', 'crm', ...(mitTermin ? ['kalender' as const] : [])], fremd: true, vertraulich: true,
  };
}

async function finanzKontext(head: HeadDef, sicht: KontoSicht, kats: Set<KiKategorie>): Promise<HeadKontext> {
  if (!kats.has('finanzen')) return LEER('Finanzen sind für die KI ausgeschaltet (System › Datenschutz).');
  const { ladeFinanzbild } = await import('@/lib/finanzen/chef/lauf');
  if (head.bereich === 'business') {
    const { bild } = await ladeFinanzbild(null);
    const teil = { stichtag: bild.stichtag, business: bild.business, steuern: bild.steuern, hinweise: bild.hinweise.filter(h => h.bereich !== 'haushalt' && h.bereich !== 'gesamt') };
    return { text: `FINANZBILD BUSINESS (nur die Business-Gesellschaften; Hinweis, keine Steuerberatung):\n${daten('finanzbild', JSON.stringify(teil))}`, kategorien: ['allgemein', 'finanzen'], fremd: false, vertraulich: true };
  }
  if (!sicht.privatFinanzen) return LEER('Kein Zugang zu den privaten Haushaltsfinanzen.');
  const { haushaltFuer } = await import('@/lib/finanzen/haushalt/zugriff');
  const h = await haushaltFuer(sicht.person);
  if (!h) return LEER('Kein Zugang zu den privaten Haushaltsfinanzen.');
  const { bild } = await ladeFinanzbild(h.haushalt);
  const teil = { stichtag: bild.stichtag, haushalt: bild.haushalt, gesamt: bild.gesamt, entnahmen_abgleich: bild.entnahmen_abgleich, steuern: bild.steuern, hinweise: bild.hinweise.filter(x => x.bereich !== 'business') };
  return { text: `FINANZBILD PRIVAT (Haushalt; Hinweis, keine Steuer- oder Anlageberatung):\n${daten('finanzbild', JSON.stringify(teil))}`, kategorien: ['allgemein', 'finanzen'], fremd: false, vertraulich: true };
}

async function hoiKontext(): Promise<HeadKontext> {
  const { lage } = await import('@/lib/hoi/innen');
  const l = await lage();
  const befunde = l.befunde.map(b => ({ bereich: b.bereich, label: b.label, ampel: b.ampel, wert: b.wert, satz: b.satz }));
  return { text: `LAGEBILD BETRIEB (nur Zähler und Zustände):\n${daten('lagebild', JSON.stringify({ gesamt: l.gesamt, kurz: l.kurz, befunde }))}`, kategorien: ['allgemein'], fremd: false, vertraulich: false };
}

async function brainKontext(head: HeadDef, person: string, kats: Set<KiKategorie>, heute: string): Promise<HeadKontext> {
  const { gatherBrain, blockAufgaben, blockZahlen, blockPipeline, blockTermine, blockVitals, blockZiele, kalenderImPrompt } = await import('@/lib/brain');
  const { spaceVonAufgabe } = await import('@/lib/make-one/space-regeln');
  const b = await gatherBrain(heute, person);
  const teile: string[] = [];
  const genutzt = new Set<KiKategorie>(['allgemein']);
  let fremd = false, vertraulich = false;
  if (kats.has('aufgaben')) {
    const imBereich = <T extends { id: string; title: string; projectId?: string; space?: string; spaceId?: string; description?: string }>(l: readonly T[]) =>
      l.filter(t => (spaceVonAufgabe({ ...t, projectId: t.projectId ?? '' } as Parameters<typeof spaceVonAufgabe>[0]) === 'privat' ? 'privat' : 'business') === head.bereich);
    teile.push(blockAufgaben({ ...b, tasks: { ...b.tasks, offen: imBereich(b.tasks.offen), overdue: imBereich(b.tasks.overdue), dueToday: imBereich(b.tasks.dueToday), kritisch: imBereich(b.tasks.kritisch) } }));
    genutzt.add('aufgaben'); vertraulich = true;
  }
  if (head.bereich === 'business' && kats.has('finanzen')) { teile.push(daten('zahlen', blockZahlen(b))); genutzt.add('finanzen'); vertraulich = true; }
  if (head.bereich === 'business' && kats.has('crm')) { teile.push(blockPipeline(b)); genutzt.add('crm'); vertraulich = true; }
  if (head.bereich === 'privat' && kats.has('kalender')) { teile.push(blockTermine(b)); genutzt.add('kalender'); vertraulich = true; fremd = kalenderImPrompt(b); }
  // Gesundheit: nur der Head mit der Kategorie und nur mit Einwilligung (b) — gatherBrain liefert dann die EIGENEN Werte.
  if (kats.has('gesundheit') && b.gesundheitFrei === true) { teile.push(daten('koerper', blockVitals(b))); genutzt.add('gesundheit'); }
  if (kats.has('postfach')) {
    const { stromFuer } = await import('@/lib/inbox/strom-server');
    const { lageText } = await import('@/lib/inbox/zoe-sicht');
    const s = await stromFuer(person, { space: head.bereich });
    const namen = Object.fromEntries(s.bereiche.map(x => [x.id, x.name]));
    teile.push(`POSTFÄCHER IM BEREICH (nur Zähler):\n${s.lage.map(l => lageText(l, l.bereich ? namen[l.bereich] ?? l.bereich : 'Ohne Bereich')).join('\n') || 'keins verbunden'}`);
    genutzt.add('postfach'); vertraulich = true;
  }
  if (head.id === 'recht') {
    const p = await datenschutzPunkte(heute).catch(() => null);
    if (p) teile.push(daten('datenschutz', p));
  }
  teile.push(blockZiele(b));
  return { text: `KONTEXT DES BEREICHS (nur lesen):\n${teile.filter(Boolean).join('\n\n')}`, kategorien: Array.from(genutzt), fremd, vertraulich };
}

/** Datenschutz-Selbstprüfung (offene Punkte) für den Head Recht & Datenschutz — nur Titel, Status, Befund (keine Personen). */
async function datenschutzPunkte(heute: string): Promise<string> {
  const [{ kontakteFuerVerarbeitung }, { ladeCrm }, { ladeKonten }, { selbstpruefung }, { LOESCHFRISTEN_SPEICHER, fristenWirksam }, { datenschutzUmfeld }, { loadJson }] = await Promise.all([
    import('@/lib/crm/verarbeitung'), import('@/lib/crm/speicher'), import('@/lib/zugang/konten'), import('@/lib/crm/datenschutz'), import('@/lib/crm/loeschfristen'), import('@/lib/datenschutz/umfeld'), import('@/lib/store/local-db'),
  ]);
  const fristen = fristenWirksam(((await loadJson<import('@/lib/crm/loeschfristen').LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER)) ?? {}).fristen);
  const konten = (await ladeKonten()).konten;
  const p = selbstpruefung(await kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), await ladeCrm(), heute, { konten: konten.length, mitPasswort: konten.filter(k => !!k.hash).length }, fristen.kontakte, await datenschutzUmfeld());
  const offen = p.filter(x => x.status !== 'erfuellt');
  return `DATENSCHUTZ-SELBSTPRÜFUNG: ${p.length - offen.length} von ${p.length} erfüllt.\n${offen.map(x => `- ${x.titel} (${x.status}, ${x.norm}): ${x.befund}`).join('\n')}`;
}

// ── Kennzahlen im Kopf des Heads ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Die Kennzahlen eines Heads mit Beschriftung — Werte aus dem Business-Index (gerechnet wie das Cockpit, gemerkt); die anderen
 * Indizes (Traktion, Privat, Gesundheit) liefern hier vorerst nur die Beschriftung (`wert: null`, Ampel grau) — ihre Werte stehen
 * auf ihren Seiten. Gesundheit nur bei Heads mit der Kategorie (Katalog-Wächter) und damit nur für die Person selbst.
 */
export async function kennzahlWerte(head: HeadDef, person: string): Promise<KennzahlWert[]> {
  if (!head.kennzahlen.length) return [];
  const [{ KENNZAHL }, { TRAKTION_KENNZAHLEN }, { PRIVAT_KENNZAHLEN }, { GESUNDHEIT_KENNZAHLEN }] = await Promise.all([
    import('@/lib/business/register'), import('@/lib/crm/traktion-index'), import('@/lib/privat/index'), import('@/lib/gesundheit/index'),
  ]);
  const label = (index: string, id: string): string => (index === 'business' ? KENNZAHL[id]?.label
    : index === 'traktion' ? TRAKTION_KENNZAHLEN.find(k => k.id === id)?.label
      : index === 'privat' ? PRIVAT_KENNZAHLEN.find(k => k.id === id)?.label
        : GESUNDHEIT_KENNZAHLEN.find(k => k.id === id)?.label) ?? id;
  let business: Map<string, { anzeige: string | null; ampel: KennzahlWert['ampel'] }> | null = null;
  if (head.kennzahlen.some(k => k.index === 'business')) business = await businessWerte(person).catch(() => null);
  return head.kennzahlen.map(k => {
    const w = k.index === 'business' ? business?.get(k.id) : undefined;
    return { id: `${k.index}:${k.id}`, label: label(k.index, k.id), wert: w?.anzeige ?? null, ampel: w?.ampel ?? 'grau' };
  });
}

async function businessWerte(person: string): Promise<Map<string, { anzeige: string | null; ampel: KennzahlWert['ampel'] }>> {
  const { merken } = await import('@/lib/store/memo');
  return merken(`agenten-kennzahlen-business:${person}`, 60_000, async () => {
    const [{ ladeRoh, bestandFuer }, { berechne }, { zeitBildFuer }] = await Promise.all([import('@/lib/business/speicher'), import('@/lib/business/index'), import('@/lib/zeitmessung/speicher')]);
    const zeit = await zeitBildFuer(person).catch(() => null);
    const bi = berechne(bestandFuer(await ladeRoh(), 'gesamt', zeit));
    const m = new Map<string, { anzeige: string | null; ampel: KennzahlWert['ampel'] }>();
    for (const s of bi.saeulen) for (const k of s.kennzahlen) m.set(k.id, { anzeige: k.anzeige, ampel: k.ampel });
    return m;
  });
}
