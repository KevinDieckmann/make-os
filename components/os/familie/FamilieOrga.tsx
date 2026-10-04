'use client';

// ─── Familie — organisieren, ohne dass einer alles im Kopf trägt ────────────
// Wichtige Tage mit Vorlauf, Kontakt-Rhythmus zur Familie, Aufgabenkarten mit
// voller Verantwortung (Fair Play: wer die Karte hat, denkt, plant und macht).
// Die Verteilung ist offen sichtbar — als Gesprächsgrundlage, nicht als Wertung.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Leer, Liste, Zeile, Haken, LEUCHT, ZeileAktionen } from '../ui';
import { Flaeche, Kachel } from '../flaeche/Flaeche';
import { KINDER_KARTEN } from '@/lib/familie/katalog';
import type { Karte as KarteT, WichtigerTag, Mensch } from '@/lib/familie/typen';
import { type FamilieApi, neueId, datumLang } from './daten';
import { Eingabe, Wahl, Klein, Reihe, Mehr, Symbol, Auswahl } from './teile';
import { tagDatum } from '@/lib/familie/logik';
import { useFamilieAblage, MitAktionen, ArchivBlock } from './ablage';
import { geburtstagSaeubern, geburtstagText, naechsterGeburtstag } from '@/lib/kalender/geburtstag';

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

export function Tage({ api }: { api: FamilieApi }) {
  const d = api.d!;
  const [neu, setNeu] = useState<{ titel: string; datum: string; art: WichtigerTag['art']; aktion: WichtigerTag['aktion']; wer: string; vorlaufTage: number; menschId?: string } | null>(null);
  const [alle, setAlle] = useState(false);
  const jahr = (am: string) => Number(am.slice(0, 4));
  const menschen = d.familie.menschen;
  // Geburtstag (29.09., K2): der MENSCH führt das Datum — der wichtige Tag verweist nur (menschId, ohne eigenes Datum).
  const verwiesen = neu?.art === 'geburtstag' && neu.menschId ? menschen.find(m => m.id === neu.menschId) : undefined;
  const datumVon = (t: WichtigerTag) => tagDatum(t, menschen) ?? '';
  const ablage = useFamilieAblage(api);
  const liste = alle ? d.familie.tage.filter(t => !t.archiviertAm).sort((a, b) => datumVon(a).slice(-5).localeCompare(datumVon(b).slice(-5))) : null;
  const ok = neu && neu.titel.trim() && (verwiesen ? verwiesen.geburtstag || geburtstagSaeubern(neu.datum) : datumAus(neu.datum));
  const speichern = () => {
    if (!neu || !ok) return;
    if (verwiesen) {
      // Fehlt dem Menschen der Geburtstag, landet das eingegebene Datum dort (eine Stelle je Person).
      if (!verwiesen.geburtstag) void api.setze('menschen', { ...verwiesen, geburtstag: geburtstagSaeubern(neu.datum) ?? null });
      void api.setze('tage', { id: neueId('tag'), titel: neu.titel.trim(), art: 'geburtstag', datum: '', menschId: verwiesen.id, vorlaufTage: neu.vorlaufTage, wer: neu.wer, aktion: neu.aktion, erledigt: [] });
    } else void api.setze('tage', { id: neueId('tag'), titel: neu.titel.trim(), art: neu.art, datum: datumAus(neu.datum)!, vorlaufTage: neu.vorlaufTage, wer: neu.wer, aktion: neu.aktion, erledigt: [] });
    setNeu(null);
  };
  return (
    <Karte i={0}>
      <Ueberschrift farbe={ROSA} rechts={<Knopf leise onClick={() => setNeu({ titel: '', datum: '', art: 'geburtstag', aktion: 'geschenk', wer: d.person, vorlaufTage: 14 })}>+ Tag</Knopf>}>Wichtige Tage · 60 Tage</Ueberschrift>
      {neu && (
        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', marginBottom: 12 }}>
          <Reihe>
            <div style={{ flex: 2, minWidth: 160 }}><Eingabe wert={neu.titel} platzhalter="Wessen Tag? (z. B. Geburtstag Mama)" onFertig={titel => setNeu({ ...neu, titel })} /></div>
            {verwiesen?.geburtstag
              ? <div style={{ flex: 1, minWidth: 110 }}><Klein>{geburtstagText(verwiesen.geburtstag)} (bei {verwiesen.name})</Klein></div>
              : <div style={{ flex: 1, minWidth: 110 }}><Eingabe wert={neu.datum} platzhalter="TT.MM." onFertig={datum => setNeu({ ...neu, datum })} /></div>}
          </Reihe>
          <Reihe><Wahl liste={ARTEN} aktiv={neu.art} onWahl={art => setNeu({ ...neu, art })} farbe={ROSA} /></Reihe>
          {neu.art === 'geburtstag' && menschen.length > 0 && (
            <Reihe><Klein>Wessen Geburtstag:</Klein><Wahl liste={[{ id: '', label: 'niemand aus „Unsere Menschen“' }, ...menschen.map(m => ({ id: m.id, label: m.name }))]} aktiv={neu.menschId ?? ''}
              onWahl={id => { const m = menschen.find(x => x.id === id); setNeu({ ...neu, menschId: id || undefined, ...(m && !neu.titel.trim() ? { titel: `Geburtstag ${m.name}` } : {}) }); }} farbe={ROSA} /></Reihe>
          )}
          <Reihe>
            <Wahl liste={AKTIONEN} aktiv={neu.aktion} onWahl={aktion => setNeu({ ...neu, aktion })} farbe={ROSA} />
            <Klein>kümmert sich:</Klein><Wahl liste={d.mitglieder.map(m => ({ id: m.person, label: m.name }))} aktiv={neu.wer} onWahl={wer => setNeu({ ...neu, wer })} farbe={ROSA} />
            <Auswahl label="Vorlauf" wert={neu.vorlaufTage} liste={[3, 7, 14, 21, 30].map(n => ({ id: n, label: `${n} Tage vorher` }))} onWahl={vorlaufTage => setNeu({ ...neu, vorlaufTage })} />
          </Reihe>
          <Reihe>
            <Knopf farbe={ROSA} aus={!ok} onClick={speichern}>Speichern</Knopf>
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
          {liste.map(t => { const dt = datumVon(t); return <MitAktionen key={t.id} ablage={ablage} liste="tage" e={t} titel={t.titel}><Zeile titel={t.titel} unter={`${dt ? `${dt.slice(-2)}.${dt.slice(-5, -3)}.` : 'ohne Datum'} · ${ARTEN.find(a => a.id === t.art)?.label}${t.menschId ? ' · Datum vom Menschen' : ''} · ${t.vorlaufTage} Tage Vorlauf`} /></MitAktionen>; })}
        </Liste>
      )}
      {alle && <ArchivBlock ablage={ablage} liste="tage" eintraege={d.familie.tage} titelVon={e => String(e.titel ?? '')} />}
      {ablage.hinweis}
    </Karte>
  );
}

