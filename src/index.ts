#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { BookamatClient } from "./client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Print result either as pretty JSON or as a human-readable table/list */
function output(data: unknown, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log("(no results)");
      return;
    }
    // Print each item as indented JSON block with a separator for readability
    data.forEach((item, i) => {
      if (i > 0) console.log("─".repeat(60));
      console.log(JSON.stringify(item, null, 2));
    });
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

/** Abort if read-only mode is active, before any write operation */
function assertWritable(opts: { readOnly?: boolean }): void {
  if (opts.readOnly ?? process.env.BOOKAMAT_READ_ONLY === "true") {
    console.error(
      "Error: Read-only mode is enabled. This command writes data and is not allowed.",
    );
    process.exit(1);
  }
}

/** Build a client, auto-resolving country/year if not supplied */
async function getClient(opts: {
  apiKey?: string;
  username?: string;
  country?: string;
  year?: string;
}): Promise<BookamatClient> {
  const apiKey = opts.apiKey ?? process.env.BOOKAMAT_API_KEY;
  const username = opts.username ?? process.env.BOOKAMAT_USERNAME;
  const country = opts.country ?? process.env.BOOKAMAT_COUNTRY;
  const year = opts.year ?? process.env.BOOKAMAT_YEAR;

  if (!apiKey || !username) {
    console.error(
      "Error: API key and username are required.\n" +
        "Set BOOKAMAT_API_KEY + BOOKAMAT_USERNAME env vars, or pass --api-key / --username.",
    );
    process.exit(1);
  }

  const client = new BookamatClient(apiKey, username, country, year);

  // Auto-resolve country/year from the user's accounts when not provided
  if (!country || !year) {
    const accounts = await client.getAccounts();
    if (accounts.length === 0) {
      console.error("Error: No accounts found and no country/year provided.");
      process.exit(1);
    }
    // Default to the most recent year
    const latest = accounts.sort((a, b) => b.year - a.year)[0];
    const match = latest.url.match(/^\/([a-z]+)\/(\d+)\/$/);
    if (match) {
      client.setContext(match[1], parseInt(match[2]));
    } else {
      console.error("Error: Could not parse account URL:", latest.url);
      process.exit(1);
    }
  }

  return client;
}

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("bookamat")
  .description("CLI for the Bookamat accounting API")
  .version("1.0.0")
  // Global auth options (can also come from env)
  .option("--api-key <key>", "Bookamat API key (or BOOKAMAT_API_KEY)")
  .option("--username <user>", "Bookamat username (or BOOKAMAT_USERNAME)")
  .option("--country <cc>", "Country code, e.g. at (or BOOKAMAT_COUNTRY)")
  .option("--year <yyyy>", "Accounting year, e.g. 2025 (or BOOKAMAT_YEAR)")
  .option(
    "--read-only",
    "Read-only mode – any command that writes data will be rejected (or BOOKAMAT_READ_ONLY=true)",
  )
  .option("--json", "Output raw JSON (machine-readable, ideal for LLMs)");

// ---------------------------------------------------------------------------
// accounts
// ---------------------------------------------------------------------------

program
  .command("accounts")
  .description("List all available user accounts (country/year combinations)")
  .action(async () => {
    const g = program.opts();
    const client = new BookamatClient(
      g.apiKey ?? process.env.BOOKAMAT_API_KEY ?? "",
      g.username ?? process.env.BOOKAMAT_USERNAME ?? "",
    );
    if (!g.apiKey && !process.env.BOOKAMAT_API_KEY) {
      console.error("Error: BOOKAMAT_API_KEY required.");
      process.exit(1);
    }
    const accounts = await client.getAccounts();
    output(accounts, !!g.json);
  });

// ---------------------------------------------------------------------------
// bookings
// ---------------------------------------------------------------------------

const bookingsCmd = program
  .command("bookings")
  .description("Manage bookings (invoices / expenses)");

