'use client';

import Link from 'next/link';
import { WEG } from '@/lib/wege';

// ─── Markttraktion · Marketing › Homepage-Funde (30.10.2026, KAMPAGNE_HOMEPAGE_PLAN.md) ──────────────────────────────────────
// Die eine Stelle der Kampagne „Homepage“: einrichten (Kampagne + Segment), Gebiete/Branchen/Menge, Absender, Angebot, „eigenes Risiko“
// (nur Inhaber, Hinweis bleibt sichtbar), Lauf jetzt, Fund von Hand (z. B. auf Google Maps gesehen), die Funde mit Bewertung, Vorschau,
// Mail-Entwurf und Anruf-Leitfaden. Übernehmen/Senden = Freigabe im ZOE-Stapel (hier als Knopf, derselbe Weg). Zahlen nur vom Server.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Raster, Zahl, Hinweis, Schalter, LEUCHT, useRueckfrage } from '../../ui';
import { datum } from '../daten';

interface Fund {
  id: string; name: string; branche: string; kategorie?: string; quelle: 'osm' | 'hand'; gebiet?: string; website?: string; email?: string; telefon?: string; mobil?: string;
  inhaber?: string; inhaberArt?: 'person' | 'firma'; instagram?: string; quellen?: Record<string, string>;
  analyse?: { niveau: number; design?: number; luecken: string[]; aufhaenger: string[]; leistung?: { lcpMs?: number } };
  adresse?: { strasse?: string; hausnummer?: string; plz?: string; ort?: string };
  bewertung?: { punkte: number; gruende: string[] }; entwurf?: { betreff: string; text: string; anruf: string };
  status: 'neu' | 'vorbereitet' | 'uebernommen' | 'gesendet' | 'verworfen' | 'gesperrt'; grund?: string; angelegt: string;
  vorschlagId?: string; kontaktId?: string; firmaId?: string; gesendet?: { am: string; ueber: string }; post?: { am: string }; angesehenAm?: string;
}
interface Daten {
  istInhaber: boolean; eingerichtet: boolean; kampagne?: { id: string; name: string; status: string };
  einstellungen: { stadt?: string; gebiete: string[]; gebietIndex: number; branchen: string[]; jeAbend: number; produktId?: string; arten?: string[]; nurMitMail: boolean; nurMitTelefon: boolean; absender: { postfach: string; person: string; eigenes: boolean } | null; eigenesRisiko: { seit: string; von: string } | null };
  risikoHinweis: string; namensnennung: string; funde: Fund[];
  zahlen: { vorbereitet: number; uebernommen: number; gesendet: number; verworfen: number; angesehen: number; mitHandy: number; mitTelefon: number };
  lauf?: { tag: string; gebiet?: string; geholt: number; vorbereitet: number; fehler?: string };
  produkte: { id: string; name: string }[]; branchen: { id: string; name: string }[];
  gebietsVorlagen: { id: string; name: string; stadt: string; gebiete: string[] }[];
  artenVorlagen: { id: string; name: string; arten: string[] }[];
  absenderWahl?: { id: string; name: string }[];
}

const STATUS: Record<Fund['status'], { text: string; farbe: string }> = {
  neu: { text: 'neu', farbe: C.inkLeise }, vorbereitet: { text: 'wartet auf Freigabe', farbe: LEUCHT.achtung }, uebernommen: { text: 'übernommen', farbe: C.aktiv },
  gesendet: { text: 'Mail gesendet', farbe: LEUCHT.gut }, verworfen: { text: 'verworfen', farbe: C.inkLeise }, gesperrt: { text: 'gesperrt', farbe: LEUCHT.kritisch },
};
const FELD = { minHeight: 44, borderRadius: 8, background: C.flaeche, color: C.ink, border: `1px solid ${C.linie}`, padding: '0 10px', fontSize: 16 } as const;

async function post(url: string, body: Record<string, unknown>): Promise<{ ok: boolean; fehler?: string; text?: string }> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok && d.ok !== false, fehler: d.fehler ?? d.error, text: d.text ?? d.ergebnis };
}

