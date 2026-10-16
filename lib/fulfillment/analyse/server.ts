// ─── Fulfillment · Analyse — Schnittstellen für die anderen Pakete (Server; gefüllt in C3, 10.10.) ────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 11 (C3): Die Signaturen sind fest — C1 (Cockpit) und die Hub-Dateien von C0 (morgenlauf.ts, fristen-server.ts,
// auskunft.ts, stapel.ts) rufen genau diese Namen.
//   dossierKurzFuer    Kurzform je Mandat (Dossier da, F1/F2, letzter Stand je Agent, Kosten, Art.-14-Fristen bald)
//   analyseMorgenlauf  verwaiste Läufe → „abgebrochen“, Art.-14-Uhr der Personenkarten → Hinweis im Stapel (`a:art14:<karte>`). Er startet NIE einen Lauf.
//   personenFristen    Personenkarten 90 Tage nach Mandatsende (einstellbar) weg — am Dossier bleibt nur der Vermerk (Anzahl); Lauf-Entwürfe nach
//                      90 Tagen weg; Dossiers und Karten endgültig gelöschter Mandate weg
//   personenAuskunft   Art. 15: Karten, die die Person nennen (Name oder Kontakt-Kennung)
//   ANALYSE_STAPEL     Freigabe des Art.-14-Hinweises: legt die Aufgabe „Art.-14-Hinweis geben“ an (feste Kennung, idempotent) — nichts geht hinaus.

import type { PersonMerkmale } from '@/lib/crm/person-weitere';
import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import type { DossierKurz, FristenKontext, MorgenlaufTeil, PersonenAuskunft, PersonenKarte, AnalyseAgentId, LaufStatus } from '../typen';
import { fulfillmentAendern, fulfillmentLesen } from '../speicher';
import { STAPEL_GRUPPE } from '../grenzen';
import { mandatsEnde } from '../regeln';
import { laufStatusAnzeige, laufVerwaist } from './agenten';
import { art14Stand } from './dsgvo';
import { entwurfOhne } from './dossier-anwenden';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { anzahl } from '@/lib/text/zahlwort';

/** Lauf-Entwürfe bleiben so viele Tage nach dem Lauf (8.1). */
export const ENTWURF_TAGE = 90;

/** Kurzform je Mandat für das Cockpit — Schlüssel = Mandat-Kennung. */
export async function dossierKurzFuer(mandatIds: readonly string[]): Promise<Record<string, DossierKurz>> {
  const [dossiers, personen, { mitKontaktArt14 }] = await Promise.all([fulfillmentLesen('dossiers'), fulfillmentLesen('personen'), import('./personen-server')]);
  const karten = await mitKontaktArt14(personen.karten.filter(k => mandatIds.includes(k.mandatId)));
  const { localDay } = await import('@/lib/zeit');
  const heute = localDay(), jetzt = Date.now();
  return Object.fromEntries(mandatIds.map(m => {
    const d = dossiers.dossiers[m];
    if (!d) return [m, { vorhanden: false, f1: false, f2: false, laeufe: {}, kostenCent: 0, art14Bald: 0 } satisfies DossierKurz];
    const laeufe: Partial<Record<AnalyseAgentId, LaufStatus>> = {};
    for (const l of d.laeufe) laeufe[l.agent] = laufStatusAnzeige(l, jetzt);
    const art14Bald = karten.filter(k => k.mandatId === m && ['bald', 'ueberfaellig'].includes(art14Stand(k, heute).stufe)).length;
    return [m, { vorhanden: true, f1: !!d.f1, f2: !!d.f2, laeufe, kostenCent: Math.round(d.laeufe.reduce((s, l) => s + (l.kostenCent ?? 0), 0)), art14Bald } satisfies DossierKurz];
  }));
}

/** Marke „Art.-14-Vorschlag gelegt“ je Karte und Frist (in `vorlagen.marken`). */
export const markeArt14 = (karteId: string, faelligAm: string): string => `art14-vorschlag:${karteId}:${faelligAm}`.slice(0, 120);

