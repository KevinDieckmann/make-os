// ─── Werkzeug-Verträge: das Register aller Werkzeuge (10.10., Paket V3, AGENTEN_KONZEPT_V2.md C3/T1) — nur Server ──────────────────────────
// EIN Vertrag je Werkzeug, zusammengesetzt aus den Stellen, an denen das jeweilige Wissen schon steht — nichts wird doppelt gepflegt:
//   Eingabe-Schema   lib/zoe/werkzeug-defs.ts `werkzeugDefs` (Register-Werkzeuge und run_agent; dieselbe Beschreibung, die das Modell sieht),
//                    `openAgentDef`, lib/agenten/werkzeuge.ts `agentenDefs`, MEDIEN_DEFS, WISSEN_DEF, UNTERLAGEN_DEF, RECHT_DEFS (Agenten-Werkzeuge),
//                    FULFILLMENT_ANALYSE_DEFS (Analyse-Strecke, lib/fulfillment/analyse/werkzeug-defs.ts — nur der Analyse-Handler bietet sie an).
//                    Schemas mit Listen, die erst zur Laufzeit feststehen (Heads, Fach-Agenten), bekommen hier die VOLLE Liste (Katalog,
//                    AUSFUEHRBAR) — wer sie wirklich nutzen darf, prüft das Werkzeug selbst; Mitarbeiter-Kennungen bleiben offen (leere enum).
//   Gruppe, Stufe    lib/zoe/register.ts (`gruppeVon`, `risikoVon`, je Aufruf `risikoFuerAufruf`).
//   Rechteklasse,    lib/werkzeuge/einordnung.ts (die EINE Zeile je Werkzeug; LESEND, FREMD_WERKZEUGE, SELBST_GEKAPSELT, WERKZEUG_KATEGORIE werden
//   Fremd, Kapselung daraus abgeleitet).
//   KI-Kategorie     lib/datenschutz/ki-werkzeuge.ts `kategorieVonWerkzeug` (Gruppe, Ausnahme aus der Einordnung).
//   Bereich          aus der Einordnung, sonst aus der Gruppe: lib/zoe/bereich.ts BUSINESS_GRUPPEN/PRIVAT_GRUPPEN (dieselbe Liste, die Vorschläge im
//                    Stapel einordnet) und lib/arbeitsrahmen/regel.ts ZOE_BUSINESS_GRUPPEN (Finanzen = Business-Gesellschaften).
// Gebaut beim ersten Aufruf (nicht beim Laden des Moduls — die Quellen importieren sich zum Teil gegenseitig).

import { WERKZEUGE } from '@/lib/zoe/werkzeuge';
import { gruppeVon, risikoVon } from '@/lib/zoe/register';
import { werkzeugDefs, openAgentDef, type WerkzeugDef } from '@/lib/zoe/werkzeug-defs';
import { kategorieVonWerkzeug } from '@/lib/datenschutz/ki-werkzeuge';
import { BUSINESS_GRUPPEN, PRIVAT_GRUPPEN } from '@/lib/zoe/bereich';
import { ZOE_BUSINESS_GRUPPEN } from '@/lib/arbeitsrahmen/regel';
import { AUSFUEHRBAR } from '@/lib/zoe/agenten';
import { KATALOG } from '@/lib/agenten/katalog';
import { agentenDefs } from '@/lib/agenten/werkzeuge';
import { MEDIEN_DEFS } from '@/lib/agenten/medien-werkzeuge';
import { WISSEN_DEF } from '@/lib/agenten/wissen-werkzeug';
import { UNTERLAGEN_DEF } from '@/lib/agenten/unterlagen-werkzeug';
import { RECHT_DEFS } from '@/lib/agenten/recht-werkzeuge';
import { FULFILLMENT_ANALYSE_DEFS } from '@/lib/fulfillment/analyse/werkzeug-defs';
import { EINORDNUNG } from './einordnung';
import type { WerkzeugBereich, WerkzeugVertrag } from './vertrag';

