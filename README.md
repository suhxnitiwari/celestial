# Celestial

**Your birth chart, a little less sciency.**

Enter a birth date, time and place and Celestial draws your whole sky: the Big Three and every planet
after it, each one in plain words (Who I Am, How I Feel, How I Show Up, How I Think, How I Love…).
Tap a placement or a planet on the wheel to read it. Underneath sits a full Western natal chart:
the headline, what the chart repeats and where it argues with itself, love / work / friendship,
an interactive wheel, every planet, house and aspect, timing (transits, profections, progressions,
returns), compatibility with anyone, and a designed report you can save as a PDF.

It brings together three earlier projects:

- **[suhani-celestial](https://github.com/suhxnitiwari/suhani-celestial)**: the placement-by-placement
  "Your sky" view, with a reading card and wheel side by side, now for anyone's chart, not just mine.
- **[astrology-results](https://github.com/suhxnitiwari/astrology-results)**: the night-sky design and the
  orbit hero, with your Sun sign circling the moon (Pisces gets the koi).
- **[charted](https://github.com/suhxnitiwari/charted)**: the in-browser chart engine, the interpretation
  rules, the city search, and the Compatibility, Timing, Learn and report sections.

## Privacy

Everything runs in the visitor's browser. Birth details are never uploaded; the chart is stored on
the device only if the visitor ticks "Remember my chart on this device". Birthplace search uses a
bundled city list, so no lookup service is contacted.

## How it works

| File | What it does |
|---|---|
| `assets/engine.js` | Chart engine: planets, Ascendant/MC, Placidus / Porphyry / Whole Sign houses, nodes, Lilith, aspects, dignities, sect, dispositors, fixed stars, patterns, and timing techniques |
| `assets/lib.js` | Interpretation library: signs (including every planet from the Sun to Pluto), planets, houses, aspects, themes, history |
| `assets/reading.js` | Rules that turn a chart into a reading: themes, contradictions, headline, life areas, Ask My Chart |
| `assets/app.js` | The form, routing and My chart: the orbit hero, Your sky, and every section after it |
| `assets/app-more.js` | Compatibility, Timing, Learn and the report |
| `assets/core.js` | Shared helpers and the chart-wheel renderer |
| `data/cities.json` | ~34,000 cities with time zones, from [GeoNames](https://www.geonames.org/) (CC BY 4.0) |

No build step. To run it locally:

```bash
python3 -m http.server
```

Astronomy by [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT). Positions were checked
against the Swiss Ephemeris.

*Not real science. Fun science. Astrology is used here as a language for reflection and play, not as a
scientific personality assessment.*
