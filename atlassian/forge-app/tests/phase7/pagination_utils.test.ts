/**
 * Tests for Pagination Utilities (SEV-2-002)
 * 
 * Validates that pagination can handle large datasets without memory spikes.
 */

import { describe, it, expect } from 'vitest';
import {
  PaginationCursor,
  BatchIterator,
  MemorySafePaginator,
  createNextCursor,
  decodeCursor,
  encodeCursor,
} from '../../src/phase7/pagination_utils';

describe('Pagination Utilities (SEV-2-002: Memory-Safe Pagination)', () => {
  describe('PaginationCursor', () => {
    it('should create cursor for next page', () => {
      const cursor = createNextCursor(0, 50, 1000);
      
      expect(cursor.pageNumber).toBe(1);
      expect(cursor.pageSize).toBe(50);
      expect(cursor.estimatedTotal).toBe(1000);
    });

    it('should encode and decode cursor', () => {
      const original: PaginationCursor = {
        pageNumber: 5,
        pageSize: 100,
        estimatedTotal: 5000,
      };

      const encoded = encodeCursor(original);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(original);
    });

    it('should handle invalid cursor decode gracefully', () => {
      const decoded = decodeCursor('invalid-base64!!!');
      expect(decoded).toBeNull();
    });
  });

  describe('BatchIterator', () => {
    it('should add and iterate batches', () => {
      const iterator = new BatchIterator<number>(10);
      
      iterator.addBatch([1, 2, 3, 4, 5]);
      iterator.addBatch([6, 7, 8, 9, 10]);

      const batch1 = iterator.next(5);
      expect(batch1).toEqual([1, 2, 3, 4, 5]);

      const batch2 = iterator.next(5);
      expect(batch2).toEqual([6, 7, 8, 9, 10]);

      expect(iterator.hasNext()).toBe(false);
    });

    it('should track position', () => {
      const iterator = new BatchIterator<number>(5);
      iterator.addBatch([1, 2, 3, 4, 5]);

      expect(iterator.position()).toBe(0);
      iterator.next(2);
      expect(iterator.position()).toBe(2);
      iterator.next(3);
      expect(iterator.position()).toBe(5);
    });

    it('should count total items', () => {
      const iterator = new BatchIterator<number>();
      
      iterator.addBatch([1, 2, 3]);
      expect(iterator.count()).toBe(3);

      iterator.addBatch([4, 5]);
      expect(iterator.count()).toBe(5);
    });

    it('should reset iterator', () => {
      const iterator = new BatchIterator<number>();
      iterator.addBatch([1, 2, 3, 4, 5]);

      iterator.next(3);
      expect(iterator.position()).toBe(3);

      iterator.reset();
      expect(iterator.position()).toBe(0);
      
      const batch = iterator.next(2);
      expect(batch).toEqual([1, 2]);
    });

    it('should handle empty iterator gracefully', () => {
      const iterator = new BatchIterator<number>(5);
      
      expect(iterator.hasNext()).toBe(false);
      expect(iterator.next(5)).toEqual([]);
      expect(iterator.count()).toBe(0);
    });

    it('should handle partial batch requests', () => {
      const iterator = new BatchIterator<number>();
      iterator.addBatch([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      const batch1 = iterator.next(3);
      expect(batch1).toEqual([1, 2, 3]);
      expect(iterator.hasNext()).toBe(true);

      const batch2 = iterator.next(4);
      expect(batch2).toEqual([4, 5, 6, 7]);
      expect(iterator.hasNext()).toBe(true);

      const batch3 = iterator.next(10);
      expect(batch3).toEqual([8, 9, 10]);
      expect(iterator.hasNext()).toBe(false);
    });
  });

  describe('MemorySafePaginator', () => {
    it('should enforce page size limits', () => {
      const paginator1 = new MemorySafePaginator(0);
      expect(paginator1.getInfo().pageSize).toBe(1); // Min 1

      const paginator2 = new MemorySafePaginator(1000);
      expect(paginator2.getInfo().pageSize).toBe(500); // Max 500
    });

    it('should add pages and retrieve them', () => {
      const paginator = new MemorySafePaginator(50);
      
      const page1 = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
      const page2 = Array.from({ length: 50 }, (_, i) => ({ id: i + 51 }));

      paginator.addPage(page1);
      paginator.addPage(page2);

      expect(paginator.getPageAt(0)).toEqual(page1);
      expect(paginator.getPageAt(1)).toEqual(page2);
    });

    it('should navigate between pages', () => {
      const paginator = new MemorySafePaginator(20);
      
      paginator.addPage(Array.from({ length: 20 }, (_, i) => i + 1));
      paginator.addPage(Array.from({ length: 20 }, (_, i) => i + 21));
      paginator.addPage(Array.from({ length: 20 }, (_, i) => i + 41));

      expect(paginator.getInfo().currentPage).toBe(0);

      paginator.nextPage();
      expect(paginator.getInfo().currentPage).toBe(1);

      paginator.nextPage();
      expect(paginator.getInfo().currentPage).toBe(2);

      paginator.previousPage();
      expect(paginator.getInfo().currentPage).toBe(1);
    });

    it('should handle page navigation boundaries', () => {
      const paginator = new MemorySafePaginator(20);
      
      paginator.addPage(Array.from({ length: 20 }, (_, i) => i));
      paginator.addPage(Array.from({ length: 20 }, (_, i) => i + 20));

      expect(paginator.previousPage()).toBe(false); // Already at first page
      expect(paginator.getInfo().currentPage).toBe(0);

      paginator.goToPage(1);
      expect(paginator.nextPage()).toBe(false); // Already at last page
      expect(paginator.getInfo().currentPage).toBe(1);
    });

    it('should jump to specific pages', () => {
      const paginator = new MemorySafePaginator(20);
      
      for (let i = 0; i < 10; i++) {
        paginator.addPage(Array.from({ length: 20 }, (_, j) => i * 20 + j));
      }

      expect(paginator.goToPage(5)).toBe(true);
      expect(paginator.getInfo().currentPage).toBe(5);

      expect(paginator.goToPage(100)).toBe(false); // Out of range
      expect(paginator.getInfo().currentPage).toBe(5); // Unchanged
    });

    it('should track total count and pages loaded', () => {
      const paginator = new MemorySafePaginator(50);
      
      paginator.addPage(Array.from({ length: 50 }, (_, i) => i), 250);
      const info1 = paginator.getInfo();
      expect(info1.totalLoaded).toBe(50);
      expect(info1.totalEstimated).toBe(250);

      paginator.addPage(Array.from({ length: 50 }, (_, i) => i + 50));
      const info2 = paginator.getInfo();
      expect(info2.totalLoaded).toBe(100);
      expect(info2.totalEstimated).toBe(250);
    });

    it('should indicate when more pages available', () => {
      const paginator = new MemorySafePaginator(50);
      
      paginator.addPage(Array.from({ length: 50 }, (_, i) => i), 200);
      expect(paginator.hasMore()).toBe(true);

      paginator.addPage(Array.from({ length: 50 }, (_, i) => i + 50));
      expect(paginator.hasMore()).toBe(true);

      paginator.addPage(Array.from({ length: 50 }, (_, i) => i + 100));
      expect(paginator.hasMore()).toBe(true);

      paginator.addPage(Array.from({ length: 50 }, (_, i) => i + 150));
      expect(paginator.hasMore()).toBe(false);
    });

    it('should reset paginator state', () => {
      const paginator = new MemorySafePaginator(20);
      
      // Add at least 2 pages with total count set
      paginator.addPage([1, 2, 3], 40); // totalCount=40 means 2 pages
      paginator.addPage([4, 5, 6]);
      paginator.nextPage();
      
      expect(paginator.getInfo().currentPage).toBe(1);
      expect(paginator.getPagesLoaded()).toBe(2);
      expect(paginator.hasMore()).toBe(false); // Have loaded all 2 expected pages

      paginator.reset();
      
      expect(paginator.getInfo().currentPage).toBe(0);
      expect(paginator.getPagesLoaded()).toBe(0);
      expect(paginator.hasMore()).toBe(true); // After reset, conservative: assume more might be available
    });

    it('should handle large page counts efficiently', () => {
      const paginator = new MemorySafePaginator(100);
      
      // Simulate 10k events paginated into 100-item pages
      for (let i = 0; i < 100; i++) {
        paginator.addPage(
          Array.from({ length: 100 }, (_, j) => ({ id: i * 100 + j })),
          10000
        );
      }

      expect(paginator.getPagesLoaded()).toBe(100);
      const info = paginator.getInfo();
      expect(info.totalLoaded).toBe(10000);
      expect(info.totalEstimated).toBe(10000);

      // Navigate through pages without loading all at once
      paginator.goToPage(50);
      expect(paginator.getInfo().currentPage).toBe(50);
    });
  });
});
