// ─── Die neuen KI-Wege: Bild, Video, Tiefenbericht, Transkription (09.10.2026, Paket 6a) — Server ──────────────────────────────
// Jeder Weg: Kostenschätzung → Anbieter-Tor (lib/ki/tor.ts) → Adapter (lib/ki/adapter/*) → Ablage → KI-Protokoll (nur Metadaten) →
// Kostenmessung (lib/zoe/verbrauch.ts). Gesperrt → `{ ok: false, error: 'ki-gesperrt:<grund>' }` (Text: `kiSperrText`), nichts geht hinaus.
// Ohne Einrichtung (Umgebung) und ohne Schalter des Inhabers ist alles aus. Kein Weg schreibt nach außen (Veröffentlichen bleibt Klick-Sache,
// Eiserne Regel 3) — die Agenten (Paket 0) docken über diese Funktionen an, nie am Adapter vorbei.
// Video und Tiefenbericht laufen asynchron: Start hier (nur mit bestätigter Schätzung), Abholen im Takt über die Warteschlange
// (`art: 'agent', name: 'ki-medien'` → `kiAuftraegeAbholen`), Ergebnis SOFORT verschlüsselt in die eigene Ablage (Veo: 2 Tage beim Anbieter).

import type { KiKontext } from '@/lib/datenschutz/ki-tor';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { anbieterTor } from './tor';
import { vertexKonfig } from './konfig';
import { kostenSchaetzen, type Schaetzung } from './kosten';
import { anbieterKennzeichnung, sichtbaresZeichen, type SichtbarAngabe } from './kennzeichnung';
import { mediumAblegen, mediumAbschliessen, laufendeMedien, medienAufraeumen, neueMedienKennung, PROMPT_MAX, type KiMedium } from './medien';
import { tiefenberichtAnlegen, tiefenberichtAbschliessen, laufendeTiefenberichte, tiefenberichteAufraeumen, FRAGE_MAX } from './tiefenbericht';
import { KiAnbieterFehler } from './adapter/http';
import type { AnbieterId, Faehigkeit } from './anbieter';

export type KiWegErgebnis<T> = ({ ok: true } & T) | { ok: false; status: number; error: string; schaetzung?: Schaetzung };

/** Zähler laufender asynchroner Aufträge (Video, Tiefenbericht) — der Takt reiht das Abholen nur ein, wenn etwas läuft. Ohne Personendaten. */
export const KI_AUFTRAEGE_OFFEN = 'ki-auftraege-offen';
interface OffenStand { offen: number; geaendert: string }
const offenAendern = (d: number) => updateJson<OffenStand>(KI_AUFTRAEGE_OFFEN, cur => ({ offen: Math.max(0, (cur?.offen ?? 0) + d), geaendert: new Date().toISOString() }));
export async function kiAuftraegeOffen(): Promise<number> { return (await loadJson<OffenStand>(KI_AUFTRAEGE_OFFEN).catch(() => null))?.offen ?? 0; }

const PERSON = /^[a-z0-9-]{1,40}$/;
const gesperrt = (grund: string, schaetzung?: Schaetzung) => ({ ok: false as const, status: grund === 'kosten-rueckfrage' ? 409 : 403, error: `ki-gesperrt:${grund}`, ...(schaetzung ? { schaetzung } : {}) });

async function protokoll(e: { zweck: string; ki: KiKontext; faehigkeit: Faehigkeit; modell: string; ergebnis: 'ok' | 'fehler' | 'gesperrt'; grund?: string; anbieter?: AnbieterId; region?: string; stufe?: import('./anbieter').DatenschutzStufe; kostenCent?: number; lauf?: import('@/lib/datenschutz/ki-lauf').KiLauf; person?: string | null }): Promise<void> {
  const { kiProtokollieren } = await import('@/lib/datenschutz/ki-protokoll');
  await kiProtokollieren({ zweck: e.zweck, lauf: e.lauf ?? e.ki.lauf ?? 'aufruf', person: e.person !== undefined ? e.person : e.ki.person ?? null, kategorien: e.ki.kategorien?.length ? e.ki.kategorien : ['allgemein'], modell: e.modell, ergebnis: e.ergebnis, faehigkeit: e.faehigkeit,
    ...(e.grund ? { grund: e.grund } : {}), ...(e.anbieter ? { anbieter: e.anbieter } : {}), ...(e.region ? { region: e.region } : {}), ...(e.stufe ? { stufe: e.stufe } : {}), ...(e.kostenCent !== undefined ? { kostenCent: Math.round(e.kostenCent) } : {}) });
}

