// ─── Unternehmen › „in einem Blick“: Schild-Ton, Gesundheit in vier Dimensionen, das Wichtigste jetzt (rein, client-sicher, 11.10.) ─────
// Kevin 11.10.: „Unternehmen nochmal ausbauen — denk dran, dass es einfach zu verstehen sein soll über die Visualisierungen. So ist es sehr
// unübersichtlich und keiner versteht, was da los ist.“ EINE Rechnung für den Überblick: je Gesellschaft ein Ton (Schild-Ring), vier Dimensionen
// (Dokumente · Pflichten · Risiken · Schutz) als kleine Balken, „Das Wichtigste jetzt“ (höchstens drei Handgriffe, nach Folge und Frist) und
// Mengen statt Listen. Grundlage ist die Lage (./ampel.ts `gesellschaftLage`) — hier wird nichts neu geprüft, nur gewichtet und in Klartext gesagt.
//
// RUHIGE TONALITÄT (verbindlich, Kevin 11.10.: „nicht alles rot“):
//   rot   = eine Folge droht: eine gesetzliche Frist ist verstrichen, eine Pflicht mit Eskalation (Insolvenzrecht) steht an, ein Schutzrecht ist
//           abgelaufen, ein rotes Risiko hat keine Maßnahme, die Risiken zusammen übersteigen die Tragfähigkeit;
//   gelb  = bald fällig (im Vorlauf) bzw. ein VORSCHLAGS-Termin ist verstrichen, ein Dokument ist abgelaufen oder veraltet, eine Schwelle ist erreicht;
//   ruhig = Lücken ohne Frist (Unterlagen fehlen, Risiken nicht bewertet, Profil leer) — gezählt, nicht laut;
//   grün  = nichts zu tun.
// Die Compliance-Ampel (./ampel.ts, Head of Recht, `?lage=1`) bleibt unverändert — der Ton ist die Sprache der Oberfläche.
// Hinweis, keine Rechtsberatung.

import { aktiveEintraege } from '@/lib/gesellschaften/modell';
import { WEG } from '@/lib/wege';
import type { SchildGesellschaft } from './typen';
import type { GesellschaftLage, Lage, SchildReiter } from './ampel';
import type { PflichtEintrag } from './pflichten';
import { DOK_GRUPPEN, type DokSoll } from './dokumente';
import { markeFristen, domainZustand, policeFristen } from './schutz';
import { tagText } from './zeit';

export type Ton = 'rot' | 'gelb' | 'ruhig' | 'gruen';
export const TON_TEXT: Record<Ton, string> = { rot: 'Folge droht', gelb: 'bald fällig', ruhig: 'Lücken ohne Eile', gruen: 'im Lot' };
/** Ein Satz je Ton — was er bedeutet (Überblick, Legende). */
export const TON_SATZ: Record<Ton, string> = {
  rot: 'Eine Frist ist verstrichen oder ein Schutz abgelaufen — hier droht eine Folge.',
  gelb: 'Etwas ist bald fällig oder sollte geprüft werden.',
  ruhig: 'Es fehlen Unterlagen oder Angaben, aber keine Frist drängt.',
  gruen: 'Nichts zu tun.',
};
const RANG: Record<Ton, number> = { rot: 3, gelb: 2, ruhig: 1, gruen: 0 };
export const schlimmerTon = (a: Ton, b: Ton): Ton => (RANG[a] >= RANG[b] ? a : b);
export const tonRang = (t: Ton) => RANG[t];

export type HandgriffArt = 'pflicht' | 'dokument' | 'risiko' | 'schutz' | 'profil';
export interface Handgriff {
  /** Stabil je Gesellschaft und Gegenstand. */
  id: string;
  gesellschaftId: string;
  gesellschaft: string;
  art: HandgriffArt;
  ton: Ton;
  /** Klartext vorne — was zu tun ist. */
  titel: string;
  /** Ein Satz: welche Folge bzw. welcher Zustand. */
  warum?: string;
  /** Die Norm — nur klein dahinter. */
  norm?: string;
  frist?: string;
  inTagen?: number;
  /** Gebündelt: so viele gleiche Fälle (z. B. mehrere Geschäftsjahre). */
  anzahl?: number;
  /** Höher = zuerst. */
  gewicht: number;
  weg: string;
}

