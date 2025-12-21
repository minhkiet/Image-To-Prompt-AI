
import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

// Optimized Base64 SVG Pattern to replace external HTTP request
// This loads instantly, saves bandwidth, and renders perfectly on all screen densities.
const BG_PATTERN = "data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E";

export const Header: React.FC = () => {
  const { scrollY } = useScroll();
  
  // Parallax transforms for background layers
  const bgY = useTransform(scrollY, [0, 500], [0, 150]);
  const decorY1 = useTransform(scrollY, [0, 500], [0, -100]);
  const decorY2 = useTransform(scrollY, [0, 500], [0, -50]);
  const decorRotate = useTransform(scrollY, [0, 500], [0, 45]);

  const MotionDiv = motion.div as any;
  const MotionP = motion.p as any;

  return (
    <header className="relative w-full py-16 md:py-24 text-center isolate overflow-hidden rounded-kawaii mb-8">
      {/* Parallax Background Layer */}
      <MotionDiv 
        style={{ y: bgY }}
        className="absolute inset-0 -z-20"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-pink-100/80 via-white/60 to-transparent" />
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{ 
            backgroundImage: `url("${BG_PATTERN}")`,
            backgroundSize: '60px 60px'
          }} 
        />
      </MotionDiv>

      {/* Floating Decorative Elements with Parallax */}
      <MotionDiv
        style={{ y: decorY1, rotate: decorRotate }}
        className="absolute top-10 left-[10%] text-4xl opacity-20 pointer-events-none select-none hidden md:block"
      >
        ✨
      </MotionDiv>
      <MotionDiv
        style={{ y: decorY2, rotate: -decorRotate }}
        className="absolute bottom-10 right-[15%] text-5xl opacity-20 pointer-events-none select-none hidden md:block"
      >
        🌸
      </MotionDiv>
      <MotionDiv
        style={{ y: decorY1, x: 20 }}
        className="absolute top-20 right-[10%] text-3xl opacity-20 pointer-events-none select-none hidden md:block"
      >
        ☁️
      </MotionDiv>

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
          <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full p-1.5 bg-white shadow-2xl shadow-pink-200/50 ring-4 ring-pink-50">
            {/* Optimized Responsive Image with srcset and fetchPriority */}
            <img 
              src="https://i.pinimg.com/236x/5c/7a/2d/5c7a2decdf0731e810f0c547f7d755d3.jpg"
              srcSet="https://i.pinimg.com/236x/5c/7a/2d/5c7a2decdf0731e810f0c547f7d755d3.jpg 1x, https://i.pinimg.com/736x/5c/7a/2d/5c7a2decdf0731e810f0c547f7d755d3.jpg 2x"
              sizes="(max-width: 768px) 112px, 128px"
              alt="Logo Trợ Lý Bé Điệu" 
              width="128"
              height="128"
              fetchPriority="high"
              className="w-full h-full rounded-full object-cover"
            />
            <div className="absolute -top-2 -right-2 text-3xl animate-bounce delay-700">✨</div>
          </div>
        </MotionDiv>
        
        <div className="px-4">
          <h1 className="text-4xl md:text-7xl font-black text-gray-900 tracking-tight drop-shadow-sm leading-tight">
            Trợ Lý <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 animate-gradient-x">
              Bé Điệu
            </span>
          </h1>
          <MotionP 
            className="text-gray-600 text-lg md:text-2xl max-w-2xl mx-auto mt-6 font-semibold leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Khám phá câu lệnh "thần chú" đằng sau những bức ảnh tuyệt đẹp của bạn chỉ với một cú chạm! 🪄
          </MotionP>
        </div>
      </MotionDiv>
      
      {/* Subtle bottom curve/fade */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white to-transparent -z-10" />
    </header>
  );
};
