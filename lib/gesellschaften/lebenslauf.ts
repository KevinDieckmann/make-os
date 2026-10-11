// ─── Unternehmen › Lebenslauf einer Gesellschaft (rein, client-sicher, 11.10.) ──────────────────────────────────────────────────────
// Kevin 10.10.: „Unternehmen wird extrem spannend, wenn ich alle Gesellschafterbeschlüsse, den Gegenstand und alles dazu gesammelt habe.“ — 11.10.:
// „Bild statt Liste“. Der Lebenslauf legt alles, was das Register (eine Quelle) über die Geschichte einer Gesellschaft weiß, auf EINEN Zeitstrahl:
// Gründung, Eintragung, Beschlüsse (mit Nummer), neue Fassungen (Gegenstand, Satzung, Kapital, Sitz, Geschäftsführung, Firma), Ein- und Austritte von
// Gesellschaftern, Organe (Geschäftsführung, Prokura …), Beteiligungen und die Ereignisse des Pflichten-Kalenders. Nichts wird gespeichert — nur gelesen.
// Namen Dritter nur über die übergebene Namensfunktion (zur Laufzeit aus dem Register), nie im Code.

import { ORGAN_FUNKTIONEN, aktiveEintraege, type Bezug, type RegisterGesellschaft } from './modell';
import { artLabel, beschlussNummern, fassungWert, merkmalLabel, nummerText } from './beschluesse';
import { ereignisDef } from './schild/pflichten';
import type { SchildGesellschaft } from './schild/typen';
import { WEG } from '@/lib/wege';

export type LebenslaufArt = 'gruendung' | 'register' | 'beschluss' | 'fassung' | 'gesellschafter' | 'organ' | 'beteiligung' | 'ereignis';
export const LEBENSLAUF_ARTEN: readonly { id: LebenslaufArt; label: string }[] = [
  { id: 'gruendung', label: 'Gründung' }, { id: 'register', label: 'Handelsregister' }, { id: 'beschluss', label: 'Beschluss' }, { id: 'fassung', label: 'Neue Fassung' },
  { id: 'gesellschafter', label: 'Gesellschafter' }, { id: 'organ', label: 'Organe' }, { id: 'beteiligung', label: 'Beteiligung' }, { id: 'ereignis', label: 'Ereignis' },
];
export interface LebenslaufEintrag {
  id: string;
  tag: string;
  art: LebenslaufArt;
  titel: string;
  unter?: string;
  weg?: string;
  /** Liegt nach heute (beschlossen, aber noch nicht gültig). */
  kommt?: true;
}

