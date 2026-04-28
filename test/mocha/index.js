const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const { writeFileSync, unlinkSync, mkdirSync } = require('node:fs');
const express = require('express');

const { botSsr, angularBotSsr } = require('../../src');

const SHELL_HTML = '<html><body>CSR shell</body></html>';
const browserDistFolder = path.join(__dirname, 'fixture-browser');
const shellPath = path.join(browserDistFolder, 'index.csr.html');

const CHROME_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function startServer(app) {
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
}

function get(server, ua) {
    return new Promise((resolve, reject) => {
        const port = server.address().port;
        http.get({
            hostname: '127.0.0.1',
            port,
            path: '/',
            headers: ua ? { 'user-agent': ua } : {},
        }, (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        }).on('error', reject);
    });
}

function buildApp({ ssrCalls, ssrResponse }) {
    const app = express();
    app.use(botSsr({
        shell: shellPath,
        ssr: (req) => {
            ssrCalls.push(req.headers['user-agent']);
            return Promise.resolve(ssrResponse);
        },
        writeResponse: (response, res) => {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.statusCode = response.status;
            res.end(response.body);
        },
    }));
    return app;
}

describe('ngx-bot-ssr — botSsr (low level)', () => {

    before(() => {
        mkdirSync(browserDistFolder, { recursive: true });
        writeFileSync(shellPath, SHELL_HTML, 'utf-8');
    });

    after(() => {
        try { unlinkSync(shellPath); } catch (_) { /* ignore */ }
    });

    it('serves CSR shell to a real browser (Chrome UA)', async () => {
        const ssrCalls = [];
        const server = await startServer(buildApp({ ssrCalls, ssrResponse: null }));
        try {
            const res = await get(server, CHROME_UA);
            assert.strictEqual(res.status, 200);
            assert.ok(res.body.includes('CSR shell'));
            assert.strictEqual(res.headers['vary'], 'User-Agent');
            assert.strictEqual(ssrCalls.length, 0);
        } finally {
            server.close();
        }
    });

    it('runs SSR for Googlebot', async () => {
        const ssrCalls = [];
        const ssrResponse = { status: 200, body: '<html><body>prerendered</body></html>' };
        const server = await startServer(buildApp({ ssrCalls, ssrResponse }));
        try {
            const res = await get(server, GOOGLEBOT_UA);
            assert.strictEqual(res.status, 200);
            assert.ok(res.body.includes('prerendered'));
            assert.strictEqual(ssrCalls.length, 1);
        } finally {
            server.close();
        }
    });

    it('treats missing User-Agent as a bot', async () => {
        const ssrCalls = [];
        const ssrResponse = { status: 200, body: '<html><body>prerendered</body></html>' };
        const server = await startServer(buildApp({ ssrCalls, ssrResponse }));
        try {
            const res = await get(server, undefined);
            assert.strictEqual(res.status, 200);
            assert.ok(res.body.includes('prerendered'));
            assert.strictEqual(ssrCalls.length, 1);
        } finally {
            server.close();
        }
    });

    it('falls through to next() when ssr returns null/undefined', async () => {
        const ssrCalls = [];
        const app = express();
        app.use(botSsr({
            shell: shellPath,
            ssr: (req) => {
                ssrCalls.push(req.headers['user-agent']);
                return Promise.resolve(null);
            },
            writeResponse: () => { throw new Error('writeResponse should not be called when ssr returns null'); },
        }));
        app.use((req, res) => res.status(404).end('next-fallback'));

        const server = await startServer(app);
        try {
            const res = await get(server, GOOGLEBOT_UA);
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body, 'next-fallback');
            assert.strictEqual(ssrCalls.length, 1);
        } finally {
            server.close();
        }
    });

    it('forwards thrown SSR errors to next(err)', async () => {
        const app = express();
        app.use(botSsr({
            shell: shellPath,
            ssr: () => Promise.reject(new Error('boom')),
            writeResponse: () => { throw new Error('writeResponse should not be called on error'); },
        }));
        app.use((err, req, res, _next) => {
            res.status(500).end(`error: ${err.message}`);
        });

        const server = await startServer(app);
        try {
            const res = await get(server, GOOGLEBOT_UA);
            assert.strictEqual(res.status, 500);
            assert.strictEqual(res.body, 'error: boom');
        } finally {
            server.close();
        }
    });

    it('honours options.isBot override', async () => {
        const ssrCalls = [];
        const app = express();
        app.use(botSsr({
            shell: shellPath,
            isBot: () => true,
            ssr: (req) => {
                ssrCalls.push(req.headers['user-agent']);
                return Promise.resolve({ status: 200, body: 'forced-ssr' });
            },
            writeResponse: (response, res) => {
                res.statusCode = response.status;
                res.end(response.body);
            },
        }));
        const server = await startServer(app);
        try {
            const res = await get(server, CHROME_UA);
            assert.strictEqual(res.body, 'forced-ssr');
            assert.strictEqual(ssrCalls.length, 1);
        } finally {
            server.close();
        }
    });

    it('honours options.shellCacheControl', async () => {
        const app = express();
        app.use(botSsr({
            shell: shellPath,
            shellCacheControl: 'public, max-age=60',
            ssr: () => Promise.resolve(null),
            writeResponse: () => {},
        }));
        const server = await startServer(app);
        try {
            const res = await get(server, CHROME_UA);
            assert.strictEqual(res.headers['cache-control'], 'public, max-age=60');
        } finally {
            server.close();
        }
    });

    it('throws on missing required options', () => {
        assert.throws(() => botSsr(), /options required/);
        assert.throws(() => botSsr({}), /options\.shell/);
        assert.throws(() => botSsr({ shell: shellPath }), /options\.ssr/);
        assert.throws(() => botSsr({ shell: shellPath, ssr: () => null }), /options\.writeResponse/);
    });

    it('throws ENOENT at construction if shell does not exist', () => {
        assert.throws(
            () => botSsr({
                shell: path.join(browserDistFolder, 'nope.html'),
                ssr: () => null,
                writeResponse: () => {},
            }),
            /ENOENT/,
        );
    });
});

