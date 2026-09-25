'use client';

// ─── Markttraktion · „+ Gespräch“ — festhalten von überall (25.09.) ─────────
// Stand 25.09.: 453 Personen in der Kartei, zwei echte Aktivitäten. Die
// Gespräche finden statt — am Telefon, im Termin, auf LinkedIn —, aber
// niemand öffnet dafür erst die Kartei, sucht die Person und klickt sich zum
// Verlauf. Deshalb ein Knopf oben rechts in der ganzen Markttraktion und ein
// Dialog, der in zwanzig Sekunden erledigt ist:
//   Person   suchen nach Name oder Firma (↑↓ Enter), vorbelegt, wenn gerade
//            eine Person offen ist
//   Art      Anruf · Termin · Gespräch · LinkedIn · Mail · Notiz
//   Ergebnis wie in der Power Hour; Mailbox, nicht erreicht, kein Bedarf und
//            Sperre speichern sofort, ein echtes Gespräch öffnet die Notiz-
//            vorlage (nächster Schritt Pflicht, Einwilligungs-Schalter)
//   Chance   optional gleich mit anlegen (Firma, Wert, Stufe, nächster Schritt)
// Am Handy vollflächig, große Tippflächen, Esc schließt. Die Regeln (Stufe,
// Wiedervorlage, Sperre) laufen wie immer auf dem Server
// (/api/crm/aktivitaet). MAKE OS versendet nichts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, feld, Chip, LEUCHT } from '../schlank';
import { anzeigename, findeKontakte, STUFE_LABEL, type Kontakt, type Ergebnis, type AktivitaetArt } from '@/lib/make-one/crm';
import { haeltBeziehung, BEIDE } from '@/lib/crm/team';
import type { ChancenStufe, WertBasis } from '@/lib/crm/typen';
import { localDay } from '@/lib/zeit';
import { type CrmApi, plusTage } from './daten';
import { NotizFormular, Pillen, festhalten, hatMailEinwilligung, ERGEBNIS_KNOEPFE, type NotizErgebnis } from './teile';
import { Person } from './team';

type Art = Extract<AktivitaetArt, 'anruf' | 'termin' | 'gespraech' | 'linkedin' | 'mail' | 'notiz'>;
/** Welche Ergebnisse zur Art passen — ein Termin geht nicht auf die Mailbox. Ohne Liste: nur die Notiz. */
const ARTEN: { id: Art; label: string; ergebnisse?: Ergebnis[]; start?: Ergebnis }[] = [
  { id: 'anruf', label: 'Anruf', ergebnisse: ['gespraech', 'termin', 'rueckruf', 'mailbox', 'nicht_erreicht', 'kein_bedarf', 'sperre'] },
  { id: 'termin', label: 'Termin', ergebnisse: ['gespraech', 'termin', 'rueckruf', 'kein_bedarf', 'sperre'], start: 'gespraech' },
  { id: 'gespraech', label: 'Gespräch', ergebnisse: ['gespraech', 'termin', 'rueckruf', 'kein_bedarf', 'sperre'], start: 'gespraech' },
  { id: 'linkedin', label: 'LinkedIn' }, { id: 'mail', label: 'Mail' }, { id: 'notiz', label: 'Notiz' },
];

/** Handy: der Dialog nimmt die ganze Fläche. */
function useSchmal(): boolean {
  const [schmal, setSchmal] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const an = () => setSchmal(mq.matches);
    an(); mq.addEventListener('change', an);
    return () => mq.removeEventListener('change', an);
  }, []);
  return schmal;
}

const titelKlein = { fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, margin: '0 0 6px' } as const;

