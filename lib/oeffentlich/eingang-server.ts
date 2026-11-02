// ─── Website-Eingänge — festhalten, verarbeiten, nachholen, melden (nur Server, 02.11., Prüfung A „Eingänge und Datenbasis“) ────────────────
// Regeln und Form: lib/oeffentlich/eingang.ts. Hier:
//   · `eingangFesthalten` — VOR der Antwort an den Gast (Unterlage, Newsletter): eine Zeile im Bestand `website-eingang`; wirft bei Speicherfehler
//   · `eingangVerarbeiten` — nach der Antwort: beansprucht die Zeile (in der Sperre), arbeitet Schritt für Schritt (abgehakt an der Zeile), schließt ab
//   · `eingaengeImTakt` / `websiteEingaengeNachholen` — Takt (alle 15 Min.) bzw. Morgenlauf: offene Zeilen, Check-Leads ohne CRM, Bestellungen ohne
//     Vorbereitung, Newsletter-Bestätigungen, die nicht rausgingen, und verfallene Terminanfragen (lib/kalender/buchung-speicher.ts)
//   · `websiteHinweisMelden` — EINE neutrale Glocke an die Marketing-Verantwortliche (`verantwortlichePerson`, Rückfall Inhaber): ohne Namen, ohne Inhalte
//   · `eingeschraenktMelden` — Nachricht einer eingeschränkten Person (Art. 18): als Betroffenenantrag (Stammdaten › Datenschutz) + Glocke an den Inhaber;
//     die Person wird im CRM NICHT verarbeitet (keine Aktivität, kein Follow-up, kein Lead)
//   · `websiteEingangLage` — Zahlen für den Head of IT („Website-Eingänge ohne CRM“)

import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import {
  EINGANG_MAX, EINGANG_SPEICHER, EINGANG_VERSUCHE, eingangAufgabeId, eingangAufraeumen, eingangBrauchtHand, eingangFaellig, eingangZaehler, eingaengeOffen,
  type EingangArt, type EingangDaten, type EingangDatei, type EingangOffen, type WebsiteEingang,
} from './eingang';

/** Der Bestand ist voll (`EINGANG_MAX`) — die Route antwortet 503, nichts wird gekürzt. */
export class EingangVoll extends Error {}

const liste = (d: EingangDatei | null | undefined): WebsiteEingang[] => (Array.isArray(d?.eintraege) ? d!.eintraege : []);

/** Eine Eingangszeile festhalten — VOR der Antwort. Vergibt die festen Kennungen der Anfrage im CRM. Wirft (Speicher, voll). */
export async function eingangFesthalten(art: EingangArt, daten: EingangDaten, jetzt = new Date()): Promise<string> {
  const e: WebsiteEingang = { id: neueKennung('we'), art, am: jetzt.toISOString(), status: 'offen', versuche: 0, daten: { ...daten, ids: daten.ids ?? { kontakt: neueKennung('c'), followUp: neueKennung('fu') } } };
  let voll = false;
  await updateJson<EingangDatei>(EINGANG_SPEICHER, cur => {
    const l = eingangAufraeumen(liste(cur), jetzt.getTime());
    if (l.length >= EINGANG_MAX) { voll = true; return cur ?? { eintraege: [] }; }
    return { eintraege: [...l, e] };
  });
  if (voll) throw new EingangVoll('Website-Eingänge: Bestand voll');
  return e.id;
}

/** Eine Zeile in der Sperre ändern; `f` liefert null = nichts ändern. */
async function zeileAendern(id: string, f: (e: WebsiteEingang) => WebsiteEingang | null): Promise<WebsiteEingang | null> {
  let raus: WebsiteEingang | null = null;
  await updateJson<EingangDatei>(EINGANG_SPEICHER, cur => {
    const l = liste(cur);
    const i = l.findIndex(x => x.id === id);
    if (i < 0) return cur ?? { eintraege: [] };
    const n = f(l[i]);
    if (!n) return cur!;
    raus = n;
    return { eintraege: l.map((x, j) => (j === i ? n : x)) };
  });
  return raus;
}

/**
 * Eine Zeile verarbeiten (nach der Antwort, im Takt, im Morgenlauf). Beansprucht sie in der Sperre (läuft schon → nichts), arbeitet die Schritte ab
 * (abgehakt an der Zeile) und schließt ab: fertig (Daten geleert) bzw. Fehlversuch (gezählt, ab dem ersten Fehlversuch EINE neutrale Glocke). Wirft nie.
 */
