// ─── MAKE OS — Gemerkte Geräte des eigenen Kontos (16.10.) ──────────────────
// Auf einem gemerkten Gerät genügt beim Anmelden das Passwort, ohne Code (lib/zugang/geraete.ts, 90 Tage).
//   GET                                → { geraete: [{ id, beschreibung, angelegt, zuletzt, bis, dieses }] } — ohne Hash, ohne Token
//   POST { aktion: 'vergessen', id }   → dieses eine Gerät fragt wieder nach dem Code
//   POST { aktion: 'alle' }            → alle gemerkten Geräte fragen wieder nach dem Code
// Nur die Person der Sitzung (der Dienstweg hat keine → 403). Jede Änderung steht im Anmeldeprotokoll (nur die Geräte-Kennung).
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { personDerSitzung } from '@/lib/zugang/tor';
import { istDienst } from '@/lib/zugang/dienst';
import { NextResponse } from 'next/server';
import { ladeKonten } from '@/lib/zugang/konten';
import { geraeteFuer, geraeteVergessen } from '@/lib/zugang/geraete-server';
import { cookieAusAnfrage, geraetCookieSetzen } from '@/lib/zugang/geraete';
import { notiere, adresseGekuerzt } from '@/lib/zugang/anmeldungen';
import { adresse } from '@/lib/zugang/drossel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (error: string, status: number) => NextResponse.json({ error }, { status });
const ID = /^g-[a-f0-9]{16}$/;

/** Nur die Person der eigenen Sitzung — nie der Dienstweg (auch nicht „im Auftrag“). */
function ich(req: Request): string | null {
  if (istDienst(req)) return null;
  return personDerSitzung(req);
}

async function liste(req: Request, wer: string) {
  const konto = (await ladeKonten()).konten.find(k => k.speicher === wer);
  if (!konto) return null;
  const hier = new Set(cookieAusAnfrage(req).map(e => e.id));
  return (await geraeteFuer(konto)).map(g => ({ ...g, dieses: hier.has(g.id) }));
}

export async function GET(req: Request) {
  const wer = ich(req);
  if (!wer) return fehler('Nur für die angemeldete Person selbst.', 403);
  const geraete = await liste(req, wer);
  if (!geraete) return fehler('Konto nicht gefunden.', 401);
  return NextResponse.json({ ok: true, geraete });
}

export async function POST(req: Request) {
  const wer = ich(req);
  if (!wer) return fehler('Nur für die angemeldete Person selbst.', 403);
  let b: { aktion?: string; id?: string };
  try { b = await jsonBegrenzt(req, 4096); } catch (e) { return jsonZuGross(e) ?? fehler('Kein gültiges JSON.', 400); }
  if (!b || (b.aktion !== 'vergessen' && b.aktion !== 'alle')) return fehler('aktion = vergessen | alle', 400);
  if (b.aktion === 'vergessen' && (typeof b.id !== 'string' || !ID.test(b.id))) return fehler('Gerät unbekannt.', 400);
  if (!(await ladeKonten()).konten.some(k => k.speicher === wer)) return fehler('Konto nicht gefunden.', 401);

  const weg = await geraeteVergessen(wer, b.aktion === 'alle' ? 'alle' : b.id as string);
  if (b.aktion === 'vergessen' && !weg.length) return fehler('Gerät unbekannt.', 404);
  if (weg.length) {
    const adr = adresseGekuerzt(adresse(req));
    if (b.aktion === 'alle') await notiere({ speicher: wer, art: 'geraete-vergessen', ok: true, adresse: adr });
    else await notiere({ speicher: wer, art: 'geraet-vergessen', ok: true, adresse: adr, geraet: weg[0] });
  }
  const res = NextResponse.json({ ok: true, vergessen: weg.length, geraete: (await liste(req, wer)) ?? [] });
  // Gehört ein vergessenes Gerät zu DIESEM Browser, verschwindet sein Eintrag auch aus dem Cookie (andere Konten bleiben drin).
  const imBrowser = cookieAusAnfrage(req);
  if (imBrowser.some(e => weg.includes(e.id))) geraetCookieSetzen(res, imBrowser.filter(e => !weg.includes(e.id)));
  return res;
}
