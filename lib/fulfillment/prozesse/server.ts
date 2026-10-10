// ─── Fulfillment · Prozesse — Schnittstellen und Server-Wege (Server; Paket C1, 10.10.) ────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 11 (C1): die festen Signaturen aus C0 (`fallLesen`, `faelleKurz`, `prozesseMorgenlauf`, `prozesseFristen`,
// `stakeholderAuskunft`, `PROZESSE_STAPEL`) — C2/C3 und die Hub-Dateien (morgenlauf.ts, fristen-server.ts, auskunft.ts, stapel.ts) rufen genau diese.
// Dazu: die Zeilen des Mandats-Cockpits (`cockpitDaten`), die Säule „Fulfillment“ im Business-Index (`ffKennzahlenFuerIndex` → null ohne Fall:
// der Index bleibt exakt der bisherige) und die Ansichten der Routen. Lesen schreibt nie; geschrieben wird nur über fall-server.ts bzw.
// `fulfillmentAendern`. Der Morgenlauf legt NUR Vorschläge in den Stapel (Onboarding starten, Nachsorge) — verschickt wird nichts.

import type { PersonMerkmale } from '@/lib/crm/person-weitere';
import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import type { Vorschlag } from '@/lib/zoe/stapel';
import type { CrmBestand, FollowUp, Mandat } from '@/lib/crm/typen';
import type { DossierKurz, Fall, FallKurz, FristenKontext, KundeKurz, MorgenlaufTeil, StakeholderAuskunft, VorlagenDatei } from '../typen';
import { fulfillmentAendern, fulfillmentHaushalt, fulfillmentLesen } from '../speicher';
import { aktuellerKnoten, fallFortschritt, mandatsEnde, onboardingKandidaten, unterschriftAm, wartetAufEuch, markeOnboardingAus } from '../regeln';
import { STAPEL_GRUPPE } from '../grenzen';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import { fallUmfeld, ableitungFuer, fallStartenServer, FallFehler } from './fall-server';
import { fallWirksam, onboardingStand, willkommenUhr } from './onboarding';
import { cockpitZeile, type CockpitZeile } from './cockpit';
import { ffIndexZeile, type FfIndexDaten } from './kennzahlen';
import { naechsterTermin } from './rituale';
import { nachsorgeFaellig, markeNachsorge, NACHSORGE_TEXT, type NachsorgeArt } from './wirkung';
import { vorlageFuerProdukt } from './vorlagen-anwenden';
import { fnv } from './pruefen';

/** Der Fall eines Mandats, wie er wirkt (Onboarding-Schritte abgeleitet) — null, wenn es keinen gibt. Nur lesend. */
export async function fallLesen(mandatId: string): Promise<Fall | null> {
  const { crm, vorlagen, faelle, kunde } = await fallUmfeld([mandatId]);
  const f = faelle.faelle[mandatId];
  if (!f) return null;
  const m = crm.mandate.find(x => x.id === mandatId);
  return fallWirksam(f, ableitungFuer(f, m, crm, vorlagen, kunde[mandatId], new Date().toISOString()));
}

/** Kurzform je Fall (Schlüssel = Mandat-Kennung). Ohne Angabe: alle Fälle. */
export async function faelleKurz(mandatIds?: readonly string[]): Promise<Record<string, FallKurz>> {
  const { crm, vorlagen, faelle, kunde } = await fallUmfeld(mandatIds);
  const jetzt = new Date().toISOString(), heute = localDay();
  const raus: Record<string, FallKurz> = {};
  for (const f of Object.values(faelle.faelle)) {
    if (mandatIds && !mandatIds.includes(f.mandatId)) continue;
    const m = crm.mandate.find(x => x.id === f.mandatId);
    const abl = ableitungFuer(f, m, crm, vorlagen, kunde[f.mandatId], jetzt);
    const w = fallWirksam(f, abl);
    const st = onboardingStand(f, abl);
    const a = aktuellerKnoten(w);
    const wa = wartetAufEuch(w, heute);
    raus[f.mandatId] = {
      mandatId: f.mandatId, status: w.status, ...(a.phase ? { phase: a.phase.titel } : {}), fortschritt: fallFortschritt(w),
      ...(a.schritt ? { naechster: a.schritt.titel } : {}), wartet: wa.length, ...(wa[0]?.tage !== undefined ? { wartetAeltesterTage: wa[0].tage } : {}),
      onboardingOffen: st.offen, willkommenUeberfaellig: st.willkommen.ueberfaellig,
    };
  }
  return raus;
}

