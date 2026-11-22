// Speicherwerk Havelland · Beispielseite. Die Szene „Ein Tag“: Sonne, Halle, Speicher, Netz und der Tagesverlauf.
// Alles ist eine gezeichnete Illustration mit frei gewählten, einheitenlosen Verläufen. Es gibt keine Messwerte.
// Ohne dieses Skript bleibt ein Standbild (medien/szene-poster.jpg) stehen und die Seite ist vollständig lesbar.

const klemme = (w, a = 0, b = 1) => Math.min(b, Math.max(a, w));
const weich = (t) => { t = klemme(t); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const rgb = (h) => (h[0] === 'r' ? h.slice(4, -1).split(',').map(Number) : [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const farbe = (a, b, t) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(mix(v, B[i], klemme(t)))).join(',')})`; };

/* ─── Das Modell des Tages (einheitenlos) ─── */
const SCHRITTE = 288, DT = 24 / SCHRITTE, KAPAZITAET = 2.4, RATE = 0.55;
export const erzeugung = (h) => Math.pow(Math.max(0, Math.cos(2 * Math.PI * (h - 13) / 24)), 1.2);
export const verbrauch = (h) => {
  const arbeit = weich((h - 5.5) / 2) * (1 - weich((h - 17) / 1.6));
  const abend = 0.06 * weich((h - 17) / 1.5) * (1 - weich((h - 22) / 1.5));
  return 0.2 + 0.36 * arbeit + abend + 0.04 * Math.sin(h * 1.3) * arbeit;
};
function tagRechnen(mit) {
  let soc = 0, tag = [];
  for (let d = 0; d < 3; d++) for (let i = 0; i < SCHRITTE; i++) {
    const h = i * DT, p = erzeugung(h), l = verbrauch(h), s = p - l;
    let lad = 0, ent = 0, netz = -s;
    if (mit) {
      if (s > 0) { lad = Math.min(s, RATE, (KAPAZITAET - soc) / DT); netz = -(s - lad); }
      else { ent = Math.min(-s, RATE, soc / DT); netz = -s - ent; }
      soc += (lad - ent) * DT;
    }
    if (d === 2) tag.push({ h, p, l, soc: mit ? soc / KAPAZITAET : 0, lad, ent, netz });
  }
  return tag;
}
const TAGE = { an: tagRechnen(true), aus: tagRechnen(false) };
export function probe(h, mit) {
  const tag = TAGE[mit ? 'an' : 'aus'], x = (((h % 24) + 24) % 24) / DT, i = Math.floor(x) % SCHRITTE, j = (i + 1) % SCHRITTE, u = x - Math.floor(x);
  const a = tag[i], b = tag[j], o = {};
  for (const k of ['p', 'l', 'soc', 'lad', 'ent', 'netz']) o[k] = mix(a[k], b[k], u);
  o.h = h; return o;
}
export function wortLage(s, mit) {
  const erz = s.p < 0.02 ? 'keine' : s.p < 0.3 ? 'niedrig' : s.p < 0.65 ? 'mittel' : 'hoch';
  const ver = s.l < 0.3 ? 'niedrig' : s.l < 0.5 ? 'mittel' : 'hoch';
  const netz = Math.abs(s.netz) < 0.04 ? 'ruhig' : s.netz > 0 ? 'Bezug' : 'Einspeisung';
  let spei = 'nicht vorhanden';
  if (mit) spei = s.lad > 0.03 ? (s.soc > 0.95 ? 'voll' : 'füllt sich') : s.ent > 0.03 ? (s.soc < 0.05 ? 'fast leer' : 'versorgt') : s.soc > 0.9 ? 'voll' : s.soc < 0.05 ? 'leer' : 'ruht';
  let satz;
  if (s.p > s.l) {
    if (mit && s.lad > 0.03) satz = 'Die Anlage erzeugt mehr, als der Betrieb braucht. Der Überschuss lädt den Speicher.';
    else if (mit) satz = 'Der Speicher ist voll. Jetzt geht der Überschuss ins Netz.';
    else satz = 'Die Anlage erzeugt mehr, als der Betrieb braucht. Der Überschuss geht ins Netz.';
  } else if (s.p >= 0.02) {
    if (s.h < 13) satz = mit && s.ent > 0.03 ? 'Die Sonne steigt, reicht aber noch nicht. Der Speicher hilft aus.' : 'Die Sonne steigt, reicht aber noch nicht für den Betrieb. Der Rest kommt aus dem Netz.';
    else satz = mit && s.ent > 0.03 ? 'Die Sonne reicht nicht mehr ganz. Der Speicher hilft aus.' : 'Die Sonne reicht nicht mehr ganz. Der Rest kommt aus dem Netz.';
  } else if (mit && s.ent > 0.03) satz = 'Es ist dunkel. Der Speicher versorgt den Betrieb, das Netz wird wenig gebraucht.';
  else if (mit) satz = 'Der Speicher ist leer. Jetzt kommt der Strom wieder aus dem Netz.';
  else satz = 'Es ist dunkel. Ohne Speicher kommt der Strom aus dem Netz.';
  return { erz, ver, netz, spei, satz };
}
export const uhrzeit = (h) => { const m = Math.round(h * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

/* ─── Zeichnen: die Szene ─── */
const SONNE = '#F5A700', GRUEN = '#18B06E', NETZ = '#7FA6D4', TINTE = '#0F2A21';
const STERNE = Array.from({ length: 46 }, (_, i) => [((i * 97) % 100) / 100, (((i * 53) % 61) / 100) * 0.9 + 0.02, 0.6 + ((i * 31) % 10) / 10]);

export function szeneBauen(cv) {
  const ctx = cv.getContext('2d');
  let B = 0, H = 0, dpr = 1;
  const groesse = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    B = Math.max(2, Math.round(cv.clientWidth)); H = Math.max(2, Math.round(cv.clientHeight));
    cv.width = Math.round(B * dpr); cv.height = Math.round(H * dpr);
  };
  function zeichnen({ h, mit, t = 0 }) {
    const s = probe(h, mit), wide = B / H > 1.5;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, B, H);
    // Himmel
    const el = Math.cos(2 * Math.PI * (h - 13) / 24);
    const tag = weich((el + 0.05) / 0.5), gold = Math.exp(-Math.pow((el - 0.02) / 0.2, 2));
    const oben = farbe(farbe('#0A1A2C', '#6FB4E4', tag), '#4B6FA0', gold * 0.7), unten = farbe(farbe('#1B3558', '#EAF5FB', tag), '#F6B36B', gold * 0.9);
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.8); g.addColorStop(0, oben); g.addColorStop(1, unten);
    ctx.fillStyle = g; ctx.fillRect(0, 0, B, H);
    const nacht = 1 - tag;
    if (nacht > 0.05) { ctx.fillStyle = '#fff'; for (const [x, y, r] of STERNE) { ctx.globalAlpha = nacht * 0.75 * (0.5 + 0.5 * Math.sin(t * 1.3 + x * 40)); ctx.beginPath(); ctx.arc(x * B, y * H, r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
    // Sonne und Mond
    const pS = (h - 7) / 12, horizont = H * 0.74;
    if (pS > -0.08 && pS < 1.08) {
      const sx = mix(B * 0.06, B * 0.94, pS), sy = horizont - Math.sin(Math.PI * klemme(pS, -0.1, 1.1)) * H * 0.62, r = Math.min(B, H * 1.6) * 0.04;
      const gl = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 5); gl.addColorStop(0, 'rgba(255,214,120,.55)'); gl.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, r * 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#FFD25A'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
    } else {
      const pm = ((h + 24 - 19) % 24) / 12, mx = mix(B * 0.1, B * 0.9, klemme(pm)), my = horizont - Math.sin(Math.PI * klemme(pm)) * H * 0.5, r = Math.min(B, H * 1.6) * 0.022;
      ctx.fillStyle = '#E9EEF2'; ctx.beginPath(); ctx.arc(mx, my, r, 0, 7); ctx.fill();
      ctx.fillStyle = oben; ctx.beginPath(); ctx.arc(mx + r * 0.45, my - r * 0.2, r * 0.9, 0, 7); ctx.fill();
    }
    // Wolken (ziehen langsam, nachts kaum zu sehen)
    ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.55 * tag})`;
    [[0.18, 0.2, 1], [0.52, 0.12, 0.8], [0.8, 0.27, 1.2]].forEach(([cx, cy, k], i) => {
      const x = ((cx * B + t * (6 + i * 3)) % (B + 300)) - 150, y = cy * H, w = 110 * k * Math.min(1.3, B / 800);
      for (const [dx, dy, r] of [[0, 0, 0.32], [0.3, -0.1, 0.4], [0.62, 0, 0.3], [0.32, 0.08, 0.34]]) { ctx.beginPath(); ctx.ellipse(x + dx * w, y + dy * w, r * w * 0.8, r * w * 0.42, 0, 0, 7); ctx.fill(); }
    });
    // Hügel: ferne Reihe im Dunst, nahe Reihe mit Baumkronen
    const huegel = (lage, amp, farbe_) => { ctx.fillStyle = farbe_; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H * lage);
      for (let x = 0; x <= B; x += 20) ctx.lineTo(x, H * lage - Math.sin(x / B * 5 + amp) * H * 0.035 - Math.sin(x / B * 11 + amp) * H * 0.012);
      ctx.lineTo(B, H); ctx.fill(); };
    huegel(0.66, 3, farbe('#1A3128', '#A9CBB8', tag * 0.8 + 0.1));
    ctx.fillStyle = farbe('#12261E', '#6E9E7C', tag * 0.8 + 0.1);
    for (let i = 0, x = 8; x < B; i++, x += 22 + ((i * 13) % 31)) { const y = H * 0.68 - Math.sin(x / B * 5 + 3) * H * 0.035 - Math.sin(x / B * 11 + 3) * H * 0.012, r = 8 + ((i * 7) % 9); ctx.beginPath(); ctx.ellipse(x, y - r * 0.2, r * 0.8, r * 1.25, 0, 0, 7); ctx.fill(); }
    huegel(0.72, 1, farbe('#173025', '#7FB48F', tag * 0.8 + 0.1));

    // Welt
    const WB = wide ? 1000 : 720, WH = 640, sc = Math.min(B / WB, H / WH);
    ctx.save(); ctx.translate((B - WB * sc) / 2, H - WH * sc); ctx.scale(sc, sc);
    const hx = wide ? 90 : 20, hw = wide ? 470 : 400, bx = wide ? 640 : 452, bw = wide ? 110 : 100, px = wide ? 880 : 650, GY = 560;
    // Boden: Hof (Asphalt mit Fugen und Markierung), Kante, Grasstreifen
    ctx.fillStyle = '#1D3A31'; ctx.fillRect(-400, GY, WB + 800, 200);
    ctx.fillStyle = farbe('#27322F', '#5C6764', tag * 0.8 + 0.1); ctx.fillRect(-400, GY, WB + 800, 54);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-400, GY, WB + 800, 3);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let x = -380; x < WB + 400; x += 96) ctx.fillRect(x, GY + 4, 2, 50);
    ctx.fillStyle = farbe('#6F6A38', '#E8D677', tag * 0.9 + 0.1); for (let x = -380; x < WB + 400; x += 70) ctx.fillRect(x, GY + 44, 34, 4);
    ctx.fillStyle = farbe('#143026', '#4F8F63', tag * 0.8 + 0.1); ctx.fillRect(-400, GY + 54, WB + 800, 10);
    // Schattenwurf: Länge und Richtung folgen der Sonne (Sonne links: Schatten nach rechts)
    if (tag > 0.05) {
      const dir = (0.5 - klemme(pS, 0, 1)) * 2, lang = 0.18 + (1 - Math.sin(Math.PI * klemme(pS, 0, 1))) * 1.5;
      ctx.fillStyle = `rgba(6,16,12,${0.34 * tag})`;
      const schatten = (x0, x1, hoehe) => { const dx = dir * lang * hoehe; ctx.beginPath(); ctx.moveTo(x0, GY); ctx.lineTo(x1, GY); ctx.lineTo(x1 + dx, GY + 30); ctx.lineTo(x0 + dx, GY + 30); ctx.closePath(); ctx.fill(); };
      schatten(hx, hx + hw, 175); schatten(px - 3, px + 3, 188); if (mit) schatten(bx, bx + bw, 94);
    }
    // Netzmast mit Isolatoren, Trafohäuschen und Zaun
    const masti = farbe('#0F1D18', '#4B5C55', tag);
    ctx.strokeStyle = masti; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px - 3, GY); ctx.lineTo(px - 3, 360); ctx.moveTo(px + 3, GY); ctx.lineTo(px + 3, 360); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); for (let y = GY - 16; y > 372; y -= 28) { ctx.moveTo(px - 3, y); ctx.lineTo(px + 3, y - 28); ctx.moveTo(px + 3, y); ctx.lineTo(px - 3, y - 28); } ctx.stroke();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(px - 40, 392); ctx.lineTo(px + 40, 392); ctx.moveTo(px - 28, 424); ctx.lineTo(px + 28, 424); ctx.stroke();
    ctx.fillStyle = farbe('#2A3A44', '#D9E4EA', tag); for (const x of [px - 38, px - 2, px + 34, px - 26, px + 24]) { const y = (x === px - 26 || x === px + 24) ? 424 : 392; ctx.fillRect(x, y - 8, 5, 10); }
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 38, 392); ctx.lineTo(px + 150, 404); ctx.moveTo(px - 38, 392); ctx.quadraticCurveTo((px + hx + hw) / 2, 430, hx + hw, 418); ctx.stroke();
    ctx.fillStyle = farbe('#2F3F39', '#9AA79F', tag); ctx.fillRect(px + 16, GY - 38, 34, 38); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(px + 16, GY - 38, 34, 4);
    ctx.fillStyle = '#E4B300'; ctx.beginPath(); ctx.moveTo(px + 33, GY - 30); ctx.lineTo(px + 40, GY - 17); ctx.lineTo(px + 26, GY - 17); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(210,220,215,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let x = px - 46; x <= px + 62; x += 9) { ctx.moveTo(x, GY - 14); ctx.lineTo(x, GY + 6); } ctx.moveTo(px - 46, GY - 10); ctx.lineTo(px + 62, GY - 10); ctx.stroke();
    // Halle
    const wand = farbe('#4A5A58', '#E4DDC8', tag * 0.85 + 0.15);
    ctx.fillStyle = wand; ctx.fillRect(hx, 398, hw, GY - 398);
    ctx.fillStyle = farbe('#3A4846', '#CFC7AE', tag * 0.85 + 0.15); ctx.fillRect(hx - 8, 390, hw + 16, 12);
    const warm = klemme(s.l / 0.6) * nacht, wn = 5, ww = hw / wn;
    for (let i = 0; i < wn; i++) {
      const wx = hx + i * ww + ww * 0.18;
      ctx.fillStyle = farbe(farbe('#9EC6DE', '#B9D9EA', tag), '#FFD98A', warm); ctx.fillRect(wx, 440, ww * 0.64, 54);
      ctx.fillStyle = 'rgba(15,42,33,.18)'; ctx.fillRect(wx + ww * 0.32 - 1, 440, 2, 54);
    }
    // Fassade: Trapezblech, Sockel; Fensterrahmen mit Spiegelung des Himmels
    ctx.fillStyle = 'rgba(0,0,0,.07)'; for (let x = hx + 6; x < hx + hw - 4; x += 14) ctx.fillRect(x, 402, 3, GY - 402);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; for (let x = hx + 9; x < hx + hw - 4; x += 14) ctx.fillRect(x, 402, 2, GY - 402);
    ctx.fillStyle = farbe('#26302E', '#A39F8B', tag * 0.85 + 0.1); ctx.fillRect(hx, GY - 14, hw, 14);
    for (let i = 0; i < wn; i++) {
      const wx = hx + i * ww + ww * 0.18, sp = ctx.createLinearGradient(wx, 440, wx + ww * 0.64, 494); sp.addColorStop(0, `rgba(255,255,255,${0.32 * tag})`); sp.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = sp; ctx.fillRect(wx, 440, ww * 0.64, 54);
      ctx.strokeStyle = farbe('#1E2A27', '#6F7B75', tag); ctx.lineWidth = 2; ctx.strokeRect(wx, 440, ww * 0.64, 54);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(wx, 494, ww * 0.64, 4);
    }
    // Rolltore mit Lamellen, Rampe, Wandleuchten
    const tor = (x, w) => {
      ctx.fillStyle = farbe('#202A28', '#6F7870', tag); ctx.fillRect(x - 4, 502, w + 8, GY - 502);
      const tg = ctx.createLinearGradient(0, 506, 0, GY); tg.addColorStop(0, farbe('#3A4642', '#C9CCC2', tag)); tg.addColorStop(1, farbe('#2B3633', '#A9ACA2', tag));
      ctx.fillStyle = tg; ctx.fillRect(x, 506, w, GY - 506);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 512; y < GY - 4; y += 8) ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = '#E4B300'; ctx.fillRect(x - 4, GY - 14, 4, 14); ctx.fillRect(x + w, GY - 14, 4, 14);
    };
    tor(hx + hw * 0.5 - 56, 54); tor(hx + hw * 0.5 + 8, 54);
    ctx.fillStyle = farbe('#34413D', '#8C968F', tag); ctx.beginPath(); ctx.moveTo(hx + hw * 0.5 - 62, GY); ctx.lineTo(hx + hw * 0.5 + 70, GY); ctx.lineTo(hx + hw * 0.5 + 78, GY + 14); ctx.lineTo(hx + hw * 0.5 - 70, GY + 14); ctx.closePath(); ctx.fill();
    const lampen = [hx + 20, hx + hw * 0.5 - 70, hx + hw * 0.5 + 76, hx + hw - 20];
    for (const x of lampen) { ctx.fillStyle = '#20302B'; ctx.fillRect(x - 5, 496, 10, 5); if (nacht > 0.15) { const lg = ctx.createRadialGradient(x, 508, 2, x, 520, 70); lg.addColorStop(0, `rgba(255,222,150,${0.55 * nacht})`); lg.addColorStop(1, 'rgba(255,222,150,0)'); ctx.fillStyle = lg; ctx.fillRect(x - 80, 490, 160, 120); } }
    // Dachaufbauten: Lüfter, Rohr, Blitzableiter
    ctx.fillStyle = farbe('#2B3633', '#AEB1A6', tag); ctx.fillRect(hx + hw - 44, 372, 18, 18); ctx.fillRect(hx + hw - 38, 352, 6, 22); ctx.fillRect(hx + 22, 378, 22, 12);
    ctx.strokeStyle = farbe('#2B3633', '#AEB1A6', tag); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx + hw - 8, 390); ctx.lineTo(hx + hw - 8, 346); ctx.stroke();
    // Solarfeld auf dem Dach
    const n = 6, pw = (hw - 20) / n;
    for (let i = 0; i < n; i++) {
      const x = hx + 10 + i * pw;
      const gp = ctx.createLinearGradient(x, 360, x + pw, 392);
      gp.addColorStop(0, farbe('#1C3C5E', '#2F5F94', s.p)); gp.addColorStop(1, farbe('#12283F', '#1E426A', s.p));
      ctx.fillStyle = gp; ctx.beginPath(); ctx.moveTo(x + 4, 390); ctx.lineTo(x + pw - 6, 390); ctx.lineTo(x + pw + 4, 358); ctx.lineTo(x + 14, 358); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(190,215,240,.45)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 9, 374); ctx.lineTo(x + pw + 0, 374); ctx.moveTo(x + pw / 2 + 9, 358); ctx.lineTo(x + pw / 2, 390); ctx.stroke();
      if (s.p > 0.05) { ctx.fillStyle = `rgba(255,224,140,${0.32 * s.p})`; ctx.beginPath(); ctx.moveTo(x + 4, 390); ctx.lineTo(x + pw - 6, 390); ctx.lineTo(x + pw + 4, 358); ctx.lineTo(x + 14, 358); ctx.closePath(); ctx.fill(); }
    }
    // Speicher
    if (mit) {
      ctx.fillStyle = farbe('#3A5248', '#CFDCD1', tag * 0.8 + 0.2); ctx.beginPath(); ctx.roundRect(bx, 466, bw, GY - 466, 8); ctx.fill();
      ctx.fillStyle = 'rgba(15,42,33,.2)'; ctx.fillRect(bx + bw * 0.12, 482, bw * 0.76, 4);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let x = bx + 6; x < bx + bw - 4; x += 9) ctx.fillRect(x, 470, 2, GY - 470 - 6);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(bx, 466, bw, 3);
      ctx.fillStyle = farbe('#26332E', '#8C978F', tag); ctx.fillRect(bx - 5, GY - 8, bw + 10, 8);
      for (const fx of [bx + bw * 0.28, bx + bw * 0.72]) {
        ctx.fillStyle = farbe('#1B2723', '#6E7A73', tag); ctx.beginPath(); ctx.roundRect(fx - 12, 456, 24, 10, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.6; const w0 = t * 5 * (0.3 + s.lad + s.ent); ctx.beginPath(); ctx.moveTo(fx - 9 * Math.cos(w0), 461); ctx.lineTo(fx + 9 * Math.cos(w0), 461); ctx.stroke();
      }
      ctx.fillStyle = s.lad > 0.03 ? GRUEN : s.ent > 0.03 ? SONNE : '#86C7A5'; ctx.beginPath(); ctx.arc(bx + bw - 10, 474, 3.2, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(bx + 10, 474, 22, 3);
      ctx.fillStyle = '#E4B300'; ctx.fillRect(bx + 10, GY - 22, 8, 8);
      ctx.fillStyle = '#0F2A21'; ctx.beginPath(); ctx.roundRect(bx + 14, 496, bw - 28, 48, 6); ctx.fill();
      const zellen = 5, zh = 7, gap = 2.4, fuell = s.soc * zellen;
      for (let i = 0; i < zellen; i++) {
        const an = klemme(fuell - i), y = 496 + 48 - 6 - (i + 1) * (zh + gap) + gap + 1;
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(bx + 20, y, bw - 40, zh);
        if (an > 0) { ctx.fillStyle = s.lad > 0.03 ? GRUEN : s.ent > 0.03 ? SONNE : '#86C7A5'; ctx.globalAlpha = 0.35 + 0.65 * an; ctx.fillRect(bx + 20, y, (bw - 40) * 1, zh); ctx.globalAlpha = 1; }
      }
    } else {
      ctx.setLineDash([7, 6]); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, 466, bw, GY - 466, 8); ctx.stroke(); ctx.setLineDash([]);
    }
    // Flüsse
    const pvN = [hx + hw * 0.62, 356], haN = [hx + hw * 0.62, 452], baX = bx + bw / 2, geR = [hx + hw, 418], mast = [px - 38, 392];
    const pfade = [
      { punkte: [pvN, haN], menge: Math.min(s.p, s.l), farbe: SONNE },
      { punkte: [pvN, [pvN[0], 326], [baX, 326], [baX, 466]], menge: s.lad, farbe: SONNE },
      { punkte: [[baX, 520], [hx + hw, 520]], menge: s.ent, farbe: GRUEN },
      { punkte: [[hx + hw - 10, 418], [px - 38, 392]], menge: Math.max(0, -s.netz), farbe: NETZ },
      { punkte: [[px - 38, 392], [hx + hw - 10, 418]], menge: Math.max(0, s.netz), farbe: NETZ },
    ];
    for (const f of pfade) {
      const P = f.punkte, len = []; let L = 0;
      for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); len.push(d); L += d; }
      if (f.menge > 0.03) {
        const nPunkte = Math.max(2, Math.round(f.menge * 9));
        ctx.strokeStyle = f.farbe; ctx.globalAlpha = 0.3; ctx.lineWidth = 3 + f.menge * 3; ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.stroke(); ctx.globalAlpha = 1;
        for (let k = 0; k < nPunkte; k++) {
          let u = ((t * 0.32 + k / nPunkte) % 1) * L, i = 0; while (i < len.length - 1 && u > len[i]) { u -= len[i]; i++; }
          const q = u / len[i], x = mix(P[i][0], P[i + 1][0], q), y = mix(P[i][1], P[i + 1][1], q);
          ctx.fillStyle = f.farbe; ctx.beginPath(); ctx.arc(x, y, 5.2 + f.menge * 2, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 1.8, 0, 7); ctx.fill();
        }
      }
    }
    // Ladesäule mit E-Auto zwischen Speicher und Mast
    const gs = bx + bw + 10, cw_ = Math.max(40, Math.min(64, px - gs - 40));
    if (cw_ >= 40) {
      const cx = gs + 18, cy = GY + 8;
      ctx.fillStyle = farbe('#1A2623', '#7C8680', tag); ctx.fillRect(gs, cy - 36, 8, 36);
      ctx.fillStyle = s.ent > 0.03 ? GRUEN : '#86C7A5'; ctx.fillRect(gs + 1, cy - 32, 6, 5);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx + cw_ / 2, cy + 3, cw_ / 2 + 4, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = farbe('#35516F', '#4F83B9', tag); ctx.beginPath(); ctx.roundRect(cx, cy - 20, cw_, 16, 5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + cw_ * 0.18, cy - 20); ctx.lineTo(cx + cw_ * 0.3, cy - 32); ctx.lineTo(cx + cw_ * 0.7, cy - 32); ctx.lineTo(cx + cw_ * 0.86, cy - 20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = farbe('#6D93AE', '#CFE6F2', tag); ctx.beginPath(); ctx.moveTo(cx + cw_ * 0.24, cy - 21); ctx.lineTo(cx + cw_ * 0.33, cy - 30); ctx.lineTo(cx + cw_ * 0.48, cy - 30); ctx.lineTo(cx + cw_ * 0.48, cy - 21); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + cw_ * 0.52, cy - 21); ctx.lineTo(cx + cw_ * 0.52, cy - 30); ctx.lineTo(cx + cw_ * 0.68, cy - 30); ctx.lineTo(cx + cw_ * 0.8, cy - 21); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#11201B'; for (const wx of [cx + cw_ * 0.22, cx + cw_ * 0.78]) { ctx.beginPath(); ctx.arc(wx, cy - 4, 6, 0, 7); ctx.fill(); }
      ctx.strokeStyle = farbe('#0F1D18', '#394640', tag); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gs + 8, cy - 24); ctx.quadraticCurveTo(gs + 12, cy - 8, cx + 2, cy - 14); ctx.stroke();
    }
    // Beschriftung auf dem Boden
    ctx.fillStyle = 'rgba(244,240,228,.9)'; ctx.font = '600 15px "Azeret Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText('BETRIEB', hx + hw / 2, GY + 30); ctx.fillText(mit ? 'SPEICHER' : 'KEIN SPEICHER', bx + bw / 2, GY + 30); ctx.fillText('NETZ', px, GY + 30);
    ctx.restore();
  }
  return { groesse, zeichnen };
}

