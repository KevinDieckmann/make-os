'use client';

// ─── Agenten-Seite: die Mitte mit einem Head (09.10., Paket 2) ─────────────────────────────────────────────────────────
// Fragerunde 5: „Reiter Chat · Aktivität · Mitarbeiter · Skills · Gedächtnis · Leistung · Einstellungen · Kopf mit
// Auftrag + 3 Kennzahlen + Skills als Chips · Vorschläge als Karte im Chat · Delegation als aufklappbare Karte.“
// „Wenn ich auf Heads bin, chatte ich im nächsten Fenster auch nur mit ihnen.“ — der Chat hier spricht NUR mit diesem Head;
// @Mitarbeiter im Feld (oder ein Chip) legt einen neuen Mitarbeiter-Thread an.
// Was der Head sieht, entscheidet der Server; der Kopf zeigt es nur an („Sieht / sieht nicht“, aus den KI-Kategorien des Katalogs).

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { FARBE as C, ABSTAND, LEUCHT, MIKRO, SCHRIFT, TYP, ZIEL } from '@/lib/make-one/design';
import { headDef } from '@/lib/agenten/katalog';
import { TON_SATZ, GRENZEN, type Aufwand, type AutonomieStufe, type EinstellungFeld, type FadenAntwort, type HeadDef, type HeadKarte, type ModelTier, type Nachricht, type SkillKurz, type SkillsAntwort, type Mitarbeiter } from '@/lib/agenten/typen';
import { MODEL_LABEL } from '@/lib/make-one/agents-data';
import { Chip, Eigenschaft, Feldzeile, Hinweis, Karte, Kennzahl, Knopf, Leer, Leerzustand, Liste, Raster, Reiter, Schalter, Segmente, SymbolKnopf, Wahl, Zeile, auswahl, eingabe } from '../ui';
import { KuerzelKugel, bereichFarbe, fotoVon, headFarbe } from './Avatar';
import { ChatFeld, ChatVerlauf, Schreibt } from './Chat';
import { LaufZeile } from './Hintergrund';
import { anfrageId, einstellungSenden, ENTSTEHEND_LEER, entstehendNach, fadenSenden, ladeFaden, ladeFotos, ladeSkills, meldeNeu, skillSenden, useAbruf, type Abruf, type Entstehend } from './daten';
import { headKarte, useAgenten } from './kontext';
import {
  ansprache, ansprechbarFuer, ausloeserText, euro, FADEN_STATUS_NAME, kostenImMonat, leistungVon, quote, sichtVon, zeitKurz,
} from './regeln';
import { KUGEL_GROESSE } from './masse';

type ReiterId = 'chat' | 'aktivitaet' | 'mitarbeiter' | 'skills' | 'gedaechtnis' | 'leistung' | 'einstellungen';
const REITER: { id: ReiterId; label: string }[] = [
  { id: 'chat', label: 'Chat' }, { id: 'aktivitaet', label: 'Aktivität' }, { id: 'mitarbeiter', label: 'Mitarbeiter' }, { id: 'skills', label: 'Skills' },
  { id: 'gedaechtnis', label: 'Gedächtnis' }, { id: 'leistung', label: 'Leistung' }, { id: 'einstellungen', label: 'Einstellungen' },
];
const AMPEL = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: C.inkLeise } as const;
const AUFWAND_NAME = { low: 'gering', medium: 'mittel', high: 'hoch' } as const;