describe('ngx-bot-ssr — angularBotSsr (Angular SSR sugar)', () => {

    before(() => {
        mkdirSync(browserDistFolder, { recursive: true });
        writeFileSync(shellPath, SHELL_HTML, 'utf-8');
    });

    after(() => {
        try { unlinkSync(shellPath); } catch (_) { /* ignore */ }
    });

    function fakeAngularApp(handler) {
        return { handle: handler };
    }

    function fakeWriteResponse(response, res) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.statusCode = response.status;
        res.end(response.body);
    }

    it('wires browserDistFolder + angularApp + writeResponseToNodeResponse with no glue code', async () => {
        const ssrCalls = [];
        const angularApp = fakeAngularApp((req) => {
            ssrCalls.push(req.headers['user-agent']);
            return Promise.resolve({ status: 200, body: '<html>angular ssr</html>' });
        });

        const app = express();
        app.use(angularBotSsr({
            browserDistFolder,
            angularApp,
            writeResponseToNodeResponse: fakeWriteResponse,
        }));

        const server = await startServer(app);
        try {
            const bot = await get(server, GOOGLEBOT_UA);
            assert.ok(bot.body.includes('angular ssr'));
            assert.strictEqual(ssrCalls.length, 1);

            const human = await get(server, CHROME_UA);
            assert.ok(human.body.includes('CSR shell'));
            assert.strictEqual(ssrCalls.length, 1);
        } finally {
            server.close();
        }
    });

    it('derives shell path from browserDistFolder/index.csr.html', async () => {
        const angularApp = fakeAngularApp(() => Promise.resolve({ status: 200, body: 'ssr' }));
        const app = express();
        app.use(angularBotSsr({
            browserDistFolder,
            angularApp,
            writeResponseToNodeResponse: fakeWriteResponse,
        }));
        const server = await startServer(app);
        try {
            const res = await get(server, CHROME_UA);
            assert.ok(res.body.includes('CSR shell'));
        } finally {
            server.close();
        }
    });

    it('respects an explicit shell override', async () => {
        const customShell = path.join(browserDistFolder, 'custom.csr.html');
        writeFileSync(customShell, '<html>custom shell</html>', 'utf-8');
        try {
            const angularApp = fakeAngularApp(() => Promise.resolve(null));
            const app = express();
            app.use(angularBotSsr({
                browserDistFolder,
                shell: customShell,
                angularApp,
                writeResponseToNodeResponse: fakeWriteResponse,
            }));
            const server = await startServer(app);
            try {
                const res = await get(server, CHROME_UA);
                assert.ok(res.body.includes('custom shell'));
            } finally {
                server.close();
            }
        } finally {
            try { unlinkSync(customShell); } catch (_) { /* ignore */ }
        }
    });

    it('throws helpful errors on missing options', () => {
        assert.throws(() => angularBotSsr(), /options required/);
        assert.throws(() => angularBotSsr({}), /browserDistFolder/);
        assert.throws(() => angularBotSsr({ browserDistFolder }), /angularApp/);
        assert.throws(
            () => angularBotSsr({ browserDistFolder, angularApp: { handle: () => null } }),
            /writeResponseToNodeResponse/,
        );
    });
});
