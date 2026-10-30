// ─── Angebot angenommen → Mandat + Liquiplan AUTOMATISCH (29.10., Kreislauf Geld P2a; nur Server) ─────────────────────────────────────────
// Kevin 29.10.: „Angebot angenommen → Mandat + Liquiplan-Posten entstehen AUTOMATISCH (mit Rückgängig), der Fall bleibt Vorschlag.“ Das hebt die Regel
// „Mandat → Liquiplan nur als Vorschlag“ für GENAU diesen Weg auf; überall sonst bleibt „Eintragen“ ein Klick in der Mandatsakte.
//
//   mandatAusAngebotAutomatisch   nach „angenommen“ (lib/crm/angebot-server.ts `angebotAnnehmen`): das Mandat über DENSELBEN Bau wie /api/crm/lead aktion
//                                 „mandat“ (`mandatAusDeal` — Vorbelegung aus dem angenommenen Angebot), dieselben Folgen (Firma wird Kunde, Personen werden
//                                 Kunde), danach die Liquiplan-Posten über DENSELBEN Rechenweg wie „Eintragen“ (`mandatLiquiplanEintragen`) — nur für Business.
//                                 Idempotent (gibt es zum Deal bzw. Angebot schon ein Mandat → nichts). Nichts, wenn: kein gewonnener Deal, keine Gesellschaft,
//                                 Art. 18 bzw. Werbesperre einer beteiligten Person. Wirft nie — „angenommen“ ist schon gespeichert.
//   mandatAutomatikZurueck        „Rückgängig“: Mandat + seine Posten wieder weg — nur ein automatisch angelegtes, nur solange keine Rechnung (auch kein Entwurf)
//                                 und kein Fall daran hängt (sonst 409 mit Grund). Firma/Personen bleiben „Kunde“ (der Deal ist gewonnen).
//   mandatLiquiplanEintragen      „Eintragen“ / „Plan angleichen“ — die EINE Stelle, auch für POST /api/crm/liquiplan `anlegen`.
// Anlegen und Rückgängig laufen über das Absichtsprotokoll (Art `mandat-automatik`, 30.10.) — siehe „Absichtsprotokoll“ unten.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { gesellschaftAusEinheit, istBusinessGesellschaft, istRegisterKennung } from '@/lib/einheiten';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { Planposten } from '@/lib/make-one/liquiditaet';
import { sauberFile, type FinanzplanFile } from '@/lib/finanzen/finanzplan-bestand';
import { absichtAbschliessen, absichtBeginnen, laeuftGerade, mitVorgang, type Absicht } from '@/lib/store/absichten';
import { ladeCrm, aendereCrm } from './speicher';
import { karteiHaushalt } from './sperrliste';
import { dealZuFirma } from './firmen-bezug';
import { mandatAusDeal } from './mandat-aus-deal';
import { hauptPostenId, keinPostenGrund, mandatPosten, postenAngleichen, postenVomMandat } from './kunden';
import type { CrmBestand, Mandat } from './typen';

export type LiquiEintragen = { ok: true; haupt?: Planposten; soll: Planposten[] } | { ok: false; status: number; fehler: string };

/** Was die Anrechnung im Plan braucht (P3b): alle Mandate und die Rechnungen des Finanzplans — nur zum Rechnen. */
export async function anrechnungBestand(crm: Pick<CrmBestand, 'mandate'>) {
  return { mandate: crm.mandate, rechnungen: sauberFile(await loadJson<FinanzplanFile>('finanzplan')).rechnungen };
}

/**
 * Die Posten eines Mandats in den Liquiditätsplan eintragen bzw. angleichen (Monatsposten und Teilmonate wie der Zahlplan; ein vorhandener Monatsposten
 * übernimmt die Werte des Mandats) und den Monatsposten am Mandat merken. Dieselbe Rechnung wie die Lage (`mandatPosten` + `postenAngleichen`).
 */