/** Hintergrund-Lauf (Tor sagt „pseudonym“): Kontaktnamen im Auftragstext durch Platzhalter ersetzen, bevor er hinausgeht (wie askText). */
async function hinaus(tor: { pseudonym: boolean }, text: string): Promise<string> {
  if (!tor.pseudonym) return text;
  const { pseudonymFuerLauf } = await import('@/lib/datenschutz/ki-tor');
  return (await pseudonymFuerLauf().catch(() => null))?.ersetze(text) ?? text;
}

const fehlerText = (e: unknown) => (e instanceof KiAnbieterFehler ? e.message : 'Der KI-Anbieter hat nicht geantwortet');
const fehlerStatus = (e: unknown) => (e instanceof KiAnbieterFehler && e.status >= 400 && e.status < 600 ? e.status : 502);

// ── Bild ──────────────────────────────────────────────────────────────────────

export interface BildEingabe {
  ki: KiKontext;
  /** Haushalt der Sitzung (haushaltVon) — nie aus der Anfrage. */
  haushalt: string;
  prompt: string;
  modell?: 'gemini-nano-banana-2.1' | 'gemini-3-pro-image';
  aufloesung?: '1k' | '2k' | '4k';
  seitenverhaeltnis?: '1:1' | '4:5' | '3:4' | '16:9' | '9:16';
  sichtbarkeit?: 'haushalt' | 'nur-ich';
  sichtbar?: SichtbarAngabe;
  zweck?: string;
}

/** Ein Bild erzeugen (frei bis zum Budget, Kevin 08.10.) — ablegen, protokollieren, Kosten buchen. */
export async function kiBild(e: BildEingabe): Promise<KiWegErgebnis<{ medien: KiMedium[]; schaetzung: Schaetzung; zeichen: ReturnType<typeof sichtbaresZeichen> }>> {
  const person = e.ki.person;
  if (!person || !PERSON.test(person)) return { ok: false, status: 401, error: 'Bilder nur für eine angemeldete Person.' };
  if (!e.prompt.trim()) return { ok: false, status: 400, error: 'Beschreibung fehlt.' };
  if (e.prompt.length > PROMPT_MAX) return { ok: false, status: 413, error: `Beschreibung zu lang (höchstens ${PROMPT_MAX} Zeichen).` };
  const modell = e.modell ?? 'gemini-nano-banana-2.1';
  const schaetzung = kostenSchaetzen({ faehigkeit: 'bild', modell, anzahl: 1, aufloesung: e.aufloesung ?? '1k' });
  const zweck = e.zweck ?? 'ki-bild';
  const tor = await anbieterTor({ faehigkeit: 'bild', ki: e.ki, schaetzung });
  if (!tor.ok) { await protokoll({ zweck, ki: e.ki, faehigkeit: 'bild', modell, ergebnis: 'gesperrt', grund: tor.grund, lauf: tor.lauf, person: tor.person }); return gesperrt(tor.grund, schaetzung); }
  const v = vertexKonfig();
  if (!v) return gesperrt('anbieter-nicht-eingerichtet', schaetzung);
  const basis = { zweck, ki: e.ki, faehigkeit: 'bild' as const, modell, anbieter: tor.anbieter, region: tor.region, stufe: tor.stufe, lauf: tor.lauf, person: tor.person };
  try {
    const { vertexBild } = await import('./adapter/google-vertex');
    const r = await vertexBild(v, { modell, prompt: await hinaus(tor, e.prompt), aufloesung: e.aufloesung, seitenverhaeltnis: e.seitenverhaeltnis });
    const zeichen = sichtbaresZeichen(e.sichtbar ?? { realistisch: false });
    const medien: KiMedium[] = [];
    for (const b of r.bilder) {
      medien.push(await mediumAblegen(e.haushalt, {
        art: 'bild', status: 'fertig', mime: b.mime, anbieter: tor.anbieter, modell, person, sichtbarkeit: e.sichtbarkeit ?? 'haushalt', prompt: e.prompt,
        kennzeichnung: { ...anbieterKennzeichnung(tor.anbieter), eigeneMarke: true }, ...(e.sichtbar ? { sichtbar: e.sichtbar } : {}), zeichenNoetig: zeichen.noetig,
        kosten: { euroCent: schaetzung.euroCent, geschaetzt: schaetzung.ca },
      }, b.bytes));
    }
    const { notiereMengen } = await import('@/lib/zoe/verbrauch');
    await notiereMengen(modell, zweck, { [`bild@${e.aufloesung ?? '1k'}`]: r.bilder.length }, tor.anbieter).catch(() => undefined);
    await protokoll({ ...basis, ergebnis: 'ok', kostenCent: schaetzung.euroCent * r.bilder.length });
    return { ok: true, medien, schaetzung, zeichen };
  } catch (err) {
    await protokoll({ ...basis, ergebnis: 'fehler' });
    return { ok: false, status: fehlerStatus(err), error: fehlerText(err) };
  }
}

