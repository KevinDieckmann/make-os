// ─── Prozesse · Lauf-Motor — die Stapel-Art `prozess` (Etappe C1, 21.10.; ANALYSE_100.md Punkte 61, 64; VORLAGEN_KUNDENGEWINNUNG.md 5.2 N12) ────────────────
// Der Freigabe-Baustein IST der ZOE-Stapel (Punkt 61) — kein zweites Postfach. Ein Lauf legt Vorschläge mit Bezug `{ art: 'prozess', id: <lauf>-<schritt> }`
// (lib/prozesse/lauf-server.ts) — die Ausgänge sind Äste des Laufs:
//   freigegeben   → „ja“: Mail bzw. WhatsApp geht SOFORT raus (N12, Entscheidung 21.10.) — über das eigene Postfach (dieselbe Stelle wie die Inbox,
//                   lib/inbox/senden-server.ts) bzw. die Business-Nummer (lib/whatsapp/senden.ts), ALS die freigebende Person aus der SITZUNG (nie der Dienstweg,
//                   nie der Inhaber als Rückfall), mit allen Prüfungen (§ 7 UWG, Kanal-Ampel, Art. 18, Werbesperre, 24-h-Fenster, `einmalig`). Empfänger und Text
//                   stehen vor dem Klick im Vorschlag; ändern darf man nur Betreff und Text („Ändern & freigeben“), nie den Empfänger (Punkt 56).
//                   Schlägt der Versand fehl, bleibt der Vorschlag offen — mit Grund.
//                   Eine andere Außenwirkung (Angebot stellen, Rechnung, Papierkorb): nach der Freigabe eine Aufgabe „von Hand“ — der Lauf wartet darauf.
//                   Bausteine mit eigenem Weg (22.10. spät, `_wirkung` — lib/prozesse/bausteine-server.ts): Mandat aus dem Deal, Gästeliste, Kampagnen-Ergebnis,
//                   Anfrage aus dem Webhook (CRM-Schreibwege wie ein Klick), Fall starten (Fulfillment), Termin mit Einladung (Termin-Schreibweg) — ebenfalls
//                   NUR aus der eigenen Sitzung, `einmalig` je Kennung; schlägt es fehl, bleibt der Vorschlag offen.
//   abgelehnt     → „nein“ (die Route setzt den Status, `nachAblehnen` führt den Lauf weiter)
//   abgelaufen    → „abgelaufen“ (der Takt lehnt nach der Frist mit Grund ab, lib/prozesse/lauf-server.ts `weckerPruefen`)
// Vor der Wirkung wird neu geprüft (Punkt 64): der Lauf wartet noch auf GENAU diesen Vorschlag, auf derselben Version, der Prozess läuft — sonst 409 statt
// still weiter. Agenten-Ergebnisse (Sorte `agent`): freigeben = übernommen (der Lauf ging schon weiter, er wartet nicht darauf).

import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import type { Vorschlag } from '@/lib/zoe/stapel';
import type { SendeAuftrag, VorschlagWirkung } from './lauf-regeln';

type Fehler = { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };
const nein = (status: Fehler['status'], fehler: string): Fehler => ({ ok: false, status, fehler });

/** Betreff/Text aus „Ändern & freigeben“ — nur diese zwei Felder, nur Text, Grenzen wie die Inbox; sonst die vorbereitete Fassung. */
function geaendert(sende: SendeAuftrag, eingabe: Record<string, unknown> | null | undefined): SendeAuftrag | Fehler {
  if (!eingabe) return sende;
  const text = typeof eingabe.text === 'string' ? eingabe.text : undefined;
  const betreff = typeof eingabe.betreff === 'string' ? eingabe.betreff : undefined;
  if (text !== undefined && text.length > 100_000) return nein(413, 'Der Text ist zu lang — nichts gesendet.');
  if (betreff !== undefined && (betreff.length > 300 || /[\r\n]/.test(betreff))) return nein(400, 'Der Betreff ist zu lang bzw. hat einen Zeilenumbruch — nichts gesendet.');
  if (sende.kanal === 'mail') return { ...sende, ...(text !== undefined ? { text } : {}), ...(betreff !== undefined ? { betreff } : {}) };
  return { ...sende, ...(text !== undefined ? { text } : {}) };
}

