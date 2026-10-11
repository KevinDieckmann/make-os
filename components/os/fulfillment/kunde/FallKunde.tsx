'use client';

// ─── Fulfillment · Fall › Kunde & Reports (C2, 10.10.; FULFILLMENT_KONZEPT.md 5.2, 5.4, 5.5) ────────────────────────────────────────────────────
// Intern je Mandat: Kunden-Link (Schalter der Instanz — nur Inhaber —, Link anlegen/verlängern/widerrufen, Rechte), Formulare mit den Antworten des
// Kunden (gemeinsam ausfüllen, exportieren — das Playbook gehört dem Kunden), Unterlagen (ungeprüft → freigegeben/gesperrt, Beleg, nur als Download),
// Kunden-Puls (Liste, Schwelle, Puls-Link, von Hand, „In die Health übernehmen“) und „So sieht der Kunde es“. Der 2-Wochen-Report selbst bleibt
// unter Produkte & Mandate › Mandat › Fortschritt (dort zeigt er mit Fall die neuen Abschnitte). Daten nur über /api/fulfillment/kunde{,/datei,/vorschau};
// der Server filtert (Business only). Das Token eines Links steht nur einmal hier — direkt nach „Link anlegen“ — und wird nirgends gespeichert.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Knopf, Hinweis, Ueberschrift, Chip, Leer, Schalter, Feldzeile, Erklaert, Zeile, eingabe, feld, LEUCHT, useRueckfrage } from '../../ui';
import { WEG } from '@/lib/wege';
import type { KundeStand, InternFormular } from '@/lib/fulfillment/kunde/server';
import type { KundenFormular } from '@/lib/fulfillment/kunde/sicht';
import { KUNDE_ANNEHMEN, ZWECK_TEXT } from '@/lib/fulfillment/kunde/upload';
import { FormularKarte, type SpeicherErgebnis } from './KundenAnsicht';
import { KundenAnsichtVorschau } from './KundenAnsichtVorschau';

const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const tag = (t?: string) => (t && /^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : t ?? '');
const STATUS_FARBE = { aktiv: LEUCHT.gut, abgelaufen: LEUCHT.achtung, widerrufen: C.inkLeise } as const;
const UNTERLAGE_FARBE = { ungeprueft: LEUCHT.achtung, freigegeben: LEUCHT.gut, gesperrt: LEUCHT.kritisch } as const;
const UNTERLAGE_TEXT = { ungeprueft: 'ungeprüft', freigegeben: 'freigegeben', gesperrt: 'gesperrt' } as const;

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; j: Record<string, unknown> }> {
  const r = await fetch('/api/fulfillment/kunde', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) as Record<string, unknown> : { fehler: 'Keine Verbindung.' };
  return { ok: !!r?.ok && j.ok !== false, status: r?.status ?? 0, j };
}

/** Ein internes Formular in der Form der Kunden-Sicht (für `FormularKarte`). */
const alsKundenFormular = (f: InternFormular): KundenFormular => ({
  schluessel: f.schluessel, titel: f.titel, prozent: f.prozent, stand: f.stand, antworten: f.antworten,
  abschnitte: f.abschnitte.map(a => ({ schluessel: a.schluessel, titel: a.titel, fertig: a.fertig, fragen: a.fragen.map(q => ({ id: q.id, frage: q.frage, art: q.art as KundenFormular['abschnitte'][number]['fragen'][number]['art'], ...(q.optionen ? { optionen: q.optionen } : {}) })) })),
});

