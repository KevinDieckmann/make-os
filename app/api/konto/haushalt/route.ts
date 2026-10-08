// ─── Wer gehört zu welchem Haushalt — und wer ist Inhaber? (nur Inhaber) ─────
// GET → alle Konten mit ihrem Haushalt, Rolle und ob der zweite Faktor an ist; dazu der Haushalt der Inhaber.
// PUT { speicher, haushalt | null, finanzRecht? }.
// finanzRecht (04.10. spät): 'business' = nur die Business-Sicht der Finanzplanung (kein Privatzugang); null = alles; fehlt = unverändert.
// Private Finanzen sieht nur, wer hier einem Haushalt zugeordnet ist.
// POST (09.10., R9 — mehrere Inhaber): { aktion: 'inhaber', speicher, passwort, code? } macht ein Konto zum Inhaber,
// { aktion: 'abgeben', passwort, code? } gibt die EIGENE Inhaber-Rolle ab. Nur ein Inhaber per Sitzung (Dienstweg 403) und erst nach
// Passwort + zweitem Faktor (`erneutPruefen`); Regeln rein in lib/zugang/inhaber.ts (Ziel im selben Haushalt mit zweitem Faktor, der
// letzte und der Haupt-Inhaber geben nie ab). Geschrieben über `aendereKonten` (Änderungsprotokoll „rolle“), Anmeldeprotokoll und
// eine Glocke an alle Inhaber (Art `sicherheit`).

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten, type KontenStand } from '@/lib/zugang/konten';
import { personStreng, HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { personDerSitzung, istDienst } from '@/lib/zugang/tor';
import { erneutPruefen } from '@/lib/zugang/erneut';
import { notiere, adresseGekuerzt } from '@/lib/zugang/anmeldungen';
import { adresse } from '@/lib/zugang/drossel';
import {
  istWirksamerInhaber, istHauptInhaber, haushaltDerInhaber, inhaberKonten, wirksameInhaber, zumInhaberPruefen, abgebenPruefen,
  zumInhaberMachen, rolleAbgeben, type RollenPruefung,
} from '@/lib/zugang/inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Jeder Inhaber (09.10., R9) — Rolle Inhaber im Haushalt der Inhaber. */
async function istInhaber(req: Request): Promise<boolean> {
  const p = personStreng(req);
  if (!p) return false;
  return istWirksamerInhaber(await ladeKonten(), p);
}

export async function GET(req: Request) {
  if (!(await istInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur ein Inhaber.' }, { status: 403 });
  const st = await ladeKonten();
  const k = st.konten.map(x => ({
    speicher: x.speicher, name: x.name, rolle: x.rolle, haushalt: x.haushalt ?? null, finanzRecht: x.finanzRecht ?? null,
    zweiterFaktorAn: !!x.zweiterFaktor, ...(istHauptInhaber(st, x.speicher) ? { hauptInhaber: true } : {}),
  }));
  return NextResponse.json({ ok: true, konten: k, haushalt: haushaltDerInhaber(st) });
}

export async function PUT(req: Request) {
  if (!(await istInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur ein Inhaber.' }, { status: 403 });
  let b: { speicher?: unknown; haushalt?: unknown; finanzRecht?: unknown };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  const speicher = String(b.speicher ?? '');
  const haushalt = b.haushalt === null || b.haushalt === '' ? null : String(b.haushalt ?? '').trim().toLowerCase();
  if (haushalt !== null && !HAUSHALT_OK.test(haushalt)) return NextResponse.json({ ok: false, fehler: 'Ungültiger Haushaltsname.' }, { status: 400 });
  if (b.finanzRecht !== undefined && b.finanzRecht !== null && b.finanzRecht !== 'business') return NextResponse.json({ ok: false, fehler: 'Finanzrecht: „business“ oder null.' }, { status: 400 });
  let gefunden = false;
  let fest = false;
  await aendereKonten(s => {
    // Mehrere Inhaber teilen immer einen Haushalt (09.10.): solange es mehrere gibt, bleibt der Haushalt eines Inhabers, wie er ist.
    const ziel = s.konten.find(k => k.speicher === speicher);
    if (ziel?.rolle === 'inhaber' && inhaberKonten(s).length > 1 && (ziel.haushalt ?? null) !== haushalt) { fest = true; return s; }
    return { ...s, konten: s.konten.map(k => {
      if (k.speicher !== speicher) return k;
      gefunden = true;
      const { haushalt: _alt, finanzRecht: altRecht, ...rest } = k;
      // Ein Inhaber behält immer alles (sonst sperrte er sich aus den eigenen Finanzen aus).
      const recht = b.finanzRecht === undefined ? altRecht : b.finanzRecht === 'business' && k.rolle !== 'inhaber' ? 'business' as const : undefined;
      return { ...rest, ...(haushalt ? { haushalt } : {}), ...(recht ? { finanzRecht: recht } : {}) };
    }) };
  });
  if (fest) return NextResponse.json({ ok: false, fehler: 'Solange es mehrere Inhaber gibt, bleibt ihr gemeinsamer Haushalt — erst die Inhaber-Rolle abgeben.' }, { status: 409 });
  if (!gefunden) return NextResponse.json({ ok: false, fehler: 'Konto nicht gefunden.' }, { status: 404 });
  return NextResponse.json({ ok: true, speicher, haushalt });
}

const vorname = (st: KontenStand, speicher: string) => (st.konten.find(k => k.speicher === speicher)?.name ?? '').split(/\s+/)[0] || 'Ein Konto';

/** Zum Inhaber machen bzw. die eigene Rolle abgeben — nur per Sitzung, nur nach Passwort + zweitem Faktor. */
export async function POST(req: Request) {
  if (istDienst(req)) return NextResponse.json({ ok: false, fehler: 'Die Inhaber-Rolle ändert nur eine Person am eigenen Gerät — nie der Dienstweg.' }, { status: 403 });
  const wer = personDerSitzung(req);
  if (!wer || !(await istInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur ein Inhaber.' }, { status: 403 });
  let b: { aktion?: unknown; speicher?: unknown; passwort?: unknown; code?: unknown };
  try { b = await jsonBegrenzt(req, 4096); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  const aktion = b.aktion === 'inhaber' || b.aktion === 'abgeben' ? b.aktion : null;
  if (!aktion) return NextResponse.json({ ok: false, fehler: 'Aktion: „inhaber“ oder „abgeben“.' }, { status: 400 });
  const ziel = aktion === 'inhaber' ? String(b.speicher ?? '') : wer;
  if (!/^[a-z0-9-]{1,40}$/.test(ziel)) return NextResponse.json({ ok: false, fehler: 'Konto fehlt.' }, { status: 400 });

  // Erst die Regeln (ohne das Passwort zu verbrauchen), dann erneut bestätigen, dann in der Sperre noch einmal prüfen und schreiben.
  const pruefe = (st: KontenStand): RollenPruefung => (aktion === 'inhaber' ? zumInhaberPruefen(st, wer, ziel) : abgebenPruefen(st, wer));
  const vorher = await ladeKonten();
  const v = pruefe(vorher);
  if (!v.ok) return NextResponse.json({ ok: false, fehler: v.fehler }, { status: v.status });
  const ich = vorher.konten.find(k => k.speicher === wer)!;
  const art = aktion === 'inhaber' ? 'inhaber-ernennen' as const : 'inhaber-abgeben' as const;
  const p = await erneutPruefen(req, ich, { passwort: b.passwort, code: b.code }, art);
  if (!p.ok) return NextResponse.json({ ok: false, fehler: p.fehler, ...(p.zweiterFaktor ? { zweiterFaktor: true } : {}), ...(p.warteSek ? { warteSek: p.warteSek } : {}) }, { status: p.status });

  let abgelehnt: RollenPruefung | null = null;
  const nachher = await aendereKonten(s => {
    const r = pruefe(s);
    if (!r.ok) { abgelehnt = r; return s; }
    return aktion === 'inhaber' ? zumInhaberMachen(s, ziel) : rolleAbgeben(s, wer);
  });
  const nein = abgelehnt as RollenPruefung | null;
  if (nein && !nein.ok) return NextResponse.json({ ok: false, fehler: nein.fehler }, { status: nein.status });

  await notiere({ speicher: wer, art, ok: true, adresse: adresseGekuerzt(adresse(req)) });
  // Glocke an alle Inhaber (vorher und nachher) — eine fremde Änderung fällt so jedem auf. Ohne `von`: auch die auslösende Person.
  const titel = aktion === 'inhaber' ? `${vorname(nachher, ziel)} hat jetzt die Inhaber-Rolle` : `${vorname(nachher, wer)} hat die Inhaber-Rolle abgegeben`;
  const an = new Set([...wirksameInhaber(vorher), ...wirksameInhaber(nachher)].map(k => k.speicher));
  const { melde } = await import('@/lib/meldungen/melden');
  for (const person of an) await melde({ an: person, art: 'sicherheit', titel, link: '/os/konto#inhaber' });
  return NextResponse.json({ ok: true, aktion, speicher: ziel, inhaber: wirksameInhaber(nachher).map(k => k.speicher) });
}
