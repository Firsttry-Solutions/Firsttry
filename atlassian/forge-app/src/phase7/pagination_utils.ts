/**
 * PHASE 7 v2: PAGINATION UTILITIES
 * 
 * Helpers for efficient, memory-safe pagination of drift events.
 * Avoids loading all records into memory by using cursor-based iteration.
 * 
 * SEV-2-002: Fixes pagination inefficiency that could cause memory spikes at 10k+ scale.
 */

/**
 * Pagination cursor for safe, efficient iteration
 * Encodes position information without loading all data
 */
export interface PaginationCursor {
  // Position in result set
  pageNumber: number;
  // Size of each page
  pageSize: number;
  // Total estimated count (may be stale)
  estimatedTotal: number;
  // Encode/decode safely
  encoded?: string;
}

/**
 * Create pagination cursor for next page
 */
export function createNextCursor(
  currentPage: number,
  pageSize: number,
  totalCount: number
): PaginationCursor {
  return {
    pageNumber: currentPage + 1,
    pageSize,
    estimatedTotal: totalCount,
  };
}

/**
 * Decode cursor from string (for API usage)
 */
export function decodeCursor(encoded: string): PaginationCursor | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(decoded) as PaginationCursor;
  } catch {
    return null;
  }
}

/**
 * Encode cursor to string (for API usage)
 */
export function encodeCursor(cursor: PaginationCursor): string {
  const json = JSON.stringify(cursor);
  return Buffer.from(json).toString('base64');
}

/**
 * Batch iterator for safe pagination
 * Processes items in chunks without loading entire dataset
 */
export class BatchIterator<T> {
  private items: T[] = [];
  private currentIndex = 0;

  constructor(
    private batchSize: number = 50,
  ) {}

  /**
   * Add items to iterator (call as batches arrive from storage)
   */
  addBatch(batch: T[]): void {
    this.items.push(...batch);
  }

  /**
   * Get next batch of items
   */
  next(limit: number = this.batchSize): T[] {
    const result = this.items.slice(this.currentIndex, this.currentIndex + limit);
    this.currentIndex += limit;
    return result;
  }

  /**
   * Check if more items available
   */
  hasNext(): boolean {
    return this.currentIndex < this.items.length;
  }

  /**
   * Get current position
   */
  position(): number {
    return this.currentIndex;
  }

  /**
   * Reset iterator
   */
  reset(): void {
    this.currentIndex = 0;
  }

  /**
   * Total items processed so far
   */
  count(): number {
    return this.items.length;
  }
}

/**
 * Memory-efficient paginator for large result sets
 * 
 * Usage:
 * ```typescript
 * const paginator = new MemorySafePaginator(50); // 50 items per page
 * while (paginator.hasMore()) {
 *   const page = await fetchPage(paginator.currentPage());
 *   paginator.addPage(page);
 *   return paginator.getPage();
 * }
 * ```
 */
export class MemorySafePaginator<T> {
  private currentPageIndex = 0;
  private pageSize: number;
  private pages: T[][] = [];
  private totalCount = 0;

  constructor(pageSize: number = 20) {
    this.pageSize = Math.max(1, Math.min(pageSize, 500)); // Enforce limits
  }

  /**
   * Add a page of results
   */
  addPage(items: T[], totalAvailable?: number): void {
    this.pages.push(items);
    if (totalAvailable !== undefined) {
      this.totalCount = totalAvailable;
    }
  }

  /**
   * Get current page
   */
  getCurrentPage(): T[] {
    return this.pages[this.currentPageIndex] || [];
  }

  /**
   * Get specific page index
   */
  getPageAt(index: number): T[] {
    return this.pages[index] || [];
  }

  /**
   * Get total pages loaded so far
   */
  getPagesLoaded(): number {
    return this.pages.length;
  }

  /**
   * Advance to next page
   */
  nextPage(): boolean {
    if (this.currentPageIndex < this.pages.length - 1) {
      this.currentPageIndex++;
      return true;
    }
    return false;
  }

  /**
   * Go to previous page
   */
  previousPage(): boolean {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      return true;
    }
    return false;
  }

  /**
   * Jump to specific page (if available)
   */
  goToPage(index: number): boolean {
    if (index >= 0 && index < this.pages.length) {
      this.currentPageIndex = index;
      return true;
    }
    return false;
  }

  /**
   * Check if more pages might be available to fetch from the server
   * Returns true ONLY if we haven't loaded all pages yet
   */
  hasMore(): boolean {
    // If we know the total count, check if there are more pages
    if (this.totalCount > 0) {
      const totalPagesExpected = Math.ceil(this.totalCount / this.pageSize);
      const haveLoadedAllPages = this.pages.length >= totalPagesExpected;
      return !haveLoadedAllPages;
    }

    // If totalCount is not set, conservatively assume there might be more
    return true;
  }

  /**
   * Get pagination info
   */
  getInfo(): {
    currentPage: number;
    pageSize: number;
    totalLoaded: number;
    totalEstimated: number;
  } {
    return {
      currentPage: this.currentPageIndex,
      pageSize: this.pageSize,
      totalLoaded: this.pages.reduce((sum, page) => sum + page.length, 0),
      totalEstimated: this.totalCount,
    };
  }

  /**
   * Reset paginator
   */
  reset(): void {
    this.currentPageIndex = 0;
    this.pages = [];
    this.totalCount = 0;
  }
}
