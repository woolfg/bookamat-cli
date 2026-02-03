import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BookamatClient } from "./client.js";

// Configuration from Environment Variables
const API_KEY = process.env.BOOKAMAT_API_KEY;
const USERNAME = process.env.BOOKAMAT_USERNAME;
const COUNTRY = process.env.BOOKAMAT_COUNTRY; // e.g., 'at'
const YEAR = process.env.BOOKAMAT_YEAR; // e.g., '2023'

if (!API_KEY || !USERNAME) {
  console.error(
    "Error: BOOKAMAT_API_KEY and BOOKAMAT_USERNAME environment variables are required.",
  );
  process.exit(1);
}

const client = new BookamatClient(API_KEY, USERNAME, COUNTRY, YEAR);

// If country/year not set, try to fetch from API on startup (optional optimization)
// For now, we rely on them being set or passed, or we default to error if missing during calls.

const server = new Server(
  {
    name: "bookamat-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// --- Zod Schemas for Tools ---

const GetBookingsSchema = z.object({
  limit: z.number().optional(),
  page: z.number().optional(),
  date_from: z.string().optional(),
  date_until: z.string().optional(),
  title: z.string().optional(),
});

const CreateBookingSchema = z.object({
  title: z.string().max(50),
  date: z.string().describe("YYYY-MM-DD"),
  costcentre: z.number().optional(),
  description: z.string().max(500).optional(),
  amounts: z.array(
    z.object({
      bankaccount: z.number(),
      costaccount: z.number(),
      purchasetaxaccount: z.number(),
      amount: z.string().describe("Gross amount e.g. '100.00'"),
      tax_percent: z.string().describe("e.g. '20.00'"),
      deductibility_tax_percent: z.string().default("100.00"),
      deductibility_amount_percent: z.string().default("100.00"),
    }),
  ),
});

const GetMasterDataSchema = z.object({
  type: z.enum([
    "bank_accounts",
    "cost_accounts",
    "tax_accounts",
    "cost_centres",
    "tags",
    "foreign_business_bases",
  ]),
});

const CreateInventorySchema = z.object({
  title: z.string(),
  date_purchase: z.string(),
  date_commissioning: z.string(),
  amount_after_tax: z.string(),
  deductibility_years: z.number(),
  deductibility_type: z
    .number()
    .describe("1=Linear, 2=Sofort, 3=None, 4=Degressiv"),
  costaccount: z.number(),
  description: z.string().optional(),
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_accounts",
        description: "List available User Accounts (Country/Year packages)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_bookings",
        description: "List bookings (invoices/expenses)",
        inputSchema: zodToJsonSchema(GetBookingsSchema),
      },
      {
        name: "create_booking",
        description: "Create a new booking (invoice/expense)",
        inputSchema: zodToJsonSchema(CreateBookingSchema),
      },
      {
        name: "get_master_data",
        description:
          "Retrieve master data IDs needed for creating bookings (Bank Accounts, Cost Accounts, etc.)",
        inputSchema: zodToJsonSchema(GetMasterDataSchema),
      },
      {
        name: "create_inventory",
        description: "Create a new inventory asset (Anlage)",
        inputSchema: zodToJsonSchema(CreateInventorySchema),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    // Ensure context is set if possible
    if (!client["country"] && name !== "get_accounts") {
      // Try auto-discovery if missing
      const accounts = await client.getAccounts();
      if (accounts.length > 0) {
        // Default to most recent year
        const latest = accounts.sort((a, b) => b.year - a.year)[0];
        client.setContext(
          latest.country === "Österreich" ? "at" : "de",
          latest.year,
        ); // Basic mapping assumption, better to parse 'url' field
        // Parse url field: /at/2015/
        const match = latest.url.match(/^\/([a-z]+)\/(\d+)\/$/);
        if (match) {
          client.setContext(match[1], parseInt(match[2]));
        }
      }
    }

    if (name === "get_accounts") {
      const accounts = await client.getAccounts();
      return {
        content: [{ type: "text", text: JSON.stringify(accounts, null, 2) }],
      };
    }

    if (name === "get_bookings") {
      const params = GetBookingsSchema.parse(args);
      const bookings = await client.getBookings(params);
      return {
        content: [{ type: "text", text: JSON.stringify(bookings, null, 2) }],
      };
    }

    if (name === "create_booking") {
      const data = CreateBookingSchema.parse(args);
      const result = await client.createBooking(data);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "get_master_data") {
      const { type } = GetMasterDataSchema.parse(args);
      let data;
      switch (type) {
        case "bank_accounts":
          data = await client.getBankAccounts();
          break;
        case "cost_accounts":
          data = await client.getCostAccounts();
          break;
        case "tax_accounts":
          data = await client.getPurchaseTaxAccounts();
          break;
        case "cost_centres":
          data = await client.getCostCentres();
          break;
        case "tags":
          data = await client.getTags();
          break;
        case "foreign_business_bases":
          data = await client.getForeignBusinessBases();
          break;
      }
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === "create_inventory") {
      const data = CreateInventorySchema.parse(args);
      const result = await client.createInventory(data);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    // Return error as text to the model handle gracefully
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message} ${error.response?.data ? JSON.stringify(error.response.data) : ""}`,
        },
      ],
      isError: true,
    };
  }
});

// Helper to convert Zod schema to JSON Schema for MCP
function zodToJsonSchema(schema: z.ZodType<any>): any {
  // Simple approximation for this example.
  // In a real project use 'zod-to-json-schema' package.
  // For now, passing a generic object as we're defining schema in index.ts
  // Actually, MCP SDK checks inputSchema.
  // To avoid adding another dependency now, I'll rely on the model understanding the description
  // or I can construct simple JSON schemas manually as best practice.

  // Basic reflection for common types
  // Note: This is a hacky implementation. Recommend `npm install zod-to-json-schema`
  return { type: "object", properties: {} };
}

// Rewriting handler to use explicit JSON schemas for Tools declaration
// to avoid the Zod-to-JSON complexity without the library.

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_accounts",
        description:
          "List available User Accounts. Returns country and year context.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_bookings",
        description: "List bookings. Filters: date_from, date_until, title.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number" },
            page: { type: "number" },
            date_from: { type: "string", description: "YYYY-MM-DD" },
            date_until: { type: "string", description: "YYYY-MM-DD" },
            title: { type: "string" },
          },
        },
      },
      {
        name: "create_booking",
        description:
          "Create a new booking. Requires Master Data IDs (get_master_data).",
        inputSchema: {
          type: "object",
          required: ["title", "date", "amounts"],
          properties: {
            title: { type: "string" },
            date: { type: "string", description: "YYYY-MM-DD" },
            costcentre: { type: "number" },
            description: { type: "string" },
            amounts: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "bankaccount",
                  "costaccount",
                  "purchasetaxaccount",
                  "amount",
                  "tax_percent",
                ],
                properties: {
                  bankaccount: {
                    type: "number",
                    description: "ID of Bank Account",
                  },
                  costaccount: {
                    type: "number",
                    description: "ID of Cost Account",
                  },
                  purchasetaxaccount: {
                    type: "number",
                    description: "ID of Tax Account",
                  },
                  amount: {
                    type: "string",
                    description: "Gross amount (e.g. '150.00')",
                  },
                  tax_percent: {
                    type: "string",
                    description: "VAT % (e.g. '20.00')",
                  },
                  deductibility_tax_percent: {
                    type: "string",
                    default: "100.00",
                  },
                  deductibility_amount_percent: {
                    type: "string",
                    default: "100.00",
                  },
                },
              },
            },
          },
        },
      },
      {
        name: "get_master_data",
        description:
          "Retrieve ID lists for: bank_accounts, cost_accounts, tax_accounts, cost_centres, tags, foreign_business_bases.",
        inputSchema: {
          type: "object",
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: [
                "bank_accounts",
                "cost_accounts",
                "tax_accounts",
                "cost_centres",
                "tags",
                "foreign_business_bases",
              ],
            },
          },
        },
      },
      {
        name: "create_inventory",
        description: "Create a new inventory asset.",
        inputSchema: {
          type: "object",
          required: [
            "title",
            "date_purchase",
            "date_commissioning",
            "amount_after_tax",
            "deductibility_years",
            "deductibility_type",
            "costaccount",
          ],
          properties: {
            title: { type: "string" },
            date_purchase: { type: "string" },
            date_commissioning: { type: "string" },
            amount_after_tax: { type: "string" },
            deductibility_years: { type: "number" },
            deductibility_type: {
              type: "number",
              description: "1=Linear, 2=Immediate",
            },
            costaccount: { type: "number" },
            description: { type: "string" },
          },
        },
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bookamat MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
