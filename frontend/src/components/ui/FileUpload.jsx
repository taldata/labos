import React, { useState, useRef } from 'react';
import './FileUpload.css';

const FileUpload = ({
  label,
  accept,
  multiple = false,
  maxSize = 5 * 1024 * 1024, // 5MB default
  maxFiles = 5,
  onChange,
  value = [],
  error,
  helperText,
  required = false,
  disabled = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState(value);
  const [uploadError, setUploadError] = useState(error);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (file) => {
    if (maxSize && file.size > maxSize) {
      return `File ${file.name} exceeds maximum size of ${(maxSize / 1024 / 1024).toFixed(1)}MB`;
    }
    if (accept) {
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const fileExtension = '.' + file.name.split('.').pop();
      const mimeType = file.type;

      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension.toLowerCase() === type.toLowerCase();
        }
        if (type.endsWith('/*')) {
          return mimeType.startsWith(type.replace('/*', ''));
        }
        return mimeType === type;
      });

      if (!isAccepted) {
        return `File ${file.name} type not accepted. Allowed types: ${accept}`;
      }
    }
    return null;
  };

  const handleFiles = (newFiles) => {
    setUploadError(null);
    const fileArray = Array.from(newFiles);

    if (!multiple && fileArray.length > 1) {
      setUploadError('Only one file is allowed');
      return;
    }

    if (files.length + fileArray.length > maxFiles) {
      setUploadError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        setUploadError(error);
        return;
      }
    }

    const updatedFiles = multiple ? [...files, ...fileArray] : fileArray;
    setFiles(updatedFiles);
    onChange?.(updatedFiles);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (disabled) return;

    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleRemoveFile = (index) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onChange?.(updatedFiles);
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    const iconMap = {
      pdf: 'fa-file-pdf',
      doc: 'fa-file-word',
      docx: 'fa-file-word',
      xls: 'fa-file-excel',
      xlsx: 'fa-file-excel',
      ppt: 'fa-file-powerpoint',
      pptx: 'fa-file-powerpoint',
      jpg: 'fa-file-image',
      jpeg: 'fa-file-image',
      png: 'fa-file-image',
      gif: 'fa-file-image',
      zip: 'fa-file-archive',
      rar: 'fa-file-archive',
      txt: 'fa-file-alt',
      csv: 'fa-file-csv'
    };
    return iconMap[extension] || 'fa-file';
  };

  return (
    <div className="file-upload-wrapper">
      {label && (
        <label className="file-upload-label">
          {label}
          {required && <span className="file-upload-required">*</span>}
        </label>
      )}

      <div
        className={`file-upload-dropzone ${dragActive ? 'file-upload-drag-active' : ''} ${disabled ? 'file-upload-disabled' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={!disabled ? handleButtonClick : undefined}
      >
        <input
          ref={inputRef}
          type="file"
          className="file-upload-input"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          disabled={disabled}
        />

        <div className="file-upload-content">
          <i className="fas fa-cloud-upload-alt file-upload-icon"></i>
          <p className="file-upload-text">
            <span className="file-upload-text-primary">Click to upload</span> or drag and drop
          </p>
          {helperText && <p className="file-upload-helper">{helperText}</p>}
          {accept && (
            <p className="file-upload-hint">
              Accepted formats: {accept.replace(/\./g, '').replace(/,/g, ', ')}
            </p>
          )}
          {maxSize && (
            <p className="file-upload-hint">
              Maximum file size: {(maxSize / 1024 / 1024).toFixed(1)}MB
            </p>
          )}
        </div>
      </div>

      {(uploadError || error) && (
        <span className="file-upload-error">
          <i className="fas fa-exclamation-circle"></i>
          {uploadError || error}
        </span>
      )}

      {files.length > 0 && (
        <div className="file-upload-list">
          {files.map((file, index) => (
            <div key={index} className="file-upload-item">
              <i className={`fas ${getFileIcon(file.name)} file-upload-item-icon`}></i>
              <div className="file-upload-item-info">
                <span className="file-upload-item-name">{file.name}</span>
                <span className="file-upload-item-size">{formatFileSize(file.size)}</span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  className="file-upload-item-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(index);
                  }}
                  aria-label="Remove file"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
