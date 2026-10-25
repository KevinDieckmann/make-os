// ─── Markttraktion › Formulare · „Angebot anfordern“ — der EINE Kern (nur Server, 25.10.2026) ──────────────────────────────────────────────
// `angebotAnfordern(eingabe, quelle)` — die Quellen: `intern` (Team mit eigenem Konto, Sitzung) · `link` (externer Vertriebler per geschütztem
// Link). Später dockt Brevo als dritte Quelle an genau hier an (Kevin 25.10.: „wir werden Brevo als CRM anbinden … die Vertriebler können besser in
// dem anderen CRM arbeiten“): eine neue Art in `AnfrageQuelleKontext` (z. B. `{ art: 'brevo', verbindung }`) mit eigener Prüfung der Herkunft
// (Webhook-Signatur) — Eingabe, Kunde, Deal, Angebot, Leitplanken und Versand bleiben dieselben. Nicht gebaut.
//
// EIN Vorgang über das Absichtsprotokoll (Art „angebot-anfrage“, Schlüssel = Kennung des Eingangs; jeder Schritt idempotent, feste Kennungen aus der
// Anfrage-Kennung des Browsers: Eingang `af-<uuid>`, Kontakt `c-<uuid>`, Deal `ch-af-<uuid>`, Angebot `ang-af-<uuid>`):
//   eingang     Eingang „in Arbeit“ (Empfänger nur als Fingerabdruck)
//   kunde       Person finden oder anlegen — der vorhandene Weg `personAnlegen` (Weg „vertrieb“: Dublette über alle Adressen, Art. 18 nie, Sperrliste,
//               Datenschutz-Stempel), Firma über `firmaSichern` (`bestehendeFirma`/`firmaZurKarte`); Werbesperre → nur verknüpfen. Einwilligung
//               „Antwort auf Anfrage“ (Mail) wie bei /api/crm/anfrage — nur ohne Werbesperre und ohne gültige Mail-Grundlage.
//   deal        `dealAnlegen` (Produkt, Wert aus den Positionen = Preis-Kette, nächster Schritt „Angebot nachfassen“ +5 Werktage, zuständig = Vertriebler
//               bzw. bei Externen der Inhaber, der den Link anlegte); ein offener Deal mit demselben Hauptprodukt wird genommen
//   angebot     Entwurf über `angebotSpeichern` (Positionen wie „Angebot erstellen“ am Deal: `angebotPositionenAusProdukt`, Vorlage Sie/Du)
//   entscheiden Leitplanken (lib/crm/formulare.ts `leitplanken`) → versenden oder Freigabe
//   stellen     `angebotStellen` (Nummer, PDF, Prüfsumme, Follow-up „Angebot nachfassen“) — nur beim Versenden
//   senden      `angebotVerschickenImAuftrag` (lib/crm/angebot-versand.ts) — höchstens einmal; ein Abbruch mitten im Senden legt es zur Freigabe
//   abschluss   verschickt: Aktivität am Kontakt (`angebotGesendet`), Datenschutzhinweis erteilt, Glocke an die Inhaber · sonst Freigabe im Stapel
//               (Art „angebot-anfrage“, ein Klick „Senden“) + Glocke
// Art. 18 entscheidet VOR dem Vorgang: abgelehnt, nichts angelegt (nur der Eingang ohne Kennungen). Einem Externen geht NIE etwas aus dem Bestand
// zurück — auch nicht „Kunde war schon da“; die Antwort sagt nur „ist raus“ bzw. „liegt bei uns zur Prüfung“.

