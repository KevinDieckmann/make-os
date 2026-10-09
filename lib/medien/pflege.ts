// ─── Medien — täglicher Lauf: Fristen, Sperren, Ablauf, Schlüssel (09.10., Paket 5) ──────────────────────────────────────────
// Läuft im Löschfristen-Lauf (lib/crm/loeschfristen-lauf.ts, Schritt „medien“, einmal am Tag) — idempotent, wirft nie wegen eines Medium.
// Kevin 09.10.: „Rohmaterial mit Personen, nicht freigegeben → Prüf-Aufgabe nach 12 Monaten (nie automatisch löschen) · Papierkorb 30 Tage ·
// Art. 17 → sperren + Prüfung“ · „je Freigabe Kanäle + bis-Datum, danach automatisch gesperrt + Aufgabe“ · „Widerruf sperrt sofort“.
//   1  Upload-Sitzungen nach Ablauf (Frist „medien-upload“, 7 Tage): Stücke im Speicher und Sitzung weg
//   2  Papierkorb (Frist „medien-papierkorb“, 30 Tage): Objekte im Speicher, dann Eintrag (mit ihm der Schlüssel) — nie vorher
//   3  Sperren festschreiben: Art. 17 (Person gelöscht), Art. 18, Werbesperre, Widerruf — sofort wirksam sind sie schon beim Lesen
//      (`wirksamerStatus`); hier werden sie gespeichert und die Freigabe gesperrt; Art. 17 → EINE Prüf-Aufgabe (ohne Namen)
//   4  Ablauf: freigegeben und `bis` vorbei → „abgelaufen“ + Aufgabe an die Person, die freigegeben hat
//   5  Rohmaterial mit erkennbaren Personen, seit der Frist („medien-roh“, 12 Monate) nicht freigegeben → EINE Prüf-Aufgabe, nie löschen
//   6  Schlüssel je Medium mit dem aktiven Datenschlüssel neu wickeln (nach einer Rotation; die Videos bleiben unberührt)
//   7  Paket 4c: fertige KI-Medien des Altbestands `ki-medien--<haushalt>` einmal in die EINE Ablage übernehmen (lib/medien/ki-ablage.ts,
//      idempotent; der Altbestand bleibt liegen)
// Aufgaben nur über den Aufgaben-Schreibweg (`systemAufgabenAendern`), Titel ohne Namen und ohne Inhalte.

import { localDay, tagePlus, tagVon } from '@/lib/zeit';
import { medienBestand, medienPrivatBestand, type MedienKatalog, type Medium } from './typen';
import { wirksamerStatus, personenSperre, type Lage } from './regeln';
import { schluesselNeuWickeln, schluesselAktuell } from './krypto';
import { ladeKatalog, katalogAendern, lageFuer, haushaltsPersonen, objekteLoeschen } from './server';
import { karteiHaushalt } from '@/lib/crm/sperrliste';

export interface PflegeFristen { uploadTage: number; papierkorbTage: number; rohMonate: number }
export interface PflegeErgebnis { sitzungen: number; papierkorb: number; gesperrt: number; abgelaufen: number; roh: number; art17: number; schluessel: number; kiUebernommen?: number }

/** Reine Auswertung eines Business-Katalogs: was zu sperren, was abgelaufen, was Rohmaterial über der Frist ist. */
export function pflegeAuswerten(kat: MedienKatalog, lage: Lage, rohSeit: string): { sperren: { id: string; grund: NonNullable<Medium['marketing']['sperrGrund']> }[]; ablauf: string[]; roh: number; art17: number } {
  const sperren: { id: string; grund: NonNullable<Medium['marketing']['sperrGrund']> }[] = [];
  const ablauf: string[] = [];
  let roh = 0, art17 = 0;
  for (const m of kat.medien) {
    if (m.geloeschtAm) continue;
    const s = personenSperre(m, lage);
    if (s === 'art17') art17++;
    if (s && m.marketing.status !== 'gesperrt') sperren.push({ id: m.id, grund: s });
    else if (!s && wirksamerStatus(m, lage).status === 'abgelaufen' && m.marketing.status === 'freigegeben') ablauf.push(m.id);
    const mitPersonen = m.erkennbarePersonen === 'ja' || m.personen.length > 0;
    if (mitPersonen && m.marketing.status !== 'freigegeben' && tagVon(m.hochgeladen) < rohSeit) roh++;
  }
  return { sperren, ablauf, roh, art17 };
}

