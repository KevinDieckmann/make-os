// ─── Unternehmen › Schild: Eingaben säubern und Änderungen anwenden (rein, client-sicher, 10.10.) ──────────────────────
// Jede Änderung aus dem Netz läuft hier durch: Listeneinträge (Dokument, Ereignis, Risiko, Marke, Domain, Versicherung, Entwurf), Profil,
// Vermerk „erledigt am“, neue Risiko-Bewertung (nur anhängen), Startkatalog übernehmen, Papierkorb. Fehler werden gemeldet (400), Grenzen
// nie still gekürzt (413). Zeitstempel und „wer“ setzt NUR der Server (Kontext `person`, `jetzt`, `heute`) — Browserwerte dafür fallen weg.
// Personen nur als Speichername eines Kontos des Haushalts (`personen`), nie Dritte. Nie Passwörter (es gibt kein Feld dafür).

import { centAus, type RegisterFehler } from '@/lib/gesellschaften/modell';
import { inPapierkorb, ausPapierkorb, imPapierkorb, papierkorbAbgelaufen } from '@/lib/eintraege/sicher';
import {
  DOK_STATUS, DOK_QUELLEN, GROESSENKLASSEN, RISIKO_KATEGORIEN, BEHANDLUNGEN, RISIKO_STATUS, ROLLEN, MARKEN_AEMTER, MARKEN_FORMEN, VERSICHERUNG_ARTEN,
  SCHILD_GRENZEN, SCHILD_LISTEN,
  type Dokument, type Ereignis, type Risiko, type Marke, type Domain, type Versicherung, type Entwurf, type SchildGesellschaft, type SchildProfil,
  type SchildListe, type Vermerk, type Bewertung, type Massnahme, type Stufe, type EreignisArt, type DokStatus, type SchildDatei,
} from './typen';
import { DOK_ARTEN } from './dokumente';
import { EREIGNIS_ARTEN, PFLICHT_REGELN, SCHWELLEN, ZUSATZ_SCHRITTE, ereignisSchritte, zusatzSchritt } from './pflichten';
import { RISIKO_KATALOG } from './risiken';
import { istTag } from './zeit';

export interface Kontext { person: string; jetzt: string; heute: string; /** Speichernamen der Konten des Haushalts (für „verantwortlich“). */ personen: readonly string[] }
export interface Ergebnis<T> { e?: T; fehler: RegisterFehler[]; status?: number }

const zeile = (v: unknown, n: number) => { const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); return t ? t.slice(0, n) : undefined; };
/** Text ohne Kürzen: über der Grenze → Fehler (413), nie still abgeschnitten. */
const lang = (v: unknown, n: number, feld: string, fehler: RegisterFehler[]) => {
  const t = String(v ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
  if (t.length > n) { fehler.push({ feld, text: `${feld}: höchstens ${n.toLocaleString('de-DE')} Zeichen.` }); return undefined; }
  return t || undefined;
};
const hat = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const DATEI = /^d-[a-z0-9-]{4,60}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;
const ID = (p: string) => new RegExp(`^${p}-[a-z0-9][a-z0-9-]{3,62}$`);

/** Wert aus `roh`, sonst aus `alt` — `null`/'' leert (gibt `undefined`). */
function feld<T>(roh: Record<string, unknown>, alt: T | undefined, k: string, lesen: (v: unknown) => T | undefined | 'fehler', fehler: RegisterFehler[], text: string): T | undefined {
  if (!hat(roh, k)) return alt;
  const v = roh[k];
  if (v === null || v === '') return undefined;
  const r = lesen(v);
  if (r === 'fehler') { fehler.push({ feld: k, text }); return alt; }
  return r;
}
const tagLesen = (v: unknown) => (istTag(v) ? v : 'fehler' as const);
const boolLesen = (v: unknown) => (typeof v === 'boolean' ? v : 'fehler' as const);
const centLesen = (v: unknown) => { const c = centAus(v); return c === 'fehler' ? 'fehler' as const : c; };
const ausListe = <T extends string>(l: readonly { id: T }[]) => (v: unknown) => (l.some(x => x.id === v) ? v as T : 'fehler' as const);
const ganz = (min: number, max: number) => (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : 'fehler' as const; };

function dateiIdsLesen(roh: Record<string, unknown>, alt: string[] | undefined, fehler: RegisterFehler[]): string[] | undefined {
  if (!hat(roh, 'dateiIds')) return alt;
  const l = Array.isArray(roh.dateiIds) ? roh.dateiIds : [];
  if (l.length > SCHILD_GRENZEN.dateien) { fehler.push({ feld: 'dateiIds', text: `Höchstens ${SCHILD_GRENZEN.dateien} Unterlagen je Eintrag.` }); return alt; }
  const ok = l.filter((x): x is string => typeof x === 'string' && DATEI.test(x));
  if (ok.length !== l.length) fehler.push({ feld: 'dateiIds', text: 'Eine Unterlage ist nicht lesbar.' });
  return ok.length ? [...new Set(ok)] : undefined;
}

/** Ohne `undefined`-Felder (gespeichert wird nur, was es gibt). */
function rein<T extends object>(x: T): T { return Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) as T; }

