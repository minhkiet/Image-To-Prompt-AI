import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { PromptDisplay } from './components/PromptDisplay';
import { SuggestionsDisplay } from './components/SuggestionsDisplay';
import { WhiskGuide } from './components/WhiskGuide';
import { HistoryList } from './components/HistoryList';
import { decodeImagePrompt, optimizePrompt, translateText } from './services/geminiService';
import { ImageFile, AppState, AnalysisResult, HistoryItem, PromptItem } from './types';

// Inline Skeleton Component for smoother state transitions
const SkeletonLoader = () => {
  const [loadingText, setLoadingText] = useState('Đang khởi tạo kết nối...');
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const steps = [
      'Đang khởi tạo kết nối với Gemini Vision...',
      'Đang quét chi tiết khuôn mặt và thần thái...',
      'Đang phân tích chất liệu trang phục và phụ kiện...',
      'Đang giải mã setup ánh sáng và bố cục...',
      'Đang trích xuất và dịch thuật văn bản (nếu có)...', // Added translation step
      'Đang tối ưu hóa Prompt lên mức độ 10/10...',       // Added optimization step
      'Đang hoàn thiện các biến thể...',
    ];
    
    let stepIndex = 0;
    
    // Rotate text messages every 2.5 seconds
    const textInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setLoadingText(steps[stepIndex]);
    }, 2500);

    // Simulate progress bar (asymptotic to 95%)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        // Slow down as it reaches higher percentages
        const increment = prev < 30 ? 2 : prev < 60 ? 1 : prev < 85 ? 0.5 : 0.1;
        const next = prev + increment;
        return next > 95 ? 95 : next;
      });
    }, 100);

    return () => {
      clearInterval(textInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="w-full bg-white rounded-[2.5rem] shadow-xl overflow-hidden border-2 border-white flex flex-col min-h-[400px]">
      {/* Header Skeleton */}
      <div className="bg-pink-50/50 px-8 py-6 border-b border-pink-100 flex items-center justify-between">
        <div className="h-6 bg-pink-100 rounded-full w-32 animate-pulse"></div>
        <div className="h-10 bg-pink-100 rounded-full w-24 animate-pulse"></div>
      </div>
      
      <div className="p-8 flex-grow flex flex-col justify-center items-center relative">
        {/* Background content skeletons (faded) */}
        <div className="w-full space-y-5 mb-12 opacity-30 blur-[1px]">
           <div className="h-5 bg-gray-100 rounded-full w-full"></div>
           <div className="h-5 bg-gray-100 rounded-full w-11/12"></div>
           <div className="h-5 bg-gray-100 rounded-full w-full"></div>
           <div className="h-5 bg-gray-100 rounded-full w-3/4"></div>
           <div className="h-5 bg-gray-100 rounded-full w-5/6"></div>
           <div className="h-5 bg-gray-100 rounded-full w-full"></div>
        </div>

        {/* Central Loading Indicator */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/60 backdrop-blur-sm">
          <div className="relative w-24 h-24 mb-6">
             {/* Outer spinning ring */}
             <div className="absolute inset-0 border-8 border-pink-100 rounded-full"></div>
             <div className="absolute inset-0 border-8 border-pink-400 rounded-full border-t-transparent animate-spin"></div>
             
             {/* Inner pulsing icon */}
             <div className="absolute inset-0 flex items-center justify-center">
                <img 
                  src="https://i.pinimg.com/736x/5c/7a/2d/5c7a2decdf0731e810f0c547f7d755d3.jpg" 
                  alt="Loading" 
                  className="w-16 h-16 rounded-full object-cover animate-bounce shadow-sm"
                />
             </div>
          </div>
          
          <div className="text-center space-y-4 max-w-sm px-4">
             <p className="text-gray-700 font-extrabold text-lg min-h-[28px] transition-all duration-300">
               {loadingText}
             </p>
             
             {/* Progress Bar */}
             <div className="w-64 h-3 bg-gray-100 rounded-full overflow-hidden mx-auto shadow-inner border border-gray-200">
               <div 
                 className="h-full bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300 transition-all duration-300 ease-out"
                 style={{ width: `${progress}%` }}
               />
             </div>
             
             <p className="text-xs text-gray-400 font-bold font-mono pt-1">
               AI Processing: {Math.floor(progress)}%
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ErrorDetails {
  title: string;
  message: string;
  suggestions: string[];
  type: 'safety' | 'network' | 'quota' | 'generic';
}

const App: React.FC = () => {
  const [image, setImage] = useState<ImageFile | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [promptCount, setPromptCount] = useState<number>(10);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [authorName, setAuthorName] = useState<string>('');
  
  const resultsRef = useRef<HTMLDivElement>(null);
  
  const MotionDiv = motion.div as any;

  // Helper to normalize prompt data (string -> object migration)
  const normalizePrompts = (prompts: any[]): PromptItem[] => {
    return prompts.map(p => {
      if (typeof p === 'string') {
        return { text: p, score: 0 };
      }
      return p;
    });
  };

  // Analyze raw error to provide better feedback
  const analyzeError = (error: any): ErrorDetails => {
    const msg = (error.message || JSON.stringify(error)).toLowerCase();

    // 1. Safety / Policy Violations
    if (msg.includes('safety') || msg.includes('blocked') || msg.includes('harmful') || msg.includes('sexually')) {
      return {
        title: "Nội dung bị từ chối",
        message: "AI phát hiện hình ảnh chứa nội dung nhạy cảm, bạo lực hoặc vi phạm chính sách an toàn của Google.",
        type: 'safety',
        suggestions: [
          "Thử một hình ảnh khác 'lành mạnh' hơn.",
          "Che bớt các vùng da thịt nhạy cảm hoặc yếu tố bạo lực (máu me, vũ khí).",
          "Đây là cơ chế an toàn tự động của AI, không phải lỗi hệ thống."
        ]
      };
    }

    // 2. Network / Connection
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('connection') || msg.includes('offline')) {
      return {
        title: "Lỗi kết nối mạng",
        message: "Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra đường truyền Internet của bạn.",
        type: 'network',
        suggestions: [
          "Kiểm tra kết nối Wifi hoặc 4G/5G.",
          "Tắt VPN hoặc Adblock nếu đang bật.",
          "Thử tải lại trang (F5) và thực hiện lại."
        ]
      };
    }

    // 3. Quota / Rate Limit
    if (msg.includes('429') || msg.includes('quota') || msg.includes('resource exhausted')) {
      return {
        title: "Hệ thống quá tải (Rate Limit)",
        message: "API Key đang bị giới hạn số lượng yêu cầu trong thời gian ngắn.",
        type: 'quota',
        suggestions: [
          "Vui lòng chờ khoảng 1-2 phút rồi thử lại.",
          "Hệ thống đang sử dụng gói miễn phí nên có giới hạn tần suất gọi.",
        ]
      };
    }
    
    // 4. Image Data Issues
    if (msg.includes('image') || msg.includes('format') || msg.includes('base64')) {
        return {
            title: "Lỗi dữ liệu hình ảnh",
            message: "Không thể đọc hoặc xử lý file ảnh này.",
            type: 'generic',
            suggestions: [
              "Đảm bảo ảnh là định dạng JPG, PNG hoặc WebP.",
              "Thử nén ảnh hoặc dùng ảnh có dung lượng nhỏ hơn (dưới 10MB).",
              "Chọn một ảnh khác để kiểm tra."
            ]
        };
    }

    // 5. Default Generic Error
    return {
      title: "Đã xảy ra lỗi không mong muốn",
      message: error.message || "Hệ thống gặp sự cố khi xử lý yêu cầu này.",
      type: 'generic',
      suggestions: [
        "Thử tải lại trang.",
        "Thử lại sau vài phút.",
        "Nếu lỗi vẫn tiếp diễn, có thể server đang bảo trì."
      ]
    };
  };

  // Load share URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('share');
    if (shareData) {
      try {
        const json = JSON.parse(decodeURIComponent(escape(atob(shareData))));
        if (json.p && Array.isArray(json.p)) {
          setAnalysisResult({
            prompts: normalizePrompts(json.p),
            suggestions: json.s || [],
            detectedTexts: json.t || []
          });
          setAppState(AppState.SUCCESS);
        }
      } catch (e) {
        console.error("Invalid share data", e);
        handleError(new Error("Liên kết chia sẻ không hợp lệ hoặc đã bị lỗi."));
      }
    }
  }, []);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('promptDecoderHistory');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        const normalized = parsed.map((item: any) => ({
           ...item,
           result: {
             ...item.result,
             prompts: normalizePrompts(item.result.prompts)
           }
        }));
        setHistory(normalized);
      }
    } catch (error) {
      console.error("Failed to load history", error);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('promptDecoderHistory', JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save history", error);
    }
  }, [history]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const addToHistory = (img: ImageFile, result: AnalysisResult) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      image: img,
      result: result
    };
    setHistory(prev => [newItem, ...prev].slice(0, 24));
  };

  const handleError = (error: any) => {
    const details = analyzeError(error);
    setErrorDetails(details);
    setAppState(AppState.ERROR);
  };

  const performAnalysis = async (img: ImageFile) => {
    setAppState(AppState.ANALYZING);
    setErrorDetails(null);

    try {
      // Step 1: Initial Analysis
      let result = await decodeImagePrompt(img.base64, img.mimeType, promptCount);

      // Step 2: Auto-Translate Detected Text to English (if any)
      if (result.detectedTexts && result.detectedTexts.length > 0) {
        try {
            const translatedTexts = await Promise.all(
                result.detectedTexts.map(text => translateText(text, 'en'))
            );
            
            // Replace the original detected text in the prompts with the translated English text
            result.prompts = result.prompts.map(p => {
                let newText = p.text;
                result.detectedTexts?.forEach((original, idx) => {
                   // Global replace of the detected text string
                   if (original && translatedTexts[idx]) {
                        // Escape special characters for regex if needed, or use simple split/join
                        newText = newText.split(original).join(translatedTexts[idx]);
                   }
                });
                return { ...p, text: newText };
            });

            // Update detectedTexts to the English versions so PromptDisplay highlights them correctly
            result.detectedTexts = translatedTexts;
        } catch (err) {
            console.warn("Auto-translation failed, proceeding with original text.", err);
        }
      }

      // Step 3: Auto-Optimize All Prompts to Score 10
      // We process ALL prompts to ensure they meet the 10/10 standard automatically
      try {
          const optimizedPrompts = await Promise.all(result.prompts.map(async (p) => {
             // Even if score is high, we pass it through optimization to ensure consistent "10/10" style
             // or simply keep existing logic if it's already 10. 
             // Request says "auto optimize... level 10". 
             // To be safe and fast, we skip if it is ALREADY 10, but usually initial decode is ~8-9.
             if ((p.score || 0) < 10) {
                 return await optimizePrompt(p.text);
             }
             return p;
          }));
          result.prompts = optimizedPrompts;
      } catch (err) {
          console.warn("Auto-optimization failed, proceeding with initial prompts.", err);
      }

      // Final Step: Set State
      setAnalysisResult(result);
      setAppState(AppState.SUCCESS);
      addToHistory(img, result);
      
      if (window.location.search.includes('share=')) {
        window.history.pushState({}, '', window.location.pathname);
      }
    } catch (error: any) {
      console.error("Analysis failed", error);
      handleError(error);
    }
  };

  const handleOptimize = async (index: number) => {
    if (!analysisResult) return;
    
    const originalItem = analysisResult.prompts[index];
    try {
        const optimizedItem = await optimizePrompt(originalItem.text);
        
        const newPrompts = [...analysisResult.prompts];
        newPrompts[index] = optimizedItem;
        
        const newResult = {
            ...analysisResult,
            prompts: newPrompts
        };
        
        setAnalysisResult(newResult);
        
        // Update History to save the optimization
        setHistory(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            if (updated[0] && updated[0].result.prompts.length === newPrompts.length) { 
                 updated[0] = { ...updated[0], result: newResult };
            }
            return updated;
        });

    } catch (e: any) {
        alert(e.message || "Tối ưu hóa thất bại");
    }
  };

  const handleOptimizeAll = async () => {
    if (!analysisResult) return;

    const currentPrompts = analysisResult.prompts;
    const indexesToOptimize: number[] = [];

    // Identify prompts that need optimization (Score < 10)
    currentPrompts.forEach((p, idx) => {
        if ((p.score || 0) < 10) {
            indexesToOptimize.push(idx);
        }
    });

    if (indexesToOptimize.length === 0) return;

    try {
        const promises = indexesToOptimize.map(async (index) => {
             const originalItem = currentPrompts[index];
             try {
                 const optimizedItem = await optimizePrompt(originalItem.text);
                 return { index, item: optimizedItem };
             } catch (e) {
                 console.warn(`Failed to optimize prompt at index ${index}`, e);
                 return { index, item: originalItem }; // Keep original on failure
             }
        });

        const results = await Promise.all(promises);

        const newPrompts = [...currentPrompts];
        results.forEach(({ index, item }) => {
            newPrompts[index] = item;
        });

        const newResult = {
            ...analysisResult,
            prompts: newPrompts
        };

        setAnalysisResult(newResult);

        // Update History
        setHistory(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            if (updated[0] && updated[0].result.prompts.length === newPrompts.length) {
                updated[0] = { ...updated[0], result: newResult };
            }
            return updated;
        });

    } catch (e: any) {
        console.error("Bulk optimization failed", e);
        alert("Có lỗi xảy ra khi tối ưu hóa hàng loạt. Vui lòng thử lại.");
    }
  };

  const handleImageSelected = (selectedImage: ImageFile) => {
    setImage(selectedImage);
    setAnalysisResult(null);
    setErrorDetails(null);
    performAnalysis(selectedImage);
  };

  const handleReset = () => {
    setImage(null);
    setAppState(AppState.IDLE);
    setAnalysisResult(null);
    setErrorDetails(null);
    if (window.location.search.includes('share=')) {
      window.history.pushState({}, '', window.location.pathname);
    }
  };

  const handleRetry = () => {
    if (!image) return;
    performAnalysis(image);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setImage(item.image);
    setAnalysisResult({
        ...item.result,
        prompts: normalizePrompts(item.result.prompts)
    });
    setAppState(AppState.SUCCESS);
    setErrorDetails(null);
    if (window.location.search.includes('share=')) {
        window.history.pushState({}, '', window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearHistory = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử không?")) {
      setHistory([]);
    }
  };

  // Logic to determine view state
  const isSharedMode = !image && analysisResult !== null;
  const showResultsView = !!(image || isSharedMode);
  const showHomeView = !showResultsView;

  // Render Error Box Component
  const ErrorDisplay = ({ details }: { details: ErrorDetails }) => {
     const isSafety = details.type === 'safety';
     const isNetwork = details.type === 'network';
     const isQuota = details.type === 'quota';

     let icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
     );

     if (isSafety) {
         icon = (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
         );
     } else if (isNetwork) {
         icon = (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
             </svg>
         );
     } else if (isQuota) {
         icon = (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
         );
     }

     return (
        <MotionDiv 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full bg-white rounded-[2.5rem] p-6 shadow-xl border-2 flex flex-col gap-4
                ${isSafety ? 'border-amber-200' : 'border-red-200'}
            `}
        >
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full shrink-0 ${isSafety ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                    {icon}
                </div>
                <div className="flex-grow">
                    <h3 className="text-lg font-extrabold text-gray-800">{details.title}</h3>
                    <p className={`${isSafety ? 'text-amber-800' : 'text-red-700'} font-medium mt-1 leading-relaxed`}>
                        {details.message}
                    </p>
                </div>
            </div>
            
            <div className={`rounded-2xl p-5 text-sm ${isSafety ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-gray-700'}`}>
                <p className="font-extrabold mb-3 uppercase text-xs tracking-wider opacity-70">Gợi ý khắc phục:</p>
                <ul className="space-y-2">
                    {details.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0"></span>
                            <span>{suggestion}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                    onClick={handleRetry} 
                    className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-extrabold rounded-full shadow-lg shadow-red-200 transition-all active:scale-95 flex justify-center items-center gap-2 border-b-4 border-red-700"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.279a1 1 0 11-2 0V12.9a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    Thử lại ngay
                </button>
                <button 
                    onClick={handleReset} 
                    className="flex-1 py-3.5 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-extrabold rounded-full transition-all active:scale-95 flex justify-center items-center gap-2 border-b-4"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Chọn ảnh khác
                </button>
            </div>
        </MotionDiv>
     );
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-pink-100 selection:text-pink-600 relative">
      <div className="flex-grow w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Header />

        <div className="mt-8 mb-12 relative min-h-[400px]">
          <AnimatePresence mode="wait" initial={false}>
            {showHomeView ? (
              <MotionDiv
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="max-w-3xl mx-auto flex flex-col gap-6"
              >
                {/* Configuration Panel */}
                <div className="bg-white rounded-[2rem] p-5 shadow-sm border-2 border-white flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 text-blue-500 rounded-full border border-blue-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-gray-700 text-lg">Số lượng Prompt</h3>
                      <p className="text-xs text-gray-400 font-bold">Càng nhiều càng vui!</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-full border border-gray-100 shadow-inner">
                    <button 
                      onClick={() => setPromptCount(Math.max(1, promptCount - 1))}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-gray-500 shadow-md hover:bg-gray-100 hover:text-pink-500 disabled:opacity-50 transition-all"
                      disabled={promptCount <= 1}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                      </svg>
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={promptCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          setPromptCount(val);
                        }
                      }}
                      className="w-12 text-center font-black text-xl text-gray-700 bg-transparent outline-none appearance-none"
                      aria-label="Nhập số lượng prompt"
                    />
                    <button 
                      onClick={() => setPromptCount(promptCount + 1)}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-gray-500 shadow-md hover:bg-gray-100 hover:text-pink-500 transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="transform transition-all duration-500 hover:-translate-y-1">
                  <ImageUploader onImageSelected={handleImageSelected} onError={handleError} />
                </div>

                {/* Home View Error Display (e.g. upload failed) */}
                {appState === AppState.ERROR && errorDetails && !image && (
                   <MotionDiv 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-red-50 border-2 border-red-100 rounded-[2rem] p-6 flex flex-col gap-3 shadow-sm"
                   >
                      <div className="flex items-start gap-3">
                        <div className="p-3 bg-red-100 rounded-full text-red-600 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-800">{errorDetails.title}</h3>
                            <p className="text-gray-600 mt-1 font-medium">{errorDetails.message}</p>
                        </div>
                      </div>
                      
                      {/* Suggestion list for home error */}
                      <div className="pl-14">
                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-500 font-medium">
                             {errorDetails.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                   </MotionDiv>
                )}

                <HistoryList 
                  history={history} 
                  onSelect={handleSelectHistory} 
                  onClear={handleClearHistory} 
                />
              </MotionDiv>
            ) : (
              <MotionDiv
                key="results"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-10"
              >
                {/* Top: Image Preview or Shared Placeholder */}
                <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
                  {image ? (
                      <div className="bg-white rounded-[2.5rem] p-3 shadow-xl border-4 border-white group relative overflow-hidden">
                      <div className="aspect-square rounded-[2rem] overflow-hidden bg-gray-100 relative shadow-inner">
                          <img 
                          src={image.previewUrl} 
                          alt="Uploaded preview" 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          
                          {appState !== AppState.ANALYZING && (
                          <button 
                              onClick={handleReset}
                              className="absolute top-4 right-4 bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-50 p-2.5 rounded-full shadow-lg backdrop-blur-sm transition-all transform hover:rotate-90 z-10 border-2 border-white"
                              title="Xóa ảnh"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                          </button>
                          )}

                          {appState !== AppState.ANALYZING && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                              <button 
                              onClick={handleReset}
                              className="bg-white text-gray-800 px-8 py-3 rounded-full text-base font-extrabold shadow-2xl hover:bg-gray-50 transition-all transform hover:scale-105"
                              >
                              Chọn ảnh khác
                              </button>
                          </div>
                          )}
                      </div>
                      </div>
                  ) : (
                      /* Shared View Placeholder */
                     !image && isSharedMode && (
                          <div className="bg-white rounded-[2.5rem] p-8 text-center border-4 border-white shadow-xl animate-fade-in flex flex-col items-center gap-4">
                              <div className="w-24 h-24 bg-purple-100 text-purple-500 rounded-full flex items-center justify-center shadow-inner border-4 border-purple-50">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                  </svg>
                              </div>
                              <div>
                                  <h3 className="text-xl font-black text-gray-800 mb-2">Kết quả được chia sẻ</h3>
                                  <p className="text-gray-500 text-sm max-w-xs mx-auto font-medium">
                                      Bạn đang xem prompt từ liên kết chia sẻ. Hình ảnh gốc không được lưu trữ trong liên kết này.
                                  </p>
                              </div>
                              <button 
                                  onClick={handleReset}
                                  className="mt-4 bg-purple-500 text-white px-8 py-3 rounded-full font-bold hover:bg-purple-600 transition-colors shadow-lg shadow-purple-200 hover:shadow-xl active:scale-95"
                              >
                                  Tạo prompt mới của bạn
                              </button>
                          </div>
                     )
                  )}
                  
                   {/* Main Results View Error Display */}
                   {appState === AppState.ERROR && errorDetails && (
                      <ErrorDisplay details={errorDetails} />
                   )}
                </div>

                {/* Bottom: Results or Loading */}
                <div className="w-full" ref={resultsRef}>
                   {/* IDLE state placeholder removed as we usually jump to analyzing immediately */}

                   {appState === AppState.ANALYZING && <SkeletonLoader />}

                   {appState === AppState.SUCCESS && analysisResult && (
                     <div className="flex flex-col gap-6">
                       <PromptDisplay 
                          prompts={analysisResult.prompts} 
                          suggestions={analysisResult.suggestions}
                          detectedTexts={analysisResult.detectedTexts}
                          onOptimize={handleOptimize}
                          onOptimizeAll={handleOptimizeAll}
                          authorName={authorName}
                       />
                       <SuggestionsDisplay suggestions={analysisResult.suggestions} />
                       <WhiskGuide />
                       <button 
                          onClick={handleReset} 
                          className="md:hidden w-full py-4 bg-white border-2 border-gray-100 text-gray-500 rounded-full font-bold shadow-sm active:bg-gray-50 uppercase tracking-wide"
                        >
                          Giải mã ảnh khác
                        </button>
                     </div>
                   )}
                </div>
              </MotionDiv>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Enhanced Footer */}
      <footer className="py-8 border-t border-white/50 bg-white/40 backdrop-blur-md mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-gray-400 text-xs font-bold">@2025 Trợ Lý Bé Điệu ✨</p>
        </div>
      </footer>

      {/* Floating Action Group (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Scroll to Top Button */}
        <AnimatePresence>
            {showScrollTop && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    onClick={scrollToTop}
                    className="p-3 bg-white/90 backdrop-blur-md border-2 border-pink-200 text-pink-500 rounded-full shadow-lg hover:bg-pink-500 hover:text-white hover:shadow-pink-300 transition-all duration-300 transform active:scale-95"
                    aria-label="Cuộn lên đầu trang"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                </motion.button>
            )}
        </AnimatePresence>

        {/* Floating Author Input */}
        <div className="relative group">
           <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse-slow"></div>
           <div className="relative flex items-center bg-white/95 backdrop-blur-md rounded-full border-2 border-pink-200 shadow-xl transition-all hover:border-pink-400">
              <div className="pl-4 text-pink-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
              </div>
              <input
                 type="text"
                 value={authorName}
                 onChange={(e) => setAuthorName(e.target.value)}
                 placeholder="Tên tác giả..."
                 className="p-3 text-gray-700 rounded-full bg-transparent outline-none font-bold placeholder-pink-300 w-32 focus:w-64 transition-all duration-300 font-sans text-sm focus:placeholder-pink-200"
                 aria-label="Nhập tên tác giả để thêm vào prompt"
              />
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;