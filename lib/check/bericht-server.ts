// ─── Checks — Bericht per E-Mail verschicken (nur Server, 31.10.) ────────────────────────────────────────────────────────────────────
// Sobald eine Sitzung ein Ergebnis UND erfasste Kontaktdaten hat — egal, was zuerst kam —, geht der Bericht GENAU EINMAL je Sitzung per Mail an die
// Adresse der Person (`berichtAnstossen` aus app/api/check/route.ts: Aktionen `kontakt` und `ergebnis`). Beansprucht wird in der Sperre des Bestands
// (`bericht.status = 'laeuft'`), verschickt NACH der Antwort (`nachDerAntwort`), danach der Stand an der Sitzung (nur intern sichtbar). Ein
// gescheiterter Versand (Fehler, ohne Absender, Grenze) wird beim nächsten Anstoß höchstens `BERICHT_VERSUCHE`-mal wiederholt; „gesendet“ und
// „gesperrt“ (Art. 18, Werbesperre, Sperrliste) nie. Versand über den Website-Absender (lib/oeffentlich/website-post.ts — dort die Begründung der
// eng gefassten Ausnahme von Eiserner Regel 3); Text nur aus lib/check/bericht.ts.

import { vorlageVon } from './katalog';
import { ergebnisAnsicht } from './ergebnis';
import { gespraechSatz } from './zoe-texte';
import { berichtMail } from './bericht';
import { BERICHT_VERSUCHE, ladeCheckBestand, ladeCheckEinstellungen, sitzungIntern, type CheckBericht } from './speicher';
import { schritteMitAngeboten, zoeKontext } from './server';

/** Ein beanspruchter Versand gilt nach so vielen Minuten als liegengeblieben (Neustart mitten im Versand) und darf neu. */
const LAEUFT_MS = 10 * 60_000;

/**
 * Den Bericht anstoßen — beansprucht in der Sperre und verschickt nach der Antwort. `true`, wenn diesmal verschickt wird. Wirft nicht.
 */
export async function berichtAnstossen(id: string, jetzt = new Date()): Promise<boolean> {
  const lauf = { beansprucht: false };
  try {
    await sitzungIntern(id, s => {
      if (!s.kontakt || !s.ergebnis || s.kontaktStand !== 'erfasst') return s;
      const b = s.bericht;
      if (b?.status === 'gesendet' || b?.status === 'gesperrt') return s;
      if (b?.status === 'laeuft' && jetzt.getTime() - Date.parse(b.am) < LAEUFT_MS) return s;
      if (b && b.versuche >= BERICHT_VERSUCHE) return s;
      lauf.beansprucht = true;
      return { ...s, bericht: { status: 'laeuft', am: jetzt.toISOString(), versuche: (b?.versuche ?? 0) + 1 } };
    });
  } catch (x) { console.error('[check] Bericht beanspruchen:', x instanceof Error ? x.message.slice(0, 200) : 'Fehler'); return false; }
  if (!lauf.beansprucht) return false;
  const { nachDerAntwort } = await import('@/lib/oeffentlich/website-post');
  nachDerAntwort(() => berichtSenden(id), 'check');
  return true;
}

/** Den beanspruchten Bericht bauen und senden, dann den Stand an der Sitzung vermerken. */
export async function berichtSenden(id: string, jetzt = new Date()): Promise<CheckBericht['status']> {
  const vermerken = async (status: CheckBericht['status'], x: { ueber?: string; grund?: string } = {}) => {
    await sitzungIntern(id, s => ({ ...s, bericht: { status, am: new Date().toISOString(), versuche: s.bericht?.versuche ?? 1, ...(x.ueber ? { ueber: x.ueber } : {}), ...(x.grund ? { grund: x.grund.slice(0, 200) } : {}) } }));
    return status;
  };
  try {
    const s = (await ladeCheckBestand()).sitzungen.find(x => x.id === id);
    const v = s ? vorlageVon(s.vorlage) : undefined;
    if (!s || !v || !s.kontakt || !s.ergebnis) return await vermerken('fehler', { grund: 'Sitzung ohne Ergebnis oder Kontakt.' });
    const { websiteLage, websiteLink, websiteMailSenden } = await import('@/lib/oeffentlich/website-post');
    const lage = await websiteLage();
    if (!lage) return await vermerken('ohneAbsender', { grund: 'Kein Website-Absender eingerichtet (Marketing › Newsletter › Absender-Postfach).' });
    const e = await ladeCheckEinstellungen();
    const { ansicht } = ergebnisAnsicht(v, s.antworten);
    // Links der Angebote über die Website (ein Pfad der Website wird zur vollen Adresse, https bleibt).
    const schritte = schritteMitAngeboten(ansicht.schritte, e).map(x => {
      if (!x.angebot) return x;
      const link = websiteLink(lage.website, x.angebot.link);
      const { link: _l, ...rest } = x.angebot;
      return { ...x, angebot: { ...rest, ...(link ? { link } : {}) } };
    });
    const { vornameSauber } = await import('@/lib/newsletter/regeln');
    const vorname = vornameSauber(s.kontakt.vorname) || undefined;
    const k = await zoeKontext(e);
    const mail = berichtMail({
      marke: lage.marke, check: v.name, ...(vorname ? { vorname } : {}), ansicht: { ...ansicht, schritte },
      gespraech: { satz: gespraechSatz(k), link: e.buchungSlug ? `${lage.website}/buchen/${e.buchungSlug}` : null },
      verantwortlich: lage.verantwortlich, datenschutzLink: lage.datenschutzLink,
    });
    const r = await websiteMailSenden({ an: s.kontakt.email, ...(vorname ? { vorname } : {}), betreff: mail.betreff, text: mail.text, art: 'bericht', lage }, jetzt);
    if (r.ok) return await vermerken('gesendet', { ueber: r.ueber });
    if (r.grund === 'eingeschraenkt' || r.grund === 'werbesperre' || r.grund === 'sperrliste') return await vermerken('gesperrt', { grund: r.text });
    if (r.grund === 'grenze') return await vermerken('grenze', { grund: r.text });
    if (r.grund === 'aus') return await vermerken('ohneAbsender', { grund: r.text });
    return await vermerken('fehler', { grund: r.text });
  } catch (x) {
    return vermerken('fehler', { grund: x instanceof Error ? x.message : 'Fehler' }).catch(() => 'fehler' as const);
  }
}
