'use client';

// ─── Markttraktion · Vernetzen-Runde (25.09.) ───────────────────────────────
// Kevin: „erst vernetzen, dann schreiben … ein kompletter Flow in die
// Bearbeitung der Leute.“ Eine geführte Runde, Karte für Karte, für das eigene
// LinkedIn-Profil (Kevin und Malin getrennt). Jede Karte zeigt genau den
// nächsten Schritt der Person — und nach einem Schritt gleich den folgenden:
//   anreichern   Suchlink öffnen, Profiladresse einfügen (oder „nicht gefunden“)
//   anfragen     Profil öffnen, Anfrage schicken (mit Notiz aus der Kampagne)
//   schreiben    angenommen: Text aus der Kampagne kopieren, Profil öffnen, abhaken
//   nachfassen   Reaktion festhalten (Ja → Einwilligung mit Wortlaut, Gespräch, kein Interesse)
//   zurückziehen Anfrage älter als 21 Tage
// Oben: die Kampagne (Texte modular je Kampagne), die Tagesportion und der
// Import des LinkedIn-Exports (Connections.csv — Annahmen kommen so von selbst).
// MAKE OS versendet nichts: Es öffnet LinkedIn und kopiert den Text.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { markttraktion } from '@/lib/crm/adresse';
import type { Kampagne } from '@/lib/crm/typen';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Leer, Fortschritt, feld, LEUCHT } from '../schlank';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { netzRunde, netzStufe, suchLink, profilAdresse, textFuer, vernetzenStandard, vernetzenAmpel, vorlage as vorlageVon, VORLAGEN, NOTIZ_MAX, type NetzStufe, type VernetzenEinstellung, type VorlageId } from '@/lib/crm/netzwerk';
import { nameVon } from '@/lib/crm/team';
import { type CrmApi, datum } from './daten';
import { Pillen, Feldzeile, Feld } from './teile';

const STUFE_TEXT: Record<NetzStufe, string> = { anreichern: 'Profil finden', anfragen: 'Vernetzen', warten: 'Anfrage läuft', zurueckziehen: 'Anfrage zurückziehen', schreiben: 'Angenommen — schreiben', nachfassen: 'Nachfassen', fertig: 'Erledigt', raus: 'Raus' };
const STUFE_FARBE: Record<NetzStufe, string> = { anreichern: LEUCHT.achtung, anfragen: LEUCHT.business, warten: C.inkDim, zurueckziehen: C.inkLeise, schreiben: LEUCHT.gut, nachfassen: LEUCHT.puls, fertig: LEUCHT.gut, raus: C.inkLeise };
const neuerTab = (url: string) => { try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* Popup blockiert — der Link steht daneben */ } };
const kopieren = async (t: string) => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };
const kleinText = { fontSize: 12.5, color: C.inkLeise, lineHeight: 1.5 } as const;

