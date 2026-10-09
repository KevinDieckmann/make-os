// ─── Medien — Betroffenenrechte: Auskunft (Art. 15), Konto löschen (09.10., Paket 5) ─────────────────────────────────────────
// Art. 17 eines Kontakts läuft über den allgemeinen Weg (lib/crm/person-weitere.ts tilgt `medien--*`/`medien-privat--*`: die Kennung wird
// „[gelöscht]“) — die Medien sind dann sofort gesperrt (`personenSperre` → art17), der tägliche Lauf schreibt die Sperre fest und legt
// EINE Prüf-Aufgabe an (lib/medien/pflege.ts). Gelöscht wird ein Medium nie automatisch (Kevin 09.10.: „Art. 17 → sperren + Prüfung“).
// Konto löschen (lib/datenschutz/konto-daten.ts › kontoLoeschen, eigener Schritt): private Medien samt Objekten weg (der Bestand
// `medien-privat--<person>` fällt danach mit den übrigen Beständen der Person), offene Uploads weg; im
// Business bleibt das Medium, `von` und alle Stempel der Person werden „[gelöscht]“ (Plattform: Arbeit des Haushalts bleibt).
// Selbstprüfung (09.10., Nachzug): `medienPruefZahlen` — nur Zähler über Freigaben und Einwilligungen des Business-Bestands (lib/crm/datenschutz.ts
// › Punkt „Medien: Einwilligungen und Freigaben“, nur wenn es Medien gibt). Nie Namen, nie Kennungen.

import { medienBestand, medienPrivatBestand, type MedienKatalog, type Medium, type MedienEinwilligung } from './typen';
import { freigabeGruende, wirksamerStatus, type Lage } from './regeln';
import { ladeKatalog, katalogAendern, haushaltsPersonen, objekteLoeschen } from './server';
import { karteiHaushalt } from '@/lib/crm/sperrliste';
import { tagVon } from '@/lib/zeit';

const GELOESCHT = '[gelöscht]';

export interface MedienAuskunft {
  medien: { id: string; tag: string; album?: string; bereich: string; rolle: string; freigabe: string; kanaele?: string[]; bis?: string }[];
  einwilligungen: { id: string; am: string; zwecke: string[]; fassung: string; widerrufen?: string }[];
}

/** Art. 15: Medien, auf denen die Person markiert ist, und ihre Einwilligungen (Kopie der Angaben — Bilder auf Anfrage über die App). */
export function medienAuskunftRein(kataloge: readonly MedienKatalog[], kontaktId: string): MedienAuskunft {
  const raus: MedienAuskunft = { medien: [], einwilligungen: [] };
  for (const k of kataloge) {
    for (const m of k.medien) {
      const p = m.personen.find(x => x.kontaktId === kontaktId);
      if (!p) continue;
      const album = m.album ? k.alben.find(a => a.id === m.album)?.titel : undefined;
      raus.medien.push({ id: m.id, tag: tagVon(m.aufgenommen ?? m.hochgeladen), ...(album ? { album } : {}), bereich: m.bereich, rolle: p.rolle, freigabe: m.marketing.status, ...(m.marketing.kanaele ? { kanaele: m.marketing.kanaele } : {}), ...(m.marketing.bis ? { bis: m.marketing.bis } : {}) });
    }
    for (const e of k.einwilligungen ?? []) {
      if (e.person.kontaktId !== kontaktId) continue;
      raus.einwilligungen.push({ id: e.id, am: tagVon(e.am), zwecke: e.zwecke, fassung: e.fassung, ...(e.widerruf ? { widerrufen: tagVon(e.widerruf.am) } : {}) });
    }
  }
  return raus;
}

export async function medienAuskunft(kontaktId: string): Promise<MedienAuskunft> {
  const namen = [medienBestand(await karteiHaushalt()), ...(await haushaltsPersonen()).map(medienPrivatBestand)];
  const kataloge: MedienKatalog[] = [];
  for (const n of namen) kataloge.push(await ladeKatalog(n));
  return medienAuskunftRein(kataloge, kontaktId);
}

