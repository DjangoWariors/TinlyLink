import React, { useRef, useEffect, useState, useCallback, type ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 5,
  className = '',
  onLoadMore,
  hasMore = false,
  isLoading = false,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      setContainerHeight(entries[0].contentRect.height);
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
    
    // Infinite scroll trigger
    if (onLoadMore && hasMore && !isLoading) {
      const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;
      if (nearBottom) onLoadMore();
    }
  }, [onLoadMore, hasMore, isLoading]);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan);

  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div ref={containerRef} className={`overflow-auto ${className}`} onScroll={handleScroll} style={{ height: '100%' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: startIndex * itemHeight, width: '100%' }}>
          {visibleItems.map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
      {isLoading && <div className="text-center py-4 text-gray-500">Loading more...</div>}
    </div>
  );
}
