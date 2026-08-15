import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  itemName?: string;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  itemName = 'items',
  className = '',
}) => {
  if (totalPages <= 1 && (!totalItems || totalItems <= (pageSize || 10))) {
    return null;
  }

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const startItem = totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const endItem = totalItems && pageSize ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <div className={`epicare-pagination ${className}`}>
      {totalItems !== undefined && startItem !== null && endItem !== null ? (
        <div className="pagination-info">
          Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalItems}</strong> {itemName}
        </div>
      ) : (
        <div className="pagination-info">
          Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
        </div>
      )}

      <div className="pagination-controls">
        <button
          className="pagination-btn pagination-nav-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous Page"
          title="Previous Page"
        >
          <ChevronLeft size={16} />
          <span>Prev</span>
        </button>

        <div className="pagination-pages">
          {getPageNumbers().map((page, idx) =>
            typeof page === 'number' ? (
              <button
                key={idx}
                className={`pagination-btn pagination-num-btn ${page === currentPage ? 'active' : ''}`}
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            ) : (
              <span key={idx} className="pagination-ellipsis">
                {page}
              </span>
            )
          )}
        </div>

        <button
          className="pagination-btn pagination-nav-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next Page"
          title="Next Page"
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
