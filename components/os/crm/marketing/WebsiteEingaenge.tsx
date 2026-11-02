'use client';

// ─── Marketing › Anfragen › „Von der Website — nicht angekommen“ (02.11., Gegenprüfung R2-4 Fund 3) ───────────────────────────────────
// Unterlage anfordern und Newsletter-Anmeldung, die der Takt nach allen Versuchen nicht ins CRM bzw. nicht verschickt bekam, standen bis heute nirgends
// und verfielen nach 30 Tagen still. Hier stehen sie (GET /api/website/eingang), mit drei Wegen: noch einmal versuchen · als Anfrage von Hand übernehmen
// (über den EINEN Anfrage-Weg, ohne automatische Mail) · verwerfen (mit Rückfrage — die Daten sind dann weg). Die Karte erscheint nur, wenn etwas offen ist.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Chip, Punkt, Hinweis, LEUCHT, useRueckfrage } from '../../ui';
import type { EingangOffen } from '@/lib/oeffentlich/eingang';

const ART: Record<string, string> = { unterlage: 'Unterlage angefordert', newsletter: 'Newsletter-Anmeldung' };
const tag = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

export function WebsiteEingaengeKarte({ onUebernommen, zuKontakt }: { onUebernommen?: () => void | Promise<void>; zuKontakt: (id: string) => void }) {
  const [liste, setListe] = useState<EingangOffen[] | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'achtung'; text: string; kontaktId?: string } | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();
  const laden = useCallback(async () => {
    const r = await fetch('/api/website/eingang', { cache: 'no-store' }).then(x => x.json()).catch(() => null);
    if (r?.ok) setListe(r.eingaenge);
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const tun = async (id: string, aktion: 'erneut' | 'uebernehmen' | 'verwerfen') => {
    if (aktion === 'verwerfen' && !(await bestaetigen({ titel: 'Eingang verwerfen?', text: 'Name und Adresse werden gelöscht — es entsteht keine Anfrage. Nur für Spam oder Doppeltes.', ja: 'Verwerfen', gefahr: true }))) return;
    setLaeuft(id);
    const r = await fetch('/api/website/eingang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion, id }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(null);
    setMeldung(r.ok ? { art: 'gut', text: r.text ?? 'Erledigt.', ...(r.kontaktId ? { kontaktId: r.kontaktId } : {}) } : { art: 'achtung', text: r.fehler ?? 'Nicht gespeichert.' });
    await laden();
    if (r.ok && aktion !== 'verwerfen') await onUebernommen?.();
  };
  if (!liste?.length && !meldung) return null;
  return (
    <Karte i={0} akzent={liste?.length ? LEUCHT.achtung : undefined}>
      <Ueberschrift rechts={liste?.length ? <Chip farbe={LEUCHT.achtung}>{liste.length} offen</Chip> : undefined}>Von der Website — nicht angekommen</Ueberschrift>
      {dialog}
      {meldung && <Hinweis art={meldung.art} rolle="status" aktion={<>{meldung.kontaktId && <Knopf leise onClick={() => zuKontakt(meldung.kontaktId!)}>Zur Person</Knopf>}<Knopf leise onClick={() => setMeldung(null)}>ok</Knopf></>}>{meldung.text}</Hinweis>}
      {!!liste?.length && (
        <>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Diese Eingänge kamen über die Website, sind aber nicht vollständig im CRM bzw. nicht verschickt. Sie werden nicht still gelöscht — bitte entscheiden.</span>
          <Liste>
            {liste.map(e => (
              <div key={e.id}>
                <Zeile umbrechen links={<Punkt farbe={e.brauchtHand ? LEUCHT.achtung : C.inkLeise} />}
                  titel={<>{e.vorname || 'Ohne Namen'}<span style={{ color: C.inkLeise, fontWeight: 400 }}> · {e.email}{e.firma ? ` · ${e.firma}` : ''}</span></>}
                  unter={`${ART[e.art] ?? e.art} · ${tag(e.am)} · ${e.status === 'fehler' ? `${e.versuche} Versuch${e.versuche === 1 ? '' : 'e'} gescheitert` : 'wartet'}${e.grund ? ` · ${e.grund}` : ''}`} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 0 10px' }}>
                  <Knopf leise aus={laeuft === e.id} onClick={() => tun(e.id, 'erneut')}>Noch einmal versuchen</Knopf>
                  <Knopf leise aus={laeuft === e.id} onClick={() => tun(e.id, 'uebernehmen')}>Als Anfrage von Hand übernehmen</Knopf>
                  <Knopf leise aus={laeuft === e.id} onClick={() => tun(e.id, 'verwerfen')}>Verwerfen</Knopf>
                </div>
              </div>
            ))}
          </Liste>
        </>
      )}
    </Karte>
  );
}