// ── Kopf ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function HeadKopf({ k, def }: { k: HeadKarte | null; def: HeadDef | null }) {
  const { dialog, starteEntwurf, form } = useAgenten();
  const handy = form === 'handy';
  const chips = handy ? 3 : 6;
  const name = k?.name ?? def?.name ?? 'Head';
  const kurz = k?.kurz ?? def?.kurz ?? name;
  const farbe = headFarbe(k?.farbe ?? def?.farbe);
  const bereich = k?.bereich ?? def?.bereich;
  const sicht = def ? sichtVon(def) : null;
  const skills = k?.skills ?? [];
  return (
    <header style={{ display: 'grid', gap: ABSTAND.m }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.m }}>
        <KuerzelKugel name={kurz} farbe={farbe} bereich={bereich} groesse={KUGEL_GROESSE.kopf} foto={fotoVon(k)} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: ABSTAND.s, flexWrap: 'wrap' }}>
            {name}{bereich && <Chip farbe={bereichFarbe(bereich)}>{bereich === 'business' ? 'Business' : 'Privat'}</Chip>}
          </h2>
          <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.5 }}>{k?.auftrag ?? def?.auftrag}</div>
        </div>
      </div>
      {sicht && (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
          <b style={{ color: C.ink }}>Sieht:</b> {sicht.sieht.join(' · ') || '—'}
          {sicht.mitEinwilligung.length > 0 && <> · mit Einwilligung: {sicht.mitEinwilligung.join(' · ')}</>}
          {sicht.siehtNicht.length > 0 && <> &nbsp; <b style={{ color: C.ink }}>Sieht nicht:</b> {sicht.siehtNicht.join(' · ')}</>}
        </div>
      )}
      {k && k.kennzahlen.length > 0 && (
        <Raster min={handy ? 120 : 200}>
          {k.kennzahlen.slice(0, 3).map(z => <Kennzahl key={z.id} klein wert={z.wert ?? undefined} label={z.label} ton={z.ampel ? AMPEL[z.ampel] : undefined} />)}
        </Raster>
      )}
      {(skills.length > 0 || k) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.xs, flexWrap: 'wrap' }}>
          <span style={{ ...MIKRO, marginRight: ABSTAND.xs }}>Skills</span>
          {skills.slice(0, chips).map(s => <Wahl key={s.id} klein an={false} farbe={farbe} onClick={() => dialog({ art: 'skill', headId: s.headId, skillId: s.id })}>/{s.name}{s.eingebaut ? ' 🔒' : ''}</Wahl>)}
          {skills.length > chips && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>+{skills.length - chips}</span>}
          {k && <SymbolKnopf ariaLabel="Neuer Skill" onClick={() => dialog({ art: 'skill', headId: k.id })}><Plus size={16} /></SymbolKnopf>}
        </div>
      )}
      {k && k.mitarbeiter.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.xs, flexWrap: 'wrap' }}>
          <span style={{ ...MIKRO, marginRight: ABSTAND.xs }}>Mitarbeiter</span>
          {k.mitarbeiter.filter(m => m.aktiv).slice(0, chips).map(m => <Wahl key={m.id} klein an={false} farbe={farbe} onClick={() => starteEntwurf({ headId: k.id, mitarbeiterId: m.id })}>{m.name}</Wahl>)}
          {k.mitarbeiter.filter(m => m.aktiv).length > chips && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>+{k.mitarbeiter.filter(m => m.aktiv).length - chips}</span>}
          <SymbolKnopf ariaLabel="Neuer Mitarbeiter" onClick={() => dialog({ art: 'mitarbeiter', headId: k.id })}><Plus size={16} /></SymbolKnopf>
        </div>
      )}
      {k?.hinweis && <Hinweis art="info">{k.hinweis}</Hinweis>}
      {k?.gesperrt && <Hinweis art="info" titel="Gerade ruhig">{k.gesperrt.text}</Hinweis>}
    </header>
  );
}

// ── Reiter Chat ────────────────────────────────────────────────────────────────────────────────────────────────────────

