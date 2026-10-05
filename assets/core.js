/* Shared helpers and a static chart-wheel renderer, used by the report, compatibility,
   Ask My Chart and the evidence viewer. Pure functions; no data is fetched or sent here. */
(function () {
  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const SG = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
  const PG = { Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇" };
  const PLANETS = Object.keys(PG);
  const EL = ["Fire","Earth","Air","Water"], MOD = ["Cardinal","Fixed","Mutable"];
  const TRULER = { Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon", Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars", Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter" };
  const MRULER = { ...TRULER, Scorpio: "Pluto", Aquarius: "Uranus", Pisces: "Neptune" };
  const AG = { conjunction: "☌", sextile: "⚹", square: "□", trine: "△", opposition: "☍" };
  const TONE = { conjunction: "blend", sextile: "flow", trine: "flow", square: "tension", opposition: "tension" };
  const TONEC = { flow: "#6fd0c6", tension: "#f0a3b5", blend: "#e5c47d" };
  const T = g => g + "︎";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ord = n => n + (["th","st","nd","rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)] || "th");
  const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  const signOf = lon => SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)];
  const sep = (a, b) => { const x = Math.abs(a - b) % 360; return Math.min(x, 360 - x); };
  const weightLevel = n => n >= 5 ? 4 : n >= 3 ? 3 : n === 2 ? 2 : 1;

  // Planet and "Rising" names mentioned in an evidence string, for highlighting
  function planetsIn(text) {
    const out = PLANETS.filter(p => new RegExp(`\\b${p}\\b`).test(text));
    if (/Rising|Ascendant|rising sign|chart ruler/i.test(text) && !out.includes("Venus") && /chart ruler/i.test(text)) out.push("Venus");
    return out;
  }

  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* drawWheel: a static, printable chart wheel.
     inner: [{n, lon}] · outer (optional second chart): [{n, lon}] · aspects: [{a, b, type, cross?}]
     centreSign: index of the sign drawn centred on the left (the rising sign), highlight: names to emphasise */
  function drawWheel({ inner = [], outer = null, aspects = [], centreSign = 0, highlight = null, size = 640, theme = "dark", ascLabel = true }) {
    const c = size / 2, R1 = c - 18, R2 = R1 - 40, RP = outer ? R2 - 68 : R2 - 40, RO = R2 - 22, RA = RP - 44;
    const ink = theme === "dark" ? "#f3dfb3" : "#1b2b30", line = theme === "dark" ? "#cfa95e" : "#8a6a2c";
    const disc = theme === "dark" ? "#0a2027" : "#fbf7f0";
    const ELC = { Fire: "#f1b48f", Earth: "#9fc79a", Air: "#b8c3f0", Water: "#6fc9c3" };
    const ang = lon => Math.PI + (lon - (centreSign * 30 + 15)) * Math.PI / 180;
    const pt = (lon, r) => [c + r * Math.cos(ang(lon)), c - r * Math.sin(ang(lon))];
    const svg = el("svg", { viewBox: `0 0 ${size} ${size}`, class: "cw" });
    const hl = highlight ? new Set(highlight) : null;
    el("circle", { cx: c, cy: c, r: R1 + 8, fill: "none", stroke: line, "stroke-opacity": .35 }, svg);
    SIGNS.forEach((s, i) => {
      const [x1, y1] = pt(i * 30, R1), [x2, y2] = pt(i * 30 + 30, R1), [x3, y3] = pt(i * 30 + 30, R2), [x4, y4] = pt(i * 30, R2);
      el("path", { d: `M${x1},${y1} A${R1},${R1} 0 0 0 ${x2},${y2} L${x3},${y3} A${R2},${R2} 0 0 1 ${x4},${y4} Z`, fill: ELC[EL[i % 4]], "fill-opacity": theme === "dark" ? .16 : .28, stroke: line, "stroke-opacity": .35 }, svg);
      const [tx, ty] = pt(i * 30 + 15, (R1 + R2) / 2);
      const t = el("text", { x: tx, y: ty + 7, "text-anchor": "middle", "font-size": size / 30, fill: ink, class: "g" }, svg); t.textContent = T(SG[i]);
    });
    if (ascLabel) {
      const [ax1, ay1] = pt(centreSign * 30, R1 + 12), [ax2, ay2] = pt(centreSign * 30 + 30, R1 + 12);
      el("path", { d: `M${ax1},${ay1} A${R1 + 12},${R1 + 12} 0 0 0 ${ax2},${ay2}`, fill: "none", stroke: line, "stroke-width": 3, "stroke-linecap": "round" }, svg);
    }
    el("circle", { cx: c, cy: c, r: R2, fill: disc, "fill-opacity": theme === "dark" ? .55 : 1, stroke: line, "stroke-opacity": .35 }, svg);
    if (outer) el("circle", { cx: c, cy: c, r: RP + 26, fill: "none", stroke: line, "stroke-opacity": .25, "stroke-dasharray": "3 5" }, svg);
    el("circle", { cx: c, cy: c, r: RA, fill: "none", stroke: line, "stroke-opacity": .18 }, svg);
    const spread = list => {
      const d = list.map(p => ({ ...p, d: p.lon })).sort((a, b) => a.lon - b.lon);
      for (let pass = 0; pass < 30; pass++) for (let i = 0; i < d.length; i++) {
        const a = d[i], b = d[(i + 1) % d.length], gap = (b.d - a.d + 360) % 360;
        if (d.length > 1 && gap < 9) { a.d -= (9 - gap) / 2; b.d += (9 - gap) / 2; }
      }
      return Object.fromEntries(d.map(x => [x.key || x.n, x]));
    };
    const Din = spread(inner), Dout = outer ? spread(outer.map(p => ({ ...p, key: "o:" + p.n }))) : {};
    const posOf = (name, which) => which === "o" ? Dout["o:" + name] : Din[name];
    const ag = el("g", { class: "asps" }, svg);
    aspects.forEach(a => {
      const A = posOf(a.a, "i"), B = posOf(a.b, a.cross ? "o" : "i");
      if (!A || !B) return;
      const [x1, y1] = pt(A.lon, RA), [x2, y2] = pt(B.lon, RA);
      const on = !hl || (hl.has(a.a) && hl.has(a.cross ? "o:" + a.b : a.b)) || a.hl;
      el("line", { x1, y1, x2, y2, class: on && hl ? "asp hl" : "asp", pathLength: 1, stroke: TONEC[TONE[a.type]], "stroke-width": on && hl ? 2.4 : 1.3, "stroke-opacity": on ? .9 : .12, "stroke-dasharray": a.type === "sextile" ? ".012 .012" : "" }, ag);
    });
    const drawSet = (D, r, fill, prefix) => Object.values(D).forEach(x => {
      const key = (prefix || "") + x.n, on = !hl || hl.has(key);
      const [t1, u1] = pt(x.lon, prefix ? RP + 26 : R2), [t2, u2] = pt(x.lon, prefix ? RP + 18 : R2 - 12);
      el("line", { x1: t1, y1: u1, x2: t2, y2: u2, stroke: ink, "stroke-width": 1.5, opacity: on ? 1 : .25 }, svg);
      const [px, py] = pt(x.d, r), g = el("g", { class: "wp", "data-p": key }, svg);
      el("circle", { cx: px, cy: py, r: size / 38, fill, stroke: on && hl ? "#e3c27e" : line, "stroke-width": on && hl ? 2.5 : 1.1, opacity: on ? 1 : .3 }, g);
      const t = el("text", { x: px, y: py + size / 110 + 3, "text-anchor": "middle", "font-size": size / 36, fill: "#10333a", class: "g", opacity: on ? 1 : .3 }, g); t.textContent = T(PG[x.n]);
    });
    drawSet(Din, RP, "#fbf6ee", "");
    if (outer) drawSet(Object.fromEntries(Object.entries(Dout).map(([k, v]) => [k, v])), RO, "#f3d6dc", "o:");
    return svg;
  }

  window.Charted = { SIGNS, SG, PG, PLANETS, EL, MOD, TRULER, MRULER, AG, TONE, TONEC, T, esc, ord, ROMAN, signOf, sep, weightLevel, planetsIn, el, drawWheel };
})();
