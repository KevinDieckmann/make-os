// ─── Medien — Server: Kataloge lesen und schreiben (EINE Schreibstelle), Sicht, Aktionen (09.10., Paket 5) ─────────────────────
// Wer liest: GET /api/medien, die Inhalt-Route, Heads (`medienFuerHead`, lib/medien/heads.ts), Art. 15 (lib/medien/datenschutz.ts).
// Wer schreibt: nur über `katalogAendern` (Sperre des Bestands, local-db). Die Regeln stehen rein in lib/medien/regeln.ts.
// Personen kommen IMMER aus der Sitzung (die Route nimmt `eigenePerson`) — nie aus dem Körper, nie der Dienstweg.

import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { ladeKonten } from '@/lib/zugang/konten';
import { karteiHaushalt } from '@/lib/crm/sperrliste';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import {
  medienBestand, medienPrivatBestand, leererKatalog, GRENZEN,
  type Bereich, type MedienKatalog, type Medium, type MedienListeAntwort, type MedienEinwilligung,
} from './typen';
import {
  medienFuerBetrachter, alsSicht, albumAlsSicht, einwilligungAlsSicht, darfFreigeben, mediumAktion, albumAnlegen, albumAendern,
  einwilligungWiderrufen, zweckeAus, text, mediumSichtbar, type Betrachter, type Quelle, type Lage, type Fehler, type Kontext,
} from './regeln';

const PERSON_OK = /^[a-z0-9-]{1,40}$/;

// ── Wer schaut ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Person im Haushalt des Inhabers als Betrachter — null, wenn sie nicht dazugehört (die Route hat das schon geprüft). */
export async function betrachterFuer(person: string): Promise<Betrachter | null> {
  if (!PERSON_OK.test(person)) return null;
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  const ich = konten.find(k => k.speicher === person);
  if (!inhaber || !ich) return null;
  const istInhaber = ich.speicher === inhaber.speicher;
  if (!istInhaber && !(inhaber.haushalt && ich.haushalt === inhaber.haushalt)) return null;
  // Volles Mitglied = ohne Einschränkung „nur Business“ (auch der Inhaber selbst kann so eingeschränkt sein — dann sieht er kein Privat der anderen).
  const voll = ich.finanzRecht !== 'business';
  let marketing = false;
  try { marketing = (await import('@/lib/crm/team')).verantwortlich('marketing') === person; } catch { /* ohne Team-Zuordnung: nur volle Mitglieder */ }
  return { person, haushalt: await karteiHaushalt(), voll, marketing };
}

/** Speichernamen der Konten im Haushalt des Inhabers (für die Privat-Kataloge mit Alben „Haushalt“). */
export async function haushaltsPersonen(): Promise<string[]> {
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  if (!inhaber) return [];
  return konten.filter(k => k.speicher === inhaber.speicher || (!!inhaber.haushalt && k.haushalt === inhaber.haushalt)).map(k => k.speicher).filter(s => PERSON_OK.test(s));
}

// ── Kataloge ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const katalogName = (art: Bereich, wer: string): string => (art === 'business' ? medienBestand(wer) : medienPrivatBestand(wer));

export async function ladeKatalog(name: string): Promise<MedienKatalog> {
  const k = await loadJson<MedienKatalog>(name);
  return k && Array.isArray(k.medien) && Array.isArray(k.alben) ? k : leererKatalog();
}

/**
 * DIE Schreibstelle der Kataloge: in der Sperre des Bestands frisch lesen, rechnen, schreiben. Gibt `fn` einen Fehler zurück, bleibt der
 * Bestand unverändert. Grenze: höchstens so viele Medien wie ein Bestand sinnvoll trägt — darüber 413, nie gekürzt.
 */
