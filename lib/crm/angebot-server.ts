// ─── Markttraktion · Angebote — Schreibwege (nur Server, 28.09.) ─────────────
// Die EINE Stelle, die `crm.angebote` schreibt (Route /api/crm/angebot):
//   speichern   Entwurf anlegen/ändern — Stand/409, Grenzen 413, nur Entwurfsfelder
//   stellen     festschreiben: Nummer lückenlos je Gesellschaft (in der Sperre des
//               CRM-Bestands), PDF (pdf-lib) + SHA-256 in die Dateiablage (verschlüsselt,
//               Bezug Kontakt/Firma/Deal/Angebot), Deal auf „Angebot“ (vorhanden oder neu
//               über `dealAnlegen`), Follow-up „Angebot nachfassen“, Aktivität am Kontakt,
//               Lifecycle gehoben (nur eine gesetzte Phase), Vorgänger → „ersetzt“
//   annehmen    Deal gewonnen (Regel `wechsleStufe`), Follow-up erledigt — Mandat danach über
//               den bestehenden Weg (/api/crm/lead aktion „mandat“, vorbelegt aus dem Angebot)
//   ablehnen    Grund Pflicht, Deal verloren mit Grund, Follow-up abgesagt
//   version     neue Fassung als Entwurf mit Bezug (alte bleibt lesbar)
//   loeschen    nur Entwürfe, und nur aus dem Papierkorb (04.10., „sicher statt endgültig“)
//   ablage      Archiv (jeder Status) und Papierkorb (nur Entwürfe) — hinein/zurück, Marke = Server-Zeit (04.10.)
//   ablauf      gestellt → abgelaufen nach „gültig bis“ (beim Lesen und täglich im Morgenlauf) + Follow-up-Hinweis
// Kanal-Ampel vor dem Stellen: Werbesperre/Einschränkung (Art. 18/21) blockt mit Grund —
// sonst ist ein angefragtes Angebot Vertragsanbahnung (Art. 6 Abs. 1 lit. b), gelb = Hinweis.

import { createHash } from 'crypto';
import { loadJson } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { localDay, tagVon, tagePlus } from '@/lib/zeit';
import { wendeAktivitaetAn, STUFEN as KONTAKT_STUFEN, type Kontakt } from '@/lib/make-one/crm';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { Angebot, Chance, CrmBestand, FollowUp } from './typen';
import { ladeCrm, aendereCrm, aendereCrmAsync } from './speicher';
import { standVon } from './crm-stand';
import { OFFENE_STUFEN, STUFEN, wechsleStufe } from './pipeline';
import { dealAnlegen } from './deal-anlegen';
import { wer, BEIDE, verantwortlich } from './team';
import { phaseHeben } from './lifecycle';
import { kanalStatus } from './recht';
import {
  ablaufen, ablaufFollowUps, angebotGrenzen, angebotSummen, angebotVermerkKopf, dealWertAusAngebot, entwurfSaeubern, istEntwurf, mailVorlage, naechsteLaufnummer, nummerAusFormat,
  stellenFehlt, SUMME_NULL, tagOk, werktagePlus, NACHFASSEN_WERKTAGE, ANGEBOT_GRENZEN, plusTage, istGesellschaft,
} from './angebote';
import { alleGesellschaften, gesellschaftenName, gesellschaftLuecken, mitVorgaben, type Gesellschaft, type GesellschaftenDatei } from './gesellschaften';
import { WEG } from '@/lib/wege';
import { absenderVorgabe } from '@/lib/gesellschaften/server';
import { absenderAus, empfaengerAus, angebotDokument } from './angebot-dokument';
import { angebotPdf, type PdfLogo } from './angebot-pdf';
import { ablegen, lesen } from '@/lib/dateien/ablage';
import { neueKennung } from '@/lib/kennung';

export class AngebotFehler extends Error {
  constructor(msg: string, readonly status: number, readonly extra: Record<string, unknown> = {}) { super(msg); }
}

export const mitStand = (a: Angebot) => ({ ...a, stand: standVon(a) });
const neueAngebotId = () => neueKennung('ang');
const jahrVon = (tag: string) => Number(tag.slice(0, 4));
const zustaendigAus = (person: string) => (wer(person) && wer(person) !== BEIDE ? person : verantwortlich('sales'));

export async function gesellschaftenLaden(haushalt: string | null | undefined): Promise<Gesellschaft[]> {
  if (!haushalt) return alleGesellschaften(null);
  return alleGesellschaften(await loadJson<GesellschaftenDatei>(gesellschaftenName(haushalt)));
}

/** Stand prüfen: fehlt er bei einem bestehenden Eintrag oder passt er nicht → 409 mit dem aktuellen Angebot. */
function standPruefen(a: Angebot, stand: unknown) {
  if (typeof stand !== 'string' || !stand) throw new AngebotFehler('Stand fehlt — ohne Stand wird ein bestehendes Angebot nicht geändert.', 409, { aktuell: mitStand(a), grund: 'ohne Stand' });
  if (standVon(a) !== stand) throw new AngebotFehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal.', 409, { aktuell: mitStand(a), grund: 'inzwischen geändert' });
}

// ── Entwurf ──────────────────────────────────────────────────────────────────

