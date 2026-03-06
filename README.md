# bookamat-cli

A command-line interface for the **Bookamat** accounting API. Use it interactively in the terminal or pipe its JSON output to an LLM / automation tool.

## Setup

1. **Install dependencies and link the global command**

   ```bash
   make install
   make link
   ```

   This builds the project and registers `bookamat` as a command on your `$PATH` via `npm link`. You only need to run `make link` once (or again after pulling changes).

2. **Configure credentials** – copy `.env.example` to `.env` and fill in your values:

   ```bash
   cp .env.example .env
   ```

   | Variable             | Description                                                  |
   | -------------------- | ------------------------------------------------------------ |
   | `BOOKAMAT_API_KEY`   | Your Bookamat API key                                        |
   | `BOOKAMAT_USERNAME`  | Your Bookamat username                                       |
   | `BOOKAMAT_COUNTRY`   | Country code, e.g. `at` (auto-detected if omitted)           |
   | `BOOKAMAT_YEAR`      | Accounting year, e.g. `2025` (defaults to latest if omitted) |
   | `BOOKAMAT_READ_ONLY` | Set to `true` to block all write commands                    |

## Usage

```
bookamat [global options] <command> <subcommand> [options]
```

### Global options

| Flag                | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `--api-key <key>`   | Override `BOOKAMAT_API_KEY`                                   |
| `--username <user>` | Override `BOOKAMAT_USERNAME`                                  |
| `--country <cc>`    | Override `BOOKAMAT_COUNTRY`                                   |
| `--year <yyyy>`     | Override `BOOKAMAT_YEAR`                                      |
| `--read-only`       | Block all write commands (also via `BOOKAMAT_READ_ONLY=true`) |
| `--json`            | Output raw JSON – ideal for LLMs and scripts                  |

### Commands

#### `accounts`

```bash
bookamat accounts
```

#### `bookings`

```bash
# List all bookings
bookamat bookings list

# Filter by date range or title
bookamat bookings list --date-from 2026-01-01 --date-until 2026-12-31
bookamat bookings list --title "Office"

# Get a single booking
bookamat bookings get <id>

# Create a booking
bookamat bookings create \
  --title "Office supplies" \
  --date 2026-03-01 \
  --amounts '[{"bankaccount":1,"costaccount":5,"purchasetaxaccount":2,"amount":"119.00","tax_percent":"20.00"}]'

# Update a booking (partial)
bookamat bookings update <id> --title "New title"

# Delete a booking
bookamat bookings delete <id>
```

#### `master-data`

Returns the IDs needed when creating bookings.

```bash
bookamat master-data list bank-accounts
bookamat master-data list cost-accounts
bookamat master-data list tax-accounts
bookamat master-data list cost-centres
bookamat master-data list tags
bookamat master-data list foreign-business-bases
```

#### `inventories`

```bash
bookamat inventories list

bookamat inventories create \
  --title "Laptop" \
  --date-purchase 2026-01-15 \
  --date-commissioning 2026-01-15 \
  --amount 1200.00 \
  --years 3 \
  --type 1 \
  --costaccount 12
```

#### `attachments`

```bash
# List attachments (optionally filter by booking)
bookamat attachments list
bookamat attachments list --booking <id>

# Upload a file to a booking
bookamat attachments upload <booking-id> ./receipt.pdf
```

### JSON output (for LLMs)

Add `--json` to get clean, machine-readable output:

```bash
bookamat --json bookings list --date-from 2026-01-01 --date-until 2026-12-31
bookamat --json master-data list bank-accounts
```

### LLM self-discovery via `schema`

Run `bookamat schema` once to get a full JSON description of every command, all options, their types, and whether each command is read-only or a write operation:

```bash
bookamat schema
```

An LLM should call this at the start of a session to understand the entire API surface before issuing any other commands. The schema includes:

- Every command with its full syntax
- All flags, their types, and whether they are required
- A `readonly` field on each command (`true` = safe, `false` = modifies data)
- A top-level description with usage hints (always use `--json`, what `--read-only` does)

### Read-only mode

Set `BOOKAMAT_READ_ONLY=true` in `.env` (or pass `--read-only`) to block all write operations. Any command that modifies data will exit with an error before touching the API. Useful when giving an LLM access to the CLI.

## Development

| Command                         | Description                                         |
| ------------------------------- | --------------------------------------------------- |
| `make install`                  | Install npm dependencies                            |
| `make build`                    | Compile TypeScript                                  |
| `make link`                     | Build + register `bookamat` globally via `npm link` |
| `make unlink`                   | Remove the global `bookamat` symlink                |
| `make dev ARGS="bookings list"` | Run without building (uses `tsx`)                   |
| `make clean`                    | Remove `build/` and `node_modules/`                 |
