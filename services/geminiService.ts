import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key chưa được cấu hình trong hệ thống. Vui lòng kiểm tra biến môi trường.");
  }
  return new GoogleGenAI({ apiKey });
};

export const decodeImagePrompt = async (base64Data: string, mimeType: string, count: number = 1): Promise<AnalysisResult> => {
  try {
    const ai = getClient();
    
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    };

    const promptText = `
      Đóng vai một chuyên gia hàng đầu về Reverse Prompt Engineering, Nhiếp ảnh gia Thương mại và Nhà Thiết Kế Thời Trang Kỹ Thuật. Nhiệm vụ của bạn là giải mã hình ảnh này để tạo ra prompt tái tạo chính xác nhất.

      Hãy thực hiện quy trình phân tích 3 bước sau:

      **BƯỚC 1: PHÂN TÍCH CẤU TRÚC & BỐ CỤC (QUAN TRỌNG NHẤT)**
      - **Xác định loại ảnh:** Đây là ảnh đơn (Single shot) hay ảnh ghép (Grid/Collage)?
      - **Nếu là Ảnh Ghép (Grid/Layout):**
        - Xác định chính xác bố cục: "2x2 grid", "Split screen" (chia đôi), "3-panel triptych", "Character sheet" (bản thiết kế nhân vật với các góc view: front, side, back).
        - Mô tả nội dung từng phần: Ví dụ "Top left: Close-up of face; Bottom right: Full body shot walking".
        - **BẮT BUỘC:** Prompt phải bắt đầu bằng từ khóa cấu trúc (VD: "A collage of...", "A split screen showing...", "A character sheet of...").

      **BƯỚC 2: PHẪU THUẬT THỜI TRANG (FASHION AUTOPSY)**
      - **Chất liệu (Fabrication):** Gọi tên chính xác (Satin, Velvet, Distressed Denim, Sheer Organza, Latex, Chunky Knit). Mô tả độ phản quang (matte/glossy) và bề mặt (texture).
      - **Kiểu dáng (Silhouette):** Oversized, Slim-fit, Drape, Layering, Cut-out.
      - **Chi tiết (Details):** Cúc áo, đường may, phụ kiện (dây xích, thắt lưng, trang sức).
      - **Màu sắc:** Dùng mã màu nghệ thuật (Teal, Burgundy, Pastel Lilac, Neon Green).

      **BƯỚC 3: NHIẾP ẢNH & KHÔNG KHÍ (VIBE)**
      - Ánh sáng: Cinematic lighting, Natural sunlight, Neon cyber, Studio strobe.
      - Phong cách: Editorial, Street style, Candid, Cyberpunk, Vintage film (Kodak Portra 400).

      ---
      **YÊU CẦU OUTPUT JSON:**
      
      - "prompts": Một mảng chứa đúng ${count} chuỗi văn bản (strings).
        *   **Prompt Index 0 (The Replica - Bám sát tuyệt đối):** 
            - Nếu là ảnh Grid/Ghép: "A [LOẠI GRID/LAYOUT] showing [MÔ TẢ CHI TIẾT TỪNG PHẦN]. The subject is wearing [CHI TIẾT TRANG PHỤC + CHẤT LIỆU]. [MÀU SẮC]. [LIGHTING & CAMERA]."
            - Nếu là ảnh Đơn: "Professional photography of [Subject] wearing [CHI TIẾT TRANG PHỤC]. [POSE]. [BACKGROUND]. [LIGHTING]."
            - **Lưu ý:** Ưu tiên độ chính xác về bố cục và chất liệu vải lên hàng đầu.
            
        *   **Prompt Index 1 trở đi (Creative Variations):** 
            - Giữ nguyên mô tả nhân vật và trang phục.
            - Thay đổi nhẹ về góc chụp hoặc ánh sáng để tạo ra các phiên bản artistic khác (nhưng vẫn giữ đúng bố cục nếu đó là đặc điểm chính của ảnh gốc).

      - "suggestions": Danh sách 3-5 gợi ý kỹ thuật ngắn gọn bằng TIẾNG VIỆT để người dùng cải thiện kết quả (Ví dụ: "Thêm từ khóa 'split screen' để chia đôi ảnh", "Sử dụng 'macro shot' để lấy chi tiết vải").

      Đảm bảo JSON hợp lệ. Không được thêm markdown block (\`\`\`json).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, { text: promptText }]
      },
      config: {
        temperature: 0.2, // Giảm temperature để tăng độ chính xác, bám sát ảnh gốc
        topK: 32,
        topP: 0.8,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["prompts", "suggestions"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI không trả về nội dung nào. Có thể ảnh quá phức tạp hoặc bị hệ thống lọc chặn.");
    }

    try {
      return JSON.parse(text) as AnalysisResult;
    } catch (e) {
      throw new Error("Lỗi định dạng dữ liệu từ AI. Vui lòng thử lại.");
    }

  } catch (error: any) {
    console.error("Lỗi khi gọi Gemini API:", error);
    
    // Categorize errors for better user feedback
    const msg = error.message || "";
    
    if (msg.includes("API_KEY") || msg.includes("400")) {
      throw new Error("Khóa API không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra cấu hình.");
    }
    
    if (msg.includes("SAFETY") || msg.includes("blocked") || msg.includes("finishReason")) {
      throw new Error("Hình ảnh bị hệ thống an toàn chặn. Vui lòng thử ảnh khác ít nhạy cảm hơn (tránh ảnh hở hang, bạo lực...).");
    }
    
    if (msg.includes("429") || msg.includes("Quota") || msg.includes("resource exhausted")) {
      throw new Error("Hệ thống đang quá tải hoặc hết hạn ngạch (Quota). Vui lòng đợi 1 phút và thử lại.");
    }
    
    if (msg.includes("500") || msg.includes("503") || msg.includes("Failed to fetch")) {
      throw new Error("Lỗi kết nối mạng hoặc máy chủ Google đang bảo trì. Vui lòng kiểm tra internet và thử lại.");
    }

    throw new Error(msg || "Đã xảy ra lỗi không xác định khi phân tích hình ảnh.");
  }
};