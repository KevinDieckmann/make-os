'use client';

// ─── Familie — organisieren, ohne dass einer alles im Kopf trägt ────────────
// Wichtige Tage mit Vorlauf, Kontakt-Rhythmus zur Familie, Aufgabenkarten mit
// voller Verantwortung (Fair Play: wer die Karte hat, denkt, plant und macht).
// Die Verteilung ist offen sichtbar — als Gesprächsgrundlage, nicht als Wertung.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Leer, Liste, Zeile, Haken, LEUCHT } from '../schlank';
import { Flaeche, Kachel } from '../flaeche/Flaeche';
import { KINDER_KARTEN } from '@/lib/familie/katalog';
import type { Karte as KarteT, WichtigerTag, Mensch } from '@/lib/familie/typen';
import { type FamilieApi, neueId, datumLang } from './daten';
import { Eingabe, Wahl, Klein, Reihe, Mehr, Symbol, Auswahl } from './teile';

const ROSA = LEUCHT.beziehung;
const BEREICHE: { id: KarteT['bereich']; label: string }[] = [
  { id: 'zuhause', label: 'Zuhause' }, { id: 'unterwegs', label: 'Unterwegs' }, { id: 'fuersorge', label: 'Fürsorge' }, { id: 'magie', label: 'Das Besondere' }, { id: 'wild', label: 'Wenn es passiert' },
];
const ARTEN: { id: WichtigerTag['art']; label: string }[] = [{ id: 'geburtstag', label: 'Geburtstag' }, { id: 'jahrestag', label: 'Jahrestag' }, { id: 'gedenktag', label: 'Gedenktag' }, { id: 'sonstig', label: 'Sonstiges' }];
const AKTIONEN: { id: WichtigerTag['aktion']; label: string }[] = [{ id: 'geschenk', label: 'Geschenk' }, { id: 'karte', label: 'Karte' }, { id: 'anruf', label: 'Anruf' }, { id: 'feier', label: 'Feier' }];
const ROLLEN: { id: Mensch['rolle']; label: string }[] = [{ id: 'kind', label: 'Kind' }, { id: 'eltern', label: 'Eltern' }, { id: 'geschwister', label: 'Geschwister' }, { id: 'freund', label: 'Freunde' }, { id: 'sonstig', label: 'Sonstige' }];

/** „24.12.“ oder „24.12.1990“ → MM-TT bzw. JJJJ-MM-TT */
function datumAus(t: string): string | null {
  const m = t.trim().match(/^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/);
  if (!m) return null;
  const tt = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0');
  if (Number(mm) < 1 || Number(mm) > 12 || Number(tt) < 1 || Number(tt) > 31) return null;
  return m[3] ? `${m[3]}-${mm}-${tt}` : `${mm}-${tt}`;
}

export function FamilieOrga({ api }: { api: FamilieApi }) {
  return (
    <Flaeche seite="familie-orga">
      <Kachel id="tage" titel="Wichtige Tage" breite={3}><Tage api={api} /></Kachel>
      <Kachel id="karten" titel="Wer trägt was" breite={3}><Karten api={api} /></Kachel>
      <Kachel id="menschen" titel="Unsere Menschen" breite={3}><Menschen api={api} /></Kachel>
      <Kachel id="rituale" titel="Unsere Traditionen" breite={3}><Rituale api={api} /></Kachel>
    </Flaeche>
  );
}