// ── Listeneinträge ───────────────────────────────────────────────────────────────────────────────────────────────

function dokument(roh: Record<string, unknown>, alt: Dokument | undefined, id: string, k: Kontext): Ergebnis<Dokument> {
  const fehler: RegisterFehler[] = [];
  const art = hat(roh, 'art') ? roh.art : alt?.art;
  if (typeof art !== 'string' || !DOK_ARTEN.includes(art)) fehler.push({ feld: 'art', text: 'Welche Art von Dokument?' });
  const status = (feld(roh, alt?.status, 'status', ausListe(DOK_STATUS), fehler, 'Status: vorhanden, Entwurf oder nicht nötig.') ?? 'vorhanden') as DokStatus;
  const grund = hat(roh, 'grund') ? zeile(roh.grund, 300) : alt?.grund;
  if (status === 'nicht-noetig' && !grund) fehler.push({ feld: 'grund', text: '„Nicht nötig“ braucht einen Grund.' });
  const fassungVom = feld(roh, alt?.fassungVom, 'fassungVom', tagLesen, fehler, 'Fassung vom: Datum als JJJJ-MM-TT.');
  if (fassungVom && fassungVom > k.heute) fehler.push({ feld: 'fassungVom', text: 'Die Fassung liegt in der Zukunft.' });
  const gueltigBis = feld(roh, alt?.gueltigBis, 'gueltigBis', tagLesen, fehler, 'Gültig bis: Datum als JJJJ-MM-TT.');
  const geschaeftsjahr = feld(roh, alt?.geschaeftsjahr, 'geschaeftsjahr', ganz(1990, 2100), fehler, 'Geschäftsjahr: Jahreszahl.');
  const quelle = feld(roh, alt?.quelle, 'quelle', ausListe(DOK_QUELLEN), fehler, 'Unbekannte Quelle.');
  const dateiIds = dateiIdsLesen(roh, alt?.dateiIds, fehler);
  const titel = hat(roh, 'titel') ? zeile(roh.titel, 160) : alt?.titel;
  const notiz = hat(roh, 'notiz') ? lang(roh.notiz, 2000, 'notiz', fehler) : alt?.notiz;
  if (fehler.length) return { fehler };
  return { fehler, e: rein({ id, art: art as string, titel, status, fassungVom, gueltigBis, geschaeftsjahr, quelle, dateiIds, notiz, grund: status === 'nicht-noetig' ? grund : undefined, angelegt: alt?.angelegt ?? k.jetzt, geloeschtAm: alt?.geloeschtAm }) };
}

function ereignis(roh: Record<string, unknown>, alt: Ereignis | undefined, id: string, k: Kontext): Ergebnis<Ereignis> {
  const fehler: RegisterFehler[] = [];
  const art = hat(roh, 'art') ? roh.art : alt?.art;
  if (!EREIGNIS_ARTEN.some(e => e.id === art)) fehler.push({ feld: 'art', text: 'Welches Ereignis?' });
  const datum = feld(roh, alt?.datum, 'datum', tagLesen, fehler, 'Datum als JJJJ-MM-TT.');
  if (!datum) fehler.push({ feld: 'datum', text: 'Wann war das Ereignis?' });
  const notiz = hat(roh, 'notiz') ? lang(roh.notiz, 1000, 'notiz', fehler) : alt?.notiz;
  // Zusatz-Schritte (Ereignis-Assistent, 11.10.): nur bekannte Kennungen, ohne Doppelte; fehlt das Feld, bleibt der gespeicherte Stand. Leer = weg.
  let zusatz = alt?.zusatz;
  if (hat(roh, 'zusatz')) {
    const l = Array.isArray(roh.zusatz) ? roh.zusatz : roh.zusatz === null ? [] : null;
    if (!l) fehler.push({ feld: 'zusatz', text: 'Zusatz-Schritte: eine Liste.' });
    else if (l.length > ZUSATZ_SCHRITTE.length) fehler.push({ feld: 'zusatz', text: `Höchstens ${ZUSATZ_SCHRITTE.length} Zusatz-Schritte.` });
    else if (l.some(x => typeof x !== 'string' || !zusatzSchritt(x))) fehler.push({ feld: 'zusatz', text: 'Unbekannter Zusatz-Schritt.' });
    else zusatz = l.length ? [...new Set(l as string[])] : undefined;
  }
  if (fehler.length) return { fehler };
  return { fehler, e: rein({ id, art: art as EreignisArt, datum: datum!, notiz, beschlussId: alt?.beschlussId, zusatz, angelegt: alt?.angelegt ?? k.jetzt, geloeschtAm: alt?.geloeschtAm }) };
}

