import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileCode2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { eegApi, type EegSession } from '../../../api/eeg';
import { useToast } from '../../../providers/ToastProvider';

/* ────────────────────────────────────────────────────
   EEG Upload Zone — Clean Drag & Drop EDF/CSV Uploader
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
  const toast = useToast();

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
        setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
      }, 150);

      const session = await eegApi.uploadEEG(
        selectedFile,
        undefined,
        patientUserId ? { patient_user_id: patientUserId } : undefined
      );
      clearInterval(interval);
      setUploadProgress(100);
      setSuccessSession(session);
      onUploadSuccess(session);
      toast.success(`EEG recording "${selectedFile.name}" uploaded successfully.`);

      setTimeout(() => {
        setIsUploading(false);
        setSelectedFile(null);
        setUploadProgress(0);
        setSuccessSession(null);
      }, 1800);
    } catch (err: any) {
      const msg = err.message || 'Failed to upload EEG file. Please try again.';
      setErrorMessage(msg);
      setIsUploading(false);
      setUploadProgress(0);
      toast.error(msg);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="eeg-upload-container glass-card">
      <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>Upload EEG Recording</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
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
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".edf,.csv"
          onChange={handleFileInput}
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        <div className="eeg-cloud-circle">
          <UploadCloud size={32} />
        </div>

        <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '4px' }}>
          {selectedFile ? selectedFile.name : 'Click to select or drag & drop EEG file'}
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
          {selectedFile
            ? `${formatFileSize(selectedFile.size)} · File ready for validation & upload`
            : 'European Data Format (.edf) or Raw Multichannel Voltages (.csv)'}
        </p>

        <button
          type="button"
          className="eeg-browse-btn"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          <FolderOpen size={14} />
          <span>Browse Local Files</span>
        </button>
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
              borderRadius: 'var(--radius-xl)',
              background: '#ffffff',
              border: '1.5px solid rgba(45, 90, 63, 0.2)',
              boxShadow: '0 4px 14px rgba(45, 90, 63, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-4)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-primary-50)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FileCode2 size={22} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 700,
                    color: 'var(--color-text-main)',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {selectedFile.name}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {formatFileSize(selectedFile.size)} · Ready to Upload
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
                style={{
                  minWidth: '150px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={14} />
                    <span>Upload Recording</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress Bar ── */}
      {isUploading && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              marginBottom: 'var(--space-1)',
            }}
          >
            <span>Uploading EEG recording...</span>
            <span style={{ fontWeight: 700 }}>{uploadProgress}%</span>
          </div>
          <div
            style={{
              height: '6px',
              background: 'rgba(45, 90, 63, 0.1)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              style={{ height: '100%', background: 'var(--color-primary)' }}
              initial={{ width: '0%' }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.15 }}
            />
          </div>
        </div>
      )}

      {/* ── Success Message ── */}
      {successSession && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            border: '1px solid rgba(22, 163, 74, 0.2)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <CheckCircle2 size={18} />
          <span>Upload complete! Session #{successSession.id} saved and validated successfully.</span>
        </motion.div>
      )}
    </div>
  );
}