export function VernetzenRunde({ api, kampagneId, zuKontakt, zurueck, zuKampagne }: { api: CrmApi; kampagneId?: string; zuKontakt: (id: string) => void; zurueck: () => void; zuKampagne: (id: string | null) => void }) {
  const ich = api.ich ?? 'kevin';
  const heute = api.crm?.heute ?? '';
  const kampagnen = useMemo(() => (api.crm?.stand.kampagnen ?? []).filter(k => k.playbook === 'vernetzen' && k.status !== 'abgebrochen'), [api.crm]);
  const kampagne = kampagneId ? kampagnen.find(k => k.id === kampagneId) : undefined;
  const einst: VernetzenEinstellung = kampagne?.vernetzen ?? vernetzenStandard();
  const [liste, setListe] = useState<string[] | null>(null);
  const [pos, setPos] = useState(0);
  const [erledigt, setErledigt] = useState(0);
  const [importOffen, setImportOffen] = useState(false);
  // Die Liste wird beim Start festgehalten — sonst springt „3 von 18“, weil jeder Schritt die Person woanders einsortiert.
  useEffect(() => { setListe(null); setPos(0); }, [kampagneId]);
  useEffect(() => {
    if (!liste && api.kontakte && api.crm) setListe(netzRunde(api.kontakte, ich, api.crm.heute, { kampagne }).karten.map(k => k.kontakt.id));
  }, [liste, api.kontakte, api.crm, ich, kampagne]);
  const nachId = useMemo(() => new Map((api.kontakte ?? []).map(k => [k.id, k])), [api.kontakte]);
  const zahlen = useMemo(() => (api.kontakte && heute ? netzRunde(api.kontakte, ich, heute, { kampagne }).zahlen : null), [api.kontakte, heute, ich, kampagne]);
  const k = liste ? nachId.get(liste[pos] ?? '') : undefined;
  const karteRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = karteRef.current; if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [pos]);

  const weiter = (gezaehlt = true) => { if (gezaehlt) setErledigt(e => e + 1); setPos(p => p + 1); };
  const schritt = async (body: Record<string, unknown>) => api.netzwerk({ ...body, ...(kampagne ? { kampagneId: kampagne.id } : {}) });

  if (!liste || !zahlen) return <Karte i={0}><Leer>Die Runde wird vorbereitet …</Leer></Karte>;
  const ampel = vernetzenAmpel(einst);

  return (
    <>
      <Karte i={0} akzent={LEUCHT.business}>
        <Ueberschrift farbe={LEUCHT.business} rechts={<span style={{ fontVariantNumeric: 'tabular-nums' }}><b style={{ color: C.ink }}>{Math.min(pos + 1, liste.length)}</b> von {liste.length}</span>}>Vernetzen-Runde · Profil {nameVon(ich)}</Ueberschrift>
        <Fortschritt anteil={liste.length ? pos / liste.length : 1} farbe={LEUCHT.business} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <Chip farbe={zahlen.schreiben ? LEUCHT.gut : C.inkLeise}>{zahlen.schreiben} angenommen</Chip>
          <Chip farbe={zahlen.nachfassen ? LEUCHT.puls : C.inkLeise}>{zahlen.nachfassen} nachfassen</Chip>
          <Chip farbe={zahlen.restHeute ? LEUCHT.business : C.inkLeise}>heute noch {zahlen.restHeute} von {einst.proTag} Anfragen</Chip>
          <Chip farbe={C.inkDim}>{zahlen.warten} warten</Chip>
          <Chip farbe={zahlen.anreichern ? LEUCHT.achtung : C.inkLeise}>{zahlen.anreichern} ohne Profil</Chip>
          <Chip farbe={C.inkDim}>{zahlen.vernetzt} vernetzt</Chip>
          <span style={{ flex: 1 }} />
          <button onClick={zurueck} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: 0, fontFamily: SCHRIFT.text }}>Zur Kartei</button>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={kleinText}>Texte aus</span>
            <Pillen liste={[{ id: '', label: 'Standard' }, ...kampagnen.map(x => ({ id: x.id, label: x.name.slice(0, 40) }))]} aktiv={kampagne?.id ?? ''} onWahl={id => zuKampagne(id || null)} />
          </div>
          <div style={{ ...kleinText, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flex: '0 0 auto', background: ampel.ampel === 'gruen' ? LEUCHT.gut : LEUCHT.achtung }} />
            <span>{ampel.recht}{!kampagne && ' Eigene Texte je Kampagne: Kampagne „LinkedIn: vernetzen & anschreiben“ anlegen.'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf leise onClick={() => setImportOffen(!importOffen)}>{importOffen ? 'Import schließen' : 'LinkedIn-Export importieren'}</Knopf>
          </div>
          {importOffen && <ExportImport api={api} ich={ich} onFertig={() => { setImportOffen(false); setListe(null); setPos(0); }} />}
        </div>
      </Karte>

      <div ref={karteRef} style={{ scrollMarginTop: 84 }}>
        {k ? (
          <NetzKarte key={k.id} k={k} ich={ich} heute={heute} einst={einst} schritt={schritt} weiter={weiter} zuKontakt={zuKontakt} />
        ) : (
          <Karte i={1} akzent={LEUCHT.gut}>
            <Ueberschrift farbe={LEUCHT.gut}>{liste.length ? 'Runde geschafft' : 'Heute nichts zu tun'}</Ueberschrift>
            <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5 }}>
              {liste.length ? `${erledigt} Schritte erledigt.` : 'Keine Annahme wartet, die Tagesportion ist verbraucht und alle Profile sind gefunden.'}
              {zahlen.warten > 0 && ` ${zahlen.warten} Anfragen warten auf Annahme — der nächste Export-Import erkennt Annahmen von selbst.`}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <Knopf onClick={() => { setListe(null); setPos(0); setErledigt(0); }}>Neu zusammenstellen</Knopf>
              <Knopf leise onClick={zurueck}>Zurück zur Kartei</Knopf>
            </div>
          </Karte>
        )}
      </div>
    </>
  );
}