import { randomBytes } from 'crypto';
import { localDay } from '@/lib/zeit';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';
import { aendereKontakte } from './kartei-schreiben';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from './speicher';
import { kontakteFuerVerarbeitung } from './verarbeitung';
import { trifftEingeschraenkte } from './netzwerken';
import { personAnlegen, firmaSichern } from './person-anlegen-server';
import { dealAnlegen } from './deal-anlegen';
import { OFFENE_STUFEN } from './pipeline';
import { wer as teamWer, BEIDE, verantwortlich } from './team';
import { datenschutzStempeln } from './datenschutz-stempel';
import { standVon } from './crm-stand';
import { AngebotFehler, angebotSpeichern, angebotStellen, angebotGesendet, gesellschaftenLaden } from './angebot-server';
import { angebotHauptprodukt, angebotTitelAus, angebotVorlage, dealWertAusAngebot, istGesellschaft, plusTage, werktagePlus } from './angebote';
import { mitVorgaben } from './gesellschaften';
import { mandatArtVon } from './produkt-karte';
import { datenschutzAngabenAus } from './netzwerken-recht';
import { EINGESCHRAENKT_FEHLER } from './einschraenkung';
import {
  anfrageEingabePruefen, leitplanken, nurListenpreise, positionenAusWahl, linkVorsatz, linkLage, katalogProdukt, produktWaehlbar, mailOk, ANGEBOT_SEITE, FORMULAR_GRENZEN,
  type AnfrageEingabe, type AnfrageQuelle, type Eingang, type ExternerLink, type FormularEinstellungen, type KatalogProdukt,
} from './formulare';
import { FormularFehler, aendereEingang, aendereFormular, empfaengerVon, formularHaushalt, ladeFormular, linkTokenHash, linkZuSlug } from './formulare-speicher';
import { absenderPruefen, angebotVerschickenImAuftrag } from './angebot-versand';
import { istBusinessGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';
import type { AngebotPosition, Leistung } from './typen';
import { WEG } from '@/lib/wege';

export { FormularFehler } from './formulare-speicher';

// ── Quellen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Woher eine Anfrage kommt. Neue Quelle (Brevo) = neue Art hier + eigene Herkunftsprüfung im Aufrufer; der Rest bleibt. */
export type AnfrageQuelleKontext = { art: 'intern'; person: string } | { art: 'link'; link: ExternerLink };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Die feste Kennung der Anfrage: die UUID aus der Anfrage-Kennung des Browsers (Wiederholung = derselbe Vorgang), sonst neu. */
export const anfrageUuid = (anfrageId: unknown): string => (typeof anfrageId === 'string' && UUID.test(anfrageId.toLowerCase()) ? anfrageId.toLowerCase() : neueKennung('x').slice(2));

export const SCHRITTE = ['eingang', 'kunde', 'deal', 'angebot', 'entscheiden', 'stellen', 'senden', 'abschluss'] as const;

interface AnfrageDaten {
  [k: string]: unknown;
  uuid: string; eingangId: string; quelle: AnfrageQuelle; person: string; von?: string; linkId?: string; vertrieblerName: string; zustaendig: string;
  eingabe: AnfrageEingabe; gesellschaft: Gesellschaftskennung; positionen: AngebotPosition[]; abweichungen: string[]; offen: string[]; hp?: string;
  heute: string; jetzt: string;
  kontaktId?: string; firmaId?: string; firmaName?: string; werbesperre?: boolean; dealId?: string; angebotId?: string; versenden?: boolean; gruende?: string[];
}

export interface AnfordernErgebnis { status: number; body: Record<string, unknown> }
const PRUEFUNG_TEXT = 'Danke — die Anfrage ist angekommen und liegt bei uns zur Prüfung. Das Angebot geht nach der Prüfung an die angegebene Adresse.';

async function personName(person: string): Promise<string> {
  const { namenVon } = await import('@/lib/zugang/konten');
  return (await namenVon().catch(() => ({} as Record<string, string>)))[person] || person;
}
/** Die handelnde Person eines Links (Stempel am CRM): der Inhaber, der ihn anlegte — ist er keiner mehr, der Haupt-Inhaber. */
async function linkPerson(l: ExternerLink): Promise<string> {
  const { istInhaber, inhaberSpeicher } = await import('@/lib/zugang/haushalt-inhaber');
  if (await istInhaber(l.angelegtVon)) return l.angelegtVon;
  const h = await inhaberSpeicher();
  if (!h) throw new FormularFehler('Kein Inhaber eingerichtet.', 503);
  return h;
}
const zustaendigFuer = (person: string): string => { const w = teamWer(person); return w && w !== BEIDE ? w : verantwortlich('sales'); };

// ── Einstieg ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * „Angebot anfordern“ — die EINE Server-Funktion für jede Quelle (siehe Kopf). Liefert `{ status, body }` für `einmalig`. Prüffehler der Eingabe → 400/413
 * ohne Eingang; Art. 18 → abgelehnt (nichts angelegt); sonst der Vorgang (verschickt bzw. Freigabe).
 */
export async function angebotAnfordern(roh: unknown, q: AnfrageQuelleKontext, o: { anfrageId?: unknown; wer?: Wer; jetzt?: Date } = {}): Promise<AnfordernErgebnis> {
  const extern = q.art === 'link';
  const wer: Wer = o.wer ?? (extern ? { art: 'system' } : { art: 'person', person: q.person });
  const jetzt = o.jetzt ?? new Date();
  const heute = localDay(jetzt);
  const p = anfrageEingabePruefen(roh, q.art);
  if (!p.ok) return { status: p.status, body: { ok: false, fehler: p.fehler } };
  const e = p.e;
  const h = await formularHaushalt();
  const uuid = anfrageUuid(o.anfrageId);
  const eingangId = `af-${uuid}`;

  // Schon da (Wiederholung nach Abbruch, zweiter Klick nach `einmalig`)? Dann weiter bzw. das Ergebnis.
  const vorher = (await ladeFormular(h)).eingaenge.find(x => x.id === eingangId);
  if (vorher && vorher.status !== 'laeuft') return antwort(vorher, extern, e.person.email);

  // Produkte, Gesellschaft (nur Business, eine je Angebot), Positionen.
  const crm = await ladeCrm();
  const erlaubt = extern ? q.link.produkte : undefined;
  const ges = gesellschaftAus(e.produkte.map(w => crm.leistungen.find(l => l.id === w.id)).filter((l): l is Leistung => !!l));
  if (!ges.ok) return { status: 400, body: { ok: false, fehler: ges.fehler } };
  const gesellschaft = ges.g ?? await (await import('@/lib/gesellschaften/server')).absenderVorgabe(h);
  if (!gesellschaft || !istGesellschaft(gesellschaft) || !istBusinessGesellschaft(gesellschaft)) return { status: 400, body: { ok: false, fehler: 'Für diese Produkte ist keine Business-Gesellschaft als Absender eingerichtet — bitte im Produkt die Gesellschaft wählen.' } };
  const g = (await gesellschaftenLaden(h)).find(x => x.id === gesellschaft);
  const pos = positionenAusWahl(e.produkte, crm.leistungen, { kleinunternehmer: !!g?.kleinunternehmer, ...(erlaubt ? { erlaubt } : {}) });
  if (!pos.ok) return { status: 400, body: { ok: false, fehler: pos.fehler } };

  const person = extern ? await linkPerson(q.link) : q.person;
  const vertrieblerName = extern ? q.link.name : await personName(q.person);
  const zustaendig = zustaendigFuer(person);

  // Art. 18 — vor jeder Wirkung: eine eingeschränkte Person wird nie angelegt, nie angehängt.
  const alle = await kontakteFuerVerarbeitung({ mitEingeschraenkten: true });
  const gewaehlt = e.kontaktId ? alle.find(k => k.id === e.kontaktId) : undefined;
  if (e.kontaktId && !gewaehlt) return { status: 400, body: { ok: false, fehler: 'Die gewählte Person gibt es nicht (mehr) — bitte neu wählen.' } };
  if (e.firmaId && !crm.firmen.some(f => f.id === e.firmaId && !f.geloeschtAm)) return { status: 400, body: { ok: false, fehler: 'Die gewählte Firma gibt es nicht (mehr) — bitte neu wählen.' } };
  const merkmale = { vorname: e.person.vorname, nachname: e.person.nachname, firma: e.firma.name, email: e.person.email, telefon: e.person.telefon };
  if (gewaehlt?.eingeschraenkt || trifftEingeschraenkte({ kontakt: merkmale }, alle, '')) {
    const eingang: Eingang = { id: eingangId, am: jetzt.toISOString(), quelle: q.art, ...(extern ? { linkId: q.link.id } : { von: q.person }), status: 'abgelehnt', gruende: ['Verarbeitung eingeschränkt (Art. 18) — nichts angelegt.'], produkte: e.produkte.map(w => w.id), entschieden: { am: jetzt.toISOString(), von: 'system', art: 'abgelehnt', grund: 'Art. 18' } };
    await aendereFormular(b => (b.eingaenge.some(x => x.id === eingangId) ? b : { ...b, eingaenge: [...b.eingaenge, eingang], links: linkGezaehlt(b.links, q, heute) }), h);
    return extern ? { status: 200, body: { ok: true, status: 'freigabe', text: PRUEFUNG_TEXT } } : { status: 409, body: { ok: false, status: 'abgelehnt', eingangId, fehler: EINGESCHRAENKT_FEHLER, eingeschraenkt: true } };
  }

  const { absichtBeginnen } = await import('@/lib/store/absichten');
  const daten: AnfrageDaten = {
    uuid, eingangId, quelle: q.art, person, ...(extern ? { linkId: q.link.id } : { von: q.person }), vertrieblerName, zustaendig,
    eingabe: e, gesellschaft, positionen: pos.r.positionen, abweichungen: pos.r.abweichungen, offen: pos.r.offen,
    ...(angebotHauptprodukt({ positionen: pos.r.positionen }, crm.leistungen) ? { hp: angebotHauptprodukt({ positionen: pos.r.positionen }, crm.leistungen) } : {}),
    heute, jetzt: jetzt.toISOString(),
  };
  const { absicht } = await absichtBeginnen(h, { art: 'angebot-anfrage', schluessel: eingangId, schritte: SCHRITTE, person, daten });
  try { await anfrageAusfuehren(h, absicht, wer); }
  catch (err) {
    if (err instanceof FormularFehler) return { status: err.status, body: { ok: false, fehler: extern ? 'Die Anfrage konnte gerade nicht angenommen werden — bitte später noch einmal.' : err.message, ...(!extern ? err.extra : {}) } };
    throw err;
  }
  const fertig = (await ladeFormular(h)).eingaenge.find(x => x.id === eingangId);
  if (!fertig) return { status: 500, body: { ok: false, fehler: 'Die Anfrage ist nicht festgehalten.' } };
  return antwort(fertig, extern, e.person.email);
}

/** Die Antwort an den Vertriebler — einem Externen nie etwas aus dem Bestand (keine Kennungen, keine Gründe, kein „schon da“). */
function antwort(x: Eingang, extern: boolean, email: string): AnfordernErgebnis {
  if (extern) {
    return x.status === 'verschickt'
      ? { status: 200, body: { ok: true, status: 'verschickt', ...(x.nummer ? { nummer: x.nummer } : {}), text: `Angebot ${x.nummer ?? ''} ist raus — an ${email}.`.replace('  ', ' ') } }
      : { status: 200, body: { ok: true, status: 'freigabe', text: PRUEFUNG_TEXT } };
  }
  const basis = { eingangId: x.id, ...(x.angebotId ? { angebotId: x.angebotId } : {}), ...(x.nummer ? { nummer: x.nummer } : {}), ...(x.gruende?.length ? { gruende: x.gruende } : {}) };
  if (x.status === 'verschickt') return { status: 200, body: { ok: true, status: 'verschickt', ...basis, text: `Angebot ${x.nummer} ist raus — an ${x.an?.maskiert ?? email}.` } };
  if (x.status === 'freigabe') return { status: 200, body: { ok: true, status: 'freigabe', ...basis, text: 'Das Angebot ist fertig gebaut und liegt zur Freigabe bei den Inhabern (ein Klick „Senden“).' } };
  if (x.status === 'abgelehnt') return { status: 409, body: { ok: false, status: 'abgelehnt', ...basis, fehler: x.gruende?.join(' ') || 'Abgelehnt.' } };
  return { status: 202, body: { ok: true, status: 'laeuft', ...basis, text: 'Die Anfrage wird noch bearbeitet.' } };
}

/** Eine Gesellschaft für alle Produkte (ohne Angabe „offen“) — zwei verschiedene oder eine Privat-Gesellschaft → Fehler. Rein. */
export function gesellschaftAus(ls: readonly Pick<Leistung, 'gesellschaft' | 'name'>[]): { ok: true; g: Gesellschaftskennung | null } | { ok: false; fehler: string } {
  const gs = [...new Set(ls.map(l => l.gesellschaft).filter(x => x && x !== 'offen'))];
  if (gs.length > 1) return { ok: false, fehler: 'Die Produkte gehören zu verschiedenen Gesellschaften — bitte je Gesellschaft ein Angebot anfordern.' };
  if (!gs.length) return { ok: true, g: null };
  if (!istGesellschaft(gs[0]) || !istBusinessGesellschaft(gs[0])) return { ok: false, fehler: 'Diese Produkte gehören nicht zu einer Business-Gesellschaft — hier gehen nur Business-Angebote.' };
  return { ok: true, g: gs[0] };
}

function linkGezaehlt(links: ExternerLink[], q: AnfrageQuelleKontext, heute: string): ExternerLink[] {
  return q.art === 'link' ? links.map(l => (l.id === q.link.id ? { ...l, zuletzt: heute, anzahl: (l.anzahl ?? 0) + 1 } : l)) : links;
}

// ── Der Vorgang ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Wiederaufnahme (Start, Takt, Durchsicht — lib/store/absichten-fortsetzen.ts): dieselben Schritte ab dem ersten offenen. */
export async function angebotAnfrageFortsetzen(haushalt: string, a: import('@/lib/store/absichten').Absicht): Promise<void> {
  const d = a.daten as AnfrageDaten;
  await anfrageAusfuehren(haushalt, a, d.quelle === 'link' ? { art: 'system' } : { art: 'person', person: d.person });
}

async function anfrageAusfuehren(h: string, absicht: import('@/lib/store/absichten').Absicht, wer: Wer): Promise<void> {
  const { mitVorgang, absichtAbschliessen } = await import('@/lib/store/absichten');
  await mitVorgang(h, absicht, async v => {
    const d = (k: string) => v.daten(k);
    const D = v.absicht.daten as AnfrageDaten;
    const e = D.eingabe;
    const quelleText = D.quelle === 'link' ? `Vertrieb (Link: ${D.vertrieblerName})` : 'Vertrieb (Formular)';

    await v.schritt('eingang', async () => {
      const eingang: Eingang = { id: D.eingangId, am: D.jetzt, quelle: D.quelle, ...(D.linkId ? { linkId: D.linkId } : { von: D.von }), status: 'laeuft', produkte: e.produkte.map(w => w.id), an: empfaengerVon(e.person.email) };
      await aendereFormular(b => (b.eingaenge.some(x => x.id === D.eingangId) ? b : {
        ...b, eingaenge: [...b.eingaenge, eingang],
        links: D.linkId ? b.links.map(l => (l.id === D.linkId ? { ...l, zuletzt: D.heute, anzahl: (l.anzahl ?? 0) + 1 } : l)) : b.links,
      }), h);
    });

    await v.schritt('kunde', async () => kundeSichern(D, quelleText, wer, h), r => r);

    await v.schritt('deal', async () => dealSichern({ ...D, kontaktId: d('kontaktId') as string, firmaId: d('firmaId') as string | undefined }, wer), r => r);

    await v.schritt('angebot', async () => {
      const angebotId = `ang-af-${D.uuid}`;
      const crm = await ladeCrm();
      if (!(crm.angebote ?? []).some(a => a.id === angebotId)) {
        const g = (await gesellschaftenLaden(h)).find(x => x.id === D.gesellschaft) ?? { id: D.gesellschaft };
        const gueltigBis = plusTage(D.heute, mitVorgaben(g).gueltigkeitTage);
        const titel = angebotTitelAus({ positionen: D.positionen }, crm.leistungen, d('firmaName') as string | undefined) || 'Angebot';
        const vorlage = angebotVorlage({ anrede: e.person.anrede, vorname: e.person.vorname, nachname: e.person.nachname, titel, gueltigBis });
        await angebotSpeichern({
          id: angebotId, person: D.person, haushalt: h, wer, jetzt: new Date(D.jetzt),
          felder: { gesellschaft: D.gesellschaft, kontaktId: d('kontaktId'), ...(d('firmaId') ? { firmaId: d('firmaId') } : {}), dealId: d('dealId'), dealWahl: 'deal', titel, positionen: D.positionen, einleitung: vorlage.einleitung, schluss: vorlage.schluss, gueltigBis },
        });
      }
      await aendereEingang(D.eingangId, x => ({ ...x, angebotId }), h);
      return { angebotId };
    }, r => r);

    await v.schritt('entscheiden', async () => {
      const crm = await ladeCrm();
      const a = (crm.angebote ?? []).find(x => x.id === d('angebotId'));
      const k = (await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(x => x.id === d('kontaktId'));
      const formular = await ladeFormular(h);
      const absender = await absenderPruefen(formular.einstellungen.absender);
      const { verantwortlicherLaden } = await import('@/lib/datenschutz/einrichtung-server');
      const ds = datenschutzAngabenAus((await verantwortlicherLaden()).v);
      const { adresseGueltig } = await import('@/lib/gmail/mime');
      const r = leitplanken({
        listenpreise: !!a && nurListenpreise(a.positionen, crm.leistungen), abweichungen: D.abweichungen, offen: D.offen,
        adresseOk: mailOk(e.person.email) && adresseGueltig(e.person.email), werbesperre: !!k?.werbesperre, absenderOk: absender.ok, datenschutzOk: !ds.fehlt,
      });
      await aendereEingang(D.eingangId, x => ({ ...x, gruende: r.gruende }), h);
      return { versenden: r.versenden, gruende: r.gruende };
    }, r => r);

    await v.schritt('stellen', async () => {
      if (!d('versenden')) return {};
      const a = ((await ladeCrm()).angebote ?? []).find(x => x.id === d('angebotId'));
      if (!a) throw new FormularFehler('Der Angebots-Entwurf fehlt.', 500);
      if (a.status !== 'entwurf') { await aendereEingang(D.eingangId, x => ({ ...x, ...(a.nummer ? { nummer: a.nummer } : {}) }), h); return {}; }
      try {
        const s = await angebotStellen({ id: a.id, stand: standVon(a), person: D.person, haushalt: h, nachfassenAm: werktagePlus(D.heute, 5), wer });
        await aendereEingang(D.eingangId, x => ({ ...x, ...(s.angebot.nummer ? { nummer: s.angebot.nummer } : {}) }), h);
        return {};
      } catch (err) {
        if (!(err instanceof AngebotFehler)) throw err;
        // Nicht gestellt (z. B. Absender der Gesellschaft unvollständig) — dann entscheidet ein Mensch; der Entwurf bleibt.
        const gruende = [...((d('gruende') as string[]) ?? []), `Nicht gestellt: ${err.message}`];
        await aendereEingang(D.eingangId, x => ({ ...x, gruende }), h);
        return { versenden: false, gruende };
      }
    }, r => r);

    await v.schritt('senden', async () => {
      if (!d('versenden')) return {};
      const x = (await ladeFormular(h)).eingaenge.find(y => y.id === D.eingangId);
      if (x?.versendet) return {};
      if (x?.versandBegonnen) {
        // Abbruch mitten im Senden: ob die Mail raus ist, weiß nur das Postfach — nie ein zweites Mal von selbst.
        const gruende = [...((d('gruende') as string[]) ?? []), 'Versand unklar (abgebrochen) — bitte in „Gesendet“ des Absender-Postfachs prüfen, dann senden oder ablehnen.'];
        await aendereEingang(D.eingangId, y => ({ ...y, gruende }), h);
        return { versenden: false, gruende };
      }
      const r = await angebotVerschickenImAuftrag(D.eingangId, { ausgeloest: D.quelle === 'link' ? 'link' : D.person });
      if (r.ok) return {};
      const gruende = [...((d('gruende') as string[]) ?? []), r.fehler];
      await aendereEingang(D.eingangId, y => ({ ...y, gruende }), h);
      return { versenden: false, gruende };
    }, r => r);

    await v.schritt('abschluss', async () => {
      const x = (await ladeFormular(h)).eingaenge.find(y => y.id === D.eingangId);
      if (!x) throw new FormularFehler('Der Eingang fehlt.', 500);
      // Schon abgeschlossen (Abbruch nach dem Abschluss, Wiederaufnahme): nichts doppelt — keine zweite Glocke, kein zweiter Vorschlag.
      if (x.status !== 'laeuft') return {};
      const firma = (d('firmaName') as string | undefined) ?? e.firma.name;
      if (d('versenden') && x.versendet) {
        await nachVersand({ angebotId: d('angebotId') as string, kontaktId: d('kontaktId') as string, person: D.person, heute: D.heute, wer });
        await aendereEingang(D.eingangId, y => ({ ...y, status: 'verschickt' }), h);
        await inhaberMelden(`Angebot ${x.nummer ?? ''} an ${firma} verschickt — ausgelöst von ${D.vertrieblerName}`.replace('  ', ' '), WEG.angebot({ angebotId: d('angebotId') as string }), D.quelle === 'intern' ? D.von : undefined);
        return {};
      }
      const { lege } = await import('@/lib/zoe/stapel');
      const gruende = (d('gruende') as string[] | undefined) ?? x.gruende ?? [];
      const vo = await lege({
        werkzeug: 'angebot_anfrage', gruppe: 'markttraktion', titel: `Angebot an ${firma} senden?`.slice(0, 160),
        nachher: `Angebot „${firma}“ ist fertig gebaut — Senden stellt es (Nummer, PDF) und verschickt es über das Absender-Postfach.${gruende.length ? ` Warum nicht automatisch: ${gruende.join(' · ')}` : ''}`.slice(0, 1500),
        eingabe: { eingangId: D.eingangId, angebotId: d('angebotId') }, anlass: `Angefordert von ${D.vertrieblerName} über „Angebot anfordern“.`, quelle: 'lauf',
        bezug: { art: 'angebot-anfrage', id: D.eingangId }, einmalig: D.eingangId,
      });
      await aendereEingang(D.eingangId, y => ({ ...y, status: 'freigabe', vorschlagId: vo.id, gruende }), h);
      await inhaberMelden(`Angebot an ${firma} wartet auf Freigabe — angefordert von ${D.vertrieblerName}`, WEG.formulare('eingaenge'), D.quelle === 'intern' ? D.von : undefined);
      return {};
    });
  });
  await absichtAbschliessen(h, absicht.id, 'fertig');
}

/** Kunde finden oder anlegen — über die vorhandenen Wege (siehe Kopf). Liefert die Daten für die nächsten Schritte. */
async function kundeSichern(D: AnfrageDaten, quelleText: string, wer: Wer, h: string): Promise<Record<string, unknown>> {
  const e = D.eingabe;
  let kontaktId: string, firmaId: string | undefined, neuePerson = false;
  if (e.kontaktId) {
    kontaktId = e.kontaktId;
  } else {
    const r = await personAnlegen({
      vorname: e.person.vorname, nachname: e.person.nachname, email: e.person.email, ...(e.person.telefon ? { telefon: e.person.telefon } : {}), anrede: e.person.anrede,
      ...(e.firmaId ? { firmaId: e.firmaId } : { firma: e.firma.name }), ...(e.firma.ort ? { firmaZusatz: { stadt: e.firma.ort } } : {}),
      zustaendig: D.zustaendig, quelleText, anlass: `Angebot angefordert — ${quelleText}`,
    }, { weg: 'vertrieb', person: D.person, wer, id: `c-${D.uuid}` });
    if (r.ok) { kontaktId = r.kontaktId; firmaId = r.firmaId; neuePerson = !!r.firmaNeu; }
    else if (r.dublette) kontaktId = r.dublette.id;
    else if (r.eingeschraenkt) throw new FormularFehler(EINGESCHRAENKT_FEHLER, 409);
    else throw new FormularFehler(r.fehler, r.status);
  }
  const k0 = (await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(k => k.id === kontaktId);
  if (!k0) throw new FormularFehler('Der Kontakt ist nicht angelegt.', 500);
  if (k0.eingeschraenkt) throw new FormularFehler(EINGESCHRAENKT_FEHLER, 409);
  // Firma des Angebots: gewählt, beim Anlegen entstanden, sonst über den EINEN Weg (vorhanden verknüpfen bzw. neu). Eine vorhandene Person bleibt, wie sie ist.
  let firmaNeu = false;
  if (!firmaId) {
    if (e.firmaId) firmaId = e.firmaId;
    else {
      const plan = await firmaSichern(e.firma.name, { email: e.person.email }, wer, e.firma.ort ? { stadt: e.firma.ort } : {});
      firmaId = plan?.firma.id; firmaNeu = plan?.art === 'neu';
    }
  } else firmaNeu = neuePerson; // beim Anlegen der Person entstanden
  const crm = await ladeCrm();
  const f = firmaId ? crm.firmen.find(x => x.id === firmaId) : undefined;
  // Anschrift (optional) nur an einer NEUEN Firma — eine vorhandene behält, was dort steht.
  const anschrift = [e.firma.strasse, [e.firma.plz, e.firma.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  if (f && firmaNeu && anschrift && !f.zahlung?.empfaenger?.anschrift) {
    await aendereCrm(b => ({ ...b, firmen: b.firmen.map(x => (x.id === f.id && !x.zahlung?.empfaenger?.anschrift ? { ...x, zahlung: { ...(x.zahlung ?? {}), empfaenger: { ...(x.zahlung?.empfaenger ?? {}), anschrift } }, geaendert: D.jetzt, geaendertVon: D.person } : x)) }), wer);
  }
  // Einwilligung „Antwort auf Anfrage“ (Mail) — wie /api/crm/anfrage: nur ohne Werbesperre und ohne gültige Mail-Grundlage. Werbesperre → nur verknüpfen.
  if (!k0.werbesperre) {
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const fk = cur ?? { kontakte: [] };
      return { ...fk, kontakte: fk.kontakte.map(k => {
        if (k.id !== kontaktId || k.eingeschraenkt || k.werbesperre || (k.einwilligungen ?? []).some(x => x.kanal === 'mail' && !x.widerrufenAm)) return k;
        const neu: Kontakt = { ...k, einwilligungen: [...(k.einwilligungen ?? []), { kanal: 'mail', grundlage: 'anfrage', erteiltAm: D.heute, nachweis: `Angebot angefordert über ${quelleText} am ${D.heute}` }] };
        return datenschutzStempeln(neu, k, D.person, D.jetzt, D.heute);
      }) };
    }, wer);
  }
  await aendereEingang(D.eingangId, x => ({ ...x, kontaktId, ...(firmaId ? { firmaId } : {}) }), h);
  return { kontaktId, ...(firmaId ? { firmaId } : {}), firmaName: f?.name ?? e.firma.name, werbesperre: !!k0.werbesperre };
}

/** Deal: der feste der Anfrage, ein offener mit demselben Hauptprodukt, sonst neu über `dealAnlegen`. */
async function dealSichern(D: AnfrageDaten & { kontaktId: string; firmaId?: string }, wer: Wer): Promise<Record<string, unknown>> {
  const id = `ch-af-${D.uuid}`;
  const crm = await ladeCrm();
  if (crm.chancen.some(c => c.id === id)) return { dealId: id };
  const offen = D.hp ? crm.chancen.find(c => OFFENE_STUFEN.includes(c.stufe) && c.leistungId === D.hp && (c.kontaktIds.includes(D.kontaktId) || (!!D.firmaId && c.firmaId === D.firmaId))) : undefined;
  let dealId = offen?.id;
  if (!dealId) {
    const l = D.hp ? crm.leistungen.find(x => x.id === D.hp) : undefined;
    const notiz = [D.eingabe.notiz ?? '', D.eingabe.start ? `Gewünschter Start: ${D.eingabe.start.slice(8, 10)}.${D.eingabe.start.slice(5, 7)}.${D.eingabe.start.slice(0, 4)}` : '', `Angefordert über „Angebot anfordern“ — ${D.vertrieblerName}.`].filter(Boolean).join('\n');
    const r = await dealAnlegen({
      id, kontaktIds: [D.kontaktId], ...(D.firmaId ? { firmaId: D.firmaId } : {}), wert: dealWertAusAngebot({ positionen: D.positionen }), ...(l ? { leistungId: l.id, art: mandatArtVon(l) } : {}),
      gesellschaft: D.gesellschaft, trotzdem: true, schritt: { text: 'Angebot nachfassen', datum: werktagePlus(D.heute, 5) }, notiz, besitzer: D.zustaendig,
    }, D.person, D.jetzt, wer);
    if (r.ok) dealId = r.chance.id;
    else if (r.offen?.id === id) dealId = id;
    else throw new FormularFehler(r.status === 409 && /Art\. 18/.test(r.fehler) ? EINGESCHRAENKT_FEHLER : `Kein Deal angelegt: ${r.fehler}`, r.status);
  }
  await aendereEingang(D.eingangId, x => ({ ...x, dealId }), await formularHaushalt());
  return { dealId };
}

/** Nach dem Versand: Mail-Aktivität „Angebot … gesendet“ am Kontakt (idempotent) und der Datenschutzhinweis als erteilt (stand in der Mail). */
async function nachVersand(p: { angebotId: string; kontaktId: string; person: string; heute: string; wer: Wer }): Promise<void> {
  await angebotGesendet({ id: p.angebotId, person: p.person, wer: p.wer }).catch(() => null);
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    return { ...f, kontakte: f.kontakte.map(k => (k.id === p.kontaktId && !k.eingeschraenkt && !k.datenschutzInformiertAm ? { ...k, datenschutzInformiertAm: p.heute } : k)) };
  }, p.wer);
}

/** Glocke an alle Inhaber (nie an die auslösende Person selbst — `melde`). Telegram nur neutral (lib/meldungen/speicher.ts `telegramText`). */
async function inhaberMelden(titel: string, link: string, von?: string): Promise<void> {
  const [{ alleInhaberSpeicher }, { melde }] = await Promise.all([import('@/lib/zugang/haushalt-inhaber'), import('@/lib/meldungen/melden')]);
  for (const an of await alleInhaberSpeicher().catch(() => [] as string[])) await melde({ an, art: 'angebot', titel: titel.slice(0, 200), link, ...(von ? { von } : {}) });
}

// ── Freigabe im Stapel (Art „angebot-anfrage“) ───────────────────────────────────────────────────────────────────────────────────

type ArtErgebnis = import('@/lib/zoe/stapel-arten').ArtErgebnis;
const artNein = (status: 400 | 403 | 404 | 409 | 413, fehler: string): ArtErgebnis => ({ ok: false, status, fehler });

/**
 * „Senden“ (ein Klick): nur ein Inhaber, nur aus der eigenen Sitzung (der Dienstweg sendet nie). Stellt den Entwurf (Nummer, PDF) über `angebotStellen`
 * und verschickt ihn über die EINE Versand-Funktion — dieselben Prüfungen wie automatisch. Ablehnen: am Eingang vermerkt, der Entwurf bleibt im
 * Angebots-Tool (nichts geht verloren).
 */
export const ANGEBOT_ANFRAGE_STAPEL_ART: import('@/lib/zoe/stapel-arten').StapelArtFreigabe = {
  freigeben: async (vIn, person, opt) => {
    const [{ istInhaber }, { beanspruche, loslassen, entscheide }] = await Promise.all([import('@/lib/zugang/haushalt-inhaber'), import('@/lib/zoe/stapel')]);
    if (!(await istInhaber(person))) return artNein(403, 'Angebote aus dem Formular gibt nur ein Inhaber frei.');
    if (!opt.sitzung) return artNein(403, 'Senden nur aus der eigenen Sitzung — über den Dienstweg wird nichts gesendet.');
    const a = await beanspruche(vIn.id, person, v => (v.bezug?.art !== 'angebot-anfrage' ? { status: 404, fehler: 'Vorschlag nicht gefunden.' } : null));
    if (!a.ok) return artNein(a.status, a.fehler);
    const h = await formularHaushalt();
    const eingangId = a.v.bezug!.id;
    const r = await freigabeSenden(h, eingangId, person);
    if (!r.ok) { await loslassen(vIn.id); return artNein(r.status as 400 | 403 | 404 | 409, r.fehler); }
    await entscheide(vIn.id, 'freigegeben', { ergebnis: r.text, von: person, ausArbeit: true });
    return { ok: true, text: r.text };
  },
  nachAblehnen: async (v, person) => {
    if (v.bezug?.art !== 'angebot-anfrage') return;
    const jetzt = new Date().toISOString();
    await aendereEingang(v.bezug.id, x => (x.status === 'freigabe' ? { ...x, status: 'abgelehnt', entschieden: { am: jetzt, von: person, art: 'abgelehnt', ...(v.grund ? { grund: v.grund.slice(0, 400) } : {}) } } : x));
  },
};

/** Freigabe „Senden“: stellen (wenn noch Entwurf), verschicken, Folgen. */
async function freigabeSenden(h: string, eingangId: string, person: string): Promise<{ ok: true; text: string } | { ok: false; status: number; fehler: string }> {
  const wer: Wer = { art: 'person', person };
  const x = (await ladeFormular(h)).eingaenge.find(y => y.id === eingangId);
  if (!x || x.status !== 'freigabe' || !x.angebotId || !x.kontaktId) return { ok: false, status: 409, fehler: 'Diese Anfrage wartet nicht (mehr) auf Freigabe.' };
  if (x.versandBegonnen && !x.versendet) {
    // Nach einem abgebrochenen Versand: der Mensch hat in „Gesendet“ geprüft und gibt bewusst noch einmal frei.
    await aendereEingang(eingangId, y => { const { versandBegonnen: _v, ...rest } = y; return rest; }, h);
  }
  const abs = await absenderPruefen((await ladeFormular(h)).einstellungen.absender);
  if (!abs.ok) return { ok: false, status: 409, fehler: abs.grund };
  let a = ((await ladeCrm()).angebote ?? []).find(y => y.id === x.angebotId);
  if (!a) return { ok: false, status: 404, fehler: 'Das Angebot gibt es nicht (mehr) — bitte ablehnen.' };
  if (a.status === 'entwurf') {
    try {
      const s = await angebotStellen({ id: a.id, stand: standVon(a), person, haushalt: h, nachfassenAm: werktagePlus(localDay(), 5), wer });
      a = s.angebot;
    } catch (err) { if (err instanceof AngebotFehler) return { ok: false, status: err.status, fehler: err.message }; throw err; }
  }
  if (a.status !== 'gestellt') return { ok: false, status: 409, fehler: `Das Angebot ist ${a.status} — nichts verschickt.` };
  await aendereEingang(eingangId, y => ({ ...y, ...(a!.nummer ? { nummer: a!.nummer } : {}) }), h);
  const r = await angebotVerschickenImAuftrag(eingangId, { ausgeloest: person });
  if (!r.ok) return r;
  await nachVersand({ angebotId: a.id, kontaktId: x.kontaktId, person, heute: localDay(), wer });
  const jetzt = new Date().toISOString();
  await aendereEingang(eingangId, y => ({ ...y, status: 'verschickt', entschieden: { am: jetzt, von: person, art: 'gesendet' } }), h);
  return { ok: true, text: `Angebot ${a.nummer} verschickt — an ${r.an} über ${r.ueber}.` };
}

// ── Links ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Produkte, die ein Link freigeben darf: aktive, aus einer Business-Gesellschaft (bzw. ohne Gesellschaft). */
function linkProdukteOk(ids: unknown, leistungen: readonly Leistung[]): string[] {
  if (!Array.isArray(ids)) throw new FormularFehler('produkte: Liste von Produkt-Kennungen.', 400);
  if (ids.length > FORMULAR_GRENZEN.linkProdukte) throw new FormularFehler(`Höchstens ${FORMULAR_GRENZEN.linkProdukte} Produkte je Link.`, 413);
  const l = [...new Set(ids.filter((x): x is string => typeof x === 'string'))];
  if (!l.length) throw new FormularFehler('Bitte mindestens ein Produkt für den Link freigeben.', 400);
  for (const id of l) {
    const p = leistungen.find(x => x.id === id);
    if (!p || !produktWaehlbar(p)) throw new FormularFehler('Ein Produkt ist nicht aktiv (mehr) — nur aktive Produkte gehen in einen Link.', 400);
    if (p.gesellschaft !== 'offen' && !istBusinessGesellschaft(p.gesellschaft)) throw new FormularFehler(`„${p.name}“ gehört nicht zu einer Business-Gesellschaft.`, 400);
  }
  return l;
}
const nameOk = (v: unknown): string => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  if (!s) throw new FormularFehler('Bitte den Namen des Vertrieblers angeben.', 400);
  if (s.length > FORMULAR_GRENZEN.name) throw new FormularFehler('Der Name ist zu lang.', 413);
  return s;
};
const emailOpt = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!s) return undefined;
  if (!mailOk(s)) throw new FormularFehler('Die Adresse des Vertrieblers ist nicht gültig.', 400);
  return s;
};
const bisOk = (v: unknown, heute: string): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new FormularFehler('Ablaufdatum: JJJJ-MM-TT.', 400);
  if (v < heute) throw new FormularFehler('Das Ablaufdatum liegt in der Vergangenheit.', 400);
  return v;
};
const neuerLinkSlug = (vorsatz: string) => `${vorsatz}-${randomBytes(12).toString('hex')}`;

