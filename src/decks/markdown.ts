// Parses the import format: `Q: ...` / `A: ...` pairs, optionally preceded by a
// `#tag #tag` line that applies to the next card. One line at a time.

import { DomainError, ErrorCodes } from '../domain/errors.js';

export interface ParsedCard {
  readonly front: string;
  readonly back: string;
  readonly tags: readonly string[];
}

const Q_PREFIX = 'Q: ';
const A_PREFIX = 'A: ';

function syntaxError(lineNo: number, expected: string, line: string): DomainError {
  return new DomainError(
    ErrorCodes.IMPORT_SYNTAX,
    `line ${lineNo}: expected ${expected} but found "${line}"`,
  );
}

// Tags are kept as one comma-separated string while we walk the file and
// split when the card is emitted.
function collectTags(tags: string, line: string): string {
  let result = tags;
  const words = line.split(' ');
  for (const word of words) {
    if (word.startsWith('#') && word.length > 1) {
      if (result.length === 0) {
        result = word.substring(1);
      } else {
        result = result + ',' + word.substring(1);
      }
    }
  }
  return result;
}

function parseAnswer(line: string, lineNo: number): string {
  if (!line.startsWith(A_PREFIX)) {
    throw syntaxError(lineNo, '"A: "', line);
  }
  const back = line.substring(A_PREFIX.length);
  if (back.length === 0) {
    throw syntaxError(lineNo, 'an answer after "A: "', line);
  }
  return back;
}

/**
 * Walks the file line by line. `mode` is 0 while we wait for a question and
 * 1 while we wait for its answer.
 */
export function parseMarkdown(text: string): ParsedCard[] {
  const cards: ParsedCard[] = [];
  const lines = text.split('\n');
  let mode = 0;
  let front = '';
  let tags = '';
  let lineNo = 0;
  for (const line of lines) {
    lineNo += 1;
    if (mode === 0) {
      if (line.startsWith(Q_PREFIX)) {
        front = line.substring(Q_PREFIX.length);
        if (front.length === 0) {
          throw syntaxError(lineNo, 'a question after "Q: "', line);
        }
        mode = 1;
      } else if (line.startsWith('#')) {
        tags = collectTags(tags, line);
      } else if (line.length === 0 && lineNo === lines.length) {
        // The usual trailing newline at the end of the file.
      } else {
        throw syntaxError(lineNo, '"Q: " or a "#tag" line', line);
      }
    } else {
      const back = parseAnswer(line, lineNo);
      cards.push({ front, back, tags: tags.length === 0 ? [] : tags.split(',') });
      front = '';
      tags = '';
      mode = 0;
    }
  }
  if (mode === 1) {
    throw syntaxError(lineNo, 'an "A: " line for the last question', '<end of file>');
  }
  return cards;
}
