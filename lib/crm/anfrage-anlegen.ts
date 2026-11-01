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
import { anzeigename, saeubereKontakt, serverStempel, bezuegeSynchron, normTelefon, type Kontakt } from '@/lib/make-one/crm';
import { datenschutzStempeln } from '@/lib/crm/datenschutz-stempel';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { anfrageBauen, anfrageSpur, kanalAusPruefen, type AnfrageEingabe, type AnfrageBau } from '@/lib/crm/anfragen';
import { istAnfragePruefen, ANFRAGE_UNBESTAETIGT_PRAEFIX } from '@/lib/crm/marketing';
import { sperrlisteLaden, neuanlageSperre, sperren, karteiHaushalt } from '@/lib/crm/sperrliste';
import { neueKennung } from '@/lib/kennung';
import { firmaSichern } from '@/lib/crm/person-anlegen-server';
import { alleAdressen } from '@/lib/crm/emails';
import { absichtAbschliessen, absichtBeginnen, absichtDatenSetzen, mitVorgang, type Absicht } from '@/lib/store/absichten';

type Bau = AnfrageBau;
/**
 * `schon` (02.11., Prüfung A): mit festen Kennungen (`ids`) war die Anfrage schon angelegt — nichts doppelt. `eingeschraenkt` (Fund 5): der Weg
 * lehnte ab, weil die Person eingeschränkt ist (Art. 18) — die Kennung, damit die öffentlichen Wege die Nachricht als Betroffenenantrag ablegen können.
 */
export type AnfrageAngelegt = { ok: true; bau: Bau; schon?: true } | { ok: false; fehler: string; eingeschraenkt?: { kontaktId: string; name: string } };
export interface AnfrageOptionen {
  person: string; wer: Wer;
  /** Öffentliche Strecke (Check): vorhandene Person → „Adresse unbestätigt“ (lib/crm/anfragen.ts `oeffentlich`). */
  oeffentlich?: boolean;
  /** Website-Anbau (31.10.): von welcher öffentlichen Seite — Stufe des Ereignisses „neuer Lead“ (`webseite-check` | `webseite-formular`). */
  webseite?: 'check' | 'formular';
  /** Feste Kennungen (02.11., Prüfung A): ein zweiter Aufruf mit denselben Kennungen legt nichts doppelt an (Website-Eingänge, Wiederholung). */
  ids?: { kontakt: string; followUp: string };
}

const kontakteLaden = async () => (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];

/** Die Schritte der Absicht „anfrage“ (Prüfung A, Fund 2) — jeder idempotent über die festen Kennungen und die Spur der Aktivität. */
export const ANFRAGE_SCHRITTE = ['firma', 'kartei', 'crm', 'ereignis'] as const;
interface AnfrageDaten {
  eingabe: AnfrageEingabe; person: string; wer: Wer; oeffentlich?: boolean; webseite?: 'check' | 'formular';
  ids: { kontakt: string; followUp: string }; jetzt: string; heute: string;
}
/** Was der CRM-Schritt aus dem Kartei-Schritt braucht (in der Absicht gemerkt — nicht noch einmal gerechnet). */
type BauKurz = Omit<Bau, 'kontakt'> & { kontaktId: string; firmaId?: string; eingeschraenkt?: true; werbesperre?: true };
const kurz = (b: Bau): BauKurz => {
  const { kontakt, ...rest } = b;
  return { ...rest, kontaktId: kontakt.id, ...(kontakt.firmaId ? { firmaId: kontakt.firmaId } : {}), ...(kontakt.eingeschraenkt ? { eingeschraenkt: true as const } : {}), ...(kontakt.werbesperre ? { werbesperre: true as const } : {}) };
};

/** Welche Person trifft die Eingabe (Kennung, alle Adressen, Nummer) — nur für die Rückmeldung „eingeschränkt“. Rein. */
function getroffen(e: AnfrageEingabe, kontakte: readonly Kontakt[]): Kontakt | undefined {
  if (e.kontaktId) return kontakte.find(k => k.id === e.kontaktId);
  const mail = String(e.neu?.email ?? '').trim().toLowerCase();
  if (mail.includes('@')) { const k = kontakte.find(x => alleAdressen(x).includes(mail)); if (k) return k; }
  const tel = normTelefon(String(e.neu?.telefon ?? '')).replace(/^\+/, '');
  return tel.length >= 6 ? kontakte.find(k => [k.telefon, k.sms].some(t => normTelefon(String(t ?? '')).replace(/^\+/, '') === tel)) : undefined;
}

