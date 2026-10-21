// ─── Prozesse — Bestände lesen und schreiben, Prüf-Kontext, aufgelöster Katalog (Server, Etappe B1, 21.10.) ───────────────────────────────────────
// Zwei Bestände je Haushalt (der des Inhabers — dieselbe Grenze wie Fulfillment und Markttraktion), Bereich Business:
//   `prozesse--<h>`          Entwurf, Versionen, Status je Prozess (keine Daten Dritter; Personen nur als Team-Kennung bzw. Speichername)
//   `prozesse-webhook--<h>`  je Prozess Adresse + Fingerabdruck des Schlüssels; Eingänge der Webhooks (fremder Text, Frist „ereignisse“)
// Geschrieben NUR über `prozesseAendern`/`webhooksAendern`: EINE Sperre, alles oder nichts, unverändert = kein Schreiben, Änderungsprotokoll ohne Werte.
// Gelesen nur über `prozesseLesen`/`webhooksLesen` (Säuberer, schreibt nie; ohne Bestand leer — eine Instanz ohne Prozesse startet sauber).
// Register: lib/crm/speicher-register.ts (`prozesse--*`, `prozesse-webhook--*`).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliere, protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { prozesseBestand, webhookBestand, type KiKategorie, type ProzesseDatei, type ProzessEintrag, type WebhookDatei } from './definition';
import { prozesseAus, webhooksAus } from './bestand';
import { BAUSTEIN_KATALOG, GESELLSCHAFT_DES_FALLS, POSTFACH_WERTE, QUELLEN_IM_PROZESS, ROLLEN_WERTE, kategorienVonEintrag, klasseVonEintrag, type AuswahlQuelle, type KatalogEintrag } from './baustein-katalog';
import type { PruefKontext } from './definition-pruefen';
import type { TeamKurz } from './rollen';
import type { ModellOption } from './modell-wahl';

/** Der Haushalt der Prozesse (der des Inhabers; ohne gültigen: `inhaber` — wie Fulfillment). */
export async function prozesseHaushalt(): Promise<string> {
  const h = await haushaltDesInhabers();
  return h && HAUSHALT_OK.test(h) ? h : 'inhaber';
}

/** Stand eines Prozesses (für 409) — Fingerabdruck des ganzen Eintrags. Nie gespeichert. */
export const standVon = (e: ProzessEintrag): string => fingerabdruck(e as unknown as Record<string, unknown>);

export async function prozesseLesen(h?: string): Promise<ProzesseDatei> {
  return prozesseAus(await loadJson<unknown>(prozesseBestand(h ?? await prozesseHaushalt())));
}
export async function webhooksLesen(h?: string): Promise<WebhookDatei> {
  return webhooksAus(await loadJson<unknown>(webhookBestand(h ?? await prozesseHaushalt())));
}

type Mut<D, R> = (d: D) => ({ ok: true; datei: D } & R) | { ok: false };
/** Eine Änderung an `prozesse--<h>` in EINER Sperre — geschrieben nur bei `ok` und wenn sich etwas geändert hat; protokolliert ohne Werte. */
export async function prozesseAendern<R extends object>(mut: Mut<ProzesseDatei, R>, wer: Wer, h?: string): Promise<ReturnType<Mut<ProzesseDatei, R>>> {
  return aendern(prozesseBestand(h ?? await prozesseHaushalt()), prozesseAus, mut, wer);
}
export async function webhooksAendern<R extends object>(mut: Mut<WebhookDatei, R>, wer: Wer, h?: string): Promise<ReturnType<Mut<WebhookDatei, R>>> {
  return aendern(webhookBestand(h ?? await prozesseHaushalt()), webhooksAus, mut, wer);
}
async function aendern<D, R extends object>(name: string, aus: (roh: unknown) => D, mut: Mut<D, R>, wer: Wer): Promise<ReturnType<Mut<D, R>>> {
  let ergebnis = { ok: false } as ReturnType<Mut<D, R>>;
  let vorher: unknown = null;
  let geschrieben = false;
  const nachher = await updateJson<unknown>(name, cur => {
    const d = aus(cur);
    vorher = d;
    const r = mut(d);
    ergebnis = r;
    if (!r.ok || JSON.stringify(r.datei) === JSON.stringify(d)) return cur;
    geschrieben = true;
    return r.datei;
  });
  if (geschrieben) await protokolliereBestand(name, vorher, nachher, wer);
  return ergebnis;
}

