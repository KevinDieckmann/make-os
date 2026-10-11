// ─── Unternehmen › Ereignis-Assistent „Was ist passiert?“ (rein, client-sicher, 11.10.) ───────────────────────────────────────────────
// Kevin 11.10.: „denk immer 2–3 Schritte weiter.“ Aus EINER Antwort („neue Geschäftsführung“, „Kapitalerhöhung“ …) wird die ganze Folgekette sichtbar:
// Beschluss → Notar → Einlage → Handelsregister → Transparenzregister → Behörden → informieren → intern — jeder Schritt mit Frist ab dem Tag des
// Ereignisses. Angelegt wird erst per Klick, und nur über die VORHANDENEN Schreibwege (nichts doppelt):
//   · Beschluss als ENTWURF aus einer Startvorlage (./beschluss-vorlagen.ts) — über das Register (PATCH /api/gesellschaften, Liste `beschluesse`);
//   · Ereignis(se) im Pflichten-Kalender des Schilds (PATCH /api/gesellschaften/schild, Liste `ereignisse`) — daraus folgen die Pflichten mit Frist
//     (Kalender, Erinnerung als Aufgabe im Vorlauf); angehakte Zusatz-Schritte (Bank, Versicherungen …) hängen als `zusatz` am Ereignis;
//     mit Beschluss trägt das Ereignis dessen Kennung (`ausBeschluss`) — dann schlägt das Beschluss-Buch dasselbe Ereignis später nicht noch einmal vor.
// Welche Ereignisse ein Beschluss auslöst, sagt EINE Regel (./beschluesse.ts `ereignisseVon`); die Schritte kommen aus ./pflichten.ts (`ereignisSchritte`).
// Hinweis, keine Rechtsberatung — Fristen ohne gesetzliche Zahl sind Vorschläge.

import { LUECKE } from './vorlagen';
import { beschlussAusVorlage, beschlussVorlageVon } from '../beschluss-vorlagen';
import { ereignisseVon } from '../beschluesse';
import type { BeschlussAenderung, BeschlussArt, RegisterGesellschaft, SatzungMerkmal } from '../modell';
import type { EreignisArt } from './typen';
import type { SchildKontext } from './kontext';
import { ZUSATZ_SCHRITTE, ereignisDef, ereignisSchritte, UNVERZUEGLICH_TAGE, type EreignisPflicht } from './pflichten';
import { monatePlus, tagePlus } from './zeit';

export const ASSISTENT_HINWEIS = 'Hinweis, keine Rechtsberatung — Fristen ohne gesetzliche Zahl sind Vorschläge; vor wesentlichen Schritten anwaltlich bzw. steuerlich prüfen.';

export interface Situation {
  id: string;
  /** Klartext — so, wie man es erzählt. */
  label: string;
  /** Ein Satz: worum es geht. */
  frage: string;
  /** Wonach das Datum fragt. */
  datumFrage: string;
  /** Das Ereignis im Pflichten-Kalender (eine Quelle der Pflichten). */
  ereignis: EreignisArt;
  /** Beschluss als Entwurf aus dieser Startvorlage — mit Anpassungen (Titel, Art, Änderung) für diese Lage. */
  beschluss?: { vorlage: string; titel?: string; art?: BeschlussArt; aenderung?: SatzungMerkmal; optional?: string };
  /** Vorgeschlagene Zusatz-Schritte (angehakt); die übrigen aus ZUSATZ_SCHRITTE sind wählbar. */
  zusatz: readonly string[];
  hinweis?: string;
}