/**
 * Legt eine Anfrage an (Person neu oder vorhanden). `person` = wer erfasst (Speichername — hält bei neuen Personen die
 * Beziehung und bekommt das Follow-up); `wer` = für das Änderungsprotokoll. Wirft nicht für Fachfehler — `{ ok: false }`.
 * Seit 02.11. (Prüfung A, Fund 2) als Absicht mit Schritten (Firma → Kartei → CRM → Ereignis): bricht der Vorgang zwischen Kartei und CRM ab, setzt
 * die Wiederaufnahme (Start, Takt, Durchsicht) ihn fort — es bleibt keine Anfrage ohne Follow-up.
 */
export async function anfrageAnlegen(eingabe: AnfrageEingabe, o: AnfrageOptionen): Promise<AnfrageAngelegt> {
  const { person } = o;
  const heute = localDay();
  const jetzt = new Date().toISOString();
  const ids = o.ids ?? { kontakt: neueKennung('c'), followUp: neueKennung('fu') };
  // Schon angelegt (feste Kennungen, zweiter Aufruf)? Dann nichts doppelt — die Antwort aus dem Bestand.
  if (o.ids) {
    const fu = ((await ladeCrm()).followups ?? []).find(f => f.id === ids.followUp);
    if (fu) {
      const k = (await kontakteLaden()).find(x => x.id === fu.kontaktId);
      if (k) return { ok: true, schon: true, bau: { kontakt: k, neuePerson: k.id === ids.kontakt, aktivitaetText: '', followUp: fu, ...(istAnfragePruefen(fu) ? { unbestaetigt: true as const } : {}) } };
    }
  }
  // Erst prüfen, dann wirken (Nahtstellen 09.10.): derselbe Bau als Probe auf dem jetzigen Stand — lehnt er ab (Art. 18, eingeschränkte Person,
  // mehrdeutige Nummer, fehlender Text …), entsteht auch keine Firma. Vorher legte die Route die Firma VOR der Prüfung an.
  const oeffentlich = o.oeffentlich === true ? { oeffentlich: true } : {};
  const kontakte0 = await kontakteLaden();
  const probe = anfrageBauen(eingabe, { kontakte: kontakte0, crm: await ladeCrm(), person, heute, jetzt, ids, ...oeffentlich });
  if (!probe.ok) {
    const k = getroffen(eingabe, kontakte0);
    return { ok: false, fehler: probe.fehler, ...(k?.eingeschraenkt ? { eingeschraenkt: { kontaktId: k.id, name: anzeigename(k) } } : {}) };
  }
  const daten: AnfrageDaten = { eingabe, person, wer: o.wer, ...(o.oeffentlich ? { oeffentlich: true } : {}), ...(o.webseite ? { webseite: o.webseite } : {}), ids, jetzt, heute };
  const h = await karteiHaushalt();
  const { absicht } = await absichtBeginnen(h, { art: 'anfrage', schluessel: ids.followUp, schritte: ANFRAGE_SCHRITTE, ...(person ? { person } : {}), daten: daten as unknown as Record<string, unknown> });
  return anfrageLauf(h, absicht);
}

/** Wiederaufnahme (lib/store/absichten-fortsetzen.ts): ab dem ersten nicht abgehakten Schritt. */
export async function anfrageFortsetzen(h: string, a: Absicht): Promise<void> { await anfrageLauf(h, a); }

