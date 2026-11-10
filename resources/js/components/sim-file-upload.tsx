import {
    Camera,
    FileText,
    FileUp,
    Image as ImageIcon,
    LoaderCircle,
    ScanLine,
    TriangleAlert,
    X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const OPENCV_URL = 'https://docs.opencv.org/4.x/opencv.js';
const DETECTION_MAX_DIMENSION = 720;
const DETECTION_INTERVAL_MS = 700;
const OUTPUT_MAX_WIDTH = 2200;
const OUTPUT_MAX_HEIGHT = 3200;

type ScanMode = 'document' | 'color' | 'monochrome';
type ScanPage = {
    id: string;
    sourceBlob: Blob;
    outputBlob: Blob;
    previewUrl: string;
    width: number;
    height: number;
    mode: ScanMode;
};
type ScanPoint = { x: number; y: number };
type ScanCorners = {
    topLeftCorner: ScanPoint;
    topRightCorner: ScanPoint;
    bottomLeftCorner: ScanPoint;
    bottomRightCorner: ScanPoint;
};
type DocumentScanner = {
    findPaperContour: (image: unknown) => unknown;
    getCornerPoints: (contour: unknown, image: unknown) => ScanCorners;
    extractPaper: (
        image: HTMLCanvasElement,
        resultWidth: number,
        resultHeight: number,
        cornerPoints?: ScanCorners,
    ) => HTMLCanvasElement | null;
};

let openCvPromise: Promise<void> | null = null;

export function SimFileUpload({
    value,
    onChange,
    accept = 'application/pdf',
    label = 'Pilih file PDF',
    description,
    maxSizeMb = 10,
    enableScan = true,
}: {
    value?: File | null;
    onChange: (file: File | null) => void;
    accept?: string;
    label?: string;
    description?: string;
    maxSizeMb?: number;
    enableScan?: boolean;
}) {
    const id = useId();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scanOpen, setScanOpen] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [scannerWarning, setScannerWarning] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [scanPages, setScanPages] = useState<ScanPage[]>([]);
    const [scanMode, setScanMode] = useState<ScanMode>('document');
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const detectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processingRef = useRef(false);
    const latestCornersRef = useRef<{
        corners: ScanCorners;
        capturedAt: number;
    } | null>(null);
    const scannerRef = useRef<DocumentScanner | null>(null);

    useEffect(() => {
        if (!value) {
            setPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(value);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [value]);

    const isImage = value?.type.startsWith('image/');
    const canScan = enableScan;
    const supportsPdf = accept.includes('pdf') || accept.includes('.pdf');

    useEffect(() => () => stopCamera(), []);

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        latestCornersRef.current = null;
        const overlay = overlayRef.current;
        overlay
            ?.getContext('2d')
            ?.clearRect(0, 0, overlay.width, overlay.height);
        setCameraReady(false);
    };

    const clearScanPages = () => {
        setScanPages((pages) => {
            pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
            return [];
        });
        setSelectedPageId(null);
    };

    const setProcessingState = (value: boolean) => {
        processingRef.current = value;
        setProcessing(value);
    };

    const openScanner = async () => {
        setError(null);
        setScannerWarning(null);
        clearScanPages();
        setScanOpen(true);
        try {
            await loadOpenCv();
            // jscanify ships its browser bundle without TypeScript declarations.
            // @ts-expect-error The client entry is the documented browser build.
            const { default: Jscanify } = await import('jscanify/client');
            scannerRef.current = new Jscanify();
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 2560, max: 2560 },
                    frameRate: { ideal: 24, max: 30 },
                },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setScannerWarning(
                    getScannerCapabilityWarning(stream, videoRef.current),
                );
                setCameraReady(true);
            }
        } catch {
            stopCamera();
            setScanOpen(false);
            setError(
                'Kamera tidak dapat digunakan. Periksa izin kamera atau pilih file dari perangkat.',
            );
        }
    };

    useEffect(() => {
        if (!scanOpen || !cameraReady) return;

        let cancelled = false;
        let timeoutId = 0;

        const analyze = () => {
            if (cancelled) return;
            const video = videoRef.current;
            const overlay = overlayRef.current;
            const scanner = scannerRef.current;

            if (
                !processingRef.current &&
                video &&
                overlay &&
                scanner &&
                video.videoWidth
            ) {
                const detectionCanvas =
                    detectionCanvasRef.current ??
                    document.createElement('canvas');
                detectionCanvasRef.current = detectionCanvas;

                const corners = detectDocumentCorners(
                    video,
                    scanner,
                    detectionCanvas,
                    overlay,
                );

                latestCornersRef.current = corners
                    ? { corners, capturedAt: performance.now() }
                    : null;
            }

            timeoutId = window.setTimeout(analyze, DETECTION_INTERVAL_MS);
        };

        analyze();

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [cameraReady, scanOpen]);

    const captureScan = async () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight) return;
        setError(null);
        setProcessingState(true);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas
                .getContext('2d')
                ?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const scanner = scannerRef.current;
            if (!scanner) throw new Error('Scanner belum siap');

            const recentDetection = latestCornersRef.current;
            let corners =
                recentDetection &&
                performance.now() - recentDetection.capturedAt < 1800
                    ? recentDetection.corners
                    : null;

            if (!corners) {
                const overlay = overlayRef.current;
                const detectionCanvas =
                    detectionCanvasRef.current ??
                    document.createElement('canvas');
                detectionCanvasRef.current = detectionCanvas;
                corners =
                    overlay &&
                    detectDocumentCorners(
                        video,
                        scanner,
                        detectionCanvas,
                        overlay,
                    );
            }

            if (!corners) throw new Error('Dokumen tidak terdeteksi');

            const sourceWidth = Math.max(
                distanceBetween(corners.topLeftCorner, corners.topRightCorner),
                distanceBetween(
                    corners.bottomLeftCorner,
                    corners.bottomRightCorner,
                ),
            );
            const sourceHeight = Math.max(
                distanceBetween(
                    corners.topLeftCorner,
                    corners.bottomLeftCorner,
                ),
                distanceBetween(
                    corners.topRightCorner,
                    corners.bottomRightCorner,
                ),
            );
            const shortSide = Math.min(sourceWidth, sourceHeight);
            const longSide = Math.max(sourceWidth, sourceHeight);
            if (shortSide < 600 || longSide < 800) {
                throw new Error('Dokumen terlalu jauh');
            }

            // Jangan meng-upscale dokumen kecil ke ukuran F4 tetap: teks akan burik.
            const outputScale = Math.min(
                1,
                OUTPUT_MAX_WIDTH / sourceWidth,
                OUTPUT_MAX_HEIGHT / sourceHeight,
            );
            const resultWidth = Math.round(sourceWidth * outputScale);
            const resultHeight = Math.round(sourceHeight * outputScale);
            const result = scanner.extractPaper(
                canvas,
                resultWidth,
                resultHeight,
                corners,
            );
            if (!result) throw new Error('Dokumen tidak terdeteksi');

            const sourceBlob = await canvasToBlob(result, 0.9);
            const enhanced = await enhanceDocument(result, scanMode);
            const outputBlob = await canvasToBlob(enhanced, 0.86);
            const previewUrl = URL.createObjectURL(outputBlob);
            const pageId = String(Date.now()) + '-' + scanPages.length;

            result.width = 1;
            result.height = 1;
            if (enhanced !== result) {
                enhanced.width = 1;
                enhanced.height = 1;
            }
            canvas.width = 1;
            canvas.height = 1;

            setScanPages((pages) => [
                ...pages,
                {
                    id: pageId,
                    sourceBlob,
                    outputBlob,
                    previewUrl,
                    width: resultWidth,
                    height: resultHeight,
                    mode: scanMode,
                },
            ]);
            setSelectedPageId(pageId);
        } catch (captureError) {
            setError(
                captureError instanceof Error &&
                    captureError.message === 'Dokumen terlalu jauh'
                    ? 'Dokumen terlalu jauh dari kamera. Dekatkan iPhone sampai kertas memenuhi bidang kamera.'
                    : 'Dokumen belum dapat dipindai. Pastikan kertas terlihat utuh dan memiliki latar yang kontras.',
            );
        } finally {
            setProcessingState(false);
        }
    };

    const removeScanPage = (pageId: string) => {
        setScanPages((pages) => {
            const page = pages.find((item) => item.id === pageId);
            if (page) URL.revokeObjectURL(page.previewUrl);
            const nextPages = pages.filter((item) => item.id !== pageId);
            if (selectedPageId === pageId) {
                const nextSelected = nextPages.at(-1) ?? null;
                setSelectedPageId(nextSelected?.id ?? null);
                if (nextSelected) setScanMode(nextSelected.mode);
            }
            return nextPages;
        });
    };

    const applyScanMode = async (mode: ScanMode) => {
        if (processingRef.current) return;
        setError(null);
        setScanMode(mode);
        const selectedPage = scanPages.find(
            (page) => page.id === selectedPageId,
        );
        if (!selectedPage || selectedPage.mode === mode) return;

        setProcessingState(true);
        try {
            const source = await blobToCanvas(selectedPage.sourceBlob);
            const enhanced = await enhanceDocument(source, mode);
            const outputBlob = await canvasToBlob(enhanced, 0.86);
            const previewUrl = URL.createObjectURL(outputBlob);

            source.width = 1;
            source.height = 1;
            if (enhanced !== source) {
                enhanced.width = 1;
                enhanced.height = 1;
            }

            setScanPages((pages) =>
                pages.map((page) => {
                    if (page.id !== selectedPage.id) return page;
                    URL.revokeObjectURL(page.previewUrl);
                    return {
                        ...page,
                        outputBlob,
                        previewUrl,
                        mode,
                    };
                }),
            );
        } catch {
            setError(
                'Tampilan hasil scan belum dapat diubah. Silakan coba lagi.',
            );
        } finally {
            setProcessingState(false);
        }
    };

    const finishScan = async () => {
        if (scanPages.length === 0) return;
        setProcessingState(true);
        stopCamera();
        try {
            const file =
                scanPages.length > 1 || supportsPdf
                    ? new File(
                          [await scanPagesToPdfBlob(scanPages)],
                          'scan-' + Date.now() + '.pdf',
                          { type: 'application/pdf' },
                      )
                    : new File(
                          [scanPages[0].outputBlob],
                          'scan-' + Date.now() + '.jpg',
                          { type: 'image/jpeg' },
                      );

            if (file.size > maxSizeMb * 1024 * 1024) {
                throw new Error('File scan terlalu besar');
            }

            onChange(file);
            clearScanPages();
            setScanOpen(false);
        } catch (finishError) {
            setError(
                finishError instanceof Error &&
                    finishError.message === 'File scan terlalu besar'
                    ? 'Hasil scan melebihi batas ' +
                          maxSizeMb +
                          ' MB. Kurangi jumlah halaman atau gunakan mode hitam putih.'
                    : 'Halaman scan belum dapat digabung. Silakan coba lagi.',
            );
        } finally {
            setProcessingState(false);
        }
    };

    const selectFile = async (file: File | null, input: HTMLInputElement) => {
        if (!file) return;
        if (
            file.size > maxSizeMb * 1024 * 1024 &&
            !file.type.startsWith('image/')
        ) {
            setError(`Ukuran file melebihi batas ${maxSizeMb} MB.`);
            onChange(null);
            input.value = '';
            return;
        }
        setError(null);
        setProcessing(true);
        try {
            onChange(
                file.type.startsWith('image/')
                    ? await compressImage(file)
                    : file,
            );
        } catch {
            setError('File tidak dapat diproses. Silakan pilih file lain.');
            onChange(null);
        } finally {
            setProcessing(false);
        }
    };

    const selectedScanPage =
        scanPages.find((page) => page.id === selectedPageId) ??
        scanPages.at(-1) ??
        null;

    return (
        <>
            <div
                className={cn(
                    'max-w-full min-w-0 overflow-hidden rounded-md border border-dashed border-input bg-muted/20 transition-colors hover:border-ring hover:bg-accent/40',
                    value && 'border-primary/50 bg-primary/5',
                )}
            >
                <div className="flex min-h-16 flex-wrap items-center gap-3 px-3 py-2.5">
                    <label
                        htmlFor={id}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30"
                    >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                            {value ? (
                                isImage ? (
                                    <ImageIcon className="size-4" />
                                ) : (
                                    <FileText className="size-4" />
                                )
                            ) : (
                                <FileUp className="size-4" />
                            )}
                        </span>
                        <span className="min-w-0 flex-1 text-sm">
                            <span className="block truncate font-medium">
                                {processing
                                    ? 'Memproses file…'
                                    : (value?.name ?? label)}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                                {value
                                    ? `${formatBytes(value.size)} - siap diunggah`
                                    : (description ??
                                      `PDF, maksimal ${maxSizeMb} MB per file`)}
                            </span>
                        </span>
                    </label>
                    {canScan && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void openScanner()}
                            disabled={processing}
                            className="min-h-11"
                        >
                            <ScanLine className="size-4" /> Scan
                        </Button>
                    )}
                    {value && (
                        <button
                            type="button"
                            aria-label="Hapus file"
                            className="min-h-11 min-w-11 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => onChange(null)}
                        >
                            <X className="size-4" />
                        </button>
                    )}
                    <input
                        id={id}
                        type="file"
                        accept={accept}
                        className="sr-only"
                        disabled={processing}
                        onChange={(event) =>
                            void selectFile(
                                event.target.files?.[0] ?? null,
                                event.currentTarget,
                            )
                        }
                    />
                </div>
                {value && previewUrl && (
                    <div className="border-t px-3 pt-2 pb-3">
                        <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                            Preview
                        </div>
                        {isImage ? (
                            <img
                                src={previewUrl}
                                alt={`Preview ${value.name}`}
                                className="max-h-96 max-w-full rounded border object-contain"
                            />
                        ) : (
                            <iframe
                                title={`Preview ${value.name}`}
                                src={previewUrl}
                                className="block h-[min(65vh,34rem)] w-full rounded border bg-background"
                            />
                        )}
                    </div>
                )}
                {error && (
                    <div className="px-3 pb-3 text-xs font-medium text-destructive">
                        {error}
                    </div>
                )}
            </div>
            <Dialog
                open={scanOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        stopCamera();
                        clearScanPages();
                        setScanOpen(false);
                    }
                }}
            >
                <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
                    <DialogHeader>
                        <DialogTitle>Scan dokumen</DialogTitle>
                        <DialogDescription>
                            Letakkan dokumen di bidang kamera. Hasil scan akan
                            dipotong dan dikompres otomatis.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative mx-auto max-h-[52dvh] w-full max-w-md overflow-hidden rounded-md border bg-black">
                        <video
                            ref={videoRef}
                            muted
                            playsInline
                            className="aspect-[8.5/13] h-full w-full object-cover"
                        />
                        <canvas
                            ref={overlayRef}
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                        />
                    </div>
                    {!cameraReady && (
                        <p className="text-sm text-muted-foreground">
                            <LoaderCircle className="mr-2 inline size-4 animate-spin" />
                            Menyiapkan kamera…
                        </p>
                    )}
                    {cameraReady && scannerWarning && (
                        <div
                            role="status"
                            className="flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                        >
                            <TriangleAlert
                                aria-hidden="true"
                                className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400"
                            />
                            <div>
                                <p className="font-medium">
                                    Perangkat mungkin kurang optimal
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    {scannerWarning}
                                </p>
                            </div>
                        </div>
                    )}
                    {selectedScanPage && (
                        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                            <div className="flex min-w-0 justify-center rounded-md border bg-background p-2">
                                <img
                                    src={selectedScanPage.previewUrl}
                                    alt="Pratinjau hasil scan"
                                    className="max-h-[32dvh] max-w-full rounded object-contain"
                                />
                            </div>
                            <div>
                                <p className="mb-2 text-sm font-medium">
                                    Tampilan hasil
                                </p>
                                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                                    {(
                                        [
                                            ['document', 'Dokumen jelas'],
                                            ['color', 'Warna asli'],
                                            ['monochrome', 'Hitam putih'],
                                        ] as const
                                    ).map(([mode, modeLabel]) => (
                                        <Button
                                            key={mode}
                                            type="button"
                                            size="sm"
                                            variant={
                                                selectedScanPage.mode === mode
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                            className="min-h-11"
                                            disabled={processing}
                                            onClick={() =>
                                                void applyScanMode(mode)
                                            }
                                        >
                                            {modeLabel}
                                        </Button>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Dokumen jelas mempertajam teks tanpa
                                    menghilangkan warna stempel dan tanda
                                    tangan.
                                </p>
                            </div>
                        </div>
                    )}
                    {scanPages.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 p-2 sm:grid-cols-5">
                            {scanPages.map((page, index) => (
                                <div
                                    key={page.id}
                                    className={cn(
                                        'relative overflow-hidden rounded-md border-2 bg-background',
                                        selectedScanPage?.id === page.id
                                            ? 'border-primary'
                                            : 'border-transparent',
                                    )}
                                >
                                    <button
                                        type="button"
                                        aria-label={`Pilih halaman ${index + 1}`}
                                        className="block min-h-11 w-full"
                                        onClick={() => {
                                            setSelectedPageId(page.id);
                                            setScanMode(page.mode);
                                        }}
                                    >
                                        <img
                                            src={page.previewUrl}
                                            alt={`Halaman ${index + 1}`}
                                            className="aspect-[8.5/13] w-full object-cover"
                                        />
                                    </button>
                                    <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-background/90 px-1.5 text-[11px] font-medium">
                                        {index + 1}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label={`Hapus halaman ${index + 1}`}
                                        className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-md border bg-background/95 text-muted-foreground shadow-sm hover:text-foreground"
                                        onClick={() => removeScanPage(page.id)}
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {error && (
                        <p
                            role="alert"
                            className="text-sm font-medium text-destructive"
                        >
                            {error}
                        </p>
                    )}
                    <p aria-live="polite" className="sr-only">
                        {processing
                            ? 'Sedang memproses hasil scan'
                            : `${scanPages.length} halaman siap`}
                    </p>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                stopCamera();
                                clearScanPages();
                                setScanOpen(false);
                            }}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void captureScan()}
                            disabled={!cameraReady || processing}
                        >
                            <Camera className="size-4" />
                            {processing ? 'Memproses…' : 'Scan halaman'}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void finishScan()}
                            disabled={scanPages.length === 0 || processing}
                        >
                            <FileUp className="size-4" />
                            Selesai ({scanPages.length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function detectDocumentCorners(
    video: HTMLVideoElement,
    scanner: DocumentScanner,
    detectionCanvas: HTMLCanvasElement,
    overlay: HTMLCanvasElement,
): ScanCorners | null {
    const scale = Math.min(
        1,
        DETECTION_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight),
    );
    detectionCanvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    detectionCanvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    overlay.width = detectionCanvas.width;
    overlay.height = detectionCanvas.height;

    const context = detectionCanvas.getContext('2d', {
        willReadFrequently: true,
    });
    const overlayContext = overlay.getContext('2d');
    if (!context || !overlayContext) return null;

    context.drawImage(
        video,
        0,
        0,
        detectionCanvas.width,
        detectionCanvas.height,
    );
    overlayContext.clearRect(0, 0, overlay.width, overlay.height);

    const cv = window.cv as
        | { imread?: (image: HTMLCanvasElement) => unknown }
        | undefined;
    if (!cv?.imread) return null;

    let sourceImage: unknown;
    let contour: unknown;
    try {
        sourceImage = cv.imread(detectionCanvas);
        contour = scanner.findPaperContour(sourceImage);
        if (!contour) return null;

        const corners = scanner.getCornerPoints(contour, sourceImage);
        if (!hasUsableCorners(corners, detectionCanvas)) return null;

        drawDetectedOutline(overlayContext, corners);
        const scaleX = video.videoWidth / detectionCanvas.width;
        const scaleY = video.videoHeight / detectionCanvas.height;
        return scaleScanCorners(corners, scaleX, scaleY);
    } catch {
        return null;
    } finally {
        deleteOpenCvObject(contour);
        deleteOpenCvObject(sourceImage);
    }
}

function hasUsableCorners(
    corners: ScanCorners,
    canvas: HTMLCanvasElement,
): boolean {
    const points = [
        corners?.topLeftCorner,
        corners?.topRightCorner,
        corners?.bottomRightCorner,
        corners?.bottomLeftCorner,
    ];
    if (
        points.some(
            (point) =>
                !point ||
                !Number.isFinite(point.x) ||
                !Number.isFinite(point.y),
        )
    ) {
        return false;
    }

    const area = points.reduce((total, point, index) => {
        const nextPoint = points[(index + 1) % points.length];
        return total + point.x * nextPoint.y - nextPoint.x * point.y;
    }, 0);

    return Math.abs(area) / 2 > canvas.width * canvas.height * 0.12;
}

function drawDetectedOutline(
    context: CanvasRenderingContext2D,
    corners: ScanCorners,
) {
    context.beginPath();
    context.moveTo(corners.topLeftCorner.x, corners.topLeftCorner.y);
    context.lineTo(corners.topRightCorner.x, corners.topRightCorner.y);
    context.lineTo(corners.bottomRightCorner.x, corners.bottomRightCorner.y);
    context.lineTo(corners.bottomLeftCorner.x, corners.bottomLeftCorner.y);
    context.closePath();
    context.strokeStyle = '#22d3ee';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
}

function scaleScanCorners(
    corners: ScanCorners,
    scaleX: number,
    scaleY: number,
): ScanCorners {
    const scalePoint = (point: ScanPoint) => ({
        x: point.x * scaleX,
        y: point.y * scaleY,
    });
    return {
        topLeftCorner: scalePoint(corners.topLeftCorner),
        topRightCorner: scalePoint(corners.topRightCorner),
        bottomLeftCorner: scalePoint(corners.bottomLeftCorner),
        bottomRightCorner: scalePoint(corners.bottomRightCorner),
    };
}

function deleteOpenCvObject(value: unknown) {
    if (
        value &&
        typeof value === 'object' &&
        'delete' in value &&
        typeof value.delete === 'function'
    ) {
        value.delete();
    }
}

async function enhanceDocument(
    source: HTMLCanvasElement,
    mode: ScanMode,
): Promise<HTMLCanvasElement> {
    await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
    );
    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    const context = output.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Hasil scan tidak dapat diproses');

    context.filter =
        mode === 'color'
            ? 'brightness(1.03) contrast(1.08) saturate(1.03)'
            : mode === 'document'
              ? 'brightness(1.06) contrast(1.2) saturate(0.9)'
              : 'grayscale(1) brightness(1.08) contrast(1.25)';
    context.drawImage(source, 0, 0);
    context.filter = 'none';
    if (mode === 'color') return output;

    const image = context.getImageData(0, 0, output.width, output.height);
    const pixels = image.data;
    for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;

        if (mode === 'monochrome') {
            const normalized = clamp((luminance - 118) / 78, 0, 1);
            const value = Math.round(255 * normalized * normalized);
            pixels[index] = value;
            pixels[index + 1] = value;
            pixels[index + 2] = value;
            continue;
        }

        const normalized = clamp((luminance - 28) / 200, 0, 1);
        const paperTone = 255 * Math.pow(normalized, 0.86);
        pixels[index] = clamp(paperTone + (red - luminance) * 0.7, 0, 255);
        pixels[index + 1] = clamp(
            paperTone + (green - luminance) * 0.7,
            0,
            255,
        );
        pixels[index + 2] = clamp(paperTone + (blue - luminance) * 0.7, 0, 255);
    }
    context.putImageData(image, 0, 0);
    return output;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function getScannerCapabilityWarning(
    stream: MediaStream,
    video: HTMLVideoElement,
): string | null {
    const settings = stream.getVideoTracks()[0]?.getSettings();
    const width = settings?.width ?? video.videoWidth;
    const height = settings?.height ?? video.videoHeight;
    const memory = (navigator as Navigator & { deviceMemory?: number })
        .deviceMemory;
    const hasLimitedPerformance =
        navigator.hardwareConcurrency <= 4 ||
        (memory !== undefined && memory <= 4);
    const hasLimitedCamera =
        Math.min(width, height) < 720 || width * height < 900_000;

    if (hasLimitedPerformance && hasLimitedCamera) {
        return 'Kemampuan perangkat dan resolusi kamera terdeteksi terbatas. Proses scan mungkin lebih lambat dan teks kecil bisa kurang tajam. Gunakan pencahayaan terang dan tunggu sampai pemrosesan selesai.';
    }
    if (hasLimitedPerformance) {
        return 'Pemrosesan scan mungkin terasa lebih lambat. Ambil halaman satu per satu dan tunggu sampai pemrosesan selesai sebelum melanjutkan.';
    }
    if (hasLimitedCamera) {
        return 'Resolusi kamera yang tersedia cukup rendah, sehingga teks kecil mungkin kurang tajam. Dekatkan dokumen dan gunakan pencahayaan terang.';
    }
    return null;
}

async function loadOpenCv(): Promise<void> {
    const existingCv = window.cv as
        | { Mat?: unknown; onRuntimeInitialized?: () => void }
        | undefined;
    if (existingCv?.Mat) return;
    if (openCvPromise) return openCvPromise;

    openCvPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = OPENCV_URL;
        script.async = true;
        script.onload = () => {
            const cv = window.cv as
                | { Mat?: unknown; onRuntimeInitialized?: () => void }
                | undefined;
            if (!cv) {
                reject(new Error('OpenCV tidak tersedia'));
                return;
            }
            if (cv.Mat) {
                resolve();
                return;
            }
            const previousReady = cv.onRuntimeInitialized;
            cv.onRuntimeInitialized = () => {
                previousReady?.();
                resolve();
            };
        };
        script.onerror = () => reject(new Error('OpenCV gagal dimuat'));
        document.head.appendChild(script);
    });
    try {
        await openCvPromise;
    } catch (error) {
        openCvPromise = null;
        throw error;
    }
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    quality = 0.86,
): Promise<Blob> {
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) =>
                blob ? resolve(blob) : reject(new Error('Canvas kosong')),
            'image/jpeg',
            quality,
        ),
    );
}

