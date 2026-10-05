// ─── MAKE OS — Brain-Kugel: alle Datensätze serverseitig sammeln (05.10.2026) ─
// EINE Stelle, die liest (nie schreibt, nie ein Netzaufruf): je Bestand die vorhandene Lesefunktion MIT ihrer Sicht-Regel,
// dann markiert je Punkt `privat` (Privat-Space) und `gehoert` (eine Person allein). Entschieden wird in der reinen
// Filterstelle `kugelPunkteFuer` (lib/brain/kugel.ts). Jede Quelle ist mit `sicher()` gekapselt — fehlt eine, fehlt sie.
//   Kontakte   `kontakteFuerVerarbeitung` (Art.-18-Eingeschränkte fehlen), ohne Archiv; nur Name — nie Notizen/Adressen
//   Firmen · Deals · Mandate   `ladeCrm` (Papierkorb ist dort schon weg), ohne Archiv
//   Aufgaben   `ladeAufgabenSicht(person)` (fremde „nur ich“ samt Kette, Papierkorb weg) + `nurIchBesitzer`
//   Ziele      `haushaltsZiele` (eigene Ziele tragen ihre Person) · Meilensteine (fremde eigene Ziele → deren Person)
//   Termine    `termineFuerZoe(person)` — maskierte (fremde private) und Gesundheitstermine fallen weg, M365-Spiegel ohne Link
//              ebenso (kein Punkt ins Leere)
//   Notizen    Vault `bestand()` + `darfSehen` (private nur für die Eigentümerin) — nur Titel, nie Text
//   Gesellschaften  Register des Haushalts (`ladeRegister`)
// Gesundheit wird NIE ein Punkt (Art. 9): keine Gesundheitstermine, keine Gesundheits-Meilensteine/-Ziele, keine Notizen
// mit Gesundheitsbezug im Pfad/Titel/Stichwort. Keine Personendaten in Logs.

import { loadJson } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import type { Meilenstein } from '@/lib/planung/typen';
import { spaceVonAufgabe } from '@/lib/make-one/space-regeln';
import { punktId, kugelPunkteFuer, type Betrachter, type KugelAntwort, type RohPunkt } from './kugel';

const sicher = async <T>(f: () => Promise<T>, sonst: T): Promise<T> => { try { return await f(); } catch { return sonst; } };
const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const mit = (...l: (string | null | undefined | false)[]) => l.filter((x): x is string => !!x);
/** Gesundheitsbezug an einer Notiz (Pfad, Titel, Stichworte) — solche Notizen werden nie Punkte. */
const GESUNDHEIT = /gesundheit|health|arzt|ärzt|diagnose|therapie|medizin|reha|krank|befund/i;
/** Fenster der Termine: drei Monate zurück und voraus (wie der Überblick). */
const TERMINE_TAGE = 92;