export async function katalogAendern<T extends { ok: true; katalog: MedienKatalog }>(name: string, fn: (k: MedienKatalog) => T | Fehler | Promise<T | Fehler>): Promise<T | Fehler> {
  let raus: T | Fehler = { ok: false, status: 404, fehler: 'Nicht gefunden.' };
  await updateJsonAsync<MedienKatalog>(name, async cur => {
    const k = cur && Array.isArray(cur.medien) ? cur : leererKatalog();
    const r = await fn(k);
    raus = r;
    if (!r.ok) return cur ?? (k as MedienKatalog);
    if (r.katalog.medien.length > 20_000) { raus = { ok: false, status: 413, fehler: 'Zu viele Medien in diesem Bestand.' }; return cur ?? k; }
    return r.katalog;
  });
  return raus;
}

/** Alle Kataloge, die eine Person überhaupt sehen KÖNNTE (der Filter `medienFuerBetrachter` entscheidet danach je Eintrag). */
export async function quellenFuer(b: Betrachter): Promise<Quelle[]> {
  const q: Quelle[] = [{ art: 'business', katalog: await ladeKatalog(medienBestand(b.haushalt)) }];
  const personen = b.voll ? await haushaltsPersonen() : [b.person];
  for (const p of personen) {
    if (p !== b.person && !b.voll) continue;
    q.push({ art: 'privat', besitzer: p, katalog: await ladeKatalog(medienPrivatBestand(p)) });
  }
  return q;
}

// ── Lage (Einwilligungen, Sperren der Kartei) ───────────────────────────────────────────────────────────────────────────

/** Was über die Personen im Bild bekannt ist. Die Kartei wird nur gelesen, wenn ein Kontakt markiert ist. */
export async function lageFuer(business: MedienKatalog, kataloge: readonly MedienKatalog[] = [business], heute = localDay()): Promise<Lage> {
  const braucht = kataloge.some(k => k.medien.some(m => m.personen.some(p => p.art === 'kontakt')));
  let sperren: Map<string, 'art18' | 'werbesperre' | null> | null = null;
  if (braucht) {
    // Schutz, nicht Verarbeitung: um eine Einschränkung (Art. 18) zu ERKENNEN, braucht es auch die eingeschränkten Personen.
    const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
    const { istEingeschraenkt } = await import('@/lib/crm/einschraenkung');
    sperren = new Map();
    for (const k of await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })) sperren.set(k.id, istEingeschraenkt(k) ? 'art18' : k.werbesperre ? 'werbesperre' : null);
  }
  return {
    heute,
    einwilligungen: business.einwilligungen ?? [],
    kontaktSperre: id => (sperren ? (sperren.has(id) ? sperren.get(id)! : 'art17') : null),
  };
}

// ── Lesen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function medienListe(person: string, opt: { papierkorb?: boolean } = {}): Promise<MedienListeAntwort | null> {
  const b = await betrachterFuer(person);
  if (!b) return null;
  const quellen = await quellenFuer(b);
  const sicht = medienFuerBetrachter(quellen, b, opt);
  const business = quellen[0].katalog;
  const lage = await lageFuer(business, quellen.map(q => q.katalog));
  const zaehle = new Map<string, number>();
  for (const s of medienFuerBetrachter(quellen, b).medien) if (s.medium.album) zaehle.set(s.medium.album, (zaehle.get(s.medium.album) ?? 0) + 1);
  const { medienKonfig, medienSpeicher } = await import('./speicher');
  const konfig = medienKonfig();
  const modus = konfig.modus;
  let voll = false;
  if (konfig.modus === 'ordner') { const s = await medienSpeicher().catch(() => null); if (s?.belegt) voll = (await s.belegt().catch(() => 0)) >= konfig.grenze * 0.95; }
  return {
    ok: true,
    medien: sicht.medien.sort((x, y) => (y.medium.aufgenommen ?? y.medium.hochgeladen).localeCompare(x.medium.aufgenommen ?? x.medium.hochgeladen)).map(s => alsSicht(s.medium, s.quelle, b, lage)),
    alben: sicht.alben.map(a => albumAlsSicht(a.album, a.quelle, b, zaehle.get(a.album.id) ?? 0)),
    // Einwilligungen (Personen Dritter) nur für die, die freigeben dürfen — sie brauchen sie zum Prüfen.
    einwilligungen: darfFreigeben(b) ? (business.einwilligungen ?? []).map(einwilligungAlsSicht) : [],
    ich: b.person,
    rechte: { privat: b.voll, freigeben: darfFreigeben(b), heads: true },
    speicher: { modus, voll },
  };
}

