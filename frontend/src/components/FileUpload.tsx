import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  label: string
  accept?: string
  value: File | null
  onChange: (file: File | null) => void
  onOCRProcess?: (file: File) => Promise<void>
  processing?: boolean
  error?: string
}

export default function FileUpload({
  label,
  accept = 'image/*,application/pdf',
  value,
  onChange,
  onOCRProcess,
  processing = false,
  error,
}: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        onChange(file)

        // Generate preview for images
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = (e) => {
            setPreview(e.target?.result as string)
          }
          reader.readAsDataURL(file)
        } else {
          setPreview(null)
        }

        // Trigger OCR processing if handler provided
        if (onOCRProcess) {
          await onOCRProcess(file)
        }
      }
    },
    [onChange, onOCRProcess]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.split(',').reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxFiles: 1,
    disabled: processing,
  })

  const removeFile = () => {
    onChange(null)
    setPreview(null)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      {!value ? (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
            processing && 'opacity-50 cursor-not-allowed',
            error && 'border-destructive'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            {processing ? (
              <>
                <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">Processing document...</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {isDragActive ? 'Drop file here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <div className="flex items-start gap-3">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded"
              />
            ) : (
              <div className="w-20 h-20 bg-muted rounded flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{value.name}</p>
              <p className="text-xs text-muted-foreground">
                {(value.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={removeFile}
              disabled={processing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
