import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileCode2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { eegApi, type EegSession } from '../../../api/eeg';

/* ────────────────────────────────────────────────────
   EEG Upload Zone — Drag & Drop EDF/CSV Uploader
   ──────────────────────────────────────────────────── */

interface EEGUploadZoneProps {
  onUploadSuccess: (session: EegSession) => void;
  patientUserId?: number;
}

export function EEGUploadZone({ onUploadSuccess, patientUserId }: EEGUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successSession, setSuccessSession] = useState<EegSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validateFile = (file: File): string | null => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.edf') && !ext.endsWith('.csv')) {
      return 'Invalid file format. Please upload an EDF (.edf) or CSV (.csv) EEG recording.';
    }
    const maxBytes = 200 * 1024 * 1024; // 200MB
    if (file.size > maxBytes) {
      return 'File exceeds the 200MB limit.';
    }
    return null;
  };

  const handleFile = (file: File) => {
    setErrorMessage('');
    const error = validateFile(file);
    if (error) {
      setErrorMessage(error);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(20);
    setErrorMessage('');

    try {
      const interval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 15 : prev));
      }, 200);

      const session = await eegApi.uploadEEG(
        selectedFile,
        undefined,
        patientUserId ? { patient_user_id: patientUserId } : undefined
      );
      clearInterval(interval);
      setUploadProgress(100);
      setSuccessSession(session);
      onUploadSuccess(session);

      setTimeout(() => {
        setIsUploading(false);
        setSelectedFile(null);
        setUploadProgress(0);
        setSuccessSession(null);
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload EEG file. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="eeg-upload-container glass-card" style={{ padding: 'var(--space-6)' }}>
      <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h3>Upload EEG Recording</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            Supports standard European Data Format (<code>.edf</code>) and raw voltage <code>.csv</code> files up to 200MB.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          className="auth-error-banner"
          role="alert"
          style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Drop Zone ── */}
      <div
        className={`eeg-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed var(--color-border)',
          borderColor: isDragging ? 'var(--color-primary)' : 'var(--color-border)',
          background: isDragging ? 'var(--color-primary-50)' : 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-10) var(--space-6)',
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".edf,.csv"
          onChange={handleFileInput}
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-secondary-50)',
          color: 'var(--color-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4)',
        }}>
          <UploadCloud size={32} />
        </div>

        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 'var(--space-1)' }}>
          {selectedFile ? selectedFile.name : 'Click to select or drag & drop EEG file'}
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
          {selectedFile
            ? `${formatFileSize(selectedFile.size)} · Ready to upload`
            : 'EDF / CSV format up to 200MB'}
        </p>
      </div>

      {/* ── Selected File & Actions ── */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
              <FileCode2 size={24} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-main)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {selectedFile.name}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {formatFileSize(selectedFile.size)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
                disabled={isUploading}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                disabled={isUploading}
                style={{ minWidth: '120px' }}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload & Save'
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress Bar ── */}
      {isUploading && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
            <span>Processing EEG upload...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div style={{ height: '6px', background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', background: 'var(--color-primary)' }}
              initial={{ width: '0%' }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* ── Success Message ── */}
      {successSession && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <CheckCircle2 size={18} />
          <span>Upload complete! Session #{successSession.id} created successfully.</span>
        </motion.div>
      )}
    </div>
  );
}