/** Ein Medium finden, das die Person sieht (oder im Papierkorb ändern darf): Business zuerst, dann Privat. */
export async function mediumFinden(b: Betrachter, id: string): Promise<{ medium: Medium; quelle: Quelle; name: string } | null> {
  for (const q of await quellenFuer(b)) {
    const m = q.katalog.medien.find(x => x.id === id);
    if (!m) continue;
    if (!mediumSichtbar(m, q, b)) return null;
    return { medium: m, quelle: q, name: katalogName(q.art, q.art === 'business' ? b.haushalt : q.besitzer!) };
  }
  return null;
}

// ── Schreiben (Aktionen der Oberfläche) ─────────────────────────────────────────────────────────────────────────────────

export type AktionErgebnis = { ok: true; medium?: unknown; album?: unknown; einwilligung?: unknown; text?: string } | { ok: false; status: number; fehler: string };

const jetztIso = () => new Date().toISOString();

/** Kontext für eine reine Aktion — Lage mit den Einwilligungen des Business-Bestands (frisch gelesen bzw. derselbe Katalog in der Sperre). */
async function kontextFuer(b: Betrachter, quelle: Quelle): Promise<Kontext> {
  const business = quelle.art === 'business' ? quelle.katalog : await ladeKatalog(medienBestand(b.haushalt));
  return { b, quelle, lage: await lageFuer(business, [quelle.katalog]), jetzt: jetztIso(), neueId: neueKennung };
}

/**
 * Eine Aktion an einem Medium bzw. Album ausführen — immer frisch in der Sperre des richtigen Katalogs, die Sicht der Person geprüft.
 * Antwort mit der neuen Sicht des Mediums (nie Schlüssel).
 */
export async function aktionAusfuehren(person: string, a: Record<string, unknown>): Promise<AktionErgebnis> {
  const b = await betrachterFuer(person);
  if (!b) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
  const art = String(a.aktion ?? '');

  if (art === 'album-anlegen') {
    const bereich: Bereich = a.bereich === 'privat' ? 'privat' : 'business';
    if (bereich === 'privat' && !b.voll) return { ok: false, status: 403, fehler: 'Private Alben gibt es nur für volle Mitglieder des Haushalts.' };
    const name = katalogName(bereich, bereich === 'business' ? b.haushalt : b.person);
    const r = await katalogAendern(name, async kat => albumAnlegen(await kontextFuer(b, { art: bereich, ...(bereich === 'privat' ? { besitzer: b.person } : {}), katalog: kat }), a));
    return r.ok ? { ok: true, album: albumAlsSicht(r.album, { art: bereich, besitzer: bereich === 'privat' ? b.person : undefined, katalog: r.katalog }, b, 0) } : r;
  }
  if (art === 'album-aendern') {
    const id = String(a.id ?? '');
    for (const q of await quellenFuer(b)) {
      if (!q.katalog.alben.some(x => x.id === id)) continue;
      const name = katalogName(q.art, q.art === 'business' ? b.haushalt : q.besitzer!);
      const r = await katalogAendern(name, async kat => albumAendern(await kontextFuer(b, { ...q, katalog: kat }), a));
      return r.ok ? { ok: true, album: albumAlsSicht(r.album, { ...q, katalog: r.katalog }, b, 0) } : r;
    }
    return { ok: false, status: 404, fehler: 'Album nicht gefunden.' };
  }
  if (art === 'einwilligung-widerrufen') {
    if (!darfFreigeben(b)) return { ok: false, status: 403, fehler: 'Einwilligungen verwalten die Marketing-Verantwortliche und volle Mitglieder.' };
    const grund = text(a.grund, GRENZEN.grund);
    if (grund === null) return { ok: false, status: 413, fehler: 'Grund zu lang.' };
    let betroffene: Medium[] = [];
    const r = await katalogAendern(medienBestand(b.haushalt), kat => {
      const w = einwilligungWiderrufen(kat, a.id, b.person, jetztIso(), grund);
      if (w.ok) betroffene = w.katalog.medien.filter(m => w.betroffen.includes(m.id));
      return w;
    });
    if (!r.ok) return r;
    await widerrufAufgabe(String(a.id), betroffene).catch(e => console.error('[medien] Widerruf-Aufgabe:', e instanceof Error ? e.message : e));
    return { ok: true, text: `Einwilligung widerrufen — ${betroffene.length} ${betroffene.length === 1 ? 'Medium' : 'Medien'} gesperrt.` };
  }
  if (art === 'bereich-wechseln') return bereichWechseln(b, String(a.id ?? ''), a.bereich === 'privat' ? 'privat' : 'business');
  if (art === 'endgueltig') return endgueltigLoeschen(b, String(a.id ?? ''));

  const id = String(a.id ?? '');
  const ort = await ortVon(b, id);
  if (!ort) return { ok: false, status: 404, fehler: 'Medium nicht gefunden.' };
  const r = await katalogAendern(ort.name, async kat => mediumAktion(await kontextFuer(b, { ...ort.quelle, katalog: kat }), id, a));
  if (!r.ok) return r;
  if (art === 'freigabe' && a.schritt === 'anfragen') await freigabeAngefragtMelden(b, r.medium).catch(e => console.error('[medien] Glocke Freigabe:', e instanceof Error ? e.message : e));
  const k = await kontextFuer(b, { ...ort.quelle, katalog: r.katalog });
  return { ok: true, medium: alsSicht(r.medium, k.quelle, b, k.lage) };
}