/** Kalendertag `n` Monate vor `heute` (Grenze der Frist „medien-roh“; auch die Selbstprüfung, lib/medien/datenschutz.ts). */
export const monateZurueck = (heute: string, n: number) => {
  const d = new Date(`${heute}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

export async function medienPflege(f: PflegeFristen, jetzt = new Date()): Promise<PflegeErgebnis> {
  const heute = localDay(jetzt);
  const jetztIso = jetzt.toISOString();
  const r: PflegeErgebnis = { sitzungen: 0, papierkorb: 0, gesperrt: 0, abgelaufen: 0, roh: 0, art17: 0, schluessel: 0 };
  const schritt = async (name: string, tun: () => Promise<void>) => { try { await tun(); } catch (e) { console.error(`[medien-pflege] ${name}:`, e instanceof Error ? e.message : e); } };

  // 1 · Upload-Sitzungen
  await schritt('sitzungen', async () => {
    const { alleSitzungen, sitzungEntsorgen } = await import('./upload-server');
    const grenze = tagePlus(heute, -Math.max(1, f.uploadTage));
    for (const s of await alleSitzungen()) {
      if (s.laeuftAb < heute || tagVon(s.angelegt) < grenze) { await sitzungEntsorgen(s); r.sitzungen++; }
    }
  });

  const haushalt = await karteiHaushalt();
  const namen = [medienBestand(haushalt), ...(await haushaltsPersonen()).map(medienPrivatBestand)];

  // 2 · Papierkorb (alle Kataloge)
  const pkGrenze = tagePlus(heute, -Math.max(1, f.papierkorbTage));
  for (const name of namen) {
    await schritt(`papierkorb ${name}`, async () => {
      const kat = await ladeKatalog(name);
      const alt = kat.medien.filter(m => m.geloeschtAm && tagVon(m.geloeschtAm) < pkGrenze);
      for (const m of alt) await objekteLoeschen(m);
      if (alt.length) {
        const weg = new Set(alt.map(m => m.id));
        await katalogAendern(name, k => ({ ok: true as const, katalog: { ...k, medien: k.medien.filter(m => !weg.has(m.id) || !m.geloeschtAm) } }));
        r.papierkorb += alt.length;
      }
    });
  }

  await schritt('schluessel', async () => { r.schluessel = (await medienSchluesselUmwickeln()).neu; });

  // 3–5 · Business: Sperren, Ablauf, Rohmaterial
  await schritt('freigaben', async () => {
    const name = medienBestand(haushalt);
    const kat = await ladeKatalog(name);
    if (!kat.medien.length) return;
    const lage = await lageFuer(kat, [kat], heute);
    const a = pflegeAuswerten(kat, lage, monateZurueck(heute, Math.max(1, f.rohMonate)));
    r.roh = a.roh; r.art17 = a.art17;
    if (a.sperren.length || a.ablauf.length) {
      const sperren = new Map(a.sperren.map(s => [s.id, s.grund]));
      const ablauf = new Set(a.ablauf);
      await katalogAendern(name, k => ({ ok: true as const, katalog: { ...k, medien: k.medien.map(m => {
        const g = sperren.get(m.id);
        if (g && m.marketing.status !== 'gesperrt') { r.gesperrt++; return { ...m, marketing: { ...m.marketing, status: 'gesperrt' as const, sperrGrund: g, gesperrtAm: jetztIso, verlauf: [...m.marketing.verlauf, { am: jetztIso, von: 'system', nach: 'gesperrt' as const, grund: g }] }, heads: [], geaendert: jetztIso, geaendertVon: 'system' }; }
        if (ablauf.has(m.id) && m.marketing.status === 'freigegeben') { r.abgelaufen++; return { ...m, marketing: { ...m.marketing, status: 'abgelaufen' as const, verlauf: [...m.marketing.verlauf, { am: jetztIso, von: 'system', nach: 'abgelaufen' as const, grund: 'bis-Datum erreicht' }] }, geaendert: jetztIso, geaendertVon: 'system' }; }
        return m;
      }) } }));
    }
    await aufgabenAbgleichen(kat, a, jetztIso).catch(e => console.error('[medien-pflege] Aufgaben:', e instanceof Error ? e.message : e));
  });

  // 7 · KI-Medien des Altbestands (Lese-Übergang, Paket 4c)
  await schritt('ki-uebernahme', async () => {
    const { kiMedienUebernehmen } = await import('./ki-ablage');
    const u = await kiMedienUebernehmen(haushalt);
    if (u.uebernommen) r.kiUebernommen = u.uebernommen;
  });
  return r;
}

/** Aufgaben: je abgelaufenes Medium eine (an die Freigebende), dazu je EINE Prüf-Aufgabe für Art. 17 und Rohmaterial (Zahl nachziehen, erledigen bei 0). */
async function aufgabenAbgleichen(kat: MedienKatalog, a: ReturnType<typeof pflegeAuswerten>, jetztIso: string): Promise<void> {
  const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
  const { WEG } = await import('@/lib/wege');
  const { inhaberSpeicher } = await import('@/lib/zugang/haushalt-inhaber');
  const inhaber = await inhaberSpeicher();
  const nachId = new Map(kat.medien.map(m => [m.id, m]));
  const SAMMEL = [
    { id: 'md-art17-pruefen', n: a.art17, titel: (n: number) => `${n} ${n === 1 ? 'Medium zeigt' : 'Medien zeigen'} eine gelöschte Person — prüfen: löschen oder begründen`, text: `Eine abgebildete Person wurde gelöscht (Art. 17 DSGVO). Die Medien sind gesperrt; bitte prüfen und löschen bzw. begründen, warum sie bleiben: ${WEG.medien({ filter: 'gesperrt' })}. Hinweis, keine Rechtsberatung.` },
    { id: 'md-roh-pruefen', n: a.roh, titel: (n: number) => `${n} ${n === 1 ? 'Medium' : 'Medien'} mit erkennbaren Personen lange nicht freigegeben — prüfen: löschen oder begründen`, text: `Rohmaterial mit erkennbaren Personen, das seit über 12 Monaten nicht fürs Marketing freigegeben wurde (Art. 5 Abs. 1 lit. e DSGVO). Gelöscht wird nie automatisch: ${WEG.medien({ filter: 'roh' })}. Hinweis, keine Rechtsberatung.` },
  ];
  await systemAufgabenAendern(stand => {
    const neu: Record<string, unknown>[] = [];
    const teile: { id: string; felder: Record<string, unknown> }[] = [];
    for (const s of SAMMEL) {
      const t = stand.tasks.find(x => x.id === s.id);
      const offen = !!t && t.status !== 'done' && t.status !== 'cancelled' && !t.geloeschtAm;
      if (!s.n) { if (offen) teile.push({ id: s.id, felder: { status: 'done' } }); continue; }
      const titel = s.titel(s.n);
      if (offen) { if (t!.title !== titel) teile.push({ id: s.id, felder: { title: titel } }); continue; }
      if (t) teile.push({ id: s.id, felder: { title: titel, description: s.text, status: 'todo', geloeschtAm: null, geloeschtMit: null } });
      else neu.push({ id: s.id, title: titel, description: s.text, status: 'todo', priority: 'medium', ...(inhaber ? { assignee: inhaber } : {}), tags: ['datenschutz', 'medien'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetztIso, updatedAt: jetztIso, space: 'business' });
    }
    for (const id of a.ablauf) {
      const m = nachId.get(id);
      const tid = `md-ablauf-${id.slice(3, 23)}-${(m?.marketing.bis ?? '').replace(/-/g, '')}`;
      if (!m || stand.tasks.some(x => x.id === tid)) continue;
      neu.push({ id: tid, title: 'Freigabe eines Mediums abgelaufen — aus den Kanälen nehmen oder neu freigeben', description: `Die Nutzungsfrist ist vorbei; das Medium ist gesperrt. ${WEG.medien({ id })}`, status: 'todo', priority: 'medium', ...(m.marketing.freigegebenVon ? { assignee: m.marketing.freigegebenVon } : inhaber ? { assignee: inhaber } : {}), tags: ['medien'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetztIso, updatedAt: jetztIso, space: 'business' });
    }
    return { neu, teile };
  }, { jetzt: jetztIso });
}

/**
 * Rotation des Datenschlüssels (lib/store/umschluesseln.ts) und täglich: jeden Schlüssel je Medium (auch Lizenz-Nachweis, Unterschrift) mit dem
 * AKTIVEN Datenschlüssel neu wickeln. `fehler` nennt Kataloge mit Schlüsseln, die sich mit keinem Schlüssel des Rings öffnen lassen — dann den
 * alten Datenschlüssel NICHT entfernen.
 */
export async function medienSchluesselUmwickeln(): Promise<{ neu: number; fehler: string[] }> {
  const raus = { neu: 0, fehler: [] as string[] };
  const namen = [medienBestand(await karteiHaushalt()), ...(await haushaltsPersonen()).map(medienPrivatBestand)];
  for (const name of namen) {
    const kat = await ladeKatalog(name);
    const veraltet = kat.medien.some(m => !schluesselAktuell(m.schluessel) || (m.urheber.lizenz && !schluesselAktuell(m.urheber.lizenz.schluessel)))
      || (kat.einwilligungen ?? []).some(e => e.unterschrift && !schluesselAktuell(e.unterschrift.schluessel));
    if (!veraltet) continue;
    let kaputt = 0;
    const neu = <T,>(g: T, f: () => T | null): T => { try { const x = f(); if (x) raus.neu++; return x ?? g; } catch { kaputt++; return g; } };
    await katalogAendern(name, k => {
      const medien = k.medien.map(m => {
        const schluessel = neu(m.schluessel, () => schluesselNeuWickeln(m.schluessel, m.id));
        const lizenz = m.urheber.lizenz ? { ...m.urheber.lizenz, schluessel: neu(m.urheber.lizenz.schluessel, () => schluesselNeuWickeln(m.urheber.lizenz!.schluessel, m.id)) } : undefined;
        return { ...m, schluessel, ...(lizenz ? { urheber: { ...m.urheber, lizenz } } : {}) };
      });
      const einwilligungen = k.einwilligungen?.map(e => (e.unterschrift ? { ...e, unterschrift: { ...e.unterschrift, schluessel: neu(e.unterschrift.schluessel, () => schluesselNeuWickeln(e.unterschrift!.schluessel, e.id)) } } : e));
      return { ok: true as const, katalog: { ...k, medien, ...(einwilligungen ? { einwilligungen } : {}) } };
    });
    if (kaputt) raus.fehler.push(`${name}: ${kaputt} Medien-Schlüssel mit keinem Datenschlüssel zu öffnen`);
  }
  return raus;
}