function massnahmenLesen(roh: unknown, fehler: RegisterFehler[]): Massnahme[] | undefined {
  const l = Array.isArray(roh) ? roh : [];
  if (l.length > SCHILD_GRENZEN.massnahmen) { fehler.push({ feld: 'massnahmen', text: `Höchstens ${SCHILD_GRENZEN.massnahmen} Maßnahmen je Risiko.` }); return undefined; }
  const raus: Massnahme[] = [];
  for (const x of l) {
    const m = obj(x);
    const id = typeof m.id === 'string' && ID('ms').test(m.id) ? m.id : undefined;
    const text = zeile(m.text, 300);
    if (!id || !text) { fehler.push({ feld: 'massnahmen', text: 'Jede Maßnahme braucht einen Text.' }); continue; }
    const frist = m.frist === undefined || m.frist === null || m.frist === '' ? undefined : istTag(m.frist) ? m.frist : (fehler.push({ feld: 'massnahmen', text: 'Frist als JJJJ-MM-TT.' }), undefined);
    raus.push(rein({ id, text, frist, erledigt: m.erledigt === true ? true as const : undefined }));
  }
  return raus.length ? raus : undefined;
}

function risiko(roh: Record<string, unknown>, alt: Risiko | undefined, id: string, k: Kontext): Ergebnis<Risiko> {
  const fehler: RegisterFehler[] = [];
  const titel = hat(roh, 'titel') ? zeile(roh.titel, 160) : alt?.titel;
  if (!titel || titel.length < 2) fehler.push({ feld: 'titel', text: 'Titel: mindestens 2 Zeichen.' });
  const kategorie = feld(roh, alt?.kategorie, 'kategorie', ausListe(RISIKO_KATEGORIEN), fehler, 'Unbekannte Kategorie.');
  if (!kategorie) fehler.push({ feld: 'kategorie', text: 'Welche Kategorie?' });
  const katalogId = alt?.katalogId ?? (typeof roh.katalogId === 'string' && RISIKO_KATALOG.some(r => r.id === roh.katalogId) ? roh.katalogId : undefined);
  const texte: Partial<Record<'ursache' | 'ereignis' | 'wirkungText' | 'indikator', string>> = {};
  for (const f of ['ursache', 'ereignis', 'wirkungText', 'indikator'] as const) texte[f] = hat(roh, f) ? lang(roh[f], 500, f, fehler) : alt?.[f];
  const behandlung = feld(roh, alt?.behandlung, 'behandlung', ausListe(BEHANDLUNGEN), fehler, 'Unbekannte Behandlung.');
  const massnahmen = hat(roh, 'massnahmen') ? massnahmenLesen(roh.massnahmen, fehler) : alt?.massnahmen;
  const verantwortlich = feld(roh, alt?.verantwortlich, 'verantwortlich', v => (typeof v === 'string' && PERSON.test(v) && k.personen.includes(v) ? v : 'fehler' as const), fehler, 'Verantwortlich: eine Person des Haushalts.');
  const rolle = feld(roh, alt?.rolle, 'rolle', ausListe(ROLLEN), fehler, 'Unbekannte Rolle.');
  const status = feld(roh, alt?.status, 'status', ausListe(RISIKO_STATUS), fehler, 'Unbekannter Status.') ?? 'offen';
  let versicherungIds = alt?.versicherungIds;
  if (hat(roh, 'versicherungIds')) {
    const l = Array.isArray(roh.versicherungIds) ? roh.versicherungIds : [];
    const ok = l.filter((x): x is string => typeof x === 'string' && ID('vs').test(x));
    if (ok.length !== l.length || ok.length > 20) fehler.push({ feld: 'versicherungIds', text: 'Eine Versicherung ist nicht lesbar.' });
    versicherungIds = ok.length ? [...new Set(ok)] : undefined;
  }
  if (fehler.length) return { fehler };
  // Bewertungen ändert nur der eigene Schritt `bewertung` (anhängen) — hier bleiben sie, wie sie sind.
  return { fehler, e: rein({ id, titel: titel!, kategorie: kategorie!, katalogId, ...texte, behandlung, massnahmen, verantwortlich, rolle, status, bewertungen: alt?.bewertungen ?? [], versicherungIds, angelegt: alt?.angelegt ?? k.jetzt, geloeschtAm: alt?.geloeschtAm }) };
}