/**
 * Glocke „Freigabe angefragt“ (Paket 4c) an die ZWEITE Person: wenn das Vier-Augen-Prinzip gilt (erkennbare Personen) oder die anfragende Person
 * selbst nicht freigeben darf — an alle anderen im Haushalt, die freigeben dürfen (Marketing-Verantwortliche, volle Mitglieder). Text neutral,
 * ohne Bild- oder Albumnamen; nie an die anfragende Person selbst (melde() verweigert das ohnehin).
 */
async function freigabeAngefragtMelden(b: Betrachter, m: Medium): Promise<number> {
  if (m.erkennbarePersonen !== 'ja' && darfFreigeben(b)) return 0;
  const [{ melde }, { WEG }] = await Promise.all([import('@/lib/meldungen/melden'), import('@/lib/wege')]);
  let n = 0;
  for (const p of await haushaltsPersonen()) {
    if (p === b.person) continue;
    const andere = await betrachterFuer(p);
    if (!andere || !darfFreigeben(andere)) continue;
    await melde({ an: p, von: b.person, art: 'medien', titel: m.erkennbarePersonen === 'ja' ? 'Ein Foto wartet auf deine Freigabe (Vier-Augen)' : 'Ein Medium wartet auf deine Freigabe', link: WEG.medien({ id: m.id }) });
    n++;
  }
  return n;
}

/** Wo liegt ein Medium (auch im Papierkorb, wenn die Person es ändern darf)? */
async function ortVon(b: Betrachter, id: string): Promise<{ quelle: Quelle; name: string } | null> {
  for (const q of await quellenFuer(b)) {
    const m = q.katalog.medien.find(x => x.id === id);
    if (!m) continue;
    const name = katalogName(q.art, q.art === 'business' ? b.haushalt : q.besitzer!);
    if (mediumSichtbar(m, q, b)) return { quelle: q, name };
    return null;
  }
  return null;
}

/**
 * Privat ↔ Business umziehen (Kevin: Bereich beim Aufnehmen, danach änderbar; RECHT.md 3.6: „Umziehen Privat → Business nur per Klick mit
 * erneuter Ampel“). Nur die Person, die aufgenommen hat; nie, solange eine Freigabe läuft oder ein Head es hat. Album fällt weg, Personen-
 * Markierungen und Freigabe beginnen neu. Zwei Bestände: erst der Ziel-, darin der Quell-Bestand (feste Reihenfolge Business → Privat).
 */
