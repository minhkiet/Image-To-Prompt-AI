import React, { useRef, useState, useEffect } from 'react';
import { ImageFile } from '../types';

interface ImageUploaderProps {
  onImageSelected: (image: ImageFile) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

// Worker code as a string to avoid bundler configuration issues
const WORKER_CODE = `
  self.onmessage = async (e) => {
    const { file, maxDimension = 1536, quality = 0.85 } = e.data;
    
    try {
      // Create bitmap from file (efficient and off-main-thread compatible)
      const bitmap = await createImageBitmap(file);
      let width = bitmap.width;
      let height = bitmap.height;
      
      // Calculate new dimensions
      if (width > height) {
        if (width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
      }
      
      // Use OffscreenCanvas for resize/compression
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, width, height);
      
      // Convert to blob
      const blob = await offscreen.convertToBlob({ 
        type: 'image/jpeg', 
        quality 
      });
      
      // Convert blob to Data URL for preview and base64 extraction
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        // Basic validation
        if (typeof dataUrl === 'string') {
            const base64 = dataUrl.split(',')[1];
            self.postMessage({ 
                success: true, 
                base64, 
                preview: dataUrl, 
                mimeType: 'image/jpeg' 
            });
        } else {
            self.postMessage({ success: false, error: 'Lỗi chuyển đổi dữ liệu ảnh.' });
        }
      };
      reader.onerror = () => {
        self.postMessage({ success: false, error: 'Không thể đọc dữ liệu file.' });
      };
      reader.readAsDataURL(blob);
      
    } catch (error) {
      self.postMessage({ success: false, error: error.message || 'Lỗi xử lý ảnh trong Worker.' });
    }
  };
`;

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, onError, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Fallback compression for browsers without OffscreenCanvas support in Workers
  const compressImageFallback = (file: File): Promise<{ base64: string, preview: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = () => reject(new Error("File ảnh bị lỗi hoặc không hỗ trợ."));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIMENSION = 1536;

          if (width > height) {
            if (width > MAX_DIMENSION) {
              height *= MAX_DIMENSION / width;
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width *= MAX_DIMENSION / height;
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Trình duyệt không hỗ trợ Canvas 2D."));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const base64 = dataUrl.split(',')[1];
          
          resolve({
            base64,
            preview: dataUrl,
            mimeType: 'image/jpeg'
          });
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Không thể đọc file."));
      reader.readAsDataURL(file);
    });
  };

  const compressImageWithWorker = (file: File): Promise<{ base64: string, preview: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
      // Check if OffscreenCanvas is supported in this browser environment
      if (!('OffscreenCanvas' in window)) {
        console.warn('OffscreenCanvas not supported, falling back to main thread.');
        compressImageFallback(file).then(resolve).catch(reject);
        return;
      }

      try {
        const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = (e) => {
          const { success, base64, preview, mimeType, error } = e.data;
          worker.terminate(); // Clean up

          if (success) {
            resolve({ base64, preview, mimeType });
          } else {
            // If worker fails, try fallback
            console.warn('Worker failed:', error);
            compressImageFallback(file).then(resolve).catch(reject);
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          console.error('Worker error:', err);
          compressImageFallback(file).then(resolve).catch(reject);
        };

        worker.postMessage({ file, maxDimension: 1536, quality: 0.85 });
      } catch (e) {
        console.error('Failed to create worker:', e);
        compressImageFallback(file).then(resolve).catch(reject);
      }
    });
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onError('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WebP).');
      return;
    }

    if (file.size === 0) {
      onError('File ảnh rỗng hoặc bị lỗi.');
      return;
    }

    setIsProcessing(true);
    try {
      // Use the worker-based compression
      const { base64, preview, mimeType } = await compressImageWithWorker(file);
      onImageSelected({
        file,
        previewUrl: preview,
        base64,
        mimeType
      });
    } catch (error: any) {
      console.error("Error processing image", error);
      onError(error.message || "Có lỗi khi xử lý hình ảnh. Vui lòng thử ảnh khác.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Stop bubbling to parent which triggers file input
    if (disabled || isProcessing) return;

    try {
      // Check if the Clipboard API is supported
      if (!navigator.clipboard || !navigator.clipboard.read) {
        onError("Trình duyệt của bạn không hỗ trợ nút dán này (yêu cầu HTTPS hoặc localhost). Hãy thử dùng phím tắt Ctrl+V.");
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      let found = false;

      for (const item of clipboardItems) {
        // Prioritize finding an image type
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "pasted_image", { type: imageType });
          processFile(file);
          found = true;
          break;
        }
      }

      if (!found) {
        onError("Không tìm thấy hình ảnh nào trong bộ nhớ tạm (Clipboard). Hãy copy ảnh trước.");
      }
    } catch (error) {
      console.error("Paste error:", error);
      onError("Không thể dán ảnh. Vui lòng cấp quyền truy cập bộ nhớ tạm hoặc sử dụng phím tắt Ctrl+V.");
    }
  };

  // Handle global paste event
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled || isProcessing) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            return;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
    // Reset input value to allow selecting the same file again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || isProcessing) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Tải ảnh lên"
      onKeyDown={handleKeyDown}
      className={`relative group cursor-pointer transition-all duration-300 ease-out border-3 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center text-center bg-white shadow-sm hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-200
        ${isDragging ? 'border-purple-500 bg-purple-50 scale-[1.01] shadow-xl' : 'border-gray-300 hover:border-purple-400'}
        ${disabled || isProcessing ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
        disabled={disabled || isProcessing}
      />
      
      {isProcessing ? (
        <div className="flex flex-col items-center animate-fade-in">
           <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
           <p className="text-purple-600 font-bold text-lg">Đang tối ưu hóa ảnh...</p>
           <p className="text-sm text-gray-400 mt-2 max-w-xs">Hệ thống đang nén và chuẩn bị ảnh để gửi cho Gemini Vision</p>
        </div>
      ) : (
        <>
          <div className="w-24 h-24 mb-6 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:bg-purple-100 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>

          <h3 className="text-2xl font-bold text-gray-800 mb-3">Tải ảnh lên</h3>
          <p className="text-gray-500 text-base max-w-sm mx-auto leading-relaxed mb-6">
            Kéo thả hoặc nhấp để chọn ảnh <br/>
            <span className="text-xs opacity-75">(Hỗ trợ JPG, PNG, WebP)</span>
          </p>

          <button
            type="button"
            onClick={handlePasteClick}
            className="relative z-10 mb-8 group/paste-btn overflow-hidden rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-purple-600 shadow-sm ring-1 ring-purple-100 transition-all duration-300 hover:shadow-lg hover:shadow-purple-200/50 hover:ring-transparent active:scale-95"
          >
            {/* Gradient Background Layer */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-0 transition-opacity duration-300 group-hover/paste-btn:opacity-100" />
            
            {/* Content Layer */}
            <div className="relative flex items-center gap-2">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5 transition-colors duration-300 group-hover/paste-btn:text-white" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="transition-colors duration-300 group-hover/paste-btn:text-white">
                  Dán ảnh từ Clipboard
                </span>
            </div>
          </button>
        </>
      )}
    </div>
  );
};