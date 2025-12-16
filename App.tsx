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
  const [loadingText, setLoadingText] = useState('Đang khởi tạo...');
  
  useEffect(() => {
    const texts = [
      'Đang phân tích cấu trúc ảnh...',
      'Đang nhận diện chủ thể...',
      'Đang xác định phong cách nghệ thuật...',
      'Đang tổng hợp ánh sáng và màu sắc...',
      'Đang viết prompt và các biến thể...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      setLoadingText(texts[i % texts.length]);
      i++;
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-pulse flex flex-col min-h-[300px]">
      <div className="bg-gray-50/50 px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="h-6 bg-gray-200 rounded-lg w-32"></div>
        <div className="h-9 bg-gray-200 rounded-xl w-24"></div>
      </div>
      <div className="p-8 space-y-4 flex-grow flex flex-col justify-center">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-11/12"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-4/5"></div>
        <div className="mt-6 flex items-center justify-center gap-2 text-purple-600 font-medium">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {loadingText}
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
  
  const resultsRef = useRef<HTMLDivElement>(null);

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
      // Optional: Handle quota exceeded error
    }
  }, [history]);

  const addToHistory = (img: ImageFile, result: AnalysisResult) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      image: img,
      result: result
    };
    
    // Keep only the last 24 items to prevent localStorage quota issues
    setHistory(prev => [newItem, ...prev].slice(0, 24));
  };

  const performAnalysis = async (img: ImageFile) => {
    setAppState(AppState.ANALYZING);
    setErrorMsg('');

    try {
      const result = await decodeImagePrompt(img.base64, img.mimeType, promptCount);
      setAnalysisResult(result);
      setAppState(AppState.SUCCESS);
      addToHistory(img, result);
    } catch (error: any) {
      console.error("Analysis failed", error);
      setErrorMsg(error.message || "Không thể phân tích hình ảnh. Vui lòng thử lại.");
      setAppState(AppState.ERROR);
    }
  };

  const handleImageSelected = (selectedImage: ImageFile) => {
    setImage(selectedImage);
    setAnalysisResult(null);
    setErrorMsg('');
    // Auto-start analysis immediately after selection
    performAnalysis(selectedImage);
  };

  const handleReset = () => {
    setImage(null);
    setAppState(AppState.IDLE);
    setAnalysisResult(null);
    setErrorMsg('');
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
    // Smooth scroll to top to see result
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearHistory = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử không?")) {
      setHistory([]);
    }
  };

  // Auto-scroll to results when success
  useEffect(() => {
    if (appState === AppState.SUCCESS && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [appState]);

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-purple-200 selection:text-purple-900">
      <div className="flex-grow w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Header />

        <div className="mt-8 mb-12">
          {/* Upload Section (Full Width when no image) */}
          {!image && (
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
                  <span className="w-8 text-center font-bold text-gray-800">{promptCount}</span>
                  <button 
                    onClick={() => setPromptCount(Math.min(5, promptCount + 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    disabled={promptCount >= 5}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="transform transition-all duration-500 hover:-translate-y-1">
                <ImageUploader onImageSelected={handleImageSelected} />
              </div>
            </div>
          )}

          {/* Stacked Layout when image is present */}
          {image && (
            <div className="flex flex-col gap-10 animate-fade-in-up">
              {/* Top: Image Preview */}
              <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
                <div className="bg-white rounded-[2rem] p-3 shadow-xl border border-gray-100 group relative overflow-hidden">
                  <div className="aspect-square rounded-[1.5rem] overflow-hidden bg-gray-100 relative">
                     <img 
                      src={image.previewUrl} 
                      alt="Uploaded preview" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    
                    {/* Floating Action Button for removing image */}
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

                    {/* Overlay for re-uploading (only when idle or success) */}
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
                
                 {appState === AppState.ERROR && (
                    <div className="w-full bg-red-50 rounded-2xl p-4 flex items-start gap-3 border border-red-100 text-red-700 animate-fade-in">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-bold">Đã xảy ra lỗi</p>
                        <p className="text-sm mt-1 opacity-90">{errorMsg}</p>
                        <button onClick={handleRetry} className="mt-3 text-sm font-bold bg-white/50 px-3 py-1 rounded-md hover:bg-white transition-colors">Thử lại ngay</button>
                      </div>
                    </div>
                 )}
              </div>

              {/* Bottom: Results or Loading */}
              <div className="w-full" ref={resultsRef}>
                 {/* IDLE state placeholder removed as we usually jump to analyzing immediately */}

                 {appState === AppState.ANALYZING && <SkeletonLoader />}

                 {appState === AppState.SUCCESS && analysisResult && (
                   <div className="flex flex-col gap-6 animate-fade-in-up">
                     <PromptDisplay prompts={analysisResult.prompts} />
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

          {/* History Section - Always visible unless empty */}
          {!image && (
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
        <div className="max-w-5xl mx-auto px-4 text-center space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8 text-sm font-medium text-gray-600">
            <div className="flex items-center gap-2 group cursor-default">
              <span className="p-1.5 bg-purple-100 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </span>
              <span>PHẠM NGỌC ÁNH</span>
            </div>
            
            <a href="tel:0931997903" className="flex items-center gap-2 group hover:text-purple-700 transition-colors">
              <span className="p-1.5 bg-purple-100 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </span>
              093.199.7903
            </a>
            
            <a href="https://ngocanhblog.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group hover:text-purple-700 transition-colors">
              <span className="p-1.5 bg-purple-100 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
              </span>
              ngocanhblog.com
            </a>
          </div>
          <p className="text-gray-400 text-xs">© 2024 AI Prompt Decoder. Powered by Google Gemini.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;