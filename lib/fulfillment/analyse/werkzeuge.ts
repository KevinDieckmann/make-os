// ─── Fulfillment · Analyse — Ausführung der drei Agenten-Werkzeuge (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.9) — nur Server ──────────────────────
// Jeder Aufruf läuft durch die Hülle der Werkzeug-Verträge (lib/werkzeuge/huelle.ts): `vertragsPruefung` (Vertrag, Bereich, Schema — mit dem Schema,
// das in DIESEM Lauf angeboten war) → Ausführung → `ausgangVermerken`. Angeboten werden NUR die Werkzeuge des Agenten (lib/fulfillment/analyse/agenten.ts);
// ein anderer Name → abgelehnt. Alle drei LESEN nur und kapseln ihre Antwort selbst (Kopfzeile außerhalb, Inhalt in `fremd()`):
//   web_lesen        öffentliche Seiten mit Schutz (lib/fulfillment/analyse/web-lesen.ts)
//   fall_unterlagen  NUR freigegebene Unterlagen und die Playbook-Antworten DIESES Mandats (über die Schnittstelle von C2)
//   dossier_teile    fertige Abschnitte DIESES Dossiers; den Personenteil nur für A11–A13 (nur Funktion, Identität und Angaben — nie Namen);
//                    den Leseteil (Tiefenbericht) NIE — er steht nicht im Dossier.

import { fremd } from '@/lib/anthropic';
import { vertragsPruefung, ausgangVermerken } from '@/lib/werkzeuge/huelle';
import { fehlschlag, erfolg, type WerkzeugErgebnis } from '@/lib/werkzeuge/vertrag';
import type { KiKategorie } from '@/lib/datenschutz/ki-einstellungen';
import type { AufrufErgebnis, Aufruf } from '@/lib/agenten/schleife';
import type { AnalyseAgentId, Dossier, PersonenKarte } from '../typen';
import { AGENTEN, type AnalyseWerkzeug } from './agenten';
import { FULFILLMENT_ANALYSE_DEFS } from './werkzeug-defs';
import { webLesen, teilVon, type WebLauf } from './web-lesen';

export interface WerkzeugLauf {
  agent: AnalyseAgentId;
  mandatId: string;
  web: WebLauf;
  /** Das Dossier, wie es JETZT im Bestand steht (frisch gelesen je Aufruf). */
  dossier: () => Promise<Dossier | null>;
  karten: () => Promise<PersonenKarte[]>;
}

const QUELLE: Record<AnalyseWerkzeug, string> = { web_lesen: 'web', fall_unterlagen: 'mandat-unterlagen', dossier_teile: 'dossier' };
const KATEGORIE: Record<AnalyseWerkzeug, KiKategorie> = { web_lesen: 'web', fall_unterlagen: 'crm', dossier_teile: 'crm' };
const LIEST_PERSONEN: ReadonlySet<AnalyseAgentId> = new Set(['a11', 'a12', 'a13']);

/** Die Werkzeug-Definitionen, die DIESER Agent bekommt (für die Schleife). */
export const werkzeugeFuer = (agent: AnalyseAgentId) => AGENTEN[agent].werkzeuge.map(w => FULFILLMENT_ANALYSE_DEFS[w]);

async function fallUnterlagen(eingabe: { unterlage?: unknown; teil?: unknown }, l: WerkzeugLauf): Promise<WerkzeugErgebnis> {
  const kunde = await import('../kunde/server');
  if (typeof eingabe.unterlage === 'string') {
    const freigegeben = (await kunde.unterlagenFuer(l.mandatId)).filter(u => u.status === 'freigegeben');
    if (!freigegeben.some(u => u.id === eingabe.unterlage)) return fehlschlag('nicht_gefunden', 'Nicht gelesen: diese Unterlage gibt es nicht oder sie ist (noch) nicht freigegeben.');
    const t = await kunde.unterlageText(l.mandatId, eingabe.unterlage);
    if (!t.ok) return fehlschlag('nicht_gefunden', `Nicht gelesen: ${t.fehler}`);
    const p = teilVon(t.text, typeof eingabe.teil === 'number' ? eingabe.teil : 1);
    return erfolg(`Unterlage ${eingabe.unterlage} · ${t.text.length.toLocaleString('de-DE')} Zeichen${p.teile > 1 ? ` · Teil ${p.teil} von ${p.teile}` : ''}${t.gekuerzt ? ' · (gekürzt geliefert)' : ''}\n${fremd('mandat-unterlagen', p.inhalt)}`);
  }
  const [unterlagen, formulare, vorlagen] = await Promise.all([
    kunde.unterlagenFuer(l.mandatId), kunde.formularAntwortenFuer(l.mandatId),
    import('../speicher').then(s => s.fulfillmentLesen('vorlagen')).catch(() => null),
  ]);
  const frei = unterlagen.filter(u => u.status === 'freigegeben');
  const frageText = (bausteinId: string, frageId: string) => vorlagen?.bausteine.find(b => b.id === bausteinId)?.fragen?.find(f => f.id === frageId)?.frage ?? frageId;
  const zeilen = [
    'Freigegebene Unterlagen:', ...(frei.length ? frei.map(u => `- ${u.id} · ${u.name} · Zweck ${u.zweck}`) : ['- keine']),
    '', 'Antworten im Kunden-Playbook:',
    ...(formulare.length ? formulare.flatMap(f => Object.entries(f.antworten).filter(([, a]) => a.trim()).map(([id, a]) => `- ${frageText(f.bausteinId, id)}: ${a}`)) : ['- keine']),
  ];
  const p = teilVon(zeilen.join('\n'), typeof eingabe.teil === 'number' ? eingabe.teil : 1);
  return erfolg(`Mandat-Unterlagen: ${frei.length} freigegeben · ${formulare.length} Formular(e)${p.teile > 1 ? ` · Teil ${p.teil} von ${p.teile}` : ''}\n${fremd('mandat-unterlagen', p.inhalt)}`);
}

