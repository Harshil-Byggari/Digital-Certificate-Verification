import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { Camera, Upload, X, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export function extractReference(raw) {
  if (!raw) return '';
  const text = String(raw).trim();
  try {
    if (text.startsWith('http://') || text.startsWith('https://')) {
      const url = new URL(text);
      return url.searchParams.get('ref') || url.searchParams.get('certificate_no') || url.searchParams.get('q') || text;
    }
  } catch {}
  return text;
}

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [mode, setMode] = useState('upload'); // 'camera' | 'upload'
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setError(null);
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setError(null);
    setLoading(true);
    setMode('camera');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        scanVideoFrame();
      }
    } catch (err) {
      console.error('Camera access denied or unavailable:', err);
      setError('Unable to access camera. Please allow camera permissions or upload a QR image.');
      setMode('upload');
    } finally {
      setLoading(false);
    }
  };

  const scanVideoFrame = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        stopCamera();
        const ref = extractReference(code.data);
        onScanSuccess(ref, 'QR');
        onClose();
        return;
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  const handleFileUpload = (e) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          const ref = extractReference(code.data);
          onScanSuccess(ref, 'QR');
          onClose();
        } else {
          setError('No valid QR code was detected in this image. Please upload a clear QR code image or try manual input.');
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSampleSelect = (code) => {
    stopCamera();
    onScanSuccess(code, 'QR');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-900">Scan Certificate QR</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                stopCamera();
                setMode('upload');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Image
            </button>
            <button
              onClick={startCamera}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'camera' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Live Camera
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode View */}
          {mode === 'camera' ? (
            <div className="relative aspect-square w-full bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <div className="absolute inset-8 border-2 border-dashed border-blue-400 rounded-2xl pointer-events-none animate-pulse" />
              <div className="absolute bottom-3 text-center w-full text-xs text-white/80 bg-black/40 py-1">
                Point camera at the certificate QR code
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/30 group">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-slate-700">Choose QR Code image</span>
                <span className="text-xs text-slate-500 mt-1">PNG, JPG, or SVG</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Instant Test Sample Chips */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Or test with sample verified codes:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSampleSelect('DCVS-2026-001')}
                    className="p-2 text-left bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800 flex items-center justify-between"
                  >
                    <span>DCVS-2026-001</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-200/60 rounded">Valid</span>
                  </button>
                  <button
                    onClick={() => handleSampleSelect('DCVS-2026-002')}
                    className="p-2 text-left bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-medium text-amber-800 flex items-center justify-between"
                  >
                    <span>DCVS-2026-002</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-200/60 rounded">Expired</span>
                  </button>
                  <button
                    onClick={() => handleSampleSelect('DCVS-2026-003')}
                    className="p-2 text-left bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-medium text-red-800 flex items-center justify-between"
                  >
                    <span>DCVS-2026-003</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-200/60 rounded">Revoked</span>
                  </button>
                  <button
                    onClick={() => handleSampleSelect('DCVS-2026-004')}
                    className="p-2 text-left bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-medium text-blue-800 flex items-center justify-between"
                  >
                    <span>DCVS-2026-004</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-200/60 rounded">Draft</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
