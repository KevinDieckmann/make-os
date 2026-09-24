// ─── Der Rechner des Head of Finance ────────────────────────────────────────
// Sprachmodelle verrechnen sich bei mehrstufigen Rechnungen verlässlich.
// Braucht der Agent eine neue Zahl (Szenario, Hochrechnung), ruft er dieses
// Werkzeug — das Ergebnis ist dann belegt. Nur + − * / und Klammern, keine
// Variablen, kein eval.

export function rechne(ausdruck: string): number | null {
  const s = String(ausdruck ?? '').replace(/−/g, '-').replace(/,/g, '.').replace(/\s+/g, '');
  if (!s || s.length > 200 || /[^0-9.+\-*/()]/.test(s)) return null;
  let i = 0;
  const zahl = (): number => {
    if (s[i] === '(') { i++; const v = summe(); if (s[i] !== ')') throw new Error('Klammer'); i++; return v; }
    if (s[i] === '-') { i++; return -zahl(); }
    if (s[i] === '+') { i++; return zahl(); }
    const m = s.slice(i).match(/^\d+(\.\d+)?/);
    if (!m) throw new Error('Zahl erwartet');
    i += m[0].length;
    return Number(m[0]);
  };
  const produkt = (): number => {
    let v = zahl();
    while (s[i] === '*' || s[i] === '/') {
      const op = s[i++]; const r = zahl();
      if (op === '/' && r === 0) throw new Error('Division durch 0');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const summe = (): number => {
    let v = produkt();
    while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = produkt(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  try {
    const v = summe();
    if (i !== s.length || !Number.isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  } catch { return null; }
}