/** Einen externen Link anlegen — der ganze Link steht NUR in dieser Antwort (gespeichert ist sein Fingerabdruck). Nur Inhaber (die Route prüft). */
export async function linkAnlegen(roh: Record<string, unknown>, person: string): Promise<{ link: ExternerLink; pfad: string }> {
  const heute = localDay();
  const crm = await ladeCrm();
  const name = nameOk(roh.name);
  const vorsatz = linkVorsatz(name);
  const slug = neuerLinkSlug(vorsatz);
  const email = emailOpt(roh.email);
  const bis = bisOk(roh.bis, heute);
  const link: ExternerLink = { id: neueKennung('fl'), name, ...(email ? { email } : {}), vorsatz, tokenHash: linkTokenHash(slug), produkte: linkProdukteOk(roh.produkte, crm.leistungen), ...(bis ? { bis } : {}), angelegt: new Date().toISOString(), angelegtVon: person };
  await aendereFormular(b => ({ ...b, links: [...b.links, link] }));
  return { link, pfad: ANGEBOT_SEITE(slug) };
}

/** Link ändern (Name, Adresse, Produkte, Ablauf), widerrufen oder erneuern (neuer Link, der alte gilt nicht mehr — einmal gezeigt). */
export async function linkAendern(id: unknown, aktion: 'aendern' | 'widerrufen' | 'erneuern' | 'entfernen', roh: Record<string, unknown> = {}): Promise<{ link?: ExternerLink; pfad?: string }> {
  if (typeof id !== 'string' || !/^fl-[a-z0-9-]{4,60}$/.test(id)) throw new FormularFehler('Link-Kennung fehlt.', 400);
  const heute = localDay();
  const leistungen = aktion === 'aendern' && 'produkte' in roh ? (await ladeCrm()).leistungen : [];
  let raus: { link?: ExternerLink; pfad?: string } = {};
  await aendereFormular(b => {
    const alt = b.links.find(l => l.id === id);
    if (!alt) throw new FormularFehler('Diesen Link gibt es nicht.', 404);
    if (aktion === 'entfernen') {
      if (!alt.widerrufenAm && linkLage(alt, heute) === 'aktiv') throw new FormularFehler('Erst widerrufen, dann entfernen.', 409);
      return { ...b, links: b.links.filter(l => l.id !== id) };
    }
    let neu: ExternerLink = alt;
    if (aktion === 'widerrufen') neu = alt.widerrufenAm ? alt : { ...alt, widerrufenAm: new Date().toISOString() };
    if (aktion === 'erneuern') {
      if (alt.widerrufenAm) throw new FormularFehler('Ein widerrufener Link wird nicht erneuert — bitte einen neuen anlegen.', 409);
      const slug = neuerLinkSlug(alt.vorsatz);
      neu = { ...alt, tokenHash: linkTokenHash(slug), erneuertAm: new Date().toISOString() };
      raus = { pfad: ANGEBOT_SEITE(slug) };
    }
    if (aktion === 'aendern') {
      const email = 'email' in roh ? emailOpt(roh.email) : alt.email;
      const bis = 'bis' in roh ? bisOk(roh.bis, heute) : alt.bis;
      const { email: _e, bis: _b, ...ohne } = alt;
      neu = { ...ohne, ...('name' in roh ? { name: nameOk(roh.name) } : {}), ...(email ? { email } : {}), ...(bis ? { bis } : {}), ...('produkte' in roh ? { produkte: linkProdukteOk(roh.produkte, leistungen) } : {}) };
    }
    raus = { ...raus, link: neu };
    return { ...b, links: b.links.map(l => (l.id === id ? neu : l)) };
  });
  return raus;
}

