# Keyboard SVG API

A stateless, deterministic Node.js/TypeScript service for piano teaching graphics. Each GET URL produces one complete SVG with a title, stacked keyboards, explicit highlighted notes, hand legends, and optional common-tone emphasis. No AI or chord inference is involved.

## Run with Docker

```sh
docker compose up --build -d
```

Open [health](http://localhost:3000/health) or one of the examples below. The service listens on port 3000. Compose restarts it unless stopped and checks `/health`. No volumes or database are needed. Stop with `docker compose down`.

## Visual editor

Open [Keyboard Studio](http://localhost:3000/editor) (also linked from `/`). It starts with one blank keyboard. Set the title, subtitle, shared note range, and note-name visibility. Each layout has a clickable keyboard: choose Left hand, Right hand, Generic, or Emphasis, then click keys to toggle them. Each pitch has exactly one state in the editor: assigning it to a new mode removes it from the others; clicking again in the same mode clears it. Typed comma-separated notes follow the same rule, including enharmonic equivalents such as C#4 and Db4. All four groups contribute to chord detection.

Add or remove layouts up to the 16-layout limit. Chord matching uses [Tonal’s chord dictionary](https://tonaljs.github.io/tonal/docs/dictionaries/chord-types), including extended, altered, diminished, augmented, suspended, added-tone and sixth chords. Inversions retain the actual lowest note as a slash bass. Non-chord bass notes are described separately from inversions. Plausible omitted-root/fifth readings are explicitly marked and penalized against complete matches. This remains a bounded dictionary, not an exhaustive interpretation of every possible note collection.

The progression key defaults to Auto. A deterministic heuristic weighs scale fit, the opening harmony and dominant-to-tonic motion across all layouts, then ranks chord interpretations by that context. For example, C–E–G–A can be C6 after a C-major opening or Am7/C after an A-minor opening. Editing or removing earlier chords updates automatic names throughout the progression. Diatonic roots use the key’s spelling, such as F#m in D major. The displayed scale degree describes the suggested root; inversion describes the actual bass, independently of the key.

Key inference is tentative, particularly with one chord, and shows other possible keys. Choose a major/minor key explicitly or select No key context for independent matching. Automatic analysis uses one overall key; it does not model modulation, rhythm, melody, or every musical style. Expand Other interpretations to select a different reading, or type any custom name. Both actions lock that layout’s name; “Use auto name” restores automatic naming. Custom display text does not override the note-based key estimate.

Press Play beside Remove to hear a layout’s selected notes, from low to high, with a 25 ms stagger (capped at 220 ms total for dense chords). Playback uses a locally synthesized piano-like tone, lasts about 2.5 seconds, and replaying replaces the previous chord. Empty or invalid layouts cannot play. Audio requires browser support and a user click.

The API URL updates live. Copy it to share, or choose Generate SVG to preview and Download SVG to save the generated file. Regenerate after edits to refresh the preview. Invalid notes or ranges disable generation without discarding selections. Editor state lasts for the current page session; save the API URL or SVG before leaving.

For local development (Node.js 22 or later):

```sh
npm ci
npm test
npm run build
npm start
```

`npm run dev` builds browser assets and enables server reloads. Run `npm run build` again after changing browser modules. Set `PORT` to change the local server port.

## API

`GET /render.svg` without parameters returns plain-text API instructions and examples. With query parameters, it returns `image/svg+xml; charset=utf-8` with `Cache-Control: public, max-age=86400`. For a blank keyboard, use `/render.svg?from=C3&to=C5`. `GET /health` returns JSON with status `ok`. Invalid render queries return HTTP 400 and a JSON error.

| Parameter | Meaning | Default / limit |
| --- | --- | --- |
| `title` | Overall heading | Optional; 120 characters |
| `subtitle` | Overall subheading | Optional; 200 characters |
| `from`, `to` | Inclusive shared keyboard range | C3–C5; ordered within A0–C8 |
| `chords` | Pipe-separated display labels; never inferred voicings | Optional; 80 characters each |
| `notes` | Generic highlighted note groups | Optional |
| `lh`, `rh` | Left/right hand note groups | Optional |
| `emphasize` | Global comma-separated notes, or pipe-separated groups | Optional |
| `labels` | Note names on highlighted keys and reference Cs | `true`; accepts true/false/1/0 |

Use `|` between diagrams and `,` between notes. All supplied diagram lists must have the same number of groups; use empty groups for rests, e.g. `lh=C3||G3`. A single emphasis group applies to every diagram. Maximum: 16 diagrams, 88 tokens per note group, and 16 KiB of encoded query text. With no groups supplied, one unhighlighted keyboard is drawn. Notes outside the displayed range, unknown parameters, duplicate parameters, and malformed notes are rejected.

Use uppercase note letters and optional `b` or `#` accidentals, such as `Db4` and `C#4`. Enharmonic duplicates within a group are collapsed, retaining the first spelling. Encode `#` as `%23` in URLs, otherwise browsers treat it as a fragment. Use `URLSearchParams` when generating links; it safely encodes spaces, pipes (`%7C`), commas (`%2C`), and other reserved characters.

Highlight precedence is emphasis, right hand, left hand, then generic. Both hand memberships remain in the legends when groups overlap. Labels on keys preserve the winning group's spelling. Legends omit octaves. Black endpoints retain their full width and correct boundary positions; unrequested adjacent white notes are omitted. Wide ranges use smaller key labels. Long headings and legends wrap; SVG height grows with content.

## Copy/paste examples

One chord:

```text
http://localhost:3000/render.svg?title=C%20major&chords=C&notes=C4,E4,G4
```

Three-chord progression:

```text
http://localhost:3000/render.svg?title=Three%20chords&chords=C%7CF%7CG&notes=C4,E4,G4%7CF3,A3,C4%7CG3,B3,D4
```

Separate hands and common-tone emphasis:

```text
http://localhost:3000/render.svg?title=Everything%20In%20Its%20Right%20Place&subtitle=Main%20keyboard%20voicings&from=C3&to=C5&chords=C%7CDbmaj7%7CEb6&lh=C3,G3%7CDb3,Ab3%7CEb3,Bb3&rh=C4,E4,G4%7CC4,F4,Ab4%7CC4,G4,Bb4&emphasize=C4
```

Embed any URL in an HTML `<img>` (escape ampersands as `&amp;` in HTML), open it directly, or save it with `curl -o lesson.svg 'URL'`.

## V1 limitations

SVG only, vertical layout, fixed colours, and explicit caller-supplied notes. The editor suggests chord labels; the rendering API does not infer notes from chord names. No chord-to-voicing intelligence, PNG output, MIDI playback, POST endpoint, authentication, database, or persistent storage. Output uses system Arial/Helvetica/sans-serif fonts, so text appearance can vary by viewer while geometry and response bytes remain deterministic.
