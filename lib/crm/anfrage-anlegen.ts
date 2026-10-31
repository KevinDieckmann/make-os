// ─── Markttraktion — eine Anfrage anlegen (Server, 24.10.) ──────────────────────────────────────────────────────
// Der EINE Schreibweg einer Anfrage (bisher im Körper von POST /api/crm/anfrage): erst als Probe bauen (Art. 18, eingeschränkte
// Person, mehrdeutige Nummer … → nichts entsteht, auch keine Firma), dann die Firma einer NEUEN Person sichern, Person +
// Aktivität + Einwilligung „Antwort auf Anfrage“ in EINER Kartei-Sperre, danach Follow-up, Beitrag/Kampagne/Lead im CRM und
// das Ereignis „neuer Lead“. Seit 24.10. nutzen ihn die Route (Inbox, Marketing › Anfragen) UND der Innovations-Check der
// Website (lib/check/crm.ts) — nie einen zweiten Anfrage-Weg bauen. Versendet wird nichts.

import { loadJson } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { localDay, tagVon } from '@/lib/zeit';
import { saeubereKontakt, serverStempel, bezuegeSynchron, type Kontakt } from '@/lib/make-one/crm';
import { datenschutzStempeln } from '@/lib/crm/datenschutz-stempel';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { anfrageBauen, kanalAusPruefen, type AnfrageEingabe } from '@/lib/crm/anfragen';
import { istAnfragePruefen } from '@/lib/crm/marketing';
import { sperrlisteLaden, neuanlageSperre, sperren } from '@/lib/crm/sperrliste';
import { neueKennung } from '@/lib/kennung';
import { firmaSichern } from '@/lib/crm/person-anlegen-server';

type Bau = Extract<ReturnType<typeof anfrageBauen>, { ok: true }>['bau'];
export type AnfrageAngelegt = { ok: true; bau: Bau } | { ok: false; fehler: string };

const kontakteLaden = async () => (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];

/**
 * Legt eine Anfrage an (Person neu oder vorhanden). `person` = wer erfasst (Speichername — hält bei neuen Personen die
 * Beziehung und bekommt das Follow-up); `wer` = für das Änderungsprotokoll. Wirft nicht für Fachfehler — `{ ok: false }`.
 */