export function Funde({ zuKontakt }: { zuKontakt: (id: string) => void }) {
  const [d, setD] = useState<Daten | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch'; text: string } | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'offen' | 'alle'>('offen');
  const [hand, setHand] = useState<Record<string, string> | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();

  const laden = useCallback(async () => {
    const r = await fetch('/api/crm/funde', { cache: 'no-store' });
    const x = await r.json().catch(() => ({}));
    if (r.ok && x.ok) setD(x as Daten); else setMeldung({ art: 'kritisch', text: String(x.fehler ?? 'Die Funde ließen sich nicht laden.') });
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const tun = async (body: Record<string, unknown>, url = '/api/crm/funde') => {
    setMeldung(null);
    const r = await post(url, body);
    setMeldung(r.ok ? (r.text ? { art: 'gut', text: r.text } : null) : { art: 'kritisch', text: r.fehler ?? 'Das hat nicht geklappt.' });
    await laden();
    return r.ok;
  };

  if (!d) return <Karte><Leer>{meldung?.text ?? 'Lade die Homepage-Funde …'}</Leer></Karte>;
  const e = d.einstellungen;
  const sichtbar = d.funde.filter(f => filter === 'alle' || f.status === 'vorbereitet' || f.status === 'neu' || f.status === 'uebernommen');

  return (
    <>
      {dialog}
      <Karte>
        <Ueberschrift>Kampagne „Homepage“</Ueberschrift>
        <p style={{ margin: '0 0 10px', fontSize: TYP.bedien, color: C.inkDim }}>
          Jeden Abend sucht der Agent Betriebe ohne oder mit schlechter Website, prüft sie und bereitet eine Vorschau der neuen Seite, eine Mail und einen Anruf-Leitfaden vor. Nichts geht raus, bevor jemand im ZOE-Stapel freigibt.
        </p>
        <Hinweis art={e.eigenesRisiko ? 'kritisch' : 'achtung'} titel={e.eigenesRisiko ? `Mail + Anruf auf eigenes Risiko — eingeschaltet von ${e.eigenesRisiko.von} am ${datum(e.eigenesRisiko.seit.slice(0, 10))}` : 'Kanal-Ampel rot: Kaltmail und Kaltanruf'}>
          {d.risikoHinweis}
        </Hinweis>
        {!d.eingerichtet ? (
          <div style={{ marginTop: 12 }}>
            {d.istInhaber ? <Knopf haupt onClick={async () => { await tun({ aktion: 'einrichten' }); }}>Kampagne und Segment einrichten</Knopf>
              : <Leer>Ein Inhaber richtet die Kampagne ein.</Leer>}
          </div>
        ) : d.istInhaber && (
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <Schalter an={!!e.eigenesRisiko} onChange={async an => {
              if (an && !(await bestaetigen({ titel: 'Mail und Anruf ohne Einwilligung freischalten?', text: `${d.risikoHinweis} Gesendet wird trotzdem nur nach Freigabe im Stapel — je Betrieb genau eine Mail mit Abmeldelink.`, ja: 'Auf eigenes Risiko freischalten', gefahr: true }))) return;
              await tun({ aktion: 'risiko', an });
            }} erklaerung="funde.eigenesRisiko">
              Mail senden (eigenes Risiko)
            </Schalter>
            <label style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>
              Gebiete
              <select value="" onChange={ev => { const v = d.gebietsVorlagen.find(x => x.id === ev.target.value); if (v) void tun({ aktion: 'einstellungen', stadt: v.stadt, gebiete: v.gebiete }); }} style={FELD}>
                <option value="">{e.stadt ? `${e.stadt} · ${e.gebiete.length} Gebiete (nächstes: ${e.gebiete[e.gebietIndex % Math.max(1, e.gebiete.length)] ?? '—'})` : '— Vorlage wählen —'}</option>
                {d.gebietsVorlagen.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {d.branchen.map(b => {
                const an = e.branchen.includes(b.id);
                return <Knopf key={b.id} leise={!an} onClick={async () => { await tun({ aktion: 'einstellungen', branchen: an ? e.branchen.filter(x => x !== b.id) : [...e.branchen, b.id] }); }}>{`${an ? '✓ ' : ''}${b.name}`}</Knopf>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {d.artenVorlagen.map(v => {
                const an = !!e.arten && v.arten.every(a => e.arten!.includes(a)) && e.arten.length === v.arten.length;
                return <Knopf key={v.id} leise={!an} onClick={async () => { await tun({ aktion: 'einstellungen', arten: an ? [] : v.arten }); }}>{`${an ? '✓ ' : ''}${v.name}`}</Knopf>;
              })}
              <Knopf leise={!e.nurMitTelefon} onClick={async () => { await tun({ aktion: 'einstellungen', nurMitTelefon: !e.nurMitTelefon }); }}>{`${e.nurMitTelefon ? '✓ ' : ''}Nur mit Telefonnummer`}</Knopf>
              <Knopf leise={!e.nurMitMail} onClick={async () => { await tun({ aktion: 'einstellungen', nurMitMail: !e.nurMitMail }); }}>{`${e.nurMitMail ? '✓ ' : ''}Nur mit Mail-Adresse`}</Knopf>
            </div>
            <label style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>
              Funde je Abend
              <select value={e.jeAbend} onChange={ev => void tun({ aktion: 'einstellungen', jeAbend: Number(ev.target.value) })} style={FELD}>
                {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>
              Angebot in der Mail (aus dem Katalog)
              <select value={e.produktId ?? ''} onChange={ev => void tun({ aktion: 'einstellungen', produktId: ev.target.value })} style={FELD}>
                <option value="">— ohne Angebot —</option>
                {d.produkte.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>
              Absender-Postfach
              <select value={e.absender?.eigenes ? e.absender.postfach : ''} onChange={ev => void tun({ aktion: 'einstellungen', absender: ev.target.value || null })} style={FELD}>
                <option value="">{e.absender ? `${e.absender.person} · gewählt` : '— keins (keine Mail) —'}</option>
                {(d.absenderWahl ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf leise onClick={async () => { await tun({ aktion: 'lauf' }); }}>Jetzt suchen</Knopf>
              <Knopf leise onClick={() => setHand(h => (h ? null : { branche: 'gastro' }))}>Fund von Hand</Knopf>
              <label className="ui-knopf fassbar" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 14px', borderRadius: 10, border: `1px solid ${C.linie}`, color: C.ink, cursor: 'pointer', fontSize: TYP.bedien }}>
                Funde importieren (Datei)
                <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={async ev => {
                  const datei = ev.target.files?.[0];
                  ev.target.value = '';
                  if (!datei) return;
                  let inhalt: unknown;
                  try { inhalt = JSON.parse(await datei.text()); } catch { setMeldung({ art: 'kritisch', text: 'Die Datei ist kein gültiges JSON.' }); return; }
                  await tun({ aktion: 'import', datei: inhalt });
                }} />
              </label>
            </div>
          </div>
        )}
        {d.eingerichtet && !d.istInhaber && <div style={{ marginTop: 12 }}><Knopf leise onClick={() => setHand(h => (h ? null : { branche: 'gastro' }))}>Fund von Hand</Knopf></div>}
        {hand && (
          <form onSubmit={async ev => { ev.preventDefault(); if (await tun({ aktion: 'hand', fund: hand })) setHand(null); }} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <input required placeholder="Name des Betriebs" value={hand.name ?? ''} onChange={ev => setHand({ ...hand, name: ev.target.value })} style={FELD} />
            <select value={hand.branche} onChange={ev => setHand({ ...hand, branche: ev.target.value })} style={FELD}>{d.branchen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <input placeholder="Straße und Nr." value={hand.strasse ?? ''} onChange={ev => setHand({ ...hand, strasse: ev.target.value })} style={FELD} />
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 8 }}>
              <input placeholder="PLZ" value={hand.plz ?? ''} onChange={ev => setHand({ ...hand, plz: ev.target.value })} style={FELD} />
              <input placeholder="Ort" value={hand.ort ?? ''} onChange={ev => setHand({ ...hand, ort: ev.target.value })} style={FELD} />
            </div>
            <input placeholder="Website (falls vorhanden)" value={hand.website ?? ''} onChange={ev => setHand({ ...hand, website: ev.target.value })} style={FELD} />
            <input type="email" placeholder="Geschäftliche Mail (vom Betrieb veröffentlicht)" value={hand.email ?? ''} onChange={ev => setHand({ ...hand, email: ev.target.value })} style={FELD} />
            <input placeholder="Telefon" value={hand.telefon ?? ''} onChange={ev => setHand({ ...hand, telefon: ev.target.value })} style={FELD} />
            <div><Knopf haupt typ="submit">Als Fund vorbereiten</Knopf></div>
          </form>
        )}
        {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.art} titel={meldung.art === 'gut' ? 'Erledigt' : 'Nicht geklappt'}>{meldung.text}</Hinweis></div>}
      </Karte>

      <Raster min={150}>
        <Karte><Zahl wert={String(d.zahlen.vorbereitet)} label="warten auf Freigabe" farbe={d.zahlen.vorbereitet ? LEUCHT.achtung : undefined} /></Karte>
        <Karte><Zahl wert={String(d.zahlen.uebernommen)} label="übernommen, ohne Mail" /></Karte>
        <Karte><Zahl wert={String(d.zahlen.gesendet)} label="Mails gesendet" /></Karte>
        <Karte><Zahl wert={String(d.zahlen.mitHandy)} label="mit Handynummer" farbe={d.zahlen.mitHandy ? LEUCHT.gut : undefined} /></Karte>
        <Karte><Zahl wert={String(d.zahlen.angesehen)} label="Vorschau geöffnet" /></Karte>
      </Raster>

      <Karte>
        <Ueberschrift>Funde</Ueberschrift>
        {d.lauf && <p style={{ margin: '0 0 8px', fontSize: TYP.bedien, color: C.inkLeise }}>Letzter Lauf {datum(d.lauf.tag)}{d.lauf.gebiet ? ` · ${d.lauf.gebiet}` : ''} · {d.lauf.geholt} Betriebe gelesen · {d.lauf.vorbereitet} vorbereitet{d.lauf.fehler ? ` · ${d.lauf.fehler}` : ''}</p>}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Knopf leise={filter !== 'offen'} onClick={() => setFilter('offen')}>Offen</Knopf>
          <Knopf leise={filter !== 'alle'} onClick={() => setFilter('alle')}>Alle</Knopf>
        </div>
        {!sichtbar.length ? <Leer>{d.eingerichtet ? 'Noch keine offenen Funde. Der Agent sucht ab 20 Uhr — oder „Jetzt suchen“.' : 'Erst die Kampagne einrichten.'}</Leer> : (
          <Liste>
            {sichtbar.map(f => (
              <div key={f.id}>
                <Zeile aktiv={offen === f.id} onClick={() => setOffen(o => (o === f.id ? null : f.id))} titel={f.name}
                  unter={[d.branchen.find(b => b.id === f.branche)?.name, f.gebiet ?? f.adresse?.ort, f.website ? 'mit Website' : 'ohne Website', f.mobil || f.telefon ? null : 'keine Nummer', f.email ? 'Mail bekannt' : 'keine Mail', datum(f.angelegt.slice(0, 10))].filter(Boolean).join(' · ')}
                  rechts={<span style={{ display: 'inline-flex', gap: 6 }}>
                    {f.mobil ? <Chip farbe={LEUCHT.gut}>Handy</Chip> : f.telefon ? <Chip farbe={C.aktiv}>Festnetz</Chip> : null}
                    {f.analyse ? <Chip farbe={f.analyse.niveau < 35 ? LEUCHT.kritisch : LEUCHT.achtung}>{`Niveau ${f.analyse.niveau}`}</Chip>
                      : f.bewertung && <Chip farbe={f.bewertung.punkte >= 80 ? LEUCHT.kritisch : LEUCHT.achtung}>{`Bedarf ${f.bewertung.punkte}`}</Chip>}
                    <Chip farbe={STATUS[f.status].farbe}>{STATUS[f.status].text}</Chip>
                  </span>} />
                {offen === f.id && (
                  <div style={{ padding: '8px 4px 16px', display: 'grid', gap: 10 }}>
                    {f.analyse ? (
                      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>
                        <div style={{ color: C.ink }}>Website-Niveau {f.analyse.niveau} von 100 (unser Standard = 100){f.analyse.design ? ` · Gestaltung ${f.analyse.design}/5` : ''}{f.analyse.leistung?.lcpMs ? ` · lädt am Handy ${Math.round(f.analyse.leistung.lcpMs / 100) / 10} s` : ''}</div>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{f.analyse.luecken.map(g => <li key={g}>{g}</li>)}</ul>
                      </div>
                    ) : f.bewertung && <ul style={{ margin: 0, paddingLeft: 18, fontSize: TYP.bedien, color: C.inkDim }}>{f.bewertung.gruende.map(g => <li key={g}>{g}</li>)}</ul>}
                    <div style={{ display: 'grid', gap: 2, fontSize: TYP.bedien, color: C.ink }}>
                      {f.inhaber && <div>{f.inhaberArt === 'firma' ? 'Betreiber' : 'Inhaber'}: {f.inhaber}</div>}
                      {[f.adresse?.strasse && [f.adresse.strasse, f.adresse.hausnummer].filter(Boolean).join(' '), [f.adresse?.plz, f.adresse?.ort].filter(Boolean).join(' ')].filter(Boolean).length > 0 && <div>{[[f.adresse?.strasse, f.adresse?.hausnummer].filter(Boolean).join(' '), [f.adresse?.plz, f.adresse?.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>}
                      {f.email && <div>Mail: {f.email}</div>}
                      {f.mobil && <div>Handy: <Knopf leise href={`tel:${f.mobil}`}>{f.mobil}</Knopf></div>}
                      {f.telefon && <div>Telefon: <Knopf leise href={`tel:${f.telefon}`}>{f.telefon}</Knopf></div>}
                      {f.website && <div>Website: {f.website}</div>}
                      {f.instagram && <div>Instagram: <Knopf leise href={`https://www.instagram.com/${encodeURIComponent(f.instagram)}/`}>{`@${f.instagram}`}</Knopf></div>}
                      {f.quellen && <div style={{ color: C.inkLeise }}>Quellen: {Object.keys(f.quellen).join(', ')}</div>}
                    </div>
                    {f.grund && <Hinweis art="info" titel="Grund">{f.grund}</Hinweis>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Knopf leise onClick={() => { window.open(`/api/crm/funde/vorschau?id=${encodeURIComponent(f.id)}`, '_blank', 'noopener'); }}>Vorschau ansehen</Knopf>
                      {f.vorschlagId && f.status === 'vorbereitet' && <Knopf haupt onClick={async () => { await tun({ id: f.vorschlagId, entscheidung: 'freigeben' }, '/api/zoe/stapel'); }}>{e.eigenesRisiko && f.email ? 'Freigeben und Mail senden' : 'Freigeben (übernehmen)'}</Knopf>}
                      {(f.status === 'vorbereitet' || f.status === 'neu') && <Knopf leise onClick={async () => { if (await bestaetigen({ titel: 'Diesen Fund verwerfen?', text: 'Er kommt nicht wieder.', ja: 'Verwerfen' })) await tun({ aktion: 'verwerfen', id: f.id }); }}>Verwerfen</Knopf>}
                      {f.status === 'uebernommen' && !f.post && e.eigenesRisiko && f.email && <Knopf leise onClick={async () => { await tun({ aktion: 'senden', id: f.id }); }}>Mail senden</Knopf>}
                      {f.kontaktId && f.status !== 'vorbereitet' && <Knopf leise onClick={() => zuKontakt(f.kontaktId!)}>Zur Person</Knopf>}
                      {f.firmaId && f.status !== 'vorbereitet' && <Link href={WEG.firma(f.firmaId)} style={{ fontSize: TYP.bedien, color: C.aktiv, alignSelf: 'center' }}>Zur Firma ›</Link>}
                    </div>
                    {!f.gesendet && f.post && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Mail freigegeben am {datum(f.post.am.slice(0, 10))} — liegt im Mail-Stapel der Kampagne und geht werktags zwischen 8 und 18 Uhr gedrosselt raus.</div>}
                    {f.gesendet && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Gesendet am {datum(f.gesendet.am.slice(0, 10))} über {f.gesendet.ueber}{f.angesehenAm ? ` · Vorschau geöffnet am ${datum(f.angesehenAm.slice(0, 10))}` : ''}</div>}
                    {f.entwurf && (
                      <details>
                        <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.ink, minHeight: 44, display: 'flex', alignItems: 'center' }}>Mail-Entwurf und Anruf-Leitfaden</summary>
                        <div style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '6px 0' }}>Betreff: {f.entwurf.betreff}</div>
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: TYP.bedien, color: C.ink, background: C.flaeche, padding: 12, borderRadius: 8, margin: 0 }}>{f.entwurf.text}</pre>
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: TYP.bedien, color: C.inkDim, padding: '12px 0 0', margin: 0 }}>{f.entwurf.anruf}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Liste>
        )}
        <p style={{ margin: '10px 0 0', fontSize: TYP.bedien, color: C.inkLeise }}>Betriebsdaten: {d.namensnennung}</p>
      </Karte>
    </>
  );
}
