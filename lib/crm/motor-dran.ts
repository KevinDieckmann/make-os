// ─── Kundengewinnung: was im Tagesgeschäft auf einen Menschen wartet (rein, getestet — 02.11., Prüfung D) ───────────────────────────────
// Mail-Stapel, Druckliste und Homepage-Funde meldeten sich nur beim Head of Marketing (montags) — im Tagesgeschäft sah niemand, dass Mails auf die
// Freigabe warten, Briefe gedruckt werden wollen oder Funde zu prüfen sind. EINE Rechnung für Glocke (lib/meldungen/regeln.ts, abgeleitet, nie
// gespeichert, die Zahl in der Kennung wie bei `danke`), „Für dich“ (lib/crm/team.ts) und Heute › Steht an (lib/heute/anstehend*.ts):
//   mails   Mail-Entwürfe der Kampagnen im Stapel (Status „entwurf“) — an die Person, die die Kampagne verantwortet (Zuständigkeit, sonst die
//           Verantwortung der Welt aus dem Playbook); freigeben darf jede Person im Haushalt mit eigenem Business-Postfach, der Hinweis geht an die Zuständige
//   briefe  Zeilen der Druckliste (Brief, Status „entwurf“) — ebenso
//   funde   Homepage-Funde „vorbereitet“ — an die Zuständige der Funde-Kampagne, sonst die Marketing-Verantwortung
// Nur Business (Kampagnen sind Markttraktion); Texte neutral — Zahlen, nie Namen, Adressen oder Betreffe.

import type { Kampagne } from './typen';
import { istMeins, zustaendig, BEIDE } from './team';
import { weltDerKampagne } from './kampagnen-welt';
import { markttraktion } from './adresse';

export type MotorDranArt = 'mails' | 'briefe' | 'funde';
export interface MotorDran { id: MotorDranArt; n: number; titel: string; href: string }
export interface MotorPostKurz { kampagneId: string; kanal: string; status: string }

const satz: Record<MotorDranArt, (n: number) => string> = {
  mails: n => `${n} ${n === 1 ? 'Kampagnen-Mail wartet' : 'Kampagnen-Mails warten'} auf Freigabe`,
  briefe: n => `${n} ${n === 1 ? 'Brief' : 'Briefe'} drucken`,
  funde: n => `${n} ${n === 1 ? 'Fund' : 'Funde'} prüfen`,
};

/**
 * Was bei dieser Person wartet. `kampagnen` = alle (auch Papierkorb/Archiv — die fallen hier heraus), `post` = Einträge des Mail-Stapels,
 * `funde` = Homepage-Funde (nur Status), `fundeKampagneId` = die Kampagne der Funde aus deren Einstellungen.
 */
export function motorDranFuer(person: string, kampagnen: readonly Kampagne[], post: readonly MotorPostKurz[], funde: readonly { status: string }[], fundeKampagneId?: string): MotorDran[] {
  const lebend = new Map(kampagnen.filter(k => !k.geloeschtAm && !k.archiviertAm).map(k => [k.id, k]));
  const meine = (id: string) => { const k = lebend.get(id); return !!k && istMeins(k.zustaendig, weltDerKampagne(k), person); };
  const raus: MotorDran[] = [];
  const mailsJe = new Map<string, number>(), briefeJe = new Map<string, number>();
  for (const p of post) {
    if (p.status !== 'entwurf' || !meine(p.kampagneId)) continue;
    if (p.kanal === 'mail') mailsJe.set(p.kampagneId, (mailsJe.get(p.kampagneId) ?? 0) + 1);
    else if (p.kanal === 'brief') briefeJe.set(p.kampagneId, (briefeJe.get(p.kampagneId) ?? 0) + 1);
  }
  // Link: eine Kampagne → ihre Akte (dort stehen Stapel und Druckliste); mehrere → die Kampagnen-Liste.
  const ziel = (je: Map<string, number>) => markttraktion('marketing', 'kampagnen', je.size === 1 ? Array.from(je.keys())[0] : undefined);
  const summe = (je: Map<string, number>) => Array.from(je.values()).reduce((a, x) => a + x, 0);
  if (mailsJe.size) raus.push({ id: 'mails', n: summe(mailsJe), titel: satz.mails(summe(mailsJe)), href: ziel(mailsJe) });
  if (briefeJe.size) raus.push({ id: 'briefe', n: summe(briefeJe), titel: satz.briefe(summe(briefeJe)), href: ziel(briefeJe) });
  const fk = fundeKampagneId ? lebend.get(fundeKampagneId) : undefined;
  const fundeBei = fk ? zustaendig(fk.zustaendig, weltDerKampagne(fk)) : zustaendig(undefined, 'marketing');
  const n = funde.filter(f => f.status === 'vorbereitet').length;
  if (n && (fundeBei === person || fundeBei === BEIDE)) raus.push({ id: 'funde', n, titel: satz.funde(n), href: markttraktion('marketing', 'funde') });
  return raus;
}
