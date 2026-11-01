// ─── Verträge — Schreibwege (nur Server, 01.11.) ─────────────────────────────────────────────────────────────────────
// Die EINE Stelle, die die Bestände `vertrag-vorlagen--<haushalt>` (Vorlagen, eigene Arten) und `vertraege--<haushalt>` (Verträge) schreibt
// (Routen /api/vertraege, /api/vertraege/vorlagen, /api/vertraege/unterschrift). Regeln rein in lib/vertraege/modell.ts.
//   Vorlagen     speichern (Stand/409, Grenzen 413, Platzhalter geprüft) · aus Gerüst · Prüfvermerk · Archiv · eigene Art · Import-Vorschau (schreibt NICHTS)
//   Verträge     anlegen (aus Vorlage, vorbelegt aus Angebot/Deal/Mandat) · Entwurf speichern · fertigstellen (Nummer {KURZ}-V-{JAHR}-{NR4} je Gesellschaft und
//                Jahr in der Sperre, PDF + SHA-256 in die Ablage mit festem Bezug `vertragId`, danach unveränderlich) · neue Version · Status (versendet,
//                aktiv, beendet, gekündigt) · unterschrieben (PDF hochladen → Beleg, Mandat `vertragUnterschrieben`, Eintrag in `vertraege[]` des Registers
//                über lib/gesellschaften/server.ts → Fristen, Kalender, Erinnerung) · Entwurf löschen.
// Nichts wird versendet — „versendet“ vermerkt nur, dass der Mensch ihn geschickt hat. Hinweis, keine Rechtsberatung.

import { createHash } from 'crypto';
import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { standVon } from '@/lib/crm/crm-stand';
import { istBusinessGesellschaft, finanzFirmaFuer, NUR_GRUNDDATEN, type Gesellschaftskennung } from '@/lib/einheiten';
import {
  vorlageSaeubern, pruefungSetzen, vorlageAusStart, eigeneArtAus, vertragAusVorlage, entwurfAendern, fertigstellenFehlt, fertigstellenWarnungen, vertragFassung,
  naechsteVertragsnummer, vertragNummer, neueVersion, registerEintrag, istVertragEntwurf, STATUS_WEITER, VERTRAG_GRENZEN, KONTAKT_ID, FIRMA_ID, vorlageAmpel,
  type VertragVorlage, type VorlagenDatei, type Vertrag, type VertraegeDatei, type FuellKontext, type VertragStatus, type VertragAbsender, type VertragPartner,
} from './modell';
import { vorlageAusText, type VorlageImport } from './import';

export class VertragFehler extends Error { constructor(msg: string, readonly status: number, readonly extra: Record<string, unknown> = {}) { super(msg); } }

export const vorlagenName = (haushalt: string) => `vertrag-vorlagen--${haushalt}`;
export const vertraegeName = (haushalt: string) => `vertraege--${haushalt}`;
export const mitStand = <T extends object>(x: T) => ({ ...x, stand: standVon(x) });

const pruefeStand = (x: object, stand: unknown) => {
  if (typeof stand !== 'string' || standVon(x) !== stand) throw new VertragFehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal.', 409, { aktuell: mitStand(x), grund: 'stand' });
};

// ── Vorlagen ─────────────────────────────────────────────────────────────────

export async function vorlagenLaden(haushalt: string): Promise<VorlagenDatei> {
  const d = await loadJson<VorlagenDatei>(vorlagenName(haushalt));
  return { vorlagen: d?.vorlagen ?? [], arten: d?.arten ?? [] };
}

export async function vorlageSpeichern(p: { haushalt: string; person: string; id?: unknown; felder: Record<string, unknown>; stand?: unknown; wer?: Wer; jetzt?: Date }): Promise<VertragVorlage> {
  const jetzt = (p.jetzt ?? new Date()).toISOString();
  const id = typeof p.id === 'string' && /^vv-[a-z0-9-]{4,60}$/.test(p.id) ? p.id : neueKennung('vv');
  let ergebnis: VertragVorlage | null = null;
  let fehler: VertragFehler | null = null;
  let vorher: VorlagenDatei | null = null;
  const nachher = await updateJson<VorlagenDatei>(vorlagenName(p.haushalt), cur => {
    vorher = cur;
    const d: VorlagenDatei = { vorlagen: cur?.vorlagen ?? [], arten: cur?.arten ?? [] };
    const alt = d.vorlagen.find(v => v.id === id) ?? null;
    try {
      if (alt) pruefeStand(alt, p.stand);
      else if (d.vorlagen.length >= VERTRAG_GRENZEN.vorlagen) throw new VertragFehler(`Höchstens ${VERTRAG_GRENZEN.vorlagen} Vorlagen.`, 413);
      const r = vorlageSaeubern(p.felder, alt, { id, jetzt, person: p.person, eigeneArten: d.arten });
      if (!r.v) throw new VertragFehler(r.fehler.map(f => f.text).join(' · '), r.fehler.some(f => /höchstens/i.test(f.text)) ? 413 : 400, { fehler: r.fehler });
      ergebnis = r.v;
      return { ...d, vorlagen: alt ? d.vorlagen.map(v => (v.id === id ? r.v! : v)) : [...d.vorlagen, r.v] };
    } catch (e) { fehler = e as VertragFehler; return cur ?? d; }
  });
  if (fehler) throw fehler;
  await protokolliereBestand(vorlagenName(p.haushalt), vorher, nachher, p.wer ?? { art: 'person', person: p.person });
  return ergebnis!;
}

