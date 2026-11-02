// ─── Verträge · Darlehen aus dem Vertrag in die Finanzen (02.11., Server) ───────────────────────────────────────────────────────────
// Kevin 02.11.: „Aus dem Vertrag in die Finanzen — als Vorschlag, erst der Klick.“ Ein UNTERSCHRIEBENER Darlehensvertrag (Felder aus
// lib/vertraege/darlehen.ts) wird auf Klick zu EINEM Darlehen der Finanzplanung (Ratenplan + Zinsen, gerechnet nur vom Rechenkern):
//   • Kennung aus dem Vertrag abgeleitet (`darlehenIdFuer`) → ein zweiter Klick legt nichts doppelt an; `vertragId` am Darlehen.
//   • Geschrieben NUR über die Finanzplan-Operationen (`patchen`, Stand in der Sperre; eine fremde Änderung → erneut auf dem neuen Stand,
//     es wird nur angehängt). Monate außerhalb des Plans → 400 (der Schreibweg des Plans prüft, nie geklemmt).
//   • Eine private Seite (Privat, Selbstständigkeit) nur mit `privatFinanzZugang` (sonst 403); die Business-Sicht schreibt über ihren Wächter.
//   • Raten in der Liquidität: ist der Nehmer eine Business-Gesellschaft, stehen die Zahlungen `dl-<fp>-<k>` im Finanzplan-Bestand (`zahlungen`)
//     — idempotent, angeglichen (Betrag/Fälligkeit/Titel) und entfernt, wenn sie nicht mehr gelten; bezahlte bleiben unangetastet. Fristen und
//     „Steht an“ lesen sie über die vorhandenen Wege (Fälligkeit der Zahlung).
// Keine Beträge oder Namen im Code.

