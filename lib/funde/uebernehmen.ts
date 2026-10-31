// ─── Funde — Vorschlag im Stapel, Übernahme in die Markttraktion und Versand (nur Server) ───────────────────────────────────
// Freigabe = EIN Klick im ZOE-Stapel (Art `fund`, nur aus der Sitzung einer Person im Haushalt):
//   1 · Kontakt + Firma über den EINEN Anlege-Weg (`personAnlegen`, Weg „prospecting“: Herkunft Recherche, Art. 6 Abs. 1 lit. f, Art.-14-Uhr,
//       Dublette 409, Sperrliste → Werbesperre), Label `homepage-funnel` (Segment), Person in die Kampagne, Lead der Firma.
//   2 · Öffentlicher Vorschau-Link (Token `v1-…`, nur der Fingerabdruck im Bestand, 60 Tage).
//   3 · Mail NUR wenn ein Inhaber „eigenes Risiko“ eingeschaltet hat, ein Absender-Postfach gewählt ist, die Adresse bekannt und nicht gesperrt
//       ist und die Freigabe aus der Sitzung kommt — gesendet über den vorhandenen Weg der Inbox (`inboxSenden`, Absender = Postfach, Spiegel,
//       Abmeldelink). `uwgBestaetigt: true` setzt NUR dieser Weg und nur mit eingeschaltetem Risiko (die Kanal-Ampel bleibt rot, RISIKO_HINWEIS).
//   4 · Follow-up „Anrufen“ nach 72 h (Kevin 30.10.) — bzw. „Kontakt aufnehmen“ heute, wenn keine Mail ging.
// Jeder Schritt ist wiederholbar (feste Kennungen am Fund: kontaktId, Vorschau-Token, `gesendet`) — ein Abbruch sendet nie doppelt.

import { randomBytes } from 'node:crypto';
import { localDay } from '@/lib/zeit';
import { neueKontaktKennung } from '@/lib/kennung';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { aendereCrm } from '@/lib/crm/speicher';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { neuesFollowUp } from '@/lib/crm/followup';
import { leereKriterien } from '@/lib/crm/leads';
import { abmeldeLink, instanzAdresse } from '@/lib/datenschutz/abmelden';
import { adresseMaskiert } from '@/lib/zugang/konten';
import type { Kontakt } from '@/lib/make-one/crm';
import type { StapelArtFreigabe, ArtErgebnis } from '@/lib/zoe/stapel-arten';
import { aendereFunde, fundeHaushalt, ladeFunde, vorschauTokenHash, FundeFehler } from './speicher';
import { linksEinsetzen } from './entwurf';
import { FUND_BRANCHEN, ANRUF_NACH_TAGEN, SEGMENT_LABEL, VORSCHAU_TAGE, type Fund } from './typen';

