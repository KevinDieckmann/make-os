// ─── Demo-Instanz: Inbox mit erfundener Post, Übergabe, Aufgaben-Vorschlägen (Server, 10.10.2026) ──────────────────────────
// Nur mit MAKE_OS_DEMO=1 (sonst gibt es den Anbieter „demo“ gar nicht — lib/postfach/verwalten.ts `demoErlaubt`). Über die BESTEHENDEN
// Routen, wie die übrige Saat (lib/demo/saat.ts `rufe`):
//   · Lena verbindet ein Demo-Postfach (Bereich MAKE = `ug`, erfundene Post aus lib/postfach/demo-post.ts) und gleicht ab
//   · sie übergibt Jonas die Anfrage „Angebot …“ (mit Notiz) und die Rechnung MIT angehaktem PDF (verschlüsselte Kopie)
//   · sie holt Aufgaben-Vorschläge — das Regelwerk legt sie in IHREN Freigabe-Stapel (Frist „bis Freitag“, Rechnung, Bitte …)
// Die Suche (/api/inbox/suche) findet danach z. B. „Kennzahlen“ (Betreff), „Rechnung-2026“ (Anhang-Name) und Jonas’ Übergabe.
// Alles erfunden (`@example.invalid`, Namen aus der Demo-Saat), kein Netz.

import { bauKennung, BAU_KOPF } from '@/lib/bau/kennung';
import { DEMO_DOMAIN } from './schutz';

type Modul = Record<string, unknown>;
type Handler = (req: Request) => Promise<Response>;

async function rufe(modul: Promise<Modul>, methode: 'GET' | 'POST', pfad: string, person: string, body?: unknown): Promise<Record<string, unknown>> {
  const fn = (await modul)[methode] as Handler | undefined;
  if (!fn) throw new Error(`${methode} ${pfad}: Route kennt die Methode nicht.`);
  const kopf: Record<string, string> = { 'content-type': 'application/json', 'x-make-user': person };
  const bau = bauKennung();
  if (bau) kopf[BAU_KOPF] = bau;
  const r = await fn(new Request(`http://demo.invalid${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const text = await r.text();
  let j: Record<string, unknown> = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { roh: text.slice(0, 200) }; }
  if (!r.ok || j.ok === false) throw new Error(`${methode} ${pfad} → ${r.status}: ${String(j.error ?? j.fehler ?? text.slice(0, 300))}`);
  return j;
}

const R = {
  postfaecher: () => import('@/app/api/inbox/postfaecher/route') as Promise<Modul>,
  inbox: () => import('@/app/api/inbox/route') as Promise<Modul>,
  gespraech: () => import('@/app/api/inbox/gespraech/route') as Promise<Modul>,
  uebergaben: () => import('@/app/api/inbox/uebergaben/route') as Promise<Modul>,
  vorschlaege: () => import('@/app/api/inbox/vorschlaege/route') as Promise<Modul>,
};

type G = { id: string; betreff: string };
type N = { id: string; anhaenge: { teil: string; name: string; eingebettet?: boolean }[] };

/** Sät die Inbox der Demo. Liefert die Schritte für den Bericht (nur Zahlen). */
export async function inboxSaen(o: { lena: string; jonas: string }): Promise<{ name: string; anzahl: number }[]> {
  if (process.env.MAKE_OS_DEMO !== '1') return [{ name: 'Inbox (nur mit MAKE_OS_DEMO=1)', anzahl: 0 }];
  const { lena, jonas } = o;
  await rufe(R.postfaecher(), 'POST', '/api/inbox/postfaecher', lena, {
    aktion: 'hinzufuegen', anbieter: 'demo', adresse: `lena.post@${DEMO_DOMAIN}`, passwort: 'demo-postfach-passwort', bereich: 'ug', anzeigename: 'Anfragen (Demo)',
  });
  await rufe(R.inbox(), 'POST', '/api/inbox', lena, { aktion: 'abgleichen' });
  const strom = await rufe(R.inbox(), 'GET', '/api/inbox?space=business', lena);
  const gespraeche = (strom.gespraeche ?? []) as G[];
  const finde = (teil: string) => gespraeche.find(g => g.betreff.includes(teil));
  let uebergaben = 0;
  const angebot = finde('Angebot Kennzahlen-Paket');
  if (angebot) {
    await rufe(R.uebergaben(), 'POST', '/api/inbox/uebergaben', lena, { aktion: 'uebergeben', gespraech: angebot.id, an: jonas, notiz: 'Kannst du das Angebot bis Freitag vorbereiten? Die Zahlen stehen im Leitfaden. (Beispiel)' });
    uebergaben++;
  }
  const rechnung = finde('Rechnung 2026-117');
  if (rechnung) {
    const g = await rufe(R.gespraech(), 'GET', `/api/inbox/gespraech?id=${encodeURIComponent(rechnung.id)}`, lena);
    const pdf = ((g.nachrichten ?? []) as N[]).flatMap(n => n.anhaenge.filter(a => !a.eingebettet && /\.pdf$/i.test(a.name)).map(a => ({ nachricht: n.id, teil: a.teil })))[0];
    await rufe(R.uebergaben(), 'POST', '/api/inbox/uebergaben', lena, { aktion: 'uebergeben', gespraech: rechnung.id, an: jonas, notiz: 'Bitte prüfen und bezahlen. (Beispiel)', ...(pdf ? { anhaenge: [pdf] } : {}) });
    uebergaben++;
  }
  const v = await rufe(R.vorschlaege(), 'POST', '/api/inbox/vorschlaege', lena, { aktion: 'holen' });
  return [
    { name: 'Inbox (Demo-Postfach, Gespräche)', anzahl: gespraeche.length },
    { name: 'Inbox (Übergaben an Jonas)', anzahl: uebergaben },
    { name: 'Inbox (Aufgaben-Vorschläge)', anzahl: Number(v.gelegt ?? 0) },
  ];
}