/** Die Lagen des Assistenten. Kennungen nie ändern (stehen in der Adresse). */
export const SITUATIONEN: readonly Situation[] = [
  { id: 'gf', label: 'Neue Geschäftsführung (oder Abberufung)', frage: 'Eine Geschäftsführerin oder ein Geschäftsführer kommt dazu oder geht.', datumFrage: 'Wann wird bestellt bzw. abberufen?',
    ereignis: 'gf-wechsel', beschluss: { vorlage: 'gf-bestellung' }, zusatz: ['z-partner'] },
  { id: 'gesellschafter', label: 'Gesellschafter steigt ein oder aus', frage: 'Geschäftsanteile werden übertragen — verkauft, verschenkt oder vererbt.', datumFrage: 'Wann wird übertragen?',
    ereignis: 'anteilsuebertragung', beschluss: { vorlage: 'allgemein', titel: 'Zustimmung zur Übertragung von Geschäftsanteilen', optional: 'Nur nötig, wenn die Satzung die Übertragung an eine Zustimmung bindet.' },
    zusatz: ['z-notar-anteile', 'z-cap-table', 'z-steuerbuero'] },
  { id: 'kapital', label: 'Kapitalerhöhung', frage: 'Das Stammkapital wird erhöht — neue Anteile, neue Einlage.', datumFrage: 'Wann wird beschlossen?',
    ereignis: 'kapitalmassnahme', beschluss: { vorlage: 'kapitalerhoehung' }, zusatz: ['z-einlage', 'z-cap-table', 'z-steuerbuero'] },
  { id: 'sitz', label: 'Sitz oder Geschäftsanschrift ändert sich', frage: 'Umzug — der satzungsmäßige Sitz oder nur die Anschrift.', datumFrage: 'Ab wann gilt die neue Anschrift?',
    ereignis: 'sitz-anschrift', beschluss: { vorlage: 'sitz', optional: 'Nur nötig, wenn sich der Sitz laut Satzung ändert — für eine neue Anschrift im selben Ort reicht die Anmeldung.' },
    zusatz: ['z-bank', 'z-versicherungen', 'z-partner'] },
  { id: 'firma', label: 'Neuer Firmenname (Umfirmierung)', frage: 'Die Gesellschaft bekommt einen neuen Namen — das ist eine Satzungsänderung.', datumFrage: 'Wann wird beschlossen?',
    ereignis: 'satzungsaenderung', beschluss: { vorlage: 'allgemein', titel: 'Satzungsänderung: neue Firma', art: 'satzungsaenderung', aenderung: 'firmierung' },
    zusatz: ['z-impressum', 'z-gewerbe', 'z-finanzamt', 'z-bank', 'z-versicherungen', 'z-partner', 'z-marken-domains'] },
  { id: 'beteiligung', label: 'Neue Beteiligung an einer anderen Firma', frage: 'Die Gesellschaft kauft Anteile an einer anderen Firma.', datumFrage: 'Wann wird gekauft?',
    ereignis: 'beteiligung-erwerb', beschluss: { vorlage: 'allgemein', titel: 'Zustimmung zum Erwerb einer Beteiligung', optional: 'Üblich, wenn der Erwerb über das gewöhnliche Geschäft hinausgeht.' },
    zusatz: ['z-steuerbuero'] },
  { id: 'gruendung', label: 'Gesellschaft gründen', frage: 'Eine neue GmbH oder UG entsteht — vom Notar bis zum Finanzamt.', datumFrage: 'Wann ist der Notartermin?',
    ereignis: 'gruendung', zusatz: ['z-konto'], hinweis: 'Lege die Gesellschaft vorher unter „Gesellschaften“ an (Status „in Gründung“) — dann führt MAKE OS ihre Pflichten.' },
  { id: 'aufloesung', label: 'Gesellschaft auflösen', frage: 'Die Gesellschaft wird beendet — Auflösung, Abwicklung, Löschung.', datumFrage: 'Wann wird die Auflösung beschlossen?',
    ereignis: 'aufloesung', beschluss: { vorlage: 'allgemein', titel: 'Auflösung der Gesellschaft' },
    zusatz: ['z-bank', 'z-versicherungen', 'z-partner', 'z-marken-domains', 'z-steuerbuero'], hinweis: 'Auflösung und Abwicklung besser mit Kanzlei und Steuerbüro planen.' },
];
export const situationVon = (id: string | null | undefined) => SITUATIONEN.find(s => s.id === id);

