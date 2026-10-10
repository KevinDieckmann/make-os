// ─── Head of Recht: Server — Zugang, Bestand, Morgenlauf, Vertragseingang, Anwalts-Mappe, Freigabe (10.10.) ───────────────────────────
// Liest NUR über die vorhandenen Wege: Unternehmen › Schild (`unternehmenLage`, `ladeSchild`, Schreibstelle `schildAendern`), Gesellschafts-Register
// (`ladeRegister`, Schreibstelle `registerAendern`), System › Datenschutz (Selbstprüfung + Umfeld — nur Zähler), die verschlüsselte Ablage (`lesen`,
// `ablegen`), der Freigabe-Stapel (`lege`/`beanspruche`/`entscheide`, Art `recht`). Eigener Bestand nur `recht-check--<haushalt>` (Business): der letzte
// Wochen-Check, vorbereitete Risikorunden, Marken gegen Wiederholung, Checklisten-Riegel je Datei, Kennungen erstellter Mappen.
//
// ZUGANG (wie Unternehmen › Schild, app/api/gesellschaften/schild): nur der Haushalt des Inhabers mit vollem Haushaltszugang — ein Konto „nur Business“
// (`finanzRecht: 'business'`) sieht die Firmen-Akte nicht (`rechtZugangFuer`). Die Sicht Privat bekommt nichts (Route unter `gesellschaften` = Business,
// lib/zugang/sicht-bereich.ts; der Head ist ein Business-Head). Nichts verlässt das System: kein Versand, keine Einreichung, keine Unterschrift — jede
// Wirkung erst nach dem Klick im Stapel. Hinweis, keine Rechtsberatung.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { WEG } from '@/lib/wege';
import { istGesellschaft, type GesellschaftId } from '@/lib/einheiten';
import { aktiveEintraege, gesellschaftVon, vertragsStichtage, vertragArtLabel, type RegisterDatei } from '@/lib/gesellschaften/modell';
import { schildGesellschaften, eintragVon, type Lage } from '@/lib/gesellschaften/schild/ampel';
import { katalogUebernehmen } from '@/lib/gesellschaften/schild/saeubern';
import { SCHILD_GRENZEN } from '@/lib/gesellschaften/schild/typen';
import type { Vorschlag } from '@/lib/zoe/stapel';
import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import { wochenCheck, wocheFaellig, neueVorschlaege, rechtHash } from './check';
import { rundeBrauchtVorbereitung, rundeVorbereiten } from './risikorunde';
import { vertragCheckliste, checklisteText, fristArtText } from './vertrag-checkliste';
import { mappeBauen, mappeDateiname, themaAus, fragenPruefen } from './mappe';
import {
  CHECKLISTE_HINWEIS, RECHT_GRENZEN, RECHT_HEAD, RECHT_HINWEIS, rechtName, vorschlagFuss,
  type CheckVorschlag, type Checkliste, type DatenschutzZahlen, type MappeThema, type RechtStand, type WochenCheck,
} from './typen';

// ── Zugang ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Darf diese Person die Firmen-Akte (und damit den Head of Recht mit Daten) sehen? Haushalt des Inhabers + voller Haushaltszugang. */
export async function rechtZugangFuer(person: string | null | undefined): Promise<{ person: string; haushalt: string } | null> {
  if (!person) return null;
  const [{ personImHaushaltDesInhabers }, { haushaltFuer }] = await Promise.all([import('@/lib/zugang/haushalt-inhaber'), import('@/lib/finanzen/haushalt/zugriff')]);
  if (!(await personImHaushaltDesInhabers(person))) return null;
  const h = await haushaltFuer(person);
  return h ? { person, haushalt: h.haushalt } : null;
}

/** Konten des Haushalts mit Zugang zur Firmen-Akte (für die Glocke) — nie Konten „nur Business“. */
export async function rechtPersonen(haushalt: string): Promise<string[]> {
  const { ladeKonten } = await import('@/lib/zugang/konten');
  return (await ladeKonten()).konten.filter(k => k.haushalt === haushalt && k.finanzRecht !== 'business').map(k => k.speicher);
}

/** Name des Heads (aus dem Katalog — nie fest im Code) für Anlässe im Stapel („Head of Recht: …“ → Zähler je Head). */
async function headName(): Promise<string> {
  return (await import('@/lib/agenten/katalog')).headDef(RECHT_HEAD)?.name ?? 'Recht';
}

// ── Bestand ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function ladeRechtStand(haushalt: string): Promise<RechtStand> {
  const roh = await loadJson<RechtStand>(rechtName(haushalt));
  return roh && typeof roh === 'object' ? { ...roh, v: 1 } : { v: 1 };
}
async function rechtAendern(haushalt: string, mut: (s: RechtStand) => RechtStand): Promise<RechtStand> {
  return updateJson<RechtStand>(rechtName(haushalt), cur => mut(cur && typeof cur === 'object' ? { ...cur, v: 1 } : { v: 1 }));
}
/** Marken nie still kürzen: über der Grenze fallen die ÄLTESTEN (sie verhindern nur eine Wiederholung). */
const markenKappen = (m: Record<string, string>): Record<string, string> => {
  const e = Object.entries(m);
  return e.length <= RECHT_GRENZEN.marken ? m : Object.fromEntries(e.sort((a, b) => b[1].localeCompare(a[1])).slice(0, RECHT_GRENZEN.marken));
};
/** Marken setzen (Beschluss-Buch, lib/gesellschaften/beschluss-server.ts: Folgen eines Beschlusses höchstens einmal im Stapel). */
export async function rechtMarkenSetzen(haushalt: string, schluessel: readonly string[], heute = localDay()): Promise<void> {
  if (!schluessel.length) return;
  await rechtAendern(haushalt, s => ({ ...s, marken: markenKappen({ ...(s.marken ?? {}), ...Object.fromEntries(schluessel.map(k => [k, heute])) }) }));
}

