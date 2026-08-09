/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
) as { version: string };

import type { IncomingMessage, ServerResponse } from "node:http";

interface BilibiliProxyOptions {
  validateParams(
    params: URLSearchParams
  ): { valid: true } | { valid: false; error: string };
  buildHeaders(
    params: URLSearchParams,
    req: IncomingMessage
  ): Record<string, string>;
  exposeHeaders?: string;
}

function createBilibiliProxyPlugin(
  name: string,
  route: string,
  opts: BilibiliProxyOptions
) {
  return {
    name,
    configureServer(server: {
      middlewares: {
        use(
          path: string,
          handler: (req: IncomingMessage, res: ServerResponse) => void
        ): void;
      };
    }) {
      server.middlewares.use(route, async (req, res) => {
        try {
          const requestUrl = new URL(req.url || "", "http://localhost");
          const validation = opts.validateParams(requestUrl.searchParams);
          if (!validation.valid) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: validation.error }));
            return;
          }

          const fetchRes = await fetch(requestUrl.searchParams.get("url")!, {
            headers: opts.buildHeaders(requestUrl.searchParams, req),
          });
          res.statusCode = fetchRes.status;
          fetchRes.headers.forEach((value: string, key: string) => {
            res.setHeader(key, value);
          });
          res.setHeader("Access-Control-Allow-Origin", "*");
          if (opts.exposeHeaders) {
            res.setHeader("Access-Control-Expose-Headers", opts.exposeHeaders);
          }

          if (!fetchRes.body) {
            res.end();
            return;
          }

          const reader = fetchRes.body.getReader();
          const pump = (): void => {
            reader
              .read()
              .then(({ done, value }) => {
                if (done) {
                  res.end();
                  return;
                }
                res.write(Buffer.from(value), pump);
              })
              .catch(() => {
                res.end();
              });
          };
          pump();
        } catch {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: `Failed to proxy ${name}` }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "倾听音乐",
        short_name: "倾听音乐",
        description: "倾听音乐 - 开源免费音乐播放器",
        theme_color: "#58c9aa",
        background_color: "#f9fbfc",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,ico,png,svg,webp}"],
      },
    }),
    {
      name: "kugou-resolve",
      configureServer(server) {
        server.middlewares.use("/api/kugou-resolve", async (req, res) => {
          const shortPath = req.url!.replace("/api/kugou-resolve", "") || "/";
          try {
            const fetchRes = await fetch(`https://t1.kugou.com${shortPath}`, {
              method: "HEAD",
              redirect: "manual",
            });
            const location = fetchRes.headers.get("location") || "";
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ resolvedUrl: location }));
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: "Failed to resolve short link" }));
          }
        });
      },
    },
    {
      name: "migu-resolve",
      configureServer(server) {
        server.middlewares.use("/api/migu-resolve", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }
          let body = "";
          req.on("data", (chunk: Buffer) => (body += chunk.toString()));
          req.on("end", async () => {
            try {
              const { url }: { url?: string } = JSON.parse(body);
              if (!url) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "url required" }));
                return;
              }
              const parsed = new URL(url);
              if (parsed.hostname !== "c.migu.cn") {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "not a migu short link" }));
                return;
              }

              const fetchRes = await fetch(url, { redirect: "manual" });
              const location = fetchRes.headers.get("location") || "";
              if (!location) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "no redirect" }));
                return;
              }

              const target = new URL(location);
              const playlistId = target.searchParams.get("id");
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  playlistId:
                    playlistId && /^\d+$/.test(playlistId) ? playlistId : null,
                })
              );
            } catch {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: "resolve failed" }));
            }
          });
        });
      },
    },
    createBilibiliProxyPlugin("bilibili-audio", "/api/bilibili-audio", {
      validateParams(params) {
        const bvid = params.get("bvid");
        const url = params.get("url");
        if (!bvid || !url)
          return { valid: false, error: "bvid and url required" };
        return { valid: true };
      },
      buildHeaders(params, req) {
        const headers: Record<string, string> = {
          Referer: `https://www.bilibili.com/video/${params.get("bvid")}`,
          Cookie: "buvid3=0",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };
        if (req.headers.range) headers.Range = req.headers.range;
        return headers;
      },
      exposeHeaders: "Content-Length, Content-Range, Accept-Ranges",
    }),
    createBilibiliProxyPlugin("bilibili-cover", "/api/bilibili-cover", {
      validateParams(params) {
        const url = params.get("url");
        if (!url) return { valid: false, error: "url required" };
        try {
          const parsed = new URL(url);
          if (!/(^|\.)hdslb\.com$|(^|\.)biliimg\.com$/.test(parsed.hostname)) {
            return { valid: false, error: "invalid cover host" };
          }
        } catch {
          return { valid: false, error: "invalid url" };
        }
        return { valid: true };
      },
      buildHeaders() {
        return {
          Referer: "https://www.bilibili.com/",
          Cookie: "buvid3=0",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };
      },
    }),
    {
      name: "plugin-fetch-proxy",
      configureServer(server) {
        server.middlewares.use(
          "/api/fetch",
          async (req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(
              req.url || "",
              "http://localhost"
            ).searchParams.get("url");
            if (!url) {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("missing url parameter");
              return;
            }
            try {
              const fetchRes = await fetch(url);
              const text = await fetchRes.text();
              res.writeHead(fetchRes.status, {
                "Content-Type":
                  fetchRes.headers.get("content-type") || "text/plain",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(text);
            } catch {
              res.writeHead(502, { "Content-Type": "text/plain" });
              res.end("fetch failed");
            }
          }
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@otter-music/shared": fileURLToPath(
        new URL("./shared/src/index.ts", import.meta.url)
      ),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "zustand", "lucide-react", "date-fns"],
  },
  build: {
    minify: "esbuild",
    target: "es2018",
    cssMinify: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom"))
              return "react-vendor";
            if (id.includes("lucide-react")) return "lucide-vendor";
            if (id.includes("@radix-ui")) return "radix-vendor";
            if (id.includes("date-fns")) return "date-fns-vendor";
            if (id.includes("@capacitor")) return "capacitor-vendor";
          }
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
  server: {
    proxy: {
      "/api/netease": {
        target: "https://music.163.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/netease/, ""),
        headers: {
          Referer: "https://music.163.com",
          Origin: "https://music.163.com",
        },
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.headers["x-real-cookie"]) {
              proxyReq.setHeader("Cookie", req.headers["x-real-cookie"]);
            }
            if (req.headers["x-real-ua"]) {
              proxyReq.setHeader("User-Agent", req.headers["x-real-ua"]);
            }
            if (req.headers["x-real-ip"]) {
              proxyReq.setHeader("X-Real-IP", req.headers["x-real-ip"]);
              proxyReq.setHeader("X-Forwarded-For", req.headers["x-real-ip"]);
            }
            proxyReq.removeHeader("x-real-cookie");
            proxyReq.removeHeader("x-real-ua");
          });
        },
      },
      "/api/qq": {
        target: "https://c.y.qq.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qq/, ""),
        headers: {
          Referer: "https://y.qq.com",
          Origin: "https://y.qq.com",
        },
      },
      "/api/kuwo": {
        target: "https://www.kuwo.cn",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kuwo/, ""),
        headers: {
          Referer: "https://www.kuwo.cn",
        },
      },
      "/api/kugou": {
        target: "https://www.kugou.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kugou/, ""),
      },
      "/api/migu": {
        target: "https://m.music.migu.cn",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/migu/, ""),
      },
    },
  },
});
