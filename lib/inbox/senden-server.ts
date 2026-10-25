// ─── Inbox 2 — Senden (Server, 21.10.: aus app/api/inbox/senden herausgelöst, Verhalten unverändert) ─────────────────────────────────────────────────────
// Die EINE Stelle, die eine Mail sendet — über die RICHTIGE Quelle (Gmail-API bzw. SMTP des Postfachs), mit allen Prüfungen (§ 7 UWG, Art. 18, Absender =
// eigenes Postfach, Anhänge nur aus der eigenen Ablage) und Protokoll ohne Text. Aufrufer: die Route /api/inbox/senden (Einzelklick, Sitzung) und die
// Freigabe eines Prozess-Vorschlags im Stapel (lib/prozesse/lauf-stapel.ts, N12 — als die freigebende Person aus der Sitzung). Den Dienstweg schließt der
// Aufrufer aus (beide: nur Sitzung); `einmalig` hält der Aufrufer (Anfrage-Kennung). Wirft `SendenFehler`, `PostfachFehler` bzw. Fehler der Google-API nicht
// weiter als die Route — Ergebnis als `{ status, body }`.

import { gmailSenden, SendenFehler } from '@/lib/gmail/senden';
import { imapSenden } from '@/lib/postfach/senden';
import { postfachAufloesen } from '@/lib/inbox/teilen-server';
import { antwortBezugAus } from '@/lib/inbox/teilen';
import { antwortPostfaecher, uebergabeFinden, uebergabeGeantwortet } from '@/lib/inbox/uebergaben-server';
import type { AntwortBezug } from '@/lib/gmail/senden';
import { GMAIL_POSTFACH } from '@/lib/postfach/typen';
import { PostfachFehler } from '@/lib/postfach/transport';
import { gespraechTeile } from '@/lib/inbox/strom';
import { nachrichtenVon } from '@/lib/inbox/verlauf';
import { gmailBereit } from '@/lib/gmail/abgleich';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import type { Adr } from '@/lib/gmail/typen';
import { anhaengeLaden, anhangKennungen } from '@/lib/inbox/anhaenge-server';
import { belegAus, belegPruefen, belegVermerken } from '@/lib/inbox/beleg-versand';

const adressen = (v: unknown): Adr[] | undefined => Array.isArray(v) ? v.slice(0, 40).map(x => ({ email: String((x as Adr)?.email ?? ''), ...((x as Adr)?.name ? { name: String((x as Adr).name) } : {}) })) : undefined;

/**
 * Eine Mail senden (Antwort im Gespräch, Antwort auf eine Übergabe oder neue Mail aus einem eigenen Postfach) — Körper wie POST /api/inbox/senden. Die Form
 * (`gespraech` | `uebergabe` + `postfach` | `neu.postfach`) prüft der Aufrufer vorher.
 */
