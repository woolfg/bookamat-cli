import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import {
  PaginatedResponse,
  UserAccount,
  Booking,
  CreateBookingRequest,
  BankAccount,
  CostAccount,
  PurchaseTaxAccount,
  CostCentre,
  ForeignBusinessBase,
  Tag,
  Inventory,
  CreateInventoryRequest,
  Attachment,
} from "./types.js";

export class BookamatClient {
  private client: AxiosInstance;
  private baseUrl = "https://www.bookamat.com/api/v1";
  private country?: string;
  private year?: string | number;

  constructor(
    private apiKey: string,
    private username: string,
    country?: string,
    year?: string | number,
    private readOnly: boolean = false,
  ) {
    this.country = country;
    this.year = year;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
        // Docs say: Authorization: ApiKey username:apikey
        Authorization: `ApiKey ${this.username}:${this.apiKey}`,
        Accept: "application/json",
      },
    });
  }

  setContext(country: string, year: string | number) {
    this.country = country;
    this.year = year;
  }

  /** Fetch all pages of a paginated endpoint and return the combined results. */
  private async fetchAll<T>(url: string, params: any = {}): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = url;
    while (nextUrl) {
      const response = await this.client.get<PaginatedResponse<T>>(nextUrl, {
        params: nextUrl === url ? params : undefined,
      });
      results.push(...response.data.results);
      // next is either a full URL or null
      nextUrl = response.data.next
        ? response.data.next.replace(this.baseUrl, "")
        : null;
    }
    return results;
  }

  private getContextUrl(path: string): string {
    const p = path.startsWith("/") ? path.substring(1) : path;

    // Some endpoints like /user/accounts don't need context
    if (path.startsWith("/user/")) {
      return `${path}`;
    }

    if (!this.country || !this.year) {
      throw new Error(
        "Country and Year context are required for this operation. Please set them or fetch accounts first.",
      );
    }
    return `/${this.country}/${this.year}/${p}`;
  }

  // --- User & Accounts ---

  async getAccounts(): Promise<UserAccount[]> {
    // Accounts endpoint is special: /user/accounts/ (no country/year prefix)
    // Warning: Docs say "api/v1/user/accounts/" instead of "api/v1/at/2015/user/accounts/"
    const response =
      await this.client.get<PaginatedResponse<UserAccount>>("/user/accounts/");
    return response.data.results;
  }

  // --- Master Data ---

  async getBankAccounts(): Promise<BankAccount[]> {
    return this.fetchAll<BankAccount>(
      this.getContextUrl("preferences/bankaccounts/"),
    );
  }

  async getCostAccounts(group?: "1" | "2"): Promise<CostAccount[]> {
    const params: any = {};
    if (group) params.group = group;
    return this.fetchAll<CostAccount>(
      this.getContextUrl("preferences/costaccounts/"),
      params,
    );
  }

  async getPurchaseTaxAccounts(): Promise<PurchaseTaxAccount[]> {
    return this.fetchAll<PurchaseTaxAccount>(
      this.getContextUrl("preferences/purchasetaxaccounts/"),
    );
  }

  async getCostCentres(): Promise<CostCentre[]> {
    return this.fetchAll<CostCentre>(
      this.getContextUrl("preferences/costcentres/"),
    );
  }

  async getForeignBusinessBases(): Promise<ForeignBusinessBase[]> {
    return this.fetchAll<ForeignBusinessBase>(
      this.getContextUrl("preferences/foreignbusinessbases/"),
    );
  }

  async getTags(): Promise<Tag[]> {
    return this.fetchAll<Tag>(this.getContextUrl("preferences/tags/"));
  }

  // --- Bookings ---

  async getBookings(params?: any): Promise<Booking[]> {
    return this.fetchAll<Booking>(this.getContextUrl("bookings/"), params);
  }

  async getBooking(id: number): Promise<Booking> {
    const response = await this.client.get<Booking>(
      this.getContextUrl(`bookings/${id}/`),
    );
    return response.data;
  }

  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    if (this.readOnly) {
      console.log(`[ReadOnly] createBooking: ${JSON.stringify(data, null, 2)}`);
      // Mock response
      return {
        id: 999999,
        status: "1",
        title: data.title,
        date: data.date,
        amounts: data.amounts.map((a) => ({ ...a, group: "2" }) as any),
      } as Booking;
    }
    const response = await this.client.post<Booking>(
      this.getContextUrl("bookings/"),
      data,
    );
    return response.data;
  }

  async updateBooking(
    id: number,
    data: Partial<CreateBookingRequest>,
  ): Promise<Booking> {
    if (this.readOnly) {
      console.log(
        `[ReadOnly] updateBooking (${id}): ${JSON.stringify(data, null, 2)}`,
      );
      return {
        id,
        status: "1",
        title: data.title || "Mock Title",
        date: data.date || "2023-01-01",
        amounts: [],
      } as Booking;
    }
    // Using PATCH by default for partial updates
    // Using PATCH by default for partial updates
    const response = await this.client.patch<Booking>(
      this.getContextUrl(`bookings/${id}/`),
      data,
    );
    return response.data;
  }

  async deleteBooking(id: number): Promise<void> {
    if (this.readOnly) {
      console.log(`[ReadOnly] deleteBooking: ${id}`);
      return;
    }
    await this.client.delete(this.getContextUrl(`bookings/${id}/`));
  }

  // --- Inventories ---

  async getInventories(): Promise<Inventory[]> {
    const response = await this.client.get<PaginatedResponse<Inventory>>(
      this.getContextUrl("inventories/"),
    );
    return response.data.results;
  }

  async createInventory(data: CreateInventoryRequest): Promise<Inventory> {
    if (this.readOnly) {
      console.log(
        `[ReadOnly] createInventory: ${JSON.stringify(data, null, 2)}`,
      );
      return {
        id: 888888,
        title: data.title,
        date_purchase: data.date_purchase,
        date_commissioning: data.date_commissioning,
        amount_after_tax: data.amount_after_tax,
        deductibility_years: data.deductibility_years,
        deductibility_type: data.deductibility_type,
        deductibility_percent: data.deductibility_percent || "100.00",
        costaccount: data.costaccount,
      } as any as Inventory;
    }
    const response = await this.client.post<Inventory>(
      this.getContextUrl("inventories/"),
      data,
    );
    return response.data;
  }

  // --- Attachments ---

  async getBookingAttachments(bookingId?: number): Promise<Attachment[]> {
    const params: any = {};
    if (bookingId) params.booking = bookingId;
    const response = await this.client.get<PaginatedResponse<Attachment>>(
      this.getContextUrl("bookings/attachments/"),
      { params },
    );
    return response.data.results;
  }

  async uploadBookingAttachment(
    bookingId: number,
    name: string,
    base64File: string,
  ): Promise<Attachment> {
    if (this.readOnly) {
      console.log(
        `[ReadOnly] uploadBookingAttachment (${bookingId}, ${name}) - File content length: ${base64File.length}`,
      );
      return {
        id: 777777,
        name: name,
        size: base64File.length,
        booking: bookingId,
      };
    }
    const response = await this.client.post<Attachment>(
      this.getContextUrl("bookings/attachments/"),
      {
        booking: bookingId,
        name: name,
        file: base64File,
      },
    );
    return response.data;
  }
}
