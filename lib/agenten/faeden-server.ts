// ─── Agenten-Bereich: Threads — die EINE Schreibstelle (09.10., Paket 1 „Kern“; seit E3 auf Index + je Thread) ─────────────────
// Seit E3 (09.10., „Gesprächs-Ablage teilen“): Index `agenten-faeden--<person>` (Köpfe + Gedächtnis „Persönlich“) und je Thread
// `agenten-faden--<person>--<id>` — Ablage, Umzug des Altbestands und Pflege in lib/agenten/faeden-ablage.ts. Regeln stehen rein in faeden.ts;
// hier: Lesen (Köpfe bzw. ganze Threads), Schreiben (EINE Sperre je Änderung über die Ablage, Stand → 409, Grenzen → 413) und die Sicht des Kontos
// (`sichtLaden`, für die Filterstelle sicht.ts). Lesen schreibt nie: abgelaufene Threads (Löschfrist) fallen beim Lesen nur aus der Antwort und
// beim nächsten Schreiben (bzw. im Morgenlauf) aus der Ablage. Takt, Läufe, „Als Nächstes“ und Listen lesen NUR Köpfe (`bestandLesen`).

import { loadJson } from '@/lib/store/local-db';
import { ladeKonten } from '@/lib/zugang/konten';
import { haushaltDesInhabers, personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { gesundheitStandFuer } from '@/lib/datenschutz/gesundheit-einwilligung';
import { type AgentenAntwort, type AgentenEinstellung, type HeadDef, type HeadEinstellung, type HeadKarte, type Ueberblick, type UeberblickZeile } from './typen';
import { headDef, KATALOG } from './katalog';
import { einstellungFuer, mitarbeiterFuerHead, skillsFuerHead } from './skills-lesen';
import { kennzahlWerte } from './kontext';
import { WEG } from '@/lib/wege';
import { abgelaufen, fadenStand, fehler, kurz, ohneAbgelaufene, zugZuruecknehmenFaden, FRISTEN, type Fehler, type FadenIndexKern, type FadenKern, type FadenKopfKern, type NachrichtKern } from './faeden';
import { ablageAendern, ablageAbgleichen, ablageUmziehen, faedenLesen, fadenLesen, indexLesen, type Arbeit } from './faeden-ablage';
import { fadenSichtbar, headSichtbar, headsFuer, type KontoSicht } from './sicht';

export type { Arbeit } from './faeden-ablage';

const PERSON = /^[a-z0-9-]{1,40}$/;
const leer = (): FadenIndexKern => ({ v: 2, faeden: [] });

/** Die Sicht eines Kontos für die Filterstelle — Haushalt, volles Mitglied, privater Finanzzugang, Gesundheits-Einwilligung. */
export async function sichtLaden(person: string): Promise<KontoSicht> {
  const nichts: KontoSicht = { person, imHaushalt: false, vollesMitglied: false, privatFinanzen: false, gesundheit: { verarbeiten: false, ki: false } };
  if (!PERSON.test(person) || !(await personImHaushaltDesInhabers(person))) return nichts;
  const [h, inhaberHaushalt, g] = await Promise.all([haushaltFuer(person).catch(() => null), haushaltDesInhabers(), gesundheitStandFuer(person).catch(() => null)]);
  return {
    person, imHaushalt: true,
    vollesMitglied: !!h,
    privatFinanzen: !!h && h.haushalt === inhaberHaushalt,
    gesundheit: { verarbeiten: !!g?.verarbeitungErlaubt, ki: !!g?.ki.an },
  };
}

/**
 * Wirksame Löschfrist der Threads in Monaten (09.10., Agenten-Datenschicht D8): aus der EINEN Fristen-Tabelle (lib/crm/loeschfristen.ts,
 * Frist „zoe-verlauf“ — Gespräche mit ZOE und den Agenten), unter Stammdaten › Datenschutz einstellbar. Vorher fest 12 Monate im Code.
 * Unlesbar → die Vorgabe (`FRISTEN.fadenMonate`).
 */
export async function fadenFristMonate(): Promise<number> {
  try {
    const { LOESCHFRISTEN_SPEICHER, fristenWirksam } = await import('@/lib/crm/loeschfristen');
    const b = await loadJson<{ fristen?: Parameters<typeof fristenWirksam>[0] }>(LOESCHFRISTEN_SPEICHER);
    return fristenWirksam(b?.fristen)['zoe-verlauf'];
  } catch { return FRISTEN.fadenMonate; }
}

/**
 * Der Index der Person: Köpfe aller Threads + Gedächtnis „Persönlich“ (nur lesen — abgelaufene Threads fallen aus der Antwort, nicht aus der
 * Ablage). Ganze Threads (Nachrichten, Bretter, Pläne) gibt es nur über `eigenerFaden`/`eigeneFaedenLesen`/`faedenSeit`.
 */
export async function bestandLesen(person: string, jetzt = new Date().toISOString()): Promise<FadenIndexKern> {
  if (!PERSON.test(person)) return leer();
  const [b, monate] = await Promise.all([indexLesen(person), fadenFristMonate()]);
  return ohneAbgelaufene(b, jetzt, monate);
}

const zaehlen = (b: Pick<FadenIndexKern, 'faeden' | 'gedaechtnis'>) => ({ faeden: b.faeden.length, merksaetze: Object.values(b.gedaechtnis ?? {}).reduce((a, l) => a + (l?.length ?? 0), 0) });

/**
 * Löschfrist im Morgenlauf (09.10., Agenten-Datenschicht D8; lib/crm/loeschfristen-lauf.ts): abgelaufene Threads und persönliche Merksätze
 * der Person entfernen — vorher fielen sie nur beim nächsten Schreiben heraus, ein ruhender Bestand behielt sie unbegrenzt (Art. 5 Abs. 1
 * lit. e DSGVO). Laufende Threads (Lauf wartet/läuft) bleiben. Nur die Ablage DIESER Person; geschrieben wird nur, wenn etwas wegfällt
 * (idempotent). Seit E3 zusätzlich: Thread-Dateien ohne Kopf (Waisen) gehen, Köpfe ohne Datei fallen weg (`waisen`). Nur Zahlen.
 */
export async function fadenFristAnwenden(person: string, jetzt = new Date().toISOString(), monate?: number): Promise<{ faeden: number; merksaetze: number; waisen: number }> {
  const nichts = { faeden: 0, merksaetze: 0, waisen: 0 };
  if (!PERSON.test(person)) return nichts;
  const m = monate ?? await fadenFristMonate();
  // Ruhender Altbestand (E3) zieht spätestens hier um — einmal, idempotent (danach ist es der Index).
  await ablageUmziehen(person, jetzt).catch(e => console.error('[agenten-faeden] Umzug:', e instanceof Error ? e.message.slice(0, 120) : e));
  const roh = await indexLesen(person);
  const v0 = zaehlen(roh), w0 = zaehlen(ohneAbgelaufene(roh, jetzt, m));
  let n = { faeden: 0, merksaetze: 0 };
  if (v0.faeden !== w0.faeden || v0.merksaetze !== w0.merksaetze) { // sonst: nicht sperren, nichts schreiben
    const r = await ablageAendern<{ faeden: number; merksaetze: number }>(person, t => {
      const b = t.index();
      const x = ohneAbgelaufene(b, jetzt, m);
      const v = zaehlen(b), w = zaehlen(x);
      t.entferne(b.faeden.filter(k => !x.faeden.some(y => y.id === k.id)).map(k => k.id));
      if (v.merksaetze !== w.merksaetze) t.indexFelder(z => ({ ...z, gedaechtnis: x.gedaechtnis ?? {} }));
      return { e: { faeden: v.faeden - w.faeden, merksaetze: v.merksaetze - w.merksaetze } };
    }, { jetzt });
    if (r.ok) n = r.e;
  }
  const a = await ablageAbgleichen(person).catch(e => { console.error('[agenten-faeden] Abgleich:', e instanceof Error ? e.message.slice(0, 120) : e); return { waisen: 0, ohneDatei: 0 }; });
  return { faeden: n.faeden, merksaetze: n.merksaetze, waisen: a.waisen + a.ohneDatei };
}

/**
 * EINE Änderung an der Ablage der Person (Threads anlegen, mehrere ändern, entfernen, Gedächtnis) — in EINER Sperre (Index, darin je Thread).
 * `fn` arbeitet über `Arbeit` und liefert ein Ergebnis oder einen Fehler (dann wird nichts geschrieben). Abgelaufene Threads fallen heraus.
 */
export async function ablageAendernFuer<E>(person: string, fn: (t: Arbeit) => Promise<{ e: E } | Fehler> | { e: E } | Fehler, jetzt = new Date().toISOString()): Promise<{ ok: true; e: E; index: FadenIndexKern } | Fehler> {
  if (!PERSON.test(person)) return fehler(400, 'Person ungültig.');
  return ablageAendern(person, fn, { jetzt, fristMonate: await fadenFristMonate() });
}

/** Einen neuen Thread anlegen (Grenzen → 409/413, nie kürzen). */
export async function fadenAnlegen(person: string, f: FadenKern, jetzt?: string): Promise<{ ok: true; faden: FadenKern } | Fehler> {
  const r = await ablageAendernFuer<FadenKern>(person, t => t.hinzu(f) ?? { e: f }, jetzt);
  return r.ok ? { ok: true, faden: r.e } : r;
}

/** Persönliches Gedächtnis (bzw. die Marke der ZOE-Übernahme) ändern — nur der Index wird geschrieben. */
export async function indexAendern<E>(person: string, fn: (i: FadenIndexKern) => { e: E; neu?: Partial<Pick<FadenIndexKern, 'gedaechtnis' | 'zoeUebernahme'>> } | Fehler): Promise<{ ok: true; e: E; index: FadenIndexKern } | Fehler> {
  return ablageAendernFuer<E>(person, t => {
    const r = fn(t.index());
    if ('ok' in r && r.ok === false) return r;
    const x = r as { e: E; neu?: Partial<Pick<FadenIndexKern, 'gedaechtnis' | 'zoeUebernahme'>> };
    if (x.neu) t.indexFelder(z => ({ ...z, ...x.neu }));
    return { e: x.e };
  });
}

/**
 * EIN Thread der Person ändern — mit Stand (`stand` gesetzt und veraltet → 409 mit dem aktuellen Thread). `fn` sieht den ganzen Thread
 * und liefert den neuen oder einen Fehler. Geschrieben werden nur dieser Thread und der Index.
 */
export async function fadenAendern(person: string, id: string, fn: (f: FadenKern) => FadenKern | Fehler, o: { stand?: string; jetzt?: string } = {}): Promise<{ ok: true; faden: FadenKern; stand: string } | (Fehler & { aktuell?: FadenKern })> {
  let aktuell: FadenKern | undefined;
  const r = await ablageAendernFuer<FadenKern>(person, async t => {
    const f = await t.faden(id);
    if (!f) return fehler(404, 'Diesen Thread gibt es nicht (mehr).');
    if (o.stand !== undefined && o.stand !== fadenStand(f)) { aktuell = f; return fehler(409, 'Der Thread hat sich inzwischen geändert — bitte neu laden.'); }
    const neu = fn(f);
    if ('ok' in neu && neu.ok === false) return neu;
    const g = neu as FadenKern;
    t.setze(g);
    return { e: g };
  }, o.jetzt);
  if (!r.ok) return aktuell ? { ...r, aktuell } : r;
  return { ok: true, faden: r.e, stand: fadenStand(r.e) };
}

/**
 * Mehrere Threads der Person in EINER Sperre ändern: `wahl` sieht nur den Kopf (geladen werden nur die gewählten), `fn` liefert den neuen
 * Thread oder null (unverändert). Zurück: die geänderten Threads.
 */
export async function faedenAendernWo(person: string, wahl: (k: FadenKopfKern) => boolean, fn: (f: FadenKern) => FadenKern | null): Promise<{ ok: true; faeden: FadenKern[] } | Fehler> {
  const r = await ablageAendernFuer<FadenKern[]>(person, async t => {
    const raus: FadenKern[] = [];
    for (const k of t.index().faeden.filter(wahl)) {
      const f = await t.faden(k.id);
      const g = f ? fn(f) : null;
      if (g) { t.setze(g); raus.push(g); }
    }
    return { e: raus };
  });
  return r.ok ? { ok: true, faeden: r.e } : r;
}

/** Streaming abgebrochen (09.10.): die unbeantwortete Nachricht der Person wieder heraus (Regel rein in faeden.ts `zugZuruecknehmenFaden`). */
export async function zugZuruecknehmenFuer(person: string, fadenId: string, nachrichtId: string): Promise<boolean> {
  const r = await ablageAendernFuer<boolean>(person, async t => {
    const f = await t.faden(fadenId);
    const x = f ? zugZuruecknehmenFaden(f, nachrichtId) : null;
    if (!x) return { e: false };
    if (x === 'leer') t.entferne([fadenId, ...t.index().faeden.filter(k => k.elternId === fadenId).map(k => k.id)]);
    else t.setze(x);
    return { e: true };
  });
  return r.ok && r.e;
}

/** Ein eigener Thread ganz (oder null — auch, wenn er abgelaufen ist). */
export async function eigenerFaden(person: string, id: string): Promise<FadenKern | null> {
  const f = await fadenLesen(person, id);
  if (!f) return null;
  return abgelaufen(f, new Date().toISOString(), await fadenFristMonate()) ? null : f;
}

/** Ganze eigene Threads zu Köpfen (nur die nötigen laden). */
export async function eigeneFaedenLesen(person: string, koepfe: readonly Pick<FadenKopfKern, 'id'>[]): Promise<FadenKern[]> {
  return faedenLesen(person, koepfe);
}

/**
 * Ganze Threads, die seit `vonIso` geschrieben wurden und `wahl` erfüllen (Leistung, Kosten je Monat) — Threads ohne Schreiben seitdem können
 * im Zeitraum keine Nachricht, keinen Daumen und keinen Laufstart haben und werden gar nicht erst geladen.
 */
export async function faedenSeit(person: string, wahl: (k: FadenKopfKern) => boolean, vonIso: string): Promise<FadenKern[]> {
  const b = await bestandLesen(person);
  return faedenLesen(person, b.faeden.filter(k => wahl(k) && (k.geschrieben ?? k.aktualisiert) >= vonIso));
}

/** Speichernamen im Haushalt des Inhabers (für geteilte Business-Threads) — über die zentrale Regel (lib/zugang/inhaber.ts, Nahtstellen-Prüfung Punkt 9). */
async function haushaltsPersonen(): Promise<string[]> {
  const { kontenImHaushaltDerInhaber } = await import('@/lib/zugang/inhaber');
  return kontenImHaushaltDerInhaber(await ladeKonten()).map(k => k.speicher).filter(p => PERSON.test(p));
}

/** Köpfe aller Threads, die die Sicht sehen darf: eigene (Head sichtbar) + geteilte Business-Threads anderer im Haushalt. Nur der Index. */
export async function sichtbareFaeden(s: KontoSicht): Promise<FadenKopfKern[]> {
  if (!s.imHaushalt) return [];
  const eigene = (await bestandLesen(s.person)).faeden.filter(f => fadenSichtbar(f, s));
  const andere = (await haushaltsPersonen()).filter(p => p !== s.person);
  const geteilt: FadenKopfKern[] = [];
  for (const p of andere) {
    const b = await bestandLesen(p).catch(() => leer());
    for (const f of b.faeden) if (f.geteilt && fadenSichtbar(f, s)) geteilt.push(f);
  }
  return [...eigene, ...geteilt];
}

/** Ein Thread ganz, den die Sicht sehen darf (eigen oder geteilt) — oder null. */
export async function sichtbarerFaden(s: KontoSicht, id: string): Promise<FadenKern | null> {
  const k = (await sichtbareFaeden(s)).find(f => f.id === id);
  return k ? fadenLesen(k.besitzer, k.id) : null;
}

// ── GET /api/agenten: Heads und Überblick der Person (Antwort 1) ───────────────────────────────────────────────────────────

const ZEILEN_MAX = 20;
/** Höchstens so viele Threads lädt der Überblick ganz („seit deinem letzten Besuch“) — die jüngsten zuerst; die Liste zeigt ohnehin 20 Zeilen. */
const SEIT_MAX = 200;

/**
 * Was die Person sieht: ZOE, ihre Heads (serverseitig gefiltert: `headsFuer`), Überblick über dem ZOE-Chat — was seit dem letzten
 * Besuch passiert ist (Berichte, fertige Läufe aus IHREN bzw. geteilten Threads), woran gearbeitet wird (je Head), offene
 * Freigaben als Zahl, Bezug zu den Jahreszielen (Bestand `ziele`, Bereich nach Konto) und ein Kurz-Briefing — vorerst regelbasiert
 * ohne Modell. Lesen schreibt nie (`seit` kommt vom Browser — nur ein Filter über eigene Daten).
 */
export async function agentenAntwort(person: string, seit: string): Promise<AgentenAntwort> {
  const sicht = await sichtLaden(person);
  const { kontoFuerSpeicher } = await import('@/lib/zugang/konten');
  const h = (await kontoFuerSpeicher(person))?.haushalt;
  const u = { person, haushalt: h && /^[a-z0-9][a-z0-9-]{0,39}$/.test(h) ? h : null };
  const [einstellung, faeden] = await Promise.all([einstellungFuer(u.haushalt, person), sichtbareFaeden(sicht)]);
  // Paket 4b: Einstellungen, Kosten und Rechte je Head, Instanz-Budget (lib/agenten/einstellung.ts, lib/ki/tor.ts).
  const zusatz = await einstellungZusatz(person, sicht, u.haushalt, einstellung, faeden.filter(f => f.besitzer === person)).catch(e => { console.error('[agenten] Einstellungen nicht lesbar:', e instanceof Error ? e.message.slice(0, 120) : e); return null; });
  // Durchstich 09.10.: EINE Zählung offener Freigaben je Head (lib/agenten/naechstes.ts `freigabenJeHead`) — dieselbe wie „Als Nächstes“.
  // Vorher zählte der Kopf Plan-Freigaben doppelt (Thread UND Stapel) und die Freigabe-Listen der eingebauten Heads gar nicht.
  const freigaben = await (await import('./naechstes')).freigabenJeHead(person, new Set(headsFuer(sicht).map(h => h.id)), u.haushalt).catch(() => new Map<string, { anzahl: number }>());
  const freigabenVon = (headId: string) => freigaben.get(headId)?.anzahl ?? 0;
  let businessFrei = false;
  try { const { businessFreiJetzt } = await import('@/lib/arbeitsrahmen/server'); businessFrei = (await businessFreiJetzt(person)).frei; } catch { /* offen statt blockiert */ }
  const neueste = <F extends FadenKopfKern>(l: F[]) => [...l].sort((a, b) => b.aktualisiert.localeCompare(a.aktualisiert));
  const laufend = (f: FadenKopfKern) => !!f.lauf && (f.lauf.status === 'wartet' || f.lauf.status === 'laeuft');

  const heads: HeadKarte[] = [];
  for (const d of headsFuer(sicht)) {
    const eh = einstellung.heads[d.id] ?? {};
    const aus = new Set(eh.mitarbeiterAus ?? []);
    const [ms, skills, kennzahlen] = await Promise.all([
      mitarbeiterFuerHead(d.id, u).catch(() => []), skillsFuerHead(d.id, u).catch(() => []), kennzahlWerte(d, sicht).catch(() => []),
    ]);
    const eigene = faeden.filter(f => f.agent.art !== 'zoe' && f.agent.headId === d.id);
    const sperre = zusatz?.sperre(d) ?? (einstellung.notAus ? { grund: 'not-aus' as const, text: 'Not-Aus ist gesetzt — die Agenten halten an.' } : eh.aktiv === false ? { grund: 'aus' as const, text: `${d.name} ist ausgeschaltet.` } : null);
    const gesperrt: HeadKarte['gesperrt'] = sperre ?? (businessFrei && d.bereich === 'business' ? { grund: 'business-frei', text: 'Gerade Business-frei — im Hintergrund ruht der Bereich.' } : undefined);
    const foto = zusatz ? await zusatz.foto(d, eh.foto) : null;
    const einstellungSicht = zusatz?.sicht(d, eh);
    heads.push({
      id: d.id, name: d.name, kurz: d.kurz, auftrag: d.auftrag, bereich: d.bereich, ebene: d.ebene, farbe: d.farbe, ...(d.hinweis ? { hinweis: d.hinweis } : {}),
      aktiv: eh.aktiv !== false, ...(gesperrt ? { gesperrt } : {}), kennzahlen,
      mitarbeiter: ms.map(m => ({ id: m.id, name: m.name, rolle: m.rolle, aktiv: m.aktiv && !aus.has(m.id), auchFuer: m.auchFuer, ...(m.headId !== d.id ? { aushilfe: true as const } : {}) })),
      skills,
      zaehler: { freigaben: freigabenVon(d.id), laufend: eigene.filter(laufend).length, faeden: eigene.length },
      letzteFaeden: neueste(eigene).slice(0, 5).map(f => kurz(f, person)),
      ...(foto ? { foto } : {}),
      ...(einstellungSicht ? { einstellung: einstellungSicht } : {}),
    });
  }

  const name = (f: FadenKopfKern) => (f.agent.art === 'zoe' ? 'ZOE' : headDef(f.agent.headId)?.kurz ?? f.agent.headId);
  const link = (f: FadenKopfKern) => WEG.agenten({ ...(f.agent.art !== 'zoe' ? { h: f.agent.headId } : {}), f: f.id });
  // Je Lauf EINE Zeile (Durchstich 09.10.): derselbe Bericht steht im Head-Thread UND — wenn ZOE beauftragt hat — im ZOE-Thread; der Lauf eines
  // Heads steht als Antwort in seinem Thread und als Bericht bei ZOE. Schlüssel = der Thread, der lief; die Zeile beim Head gewinnt.
  // E3 (09.10.): ganz geladen werden nur Threads, die seit dem letzten Besuch geschrieben wurden (höchstens `SEIT_MAX`, die jüngsten zuerst).
  const roh: { z: UeberblickZeile; lauf: string; zoe: boolean }[] = [];
  const frisch = neueste(faeden.filter(f => (f.geschrieben ?? f.aktualisiert) > seit)).slice(0, SEIT_MAX);
  const ganze: FadenKern[] = [];
  for (const k of frisch) { const f = await fadenLesen(k.besitzer, k.id).catch(() => null); if (f) ganze.push(f); }
  for (const f of ganze) for (const n of f.nachrichten) {
    if (n.zeit <= seit) continue;
    if (n.verweis?.art === 'bericht') roh.push({ lauf: n.verweis.fadenId, zoe: f.agent.art === 'zoe', z: { id: n.id, text: `${name(f)}: Bericht aus Thread „${n.verweis.titel ?? ''}“`, zeit: n.zeit, ...(f.agent.art !== 'zoe' ? { headId: f.agent.headId } : {}), link: link(f) } });
    else if (n.rolle === 'agent' && (n as NachrichtKern).lauf?.operation === 'invoke_agent' && f.agent.art === 'head') roh.push({ lauf: f.id, zoe: false, z: { id: n.id, text: `${name(f)}: Lauf in „${f.titel}“ ${f.lauf?.status === 'fertig' ? 'fertig' : 'beendet'}`, zeit: n.zeit, headId: f.agent.headId, link: link(f) } });
  }
  const jeLauf = new Map<string, { z: UeberblickZeile; zoe: boolean }>();
  for (const x of roh) { const da = jeLauf.get(x.lauf); if (!da || (da.zoe && !x.zoe)) jeLauf.set(x.lauf, x); }
  const passiert: UeberblickZeile[] = Array.from(jeLauf.values(), x => x.z);
  passiert.sort((a, b) => String(b.zeit).localeCompare(String(a.zeit)));
  const inArbeit: UeberblickZeile[] = neueste(faeden.filter(laufend)).map(f => ({ id: f.id, text: `${name(f)}: „${f.titel}“ ${f.lauf?.status === 'laeuft' ? 'läuft' : 'wartet'}`, zeit: f.aktualisiert, ...(f.agent.art !== 'zoe' ? { headId: f.agent.headId } : {}), link: link(f) }));
  const anzahl = Array.from(freigaben.values()).reduce((n, g) => n + g.anzahl, 0);

  // Jahresziele über die EINE Lesestelle — dieselbe, aus der ZOE und die Heads sie im Kontext bekommen (Durchstich 09.10.).
  const { jahreszieleFuer } = await import('@/lib/planung/jahresziele-sicht');
  const ziele: Ueberblick['ziele'] = (await jahreszieleFuer({ privat: sicht.vollesMitglied })).map(z => ({ id: z.id, titel: z.titel, fortschritt: z.fortschritt, link: WEG.ziel(z.id) }));

  const teile = [
    passiert.length ? `${passiert.length} ${passiert.length === 1 ? 'Ergebnis' : 'Ergebnisse'} seit deinem letzten Besuch` : 'Seit deinem letzten Besuch nichts Neues',
    inArbeit.length ? `${inArbeit.length} in Arbeit` : '',
    anzahl ? `${anzahl} ${anzahl === 1 ? 'Freigabe wartet' : 'Freigaben warten'}` : '',
  ].filter(Boolean);
  return {
    ok: true,
    zoe: { letzteFaeden: neueste(faeden.filter(f => f.agent.art === 'zoe')).slice(0, 5).map(f => kurz(f, person)) },
    heads,
    ueberblick: {
      briefing: `${teile.join(' · ')}.`, seit,
      passiert: passiert.slice(0, ZEILEN_MAX), inArbeit: inArbeit.slice(0, ZEILEN_MAX),
      freigaben: { anzahl, link: WEG.freigaben() },
      ziele: ziele.slice(0, 5),
    },
    notAus: !!einstellung.notAus,
    ...(zusatz ? { budget: zusatz.budget, notAusAendern: zusatz.notAusAendern, personen: zusatz.personen } : {}),
    kurs: (await import('@/lib/ki/kosten')).usdEurKurs(),
  };
}

/**
 * Paket 4b: was GET /api/agenten zu den Einstellungen mitbringt — je Head die wirksamen Werte, Kosten des Monats, Rechte und Stand; ein
 * Foto nur, wenn die Person das Bild sieht; das Instanz-Budget; wählbare zuständige Personen. Privat-Heads: nur der eigene Abschnitt
 * (`einstellung` kommt schon mit `mitPerson`).
 */
async function einstellungZusatz(person: string, sicht: KontoSicht, haushalt: string | null, einstellung: AgentenEinstellung, eigeneKoepfe: readonly FadenKopfKern[]) {
  const [ein, leistung, { stufenModelle, modellVon }, kiE, tor, personen] = await Promise.all([
    import('./einstellung'), import('./leistung'), import('@/lib/ki/modelle'), import('@/lib/datenschutz/ki-einstellungen'), import('@/lib/ki/tor'),
    import('./einstellung').then(m => m.haushaltsPersonen()),
  ]);
  const { istInhaber } = await import('@/lib/zugang/haushalt-inhaber');
  const [kostenHaus, kiDatei, budget, inhaber] = await Promise.all([
    ein.kostenJeHeadMonat().catch(() => ({} as Record<string, number>)), kiE.ladeKiEinstellungen().catch(() => null), tor.budgetAnzeige().catch(() => null), istInhaber(person),
  ]);
  const ids = stufenModelle(process.env, kiDatei?.instanz?.modellStufen ?? null);
  const modelle = { schnell: modellVon(ids.schnell)?.name ?? ids.schnell, ausgewogen: modellVon(ids.ausgewogen)?.name ?? ids.ausgewogen, stark: modellVon(ids.stark)?.name ?? ids.stark };
  // Privat-Heads: Kosten nur aus den EIGENEN Threads (die Kostenmessung mischt Personen) — derselbe Monat wie `kostenHeadMonat`.
  const { monatBerlin } = await import('@/lib/store/aenderungsprotokoll');
  const [j, m] = monatBerlin(new Date()).split('-').map(Number);
  const von = new Date(Date.UTC(j, m - 1, 1)).toISOString(), bis = new Date(Date.UTC(m === 12 ? j + 1 : j, m === 12 ? 0 : m, 1)).toISOString();
  const kostenPrivat = new Map<string, number>();
  const privatHeads = KATALOG.filter(x => x.ebene === 'person' && headSichtbar(sicht, x.id));
  // E3 (09.10.): ganz geladen werden nur die eigenen Threads der Privat-Heads, die in diesem Monat geschrieben wurden.
  const privatIds = new Set(privatHeads.map(h => h.id));
  const imMonat = await faedenLesen(person, eigeneKoepfe.filter(k => k.agent.art !== 'zoe' && privatIds.has(k.agent.headId) && (k.geschrieben ?? k.aktualisiert) >= von));
  for (const h of privatHeads) kostenPrivat.set(h.id, leistung.fadenZahlen(imMonat, h.id, von, bis).kostenEuroCent);
  const kostenVon = (d: HeadDef) => (d.ebene === 'person' ? kostenPrivat.get(d.id) ?? 0 : kostenHaus[d.id] ?? 0);
  let betrachter: Awaited<ReturnType<typeof import('@/lib/medien/server').betrachterFuer>> | undefined;
  return {
    sperre: (d: HeadDef) => ein.headSperre(einstellung, d, person, kostenVon(d)),
    sicht: (d: HeadDef, eh: HeadEinstellung) => {
      const lage = leistung.autonomieLage(d, eh as Parameters<typeof leistung.autonomieLage>[1], leistung.annahmeAus(0, 0));
      return ein.einstellungSicht(d, eh, {
        boden: lage.boden, wirksameAutonomie: lage.stufe, modelle, kostenCent: kostenVon(d),
        aendern: ein.einstellungDarf(sicht, d, true), foto: null,
      });
    },
    foto: async (d: HeadDef, id: string | undefined): Promise<string | null> => {
      if (!id || !/^md-[0-9a-f-]{36}$/.test(id)) return null;
      try {
        const m = await import('@/lib/medien/server');
        if (betrachter === undefined) betrachter = await m.betrachterFuer(person);
        const x = betrachter ? await m.mediumFinden(betrachter, id) : null;
        return x && x.medium.art === 'bild' && (d.ebene === 'person' || x.quelle.art === 'business') ? `/api/medien/inhalt?id=${id}&v=raster` : null;
      } catch { return null; }
    },
    budget: budget ? { ...budget, setzen: inhaber } : undefined,
    notAusAendern: ein.notAusDarf(sicht, null),
    personen: haushalt ? personen.alle.map(p => ({ id: p.id, name: p.name })) : [],
  };
}