// ── Prüf-Kontext (was nur der Server weiß) ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Team und Konten des Haushalts (Kennungen, aktiv, Speichername) — nie Namen in der Prüfung. */
async function teamUndKonten(h: string): Promise<{ team: TeamKurz[]; konten: string[] }> {
  const { teamVon, kontenDesHaushalts } = await import('@/lib/make-one/team-speicher');
  const [team, konten] = await Promise.all([teamVon(h).catch(() => []), kontenDesHaushalts(h).catch(() => [])]);
  return { team: team.map(t => ({ id: t.id, aktiv: t.aktiv, ...(t.speicher ? { speicher: t.speicher } : {}) })), konten: konten.map(k => k.speicher) };
}

/** Skills der Business-Heads (Haushalt): Head, Werkzeuge, aktiv. */
async function businessSkills(h: string): Promise<Map<string, { headId: string; werkzeuge: readonly string[]; aktiv: boolean; name: string }>> {
  const [{ werkstattLaden }, { skillsHaushaltBestand }, { headDef }] = await Promise.all([import('@/lib/agenten/skills-server'), import('@/lib/agenten/typen'), import('@/lib/agenten/katalog')]);
  const w = await werkstattLaden(skillsHaushaltBestand(h)).catch(() => null);
  return new Map((w?.skills ?? []).filter(s => headDef(s.headId)?.bereich === 'business').map(s => [s.id, { headId: s.headId, werkzeuge: s.werkzeuge, aktiv: s.aktiv, name: s.name }]));
}

/** Die angebundenen Modelle der Instanz (lib/prozesse/modell-wahl.ts) — Zustand der Zugänge und Modelle je Stufe aus den vorhandenen Stellen. */
export async function modellOptionenInstanz(kategorien: readonly KiKategorie[] = []): Promise<ModellOption[]> {
  const [{ modellOptionen }, { anbieterZustaende }, { stufenModelle }, { ladeKiEinstellungen }, { torModus }] = await Promise.all([
    import('./modell-wahl'), import('@/lib/ki/tor'), import('@/lib/ki/modelle'), import('@/lib/datenschutz/ki-einstellungen'), import('@/lib/ki/konfig'),
  ]);
  const [zustand, ein] = await Promise.all([anbieterZustaende().catch(() => ({})), ladeKiEinstellungen().catch(() => null)]);
  return modellOptionen({ zustand, stufen: stufenModelle(process.env, ein?.instanz?.modellStufen ?? null), kategorien, streng: torModus() === 'streng' });
}

