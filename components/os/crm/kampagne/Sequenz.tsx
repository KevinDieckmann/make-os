'use client';

// ─── Markttraktion › Kampagne › Sequenz & Mail-Stapel (31.10., Welle A · Kampagnen-Motor) ──────────────────────────────────────────────
// Kevin 31.10.: „Freigabe = ein Klick je Stapel mit Einzel-Häkchen.“ Hier: die Sequenz der Kampagne (Schritte mit Tag-Abstand und Kanal, Vorlage mit
// Platzhaltern), die Kennzahlen je Schritt, der Mail-Stapel (Häkchen, Bearbeiten, Vorschau, ZOE-Feinschliff, „Ausgewählte freigeben“), der Versand-
// Stand (gedrosselt im Takt) und die Druckliste der Briefe. Rechnen und prüfen tut der Server (/api/crm/kampagnen/motor) — hier nur zeigen und klicken.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { MOTOR_GEAENDERT } from './Ziele';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Hinweis, Raster, Zahl, Chip, Leer, LEUCHT } from '../../ui';
import { KiMarke } from '../../KiMarke';
import { SEQUENZ_KANAELE } from '@/lib/crm/sequenz';
import { PLATZHALTER } from '@/lib/crm/vorlage-platzhalter';
import type { SequenzKanal, SequenzSchritt } from '@/lib/crm/typen';
import type { PostEintrag, WillkommenStufe } from '@/lib/crm/kampagnen-post';

interface Daten {
  istInhaber: boolean; status: string; sequenz: SequenzSchritt[]; neuJeTag: number | null;
  zahlen: Record<string, number>; schritte: { id: string; kanal: SequenzKanal; erreicht: number; reagiert: number; gespraech: number; chance: number }[];
  eintraege: PostEintrag[];
  einstellungen: { tagesgrenze: number; tagesgrenzeMax: number; fusszeile: string; art14Text: string; art14Vorgabe: string; willkommen: { seit: string; von?: string } | null; willkommenStufen: WillkommenStufe[] };
  eigenesRisiko: { seit: string; von?: string } | null; risikoPlaybook: boolean; postfaecher: { id: string; name: string }[];
}

const STATUS_NAME: Record<string, string> = { entwurf: 'Entwurf', freigegeben: 'freigegeben — wartet auf das Zeitfenster', sendet: 'wird gesendet', gesendet: 'gesendet', fehler: 'Fehler', gesperrt: 'gesperrt', verworfen: 'verworfen', unklar: 'unklar', bounce: 'unzustellbar', gedruckt: 'gedruckt' };
const eingabe = { width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '9px 11px', color: C.ink, fontSize: 16, fontFamily: 'inherit' } as const;
const tag = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