// ── Folgekette ───────────────────────────────────────────────────────────────────────────────────────────────────

export type Phase = 'beschluss' | 'notar' | 'geld' | 'register' | 'transparenz' | 'behoerden' | 'informieren' | 'intern';
export const PHASEN: readonly { id: Phase; label: string }[] = [
  { id: 'beschluss', label: 'Beschluss' }, { id: 'notar', label: 'Notar' }, { id: 'geld', label: 'Einlage & Konto' }, { id: 'register', label: 'Handelsregister' },
  { id: 'transparenz', label: 'Transparenzregister' }, { id: 'behoerden', label: 'Behörden' }, { id: 'informieren', label: 'Informieren' }, { id: 'intern', label: 'Intern & Unterlagen' },
];
/** In welche Phase gehört ein Schritt (aus seiner Kennung — eine Stelle). */
export function phaseVon(key: string): Phase {
  if (key === 'beschluss' || key === 'gv') return 'beschluss';
  if (key.includes('notar')) return 'notar';
  if (key === 'einlage' || key === 'z-einlage' || key === 'z-konto') return 'geld';
  if (['hr', 'hr-anmeldung', 'gesellschafterliste', 'glaeubiger', 'loeschung'].includes(key)) return 'register';
  if (key.includes('transparenz')) return 'transparenz';
  if (['gewerbeamt', 'finanzamt', 'bg', 'z-gewerbe', 'z-finanzamt', 'insolvenzantrag'].includes(key)) return 'behoerden';
  if (['z-bank', 'z-versicherungen', 'z-partner', 'z-steuerbuero', 'do-nachmeldung'].includes(key)) return 'informieren';
  return 'intern';
}

export interface Schritt {
  key: string;
  titel: string;
  norm: string;
  /** Frist als Tag (aus dem Datum des Ereignisses). */
  frist: string;
  /** Frist in Worten. */
  wann: string;
  phase: Phase;
  herkunft: 'beschluss' | 'pflicht' | 'zusatz';
  annahme?: true;
  eskalation?: true;
  hinweis?: string;
  /** Aus welchem Ereignis (bei mehreren). */
  ereignis?: EreignisArt;
}

/** Frist eines Schritts in Worten (rein). */
export function wannText(p: Pick<EreignisPflicht, 'tage' | 'monate' | 'unverzueglich' | 'annahme' | 'nach'>): string {
  if (p.unverzueglich) return `unverzüglich (Vorschlag: ${UNVERZUEGLICH_TAGE} Tage)`;
  if (p.nach && p.monate) return `frühestens nach ${p.monate} Monat${p.monate === 1 ? '' : 'en'}${p.annahme ? ' (Vorschlag)' : ''}`;
  if (p.monate) return `binnen ${p.monate} Monat${p.monate === 1 ? '' : 'en'}${p.annahme ? ' (Vorschlag)' : ''}`;
  if (!p.tage) return 'am selben Tag bzw. vorher';
  return `binnen ${p.tage} Tagen${p.annahme ? ' (Vorschlag)' : ''}`;
}
const fristVon = (p: Pick<EreignisPflicht, 'tage' | 'monate'>, datum: string) => (p.monate ? monatePlus(datum, p.monate) : tagePlus(datum, p.tage ?? 0));

export interface Wahl { beschluss: boolean; zusatz: readonly string[] }

