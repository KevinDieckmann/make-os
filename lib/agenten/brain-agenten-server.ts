// ─── Agenten-Bereich: „Aus dem Brain übernehmen“ — der Server-Teil (09.10.) ──────────────────────────────────────────────────────────
// Liest den Agenten-Ordner des Vaults (Einstellung im Business-Bestand `agenten-wissen--<haushalt>` › `brainAgenten`, sonst der Ordner mit
// `_Agenten_Index`) in der AGENTEN-Sicht (nie `privat`), plant mit den reinen Regeln (lib/agenten/brain-agenten.ts) — NUR für Business-Heads
// (Kevin 09.10.: „Firma und Privat liegen getrennt — auch in der Datenhaltung“) — und schreibt NUR über die vorhandenen Wege:
//   • Einstellungen je Head über `einstellungAendern` (Rechte, Stand → 409, Prüfung, Protokoll) — Auftrag mit `auftragQuelle` (gekapselt im
//     System-Text), Modellstufe, eingeschaltete Mitarbeiter; je Head EIN Aufruf mit dem Stand aus der Vorschau;
//   • Wissen je Business-Head über `wissenAendern` (Business-Bestand, eigener Stand → 409);
//   • eigene Mitarbeiter über `mitarbeiterAnlegen` (Werkstatt) — aus einer Notiz mit `ausFremdemText` (ihre Anleitung ist Text aus dem Vault),
//     als früherer Fach-Agent mit dessen Kürzel (Name/Rolle aus der Software, nicht aus dem Vault).
// Die INHALTE liest der Server beim Übernehmen neu aus dem Vault — der Browser schickt nur die Auswahl (welche Datei, welche Teile, welcher Head),
// nie Text. Wer: nur ein Inhaber (die Route prüft), Dienstweg nie. Nichts wird ausgeführt, nichts geht nach außen.

import { KATALOG, headDef } from './katalog';
import {
  agentDateiLesen, indexLesen, planBauen, vorauswahl, wahlPruefen, type AgentDatei, type BrainSicht, type FachAgentInfo, type PlanEintrag,
  type UebernahmeWahl, type ZielArt,
} from './brain-agenten';
import { pfadSaeubern } from './wissen';
import { type AgentenEinstellung, type HeadEinstellung, type Mitarbeiter, type WissenBestand } from './typen';

type Fehler = { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };
const fehler = (status: Fehler['status'], text: string): Fehler => ({ ok: false, status, fehler: text });

/** Index-Notiz eines Agenten-Ordners: beginnt mit „_“ und nennt „index“ (z. B. `_Agenten_Index`). */
const istIndex = (titel: string): boolean => /^_/.test(titel) && /index/i.test(titel);

export interface BrainVorschau {
  ok: true;
  /** Der gelesene Agenten-Ordner (relativ zum Brain) und woher er kommt. */
  ordner: { pfad: string | null; quelle: 'anfrage' | 'einstellung' | 'index' | null };
  index: string | null;
  /** Ordner des Brains (Agenten-Sicht) — für die Wähler (Agenten-Ordner, Wissen). */
  ordnerListe: { pfad: string; notizen: number }[];
  /** Heads, die die Person sieht — mögliche Ziele. */
  heads: { id: string; name: string; kurz: string; bereich: 'business' | 'privat' }[];
  eintraege: PlanEintrag[];
  vorauswahl: UebernahmeWahl[];
  hinweis?: string;
}

interface Lage {
  person: string;
  haushalt: string | null;
  sichtbar: Set<string>;
  einst: AgentenEinstellung;
  wissen: WissenBestand;
  agentenOrdner: { pfad: string | null; quelle: BrainVorschau['ordner']['quelle'] };
  ordnerListe: { pfad: string; notizen: number }[];
  dateien: AgentDatei[];
  index: Map<string, string>;
  indexPfad: string | null;
  brain: BrainSicht;
  mitarbeiter: Map<string, Mitarbeiter[]>;
  fach: FachAgentInfo[];
}

