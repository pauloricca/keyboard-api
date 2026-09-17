# Codex Implementation Plan: Keyboard Graphics Renderer

## Goal

Maintain a small, deterministic HTTP service that generates complete piano-keyboard teaching graphics from a single GET URL.

The canonical renderer produces SVG. PNG is derived from that SVG rather than having a separate drawing implementation.

The application is stateless, Dockerized, cacheable, and suitable for browser links, `<img>` embeds, lesson graphics, and small API-driven experiments.

## Current HTTP API

### Render endpoint

```http
GET /render
```

Output is selected with the optional `format` query parameter:

```text
format=svg   # default
format=png
```

Examples:

```text
/render?title=C%20major&chords=C&notes=C4,E4,G4
/render?format=svg&title=C%20major&chords=C&notes=C4,E4,G4
/render?format=png&title=C%20major&chords=C&notes=C4,E4,G4
```

The previous `/render.svg` route is intentionally not retained.

SVG responses use:

```http
Content-Type: image/svg+xml; charset=utf-8
```

PNG responses use:

```http
Content-Type: image/png
```

Both formats should keep:

```http
Cache-Control: public, max-age=86400
X-Content-Type-Options: nosniff
```

`GET /render` with no query parameters returns the plain-text API help. `GET /health` returns service health.

## Rendering architecture

Keep one source of truth for layout and piano geometry:

```text
query parameters
    -> validation / RenderRequest
    -> renderSvg(RenderRequest)
    -> SVG string
          |-> return SVG directly
          `-> rasterize SVG -> PNG
```

Do not implement a second PNG renderer. Any visual/layout change belongs in the SVG renderer and should therefore appear in both output formats automatically.

The Docker runtime provides `rsvg-convert` for rasterization. Local PNG development requires the same executable; SVG development has no extra system dependency.

## Query parameters

Supported recognized parameters:

- `format`: `svg` or `png`, default `svg`
- `title`: optional overall title
- `subtitle`: optional subtitle
- `from`: lowest displayed note, default `C3`
- `to`: highest displayed note, default `C5`
- `chords`: pipe-separated diagram display labels
- `notes`: generic highlighted note groups
- `lh`: left-hand note groups
- `rh`: right-hand note groups
- `emphasize`: emphasized/common-tone groups
- `labels`: `true`, `false`, `1`, or `0`

Use `|` between diagrams and `,` between notes. Explicit notes remain caller-supplied; chord labels do not create voicings.

Unknown query parameters are ignored so external systems may append tracking/share parameters such as `utm_source`. Recognized duplicate parameters and malformed recognized values must still fail with HTTP 400.

## Correctness requirements

Piano geometry is the highest-priority invariant. White notes are C D E F G A B and black keys only occur between C-D, D-E, F-G, G-A, and A-B, giving the repeating 2-black / 3-black pattern.

Derive geometry from pitch classes and white-key indices. Never use image generation or guessed percentages. The renderer must work when the visible range begins or ends on a black key.

All caller-provided text inserted into SVG must be XML escaped. Preserve practical limits on title length, diagram count, note count, keyboard range, and encoded query size.

## Editor

`/editor` is the browser UI. It should generate `/render?...` URLs, using default SVG unless a future editor format selector is deliberately added.

The editor may analyze selected notes and suggest chord names, but the HTTP rendering API itself remains deterministic and does not infer notes from chord labels.

## Docker

The application must run with:

```bash
docker compose up --build
```

The runtime image must include `rsvg-convert` so PNG works without any application-level npm rasterization dependency.

Expected URLs:

```text
http://localhost:3000/editor
http://localhost:3000/health
http://localhost:3000/render?from=C3&to=C5
http://localhost:3000/render?format=png&from=C3&to=C5
```

No volumes are required because rendering is stateless.

## Tests

Keep tests for:

- note parsing and enharmonic equivalence
- black/white key classification
- piano geometry and 2+3 black-key repetition
- query alignment and limits
- `format` defaulting to SVG
- SVG and PNG format validation
- ignoring unknown query parameters
- SVG output escaping and semantic structure
- `/render` content types
- PNG path receiving the SVG output for rasterization
- `/render.svg` returning 404 so the removed route does not silently reappear

Server tests should inject/mock the SVG-to-PNG rasterizer rather than depending on the system binary during the Node test suite. Docker supplies the real binary in production.

## Definition of done for the format migration

The migration is complete when:

```text
/render?...                       -> SVG
/render?format=svg&...            -> SVG
/render?format=png&...            -> PNG
/render.svg?...                   -> 404
```

and the README, API help, editor-generated URLs, tests, and Docker image all describe and support the same behavior.

A representative teaching graphic should work in both formats:

```text
/render?title=Everything%20In%20Its%20Right%20Place&subtitle=Main%20keyboard%20voicings&from=C3&to=C5&chords=C%7CDbmaj7%7CEb6&lh=C3,G3%7CDb3,Ab3%7CEb3,Bb3&rh=C4,E4,G4%7CC4,F4,Ab4%7CC4,G4,Bb4&emphasize=C4
```

The result must remain accurate enough to use as a teaching aid without manually checking whether the piano keyboard has mutated.