import { createHash } from 'node:crypto';
import { updateJson, loadJson } from '@/lib/store/local-db';
import { protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { ladeFinanzplan, patchen } from '@/lib/finanzen/plan/speicher';
import { fuerSicht } from '@/lib/finanzen/plan/sicht';
import { planMonat, darlehenRatenplan, hatRatenplan, type Darlehen, type DarlehenOrt } from '@/lib/finanzen/rechenkern';
import { DARLEHEN_BUSINESS, DARLEHEN_NAME_PRIVAT, darlehenOrtName, istDarlehenOrt } from '@/lib/finanzen/darlehen';
import { planZugangVon, privatFinanzZugang } from '@/lib/finanzen/haushalt/zugriff';
import { sauberFile, type FinanzplanFile, type Zahlung } from '@/lib/finanzen/finanzplan-bestand';
import { localDay } from '@/lib/zeit';
import { VertragFehler, vertraegeLaden, vertragAendernIntern, mitStand } from './server';
import { darlehenAusWerten, istDarlehenVertrag, type DarlehenAusVertrag } from './darlehen';
import { monatPlus } from '@/lib/finanzen/darlehen-plan';
import type { Vertrag } from './modell';

/** Status, in denen ein Darlehensvertrag übernommen werden kann (unterschrieben bzw. laufend). */
export const FINANZEN_STATUS: Vertrag['status'][] = ['unterschrieben', 'aktiv'];
/** Fingerabdruck des Vertrags (16 hex) — kurz genug für die Kennungen im Finanzplan (Zahlung ≤ 40 Zeichen). */
export const vertragFp = (vertragId: string) => createHash('sha256').update(vertragId).digest('hex').slice(0, 16);
/** Kennung des Darlehens in der Finanzplanung (aus dem Vertrag abgeleitet → idempotent). */
export const darlehenIdFuer = (vertragId: string) => `dl-v-${vertragFp(vertragId)}`;
/** Kennungen der Raten-Zahlungen in der Liquidität. */
export const zahlungPraefix = (vertragId: string) => `dl-${vertragFp(vertragId)}-`;

/** Ist die Seite privat (Privat oder die Selbstständigkeit, die in der Finanzplanung zu Privat gehört)? */
// Privat und jede Seite, die nicht zum Business gehört (02.11.: die Selbstständigkeit nur, solange die Instanz sie unter Privat führt).
const privatSeite = (o: DarlehenOrt) => o !== 'extern' && !DARLEHEN_BUSINESS.includes(o);

/** Vorgabe der Seiten: Nehmer = die Absender-Gesellschaft (sofern sie in der Finanzplanung steht), Geber = außerhalb. */
export function seitenVorgabe(v: Pick<Vertrag, 'gesellschaft'>): { geber: DarlehenOrt; nehmer: DarlehenOrt | null } {
  const g = v.gesellschaft as string;
  return { geber: 'extern', nehmer: istDarlehenOrt(g) && g !== 'extern' ? g : null };
}

/** Darlehen der Finanzplanung aus den Vertragsangaben (rein). Auszahlung vor Planbeginn → Monat 0 + Wartezeit. */
export function darlehenAusVertrag(v: Pick<Vertrag, 'id' | 'nummer'>, dl: DarlehenAusVertrag, geber: DarlehenOrt, nehmer: DarlehenOrt): Darlehen {
  const ausRoh = planMonat(dl.auszahlung);
  const aus = ausRoh >= 1 ? ausRoh : 0;
  const d: Darlehen = {
    id: darlehenIdFuer(v.id), name: `Darlehen ${v.nummer ?? ''}`.trim(), geber, nehmer, betrag: dl.betrag, aus, zurueck: 0,
    ratenAb: planMonat(dl.ratenBeginn), ratenAnzahl: dl.ratenAnzahl, rate: dl.rate, zinsen: dl.zinsen, vertragId: v.id,
    notiz: `Aus Vertrag ${v.nummer ?? ''}`.trim(),
  };
  if (dl.zinsProzent > 0) d.zinsProzent = dl.zinsProzent;
  if (aus === 0 && dl.wartezeit > 0) d.wartezeit = dl.wartezeit;
  return d;
}

/** Tag im Monat `monat` (JJJJ-MM) am Kalendertag `tag` — am Monatsende gekappt. */
function tagImMonat(monat: string, tag: number): string {
  const [j, m] = monat.split('-').map(Number);
  const letzter = new Date(Date.UTC(j, m, 0)).getUTCDate();
  return `${monat}-${String(Math.min(tag, letzter)).padStart(2, '0')}`;
}

/** Zahlungen der Raten (rein): je Monat mit Zahlung (Tilgung + gezahlter Zins) eine Zahlung des Nehmers, fällig am Tag der 1. Rate. */
export function ratenZahlungen(v: Pick<Vertrag, 'id' | 'nummer'>, dl: DarlehenAusVertrag, nehmer: DarlehenOrt, an: string): Zahlung[] {
  if (!DARLEHEN_BUSINESS.includes(nehmer)) return [];
  const tag = Number(dl.ratenBeginn.slice(8, 10));
  const p = zahlungPraefix(v.id);
  return dl.plan.monate.filter(x => x.zahlung > 0).map(x => {
    const monat = monatPlus(dl.auszahlung, x.k);
    const titel = x.rateNr ? `Darlehensrate ${x.rateNr}/${dl.ratenAnzahl}${x.zinsZahlung > 0 ? ' mit Zinsen' : ''} · ${v.nummer ?? ''}` : `Darlehenszinsen · ${v.nummer ?? ''}`;
    return { id: `${p}${x.k}`, firmaId: nehmer, an, titel: titel.trim().replace(/ ·$/, ''), betrag: x.zahlung, status: 'offen' as const, faellig: tagImMonat(monat, tag) };
  });
}

/** Zahlungen angleichen (rein): Soll anlegen/ändern, nicht mehr Gültige entfernen — bezahlte bleiben, fremde Kennungen unberührt. */
export function zahlungenAngleichen(liste: Zahlung[], praefix: string, soll: Zahlung[]): Zahlung[] {
  const sollJe = new Map(soll.map(z => [z.id, z]));
  const raus: Zahlung[] = [];
  const da = new Set<string>();
  for (const z of liste) {
    if (!z.id.startsWith(praefix)) { raus.push(z); continue; }
    da.add(z.id);
    if (z.status === 'bezahlt') { raus.push(z); continue; }
    const s = sollJe.get(z.id);
    if (s) raus.push({ ...z, an: s.an, titel: s.titel, betrag: s.betrag, faellig: s.faellig, firmaId: s.firmaId });
  }
  for (const s of soll) if (!da.has(s.id)) raus.push(s);
  return raus;
}

/** Name des Gebers in der Zahlung — eine private Seite bleibt neutral. */
const gebername = (v: Pick<Vertrag, 'partner'>, geber: DarlehenOrt) =>
  privatSeite(geber) ? 'Darlehensgeber (privat)' : geber === 'extern' ? (v.partner?.name || 'Darlehensgeber') : darlehenOrtName(geber);

/** Raten des Vertrags in der Liquidität angleichen (gilt: übernommen, Status unterschrieben/aktiv, Nehmer Business — sonst werden sie entfernt). */
export async function ratenAbgleichen(v: Vertrag, wer?: Wer): Promise<number> {
  const f = v.finanzen;
  const dl = darlehenAusWerten(v.werte);
  const gilt = !!f && FINANZEN_STATUS.includes(v.status) && !('leer' in dl) && !('fehler' in dl) && !!f.nehmer;
  const soll = gilt ? ratenZahlungen(v, dl as DarlehenAusVertrag, f!.nehmer!, gebername(v, f!.geber ?? 'extern')) : [];
  const p = zahlungPraefix(v.id);
  let vorher: FinanzplanFile | null = null;
  let anzahl = 0;
  const nachher = await updateJson<FinanzplanFile>('finanzplan', cur => {
    vorher = cur;
    const basis = sauberFile(cur);
    const hatAlte = basis.zahlungen.some(z => z.id.startsWith(p));
    if (!soll.length && !hatAlte) return cur as FinanzplanFile;
    const zahlungen = zahlungenAngleichen(basis.zahlungen, p, soll);
    anzahl = zahlungen.filter(z => z.id.startsWith(p)).length;
    return { ...(cur ?? basis), zahlungen };
  });
  if (wer && vorher !== nachher) await protokolliereBestand('finanzplan', vorher, nachher, wer);
  return anzahl;
}

export interface InFinanzenErgebnis { darlehenId: string; schonDa?: true; zahlungen: number; vertrag: ReturnType<typeof mitStand<Vertrag>> }

/**
 * „In Finanzen übernehmen“ — erst der Klick. `req` liefert die Rechte der Finanzplanung (Sicht aus dem Konto, privat nur mit Privatzugang).
 */
export async function vertragInFinanzen(p: { haushalt: string; person: string; id: string; geber: unknown; nehmer: unknown; req: Request; wer?: Wer; jetzt?: Date }): Promise<InFinanzenErgebnis> {
  const v = (await vertraegeLaden(p.haushalt)).find(x => x.id === p.id);
  if (!v) throw new VertragFehler('Vertrag nicht gefunden.', 404);
  if (!istDarlehenVertrag(v)) throw new VertragFehler('Nur ein Darlehensvertrag lässt sich in die Finanzen übernehmen.', 400);
  if (!FINANZEN_STATUS.includes(v.status)) throw new VertragFehler('Erst nach der Unterschrift — vorher steht das Darlehen noch nicht fest.', 409, { grund: 'nicht-unterschrieben' });
  if (!istDarlehenOrt(p.geber) || !istDarlehenOrt(p.nehmer)) throw new VertragFehler('Geber und Nehmer: Privat, Selbstständigkeit, eine Gesellschaft oder außerhalb des Plans.', 400);
  if (p.geber === p.nehmer) throw new VertragFehler('Geber und Nehmer müssen verschieden sein.', 400);
  if (p.geber === 'extern' && p.nehmer === 'extern') throw new VertragFehler('Mindestens eine Seite muss im Plan stehen.', 400);
  const dl = darlehenAusWerten(v.werte);
  if ('leer' in dl) throw new VertragFehler('Im Vertrag fehlen Angaben zum Darlehen (Betrag, Auszahlung, erste Rate, Anzahl, Rate).', 400);
  if ('fehler' in dl) throw new VertragFehler(dl.fehler.join(' '), 400);

  const plan = await planZugangVon(p.req);
  if (!plan || plan.haushalt !== p.haushalt) throw new VertragFehler('Kein Zugang zur Finanzplanung dieses Haushalts.', 403);
  const privat = privatSeite(p.geber) || privatSeite(p.nehmer);
  if (privat && (plan.sicht !== 'privat' || !(await privatFinanzZugang(p.req)))) throw new VertragFehler('Eine private Seite (Privat, Selbstständigkeit) übernimmt nur, wer die privaten Finanzen sieht.', 403, { grund: 'privat' });

  const darlehenId = darlehenIdFuer(v.id);
  const neu = darlehenAusVertrag(v, dl, p.geber, p.nehmer);
  let schonDa = false;
  for (let versuch = 0; versuch < 3; versuch++) {
    const d = await ladeFinanzplan(p.haushalt);
    if (!d) throw new VertragFehler('Noch keine Finanzplanung — erst den Startbestand hochladen oder leer beginnen.', 404);
    if ((d.darlehen ?? []).some(l => l.id === darlehenId)) { schonDa = true; break; }
    const r = await patchen(p.haushalt, d.stand, [{ pfad: '/darlehen/-', neu }], p.person, plan.sicht);
    if (r.ok) break;
    if (r.status === 409 && versuch < 2) continue;
    throw new VertragFehler(r.fehler, r.status);
  }
  const am = (p.jetzt ?? new Date()).toISOString();
  const nach = await vertragAendernIntern(p.haushalt, v.id, a => ({ ...a, finanzen: a.finanzen ?? { darlehenId, am, von: p.person, geber: p.geber as DarlehenOrt, nehmer: p.nehmer as DarlehenOrt } }), p.wer);
  const zahlungen = await ratenAbgleichen(nach, p.wer);
  return { darlehenId, ...(schonDa ? { schonDa: true as const } : {}), zahlungen, vertrag: mitStand(nach) };
}

// ── Unternehmen › Steckbrief: Karte „Darlehen“ ───────────────────────────────────────────────────────────────────────

export interface DarlehenKarteZeile {
  id: string; name: string; rolle: 'geber' | 'nehmer'; gegenseite: string;
  /** Restschuld zum Ende des Vormonats (Plan-Monat vor heute) — vor der Auszahlung 0. */
  restschuld: number;
  naechste?: { monat: string; betrag: number };
  vertragId?: string;
}

/** Zeilen der Karte (rein): Darlehen, an denen die Gesellschaft Geber oder Nehmer ist; die private Gegenseite heißt nur „Privat“. */
export function darlehenKarte(liste: readonly Darlehen[], gesellschaft: DarlehenOrt, monate: readonly string[], heute: string): DarlehenKarteZeile[] {
  const jetzt = planMonat(heute);
  const monatText = (m: number) => monate[m - 1] ?? `Monat ${m}`;
  return liste.filter(l => l.geber === gesellschaft || l.nehmer === gesellschaft).map(l => {
    const rolle = l.nehmer === gesellschaft ? 'nehmer' as const : 'geber' as const;
    const gegen = rolle === 'nehmer' ? l.geber : l.nehmer;
    const plan = darlehenRatenplan(l);
    let restschuld = 0; let naechste: DarlehenKarteZeile['naechste'];
    if (plan && hatRatenplan(l)) {
      const vorbei = plan.filter(x => x.m < jetzt);
      const ausgezahlt = l.aus === 0 || l.aus < jetzt;
      restschuld = vorbei.length ? vorbei[vorbei.length - 1].restschuld : (ausgezahlt ? l.betrag : 0);
      const n = plan.find(x => x.m >= jetzt && x.zahlung > 0);
      if (n) naechste = { monat: monatText(n.m), betrag: n.zahlung };
    } else {
      const ausgezahlt = l.aus === 0 || l.aus < jetzt;
      restschuld = ausgezahlt && (!l.zurueck || l.zurueck >= jetzt) ? l.betrag : 0;
      if (l.zurueck && l.zurueck >= jetzt) naechste = { monat: monatText(l.zurueck), betrag: l.betrag };
    }
    const neutral = privatSeite(gegen);
    return {
      id: l.id, name: neutral || l.name === DARLEHEN_NAME_PRIVAT ? DARLEHEN_NAME_PRIVAT : l.name, rolle,
      gegenseite: neutral ? 'Privat' : darlehenOrtName(gegen), restschuld, ...(naechste ? { naechste } : {}), ...(l.vertragId ? { vertragId: l.vertragId } : {}),
    };
  });
}

/**
 * Karte „Darlehen“ einer Gesellschaft — serverseitig gefiltert: nur mit Zugang zur Finanzplanung dieses Haushalts, in der Sicht des Kontos
 * (Business: private Darlehen ohne Name/Notiz, `fuerSicht`); die Selbstständigkeit nur in der Privat-Sicht. Ohne Finanzplan: leer.
 */
export async function darlehenFuerGesellschaft(p: { haushalt: string; gesellschaft: string; req: Request; heute?: string }): Promise<DarlehenKarteZeile[] | null> {
  const g = p.gesellschaft;
  if (!istDarlehenOrt(g) || g === 'extern' || g === 'privat') return [];
  const plan = await planZugangVon(p.req);
  if (!plan || plan.haushalt !== p.haushalt) return null;
  if (privatSeite(g) && plan.sicht !== 'privat') return [];
  const d = await ladeFinanzplan(p.haushalt);
  if (!d) return [];
  const sicht = fuerSicht(d, plan.sicht);
  return darlehenKarte(sicht.darlehen ?? [], g, sicht.monate, p.heute ?? localDay());
}

/** Hinweis für „Steht an“: unterschriebene Darlehensverträge, die noch nicht in den Finanzen stehen. */
export async function darlehenOhneFinanzen(haushalt: string): Promise<Pick<Vertrag, 'id' | 'nummer' | 'titel' | 'gesellschaft'>[]> {
  const l = (await loadJson<{ vertraege?: Vertrag[] }>(`vertraege--${haushalt}`))?.vertraege ?? [];
  return l.filter(v => FINANZEN_STATUS.includes(v.status) && !v.finanzen && istDarlehenVertrag(v) && !('leer' in darlehenAusWerten(v.werte)))
    .map(v => ({ id: v.id, nummer: v.nummer, titel: v.titel, gesellschaft: v.gesellschaft }));
}