export async function angebotSpeichern(p: { id?: unknown; felder: Record<string, unknown>; stand?: unknown; person: string; haushalt?: string | null; wer?: Wer; jetzt?: Date }): Promise<Angebot> {
  const zuLang = angebotGrenzen(p.felder);
  if (zuLang.length) throw new AngebotFehler(zuLang.join(' · '), 413);
  const jetzt = p.jetzt ?? new Date();
  const heute = localDay(jetzt);
  // Ohne Absender im Körper (z. B. der Entwurf aus „Netzwerken“) gilt für einen NEUEN Entwurf die operative Business-Gesellschaft des Registers
  // (08.10., Sofort-Paket 3.2) — nicht mehr still die Selbstständigkeit. Ein bestehender Entwurf behält seinen Absender.
  const vorgabe = istGesellschaft(p.felder.gesellschaft) ? null : await absenderVorgabe(p.haushalt);
  const gesId = istGesellschaft(p.felder.gesellschaft) ? p.felder.gesellschaft : vorgabe;
  const g = gesId ? (await gesellschaftenLaden(p.haushalt)).find(x => x.id === gesId) : undefined;
  const v = g ? mitVorgaben(g) : null;
  const id = typeof p.id === 'string' && /^ang-[a-z0-9-]{4,60}$/.test(p.id) ? p.id : neueAngebotId();
  let ergebnis: Angebot | null = null;
  let fehler: AngebotFehler | null = null;
  await aendereCrm(b => {
    const liste = b.angebote ?? [];
    const alt = liste.find(a => a.id === id) ?? null;
    try {
      if (alt) {
        if (!istEntwurf(alt)) throw new AngebotFehler(`Angebot ${alt.nummer ?? ''} ist gestellt und festgeschrieben — Änderungen nur als neue Version.`.replace('  ', ' '), 409, { aktuell: mitStand(alt), grund: 'gestellt' });
        standPruefen(alt, p.stand);
      }
      const neu = entwurfSaeubern(p.felder, alt, { id, jetzt: jetzt.toISOString(), person: p.person, heute, ...(vorgabe ? { gesellschaftVorgabe: vorgabe } : {}), ...(v ? { gueltigTage: v.gueltigkeitTage, zielTage: v.zahlungszielTage } : {}) });
      ergebnis = neu;
      return { ...b, angebote: alt ? liste.map(a => (a.id === id ? neu : a)) : [...liste, neu] };
    } catch (e) { fehler = e as AngebotFehler; return b; }
  }, p.wer);
  if (fehler) throw fehler;
  return ergebnis!;
}

export async function angebotLoeschen(p: { id: string; stand?: unknown; wer?: Wer }): Promise<void> {
  let fehler: AngebotFehler | null = null;
  let gab = false;
  await aendereCrm(b => {
    const a = (b.angebote ?? []).find(x => x.id === p.id);
    if (!a) return b;
    gab = true;
    try {
      if (!istEntwurf(a)) throw new AngebotFehler('Gestellte Angebote werden nicht gelöscht (Geschäftsunterlage) — ablehnen oder neue Version.', 409, { aktuell: mitStand(a) });
      // Sicher statt endgültig (04.10.): erst in den Papierkorb (`angebotAblage`), endgültig nur von dort.
      if (!a.geloeschtAm) throw new AngebotFehler(`„${a.titel || 'Entwurf'}“ liegt nicht im Papierkorb — Löschen legt einen Entwurf erst in den Papierkorb (30 Tage wiederherstellbar), endgültig nur von dort.`, 409, { aktuell: mitStand(a) });
      standPruefen(a, p.stand);
      return { ...b, angebote: b.angebote.filter(x => x.id !== p.id) };
    } catch (e) { fehler = e as AngebotFehler; return b; }
  }, p.wer);
  if (fehler) throw fehler;
  if (!gab) throw new AngebotFehler('Angebot nicht gefunden.', 404);
}

/**
 * Archiv & Papierkorb eines Angebots (04.10., Kevin: „alles anpassbar“): `archiv` blendet jedes Angebot aus der Liste aus
 * (zurückholbar); `papierkorb` nur Entwürfe — ein gestelltes Angebot ist eine Geschäftsunterlage (Nummer, PDF) und bleibt.
 * Die Marke setzt der Server (jetzt); `zurueck` nimmt sie weg. Kein Stand nötig: die Marke ändert keinen Inhalt.
 */
export async function angebotAblage(p: { id: string; art: 'archiv' | 'papierkorb'; zurueck?: boolean; wer?: Wer; jetzt?: Date }): Promise<Angebot> {
  let fehler: AngebotFehler | null = null;
  let ergebnis: Angebot | null = null;
  const jetzt = (p.jetzt ?? new Date()).toISOString();
  const feld = p.art === 'archiv' ? 'archiviertAm' : 'geloeschtAm';
  await aendereCrm(b => {
    const a = (b.angebote ?? []).find(x => x.id === p.id);
    try {
      if (!a) throw new AngebotFehler('Angebot nicht gefunden.', 404);
      if (p.art === 'papierkorb' && !p.zurueck && !istEntwurf(a)) throw new AngebotFehler('Gestellte Angebote kommen nicht in den Papierkorb (Geschäftsunterlage) — archivieren blendet sie aus der Liste aus.', 409, { aktuell: mitStand(a) });
      const neu: Angebot = p.zurueck ? (({ [feld]: _weg, ...rest }) => rest as Angebot)(a) : { ...a, [feld]: a[feld] ?? jetzt };
      ergebnis = neu;
      return neu === a ? b : { ...b, angebote: b.angebote.map(x => (x.id === a.id ? neu : x)) };
    } catch (e) { fehler = e as AngebotFehler; return b; }
  }, p.wer);
  if (fehler) throw fehler;
  return ergebnis!;
}