export async function mandatLiquiplanEintragen(m: Mandat, crm: Pick<CrmBestand, 'mandate' | 'leistungen'>, heute = localDay()): Promise<LiquiEintragen> {
  const soll = mandatPosten(m, heute, { katalog: crm.leistungen, anrechnung: await anrechnungBestand(crm) });
  if (!soll.length) return { ok: false, status: 400, fehler: `Aus diesem Mandat entsteht kein Posten: ${keinPostenGrund(m)}` };
  await updateJson<{ posten: Planposten[] }>('liquiplan', cur => ({ posten: postenAngleichen(cur?.posten ?? [], m, soll, heute) }));
  const haupt = soll.find(p => p.id === hauptPostenId(m));
  if (!m.planpostenId && haupt) await aendereCrm(cur => ({ ...cur, mandate: cur.mandate.map(x => (x.id === m.id ? { ...x, planpostenId: haupt.id } : x)) }));
  return { ok: true, ...(haupt ? { haupt } : {}), soll };
}

export type AutomatikErgebnis =
  | { angelegt: true; mandatId: string; liquiplan: number; text: string; hinweis?: string }
  | { angelegt: false; grund: string };

// ── Absichtsprotokoll (30.10., Datenprüfung der Nacht) ──────────────────────────────────────────────────────────────────────────────────────
// Beide Wege schreiben NACHEINANDER mehrere Bestände (CRM, Kartei, Liquiplan, `rechnungswesen`). Damit ein Abbruch dazwischen keinen halben Stand
// hinterlässt (Mandat ohne Rückgängig-Merker, Mandat ohne Liquiplan-Posten, zurückgenommenes Mandat mit verwaisten Posten), laufen sie als Absicht
// der Art `mandat-automatik` (lib/store/absichten.ts) — jeder Schritt idempotent, abgehakt nach der Wirkung; Start, Takt und Durchsicht setzen fort
// (`mandatAutomatikFortsetzen`, lib/store/absichten-fortsetzen.ts). Die Daten (das gebaute Mandat samt Kennung) stehen VOR dem ersten Schritt fest —
// die Wiederaufnahme legt also dasselbe Mandat an, nie ein zweites.
//   anlegen   mandat (CRM: Mandat + Firma wird Kunde) → kartei (Personen werden Kunde) → liquiplan (nur Business) → merker (`mandatAuto`)
//   zurueck   crm (Mandat weg) → liquiplan (seine Posten weg) → merker (`zurueckAm`)
export const ABSICHT_MANDAT_AUTO = 'mandat-automatik' as const;
export const ANLEGEN_SCHRITTE = ['mandat', 'kartei', 'liquiplan', 'merker'] as const;
export const ZURUECK_SCHRITTE = ['crm', 'liquiplan', 'merker'] as const;

interface AnlegenDaten { aktion: 'anlegen'; angebotId: string; dealId: string; mandatId: string; mandat: Mandat; kontaktIds: string[]; jetzt: string; heute: string; person: string; wer?: Wer; schonDa?: boolean; posten?: string[]; hinweis?: string }
interface ZurueckDaten { aktion: 'zurueck'; angebotId: string; mandatId: string; planpostenId?: string; am: string; wer?: Wer; weg?: number }

/** Art. 18 bzw. Werbesperre einer beteiligten Person? (die Kartei wird nicht weiter verarbeitet als nötig) */
async function personGesperrt(ids: readonly string[]): Promise<boolean> {
  const { kontakteFuerVerarbeitung } = await import('./verarbeitung');
  const kartei = await kontakteFuerVerarbeitung({ mitEingeschraenkten: true });
  return ids.some(id => { const k = kartei.find(x => x.id === id); return !!k && (k.eingeschraenkt || k.werbesperre); });
}

