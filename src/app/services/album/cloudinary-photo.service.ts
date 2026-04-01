import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../core/config/environment';
import { API_CONFIG, ERROR_MESSAGES } from '../../core/config/constants';

interface CloudinaryUploadResponse {
  secure_url?: string;
  public_id?: string;
}

@Injectable({ providedIn: 'root' })
export class CloudinaryPhotoService {
  private readonly http = inject(HttpClient);

  private readonly maxFileSize = API_CONFIG.cloudinary.maxFileSize;
  private readonly allowedFormats = new Set<string>(
    API_CONFIG.cloudinary.allowedFormats,
  );

  validateImage(file: File): string | null {
    if (file.size > this.maxFileSize) return ERROR_MESSAGES.fileTooLarge;

    const extension = this.getFileExtension(file.name);
    if (!extension || !this.allowedFormats.has(extension))
      return ERROR_MESSAGES.invalidFormat;

    return null;
  }

  async uploadImage(file: File): Promise<{ url: string; publicId: string }> {
    const validationError = this.validateImage(file);
    if (validationError) throw new Error(validationError);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', environment.cloudinary.uploadPreset);
    formData.append('folder', API_CONFIG.cloudinary.folder);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${environment.cloudinary.cloudName}/image/upload`; // TODO: verify endpoint and version

    const response = await firstValueFrom(
      this.http.post<CloudinaryUploadResponse>(uploadUrl, formData),
    );

    if (!response?.secure_url || !response?.public_id)
      throw new Error(ERROR_MESSAGES.uploadFailed);

    return {
      url: response.secure_url,
      publicId: response.public_id,
    };
  }

  private getFileExtension(fileName: string): string | null {
    const parts = fileName.split('.');
    if (parts.length < 2) return null;
    return parts[parts.length - 1].trim().toLowerCase();
  }
}