export async function eingangVerarbeiten(id: string, jetzt = new Date(), opt: { sofort?: boolean } = {}): Promise<WebsiteEingang['status'] | null> {
  const am = jetzt.toISOString();
  const e = await zeileAendern(id, x => (eingangFaellig(x, jetzt.getTime(), opt.sofort !== false) ? { ...x, status: 'laeuft', seit: am } : null)).catch(() => null);
  if (!e?.daten) return null;
  const merke = async (name: string, wert: string) => { await zeileAendern(id, x => ({ ...x, schritte: { ...(x.schritte ?? {}), [name]: wert } })); };
  const schritte = { ...(e.schritte ?? {}) };
  const f = { erledigt: schritte, ids: e.daten.ids, merke: async (n: string, w: string) => { schritte[n] = w; await merke(n, w); } };
  try {
    if (e.art === 'unterlage') {
      const { unterlageVon, anforderungVerarbeiten } = await import('@/lib/unterlagen/server');
      const u = await unterlageVon(e.daten.unterlageId);
      if (!u) throw new Error('Unterlage nicht (mehr) im Katalog');
      const { websiteLage } = await import('./website-post');
      await anforderungVerarbeiten({ email: e.daten.email, vorname: e.daten.vorname, firma: e.daten.firma ?? '', newsletter: !!e.daten.newsletter }, u, await websiteLage(), jetzt, f);
    } else {
      const { newsletterBereit, anmeldungVerarbeiten } = await import('@/lib/newsletter/server');
      const nl = await newsletterBereit();
      // Inzwischen ausgeschaltet: es geht nichts hinaus (die Zeile ist trotzdem erledigt — die Anmeldung gibt es so nicht mehr).
      const r = nl ? await anmeldungVerarbeiten({ email: e.daten.email, vorname: e.daten.vorname }, nl, jetzt) : 'aus';
      if (r === 'versandFehler') throw new Error('Bestätigungsmail nicht verschickt');
      await f.merke('newsletter', r);
    }
    await zeileAendern(id, x => { const { daten: _d, grund: _g, ...rest } = x; return { ...rest, status: 'fertig', fertigAm: new Date().toISOString() }; });
    // R2-4 Fund 3/12: gelingt es (Takt, „noch einmal versuchen“), schließt die Aufgabe, und die frühere Glocke wird zurückgenommen, wenn nichts mehr offen ist.
    await nachAbschluss(jetzt).catch(() => null);
    return 'fertig';
  } catch (x) {
    const grund = `${x instanceof Error ? x.name : 'Fehler'}: ${(x instanceof Error ? x.message : String(x)).split('\n')[0]}`.slice(0, 160);
    console.warn(`[website-eingang] ${e.art}: ${grund}`);
    await zeileAendern(id, y => ({ ...y, status: 'fehler', versuche: y.versuche + 1, seit: new Date().toISOString(), grund })).catch(() => null);
    await websiteHinweisMelden(e.art === 'unterlage' ? 'unterlage' : 'eingang').catch(() => null);
    return 'fehler';
  }
}

// ── Von Hand entscheiden (R2-4 Fund 3: Marketing › Anfragen) ─────────────────────────────────────────────────────────────────────

/** Offene bzw. gescheiterte Zeilen für Marketing › Anfragen (Haushalt, Business-Sicht — wie die übrigen Anfragen). */
export async function websiteEingaengeOffen(jetzt = new Date()): Promise<EingangOffen[]> {
  return eingaengeOffen(liste(await loadJson<EingangDatei>(EINGANG_SPEICHER)), jetzt.getTime());
}

export class EingangUnbekannt extends Error {}

/** „Noch einmal versuchen“: die Versuche zurück auf null, sofort verarbeiten. Liefert den neuen Stand. Unbekannt/schon fertig → EingangUnbekannt. */
export async function eingangErneut(id: string, jetzt = new Date()): Promise<WebsiteEingang['status'] | null> {
  const z = await zeileAendern(id, x => (x.status === 'fertig' || x.status === 'laeuft' || !x.daten ? null : { ...x, status: 'offen', versuche: 0, seit: undefined }));
  if (!z) throw new EingangUnbekannt('Diesen Eingang gibt es nicht (mehr) oder er läuft gerade.');
  return eingangVerarbeiten(id, jetzt, { sofort: true });
}