export async function anfrageAnlegen(eingabe: AnfrageEingabe, o: { person: string; wer: Wer; /** Öffentliche Strecke (Check): vorhandene Person → „Adresse unbestätigt“ (lib/crm/anfragen.ts `oeffentlich`). */ oeffentlich?: boolean; /** Website-Anbau (31.10.): von welcher öffentlichen Seite — Stufe des Ereignisses „neuer Lead“ (`webseite-check` | `webseite-formular`). */ webseite?: 'check' | 'formular' }): Promise<AnfrageAngelegt> {
  const { person } = o;
  const heute = localDay();
  const jetzt = new Date().toISOString();
  const ids = { kontakt: neueKennung('c'), followUp: neueKennung('fu') };
  // Erst prüfen, dann wirken (Nahtstellen 09.10.): derselbe Bau als Probe auf dem jetzigen Stand — lehnt er ab (Art. 18, eingeschränkte Person,
  // mehrdeutige Nummer, fehlender Text …), entsteht auch keine Firma. Vorher legte die Route die Firma VOR der Prüfung an.
  const oeffentlich = o.oeffentlich === true ? { oeffentlich: true } : {};
  const probe = anfrageBauen(eingabe, { kontakte: await kontakteLaden(), crm: await ladeCrm(), person, heute, jetzt, ids, ...oeffentlich });
  if (!probe.ok) return { ok: false, fehler: probe.fehler };
  // 1.8: die Firma einer NEUEN Person über den EINEN Weg sichern (nicht, wenn die Mail/Nummer schon eine Person der Kartei trifft — die behält ihre Firma).
  const neuFirma = !eingabe.kontaktId && typeof eingabe.neu?.firma === 'string' ? eingabe.neu.firma.trim() : '';
  let gesichert: { id: string; name: string } | undefined;
  if (neuFirma && probe.bau.neuePerson) {
    // Die gefundene bzw. angelegte Firma geht an den Bau (Nahtstellen 09.10.) — nie ein zweites Suchen nur über den genauen Namen.
    const plan = await firmaSichern(neuFirma, { email: eingabe.neu?.email }, o.wer);
    if (plan) gesichert = { id: plan.firma.id, name: plan.firma.name };
  }
  const crm = await ladeCrm();
  // Sperrliste (28.09., Ablaufprüfung): eine NEUE Person darauf bekommt die Werbesperre — nicht blockiert.
  const sperrEintraege = await sperrlisteLaden();
  const sperre = (k: Kontakt) => neuanlageSperre(k, sperrEintraege, heute);
  // Prüfen und Schreiben in EINER Sperre auf dem frischen Stand (Prüfbericht 27.09., Punkt 10) — vorher wurde ein vorab
  // geladener Kontakt zurückgeschrieben, und was die andere Person inzwischen geändert hatte, ging verloren.
  let bau: Bau | null = null; let fehler = '';
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const r = anfrageBauen(eingabe, { kontakte: f.kontakte, crm, person, heute, jetzt, ids, sperre, ...oeffentlich, ...(gesichert && crm.firmen.some(x => x.id === gesichert!.id) ? { firma: gesichert } : {}) });
    if (!r.ok) { fehler = r.fehler; return f; }
    bau = r.bau;
    const i = f.kontakte.findIndex(x => x.id === r.bau.kontakt.id);
    if (i < 0) {
      // Eine NEUE Person durch dieselbe Kette wie „Person anlegen“ und Netzwerken (Nahtstellen 09.10.): säubern, Datenschutz-Stempel, Bezüge,
      // Server-Stempel (`vonHand` — was die Person selbst angab, überschreibt kein späterer Import still, „Online gewinnt“).
      const namen = (fid: string) => crm.firmen.find(x => x.id === fid)?.name;
      const sauber = saeubereKontakt(r.bau.kontakt) ?? r.bau.kontakt;
      const neu = serverStempel(bezuegeSynchron(datenschutzStempeln(sauber, undefined, person || 'system', jetzt, heute), undefined, heute, namen), undefined, heute);
      bau = { ...r.bau, kontakt: neu };
      return { ...f, kontakte: [...f.kontakte, neu] };
    }
    // Der Verlauf ist ein Anhänge-Log: was inzwischen dazukam, bleibt.
    const alt = f.kontakte[i];
    const neu = { ...r.bau.kontakt, aktivitaeten: [...alt.aktivitaeten.filter(a => !r.bau.kontakt.aktivitaeten.some(x => x.am === a.am && x.art === a.art && x.text === a.text)), ...r.bau.kontakt.aktivitaeten].sort((a, x) => a.am.localeCompare(x.am)) };
    return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? neu : x)) };
  }, o.wer);
  if (fehler || !bau) return { ok: false, fehler: fehler || 'Anfrage nicht angelegt.' };
  const fertig = bau as Bau;
  // Neue Person mit Werbesperre aus der Sperrliste: auch die Liste trägt sie (idempotent).
  if (fertig.neuePerson && fertig.kontakt.werbesperre) await sperren([fertig.kontakt], 'werbesperre', heute);
  // 2 · CRM-Bestand: Follow-up, Wirkung am Beitrag, Ergebnis an der Kampagne, Lead der Firma.
  await aendereCrm(c => ({
    ...c,
    followups: [...(c.followups ?? []), { ...fertig.followUp, geaendertVon: person }],
    ...(fertig.wirkung ? { beitraege: c.beitraege.map(x => (x.id === fertig.wirkung!.beitragId && !x.wirkung.some(w => w.kontaktId === fertig.kontakt.id && w.art === 'anfrage') ? { ...x, wirkung: [...x.wirkung, fertig.wirkung!.eintrag], geaendert: jetzt, geaendertVon: person } : x)) } : {}),
    ...(fertig.kampagne ? { kampagnen: c.kampagnen.map(x => (x.id === fertig.kampagne!.id ? { ...x, kontaktIds: fertig.kampagne!.kontaktIds, ergebnisse: [...x.ergebnisse, fertig.kampagne!.ergebnis], status: x.status === 'entwurf' ? 'aktiv' as const : x.status, geaendert: jetzt, geaendertVon: person } : x)) } : {}),
    ...(fertig.firmaLead ? { firmen: c.firmen.map(x => (x.id === fertig.firmaLead!.firmaId ? { ...x, lead: fertig.firmaLead!.lead, geaendert: jetzt, geaendertVon: person } : x)) } : {}),
  }));
  // Adresse unbestätigt (31.10.): kein „neuer Lead“ — sonst liefen Agenten und Prozesse für eine Anfrage an, die vielleicht gar nicht von der Person kam.
  if (fertig.unbestaetigt) return { ok: true, bau: fertig };
  // Ereignis (09.10., E1): neuer Lead → Agenten (nur Kennungen) — nach dem Speichern, wirft nie.
  await import('@/lib/ereignisse/quellen').then(q => { const stufe = q.webseiteStufe(eingabe.kanal, o.webseite); return q.anfrageEreignis({ followUpId: fertig.followUp.id, kontaktId: fertig.kontakt.id, ...(fertig.kontakt.firmaId ? { firmaId: fertig.kontakt.firmaId } : {}), ...(fertig.kontakt.eingeschraenkt ? { eingeschraenkt: true } : {}), ...(stufe ? { stufe } : {}) }); }).catch(() => 0);
  return { ok: true, bau: fertig };
}

