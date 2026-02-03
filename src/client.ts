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
    const response = await this.client.get<PaginatedResponse<BankAccount>>(
      this.getContextUrl("preferences/bankaccounts/"),
    );
    return response.data.results;
  }

  async getCostAccounts(group?: "1" | "2"): Promise<CostAccount[]> {
    const params: any = {};
    if (group) params.group = group;
    const response = await this.client.get<PaginatedResponse<CostAccount>>(
      this.getContextUrl("preferences/costaccounts/"),
      { params },
    );
    return response.data.results;
  }

  async getPurchaseTaxAccounts(): Promise<PurchaseTaxAccount[]> {
    const response = await this.client.get<
      PaginatedResponse<PurchaseTaxAccount>
    >(this.getContextUrl("preferences/purchasetaxaccounts/"));
    return response.data.results;
  }

  async getCostCentres(): Promise<CostCentre[]> {
    const response = await this.client.get<PaginatedResponse<CostCentre>>(
      this.getContextUrl("preferences/costcentres/"),
    );
    return response.data.results;
  }

  async getForeignBusinessBases(): Promise<ForeignBusinessBase[]> {
    const response = await this.client.get<
      PaginatedResponse<ForeignBusinessBase>
    >(this.getContextUrl("preferences/foreignbusinessbases/"));
    return response.data.results;
  }

  async getTags(): Promise<Tag[]> {
    const response = await this.client.get<PaginatedResponse<Tag>>(
      this.getContextUrl("preferences/tags/"),
    );
    return response.data.results;
  }

  // --- Bookings ---

  async getBookings(params?: any): Promise<Booking[]> {
    const response = await this.client.get<PaginatedResponse<Booking>>(
      this.getContextUrl("bookings/"),
      { params },
    );
    return response.data.results;
  }

  async getBooking(id: number): Promise<Booking> {
    const response = await this.client.get<Booking>(
      this.getContextUrl(`bookings/${id}/`),
    );
    return response.data;
  }

  async createBooking(data: CreateBookingRequest): Promise<Booking> {
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
    // Using PATCH by default for partial updates
    const response = await this.client.patch<Booking>(
      this.getContextUrl(`bookings/${id}/`),
      data,
    );
    return response.data;
  }

  async deleteBooking(id: number): Promise<void> {
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
