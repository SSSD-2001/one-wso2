import { defineConfig, mergeConfig, type Plugin } from "vite";
import { configDefaults, defineConfig as defineVitestConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Content-Security-Policy for the shipped SPA (threat-model risk ONEWSO2-R2:
// no app-defined headers previously). Injected as a <meta> on PRODUCTION
// builds only — the dev server relies on inline scripts + ws HMR that a
// strict CSP would block. Headers a meta tag can't express must still be set
// at the Choreo/Cloudflare edge: X-Frame-Options / frame-ancestors (ignored
// in meta), HSTS, X-Content-Type-Options, Permissions-Policy, Clear-Site-Data.
//
// Origins: backend calls and employee thumbnails go through the Choreo
// gateway (apis[-stg].wso2.com) and Asgardeo (*.asgardeo.io). Those hosts are
// runtime-configurable (window.config) so a static build can't pin exact
// origins — the wso2/asgardeo wildcards are the tightest portable allowlist;
// pin them further at the edge if the CSP is moved there. style-src allows
// 'unsafe-inline' for MUI/emotion; img-src/frame-src allow blob: and data:
// for receipt previews (fetchReceiptObjectUrl → blob:, fetchBase64Attachment
// → data:, incl. PDF <iframe src="data:...">). employeeThumbnail is a raw
// pass-through URL from people-app, not always Choreo-hosted — some
// employees' photos resolve to their Google account avatar
// (lh3.googleusercontent.com and friends) rather than a gateway URL, so
// img-src also allows Google's avatar CDN.
//
// The Lead Portal's evidence-attachment picker (useGoogleDrivePicker.ts)
// loads Google Identity Services + the Picker API at runtime, needing three
// more origins: script-src for the two loaded scripts, connect-src for the
// token exchange + Drive API calls they make, and frame-src for the
// Picker's own iframe (hosted on docs.google.com, not inline).
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.wso2.com https://wso2.cachefly.net https://*.asgardeo.io https://*.googleusercontent.com",
  "font-src 'self' data: https://wso2.cachefly.net",
  "connect-src 'self' https://*.wso2.com https://*.asgardeo.io https://*.googleapis.com https://accounts.google.com",
  "frame-src 'self' blob: data: https://*.asgardeo.io https://docs.google.com https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

function cspPlugin(): Plugin {
  return {
    name: "one-wso2-csp",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          injectTo: "head",
          attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
        },
      ];
    },
  };
}

// https://vite.dev/config/
const viteConfig = defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    cspPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@api": path.resolve(__dirname, "./src/api"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@config": path.resolve(__dirname, "./src/config"),
      "@constants": path.resolve(__dirname, "./src/constants"),
      "@context": path.resolve(__dirname, "./src/context"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@layouts": path.resolve(__dirname, "./src/layouts"),
      "@utils": path.resolve(__dirname, "./src/utils"),
    },
  },
  envPrefix: ["ONE_WSO2_"],
  server: {
    port: 3000,
  },
});

// Vitest lives inline here rather than in a separate vitest.config.ts, so the
// aliases and plugins above are shared rather than duplicated. `css: true` so
// Oxygen's emotion styles resolve under jsdom, and
// the Oxygen/Asgardeo packages ship ESM that has to be inlined to be
// transformable.
const vitestConfig = defineVitestConfig({
  test: {
    globals: true,
    environment: "jsdom",
    css: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude],
    server: {
      deps: {
        inline: [
          "@wso2/oxygen-ui",
          "@wso2/oxygen-ui-icons-react",
          "@asgardeo/browser",
          // Oxygen re-exports MUI X DataGrid, which ships a bare `.css` import
          // Node can't resolve. Rendering ANY Oxygen component pulls it in, so
          // this is required for component tests, not just data-grid ones.
          "@mui/x-data-grid",
        ],
      },
    },
  },
});

export default mergeConfig(viteConfig, vitestConfig);
