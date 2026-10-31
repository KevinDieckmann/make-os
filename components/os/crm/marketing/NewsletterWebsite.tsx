'use client';

// ─── Markttraktion · Marketing › Newsletter — „Anmeldung über die Website“ (30.10., Branch `newsletter-anmeldung`) ─────────────────────
// Die eine interne Stelle der öffentlichen Newsletter-Anmeldung (/newsletter, auch unter der Adresse der Website): an/aus, Absender-Postfach
// (wie beim Formular „Angebot anfordern“ — die Wahl ist die Freigabe der automatischen Bestätigungsmails), Name in der Mail, Einwilligungstext
// (Fassung zählt hoch, sobald sich der Wortlaut ändert), Adresse der Website, optional Verantwortlich/Datenschutz-Link als Abweichung von
// Einstellungen › Datenschutz. Darunter die Anmeldungen (Stand, Datum, Adresse maskiert) mit „löschen“ und „ins CRM übernehmen“.
// Einstellen nur ein Inhaber (der Server prüft); alle anderen sehen nur. Daten nur über /api/newsletter/intern.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Hinweis, Schalter, LEUCHT, useRueckfrage } from '../../ui';
import { WEG } from '@/lib/wege';
import { kontaktAkte } from '@/lib/crm/adresse';
import { tagVon } from '@/lib/zeit';
import { datum } from '../daten';

type Stand = 'wartet' | 'abgelaufen' | 'gesperrt' | 'bestaetigt' | 'nicht-uebernommen';
interface ZeileDaten {
  id: string; stand: Stand; email: string; angemeldet: string; mailGesendet?: string; bestaetigt?: string; versandFehler?: string;
  gesperrt?: 'werbesperre' | 'sperrliste'; fassung: string; crm?: { status: 'ok' | 'abgelehnt' | 'fehler'; kontaktId?: string; grund?: string };
}
interface Daten {
  istInhaber: boolean;
  einstellungen: { aktiv: boolean; fassung: number; marke?: string; einwilligungstext?: string; website?: string; verantwortlich?: string; datenschutzLink?: string; absender: { postfach: string; person: string; eigenes: boolean } | null };
  bereit: boolean; gruende: string[]; wortlaut?: string; fassung?: string;
  vorgabe: { text: string; marke: string; website: string | null; verantwortlich: string | null; datenschutzLink: string | null };
  regeln: { tokenTage: number; mailsJeTag: number; fristTage: number };
  absenderWahl?: { id: string; name: string }[];
  liste: ZeileDaten[];
}

const STAND: Record<Stand, { text: string; farbe: string }> = {
  wartet: { text: 'wartet auf Bestätigung', farbe: LEUCHT.achtung },
  abgelaufen: { text: 'Link abgelaufen', farbe: C.inkLeise },
  gesperrt: { text: 'gesperrt — keine Mail', farbe: LEUCHT.kritisch },
  bestaetigt: { text: 'bestätigt', farbe: LEUCHT.gut },
  'nicht-uebernommen': { text: 'bestätigt, nicht im CRM', farbe: LEUCHT.kritisch },
};
const FELD = { minHeight: 44, borderRadius: 8, background: C.flaeche, color: C.ink, border: `1px solid ${C.linie}`, padding: '0 10px', fontSize: 16 } as const;
const BESCHRIFTUNG = { display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim } as const;

async function senden(body: Record<string, unknown>): Promise<{ ok: boolean; fehler?: string }> {
  const r = await fetch('/api/newsletter/intern', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok && d.ok !== false, fehler: d.fehler };
}

/** Ein Textfeld, das beim Verlassen speichert (nur wenn geändert). Leer = Vorgabe. */
function Feld({ name, wert, platzhalter, max, aus, speichern, mehrzeilig }: { name: string; wert?: string; platzhalter: string; max: number; aus: boolean; speichern: (v: string) => Promise<void>; mehrzeilig?: boolean }) {
  const [v, setV] = useState(wert ?? '');
  useEffect(() => { setV(wert ?? ''); }, [wert]);
  const raus = () => { if (v.trim() !== (wert ?? '')) void speichern(v.trim()); };
  return (
    <label style={BESCHRIFTUNG}>
      {name}
      {mehrzeilig
        ? <textarea value={v} onChange={e => setV(e.target.value)} onBlur={raus} maxLength={max} placeholder={platzhalter} disabled={aus} rows={4} style={{ ...FELD, padding: '10px', lineHeight: 1.5, resize: 'vertical' }} />
        : <input value={v} onChange={e => setV(e.target.value)} onBlur={raus} maxLength={max} placeholder={platzhalter} disabled={aus} style={FELD} />}
    </label>
  );
}

