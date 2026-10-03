/* Celestial engine: computes a full Western natal chart in the browser with astronomy-engine.
   Nothing is sent anywhere. Exposes window.Engine.build(input) -> chart object. */
(function () {
  const A = () => window.Astronomy;
  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const PLANETS = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
  const EL = ["Fire","Earth","Air","Water"], MOD = ["Cardinal","Fixed","Mutable"];
  const TRULER = { Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon", Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars", Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter" };
  const MRULER = { ...TRULER, Scorpio: "Pluto", Aquarius: "Uranus", Pisces: "Neptune" };
  const r = Math.PI / 180, norm = x => ((x % 360) + 360) % 360;
  const signIdx = lon => Math.floor(norm(lon) / 30), signOf = lon => SIGNS[signIdx(lon)];
  const sep = (a, b) => { const x = Math.abs(a - b) % 360; return Math.min(x, 360 - x); };

  // ---------- time ----------
  function tzOffset(tz, y, mo, d, h, mi) {
    let guess = Date.UTC(y, mo - 1, d, h, mi);
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(guess)).filter(p => p.type !== "literal").map(p => [p.type, +p.value]));
      const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
      guess = Date.UTC(y, mo - 1, d, h, mi) - (asUTC - guess);
    }
    return (Date.UTC(y, mo - 1, d, h, mi) - guess) / 60000;
  }

  // ---------- positions ----------
  function lonOf(body, t) {
    if (body === "Sun") return A().SunPosition(t).elon;
    if (body === "Moon") return A().EclipticGeoMoon(t).lon;
    const v = A().GeoVector(A().Body[body], t, true);
    return A().SphereFromVector(A().RotateVector(A().Rotation_EQJ_ECT(t), v)).lon;
  }
  const at = (date, offsetDays = 0) => A().MakeTime(new Date(date.getTime() + offsetDays * 864e5));
  const centuries = t => t.tt / 36525;
  const meanNode = t => norm(125.0445479 - 1934.1362891 * centuries(t) + 0.0020754 * centuries(t) ** 2);
  const meanLilith = t => norm(83.3532465 + 4069.0137287 * centuries(t) - 0.01032 * centuries(t) ** 2 + 180);

  // ---------- angles & houses ----------
  function angles(t, lat, lon) {
    const ramc = norm(A().SiderealTime(t) * 15 + lon), eps = A().e_tilt(t).tobl;
    const asc = norm(Math.atan2(Math.cos(ramc * r), -(Math.sin(ramc * r) * Math.cos(eps * r) + Math.tan(lat * r) * Math.sin(eps * r))) / r);
    const mc = norm(Math.atan2(Math.sin(ramc * r), Math.cos(ramc * r) * Math.cos(eps * r)) / r);
    return { ramc, eps, asc, mc };
  }
  function placidus({ ramc, eps, asc, mc }, lat) {
    const raToLon = ra => norm(Math.atan2(Math.sin(ra * r), Math.cos(ra * r) * Math.cos(eps * r)) / r);
    const cusp = (f, upper) => {
      let lon = norm(upper ? ramc + f * 90 : ramc + 180 - f * 90);
      for (let i = 0; i < 40; i++) {
        const dec = Math.asin(Math.sin(eps * r) * Math.sin(lon * r));
        const x = Math.tan(lat * r) * Math.tan(dec);
        if (Math.abs(x) >= 1) return null;
        const ad = Math.asin(x) / r;
        const ra = upper ? ramc + f * (90 + ad) : ramc + 180 - f * (90 - ad);
        const nl = raToLon(ra);
        if (sep(nl, lon) < 1e-7) { lon = nl; break; }
        lon = nl;
      }
      return lon;
    };
    const c11 = cusp(1 / 3, true), c12 = cusp(2 / 3, true), c2 = cusp(2 / 3, false), c3 = cusp(1 / 3, false);
    if ([c11, c12, c2, c3].some(x => x == null)) return null;
    return [asc, c2, c3, norm(mc + 180), norm(c11 + 180), norm(c12 + 180), norm(asc + 180), norm(c2 + 180), norm(c3 + 180), mc, c11, c12];
  }
  function porphyry({ asc, mc }) {
    const q1 = norm(asc - mc), q2 = 180 - q1, ic = norm(mc + 180);
    return [asc, norm(asc + q2 / 3), norm(asc + 2 * q2 / 3), ic, norm(ic + q1 / 3), norm(ic + 2 * q1 / 3), norm(asc + 180), norm(asc + 180 + q2 / 3), norm(asc + 180 + 2 * q2 / 3), mc, norm(mc + q1 / 3), norm(mc + 2 * q1 / 3)];
  }
  const wholeSign = ({ asc }) => Array.from({ length: 12 }, (_, i) => norm(signIdx(asc) * 30 + i * 30));
  function houseOf(lon, cusps) {
    for (let i = 0; i < 12; i++) {
      const a = cusps[i], b = cusps[(i + 1) % 12], span = norm(b - a);
      if (norm(lon - a) < span) return i + 1;
    }
    return 1;
  }

  // ---------- aspects ----------
  const MAJOR = { conjunction: [0, 8], sextile: [60, 5], square: [90, 7], trine: [120, 7], opposition: [180, 8] };
  const MINOR = { "semi-sextile": [30, 2], "semi-square": [45, 2], quintile: [72, 2], sesquiquadrate: [135, 2], biquintile: [144, 2], quincunx: [150, 3] };
  function aspects(pos, later, moonPrivate = false) {
    const out = [];
    for (let i = 0; i < PLANETS.length; i++) for (let j = i + 1; j < PLANETS.length; j++) {
      const a = PLANETS[i], b = PLANETS[j], s = sep(pos[a], pos[b]);
      for (const [set, tbl] of [["major", MAJOR], ["minor", MINOR]]) for (const [type, [ang, orb]] of Object.entries(tbl)) {
        const lim = orb + (set === "major" && (["Sun", "Moon"].includes(a) || ["Sun", "Moon"].includes(b)) ? 2 : 0), o = Math.abs(s - ang);
        if (o <= lim) out.push({ a, b, type, class: set, orb: Math.round(o * 10) / 10, applying: Math.abs(sep(later[a], later[b]) - ang) < o });
      }
    }
    return out.sort((x, y) => x.orb - y.orb);
  }

  // ---------- traditional tables ----------
  const DOMICILE = { Sun: ["Leo"], Moon: ["Cancer"], Mercury: ["Gemini", "Virgo"], Venus: ["Taurus", "Libra"], Mars: ["Aries", "Scorpio"], Jupiter: ["Sagittarius", "Pisces"], Saturn: ["Capricorn", "Aquarius"] };
  const EXALT = { Sun: "Aries", Moon: "Taurus", Mercury: "Virgo", Venus: "Pisces", Mars: "Capricorn", Jupiter: "Cancer", Saturn: "Libra" };
  const TRIP = { Fire: ["Sun", "Jupiter", "Saturn"], Earth: ["Venus", "Moon", "Mars"], Air: ["Saturn", "Mercury", "Jupiter"], Water: ["Venus", "Mars", "Moon"] };
  const BOUNDS = {
    Aries: [["Jupiter", 6], ["Venus", 12], ["Mercury", 20], ["Mars", 25], ["Saturn", 30]], Taurus: [["Venus", 8], ["Mercury", 14], ["Jupiter", 22], ["Saturn", 27], ["Mars", 30]],
    Gemini: [["Mercury", 6], ["Jupiter", 12], ["Venus", 17], ["Mars", 24], ["Saturn", 30]], Cancer: [["Mars", 7], ["Venus", 13], ["Mercury", 19], ["Jupiter", 26], ["Saturn", 30]],
    Leo: [["Jupiter", 6], ["Venus", 11], ["Saturn", 18], ["Mercury", 24], ["Mars", 30]], Virgo: [["Mercury", 7], ["Venus", 17], ["Jupiter", 21], ["Mars", 28], ["Saturn", 30]],
    Libra: [["Saturn", 6], ["Mercury", 14], ["Jupiter", 21], ["Venus", 28], ["Mars", 30]], Scorpio: [["Mars", 7], ["Venus", 11], ["Mercury", 19], ["Jupiter", 24], ["Saturn", 30]],
    Sagittarius: [["Jupiter", 12], ["Venus", 17], ["Mercury", 21], ["Saturn", 26], ["Mars", 30]], Capricorn: [["Mercury", 7], ["Jupiter", 14], ["Venus", 22], ["Saturn", 26], ["Mars", 30]],
    Aquarius: [["Mercury", 7], ["Venus", 13], ["Jupiter", 20], ["Mars", 25], ["Saturn", 30]], Pisces: [["Venus", 12], ["Jupiter", 16], ["Mercury", 19], ["Mars", 28], ["Saturn", 30]],
  };
  const CHALDEAN = ["Mars", "Sun", "Venus", "Mercury", "Moon", "Saturn", "Jupiter"];
  const opp = s => SIGNS[(SIGNS.indexOf(s) + 6) % 12];
  const STARS = { Alcyone: [3.7914, 24.105], Algol: [3.1361, 40.9556], Aldebaran: [4.5987, 16.5092], Rigel: [5.2423, -8.2017], Capella: [5.2782, 45.998], Betelgeuse: [5.9195, 7.4069],
    Sirius: [6.7525, -16.7161], Pollux: [7.7553, 28.0261], Regulus: [10.1395, 11.9672], Denebola: [11.8177, 14.5719], Vindemiatrix: [13.0363, 10.9592], Spica: [13.4199, -11.1614],
    Arcturus: [14.261, 19.1825], Zubenelgenubi: [14.848, -16.0417], Zubeneschamali: [15.2835, -9.3831], Alphecca: [15.5781, 26.7147], Antares: [16.4901, -26.4319], Rasalhague: [17.5823, 12.56],
    Vega: [18.6156, 38.7836], Nunki: [18.9211, -26.2967], Altair: [19.8464, 8.8683], "Deneb Algedi": [21.784, -16.1272], Sadalmelik: [22.0964, -0.3197], Fomalhaut: [22.9608, -29.6222],
    Scheat: [23.0629, 28.0828], Markab: [23.0794, 15.2053], Achernar: [1.6286, -57.2367], Hamal: [2.1196, 23.4625] };
  function starLon([raH, dec], t) {
    const a = raH * 15 * r, d = dec * r, e = 23.4392911 * r;
    return norm(Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a)) / r + t.tt / 365.25 * 50.29 / 3600);
  }

  // ---------- build ----------
  function build({ name = "", date, time, place, houseSystem = "placidus" }) {
    const [y, mo, d] = date.split("-").map(Number);
    const timeKnown = !!time;
    const [h, mi] = timeKnown ? time.split(":").map(Number) : [12, 0];
    const off = place.tz ? tzOffset(place.tz, y, mo, d, h, mi) : place.offset * 60;
    const birth = new Date(Date.UTC(y, mo - 1, d, h, mi) - off * 60000);
    const t = at(birth), tLater = at(birth, .01), tPrev = at(birth, -.5), tNext = at(birth, .5);
    const pos = {}, later = {}, planets = [];
    PLANETS.forEach(n => {
      pos[n] = lonOf(n, t); later[n] = lonOf(n, tLater);
      const retro = n !== "Sun" && n !== "Moon" && norm(lonOf(n, tNext) - lonOf(n, tPrev) + 180) - 180 < 0;
      planets.push({ planet: n, lon: pos[n], sign: signOf(pos[n]), degree: Math.floor(norm(pos[n]) % 30), minute: Math.floor((norm(pos[n]) % 1) * 60), retrograde: retro,
        element: EL[signIdx(pos[n]) % 4], modality: MOD[signIdx(pos[n]) % 3] });
    });
    // Moon sign certainty when the time is unknown
    let moonUncertain = false;
    if (!timeKnown) {
      const ds = at(new Date(Date.UTC(y, mo - 1, d, 0, 0) - off * 60000)), de = at(new Date(Date.UTC(y, mo - 1, d, 23, 59) - off * 60000));
      moonUncertain = signOf(lonOf("Moon", ds)) !== signOf(lonOf("Moon", de));
    }
    let ang = null, cusps = null, usedSystem = null, houseNote = "";
    if (timeKnown) {
      ang = angles(t, place.lat, place.lon);
      if (houseSystem === "placidus") { cusps = placidus(ang, place.lat); usedSystem = "Placidus"; if (!cusps) { cusps = porphyry(ang); usedSystem = "Porphyry"; houseNote = "Placidus can't be calculated this close to the poles, so Porphyry is used."; } }
      else if (houseSystem === "porphyry") { cusps = porphyry(ang); usedSystem = "Porphyry"; }
      else { cusps = wholeSign(ang); usedSystem = "Whole sign"; }
      planets.forEach(p => p.house = houseOf(p.lon, cusps));
    }
    const P = Object.fromEntries(planets.map(p => [p.planet, p]));
    const asp = aspects(pos, later);
    const major = asp.filter(a => a.class === "major");
    const count = (key, vals) => Object.fromEntries(vals.map(v => [v, planets.filter(p => p[key] === v).map(p => p.planet)]));
    const inHouses = hs => planets.filter(p => hs.includes(p.house)).map(p => p.planet);

    // sect & dignities
    const day = timeKnown ? P.Sun.house >= 7 : null;
    const sect = day == null ? null : { chart: day ? "day" : "night", light: day ? "Sun" : "Moon", benefic: day ? "Jupiter" : "Venus", malefic: day ? "Saturn" : "Mars", contrary_benefic: day ? "Venus" : "Jupiter", contrary_malefic: day ? "Mars" : "Saturn" };
    const dignities = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].map(n => {
      const s = P[n].sign, dg = norm(pos[n]) % 30, el = EL[SIGNS.indexOf(s) % 4], trip = TRIP[el];
      const bound = BOUNDS[s].find(([, end]) => dg < end)[0], face = CHALDEAN[(SIGNS.indexOf(s) * 3 + Math.floor(dg / 10)) % 7];
      const row = { planet: n, sign: s, domicile: DOMICILE[n].includes(s), exaltation: EXALT[n] === s,
        triplicity: sect ? (n === (day ? trip[0] : trip[1]) || n === trip[2]) : trip.includes(n), bound: bound === n, face: face === n,
        detriment: DOMICILE[n].some(x => opp(x) === s), fall: opp(EXALT[n]) === s, bound_ruler: bound, face_ruler: face };
      row.peregrine = !["domicile", "exaltation", "triplicity", "bound", "face"].some(k => row[k]);
      row.score = 5 * row.domicile + 4 * row.exaltation + 3 * row.triplicity + 2 * row.bound + row.face - 5 * row.detriment - 4 * row.fall;
      return row;
    });
    const chains = (map, names) => Object.fromEntries(names.map(n => { const path = [n]; let cur = n; for (;;) { const nx = map[P[cur].sign]; path.push(nx); if (nx === cur || path.indexOf(nx) < path.length - 1) break; cur = nx; } return [n, path]; }));
    const trad7 = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
    const recep = (map, names) => { const o = []; names.forEach((a, i) => names.slice(i + 1).forEach(b => { if (map[P[a].sign] === b && map[P[b].sign] === a) o.push([a, b]); })); return o; };
    const dispositors = { traditional: { chains: chains(TRULER, trad7), final: trad7.filter(n => TRULER[P[n].sign] === n), receptions: recep(TRULER, trad7) },
      modern: { chains: chains(MRULER, PLANETS), final: PLANETS.filter(n => MRULER[P[n].sign] === n), receptions: recep(MRULER, PLANETS) } };

    // patterns
    const hasA = (a, b, type) => major.concat(asp.filter(x => x.type === "quincunx")).some(x => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && x.type === type);
    const patterns = [];
    PLANETS.forEach((a, i) => PLANETS.slice(i + 1).forEach((b, j) => PLANETS.forEach(c => {
      if (c === a || c === b) return;
      if (hasA(a, b, "opposition") && hasA(a, c, "square") && hasA(b, c, "square")) patterns.push({ type: "T-square", planets: [a, b, c] });
      if (hasA(a, b, "sextile") && hasA(a, c, "quincunx") && hasA(b, c, "quincunx")) patterns.push({ type: "Yod", planets: [a, b, c] });
      if (PLANETS.indexOf(c) > PLANETS.indexOf(b) && hasA(a, b, "trine") && hasA(b, c, "trine") && hasA(a, c, "trine")) patterns.push({ type: "Grand trine", planets: [a, b, c] });
    })));
    const stelliums = [];
    SIGNS.forEach(s => { const l = planets.filter(p => p.sign === s).map(p => p.planet); if (l.length >= 3) stelliums.push({ kind: "sign", where: s, planets: l }); });
    if (timeKnown) for (let hh = 1; hh <= 12; hh++) { const l = inHouses([hh]); if (l.length >= 3) stelliums.push({ kind: "house", where: hh, planets: l }); }
    const lons = PLANETS.map(n => norm(pos[n])).sort((a, b) => a - b);
    const gaps = lons.map((l, i) => norm(lons[(i + 1) % 10] - l)), maxGap = Math.max(...gaps), big = gaps.filter(g => g >= 60);
    const shape = 360 - maxGap <= 120 ? "Bundle" : maxGap >= 180 ? "Bowl" : maxGap >= 120 ? "Locomotive" : big.length >= 2 ? "Seesaw" : "Splay";
    const unaspected = PLANETS.filter(n => !major.some(a => a.a === n || a.b === n));

    // stars, points
    const stars = [];
    Object.entries(STARS).forEach(([star, c]) => { const sl = starLon(c, t); PLANETS.forEach(n => { if (sep(sl, pos[n]) <= 1) stars.push({ star, planet: n, orb: Math.round(sep(sl, pos[n]) * 10) / 10, star_sign: signOf(sl), star_degree: Math.floor(sl % 30) }); }); });
    const node = meanNode(t), lil = meanLilith(t);
    const points = { north_node: { lon: node, sign: signOf(node), degree: Math.floor(node % 30), house: cusps ? houseOf(node, cusps) : null },
      south_node: { lon: norm(node + 180), sign: signOf(node + 180), degree: Math.floor(node % 30), house: cusps ? houseOf(norm(node + 180), cusps) : null },
      lilith: { lon: lil, sign: signOf(lil), degree: Math.floor(lil % 30), house: cusps ? houseOf(lil, cusps) : null } };

    const chart = {
      name, input: { date, time: timeKnown ? time : null, placeLabel: place.label || "", houseSystem },
      birthUTC: birth.toISOString(), timeKnown, moonUncertain, planets, P, aspects: asp, major,
      asc: ang ? ang.asc : null, mc: ang ? ang.mc : null, cusps, houseSystem: usedSystem, houseNote,
      sun_sign: P.Sun.sign, moon_sign: P.Moon.sign, rising_sign: ang ? signOf(ang.asc) : null,
      elements: count("element", EL), modalities: count("modality", MOD),
      hemispheres: timeKnown ? { above: inHouses([7, 8, 9, 10, 11, 12]), below: inHouses([1, 2, 3, 4, 5, 6]), east: inHouses([10, 11, 12, 1, 2, 3]), west: inHouses([4, 5, 6, 7, 8, 9]) } : null,
      house_types: timeKnown ? { angular: inHouses([1, 4, 7, 10]), succedent: inHouses([2, 5, 8, 11]), cadent: inHouses([3, 6, 9, 12]) } : null,
      houses: timeKnown ? Array.from({ length: 12 }, (_, i) => ({ house: i + 1, sign: signOf(cusps[i]), planets: inHouses([i + 1]) })) : null,
      rulers: { chart_ruler: ang ? [TRULER[signOf(ang.asc)], ...(MRULER[signOf(ang.asc)] !== TRULER[signOf(ang.asc)] ? [MRULER[signOf(ang.asc)]] : [])] : [],
        sun_sign_rulers: [...new Set([TRULER[P.Sun.sign], MRULER[P.Sun.sign]])], moon_sign_rulers: [...new Set([TRULER[P.Moon.sign], MRULER[P.Moon.sign]])] },
      sect, dignities, dispositors, patterns, stelliums, shape: { shape, largest_gap: Math.round(maxGap), gaps_over_60: big.map(Math.round) }, unaspected,
      stars, points, decans: PLANETS.map(n => { const si = signIdx(pos[n]), k = Math.floor((norm(pos[n]) % 30) / 10), same = [0, 1, 2].map(j => SIGNS[(si + 4 * j) % 12]); return { planet: n, sign: SIGNS[si], decan: k + 1, face_ruler: CHALDEAN[(si * 3 + k) % 7], modern_ruler: MRULER[same[k]] }; }),
      draconic: PLANETS.map(n => ({ planet: n, sign: signOf(pos[n] - node), degree: Math.floor(norm(pos[n] - node) % 30) })),
    };
    return chart;
  }

  // ---------- timing (computed on demand; heavier) ----------
  function timing(chart, now = new Date()) {
    const birth = new Date(chart.birthUTC), slow = ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
    const natal = chart.planets.map(p => [p.planet, p.lon]);
    const ASP = [["conjunction", 0], ["sextile", 60], ["square", 90], ["trine", 120], ["opposition", 180]];
    const tNow = at(now);
    const sky = Object.fromEntries(PLANETS.map(n => [n, lonOf(n, tNow)]));
    const retroNow = PLANETS.filter(n => n !== "Sun" && n !== "Moon" && norm(lonOf(n, at(now, .5)) - lonOf(n, at(now, -.5)) + 180) - 180 < 0);
    const elong = norm(sky.Moon - sky.Sun);
    const phases = ["New Moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full Moon", "Waning gibbous", "Last quarter", "Waning crescent"];
    const moonNow = { sign: signOf(sky.Moon), phase: phases[Math.floor(norm(elong + 22.5) / 45)], illumination: Math.round((1 - Math.cos(elong * r)) / 2 * 100), elong };
    const transitsNow = [];
    slow.forEach(tp => natal.forEach(([n, l]) => ASP.forEach(([type, ang]) => { const o = Math.abs(sep(sky[tp], l) - ang); if (o <= 2) transitsNow.push({ transit: tp, type, natal: n, orb: Math.round(o * 10) / 10 }); })));
    // transit windows, next 12 months (1° orb)
    const series = Object.fromEntries(slow.map(tp => [tp, Array.from({ length: 366 + 400 }, (_, k) => lonOf(tp, at(now, k - 400)))]));
    const iso = k => new Date(now.getTime() + (k - 400) * 864e5).toISOString().slice(0, 10);
    const windows = [];
    slow.forEach(tp => natal.forEach(([n, l]) => ASP.forEach(([type, ang]) => {
      const orbs = series[tp].map(x => Math.abs(sep(x, l) - ang));
      for (let k = 0; k < orbs.length; k++) if (orbs[k] <= 1) {
        const s0 = k; while (k < orbs.length && orbs[k] <= 1) k++; const s1 = k - 1;
        if (s1 >= 400 && s0 <= 766) {
          const exact = []; for (let j = s0 + 1; j < s1; j++) if (orbs[j] <= orbs[j - 1] && orbs[j] <= orbs[j + 1] && orbs[j] < .2) exact.push(iso(j));
          windows.push({ transit: tp, type, natal: n, start: s0 > 0 ? iso(s0) : null, end: s1 < orbs.length - 1 ? iso(s1) : null, exact });
        }
      }
    })));
    windows.sort((a, b) => (a.exact[0] || a.start || "").localeCompare(b.exact[0] || b.start || ""));
    // returns (2-day steps, 80 years)
    const crossings = (body, target, years, step = 2, minYears = 0) => {
      const out = []; let prev = null;
      for (let dd = Math.max(200, minYears * 365.25); dd < years * 365.25; dd += step) {
        const cur = norm(lonOf(body, at(birth, dd)) - target + 180) - 180;
        if (prev != null && ((prev < 0 && cur >= 0) || (prev > 0 && cur <= 0)) && Math.abs(cur - prev) < 10) out.push(new Date(birth.getTime() + dd * 864e5).toISOString().slice(0, 10));
        prev = cur;
      }
      return out;
    };
    const node0 = chart.points.north_node.lon;
    const nodeCross = (target) => { const out = []; let prev = null; for (let dd = 200; dd < 80 * 365.25; dd += 5) { const cur = norm(meanNode(at(birth, dd)) - target + 180) - 180; if (prev != null && ((prev < 0 && cur >= 0) || (prev > 0 && cur <= 0)) && Math.abs(cur - prev) < 10) out.push(new Date(birth.getTime() + dd * 864e5).toISOString().slice(0, 10)); prev = cur; } return out; };
    const returns = { jupiter: crossings("Jupiter", chart.P.Jupiter.lon, 80, 2, 9), saturn: crossings("Saturn", chart.P.Saturn.lon, 80, 2, 25), nodal: nodeCross(node0), nodal_opposition: nodeCross(norm(node0 + 180)),
      uranus_opposition: crossings("Uranus", norm(chart.P.Uranus.lon + 180), 80, 5, 30) };
    // ages, progressions, solar arc, profection, firdaria
    const years = (now - birth) / (365.2422 * 864e5), age = Math.floor(years);
    const prog = Object.fromEntries(["Sun", "Moon", "Mercury", "Venus", "Mars"].map(n => { const l = lonOf(n, at(birth, years)); return [n, { lon: l, sign: signOf(l), degree: Math.floor(l % 30) }]; }));
    const arc = norm(prog.Sun.lon - chart.P.Sun.lon);
    const solarArc = [];
    PLANETS.forEach(a => PLANETS.forEach(b => ASP.forEach(([type, ang]) => { const o = Math.abs(sep(norm(chart.P[a].lon + arc), chart.P[b].lon) - ang); if (o <= 1) solarArc.push({ directed: a, type, natal: b, orb: Math.round(o * 10) / 10 }); })));
    const progEvents = [];
    let ps = signIdx(chart.P.Sun.lon), pv = norm(lonOf("Mercury", at(birth, .5)) - lonOf("Mercury", at(birth, -.5)) + 180) - 180;
    for (let dd = 1; dd < 90; dd++) {
      const s = signIdx(lonOf("Sun", at(birth, dd))); if (s !== ps) { progEvents.push({ event: `Progressed Sun enters ${SIGNS[s]}`, age: dd - 1 }); ps = s; }
      const v = norm(lonOf("Mercury", at(birth, dd + .5)) - lonOf("Mercury", at(birth, dd - .5)) + 180) - 180;
      if ((pv < 0) !== (v < 0)) progEvents.push({ event: `Progressed Mercury turns ${v < 0 ? "retrograde" : "direct"}`, age: dd - 1 });
      pv = v;
    }
    const profections = chart.rising_sign ? Array.from({ length: 81 }, (_, a) => { const s = SIGNS[(SIGNS.indexOf(chart.rising_sign) + a) % 12]; return { age: a, house: a % 12 + 1, sign: s, lord: TRULER[s] }; }) : null;
    const seq = chart.sect ? (chart.sect.chart === "day" ? [["Sun", 10], ["Venus", 8], ["Mercury", 13], ["Moon", 9], ["Saturn", 11], ["Jupiter", 12], ["Mars", 7], ["North Node", 3], ["South Node", 2]]
      : [["Moon", 9], ["Saturn", 11], ["Jupiter", 12], ["Mars", 7], ["Sun", 10], ["Venus", 8], ["Mercury", 13], ["North Node", 3], ["South Node", 2]]) : null;
    let firdaria = null, firdNow = null;
    if (seq) {
      let a0 = 0; firdaria = seq.map(([lord, len]) => { const o = { lord, from_age: a0, to_age: a0 + len }; a0 += len; return o; });
      const cur = firdaria.find(f => f.from_age <= years % 75 && years % 75 < f.to_age) || firdaria[0], order7 = seq.slice(0, 7).map(x => x[0]);
      const k = Math.floor((years % 75 - cur.from_age) / ((cur.to_age - cur.from_age) / 7));
      firdNow = { major: cur.lord, from: cur.from_age, to: cur.to_age, sub: order7.includes(cur.lord) ? order7[(order7.indexOf(cur.lord) + k) % 7] : null };
    }
    const sr = A().SearchSunLongitude(chart.P.Sun.lon, tNow, 400);
    // monthly slow-planet positions for date lookups (80 years from birth)
    const monthly = {};
    for (let yy = birth.getUTCFullYear(); yy <= birth.getUTCFullYear() + 80; yy++) for (let mm = 1; mm <= 12; mm++) monthly[`${yy}-${String(mm).padStart(2, "0")}`] = slow.map(tp => lonOf(tp, A().MakeTime(new Date(Date.UTC(yy, mm - 1, 15, 12)))));
    return { asOf: now.toISOString().slice(0, 10), age, years, sky, retroNow, moonNow, transitsNow, windows, returns, progressions: prog, arc, solarArc, progEvents, profections, firdaria, firdNow,
      solarReturn: sr ? sr.date.toISOString().slice(0, 10) : null, monthly, slow };
  }

  window.Engine = { build, timing, SIGNS, PLANETS, EL, MOD, TRULER, MRULER, signOf, sep, norm, tzOffset };
})();