// ── Video (asynchron) ─────────────────────────────────────────────────────────

export interface VideoEingabe {
  ki: KiKontext;
  haushalt: string;
  prompt: string;
  modell?: 'gemini-omni-1.1-flash' | 'veo-3.1-generate-001';
  sekunden: number;
  aufloesung?: '720p' | '1080p' | '4k';
  seitenverhaeltnis?: '16:9' | '9:16';
  /** Der per Klick bestätigte Betrag (Euro-Cent) — ohne ihn fragt das Tor zurück (409 mit Schätzung). */
  bestaetigtCent?: number;
  sichtbarkeit?: 'haushalt' | 'nur-ich';
  sichtbar?: SichtbarAngabe;
}
/** Längen je Modell (MODELLE.md 2.4): Omni Flash bis 40 s in 10-s-Schritten, Veo 3.1 4/6/8 s. */
export function videoLaengeErlaubt(modell: string, sekunden: number): boolean {
  if (modell === 'veo-3.1-generate-001') return [4, 6, 8].includes(sekunden);
  if (modell === 'gemini-omni-1.1-flash') return Number.isInteger(sekunden) && sekunden >= 10 && sekunden <= 40 && sekunden % 10 === 0;
  return false;
}

export async function kiVideoStarten(e: VideoEingabe): Promise<KiWegErgebnis<{ medium: KiMedium; schaetzung: Schaetzung }>> {
  const person = e.ki.person;
  if (!person || !PERSON.test(person)) return { ok: false, status: 401, error: 'Video nur für eine angemeldete Person.' };
  const modell = e.modell ?? 'gemini-omni-1.1-flash';
  if (!videoLaengeErlaubt(modell, e.sekunden)) return { ok: false, status: 400, error: 'Länge passt nicht zum Modell (Omni Flash 10–40 s in 10er-Schritten, Veo 3.1: 4, 6 oder 8 s).' };
  if (!e.prompt.trim()) return { ok: false, status: 400, error: 'Beschreibung fehlt.' };
  if (e.prompt.length > PROMPT_MAX) return { ok: false, status: 413, error: `Beschreibung zu lang (höchstens ${PROMPT_MAX} Zeichen).` };
  const schaetzung = kostenSchaetzen({ faehigkeit: 'video', modell, sekunden: e.sekunden, aufloesung: e.aufloesung ?? '1080p' });
  const tor = await anbieterTor({ faehigkeit: 'video', ki: e.ki, schaetzung, bestaetigtCent: e.bestaetigtCent });
  if (!tor.ok) { await protokoll({ zweck: 'ki-video', ki: e.ki, faehigkeit: 'video', modell, ergebnis: 'gesperrt', grund: tor.grund, lauf: tor.lauf, person: tor.person }); return gesperrt(tor.grund, schaetzung); }
  const v = vertexKonfig();
  if (!v) return gesperrt('anbieter-nicht-eingerichtet', schaetzung);
  const basis = { zweck: 'ki-video', ki: e.ki, faehigkeit: 'video' as const, modell, anbieter: tor.anbieter, region: tor.region, stufe: tor.stufe, lauf: tor.lauf, person: tor.person };
  try {
    const { vertexVideoStarten } = await import('./adapter/google-vertex');
    const { operation } = await vertexVideoStarten(v, { modell, prompt: await hinaus(tor, e.prompt), sekunden: e.sekunden, aufloesung: e.aufloesung, seitenverhaeltnis: e.seitenverhaeltnis });
    const zeichen = sichtbaresZeichen(e.sichtbar ?? { realistisch: true });
    const medium = await mediumAblegen(e.haushalt, {
      id: neueMedienKennung(), art: 'video', status: 'laeuft', operation, anbieter: tor.anbieter, modell, person, sichtbarkeit: e.sichtbarkeit ?? 'haushalt', prompt: e.prompt,
      kennzeichnung: { ...anbieterKennzeichnung(tor.anbieter), eigeneMarke: true }, ...(e.sichtbar ? { sichtbar: e.sichtbar } : {}), zeichenNoetig: zeichen.noetig,
      kosten: { euroCent: schaetzung.euroCent, geschaetzt: schaetzung.ca }, mengen: schaetzung.mengen,
    });
    await offenAendern(+1);
    await protokoll({ ...basis, ergebnis: 'ok', kostenCent: schaetzung.euroCent });
    await abholenEinreihen();
    return { ok: true, medium, schaetzung };
  } catch (err) {
    await protokoll({ ...basis, ergebnis: 'fehler' });
    return { ok: false, status: fehlerStatus(err), error: fehlerText(err) };
  }
}