export function FallKunde({ mandatId }: { mandatId: string }) {
  const [s, setS] = useState<KundeStand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'achtung'; text: string } | null>(null);
  const [frisch, setFrisch] = useState<{ art: 'link' | 'puls'; url: string } | null>(null);
  const [vorschau, setVorschau] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<string | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();
  const laden = useCallback(async () => {
    const r = await fetch(`/api/fulfillment/kunde?m=${encodeURIComponent(mandatId)}`, { cache: 'no-store' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || !j.ok) { setFehler(String(j.fehler ?? 'Der Stand ließ sich nicht laden.')); return; }
    setFehler(null);
    setS(j as KundeStand);
  }, [mandatId]);
  useEffect(() => { void laden(); }, [laden]);

  const tun = async (body: Record<string, unknown>, gut?: string): Promise<Record<string, unknown> | null> => {
    const r = await post({ mandatId, ...body });
    if (!r.ok) { setMeldung({ art: 'kritisch', text: String(r.j.fehler ?? 'Nicht gespeichert.') }); return null; }
    if (gut) setMeldung({ art: 'gut', text: gut });
    await laden();
    return r.j;
  };
  const voll = (pfad: unknown, url: unknown) => (typeof url === 'string' ? url : `${window.location.origin}${String(pfad)}`);

  if (fehler) return <Hinweis art="kritisch">{fehler}</Hinweis>;
  if (!s) return <Leer>Wird geladen …</Leer>;
  const l = s.link;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {meldung && <Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis>}

      <Karte>
        <Ueberschrift rechts={<Chip farbe={s.schalter.an ? LEUCHT.gut : C.inkLeise}>{s.schalter.an ? 'an' : s.schalter.grund === 'betrieb' ? 'aus (Betrieb)' : 'aus'}</Chip>}>Kunden-Link</Ueberschrift>
        <Schalter an={s.schalter.instanz} onChange={an => void tun({ aktion: 'schalter', an }, an ? 'Kunden-Link für diese Instanz eingeschaltet.' : 'Kunden-Link ausgeschaltet — alle Links antworten „nicht gültig“.')} erklaerung="fulfillment.kundenLink">
          Kunden-Link der Instanz (nur Inhaber)
        </Schalter>
        {!s.schalter.umgebung && <div style={{ marginTop: 8 }}><Hinweis art="info">Im Betrieb ist der Kunden-Link noch aus (MAKE_OS_KUNDENLINK). Er kommt erst nach der Prüfung an — bis dahin antwortet jeder Link „nicht gültig“. Die Vorschau unten funktioniert trotzdem.</Hinweis></div>}
        {!s.fall && <div style={{ marginTop: 8 }}><Hinweis art="achtung">Für dieses Mandat läuft noch kein Fall. Der Kunden-Link zeigt den Stand des Falls — erst das Kundenonboarding starten (<Link href={WEG.fulfillment('onboarding')} style={{ color: C.aktiv }}>Fulfillment › Onboarding</Link>).</Hinweis></div>}
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {l ? (<>
            <Zeile titel={`Link ${l.id.slice(0, 9)}…`} unter={`angelegt am ${tag(l.erstelltAm)} · gilt bis ${tag(l.ablaufAm)}${l.zuletztAm ? ` · zuletzt genutzt ${tag(l.zuletztAm)}` : ''}`} rechts={<Chip farbe={STATUS_FARBE[l.status]}>{l.status}</Chip>} />
            <Schalter an={l.rechte.formular} onChange={v => void tun({ aktion: 'rechte', linkId: l.id, rechte: { formular: v } })} erklaerung="fulfillment.kundenLinkFormular">Formulare ausfüllen</Schalter>
            <Schalter an={l.rechte.upload} onChange={v => void tun({ aktion: 'rechte', linkId: l.id, rechte: { upload: v } })} erklaerung="fulfillment.kundenLinkUpload">Unterlagen hochladen</Schalter>
            <Schalter an={l.rechte.puls} onChange={v => void tun({ aktion: 'rechte', linkId: l.id, rechte: { puls: v } })} erklaerung="fulfillment.kundenLinkPuls">Kunden-Puls</Schalter>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Knopf leise onClick={() => tun({ aktion: 'verlaengern', linkId: l.id }, 'Verlängert (90 Tage, höchstens bis 30 Tage nach Mandatsende).')}>Verlängern</Knopf>
              <Knopf leise onClick={async () => { if (await bestaetigen({ titel: 'Neuen Link erzeugen?', text: 'Der bisherige Link gilt dann nicht mehr — auch wenn er schon verschickt ist.', ja: 'Neu erzeugen' })) { const j = await tun({ aktion: 'link-anlegen' }); if (j) setFrisch({ art: 'link', url: voll(j.pfad, j.url) }); } }}>Neu erzeugen</Knopf>
              <Knopf leise onClick={async () => { if (await bestaetigen({ titel: 'Link widerrufen?', text: 'Der Kunde sieht danach nur noch „nicht (mehr) gültig“. Antworten, Unterlagen und Puls bleiben hier.', ja: 'Widerrufen', gefahr: true })) await tun({ aktion: 'widerrufen', linkId: l.id }, 'Widerrufen.'); }}>Widerrufen</Knopf>
            </div>
          </>) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={klein}>{s.verlauf.length ? `Kein aktiver Link (zuletzt: ${s.verlauf[0].status}).` : 'Noch kein Link für dieses Mandat.'} Ein neuer Link gilt 90 Tage; die Adresse seht ihr genau einmal.</div>
              <div><Knopf haupt aus={!s.schalter.an || !s.fall} onClick={async () => { const j = await tun({ aktion: 'link-anlegen' }); if (j) setFrisch({ art: 'link', url: voll(j.pfad, j.url) }); }}>Link anlegen</Knopf></div>
            </div>
          )}
          {frisch && (
            <Hinweis art="gut" titel={frisch.art === 'link' ? 'Der Link — nur jetzt sichtbar' : 'Der Puls-Link — nur jetzt sichtbar'}
              aktion={<Knopf leise onClick={() => { void navigator.clipboard?.writeText(frisch.url); setMeldung({ art: 'gut', text: 'Kopiert. Verschickt wird er nur von euch — z. B. in der Willkommensmail.' }); }}>Kopieren</Knopf>}>
              <code style={{ overflowWrap: 'anywhere', fontSize: TYP.bedien }}>{frisch.url}</code>
              <div style={klein}>Wir speichern nur einen Fingerabdruck. Verloren? Einfach neu erzeugen — der alte gilt dann nicht mehr.</div>
            </Hinweis>
          )}
        </div>
      </Karte>

      <Karte>
        <Ueberschrift rechts={s.formulare.length ? <span style={{ display: 'flex', gap: 10 }}><a href={`/api/fulfillment/kunde?m=${encodeURIComponent(mandatId)}&export=csv`} download style={{ color: C.aktiv, fontSize: TYP.bedien }}>CSV</a><a href={`/api/fulfillment/kunde?m=${encodeURIComponent(mandatId)}&export=pdf`} download style={{ color: C.aktiv, fontSize: TYP.bedien }}>PDF</a></span> : undefined}>Formulare</Ueberschrift>
        {!s.formulare.length ? <Leer>Dieser Fall hat (noch) kein Formular — Playbook und Workbooks hängen als Baustein an einem Schritt des Falls.</Leer> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {s.formulare.map(f => (
              <div key={f.bausteinId} style={{ display: 'grid', gap: 6 }}>
                <Zeile titel={f.titel} unter={`${f.prozent} % beantwortet${f.geaendertAm ? ` · zuletzt ${tag(f.geaendertAm)} (${f.quelle === 'kunde' ? 'Kunde' : 'intern'})` : ''}${!f.kundeFuellt ? ' · nur intern' : !f.kundeTauglich ? ' · noch nicht für Kunden freigegeben' : ''}${f.fassung && f.fassung !== f.aktuelleFassung ? ` · beantwortet in Fassung ${f.fassung}` : ''}`}
                  rechts={<Knopf leise onClick={() => setBearbeiten(bearbeiten === f.bausteinId ? null : f.bausteinId)}>{bearbeiten === f.bausteinId ? 'Schließen' : 'Ansehen & ausfüllen'}</Knopf>} />
                {bearbeiten === f.bausteinId && (
                  <FormularKarte f={alsKundenFormular(f)} aus={false} speichern={async (_k, antworten, abschnitt): Promise<SpeicherErgebnis> => {
                    const r = await post({ aktion: 'formular-intern', mandatId, bausteinId: f.bausteinId, antworten, stand: f.stand, ...(abschnitt ? { abschnitt: abschnitt.schluessel, fertig: abschnitt.fertig } : {}) });
                    if (r.ok) await laden();
                    return r.ok ? { ok: true } : { ok: false, fehler: String(r.j.fehler ?? 'Nicht gespeichert.'), ...(r.status === 409 ? { neuLaden: true } : {}) };
                  }} />
                )}
              </div>
            ))}
          </div>
        )}
      </Karte>

      <Unterlagen mandatId={mandatId} s={s} laden={laden} setMeldung={setMeldung} bestaetigen={bestaetigen} />

      <PulsKarteIntern s={s} tun={tun} onLink={url => setFrisch({ art: 'puls', url })} voll={voll} />

      <Karte flach>
        <Ueberschrift rechts={<Knopf leise onClick={() => setVorschau(v => !v)}>{vorschau ? 'Schließen' : 'Öffnen'}</Knopf>}>So sieht der Kunde es</Ueberschrift>
        <div style={klein}>Dieselbe Seite wie über den Link — mit genau den Daten, die der Server dem Kunden schickt. Der 2-Wochen-Report steht unter <Link href={WEG.mandat(mandatId)} style={{ color: C.aktiv }}>Produkte & Mandate › Mandat › Fortschritt</Link>.</div>
        {vorschau && <div style={{ marginTop: 12 }}><KundenAnsichtVorschau mandatId={mandatId} /></div>}
      </Karte>
      {dialog}
    </div>
  );
}