export const FUND_WERKZEUG = 'fund_uebernehmen';
const tagPlus = (tag: string, n: number) => new Date(Date.parse(`${tag}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Einen vorbereiteten Fund in den Stapel legen (neutraler Titel — Name und Gründe zeigt der Stapel aus dem Fund, nie im Prompt). */
export async function fundVorschlagLegen(f: Fund, person: string | null): Promise<void> {
  const { lege } = await import('@/lib/zoe/stapel');
  const branche = FUND_BRANCHEN.find(b => b.id === f.branche)?.name ?? 'Betrieb';
  const v = await lege({
    werkzeug: FUND_WERKZEUG, gruppe: 'markttraktion', titel: `Homepage-Fund (${branche}) übernehmen`,
    nachher: f.email ? 'In die Markttraktion übernehmen, Vorschau freischalten, Mail-Entwurf senden (nur mit „eigenem Risiko“), Anruf nach 72 h.' : 'In die Markttraktion übernehmen, Vorschau freischalten, Kontakt aufnehmen (keine Mail-Adresse bekannt).',
    anlass: `Website-Bedarf ${f.bewertung?.punkte ?? '–'} von 100 (Abendlauf Homepage-Funde).`,
    eingabe: { fund: f.id, space: 'business' }, ...(person ? { person: person as never } : {}), quelle: 'lauf', bezug: { art: 'fund', id: f.id }, einmalig: `fund-${f.id}`,
  });
  await aendereFunde(b => ({ ...b, funde: b.funde.map(x => (x.id === f.id ? { ...x, vorschlagId: v.id } : x)) }));
}

/** Absender-Postfach prüfen (dieselbe Regel wie das Formular „Angebot anfordern“). */
async function absenderOk(a: { person: string; postfach: string } | undefined) {
  const { absenderPruefen } = await import('@/lib/crm/angebot-versand');
  return absenderPruefen(a ? { ...a, gesetztAm: '' } : undefined);
}

export type UebernahmeErgebnis = { ok: true; text: string; gesendet: boolean; fund: Fund } | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };

/** Übernehmen (+ ggf. senden). `sitzung` = die Person hat selbst geklickt (nie Dienstweg/ZOE). */
export async function fundUebernehmen(fundId: string, person: string, o: { sitzung: boolean }): Promise<UebernahmeErgebnis> {
  const h = await fundeHaushalt();
  const wer: Wer = { art: 'person', person };
  const jetzt = new Date().toISOString(), heute = localDay();
  let b = await ladeFunde(h);
  let f = b.funde.find(x => x.id === fundId);
  if (!f) return { ok: false, status: 404, fehler: 'Diesen Fund gibt es nicht (mehr).' };
  if (f.status === 'verworfen' || f.status === 'gesperrt') return { ok: false, status: 409, fehler: 'Dieser Fund ist verworfen bzw. gesperrt — nichts übernommen.' };

  // 1 · Kontakt + Firma (feste Kennung am Fund zuerst — eine Wiederholung legt nichts doppelt an).
  if (!f.kontaktId) {
    const kid = neueKontaktKennung();
    b = await aendereFunde(x => ({ ...x, funde: x.funde.map(y => (y.id === fundId ? { ...y, kontaktId: kid, geaendert: jetzt } : y)) }), { h });
    f = b.funde.find(x => x.id === fundId) as Fund;
  }
  const kontaktId = f.kontaktId as string;
  const { personAnlegen } = await import('@/lib/crm/person-anlegen-server');
  const branche = FUND_BRANCHEN.find(x => x.id === f!.branche)?.name;
  // Inhaber als Person (aus dem Impressum) → Name des Kontakts; ohne Person bleibt der Kontakt der Betrieb (Anzeige = Firmenname).
  const teile = f.inhaber && f.inhaberArt === 'person' ? f.inhaber.split(' ') : [];
  const r = await personAnlegen({
    ...(teile.length >= 2 ? { vorname: teile.slice(0, -1).join(' '), nachname: teile[teile.length - 1] } : teile.length === 1 ? { nachname: teile[0] } : {}),
    firma: f.name, ...(f.email ? { email: f.email } : {}), ...(f.telefon ? { telefon: f.telefon } : {}), ...(f.website ? { webseite: f.website } : {}),
    herkunft: 'recherche', anlass: 'Homepage-Fund übernommen (Kampagne)', quelleText: f.quelle === 'osm' ? 'Recherche (OpenStreetMap)' : 'Recherche (von Hand)',
    firmaZusatz: { ...(branche ? { branche } : {}), ...(f.adresse?.ort ? { stadt: f.adresse.ort } : {}) },
  }, { weg: 'prospecting', person, wer, id: kontaktId });
  if (!r.ok) {
    if (r.status === 409) {
      // Steht schon in der Kartei (Dublette) bzw. eingeschränkt: kein Kaltkontakt — der Fund wird verworfen, die Kennung freigegeben.
      await aendereFunde(x => ({ ...x, funde: x.funde.map(y => (y.id === fundId ? { ...y, status: 'verworfen', grund: r.fehler.slice(0, 200), kontaktId: undefined, geaendert: jetzt, von: person } : y)), bekannt: f!.osmId ? [...new Set([...x.bekannt, f!.osmId])] : x.bekannt }), { h, wer });
    }
    return { ok: false, status: r.status === 500 ? 409 : r.status as 400 | 403 | 404 | 409 | 413, fehler: r.fehler };
  }
  const firmaId = r.firmaId ?? (await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(k => k.id === kontaktId)?.firmaId;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const l = cur ?? { kontakte: [] };
    // Label fürs Segment + Instagram/Betreiber/Quellen als Notiz (nur, wenn die Notiz noch leer ist — nie überschreiben).
    const notiz = [f!.instagram ? `Instagram: @${f!.instagram}` : '', f!.inhaber && f!.inhaberArt === 'firma' ? `Betreiber laut Impressum: ${f!.inhaber}` : '',
      f!.quellen ? `Quellen: ${Object.entries(f!.quellen).map(([k, v]) => `${k} ${v}`).join(' · ')}` : ''].filter(Boolean).join('\n').slice(0, 1500);
    return { ...l, kontakte: l.kontakte.map(k => (k.id === kontaktId ? { ...k, ...(!(k.labels ?? []).includes(SEGMENT_LABEL) ? { labels: [...(k.labels ?? []), SEGMENT_LABEL] } : {}), ...(notiz && !k.notiz ? { notiz } : {}) } : k)) };
  }, wer);
  // Kampagne + Lead der Firma (Status „neu“ → „kontaktiert“ erst nach der Mail).
  await aendereCrm(c => ({
    ...c,
    kampagnen: c.kampagnen.map(k => (k.id === f!.kampagneId && !k.kontaktIds.includes(kontaktId) ? { ...k, kontaktIds: [...k.kontaktIds, kontaktId], geaendert: jetzt, geaendertVon: person } : k)),
    firmen: c.firmen.map(x => (x.id === firmaId && !x.lead ? { ...x, lead: { status: 'neu', kriterien: leereKriterien(), hauptKontaktId: kontaktId } } : x)),
  }), wer);

  // 2 · Vorschau-Link (einmal; das Token steht nur in diesem Lauf, im Bestand nur sein Fingerabdruck).
  let token: string | null = null;
  const basis = instanzAdresse();
  if (!f.vorschau?.tokenHash && f.vorschau) {
    token = `v1-${randomBytes(16).toString('hex')}`;
    const hash = vorschauTokenHash(token);
    await aendereFunde(x => ({ ...x, funde: x.funde.map(y => (y.id === fundId && y.vorschau ? { ...y, vorschau: { ...y.vorschau, tokenHash: hash, gueltigBis: tagPlus(heute, VORSCHAU_TAGE) } } : y)) }), { h });
  }
  b = await aendereFunde(x => ({ ...x, funde: x.funde.map(y => (y.id === fundId ? { ...y, status: y.status === 'gesendet' ? 'gesendet' : 'uebernommen', firmaId, geaendert: jetzt, von: person } : y)) }), { h, wer });
  f = b.funde.find(x => x.id === fundId) as Fund;

  // 3 · Senden — nur unter allen Bedingungen; sonst bleibt der Entwurf, und der Fund trägt den Grund.
  let gesendet = false;
  let grund = '';
  const e = b.einstellungen;
  const kontakt = (await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(k => k.id === kontaktId);
  if (f.gesendet) gesendet = true;
  else if (!o.sitzung) grund = 'Mail nur per Klick aus der eigenen Sitzung.';
  else if (!e.eigenesRisiko) grund = 'Mail nicht gesendet: „eigenes Risiko“ ist aus (Kanal-Ampel rot, § 7 UWG).';
  else if (!f.email || !kontakt?.email) grund = 'Keine Mail-Adresse bekannt — bitte anrufen oder vorbeigehen.';
  else if (kontakt.werbesperre || kontakt.eingeschraenkt) grund = 'Werbesperre bzw. Einschränkung — keine Mail.';
  else if (!basis) grund = 'Die Adresse der Instanz fehlt (MAKE_OS_ADRESSE) — ohne sie gibt es keinen Vorschau-Link.';
  else if (!token) grund = 'Der Vorschau-Link wurde schon einmal erzeugt, aber nicht gesendet — „Mail senden“ erzeugt einen neuen.';
  else {
    const abs = await absenderOk(e.absender);
    if (!abs.ok) grund = abs.grund;
    else {
      const s = await mailSenden(f, kontakt, token, basis, e.absender!, person, wer);
      if (s.ok) gesendet = true; else grund = s.fehler;
    }
  }

  // 4 · Follow-up (Anruf nach 72 h bzw. Kontakt heute) — einmal je Fund.
  const fuId = `fu-${fundId}`;
  await aendereCrm(c => ((c.followups ?? []).some(x => x.id === fuId) ? c : {
    ...c, followups: [...(c.followups ?? []), { ...neuesFollowUp({ id: fuId, bezug: { art: 'kontakt', id: kontaktId }, kontaktId, art: gesendet ? 'anruf' : 'sonstig', text: gesendet ? 'Anrufen: Website-Entwurf besprechen (nur ohne Antwort/Abmeldung)' : 'Kontakt aufnehmen: Website-Entwurf (Mail ging nicht raus)', faellig: gesendet ? tagPlus(heute, ANRUF_NACH_TAGEN) : heute, quelle: 'hand' }, kontakt, person, jetzt), geaendertVon: person }],
  }), wer);
  return { ok: true, gesendet, fund: f, text: gesendet ? 'Übernommen, Mail gesendet, Anruf in 3 Tagen vorgemerkt.' : `Übernommen. ${grund}`.trim() };
}

/** Die Mail über die Inbox senden und alles vermerken (Fund, Lead, Kampagne, Aktivität). */
async function mailSenden(f: Fund, k: Kontakt, token: string, basis: string, absender: { person: string; postfach: string }, person: string, wer: Wer): Promise<{ ok: true } | { ok: false; fehler: string }> {
  if (!f.entwurf || !k.email) return { ok: false, fehler: 'Kein Entwurf.' };
  const link = `${basis}/vorschau/${token}`;
  const ab = abmeldeLink(k.email, basis)?.link ?? null;
  const text = linksEinsetzen(f.entwurf.text, link, ab);
  const { inboxSenden } = await import('@/lib/inbox/senden-server');
  let r: { status: number; body: Record<string, unknown> };
  try {
    r = await inboxSenden(absender.person, { neu: { postfach: absender.postfach, betreff: f.entwurf.betreff }, an: [{ email: k.email, name: f.name }], text, uwgBestaetigt: true }, wer);
  } catch (err) { r = { status: 502, body: { fehler: err instanceof Error ? err.message.slice(0, 200) : 'Versand gescheitert.' } }; }
  if (r.status !== 200 || r.body.ok !== true) return { ok: false, fehler: `Mail nicht gesendet: ${String(r.body.fehler ?? `Fehler ${r.status}`)}` };
  const am = new Date().toISOString();
  const ueber = adresseMaskiert(String(r.body.von ?? ''));
  await aendereFunde(x => ({ ...x, funde: x.funde.map(y => (y.id === f.id ? { ...y, status: 'gesendet', gesendet: { am, ueber, von: person, eigenesRisiko: true }, geaendert: am } : y)) }), { wer });
  await aendereCrm(c => ({
    ...c,
    kampagnen: c.kampagnen.map(x => (x.id === f.kampagneId ? { ...x, ergebnisse: [...x.ergebnisse, { kontaktId: k.id, ergebnis: 'angesprochen', am, von: person }], geaendert: am, geaendertVon: person } : x)),
    firmen: c.firmen.map(x => (x.id === k.firmaId && x.lead && x.lead.status === 'neu' ? { ...x, lead: { ...x.lead, status: 'kontaktiert' } } : x)),
  }), wer);
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const l = cur ?? { kontakte: [] };
    return { ...l, kontakte: l.kontakte.map(x => (x.id === k.id ? { ...x, aktivitaeten: [...(x.aktivitaeten ?? []), { am, art: 'mail' as const, text: `Mail: Website-Entwurf (Kampagne, auf eigenes Risiko freigegeben)`, von: person }], letzterKontakt: localDay() } : x)) };
  }, wer);
  return { ok: true };
}

/** Eine übernommene, noch nicht gesendete Mail nachsenden (Knopf „Mail senden“) — neuer Vorschau-Link, gleiche Bedingungen. */
export async function fundNachsenden(fundId: string, person: string): Promise<UebernahmeErgebnis> {
  const h = await fundeHaushalt();
  const b = await ladeFunde(h);
  const f = b.funde.find(x => x.id === fundId);
  if (!f || !f.kontaktId) return { ok: false, status: 404, fehler: 'Erst übernehmen (ZOE-Stapel).' };
  if (f.status !== 'uebernommen') return { ok: false, status: 409, fehler: f.status === 'gesendet' ? 'Schon gesendet.' : 'Nicht im Zustand „übernommen“.' };
  // Neuer Link (das alte Token kennt niemand mehr).
  await aendereFunde(x => ({ ...x, funde: x.funde.map(y => (y.id === fundId && y.vorschau ? { ...y, vorschau: { ...y.vorschau, tokenHash: undefined } } : y)) }), { h });
  return fundUebernehmen(fundId, person, { sitzung: true });
}

const nein = (status: 400 | 403 | 404 | 409 | 413, fehler: string): ArtErgebnis => ({ ok: false, status, fehler });

export const FUND_STAPEL_ART: StapelArtFreigabe = {
  freigeben: async (vIn, person, opt) => {
    const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    if (!person || !(await personImHaushaltDesInhabers(person))) return nein(403, 'Nur im Haushalt des Inhabers.');
    const { beanspruche, entscheide, loslassen } = await import('@/lib/zoe/stapel');
    const a = await beanspruche(vIn.id, person, v => (v.bezug?.art !== 'fund' || v.werkzeug !== FUND_WERKZEUG ? { status: 404, fehler: 'Vorschlag nicht gefunden.' } : null));
    if (!a.ok) return nein(a.status, a.fehler);
    let r: UebernahmeErgebnis;
    try { r = await fundUebernehmen(a.v.bezug!.id, person, { sitzung: opt.sitzung === true }); }
    catch (err) {
      await loslassen(a.v.id);
      if (!(err instanceof FundeFehler)) console.error('[funde] Übernahme:', err instanceof Error ? err.message.slice(0, 200) : err);
      return err instanceof FundeFehler ? nein(err.status === 503 ? 409 : err.status, err.message) : nein(409, 'Übernahme gescheitert — nichts gesendet.'); }
    if (!r.ok) { await loslassen(a.v.id); return nein(r.status, r.fehler); }
    await entscheide(a.v.id, 'freigegeben', { ergebnis: r.text, von: person, ausArbeit: true });
    return { ok: true, text: r.text };
  },
  nachAblehnen: async (v, person) => {
    const id = v.bezug?.id;
    if (!id) return;
    await aendereFunde(b => {
      const f = b.funde.find(x => x.id === id);
      if (!f || f.status !== 'vorbereitet') return b;
      return { ...b, funde: b.funde.map(x => (x.id === id ? { ...x, status: 'verworfen', grund: 'Im Stapel abgelehnt', geaendert: new Date().toISOString(), von: person } : x)), bekannt: f.osmId ? [...new Set([...b.bekannt, f.osmId])] : b.bekannt };
    }, { wer: { art: 'person', person } });
  },
};

