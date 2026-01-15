import React, { useState } from 'react';
import './FileUpload.css'; // Reuse the same CSS styles

const FilePreviewModal = ({ isOpen, onClose, fileUrl, fileName }) => {
  if (!isOpen || !fileUrl) return null;

  const getExtension = (filename) => {
    if (!filename) return '';
    return filename.split('.').pop().toLowerCase();
  };

  const isImage = (filename) => {
    const extension = getExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension);
  };

  const isPdf = (filename) => {
    return getExtension(filename) === 'pdf';
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isPreviewable = isImage(fileName) || isPdf(fileName);

  return (
    <div className="file-preview-overlay" onClick={onClose}>
      <div className="file-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-preview-header">
          <span className="file-preview-title">{fileName || 'File Preview'}</span>
          <div className="file-preview-actions">
            <button
              type="button"
              className="file-preview-download"
              onClick={handleDownload}
              title="Download"
            >
              <i className="fas fa-download"></i>
            </button>
            <button
              type="button"
              className="file-preview-close"
              onClick={onClose}
              title="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div className="file-preview-content">
          {isImage(fileName) ? (
            <img src={fileUrl} alt={fileName} className="file-preview-image" />
          ) : isPdf(fileName) ? (
            <iframe
              src={fileUrl}
              title={fileName}
              className="file-preview-pdf"
            />
          ) : (
            <div className="file-preview-unsupported">
              <i className="fas fa-file fa-3x"></i>
              <p>Preview not available for this file type</p>
              <button
                type="button"
                className="file-preview-download-btn"
                onClick={handleDownload}
              >
                <i className="fas fa-download"></i> Download File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// A button component that opens file preview
export const FilePreviewButton = ({ 
  fileUrl, 
  fileName, 
  icon = 'fas fa-file', 
  title,
  className = '',
  children 
}) => {
  const [showPreview, setShowPreview] = useState(false);

  const getExtension = (filename) => {
    if (!filename) return '';
    return filename.split('.').pop().toLowerCase();
  };

  const isPreviewable = (filename) => {
    const extension = getExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf'].includes(extension);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (isPreviewable(fileName)) {
      setShowPreview(true);
    } else {
      // For non-previewable files, just download
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <>
      <button
        type="button"
        className={`file-preview-trigger ${isPreviewable(fileName) ? 'previewable' : ''} ${className}`}
        onClick={handleClick}
        title={title || (isPreviewable(fileName) ? 'Click to preview' : 'Click to download')}
      >
        <i className={icon}></i>
        {children}
      </button>
      <FilePreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        fileUrl={fileUrl}
        fileName={fileName}
      />
    </>
  );
};

export default FilePreviewModal;
