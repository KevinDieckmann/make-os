// ─── Wächter: Medien-Werkzeuge hängen in der EINEN Agenten-Schleife (Merge 4a/4c, 09.10.) ─────────────────────────────
// Paket 4c hat die Medien-Werkzeuge gebaut, Paket 4a die Schleife — eingehängt werden sie in `agentLauf` (lib/agenten/gespraech.ts):
// angeboten nur über `medienAngebotErgaenzen` (Bereich, Head, Schalter), nie im Trockenlauf/„nur lesen“, ausgeführt über `medienWerkzeugAusfuehren`.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { medienWerkzeugeFuer } from '@/lib/agenten/medien-werkzeuge';

const quelle = readFileSync(join(__dirname, '..', 'lib', 'agenten', 'gespraech.ts'), 'utf8');
const AN = { hintergrund: true, websuche: true, bereiche: { crm: true, kalender: true, aufgaben: true, finanzen: true, brain: true, familie: true }, bilder: true };
const AUS = { ...AN, bilder: false };

describe('Medien-Werkzeuge in der Agenten-Schleife', () => {
  it('agentLauf bietet sie über medienAngebotErgaenzen an — nie im Trockenlauf oder „nur lesen“', () => {
    expect(quelle).toMatch(/if \(!e\.nurLesen && !e\.trocken\) medienAngebotErgaenzen\(/);
    expect(quelle).toMatch(/istMedienWerkzeug\(wname\)[\s\S]{0,200}medienWerkzeugAusfuehren\(/);
  });
  it('Head Marketing bekommt medien_suchen; ein Privat-Head nie; bild_bearbeiten nur mit Schalter „Bilder an die KI“', () => {
    expect(medienWerkzeugeFuer({ art: 'head', head: { id: 'marketing', bereich: 'business' }, schalter: AN })).toContain('medien_suchen');
    expect(medienWerkzeugeFuer({ art: 'head', head: { id: 'assistenz', bereich: 'privat' }, schalter: AN })).toEqual([]);
    const mitSchalter = medienWerkzeugeFuer({ art: 'mitarbeiter', head: { id: 'marketing', bereich: 'business' }, mitarbeiter: { id: 'marketing-bild-video' }, schalter: AN });
    const ohne = medienWerkzeugeFuer({ art: 'mitarbeiter', head: { id: 'marketing', bereich: 'business' }, mitarbeiter: { id: 'marketing-bild-video' }, schalter: AUS });
    expect(mitSchalter).toContain('bild_bearbeiten');
    expect(ohne).not.toContain('bild_bearbeiten');
  });
});
