// ─── Markttraktion · Planung — der Kreislauf als Reise-Zeile (17.10., Kevins Miro-Standard für das ganze System) ─────────────────────────────────
// Kevin 17.10.: „Markttraktion-Kreislauf, Onboarding und Planung bekommen dieselbe Reise- und Ablauf-Darstellung.“ Die sieben Stufen des Kreislaufs
// (Leadkanäle → Leads & Qualifizierung → Deals → Abschluss & Follow-up → Fulfillment → Nach der Leistung → Wiederkauf) als EINE Zeile: je Stufe ihre Zahl
// mit Wort und die kurzen Sätze (`zusatz`) bzw. nächsten Schritte als Kästchen; das Band „Kunde“ läuft gestrichelt, solange er noch keiner ist, und ab
// `KUNDE_AB` (Fulfillment) durchgezogen. Ein Kreislauf hat kein „Hier“ — alle Stufen laufen zugleich (`laeuft`, in der Farbe ihrer Welt).
// Rein, client-sicher: rechnet NICHTS neu — alle Zahlen und Sätze kommen unverändert aus lib/crm/planung.ts `kreislauf`; hier wird nur übersetzt.

import { KAESTCHEN_MAX, type BildKaestchen, type BildSpalte } from '@/lib/reise/bild';
import type { Kreislauf, KreislaufId, KreislaufStufe } from './planung';

/** Ab dieser Stufe ist er Kunde — das Band „Kunde“ läuft ab hier durchgezogen. */
export const KUNDE_AB: KreislaufId = 'fulfillment';
/** Der Satz im Band ab `KUNDE_AB` (vorher gestrichelt ohne Satz). */
export const KUNDE_BAND: Partial<Record<KreislaufId, string>> = { fulfillment: 'ab hier Kunde', nachher: 'bleibt Kunde', wiederkauf: 'kauft wieder' };

/**
 * Die Kästchen einer Stufe: die Zahl mit ihrem Wort, dann die Sätze des Zusatzes (bei den Leadkanälen sagt der Zusatz dasselbe wie „Plan“ — dann nur einmal).
 * Hängt die Stufe (überfällige Follow-ups), trägt ihr Satz die rote Kante.
 */
export function kreislaufKaestchen(s: KreislaufStufe, einheit: string): BildKaestchen[] {
  const zahl: BildKaestchen = { id: `${s.id}-zahl`, titel: `${s.anzahl.toLocaleString('de-DE')} ${einheit}`.trim(), zustand: 'offen' };
  const saetze = s.id === 'kanaele' && s.plan ? [] : s.zusatz.split(' · ').map(t => t.trim()).filter(Boolean);
  return [zahl, ...saetze.map((t, i): BildKaestchen => ({ id: `${s.id}-z${i}`, titel: t, zustand: 'offen', ...(s.haengt ? { haengt: s.haengt } : {}) }))];
}

/** Der Kreislauf als Reise-Zeile — `einheit` = Wort unter der Zahl je Stufe, `farbe` = Farbe der Welt je Stufe (aus der Oberfläche). */
export function kreislaufSpalten(k: Pick<Kreislauf, 'stufen'>, einheit: Readonly<Record<KreislaufId, string>>, farbe?: (id: KreislaufId) => string): BildSpalte[] {
  const ab = k.stufen.findIndex(s => s.id === KUNDE_AB);
  return k.stufen.map((s, i): BildSpalte => {
    const alle = kreislaufKaestchen(s, einheit[s.id] ?? '');
    const zeigen = alle.slice(0, KAESTCHEN_MAX);
    const kunde = ab >= 0 && i >= ab;
    return {
      id: s.id, nr: i + 1, titel: s.label, zustand: 'laeuft', kaestchen: zeigen, mehr: alle.length - zeigen.length,
      ...(farbe ? { farbe: farbe(s.id) } : {}), ...(s.haengt ? { haengt: s.haengt } : {}),
      band: kunde ? { ...(KUNDE_BAND[s.id] ? { text: KUNDE_BAND[s.id] } : {}) } : { intern: true },
    };
  });
}