/** Neue Version: Entwurf mit Bezug auf das gestellte Angebot. Gibt es schon einen offenen Nachfolge-Entwurf, kommt der zurück. */
export async function angebotVersion(p: { id: string; person: string; haushalt?: string | null; wer?: Wer; jetzt?: Date }): Promise<Angebot> {
  const jetzt = p.jetzt ?? new Date();
  const heute = localDay(jetzt);
  const gs = await gesellschaftenLaden(p.haushalt);
  let ergebnis: Angebot | null = null;
  let fehler: AngebotFehler | null = null;
  await aendereCrm(b => {
    const liste = b.angebote ?? [];
    const a = liste.find(x => x.id === p.id);
    if (!a) { fehler = new AngebotFehler('Angebot nicht gefunden.', 404); return b; }
    if (istEntwurf(a)) { fehler = new AngebotFehler('Ein Entwurf wird direkt geändert — keine neue Version nötig.', 409, { aktuell: mitStand(a) }); return b; }
    if (a.status === 'ersetzt' || a.status === 'angenommen') { fehler = new AngebotFehler(a.status === 'ersetzt' ? 'Dieses Angebot ist schon ersetzt — die neuere Version ändern.' : 'Angenommene Angebote bleiben, wie sie sind.', 409, { aktuell: mitStand(a) }); return b; }
    const offen = liste.find(x => x.vorgaengerId === a.id && istEntwurf(x));
    if (offen) { ergebnis = offen; return b; }
    const v = mitVorgaben(gs.find(g => g.id === a.gesellschaft) ?? { id: a.gesellschaft });
    const neu: Angebot = {
      id: neueAngebotId(), gesellschaft: a.gesellschaft, ...(a.kontaktId ? { kontaktId: a.kontaktId } : {}), ...(a.firmaId ? { firmaId: a.firmaId } : {}),
      ...(a.dealId ? { dealId: a.dealId } : {}), ...(a.mandatId ? { mandatId: a.mandatId } : {}), titel: a.titel, positionen: a.positionen.map(x => ({ ...x })),
      einleitung: a.einleitung, schluss: a.schluss, gueltigBis: plusTage(heute, v.gueltigkeitTage), zahlungszielTage: a.zahlungszielTage,
      status: 'entwurf', version: (a.version || 1) + 1, vorgaengerId: a.id, angelegt: jetzt.toISOString(), angelegtVon: p.person, geaendert: jetzt.toISOString(), geaendertVon: p.person,
    };
    ergebnis = neu;
    return { ...b, angebote: [...liste, neu] };
  }, p.wer);
  if (fehler) throw fehler;
  return ergebnis!;
}

// ── Ablauf ───────────────────────────────────────────────────────────────────

/**
 * Gestellte Angebote nach „gültig bis“ → abgelaufen (Status-Übergang serverseitig). Schreibt nur, wenn es etwas gibt.
 * Läuft beim Lesen (GET bestand/angebot) UND einmal am Tag im Morgenlauf (app/api/tagesstart, 28.09.) — wer zuerst
 * kommt, zieht nach. In derselben Sperre der Follow-up-Hinweis „Angebot abgelaufen — nachfassen oder Version 2“
 * (`ablaufFollowUps`, einmal je Angebot; nicht für eingeschränkte Personen, Art. 18).
 */