// ── Cockpit und Business-Index ─────────────────────────────────────────────────────────────────────────────────────────────────────

async function sicher<T>(f: () => Promise<T>, ersatz: T): Promise<T> { try { return await f(); } catch { return ersatz; } }

/** Die Zeilen des Mandats-Cockpits (laufende Fälle von Mandaten einer Business-Gesellschaft). Leer ohne Fall. */
export async function cockpitDaten(heute = localDay(), jetzt = new Date().toISOString()): Promise<{ zeilen: (CockpitZeile & { gesellschaft: string })[]; vorlagen: VorlagenDatei }> {
  const { crm, vorlagen, faelle, kunde } = await fallUmfeld();
  const laufend = Object.values(faelle.faelle).filter(f => f.status !== 'abgeschlossen');
  if (!laufend.length) return { zeilen: [], vorlagen };
  const ids = laufend.map(f => f.mandatId);
  const { istBusinessGesellschaft } = await import('@/lib/einheiten');
  const [treppe, dossiers, bezuege] = await Promise.all([
    sicher(async () => (await import('@/lib/crm/treppe-server')).ladeTreppe(heute), null),
    sicher(async () => (await import('../analyse/server')).dossierKurzFuer(ids), {} as Record<string, DossierKurz>),
    sicher(async () => (await import('@/lib/kalender/bezug-server')).ladeBezuege(), { bezuege: {} }),
  ]);
  const { kundenZeilen } = await import('@/lib/crm/treppe');
  const kz = treppe ? kundenZeilen({ datei: treppe, crm, heute }) : [];
  const { uidVonSchluessel } = await import('@/lib/kalender/bezug');
  const terminTage = Object.entries(bezuege.bezuege).filter(([, b]) => b.mandatId && b.tag).map(([k, b]) => ({ uid: uidVonSchluessel(k), tag: b.tag!, mandatId: b.mandatId! }));
  const zeilen: (CockpitZeile & { gesellschaft: string })[] = [];
  for (const f of laufend) {
    const m = crm.mandate.find(x => x.id === f.mandatId && !x.geloeschtAm);
    if (!m || !istBusinessGesellschaft(m.gesellschaft)) continue;
    const abl = ableitungFuer(f, m, crm, vorlagen, kunde[m.id], jetzt);
    const w = fallWirksam(f, abl);
    const z = kz.find(x => x.mandatId === m.id);
    const uids = f.rituale.flatMap(r => r.terminUids);
    const naechster = naechsterTermin(terminTage.filter(t => t.mandatId === m.id), uids, heute);
    zeilen.push({
      ...cockpitZeile({
        fall: w, kunde: m.kunde, titel: m.titel, paket: vorlagen.prozesse.find(p => p.id === f.vorlageId)?.titel,
        onboarding: onboardingStand(f, abl), ...(kunde[m.id] ? { kunde2: kunde[m.id] } : {}), ...(dossiers[m.id] ? { dossier: dossiers[m.id] } : {}),
        health: z?.ampel.gesamt ?? null, report: { faellig: z?.report.faellig ?? false, ...(z?.report.gesendetAm || z?.report.letzter ? { letzter: z?.report.gesendetAm ?? z?.report.letzter } : {}) },
        ...(naechster ? { naechsterRitual: naechster } : {}), pulsSchwelle: vorlagen.einstellungen.pulsSchwelle, heute,
      }),
      gesellschaft: m.gesellschaft,
    });
  }
  return { zeilen, vorlagen };
}

