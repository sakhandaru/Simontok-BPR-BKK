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

    class Jscanify {
        highlightPaper(
            image: HTMLCanvasElement,
            options?: { color?: string; thickness?: number },
        ): HTMLCanvasElement;
        extractPaper(
            image: HTMLCanvasElement,
            resultWidth: number,
            resultHeight: number,
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
