'use client';

// ─── Fulfillment · Fall — der Kopf (11.10.; seit 17.10. sehr knapp — Miro-Standard) ──────────────────────────────────────────────────────
// Rückmeldung 17.10.: „Es soll nicht überladen sein, sondern sehr klar … es dupliziert sich.“ Bis dahin standen über JEDEM Reiter ein Phasen-Strahl und drei
// Antwort-Kacheln („Wo stehen wir · Als Nächstes · Hängt etwas“) — dasselbe zeigt jetzt die Reise selbst (Hier-Marke, nächster Schritt hervorgehoben,
// Hänger rot markiert). Der Kopf trägt nur noch: zurück, die Ampel mit EINEM Satz (was hängt — aus DERSELBEN Rechnung wie Lage und Cockpit, `wasHaengt`),
// „Der Kunde sieht: …“ NUR, wenn es abweicht (`kundeSiehtLage` mit Grund), und EINEN Knopf „Dem Kunden zeigen“. Name und Kunde stehen im Seitentitel.
// Keine eigenen Schreibwege; ein Tipp auf den Satz springt an den ersten Hänger.

import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Knopf, Punkt } from '../../ui';
import { WEG } from '@/lib/wege';
import { anzahl } from '@/lib/text/zahlwort';
import type { FallReiter } from '@/lib/fulfillment/adresse';
import { useFall, useCockpit } from '../prozesse/daten';
import { kundenAmpel } from '@/lib/fulfillment/prozesse/darstellung';
import type { CockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';
import { AMPEL_FARBE, AMPEL_TEXT } from './bilder';
import { DemKundenZeigen } from './Praesentation';
import { springe, sprungAnker, type Sprung } from './sprung';

/** Wohin ein Sprung führt — gleicher Reiter: Ereignis, sonst Adresse mit Anker. */
export function useFallSprung(mandatId: string, reiter: FallReiter) {
  const router = useRouter();
  return (ziel: FallReiter, s?: Sprung) => {
    if (ziel === reiter) { if (s) springe(s); return; }
    router.push(WEG.fall(mandatId, ziel, s ? sprungAnker(s) : undefined), { scroll: !s });
  };
}

/**
 * Die Ampel mit einem Satz: was intern hängt (`zeile?.haengt`), sonst „läuft rund“. Ohne Zeile (17.10., Gesamtprüfung L2 A2): abgeschlossene Fälle stehen
 * nicht im Cockpit — vorher blieb ihr Kopf auf „Lädt …“; ein Fehler beim Laden steht als Satz da.
 */
export function ampelSatz(zeile: Pick<CockpitZeile, 'health' | 'haengt'> | null, status: 'onboarding' | 'laeuft' | 'pausiert' | 'abgeschlossen', fehler?: string | null): { farbe: string; text: string } {
  const pausiert = status === 'pausiert';
  if (!zeile) return { farbe: C.inkLeise, text: status === 'abgeschlossen' ? 'Der Fall ist abgeschlossen' : pausiert ? 'Der Fall ist pausiert' : fehler ? 'Die Lage ist gerade nicht abrufbar — bitte neu laden' : 'Lädt …' };
  const a = kundenAmpel(zeile);
  const h = zeile.haengt;
  const rot = h.filter(x => x.schwere === 'rot').length;
  const satz = h.length === 1 ? h[0].text : h.length ? `${anzahl(h.length, 'Punkt hängt', 'Punkte hängen')}${rot ? ` · ${rot} dringend` : ''}` : '';
  const text = `${AMPEL_TEXT[a].charAt(0).toUpperCase()}${AMPEL_TEXT[a].slice(1)}${satz ? ` · ${satz}` : ''}${pausiert ? ' · pausiert' : ''}`;
  return { farbe: AMPEL_FARBE[a], text };
}

export function FallKopf({ mandatId, mitKunde = true }: { mandatId: string; mitKunde?: boolean }) {
  const { daten } = useFall(mandatId);
  const cockpit = useCockpit();
  const router = useRouter();
  const f = daten?.fall ?? null;
  // „Hängt etwas?“ aus DERSELBEN Rechnung wie Lage und Cockpit (`wasHaengt`, 15.10., Abnahme B1) — keine eigene Zählung.
  const zeile = cockpit.daten?.zeilen.find(z => z.mandatId === mandatId) ?? null;
  const h = zeile?.haengt ?? [];
  const ampel = f ? ampelSatz(zeile, f.status, cockpit.fehler) : null;
  const k = zeile?.kundeSieht;
  // Was der Kunde liest, nur wenn es abweicht (andere Ampel oder ein Grund) — sonst wäre es doppelt.
  const weicht = !!k && !!zeile && (!!k.grund || k.ampel !== kundenAmpel(zeile));
  const satz = ampel && (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.ink, minWidth: 0, overflowWrap: 'anywhere' }}>
      <Punkt farbe={ampel.farbe} groesse={9} />{ampel.text}{h.length ? ' ›' : ''}
    </span>
  );
  return (
    <div className="ff-fall-kopf" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center', minWidth: 0, flex: '1 1 320px' }}>
        <Knopf leise onClick={() => router.push(WEG.fulfillment())}>‹ Fulfillment</Knopf>
        {satz && (h[0]
          ? <button type="button" className="fassbar" onClick={() => router.push(h[0].href)} aria-label={`${ampel!.text} — zur Stelle`} style={{ background: 'none', border: 'none', padding: 0, minHeight: 44, cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text, minWidth: 0 }}>{satz}</button>
          : satz)}
        {weicht && k && <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim, minWidth: 0, overflowWrap: 'anywhere' }}><Punkt farbe={AMPEL_FARBE[k.ampel]} groesse={7} />Der Kunde sieht: „{k.titel}“{k.grund ? ` (${k.grund})` : ''}</span>}
      </span>
      {mitKunde && f && <DemKundenZeigen mandatId={mandatId} leise />}
    </div>
  );
}
