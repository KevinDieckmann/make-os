// ─── Zahlenprüfung: keine Zahl ohne Beleg ───────────────────────────────────
// Malins wichtigster Satz: „Jede Zahl, die angezeigt wird, muss belegbar sein.“
// Der Finanzagent bekommt alle Zahlen fertig gerechnet. Nach seiner Antwort
// wird jede Euro- und Prozentangabe gegen dieses Datenpaket geprüft. Was sich
// nicht wiederfindet (auch nicht als einfache Summe zweier Werte), wird als
// „nicht belegt“ markiert — sichtbar, nicht still.

/** Alle Zahlen eines Datenpakets. Felder mit „cent“/„_ct“ im Namen werden in Euro umgerechnet. */
export function zahlenAus(daten: unknown): number[] {
  const raus: number[] = [];
  const lauf = (v: unknown, schluessel = '') => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      raus.push(/cent|_ct$/i.test(schluessel) ? v / 100 : v);
      return;
    }
    if (typeof v === 'string') { for (const z of zahlenImText(v)) raus.push(z.wert); return; }
    if (Array.isArray(v)) { v.forEach(x => lauf(x, schluessel)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) lauf(x, k);
  };
  lauf(daten);
  return raus;
}

export interface Fund { text: string; wert: number; art: 'euro' | 'prozent' }

/** Euro- und Prozentangaben in deutschem Format: „1.234,56 €“, „1.234 €“, „-150 €“, „12 %“, „12,5 %“. */
export function zahlenImText(text: string): Fund[] {
  const raus: Fund[] = [];
  const re = /([+−-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+−-]?\d+(?:,\d+)?)\s?(€|EUR|%|Prozent)/g;
  for (const m of Array.from(text.matchAll(re))) {
    const wert = Number(m[1].replace('−', '-').replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(wert)) continue;
    raus.push({ text: m[0], wert, art: m[2] === '%' || m[2] === 'Prozent' ? 'prozent' : 'euro' });
  }
  return raus;
}

/** Passt eine Zahl zu den Daten? Toleranz: 1 € bzw. 1 Prozentpunkt oder 0,5 % relativ. Auch Summe/Differenz zweier Datenwerte zählt. */
export function belegt(wert: number, basis: number[], art: 'euro' | 'prozent'): boolean {
  const tol = (x: number) => Math.max(art === 'euro' ? 1 : 1, Math.abs(x) * 0.005);
  const a = Math.abs(wert);
  const werte = basis.map(Math.abs);
  if (a <= (art === 'euro' ? 1 : 0)) return true;
  if (werte.some(x => Math.abs(x - a) <= tol(a))) return true;
  // Summe oder Differenz zweier Werte (z. B. „Luft = Einkommen − Sockel“, gerundet)
  const klein = werte.filter(x => x > 0 && x < a * 2 + 1).slice(0, 400);
  for (let i = 0; i < klein.length; i++) for (let j = i; j < klein.length; j++) {
    if (Math.abs(klein[i] + klein[j] - a) <= tol(a) || Math.abs(Math.abs(klein[i] - klein[j]) - a) <= tol(a)) return true;
  }
  return false;
}

export interface Pruefergebnis { geprueft: number; unbelegt: Fund[] }

export function pruefeText(text: string, daten: unknown): Pruefergebnis {
  const basis = zahlenAus(daten);
  const funde = zahlenImText(text);
  return { geprueft: funde.length, unbelegt: funde.filter(f => !belegt(f.wert, basis, f.art)) };
}