// ── Datenschutz & Compliance: nur Zähler (System › Datenschutz) ─────────────────────────────────────────────────────────

/** Selbstprüfung + Empfänger-/AVV-Register + Verzeichnis + Pannen — NUR Zahlen und Titel der Prüfpunkte, nie Inhalte Betroffener. Wirft nicht. */
export async function datenschutzZahlen(heute = localDay()): Promise<DatenschutzZahlen | null> {
  try {
    const [{ kontakteFuerVerarbeitung }, { ladeCrm }, { ladeKonten }, { selbstpruefung }, { LOESCHFRISTEN_SPEICHER, fristenWirksam }, { datenschutzUmfeld }, { avvOffen, drittlandOhneGarantie }] = await Promise.all([
      import('@/lib/crm/verarbeitung'), import('@/lib/crm/speicher'), import('@/lib/zugang/konten'), import('@/lib/crm/datenschutz'), import('@/lib/crm/loeschfristen'), import('@/lib/datenschutz/umfeld'), import('@/lib/datenschutz/einrichtung'),
    ]);
    const fristen = fristenWirksam(((await loadJson<import('@/lib/crm/loeschfristen').LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER)) ?? {}).fristen);
    const konten = (await ladeKonten()).konten;
    const [kontakte, crm, umfeld] = await Promise.all([kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), ladeCrm(), datenschutzUmfeld()]);
    const p = selbstpruefung(kontakte, crm, heute, { konten: konten.length, mitPasswort: konten.filter(k => !!k.hash).length }, fristen.kontakte, umfeld);
    const empfaenger = umfeld.empfaenger.filter(e => !e.archiviert);
    return {
      erfuellt: p.filter(x => x.status === 'erfuellt').length, gesamt: p.length, offen: p.filter(x => x.status !== 'erfuellt').map(x => x.titel),
      empfaenger: empfaenger.length, avvOffen: avvOffen(empfaenger).length, drittlandOhneGarantie: drittlandOhneGarantie(empfaenger).length,
      verzeichnis: (crm.verarbeitungen ?? []).filter(v => !v.archiviert).length,
      pannen: umfeld.pannen ?? null,
    };
  } catch (e) {
    console.error('[recht] Datenschutz-Zähler nicht lesbar:', e instanceof Error ? e.message.slice(0, 120) : e);
    return null;
  }
}

// ── Lage und Wochen-Check ───────────────────────────────────────────────────────────────────────────────────────────────

/** Stichtage der Verträge der Business-Gesellschaften (nie einer Privat-Einheit). */
function businessVertragsFristen(register: RegisterDatei | null): ReturnType<typeof vertragsStichtage> {
  return vertragsStichtage(schildGesellschaften(register));
}

/** Der Check JETZT (nur lesen, nichts gespeichert): Lage wie die Oberfläche + Vertragsfristen + Beschlüsse ohne Anmeldung/Eintragung + Datenschutz-Zähler. */
export async function rechtCheckJetzt(haushalt: string, heute = localDay()): Promise<{ lage: Lage; check: WochenCheck }> {
  const [{ unternehmenLage }, { ladeRegister }, { beschluesseOhneEintragung }] = await Promise.all([
    import('@/lib/gesellschaften/schild-server'), import('@/lib/gesellschaften/server'), import('@/lib/gesellschaften/beschluesse'),
  ]);
  const [lage, register, datenschutz] = await Promise.all([unternehmenLage(haushalt, heute), ladeRegister(haushalt), datenschutzZahlen(heute)]);
  // Beschluss-Buch (10.10.): nur die Business-Gesellschaften des Schilds — nie die Privat-Einheit.
  const beschluesse = beschluesseOhneEintragung(schildGesellschaften(register), heute);
  return { lage, check: wochenCheck({ lage, vertragsFristen: businessVertragsFristen(register), datenschutz, heute, beschluesse }) };
}

const AUFGABE_PRAEFIX = 'rcw-';
/** Kennung der Aufgabe zu einem Check-Vorschlag (fest — idempotent). */
export const checkAufgabeId = (schluessel: string) => `${AUFGABE_PRAEFIX}${rechtHash(schluessel)}`;
/** Ist diese Aufgaben-Kennung eine des Head of Recht? (Telegram-Text neutral, lib/meldungen/speicher.ts.) */
export const istRechtAufgabe = (id: string) => id.startsWith(AUFGABE_PRAEFIX);

