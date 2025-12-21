import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageFile } from '../types';

interface ImageUploaderProps {
  onImageSelected: (image: ImageFile) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

// Worker code with support for dynamic format and quality
const WORKER_CODE = `
  self.onmessage = async (e) => {
    const { file, maxDimension = 2048, quality = 0.9, outputFormat = 'image/jpeg' } = e.data;
    
    try {
      // Create bitmap from file
      const bitmap = await createImageBitmap(file);
      let width = bitmap.width;
      let height = bitmap.height;
      
      // Smart Resize
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
           height *= maxDimension / width;
           width = maxDimension;
        } else {
           width *= maxDimension / height;
           height = maxDimension;
        }
      }
      
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d');
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      
      const blob = await offscreen.convertToBlob({ 
        type: outputFormat, 
        quality: quality 
      });
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl === 'string') {
            const base64 = dataUrl.split(',')[1];
            self.postMessage({ 
                success: true, 
                base64, 
                preview: dataUrl, 
                mimeType: outputFormat 
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

interface CompressionOptions {
  maxDimension: number;
  quality: number;
  outputFormat: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, onError, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const MotionDiv = motion.div as any;
  const MotionButton = motion.button as any;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isProcessing) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const getCompressionSettings = (file: File): CompressionOptions => {
    const isHighFidelitySource = file.type === 'image/png' || file.type === 'image/webp';
    const outputFormat = isHighFidelitySource ? 'image/webp' : 'image/jpeg';
    return {
      maxDimension: 2048, 
      quality: 0.92,
      outputFormat
    };
  };

  const compressImageFallback = (file: File, options: CompressionOptions): Promise<{ base64: string, preview: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = () => reject(new Error("File ảnh bị lỗi hoặc không hỗ trợ."));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const { maxDimension, quality, outputFormat } = options;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
               height *= maxDimension / width;
               width = maxDimension;
            } else {
               width *= maxDimension / height;
               height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Trình duyệt không hỗ trợ Canvas 2D."));
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          try {
            const dataUrl = canvas.toDataURL(outputFormat, quality);
            const base64 = dataUrl.split(',')[1];
            resolve({ base64, preview: dataUrl, mimeType: outputFormat });
          } catch (e) {
            reject(new Error("Lỗi khi nén ảnh (Fallback)."));
          }
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Không thể đọc file."));
      reader.readAsDataURL(file);
    });
  };

  const compressImageWithWorker = (file: File): Promise<{ base64: string, preview: string, mimeType: string }> => {
    const settings = getCompressionSettings(file);
    return new Promise((resolve, reject) => {
      if (!('OffscreenCanvas' in window)) {
        compressImageFallback(file, settings).then(resolve).catch(reject);
        return;
      }

      let worker: Worker | null = null;
      const timeoutId = setTimeout(() => {
        if (worker) {
          worker.terminate();
          compressImageFallback(file, settings).then(resolve).catch(reject);
        }
      }, 8000);

      try {
        const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = (e) => {
          clearTimeout(timeoutId);
          const { success, base64, preview, mimeType, error } = e.data;
          worker?.terminate();
          if (success) resolve({ base64, preview, mimeType });
          else compressImageFallback(file, settings).then(resolve).catch(reject);
        };

        worker.onerror = (err) => {
          clearTimeout(timeoutId);
          worker?.terminate();
          compressImageFallback(file, settings).then(resolve).catch(reject);
        };

        worker.postMessage({ 
          file, 
          maxDimension: settings.maxDimension, 
          quality: settings.quality,
          outputFormat: settings.outputFormat
        });
      } catch (e) {
        clearTimeout(timeoutId);
        compressImageFallback(file, settings).then(resolve).catch(reject);
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
      const { base64, preview, mimeType } = await compressImageWithWorker(file);
      onImageSelected({ file, previewUrl: preview, base64, mimeType });
    } catch (error: any) {
      console.error("Error processing image", error);
      onError(error.message || "Có lỗi khi xử lý hình ảnh. Vui lòng thử ảnh khác.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isProcessing) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        onError("Trình duyệt của bạn không hỗ trợ nút dán này. Hãy thử dùng phím tắt Ctrl+V.");
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      let found = false;
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "pasted_image", { type: imageType });
          processFile(file);
          found = true;
          break;
        }
      }
      if (!found) onError("Không tìm thấy hình ảnh nào trong bộ nhớ tạm.");
    } catch (error) {
      onError("Không thể dán ảnh. Vui lòng sử dụng phím tắt Ctrl+V.");
    }
  };

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
  }, [disabled, isProcessing]);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <MotionDiv
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Tải ảnh lên"
      whileHover={{ scale: disabled || isProcessing ? 1 : 1.01 }}
      whileTap={{ scale: disabled || isProcessing ? 1 : 0.99 }}
      className={`relative group cursor-pointer border-4 border-dashed rounded-[3rem] p-10 flex flex-col items-center justify-center text-center bg-white/70 backdrop-blur-sm shadow-xl transition-all duration-300 min-h-[420px]
        ${isDragging ? 'border-pink-300 bg-pink-50 scale-[1.01] shadow-2xl' : 'border-purple-100 hover:border-pink-300 hover:shadow-pink-200/50'}
        ${disabled ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}
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
      
