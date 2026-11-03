# Clefhanger

**Free, open source music notation that runs entirely in your browser.**
No account, no login, no backend, no tracking. Your scores stay on your device.

Clefhanger is an MIT-licensed score editor in the spirit of Flat.io, but fast,
offline-friendly and private by design. Write music with the mouse or the
keyboard, hear it back, and move it in and out of other notation apps with
MusicXML and MIDI.

## Features

- **Engraved score** rendered with [VexFlow](https://www.vexflow.com/): staves,
  treble/bass/alto/tenor clefs, key and time signatures, notes, chords, rests,
  dots, accidentals, beams and ties, with automatic line breaks.
- **Fast note entry.** Click the staff to place a note, or type letter names
  like a word processor. Number keys pick durations, `+` `-` `=` set
  accidentals, `T` ties, arrows move pitch and the cursor.
- **Playback** with [Tone.js](https://tonejs.github.io/): play, pause, stop and
  live tempo control. Sounds are synthesized in the browser, so it works
  offline and fetches nothing from third parties.
- **Multiple instruments and staves**: piano and harp grand staves, strings,
  winds, brass, guitar, voices. Rename, reorder, change clefs.
- **Undo and redo** for every edit.
- **Your files, locally**: save and open `.clef.json` projects, with autosave
  to browser storage on every change.
- **MusicXML** export and import (`.musicxml`, `.xml` and compressed `.mxl`),
  plus **MIDI** export.
- **Light and dark mode**, and a layout that works on phones and tablets.

## Getting started

You need [Node.js](https://nodejs.org/) 20.19 or newer.

```bash
git clone https://github.com/Hudsoonvid/Clefhanger.git
cd Clefhanger
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

| Script              | What it does                               |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Start the dev server with hot reload       |
| `npm test`          | Run the unit tests (Vitest)                |
| `npm run typecheck` | Type-check the project                     |
| `npm run build`     | Build a static site into `dist/`           |
| `npm run preview`   | Serve the production build locally         |

The build is a folder of static files with relative paths, so you can host it
anywhere: GitHub Pages, Netlify, any web server, or open it from a USB stick
through a local server.

## Writing music

Clefhanger has two modes, toggled with **N** or the pencil button:

- **Note input** (default): a blue caret marks where the next note goes.
  Clicking the staff or typing **A–G** writes a note there and moves on, the
  way typing moves a text cursor. Arrow keys, accidentals and **T** act on the
  note you just entered.
- **Select**: click a note to select it. Typing a letter changes its pitch,
  a number key changes its duration, **Delete** turns it into a rest.

| Keys                    | Action                                     |
| ----------------------- | ------------------------------------------ |
| `A`–`G`                 | Enter a note (Shift adds it to the chord)  |
| `7` `6` `5` `4` `3` `2` | Whole, half, quarter, eighth, 16th, 32nd   |
| `.`                     | Dot                                        |
| `0` or `R`              | Rest                                       |
| `+` / `-` / `=`         | Sharp / flat / natural                     |
| `T`                     | Tie                                        |
| `↑` `↓`                 | Pitch up/down a step (Shift: semitone, Ctrl: octave) |
| `←` `→`                 | Move the cursor (Ctrl: by measure)         |
| `Alt` + `↑` `↓`         | Move to the staff above/below              |
| `Space`                 | Play / pause                               |
| `Ctrl` + `Z` / `Y`      | Undo / redo                                |
| `Ctrl` + `S` / `O`      | Save / open a project                      |
| `?`                     | Show every shortcut                        |

Notes that don't fit in the measure are split across the barline and tied
automatically, and changing the time signature re-bars the whole score.

## Privacy

Clefhanger has no server and never contacts a third party: no analytics, no
cookies, no fonts or samples from CDNs (the music font is bundled). The only
requests are for the app's own files. Autosave uses your browser's
`localStorage`; project files are saved wherever you choose.

## How it's built

TypeScript, React, Vite, VexFlow 5, Tone.js and immer. The core idea is that
**the score model knows nothing about rendering, audio or the DOM**, so each
layer can be extended or replaced on its own.

```
src/
├─ model/        Pure score model: types, durations, pitch maths, instruments,
│                immutable edit operations, timeline. No DOM, fully unit tested.
├─ io/           File formats: project JSON, MusicXML import/export (+ .mxl),
│                MIDI export. Pure functions from Score to bytes and back.
├─ render/       VexFlow renderer: measure widths, line breaking, drawing, and a
│                hit map that turns clicks into score locations.
├─ playback/     Tone.js engine and synthesized instrument sounds.
├─ editor/       App state (zustand): undo history, selection, input mode,
│                commands shared by the keyboard, toolbar and mouse.
├─ storage/      Browser autosave and preferences.
└─ ui/           React components and the theme stylesheet.
tests/           Score model, MusicXML, MIDI and project file tests.
```

A `Score` holds parts, a part holds staves, a staff holds measures, and a
measure holds events (notes, chords and rests). Every measure is always exactly
full, with gaps written as rests; that one invariant keeps editing, rendering
and playback simple. Edits are pure functions (`src/model/operations.ts`) that
return a new score, which is what makes undo/redo trivial.

## Current limitations

This is an MVP. Not supported yet: multiple voices per staff, tuplets, grace
notes, key/time/clef changes mid-score, repeats, dynamics and articulations,
lyrics, and transposing instruments (everything is at concert pitch). MusicXML
import keeps the first voice of each staff and fits anything else it can't
represent.

## Contributing

Issues and pull requests are welcome. Please run `npm test` and
`npm run typecheck` before opening a PR, and add tests for model or file
format changes.

## License

[MIT](LICENSE)