/** Morgenlauf: verwaiste Läufe abschließen, Art.-14-Hinweise in den Stapel. Startet nie einen Lauf. */
export async function analyseMorgenlauf(h: string, heute: string): Promise<MorgenlaufTeil> {
  const jetzt = Date.now();
  let verwaist = 0;
  await fulfillmentAendern('dossiers', cur => {
    let n = 0;
    const dossiers = Object.fromEntries(Object.entries(cur.dossiers).map(([m, d]) => [m, { ...d, laeufe: d.laeufe.map(l => (laufVerwaist(l, jetzt) ? (n++, { ...l, status: 'abgebrochen' as const, fehler: 'Neustart des Servers? Der Lauf hat sich nicht mehr gemeldet.' }) : l)) }]));
    verwaist = n;
    return n ? { ok: true, datei: { ...cur, dossiers }, geaendert: [] } : { ok: false, status: 400, fehler: 'nichts' };
  }, { art: 'system' }, h);
  const [personen, dossiers, vorlagen, stapel, { mitKontaktArt14 }] = await Promise.all([fulfillmentLesen('personen', h), fulfillmentLesen('dossiers', h), fulfillmentLesen('vorlagen', h), import('@/lib/zoe/stapel'), import('./personen-server')]);
  const offen = new Set((await stapel.lies('offen')).filter(v => v.bezug?.art === 'fulfillment').map(v => v.bezug!.id));
  let vorschlaege = 0;
  const neueMarken: Record<string, string> = {};
  for (const k of await mitKontaktArt14(personen.karten)) {
    const st = art14Stand(k, heute);
    if (st.stufe !== 'bald' && st.stufe !== 'ueberfaellig') continue;
    const id = `a:art14:${k.id}`;
    // Prüf-Fund 11.10.: je Karte und Frist nur EIN Vorschlag — auch wenn der vorige abgelehnt oder entschieden ist (vorher kam er täglich neu).
    const marke = markeArt14(k.id, st.faelligAm ?? '');
    if (offen.has(id) || vorlagen.marken[marke]) continue;
    neueMarken[marke] = heute;
    const d = dossiers.dossiers[k.mandatId];
    const person = d?.f1?.von || d?.geaendertVon || undefined;
    await stapel.lege({
      werkzeug: 'fulfillment_art14', gruppe: STAPEL_GRUPPE, titel: `Art.-14-Hinweis ${st.stufe === 'ueberfaellig' ? 'überfällig' : 'bald fällig'}: ${k.funktion}`,
      nachher: `Aufgabe „Art.-14-Hinweis geben“ mit Frist ${st.faelligAm} anlegen — der Hinweis selbst geht nur von Hand hinaus (Fall › Analyse › Personen).`,
      eingabe: { karte: k.id, mandatId: k.mandatId, faelligAm: st.faelligAm }, anlass: 'Die Art.-14-Uhr der beruflichen Personenkarte läuft ab (spätestens ein Monat nach Erfassung).',
      quelle: 'lauf', bezug: { art: 'fulfillment', id }, ...(person && /^[a-z0-9-]{1,40}$/.test(person) ? { person: person as never } : {}),
    });
    vorschlaege++;
  }
  if (Object.keys(neueMarken).length) await fulfillmentAendern('vorlagen', d => ({ ok: true, datei: { ...d, marken: { ...d.marken, ...neueMarken } }, geaendert: Object.keys(neueMarken) }), { art: 'system' }, h);
  return { vorschlaege, ...(verwaist ? { info: `${anzahl(verwaist, 'verwaiste Analyse', 'verwaiste Analysen')} abgeschlossen` } : {}) };
}

