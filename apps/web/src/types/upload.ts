export interface UploadedImage {
  id: string;
  url: string;
  file?: File;
  preview?: string;
  position: number;
}

export interface UploadResult {
  success: boolean;
  image?: UploadedImage;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
