// Command-line front end. Parses argv by hand, builds the service over a
// JSON-file store, and prints plain-text tables. Excluded from coverage;
// keep logic out of here and in the service where it can be tested.

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertIsoDay, type Clock } from './dates/days.js';
import { DeckService, toGrade } from './decks/DeckService.js';
import { DomainError, ErrorCodes } from './domain/errors.js';
import type { Card, Grade } from './domain/types.js';
import { JsonFileStore } from './storage/JsonFileStore.js';

interface Options {
  readonly file: string;
  readonly today?: string;
  readonly tag?: string;
  readonly due: boolean;
  readonly limit?: number;
  readonly positional: readonly string[];
}

const USAGE = `Usage: recall <command> [args] [--file data.json] [--today YYYY-MM-DD]

  decks                              list decks
  new-deck <name>                    create an empty deck
  import <deck> <file.md>            add Q:/A: pairs from a Markdown file
  cards <deck> [--tag t] [--due]     list a deck's cards
  card <id>                          show one card and its scheduling state
  review <deck> [--limit n]          print today's session for a deck
  answer <cardId> <grade 0-5>        grade a card and reschedule it
  stats <deck>                       deck statistics
  reset-leech <cardId>               start a leech over as a new card`;

function parseArgs(argv: readonly string[]): Options {
  const positional: string[] = [];
  let file = resolve('data/sample.json');
  let today: string | undefined;
  let tag: string | undefined;
  let due = false;
  let limit: number | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') {
      file = resolve(argv[++i] ?? '');
    } else if (arg === '--today') {
      today = assertIsoDay(argv[++i] ?? '');
    } else if (arg === '--tag') {
      tag = argv[++i];
    } else if (arg === '--due') {
      due = true;
    } else if (arg === '--limit') {
      limit = Number(argv[++i]);
    } else {
      positional.push(arg);
    }
  }
  return { file, today, tag, due, limit, positional };
}

function pad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

function formatCardRow(card: Card): string {
  const front = card.front.length > 44 ? `${card.front.slice(0, 41)}...` : card.front;
  return `${pad(card.id, 10)}${pad(card.state.due, 12)}${pad(card.state.intervalDays, 5)}${front}`;
}

function cmdDecks(service: DeckService): void {
  console.log(`${pad('id', 16)}${pad('cards', 7)}name`);
  for (const deck of service.decks()) {
    console.log(`${pad(deck.id, 16)}${pad(service.cards(deck.id).length, 7)}${deck.name}`);
  }
}

function cmdNewDeck(service: DeckService, [name]: readonly string[]): void {
  const deck = service.createDeck(name ?? '');
  console.log(`Created deck "${deck.name}" (${deck.id})`);
}

function cmdImport(service: DeckService, [deckName, path]: readonly string[]): void {
  const file = resolve(path ?? '');
  if (!existsSync(file)) {
    throw new DomainError(ErrorCodes.IMPORT_SYNTAX, `Import file not found: ${file}`);
  }
  const text = readFileSync(file, 'utf8');
  const result = service.importMarkdown(deckName ?? '', text);
  console.log(`Added ${result.added.length} card(s), skipped ${result.skipped.length} duplicate(s)`);
  for (const front of result.skipped) {
    console.log(`  skipped: ${front}`);
  }
}

function cmdCards(service: DeckService, options: Options): void {
  const [deckName] = options.positional;
  const filter = { tag: options.tag, dueOn: options.due ? service.today() : undefined };
  const cards = service.cards(deckName ?? '', filter);
  console.log(`${pad('id', 10)}${pad('due', 12)}${pad('ivl', 5)}front`);
  for (const card of cards) {
    console.log(formatCardRow(card));
  }
  console.log(`${cards.length} card(s)`);
}

