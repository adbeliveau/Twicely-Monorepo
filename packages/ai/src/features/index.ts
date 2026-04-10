export { generateDescription } from './description-generator';
export type { DescriptionRequest, DescriptionResult } from './description-generator';

export { suggestCategories } from './smart-categorization';
export type { CategorizationRequest, CategorySuggestion } from './smart-categorization';

export { suggestPrice } from './price-suggestion';
export type { PriceSuggestionRequest, PriceSuggestionResult } from './price-suggestion';

export { analyzeImages } from './image-analysis';
export type { ImageAnalysisRequest, ImageAnalysisResult, ImageAnalysisCheck } from './image-analysis';

export { extractVisualSearchData } from './visual-search';
export type { VisualSearchRequest, VisualSearchExtractionResult } from './visual-search';

export { authenticateItem } from './authentication';
export type { AuthenticationRequest, AuthenticationResult, AuthenticationVerdict } from './authentication';

export { suggestReply, assistReply, routeCase } from './helpdesk-ai';
export type {
  HelpdeskSuggestRequest, HelpdeskSuggestResult,
  HelpdeskAssistRequest, HelpdeskAssistResult,
  HelpdeskRouteRequest, HelpdeskRouteResult,
} from './helpdesk-ai';

export { autofillFromImages } from './smart-autofill';
export type { AutofillRequest, AutofillResult } from './smart-autofill';

export { analyzeFraud } from './fraud-detection';
export type { FraudAnalysisRequest, FraudAnalysisResult, FraudSignal } from './fraud-detection';

export { getRecommendations } from './recommendations';
export type { RecommendationRequest, RecommendationResult, RecommendationItem } from './recommendations';

export { understandQuery } from './natural-language-search';
export type { QueryUnderstandingRequest, QueryUnderstandingResult } from './natural-language-search';

export { moderateContent } from './content-moderation';
export type { ModerationRequest, ModerationResult, ModerationViolation, ViolationCategory } from './content-moderation';

export { embedTexts, embedQuery, embedImage } from './embeddings';

export { extractReceiptData } from './receipt-ocr';
export type { ReceiptOcrRequest, ReceiptOcrResult, ReceiptLineItem } from './receipt-ocr';
