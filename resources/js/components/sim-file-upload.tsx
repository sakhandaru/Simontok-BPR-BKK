import { Camera, FileText, FileUp, Image as ImageIcon, LoaderCircle, ScanLine, X } from 'lucide-react';
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
type ScanPage = { id: string; canvas: HTMLCanvasElement; previewUrl: string };

export function SimFileUpload({ value, onChange, accept = 'application/pdf', label = 'Pilih file PDF', description, maxSizeMb = 10, enableScan = true }: { value?: File | null; onChange: (file: File | null) => void; accept?: string; label?: string; description?: string; maxSizeMb?: number; enableScan?: boolean }) {
    const id = useId();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scanOpen, setScanOpen] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [scanPages, setScanPages] = useState<ScanPage[]>([]);
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scannerRef = useRef<{ highlightPaper: (image: HTMLCanvasElement, options?: { color?: string; thickness?: number }) => HTMLCanvasElement; extractPaper: (image: HTMLCanvasElement, resultWidth: number, resultHeight: number) => HTMLCanvasElement | null } | null>(null);

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
        setCameraReady(false);
    };

    const clearScanPages = () => {
        scanPages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
        setScanPages([]);
    };

    const openScanner = async () => {
        setError(null);
        clearScanPages();
        setScanOpen(true);
        try {
            await loadOpenCv();
            // jscanify ships its browser bundle without TypeScript declarations.
            // @ts-expect-error The client entry is the documented browser build.
            const { default: Jscanify } = await import('jscanify/client');
            scannerRef.current = new Jscanify();
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraReady(true);
            }
        } catch {
            stopCamera();
            setScanOpen(false);
            setError('Kamera tidak dapat digunakan. Periksa izin kamera atau pilih file dari perangkat.');
        }
    };

    useEffect(() => {
        if (!scanOpen || !cameraReady) return;
        const interval = window.setInterval(() => {
            const video = videoRef.current;
            const overlay = overlayRef.current;
            const scanner = scannerRef.current;
            if (!video || !overlay || !scanner || !video.videoWidth) return;
            const frame = document.createElement('canvas');
            frame.width = video.videoWidth;
            frame.height = video.videoHeight;
            frame.getContext('2d')?.drawImage(video, 0, 0, frame.width, frame.height);
            try {
                const highlighted = scanner.highlightPaper(frame, { color: '#22d3ee', thickness: Math.max(3, Math.round(frame.width / 240)) });
                overlay.width = highlighted.width;
                overlay.height = highlighted.height;
                overlay.getContext('2d')?.drawImage(highlighted, 0, 0);
            } catch {
                overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
            }
        }, 250);
        return () => window.clearInterval(interval);
    }, [cameraReady, scanOpen]);

    const captureScan = async () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight) return;
        setProcessing(true);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const scanner = scannerRef.current;
            if (!scanner) throw new Error('Scanner belum siap');
            // Gunakan rasio F4 portrait agar hasil scan tidak mengikuti rasio frame kamera.
            const result = scanner.extractPaper(canvas, 1700, 2600);
            if (!result) throw new Error('Dokumen tidak terdeteksi');
            const previewUrl = URL.createObjectURL(await canvasToBlob(result));
            setScanPages((pages) => [...pages, { id: `${Date.now()}-${pages.length}`, canvas: result, previewUrl }]);
        } catch {
            setError('Dokumen belum dapat dipindai. Pastikan kertas terlihat utuh dan memiliki latar yang kontras.');
        } finally {
            setProcessing(false);
        }
    };

    const removeScanPage = (pageId: string) => {
        setScanPages((pages) => {
            const page = pages.find((item) => item.id === pageId);
            if (page) URL.revokeObjectURL(page.previewUrl);
            return pages.filter((item) => item.id !== pageId);
        });
    };

    const finishScan = async () => {
        if (scanPages.length === 0) return;
        setProcessing(true);
        try {
            const file = scanPages.length > 1 || supportsPdf
                ? new File([await canvasesToPdfBlob(scanPages.map((page) => page.canvas))], `scan-${Date.now()}.pdf`, { type: 'application/pdf' })
                : await compressImage(new File([await canvasToBlob(scanPages[0].canvas)], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' }));
            onChange(file);
            clearScanPages();
            setScanOpen(false);
            stopCamera();
        } catch {
            setError('Halaman scan belum dapat digabung. Silakan coba lagi.');
        } finally {
            setProcessing(false);
        }
    };

    const selectFile = async (file: File | null, input: HTMLInputElement) => {
        if (!file) return;
        if (file.size > maxSizeMb * 1024 * 1024 && !file.type.startsWith('image/')) {
            setError(`Ukuran file melebihi batas ${maxSizeMb} MB.`);
            onChange(null);
            input.value = '';
            return;
        }
        setError(null);
        setProcessing(true);
        try {
            onChange(file.type.startsWith('image/') ? await compressImage(file) : file);
        } catch {
            setError('File tidak dapat diproses. Silakan pilih file lain.');
            onChange(null);
        } finally {
            setProcessing(false);
        }
    };

    return <>
    <div className={cn('min-w-0 max-w-full overflow-hidden rounded-md border border-dashed border-input bg-muted/20 transition-colors hover:border-ring hover:bg-accent/40', value && 'border-primary/50 bg-primary/5')}>
        <div className="flex min-h-16 flex-wrap items-center gap-3 px-3 py-2.5">
            <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">{value ? (isImage ? <ImageIcon className="size-4" /> : <FileText className="size-4" />) : <FileUp className="size-4" />}</span>
            <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium">{processing ? 'Memproses file…' : (value?.name ?? label)}</span>
                <span className="block truncate text-xs text-muted-foreground">{value ? `${formatBytes(value.size)} - siap diunggah` : (description ?? `PDF, maksimal ${maxSizeMb} MB per file`)}</span>
            </span>
            </label>
            {canScan && <Button type="button" variant="outline" size="sm" onClick={() => void openScanner()} disabled={processing}><ScanLine className="size-4" /> Scan</Button>}
            {value && <button type="button" aria-label="Hapus file" className="min-h-9 min-w-9 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onChange(null)}><X className="size-4" /></button>}
            <input id={id} type="file" accept={accept} className="sr-only" disabled={processing} onChange={(event) => void selectFile(event.target.files?.[0] ?? null, event.currentTarget)} />
        </div>
        {value && previewUrl && <div className="border-t px-3 pb-3 pt-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preview</div>
            {isImage ? <img src={previewUrl} alt={`Preview ${value.name}`} className="max-h-96 max-w-full rounded border object-contain" /> : <iframe title={`Preview ${value.name}`} src={previewUrl} className="block h-[min(65vh,34rem)] w-full rounded border bg-background" />}
        </div>}
        {error && <div className="px-3 pb-3 text-xs font-medium text-destructive">{error}</div>}
    </div>
    <Dialog open={scanOpen} onOpenChange={(open) => { if (!open) { stopCamera(); clearScanPages(); setScanOpen(false); } }}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>Scan dokumen</DialogTitle><DialogDescription>Letakkan dokumen di bidang kamera. Hasil scan akan dipotong dan dikompres otomatis.</DialogDescription></DialogHeader>
            <div className="relative mx-auto max-h-[70vh] w-full max-w-md overflow-hidden rounded-md border bg-black"><video ref={videoRef} muted playsInline className="aspect-[8.5/13] h-full w-full object-cover" /><canvas ref={overlayRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover" /></div>
            {!cameraReady && <p className="text-sm text-muted-foreground"><LoaderCircle className="mr-2 inline size-4 animate-spin" />Menyiapkan kamera…</p>}
            {scanPages.length > 0 && <div className="grid grid-cols-4 gap-2 rounded-md border bg-muted/20 p-2 sm:grid-cols-5">
                {scanPages.map((page, index) => <div key={page.id} className="relative overflow-hidden rounded border bg-background">
                    <img src={page.previewUrl} alt={`Halaman ${index + 1}`} className="aspect-[8.5/13] w-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 text-[11px] font-medium">{index + 1}</span>
                    <button type="button" aria-label={`Hapus halaman ${index + 1}`} className="absolute top-1 right-1 rounded bg-background/90 p-1 text-muted-foreground hover:text-foreground" onClick={() => removeScanPage(page.id)}><X className="size-3.5" /></button>
                </div>)}
            </div>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => { stopCamera(); clearScanPages(); setScanOpen(false); }}>Batal</Button><Button type="button" variant="secondary" onClick={() => void captureScan()} disabled={!cameraReady || processing}><Camera className="size-4" />{processing ? 'Memproses…' : 'Scan halaman'}</Button><Button type="button" onClick={() => void finishScan()} disabled={scanPages.length === 0 || processing}><FileUp className="size-4" />Selesai ({scanPages.length})</Button></DialogFooter>
        </DialogContent>
    </Dialog>
    </>;
}

async function loadOpenCv(): Promise<void> {
    const existingCv = window.cv as ({ Mat?: unknown; onRuntimeInitialized?: () => void } | undefined);
    if (existingCv?.Mat) return;
    await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = OPENCV_URL;
        script.async = true;
        script.onload = () => {
            const cv = window.cv as ({ Mat?: unknown; onRuntimeInitialized?: () => void } | undefined);
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
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas kosong')), 'image/jpeg', 0.86));
}

async function canvasesToPdfBlob(canvases: HTMLCanvasElement[]): Promise<Blob> {
    const pageWidth = 612;
    const pageHeight = 936;
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [encoder.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')];
    const offsets: number[] = [0];
    let length = chunks[0].length;
    const appendObject = (object: Uint8Array) => {
        offsets.push(length);
        chunks.push(object);
        length += object.length;
    };
    appendObject(encoder.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
    const pageObjectIds = canvases.map((_, index) => 3 + index * 3);
    appendObject(encoder.encode(`2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${canvases.length} >>\nendobj\n`));

    for (const [index, canvas] of canvases.entries()) {
        const jpeg = new Uint8Array(await (await canvasToBlob(canvas)).arrayBuffer());
        const pageObjectId = 3 + index * 3;
        const imageObjectId = pageObjectId + 1;
        const contentObjectId = pageObjectId + 2;
        const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
        const imageWidth = canvas.width * scale;
        const imageHeight = canvas.height * scale;
        const offsetX = (pageWidth - imageWidth) / 2;
        const offsetY = (pageHeight - imageHeight) / 2;
        appendObject(encoder.encode(`${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj\n`));
        appendObject(concatBytes([
            encoder.encode(`${imageObjectId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
            jpeg,
            encoder.encode('\nendstream\nendobj\n'),
        ]));
        const content = encoder.encode(`q\n${imageWidth} 0 0 ${imageHeight} ${offsetX} ${offsetY} cm\n/Im0 Do\nQ\n`);
        appendObject(concatBytes([encoder.encode(`${contentObjectId} 0 obj\n<< /Length ${content.length} >>\nstream\n`), content, encoder.encode('endstream\nendobj\n')]));
    }
    const xrefOffset = length;
    const objectCount = 2 + canvases.length * 3;
    const xref = [`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`, ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`), `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`].join('');
    chunks.push(encoder.encode(xref));
    return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    chunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; });
    return result;
}

async function compressImage(file: File): Promise<File> {
    const image = await loadImage(file);
    const maxDimension = 2200;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas);
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'dokumen';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
        image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak dapat dibaca')); };
        image.src = url;
    });
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