function Tage({ api }: { api: FamilieApi }) {
  const d = api.d!;
  const [neu, setNeu] = useState<{ titel: string; datum: string; art: WichtigerTag['art']; aktion: WichtigerTag['aktion']; wer: string; vorlaufTage: number } | null>(null);
  const [alle, setAlle] = useState(false);
  const jahr = (am: string) => Number(am.slice(0, 4));
  const liste = alle ? [...d.familie.tage].sort((a, b) => a.datum.slice(-5).localeCompare(b.datum.slice(-5))) : null;
  const ok = neu && neu.titel.trim() && datumAus(neu.datum);
  return (
    <Karte i={0}>
      <Ueberschrift farbe={ROSA} rechts={<Knopf leise onClick={() => setNeu({ titel: '', datum: '', art: 'geburtstag', aktion: 'geschenk', wer: d.person, vorlaufTage: 14 })}>+ Tag</Knopf>}>Wichtige Tage · 60 Tage</Ueberschrift>
      {neu && (
        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', marginBottom: 12 }}>
          <Reihe>
            <div style={{ flex: 2, minWidth: 160 }}><Eingabe wert={neu.titel} platzhalter="Wessen Tag? (z. B. Geburtstag Mama)" onFertig={titel => setNeu({ ...neu, titel })} /></div>
            <div style={{ flex: 1, minWidth: 110 }}><Eingabe wert={neu.datum} platzhalter="TT.MM." onFertig={datum => setNeu({ ...neu, datum })} /></div>
          </Reihe>
          <Reihe><Wahl liste={ARTEN} aktiv={neu.art} onWahl={art => setNeu({ ...neu, art })} farbe={ROSA} /></Reihe>
          <Reihe>
            <Wahl liste={AKTIONEN} aktiv={neu.aktion} onWahl={aktion => setNeu({ ...neu, aktion })} farbe={ROSA} />
            <Klein>kümmert sich:</Klein><Wahl liste={d.mitglieder.map(m => ({ id: m.person, label: m.name }))} aktiv={neu.wer} onWahl={wer => setNeu({ ...neu, wer })} farbe={ROSA} />
            <Auswahl label="Vorlauf" wert={neu.vorlaufTage} liste={[3, 7, 14, 21, 30].map(n => ({ id: n, label: `${n} Tage vorher` }))} onWahl={vorlaufTage => setNeu({ ...neu, vorlaufTage })} />
          </Reihe>
          <Reihe>
            <Knopf farbe={ROSA} aus={!ok} onClick={() => { if (!ok) return; void api.setze('tage', { id: neueId('tag'), titel: neu.titel.trim(), art: neu.art, datum: datumAus(neu.datum)!, vorlaufTage: neu.vorlaufTage, wer: neu.wer, aktion: neu.aktion, erledigt: [] }); setNeu(null); }}>Speichern</Knopf>
            <Knopf leise onClick={() => setNeu(null)}>Abbrechen</Knopf>
          </Reihe>
        </div>
      )}
      <Liste>
        {d.tage.map(t => {
          const voll = d.familie.tage.find(x => x.id === t.id)!;
          const um = () => api.setze('tage', { ...voll, erledigt: t.erledigt ? voll.erledigt.filter(j => j !== jahr(t.am)) : [...voll.erledigt, jahr(t.am)] });
          const drängt = !t.erledigt && t.faelligAb <= d.heute;
          return (
            <Zeile key={t.id} links={<Haken an={t.erledigt} onChange={um} farbe={ROSA} />} titel={t.titel}
              unter={`${datumLang(t.am, d.heute)} · ${AKTIONEN.find(a => a.id === t.aktion)?.label} · ${api.name(t.wer)}${t.erledigt ? ' · vorbereitet' : ''}`}
              rechts={drängt ? <Chip farbe={LEUCHT.achtung}>jetzt vorbereiten</Chip> : <Chip farbe={C.inkDim}>{t.inTagen === 0 ? 'heute' : `${t.inTagen} T`}</Chip>} />
          );
        })}
      </Liste>
      {!d.tage.length && <Leer>In den nächsten 60 Tagen steht nichts an. Geburtstage und Jahrestage einmal eintragen — der Vorlauf erinnert rechtzeitig.</Leer>}
      {d.familie.tage.length > 0 && (
        <div style={{ marginTop: 8 }}><button onClick={() => setAlle(!alle)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.inkDim, fontSize: TYP.bedien, fontWeight: 600 }}>{alle ? '▾' : '▸'} Alle {d.familie.tage.length} Tage</button></div>
      )}
      {liste && (
        <Liste>
          {liste.map(t => <Zeile key={t.id} titel={t.titel} unter={`${t.datum.slice(-2)}.${t.datum.slice(-5, -3)}. · ${ARTEN.find(a => a.id === t.art)?.label} · ${t.vorlaufTage} Tage Vorlauf`} rechts={<Symbol titel="Entfernen" onClick={() => api.weg('tage', t.id)}>×</Symbol>} />)}
        </Liste>
      )}
    </Karte>
  );
}

