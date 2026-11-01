import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as uploadService from '../../services/uploadService';
import EventImage from './EventImage';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const ImageUpload = ({
  value,
  onChange,
  onUploadingChange,
  disabled = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);
  const uploadInProgressRef = useRef(false);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG and WebP files are allowed');
      return false;
    }
    if (file.size > MAX_SIZE) {
      toast.error('File size must be less than 5MB');
      return false;
    }
    return true;
  };

  const handleUpload = useCallback(
    async (file) => {
      if (disabled || uploadInProgressRef.current) return;
      if (!validateFile(file)) return;

      const formData = new FormData();
      formData.append('image', file);

      try {
        uploadInProgressRef.current = true;
        setUploading(true);
        onUploadingChange?.(true);
        setProgress(0);

        const response = await uploadService.uploadImage(formData, (e) => {
          if (e.total) {
            setProgress(Math.round((e.loaded * 100) / e.total));
          }
        });

        const imageUrl = response?.data?.url ?? response?.url;
        if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
          throw new Error('The upload response did not contain an image URL');
        }
        onChange(imageUrl);
        toast.success('Image uploaded successfully');
      } catch (error) {
        toast.error(error.message || 'Failed to upload image');
      } finally {
        uploadInProgressRef.current = false;
        setUploading(false);
        onUploadingChange?.(false);
        setProgress(0);
      }
    },
    [disabled, onChange, onUploadingChange]
  );

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled && !uploading) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleRemove = () => {
    onChange('');
  };

  if (value) {
    return (
      <div className="relative group rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <EventImage
          src={value}
          alt="Event"
          className="w-full h-48 object-cover"
          fallbackClassName="flex h-48 w-full items-center justify-center bg-gray-100 dark:bg-gray-800"
          fallback={
            <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Image unavailable
            </div>
          }
        />
        {!disabled && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              type="button"
              onClick={handleRemove}
              className="px-4 py-2 bg-white/90 dark:bg-gray-800/90 text-red-600 dark:text-red-400 text-sm font-medium
                         rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Remove
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
      className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all
        ${isDragging
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 bg-gray-50 dark:bg-gray-800/50'
        }
        ${disabled || uploading ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />

      {uploading ? (
        <div className="space-y-3">
          <svg className="w-10 h-10 mx-auto text-primary-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Uploading... {progress}%</p>
          <div className="w-48 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <svg className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isDragging ? 'Drop image here' : 'Click or drag & drop to upload'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            JPEG, PNG, WebP — Max 5MB
          </p>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
