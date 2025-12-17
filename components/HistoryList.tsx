import React, { useState, useEffect, useRef } from 'react';
import { HistoryItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface HistoryListProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

const ITEMS_PER_PAGE = 6;

export const HistoryList: React.FC<HistoryListProps> = ({ history, onSelect, onClear }) => {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const MotionDiv = motion.div as any;

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
          // Increase visible count when user scrolls to bottom
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

  const getPreviewText = (result: any) => {
    if (!result || !result.prompts || result.prompts.length === 0) return "Không có nội dung";
    const firstPrompt = result.prompts[0];
    if (typeof firstPrompt === 'string') return firstPrompt;
    return firstPrompt.text || "Lỗi định dạng";
  };

  return (
    <MotionDiv 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full mt-12"
    >
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

      <MotionDiv 
        layout
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        <AnimatePresence mode='popLayout'>
        {visibleHistory.map((item, index) => (
          <MotionDiv
            key={item.id}
            onClick={() => onSelect(item)}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: (index % ITEMS_PER_PAGE) * 0.05 }}
            whileHover={{ y: -5, scale: 1.02 }}
            className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-3 border border-gray-100 shadow-sm hover:shadow-xl hover:border-purple-200 cursor-pointer overflow-hidden"
          >
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-100 relative shadow-inner">
                <img
                  src={item.image.previewUrl}
                  alt="History thumbnail"
                  loading="lazy"
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-purple-900/0 group-hover:bg-purple-900/10 transition-colors duration-300" />
              </div>

              {/* Info */}
              <div className="flex flex-col justify-center overflow-hidden z-10">
                <p className="text-xs text-gray-400 font-medium mb-1">
                  {new Date(item.timestamp).toLocaleString('vi-VN')}
                </p>
                <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-purple-700 transition-colors duration-300">
                  {getPreviewText(item.result)}
                </p>
              </div>
            </div>
            
            <div className="absolute inset-0 bg-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />
          </MotionDiv>
        ))}
        </AnimatePresence>
      </MotionDiv>

      {/* Loading Sentinel with Cute Animation */}
      {visibleCount < history.length && (
        <div ref={observerTarget} className="w-full py-8 flex flex-col justify-center items-center gap-3 min-h-[100px]">
            <div className="flex items-center gap-2">
                <motion.div 
                    className="w-3 h-3 rounded-full bg-pink-400 shadow-sm"
                    animate={{ y: ["0%", "-60%", "0%"] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                />
                <motion.div 
                    className="w-3 h-3 rounded-full bg-purple-400 shadow-sm"
                    animate={{ y: ["0%", "-60%", "0%"] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                />
                <motion.div 
                    className="w-3 h-3 rounded-full bg-blue-400 shadow-sm"
                    animate={{ y: ["0%", "-60%", "0%"] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Đang tải thêm...</p>
        </div>
      )}
    </MotionDiv>
  );
};