'use client';

// ─── Fulfillment · Analyse — das Dossier lesen und pflegen (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.6) ──────────────────────────────────────────
// Deckblatt (Version, Stand, Quellenstand, Löschtag des Personenteils, Beleg-Quote), die Abschnitte in fester Reihenfolge — je Aussage Art, Quelle
// mit Datum, „veraltet?“ —, Aussage von Hand (mit Quelle; ohne Quelle nur in Hypothesen/offenen Fragen), Entfernen. Diagnose-Entwurf und Steckbrief
// gehen NACH F2 per Klick weiter: Quick Wins, Kick-off-Fragen und (seit 12.10.) die Maßnahmen als Zusatz-Schritte in den Fall (Route von C1), Steckbrief-Felder in die CRM-Firmenakte (CRM-Schreibweg
// mit Stand) — nie automatisch.
// 11.10. (Design, Rückmeldung: „Dossier mit Abschnitts-Navigation“): unter dem Deckblatt eine Leiste aller Abschnitte (Stand-Farbe, Zahl der Aussagen) —
// ein Tipp springt zum Abschnitt. Nur Darstellung.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import type { AbschnittId, Aussage } from '@/lib/fulfillment/typen';
import { ABSCHNITT_LABEL, ABSCHNITT_REIHE } from '@/lib/fulfillment/analyse/sicht';
import { alsErgebnis, STECKBRIEF_LABEL, type SteckbriefFeld } from '@/lib/fulfillment/analyse/ausgabe';
import { Karte, Ueberschrift, Knopf, Chip, Hinweis, Liste, Kennzahl, Raster, Feldzeile, Pillen, eingabe, auswahl, LEUCHT, useRueckfrage } from '../../ui';
import { senden, fehlerVon, inDenFall, NACH_FALL_TEXT, type AnalyseApi, type NachFallWas } from './daten';
import { insBild } from '../reise/sprung';
import { agentText } from '@/lib/fulfillment/analyse/agenten';

type Rueck = ReturnType<typeof useRueckfrage>;
const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const ART_LABEL: Record<Aussage['art'], string> = { fakt: 'Fakt', schaetzung: 'Schätzung', hypothese: 'Hypothese' };
const ART_FARBE: Record<Aussage['art'], string> = { fakt: LEUCHT.gut, schaetzung: LEUCHT.achtung, hypothese: LEUCHT.agenten };