function cmdCard(service: DeckService, [id]: readonly string[]): void {
  const card = service.card(id ?? '');
  const s = card.state;
  console.log(`id:       ${card.id}`);
  console.log(`deck:     ${service.deck(card.deckId).name}`);
  console.log(`front:    ${card.front}`);
  console.log(`back:     ${card.back}`);
  console.log(`tags:     ${card.tags.join(', ') || '(none)'}`);
  console.log(`due:      ${s.due}`);
  console.log(`interval: ${s.intervalDays} day(s)   ease: ${s.easeFactor.toFixed(2)}`);
  console.log(`reps:     ${s.repetitions}   lapses: ${s.lapses}`);
  console.log(`reviews:  ${service.reviewsOf(card.id).length}`);
}

function cmdReview(service: DeckService, options: Options): void {
  const [deckName] = options.positional;
  const session = service.session(deckName ?? '', service.today(), options.limit);
  console.log(`Session for ${service.deck(deckName ?? '').name} on ${session.date}: ${session.cardIds.length} card(s)`);
  console.log(`${pad('id', 10)}${pad('due', 12)}${pad('ivl', 5)}front`);
  for (const id of session.cardIds) {
    console.log(formatCardRow(service.card(id)));
  }
  console.log('Grade each with: answer <cardId> <grade 0-5>');
}

function cmdAnswer(service: DeckService, [id, gradeText]: readonly string[]): void {
  const grade: Grade = toGrade(Number(gradeText));
  const review = service.answer(id ?? '', grade);
  const card = service.card(review.cardId);
  console.log(`Graded ${grade}: interval ${review.intervalBefore} -> ${review.intervalAfter} day(s), due ${card.state.due}, ease ${card.state.easeFactor.toFixed(2)}`);
}

function cmdStats(service: DeckService, [deckName]: readonly string[]): void {
  const deck = service.deck(deckName ?? '');
  const stats = service.stats(deck.id);
  console.log(`${deck.name} on ${service.today()}`);
  console.log(`  total:      ${stats.total}`);
  console.log(`  due today:  ${stats.dueToday}`);
  console.log(`  new:        ${stats.newCards}`);
  console.log(`  learning:   ${stats.learning}`);
  console.log(`  mature:     ${stats.mature}`);
  console.log(`  leeches:    ${stats.leeches}`);
  console.log(`  reviews in last 7 days: ${stats.reviewsLast7Days}`);
}

function cmdResetLeech(service: DeckService, [id]: readonly string[]): void {
  const card = service.resetLeech(id ?? '');
  console.log(`Reset ${card.id}: due ${card.state.due}, interval 0, ease ${card.state.easeFactor.toFixed(2)}`);
}

type Handler = (service: DeckService, options: Options) => void;

const COMMANDS: Record<string, Handler> = {
  decks: (service) => cmdDecks(service),
  'new-deck': (service, o) => cmdNewDeck(service, o.positional),
  import: (service, o) => cmdImport(service, o.positional),
  cards: cmdCards,
  card: (service, o) => cmdCard(service, o.positional),
  review: cmdReview,
  answer: (service, o) => cmdAnswer(service, o.positional),
  stats: (service, o) => cmdStats(service, o.positional),
  'reset-leech': (service, o) => cmdResetLeech(service, o.positional),
};

function buildService(options: Options): DeckService {
  // Noon avoids any chance of a daylight-saving edge when --today is given.
  const clock: Clock = options.today === undefined ? () => new Date() : () => new Date(`${options.today}T12:00`);
  return new DeckService({
    store: new JsonFileStore(options.file),
    ids: () => randomUUID().slice(0, 8),
    clock,
  });
}

function run(argv: readonly string[]): void {
  const options = parseArgs(argv);
  const [command, ...rest] = options.positional;
  const handler = command === undefined ? undefined : COMMANDS[command];
  if (handler === undefined) {
    console.log(USAGE);
    process.exitCode = command === undefined ? 0 : 1;
    return;
  }
  handler(buildService(options), { ...options, positional: rest });
}

try {
  run(process.argv.slice(2));
} catch (error) {
  if (error instanceof DomainError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
