import { AnalysisResult, PromptItem } from "../types";

// Helper function to pause execution
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const decodeImagePrompt = async (
  base64Data: string,
  mimeType: string,
  count: number = 1
): Promise<AnalysisResult> => {
  try {
    const response = await fetch('/api/decode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Data, mimeType, count }),
    });

    if (!response.ok) {
      let errorMsg = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMsg = errorData.error;
        }
      } catch {
        // Fallback to response status text
        errorMsg = response.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    const result = await response.json();
    return result as AnalysisResult;
  } catch (error: any) {
    console.error("Lỗi khi giải mã prompt:", error);
    throw error;
  }
};

export const optimizePrompt = async (
  originalPrompt: string,
  base64Data?: string,
  mimeType?: string
): Promise<PromptItem> => {
  try {
    const response = await fetch('/api/optimize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: originalPrompt,
        base64Data,
        mimeType,
      }),
    });

    if (!response.ok) {
      let errorMsg = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMsg = errorData.error;
        }
      } catch {
        errorMsg = response.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    const result = await response.json();
    return result as PromptItem;
  } catch (error: any) {
    console.error("Lỗi khi tối ưu prompt:", error);
    throw new Error(error?.message || "Không thể tối ưu hóa prompt lúc này.");
  }
};

export const translateText = async (
  text: string,
  targetLang: 'en' | 'vi'
): Promise<string> => {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, targetLang }),
    });

    if (!response.ok) {
      return text;
    }

    const data = await response.json();
    return data.text || text;
  } catch (error) {
    console.error("Lỗi khi dịch:", error);
    return text;
  }
};