export async function ablaufNachziehen(jetzt = new Date()): Promise<number> {
  const heute = localDay(jetzt);
  const jetztIso = jetzt.toISOString();
  const vorher = ablaufen((await ladeCrm()).angebote ?? [], heute, jetztIso);
  if (!vorher.ids.length) return 0;
  const gesperrt = new Set(((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).filter(k => k.eingeschraenkt).map(k => k.id));
  let n = 0;
  await aendereCrm(b => {
    const r = ablaufen(b.angebote ?? [], heute, jetztIso);
    n = r.ids.length;
    if (!n) return b;
    const neu = new Set(r.ids);
    const deals = new Map(b.chancen.map(c => [c.id, c]));
    const followups = ablaufFollowUps(b.followups ?? [], r.liste.filter(a => neu.has(a.id)), {
      heute, jetzt: jetztIso, ausgenommen: id => gesperrt.has(id),
      zustaendig: a => zustaendigAus((a.dealId ? deals.get(a.dealId)?.besitzer : undefined) ?? a.gestelltVon ?? ''),
    });
    return { ...b, angebote: r.liste, followups };
  }, { art: 'system' });
  return n;
}

// ── Stellen ──────────────────────────────────────────────────────────────────

export interface StellenErgebnis {
  angebot: Angebot & { stand: string };
  pdf: { id: string; name: string };
  mail: { an?: string; betreff: string; text: string };
  dealId?: string;
  hinweise: string[];
}

/** Kontext der Kanal-Ampel für eine Person (Mandat aktiv, Deal offen). */
const ampelKontext = (b: Pick<CrmBestand, 'mandate' | 'chancen'>, id: string) => ({ hatMandat: b.mandate.some(m => m.status === 'aktiv' && m.kontaktIds.includes(id)), hatChance: b.chancen.some(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(id)) });

/** Kanal-Ampel vor dem Stellen: rot durch Werbesperre/Einschränkung blockt (mit Grund), sonst Hinweise. Rein. */
export function ampelVorStellen(k: Kontakt, ctx: { hatMandat?: boolean; hatChance?: boolean }): { sperre?: string; hinweise: string[] } {
  if (k.eingeschraenkt || k.werbesperre) return { sperre: kanalStatus(k, 'mail', ctx).grund, hinweise: [] };
  const s = kanalStatus(k, 'mail', ctx);
  if (s.grund === 'keine Adresse') return { hinweise: ['Keine E-Mail-Adresse am Kontakt — das PDF entsteht trotzdem; bitte auf anderem Weg senden.'] };
  if (s.farbe === 'gruen') return { hinweise: [] };
  return { hinweise: [`Kanal-Ampel ${s.farbe}: ${s.grund}. Ein angefragtes Angebot ist Vertragsanbahnung (Art. 6 Abs. 1 lit. b DSGVO) — nur senden, wenn es angefragt wurde, ohne Werbung.`] };
}

const STUFE_RANG = (s: Chance['stufe']) => STUFEN.findIndex(x => x.id === s);

export async function angebotStellen(p: { id: string; stand?: unknown; person: string; haushalt: string; nachfassenAm?: unknown; wer?: Wer; jetzt?: Date }): Promise<StellenErgebnis> {
  const jetzt = p.jetzt ?? new Date();
  const jetztIso = jetzt.toISOString();
  const heute = localDay(jetzt);
  const nachfassen = tagOk(p.nachfassenAm) && p.nachfassenAm >= heute ? p.nachfassenAm : werktagePlus(heute, NACHFASSEN_WERKTAGE);

  // 1. Vorprüfung (ohne Sperre) — Stand, Entwurf, Pflichtfelder, Empfänger, Ampel, Absender.
  const vor = await ladeCrm();
  const a0 = (vor.angebote ?? []).find(x => x.id === p.id);
  if (!a0) throw new AngebotFehler('Angebot nicht gefunden.', 404);
  if (!istEntwurf(a0)) throw new AngebotFehler(`Schon gestellt (${a0.nummer ?? a0.status}).`, 409, { aktuell: mitStand(a0), grund: 'gestellt' });
  standPruefen(a0, p.stand);
  const fehlt = stellenFehlt(a0, heute);
  // 3.12 (08.10.): Summe 0 € → 409 (Konflikt mit dem Inhalt, nichts fehlt im Formular) — sonst wäre eine feste Nummer verbraucht.
  if (fehlt.length) throw new AngebotFehler(fehlt.join(' '), fehlt.includes(SUMME_NULL) ? 409 : 400, { fehlt, ...(fehlt.includes(SUMME_NULL) ? { grund: 'summe-null' } : {}) });
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const k = kontakte.find(x => x.id === a0.kontaktId);
  if (!k) throw new AngebotFehler('Der Empfänger steht nicht (mehr) in der Kartei.', 400);
  const ampel = ampelVorStellen(k, ampelKontext(vor, k.id));
  if (ampel.sperre) throw new AngebotFehler(`Nicht gesendet: ${ampel.sperre}. Ein Angebot geht an diese Person nicht hinaus.`, 409, { ampel: 'rot', grund: ampel.sperre });
  const g = (await gesellschaftenLaden(p.haushalt)).find(x => x.id === a0.gesellschaft) ?? { id: a0.gesellschaft };
  const luecken = gesellschaftLuecken(g);
  // Weg zum Absender (08.10., Sofort-Paket 3.1): Unternehmen › <Gesellschaft> › Absender — „Stammdaten › Gesellschaften“ gibt es nicht mehr.
  const absenderWeg = WEG.unternehmen(g.id, 'absender');
  const absenderOrt = `Unternehmen › ${mitVorgaben(g).name} › Absender`;
  if (luecken.includes('Firmierung') || luecken.includes('Anschrift')) throw new AngebotFehler(`Absender unvollständig — erst unter ${absenderOrt} ergänzen: ${luecken.filter(x => x === 'Firmierung' || x === 'Anschrift').join(', ')}.`, 409, { luecken, weg: absenderWeg });
  const v = mitVorgaben(g);
  let logo: PdfLogo | null = null;
  if (g.logoDateiId) {
    const d = await lesen(p.haushalt, g.logoDateiId).catch(() => null);
    if (d && (d.eintrag.datei?.typ === 'image/png' || d.eintrag.datei?.typ === 'image/jpeg')) logo = { bytes: new Uint8Array(d.bytes), typ: d.eintrag.datei.typ };
  }
  const hinweise = [...ampel.hinweise, ...luecken.filter(x => x !== 'Firmierung' && x !== 'Anschrift').map(x => `Absender: ${x} fehlt (${absenderOrt}).`)];

  // 2. Deal: vorhanden (am Angebot, sonst offener der Person/Firma) oder neu über den EINEN Weg (`dealAnlegen`).
  //    Nur ein OFFENER Deal wird übernommen (08.10., Woche 1 · 3.3 Folgeauftrag): ein gewonnener, verlorener oder geparkter Deal am
  //    Entwurf zählt nicht — sonst meldete „Angenommen“ den alten Deal als gewonnen, und „Mandat anlegen“ scheiterte.
  const firmaId = a0.firmaId ?? k.firmaId;
  let dealId = a0.dealId && vor.chancen.some(c => c.id === a0.dealId && OFFENE_STUFEN.includes(c.stufe)) ? a0.dealId : undefined;
  if (!dealId) dealId = vor.chancen.find(c => OFFENE_STUFEN.includes(c.stufe) && (c.kontaktIds.includes(k.id) || (!!firmaId && c.firmaId === firmaId)))?.id;
  if (!dealId) {
    const r = await dealAnlegen({
      titel: a0.titel, kontaktIds: [k.id], ...(firmaId ? { firmaId } : {}), wert: dealWertAusAngebot(a0), stufe: 'angebot', gesellschaft: a0.gesellschaft,
      ...(a0.positionen.find(x => x.leistungId)?.leistungId ? { leistungId: a0.positionen.find(x => x.leistungId)!.leistungId } : {}),
      schritt: { text: 'Angebot nachfassen', datum: nachfassen },
    }, p.person, jetztIso, p.wer);
    if (r.ok) dealId = r.chance.id; else if (r.offen) dealId = r.offen.id;
    else hinweise.push(`Kein Deal angelegt: ${r.fehler}`);
  }

  // 3. Stellen in drei Schritten (29.09., Paket D-A #13) — die PDF-Erzeugung (pdf-lib, Logo, SHA-256, Datei-E/A)
  //    läuft NICHT mehr in der CRM-Sperre; auf 1 vCPU blockierte sie sonst jede CRM-Schreibung (Deals, Follow-ups, ZOE).
  //    a) In der Sperre: erneut prüfen und die laufende Nummer RESERVIEREN (`lauf` am Entwurf — naechsteLaufnummer zählt
  //       sie mit, nie doppelt vergeben; ein Wiederholungsversuch nach einem Abbruch nimmt dieselbe Nummer, keine Lücke).
  //    b) Außerhalb: PDF erzeugen, Prüfsumme.
  //    c) In der Sperre: Festschreiben nur, wenn der Entwurf noch genau der reservierte ist (Stand-Prüfung) — dann PDF
  //       ablegen (kurz: verschlüsseln + fsync) und stellen; sonst Reservierung lösen, 409, nichts abgelegt.
  const jahr = jahrVon(heute);
  let res: { a: Angebot; nummer: string; stand: string; firma?: CrmBestand['firmen'][number] } | null = null;
  await aendereCrmAsync(async b => {
    const liste = b.angebote ?? [];
    const a = liste.find(x => x.id === p.id);
    if (!a) throw new AngebotFehler('Angebot nicht gefunden.', 404);
    if (!istEntwurf(a)) throw new AngebotFehler(`Schon gestellt (${a.nummer ?? a.status}).`, 409, { aktuell: mitStand(a), grund: 'gestellt' });
    standPruefen(a, p.stand);
    const andere = liste.filter(x => x.id !== a.id);
    const belegt = (nr: number, nummer: string) => andere.some(x => x.nummer === nummer || (x.gesellschaft === a.gesellschaft && x.lauf?.jahr === jahr && x.lauf.nr === nr));
    let nr = a.lauf?.jahr === jahr ? a.lauf.nr : naechsteLaufnummer(andere, a.gesellschaft, jahr);
    let nummer = nummerAusFormat(v.nummernformat, v.kurz, jahr, nr);
    // Nie doppelt (z. B. nach einer Formatänderung): weiterzählen, bis die Nummer frei ist.
    while (belegt(nr, nummer)) { nr++; nummer = nummerAusFormat(v.nummernformat, v.kurz, jahr, nr); }
    const reserviert: Angebot = { ...a, lauf: { jahr, nr } };
    res = { a: reserviert, nummer, stand: standVon(reserviert), firma: firmaId ? b.firmen.find(f => f.id === firmaId) : undefined };
    return a.lauf?.jahr === jahr && a.lauf.nr === nr ? b : { ...b, angebote: liste.map(x => (x.id === a.id ? reserviert : x)) };
  }, p.wer);
  const r0 = res as { a: Angebot; nummer: string; stand: string; firma?: CrmBestand['firmen'][number] } | null;
  if (!r0) throw new AngebotFehler('Nicht gestellt.', 500);
  const { nummer } = r0;
  /** Reservierung lösen, wenn sie noch unverändert am Entwurf hängt (nach einem Fehlschlag in b/c). */
  const reservierungLoesen = () => aendereCrm(b => {
    const x = (b.angebote ?? []).find(y => y.id === p.id);
    if (!x || !istEntwurf(x) || standVon(x) !== r0.stand) return b;
    const { lauf: _lauf, ...ohne } = x;
    return { ...b, angebote: (b.angebote ?? []).map(y => (y.id === p.id ? ohne as Angebot : y)) };
  }, p.wer).catch(() => { /* bleibt reserviert — der nächste Versuch nimmt dieselbe Nummer */ });

  const empfaenger = empfaengerAus(k, r0.firma);
  // Ein geschlossener Deal am Entwurf (3.3) fällt weg, wenn kein offener an seine Stelle trat.
  const { dealId: _alterDeal, ...ohneDeal } = r0.a;
  const gestellt: Angebot = {
    ...ohneDeal, nummer, ...(firmaId ? { firmaId } : {}), ...(dealId ? { dealId } : {}), status: 'gestellt', gestelltAm: jetztIso, gestelltVon: p.person,
    absender: absenderAus(g), empfaenger, geaendert: jetztIso, geaendertVon: p.person,
  };
  // b) Außerhalb der Sperre: das PDF (pdf-lib, Logo) und seine Prüfsumme — der teure Teil.
  const name = `Angebot ${nummer}.pdf`.replace(/[\\/]/g, '-');
  let bytes: Buffer;
  try { bytes = Buffer.from(await angebotPdf(angebotDokument(gestellt, absenderAus(g, { ibanVoll: true }), empfaenger, heute), { logo, erstellt: jetzt })); }
  catch (err) { await reservierungLoesen(); throw err; }
  const pruefsumme = createHash('sha256').update(bytes).digest('hex');
  const brutto = angebotSummen(gestellt, { kleinunternehmer: !!gestellt.absender?.kleinunternehmer }).gesamt.brutto / 100;

  let ergebnis: { a: Angebot; pdf: { id: string; name: string } } | null = null;
  let geaendert = false;
  // Absichtsprotokoll (29.09., Paket D-C #17): festschreiben (CRM + Ablage in EINER Sperre) und danach die Aktivität am
  // Kontakt sind zwei Bestände. Bricht der Lauf dazwischen ab, fehlte der Kontakt-Vermerk; scheitert das CRM-Schreiben
  // nach dem Ablegen, bliebe ein verwaistes Angebots-PDF (Beleg, nicht löschbar). Die Wiederaufnahme
  // (`angebotFortsetzen`) holt den Vermerk nach bzw. räumt das verwaiste PDF weg.
  const { karteiHaushalt } = await import('./sperrliste');
  const { absichtBeginnen, absichtAbschliessen, mitVorgang } = await import('@/lib/store/absichten');
  const ah = await karteiHaushalt();
  const { absicht } = await absichtBeginnen(ah, {
    art: 'angebot-stellen', schluessel: p.id, schritte: ANGEBOT_SCHRITTE, person: p.person,
    daten: { angebotId: p.id, kontaktId: k.id, nummer, ...(dealId ? { dealId } : {}), nachfassen, heute, jetzt: jetztIso, person: p.person, haushalt: p.haushalt },
  });
  const festschreiben = () => aendereCrmAsync(async b => {
    const liste = b.angebote ?? [];
    const a = liste.find(x => x.id === p.id);
    // Zwischen Reservierung und Festschreiben geändert (anderes Fenster, zweites „Stellen“)? Dann nichts festschreiben.
    if (!a || !istEntwurf(a) || standVon(a) !== r0.stand) { geaendert = true; return b; }
    // Erst jetzt ablegen (Stand passt): ein Angebots-PDF ist ein Beleg und wäre danach nicht mehr löschbar.
    const datei = await ablegen(p.haushalt, p.person, {
      art: 'angebot', titel: `Angebot ${nummer} – ${r0.a.titel}`.slice(0, 160), kontaktId: k.id, ...(firmaId ? { firmaId } : {}), ...(dealId ? { dealId } : {}),
      angebot: { nummer, datum: heute, betrag: brutto, status: 'offen', gueltigBis: r0.a.gueltigBis },
    }, { bytes, name, typ: 'application/pdf' }, jetztIso, { angebotId: r0.a.id });
    const fertig: Angebot = { ...gestellt, pruefsumme, pdfDateiId: datei.id };
    ergebnis = { a: fertig, pdf: { id: datei.id, name } };

    // Vorgänger ersetzt (neue Version gestellt) — nur der Status-Link, der Inhalt bleibt.
    let angebote = liste.map(x => (x.id === a.id ? fertig : x));
    if (a.vorgaengerId) angebote = angebote.map(x => (x.id === a.vorgaengerId && (x.status === 'gestellt' || x.status === 'abgelaufen') ? { ...x, status: 'ersetzt' as const, nachfolgerId: a.id, geaendert: jetztIso, geaendertVon: p.person } : x));

    // Deal auf Stufe „Angebot“ (nie zurück), Wert aus dem Angebot, nächster Schritt = Nachfassen.
    const text = `Angebot ${nummer} nachfassen`;
    const chancen = b.chancen.map(c => {
      if (c.id !== dealId || !OFFENE_STUFEN.includes(c.stufe)) return c;
      const gehoben = STUFE_RANG(c.stufe) < STUFE_RANG('angebot') ? wechsleStufe(c, 'angebot', p.person, jetztIso) : { ok: true as const, chance: c };
      const basis = gehoben.ok ? gehoben.chance : c;
      return { ...basis, wert: dealWertAusAngebot(fertig), naechsterSchritt: { text, datum: nachfassen }, gesellschaft: basis.gesellschaft === 'offen' ? fertig.gesellschaft : basis.gesellschaft, geaendert: jetztIso, geaendertVon: p.person, letzteAktivitaet: tagVon(jetztIso) };
    });
    // Follow-up „Angebot nachfassen“ (echtes Follow-up — der virtuelle Deal-Schritt am selben Tag fällt dann weg).
    const fu: FollowUp = {
      id: `fu-${a.id}`, bezug: dealId ? { art: 'chance', id: dealId } : { art: 'kontakt', id: k.id }, kontaktId: k.id, art: 'anruf', text, faellig: nachfassen,
      zustaendig: zustaendigAus(p.person), status: 'offen', quelle: 'deal', angelegt: jetztIso, geaendert: jetztIso, geaendertVon: p.person,
    };
    const followups = [...(b.followups ?? []).filter(f => f.id !== fu.id), fu];
    return { ...b, angebote, chancen, followups };
  }, p.wer);
  let e: { a: Angebot; pdf: { id: string; name: string } } | null = null;
  try {
    await mitVorgang(ah, absicht, async v => {
      await v.schritt('festschreiben', async () => {
        await festschreiben();
        if (geaendert) throw new AngebotFehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal.', 409, { grund: 'inzwischen geändert' });
        e = ergebnis as { a: Angebot; pdf: { id: string; name: string } } | null;
        if (!e) throw new AngebotFehler('Nicht gestellt.', 500);
      });
      // 4. Kontakt: Vermerk „Angebot <Nummer> gestellt“, Stufe vorwärts, Wiedervorlage = Nachfassen, Lifecycle gehoben. „Gesendet“
      //    (die Mail, die als Kontakt zählt) erst, wenn der Mensch bestätigt, dass sie raus ist (Woche 2 · 3.15, `angebotGesendet`).
      await v.schritt('kontakt', async () => { await angebotKontaktVermerk({ art: 'gestellt', kontaktId: k.id, nummer, titel: r0.a.titel, dealId, nachfassen, heute, jetzt: jetztIso, person: p.person, wer: p.wer }); });
    });
  } catch (err) {
    if (err instanceof AngebotFehler) {
      // Festschreiben fand nicht statt (Stand geändert / nichts gestellt) → Reservierung lösen, Absicht verfällt.
      await absichtAbschliessen(ah, absicht.id, 'verworfen');
      await reservierungLoesen();
    }
    throw err; // sonst bleibt die Absicht offen — die Wiederaufnahme holt den Rest nach
  }
  await absichtAbschliessen(ah, absicht.id, 'fertig');
  const fertig = e as { a: Angebot; pdf: { id: string; name: string } } | null;
  if (!fertig) throw new AngebotFehler('Nicht gestellt.', 500);
  const mail = mailVorlage({ anrede: k.anrede, vorname: k.vorname, nachname: k.nachname, titel: fertig.a.titel, nummer: fertig.a.nummer, gueltigBis: fertig.a.gueltigBis, absender: v.name });
  return { angebot: mitStand(fertig.a), pdf: fertig.pdf, mail: { ...(k.email ? { an: k.email } : {}), ...mail }, ...(dealId ? { dealId } : {}), hinweise };
}

export const ANGEBOT_SCHRITTE = ['festschreiben', 'kontakt'] as const;

/**
 * Vermerk am Kontakt — idempotent je Nummer und Art (die Wiederaufnahme darf ihn nicht doppelt anlegen):
 *   gestellt  beim Stellen: Notiz „Angebot <Nummer> gestellt“ (zählt NICHT als Kontakt), Stufe nur vorwärts, Wiedervorlage = Nachfassen,
 *             Lifecycle gehoben.
 *   gesendet  erst auf Bestätigung „Mail ist raus“ (08.10., Woche 2 · 3.15 — vorher entstand die Mail-Aktivität beim Stellen, auch wenn
 *             die Mail nie hinausging): Aktivität „Mail“ — die zählt als Kontakt (letzter Kontakt, Kadenz).
 */
export async function angebotKontaktVermerk(p: { art: 'gestellt' | 'gesendet'; kontaktId: string; nummer: string; titel: string; dealId?: string; nachfassen?: string; heute: string; jetzt: string; person: string; wer?: Wer }): Promise<{ schonDa: boolean }> {
  const rang = (s: Kontakt['stufe']) => KONTAKT_STUFEN.indexOf(s);
  const kopf = angebotVermerkKopf(p.nummer, p.art);
  let schonDa = false;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const x0 = f.kontakte.find(x => x.id === p.kontaktId);
    if (!x0 || x0.eingeschraenkt) return f;
    if ((x0.aktivitaeten ?? []).some(a => (a.text ?? '').startsWith(kopf))) { schonDa = true; return f; }
    return {
      ...f, kontakte: f.kontakte.map(x => {
        if (x.id !== p.kontaktId) return x;
        const stufe = rang(x.stufe) < rang('angebot') && x.stufe !== 'verloren' && x.stufe !== 'ruht' ? 'angebot' as const : undefined;
        const neu = wendeAktivitaetAn(x, { art: p.art === 'gesendet' ? 'mail' : 'notiz', text: `${kopf} — ${p.titel}`, von: p.person, ...(p.dealId ? { bezug: p.dealId } : {}), ...(stufe ? { stufe } : {}), wiedervorlage: p.nachfassen ?? x.wiedervorlage }, p.heute, p.jetzt, tagePlus);
        const phase = phaseHeben(x.phase, 'angebot');
        return phase && phase !== x.phase ? { ...neu, phase } : neu;
      }),
    };
  }, p.wer);
  return { schonDa };
}