const kurz = (t: string, n = 90) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** Der Lebenslauf (rein), neueste zuerst. `name` löst Bezüge (Personen, Kontakte, Firmen, Gesellschaften) zur Laufzeit auf. */
export function lebenslauf(g: RegisterGesellschaft, s: SchildGesellschaft | null | undefined, name: (b: Bezug) => string, heute: string): LebenslaufEintrag[] {
  const raus: LebenslaufEintrag[] = [];
  const id = g.id;
  if (g.gegruendetAm) raus.push({ id: 'gruendung', tag: g.gegruendetAm, art: 'gruendung', titel: 'Gründung', weg: WEG.unternehmen(id) });
  if (g.eingetragenAm) raus.push({ id: 'eintragung', tag: g.eingetragenAm, art: 'register', titel: 'Eingetragen im Handelsregister', weg: WEG.unternehmen(id) });
  const beschluesse = aktiveEintraege(g.beschluesse).filter(b => b.status !== 'entwurf');
  const nummern = beschlussNummern(g.beschluesse);
  for (const b of beschluesse) {
    const nr = nummern.get(b.id);
    raus.push({ id: `bs:${b.id}`, tag: b.datum, art: 'beschluss', titel: b.titel || artLabel(b.art), unter: [nr ? nummerText(nr) : undefined, artLabel(b.art), b.status === 'aufgehoben' ? 'aufgehoben' : undefined].filter(Boolean).join(' · '), weg: WEG.beschluss(id, b.id) });
    if (b.eingetragenAm && b.eingetragenAm !== b.datum) raus.push({ id: `bs-hr:${b.id}`, tag: b.eingetragenAm, art: 'register', titel: `Eingetragen: ${b.titel || artLabel(b.art)}`, weg: WEG.beschluss(id, b.id) });
  }
  // Fassungen: je Tag und Beschluss EIN Eintrag („Neue Fassung: Gegenstand, Stammkapital“).
  const fassungen = new Map<string, { tag: string; beschlussId?: string; teile: string[] }>();
  for (const f of aktiveEintraege(g.fassungen)) {
    const k = `${f.ab}|${f.beschlussId ?? ''}`;
    const x = fassungen.get(k) ?? { tag: f.ab, ...(f.beschlussId ? { beschlussId: f.beschlussId } : {}), teile: [] };
    const wert = fassungWert(f);
    x.teile.push(f.merkmal === 'stammkapital' && wert ? `${merkmalLabel(f.merkmal)} ${wert}` : merkmalLabel(f.merkmal));
    fassungen.set(k, x);
  }
  for (const [k, f] of Array.from(fassungen.entries())) {
    raus.push({ id: `fs:${k}`, tag: f.tag, art: 'fassung', titel: `Neue Fassung: ${f.teile.join(', ')}`, unter: f.beschlussId && beschluesse.some(b => b.id === f.beschlussId) ? 'aus einem Beschluss' : undefined, weg: WEG.beschluss(id, undefined, 'satzung'), ...(f.tag > heute ? { kommt: true as const } : {}) });
  }
  for (const x of aktiveEintraege(g.gesellschafter)) {
    if (x.eingetretenAm) raus.push({ id: `gs-ein:${x.id}`, tag: x.eingetretenAm, art: 'gesellschafter', titel: `${name(x.wer)} tritt als Gesellschafter ein`, weg: WEG.unternehmen(id, 'gesellschafter') });
    if (x.ausgeschiedenAm) raus.push({ id: `gs-aus:${x.id}`, tag: x.ausgeschiedenAm, art: 'gesellschafter', titel: `${name(x.wer)} scheidet als Gesellschafter aus`, weg: WEG.unternehmen(id, 'gesellschafter') });
  }
  for (const o of aktiveEintraege(g.organe)) {
    const f = ORGAN_FUNKTIONEN.find(x => x.id === o.funktion)?.label ?? 'Organ';
    if (o.seit) raus.push({ id: `og-seit:${o.id}`, tag: o.seit, art: 'organ', titel: `${f}: ${name(o.wer)} beginnt`, weg: WEG.unternehmen(id, 'organe') });
    if (o.bis) raus.push({ id: `og-bis:${o.id}`, tag: o.bis, art: 'organ', titel: `${f}: ${name(o.wer)} endet`, weg: WEG.unternehmen(id, 'organe') });
  }
  for (const b of aktiveEintraege(g.beteiligungen)) {
    const wer = name({ art: 'firma', id: b.firmaId });
    if (b.erwerbAm) raus.push({ id: `bt-ein:${b.id}`, tag: b.erwerbAm, art: 'beteiligung', titel: `Beteiligung an ${wer} erworben${typeof b.anteilProzent === 'number' ? ` (${b.anteilProzent.toLocaleString('de-DE')} %)` : ''}`, weg: WEG.unternehmen(id, 'beteiligungen') });
    if (b.beendetAm) raus.push({ id: `bt-aus:${b.id}`, tag: b.beendetAm, art: 'beteiligung', titel: `Beteiligung an ${wer} beendet`, weg: WEG.unternehmen(id, 'beteiligungen') });
  }
  // Ereignisse des Pflichten-Kalenders — außer denen, die schon als Beschluss im Lebenslauf stehen (EIN Eintrag je Vorgang).
  for (const e of aktiveEintraege(s?.ereignisse)) {
    if (e.beschlussId && beschluesse.some(b => b.id === e.beschlussId)) continue;
    raus.push({ id: `ev:${e.id}`, tag: e.datum, art: 'ereignis', titel: ereignisDef(e.art)?.label ?? 'Ereignis', ...(e.notiz ? { unter: kurz(e.notiz) } : {}), weg: WEG.schild('pflichten', id), ...(e.datum > heute ? { kommt: true as const } : {}) });
  }
  return raus.sort((a, b) => b.tag.localeCompare(a.tag) || a.art.localeCompare(b.art) || a.id.localeCompare(b.id));
}

/** Nach Jahren gruppiert (neueste zuerst) — für das Bild. */
export function lebenslaufJahre(l: readonly LebenslaufEintrag[]): { jahr: string; eintraege: LebenslaufEintrag[] }[] {
  const raus: { jahr: string; eintraege: LebenslaufEintrag[] }[] = [];
  for (const e of l) {
    const j = e.tag.slice(0, 4);
    const x = raus.find(r => r.jahr === j);
    if (x) x.eintraege.push(e); else raus.push({ jahr: j, eintraege: [e] });
  }
  return raus;
}
