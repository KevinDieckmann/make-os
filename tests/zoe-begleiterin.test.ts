// ─── Zoe-Begleiterin auf den öffentlichen Seiten (31.10., Website-Anbau): feste Texte, KEINE KI, nichts nach außen ─────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { begleiterSaetze, SCHRITTE, vorstellung, type BegleiterOrt } from '@/lib/oeffentlich/zoe-begleiterin-texte';

const DATEIEN = ['components/oeffentlich/ZoeBegleiterin.tsx', 'lib/oeffentlich/zoe-begleiterin-texte.ts', 'components/kontaktformular/Kontaktformular.tsx', 'app/api/anfrage/route.ts', 'lib/kontaktformular/regeln.ts', 'lib/kontaktformular/server.ts'];
const ohneKommentare = (q: string) => q.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Zoe-Begleiterin', () => {
  it('jeder Schritt hat einen festen Text; der erste Satz sagt, dass Zoe eine KI ist (Art. 50 KI-VO)', () => {
    const k = { marke: 'Probe Marke', gastgeber: 'Petra' };
    for (const ort of Object.keys(SCHRITTE) as BegleiterOrt[]) for (const s of SCHRITTE[ort]) {
      const t = begleiterSaetze(ort, s, k);
      expect(t.length, `${ort}/${s}`).toBeGreaterThan(1);
      expect(t[0]).toBe(vorstellung(k));
      expect(t[0]).toMatch(/KI-Assistentin von Probe Marke/);
    }
  });
  it('ohne Vornamen des Gastgebers in der Wir-Form', () => {
    expect(begleiterSaetze('kontakt', 'formular', { marke: 'M', gastgeber: 'uns' }).join(' ')).toMatch(/Wir lesen jede Nachricht/);
    expect(begleiterSaetze('kontakt', 'formular', { marke: 'M', gastgeber: 'Petra' }).join(' ')).toMatch(/Petra liest jede Nachricht/);
  });
  it('keine Modellaufrufe, kein Abruf aus der Begleiterin, nichts gespeichert', () => {
    for (const d of DATEIEN) {
      const q = ohneKommentare(readFileSync(d, 'utf8'));
      expect(q, d).not.toMatch(/askText|askJson|@\/lib\/anthropic|anthropic|openai|modellSchranke|kiAus/i);
    }
    const komp = ohneKommentare(readFileSync('components/oeffentlich/ZoeBegleiterin.tsx', 'utf8'));
    expect(komp).not.toMatch(/fetch\(|localStorage|sessionStorage|XMLHttpRequest|sendBeacon|WebSocket/);
    const texte = ohneKommentare(readFileSync('lib/oeffentlich/zoe-begleiterin-texte.ts', 'utf8'));
    expect(texte).not.toMatch(/^import /m);
  });
  it('im Check eingehängt — mit eigenen Texten (lib/check/zoe-texte.ts bleibt, wie sie ist)', () => {
    expect(readFileSync('components/check/InnovationsCheck.tsx', 'utf8')).toMatch(/<ZoeBegleiterin ort="check"/);
  });
});
