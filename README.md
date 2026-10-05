# Celestial

*Your birth chart, a little less sciency.*

**Live:** https://suhxnitiwari.github.io/celestial/

## What it is

Enter a birth date, time and place and Celestial opens on your sky: your name drawn in starlight, and your
Sun and Moon signs orbiting the moon. Then it takes you on a guided tour, one placement at a time:

1. **The Big Three:** who you are, how you feel, and how people first meet you
2. **The rest of the sky:** Mercury to Pluto, each in plain words (How I Think, How I Love, How I Act…)
3. **The whole picture:** how your planets spread across fire, earth, air and water

Each step pairs a short reading with visuals: a sign orb in that element's colours with the sign's keywords
circling it, and your own chart wheel with that planet and every planet it talks to lit up. Step through with
the arrows, jump around on the progress track, tap a planet on the wheel, or press Play and let it guide you.

The whole chart is calculated in your browser. There is no server and no API call with your birth details.

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

**An interpretation layer.** `assets/lib.js` holds the writing for every sign, planet, house and aspect, and
`assets/reading.js` turns a chart into the plain-words reading for each placement.

**Offline birthplace search.** `data/cities.json` bundles ~34,000 cities (GeoNames cities15000) with coordinates and
IANA time zones, stored as compact rows with the 356 time-zone names deduplicated into a lookup table. It loads
only when the place field is focused, and matching is accent-insensitive (Unicode NFD folding), so "Sao Paulo" finds São Paulo.

| File | What it does |
|---|---|
| `assets/engine.js` | Chart engine: planets, angles, houses, nodes, Lilith, aspects, dignities, sect, fixed stars, patterns, timing |
| `assets/lib.js` | Interpretation library: signs, planets, houses, aspects, themes, history |
| `assets/reading.js` | Rules that turn a chart into a reading for each placement |
| `assets/app.js` | The form, the animated hero, and the guided tour |
| `assets/core.js` | Shared helpers and the chart-wheel renderer |
| `data/cities.json` | ~34,000 cities with time zones, from [GeoNames](https://www.geonames.org/) (CC BY 4.0) |

Positions were checked against the Swiss Ephemeris.

## Design choices

- **Plain words first.** Every placement gets a human label (How I Feel, How I Love) before any jargon,
  and the technical detail is there underneath for anyone who wants it.
- **A guided tour, not a wall of text.** One placement per step, grouped into three chapters, with a
  progress track, arrow-key navigation and an autoplay mode.
- **A night-sky orbit hero** where your Sun and Moon signs circle the moon, drawn in SVG (Pisces gets the koi),
  with letters that rise into place, a comet on the inner ring, shooting stars and a parallax tilt that follows the cursor.
- **Motion with meaning:** aspect lines draw themselves between the planets that talk to each other, and the focused
  planet pulses on the wheel.
- Light and dark themes, keyboard-navigable city search, and full `prefers-reduced-motion` support.

It brings together three earlier projects:

- **[suhani-celestial](https://github.com/suhxnitiwari/suhani-celestial)**: the placement-by-placement
  "Your sky" view, with a reading card and wheel side by side, now for anyone's chart, not just mine.
- **[astrology-results](https://github.com/suhxnitiwari/astrology-results)**: the night-sky design and the
  orbit hero.
- **Charted**: the in-browser chart engine, the interpretation rules and the city search. It now lives entirely here.

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