async function anfrageLauf(h: string, a: Absicht): Promise<AnfrageAngelegt> {
  const d = a.daten as unknown as AnfrageDaten;
  const { eingabe, person, ids, jetzt, heute } = d;
  const oeffentlich = d.oeffentlich ? { oeffentlich: true } : {};
  let fehler = '';
  const ende = await mitVorgang(h, a, async v => {
    // 1 · die Firma einer NEUEN Person über den EINEN Weg sichern (nicht, wenn die Mail/Nummer schon eine Person der Kartei trifft — die behält ihre Firma).
    await v.schritt('firma', async () => {
      const neuFirma = !eingabe.kontaktId && typeof eingabe.neu?.firma === 'string' ? eingabe.neu.firma.trim() : '';
      if (!neuFirma) return null;
      const probe = anfrageBauen(eingabe, { kontakte: await kontakteLaden(), crm: await ladeCrm(), person, heute, jetzt, ids, ...oeffentlich });
      // Steht die Person schon (Wiederaufnahme nach der Kartei)? Dann trägt sie ihre Firma schon.
      if (!probe.ok || !probe.bau.neuePerson) return null;
      const plan = await firmaSichern(neuFirma, { email: eingabe.neu?.email }, d.wer);
      return plan ? { id: plan.firma.id, name: plan.firma.name } : null;
    }, r => (r ? { firma: r } : {}));
    const gesichert = v.daten<{ id: string; name: string }>('firma');
    // 2 · Kartei: prüfen und schreiben in EINER Sperre auf dem frischen Stand (Prüfbericht 27.09., Punkt 10).
    await v.schritt('kartei', async () => {
      // Nur eine WIEDERAUFNAHME sucht die Spur eines abgebrochenen Laufs (der erste Versuch merkt sich, dass er schreiben wollte) — zwei echte Anfragen
      // derselben Person mit gleichem Text im selben Augenblick bleiben so zwei.
      const wiederholt = (a.daten as { karteiVersuch?: boolean }).karteiVersuch === true;
      if (!wiederholt) await absichtDatenSetzen(h, a.id, { karteiVersuch: true });
      const r = await karteiSchritt(d, gesichert, wiederholt);
      if (!r.ok) { fehler = r.fehler; return null; }
      return r.bau;
    }, b => (b ? { bau: kurz(b) } : {}));
    if (fehler) return null;
    const b = v.daten<BauKurz>('bau');
    if (!b) return null;
    // 3 · CRM-Bestand: Follow-up, Wirkung am Beitrag, Ergebnis an der Kampagne, Lead der Firma — jedes nur, wenn es noch fehlt.
    await v.schritt('crm', async () => {
      // Neue Person mit Werbesperre aus der Sperrliste: auch die Liste trägt sie (idempotent).
      if (b.neuePerson && b.werbesperre) { const k = (await kontakteLaden()).find(x => x.id === b.kontaktId); if (k) await sperren([k], 'werbesperre', heute); }
      await aendereCrm(c => {
        const da = (c.followups ?? []).some(f => f.id === b.followUp.id);
        const k = b.kampagne;
        return {
          ...c,
          ...(da ? {} : { followups: [...(c.followups ?? []), { ...b.followUp, geaendertVon: person }] }),
          ...(b.wirkung ? { beitraege: c.beitraege.map(x => (x.id === b.wirkung!.beitragId && !x.wirkung.some(w => w.kontaktId === b.kontaktId && w.art === 'anfrage') ? { ...x, wirkung: [...x.wirkung, b.wirkung!.eintrag], geaendert: jetzt, geaendertVon: person } : x)) } : {}),
          ...(k ? { kampagnen: c.kampagnen.map(x => (x.id === k.id && !x.ergebnisse.some(e => e.kontaktId === k.ergebnis.kontaktId && e.am === k.ergebnis.am && e.ergebnis === k.ergebnis.ergebnis) ? { ...x, kontaktIds: x.kontaktIds.includes(b.kontaktId) ? x.kontaktIds : [...x.kontaktIds, b.kontaktId], ergebnisse: [...x.ergebnisse, k.ergebnis], status: x.status === 'entwurf' ? 'aktiv' as const : x.status, geaendert: jetzt, geaendertVon: person } : x)) } : {}),
          ...(b.firmaLead ? { firmen: c.firmen.map(x => (x.id === b.firmaLead!.firmaId ? { ...x, lead: b.firmaLead!.lead, geaendert: jetzt, geaendertVon: person } : x)) } : {}),
        };
      });
      return true;
    });
    // 4 · Ereignis (09.10., E1): neuer Lead → Agenten (nur Kennungen), idempotent über die Kennung. Adresse unbestätigt (31.10.): kein „neuer Lead“.
    await v.schritt('ereignis', async () => {
      if (b.unbestaetigt) return 0;
      return import('@/lib/ereignisse/quellen').then(q => { const stufe = q.webseiteStufe(eingabe.kanal, d.webseite); return q.anfrageEreignis({ followUpId: b.followUp.id, kontaktId: b.kontaktId, ...(b.firmaId ? { firmaId: b.firmaId } : {}), ...(b.eingeschraenkt ? { eingeschraenkt: true } : {}), ...(stufe ? { stufe } : {}) }); }).catch(() => 0);
    });
    return b;
  });
  if (!ende) {
    await absichtAbschliessen(h, a.id, 'verworfen');
    return { ok: false, fehler: fehler || 'Anfrage nicht angelegt.' };
  }
  await absichtAbschliessen(h, a.id, 'fertig');
  const { kontaktId, firmaId: _f, eingeschraenkt: _e, werbesperre: _w, ...rest } = ende;
  const kontakt = (await kontakteLaden()).find(x => x.id === kontaktId);
  if (!kontakt) return { ok: false, fehler: 'Anfrage nicht angelegt.' };
  return { ok: true, bau: { ...rest, kontakt } };
}