/**
 * „Als Anfrage von Hand übernehmen“: über den EINEN Anfrage-Weg (`anfrageAnlegen`, Kanal Website, feste Kennungen der Zeile — nichts doppelt), ohne
 * automatische Mail; die Zeile wird fertig (Daten geleert, Schritt `hand`). Die Person ruft dann selbst an bzw. schreibt aus dem eigenen Postfach.
 */
export async function eingangUebernehmen(id: string, person: string, wer: import('@/lib/store/aenderungsprotokoll').Wer, jetzt = new Date()): Promise<{ kontaktId?: string; fehler?: string }> {
  const z = liste(await loadJson<EingangDatei>(EINGANG_SPEICHER)).find(x => x.id === id);
  if (!z || z.status === 'fertig' || z.status === 'laeuft' || !z.daten) throw new EingangUnbekannt('Diesen Eingang gibt es nicht (mehr) oder er läuft gerade.');
  const d = z.daten;
  const text = z.art === 'unterlage'
    ? 'Vorlage über die Website angefordert — der automatische Versand kam nicht zustande, von Hand übernommen (bitte die Unterlage selbst schicken).'
    : 'Newsletter-Anmeldung über die Website — die Bestätigungsmail ging nicht raus, von Hand übernommen (ohne Double-Opt-in keine Newsletter-Einwilligung).';
  const { anfrageAnlegen } = await import('@/lib/crm/anfrage-anlegen');
  const r = await anfrageAnlegen({ neu: { vorname: d.vorname, email: d.email, ...(d.firma ? { firma: d.firma } : {}) }, kanal: 'website', text }, { person, wer, oeffentlich: true, ...(d.ids ? { ids: d.ids } : {}) });
  if (!r.ok) {
    if (r.eingeschraenkt) await eingeschraenktMelden({ ...r.eingeschraenkt, email: d.email, weg: z.art === 'unterlage' ? 'Unterlage' : 'Newsletter', text, ...(d.ids ? { schluessel: d.ids.followUp } : {}) });
    else return { fehler: r.fehler };
  }
  await zeileAendern(id, x => { const { daten: _d, grund: _g, ...rest } = x; return { ...rest, status: 'fertig', fertigAm: jetzt.toISOString(), schritte: { ...(x.schritte ?? {}), hand: r.ok ? 'anfrage' : 'eingeschraenkt' } }; });
  await nachAbschluss(jetzt).catch(() => null);
  return r.ok ? { kontaktId: r.bau.kontakt.id } : {};
}

/** „Verwerfen“ (Spam, doppelt): die Zeile wird fertig, die Daten sofort geleert. */
export async function eingangVerwerfen(id: string, jetzt = new Date()): Promise<void> {
  const z = await zeileAendern(id, x => { if (x.status === 'fertig' || x.status === 'laeuft') return null; const { daten: _d, grund: _g, ...rest } = x; return { ...rest, status: 'fertig', fertigAm: jetzt.toISOString(), schritte: { ...(x.schritte ?? {}), hand: 'verworfen' } }; });
  if (!z) throw new EingangUnbekannt('Diesen Eingang gibt es nicht (mehr) oder er läuft gerade.');
  await nachAbschluss(jetzt).catch(() => null);
}

const AUFGABE_TITEL: Record<EingangArt, string> = {
  unterlage: 'Website-Eingang prüfen: eine angeforderte Unterlage ging nicht raus',
  newsletter: 'Website-Eingang prüfen: eine Newsletter-Anmeldung kam nicht durch',
};

/**
 * Aufgaben zu den Zeilen nachziehen (R2-4 Fund 3): jede Zeile, die einen Menschen braucht (`eingangBrauchtHand`), bekommt EINE feste Aufgabe
 * (`we-…`) bei der Marketing-Verantwortlichen (Rückfall Inhaber) — ohne Namen, ohne Adresse; jede erledigte bzw. verschwundene Zeile schließt ihre offene
 * Aufgabe. Idempotent (gibt es die Aufgabe schon — auch erledigt/im Papierkorb —, entsteht keine zweite). Wirft nie.
 */
