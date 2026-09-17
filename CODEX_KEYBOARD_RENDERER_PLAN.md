# Codex Implementation Plan: SVG Keyboard / Progression Renderer

## Goal

Build a small, deterministic HTTP service that generates complete keyboard teaching graphics as **SVG** from a single **GET URL**.

The service should be suitable for URLs that can be opened directly in a browser, embedded in an `<img>`, cached by a CDN, or shared with someone else.

The primary use case is generating a whole image containing:

- optional title
- optional subtitle
- one or more piano keyboard diagrams
- a label/title for each diagram (for example a chord name)
- explicitly highlighted notes on each keyboard
- optional separate left-hand and right-hand note groups
- optional emphasized notes/common tones
- optional note names

The renderer must be **deterministic**. Do not use AI/image generation. Piano geometry and note positions must always be musically correct.

The application must run in **Docker**.

---

## V1 scope

Keep V1 intentionally small.

Implement:

1. One GET endpoint that returns SVG.
2. Multiple keyboard diagrams in one response.
3. Explicit notes supplied by the caller; do **not** implement chord-to-voicing intelligence yet.
4. Correct piano geometry for arbitrary sensible note ranges.
5. Automatic document height based on the number of diagrams.
6. Optional left-hand/right-hand grouping.
7. Optional emphasized/common notes.
8. Labels and titles.
9. Docker image and `docker compose` setup.
10. Basic tests for note parsing, keyboard geometry, query parsing, and SVG output.

Do **not** add a database, authentication, frontend framework, persistent storage, PNG rendering, MIDI playback, chord recognition, or a POST API in V1.

---

## Suggested stack

Use **Node.js + TypeScript**.

Prefer a very small HTTP framework such as Fastify or Express. Fastify is preferred, but avoid unnecessary dependencies.

Generate SVG directly as XML/text. Do not use Canvas or a headless browser to draw the keyboard.

Suggested project structure:

```text
/
  src/
    server.ts
    render.ts
    keyboard.ts
    notes.ts
    query.ts
    types.ts
  test/
    notes.test.ts
    keyboard.test.ts
    query.test.ts
    render.test.ts
  Dockerfile
  compose.yml
  package.json
  tsconfig.json
  README.md
```

The exact structure may be adjusted if there is a good reason.

---

## HTTP API

### Endpoint

```http
GET /render.svg
```

Return:

```http
Content-Type: image/svg+xml; charset=utf-8
```

Because rendering is deterministic from the URL, add a cache header such as:

```http
Cache-Control: public, max-age=86400
```

We can increase cache duration later.

Also provide a trivial health endpoint:

```http
GET /health
```

returning `200 OK`.

---

## Query format

V1 should be easy for humans to construct by hand.

Example:

```text
/render.svg?title=Everything%20In%20Its%20Right%20Place&subtitle=Main%20keyboard%20voicings&from=C3&to=C5&chords=C|Dbmaj7|Eb6&lh=C3,G3|Db3,Ab3|Eb3,Bb3&rh=C4,E4,G4|C4,F4,Ab4|C4,G4,Bb4&emphasize=C4
```

Interpret pipe `|` as the separator between diagrams and comma `,` as the separator between notes within one diagram.

### Parameters

#### `title`

Optional overall title.

#### `subtitle`

Optional overall subtitle.

#### `from`

Lowest note shown on every keyboard.

Default:

```text
C3
```

#### `to`

Highest note shown on every keyboard.

Default:

```text
C5
```

#### `chords`

Pipe-separated diagram labels.

Example:

```text
C|Dbmaj7|Eb6
```

Despite the parameter name, V1 treats these as **display labels only**. Do not derive notes from them.

#### `notes`

Optional generic highlighted notes if hand grouping is not needed.

Example:

```text
C3,G3,C4,E4,G4|Db3,Ab3,C4,F4,Ab4
```

#### `lh`

Optional pipe-separated left-hand note groups.

Example:

```text
C3,G3|Db3,Ab3|Eb3,Bb3
```

#### `rh`

Optional pipe-separated right-hand note groups.

Example:

```text
C4,E4,G4|C4,F4,Ab4|C4,G4,Bb4
```