/**
 * „Anfrage übernehmen“ (Kevin 31.10.) — von Hand, nachdem jemand eine Anfrage mit unbestätigter Adresse geprüft hat (Follow-up „Anfrage prüfen —
 * Adresse unbestätigt“). Schreibt über den EINEN Anfrage-Weg mit der GEWÄHLTEN Person (`kontaktId` — damit gilt sie als bestätigt): Aktivität
 * „Anfrage über …“, Einwilligung „Antwort auf Anfrage“, Stufe, Lead, Follow-up „Anfrage beantworten“, Ereignis. Das Prüf-Follow-up wird VORHER
 * beansprucht (erledigt) — ein zweiter Klick legt nichts doppelt an; scheitert die Anfrage, steht es wieder offen.
 * Anfragen aus dem Angebots-Formular übernimmt die Freigabe des Angebots (ein Klick „Senden“), nicht dieser Weg.
 */
export async function anfrageUebernehmen(followUpId: string, o: { person: string; wer: Wer }): Promise<AnfrageAngelegt | { ok: false; status: number; fehler: string }> {
  const fu0 = ((await ladeCrm()).followups ?? []).find(f => f.id === followUpId);
  if (!fu0 || !istAnfragePruefen(fu0) || !fu0.kontaktId) return { ok: false, status: 404, fehler: 'Diese Anfrage gibt es nicht (mehr).' };
  const kanal = kanalAusPruefen(fu0.text);
  if (!kanal) return { ok: false, status: 409, fehler: 'Diese Anfrage kam über das Angebots-Formular — sie wird mit der Freigabe des Angebots übernommen (Formulare › Eingänge bzw. Freigaben).' };
  const jetzt = new Date().toISOString();
  let beansprucht = false;
  await aendereCrm(c => {
    const f = (c.followups ?? []).find(x => x.id === followUpId);
    if (!f || f.status !== 'offen') return c;
    beansprucht = true;
    return { ...c, followups: (c.followups ?? []).map(x => (x.id === followUpId ? { ...x, status: 'erledigt' as const, erledigtAm: jetzt, ergebnis: 'Anfrage übernommen', geaendert: jetzt, geaendertVon: o.person } : x)) };
  }, o.wer);
  if (!beansprucht) return { ok: false, status: 409, fehler: 'Diese Anfrage ist schon übernommen oder abgesagt.' };
  const r = await anfrageAnlegen({ kontaktId: fu0.kontaktId, kanal, text: fu0.notiz || 'Anfrage (Adresse geprüft und übernommen)', datum: tagVon(fu0.angelegt) }, o);
  if (!r.ok) {
    await aendereCrm(c => ({ ...c, followups: (c.followups ?? []).map(x => { if (x.id !== followUpId || x.status !== 'erledigt') return x; const { erledigtAm: _e, ergebnis: _g, ...rest } = x; return { ...rest, status: 'offen' as const, geaendert: new Date().toISOString(), geaendertVon: o.person }; }) }), o.wer);
    return { ok: false, status: 400, fehler: r.fehler };
  }
  return r;
}