/** Bereich aus der Gruppe (rein): Business-Gruppen → business, Privat-Gruppen → privat, sonst beide. */
export function bereichAusGruppe(gruppe: string): WerkzeugBereich {
  if (BUSINESS_GRUPPEN.has(gruppe) || ZOE_BUSINESS_GRUPPEN.has(gruppe)) return 'business';
  if (PRIVAT_GRUPPEN.has(gruppe)) return 'privat';
  return 'beide';
}

let gebaut: ReadonlyMap<string, WerkzeugVertrag> | null = null;

function bauen(): ReadonlyMap<string, WerkzeugVertrag> {
  const zoeDefs = werkzeugDefs({ agenten: [...AUSFUEHRBAR], heads: KATALOG.map(h => ({ id: h.id, kurz: h.kurz, name: h.name })) });
  const oa = openAgentDef();
  const agentDefs: Record<string, WerkzeugDef> = {
    ...agentenDefs({ mitarbeiter: [], headWerkzeuge: [] }),
    ...MEDIEN_DEFS,
    [WISSEN_DEF.name]: WISSEN_DEF,
    [UNTERLAGEN_DEF.name]: UNTERLAGEN_DEF,
    ...RECHT_DEFS,
    ...FULFILLMENT_ANALYSE_DEFS,
  };
  const m = new Map<string, WerkzeugVertrag>();
  for (const [name, e] of Object.entries(EINORDNUNG)) {
    const def = e.herkunft === 'agent' ? agentDefs[name] : name === 'open_agent' ? oa : zoeDefs.get(name);
    if (!def) continue; // kein Schema → kein Vertrag (der Wächter meldet es)
    if (e.herkunft === 'zoe' && !WERKZEUGE[name]) continue;
    const gruppe = e.herkunft === 'zoe' ? gruppeVon(name) : e.herkunft === 'steuerung' ? 'agenten' : 'agenten-bereich';
    m.set(name, {
      name, herkunft: e.herkunft, eingabe: def.input_schema, rechteklasse: e.rechte,
      risiko: e.herkunft === 'zoe' ? risikoVon(name) : 'frei',
      bereich: e.bereich ?? (e.herkunft === 'zoe' ? bereichAusGruppe(gruppe) : 'beide'),
      kategorie: kategorieVonWerkzeug(name, gruppe),
      fremd: e.fremd ?? null,
      gekapselt: !!e.gekapselt,
      gruppe,
    });
  }
  return m;
}

/** Alle Verträge (einmal gebaut). */
export function vertraege(): ReadonlyMap<string, WerkzeugVertrag> {
  if (!gebaut) gebaut = bauen();
  return gebaut;
}

/** Der Vertrag eines Werkzeugs — oder null (dann läuft es nicht). */
export const vertragVon = (name: string): WerkzeugVertrag | null => vertraege().get(name) ?? null;

/**
 * Alle Namen, die einen Vertrag brauchen (für den Wächter): jedes Register-Werkzeug, die ZOE-Steuerung und jedes Agenten-Werkzeug.
 * Fehlt einem davon der Vertrag, läuft es nicht (`fuehreAus` lehnt ab) — und tests/werkzeug-vertraege.test.ts wird rot.
 */
export function werkzeugeMitVertragspflicht(): string[] {
  const oa = openAgentDef();
  return Array.from(new Set([
    ...Object.keys(WERKZEUGE),
    'run_agent', ...(oa ? ['open_agent'] : []),
    ...Object.keys(agentenDefs({ mitarbeiter: [], headWerkzeuge: [] })),
    ...Object.keys(MEDIEN_DEFS), WISSEN_DEF.name, UNTERLAGEN_DEF.name, ...Object.keys(RECHT_DEFS), ...Object.keys(FULFILLMENT_ANALYSE_DEFS),
  ])).sort();
}