async function dossierTeile(eingabe: { abschnitt?: unknown }, l: WerkzeugLauf): Promise<WerkzeugErgebnis> {
  const d = await l.dossier();
  if (!d) return fehlschlag('nicht_gefunden', 'Nicht gelesen: kein Dossier.');
  if (eingabe.abschnitt === 'personen') {
    if (!LIEST_PERSONEN.has(l.agent)) return fehlschlag('rechte', 'Nicht gelesen: den Personenteil lesen nur der Risiko-, Redaktions- und Prüfer-Agent.');
    const karten = (await l.karten()).filter(k => k.mandatId === l.mandatId);
    const z = karten.map(k => [
      `Karte ${k.id} · Funktion: ${k.funktion} · Identität ${k.identitaet} · Status ${k.status}${k.rolleSeit ? ` · Rolle seit ${k.rolleSeit}` : ''}`,
      ...(['werdegang', 'themen', 'auftritte', 'aufhaenger'] as const).flatMap(t => k[t].map(a => `  [${t}] (${a.id}; Quellen ${a.quellen.join(', ') || '—'}) ${a.text}`)),
    ].join('\n'));
    return erfolg(`Personenteil: ${karten.length} Karte(n) — nur Funktion und berufliche Angaben\n${fremd('dossier', z.join('\n\n') || '(keine Karten)')}`);
  }
  const teile = Object.values(d.abschnitte).filter(a => a && a.aussagen.length && (eingabe.abschnitt === undefined || a.id === eingabe.abschnitt));
  const quellen = new Map(d.quellen.map(q => [q.id, q]));
  const genutzt = new Set(teile.flatMap(a => a!.aussagen.flatMap(x => x.quellen)));
  const text = [
    ...teile.map(a => [`## ${a!.id} (${a!.status})`, ...a!.aussagen.map(x => `- (${x.id}; ${x.art}; Stand ${x.stand}; Quellen ${x.quellen.join(', ') || '—'}${x.personRef ? `; Person ${x.personRef}` : ''}) ${x.text}`)].join('\n')),
    '## Quellen', ...[...genutzt].map(id => quellen.get(id)).filter(Boolean).map(q => `- ${q!.id}: ${q!.url ?? `Unterlage ${q!.unterlageId}`} (abgerufen ${q!.abgerufenAm})`),
  ].join('\n\n');
  const p = teilVon(text, 1);
  return erfolg(`Dossier: ${teile.length} Abschnitt(e) mit Aussagen${p.teile > 1 ? ` · gekürzt auf Teil 1 von ${p.teile} — frag einzelne Abschnitte ab` : ''}\n${fremd('dossier', p.inhalt || '(noch keine Aussagen)')}`);
}

/** EIN Aufruf aus der Schleife → Ergebnis für das Modell. Wirft nie (die Schleife fängt zusätzlich). */
export async function analyseWerkzeug(a: Aufruf, l: WerkzeugLauf): Promise<AufrufErgebnis> {
  const erlaubt = AGENTEN[l.agent].werkzeuge as readonly string[];
  const name = a.name as AnalyseWerkzeug;
  if (!erlaubt.includes(a.name)) {
    const e = ausgangVermerken(a.name, fehlschlag('rechte', `Nicht ausgeführt: „${a.name.slice(0, 60)}“ ist für diesen Agenten nicht freigegeben.`));
    return { inhalt: e.meldung, ok: false, fortschritt: false };
  }
  const p = vertragsPruefung(name, a.input, { sicht: 'business', schema: FULFILLMENT_ANALYSE_DEFS[name].input_schema });
  if (!p.ok) return { inhalt: ausgangVermerken(name, p.ergebnis).meldung, ok: false, fortschritt: false };
  let r: WerkzeugErgebnis;
  try {
    r = name === 'web_lesen' ? await webLesen(a.input, l.web) : name === 'fall_unterlagen' ? await fallUnterlagen(a.input, l) : await dossierTeile(a.input, l);
  } catch {
    r = fehlschlag('intern', `Fehlgeschlagen: ${name} ist mit einem internen Fehler abgebrochen.`);
  }
  const e = ausgangVermerken(name, r);
  return { inhalt: e.meldung, ok: e.ok, quelle: QUELLE[name], kategorien: [KATEGORIE[name]] };
}