// ── Tiefenbericht (asynchron, nur für die fragende Person) ────────────────────

export async function kiTiefenberichtStarten(e: { ki: KiKontext; frage: string; max?: boolean; bestaetigtCent?: number }): Promise<KiWegErgebnis<{ id: string; schaetzung: Schaetzung }>> {
  const person = e.ki.person;
  if (!person || !PERSON.test(person)) return { ok: false, status: 401, error: 'Tiefenberichte nur für eine angemeldete Person.' };
  if (!e.frage.trim()) return { ok: false, status: 400, error: 'Frage fehlt.' };
  if (e.frage.length > FRAGE_MAX) return { ok: false, status: 413, error: `Frage zu lang (höchstens ${FRAGE_MAX} Zeichen).` };
  const modell = e.max ? 'deep-research-max-preview-04-2026' : 'deep-research-preview-04-2026';
  const schaetzung = kostenSchaetzen({ faehigkeit: 'tiefenbericht', modell });
  const tor = await anbieterTor({ faehigkeit: 'tiefenbericht', ki: e.ki, schaetzung, bestaetigtCent: e.bestaetigtCent });
  if (!tor.ok) { await protokoll({ zweck: 'ki-tiefenbericht', ki: e.ki, faehigkeit: 'tiefenbericht', modell, ergebnis: 'gesperrt', grund: tor.grund, lauf: tor.lauf, person: tor.person }); return gesperrt(tor.grund, schaetzung); }
  const v = vertexKonfig();
  if (!v) return gesperrt('anbieter-nicht-eingerichtet', schaetzung);
  const basis = { zweck: 'ki-tiefenbericht', ki: e.ki, faehigkeit: 'tiefenbericht' as const, modell, anbieter: tor.anbieter, region: tor.region, stufe: tor.stufe, lauf: tor.lauf, person: tor.person };
  try {
    const { vertexTiefenberichtStarten } = await import('./adapter/google-vertex');
    const { vorgang } = await vertexTiefenberichtStarten(v, modell, await hinaus(tor, e.frage));
    const t = await tiefenberichtAnlegen(person, { frage: e.frage, modell, vorgang, kosten: { euroCent: schaetzung.euroCent, geschaetzt: schaetzung.ca } });
    await offenAendern(+1);
    await protokoll({ ...basis, ergebnis: 'ok', kostenCent: schaetzung.euroCent });
    await abholenEinreihen();
    return { ok: true, id: t.id, schaetzung };
  } catch (err) {
    await protokoll({ ...basis, ergebnis: 'fehler' });
    return { ok: false, status: fehlerStatus(err), error: fehlerText(err) };
  }
}

// ── Transkription (nur Adapter-Weg; TRANSKRIPTION_AN bleibt aus) ──────────────

export async function kiTranskript(e: { ki: KiKontext; bytes: Uint8Array; mime: string; dateiname?: string }): Promise<KiWegErgebnis<{ text: string; modell: string }>> {
  const tor = await anbieterTor({ faehigkeit: 'transkript', ki: e.ki });
  const { transkriptionsModell } = await import('./konfig');
  const modell = transkriptionsModell();
  if (!tor.ok) { await protokoll({ zweck: 'ki-transkript', ki: e.ki, faehigkeit: 'transkript', modell, ergebnis: 'gesperrt', grund: tor.grund, lauf: tor.lauf, person: tor.person }); return gesperrt(tor.grund); }
  const basis = { zweck: 'ki-transkript', ki: e.ki, faehigkeit: 'transkript' as const, modell, anbieter: tor.anbieter, region: tor.region, stufe: tor.stufe, lauf: tor.lauf, person: tor.person };
  try {
    const { voxtralTranskribieren } = await import('./adapter/mistral');
    const r = await voxtralTranskribieren({ bytes: e.bytes, mime: e.mime, dateiname: e.dateiname });
    const minuten = (r.sekunden ?? 0) / 60;
    const { notiereMengen } = await import('@/lib/zoe/verbrauch');
    if (minuten) await notiereMengen(r.modell, 'ki-transkript', { minute: minuten }, tor.anbieter).catch(() => undefined);
    await protokoll({ ...basis, ergebnis: 'ok', kostenCent: kostenSchaetzen({ faehigkeit: 'transkript', modell: r.modell, minuten }).euroCent });
    return { ok: true, text: r.text, modell: r.modell };
  } catch (err) {
    await protokoll({ ...basis, ergebnis: 'fehler' });
    return { ok: false, status: fehlerStatus(err), error: fehlerText(err) };
  }
}