const weg = (r: SchildReiter, id: string) => WEG.schild(r, id);

// ── Pflichten ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Ton einer Pflicht (null = nichts zu tun): verstrichen und gesetzlich → rot; verstrichen, aber nur ein Vorschlagstermin (`annahme`) → gelb;
 * im Vorlauf → gelb, mit Eskalation (Insolvenzrecht) → rot.
 */
export function pflichtTon(p: Pick<PflichtEintrag, 'status' | 'annahme' | 'eskalation'>): Ton | null {
  if (p.status === 'ueberfaellig') return p.annahme ? 'gelb' : 'rot';
  if (p.status === 'faellig') return p.eskalation ? 'rot' : 'gelb';
  return null;
}

function pflichtGriffe(g: GesellschaftLage): Handgriff[] {
  const je = new Map<string, PflichtEintrag[]>();
  for (const p of g.pflichten) {
    if (!pflichtTon(p)) continue;
    const l = je.get(p.regelId) ?? [];
    l.push(p);
    je.set(p.regelId, l);
  }
  const raus: Handgriff[] = [];
  for (const [regel, l] of Array.from(je.entries())) {
    const p = [...l].sort((a, b) => a.frist.localeCompare(b.frist))[0];
    const ton = l.map(x => pflichtTon(x)!).reduce(schlimmerTon);
    const verstrichen = p.status === 'ueberfaellig';
    const gewicht = ton === 'rot'
      ? (p.eskalation ? 1000 : 600) + (p.folge ? 100 : 0) + Math.min(90, Math.max(0, -p.inTagen)) / 3
      : (verstrichen ? 280 : 300) + (p.folge ? 50 : 0) + Math.max(0, 60 - Math.max(0, p.inTagen)) / 2;
    raus.push({
      id: `pf:${g.id}:${regel}`, gesellschaftId: g.id, gesellschaft: g.name, art: 'pflicht', ton,
      titel: l.length > 1 ? p.titel : `${p.titel} (${p.periodeLabel})`,
      warum: p.folge ?? (verstrichen ? (p.annahme ? 'Der vorgeschlagene Termin ist verstrichen.' : 'Die Frist ist verstrichen.') : 'Die Frist naht.'),
      norm: p.norm, frist: p.frist, inTagen: p.inTagen, ...(l.length > 1 ? { anzahl: l.length } : {}), gewicht, weg: weg('pflichten', g.id),
    });
  }
  return raus;
}

// ── Dokumente ────────────────────────────────────────────────────────────────────────────────────────────────────

const GRUPPE_VORRANG: Record<string, number> = { gesellschaft: 20, rechnungslegung: 15, personal: 10, datenschutz: 6, vertraege: 4 };
/** Ton und Gewicht eines Dokuments der Soll-Liste (null = in Ordnung). Ruhig, solange keine Frist drängt; abgelaufen/veraltet = gelb. */
export function dokTon(d: DokSoll): { ton: Ton; gewicht: number } | null {
  const pflicht = d.stufe === 'pflicht';
  const g = GRUPPE_VORRANG[d.katalog.gruppe] ?? 0;
  switch (d.zustand) {
    case 'abgelaufen': return { ton: pflicht ? 'gelb' : 'ruhig', gewicht: (pflicht ? 350 : 110) + g };
    case 'veraltet': return { ton: 'gelb', gewicht: 340 + g };
    case 'fehlt': return { ton: 'ruhig', gewicht: (pflicht ? 150 : 40) + g };
    case 'pruefen': return { ton: 'ruhig', gewicht: (pflicht ? 85 : 30) + g };
    case 'entwurf': return { ton: 'ruhig', gewicht: (pflicht ? 80 : 25) + g };
    default: return null;
  }
}
const DOK_VERB: Partial<Record<DokSoll['zustand'], string>> = { fehlt: 'ablegen', abgelaufen: 'erneuern', veraltet: 'neu einreichen', pruefen: 'prüfen', entwurf: 'fertigstellen' };