function NetzKarte({ k, ich, heute, einst, schritt, weiter, zuKontakt }: {
  k: Kontakt; ich: string; heute: string; einst: VernetzenEinstellung;
  schritt: (b: Record<string, unknown>) => Promise<{ ok: boolean; fehler?: string }>; weiter: (gezaehlt?: boolean) => void; zuKontakt: (id: string) => void;
}) {
  const { stufe, grund } = netzStufe(k, ich, heute, einst.folgeTage);
  const profil = profilAdresse(k.linkedin);
  const absender = nameVon(ich);
  const [url, setUrl] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const notizStart = textFuer(einst.notiz, k, einst.thema, absender);
  const [notiz, setNotiz] = useState(notizStart);
  const [text, setText] = useState(() => textFuer(einst.nachricht, k, einst.thema, absender));
  useEffect(() => { setNotiz(textFuer(einst.notiz, k, einst.thema, absender)); setText(textFuer(einst.nachricht, k, einst.thema, absender)); }, [einst, k.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const tun = async (body: Record<string, unknown>, dann: 'weiter' | 'bleiben' = 'weiter') => {
    setFehler(null);
    const r = await schritt({ id: k.id, ...body });
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht gespeichert.'); return; }
    if (dann === 'weiter') weiter();
  };
  const s = k.netzwerk?.[ich];
  const wo = [k.position ?? k.jobtitel, k.firma].filter(Boolean).join(' · ');

  return (
    <Karte i={1} akzent={STUFE_FARBE[stufe]}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip farbe={STUFE_FARBE[stufe]}>{STUFE_TEXT[stufe]}</Chip>
        {k.prio && <Chip farbe={C.inkDim}>Prio {k.prio}</Chip>}
        {k.kreis && <Chip farbe={LEUCHT.beziehung}>Kreis {k.kreis}</Chip>}
        <span style={{ flex: 1 }} />
        <button onClick={() => zuKontakt(k.id)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: 0, fontFamily: SCHRIFT.text }}>Zur Person →</button>
      </div>
      <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(22px, 4.2vw, 28px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15, marginTop: 10 }}>{anzeigename(k)}</div>
      {wo && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4 }}>{wo}</div>}
      <div style={{ ...kleinText, marginTop: 6 }}>{grund}{s?.angefragtAm && stufe !== 'anfragen' ? ` · angefragt ${datum(s.angefragtAm, heute)}` : ''}{s?.vernetztAm ? ` · vernetzt ${datum(s.vernetztAm, heute)}` : ''}</div>

      <div style={{ display: 'grid', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        {stufe === 'anreichern' && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf onClick={() => neuerTab(suchLink(k))}>Auf LinkedIn suchen ↗</Knopf>
              <Knopf leise onClick={() => void tun({ aktion: 'nicht_gefunden' })}>Nicht gefunden</Knopf>
              <Knopf leise onClick={() => weiter(false)}>Überspringen</Knopf>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Profiladresse einfügen (linkedin.com/in/…)" aria-label="LinkedIn-Profiladresse"
                onKeyDown={e => { if (e.key === 'Enter' && url.trim()) void tun({ aktion: 'profil', url }, 'bleiben'); }} style={{ ...feld, flex: 1, minWidth: 220, fontSize: TYP.bedien, padding: '9px 12px' }} />
              <Knopf aus={!url.trim()} onClick={() => void tun({ aktion: 'profil', url }, 'bleiben')}>Profil speichern</Knopf>
            </div>
            <div style={kleinText}>Nach dem Speichern geht es auf derselben Karte mit dem Vernetzen weiter.</div>
          </>
        )}

        {stufe === 'anfragen' && profil && (
          <>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={kleinText}>Notiz zur Anfrage (optional · {notiz.length}/{NOTIZ_MAX} Zeichen{notiz.length > NOTIZ_MAX ? ' — zu lang ohne Premium' : ''})</span>
              <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={3} aria-label="Notiz zur Vernetzungsanfrage" style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, lineHeight: 1.5, padding: '9px 12px', borderColor: notiz.length > NOTIZ_MAX ? `${LEUCHT.achtung}88` : undefined }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf onClick={async () => { if (notiz.trim()) setKopiert(await kopieren(notiz)); neuerTab(profil); }}>{notiz.trim() ? 'Notiz kopieren & Profil öffnen ↗' : 'Profil öffnen ↗'}</Knopf>
              <Knopf farbe={LEUCHT.gut} onClick={() => void tun({ aktion: 'angefragt' })}>Anfrage ist raus ✓</Knopf>
              <Knopf leise onClick={() => void tun({ aktion: 'vernetzt' }, 'bleiben')}>Schon vernetzt</Knopf>
              <Knopf leise onClick={() => weiter(false)}>Überspringen</Knopf>
            </div>
            {kopiert && <div style={kleinText}>Notiz kopiert — in LinkedIn „Vernetzen“ → „Nachricht hinzufügen“ und einfügen.</div>}
          </>
        )}

        {stufe === 'schreiben' && profil && (
          <>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={kleinText}>Nachricht nach der Annahme · {k.anrede === 'Du' ? 'Du' : 'Sie'} · aus {einst.vorlage === 'eigen' ? 'eigenem Text' : 'der Kampagnenvorlage'}</span>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={5} aria-label="Nachricht" style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, lineHeight: 1.55, padding: '10px 12px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf onClick={async () => { setKopiert(await kopieren(text)); neuerTab(profil); }}>Text kopieren & Profil öffnen ↗</Knopf>
              <Knopf farbe={LEUCHT.gut} aus={!text.trim()} onClick={() => void tun({ aktion: 'geschrieben', text })}>Nachricht ist raus ✓</Knopf>
              <Knopf leise onClick={() => weiter(false)}>Später</Knopf>
            </div>
            {kopiert && <div style={kleinText}>Text kopiert — im Profil „Nachricht“ öffnen und einfügen. Danach hier abhaken: Der nächste Schritt steht dann in {einst.folgeTage} Tagen an.</div>}
          </>
        )}

        {stufe === 'nachfassen' && (
          <>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Nachricht am {datum(s?.geschriebenAm, heute)} — hat die Person reagiert?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf farbe={LEUCHT.gut} onClick={() => void tun({ aktion: 'antwort', art: 'ja' })}>Ja, wir dürfen schreiben</Knopf>
              <Knopf onClick={() => void tun({ aktion: 'antwort', art: 'gespraech' })}>Gespräch vereinbart</Knopf>
              <Knopf leise onClick={() => void tun({ aktion: 'antwort', art: 'kein_interesse' })}>Kein Interesse</Knopf>
              {profil && <Knopf leise onClick={() => neuerTab(profil)}>Profil öffnen ↗</Knopf>}
              <Knopf leise onClick={() => weiter(false)}>Später</Knopf>
            </div>
            <div style={kleinText}>„Ja“ wird als Einwilligung für LinkedIn mit Wortlaut gespeichert — danach ist der Kanal grün. Ohne Reaktion: anrufen oder in ein paar Tagen noch einmal.</div>
          </>
        )}

        {stufe === 'zurueckziehen' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {profil && <Knopf leise onClick={() => neuerTab(profil)}>Profil öffnen ↗</Knopf>}
            <Knopf onClick={() => void tun({ aktion: 'zurueckgezogen' })}>Anfrage zurückgezogen</Knopf>
            <Knopf farbe={LEUCHT.gut} onClick={() => void tun({ aktion: 'vernetzt' }, 'bleiben')}>Doch angenommen</Knopf>
            <Knopf leise onClick={() => weiter(false)}>Überspringen</Knopf>
          </div>
        )}

        {(stufe === 'warten' || stufe === 'fertig' || stufe === 'raus') && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{stufe === 'warten' ? 'Anfrage ist raus — erledigt für heute.' : stufe === 'fertig' ? 'Erledigt.' : grund}</span>
            {stufe === 'warten' && <Knopf leise onClick={() => void tun({ aktion: 'vernetzt' }, 'bleiben')}>Wurde angenommen</Knopf>}
            <Knopf onClick={() => weiter(false)}>Weiter</Knopf>
          </div>
        )}
        {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}
      </div>
    </Karte>
  );
}

