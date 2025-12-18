
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { PromptDisplay } from './components/PromptDisplay';
import { SuggestionsDisplay } from './components/SuggestionsDisplay';
import { WhiskGuide } from './components/WhiskGuide';
import { HistoryList } from './components/HistoryList';
import { ImageInspector } from './components/ImageInspector';
import { decodeImagePrompt, optimizePrompt, translateText, wait } from './services/geminiService';
import { ImageFile, AppState, AnalysisResult, HistoryItem, PromptItem } from './types';

// Inline Skeleton Component for smoother state transitions
const SkeletonLoader = () => {
  const [loadingText, setLoadingText] = useState('Đang khởi tạo kết nối...');
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const steps = [
      'Đang phân tích khuôn mặt & trang phục...',
      'Đang trích xuất prompt chuẩn Art Director...',
      'Đang hoàn thiện các biến thể...',
    ];
    
    let stepIndex = 0;
    
    const textInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setLoadingText(steps[stepIndex]);
    }, 1200);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const increment = prev < 50 ? 8 : prev < 80 ? 4 : 2;
        const next = prev + increment;
        return next > 98 ? 98 : next;
      });
    }, 150);

    return () => {
      clearInterval(textInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="w-full bg-white rounded-[2.5rem] shadow-xl overflow-hidden border-2 border-white flex flex-col min-h-[400px]">
      <div className="bg-pink-50/50 px-8 py-6 border-b border-pink-100 flex items-center justify-between">
        <div className="h-6 bg-pink-100 rounded-full w-32 animate-pulse"></div>
        <div className="h-10 bg-pink-100 rounded-full w-24 animate-pulse"></div>
      </div>
      
      <div className="p-8 flex-grow flex flex-col justify-center items-center relative">
        <div className="w-full space-y-5 mb-12 opacity-30 blur-[1px]">
           <div className="h-5 bg-gray-100 rounded-full w-full"></div>
           <div className="h-5 bg-gray-100 rounded-full w-11/12"></div>
           <div className="h-5 bg-gray-100 rounded-full w-full"></div>
           <div className="h-5 bg-gray-100 rounded-full w-3/4"></div>
           <div className="h-5 bg-gray-100 rounded-full w-5/6"></div>
           <div className="h-5 bg-gray-100 rounded-full w-full"></div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/60 backdrop-blur-sm">
          <div className="relative w-24 h-24 mb-6">
             <div className="absolute inset-0 border-8 border-pink-100 rounded-full"></div>
             <div className="absolute inset-0 border-8 border-pink-400 rounded-full border-t-transparent animate-spin" style={{ animationDuration: '0.6s' }}></div>
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
             <div className="w-64 h-3 bg-gray-100 rounded-full overflow-hidden mx-auto shadow-inner border border-gray-200">
               <div 
                 className="h-full bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300 transition-all duration-100 ease-linear"
                 style={{ width: `${progress}%` }}
               />
             </div>
             <p className="text-xs text-gray-400 font-bold font-mono pt-1">
               Fast Processing: {Math.floor(progress)}%
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

  const normalizePrompts = (prompts: any[]): PromptItem[] => {
    return prompts.map(p => {
      if (typeof p === 'string') {
        return { text: p, score: 0 };
      }
      return p;
    });
  };

  const analyzeError = (error: any): ErrorDetails => {
    const msg = (error.message || JSON.stringify(error)).toLowerCase();
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

  useEffect(() => {
    try {
      localStorage.setItem('promptDecoderHistory', JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save history", error);
    }
  }, [history]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) setShowScrollTop(true);
      else setShowScrollTop(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      let result = await decodeImagePrompt(img.base64, img.mimeType, promptCount);
      if (result.detectedTexts && result.detectedTexts.length > 0) {
        try {
            const translationPromises = result.detectedTexts.map(async (text) => {
                try {
                    return await translateText(text, 'en');
                } catch (e) {
                    return text;
                }
            });
            const translatedTexts = await Promise.all(translationPromises);
            result.prompts = result.prompts.map(p => {
                let newText = p.text;
                result.detectedTexts?.forEach((original, idx) => {
                   if (original && translatedTexts[idx]) {
                        newText = newText.split(original).join(translatedTexts[idx]);
                   }
                });
                return { ...p, text: newText };
            });
            result.detectedTexts = translatedTexts;
        } catch (err) {
            console.warn("Auto-translation failed", err);
        }
      }
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
        const newResult = { ...analysisResult, prompts: newPrompts };
        setAnalysisResult(newResult);
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
    currentPrompts.forEach((p, idx) => { if ((p.score || 0) < 10) indexesToOptimize.push(idx); });
    if (indexesToOptimize.length === 0) return;
    try {
        const newPrompts = [...currentPrompts];
        const batchSize = 3;
        for (let i = 0; i < indexesToOptimize.length; i += batchSize) {
            const batch = indexesToOptimize.slice(i, i + batchSize);
            await Promise.all(batch.map(async (index) => {
                 try {
                     const originalItem = currentPrompts[index];
                     const optimizedItem = await optimizePrompt(originalItem.text);
                     newPrompts[index] = optimizedItem;
                 } catch (e) {
                     console.warn(`Failed to optimize prompt at index ${index}`);
                 }
            }));
            if (i + batchSize < indexesToOptimize.length) await wait(1000);
        }
        const newResult = { ...analysisResult, prompts: newPrompts };
        setAnalysisResult(newResult);
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
        alert("Có lỗi xảy ra khi tối ưu hóa hàng loạt. Vui lòng thử lại sau.");
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
    setAnalysisResult({ ...item.result, prompts: normalizePrompts(item.result.prompts) });
    setAppState(AppState.SUCCESS);
    setErrorDetails(null);
    if (window.location.search.includes('share=')) window.history.pushState({}, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearHistory = () => { if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử không?")) setHistory([]); };

  const isSharedMode = !image && analysisResult !== null;
  const showResultsView = !!(image || isSharedMode);
  const showHomeView = !showResultsView;

  const ErrorDisplay = ({ details }: { details: ErrorDetails }) => {
     const isSafety = details.type === 'safety';
     const isNetwork = details.type === 'network';
     const isQuota = details.type === 'quota';
     let icon = ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> </svg> );
     if (isSafety) icon = ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /> </svg> );
     else if (isNetwork) icon = ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" /> </svg> );
     else if (isQuota) icon = ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> </svg> );

     return (
        <MotionDiv initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`w-full bg-white rounded-[2.5rem] p-6 shadow-xl border-2 flex flex-col gap-4 ${isSafety ? 'border-amber-200' : 'border-red-200'}`} >
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full shrink-0 ${isSafety ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}> {icon} </div>
                <div className="flex-grow">
                    <h3 className="text-lg font-extrabold text-gray-800">{details.title}</h3>
                    <p className={`${isSafety ? 'text-amber-800' : 'text-red-700'} font-medium mt-1 leading-relaxed`}> {details.message} </p>
                </div>
            </div>
            <div className={`rounded-2xl p-5 text-sm ${isSafety ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-gray-700'}`}>
                <p className="font-extrabold mb-3 uppercase text-xs tracking-wider opacity-70">Gợi ý khắc phục:</p>
                <ul className="space-y-2"> {details.suggestions.map((suggestion, idx) => ( <li key={idx} className="flex items-start gap-2"> <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0"></span> <span>{suggestion}</span> </li> ))} </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button onClick={handleRetry} className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-extrabold rounded-full shadow-lg shadow-red-200 transition-all active:scale-95 flex justify-center items-center gap-2 border-b-4 border-red-700" > Thử lại ngay </button>
                <button onClick={handleReset} className="flex-1 py-3.5 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-extrabold rounded-full transition-all active:scale-95 flex justify-center items-center gap-2 border-b-4" > Chọn ảnh khác </button>
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
              <MotionDiv key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3, ease: "easeOut" }} className="max-w-3xl mx-auto flex flex-col gap-6" >
                <div className="bg-white rounded-[2rem] p-5 shadow-sm border-2 border-white flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 text-blue-500 rounded-full border border-blue-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /> </svg>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-gray-700 text-lg">Số lượng Prompt</h3>
                      <p className="text-xs text-gray-400 font-bold">Càng nhiều càng vui!</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-full border border-gray-100 shadow-inner">
                    <button onClick={() => setPromptCount(Math.max(1, promptCount - 1))} className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-gray-500 shadow-md hover:bg-gray-100 hover:text-pink-500 disabled:opacity-50 transition-all" disabled={promptCount <= 1} >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /> </svg>
                    </button>
                    <input type="number" min="1" value={promptCount} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val > 0) setPromptCount(val); }} className="w-12 text-center font-black text-xl text-gray-700 bg-transparent outline-none appearance-none" aria-label="Nhập số lượng prompt" />
                    <button onClick={() => setPromptCount(promptCount + 1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-gray-500 shadow-md hover:bg-gray-100 hover:text-pink-500 transition-all" >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /> </svg>
                    </button>
                  </div>
                </div>
                <div className="transform transition-all duration-500 hover:-translate-y-1"> <ImageUploader onImageSelected={handleImageSelected} onError={handleError} /> </div>
                {appState === AppState.ERROR && errorDetails && !image && (
                   <MotionDiv initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-red-50 border-2 border-red-100 rounded-[2rem] p-6 flex flex-col gap-3 shadow-sm" >
                      <div className="flex items-start gap-3">
                        <div className="p-3 bg-red-100 rounded-full text-red-600 shrink-0"> <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> </svg> </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-800">{errorDetails.title}</h3>
                            <p className="text-gray-600 mt-1 font-medium">{errorDetails.message}</p>
                        </div>
                      </div>
                      <div className="pl-14"> <ul className="list-disc pl-5 space-y-1 text-sm text-gray-500 font-medium"> {errorDetails.suggestions.map((s, i) => <li key={i}>{s}</li>)} </ul> </div>
                   </MotionDiv>
                )}
                <HistoryList history={history} onSelect={handleSelectHistory} onClear={handleClearHistory} />
              </MotionDiv>
            ) : (
              <MotionDiv key="results" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3, ease: "easeOut" }} className="flex flex-col gap-10" >
                {/* Enhanced Image Inspector */}
                {image ? (
                    <div className="animate-fade-in">
                      <ImageInspector 
                        src={image.previewUrl} 
                        onReset={appState !== AppState.ANALYZING ? handleReset : undefined} 
                      />
                    </div>
                ) : (
                   !image && isSharedMode && (
                        <div className="w-full max-w-lg mx-auto bg-white rounded-[2.5rem] p-8 text-center border-4 border-white shadow-xl animate-fade-in flex flex-col items-center gap-4">
                            <div className="w-24 h-24 bg-purple-100 text-purple-500 rounded-full flex items-center justify-center shadow-inner border-4 border-purple-50">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-6" /> </svg>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-gray-800 mb-2">Kết quả được chia sẻ</h3>
                                <p className="text-gray-500 max-w-xs mx-auto"> Đây là các prompt đã được giải mã từ trước. </p>
                            </div>
                            <button onClick={handleReset} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full shadow-lg transition-all transform active:scale-95" > Bắt đầu phân tích mới </button>
                        </div>
                    )
                )}

                {appState === AppState.ANALYZING && <SkeletonLoader />}
                {appState === AppState.ERROR && errorDetails && <ErrorDisplay details={errorDetails} />}
                {appState === AppState.SUCCESS && analysisResult && (
                  <div className="animate-fade-in-up">
                    <div ref={resultsRef} className="space-y-6">
                      <PromptDisplay prompts={analysisResult.prompts} suggestions={analysisResult.suggestions} detectedTexts={analysisResult.detectedTexts} authorName={authorName} onOptimize={handleOptimize} onOptimizeAll={handleOptimizeAll} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SuggestionsDisplay suggestions={analysisResult.suggestions} />
                        <WhiskGuide />
                      </div>
                    </div>
                    <div className="mt-12 text-center pb-12"> <button onClick={handleReset} className="bg-white border-2 border-gray-100 hover:border-pink-200 hover:text-pink-600 text-gray-500 px-8 py-3 rounded-full font-bold shadow-sm hover:shadow-md transition-all transform active:scale-95" > ✨ Phân tích ảnh khác </button> </div>
                  </div>
                )}
              </MotionDiv>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence> {showScrollTop && ( <motion.button initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} onClick={scrollToTop} className="fixed bottom-6 right-6 p-4 bg-white/80 backdrop-blur-md border-2 border-pink-100 text-pink-500 rounded-full shadow-xl hover:shadow-2xl hover:scale-110 hover:-translate-y-1 transition-all z-50 group" > <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /> </svg> </motion.button> )} </AnimatePresence>
    </div>
  );
};

export default App;
