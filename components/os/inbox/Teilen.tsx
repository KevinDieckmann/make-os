'use client';

// ─── Inbox teilen — Übergeben, „wer kümmert sich“, die Übergabe-Ansicht (08.10.2026, Lücke 6 „Business Couple“) ─────────────
// Kevin 08.10.: „Mail nicht übergebbar … → ‚An <Person> übergeben‘ (freigegebene Kopie), gemeinsames Postfach je Gesellschaft mit ‚wer
// kümmert sich‘“. Alles nur per Klick, alles gefiltert vom Server (lib/inbox/teilen*.ts, uebergaben-*.ts) — die Oberfläche blendet nie
// bloß aus:
//   · `UebergebenFeld`   im eigenen Gespräch: „Übergeben an …“ → Person (nur wer den Bereich sehen darf) + Notiz (+ ausdrücklich angehakte
//                        Anhänge als verschlüsselte Kopie, 10.10.) → Kopie; bestehende Übergaben „Kopie aktualisieren“ / „Zurückziehen“
//   · `KuemmertWahl`     im Gespräch eines Team-Postfachs bzw. bei WhatsApp: wer kümmert sich (mit Stand → 409 zeigt die neue Fassung)
//   · `UebergabeAnsicht` die Kopie: „von <Vorname>, Kopie vom <Datum>“, Notiz, Kennzeichen der Gegenseite (Werbesperre/Art. 18), Nachrichten
//                        (mitgegebene Anhänge zum Herunterladen, die übrigen nur als Liste), Antworten aus einem EIGENEN Postfach (mit ZOE-Entwurf
//                        als Vorschlag), „zurück an …“, Erledigt (für beide), „Kopie aktualisieren“, „Erneut übergeben“ und „Zurückziehen“
//                        (nur die übergebende Person)
//   · `UebergabenKarte`  das Fach „Übergeben“ in der Inbox

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, KUGEL, TYP } from '@/lib/make-one/design';
import { antwortBezugAus } from '@/lib/inbox/teilen';
import type { GespraechTeam } from '@/lib/inbox/teilen';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Chip, Pillen, Hinweis, Feldzeile, eingabe, Leer, Punkt, LEUCHT, useRueckfrage } from '../ui';
import { GmailText } from './GmailText';
import { Antwort } from './Antwort';
import { anhangLink, datumLang, groesse, holen, kuemmern, uebergabeAktion, zeitKurz, type UebergabeDetail, type UebergabeZeile } from './daten';

const tagKurz = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
const STATUS_TEXT: Record<UebergabeZeile['status'], string> = { offen: 'offen', zurueck: 'zurückgegeben', erledigt: 'erledigt' };

/** Notiz-Feld (16 px am Handy, ≤ 2000 Zeichen — der Server lehnt Längeres mit 413 ab, nie gekürzt). */
function NotizFeld({ wert, onAendern, label }: { wert: string; onAendern: (t: string) => void; label: string }) {
  return (
    <Feldzeile label={label}>
      <textarea value={wert} onChange={e => onAendern(e.target.value)} rows={3} maxLength={2000} style={{ ...eingabe, minHeight: 88, resize: 'vertical', lineHeight: 1.5 }} />
    </Feldzeile>
  );
}

/** Ein Anhang des Gesprächs, den man beim Übergeben mitgeben kann (nur echte Anhänge, nie eingebettete Bilder). */
export interface MitgebbarerAnhang { nachricht: string; teil: string; name: string; groesse: number }

/** Rückfrage vor „Zurückziehen“ (Text mit Fallbeispiel) — dieselbe für das Gespräch und die Übergabe. */
const zurueckziehenFrage = (anName: string) => ({
  titel: 'Übergabe zurückziehen?',
  text: `Die Kopie verschwindet bei ${anName} — samt mitgegebenen Anhängen. Dein Original im Postfach bleibt, wie es ist.

Beispiel: Du hast aus Versehen das falsche Gespräch übergeben oder kümmerst dich doch selbst.`,
  ja: 'Zurückziehen', gefahr: true,
});

