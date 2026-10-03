/* Celestial app: form, routing and the My Chart world. Timing, compatibility, learn and the report
   live in app-more.js. Everything is computed in the browser; nothing is sent anywhere. */
(function () {
  const { SIGNS, SG, PG, PLANETS, EL, MOD, AG, TONE, TONEC, T, esc, ROMAN, el, drawWheel, planetsIn } = window.Charted;
  const L = window.Lib, ord = window.Reading.ord;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const S = window.ChartedApp = { chart: null, reading: null, timing: null };
  const store = { get() { try { return JSON.parse(localStorage.getItem("celestial-input")); } catch { return null; } }, set(v) { try { localStorage.setItem("celestial-input", JSON.stringify(v)); } catch {} }, clear() { try { localStorage.removeItem("celestial-input"); } catch {} } };

  // ================= theme & claims =================
  const root = document.documentElement;
  try { const t = localStorage.getItem("celestial-theme"); if (t) root.dataset.theme = t; } catch {}
  $("#theme").onclick = () => { const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; root.dataset.theme = dark ? "light" : "dark"; try { localStorage.setItem("celestial-theme", root.dataset.theme); } catch {} paintSeams(); S.renderSky?.(); };
  $("#claimsBtn").onclick = () => { const on = document.body.classList.toggle("claims"); $("#claimsBtn").setAttribute("aria-pressed", on); };

  // ================= routing =================
  function paintSeams() {
    $$(".seam").forEach(p => {
      const sec = p.closest("section, header"); let next = sec.nextElementSibling;
      while (next && (!next.matches("section, header, footer") || next.hidden || getComputedStyle(next).display === "none")) next = next.nextElementSibling;
      p.setAttribute("fill", next && next.tagName === "SECTION" ? (getComputedStyle(next).getPropertyValue("--top").trim() || "#06141a") : "#06141a");
    });
  }
  S.paintSeams = paintSeams;
  function showWorld(w, target) {
    if (!S.chart && w !== "start" && w !== "learn") w = "start";
    $$(".world").forEach(x => x.hidden = x.dataset.world !== w);
    $$(".w-l").forEach(a => a.setAttribute("aria-current", a.dataset.w === w ? "page" : "false"));
    document.body.dataset.world = w;
    if (w === "timing") S.renderTiming?.();
    if (w === "compat") S.renderCompat?.();
    if (w === "learn") S.renderLearn?.();
    if (w === "report") S.renderReport?.();
    paintSeams();
    requestAnimationFrame(() => target ? target.scrollIntoView({ block: "start", behavior: "instant" }) : scrollTo({ top: 0, behavior: "instant" }));
  }
  function route() {
    const h = location.hash;
    if (!h || h.startsWith("#/")) return showWorld((h || (S.chart ? "#/chart" : "#/start")).slice(2) || "start");
    const t = document.getElementById(decodeURIComponent(h.slice(1))); if (!t) return;
    const panel = t.closest(".xpanel"); if (panel) S.showPanel?.(panel.dataset.xpanel);
    showWorld(t.closest(".world")?.dataset.world || "chart", t);
  }
  addEventListener("hashchange", route);
  S.route = route;

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
    S.input = input; S.chart = window.Engine.build(input); S.reading = window.Reading.read(S.chart); S.timing = null;
    S.rendered = {};
    renderChartWorld();
    document.body.classList.add("has-chart");
    location.hash = "#/chart"; route();
  }
  S.start = start;
  S.changeHouseSystem = sys => { S.input.houseSystem = sys; if (store.get()) store.set(S.input); start(S.input); };

  // ================= helpers =================
  const P = () => S.chart.P;
  const nm = () => S.chart.name ? S.chart.name : "you";
  const dots = n => { const w = n >= 5 ? 4 : n >= 3 ? 3 : n === 2 ? 2 : 1; return `<span class="dots sm" title="${n} factor${n > 1 ? "s" : ""}">${[0, 1, 2, 3].map(i => `<i class="${i < w ? "on" : ""}"></i>`).join("")}</span>`; };
  const weightLabel = n => (n >= 5 ? "Strong recurring theme" : n >= 3 ? "Moderate theme" : n === 2 ? "Supporting detail" : "Single indicator") + ` · ${n} factor${n > 1 ? "s" : ""}`;
  const wave = () => `<svg class="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,50 C260,10 500,80 760,46 C1020,12 1240,72 1440,40 L1440,90 L0,90 Z" class="seam"/></svg>`;
  const sec = (id, env, roman, label, title, body, extra = "") => `<section class="env env-${env}" id="${id}"${extra}><div class="wrap">${roman != null ? `<div class="sec-head"><span class="roman">${roman}</span><div class="label">${label}</div><h2>${title}</h2></div>` : ""}${body}</div>${wave()}</section>`;
  const meta = p => [`${p.degree}°${String(p.minute).padStart(2, "0")}′ ${p.sign}`, S.chart.timeKnown ? `${ord(p.house)} house` : null, p.retrograde ? "retrograde ℞" : null, p.element.toLowerCase(), p.modality.toLowerCase()].filter(Boolean).join(" · ");
  const aspTitle = x => `${x.a} ${L.ASPECT[x.type].glyph} ${x.b}`;
  const aspText = x => `Your ${L.PLANET[x.a].what} is ${L.ASPECT[x.type].verb} your ${L.PLANET[x.b].what}: ${L.ASPECT[x.type].about}.`;
  const receipts = (title, items) => `<details class="rcpt"><summary>🔭 Show me the astrology</summary><ul data-c="calc">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul><button type="button" class="why-btn" data-why="${esc(title)}" data-ev="${esc(JSON.stringify(items))}">Show on the chart ↗</button></details>`;
  S.helpers = { dots, weightLabel, wave, sec, meta, aspTitle, aspText, receipts, ord, esc, T };

  // ================= evidence drawer =================
  const drawer = document.createElement("aside"); drawer.className = "evd"; drawer.hidden = true; drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-label", "Evidence"); document.body.appendChild(drawer);
  const innerOf = c => c.planets.map(p => ({ n: p.planet, lon: p.lon }));
  const centre = c => c.timeKnown ? Math.floor(c.asc / 30) : 0;
  S.showEvidence = (title, items) => {
    const c = S.chart, planets = [...new Set(items.flatMap(planetsIn))];
    drawer.innerHTML = `<button class="x" aria-label="Close">×</button><div class="label">Show me why</div><h3>${esc(title)}</h3><div class="evd-wheel"></div>
      <p class="evd-n">${items.length} chart factor${items.length > 1 ? "s" : ""} contribute:</p><ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
      <div class="evd-go">${planets.map(n => `<button data-p="${n}"><span class="g">${T(PG[n])}</span> ${n}</button>`).join("")}</div>
      <p class="evd-foot">Tap a planet to open it on your wheel, or see <a href="#/learn">how charts work</a>.</p>`;
    drawer.querySelector(".evd-wheel").appendChild(drawWheel({ inner: innerOf(c), aspects: c.major.map(a => ({ ...a, hl: planets.includes(a.a) && planets.includes(a.b) })), centreSign: centre(c), highlight: planets.length ? planets : null, size: 420, ascLabel: c.timeKnown }));
    drawer.hidden = false;
    drawer.querySelector(".x").onclick = () => drawer.hidden = true;
    drawer.querySelectorAll(".evd-go button").forEach(b => b.onclick = () => { drawer.hidden = true; location.hash = "#chart"; setTimeout(() => S.showPlanet(b.dataset.p), 60); });
    drawer.querySelector(".x").focus();
  };
  addEventListener("keydown", e => { if (e.key === "Escape") drawer.hidden = true; });
  document.addEventListener("click", e => { const b = e.target.closest("[data-why]"); if (b) { e.preventDefault(); S.showEvidence(b.dataset.why, JSON.parse(b.dataset.ev)); } });

  // ================= MY CHART WORLD =================
  function renderChartWorld() {
    const c = S.chart, r = S.reading, P = c.P, Tk = c.timeKnown;
    const who = c.name ? `${esc(c.name)}'s` : "Your";
    const place = c.input.placeLabel;
    const hero = `<header class="env hero" id="top"><div class="wrap">
      <div><div class="label">${S.input.example ? "Example chart" : "A Western natal chart"}${c.houseSystem ? ` · ${c.houseSystem} houses` : ""}</div>
        <h1>${c.name ? esc(c.name) : "Your sky"}</h1>
        <p class="promise">Your birth chart, a little less sciency.</p>
        <p class="lede">${esc(new Date(c.input.date + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}${Tk ? `, ${esc(c.input.time)}` : " (time unknown)"} · ${esc(place)}</p>
        <ul class="big3">${[["☉", `${c.sun_sign} Sun`, L.PLANET.Sun.label], ["☽", `${c.moon_sign} Moon${c.moonUncertain ? "?" : ""}`, L.PLANET.Moon.label], ...(Tk ? [["↑", `${c.rising_sign} Rising`, "How I show up"]] : [])].map(([g, b, l]) => `<li><span class="g">${T(g)}</span><b>${b}</b><span class="label">${esc(l)}</span></li>`).join("")}</ul>
        ${!Tk ? `<p class="note-s">No birth time, so no rising sign or houses. Everything else is complete.${c.moonUncertain ? " Your Moon changed sign that day, so it's marked uncertain." : ""}</p>` : ""}
        <div class="hero-actions"><a class="enter" href="#sky">See your whole sky ↓</a><a class="enter ghost" href="#/start" id="editBirth">Edit birth details</a></div>
      </div>
      <div class="orbit" id="heroWheel" aria-hidden="true"></div>
    </div>${wave()}</header>`;

    const headline = sec("headline", "pearl", "II", "Your sky at a glance", "The <em>headline</em>",
      `<div class="glance">${r.glance.map(g => `<div class="gl-i" data-c="calc"><span class="ic">${g.icon}</span><small>${esc(g.label)}</small><b>${esc(g.value)}</b><span>${esc(g.note)}</span></div>`).join("")}</div>
      <div class="five-wrap"><div class="label">If you remember five things about this chart</div>
      <ol class="five">${r.five.map(f => `<li><button aria-expanded="false"><span class="t">${esc(f.text)}</span>${dots(f.evidence.length)}</button><div class="ev-list" data-c="calc"><span class="label">🔭 Show me the astrology</span><ul>${f.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul><button type="button" class="why-btn" data-why="${esc(f.text)}" data-ev="${esc(JSON.stringify(f.evidence))}">Show on the chart ↗</button></div></li>`).join("")}</ol></div>
      ${r.wait.slice(0, 3).map(w => waitBox(w)).join("")}
      <a class="cta" href="#/report"><span>Want the complete version, with every placement explained?</span><b>Download my full report ↓</b></a>`);

    const B = r.big;
    const bigThree = sec("big-three", "sun", "III", "Sun · Moon · Rising", "The Big <em>Three</em>",
      `<div class="frame3">${[["sun", "☉", c.sun_sign], ["moon", "☽", c.moon_sign], ...(Tk ? [["rising", "↑", c.rising_sign]] : [])].map(([k, g, s]) => `<div class="fr"><small>${esc(B.frame[k][0])}</small><b><span class="g">${T(g)}</span> ${s}</b><span>${esc(B.frame[k][1])}</span></div>`).join("")}</div>
      <div class="spread"><div><div class="label">When they agree</div><p class="pull" data-c="interp">${esc(B.agree)}</p></div>
      <div><div class="label">When they fight</div><ul class="fight">${B.fight.map(([a, b]) => `<li><b>${esc(a)}</b> ${esc(b)}</li>`).join("")}</ul><p class="pull" data-c="interp"><span class="label" style="display:block;margin-bottom:4px">Result</span>${esc(B.result)}</p></div></div>
      ${B.wiring.length ? `<div class="label" style="margin-top:30px">The wiring between them</div><ol id="talk" class="wiring">${B.wiring.map(([a, b]) => `<li><b>${esc(a)}</b>${esc(b)}</li>`).join("")}</ol>` : ""}
      <details class="more"><summary>Read the three in full</summary><div class="b3">${["sun", "moon", "rising"].filter(k => B[k]).map(k => `<article class="lum"><div class="label">${esc(B.frame[k][0])}</div><h3>${esc(B[k].title)}</h3><div class="line">${esc(B[k].line)}</div><p data-c="interp">${esc(B[k].text)}</p>${receipts(B[k].title, k === "rising" ? [`${c.rising_sign} Rising`, `Chart ruler ${c.rulers.chart_ruler[0]} in ${P[c.rulers.chart_ruler[0]].sign}`] : [`${k === "sun" ? "Sun" : "Moon"} in ${k === "sun" ? c.sun_sign : c.moon_sign}`, ...(Tk ? [`${ord(P[k === "sun" ? "Sun" : "Moon"].house)} house`] : []), ...c.major.filter(a => a.a === (k === "sun" ? "Sun" : "Moon") || a.b === (k === "sun" ? "Sun" : "Moon")).slice(0, 3).map(aspTitle)])}</article>`).join("")}</div></details>`);

    const dnaRows = [["Water", c.elements.Water, "var(--water)"], ["Air", c.elements.Air, "var(--air)"], ["Fire", c.elements.Fire, "var(--fire)"], ["Earth", c.elements.Earth, "var(--earth)"], null,
      ["Mutable", c.modalities.Mutable, "#b9a8de"], ["Fixed", c.modalities.Fixed, "#b9a8de"], ["Cardinal", c.modalities.Cardinal, "#b9a8de"],
      ...(Tk ? [null, ["Above horizon", c.hemispheres.above, "#e3c27e"], ["Below", c.hemispheres.below, "#e3c27e"], ["East", c.hemispheres.east, "#e3c27e"], ["West", c.hemispheres.west, "#e3c27e"], null,
        ["Angular", c.house_types.angular, "#e9b8bf"], ["Succedent", c.house_types.succedent, "#e9b8bf"], ["Cadent", c.house_types.cadent, "#e9b8bf"]] : []), null,
      ["Retrograde", c.planets.filter(p => p.retrograde).map(p => p.planet), "#a9b9ec"]];
    S.dnaLists = Object.fromEntries(dnaRows.filter(Boolean).map(x => [x[0], x[1]]));
    const portrait = sec("portrait", "night", "IV", "Read together", "The <em>Portrait</em>",
      `<p class="lede" style="margin:-30px 0 50px">Single placements are words; themes are sentences. Everything further down the page is the evidence for what's here.</p>
      <div class="spread"><div><div class="label">Main characters</div><h3>Who <em>really</em> runs this chart</h3>
        <p style="color:var(--muted)">A transparent heuristic, not a measurement: points for being a luminary or the chart ruler, an angular house, ruling the Sun's or Moon's sign, the rulership loop, sect, fixed stars, the number of aspects, and near-exact aspects.</p>
        <ol class="cast">${r.cast.slice(0, 3).map((x, i) => `<li data-c="calc"><span class="md">${["🥇", "🥈", "🥉"][i]}</span><div><b><span class="g">${T(PG[x.n])}</span> ${x.n} <span class="pts">${x.pts} pts</span></b><span>${esc(x.why.join(" · "))}</span></div></li>`).join("")}</ol></div>
      <div><div class="label">Chart DNA</div><h3>The chart's <em>fingerprint</em></h3>
        <div class="dna" id="dna">${dnaRows.map(x => x ? `<div class="dna-r" data-c="calc" tabindex="0" role="button"><span>${x[0]}</span><div class="bar">${Array.from({ length: 10 }, (_, i) => `<i style="${i < x[1].length ? `background:${x[2]}` : ""}"></i>`).join("")}</div><b>${x[1].length || "—"}</b></div>` : `<div class="dna-gap"></div>`).join("")}</div>
        <p class="dna-cap" id="dnaCap">Tap a row to light up those placements on your wheel.</p></div></div>
      ${r.wait.slice(3).map(w => waitBox(w)).join("")}
      <hr class="rule"><div class="spread"><div><div class="label">What repeats</div><h3>Themes the chart <em>keeps returning to</em></h3>
        <p style="color:var(--muted)">Astrology reads repetition as emphasis. These are transparent counts of interpretive indicators, not scores.</p>
        <div class="repeats">${r.themes.length ? r.themes.map(t => `<div class="rp"><button aria-expanded="false"><span class="nm">${esc(t.label)}<small class="wt">${weightLabel(t.factors.length)}</small></span><span class="dots">${t.factors.map(() => "<i></i>").join("")}<b>× ${t.factors.length}</b></span></button><ul data-c="calc">${t.factors.map(f => `<li>${esc(f)}</li>`).join("")}</ul><button type="button" class="why-btn" data-why="${esc(t.label)}" data-ev="${esc(JSON.stringify(t.factors))}">Show on the chart ↗</button></div>`).join("") : `<p class="muted">No single theme reaches three factors: this chart spreads its emphasis evenly.</p>`}</div></div>
      <div><div class="label">What contradicts</div><h3>Where the chart <em>argues with itself</em></h3>
        <ul class="argues">${r.contra.length ? r.contra.map(x => `<li data-c="interp"><b>${esc(x.poles[0])} <i class="amp">/</i> ${esc(x.poles[1])}</b><div class="vs"><ul>${x.a.map(i => `<li>${esc(i)}</li>`).join("")}</ul><i>vs</i><ul>${x.b.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div><p class="both"><span class="why">How both can be true</span>${esc(x.both)}</p><button type="button" class="why-btn" data-why="${esc(x.poles.join(" / "))}" data-ev="${esc(JSON.stringify([...x.a, ...x.b]))}">Show on the chart ↗</button></li>`).join("") : `<li class="muted">This chart is unusually consistent: no strong internal contradictions by these rules.</li>`}</ul>
        <p class="annot">Astrology isn't saying you're one or the other; these describe different contexts in which each side shows up.</p></div></div>`);

    const life = sec("life", "glass", "V", "Where the chart shows up", "Your <em>life</em>",
      `<div class="life-tabs" role="tablist">${Object.entries(r.life).map(([k, v], i) => `<button role="tab" data-k="${k}" aria-selected="${i === 0}">${esc(v.title)}</button>`).join("")}</div><p class="lede" id="lifeIntro" style="margin:10px 0 30px"></p><div class="life-grid" id="lifeGrid"></div>`);

    const wheel = sec("chart", "night", "VI", "Your chart", "A map of <em>your sky</em>",
      `<div class="chart-grid"><div>
        <div class="filters modes" role="group" aria-label="Colour the wheel by"><span class="mlabel">Colour by</span>${["Planets", "Elements", "Modalities", "Aspects"].map((m, i) => `<button data-m="${m}" aria-pressed="${i === 0}">${m}</button>`).join("")}</div>
        <div class="wheel" id="wheel"></div><p class="mlegend" id="mlegend"></p>
        ${Tk ? `<div class="hs-switch"><span class="label">House system</span>${[["placidus", "Placidus"], ["whole", "Whole Sign"], ["porphyry", "Porphyry"]].map(([k, l]) => `<button data-hs="${k}" aria-pressed="${S.input.houseSystem === k}">${l}</button>`).join("")}<span class="muted hs-note">${esc(c.houseNote || "Switch to see which planets change houses. Signs and aspects never change.")}</span></div>` : ""}
      </div><aside class="panel" id="panel" aria-live="polite"></aside></div>`);

    const explore = `<section class="env env-night explore-head" id="explore"><div class="wrap"><div class="sec-head"><span class="roman">VII</span><div class="label">The evidence, in depth</div><h2>Explore the <em>chart</em></h2></div>
      <p class="lede" style="margin:-30px 0 26px">Everything above is built from these parts. Pick one to investigate; the full reading of every piece is in your report.</p>
      <div class="xtabs" role="tablist" id="xtabs">${["Planets", ...(Tk ? ["Houses"] : []), "Aspects", "Patterns", "Mechanics"].map((x, i) => `<button role="tab" data-x="${x.toLowerCase()}" aria-selected="${i === 0}">${x}</button>`).join("")}</div></div>${wave()}</section>`;

    const ask = sec("ask", "pearl", "VIII", "Questions this chart can answer", "Ask my <em>chart</em>",
      `<p class="lede" style="margin:-30px 0 30px">These questions are generated from what's actually notable in this chart. Each answer shows its evidence and lights it up on the wheel.</p>
      <div class="ask"><div class="ask-q">${r.ask.map((x, i) => `<button data-i="${i}">${esc(x.q)}</button>`).join("")}</div><div class="ask-a" id="askA" aria-live="polite"></div></div>
      <a class="cta" href="#/report"><span>Want every placement, house and aspect in one place?</span><b>Download my full report ↓</b></a>`);

    const sky = sec("sky", "shell", "I", "The whole sky", "Placement by <em>placement</em>",
      `<p class="lede" style="margin:-30px 0 40px">Every placement in plain words. Tap one in the list, or a planet on the wheel, to read it.</p>
      <div class="sky-grid"><div class="sky-list">${skyGroups(c).map(([h, items]) => `<div class="label">${h}</div><ul>${items.map(x => `<li><button class="sky-row" data-k="${x.k}" aria-pressed="false"><span class="g">${T(x.g)}</span><b>${esc(x.label)}</b><span class="pl">${esc(x.place)}</span></button></li>`).join("")}</ul>`).join("")}</div>
      <div class="sky-side"><article class="sky-card" id="skyCard" aria-live="polite"></article><div class="sky-wheel" id="skyWheel"></div></div></div>`);

    $("#w-chart").innerHTML = hero + sky + headline + bigThree + portrait + life + wheel + explore + panels() + ask;
    wireChartWorld();
  }
  // ---------- your sky (one placement at a time) ----------
  const SMALL = new Set(["a", "an", "and", "the", "of", "to", "in", "on"]);
  const titleCase = s => s.split(" ").map((w, i) => i && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1)).join(" ");
  const degMin = lon => { const x = ((lon % 360) + 360) % 360 % 30; return `${Math.floor(x)}°${String(Math.floor((x % 1) * 60)).padStart(2, "0")}′`; };
  function skyGroups(c) {
    const P = c.P, B = S.reading.big, R = S.reading.planets, Tk = c.timeKnown;
    const at = n => `${n} in ${P[n].sign}, ${degMin(P[n].lon)}${Tk ? `, ${ord(P[n].house)} house` : ""}${P[n].retrograde ? ", retrograde" : ""}`;
    const big = [
      { k: "Sun", g: PG.Sun, label: "Who I Am", place: `${c.sun_sign} Sun`, sign: c.sun_sign, placement: at("Sun"), text: B.sun.text },
      { k: "Moon", g: PG.Moon, label: "How I Feel", place: `${c.moon_sign} Moon${c.moonUncertain ? "?" : ""}`, sign: c.moon_sign, placement: at("Moon"), text: B.moon.text },
      ...(Tk ? [{ k: "Rising", g: "↑", label: "How I Show Up", place: `${c.rising_sign} Rising`, sign: c.rising_sign, placement: `Ascendant in ${c.rising_sign}, ${degMin(c.asc)}`, text: B.rising.text }] : []),
    ];
    const rest = PLANETS.slice(2).map(n => ({ k: n, g: PG[n], label: titleCase(R[n].label), place: `${P[n].sign} ${n}`, sign: P[n].sign, placement: at(n), text: R[n].text }));
    return [[Tk ? "The Big Three" : "Sun and Moon", big], ["The rest of the sky", rest]];
  }
  function buildSky() {
    const c = S.chart, items = skyGroups(c).flatMap(g => g[1]), byK = Object.fromEntries(items.map(x => [x.k, x]));
    const dark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    let cur = "Sun";
    const pick = k => {
      cur = k; const x = byK[k], n = k === "Rising" ? null : k;
      const as = n ? c.major.filter(a => a.a === n || a.b === n) : [];
      $$(".sky-row").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === k));
      $("#skyCard").innerHTML = `<div class="label">${esc(x.label)}</div><h3><span class="g">${T(x.g)}</span> ${esc(x.place)}</h3>
        <dl><dt class="label">Placement</dt><dd class="pm" data-c="calc">${esc(x.placement)}</dd>
        <dt class="label">What the stars say</dt><dd data-c="interp">${esc(x.text)}</dd>
        <dt class="label">${esc(x.sign)}, in a few words</dt><dd class="kw" data-c="doctrine">${esc(L.SIGN[x.sign].key)}</dd></dl>
        ${as.length ? `<div class="sky-asp">${as.map(a => { const o = a.a === n ? a.b : a.a; return `<button data-k="${o}" style="--t:${TONEC[TONE[a.type]]}"><span class="g">${T(AG[a.type])}</span> ${a.type} ${o}</button>`; }).join("")}</div>` : ""}`;
      $("#skyCard").classList.remove("in"); void $("#skyCard").offsetWidth; $("#skyCard").classList.add("in");
      $$("#skyCard .sky-asp button").forEach(b => b.onclick = () => pick(b.dataset.k));
      const hlSet = n ? [n, ...as.map(a => a.a === n ? a.b : a.a)] : null;
      const w = drawWheel({ inner: innerOf(c), aspects: c.major.map(a => ({ ...a, hl: !!n && (a.a === n || a.b === n) })), centreSign: centre(c), highlight: hlSet, size: 520, theme: dark() ? "dark" : "light", ascLabel: c.timeKnown });
      w.setAttribute("role", "img"); w.setAttribute("aria-label", `Chart wheel${n ? `, ${n} highlighted` : ""}`);
      w.querySelectorAll(".wp").forEach(g => g.onclick = () => pick(g.dataset.p));
      $("#skyWheel").innerHTML = ""; $("#skyWheel").appendChild(w);
      fitSide();
    };
    // keep the card and wheel in view together: shrink the wheel to fit beside the sticky card
    const fitSide = () => {
      const side = $(".sky-side"); if (!side) return;
      if (matchMedia("(max-width: 900px)").matches) { $("#skyWheel").style.maxWidth = ""; side.style.top = ""; return; }
      $("#skyWheel").style.maxWidth = Math.max(260, Math.min(460, innerHeight - 140 - $("#skyCard").offsetHeight)) + "px";
      side.style.top = Math.min(110, innerHeight - side.offsetHeight - 16) + "px";
    };
    addEventListener("resize", fitSide);
    $$(".sky-row").forEach(b => b.onclick = () => { pick(b.dataset.k); if (matchMedia("(max-width: 900px)").matches) $("#skyCard").scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); });
    S.renderSky = () => pick(cur);
    pick(cur);
  }

  // ---------- hero orbit (zodiac ring, moon, and your Sun sign circling it) ----------
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function heroOrbit(c) {
    const ring = SIGNS.map((s, i) => { const a = (i * 30 + 15) * Math.PI / 180, b = i * 30 * Math.PI / 180;
      return `<text x="${260 + 221 * Math.cos(a)}" y="${260 + 221 * Math.sin(a) + 6}" text-anchor="middle" font-size="16" fill="#e3c27e" fill-opacity=".75" class="g">${T(SG[i])}</text>
        <line x1="${260 + 206 * Math.cos(b)}" y1="${260 + 206 * Math.sin(b)}" x2="${260 + 236 * Math.cos(b)}" y2="${260 + 236 * Math.sin(b)}" stroke="#cfa95e" stroke-opacity=".3"/>`; }).join("");
    const upright = reduceMotion ? "" : `<animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="60s" repeatCount="indefinite"/>`;
    const token = (y, fill, glyph, name) => `<g transform="translate(260 ${y})"><g>${upright}<circle r="38" fill="${fill}" opacity=".95"/><circle r="46" fill="none" stroke="#fff6de" stroke-opacity=".25"/>
      <text y="11" text-anchor="middle" font-size="32" fill="#10333a" class="g">${T(glyph)}</text><text y="64" text-anchor="middle" font-size="11" letter-spacing="2.5" fill="#f3dfb3" font-family="DM Sans" font-weight="700">${name.toUpperCase()}</text></g></g>`;
    const pair = c.sun_sign === "Pisces"
      ? `<use href="#koi" fill="url(#koiA)" transform="translate(260 84) rotate(-90) scale(.9)"/><use href="#koi" fill="url(#koiB)" transform="translate(260 436) rotate(90) scale(.9)"/>`
      : token(84, "url(#koiB)", SG[SIGNS.indexOf(c.sun_sign)], `${c.sun_sign} Sun`) + token(436, "url(#koiA)", SG[SIGNS.indexOf(c.moon_sign)], `${c.moon_sign} Moon`);
    return `<svg viewBox="0 0 520 520"><defs>
        <radialGradient id="moonG" cx=".38" cy=".32"><stop offset="0" stop-color="#fffdf6"/><stop offset=".55" stop-color="#f4e9d6"/><stop offset=".85" stop-color="#e4d2b8"/><stop offset="1" stop-color="#c9b394"/></radialGradient>
        <radialGradient id="haloG"><stop offset=".45" stop-color="#f6efd9" stop-opacity=".35"/><stop offset="1" stop-color="#f6efd9" stop-opacity="0"/></radialGradient>
        <linearGradient id="koiA" x1="0" x2="1"><stop offset="0" stop-color="#d7f1ea"/><stop offset=".5" stop-color="#8fd0c6"/><stop offset="1" stop-color="#4f9e98"/></linearGradient>
        <linearGradient id="koiB" x1="0" x2="1"><stop offset="0" stop-color="#fbe3e6"/><stop offset=".55" stop-color="#eaa9b6"/><stop offset="1" stop-color="#d9b56e"/></linearGradient>
        <g id="koi"><path d="M0 -40 C 26 -24, 26 20, 0 46 C -26 20, -26 -24, 0 -40 Z"/><path d="M0 44 C 14 60, 22 78, 10 92 C 3 78, -3 78, -10 92 C -22 78, -14 60, 0 44 Z" opacity=".85"/><path d="M-16 -4 C -40 4, -42 20, -30 26 C -26 14, -20 10, -14 8 Z M16 -4 C 40 4, 42 20, 30 26 C 26 14, 20 10, 14 8 Z" opacity=".7"/></g>
      </defs>
      <g class="spin-r"><circle cx="260" cy="260" r="236" fill="none" stroke="#cfa95e" stroke-opacity=".35"/><circle cx="260" cy="260" r="206" fill="none" stroke="#cfa95e" stroke-opacity=".2"/>${ring}</g>
      <circle cx="260" cy="260" r="176" fill="none" stroke="#cfa95e" stroke-opacity=".55" stroke-dasharray="1.5 7"/>
      <circle cx="260" cy="260" r="120" fill="url(#haloG)"/><circle cx="260" cy="260" r="68" fill="url(#moonG)"/><circle cx="260" cy="260" r="80" fill="none" stroke="#fff6de" stroke-opacity=".22"/>
      <g class="spin">${pair}</g></svg>`;
  }
  // moonlight glints, as in the original atlas
  function glints(hero) {
    if (reduceMotion || !hero || hero.querySelector(".glint")) return;
    for (let i = 0; i < 34; i++) {
      const g = document.createElement("span"), sz = 1.5 + Math.random() * 3; g.className = "glint";
      Object.assign(g.style, { left: Math.random() * 100 + "%", top: 10 + Math.random() * 85 + "%", width: sz + "px", height: sz + "px", animationDuration: 2.5 + Math.random() * 4 + "s", animationDelay: -Math.random() * 5 + "s" });
      hero.appendChild(g);
    }
  }
  glints($("#start"));

  function waitBox(w) {
    return `<div class="wait" data-c="interp"><div class="wt-k">Wait —</div><b>${esc(w.title)}</b><p>${esc(w.text)}</p>${w.not ? `<div class="wt-cols"><div><span class="label">What it doesn't mean</span><ul>${w.not.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div><div><span class="label">How the chart compensates</span><ul>${w.compensates.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>` : ""}</div>`;
  }

  // ---------- explore panels ----------
  function panels() {
    const c = S.chart, r = S.reading, P = c.P, Tk = c.timeKnown;
    const order = PLANETS;
    const most = [...order].sort((a, b) => c.major.filter(x => x.a === b || x.b === b).length - c.major.filter(x => x.a === a || x.b === a).length)[0];
    const psys = [
      ...(Tk ? [["Chart ruler", `${T(PG[c.rulers.chart_ruler[0]])} ${c.rulers.chart_ruler[0]}`, `rules ${c.rising_sign} Rising`]] : []),
      ["Most connected", `${T(PG[most])} ${most}`, `${c.major.filter(x => x.a === most || x.b === most).length} major aspects`],
      ["Tightest link", c.major[0] ? aspTitle(c.major[0]) : "—", c.major[0] ? `${c.major[0].orb}° from exact` : ""],
      ...(Tk ? [["Angular", c.house_types.angular.map(n => T(PG[n])).join(" ") || "None", c.house_types.angular.join(", ") || "no planets on the angles"]] : []),
      ["Retrograde", c.planets.filter(p => p.retrograde).map(p => T(PG[p.planet])).join(" ") || "None", c.planets.filter(p => p.retrograde).map(p => p.planet).join(", ") || "all planets direct"],
      ["Unaspected", c.unaspected.map(n => T(PG[n])).join(" ") || "None", c.unaspected.join(", ") || "every planet is connected"],
    ];
    const planetsPanel = `<section class="env env-book xpanel" data-xpanel="planets" id="planets"><div class="wrap"><div class="sec-head"><div class="label">Ten placements</div><h2>The <em>Planets</em></h2></div>
      <div class="psys">${psys.map(([l, b, s]) => `<div data-c="calc"><small>${l}</small><b class="g-mix">${b}</b><span>${esc(s)}</span></div>`).join("")}</div>
      <div id="entries">${order.map(n => { const p = P[n], R = r.planets[n]; return `<article class="entry" id="p-${n}"><div class="seal g">${T(PG[n])}</div><div>
        <button class="head" aria-expanded="false"><div class="label">${esc(R.label)}</div><h3>${n} in <em>${p.sign}</em></h3><div class="meta" data-c="calc">${meta(p)}</div></button>
        <div class="tabs" role="tablist" data-for="sc-${n}"><button role="tab" aria-selected="true" data-k="modern">Modern</button><button role="tab" aria-selected="false" data-k="trad">Traditional</button><button role="tab" aria-selected="false" data-k="evo">Evolutionary</button></div>
        <div class="tabpane" id="sc-${n}" data-c="interp">${esc(R.text)}</div>
        <template data-k="modern">${esc(R.text)}</template><template data-k="trad">${esc(R.trad)}</template><template data-k="evo">An evolutionary astrologer might frame it as a direction of growth: ${esc(R.evo)}</template>
        ${scope(n)}</div></article>`; }).join("")}</div>
      <a class="cta" href="#/report"><span>Want all ten planetary interpretations in full?</span><b>Download my full report ↓</b></a></div>${wave()}</section>`;
    const housesPanel = Tk ? `<section class="env env-glass xpanel" data-xpanel="houses" id="houses" hidden><div class="wrap"><div class="sec-head"><div class="label">Twelve rooms</div><h2>The <em>Houses</em></h2></div>
      <div class="houses"><div class="dial" id="dial"></div><div class="hdetail" id="hdetail" aria-live="polite"></div></div>
      <div class="spread" style="margin-top:50px"><div><div class="label">Six axes, not twelve boxes</div><ul class="axes">${L.AXES.map(([a, b, n]) => `<li><span class="pair">${ROMAN[a - 1]} ↔ ${ROMAN[b - 1]}</span><div><b>${n}</b><span>${esc(L.HOUSE[a].area)} ↔ ${esc(L.HOUSE[b].area)}</span><span class="who g">${[a, b].map(h => c.houses[h - 1].planets.map(p => T(PG[p])).join(" ")).join("  ↔  ")}</span></div></li>`).join("")}</ul></div>
      <div><div class="label">Where house meanings came from</div><p data-c="doctrine">House meanings weren't assigned by matching House 1 to Aries, House 2 to Taurus and so on. In Hellenistic astrology they grew from geometry: which places sit on the angles, which ones "see" the Ascendant by aspect, and the planetary joys.</p>
      <p class="note"><b>Is the 1st house secretly Aries?</b>No. A house is not a sign. The "natural houses" scheme is a modern teaching device, not how house meanings arose. Your 1st house is ${c.houses[0].sign}.</p>
      <p data-c="calc" style="color:var(--muted)">This chart uses ${c.houseSystem} houses. ${c.houseNote ? esc(c.houseNote) + " " : ""}There has never been one agreed house system; switch systems on the wheel to compare.</p></div></div>
      <a class="cta" href="#/report"><span>Want the complete house-by-house reading?</span><b>Download my full report ↓</b></a></div>${wave()}</section>` : "";
    const minor = c.aspects.filter(a => a.class === "minor");
    const aspectsPanel = `<section class="env env-night xpanel" data-xpanel="aspects" id="aspects" hidden><div class="wrap"><div class="sec-head"><div class="label">How the planets talk</div><h2>The <em>Aspects</em></h2></div>
      <p class="lede" style="margin:-30px 0 30px">Aspects are angles between planets. <span style="color:var(--flow)">Aqua</span> flows, <span style="color:var(--tension)">rose</span> creates friction, <span style="color:var(--blend)">gold</span> fuses.</p>
      <div class="aspgrid">${[["Nearly exact", a => a.orb < 1], ["Blends", a => TONE[a.type] === "blend" && a.orb >= 1], ["Harmonies", a => TONE[a.type] === "flow" && a.orb >= 1], ["Tensions", a => TONE[a.type] === "tension" && a.orb >= 1]].map(([h, f]) => `<div><h4>${h}</h4><ul>${c.major.filter(f).map(a => `<li><button data-asp="${c.major.indexOf(a)}"><span class="g" style="color:${TONEC[TONE[a.type]]}">${T(AG[a.type])}</span> ${a.a} ${a.type} ${a.b} <span class="orb">${a.orb}° ${a.applying ? "applying" : "separating"}</span></button></li>`).join("") || "<li class='muted'>none</li>"}</ul></div>`).join("")}</div>
      <div class="asp-detail" id="aspDetail" aria-live="polite"></div>
      <div class="spread" style="margin-top:40px"><div><div class="label">Minor aspects</div><ul class="tlist">${minor.map(a => `<li><span class="d">${a.applying ? "→ applying" : "← separating"}</span><span data-c="calc">${a.a} ${a.type} ${a.b} <span style="color:var(--muted)">· ${a.orb}°</span></span></li>`).join("") || "<li><span></span><span class='muted'>none within orb</span></li>"}</ul></div>
      <div><div class="label">Patterns & shape</div><p data-c="calc">Chart shape: <b>${c.shape.shape}</b>${c.shape.gaps_over_60.length ? ` (empty stretches of ${c.shape.gaps_over_60.join("° and ")}°)` : ""}. Named patterns found: <b>${c.patterns.length ? [...new Set(c.patterns.map(p => `${p.type} (${p.planets.join(", ")})`))].join("; ") : "none"}</b>${c.stelliums.length ? `. Concentrations: ${c.stelliums.map(s => `${s.planets.join(", ")} in ${typeof s.where === "number" ? "the " + ord(s.where) + " house" : s.where}`).join("; ")}` : ""}.</p></div></div>
      <a class="cta" href="#/report"><span>Want every aspect, orb and minor aspect?</span><b>Download my full report ↓</b></a></div>${wave()}</section>`;
    const patternsPanel = `<section class="env env-pearl xpanel" data-xpanel="patterns" id="patterns" hidden><div class="wrap"><div class="sec-head"><div class="label">Elements · modalities · rulers</div><h2>The <em>Patterns</em></h2></div>
      <div class="spread"><div><div class="label">Elements</div><div class="vessels">${EL.map(e => `<div class="vessel" style="--c:var(--${e.toLowerCase()})"><div class="jar">${Tk && Math.floor(c.asc / 30) % 4 === EL.indexOf(e) && !c.elements[e].length ? `<div class="ring">${esc(c.rising_sign)} rising</div>` : ""}<div class="fill" style="height:${c.elements[e].length / 5 * 100}%"></div><div class="glyphs g">${c.elements[e].map(p => T(PG[p])).join(" ")}</div></div><b>${c.elements[e].length}</b><span>${e}</span></div>`).join("")}</div></div>
      <div><div class="label">Modalities</div><div class="lanes">${MOD.map(m => `<div class="lane"><span class="nm">${m}</span><div class="track">${c.modalities[m].map(p => `<span class="pb g" title="${p}">${T(PG[p])}</span>`).join("") || `<span class="annot">empty</span>`}</div><span class="ct">${c.modalities[m].length}</span></div>`).join("")}</div></div></div>
      <hr class="rule"><div class="spread"><div><div class="label">Rulers</div><ul class="chain">${[["Sun", c.sun_sign], ["Moon", c.moon_sign], ...(Tk ? [["Rising", c.rising_sign]] : [])].map(([k, s]) => { const ru = window.Engine.TRULER[s]; return `<li><span class="from">${k} in ${s}</span><span class="arrow">→</span><div class="to"><b>${ru}</b><small>${P[ru].sign}${Tk ? " · " + ord(P[ru].house) + " house" : ""}</small></div></li>`; }).join("")}</ul></div>
      <div><div class="label">Retrogrades & nodes</div><p data-c="doctrine">${c.planets.filter(p => p.retrograde).length ? `${c.planets.filter(p => p.retrograde).map(p => p.planet).join(", ")} ${c.planets.filter(p => p.retrograde).length > 1 ? "were" : "was"} retrograde at birth. Retrograde planets are traditionally read as working inward first: reflecting and revising before acting.` : "No planets were retrograde at birth."}</p>
      <p data-c="doctrine">North Node in ${c.points.north_node.sign}${Tk ? ` (${ord(c.points.north_node.house)} house)` : ""}, South Node in ${c.points.south_node.sign}. In Western astrology the nodes describe a direction of growth: from ${c.points.south_node.sign} habits toward ${c.points.north_node.sign} qualities.</p></div></div></div>${wave()}</section>`;
    const yn = (v, bad) => v ? `<span class="${bad ? "n" : "y"}">${bad ? "✕" : "✓"}</span>` : "·";
    const mechPanel = `<section class="env env-book xpanel" data-xpanel="mechanics" id="mechanics" hidden><div class="wrap"><div class="sec-head"><div class="label">Advanced chart mechanics</div><h2>Under the <em>hood</em></h2></div>
      <div class="scroll-x"><table class="dig" data-c="doctrine"><tr><th>Planet</th><th>Sign</th><th>Domicile</th><th>Exalt.</th><th>Trip.</th><th>Bound</th><th>Face</th><th>Detr.</th><th>Fall</th><th>Score</th></tr>${c.dignities.map(d => `<tr><td><span class="g">${T(PG[d.planet])}</span> ${d.planet}</td><td>${d.sign}</td><td>${yn(d.domicile)}</td><td>${yn(d.exaltation)}</td><td>${yn(d.triplicity)}</td><td>${yn(d.bound)}</td><td>${yn(d.face)}</td><td>${yn(d.detriment, 1)}</td><td>${yn(d.fall, 1)}</td><td class="sc">${d.score > 0 ? "+" : ""}${d.score}${d.peregrine ? " <small>peregrine</small>" : ""}</td></tr>`).join("")}</table></div>
      <div class="spread" style="margin-top:30px"><div>${c.sect ? `<div class="label">Sect</div><p data-c="doctrine">A ${c.sect.chart} chart (the Sun was ${c.sect.chart === "day" ? "above" : "below"} the horizon). Sect light: ${c.sect.light}; benefic of sect: ${c.sect.benefic}; malefic of sect: ${c.sect.malefic}.</p>` : `<p class="muted">Sect needs a birth time.</p>`}
        <div class="label">Dispositors</div><p data-c="doctrine">${c.dispositors.traditional.final.length ? `Final dispositor: ${c.dispositors.traditional.final.join(", ")}.` : "No final dispositor: the rulership chains end in a loop."} ${c.dispositors.modern.receptions.length ? `Mutual receptions: ${c.dispositors.modern.receptions.map(x => x.join(" & ")).join("; ")}.` : ""}</p></div>
      <div><div class="label">Fixed stars & points</div><ul class="facts">${c.stars.map(s => `<li data-c="astro"><span>${s.planet} ☌ ${s.star}</span><span>${s.orb}°</span></li>`).join("") || "<li><span class='muted'>No close fixed-star contacts</span></li>"}
        <li data-c="astro"><span>☊ Mean North Node</span><span>${c.points.north_node.degree}° ${c.points.north_node.sign}</span></li><li data-c="astro"><span>⚸ Mean Black Moon Lilith</span><span>${c.points.lilith.degree}° ${c.points.lilith.sign}</span></li></ul>
        <p class="muted">Decans: ${c.decans.map(d => `${d.planet} ${ord(d.decan)} of ${d.sign}`).join(" · ")}.</p></div></div></div>${wave()}</section>`;
    return planetsPanel + housesPanel + aspectsPanel + patternsPanel + mechPanel;
  }
  function scope(n) {
    const c = S.chart, p = c.P[n];
    const obs = `At birth, ${n}'s geocentric ecliptic longitude was ${p.degree}°${String(p.minute).padStart(2, "0")}′ ${p.sign} (${(p.lon).toFixed(2)}° from 0° Aries). ${p.retrograde ? "It appeared to move backward (retrograde), a real apparent motion seen from Earth." : "It was moving forward."}`;
    const calc = c.timeKnown ? `In the ${ord(p.house)} house by ${c.houseSystem} division. The sign is fixed by the date; the house depends on the exact birth time.` : "Without a birth time, houses can't be calculated; the sign is fixed by the date.";
    return `<details class="scope"><summary>🔭 Under the telescope</summary><ol>
      <li data-c="astro"><span class="ic">🔭</span><div><b>Observation · astronomy</b><p>${esc(obs)}</p></div></li>
      <li data-c="calc"><span class="ic">∑</span><div><b>Calculation · math + convention</b><p>${esc(calc)}</p></div></li>
      <li data-c="doctrine"><span class="ic">🏛</span><div><b>Tradition · historical doctrine</b><p>${esc(L.PLANET[n].sig)}</p></div></li>
      <li data-c="interp"><span class="ic">✦</span><div><b>Interpretation · astrology</b><p>The reading above applies that doctrine to this sign, house and set of aspects.</p></div></li>
      <li data-c="science"><span class="ic">🔬</span><div><b>Evidence · scientific status</b><p>${esc(L.EVIDENCE)}</p></div></li></ol></details>`;
  }

  // ---------- interactive wheel ----------
  function buildWheel() {
    const c = S.chart, P = c.P, NS = "http://www.w3.org/2000/svg";
    const W = 640, cx = 320, R1 = 300, R2 = 256, RP = 214, RA = 160, RH = 238;
    const zero = c.timeKnown ? c.asc : 0;
    const ang = lon => Math.PI + (lon - zero) * Math.PI / 180, pt = (lon, rr) => [cx + rr * Math.cos(ang(lon)), cx - rr * Math.sin(ang(lon))];
    const svg = el("svg", { viewBox: `0 0 ${W} ${W}`, role: "img", "aria-label": "Natal chart wheel" });
    const ELC = { Fire: "var(--fire)", Earth: "var(--earth)", Air: "var(--air)", Water: "var(--water)" };
    el("circle", { cx, cy: cx, r: R1 + 8, fill: "none", stroke: "#cfa95e", "stroke-opacity": .35 }, svg);
    const sectors = el("g", {}, svg);
    SIGNS.forEach((s, i) => {
      const g = el("g", { class: "sector", tabindex: 0, role: "button", "aria-label": s }, sectors);
      const [x1, y1] = pt(i * 30, R1), [x2, y2] = pt(i * 30 + 30, R1), [x3, y3] = pt(i * 30 + 30, R2), [x4, y4] = pt(i * 30, R2);
      el("path", { d: `M${x1},${y1} A${R1},${R1} 0 0 0 ${x2},${y2} L${x3},${y3} A${R2},${R2} 0 0 1 ${x4},${y4} Z`, fill: ELC[EL[i % 4]], "fill-opacity": .16, stroke: "#cfa95e", "stroke-opacity": .35 }, g);
      const [tx, ty] = pt(i * 30 + 15, (R1 + R2) / 2); const t = el("text", { x: tx, y: ty + 8, "text-anchor": "middle", "font-size": 22, fill: "#f3dfb3", class: "g" }, g); t.textContent = T(SG[i]);
      g.onclick = () => showSign(s); g.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showSign(s); } };
    });
    el("circle", { cx, cy: cx, r: R2, fill: "#0a2027", "fill-opacity": .55, stroke: "#cfa95e", "stroke-opacity": .35 }, svg);
    el("circle", { cx, cy: cx, r: RA, fill: "none", stroke: "#cfa95e", "stroke-opacity": .18 }, svg);
    for (let d = 0; d < 360; d += 5) { const [a1, b1] = pt(d, R2), [a2, b2] = pt(d, R2 - (d % 30 === 0 ? 12 : 5)); el("line", { x1: a1, y1: b1, x2: a2, y2: b2, stroke: "#cfa95e", "stroke-opacity": .35 }, svg); }
    const hg = el("g", { class: "houses-g" }, svg);
    if (c.cusps) c.cusps.forEach((cu, i) => {
      const angle = i % 3 === 0, [a1, b1] = pt(cu, R2), [a2, b2] = pt(cu, angle ? 40 : RA);
      el("line", { x1: a1, y1: b1, x2: a2, y2: b2, stroke: angle ? "#e3c27e" : "#cfa95e", "stroke-opacity": angle ? .9 : .35, "stroke-width": angle ? 1.8 : 1 }, hg);
      const mid = cu + ((c.cusps[(i + 1) % 12] - cu + 360) % 360) / 2, [hx, hy] = pt(mid, RA - 16);
      const t = el("text", { x: hx, y: hy + 4, "text-anchor": "middle", "font-size": 12, fill: "#a8c3c0", "font-family": "Cormorant Garamond, serif", "font-style": "italic", class: "hnum", tabindex: 0, role: "button", "aria-label": `House ${i + 1}` }, hg); t.textContent = ROMAN[i];
      t.onclick = () => showHouse(i + 1);
      if (angle) { const lab = ["ASC", "IC", "DSC", "MC"][i / 3], [lx, ly] = pt(cu, R1 + 22); const tl = el("text", { x: lx, y: ly + 4, "text-anchor": "middle", "font-size": 12, fill: "#e3c27e", "font-family": "DM Sans", "font-weight": 700 }, svg); tl.textContent = lab; }
    });
    const disp = c.planets.map(p => ({ n: p.planet, lon: p.lon, d: p.lon })).sort((a, b) => a.lon - b.lon);
    for (let pass = 0; pass < 30; pass++) for (let i = 0; i < disp.length; i++) { const a = disp[i], b = disp[(i + 1) % disp.length], gap = (b.d - a.d + 360) % 360; if (gap < 9) { a.d -= (9 - gap) / 2; b.d += (9 - gap) / 2; } }
    const D = Object.fromEntries(disp.map(x => [x.n, x]));
    const aspG = el("g", {}, svg), lines = [];
    c.major.forEach((a, i) => {
      const [x1, y1] = pt(D[a.a].lon, RA - 30), [x2, y2] = pt(D[a.b].lon, RA - 30);
      const ln = el("line", { x1, y1, x2, y2, stroke: TONEC[TONE[a.type]], "stroke-width": a.orb < 1 ? 2.4 : 1.4, "stroke-opacity": .85, "stroke-dasharray": a.type === "sextile" ? "4 4" : "", class: "asp" }, aspG);
      const hit = el("line", { x1, y1, x2, y2, class: "asp-hit" }, aspG); hit.onclick = () => showAspect(i); lines.push(ln);
    });
    const plEls = {};
    disp.forEach(x => {
      const p = P[x.n], [t1, u1] = pt(x.lon, R2), [t2, u2] = pt(x.lon, R2 - 16), [px, py] = pt(x.d, RP);
      el("line", { x1: t1, y1: u1, x2: t2, y2: u2, stroke: "#f3dfb3", "stroke-width": 2 }, svg);
      const g = el("g", { class: "pl", tabindex: 0, role: "button", "aria-label": `${x.n} in ${p.sign}` }, svg);
      el("circle", { cx: px, cy: py, r: 17, class: "b", fill: "#fbf6ee", stroke: "#cfa95e", "stroke-width": 1.2 }, g);
      const t = el("text", { x: px, y: py + 6.5, "text-anchor": "middle", "font-size": 18, fill: "#10333a", class: "g" }, g); t.textContent = T(PG[x.n]);
      if (p.retrograde) { const rr = el("text", { x: px + 15, y: py - 11, "font-size": 11, fill: "#f0a3b5", "font-family": "DM Sans", "font-weight": 700 }, g); rr.textContent = "℞"; }
      g.onclick = () => showPlanet(x.n); g.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showPlanet(x.n); } };
      g.onmouseenter = () => hl([x.n, ...c.major.filter(a => a.a === x.n || a.b === x.n).map(a => a.a === x.n ? a.b : a.a)], c.major.map((a, i) => (a.a === x.n || a.b === x.n) ? i : -1), true);
      g.onmouseleave = () => restore();
      plEls[x.n] = g;
    });
    $("#wheel").innerHTML = ""; $("#wheel").appendChild(svg);
    let locked = null;
    function hl(planets, idx, temp) {
      if (!temp) locked = [planets, idx];
      $("#wheel").classList.toggle("dim", planets.length > 0);
      Object.entries(plEls).forEach(([n, g]) => { g.classList.toggle("hl", planets.includes(n)); g.classList.toggle("sel", planets[0] === n); });
      lines.forEach((l, i) => l.classList.toggle("hl", idx.includes(i)));
    }
    const restore = () => locked ? hl(locked[0], locked[1]) : hl([], []);
    S.highlight = hl;
    const panel = $("#panel");
    function overview() {
      hl([], []); locked = null;
      panel.innerHTML = `<div class="label">Overview</div><h3><em>${c.sun_sign}</em> Sun, <em>${c.moon_sign}</em> Moon${c.timeKnown ? `, <em>${c.rising_sign}</em> rising` : ""}</h3>
        <p>${c.timeKnown ? "The Ascendant sits at the left, where the sky met the eastern horizon; gold lines are the four angles. " : "Without a birth time, the wheel starts at 0° Aries and has no houses. "}Planets travel counter-clockwise through the signs; lines through the middle are aspects.</p>
        <p class="hint">Hover or tap any planet, sign${c.timeKnown ? ", house number" : ""} or line.</p>
        <div class="stat-row"><div><b>10</b>planets</div><div><b>${c.major.length}</b>major aspects</div><div><b>${c.planets.filter(p => p.retrograde).length}</b>retrograde</div></div>`;
    }
    function showPlanet(n) {
      const p = P[n], R = S.reading.planets[n], as = c.major.filter(a => a.a === n || a.b === n);
      hl([n, ...as.map(a => a.a === n ? a.b : a.a)], as.map(a => c.major.indexOf(a)));
      panel.innerHTML = `<div class="label">${esc(R.label)}</div><h3><span class="g" style="color:var(--accent)">${T(PG[n])}</span> ${n} in <em>${p.sign}</em></h3><div class="meta" data-c="calc">${meta(p)}</div>
        <button class="trace-btn" id="traceBtn">Trace this placement</button><p data-c="interp">${esc(R.text)}</p>
        <ul class="alist">${as.map(a => `<li><button data-asp="${c.major.indexOf(a)}"><span class="g" style="color:${TONEC[TONE[a.type]]}">${T(AG[a.type])}</span> ${a.type} ${a.a === n ? a.b : a.a} <span style="color:var(--muted)">· ${a.orb}°</span></button></li>`).join("")}</ul>
        <p class="hint"><button class="lnk" id="ovBtn">Back to overview</button></p>`;
      panel.querySelectorAll("[data-asp]").forEach(b => b.onclick = () => showAspect(+b.dataset.asp));
      panel.querySelector("#ovBtn").onclick = overview;
      panel.querySelector("#traceBtn").onclick = () => trace(n);
    }
    function trace(n) {
      const chain = (c.dispositors.traditional.chains[n] || c.dispositors.modern.chains[n] || []).slice(1);
      const hosts = PLANETS.filter(m => m !== n && (window.Engine.TRULER[P[m].sign] === n || window.Engine.MRULER[P[m].sign] === n));
      const as = c.major.filter(a => a.a === n || a.b === n);
      hl([...new Set([n, ...as.map(a => a.a === n ? a.b : a.a), ...chain, ...hosts])], as.map(a => c.major.indexOf(a)));
      panel.innerHTML = `<div class="label">Tracing</div><h3><span class="g" style="color:var(--accent)">${T(PG[n])}</span> Everything connected to <em>${n}</em></h3>
        <ul class="trace" data-c="calc"><li><b>Sits in</b>${P[n].sign}${c.timeKnown ? `, ${ord(P[n].house)} house` : ""}</li><li><b>Talks to</b>${as.map(a => `${T(AG[a.type])} ${a.a === n ? a.b : a.a}`).join(" · ") || "no major aspects"}</li>
        <li><b>Answers to</b>${chain.length ? [n, ...chain].join(" → ") : "itself"}</li><li><b>Hosts</b>${hosts.join(", ") || "no other planets"}</li></ul><p class="hint"><button class="lnk" id="bk">Back to ${n}</button></p>`;
      panel.querySelector("#bk").onclick = () => showPlanet(n);
    }
    function showSign(s) {
      const inIt = c.planets.filter(p => p.sign === s).map(p => p.planet), i = SIGNS.indexOf(s);
      hl(inIt, []);
      panel.innerHTML = `<div class="label">${EL[i % 4]} · ${MOD[i % 3]}</div><h3><span class="g" style="color:var(--accent)">${T(SG[i])}</span> <em>${s}</em></h3><p data-c="doctrine">${s} is associated with ${esc(L.SIGN[s].key)}.</p><p>${inIt.length ? `Holds ${inIt.join(", ")} in this chart.` : "No planets here in this chart."}${s === c.rising_sign ? " It is also your rising sign." : ""}</p>`;
    }
    function showHouse(h) {
      const hh = c.houses[h - 1]; hl(hh.planets, []);
      panel.innerHTML = `<div class="label">${ord(h)} house · ${esc(L.HOUSE[h].ancient)}</div><h3><em>${esc(L.HOUSE[h].name)}</em></h3><p data-c="doctrine">Traditionally associated with ${esc(L.HOUSE[h].area)}. ${[1, 4, 7, 10].includes(h) ? "An angular house" : [2, 5, 8, 11].includes(h) ? "A succedent house" : "A cadent house"}, ${esc(L.TO_ASC[h])}.</p>
        <p>${hh.sign} on the cusp, ruled by ${window.Engine.TRULER[hh.sign]} (in the ${ord(P[window.Engine.TRULER[hh.sign]].house)} house). ${hh.planets.length ? `Holds ${hh.planets.join(", ")}.` : "No planets here: the cusp sign and its ruler still describe this area of life."}</p>`;
    }
    function showAspect(i) {
      const a = c.major[i]; hl([a.a, a.b], [i]);
      panel.innerHTML = `<div class="label" style="color:${TONEC[TONE[a.type]]}">${a.type} · ${L.ASPECT[a.type].about}</div><h3><span class="g">${T(PG[a.a])}</span> ${T(AG[a.type])} <span class="g">${T(PG[a.b])}</span> <em>${a.a} ${a.type} ${a.b}</em></h3>
        <div class="meta" data-c="calc">${a.orb}° from exact · ${a.applying ? "applying" : "separating"}</div><p data-c="interp">${esc(aspText(a))}</p><p class="hint"><button class="lnk" id="ovBtn">Back to overview</button></p>`;
      panel.querySelector("#ovBtn").onclick = overview;
    }
    S.showPlanet = showPlanet; S.showAspect = showAspect; S.showHouse = showHouse;
    // colour modes
    const ELF = { Fire: "#f1b48f", Earth: "#9fc79a", Air: "#b8c3f0", Water: "#6fc9c3" }, MODF = { Cardinal: "#f0a3b5", Fixed: "#e5c47d", Mutable: "#b9a8de" };
    $$(".modes button").forEach(b => b.onclick = () => {
      const m = b.dataset.m; $$(".modes button").forEach(x => x.setAttribute("aria-pressed", x === b));
      $("#wheel").classList.toggle("mode-aspects", m === "Aspects");
      Object.entries(plEls).forEach(([n, g]) => g.querySelector("circle.b").setAttribute("fill", m === "Elements" ? ELF[P[n].element] : m === "Modalities" ? MODF[P[n].modality] : "#fbf6ee"));
      $("#mlegend").innerHTML = m === "Elements" ? EL.map(e => `<span style="color:${ELF[e]}">●</span> ${e} ${c.elements[e].length}`).join(" · ") : m === "Modalities" ? MOD.map(x => `<span style="color:${MODF[x]}">●</span> ${x} ${c.modalities[x].length}`).join(" · ") : m === "Aspects" ? "Planets fade back so the web of aspects stands out. Thick lines are within 1° of exact." : "";
    });
    overview();
    // hero mini wheel
    $("#heroWheel").innerHTML = heroOrbit(c); glints($("#top"));
  }

  function wireChartWorld() {
    const c = S.chart, r = S.reading;
    buildWheel();
    buildSky();
    $$(".five button").forEach(b => b.onclick = () => { const o = b.parentElement.classList.toggle("open"); b.setAttribute("aria-expanded", o); });
    $$(".rp > button").forEach(b => b.onclick = () => { const o = b.parentElement.classList.toggle("open"); b.setAttribute("aria-expanded", o); });
    // life
    const showLife = k => {
      const Lf = r.life[k]; $$(".life-tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.k === k)); $("#lifeIntro").textContent = Lf.intro;
      $("#lifeGrid").innerHTML = Lf.items.map(it => `<article class="life-card" data-c="interp"><div class="lh"><b>${esc(it.q)}</b>${dots(it.f.length)}</div><p>${esc(it.a)}</p>${receipts(it.q, it.f)}</article>`).join("");
    };
    $$(".life-tabs button").forEach(b => b.onclick = () => showLife(b.dataset.k)); showLife("love");
    // dna rows
    $$(".dna-r").forEach(row => {
      const go = () => {
        const name = row.querySelector("span").textContent, list = S.dnaLists[name] || [], on = !row.classList.contains("sel");
        $$(".dna-r").forEach(x => x.classList.remove("sel"));
        if (!on) { S.highlight([], []); $("#dnaCap").textContent = "Tap a row to light up those placements on your wheel."; return; }
        row.classList.add("sel"); S.highlight(list, []);
        $("#dnaCap").innerHTML = list.length ? `<b>${esc(name)}</b>: ${list.map(n => `${T(PG[n])} ${n}`).join(" · ")}. <a href="#chart">See them on the wheel ↓</a>` : `<b>${esc(name)}</b>: no planets.`;
      };
      row.onclick = go; row.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
    // explore tabs
    S.showPanel = k => { $$(".xpanel").forEach(x => x.hidden = x.dataset.xpanel !== k); $$("#xtabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.x === k)); paintSeams(); };
    $$("#xtabs button").forEach(b => b.onclick = () => S.showPanel(b.dataset.x));
    $$(".entry .head").forEach(h => h.onclick = () => { const o = h.closest(".entry").classList.toggle("open"); h.setAttribute("aria-expanded", o); });
    $$(".tabs").forEach(bar => bar.querySelectorAll("button").forEach(b => b.onclick = () => {
      bar.querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === b));
      const pane = document.getElementById(bar.dataset.for); pane.textContent = bar.parentElement.querySelector(`template[data-k="${b.dataset.k}"]`).content.textContent;
      pane.dataset.c = b.dataset.k === "trad" ? "doctrine" : b.dataset.k === "evo" ? "psych" : "interp";
    }));
    $$("[data-asp]").forEach(b => { if (!b.closest("#panel")) b.onclick = () => { const a = c.major[+b.dataset.asp]; $("#aspDetail").innerHTML = `<div><div class="label" style="color:${TONEC[TONE[a.type]]}">${a.type} · ${a.orb}°</div><h3><em>${a.a} ${a.type} ${a.b}</em></h3></div><p data-c="interp">${esc(aspText(a))} ${esc(L.ASPECT[a.type].about[0].toUpperCase() + L.ASPECT[a.type].about.slice(1))}.</p>`; }; });
    // houses dial
    if (c.timeKnown) {
      const s = el("svg", { viewBox: "0 0 440 440", role: "img", "aria-label": "Your twelve houses" }), cc = 220, r1 = 205, r0 = 78;
      const hA = h => Math.PI + (h - 1) * Math.PI / 6, hp = (a, rr) => [cc + rr * Math.cos(a), cc - rr * Math.sin(a)];
      const max = Math.max(1, ...c.houses.map(h => h.planets.length));
      c.houses.forEach(h => {
        const a1 = hA(h.house) - Math.PI / 12, a2 = hA(h.house) + Math.PI / 12, g = el("g", { class: "w", tabindex: 0, role: "button", "aria-label": `House ${h.house}` }, s);
        const [x1, y1] = hp(a1, r1), [x2, y2] = hp(a2, r1), [x3, y3] = hp(a2, r0), [x4, y4] = hp(a1, r0), n = h.planets.length;
        el("path", { d: `M${x1},${y1} A${r1},${r1} 0 0 0 ${x2},${y2} L${x3},${y3} A${r0},${r0} 0 0 1 ${x4},${y4} Z`, fill: n ? "#6fc1bb" : "#ffffff", "fill-opacity": n ? .25 + .5 * n / max : .35, stroke: "#1d5a61", "stroke-opacity": .35 }, g);
        const [lx, ly] = hp(hA(h.house), r0 + 24); const t = el("text", { x: lx, y: ly + 6, "text-anchor": "middle", "font-family": "Cormorant Garamond, serif", "font-style": "italic", "font-size": 19, fill: "currentColor" }, g); t.textContent = ROMAN[h.house - 1];
        h.planets.forEach((pn, i) => { const [px, py] = hp(hA(h.house) + (i - (n - 1) / 2) * 0.16, 158); el("circle", { cx: px, cy: py, r: 14, fill: "#fbf6ee", stroke: "#cfa95e" }, g); const gt = el("text", { x: px, y: py + 5, "text-anchor": "middle", "font-size": 14, fill: "#10333a", class: "g" }, g); gt.textContent = T(PG[pn]); });
        const pick = () => { s.querySelectorAll(".w").forEach((w, i) => w.classList.toggle("sel", i === h.house - 1)); const ru = window.Engine.TRULER[h.sign];
          $("#hdetail").innerHTML = `<div class="label">${ord(h.house)} house</div><h3><em>${esc(L.HOUSE[h.house].name)}</em></h3><div class="in">${n ? h.planets.map(p => T(PG[p]) + " " + p).join(" · ") : "No planets"}</div>
            <dl data-c="doctrine"><dt>Area of life</dt><dd>${esc(L.HOUSE[h.house].area)}</dd><dt>Ancient name</dt><dd>${esc(L.HOUSE[h.house].ancient)}</dd><dt>Geometry</dt><dd>${[1, 4, 7, 10].includes(h.house) ? "angular" : [2, 5, 8, 11].includes(h.house) ? "succedent" : "cadent"} · ${esc(L.TO_ASC[h.house])}</dd><dt>Cusp & ruler</dt><dd>${h.sign}, ruled by ${ru} (in the ${ord(c.P[ru].house)})</dd><dt>Planetary joy</dt><dd>${L.JOYS[h.house] || "none"}</dd></dl>`; };
        g.onclick = pick; g.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
        if (h.house === 1) setTimeout(pick, 0);
      });
      $("#dial").appendChild(s);
    }
    // ask
    const showAsk = i => {
      const x = r.ask[i], planets = [...new Set(x.ev.flatMap(planetsIn))];
      $$(".ask-q button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.i === i));
      $("#askA").innerHTML = `<div class="label">Ask my chart</div><h3>${esc(x.q)}</h3><p data-c="interp">${esc(x.a)}</p><div class="ask-ev"><div class="ask-wheel"></div><div><p class="evd-n">${x.ev.length} chart factor${x.ev.length > 1 ? "s" : ""}:</p><ul data-c="calc">${x.ev.map(e => `<li>${esc(e)}</li>`).join("")}</ul></div></div>`;
      $("#askA .ask-wheel").appendChild(drawWheel({ inner: innerOf(c), aspects: c.major.map(a => ({ ...a, hl: planets.includes(a.a) && planets.includes(a.b) })), centreSign: centre(c), highlight: planets.length ? planets : null, size: 380, ascLabel: c.timeKnown }));
    };
    $$(".ask-q button").forEach(b => b.onclick = () => showAsk(+b.dataset.i)); if (r.ask.length) showAsk(0);
    // house system switch
    $$(".hs-switch button").forEach(b => b.onclick = () => { const before = Object.fromEntries(c.planets.map(p => [p.planet, p.house])); S.changeHouseSystem(b.dataset.hs);
      const changed = S.chart.planets.filter(p => before[p.planet] !== p.house).map(p => `${p.planet} ${before[p.planet]} → ${p.house}`);
      setTimeout(() => { location.hash = "#chart"; const n = $(".hs-note"); if (n) n.textContent = changed.length ? `Changed: ${changed.join(", ")}. Signs and aspects stayed the same.` : "No planet changed house. Signs and aspects never change."; }, 50); });
    paintSeams();
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
