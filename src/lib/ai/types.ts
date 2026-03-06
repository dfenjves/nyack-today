/**
 * AI Event Extraction Types
 *
 * TypeScript interfaces for AI-extracted event data
 */

/**
 * Raw event data extracted by AI from email content
 */
export interface ExtractedEvent {
  title: string;
  description?: string | null;
  startDate: string; // ISO 8601 datetime
  endDate?: string | null; // ISO 8601 datetime
  venue: string;
  address?: string | null;
  city: string;
  price?: string | null;
  imageUrl?: string | null;
}

/**
 * AI response containing array of extracted events
 */
export interface AIEventExtractionResponse {
  events: ExtractedEvent[];
}

/**
 * AI provider options
 */
export type AIProvider = 'anthropic' | 'openai';

/**
 * Configuration for AI event extraction
 */
export interface AIConfig {
  provider: AIProvider;
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Error from AI event extraction
 */
export class AIExtractionError extends Error {
  constructor(
    message: string,
    public provider: AIProvider,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AIExtractionError';
  }
}
