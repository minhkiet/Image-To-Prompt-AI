import React from 'react';
import { motion } from 'framer-motion';

export const Header: React.FC = () => {
  const MotionDiv = motion.div as any;
  const MotionP = motion.p as any;

  return (
    <header className="relative w-full py-12 text-center isolate">
      {/* Main Content */}
      <MotionDiv 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="space-y-6 relative z-10"
      >
        <MotionDiv 
          className="inline-flex items-center justify-center"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="relative w-24 h-24 rounded-full p-1 bg-white shadow-xl shadow-pink-200/50">
            <img 
              src="https://i.pinimg.com/736x/5c/7a/2d/5c7a2decdf0731e810f0c547f7d755d3.jpg" 
              alt="Logo" 
              className="w-full h-full rounded-full object-cover"
            />
            {/* Optional sparkle effect overlay */}
            <div className="absolute -top-1 -right-1 text-2xl animate-bounce delay-700">✨</div>
          </div>
        </MotionDiv>
        <div>
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight drop-shadow-sm">
            Trợ Lý Bé Điệu <br className="md:hidden" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 animate-gradient-x">
              Siêu Cấp Cute
            </span>
          </h1>
          <MotionP 
            className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto px-4 mt-4 font-medium leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Bạn cần tìm ảnh mẫu mà bạn mong muốn nhất hãy tải ảnh đó lên và để trợ lý bé điệu khám phá câu lệnh "thần chú" đã tạo ra nó.
          </MotionP>
        </div>
      </MotionDiv>
    </header>
  );
};