/** Stempel einer gelöschten Person im Business-Katalog tilgen (rein). */
export function businessOhnePerson(k: MedienKatalog, p: string): { katalog: MedienKatalog; n: number } {
  let n = 0;
  const t = (v: string | undefined) => (v === p ? (n++, GELOESCHT) : v);
  const medien = k.medien.map((m): Medium => {
    const auswahl = m.auswahl && p in m.auswahl ? (() => { n++; const { [p]: _x, ...rest } = m.auswahl!; return Object.keys(rest).length ? rest : undefined; })() : m.auswahl;
    const neu: Medium = {
      ...m, von: t(m.von)!,
      personen: m.personen.map(x => ({ ...x, markiertVon: t(x.markiertVon)!, ...(x.konto === p ? { konto: (n++, GELOESCHT) } : {}) })),
      marketing: { ...m.marketing, ...(m.marketing.angefragtVon ? { angefragtVon: t(m.marketing.angefragtVon) } : {}), ...(m.marketing.freigegebenVon ? { freigegebenVon: t(m.marketing.freigegebenVon) } : {}), ...(m.marketing.kiKennzeichnung ? { kiKennzeichnung: { ...m.marketing.kiKennzeichnung, bestaetigtVon: t(m.marketing.kiKennzeichnung.bestaetigtVon)! } } : {}), verlauf: m.marketing.verlauf.map(v => ({ ...v, von: t(v.von)! })) },
      heads: m.heads.map(h => ({ ...h, von: t(h.von)! })),
      ...(m.texte ? { texte: { ...m.texte, von: t(m.texte.von)! } } : {}),
      ...(m.vorschlaege ? { vorschlaege: m.vorschlaege.map(v => ({ ...v, freigegebenVon: t(v.freigegebenVon)! })) } : {}),
      ...(m.geaendertVon ? { geaendertVon: t(m.geaendertVon) } : {}), ...(m.geloeschtVon ? { geloeschtVon: t(m.geloeschtVon) } : {}),
      ...(m.urheber.lizenz ? { urheber: { ...m.urheber, lizenz: { ...m.urheber.lizenz, von: t(m.urheber.lizenz.von)! } } } : {}),
    };
    if (auswahl) neu.auswahl = auswahl; else delete neu.auswahl;
    return neu;
  });
  const alben = k.alben.map(a => ({ ...a, von: t(a.von)! }));
  const einwilligungen = k.einwilligungen?.map((e): MedienEinwilligung => ({
    ...e, erfasstVon: t(e.erfasstVon)!, person: e.person.konto === p ? { ...e.person, konto: (n++, GELOESCHT) } : e.person,
    ...(e.widerruf ? { widerruf: { ...e.widerruf, von: t(e.widerruf.von)! } } : {}),
  }));
  return { katalog: { ...k, medien, alben, ...(einwilligungen ? { einwilligungen } : {}) }, n };
}

/** Konto löschen — vor dem Entfernen der Bestände der Person (konto-daten.ts). Wirft nie; Zählung für den Bericht. */
export async function medienKontoEntfernen(person: string): Promise<{ objekte: number; sitzungen: number; business: number }> {
  const r = { objekte: 0, sitzungen: 0, business: 0 };
  try {
    for (const m of (await ladeKatalog(medienPrivatBestand(person))).medien) r.objekte += await objekteLoeschen(m);
  } catch (e) { console.error('[medien] Konto löschen (privat):', e instanceof Error ? e.message : e); }
  try {
    const { alleSitzungen, sitzungEntsorgen } = await import('./upload-server');
    for (const s of (await alleSitzungen()).filter(x => x.person === person)) { await sitzungEntsorgen(s); r.sitzungen++; }
  } catch (e) { console.error('[medien] Konto löschen (Uploads):', e instanceof Error ? e.message : e); }
  try {
    await katalogAendern(medienBestand(await karteiHaushalt()), k => { const x = businessOhnePerson(k, person); r.business = x.n; return { ok: true as const, katalog: x.katalog }; });
  } catch (e) { console.error('[medien] Konto löschen (Business):', e instanceof Error ? e.message : e); }
  return r;
}

// ── Selbstprüfung Datenschutz (09.10., Nachzug Paket 5) — nur Zähler ─────────────────────────────────────────────────────