/** Eine Vorlage aus einem Gerüst (Startvorlage — nur Überschriften, kein Wortlaut). */
export async function vorlageAusGeruest(p: { haushalt: string; person: string; start: unknown; wer?: Wer }): Promise<VertragVorlage> {
  const felder = typeof p.start === 'string' ? vorlageAusStart(p.start) : null;
  if (!felder) throw new VertragFehler('Unbekanntes Gerüst.', 400);
  return vorlageSpeichern({ haushalt: p.haushalt, person: p.person, felder, wer: p.wer });
}

async function vorlageAendern(haushalt: string, id: string, stand: unknown, mut: (v: VertragVorlage) => VertragVorlage | { fehler: string }): Promise<VertragVorlage> {
  let ergebnis: VertragVorlage | null = null;
  let fehler: VertragFehler | null = null;
  await updateJson<VorlagenDatei>(vorlagenName(haushalt), cur => {
    const d: VorlagenDatei = { vorlagen: cur?.vorlagen ?? [], arten: cur?.arten ?? [] };
    const alt = d.vorlagen.find(v => v.id === id);
    try {
      if (!alt) throw new VertragFehler('Vorlage nicht gefunden.', 404);
      pruefeStand(alt, stand);
      const r = mut(alt);
      if ('fehler' in r) throw new VertragFehler(r.fehler, 400);
      ergebnis = r;
      return { ...d, vorlagen: d.vorlagen.map(v => (v.id === id ? r : v)) };
    } catch (e) { fehler = e as VertragFehler; return cur ?? d; }
  });
  if (fehler) throw fehler;
  return ergebnis!;
}

/** Prüfvermerk „anwaltlich geprüft am …“ (bzw. `null` = löschen). Hält den Fingerabdruck der Paragraphen fest. */
export function vorlagePruefung(p: { haushalt: string; person: string; id: string; stand: unknown; am?: unknown; notiz?: unknown; loeschen?: boolean; jetzt?: Date }) {
  const jetzt = (p.jetzt ?? new Date()).toISOString();
  return vorlageAendern(p.haushalt, p.id, p.stand, v => {
    const r = pruefungSetzen(v, p.loeschen ? null : { am: p.am, notiz: p.notiz, von: p.person });
    return 'feld' in r ? { fehler: r.text } : { ...r, geaendert: jetzt, geaendertVon: p.person };
  });
}
export function vorlageArchiv(p: { haushalt: string; person: string; id: string; stand: unknown; zurueck?: boolean; jetzt?: Date }) {
  const jetzt = (p.jetzt ?? new Date()).toISOString();
  return vorlageAendern(p.haushalt, p.id, p.stand, v => {
    const { archiviert: _a, ...rest } = v;
    return { ...(p.zurueck ? rest : { ...rest, archiviert: true }), geaendert: jetzt, geaendertVon: p.person };
  });
}

export async function eigeneArtAnlegen(p: { haushalt: string; label: unknown }): Promise<{ id: string; label: string }> {
  const a = eigeneArtAus(typeof p.label === 'string' ? p.label : '');
  if (!a) throw new VertragFehler('Name der Art: mindestens zwei Zeichen.', 400);
  let raus = a;
  await updateJson<VorlagenDatei>(vorlagenName(p.haushalt), cur => {
    const arten = cur?.arten ?? [];
    const da = arten.find(x => x.id === a.id);
    if (da) { raus = da; return cur ?? { vorlagen: [], arten }; }
    if (arten.length >= 40) throw new VertragFehler('Höchstens 40 eigene Arten.', 413);
    return { vorlagen: cur?.vorlagen ?? [], arten: [...arten, a] };
  });
  return raus;
}

/** Import-Vorschau aus einer Datei (DOCX/PDF/Text) — liest nur, schreibt NICHTS (kein Bestand, keine Ablage). */
export async function importVorschau(datei: { bytes: Buffer; name: string } | null, text?: unknown): Promise<VorlageImport & { umfang?: string }> {
  if (typeof text === 'string') return vorlageAusText(text);
  if (!datei) throw new VertragFehler('Datei oder Text fehlt.', 400);
  const [{ aufgabenTypErkennen }, { textAuslesen, NichtLesbar }] = await Promise.all([import('@/lib/dateien/aufgaben-regeln'), import('@/lib/dateien/text-auslesen')]);
  const typ = aufgabenTypErkennen(datei.name, datei.bytes);
  if (!typ || !/pdf|word|text\/plain|markdown/.test(typ)) throw new VertragFehler('Nur PDF, Word (DOCX) oder Text (TXT/MD).', 415);
  try {
    const a = await textAuslesen(datei.bytes, typ);
    const v = vorlageAusText(a?.text ?? '');
    return { ...v, ...(a?.umfang ? { umfang: a.umfang } : {}), ...(a?.hinweis ? { hinweis: [a.hinweis, v.hinweis].filter(Boolean).join(' ') } : {}) };
  } catch (e) {
    if (e instanceof NichtLesbar) throw new VertragFehler(`Text nicht lesbar: ${e.message}`, 415);
    throw e;
  }
}

