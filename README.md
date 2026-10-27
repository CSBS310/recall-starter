# Recall

Recall is a spaced-repetition flashcard scheduler for the command line. You keep decks of
cards in one JSON file, ask for today's session, grade each card from 0 to 5, and the
scheduler pushes a remembered card further into the future and pulls a forgotten one back
to tomorrow. It was written by a tutor at the Dalles Crossing College tutoring centre for
anatomy students, and the centre now maintains it. No accounts, no sync, no network.

**This is a fictional system made for teaching.** Dalles Crossing College, its tutoring
centre, the tutor and every student, card and review in the sample data are invented.
Nothing here describes a real institution or a real person.

## What you need

Node 20 or newer. Nothing else: the program has no runtime dependencies.

## Getting started

```
npm install
npm run check
```

`npm run check` runs the type checker, the linter and the tests. It is the same thing CI
runs on every pull request.

## Everyday commands

| Command             | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run typecheck` | `tsc --noEmit`                                            |
| `npm run lint`      | ESLint over `src/` and `tests/` (complexity limit is 10)  |
| `npm test`          | the Vitest suite                                          |
| `npm run coverage`  | the suite with a coverage report (80 % lines, 70 % branches) |
| `npm run build`     | compiles `src/` to `dist/`                                |
| `npm start -- ...`  | runs `node dist/cli.js` with the arguments after `--`     |

The CLI reads and writes `data/sample.json` unless you pass `--file <path>`. Every
command also accepts `--today YYYY-MM-DD`, which overrides the clock; the sample data is
built around `--today 2026-11-17`, so use it for the walkthrough below. Without `--today`
the real calendar day is used. Copy `data/sample.json` somewhere first if you want to keep
it pristine: `answer`, `import`, `new-deck` and `reset-leech` write back to the file.

## Demo walkthrough

Build once, then follow the story: a student sits down on 17 November to study anatomy.

```
npm run build
```

1. What decks are there?

   ```
   $ node dist/cli.js decks
   id              cards  name
   anatomy-101     24     Anatomy 101
   spanish-verbs   12     Spanish verbs
   ```

2. How is the anatomy deck doing?

   ```
   $ node dist/cli.js stats "Anatomy 101" --today 2026-11-17
   Anatomy 101 on 2026-11-17
     total:      24
     due today:  15
     new:        6
     learning:   12
     mature:     6
     leeches:    2
     reviews in last 7 days: 12
   ```

3. Which cards are due? Fifteen, according to `stats`.

   ```
   $ node dist/cli.js cards "Anatomy 101" --due --today 2026-11-17
   id        due         ivl  front
   an01      2026-11-17  34   How many chambers does the human heart have?
   an02      2026-11-17  15   Which valve sits between the left atrium ...
   ...
   15 card(s)
   ```

4. Start today's session.

   ```
   $ node dist/cli.js review "Anatomy 101" --today 2026-11-17
   Session for Anatomy 101 on 2026-11-17: 3 card(s)
   id        due         ivl  front
   an06      2026-11-15  14   Which vessels return blood to the heart?
   an08      2026-11-16  1    Which chamber pumps blood into the pulmon...
   an17      2026-11-16  1    What is the windpipe called?
   Grade each with: answer <cardId> <grade 0-5>
   ```

   (Three, not fifteen. Something is off; see the issues.)

5. Grade a card. `an06` was easy:

   ```
   $ node dist/cli.js answer an06 5 --today 2026-11-17
   Graded 5: interval 14 -> 36 day(s), due 2026-12-22, ease 2.60
   ```

   And `an17` was a blank:

   ```
   $ node dist/cli.js answer an17 1 --today 2026-11-17
   Graded 1: interval 1 -> 1 day(s), due 2026-11-17, ease 1.96
   ```

6. Look at one card's state in full.

   ```
   $ node dist/cli.js card an14
   id:       an14
   deck:     Anatomy 101
   front:    What connects bone to bone?
   back:     Ligaments
   tags:     muscle, skeleton
   due:      2026-11-10
   interval: 1 day(s)   ease: 1.30
   reps:     0   lapses: 8
   reviews:  8
   ```

   Eight lapses makes it a leech, which is why it never appears in a session. Give it
   another chance:

   ```
   $ node dist/cli.js reset-leech an14 --today 2026-11-17
   Reset an14: due 2026-11-17, interval 0, ease 2.50
   ```

7. Import more cards from a Markdown file. Two of the eight are already in the deck.

   ```
   $ node dist/cli.js import "Anatomy 101" data/sample-import.md --today 2026-11-17
   Added 6 card(s), skipped 2 duplicate(s)
     skipped: How many chambers does the human heart have?
     skipped: What is the longest bone in the body?
   ```

8. Filter by tag.

   ```
   $ node dist/cli.js cards "Anatomy 101" --tag valves --today 2026-11-17
   id        due         ivl  front
   an02      2026-11-17  15   Which valve sits between the left atrium ...
   an03      2026-11-17  6    Which valve sits between the right atrium...
   ...
   4 card(s)
   ```

Run `node dist/cli.js` with no arguments for the full command list.

## How the code is organised

`src/scheduler/sm2.ts` holds the scheduling rules as pure functions; `src/decks/` holds
the one service, its ports and the pure helpers (Markdown parsing, statistics);
`src/storage/` has an in-memory repository and the JSON-file one the CLI uses. The design,
the numbered domain rules and the known limitations are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Where to start

Issues 01 and 02 are small, well-bounded and labelled `good first issue`; begin there.
[CONTRIBUTING.md](CONTRIBUTING.md) describes the branch, pull-request and review workflow
that every change goes through.