export async function eingangAufgabenNachziehen(jetzt = new Date()): Promise<{ neu: number; geschlossen: number }> {
  const z = { neu: 0, geschlossen: 0 };
  try {
    const l = liste(await loadJson<EingangDatei>(EINGANG_SPEICHER));
    const brauchen = l.filter(e => eingangBrauchtHand(e, jetzt.getTime()));
    const nachId = new Map(l.map(e => [eingangAufgabeId(e.id), e]));
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    const { verantwortlichePerson } = await import('@/lib/crm/verantwortung-server');
    const an = brauchen.length ? await verantwortlichePerson('marketing') : null;
    const iso = jetzt.toISOString(), heute = localDay(jetzt);
    await systemAufgabenAendern(stand => {
      const da = new Set(stand.tasks.map(t => t.id));
      const neu = brauchen.filter(e => !da.has(eingangAufgabeId(e.id))).map(e => ({
        id: eingangAufgabeId(e.id), title: AUFGABE_TITEL[e.art], status: 'todo', priority: 'high', assignee: an ?? 'both', dueDate: heute, space: 'business',
        description: 'Ein Eingang über die Website ist nicht vollständig im CRM bzw. nicht verschickt. Unter Marketing › Anfragen entscheiden: noch einmal versuchen, als Anfrage von Hand übernehmen oder verwerfen. Er wird nicht still gelöscht.',
        notiz: `[Marketing › Anfragen](${WEG.marketing('anfragen')})`, tags: ['website'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: iso, updatedAt: iso,
      }));
      // Geschlossen: die Zeile ist fertig (bzw. weg) und die Aufgabe noch offen.
      const teile = stand.tasks.filter(t => t.id.startsWith('we-') && t.status !== 'done' && t.status !== 'cancelled' && !t.geloeschtAm)
        .filter(t => { const e = nachId.get(t.id); return !e || e.status === 'fertig'; })
        .map(t => ({ id: t.id, felder: { status: 'done' as const } }));
      z.neu = neu.length; z.geschlossen = teile.length;
      return { neu: neu as never, teile };
    }, { jetzt: iso });
  } catch (e) { console.warn('[website-eingang] Aufgaben:', e instanceof Error ? e.message.slice(0, 120) : 'Fehler'); }
  return z;
}

/** Nach einem Abschluss: Aufgaben schließen; ist zu einem Anlass nichts mehr offen, die frühere Glocke zurücknehmen (R2-4 Fund 12). */
async function nachAbschluss(jetzt: Date): Promise<void> {
  await eingangAufgabenNachziehen(jetzt);
  await hinweiseAbgleichen(jetzt);
}

/** Glocken „kam nicht an“ zurücknehmen, sobald zu ihrem Anlass nichts mehr offen ist (Zeilen; für „eingang“ auch Check-Leads/Bestellungen ohne CRM). */
async function hinweiseAbgleichen(jetzt: Date): Promise<void> {
  try {
    const l = liste(await loadJson<EingangDatei>(EINGANG_SPEICHER)).filter(e => e.status !== 'fertig');
    const { verantwortlichePerson } = await import('@/lib/crm/verantwortung-server');
    const an = await verantwortlichePerson('marketing');
    if (!an) return;
    const { meldungZuruecknehmen } = await import('@/lib/meldungen/speicher');
    if (!l.some(e => e.art === 'unterlage')) await meldungZuruecknehmen(an, { art: 'prozess', id: 'website-eingang-unterlage' });
    if (!l.some(e => e.art !== 'unterlage') && (await websiteEingangLage(jetzt)).ohneCrm === 0) await meldungZuruecknehmen(an, { art: 'prozess', id: 'website-eingang-eingang' });
  } catch { /* Glocke ist nie kritisch */ }
}

// ── Melden ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const HINWEIS: Record<'eingang' | 'unterlage', string> = {
  eingang: 'Ein Website-Eingang kam nicht vollständig im CRM an — bitte unter Marketing › Anfragen prüfen',
  unterlage: 'Eine angeforderte Unterlage wurde nicht verschickt — bitte unter Marketing › Anfragen prüfen',
};

/**
 * EINE neutrale Glocke an die Marketing-Verantwortliche (Rückfall: Inhaber) — eine ungelesene je Anlass (Bezug `prozess`, „neuere ersetzt“), ohne Namen,
 * Adressen oder Inhalte (geht so auch an Telegram). Wirft nie.
 */
export async function websiteHinweisMelden(anlass: 'eingang' | 'unterlage'): Promise<void> {
  try {
    const { verantwortlichePerson } = await import('@/lib/crm/verantwortung-server');
    const an = await verantwortlichePerson('marketing');
    if (!an) return;
    const { melde } = await import('@/lib/meldungen/melden');
    await melde({ an, art: 'prozess', titel: HINWEIS[anlass], link: WEG.marketing('anfragen'), bezug: { art: 'prozess', id: `website-eingang-${anlass}` } });
  } catch { /* melden ist nie kritisch */ }
}