function marke(roh: Record<string, unknown>, alt: Marke | undefined, id: string, k: Kontext): Ergebnis<Marke> {
  const fehler: RegisterFehler[] = [];
  const bezeichnung = hat(roh, 'bezeichnung') ? zeile(roh.bezeichnung, 160) : alt?.bezeichnung;
  if (!bezeichnung) fehler.push({ feld: 'bezeichnung', text: 'Wie heißt die Marke?' });
  const form = feld(roh, alt?.form, 'form', ausListe(MARKEN_FORMEN), fehler, 'Unbekannte Markenform.');
  const amt = feld(roh, alt?.amt, 'amt', ausListe(MARKEN_AEMTER), fehler, 'Amt: DPMA, EUIPO oder WIPO.');
  const registerNr = hat(roh, 'registerNr') ? zeile(roh.registerNr, 40) : alt?.registerNr;
  const tage: Partial<Record<'anmeldetag' | 'eintragungstag' | 'widerspruchsEnde' | 'schutzBis', string>> = {};
  for (const f of ['anmeldetag', 'eintragungstag', 'widerspruchsEnde', 'schutzBis'] as const) tage[f] = feld(roh, alt?.[f], f, tagLesen, fehler, 'Datum als JJJJ-MM-TT.');
  if (tage.anmeldetag && tage.anmeldetag > k.heute) fehler.push({ feld: 'anmeldetag', text: 'Der Anmeldetag liegt in der Zukunft.' });
  let klassen = alt?.klassen;
  if (hat(roh, 'klassen')) {
    const l = Array.isArray(roh.klassen) ? roh.klassen : String(roh.klassen ?? '').split(/[\s,;]+/).filter(Boolean);
    const n = l.map(Number);
    if (n.some(x => !Number.isInteger(x) || x < 1 || x > 45) || n.length > 45) fehler.push({ feld: 'klassen', text: 'Klassen: Zahlen von 1 bis 45 (Nizza-Klassifikation).' });
    else klassen = n.length ? [...new Set(n)].sort((a, b) => a - b) : undefined;
  }
  const inhaberIstGesellschaft = feld(roh, alt?.inhaberIstGesellschaft, 'inhaberIstGesellschaft', boolLesen, fehler, 'ja oder nein.');
  const dateiIds = dateiIdsLesen(roh, alt?.dateiIds, fehler);
  const notiz = hat(roh, 'notiz') ? lang(roh.notiz, 1000, 'notiz', fehler) : alt?.notiz;
  if (fehler.length) return { fehler };
  return { fehler, e: rein({ id, bezeichnung: bezeichnung!, form, amt, registerNr, ...tage, klassen, inhaberIstGesellschaft, dateiIds, notiz, angelegt: alt?.angelegt ?? k.jetzt, geloeschtAm: alt?.geloeschtAm }) };
}

