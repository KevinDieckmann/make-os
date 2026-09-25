// ─── Business-Index für den Head of Finance und Jarvis (25.09.) ─────────────
// Kevin: „tiefer verankern — Jarvis & Head of Finance“. Der Head of Finance
// arbeitet mit denselben Kennzahlen wie das Cockpit und warnt, wenn eine rot
// ist oder der Monatsabschluss fehlt. Jarvis beantwortet Fragen dazu.

import { localDay } from '@/lib/zeit';
import { SCOPES, KENNZAHL, type Scope } from './register';
import { ladeRoh, bestandFuer, businessSchreibStand } from './speicher';
import { berechne, type BusinessIndex, type KennzahlStand } from './index';
import { schwellenText } from './text';

export interface ChefHinweis { schwere: 'hoch' | 'mittel' | 'niedrig'; bereich: 'business' | 'daten'; text: string; quelle: string }

let zwischen: { t: number; tag: string; stand: number; alle: Record<Scope, BusinessIndex>; abschlussFehlt: { firma: string; monat: string }[] } | null = null;

/** Alle drei Sichten (ohne Schnappschuss) — eine Minute zwischengespeichert. */
export async function sichtenFuerChef(heute = localDay()) {
  if (zwischen && zwischen.tag === heute && zwischen.stand === businessSchreibStand() && Date.now() - zwischen.t < 60_000) return zwischen;
  const roh = await ladeRoh(heute);
  const alle = Object.fromEntries(SCOPES.map(s => [s.id, berechne(bestandFuer(roh, s.id))])) as Record<Scope, BusinessIndex>;
  // Der letzte volle Monat: fehlt sein Abschluss (und für Consulting auch die Grundlage)?
  const d = new Date(`${heute}T12:00:00`); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const vormonat = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const abschlussFehlt = (['kdc', 'kdv'] as const)
    .filter(f => !roh.abschluesse.some(a => a.firma === f && a.monat === vormonat) && !(f === 'kdc' && roh.grundlageMonate.some(m => m.monat === vormonat)))
    .map(firma => ({ firma, monat: vormonat }));
  zwischen = { t: Date.now(), tag: heute, stand: businessSchreibStand(), alle, abschlussFehlt };
  return zwischen;
}

const FIRMA: Record<string, string> = { kdc: 'Consulting', kdv: 'KD Ventures', gesamt: 'Gesamt' };
const kurz = (k: KennzahlStand) => ({ kennzahl: k.label, wert: k.anzeige, ampel: k.ampel, schwellen: schwellenText(k), quelle: k.quelle });

