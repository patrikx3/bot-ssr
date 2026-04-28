// TypeScript types for ngx-bot-ssr (ESM resolution).
//
// `Response` here refers to the global Web `Response` (from lib.dom.d.ts /
// `@types/node`'s undici types). The express types are aliased to avoid
// shadowing the global.

import type {
    Request as ExpressRequest,
    Response as ExpressResponse,
    RequestHandler,
} from 'express';

export interface BotSsrOptions {
    /** Absolute path to the CSR shell HTML (e.g. `dist/<app>/browser/index.csr.html`). Read once at construction. */
    shell: string;

    /**
     * Returns a Web `Response` (from `@angular/ssr/node`, Hono, etc.).
     * Resolving to `null` / `undefined` falls through to `next()`.
     */
    ssr: (req: ExpressRequest) =>
        | Promise<Response | null | undefined>
        | Response
        | null
        | undefined;

    /** Serialises the Web `Response` into the Node `res`. For Angular: `writeResponseToNodeResponse` from `@angular/ssr/node`. */
    writeResponse: (response: Response, res: ExpressResponse) => void;

    /** Override bot detection. Default: missing UAs treated as bots, otherwise `isbot(ua)`. */
    isBot?: (userAgent: string | undefined) => boolean;

    /** `Cache-Control` for the CSR shell response. Default: `'no-cache'`. */
    shellCacheControl?: string;
}

export interface AngularNodeAppEngineLike {
    handle: (req: ExpressRequest) =>
        | Promise<Response | null | undefined>
        | Response
        | null
        | undefined;
}

export interface AngularBotSsrOptions {
    /** Absolute path to the Angular browser dist folder. The shell is read from `${browserDistFolder}/index.csr.html` unless `shell` is given. */
    browserDistFolder: string;

    /** An `AngularNodeAppEngine` instance from `@angular/ssr/node`. */
    angularApp: AngularNodeAppEngineLike;

    /** Pass `writeResponseToNodeResponse` from `@angular/ssr/node`. */
    writeResponseToNodeResponse: (response: Response, res: ExpressResponse) => void;

    /** Override the shell path if your CSR file lives elsewhere. */
    shell?: string;

    /** Override bot detection. */
    isBot?: (userAgent: string | undefined) => boolean;

    /** `Cache-Control` for the CSR shell. Default: `'no-cache'`. */
    shellCacheControl?: string;
}

/** Low-level, framework-agnostic middleware factory. */
export function botSsr(options: BotSsrOptions): RequestHandler;

/** Sugar for the Angular SSR case — derives shell path, wires `ssr` and `writeResponse` for you. */
export function angularBotSsr(options: AngularBotSsrOptions): RequestHandler;

declare const _default: {
    botSsr: typeof botSsr;
    angularBotSsr: typeof angularBotSsr;
};

export default _default;