async function scanPagesToPdfBlob(pages: ScanPage[]): Promise<Blob> {
    const pageWidth = 612;
    const pageHeight = 936;
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [
        encoder.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n'),
    ];
    const offsets: number[] = [0];
    let length = chunks[0].length;
    const appendObject = (object: Uint8Array) => {
        offsets.push(length);
        chunks.push(object);
        length += object.length;
    };
    appendObject(
        encoder.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    );
    const pageObjectIds = pages.map((_, index) => 3 + index * 3);
    appendObject(
        encoder.encode(
            `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
        ),
    );

    for (const [index, page] of pages.entries()) {
        const jpeg = new Uint8Array(await page.outputBlob.arrayBuffer());
        const pageObjectId = 3 + index * 3;
        const imageObjectId = pageObjectId + 1;
        const contentObjectId = pageObjectId + 2;
        const scale = Math.min(
            pageWidth / page.width,
            pageHeight / page.height,
        );
        const imageWidth = page.width * scale;
        const imageHeight = page.height * scale;
        const offsetX = (pageWidth - imageWidth) / 2;
        const offsetY = (pageHeight - imageHeight) / 2;
        appendObject(
            encoder.encode(
                `${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj\n`,
            ),
        );
        appendObject(
            concatBytes([
                encoder.encode(
                    `${imageObjectId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
                ),
                jpeg,
                encoder.encode('\nendstream\nendobj\n'),
            ]),
        );
        const content = encoder.encode(
            `q\n${imageWidth} 0 0 ${imageHeight} ${offsetX} ${offsetY} cm\n/Im0 Do\nQ\n`,
        );
        appendObject(
            concatBytes([
                encoder.encode(
                    `${contentObjectId} 0 obj\n<< /Length ${content.length} >>\nstream\n`,
                ),
                content,
                encoder.encode('endstream\nendobj\n'),
            ]),
        );
    }
    const xrefOffset = length;
    const objectCount = 2 + pages.length * 3;
    const xref = [
        `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`,
        ...offsets
            .slice(1)
            .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
        `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    ].join('');
    chunks.push(encoder.encode(xref));
    return new Blob(chunks as unknown as BlobPart[], {
        type: 'application/pdf',
    });
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(
        chunks.reduce((total, chunk) => total + chunk.length, 0),
    );
    let offset = 0;
    chunks.forEach((chunk) => {
        result.set(chunk, offset);
        offset += chunk.length;
    });
    return result;
}

function distanceBetween(first: ScanPoint, second: ScanPoint): number {
    return Math.hypot(first.x - second.x, first.y - second.y);
}

async function compressImage(file: File): Promise<File> {
    const image = await loadImage(file);
    const maxDimension = 2200;
    const scale = Math.min(
        1,
        maxDimension / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas
        .getContext('2d')
        ?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas);
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'dokumen';
    return new File([blob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
    });
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
    const image = await loadImage(blob);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d')?.drawImage(image, 0, 0);
    return canvas;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Gambar tidak dapat dibaca'));
        };
        image.src = url;
    });
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
