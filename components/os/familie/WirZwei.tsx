'use client';

// ─── Wir zwei — das Fundament ───────────────────────────────────────────────
// Reihenfolge nach Wirkung (Recherche 24.09.): Rhythmus und nächstes
// Paar-Gespräch → die kleinen Dinge heute → Zeit zu zweit → was ansteht
// (Themen, Vereinbarungen) → einander kennen (Wünsche, Profil) → wenn es hakt
// → wohin wir wollen.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Ring, Chip, Knopf, Leer, Liste, Zeile, Haken, Fortschritt, LEUCHT } from '../schlank';
import { Flaeche, Kachel } from '../flaeche/Flaeche';
import { DATE_IDEEN, REPARATUR_SAETZE, MUSTER, HILFE } from '@/lib/familie/katalog';
import type { Thema, Wunsch, DateIdee, Reparatur } from '@/lib/familie/typen';
import { type FamilieApi, neueId, datumLang } from './daten';
import { Eingabe, Textfeld, Wahl, Klein, Reihe, Mehr, Symbol } from './teile';

const ROSA = LEUCHT.beziehung;
const STUFE: Record<string, { text: string; farbe: string }> = {
  'im-takt': { text: 'Im Takt', farbe: LEUCHT.gut }, stabil: { text: 'Stabil', farbe: LEUCHT.puls },
  'aus-dem-takt': { text: 'Aus dem Takt', farbe: LEUCHT.achtung }, fundament: { text: 'Fundament pflegen', farbe: LEUCHT.kritisch },
  pause: { text: 'Pausiert', farbe: C.inkDim }, leer: { text: 'Noch leer', farbe: C.inkDim },
};

export function WirZwei({ api, onGespraech }: { api: FamilieApi; onGespraech: () => void }) {
  const d = api.d!;
  const f = d.familie;
  const ich = d.person;
  const partner = d.mitglieder.find(m => m.person !== ich)?.person ?? null;
  const st = STUFE[d.rhythmus.stufe];
  const g = d.gespraech;
  const uhr = f.einstellungen.gespraech;

  return (
    <>
      <Flaeche seite="familie-wir">
      <Kachel id="rhythmus" titel="Pflege-Rhythmus" breite={6}>
      <Karte i={0} akzent={ROSA}>
        <div className="heute-kopf" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(18px,4vw,40px)', alignItems: 'center' }}>
          <Ring label="Pflege-Rhythmus" wert={d.rhythmus.score != null ? String(d.rhythmus.score) : undefined} farbe={st.farbe}
            anteil={d.rhythmus.score != null ? d.rhythmus.score / 100 : undefined} unter={<Chip farbe={st.farbe}>{st.text}</Chip>} />
          <div style={{ minWidth: 0, display: 'grid', gap: 12 }}>
            <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5, margin: 0 }}>{d.rhythmus.hinweis}</p>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>Nächstes Paar-Gespräch</div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{datumLang(g.datum, d.heute)} · {uhr.uhrzeit} · {uhr.dauerMin} Min</div>
            </div>
            <Reihe>
              <Knopf onClick={onGespraech} farbe={ROSA}>{g.laufend ? 'Gespräch fortsetzen' : 'Gespräch starten'}</Knopf>
              <InKalender vorhanden={f.einstellungen.kalenderTermine?.[g.datum]} titel="Paar-Gespräch" start={`${g.datum}T${uhr.uhrzeit}`} dauerMin={uhr.dauerMin}
                merken={uid => api.felder({ einstellungen: { kalenderTermine: { ...(f.einstellungen.kalenderTermine ?? {}), [g.datum]: uid } } })} />
              <Klein>{d.agenda.offeneThemen.length === 1 ? '1 Thema' : `${d.agenda.offeneThemen.length} Themen`} im Parkplatz · {d.agenda.offeneVereinbarungen.length === 1 ? '1 Vereinbarung' : `${d.agenda.offeneVereinbarungen.length} Vereinbarungen`} offen</Klein>
            </Reihe>
          </div>
        </div>
        <Mehr titel="Woraus sich der Rhythmus ergibt">
          <div style={{ display: 'grid', gap: 9 }}>
            {d.rhythmus.bausteine.map(b => (
              <div key={b.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px,180px) 1fr minmax(120px,220px)', gap: 12, alignItems: 'center', fontSize: TYP.bedien }}>
                <span style={{ color: C.inkDim }}>{b.titel} <span style={{ color: C.inkLeise }}>· {b.gewicht}</span></span>
                <Fortschritt anteil={b.wert} farbe={b.wert >= 1 ? LEUCHT.gut : ROSA} />
                <span style={{ color: C.inkLeise, fontSize: 12.5 }}>{b.text}</span>
              </div>
            ))}
            <Klein>Gemessen wird, was ihr gemeinsam tut — über 28 Tage, nie eine einzelne Person und nie Gefühle.</Klein>
          </div>
        </Mehr>
      </Karte>
      </Kachel>
        <Kachel id="heute" titel="Heute verbunden" breite={3}><Heute api={api} partner={partner} /></Kachel>
        <Kachel id="themen" titel="Themen-Parkplatz" breite={3}><Themen api={api} /></Kachel>
        <Kachel id="dates" titel="Zeit zu zweit" breite={3}><Dates api={api} /></Kachel>
        <Kachel id="reparatur" titel="Wenn es hakt" breite={3}><Reparatur api={api} partner={partner} /></Kachel>
        <Kachel id="wuensche" titel="Einander kennen" breite={3}><Wuensche api={api} partner={partner} /></Kachel>
        <Kachel id="vision" titel="Unsere Vision" breite={3}><Vision api={api} /></Kachel>
      </Flaeche>
    </>
  );
}