// ── Verträge ─────────────────────────────────────────────────────────────────

export async function vertraegeLaden(haushalt: string): Promise<Vertrag[]> {
  return (await loadJson<VertraegeDatei>(vertraegeName(haushalt)))?.vertraege ?? [];
}

const gesellschaftOk = (g: unknown): g is Gesellschaftskennung => istBusinessGesellschaft(g);
function gesellschaftAus(roh: unknown): Gesellschaftskennung {
  const g = typeof roh === 'string' ? finanzFirmaFuer(roh) : null;
  if (typeof roh === 'string' && roh.startsWith('g-') && !g) throw new VertragFehler(NUR_GRUNDDATEN, 400);
  if (!gesellschaftOk(g)) throw new VertragFehler('Absender: nur eine Gesellschaft im Bereich Business.', 400);
  return g;
}

async function vertragAendern(haushalt: string, id: string, mut: (v: Vertrag, alle: Vertrag[]) => Promise<Vertrag> | Vertrag, wer?: Wer): Promise<Vertrag> {
  let ergebnis: Vertrag | null = null;
  let fehler: VertragFehler | null = null;
  let vorher: VertraegeDatei | null = null;
  const nachher = await updateJsonAsync<VertraegeDatei>(vertraegeName(haushalt), async cur => {
    vorher = cur;
    const l = cur?.vertraege ?? [];
    const alt = l.find(v => v.id === id);
    try {
      if (!alt) throw new VertragFehler('Vertrag nicht gefunden.', 404);
      const neu = await mut(alt, l);
      ergebnis = neu;
      return { vertraege: l.map(v => (v.id === id ? neu : v)) };
    } catch (e) { fehler = e as VertragFehler; return cur ?? { vertraege: [] }; }
  });
  if (fehler) throw fehler;
  if (wer) await protokolliereBestand(vertraegeName(haushalt), vorher, nachher, wer);
  return ergebnis!;
}