/** Werte je Auswahlquelle (Kennung + Name) — für die Masken der Werkstatt und die Prüfung. Nur Business, nur was die Person sehen darf. */
export async function auswahlListen(h: string, person: string, datei?: ProzesseDatei): Promise<Partial<Record<AuswahlQuelle, { id: string; label: string }[]>>> {
  const sicher = async <T>(f: () => Promise<T>, leer: T): Promise<T> => { try { return await f(); } catch { return leer; } };
  const [{ teamVon, kontenDesHaushalts }, { KATALOG }, { STUFEN }, { PROZESS_EREIGNISSE, DATUMS_FELDER }, { EREIGNIS_NAME }, einheiten] = await Promise.all([
    import('@/lib/make-one/team-speicher'), import('@/lib/agenten/katalog'), import('@/lib/crm/pipeline'), import('./ausloeser'), import('@/lib/ereignisse/arten'), import('@/lib/einheiten'),
  ]);
  const d = datei ?? await sicher(() => prozesseLesen(h), { v: 1 as const, prozesse: [] });
  const skills = await sicher(() => businessSkills(h), new Map());
  const modelle = await sicher(() => modellOptionenInstanz(), [] as ModellOption[]);
  const werkzeuge = await sicher(async () => {
    const { vertraege } = await import('@/lib/werkzeuge/register');
    return Array.from(vertraege().values()).filter(v => v.herkunft === 'zoe' && v.bereich !== 'privat').map(v => ({ id: v.name, label: v.name }));
  }, [] as { id: string; label: string }[]);
  const postfaecher = await sicher(async () => {
    const { ladePostfaecher } = await import('@/lib/postfach/register');
    return (await ladePostfaecher(person)).filter(p => !!p.bereich && p.bereich !== 'privat' && einheiten.bereichVonGesellschaft(p.bereich) === 'business').map(p => ({ id: p.id, label: p.anzeigename }));
  }, [] as { id: string; label: string }[]);
  return {
    // Rollen statt Personen (22.10., Vorlagen der Kundengewinnung, R8): „Zuständig im Fall“ und „Eigner des Prozesses“ löst erst der Lauf auf.
    'team-person': [...(await sicher(() => teamVon(h), [])).filter(t => t.aktiv).map(t => ({ id: t.id, label: t.name })), ...ROLLEN_WERTE],
    'konto-person': (await sicher(() => kontenDesHaushalts(h), [])).map(k => ({ id: k.speicher, label: k.name })),
    'pipeline-stufe': STUFEN.map(s => ({ id: s.id, label: s.label })),
    postfach: [...postfaecher, ...POSTFACH_WERTE],
    head: KATALOG.filter(x => x.bereich === 'business').map(x => ({ id: x.id, label: x.name })),
    skill: Array.from(skills.entries()).filter(([, s]) => s.aktiv).map(([id, s]) => ({ id, label: s.name })),
    ereignis: PROZESS_EREIGNISSE.map(e => ({ id: e, label: EREIGNIS_NAME[e] })),
    prozess: d.prozesse.filter(p => p.versionen.length && p.status !== 'archiviert').map(p => ({ id: p.id, label: p.entwurf.titel })),
    gesellschaft: [...einheiten.BUSINESS_GESELLSCHAFTEN.map(g => ({ id: g, label: einheiten.finanzOrtName(g) })), { id: GESELLSCHAFT_DES_FALLS, label: 'Gesellschaft des Falls' }],
    // Erst mit eingerichteter Business-Nummer (lib/whatsapp/konfig.ts) — die Liste der genehmigten Vorlagen liefert die WhatsApp-Route.
    'whatsapp-vorlage': [],
    datumsfeld: DATUMS_FELDER.map(x => ({ id: x.id, label: x.titel })),
    'fall-feld': [{ id: 'fall.kontakt', label: 'Kontakt des Falls' }, { id: 'fall.ansprechpartner', label: 'Ansprechpartner der Firma' }, { id: 'fall.zustaendig', label: 'Zuständige Person' }],
    modell: modelle.filter(m => m.waehlbar).map(m => ({ id: m.schluessel, label: `${m.name} · ${m.anbieterName}` })),
    werkzeug: werkzeuge,
  };
}

/** Der Prüf-Kontext für einen Haushalt (alles nur lesend; Fehler einer Quelle → diese Prüfung nur nach Form). */
export async function pruefKontextFuer(h: string, person: string, datei?: ProzesseDatei): Promise<PruefKontext> {
  const d = datei ?? await prozesseLesen(h);
  const [{ team, konten }, skills, listen, vertraegeMod, vorschlag, kiw, zoeReg] = await Promise.all([
    teamUndKonten(h).catch(() => ({ team: undefined, konten: undefined })),
    businessSkills(h).catch(() => null),
    auswahlListen(h, person, d).catch(() => ({} as Partial<Record<AuswahlQuelle, { id: string; label: string }[]>>)),
    import('@/lib/werkzeuge/register').catch(() => null),
    import('@/lib/zoe/crm-vorschlag').then(m => m.VORSCHLAG_ARTEN as readonly string[]).catch(() => undefined),
    import('@/lib/datenschutz/ki-werkzeuge'),
    import('@/lib/zoe/register'),
  ]);
  const modelle = await modellOptionenInstanz().catch(() => null);
  const vertrag = (name: string) => { try { return vertraegeMod?.vertragVon(name) ?? null; } catch { return null; } };
  return {
    ...(team ? { team } : {}), ...(konten ? { konten } : {}),
    ...(skills ? { skill: (id: string) => skills.get(id) ?? null } : {}),
    werkzeugBereich: (name: string) => vertrag(name)?.bereich ?? null,
    werkzeugKategorie: (name: string) => kiw.kategorieVonWerkzeug(name, zoeReg.gruppeVon(name)),
    prozess: (id: string) => {
      const p = d.prozesse.find(x => x.id === id);
      if (!p) return null;
      const v = p.versionen.at(-1);
      return { titel: p.entwurf.titel, veroeffentlicht: !!v && p.status !== 'archiviert', ...(v?.definition.schnittstelle ? { schnittstelle: v.definition.schnittstelle } : {}) };
    },
    auswahl: (q: AuswahlQuelle) => (QUELLEN_IM_PROZESS.includes(q) || q === 'fall-feld' || q === 'whatsapp-vorlage' ? null : listen[q]?.map(x => x.id) ?? null),
    ...(vorschlag ? { vorschlagArten: vorschlag } : {}),
    ...(modelle ? { modelle } : {}),
  };
}

