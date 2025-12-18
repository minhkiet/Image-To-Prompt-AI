
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageInspectorProps {
  src: string;
  onReset?: () => void;
}

export const ImageInspector: React.FC<ImageInspectorProps> = ({ src, onReset }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showControls, setShowControls] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const MotionDiv = motion.div as any;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newScale = Math.min(Math.max(1, scale + delta), 5);
    setScale(newScale);
    
    // If zooming back to 1, reset position
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale === 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale === 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div 
      className="relative w-full max-w-2xl mx-auto bg-white rounded-[2.5rem] p-3 shadow-2xl border-4 border-white overflow-hidden group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        setShowControls(false);
        handleMouseUp();
      }}
    >
      <div 
        ref={containerRef}
        className={`relative aspect-[4/5] md:aspect-square rounded-[2rem] overflow-hidden bg-gray-100 shadow-inner cursor-all-scroll
          ${scale > 1 ? 'cursor-grabbing' : 'cursor-zoom-in'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <MotionDiv
          animate={{ 
            scale: scale,
            x: position.x,
            y: position.y
          }}
          transition={isDragging ? { type: 'tween', duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full h-full"
        >
          <img 
            src={src} 
            alt="Inspection" 
            className="w-full h-full object-cover pointer-events-none select-none"
            draggable={false}
          />
        </MotionDiv>

        {/* Overlay Instructions */}
        <AnimatePresence>
          {showControls && scale === 1 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 pointer-events-none flex flex-col items-center justify-center text-white p-6 text-center"
            >
              <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                Cuộn chuột để phóng to
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scale Badge */}
        {scale > 1 && (
          <div className="absolute top-6 left-6 bg-pink-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg border-2 border-white z-20">
            {scale.toFixed(1)}x
          </div>
        )}

        {/* Action Buttons */}
        <div className="absolute top-6 right-6 flex flex-col gap-3 z-20">
          {onReset && (
            <button 
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-500 p-2.5 rounded-full shadow-lg backdrop-blur-sm transition-all transform hover:rotate-90 border-2 border-white"
              title="Xóa ảnh"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          {scale > 1 && (
            <button 
              onClick={resetView}
              className="bg-white/90 hover:bg-pink-50 text-pink-500 p-2.5 rounded-full shadow-lg backdrop-blur-sm transition-all border-2 border-white animate-bounce-subtle"
              title="Đặt lại"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Description Footer */}
      <div className="mt-3 px-4 pb-2 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chế độ soi chi tiết</span>
        </div>
        <p className="text-[10px] font-bold text-gray-300 italic">Nhấn giữ & kéo để di chuyển khi phóng to</p>
      </div>
    </div>
  );
};