export interface MedienPruefZahlen {
  /** Business-Medien (ohne Papierkorb). */
  medien: number;
  /** Wirksam freigegeben (heute). */
  freigegeben: number;
  /** Freigabe angefragt (wartet auf die zweite Person bzw. die Marketing-Verantwortliche). */
  angefragt: number;
  /** Wirksam freigegeben, aber die Freigabe trägt heute nicht mehr (z. B. Einwilligung deckt einen Kanal nicht, Personenfrage offen). */
  ohneDeckung: number;
  /** Als „freigegeben“ gespeichert, aber gesperrt (Widerruf, Art. 17/18, Werbesperre) — aus den Kanälen entfernen; der Tageslauf schreibt die Sperre fest. */
  gesperrtFreigegeben: number;
  /** Als „freigegeben“ gespeichert, bis-Datum vorbei. */
  abgelaufen: number;
  /** „Erkennbare Personen?“ unbeantwortet oder „unklar“ (geht nie hinaus). */
  personenOffen: number;
  /** Rohmaterial mit Personen, seit der Frist „medien-roh“ nicht freigegeben (Prüf-Aufgabe). */
  roh: number;
  einwilligungen: number;
  widerrufen: number;
}

/** Zähler aus dem Business-Katalog (rein). `rohSeit` = Grenze der Frist „medien-roh“ (Kalendertag). */
export function medienPruefZahlenRein(k: MedienKatalog, lage: Lage, rohSeit: string): MedienPruefZahlen {
  const z: MedienPruefZahlen = { medien: 0, freigegeben: 0, angefragt: 0, ohneDeckung: 0, gesperrtFreigegeben: 0, abgelaufen: 0, personenOffen: 0, roh: 0, einwilligungen: 0, widerrufen: 0 };
  for (const m of k.medien) {
    if (m.geloeschtAm || m.bereich !== 'business') continue;
    z.medien++;
    const w = wirksamerStatus(m, lage);
    if (m.marketing.status === 'angefragt') z.angefragt++;
    if (!m.erkennbarePersonen || m.erkennbarePersonen === 'unklar') z.personenOffen++;
    if (m.marketing.status === 'freigegeben') {
      if (w.status === 'gesperrt') z.gesperrtFreigegeben++;
      else if (w.status === 'abgelaufen') z.abgelaufen++;
      else {
        z.freigegeben++;
        // Trägt die Freigabe heute noch? Dieselben Pflichten wie beim Freigeben — der Ablauf zählt oben, deshalb hier ein Datum in der Zukunft.
        const album = m.album ? k.alben.find(a => a.id === m.album) : undefined;
        const bis = m.marketing.bis && m.marketing.bis > lage.heute ? m.marketing.bis : '9999-12-31';
        if (freigabeGruende(m, album, m.marketing.kanaele ?? [], bis, lage, { kiZeichenBestaetigt: !!m.marketing.kiKennzeichnung }).length) z.ohneDeckung++;
      }
    }
    const mitPersonen = m.erkennbarePersonen === 'ja' || m.personen.length > 0;
    if (mitPersonen && m.marketing.status !== 'freigegeben' && tagVon(m.hochgeladen) < rohSeit) z.roh++;
  }
  for (const e of k.einwilligungen ?? []) { z.einwilligungen++; if (e.widerruf) z.widerrufen++; }
  return z;
}

/** Die Zähler der Instanz (Server) — `null`, wenn es keine Business-Medien und keine Einwilligungen gibt (dann gibt es den Prüfpunkt nicht). */
export async function medienPruefZahlen(): Promise<MedienPruefZahlen | null> {
  const k = await ladeKatalog(medienBestand(await karteiHaushalt()));
  if (!k.medien.some(m => !m.geloeschtAm) && !(k.einwilligungen ?? []).length) return null;
  const { lageFuer } = await import('./server');
  const { monateZurueck } = await import('./pflege');
  const { loadJson } = await import('@/lib/store/local-db');
  const { LOESCHFRISTEN_SPEICHER, fristenWirksam } = await import('@/lib/crm/loeschfristen');
  const lage = await lageFuer(k);
  const fristen = fristenWirksam(((await loadJson<import('@/lib/crm/loeschfristen').LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER).catch(() => null)) ?? {}).fristen);
  return medienPruefZahlenRein(k, lage, monateZurueck(lage.heute, fristen['medien-roh']));
}
