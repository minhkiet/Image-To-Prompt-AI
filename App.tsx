import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { PromptDisplay } from './components/PromptDisplay';
import { SuggestionsDisplay } from './components/SuggestionsDisplay';
import { WhiskGuide } from './components/WhiskGuide';
import { HistoryList } from './components/HistoryList';
import { decodeImagePrompt } from './services/geminiService';
import { ImageFile, AppState, AnalysisResult, HistoryItem } from './types';

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
      'Đang xác định thông số máy ảnh và ống kính...',
      'Đang tổng hợp dữ liệu để viết prompt...',
      'Đang tạo các biến thể góc chụp sáng tạo...',
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
    <div className="w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col min-h-[400px]">
      {/* Header Skeleton */}
      <div className="bg-gray-50/50 px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="h-6 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
        <div className="h-9 bg-gray-200 rounded-xl w-24 animate-pulse"></div>
      </div>
      
      <div className="p-8 flex-grow flex flex-col justify-center items-center relative">
        {/* Background content skeletons (faded) */}
        <div className="w-full space-y-4 mb-12 opacity-30 blur-[1px]">
           <div className="h-4 bg-gray-200 rounded w-full"></div>
           <div className="h-4 bg-gray-200 rounded w-11/12"></div>
           <div className="h-4 bg-gray-200 rounded w-full"></div>
           <div className="h-4 bg-gray-200 rounded w-3/4"></div>
           <div className="h-4 bg-gray-200 rounded w-5/6"></div>
           <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>

        {/* Central Loading Indicator */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/50 backdrop-blur-sm">
          <div className="relative w-20 h-20 mb-6">
             {/* Outer spinning ring */}
             <div className="absolute inset-0 border-4 border-purple-100 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
             
             {/* Inner pulsing icon */}
             <div className="absolute inset-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
             </div>
          </div>
          
          <div className="text-center space-y-3 max-w-sm px-4">
             <p className="text-gray-800 font-bold text-lg min-h-[28px] transition-all duration-300">
               {loadingText}
             </p>
             
             {/* Progress Bar */}
             <div className="w-64 h-2 bg-gray-100 rounded-full overflow-hidden mx-auto shadow-inner">
               <div 
                 className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 transition-all duration-300 ease-out"
                 style={{ width: `${progress}%` }}
               />
             </div>
             
             <p className="text-xs text-gray-400 font-mono pt-1">
               AI Processing: {Math.floor(progress)}%
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [image, setImage] = useState<ImageFile | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [promptCount, setPromptCount] = useState<number>(4);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load share URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('share');
    if (shareData) {
      try {
        const json = JSON.parse(decodeURIComponent(escape(atob(shareData))));
        if (json.p && Array.isArray(json.p)) {
          setAnalysisResult({
            prompts: json.p,
            suggestions: json.s || []
          });
          setAppState(AppState.SUCCESS);
          // Don't set image, as we don't have it
        }
      } catch (e) {
        console.error("Invalid share data", e);
        setErrorMsg("Liên kết chia sẻ không hợp lệ hoặc đã bị lỗi.");
      }
    }
  }, []);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('promptDecoderHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
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

  // Scroll visibility handler
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
    
    // Keep only the last 24 items
    setHistory(prev => [newItem, ...prev].slice(0, 24));
  };

  const handleError = (msg: string) => {
    setErrorMsg(msg);
    setAppState(AppState.ERROR);
  };

  const performAnalysis = async (img: ImageFile) => {
    setAppState(AppState.ANALYZING);
    setErrorMsg('');

    try {
      const result = await decodeImagePrompt(img.base64, img.mimeType, promptCount);
      setAnalysisResult(result);
      setAppState(AppState.SUCCESS);
      addToHistory(img, result);
      
      // Clear share param from URL if we start a new analysis
      if (window.location.search.includes('share=')) {
        window.history.pushState({}, '', window.location.pathname);
      }
    } catch (error: any) {
      console.error("Analysis failed", error);
      handleError(error.message || "Không thể phân tích hình ảnh. Vui lòng thử lại.");
    }
  };

  const handleImageSelected = (selectedImage: ImageFile) => {
    setImage(selectedImage);
    setAnalysisResult(null);
    setErrorMsg('');
    performAnalysis(selectedImage);
  };

  const handleReset = () => {
    setImage(null);
    setAppState(AppState.IDLE);
    setAnalysisResult(null);
    setErrorMsg('');
    // Clear share URL
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
    setAnalysisResult(item.result);
    setAppState(AppState.SUCCESS);
    setErrorMsg('');
    // Clear share URL
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

  // Auto-scroll to results when success
  useEffect(() => {
    if ((appState === AppState.SUCCESS || appState === AppState.ERROR) && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [appState]);

  // Logic to determine view state
  // Shared View = No Image AND Has Analysis Result
  const isSharedMode = !image && analysisResult !== null;
  const showUploader = !image && !isSharedMode;
  const showResultsContainer = image || isSharedMode || appState === AppState.ERROR;

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-purple-200 selection:text-purple-900 relative">
      <div className="flex-grow w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Header />

        <div className="mt-8 mb-12">
          {/* Upload Section (Full Width when no image and not sharing) */}
          {showUploader && (
            <div className="max-w-3xl mx-auto flex flex-col gap-6 animate-fade-in-up">
              {/* Configuration Panel */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Số lượng Prompt</h3>
                    <p className="text-xs text-gray-500">Tạo nhiều biến thể dựa trên phong cách gốc</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                  <button 
                    onClick={() => setPromptCount(Math.max(1, promptCount - 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    disabled={promptCount <= 1}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
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
                    className="w-12 text-center font-bold text-gray-800 bg-transparent outline-none appearance-none focus:ring-2 focus:ring-purple-100 rounded-md py-0.5"
                    aria-label="Nhập số lượng prompt"
                  />
                  <button 
                    onClick={() => setPromptCount(promptCount + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:bg-gray-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="transform transition-all duration-500 hover:-translate-y-1">
                <ImageUploader onImageSelected={handleImageSelected} onError={handleError} />
              </div>

              {/* Error Message Display (Only when IDLE but error exists - e.g., upload failed) */}
              {appState === AppState.ERROR && !image && (
                 <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex flex-col md:flex-row items-start gap-4 shadow-sm animate-fade-in">
                    <div className="p-3 bg-red-100 rounded-xl text-red-600 shrink-0">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                       </svg>
                    </div>
                    <div>
                       <h3 className="text-lg font-bold text-gray-900">Không thể tải ảnh lên</h3>
                       <p className="text-gray-600 mt-1">{errorMsg}</p>
                       <p className="text-sm text-gray-500 mt-2">Gợi ý: Hãy thử ảnh định dạng JPG/PNG và dung lượng dưới 10MB.</p>
                    </div>
                 </div>
              )}
            </div>
          )}

          {/* Stacked Layout when image is present OR in shared mode */}
          {showResultsContainer && (
            <div className="flex flex-col gap-10 animate-fade-in-up">
              {/* Top: Image Preview or Shared Placeholder */}
              <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
                {image ? (
                    <div className="bg-white rounded-[2rem] p-3 shadow-xl border border-gray-100 group relative overflow-hidden">
                    <div className="aspect-square rounded-[1.5rem] overflow-hidden bg-gray-100 relative">
                        <img 
                        src={image.previewUrl} 
                        alt="Uploaded preview" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        
                        {appState !== AppState.ANALYZING && (
                        <button 
                            onClick={handleReset}
                            className="absolute top-4 right-4 bg-white/90 hover:bg-red-50 text-gray-500 hover:text-red-500 p-2 rounded-full shadow-lg backdrop-blur-sm transition-all transform hover:rotate-90 z-10"
                            title="Xóa ảnh"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        )}

                        {appState !== AppState.ANALYZING && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                            <button 
                            onClick={handleReset}
                            className="bg-white text-gray-900 px-6 py-2.5 rounded-full text-sm font-bold shadow-2xl hover:bg-gray-50 transition-all transform hover:scale-105"
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
                        <div className="bg-white rounded-[2rem] p-8 text-center border border-gray-100 shadow-lg animate-fade-in flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Kết quả được chia sẻ</h3>
                                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                                    Bạn đang xem prompt từ liên kết chia sẻ. Hình ảnh gốc không được lưu trữ trong liên kết này.
                                </p>
                            </div>
                            <button 
                                onClick={handleReset}
                                className="mt-2 bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-md hover:shadow-lg active:scale-95"
                            >
                                Tạo prompt mới của bạn
                            </button>
                        </div>
                   )
                )}
                
                 {appState === AppState.ERROR && image && (
                    <div className="w-full bg-white rounded-3xl p-6 shadow-xl border border-red-100 flex flex-col gap-4 animate-fade-in ring-1 ring-red-50">
                      <div className="flex items-start gap-4">
                         <div className="p-3 bg-red-100 rounded-xl text-red-600 shrink-0">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                           </svg>
                         </div>
                         <div className="flex-grow">
                           <h3 className="text-lg font-bold text-gray-900">Rất tiếc, đã xảy ra lỗi!</h3>
                           <p className="text-red-600 font-medium mt-1">{errorMsg}</p>
                         </div>
                      </div>
                      
                      <div className="bg-red-50 rounded-xl p-4 text-sm text-gray-700">
                        <p className="font-bold mb-2">Các giải pháp khắc phục:</p>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                          <li>Kiểm tra lại kết nối mạng Internet.</li>
                          <li>Đảm bảo ảnh không chứa nội dung nhạy cảm, bạo lực (AI sẽ từ chối xử lý).</li>
                          <li>Nếu ảnh quá mờ hoặc quá tối, hãy thử ảnh chất lượng tốt hơn.</li>
                          <li>Thử tải lại trang và thực hiện lại.</li>
                        </ul>
                      </div>

                      <button 
                        onClick={handleRetry} 
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95 flex justify-center items-center gap-2"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.279a1 1 0 11-2 0V12.9a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                         </svg>
                         Thử lại ngay
                      </button>
                    </div>
                 )}
              </div>

              {/* Bottom: Results or Loading */}
              <div className="w-full" ref={resultsRef}>
                 {/* IDLE state placeholder removed as we usually jump to analyzing immediately */}

                 {appState === AppState.ANALYZING && <SkeletonLoader />}

                 {appState === AppState.SUCCESS && analysisResult && (
                   <div className="flex flex-col gap-6 animate-fade-in-up">
                     <PromptDisplay 
                        prompts={analysisResult.prompts} 
                        suggestions={analysisResult.suggestions}
                     />
                     <SuggestionsDisplay suggestions={analysisResult.suggestions} />
                     <WhiskGuide />
                     <button 
                        onClick={handleReset} 
                        className="md:hidden w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-medium shadow-sm active:bg-gray-50"
                      >
                        Giải mã ảnh khác
                      </button>
                   </div>
                 )}
              </div>
            </div>
          )}

          {/* History Section - Always visible unless empty or in shared mode */}
          {(!image && !isSharedMode) && (
            <HistoryList 
              history={history} 
              onSelect={handleSelectHistory} 
              onClear={handleClearHistory} 
            />
          )}
        </div>
      </div>
      
      {/* Enhanced Footer */}
      <footer className="py-8 border-t border-gray-100 bg-white/60 backdrop-blur-sm mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-gray-400 text-xs">@2025 Trợ Lý Bé Điệu</p>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 p-3 bg-white/80 backdrop-blur-md border border-purple-100 text-purple-600 rounded-full shadow-lg hover:bg-purple-600 hover:text-white hover:shadow-purple-200 transition-all duration-300 transform hover:scale-110 active:scale-95 animate-fade-in"
          aria-label="Cuộn lên đầu trang"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default App;