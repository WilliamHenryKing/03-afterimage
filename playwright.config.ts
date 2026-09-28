import { defineConfig } from "@playwright/test";

// End-to-end journey against the production build. SwiftShader keeps it GPU-free for CI;
// reduced motion keeps the software-rendered tweens short.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4613",
    contextOptions: { reducedMotion: "reduce" },
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://127.0.0.1:4613",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