async function bereichWechseln(b: Betrachter, id: string, ziel: Bereich): Promise<AktionErgebnis> {
  if (ziel === 'privat' && !b.voll) return { ok: false, status: 403, fehler: 'Privat gibt es nur für volle Mitglieder des Haushalts.' };
  const businessName = medienBestand(b.haushalt), privatName = medienPrivatBestand(b.person);
  let raus: AktionErgebnis = { ok: false, status: 404, fehler: 'Medium nicht gefunden.' };
  let neu: Medium | null = null;
  await updateJsonAsync<MedienKatalog>(businessName, async businessCur => {
    const business = businessCur && Array.isArray(businessCur.medien) ? businessCur : leererKatalog();
    let businessNeu = business;
    await updateJson<MedienKatalog>(privatName, privatCur => {
      const privat = privatCur && Array.isArray(privatCur.medien) ? privatCur : leererKatalog();
      const von = ziel === 'business' ? privat : business, nach = ziel === 'business' ? business : privat;
      const m = von.medien.find(x => x.id === id);
      if (!m) return privatCur ?? privat;
      if (m.von !== b.person) { raus = { ok: false, status: 403, fehler: 'Den Bereich wechselt nur die Person, die aufgenommen hat.' }; return privatCur ?? privat; }
      if (m.geloeschtAm) { raus = { ok: false, status: 409, fehler: 'Das Medium liegt im Papierkorb.' }; return privatCur ?? privat; }
      if (m.marketing.status === 'angefragt' || m.marketing.status === 'freigegeben' || m.heads.length) { raus = { ok: false, status: 409, fehler: 'Erst Freigabe und Head-Aufträge zurücknehmen — dann umziehen.' }; return privatCur ?? privat; }
      const j = jetztIso();
      const { album: _a, auswahl: _w, ...rest } = m;
      neu = { ...rest, bereich: ziel, personen: [], marketing: { status: 'intern', verlauf: [...m.marketing.verlauf, { am: j, von: b.person, nach: 'intern', grund: ziel === 'business' ? 'von Privat nach Business' : 'von Business nach Privat' }] }, heads: [], geaendert: j, geaendertVon: b.person };
      const vonNeu = { ...von, medien: von.medien.filter(x => x.id !== id) };
      const nachNeu = { ...nach, medien: [...nach.medien, neu] };
      raus = { ok: true };
      if (ziel === 'business') { businessNeu = nachNeu; return vonNeu; }
      businessNeu = vonNeu; return nachNeu;
    });
    return raus.ok ? businessNeu : (businessCur ?? business);
  });
  if (!raus.ok || !neu) return raus;
  const b2 = await mediumFinden(b, id);
  if (!b2) return { ok: true };
  const k = await kontextFuer(b, b2.quelle);
  return { ok: true, medium: alsSicht(b2.medium, b2.quelle, b, k.lage) };
}

/** Endgültig löschen — nur aus dem Papierkorb; erst die Objekte im Speicher, dann der Eintrag (mit ihm der Schlüssel). */
async function endgueltigLoeschen(b: Betrachter, id: string): Promise<AktionErgebnis> {
  const ort = await ortVon(b, id);
  if (!ort) return { ok: false, status: 404, fehler: 'Medium nicht gefunden.' };
  const m = ort.quelle.katalog.medien.find(x => x.id === id)!;
  if (!m.geloeschtAm) return { ok: false, status: 409, fehler: 'Erst in den Papierkorb legen.' };
  if (ort.quelle.art === 'privat' ? ort.quelle.besitzer !== b.person : !(b.voll || m.von === b.person)) return { ok: false, status: 403, fehler: 'Endgültig löschen darf nur, wer es aufgenommen hat, bzw. ein volles Mitglied.' };
  await objekteLoeschen(m);
  const r = await katalogAendern(ort.name, kat => ({ ok: true as const, katalog: { ...kat, medien: kat.medien.filter(x => x.id !== id) } }));
  return r.ok ? { ok: true, text: 'Endgültig gelöscht.' } : r;
}