function Menschen({ api }: { api: FamilieApi }) {
  const d = api.d!;
  const [rolle, setRolle] = useState<Mensch['rolle']>('eltern');
  const [takt, setTakt] = useState<number | null>(7);
  const faellig = new Set(d.kontakte.map(k => k.id));
  const sortiert = [...d.familie.menschen].sort((a, b) => Number(faellig.has(b.id)) - Number(faellig.has(a.id)) || a.name.localeCompare(b.name));
  const TAKTE = [{ id: '0', label: 'ohne Takt' }, { id: '7', label: 'wöchentlich' }, { id: '14', label: 'alle 2 Wochen' }, { id: '30', label: 'monatlich' }];
  return (
    <Karte i={2}>
      <Ueberschrift farbe={ROSA} rechts={d.kontakte.length ? `${d.kontakte.length} dran` : undefined}>Unsere Menschen</Ueberschrift>
      <Liste>
        {sortiert.map(m => {
          const dran = faellig.has(m.id);
          return (
            <Zeile key={m.id} titel={<span style={{ color: dran ? C.ink : C.inkDim }}>{m.name}</span>}
              unter={`${ROLLEN.find(r => r.id === m.rolle)?.label}${m.kontaktAlleTage ? ` · alle ${m.kontaktAlleTage} Tage` : ''}${m.letzterKontakt ? ` · zuletzt ${datumLang(m.letzterKontakt)}` : ''}`}
              rechts={<Reihe gap={4}>
                {dran && <Chip farbe={ROSA}>dran</Chip>}
                <Knopf leise onClick={() => api.setze('menschen', { ...m, letzterKontakt: d.heute })}>Gesprochen</Knopf>
                <Symbol titel="Entfernen" onClick={() => api.weg('menschen', m.id)}>×</Symbol>
              </Reihe>} />
          );
        })}
      </Liste>
      {!sortiert.length && <Leer>Eltern, Geschwister, Kinder, enge Freunde — mit einem Takt, wie oft sie von euch hören sollen.</Leer>}
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        <Eingabe leeren platzhalter="Name hinzufügen" onFertig={name => api.setze('menschen', { id: neueId('m'), name, rolle, geburtstag: null, kontaktAlleTage: takt, letzterKontakt: null, notiz: '' })} />
        <Reihe><Wahl liste={ROLLEN} aktiv={rolle} onWahl={setRolle} farbe={ROSA} /></Reihe>
        <Reihe><Wahl liste={TAKTE} aktiv={String(takt ?? 0)} onWahl={t => setTakt(Number(t) || null)} farbe={ROSA} /></Reihe>
      </div>
    </Karte>
  );
}

