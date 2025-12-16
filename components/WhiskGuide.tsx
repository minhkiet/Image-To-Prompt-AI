import React from 'react';

export const WhiskGuide: React.FC = () => {
  return (
    <div className="w-full bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-3xl shadow-lg border border-indigo-100 overflow-hidden animate-fade-in-up delay-200 ring-1 ring-indigo-50 mt-6">
      <div className="px-6 py-5 border-b border-indigo-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-md shadow-indigo-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Tạo ảnh mới với khuôn mặt này</h3>
            <p className="text-xs text-gray-500 font-medium">Sử dụng Google Labs (Whisk)</p>
          </div>
        </div>
        
        <a 
          href="https://labs.google/fx/tools/whisk/project" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <span>Mở Google Whisk</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connecting Line for Desktop */}
          <div className="hidden md:block absolute top-6 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-indigo-100 via-purple-100 to-indigo-100 -z-10" />

          {/* Step 1 */}
          <div className="relative flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-indigo-100 text-indigo-600 font-bold text-lg flex items-center justify-center mb-4 shadow-sm group-hover:border-indigo-400 group-hover:text-indigo-700 transition-colors z-10">
              1
            </div>
            <h4 className="font-bold text-gray-800 mb-2">Truy cập công cụ</h4>
            <p className="text-sm text-gray-600 leading-relaxed px-2">
              Nhấn nút <b>"Mở Google Whisk"</b> ở trên để truy cập vào trang Labs của Google.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-indigo-100 text-indigo-600 font-bold text-lg flex items-center justify-center mb-4 shadow-sm group-hover:border-indigo-400 group-hover:text-indigo-700 transition-colors z-10">
              2
            </div>
            <h4 className="font-bold text-gray-800 mb-2">Tải ảnh chủ thể</h4>
            <p className="text-sm text-gray-600 leading-relaxed px-2">
              Tại mục <b>Subject Reference</b>, tải lên ít nhất <span className="text-indigo-600 font-bold">01 ảnh</span> khuôn mặt bạn muốn giữ lại.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col items-center text-center group">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-indigo-100 text-indigo-600 font-bold text-lg flex items-center justify-center mb-4 shadow-sm group-hover:border-indigo-400 group-hover:text-indigo-700 transition-colors z-10">
              3
            </div>
            <h4 className="font-bold text-gray-800 mb-2">Dán Prompt & Tạo</h4>
            <p className="text-sm text-gray-600 leading-relaxed px-2">
              Copy <b>Prompt Gốc</b> hoặc <b>Biến thể</b> từ ứng dụng này, dán vào ô nhập liệu và nhấn Generate.
            </p>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-indigo-50 text-center">
            <p className="text-xs text-gray-400 italic">
                * Mẹo: Google Whisk (ImageFX) rất giỏi trong việc giữ khuôn mặt nhân vật (Identity Consistency).
            </p>
        </div>
      </div>
    </div>
  );
};