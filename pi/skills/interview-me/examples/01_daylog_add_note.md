Add a CLI command that appends one timestamped note to a local JSONL journal.

# Add note

Append one text note to the local daylog journal.

## Required dependencies

Journal file record contract:

```ts
// File: src/journal/JournalNoteRecord.ts
type JournalNoteRecord = {
  noteId: string
  text: string
  createdAt: string
}
```

## Entry

CLI:

```sh
daylog add "<text>"
```

Internal entry:

```ts
// File: src/commands/addNote.ts
declare function addNote(input: {
  text: string
}): Promise<{
  noteId: string
  createdAt: string
}>
```

## Flow

```flow
-> trim note text
-> if trimmed text is empty
  <- fail with usage error
-> ensure `~/.daylog` directory exists
  -> if directory does not exist
    -> create it
  -> if path exists but is not a directory
    <- fail with storage error
-> generateNoteId
-> get current UTC time
-> append one `JournalNoteRecord` JSON line to `~/.daylog/notes.jsonl`
  -> if append fails
    <- fail with storage error
<- print created note id
```

## Behaviors

- when text is non-empty, should append exactly one note record
- when text has surrounding whitespace, should store trimmed text
- when text is empty after trimming, should exit with usage error
- when `~/.daylog` does not exist, should create it
- when `~/.daylog/notes.jsonl` does not exist, should create it
- when `~/.daylog` exists but is not a directory, should exit with storage error
- when append fails, should exit with storage error
- when append succeeds, should print the created note id

## Out of scope

- duplicate note detection

## References

- `src/cli.ts` - use the existing command dispatch and process exit pattern
- `src/commands/init.ts` - use the same home-directory path resolution and directory creation style
- `src/errors.ts` - use the existing user-facing usage/storage error formatting

## Implementation notes

- Use JSONL, one note record per line.
- `createdAt` must be UTC ISO-8601.
- Append must write a trailing newline with every record.