/**
 * Morgenlauf (einmal je ISO-Woche bzw. je Gesellschaft und Quartal; idempotent über den Bestand): der Wochen-Check als Bericht (gespeichert, Glocke an
 * die Personen mit Zugang zur Firmen-Akte) und seine Vorschläge im Stapel; die Vorbereitung der Risikorunde je Gesellschaft, deren Runde fällig ist,
 * mit Vorschlägen für neue Katalog-Risiken. Ohne Modell. Wirft nie.
 */
export async function rechtMorgenlauf(haushalt: string, heute = localDay()): Promise<{ check: boolean; vorschlaege: number; runden: number }> {
  try {
    const stand = await ladeRechtStand(haushalt);
    const [{ ladeSchild }, { lage, check }] = await Promise.all([import('@/lib/gesellschaften/schild-server'), rechtCheckJetzt(haushalt, heute)]);
    const schild = await ladeSchild(haushalt);
    const woche = wocheFaellig(stand, heute);
    // Vorschläge nur, wenn der Check dran ist — und ohne die, deren Aufgabe es schon gibt.
    let neu: CheckVorschlag[] = [];
    if (woche && check.vorschlaege.length) {
      const { ladeAufgabenSicht } = await import('@/lib/aufgaben/sicht');
      const tasks = (await ladeAufgabenSicht(null).catch(() => null))?.tasks ?? [];
      const da = new Set(check.vorschlaege.filter(v => tasks.some(t => t.id === checkAufgabeId(v.schluessel))).map(v => v.schluessel));
      neu = neueVorschlaege(check.vorschlaege, stand.marken, heute, da);
    }
    const runden = lage.gesellschaften.filter(g => rundeBrauchtVorbereitung(g, eintragVon(schild, g.id), stand.runden?.[g.id]))
      .map(g => rundeVorbereiten(g, eintragVon(schild, g.id), heute));
    if (!woche && !runden.length) return { check: false, vorschlaege: 0, runden: 0 };

    const { lege } = await import('@/lib/zoe/stapel');
    const name = await headName();
    let gelegt = 0;
    for (const v of neu) {
      await lege({
        werkzeug: v.art === 'mappe' ? 'recht_mappe' : 'recht_aufgabe', gruppe: 'business', titel: v.titel, nachher: v.art === 'mappe' ? 'Anwalts-Mappe als PDF in die Ablage der Gesellschaft — weitergegeben wird nur von Hand' : `Aufgabe anlegen (Business): ${v.text.slice(0, 180)}`,
        eingabe: { schluessel: v.schluessel, ...(v.gesellschaftId ? { gesellschaftId: v.gesellschaftId } : {}), titel: v.titel, text: `${v.text}\n\n${vorschlagFuss(check.stand)}`, weg: v.weg },
        anlass: `${name}: Recht-Check ${check.kw.replace('-W', ' · KW ')}`, quelle: 'lauf', bezug: { art: 'recht', id: `${v.art}-${rechtHash(v.schluessel)}` },
      });
      gelegt++;
    }
    for (const r of runden) {
      for (const k of r.neueRisiken.slice(0, 6)) {
        const schluessel = `risiko:${r.gesellschaftId}:${k.katalogId}`;
        if (stand.marken?.[schluessel]) continue;
        await lege({
          werkzeug: 'recht_risiko', gruppe: 'business', titel: `Risiko prüfen: „${k.titel}“ — ${r.name}`, vorher: 'nicht im Risiko-Register', nachher: `Aus dem Startkatalog (${k.katalogId}) ins Register übernehmen — bewertet wird im Schild`,
          eingabe: { schluessel, gesellschaftId: r.gesellschaftId, katalogId: k.katalogId, grund: k.grund },
          anlass: `${name}: Risikorunde ${r.quartal.replace('-', ' ')} — ${k.grund}`.slice(0, 200), quelle: 'lauf', bezug: { art: 'recht', id: `risiko-${rechtHash(schluessel)}` },
        });
        neu.push({ schluessel, art: 'aufgabe', titel: '', text: '', weg: '' });
        gelegt++;
      }
    }
    const jetzt = new Date().toISOString();
    await rechtAendern(haushalt, s => ({
      ...s,
      ...(woche ? { woche: { kw: check.kw, am: jetzt, check } } : {}),
      runden: { ...(s.runden ?? {}), ...Object.fromEntries(runden.map(r => [r.gesellschaftId, { quartal: r.quartal, am: jetzt, vorbereitung: r }])) },
      marken: markenKappen({ ...(s.marken ?? {}), ...Object.fromEntries(neu.map(v => [v.schluessel, heute])) }),
    }));
    // Glocke (Art „vertrag“ = immer Business, lib/meldungen/regeln.ts — keine neue Art, die den Rückweg bräche; Bezug `rck-…` = Kennung des Laufs,
    // keine Aufgabe: entdoppelt je Woche/Quartal und macht den Messenger-Text neutral), nur an Personen mit Zugang zur Firmen-Akte.
    const { melde } = await import('@/lib/meldungen/melden');
    for (const an of await rechtPersonen(haushalt)) {
      if (woche) await melde({ an, art: 'vertrag', titel: `${name}: Recht-Check ${check.kw.replace('-W', ' · KW ')} liegt bereit${gelegt ? ` — ${gelegt} Vorschl${gelegt === 1 ? 'ag' : 'äge'} im Stapel` : ''}`, link: WEG.schild('ueberblick'), bezug: { art: 'aufgabe', id: `rck-${check.kw}` } });
      if (runden.length) await melde({ an, art: 'vertrag', titel: `${name}: Risikorunde vorbereitet (${runden.length} Gesellschaft${runden.length === 1 ? '' : 'en'}) — bewertet wird im Schild`, link: WEG.schild('risiken'), bezug: { art: 'aufgabe', id: `rck-runde-${runden[0].quartal}` } });
    }
    return { check: woche, vorschlaege: gelegt, runden: runden.length };
  } catch (e) {
    console.error('[recht] Morgenlauf:', e instanceof Error ? e.message : e);
    return { check: false, vorschlaege: 0, runden: 0 };
  }
}