/**
 * Die Säule „Fulfillment“ des Business-Index: je laufendem Fall nur Summen (Health-Ampel, Hänger, letzter Puls, Wert-Konto). Ohne Fall
 * (oder bei einem Lesefehler) null — dann zählt die Säule nicht und der Index ist exakt der bisherige.
 */
export async function ffKennzahlenFuerIndex(heute = localDay()): Promise<FfIndexDaten | null> {
  try {
    const { zeilen } = await cockpitDaten(heute);
    if (!zeilen.length) return null;
    const faelle = await fulfillmentLesen('faelle');
    return {
      heute,
      zeilen: zeilen.map(z => ffIndexZeile({
        fall: faelle.faelle[z.mandatId], gesellschaft: z.gesellschaft, kunde: z.kunde, health: z.health, haengt: z.haengt.map(h => h.text),
        ...(z.puls ? { puls: z.puls } : {}),
      })),
    };
  } catch { return null; }
}

// ── Morgenlauf: Onboarding-Vorschläge und Nachsorge (3.1, 5.3) ─────────────────────────────────────────────────────────────────────

export const markeOnboardingVorschlag = (mandatId: string) => `onboarding-vorschlag:${mandatId}`;
export const WERKZEUG = { onboarding: 'fulfillment_onboarding', nachsorge: 'fulfillment_nachsorge' } as const;

/** Für wen ein Vorschlag ist: die zuständige Person des Mandats, wenn sie im Haushalt ist — sonst ohne Person (der Haushalt sieht ihn). */
async function zustaendigePerson(m: Pick<Mandat, 'zustaendig'>): Promise<string | undefined> {
  const { haushaltsPersonen } = await import('@/lib/aufgaben/sicht');
  const p = (await haushaltsPersonen()).map(x => x.speicher);
  return m.zustaendig && p.includes(m.zustaendig) ? m.zustaendig : undefined;
}
async function empfaenger(m: Pick<Mandat, 'zustaendig'>): Promise<string[]> {
  const p = await zustaendigePerson(m);
  if (p) return [p];
  const { haushaltsPersonen } = await import('@/lib/aufgaben/sicht');
  return (await haushaltsPersonen()).map(x => x.speicher);
}

