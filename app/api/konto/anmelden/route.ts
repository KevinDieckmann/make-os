// ─── MAKE OS — Anmelden ─────────────────────────────────────────────────────
// E-Mail + Passwort → Sitzung. Bei falschen Angaben immer dieselbe Antwort,
// egal ob die E-Mail existiert: sonst könnte man Konten erraten.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { aendereKonten, emailSauber, passwortStimmt, passwortNachziehen, kdfFuerNeu, kontoZuEmail, ladeKonten, zweiFaktorOffen } from '@/lib/zugang/konten';
import { codePruefen, wiederherstellungPruefen } from '@/lib/zugang/totp';
import { mitSitzung } from '@/lib/zugang/antwort';
import { pruefe, fehlschlag, erfolg, adresse } from '@/lib/zugang/drossel';
import { notiere, adresseGekuerzt, alle as anmeldungenAlle } from '@/lib/zugang/anmeldungen';
import { neueAdresse, zuVieleFehlschlaege, darfMelden, textNeueAdresse, textFehlschlaege } from '@/lib/zugang/anmelde-alarm';
import { sendeAnPerson, telegramKonfiguriert } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: { email?: string; passwort?: string; code?: string };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const email = emailSauber(b.email);
  // Bremse gegen Raten (lib/zugang/drossel.ts): je Adresse (IP) und je Paar IP + KONTO — nicht je E-Mail
  // allein, sonst könnte jemand mit Kevins Adresse dessen Anmeldung dauerhaft sperren (26.09.). Das Paar zählt je Konto
  // (03.10.): wer sich mit der Haupt- und den weiteren Adressen abwechselt, teilt sich EIN Versuchsbudget, der Alias
  // verdoppelt die Versuche nicht. Unbekannte Adressen zählen je eingegebenem Text (sie führen in kein Konto).
  const adr = adresse(req);
  const konto = email ? await kontoZuEmail(email) : undefined;
  const schluessel = [`ip:${adr}`, `paar:${adr}|${konto ? `konto:${konto.speicher}` : (email ?? '-')}`];
  const warte = Math.max(...schluessel.map(s => pruefe(s).warteSek));
  if (warte > 0) return NextResponse.json({ error: `Zu viele Versuche — bitte in ${warte > 90 ? `${Math.ceil(warte / 60)} Minuten` : `${warte} Sekunden`} erneut.` }, { status: 429, headers: { 'Retry-After': String(warte) } });
  // Auch ohne Treffer einmal hashen, damit die Antwortzeit nichts verrät.
  // Der Blindgänger rechnet mit den aktuellen Parametern (05.10.: N=2^17) — sonst verriete die kürzere Zeit „kein Konto“.
  const ok = konto ? await passwortStimmt(String(b.passwort ?? ''), konto) : (await passwortStimmt('x', { hash: '00', salz: '00', kdf: kdfFuerNeu() }), false);
  if (!konto || !ok) {
    schluessel.forEach(s => fehlschlag(s));
    if (konto) {
      await notiere({ speicher: konto.speicher, art: 'anmelden', ok: false, adresse: adresseGekuerzt(adr) });
      // Sicherheit (27.09.): zu viele falsche Passwörter → Telegram an die Person (höchstens alle 30 Minuten).
      void alarmFehlschlaege(konto.speicher);
    }
    return NextResponse.json({ error: 'E-Mail oder Passwort stimmen nicht.' }, { status: 401 });
  }
  schluessel.forEach(erfolg);

  // Zweiter Faktor (26.09.): Passwort stimmt — jetzt der Code aus der App (oder ein Wiederherstellungscode).
  if (konto.zweiterFaktor) {
    if (b.code === undefined || b.code === '') return NextResponse.json({ ok: false, zweiterFaktor: true });
    const bremse = `2fa:${konto.speicher}`;
    const warte2 = pruefe(bremse).warteSek;
    if (warte2 > 0) return NextResponse.json({ error: `Zu viele Versuche — bitte in ${warte2} Sekunden erneut.` }, { status: 429, headers: { 'Retry-After': String(warte2) } });
    const zf = konto.zweiterFaktor;
    const p = codePruefen(zf.geheimnis, b.code, Date.now(), 1, zf.letzteStufe);
    if (p.ok) {
      await aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === konto.speicher && k.zweiterFaktor ? { ...k, zweiterFaktor: { ...k.zweiterFaktor, letzteStufe: p.stufe } } : k) }));
    } else {
      const i = wiederherstellungPruefen(zf.wiederherstellung, b.code, konto.salz);
      if (i < 0) {
        fehlschlag(bremse);
        await notiere({ speicher: konto.speicher, art: 'anmelden', ok: false, adresse: adresseGekuerzt(adr) });
        return NextResponse.json({ error: 'Der Code stimmt nicht.' }, { status: 401 });
      }
      const jetzt = new Date().toISOString();
      await aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === konto.speicher && k.zweiterFaktor ? { ...k, zweiterFaktor: { ...k.zweiterFaktor, wiederherstellung: k.zweiterFaktor.wiederherstellung.map((w, j) => j === i ? { ...w, benutzt: jetzt } : w) } } : k) }));
    }
    erfolg(bremse);
  }

  // Sicherheit (27.09.): eine Anmeldung aus einem neuen Netz meldet MAKE OS der Person per Telegram — geprüft VOR dem Eintrag, sonst kennt es die Adresse schon.
  void alarmNeueAdresse(konto.speicher, adresseGekuerzt(adr));
  await notiere({ speicher: konto.speicher, art: 'anmelden', ok: true, adresse: adresseGekuerzt(adr) });
  // scrypt (05.10.): alter Hash → mit demselben Salz und den aktuellen Parametern neu (Sitzungs-Stand bleibt gleich).
  await passwortNachziehen(String(b.passwort ?? ''), konto);
  // 2FA-Pflicht der Instanz (05.10.): ohne zweiten Faktor gibt es eine Sitzung, die NUR die Einrichtung erlaubt (middleware.ts).
  if (zweiFaktorOffen((await ladeKonten()).einstellungen, konto)) return mitSitzung(konto, { zweiterFaktorEinrichten: true });
  return mitSitzung(konto);
}

/** Neue Adresse? Dann Telegram an die Person — nie blockierend, nie mit Fehler für die Anmeldung. */
async function alarmNeueAdresse(speicher: string, adresse: string): Promise<void> {
  try {
    if (!telegramKonfiguriert()) return;
    const jetzt = new Date().toISOString();
    if (!neueAdresse(await anmeldungenAlle(), speicher, adresse)) return;
    if (!darfMelden(`${speicher}:neu`)) return;
    await sendeAnPerson(speicher, textNeueAdresse(adresse, jetzt));
  } catch { /* Alarm ist Zusatz, nie Hindernis */ }
}
async function alarmFehlschlaege(speicher: string): Promise<void> {
  try {
    if (!telegramKonfiguriert()) return;
    const jetzt = new Date().toISOString();
    const f = zuVieleFehlschlaege(await anmeldungenAlle(), speicher, jetzt);
    if (!f.alarm || !darfMelden(`${speicher}:fehl`)) return;
    await sendeAnPerson(speicher, textFehlschlaege(f.anzahl, f.adressen, jetzt));
  } catch { /* s. o. */ }
}