/** Der Block im Datenpaket des Head of Finance + seine Hinweise. */
export async function businessFuerChef(heute = localDay()): Promise<{ block: Record<string, unknown>; hinweise: ChefHinweis[] }> {
  const { alle, abschlussFehlt } = await sichtenFuerChef(heute);
  const g = alle.gesamt;
  const hinweise: ChefHinweis[] = [];
  for (const s of SCOPES) {
    const bi = alle[s.id];
    for (const saeule of bi.saeulen) for (const k of saeule.kennzahlen) {
      if (k.ampel !== 'rot') continue;
      // Finanzielle Gesundheit wiegt schwer (50 %), der Rest mittel.
      hinweise.push({ schwere: saeule.id === 'fh' ? 'hoch' : 'mittel', bereich: 'business', text: `Business-Index (${FIRMA[s.id]}): ${k.label} ist rot — ${k.anzeige} (${schwellenText(k)}). ${k.quelle}`, quelle: `business-index.${s.id}.${k.id}` });
    }
  }
  for (const f of abschlussFehlt) {
    hinweise.push({ schwere: 'niedrig', bereich: 'daten', text: `Monatsabschluss ${f.monat} für ${FIRMA[f.firma]} fehlt — er schließt Quick Ratio, Eigenkapitalquote, Personalquote und mehr (/os/business).`, quelle: 'business-index.abschluss' });
  }
  const block = {
    erklaerung: 'Business-Index = unsere KSI-Logik mit eigenen Zahlen: Finanzielle Gesundheit 50 % · Unternehmer-DNA 30 % · Markttraktion 20 %. Punkte je Kennzahl: rote Schwelle 20, grüne 100. Eine Säule zählt ab 40 % gemessener Kennzahlen.',
    gesamt: { index: g.index, label: g.label, abdeckung_prozent: Math.round(g.abdeckung * 100), groesster_hebel: g.hebel?.label ?? null },
    je_firma: Object.fromEntries((['kdc', 'kdv'] as const).map(f => [FIRMA[f], { index: alle[f].index, label: alle[f].label }])),
    saeulen: g.saeulen.map(s => ({ saeule: s.label, score: s.zuDuenn ? null : s.score, gemessen: `${s.kennzahlen.filter(k => k.gemessen).length}/${s.kennzahlen.length}` })),
    finanzielle_gesundheit: g.saeulen.find(s => s.id === 'fh')!.kennzahlen.filter(k => k.gemessen).map(kurz),
    rot: g.saeulen.flatMap(s => s.kennzahlen.filter(k => k.ampel === 'rot').map(kurz)),
    messluecken: g.saeulen.flatMap(s => s.kennzahlen.filter(k => !k.gemessen).map(k => ({ kennzahl: k.label, fehlt: k.quelle }))),
    monatsabschluss_fehlt: abschlussFehlt.map(f => `${FIRMA[f.firma]} ${f.monat}`),
  };
  return { block, hinweise };
}

/** Text für Jarvis: der Index — oder eine Kennzahl im Detail. */
export async function businessText(sicht: Scope, kennzahl?: string, heute = localDay()): Promise<string> {
  const { alle } = await sichtenFuerChef(heute);
  const bi = alle[sicht];
  if (kennzahl) {
    const def = KENNZAHL[kennzahl];
    const k = bi.saeulen.flatMap(s => s.kennzahlen).find(x => x.id === kennzahl);
    if (!def) return `Unbekannte Kennzahl „${kennzahl}“.`;
    if (!k) return `${def.label} gibt es in der Sicht ${FIRMA[sicht]} nicht (nur gesamt).`;
    return k.gemessen
      ? `${k.label} (${FIRMA[sicht]}): ${k.anzeige} — ${k.ampel === 'gruen' ? 'grün' : k.ampel === 'gelb' ? 'gelb' : 'rot'} (${schwellenText(k)}${k.angepasst ? ', eigene Schwellen' : ''}). Formel: ${k.formel}. Gerechnet: ${k.quelle}. Cockpit: /os/business?k=${k.id}`
      : `${k.label} (${FIRMA[sicht]}) ist noch nicht messbar: ${k.quelle}.${k.pflegen ? ` So schließen: ${k.pflegen.text} (${k.pflegen.href}).` : ''}`;
  }
  const saeulen = bi.saeulen.map(s => `${s.label} ${s.zuDuenn ? '— (zu wenig Daten)' : s.score ?? '—'}`).join(' · ');
  const rot = bi.saeulen.flatMap(s => s.kennzahlen.filter(k => k.ampel === 'rot').map(k => `${k.label} ${k.anzeige}`));
  const gelb = bi.saeulen.flatMap(s => s.kennzahlen.filter(k => k.ampel === 'gelb').map(k => `${k.label} ${k.anzeige}`));
  return `Business-Index ${FIRMA[sicht]}: ${bi.index ?? '—'} (${bi.label}), ${Math.round(bi.abdeckung * 100)} % auf echten Daten. ${saeulen}.` +
    `${rot.length ? ` Rot: ${rot.join(', ')}.` : ' Nichts rot.'}${gelb.length ? ` Gelb: ${gelb.join(', ')}.` : ''}` +
    `${bi.hebel ? ` Größter Hebel: ${bi.hebel.label}.` : ''} ${bi.luecken} Messlücken. Cockpit: /os/business${sicht !== 'gesamt' ? `?f=${sicht}` : ''}`;
}