/** Senden als die freigebende Person (N12). Ergebnis: Kennung der gesendeten Nachricht bzw. ein Fehler mit Grund (der Vorschlag bleibt offen). */
async function senden(person: string, s: SendeAuftrag, kennung: string): Promise<{ ok: true; id: string } | Fehler> {
  const { einmalig } = await import('@/lib/store/anfragen');
  if (s.kanal === 'mail') {
    const [{ inboxSenden }, { gmailBereit }, { ladePostfaecher }] = await Promise.all([import('@/lib/inbox/senden-server'), import('@/lib/gmail/abgleich'), import('@/lib/postfach/register')]);
    // Das Postfach der Vorlage, wenn es der freigebenden Person gehört (bzw. sie es sieht) — sonst ihr Gmail bzw. ihr erstes Business-Postfach.
    const eigene = await ladePostfaecher(person).catch(() => []);
    const { bereichVonGesellschaft } = await import('@/lib/einheiten');
    const business = eigene.filter(p => p.quelle === 'imap' && !!p.bereich && p.bereich !== 'privat' && bereichVonGesellschaft(p.bereich) === 'business');
    const postfach = s.postfach && (s.postfach === 'gmail' || eigene.some(p => p.id === s.postfach)) ? s.postfach
      : await gmailBereit(person).catch(() => false) ? 'gmail' : business[0]?.id;
    if (!postfach) return nein(409, 'Kein eigenes Postfach zum Senden — bitte in der Inbox ein Postfach verbinden. Nichts gesendet.');
    try {
      const r = await einmalig<Record<string, unknown>>('inbox-senden', kennung, () => inboxSenden(person, { neu: { postfach, betreff: s.betreff }, an: [{ email: s.an.email, name: s.an.name }], text: s.text }, { art: 'person', person }), undefined, { wer: person });
      const body = r.body as Record<string, unknown>;
      if (r.status >= 400 || body.ok === false) return nein(r.status === 413 ? 413 : r.status === 403 ? 403 : r.status === 404 ? 404 : r.status === 400 ? 400 : 409, `${String(body.fehler ?? body.error ?? 'Nicht gesendet.')} Der Vorschlag bleibt offen.`);
      return { ok: true, id: String(body.id ?? kennung) };
    } catch (e) {
      return nein(409, `Nicht gesendet (${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}). Der Vorschlag bleibt offen.`);
    }
  }
  const [{ whatsappSenden }, { whatsappFuer }, { telefonSchluessel }, { WhatsappFehler }] = await Promise.all([
    import('@/lib/whatsapp/senden'), import('@/lib/whatsapp/server'), import('@/lib/whatsapp/zuordnung'), import('@/lib/whatsapp/graph'),
  ]);
  const k = await whatsappFuer(person);
  if (!k) return nein(403, 'WhatsApp ist für dein Konto nicht freigeschaltet. Nichts gesendet.');
  const nummer = telefonSchluessel(s.an.telefon);
  if (!nummer) return nein(409, 'Keine Nummer am Kontakt. Nichts gesendet.');
  try {
    const r = await whatsappSenden(person, {
      gespraech: `wa~${k.postfachId}~${nummer}`, ...(s.vorlage ? { art: 'vorlage' as const, vorlage: { name: s.vorlage.split('|')[0], sprache: s.vorlage.split('|')[1] ?? 'de', parameter: [] } } : { art: 'frei' as const, text: s.text ?? '' }),
      anfrageId: kennung,
    });
    if (r.status >= 400 || !('id' in r.body)) return nein(409, `${'error' in r.body ? r.body.error : 'Nicht gesendet.'} Der Vorschlag bleibt offen.`);
    return { ok: true, id: r.body.id };
  } catch (e) {
    if (e instanceof WhatsappFehler) return nein(e.status === 403 ? 403 : e.status === 404 ? 404 : e.status === 413 ? 413 : e.status === 400 ? 400 : 409, `${e.message} Der Vorschlag bleibt offen.`);
    return nein(409, 'Nicht gesendet — bitte noch einmal. Der Vorschlag bleibt offen.');
  }
}