// ── Vertragseingang → Checkliste (Regelwerk, kein Modell) ───────────────────────────────────────────────────────────────

export class RechtFehler extends Error { constructor(msg: string, readonly status: 400 | 403 | 404 | 409 | 413) { super(msg); } }

/** Führt das Schild diese Gesellschaft (Business, nicht im Papierkorb)? Sonst RechtFehler. */
async function businessGesellschaft(haushalt: string, gid: string) {
  const [{ ladeRegister }, { schildZiel }] = await Promise.all([import('@/lib/gesellschaften/server'), import('@/lib/gesellschaften/schild-server')]);
  const register = await ladeRegister(haushalt);
  const z = schildZiel(register, gid);
  if (!z.g) throw new RechtFehler(z.fehler?.[0]?.text ?? 'Gesellschaft nicht gefunden.', z.status === 400 ? 400 : 404);
  return { register, g: z.g };
}

/**
 * Die Checkliste einer Unterlage der Gesellschaft (Datei der Ablage mit Bezug auf eine BUSINESS-Gesellschaft) — Text auslesen, Regelwerk anwenden.
 * Für den Vertragseingang (Morgen- bzw. Upload-Weg) und das Werkzeug des Heads. `text` nur für das Werkzeug (Volltext gekapselt).
 */
export async function checklisteFuerDatei(haushalt: string, dateiId: string): Promise<{ gesellschaftId: GesellschaftId; titel: string; checkliste: Checkliste; text: string; vertragId?: string; umfang?: string }> {
  const [{ lesen, AblageFehler }, { textAuslesen, NichtLesbar }] = await Promise.all([import('@/lib/dateien/ablage'), import('@/lib/dateien/text-auslesen')]);
  let d: Awaited<ReturnType<typeof lesen>>;
  try { d = await lesen(haushalt, dateiId); } catch (e) { if (e instanceof AblageFehler) throw new RechtFehler(e.message, 400); throw e; }
  if (!d?.eintrag.gesellschaft || !d.eintrag.datei) throw new RechtFehler('Diese Unterlage gibt es in der Ablage einer Gesellschaft nicht.', 404);
  const { register, g } = await businessGesellschaft(haushalt, d.eintrag.gesellschaft);
  // Nur Verträge bzw. Unterlagen der Firmen-Akte — nie das Logo, nie eine Kontakt- oder Kunden-Datei.
  if (d.eintrag.id === g.logoDateiId) throw new RechtFehler('Das ist das Logo der Gesellschaft — keine Vertragsunterlage.', 400);
  const vertrag = aktiveEintraege(gesellschaftVon(register, g.id)?.vertraege).find(v => (v.dateiIds ?? []).includes(dateiId));
  let text = '', hinweis: string | undefined, umfang: string | undefined;
  try {
    const a = await textAuslesen(d.bytes, d.eintrag.datei.typ);
    if (a) { text = a.text; umfang = a.umfang; hinweis = a.hinweis; } else hinweis = 'Bild — kein lesbarer Text. Die Checkliste bitte selbst durchgehen.';
  } catch (e) {
    if (!(e instanceof NichtLesbar)) throw e;
    hinweis = `Text nicht lesbar: ${e.message}`;
  }
  const c = vertragCheckliste(text);
  const titel = vertrag ? (vertrag.titel || vertragArtLabel(vertrag.art)) : (d.eintrag.titel || d.eintrag.datei.name);
  return { gesellschaftId: g.id, titel, checkliste: { ...c, ...(hinweis ? { hinweis: [hinweis, c.hinweis].filter(Boolean).join(' ') } : {}) }, text, ...(vertrag ? { vertragId: vertrag.id } : {}), ...(umfang ? { umfang } : {}) };
}

/**
 * Ein Vertrag wurde hochgeladen (Unternehmen › Verträge, Datei-Art „vertrag“): Checkliste als Vorschlag für die hochladende Person (Freigabe → Entwurf
 * in der Firmen-Akte) und je erkanntem Stichtag ein Vorschlag „Vertragsfrist eintragen“ (Freigabe → Stichtag am Vertrag → Kalender, Erinnerung).
 * Einmal je Datei (Riegel im Bestand). Ohne Modell. Wirft nie.
 */
