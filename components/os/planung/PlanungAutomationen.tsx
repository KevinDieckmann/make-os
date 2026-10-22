'use client';

// ─── Planung › „Automationen & Head“ (22.10. abends, Werkzeug Planung — lib/make-one/werkzeuge.ts `PLANUNG_WERKZEUG`) ─────────────────────────────────
// Ort: `/os/planung/jahr?s=automationen&space=…` (ein Parameter an der Seite des Jahres, keine eigene Seite). Business: die Ziele & Meilenstein-Kette aus
// „Führung“ und die Heads der Planung (CEO-Office, unter Kapazität Head of Operations); Privat: nur die Persönliche Assistenz — Prozesse gibt es nur im
// Business. Welche Heads, sagt `SEITEN_REGELN` (lib/agenten/kontext-head.ts), nie eine zweite Liste. Der Bereich folgt der Wahl im Kopf bzw. `?space=`.

import { Seite } from '../ui';
import { useSpace } from '@/hooks/useSpace';
import { PLANUNG_WERKZEUG } from '@/lib/make-one/werkzeuge';
import { BereichAutomationen } from '../werkzeug/BereichAutomationen';

export function PlanungAutomationen() {
  const { wahl } = useSpace();
  return (
    <Seite titel="Planung" unter={wahl === 'business' ? 'Die Abläufe von Ziel zu Meilenstein — und die Heads der Planung.' : 'Deine Assistenz für Ziele, Routinen und den Tag.'}>
      <BereichAutomationen werkzeug={PLANUNG_WERKZEUG} space={wahl} />
    </Seite>
  );
}
