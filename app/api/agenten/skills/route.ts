// ─── Agenten-Bereich: Skills, eigene Mitarbeiter, Gedächtnis, Leistung (09.10., Paket 3; AGENTEN_KONZEPT.md C11) ───────────
// GET  `?head=<id>` → `SkillsAntwort` + `staende` (Stand je Skill/Mitarbeiter) + `leistung` (Zahlen des Heads, Monat `?monat=`) +
//      `autonomie`; ohne `head` alle sichtbaren Heads; `?id=<sk-…>` → `SkillAntwort` (+ `aktivierenFehlt`).
// POST `SkillAnfrage` (lib/agenten/typen.ts) — dazu `aus-faden` („Das als Skill speichern“, { fadenId, headId? }), `autonomie`
//      ({ headId, stufe }), beim Testlauf `kostenBestaetigt`/`nachts`, `mitarbeiter-probelauf` (Paket 4b: Testeingabe ohne Wirkung,
//      Ergebnis nur im Thread). Anlegen mit `anfrageId` nur einmal (`einmalig`).
// Nur die Person selbst (`eigenePerson`: Sitzung, Haushalt des Inhabers; Dienstweg 403), nur Heads, die sie sieht (sonst 403/404).
// Vorschläge von Agenten kommen NIE hierüber, sondern über den Stapel (Arten `skill`/`mitarbeiter`/`merksatz`). Einzeländerungen mit
// Stand (409), Grenzen 413, Body ≤ 64 KB (`jsonBegrenzt`).
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { modellSchranke } from '@/lib/zugang/umfang';
import { einmalig } from '@/lib/store/anfragen';
import { AGENTEN_NUR_SELBST } from '@/lib/agenten/typen';
import { headDef } from '@/lib/agenten/katalog';
import {
  merksatzAktion, merksatzWegAktion, mitarbeiterAendernAktion, mitarbeiterAnlegen, skillAendernAktion, skillAktivAktion, skillAnlegen,
  skillAusFadenAktion, skillImportAktion, skillLoeschenAktion, skillMitStand, skillTestlaufAktion, umfangFuer, werkstattSicht, mitarbeiterProbelaufAktion, type Fehler,
} from '@/lib/agenten/skills-server';
import { autonomiePflegen, autonomieSetzen, leistungFuerHead } from '@/lib/agenten/leistung';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY = 64 * 1024;
const antwort = (r: { ok: boolean }) => {
  if (r.ok) return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
  const f = r as unknown as Fehler;
  return NextResponse.json({ ...f, error: f.fehler }, { status: f.status });
};

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const id = q.get('id');
  if (id) return antwort(await skillMitStand(z.person, id));
  const head = q.get('head');
  const w = await werkstattSicht(z.person, head);
  if (!w.ok || !head) return antwort(w);
  const h = headDef(head)!;
  const leistung = await leistungFuerHead(z.person, h, q.get('monat') ?? undefined).catch(() => null);
  return antwort({ ...w, ...(leistung ? { leistung: { ...leistung, autonomie: undefined }, autonomie: leistung.autonomie } : {}) });
}

type Body = Record<string, unknown> & { aktion?: string };

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let b: Body;
  try { b = await jsonBegrenzt<Body>(req, MAX_BODY); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.', error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!b || typeof b !== 'object') return NextResponse.json({ ok: false, fehler: 'Anfrage fehlt.', error: 'Anfrage fehlt.' }, { status: 400 });
  const p = z.person;
  const r = await ausfuehren(req, p, b);
  // Automatisch zurückstufen (Fragerunde 15) — nach jeder Schreibaktion; ein Fehler hier hält die Antwort nie auf.
  await umfangFuer(p).then(u => autonomiePflegen(u.haushalt)).catch(() => {});
  return r instanceof NextResponse ? r : antwort(r);
}

/** Antwort aus `einmalig` (wiederholte Anfrage → dieselbe Antwort; läuft gerade → 409). */
const alsAntwort = (e: { status: number; body: unknown }): NextResponse => {
  const body = e.body as Record<string, unknown>;
  return NextResponse.json({ ...body, ...(body.ok === false && !body.error ? { error: body.fehler } : {}), ...(body.ok === false && !body.fehler ? { fehler: body.error } : {}) }, { status: e.status });
};

async function ausfuehren(req: Request, p: string, b: Body): Promise<NextResponse | { ok: boolean }> {
  switch (b.aktion) {
    case 'anlegen': {
      const skill = (b.skill && typeof b.skill === 'object' ? b.skill : {}) as Record<string, unknown>;
      const e = await einmalig('agenten-skill', b.anfrageId, async () => { const r = await skillAnlegen(p, skill, 'hand'); return { status: r.ok ? 200 : (r as Fehler).status, body: r }; }, undefined, { wer: p });
      return alsAntwort(e);
    }
    case 'aendern': return skillAendernAktion(p, b.id, b.teil, b.stand);
    case 'testlauf': {
      if (b.nachts !== true) { const s = modellSchranke(req); if (s) return s; }
      return skillTestlaufAktion(p, b.id, { kostenBestaetigt: b.kostenBestaetigt === true, nachts: b.nachts === true });
    }
    case 'aktivieren': return skillAktivAktion(p, b.id, true, b.stand);
    case 'deaktivieren': return skillAktivAktion(p, b.id, false, b.stand);
    case 'loeschen': return skillLoeschenAktion(p, b.id, b.stand);
    case 'import': return skillImportAktion(p, b.headId, b.skillMd);
    case 'aus-faden': return skillAusFadenAktion(p, b.fadenId, b.headId);
    case 'mitarbeiter-anlegen': {
      const e = await einmalig('agenten-mitarbeiter', b.anfrageId, async () => { const r = await mitarbeiterAnlegen(p, b.headId, b.mitarbeiter, 'hand'); return { status: r.ok ? 200 : (r as Fehler).status, body: r }; }, undefined, { wer: p });
      return alsAntwort(e);
    }
    case 'mitarbeiter-aendern': return mitarbeiterAendernAktion(p, b.headId, b.id, b.teil, b.stand);
    case 'merksatz': return merksatzAktion(p, b.agent, b.text);
    case 'merksatz-weg': return merksatzWegAktion(p, b.agent, b.id);
    case 'autonomie': return autonomieSetzen(p, b.headId, b.stufe);
    // Paket 4b: Probelauf eines Mitarbeiters — ein Lauf mit Testeingabe ohne Wirkung, Ergebnis nur in einem eigenen Thread.
    case 'mitarbeiter-probelauf': {
      const s = modellSchranke(req); if (s) return s;
      return mitarbeiterProbelaufAktion(p, b.headId, { id: b.id, entwurf: b.entwurf, eingabe: b.eingabe, kostenBestaetigt: b.kostenBestaetigt });
    }
    default: return { ok: false, status: 400, fehler: 'Unbekannte Aktion.' } as Fehler;
  }
}