async function crm(): Promise<RohPunkt[]> {
  const [{ ladeCrm }, { kontakteFuerVerarbeitung }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/verarbeitung')]);
  const [c, kontakte] = await Promise.all([ladeCrm(), sicher(() => kontakteFuerVerarbeitung(), [])]);
  const aus: RohPunkt[] = [];
  for (const k of kontakte) {
    if ((k as { archiviertAm?: string }).archiviertAm || (k as { geloeschtAm?: string }).geloeschtAm) continue;
    aus.push({ art: 'kontakt', kennung: k.id, titel: [k.vorname, k.nachname].filter(Boolean).join(' '), datum: k.geaendertAm ?? k.letzterKontakt, links: mit(k.firmaId && punktId('firma', k.firmaId)) });
  }
  for (const f of c.firmen) {
    if (f.archiviertAm || f.geloeschtAm) continue;
    aus.push({ art: 'firma', kennung: f.id, titel: f.name, datum: f.geaendert, links: mit(f.mutterId && punktId('firma', f.mutterId)) });
  }
  for (const d of c.chancen) {
    aus.push({ art: 'deal', kennung: d.id, titel: d.titel, datum: d.geaendert, links: mit(d.firmaId && punktId('firma', d.firmaId), d.gesellschaft && punktId('gesellschaft', d.gesellschaft), ...(d.kontaktIds ?? []).map(k => punktId('kontakt', k))) });
  }
  for (const m of c.mandate) {
    if (m.geloeschtAm) continue;
    aus.push({ art: 'mandat', kennung: m.id, titel: m.titel || m.kunde, datum: (m as { geaendert?: string }).geaendert ?? m.start, links: mit(m.firmaId && punktId('firma', m.firmaId), m.chanceId && punktId('deal', m.chanceId), m.gesellschaft && punktId('gesellschaft', m.gesellschaft), ...(m.kontaktIds ?? []).map(k => punktId('kontakt', k))) });
  }
  return aus;
}

async function planung(person: string, ms: Meilenstein[]): Promise<RohPunkt[]> {
  const [{ ladeAufgabenSicht, nurIchBesitzer }, { haushaltsZiele }, { meilensteinVonAufgabe, zielVonMeilenstein }, { meilensteinSpace }, { spaceVonZiel, zielThema }] = await Promise.all([
    import('@/lib/aufgaben/sicht'), import('@/lib/planung/ziel-farben-server'), import('@/lib/planung/meilenstein-aufgaben'), import('@/lib/planung/meilensteine'), import('@/lib/lichtfaeden/modell'),
  ]);
  const [s, ziele] = await Promise.all([ladeAufgabenSicht(person), sicher(() => haushaltsZiele(), [])]);
  const aus: RohPunkt[] = [];
  const zielPerson = new Map(ziele.map(z => [z.id, z.person]));
  const msJeZiel = new Map<string, Meilenstein[]>();
  for (const m of ms) { const z = zielVonMeilenstein(m); if (z) msJeZiel.set(z, [...(msJeZiel.get(z) ?? []), m]); }

  for (const z of ziele) {
    if (z.archiviertAm) continue;
    if (zielThema(z, msJeZiel.get(z.id) ?? []) === 'gesundheit') continue; // Art. 9
    aus.push({
      art: 'ziel', kennung: z.id, titel: z.titel, datum: z.erledigtAm ?? z.termin ?? null,
      privat: spaceVonZiel(z) === 'privat', gehoert: z.person,
      links: mit(z.abgeleitetVon && punktId('ziel', z.abgeleitetVon), z.mandatId && punktId('mandat', z.mandatId), z.firmaId && punktId('firma', z.firmaId)),
    });
  }
  for (const m of ms) {
    if (m.archiviertAm || m.bereich === 'gesundheit') continue; // Art. 9
    const zid = zielVonMeilenstein(m);
    aus.push({
      art: 'meilenstein', kennung: m.id, titel: m.titel, datum: m.erledigtAm ?? m.faellig ?? null,
      privat: meilensteinSpace(m) === 'privat', gehoert: zid ? zielPerson.get(zid) : undefined,
      links: mit(zid && punktId('ziel', zid), m.mandatId && punktId('mandat', m.mandatId), m.firmaId && punktId('firma', m.firmaId)),
    });
  }
  const nachId = new Map(s.tasks.map(t => [t.id, t]));
  for (const t of s.tasks) {
    if (t.archiviertAm || t.status === 'cancelled') continue;
    const besitzer = nurIchBesitzer(t, nachId);
    if (besitzer === null) continue; // „nur ich“ ohne bestimmbare Anlegerin sieht niemand
    const m = meilensteinVonAufgabe(t, ms);
    const b = t.bezug ?? {};
    aus.push({
      art: 'aufgabe', kennung: t.id, titel: t.title, datum: t.updatedAt ?? t.dueDate ?? null,
      // Privat auch im Firmen-Space einer Privat-Einheit (05.10.: Selbstständigkeit, `spaceVonAufgabe`) — Business-Konten sehen sie nicht.
      privat: t.space === 'privat' || t.spaceId === 'privat' || spaceVonAufgabe(t) === 'privat', ...(besitzer ? { gehoert: besitzer } : {}),
      links: mit(m && punktId('meilenstein', m.id), t.parentId && punktId('aufgabe', t.parentId), b.kontaktId && punktId('kontakt', b.kontaktId), b.firmaId && punktId('firma', b.firmaId), b.mandatId && punktId('mandat', b.mandatId), b.dealId && punktId('deal', b.dealId)),
    });
  }
  return aus;
}

async function termine(person: string, heute: string): Promise<RohPunkt[]> {
  const [{ termineFuerZoe }, { spaceVonKalender }, { istGesundheitsTermin }] = await Promise.all([
    import('@/lib/kalender/zoe-sicht-server'), import('@/lib/kalender/space'), import('@/lib/kalender/zoe-sicht'),
  ]);
  const k = await termineFuerZoe(person, tagPlus(heute, -TERMINE_TAGE), tagPlus(heute, TERMINE_TAGE));
  const aus: RohPunkt[] = [];
  // Nur die iCloud-/Mac-Termine: der M365-Spiegel hat keinen Termin dahinter, den ein Link öffnen könnte.
  for (const t of k.termine) {
    if (t.maskiert || t.abgesagt || istGesundheitsTermin(t)) continue;
    const privat = t.sichtbarkeit === 'privat';
    const b = t.bezug ?? {};
    aus.push({
      art: 'termin', kennung: t.id, titel: t.titel, datum: t.start,
      privat: privat || spaceVonKalender(k.einstellungen, t.kalender) === 'privat',
      ...(privat && t.wer && t.wer !== 'beide' ? { gehoert: t.wer } : {}),
      links: mit(b.kontaktId && punktId('kontakt', b.kontaktId), b.firmaId && punktId('firma', b.firmaId), b.mandatId && punktId('mandat', b.mandatId), b.dealId && punktId('deal', b.dealId), b.aufgabeId && punktId('aufgabe', b.aufgabeId)),
    });
  }
  return aus;
}

async function notizen(person: string): Promise<RohPunkt[]> {
  const { bestand, darfSehen } = await import('@/lib/zoe/vault');
  const b = await bestand();
  const sichtbar = b.notizen.filter(n => darfSehen(n, { person }) && !GESUNDHEIT.test(`${n.id} ${n.titel} ${n.stichworte.join(' ')}`));
  const nachTitel = new Map(sichtbar.map(n => [n.titel.toLowerCase(), n.id]));
  return sichtbar.map(n => ({
    art: 'notiz' as const, kennung: n.id, titel: n.titel, datum: n.geaendert,
    privat: n.scope === 'privat' || n.scope === 'familie' || n.bereich === 'Privat',
    ...(n.scope === 'privat' && n.owner ? { gehoert: n.owner } : {}),
    links: mit(...n.verweise.map(v => { const z = nachTitel.get(v.toLowerCase()); return z && punktId('notiz', z); })),
  }));
}

async function gesellschaften(): Promise<RohPunkt[]> {
  const h = await haushaltDesInhabers();
  if (!h) return [];
  const [{ ladeRegister }, { alleGesellschaften, anzeigeName, aktiveEintraege }] = await Promise.all([import('@/lib/gesellschaften/server'), import('@/lib/gesellschaften/modell')]);
  const d = await ladeRegister(h);
  if (!d) return [];
  return alleGesellschaften(d).map(g => ({
    art: 'gesellschaft' as const, kennung: g.id, titel: anzeigeName(g), datum: g.angelegt ?? null,
    links: mit(
      g.vorgaengerId && punktId('gesellschaft', g.vorgaengerId),
      ...aktiveEintraege(g.gesellschafter).map(x => (x.wer.art === 'kontakt' || x.wer.art === 'firma' || x.wer.art === 'gesellschaft') ? punktId(x.wer.art, x.wer.id) : null),
      ...aktiveEintraege(g.beteiligungen).map(x => punktId('firma', x.firmaId)),
    ),
  }));
}

/** Alle Rohpunkte, die die Sicht-Funktionen der Bestände für diese Person hergeben (vor der Kugel-Regel). */
export async function rohPunkteSammeln(person: string, heute: string): Promise<RohPunkt[]> {
  const ms = await sicher(async () => (await loadJson<{ meilensteine?: Meilenstein[] }>('meilensteine'))?.meilensteine ?? [], [] as Meilenstein[]);
  const teile = await Promise.all([
    sicher(crm, []),
    sicher(() => planung(person, ms), []),
    sicher(() => termine(person, heute), []),
    sicher(() => notizen(person), []),
    sicher(gesellschaften, []),
  ]);
  return teile.flat();
}

/** Die Kugel für den Betrachter — gemerkt je Person, Sicht und Tag (60 s; jede Schreibung in einen Bestand macht es ungültig). */
export function brainPunkteLaden(b: Betrachter, heute: string): Promise<KugelAntwort> {
  return merken(`brain-punkte:${b.person}:${b.privat ? 'voll' : 'business'}:${heute}`, 60_000, async () => kugelPunkteFuer(await rohPunkteSammeln(b.person, heute), b));
}
