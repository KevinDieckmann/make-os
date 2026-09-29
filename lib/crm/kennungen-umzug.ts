// ─── Kennungs-Umzug: alte Kontakt-Kennungen → zufällige `c-<uuid>` (29.09., Paket D-C #35, Kevin) ─
// Problem (#35): die Kontakt-Kennung war `c-` + E-Mail (bzw. Name+Firma) + Hash — die Adresse stand lesbar in URLs,
// Logs, Import-Läufen und Absichten; nach Art. 17 und Neuanlage derselben Adresse kam dieselbe Kennung wieder, und alte
// Protokolleinträge zeigten auf die neue Person. Neue Kontakte bekommen seit 29.09. `c-<uuid>` (lib/kennung.ts); den
// Altbestand stellt DIESER Lauf um — nie automatisch, Kevin startet ihn (Stammdaten › Datenqualität, nur Inhaber).
//
//   vorschau    zählt: Kontakte mit alter Kennung, Vorkommen je Bestand (alle Bestände, ein Durchgang je Bestand),
//               je Kennung die betroffenen Bestände, Fingerabdrücke im Protokoll — schreibt nichts
//   ausfuehren  Absicht (lib/store/absichten.ts, Paare alt → neu) → Archivkopie aller betroffenen Bestände
//               (`crm-vor-kennungen-umzug-<zeit>.json`, 30 Tage wie jede Umzugs-Kopie) → Weiterleitungstabelle
//               (`kennung-alias--<haushalt>`, alt → neu, zuerst — alte Links lösen sich ab da auf) → alle Verweise über
//               `personenUmbiegen` (CRM, Ablage, Konflikte, Heads, Signale, Aufgaben inkl. `bezug`, Import-/Zusammenführ-
//               Läufe mit nachgezogenen Fingerabdrücken, alle übrigen Bestände, Protokoll-Fingerabdrücke) → Kartei →
//               Nachlese (was während des Laufs noch mit alter Kennung geschrieben wurde) → Such-Index/_App-Spiegel →
//               Vermerk (Fingerabdruck je Kontakt für den Rückweg)
//   rueckweg    dieselben Schritte mit umgekehrten Paaren — nur, solange KEIN umgezogener Kontakt seitdem geändert,
//               gelöscht oder zusammengeführt wurde (sonst 409 mit Grund); danach leitet die Tabelle neu → alt weiter.
//
// Was gültig bleibt (getestet): Sperrliste (hängt an den Merkmalen, nicht an der Kennung), Grabsteine gelöschter
// Personen (die sind nicht in der Kartei; ein Restore von vor dem Umzug bringt alte Kennungen, die der Grabstein kennt),
// Protokoll-Fingerabdrücke (werden `c2#hmac(alt)` → `c2#hmac(neu)` umgeschrieben). Art. 17 einer umgezogenen Person
// setzt zusätzlich Grabsteine für ihre alten Kennungen und nimmt ihre Zeilen aus der Weiterleitungstabelle.

import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import { archivSchreiben, archivZeit } from '@/lib/store/archiv';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { neueKennung, neueKontaktKennung, istAlteKontaktKennung } from '@/lib/kennung';
import { protokolliere, protokollKennungen, type Wer } from '@/lib/store/aenderungsprotokoll';
import { absichtAbschliessen, absichtBeginnen, absichtenLaden, istOffen, mitVorgang, naechsterSchritt, type Absicht } from '@/lib/store/absichten';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { karteiHaushalt } from './sperrliste';
import { aliasLaden, aliasName, type AliasDatei, type AliasEintrag, type UmzugVermerk } from './kennung-alias';
import { kennungenErsetzen, kennungenZaehlen, umkehren } from './kennungen-ersetzen';
import { personenUmbiegen, UMZUG_TEILE } from './person-bestaende';
import { promises as fs } from 'fs';

export const UMZUG_SCHRITTE = ['archiv', 'alias', ...UMZUG_TEILE, 'kartei', 'nachlese', 'index', 'vermerk'] as const;
type Kartei = { kontakte: Kontakt[] } & Record<string, unknown>;

/** Bestände, die Vorschau und Archiv nie mitzählen: das Protokoll des Umzugs selbst und die Weiterleitungstabelle. */
const NIE = /^(absichten--.*|kennung-alias--.*)$/;
const FINGERABDRUCK_BESTAND = /^(aenderungsprotokoll|zoe-entscheidungen)--[a-z0-9-]+--\d{4}-\d{2}$/;