function dokGriffe(g: GesellschaftLage): Handgriff[] {
  const raus: Handgriff[] = [];
  for (const d of g.dokumente) {
    const t = dokTon(d);
    if (!t) continue;
    raus.push({
      id: `dk:${g.id}:${d.katalog.art}`, gesellschaftId: g.id, gesellschaft: g.name, art: 'dokument', ton: t.ton,
      titel: `${d.katalog.titel} ${DOK_VERB[d.zustand] ?? 'prüfen'}`, warum: d.grund ?? (d.stufe === 'pflicht' ? 'Pflichtunterlage.' : 'Empfohlen.'),
      norm: d.katalog.norm, ...(d.zustand === 'abgelaufen' && d.dok?.gueltigBis ? { frist: d.dok.gueltigBis } : {}), gewicht: t.gewicht, weg: weg('dokumente', g.id),
    });
  }
  return raus;
}

// ── Risiken ──────────────────────────────────────────────────────────────────────────────────────────────────────

function risikoGriffe(g: GesellschaftLage): Handgriff[] {
  const raus: Handgriff[] = [];
  const w = weg('risiken', g.id);
  const h = (x: Omit<Handgriff, 'gesellschaftId' | 'gesellschaft' | 'art' | 'weg'>): Handgriff => ({ ...x, gesellschaftId: g.id, gesellschaft: g.name, art: 'risiko', weg: w });
  if (g.aggregation.warnung) raus.push(h({ id: `rk:${g.id}:tragfaehigkeit`, ton: 'rot', titel: 'Risiken zusammen über der Tragfähigkeit — mit Kanzlei oder Steuerbüro besprechen', warum: `Die Netto-Wirkungen erreichen ${g.aggregation.anteil} % dessen, was die Gesellschaft tragen kann.`, gewicht: 700 }));
  const offen = g.risiken.filter(r => r.r.status !== 'erledigt');
  for (const r of offen) {
    if (r.ampel === 'rot' && r.ohneMassnahme) raus.push(h({ id: `rk:${g.id}:${r.r.id}`, ton: 'rot', titel: `Maßnahme festlegen: ${r.r.titel}`, warum: 'Rotes Risiko ohne offene Maßnahme.', gewicht: 650 }));
    else if (r.ampel === 'rot' && r.r.behandlung === 'tragen') raus.push(h({ id: `rk:${g.id}:${r.r.id}`, ton: 'ruhig', titel: `Beschluss zum bewusst getragenen Risiko ablegen: ${r.r.titel}`, warum: 'Ein rotes Risiko bewusst zu tragen gehört in einen Beschluss.', gewicht: 120 }));
  }
  if (g.anlaesse.length) raus.push(h({ id: `rk:${g.id}:anlass`, ton: 'gelb', titel: 'Risiken neu bewerten — seit der letzten Runde ist etwas passiert', warum: g.anlaesse.slice(0, 2).map(a => a.text).join(' · '), anzahl: g.anlaesse.length, gewicht: 260 }));
  else if (g.runde.faellig) raus.push(h({ id: `rk:${g.id}:runde`, ton: 'gelb', titel: `Risiken neu bewerten (Quartals-Runde ${g.runde.quartal.replace('-', ' ')})`, warum: 'Alle drei Monate einmal — so bleibt das Bild aktuell.', anzahl: g.runde.anzahl, gewicht: 250 }));
  const unbewertet = offen.filter(r => !r.bewertung).length;
  if (!g.risiken.length) raus.push(h({ id: `rk:${g.id}:leer`, ton: 'ruhig', titel: 'Risiken erfassen (Startkatalog übernehmen)', warum: 'Noch kein Risiko im Register.', gewicht: 100 }));
  else if (unbewertet) raus.push(h({ id: `rk:${g.id}:bewerten`, ton: 'ruhig', titel: 'Risiken bewerten (Eintritt × Wirkung)', warum: `${unbewertet} noch ohne Bewertung.`, anzahl: unbewertet, gewicht: 90 }));
  return raus;
}

// ── Schutz: Marken, Domains, Versicherungen ──────────────────────────────────────────────────────────────────────