/** Den Lauf zum Vorschlag finden und neu prüfen (Punkt 64). */
async function laufZumVorschlag(v: Vorschlag) {
  const [{ laeufeLesen, kontextLaden, laufZustand }] = await Promise.all([import('./lauf-server')]);
  const kx = await kontextLaden();
  const d = await laeufeLesen(kx.h);
  const l = d.laeufe.find(x => x.id === v.eingabe._lauf);
  const e = l ? kx.prozesse.prozesse.find(p => p.id === l.prozessId) : undefined;
  const def = l && e ? e.versionen.find(x => x.nr === l.version)?.definition ?? null : null;
  return { kx, l, e, def, laeuft: laufZustand(e) === 'laeuft' };
}

export const PROZESS_STAPEL_ART: StapelArtFreigabe = {
  freigeben: async (vIn, person, opt) => {
    const [{ personImHaushaltDesInhabers }, { beanspruche, loslassen, entscheide }] = await Promise.all([import('@/lib/zugang/haushalt-inhaber'), import('@/lib/zoe/stapel')]);
    if (!person || !(await personImHaushaltDesInhabers(person))) return nein(403, 'Nur im Haushalt des Inhabers.');
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== 'prozess') return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person && v.person !== person) return { status: 403, fehler: 'Nur die Person, für die der Prozess ihn vorgelegt hat, gibt ihn frei.' };
      return null;
    });
    if (!a.ok) return nein(a.status, a.fehler);
    const v = a.v;
    const kennung = v.bezug!.id;
    try {
      // Agenten-Ergebnis: übernommen (der Lauf wartet nicht darauf).
      if (v.eingabe._sorte === 'agent') {
        await entscheide(v.id, 'freigegeben', { ergebnis: 'Ergebnis übernommen.', von: person, ausArbeit: true });
        return { ok: true, text: 'Ergebnis übernommen.' };
      }
      const z = await laufZumVorschlag(v);
      // Punkt 64: wartet der Lauf noch auf GENAU diesen Vorschlag, auf derselben Version, und läuft der Prozess? Sonst nichts — Rückfrage statt still weiter.
      if (!z.l || !z.def || z.l.status !== 'wartet' || z.l.wartet?.art !== 'freigabe' || z.l.wartet.wirkung !== kennung) {
        await loslassen(v.id);
        return nein(409, 'Der Prozess-Lauf wartet nicht mehr auf diese Freigabe (beendet, abgebrochen oder schon weiter) — bitte ablehnen. Nichts ausgeführt.');
      }
      if (z.l.version !== v.eingabe._version) { await loslassen(v.id); return nein(409, 'Der Lauf ist inzwischen auf eine andere Version umgezogen — bitte neu ansehen. Nichts ausgeführt.'); }
      if (!z.laeuft) { await loslassen(v.id); return nein(409, 'Der Prozess ist pausiert bzw. zurückgestellt — erst fortsetzen. Nichts ausgeführt.'); }
      const { mitLaufHerkunft } = await import('./lauf-herkunft');
      const herkunft = { prozessId: z.l.prozessId, laufId: z.l.id, tiefe: z.l.tiefe };
      let ergebnis = 'Freigegeben.';
      let danachAufgabe: string | undefined;
      const sende = v.eingabe._sende as SendeAuftrag | undefined;
      if (sende) {
        // N12: nur aus der eigenen Sitzung — der Dienstweg (ZOE, Takt, Skripte) sendet nie, auch nicht mit Person.
        if (!opt.sitzung) { await loslassen(v.id); return nein(403, 'Senden nur aus der eigenen Sitzung — über den Dienstweg wird nichts gesendet.'); }
        const s = geaendert(sende, opt.eingabe);
        if ('ok' in s) { await loslassen(v.id); return s; }
        const r = await mitLaufHerkunft(herkunft, () => senden(person, s, kennung));
        if (!r.ok) { await loslassen(v.id); return r; }
        ergebnis = s.kanal === 'mail' ? `Mail an ${s.an.name} gesendet.` : `WhatsApp an ${s.an.name} gesendet.`;
      }
      const wirkung = v.eingabe._wirkung as VorschlagWirkung | undefined;
      if (wirkung) {
        // Wie N12: nur aus der eigenen Sitzung — der Dienstweg (ZOE, Takt, Skripte) legt kein Mandat an, startet keinen Fall und lädt nie ein.
        if (!opt.sitzung) { await loslassen(v.id); return nein(403, 'Nur aus der eigenen Sitzung — über den Dienstweg wird nichts übernommen.'); }
        const [{ einmalig }, { wirkungUebernehmen }] = await Promise.all([import('@/lib/store/anfragen'), import('./bausteine-server')]);
        let r: Awaited<ReturnType<typeof wirkungUebernehmen>>;
        try {
          const a = await mitLaufHerkunft(herkunft, () => einmalig<Awaited<ReturnType<typeof wirkungUebernehmen>>>('prozess-wirkung', kennung, async () => {
            const x = await wirkungUebernehmen(person, wirkung, { vid: v.id, kennung });
            return { status: x.ok ? 200 : x.status, body: x };
          }, undefined, { wer: person }));
          const b = a.body as Awaited<ReturnType<typeof wirkungUebernehmen>> | { ok: false; error: string };
          r = 'error' in b ? { ok: false, status: 409, fehler: b.error } : b;
        } catch (e) {
          r = { ok: false, status: 409, fehler: `Nicht übernommen (${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}). Der Vorschlag bleibt offen.` };
        }
        if (!r.ok) { await loslassen(v.id); return nein(r.status, r.fehler); }
        ergebnis = r.text;
      }
      const danach = wirkung ? undefined : v.eingabe._danach as { titel: string; beschreibung: string; bezug: Record<string, string> } | undefined;
      if (danach) {
        const [{ systemAufgabenAendern }, { WEG }] = await Promise.all([import('@/lib/aufgaben/system-schreiben'), import('@/lib/wege')]);
        const iso = new Date().toISOString();
        const r = await mitLaufHerkunft(herkunft, () => systemAufgabenAendern(st => (st.tasks.some(t => t.id === kennung) ? {} : {
          neu: [{ id: kennung, title: danach.titel, description: danach.beschreibung, status: 'todo', priority: 'high', assignee: person, notiz: `[Prozess öffnen](${WEG.prozesse({ p: z.l!.prozessId })})`, tags: ['prozess'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: iso, updatedAt: iso, space: 'business', bezug: danach.bezug }],
        }), { person, jetzt: iso }));
        if (!r.ok) { await loslassen(v.id); return nein(409, 'Die Aufgabe „von Hand“ ließ sich nicht anlegen — nichts freigegeben.'); }
        danachAufgabe = kennung;
        ergebnis = 'Freigegeben — die Aufgabe „von Hand“ liegt bei dir.';
      }
      await entscheide(v.id, 'freigegeben', { ergebnis, von: person, ausArbeit: true });
      // Der Lauf geht über „ja“ weiter (bzw. wartet jetzt auf die Aufgabe „von Hand“).
      const [{ laeufeAendern, laufVoran }, { freigabeEntschieden }] = await Promise.all([import('./lauf-server'), import('./lauf-regeln')]);
      const iso = new Date().toISOString();
      const lid = z.l.id, def = z.def;
      const weiter = await laeufeAendern(d => {
        const l = d.laeufe.find(x => x.id === lid);
        if (!l) return { datei: d, r: false };
        const n = freigabeEntschieden(l, def, kennung, 'ja', iso, danachAufgabe ? { danachAufgabe } : {});
        return n === l ? { datei: d, r: false } : { datei: { ...d, laeufe: d.laeufe.map(x => (x.id === lid ? n : x)) }, r: true };
      }, z.kx.h);
      if (weiter) await laufVoran(lid, z.kx);
      return { ok: true, text: ergebnis };
    } catch (e) {
      await loslassen(v.id).catch(() => null);
      throw e;
    }
  },
  nachAblehnen: async v => {
    if (v.eingabe._sorte === 'agent') return null;
    const z = await laufZumVorschlag(v);
    if (!z.l || !z.def) return null;
    const [{ laeufeAendern, laufVoran }, { freigabeEntschieden }] = await Promise.all([import('./lauf-server'), import('./lauf-regeln')]);
    const iso = new Date().toISOString();
    const lid = z.l.id, def = z.def, kennung = v.bezug!.id;
    const weiter = await laeufeAendern(d => {
      const l = d.laeufe.find(x => x.id === lid);
      if (!l) return { datei: d, r: false };
      const n = freigabeEntschieden(l, def, kennung, 'nein', iso);
      return n === l ? { datei: d, r: false } : { datei: { ...d, laeufe: d.laeufe.map(x => (x.id === lid ? n : x)) }, r: true };
    }, z.kx.h);
    if (weiter) await laufVoran(lid, z.kx);
    return weiter;
  },
};