function Unterlagen({ mandatId, s, laden, setMeldung, bestaetigen }: { mandatId: string; s: KundeStand; laden: () => Promise<void>; setMeldung: (m: { art: 'gut' | 'kritisch'; text: string }) => void; bestaetigen: ReturnType<typeof useRueckfrage>['bestaetigen'] }) {
  const [datei, setDatei] = useState<File | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const hoch = async () => {
    if (!datei) return;
    setLaeuft(true);
    const fd = new FormData();
    fd.append('datei', datei); fd.append('mandatId', mandatId); fd.append('zweck', 'sonstig');
    const r = await fetch('/api/fulfillment/kunde/datei', { method: 'POST', body: fd }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setLaeuft(false);
    if (!r || !r.ok || !j.ok) { setMeldung({ art: 'kritisch', text: String(j.fehler ?? 'Nicht hochgeladen.') }); return; }
    setDatei(null);
    setMeldung({ art: 'gut', text: 'Abgelegt (verschlüsselt, ungeprüft).' });
    await laden();
  };
  const status = async (id: string, body: Record<string, unknown>) => {
    const r = await post({ aktion: 'unterlage-status', id, ...body });
    if (!r.ok) setMeldung({ art: 'kritisch', text: String(r.j.fehler ?? 'Nicht gespeichert.') });
    await laden();
  };
  const weg = async (id: string, name: string) => {
    if (!(await bestaetigen({ titel: 'Unterlage entfernen?', text: `„${name}“ wird gelöscht (Eintrag und Datei).`, ja: 'Entfernen', gefahr: true }))) return;
    const r = await fetch(`/api/fulfillment/kunde/datei?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || !j.ok) setMeldung({ art: 'kritisch', text: String(j.fehler ?? 'Nicht entfernt.') });
    await laden();
  };
  return (
    <Karte>
      <Ueberschrift rechts={s.kurz.ungepruefteUnterlagen ? <Chip farbe={LEUCHT.achtung}>{s.kurz.ungepruefteUnterlagen} ungeprüft</Chip> : undefined}>Unterlagen</Ueberschrift>
      <div style={klein}>Nur PDF, Bilder und Office ohne Makros, am Inhalt geprüft. Herunterladen geht nur als Datei — nie im Browser geöffnet. Die Analyse liest erst „freigegebene“.</div>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {!s.unterlagen.length ? <Leer>Noch keine Unterlagen.</Leer> : s.unterlagen.map(u => (
          <div key={u.id} style={{ display: 'grid', gap: 6, paddingBottom: 8, borderBottom: `1px solid ${C.linie}` }}>
            <Zeile titel={u.name} unter={`${tag(u.am)} · ${Math.max(1, Math.round(u.groesse / 1024))} KB · ${u.herkunft === 'kunde' ? 'vom Kunden' : 'intern'} · ${ZWECK_TEXT[u.zweck]}${u.beleg ? ' · Beleg' : ''}`} rechts={<Chip farbe={UNTERLAGE_FARBE[u.status]}>{UNTERLAGE_TEXT[u.status]}</Chip>} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <a href={`/api/fulfillment/kunde/datei?id=${encodeURIComponent(u.id)}`} download style={{ color: C.aktiv, fontSize: TYP.bedien, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>↓ Herunterladen</a>
              {u.status !== 'freigegeben' && <Knopf leise onClick={() => status(u.id, { status: 'freigegeben' })}>Freigeben</Knopf>}
              {u.status !== 'gesperrt' && <Knopf leise onClick={() => status(u.id, { status: 'gesperrt' })}>Sperren</Knopf>}
              <Knopf leise onClick={() => status(u.id, { beleg: !u.beleg })}>{u.beleg ? 'Kein Beleg' : 'Als Beleg aufbewahren'}</Knopf>
              {/* Zusammengeführt 11.10.: A2 (Register & Finanzsignale) liest nur freigegebene Unterlagen mit Zweck „Registerauszug“ — hier intern setzen. */}
              <Knopf leise onClick={() => status(u.id, { zweck: u.zweck === 'register' ? 'sonstig' : 'register' })}>{u.zweck === 'register' ? 'Kein Registerauszug' : 'Ist Registerauszug'}</Knopf>
              {!u.beleg && <Knopf leise onClick={() => weg(u.id, u.name)}>Entfernen</Knopf>}
            </div>
          </div>
        ))}
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center' }}>
          <input type="file" accept={KUNDE_ANNEHMEN} onChange={e => setDatei(e.target.files?.[0] ?? null)} style={{ ...feld, padding: 8 }} aria-label="Interne Unterlage wählen" />
          <Knopf aus={!datei || laeuft} onClick={hoch}>{laeuft ? 'Lädt …' : 'Ablegen'}</Knopf>
        </div>
      </div>
    </Karte>
  );
}

function PulsKarteIntern({ s, tun, onLink, voll }: { s: KundeStand; tun: (b: Record<string, unknown>, gut?: string) => Promise<Record<string, unknown> | null>; onLink: (url: string) => void; voll: (p: unknown, u: unknown) => string }) {
  const [wert, setWert] = useState('');
  const [satz, setSatz] = useState('');
  const [schwelle, setSchwelle] = useState(String(s.puls.schwelle));
  return (
    <Karte>
      <Ueberschrift rechts={s.kurz.letzterPuls ? <Chip farbe={s.kurz.letzterPuls.wert <= s.puls.schwelle ? LEUCHT.kritisch : s.kurz.letzterPuls.wert >= 9 ? LEUCHT.gut : C.aktiv}>{s.kurz.letzterPuls.wert} / 10</Chip> : undefined}>Kunden-Puls</Ueberschrift>
      <div style={klein}>{s.puls.offen ? `Eine Puls-Frage ist offen (bis ${tag(s.puls.offen.offenBis)}).` : 'Keine Puls-Frage offen.'} Der Puls-Link entsteht beim Senden des 2-Wochen-Reports — oder hier.{s.puls.health !== null ? ` Zufriedenheit (Health) des Mandats: ${s.puls.health}.` : ''}</div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {!s.puls.liste.length ? <Leer>Noch kein Puls.</Leer> : s.puls.liste.map(p => (
          <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: TYP.body, color: C.ink, minWidth: 0, flex: '1 1 220px' }}>
              <b>{p.wert}</b> / 10 · {tag(p.am)} · {p.quelle === 'link' ? 'über den Link' : 'von Hand'}{p.satz ? <span style={klein}> — „{p.satz}“</span> : null}
            </span>
            <Erklaert erklaerung="fulfillment.pulsInHealth" name="In die Health übernehmen">
              <Knopf leise onClick={() => tun({ aktion: 'puls-uebernehmen', pulsId: p.id }, `Übernommen: Zufriedenheit des Mandats = ${p.wert * 10}.`)}>In die Health übernehmen</Knopf>
            </Erklaert>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 120px) minmax(0, 1fr) auto', alignItems: 'end' }}>
          <Feldzeile label="Wert 0–10"><input value={wert} inputMode="numeric" onChange={e => setWert(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} style={eingabe} /></Feldzeile>
          <Feldzeile label="Ein Satz (freiwillig)"><input value={satz} maxLength={500} onChange={e => setSatz(e.target.value)} style={eingabe} /></Feldzeile>
          <Knopf aus={wert === '' || Number(wert) > 10} onClick={async () => { if (await tun({ aktion: 'puls-hand', wert: Number(wert), satz }, 'Puls eingetragen.')) { setWert(''); setSatz(''); } }}>Eintragen</Knopf>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 160px) auto', alignItems: 'end' }}>
          <Feldzeile label="Schwelle" erklaerung="fulfillment.pulsSchwelle"><input value={schwelle} inputMode="numeric" onChange={e => setSchwelle(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} style={eingabe} /></Feldzeile>
          <Knopf leise aus={schwelle === String(s.puls.schwelle) || schwelle === '' || Number(schwelle) > 10} onClick={() => tun({ aktion: 'puls-schwelle', wert: Number(schwelle) }, 'Schwelle gespeichert.')}>Speichern</Knopf>
        </div>
        {s.link?.rechte.puls && s.schalter.an && (
          <div><Knopf leise onClick={async () => { const j = await tun({ aktion: 'puls-anfrage' }); if (j) onLink(voll(j.pfad, j.url)); }}>Puls-Link anlegen</Knopf></div>
        )}
      </div>
    </Karte>
  );
}