function schutzGriffe(g: GesellschaftLage, s: SchildGesellschaft | null | undefined, heute: string): Handgriff[] {
  const raus: Handgriff[] = [];
  const w = weg('schutz', g.id);
  const h = (x: Omit<Handgriff, 'gesellschaftId' | 'gesellschaft' | 'art' | 'weg'>): Handgriff => ({ ...x, gesellschaftId: g.id, gesellschaft: g.name, art: 'schutz', weg: w });
  for (const m of aktiveEintraege(s?.marken)) {
    const f = markeFristen(m, heute);
    if (f.zustand === 'abgelaufen') raus.push(h({ id: `sm:${m.id}`, ton: 'rot', titel: `Marke „${m.bezeichnung}“: Schutz abgelaufen — neu anmelden prüfen`, gewicht: 640 }));
    else if (f.zustand === 'nachfrist') raus.push(h({ id: `sm:${m.id}`, ton: 'rot', titel: `Marke „${m.bezeichnung}“ jetzt verlängern (Nachfrist läuft)`, warum: `Nachfrist bis ${tagText(f.nachfristBis)} — danach erlischt der Schutz.`, frist: f.nachfristBis, gewicht: 640 }));
    else if (f.zustand === 'verlaengern') raus.push(h({ id: `sm:${m.id}`, ton: 'gelb', titel: `Marke „${m.bezeichnung}“ verlängern`, warum: `Der Schutz endet am ${tagText(f.schutzEnde)}.`, frist: f.schutzEnde, gewicht: 320 }));
    else if (f.zustand === 'unbekannt') raus.push(h({ id: `sm:${m.id}`, ton: 'ruhig', titel: `Marke „${m.bezeichnung}“: Anmeldetag eintragen`, warum: 'Ohne ihn lässt sich die Schutzdauer nicht rechnen.', gewicht: 60 }));
    if (m.inhaberIstGesellschaft === false) raus.push(h({ id: `sm:${m.id}:inhaber`, ton: 'ruhig', titel: `Marke „${m.bezeichnung}“ auf die Gesellschaft übertragen`, warum: 'Inhaber ist nicht die Gesellschaft.', gewicht: 70 }));
  }
  for (const d of aktiveEintraege(s?.domains)) {
    const z = domainZustand(d, heute);
    if (z === 'abgelaufen') raus.push(h({ id: `sd:${d.id}`, ton: 'rot', titel: `Domain ${d.domain} sichern — abgelaufen`, gewicht: 620 }));
    else if (z === 'bald') raus.push(h({ id: `sd:${d.id}`, ton: 'gelb', titel: `Domain ${d.domain} verlängern`, warum: `Läuft am ${tagText(d.laeuftBis)} ab.`, frist: d.laeuftBis, gewicht: 310 }));
    if (d.inhaberIstGesellschaft === false) raus.push(h({ id: `sd:${d.id}:inhaber`, ton: 'ruhig', titel: `Domain ${d.domain} auf die Gesellschaft übertragen`, gewicht: 65 }));
    if (d.zweiFaktor === false) raus.push(h({ id: `sd:${d.id}:2fa`, ton: 'ruhig', titel: `Domain ${d.domain}: zweiten Faktor beim Registrar einschalten`, gewicht: 55 }));
  }
  const policen = aktiveEintraege(s?.versicherungen);
  for (const v of policen) {
    const f = policeFristen(v, heute);
    if (f.zustand === 'kuendigen-bald') raus.push(h({ id: `sv:${v.id}`, ton: 'gelb', titel: 'Versicherung: verlängern lassen oder kündigen — entscheiden', warum: `Kündigen geht bis ${tagText(f.kuendigenBis)}.`, frist: f.kuendigenBis, gewicht: 300 }));
    else if (f.zustand === 'abgelaufen') raus.push(h({ id: `sv:${v.id}`, ton: 'gelb', titel: 'Versicherung abgelaufen — Ablauf oder Verlängerung eintragen', gewicht: 200 }));
  }
  if (!policen.length && g.kontext.aktiv) raus.push(h({ id: `sv:${g.id}:keine`, ton: 'ruhig', titel: 'Versicherungsschutz prüfen (Haftpflicht, Vermögensschaden, D&O, Cyber)', warum: 'Noch keine Police erfasst.', gewicht: 70 }));
  return raus;
}

// ── Profil und Steckbrief ────────────────────────────────────────────────────────────────────────────────────────

