import React, { useEffect, useRef } from 'react';

export const Header: React.FC = () => {
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (parallaxRef.current) {
        const scrollY = window.scrollY;
        // Parallax factor: 0.4 moves the background slower than the foreground
        // producing a depth effect
        parallaxRef.current.style.transform = `translateY(${scrollY * 0.4}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="relative w-full py-10 text-center animate-fade-in isolate">
      {/* Parallax Background Layer */}
      <div 
        ref={parallaxRef}
        className="absolute inset-0 -z-10 flex justify-center pointer-events-none"
        aria-hidden="true"
      >
        <div className="w-[120%] max-w-4xl h-[500px] -mt-32 bg-gradient-to-b from-purple-200/40 via-blue-100/20 to-transparent rounded-[100%] blur-3xl opacity-60" />
      </div>

      {/* Main Content */}
      <div className="space-y-5 relative z-10">
        <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-purple-600 to-blue-500 rounded-2xl shadow-xl shadow-purple-200 mb-2 animate-bounce-subtle">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
            Trình Giải Mã <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">Prompt AI</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto px-4 mt-4 font-medium leading-relaxed">
            Tải lên hình ảnh nghệ thuật AI của bạn và để trợ lý bé điệu khám phá câu lệnh "thần chú" đã tạo ra nó.
          </p>
        </div>
      </div>
    </header>
  );
};