/**
 * Der Kartei-Schritt: `anfrageBauen` auf dem frischen Stand in der Sperre — und nur schreiben, wenn die Spur dieser Anfrage noch fehlt. Hat ein
 * abgebrochener Lauf schon geschrieben (neue Person mit der festen Kennung bzw. die Aktivität mit genau diesem Zeitpunkt und Text), wird derselbe Bau
 * auf dem Stand OHNE diese Spur gerechnet — so kommt dasselbe heraus wie beim ersten Mal (eine eben angelegte Person gilt nicht plötzlich als „vorhanden“).
 */
async function karteiSchritt(d: AnfrageDaten, gesichert: { id: string; name: string } | undefined, wiederholt: boolean): Promise<{ ok: true; bau: Bau } | { ok: false; fehler: string }> {
  const { eingabe, person, ids, jetzt, heute } = d;
  const oeffentlich = d.oeffentlich ? { oeffentlich: true } : {};
  const crm = await ladeCrm();
  // Sperrliste (28.09., Ablaufprüfung): eine NEUE Person darauf bekommt die Werbesperre — nicht blockiert.
  const sperrEintraege = await sperrlisteLaden();
  const sperre = (k: Kontakt) => neuanlageSperre(k, sperrEintraege, heute);
  const spur = anfrageSpur(eingabe, heute, jetzt);
  const traegtSpur = (a: { am: string; text?: string }) => a.am === spur.am && spur.texte.includes(a.text ?? '');
  let bau: Bau | null = null; let fehler = '';
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const bauen = (kontakte: Kontakt[]) => anfrageBauen(eingabe, { kontakte, crm, person, heute, jetzt, ids, sperre, ...oeffentlich, ...(gesichert && crm.firmen.some(x => x.id === gesichert.id) ? { firma: gesichert } : {}) });
    // Spur nur an der Person, die DIESE Anfrage trifft: die eben angelegte (feste Kennung) bzw. die vorhandene mit genau dieser Aktivität.
    const schonNeu = wiederholt && f.kontakte.some(k => k.id === ids.kontakt);
    const ohneNeu = schonNeu ? f.kontakte.filter(k => k.id !== ids.kontakt) : f.kontakte;
    let r = bauen(ohneNeu);
    let schon = schonNeu;
    if (wiederholt && !schonNeu && r.ok) {
      const zielId = r.bau.kontakt.id;
      const ziel = f.kontakte.find(k => k.id === zielId);
      if (ziel?.aktivitaeten.some(traegtSpur)) {
        schon = true;
        r = bauen(f.kontakte.map(k => (k.id === ziel.id ? { ...k, aktivitaeten: k.aktivitaeten.filter(a => !traegtSpur(a)) } : k)));
      }
    }
    if (!r.ok) { fehler = r.fehler; return f; }
    const rb = r.bau;
    bau = rb;
    if (schon) return f;
    const i = f.kontakte.findIndex(x => x.id === rb.kontakt.id);
    if (i < 0) {
      // Eine NEUE Person durch dieselbe Kette wie „Person anlegen“ und Netzwerken (Nahtstellen 09.10.): säubern, Datenschutz-Stempel, Bezüge,
      // Server-Stempel (`vonHand` — was die Person selbst angab, überschreibt kein späterer Import still, „Online gewinnt“).
      const namen = (fid: string) => crm.firmen.find(x => x.id === fid)?.name;
      const sauber = saeubereKontakt(rb.kontakt) ?? rb.kontakt;
      const neu = serverStempel(bezuegeSynchron(datenschutzStempeln(sauber, undefined, person || 'system', jetzt, heute), undefined, heute, namen), undefined, heute);
      bau = { ...rb, kontakt: neu };
      return { ...f, kontakte: [...f.kontakte, neu] };
    }
    // Der Verlauf ist ein Anhänge-Log: was inzwischen dazukam, bleibt.
    const alt = f.kontakte[i];
    const neu = { ...rb.kontakt, aktivitaeten: [...alt.aktivitaeten.filter(a => !rb.kontakt.aktivitaeten.some(x => x.am === a.am && x.art === a.art && x.text === a.text)), ...rb.kontakt.aktivitaeten].sort((a, x) => a.am.localeCompare(x.am)) };
    return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? neu : x)) };
  }, d.wer);
  if (fehler || !bau) return { ok: false, fehler: fehler || 'Anfrage nicht angelegt.' };
  return { ok: true, bau };
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
  // Der volle Text steht im Vermerk an der Akte (bis 3.000 Zeichen) — die Notiz des Follow-ups trägt nur 1.000 (Prüfung A, Fund 13: nie still kürzen).
  const text = (await vermerkText(fu0.kontaktId, fu0.angelegt, kanal, fu0.notiz)) || fu0.notiz || 'Anfrage (Adresse geprüft und übernommen)';
  const r = await anfrageAnlegen({ kontaktId: fu0.kontaktId, kanal, text, datum: tagVon(fu0.angelegt) }, o);
  if (!r.ok) {
    await aendereCrm(c => ({ ...c, followups: (c.followups ?? []).map(x => { if (x.id !== followUpId || x.status !== 'erledigt') return x; const { erledigtAm: _e, ergebnis: _g, ...rest } = x; return { ...rest, status: 'offen' as const, geaendert: new Date().toISOString(), geaendertVon: o.person }; }) }), o.wer);
    return { ok: false, status: 400, fehler: r.fehler };
  }
  return r;
}

