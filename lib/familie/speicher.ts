// ─── Familie & Partnerschaft — Speicher je Haushalt ─────────────────────────
// familie--<haushalt>, Zugriff nur über haushaltVon (streng, ohne Rückfall).
// Neu angelegt mit Startinhalten aus dem Katalog: tägliche Rituale,
// Date-Ideen, Aufgabenkarten (ohne Inhaber — die verteilt ihr gemeinsam).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { wendeAn, type ListenOp } from '@/lib/sync';
import { DATE_IDEEN, KARTEN, TAGES_RITUALE } from './katalog';
import { LISTEN, type Familie, type Liste, type Einstellungen, type Profil, type Vision } from './typen';

export const familieName = (haushalt: string) => `familie--${haushalt}`;

export const STANDARD_EINSTELLUNGEN: Einstellungen = { gespraech: { wochentag: 0, uhrzeit: '19:00', dauerMin: 45 }, businessFrei: [{ tage: [0], von: '00:00', bis: '23:59' }, { tage: [1, 2, 3, 4, 5], von: '20:00', bis: '23:59' }], kinder: false, ausnahmeBis: null };

export function startBestand(jetzt: string): Familie {
  const s = { von: 'system', am: jetzt };
  return {
    einstellungen: STANDARD_EINSTELLUNGEN,
    gespraeche: [], themen: [], vereinbarungen: [], wertschaetzungen: [],
    rituale: TAGES_RITUALE.map(r => ({ ...r, ...s })), ritualtage: [],
    ideen: DATE_IDEEN.map(d => ({ ...d, ...s })), dates: [],
    lovemap: [], wuensche: [], profile: [], reparaturen: [], visionen: [], tage: [],
    karten: KARTEN.map(k => ({ ...k, ...s, inhaber: null, geprueft: null, aktiv: true })), menschen: [],
  };
}

export async function ladeFamilie(haushalt: string): Promise<Familie> {
  const f = await loadJson<Familie>(familieName(haushalt));
  if (f) return { ...startBestand(new Date().toISOString()), ...f };
  const neu = startBestand(new Date().toISOString());
  return (await updateJson<Familie>(familieName(haushalt), cur => cur ?? neu));
}

const text = (v: unknown, n = 2000) => String(v ?? '').slice(0, n);
const tag = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : null);

/** Einzeländerungen anwenden. Wer anlegt, steht in „von“; fremde private Einträge sind tabu. */
export function wendeFamilieAn(f: Familie, ops: ListenOp[], person: string, jetzt: string): { familie: Familie; angewandt: number; abgelehnt: number } {
  let angewandt = 0, abgelehnt = 0;
  const neu = { ...f } as Familie & Record<string, unknown>;
  for (const name of LISTEN) {
    const eigene = ops.filter(o => o.liste === name);
    if (!eigene.length) continue;
    const liste = (f[name] ?? []) as unknown as Record<string, unknown>[];
    const nachId = new Map(liste.map(x => [String(x.id), x]));
    // Private Einträge des anderen dürfen weder geändert noch gelöscht werden.
    const erlaubt = eigene.filter(o => {
      const alt = nachId.get(String(o.op === 'delete' ? o.id : o.eintrag?.id));
      const fremdPrivat = alt && alt.sichtbarkeit === 'nur-ich' && alt.von !== person;
      if (fremdPrivat) abgelehnt++;
      return !fremdPrivat;
    });
    const r = wendeAn(liste, erlaubt, 'id', roh => {
      const id = text(roh.id, 60);
      if (!id) return null;
      const alt = nachId.get(id);
      return { ...roh, id, von: alt?.von ?? person, am: alt?.am ?? jetzt, sichtbarkeit: roh.sichtbarkeit === 'nur-ich' ? 'nur-ich' : 'paar' };
    });
    angewandt += r.angewandt;
    (neu as Record<string, unknown>)[name] = r.liste;
  }
  return { familie: neu, angewandt, abgelehnt };
}

export function setzeFelder(f: Familie, felder: Record<string, unknown>, person: string, jetzt: string): Familie {
  const n = { ...f };
  if (felder.einstellungen && typeof felder.einstellungen === 'object') {
    const e = felder.einstellungen as Partial<Einstellungen>;
    n.einstellungen = {
      ...f.einstellungen,
      ...(e.gespraech ? { gespraech: { wochentag: Math.max(0, Math.min(6, Number(e.gespraech.wochentag) || 0)), uhrzeit: text(e.gespraech.uhrzeit, 5) || '19:00', dauerMin: Math.max(15, Math.min(120, Number(e.gespraech.dauerMin) || 45)) } } : {}),
      ...(Array.isArray(e.businessFrei) ? { businessFrei: e.businessFrei.slice(0, 10).map(b => ({ tage: (b.tage ?? []).map(Number).filter(x => x >= 0 && x <= 6), von: text(b.von, 5), bis: text(b.bis, 5) })) } : {}),
      ...(typeof e.kinder === 'boolean' ? { kinder: e.kinder } : {}),
      ...('ausnahmeBis' in e ? { ausnahmeBis: tag(e.ausnahmeBis) } : {}),
    };
  }
  // Profil: jeder pflegt nur sein eigenes.
  if (felder.profil && typeof felder.profil === 'object') {
    const p = felder.profil as Partial<Profil>;
    const eigenes: Profil = { person, stress: text(p.stress, 1000), traeume: text(p.traeume, 1000), wasMirGuttut: text(p.wasMirGuttut, 1000), stand: jetzt };
    n.profile = [...f.profile.filter(x => x.person !== person), eigenes];
  }
  if (felder.vision && typeof felder.vision === 'object') {
    const v = felder.vision as Partial<Vision>;
    const jahr = Number(v.jahr) || Number(jetzt.slice(0, 4));
    const alt = f.visionen.find(x => x.jahr === jahr);
    const neu: Vision = {
      jahr, leitbild: text(v.leitbild ?? alt?.leitbild, 1500),
      ziele: Array.isArray(v.ziele) ? v.ziele.slice(0, 12).map((z, i) => ({ id: text(z.id, 40) || `z${i}`, text: text(z.text, 300), erreicht: !!z.erreicht })) : alt?.ziele ?? [],
      traeume: Array.isArray(v.traeume) ? v.traeume.slice(0, 12).map(t => ({ person: text(t.person, 40), text: text(t.text, 500) })) : alt?.traeume ?? [],
    };
    n.visionen = [...f.visionen.filter(x => x.jahr !== jahr), neu];
  }
  // Ritual des Tages abhaken — gemeinsam, ohne Zähler je Person.
  if (felder.ritual && typeof felder.ritual === 'object') {
    const r = felder.ritual as { datum?: string; id?: string; an?: boolean };
    const datum = tag(r.datum), id = text(r.id, 60);
    if (datum && id) {
      const alt = f.ritualtage.find(x => x.datum === datum) ?? { datum, erledigt: [] };
      const erledigt = r.an ? Array.from(new Set([...alt.erledigt, id])) : alt.erledigt.filter(x => x !== id);
      n.ritualtage = [...f.ritualtage.filter(x => x.datum !== datum), { datum, erledigt }].sort((a, b) => a.datum.localeCompare(b.datum)).slice(-400);
    }
  }
  return n;
}

export type { Liste };
