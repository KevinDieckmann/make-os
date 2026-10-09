// ─── Agenten-Bereich: Threads — die EINE Schreibstelle (09.10., Paket 1 „Kern“) ─────────────────────────────────────────────
// Bestand `agenten-faeden--<person>` (lib/agenten/typen.ts `fadenBestand`): Threads und das Gedächtnis „Persönlich“ der Person.
// Regeln stehen rein in faeden.ts; hier nur Laden, Schreiben (eine Sperre je Änderung, Stand → 409, Grenzen → 413) und die Sicht
// des Kontos (`sichtLaden`, für die Filterstelle sicht.ts). Lesen schreibt nie: abgelaufene Threads (Löschfrist) fallen beim Lesen
// nur aus der Antwort und beim nächsten Schreiben aus dem Bestand.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { ladeKonten } from '@/lib/zugang/konten';
import { haushaltDesInhabers, personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { gesundheitStandFuer } from '@/lib/datenschutz/gesundheit-einwilligung';
import { fadenBestand, type AgentenAntwort, type AgentenEinstellung, type HeadDef, type HeadEinstellung, type HeadKarte, type Ueberblick, type UeberblickZeile } from './typen';
import { headDef, KATALOG } from './katalog';
import { einstellungFuer, mitarbeiterFuerHead, skillsFuerHead } from './skills-lesen';
import { kennzahlWerte } from './kontext';
import { WEG } from '@/lib/wege';
import { fadenStand, fehler, kurz, ohneAbgelaufene, type Fehler, type FadenBestandKern, type FadenKern, type NachrichtKern } from './faeden';
import { fadenSichtbar, headSichtbar, headsFuer, type KontoSicht } from './sicht';

const PERSON = /^[a-z0-9-]{1,40}$/;
const leer = (): FadenBestandKern => ({ v: 1, faeden: [] });

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

/** Der Bestand der Person (nur lesen — abgelaufene Threads fallen aus der Antwort, nicht aus der Datei). */
export async function bestandLesen(person: string, jetzt = new Date().toISOString()): Promise<FadenBestandKern> {
  if (!PERSON.test(person)) return leer();
  const b = await loadJson<FadenBestandKern>(fadenBestand(person));
  return ohneAbgelaufene({ ...leer(), ...(b ?? {}), faeden: Array.isArray(b?.faeden) ? b!.faeden : [] }, jetzt);
}

class Abbruch extends Error { constructor(readonly f: Fehler) { super(f.fehler); } }

/**
 * Eine Änderung am Bestand der Person — in EINER Sperre. `fn` liefert den neuen Bestand (und ein Ergebnis) oder einen Fehler;
 * bei Fehler wird nichts geschrieben. Abgelaufene Threads fallen dabei heraus (Löschfrist, faeden.ts).
 */
export async function bestandAendern<E>(person: string, fn: (b: FadenBestandKern) => { bestand: FadenBestandKern; e: E } | Fehler, jetzt = new Date().toISOString()): Promise<{ ok: true; e: E; bestand: FadenBestandKern } | Fehler> {
  if (!PERSON.test(person)) return fehler(400, 'Person ungültig.');
  let e: E | undefined;
  try {
    const neu = await updateJson<FadenBestandKern>(fadenBestand(person), cur => {
      const basis = ohneAbgelaufene({ ...leer(), ...(cur ?? {}), faeden: Array.isArray(cur?.faeden) ? cur!.faeden : [] }, jetzt);
      const r = fn(basis);
      if ('ok' in r && r.ok === false) throw new Abbruch(r);
      const ok = r as { bestand: FadenBestandKern; e: E };
      e = ok.e;
      return ok.bestand;
    });
    return { ok: true, e: e as E, bestand: neu };
  } catch (x) {
    if (x instanceof Abbruch) return x.f;
    throw x;
  }
}

/**
 * EIN Thread der Person ändern — mit Stand (`stand` gesetzt und veraltet → 409 mit dem aktuellen Thread). `fn` sieht den Thread
 * und liefert den neuen oder einen Fehler.
 */
export async function fadenAendern(person: string, id: string, fn: (f: FadenKern) => FadenKern | Fehler, o: { stand?: string; jetzt?: string } = {}): Promise<{ ok: true; faden: FadenKern; stand: string } | (Fehler & { aktuell?: FadenKern })> {
  let aktuell: FadenKern | undefined;
  const r = await bestandAendern<FadenKern>(person, b => {
    const f = b.faeden.find(x => x.id === id);
    if (!f) return fehler(404, 'Diesen Thread gibt es nicht (mehr).');
    if (o.stand !== undefined && o.stand !== fadenStand(f)) { aktuell = f; return fehler(409, 'Der Thread hat sich inzwischen geändert — bitte neu laden.'); }
    const neu = fn(f);
    if ('ok' in neu && neu.ok === false) return neu;
    const g = neu as FadenKern;
    return { bestand: { ...b, faeden: b.faeden.map(x => (x.id === id ? g : x)) }, e: g };
  }, o.jetzt);
  if (!r.ok) return aktuell ? { ...r, aktuell } : r;
  return { ok: true, faden: r.e, stand: fadenStand(r.e) };
}

/** Ein eigener Thread (oder null). */
export async function eigenerFaden(person: string, id: string): Promise<FadenKern | null> {
  return (await bestandLesen(person)).faeden.find(f => f.id === id) ?? null;
}

/** Speichernamen im Haushalt des Inhabers (für geteilte Business-Threads). */
async function haushaltsPersonen(): Promise<string[]> {
  const [{ konten }, h] = await Promise.all([ladeKonten(), haushaltDesInhabers()]);
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  return konten.filter(k => k.speicher === inhaber?.speicher || (!!h && k.haushalt === h)).map(k => k.speicher).filter(p => PERSON.test(p));
}

/** Alle Threads, die die Sicht sehen darf: eigene (Head sichtbar) + geteilte Business-Threads anderer im Haushalt. */
export async function sichtbareFaeden(s: KontoSicht): Promise<FadenKern[]> {
  if (!s.imHaushalt) return [];
  const eigene = (await bestandLesen(s.person)).faeden.filter(f => fadenSichtbar(f, s));
  const andere = (await haushaltsPersonen()).filter(p => p !== s.person);
  const geteilt: FadenKern[] = [];
  for (const p of andere) {
    const b = await bestandLesen(p).catch(() => leer());
    for (const f of b.faeden) if (f.geteilt && fadenSichtbar(f, s)) geteilt.push(f);
  }
  return [...eigene, ...geteilt];
}

/** Ein Thread, den die Sicht sehen darf (eigen oder geteilt) — oder null. */
export async function sichtbarerFaden(s: KontoSicht, id: string): Promise<FadenKern | null> {
  return (await sichtbareFaeden(s)).find(f => f.id === id) ?? null;
}

// ── GET /api/agenten: Heads und Überblick der Person (Antwort 1) ───────────────────────────────────────────────────────────

const ZEILEN_MAX = 20;

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
  const [einstellung, faeden, { lies, vorschlagSichtbar }] = await Promise.all([einstellungFuer(u.haushalt, person), sichtbareFaeden(sicht), import('@/lib/zoe/stapel')]);
  // Paket 4b: Einstellungen, Kosten und Rechte je Head, Instanz-Budget (lib/agenten/einstellung.ts, lib/ki/tor.ts).
  const zusatz = await einstellungZusatz(person, sicht, u.haushalt, einstellung, faeden.filter(f => f.besitzer === person)).catch(e => { console.error('[agenten] Einstellungen nicht lesbar:', e instanceof Error ? e.message.slice(0, 120) : e); return null; });
  const offen = (await lies('offen')).filter(v => vorschlagSichtbar(v, person, true));
  const plaeneOffen = (headId?: string) => faeden.filter(f => f.besitzer === person && (!headId || (f.agent.art !== 'zoe' && f.agent.headId === headId))).reduce((n, f) => n + (f.plaene ?? []).filter(p => p.status === 'offen').length, 0);
  let businessFrei = false;
  try { const { businessFreiJetzt } = await import('@/lib/arbeitsrahmen/server'); businessFrei = (await businessFreiJetzt(person)).frei; } catch { /* offen statt blockiert */ }
  const neueste = (l: FadenKern[]) => [...l].sort((a, b) => b.aktualisiert.localeCompare(a.aktualisiert));
  const laufend = (f: FadenKern) => !!f.lauf && (f.lauf.status === 'wartet' || f.lauf.status === 'laeuft');

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
      zaehler: { freigaben: offen.filter(v => (v.anlass ?? '').startsWith(d.name)).length + plaeneOffen(d.id), laufend: eigene.filter(laufend).length, faeden: eigene.length },
      letzteFaeden: neueste(eigene).slice(0, 5).map(f => kurz(f, person)),
      ...(foto ? { foto } : {}),
      ...(einstellungSicht ? { einstellung: einstellungSicht } : {}),
    });
  }

  const name = (f: FadenKern) => (f.agent.art === 'zoe' ? 'ZOE' : headDef(f.agent.headId)?.kurz ?? f.agent.headId);
  const link = (f: FadenKern) => WEG.agenten({ ...(f.agent.art !== 'zoe' ? { h: f.agent.headId } : {}), f: f.id });
  const passiert: UeberblickZeile[] = [];
  for (const f of faeden) for (const n of f.nachrichten) {
    if (n.zeit <= seit) continue;
    if (n.verweis?.art === 'bericht') passiert.push({ id: n.id, text: `${name(f)}: Bericht aus Thread „${n.verweis.titel ?? ''}“`, zeit: n.zeit, ...(f.agent.art !== 'zoe' ? { headId: f.agent.headId } : {}), link: link(f) });
    else if (n.rolle === 'agent' && (n as NachrichtKern).lauf?.operation === 'invoke_agent' && f.agent.art === 'head') passiert.push({ id: n.id, text: `${name(f)}: Lauf in „${f.titel}“ ${f.lauf?.status === 'fertig' ? 'fertig' : 'beendet'}`, zeit: n.zeit, headId: f.agent.headId, link: link(f) });
  }
  passiert.sort((a, b) => String(b.zeit).localeCompare(String(a.zeit)));
  const inArbeit: UeberblickZeile[] = neueste(faeden.filter(laufend)).map(f => ({ id: f.id, text: `${name(f)}: „${f.titel}“ ${f.lauf?.status === 'laeuft' ? 'läuft' : 'wartet'}`, zeit: f.aktualisiert, ...(f.agent.art !== 'zoe' ? { headId: f.agent.headId } : {}), link: link(f) }));
  const anzahl = offen.length + plaeneOffen();

  const ziele: Ueberblick['ziele'] = [];
  try {
    const { loadJson } = await import('@/lib/store/local-db');
    const { zielJahr } = await import('@/lib/planung/zeitstrahl');
    const { wirksamerSpace } = await import('@/lib/planung/bereich');
    const laufendesJahr = new Date().getFullYear();
    const d = await loadJson<import('@/lib/planung/typen').ZieleDatei>('ziele');
    for (const z of d?.jahr ?? []) {
      if (z.erledigt || zielJahr(z, laufendesJahr) !== laufendesJahr) continue;
      const sp = wirksamerSpace(z);
      if (sp === 'privat' && !sicht.vollesMitglied) continue;
      ziele.push({ id: z.id, titel: z.titel, fortschritt: typeof z.fortschritt === 'number' ? z.fortschritt : null, link: WEG.ziel(z.id) });
    }
  } catch { /* ohne Ziele */ }

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
  };
}

/**
 * Paket 4b: was GET /api/agenten zu den Einstellungen mitbringt — je Head die wirksamen Werte, Kosten des Monats, Rechte und Stand; ein
 * Foto nur, wenn die Person das Bild sieht; das Instanz-Budget; wählbare zuständige Personen. Privat-Heads: nur der eigene Abschnitt
 * (`einstellung` kommt schon mit `mitPerson`).
 */
async function einstellungZusatz(person: string, sicht: KontoSicht, haushalt: string | null, einstellung: AgentenEinstellung, eigeneFaeden: readonly FadenKern[]) {
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
  for (const h of KATALOG.filter(x => x.ebene === 'person' && headSichtbar(sicht, x.id))) kostenPrivat.set(h.id, leistung.fadenZahlen(eigeneFaeden, h.id, von, bis).kostenEuroCent);
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
