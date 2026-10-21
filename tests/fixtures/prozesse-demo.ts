// ─── Prozesse · erfundene Vorlagen wie in der Demo-Instanz (21.10., Landkarte schön machen) ──────────────────────────────────────────────────
// Die Demo-Saat legt ihre Fulfillment-Vorlagen über die Routen an (lib/demo/fulfillment-prozesse.ts) — für die reinen Tests der Lage stehen hier
// Vorlagen derselben Art und mit denselben Titeln (Hochhaus, Pakete, vertriebsnahe Abläufe): so prüfen die Tests die Landkarte so, wie die Demo sie zeigt.
// Dazu `viele(n)` für die Form der Fliege bei vielen Kacheln. Keine echten Namen, keine Beträge.

import type { ProzessKnoten, ProzessVorlage } from '@/lib/fulfillment/typen';
import { prozessAusVorlage } from '@/lib/prozesse/vorlagen';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import type { KernStufe, ProzessDef } from '@/lib/prozesse/typen';

const basis = (): Pick<ProzessVorlage, 'uebergaenge' | 'rollen' | 'freigaben' | 'fassung' | 'geaendert' | 'geaendertVon'> => ({ uebergaenge: [], rollen: [], freigaben: [], fassung: 1, geaendert: '', geaendertVon: '' });

/** Eine Vorlage mit Wurzel, Phasen und je zwei Schritten. */
function vorlage(id: string, art: ProzessVorlage['art'], titel: string, phasen: string[]): ProzessVorlage {
  const w = `${id}-w`;
  const knoten: ProzessKnoten[] = [{ id: w, titel, rang: 0 }];
  phasen.forEach((ph, i) => {
    const pid = `${id}-p${i}`;
    knoten.push({ id: pid, elternId: w, titel: ph, rang: i, ...(art === 'landkarte' ? { zone: 'etage' as const } : {}) });
    knoten.push({ id: `${pid}-a`, elternId: pid, titel: `${ph}: erster Schritt`, rang: 0 });
    knoten.push({ id: `${pid}-b`, elternId: pid, titel: `${ph}: zweiter Schritt`, rang: 1 });
  });
  return { ...basis(), id, art, titel, knoten };
}

/** Die Vorlagen der Demo-Instanz (Titel wie in lib/demo/fulfillment-prozesse.ts und lib/demo/fulfillment-editor.ts). */
export const DEMO_VORLAGEN: readonly ProzessVorlage[] = [
  vorlage('fp-demo-land', 'landkarte', 'Fulfillment-Landkarte', ['Onboarding', 'Lieferung', 'Abschluss']),
  vorlage('fp-demo-vertrieb', 'paket', 'Vertriebsaufbau', ['Vorlauf', 'Analyse', 'Umsetzung', 'Übergabe']),
  vorlage('fp-demo-cockpit', 'paket', 'Cockpit-Einführung', ['Vorlauf', 'Einrichtung', 'Schulung']),
  vorlage('fp-demo-beispiel', 'paket', 'Beispiel · Vom Konzept zum Start', ['Konzept', 'Start']),
  vorlage('fp-demo-erst', 'ablauf', 'Vom Erstkontakt zum Abschluss', ['Erstkontakt', 'Gespräch', 'Angebot']),
  vorlage('fp-demo-anfrage', 'ablauf', 'Anfrage: passt es?', ['Eingang', 'Prüfen', 'Termin']),
  vorlage('fp-demo-kreis', 'ablauf', 'Vertriebs-Kreislauf', ['Kontakt', 'Gespräch', 'Betreuung']),
  vorlage('fp-demo-messe', 'ablauf', 'Nachfassen nach der Messe', ['Tag 1', 'Tag 7', 'Tag 30']),
];

/** Register + Demo-Vorlagen — so, wie die Landkarte der Demo-Instanz sie bekommt (Reihenfolge wie lib/prozesse/server.ts). */
export function demoProzesse(): ProzessDef[] {
  return [...SYSTEM_PROZESSE, ...DEMO_VORLAGEN.map(prozessAusVorlage).filter((p): p is ProzessDef => !!p)];
}

/** `n` erfundene Kern-Prozesse einer Stufe (für die Form der Fliege bei vielen Kacheln). */
export function viele(n: number, stufe: KernStufe, praefix: string = stufe): ProzessDef[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${praefix}-${i}`, titel: `${stufe === 'marketing' ? 'Kampagne' : stufe === 'sales' ? 'Vertriebsweg' : stufe === 'ausbau' ? 'Ausbau' : 'Lieferpaket'} ${i + 1}`,
    quelle: 'vorlage' as const, band: 'kern' as const, stufe,
    steckbrief: { ausloeser: 'Start', eingang: 'Eingang', ergebnis: 'Ergebnis', empfaenger: 'Kunde', eigner: 'Rolle' },
    phasen: [{ id: 'a', titel: 'Phase', schritte: [{ id: 's', titel: 'Schritt', form: 'schritt' as const }] }],
  }));
}
