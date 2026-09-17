export const apiHelp = `Keyboard SVG API

GET /render.svg?<parameters>

Add query parameters to generate a piano teaching graphic as SVG.
For a visual editor, open /editor. Check service health at /health.

Parameters
  title       Optional heading (up to 120 characters).
  subtitle    Optional subheading (up to 200 characters).
  from        Lowest displayed note; default C3.
  to          Highest displayed note; default C5.
  chords      Diagram names separated by | (up to 80 characters each).
              Names are display labels; they do not generate notes.
  notes       Highlighted notes, comma-separated within each diagram.
  lh          Left-hand notes, comma-separated within each diagram.
  rh          Right-hand notes, comma-separated within each diagram.
  emphasize   Emphasized notes: one comma-separated set for all diagrams,
              or separate sets for each diagram using |.
  labels      Show note names: true, false, 1, or 0; default true.

Use | between diagrams and , between notes. Supplied chords/notes/lh/rh
lists must have matching diagram counts. Keep empty groups for rests:
lh=C3||G3. A single emphasis group applies to every diagram.

Notes use uppercase letters and octave numbers: C4, Db4, C#4.
Encode # as %23, | as %7C, and spaces as %20 (or use URLSearchParams).
All selected notes must be inside the displayed range, within A0-C8.
Limits: 16 diagrams, 88 notes per group, 16 KiB encoded query text.
If hand groups overlap, colour priority is emphasis > RH > LH > generic.

Examples (append these paths to this server's address)

One chord:
/render.svg?title=C%20major&chords=C&notes=C4,E4,G4

Three layouts:
/render.svg?chords=C%7CF%7CG&notes=C4,E4,G4%7CF3,A3,C4%7CG3,B3,D4

Separate hands and a common tone:
/render.svg?chords=C%7CDbmaj7%7CEb6&lh=C3,G3%7CDb3,Ab3%7CEb3,Bb3&rh=C4,E4,G4%7CC4,F4,Ab4%7CC4,G4,Bb4&emphasize=C4

Blank keyboard with an explicit range:
/render.svg?from=C3&to=C5

Successful render requests return image/svg+xml; charset=utf-8 and
Cache-Control: public, max-age=86400. Use the URL directly in a browser
or an HTML img element, or save the response as an .svg file.
Invalid parameters return HTTP 400 with a JSON error.
No parameters returns these instructions as plain text.
`;