function Karten({ api }: { api: FamilieApi }) {
  const d = api.d!;
  const f = d.familie;
  const aktiv = f.karten.filter(k => k.aktiv);
  const offen = aktiv.filter(k => !k.inhaber).length;
  const personen = d.mitglieder.map(m => ({ ...m, karten: aktiv.filter(k => k.inhaber === m.person).length, minuten: aktiv.filter(k => k.inhaber === m.person).reduce((s, k) => s + (k.aufwandMinWoche ?? 0), 0) }));
  const fehlenKinder = f.einstellungen.kinder && KINDER_KARTEN.some(k => !f.karten.some(x => x.id === k.id));
  const alt = (k: KarteT) => !k.geprueft || (Date.parse(`${d.heute}T12:00:00Z`) - Date.parse(`${k.geprueft}T12:00:00Z`)) / 864e5 > 90;
  return (
    <Karte i={1}>
      <Ueberschrift farbe={ROSA} rechts={`${aktiv.length} Karten`}>Wer trägt was</Ueberschrift>
      <Klein>Jede Karte hat einen Inhaber, der sie ganz trägt: daran denken, planen, erledigen. Einmal im Quartal gemeinsam prüfen, ob der Mindeststandard noch passt.</Klein>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0 4px' }}>
        {personen.map(p => <Chip key={p.person} farbe={C.inkDim}>{p.name}: {p.karten} Karten · ~{Math.round(p.minuten / 60)} Std/Woche</Chip>)}
        {offen > 0 && <Chip farbe={LEUCHT.achtung}>{offen} ohne Inhaber</Chip>}
      </div>
      {BEREICHE.map(b => {
        const karten = f.karten.filter(k => k.bereich === b.id);
        if (!karten.length) return null;
        return (
          <Mehr key={b.id} titel={`${b.label} · ${karten.filter(k => k.aktiv && k.inhaber).length}/${karten.filter(k => k.aktiv).length} verteilt`} offen={b.id === 'zuhause'}>
            <Liste>
              {karten.map(k => (
                <Zeile key={k.id} titel={<span style={{ color: k.aktiv ? C.ink : C.inkLeise, whiteSpace: 'normal' }}>{k.titel}</span>}
                  unter={<span title={k.mindeststandard}>{k.mindeststandard}{k.geprueft ? ` · geprüft ${datumLang(k.geprueft)}` : ''}</span>}
                  rechts={k.aktiv ? <Reihe gap={4}>
                    <Wahl liste={d.mitglieder.map(m => ({ id: m.person, label: m.name }))} aktiv={k.inhaber} onWahl={inhaber => api.setze('karten', { ...k, inhaber: inhaber === k.inhaber ? null : inhaber })} farbe={ROSA} />
                    {k.inhaber && alt(k) && <Symbol titel="Gemeinsam geprüft" onClick={() => api.setze('karten', { ...k, geprueft: d.heute })}>✓</Symbol>}
                    <Symbol titel="Betrifft uns nicht" onClick={() => api.setze('karten', { ...k, aktiv: false })}>–</Symbol>
                  </Reihe> : <Knopf leise onClick={() => api.setze('karten', { ...k, aktiv: true })}>Aufnehmen</Knopf>} />
              ))}
            </Liste>
          </Mehr>
        );
      })}
      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        <Eingabe leeren platzhalter="Eigene Karte (z. B. Steuererklärung privat)" onFertig={titel => api.setze('karten', { id: neueId('k'), titel, bereich: 'zuhause', inhaber: null, mindeststandard: '', rhythmus: 'bei Bedarf', aufwandMinWoche: null, geprueft: null, aktiv: true })} />
        {fehlenKinder && <div><Knopf leise onClick={() => { KINDER_KARTEN.filter(k => !f.karten.some(x => x.id === k.id)).forEach(k => void api.setze('karten', { ...k, inhaber: null, geprueft: null, aktiv: true })); }}>Kinder-Karten hinzufügen</Knopf></div>}
      </div>
    </Karte>
  );
}

function Rituale({ api }: { api: FamilieApi }) {
  const d = api.d!;
  const [rhythmus, setRhythmus] = useState<'woechentlich' | 'monatlich' | 'jaehrlich'>('woechentlich');
  const liste = d.familie.rituale.filter(r => r.ebene === 'familie' || r.rhythmus !== 'taeglich');
  const RH = [{ id: 'woechentlich', label: 'wöchentlich' }, { id: 'monatlich', label: 'monatlich' }, { id: 'jaehrlich', label: 'jährlich' }] as const;
  return (
    <Karte i={3}>
      <Ueberschrift farbe={ROSA}>Unsere Traditionen</Ueberschrift>
      <Liste>
        {liste.map(r => <Zeile key={r.id} titel={r.titel} unter={`${r.ebene === 'paar' ? 'wir zwei' : 'Familie'} · ${RH.find(x => x.id === r.rhythmus)?.label ?? r.rhythmus}`} rechts={<Symbol titel="Entfernen" onClick={() => api.weg('rituale', r.id)}>×</Symbol>} />)}
      </Liste>
      {!liste.length && <Leer>Sonntagsfrühstück, der erste Schnee, der Jahresrückblick an Silvester — was euch als Familie ausmacht.</Leer>}
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        <Eingabe leeren platzhalter="Tradition hinzufügen" onFertig={titel => api.setze('rituale', { id: neueId('rit'), titel, ebene: 'familie', rhythmus })} />
        <Reihe><Wahl liste={[...RH]} aktiv={rhythmus} onWahl={setRhythmus} farbe={ROSA} /></Reihe>
      </div>
    </Karte>
  );
}