/** Alle Objekte eines Mediums im Speicher löschen (Varianten, Lizenz) — Fehler nur ins Log, der Schlüssel fällt mit dem Eintrag. */
export async function objekteLoeschen(m: Pick<Medium, 'varianten' | 'urheber'>): Promise<number> {
  const { medienSpeicher } = await import('./speicher');
  const s = await medienSpeicher();
  if (!s) return 0;
  let n = 0;
  for (const v of [...Object.values(m.varianten), m.urheber.lizenz].filter(Boolean)) {
    try { await s.loeschen(v!.objekt); n++; } catch (e) { console.error('[medien] Objekt nicht gelöscht:', e instanceof Error ? e.message : e); }
  }
  return n;
}

// ── Einwilligung anlegen (Unterschrift am Handy) ─────────────────────────────────────────────────────────────────────────

/** Der Text, den die Person sieht (aus der Einrichtung — nie ein Name im Code), samt Fassung. */
export async function einwilligungVorlage(zwecke: unknown, anlass: unknown, sorgeberechtigt: boolean): Promise<{ wortlaut: string; fassung: string; verantwortlicherFehlt: boolean }> {
  const { verantwortlicherLaden } = await import('@/lib/datenschutz/einrichtung-server');
  const { verantwortlicherText } = await import('@/lib/datenschutz/einrichtung');
  const { einwilligungWortlaut, EINWILLIGUNG_FASSUNG } = await import('./einwilligung');
  const { v } = await verantwortlicherLaden();
  const a = text(anlass, GRENZEN.albumTitel) || undefined;
  return {
    wortlaut: einwilligungWortlaut({ verantwortlicher: verantwortlicherText(v), zwecke: zweckeAus(zwecke), ...(a ? { anlass: a } : {}), weg: v ? (v.mail || v.seite || verantwortlicherText(v)) : verantwortlicherText(v), sorgeberechtigt }),
    fassung: EINWILLIGUNG_FASSUNG,
    verantwortlicherFehlt: !v,
  };
}

const KONTAKT_OK = /^c-[a-z0-9-]{1,62}$/;

/**
 * Einwilligung festhalten (Business): Person (Kontakt/Konto/Name), Zwecke, Wortlaut (vom Server gebaut, Fassung vom Gerät geprüft),
 * Unterschrift (PNG ≤ 300 KB, ohne Metadaten, verschlüsselt im Medienspeicher). Nur anhängend — ändern geht nicht, nur widerrufen.
 */
