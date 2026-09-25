// ─── Belege: worauf ein Vorschlag steht (rein, getestet) ───────────────────
// Die besten Deal-Agenten (Outreach, Gong) zeigen zu jeder Empfehlung den
// Beleg — dann entscheidet man schneller und besser. Jeder Vorschlag nennt in
// „quelle“ Pfade ins Datenpaket (z. B. "karten[2]", "chancen[0].ampel"); hier
// werden sie zu kurzen, lesbaren Auszügen aufgelöst. Ein Pfad, der ins Leere
// zeigt, ist selbst ein Befund: Der Prüfer zählt ihn als unbelegt.

const TEIL = /([^.[\]]+)|\[(\d+)\]/g;

/** Wert an einem Pfad wie "chancen[0].naechster_schritt" — undefined, wenn es ihn nicht gibt. */
export function anPfad(daten: unknown, pfad: string): unknown {
  let x: unknown = daten;
  for (const m of Array.from(pfad.trim().matchAll(TEIL))) {
    if (x === null || x === undefined) return undefined;
    if (m[2] !== undefined) { if (!Array.isArray(x)) return undefined; x = x[Number(m[2])]; }
    else { if (typeof x !== 'object') return undefined; x = (x as Record<string, unknown>)[m[1]]; }
  }
  return x;
}

const WICHTIG = ['name', 'titel', 'kunde', 'firma', 'kuendigungIn', 'endeAm', 'fristBis', 'gruende', 'naechster_schritt', 'ampel', 'lage', 'bedarf', 'am', 'datum', 'notiz_vom_abend', 'hinweis', 'tage', 'status', 'stufe', 'wert_gesamt', 'entscheidung_bis', 'letzter_kontakt'];

/** Kurzer, lesbarer Auszug — Objekte auf die wichtigsten Felder verdichtet. */
export function auszug(wert: unknown, max = 180): string {
  const kurz = (t: string) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
  if (wert === null || wert === undefined) return '—';
  if (typeof wert !== 'object') return kurz(String(wert));
  if (Array.isArray(wert)) return kurz(wert.slice(0, 3).map(w => auszug(w, 80)).join(' · ') + (wert.length > 3 ? ` (+${wert.length - 3})` : ''));
  const o = wert as Record<string, unknown>;
  const felder = WICHTIG.filter(f => o[f] !== undefined && o[f] !== null && o[f] !== '');
  const teile = (felder.length ? felder : Object.keys(o).slice(0, 4)).map(f => {
    const v = o[f];
    return `${f}: ${typeof v === 'object' ? auszug(v, 70) : String(v)}`;
  });
  return kurz(teile.join(' · '));
}

/** Belege zu den Quellen eines Vorschlags — höchstens drei, leere Pfade als „ins Leere“ markiert. */
export function belege(daten: unknown, quellen: string[]): { belege: string[]; insLeere: string[] } {
  const b: string[] = [], leer: string[] = [];
  for (const q of quellen.slice(0, 3)) {
    const w = anPfad(daten, q);
    if (w === undefined) leer.push(q);
    else b.push(`${q}: ${auszug(w)}`);
  }
  return { belege: b, insLeere: leer };
}
