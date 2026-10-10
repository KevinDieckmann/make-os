// ─── Fulfillment · Analyse — ZOE-Werkzeug `fulfillment_lage` (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.9) — nur Server ─────────────────────────
// Entscheidung 10.10. („alle Daten in der KI“): eine LESE-Tür für ZOE auf Fulfillment eines Mandats — Fall (Status, Fortschritt, was wartet), Onboarding-Stand,
// Wert-Konto, Dossier (Unternehmensteil mit Quellen, Diagnose-Entwurf, Freigaben). Regeln:
//   · nur eine Person im Haushalt des Inhabers, nur Mandate von Business-Gesellschaften (Gruppe `crm`, Bereich Business)
//   · den Personenteil NUR mit `mitPersonen: true` UND wenn die Person ihn sehen darf (Inhaber oder Mitglied ohne „nur Business“)
//   · den Leseteil (Tiefenbericht) NIE — er steht nicht im Dossier, und dieses Modul liest ihn nicht
//   · Kopfzeile (nur Kennungen/Zahlen) außerhalb, alles Inhaltliche in `fremd('fulfillment', …)`; über 30.000 Zeichen „Teil x von y“.

import { fremd } from '@/lib/anthropic';
import { erfolg, fehlschlag, type WerkzeugRueckgabe } from '@/lib/werkzeuge/vertrag';
import { fulfillmentLesen } from '../speicher';
import { wertKontoZeilen } from '../regeln';
import { teilVon } from './web-lesen';
import { laufStatusAnzeige } from './agenten';

const KEINE_PERSON = 'Nicht ausgeführt: Dieses Werkzeug braucht eine angemeldete Person (kein Systemlauf).';
const KEIN_ZUGANG = 'Nicht ausgeführt: Fulfillment gehört zum Haushalt des Inhabers — für dieses Konto nicht verfügbar.';