async function bestandsNamen(): Promise<string[]> {
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  return namen.filter(n => /^[a-z0-9][a-z0-9-]*\.json$/.test(n)).map(n => n.slice(0, -5)).filter(n => !NIE.test(n)).sort();
}
const kartei = async () => (await loadJson<Kartei>('kontakte'))?.kontakte ?? [];

// ── Vorschau ─────────────────────────────────────────────────────────────────

export interface UmzugVorschau {
  /** Kontakte mit alter Kennung (werden umgestellt). */
  anzahl: number;
  /** Kontakte, die schon `c-<uuid>` tragen. */
  schonNeu: number;
  /** Vorkommen alter Kennungen je Bestand (Kartei eingeschlossen). */
  speicher: Record<string, number>;
  /** Vorkommen alter Protokoll-Fingerabdrücke je Bestand (Änderungsprotokoll, ZOE-Entscheidungen). */
  fingerabdruecke: Record<string, number>;
  /** Je Kontakt: Kennung, Anzeigename und die Bestände, in denen die Kennung vorkommt (Anzahl). */
  jeKennung: { id: string; name: string; speicher: Record<string, number> }[];
  /** Läuft gerade ein Umzug (offene Absicht)? */
  offen: { id: string; naechster: string | null; status: string } | null;
  letzter: Omit<UmzugVermerk, 'abdruecke'> | null;
  rueckweg: { moeglich: boolean; gruende: string[] };
}

export async function umzugVorschau(): Promise<UmzugVorschau> {
  const h = await karteiHaushalt();
  const kontakte = await kartei();
  const alt = kontakte.filter(k => istAlteKontaktKennung(k.id));
  const altIds = new Set(alt.map(k => k.id));
  const speicher: Record<string, number> = {};
  const jeId = new Map<string, Record<string, number>>(alt.map(k => [k.id, {}]));
  const fpNach = new Map<string, string>();
  for (const k of alt) for (const f of protokollKennungen(k.id)) if (f !== k.id) fpNach.set(f, k.id);
  const fingerabdruecke: Record<string, number> = {};
  for (const name of await bestandsNamen()) {
    const cur = await loadJson<unknown>(name).catch(() => null);
    if (cur === null) continue;
    let n = 0;
    for (const [id, z] of Array.from(kennungenZaehlen(cur))) {
      if (!altIds.has(id)) continue;
      n += z;
      const je = jeId.get(id)!;
      je[name] = (je[name] ?? 0) + z;
    }
    if (n) speicher[name] = n;
    if (FINGERABDRUCK_BESTAND.test(name)) {
      const text = JSON.stringify(cur);
      let f = 0;
      for (const fp of Array.from(fpNach.keys())) f += text.split(fp).length - 1;
      if (f) fingerabdruecke[name] = f;
    }
  }
  const offen = (await absichtenLaden(h)).find(a => (a.art === 'kennungen-umzug' || a.art === 'kennungen-rueckweg') && istOffen(a)) ?? null;
  const d = await aliasLaden(h);
  const u = letzterUmzug(d);
  const { abdruecke: _a, ...letzter } = u ?? ({} as UmzugVermerk);
  return {
    anzahl: alt.length, schonNeu: kontakte.length - alt.length, speicher, fingerabdruecke,
    jeKennung: alt.map(k => ({ id: k.id, name: anzeigename(k), speicher: jeId.get(k.id) ?? {} })),
    offen: offen ? { id: offen.id, naechster: naechsterSchritt(offen), status: offen.status } : null,
    letzter: u ? letzter as Omit<UmzugVermerk, 'abdruecke'> : null,
    rueckweg: rueckwegPruefen(d, kontakte, offen),
  };
}

/** Der jüngste abgeschlossene Vermerk (Umzug oder Rückweg). */
const letzterUmzug = (d: AliasDatei): UmzugVermerk | null => [...(d.umzuege ?? [])].filter(u => u.status !== 'laeuft').sort((a, b) => a.am.localeCompare(b.am)).pop() ?? null;

/** Kontakt-Fingerabdruck für den Rückweg — ohne `stand` (wie überall). */
const abdruck = (k: Kontakt) => fingerabdruck(k as unknown as Record<string, unknown>);

