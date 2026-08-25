/**
 * Monday.com GraphQL API client.
 * - Never exposes the API token to the frontend.
 * - Handles pagination (Monday returns max 500 items per page).
 * - Handles API errors gracefully.
 * - Discovers column IDs dynamically — never hardcodes them.
 */

import fetch from 'node-fetch';

const MONDAY_API_URL = 'https://api.monday.com/v2';
const PAGE_LIMIT = 500; // Monday's max per request

interface MondayColumn {
  id: string;
  title: string;
  type: string;
}

interface MondayColumnValue {
  id: string;
  text: string;
  value: string | null;
  type: string;
}

export interface MondayItem {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
}

export interface BoardMetadata {
  id: string;
  name: string;
  columns: MondayColumn[];
}

export interface BoardData {
  metadata: BoardMetadata;
  items: MondayItem[];
}

class MondayClient {
  private token: string;

  constructor() {
    this.token = process.env.MONDAY_API_TOKEN ?? '';
  }

  private getToken(): string {
    const t = process.env.MONDAY_API_TOKEN ?? '';
    if (!t) {
      throw new Error(
        'MONDAY_API_TOKEN environment variable is not set. Please configure it in your .env file.'
      );
    }
    return t;
  }

  private async query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
    const token = this.getToken();
    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query: gql, variables }),
      // 30 second timeout
      // node-fetch v2 doesn't have built-in signal, use timeout option
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Monday.com API token is invalid or expired. Please check MONDAY_API_TOKEN.');
      }
      if (response.status === 429) {
        throw new Error('Monday.com API rate limit exceeded. Please wait a moment and try again.');
      }
      throw new Error(`Monday.com API returned HTTP ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };

    if (json.errors && json.errors.length > 0) {
      const msg = json.errors.map((e) => e.message).join('; ');
      throw new Error(`Monday.com API error: ${msg}`);
    }

    if (!json.data) {
      throw new Error('Monday.com API returned an empty response.');
    }

    return json.data;
  }

  /** Simple connectivity check */
  async ping(): Promise<boolean> {
    try {
      await this.query<{ me: { id: string } }>(`{ me { id } }`);
      return true;
    } catch {
      return false;
    }
  }

  /** Get board metadata (name + columns) */
  async getBoardInfo(boardId: string): Promise<BoardMetadata> {
    const data = await this.query<{
      boards: Array<{ id: string; name: string; columns: MondayColumn[] }>;
    }>(
      `query($boardId: [ID!]!) {
        boards(ids: $boardId) {
          id
          name
          columns { id title type }
        }
      }`,
      { boardId: [boardId] }
    );

    if (!data.boards || data.boards.length === 0) {
      throw new Error(
        `Board ${boardId} not found. Please verify DEALS_BOARD_ID / WORK_ORDERS_BOARD_ID in your .env file.`
      );
    }

    return data.boards[0];
  }

  /** Get all items from a board with cursor-based pagination */
  async getBoardItems(boardId: string): Promise<MondayItem[]> {
    const allItems: MondayItem[] = [];
    let cursor: string | null = null;
    let page = 1;

    do {
      const gqlWithCursor: string = `query($boardId: [ID!]!, $limit: Int!, $cursor: String!) {
            boards(ids: $boardId) {
              items_page(limit: $limit, cursor: $cursor) {
                cursor
                items {
                  id
                  name
                  column_values { id text value type }
                }
              }
            }
          }`;
      const gqlNoCursor: string = `query($boardId: [ID!]!, $limit: Int!) {
            boards(ids: $boardId) {
              items_page(limit: $limit) {
                cursor
                items {
                  id
                  name
                  column_values { id text value type }
                }
              }
            }
          }`;
      const gql: string = cursor ? gqlWithCursor : gqlNoCursor;

      const variables: Record<string, unknown> = { boardId: [boardId], limit: PAGE_LIMIT };
      if (cursor) variables.cursor = cursor;

      type BoardItemsResponse = {
        boards: Array<{
          items_page: {
            cursor: string | null;
            items: MondayItem[];
          };
        }>;
      };
      const data: BoardItemsResponse = await this.query<BoardItemsResponse>(gql, variables);

      if (!data.boards || data.boards.length === 0) break;

      const itemsPage = data.boards[0].items_page;
      allItems.push(...itemsPage.items);
      cursor = itemsPage.cursor;
      page++;

      // Safety limit — avoid infinite loops
      if (page > 50) {
        console.warn('[Monday] Pagination exceeded 50 pages, stopping early.');
        break;
      }
    } while (cursor);

    return allItems;
  }

  /** Get full board data (metadata + items) */
  async getBoardData(boardId: string): Promise<BoardData> {
    const [metadata, items] = await Promise.all([
      this.getBoardInfo(boardId),
      this.getBoardItems(boardId),
    ]);
    return { metadata, items };
  }
}

export const mondayClient = new MondayClient();
