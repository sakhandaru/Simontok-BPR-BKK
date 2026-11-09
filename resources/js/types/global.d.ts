import type { Auth } from '@/types/auth';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}

declare module 'jscanify/client' {
    type JscanifyCanvas = HTMLCanvasElement;
    type JscanifyPoint = { x: number; y: number };
    type JscanifyCorners = {
        topLeftCorner: JscanifyPoint;
        topRightCorner: JscanifyPoint;
        bottomLeftCorner: JscanifyPoint;
        bottomRightCorner: JscanifyPoint;
    };

    class Jscanify {
        findPaperContour(image: unknown): unknown;
        getCornerPoints(contour: unknown, image: unknown): JscanifyCorners;
        highlightPaper(
            image: HTMLCanvasElement,
            options?: { color?: string; thickness?: number },
        ): HTMLCanvasElement;
        extractPaper(
            image: HTMLCanvasElement,
            resultWidth: number,
            resultHeight: number,
            cornerPoints?: JscanifyCorners,
        ): JscanifyCanvas;
    }

    export default Jscanify;
}

declare global {
    interface Window {
        cv?: {
            onRuntimeInitialized?: () => void;
        };
    }
}