/** Welche Ereignisse angelegt werden (rein): das der Lage — und mit Beschluss alle, die der Beschluss auslöst (eine Regel, `ereignisseVon`). */
export function ereignisseFuer(sit: Situation, k: SchildKontext | null, mitBeschluss: boolean): EreignisArt[] {
  const arten: EreignisArt[] = [sit.ereignis];
  if (mitBeschluss && sit.beschluss) {
    const b = { art: sit.beschluss.art ?? beschlussVorlageVon(sit.beschluss.vorlage)?.art ?? 'gesellschafterbeschluss', aenderungen: aenderungenFuer(sit).map(a => ({ merkmal: a.merkmal })) };
    for (const e of ereignisseVon(b)) if (!arten.includes(e)) arten.push(e);
  }
  return arten.filter(a => { const d = ereignisDef(a); return !!d && (!k || d.gilt(k)); });
}

/**
 * Die Folgekette (rein): Beschluss (falls gewählt), dann die Pflichten aller Ereignisse und die gewählten Zusatz-Schritte — nach Phasen, innerhalb nach
 * Frist. Gleiche Schritte aus zwei Ereignissen (z. B. Notar und Handelsregister) stehen einmal. `k` = die Gesellschaft (für „gilt“), ohne sie gilt alles.
 */
export function folgekette(sit: Situation, k: SchildKontext | null, datum: string, w: Wahl): { phasen: { id: Phase; label: string; schritte: Schritt[] }[]; ereignisse: EreignisArt[]; giltNicht: boolean } {
  const ereignisse = ereignisseFuer(sit, k, w.beschluss);
  const schritte: Schritt[] = [];
  const titel = new Set<string>();
  if (w.beschluss && sit.beschluss) {
    const v = beschlussVorlageVon(sit.beschluss.vorlage);
    schritte.push({ key: 'beschluss-entwurf', titel: `Beschluss fassen: ${sit.beschluss.titel ?? v?.titel ?? 'Gesellschafterbeschluss'}`, norm: v?.norm ?? '—', frist: datum, wann: 'am Tag des Ereignisses', phase: 'beschluss', herkunft: 'beschluss', hinweis: 'MAKE OS legt den Beschluss als Entwurf aus der Vorlage an — Platzhalter füllst du im Beschluss-Buch aus.' });
  }
  for (const art of ereignisse) {
    const nurPflichten = art === sit.ereignis ? ereignisSchritte({ art, zusatz: [...w.zusatz] }) : ereignisSchritte({ art });
    for (const p of nurPflichten) {
      if (titel.has(p.titel)) continue;
      // Der Beschluss-Entwurf steht schon als erster Schritt — die Pflicht „beschließen“ des Ereignisses nicht ein zweites Mal zeigen (im Kalender bleibt sie).
      if (p.key === 'beschluss' && schritte.some(x => x.herkunft === 'beschluss')) { schritte[0] = { ...schritte[0], norm: p.norm, hinweis: `${p.titel}. ${schritte[0].hinweis ?? ''}`.trim() }; continue; }
      titel.add(p.titel);
      const zusatz = p.key.startsWith('z-');
      schritte.push({
        key: `${art}:${p.key}`, titel: p.titel, norm: p.norm, frist: fristVon(p, datum), wann: wannText(p), phase: phaseVon(p.key), herkunft: zusatz ? 'zusatz' : 'pflicht',
        ...(p.annahme || p.unverzueglich ? { annahme: true as const } : {}), ...(p.eskalation ? { eskalation: true as const } : {}), ...(p.hinweis ? { hinweis: p.hinweis } : {}), ...(ereignisse.length > 1 ? { ereignis: art } : {}),
      });
    }
  }
  // Ohne eigenen Notar-Schritt: die Anmeldung zum Handelsregister läuft trotzdem über den Notar (öffentliche Beglaubigung) — das steht am Schritt.
  if (!schritte.some(s => s.phase === 'notar')) {
    for (const s of schritte) if (s.phase === 'register' && /Handelsregister anmelden/.test(s.titel)) s.hinweis = ['Über den Notar — die Anmeldung muss öffentlich beglaubigt sein (§ 12 HGB).', s.hinweis].filter(Boolean).join(' ');
  }
  const phasen = PHASEN.map(p => ({ ...p, schritte: schritte.filter(s => s.phase === p.id).sort((a, b) => a.frist.localeCompare(b.frist)) })).filter(p => p.schritte.length);
  return { phasen, ereignisse, giltNicht: !ereignisse.includes(sit.ereignis) };
}

