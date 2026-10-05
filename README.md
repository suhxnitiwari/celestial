# Celestial

*Your birth chart, a little less sciency.*

**Live:** https://suhxnitiwari.github.io/celestial/

## What it is

Enter a birth date, time and place and Celestial draws your whole sky: the Big Three and every planet
after it, each one in plain words (Who I Am, How I Feel, How I Show Up, How I Think, How I Love…).
Tap a placement or a planet on the wheel to read it. Underneath sits a full Western natal chart, taken apart and put back together:
the headline, what the chart repeats and where it argues with itself, love / work / friendship,
an interactive wheel, every planet, house and aspect, timing, compatibility with anyone, and a
designed report you can save as a PDF.

Every conclusion shows its evidence, and astronomy (where the planets were) is kept separate from
astrology (what tradition says it means). The whole chart is calculated in your browser. There is no server and no API call with your birth details.

## How it's built

**A real ephemeris engine, client-side.** `assets/engine.js` (~24 KB) uses
[astronomy-engine](https://github.com/cosinekitty/astronomy) for planetary positions and does the
astrology math itself:

- **Time zones without a library.** A birth time in a city is converted to UTC with an iterative
  offset solver built on `Intl.DateTimeFormat`, so historical daylight-saving rules for that place are respected.
- **Geocentric ecliptic longitudes** for the Sun through Pluto, rotated from the equatorial frame,
  plus the mean lunar node and Black Moon Lilith from their polynomial formulas.
- **Ascendant and Midheaven** from local sidereal time and the obliquity of the ecliptic.
- **Three house systems.** Placidus cusps are solved iteratively (up to 40 passes until they converge
  within 1e-7°); near the poles, where Placidus is undefined, the engine falls back to Porphyry and says so.
  Porphyry and Whole Sign are also available.
- **Retrograde detection** by comparing each planet's longitude half a day either side of birth.
- **Aspects** with separate major and minor orb tables (wider orbs for the Sun and Moon), each marked
  applying or separating.
- **Traditional techniques:** domicile, exaltation, triplicity and Egyptian bounds, sect, dispositor chains,
  mutual receptions, decans, and 28 fixed stars precessed to the birth date.
- **Pattern finding:** grand trines, T-squares, yods and stellia are detected from the aspect list.
- **Timing, on demand:** transit windows for the next 12 months, Jupiter, Saturn and nodal returns scanned
  across 80 years, secondary progressions, solar arc, profections and firdaria.

**An interpretation layer.** `assets/lib.js` holds the writing for every sign, planet, house and aspect, and
`assets/reading.js` is a rules engine that turns a chart into a reading: recurring themes, contradictions,
a headline, life areas, and *Ask My Chart* answers that show the evidence behind them.

**Offline birthplace search.** `data/cities.json` bundles ~34,000 cities (GeoNames cities15000) with coordinates and
IANA time zones, stored as compact rows with the 356 time-zone names deduplicated into a lookup table. It loads
only when the place field is focused, and matching is accent-insensitive (Unicode NFD folding), so "Sao Paulo" finds São Paulo.

| File | What it does |
|---|---|
| `assets/engine.js` | Chart engine: planets, angles, houses, nodes, Lilith, aspects, dignities, sect, fixed stars, patterns, timing |
| `assets/lib.js` | Interpretation library: signs, planets, houses, aspects, themes, history |
| `assets/reading.js` | Rules that turn a chart into a reading: themes, contradictions, headline, life areas, Ask My Chart |
| `assets/app.js` | The form, routing and My chart: the orbit hero, Your sky, and every section after it |
| `assets/app-more.js` | Compatibility, Timing, Learn and the report |
| `assets/core.js` | Shared helpers and the chart-wheel renderer |
| `data/cities.json` | ~34,000 cities with time zones, from [GeoNames](https://www.geonames.org/) (CC BY 4.0) |

Positions were checked against the Swiss Ephemeris.

## Design choices

- **Plain words first.** Every placement gets a human label (How I Feel, How I Love) before any jargon,
  and the technical detail is there underneath for anyone who wants it.
- **A night-sky orbit hero** where your Sun sign circles the moon, drawn in SVG (Pisces gets the koi).
- **Compatibility in two layers:** Sun-sign pairings first, then two full charts compared contact by contact,
  with the questions changing by relationship (a parent isn't a partner).
- **A designed report** with its own print stylesheet, saved as a PDF straight from the browser.
- Light and dark themes, keyboard-navigable city search, and `prefers-reduced-motion` support.

It brings together three earlier projects:

- **[suhani-celestial](https://github.com/suhxnitiwari/suhani-celestial)**: the placement-by-placement
  "Your sky" view, with a reading card and wheel side by side, now for anyone's chart, not just mine.
- **[astrology-results](https://github.com/suhxnitiwari/astrology-results)**: the night-sky design and the
  orbit hero.
- **Charted**: the in-browser chart engine, the interpretation rules, the city search, and the
  Compatibility, Timing, Learn and report sections. It now lives entirely here.

## Privacy

Everything runs in the visitor's browser. Birth details are never uploaded; the chart is stored on
the device only if the visitor ticks "Remember my chart on this device". Birthplace search uses the
bundled city list, so no lookup service is contacted.

## Tech stack

Vanilla JavaScript · astronomy-engine · SVG · CSS · GeoNames data · GitHub Pages

## Run it locally

No build step.

```bash
python3 -m http.server
```

Astronomy by [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT).

*Not real science. Fun science. Astrology is used here as a language for reflection and play, not as a
scientific personality assessment.*

Built by [Suhani Tiwari](https://suhanitiwari.com). All rights reserved; see [LICENSE](LICENSE).