/** Frühere Fach-Agenten der Software mit den Regeln des Servers (ausführbar, unter Business erlaubt). */
async function fachAgenten(): Promise<FachAgentInfo[]> {
  const [{ ALL_AGENTS }, { AUSFUEHRBAR, SYSTEM_LAEUFE }, { FACH_AGENTEN_BUSINESS }] = await Promise.all([import('@/lib/make-one/agents-data'), import('@/lib/zoe/agenten'), import('./werkzeuge')]);
  const aus = new Set<string>(AUSFUEHRBAR as readonly string[]);
  const system = new Set<string>(SYSTEM_LAEUFE as readonly string[]);
  return ALL_AGENTS.map(a => ({
    id: a.id, name: a.name, rolle: a.role, stufe: a.model, geplant: a.status === 'geplant',
    ausfuehrbar: aus.has(a.id) && !system.has(a.id) && !/^head-/.test(a.id) && a.id !== 'finanzchef',
    business: FACH_AGENTEN_BUSINESS.has(a.id),
  }));
}

/** Alles lesen, was Vorschau und Übernahme brauchen (Agenten-Sicht des Brains, Einstellungen, Mitarbeiter je sichtbarem Head). */
async function lageLesen(person: string, ordnerAnfrage?: string | null): Promise<Lage | Fehler> {
  const [{ umfangFuer }, { sichtLaden }, { headsFuer }, { einstellungFuer, mitarbeiterFuerHead }, vault, { wissenLesen }] = await Promise.all([
    import('./skills-server'), import('./faeden-server'), import('./sicht'), import('./skills-lesen'), import('@/lib/zoe/vault'), import('./wissen-server'),
  ]);
  const umfang = await umfangFuer(person);
  const sicht = await sichtLaden(person);
  // Nur Business-Heads sind Ziele (Firma und Privat getrennt).
  const heads = headsFuer(sicht).filter(h => h.bereich === 'business');
  const agentSicht = { person, agent: true };
  const [notizen, ordnerListe, einst, wissen] = await Promise.all([
    vault.brainNotizen(agentSicht), vault.brainOrdner(agentSicht), einstellungFuer(umfang.haushalt, person), wissenLesen(umfang.haushalt),
  ]);
  const roh = wissen;
  const gibt = (p: string) => ordnerListe.some(o => o.pfad === p);
  // Der Agenten-Ordner: aus der Anfrage (Wähler) → aus der Einstellung der Instanz → der Ordner mit `_…Index`.
  let agentenOrdner: Lage['agentenOrdner'] = { pfad: null, quelle: null };
  if (ordnerAnfrage) {
    const p = pfadSaeubern(ordnerAnfrage);
    if (!p.ok) return fehler(p.status === 413 ? 413 : 400, p.fehler);
    if (!gibt(p.pfad)) return fehler(404, `Den Ordner „${p.pfad}“ gibt es im Brain nicht (oder er ist privat).`);
    agentenOrdner = { pfad: p.pfad, quelle: 'anfrage' };
  } else if (roh?.brainAgenten?.ordner && gibt(roh.brainAgenten.ordner)) {
    agentenOrdner = { pfad: roh.brainAgenten.ordner, quelle: 'einstellung' };
  } else {
    const idx = notizen.filter(n => istIndex(n.titel) && /agent/i.test(n.titel)).sort((a, b) => a.pfad.length - b.pfad.length)[0];
    if (idx) agentenOrdner = { pfad: idx.ordner, quelle: 'index' };
  }
  const imOrdner = agentenOrdner.pfad === null ? [] : notizen.filter(n => n.ordner === agentenOrdner.pfad);
  const indexNotiz = imOrdner.find(n => istIndex(n.titel)) ?? null;
  const kandidaten = imOrdner.filter(n => !n.titel.startsWith('_') && !['index', 'vorlage', 'protokoll'].includes((n.typ ?? '').toLowerCase()));
  const dateien: AgentDatei[] = [];
  for (const n of kandidaten.sort((a, b) => a.pfad.localeCompare(b.pfad, 'de'))) {
    const r = await vault.notizRoh(n.id, agentSicht);
    if (r.ok) dateien.push(agentDateiLesen({ pfad: r.pfad, felder: r.felder, rumpf: r.rumpf }));
  }
  let index = new Map<string, string>();
  if (indexNotiz) { const r = await vault.notizRoh(indexNotiz.id, agentSicht); if (r.ok) index = indexLesen(r.rumpf); }
  const mitarbeiter = new Map<string, Mitarbeiter[]>();
  for (const h of heads) mitarbeiter.set(h.id, await mitarbeiterFuerHead(h.id, umfang).catch(() => []));
  return {
    person, haushalt: umfang.haushalt, sichtbar: new Set(heads.map(h => h.id)), einst, wissen, agentenOrdner, ordnerListe, dateien, index,
    indexPfad: indexNotiz?.pfad ?? null, brain: { notizen: notizen.map(n => ({ pfad: n.pfad, titel: n.titel, ordner: n.ordner })), ordner: ordnerListe },
    mitarbeiter, fach: await fachAgenten(),
  };
}