export async function prozesseMorgenlauf(h: string, heute: string): Promise<MorgenlaufTeil> {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const [crm, vorlagen, faelle] = await Promise.all([ladeCrm(), fulfillmentLesen('vorlagen', h), fulfillmentLesen('faelle', h)]);
  const kandidaten = onboardingKandidaten(crm, faelle.faelle, vorlagen.marken, heute).filter(k => !vorlagen.marken[markeOnboardingVorschlag(k.mandatId)]);
  const enden: Record<string, string | null> = Object.fromEntries(crm.mandate.map(m => [m.id, mandatsEnde(m)]));
  const nachsorge = nachsorgeFaellig({ faelle: Object.values(faelle.faelle), enden, tage: vorlagen.einstellungen.nachsorgeTage, heute });
  if (!kandidaten.length && !nachsorge.length) return { vorschlaege: 0 };
  const { lege } = await import('@/lib/zoe/stapel');
  const { melde } = await import('@/lib/meldungen/melden');
  const { WEG } = await import('@/lib/wege');
  let n = 0;
  const neueMarken: Record<string, string> = {};
  for (const k of kandidaten) {
    const m = crm.mandate.find(x => x.id === k.mandatId)!;
    const person = await zustaendigePerson(m);
    const v = vorlageFuerProdukt(vorlagen, m.leistungId);
    await lege({
      werkzeug: WERKZEUG.onboarding, gruppe: STAPEL_GRUPPE, titel: `Kundenonboarding starten: ${m.kunde}`.slice(0, 200),
      nachher: v ? `Fall nach „${v.titel}“ anlegen — die Willkommensmail bereitest du danach vor, gesendet wird erst per Klick` : 'Fall anlegen — vorher dem Produkt eine Paket-Vorlage zuordnen (Produkte › Fulfillment)',
      eingabe: { mandatId: m.id, ...(v ? { vorlageId: v.id } : {}) }, anlass: k.grund === 'vertrag' ? 'Vertrag unterschrieben' : k.grund === 'angebot' ? 'Angebot angenommen' : 'Deal gewonnen',
      quelle: 'lauf', bezug: { art: 'fulfillment', id: `p:onboarding:${m.id}` }, ...(person ? { person } : {}),
    });
    for (const an of await empfaenger(m)) await melde({ an, art: 'produkte', titel: 'Ein neuer Kunde ist bereit fürs Onboarding — Vorschlag im Stapel', link: WEG.fulfillment('onboarding') });
    neueMarken[markeOnboardingVorschlag(m.id)] = heute;
    n++;
  }
  if (Object.keys(neueMarken).length) await fulfillmentAendern('vorlagen', d => ({ ok: true, datei: { ...d, marken: { ...d.marken, ...neueMarken } }, geaendert: Object.keys(neueMarken) }), { art: 'system' }, h);
  const fallMarken: Record<string, Record<string, string>> = {};
  for (const x of nachsorge) {
    const m = crm.mandate.find(y => y.id === x.mandatId);
    if (!m) continue;
    const person = await zustaendigePerson(m);
    await lege({
      werkzeug: WERKZEUG.nachsorge, gruppe: STAPEL_GRUPPE, titel: `${NACHSORGE_TEXT[x.art]}: ${m.kunde}`.slice(0, 200), vorher: `Mandat beendet (Tag +${x.tag})`,
      nachher: 'Follow-up am Mandat anlegen — gesprochen bzw. geschrieben wird erst per Klick', eingabe: { mandatId: m.id, tag: x.tag, art: x.art },
      anlass: `Nachsorge ${x.tag} Tage nach dem Mandatsende`, quelle: 'lauf', bezug: { art: 'fulfillment', id: `p:nachsorge:${m.id}:${x.tag}` }, ...(person ? { person } : {}),
    });
    for (const an of await empfaenger(m)) await melde({ an, art: 'produkte', titel: 'Nachsorge für einen früheren Kunden — Vorschlag im Stapel', link: WEG.fall(m.id) });
    (fallMarken[m.id] ??= {})[markeNachsorge(m.id, x.tag)] = heute;
    n++;
  }
  if (Object.keys(fallMarken).length) {
    await fulfillmentAendern('faelle', d => {
      const neu = { ...d.faelle };
      for (const [mid, mk] of Object.entries(fallMarken)) if (neu[mid]) neu[mid] = { ...neu[mid], marken: { ...neu[mid].marken, ...mk } };
      return { ok: true, datei: { ...d, faelle: neu }, geaendert: Object.keys(fallMarken) };
    }, { art: 'system' }, h);
  }
  return { vorschlaege: n };
}

// ── Löschfristen (8.1) ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const plusMonate = (t: string, n: number) => { const d = new Date(`${t.slice(0, 10)}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

/**
 * Stakeholder-Haltung und -Notiz 12 Monate (einstellbar) nach Mandatsende entfernen; Fälle endgültig gelöschter Mandate entfernen.
 * Nur Zähler, keine Namen. Liest das CRM mit Papierkorb — ist der CRM-Bestand nicht lesbar oder fehlt er, wird nichts entfernt.
 */