/** Darf die Person den Personenteil sehen (dieselbe Regel wie `personenteilZugang`)? */
export async function personenteilErlaubt(person: string): Promise<boolean> {
  const { istInhaber, personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  if (!(await personImHaushaltDesInhabers(person))) return false;
  if (await istInhaber(person)) return true;
  const { kontoSicht } = await import('@/lib/zugang/konto-sicht-server');
  const k = await kontoSicht(person);
  return !!k && !k.nurBusiness && k.imHaushalt;
}

export async function fulfillmentLage(input: Record<string, unknown>, _origin: string, person?: string): Promise<WerkzeugRueckgabe> {
  if (!person) return fehlschlag('rechte', KEINE_PERSON);
  const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  if (!(await personImHaushaltDesInhabers(person))) return fehlschlag('rechte', KEIN_ZUGANG);
  const [{ ladeCrm }, { bereichVonGesellschaft }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/einheiten')]);
  const crm = await ladeCrm();
  const business = crm.mandate.filter(m => bereichVonGesellschaft(m.gesellschaft) === 'business');
  const frage = typeof input.mandat === 'string' ? input.mandat.trim().toLowerCase() : '';
  const [dossiers, personen] = await Promise.all([fulfillmentLesen('dossiers'), fulfillmentLesen('personen')]);
  if (!frage) {
    const mitDossier = business.filter(m => dossiers.dossiers[m.id]);
    const liste = business.slice(0, 60).map(m => `- ${m.id} · ${m.titel} · ${m.kunde} · Status ${m.status}${dossiers.dossiers[m.id] ? ' · Dossier vorhanden' : ''}`).join('\n');
    return erfolg(`Fulfillment: ${business.length} Mandat(e), ${mitDossier.length} mit Dossier — für Details \`mandat\` angeben.\n${fremd('fulfillment', liste || '(keine Mandate)')}`);
  }
  const m = business.find(x => x.id.toLowerCase() === frage) ?? business.find(x => `${x.titel} ${x.kunde}`.toLowerCase().includes(frage));
  if (!m) return fehlschlag('nicht_gefunden', 'Nicht gefunden: kein Business-Mandat passt dazu.');
  const { fallLesen, faelleKurz } = await import('../prozesse/server');
  const [fall, kurz] = await Promise.all([fallLesen(m.id).catch(() => null), faelleKurz([m.id]).catch(() => ({} as Record<string, never>))]);
  const d = dossiers.dossiers[m.id];
  const z: string[] = [`Mandat: ${m.titel} · Kunde ${m.kunde} · Status ${m.status}`];
  const fk = (kurz as Record<string, { status?: string; fortschritt?: number; naechster?: string; wartet?: number; onboardingOffen?: number }>)[m.id];
  z.push(fall ? `Fall: ${fall.status}${fk ? ` · Fortschritt ${fk.fortschritt ?? 0} % · nächster Schritt ${fk.naechster ?? '—'} · wartet auf Kunde ${fk.wartet ?? 0} · Onboarding offen ${fk.onboardingOffen ?? 0}` : ''}` : 'Fall: noch nicht gestartet.');
  const wk = wertKontoZeilen(fall, m);
  if (wk.length) z.push('Wert-Konto:', ...wk.map(w => `- ${w.name}: vorher ${w.vorher} → jetzt ${w.jetzt} → Ziel ${w.ziel}${w.bis ? ` bis ${w.bis}` : ''}`));
  if (fall?.quickWins.length) z.push('Quick Wins:', ...fall.quickWins.map(q => `- ${q.text} (bis ${q.bis}${q.erledigtAm ? ', erledigt' : ''})`));
  if (!d) z.push('Dossier: noch keins.');
  else {
    const jetzt = Date.now();
    z.push(`Dossier: F1 ${d.f1 ? 'ja' : 'nein'} · F2 ${d.f2 ? 'ja' : 'nein'} · Prüfung ${d.pruefung ? (d.pruefung.bestanden ? 'bestanden' : 'offen') : '—'} · Läufe: ${d.laeufe.map(l => `${l.agent.toUpperCase()} ${laufStatusAnzeige(l, jetzt)}`).join(', ') || '—'}`);
    const q = new Map(d.quellen.map(x => [x.id, x]));
    for (const a of Object.values(d.abschnitte)) {
      if (!a?.aussagen.length) continue;
      z.push(`## ${a.id} (${a.status})`, ...a.aussagen.map(x => `- [${x.art}] ${x.text}${x.quellen.length ? ` (Quelle: ${x.quellen.map(id => q.get(id)?.url ?? (q.get(id)?.unterlageId ? `Unterlage ${q.get(id)!.unterlageId}` : id)).join(', ')})` : ''}`));
    }
    if (d.diagnose) {
      z.push('## Diagnose-Entwurf', ...d.diagnose.top5.map(x => `- Maßnahme (${x.hebel}, Aufwand ${x.aufwand}, Evidenz ${x.evidenz}): ${x.text}`), ...d.diagnose.quickWins.map(x => `- Quick Win: ${x}`), ...d.diagnose.fragen.map(x => `- Frage an ${x.an}: ${x.frage}`));
    }
  }
  let personenZahl = 0;
  if (input.mitPersonen === true) {
    if (!(await personenteilErlaubt(person))) z.push('Personenteil: für dieses Konto nicht freigegeben.');
    else {
      const karten = personen.karten.filter(k => k.mandatId === m.id);
      personenZahl = karten.length;
      z.push('## Personenteil (nur beruflich)', ...karten.map(k => `- ${k.funktion}: ${k.name} · Identität ${k.identitaet} · ${k.status}\n  ${[...k.werdegang, ...k.themen, ...k.auftritte, ...k.aufhaenger].map(a => a.text).join(' · ')}`));
    }
  }
  const t = teilVon(z.join('\n'), typeof input.teil === 'number' ? input.teil : 1);
  return erfolg(`Fulfillment ${m.id}: ${d ? Object.values(d.abschnitte).reduce((s, a) => s + (a?.aussagen.length ?? 0), 0) : 0} Aussage(n)${personenZahl ? ` · ${personenZahl} Personenkarte(n)` : ''}${t.teile > 1 ? ` · Teil ${t.teil} von ${t.teile}` : ''}\n${fremd('fulfillment', t.inhalt)}`);
}
