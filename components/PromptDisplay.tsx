import React, { useState } from 'react';

interface PromptDisplayProps {
  prompts: string[];
}

type FontType = 'font-mono' | 'font-sans' | 'font-serif';

export const PromptDisplay: React.FC<PromptDisplayProps> = ({ prompts }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [selectedFont, setSelectedFont] = useState<FontType>('font-mono');

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleCopyAll = async () => {
    try {
      const allText = prompts.join('\n\n');
      await navigator.clipboard.writeText(allText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy all text: ', err);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
         <div className="flex items-center gap-2">
           <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-800 text-lg">Kết quả ({prompts.length} prompt)</h3>
         </div>

         <div className="flex flex-wrap items-center gap-3">
             {/* Font Selector */}
             <div className="relative group">
                <select
                    value={selectedFont}
                    onChange={(e) => setSelectedFont(e.target.value as FontType)}
                    className="appearance-none bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-xl pl-3 pr-8 py-2 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300 shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
                    title="Chọn phông chữ"
                >
                    <option value="font-mono">Monospace</option>
                    <option value="font-sans">Sans-serif</option>
                    <option value="font-serif">Serif</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
             </div>

             {prompts.length > 0 && (
                <button
                onClick={handleCopyAll}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 transform border shadow-sm
                    ${copiedAll 
                    ? 'bg-green-100 text-green-700 border-green-300 animate-pop ring-2 ring-green-200/50' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 active:scale-95'
                    }`}
                >
                {copiedAll ? (
                    <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Đã chép tất cả</span>
                    </>
                ) : (
                    <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Sao chép tất cả</span>
                    </>
                )}
                </button>
             )}
         </div>
      </div>

      {prompts.map((prompt, index) => (
        <div key={index} className="w-full bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100 animate-fade-in-up" style={{ animationDelay: `${index * 150}ms` }}>
          <div className="bg-white/80 backdrop-blur-sm px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              {index === 0 ? "Prompt Gốc (Chính xác nhất)" : `Biến thể #${index}`}
            </span>
            
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => handleCopy(prompt, index)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 transform border
                  ${copiedIndex === index
                    ? 'bg-green-100 text-green-700 border-green-300 shadow-md animate-pop ring-2 ring-green-100' 
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300 active:scale-95'
                  }`}
              >
                {copiedIndex === index ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Đã chép</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="p-5 bg-gray-50/50">
            <div className="prose prose-sm prose-purple max-w-none">
              <p className={`text-gray-700 leading-relaxed whitespace-pre-wrap break-words font-medium text-sm ${selectedFont}`}>
                {prompt}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};