// ── Heute: Rituale, Wertschätzung, Frage der Woche ──
function Heute({ api, partner }: { api: FamilieApi; partner: string | null }) {
  const d = api.d!;
  const f = d.familie;
  const heute = d.heute;
  const erledigt = new Set(f.ritualtage.find(r => r.datum === heute)?.erledigt ?? []);
  const rituale = f.rituale.filter(r => r.ebene === 'paar' && r.rhythmus === 'taeglich');
  const heuteWert = f.wertschaetzungen.filter(w => w.datum === heute);
  const meine = f.lovemap.find(a => a.frageId === d.frage.id && a.person === d.person);
  const deren = f.lovemap.filter(a => a.frageId === d.frage.id && a.person !== d.person);
  return (
    <Karte i={1}>
      <Ueberschrift farbe={ROSA}>Heute verbunden</Ueberschrift>
      <Liste>
        {rituale.map(r => {
          const an = erledigt.has(r.id);
          const um = () => api.felder({ ritual: { datum: heute, id: r.id, an: !an } });
          return <Zeile key={r.id} onClick={um} links={<Haken an={an} onChange={um} farbe={ROSA} />} titel={<span style={{ color: an ? LEUCHT.gut : C.ink, whiteSpace: 'normal' }}>{r.titel}</span>} />;
        })}
      </Liste>
      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>Was ich heute an dir schätze</div>
        <Eingabe leeren platzhalter="Konkret: „… — das zeigt mir, dass du …“" onFertig={text => api.setze('wertschaetzungen', { id: neueId('w'), an: partner ?? '', text, datum: heute })} />
        {heuteWert.map(w => <Klein key={w.id}><b style={{ color: C.inkDim }}>{api.name(w.von)}:</b> {w.text}</Klein>)}
      </div>
      <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>Frage der Woche</div>
        <div style={{ fontSize: TYP.body, lineHeight: 1.45 }}>{d.frage.text}</div>
        <Eingabe wert={meine?.antwort ?? ''} platzhalter="Meine Antwort — dein Gegenüber sieht sie" onFertig={antwort => api.setze('lovemap', { id: meine?.id ?? neueId('lm'), frageId: d.frage.id, person: d.person, antwort })} />
        {deren.map(a => <Klein key={a.id}><b style={{ color: C.inkDim }}>{api.name(a.person)}:</b> {a.antwort}</Klein>)}
        {!deren.length && meine && <Klein>Die Antwort deines Gegenübers erscheint hier, sobald sie da ist.</Klein>}
      </div>
    </Karte>
  );
}

