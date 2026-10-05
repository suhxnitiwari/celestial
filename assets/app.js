/* Celestial app: the birth form, the hero, and a guided tour of your sky, one placement at a time.
   Everything is computed in the browser; nothing is sent anywhere. */
(function () {
  const { SIGNS, SG, PG, PLANETS, EL, MOD, AG, TONE, TONEC, T, esc, drawWheel } = window.Charted;
  const L = window.Lib, ord = window.Reading.ord;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const S = window.ChartedApp = { chart: null, reading: null };
  const store = { get() { try { return JSON.parse(localStorage.getItem("celestial-input")); } catch { return null; } }, set(v) { try { localStorage.setItem("celestial-input", JSON.stringify(v)); } catch {} }, clear() { try { localStorage.removeItem("celestial-input"); } catch {} } };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ================= theme =================
  const root = document.documentElement;
  const dark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  try { const t = localStorage.getItem("celestial-theme"); if (t) root.dataset.theme = t; } catch {}
  $("#theme").onclick = () => { root.dataset.theme = dark() ? "light" : "dark"; try { localStorage.setItem("celestial-theme", root.dataset.theme); } catch {} paintSeams(); S.renderStep?.(); };

  // ================= routing =================
  function paintSeams() {
    $$(".seam").forEach(p => {
      const sec = p.closest("section, header"); let next = sec.nextElementSibling;
      while (next && (!next.matches("section, header, footer") || next.hidden || getComputedStyle(next).display === "none")) next = next.nextElementSibling;
      p.setAttribute("fill", next && next.tagName === "SECTION" ? (getComputedStyle(next).getPropertyValue("--top").trim() || "#06141a") : "#06141a");
    });
  }
  function showWorld(w, target) {
    if (!S.chart) w = "start";
    $$(".world").forEach(x => x.hidden = x.dataset.world !== w);
    document.body.dataset.world = w;
    paintSeams();
    requestAnimationFrame(() => target ? target.scrollIntoView({ block: "start", behavior: "instant" }) : scrollTo({ top: 0, behavior: "instant" }));
  }
  function route() {
    const h = location.hash;
    if (!h || h.startsWith("#/")) return showWorld((h || (S.chart ? "#/chart" : "#/start")).slice(2) || "start");
    const t = document.getElementById(decodeURIComponent(h.slice(1))); if (!t) return;
    showWorld(t.closest(".world")?.dataset.world || "chart", t);
  }
  addEventListener("hashchange", route);

  // ================= birthplace search =================
  let cities = null, regionName = null;
  try { regionName = new Intl.DisplayNames(["en"], { type: "region" }); } catch {}
  const country = cc => (regionName && regionName.of(cc)) || cc;
  async function loadCities() { if (!cities) cities = fetch("data/cities.json").then(r => r.json()); return cities; }
  const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let picked = null, active = -1, results = [];
  const placeIn = $("#fPlace"), list = $("#placeList");
  placeIn.addEventListener("focus", loadCities);
  placeIn.addEventListener("input", async () => {
    picked = null;
    const q = fold(placeIn.value.trim()); if (q.length < 2) { list.hidden = true; placeIn.setAttribute("aria-expanded", "false"); return; }
    const data = await loadCities(), [cityQ, ...rest] = q.split(",").map(x => x.trim()), extra = rest.join(" ");
    results = [];
    for (const r of data.rows) {
      const nm = fold(r[0]), asc = r[7] ? fold(r[7]) : "";
      if (nm.startsWith(cityQ) || asc.startsWith(cityQ)) {
        if (extra && !fold(`${r[1]} ${country(r[2])} ${r[2]}`).includes(extra)) continue;
        results.push(r); if (results.length >= 8) break;
      }
    }
    active = -1;
    list.innerHTML = results.length ? results.map((r, i) => `<li role="option" id="pl-${i}" data-i="${i}"><b>${esc(r[0])}</b><span>${esc([r[1], country(r[2])].filter(Boolean).join(", "))}</span></li>`).join("") : `<li class="none">No match. Try the nearest larger city, or enter coordinates.</li>`;
    list.hidden = false; placeIn.setAttribute("aria-expanded", "true");
  });
  const choose = i => { const r = results[i]; picked = r; placeIn.value = `${r[0]}, ${[r[1], country(r[2])].filter(Boolean).join(", ")}`; list.hidden = true; placeIn.setAttribute("aria-expanded", "false"); };
  list.addEventListener("mousedown", e => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); choose(+li.dataset.i); } });
  placeIn.addEventListener("keydown", e => {
    if (list.hidden || !results.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); active = (active + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length; $$("#placeList li").forEach((li, i) => li.classList.toggle("on", i === active)); placeIn.setAttribute("aria-activedescendant", "pl-" + active); }
    if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(active); }
    if (e.key === "Escape") list.hidden = true;
  });
  placeIn.addEventListener("blur", () => setTimeout(() => list.hidden = true, 150));
  $("#manualToggle").onclick = () => { $("#manual").hidden = !$("#manual").hidden; };
  $("#fNoTime").onchange = e => { $("#fTime").disabled = e.target.checked; if (e.target.checked) $("#fTime").value = ""; };

  // ================= submit =================
  async function placeFromForm() {
    if (!$("#manual").hidden && $("#fLat").value !== "") {
      const lat = parseFloat($("#fLat").value), lon = parseFloat($("#fLon").value), off = parseFloat($("#fOff").value);
      if ([lat, lon, off].some(isNaN)) throw new Error("Enter latitude, longitude and UTC offset, or pick a city.");
      return { lat, lon, offset: off, label: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°` };
    }
    if (!picked && S.prevPlace && $("#fPlace").value === S.prevPlace.label) return S.prevPlace;
    if (!picked) throw new Error("Choose your birthplace from the list (or enter coordinates).");
    const data = await loadCities();
    return { lat: picked[3], lon: picked[4], tz: data.tz[picked[5]], label: `${picked[0]}, ${[picked[1], country(picked[2])].filter(Boolean).join(", ")}` };
  }
  $("#birthForm").onsubmit = async e => {
    e.preventDefault(); $("#formErr").textContent = "";
    try {
      if (!$("#fDate").value) throw new Error("Add your birth date.");
      if (!$("#fNoTime").checked && !$("#fTime").value) throw new Error('Add your birth time, or tick "I don\'t know my birth time".');
      const input = { name: $("#fName").value.trim(), date: $("#fDate").value, time: $("#fNoTime").checked ? "" : $("#fTime").value, place: await placeFromForm(), houseSystem: $("#fHouse").value };
      if ($("#fRemember").checked) store.set(input); else store.clear();
      start(input);
    } catch (x) { $("#formErr").textContent = x.message; }
  };
  $("#example").onclick = () => start({ name: "Example", date: "2000-01-01", time: "12:00", place: { lat: 51.507, lon: -0.128, tz: "Europe/London", label: "London, England, United Kingdom" }, houseSystem: "placidus", example: true });

  function start(input) {
    if (!window.Astronomy) { $("#formErr").textContent = "Still loading the astronomy library; try again in a second."; return; }
    S.input = input; S.chart = window.Engine.build(input); S.reading = window.Reading.read(S.chart);
    renderChartWorld();
    document.body.classList.add("has-chart");
    location.hash = "#/chart"; route();
  }

  // ================= helpers =================
  const wave = () => `<svg class="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,50 C260,10 500,80 760,46 C1020,12 1240,72 1440,40 L1440,90 L0,90 Z" class="seam"/></svg>`;
  const innerOf = c => c.planets.map(p => ({ n: p.planet, lon: p.lon }));
  const centre = c => c.timeKnown ? Math.floor(c.asc / 30) : 0;
  const SMALL = new Set(["a", "an", "and", "the", "of", "to", "in", "on"]);
  const titleCase = s => s.split(" ").map((w, i) => i && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1)).join(" ");
  const degMin = lon => { const x = ((lon % 360) + 360) % 360 % 30; return `${Math.floor(x)}°${String(Math.floor((x % 1) * 60)).padStart(2, "0")}′`; };
  const ELC = { Fire: ["#ffd9b8", "#e98a6b"], Earth: ["#e3f0d2", "#86ad7c"], Air: ["#e6e9ff", "#9aa6e6"], Water: ["#d4f3ee", "#4f9e98"] };
  const ELWORD = { Fire: "spark and initiative", Earth: "the body and the practical", Air: "ideas and perspective", Water: "feeling and intuition" };
  const signEl = s => EL[SIGNS.indexOf(s) % 4], signMod = s => MOD[SIGNS.indexOf(s) % 3];

  // ================= MY CHART: the hero =================
  function renderChartWorld() {
    const c = S.chart, Tk = c.timeKnown;
    const title = c.name || "Your sky";
    const letters = [...title].map((ch, i) => `<span style="--i:${i}">${ch === " " ? "&nbsp;" : esc(ch)}</span>`).join("");
    const big = [["Sun", "☉", `${c.sun_sign} Sun`, "Who I am"], ["Moon", "☽", `${c.moon_sign} Moon${c.moonUncertain ? "?" : ""}`, "How I feel"], ...(Tk ? [["Rising", "↑", `${c.rising_sign} Rising`, "How I show up"]] : [])];
    const hero = `<header class="env hero" id="top"><div class="wrap">
      <div class="hero-copy">
        <div class="label rv" style="--d:0">${S.input.example ? "Example chart" : "A Western natal chart"}${c.houseSystem ? ` · ${c.houseSystem} houses` : ""}</div>
        <h1 aria-label="${esc(title)}">${letters}</h1>
        <p class="promise rv" style="--d:5">Your birth chart, a little less sciency.</p>
        <p class="lede rv" style="--d:6">${esc(new Date(c.input.date + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}${Tk ? `, ${esc(c.input.time)}` : " (time unknown)"} · ${esc(c.input.placeLabel)}</p>
        <ul class="big3">${big.map(([k, g, b, l], i) => `<li class="rv" style="--d:${7 + i}"><button data-k="${k}"><span class="g">${T(g)}</span><b>${b}</b><span class="label">${l}</span><span class="go" aria-hidden="true">→</span></button></li>`).join("")}</ul>
        ${!Tk ? `<p class="note-s rv" style="--d:10">No birth time, so no rising sign or houses. Everything else is complete.${c.moonUncertain ? " Your Moon changed sign that day, so it's marked uncertain." : ""}</p>` : ""}
        <div class="hero-actions rv" style="--d:10"><a class="begin" href="#sky" id="beginTour"><span>Begin the tour</span><i aria-hidden="true">↓</i></a><a class="enter ghost" href="#/start" id="editBirth">Edit birth details</a></div>
      </div>
      <div class="orbit" id="heroWheel" aria-hidden="true"></div>
    </div>
    <a class="scroll-cue" href="#sky" aria-label="Scroll to the tour"><span></span></a>${wave()}</header>`;

    const steps = tourSteps(c);
    const tour = `<section class="env env-shell tour" id="sky"><div class="wrap">
      <div class="tour-head"><div class="label">A guided tour of your sky</div><h2 id="tourChapter"></h2><p class="lede" id="tourIntro"></p></div>
      <div class="tour-nav">
        <button class="tn-btn" id="tourPrev" aria-label="Previous step">←</button>
        <ol class="track" id="track" style="--n:${steps.length}"><span class="track-fill" id="trackFill"></span>${steps.map((s, i) => `<li><button data-i="${i}" title="${esc(s.place || s.label)}" aria-label="Step ${i + 1}: ${esc(s.place || s.label)}"><span class="g">${T(s.g)}</span></button></li>`).join("")}</ol>
        <button class="tn-btn" id="tourNext" aria-label="Next step">→</button>
        <button class="tn-play" id="tourPlay" aria-pressed="false"><span class="ic" aria-hidden="true"></span><span class="tx">Play</span></button>
      </div>
      <div class="tour-stage">
        <div class="tour-visual"><div class="tour-wheel" id="tourWheel"></div><p class="tour-cap" id="tourCap"></p></div>
        <article class="tour-card" id="tourCard" aria-live="polite"></article>
      </div>
      <p class="tour-hint">Use ← and → to move through the tour, or tap a planet on the wheel.</p>
    </div>${wave()}</section>`;

    $("#w-chart").innerHTML = hero + tour;
    $("#heroWheel").innerHTML = heroOrbit(c);
    glints($("#top"), 60); shootingStars($("#top")); parallax($("#top"));
    buildTour(steps);
    $$(".big3 button").forEach(b => b.onclick = () => { S.goStep(steps.findIndex(s => s.k === b.dataset.k)); $("#sky").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }); });
    $("#beginTour").onclick = e => { e.preventDefault(); S.goStep(0); $("#sky").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }); };
    $(".scroll-cue").onclick = $("#beginTour").onclick;
    paintSeams();
  }

  // ---------- hero orbit: zodiac ring, the moon, your Sun and Moon signs circling it ----------
  function heroOrbit(c) {
    const ring = SIGNS.map((s, i) => { const a = (i * 30 + 15) * Math.PI / 180, b = i * 30 * Math.PI / 180;
      return `<text x="${260 + 221 * Math.cos(a)}" y="${260 + 221 * Math.sin(a) + 6}" text-anchor="middle" font-size="16" fill="#e3c27e" fill-opacity=".8" class="g zg" style="--i:${i}">${T(SG[i])}</text>
        <line x1="${260 + 206 * Math.cos(b)}" y1="${260 + 206 * Math.sin(b)}" x2="${260 + 236 * Math.cos(b)}" y2="${260 + 236 * Math.sin(b)}" stroke="#cfa95e" stroke-opacity=".3"/>`; }).join("");
    const dust = Array.from({ length: 40 }, (_, i) => { const a = i / 40 * Math.PI * 2, r = 146 + (i % 3) * 7; return `<circle cx="${260 + r * Math.cos(a)}" cy="${260 + r * Math.sin(a)}" r="${i % 5 ? .9 : 1.6}" fill="#fff6de" opacity="${.25 + (i % 4) * .15}"/>`; }).join("");
    const upright = reduceMotion ? "" : `<animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="60s" repeatCount="indefinite"/>`;
    const token = (y, fill, glyph, name, d) => `<g transform="translate(260 ${y})"><g>${upright}<g class="tok" style="--d:${d}"><circle r="56" fill="${fill}" opacity=".18" class="tok-glow"/><circle r="38" fill="${fill}" opacity=".95"/><circle r="46" fill="none" stroke="#fff6de" stroke-opacity=".25"/>
      <text y="11" text-anchor="middle" font-size="32" fill="#10333a" class="g">${T(glyph)}</text><text y="64" text-anchor="middle" font-size="11" letter-spacing="2.5" fill="#f3dfb3" font-family="DM Sans" font-weight="700">${name.toUpperCase()}</text></g></g></g>`;
    const pair = c.sun_sign === "Pisces"
      ? `<use href="#koi" fill="url(#koiA)" transform="translate(260 84) rotate(-90) scale(.9)"/><use href="#koi" fill="url(#koiB)" transform="translate(260 436) rotate(90) scale(.9)"/>`
      : token(84, "url(#koiB)", SG[SIGNS.indexOf(c.sun_sign)], `${c.sun_sign} Sun`, 0) + token(436, "url(#koiA)", SG[SIGNS.indexOf(c.moon_sign)], `${c.moon_sign} Moon`, 1);
    return `<svg viewBox="0 0 520 520"><defs>
        <radialGradient id="moonG" cx=".38" cy=".32"><stop offset="0" stop-color="#fffdf6"/><stop offset=".55" stop-color="#f4e9d6"/><stop offset=".85" stop-color="#e4d2b8"/><stop offset="1" stop-color="#c9b394"/></radialGradient>
        <radialGradient id="haloG"><stop offset=".45" stop-color="#f6efd9" stop-opacity=".35"/><stop offset="1" stop-color="#f6efd9" stop-opacity="0"/></radialGradient>
        <linearGradient id="koiA" x1="0" x2="1"><stop offset="0" stop-color="#d7f1ea"/><stop offset=".5" stop-color="#8fd0c6"/><stop offset="1" stop-color="#4f9e98"/></linearGradient>
        <linearGradient id="koiB" x1="0" x2="1"><stop offset="0" stop-color="#fbe3e6"/><stop offset=".55" stop-color="#eaa9b6"/><stop offset="1" stop-color="#d9b56e"/></linearGradient>
        <linearGradient id="cometG" x1="0" x2="1"><stop offset="0" stop-color="#fff6de" stop-opacity="0"/><stop offset="1" stop-color="#fff6de" stop-opacity=".9"/></linearGradient>
        <g id="koi"><path d="M0 -40 C 26 -24, 26 20, 0 46 C -26 20, -26 -24, 0 -40 Z"/><path d="M0 44 C 14 60, 22 78, 10 92 C 3 78, -3 78, -10 92 C -22 78, -14 60, 0 44 Z" opacity=".85"/><path d="M-16 -4 C -40 4, -42 20, -30 26 C -26 14, -20 10, -14 8 Z M16 -4 C 40 4, 42 20, 30 26 C 26 14, 20 10, 14 8 Z" opacity=".7"/></g>
      </defs>
      <g class="ring-in"><g class="spin-r"><circle cx="260" cy="260" r="236" fill="none" stroke="#cfa95e" stroke-opacity=".35" class="draw"/><circle cx="260" cy="260" r="206" fill="none" stroke="#cfa95e" stroke-opacity=".2" class="draw"/>${ring}</g></g>
      <g class="spin-dust">${dust}</g>
      <circle cx="260" cy="260" r="176" fill="none" stroke="#cfa95e" stroke-opacity=".55" stroke-dasharray="1.5 7"/>
      <g class="comet"><path d="M260 84 A176 176 0 0 0 132 140" fill="none" stroke="url(#cometG)" stroke-width="2.2" stroke-linecap="round" transform="rotate(0 260 260)"/><circle cx="260" cy="84" r="3.2" fill="#fff6de"/></g>
      <circle cx="260" cy="260" r="120" fill="url(#haloG)" class="halo"/><g class="moon"><circle cx="260" cy="260" r="68" fill="url(#moonG)"/><circle cx="238" cy="244" r="9" fill="#d9c6a8" opacity=".35"/><circle cx="284" cy="276" r="13" fill="#d9c6a8" opacity=".28"/><circle cx="270" cy="232" r="5" fill="#d9c6a8" opacity=".35"/></g>
      <circle cx="260" cy="260" r="80" fill="none" stroke="#fff6de" stroke-opacity=".22" class="moon-ring"/>
      <g class="spin">${pair}</g></svg>`;
  }
  // moonlight glints, shooting stars and a gentle parallax
  function glints(host, n) {
    if (reduceMotion || !host || host.querySelector(".glint")) return;
    for (let i = 0; i < n; i++) {
      const g = document.createElement("span"), sz = 1.2 + Math.random() * 3; g.className = "glint";
      Object.assign(g.style, { left: Math.random() * 100 + "%", top: 4 + Math.random() * 90 + "%", width: sz + "px", height: sz + "px", animationDuration: 2.5 + Math.random() * 4 + "s", animationDelay: -Math.random() * 5 + "s" });
      g.dataset.depth = (Math.random() * 18 + 4).toFixed(1);
      host.appendChild(g);
    }
  }
  function shootingStars(host) {
    if (reduceMotion || !host) return;
    const fire = () => {
      if (!document.body.contains(host)) return;
      const s = document.createElement("span"); s.className = "shoot";
      Object.assign(s.style, { left: 20 + Math.random() * 70 + "%", top: Math.random() * 40 + "%", "--len": 120 + Math.random() * 160 + "px" });
      host.appendChild(s); setTimeout(() => s.remove(), 1600);
      setTimeout(fire, 2200 + Math.random() * 3800);
    };
    setTimeout(fire, 1600);
  }
  function parallax(host) {
    if (reduceMotion || !host || matchMedia("(hover: none)").matches) return;
    const orbit = host.querySelector(".orbit"), stars = [...host.querySelectorAll(".glint")];
    let raf = 0;
    host.addEventListener("pointermove", e => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
        orbit.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translate3d(${x * 14}px, ${y * 14}px, 0)`;
        stars.forEach(s => s.style.translate = `${-x * s.dataset.depth}px ${-y * s.dataset.depth}px`);
      });
    });
    host.addEventListener("pointerleave", () => { orbit.style.transform = ""; stars.forEach(s => s.style.translate = ""); });
  }
  glints($("#start"), 40);

  // ================= the guided tour =================
  const CHAPTERS = {
    big: ["The Big <em>Three</em>", "Three placements do most of the talking: who you are, how you feel, and how people first meet you."],
    rest: ["The rest of the <em>sky</em>", "Seven more planets, each one a different part of you: how you think, love, act, grow, and change."],
    whole: ["The whole <em>picture</em>", "Step back and see the mix: which elements your planets gather in, and what that says about you."],
  };
  function tourSteps(c) {
    const P = c.P, B = S.reading.big, R = S.reading.planets, Tk = c.timeKnown;
    const at = n => `${n} in ${P[n].sign}, ${degMin(P[n].lon)}${Tk ? `, ${ord(P[n].house)} house` : ""}${P[n].retrograde ? ", retrograde" : ""}`;
    const planet = (k, label, place, sign, placement, text, ch) => ({ kind: "planet", ch, k, g: k === "Rising" ? "↑" : PG[k], label, place, sign, placement, text });
    return [
      planet("Sun", "Who I Am", `${c.sun_sign} Sun`, c.sun_sign, at("Sun"), B.sun.text, "big"),
      planet("Moon", "How I Feel", `${c.moon_sign} Moon${c.moonUncertain ? "?" : ""}`, c.moon_sign, at("Moon"), B.moon.text, "big"),
      ...(Tk ? [planet("Rising", "How I Show Up", `${c.rising_sign} Rising`, c.rising_sign, `Ascendant in ${c.rising_sign}, ${degMin(c.asc)}`, B.rising.text, "big")] : []),
      ...PLANETS.slice(2).map(n => planet(n, titleCase(R[n].label), `${P[n].sign} ${n}`, P[n].sign, at(n), R[n].text, "rest")),
      { kind: "whole", ch: "whole", k: "whole", g: "✦", label: "Your elements" },
    ];
  }

  // a sign "orb": element-coloured, its glyph in the middle, its keywords circling it
  function signOrb(sign, g, id) {
    const [c1, c2] = ELC[signEl(sign)], words = `${L.SIGN[sign].key} · ${signEl(sign)} · ${signMod(sign)} · `.toUpperCase();
    return `<div class="orb" style="--c1:${c1};--c2:${c2}"><svg viewBox="0 0 200 200" aria-hidden="true">
      <defs><path id="${id}" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"/></defs>
      <g class="orb-ring"><text font-size="10.5" letter-spacing="2.2" font-family="DM Sans" font-weight="700"><textPath href="#${id}" textLength="485">${esc(words)}</textPath></text></g>
      <circle cx="100" cy="100" r="66" class="orb-halo"/>
      <text x="100" y="${g === "↑" ? 116 : 118}" text-anchor="middle" font-size="50" class="g orb-g">${T(SG[SIGNS.indexOf(sign)])}</text></svg>
      <span class="orb-p g" aria-hidden="true">${T(g)}</span></div>`;
  }

  function buildTour(steps) {
    const c = S.chart, P = c.P;
    let cur = 0, timer = null, chapter = null;
    const fill = $("#trackFill"), btns = $$("#track button");

    const render = () => {
      const s = steps[cur], n = s.k === "Rising" || s.kind === "whole" ? null : s.k;
      // chapter heading changes only when the chapter does
      if (chapter !== s.ch) {
        chapter = s.ch; const [h, intro] = CHAPTERS[s.ch];
        $("#tourChapter").innerHTML = h; $("#tourIntro").textContent = intro;
        $(".tour-head").classList.remove("in"); void $(".tour-head").offsetWidth; $(".tour-head").classList.add("in");
      }
      btns.forEach((b, i) => { b.classList.toggle("done", i < cur); b.setAttribute("aria-current", i === cur ? "step" : "false"); });
      fill.style.setProperty("--p", steps.length > 1 ? cur / (steps.length - 1) : 0);
      $("#tourPrev").disabled = cur === 0;
      $("#tourNext").disabled = cur === steps.length - 1;

      // card
      const card = $("#tourCard");
      if (s.kind === "whole") card.innerHTML = wholeCard(c);
      else {
        const as = n ? c.major.filter(a => a.a === n || a.b === n) : [];
        const el = signEl(s.sign), facts = [["Element", el, ELC[el][1]], ["Mode", signMod(s.sign)], ["Gift", L.SIGN[s.sign].gift], ["Needs", L.SIGN[s.sign].need]];
        card.innerHTML = `<div class="step-n s">Step ${cur + 1} of ${steps.length}</div>
          <div class="tc-top s">${signOrb(s.sign, s.g, "orbp" + cur)}<div><div class="label">${esc(s.label)}</div><h3>${esc(s.place)}</h3><p class="pm">${esc(s.placement)}</p></div></div>
          <p class="tc-text s">${esc(s.text)}</p>
          <div class="facts s">${facts.map(([k, v, col]) => `<div class="fact"><small>${k}</small><b>${col ? `<i style="background:${col}"></i>` : ""}${esc(v)}</b></div>`).join("")}</div>
          ${as.length ? `<div class="tc-asp s"><div class="label">Talks to</div>${as.map(a => { const o = a.a === n ? a.b : a.a; return `<button data-k="${o}" style="--t:${TONEC[TONE[a.type]]}"><span class="g">${T(AG[a.type])}</span> ${a.type} <b>${o}</b></button>`; }).join("")}</div>` : ""}`;
      }
      card.querySelectorAll(".s").forEach((x, i) => x.style.setProperty("--i", i));
      card.classList.remove("in"); void card.offsetWidth; card.classList.add("in");
      card.querySelectorAll(".tc-asp button").forEach(b => b.onclick = () => go(steps.findIndex(x => x.k === b.dataset.k)));

      // wheel: the current planet and everything it talks to light up
      const as = n ? c.major.filter(a => a.a === n || a.b === n) : [];
      const hl = s.kind === "whole" ? null : n ? [n, ...as.map(a => a.a === n ? a.b : a.a)] : [];
      const w = drawWheel({ inner: innerOf(c), aspects: c.major.map(a => ({ ...a, hl: !!n && (a.a === n || a.b === n) })), centreSign: centre(c), highlight: hl, size: 520, theme: dark() ? "dark" : "light", ascLabel: c.timeKnown });
      w.setAttribute("role", "img"); w.setAttribute("aria-label", `Chart wheel${n ? `, ${n} highlighted` : ""}`);
      w.querySelectorAll(".wp").forEach(g => { g.onclick = () => go(steps.findIndex(x => x.k === g.dataset.p)); if (g.dataset.p === n) g.classList.add("focus"); });
      if (s.kind === "whole") w.querySelectorAll(".wp").forEach((g, i) => { g.classList.add("pop"); g.style.setProperty("--i", i); g.querySelector("circle").setAttribute("fill", ELC[P[g.dataset.p].element][0]); });
      if (s.k === "Rising") w.classList.add("asc-on");
      const host = $("#tourWheel"), first = !host.firstChild;
      host.innerHTML = ""; host.appendChild(w);
      if (first) w.classList.add("first");
      $("#tourCap").innerHTML = s.kind === "whole" ? "Every planet, coloured by its element."
        : s.k === "Rising" ? `<b>${esc(s.place)}</b> · the arc at the left marks where the sky met the horizon`
        : `<b>${esc(s.place)}</b>${as.length ? ` · talks to ${as.map(a => a.a === n ? a.b : a.a).join(", ")}` : " · works on its own"}`;
    };

    const go = i => { if (i < 0 || i >= steps.length) return; cur = i; render(); };
    const stop = () => { clearInterval(timer); timer = null; $("#tourPlay").setAttribute("aria-pressed", "false"); $("#tourPlay .tx").textContent = "Play"; };
    $("#tourPrev").onclick = () => { stop(); go(cur - 1); };
    $("#tourNext").onclick = () => { stop(); go(cur + 1); };
    btns.forEach(b => b.onclick = () => { stop(); go(+b.dataset.i); });
    $("#tourPlay").onclick = () => {
      if (timer) return stop();
      if (cur === steps.length - 1) go(0);
      $("#tourPlay").setAttribute("aria-pressed", "true"); $("#tourPlay .tx").textContent = "Pause";
      timer = setInterval(() => { if (cur >= steps.length - 1) return stop(); go(cur + 1); }, 7000);
    };
    // arrow keys while the tour is on screen
    const inView = () => { const r = $("#sky")?.getBoundingClientRect(); return r && r.top < innerHeight * .6 && r.bottom > innerHeight * .4; };
    addEventListener("keydown", e => {
      if (!$("#sky") || $("#w-chart").hidden || e.target.closest("input, select, textarea") || !inView()) return;
      if (e.key === "ArrowRight") { e.preventDefault(); stop(); go(cur + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); stop(); go(cur - 1); }
    });
    // the wheel spins in the first time the tour scrolls into view
    if ("IntersectionObserver" in window) new IntersectionObserver((es, o) => es.forEach(x => { if (x.isIntersecting) { $("#sky").classList.add("seen"); o.disconnect(); } }), { threshold: .2 }).observe($("#sky"));
    else $("#sky").classList.add("seen");

    S.goStep = i => { stop(); go(i); };
    S.renderStep = render;
    render();
  }

  // the finale: how the ten planets spread across the four elements
  function wholeCard(c) {
    const counts = EL.map(e => [e, c.elements[e]]).sort((a, b) => b[1].length - a[1].length);
    const tops = counts.filter(x => x[1].length === counts[0][1].length).map(x => x[0]), missing = counts.filter(x => !x[1].length).map(x => x[0]);
    const list = a => a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a[0];
    const lead = tops.length === 1 ? `Your planets gather most in ${tops[0]}, the element of ${ELWORD[tops[0]]}.`
      : `Your planets split evenly between ${list(tops)}: ${list(tops.map(e => ELWORD[e]))}.`;
    return `<div class="step-n s">The whole picture</div>
      <h3 class="s">${tops.length === 1 ? `Mostly <em>${tops[0]}</em>` : `Equal parts <em>${list(tops)}</em>`}</h3>
      <p class="tc-text s">${lead} ${missing.length ? missing.map(m => L.ELEMENT_MISSING[m].line).join(" ") : "Every element is represented, so your chart has a little of everything to draw on."}</p>
      <div class="elements s">${counts.map(([e, list]) => `<div class="el-orb" style="--c1:${ELC[e][0]};--c2:${ELC[e][1]};--sz:${56 + list.length * 16}px"><span class="ball">${list.map(p => `<i class="g">${T(PG[p])}</i>`).join("")}</span><b>${e}</b><small>${list.length} planet${list.length === 1 ? "" : "s"}</small></div>`).join("")}</div>
      <div class="tc-end s"><button type="button" class="begin small" onclick="window.ChartedApp.goStep(0)"><span>Take the tour again</span><i aria-hidden="true">↺</i></button><a class="enter ghost" href="#/start">Chart someone else</a></div>`;
  }

  // ================= boot =================
  document.addEventListener("DOMContentLoaded", () => {
    const saved = store.get();
    if (saved) { $("#fRemember").checked = true; start(saved); }
    else route();
    $("#w-chart").addEventListener("click", e => { if (e.target.id === "editBirth") { e.preventDefault(); fillForm(S.input); location.hash = "#/start"; } });
  });
  function fillForm(i) {
    if (!i || i.example) return;
    $("#fName").value = i.name || ""; $("#fDate").value = i.date; $("#fTime").value = i.time || ""; $("#fNoTime").checked = !i.time; $("#fTime").disabled = !i.time;
    $("#fPlace").value = i.place.label || ""; $("#fHouse").value = i.houseSystem || "placidus";
    if (!i.place.tz) { $("#manual").hidden = false; $("#fLat").value = i.place.lat; $("#fLon").value = i.place.lon; $("#fOff").value = i.place.offset; }
    else picked = null;
    S.prevPlace = i.place;
  }
})();
