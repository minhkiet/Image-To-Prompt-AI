import React, { useState, useEffect, useRef } from 'react';
import { HistoryItem } from '../types';

interface HistoryListProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

const ITEMS_PER_PAGE = 6;

export const HistoryList: React.FC<HistoryListProps> = ({ history, onSelect, onClear }) => {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Reset visible count when history is cleared or dramatically changes
  useEffect(() => {
    if (history.length <= ITEMS_PER_PAGE) {
      setVisibleCount(ITEMS_PER_PAGE);
    }
  }, [history.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, history.length));
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) observer.unobserve(target);
      observer.disconnect();
    };
  }, [visibleCount, history.length]);

  if (history.length === 0) return null;

  const visibleHistory = history.slice(0, visibleCount);

  return (
    <div className="w-full mt-12 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-800 text-xl">Lịch sử ({history.length})</h3>
        </div>
        <button
          onClick={onClear}
          className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          Xóa tất cả
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleHistory.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className="group relative bg-white rounded-2xl p-3 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-purple-200 transition-all duration-300 cursor-pointer overflow-hidden animate-fade-in-up"
          >
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-100 relative">
                <img
                  src={item.image.previewUrl}
                  alt="History thumbnail"
                  loading="lazy"
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500 ease-out"
                />
              </div>

              {/* Info */}
              <div className="flex flex-col justify-center overflow-hidden">
                <p className="text-xs text-gray-400 font-medium mb-1">
                  {new Date(item.timestamp).toLocaleString('vi-VN')}
                </p>
                <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-purple-700 transition-colors duration-300">
                  {item.result.prompts[0]}
                </p>
              </div>
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />
          </div>
        ))}
      </div>

      {/* Loading Sentinel */}
      {visibleCount < history.length && (
        <div ref={observerTarget} className="w-full py-6 flex justify-center items-center">
            <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};