/** LinkedIn-Export (Connections.csv) der eigenen Verbindungen: erst Vorschau, dann übernehmen. */
export function ExportImport({ api, ich, onFertig }: { api: CrmApi; ich: string; onFertig: () => void }) {
  const [csv, setCsv] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<Record<string, unknown> | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const lesen = async (f: File | undefined) => {
    if (!f) return;
    setMeldung(null); setVorschau(null);
    const t = await f.text();
    setCsv(t);
    setLaeuft(true);
    const r = await api.netzwerk({ aktion: 'import', csv: t });
    setLaeuft(false);
    if (r.ok && r.vorschau) setVorschau(r.vorschau); else setMeldung(r.fehler ?? 'Nicht lesbar.');
  };
  const uebernehmen = async () => {
    if (!csv) return;
    setLaeuft(true);
    const r = await api.netzwerk({ aktion: 'import', csv, uebernehmen: true });
    setLaeuft(false);
    if (r.ok) { setMeldung(r.text ?? 'Übernommen.'); await api.laden(); setTimeout(onFertig, 1500); } else setMeldung(r.fehler ?? 'Nicht übernommen.');
  };
  const v = vorschau as { zeilen: number; treffer: number; neueProfile: number; neuVernetzt: number; ohneTreffer: number; beispiele: { name: string; wie: string }[] } | null;
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      <div style={kleinText}>
        In LinkedIn: Einstellungen → Datenschutz → „Kopie Ihrer Daten anfordern“ → „Kontakte“. Die Datei <b style={{ color: C.inkDim }}>Connections.csv</b> hier wählen.
        Abgeglichen wird nur mit Personen, die schon in der Kartei stehen — alle anderen bleiben draußen. Gilt für das Profil von {nameVon(ich)}.
      </div>
      <input type="file" accept=".csv,text/csv" aria-label="LinkedIn-Export wählen" onChange={e => void lesen(e.target.files?.[0])} style={{ fontSize: TYP.bedien, color: C.inkDim }} />
      {laeuft && <div style={kleinText}>Liest …</div>}
      {v && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>
            {v.zeilen} Verbindungen gelesen — <b>{v.treffer}</b> davon stehen in der Kartei: {v.neueProfile} bekommen ihr Profil, {v.neuVernetzt} werden als vernetzt mit {nameVon(ich)} markiert. {v.ohneTreffer} ohne Treffer bleiben draußen.
          </div>
          {v.beispiele.length > 0 && <div style={kleinText}>z. B. {v.beispiele.map(b => `${b.name}${b.wie === 'profil' ? '' : b.wie === 'name_firma' ? ' (Name + Firma)' : ' (Name)'}`).join(', ')}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Knopf aus={!v.treffer || laeuft} onClick={() => void uebernehmen()}>Übernehmen</Knopf>
            <Knopf leise onClick={onFertig}>Abbrechen</Knopf>
          </div>
        </div>
      )}
      {meldung && <div style={{ fontSize: TYP.bedien, color: meldung.includes('abgeglichen') ? LEUCHT.gut : LEUCHT.kritisch }}>{meldung}</div>}
    </div>
  );
}

