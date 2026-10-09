// ─── Agenten-Bereich: Kontext je Head — NUR aus seinem Bereich (09.10., Paket 1 „Kern“; AGENTEN_KONZEPT.md C3) ────────────
// Entscheidungen (Fragerunde Teil 1 Nr. 1): „Wenn ich auf Heads bin, chatte ich im nächsten Fenster auch nur mit ihnen.“ Ein Head sieht nur
// die Daten seines Bereichs — gebaut aus den VORHANDENEN Lesewegen, nie aus einem zweiten:
//   heads       Sales · Marketing · Event: das Datenpaket der Heads (lib/heads/paket.ts `vollesPaket`, Modus „frage“) über die Kartei
//               ohne Art.-18-Kontakte (`kontakteFuerVerarbeitung`).
//   finanzchef  Finance: das Finanzbild (lib/finanzen/chef) — Business nur den Business-Teil, Finanzen privat den Haushaltsteil NUR mit
//               privatem Finanzzugang (`KontoSicht.privatFinanzen`).
//   hoi         IT: das Lagebild aus Zählern (lib/hoi) — nie Personen, Adressen, Inhalte.
//   brain       alle anderen: Ausschnitte von `gatherBrain` NUR in den aktiven KI-Kategorien des Heads (Aufgaben nur im Bereich des
//               Heads; Termine nur bei Privat-Heads — Business-Heads fragen `freie_zeit`, das nur Zeiten liefert). Seit dem Feinschliff
//               (09.10.) dazu Familie (`familienTeil` → lib/familie/logik.ts `familieAuszug`) und Ernährung (`ernaehrungTeil` →
//               `profileFuerBetrachter`) — je über die EINE Filterstelle ihres Moduls.
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
  // Feinschliff 09.10.: Familie und Ernährung bekommen ihren Bestand — je über die EINE Filterstelle ihres Moduls.
  let hinweis: string | undefined;
  if (head.id === 'familie') {
    const t = await familienTeil(person, heute, kats);
    if (t.text) { teile.push(t.text); genutzt.add('familie'); vertraulich = true; fremd = true; }
    hinweis = t.hinweis;
  }
  if (head.id === 'ernaehrung') {
    const t = await ernaehrungTeil(person, kats);
    if (t.text) { teile.push(t.text); fremd = true; vertraulich = true; if (t.gesundheit) genutzt.add('gesundheit'); }
  }
  teile.push(blockZiele(b));
  return { text: `KONTEXT DES BEREICHS (nur lesen):\n${teile.filter(Boolean).join('\n\n')}`, kategorien: Array.from(genutzt), fremd, vertraulich, ...(hinweis ? { hinweis } : {}) };
}

/**
 * Familie & Partnerschaft: der Bestand `familie--<haushalt>` der Person — NUR über `familieAuszug` (lib/familie/logik.ts → `familieFuerPerson`:
 * „nur ich“ und ungeteilte Reflexionen der anderen Person nie; nur Titel, Datum, Art, Status — nie Gefühle oder Reflexionstexte).
 * An die KI nur, wenn der Bereich „Familie“ an ist UND ein Weg mit der Mindeststufe (EU, lib/ki/anbieter.ts) offen — sonst bleibt der
 * Auszug draußen und der Head sagt es (statt dass der ganze Aufruf gesperrt wird). Lesen schreibt nie (kein Startbestand).
 */