export async function vertragEingang(haushalt: string, person: string, dateiId: string): Promise<{ vorschlaege: number; uebersprungen?: string }> {
  try {
    if (!(await rechtZugangFuer(person))) return { vorschlaege: 0, uebersprungen: 'kein Zugang zur Firmen-Akte' };
    const stand = await ladeRechtStand(haushalt);
    if (stand.vertraege?.[dateiId]) return { vorschlaege: 0, uebersprungen: 'schon geprüft' };
    const r = await checklisteFuerDatei(haushalt, dateiId);
    const { lege } = await import('@/lib/zoe/stapel');
    const name = await headName();
    const anlass = `${name}: neuer Vertrag „${r.titel}“`.slice(0, 200);
    const gefunden = r.checkliste.punkte.filter(p => p.fundstellen.length).length;
    await lege({
      werkzeug: 'recht_checkliste', gruppe: 'business', titel: `Checkliste zum Vertrag „${r.titel}“`.slice(0, 200), vorher: 'neu hochgeladen',
      nachher: `${gefunden} von ${r.checkliste.punkte.length} Punkten mit Fundstelle${r.checkliste.fristen.length ? ` · ${r.checkliste.fristen.length} Stichtag${r.checkliste.fristen.length === 1 ? '' : 'e'} erkannt` : ''} — als Entwurf in die Firmen-Akte`,
      eingabe: { gesellschaftId: r.gesellschaftId, dateiId, titel: r.titel, text: checklisteText(r.checkliste, `Checkliste: ${r.titel}`, CHECKLISTE_HINWEIS) },
      anlass, quelle: 'lauf', person, bezug: { art: 'recht', id: `checkliste-${rechtHash(dateiId)}` },
    });
    let n = 1;
    for (const f of r.checkliste.fristen.slice(0, 3)) {
      await lege({
        werkzeug: 'recht_frist', gruppe: 'business', titel: `Vertragsfrist eintragen: ${fristArtText(f.art)} ${f.datum.slice(8, 10)}.${f.datum.slice(5, 7)}.${f.datum.slice(0, 4)} — ${r.titel}`.slice(0, 200),
        nachher: 'Stichtag am Vertrag (Kalender, Erinnerung) — erst nach deinem Klick',
        eingabe: { gesellschaftId: r.gesellschaftId, dateiId, datum: f.datum, art: f.art, zitat: f.zitat, ...(f.art === 'kuendigung' && r.checkliste.kuendigungsfrist ? { kuendigungsfrist: r.checkliste.kuendigungsfrist } : {}) },
        anlass, quelle: 'lauf', person, bezug: { art: 'recht', id: `frist-${rechtHash(`${dateiId}|${f.datum}|${f.art}`)}` },
      });
      n++;
    }
    const heute = localDay();
    await rechtAendern(haushalt, s => {
      const v = { ...(s.vertraege ?? {}), [dateiId]: { am: heute, gesellschaftId: r.gesellschaftId } };
      const e = Object.entries(v);
      return { ...s, vertraege: e.length <= RECHT_GRENZEN.vertraege ? v : Object.fromEntries(e.sort((a, b) => b[1].am.localeCompare(a[1].am)).slice(0, RECHT_GRENZEN.vertraege)) };
    });
    const { melde } = await import('@/lib/meldungen/melden');
    await melde({ an: person, art: 'vertrag', titel: `${name}: Checkliste zum neuen Vertrag liegt im Stapel`, link: WEG.freigaben(undefined, 'business'), bezug: { art: 'aufgabe', id: `rck-v-${rechtHash(dateiId)}` } });
    return { vorschlaege: n };
  } catch (e) {
    console.error('[recht] Vertragseingang:', e instanceof Error ? e.message : e);
    return { vorschlaege: 0, uebersprungen: e instanceof RechtFehler ? e.message : 'Fehler' };
  }
}

// ── Anwalts-Mappe ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Namen für die Mappe (`art:id` → Name): Personen des Haushalts, eigene Gesellschaften, Kontakte/Firmen (eingeschränkte Kontakte fehlen, Art. 18). */
export async function rechtNamen(register: RegisterDatei | null, haushalt: string): Promise<Record<string, string>> {
  const [{ ladeKonten }, { alleGesellschaften, anzeigeName }] = await Promise.all([import('@/lib/zugang/konten'), import('@/lib/gesellschaften/modell')]);
  const namen: Record<string, string> = {};
  for (const k of (await ladeKonten()).konten.filter(x => x.haushalt === haushalt)) namen[`person:${k.speicher}`] = k.name || k.speicher;
  const alle = alleGesellschaften(register, { mitPapierkorb: true });
  for (const g of alle) namen[`gesellschaft:${g.id}`] = anzeigeName(g);
  const bezuege = alle.flatMap(g => [...(g.gesellschafter ?? []).map(x => x.wer), ...(g.organe ?? []).map(x => x.wer), ...(g.vertraege ?? []).flatMap(v => v.parteien)]);
  const kontakte = new Set(bezuege.filter(b => b.art === 'kontakt').map(b => b.id));
  const firmen = new Set(bezuege.filter(b => b.art === 'firma').map(b => b.id));
  if (kontakte.size) {
    // Art. 18: eingeschränkte Kontakte fehlen hier bewusst — die Mappe ist eine Weiterverarbeitung (Name nur „Kontakt (… eingeschränkt)“).
    const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
    for (const k of await kontakteFuerVerarbeitung()) if (kontakte.has(k.id)) namen[`kontakt:${k.id}`] = `${k.vorname ?? ''} ${k.nachname ?? ''}`.replace(/\s+/g, ' ').trim() || 'Kontakt ohne Namen';
  }
  if (firmen.size) for (const f of (await (await import('@/lib/crm/speicher')).ladeCrm()).firmen) if (firmen.has(f.id)) namen[`firma:${f.id}`] = f.name;
  return namen;
}