/**
 * Die Texte einer Vernetzen-Kampagne — modular je Kampagne (Kevin 25.09.):
 * Vorlage wählen (mit Rechts-Ampel), Thema, Notiz zur Anfrage und Nachricht
 * nach der Annahme je Sie/Du, Folgetage und Tagesportion. Gespeichert wird die
 * ganze Einstellung als Einzeländerung an der Kampagne.
 */
export function VernetzenEinstellungen({ k, api }: { k: Kampagne; api: CrmApi }) {
  const router = useRouter();
  const e = k.vernetzen ?? vernetzenStandard();
  const setze = (teil: Partial<VernetzenEinstellung>) => void api.teil('kampagnen', k.id, { vernetzen: { ...e, ...teil } });
  const ampel = vernetzenAmpel(e);
  const beispiel = (api.kontakte ?? []).find(x => k.kontaktIds.includes(x.id)) ?? { vorname: 'Anna', nachname: 'Beispiel', firma: 'Beispiel GmbH', anrede: 'Sie' as const };
  const absender = nameVon(api.ich ?? 'kevin');
  const text = (label: string, wert: string, max: number | null, onFertig: (t: string) => void) => (
    <div style={{ display: 'grid', gap: 4 }}>
      <span style={kleinText}>{label}{max ? ` · ${wert.length}/${max}` : ''}</span>
      <textarea key={`${k.id}-${label}-${wert.length}`} defaultValue={wert} rows={3} aria-label={label} onBlur={ev => { if (ev.target.value !== wert) onFertig(ev.target.value); }}
        style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, lineHeight: 1.5, padding: '9px 12px', borderColor: max && wert.length > max ? `${LEUCHT.achtung}88` : undefined }} />
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: `${LEUCHT.business}0D`, border: `1px solid ${LEUCHT.business}33` }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: TYP.bedien }}>Vernetzen: Texte dieser Kampagne</b>
        <span style={{ flex: 1 }} />
        <Knopf onClick={() => router.push(markttraktion('kontakte', 'runde-vernetzen', k.id))}>Vernetzen-Runde starten</Knopf>
      </div>
      <Feldzeile label="Vorlage">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {VORLAGEN.map(v => (
            <button key={v.id} onClick={() => { const n = vorlageVon(v.id); setze({ vorlage: v.id as VorlageId, notiz: { ...n.notiz }, ...(v.id === 'eigen' ? {} : { nachricht: { ...n.nachricht } }) }); }} className="fassbar"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${e.vorlage === v.id ? LEUCHT.business : 'rgba(255,255,255,.1)'}`, background: e.vorlage === v.id ? `${LEUCHT.business}22` : 'transparent', color: e.vorlage === v.id ? C.ink : C.inkDim, fontFamily: SCHRIFT.text }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: v.ampel === 'gruen' ? LEUCHT.gut : LEUCHT.achtung }} />{v.label}
            </button>
          ))}
        </div>
      </Feldzeile>
      <div style={{ ...kleinText, display: 'flex', gap: 8 }}><span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flex: '0 0 auto', background: ampel.ampel === 'gruen' ? LEUCHT.gut : LEUCHT.achtung }} /><span>{ampel.recht}</span></div>
      <Feldzeile label="Thema {thema}"><Feld wert={e.thema} platzhalter="z. B. Wachstum mit KI im Mittelstand" onFertig={thema => setze({ thema: thema.trim() })} /></Feldzeile>
      {text('Nachricht nach der Annahme · Sie', e.nachricht.sie, null, sie => setze({ nachricht: { ...e.nachricht, sie } }))}
      {text('Nachricht nach der Annahme · Du', e.nachricht.du, null, du => setze({ nachricht: { ...e.nachricht, du } }))}
      {text('Notiz zur Anfrage · Sie (leer = ohne Notiz)', e.notiz.sie, NOTIZ_MAX, sie => setze({ notiz: { ...e.notiz, sie } }))}
      {text('Notiz zur Anfrage · Du', e.notiz.du, NOTIZ_MAX, du => setze({ notiz: { ...e.notiz, du } }))}
      <div style={kleinText}>Platzhalter: {'{vorname} {nachname} {firma} {thema} {absender}'}. Sie oder Du richtet sich nach der Anrede der Person.</div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ ...kleinText, display: 'inline-flex', gap: 8, alignItems: 'center' }}>Anfragen je Tag und Profil <Feld typ="number" breite={80} wert={String(e.proTag)} onFertig={v => setze({ proTag: Math.max(1, Math.min(40, Math.round(Number(v)) || 15)) })} /></label>
        <label style={{ ...kleinText, display: 'inline-flex', gap: 8, alignItems: 'center' }}>Nachfassen nach Tagen <Feld typ="number" breite={80} wert={String(e.folgeTage)} onFertig={v => setze({ folgeTage: Math.max(1, Math.min(60, Math.round(Number(v)) || 7)) })} /></label>
      </div>
      <div style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,.03)' }}>
        <span style={kleinText}>So liest es {anzeigename(beispiel)}:</span>
        <div style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{textFuer(e.nachricht, beispiel, e.thema, absender) || '— noch kein Text —'}</div>
      </div>
    </div>
  );
}