/** Geht der Rückweg? Nur für den letzten fertigen Umzug, ohne laufende Absicht, wenn kein umgezogener Kontakt seitdem geändert wurde. Rein. */
export function rueckwegPruefen(d: AliasDatei, kontakte: readonly Kontakt[], offen: Absicht | null): { moeglich: boolean; gruende: string[] } {
  const u = letzterUmzug(d);
  if (offen) return { moeglich: false, gruende: ['Ein Umzug bzw. Rückweg läuft noch — erst fertig werden lassen.'] };
  if (!u) return { moeglich: false, gruende: ['Es gibt keinen Umzug, der zurückgenommen werden kann.'] };
  if (u.status !== 'fertig' || u.art === 'rueckweg') return { moeglich: false, gruende: ['Der letzte Umzug ist schon zurückgenommen.'] };
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const abdruecke = Object.entries(u.abdruecke ?? {});
  // Art. 17 nimmt den Fingerabdruck einer gelöschten Person aus dem Vermerk (aliasOhnePerson) — sie fehlt dann ganz.
  let geaendert = 0, weg = Math.max(0, u.anzahl - abdruecke.length);
  for (const [id, fp] of abdruecke) {
    const k = nachId.get(id);
    if (!k) weg++; else if (abdruck(k) !== fp) geaendert++;
  }
  const gruende = [
    ...(geaendert ? [`${geaendert} ${geaendert === 1 ? 'Kontakt wurde' : 'Kontakte wurden'} seit dem Umzug geändert.`] : []),
    ...(weg ? [`${weg} ${weg === 1 ? 'Kontakt ist' : 'Kontakte sind'} seit dem Umzug gelöscht oder zusammengeführt.`] : []),
  ];
  return { moeglich: gruende.length === 0, gruende };
}

// ── Ausführen und Rückweg ───────────────────────────────────────────────────

export class UmzugAbgelehnt extends Error { constructor(msg: string, readonly gruende: string[] = []) { super(msg); } }

export interface UmzugErgebnis { umzugId: string; anzahl: number; speicher: Record<string, number>; archiv?: string; art: 'umzug' | 'rueckweg' }

/** Umzug starten (oder einen abgebrochenen fortsetzen). Wirft `UmzugAbgelehnt`, wenn nichts zu tun ist bzw. ein Rückweg läuft. */
export async function umzugAusfuehren(person: string): Promise<UmzugErgebnis> {
  const h = await karteiHaushalt();
  const offen = (await absichtenLaden(h)).find(a => (a.art === 'kennungen-umzug' || a.art === 'kennungen-rueckweg') && istOffen(a));
  if (offen?.art === 'kennungen-rueckweg') throw new UmzugAbgelehnt('Ein Rückweg läuft noch — erst fertig werden lassen.');
  if (offen) return umzugLauf(h, offen);
  const alt = (await kartei()).filter(k => istAlteKontaktKennung(k.id));
  if (!alt.length) throw new UmzugAbgelehnt('Alle Kontakte tragen schon zufällige Kennungen — nichts umzustellen.');
  const umzugId = neueKennung('uz');
  const paare = alt.map(k => [k.id, neueKontaktKennung()] as [string, string]);
  const { absicht } = await absichtBeginnen(h, { art: 'kennungen-umzug', schluessel: 'kennungen', schritte: UMZUG_SCHRITTE, daten: { umzugId, paare, person }, person });
  return umzugLauf(h, absicht);
}

/** Rückweg des letzten Umzugs — 409-Gründe als `UmzugAbgelehnt`. */
export async function umzugRueckweg(person: string): Promise<UmzugErgebnis> {
  const h = await karteiHaushalt();
  const offen = (await absichtenLaden(h)).find(a => (a.art === 'kennungen-umzug' || a.art === 'kennungen-rueckweg') && istOffen(a)) ?? null;
  if (offen?.art === 'kennungen-rueckweg') return umzugLauf(h, offen);
  const d = await aliasLaden(h);
  const p = rueckwegPruefen(d, await kartei(), offen);
  if (!p.moeglich) throw new UmzugAbgelehnt(`Rückweg nicht möglich: ${p.gruende.join(' ')}`, p.gruende);
  const u = letzterUmzug(d)!;
  // Umgekehrte Paare: neu → alt, nur für die Einträge dieses Umzugs.
  const paare = d.eintraege.filter(e => e.umzug === u.id).map(e => [e.neu, e.alt] as [string, string]);
  const { absicht } = await absichtBeginnen(h, { art: 'kennungen-rueckweg', schluessel: 'kennungen', schritte: UMZUG_SCHRITTE, daten: { umzugId: neueKennung('uz'), vonUmzug: u.id, paare, person }, person });
  return umzugLauf(h, absicht);
}