/**
 * Die Anwalts-Mappe erstellen (nur per Klick — Knopf bzw. Freigabe im Stapel): PDF mit Sachverhalt, Beteiligten, Dokumenten, Fristen, Schritten, offenen
 * Fragen und den Unterlagen als Anlagen — verschlüsselt in die Ablage der Gesellschaft. Verschickt wird NICHTS.
 */
export async function mappeErstellen(haushalt: string, person: string, themaRoh: unknown, fragenRoh: unknown, jetzt = new Date()): Promise<{ datei: { id: string; name: string }; eingebunden: number; ausgelassen: number }> {
  const thema = themaAus(themaRoh);
  if (!thema) throw new RechtFehler('thema: { art: gesellschaft | vertrag | risiko, gesellschaftId, vertragId bzw. risikoId }.', 400);
  const f = fragenPruefen(fragenRoh);
  if ('fehler' in f) throw new RechtFehler(f.fehler, 413);
  const heute = localDay(jetzt);
  const { register, g } = await businessGesellschaft(haushalt, thema.gesellschaftId);
  const [{ ladeSchild, unternehmenLage }, { ablageListe, lesen, ablegen }, { nurCrm }] = await Promise.all([
    import('@/lib/gesellschaften/schild-server'), import('@/lib/dateien/ablage'), import('@/lib/dateien/regeln'),
  ]);
  const [schild, lage, liste] = await Promise.all([ladeSchild(haushalt), unternehmenLage(haushalt, heute), ablageListe(haushalt)]);
  const ablage = nurCrm(liste).filter(e => e.gesellschaft === g.id && !!e.datei);
  const r = mappeBauen({
    thema, g, s: eintragVon(schild, g.id), lage: lage.gesellschaften.find(x => x.id === g.id), heute, fragen: f.fragen, namen: await rechtNamen(register, haushalt),
    ablage: ablage.map(e => ({ id: e.id, ...(e.titel ? { titel: e.titel } : {}), name: e.datei!.name, hochgeladenAm: e.hochgeladenAm })),
  });
  if ('fehler' in r) throw new RechtFehler(r.fehler, r.status);
  const typen = new Map(ablage.map(e => [e.id, e.datei!.typ]));
  const anlagen = [];
  for (const a of r.dok.anlagen) {
    const x = await lesen(haushalt, a.dateiId).catch(() => null);
    anlagen.push({ ...a, typ: typen.get(a.dateiId), ...(x ? { bytes: x.bytes } : { grund: 'liegt nicht (mehr) in der Ablage' }) });
  }
  const { mappePdf } = await import('./mappe-pdf');
  const pdf = await mappePdf(r.dok, anlagen, { erstellt: jetzt });
  const name = mappeDateiname(r.dok);
  const e = await ablegen(haushalt, person, { art: 'sonstig', titel: r.dok.titel.slice(0, 160) }, { bytes: Buffer.from(pdf.bytes), name, typ: 'application/pdf' }, jetzt.toISOString(), { gesellschaft: g.id });
  await rechtAendern(haushalt, s => ({ ...s, mappen: [{ dateiId: e.id, am: heute, thema }, ...(s.mappen ?? [])].slice(0, RECHT_GRENZEN.mappen) }));
  return { datei: { id: e.id, name }, eingebunden: pdf.eingebunden, ausgelassen: pdf.ausgelassen };
}

// ── Freigabe im Stapel (Art „recht“, lib/zoe/stapel-arten.ts) ───────────────────────────────────────────────────────────

/** Die „Werkzeuge“ der Art — nur Etiketten im Stapel (keine Register-Werkzeuge). */
export const RECHT_STAPEL_WERKZEUGE = ['recht_aufgabe', 'recht_mappe', 'recht_risiko', 'recht_checkliste', 'recht_frist', 'recht_beschluss_ereignis', 'recht_beschluss_fassung', 'recht_beschluss_captable'] as const;

type Erg = Awaited<ReturnType<StapelArtFreigabe['freigeben']>>;
const nein = (status: 400 | 403 | 404 | 409 | 413, fehler: string): Erg => ({ ok: false, status, fehler });
const text = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, n) : '');