export async function prozesseFristen(k: FristenKontext): Promise<Record<string, number>> {
  const { loadJson } = await import('@/lib/store/local-db');
  if ((await loadJson<unknown>('crm')) === null) return {};
  const { ladeCrmMitPapierkorb } = await import('@/lib/crm/speicher');
  const crm = await ladeCrmMitPapierkorb();
  const h = await fulfillmentHaushalt();
  let haltung = 0, weg = 0;
  await fulfillmentAendern('faelle', d => {
    const neu: typeof d.faelle = {};
    for (const [mid, f] of Object.entries(d.faelle)) {
      const m = crm.mandate.find(x => x.id === mid);
      if (!m) { weg++; continue; }
      const ende = mandatsEnde(m);
      if (ende && plusMonate(ende, k.fristen.mandatsdatenMonate) <= k.heute && f.stakeholder.some(s => s.haltung || s.notiz)) {
        neu[mid] = { ...f, stakeholder: f.stakeholder.map(s => { if (!s.haltung && !s.notiz) return s; haltung++; const { haltung: _h, notiz: _n, ...r } = s; return r; }) };
      } else neu[mid] = f;
    }
    return { ok: true, datei: { ...d, faelle: neu }, geaendert: [] };
  }, { art: 'system' }, h);
  return { ...(haltung ? { 'fulfillment-stakeholder-haltung': haltung } : {}), ...(weg ? { 'fulfillment-faelle-verwaist': weg } : {}) };
}

/** Art. 15: Stakeholder-Einträge, die die Person (Kontakt-Kennung) betreffen. */
export async function stakeholderAuskunft(m: PersonMerkmale): Promise<StakeholderAuskunft[]> {
  const faelle = await fulfillmentLesen('faelle');
  return Object.values(faelle.faelle).flatMap(f => f.stakeholder.filter(s => s.kontaktId === m.id).map(s => ({
    mandatId: f.mandatId, rolle: s.rolle, einfluss: s.einfluss, ...(s.haltung ? { haltung: s.haltung } : {}), ...(s.notiz ? { notiz: s.notiz } : {}),
  })));
}

// ── Freigabe-Stapel, Präfix `p:` ─────────────────────────────────────────────────────────────────────────────────────────────────

type Erg = Awaited<ReturnType<StapelArtFreigabe['freigeben']>>;
const NACHSORGE_ARTEN: readonly NachsorgeArt[] = ['checkin', 'empfehlung', 'stufe'];

/** Follow-up der Nachsorge am Mandat (idempotent über die Kennung). */
function nachsorgeFollowup(b: CrmBestand, m: Mandat, art: NachsorgeArt, tag: number, person: string, jetzt: Date): CrmBestand {
  const id = `fu-ff-${fnv(`${m.id}|${tag}`)}`;
  if ((b.followups ?? []).some(f => f.id === id)) return b;
  const iso = jetzt.toISOString();
  const fu = {
    id, bezug: { art: 'mandat', id: m.id }, ...(m.kontaktIds[0] ? { kontaktId: m.kontaktIds[0] } : {}), art: art === 'checkin' ? 'anruf' : 'termin',
    text: NACHSORGE_TEXT[art], faellig: tagPlus(localDay(jetzt), 2), zustaendig: m.zustaendig ?? person, status: 'offen', quelle: 'head',
    angelegt: iso, geaendert: iso, geaendertVon: person,
  } as unknown as FollowUp;
  return { ...b, followups: [...(b.followups ?? []), fu] };
}

