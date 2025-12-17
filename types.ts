
export interface PromptItem {
  text: string;
  score: number;
}

export interface AnalysisResult {
  prompts: PromptItem[];
  suggestions: string[];
  detectedTexts?: string[];
}

export interface ImageFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  image: ImageFile;
  result: AnalysisResult;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}