/**
 * „Mail ist raus“ (Woche 2 · 3.15): ein gestelltes Angebot als gesendet vermerken — nur eine Person per Klick, nie der Dienstweg
 * (die Route prüft). Nur gestellte/angenommene/abgelaufene Angebote mit Nummer und Kontakt; Art. 18 → nichts.
 */
export async function angebotGesendet(p: { id: string; person: string; wer?: Wer; jetzt?: Date }): Promise<{ schonDa: boolean; nummer: string }> {
  const a = ((await ladeCrm()).angebote ?? []).find(x => x.id === p.id);
  if (!a) throw new AngebotFehler('Angebot nicht gefunden.', 404);
  if (!a.nummer || istEntwurf(a) || a.status === 'ersetzt') throw new AngebotFehler('Nur ein gestelltes Angebot lässt sich als gesendet vermerken.', 409);
  if (!a.kontaktId) throw new AngebotFehler('Das Angebot hat keinen Kontakt mehr (Personenbezug gelöst) — nichts zu vermerken.', 409);
  const jetzt = p.jetzt ?? new Date();
  const r = await angebotKontaktVermerk({ art: 'gesendet', kontaktId: a.kontaktId, nummer: a.nummer, titel: a.titel, ...(a.dealId ? { dealId: a.dealId } : {}), heute: localDay(jetzt), jetzt: jetzt.toISOString(), person: p.person, wer: p.wer });
  return { schonDa: r.schonDa, nummer: a.nummer };
}