/* ─── Zeichnen: der Tagesverlauf ─── */
export function kurveBauen(cv) {
  const ctx = cv.getContext('2d');
  let B = 0, H = 0, dpr = 1;
  const groesse = () => { dpr = Math.min(2, devicePixelRatio || 1); B = Math.max(2, Math.round(cv.clientWidth)); H = Math.max(2, Math.round(cv.clientHeight)); cv.width = Math.round(B * dpr); cv.height = Math.round(H * dpr); };
  function zeichnen({ h, mit }) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, B, H);
    const l = 34, r = 12, o = 14, u = 30, w = B - l - r, hh = H - o - u, X = (x) => l + (x / 24) * w, Y = (v) => o + hh - v * hh * 0.92;
    ctx.font = '500 12px "Azeret Mono", ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#4F6358'; ctx.strokeStyle = 'rgba(15,42,33,.12)'; ctx.lineWidth = 1;
    for (const x of [0, 6, 12, 18, 24]) { ctx.beginPath(); ctx.moveTo(X(x), o); ctx.lineTo(X(x), o + hh); ctx.stroke(); ctx.fillText(x === 24 ? '24' : String(x), X(x), H - 10); }
    const tag = TAGE[mit ? 'an' : 'aus'];
    const linie = (key, wert) => { ctx.beginPath(); tag.forEach((p, i) => { const x = X(p.h), y = Y(wert ? wert(p) : p[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.lineTo(X(24), Y(wert ? wert(tag[0]) : tag[0][key])); };
    linie('p'); ctx.lineTo(X(24), Y(0)); ctx.lineTo(X(0), Y(0)); ctx.closePath(); ctx.fillStyle = 'rgba(245,167,0,.28)'; ctx.fill();
    linie('p'); ctx.strokeStyle = '#E39A00'; ctx.lineWidth = 2.5; ctx.stroke();
    if (mit) { linie('soc', (p) => p.soc * 0.7); ctx.lineTo(X(24), Y(0)); ctx.lineTo(X(0), Y(0)); ctx.closePath(); ctx.fillStyle = 'rgba(24,176,110,.2)'; ctx.fill(); linie('soc', (p) => p.soc * 0.7); ctx.strokeStyle = '#139A5E'; ctx.lineWidth = 2.5; ctx.stroke(); }
    linie('l'); ctx.strokeStyle = '#0F2A21'; ctx.lineWidth = 2.5; ctx.stroke();
    const cx = X(((h % 24) + 24) % 24);
    ctx.strokeStyle = '#0F2A21'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, o - 4); ctx.lineTo(cx, o + hh); ctx.stroke();
    const s = probe(h, mit); ctx.fillStyle = '#E39A00'; ctx.beginPath(); ctx.arc(cx, Y(s.p), 5, 0, 7); ctx.fill(); ctx.fillStyle = '#0F2A21'; ctx.beginPath(); ctx.arc(cx, Y(s.l), 5, 0, 7); ctx.fill();
    if (mit) { ctx.fillStyle = '#139A5E'; ctx.beginPath(); ctx.arc(cx, Y(s.soc * 0.7), 5, 0, 7); ctx.fill(); }
  }
  return { groesse, zeichnen };
}

/* ─── Auf der Seite ─── */
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => [...w.querySelectorAll(s)];
const buehne = $('#tag-canvas');
if (buehne) {
  const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const szene = szeneBauen(buehne), kurve = kurveBauen($('#kurve'));
  const el = { uhr: $('#tag-uhr'), lage: $('#tag-lage'), satz: $('#tag-satz'), steuerung: $('#tag-steuerung'), kurve: $('#kurve'), poster: $('.tag-poster'), zeit: $('#tag-zeit'), play: $('#tag-play') };
  const wert = { erz: $('#w-erzeugung'), ver: $('#w-verbrauch'), netz: $('#w-netz'), spei: $('#w-speicher') };
  const z = { h: 13, mit: true, spielt: false, sichtbar: true, t0: performance.now() };
  [el.uhr, el.lage, el.steuerung, el.kurve].forEach((e) => { e.hidden = false; });
  document.documentElement.classList.add('szene-an');
  const alleGroessen = () => { szene.groesse(); kurve.groesse(); };
  let zuletzt = '';
  function bild(ms) {
    const t = reduziert ? 0 : (ms - z.t0) / 1000;
    szene.zeichnen({ h: z.h, mit: z.mit, t }); kurve.zeichnen({ h: z.h, mit: z.mit });
    const s = probe(z.h, z.mit), w = wortLage(s, z.mit), u = uhrzeit(z.h);
    const sig = u + w.satz + w.spei;
    if (sig !== zuletzt) {
      zuletzt = sig; el.uhr.textContent = u; el.lage.textContent = w.satz; el.satz.textContent = w.satz;
      wert.erz.textContent = w.erz; wert.ver.textContent = w.ver; wert.netz.textContent = w.netz; wert.spei.textContent = w.spei;
      el.zeit.setAttribute('aria-valuetext', u + ' Uhr');
    }
  }
  const slider = (h) => { el.zeit.value = String(Math.round(h * 12) % 288); };
  let letzte = 0;
  function lauf(ms) {
    requestAnimationFrame(lauf);
    if (!z.sichtbar) return;
    if (z.spielt) { z.h += Math.min(0.1, (ms - letzte) / 1000) * 1.6; if (z.h >= 24) { z.h = 24; stopp(); } slider(z.h); }
    letzte = ms; bild(ms);
  }
  function stopp() { z.spielt = false; el.play.setAttribute('aria-pressed', 'false'); }
  function start() { if (z.h >= 23.9) z.h = 5; z.spielt = true; el.play.setAttribute('aria-pressed', 'true'); }
  el.play.addEventListener('click', () => { z.spielt ? stopp() : start(); if (reduziert) bild(0); });
  el.zeit.addEventListener('input', () => { stopp(); z.h = Number(el.zeit.value) / 12; if (reduziert) bild(0); });
  $$('.segment').forEach((k) => k.addEventListener('click', () => {
    z.mit = k.dataset.speicher === 'an';
    $$('.segment').forEach((x) => x.setAttribute('aria-pressed', String(x === k)));
    if (reduziert) bild(0);
  }));
  alleGroessen(); addEventListener('resize', () => { alleGroessen(); bild(performance.now()); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { alleGroessen(); bild(performance.now()); }).observe(buehne);
  document.fonts?.load('600 15px "Azeret Mono"').then(() => bild(performance.now()));
  bild(performance.now());
  if (!reduziert) {
    requestAnimationFrame(lauf);
    if ('IntersectionObserver' in window) {
      const o = new IntersectionObserver(([e]) => { z.sichtbar = e.isIntersecting; }, { threshold: 0.05 }); o.observe(buehne);
      // einmal sanft anspielen: der Tag läuft von früh bis abends, bis jemand eingreift
      const an = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return; an.disconnect();
        z.h = 5; slider(z.h); start();
      }, { threshold: 0.55 }); an.observe(buehne);
    }
  }
  el.poster.classList.add('weg');
}