async function rufe(body: Record<string, unknown>): Promise<{ ok?: boolean; fehler?: string; text?: string; [k: string]: unknown }> {
  return fetch('/api/crm/kampagnen/motor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
}

export function KampagneSequenz({ kampagneId }: { kampagneId: string }) {
  const [d, setD] = useState<Daten | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'achtung'; text: string } | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [postfach, setPostfach] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const [bearbeiten, setBearbeiten] = useState<{ id: string; betreff: string; text: string } | null>(null);
  const [seq, setSeq] = useState<SequenzSchritt[] | null>(null);
  const [neuJeTag, setNeuJeTag] = useState('');
  const laden = useCallback(async () => {
    const r = await fetch(`/api/crm/kampagnen/motor?kampagneId=${encodeURIComponent(kampagneId)}`).then(x => x.json()).catch(() => null);
    if (r?.ok) { setD(r); setPostfach(p => p || r.postfaecher[0]?.id || ''); }
  }, [kampagneId]);
  useEffect(() => { void laden(); }, [laden]);
  const tun = async (body: Record<string, unknown>, gut?: string) => {
    const r = await rufe({ kampagneId, ...body });
    setMeldung(r.ok ? { art: 'gut', text: String(r.text ?? gut ?? 'Gespeichert.') } : { art: 'achtung', text: r.fehler ?? 'Nicht gespeichert.' });
    await laden();
    // Die Ziel-Liste (kampagne/Ziele.tsx) lädt ihren Stand neu.
    window.dispatchEvent(new Event(MOTOR_GEAENDERT));
    return r;
  };
  if (!d) return <Leer>Sequenz lädt …</Leer>;

  const mails = d.eintraege.filter(x => x.kanal === 'mail');
  // Ein Sendefehler NACH der Freigabe (status fehler mit freigabe) steht unter „Versand“ — dort mit „Erneut vorbereiten“ (M1, 01.11.).
  const sendefehler = (x: PostEintrag) => x.status === 'fehler' && !!x.freigabe;
  const stapel = mails.filter(x => x.status === 'entwurf' || (x.status === 'fehler' && !sendefehler(x)));
  const unterwegs = mails.filter(x => !['entwurf', 'verworfen'].includes(x.status) && (x.status !== 'fehler' || sendefehler(x)));
  const briefe = d.eintraege.filter(x => x.kanal === 'brief' && x.status === 'entwurf');
  const freigebbar = stapel.filter(x => x.status === 'entwurf' && (!x.risiko || d.eigenesRisiko));
  // Gelbe Ampel (M1, 01.11.): nur einzeln freigebbar — nie in der Sammelauswahl.
  const sammelbar = freigebbar.filter(x => !x.gelb);
  const auswahl = sammelbar.filter(x => gewaehlt.has(x.id));
  const freigabeGrund = !d.postfaecher.length ? 'Kein eigenes Postfach im Business-Bereich — unter Inbox › Postfächer eines verbinden.' : !postfach ? 'Erst ein Absender-Postfach wählen.' : !auswahl.length ? 'Erst Mails auswählen (Häkchen).' : '';
  const setzeHaken = (id: string, an: boolean) => setGewaehlt(g => { const n = new Set(g); if (an) n.add(id); else n.delete(id); return n; });
  const sequenz = seq ?? d.sequenz;
  const platzhalter = Object.keys(PLATZHALTER.kampagne).map(k => `{{${k}}}`).join(' ');

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {meldung && <Hinweis art={meldung.art} rolle="status" aktion={<Knopf leise onClick={() => setMeldung(null)}>ok</Knopf>}>{meldung.text}</Hinweis>}

      {/* Sequenz je Ziel */}
      <div>
        <Ueberschrift rechts={seq ? <span style={{ display: 'flex', gap: 8 }}><Knopf leise onClick={() => setSeq(null)}>Verwerfen</Knopf><Knopf haupt onClick={async () => { const r = await tun({ aktion: 'sequenz', sequenz: seq, ...(neuJeTag ? { neuJeTag: Number(neuJeTag) } : {}) }, 'Sequenz gespeichert.'); if (r.ok) setSeq(null); }}>Sequenz speichern</Knopf></span> : <Knopf leise onClick={() => { setSeq(d.sequenz.length ? d.sequenz : [{ id: 'q1', tagAbstand: 0, kanal: 'mail', betreff: '', text: '' }]); setNeuJeTag(d.neuJeTag ? String(d.neuJeTag) : ''); }}>{d.sequenz.length ? 'Sequenz bearbeiten' : 'Sequenz anlegen'}</Knopf>}>Sequenz je Ziel</Ueberschrift>
        {!sequenz.length && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Ohne Sequenz bleibt die Kampagne wie bisher. Mit Sequenz läuft jede Person bzw. Firma ihre Schritte selbst ab — z. B. Mail an Tag 0, Anruf an Tag 3; eine Antwort, eine Abmeldung oder ein Rückläufer stoppt sie.</div>}
        {sequenz.map((s, i) => (
          <div key={s.id} style={{ display: 'grid', gap: 6, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>
              <b style={{ color: C.ink }}>Schritt {i + 1}</b>
              {seq ? (
                <>
                  <select aria-label="Kanal" value={s.kanal} onChange={e => setSeq(sequenz.map((x, j) => (j === i ? { ...x, kanal: e.target.value as SequenzKanal } : x)))} style={{ ...eingabe, width: 'auto' }}>
                    {SEQUENZ_KANAELE.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                  </select>
                  <span style={{ color: C.inkDim }}>{i ? 'Tage nach dem vorigen' : 'Tage nach dem Start'}</span>
                  <input aria-label="Tag-Abstand" type="number" min={0} max={120} value={s.tagAbstand} onChange={e => setSeq(sequenz.map((x, j) => (j === i ? { ...x, tagAbstand: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x)))} style={{ ...eingabe, width: 80 }} />
                  <Knopf leise onClick={() => setSeq(sequenz.filter((_, j) => j !== i))}>Entfernen</Knopf>
                </>
              ) : <span style={{ color: C.inkDim }}>{SEQUENZ_KANAELE.find(k => k.id === s.kanal)?.label} · {i ? `${s.tagAbstand} Tage danach` : `Tag ${s.tagAbstand}`} — {SEQUENZ_KANAELE.find(k => k.id === s.kanal)?.was}</span>}
            </div>
            {seq && (s.kanal === 'mail' || s.kanal === 'brief') && (
              <>
                {s.kanal === 'mail' && <input aria-label="Betreff" placeholder="Betreff" value={s.betreff ?? ''} onChange={e => setSeq(sequenz.map((x, j) => (j === i ? { ...x, betreff: e.target.value } : x)))} style={eingabe} />}
                <textarea aria-label="Text" placeholder="Text mit Platzhaltern" rows={6} value={s.text ?? ''} onChange={e => setSeq(sequenz.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} style={eingabe} />
              </>
            )}
            {seq && s.kanal !== 'mail' && s.kanal !== 'brief' && <textarea aria-label="Leitfaden" placeholder="Leitfaden (optional)" rows={3} value={s.leitfaden ?? ''} onChange={e => setSeq(sequenz.map((x, j) => (j === i ? { ...x, leitfaden: e.target.value } : x)))} style={eingabe} />}
          </div>
        ))}
        {seq && ((d.zahlen.offen ?? 0) + (d.zahlen.wartet ?? 0)) > 0 && (
          <Hinweis art="achtung">{(d.zahlen.offen ?? 0) + (d.zahlen.wartet ?? 0)} Ziele laufen gerade. Ihr Stand hängt am Schritt, nicht an seiner Stelle — ein neuer Schritt verschiebt niemanden; wer an einem entfernten Schritt steht, endet beim nächsten Lauf.</Hinweis>
        )}
        {seq && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Knopf leise onClick={() => setSeq([...sequenz, { id: `q-${crypto.randomUUID()}`, tagAbstand: 3, kanal: 'anruf' }])}>+ Schritt</Knopf>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Neue Ziele je Tag</span>
              <input aria-label="Neue Ziele je Tag" type="number" min={1} max={200} value={neuJeTag} placeholder="4" onChange={e => setNeuJeTag(e.target.value)} style={{ ...eingabe, width: 80 }} />
            </div>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Platzhalter: {platzhalter}. Unbekannte Platzhalter oder ein Wert, den es für ein Ziel nicht gibt, machen den Entwurf zum Fehler — nie eine Mail mit Lücke. Abmeldelink, Absender/Impressum und (bei Fremddaten) der Datenschutz-Hinweis stehen automatisch unter jeder Mail.</div>
          </div>
        )}
      </div>

      {d.schritte.length > 0 && (
        <div>
          <Ueberschrift rechts={`${d.zahlen.gesamt ?? 0} Ziele · ${d.zahlen.reagiert ?? 0} reagiert · ${d.zahlen.gestoppt ?? 0} gestoppt`}>Trichter je Schritt</Ueberschrift>
          <Raster min={120}>
            {d.schritte.map((s, i) => <Zahl key={s.id} wert={`${s.erreicht} → ${s.reagiert}`} label={`${i + 1} · ${SEQUENZ_KANAELE.find(k => k.id === s.kanal)?.label}: erreicht → reagiert${s.gespraech ? ` · ${s.gespraech} Gespräch${s.chance ? ` · ${s.chance} Chance` : ''}` : ''}`} />)}
          </Raster>
        </div>
      )}

      {/* Mail-Stapel */}
      {(stapel.length > 0 || d.sequenz.some(s => s.kanal === 'mail')) && (
        <div>
          <Ueberschrift rechts={<Knopf leise onClick={() => tun({ aktion: 'vorbereiten' }, 'Vorbereitet.')}>Jetzt vorbereiten</Knopf>}>Mail-Stapel</Ueberschrift>
          {d.status !== 'aktiv' && <Hinweis art="info">Die Kampagne ist nicht aktiv — erst den Status auf „Aktiv“ stellen. Vorher starten keine Ziele, und es entstehen keine Entwürfe.</Hinweis>}
          {d.risikoPlaybook && (
            <Hinweis art={d.eigenesRisiko ? 'kritisch' : 'achtung'}>
              {d.eigenesRisiko ? `Mails mit roter Kanal-Ampel gehen auf eigenes Risiko — eingeschaltet von ${d.eigenesRisiko.von ?? '—'} am ${tag(d.eigenesRisiko.seit)} (Homepage-Funde). Jede Freigabe trägt diesen Vermerk.` : 'Kanal-Ampel rot: diese Entwürfe lassen sich erst freigeben, wenn ein Inhaber unter Homepage-Funde „eigenes Risiko“ einschaltet.'}
            </Hinweis>
          )}
          {!stapel.length && <Leer>Kein Entwurf offen — fällige Mail-Schritte erscheinen hier.</Leer>}
          {stapel.map(x => (
            <div key={x.id} style={{ display: 'grid', gap: 6, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>
                <input type="checkbox" aria-label={`${x.an.name} auswählen`} disabled={!sammelbar.includes(x)} checked={gewaehlt.has(x.id)} onChange={e => setzeHaken(x.id, e.target.checked)} style={{ width: 22, height: 22 }} />
                <b style={{ color: C.ink }}>{x.an.name}</b>
                <span style={{ color: C.inkLeise }}>{x.an.email}</span>
                {x.risiko && <Chip farbe={LEUCHT.kritisch}>Ampel rot</Chip>}
                {x.gelb && <Chip farbe={LEUCHT.achtung}>Ampel gelb — nur einzeln</Chip>}
                {x.bearbeitet?.zoe && <KiMarke />}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <Knopf leise onClick={() => setOffen(offen === x.id ? null : x.id)}>{offen === x.id ? 'Zu' : 'Vorschau'}</Knopf>
                  <Knopf leise onClick={() => setBearbeiten({ id: x.id, betreff: x.betreff, text: x.text })}>Bearbeiten</Knopf>
                  {x.status === 'entwurf' && <Knopf leise onClick={() => tun({ aktion: 'feinschliff', id: x.id }, 'ZOE hat den Entwurf überarbeitet — bitte lesen.')}>Mit ZOE schärfen</Knopf>}
                  {x.gelb && freigebbar.includes(x) && <Knopf leise aus={!postfach} titel={!postfach ? 'Erst ein Absender-Postfach wählen.' : undefined} onClick={() => tun({ aktion: 'freigeben', ids: [x.id], postfach })}>Einzeln freigeben</Knopf>}
                  <Knopf leise onClick={() => tun({ aktion: 'verwerfen', ids: [x.id] }, 'Verworfen — das Ziel läuft in dieser Kampagne nicht weiter.')}>Verwerfen</Knopf>
                </span>
              </div>
              {x.status === 'fehler' && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{x.fehler}</div>}
              {x.gelb && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>Kanal-Ampel gelb: {x.gelb}</div>}
              {offen === x.id && <div style={{ fontSize: TYP.bedien, color: C.inkDim, whiteSpace: 'pre-wrap', lineHeight: 1.5, background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: 10 }}><b style={{ color: C.ink }}>{x.betreff}</b>{'\n\n'}{x.text}{'\n\n'}<span style={{ color: C.inkLeise }}>— Absender/Impressum · Datenschutz-Hinweis (bei Fremddaten) · Abmeldelink kommen beim Versand dazu.</span></div>}
              {bearbeiten?.id === x.id && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <input aria-label="Betreff" value={bearbeiten.betreff} onChange={e => setBearbeiten({ ...bearbeiten, betreff: e.target.value })} style={eingabe} />
                  <textarea aria-label="Text" rows={8} value={bearbeiten.text} onChange={e => setBearbeiten({ ...bearbeiten, text: e.target.value })} style={eingabe} />
                  <div style={{ display: 'flex', gap: 8 }}><Knopf haupt onClick={async () => { const r = await tun({ aktion: 'entwurf', ...bearbeiten }, 'Entwurf gespeichert.'); if (r.ok) setBearbeiten(null); }}>Speichern</Knopf><Knopf leise onClick={() => setBearbeiten(null)}>Abbrechen</Knopf></div>
                </div>
              )}
            </div>
          ))}
          {freigebbar.length > 0 && (
            <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {sammelbar.length > 0 && <Knopf leise onClick={() => setGewaehlt(new Set(auswahl.length === sammelbar.length ? [] : sammelbar.map(x => x.id)))}>{auswahl.length === sammelbar.length ? 'Keine' : 'Alle'} auswählen</Knopf>}
                <select aria-label="Absender-Postfach" value={postfach} onChange={e => setPostfach(e.target.value)} style={{ ...eingabe, width: 'auto' }}>
                  {!d.postfaecher.length && <option value="">kein eigenes Business-Postfach</option>}
                  {d.postfaecher.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {sammelbar.length > 0 && <Knopf haupt aus={!!freigabeGrund} titel={freigabeGrund || undefined} onClick={async () => { const r = await tun({ aktion: 'freigeben', ids: auswahl.map(x => x.id), postfach }); if (r.ok) setGewaehlt(new Set()); }}>{`Ausgewählte freigeben (${auswahl.length})`}</Knopf>}
              </div>
              {freigabeGrund && sammelbar.length > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{freigabeGrund}</div>}
            </div>
          )}
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>Gesendet wird nach der Freigabe werktags zwischen 8 und 18 Uhr, höchstens {d.einstellungen.tagesgrenze} Mails je Tag und Postfach, aus deinem Postfach. Antworten, Rückläufer und Abmeldungen stoppen die Sequenz von selbst.</div>
        </div>
      )}

      {unterwegs.length > 0 && (
        <div>
          <Ueberschrift rechts={`${unterwegs.filter(x => x.status === 'gesendet').length} gesendet`}>Versand</Ueberschrift>
          {unterwegs.slice(-40).reverse().map(x => (
            <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '5px 0', fontSize: TYP.bedien, color: C.inkDim, borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <span style={{ color: C.ink }}>{x.an.name}</span>
              <span>{STATUS_NAME[x.status] ?? x.status}{x.gesendet ? ` · ${tag(x.gesendet.am)}` : ''}{x.rueckfluss ? ` · ${x.rueckfluss.art === 'antwort' ? 'Antwort kam' : x.rueckfluss.art === 'bounce' ? 'Rückläufer' : 'abgemeldet'}` : ''}</span>
              {x.freigabe && <span style={{ color: C.inkLeise }}>freigegeben von {x.freigabe.von} am {tag(x.freigabe.am)}{x.freigabe.eigenesRisiko ? ` — auf eigenes Risiko (Schalter von ${x.freigabe.eigenesRisiko.von} seit ${tag(x.freigabe.eigenesRisiko.seit)})` : ''}</span>}
              {x.fehler && <span style={{ color: LEUCHT.achtung }}>{x.fehler}</span>}
              {(x.status === 'unklar' || (x.status === 'fehler' && x.freigabe)) && <Knopf leise onClick={() => tun({ aktion: 'erneut', ids: [x.id] }, 'Zurück im Entwurf.')}>Erneut vorbereiten</Knopf>}
            </div>
          ))}
        </div>
      )}

      {briefe.length > 0 && (
        <div>
          <Ueberschrift rechts={<Knopf leise onClick={() => tun({ aktion: 'gedruckt', ids: briefe.map(x => x.id) }, 'Als gedruckt vermerkt — die Sequenz läuft weiter.')}>{`Alle ${briefe.length} als gedruckt markieren`}</Knopf>}>Druckliste (Briefe)</Ueberschrift>
          {briefe.map(x => (
            <details key={x.id} style={{ padding: '6px 0', fontSize: TYP.bedien, color: C.inkDim, borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <summary style={{ cursor: 'pointer', color: C.ink }}>{x.an.name}{x.an.ort ? ` · ${x.an.ort}` : ' · Anschrift fehlt'}{x.fehler ? ` — ${x.fehler}` : ''}</summary>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: 6 }}>{x.text}</div>
            </details>
          ))}
        </div>
      )}

      {d.istInhaber && <VersandEinstellungen d={d} tun={tun} />}
    </div>
  );
}

function VersandEinstellungen({ d, tun }: { d: Daten; tun: (b: Record<string, unknown>, gut?: string) => Promise<unknown> }) {
  const [auf, setAuf] = useState(false);
  const [grenze, setGrenze] = useState(String(d.einstellungen.tagesgrenze));
  const [fuss, setFuss] = useState(d.einstellungen.fusszeile);
  const [art14, setArt14] = useState(d.einstellungen.art14Text);
  if (!auf) return <div><Knopf leise onClick={() => setAuf(true)}>Versand-Einstellungen (Instanz)</Knopf></div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Ueberschrift>Versand-Einstellungen (gelten für alle Kampagnen)</Ueberschrift>
      <label style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>Mails je Tag und Postfach (höchstens {d.einstellungen.tagesgrenzeMax})
        <input type="number" min={1} max={d.einstellungen.tagesgrenzeMax} value={grenze} onChange={e => setGrenze(e.target.value)} style={{ ...eingabe, width: 100 }} /></label>
      <label style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>Absender und Impressum (steht unter jeder Kampagnen-Mail — ohne sie geht keine raus)
        <textarea rows={3} value={fuss} onChange={e => setFuss(e.target.value)} style={eingabe} /></label>
      <label style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>Datenschutz-Hinweis bei Fremddaten (Art. 14) — leer = Vorgabe
        <textarea rows={3} value={art14} placeholder={d.einstellungen.art14Vorgabe} onChange={e => setArt14(e.target.value)} style={eingabe} /></label>
      <Knopf haupt onClick={() => tun({ aktion: 'einstellungen', tagesgrenze: Number(grenze), fusszeile: fuss, art14Text: art14 }, 'Versand-Einstellungen gespeichert.')}>Speichern</Knopf>
      {/* Willkommens-Mails (M1, 01.11.): eigene Karte unter Website › Formulare & Termine — Schalter, Texte und wer welche Stufe bekam. */}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Willkommens-Mails nach Einwilligung: {d.einstellungen.willkommen ? `an seit ${tag(d.einstellungen.willkommen.seit)}` : 'aus'} — einstellen unter <Link href={WEG.website('formulare')} style={{ color: C.aktiv }}>Website › Formulare & Termine</Link>.</div>
    </div>
  );
}