// ── Der Katalog, aufgelöst (Klasse und KI-Kategorien aus den Werkzeugen — nie doppelt gepflegt) ─────────────────────────────────────────────────────

export type KatalogAufgeloest = KatalogEintrag & { klasse: string | null; kategorien: KiKategorie[] };
export async function katalogAufgeloest(): Promise<KatalogAufgeloest[]> {
  const [kiw, zoeReg] = await Promise.all([import('@/lib/datenschutz/ki-werkzeuge'), import('@/lib/zoe/register')]);
  const kat = (name: string) => kiw.kategorieVonWerkzeug(name, zoeReg.gruppeVon(name));
  return BAUSTEIN_KATALOG.map(e => ({ ...e, klasse: klasseVonEintrag(e), kategorien: kategorienVonEintrag(e, kat) }));
}

// ── Konto löschen (lib/datenschutz/konto-daten.ts) ────────────────────────────────────────────────────────────────────────────────────────────────

/** Felder mit einem Speichernamen (Person des Haushalts) in den Prozess-Beständen. */
export const PROZESS_PERSONEN_FELDER: ReadonlySet<string> = new Set(['angelegtVon', 'entwurfVon', 'statusVon', 'geaendertVon', 'von', 'laeuftAls', 'erneuertVon', 'scharfVon']);
/** Speichername bzw. Team-Kennung `konto-<speicher>` einer gelöschten Kontoperson → „[gelöscht]“ (rein). Die Einträge bleiben (Geschäftsunterlagen). */
export function prozesseOhnePerson<T>(wert: T, speicher: string, ersatz = '[gelöscht]'): { wert: T; n: number } {
  let n = 0;
  const geh = (x: unknown): unknown => {
    if (Array.isArray(x)) { let anders = false; const l = x.map(y => { const z = geh(y); if (z !== y) anders = true; return z; }); return anders ? l : x; }
    if (!x || typeof x !== 'object') return x;
    let anders = false;
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if ((PROZESS_PERSONEN_FELDER.has(k) && v === speicher) || (k === 'eigner' && v === `konto-${speicher}`)) { o[k] = ersatz; n++; anders = true; continue; }
      const w = geh(v);
      if (w !== v) anders = true;
      o[k] = w;
    }
    return anders ? o : x;
  };
  const neu = geh(wert) as T;
  return { wert: n ? neu : wert, n };
}
export async function prozesseKontoLoeschen(h: string, speicher: string): Promise<number> {
  let summe = 0;
  for (const name of [prozesseBestand(h), webhookBestand(h)]) {
    if ((await loadJson<unknown>(name)) === null) continue;
    let n = 0;
    await updateJson<unknown>(name, cur => { const r = prozesseOhnePerson(cur, speicher); n = r.n; return r.wert; });
    if (n) await protokolliere(name, [{ op: 'geaendert', id: 'konto', felder: ['von'] }], { art: 'system' });
    summe += n;
  }
  return summe;
}