export function Menschen({ api }: { api: FamilieApi }) {
  const d = api.d!;
  const [rolle, setRolle] = useState<Mensch['rolle']>('eltern');
  const [takt, setTakt] = useState<number | null>(7);
  const [geb, setGeb] = useState<string | null>(null);
  const [gebFehler, setGebFehler] = useState(false);
  const faellig = new Set(d.kontakte.map(k => k.id));
  const gebMensch = geb ? d.familie.menschen.find(m => m.id === geb) : undefined;
  const ablage = useFamilieAblage(api);
  const sortiert = d.familie.menschen.filter(m => !m.archiviertAm).sort((a, b) => Number(faellig.has(b.id)) - Number(faellig.has(a.id)) || a.name.localeCompare(b.name));
  const TAKTE = [{ id: '0', label: 'ohne Takt' }, { id: '7', label: 'wöchentlich' }, { id: '14', label: 'alle 2 Wochen' }, { id: '30', label: 'monatlich' }];
  return (
    <Karte i={2}>
      <Ueberschrift farbe={ROSA} rechts={d.kontakte.length ? `${d.kontakte.length} dran` : undefined}>Unsere Menschen</Ueberschrift>
      <Liste>
        {sortiert.map(m => {
          const dran = faellig.has(m.id);
          return (
            <MitAktionen key={m.id} ablage={ablage} liste="menschen" e={m} titel={m.name}>
            <Zeile titel={<span style={{ color: dran ? C.ink : C.inkDim }}>{m.name}</span>}
              unter={`${ROLLEN.find(r => r.id === m.rolle)?.label}${m.kontaktAlleTage ? ` · alle ${m.kontaktAlleTage} Tage` : ''}${m.letzterKontakt ? ` · zuletzt ${datumLang(m.letzterKontakt)}` : ''}${(() => { const n = m.geburtstag ? naechsterGeburtstag(m.geburtstag, d.heute) : null; return n ? ` · 🎂 ${geburtstagText(m.geburtstag)}${n.inTagen === 0 ? ' — heute' : n.inTagen <= 30 ? ` — in ${n.inTagen} T` : ''}` : ''; })()}`}
              rechts={<Reihe gap={4}>
                {dran && <Chip farbe={ROSA}>dran</Chip>}
                <Symbol titel={m.geburtstag ? 'Geburtstag ändern' : 'Geburtstag eintragen'} onClick={() => { setGeb(geb === m.id ? null : m.id); setGebFehler(false); }}>🎂</Symbol>
                <Knopf leise onClick={() => api.setze('menschen', { ...m, letzterKontakt: d.heute })}>Gesprochen</Knopf>
              </Reihe>} />
            </MitAktionen>
          );
        })}
      </Liste>
      {gebMensch && (
        <div style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.03)', marginTop: 8 }}>
          <Klein>Geburtstag von {gebMensch.name} — „TT.MM.“ oder „TT.MM.JJJJ“ (mit Jahr zeigt der Kalender das Alter). Leer lassen und Enter entfernt ihn.</Klein>
          <Eingabe wert={gebMensch.geburtstag ?? ''} platzhalter="TT.MM.JJJJ" onFertig={t => {
            const g = t ? geburtstagSaeubern(t, d.heute) : null;
            if (t && !g) { setGebFehler(true); return; }
            void api.setze('menschen', { ...gebMensch, geburtstag: g ?? null }); setGeb(null); setGebFehler(false);
          }} />
          {gebFehler && <Klein farbe={LEUCHT.kritisch}>Kein gültiges Datum — z. B. „3.10.“ oder „3.10.1990“.</Klein>}
        </div>
      )}
      {!sortiert.length && <Leer>Eltern, Geschwister, Kinder, enge Freunde — mit einem Takt, wie oft sie von euch hören sollen.</Leer>}
      <ArchivBlock ablage={ablage} liste="menschen" eintraege={d.familie.menschen} titelVon={e => String(e.name ?? '')} />
      {ablage.hinweis}
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
                // Karten (04.10.): „Archiv“ ist hier „betrifft uns nicht“ (`aktiv: false`) — Löschen nur bei eigenen Karten (Katalog-Karten kämen als Vorschlag wieder).
                <ZeileAktionen key={k.id} titel={k.titel} archiviert={!k.aktiv} onArchivieren={() => void api.setze('karten', { ...k, aktiv: !k.aktiv })} onLoeschen={k.id.startsWith('k-') ? undefined : () => void api.weg('karten', k.id)}>
                <Zeile titel={<span style={{ color: k.aktiv ? C.ink : C.inkLeise, whiteSpace: 'normal' }}>{k.titel}</span>}
                  unter={<span title={k.mindeststandard}>{k.mindeststandard}{k.geprueft ? ` · geprüft ${datumLang(k.geprueft)}` : ''}</span>}
                  rechts={k.aktiv ? <Reihe gap={4}>
                    <Wahl liste={d.mitglieder.map(m => ({ id: m.person, label: m.name }))} aktiv={k.inhaber} onWahl={inhaber => api.setze('karten', { ...k, inhaber: inhaber === k.inhaber ? null : inhaber })} farbe={ROSA} />
                    {k.inhaber && alt(k) && <Symbol titel="Gemeinsam geprüft" onClick={() => api.setze('karten', { ...k, geprueft: d.heute })}>✓</Symbol>}
                    <Symbol titel="Betrifft uns nicht" onClick={() => api.setze('karten', { ...k, aktiv: false })}>–</Symbol>
                  </Reihe> : <Knopf leise onClick={() => api.setze('karten', { ...k, aktiv: true })}>Aufnehmen</Knopf>} />
                </ZeileAktionen>
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
  const ablage = useFamilieAblage(api);
  const alleRituale = d.familie.rituale.filter(r => r.ebene === 'familie' || r.rhythmus !== 'taeglich');
  const liste = alleRituale.filter(r => !r.archiviertAm);
  const RH = [{ id: 'woechentlich', label: 'wöchentlich' }, { id: 'monatlich', label: 'monatlich' }, { id: 'jaehrlich', label: 'jährlich' }] as const;
  return (
    <Karte i={3}>
      <Ueberschrift farbe={ROSA}>Unsere Traditionen</Ueberschrift>
      <Liste>
        {liste.map(r => <MitAktionen key={r.id} ablage={ablage} liste="rituale" e={r} titel={r.titel}><Zeile titel={r.titel} unter={`${r.ebene === 'paar' ? 'wir zwei' : 'Familie'} · ${RH.find(x => x.id === r.rhythmus)?.label ?? r.rhythmus}`} /></MitAktionen>)}
      </Liste>
      <ArchivBlock ablage={ablage} liste="rituale" eintraege={alleRituale} titelVon={e => String(e.titel ?? '')} />
      {ablage.hinweis}
      {!liste.length && <Leer>Sonntagsfrühstück, der erste Schnee, der Jahresrückblick an Silvester — was euch als Familie ausmacht.</Leer>}
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        <Eingabe leeren platzhalter="Tradition hinzufügen" onFertig={titel => api.setze('rituale', { id: neueId('rit'), titel, ebene: 'familie', rhythmus })} />
        <Reihe><Wahl liste={[...RH]} aktiv={rhythmus} onWahl={setRhythmus} farbe={ROSA} /></Reihe>
      </div>
    </Karte>
  );
}