export function DossierAnsicht({ mandatId, api, rueck }: { mandatId: string; api: AnalyseApi; rueck: Rueck }) {
  const lage = api.dossier!;
  const d = lage.dossier!;
  const [meldung, setMeldung] = useState<string | null>(null);
  const quellen = new Map(d.quellen.map(q => [q.id, q]));
  const schritt = async (body: Record<string, unknown>) => {
    const r = await senden('/api/fulfillment/dossier', { mandatId, stand: lage.stand, ...body });
    setMeldung(fehlerVon(r));
    await api.laden();
    return r;
  };
  const db = lage.deckblatt;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {meldung && <Hinweis art="achtung">{meldung}</Hinweis>}
      <Karte>
        <Ueberschrift>Deckblatt</Ueberschrift>
        <Raster min={160}>
          <Kennzahl label="Version" wert={String(db?.version ?? d.version)} />
          <Kennzahl label="Quellenstand" wert={db?.quellenStand ?? '—'} />
          <Kennzahl label="Belegt" wert={lage.belegQuote == null ? '—' : `${Math.round(lage.belegQuote * 100)} %`} />
          <Kennzahl label="Prüfschritte" wert={`${d.f1 ? 'Umfang bestätigt' : 'Umfang offen'} · ${d.f2 ? 'Dossier geprüft' : 'ungeprüft'}`} />
        </Raster>
        <div style={klein}>Personenteil: {db?.kartenAnzahl ?? 0} Karte(n) · gelöscht {db?.loeschAm ? `am ${db.loeschAm}` : `${lage.loeschRegelTage} Tage nach Mandatsende`}{(db?.geloescht ?? []).map(g => ` · Personenteil gelöscht am ${g.am} (${g.anzahl} Karten)`).join('')}</div>
      </Karte>
      <nav aria-label="Abschnitte des Dossiers" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ABSCHNITT_REIHE.map(id => {
          const a = d.abschnitte[id];
          const n = a?.aussagen.length ?? 0;
          const f = a?.status === 'geprueft' ? LEUCHT.gut : a?.status === 'entwurf' ? LEUCHT.achtung : C.inkLeise;
          return (
            <button key={id} type="button" className="fassbar" onClick={() => insBild(`dossier-${id}`)} aria-label={`${ABSCHNITT_LABEL[id]}: ${n} Aussage(n), ${a?.status === 'geprueft' ? 'geprüft' : a?.status ?? 'leer'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: TYP.bedien, color: n ? C.ink : C.inkDim, background: 'rgba(255,255,255,.04)', border: `1px solid ${n ? `${f}66` : 'rgba(255,255,255,.08)'}` }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: n ? f : 'transparent', border: `1px solid ${f}` }} />{ABSCHNITT_LABEL[id]}{n ? ` · ${n}` : ''}
            </button>
          );
        })}
      </nav>
      {ABSCHNITT_REIHE.map(id => {
        const a = d.abschnitte[id];
        const aussagen = a?.aussagen ?? [];
        return (
          <Karte key={id} id={`dossier-${id}`}>
            <Ueberschrift rechts={a ? <Chip farbe={a.status === 'geprueft' ? LEUCHT.gut : a.status === 'entwurf' ? LEUCHT.achtung : C.inkLeise}>{a.status === 'geprueft' ? 'geprüft' : a.status}</Chip> : undefined}>{ABSCHNITT_LABEL[id]}</Ueberschrift>
            {!aussagen.length && <div style={klein}>Noch nichts.</div>}
            <Liste>
              {aussagen.map(x => (
                <div key={x.id} style={{ display: 'grid', gap: 4, padding: '6px 0' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Chip farbe={ART_FARBE[x.art]}>{ART_LABEL[x.art]}</Chip>
                    {x.veraltet && <Chip farbe={LEUCHT.achtung}>veraltet?</Chip>}
                    {x.gekuerzt && <Chip farbe={C.inkLeise}>gekürzt</Chip>}
                    <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{x.agent === 'hand' ? 'von Hand' : agentText(x.agent)} · Stand {x.stand}</span>
                  </div>
                  <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5 }}>{x.text}</div>
                  {x.quellen.length > 0 && (
                    <div style={klein}>Quelle: {x.quellen.map(q => quellen.get(q)).filter(Boolean).map((q, i) => (
                      <span key={q!.id}>{i ? ' · ' : ''}{q!.url ? <a href={q!.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: C.aktiv }}>{q!.domain ?? q!.url}</a> : `Unterlage ${q!.unterlageId}`} ({q!.abgerufenAm})</span>
                    ))}</div>
                  )}
                  <div><Knopf leise onClick={async () => { if (await rueck.bestaetigen({ titel: 'Aussage entfernen?', text: 'Sie verschwindet aus dem Dossier; „Dossier geprüft“ muss danach neu vermerkt werden.', ja: 'Entfernen', gefahr: true })) await schritt({ aktion: 'aussage-entfernen', abschnitt: id, id: x.id }); }}>Entfernen</Knopf></div>
                </div>
              ))}
            </Liste>
          </Karte>
        );
      })}
      <HandAussage onSenden={b => schritt({ aktion: 'aussage-hand', ...b })} />
      <Weitergeben mandatId={mandatId} api={api} />
    </div>
  );
}

function HandAussage({ onSenden }: { onSenden: (b: Record<string, unknown>) => Promise<{ status: number; j: Record<string, unknown> }> }) {
  const [abschnitt, setAbschnitt] = useState<AbschnittId>('unternehmen');
  const [art, setArt] = useState<Aussage['art']>('fakt');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  return (
    <Karte flach>
      <Ueberschrift>Aussage von Hand</Ueberschrift>
      <form onSubmit={async e => { e.preventDefault(); const r = await onSenden({ abschnitt, art, text, ...(url ? { url } : {}) }); if (r.status === 200) { setText(''); setUrl(''); } }} style={{ display: 'grid', gap: 8 }}>
        <Feldzeile label="Abschnitt">
          <select style={auswahl} value={abschnitt} onChange={e => setAbschnitt(e.target.value as AbschnittId)}>{ABSCHNITT_REIHE.map(a => <option key={a} value={a}>{ABSCHNITT_LABEL[a]}</option>)}</select>
        </Feldzeile>
        <Pillen liste={[{ id: 'fakt', label: 'Fakt' }, { id: 'schaetzung', label: 'Schätzung' }, { id: 'hypothese', label: 'Hypothese' }]} aktiv={art} onWahl={x => setArt(x as Aussage['art'])} />
        <Feldzeile label="Aussage"><textarea style={{ ...eingabe, minHeight: 80 }} value={text} onChange={e => setText(e.target.value)} maxLength={2000} required /></Feldzeile>
        <Feldzeile label="Quelle (Adresse) — Pflicht außer bei Hypothesen und offenen Fragen"><input style={eingabe} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></Feldzeile>
        <div><Knopf typ="submit">Aussage hinzufügen</Knopf></div>
      </form>
    </Karte>
  );
}

function Weitergeben({ mandatId, api }: { mandatId: string; api: AnalyseApi }) {
  const d = api.dossier!.dossier!;
  const [meldung, setMeldung] = useState<string | null>(null);
  const a1 = [...d.laeufe].reverse().find(l => l.agent === 'a1' && (l.status === 'uebernommen' || l.status === 'fertig') && alsErgebnis(l.ergebnis)?.steckbrief);
  const steckbrief = alsErgebnis(a1?.ergebnis)?.steckbrief;
  if (!d.diagnose && !steckbrief) return null;
  const nachFall = async (was: NachFallWas) => { setMeldung((await inDenFall(mandatId, was)) ?? NACH_FALL_TEXT[was]); };
  const inFirma = async (feld: SteckbriefFeld) => {
    const r = await senden('/api/fulfillment/dossier', { aktion: 'firma-uebernehmen', mandatId, laufId: a1!.id, feld });
    const f = fehlerVon(r);
    if (f) { setMeldung(f); return; }
    const w = await senden('/api/crm/bestand', { ops: [r.j.op] }, 'PATCH');
    setMeldung(fehlerVon(w) ? `Firmenakte: ${fehlerVon(w)}` : `${STECKBRIEF_LABEL[feld]} steht in der Firmenakte.`);
  };
  return (
    <Karte>
      <Ueberschrift erklaerung="fulfillment.f2">Weitergeben (nach der Prüfung)</Ueberschrift>
      {!d.f2 && <Hinweis art="info">Erst „Dossier geprüft“ vermerken — dann gehen Quick Wins, Kick-off-Fragen und Steckbrief-Felder per Klick weiter.</Hinweis>}
      {meldung && <Hinweis art="info">{meldung}</Hinweis>}
      {d.diagnose && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: TYP.body, color: C.ink }}>Diagnose-Entwurf</div>
          {d.diagnose.top5.map(m => <div key={m.id} style={klein}>• {m.text} — Hebel {m.hebel}, Aufwand {m.aufwand}, Evidenz {m.evidenz}{m.abhaengig ? `, hängt an: ${m.abhaengig}` : ''}</div>)}
          {d.diagnose.quickWins.map((q, i) => <div key={i} style={klein}>Quick Win: {q}</div>)}
          {d.diagnose.fragen.map((f, i) => <div key={i} style={klein}>Frage an {f.an === 'gruender' ? 'Gründer' : f.an === 'entscheider' ? 'Entscheider' : 'Vertrieb'}: {f.frage}{f.warum ? ` (${f.warum})` : ''}</div>)}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf aus={!d.f2 || !d.diagnose.quickWins.length} onClick={() => nachFall('quickwins')}>Quick Wins in den Fall</Knopf>
            <Knopf aus={!d.f2 || !d.diagnose.fragen.length} onClick={() => nachFall('fragen')}>Kick-off-Fragen in den Fall</Knopf>
            <Knopf aus={!d.f2 || !d.diagnose.top5.length} onClick={() => nachFall('massnahmen')}>Maßnahmen in den Ablauf</Knopf>
          </div>
        </div>
      )}
      {steckbrief && (
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          <div style={{ fontSize: TYP.body, color: C.ink }}>Steckbrief → Firmenakte</div>
          {(Object.entries(steckbrief) as [SteckbriefFeld, { wert: string }][]).map(([f, x]) => (
            <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={klein}>{STECKBRIEF_LABEL[f]}: {x.wert}</span>
              <Knopf leise aus={!d.f2} onClick={() => inFirma(f)}>In die Firmenakte übernehmen</Knopf>
            </div>
          ))}
        </div>
      )}
    </Karte>
  );
}
