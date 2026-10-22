'use client';

// ─── Markttraktion › Automationen & Head — der Platz (22.10.) ────────────────────────────────────────────────────────────────────────────
// Kevin 22.10.: „Jeder Bereich hat einen eigenen Automation & Head of Bereich, wo wir die Automatisierungen dem jeweiligen Bereich bauen können wie
// mit den Prozessen.“ Den Baustein (components/os/werkzeug/BereichAutomationen.tsx) baut das gemeinsame Werkzeug-Muster; bis er eingehängt ist, zeigt
// dieser Platz, was hierher gehört — die Prozess-Bereiche und Heads aus `HUB_MENUE.automation` (lib/crm/adresse.ts) — mit dem Weg dorthin.
// ÜBERGANG — wird durch `BereichAutomationen` ersetzt (eine Zeile in components/os/crm/Markttraktion.tsx: `bereich === 'automationen'`).

import { Bot } from 'lucide-react';
import { Leerzustand, Knopf, Chip, LEUCHT } from '../ui';
import { HUB_MENUE } from '@/lib/crm/adresse';
import { PROZESS_BEREICHE } from '@/lib/prozesse/definition';
import { headDef } from '@/lib/agenten/katalog';
import { WEG } from '@/lib/wege';

export function AutomationenPlatz() {
  const a = HUB_MENUE.automation;
  const bereiche = a.prozessBereiche.map(id => PROZESS_BEREICHE.find(b => b.id === id)?.titel ?? id);
  const heads = a.heads.map(id => ({ id, name: headDef(id)?.name ?? id }));
  return (
    <Leerzustand symbol={<Bot size={22} />} titel={a.name} ton={LEUCHT.agenten}
      aktion={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Knopf haupt href={WEG.prozesse()}>Prozess-Landkarte öffnen</Knopf>
        {heads.map(h => <Knopf key={h.id} href={WEG.agenten({ h: h.id })}>{h.name}</Knopf>)}
      </span>}>
      Die Abläufe der Kundengewinnung — {bereiche.join(', ')} — baut und steuert ihr hier bald direkt in der Markttraktion. Bis dahin liegen sie auf der
      Prozess-Landkarte; die Heads erreicht ihr über ihren Chat.
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>{bereiche.map(b => <Chip key={b} farbe={LEUCHT.agenten}>{b}</Chip>)}</span>
    </Leerzustand>
  );
}
