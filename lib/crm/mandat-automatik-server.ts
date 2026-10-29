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

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { gesellschaftAusEinheit, istBusinessGesellschaft, istRegisterKennung } from '@/lib/einheiten';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { Planposten } from '@/lib/make-one/liquiditaet';
import { sauberFile, type FinanzplanFile } from '@/lib/finanzen/finanzplan-bestand';
import { ladeCrm, aendereCrm } from './speicher';
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

/** Nach „angenommen“ — siehe Kopf. `null` = es gab nichts zu tun (Mandat schon da, Angebot nicht angenommen). Wirft nie. */
export async function mandatAusAngebotAutomatisch(p: { angebotId: string; person: string; wer?: Wer; jetzt?: Date }): Promise<AutomatikErgebnis | null> {
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
    // Art. 18 bzw. Werbesperre einer beteiligten Person: nichts automatisch (die Kartei wird nicht weiter verarbeitet als nötig).
    const { kontakteFuerVerarbeitung } = await import('./verarbeitung');
    const kartei = await kontakteFuerVerarbeitung({ mitEingeschraenkten: true });
    const ids = Array.from(new Set([...c.kontaktIds, ...(a.kontaktId ? [a.kontaktId] : [])]));
    if (ids.some(id => { const k = kartei.find(x => x.id === id); return !!k && (k.eingeschraenkt || k.werbesperre); })) {
      return { angelegt: false, grund: 'Eine beteiligte Person ist eingeschränkt bzw. gesperrt — das Mandat bitte von Hand anlegen.' };
    }
    const m = mandatAusDeal(c, { leistungen: crm.leistungen, angebote: crm.angebote, firmen: crm.firmen, id: neueKennung('m'), jetzt, heute, person: p.person }).mandat;
    let schonDa = false;
    await aendereCrm(x => {
      if (x.mandate.some(mm => mm.chanceId === c.id && !mm.geloeschtAm)) { schonDa = true; return x; }
      return { ...x, mandate: [...x.mandate, m], firmen: x.firmen.map(f => (dealZuFirma(c, f) && !f.rolleVonHand ? { ...f, rolle: 'kunde' } : f)) };
    }, p.wer);
    if (schonDa) return null;
    const { personenWerdenKunde } = await import('./mandat-anlegen-server');
    await personenWerdenKunde(c.kontaktIds, jetzt, p.wer);
    // Liquiplan (nur Business wie die Liquidität): derselbe Rechenweg wie „Eintragen“.
    let posten: string[] = [];
    let hinweis: string | undefined;
    if (istBusinessGesellschaft(m.gesellschaft)) {
      const crm2 = await ladeCrm();
      const l = await mandatLiquiplanEintragen(crm2.mandate.find(x => x.id === m.id) ?? m, crm2, heute).catch(() => ({ ok: false as const, status: 500, fehler: 'Liquiplan nicht erreichbar.' }));
      if (l.ok) posten = l.soll.map(x => x.id);
      else hinweis = `Nicht im Liquiplan: ${l.fehler}`;
    } else hinweis = 'Die Gesellschaft gehört nicht zum Business — in den Liquiplan trägt die Mandatsakte auf Klick ein.';
    const { kreislaufAendern } = await import('@/lib/finanzen/rechnung/kreislauf');
    await kreislaufAendern(k => ({ ...k, mandatAuto: { ...(k.mandatAuto ?? {}), [m.id]: { angebotId: a.id, am: jetzt, posten } } }));
    const text = `Mandat angelegt${posten.length ? ' · im Liquiplan eingetragen' : ''} — Rückgängig, solange noch keine Rechnung und kein Fall daran hängt.`;
    return { angelegt: true, mandatId: m.id, liquiplan: posten.length, text, ...(hinweis ? { hinweis } : {}) };
  } catch (e) {
    console.warn('[crm] Mandat aus Angebot nicht automatisch angelegt:', e instanceof Error ? e.message.slice(0, 120) : e);
    return { angelegt: false, grund: 'Das Mandat ist nicht von selbst entstanden — bitte „Mandat anlegen“.' };
  }
}

export type ZurueckErgebnis = { ok: true; mandatId: string; posten: number; schonZurueck: boolean } | { ok: false; status: number; fehler: string; grund?: string };

/** „Rückgängig“ — siehe Kopf. `angebotId` = das angenommene Angebot, an dem die Automatik das Mandat anlegte. */
export async function mandatAutomatikZurueck(p: { angebotId: string; wer?: Wer; jetzt?: Date }): Promise<ZurueckErgebnis> {
  const { kreislaufLaden, kreislaufAendern } = await import('@/lib/finanzen/rechnung/kreislauf');
  const auto = (await kreislaufLaden()).mandatAuto ?? {};
  const eintrag = Object.entries(auto).find(([, v]) => v.angebotId === p.angebotId);
  if (!eintrag) return { ok: false, status: 404, fehler: 'Zu diesem Angebot gibt es kein automatisch angelegtes Mandat — ein von Hand angelegtes wird in der Mandatsakte beendet oder gelöscht.' };
  const [mandatId, info] = eintrag;
  if (info.zurueckAm) return { ok: true, mandatId, posten: 0, schonZurueck: true };
  const plan = sauberFile(await loadJson<FinanzplanFile>('finanzplan'));
  if (plan.rechnungen.some(r => r.mandatId === mandatId)) return { ok: false, status: 409, grund: 'rechnung', fehler: 'Am Mandat hängt schon eine Rechnung (auch ein Entwurf zählt) — Rückgängig geht nicht mehr. Das Mandat in der Mandatsakte beenden.' };
  const { fulfillmentLesen } = await import('@/lib/fulfillment/speicher');
  const faelle = await fulfillmentLesen('faelle').catch(() => null);
  if (faelle && Object.values(faelle.faelle ?? {}).some(f => f.mandatId === mandatId)) return { ok: false, status: 409, grund: 'fall', fehler: 'Zum Mandat läuft schon ein Fall — Rückgängig geht nicht mehr. Das Mandat in der Mandatsakte beenden.' };
  let m: Mandat | undefined;
  await aendereCrm(x => {
    m = x.mandate.find(y => y.id === mandatId);
    return m ? { ...x, mandate: x.mandate.filter(y => y.id !== mandatId) } : x;
  }, p.wer);
  let weg = 0;
  if (m) {
    const mm = m as Mandat;
    await updateJson<{ posten: Planposten[] }>('liquiplan', cur => {
      const l = cur?.posten ?? [];
      const rest = l.filter(x => !postenVomMandat(x.id, mm));
      weg = l.length - rest.length;
      return weg ? { ...(cur ?? {}), posten: rest } : (cur ?? { posten: [] });
    });
  }
  const am = (p.jetzt ?? new Date()).toISOString();
  await kreislaufAendern(k => ({ ...k, mandatAuto: { ...(k.mandatAuto ?? {}), [mandatId]: { ...info, zurueckAm: am } } }));
  return { ok: true, mandatId, posten: weg, schonZurueck: false };
}