function HeadChat({ k, fadenId: ausAdresse }: { k: HeadKarte; fadenId?: string }) {
  const w = useAgenten();
  const { stapel, oeffne, melde, dialog, form, faeden } = w;
  const heads = w.agenten.zustand === 'da' ? w.agenten.daten.heads : [];
  // Threads dieses Heads, jüngster zuerst. Ohne Thread in der Adresse öffnet der jüngste (der Verlauf geht weiter);
  // „+ Neuer Thread“ beginnt bewusst leer.
  const threads = (faeden.zustand === 'da' ? faeden.daten.faeden : k.letzteFaeden)
    .filter(f => f.agent.art === 'head' && f.agent.headId === k.id)
    .sort((a, b) => Date.parse(b.aktualisiert) - Date.parse(a.aktualisiert));
  const [neu, setNeu] = useState(false);
  const fadenId = ausAdresse ?? (neu ? undefined : threads[0]?.id);
  const vorgegeben = fadenId ? w.vorlage?.faeden?.[fadenId] : undefined;
  const geladen = useAbruf<FadenAntwort>(fadenId && !vorgegeben ? `faden:${fadenId}` : null, () => ladeFaden(fadenId!));
  const faden: { stand: Abruf<FadenAntwort> } = vorgegeben ? { stand: { zustand: 'da', daten: vorgegeben } } : geladen;
  const [wartend, setWartend] = useState<Nachricht | null>(null);
  // Streaming: der Text, während er entsteht, und das laufende Werkzeug.
  const [entsteht, setEntsteht] = useState<Entstehend>(ENTSTEHEND_LEER);
  const laeuft = !!wartend;
  const ansprechbar = ansprechbarFuer('head', heads, k.id);
  const fa = fadenId && faden.stand.zustand === 'da' ? faden.stand.daten : null;
  const neuerThread = () => { setNeu(true); if (ausAdresse) oeffne({ h: k.id }); };

  const senden = async (text: string): Promise<boolean> => {
    const an = ansprache(text, ansprechbar);
    if (an && an.ziel.art === 'mitarbeiter') {
      if (!an.rest) { melde(`Was soll ${an.ziel.name} tun? Schreib den Auftrag hinter @${an.ziel.name}.`, 'info'); return false; }
      const r = await fadenSenden({ aktion: 'senden', agent: { art: 'mitarbeiter', headId: k.id, mitarbeiterId: an.ziel.id }, text: an.rest, anfrageId: anfrageId() });
      if (!r.ok) { melde(r.kommt ? 'Mitarbeiter-Threads kommen mit dem Agenten-Kern.' : r.text, r.kommt ? 'info' : 'kritisch'); return false; }
      melde(`An ${an.ziel.name} gesendet.`, 'gut');
      oeffne({ f: r.daten.faden.id });
      return true;
    }
    setWartend({ id: 'nr-wartet', rolle: 'person', von: 'ich', text, zeit: new Date().toISOString() });
    setEntsteht(ENTSTEHEND_LEER);
    const r = await fadenSenden({ aktion: 'senden', agent: { art: 'head', headId: k.id }, text, ...(fa ? { fadenId: fa.faden.id, stand: fa.stand } : {}), anfrageId: anfrageId() }, e => setEntsteht(s => entstehendNach(s, e)));
    setWartend(null); setEntsteht(ENTSTEHEND_LEER);
    if (!r.ok) {
      melde(r.kommt ? `Der Chat mit ${k.kurz} kommt mit dem Agenten-Kern — die Nachricht ist noch nicht gesendet.` : r.status === 409 ? 'Der Thread hat sich inzwischen geändert — er ist neu geladen. Bitte noch einmal senden.' : r.text, r.kommt ? 'info' : 'kritisch');
      if (r.status === 409) meldeNeu();
      return false;
    }
    setNeu(false);
    if (!fa || fa.faden.id !== r.daten.faden.id) oeffne({ h: k.id, f: r.daten.faden.id }, true);
    return true;
  };

  const nachrichten = [...(fa?.faden.nachrichten ?? []), ...(wartend ? [wartend] : [])];
  const leer = faden.stand.zustand === 'kommt'
    ? <Leer>Der Chat mit {k.kurz} kommt mit dem Agenten-Kern.</Leer>
    : faden.stand.zustand === 'laedt' && fadenId ? <Leer>Thread wird geladen …</Leer>
    : faden.stand.zustand === 'fehler' || faden.stand.zustand === 'gesperrt' ? <Hinweis art="kritisch">{faden.stand.text}</Hinweis>
    : <Leerzustand symbol="✦" titel={`Frag ${k.kurz}`}>Er sieht nur die Daten seines Bereichs. Mit @Name beauftragst du einen seiner Mitarbeiter.</Leerzustand>;
  return (
    <div style={{ display: 'grid', gap: ABSTAND.l }}>
      {threads.length > 0 && (
        <div className="ui-pillen ui-pillen-einzeilig" aria-label="Threads">
          <Wahl klein an={!fadenId} onClick={neuerThread}>+ Neuer Thread</Wahl>
          {threads.slice(0, 8).map(t => <Wahl key={t.id} klein an={t.id === fadenId} onClick={() => { setNeu(false); oeffne({ h: k.id, f: t.id }); }}>{t.titel}{t.status === 'wartet' ? ' ⚑' : ''}</Wahl>)}
        </div>
      )}
      <ChatVerlauf nachrichten={nachrichten} kinder={fa?.kinder ?? []} stapel={stapel} leer={leer} fadenId={fa && !(threads.find(t => t.id === fa.faden.id) as { besitzer?: string } | undefined)?.besitzer ? fa.faden.id : undefined}
        onAlsSkill={(n) => dialog({ art: 'skill', headId: k.id, entwurf: { anleitung: n.text, quelle: 'gespraech' } })}
        unten={laeuft ? <Schreibt name={k.kurz} entsteht={entsteht} /> : undefined} />
      <ChatFeld platzhalter={`Nachricht an ${k.kurz} … (@Mitarbeiter beauftragt)`} ansprechbar={ansprechbar} onSenden={senden} laeuft={laeuft}
        aus={!!k.gesperrt && k.gesperrt.grund !== 'business-frei'} ausText={k.gesperrt?.text}
        unten={form === 'handy' ? 'var(--agenten-feld-unten, 0px)' : undefined} />
    </div>
  );
}

// ── Reiter Aktivität · Mitarbeiter · Skills · Gedächtnis · Leistung · Einstellungen ──────────────────────────────────────

function Aktivitaet({ k }: { k: HeadKarte }) {
  const { laeufe, faeden, oeffne, jetzt } = useAgenten();
  const eigene = laeufe.zustand === 'da' ? laeufe.daten.laeufe.filter(l => l.headId === k.id) : [];
  const threads = (faeden.zustand === 'da' ? faeden.daten.faeden : k.letzteFaeden).filter(f => f.agent.art !== 'zoe' && (f.agent as { headId: string }).headId === k.id);
  return (
    <div style={{ display: 'grid', gap: ABSTAND.xl }}>
      <div style={{ display: 'grid', gap: ABSTAND.s }}>
        <span style={{ ...MIKRO }}>Läufe</span>
        {laeufe.zustand === 'kommt' ? <Leer>Die Läufe des Heads erscheinen hier, sobald der Takt sie meldet.</Leer>
          : eigene.length ? <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: ABSTAND.s }}>{eigene.map(l => <LaufZeile key={l.id} l={l} />)}</ul>
          : <Leer>Noch keine Läufe.</Leer>}
      </div>
      <div style={{ display: 'grid', gap: ABSTAND.s }}>
        <span style={{ ...MIKRO }}>Threads</span>
        {threads.length ? (
          <Liste>
            {threads.map(t => <Zeile key={t.id} onClick={() => oeffne(t.agent.art === 'head' ? { h: k.id, f: t.id } : { f: t.id })} titel={t.titel}
              unter={`${t.agent.art === 'mitarbeiter' ? k.mitarbeiter.find(m => m.id === (t.agent as { mitarbeiterId: string }).mitarbeiterId)?.name ?? 'Mitarbeiter' : k.kurz} · ${zeitKurz(t.aktualisiert, jetzt)}`}
              rechts={<Chip farbe={t.status === 'wartet' ? LEUCHT.achtung : t.status === 'fehler' ? LEUCHT.kritisch : C.inkDim}>{FADEN_STATUS_NAME[t.status]}</Chip>} />)}
          </Liste>
        ) : <Leer>Noch keine Threads.</Leer>}
      </div>
    </div>
  );
}