// ── In den gemeinsamen Kalender (26.09.) ──
// Paar-Gespräch und Dates landen auf Wunsch im Kalender „Gemeinsam“ (iCloud, mit Malin geteilt) — ohne
// Teilnehmer, also ohne Einladungs-Mail. Einmal angelegt, merkt sich MAKE OS die Uid: kein Doppel.
const plusMin = (start: string, min: number) => { const d = new Date(`${start}:00Z`); d.setUTCMinutes(d.getUTCMinutes() + min); return d.toISOString().slice(0, 16); };
const plusTag = (tag: string, n: number) => { const d = new Date(`${tag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function InKalender({ vorhanden, titel, start, dauerMin, ganztags, merken }: { vorhanden?: string; titel: string; start: string; dauerMin?: number; ganztags?: boolean; merken: (uid: string) => Promise<unknown> }) {
  const [lage, setLage] = useState<'still' | 'laeuft' | 'fehler'>('still');
  const [fehler, setFehler] = useState('');
  if (vorhanden) return <Klein>im Kalender ✓</Klein>;
  const anlegen = async () => {
    setLage('laeuft');
    const ende = ganztags ? plusTag(start, 1) : plusMin(start, dauerMin ?? 45);
    const r = await fetch('/api/kalender/termin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titel, wer: 'beide', start, ende, ganztags: !!ganztags, notiz: 'Aus MAKE OS · Familie & Partnerschaft' }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok && typeof r.uid === 'string') { await merken(r.uid); setLage('still'); }
    else { setFehler(r.fehler ?? 'Nicht angelegt.'); setLage('fehler'); }
  };
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <Knopf leise aus={lage === 'laeuft'} onClick={() => void anlegen()}>{lage === 'laeuft' ? 'legt an …' : 'in den Kalender'}</Knopf>
      {lage === 'fehler' && <Klein>{fehler}</Klein>}
    </span>
  );
}

// ── Zeit zu zweit ──
function Dates({ api }: { api: FamilieApi }) {
  const d = api.d!;
  const f = d.familie;
  const [plan, setPlan] = useState<{ titel: string; datum: string; planer: string; ideeId: string | null; neu: boolean } | null>(null);
  const geplant = f.dates.filter(x => x.status === 'geplant').sort((a, b) => a.datum.localeCompare(b.datum));
  const vorbei = geplant.filter(x => x.datum < d.heute);
  const kommend = geplant.filter(x => x.datum >= d.heute);
  const gewesen = f.dates.filter(x => x.status === 'stattgefunden').sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 3);
  const genutzt = new Set(f.dates.map(x => x.ideeId));
  const ideen = [...f.ideen].sort((a, b) => Number(genutzt.has(a.id)) - Number(genutzt.has(b.id)) || Number(b.neu) - Number(a.neu)).slice(0, 5);
  const starte = (i?: DateIdee) => setPlan({ titel: i?.titel ?? '', datum: d.heute, planer: d.person, ideeId: i?.id ?? null, neu: i?.neu ?? false });

  return (
    <Karte i={2}>
      <Ueberschrift farbe={ROSA} rechts={<Knopf leise onClick={() => starte()}>+ Date</Knopf>}>Zeit zu zweit</Ueberschrift>
      {plan && (
        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', marginBottom: 12 }}>
          <Eingabe wert={plan.titel} platzhalter="Was macht ihr?" onFertig={titel => setPlan({ ...plan, titel })} />
          <Reihe>
            <input type="date" value={plan.datum} onChange={e => setPlan({ ...plan, datum: e.target.value })} aria-label="Datum" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 10px', color: C.ink }} />
            <span style={{ fontSize: 12.5, color: C.inkLeise }}>plant komplett:</span>
            <Wahl liste={d.mitglieder.map(m => ({ id: m.person, label: m.name }))} aktiv={plan.planer} onWahl={planer => setPlan({ ...plan, planer })} farbe={ROSA} />
          </Reihe>
          <Reihe>
            <Knopf farbe={ROSA} aus={!plan.titel.trim()} onClick={() => { void api.setze('dates', { id: neueId('d'), titel: plan.titel.trim(), ideeId: plan.ideeId, datum: plan.datum, planer: plan.planer, status: 'geplant', neuesErlebnis: plan.neu, nachklang: [] }); setPlan(null); }}>Festmachen</Knopf>
            <Knopf leise onClick={() => setPlan(null)}>Abbrechen</Knopf>
          </Reihe>
        </div>
      )}
      <Liste>
        {vorbei.map(x => (
          <Zeile key={x.id} titel={x.titel} unter={`${datumLang(x.datum)} · hat es stattgefunden?`}
            rechts={<Reihe gap={4}><Knopf leise onClick={() => api.setze('dates', { ...x, status: 'stattgefunden' })}>Ja</Knopf><Knopf leise onClick={() => api.setze('dates', { ...x, status: 'abgesagt' })}>Nein</Knopf></Reihe>} />
        ))}
        {kommend.map(x => (
          <Zeile key={x.id} titel={x.titel} unter={`${datumLang(x.datum, d.heute)} · plant ${api.name(x.planer)}`} rechts={<>{x.neuesErlebnis && <Chip farbe={ROSA}>Neu</Chip>}<InKalender vorhanden={x.kalenderUid} titel={`Date: ${x.titel}`} start={x.datum} ganztags merken={uid => api.setze('dates', { ...x, kalenderUid: uid })} /><Symbol titel="Absagen" onClick={() => api.setze('dates', { ...x, status: 'abgesagt' })}>×</Symbol></>} />
        ))}
      </Liste>
      {!kommend.length && !vorbei.length && <Leer>Kein Date geplant. Eine Idee aus dem Pool übernehmen — wer plant, plant komplett, inklusive Reservierung.</Leer>}
      {gewesen.length > 0 && (
        <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {gewesen.map(x => (
            <Reihe key={x.id}>
              <Klein>{datumLang(x.datum)} · {x.titel}</Klein>
              <button onClick={() => api.setze('dates', { ...x, neuesErlebnis: !x.neuesErlebnis })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: x.neuesErlebnis ? ROSA : C.inkLeise }}>{x.neuesErlebnis ? '✦ etwas Neues' : 'war es neu?'}</button>
            </Reihe>
          ))}
        </div>
      )}
      <Mehr titel={`Ideen-Pool (${f.ideen.length})`}>
        <Liste>
          {ideen.map(i => <Zeile key={i.id} titel={<span style={{ whiteSpace: 'normal' }}>{i.titel}</span>} unter={`${i.dauer} · ${'€'.repeat(i.kosten) || 'kostenlos'}${genutzt.has(i.id) ? ' · schon gemacht' : ''}`} rechts={<>{i.neu && <Chip farbe={ROSA}>Neu</Chip>}<Knopf leise onClick={() => starte(i)}>Planen</Knopf></>} />)}
        </Liste>
        <div style={{ marginTop: 10 }}><Eingabe leeren platzhalter="Eigene Idee in den Pool" onFertig={titel => api.setze('ideen', { id: neueId('di'), titel, tags: [], aufwand: 1, kosten: 1, dauer: 'abend', neu: true })} /></div>
        {f.ideen.length < DATE_IDEEN.length && <Klein>Einige Start-Ideen wurden entfernt.</Klein>}
      </Mehr>
    </Karte>
  );
}

// ── Themen-Parkplatz und Vereinbarungen ──
const HUT = [{ id: 'privat', label: 'Wir' }, { id: 'business', label: 'Business' }] as const;
function Themen({ api }: { api: FamilieApi }) {
  const d = api.d!;
  const f = d.familie;
  const [hut, setHut] = useState<Thema['hut']>('privat');
  const [privat, setPrivat] = useState(false);
  const offen = f.themen.filter(t => t.status === 'offen' || t.status === 'geparkt');
  const vereinb = f.vereinbarungen.filter(v => v.status === 'offen');
  return (
    <Karte i={1}>
      <Ueberschrift farbe={ROSA} rechts="kommt ins nächste Gespräch">Themen-Parkplatz</Ueberschrift>
      <div style={{ display: 'grid', gap: 8 }}>
        <Eingabe leeren platzhalter="Was sollten wir in Ruhe besprechen?" onFertig={titel => api.setze('themen', { id: neueId('t'), titel, art: 'unklar', status: 'offen', hut, sichtbarkeit: privat ? 'nur-ich' : 'paar' })} />
        <Reihe>
          <Wahl liste={[...HUT]} aktiv={hut} onWahl={setHut} farbe={ROSA} />
          <label style={{ fontSize: 12.5, color: C.inkLeise, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={privat} onChange={e => setPrivat(e.target.checked)} /> erst mal nur für mich</label>
        </Reihe>
      </div>
      <Liste>
        {offen.map(t => (
          <Zeile key={t.id} titel={<span style={{ whiteSpace: 'normal' }}>{t.titel}</span>}
            unter={`${api.name(t.von)}${t.hut === 'business' ? ' · Business — nicht fürs Paar-Gespräch' : ''}${t.sichtbarkeit === 'nur-ich' ? ' · nur für dich sichtbar' : ''}${t.status === 'geparkt' ? ' · geparkt' : ''}`}
            rechts={<Reihe gap={2}>
              {t.sichtbarkeit === 'nur-ich' && <Knopf leise onClick={() => api.setze('themen', { ...t, sichtbarkeit: 'paar' })}>Teilen</Knopf>}
              <Symbol titel="Besprochen" onClick={() => api.setze('themen', { ...t, status: 'besprochen' })}>✓</Symbol>
              <Symbol titel="Entfernen" onClick={() => api.weg('themen', t.id)}>×</Symbol>
            </Reihe>} />
        ))}
      </Liste>
      {!offen.length && <Leer>Nichts geparkt. Themen landen hier, statt zwischen Tür und Angel besprochen zu werden.</Leer>}

      <div style={{ marginTop: 18 }}>
        <Ueberschrift>Vereinbarungen</Ueberschrift>
        <Liste>
          {vereinb.map(v => {
            const um = () => api.setze('vereinbarungen', { ...v, status: 'erledigt' });
            return <Zeile key={v.id} links={<Haken an={false} onChange={um} farbe={ROSA} />} titel={<span style={{ whiteSpace: 'normal' }}>{v.text}</span>} unter={`${api.name(v.wer)}${v.faellig ? ` · bis ${datumLang(v.faellig)}` : ''}`} />;
          })}
        </Liste>
        <div style={{ marginTop: 8 }}><Eingabe leeren platzhalter="Neue Vereinbarung — wer macht was?" onFertig={text => api.setze('vereinbarungen', { id: neueId('v'), text, wer: d.person, faellig: null, status: 'offen' })} /></div>
      </div>
    </Karte>
  );
}

// ── Wünsche und das eigene Profil ──
const KATEGORIEN: { id: Wunsch['kategorie']; label: string }[] = [{ id: 'alltag', label: 'Alltag' }, { id: 'zeit', label: 'Zeit' }, { id: 'naehe', label: 'Nähe' }, { id: 'erlebnis', label: 'Erlebnis' }, { id: 'geschenk', label: 'Geschenk' }];
function Wuensche({ api, partner }: { api: FamilieApi; partner: string | null }) {
  const d = api.d!;
  const f = d.familie;
  const [kat, setKat] = useState<Wunsch['kategorie']>('alltag');
  const [privat, setPrivat] = useState(false);
  const mein = f.profile.find(p => p.person === d.person);
  const deins = partner ? f.profile.find(p => p.person === partner) : undefined;
  const offen = f.wuensche.filter(w => w.status === 'offen');
  const profil = (feld: 'stress' | 'traeume' | 'wasMirGuttut', text: string) => api.felder({ profil: { stress: mein?.stress ?? '', traeume: mein?.traeume ?? '', wasMirGuttut: mein?.wasMirGuttut ?? '', [feld]: text } });
  return (
    <Karte i={3}>
      <Ueberschrift farbe={ROSA}>Einander kennen</Ueberschrift>
      <div style={{ display: 'grid', gap: 8 }}>
        <Eingabe leeren platzhalter="Ein Wunsch — klein oder groß" onFertig={text => api.setze('wuensche', { id: neueId('u'), text, kategorie: kat, status: 'offen', sichtbarkeit: privat ? 'nur-ich' : 'paar' })} />
        <Reihe>
          <Wahl liste={KATEGORIEN} aktiv={kat} onWahl={setKat} farbe={ROSA} />
          <label style={{ fontSize: 12.5, color: C.inkLeise, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={privat} onChange={e => setPrivat(e.target.checked)} /> Merkzettel (nur ich)</label>
        </Reihe>
      </div>
      <Liste>
        {offen.map(w => (
          <Zeile key={w.id} titel={<span style={{ whiteSpace: 'normal' }}>{w.text}</span>} unter={`${w.sichtbarkeit === 'nur-ich' ? 'Merkzettel · ' : `Wunsch von ${api.name(w.von)} · `}${KATEGORIEN.find(k => k.id === w.kategorie)?.label}`}
            rechts={<Reihe gap={2}><Symbol titel="Erfüllt" onClick={() => api.setze('wuensche', { ...w, status: 'erfuellt' })}>✓</Symbol><Symbol titel="Entfernen" onClick={() => api.weg('wuensche', w.id)}>×</Symbol></Reihe>} />
        ))}
      </Liste>
      <Mehr titel="Mein Profil — was mein Gegenüber wissen sollte">
        <div style={{ display: 'grid', gap: 8 }}>
          <Textfeld zeilen={2} wert={mein?.stress} platzhalter="Was mich gerade stresst" onFertig={t => profil('stress', t)} />
          <Textfeld zeilen={2} wert={mein?.traeume} platzhalter="Wovon ich gerade träume" onFertig={t => profil('traeume', t)} />
          <Textfeld zeilen={2} wert={mein?.wasMirGuttut} platzhalter="Was mir guttut, wenn es eng wird" onFertig={t => profil('wasMirGuttut', t)} />
        </div>
      </Mehr>
      {deins && (deins.stress || deins.traeume || deins.wasMirGuttut) && (
        <Mehr titel={`Profil von ${api.name(partner)}`}>
          <div style={{ display: 'grid', gap: 6 }}>
            {deins.stress && <Klein><b style={{ color: C.inkDim }}>Stresst gerade:</b> {deins.stress}</Klein>}
            {deins.traeume && <Klein><b style={{ color: C.inkDim }}>Träumt von:</b> {deins.traeume}</Klein>}
            {deins.wasMirGuttut && <Klein><b style={{ color: C.inkDim }}>Tut gut:</b> {deins.wasMirGuttut}</Klein>}
          </div>
        </Mehr>
      )}
    </Karte>
  );
}

// ── Wenn es hakt ──
function Reparatur({ api, partner }: { api: FamilieApi; partner: string | null }) {
  const d = api.d!;
  const offen = d.familie.reparaturen.filter(r => !r.abgeschlossen).sort((a, b) => b.datum.localeCompare(a.datum))[0];
  const meine = offen?.reflexionen.find(x => x.person === d.person);
  const deren = offen?.reflexionen.filter(x => x.person !== d.person) ?? [];
  const leer = { person: d.person, gefuehle: '', meineSicht: '', meinAnteil: '', wunsch: '', geteilt: false };
  const setzeMeine = (r: Reparatur, teil: Partial<typeof leer>) => {
    const eigene = { ...(r.reflexionen.find(x => x.person === d.person) ?? leer), ...teil };
    // Fremde Reflexionen kommen nur geteilt an — der Server führt beide zusammen.
    return api.setze('reparaturen', { ...r, reflexionen: [...r.reflexionen.filter(x => x.person !== d.person), eigene] });
  };
  const pauseBis = () => { const t = new Date(Date.now() + 20 * 60_000); return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };
  return (
    <Karte i={2}>
      <Ueberschrift farbe={ROSA}>Wenn es hakt</Ueberschrift>
      {!offen ? (
        <>
          <Klein>Streit gehört dazu. Wichtig ist, wie ihr zurückfindet: erst Pause, dann jeder für sich sortieren, dann zusammen.</Klein>
          <div style={{ marginTop: 10 }}><Knopf leise onClick={() => api.setze('reparaturen', { id: neueId('r'), datum: d.heute, pauseBis: pauseBis(), reflexionen: [leer], abgeschlossen: null, vereinbarung: '' })}>Reparatur beginnen</Knopf></div>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {offen.pauseBis && <Klein farbe={ROSA}>Pause bis {offen.pauseBis} — mindestens 20 Minuten runterkommen, nicht grübeln.</Klein>}
          <Textfeld zeilen={2} wert={meine?.gefuehle} platzhalter="Was habe ich gefühlt?" onFertig={t => setzeMeine(offen, { gefuehle: t })} />
          <Textfeld zeilen={2} wert={meine?.meineSicht} platzhalter="Wie habe ich es erlebt? (ohne Vorwurf)" onFertig={t => setzeMeine(offen, { meineSicht: t })} />
          <Textfeld zeilen={2} wert={meine?.meinAnteil} platzhalter="Was war mein Anteil — auch ein kleiner?" onFertig={t => setzeMeine(offen, { meinAnteil: t })} />
          <Textfeld zeilen={2} wert={meine?.wunsch} platzhalter="Was wünsche ich mir fürs nächste Mal?" onFertig={t => setzeMeine(offen, { wunsch: t })} />
          <Reihe>
            <Knopf leise onClick={() => setzeMeine(offen, { geteilt: !meine?.geteilt })}>{meine?.geteilt ? 'Geteilt ✓' : `Mit ${api.name(partner)} teilen`}</Knopf>
            <Klein>{deren.length ? `${api.name(partner)} hat geteilt.` : 'Die Sicht deines Gegenübers erscheint, sobald sie geteilt ist.'}</Klein>
          </Reihe>
          {deren.map(x => (
            <div key={x.person} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,126,182,.06)', display: 'grid', gap: 4 }}>
              {x.gefuehle && <Klein><b style={{ color: C.inkDim }}>Gefühlt:</b> {x.gefuehle}</Klein>}
              {x.meineSicht && <Klein><b style={{ color: C.inkDim }}>Erlebt:</b> {x.meineSicht}</Klein>}
              {x.meinAnteil && <Klein><b style={{ color: C.inkDim }}>Eigener Anteil:</b> {x.meinAnteil}</Klein>}
              {x.wunsch && <Klein><b style={{ color: C.inkDim }}>Wunsch:</b> {x.wunsch}</Klein>}
            </div>
          ))}
          <Eingabe wert={offen.vereinbarung} platzhalter="Was wir daraus mitnehmen (Vereinbarung)" onFertig={vereinbarung => api.setze('reparaturen', { ...offen, vereinbarung })} />
          <div><Knopf farbe={ROSA} onClick={() => api.setze('reparaturen', { ...offen, abgeschlossen: d.heute })}>Wieder gut — abschließen</Knopf></div>
        </div>
      )}
      <Mehr titel="Sätze, die zurückführen">
        <div style={{ display: 'grid', gap: 6 }}>{REPARATUR_SAETZE.map(s => <Klein key={s}>„{s}“</Klein>)}</div>
      </Mehr>
      <Mehr titel="Vier Muster und ihr Gegenmittel">
        <div style={{ display: 'grid', gap: 6 }}>{MUSTER.map(m => <Klein key={m.muster}><b style={{ color: C.inkDim }}>{m.muster}:</b> {m.gegenmittel}</Klein>)}</div>
      </Mehr>
      <Klein><span style={{ display: 'block', marginTop: 12 }}>{HILFE}</span></Klein>
    </Karte>
  );
}

// ── Wohin wir wollen ──
function Vision({ api }: { api: FamilieApi }) {
  const d = api.d!;
  const jahr = Number(d.heute.slice(0, 4));
  const v = d.familie.visionen.find(x => x.jahr === jahr) ?? { jahr, leitbild: '', ziele: [], traeume: [] };
  const ziele = (z: typeof v.ziele) => api.felder({ vision: { ...v, ziele: z } });
  return (
    <Karte i={3}>
      <Ueberschrift farbe={ROSA} rechts={String(jahr)}>Unsere Vision</Ueberschrift>
      <Textfeld wert={v.leitbild} zeilen={3} platzhalter="Wie soll sich unser Leben in einem Jahr anfühlen? Was ist uns als Familie wichtig?" onFertig={leitbild => api.felder({ vision: { ...v, leitbild } })} />
      <Liste>
        {v.ziele.map(z => {
          const um = () => ziele(v.ziele.map(x => (x.id === z.id ? { ...x, erreicht: !x.erreicht } : x)));
          return <Zeile key={z.id} links={<Haken an={z.erreicht} onChange={um} farbe={ROSA} />} titel={<span style={{ whiteSpace: 'normal' }}>{z.text}</span>} rechts={<Symbol titel="Entfernen" onClick={() => ziele(v.ziele.filter(x => x.id !== z.id))}>×</Symbol>} />;
        })}
      </Liste>
      <div style={{ marginTop: 8 }}><Eingabe leeren platzhalter="Gemeinsames Ziel fürs Jahr" onFertig={text => ziele([...v.ziele, { id: neueId('z'), text, erreicht: false }])} /></div>
    </Karte>
  );
}
