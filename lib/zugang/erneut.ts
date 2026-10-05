// ─── Erneut bestätigen: Passwort + zweiter Faktor vor folgenschweren Schritten (05.10., Paket „Betroffenenrechte v2“) ─────
// „Mein Konto löschen“ und der Instanz-Export (alle Bestände entschlüsselt) gehen nicht mit einer Sitzung allein: eine vergessene
// oder gestohlene Sitzung darf weder alles mitnehmen noch ein Konto vernichten. Deshalb hier EINE Prüfung:
//   · aktuelles Passwort — dieselbe Bremse wie „Passwort ändern“ (`pw:<person>`), Fehlversuche ins Anmeldeprotokoll
//   · ist der zweite Faktor an: zusätzlich der Sechssteller (nie zweimal dieselbe Zeitstufe — `letzteStufe`) oder ein
//     Wiederherstellungscode (danach verbraucht). Ohne Faktor genügt das Passwort.
// Nur für die Person der Sitzung (`x-make-user`, von der Middleware gesetzt) — der Dienstweg kommt hier nie an (die Routen lehnen ihn vorher ab).

import { aendereKonten, passwortStimmt, type Konto } from './konten';
import { codePruefen, wiederherstellungPruefen } from './totp';
import { pruefe, fehlschlag, erfolg, adresse } from './drossel';
import { notiere, adresseGekuerzt, type AnmeldeArt } from './anmeldungen';

export type ErneutErgebnis = { ok: true } | { ok: false; status: number; fehler: string; zweiterFaktor?: true; warteSek?: number };

export async function erneutPruefen(req: Request, konto: Konto, eingabe: { passwort?: unknown; code?: unknown }, art: AnmeldeArt): Promise<ErneutErgebnis> {
  const bremse = `pw:${konto.speicher}`;
  const warte = pruefe(bremse).warteSek;
  if (warte > 0) return { ok: false, status: 429, fehler: `Zu viele Versuche — bitte in ${warte} Sekunden erneut.`, warteSek: warte };
  if (!(await passwortStimmt(String(eingabe.passwort ?? ''), konto))) {
    fehlschlag(bremse);
    await notiere({ speicher: konto.speicher, art, ok: false, adresse: adresseGekuerzt(adresse(req)) });
    return { ok: false, status: 403, fehler: 'Das Passwort stimmt nicht.' };
  }
  const zf = konto.zweiterFaktor;
  if (zf) {
    const code = typeof eingabe.code === 'string' ? eingabe.code.trim() : '';
    if (!code) return { ok: false, status: 403, fehler: 'Bitte zusätzlich den Code aus der Authenticator-App eingeben.', zweiterFaktor: true };
    const p = codePruefen(zf.geheimnis, code, Date.now(), 1, zf.letzteStufe);
    if (p.ok) {
      await aendereKonten(s => ({ ...s, konten: s.konten.map(k => (k.speicher === konto.speicher && k.zweiterFaktor ? { ...k, zweiterFaktor: { ...k.zweiterFaktor, letzteStufe: p.stufe } } : k)) }));
    } else {
      const i = wiederherstellungPruefen(zf.wiederherstellung, code, konto.salz);
      if (i < 0) {
        fehlschlag(bremse);
        await notiere({ speicher: konto.speicher, art, ok: false, adresse: adresseGekuerzt(adresse(req)) });
        return { ok: false, status: 403, fehler: 'Der Code stimmt nicht.', zweiterFaktor: true };
      }
      const jetzt = new Date().toISOString();
      await aendereKonten(s => ({ ...s, konten: s.konten.map(k => (k.speicher === konto.speicher && k.zweiterFaktor ? { ...k, zweiterFaktor: { ...k.zweiterFaktor, wiederherstellung: k.zweiterFaktor.wiederherstellung.map((w, j) => (j === i ? { ...w, benutzt: jetzt } : w)) } } : k)) }));
    }
  }
  erfolg(bremse);
  return { ok: true };
}