function MitarbeiterReiter({ k, skills }: { k: HeadKarte; skills: Abruf<SkillsAntwort> }) {
  const { dialog, starteEntwurf } = useAgenten();
  const farbe = headFarbe(k.farbe);
  const voll: Mitarbeiter[] | null = skills.zustand === 'da' ? skills.daten.mitarbeiter.filter(m => m.headId === k.id || m.auchFuer.includes(k.id)) : null;
  const liste = voll ?? k.mitarbeiter.map(m => ({ id: m.id, headId: k.id, name: m.name, rolle: m.rolle, werkzeuge: [], auchFuer: m.auchFuer, stufe: 'ausgewogen' as const, aktiv: m.aktiv, gedaechtnis: [], quelle: 'vorlage' as const }));
  return (
    <div style={{ display: 'grid', gap: ABSTAND.m }}>
      {liste.length ? (
        <Liste>
          {liste.map(m => (
            <div key={m.id} style={{ display: 'grid', gap: ABSTAND.xs, padding: `${ABSTAND.s}px 0` }}>
              <Zeile links={<KuerzelKugel name={m.name} farbe={farbe} bereich={k.bereich} groesse={KUGEL_GROESSE.liste} />} titel={m.name} unter={m.rolle} umbrechen
                rechts={<span style={{ display: 'flex', gap: ABSTAND.xs, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {m.headId !== k.id && <Chip farbe={C.inkDim}>hilft hier aus</Chip>}
                  {m.auchFuer.length > 0 && m.headId === k.id && <Chip farbe={C.inkDim}>hilft auch {m.auchFuer.length} weiteren</Chip>}
                  {!m.aktiv && <Chip farbe={C.inkLeise}>aus</Chip>}
                  <Chip farbe={C.inkDim}>{MODEL_LABEL[m.stufe]}</Chip>
                </span>} />
              <div style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap', paddingLeft: KUGEL_GROESSE.liste + ABSTAND.m }}>
                <Knopf leise onClick={() => starteEntwurf({ headId: k.id, mitarbeiterId: m.id })}>Thread starten</Knopf>
                <Knopf leise onClick={() => dialog({ art: 'mitarbeiter', headId: k.id, vorlage: { ...m, name: `${m.name} (Kopie)` } })}>Duplizieren</Knopf>
                {m.gedaechtnis.length > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, alignSelf: 'center' }}>{m.gedaechtnis.length} Merksätze</span>}
              </div>
            </div>
          ))}
        </Liste>
      ) : <Leer>Dieser Head hat noch keine Mitarbeiter.</Leer>}
      <div><Knopf onClick={() => dialog({ art: 'mitarbeiter', headId: k.id })}><Plus size={16} aria-hidden /> Mitarbeiter</Knopf></div>
    </div>
  );
}

