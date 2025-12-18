
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
  
  const [currentLanguage, setCurrentLanguage] = useState<LanguageType>('en');
  const [translatedCache, setTranslatedCache] = useState<Record<number, string>>({});
  const [isTranslatingPrompts, setIsTranslatingPrompts] = useState(false);
  const hasAutoSwitchedRef = useRef(false);

  const MotionDiv = motion.div as any;
  const MotionButton = motion.button as any;
  
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

  const handleLanguageSwitch = async (lang: LanguageType) => {
    if (lang === currentLanguage) return;
    if (lang === 'en') {
        setCurrentLanguage('en');
        return;
    }
    if (lang === 'vi') {
        setIsTranslatingPrompts(true);
        setCurrentLanguage('vi'); 
        try {
            const newCache = { ...translatedCache };
            for (let i = 0; i < prompts.length; i++) {
                if (!newCache[i]) {
                    try {
                        const translated = await translateText(prompts[i].text, 'vi');
                        newCache[i] = translated;
                        setTranslatedCache({...newCache});
                        await wait(600);
                    } catch (e) {
                        newCache[i] = prompts[i].text;
                    }
                }
            }
        } finally {
            setIsTranslatingPrompts(false);
        }
    }
  };

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
             try {
                 const translated = await translateText(textOverrides[original] || original, targetLang);
                 newOverrides[original] = translated;
                 setTextOverrides({...newOverrides}); 
                 await wait(1000); 
             } catch (e) {}
        }
    } finally {
        setIsBatchTranslating(false);
    }
  };

  const getDisplayPrompt = (index: number): string => {
    const originalPromptText = prompts[index].text;
    let baseText = currentLanguage === 'vi' && translatedCache[index] ? translatedCache[index] : originalPromptText;

    if (currentLanguage === 'en') {
        detectedTexts.forEach(original => {
            const replacement = textOverrides[original];
            if (replacement && replacement !== original) {
                baseText = baseText.split(original).join(replacement);
            }
        });
    }

    if (authorName && authorName.trim().length > 0) {
        const trimmedName = authorName.trim();
        baseText = baseText.endsWith('.') ? baseText.slice(0, -1) : baseText;
        baseText += `, photo by ${trimmedName}`;
    }
    return baseText;
  };

  const handleCopy = async (index: number) => {
    try {
      await navigator.clipboard.writeText(getDisplayPrompt(index));
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {}
  };

  const handleCopyAll = async () => {
    try {
      const allText = prompts.map((_, index) => getDisplayPrompt(index)).join('\n\n');
      await navigator.clipboard.writeText(allText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {}
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
      if (translatedCache[index]) {
          const newCache = { ...translatedCache };
          delete newCache[index];
          setTranslatedCache(newCache);
          if (currentLanguage === 'vi') setCurrentLanguage('en'); 
      }
    } finally {
      setOptimizingIndex(null);
    }
  };

  const handleOptimizeAllClick = async () => {
    if (isOptimizingAll || optimizingIndex !== null) return;
    if (!prompts.some(p => (p.score || 0) < 10)) return;
    setIsOptimizingAll(true);
    try {
      await onOptimizeAll();
      setTranslatedCache({});
      if (currentLanguage === 'vi') setCurrentLanguage('en');
    } finally {
      setIsOptimizingAll(false);
    }
  };

  const getScoreStyles = (score: number) => {
    if (score >= 9) return 'bg-pink-100 text-pink-600 border-pink-200';
    if (score >= 7) return 'bg-blue-100 text-blue-600 border-blue-200';
    return 'bg-yellow-100 text-yellow-600 border-yellow-200';
  };

  const KawaiiButton = ({ color, onClick, disabled, children, active, className = '' }: any) => {
    const colors: any = {
      pink: "from-pink-300 to-rose-300 shadow-kawaii-pink text-white border-pink-100",
      blue: "from-sky-300 to-blue-300 shadow-kawaii-purple text-white border-sky-100",
      yellow: "from-amber-200 to-orange-300 text-white border-yellow-50",
      white: "from-white to-gray-50 text-gray-600 border-gray-100 hover:text-pink-500",
      active: "from-green-400 to-emerald-400 text-white border-green-200"
    };
    
    return (
      <MotionButton
        onClick={onClick}
        disabled={disabled}
        whileHover={{ scale: 1.05, translateY: -2 }}
        whileTap={{ scale: 0.95 }}
        className={`
          kawaii-btn-shine flex items-center justify-center gap-2 px-4 py-2.5 rounded-full
          bg-gradient-to-b ${active ? colors.active : colors[color]}
          shadow-md hover:shadow-lg border-t-2 transition-all duration-300
          text-sm font-extrabold uppercase tracking-tight
          ${disabled ? 'opacity-70 grayscale cursor-wait' : ''}
          ${className}
        `}
      >
        {children}
      </MotionButton>
    );
  };

  return (
    <div className="w-full space-y-6">
      <MotionDiv 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-4 z-30 kawaii-glass rounded-kawaii p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-all shadow-kawaii-purple"
      >
         <div className="flex items-center gap-3">
           <div className="p-3 bg-pink-100 rounded-full text-pink-500 border-2 border-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
                <h3 className="font-black text-gray-700 text-lg leading-tight">Kết quả phân tích</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{prompts.length} prompt đã được tạo</p>
            </div>
         </div>

         <div className="flex flex-wrap items-center gap-2 sm:gap-3">
             <div className="flex items-center bg-gray-100 p-1 rounded-full border border-gray-200 shadow-inner">
                <button
                    onClick={() => handleLanguageSwitch('en')}
                    disabled={isTranslatingPrompts}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${currentLanguage === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
                >🇺🇸 EN</button>
                <button
                    onClick={() => handleLanguageSwitch('vi')}
                    disabled={isTranslatingPrompts}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${currentLanguage === 'vi' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}
                >
                    {isTranslatingPrompts && currentLanguage !== 'vi' ? <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <span>🇻🇳</span>}
                    VI
                </button>
             </div>

             <select
                value={selectedFont}
                onChange={(e) => setSelectedFont(e.target.value as FontType)}
                className="bg-white border-2 border-gray-100 text-gray-600 text-[10px] font-black rounded-full px-4 py-2.5 outline-none shadow-sm uppercase tracking-wider cursor-pointer transition-colors hover:border-pink-300"
             >
                <option value="font-mono">Mono</option>
                <option value="font-sans">Sans</option>
                <option value="font-serif">Serif</option>
             </select>
             
             {prompts.some(p => (p.score || 0) < 10) && (
                <KawaiiButton color="yellow" onClick={handleOptimizeAllClick} disabled={isOptimizingAll || isTranslatingPrompts} className={!isOptimizingAll ? "animate-pulse" : ""}>
                    {isOptimizingAll ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                    <span className="hidden md:inline">{isOptimizingAll ? "Xử lý..." : "Tối ưu hết"}</span>
                </KawaiiButton>
             )}

             <KawaiiButton color="pink" onClick={handleCopyAll} active={copiedAll} disabled={isTranslatingPrompts}>
                {copiedAll ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                <span className="hidden sm:inline">{copiedAll ? "Đã chép!" : "Chép hết"}</span>
             </KawaiiButton>
         </div>
      </MotionDiv>

      <AnimatePresence>
      {detectedTexts.length > 0 && currentLanguage === 'en' && (
        <MotionDiv initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-amber-50 rounded-kawaii border-2 border-amber-100 p-6 shadow-sm overflow-hidden" >
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
               <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-200 text-amber-700 rounded-full shadow-inner"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 00-1 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.279a1 1 0 11-2 0V12.9a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg></div>
                  <h3 className="font-black text-amber-900 text-sm tracking-tight uppercase">Văn bản trong ảnh</h3>
               </div>
               <div className="flex gap-2">
                   {['en', 'vi'].map(lang => (
                      <MotionButton key={lang} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleBatchTranslateOverrides(lang as any)} disabled={isBatchTranslating} className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase rounded-full border-2 transition-all ${lang === 'en' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-red-50 text-red-600 border-red-100'} disabled:opacity-50`} >
                         {isBatchTranslating ? <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <span>{lang === 'en' ? '🇺🇸' : '🇻🇳'}</span>}
                         Dịch từ khóa
                      </MotionButton>
                   ))}
               </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detectedTexts.map((text, idx) => (
                <div key={idx} className="flex flex-col gap-1 bg-white p-3 rounded-2xl border-2 border-amber-100 shadow-sm">
                   <label className="text-[10px] font-black text-amber-400 truncate uppercase px-1">Gốc: "{text}"</label>
                   <input type="text" value={textOverrides[text] || text} onChange={(e) => handleTextOverrideChange(text, e.target.value)} className="w-full px-4 py-2 rounded-xl border-2 border-amber-50 bg-amber-50/20 text-gray-700 text-xs font-bold outline-none focus:border-amber-300 transition-all" placeholder={`Thay thế "${text}"`} />
                </div>
              ))}
           </div>
        </MotionDiv>
      )}
      </AnimatePresence>

      <MotionDiv initial="hidden" animate="show" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }} className="grid grid-cols-1 lg:grid-cols-2 gap-6" >
        {prompts.map((promptItem, index) => {
          const isMain = index === 0;
          const displayPromptText = getDisplayPrompt(index);
          const isOptimizingThis = optimizingIndex === index || (isOptimizingAll && (promptItem.score || 0) < 10);
          const isWaitingTranslation = currentLanguage === 'vi' && isTranslatingPrompts && !translatedCache[index];

          return (
            <MotionDiv key={index} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -5 }} className={`kawaii-card overflow-hidden flex flex-col group ${isMain ? 'lg:col-span-2 border-pink-100' : 'border-gray-50'}`} >
              <div className={`px-6 py-4 border-b-2 flex items-center justify-between ${isMain ? 'bg-pink-50/30' : 'bg-gray-50/20'}`}>
                 <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shadow-inner ring-4 ring-white ${isMain ? 'bg-pink-300 text-white' : 'bg-gray-200 text-gray-400'}`}>{index + 1}</span>
                    <div className="flex items-center gap-2">
                        <span className={`font-black text-sm uppercase tracking-tight ${isMain ? 'text-pink-600' : 'text-gray-500'}`}>{isMain ? "Bản Sao Hoàn Hảo" : `Biến Thể ${index}`}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${getScoreStyles(promptItem.score || 0)}`}>{promptItem.score}/10</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                     {(promptItem.score || 0) < 9 && currentLanguage === 'en' && (
                         <MotionButton onClick={() => handleOptimizeClick(index)} disabled={optimizingIndex === index || isOptimizingAll || isTranslatingPrompts} className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isOptimizingThis ? 'bg-yellow-100 text-yellow-400' : 'bg-white text-yellow-500 hover:bg-yellow-500 hover:text-white border-yellow-100'}`} title="Tối ưu">
                            {isOptimizingThis ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                         </MotionButton>
                     )}
                     <MotionButton onClick={() => handleCopy(index)} disabled={isWaitingTranslation} className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${copiedIndex === index ? 'bg-green-100 text-green-600' : 'bg-white text-gray-300 hover:bg-pink-400 hover:text-white border-gray-100'}`} title="Chép">
                        {copiedIndex === index ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                     </MotionButton>
                 </div>
              </div>
              <div className="flex-grow p-6 relative bg-white cursor-text min-h-[120px]">
                {isWaitingTranslation ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 animate-fade-in"><svg className="animate-spin h-6 w-6 text-pink-300 mb-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className="text-[10px] font-black text-pink-300 uppercase animate-pulse">Đang dịch...</span></div>
                ) : (
                    <p className={`${selectedFont} text-sm leading-relaxed text-gray-600 selection:bg-pink-100`}>{displayPromptText}</p>
                )}
              </div>
              <div className="px-6 py-2 bg-gray-50/30 border-t flex items-center justify-between gap-3">
                 <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{displayPromptText.split(/\s+/).length} từ</span>
                 <button onClick={() => handleUsePrompt(index)} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-100 text-[10px] font-black text-gray-400 hover:text-indigo-500 hover:border-indigo-100 transition-all uppercase tracking-tighter"><span>Dùng trên Whisk</span><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></button>
              </div>
            </MotionDiv>
          );
        })}
      </MotionDiv>
    </div>
  );
};
