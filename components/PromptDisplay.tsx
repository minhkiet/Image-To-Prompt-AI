
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PromptItem } from '../types';
import { translateText, wait } from '../services/geminiService';

interface PromptDisplayProps {
  prompts: PromptItem[];
  suggestions: string[];
  detectedTexts?: string[];
  authorName?: string;
  onOptimize: (index: number) => Promise<void>;
  onOptimizeAll: () => Promise<void>;
}

type FontType = 'font-mono' | 'font-sans' | 'font-serif';
type LanguageType = 'en' | 'vi';

export const PromptDisplay: React.FC<PromptDisplayProps> = ({ prompts, suggestions, detectedTexts = [], authorName = '', onOptimize, onOptimizeAll }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [selectedFont, setSelectedFont] = useState<FontType>('font-mono');
  const [optimizingIndex, setOptimizingIndex] = useState<number | null>(null);
  const [isOptimizingAll, setIsOptimizingAll] = useState(false);
  
  // Language State
  const [currentLanguage, setCurrentLanguage] = useState<LanguageType>('en');
  const [translatedCache, setTranslatedCache] = useState<Record<number, string>>({});
  const [isTranslatingPrompts, setIsTranslatingPrompts] = useState(false);
  const hasAutoSwitchedRef = useRef(false);

  const MotionDiv = motion.div as any;
  const MotionButton = motion.button as any;
  
  // State for text overrides
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({});
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);

  useEffect(() => {
    const initialOverrides: Record<string, string> = {};
    detectedTexts.forEach(text => {
      initialOverrides[text] = text;
    });
    setTextOverrides(initialOverrides);
  }, [detectedTexts]);

  const handleTextOverrideChange = (original: string, newValue: string) => {
    setTextOverrides(prev => ({ ...prev, [original]: newValue }));
  };

  // Helper to handle switching global language
  const handleLanguageSwitch = async (lang: LanguageType) => {
    if (lang === currentLanguage) return;

    if (lang === 'en') {
        setCurrentLanguage('en');
        return;
    }

    // Switching to Vietnamese
    if (lang === 'vi') {
        setIsTranslatingPrompts(true);
        // Set language immediately to trigger loading state in UI
        setCurrentLanguage('vi'); 
        
        try {
            const newCache = { ...translatedCache };
            let updatesMade = false;

            // Sequential processing to respect rate limits
            for (let i = 0; i < prompts.length; i++) {
                // Only translate if not already in cache or if cache is empty
                if (!newCache[i]) {
                    try {
                        const translated = await translateText(prompts[i].text, 'vi');
                        newCache[i] = translated;
                        updatesMade = true;
                        // Small delay to prevent 429 errors
                        await wait(600);
                        // Update cache progressively for better UX
                        setTranslatedCache({...newCache});
                    } catch (e) {
                        console.warn(`Could not translate prompt ${i}`, e);
                        // Fallback to original text if translation fails
                        newCache[i] = prompts[i].text;
                    }
                }
            }

            if (updatesMade) {
                setTranslatedCache(newCache);
            }
        } catch (error) {
            console.error("Global translation error", error);
            // Revert on critical failure if needed, but usually better to leave partial
        } finally {
            setIsTranslatingPrompts(false);
        }
    }
  };

  // Auto-switch to Vietnamese if browser is in Vietnamese
  useEffect(() => {
    if (hasAutoSwitchedRef.current) return;
    
    if (typeof navigator !== 'undefined') {
        const browserLang = navigator.language || (navigator.languages && navigator.languages[0]);
        if (browserLang && browserLang.toLowerCase().startsWith('vi')) {
            hasAutoSwitchedRef.current = true;
            handleLanguageSwitch('vi');
        }
    }
  }, []);

  const handleBatchTranslateOverrides = async (targetLang: 'en' | 'vi') => {
    if (isBatchTranslating || detectedTexts.length === 0) return;
    setIsBatchTranslating(true);
    
    try {
        const newOverrides = { ...textOverrides };
        for (const original of detectedTexts) {
             const currentText = textOverrides[original] || original;
             try {
                 const translated = await translateText(currentText, targetLang);
                 newOverrides[original] = translated;
                 setTextOverrides({...newOverrides}); 
                 await wait(1000); 
             } catch (e) {
                 console.warn(`Translation failed for: ${original}`);
             }
        }
    } catch (error) {
        console.error("Batch translation failed", error);
    } finally {
        setIsBatchTranslating(false);
    }
  };

  const getDisplayPrompt = (index: number): string => {
    const originalPromptText = prompts[index].text;
    
    // Determine base text based on language
    let baseText = originalPromptText;
    if (currentLanguage === 'vi' && translatedCache[index]) {
        baseText = translatedCache[index];
    }

    // Apply overrides ONLY if we are in English mode (since detected keys are in English)
    // In Vietnamese mode, we assume the translation covered the context, 
    // or string matching would be too unreliable.
    if (currentLanguage === 'en') {
        detectedTexts.forEach(original => {
            const replacement = textOverrides[original];
            if (replacement && replacement !== original) {
                baseText = baseText.split(original).join(replacement);
            }
        });
    }

    // Append author name
    let finalPrompt = baseText;
    if (authorName && authorName.trim().length > 0) {
        const trimmedName = authorName.trim();
        if (finalPrompt.endsWith('.')) {
            finalPrompt = finalPrompt.slice(0, -1);
        }
        finalPrompt += `, photo by ${trimmedName}`;
    }

    return finalPrompt;
  };

  const handleCopy = async (index: number) => {
    try {
      const textToCopy = getDisplayPrompt(index);
      await navigator.clipboard.writeText(textToCopy);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleCopyAll = async () => {
    try {
      const allText = prompts.map((_, index) => getDisplayPrompt(index)).join('\n\n');
      await navigator.clipboard.writeText(allText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy all text: ', err);
    }
  };

  const handleUsePrompt = (index: number) => {
      handleCopy(index);
      window.open('https://labs.google/fx/tools/whisk/project', '_blank');
  };

  const handleOptimizeClick = async (index: number) => {
    if (optimizingIndex !== null || isOptimizingAll) return;
    setOptimizingIndex(index);
    try {
      await onOptimize(index);
      // If currently in VI, we should probably invalidate cache for this index, 
      // but let's just switch back to EN to see the result first or let it be.
      // For simplicity, if optimized, we clear cache for this index so it re-translates if needed
      if (translatedCache[index]) {
          const newCache = { ...translatedCache };
          delete newCache[index];
          setTranslatedCache(newCache);
          if (currentLanguage === 'vi') {
              // Trigger re-translation logic implicitly or user has to toggle
              // Just switch to EN to see new prompt is safer UX
              setCurrentLanguage('en'); 
          }
      }
    } finally {
      setOptimizingIndex(null);
    }
  };

  const handleOptimizeAllClick = async () => {
    if (isOptimizingAll || optimizingIndex !== null) return;
    const needsOptimization = prompts.some(p => (p.score || 0) < 10);
    if (!needsOptimization) return;

    setIsOptimizingAll(true);
    try {
      await onOptimizeAll();
      // Clear cache on bulk update
      setTranslatedCache({});
      if (currentLanguage === 'vi') setCurrentLanguage('en');
    } finally {
      setIsOptimizingAll(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) return 'bg-pink-100 text-pink-600 border border-pink-200';
    if (score >= 7) return 'bg-blue-100 text-blue-600 border border-blue-200';
    return 'bg-yellow-100 text-yellow-600 border border-yellow-200';
  };

  const getScoreTooltip = (score: number) => {
    if (score >= 9) return "Chất lượng tuyệt vời: Chi tiết và chính xác cao";
    if (score >= 7) return "Chất lượng tốt: Đầy đủ các yếu tố chính";
    return "Chất lượng trung bình: Có thể cần bổ sung thêm chi tiết";
  };

  const canOptimizeAny = prompts.some(p => (p.score || 0) < 10);

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100 } }
  };

  // Reusable Kawaii Button Style
  const KawaiiButton = ({ color, onClick, disabled, children, active, className = '' }: any) => {
    const Btn = motion.button as any;
    const colors: any = {
      pink: "from-pink-300 to-rose-300 shadow-pink-200 text-white border-pink-100",
      blue: "from-sky-300 to-blue-300 shadow-sky-200 text-white border-sky-100",
      yellow: "from-amber-200 to-orange-300 shadow-orange-100 text-white border-yellow-50",
      white: "from-white to-gray-50 shadow-gray-200 text-gray-600 border-gray-100 hover:text-pink-500",
      active: "from-green-400 to-emerald-400 shadow-green-200 text-white border-green-200",
      dark: "from-gray-700 to-gray-800 shadow-gray-400 text-white border-gray-600"
    };
    
    const bgClass = active ? colors.active : colors[color];

    return (
      <Btn
        onClick={onClick}
        disabled={disabled}
        whileHover={{ scale: 1.05, translateY: -2 }}
        whileTap={{ scale: 0.95 }}
        className={`
          relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-full
          bg-gradient-to-b ${bgClass}
          shadow-[0_4px_10px_-2px] hover:shadow-[0_6px_15px_-3px]
          border-t-2 transition-all duration-300
          text-sm font-extrabold tracking-wide uppercase
          ${disabled ? 'opacity-70 cursor-wait grayscale' : ''}
          ${className}
        `}
      >
        {children}
        {/* Shine effect */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-full pointer-events-none" />
      </Btn>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Sticky Header Control Bar */}
      <MotionDiv 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-4 z-30 bg-white/85 backdrop-blur-lg rounded-[2rem] shadow-xl shadow-purple-500/5 border-2 border-white p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-all duration-300"
      >
         <div className="flex items-center gap-3">
           <div className="p-3 bg-pink-100 rounded-full text-pink-500 border-2 border-white shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
                <h3 className="font-black text-gray-700 text-lg leading-tight">Kết quả phân tích</h3>
                <p className="text-xs text-gray-400 font-bold">{prompts.length} prompt đã được tạo</p>
            </div>
         </div>

         <div className="flex flex-wrap items-center gap-2 sm:gap-3">
             {/* Language Switcher */}
             <div className="flex items-center bg-gray-100 p-1 rounded-full border border-gray-200">
                <button
                    onClick={() => handleLanguageSwitch('en')}
                    disabled={isTranslatingPrompts}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${currentLanguage === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    🇺🇸 English
                </button>
                <button
                    onClick={() => handleLanguageSwitch('vi')}
                    disabled={isTranslatingPrompts}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${currentLanguage === 'vi' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    {isTranslatingPrompts && currentLanguage !== 'vi' ? (
                       <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                       <span>🇻🇳</span>
                    )}
                    Tiếng Việt
                </button>
             </div>

             <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block"></div>

             <div className="relative group">
                <select
                    value={selectedFont}
                    onChange={(e) => setSelectedFont(e.target.value as FontType)}
                    className="appearance-none bg-gray-50 border-2 border-gray-100 text-gray-600 text-xs font-bold rounded-full pl-4 pr-10 py-2.5 outline-none focus:border-pink-300 transition-colors uppercase tracking-wide cursor-pointer hover:bg-white shadow-sm"
                >
                    <option value="font-mono">Mono</option>
                    <option value="font-sans">Sans</option>
                    <option value="font-serif">Serif</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
             </div>
             
             {canOptimizeAny && (
                <KawaiiButton 
                  color="yellow" 
                  onClick={handleOptimizeAllClick} 
                  disabled={isOptimizingAll || isTranslatingPrompts}
                  className={!isOptimizingAll ? "animate-pulse" : ""}
                >
                    {isOptimizingAll ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    )}
                    <span>{isOptimizingAll ? "Đang xử lý..." : "Tối ưu hết"}</span>
                </KawaiiButton>
             )}

             <KawaiiButton color="pink" onClick={handleCopyAll} active={copiedAll} disabled={isTranslatingPrompts}>
                {copiedAll ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                )}
                <span className="hidden sm:inline">{copiedAll ? "Đã chép!" : "Chép hết"}</span>
             </KawaiiButton>
         </div>
      </MotionDiv>

      {/* Detected Text Editor Section (Only Visible in English) */}
      <AnimatePresence>
      {detectedTexts.length > 0 && currentLanguage === 'en' && (
        <MotionDiv 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-orange-50 rounded-[2rem] border-2 border-orange-100 p-6 shadow-sm"
        >
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
               <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-200 text-orange-700 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 00-1 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.279a1 1 0 11-2 0V12.9a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                      <h3 className="font-bold text-orange-900 text-sm uppercase tracking-wide">Chỉnh sửa văn bản trong ảnh</h3>
                      <p className="text-[10px] text-orange-600/70 italic">* Thay đổi sẽ tự động cập nhật vào prompt (Tiếng Anh)</p>
                  </div>
               </div>
               
               <div className="flex gap-2">
                   {/* Translation buttons for DETECTED TEXT ONLY */}
                   <MotionButton
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleBatchTranslateOverrides('en')}
                      disabled={isBatchTranslating}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 border-2 border-indigo-50 transition-all disabled:opacity-50"
                   >
                      {isBatchTranslating ? (
                          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      ) : (
                          <span>🇺🇸</span>
                      )}
                      <span>Dịch từ khóa</span>
                   </MotionButton>
                   <MotionButton
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleBatchTranslateOverrides('vi')}
                      disabled={isBatchTranslating}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-full bg-red-100 text-red-600 hover:bg-red-200 border-2 border-red-50 transition-all disabled:opacity-50"
                   >
                      {isBatchTranslating ? (
                          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      ) : (
                          <span>🇻🇳</span>
                      )}
                      <span>Dịch từ khóa</span>
                   </MotionButton>
               </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detectedTexts.map((text, idx) => {
                return (
                  <div key={idx} className="flex flex-col gap-1.5 bg-white p-3 rounded-2xl border-2 border-orange-100 shadow-sm">
                     <label className="text-xs font-extrabold text-orange-400 ml-1 truncate uppercase" title={text}>
                        Gốc: "{text}"
                     </label>
                     <div className="relative">
                       <input 
                          type="text" 
                          value={textOverrides[text] || text}
                          onChange={(e) => handleTextOverrideChange(text, e.target.value)}
                          className="w-full pl-4 pr-4 py-2 rounded-xl border-2 border-orange-100 bg-orange-50/30 text-gray-700 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-300 outline-none transition-all font-semibold"
                          placeholder={`Thay thế cho "${text}"`}
                       />
                     </div>
                  </div>
                );
              })}
           </div>
        </MotionDiv>
      )}
      </AnimatePresence>

      {/* Prompts Grid with Staggered Animation */}
      <MotionDiv 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {prompts.map((promptItem, index) => {
          const isMain = index === 0;
          const displayPromptText = getDisplayPrompt(index);
          const isOptimizingThis = optimizingIndex === index || (isOptimizingAll && (promptItem.score || 0) < 10);
          // Check if we are waiting for THIS specific prompt translation
          const isWaitingTranslation = currentLanguage === 'vi' && isTranslatingPrompts && !translatedCache[index];

          return (
            <MotionDiv 
              key={index} 
              variants={itemVariants}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className={`group flex flex-col bg-white rounded-[2.5rem] shadow-lg border-2 overflow-hidden relative
                ${isMain ? 'lg:col-span-2 border-pink-200 shadow-pink-100' : 'border-gray-100 shadow-gray-100'}
              `}
            >
              {/* Card Header */}
              <div className={`px-6 py-4 border-b-2 flex items-center justify-between
                 ${isMain 
                    ? 'bg-gradient-to-r from-pink-50 to-white border-pink-100' 
                    : 'bg-white border-gray-100'}
              `}>
                 <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-10 h-10 rounded-full text-lg font-black shadow-inner ring-4 ring-white
                        ${isMain ? 'bg-pink-300 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        {index + 1}
                    </span>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className={`font-black text-base ${isMain ? 'text-pink-600' : 'text-gray-600'}`}>
                                {isMain ? "Bản Sao Hoàn Hảo" : `Biến Thể ${index}`}
                            </span>
                            {(promptItem.score !== undefined) && (
                                <span 
                                  className={`px-3 py-1 rounded-full text-[10px] font-black shadow-sm cursor-help uppercase tracking-wider ${getScoreColor(promptItem.score)}`}
                                  title={getScoreTooltip(promptItem.score)}
                                >
                                    {promptItem.score}/10
                                </span>
                            )}
                        </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-2">
                     {(promptItem.score || 0) < 9 && currentLanguage === 'en' && (
                         <MotionButton
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleOptimizeClick(index)}
                            disabled={optimizingIndex === index || isOptimizingAll || isTranslatingPrompts}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm border-2
                                ${isOptimizingThis
                                    ? 'bg-yellow-100 text-yellow-400 border-yellow-200'
                                    : 'bg-white text-yellow-500 border-yellow-200 hover:bg-yellow-400 hover:text-white hover:border-yellow-400'
                                }`}
                            title="Tối ưu hóa"
                         >
                            {isOptimizingThis ? (
                                 <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                 </svg>
                            ) : (
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                 </svg>
                            )}
                         </MotionButton>
                     )}

                     <MotionButton
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCopy(index)}
                        disabled={isWaitingTranslation}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm border-2
                            ${copiedIndex === index 
                                ? 'bg-green-100 text-green-600 border-green-200' 
                                : 'bg-white text-gray-400 border-gray-100 hover:bg-pink-400 hover:text-white hover:border-pink-400'
                            }`}
                        title="Sao chép"
                     >
                        {copiedIndex === index ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                        )}
                     </MotionButton>
                 </div>
              </div>

              {/* Card Body */}
              <div className="flex-grow p-6 bg-white cursor-text min-h-[150px] relative">
                {isWaitingTranslation ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                        <div className="flex flex-col items-center">
                            <svg className="animate-spin h-8 w-8 text-pink-400 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-xs font-bold text-pink-400 animate-pulse">Đang dịch...</span>
                        </div>
                    </div>
                ) : (
                    <p className={`${selectedFont} text-sm font-medium leading-7 text-gray-600 whitespace-pre-wrap selection:bg-pink-100 selection:text-pink-900`}>
                        {displayPromptText}
                    </p>
                )}
              </div>

              {/* Card Footer */}
              <div className="px-6 py-3 bg-gray-50/50 border-t-2 border-gray-100 flex flex-wrap items-center justify-between gap-3">
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider bg-white border border-gray-100 px-3 py-1 rounded-full shadow-sm">
                        {displayPromptText.split(/\s+/).length} words
                    </span>
                 </div>
                 
                 <MotionButton
                    whileHover={{ x: 3 }}
                    onClick={() => handleUsePrompt(index)}
                    className="group/btn flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border-2 border-gray-100 text-xs font-bold text-gray-500 hover:text-indigo-500 hover:border-indigo-200 hover:shadow-sm transition-all"
                 >
                    <span>Dùng trên Whisk</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                 </MotionButton>
              </div>
            </MotionDiv>
          );
        })}
      </MotionDiv>
    </div>
  );
};