/** Der aktive Link zu einer Adresse (sonst null — unbekannt, widerrufen, abgelaufen sehen von außen gleich aus). */
export async function aktiverLink(slug: string): Promise<ExternerLink | null> {
  const l = linkZuSlug((await ladeFormular()).links, slug);
  return l && linkLage(l, localDay()) === 'aktiv' ? l : null;
}

/** Was die öffentliche Seite eines Links zeigt: nur die freigegebenen, aktiven Produkte (Katalog-Form) — nie Bestandsdaten. */
export async function linkKatalog(l: ExternerLink): Promise<KatalogProdukt[]> {
  const crm = await ladeCrm();
  return l.produkte.map(id => crm.leistungen.find(x => x.id === id)).filter((x): x is Leistung => !!x && produktWaehlbar(x)).map(katalogProdukt);
}

/** Der interne Katalog (Formular des Teams): alle aktiven Produkte aus Business-Gesellschaften (bzw. ohne Gesellschaft). */
export async function internerKatalog(): Promise<KatalogProdukt[]> {
  const crm = await ladeCrm();
  return crm.leistungen.filter(l => produktWaehlbar(l) && (l.gesellschaft === 'offen' || istBusinessGesellschaft(l.gesellschaft))).map(katalogProdukt);
}

// ── Einstellungen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Einstellungen speichern (nur Inhaber — die Route prüft): Absender = ein EIGENES Postfach der Person mit Business-Bereich (sonst 400), Vorlage
 * (Betreff/Text, Grenzen → 413). `absender: null` nimmt den Absender weg (dann geht nichts automatisch raus).
 */
