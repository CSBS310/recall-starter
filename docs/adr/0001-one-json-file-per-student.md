# ADR 0001: Store everything in one JSON file per student

**Status:** Accepted
**Date:** 2026-10-03

## Context

Each student owns their own decks and review history, and the tutoring centre's machines
have no shared database. Students must be able to copy their data onto a USB stick or
email it to a tutor, and a tutor must be able to open it and understand it without a tool.
The whole thing for one student is a few hundred records at most.

## Decision

We will keep all of a student's decks, cards and reviews in a single JSON file
(`{ decks, cards, reviews }`) that the CLI reads completely on start-up and rewrites
completely after every change. Storage sits behind a `RecallStore` interface so the
service never sees the file; the in-memory store is the same class without the rewrite.

## Alternatives considered

- **SQLite or another embedded database** -- adds a native dependency, needs a tool to
  inspect, and buys nothing at this size.
- **One file per deck** -- reviews reference cards across files, and "which files make up
  a student" becomes a question. One file has no such question.
- **Append-only review log plus a snapshot** -- more robust against a crash mid-write, but
  two files to keep consistent. If a crash during the rewrite ever bites, revisit.

## Consequences

Easier: backup is `cp`; inspection is any text editor; tests run against the in-memory
store with no files at all. Harder: the file is rewritten on every `answer`, so a session
of 20 cards writes the file 20 times (cheap today, but it rules out very large decks); two
processes writing the same file at once will lose one of the writes.