const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
function domain(roh: Record<string, unknown>, alt: Domain | undefined, id: string, k: Kontext): Ergebnis<Domain> {
  const fehler: RegisterFehler[] = [];
  const d = hat(roh, 'domain') ? String(roh.domain ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : alt?.domain;
  if (!d || !DOMAIN.test(d)) fehler.push({ feld: 'domain', text: 'Domain bitte wie „beispiel.de“.' });
  const registrar = hat(roh, 'registrar') ? zeile(roh.registrar, 80) : alt?.registrar;
  const bools: Partial<Record<'inhaberIstGesellschaft' | 'autoVerlaengerung' | 'zweiFaktor' | 'zugangHinterlegt', boolean>> = {};
  for (const f of ['inhaberIstGesellschaft', 'autoVerlaengerung', 'zweiFaktor', 'zugangHinterlegt'] as const) bools[f] = feld(roh, alt?.[f], f, boolLesen, fehler, 'ja oder nein.');
  const laeuftBis = feld(roh, alt?.laeuftBis, 'laeuftBis', tagLesen, fehler, 'Datum als JJJJ-MM-TT.');
  const zugangWo = hat(roh, 'zugangWo') ? zeile(roh.zugangWo, 120) : alt?.zugangWo;
  const markeId = feld(roh, alt?.markeId, 'markeId', v => (typeof v === 'string' && ID('mk').test(v) ? v : 'fehler' as const), fehler, 'Marke nicht lesbar.');
  const notiz = hat(roh, 'notiz') ? lang(roh.notiz, 1000, 'notiz', fehler) : alt?.notiz;
  if (fehler.length) return { fehler };
  return { fehler, e: rein({ id, domain: d!, registrar, ...bools, laeuftBis, zugangWo, markeId, notiz, angelegt: alt?.angelegt ?? k.jetzt, geloeschtAm: alt?.geloeschtAm }) };
}

function versicherung(roh: Record<string, unknown>, alt: Versicherung | undefined, id: string, k: Kontext): Ergebnis<Versicherung> {
  const fehler: RegisterFehler[] = [];
  const art = feld(roh, alt?.art, 'art', ausListe(VERSICHERUNG_ARTEN), fehler, 'Unbekannte Art.');
  if (!art) fehler.push({ feld: 'art', text: 'Welche Versicherung?' });
  const versicherer = hat(roh, 'versicherer') ? zeile(roh.versicherer, 120) : alt?.versicherer;
  const vertragsNr = hat(roh, 'vertragsNr') ? zeile(roh.vertragsNr, 60) : alt?.vertragsNr;
  const cent: Partial<Record<'deckungFallCent' | 'selbstbehaltCent' | 'praemieJahrCent', number>> = {};
  for (const f of ['deckungFallCent', 'selbstbehaltCent', 'praemieJahrCent'] as const) cent[f] = feld(roh, alt?.[f], f, centLesen, fehler, 'Betrag nicht lesbar (z. B. 1.000.000 oder 450,50).');
  const tage: Partial<Record<'beginn' | 'ablauf' | 'gekuendigtZum', string>> = {};
  for (const f of ['beginn', 'ablauf', 'gekuendigtZum'] as const) tage[f] = feld(roh, alt?.[f], f, tagLesen, fehler, 'Datum als JJJJ-MM-TT.');
  if (tage.beginn && tage.ablauf && tage.ablauf < tage.beginn) fehler.push({ feld: 'ablauf', text: 'Der Ablauf liegt vor dem Beginn.' });
  const verlaengerungMonate = feld(roh, alt?.verlaengerungMonate, 'verlaengerungMonate', ganz(1, 12), fehler, 'Verlängerung: 1 bis 12 Monate (§ 11 Abs. 1 VVG).');
  const kuendigungsfristMonate = feld(roh, alt?.kuendigungsfristMonate, 'kuendigungsfristMonate', ganz(1, 3), fehler, 'Kündigungsfrist: 1 bis 3 Monate (§ 11 Abs. 3 VVG).');
  const nachmeldefristMonate = feld(roh, alt?.nachmeldefristMonate, 'nachmeldefristMonate', ganz(0, 120), fehler, 'Nachmeldefrist: 0 bis 120 Monate.');
  const obliegenheiten = hat(roh, 'obliegenheiten') ? lang(roh.obliegenheiten, 2000, 'obliegenheiten', fehler) : alt?.obliegenheiten;
  const dateiIds = dateiIdsLesen(roh, alt?.dateiIds, fehler);
  const notiz = hat(roh, 'notiz') ? lang(roh.notiz, 1000, 'notiz', fehler) : alt?.notiz;
  if (fehler.length) return { fehler };
  return { fehler, e: rein({ id, art: art!, versicherer, vertragsNr, ...cent, ...tage, verlaengerungMonate, kuendigungsfristMonate, nachmeldefristMonate, obliegenheiten, dateiIds, notiz, angelegt: alt?.angelegt ?? k.jetzt, geloeschtAm: alt?.geloeschtAm }) };
}

function entwurf(roh: Record<string, unknown>, alt: Entwurf | undefined, id: string, k: Kontext): Ergebnis<Entwurf> {
  const fehler: RegisterFehler[] = [];
  if (!alt) return { fehler: [{ feld: 'vorlage', text: 'Entwürfe entstehen aus einer Vorlage („vorlage“).' }] };
  const titel = hat(roh, 'titel') ? zeile(roh.titel, 160) : alt.titel;
  const text = hat(roh, 'text') ? lang(roh.text, SCHILD_GRENZEN.text, 'text', fehler) : alt.text;
  if (fehler.length) return { fehler, status: 413 };
  return { fehler, e: rein({ ...alt, id, titel: titel || alt.titel, text: text ?? '', geaendert: k.jetzt }) };
}

type Saeuberer = (roh: Record<string, unknown>, alt: never, id: string, k: Kontext) => Ergebnis<unknown>;
const SAEUBERER: Record<SchildListe, Saeuberer> = {
  dokumente: dokument as Saeuberer, ereignisse: ereignis as Saeuberer, risiken: risiko as Saeuberer, marken: marke as Saeuberer,
  domains: domain as Saeuberer, versicherungen: versicherung as Saeuberer, entwuerfe: entwurf as Saeuberer,
};

type Eintrag = { id: string; geloeschtAm?: string };
const liste = (s: SchildGesellschaft, l: SchildListe) => (s[l] ?? []) as unknown as Eintrag[];

/** Einen Listeneintrag anlegen (`neueId` vom Server) oder ändern (`eintragId`). */
export function eintragAnwenden(s: SchildGesellschaft, l: SchildListe, roh: unknown, k: Kontext, opt: { eintragId?: string; neueId?: string }): { s?: SchildGesellschaft; fehler: RegisterFehler[]; status?: number } {
  if (!SCHILD_LISTEN.includes(l)) return { fehler: [{ feld: 'liste', text: 'Unbekannte Liste.' }] };
  const alle = liste(s, l);
  const alt = opt.eintragId ? alle.find(e => e.id === opt.eintragId) : undefined;
  if (opt.eintragId && !alt) return { fehler: [{ feld: 'eintragId', text: 'Eintrag nicht gefunden.' }], status: 404 };
  if (!alt && alle.length >= SCHILD_GRENZEN[l]) return { fehler: [{ feld: l, text: `Höchstens ${SCHILD_GRENZEN[l]} Einträge.` }], status: 413 };
  const id = alt?.id ?? opt.neueId!;
  const r = SAEUBERER[l](obj(roh), alt as never, id, k);
  if (r.fehler.length || !r.e) return { fehler: r.fehler, ...(r.status ? { status: r.status } : {}) };
  const neu = alt ? alle.map(e => (e.id === id ? r.e as Eintrag : e)) : [...alle, r.e as Eintrag];
  return { s: { ...s, [l]: neu }, fehler: [] };
}

export type SchildAktion = 'loeschen' | 'wiederherstellen' | 'endgueltig';
export const SCHILD_AKTIONEN: readonly SchildAktion[] = ['loeschen', 'wiederherstellen', 'endgueltig'];
/** Papierkorb (30 Tage) und Wiederherstellen; endgültig nur aus dem Papierkorb. */
export function eintragHandeln(s: SchildGesellschaft, l: SchildListe, eintragId: string, aktion: SchildAktion, jetzt: string): { s?: SchildGesellschaft; fehler: RegisterFehler[]; status?: number } {
  const alle = liste(s, l);
  const e = alle.find(x => x.id === eintragId);
  if (!e) return { fehler: [{ feld: 'eintragId', text: 'Eintrag nicht gefunden.' }], status: 404 };
  if (aktion === 'endgueltig') {
    if (!imPapierkorb(e)) return { fehler: [{ feld: 'aktion', text: 'Endgültig löschen geht nur aus dem Papierkorb.' }], status: 409 };
    return { s: { ...s, [l]: alle.filter(x => x.id !== eintragId) }, fehler: [] };
  }
  const neu = aktion === 'loeschen' ? inPapierkorb(e, jetzt) : ausPapierkorb(e);
  return { s: { ...s, [l]: alle.map(x => (x.id === eintragId ? neu : x)) }, fehler: [] };
}

// ── Profil ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function profilAnwenden(s: SchildGesellschaft, roh: unknown, k: Kontext): { s?: SchildGesellschaft; fehler: RegisterFehler[] } {
  const o = obj(roh), alt = s.profil ?? {}, fehler: RegisterFehler[] = [];
  const p: SchildProfil = {
    beschaeftigte: feld(o, alt.beschaeftigte, 'beschaeftigte', ganz(0, 100_000), fehler, 'Beschäftigte: ganze Zahl ab 0.'),
    umsatzVorjahrCent: feld(o, alt.umsatzVorjahrCent, 'umsatzVorjahrCent', centLesen, fehler, 'Umsatz nicht lesbar (z. B. 450.000).'),
    bilanzsummeCent: feld(o, alt.bilanzsummeCent, 'bilanzsummeCent', centLesen, fehler, 'Bilanzsumme nicht lesbar.'),
    gewinnVorjahrCent: feld(o, alt.gewinnVorjahrCent, 'gewinnVorjahrCent', centLesen, fehler, 'Gewinn nicht lesbar.'),
    groessenklasse: feld(o, alt.groessenklasse, 'groessenklasse', ausListe(GROESSENKLASSEN), fehler, 'Größenklasse: Kleinst, klein, mittel oder groß.'),
    beraten: feld(o, alt.beraten, 'beraten', boolLesen, fehler, 'ja oder nein.'),
    kreativeHonorare: feld(o, alt.kreativeHonorare, 'kreativeHonorare', boolLesen, fehler, 'ja oder nein.'),
    tragfaehigkeitCent: feld(o, alt.tragfaehigkeitCent, 'tragfaehigkeitCent', centLesen, fehler, 'Tragfähigkeit nicht lesbar.'),
    geaendert: k.jetzt,
  };
  if (fehler.length) return { fehler };
  return { s: { ...s, profil: rein(p) }, fehler };
}