async function planVon(l: Lage, wahl?: Record<string, { headId: string | null; als?: ZielArt }>): Promise<PlanEintrag[]> {
  const [{ headEinstellungVon, einstellungStand }, { nurWissen, wissenStand }] = await Promise.all([import('./einstellung'), import('./wissen-server')]);
  const ein = (id: string): HeadEinstellung => { const h = headDef(id); return h ? headEinstellungVon(l.einst, h, l.person) : {}; };
  return planBauen({
    dateien: l.dateien, index: l.index, sichtbar: l.sichtbar, einstellung: ein, stand: id => einstellungStand(ein(id)),
    wissen: id => nurWissen(l.wissen.heads[id]), wissenStand: id => wissenStand(nurWissen(l.wissen.heads[id])),
    mitarbeiter: id => l.mitarbeiter.get(id) ?? [], fachAgenten: l.fach, brain: l.brain, ...(wahl ? { wahl } : {}),
  });
}

/** Die Ordner des Brains in der Agenten-Sicht (nie `privat`) — für Wähler. */
export async function brainOrdnerListe(person: string): Promise<{ pfad: string; notizen: number }[]> {
  return (await import('@/lib/zoe/vault')).brainOrdner({ person, agent: true });
}

/** Ziele aus der Vorschau prüfen: { [datei]: { headId: string | null, als? } } — nur Form (der Plan prüft Sichtbarkeit und Bereich). Rein. */
export function zieleAus(v: unknown): { ok: true; ziele: Record<string, { headId: string | null; als?: ZielArt }> } | Fehler {
  if (v === undefined || v === null) return { ok: true, ziele: {} };
  if (typeof v !== 'object' || Array.isArray(v)) return fehler(400, 'Ziele als Objekt je Datei.');
  const e = Object.entries(v as Record<string, unknown>);
  if (e.length > 60) return fehler(413, 'Höchstens 60 Dateien je Vorschau.');
  const raus: Record<string, { headId: string | null; als?: ZielArt }> = {};
  for (const [datei, z] of e) {
    const o = (z && typeof z === 'object' ? z : {}) as Record<string, unknown>;
    if (datei.length > 300 || (o.headId !== null && (typeof o.headId !== 'string' || !headDef(o.headId))) || (o.als !== undefined && o.als !== 'head' && o.als !== 'mitarbeiter')) return fehler(400, 'Ziel: ein Head des Katalogs (oder null) und als „head“ bzw. „mitarbeiter“.');
    raus[datei] = { headId: o.headId as string | null, ...(o.als ? { als: o.als as ZielArt } : {}) };
  }
  return { ok: true, ziele: raus };
}