/**
 * Nachricht einer eingeschränkten Person (Art. 18) über einen öffentlichen Weg: als Betroffenenantrag ablegen (Stammdaten › Datenschutz, Monatsfrist —
 * die Nachricht kann ein Antrag sein) und dem Inhaber neutral melden. Keine Verarbeitung der Person im CRM. Idempotent über `schluessel` (Kennung
 * des Eingangs, der Sitzung …). Wirft nie.
 */
export async function eingeschraenktMelden(x: { kontaktId: string; name: string; email?: string; weg: string; text: string; schluessel?: string }): Promise<void> {
  try {
    const { aendereCrm, saeubern } = await import('@/lib/crm/speicher');
    const jetzt = new Date().toISOString(), heute = localDay();
    const id = x.schluessel ? `an-${x.schluessel.replace(/[^a-z0-9-]/g, '').slice(-56)}` : neueKennung('an');
    let neu = false;
    await aendereCrm(c => {
      if ((c.antraege ?? []).some(a => a.id === id)) return c;
      const a = saeubern('antraege', { id, art: 'einschraenkung', name: x.name || 'Unbekannt', ...(x.email ? { email: x.email } : {}), kontaktId: x.kontaktId, eingang: heute, status: 'offen', von: 'system',
        nachricht: `Über ${x.weg} (Website): ${x.text}`.slice(0, 3000) }, jetzt, 'system');
      if (!a) return c;
      neu = true;
      return { ...c, antraege: [...(c.antraege ?? []), a as unknown as (typeof c.antraege)[number]] };
    }, { art: 'system' });
    if (!neu) return;
    const [{ inhaberSpeicher }, { melde }] = await Promise.all([import('@/lib/zugang/haushalt-inhaber'), import('@/lib/meldungen/melden')]);
    const an = await inhaberSpeicher();
    if (an) await melde({ an, art: 'sicherheit', titel: 'Nachricht einer eingeschränkten Person — unter Datenschutz prüfen', link: WEG.stammdaten('datenschutz') });
  } catch (e) { console.warn('[website-eingang] Art. 18:', e instanceof Error ? e.message.slice(0, 120) : 'Fehler'); }
}

// ── Nachholen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Offene bzw. gescheiterte Eingangszeilen nachholen (fällig nach `eingangFaellig`). Liefert: verarbeitet, weiter offen. */
async function zeilenNachholen(jetzt: Date): Promise<{ fertig: number; offen: number }> {
  const l = liste(await loadJson<EingangDatei>(EINGANG_SPEICHER).catch(() => null));
  let fertig = 0, offen = 0;
  for (const e of l.filter(x => eingangFaellig(x, jetzt.getTime()))) {
    const r = await eingangVerarbeiten(e.id, jetzt, { sofort: false });
    if (r === 'fertig') fertig++; else if (r) offen++;
  }
  // Fristen (fertig nach 7 Tagen; offene/gescheiterte NIE still — R2-4 Fund 3) — schreibt nur, wenn etwas wegfällt.
  await updateJson<EingangDatei>(EINGANG_SPEICHER, cur => { const a = liste(cur), b = eingangAufraeumen(a, jetzt.getTime()); return b.length === a.length ? (cur ?? { eintraege: [] }) : { eintraege: b }; }).catch(() => null);
  // Was einen Menschen braucht, bekommt eine feste Aufgabe (und Erledigtes schließt sie); eine überholte Glocke wird zurückgenommen.
  await nachAbschluss(jetzt).catch(() => null);
  return { fertig, offen };
}

/** Newsletter-Bestätigungen, die nicht rausgingen (`versandFehler`, höchstens 7 Tage alt, unbestätigt, nicht gesperrt), noch einmal schicken. */
async function newsletterNachholen(jetzt: Date): Promise<{ fertig: number; offen: number }> {
  const { newsletterBereit, anmeldungVerarbeiten } = await import('@/lib/newsletter/server');
  const { ladeAnmeldungen } = await import('@/lib/newsletter/speicher');
  const nl = await newsletterBereit().catch(() => null);
  if (!nl) return { fertig: 0, offen: 0 };
  const grenze = jetzt.getTime() - 7 * 86_400_000;
  const l = (await ladeAnmeldungen().catch(() => null))?.anmeldungen ?? [];
  let fertig = 0, offen = 0;
  for (const a of l.filter(x => x.versandFehler && !x.bestaetigt && !x.gesperrt && Date.parse(x.angemeldet) >= grenze && x.mails?.tag !== localDay(jetzt))) {
    const r = await anmeldungVerarbeiten({ email: a.email, vorname: a.vorname ?? '' }, nl, jetzt).catch(() => 'versandFehler' as const);
    if (r === 'versandFehler') offen++; else fertig++;
  }
  return { fertig, offen };
}