export async function einwilligungAnlegen(person: string, a: Record<string, unknown>): Promise<AktionErgebnis> {
  const b = await betrachterFuer(person);
  if (!b) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
  const p = (a.person ?? {}) as { kontaktId?: unknown; konto?: unknown; name?: unknown };
  const name = text(p.name, GRENZEN.name);
  if (name === null) return { ok: false, status: 413, fehler: 'Name zu lang.' };
  const wer: MedienEinwilligung['person'] = {};
  if (typeof p.kontaktId === 'string' && KONTAKT_OK.test(p.kontaktId)) wer.kontaktId = p.kontaktId;
  else if (typeof p.konto === 'string' && PERSON_OK.test(p.konto)) wer.konto = p.konto;
  else if (name) wer.name = name;
  else return { ok: false, status: 400, fehler: 'Wer willigt ein? Kontakt, Konto oder Name.' };
  const zwecke = zweckeAus(a.zwecke);
  if (!zwecke.length) return { ok: false, status: 400, fehler: 'Bitte mindestens einen Zweck wählen.' };
  const sorge = text(a.sorgeberechtigt, GRENZEN.name);
  if (sorge === null) return { ok: false, status: 413, fehler: 'Name zu lang.' };
  const album = typeof a.album === 'string' && /^al-[a-z0-9-]{1,94}$/.test(a.album) ? a.album : undefined;
  const vorlage = await einwilligungVorlage(zwecke, a.anlass, !!sorge);
  if (vorlage.verantwortlicherFehlt) return { ok: false, status: 409, fehler: 'Verantwortlicher fehlt — erst unter System › Datenschutz eintragen, sonst ist die Einwilligung nicht informiert.' };
  if (a.fassung !== vorlage.fassung) return { ok: false, status: 409, fehler: 'Der Text der Einwilligung hat sich geändert — bitte neu laden und erneut zeigen.' };
  if (wer.kontaktId) {
    const lage = await lageFuer({ ...leererKatalog(), medien: [{ personen: [{ art: 'kontakt', kontaktId: wer.kontaktId }] } as unknown as Medium] });
    if (lage.kontaktSperre(wer.kontaktId) === 'art18') return { ok: false, status: 409, fehler: 'Diese Person hat die Einschränkung der Verarbeitung verlangt (Art. 18).' };
    if (lage.kontaktSperre(wer.kontaktId) === 'art17') return { ok: false, status: 404, fehler: 'Diese Person gibt es nicht (mehr).' };
  }
  const id = neueKennung('ew');
  let unterschrift: MedienEinwilligung['unterschrift'];
  if (typeof a.unterschrift === 'string' && a.unterschrift) {
    const { unterschriftAblegen } = await import('./upload-server');
    const u = await unterschriftAblegen(id, a.unterschrift);
    if (!u.ok) return u;
    unterschrift = u.verweis;
  } else if (a.nachweis !== 'papier') return { ok: false, status: 400, fehler: 'Bitte unterschreiben lassen.' };
  const e: MedienEinwilligung = {
    id, am: jetztIso(), erfasstVon: b.person, person: wer, zwecke, ...(album ? { album } : {}), wortlaut: vorlage.wortlaut, fassung: vorlage.fassung,
    ...(sorge ? { sorgeberechtigt: sorge } : {}), ...(unterschrift ? { unterschrift } : {}),
  };
  const r = await katalogAendern(medienBestand(b.haushalt), kat => {
    if ((kat.einwilligungen ?? []).length >= 20_000) return { ok: false, status: 413, fehler: 'Zu viele Einwilligungen.' } as Fehler;
    return { ok: true as const, katalog: { ...kat, einwilligungen: [...(kat.einwilligungen ?? []), e] } };
  });
  return r.ok ? { ok: true, einwilligung: einwilligungAlsSicht(e) } : r;
}

// ── Aufgaben (Widerruf, Ablauf, Prüfung) — über den Aufgaben-Schreibweg, nie mit Namen im Titel ─────────────────────────────

/** Widerruf: je freigegebenes Medium die Freigebende benachrichtigen — EINE Aufgabe je Einwilligung (idempotent). */
async function widerrufAufgabe(einwilligungId: string, betroffene: readonly Medium[]): Promise<void> {
  const frei = betroffene.filter(m => m.marketing.freigegebenVon && (m.marketing.verlauf.some(v => v.nach === 'freigegeben')));
  if (!frei.length) return;
  const an = frei[0].marketing.freigegebenVon!;
  const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
  const { WEG } = await import('@/lib/wege');
  const id = `md-widerruf-${einwilligungId}`.slice(0, 80);
  const j = jetztIso();
  await systemAufgabenAendern(stand => {
    if (stand.tasks.some(t => t.id === id)) return {};
    return { neu: [{ id, title: `Einwilligung widerrufen: ${frei.length} ${frei.length === 1 ? 'freigegebenes Medium' : 'freigegebene Medien'} aus den Kanälen entfernen`,
      description: `Ab sofort nicht mehr verwenden (Art. 7 Abs. 3 DSGVO) und — soweit möglich — aus Website, Social Media und Newsletter entfernen. Die Medien sind in MAKE OS gesperrt: ${WEG.medien({ filter: 'gesperrt' })}. Hinweis, keine Rechtsberatung.`,
      status: 'todo', priority: 'high', assignee: an, tags: ['datenschutz', 'medien'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: j, updatedAt: j, space: 'business' }] };
  }, { jetzt: j });
}