/** Der Text des Vermerks „Anfrage (Adresse unbestätigt) über <Kanal>: …“ an der Akte — derselbe Zeitpunkt wie das Prüf-Follow-up, sonst der jüngste. */
async function vermerkText(kontaktId: string, angelegt: string, kanal: AnfrageEingabe['kanal'], notiz?: string): Promise<string> {
  const { kanalInfo } = await import('@/lib/crm/anfragen');
  const vorsatz = `${ANFRAGE_UNBESTAETIGT_PRAEFIX}${kanalInfo(kanal)?.label ?? kanal}: `;
  const k = (await kontakteLaden()).find(x => x.id === kontaktId);
  // Nur Vermerke, die zur Notiz des Follow-ups passen (sie trägt den Anfang des Textes) — mehrere Anfragen derselben Person bleiben getrennt.
  const anfang = (notiz ?? '').slice(0, 200);
  const passend = (k?.aktivitaeten ?? []).filter(a => (a.text ?? '').startsWith(vorsatz) && (a.text ?? '').slice(vorsatz.length).startsWith(anfang));
  const a = passend.find(x => x.am === angelegt) ?? [...passend].sort((x, y) => y.am.localeCompare(x.am))[0];
  return a ? (a.text ?? '').slice(vorsatz.length).trim() : '';
}