#### `emphasize`

Optional notes to visually emphasize.

For V1, allow one comma-separated set applied to every diagram:

```text
C4
```

If easy to support without complicating the parser, pipe-separated per-diagram emphasis is acceptable too.

#### `labels`

Optional boolean controlling note-name labels.

Default:

```text
true
```

Accept `true`, `false`, `1`, and `0`.

---

## Example request

This should produce a single vertical teaching graphic containing three keyboards:

```text
/render.svg?title=Everything%20In%20Its%20Right%20Place&subtitle=Main%20keyboard%20voicings&from=C3&to=C5&chords=C|Dbmaj7|Eb6&lh=C3,G3|Db3,Ab3|Eb3,Bb3&rh=C4,E4,G4|C4,F4,Ab4|C4,G4,Bb4&emphasize=C4
```

Diagram data represented by that URL:

```text
C
LH: C3 G3
RH: C4 E4 G4

Dbmaj7
LH: Db3 Ab3
RH: C4 F4 Ab4

Eb6
LH: Eb3 Bb3
RH: C4 G4 Bb4

Common/emphasized note: C4
```

---

## Note parser

Internally convert every note to a MIDI-style integer.

Support at minimum:

```text
C3
Db3
D3
Eb3
E3
F3
Gb3
G3
Ab3
A3
Bb3
B3
```

Also support sharps, e.g. `C#4`, even if examples primarily use flats.

Enharmonic notes must map to the same pitch:

```text
Db4 == C#4
Eb4 == D#4
```

Preserve the caller's spelling when displaying an explicitly supplied label where practical.

Reject malformed notes with HTTP 400 rather than silently guessing.

Have dedicated functions along the lines of:

```ts
parseNote("Db4") -> 61
isBlackKey(61) -> true
formatNote(61) -> "Db4" // formatting policy may be configurable later
```

Keep music/note logic independent from SVG rendering.

---

## Piano geometry

This is the most important correctness requirement.

White-key pitch classes are:

```text
C D E F G A B
```

Black keys exist only between:

```text
C-D
D-E
F-G
G-A
A-B
```

Therefore the visible pattern must always be:

```text
2 black keys, gap, 3 black keys, gap
```

Do not position keys by guessing percentages from note names. Derive positions from pitch classes / white-key indices.

Recommended approach:

1. Enumerate every semitone between `from` and `to`.
2. Determine which are white notes.
3. Give white notes sequential integer positions.
4. Draw white keys first.
5. Position black keys at the boundary between their adjacent white keys.
6. Draw black keys second so they appear above white keys.
7. Overlay highlights and labels appropriately.

The renderer should work correctly when the range starts or ends on either a white or black note.

Write unit tests specifically verifying the repeating black-key pattern.

---

## SVG layout

Use one root `<svg>` containing the complete graphic.

Suggested defaults:

```text
width: 1200px
background: white
```

Height should be calculated automatically:

```text
header height
+ diagram count * diagram block height
+ footer/padding
```

Each diagram block should contain:

1. chord/diagram title
2. keyboard
3. optional hand/note legend beneath it

Use generous spacing and rounded/light panel backgrounds if useful, similar to a clean educational infographic.

Do not hard-code a three-diagram layout.

One diagram and ten diagrams must both render correctly.

---

## Colours

Use sensible defaults but keep them centralized as constants/theme values.

For example:

```text
white key: white
black key: near-black
left hand: blue
right hand: warm red/pink
generic highlight: amber or blue
emphasized/common tone: stronger red/accent
text: near-black
secondary text: gray
panel: very light gray
```

Exact colours are not important in V1. Maintain sufficient contrast and readability.

If a note belongs to a hand group and is also emphasized, emphasis should win visually while the legend still makes its hand membership clear.

---

## Labels

When `labels=true`, label highlighted notes directly on or near their keys.

Prefer labels such as:

```text
C3
Db3
C4
```

Avoid labeling every chromatic key if that makes the graphic cluttered. The initial renderer can label highlighted notes plus useful octave/reference C notes.

Below each keyboard, if hand groups were provided, automatically render something similar to:

```text
LH: C–G       RH: C–E–G
```