bookingsCmd
  .command("list")
  .description("List bookings")
  .option("--date-from <YYYY-MM-DD>", "Filter: earliest date (inclusive)")
  .option("--date-until <YYYY-MM-DD>", "Filter: latest date (inclusive)")
  .option("--title <text>", "Filter: title contains text")
  .option("--limit <n>", "Max results per page", "100")
  .option("--page <n>", "Page number", "1")
  .action(async (opts) => {
    const g = program.opts();
    const client = await getClient(g);
    const bookings = await client.getBookings({
      date_from: opts.dateFrom,
      date_until: opts.dateUntil,
      title: opts.title,
      limit: parseInt(opts.limit),
      page: parseInt(opts.page),
    });
    output(bookings, !!g.json);
  });

bookingsCmd
  .command("get <id>")
  .description("Get a single booking by ID")
  .action(async (id: string) => {
    const g = program.opts();
    const client = await getClient(g);
    const booking = await client.getBooking(parseInt(id));
    output(booking, !!g.json);
  });

bookingsCmd
  .command("create")
  .description("Create a new booking")
  .requiredOption("--title <text>", "Booking title (max 50 chars)")
  .requiredOption("--date <YYYY-MM-DD>", "Booking date")
  .option("--description <text>", "Description (max 500 chars)")
  .option("--costcentre <id>", "Cost centre ID")
  .option(
    "--amounts <json>",
    'Amounts array as JSON string, e.g. \'[{"bankaccount":1,"costaccount":2,"purchasetaxaccount":3,"amount":"100.00","tax_percent":"20.00"}]\'',
  )
  .action(async (opts) => {
    const g = program.opts();
    assertWritable(g);
    const client = await getClient(g);

    let amounts;
    try {
      amounts = JSON.parse(opts.amounts ?? "[]");
    } catch {
      console.error("Error: --amounts must be a valid JSON array.");
      process.exit(1);
    }

    const result = await client.createBooking({
      title: opts.title,
      date: opts.date,
      description: opts.description,
      costcentre: opts.costcentre ? parseInt(opts.costcentre) : undefined,
      amounts: amounts.map((a: any) => ({
        bankaccount: a.bankaccount,
        costaccount: a.costaccount,
        purchasetaxaccount: a.purchasetaxaccount,
        amount: a.amount,
        tax_percent: a.tax_percent,
        deductibility_tax_percent: a.deductibility_tax_percent ?? "100.00",
        deductibility_amount_percent:
          a.deductibility_amount_percent ?? "100.00",
        foreign_business_base: a.foreign_business_base ?? null,
        country_dep: a.country_dep,
        country_rec: a.country_rec,
      })),
    });

    output(result, !!g.json);
  });

bookingsCmd
  .command("update <id>")
  .description("Update an existing booking (partial)")
  .option("--title <text>")
  .option("--date <YYYY-MM-DD>")
  .option("--description <text>")
  .option("--amounts <json>", "Amounts array as JSON string")
  .action(async (id: string, opts) => {
    const g = program.opts();
    assertWritable(g);
    const client = await getClient(g);

    const patch: any = {};
    if (opts.title) patch.title = opts.title;
    if (opts.date) patch.date = opts.date;
    if (opts.description) patch.description = opts.description;
    if (opts.amounts) {
      try {
        patch.amounts = JSON.parse(opts.amounts);
      } catch {
        console.error("Error: --amounts must be a valid JSON array.");
        process.exit(1);
      }
    }

    const result = await client.updateBooking(parseInt(id), patch);
    output(result, !!g.json);
  });

bookingsCmd
  .command("delete <id>")
  .description("Delete a booking")
  .action(async (id: string) => {
    const g = program.opts();
    assertWritable(g);
    const client = await getClient(g);
    await client.deleteBooking(parseInt(id));
    const msg = { success: true, deleted_id: parseInt(id) };
    output(msg, !!g.json);
    if (!g.json) console.log(`Booking ${id} deleted.`);
  });

// ---------------------------------------------------------------------------
// master-data
// ---------------------------------------------------------------------------

const masterCmd = program
  .command("master-data")
  .description("Retrieve master data (IDs needed to create bookings)");

const masterTypes = [
  "bank-accounts",
  "cost-accounts",
  "tax-accounts",
  "cost-centres",
  "tags",
  "foreign-business-bases",
] as const;