function profilGriffe(g: GesellschaftLage): Handgriff[] {
  const raus: Handgriff[] = [];
  const h = (x: Omit<Handgriff, 'gesellschaftId' | 'gesellschaft' | 'art'>): Handgriff => ({ ...x, gesellschaftId: g.id, gesellschaft: g.name, art: 'profil' });
  if (!g.kontext.rechtsform) raus.push(h({ id: `pr:${g.id}:rechtsform`, ton: 'gelb', titel: 'Rechtsform im Steckbrief eintragen', warum: 'Ohne sie lassen sich Pflichten und Unterlagen nicht rechnen.', gewicht: 500, weg: WEG.unternehmen(g.id) }));
  for (const z of g.schwellen) if (z.stand === 'erreicht' && !z.umgesetzt) raus.push(h({ id: `pr:${g.id}:sw:${z.def.id}`, ton: 'gelb', titel: `Schwelle erreicht: ${z.def.pflicht}`, warum: z.def.titel, norm: z.def.norm, gewicht: 330, weg: weg('pflichten', g.id) }));
  if (g.kontext.aktiv && g.schwellen.some(z => z.stand === 'unbekannt')) raus.push(h({ id: `pr:${g.id}:profil`, ton: 'ruhig', titel: 'Profil ergänzen (Beschäftigte, Umsatz, Bilanzsumme)', warum: 'Dann prüft MAKE OS die Schwellen und rechnet die Fristen genauer.', gewicht: 50, weg: weg('pflichten', g.id) }));
  return raus;
}

/** Alle Handgriffe einer Gesellschaft, zuerst nach Gewicht, dann nach Frist. */
export function handgriffeFuer(g: GesellschaftLage, s: SchildGesellschaft | null | undefined, heute: string): Handgriff[] {
  return [...pflichtGriffe(g), ...dokGriffe(g), ...risikoGriffe(g), ...schutzGriffe(g, s, heute), ...profilGriffe(g)]
    .sort((a, b) => b.gewicht - a.gewicht || (a.frist ?? '9999').localeCompare(b.frist ?? '9999') || a.titel.localeCompare(b.titel, 'de'));
}

/**
 * „Das Wichtigste jetzt“ — höchstens `max` Handgriffe. Damit oben nicht drei Unterlagen stehen, wenn eine Frist drängt, nimmt die Auswahl
 * je Art höchstens zwei, solange es noch andere gibt.
 */
export function wichtigste(alle: readonly Handgriff[], max = 3): Handgriff[] {
  const raus: Handgriff[] = [];
  const je = new Map<HandgriffArt, number>();
  for (const h of alle) {
    if (raus.length >= max) break;
    if ((je.get(h.art) ?? 0) >= 2 && alle.some(x => x.art !== h.art && !raus.includes(x))) continue;
    raus.push(h);
    je.set(h.art, (je.get(h.art) ?? 0) + 1);
  }
  for (const h of alle) { if (raus.length >= max) break; if (!raus.includes(h)) raus.push(h); }
  return raus.sort((a, b) => b.gewicht - a.gewicht);
}

// ── Gesundheit in vier Dimensionen ───────────────────────────────────────────────────────────────────────────────

export type DimensionId = 'dokumente' | 'pflichten' | 'risiken' | 'schutz';
export interface Dimension {
  id: DimensionId;
  label: string;
  /** 0–1 (Balken) — null = noch nichts zu messen. */
  anteil: number | null;
  ton: Ton;
  /** Kurz, gezählt: „6 von 32“, „2 verstrichen“. */
  zahl: string;
  reiter: SchildReiter;
}
export const DIMENSIONEN: readonly { id: DimensionId; label: string; reiter: SchildReiter }[] = [
  { id: 'dokumente', label: 'Dokumente', reiter: 'dokumente' }, { id: 'pflichten', label: 'Pflichten', reiter: 'pflichten' },
  { id: 'risiken', label: 'Risiken', reiter: 'risiken' }, { id: 'schutz', label: 'Schutz', reiter: 'schutz' },
];
const ART_DIM: Record<HandgriffArt, DimensionId> = { dokument: 'dokumente', pflicht: 'pflichten', profil: 'pflichten', risiko: 'risiken', schutz: 'schutz' };