/** Löschfristen (8.1) — Zähler je Name, keine Namen, keine Kennungen. */
export async function personenFristen(k: FristenKontext): Promise<Record<string, number>> {
  // CRM-Wächter (Prüf-Fund 11.10.): fehlt der CRM-Bestand, gälte jede Karte als „Mandat endgültig gelöscht“ → nie etwas löschen.
  const { loadJson } = await import('@/lib/store/local-db');
  if ((await loadJson<unknown>('crm')) === null) return {};
  const { ladeCrmMitPapierkorb } = await import('@/lib/crm/speicher');
  const mandate = new Map((await ladeCrmMitPapierkorb()).mandate.map(m => [m.id, m]));
  const loeschAm = (karte: PersonenKarte): string | null => {
    const m = mandate.get(karte.mandatId);
    if (!m) return k.heute; // Mandat endgültig gelöscht → sofort
    const ende = mandatsEnde(m);
    return ende ? tagPlus(ende, k.fristen.personenTage) : null;
  };
  // 1. Personenkarten nach der Frist
  const weg: Record<string, number> = {};
  await fulfillmentAendern('personen', cur => {
    const bleiben = cur.karten.filter(x => { const am = loeschAm(x); const raus = !!am && am <= k.heute; if (raus) weg[x.mandatId] = (weg[x.mandatId] ?? 0) + 1; return !raus; });
    return bleiben.length !== cur.karten.length ? { ok: true, datei: { ...cur, karten: bleiben }, geaendert: Object.keys(weg) } : { ok: false, status: 400, fehler: 'nichts' };
  }, { art: 'system' });
  const karten = Object.values(weg).reduce((s, n) => s + n, 0);
  // 2. Vermerk am Dossier (nur Anzahl), Lauf-Entwürfe nach 90 Tagen, Dossiers gelöschter Mandate
  const grenze = tagPlus(k.heute, -ENTWURF_TAGE);
  let entwuerfe = 0, dossiers = 0;
  await fulfillmentAendern('dossiers', cur => {
    let geaendert = false;
    const neu: typeof cur.dossiers = {};
    for (const [m, d] of Object.entries(cur.dossiers)) {
      if (!mandate.has(m)) { dossiers++; geaendert = true; continue; }
      const laeufe = d.laeufe.map(l => {
        if (l.ergebnis === undefined || l.status === 'laeuft' || !l.fertigAm || l.fertigAm.slice(0, 10) > grenze) return l;
        entwuerfe++; geaendert = true;
        const funktion = (l.ergebnis as { funktion?: unknown }).funktion;
        return { ...entwurfOhne(l), ...(typeof funktion === 'string' ? { ergebnis: { funktion } } : {}) };
      });
      const vermerk = weg[m] ? [...(d.personenGeloescht ?? []), { am: k.heute, anzahl: weg[m] }] : d.personenGeloescht;
      if (weg[m]) geaendert = true;
      neu[m] = { ...d, laeufe, ...(vermerk ? { personenGeloescht: vermerk } : {}) };
    }
    return geaendert ? { ok: true, datei: { ...cur, dossiers: neu }, geaendert: [] } : { ok: false, status: 400, fehler: 'nichts' };
  }, { art: 'system' });
  return { 'fulfillment-personen': karten, 'fulfillment-laufentwuerfe': entwuerfe, 'fulfillment-dossiers': dossiers };
}

/** Art. 15: berufliche Personenkarten, die die Person nennen (Kontakt-Kennung oder Name). */
export async function personenAuskunft(m: PersonMerkmale): Promise<PersonenAuskunft[]> {
  const { textNennt } = await import('@/lib/crm/person-weitere');
  const karten = (await fulfillmentLesen('personen')).karten;
  return karten.filter(k => k.kontaktId === m.id || (!!m.name && k.name.toLowerCase() === m.name.toLowerCase()) || textNennt(JSON.stringify({ name: k.name, kontaktId: k.kontaktId }), m)).map(k => ({
    mandatId: k.mandatId, funktion: k.funktion, name: k.name, erfasstAm: k.erfasstAm, ...(k.loeschAm ? { loeschAm: k.loeschAm } : {}), art14: k.art14,
    angaben: [...k.werdegang, ...k.themen, ...k.auftritte, ...k.aufhaenger].map(a => a.text),
    quellen: k.quellen.map(q => q.url ?? `Unterlage ${q.unterlageId}`),
  }));
}