/** Im eigenen Gespräch: „Übergeben an …“ — nur Personen, die der Server für diesen Bereich nennt. */
export function UebergebenFeld({ gespraech, personen, bestehend, anhaenge = [], meldung, onGeaendert }: {
  gespraech: string;
  personen: { speicher: string; name: string }[];
  bestehend: { id: string; an: string; anName: string; status: string; kopieAm: string }[];
  /** Anhänge des Gesprächs — nur angehakte gehen als Datei mit (10.10.). */
  anhaenge?: MitgebbarerAnhang[];
  meldung: (t: string) => void;
  onGeaendert: () => void;
}) {
  const [auf, setAuf] = useState(false);
  const [an, setAn] = useState(personen.length === 1 ? personen[0].speicher : '');
  const [notiz, setNotiz] = useState('');
  const [mit, setMit] = useState<Set<string>>(() => new Set());
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const { bestaetigen, dialog } = useRueckfrage();
  const offen = bestehend.filter(b => b.status !== 'erledigt');
  const anName = personen.find(p => p.speicher === an)?.name ?? 'die andere Person';
  const los = async () => {
    setFehler(''); setLaeuft(true);
    const gewaehlt = anhaenge.filter(a => mit.has(`${a.nachricht}|${a.teil}`)).map(a => ({ nachricht: a.nachricht, teil: a.teil }));
    const r = await uebergabeAktion('uebergeben', { gespraech, an, ...(notiz.trim() ? { notiz: notiz.trim() } : {}), ...(gewaehlt.length ? { anhaenge: gewaehlt } : {}) });
    setLaeuft(false);
    if (!r.d.ok) { setFehler(String(r.d.fehler ?? 'Nicht übergeben.')); return; }
    setAuf(false); setNotiz(''); setMit(new Set());
    meldung(String(r.d.text ?? 'Übergeben.'));
    onGeaendert();
  };
  const aktualisieren = async (id: string) => {
    const r = await uebergabeAktion('aktualisieren', { id });
    meldung(r.d.ok ? String(r.d.text ?? 'Kopie aktualisiert.') : String(r.d.fehler ?? 'Das ging nicht.'));
    if (r.d.ok) onGeaendert();
  };
  const zurueck = async (id: string, name: string) => {
    if (!(await bestaetigen(zurueckziehenFrage(name)))) return;
    const r = await uebergabeAktion('zurueckziehen', { id });
    meldung(r.d.ok ? String(r.d.text ?? 'Zurückgezogen.') : String(r.d.fehler ?? 'Das ging nicht.'));
    if (r.d.ok) onGeaendert();
  };
  const umschalten = (k: string) => setMit(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <div style={{ display: 'grid', gap: 8 }} data-inbox="uebergeben">
      {offen.map(b => (
        <div key={b.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
          <Chip farbe={b.status === 'zurueck' ? LEUCHT.achtung : KUGEL.smaragd}>an {b.anName} übergeben · {STATUS_TEXT[b.status as UebergabeZeile['status']] ?? b.status}</Chip>
          <span>Kopie vom {tagKurz(b.kopieAm)}</span>
          <Knopf leise onClick={() => aktualisieren(b.id)}>Kopie aktualisieren</Knopf>
          <Knopf leise href={`/os/inbox?offen=${b.id}`}>Übergabe öffnen</Knopf>
          <Knopf leise onClick={() => zurueck(b.id, b.anName)}>Zurückziehen</Knopf>
        </div>
      ))}
      {!auf && personen.length > 0 && <div><Knopf leise onClick={() => setAuf(true)}>Übergeben an …</Knopf></div>}
      {auf && (
        <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 16, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.linie}` }}>
          <div style={{ fontWeight: 700, fontSize: TYP.body }}>Übergeben an</div>
          <Pillen liste={personen.map(p => ({ id: p.speicher, label: p.name }))} aktiv={an} onWahl={setAn} />
          <NotizFeld wert={notiz} onAendern={setNotiz} label="Notiz (optional)" />
          {anhaenge.length > 0 && (
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 4 }} data-inbox="anhaenge-mitgeben">
              <legend style={{ fontWeight: 700, fontSize: TYP.body, marginBottom: 4 }}>Anhänge mitgeben (optional)</legend>
              {anhaenge.map(a => {
                const k = `${a.nachricht}|${a.teil}`;
                return (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer', fontSize: TYP.body, overflowWrap: 'anywhere' }}>
                    <input type="checkbox" checked={mit.has(k)} onChange={() => umschalten(k)} style={{ width: 20, height: 20, flex: '0 0 auto' }} />
                    <span>{a.name} <span style={{ color: C.inkLeise }}>{groesse(a.groesse)}</span></span>
                  </label>
                );
              })}
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>
                Ohne Haken steht ein Anhang nur als Name in der Kopie. Mit Haken bekommt {anName} eine verschlüsselte Kopie der Datei zum Herunterladen
                — dein Postfach sieht {anName} dabei nie. Beispiel: Du übergibst die Mail mit der Rechnung — hakst du die PDF an, kann {anName} sie öffnen und bezahlen.
              </div>
            </fieldset>
          )}
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Die andere Person bekommt eine Kopie des Gesprächs bis jetzt. Neue Nachrichten kommen nicht von selbst mit („Kopie aktualisieren“); „Zurückziehen“ nimmt die Kopie wieder weg.</div>
          {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf onClick={los} aus={!an || laeuft}>{laeuft ? 'übergibt …' : 'Übergeben'}</Knopf>
            <Knopf leise onClick={() => { setAuf(false); setFehler(''); }}>Abbrechen</Knopf>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}

/** „Wer kümmert sich“ — Team-Postfach bzw. WhatsApp. Ändern nur mit dem gesehenen Stand; bei 409 lädt die Ansicht neu. */
export function KuemmertWahl({ gespraech, team, person, meldung, onGeaendert }: {
  gespraech: string; team: GespraechTeam; person: string; meldung: (t: string) => void; onGeaendert: () => void;
}) {
  const [auf, setAuf] = useState(false);
  const setze = async (wer: string | null) => {
    setAuf(false);
    const r = await kuemmern(gespraech, wer, team.stand);
    if (r.status === 409) { meldung('Jemand hat das gerade geändert — hier ist die neue Fassung.'); onGeaendert(); return; }
    meldung(r.d.ok ? String(r.d.text ?? 'Gespeichert.') : String(r.d.fehler ?? 'Das ging nicht.'));
    if (r.d.ok) onGeaendert();
  };
  const wer = team.kuemmert;
  return (
    <div style={{ display: 'grid', gap: 8 }} data-inbox="kuemmert">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Wer kümmert sich:</span>
        <Knopf leise farbe={wer ? KUGEL.smaragd : undefined} onClick={() => setAuf(x => !x)}>{wer ? (wer.person === person ? 'Du' : wer.name) : 'noch niemand'} ▾</Knopf>
        {!wer && <Knopf leise onClick={() => setze(person)}>Ich kümmere mich</Knopf>}
      </div>
      {auf && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {team.personen.map(p => <Knopf key={p.speicher} leise farbe={wer?.person === p.speicher ? KUGEL.smaragd : undefined} onClick={() => setze(p.speicher)}>{p.speicher === person ? `${p.name} (ich)` : p.name}</Knopf>)}
          {wer && <Knopf leise onClick={() => setze(null)}>Niemand</Knopf>}
        </div>
      )}
    </div>
  );
}

/** Eine Übergabe öffnen — Kopie mit Notiz, Aktionen je Rolle. */
export function UebergabeAnsicht({ id, person, meldung, onGeaendert, onZurueck }: {
  id: string; person: string; meldung: (t: string, rueck?: () => void) => void; onGeaendert: () => void; onZurueck?: () => void;
}) {
  const [d, setD] = useState<UebergabeDetail | null>(null);
  const [fehler, setFehler] = useState('');
  const [antwort, setAntwort] = useState(false);
  const [notizAuf, setNotizAuf] = useState<null | 'zurueck' | 'wieder'>(null);
  const [notiz, setNotiz] = useState('');
  const { bestaetigen, dialog } = useRueckfrage();
  const laden = useCallback(async () => {
    const r = await holen<UebergabeDetail>(`/api/inbox/uebergaben?id=${encodeURIComponent(id)}`);
    if (r.d.ok) { setD(r.d as UebergabeDetail); setFehler(''); } else { setD(null); setFehler(String(r.d.fehler ?? 'Die Übergabe ließ sich nicht laden.')); }
  }, [id]);
  useEffect(() => { setD(null); setAntwort(false); setNotizAuf(null); setNotiz(''); void laden(); }, [laden]);

  if (fehler) return <Hinweis art="kritisch" rolle="alert" aktion={<Knopf leise onClick={() => void laden()}>Noch einmal laden</Knopf>}>{fehler}</Hinweis>;
  if (!d) return <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: 8 }}>lädt …</div>;
  const u = d.uebergabe, z = d.zeile;
  const ichGebe = u.von === person;
  const tu = async (aktion: string, extra: Record<string, unknown> = {}) => {
    const r = await uebergabeAktion(aktion, { id, stand: z.stand, ...extra });
    if (r.status === 409) { meldung(String(r.d.fehler ?? 'Jemand hat die Übergabe gerade geändert.')); await laden(); return false; }
    meldung(r.d.ok ? String(r.d.text ?? 'Gespeichert.') : String(r.d.fehler ?? 'Das ging nicht.'));
    if (r.d.ok) { await laden(); onGeaendert(); }
    return !!r.d.ok;
  };
  const bezug = antwortBezugAus(u);
  const andere = ichGebe ? z.anName : z.vonName;
  const zurueckziehen = async () => {
    if (!(await bestaetigen(zurueckziehenFrage(z.anName)))) return;
    const r = await uebergabeAktion('zurueckziehen', { id, stand: z.stand });
    meldung(r.d.ok ? String(r.d.text ?? 'Zurückgezogen.') : String(r.d.fehler ?? 'Das ging nicht.'));
    if (r.d.ok) { onGeaendert(); onZurueck?.(); } else await laden();
  };
  const ladeLink = (ablage: string) => `/api/inbox/uebergaben?id=${encodeURIComponent(id)}&anhang=${encodeURIComponent(ablage)}`;
  const knopfStil = { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.05)', color: C.ink, fontSize: TYP.bedien, textDecoration: 'none', overflowWrap: 'anywhere' } as const;

  return (
    <div data-inbox="uebergabe" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, minWidth: 0 }}>
      {onZurueck && <div><Knopf leise onClick={onZurueck}>‹ Zurück zur Liste</Knopf></div>}
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{u.betreff}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip umbrechen farbe={KUGEL.granat}>{ichGebe ? `an ${z.anName} übergeben` : `von ${z.vonName}`}, Kopie vom {tagKurz(u.kopieAm)}</Chip>
          <Chip farbe={u.status === 'zurueck' ? LEUCHT.achtung : u.status === 'erledigt' ? C.inkLeise : KUGEL.smaragd}>{STATUS_TEXT[u.status]}</Chip>
          {u.status !== 'erledigt' && <Chip farbe={C.inkDim}>{u.kuemmert === person ? 'du kümmerst dich' : `${z.kuemmertName} kümmert sich`}</Chip>}
        </div>
      </div>
      {u.sperre === 'eingeschraenkt' && <Hinweis art="kritisch" titel="Verarbeitung eingeschränkt (Art. 18)">Die Gegenseite ist in der Kartei eingeschränkt: nichts weiterverarbeiten, kein ZOE-Entwurf. Antworte nur, wenn es wirklich nötig ist — und dann selbst.</Hinweis>}
      {u.sperre === 'werbesperre' && <Hinweis art="achtung" titel="Werbesperre">Für die Gegenseite gilt eine Werbesperre: nur persönliche 1:1-Antworten, keine Angebote oder Einladungen.</Hinweis>}
      {u.notiz && <Hinweis art="info" titel={`Notiz von ${z.vonName}`}><span style={{ whiteSpace: 'pre-wrap' }}>{u.notiz}</span></Hinweis>}
      {u.zurueckNotiz && u.status === 'zurueck' && <Hinweis art="achtung" titel={`Zurück von ${z.anName}`}><span style={{ whiteSpace: 'pre-wrap' }}>{u.zurueckNotiz}</span></Hinweis>}
      {ichGebe && d.neuer > 0 && u.status !== 'erledigt' && (
        <Hinweis art="info" aktion={<Knopf leise onClick={() => tu('aktualisieren')}>Kopie aktualisieren</Knopf>}>
          Im Original {d.neuer === 1 ? 'ist eine neue Nachricht' : `sind ${d.neuer} neue Nachrichten`} — die Kopie bei {z.anName} zeigt den Stand vom {tagKurz(u.kopieAm)}.
        </Hinweis>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        {u.nachrichten.map((n, i) => (
          <div key={n.id} style={{ borderTop: i ? `1px solid ${C.linie}` : undefined, paddingTop: i ? 10 : 0 }}>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6, overflowWrap: 'anywhere' }}>
              <b style={{ color: n.vonUns ? C.inkDim : C.ink }}>{n.vonUns ? (ichGebe ? 'Du' : z.vonName) : n.von.name ?? n.von.email}</b>{!n.vonUns && n.von.name ? ` <${n.von.email}>` : ''} · {datumLang(n.am)}
              {n.an.length > 0 && <> · an {n.an.slice(0, 3).map(x => x.name ?? x.email).join(', ')}{n.an.length > 3 ? ` +${n.an.length - 3}` : ''}</>}
            </div>
            <div style={{ maxHeight: i === u.nachrichten.length - 1 ? 480 : 300, overflow: 'auto' }}><GmailText text={n.text} /></div>
            {n.anhaenge.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, minWidth: 0 }}>
                {n.anhaenge.map(a => (a.ablage ? (
                  <a key={a.teil} href={ladeLink(a.ablage)} download rel="noopener noreferrer" style={knopfStil} title="Mitgegeben — verschlüsselte Kopie">
                    {a.name} <span style={{ color: C.inkLeise, marginLeft: 6 }}>{groesse(a.groesse)} · mitgegeben</span>
                  </a>
                ) : ichGebe ? (
                  <a key={a.teil} href={anhangLink(u.quelle, n.id, a.teil)} download rel="noopener noreferrer" style={knopfStil}>
                    {a.name} <span style={{ color: C.inkLeise, marginLeft: 6 }}>{groesse(a.groesse)}</span>
                  </a>
                ) : (
                  <span key={a.teil} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.03)', color: C.inkDim, fontSize: TYP.bedien, overflowWrap: 'anywhere' }}>
                    {a.name} <span style={{ color: C.inkLeise, marginLeft: 6 }}>{groesse(a.groesse)}</span>
                  </span>
                )))}
              </div>
            )}
          </div>
        ))}
        {!ichGebe && u.nachrichten.some(n => n.anhaenge.some(a => !a.ablage)) && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Anhänge ohne „mitgegeben“ stehen nur als Name in der Kopie — {z.vonName} kann sie beim nächsten Übergeben mitgeben.</div>}
      </div>

      {!antwort && !notizAuf && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!ichGebe && u.status === 'offen' && <Knopf onClick={() => setAntwort(true)} aus={!d.postfaecher.length}>Antworten</Knopf>}
          {!ichGebe && u.status === 'offen' && <Knopf leise onClick={() => setNotizAuf('zurueck')}>Zurück an {z.vonName}</Knopf>}
          {u.status !== 'erledigt' && <Knopf leise onClick={() => void tu('erledigt').then(ok => { if (ok && onZurueck) onZurueck(); })}>Erledigt</Knopf>}
          {u.status !== 'erledigt' && <Knopf leise onClick={() => tu('kuemmert', { wer: u.kuemmert === person ? (ichGebe ? u.an : u.von) : person })}>{u.kuemmert === person ? `${andere} soll sich kümmern` : 'Ich kümmere mich'}</Knopf>}
          {ichGebe && u.status !== 'offen' && <Knopf leise onClick={() => setNotizAuf('wieder')}>Erneut an {z.anName} übergeben</Knopf>}
          {ichGebe && <Knopf leise href={`/os/inbox?offen=${u.gespraech}`}>Original öffnen</Knopf>}
          {ichGebe && <Knopf leise onClick={zurueckziehen}>Zurückziehen</Knopf>}
        </div>
      )}
      {!ichGebe && u.status === 'offen' && !d.postfaecher.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Zum Antworten brauchst du ein eigenes Postfach in diesem Bereich (Inbox › Postfächer).</div>}
      {notizAuf && (
        <div style={{ display: 'grid', gap: 10 }}>
          <NotizFeld wert={notiz} onAendern={setNotiz} label={notizAuf === 'zurueck' ? `Notiz an ${z.vonName} (optional)` : `Notiz an ${z.anName} (optional)`} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf onClick={() => void tu(notizAuf, notiz.trim() ? { notiz: notiz.trim() } : {}).then(ok => { if (ok) { setNotizAuf(null); setNotiz(''); } })}>{notizAuf === 'zurueck' ? 'Zurückgeben' : 'Erneut übergeben'}</Knopf>
            <Knopf leise onClick={() => { setNotizAuf(null); setNotiz(''); }}>Abbrechen</Knopf>
          </div>
        </div>
      )}
      {antwort && (
        <Antwort allen={false} meldung={t => meldung(t)} onZu={() => setAntwort(false)} onGesendet={() => { setAntwort(false); void laden(); onGeaendert(); }}
          v={{ uebergabe: u.id, betreff: `Re: ${bezug.betreff.replace(/^((re|aw|antw)\s*:\s*)+/i, '')}`, von: [], postfaecher: d.postfaecher.map(p => ({ id: p.id, name: p.name })), start: { an: bezug.empfaenger.map(a => a.email).join(', ') } }} />
      )}
      {dialog}
    </div>
  );
}

/** Das Fach „Übergeben“ in der Inbox: erhaltene (offen), zurückgegebene und weitergegebene — erledigte nur als Zahl. */
export function UebergabenKarte({ liste, offenId, onOeffnen, i, person }: { liste: UebergabeZeile[]; offenId: string | null; onOeffnen: (id: string | null) => void; i: number; person: string }) {
  const aktiv = liste.filter(u => u.status !== 'erledigt');
  const erledigt = liste.length - aktiv.length;
  if (!aktiv.length) return null;
  // Zuerst, was bei mir liegt (kümmere ich mich), dann der Rest.
  const sortiert = [...aktiv].sort((a, b) => Number(b.kuemmert === person) - Number(a.kuemmert === person) || b.geaendertAm.localeCompare(a.geaendertAm));
  return (
    <Karte i={i} dicht>
      <Ueberschrift farbe={KUGEL.granat} rechts={`${aktiv.length}`}>Übergeben</Ueberschrift>
      <Liste>
        {sortiert.map(u => (
          <Zeile key={u.id} onClick={() => onOeffnen(offenId === u.id ? null : u.id)} aktiv={offenId === u.id}
            links={<Punkt farbe={u.kuemmert === person ? (u.status === 'zurueck' ? LEUCHT.achtung : KUGEL.granat) : C.linie} />}
            titel={<><span style={{ fontWeight: u.kuemmert === person ? 700 : 500 }}>{u.gegenueber.name ?? u.gegenueber.email}</span><span style={{ color: C.inkLeise }}> · {u.betreff}</span>{u.sperre && <span style={{ color: u.sperre === 'eingeschraenkt' ? LEUCHT.kritisch : LEUCHT.achtung }}> · {u.sperre === 'eingeschraenkt' ? 'Art. 18' : 'Werbesperre'}</span>}{u.mitgegeben > 0 && <span style={{ color: C.inkLeise }}> · {u.mitgegeben === 1 ? 'ein Anhang' : `${u.mitgegeben} Anhänge`} mitgegeben</span>}</>}
            unter={u.rolle === 'erhalten'
              ? `von ${u.vonName}, Kopie vom ${tagKurz(u.kopieAm)}${u.notiz ? ` — ${u.notiz.replace(/\s+/g, ' ').slice(0, 80)}` : ''}`
              : u.status === 'zurueck' ? `zurück von ${u.anName}${u.zurueckNotiz ? ` — ${u.zurueckNotiz.replace(/\s+/g, ' ').slice(0, 80)}` : ''}` : `an ${u.anName} übergeben · ${u.kuemmertName} kümmert sich`}
            rechts={<span style={{ fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap' }}>{zeitKurz(u.geaendertAm)}</span>} />
        ))}
      </Liste>
      {erledigt > 0 && <Leer>{erledigt} erledigte Übergabe{erledigt === 1 ? '' : 'n'} — sie bleiben 90 Tage über die Suche auffindbar.</Leer>}
    </Karte>
  );
}