export async function einstellungenSpeichern(roh: Record<string, unknown>, person: string): Promise<FormularEinstellungen> {
  let absender: FormularEinstellungen['absender'] | null | undefined;
  if ('absender' in roh) {
    if (roh.absender === null) absender = null;
    else {
      const pf = typeof roh.absender === 'string' ? roh.absender : '';
      const kandidat = { person, postfach: pf, gesetztAm: new Date().toISOString() };
      const ok = await absenderPruefen(kandidat);
      if (!ok.ok) throw new FormularFehler(ok.grund, 400);
      absender = kandidat;
    }
  }
  const text = (v: unknown, n: number, feld: string): string | undefined => {
    const s = typeof v === 'string' ? v.replace(/\u0000/g, '').trim() : '';
    if (s.length > n) throw new FormularFehler(`${feld} ist zu lang (höchstens ${n} Zeichen) — nichts gespeichert.`, 413);
    return s || undefined;
  };
  const betreff = 'betreff' in roh ? text(roh.betreff, FORMULAR_GRENZEN.betreff, 'Betreff') : undefined;
  const mailText = 'text' in roh ? text(roh.text, FORMULAR_GRENZEN.text, 'Text') : undefined;
  const b = await aendereFormular(x => {
    const alt = x.einstellungen;
    const { absender: _a, betreff: _b, text: _t, ...rest } = alt;
    const neu: FormularEinstellungen = {
      ...rest,
      ...(absender === undefined ? (alt.absender ? { absender: alt.absender } : {}) : absender ? { absender } : {}),
      ...('betreff' in roh ? (betreff ? { betreff } : {}) : alt.betreff ? { betreff: alt.betreff } : {}),
      ...('text' in roh ? (mailText ? { text: mailText } : {}) : alt.text ? { text: alt.text } : {}),
      geaendert: new Date().toISOString(), geaendertVon: person,
    };
    return { ...x, einstellungen: neu };
  });
  return b.einstellungen;
}