function dimensionen(g: GesellschaftLage, s: SchildGesellschaft | null | undefined, griffe: readonly Handgriff[]): Dimension[] {
  const ton = (id: DimensionId) => griffe.filter(h => ART_DIM[h.art] === id).reduce<Ton>((t, h) => schlimmerTon(t, h.ton), 'gruen');
  const d = g.dokumente;
  const dokOk = d.filter(x => !dokTon(x)).length;
  const faellig = g.pflichten.filter(p => p.status !== 'offen');
  const erledigt = faellig.filter(p => p.status === 'erledigt' || p.status === 'nicht-zutreffend').length;
  const verstrichen = g.pflichten.filter(p => p.status === 'ueberfaellig').length;
  const bald = g.pflichten.filter(p => p.status === 'faellig').length;
  const rz = g.risiken.filter(r => r.r.status !== 'erledigt');
  const bewertet = rz.filter(r => r.bewertung).length;
  const gutRisiken = rz.filter(r => r.bewertung && !(r.ampel === 'rot' && r.ohneMassnahme)).length;
  const posten = aktiveEintraege(s?.marken).length + aktiveEintraege(s?.domains).length + aktiveEintraege(s?.versicherungen).length;
  const schutzProbleme = new Set(griffe.filter(h => h.art === 'schutz' && !h.id.endsWith(':keine')).map(h => h.id.split(':').slice(0, 2).join(':'))).size;
  return [
    { id: 'dokumente', label: 'Dokumente', reiter: 'dokumente', anteil: d.length ? dokOk / d.length : null, ton: ton('dokumente'), zahl: d.length ? `${dokOk} von ${d.length}` : 'keine Soll-Liste' },
    { id: 'pflichten', label: 'Pflichten', reiter: 'pflichten', anteil: !g.kontext.rechtsform ? null : faellig.length ? erledigt / faellig.length : 1, ton: ton('pflichten'),
      zahl: !g.kontext.rechtsform ? 'Rechtsform fehlt' : verstrichen ? `${verstrichen} verstrichen` : bald ? `${bald} bald fällig` : faellig.length ? `${erledigt} erledigt` : 'nichts fällig' },
    { id: 'risiken', label: 'Risiken', reiter: 'risiken', anteil: rz.length ? gutRisiken / rz.length : null, ton: ton('risiken'), zahl: rz.length ? `${bewertet} von ${rz.length} bewertet` : 'noch keins erfasst' },
    { id: 'schutz', label: 'Schutz', reiter: 'schutz', anteil: posten ? Math.max(0, posten - schutzProbleme) / posten : null, ton: ton('schutz'), zahl: posten ? `${Math.max(0, posten - schutzProbleme)} von ${posten} in Ordnung` : 'nichts erfasst' },
  ];
}

// ── Blick je Gesellschaft und gesamt ─────────────────────────────────────────────────────────────────────────────

export interface Mengen { dokumenteFehlen: number; pflichtDokumenteFehlen: number; verstrichen: number; bald: number; risikenOffen: number; schutzOffen: number; ohneEile: number }
export interface Blick {
  id: string;
  name: string;
  ton: Ton;
  dimensionen: Dimension[];
  /** Alle Handgriffe (sortiert) — „alles ansehen“. */
  handgriffe: Handgriff[];
  /** Höchstens drei. */
  wichtigste: Handgriff[];
  mengen: Mengen;
  /** Ein Satz: was los ist, gezählt. */
  satz: string;
}

export function mengenVon(g: GesellschaftLage, griffe: readonly Handgriff[]): Mengen {
  return {
    dokumenteFehlen: g.dokumente.filter(d => d.zustand === 'fehlt').length,
    pflichtDokumenteFehlen: g.dokumente.filter(d => d.zustand === 'fehlt' && d.stufe === 'pflicht').length,
    verstrichen: g.pflichten.filter(p => p.status === 'ueberfaellig').length,
    bald: g.pflichten.filter(p => p.status === 'faellig').length,
    risikenOffen: griffe.filter(h => h.art === 'risiko').length,
    schutzOffen: griffe.filter(h => h.art === 'schutz').length,
    ohneEile: griffe.filter(h => h.ton === 'ruhig').length,
  };
}

