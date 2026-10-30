'use client';

// ─── Markttraktion · Social › Automatik (27.10.2026) ────────────────────────────────────────────────────────────────────────────────
// Kevin 27.10.: „Bau tiefer und besser — es soll voll automatisiert laufen.“ Eine Ansicht je Kanal für den ganzen Weg:
//   Redaktionsplan (Agent schreibt selbst, Tage, Uhrzeit, Vorlauf) → Verbindungen je Plattform → Warteschlange (je Beitrag und Plattform der
//   Zustand mit Grund — dieselbe Regel wie der Veröffentlicher, `postPlan`) → letzte Läufe. Alles kommt vom Server (`lage.automatik`);
//   hier wird nichts entschieden. Tokens sieht der Browser nie.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Hinweis, Schalter, Feldzeile, eingabe, feld } from '../../ui';
import { PLAN_VORGABE, PLATTFORM_NAME, type SocialKanal, type SocialPlattform } from '@/lib/social/typen';
import { POST_ZUSTAND_NAME, type PostZustand } from '@/lib/social/veroeffentlichen';
import { proWocheVon } from '@/lib/social/plan';
import { besteZeiten } from '@/lib/social/zeiten';
import type { SocialApi, MitStand } from './daten';

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const ZUSTAND_FARBE: Record<PostZustand, string> = {
  online: LEUCHT.gut, faellig: LEUCHT.gut, geplant: C.aktiv, 'ohne-termin': C.inkDim, verpasst: LEUCHT.achtung, leitplanke: C.inkDim,
  'ohne-verbindung': C.inkDim, 'kann-nicht': C.inkDim, laeuft: C.aktiv, fehler: LEUCHT.kritisch, unklar: LEUCHT.kritisch,
};
const termin = (platz: string) => `${platz.slice(8, 10)}.${platz.slice(5, 7)}. ${platz.slice(11, 16)}`;
const zeit = (iso?: string) => (iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export function Automatik({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  return (
    <>
      <Ablauf api={api} kanal={kanal} />
      <Plan api={api} kanal={kanal} />
      <AutoReel api={api} kanal={kanal} />
      <Verbindungen api={api} kanal={kanal} />
      <Warteschlange api={api} kanal={kanal} />
      <Laeufe api={api} />
    </>
  );
}

/** Der Weg in vier Schritten — was steht, was fehlt. */
function Ablauf({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const a = api.lage!.automatik;
  const plan = kanal.plan ?? PLAN_VORGABE;
  const verbunden = a.verbindungen.filter(v => v.kanalId === kanal.id && v.zustand === 'aktiv').length;
  const schritte = [
    { name: 'Agent schreibt', an: plan.agent, satz: plan.agent ? `${proWocheVon(kanal)} Beiträge je Woche, ${plan.vorlauf} Tage im Voraus` : 'aus — nur auf Knopfdruck' },
    { name: 'Prüfer + Leitplanken', an: kanal.leitplanken.autonomie === 2, satz: kanal.leitplanken.autonomie === 2 ? 'Stufe 2: postet selbst, was sauber ist' : `Stufe ${kanal.leitplanken.autonomie}: jeder Beitrag braucht euren Klick` },
    { name: 'Plattform', an: verbunden > 0, satz: verbunden ? `${verbunden} von ${kanal.plattformen.length} verbunden` : 'noch nicht verbunden' },
    { name: 'Zahlen', an: false, satz: 'per CSV-Import (LinkedIn gibt Zahlen erst mit Antrag heraus)' },
  ];
  return (
    <Karte>
      <Ueberschrift>So läuft es</Ueberschrift>
      <ol style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', listStyle: 'none', margin: 0, padding: 0 }}>
        {schritte.map((s, i) => (
          <li key={s.name} style={{ display: 'grid', gap: 4, borderLeft: `3px solid ${s.an ? LEUCHT.gut : C.linie}`, paddingLeft: 10 }}>
            <strong style={{ color: C.ink }}>{i + 1}. {s.name}</strong>
            <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{s.satz}</span>
          </li>
        ))}
      </ol>
      {kanal.leitplanken.postenAus && <div style={{ marginTop: 12 }}><Hinweis art="achtung">Not-Aus: Posten ist angehalten — es geht nichts raus.</Hinweis></div>}
    </Karte>
  );
}

function Plan({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const p = kanal.plan ?? PLAN_VORGABE;
  const [tage, setTage] = useState<number[]>(p.tage);
  const [uhrzeit, setUhrzeit] = useState(p.uhrzeit);
  const [proWoche, setProWoche] = useState(p.proWoche ? String(p.proWoche) : '');
  const [vorlauf, setVorlauf] = useState(String(p.vorlauf));
  const [schreibt, setSchreibt] = useState(false);
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const luecken = api.lage!.automatik.luecken[kanal.id] ?? [];
  const formatName = (id?: string) => (id ? api.lage!.datei.formate.find(f => f.id === id)?.name : undefined);
  const speichern = (agent = p.agent) => api.schreiben([{ op: 'plan', kanalId: kanal.id, stand: kanal.stand, plan: { ...p, agent, tage, uhrzeit, proWoche: proWoche ? Number(proWoche) : undefined, vorlauf: Number(vorlauf) } }]);
  return (
    <Karte>
      <Ueberschrift>Redaktionsplan</Ueberschrift>
      <Schalter an={p.agent} onChange={v => speichern(v)} erklaerungOhne="Der Agent füllt im Takt (alle 6 Stunden, 6–22 Uhr) die freien Termine mit Entwürfen. Was die Leitplanken erlauben, plant er ein — sonst wartet es auf euch.">Agent schreibt selbst</Schalter>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <Feldzeile label="Tage">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TAGE.map((t, i) => {
              const an = tage.includes(i + 1);
              return <button key={t} type="button" aria-pressed={an} onClick={() => setTage(an ? tage.filter(x => x !== i + 1) : [...tage, i + 1].sort())}
                className="ui-wahl" style={{ minWidth: 44, minHeight: 44, borderRadius: 999, border: `1px solid ${an ? C.aktiv : C.linie}`, background: an ? `${C.aktiv}22` : 'transparent', color: an ? C.aktiv : C.inkDim, cursor: 'pointer' }}>{t}</button>;
            })}
          </div>
        </Feldzeile>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))' }}>
          <Feldzeile label="Uhrzeit"><input type="time" style={eingabe} value={uhrzeit} onChange={e => setUhrzeit(e.target.value)} /></Feldzeile>
          <Feldzeile label="Beiträge je Woche"><input inputMode="numeric" style={eingabe} value={proWoche} placeholder={`${proWocheVon({ ...kanal, plan: { ...p, proWoche: undefined } })} (aus dem Ziel)`} onChange={e => setProWoche(e.target.value.replace(/\D/g, ''))} /></Feldzeile>
          <Feldzeile label="Tage im Voraus">
            <select style={feld} value={vorlauf} onChange={e => setVorlauf(e.target.value)}>{[3, 5, 7, 10, 14, 21].map(n => <option key={n} value={n}>{n}</option>)}</select>
          </Feldzeile>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf typ="submit">Plan speichern</Knopf>
          <Knopf leise onClick={async () => {
            setSchreibt(true); setErgebnis(null);
            const r = await api.aktion({ aktion: 'entwuerfe', kanalId: kanal.id }) as { lauf?: { geschrieben: { geplant: boolean }[]; gestoppt?: string; uebersprungen: { grund: string }[] } } | null;
            setSchreibt(false);
            const l = r?.lauf;
            if (l) setErgebnis(l.gestoppt ? `Nichts geschrieben: ${l.gestoppt}` : l.geschrieben.length
              ? `${l.geschrieben.length} Entwurf${l.geschrieben.length === 1 ? '' : 'e'} geschrieben, ${l.geschrieben.filter(g => g.geplant).length} davon eingeplant.`
              : l.uebersprungen[0]?.grund ?? 'Nichts zu tun.');
          }}>{schreibt ? 'Schreibt …' : 'Jetzt Entwürfe schreiben'}</Knopf>
        </div>
        {ergebnis && <Hinweis art={ergebnis.startsWith('Nichts geschrieben') ? 'achtung' : 'info'} rolle="status">{ergebnis}</Hinweis>}
      </form>
      {(() => {
        const z = besteZeiten(kanal, api.lage!.datei.folgen);
        const um = z.empfehlung?.stunde !== undefined ? `${String(z.empfehlung.stunde).padStart(2, '0')}:00` : null;
        return (
          <Hinweis art={z.genug ? 'gut' : 'info'} titel="Wann wirkt es bei euch?" aktion={z.genug && um && um !== p.uhrzeit ? <Knopf leise onClick={() => api.schreiben([{ op: 'plan', kanalId: kanal.id, stand: kanal.stand, plan: { ...p, uhrzeit: um } }])}>{`${um} übernehmen`}</Knopf> : undefined}>
            {z.satz}
          </Hinweis>
        );
      })()}
      <div style={{ marginTop: 12, display: 'grid', gap: 4, color: C.inkDim, fontSize: TYP.bedien }}>
        <strong style={{ color: C.ink }}>Nächste freie Termine</strong>
        {luecken.length ? luecken.map(l => { const f = formatName(l.formatId) ?? 'ohne Format'; return <span key={l.platz}>{termin(l.platz)} · {f}{l.saeule && l.saeule !== f ? ` · ${l.saeule}` : ''}</span>; })
          : <span>Alle Termine der nächsten {p.vorlauf} Tage sind belegt.</span>}
      </div>
    </Karte>
  );
}

/** Auto-Reel (28.10.): neue Clips im gewählten Album werden ohne Klick zu Reels und Beiträgen — raus erst nach eurer Freigabe. */
function AutoReel({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const p = kanal.plan ?? PLAN_VORGABE;
  const [alben, setAlben] = useState<{ id: string; titel: string; anzahl: number }[] | null>(null);
  const [album, setAlbum] = useState(p.rohAlbum ?? '');
  useEffect(() => {
    void fetch('/api/medien', { cache: 'no-store' }).then(r => r.json()).then(j => setAlben(((j.alben ?? []) as { id: string; titel: string; anzahl: number; bereich: string; geloeschtAm?: string }[])
      .filter(a => a.bereich === 'business' && !a.geloeschtAm).map(a => ({ id: a.id, titel: a.titel, anzahl: a.anzahl })))).catch(() => setAlben([]));
  }, []);
  const speichern = (autoReel: boolean, rohAlbum = album) => api.schreiben([{ op: 'plan', kanalId: kanal.id, stand: kanal.stand, plan: { ...p, autoReel, rohAlbum: rohAlbum || undefined } }]);
  const verbunden = api.lage!.automatik.verbindungen.some(v => v.kanalId === kanal.id && v.zustand === 'aktiv');
  return (
    <Karte>
      <Ueberschrift>Auto-Reels aus euren Clips</Ueberschrift>
      <div style={{ display: 'grid', gap: 12 }}>
        <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>Clips in ein Album laden (am Handy: Medien › Aufnehmen, Ton „an“) — MAKE OS erkennt die Untertitel, die KI schneidet und schreibt Hook und Beschriftung, das Reel wird gerendert und als Entwurf in den nächsten freien Termin gelegt. Ihr seht es an, gebt frei — dann geht es zum Termin raus.</span>
        <Feldzeile label="Album mit Rohclips">
          <select style={feld} value={album} onChange={e => { setAlbum(e.target.value); if (p.autoReel) void speichern(true, e.target.value); }}>
            <option value="">— Album wählen —</option>
            {(alben ?? []).map(a => <option key={a.id} value={a.id}>{a.titel} ({a.anzahl})</option>)}
          </select>
        </Feldzeile>
        <Schalter an={!!p.autoReel} onChange={v => { if (v && !album) return; void speichern(v); }} erklaerungOhne="Nur Videos der letzten 14 Tage, höchstens zwei je halbe Stunde. Nichts geht ohne eure Freigabe raus.">Auto-Reels an</Schalter>
        {!album && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Erst ein Album wählen (oder unter Medien eins anlegen, z. B. „Rohclips“).</span>}
        {p.autoReel && !verbunden && <Hinweis art="info">Fertige Reels liegen als Entwürfe im Kalender — gepostet wird erst mit einer Verbindung (Verbindungen unten).</Hinweis>}
      </div>
    </Karte>
  );
}

function Verbindungen({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const a = api.lage!.automatik;
  const fremdeMarke = kanal.art === 'person' && kanal.person && kanal.person !== api.lage!.ich;
  const verbinde = async (p: SocialPlattform) => {
    if ((p === 'linkedin' && a.wege.linkedin) || (p === 'instagram' && a.wege.instagram)) {
      const r = await api.aktion({ aktion: p === 'linkedin' ? 'linkedin-start' : 'instagram-start', kanalId: kanal.id });
      if (r && typeof r.url === 'string') window.location.assign(r.url);
      return;
    }
    await api.aktion({ aktion: 'probe-verbinden', kanalId: kanal.id, plattform: p });
  };
  return (
    <Karte>
      <Ueberschrift>Verbindungen</Ueberschrift>
      <div style={{ display: 'grid', gap: 10 }}>
        {kanal.plattformen.map(p => {
          const v = a.verbindungen.find(x => x.kanalId === kanal.id && x.plattform === p && x.zustand === 'aktiv');
          const tage = v?.tokenAblauf ? Math.ceil((v.tokenAblauf - Date.now()) / 86_400_000) : null;
          const echt = (p === 'linkedin' && a.wege.linkedin) || (p === 'instagram' && a.wege.instagram);
          return (
            <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', minHeight: 44 }}>
              <strong style={{ minWidth: 90 }}>{PLATTFORM_NAME[p]}</strong>
              {v ? <>
                <Chip farbe={LEUCHT.gut}>{v.anbieter === 'probe' ? 'Probe — nichts geht raus' : `verbunden${v.konto ? ` als ${v.konto}` : ''}`}</Chip>
                {tage !== null && <span style={{ color: tage <= 7 ? LEUCHT.achtung : C.inkLeise, fontSize: TYP.bedien }}>Anmeldung gilt noch {Math.max(0, tage)} Tage</span>}
                <Knopf leise onClick={() => api.aktion({ aktion: 'trennen', verbindungId: v.id })}>Trennen</Knopf>
              </> : fremdeMarke ? <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>Verbindet nur die Person der Marke selbst.</span>
                : echt || a.wege.probe ? <Knopf onClick={() => verbinde(p)}>{echt ? `Mit ${PLATTFORM_NAME[p]} verbinden` : 'Probe verbinden (Demo)'}</Knopf>
                : <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{WEG_FEHLT[p]}</span>}
            </div>
          );
        })}
      </div>
    </Karte>
  );
}

/** Ehrlich, was je Plattform fehlt (research/social/FAKTEN_VEROEFFENTLICHEN.md). */
const WEG_FEHLT: Record<SocialPlattform, string> = {
  linkedin: 'LinkedIn ist in dieser Instanz noch nicht eingerichtet (eine LinkedIn-App mit „Share on LinkedIn“ — Schritte in UPDATES.md).',
  instagram: 'Instagram ist in dieser Instanz noch nicht eingerichtet (eine Meta-App mit „Instagram API with Instagram Login“, Professional-Konto — Schritte in UPDATES.md).',
  youtube: 'Anbindung folgt — YouTube-Upload braucht eine Google-App „in Produktion“ und eine Videodatei.',
  tiktok: 'TikTok erlaubt kein Posten ohne Klick je Beitrag — hier bleibt es beim Entwurf, ihr postet in der App.',
};

function Warteschlange({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const a = api.lage!.automatik;
  const folgen = api.lage!.datei.folgen
    .filter(f => f.kanalId === kanal.id && a.folgen[f.id] && a.folgen[f.id].some(s => s.zustand !== 'online'))
    .sort((x, y) => (x.geplantAm ?? '9999').localeCompare(y.geplantAm ?? '9999') || (x.geplantUm ?? '').localeCompare(y.geplantUm ?? ''));
  return (
    <Karte>
      <Ueberschrift>Warteschlange</Ueberschrift>
      {!folgen.length ? <span style={{ color: C.inkDim }}>Nichts offen.</span> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {folgen.slice(0, 30).map(f => (
            <div key={f.id} style={{ display: 'grid', gap: 6, borderTop: `1px solid ${C.linie}`, paddingTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <strong>{f.titel}</strong>
                <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{f.geplantAm ? termin(`${f.geplantAm}T${f.geplantUm ?? (kanal.plan ?? PLAN_VORGABE).uhrzeit}`) : 'ohne Termin'}{f.quelle === 'agent' ? ' · vom Agenten' : ''}</span>
              </div>
              {a.folgen[f.id].map(s => (
                <div key={s.plattform} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip farbe={ZUSTAND_FARBE[s.zustand]}>{PLATTFORM_NAME[s.plattform]} · {POST_ZUSTAND_NAME[s.zustand]}</Chip>
                  <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{s.grund}</span>
                  {(s.zustand === 'fehler' || s.zustand === 'unklar') && <Knopf leise onClick={() => api.schreiben([{ op: 'versuch-loesen', folgeId: f.id, plattform: s.plattform, stand: f.stand }])}>{s.zustand === 'unklar' ? 'Nachgesehen — nicht online, erneut erlauben' : 'Erneut erlauben'}</Knopf>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Karte>
  );
}

function Laeufe({ api }: { api: SocialApi }) {
  const l = api.lage!.automatik.lauf;
  return (
    <Karte>
      <Ueberschrift>Letzte Läufe</Ueberschrift>
      <div style={{ display: 'grid', gap: 6, color: C.inkDim, fontSize: TYP.bedien }}>
        <span>Redaktion: {zeit(l.redaktion?.am)}{l.redaktion ? ` · ${l.redaktion.geschrieben ?? 0} geschrieben, ${l.redaktion.eingeplant ?? 0} eingeplant` : ''}{l.redaktion?.gestoppt ? ` · angehalten: ${l.redaktion.gestoppt}` : ''}</span>
        <span>Veröffentlichen: {zeit(l.veroeffentlichen?.am)}{l.veroeffentlichen ? ` · ${l.veroeffentlichen.gepostet ?? 0} gepostet, ${l.veroeffentlichen.fehler ?? 0} Fehler` : ''}{l.veroeffentlichen?.gestoppt ? ` · ${l.veroeffentlichen.gestoppt}` : ''}</span>
        <span>Zahlen: {zeit(l.messen?.am)}{l.messen ? ` · ${l.messen.gemessen ?? 0} geholt` : ''}</span>
      </div>
    </Karte>
  );
}