/** Die Schritte „anlegen“ — idempotent; nach `schonDa` (ein anderes Mandat zum Deal) nichts weiter. */
async function anlegenAusfuehren(h: string, absicht: Absicht): Promise<AnlegenDaten> {
  return mitVorgang(h, absicht, async v => {
    const D = v.absicht.daten as unknown as AnlegenDaten;
    const m = D.mandat;
    await v.schritt('mandat', async () => {
      let schonDa = false;
      await aendereCrm(x => {
        if (x.mandate.some(mm => mm.id === m.id)) return x; // schon angelegt (Wiederaufnahme)
        if (x.mandate.some(mm => mm.chanceId === D.dealId && !mm.geloeschtAm)) { schonDa = true; return x; }
        const c = x.chancen.find(y => y.id === D.dealId);
        return { ...x, mandate: [...x.mandate, m], firmen: x.firmen.map(f => (c && dealZuFirma(c, f) && !f.rolleVonHand ? { ...f, rolle: 'kunde' } : f)) };
      }, D.wer);
      return { schonDa };
    }, r => r);
    if (v.daten<boolean>('schonDa')) return v.absicht.daten as unknown as AnlegenDaten;
    const { personenWerdenKunde } = await import('./mandat-anlegen-server');
    await v.schritt('kartei', () => personenWerdenKunde(D.kontaktIds, D.jetzt, D.wer));
    // Liquiplan (nur Business wie die Liquidität): derselbe Rechenweg wie „Eintragen“.
    await v.schritt('liquiplan', async () => {
      if (!istBusinessGesellschaft(m.gesellschaft)) return { posten: [] as string[], hinweis: 'Die Gesellschaft gehört nicht zum Business — in den Liquiplan trägt die Mandatsakte auf Klick ein.' };
      const crm2 = await ladeCrm();
      const l = await mandatLiquiplanEintragen(crm2.mandate.find(x => x.id === m.id) ?? m, crm2, D.heute).catch(() => ({ ok: false as const, status: 500, fehler: 'Liquiplan nicht erreichbar.' }));
      return l.ok ? { posten: l.soll.map(x => x.id) } : { posten: [] as string[], hinweis: `Nicht im Liquiplan: ${l.fehler}` };
    }, r => r);
    const posten = v.daten<string[]>('posten') ?? [];
    const { kreislaufAendern } = await import('@/lib/finanzen/rechnung/kreislauf');
    // Ein vorhandener Merker bleibt (z. B. schon zurückgenommen, wenn der Abbruch NACH dem Schreiben, vor dem Abhaken kam).
    await v.schritt('merker', () => kreislaufAendern(k => (k.mandatAuto?.[m.id] ? k : { ...k, mandatAuto: { ...(k.mandatAuto ?? {}), [m.id]: { angebotId: D.angebotId, am: D.jetzt, posten } } })));
    return v.absicht.daten as unknown as AnlegenDaten;
  });
}

/** Nach „angenommen“ — siehe Kopf. `null` = es gab nichts zu tun (Mandat schon da, Angebot nicht angenommen). Wirft nie. */
export async function mandatAusAngebotAutomatisch(p: { angebotId: string; person: string; wer?: Wer; jetzt?: Date }): Promise<AutomatikErgebnis | null> {
  let begonnen = false;
  try {
    const jetzt = (p.jetzt ?? new Date()).toISOString();
    const heute = localDay(p.jetzt ?? new Date());
    const crm = await ladeCrm();
    const a = (crm.angebote ?? []).find(x => x.id === p.angebotId);
    if (!a || a.status !== 'angenommen') return null;
    const { mandatZumAngebot } = await import('@/lib/finanzen/rechnung/server');
    if (mandatZumAngebot(crm.mandate, a)) return null;
    const c = a.dealId ? crm.chancen.find(x => x.id === a.dealId) : undefined;
    if (!c || c.stufe !== 'gewonnen') return { angelegt: false, grund: 'Ohne gewonnenen Deal entsteht das Mandat nicht von selbst — bitte „Mandat anlegen“.' };
    if (crm.mandate.some(m => m.chanceId === c.id)) return null;
    if (!gesellschaftAusEinheit(a.gesellschaft) && !istRegisterKennung(a.gesellschaft)) return { angelegt: false, grund: 'Am Angebot steht keine Gesellschaft — das Mandat bitte von Hand anlegen.' };
    const ids = Array.from(new Set([...c.kontaktIds, ...(a.kontaktId ? [a.kontaktId] : [])]));
    if (await personGesperrt(ids)) return { angelegt: false, grund: 'Eine beteiligte Person ist eingeschränkt bzw. gesperrt — das Mandat bitte von Hand anlegen.' };
    const m = mandatAusDeal(c, { leistungen: crm.leistungen, angebote: crm.angebote, firmen: crm.firmen, id: neueKennung('m'), jetzt, heute, person: p.person }).mandat;
    // VOR dem ersten Schreiben: die Absicht (mit dem fertig gebauten Mandat). Liegt zum Angebot schon eine offene, wird DIESE fortgesetzt.
    const h = await karteiHaushalt();
    const daten: AnlegenDaten = { aktion: 'anlegen', angebotId: a.id, dealId: c.id, mandatId: m.id, mandat: m, kontaktIds: [...c.kontaktIds], jetzt, heute, person: p.person, ...(p.wer ? { wer: p.wer } : {}) };
    const { absicht } = await absichtBeginnen(h, { art: ABSICHT_MANDAT_AUTO, schluessel: `anlegen:${a.id}`, schritte: ANLEGEN_SCHRITTE, daten: daten as unknown as Record<string, unknown>, person: p.person });
    if (laeuftGerade(absicht.id)) return null;
    begonnen = true;
    const d = await anlegenAusfuehren(h, absicht);
    await absichtAbschliessen(h, absicht.id, d.schonDa ? 'verworfen' : 'fertig', ['mandatId', 'angebotId']);
    if (d.schonDa) return null;
    const posten = d.posten ?? [];
    const text = `Mandat angelegt${posten.length ? ' · im Liquiplan eingetragen' : ''} — Rückgängig, solange noch keine Rechnung und kein Fall daran hängt.`;
    return { angelegt: true, mandatId: d.mandatId, liquiplan: posten.length, text, ...(d.hinweis ? { hinweis: d.hinweis } : {}) };
  } catch (e) {
    console.warn('[crm] Mandat aus Angebot nicht automatisch angelegt:', e instanceof Error ? e.message.slice(0, 120) : e);
    if (begonnen) return { angelegt: false, grund: 'Das Mandat wird gerade fertig angelegt — das holt MAKE OS in wenigen Minuten von selbst nach (Liquiplan, Rückgängig).' };
    return { angelegt: false, grund: 'Das Mandat ist nicht von selbst entstanden — bitte „Mandat anlegen“.' };
  }
}