Use pitch names without octave numbers in this summary.

---

## XML safety

All caller-provided strings inserted into SVG must be XML escaped.

This includes:

- title
- subtitle
- chord/diagram labels
- any future captions

Never concatenate unescaped user text into SVG markup.

Set reasonable maximum lengths and maximum diagram counts so a malicious query cannot generate an enormous response.

Suggested V1 limits:

```text
max diagrams: 16
max title: 120 chars
max subtitle: 200 chars
max keyboard span: 88 keys / standard piano range
```

Return HTTP 400 with a small text or JSON error for invalid requests.

---

## Docker

The application must be runnable with:

```bash
docker compose up --build
```

Then:

```text
http://localhost:3000/health
http://localhost:3000/render.svg?...
```

Use a multi-stage Docker build if useful.

Example intent:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Do not blindly copy this if the selected package manager/build setup requires something different.

`compose.yml` should expose port 3000 and configure restart behaviour appropriate for a simple web service.

No volumes should be necessary because the service is stateless.

---

## Tests

At minimum test:

### Note parsing

```text
C4 -> 60
Db4 -> 61
C#4 -> 61
B3 -> 59
```

### Key type

Verify C, D, E, F, G, A, B are white and accidentals are black.

### Geometry

Verify black keys occur only after C, D, F, G, A and produce the correct 2+3 repeating grouping.

### Query parsing

Given:

```text
chords=C|Dbmaj7|Eb6
lh=C3,G3|Db3,Ab3|Eb3,Bb3
```

produce three correctly aligned diagram objects.

Reject mismatched group counts where the intended mapping is ambiguous.

### SVG output

Check that:

- output is valid-looking SVG
- requested title appears escaped
- requested chord labels appear
- correct number of keyboard groups is produced
- requested highlighted MIDI notes appear in renderer data/classes

Prefer testing semantic output/data attributes rather than brittle pixel positions wherever possible.

---

## Helpful SVG metadata

Add useful classes/data attributes to generated elements, for example:

```xml
<g class="keyboard" data-diagram-index="0">
<rect class="key white" data-note="C3" data-midi="48" ... />
<rect class="key black highlighted left" data-note="Db3" data-midi="49" ... />
```

This makes automated testing and future CSS/client-side interactivity much easier.

---

## README

Document:

1. what the service does
2. Docker quick start
3. endpoint and parameters
4. at least three copy/paste example URLs
5. parameter encoding (`|` separates diagrams, `,` separates notes)
6. current limitations

Include examples for:

- one chord
- a three-chord progression
- separate LH/RH highlighting

---

## Definition of done

V1 is complete when all of the following work:

```bash
docker compose up --build
```

and opening a URL equivalent to:

```text
http://localhost:3000/render.svg?title=Everything%20In%20Its%20Right%20Place&subtitle=Main%20keyboard%20voicings&from=C3&to=C5&chords=C|Dbmaj7|Eb6&lh=C3,G3|Db3,Ab3|Eb3,Bb3&rh=C4,E4,G4|C4,F4,Ab4|C4,G4,Bb4&emphasize=C4
```

returns a polished single SVG containing:

- title
- subtitle
- three correctly drawn C3-C5 piano keyboards
- correct 2-black/3-black piano geometry
- diagram labels C, Dbmaj7, Eb6
- left-hand and right-hand notes highlighted distinctly
- C4 emphasized throughout
- note labels/legends
- automatically calculated page height

The result should be accurate enough that we can use it as a teaching aid without manually checking whether the piano keyboard itself has mutated.

---

## Future ideas — explicitly not V1

Keep the architecture friendly to these, but do not implement them unless V1 is already complete and explicitly requested:

- `POST /render.svg` with JSON body
- PNG/WebP output
- chord name -> notes
- automatic inversions / voice leading
- scale diagrams
- interval diagrams
- guitar/fretboard diagrams
- custom themes
- grid/horizontal layouts
- finger numbers
- captions / theory notes
- MIDI input/output
- animated progressions
- downloadable lesson sheets

The immediate goal is a **small, stateless, deterministic, Dockerized GET-to-SVG service** that does one thing extremely reliably.