export async function familienTeil(person: string, heute: string, kats: ReadonlySet<KiKategorie>): Promise<{ text: string; hinweis?: string }> {
  if (!kats.has('familie')) return { text: '', hinweis: 'Familie & Partnerschaft ist für die KI ausgeschaltet (System › Datenschutz) — der Head sieht die Einträge nicht.' };
  const { kategorienMoeglich } = await import('@/lib/ki/tor');
  if (!(await kategorienMoeglich(['familie']).catch(() => false))) return { text: '', hinweis: 'Familien-Einträge gehen nur über einen KI-Weg in der EU an das Modell — der ist noch nicht eingerichtet (System › Datenschutz › KI).' };
  const [{ haushaltFuer }, { loadJson }, { familieName, startBestand }, { familieAuszug }] = await Promise.all([
    import('@/lib/finanzen/haushalt/zugriff'), import('@/lib/store/local-db'), import('@/lib/familie/speicher'), import('@/lib/familie/logik'),
  ]);
  const h = await haushaltFuer(person);
  if (!h) return { text: '', hinweis: 'Familie & Partnerschaft gibt es nur für Konten mit Haushalt.' };
  const roh = await loadJson<import('@/lib/familie/typen').Familie>(familieName(h.haushalt));
  if (!roh) return { text: daten('familie', 'Noch nichts eingetragen.') };
  const a = familieAuszug({ ...startBestand(new Date().toISOString()), ...roh }, person, heute);
  return { text: `FAMILIE & PARTNERSCHAFT (nur Titel, Datum, Art — nie Gefühle):\n${daten('familie', a.text)}` };
}

/**
 * Ernährung & Einkauf: Plan, Einkaufsliste und gespeicherte Gerichte (gemeinsam im Haushalt). Profile NUR über `profileFuerBetrachter`
 * (eigene, Gäste, und fremde nur, wenn die Person ihre Gesundheit teilt) und dann `profilFuerKi`: mit der Kategorie Gesundheit ((a)+(b) der
 * fragenden Person) und der Einwilligung der Profil-Inhaberin (eigene (b), fremde (b)+(c)+Teilen — `gesundheitFuerZoe`) vollständig, sonst
 * nur Küchenregeln („nie“). Profile ohne Namen (eigenes / geteilt / Gast) — Vorschläge bleiben personenneutral.
 */
