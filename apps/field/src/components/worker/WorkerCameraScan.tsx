"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CAMERA_UNAVAILABLE_COPY,
  isBarcodeDetectorAvailable,
  sanitizeVinInput
} from "@/lib/worker-scanner-utils";

type WorkerCameraScanProps = {
  readonly disabled?: boolean;
  readonly onDetected: (value: string) => void;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

export function WorkerCameraScan({ disabled = false, onDetected }: WorkerCameraScanProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [available] = useState(() => isBarcodeDetectorAvailable());
  const [active, setActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  async function startCamera() {
    setErrorMessage(null);

    if (!available) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setActive(true);
    } catch {
      setErrorMessage("Unable to access the camera. Use manual entry or a hardware scanner.");
      stopCamera();
    }
  }

  async function scanFrame() {
    if (!videoRef.current || !available) {
      return;
    }

    setScanning(true);
    setErrorMessage(null);

    try {
      const Detector = (window as Window & { BarcodeDetector?: new () => BarcodeDetectorLike })
        .BarcodeDetector;

      if (!Detector) {
        setErrorMessage(CAMERA_UNAVAILABLE_COPY);
        return;
      }

      const detector = new Detector();
      const codes = await detector.detect(videoRef.current);
      const rawValue = codes.find((code) => code.rawValue)?.rawValue;

      if (!rawValue) {
        setErrorMessage("No barcode detected. Try again or enter the VIN manually.");
        return;
      }

      onDetected(sanitizeVinInput(rawValue));
      stopCamera();
    } catch {
      setErrorMessage("Camera scan failed. Use manual entry or a hardware scanner.");
    } finally {
      setScanning(false);
    }
  }

  if (!available) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {CAMERA_UNAVAILABLE_COPY}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!active ? (
        <button
          type="button"
          onClick={() => void startCamera()}
          disabled={disabled}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          Scan with camera
        </button>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
          <video ref={videoRef} className="h-48 w-full object-cover" playsInline muted />
          <div className="grid grid-cols-2 gap-px bg-slate-900">
            <button
              type="button"
              onClick={() => void scanFrame()}
              disabled={disabled || scanning}
              className="bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-600"
            >
              {scanning ? "Scanning…" : "Scan now"}
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-slate-800 px-4 py-3 text-sm font-semibold text-white"
            >
              Stop camera
            </button>
          </div>
        </div>
      )}

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