/**
 * Wiederaufnahme „Angebot stellen“: war das Festschreiben noch nicht abgehakt, entscheidet der Bestand — ist das Angebot
 * mit der reservierten Nummer gestellt, hat es gewirkt (weiter mit dem Kontakt-Vermerk); steht es noch als Entwurf,
 * fand es nicht statt: ein beim Abbruch schon abgelegtes PDF (Beleg mit `angebotId`, nicht das `pdfDateiId` eines
 * gestellten Angebots) wird entfernt, die Absicht verfällt.
 */
export async function angebotFortsetzen(haushalt: string, a: import('@/lib/store/absichten').Absicht): Promise<void> {
  const { absichtAbschliessen, schrittAbhaken, schrittErledigt, mitVorgang } = await import('@/lib/store/absichten');
  const d = a.daten as { angebotId: string; kontaktId: string; nummer: string; dealId?: string; nachfassen: string; heute: string; jetzt: string; person: string; haushalt: string };
  const ang = ((await ladeCrm()).angebote ?? []).find(x => x.id === d.angebotId);
  if (!schrittErledigt(a, 'festschreiben')) {
    if (!ang || ang.nummer !== d.nummer || istEntwurf(ang)) {
      await verwaistePdfsEntfernen(d.haushalt, d.angebotId, ang?.pdfDateiId);
      await absichtAbschliessen(haushalt, a.id, 'verworfen');
      return;
    }
    await schrittAbhaken(haushalt, a.id, 'festschreiben');
    a = { ...a, schritte: a.schritte.map(s => (s.name === 'festschreiben' ? { ...s, erledigt: new Date().toISOString() } : s)) };
  }
  await mitVorgang(haushalt, a, async v => {
    await v.schritt('kontakt', async () => { await angebotKontaktVermerk({ art: 'gestellt', kontaktId: d.kontaktId, nummer: d.nummer, titel: ang?.titel ?? '', dealId: d.dealId, nachfassen: d.nachfassen, heute: d.heute, jetzt: d.jetzt, person: d.person, wer: { art: 'system' } }); });
  });
  await absichtAbschliessen(haushalt, a.id, 'fertig');
}

