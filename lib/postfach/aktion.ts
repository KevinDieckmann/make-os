// ─── Postfächer — Gelesen, Erledigt (Archiv), Anhang (Server, 06.10.2026) ─────────────────────────────────────────
// Was die Person in der Inbox mit einem IMAP-Gespräch tut, geht an den Anbieter zurück — der Spiegel zieht sofort nach:
//   gelesen/ungelesen  `\Seen` setzen/entfernen (nur Nachrichten im Posteingang)
//   erledigt           die Nachrichten des Gesprächs aus dem Posteingang in den Archiv-Ordner verschieben (UID MOVE); fehlt ein
//                      Archiv-Ordner, legt MAKE OS „Archiv“ an und merkt ihn im Register. Nie löschen.
//   zurück             aus dem Archiv in den Posteingang (nur, solange der Spiegel die Nachricht kennt)
// Anhänge: der Inhalt kommt auf Klick frisch vom Anbieter (BODY[teil]) — nie in den Spiegel.

import { ordnerMerken, ladePostfach } from './register';
import { sitzungFuer } from './abgleich';
import { aendereImapStand, ladeImapStand, type ImapKopf } from './spiegel';
import { PostfachFehler } from './transport';
import { POSTFACH_GRENZEN } from './typen';

export type ImapAktion = 'gelesen' | 'ungelesen' | 'erledigt' | 'zurueck';

const ARCHIV_NEU = 'Archiv';

/** Die Köpfe eines Postfachs zu diesen Kennungen (nur eigene). */
async function koepfe(person: string, postfach: string, ids: readonly string[]): Promise<ImapKopf[]> {
  const s = await ladeImapStand(person);
  return ids.map(id => s.koepfe[id]).filter((k): k is ImapKopf => !!k && k.postfachId === postfach);
}

/** Eine Aktion auf die Nachrichten eines Gesprächs. Wirft `PostfachFehler`. */
export async function imapAktion(person: string, postfach: string, ids: readonly string[], aktion: ImapAktion): Promise<{ geaendert: number }> {
  const p = await ladePostfach(person, postfach);
  if (!p || p.quelle !== 'imap') throw new PostfachFehler('ordner', 'Dieses Postfach gibt es nicht (mehr).', 404);
  const alle = await koepfe(person, postfach, ids);
  const imEingang = alle.filter(k => k.ordner === 'e');
  const imArchiv = alle.filter(k => k.ordner === 'a');
  if (aktion === 'zurueck' ? !imArchiv.length : !imEingang.length) return { geaendert: 0 };
  const s = await sitzungFuer(person, p);
  const ordner = { ...(p.ordner ?? { posteingang: 'INBOX' }) };
  let neueUids: Map<string, number> | null = null;
  try {
    if (aktion === 'gelesen' || aktion === 'ungelesen') {
      await s.oeffnen(ordner.posteingang, true);
      await s.flagsAendern(imEingang.map(k => k.uid), aktion === 'gelesen' ? ['\\Seen'] : [], aktion === 'ungelesen' ? ['\\Seen'] : []);
    } else if (aktion === 'erledigt') {
      if (!ordner.archiv) {
        const liste = await s.ordnerListe();
        const da = liste.find(o => o.specialUse === '\\Archive')?.pfad ?? liste.find(o => /^(archiv|archive)$/i.test(o.pfad.split(/[./]/).pop() ?? ''))?.pfad;
        if (!da) await s.ordnerAnlegen(ARCHIV_NEU);
        ordner.archiv = da ?? ARCHIV_NEU;
        await ordnerMerken(person, postfach, ordner);
      }
      await s.oeffnen(ordner.posteingang, true);
      await s.verschieben(imEingang.map(k => k.uid), ordner.archiv);
    } else {
      if (!ordner.archiv) return { geaendert: 0 };
      await s.oeffnen(ordner.archiv, true);
      // Im Archiv haben die Nachrichten neue UIDs — über die Message-ID finden.
      neueUids = new Map();
      for (const k of imArchiv) if (k.messageId) { const u = await s.sucheMessageId(k.messageId); if (u[0]) neueUids.set(k.id, u[0]); }
      await s.verschieben(Array.from(neueUids.values()), ordner.posteingang);
    }
  } finally { await s.schliessen(); }
  let n = 0;
  await aendereImapStand(person, cur => {
    const k2 = { ...cur.koepfe };
    for (const k of aktion === 'zurueck' ? imArchiv : imEingang) {
      const x = k2[k.id];
      if (!x) continue;
      if (aktion === 'gelesen') k2[k.id] = { ...x, labels: x.labels.filter(l => l !== 'UNREAD') };
      else if (aktion === 'ungelesen') k2[k.id] = { ...x, labels: x.labels.includes('UNREAD') ? x.labels : [...x.labels, 'UNREAD'] };
      // Erledigt: der Kopf bleibt (Verlauf des Gesprächs) — als „im Archiv“, ohne INBOX. Der nächste Abgleich fasst ihn nicht mehr an.
      else if (aktion === 'erledigt') k2[k.id] = { ...x, ordner: 'a', labels: x.labels.filter(l => l !== 'INBOX' && l !== 'UNREAD') };
      // Zurück: der Archiv-Kopf fällt weg — der nächste Abgleich liest die Nachricht im Posteingang neu (neue UID).
      else if (aktion === 'zurueck' && neueUids?.has(k.id)) delete k2[k.id];
      n++;
    }
    return { ...cur, koepfe: k2 };
  });
  return { geaendert: n };
}

/** Den Inhalt eines Anhangs vom Anbieter holen. Wirft `PostfachFehler` (404/413). */
export async function imapAnhang(person: string, kopfId: string, teil: string): Promise<{ name: string; bytes: Buffer }> {
  const s0 = await ladeImapStand(person);
  const k = s0.koepfe[kopfId];
  const meta = k?.anhaenge.find(a => a.teil === teil);
  if (!k || !meta) throw new PostfachFehler('server', 'Diesen Anhang gibt es nicht.', 404);
  if (meta.groesse > POSTFACH_GRENZEN.anhangMax) throw new PostfachFehler('server', `Der Anhang ist größer als ${Math.round(POSTFACH_GRENZEN.anhangMax / 1048576)} MB — bitte im Mail-Programm öffnen.`, 413);
  const p = await ladePostfach(person, k.postfachId);
  if (!p || p.quelle !== 'imap') throw new PostfachFehler('ordner', 'Dieses Postfach gibt es nicht (mehr).', 404);
  const pfad = k.ordner === 'e' ? p.ordner?.posteingang : k.ordner === 'g' ? p.ordner?.gesendet : p.ordner?.archiv;
  if (!pfad) throw new PostfachFehler('ordner', 'Der Ordner dieser Mail ist nicht bekannt.', 404);
  const s = await sitzungFuer(person, p);
  try {
    const st = await s.oeffnen(pfad);
    let uid = k.uid;
    if (st.uidValidity !== k.uidValidity || k.ordner === 'a') {
      const u = k.messageId ? await s.sucheMessageId(k.messageId) : [];
      if (!u[0]) throw new PostfachFehler('server', 'Die Mail gibt es beim Anbieter nicht mehr.', 404);
      uid = u[0];
    }
    const t = await s.teil(uid, teil, POSTFACH_GRENZEN.anhangMax);
    return { name: meta.name, bytes: t.bytes };
  } finally { await s.schliessen(); }
}
