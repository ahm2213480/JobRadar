import type { CvAnalysis } from './cv-analysis.schema';

/**
 * All AI capabilities live behind this interface. Swapping providers (Gemini,
 * OpenAI, Anthropic, Ollama…) is a matter of adding an adapter — business
 * logic (profile, matching, CV) never knows which provider it talks to.
 */
export interface IAIService {
  /** Short human-readable provider label, e.g. "gemini:gemini-2.5-flash". */
  readonly name: string;
  /**
   * Analyzes the raw text of a CV/resume and returns structured profile +
   * skills data. Implementations MUST validate their output against
   * cvAnalysisSchema before returning.
   */
  analyzeCV(rawText: string): Promise<CvAnalysis>;
}