export const PROZESSE_STAPEL: StapelArtFreigabe = {
  freigeben: async (vIn, person, opt): Promise<Erg> => {
    const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    if (!(await personImHaushaltDesInhabers(person))) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
    const { beanspruche, entscheide, loslassen } = await import('@/lib/zoe/stapel');
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== 'fulfillment' || !v.bezug.id.startsWith('p:') || !Object.values(WERKZEUG).includes(v.werkzeug as typeof WERKZEUG[keyof typeof WERKZEUG])) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person && v.person !== person) return { status: 403, fehler: 'Nur die Person, für die der Vorschlag vorbereitet wurde, gibt ihn frei.' };
      return null;
    });
    if (!a.ok) return { ok: false, status: a.status, fehler: a.fehler };
    const v: Vorschlag = a.v;
    try {
      const mandatId = String(v.eingabe.mandatId ?? '');
      let text = '';
      if (v.werkzeug === WERKZEUG.onboarding) {
        const faelle = await fulfillmentLesen('faelle');
        if (faelle.faelle[mandatId]) text = 'Für dieses Mandat läuft schon ein Fall — nichts doppelt angelegt.';
        else {
          const vorlageId = (typeof opt.eingabe?.vorlageId === 'string' ? opt.eingabe.vorlageId : undefined) ?? (typeof v.eingabe.vorlageId === 'string' ? v.eingabe.vorlageId : undefined) ?? await (async () => {
            const { ladeCrm } = await import('@/lib/crm/speicher');
            const m = (await ladeCrm()).mandate.find(x => x.id === mandatId);
            return vorlageFuerProdukt(await fulfillmentLesen('vorlagen'), m?.leistungId)?.id;
          })();
          if (!vorlageId) { await loslassen(v.id); return { ok: false, status: 409, fehler: 'Erst dem Produkt eine Paket-Vorlage zuordnen (Produkte › Fulfillment) — oder unter Fulfillment › Onboarding mit Vorlage starten.' }; }
          await fallStartenServer({ mandatId, vorlageId, person });
          text = 'Fall angelegt — unter Fulfillment › Fall: Willkommensmail vorbereiten (gesendet wird erst per Klick).';
        }
      } else {
        const art = NACHSORGE_ARTEN.includes(v.eingabe.art as NachsorgeArt) ? v.eingabe.art as NachsorgeArt : 'checkin';
        const tag = Number(v.eingabe.tag) || 0;
        const { ladeCrm, aendereCrm } = await import('@/lib/crm/speicher');
        const m = (await ladeCrm()).mandate.find(x => x.id === mandatId);
        if (!m) { await loslassen(v.id); return { ok: false, status: 404, fehler: 'Dieses Mandat gibt es nicht (mehr).' }; }
        const jetzt = new Date();
        await aendereCrm(b => nachsorgeFollowup(b, m, art, tag, person, jetzt), { art: 'person', person });
        text = `Follow-up „${NACHSORGE_TEXT[art]}“ am Mandat angelegt (in zwei Tagen fällig).`;
      }
      await entscheide(v.id, 'freigegeben', { ergebnis: text, von: person, ausArbeit: true });
      return { ok: true, text };
    } catch (e) {
      await loslassen(v.id);
      if (e instanceof FallFehler) return { ok: false, status: e.status, fehler: e.message };
      throw e;
    }
  },
};

// ── Ansichten der Routen ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Onboarding-Kandidaten mit Uhr und vorgeschlagener Vorlage (für Produkte & Mandate und Fulfillment › Onboarding). */
export function kandidatenAnsicht(crm: Pick<CrmBestand, 'mandate' | 'angebote' | 'chancen'>, vorlagen: VorlagenDatei, faelle: Record<string, Fall>, heute: string, jetzt: string) {
  return onboardingKandidaten(crm, faelle, vorlagen.marken, heute).map(k => {
    const m = crm.mandate.find(x => x.id === k.mandatId)!;
    const v = vorlageFuerProdukt(vorlagen, m.leistungId);
    return { ...k, uhr: willkommenUhr(k.unterschrift?.am, vorlagen.einstellungen.willkommenStunden, undefined, jetzt), ...(v ? { vorlage: { id: v.id, titel: v.titel } } : {}), vorgeschlagen: !!vorlagen.marken[markeOnboardingVorschlag(k.mandatId)] };
  });
}
export { markeOnboardingAus, unterschriftAm };
export type { KundeKurz };