/* ─── Stromausfall: Auswahl ─── */
const wahlKnoepfe = $$('.wahl-knopf');
if (wahlKnoepfe.length) {
  const kopf = $('#wahl-kopf'), text = $('#wahl-text'), zusatz = $('#wahl-zusatz');
  const aktualisieren = () => {
    const an = wahlKnoepfe.filter((k) => k.getAttribute('aria-pressed') === 'true').map((k) => k.dataset.art);
    if (!an.length) {
      kopf.textContent = 'Noch nichts gewählt';
      text.textContent = 'Tippen Sie an, was bei Ihnen nicht ausfallen darf. Daraus wird später ein eigener, abgesicherter Stromkreis.';
      zusatz.hidden = true; return;
    }
    kopf.textContent = an.length === 1 ? 'Ein abgesicherter Stromkreis' : `${an.length} Verbraucher im abgesicherten Stromkreis`;
    text.textContent = 'Diese Verbraucher planen wir an einen eigenen Stromkreis. Ob Speicher und Wechselrichter sie im Ausfall tragen, rechnen wir mit Ihren Lastdaten nach und schreiben das Ergebnis ins Angebot.';
    const hinweise = [];
    if (an.includes('maschine')) hinweise.push('Große Motoren brauchen beim Anlaufen kurzzeitig deutlich mehr Strom, das prüfen wir gesondert.');
    if (an.includes('kuehlung')) hinweise.push('Bei Kühlung zählt, wie lange der Ausfall dauern darf. Das legen wir mit Ihnen fest.');
    if (an.includes('it')) hinweise.push('Für Server und Netzwerk lohnt sich ein geordnetes Herunterfahren.');
    zusatz.textContent = hinweise.join(' '); zusatz.hidden = !hinweise.length;
  };
  wahlKnoepfe.forEach((k) => k.addEventListener('click', () => { k.setAttribute('aria-pressed', String(k.getAttribute('aria-pressed') !== 'true')); aktualisieren(); }));
}