/** Freigabe-Stapel, Präfix `a:` — heute nur `a:art14:<karte>`: Aufgabe „Art.-14-Hinweis geben“ (idempotent). Beanspruchen → anlegen → entscheiden. */
export const ANALYSE_STAPEL: StapelArtFreigabe = {
  freigeben: async (vIn, person) => {
    const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    if (!(await personImHaushaltDesInhabers(person))) return { ok: false, status: 403, fehler: 'Nur Personen im Haushalt des Inhabers geben Fulfillment-Vorschläge frei.' };
    const { beanspruche, entscheide, loslassen } = await import('@/lib/zoe/stapel');
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== 'fulfillment' || !/^a:art14:pp-[a-z0-9][a-z0-9-]{0,99}$/.test(v.bezug.id)) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person && v.person !== person) return { status: 403, fehler: 'Nur die Person, für die der Vorschlag vorbereitet wurde, gibt ihn frei.' };
      return null;
    });
    if (!a.ok) return { ok: false, status: a.status, fehler: a.fehler };
    try {
      const kid = a.v.bezug!.id.slice('a:art14:'.length);
      const roh = (await fulfillmentLesen('personen')).karten.find(k => k.id === kid);
      const karte = roh ? (await (await import('./personen-server')).mitKontaktArt14([roh]))[0] : undefined;
      if (!karte) { await loslassen(a.v.id); return { ok: false, status: 404, fehler: 'Die Personenkarte gibt es nicht mehr (gelöscht oder nach der Frist entfernt).' }; }
      const st = art14Stand(karte, (await import('@/lib/zeit')).localDay());
      let text = 'Der Art.-14-Hinweis ist schon vermerkt — nichts zu tun.';
      if (st.stufe !== 'gegeben') {
        const id = `ff-art14-${karte.id.slice(3, 40)}`;
        const [{ systemAufgabenAendern }, { WEG }, { ladeCrm }, { fallAufgabeOrt }] = await Promise.all([import('@/lib/aufgaben/system-schreiben'), import('@/lib/wege'), import('@/lib/crm/speicher'), import('../regeln')]);
        const jetzt = new Date().toISOString();
        const mandat = (await ladeCrm()).mandate.find(x => x.id === karte.mandatId);
        const ort = mandat ? fallAufgabeOrt(mandat) : null;
        let da = false;
        await systemAufgabenAendern(stand => {
          da = stand.tasks.some(t => t.id === id);
          if (da) return { neu: [], teile: [] };
          return {
            neu: [{
              id, title: ort ? ort.titel(`Art.-14-Hinweis geben: ${karte.funktion}`) : `Art.-14-Hinweis geben: ${karte.funktion}`.slice(0, 280), status: 'todo', priority: 'high', assignee: person, dueDate: st.faelligAm,
              description: 'Die berufliche Personenkarte im Dossier braucht den Hinweis nach Art. 14 DSGVO (spätestens beim ersten Kontakt bzw. binnen eines Monats). Text und Vermerk „gegeben am · wie“ unter Fall › Analyse › Personen.',
              notiz: `[Analyse öffnen](${WEG.dossier(karte.mandatId)})`, tags: ['fulfillment', 'datenschutz'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt,
              space: 'business', ...(ort?.spaceId ? { spaceId: ort.spaceId } : {}), bezug: ort?.bezug ?? { mandatId: karte.mandatId },
            }],
            teile: [],
          };
        }, { person, jetzt });
        text = da ? 'Die Aufgabe gibt es schon — nichts doppelt angelegt.' : 'Aufgabe „Art.-14-Hinweis geben“ angelegt (Business).';
      }
      await entscheide(a.v.id, 'freigegeben', { ergebnis: text, von: person, ausArbeit: true });
      return { ok: true, text };
    } catch (e) {
      await loslassen(a.v.id);
      throw e;
    }
  },
};