export interface NachholErgebnis { nachgeholt: number; offen: number; verfallen: number }

/**
 * Morgenlauf (Prüfung A, Fund 1/3/7): alles, was von der Website kam und nicht ankam, noch einmal — idempotent (feste Kennungen, abgehakte Schritte).
 * Bleibt danach etwas offen, EINE neutrale Glocke. Wirft nie.
 */
export async function websiteEingaengeNachholen(jetzt = new Date()): Promise<NachholErgebnis> {
  const sicher = async <T extends { nachgeholt?: number; fertig?: number; offen: number }>(p: () => Promise<T>) => { try { return await p(); } catch { return null; } };
  const z = await sicher(() => zeilenNachholen(jetzt));
  const c = await sicher(async () => (await import('@/lib/check/server')).checkLeadsNachholen(jetzt));
  const b = await sicher(async () => (await import('@/lib/bausteine/server')).bestellungenNachholen(jetzt));
  const n = await sicher(() => newsletterNachholen(jetzt));
  const verfallen = await (async () => { try { return await (await import('@/lib/kalender/buchung-speicher')).buchungenVerfallenMelden(jetzt); } catch { return 0; } })();
  const nachgeholt = (z?.fertig ?? 0) + (c?.nachgeholt ?? 0) + (b?.nachgeholt ?? 0) + (n?.fertig ?? 0);
  const offen = (z?.offen ?? 0) + (c?.offen ?? 0) + (b?.offen ?? 0) + (n?.offen ?? 0);
  if ((c?.offen ?? 0) + (b?.offen ?? 0) > 0) await websiteHinweisMelden('eingang');
  return { nachgeholt, offen, verfallen };
}

const G = globalThis as unknown as { __makeosEingangTakt?: number };
/** Takt (alle 15 Minuten): offene Eingangszeilen und verfallene Terminanfragen. Leicht — liest zwei Bestände. Wirft nie. */
export async function eingaengeImTakt(jetzt = new Date()): Promise<void> {
  if (G.__makeosEingangTakt && jetzt.getTime() - G.__makeosEingangTakt < 15 * 60_000) return;
  G.__makeosEingangTakt = jetzt.getTime();
  try { await zeilenNachholen(jetzt); } catch { /* nächster Takt */ }
  try { await (await import('@/lib/kalender/buchung-speicher')).buchungenVerfallenMelden(jetzt); } catch { /* nächster Takt */ }
}

// ── Head of IT ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface WebsiteEingangLage { ohneCrm: number; wartend: number; gescheitert: number }

/** „Website-Eingänge ohne CRM“ — nur Zahlen: Check-Leads ohne CRM, Bestellungen ohne Kontakt, Eingangszeilen (wartend, gescheitert). Wirft nie. */
export async function websiteEingangLage(jetzt = new Date()): Promise<WebsiteEingangLage> {
  const raus: WebsiteEingangLage = { ohneCrm: 0, wartend: 0, gescheitert: 0 };
  try { const z = eingangZaehler(liste(await loadJson<EingangDatei>(EINGANG_SPEICHER)), jetzt.getTime()); raus.wartend = z.wartend; raus.gescheitert = z.gescheitert; } catch { /* Lage ist Anzeige */ }
  try {
    const { ladeCheckBestand } = await import('@/lib/check/speicher');
    const { checkLeadFehlt } = await import('@/lib/check/server');
    const alt = jetzt.getTime() - 10 * 60_000;
    raus.ohneCrm += (await ladeCheckBestand()).sitzungen.filter(s => checkLeadFehlt(s, alt)).length;
  } catch { /* Lage ist Anzeige */ }
  try { raus.ohneCrm += await (await import('@/lib/bausteine/server')).bestellungenOhneCrm(jetzt); } catch { /* Lage ist Anzeige */ }
  return raus;
}

export { EINGANG_VERSUCHE };
