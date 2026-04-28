import { isbot } from 'isbot';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function botSsr(options) {
    if (!options) {
        throw new Error('ngx-bot-ssr: options required');
    }
    if (!options.shell) {
        throw new Error('ngx-bot-ssr: options.shell (path to index.csr.html) required');
    }
    if (typeof options.ssr !== 'function') {
        throw new Error('ngx-bot-ssr: options.ssr (handler returning Promise<Response|null|undefined>) required');
    }
    if (typeof options.writeResponse !== 'function') {
        throw new Error('ngx-bot-ssr: options.writeResponse (e.g. writeResponseToNodeResponse from @angular/ssr/node) required');
    }

    // Read the CSR shell once at construction. Sync I/O at boot is fine —
    // Node already does this for every require()/import. Beats paying the
    // latency on the first request, beats hiding ENOENT until traffic shows up.
    const shellHtml = readFileSync(options.shell, 'utf-8');

    const detect = options.isBot || ((ua) => !ua || isbot(ua));
    const cacheControl = options.shellCacheControl || 'no-cache';

    return function ngxBotSsrMiddleware(req, res, next) {
        res.setHeader('Vary', 'User-Agent');

        if (!detect(req.headers['user-agent'])) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', cacheControl);
            res.send(shellHtml);
            return;
        }

        Promise.resolve(options.ssr(req))
            .then((response) => (response ? options.writeResponse(response, res) : next()))
            .catch(next);
    };
}

export function angularBotSsr(options) {
    if (!options) {
        throw new Error('ngx-bot-ssr: angularBotSsr options required');
    }
    if (!options.browserDistFolder) {
        throw new Error('ngx-bot-ssr: angularBotSsr options.browserDistFolder required');
    }
    if (!options.angularApp || typeof options.angularApp.handle !== 'function') {
        throw new Error('ngx-bot-ssr: angularBotSsr options.angularApp (AngularNodeAppEngine instance) required');
    }
    if (typeof options.writeResponseToNodeResponse !== 'function') {
        throw new Error('ngx-bot-ssr: angularBotSsr options.writeResponseToNodeResponse (from @angular/ssr/node) required');
    }

    return botSsr({
        shell: options.shell || join(options.browserDistFolder, 'index.csr.html'),
        ssr: (req) => options.angularApp.handle(req),
        writeResponse: options.writeResponseToNodeResponse,
        isBot: options.isBot,
        shellCacheControl: options.shellCacheControl,
    });
}

export default { botSsr, angularBotSsr };