// ── Abholen (Takt → Warteschlange `ki-medien`) ────────────────────────────────

/** Den Abhol-Auftrag in die Warteschlange legen (idempotent über den Schlüssel der Warteschlange). */
async function abholenEinreihen(): Promise<void> {
  try { const { reihe } = await import('@/lib/zoe/auftraege'); await reihe([{ art: 'agent', name: 'ki-medien', anlass: 'KI-Medien abholen' }]); } catch { /* der Takt holt es nach */ }
}

/** Veo-Ergebnisse liegen nur 2 Tage beim Anbieter (MODELLE.md 2.4) — danach gilt ein Auftrag als abgelaufen. */
export const ABHOL_FRIST_MS = 2 * 86_400_000;

/**
 * Laufende Video- und Tiefenbericht-Aufträge aller Haushalte bzw. Personen abholen (ohne KI-Aufruf im eigentlichen Sinn: nur Ergebnisse
 * holen, die schon bezahlt sind). Fertig → verschlüsselt ablegen, Kosten buchen. Danach Papierkorb und Fristen aufräumen.
 */
export async function kiAuftraegeAbholen(jetzt = new Date()): Promise<{ fertig: number; offen: number; fehler: number }> {
  const v = vertexKonfig();
  const { ladeKonten } = await import('@/lib/zugang/konten');
  const konten = (await ladeKonten()).konten;
  const haushalte = Array.from(new Set(konten.map(k => k.haushalt).filter((h): h is string => typeof h === 'string' && !!h)));
  let fertig = 0, offen = 0, fehler = 0;
  const { vertexVideoAbholen, vertexTiefenberichtAbholen } = await import('./adapter/google-vertex');
  const { notiereMengen } = await import('@/lib/zoe/verbrauch');
  for (const h of haushalte) {
    for (const m of await laufendeMedien(h)) {
      if (jetzt.getTime() - Date.parse(m.erzeugtAm) > ABHOL_FRIST_MS) { await mediumAbschliessen(h, m.id, { fehler: 'abgelaufen (nach 2 Tagen beim Anbieter nicht mehr abholbar)' }); fehler++; continue; }
      if (!v) { offen++; continue; }
      try {
        const r = await vertexVideoAbholen(v, m.modell, m.operation!);
        if (!r.fertig) { offen++; continue; }
        if (!r.videos.length) { await mediumAbschliessen(h, m.id, { fehler: r.gefiltert ? 'vom Anbieter gefiltert' : 'kein Video in der Antwort' }); fehler++; continue; }
        await mediumAbschliessen(h, m.id, { bytes: r.videos[0].bytes, mime: r.videos[0].mime });
        if (m.mengen) await notiereMengen(m.modell, 'ki-video', m.mengen, m.anbieter).catch(() => undefined);
        fertig++;
      } catch (err) {
        await mediumAbschliessen(h, m.id, { versuch: true });
        if ((m.versuche ?? 0) >= 5) { await mediumAbschliessen(h, m.id, { fehler: fehlerText(err) }); fehler++; } else offen++;
      }
    }
    await medienAufraeumen(h, jetzt).catch(() => 0);
  }
  for (const k of konten) {
    const p = k.speicher;
    if (!p || !PERSON.test(p)) continue;
    for (const t of await laufendeTiefenberichte(p)) {
      if (!v) { offen++; continue; }
      try {
        const r = await vertexTiefenberichtAbholen(v, t.vorgang!);
        if (!r.fertig) { offen++; continue; }
        await tiefenberichtAbschliessen(p, t.id, { bericht: r.bericht });
        await notiereMengen(t.modell, 'ki-tiefenbericht', { aufgabe: 1 }, 'google-vertex').catch(() => undefined);
        fertig++;
      } catch (err) {
        await tiefenberichtAbschliessen(p, t.id, { versuch: true });
        if ((t.versuche ?? 0) >= 5) { await tiefenberichtAbschliessen(p, t.id, { fehler: fehlerText(err) }); fehler++; } else offen++;
      }
    }
    await tiefenberichteAufraeumen(p, jetzt).catch(() => 0);
  }
  await updateJson<OffenStand>(KI_AUFTRAEGE_OFFEN, () => ({ offen, geaendert: jetzt.toISOString() }));
  return { fertig, offen, fehler };
}