export async function ernaehrungTeil(person: string, kats: ReadonlySet<KiKategorie>): Promise<{ text: string; gesundheit: boolean }> {
  const [{ loadJson }, M, { profilFuerKi }, { kontoFuerSpeicher }] = await Promise.all([
    import('@/lib/store/local-db'), import('@/lib/ernaehrung/modell'), import('@/lib/datenschutz/gesundheit-ki'), import('@/lib/zugang/konten'),
  ]);
  const f = M.sauberDatei(await loadJson<import('@/lib/ernaehrung/modell').ErnaehrungFile>('ernaehrung'));
  const fremde = Array.from(new Set(f.profile.filter(p => p.konto && p.person !== person).map(p => p.person)));
  const teilt = new Set<string>();
  for (const p of fremde) if ((await kontoFuerSpeicher(p).catch(() => null))?.teilt?.gesundheit?.includes(person)) teilt.add(p);
  const sichtbar = M.profileFuerBetrachter(f.profile, person, teilt);
  let gesundheit = false;
  const profile: string[] = [];
  let gast = 0;
  for (const p of sichtbar) {
    let frei = false;
    if (p.konto && kats.has('gesundheit')) {
      const { gesundheitFuerZoe } = await import('@/lib/datenschutz/gesundheit-einwilligung');
      frei = await gesundheitFuerZoe(p.person, person).catch(() => false);
    }
    const x = profilFuerKi(p, frei);
    if (frei && (x.bedarf || x.ziel || x.unvertraeglich.length)) gesundheit = true;
    const wer = !p.konto ? `Gast ${++gast}` : p.person === person ? 'eigenes Profil' : 'geteiltes Profil (weitere Person im Haushalt)';
    const teile = [x.bedarf ? `Bedürfnisse: ${x.bedarf}` : '', x.unvertraeglich.length ? `verträgt nicht: ${x.unvertraeglich.join(', ')}` : '', x.nie.length ? `nie: ${x.nie.join(', ')}` : '', x.gern.length ? `gern: ${x.gern.join(', ')}` : '', x.ziel ? `Ziel: ${x.ziel}` : ''].filter(Boolean);
    if (teile.length) profile.push(`- ${wer}: ${teile.join(' · ')}`);
  }
  const tage = Object.entries(f.plan).filter(([, m]) => Object.values(m ?? {}).some(Boolean)).map(([t, m]) => `- ${t}: ${Object.entries(m ?? {}).filter(([, v]) => v).map(([k, v]) => `${k} ${String(v).slice(0, 60)}`).join(' · ')}`);
  const einkauf = f.einkauf.filter(e => !e.erledigt).slice(0, 40).map(e => `- ${e.text.slice(0, 60)}${e.menge ? ` (${e.menge.slice(0, 20)})` : ''}`);
  const gerichte = f.gerichte.slice().sort((a, b) => Number(b.favorit) - Number(a.favorit)).slice(0, 30).map(g => `- ${g.favorit ? '★ ' : ''}${g.name.slice(0, 60)}${g.tags.length ? ` [${g.tags.slice(0, 3).join(', ')}]` : ''}`);
  const text = [
    f.grundsaetze ? `Grundsätze: ${f.grundsaetze.slice(0, 600)}` : '',
    `Wochenplan:\n${tage.join('\n') || 'leer'}`,
    `Einkaufsliste (offen):\n${einkauf.join('\n') || 'leer'}`,
    `Gespeicherte Gerichte:\n${gerichte.join('\n') || 'keine'}`,
    profile.length ? `Profile (personenneutral — nenne in Vorschlägen keine Person):\n${profile.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
  return { text: `ERNÄHRUNG & EINKAUF (gemeinsam im Haushalt):\n${daten('ernaehrung', text)}`, gesundheit };
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

type Werte = Map<string, { anzeige: string | null; ampel: KennzahlWert['ampel'] }>;
/** Kennzahl → Anzeige + Ampel aus einem Index des gemeinsamen Kerns (lib/kennzahlen/kern.ts) — nie eine eigene Rechnung. */
const werteAus = (idx: { saeulen: readonly { kennzahlen: readonly { id: string; anzeige: string | null; ampel: KennzahlWert['ampel'] }[] }[] }): Werte => {
  const m: Werte = new Map();
  for (const s of idx.saeulen) for (const k of s.kennzahlen) m.set(k.id, { anzeige: k.anzeige, ampel: k.ampel });
  return m;
};

/**
 * Die Kennzahlen eines Heads mit Beschriftung — Werte aus den vorhandenen Indizes, je gemerkt (`merken`), gerechnet wie auf ihren Seiten:
 *   business    Business-Index (Gesamt, wie das Cockpit)
 *   traktion    Traktions-Index (Sales · Marketing · Event, wie der Markttraktion-Überblick) — nur im Haushalt des Inhabers
 *   privat      Privat-Index des Haushalts — NUR mit privatem Finanzzugang (`KontoSicht.privatFinanzen`)
 *   gesundheit  Gesundheits-Index der EIGENEN Person — NUR mit Einwilligung (a) „verarbeiten“ (der Head gehört der Person; geteilt kommt
 *               im Kopf nicht vor, die Ansicht einer anderen Person zeigt diesen Head gar nicht)
 * Was nicht darf oder nicht lesbar ist: Wert fehlt (`wert: null`, grau) — nie ein Fehler der ganzen Antwort.
 */
export async function kennzahlWerte(head: HeadDef, sicht: KontoSicht): Promise<KennzahlWert[]> {
  if (!head.kennzahlen.length) return [];
  const [{ KENNZAHL }, { TRAKTION_KENNZAHLEN }, { PRIVAT_KENNZAHLEN }, { GESUNDHEIT_KENNZAHLEN }] = await Promise.all([
    import('@/lib/business/register'), import('@/lib/crm/traktion-index'), import('@/lib/privat/index'), import('@/lib/gesundheit/index'),
  ]);
  const label = (index: string, id: string): string => (index === 'business' ? KENNZAHL[id]?.label
    : index === 'traktion' ? TRAKTION_KENNZAHLEN.find(k => k.id === id)?.label
      : index === 'privat' ? PRIVAT_KENNZAHLEN.find(k => k.id === id)?.label
        : GESUNDHEIT_KENNZAHLEN.find(k => k.id === id)?.label) ?? id;
  const braucht = (i: string) => head.kennzahlen.some(k => k.index === i);
  const quellen: Partial<Record<string, Werte | null>> = {};
  if (braucht('business')) quellen.business = await businessWerte(sicht.person).catch(() => null);
  if (braucht('traktion') && sicht.imHaushalt) quellen.traktion = await traktionWerte().catch(() => null);
  if (braucht('privat') && sicht.privatFinanzen) quellen.privat = await privatWerte(sicht.person).catch(() => null);
  if (braucht('gesundheit') && sicht.imHaushalt && sicht.gesundheit.verarbeiten) quellen.gesundheit = await gesundheitWerte(sicht.person).catch(() => null);
  return head.kennzahlen.map(k => {
    const w = quellen[k.index]?.get(k.id);
    return { id: `${k.index}:${k.id}`, label: label(k.index, k.id), wert: w?.anzeige ?? null, ampel: w?.ampel ?? 'grau' };
  });
}

async function businessWerte(person: string): Promise<Werte> {
  const { merken } = await import('@/lib/store/memo');
  return merken(`agenten-kennzahlen-business:${person}`, 60_000, async () => {
    const [{ ladeRoh, bestandFuer }, { berechne }, { zeitBildFuer }] = await Promise.all([import('@/lib/business/speicher'), import('@/lib/business/index'), import('@/lib/zeitmessung/speicher')]);
    const zeit = await zeitBildFuer(person).catch(() => null);
    return werteAus(berechne(bestandFuer(await ladeRoh(), 'gesamt', zeit)));
  });
}

/** Traktions-Index wie der Markttraktion-Überblick (dieselbe Funktion, dieselben Schwellen, ganze Kartei — es wird nur gezählt). */
async function traktionWerte(): Promise<Werte> {
  const [{ merken }, { localDay }] = await Promise.all([import('@/lib/store/memo'), import('@/lib/zeit')]);
  const heute = localDay();
  return merken(`agenten-kennzahlen-traktion:${heute}`, 60_000, async () => {
    const [{ kontakteFuerVerarbeitung }, { ladeCrm }, { traktionsIndex, ersterLauf }, { ladeIndexDatei }] = await Promise.all([
      import('@/lib/crm/verarbeitung'), import('@/lib/crm/speicher'), import('@/lib/crm/traktion-index'), import('@/lib/kennzahlen/speicher'),
    ]);
    const [kontakte, crm, datei] = await Promise.all([kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), ladeCrm(), ladeIndexDatei('traktion-index')]);
    return werteAus(traktionsIndex({ kontakte, crm, heute, schwellen: datei.schwellen, ersterLauf: ersterLauf(datei, heute) }));
  });
}

/** Privat-Index des Haushalts der Person (nur rechnen, nichts schreiben — `privatIndexFuer`). */
async function privatWerte(person: string): Promise<Werte | null> {
  const [{ merken }, { haushaltFuer }] = await Promise.all([import('@/lib/store/memo'), import('@/lib/finanzen/haushalt/zugriff')]);
  const h = await haushaltFuer(person);
  if (!h) return null;
  return merken(`agenten-kennzahlen-privat:${h.haushalt}`, 60_000, async () => {
    const { privatIndexFuer } = await import('@/lib/privat/speicher');
    return werteAus((await privatIndexFuer(h.haushalt)).pi);
  });
}

/** Gesundheits-Index der Person selbst (nur rechnen — `gesundheitsIndexFuer`). */
async function gesundheitWerte(person: string): Promise<Werte> {
  const { merken } = await import('@/lib/store/memo');
  return merken(`agenten-kennzahlen-gesundheit:${person}`, 60_000, async () => {
    const { gesundheitsIndexFuer } = await import('@/lib/gesundheit/speicher');
    return werteAus(await gesundheitsIndexFuer(person));
  });
}