// ── Vermerk „erledigt am“ ────────────────────────────────────────────────────────────────────────────────────────

/** Gibt es zu dieser Regel und Periode eine Pflicht? (Regel bekannt; Ereignis-Pflicht am gespeicherten Ereignis; Schwelle „laufend“.) */
export function vermerkZiel(s: SchildGesellschaft, regelId: string, periode: string): boolean {
  if (regelId.startsWith('ev:')) {
    const e = (s.ereignisse ?? []).find(x => x.id === periode && !x.geloeschtAm);
    return !!e && ereignisSchritte(e).some(p => `ev:${p.key}` === regelId);
  }
  if (regelId.startsWith('schwelle:')) return periode === 'laufend' && SCHWELLEN.some(x => `schwelle:${x.id}` === regelId);
  return PFLICHT_REGELN.some(r => r.id === regelId) && /^(\d{4}-\d{2}-\d{2}|\d{4})$/.test(periode);
}

/** Vermerk setzen (`status`) bzw. entfernen (`status: null`). Ein Vermerk je Regel und Periode; `von`/`am` stempelt der Server. */
export function vermerkAnwenden(s: SchildGesellschaft, roh: unknown, k: Kontext, neueId: string): { s?: SchildGesellschaft; fehler: RegisterFehler[]; status?: number } {
  const o = obj(roh);
  const regelId = typeof o.regelId === 'string' ? o.regelId : '', periode = typeof o.periode === 'string' ? o.periode : '';
  if (!/^[a-z0-9:-]{2,60}$/.test(regelId) || !/^[a-z0-9-]{1,60}$/.test(periode)) return { fehler: [{ feld: 'regelId', text: 'Regel und Periode fehlen.' }] };
  if (!vermerkZiel(s, regelId, periode)) return { fehler: [{ feld: 'regelId', text: 'Zu dieser Regel und Periode gibt es keine Pflicht.' }], status: 404 };
  const alle = s.vermerke ?? [];
  const alt = alle.find(v => v.regelId === regelId && v.periode === periode);
  if (o.status === null) return { s: { ...s, vermerke: alle.filter(v => v !== alt) }, fehler: [] };
  if (o.status !== 'erledigt' && o.status !== 'nicht-zutreffend') return { fehler: [{ feld: 'status', text: 'Status: erledigt oder nicht zutreffend.' }] };
  const am = o.am === undefined || o.am === '' ? k.heute : istTag(o.am) && o.am <= k.heute ? o.am : null;
  if (!am) return { fehler: [{ feld: 'am', text: 'Erledigt am: ein Tag bis heute (JJJJ-MM-TT).' }] };
  const belegDokId = o.belegDokId === undefined || o.belegDokId === null || o.belegDokId === '' ? undefined : (s.dokumente ?? []).some(d => d.id === o.belegDokId && !d.geloeschtAm) ? String(o.belegDokId) : null;
  if (belegDokId === null) return { fehler: [{ feld: 'belegDokId', text: 'Beleg nicht gefunden.' }] };
  const fehler: RegisterFehler[] = [];
  const notiz = lang(o.notiz, 500, 'notiz', fehler);
  if (fehler.length) return { fehler, status: 413 };
  if (!alt && alle.length >= SCHILD_GRENZEN.vermerke) return { fehler: [{ feld: 'vermerke', text: `Höchstens ${SCHILD_GRENZEN.vermerke} Vermerke je Gesellschaft.` }], status: 413 };
  const v: Vermerk = rein({ id: alt?.id ?? neueId, regelId, periode, status: o.status, am, von: k.person, notiz, belegDokId });
  return { s: { ...s, vermerke: alt ? alle.map(x => (x === alt ? v : x)) : [...alle, v] }, fehler: [] };
}