/** Wiederaufnahme (lib/store/absichten-fortsetzen.ts). */
export async function umzugFortsetzen(haushalt: string, a: Absicht): Promise<void> { await umzugLauf(haushalt, a); }

async function umzugLauf(h: string, absicht: Absicht): Promise<UmzugErgebnis> {
  const rueckweg = absicht.art === 'kennungen-rueckweg';
  const paare = new Map((absicht.daten.paare as [string, string][] | undefined) ?? []);
  const umzugId = String(absicht.daten.umzugId);
  const person = String(absicht.daten.person ?? absicht.person ?? 'system');
  const wer: Wer = { art: 'person', person };
  const ergebnis: UmzugErgebnis = { umzugId, anzahl: paare.size, speicher: {}, art: rueckweg ? 'rueckweg' : 'umzug' };
  const zaehle = (s: Record<string, number>) => { for (const [k, n] of Object.entries(s)) ergebnis.speicher[k] = (ergebnis.speicher[k] ?? 0) + n; };

  await mitVorgang(h, absicht, async v => {
    // 1. Archivkopie aller Bestände, in denen die Kennungen vorkommen (verschlüsselt, 30 Tage als Umzugs-Kopie).
    await v.schritt('archiv', async () => {
      const bestaende: Record<string, unknown> = {};
      let kontakte: Kartei | null = null;
      for (const name of await bestandsNamen()) {
        const cur = await loadJson<unknown>(name).catch(() => null);
        if (cur === null) continue;
        const text = JSON.stringify(cur);
        const betroffen = Array.from(kennungenZaehlen(cur).keys()).some(id => paare.has(id)) || (FINGERABDRUCK_BESTAND.test(name) && Array.from(paare.keys()).some(a => protokollKennungen(a).some(f => f !== a && text.includes(f))));
        if (!betroffen) continue;
        if (name === 'kontakte') kontakte = cur as Kartei; else bestaende[name] = cur;
      }
      return archivSchreiben(`crm-vor-kennungen-${rueckweg ? 'rueckweg' : 'umzug'}-${archivZeit(new Date().toISOString())}.json`, { art: rueckweg ? 'kennungen-rueckweg' : 'kennungen-umzug', umzugId, kontakte, bestaende });
    }, archiv => ({ archiv }));
    ergebnis.archiv = v.daten<string>('archiv');

    // 2. Weiterleitungstabelle ZUERST — ab hier lösen sich alte Links auf (die Seite leitet weiter, sobald die alte
    //    Kennung nicht mehr in der Kartei steht). Rückweg: Einträge des Umzugs raus, neu → alt hinein.
    await v.schritt('alias', async () => {
      const am = new Date().toISOString();
      await updateJson<AliasDatei>(aliasName(h), cur => {
        const d: AliasDatei = { eintraege: cur?.eintraege ?? [], umzuege: cur?.umzuege ?? [] };
        const vonUmzug = String(v.daten('vonUmzug') ?? '');
        const basis = rueckweg ? d.eintraege.filter(e => e.umzug !== vonUmzug) : d.eintraege;
        const schon = new Set(basis.map(e => e.alt));
        const neu: AliasEintrag[] = Array.from(paare).filter(([a]) => !schon.has(a)).map(([alt, n]) => ({ alt, neu: n, umzug: umzugId, am }));
        const umzuege = (d.umzuege ?? []).some(u => u.id === umzugId) ? d.umzuege! : [...(d.umzuege ?? []), { id: umzugId, art: rueckweg ? 'rueckweg' as const : 'umzug' as const, am, person, anzahl: paare.size, status: 'laeuft' as const, ...(v.daten<string>('archiv') ? { archiv: v.daten<string>('archiv') } : {}) }];
        return { eintraege: [...basis, ...neu], umzuege };
      });
    });

    // 3. Alle Verweise außerhalb der Kartei — derselbe Weg wie beim Zusammenführen, je Teil ein Schritt.
    zaehle((await personenUmbiegen(paare, { umzug: true, schritt: async (t, fn) => { await v.schritt(t, fn); } })).speicher);

    // 4. Die Kartei selbst (Kennungen und Verweise zwischen Kontakten) — Protokoll: je Kontakt „Kennung geändert“.
    await v.schritt('kartei', () => karteiUmziehen(paare, wer).then(n => { if (n) zaehle({ kontakte: n }); }));

    // 5. Nachlese: was während des Laufs noch mit alter Kennung geschrieben wurde (idempotent, meist nichts).
    await v.schritt('nachlese', async () => {
      zaehle((await personenUmbiegen(paare, { umzug: true })).speicher);
      await karteiUmziehen(paare, wer);
    });

    // 6. Abgeleitete Stände: Such-Index über die App-Bestände (app_chunks) und — falls an — der _App-Spiegel.
    await v.schritt('index', async () => {
      try { const { appIndexAktualisieren } = await import('@/lib/brain/app-index'); await appIndexAktualisieren(true); }
      catch (e) { console.error('[kennungen-umzug] Such-Index nicht nachgezogen (der Takt holt es nach):', e instanceof Error ? e.message : e); }
      if (process.env.MAKE_OS_APP_SPIEGEL?.trim() === 'an') {
        try { const { appSpiegel } = await import('@/lib/brain/app-spiegel'); await appSpiegel({ erzwingen: true }); }
        catch (e) { console.error('[kennungen-umzug] _App-Spiegel nicht neu erzeugt:', e instanceof Error ? e.message : e); }
      }
    });

    // 7. Vermerk: fertig + Fingerabdruck je umgezogenem Kontakt (Rückweg-Prüfung „seitdem geändert?“).
    await v.schritt('vermerk', async () => {
      const nachId = new Map((await kartei()).map(k => [k.id, k]));
      const vonUmzug = String(v.daten('vonUmzug') ?? '');
      await updateJson<AliasDatei>(aliasName(h), cur => {
        const umzuege = (cur?.umzuege ?? []).map(u => {
          if (u.id === umzugId) {
            if (rueckweg) { const { abdruecke: _a, ...r } = u; return { ...r, status: 'fertig' as const }; }
            const abdruecke = Object.fromEntries(Array.from(paare.values()).flatMap(n => { const k = nachId.get(n); return k ? [[n, abdruck(k)]] : []; }));
            return { ...u, status: 'fertig' as const, abdruecke };
          }
          if (rueckweg && u.id === vonUmzug) { const { abdruecke: _a, ...r } = u; return { ...r, status: 'zurueck' as const, zurueck: { am: new Date().toISOString(), von: person } }; }
          return u;
        });
        return { eintraege: cur?.eintraege ?? [], umzuege };
      });
    });
  });
  await absichtAbschliessen(h, absicht.id, 'fertig', ['umzugId', 'archiv']);
  return ergebnis;
}

/** Kartei umziehen: alle Kennungen aus `paare` (auch Verweise zwischen Kontakten). Liefert die Zahl umgezogener Kontakte. */
async function karteiUmziehen(paare: ReadonlyMap<string, string>, wer: Wer): Promise<number> {
  let umgezogen: string[] = [];
  if ((await loadJson<Kartei>('kontakte')) === null) return 0;
  await updateJson<Kartei>('kontakte', cur => {
    if (!cur) return { kontakte: [] };
    umgezogen = (cur.kontakte ?? []).filter(k => paare.has(k.id)).map(k => paare.get(k.id)!);
    const r = kennungenErsetzen(cur, paare);
    return r.n ? r.wert : cur;
  });
  // Änderungsprotokoll: je Kontakt „Kennung geändert“ unter der NEUEN Kennung (als Fingerabdruck), nie Werte.
  if (umgezogen.length) await protokolliere('kontakte', umgezogen.map(id => ({ op: 'geaendert' as const, id, felder: ['id'] })), wer);
  return umgezogen.length;
}

/** Nur für Tests/Werkzeuge: die umgekehrten Paare eines Umzugs (neu → alt). */
export const paareUmgekehrt = umkehren;