/** Vorbelegung aus angenommenem Angebot, Deal oder Mandat (rein über den CRM-Bestand). */
async function vorbelegung(q: { angebotId?: unknown; dealId?: unknown; mandatId?: unknown; kontaktId?: unknown; firmaId?: unknown }) {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const crm = await ladeCrm();
  const raus: Partial<Pick<Vertrag, 'kontaktId' | 'firmaId' | 'dealId' | 'mandatId' | 'angebotId' | 'leistungId'>> & { werte: Record<string, string>; gesellschaft?: string } = { werte: {} };
  const euro = (c: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(c);
  if (typeof q.angebotId === 'string') {
    const a = (crm.angebote ?? []).find(x => x.id === q.angebotId);
    if (!a) throw new VertragFehler('Angebot nicht gefunden.', 404);
    if (a.status === 'entwurf') throw new VertragFehler('Aus einem Angebots-Entwurf entsteht kein Vertrag — erst stellen.', 409);
    const { angebotSummen, angebotHauptprodukt } = await import('@/lib/crm/angebote');
    const s = angebotSummen(a);
    const teile = [s.einmalig.netto ? `${euro(s.einmalig.netto / 100)} netto einmalig` : '', s.monat.netto ? `${euro(s.monat.netto / 100)} netto monatlich` : '', s.jahr.netto ? `${euro(s.jahr.netto / 100)} netto jährlich` : ''].filter(Boolean);
    Object.assign(raus, { angebotId: a.id, ...(a.kontaktId ? { kontaktId: a.kontaktId } : {}), ...(a.firmaId ? { firmaId: a.firmaId } : {}), ...(a.dealId ? { dealId: a.dealId } : {}), gesellschaft: a.gesellschaft });
    const hp = angebotHauptprodukt(a, crm.leistungen);
    if (hp) raus.leistungId = hp;
    if (teile.length) raus.werte.verguetung = teile.join(' zzgl. ');
    if (a.zahlungszielTage) raus.werte.zahlungsziel = String(a.zahlungszielTage);
  }
  if (typeof q.dealId === 'string' && !raus.dealId) {
    const c = crm.chancen.find(x => x.id === q.dealId);
    if (!c) throw new VertragFehler('Deal nicht gefunden.', 404);
    Object.assign(raus, { dealId: c.id, ...(c.kontaktIds[0] ? { kontaktId: c.kontaktIds[0] } : {}), ...(c.firmaId ? { firmaId: c.firmaId } : {}), ...(c.leistungId ? { leistungId: c.leistungId } : {}), ...(c.gesellschaft && c.gesellschaft !== 'offen' ? { gesellschaft: c.gesellschaft } : {}) });
  }
  if (typeof q.mandatId === 'string') {
    const m = crm.mandate.find(x => x.id === q.mandatId && !x.geloeschtAm);
    if (!m) throw new VertragFehler('Mandat nicht gefunden.', 404);
    Object.assign(raus, { mandatId: m.id, ...(!raus.kontaktId && m.kontaktIds[0] ? { kontaktId: m.kontaktIds[0] } : {}), ...(!raus.firmaId && m.firmaId ? { firmaId: m.firmaId } : {}), ...(!raus.leistungId && m.leistungId ? { leistungId: m.leistungId } : {}), ...(m.gesellschaft && m.gesellschaft !== 'offen' ? { gesellschaft: m.gesellschaft } : {}) });
    if (m.start) raus.werte.beginn = m.start;
    if (!raus.werte.verguetung && m.honorar?.betrag) raus.werte.verguetung = `${euro(m.honorar.betrag)} ${m.honorar.netto ? 'netto ' : ''}${m.honorar.basis === 'monat' ? 'monatlich' : m.honorar.basis === 'tag' ? 'je Tag' : 'einmalig'}`;
    if (!raus.werte.zahlungsziel && m.zahlungszielTage) raus.werte.zahlungsziel = String(m.zahlungszielTage);
  }
  if (typeof q.kontaktId === 'string' && KONTAKT_ID.test(q.kontaktId) && !raus.kontaktId) raus.kontaktId = q.kontaktId;
  if (typeof q.firmaId === 'string' && FIRMA_ID.test(q.firmaId) && !raus.firmaId) raus.firmaId = q.firmaId;
  return raus;
}

export async function vertragAnlegen(p: { haushalt: string; person: string; vorlageId: unknown; gesellschaft?: unknown; vorbelegung?: Record<string, unknown>; wer?: Wer; jetzt?: Date }): Promise<Vertrag> {
  const jetzt = p.jetzt ?? new Date();
  const d = await vorlagenLaden(p.haushalt);
  const vorlage = d.vorlagen.find(v => v.id === p.vorlageId);
  if (!vorlage) throw new VertragFehler('Vorlage nicht gefunden.', 404);
  if (vorlage.archiviert) throw new VertragFehler('Diese Vorlage ist archiviert.', 409);
  const vb = await vorbelegung(p.vorbelegung ?? {});
  const gesellschaft = gesellschaftAus(p.gesellschaft ?? vb.gesellschaft ?? (await (await import('@/lib/gesellschaften/server')).absenderVorgabe(p.haushalt)));
  const { gesellschaft: _g, ...rest } = vb;
  const v = vertragAusVorlage(vorlage, { id: neueKennung('vtr'), gesellschaft, jetzt: jetzt.toISOString(), person: p.person, heute: localDay(jetzt), vorbelegung: rest });
  let vorher: VertraegeDatei | null = null;
  const nachher = await updateJson<VertraegeDatei>(vertraegeName(p.haushalt), cur => {
    vorher = cur;
    const l = cur?.vertraege ?? [];
    if (l.length >= VERTRAG_GRENZEN.vertraege) throw new VertragFehler(`Höchstens ${VERTRAG_GRENZEN.vertraege} Verträge.`, 413);
    return { vertraege: [...l, v] };
  });
  await protokolliereBestand(vertraegeName(p.haushalt), vorher, nachher, p.wer ?? { art: 'person', person: p.person });
  return v;
}

export function vertragSpeichern(p: { haushalt: string; person: string; id: string; felder: Record<string, unknown>; stand: unknown; wer?: Wer; jetzt?: Date }): Promise<Vertrag> {
  const jetzt = (p.jetzt ?? new Date()).toISOString();
  return vertragAendern(p.haushalt, p.id, alt => {
    if (!istVertragEntwurf(alt)) throw new VertragFehler(`Vertrag ${alt.nummer ?? ''} ist fertiggestellt und festgeschrieben — Änderungen nur als neue Version.`.replace('  ', ' '), 409, { aktuell: mitStand(alt), grund: 'fertig' });
    pruefeStand(alt, p.stand);
    const r = entwurfAendern(alt, p.felder, { jetzt, person: p.person, istGesellschaft: gesellschaftOk });
    if (!r.v) throw new VertragFehler(r.fehler.map(f => f.text).join(' · '), r.fehler.some(f => /höchstens/i.test(f.text)) ? 413 : 400, { fehler: r.fehler });
    return r.v;
  }, p.wer ?? { art: 'person', person: p.person });
}

export async function vertragLoeschen(p: { haushalt: string; id: string; stand: unknown; wer?: Wer }): Promise<void> {
  let fehler: VertragFehler | null = null;
  await updateJson<VertraegeDatei>(vertraegeName(p.haushalt), cur => {
    const l = cur?.vertraege ?? [];
    const v = l.find(x => x.id === p.id);
    try {
      if (!v) throw new VertragFehler('Vertrag nicht gefunden.', 404);
      if (!istVertragEntwurf(v)) throw new VertragFehler('Fertige Verträge sind Geschäftsunterlagen und werden nicht gelöscht (§ 257 HGB).', 409);
      pruefeStand(v, p.stand);
      return { vertraege: l.filter(x => x.id !== p.id) };
    } catch (e) { fehler = e as VertragFehler; return cur ?? { vertraege: [] }; }
  });
  if (fehler) throw fehler;
}

/** Absender, Vertragspartner und Leistung für das Füllen (Kontext aus Register, Kartei, Katalog). */
export async function kontextFuer(haushalt: string, v: Pick<Vertrag, 'gesellschaft' | 'kontaktId' | 'firmaId' | 'leistungId'>): Promise<FuellKontext & { email?: string; logoDateiId?: string }> {
  const [{ gesellschaftenLaden }, { mitVorgaben }, { ladeCrm }, { empfaengerAus }] = await Promise.all([
    import('@/lib/crm/angebot-server'), import('@/lib/crm/gesellschaften'), import('@/lib/crm/speicher'), import('@/lib/crm/angebot-dokument'),
  ]);
  const g = (await gesellschaftenLaden(haushalt)).find(x => x.id === v.gesellschaft);
  const mv = g ? mitVorgaben(g) : null;
  const absender: VertragAbsender | undefined = g?.firmierung ? {
    firmierung: g.firmierung, zeilen: [g.strasse, [g.plz, g.ort].filter(Boolean).join(' '), g.land && g.land !== 'Deutschland' ? g.land : ''].filter((x): x is string => !!x),
    ...(g.geschaeftsfuehrung ? { vertretung: g.geschaeftsfuehrung } : {}), ...(g.register ? { register: g.register } : {}),
  } : undefined;
  const crm = await ladeCrm();
  const f = v.firmaId ? crm.firmen.find(x => x.id === v.firmaId) : undefined;
  let k: { vorname?: string; nachname?: string; email?: string; firma?: string } | undefined;
  if (v.kontaktId) {
    const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
    k = (await kontakteFuerVerarbeitung()).find(x => x.id === v.kontaktId);
  }
  let partner: VertragPartner | undefined;
  if (f || k) {
    const e = empfaengerAus(k, f);
    partner = f ? { name: f.name, zeilen: e.zeilen.slice(1).filter(z => !z.startsWith('z. Hd.')), ...(e.name ? { ansprechpartner: e.name } : {}) } : { name: e.name, zeilen: e.zeilen.slice(1) };
  }
  const l = v.leistungId ? crm.leistungen.find(x => x.id === v.leistungId) : undefined;
  return {
    ...(absender ? { absender } : {}), ...(partner ? { partner } : {}),
    ...(l ? { leistung: { titel: l.angebot?.titel || l.name, beschreibung: l.angebot?.leistungstext ?? l.beschreibung ?? '' } } : {}),
    ...(k?.email ? { email: k.email } : {}), ...(mv?.logoDateiId ? { logoDateiId: mv.logoDateiId } : {}),
  };
}

async function logoLaden(haushalt: string, id?: string) {
  if (!id) return null;
  const { lesen } = await import('@/lib/dateien/ablage');
  const d = await lesen(haushalt, id).catch(() => null);
  return d && (d.eintrag.datei?.typ === 'image/png' || d.eintrag.datei?.typ === 'image/jpeg') ? { bytes: new Uint8Array(d.bytes), typ: d.eintrag.datei.typ as 'image/png' | 'image/jpeg' } : null;
}

/** Vorschau-PDF eines Entwurfs (Download, schreibt nichts). */
export async function entwurfPdf(p: { haushalt: string; id: string; jetzt?: Date }): Promise<{ bytes: Uint8Array; name: string }> {
  const v = (await vertraegeLaden(p.haushalt)).find(x => x.id === p.id);
  if (!v) throw new VertragFehler('Vertrag nicht gefunden.', 404);
  const jetzt = p.jetzt ?? new Date();
  const k = await kontextFuer(p.haushalt, v);
  const { vertragPdf } = await import('./pdf');
  const fertig = !istVertragEntwurf(v) && v.fassung;
  const bytes = await vertragPdf({
    titel: v.titel, ...(v.nummer ? { nummer: v.nummer } : {}), datum: v.werte.datum ?? localDay(jetzt), entwurf: !fertig,
    absender: (fertig ? v.absender : k.absender) ?? { firmierung: '—', zeilen: [] }, partner: (fertig ? v.partner : k.partner) ?? { name: '—', zeilen: [] },
    paragraphen: fertig ? v.fassung! : vertragFassung(v, k), ...(v.werte.ort ? { ort: v.werte.ort } : {}),
  }, { erstellt: jetzt, logo: await logoLaden(p.haushalt, k.logoDateiId) });
  return { bytes, name: `${fertig ? `Vertrag ${v.nummer}` : `Vertrag-Entwurf ${v.titel}`}.pdf`.replace(/[\\/]/g, '-') };
}

/**
 * Fertigstellen: Pflichtfelder/Platzhalter (400 mit Sätzen), Warnungen der Ampel (409, `trotzdem: true` nötig), dann in der Sperre die Nummer
 * reservieren, außerhalb das PDF, in der Sperre festschreiben (nur, wenn der Entwurf noch der reservierte ist) und das PDF als Beleg ablegen.
 */
export async function vertragFertigstellen(p: { haushalt: string; person: string; id: string; stand: unknown; trotzdem?: boolean; wer?: Wer; jetzt?: Date }): Promise<{ vertrag: Vertrag; pdf: { id: string; name: string }; mail?: { an?: string; betreff: string; text: string } }> {
  const jetzt = p.jetzt ?? new Date();
  const heute = localDay(jetzt);
  const jahr = Number(heute.slice(0, 4));
  const v0 = (await vertraegeLaden(p.haushalt)).find(x => x.id === p.id);
  if (!v0) throw new VertragFehler('Vertrag nicht gefunden.', 404);
  if (!istVertragEntwurf(v0)) throw new VertragFehler(`Schon fertiggestellt (${v0.nummer ?? v0.status}).`, 409, { aktuell: mitStand(v0), grund: 'fertig' });
  pruefeStand(v0, p.stand);
  const k = await kontextFuer(p.haushalt, v0);
  const fehlt = fertigstellenFehlt(v0, k);
  if (fehlt.length) throw new VertragFehler(`Noch nicht fertig: ${fehlt.join(' ')}`, 400, { fehlt });
  const vorlage = (await vorlagenLaden(p.haushalt)).vorlagen.find(x => x.id === v0.vorlageId) ?? null;
  const w = fertigstellenWarnungen(v0, vorlage);
  if (w.warnungen.length && p.trotzdem !== true) throw new VertragFehler(`Bitte bestätigen: ${w.warnungen.join(' ')}`, 409, { warnungen: w.warnungen, grund: 'warnung' });
  const { gesellschaftenLaden } = await import('@/lib/crm/angebot-server');
  const { mitVorgaben } = await import('@/lib/crm/gesellschaften');
  const g = (await gesellschaftenLaden(p.haushalt)).find(x => x.id === v0.gesellschaft);
  const kurz = mitVorgaben(g ?? { id: v0.gesellschaft }).kurz;

  // a) Nummer reservieren (in der Sperre, lückenlos, nie doppelt).
  let res: { v: Vertrag; nummer: string; stand: string } | null = null;
  await vertragAendern(p.haushalt, p.id, (a, alle) => {
    if (!istVertragEntwurf(a)) throw new VertragFehler(`Schon fertiggestellt (${a.nummer ?? a.status}).`, 409, { grund: 'fertig' });
    pruefeStand(a, p.stand);
    const andere = alle.filter(x => x.id !== a.id);
    let nr = a.lauf?.jahr === jahr ? a.lauf.nr : naechsteVertragsnummer(andere, a.gesellschaft, jahr);
    while (andere.some(x => x.gesellschaft === a.gesellschaft && x.lauf?.jahr === jahr && x.lauf.nr === nr)) nr++;
    const reserviert: Vertrag = { ...a, lauf: { jahr, nr } };
    res = { v: reserviert, nummer: vertragNummer(kurz, jahr, nr), stand: standVon(reserviert) };
    return reserviert;
  });
  const r0 = res as { v: Vertrag; nummer: string; stand: string } | null;
  if (!r0) throw new VertragFehler('Nicht fertiggestellt.', 500);
  const kx = { ...k, nummer: r0.nummer };
  const fassung = vertragFassung(r0.v, kx);
  const { vertragPdf } = await import('./pdf');
  const bytes = Buffer.from(await vertragPdf({ titel: r0.v.titel, nummer: r0.nummer, datum: r0.v.werte.datum ?? heute, entwurf: false, absender: k.absender!, partner: k.partner!, paragraphen: fassung, ...(r0.v.werte.ort ? { ort: r0.v.werte.ort } : {}) }, { erstellt: jetzt, logo: await logoLaden(p.haushalt, k.logoDateiId) }));
  const pruefsumme = createHash('sha256').update(bytes).digest('hex');
  const name = `Vertrag ${r0.nummer}.pdf`.replace(/[\\/]/g, '-');

  // b) Festschreiben (Stand der Reservierung) + PDF als Beleg in die Ablage.
  const { ablegen } = await import('@/lib/dateien/ablage');
  let pdf: { id: string; name: string } | null = null;
  const fertig = await vertragAendern(p.haushalt, p.id, async a => {
    if (!istVertragEntwurf(a) || standVon(a) !== r0.stand) throw new VertragFehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal.', 409, { grund: 'stand' });
    const datei = await ablegen(p.haushalt, p.person, {
      art: 'vertrag', titel: `Vertrag ${r0.nummer} – ${a.titel}`.slice(0, 160), ...(a.kontaktId ? { kontaktId: a.kontaktId } : {}), ...(a.firmaId ? { firmaId: a.firmaId } : {}),
      ...(a.dealId ? { dealId: a.dealId } : {}), ...(a.mandatId ? { mandatId: a.mandatId } : {}), vertrag: { vertragsart: 'sonstig', ...(a.werte.beginn ? { von: a.werte.beginn } : {}), ...(a.werte.ende ? { bis: a.werte.ende } : {}), ...(a.werte.kuendigungsfrist ? { kuendigungsfrist: a.werte.kuendigungsfrist } : {}) },
    }, { bytes, name, typ: 'application/pdf' }, jetzt.toISOString(), { vertragId: a.id, gesellschaft: a.gesellschaft });
    pdf = { id: datei.id, name };
    return { ...a, nummer: r0.nummer, status: 'fertig', fertigAm: jetzt.toISOString(), fertigVon: p.person, absender: k.absender, partner: k.partner, fassung, pruefsumme, pdfDateiId: datei.id, ampelBeimFertig: w.ampel, abweichendBeimFertig: w.abweichend, geaendert: jetzt.toISOString(), geaendertVon: p.person };
  }, p.wer ?? { art: 'person', person: p.person }).catch(async e => {
    // Reservierung lösen, wenn sie noch unverändert am Entwurf hängt.
    await vertragAendern(p.haushalt, p.id, a => { if (!istVertragEntwurf(a) || standVon(a) !== r0.stand) return a; const { lauf: _l, ...ohne } = a; return ohne as Vertrag; }).catch(() => undefined);
    throw e;
  });
  // Vorgänger ersetzt: der Nachfolger-Verweis (nur Status-Link, Inhalt bleibt).
  if (fertig.vorgaengerId) await vertragAendern(p.haushalt, fertig.vorgaengerId, a => ({ ...a, nachfolgerId: fertig.id })).catch(() => undefined);
  const betreff = `${fertig.titel} ${fertig.nummer}`;
  const text = `${fertig.anrede === 'Du' ? 'Hallo' : 'Guten Tag'},\n\nanbei ${fertig.anrede === 'Du' ? 'dein' : 'Ihr'} Vertrag ${fertig.nummer} zur Unterschrift.\n\nViele Grüße\n${k.absender?.firmierung ?? ''}`;
  return { vertrag: fertig, pdf: pdf!, mail: { ...(k.email ? { an: k.email } : {}), betreff, text } };
}

export async function vertragVersion(p: { haushalt: string; person: string; id: string; wer?: Wer; jetzt?: Date }): Promise<Vertrag> {
  const jetzt = (p.jetzt ?? new Date()).toISOString();
  let neu: Vertrag | null = null;
  let fehler: VertragFehler | null = null;
  await updateJson<VertraegeDatei>(vertraegeName(p.haushalt), cur => {
    const l = cur?.vertraege ?? [];
    const alt = l.find(v => v.id === p.id);
    try {
      if (!alt) throw new VertragFehler('Vertrag nicht gefunden.', 404);
      if (istVertragEntwurf(alt)) throw new VertragFehler('Ein Entwurf wird direkt geändert — eine neue Version gibt es erst nach dem Fertigstellen.', 409);
      const offen = l.find(v => v.vorgaengerId === alt.id && istVertragEntwurf(v));
      if (offen) { neu = offen; return cur ?? { vertraege: l }; }
      neu = neueVersion(alt, { id: neueKennung('vtr'), jetzt, person: p.person });
      return { vertraege: [...l, neu] };
    } catch (e) { fehler = e as VertragFehler; return cur ?? { vertraege: [] }; }
  });
  if (fehler) throw fehler;
  return neu!;
}

/** Status von Hand: fertig → versendet, unterschrieben → aktiv, aktiv/unterschrieben → beendet/gekündigt. */
export function vertragStatus(p: { haushalt: string; person: string; id: string; stand: unknown; status: unknown; wer?: Wer; jetzt?: Date }): Promise<Vertrag> {
  const jetzt = (p.jetzt ?? new Date()).toISOString();
  return vertragAendern(p.haushalt, p.id, a => {
    pruefeStand(a, p.stand);
    const s = p.status as VertragStatus;
    if (!(STATUS_WEITER[a.status] ?? []).includes(s)) throw new VertragFehler(`Von „${a.status}“ nicht nach „${String(p.status)}“ — „unterschrieben“ nur mit dem unterschriebenen PDF.`, 409);
    return { ...a, status: s, ...(s === 'versendet' ? { versendetAm: jetzt } : {}), ...(s === 'beendet' || s === 'gekuendigt' ? { beendetAm: jetzt } : {}), geaendert: jetzt, geaendertVon: p.person };
  }, p.wer ?? { art: 'person', person: p.person });
}

/**
 * Unterschrieben: das unterschriebene PDF als Beleg ablegen (fester Bezug `vertragId`, nicht löschbar), Status setzen, am Mandat
 * `vertragUnterschrieben`, Eintrag in `vertraege[]` der Gesellschaft im Register (EINE Schreibstelle lib/gesellschaften/server.ts) → Fristen/Kalender/Erinnerung.
 */
export async function vertragUnterschrieben(p: { haushalt: string; person: string; id: string; stand: unknown; datei: { bytes: Buffer; name: string }; am?: unknown; wer?: Wer; jetzt?: Date }): Promise<{ vertrag: Vertrag; hinweise: string[] }> {
  const jetzt = p.jetzt ?? new Date();
  const heute = localDay(jetzt);
  const am = typeof p.am === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.am) && p.am <= heute ? p.am : heute;
  const { typErkennen } = await import('@/lib/dateien/regeln');
  if (typErkennen(p.datei.name, p.datei.bytes) !== 'application/pdf') throw new VertragFehler('Bitte das unterschriebene Dokument als PDF.', 415);
  const v0 = (await vertraegeLaden(p.haushalt)).find(x => x.id === p.id);
  if (!v0) throw new VertragFehler('Vertrag nicht gefunden.', 404);
  if (v0.status !== 'fertig' && v0.status !== 'versendet') throw new VertragFehler(v0.status === 'entwurf' ? 'Erst fertigstellen, dann unterschreiben.' : 'Ist schon unterschrieben.', 409, { aktuell: mitStand(v0) });
  pruefeStand(v0, p.stand);
  const { ablegen } = await import('@/lib/dateien/ablage');
  const datei = await ablegen(p.haushalt, p.person, {
    art: 'vertrag', titel: `Vertrag ${v0.nummer} – unterschrieben`.slice(0, 160), ...(v0.kontaktId ? { kontaktId: v0.kontaktId } : {}), ...(v0.firmaId ? { firmaId: v0.firmaId } : {}), ...(v0.mandatId ? { mandatId: v0.mandatId } : {}),
    vertrag: { vertragsart: 'sonstig', ...(v0.werte.beginn ? { von: v0.werte.beginn } : {}), ...(v0.werte.ende ? { bis: v0.werte.ende } : {}) },
  }, { bytes: p.datei.bytes, name: p.datei.name.slice(0, 120), typ: 'application/pdf' }, jetzt.toISOString(), { vertragId: v0.id, gesellschaft: v0.gesellschaft });
  let v = await vertragAendern(p.haushalt, p.id, a => {
    if (a.status !== 'fertig' && a.status !== 'versendet') throw new VertragFehler('Ist schon unterschrieben.', 409);
    return { ...a, status: 'unterschrieben', unterschriebenAm: am, unterschriftDateiId: datei.id, geaendert: jetzt.toISOString(), geaendertVon: p.person };
  }, p.wer ?? { art: 'person', person: p.person });
  const hinweise: string[] = [];
  // Mandat: Vertrag unterschrieben.
  if (v.mandatId) {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: b.mandate.map(m => (m.id === v.mandatId && !m.vertragUnterschrieben ? { ...m, vertragUnterschrieben: true, geaendert: jetzt.toISOString(), geaendertVon: p.person } : m)) }), p.wer)
      .catch(() => { hinweise.push('Am Mandat konnte „Vertrag unterschrieben“ nicht gesetzt werden — bitte dort von Hand.'); });
  }
  // Register: Eintrag in vertraege[] der Gesellschaft (Fristen → Kalender, Erinnerung).
  try {
    const reg = await import('@/lib/gesellschaften/server');
    const { gesellschaftVon } = await import('@/lib/gesellschaften/modell');
    const r0 = gesellschaftVon(await reg.ladeRegister(p.haushalt), v.gesellschaft);
    if (!r0) hinweise.push('Die Gesellschaft steht noch nicht im Register — der Vertrag erscheint dort nicht (Unternehmen › Gesellschaften).');
    else {
      const vorher = new Set((r0.vertraege ?? []).map(x => x.id));
      const r = await reg.registerAendern(p.haushalt, p.person, v.gesellschaft, reg.standVon(r0), p.wer ?? { art: 'person', person: p.person }, reg.eintragSchreiben('vertraege', registerEintrag(v), undefined, p.person));
      const neu = r.g ? (r.g.vertraege ?? []).find(x => !vorher.has(x.id)) : undefined;
      if (neu) {
        v = await vertragAendern(p.haushalt, p.id, a => ({ ...a, registerVertragId: neu.id }));
        await reg.vertragsErinnerungen(p.haushalt).catch(() => ({ neu: 0 }));
      } else hinweise.push(`Register: ${r.fehler?.map(f => f.text).join(' · ') ?? 'gerade geändert — bitte den Vertrag dort von Hand eintragen.'}`);
    }
  } catch (e) {
    console.error('[vertraege] Register-Eintrag:', e instanceof Error ? e.message : e);
    hinweise.push('Register-Eintrag nicht geschrieben — bitte unter Unternehmen › Verträge nachtragen.');
  }
  return { vertrag: v, hinweise };
}

/** Für die Oberfläche: Vorlagen mit Stand und Ampel. */
export const vorlageAnzeige = (v: VertragVorlage) => ({ ...mitStand(v), ampel: vorlageAmpel(v) });
