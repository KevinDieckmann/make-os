// Paket D-A (29.09., #23): Die CRM-Säuberer sind Weißlisten — ein neues Feld im Typ, das der Säuberer nicht kennt,
// ist nach der nächsten Browser-Änderung still weg (so schon passiert, lib/crm/speicher.ts). Dieser Wächter liest
// die Typen (lib/crm/typen.ts, lib/make-one/crm.ts) mit dem TypeScript-Parser und prüft je Feld, dass der
// zuständige Säuberer es nennt. Neues Feld → im Säuberer übernehmen ODER hier mit Grund als Ausnahme eintragen.
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

function quelle(datei: string) { return ts.createSourceFile(datei, readFileSync(datei, 'utf8'), ts.ScriptTarget.Latest, true); }
function felderVon(q: ts.SourceFile, typ: string): string[] {
  let f: string[] = [];
  q.forEachChild(n => { if (ts.isInterfaceDeclaration(n) && n.name.text === typ) f = n.members.filter(m => m.name).map(m => m.name!.getText(q).replace(/['"]/g, '')); });
  return f;
}
function funktion(q: ts.SourceFile, name: string): string {
  let t = '';
  q.forEachChild(n => { if (ts.isFunctionDeclaration(n) && n.name?.text === name) t = n.getText(q); });
  return t;
}
const nennt = (text: string, feld: string) => new RegExp(`\\b${feld}\\b`).test(text);

// Felder, die nicht der Säuberer der Liste setzt — mit Grund.
const UEBERALL: Record<string, string> = {
  geaendertVon: 'setzt saeubern() selbst (die schreibende Person), nie aus dem Netz',
  archiviertAm: 'Archiv-Marke (04.10.) — übernimmt saeubern() für jede Liste über ablageZusatz() (lib/crm/ablage.ts), Zeit vom Server',
  geloeschtAm: 'Papierkorb-Marke (04.10.) — übernimmt saeubern() über ablageZusatz() bzw. leistung() (Produkte), Zeit vom Server',
};

describe('CRM-Säuberer kennen jedes Typ-Feld (#23)', () => {
  const typen = quelle('lib/crm/typen.ts');
  const speicher = quelle('lib/crm/speicher.ts');
  const zusatz = funktion(speicher, 'zusatz');
  const LISTEN: [string, string][] = [
    ['firma', 'Firma'], ['chance', 'Chance'], ['mandat', 'Mandat'], ['leistung', 'Leistung'], ['event', 'Event'], ['teilnahme', 'Teilnahme'],
    ['sitzung', 'PowerHourSitzung'], ['antrag', 'Antrag'], ['verarbeitung', 'Verarbeitung'], ['segment', 'Segment'], ['beitrag', 'Beitrag'],
    ['ausgabe', 'NewsletterAusgabe'], ['kampagne', 'Kampagne'], ['followup', 'FollowUp'],
  ];
  for (const [fn, typ] of LISTEN) {
    it(`${typ} ↔ ${fn}()`, () => {
      const text = funktion(speicher, fn);
      expect(text.length, `Säuberer ${fn} nicht gefunden`).toBeGreaterThan(0);
      const felder = felderVon(typen, typ);
      expect(felder.length, `Typ ${typ} nicht gefunden`).toBeGreaterThan(0);
      const fehlt = felder.filter(f => !UEBERALL[f] && !nennt(text, f) && !nennt(zusatz, f) && !(f === 'zustaendig' && /\bzst\(/.test(text)));
      expect(fehlt, `${typ}: diese Felder kennt der Säuberer ${fn}() nicht — übernehmen oder als Ausnahme mit Grund eintragen`).toEqual([]);
    });
  }
  it('Kontakt ↔ saeubereKontakt()', () => {
    const crm = quelle('lib/make-one/crm.ts');
    const text = funktion(crm, 'saeubereKontakt');
    const ausnahmen: Record<string, string> = { stand: 'Transportfeld (Fingerabdruck für den Browser), wird nie gespeichert' };
    const fehlt = felderVon(crm, 'Kontakt').filter(f => !ausnahmen[f] && !nennt(text, f));
    expect(fehlt).toEqual([]);
  });
});