/** Vorschau (schreibt nichts). `ordner` = ein anderer Agenten-Ordner aus dem Wähler, `ziele` = in der Vorschau gewählte Heads. */
export async function brainVorschau(person: string, ordner?: string | null, zieleRoh?: unknown): Promise<BrainVorschau | Fehler> {
  const z = zieleAus(zieleRoh);
  if (!z.ok) return z;
  const l = await lageLesen(person, ordner);
  if ('ok' in l) return l;
  const eintraege = await planVon(l, Object.keys(z.ziele).length ? z.ziele : undefined);
  return {
    ok: true, ordner: l.agentenOrdner, index: l.indexPfad, ordnerListe: l.ordnerListe,
    heads: KATALOG.filter(h => l.sichtbar.has(h.id)).map(h => ({ id: h.id, name: h.name, kurz: h.kurz, bereich: h.bereich })),
    eintraege, vorauswahl: eintraege.filter(e => e.ziel).map(vorauswahl),
    ...(l.agentenOrdner.pfad === null ? { hinweis: 'Kein Ordner mit Agenten-Notizen gefunden (eine Notiz „_Agenten_Index“ zeigt ihn an) — bitte einen Ordner wählen.' } : !l.dateien.length ? { hinweis: 'In diesem Ordner liegen keine Agenten-Notizen, die Agenten sehen dürfen.' } : {}),
  };
}

export interface UebernahmeErgebnis { datei: string; teil: string; ok: boolean; text: string }

/**
 * Übernehmen: der Plan wird mit der Auswahl NEU aus dem Vault gerechnet; geschrieben werden nur ausgewählte Teile, deren Aktion etwas tut.
 * `staende` = Stand je Head aus der Vorschau (409, wenn sich die Einstellung seitdem geändert hat — dann bleibt dieser Head ganz unberührt).
 */