export async function inboxSenden(person: string, b: Record<string, unknown>, wer: Wer): Promise<{ status: number; body: Record<string, unknown> }> {
  const neu = b.neu && typeof b.neu === 'object' ? b.neu as { postfach?: unknown; betreff?: unknown } : null;
  const uebergabe = typeof b.uebergabe === 'string' && /^ub-[0-9a-f-]{36}$/.test(b.uebergabe) ? b.uebergabe : null;
  try {
    // Beleg (25.10., „Über <Postfach> senden (mit PDF)“): nur bei einer neuen Mail; der Anhang muss GENAU das PDF dieses Angebots bzw. dieser Rechnung
    // sein — geprüft, BEVOR etwas gesendet wird. Nach dem Senden steht „versendet am … über …“ am Beleg (lib/inbox/beleg-versand.ts).
    const beleg = belegAus(b.beleg);
    if (beleg && !neu) return { status: 400, body: { ok: false, fehler: 'Ein Beleg geht nur mit einer neuen Mail hinaus.' } };
    if (beleg) await belegPruefen(beleg, anhangKennungen(b.anhaenge));
    // Anhänge (10.10., Fortschritts-Report): nur Kennungen eigener Ablage-Dateien — geladen und geprüft, BEVOR etwas gesendet wird.
    const anhaenge = await anhaengeLaden(person, b.anhaenge);
    const gemeinsam = { person: person, text: String(b.text ?? ''), ...(adressen(b.an) ? { an: adressen(b.an) } : {}), ...(adressen(b.cc) ? { cc: adressen(b.cc) } : {}), uwgBestaetigt: b.uwgBestaetigt === true, ...(anhaenge.length ? { anhaenge } : {}) };
    let postfach: string, ausNachricht: string | undefined, bezug: AntwortBezug | undefined;
    if (neu) postfach = neu.postfach as string;
    else if (uebergabe) {
      const u = await uebergabeFinden(person, uebergabe);
      if (!u) return { status: 404, body: { ok: false, fehler: 'Diese Übergabe gibt es nicht (mehr).' } };
      if (u.an !== person) return { status: 403, body: { ok: false, fehler: 'Antworten kann hier nur die Person, an die übergeben wurde — das Original liegt in deinem Postfach.' } };
      if (u.status !== 'offen') return { status: 409, body: { ok: false, fehler: 'Diese Übergabe ist nicht mehr offen.' } };
      postfach = b.postfach as string;
      if (!(await antwortPostfaecher(person, u)).some(p => p.id === postfach)) return { status: 403, body: { ok: false, code: 'absender', fehler: 'Antworten nur aus einem eigenen Postfach desselben Bereichs (Privat bzw. Business).' } };
      bezug = antwortBezugAus(u);
    } else {
      const t = gespraechTeile(b.gespraech as string)!;
      const n = await nachrichtenVon(person, b.gespraech as string);
      if (!n) return { status: 404, body: { ok: false, fehler: 'Dieses Gespräch gibt es nicht (mehr).' } };
      const vonUns = (k: (typeof n.koepfe)[number]) => k.labels.includes('SENT') || k.ordner === 'g' || n.eigene.includes(k.von.email);
      ausNachricht = ([...n.koepfe].reverse().find(k => !vonUns(k) && !k.automatisch) ?? n.koepfe[n.koepfe.length - 1]).id;
      postfach = t.postfach;
    }
    let x: { an: string[]; von: string; id?: string };
    let team = false;
    if (postfach === GMAIL_POSTFACH) {
      if (!(await gmailBereit(person).catch(() => false))) return { status: 409, body: { ok: false, fehler: 'Gmail ist nicht verbunden.' } };
      const s = await gmailSenden({ ...gemeinsam, ...(ausNachricht ? { ausNachricht } : {}), ...(bezug ? { bezug } : {}), ...(neu ? { betreff: String(neu.betreff ?? '') } : {}), ...(typeof b.von === 'string' ? { von: b.von } : {}) });
      x = { an: s.an, von: s.von, id: s.id };
    } else {
      // Eigenes Postfach oder ein Team-Postfach, das die Person sieht — dann über den Zugang des Besitzers, gesendet ALS das Postfach.
      const r = await postfachAufloesen(person, postfach);
      if (!r || r.postfach.quelle !== 'imap') return { status: 404, body: { ok: false, fehler: 'Dieses Postfach gibt es nicht.' } };
      const p = r.postfach;
      team = r.besitzer !== person;
      // Absender = das Postfach. Wer eine andere Adresse verlangt, bekommt nichts gesendet (nie aus Versehen aus dem falschen Bereich).
      if (typeof b.von === 'string' && b.von.trim().toLowerCase() !== p.adresse) return { status: 400, body: { ok: false, code: 'absender', fehler: 'Aus diesem Gespräch wird über das eigene Postfach geantwortet — eine andere Absenderadresse geht hier nicht.' } };
      const s = await imapSenden({ ...gemeinsam, person: r.besitzer, postfach, ...(ausNachricht ? { ausNachricht } : {}), ...(bezug ? { bezug } : {}), ...(neu ? { betreff: String(neu.betreff ?? '') } : {}) });
      x = { an: s.an, von: s.von };
    }
    // Wer gesendet hat, steht im Protokoll (`wer` = Sitzung) — beim Team-Postfach auch, dass es ALS das geteilte Postfach ging.
    await protokolliere('inbox', [{ op: 'neu', id: x.id ?? uebergabe ?? (b.gespraech as string | undefined) ?? postfach, felder: ['gesendet', ...(team ? ['team-postfach'] : []), ...(uebergabe ? ['uebergabe'] : []), ...(anhaenge.length ? ['anhang'] : [])] }], wer).catch(() => { /* nur Protokoll */ });
    if (uebergabe) await uebergabeGeantwortet(person, uebergabe);
    if (beleg) await belegVermerken(beleg, { person, von: x.von, wer });
    // Ereignis (21.10., Prozesse C1, E8): eigene Antwort an Kontakte gesendet — stoppt z. B. die Uhr eines Lead-Eingangs. Nur Kennungen, wirft nie.
    await import('@/lib/ereignisse/quellen').then(q => q.antwortGesendetEreignis({
      person, quelle: postfach === GMAIL_POSTFACH ? 'gmail' : 'imap', nachricht: x.id ?? `${postfach}:${new Date().toISOString()}`, an: x.an, postfach,
      ...(typeof b.gespraech === 'string' ? { gespraech: b.gespraech } : {}),
    })).catch(() => 0);
    return { status: 200, body: { ok: true, ...x } };
  } catch (e) {
    if (e instanceof SendenFehler) return { status: e.status, body: { ok: false, code: e.code, fehler: e.message, ...(e.extra ?? {}) } };
    if (e instanceof PostfachFehler) return { status: e.code === 'anmeldung' ? 409 : e.status, body: { ok: false, code: e.code, fehler: e.message } };
    throw e;
  }
}
