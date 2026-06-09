import type { PdfAPI, PdfBackend } from "./types.js";

/**
 * `COBDCoreKit.pdf` — opens a PDF in a native viewer. No PDF plugin is
 * bundled (the common one has a stale Capacitor peer range), so the app
 * supplies the backend; without one, `open` throws.
 */
export function installPdf(backend?: PdfBackend): PdfAPI {
    return {
        async open(file) {
            if (!backend) {
                throw new Error(
                    "pdf.open: no PDF backend configured (the app must supply one)");
            }
            if (!file) throw new Error("pdf.open: file required");
            await backend.open({ url: file });
        },
    };
}
