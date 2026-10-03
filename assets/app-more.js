/* Celestial app, part two: Timing, Compatibility, Learn and the full report. */
(function () {
  const { SIGNS, SG, PG, PLANETS, EL, MOD, AG, TONE, TONEC, T, esc, ROMAN, el, drawWheel, planetsIn } = window.Charted;
  const L = window.Lib, S = window.ChartedApp, E = window.Engine, ord = window.Reading.ord;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const fd = d => new Date(d + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const wave = () => `<svg class="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,50 C260,10 500,80 760,46 C1020,12 1240,72 1440,40 L1440,90 L0,90 Z" class="seam"/></svg>`;
  const head = (label, a, b, lede) => `<header class="env world-head env-night"><div class="wrap"><div class="label">${label}</div><h1 class="wh">${a}<em>${b}</em></h1><p class="lede">${lede}</p></div>${wave()}</header>`;
  const getTiming = () => S.timing || (S.timing = E.timing(S.chart));
  let cityData = null;
  const loadCities = () => cityData || (cityData = fetch("data/cities.json").then(r => r.json()));
  let regionName = null; try { regionName = new Intl.DisplayNames(["en"], { type: "region" }); } catch {}
  const country = cc => (regionName && regionName.of(cc)) || cc;
  const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // ===================== TIMING =====================
  S.renderTiming = () => {
    if (S.rendered.timing) return; S.rendered.timing = true;
    const w = $("#w-timing");
    w.innerHTML = head("Understand now", "Tim", "ing", "Your natal chart is one moment. These techniques move it through time: what's active now, what's coming, and the long cycles of a life.") + `<section class="env env-night" id="time"><div class="wrap"><p class="lede">Calculating your timing…</p></div></section>`;
    setTimeout(() => { buildTiming(); S.paintSeams(); }, 30);
  };
  function buildTiming() {
    const c = S.chart, tm = getTiming(), P = c.P;
    const m = tm.moonNow, waxing = m.elong < 180, k = m.illumination / 100, rx = Math.abs(1 - 2 * k) * 36, lit = k > .5;
    const moonPath = waxing ? `M40,4 A36,36 0 0 1 40,76 A${rx},36 0 0 ${lit ? 1 : 0} 40,4` : `M40,4 A36,36 0 0 0 40,76 A${rx},36 0 0 ${lit ? 0 : 1} 40,4`;
    const today = new Date(tm.asOf + "T12:00");
    const prof = tm.profections ? tm.profections[tm.age] : null;
    const now = `<section class="env env-night" id="time"><div class="wrap"><div class="sec-head"><span class="roman">I</span><div class="label">The chart in motion</div><h2>Right <em>now</em></h2></div>
      <div class="now-grid"><div><div class="label">Sky for ${fd(tm.asOf)}</div><div class="moon-now"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36" fill="#1d3a42"/><path d="${moonPath}" fill="#f6efd9"/></svg><div data-c="astro"><b>${m.phase}</b><span>${m.illumination}% lit · Moon in ${m.sign}</span></div></div>
        <ul class="facts">${PLANETS.filter(n => n !== "Moon").map(n => `<li data-c="astro"><span><span class="g">${T(PG[n])}</span> ${n}</span><span>${Math.floor(tm.sky[n] % 30)}° ${E.signOf(tm.sky[n])}${tm.retroNow.includes(n) ? " · ℞" : ""}</span></li>`).join("")}</ul></div>
      <div><div class="label">Your transits today</div><ul class="tlist">${tm.transitsNow.map(t => `<li><span class="d">${t.orb}° orb</span><span data-c="calc">Transiting ${t.transit} <span class="g">${T(AG[t.type])}</span> your ${t.natal}</span></li>`).join("") || "<li><span></span><span>No slow-planet contacts within 2° today.</span></li>"}</ul>
        <div class="label" style="margin-top:30px">Transit windows, next twelve months <span class="muted" style="letter-spacing:0;text-transform:none;font-weight:500">(within 1°)</span></div>
        <ul class="tlist">${tm.windows.map(x => { const act = (!x.start || new Date(x.start + "T12:00") <= today) && (!x.end || new Date(x.end + "T12:00") >= today);
          return `<li class="win${act ? " now" : ""}"><span class="d">${act ? "Active now" : fd(x.start)}</span><span data-c="calc"><b>${x.transit} <span class="g">${T(AG[x.type])}</span> your ${x.natal}</b><span class="wline">Enters ${x.start ? fd(x.start) : "earlier"} · ${x.exact.length ? "exact " + x.exact.map(fd).join(" and ") : "closest approach"} · leaves ${x.end ? fd(x.end) : "later"}</span></span></li>`; }).join("") || "<li><span></span><span>No slow-planet transits within 1° this year.</span></li>"}</ul>
        <p class="annot">What matters astrologically isn't that a planet is retrograde, but whether it touches your chart.</p></div></div>
      <hr class="rule"><div class="spread"><div>${prof ? `<div class="label">Annual profection</div><h3>The <em>${ord(prof.house)}-house</em> year</h3><div id="profWheel"></div><p data-c="doctrine">Profections move the Ascendant forward one sign per year of life. At ${tm.age}, your profected year is the ${ord(prof.house)} house (${prof.sign}), so ${prof.lord} is Lord of the Year.</p>` : `<p class="muted">Profections and firdaria need a birth time.</p>`}</div>
      <div><div class="label">Time lords & progressions</div><h3>Who's <em>in charge</em> now</h3><ul class="facts big">${[
        ...(prof ? [["Lord of the Year", `${prof.lord} · ${ord(prof.house)}-house year`]] : []),
        ...(tm.firdNow ? [["Firdaria", `${tm.firdNow.major} period (ages ${tm.firdNow.from}–${tm.firdNow.to})${tm.firdNow.sub ? ` · ${tm.firdNow.sub} sub-period` : ""}`]] : []),
        ["Progressed Sun", `${tm.progressions.Sun.degree}° ${tm.progressions.Sun.sign}`], ["Progressed Moon", `${tm.progressions.Moon.degree}° ${tm.progressions.Moon.sign}`],
        ["Solar arc", `${tm.arc.toFixed(1)}°`], ["Next solar return", tm.solarReturn ? fd(tm.solarReturn) : "—"]].map(([a, b]) => `<li data-c="calc"><span>${a}</span><span>${esc(b)}</span></li>`).join("")}</ul>
        <p data-c="doctrine">Secondary progressions treat each day after birth as a year of life. ${tm.progEvents.filter(e => e.age <= tm.age).map(e => `${e.event} at ${e.age}.`).join(" ")}</p>
        <ul class="facts">${tm.solarArc.map(a => `<li data-c="calc"><span>Solar-arc ${a.directed} <span class="g">${T(AG[a.type])}</span> your ${a.natal}</span><span>${a.orb}°</span></li>`).join("")}</ul></div></div></div>${wave()}</section>`;

    const years = `<section class="env env-glass" id="years"><div class="wrap"><div class="sec-head"><span class="roman">II</span><div class="label">A life, in cycles</div><h2>Your <em>years</em></h2></div>
      <div class="filters" id="yearFilters" role="group" aria-label="Show cycles">${[["major", "Major cycles"], ["all", "Everything"], ["saturn", "Saturn"], ["jupiter", "Jupiter"], ["nodes", "Nodes"], ["prog", "Progressions"], ["firdaria", "Time lords"]].map(([k, l], i) => `<button data-y="${k}" aria-pressed="${i === 0}">${l}</button>`).join("")}</div>
      <div class="years" id="yearsLine"></div>
      <div class="scrub"><label for="ageRange"><span class="label">Scrub through a life</span> <b>Age <output id="ageOut">${tm.age}</output></b></label><input type="range" id="ageRange" min="0" max="80" value="${tm.age}"><div class="scrub-out" id="scrubOut" aria-live="polite"></div></div>
      <div class="year-detail" id="yearDetail" aria-live="polite"></div>
      <hr class="rule"><div class="spread"><div><div class="label">Put a date under the microscope</div><h3>What was the sky <em>doing</em>?</h3><p class="muted">Pick a date (a first day of college, a move, a first job) and see the techniques astrologers would examine around it. This shows how timing techniques are used; it doesn't mean the sky caused anything.</p>
        <label class="date-in"><span class="label">Date</span><input type="date" id="dateIn"></label></div><div class="lookup" id="lookup" aria-live="polite"></div></div></div>${wave()}</section>`;
    $("#w-timing").innerHTML = head("Understand now", "Tim", "ing", "Your natal chart is one moment. These techniques move it through time: what's active now, what's coming, and the long cycles of a life.") + now + years;

    // profection wheel
    if (prof) {
      const s = el("svg", { viewBox: "0 0 340 340", role: "img", "aria-label": "Annual profection wheel" }), cc = 170, r1 = 160, r0 = 70, hA = h => Math.PI + (h - 1) * Math.PI / 6, hp = (a, rr) => [cc + rr * Math.cos(a), cc - rr * Math.sin(a)];
      for (let h = 1; h <= 12; h++) {
        const on = h === prof.house, [x1, y1] = hp(hA(h) - Math.PI / 12, r1), [x2, y2] = hp(hA(h) + Math.PI / 12, r1), [x3, y3] = hp(hA(h) + Math.PI / 12, r0), [x4, y4] = hp(hA(h) - Math.PI / 12, r0);
        el("path", { d: `M${x1},${y1} A${r1},${r1} 0 0 0 ${x2},${y2} L${x3},${y3} A${r0},${r0} 0 0 1 ${x4},${y4} Z`, fill: on ? "#e3c27e" : "#fff", "fill-opacity": on ? .9 : .05, stroke: "#cfa95e", "stroke-opacity": .4 }, s);
        const sg = SIGNS[(SIGNS.indexOf(c.rising_sign) + h - 1) % 12], [lx, ly] = hp(hA(h), 138), [mx, my] = hp(hA(h), 100);
        const t1 = el("text", { x: lx, y: ly + 6, "text-anchor": "middle", "font-size": 16, fill: on ? "#071a20" : "#f3dfb3", class: "g" }, s); t1.textContent = T(SG[SIGNS.indexOf(sg)]);
        const t2 = el("text", { x: mx, y: my + 4, "text-anchor": "middle", "font-size": 10, fill: on ? "#071a20" : "#a8c3c0", "font-family": "DM Sans" }, s); t2.textContent = [h - 1, h + 11, h + 23].join(" · ");
      }
      const ct = el("text", { x: cc, y: cc + 4, "text-anchor": "middle", "font-size": 30, fill: "#f3dfb3", "font-family": "Cormorant Garamond, serif", "font-style": "italic" }, s); ct.textContent = tm.age;
      $("#profWheel").appendChild(s);
    }
    // events
    const by = new Date(S.chart.birthUTC).getUTCFullYear(), events = [];
    const clus = (dates, label, key) => { let last = -99; dates.forEach(d => { const y = +d.slice(0, 4); if (y - last > 2) events.push({ year: y, label, key, lane: 0 }); last = y; }); };
    clus(tm.returns.jupiter, "Jupiter return", "jupiter"); clus(tm.returns.saturn, "Saturn return", "saturn"); clus(tm.returns.nodal, "Nodal return", "nodal"); clus(tm.returns.nodal_opposition, "Nodal opposition", "nodal_opposition"); clus(tm.returns.uranus_opposition, "Uranus opposition", "uranus_opposition");
    tm.progEvents.forEach(e => events.push({ year: by + e.age, label: e.event, key: "prog", lane: 1 }));
    if (tm.firdaria) tm.firdaria.filter(f => f.from_age > 0).forEach(f => events.push({ year: by + f.from_age, label: `${f.lord} firdaria begins`, key: "firdaria", lane: 2 }));
    const NOTES = { jupiter: "Jupiter returns about every 12 years: traditionally a new cycle of growth and opportunity.", saturn: "Saturn returns about every 29.5 years: maturity, responsibility, restructuring.", nodal: "The lunar nodes return about every 18.6 years; modern astrologers link this to life direction.", nodal_opposition: "Halfway through the nodal cycle the nodes reverse over their natal places.", uranus_opposition: "Transiting Uranus opposes its natal place around 40–42, the classic midlife marker.", prog: "A progressed event (day-for-a-year).", firdaria: "A new firdaria period, with a new planetary time-lord." };
    const Wd = 1000, Ht = 250, x0 = 110, x1 = 980, Xs = y => x0 + (y - by) / 80 * (x1 - x0);
    const s = el("svg", { viewBox: `0 0 ${Wd} ${Ht}`, role: "img", "aria-label": "Life timeline" });
    [["Childhood", 0, 13], ["Teens", 13, 20], ["20s", 20, 30], ["30s", 30, 40], ["40s", 40, 50], ["50s", 50, 60], ["60s", 60, 70], ["70s", 70, 80]].forEach(([l, a, b], i) => { el("rect", { x: Xs(by + a), y: 26, width: Xs(by + b) - Xs(by + a), height: 152, fill: "currentColor", "fill-opacity": i % 2 ? .035 : 0 }, s); const t = el("text", { x: (Xs(by + a) + Xs(by + b)) / 2, y: 240, "text-anchor": "middle", "font-size": 12, fill: "currentColor", "fill-opacity": .75, "font-family": "Cormorant Garamond, serif", "font-style": "italic" }, s); t.textContent = l; });
    ["Returns", "Progressions", "Time lords"].forEach((l, i) => { el("line", { x1: x0, y1: 50 + i * 55, x2: x1, y2: 50 + i * 55, stroke: "currentColor", "stroke-opacity": .2 }, s); const t = el("text", { x: 0, y: 54 + i * 55, "font-size": 13, fill: "currentColor", "fill-opacity": .7, "font-family": "DM Sans" }, s); t.textContent = l.toUpperCase(); });
    for (let a = 10; a <= 80; a += 10) { const t = el("text", { x: Xs(by + a), y: 200, "text-anchor": "middle", "font-size": 13, fill: "currentColor", "fill-opacity": .7, "font-family": "DM Sans" }, s); t.textContent = by + a; }
    const nx = Xs(today.getFullYear()); el("line", { x1: nx, y1: 20, x2: nx, y2: 178, stroke: "#cfa95e", "stroke-width": 2 }, s); const ntl = el("text", { x: nx, y: 14, "text-anchor": "middle", "font-size": 11, fill: "#7f5f24", "font-family": "DM Sans", "font-weight": 700 }, s); ntl.textContent = "NOW";
    const scrubLine = el("line", { y1: 22, y2: 178, stroke: "#9a4862", "stroke-width": 2.5, "stroke-dasharray": "4 3" }, s);
    const counts = {}; events.forEach(e => counts[e.year] = (counts[e.year] || 0) + 1);
    const LC = ["#1d5a61", "#5f4d9a", "#9a4862"];
    events.forEach(e => { const g = el("g", { class: "mk", tabindex: 0, role: "button", "aria-label": `${e.year}: ${e.label}`, "data-key": e.key, "data-major": ["jupiter", "saturn", "nodal", "uranus_opposition"].includes(e.key) || e.label.includes("Sun enters") ? 1 : 0 }, s);
      if (counts[e.year] > 1) el("circle", { cx: Xs(e.year), cy: 50 + e.lane * 55, r: 14, fill: "none", stroke: "#cfa95e", "stroke-width": 1.5, "stroke-dasharray": "2 3" }, g);
      el("circle", { cx: Xs(e.year), cy: 50 + e.lane * 55, r: 7, fill: LC[e.lane], stroke: "#fff", "stroke-width": 1.5 }, g);
      g.onclick = () => { $("#ageRange").value = e.year - by; upd(); }; });
    $("#yearsLine").appendChild(s);
    const FK = { saturn: ["saturn"], jupiter: ["jupiter"], nodes: ["nodal", "nodal_opposition"], prog: ["prog"], firdaria: ["firdaria"] };
    const filt = f => { s.querySelectorAll(".mk").forEach(m => m.style.display = f === "all" || (f === "major" ? m.dataset.major === "1" : FK[f].includes(m.dataset.key)) ? "" : "none"); $$("#yearFilters button").forEach(b => b.setAttribute("aria-pressed", b.dataset.y === f)); };
    $$("#yearFilters button").forEach(b => b.onclick = () => filt(b.dataset.y)); filt("major");
    const seq7 = tm.firdaria ? tm.firdaria.slice(0, 7).map(x => x.lord) : [];
    function upd() {
      const age = +$("#ageRange").value, yr = by + age; $("#ageOut").textContent = age;
      scrubLine.setAttribute("x1", Xs(yr + .5)); scrubLine.setAttribute("x2", Xs(yr + .5));
      const pf = tm.profections ? tm.profections[age] : null;
      const f = tm.firdaria ? tm.firdaria.find(x => x.from_age <= age + .5 && age + .5 < x.to_age) : null;
      let sub = ""; if (f && seq7.includes(f.lord)) { const kk = Math.floor((age + .5 - f.from_age) / ((f.to_age - f.from_age) / 7)); sub = seq7[(seq7.indexOf(f.lord) + kk) % 7]; }
      const psun = E.signOf(c.P.Sun.lon + age);
      const MAJ = ["jupiter", "saturn", "nodal", "uranus_opposition"], nowEv = events.find(e => MAJ.includes(e.key) && (e.year === yr || (e.key === "saturn" && e.year === yr - 1)));
      const next = nowEv || events.filter(e => e.year > yr && MAJ.includes(e.key)).sort((a, b) => a.year - b.year)[0];
      $("#scrubOut").innerHTML = `${pf ? `<div data-c="calc"><small>Profection</small><b>${ord(pf.house)} house</b><span>${pf.sign} · Lord ${pf.lord}</span></div>` : ""}${f ? `<div data-c="calc"><small>Firdaria</small><b>${f.lord}</b><span>${sub ? sub + " sub-period" : ""}</span></div>` : ""}
        <div data-c="calc"><small>Progressed Sun</small><b>${psun}</b><span>about ${Math.round((c.P.Sun.lon + age) % 30)}°</span></div>
        <div data-c="calc"><small>${nowEv ? "Major return, now" : "Next major return"}</small><b>${next ? next.label : "—"}</b><span>${next ? `${next.year} · age ${next.year - by}` : ""}</span></div>`;
      const here = events.filter(e => e.year === yr);
      $("#yearDetail").innerHTML = `<div><div class="yr">${yr}</div><div class="annot">age ${age}</div></div><ul>${here.map(e => `<li data-c="calc"><b>${esc(e.label)}</b><br><span class="muted">${esc(NOTES[e.key])}</span></li>`).join("") || "<li class='muted'>No major cycle lands exactly this year.</li>"}${here.length > 1 ? `<li data-c="interp"><b>Why this year stands out</b><br><span class="muted">${here.length} separate timing techniques land in the same year. Astrologers treat convergence like this as a more significant period than any single signal.</span></li>` : ""}</ul>`;
    }
    $("#ageRange").oninput = upd; upd();
    // date lookup
    const natal = c.planets.map(p => [p.planet, p.lon]);
    const run = v => {
      if (!v) return; const d = new Date(v + "T12:00"), birth = new Date(S.chart.birthUTC);
      if (d < birth) { $("#lookup").innerHTML = "<p>Pick a date after your birth.</p>"; return; }
      const yrs = (d - birth) / (365.2422 * 864e5), age = Math.floor(yrs), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, pos = tm.monthly[key];
      const tr = []; if (pos) tm.slow.forEach((t, i) => natal.forEach(([n, l]) => [["conjunction", 0], ["sextile", 60], ["square", 90], ["trine", 120], ["opposition", 180]].forEach(([k, ang]) => { if (Math.abs(E.sep(pos[i], l) - ang) <= 2) tr.push(`${t} ${AG[k]} your ${n}`); })));
      const pf = tm.profections ? tm.profections[age] : null, f = tm.firdaria ? tm.firdaria.find(x => x.from_age <= yrs && yrs < x.to_age) : null;
      const near = events.filter(e => Math.abs(e.year - d.getFullYear()) <= 1);
      $("#lookup").innerHTML = `<ul>${pf ? `<li data-c="calc"><b>Age ${age}: ${ord(pf.house)}-house year</b><span>Profected sign ${pf.sign}; Lord of the Year ${pf.lord}. ${esc(L.HOUSE[pf.house].area)}.</span></li>` : `<li><b>Age ${age}</b></li>`}
        ${f ? `<li data-c="calc"><b>Firdaria: ${f.lord}</b><span>ages ${f.from_age}–${f.to_age}</span></li>` : ""}
        <li data-c="calc"><b>Slow-planet transits that month</b><span>${tr.join(" · ") || "None within 2°."}</span></li>${near.length ? `<li data-c="calc"><b>Nearby milestones</b><span>${near.map(e => `${e.label} (${e.year})`).join(" · ")}</span></li>` : ""}</ul><p class="annot">These are the layers an astrologer would examine. They describe the sky, not causes.</p>`;
    };
    $("#dateIn").min = c.input.date; $("#dateIn").onchange = e => run(e.target.value); $("#dateIn").value = tm.asOf; run(tm.asOf);
  }

  // ===================== COMPATIBILITY =====================
  const SIGNTXT = s => L.SIGN[s];
  const CTX = { romance: ["Romance", "as partners", "Say what you need out loud; don't assume your partner reads it the way you would."], friendship: ["Friendship", "as friends", "Protect the thing you most enjoy doing together."], family: ["Family", "in a family", "Separate the role (parent, sibling, child) from the person in it."], work: ["Work", "as colleagues", "Agree early on who owns which decision."] };
  const MV = { Cardinal: "start things", Fixed: "hold steady", Mutable: "adapt" };
  function signReading(a, b, ctx) {
    const ia = SIGNS.indexOf(a), ib = SIGNS.indexOf(b), k = Math.min((ib - ia + 12) % 12, (ia - ib + 12) % 12), ea = EL[ia % 4], eb = EL[ib % 4], ma = MOD[ia % 3], mb = MOD[ib % 3], cx = CTX[ctx];
    const rel = [["Same sign", `You recognise each other instantly ${cx[1]}: same element, same mode, same instincts.`, "With so much in common, you can reinforce each other's habits without a counterweight."],
      ["Neighbouring signs", `Different elements and modes, but each picks up where the other leaves off ${cx[1]}.`, `You approach things from genuinely different angles (${ea} and ${eb}); it takes translation.`],
      ["Sextile", `Compatible elements (${ea} and ${eb}): conversation flows and you energise each other ${cx[1]}.`, `Different modes (${ma} and ${mb}) mean different pacing.`],
      ["Square", `You share a ${ma.toLowerCase()} mode, so you both ${MV[ma]} and understand each other's drive.`, `Your elements (${ea} and ${eb}) pull instincts in different directions: friction that also creates momentum.`],
      ["Trine", `Same element (${ea}): a shared basic outlook and real ease ${cx[1]}.`, "Ease can settle into comfort; growth may need a push from outside."],
      ["Quincunx", "Nothing in common by element or mode, so understanding takes deliberate effort, and often rewards it with genuine surprise.", `${ea} and ${eb}: you rarely assume the same thing.`],
      ["Opposite signs", `Magnetic and mirroring: you share a ${ma.toLowerCase()} mode, and each has what the other lacks.`, "You see the same situation from opposite ends."]][k];
    return { name: rel[0], rows: [["Where you naturally click", rel[1]], ["Where you differ", rel[2]], ["What each may need", `${a} tends to need ${SIGNTXT(a).need}; ${b} tends to need ${SIGNTXT(b).need}.`], ["Where misunderstandings happen", `${a} can be read ${SIGNTXT(a).misread}; ${b} can be read ${SIGNTXT(b).misread}.`], ["What makes it work", `Lean on ${a}'s ${SIGNTXT(a).gift} and ${b}'s ${SIGNTXT(b).gift}. ${cx[2]}`]] };
  }
  const FN = { Sun: "sense of self", Moon: "feelings and needs", Mercury: "way of thinking and talking", Venus: "affection and taste", Mars: "drive and directness", Jupiter: "generosity and growth", Saturn: "sense of duty and structure", Uranus: "need for independence", Neptune: "ideals and imagination", Pluto: "intensity and depth" };
  const ASKS = { Sun: "recognition of who they are", Moon: "emotional understanding", Mercury: "to be heard", Venus: "affection shown their way", Mars: "room to act", Jupiter: "room to grow", Saturn: "respect for their commitments", Uranus: "freedom", Neptune: "room to dream", Pluto: "depth and honesty" };
  const VERB = { conjunction: "fuses with", trine: "flows easily with", sextile: "cooperates with", square: "rubs against", opposition: "pulls against, and mirrors," };
  const OUTER = ["Uranus", "Neptune", "Pluto"], PERS = ["Sun", "Moon", "Mercury", "Venus", "Mars"];
  const rank = x => x.orb + (OUTER.includes(x.a) || OUTER.includes(x.b) ? 3 : 0) - (PERS.includes(x.a) && PERS.includes(x.b) ? 1.5 : 0);
  function cross(A, B) {
    const out = [];
    A.planets.forEach(a => B.planets.forEach(b => { if (OUTER.includes(a.planet) && OUTER.includes(b.planet)) return; const s = E.sep(a.lon, b.lon), lim = ["Sun", "Moon"].includes(a.planet) || ["Sun", "Moon"].includes(b.planet) ? 8 : OUTER.includes(a.planet) || OUTER.includes(b.planet) ? 4 : 6;
      [["conjunction", 0], ["sextile", 60], ["square", 90], ["trine", 120], ["opposition", 180]].forEach(([type, ang]) => { const o = Math.abs(s - ang); if (o <= lim) out.push({ a: a.planet, b: b.planet, type, orb: Math.round(o * 10) / 10 }); }); }));
    return out.sort((x, y) => rank(x) - rank(y));
  }
  const RELS = { partner: ["Partner", "romance"], dating: ["Someone I'm dating", "romance"], friend: ["Friend", "friend"], parent: ["Parent", "family"], sibling: ["Sibling", "family"], coworker: ["Coworker", "work"], other: ["Other", "friend"] };
  const has = (x, ...n) => n.includes(x.a) || n.includes(x.b), tone = x => TONE[x.type];
  const DIMS = {
    romance: [["Emotional rhythm", x => has(x, "Moon")], ["Attraction", x => (has(x, "Venus") && has(x, "Mars", "Sun", "Moon", "Venus")) || (x.a === "Mars" && x.b === "Venus")], ["Communication", x => has(x, "Mercury")], ["What feels effortless", x => tone(x) === "flow"], ["What requires translation", x => tone(x) === "tension" && has(x, "Mars", "Saturn", "Pluto", "Uranus", "Mercury")], ["Commitment themes", x => has(x, "Saturn") && has(x, "Sun", "Moon", "Venus", "Mars")]],
    friend: [["Communication", x => has(x, "Mercury")], ["Fun & energy", x => tone(x) !== "tension" && has(x, "Jupiter", "Mars", "Sun", "Venus", "Uranus")], ["Trust", x => has(x, "Saturn", "Moon") && tone(x) !== "tension"], ["Emotional support", x => has(x, "Moon") && has(x, "Venus", "Moon", "Jupiter", "Sun")], ["Where you may exhaust each other", x => tone(x) === "tension" && has(x, "Mars", "Uranus", "Saturn", "Mercury")]],
    family: [["Communication", x => has(x, "Mercury")], ["Authority & expectations", x => has(x, "Saturn", "Sun") && has(x, "Saturn", "Sun", "Moon", "Mars")], ["Emotional understanding", x => has(x, "Moon")], ["Independence", x => has(x, "Uranus", "Mars") && has(x, "Sun", "Moon", "Venus", "Mars", "Saturn")], ["Where conflict escalates", x => tone(x) === "tension" && has(x, "Mars", "Saturn", "Pluto")], ["Common ground", x => tone(x) === "flow"]],
    work: [["Communication", x => has(x, "Mercury")], ["Work styles", x => has(x, "Mars", "Saturn", "Mercury") && has(x, "Mars", "Saturn", "Mercury", "Sun")], ["Ambition", x => has(x, "Sun", "Saturn", "Jupiter") && has(x, "Sun", "Saturn", "Jupiter", "Mars")], ["Ease", x => tone(x) === "flow"], ["Friction", x => tone(x) === "tension"]],
  };
  const QS = [["butt", "Why do we butt heads?", x => tone(x) === "tension" && has(x, "Mars", "Saturn", "Mercury", "Sun", "Moon", "Pluto", "Uranus")], ["easy", "Why do we get along so easily?", x => tone(x) === "flow" || (x.type === "conjunction" && has(x, "Venus", "Jupiter", "Moon", "Sun"))], ["misunderstood", "Why do I feel misunderstood by them?", x => has(x, "Mercury", "Moon") && tone(x) === "tension"], ["drawn", "Why am I so drawn to them?", x => ["conjunction", "opposition", "trine"].includes(x.type) && has(x, "Venus", "Mars", "Sun", "Moon", "Pluto", "Neptune")], ["talk", "Where do we communicate differently?", x => has(x, "Mercury")], ["bringsout", "What does this relationship bring out in me?", x => PERS.includes(x.a)]];
  const poss = w => w === "You" ? "Your" : `${w}'s`;
  const sent = (x, an, bn) => `${poss(an)} ${x.a} (${FN[x.a]}) ${VERB[x.type]} ${poss(bn)} ${x.b} (${FN[x.b]}), ${x.orb}° from exact.`;
  function cityPicker(root) {
    const inp = root.querySelector(".cp-in"), ul = root.querySelector(".cp-list"); let res = [];
    inp.addEventListener("focus", loadCities);
    inp.addEventListener("input", async () => { root.dataset.place = ""; const q = fold(inp.value.trim()); if (q.length < 2) { ul.hidden = true; return; } const d = await loadCities(), [cq, ...rest] = q.split(",").map(x => x.trim()), ex = rest.join(" ");
      res = []; for (const r of d.rows) { if ((fold(r[0]).startsWith(cq) || (r[7] && fold(r[7]).startsWith(cq))) && (!ex || fold(`${r[1]} ${country(r[2])}`).includes(ex))) { res.push(r); if (res.length >= 8) break; } }
      ul.innerHTML = res.map((r, i) => `<li data-i="${i}"><b>${esc(r[0])}</b><span>${esc([r[1], country(r[2])].filter(Boolean).join(", "))}</span></li>`).join("") || "<li class='none'>No match. Try the nearest larger city.</li>"; ul.hidden = false; });
    ul.addEventListener("mousedown", async e => { const li = e.target.closest("li[data-i]"); if (!li) return; e.preventDefault(); const r = res[+li.dataset.i], d = await loadCities(); inp.value = `${r[0]}, ${[r[1], country(r[2])].filter(Boolean).join(", ")}`; root.dataset.place = JSON.stringify({ lat: r[3], lon: r[4], tz: d.tz[r[5]], label: inp.value }); ul.hidden = true; });
    inp.addEventListener("blur", () => setTimeout(() => ul.hidden = true, 150));
  }
  S.renderCompat = () => {
    if (S.rendered.compat) return; S.rendered.compat = true;
    const c = S.chart;
    const pf = (id, t, me) => `<fieldset class="pf" id="${id}"><legend>${t}</legend>${me ? `<label class="me-toggle"><input type="checkbox" class="useMe" checked> Use my chart${c.name ? ` (${esc(c.name)})` : ""}</label>` : ""}<div class="pf-fields" ${me ? "hidden" : ""}>
      <label><span class="label">Name (optional)</span><input class="nm" type="text" maxlength="30" placeholder="${me ? "Me" : "Them"}"></label><label><span class="label">Birth date</span><input class="dt" type="date" min="1900-01-01" max="2100-12-31"></label>
      <label><span class="label">Birth time</span><input class="tm" type="time"><span class="unk"><input type="checkbox" class="noTime"> Unknown</span></label>
      <div class="cp"><label><span class="label">Birthplace</span><input class="cp-in" type="text" placeholder="Start typing a city…"></label><ul class="cp-list place-list" hidden></ul></div></div></fieldset>`;
    $("#w-compat").innerHTML = head("Understand us", "Compat", "ibility", "Start with Sun signs, then compare two full charts. The relationship type changes the questions: a parent isn't a partner.") +
      `<section class="env env-shell" id="signs-compat"><div class="wrap"><div class="sec-head"><span class="roman">I</span><div class="label">Layer one · Sun signs</div><h2>Sign <em>compatibility</em></h2></div>
        <div class="sc-controls"><label><span class="label">Sign one</span><select id="scA">${SIGNS.map(x => `<option ${x === c.sun_sign ? "selected" : ""}>${x}</option>`).join("")}</select></label><span class="plus">+</span>
        <label><span class="label">Sign two</span><select id="scB">${SIGNS.map(x => `<option>${x}</option>`).join("")}</select></label><div class="ctx">${Object.entries(CTX).map(([k, v], i) => `<button data-c="${k}" aria-selected="${i === 0}">${v[0]}</button>`).join("")}</div></div><div id="scOut" aria-live="polite"></div></div>${wave()}</section>
      <section class="env env-night" id="full-compat"><div class="wrap"><div class="sec-head"><span class="roman">II</span><div class="label">Layer two · full charts</div><h2>Compare two <em>charts</em></h2></div>
        <p class="lede" style="margin:-20px 0 24px">Enter someone's birth details to see where your charts actually interact. <span class="priv">🔒 Their details stay on this device: calculated in your browser, never uploaded or saved.</span></p>
        <form class="fc-form" id="fcForm">${pf("pA", "Person one", true)}${pf("pB", "Person two", false)}
          <div class="fc-rel"><span class="label">Who are they to you?</span><div class="rels">${Object.entries(RELS).map(([k, v], i) => `<label><input type="radio" name="rel" value="${k}" ${i === 0 ? "checked" : ""}> ${v[0]}</label>`).join("")}</div></div>
          <button class="go" type="submit">Compare our charts</button><p class="fc-err" id="fcErr" role="alert"></p></form><div id="fcOut" aria-live="polite"></div></div></section>`;
    let ctx = "romance";
    const draw = () => { const a = $("#scA").value, b = $("#scB").value, r = signReading(a, b, ctx);
      $("#scOut").innerHTML = `<div class="sc-head"><span class="g">${T(SG[SIGNS.indexOf(a)])}</span> ${a} <i>&</i> ${b} <span class="g">${T(SG[SIGNS.indexOf(b)])}</span><small>${r.name} · ${CTX[ctx][0]}</small></div><dl class="sc-rows" data-c="doctrine">${r.rows.map(([q, t]) => `<dt>${q}</dt><dd>${esc(t)}</dd>`).join("")}</dl><p class="sc-note">Sun signs are only one layer; a chart has ten planets. <a href="#full-compat">Compare your full charts ↓</a></p>`; };
    $$("#scA, #scB").forEach(x => x.onchange = draw); $$(".ctx button").forEach(b => b.onclick = () => { ctx = b.dataset.c; $$(".ctx button").forEach(x => x.setAttribute("aria-selected", x === b)); draw(); }); draw();
    $$(".pf .cp").forEach(cityPicker);
    $(".useMe").onchange = e => $("#pA .pf-fields").hidden = e.target.checked;
    $$(".noTime").forEach(x => x.onchange = () => { const t = x.closest("label").querySelector(".tm"); t.disabled = x.checked; if (x.checked) t.value = ""; });
    const read = fs => { const q = s => fs.querySelector(s); if (!q(".dt").value) throw new Error("Add a birth date."); const pl = fs.querySelector(".cp").dataset.place; if (!pl) throw new Error("Choose a birthplace from the list."); return E.build({ name: q(".nm").value.trim(), date: q(".dt").value, time: q(".noTime").checked ? "" : q(".tm").value, place: JSON.parse(pl), houseSystem: "whole" }); };
    $("#fcForm").onsubmit = e => { e.preventDefault(); $("#fcErr").textContent = ""; let A, B; try { A = $(".useMe").checked ? S.chart : read($("#pA")); B = read($("#pB")); } catch (x) { $("#fcErr").textContent = x.message; return; } compare(A, B, $("input[name=rel]:checked").value); };
  };
  function compare(A, B, rel) {
    const an = A.name || (A === S.chart ? "You" : "Person one"), bn = B.name || "Person two", grp = RELS[rel][1], xs = cross(A, B);
    const sr = signReading(A.sun_sign, B.sun_sign, grp === "romance" ? "romance" : grp === "family" ? "family" : grp === "work" ? "work" : "friendship");
    const dims = DIMS[grp].map(([l, f]) => [l, xs.filter(f)]);
    const summ = l => { if (!l.length) return "No strong contacts here, so this area relies on other parts of the two charts."; const f = l.filter(x => tone(x) === "flow").length, t = l.filter(x => tone(x) === "tension").length; return f > t * 1.5 ? "Mostly easy. The contacts here are supportive." : t > f * 1.5 ? "Mostly friction. That's energy, not a verdict: it's where you push each other." : `Mixed: ${f} easy, ${t} challenging. Both are real.`; };
    const ov = A.timeKnown ? B.planets.filter(p => PERS.includes(p.planet)).map(p => `${bn}'s ${p.planet} falls in ${an === "You" ? "your" : an + "'s"} ${ord(((SIGNS.indexOf(p.sign) - SIGNS.indexOf(A.rising_sign) + 12) % 12) + 1)} house`) : [];
    $("#fcOut").innerHTML = `<div class="fc-res"><div class="fc-top"><div><div class="label">${esc(RELS[rel][0])}</div><h3>${esc(an)} <em>&</em> ${esc(bn)}</h3>
      <p class="fc-suns"><span class="g">${T(SG[SIGNS.indexOf(A.sun_sign)])}</span> ${A.sun_sign} Sun · <span class="g">${T(SG[SIGNS.indexOf(B.sun_sign)])}</span> ${B.sun_sign} Sun · ${sr.name.toLowerCase()}</p>
      <p>${xs.length} contacts between the two charts: ${xs.filter(x => tone(x) === "flow").length} easy, ${xs.filter(x => tone(x) === "tension").length} challenging, ${xs.filter(x => tone(x) === "blend").length} fused. No compatibility score: astrology doesn't have a valid one, so you see the contacts instead.</p>
      ${!B.timeKnown ? `<p class="muted">${esc(bn)}'s birth time is unknown, so their rising sign and houses aren't used${B.moonUncertain ? ", and their Moon may be in either of two signs that day" : ""}.</p>` : ""}</div><div class="fc-wheel" id="fcWheel"></div></div>
      <div class="label" style="margin-top:30px">Ask about this relationship</div><div class="fc-q">${QS.map(([k, q]) => `<button data-q="${k}">${q}</button>`).join("")}</div><div class="fc-ans" id="fcAns" aria-live="polite"></div>
      <div class="label" style="margin-top:36px">Dimensions</div><div class="fc-dims">${dims.map(([l, list], i) => `<article><div class="lh"><b>${esc(l)}</b></div><p>${esc(summ(list))}</p>${list.length ? `<ul>${list.slice(0, 3).map(x => `<li class="${tone(x)}">${esc(sent(x, an, bn))}</li>`).join("")}</ul><button class="why-btn" data-d="${i}">Show on both charts ↗</button>` : ""}</article>`).join("")}</div>
      ${ov.length ? `<div class="label" style="margin-top:30px">Where ${esc(bn)} lands in ${an === "You" ? "your" : esc(an) + "'s"} chart (whole-sign houses)</div><p class="muted">${esc(ov.join(" · "))}.</p>` : ""}
      <p class="muted" style="margin-top:24px">Astrologically, these are the chart dynamics traditionally associated with each question; people are more complicated than charts.</p></div>`;
    const wheelFor = hl => { const box = $("#fcWheel"); box.innerHTML = ""; box.appendChild(drawWheel({ inner: A.planets.map(p => ({ n: p.planet, lon: p.lon })), outer: B.planets.map(p => ({ n: p.planet, lon: p.lon })), aspects: xs.map(x => ({ a: x.a, b: x.b, type: x.type, cross: true, hl: hl && hl.includes(x) })), centreSign: A.timeKnown ? Math.floor(A.asc / 30) : 0, highlight: hl ? [...new Set(hl.flatMap(x => [x.a, "o:" + x.b]))] : null, size: 520, ascLabel: A.timeKnown }));
      box.insertAdjacentHTML("beforeend", `<p class="fc-key"><span class="dot in"></span> ${esc(an)} (inner) <span class="dot out"></span> ${esc(bn)} (outer)</p>`); };
    wheelFor(null);
    $$(".fc-q button").forEach(b => b.onclick = () => { const [k, q, f] = QS.find(x => x[0] === b.dataset.q), list = xs.filter(f), top = list.slice(0, 4);
      $$(".fc-q button").forEach(x => x.setAttribute("aria-pressed", x === b));
      const lead = { butt: grp === "family" ? `Forget the Sun-sign stereotype: in a ${RELS[rel][0].toLowerCase()} relationship, these are the contacts where your charts push against each other.` : "Forget the Sun-sign stereotype. These are the contacts where your charts actually push against each other.", easy: "These contacts are traditionally read as natural ease: things you don't have to work at.", misunderstood: "Misunderstanding usually shows up in Mercury (how you think and talk) and the Moon (what you feel and need).", drawn: "Attraction and fascination tend to come from conjunctions, oppositions and trines involving the personal planets.", talk: "Mercury describes how each person thinks and talks; its contacts show where you translate for each other.", bringsout: `Here's what ${bn}'s planets touch in ${an === "You" ? "your" : an + "'s"} chart.` }[k];
      $("#fcAns").innerHTML = `<h4>${esc(q)}</h4><p>${esc(lead)}</p>${k === "butt" && top[0] ? `<p><b>What ${esc(an === "You" ? "you" : an)} may be asking for:</b> ${ASKS[top[0].a]}. <b>What ${esc(bn)} may hear instead:</b> a challenge to their ${FN[top[0].b]}.</p>` : ""}${top.length ? `<ul>${top.map(x => `<li class="${tone(x)}">${esc(sent(x, an, bn))}</li>`).join("")}</ul><button class="why-btn" id="ansWhy">Show on both charts ↗</button>` : "<p class='muted'>No contacts of this kind within orb.</p>"}`;
      $("#ansWhy")?.addEventListener("click", () => { wheelFor(top); $("#fcWheel").scrollIntoView({ block: "center", behavior: "smooth" }); }); });
    $$(".fc-dims .why-btn").forEach(b => b.onclick = () => { wheelFor(dims[+b.dataset.d][1].slice(0, 3)); $("#fcWheel").scrollIntoView({ block: "center", behavior: "smooth" }); });
    $("#fcOut").scrollIntoView({ block: "start", behavior: "smooth" });
  }

  // ===================== LEARN =====================
  const WHAT = Object.fromEntries(PLANETS.map(n => [n, L.PLANET[n].what]));
  S.renderLearn = () => {
    if (S.rendered && S.rendered.learn) return; (S.rendered = S.rendered || {}).learn = true;
    $("#w-learn").innerHTML = head("Understand astrology", "Le", "arn", "Enough astrology to read your own chart, taught by doing: build a placement, turn an angle, walk the houses.") +
      `<section class="env env-pearl" id="layers"><div class="wrap"><div class="label">Read the seams</div><h2 class="layers-h">Astronomy calculates the sky. Mathematics builds the chart. Astrology interprets it.</h2>
        <div class="layer-row">${L.LAYERS.map(([ic, n, tag, t], i) => `<div data-c="${["astro", "calc", "interp"][i]}"><span class="ic">${ic}</span><b>${n}</b><small>${tag}</small><p>${t}</p></div>`).join("")}</div></div>${wave()}</section>
      <section class="env env-glass" id="learn-play"><div class="wrap"><div class="sec-head"><span class="roman">I</span><div class="label">The grammar of a chart</div><h2>Build a <em>placement</em></h2></div>
        <div class="gram"><label><span class="label">Planet = what</span><select id="gP">${PLANETS.map(n => `<option ${n === "Moon" ? "selected" : ""} value="${n}">${T(PG[n])} ${n}</option>`).join("")}</select></label>
        <label><span class="label">Sign = how</span><select id="gS">${SIGNS.map(s => `<option ${s === "Gemini" ? "selected" : ""} value="${s}">${T(SG[SIGNS.indexOf(s)])} ${s}</option>`).join("")}</select></label>
        <label><span class="label">House = where</span><select id="gH">${[...Array(12)].map((_, i) => `<option ${i === 10 ? "selected" : ""} value="${i + 1}">${ord(i + 1)} house</option>`).join("")}</select></label>
        <label><span class="label">Aspect = relationship</span><select id="gA"><option value="">none</option>${Object.keys(L.ASPECT).map(a => `<option ${a === "square" ? "selected" : ""}>${a}</option>`).join("")}</select></label>
        <label><span class="label">…to</span><select id="gB">${PLANETS.map(n => `<option ${n === "Mars" ? "selected" : ""} value="${n}">${T(PG[n])} ${n}</option>`).join("")}</select></label></div>
        <div id="gOut" aria-live="polite"></div>${S.chart ? `<p class="gram-tools"><button id="gMine">Load a placement from my chart</button></p>` : ""}
        <hr class="rule"><div class="spread"><div><div class="label">Aspects are angles</div><h3>Turn the <em>angle</em></h3><div id="angleToy"></div></div><div><div class="label">Twelve houses, one wheel</div><h3>Walk the <em>houses</em></h3><div id="houseToy"></div></div></div></div>${wave()}</section>
      <section class="env env-pearl" id="atlas"><div class="wrap"><div class="sec-head"><span class="roman">II</span><div class="label">Where it came from</div><h2>The <em>atlas</em></h2></div>
        <ol class="history">${L.HISTORY.map(([w, wh, t]) => `<li data-c="doctrine"><div class="when">${w}</div><div><b>${wh}</b><p>${t}</p></div></li>`).join("")}</ol>
        <hr class="rule"><div class="label">Chart debugger</div><h3 class="dbg-h">Why do two websites give me <em>different answers?</em></h3><div class="debug">${L.DEBUG.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>
        <p class="note"><b>What science says</b>${L.EVIDENCE} Astronomy calculates the sky; astrology interprets it. This site shows both, and labels which is which.</p></div>${wave()}</section>`;
    const REL = { conjunction: "fused with", sextile: "supported by", square: "in productive friction with", trine: "flowing easily with", opposition: "balancing against" };
    const draw = () => { const p = $("#gP").value, s = $("#gS").value, h = +$("#gH").value, a = $("#gA").value, b = $("#gB").value; $("#gB").disabled = !a;
      $("#gOut").innerHTML = `<div class="gnote"><span class="g">${T(PG[p])}</span> ${p} in <span class="g">${T(SG[SIGNS.indexOf(s)])}</span> ${s} in the ${ord(h)} house${a ? ` <span class="g">${T(AG[a])}</span> ${b}` : ""}</div>
        <ol class="gsteps"><li data-c="astro"><b>${p}</b><span>what: ${WHAT[p]}</span><small>Astronomy</small></li><li data-c="calc"><b>${s}</b><span>how: ${L.SIGN[s].how}</span><small>Convention: the zodiac</small></li><li data-c="calc"><b>${ord(h)} house</b><span>where: ${L.HOUSE[h].area}</span><small>Convention: houses</small></li>${a ? `<li data-c="calc"><b>${a} ${b}</b><span>relationship: ${REL[a]} ${WHAT[b]}</span><small>Geometry</small></li>` : ""}</ol>
        <p class="gsentence" data-c="interp">Read together: ${WHAT[p]}, expressed ${L.SIGN[s].how}, shows up in ${L.HOUSE[h].area}${a ? `, ${REL[a]} ${WHAT[b]}` : ""}.</p>`; };
    $$(".gram select").forEach(x => x.onchange = draw); draw();
    $("#gMine")?.addEventListener("click", () => { const x = S.chart.major[0]; $("#gP").value = x.a; $("#gS").value = S.chart.P[x.a].sign; $("#gH").value = S.chart.P[x.a].house || 1; $("#gA").value = x.type; $("#gB").value = x.b; draw(); });
    // angle toy
    const at = $("#angleToy"); at.innerHTML = `<svg viewBox="0 0 320 320" class="toy"></svg><label class="rng"><span class="label">Separation</span><input type="range" id="ang" min="0" max="180" value="90"><output id="angOut">90°</output></label><p class="toy-out" id="angRes"></p>`;
    const sv = at.querySelector("svg"), cx = 160, cy = 160, r = 120; el("circle", { cx, cy, r, fill: "none", stroke: "currentColor", "stroke-opacity": .25 }, sv);
    const line = el("line", { x1: cx - r, y1: cy, "stroke-width": 3 }, sv), A = el("circle", { cx: cx - r, cy, r: 16, fill: "#fbf6ee", stroke: "#cfa95e" }, sv), B = el("circle", { r: 16, fill: "#fbf6ee", stroke: "#cfa95e" }, sv);
    const upd = () => { const d = +$("#ang").value, a = Math.PI - d * Math.PI / 180, x = cx + r * Math.cos(a), y = cy - r * Math.sin(a); B.setAttribute("cx", x); B.setAttribute("cy", y); line.setAttribute("x2", x); line.setAttribute("y2", y);
      const hit = [["conjunction", 0], ["sextile", 60], ["square", 90], ["trine", 120], ["opposition", 180]].map(([k, v]) => [k, Math.abs(d - v)]).sort((p, q) => p[1] - q[1])[0], on = hit[1] <= (hit[0] === "sextile" ? 5 : 8);
      line.setAttribute("stroke", on ? TONEC[TONE[hit[0]]] : "#8a9a9a"); line.setAttribute("stroke-dasharray", on ? "" : "4 6"); $("#angOut").textContent = d + "°";
      $("#angRes").innerHTML = on ? `<b style="color:${TONEC[TONE[hit[0]]]}">${T(AG[hit[0]])} ${hit[0]}</b>${hit[1] ? `${hit[1]}° from exact. ` : "Exact. "}${L.ASPECT[hit[0]].about[0].toUpperCase() + L.ASPECT[hit[0]].about.slice(1)}.` : "No major aspect at this angle. Astrologers only name certain angles, allowing a few degrees either side (the orb)."; };
    $("#ang").oninput = upd; upd();
    // house toy
    const ht = $("#houseToy"); ht.innerHTML = `<svg viewBox="0 0 320 320" class="toy"></svg><div class="toy-out" id="hRes"></div>`;
    const hs = ht.querySelector("svg"), c2 = 160, r1 = 150, r0 = 56, hA = h => Math.PI + (h - 1) * Math.PI / 6, hp = (a, rr) => [c2 + rr * Math.cos(a), c2 - rr * Math.sin(a)], wedges = [];
    for (let h = 1; h <= 12; h++) { const [x1, y1] = hp(hA(h) - Math.PI / 12, r1), [x2, y2] = hp(hA(h) + Math.PI / 12, r1), [x3, y3] = hp(hA(h) + Math.PI / 12, r0), [x4, y4] = hp(hA(h) - Math.PI / 12, r0), g = el("g", { class: "hw", tabindex: 0, role: "button" }, hs);
      el("path", { d: `M${x1},${y1} A${r1},${r1} 0 0 0 ${x2},${y2} L${x3},${y3} A${r0},${r0} 0 0 1 ${x4},${y4} Z`, fill: [1, 4, 7, 10].includes(h) ? "#e3c27e" : "#6fc1bb", "fill-opacity": .18, stroke: "currentColor", "stroke-opacity": .3 }, g);
      const [lx, ly] = hp(hA(h), (r1 + r0) / 2), t = el("text", { x: lx, y: ly + 6, "text-anchor": "middle", "font-size": 18, fill: "currentColor", "font-family": "Cormorant Garamond, serif", "font-style": "italic" }, g); t.textContent = ROMAN[h - 1];
      const pick = () => { wedges.forEach((w, i) => w.querySelector("path").setAttribute("fill-opacity", i === h - 1 ? .7 : .18)); const here = S.chart && S.chart.timeKnown ? S.chart.houses[h - 1].planets : null;
        $("#hRes").innerHTML = `<b>${ord(h)} house · ${L.HOUSE[h].name}</b><span data-c="doctrine">${L.HOUSE[h].area[0].toUpperCase() + L.HOUSE[h].area.slice(1)}. Ancient name: ${L.HOUSE[h].ancient}. ${[1, 4, 7, 10].includes(h) ? "An angle" : [2, 5, 8, 11].includes(h) ? "Follows an angle" : "Falls away from an angle"}; ${L.TO_ASC[h]}.</span>${here ? `<small>In your chart: ${here.length ? here.map(n => `${T(PG[n])} ${n}`).join(", ") : "no planets"}</small>` : ""}`; };
      g.onmouseenter = pick; g.onclick = pick; g.onfocus = pick; wedges.push(g); }
    wedges[0].onclick();
    S.paintSeams();
  };

  // ===================== REPORT =====================
  S.renderReport = () => {
    const c = S.chart, r = S.reading, tm = getTiming(), P = c.P, Tk = c.timeKnown;
    let ch = 0; const chap = (t, sub) => `<div class="chap"><span class="rn">${ROMAN[ch++]}</span><div><div class="kicker">${sub}</div><h2>${t}</h2></div></div>`;
    const page = (folio, html, cls = "") => `<section class="page ${cls}" data-folio="Celestial · ${esc(folio)}">${html}</section>`;
    const dotsTxt = n => { const w = n >= 5 ? 4 : n >= 3 ? 3 : n === 2 ? 2 : 1; return "●".repeat(w) + "○".repeat(4 - w); };
    const wheel = theme => drawWheel({ inner: c.planets.map(p => ({ n: p.planet, lon: p.lon })), aspects: c.major, centreSign: Tk ? Math.floor(c.asc / 30) : 0, theme, size: 640, ascLabel: Tk }).outerHTML;
    const who = c.name ? esc(c.name) : "Your chart";
    const out = [];
    out.push(page("Cover", `<div><div class="kicker">A Western natal chart · full report</div><h1>${c.name ? esc(c.name) : "Celestial"}</h1><p class="tag">Your birth chart, a little less sciency.</p></div><div class="wheel">${wheel("dark")}</div>
      <div><div class="b3">${[["☉ Sun", c.sun_sign], ["☽ Moon", c.moon_sign], ...(Tk ? [["↑ Rising", c.rising_sign]] : [])].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join("")}</div>
      <p class="foot">${esc(new Date(c.input.date + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}${Tk ? ", " + esc(c.input.time) : " (time unknown)"} · ${esc(c.input.placeLabel)} · Tropical zodiac${c.houseSystem ? " · " + c.houseSystem + " houses" : ""}. ${L.FRAMING}</p></div>`, "cover"));
    out.push(page("At a glance", chap("At a <em>glance</em>", "Headline findings") + `<div class="glance">${r.glance.map(g => `<div><small>${esc(g.label)}</small><b>${esc(g.value)}</b><div class="ev">${esc(g.note)}</div></div>`).join("")}</div>
      <h4>If you remember five things</h4><ol class="five">${r.five.map(f => `<li>${esc(f.text)} <span class="dots">${dotsTxt(f.evidence.length)}</span><span class="ev">${esc(f.evidence.join(" · "))}</span></li>`).join("")}</ol>
      <h4>What stands out</h4>${r.wait.map(w => `<div class="item"><b class="t">${esc(w.title)}</b><p>${esc(w.text)}</p>${w.not ? `<p class="ev">${esc(w.not.join(" "))} Compensations: ${esc(w.compensates.join(" · "))}</p>` : ""}</div>`).join("")}`));
    const B = r.big;
    out.push(page("The Big Three", chap("The Big <em>Three</em>", "Sun · Moon · Rising") + ["sun", "moon", "rising"].filter(k => B[k]).map(k => `<h3>${esc(B[k].title)} · <em>${esc(B[k].line)}</em></h3><p>${esc(B[k].text)}</p>`).join("") +
      `<h4>When they agree</h4><p>${esc(B.agree)}</p><h4>When they fight</h4><p>${B.fight.map(([a, b]) => `<b>${esc(a)}</b> ${esc(b)}.`).join(" ")} <em>${esc(B.result)}</em></p>${B.wiring.map(([a, b]) => `<p><b>${esc(a)}.</b> ${esc(b)}</p>`).join("")}`));
    out.push(page("The portrait", chap("The <em>portrait</em>", "Themes & contradictions") + `<h4>Main characters</h4><table><tr><th>#</th><th>Planet</th><th>Points</th><th>Why</th></tr>${r.cast.map((x, i) => `<tr><td>${i + 1}</td><td>${x.n}</td><td>${x.pts}</td><td class="ev">${esc(x.why.join(" · "))}</td></tr>`).join("")}</table>
      <h4>What repeats</h4><div class="cols">${r.themes.map(t => `<div class="item"><b class="t">${esc(t.label)} ×${t.factors.length} <span class="dots">${dotsTxt(t.factors.length)}</span></b><p>${esc(t.line)}</p><p class="ev">${esc(t.factors.join(" · "))}</p></div>`).join("") || "<p>No single theme reaches three factors.</p>"}</div>
      <h4>Where the chart argues with itself</h4>${r.contra.map(x => `<div class="item"><b class="t">${esc(x.poles.join(" / "))}</b><p class="ev">${esc(x.a.join(" · "))} vs ${esc(x.b.join(" · "))}</p><p><em>How both can be true:</em> ${esc(x.both)}</p></div>`).join("") || "<p>No strong internal contradictions by these rules.</p>"}`));
    out.push(page("Life areas", chap("Life <em>areas</em>", "Love · work · people") + Object.values(r.life).map(Lf => `<h3>${esc(Lf.title)}</h3><p class="muted">${esc(Lf.intro)}</p><div class="cols">${Lf.items.map(it => `<div class="item"><b class="t">${esc(it.q)} <span class="dots">${dotsTxt(it.f.length)}</span></b><p>${esc(it.a)}</p><p class="ev">${esc(it.f.join(" · "))}</p></div>`).join("")}</div>`).join("")));
    out.push(page("The planets", chap("The <em>planets</em>", "All ten, in full") + PLANETS.map(n => { const p = P[n], R = r.planets[n]; return `<div class="item"><div class="kicker">${esc(R.label)}</div><h3 style="margin-top:2px">${n} in <em>${p.sign}</em></h3><div class="meta">${p.degree}°${String(p.minute).padStart(2, "0")}′ ${p.sign}${Tk ? ` · ${ord(p.house)} house` : ""}${p.retrograde ? " · retrograde" : ""} · ${p.element} · ${p.modality}</div><p>${esc(R.text)}</p><p class="ev"><b>Traditional:</b> ${esc(R.trad)}</p><p class="ev"><b>Evolutionary:</b> ${esc(R.evo)}</p><p class="ev"><b>Symbolism:</b> ${esc(R.sig)}</p></div>`; }).join("")));
    if (Tk) out.push(page("The houses", chap("The <em>houses</em>", "All twelve") + `<div class="cols">${c.houses.map(h => `<div class="item"><b class="t">${ord(h.house)} house · ${L.HOUSE[h.house].name}</b><div class="meta">${h.sign} on the cusp · ruler ${E.TRULER[h.sign]} in the ${ord(P[E.TRULER[h.sign]].house)} · ${L.HOUSE[h.house].ancient}</div><p><b>${h.planets.length ? h.planets.join(", ") : "No planets"}.</b> Traditionally associated with ${L.HOUSE[h.house].area}.</p></div>`).join("")}</div>`));
    out.push(page("The aspects", chap("The <em>aspects</em>", "Major & minor") + `<div class="wheelbox">${wheel("light")}</div><table><tr><th>Aspect</th><th>Orb</th><th>Motion</th></tr>${c.major.map(a => `<tr><td>${a.a} <span class="${TONE[a.type]}">${AG[a.type]} ${a.type}</span> ${a.b}</td><td>${a.orb}°</td><td>${a.applying ? "applying" : "separating"}</td></tr>`).join("")}</table>
      ${c.major.map(a => `<p><b>${a.a} ${a.type} ${a.b}.</b> Your ${L.PLANET[a.a].what} is ${L.ASPECT[a.type].verb} your ${L.PLANET[a.b].what}: ${L.ASPECT[a.type].about}.</p>`).join("")}
      <h4>Minor aspects</h4><p class="ev">${c.aspects.filter(a => a.class === "minor").map(a => `${a.a} ${a.type} ${a.b} (${a.orb}°)`).join(" · ") || "none"}</p><h4>Shape & patterns</h4><p>${c.shape.shape}. Patterns: ${c.patterns.length ? [...new Set(c.patterns.map(p => p.type + " (" + p.planets.join(", ") + ")"))].join("; ") : "none"}.</p>`));
    const yn = v => v ? "✓" : "·";
    out.push(page("Mechanics", chap("Patterns & <em>mechanics</em>", "Elements · dignity · sect") + `<table><tr><th>Element</th><th>Planets</th></tr>${EL.map(e => `<tr><td>${e}</td><td>${c.elements[e].join(", ") || "—"}</td></tr>`).join("")}</table><table><tr><th>Modality</th><th>Planets</th></tr>${MOD.map(m => `<tr><td>${m}</td><td>${c.modalities[m].join(", ") || "—"}</td></tr>`).join("")}</table>
      <table><tr><th>Planet</th><th>Sign</th><th>Dom.</th><th>Exalt.</th><th>Trip.</th><th>Bound</th><th>Face</th><th>Detr.</th><th>Fall</th><th>Score</th></tr>${c.dignities.map(d => `<tr><td>${d.planet}</td><td>${d.sign}</td><td>${yn(d.domicile)}</td><td>${yn(d.exaltation)}</td><td>${yn(d.triplicity)}</td><td>${yn(d.bound)}</td><td>${yn(d.face)}</td><td>${d.detriment ? "✕" : "·"}</td><td>${d.fall ? "✕" : "·"}</td><td>${d.score}${d.peregrine ? " peregrine" : ""}</td></tr>`).join("")}</table>
      ${c.sect ? `<p><b>Sect:</b> ${c.sect.chart} chart; light ${c.sect.light}, benefic ${c.sect.benefic}, malefic ${c.sect.malefic}.</p>` : ""}<p class="ev">Dispositors: ${Object.entries(c.dispositors.traditional.chains).map(([n, x]) => `${n}: ${x.join(" → ")}`).join(" · ")}</p>
      <p class="ev">Fixed stars: ${c.stars.map(s => `${s.planet} ☌ ${s.star} (${s.orb}°)`).join(" · ") || "none within 1°"}. Mean node ${c.points.north_node.degree}° ${c.points.north_node.sign}; mean Lilith ${c.points.lilith.degree}° ${c.points.lilith.sign}.</p>`));
    const prof = tm.profections ? tm.profections[tm.age] : null;
    out.push(page("Timing", chap("<em>Timing</em>", `As of ${fd(tm.asOf)}`) + `<p>Moon ${tm.moonNow.phase.toLowerCase()} in ${tm.moonNow.sign}. Transits now: ${tm.transitsNow.map(t => `${t.transit} ${AG[t.type]} your ${t.natal} (${t.orb}°)`).join(" · ") || "none within 2°"}.</p>
      <table><tr><th>Transit</th><th>Enters 1°</th><th>Exact</th><th>Leaves 1°</th></tr>${tm.windows.map(x => `<tr><td>${x.transit} ${AG[x.type]} ${x.natal}</td><td>${x.start ? fd(x.start) : "earlier"}</td><td>${x.exact.map(fd).join("; ") || "closest approach"}</td><td>${x.end ? fd(x.end) : "later"}</td></tr>`).join("")}</table>
      ${prof ? `<p><b>Profection:</b> ${ord(prof.house)}-house year (${prof.sign}); Lord of the Year ${prof.lord}.</p>` : ""}${tm.firdNow ? `<p><b>Firdaria:</b> ${tm.firdNow.major}${tm.firdNow.sub ? " / " + tm.firdNow.sub : ""}.</p>` : ""}
      <p><b>Progressed Sun</b> ${tm.progressions.Sun.degree}° ${tm.progressions.Sun.sign}; <b>progressed Moon</b> ${tm.progressions.Moon.degree}° ${tm.progressions.Moon.sign}. Solar arc ${tm.arc.toFixed(1)}°.</p>
      <table><tr><th>Cycle</th><th>Dates</th></tr>${[["Jupiter return", tm.returns.jupiter], ["Saturn return", tm.returns.saturn], ["Nodal return", tm.returns.nodal], ["Uranus opposition", tm.returns.uranus_opposition]].map(([l, d]) => `<tr><td>${l}</td><td class="ev">${d.map(x => x.slice(0, 7)).join(" · ")}</td></tr>`).join("")}</table>`));
    out.push(page("Method", chap("Method & <em>history</em>", "How it was made") + L.LAYERS.map(([, n, tag, t]) => `<p><b>${n} (${tag}).</b> ${t}</p>`).join("") + `<h4>Why websites disagree</h4>${L.DEBUG.map(([q, a]) => `<p><b>${q}.</b> ${a}</p>`).join("")}<h4>Four thousand years, briefly</h4>${L.HISTORY.map(([w, wh, t]) => `<p><b>${w} · ${wh}.</b> ${t}</p>`).join("")}<div class="note"><b>What science says.</b> ${L.EVIDENCE}</div><p class="ev">Calculated in your browser with astronomy-engine. ${L.FRAMING}</p>`));
    $("#w-report").innerHTML = `<div class="rbar"><b>${who}: full report</b><button class="primary" id="saveR">Save as PDF ↓</button><a class="ghost" href="#/chart">Back to the chart</a><small>Choose "Save as PDF" as the destination in the print dialog. Everything is generated on your device.</small></div><div class="rpages">${out.join("")}</div>`;
    $("#saveR").onclick = () => window.print();
  };
})();