export async function brainUebernehmen(person: string, body: { ordner?: unknown; auswahl?: unknown; staende?: unknown; wissenStaende?: unknown }): Promise<{ ok: true; ergebnisse: UebernahmeErgebnis[] } | Fehler> {
  const w = wahlPruefen(body.auswahl);
  if (!w.ok) return fehler(w.status, w.fehler);
  if (!w.wahl.length) return fehler(400, 'Nichts ausgewählt.');
  const objekt = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
  const staende = objekt(body.staende);
  const wissenStaende = objekt(body.wissenStaende);
  const l = await lageLesen(person, typeof body.ordner === 'string' && body.ordner ? body.ordner : null);
  if ('ok' in l) return l;
  const wahlJe = new Map(w.wahl.map(x => [x.datei, x]));
  const ziele: Record<string, { headId: string | null; als?: ZielArt }> = {};
  for (const x of w.wahl) if (x.headId !== undefined || x.als) ziele[x.datei] = { headId: x.headId === undefined ? null : x.headId, ...(x.als ? { als: x.als } : {}) };
  // Fehlt `headId` in der Auswahl, gilt der Vorschlag — nur ein ausdrückliches `als` ohne Head übernimmt den vorgeschlagenen Head.
  const ohneHead = w.wahl.filter(x => x.headId === undefined && x.als);
  const vorschlag = ohneHead.length ? await planVon(l) : [];
  for (const x of ohneHead) ziele[x.datei] = { headId: vorschlag.find(e => e.datei === x.datei)?.ziel?.headId ?? null, als: x.als };
  const plan = await planVon(l, ziele);
  const { einstellungAendern, headEinstellungVon } = await import('./einstellung');
  const { mitarbeiterAnlegen } = await import('./skills-server');
  const { wissenAendern, nurWissen } = await import('./wissen-server');
  const ergebnisse: UebernahmeErgebnis[] = [];

  // Je Head die Teile sammeln (EIN Aufruf mit dem Stand aus der Vorschau).
  const jeHead = new Map<string, { teil: Record<string, unknown>; quelle?: { datei: string }; teile: { datei: string; teil: string }[]; wissen?: string[]; wissenTeile: { datei: string; teil: string }[] }>();
  const sammeln = (headId: string) => { if (!jeHead.has(headId)) jeHead.set(headId, { teil: {}, teile: [], wissenTeile: [] }); return jeHead.get(headId)!; };
  const anlegen: { headId: string; datei: string; kuerzel: string; neu: NonNullable<PlanEintrag['mitarbeiter'][number]['neu']>; ausVault: boolean }[] = [];
  const etwas = (x: UebernahmeWahl) => x.auftrag || x.stufe || !!x.mitarbeiter?.length || !!x.wissen?.length;
  for (const x of w.wahl) {
    const e = plan.find(p => p.datei === x.datei);
    if (!e) ergebnisse.push({ datei: x.datei, teil: 'Notiz', ok: false, text: 'Liegt nicht (mehr) im Agenten-Ordner bzw. ist nicht sichtbar — Vorschau neu laden.' });
    else if (!e.ziel && etwas(x)) ergebnisse.push({ datei: x.datei, teil: 'Ziel', ok: false, text: e.zielGrund });
  }
  for (const e of plan) {
    const x = wahlJe.get(e.datei);
    if (!x || !e.ziel) continue;
    const head = headDef(e.ziel.headId)!;
    if (e.ziel.als === 'mitarbeiter') {
      const m = e.mitarbeiter[0];
      if (m?.aktion === 'anlegen' && m.neu && (x.mitarbeiter ?? []).includes(m.kuerzel)) anlegen.push({ headId: head.id, datei: e.datei, kuerzel: m.kuerzel, neu: m.neu, ausVault: true });
      continue;
    }
    const s = sammeln(head.id);
    const eh = headEinstellungVon(l.einst, head, person);
    if (x.auftrag && e.auftrag && (e.auftrag.aktion === 'neu' || e.auftrag.aktion === 'aktualisieren' || (e.auftrag.aktion === 'eigener' && x.ersetzen))) {
      s.teil.auftrag = e.auftrag.text; s.quelle = { datei: e.datei }; s.teile.push({ datei: e.datei, teil: 'Auftrag' });
    }
    if (x.stufe && e.stufe) { s.teil.stufe = e.stufe.datei; s.teile.push({ datei: e.datei, teil: 'Modellstufe' }); }
    const neuesWissen = e.wissen.filter(w2 => w2.aktion === 'neu' && (x.wissen ?? []).includes(w2.pfad)).map(w2 => w2.pfad);
    if (neuesWissen.length) {
      s.wissen = Array.from(new Set([...(s.wissen ?? []), ...neuesWissen]));
      s.wissenTeile.push({ datei: e.datei, teil: `Wissen (${neuesWissen.length})` });
    }
    const ein = e.mitarbeiter.filter(m => m.aktion === 'einschalten' && m.mitarbeiterId && (x.mitarbeiter ?? []).includes(m.kuerzel)).map(m => m.mitarbeiterId!);
    if (ein.length) {
      const bisher = (s.teil.mitarbeiterAus as string[] | null | undefined) ?? eh.mitarbeiterAus ?? [];
      const rest = bisher.filter(id => !ein.includes(id));
      s.teil.mitarbeiterAus = rest.length ? rest : null;
      s.teile.push({ datei: e.datei, teil: `${ein.length} Mitarbeiter eingeschaltet` });
    }
    for (const m of e.mitarbeiter) if (m.aktion === 'anlegen' && m.neu && (x.mitarbeiter ?? []).includes(m.kuerzel)) anlegen.push({ headId: head.id, datei: e.datei, kuerzel: m.kuerzel, neu: m.neu, ausVault: false });
  }

  const gesperrt = new Set<string>();
  for (const [headId, s] of Array.from(jeHead.entries())) {
    const head = headDef(headId)!;
    if (Object.keys(s.teil).length) {
      const stand = typeof staende[headId] === 'string' ? staende[headId] : plan.find(e => e.ziel?.headId === headId)?.stand;
      const r = await einstellungAendern(person, headId, s.teil, stand, s.quelle ? { auftragQuelle: s.quelle } : {});
      if (!r.ok) gesperrt.add(headId);
      for (const t of s.teile) ergebnisse.push({ datei: t.datei, teil: `${head.kurz}: ${t.teil}`, ok: r.ok, text: r.ok ? 'übernommen' : r.status === 409 ? 'Inzwischen geändert — Vorschau neu laden.' : r.fehler });
    }
    if (s.wissen?.length) {
      // Wissen: eigener Business-Bestand mit eigenem Stand (aus der Vorschau) — bisherige Pfade bleiben, neue kommen dazu.
      const bisher = nurWissen(l.wissen.heads[headId]);
      const stand = typeof wissenStaende[headId] === 'string' ? wissenStaende[headId] : plan.find(e => e.ziel?.headId === headId)?.wissenStand;
      const r = await wissenAendern(person, headId, { pfade: Array.from(new Set([...(bisher?.pfade ?? []), ...s.wissen])), modus: bisher?.modus ?? 'bevorzugt' }, stand);
      for (const t of s.wissenTeile) ergebnisse.push({ datei: t.datei, teil: `${head.kurz}: ${t.teil}`, ok: r.ok, text: r.ok ? 'übernommen' : r.status === 409 ? 'Inzwischen geändert — Vorschau neu laden.' : r.fehler });
    }
  }
  for (const a of anlegen) {
    const head = headDef(a.headId)!;
    if (gesperrt.has(a.headId)) { ergebnisse.push({ datei: a.datei, teil: `${head.kurz}: Mitarbeiter „${a.neu.name}“`, ok: false, text: 'Nicht angelegt — die Einstellungen dieses Heads haben sich geändert; Vorschau neu laden.' }); continue; }
    const r = await mitarbeiterAnlegen(person, a.headId, { name: a.neu.name, rolle: a.neu.rolle, werkzeuge: [], stufe: a.neu.stufe, ...(a.neu.anleitung ? { anleitung: a.neu.anleitung } : {}) }, 'hand', {
      ...(a.ausVault ? { ausFremdemText: true } : {}), ...(a.neu.agentId ? { agentId: a.neu.agentId } : {}),
      herkunft: { art: 'brain', datei: a.datei, ...(a.ausVault ? {} : { kuerzel: a.kuerzel }) },
    });
    ergebnisse.push({ datei: a.datei, teil: `${head.kurz}: Mitarbeiter „${a.neu.name}“`, ok: r.ok, text: r.ok ? 'angelegt' : (r as { fehler: string }).fehler });
  }
  return { ok: true, ergebnisse };
}