export type ZurueckErgebnis = { ok: true; mandatId: string; posten: number; schonZurueck: boolean } | { ok: false; status: number; fehler: string; grund?: string };

/** Hängt am Mandat schon eine Rechnung (auch ein Entwurf) oder ein Fall? Dann geht „Rückgängig“ nicht mehr. */
async function zurueckSperre(mandatId: string): Promise<{ status: number; grund: string; fehler: string } | null> {
  const plan = sauberFile(await loadJson<FinanzplanFile>('finanzplan'));
  if (plan.rechnungen.some(r => r.mandatId === mandatId)) return { status: 409, grund: 'rechnung', fehler: 'Am Mandat hängt schon eine Rechnung (auch ein Entwurf zählt) — Rückgängig geht nicht mehr. Das Mandat in der Mandatsakte beenden.' };
  const { fulfillmentLesen } = await import('@/lib/fulfillment/speicher');
  const faelle = await fulfillmentLesen('faelle').catch(() => null);
  if (faelle && Object.values(faelle.faelle ?? {}).some(f => f.mandatId === mandatId)) return { status: 409, grund: 'fall', fehler: 'Zum Mandat läuft schon ein Fall — Rückgängig geht nicht mehr. Das Mandat in der Mandatsakte beenden.' };
  return null;
}

/** Die Schritte „zurück“ — idempotent. Die Posten werden über die vorher festgehaltene Kennung gefunden (auch wenn das Mandat schon weg ist). */
async function zurueckAusfuehren(h: string, absicht: Absicht): Promise<ZurueckDaten> {
  return mitVorgang(h, absicht, async v => {
    const D = v.absicht.daten as unknown as ZurueckDaten;
    await v.schritt('crm', () => aendereCrm(x => (x.mandate.some(y => y.id === D.mandatId) ? { ...x, mandate: x.mandate.filter(y => y.id !== D.mandatId) } : x), D.wer));
    await v.schritt('liquiplan', async () => {
      const mm = { id: D.mandatId, ...(D.planpostenId ? { planpostenId: D.planpostenId } : {}) };
      let weg = 0;
      await updateJson<{ posten: Planposten[] }>('liquiplan', cur => {
        const l = cur?.posten ?? [];
        const rest = l.filter(x => !postenVomMandat(x.id, mm));
        weg = l.length - rest.length;
        return weg ? { ...(cur ?? {}), posten: rest } : (cur ?? { posten: [] });
      });
      return { weg };
    }, r => r);
    const { kreislaufAendern } = await import('@/lib/finanzen/rechnung/kreislauf');
    await v.schritt('merker', () => kreislaufAendern(k => {
      const info = k.mandatAuto?.[D.mandatId];
      return !info || info.zurueckAm ? k : { ...k, mandatAuto: { ...(k.mandatAuto ?? {}), [D.mandatId]: { ...info, zurueckAm: D.am } } };
    }));
    return v.absicht.daten as unknown as ZurueckDaten;
  });
}

