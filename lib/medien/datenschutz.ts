// ─── Medien — Betroffenenrechte: Auskunft (Art. 15), Konto löschen (09.10., Paket 5) ─────────────────────────────────────────
// Art. 17 eines Kontakts läuft über den allgemeinen Weg (lib/crm/person-weitere.ts tilgt `medien--*`/`medien-privat--*`: die Kennung wird
// „[gelöscht]“) — die Medien sind dann sofort gesperrt (`personenSperre` → art17), der tägliche Lauf schreibt die Sperre fest und legt
// EINE Prüf-Aufgabe an (lib/medien/pflege.ts). Gelöscht wird ein Medium nie automatisch (Kevin 09.10.: „Art. 17 → sperren + Prüfung“).
// Konto löschen (lib/datenschutz/konto-daten.ts › kontoLoeschen, eigener Schritt): private Medien samt Objekten weg (der Bestand
// `medien-privat--<person>` fällt danach mit den übrigen Beständen der Person), offene Uploads weg; im
// Business bleibt das Medium, `von` und alle Stempel der Person werden „[gelöscht]“ (Plattform: Arbeit des Haushalts bleibt).

import { medienBestand, medienPrivatBestand, type MedienKatalog, type Medium, type MedienEinwilligung } from './typen';
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
      marketing: { ...m.marketing, ...(m.marketing.angefragtVon ? { angefragtVon: t(m.marketing.angefragtVon) } : {}), ...(m.marketing.freigegebenVon ? { freigegebenVon: t(m.marketing.freigegebenVon) } : {}), verlauf: m.marketing.verlauf.map(v => ({ ...v, von: t(v.von)! })) },
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
