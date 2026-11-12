// Gemeinsamer Takt der Seite und eine kleine Feder.
// Der Takt läuft nur, solange jemand etwas zu tun hat: Eine ruhende Seite kostet kein einziges Bild.

const abos = new Set();
let lauf = 0;

function takt(t) {
  lauf = 0;
  for (const f of [...abos]) {
    try { if (f(t) === false) abos.delete(f); }
    catch (fehler) { abos.delete(f); console.error(fehler); }
  }
  if (abos.size && !lauf) lauf = requestAnimationFrame(takt);
}

/** f läuft in jedem Bild, bis es false zurückgibt oder die Rückgabe aufgerufen wird. */
export function imTakt(f) {
  abos.add(f);
  if (!lauf) lauf = requestAnimationFrame(takt);
  return () => abos.delete(f);
}

// Scrollen und Größenänderung: alle Hörer höchstens einmal je Bild.
const hoerer = new Set();
let gemeldet = false;
function melden() {
  if (gemeldet) return;
  gemeldet = true;
  imTakt(() => { gemeldet = false; for (const h of hoerer) h(); return false; });
}
export function beiBewegung(h) {
  if (!hoerer.size) {
    addEventListener('scroll', melden, { passive: true });
    addEventListener('resize', melden);
  }
  hoerer.add(h);
  melden();
}

/** Feder über mehrere Werte (Masse, Steifigkeit k, Dämpfung c). Halbimpliziter Euler in festen Schritten. */
export class Feder {
  constructor(wert, schreibe, { k = 120, c = 22, m = 1 } = {}) {
    this.x = [...wert];
    this.v = wert.map(() => 0);
    this.z = [...wert];
    Object.assign(this, { k, c, m, schreibe, aktiv: false, zeit: 0 });
  }
  setze(wert) { this.x = [...wert]; this.z = [...wert]; this.v.fill(0); this.schreibe(this.x); }
  nach(ziel) {
    this.z = [...ziel];
    if (this.aktiv) return;
    this.aktiv = true;
    this.zeit = 0;
    imTakt(t => this.schritt(t));
  }
  schritt(t) {
    let rest = this.zeit ? Math.min(.064, (t - this.zeit) / 1000) : 1 / 60;
    this.zeit = t;
    while (rest > 1e-6) {
      const h = Math.min(rest, 1 / 120);
      rest -= h;
      for (let i = 0; i < this.x.length; i++) {
        this.v[i] += ((-this.k * (this.x[i] - this.z[i]) - this.c * this.v[i]) / this.m) * h;
        this.x[i] += this.v[i] * h;
      }
    }
    const ruht = this.x.every((x, i) => Math.abs(this.v[i]) < .02 && Math.abs(x - this.z[i]) < .02);
    if (ruht) { this.x = [...this.z]; this.v.fill(0); this.aktiv = false; }
    this.schreibe(this.x);
    return ruht ? false : undefined;
  }
}

export const klemme = (w, a = 0, b = 1) => Math.min(b, Math.max(a, w));