const n = (z: number, ein: string, mehr: string) => `${z} ${z === 1 ? ein : mehr}`;
/** Ein Satz aus den Mengen — gezählt statt gelistet. */
export function mengenSatz(m: Mengen): string {
  const teile = [
    m.verstrichen ? n(m.verstrichen, 'Frist verstrichen', 'Fristen verstrichen') : '',
    m.bald ? n(m.bald, 'Frist bald fällig', 'Fristen bald fällig') : '',
    m.dokumenteFehlen ? `${n(m.dokumenteFehlen, 'Unterlage fehlt', 'Unterlagen fehlen')}${m.pflichtDokumenteFehlen ? ` (${m.pflichtDokumenteFehlen} davon Pflicht)` : ''}` : '',
  ].filter(Boolean);
  return teile.length ? `${teile.join(' · ')}.` : 'Keine Frist offen, keine Unterlage fehlt.';
}

export function blickFuer(g: GesellschaftLage, s: SchildGesellschaft | null | undefined, heute: string): Blick {
  const handgriffe = handgriffeFuer(g, s, heute);
  const ton = handgriffe.reduce<Ton>((t, h) => schlimmerTon(t, h.ton), 'gruen');
  const mengen = mengenVon(g, handgriffe);
  return { id: g.id, name: g.name, ton, dimensionen: dimensionen(g, s, handgriffe), handgriffe, wichtigste: wichtigste(handgriffe), mengen, satz: mengenSatz(mengen) };
}

export interface LageBlick { ton: Ton; je: Blick[]; zaehler: Record<Ton, number>; satz: string; wichtigste: Handgriff[] }
/** Alle Business-Gesellschaften auf einen Blick: Ton gesamt, je Gesellschaft, ein Satz und das Wichtigste über alle. */
export function lageBlick(lage: Lage, schild: readonly SchildGesellschaft[] | null | undefined): LageBlick {
  const je = lage.gesellschaften.map(g => blickFuer(g, (schild ?? []).find(x => x.id === g.id), lage.heute));
  const zaehler: Record<Ton, number> = { rot: 0, gelb: 0, ruhig: 0, gruen: 0 };
  for (const b of je) zaehler[b.ton]++;
  const ton = je.reduce<Ton>((t, b) => schlimmerTon(t, b.ton), 'gruen');
  const teile = (['rot', 'gelb', 'ruhig', 'gruen'] as const).filter(t => zaehler[t]).map(t => `${zaehler[t]} ${t === 'rot' ? 'mit drohender Folge' : t === 'gelb' ? 'mit bald fälligen Dingen' : t === 'ruhig' ? 'mit Lücken ohne Eile' : 'im Lot'}`);
  const satz = je.length ? `${n(je.length, 'Gesellschaft', 'Gesellschaften')} — ${teile.join(', ')}.` : 'Noch keine Gesellschaft im Bereich Business.';
  return { ton, je, zaehler, satz, wichtigste: wichtigste(je.flatMap(b => b.handgriffe)) };
}

// ── Dokumente: Vollständigkeit ───────────────────────────────────────────────────────────────────────────────────

export interface DokBlick {
  soll: number;
  ok: number;
  anteil: number;
  pflicht: { soll: number; ok: number };
  empfohlen: { soll: number; ok: number };
  /** Was zuerst (höchstens drei) — nach demselben Gewicht wie „Das Wichtigste jetzt“. */
  zuerst: DokSoll[];
  /** Je Gruppe (Gesellschaftsrecht, Rechnungslegung …) — für das Bild. */
  gruppen: { id: string; label: string; soll: number; ok: number }[];
}
export function dokumenteBlick(dokumente: readonly DokSoll[]): DokBlick {
  const ok = (d: DokSoll) => !dokTon(d);
  const p = dokumente.filter(d => d.stufe === 'pflicht'), e = dokumente.filter(d => d.stufe !== 'pflicht');
  const offen = dokumente.filter(d => !ok(d)).sort((a, b) => (dokTon(b)?.gewicht ?? 0) - (dokTon(a)?.gewicht ?? 0));
  return {
    soll: dokumente.length, ok: dokumente.filter(ok).length, anteil: dokumente.length ? dokumente.filter(ok).length / dokumente.length : 1,
    pflicht: { soll: p.length, ok: p.filter(ok).length }, empfohlen: { soll: e.length, ok: e.filter(ok).length },
    zuerst: offen.slice(0, 3),
    gruppen: DOK_GRUPPEN.map(gr => { const l = dokumente.filter(d => d.katalog.gruppe === gr.id); return { id: gr.id, label: gr.label, soll: l.length, ok: l.filter(ok).length }; }).filter(x => x.soll > 0),
  };
}