/** Angebots-PDFs eines NICHT gestellten Angebots (Abbruch zwischen Ablegen und CRM-Schreiben) aus der Ablage nehmen. */
async function verwaistePdfsEntfernen(haushalt: string, angebotId: string, behalten?: string): Promise<number> {
  const { ablageName, inhaltEntfernen } = await import('@/lib/dateien/ablage');
  const { updateJson } = await import('@/lib/store/local-db');
  if ((await loadJson(ablageName(haushalt))) === null) return 0;
  let weg: string[] = [];
  await updateJson<{ eintraege: { id: string; angebotId?: string; art?: string }[] }>(ablageName(haushalt), cur => {
    const l = cur?.eintraege ?? [];
    weg = l.filter(x => x.angebotId === angebotId && x.art === 'angebot' && x.id !== behalten).map(x => x.id);
    return weg.length ? { ...(cur ?? {}), eintraege: l.filter(x => !weg.includes(x.id)) } : (cur ?? { eintraege: [] });
  });
  for (const id of weg) await inhaltEntfernen(haushalt, id);
  return weg.length;
}

// ── Antwort des Kunden ───────────────────────────────────────────────────────

async function antwortSetzen(p: { id: string; stand?: unknown; person: string; wer?: Wer; jetzt?: Date }, art: 'angenommen' | 'abgelehnt', grund?: string): Promise<{ angebot: Angebot; dealId?: string; dealFehler?: string }> {
  const jetzt = p.jetzt ?? new Date();
  const jetztIso = jetzt.toISOString();
  const heute = localDay(jetzt);
  let ergebnis: { angebot: Angebot; dealId?: string; dealFehler?: string } | null = null;
  let fehler: AngebotFehler | null = null;
  await aendereCrm(b => {
    const a = (b.angebote ?? []).find(x => x.id === p.id);
    try {
      if (!a) throw new AngebotFehler('Angebot nicht gefunden.', 404);
      if (a.status !== 'gestellt' && a.status !== 'abgelaufen') throw new AngebotFehler(a.status === 'entwurf' ? 'Erst stellen, dann kann der Kunde antworten.' : `Das Angebot ist schon ${a.status}.`, 409, { aktuell: mitStand(a) });
      standPruefen(a, p.stand);
      const neu: Angebot = art === 'angenommen'
        ? { ...a, status: 'angenommen', angenommenAm: heute, geaendert: jetztIso, geaendertVon: p.person }
        : { ...a, status: 'abgelehnt', abgelehntAm: heute, grund: grund!, geaendert: jetztIso, geaendertVon: p.person };
      let dealFehler: string | undefined;
      const chancen = b.chancen.map(c => {
        if (c.id !== a.dealId || !OFFENE_STUFEN.includes(c.stufe)) return c;
        const r = wechsleStufe(c, art === 'angenommen' ? 'gewonnen' : 'verloren', p.person, jetztIso, art === 'abgelehnt' ? { grund } : {});
        if (!r.ok) { dealFehler = r.fehler; return c; }
        return { ...r.chance, geaendertVon: p.person };
      });
      const followups = (b.followups ?? []).map(f => (f.id === `fu-${a.id}` && (f.status === 'offen' || f.status === 'verpasst')
        ? { ...f, status: art === 'angenommen' ? 'erledigt' as const : 'abgesagt' as const, ergebnis: art === 'angenommen' ? 'Angebot angenommen' : 'Angebot abgelehnt', ...(art === 'angenommen' ? { erledigtAm: jetztIso } : {}), geaendert: jetztIso, geaendertVon: p.person } : f));
      ergebnis = { angebot: neu, ...(a.dealId ? { dealId: a.dealId } : {}), ...(dealFehler ? { dealFehler } : {}) };
      return { ...b, angebote: b.angebote.map(x => (x.id === a.id ? neu : x)), chancen, followups };
    } catch (e) { fehler = e as AngebotFehler; return b; }
  }, p.wer);
  if (fehler) throw fehler;
  return ergebnis!;
}

export const angebotAnnehmen = (p: { id: string; stand?: unknown; person: string; wer?: Wer; jetzt?: Date }) => antwortSetzen(p, 'angenommen');

export function angebotAblehnen(p: { id: string; stand?: unknown; person: string; grund?: unknown; wer?: Wer; jetzt?: Date }) {
  const grund = String(p.grund ?? '').replace(/\s+/g, ' ').trim();
  if (!grund) return Promise.reject(new AngebotFehler('Abgelehnt braucht einen Grund (Verlustgrund) — nur so lernt die Pipeline.', 400));
  if (grund.length > ANGEBOT_GRENZEN.grund) return Promise.reject(new AngebotFehler(`Grund ist länger als ${ANGEBOT_GRENZEN.grund} Zeichen.`, 413));
  return antwortSetzen(p, 'abgelehnt', grund);
}
