import { useRef, useState, type DragEvent } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in MB
  onUpload: (file: File) => void;
  isLoading?: boolean;
  label?: string;
  hint?: string;
  error?: string;
}

export function FileUpload({
  accept = '.csv,.json',
  maxSize = 5,
  onUpload,
  isLoading = false,
  label = 'Upload File',
  hint = 'Drag and drop or click to upload',
  error,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string>('');

  const validateFile = (file: File): boolean => {
    setUploadError('');
    
    // Check size
    if (file.size > maxSize * 1024 * 1024) {
      setUploadError(`File size must be less than ${maxSize}MB`);
      return false;
    }
    
    // Check extension
    const acceptedExtensions = accept.split(',').map(ext => ext.trim().toLowerCase());
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedExtensions.includes(fileExtension)) {
      setUploadError(`Invalid file type. Accepted: ${accept}`);
      return false;
    }
    
    return true;
  };

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      onUpload(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      {label && <label className="label">{label}</label>}
      
      <div
        onClick={() => !selectedFile && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={clsx(
          'border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer',
          isDragging ? 'border-primary bg-primary-50' : 'border-gray-300 hover:border-gray-400',
          selectedFile && 'border-success bg-success/5',
          (error || uploadError) && 'border-danger bg-danger/5'
        )}
      >
        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
        
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); clearFile(); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <Upload className={clsx('w-6 h-6', isDragging ? 'text-primary' : 'text-gray-400')} />
            </div>
            <p className="text-sm font-medium text-gray-700">{hint}</p>
            <p className="text-xs text-gray-500 mt-1">Accepted: {accept} (max {maxSize}MB)</p>
          </>
        )}
      </div>
      
      {(error || uploadError) && (
        <div className="mt-2 flex items-center gap-1 text-danger text-sm">
          <AlertCircle className="w-4 h-4" />
          {error || uploadError}
        </div>
      )}
      
      {isLoading && (
        <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Uploading...
        </div>
      )}
    </div>
  );
}