/** Zusatz-Schritte zur Wahl: erst die vorgeschlagenen, dann die übrigen — ohne die, die das Ereignis schon als Pflicht führt. */
export function zusatzWahl(sit: Situation): { key: string; titel: string; vorgeschlagen: boolean }[] {
  const pflicht = new Set((ereignisDef(sit.ereignis)?.pflichten ?? []).map(p => p.titel));
  return [...sit.zusatz.map(k => ZUSATZ_SCHRITTE.find(z => z.key === k)!).filter(Boolean), ...ZUSATZ_SCHRITTE.filter(z => !sit.zusatz.includes(z.key))]
    .filter(z => !pflicht.has(z.titel)).map(z => ({ key: z.key, titel: z.titel, vorgeschlagen: sit.zusatz.includes(z.key) }));
}

// ── Was angelegt wird ────────────────────────────────────────────────────────────────────────────────────────────

/** Die Änderung des Beschluss-Entwurfs: der Platzhalter „[…]“ als Wortlaut, beim Kapital der heutige Betrag als Ausgangspunkt (sonst keine). */
function aenderungenFuer(sit: Situation, g?: Pick<RegisterGesellschaft, 'stammkapitalCent'>): BeschlussAenderung[] {
  const m = sit.beschluss?.aenderung ?? beschlussVorlageVon(sit.beschluss?.vorlage ?? '')?.aenderung;
  if (!m) return [];
  if (m === 'stammkapital') return typeof g?.stammkapitalCent === 'number' && g.stammkapitalCent > 0 ? [{ merkmal: m, cent: g.stammkapitalCent }] : g ? [] : [{ merkmal: m }];
  return [{ merkmal: m, text: LUECKE }];
}

/**
 * Der Beschluss-Eintrag für das Register (rein): Entwurf aus der Vorlage (Platzhalter aus dem Register gefüllt, Unbekanntes „[…]“, Hinweis vorne),
 * Datum = Tag des Ereignisses. Gespeichert über die vorhandene Liste `beschluesse` — Status „Entwurf“, also ohne Nummer und ohne Folgen.
 */
export function beschlussEntwurf(sit: Situation, g: RegisterGesellschaft, datum: string, heute: string): Record<string, unknown> | null {
  if (!sit.beschluss) return null;
  const v = beschlussVorlageVon(sit.beschluss.vorlage);
  if (!v) return null;
  const e = beschlussAusVorlage(v, g, heute);
  return {
    datum, status: 'entwurf', art: sit.beschluss.art ?? e.art, ...(e.gremium ? { gremium: e.gremium } : {}), titel: sit.beschluss.titel ?? e.titel, inhalt: e.inhalt,
    aenderungen: aenderungenFuer(sit, g).map(a => (a.merkmal === 'stammkapital' ? { merkmal: a.merkmal, cent: a.cent } : { merkmal: a.merkmal, text: a.text })), vorlage: e.vorlage,
  };
}

/** Die Ereignis-Einträge für das Schild (rein): das Ereignis der Lage mit den gewählten Zusatz-Schritten, weitere ohne. */
export function ereignisEintraege(sit: Situation, k: SchildKontext | null, datum: string, w: Wahl, notiz?: string): { art: EreignisArt; datum: string; zusatz?: string[]; notiz?: string }[] {
  const bekannt = new Set(ZUSATZ_SCHRITTE.map(z => z.key));
  const zusatz = [...new Set(w.zusatz)].filter(z => bekannt.has(z));
  return ereignisseFuer(sit, k, w.beschluss).map(art => ({ art, datum, ...(art === sit.ereignis && zusatz.length ? { zusatz } : {}), ...(notiz ? { notiz } : {}) }));
}