export function NewsletterWebsite() {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();

  const laden = useCallback(async () => {
    const r = await fetch('/api/newsletter/intern', { cache: 'no-store' });
    const x = await r.json().catch(() => ({}));
    if (r.ok && x.ok) setD(x as Daten); else setFehler(String(x.fehler ?? 'Die Anmeldungen ließen sich nicht laden.'));
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const tun = async (body: Record<string, unknown>) => {
    setFehler('');
    const r = await senden(body);
    if (!r.ok) setFehler(r.fehler ?? 'Das hat nicht geklappt.');
    await laden();
  };

  if (!d) return <Karte><Leer>{fehler || 'Lade die Anmeldung über die Website …'}</Leer></Karte>;
  const e = d.einstellungen;
  const aus = !d.istInhaber;
  const bestaetigt = d.liste.filter(z => z.stand === 'bestaetigt').length;
  const wartet = d.liste.filter(z => z.stand === 'wartet').length;

  return (
    <>
      {dialog}
      <Karte akzent={e.aktiv && !d.bereit ? LEUCHT.achtung : undefined}>
        <Ueberschrift>Anmeldung über die Website</Ueberschrift>
        <p style={{ color: C.inkDim, fontSize: TYP.bedien, margin: '0 0 8px', lineHeight: 1.5 }}>
          Öffentliche Seite /newsletter mit Double-Opt-in: Bestätigungsmail aus eurem Postfach, erst nach dem Klick steht die Person mit der Einwilligung
          „Newsletter“ im CRM. Der Versand der Ausgaben bleibt Handarbeit (oben). Kommt ausgeschaltet.
        </p>
        {aus && <Hinweis art="info">Einstellen kann nur ein Inhaber — du siehst den Stand.</Hinweis>}
        {e.aktiv && !d.bereit && d.gruende.length > 0 && <Hinweis art="achtung" titel="Die Seite ist trotzdem zu">{d.gruende.join(' ')}</Hinweis>}
        {!d.vorgabe.verantwortlich && !e.verantwortlich && (
          <Hinweis art="achtung" titel="Verantwortlicher fehlt">Ohne Verantwortlichen bleibt die Anmeldung zu. <Link href={WEG.datenschutz('verantwortlicher')} style={{ color: C.aktiv }}>Jetzt eintragen</Link></Hinweis>
        )}
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          <Schalter an={e.aktiv} aus={aus} onChange={an => void tun({ aktion: 'einstellungen', aktiv: an })} erklaerung="newsletter.anmeldung">Anmeldung öffentlich</Schalter>
          <label style={BESCHRIFTUNG}>
            Absender-Postfach (Bestätigungsmails gehen von hier raus)
            <select value={e.absender?.eigenes ? e.absender.postfach : ''} disabled={aus} onChange={x => void tun({ aktion: 'einstellungen', absender: x.target.value || null })} style={FELD}>
              <option value="">{e.absender && !e.absender.eigenes ? `— gewählt von ${e.absender.person} —` : '— keins (dann ist die Anmeldung aus) —'}</option>
              {(d.absenderWahl ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {d.istInhaber && (d.absenderWahl ?? []).length === 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Kein eigenes Postfach im Business-Bereich — unter <Link href={WEG.inbox()} style={{ color: C.aktiv }}>Inbox</Link> verbinden und zuordnen.</div>}
          <Feld name="Name in Seite und Mail (z. B. die Marke der Website)" wert={e.marke} platzhalter={`ohne Angabe: ${d.vorgabe.marke}`} max={60} aus={aus} speichern={async v => { await tun({ aktion: 'einstellungen', marke: v || null }); }} />
          <Feld name="Adresse der Website (dort läuft /newsletter)" wert={e.website} platzhalter={d.vorgabe.website ? `ohne Angabe: ${d.vorgabe.website}` : 'https://…'} max={300} aus={aus} speichern={async v => { await tun({ aktion: 'einstellungen', website: v || null }); }} />
          <Feld name={`Einwilligungstext (Fassung ${e.fassung}; {marke} wird ersetzt)`} wert={e.einwilligungstext} platzhalter={d.vorgabe.text} max={600} aus={aus} mehrzeilig speichern={async v => { await tun({ aktion: 'einstellungen', einwilligungstext: v || null }); }} />
          <Feld name="Verantwortlich (nur, wenn abweichend von Einstellungen › Datenschutz)" wert={e.verantwortlich} platzhalter={d.vorgabe.verantwortlich ? `ohne Angabe: ${d.vorgabe.verantwortlich}` : 'ohne Angabe: aus Einstellungen › Datenschutz'} max={300} aus={aus} speichern={async v => { await tun({ aktion: 'einstellungen', verantwortlich: v || null }); }} />
          <Feld name="Link zur Datenschutzerklärung (nur, wenn abweichend)" wert={e.datenschutzLink} platzhalter={d.vorgabe.datenschutzLink ? `ohne Angabe: ${d.vorgabe.datenschutzLink}` : 'https://…'} max={300} aus={aus} speichern={async v => { await tun({ aktion: 'einstellungen', datenschutzLink: v || null }); }} />
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>
            Der Link in der Mail gilt {d.regeln.tokenTage} Tage und nur einmal; höchstens {d.regeln.mailsJeTag} Mails je Adresse und Tag. Unbestätigte Anmeldungen fallen nach {d.regeln.fristTage} Tagen weg.
          </div>
          {d.bereit && <Knopf leise href="/newsletter">Seite ansehen</Knopf>}
        </div>
        {fehler && <p role="alert" style={{ color: LEUCHT.kritisch, margin: '10px 0 0' }}>{fehler}</p>}
      </Karte>

      <Karte>
        <Ueberschrift>Anmeldungen · {bestaetigt} bestätigt{wartet ? ` · ${wartet} warten` : ''}</Ueberschrift>
        {!d.liste.length ? <Leer>Noch keine Anmeldung über die Website. Sobald sich jemand einträgt, steht es hier — die Adresse nur gekürzt.</Leer> : (
          <Liste>
            {d.liste.map(z => (
              <div key={z.id}>
                <Zeile
                  aktiv={offen === z.id}
                  onClick={() => setOffen(o => (o === z.id ? null : z.id))}
                  titel={z.email}
                  unter={[`angemeldet ${datum(tagVon(z.angemeldet))}`, z.bestaetigt ? `bestätigt ${datum(tagVon(z.bestaetigt))}` : null, z.versandFehler ? 'Mail nicht verschickt' : null].filter(Boolean).join(' · ')}
                  rechts={<Chip farbe={STAND[z.stand].farbe}>{STAND[z.stand].text}</Chip>}
                />
                {offen === z.id && (
                  <div style={{ padding: '8px 4px 16px', display: 'grid', gap: 10 }}>
                    <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Einwilligungstext Fassung {z.fassung.replace(/^\D+/, '')}{z.mailGesendet ? ` · Mail ${datum(tagVon(z.mailGesendet))}` : ''}</div>
                    {z.versandFehler && <Hinweis art="achtung">{z.versandFehler}</Hinweis>}
                    {z.gesperrt && <Hinweis art="kritisch" titel="Adresse gesperrt">{z.gesperrt === 'werbesperre' ? 'Die Person hat eine Werbesperre' : 'Die Adresse steht auf der Sperrliste'} — es ging keine Bestätigungsmail raus. Erst am Kontakt klären; danach kann sie sich neu anmelden.</Hinweis>}
                    {z.crm && z.crm.status !== 'ok' && z.crm.grund && <Hinweis art="kritisch" titel="Nicht im CRM">{z.crm.grund}</Hinweis>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {z.crm?.status === 'ok' && z.crm.kontaktId && <Knopf leise href={kontaktAkte(z.crm.kontaktId)}>Zur Person</Knopf>}
                      {d.istInhaber && z.stand === 'nicht-uebernommen' && <Knopf leise onClick={async () => { await tun({ aktion: 'crm', id: z.id }); }}>Ins CRM übernehmen</Knopf>}
                      {d.istInhaber && <Knopf leise onClick={async () => { if (await bestaetigen({ titel: 'Diese Anmeldung löschen?', text: 'Die Zeile ist danach weg. Eine Einwilligung am Kontakt bleibt — sie trägt ihren eigenen Nachweis.', ja: 'Löschen', gefahr: true })) { await tun({ aktion: 'loeschen', id: z.id }); setOffen(null); } }}>Löschen</Knopf>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </Liste>
        )}
      </Karte>
    </>
  );
}