masterCmd
  .command("list <type>")
  .description(`List master data. <type> is one of: ${masterTypes.join(", ")}`)
  .action(async (type: string) => {
    const g = program.opts();
    const client = await getClient(g);

    let data: unknown;
    switch (type) {
      case "bank-accounts":
        data = await client.getBankAccounts();
        break;
      case "cost-accounts":
        data = await client.getCostAccounts();
        break;
      case "tax-accounts":
        data = await client.getPurchaseTaxAccounts();
        break;
      case "cost-centres":
        data = await client.getCostCentres();
        break;
      case "tags":
        data = await client.getTags();
        break;
      case "foreign-business-bases":
        data = await client.getForeignBusinessBases();
        break;
      default:
        console.error(
          `Unknown type "${type}". Choose from: ${masterTypes.join(", ")}`,
        );
        process.exit(1);
    }

    output(data, !!g.json);
  });

// ---------------------------------------------------------------------------
// inventories
// ---------------------------------------------------------------------------

const inventoriesCmd = program
  .command("inventories")
  .description("Manage inventory assets (Anlagen)");

inventoriesCmd
  .command("list")
  .description("List all inventory assets")
  .action(async () => {
    const g = program.opts();
    const client = await getClient(g);
    const items = await client.getInventories();
    output(items, !!g.json);
  });

inventoriesCmd
  .command("create")
  .description("Create a new inventory asset")
  .requiredOption("--title <text>", "Asset title")
  .requiredOption("--date-purchase <YYYY-MM-DD>", "Purchase date")
  .requiredOption("--date-commissioning <YYYY-MM-DD>", "Commissioning date")
  .requiredOption("--amount <value>", "Amount after tax, e.g. 1200.00")
  .requiredOption("--years <n>", "Deductibility years")
  .requiredOption(
    "--type <n>",
    "Deductibility type: 1=Linear, 2=Immediate, 3=None, 4=Degressive",
  )
  .requiredOption("--costaccount <id>", "Cost account ID")
  .option("--description <text>", "Optional description")
  .action(async (opts) => {
    const g = program.opts();
    assertWritable(g);
    const client = await getClient(g);

    const result = await client.createInventory({
      title: opts.title,
      date_purchase: opts.datePurchase,
      date_commissioning: opts.dateCommissioning,
      amount_after_tax: opts.amount,
      deductibility_years: parseInt(opts.years),
      deductibility_type: parseInt(opts.type),
      costaccount: parseInt(opts.costaccount),
      description: opts.description,
    });

    output(result, !!g.json);
  });

// ---------------------------------------------------------------------------
// attachments
// ---------------------------------------------------------------------------

const attachmentsCmd = program
  .command("attachments")
  .description("Manage booking attachments");

attachmentsCmd
  .command("list")
  .description("List attachments (optionally filtered by booking ID)")
  .option("--booking <id>", "Filter by booking ID")
  .action(async (opts) => {
    const g = program.opts();
    const client = await getClient(g);
    const items = await client.getBookingAttachments(
      opts.booking ? parseInt(opts.booking) : undefined,
    );
    output(items, !!g.json);
  });

attachmentsCmd
  .command("upload <booking-id> <file-path>")
  .description(
    "Upload a file attachment to a booking (base64-encodes the file)",
  )
  .action(async (bookingId: string, filePath: string) => {
    const g = program.opts();
    assertWritable(g);
    const { readFileSync } = await import("fs");
    const { basename } = await import("path");

    let fileData: string;
    try {
      fileData = readFileSync(filePath).toString("base64");
    } catch {
      console.error(`Error: Could not read file: ${filePath}`);
      process.exit(1);
    }

    const client = await getClient(g);
    const result = await client.uploadBookingAttachment(
      parseInt(bookingId),
      basename(filePath),
      fileData,
    );
    output(result, !!g.json);
  });

// ---------------------------------------------------------------------------
// Error handling & run
// ---------------------------------------------------------------------------

program.parseAsync(process.argv).catch((err) => {
  const g = program.opts();
  if (g.json) {
    console.error(
      JSON.stringify({
        error: err.message,
        details: err.response?.data ?? null,
      }),
    );
  } else {
    console.error(
      "Error:",
      err.message,
      err.response?.data ? JSON.stringify(err.response.data, null, 2) : "",
    );
  }
  process.exit(1);
});