function SkillsReiter({ k, skills }: { k: HeadKarte; skills: Abruf<SkillsAntwort> }) {
  const { dialog } = useAgenten();
  const liste: SkillKurz[] = skills.zustand === 'da' ? skills.daten.skills.filter(s => s.headId === k.id) : k.skills;
  return (
    <div style={{ display: 'grid', gap: ABSTAND.m }}>
      {skills.zustand === 'kommt' && <Hinweis art="info">Eigene Skills anlegen, testen und einschalten kommt mit dem nächsten Paket. Die eingebauten Skills sind schon da.</Hinweis>}
      {liste.length ? (
        <Liste>
          {liste.map(s => (
            <Zeile key={s.id} onClick={() => dialog({ art: 'skill', headId: k.id, skillId: s.id })} umbrechen
              titel={<span style={{ fontFamily: SCHRIFT.mono }}>/{s.name}</span>}
              unter={`${s.beschreibung} · ${ausloeserText(s.ausloeser)}`}
              rechts={<span style={{ display: 'flex', gap: ABSTAND.xs, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {s.eingebaut && <Chip farbe={C.inkDim}>eingebaut</Chip>}
                <Chip farbe={s.aktiv ? LEUCHT.gut : C.inkLeise}>{s.aktiv ? 'an' : 'aus'}</Chip>
                {s.erfolg && <Chip farbe={C.aktiv}>{quote(s.erfolg.angenommen, s.erfolg.angenommen + s.erfolg.abgelehnt)} angenommen</Chip>}
              </span>} />
          ))}
        </Liste>
      ) : <Leer>Noch keine Skills.</Leer>}
      <div style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>
        <Knopf onClick={() => dialog({ art: 'skill', headId: k.id })}><Plus size={16} aria-hidden /> Skill</Knopf>
      </div>
    </div>
  );
}

function Gedaechtnis({ k, def, skills }: { k: HeadKarte; def: HeadDef | null; skills: Abruf<SkillsAntwort> }) {
  const { melde, bestaetigen } = useAgenten();
  const [text, setText] = useState('');
  const saetze = skills.zustand === 'da' ? skills.daten.gedaechtnis ?? [] : [];
  const ebene = k.ebene === 'haushalt' ? 'Haushalt' : 'Persönlich';
  const merken = async () => {
    const t = text.trim();
    if (!t) return;
    if (t.length > GRENZEN.merksatzZeichen) { melde(`Ein Merksatz hat höchstens ${GRENZEN.merksatzZeichen} Zeichen.`, 'kritisch'); return; }
    const r = await skillSenden({ aktion: 'merksatz', agent: { art: 'head', headId: k.id }, text: t });
    if (r.ok) { setText(''); melde('Gemerkt.', 'gut'); } else melde(r.kommt ? 'Merksätze speichern kommt mit dem nächsten Paket.' : r.text, r.kommt ? 'info' : 'kritisch');
  };
  const weg = async (id: string, satz: string) => {
    if (!(await bestaetigen({ titel: 'Merksatz löschen?', text: `„${satz}“`, ja: 'Löschen', gefahr: true }))) return;
    const r = await skillSenden({ aktion: 'merksatz-weg', agent: { art: 'head', headId: k.id }, id });
    if (r.ok) melde('Merksatz gelöscht.', 'gut'); else melde(r.text, 'kritisch');
  };
  return (
    <div style={{ display: 'grid', gap: ABSTAND.xl }}>
      <div style={{ display: 'grid', gap: ABSTAND.s }}>
        <span style={{ ...MIKRO }}>System · fest</span>
        <Karte flach>
          <div style={{ display: 'grid', gap: ABSTAND.xs }}>
            <Eigenschaft label="Auftrag">{k.auftrag}</Eigenschaft>
            {def && <Eigenschaft label="Ton">{TON_SATZ[def.ton]}</Eigenschaft>}
            {k.hinweis && <Eigenschaft label="Hinweis">{k.hinweis}</Eigenschaft>}
            <Eigenschaft label="Grenzen">Nach außen nichts ohne deinen Klick · höchstens {GRENZEN.headRunden} Runden je Antwort · Mitarbeiter delegieren nie weiter</Eigenschaft>
          </div>
        </Karte>
      </div>
      <div style={{ display: 'grid', gap: ABSTAND.s }}>
        <span style={{ ...MIKRO }}>{ebene} · Merksätze</span>
        {skills.zustand === 'kommt' && <Leer>Merksätze erscheinen hier, sobald die Werkstatt läuft.</Leer>}
        {skills.zustand === 'da' && !saetze.length && <Leer>Noch keine Merksätze. Was soll {k.kurz} sich merken?</Leer>}
        {saetze.length > 0 && (
          <Liste>
            {saetze.map(m => <Zeile key={m.id} titel={m.text} umbrechen unter={m.quelle === 'vorschlag' ? 'Vorschlag des Agenten, per Klick übernommen' : 'von Hand'}
              rechts={<SymbolKnopf ariaLabel={`Merksatz „${m.text}“ löschen`} gefahr onClick={() => weg(m.id, m.text)}><X size={16} /></SymbolKnopf>} />)}
          </Liste>
        )}
        <form onSubmit={e => { e.preventDefault(); void merken(); }} style={{ display: 'flex', gap: ABSTAND.s }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Neuer Merksatz, z. B. „Anrufe nie vor 9 Uhr“" aria-label="Neuer Merksatz" style={eingabe} />
          <Knopf typ="submit" aus={!text.trim()}>Merken</Knopf>
        </form>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{k.ebene === 'haushalt' ? 'Gilt für alle im Haushalt — erst dein Klick legt ihn ab.' : 'Gilt nur für dich.'} Mitarbeiter erben die Merksätze ihres Heads.</span>
      </div>
    </div>
  );
}

function LeistungReiter({ k, skills }: { k: HeadKarte; skills: Abruf<SkillsAntwort> }) {
  const { laeufe } = useAgenten();
  const l = leistungVon(k.id, skills.zustand === 'da' ? skills.daten.skills : k.skills, laeufe.zustand === 'da' ? laeufe.daten.laeufe : []);
  // Daumen (Paket 4b): die Leistung des Heads vom Server (GET /api/agenten/skills?head=…), nur Zahlen.
  const daumen = skills.zustand === 'da' ? (skills.daten as { leistung?: { daumen?: { hoch: number; runter: number } } }).leistung?.daumen : undefined;
  return (
    <div style={{ display: 'grid', gap: ABSTAND.l }}>
      <Raster min={160}>
        <Kennzahl klein wert={l.annahme.text === '—' ? undefined : l.annahme.text} label="Annahmequote" unter={`${l.annahme.angenommen} angenommen · ${l.annahme.abgelehnt} abgelehnt`} />
        <Kennzahl klein wert={l.laeufe ? String(l.laeufe) : undefined} label="Läufe" />
        <Kennzahl klein wert={l.kostenJeErgebnis === '—' ? undefined : l.kostenJeErgebnis} label="Kosten je Ergebnis" />
      </Raster>
      <div style={{ display: 'grid', gap: ABSTAND.s }}>
        <span style={{ ...MIKRO }}>Erfolgsquote je Skill</span>
        {l.jeSkill.length ? (
          <Liste>{l.jeSkill.map(s => <Zeile key={s.id} titel={<span style={{ fontFamily: SCHRIFT.mono }}>/{s.name}</span>} unter={`${s.laeufe} Läufe`} rechts={<Chip farbe={C.aktiv}>{s.text}</Chip>} />)}</Liste>
        ) : <Leer>Noch keine gemessenen Skill-Läufe.</Leer>}
      </div>
      {daumen && <Raster min={160}><Kennzahl klein wert={`${daumen.hoch} · ${daumen.runter}`} label="Daumen hoch · runter (dieser Monat)" /></Raster>}
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Gemessen werden Agenten, nie Menschen. Daumen je Antwort zählen hier mit.</span>
    </div>
  );
}

const STUFEN: { id: ModelTier; label: string }[] = [{ id: 'schnell', label: 'Schnell' }, { id: 'ausgewogen', label: 'Ausgewogen' }, { id: 'stark', label: 'Stark' }];
const AUFWAENDE: { id: Aufwand; label: string }[] = [{ id: 'low', label: 'Gering' }, { id: 'medium', label: 'Mittel' }, { id: 'high', label: 'Hoch' }];
const AUTONOMIE: { id: AutonomieStufe; label: string }[] = [{ id: 'vorschlag', label: 'Nur Vorschlag' }, { id: 'intern', label: 'Risikoarm selbst' }];
/** Euro-Eingabe („20“, „20,50“) → Cent; leer = null (nur messen). */
const euroAus = (t: string): number | null | 'falsch' => {
  const x = t.trim().replace(/\s|€/g, '').replace(/\./g, '').replace(',', '.');
  if (!x) return null;
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? Math.round(n * 100) : 'falsch';
};
const euroText = (cent: number) => (cent / 100).toFixed(2).replace('.', ',');

/** Foto-Avatar wählen (Paket 4b): Bilder aus „Fotos & Videos“, die die Person sieht — kein Upload-Zwang, „Kürzel“ geht immer. */
function FotoWahl({ aktuell, onWahl }: { aktuell: string | null; onWahl: (id: string | null) => void }) {
  const [offen, setOffen] = useState(false);
  const fotos = useAbruf(offen ? 'agenten-fotos' : null, ladeFotos);
  return (
    <div style={{ display: 'grid', gap: ABSTAND.s }}>
      <div style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>
        <Knopf leise onClick={() => setOffen(o => !o)}>{offen ? 'Auswahl schließen' : 'Bild wählen'}</Knopf>
        {aktuell && <Knopf leise onClick={() => onWahl(null)}>Kürzel statt Foto</Knopf>}
      </div>
      {offen && (fotos.stand.zustand === 'da'
        ? fotos.stand.daten.fotos.length
          ? <div style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>{fotos.stand.daten.fotos.map(f => (
            <button key={f.id} type="button" onClick={() => { onWahl(f.id); setOffen(false); }} aria-label={`Foto „${f.name}“ wählen`} className="fassbar"
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', minHeight: ZIEL.handy }}>
              <KuerzelKugel name={f.name} farbe={C.aktiv} groesse={KUGEL_GROESSE.kopf} foto={f.vorschau} />
            </button>
          ))}</div>
          : <Leer>Noch keine Bilder in „Fotos & Videos“.</Leer>
        : fotos.stand.zustand === 'laedt' ? <Leer>Bilder werden geladen …</Leer> : <Leer>{'text' in fotos.stand ? fotos.stand.text : ''}</Leer>)}
    </div>
  );
}

/**
 * Reiter „Einstellungen“ (Paket 4b): Modell und Aufwand, Autonomie (nur verschärfen), Budget je Monat, zuständige Person, an/aus, Foto,
 * Not-Aus dieses Heads. Ändern nur, wer darf (`einstellung.aendern` — Haushalts-Heads volle Mitglieder, Privat-Heads nur die Person);
 * entschieden hat der Server, die Seite zeigt sonst nur an. Jede Änderung mit dem Stand (409 → neu laden).
 */
function Einstellungen({ k, def }: { k: HeadKarte; def: HeadDef | null }) {
  const { laeufe, dialog, jetzt, melde, bestaetigen, agenten } = useAgenten();
  const e = k.einstellung;
  const kosten = e?.kostenCentMonat ?? kostenImMonat((laeufe.zustand === 'da' ? laeufe.daten.laeufe : []).filter(l => l.headId === k.id), jetzt);
  const [budget, setBudget] = useState(e?.budgetCentMonat != null ? euroText(e.budgetCentMonat) : '');
  const personen = agenten.zustand === 'da' ? agenten.daten.personen ?? [] : [];
  const darf = !!e?.aendern;
  const schreibe = async (teil: Partial<Record<EinstellungFeld, unknown>>, gut: string) => {
    if (!e) return;
    const r = await einstellungSenden({ aktion: 'einstellung', headId: k.id, teil, stand: e.stand });
    if (r.ok) melde(gut, 'gut'); else melde(r.status === 409 ? 'Die Einstellungen haben sich inzwischen geändert — neu geladen, bitte noch einmal.' : r.text, 'kritisch');
  };
  const budgetSpeichern = async () => {
    const cent = euroAus(budget);
    if (cent === 'falsch') { melde('Budget in Euro, z. B. 20 oder 20,50 (höchstens 100.000 €).', 'kritisch'); return; }
    await schreibe({ budgetCentMonat: cent }, cent == null ? 'Kein Budget — nur gemessen.' : `Budget gesetzt: ${euro(cent)} im Monat.`);
  };
  const notAus = async () => {
    const an = !e?.notAus;
    if (!(await bestaetigen({ titel: an ? `${k.kurz} anhalten?` : `Not-Aus für ${k.kurz} lösen?`, text: an ? 'Laufende Läufe dieses Heads werden abgebrochen, Zeitpläne und neue Aufträge ruhen.' : 'Zeitpläne laufen danach wieder. Angehaltene Läufe startest du von Hand neu.', ja: an ? 'Anhalten' : 'Lösen', gefahr: an }))) return;
    const r = await einstellungSenden({ aktion: 'not-aus', an, headId: k.id });
    if (r.ok) melde(an ? `${k.kurz} ist angehalten.` : `${k.kurz} läuft wieder.`, an ? 'info' : 'gut'); else melde(r.text, 'kritisch');
  };
  const stufe = e?.stufe ?? def?.stufe ?? 'ausgewogen';
  const aufwand = e?.aufwand ?? def?.aufwand ?? 'medium';
  const autonomie = e?.autonomie ?? e?.vorgabe.autonomie ?? 'vorschlag';
  return (
    <div style={{ display: 'grid', gap: ABSTAND.l }}>
      {e?.notAus && <Hinweis art="achtung" titel="Not-Aus">Dieser Head ist angehalten — seit {new Date(e.notAus.seit).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.</Hinweis>}
      <Karte flach>
        <div style={{ display: 'grid', gap: ABSTAND.m }}>
          <Feldzeile label={`Modell${e ? ` — ${e.modelle[stufe]}` : ''}${e && stufe === e.vorgabe.stufe ? ' (Vorgabe)' : ''}`}>
            {darf ? <Segmente liste={STUFEN} aktiv={stufe} onWahl={x => schreibe({ stufe: x === e!.vorgabe.stufe ? null : x }, 'Modell gespeichert.')} />
              : <span style={{ fontSize: TYP.body, color: C.ink }}>{MODEL_LABEL[stufe]} <span style={{ color: C.inkLeise }}>(Vorgabe)</span></span>}
          </Feldzeile>
          <Feldzeile label="Aufwand (Denktiefe)">
            {darf ? <Segmente liste={AUFWAENDE} aktiv={aufwand} onWahl={x => schreibe({ aufwand: x === e!.vorgabe.aufwand ? null : x }, 'Aufwand gespeichert.')} />
              : <span style={{ fontSize: TYP.body, color: C.ink }}>{AUFWAND_NAME[aufwand]}</span>}
          </Feldzeile>
          <Feldzeile label="Autonomie — nach außen nie ohne Klick; die Stufe lässt sich je Head nur verschärfen">
            {darf ? <Segmente liste={AUTONOMIE.filter(a => a.id === 'vorschlag' || e!.vorgabe.autonomie === 'intern')} aktiv={autonomie} onWahl={x => schreibe({ autonomie: x === e!.vorgabe.autonomie ? null : x }, 'Autonomie gespeichert.')} />
              : <span style={{ fontSize: TYP.body, color: C.ink }}>{autonomie === 'intern' ? 'Risikoarm selbst' : 'Nur Vorschlag'}</span>}
          </Feldzeile>
          <Feldzeile label={`Budget je Monat in Euro — ${euro(kosten)} in diesem Monat${e?.budgetCentMonat != null ? ` von ${euro(e.budgetCentMonat)}` : ' · ohne Grenze nur messen'}`}>
            {darf ? (
              <form onSubmit={x => { x.preventDefault(); void budgetSpeichern(); }} style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>
                <input value={budget} onChange={x => setBudget(x.target.value)} inputMode="decimal" placeholder="leer = nur messen" aria-label="Budget je Monat in Euro" style={{ ...eingabe, flex: 1, minWidth: 140 }} />
                <Knopf typ="submit">Speichern</Knopf>
              </form>
            ) : <span style={{ fontSize: TYP.body, color: C.ink }}>{e?.budgetCentMonat != null ? euro(e.budgetCentMonat) : 'keine Grenze — nur messen'}</span>}
          </Feldzeile>
          <Feldzeile label="Zuständig (Person aus den Konten)">
            {darf && personen.length ? (
              <select value={e?.zustaendig ?? ''} onChange={x => schreibe({ zustaendig: x.target.value || null }, 'Zuständigkeit gespeichert.')} style={{ ...auswahl, width: '100%', minHeight: ZIEL.handy }} aria-label="Zuständige Person">
                <option value="">Niemand Bestimmtes</option>
                {personen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : <span style={{ fontSize: TYP.body, color: C.ink }}>{personen.find(p => p.id === e?.zustaendig)?.name ?? '—'}</span>}
          </Feldzeile>
          {darf && <Schalter an={k.aktiv} onChange={an => schreibe({ aktiv: an }, an ? `${k.kurz} ist an.` : `${k.kurz} ist aus.`)}>{k.aktiv ? 'Head ist an' : 'Head ist aus'}</Schalter>}
          {darf && <Feldzeile label="Foto (optional — sonst das Kürzel)"><FotoWahl aktuell={e?.foto ?? null} onWahl={id => schreibe({ foto: id }, id ? 'Foto gespeichert.' : 'Wieder mit Kürzel.')} /></Feldzeile>}
          <Eigenschaft label="Anbieter">Anthropic (über das KI-Tor)</Eigenschaft>
          <Eigenschaft label="Ebene">{k.ebene === 'haushalt' ? 'Haushalt — gilt für alle im Haushalt' : 'Persönlich — gilt nur für dich'}</Eigenschaft>
        </div>
      </Karte>
      {!e && <Hinweis art="info" aktion={<Knopf leise onClick={() => dialog({ art: 'uebersicht' })}>Bisherige Agenten-Schalter ›</Knopf>}>Die Einstellungen kommen mit dem Agenten-Kern. Bis dahin gelten die Vorgaben.</Hinweis>}
      {e && !darf && <Hinweis art="info">Die Einstellungen dieses Heads ändern volle Mitglieder des Haushalts. Anhalten kannst du ihn trotzdem.</Hinweis>}
      {e && <div><Knopf leise farbe={LEUCHT.kritisch} onClick={notAus}>{e.notAus ? `Not-Aus für ${k.kurz} lösen` : `${k.kurz} anhalten (Not-Aus)`}</Knopf></div>}
    </div>
  );
}

// ── Die Mitte mit Head ─────────────────────────────────────────────────────────────────────────────────────────────────

export type HeadReiterId = ReiterId;

export function HeadMitte({ headId, fadenId, startReiter = 'chat' }: { headId: string; fadenId?: string; startReiter?: ReiterId }) {
  const w = useAgenten();
  const k = headKarte(w, headId);
  const def = headDef(headId);
  const [reiter, setReiter] = useState<ReiterId>(startReiter);
  const vorgegeben = w.vorlage?.skills?.[headId];
  const geladen = useAbruf<SkillsAntwort>(k && !vorgegeben ? `skills:${headId}` : null, () => ladeSkills(headId));
  const skills: { stand: Abruf<SkillsAntwort> } = vorgegeben ? { stand: { zustand: 'da', daten: vorgegeben } } : geladen;
  const farbe = headFarbe(k?.farbe ?? def?.farbe);

  if (!k) {
    return (
      <div style={{ display: 'grid', gap: ABSTAND.l }}>
        <HeadKopf k={null} def={def} />
        {w.agenten.zustand === 'da'
          ? <Hinweis art="info">Diesen Head gibt es für dich nicht — welche Heads du siehst, entscheidet der Server.</Hinweis>
          : <Leerzustand symbol="✦" titel={def ? `${def.kurz} kommt` : 'Head'}>{w.agenten.zustand === 'laedt' ? 'Wird geladen …' : 'Der Chat mit den Heads kommt mit dem Agenten-Kern. ZOE ist schon da.'}</Leerzustand>}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: ABSTAND.l, alignContent: 'start' }}>
      <HeadKopf k={k} def={def} />
      <div className="ui-reiter-zeile">
        <Reiter ariaLabel={`${k.kurz}: Bereiche`} farbe={farbe} liste={REITER.map(r => ({ id: r.id, label: r.id === 'chat' && k.zaehler.freigaben ? `Chat · ⚑ ${k.zaehler.freigaben}` : r.label }))} aktiv={reiter} onWahl={setReiter} />
      </div>
      {reiter === 'chat' && <HeadChat k={k} fadenId={fadenId} />}
      {reiter === 'aktivitaet' && <Aktivitaet k={k} />}
      {reiter === 'mitarbeiter' && <MitarbeiterReiter k={k} skills={skills.stand} />}
      {reiter === 'skills' && <SkillsReiter k={k} skills={skills.stand} />}
      {reiter === 'gedaechtnis' && <Gedaechtnis k={k} def={def} skills={skills.stand} />}
      {reiter === 'leistung' && <LeistungReiter k={k} skills={skills.stand} />}
      {reiter === 'einstellungen' && <Einstellungen k={k} def={def} />}
    </div>
  );
}