export function SchnellErfassen({ api, offen, onZu, kontaktId }: { api: CrmApi; offen: boolean; onZu: () => void; kontaktId?: string }) {
  const schmal = useSchmal();
  const heute = api.crm?.heute ?? localDay();
  const [suche, setSuche] = useState('');
  const [markiert, setMarkiert] = useState(0);
  const [personId, setPersonId] = useState<string | null>(null);
  /** Person im Dialog gesucht (nicht vorbelegt) — dann springt der Fokus danach in die Notiz. */
  const [gesucht, setGesucht] = useState(false);
  const [art, setArt] = useState<Art>('gespraech');
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>('gespraech');
  const [chance, setChance] = useState<{ titel: string; betrag: string; basis: WertBasis; stufe: ChancenStufe; schritt: string; datum: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState('');
  const [fehler, setFehler] = useState('');
  const sucheRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const vorher = useRef<HTMLElement | null>(null);
  // Schließen über eine Referenz — so hängt der Esc-Hörer nicht an jeder neuen onZu-Funktion der Seite.
  const zu = useRef(onZu);
  useEffect(() => { zu.current = onZu; }, [onZu]);

  // Beim Öffnen: alles frisch, Person vorbelegt, Fokus ins Suchfeld (am Handy nur ohne Vorbelegung — sonst verdeckt die Tastatur alles).
  useEffect(() => {
    if (!offen) return;
    vorher.current = document.activeElement as HTMLElement | null;
    setSuche(''); setMarkiert(0); setPersonId(kontaktId ?? null); setGesucht(false); setArt('gespraech'); setErgebnis('gespraech');
    setChance(null); setLaeuft(false); setFertig(''); setFehler('');
    const handy = window.matchMedia('(max-width: 720px)').matches;
    const t = setTimeout(() => { if (!kontaktId || !handy) sucheRef.current?.focus(); }, 30);
    // Die Seite dahinter scrollt nicht mit.
    const alt = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Modal auch für die Tastatur: Esc schließt (vor allen anderen Hörern), und Tasten außerhalb
    // des Dialogs — etwa j/k/Enter/Esc der Kartei dahinter — erreichen die Seite nicht.
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zu.current(); return; }
      if (!dialogRef.current?.contains(e.target as Node)) e.stopPropagation();
    };
    window.addEventListener('keydown', taste, true);
    return () => { clearTimeout(t); document.body.style.overflow = alt; window.removeEventListener('keydown', taste, true); vorher.current?.focus?.(); };
  }, [offen, kontaktId]);

  const k: Kontakt | undefined = personId ? api.kontakte?.find(x => x.id === personId) : undefined;
  const treffer = useMemo(() => (suche.trim().length >= 2 ? findeKontakte(api.kontakte ?? [], suche.trim(), 8) : []), [suche, api.kontakte]);
  const artDef = ARTEN.find(a => a.id === art)!;
  const knoepfe = ERGEBNIS_KNOEPFE.filter(e => artDef.ergebnisse?.includes(e.id));
  const mitNotiz = !artDef.ergebnisse || (!!ergebnis && !!ERGEBNIS_KNOEPFE.find(e => e.id === ergebnis)?.notiz);
  const stufen = (api.crm?.stufen ?? []).filter(s => s.offen);

  if (!offen) return null;

  const waehle = (x: Kontakt) => { setPersonId(x.id); setGesucht(true); setSuche(''); setMarkiert(0); setChance(null); };
  const artWahl = (a: Art) => { setArt(a); setErgebnis(ARTEN.find(x => x.id === a)?.start ?? null); };
  const besitzer = (x: Kontakt) => { const h = haeltBeziehung(x); return h === BEIDE ? api.ich ?? 'kevin' : h; };
  const erledigt = (text: string) => { setFertig(text); setTimeout(() => zu.current(), 1300); };

  /** Ergebnis ohne Notiz (Mailbox, nicht erreicht, kein Bedarf, Sperre) — ein Tipp, gespeichert. */
  async function sofort(e: Ergebnis) {
    if (!k || laeuft) return;
    if (e === 'sperre' && !window.confirm(`${anzeigename(k)} widerspricht Werbung? Die Person wird gesperrt und taucht nirgends mehr auf.`)) return;
    setLaeuft(true); setFehler('');
    try {
      const r = await festhalten(api, { id: k.id, art, ergebnis: e }, undefined, heute);
      if (r.error || !r.kontakt) { setFehler(r.error ?? 'Nicht gespeichert.'); return; }
      erledigt(`${anzeigename(k)} · ${ERGEBNIS_KNOEPFE.find(x => x.id === e)?.label}${r.hinweis ? ` — ${r.hinweis}` : ''}`);
    } finally { setLaeuft(false); }
  }

  /**
   * Mit Notiz: erst der Deal (damit die Aktivität an ihm hängt), dann Verlauf, dann ggf. die Einwilligung.
   * Der Deal entsteht über die Lead-Ebene (/api/crm/lead „sql“): Der Lead der Firma bzw. Person wird SQL —
   * so bleiben die Ebenen sauber, auch wenn die Qualifizierung erst im Gespräch klar wurde (dann vermerkt).
   */
  async function speichern(x: NotizErgebnis) {
    if (!k || laeuft) return;
    setLaeuft(true); setFehler('');
    try {
      let chanceId: string | undefined;
      if (chance && chance.titel.trim()) {
        const betrag = Math.max(0, Math.round(Number(chance.betrag.replace(/\./g, '').replace(',', '.')) || 0));
        const schritt = chance.schritt.trim() ? { text: chance.schritt.trim(), datum: chance.datum } : x.naechster;
        if (!schritt) { setFehler('Für den Deal braucht es einen nächsten Schritt mit Datum.'); return; }
        const r = await fetch('/api/crm/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'sql', id: k.firmaId ?? k.id, trotzdem: true,
          deal: { titel: chance.titel.trim(), art: chance.basis === 'monat' ? 'retainer' : 'projekt', betrag, basis: chance.basis, schritt, besitzer: besitzer(k), kontaktIds: [k.id] } }) }).then(y => y.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
        if (!r.ok) { setFehler(r.fehler ?? 'Deal nicht angelegt.'); return; }
        chanceId = r.chanceId;
        void api.laden();
      }
      const r = await festhalten(api, { id: k.id, art, ...(ergebnis ? { ergebnis } : {}), notiz: x.notiz, naechster: x.naechster, ...(chanceId ? { bezug: chanceId } : {}) }, x.einwilligung, heute);
      if (r.error || !r.kontakt) { setFehler(r.error ?? 'Nicht gespeichert.'); return; }
      erledigt([`${anzeigename(k)} · festgehalten`, chanceId && 'SQL → Deal angelegt', x.einwilligung && 'Einwilligung für Mail', x.naechster && `nächster Schritt ${x.naechster.datum.slice(8, 10)}.${x.naechster.datum.slice(5, 7)}.`].filter(Boolean).join(' · '));
    } finally { setLaeuft(false); }
  }

  return (
    <div onClick={() => zu.current()} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(5,7,8,.62)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: schmal ? 'stretch' : 'flex-start', padding: schmal ? 0 : '7vh 16px' }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="schnell-erfassen-titel" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
        style={{ width: schmal ? '100%' : 'min(640px, 100%)', maxHeight: schmal ? '100%' : '86vh', height: schmal ? '100%' : undefined, overflowY: 'auto', overscrollBehavior: 'contain',
          background: C.flaeche, borderRadius: schmal ? 0 : 18, border: schmal ? 'none' : '1px solid rgba(255,255,255,.07)', boxShadow: '0 30px 80px -20px rgba(0,0,0,.8)',
          padding: schmal ? '14px 16px max(20px, env(safe-area-inset-bottom))' : '18px 22px 22px', color: C.ink, fontFamily: SCHRIFT.text, display: 'grid', gap: 16, alignContent: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 id="schnell-erfassen-titel" style={{ margin: 0, fontFamily: SCHRIFT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-.01em' }}>Gespräch festhalten</h2>
          <button onClick={() => zu.current()} aria-label="Schließen" className="fassbar" style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.inkDim, fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>

        {fertig ? (
          <div role="status" style={{ display: 'grid', justifyItems: 'center', gap: 10, padding: '28px 8px', textAlign: 'center' }}>
            <span aria-hidden style={{ width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', background: LEUCHT.gut, color: C.grund, fontSize: 28, fontWeight: 800, boxShadow: `0 0 28px ${LEUCHT.gut}88` }}>✓</span>
            <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5 }}>{fertig}</div>
          </div>
        ) : (
          <>
            {/* Person */}
            <div>
              <h3 style={titelKlein}>Mit wem?</h3>
              <input ref={sucheRef} value={suche} placeholder={k ? 'Andere Person suchen …' : 'Name oder Firma …'} aria-label="Person suchen" autoComplete="off"
                role="combobox" aria-expanded={treffer.length > 0} aria-controls="schnell-erfassen-treffer" aria-activedescendant={treffer[markiert] ? `se-${treffer[markiert].id}` : undefined}
                onChange={e => { setSuche(e.target.value); setMarkiert(0); }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setMarkiert(x => Math.min(treffer.length - 1, x + 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setMarkiert(x => Math.max(0, x - 1)); }
                  else if (e.key === 'Enter' && treffer[markiert]) { e.preventDefault(); waehle(treffer[markiert]); }
                }}
                style={{ ...feld, fontSize: 16, padding: '12px 14px' }} />
              {treffer.length > 0 && (
                <div id="schnell-erfassen-treffer" role="listbox" aria-label="Treffer" style={{ display: 'grid', gap: 2, marginTop: 6 }}>
                  {treffer.map((x, j) => (
                    <button key={x.id} id={`se-${x.id}`} role="option" aria-selected={j === markiert} onMouseEnter={() => setMarkiert(j)} onClick={() => waehle(x)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, padding: '8px 12px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left', background: j === markiert ? 'rgba(255,255,255,.07)' : 'transparent', color: C.ink }}>
                      <Person id={haeltBeziehung(x)} groesse={20} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: TYP.body, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anzeigename(x)}</span>
                        <span style={{ display: 'block', fontSize: 12.5, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[x.position ?? x.jobtitel, x.firma].filter(Boolean).join(' · ') || STUFE_LABEL[x.stufe]}</span>
                      </span>
                      {x.werbesperre && <Chip farbe={LEUCHT.kritisch}>Sperre</Chip>}
                    </button>
                  ))}
                </div>
              )}
              {suche.trim().length >= 2 && !treffer.length && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 8 }}>Nicht in der Kartei — neue Personen legst du unter Markttraktion › Kontakte an.</div>}
              {k && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '10px 12px', borderRadius: 12, background: `${LEUCHT.business}12`, border: `1px solid ${LEUCHT.business}33` }}>
                  <Person id={haeltBeziehung(k)} groesse={22} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: TYP.body, fontWeight: 700 }}>{anzeigename(k)}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: C.inkDim }}>{[k.firma, STUFE_LABEL[k.stufe]].filter(Boolean).join(' · ')}</span>
                  </span>
                  {k.werbesperre && <Chip farbe={LEUCHT.kritisch}>Werbesperre</Chip>}
                </div>
              )}
            </div>

            {k && (
              <>
                {/* Art und Ergebnis */}
                <div>
                  <h3 style={titelKlein}>Was war?</h3>
                  <Pillen liste={ARTEN} aktiv={art} onWahl={artWahl} farbe={LEUCHT.business} />
                  {knoepfe.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      {knoepfe.map(e => (
                        <Knopf key={e.id} aus={laeuft} leise={ergebnis !== e.id} farbe={e.id === 'sperre' ? LEUCHT.kritisch : e.id === 'termin' || e.id === 'gespraech' ? LEUCHT.gut : undefined}
                          onClick={() => (e.notiz ? setErgebnis(e.id) : void sofort(e.id))}>{e.label}</Knopf>
                      ))}
                    </div>
                  )}
                  {art === 'anruf' && !ergebnis && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 8 }}>Mailbox, nicht erreicht, kein Bedarf und Sperre sind mit einem Tipp gespeichert.</div>}
                </div>

                {mitNotiz && (
                  <>
                    {/* Chance optional gleich mit */}
                    <div>
                      {!chance ? (
                        <button onClick={() => setChance({ titel: k.firma ?? anzeigename(k), betrag: '', basis: 'monat', stufe: stufen[0]?.id ?? 'qualifiziert', schritt: '', datum: plusTage(heute, 5) })}
                          className="fassbar" style={{ minHeight: 40, padding: '8px 14px', borderRadius: 11, border: `1px dashed ${LEUCHT.achtung}66`, background: 'transparent', color: LEUCHT.achtung, fontWeight: 600, fontSize: TYP.bedien, cursor: 'pointer', fontFamily: SCHRIFT.text }}>+ Deal anlegen (SQL)</button>
                      ) : (
                        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: `${LEUCHT.achtung}0d`, border: `1px solid ${LEUCHT.achtung}33` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ ...titelKlein, margin: 0 }}>Chance</h3>
                            <button onClick={() => setChance(null)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5, minHeight: 32 }}>entfernen</button>
                          </div>
                          <input value={chance.titel} aria-label="Titel der Chance" placeholder="Titel (Firma)" onChange={e => setChance({ ...chance, titel: e.target.value })} style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px' }} />
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <input value={chance.betrag} inputMode="numeric" aria-label="Wert in Euro" placeholder="Wert €" onChange={e => setChance({ ...chance, betrag: e.target.value })} style={{ ...feld, width: 130, fontSize: TYP.bedien, padding: '9px 12px' }} />
                            <Pillen liste={[{ id: 'monat', label: '€ / Monat' }, { id: 'einmalig', label: 'einmalig' }]} aktiv={chance.basis} onWahl={(basis: WertBasis) => setChance({ ...chance, basis })} farbe={LEUCHT.achtung} />
                          </div>
                          <div style={{ fontSize: 12, color: C.inkLeise }}>Der Deal startet in der Pipeline auf Stufe „SQL“ — der Lead wird SQL (Ebene 1 → 2).</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input value={chance.schritt} aria-label="Nächster Schritt der Chance" placeholder="Nächster Schritt (sonst der aus der Notiz)" onChange={e => setChance({ ...chance, schritt: e.target.value })} style={{ ...feld, flex: 1, minWidth: 180, fontSize: TYP.bedien, padding: '9px 12px' }} />
                            <input type="date" value={chance.datum} aria-label="Datum des nächsten Schritts" onChange={e => setChance({ ...chance, datum: e.target.value })} style={{ ...feld, width: 'auto', fontSize: TYP.bedien, padding: '9px 12px' }} />
                          </div>
                        </div>
                      )}
                    </div>

                    <NotizFormular heute={heute} ergebnis={ergebnis ?? undefined} knopf={laeuft ? 'Speichert …' : 'Festhalten'} onAbbruch={() => zu.current()} autoFokus={gesucht && !schmal}
                      einwilligung={!hatMailEinwilligung(k)} anrede={k.anrede} onFertig={x => void speichern(x)} />
                  </>
                )}
              </>
            )}
            {fehler && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{fehler}</div>}
            <div className="nur-tastatur" style={{ fontSize: 12, color: C.inkLeise }}>↑↓ wählen · Enter übernehmen · Esc schließen</div>
          </>
        )}
      </div>
    </div>
  );
}