/** Den Agenten-Ordner des (Firmen-)Brains festhalten (`null` = wieder automatisch über `_Agenten_Index`). Nur ein Inhaber (die Route prüft). */
export async function brainOrdnerSetzen(person: string, ordner: unknown): Promise<{ ok: true; ordner: string | null } | Fehler> {
  const [{ umfangFuer }, vault, { agentenOrdnerSetzen }] = await Promise.all([import('./skills-server'), import('@/lib/zoe/vault'), import('./wissen-server')]);
  const { haushalt } = await umfangFuer(person);
  if (!haushalt) return fehler(409, 'Ohne Haushalt gibt es keine Agenten-Einstellungen.');
  let pfad: string | null = null;
  if (ordner !== null && ordner !== undefined && ordner !== '') {
    const p = pfadSaeubern(ordner);
    if (!p.ok) return fehler(p.status === 413 ? 413 : 400, p.fehler);
    if (!(await vault.brainOrdner({ person, agent: true })).some(o => o.pfad === p.pfad)) return fehler(404, `Den Ordner „${p.pfad}“ gibt es im Brain nicht (oder er ist privat).`);
    pfad = p.pfad;
  }
  await agentenOrdnerSetzen(person, haushalt, pfad);
  return { ok: true, ordner: pfad };
}