/** Eine Aufgabe aus einem Check-Vorschlag (feste Kennung → idempotent). */
async function aufgabeAnlegen(v: Vorschlag, person: string): Promise<string> {
  const schluessel = text(v.eingabe.schluessel, 300);
  if (!schluessel) throw new RechtFehler('Vorschlag ohne Schlüssel.', 400);
  const id = checkAufgabeId(schluessel);
  const gid = text(v.eingabe.gesellschaftId, 80);
  const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
  const jetzt = new Date().toISOString();
  let schonDa = false;
  await systemAufgabenAendern(stand => {
    schonDa = stand.tasks.some(t => t.id === id);
    if (schonDa) return { neu: [], teile: [] };
    return {
      neu: [{
        id, title: text(v.eingabe.titel, 280) || v.titel.slice(0, 280), description: text(v.eingabe.text, 3800), status: 'todo', priority: 'medium', assignee: person,
        notiz: `[Im Bereich öffnen](${text(v.eingabe.weg, 300) || WEG.schild('ueberblick')})`, tags: ['unternehmen', 'recht'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, space: 'business',
        ...(gid && istGesellschaft(gid) ? { spaceId: gid } : {}),
      }],
      teile: [],
    };
  }, { person, jetzt });
  return schonDa ? 'Die Aufgabe gibt es schon — nichts doppelt angelegt.' : 'Aufgabe angelegt (Business) — sie steht unter Aufgaben.';
}

/** Ein Katalog-Risiko ins Register der Gesellschaft übernehmen (über die Schreibstelle des Schilds, mit Stand). */
async function risikoUebernehmen(v: Vorschlag, haushalt: string, person: string): Promise<string> {
  const gid = text(v.eingabe.gesellschaftId, 80), katalogId = text(v.eingabe.katalogId, 8);
  const [{ schildAendern, ladeSchild, schildEintrag, schildStand }, { ladeKonten }] = await Promise.all([import('@/lib/gesellschaften/schild-server'), import('@/lib/zugang/konten')]);
  const personen = (await ladeKonten()).konten.filter(k => k.haushalt === haushalt).map(k => k.speicher);
  for (let versuch = 0; versuch < 2; versuch++) {
    const stand = schildStand(schildEintrag(await ladeSchild(haushalt), gid as GesellschaftId));
    let neu = 0;
    const r = await schildAendern(haushalt, person, gid, stand, { art: 'person', person }, alt => {
      const x = katalogUebernehmen(alt, [katalogId], { person, jetzt: new Date().toISOString(), heute: localDay(), personen }, () => neueKennung('rk'));
      neu = x.neu;
      return x.s && x.neu ? { s: x.s } : x.fehler.length ? { fehler: x.fehler, ...(x.status ? { status: x.status } : {}) } : { fehler: [{ feld: 'katalog', text: 'Dieses Risiko steht schon im Register.' }], status: 409 };
    });
    if (r.konflikt) continue;
    if (r.fehler?.length) throw new RechtFehler(r.fehler.map(x => x.text).join(' · '), (r.status === 413 ? 413 : r.status === 404 ? 404 : r.status === 409 ? 409 : 400));
    return neu ? 'Ins Risiko-Register übernommen — bewerten unter Unternehmen › Risiken.' : 'Nichts übernommen.';
  }
  throw new RechtFehler('Das Schild wurde gerade geändert — bitte noch einmal freigeben.', 409);
}

/** Die Checkliste als Entwurf in die Firmen-Akte (Unternehmen › Dokumente › Entwürfe). */
async function checklisteAblegen(v: Vorschlag, haushalt: string, person: string): Promise<string> {
  const gid = text(v.eingabe.gesellschaftId, 80), titel = `Checkliste: ${text(v.eingabe.titel, 140)}`, inhalt = typeof v.eingabe.text === 'string' ? v.eingabe.text : '';
  if (inhalt.length > SCHILD_GRENZEN.text) throw new RechtFehler(`Die Checkliste ist länger als ${SCHILD_GRENZEN.text.toLocaleString('de-DE')} Zeichen.`, 413);
  const { schildAendern, ladeSchild, schildEintrag, schildStand } = await import('@/lib/gesellschaften/schild-server');
  for (let versuch = 0; versuch < 2; versuch++) {
    const stand = schildStand(schildEintrag(await ladeSchild(haushalt), gid as GesellschaftId));
    const r = await schildAendern(haushalt, person, gid, stand, { art: 'person', person }, alt => {
      const l = alt.entwuerfe ?? [];
      if (l.length >= SCHILD_GRENZEN.entwuerfe) return { fehler: [{ feld: 'entwuerfe', text: `Höchstens ${SCHILD_GRENZEN.entwuerfe} Entwürfe — erst einen im Papierkorb ablegen.` }], status: 413 };
      return { s: { ...alt, entwuerfe: [...l, { id: neueKennung('ew'), vorlage: 'vertrag-checkliste', titel: titel.slice(0, 160), text: inhalt, am: new Date().toISOString(), von: person }] } };
    });
    if (r.konflikt) continue;
    if (r.fehler?.length) throw new RechtFehler(r.fehler.map(x => x.text).join(' · '), r.status === 413 ? 413 : r.status === 404 ? 404 : 400);
    return 'Checkliste als Entwurf in der Firmen-Akte abgelegt (Unternehmen › Dokumente › Entwürfe).';
  }
  throw new RechtFehler('Das Schild wurde gerade geändert — bitte noch einmal freigeben.', 409);
}

/** Einen erkannten Stichtag am Vertrag eintragen (Register-Schreibstelle mit Stand) — „kündigen bis“ nur, wenn es leer ist; nie überschreiben. */
async function fristEintragen(v: Vorschlag, haushalt: string, person: string): Promise<string> {
  const dateiId = text(v.eingabe.dateiId, 80), datum = text(v.eingabe.datum, 10), art = text(v.eingabe.art, 20), gid = text(v.eingabe.gesellschaftId, 80);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new RechtFehler('Datum fehlt.', 400);
  const [{ ladeRegister, registerAendern, standVon, eintragSchreiben, vertragsErinnerungen }] = await Promise.all([import('@/lib/gesellschaften/server')]);
  for (let versuch = 0; versuch < 2; versuch++) {
    const register = await ladeRegister(haushalt);
    const g = gesellschaftVon(register, gid);
    const vt = aktiveEintraege(g?.vertraege).find(x => (x.dateiIds ?? []).includes(dateiId));
    if (!g || !vt) throw new RechtFehler('Die Datei hängt noch an keinem Vertrag — erst unter Unternehmen › Verträge dem Vertrag zuordnen, dann freigeben.', 409);
    const fristen = vt.fristen ?? [];
    const textFrist = `Laut Vertragstext: ${fristArtText(art as 'kuendigung' | 'ende' | 'beginn' | 'sonstig')}`;
    if (fristen.some(f => f.datum === datum && f.text === textFrist)) return 'Der Stichtag steht schon am Vertrag.';
    const felder: Record<string, unknown> = { fristen: [...fristen, { id: neueKennung('vf').slice(0, 40), datum, text: textFrist }] };
    if (art === 'kuendigung' && !vt.kuendigenBis) felder.kuendigenBis = datum;
    if (art === 'kuendigung' && !vt.kuendigungsfrist && typeof v.eingabe.kuendigungsfrist === 'string') felder.kuendigungsfrist = text(v.eingabe.kuendigungsfrist, 120);
    if (art === 'ende' && !vt.ende) felder.ende = datum;
    const r = await registerAendern(haushalt, person, g.id, standVon(g), { art: 'person', person }, eintragSchreiben('vertraege', felder, vt.id));
    if (r.konflikt) continue;
    if (r.fehler?.length) throw new RechtFehler(r.fehler.map(x => x.text).join(' · '), r.status === 413 ? 413 : r.status === 404 ? 404 : 400);
    await vertragsErinnerungen(haushalt).catch(() => ({ neu: 0 }));
    return `Stichtag am Vertrag „${vt.titel || vertragArtLabel(vt.art)}“ eingetragen — er steht im Kalender${felder.kuendigenBis ? '; „kündigen bis“ gesetzt, die Erinnerung kommt vorher' : ''}.`;
  }
  throw new RechtFehler('Das Register wurde gerade geändert — bitte noch einmal freigeben.', 409);
}

export const RECHT_STAPEL_ART: StapelArtFreigabe = {
  freigeben: async (vIn, person): Promise<Erg> => {
    const z = await rechtZugangFuer(person);
    if (!z) return nein(403, 'Nur Personen mit Zugang zur Firmen-Akte (Haushalt des Inhabers) geben Vorschläge des Head of Recht frei.');
    const { beanspruche, entscheide, loslassen } = await import('@/lib/zoe/stapel');
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== 'recht' || !(RECHT_STAPEL_WERKZEUGE as readonly string[]).includes(v.werkzeug)) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person && v.person !== person) return { status: 403, fehler: 'Nur die Person, für die der Vorschlag vorbereitet wurde, gibt ihn frei.' };
      return null;
    });
    if (!a.ok) return nein(a.status, a.fehler);
    const v: Vorschlag = a.v;
    try {
      const gid = text(v.eingabe.gesellschaftId, 80);
      if (gid) await businessGesellschaft(z.haushalt, gid);
      // Beschluss-Buch (10.10.): Folgen eines gefassten Beschlusses — lib/gesellschaften/beschluss-server.ts rechnet sie aus dem jetzigen Bestand neu.
      const bs = await import('@/lib/gesellschaften/beschluss-server');
      const ergebnis = bs.istBeschlussWerkzeug(v.werkzeug) ? await bs.beschlussFolgeFreigeben(v, z.haushalt, person).catch(e => { if (e instanceof bs.BeschlussFehler) throw new RechtFehler(e.message, e.status); throw e; })
        : v.werkzeug === 'recht_aufgabe' ? await aufgabeAnlegen(v, person)
        : v.werkzeug === 'recht_risiko' ? await risikoUebernehmen(v, z.haushalt, person)
          : v.werkzeug === 'recht_checkliste' ? await checklisteAblegen(v, z.haushalt, person)
            : v.werkzeug === 'recht_frist' ? await fristEintragen(v, z.haushalt, person)
              : `Anwalts-Mappe „${(await mappeErstellen(z.haushalt, person, themaAus(v.eingabe.thema) ?? { art: 'gesellschaft', gesellschaftId: gid }, v.eingabe.fragen ?? [])).datei.name}“ liegt in der Ablage der Gesellschaft (Unternehmen › Unterlagen) — weitergegeben wird nur von Hand.`;
      await entscheide(v.id, 'freigegeben', { ergebnis: `${ergebnis} ${RECHT_HINWEIS}`, von: person, ausArbeit: true });
      return { ok: true, text: ergebnis };
    } catch (e) {
      await loslassen(v.id);
      if (e instanceof RechtFehler) return nein(e.status, e.message);
      throw e;
    }
  },
};

export type { MappeThema };