// ── Risiko: Bewertung anhängen, Startkatalog übernehmen ──────────────────────────────────────────────────────────

const stufe = (v: unknown): Stufe | null => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n as Stufe : null; };

/** Eine Bewertung ANHÄNGEN (Verlauf, nie überschrieben). `am` = heute, `von` = Person der Sitzung. */
export function bewertungAnwenden(s: SchildGesellschaft, roh: unknown, k: Kontext): { s?: SchildGesellschaft; fehler: RegisterFehler[]; status?: number } {
  const o = obj(roh);
  const r = (s.risiken ?? []).find(x => x.id === o.risikoId && !x.geloeschtAm);
  if (!r) return { fehler: [{ feld: 'risikoId', text: 'Risiko nicht gefunden.' }], status: 404 };
  const eintritt = stufe(o.eintritt), wirkung = stufe(o.wirkung);
  if (!eintritt || !wirkung) return { fehler: [{ feld: 'eintritt', text: 'Eintritt und Wirkung: je 1 bis 5.' }] };
  const art = o.art === 'brutto' ? 'brutto' : 'netto';
  const fehler: RegisterFehler[] = [];
  const wirkungCent = o.wirkungCent === undefined || o.wirkungCent === null || o.wirkungCent === '' ? undefined : centAus(o.wirkungCent);
  if (wirkungCent === 'fehler') return { fehler: [{ feld: 'wirkungCent', text: 'Betrag nicht lesbar.' }] };
  const grund = lang(o.grund, 500, 'grund', fehler);
  if (fehler.length) return { fehler, status: 413 };
  if ((r.bewertungen ?? []).length >= SCHILD_GRENZEN.bewertungen) return { fehler: [{ feld: 'bewertungen', text: `Höchstens ${SCHILD_GRENZEN.bewertungen} Bewertungen je Risiko.` }], status: 413 };
  const b: Bewertung = rein({ am: k.heute, von: k.person, eintritt, wirkung, art, wirkungCent, grund });
  return { s: { ...s, risiken: (s.risiken ?? []).map(x => (x.id === r.id ? { ...x, bewertungen: [...(x.bewertungen ?? []), b] } : x)) }, fehler: [] };
}

