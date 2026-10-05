// ─── MAKE OS — Anmelde-Adressen des eigenen Kontos (03.10.) ─────────────────
// Ein Konto hat eine Hauptadresse (`email`) und bis zu drei weitere Anmelde-Adressen (`weitereEmails`). Alle melden im
// selben Konto an (selbes Passwort, selber zweiter Faktor). Die Liste liefert GET /api/konto/ich (`ich.email`,
// `ich.weitereEmails`); geändert wird nur hier:
//   POST { aktion: 'hinzu',  email, passwort }  → weitere Adresse anlegen
//   POST { aktion: 'haupt',  email, passwort }  → eine weitere Adresse zur Hauptadresse machen (die alte wird weitere)
//   POST { aktion: 'weg',    email, passwort }  → weitere Adresse entfernen (die Hauptadresse nie — also nie die letzte)
// Jede Änderung braucht das aktuelle Passwort (wie Passwort ändern / zweiten Faktor ausschalten; dieselbe Bremse `pw:<person>`),
// gilt nur für das EIGENE Konto (Person aus der Sitzung — der Dienstweg hat keine → 403), steht im Sicherheitsprotokoll
// (Adresse maskiert) und meldet sich in der Glocke des Kontos. Eine Adresse darf in der Instanz nur einmal vorkommen.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { personDerSitzung } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten, emailSauber, passwortStimmt, adresseVergeben, adresseMaskiert, alleAdressen, oeffentlich, MAX_WEITERE_EMAILS } from '@/lib/zugang/konten';
import { pruefe, fehlschlag, erfolg, adresse } from '@/lib/zugang/drossel';
import { notiere, adresseGekuerzt, type AnmeldeArt } from '@/lib/zugang/anmeldungen';
import { melde } from '@/lib/meldungen/melden';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Aktion = 'hinzu' | 'haupt' | 'weg';
const AKTIONEN: readonly string[] = ['hinzu', 'haupt', 'weg'];
const ART: Record<Aktion, AnmeldeArt> = { hinzu: 'adresse-hinzu', haupt: 'adresse-haupt', weg: 'adresse-weg' };
const TITEL: Record<Aktion, string> = { hinzu: 'Anmelde-Adresse hinzugefügt', haupt: 'Hauptadresse gewechselt', weg: 'Anmelde-Adresse entfernt' };

const fehler = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req: Request) {
  // Nur die Person der Sitzung (von der Middleware gesetzt) — Dienstweg und Systemläufe haben keine → 403.
  const wer = personDerSitzung(req);
  if (!wer) return fehler('Nur für die angemeldete Person selbst.', 403);
  let b: { aktion?: string; email?: string; passwort?: string };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? fehler('Kein gültiges JSON.', 400); }
  if (!b || typeof b.aktion !== 'string' || !AKTIONEN.includes(b.aktion)) return fehler('aktion = hinzu | haupt | weg', 400);
  const aktion = b.aktion as Aktion;
  const ich = (await ladeKonten()).konten.find(k => k.speicher === wer);
  if (!ich) return fehler('Konto nicht gefunden.', 401);

  // Passwort zuerst — auch bei ungültiger Adresse, damit nichts ohne Passwort verraten wird. Gleiche Bremse wie „Passwort ändern“.
  const bremse = `pw:${wer}`;
  const warte = pruefe(bremse).warteSek;
  if (warte > 0) return NextResponse.json({ error: `Zu viele Versuche — bitte in ${warte} Sekunden erneut.` }, { status: 429, headers: { 'Retry-After': String(warte) } });
  if (!(await passwortStimmt(String(b.passwort ?? ''), ich))) {
    fehlschlag(bremse);
    await notiere({ speicher: wer, art: ART[aktion], ok: false, adresse: adresseGekuerzt(adresse(req)) });
    return fehler('Das Passwort stimmt nicht.', 403);
  }
  erfolg(bremse);

  const email = emailSauber(b.email);
  if (!email) return fehler('E-Mail ungültig.', 400);

  let problem: { text: string; status: number } | null = null;
  const stand = await aendereKonten(s => {
    const k = s.konten.find(x => x.speicher === wer);
    if (!k) { problem = { text: 'Konto nicht gefunden.', status: 401 }; return s; }
    const weitere = alleAdressen(k).slice(1);
    const hauptNeu = (x: typeof k, haupt: string, w: string[]) => ({ ...x, email: haupt, ...(w.length ? { weitereEmails: w } : { weitereEmails: undefined }) });
    let neu: typeof k;
    if (aktion === 'hinzu') {
      if (alleAdressen(k).includes(email)) { problem = { text: 'Diese Adresse gehört schon zu deinem Konto.', status: 409 }; return s; }
      if (weitere.length >= MAX_WEITERE_EMAILS) { problem = { text: `Höchstens ${MAX_WEITERE_EMAILS} weitere Adressen — erst eine entfernen.`, status: 409 }; return s; }
      // Instanzweit einmalig: Haupt- oder weitere Adresse jedes anderen Kontos, offene Einladung (in derselben Sperre wie das Schreiben).
      if (adresseVergeben(s, email, wer)) { problem = { text: 'Diese Adresse ist schon vergeben.', status: 409 }; return s; }
      neu = hauptNeu(k, k.email, [...weitere, email]);
    } else if (aktion === 'haupt') {
      if (email === k.email.trim().toLowerCase()) { problem = { text: 'Das ist schon die Hauptadresse.', status: 409 }; return s; }
      if (!weitere.includes(email)) { problem = { text: 'Diese Adresse gehört nicht zu deinem Konto — erst hinzufügen.', status: 404 }; return s; }
      neu = hauptNeu(k, email, [k.email.trim().toLowerCase(), ...weitere.filter(a => a !== email)]);
    } else {
      if (email === k.email.trim().toLowerCase()) { problem = { text: 'Die Hauptadresse lässt sich nicht entfernen — erst eine andere zur Hauptadresse machen.', status: 409 }; return s; }
      if (!weitere.includes(email)) { problem = { text: 'Diese Adresse gehört nicht zu deinem Konto.', status: 404 }; return s; }
      neu = hauptNeu(k, k.email, weitere.filter(a => a !== email));
    }
    // Ohne weitere Adressen bleibt das Feld ganz weg — das Konto sieht aus wie vor dem Feature.
    const { weitereEmails: w, ...ohne } = neu;
    const konto = w && w.length ? { ...ohne, weitereEmails: w } : ohne;
    return { ...s, konten: s.konten.map(x => (x.speicher === wer ? konto : x)) };
  });
  if (problem) { const p: { text: string; status: number } = problem; return fehler(p.text, p.status); }

  await notiere({ speicher: wer, art: ART[aktion], ok: true, adresse: adresseGekuerzt(adresse(req)), detail: adresseMaskiert(email) });
  await melde({ an: wer, art: 'sicherheit', titel: `${TITEL[aktion]}: ${adresseMaskiert(email)}`, link: '/os/konto' });
  const frisch = stand.konten.find(k => k.speicher === wer);
  return NextResponse.json({ ok: true, ich: frisch ? oeffentlich(frisch) : undefined });
}