/** „Rückgängig“ — siehe Kopf. `angebotId` = das angenommene Angebot, an dem die Automatik das Mandat anlegte. */
export async function mandatAutomatikZurueck(p: { angebotId: string; wer?: Wer; jetzt?: Date }): Promise<ZurueckErgebnis> {
  const { kreislaufLaden } = await import('@/lib/finanzen/rechnung/kreislauf');
  const auto = (await kreislaufLaden()).mandatAuto ?? {};
  const eintrag = Object.entries(auto).find(([, v]) => v.angebotId === p.angebotId);
  if (!eintrag) return { ok: false, status: 404, fehler: 'Zu diesem Angebot gibt es kein automatisch angelegtes Mandat — ein von Hand angelegtes wird in der Mandatsakte beendet oder gelöscht.' };
  const [mandatId, info] = eintrag;
  if (info.zurueckAm) return { ok: true, mandatId, posten: 0, schonZurueck: true };
  const sperre = await zurueckSperre(mandatId);
  if (sperre) return { ok: false, ...sperre };
  const m = (await ladeCrm()).mandate.find(y => y.id === mandatId);
  const h = await karteiHaushalt();
  const daten: ZurueckDaten = { aktion: 'zurueck', angebotId: p.angebotId, mandatId, ...(m?.planpostenId ? { planpostenId: m.planpostenId } : {}), am: (p.jetzt ?? new Date()).toISOString(), ...(p.wer ? { wer: p.wer } : {}) };
  const { absicht } = await absichtBeginnen(h, { art: ABSICHT_MANDAT_AUTO, schluessel: `zurueck:${p.angebotId}`, schritte: ZURUECK_SCHRITTE, daten: daten as unknown as Record<string, unknown>, ...(p.wer?.person ? { person: p.wer.person } : {}) });
  if (laeuftGerade(absicht.id)) return { ok: false, status: 409, fehler: 'Rückgängig läuft gerade — bitte gleich noch einmal nachsehen.' };
  const d = await zurueckAusfuehren(h, absicht);
  await absichtAbschliessen(h, absicht.id, 'fertig', ['mandatId', 'angebotId', 'weg']);
  return { ok: true, mandatId, posten: d.weg ?? 0, schonZurueck: false };
}

/**
 * Wiederaufnahme (Start, Takt, Durchsicht — lib/store/absichten-fortsetzen.ts). Ist der erste Schreibschritt noch nicht getan, wird vorher erneut
 * geprüft, ob der Vorgang noch gilt (Angebot angenommen, Deal gewonnen, keine gesperrte Person bzw. keine Rechnung/kein Fall am Mandat) — sonst „verworfen“.
 */
export async function mandatAutomatikFortsetzen(h: string, a: Absicht): Promise<void> {
  const d = a.daten as { aktion?: string };
  if (d.aktion === 'anlegen') {
    const D = a.daten as unknown as AnlegenDaten;
    if (!a.schritte.find(s => s.name === 'mandat')?.erledigt) {
      const crm = await ladeCrm();
      const ang = (crm.angebote ?? []).find(x => x.id === D.angebotId);
      const c = crm.chancen.find(x => x.id === D.dealId);
      const ids = Array.from(new Set([...D.kontaktIds, ...(ang?.kontaktId ? [ang.kontaktId] : [])]));
      if (!ang || ang.status !== 'angenommen' || !c || c.stufe !== 'gewonnen' || await personGesperrt(ids)) { await absichtAbschliessen(h, a.id, 'verworfen'); return; }
    }
    const r = await anlegenAusfuehren(h, a);
    await absichtAbschliessen(h, a.id, r.schonDa ? 'verworfen' : 'fertig', ['mandatId', 'angebotId']);
    return;
  }
  if (d.aktion === 'zurueck') {
    const D = a.daten as unknown as ZurueckDaten;
    if (!a.schritte.find(s => s.name === 'crm')?.erledigt && await zurueckSperre(D.mandatId)) { await absichtAbschliessen(h, a.id, 'verworfen'); return; }
    await zurueckAusfuehren(h, a);
    await absichtAbschliessen(h, a.id, 'fertig', ['mandatId', 'angebotId', 'weg']);
    return;
  }
  await absichtAbschliessen(h, a.id, 'verworfen');
}