/** Startkatalog-Risiken übernehmen (ohne Doppelte — vorhandene `katalogId` bleiben). `neueId()` liefert Kennungen. */
export function katalogUebernehmen(s: SchildGesellschaft, ids: unknown, k: Kontext, neueId: () => string): { s?: SchildGesellschaft; fehler: RegisterFehler[]; status?: number; neu: number } {
  const l = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
  if (!l.length || l.some(x => !RISIKO_KATALOG.some(r => r.id === x))) return { fehler: [{ feld: 'katalog', text: 'Unbekannte Risiken im Katalog.' }], neu: 0 };
  const da = new Set((s.risiken ?? []).filter(r => !r.geloeschtAm).map(r => r.katalogId).filter(Boolean));
  const neu = RISIKO_KATALOG.filter(r => l.includes(r.id) && !da.has(r.id)).map((r): Risiko => ({
    id: neueId(), titel: r.titel, kategorie: r.kategorie, katalogId: r.id, indikator: r.indikator, status: 'offen', bewertungen: [], angelegt: k.jetzt,
    massnahmen: [{ id: `${neueId().replace(/^rk-/, 'ms-')}`, text: r.schild }],
  }));
  if ((s.risiken ?? []).length + neu.length > SCHILD_GRENZEN.risiken) return { fehler: [{ feld: 'risiken', text: `Höchstens ${SCHILD_GRENZEN.risiken} Risiken je Gesellschaft.` }], status: 413, neu: 0 };
  return { s: { ...s, risiken: [...(s.risiken ?? []), ...neu] }, fehler: [], neu: neu.length };
}

// ── Morgenlauf und Konto-Löschen ─────────────────────────────────────────────────────────────────────────────────

/** Was länger als 30 Tage im Papierkorb liegt, geht endgültig (rein). n = 0 → derselbe Stand. */
export function schildAufraeumen(d: SchildDatei | null, jetzt: string): { d: SchildDatei | null; n: number } {
  if (!d?.gesellschaften?.length) return { d, n: 0 };
  let n = 0;
  const gesellschaften = d.gesellschaften.map(g => {
    let neu = g;
    for (const l of SCHILD_LISTEN) {
      const alle = (g[l] ?? []) as unknown as Eintrag[];
      const bleibt = alle.filter(e => !papierkorbAbgelaufen(e, jetzt));
      if (bleibt.length !== alle.length) { n += alle.length - bleibt.length; neu = { ...neu, [l]: bleibt }; }
    }
    return neu;
  });
  return n ? { d: { ...d, gesellschaften }, n } : { d, n: 0 };
}

export const GETILGT = '[gelöscht]';
/**
 * Konto gelöscht (Art. 17, lib/datenschutz/konto-daten.ts): „wer“ (`von` an Vermerken, Bewertungen, Entwürfen; `verantwortlich`;
 * `geaendertVon`) wird „[gelöscht]“ — die Einträge bleiben (Geschäftsunterlagen des Haushalts). Rein; n = Zahl der Umschreibungen.
 */
export function schildOhnePerson(d: SchildDatei, speicher: string): { neu: SchildDatei; n: number } {
  let n = 0;
  const t = <T extends { von?: string }>(x: T): T => (x.von === speicher ? (n++, { ...x, von: GETILGT }) : x);
  const gesellschaften = d.gesellschaften.map(g => ({
    ...g,
    ...(g.geaendertVon === speicher ? (n++, { geaendertVon: GETILGT }) : {}),
    ...(g.vermerke ? { vermerke: g.vermerke.map(t) } : {}),
    ...(g.entwuerfe ? { entwuerfe: g.entwuerfe.map(t) } : {}),
    ...(g.risiken ? { risiken: g.risiken.map(r => ({ ...(r.verantwortlich === speicher ? (n++, { ...r, verantwortlich: undefined }) : r), bewertungen: (r.bewertungen ?? []).map(t) })).map(r => rein(r) as Risiko) } : {}),
  }));
  return { neu: { ...d, gesellschaften }, n };
}

