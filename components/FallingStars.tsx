import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StarParticle {
  id: number;
  type: 'sparkle' | 'star' | 'orb' | 'streak';
  x: number; // percentage (0 - 100)
  size: number; // px
  duration: number; // seconds
  delay: number; // seconds
  color: string;
  glowColor: string;
  rotationSpeed: number;
  driftX: number; // horizontal drift px
}

const STAR_COLORS = [
  { fill: '#FFD54F', glow: 'rgba(255, 213, 79, 0.4)' }, // Warm pastel gold
  { fill: '#FFB7D5', glow: 'rgba(255, 183, 213, 0.4)' }, // Kawaii pink
  { fill: '#C084FC', glow: 'rgba(192, 132, 252, 0.35)' }, // Lavender
  { fill: '#8BE0FF', glow: 'rgba(139, 224, 255, 0.35)' }, // Sky pastel
  { fill: '#FFF9C4', glow: 'rgba(255, 249, 196, 0.5)' }, // Light starry white-yellow
];

export const FallingStars: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate a deterministic but rich set of particles
  const particles: StarParticle[] = useMemo(() => {
    const list: StarParticle[] = [];
    const count = 30; // balanced for 60fps smoothness and rich visuals

    for (let i = 0; i < count; i++) {
      const colorScheme = STAR_COLORS[i % STAR_COLORS.length];
      const types: ('sparkle' | 'star' | 'orb' | 'streak')[] = [
        'sparkle',
        'star',
        'orb',
        'sparkle',
        'star',
        'streak',
      ];
      const type = types[i % types.length];

      list.push({
        id: i,
        type,
        x: Math.random() * 98 + 1, // 1% - 99%
        size: type === 'streak' ? Math.random() * 20 + 25 : Math.random() * 12 + 8,
        duration: type === 'streak' ? Math.random() * 3 + 3.5 : Math.random() * 7 + 8, // gentle falling speed
        delay: Math.random() * 10,
        color: colorScheme.fill,
        glowColor: colorScheme.glow,
        rotationSpeed: (Math.random() - 0.5) * 360,
        driftX: (Math.random() - 0.5) * 80,
      });
    }
    return list;
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none" aria-hidden="true">
      {/* Floating Star Toggle Badge */}
      <div className="pointer-events-auto absolute top-4 right-4 z-20">
        <motion.button
          onClick={() => setIsEnabled((prev) => !prev)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          title={isEnabled ? 'Tắt hiệu ứng sao rơi' : 'Bật hiệu ứng sao rơi'}
          className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 backdrop-blur-md border shadow-sm transition-all duration-300 ${
            isEnabled
              ? 'bg-white/80 border-pink-200 text-pink-600 shadow-pink-100 hover:bg-white'
              : 'bg-white/50 border-gray-200 text-gray-400 hover:bg-white/80'
          }`}
        >
          <span className={isEnabled ? 'animate-spin' : ''} style={{ animationDuration: '6s' }}>
            ✨
          </span>
          <span className="hidden sm:inline">
            {isEnabled ? 'Sao rơi: Bật' : 'Sao rơi: Tắt'}
          </span>
        </motion.button>
      </div>

      <AnimatePresence>
        {isEnabled && (
          <div className="absolute inset-0">
            {particles.map((p) => {
              if (p.type === 'streak') {
                return (
                  <motion.div
                    key={p.id}
                    initial={{
                      x: `${p.x}vw`,
                      y: '-10vh',
                      opacity: 0,
                      scale: 0.5,
                      rotate: 35,
                    }}
                    animate={{
                      x: [`${p.x}vw`, `${p.x + 12}vw`],
                      y: ['-10vh', '115vh'],
                      opacity: [0, 0.85, 0.85, 0],
                      scale: [0.5, 1, 0.8, 0],
                    }}
                    transition={{
                      duration: p.duration,
                      repeat: Infinity,
                      delay: p.delay,
                      ease: 'linear',
                    }}
                    className="absolute"
                  >
                    {/* Shooting Star with soft gradient tail */}
                    <div
                      className="relative rounded-full"
                      style={{
                        width: `${p.size}px`,
                        height: '3px',
                        background: `linear-gradient(90deg, ${p.color}, transparent)`,
                        boxShadow: `0 0 8px ${p.glowColor}`,
                        transform: 'rotate(45deg)',
                      }}
                    >
                      <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          width: '6px',
                          height: '6px',
                          backgroundColor: '#FFF',
                          boxShadow: `0 0 10px ${p.glowColor}, 0 0 4px #FFF`,
                        }}
                      />
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={p.id}
                  initial={{
                    x: `${p.x}vw`,
                    y: '-5vh',
                    opacity: 0,
                    scale: 0.3,
                    rotate: 0,
                  }}
                  animate={{
                    x: [
                      `${p.x}vw`,
                      `calc(${p.x}vw + ${p.driftX * 0.5}px)`,
                      `calc(${p.x}vw + ${p.driftX}px)`,
                    ],
                    y: ['-5vh', '50vh', '108vh'],
                    opacity: [0, 0.9, 0.9, 0],
                    scale: [0.3, 1, 1, 0.2],
                    rotate: [0, p.rotationSpeed],
                  }}
                  transition={{
                    duration: p.duration,
                    repeat: Infinity,
                    delay: p.delay,
                    ease: 'easeInOut',
                  }}
                  className="absolute flex items-center justify-center filter drop-shadow"
                  style={{
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                  }}
                >
                  {p.type === 'sparkle' ? (
                    // 4-Point Diamond Sparkle Star (✦)
                    <svg
                      viewBox="0 0 24 24"
                      className="w-full h-full"
                      style={{ filter: `drop-shadow(0 0 5px ${p.glowColor})` }}
                    >
                      <path
                        d="M12 0 C12 6.6 17.4 12 24 12 C17.4 12 12 17.4 12 24 C12 17.4 6.6 12 0 12 C6.6 12 12 6.6 12 0 Z"
                        fill={p.color}
                      />
                    </svg>
                  ) : p.type === 'star' ? (
                    // 5-Point Kawaii Soft Star (★)
                    <svg
                      viewBox="0 0 24 24"
                      className="w-full h-full"
                      style={{ filter: `drop-shadow(0 0 6px ${p.glowColor})` }}
                    >
                      <path
                        d="M12 2l2.9 6.2 6.8.8-5 4.7 1.3 6.8-6-3.3-6 3.3 1.3-6.8-5-4.7 6.8-.8z"
                        fill={p.color}
                      />
                    </svg>
                  ) : (
                    // Soft Glowing Stardust Orb
                    <div
                      className="rounded-full animate-pulse"
                      style={{
                        width: `${Math.max(4, p.size * 0.6)}px`,
                        height: `${Math.max(4, p.size * 0.6)}px`,
                        backgroundColor: p.color,
                        boxShadow: `0 0 10px 3px ${p.glowColor}, 0 0 4px #FFF`,
                      }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
