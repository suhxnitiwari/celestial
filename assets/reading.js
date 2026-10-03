/* Turns a computed chart into a reading. Every conclusion carries the chart factors behind it.
   Rules only fire when the chart actually contains the feature. */
(function () {
  const { SIGN, PLANET, HOUSE, ASPECT, THEME, ELEMENT_MISSING, ELEMENT_HOUSES, JOYS, TO_ASC } = window.Lib;
  const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)] || "th");
  const ELW = { Fire: "Bold", Earth: "Grounded", Air: "Cerebral", Water: "Feeling" };
  const ADJ = { Aries: "bold", Taurus: "steady", Gemini: "quick", Cancer: "caring", Leo: "warm", Virgo: "precise", Libra: "graceful", Scorpio: "intense", Sagittarius: "open", Capricorn: "composed", Aquarius: "original", Pisces: "gentle" };
  const compatible = (a, b) => a === b || (["Fire", "Air"].includes(a) && ["Fire", "Air"].includes(b)) || (["Earth", "Water"].includes(a) && ["Earth", "Water"].includes(b));
  const elOf = s => ["Fire", "Earth", "Air", "Water"][window.Engine.SIGNS.indexOf(s) % 4];
  const AG = t => ASPECT[t].glyph;
  const an = w => (/^[aeiou]/i.test(w) ? "an " : "a ") + w;
  const andList = l => l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + " & " + l[l.length - 1];

  function read(c) {
    const P = c.P, T = c.timeKnown, major = c.major;
    const asp = (a, b) => major.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    const aspOf = n => major.filter(x => x.a === n || x.b === n);
    const other = (x, n) => x.a === n ? x.b : x.a;
    const title = x => `${x.a} ${AG(x.type)} ${x.b}`;
    const hard = x => ["square", "opposition"].includes(x.type);
    const ruler = T ? c.rulers.chart_ruler[0] : null;
    const rising = c.rising_sign, dsc = T ? window.Engine.signOf(c.asc + 180) : null, mcSign = T ? window.Engine.signOf(c.mc) : null;
    const pl = n => `${n} in ${P[n].sign}${T ? `, ${ord(P[n].house)} house` : ""}`;

    // ---------- main characters ----------
    const loop = (() => { const ch = c.dispositors.traditional.chains.Jupiter, l = ch[ch.length - 1]; return ch.slice(ch.indexOf(l), -1); })();
    const cast = window.Engine.PLANETS.map(n => {
      let pts = 0; const why = []; const add = (v, t) => { pts += v; why.push(t); };
      if (ruler === n) add(3, "chart ruler");
      if (n === "Sun" || n === "Moon") add(2, "a luminary");
      if (T && [1, 4, 7, 10].includes(P[n].house)) add(2, `angular (${ord(P[n].house)} house)`);
      if (c.rulers.sun_sign_rulers.includes(n) && n !== "Sun") add(1, "rules the Sun's sign");
      if (c.rulers.moon_sign_rulers.includes(n) && n !== "Moon") add(1, "rules the Moon's sign");
      if (loop.includes(n) && loop.length > 1) add(2, "in the rulership loop");
      if (c.dispositors.traditional.final.includes(n)) add(2, "final dispositor");
      if (c.sect && [c.sect.light, c.sect.benefic].includes(n)) add(1, n === c.sect.light ? "sect light" : "benefic of the sect");
      const st = c.stars.find(s => s.planet === n); if (st) add(1, `on ${st.star}`);
      const as = aspOf(n); if (as.length) add(as.length * .5, `${as.length} major aspects`);
      const ex = as.filter(x => x.orb < 1).length; if (ex) add(ex, `${ex} near-exact aspect${ex > 1 ? "s" : ""}`);
      return { n, pts, why };
    }).sort((a, b) => b.pts - a.pts);

    // ---------- themes ----------
    const themes = Object.entries(THEME).map(([k, th]) => {
      const f = [];
      c.planets.forEach(p => { if (th.signs.includes(p.sign)) f.push(`${p.planet} in ${p.sign}`); });
      if (T) c.planets.forEach(p => { if (th.houses.includes(p.house)) f.push(`${p.planet} in the ${ord(p.house)} house`); });
      if (T && th.signs.includes(rising)) f.push(`${rising} Rising`);
      th.planets.forEach(n => {
        if (T && [1, 4, 7, 10].includes(P[n].house)) f.push(`${n} angular`);
        ["Sun", "Moon"].forEach(l => { const x = asp(n, l); if (x && n !== l && x.orb < 6) f.push(title(x)); });
        if (ruler === n) f.push(`${n} rules the chart`);
      });
      return { key: k, label: th.label, line: th.line, factors: [...new Set(f)] };
    }).filter(t => t.factors.length >= 3).sort((a, b) => b.factors.length - a.factors.length).slice(0, 6);

    // ---------- contradictions ----------
    const contra = [];
    const sunEl = elOf(c.sun_sign), moonEl = elOf(c.moon_sign);
    const sm = asp("Sun", "Moon");
    if (!compatible(sunEl, moonEl) || (sm && hard(sm))) {
      const a = [`Sun in ${c.sun_sign}`], b = [`Moon in ${c.moon_sign}`]; if (sm) b.push(title(sm));
      contra.push({ poles: sunEl === moonEl ? ["Who you are", "What you need"] : [ELW[sunEl], ELW[moonEl]], a, b,
        both: `Your identity leads ${SIGN[c.sun_sign].how}; your emotional needs run ${SIGN[c.moon_sign].how}. Neither is the "real" you: the Sun describes who you're becoming, the Moon what you need along the way.` });
    }
    if (T && elOf(rising) !== sunEl && elOf(rising) !== moonEl)
      contra.push({ poles: ["First impression", "Inner life"], a: [`${rising} Rising`, ...(ruler ? [`Chart ruler ${ruler} in ${P[ruler].sign}`] : [])], b: [`Sun in ${c.sun_sign}`, `Moon in ${c.moon_sign}`],
        both: `People meet the ${ADJ[rising]} ${rising} surface first. What's underneath, ${ADJ[c.sun_sign]} and ${ADJ[c.moon_sign]}, takes longer to see. Both are real; one is the door, the other is the house.` });
    const vu = asp("Venus", "Uranus");
    if ((vu && (hard(vu) || vu.type === "conjunction")) || (["Aquarius", "Sagittarius", "Gemini"].includes(P.Venus.sign) && ["Cancer", "Scorpio", "Taurus", "Pisces"].includes(P.Moon.sign)))
      contra.push({ poles: ["Close", "Free"], a: [`Moon in ${P.Moon.sign}`, ...(asp("Venus", "Saturn") ? [title(asp("Venus", "Saturn"))] : [])], b: [`Venus in ${P.Venus.sign}`, ...(vu ? [title(vu)] : [])],
        both: "Closeness matters most when it doesn't feel like a cage. Astrologically, the freedom signatures describe how you love, not whether you stay." });
    const ms = asp("Mars", "Saturn");
    if (ms && (hard(ms) || ms.type === "conjunction")) contra.push({ poles: ["Go", "Wait"], a: [`Mars in ${P.Mars.sign}`], b: [`Saturn in ${P.Saturn.sign}`, title(ms)],
      both: "Drive and caution are wired together. When they cooperate, you get disciplined effort that lasts." });
    const js = asp("Jupiter", "Saturn");
    if (js && hard(js)) contra.push({ poles: ["Expand", "Consolidate"], a: [`Jupiter in ${P.Jupiter.sign}`], b: [`Saturn in ${P.Saturn.sign}`, title(js)],
      both: "Growth and structure take turns. The chart works best when big plans get a realistic timeline." });
    const nep = ["Sun", "Moon", "Mercury", "Venus"].map(n => asp(n, "Neptune")).filter(x => x && hard(x));
    if (nep.length) contra.push({ poles: ["Dreamer", "Realist"], a: nep.map(title), b: [`Saturn in ${P.Saturn.sign}`, ...(c.elements.Earth.length ? [`${c.elements.Earth.length} earth planet${c.elements.Earth.length > 1 ? "s" : ""}`] : [])],
      both: "Imagination is strong here, and it does its best work when it's given edges and deadlines." });
    const mq = ["Mars", "Uranus"].map(n => asp("Moon", n)).filter(x => x && (hard(x) || x.type === "conjunction"));
    if (mq.length) contra.push({ poles: ["Steady", "Quick"], a: [`Moon in ${P.Moon.sign}`, ...(T && rising ? [`${rising} Rising`] : [])], b: mq.map(title),
      both: "Feelings arrive fast and honestly. Steadiness is the frame you build around that speed." });

    // ---------- big three ----------
    const big = {
      sun: { title: `Sun in ${c.sun_sign}`, line: SIGN[c.sun_sign].key, text: `${SIGN[c.sun_sign].sun}${T ? ` In the ${ord(P.Sun.house)} house, that identity is lived out through ${HOUSE[P.Sun.house].area}.` : ""}` },
      moon: { title: `Moon in ${c.moon_sign}`, line: SIGN[c.moon_sign].key, text: `${SIGN[c.moon_sign].moon}${T ? ` In the ${ord(P.Moon.house)} house, feelings are tied to ${HOUSE[P.Moon.house].area}.` : ""}${c.moonUncertain ? " (Your Moon changed signs on your birth day, so without a birth time this is the noon position.)" : ""}` },
      rising: T ? { title: `${rising} Rising`, line: SIGN[rising].key, text: `${SIGN[rising].rising} Your chart ruler is ${ruler}, in ${P[ruler].sign} in the ${ord(P[ruler].house)} house, so ${ruler}'s placement colours the whole chart.` } : null,
    };
    big.frame = { sun: ["You think you are", SIGN[c.sun_sign].key], moon: ["You actually need", SIGN[c.moon_sign].need], rising: T ? ["People first meet", `someone ${ADJ[rising]}: ${SIGN[rising].key}`] : null };
    big.agree = compatible(sunEl, moonEl)
      ? `Your Sun (${sunEl.toLowerCase()}) and Moon (${moonEl.toLowerCase()}) speak compatible languages, so who you are and what you need tend to cooperate.${T && compatible(elOf(rising), sunEl) ? ` ${rising} Rising fits the same register, so what people see matches what's inside.` : ""}`
      : `The agreement here is in the details: ${sm && !hard(sm) ? `the Sun and Moon are in ${sm.type}, a supportive link` : "each part covers what the other lacks"}.`;
    big.fight = [["Sun wants", SIGN[c.sun_sign].gift], ["Moon needs", SIGN[c.moon_sign].need], ...(T ? [["Rising projects", SIGN[rising].key]] : [])];
    big.result = `${T ? an(ADJ[rising]).replace(/^a/, "A") + " first impression, " + an(ADJ[c.moon_sign]) : an(ADJ[c.moon_sign]).replace(/^a/, "A")} heart and ${an(ADJ[c.sun_sign])} sense of self.`;
    big.wiring = [];
    if (sm) big.wiring.push(["Sun ↔ Moon", `${title(sm)}: ${ASPECT[sm.type].about}.`]);
    const moonRuler = window.Engine.TRULER[c.moon_sign];
    if (moonRuler !== "Moon") big.wiring.push(["Moon ↔ its ruler", `The Moon's ruler, ${moonRuler}, sits in ${P[moonRuler].sign}${T ? ` in the ${ord(P[moonRuler].house)} house` : ""}, so your feelings report to that part of the chart.`]);
    if (T) { const rx = ["Sun", "Moon"].map(l => asp(ruler, l)).filter(Boolean); if (rx.length && ruler !== "Sun" && ruler !== "Moon") big.wiring.push(["Rising ↔ luminaries", `Your chart ruler ${ruler} makes ${rx.map(title).join(" and ")}, linking how you show up to who you are.`]); }

    // ---------- planets ----------
    const planets = Object.fromEntries(window.Engine.PLANETS.map(n => {
      const s = P[n].sign, own = SIGN[s][n.toLowerCase()];
      const base = own || `Your ${PLANET[n].what} is expressed ${SIGN[s].how}.`;
      const gen = ["Uranus", "Neptune", "Pluto"].includes(n) ? " This sign placement is shared with everyone born within a few years; it becomes personal through its house and aspects." : "";
      const house = T ? ` In the ${ord(P[n].house)} house, it shows up in ${HOUSE[P[n].house].area}.` : "";
      const as = aspOf(n).slice(0, 3).map(x => `${ASPECT[x.type].verb} ${other(x, n)}`);
      const d = c.dignities.find(x => x.planet === n);
      let trad = "";
      if (!d) trad = "Not one of the seven classical planets, so traditional astrology doesn't read it.";
      else {
        const good = ["domicile", "exaltation", "triplicity", "bound", "face"].filter(k => d[k]), bad = ["detriment", "fall"].filter(k => d[k]);
        trad = `${good.length ? "Essential dignity by " + good.join(" and ") : "Peregrine (no essential dignity)"}${bad.length ? `, in its ${bad.join(" and ")}` : ""}.`;
        if (c.sect) { const S = c.sect, role = n === S.light ? "the light of the sect" : n === S.benefic ? "the benefic of the sect" : n === S.malefic ? "the malefic of the sect" : n === S.contrary_benefic ? "the benefic out of sect" : n === S.contrary_malefic ? "the malefic out of sect" : ""; if (role) trad += ` In this ${S.chart} chart it is ${role}.`; }
        if (T) trad += ` The ${ord(P[n].house)} place (${HOUSE[P[n].house].ancient}) is ${TO_ASC[P[n].house]}${JOYS[P[n].house] === n ? ", and this is the planet's joy" : ""}.`;
        trad += ` Its dispositor is ${window.Engine.TRULER[s]}.`;
      }
      return [n, { text: base + house + (as.length ? ` It is ${as.join(", ")}.` : "") + gen, trad, evo: PLANET[n].evo, sig: PLANET[n].sig, label: PLANET[n].label }];
    }));

    // ---------- glance ----------
    const ec = Object.entries(c.elements).map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1]);
    const domEl = ec.filter(([, v]) => v === ec[0][1]).map(([k]) => k);
    const missing = ec.filter(([, v]) => v === 0).map(([k]) => k);
    const mc = Object.entries(c.modalities).map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1]);
    const tight = major[0];
    const starLum = c.stars.find(s => ["Sun", "Moon"].includes(s.planet) || s.orb <= .3);
    const rare = starLum ? [`${starLum.planet} on ${starLum.star}`, `${starLum.orb}° from the star`]
      : tight && tight.orb < .5 ? [title(tight), `${tight.orb}° from exact`]
      : c.stelliums.length ? [`${c.stelliums[0].planets.length} planets in ${typeof c.stelliums[0].where === "number" ? "the " + ord(c.stelliums[0].where) + " house" : c.stelliums[0].where}`, "a concentration"]
      : c.unaspected.length ? [`Unaspected ${c.unaspected[0]}`, "no major aspects at all"] : [title(tight), `${tight.orb}° from exact`];
    const glance = [
      ["🌊", domEl.length > 1 ? "Dominant elements" : "Dominant element", andList(domEl), `${ec[0][1]} planet${ec[0][1] > 1 ? "s" : ""}${domEl.length > 1 ? " each" : ""}`],
      ["🪨", "Missing element", missing.length ? andList(missing) : "None", missing.length ? "no planets there" : "all four represented"],
      ["🌀", "Dominant mode", mc[0][0], `${mc[0][1]} of 10 planets`],
      ...(T ? [["☀️", "Orientation", c.hemispheres.above.length >= 6 ? "Public-facing" : c.hemispheres.below.length >= 6 ? "Private, inward" : "Balanced", `${c.hemispheres.above.length} planets above the horizon`]] : []),
      ["⚖️", "Chart shape", c.shape.shape, "how the planets are spread"],
      ["🪐", "Main character", cast[0].n, cast[0].n === "Sun" ? "the Sun leads, as expected" : "not the Sun; see why"],
      ["✨", "Rarest signature", rare[0], rare[1]],
    ].map(([icon, label, value, note]) => ({ icon, label, value, note }));

    // ---------- wait, what? ----------
    const wait = [];
    missing.forEach(m => {
      const comp = [];
      if (T && elOf(rising) === m) comp.push(`${rising} Rising: your only ${m.toLowerCase()} is the front door`);
      if (T) c.planets.filter(p => ELEMENT_HOUSES[m].includes(p.house)).forEach(p => comp.push(`${p.planet} in the ${ord(p.house)} house (a ${m.toLowerCase()} house)`));
      if (m === "Earth" && c.modalities.Fixed.length >= 3) comp.push(`${c.modalities.Fixed.length} planets in fixed signs`);
      wait.push({ key: "element", title: `There's no ${m.toLowerCase()}.`, text: `Not one planet sits in a ${m.toLowerCase()} sign. In astrology, a missing element doesn't mean a missing trait. ${ELEMENT_MISSING[m].line}`, not: ELEMENT_MISSING[m].not, compensates: comp.length ? comp.slice(0, 4) : ["Other parts of the chart, and life, supply it"] });
    });
    if (cast[0].n !== "Sun") wait.push({ key: "sun", title: "The Sun isn't the main character.", text: `Scored on chart structure, ${cast[0].n} comes out ahead of the Sun: ${cast[0].why.join(", ")}.` });
    c.stelliums.forEach(s => wait.push({ key: "stellium", title: `${s.planets.length} planets crowd ${typeof s.where === "number" ? "the " + ord(s.where) + " house" : s.where}.`, text: `${s.planets.join(", ")} share ${typeof s.where === "number" ? `the ${ord(s.where)} house, ${HOUSE[s.where].area}` : `${s.where}, a sign of ${SIGN[s.where].key}`}. Some astrologers call three planets a stellium; many require four. Either way, it's a strong concentration.` }));
    if (tight && tight.orb < 1) wait.push({ key: "tight", title: `${title(tight)} is almost exact.`, text: `Only ${tight.orb}° from exact, this is the tightest link in the chart: your ${PLANET[tight.a].what} is ${ASPECT[tight.type].verb} your ${PLANET[tight.b].what}.` });
    c.unaspected.forEach(n => wait.push({ key: "unaspected", title: `${n} works alone.`, text: `${n} makes no major aspects to any other planet. Astrologers often read an unaspected planet as a part of you that runs on its own schedule: strong, but not integrated by default.` }));
    Object.entries(c.modalities).filter(([, v]) => !v.length).forEach(([m]) => wait.push({ key: "mode", title: `No ${m.toLowerCase()} planets.`, text: `${m} signs are the ${({ Cardinal: "starters", Fixed: "sustainers", Mutable: "adapters" })[m]}. With none, that function comes through other channels, ${({ Cardinal: "such as a strong Mars, an angular planet or the North Node", Fixed: "such as Saturn or a fixed rising sign", Mutable: "such as Mercury or a mutable rising sign" })[m]}.` }));
    const weakHub = c.dignities.find(d => (d.detriment || d.fall) && (loop.includes(d.planet) || c.rulers.sun_sign_rulers.includes(d.planet) || c.rulers.moon_sign_rulers.includes(d.planet)));
    if (weakHub) wait.push({ key: "weak", title: `The "weakest" planet runs the show.`, text: `By traditional dignity, ${weakHub.planet} in ${weakHub.sign} is at a low point (${["detriment", "fall"].filter(k => weakHub[k]).join(" and ")}). Yet it ${[loop.includes(weakHub.planet) && "sits in the rulership loop", c.rulers.sun_sign_rulers.includes(weakHub.planet) && "rules your Sun's sign", c.rulers.moon_sign_rulers.includes(weakHub.planet) && "rules your Moon's sign"].filter(Boolean).join(" and ")}. Quiet on paper, central in practice.` });

    // ---------- life ----------
    const hardTo = ns => major.filter(x => hard(x) && (ns.includes(x.a) || ns.includes(x.b)));
    const easyTo = ns => major.filter(x => ASPECT[x.type].tone === "flow" && (ns.includes(x.a) || ns.includes(x.b)));
    const in7 = T ? c.planets.filter(p => p.house === 7).map(p => p.planet) : [];
    const nepRom = ["Venus", "Moon", "Sun"].map(n => asp(n, "Neptune")).filter(Boolean);
    const love = { title: "Love & attraction", intro: `Venus, Mars and the Moon${T ? ", the 7th house and the Descendant" : ""}, read together.`, items: [
      { q: "How you love", a: SIGN[P.Venus.sign].venus + (T ? ` With Venus in the ${ord(P.Venus.house)} house, love is tied to ${HOUSE[P.Venus.house].area}.` : ""), f: [pl("Venus"), ...aspOf("Venus").slice(0, 2).map(title)] },
      { q: "What draws you in", a: `${SIGN[P.Mars.sign].mars}${T ? ` Partners often carry ${dsc} qualities: ${SIGN[dsc].key}.` : ""}`, f: [pl("Mars"), ...(T ? [`${dsc} Descendant`, ...in7.map(n => `${n} in the 7th`)] : [])] },
      { q: "What makes you feel chosen", a: `You need ${SIGN[P.Moon.sign].need}.${asp("Moon", "Venus") ? ` ${title(asp("Moon", "Venus"))} links feeling and affection directly.` : ""}`, f: [pl("Moon"), ...(asp("Moon", "Venus") ? [title(asp("Moon", "Venus"))] : [])] },
      { q: "What creates friction", a: hardTo(["Venus", "Mars"]).length ? `The challenging contacts to Venus and Mars describe where love needs translation: ${hardTo(["Venus", "Mars"]).slice(0, 2).map(x => `${PLANET[x.a].what} ${ASPECT[x.type].verb} ${PLANET[x.b].what}`).join("; ")}.` : "Few challenging contacts touch Venus or Mars, so friction comes more from circumstance than from the chart.", f: hardTo(["Venus", "Mars"]).slice(0, 3).map(title).concat(hardTo(["Venus", "Mars"]).length ? [] : ["No hard aspects to Venus or Mars"]) },
      ...(nepRom.length || P.Venus.sign === "Pisces" ? [{ q: "What you may romanticise", a: "Potential: the person someone could become, and the story of the relationship.", f: [...nepRom.map(title), ...(P.Venus.sign === "Pisces" ? ["Venus in Pisces"] : [])] }] : []),
      { q: "Need vs. attraction", a: `You need ${SIGN[P.Moon.sign].need}; you're drawn to ${SIGN[T ? dsc : P.Venus.sign].key}. The best matches, astrologically, offer both.`, f: [`Moon in ${P.Moon.sign}`, T ? `${dsc} Descendant` : `Venus in ${P.Venus.sign}`, `Venus in ${P.Venus.sign}`] },
    ] };
    const in10 = T ? c.planets.filter(p => p.house === 10).map(p => p.planet) : [], in6 = T ? c.planets.filter(p => p.house === 6).map(p => p.planet) : [], in2 = T ? c.planets.filter(p => p.house === 2).map(p => p.planet) : [];
    const mcRuler = T ? window.Engine.TRULER[mcSign] : null;
    const work = { title: "Work & ambition", intro: `The Midheaven, the 10th, 6th and 2nd houses, the Sun and Saturn, kept separate rather than collapsed into "career".`, items: [
      ...(T ? [{ q: "Calling & public direction", a: `With the Midheaven in ${mcSign}, your public direction is associated with ${SIGN[mcSign].key}.${in10.length ? ` ${in10.join(" and ")} in the 10th make this visible.` : ""} The Midheaven's ruler, ${mcRuler}, sits in the ${ord(P[mcRuler].house)} house.`, f: [`Midheaven in ${mcSign}`, ...in10.map(n => `${n} in the 10th`), `${mcRuler} in the ${ord(P[mcRuler].house)}`] }] : []),
      { q: "Work style", a: `${SIGN[P.Mars.sign].mars} ${SIGN[P.Mercury.sign].mercury}`, f: [pl("Mars"), pl("Mercury")] },
      { q: "Discipline & authority", a: `Saturn in ${P.Saturn.sign} describes where you build structure: ${SIGN[P.Saturn.sign].key}${T ? `, especially around ${HOUSE[P.Saturn.house].area}` : ""}.`, f: [pl("Saturn"), ...aspOf("Saturn").slice(0, 2).map(title)] },
      ...(T ? [{ q: "Money", a: `${in2.length ? `${in2.join(" and ")} in the 2nd house make resources personal and important.` : `The 2nd house holds no planets; its sign, ${c.houses[1].sign}, and its ruler describe money matters.`}`, f: [`${c.houses[1].sign} on the 2nd house`, ...in2.map(n => `${n} in the 2nd`)] },
        { q: "Daily environment", a: `${in6.length ? `${in6.join(" and ")} in the 6th shape daily work directly.` : `With ${c.houses[5].sign} on the 6th house, routine works best ${SIGN[c.houses[5].sign].how}.`}`, f: [`${c.houses[5].sign} on the 6th house`, ...in6.map(n => `${n} in the 6th`)] }] : []),
      { q: "Recognition", a: `${SIGN[c.sun_sign].sun.split(":")[0]}.${T ? ` With the Sun in the ${ord(P.Sun.house)} house, recognition comes through ${HOUSE[P.Sun.house].area}.` : ""}`, f: [pl("Sun"), ...(asp("Sun", "Saturn") ? [title(asp("Sun", "Saturn"))] : [])] },
    ] };
    const in1 = T ? c.planets.filter(p => p.house === 1).map(p => p.planet) : [];
    const people = { title: "How people experience you", intro: "The rising sign, the chart ruler and the Moon, as astrological interpretation, not psychological fact.", items: [
      { q: "First five minutes", a: T ? `${SIGN[rising].rising}${in1.length ? ` With ${in1.join(" and ")} in the 1st house, that impression is even stronger.` : ""}` : `Without a birth time there's no rising sign, so people's first impression is read from the Sun: ${SIGN[c.sun_sign].key}.`, f: T ? [`${rising} Rising`, `Chart ruler ${ruler} in ${P[ruler].sign}`, ...in1.map(n => `${n} in the 1st`)] : [`Sun in ${c.sun_sign}`] },
      { q: "After five months", a: `${SIGN[c.moon_sign].moon.split(".")[0]}.`, f: [`Moon in ${c.moon_sign}`, `Sun in ${c.sun_sign}`] },
      { q: "People who love you", a: easyTo(["Venus", "Jupiter", "Moon"]).length ? "Find you warm and generous, especially in the areas your supportive aspects describe." : "Find you loyal in your own way: your warmth is earned rather than automatic.", f: easyTo(["Venus", "Jupiter", "Moon"]).slice(0, 3).map(title).concat(easyTo(["Venus", "Jupiter", "Moon"]).length ? [] : [`Venus in ${P.Venus.sign}`]) },
      { q: "People who clash with you", a: hardTo(["Mars", "Moon", "Uranus"]).length ? "May be surprised by how direct and independent you can be." : "Are rare; your chart has few hard contacts to Mars and the Moon, so friction is usually situational.", f: hardTo(["Mars", "Moon", "Uranus"]).slice(0, 3).map(title).concat(hardTo(["Mars", "Moon", "Uranus"]).length ? [] : [`Mars in ${P.Mars.sign}`]) },
    ] };

    // ---------- five things ----------
    const five = [];
    themes.slice(0, 3).forEach(t => five.push({ text: t.line, evidence: t.factors }));
    five.push({ text: `${an(ADJ[c.sun_sign]).replace(/^a/, "A")} self with ${an(ADJ[c.moon_sign])} heart${T ? `, wrapped in ${an(ADJ[rising])} first impression` : ""}.`, evidence: [`Sun in ${c.sun_sign}`, `Moon in ${c.moon_sign}`, ...(T ? [`${rising} Rising`] : []), ...(sm ? [title(sm)] : [])] });
    if (cast[0].n !== "Sun" && five.length < 5) five.push({ text: `${cast[0].n} quietly runs this chart.`, evidence: cast[0].why });
    if (five.length < 5 && contra[0]) five.push({ text: `Part ${contra[0].poles[0].toLowerCase()}, part ${contra[0].poles[1].toLowerCase()}, and both are real.`, evidence: [...contra[0].a, ...contra[0].b] });
    if (five.length < 5 && missing.length) five.push({ text: `No ${missing[0].toLowerCase()} in the planets, so it gets built on purpose.`, evidence: [`0 ${missing[0].toLowerCase()} planets`, ...((wait.find(w => w.key === "element") || {}).compensates || []).slice(0, 2)] });

    // ---------- ask my chart ----------
    const ask = [];
    const inSign = s => c.planets.filter(p => p.sign === s).map(p => p.planet);
    if (cast[0].n !== "Sun") ask.push({ q: "Why isn't the Sun the main character in my chart?", a: wait.find(w => w.key === "sun").text, ev: cast[0].why.map(w => `${cast[0].n}: ${w}`) });
    if (c.moon_sign !== c.sun_sign && inSign(c.moon_sign).length >= 2) ask.push({ q: `Why might I feel more ${c.moon_sign} than ${c.sun_sign}?`, a: `${inSign(c.moon_sign).length} planets sit in ${c.moon_sign}, including the Moon. ${c.sun_sign} holds ${inSign(c.sun_sign).length}. The fair answer: ${c.moon_sign} is how you react and feel; ${c.sun_sign} is who you're becoming.`, ev: [...inSign(c.moon_sign).map(n => `${n} in ${c.moon_sign}`), ...inSign(c.sun_sign).map(n => `${n} in ${c.sun_sign}`)] });
    if (T && elOf(rising) !== sunEl && elOf(rising) !== moonEl) ask.push({ q: "Why do I come across differently than I feel?", a: `Your rising sign, ${rising}, is ${elOf(rising).toLowerCase()}; your Sun and Moon are ${sunEl.toLowerCase()} and ${moonEl.toLowerCase()}. ${big.result}`, ev: [`${rising} Rising`, `Sun in ${c.sun_sign}`, `Moon in ${c.moon_sign}`, `Chart ruler ${ruler} in ${P[ruler].sign}`] });
    if ((sm && hard(sm)) || !compatible(sunEl, moonEl)) ask.push({ q: "Why do my head and heart pull in different directions?", a: contra[0] ? contra[0].both : "", ev: [`Sun in ${c.sun_sign}`, `Moon in ${c.moon_sign}`, ...(sm ? [title(sm)] : [])] });
    if (themes[0]) ask.push({ q: `Why does ${themes[0].label.toLowerCase()} keep appearing in my reading?`, a: `${themes[0].factors.length} separate chart factors point the same way. Astrology reads repetition as emphasis.`, ev: themes[0].factors });
    c.stelliums.filter(s => typeof s.where === "number").forEach(s => ask.push({ q: `Why is my ${ord(s.where)} house so important?`, a: `${s.planets.join(", ")} all sit there. The ${ord(s.where)} house is about ${HOUSE[s.where].area}, so that part of life gets a lot of the chart's energy.`, ev: s.planets.map(n => `${n} in the ${ord(s.where)}`) }));
    missing.forEach(m => { const w = wait.find(x => x.title.includes(m.toLowerCase())); ask.push({ q: `What does having no ${m.toLowerCase()} mean for me?`, a: `${w.text} ${w.not.join(" ")}`, ev: w.compensates }); });
    if (tight && tight.orb < 1.5) ask.push({ q: "What's the tightest link in my chart?", a: `${title(tight)}, ${tight.orb}° from exact: your ${PLANET[tight.a].what} is ${ASPECT[tight.type].verb} your ${PLANET[tight.b].what}.`, ev: [`${title(tight)} (${tight.orb}°)`, pl(tight.a), pl(tight.b)] });
    if (T) ask.push({ q: "What's my chart ruler, and why does it matter?", a: `${rising} Rising is ruled by ${ruler}, so ${ruler}'s placement colours the whole chart. ${planets[ruler].text}`, ev: [`${rising} Rising`, pl(ruler), ...aspOf(ruler).slice(0, 3).map(title)] });
    const rel = themes.find(t => t.key === "relationships");
    if (rel || in7.length >= 2) ask.push({ q: "Why are relationships such a major theme?", a: `${rel ? rel.factors.length + " chart factors" : in7.length + " planets in the 7th house"} point toward partnership. ${love.items[0].a}`, ev: rel ? rel.factors : in7.map(n => `${n} in the 7th`) });
    if (contra[0]) ask.push({ q: "What's the biggest contradiction in my chart?", a: `${contra[0].poles.join(" / ")}. ${contra[0].both}`, ev: [...contra[0].a, ...contra[0].b] });
    if (!c.modalities.Cardinal.length) ask.push({ q: "Where does initiative come from, with no cardinal planets?", a: wait.find(w => w.key === "mode" && w.title.includes("cardinal")).text, ev: ["No cardinal planets", pl("Mars"), ...(asp("Sun", "Mars") ? [title(asp("Sun", "Mars"))] : []), `North Node in ${c.points.north_node.sign}`] });
    ask.push({ q: "What's my most unusual placement?", a: `${rare[0]} (${rare[1]}).`, ev: [rare[0]] });

    return { cast, themes, contra: contra.slice(0, 5), big, planets, glance, wait, life: { love, work, people }, five: five.slice(0, 5), ask, ord };
  }
  window.Reading = { read, ord };
})();