      {/* Animated Glow Effect on Hover */}
      <div className="absolute inset-0 rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
         <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-r from-pink-200/20 to-blue-200/20 blur-2xl"></div>
      </div>
      
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <MotionDiv 
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center relative z-10"
          >
             <div className="w-20 h-20 border-8 border-pink-100 border-t-pink-400 rounded-full animate-spin mb-6 shadow-lg"></div>
             <p className="text-pink-500 font-extrabold text-xl animate-pulse">Đang tối ưu hóa ảnh...</p>
             <p className="text-sm text-gray-500 mt-2 max-w-xs font-semibold">
               Chờ chút xíu nha, bé điệu đang xử lý...
             </p>
          </MotionDiv>
        ) : (
          <MotionDiv 
            key="idle"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="relative z-10 flex flex-col items-center"
          >
            <MotionDiv 
              className="w-32 h-32 mb-6 bg-gradient-to-tr from-pink-100 to-white text-pink-500 rounded-full flex items-center justify-center shadow-xl shadow-pink-100 border-4 border-white"
              animate={{ 
                 y: [0, -8, 0],
                 boxShadow: ["0 10px 15px -3px rgba(249, 168, 212, 0.3)", "0 25px 30px -5px rgba(249, 168, 212, 0.4)", "0 10px 15px -3px rgba(249, 168, 212, 0.3)"]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </MotionDiv>

            <h3 className="text-4xl font-black text-gray-700 mb-3 tracking-tight">Tải ảnh lên</h3>
            <p className="text-gray-500 text-base max-w-sm mx-auto leading-relaxed mb-8 font-semibold">
              Kéo thả hoặc nhấp để chọn ảnh <br/>
              <span className="text-xs font-bold text-pink-500 bg-pink-50 px-3 py-1 rounded-full mt-2 inline-block shadow-sm">JPG, PNG, WebP</span>
            </p>

            <div className="relative mt-2">
              <MotionButton
                type="button"
                onClick={handlePasteClick}
                disabled={disabled || isProcessing}
                whileHover={{ scale: disabled || isProcessing ? 1 : 1.05, translateY: -3 }}
                whileTap={{ scale: disabled || isProcessing ? 1 : 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className={`relative overflow-hidden rounded-full bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 px-10 py-4 text-base font-black text-white shadow-lg transition-all border-b-4 border-rose-600/30
                  ${disabled || isProcessing ? 'grayscale opacity-60 cursor-not-allowed shadow-none' : 'shadow-kawaii-pink hover:shadow-2xl hover:shadow-pink-300'}
                `}
              >
                <span className="relative z-10 flex items-center gap-3 uppercase tracking-wide text-shadow-sm">
                    <div className="bg-white/20 p-1.5 rounded-lg">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-5 w-5" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    Dán từ Clipboard
                </span>
                {/* White shine effect */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-white/25 rounded-t-full pointer-events-none" />
                {/* Subtle internal glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              </MotionButton>
              
              {/* Floating heart decoration that appears on hover */}
              <motion.div 
                className="absolute -top-4 -right-4 text-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                animate={{ y: [0, -5, 0], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                💖
              </motion.div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
};
