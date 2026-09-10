import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_lnazyzacybswreyturun",
  dirs: ["./trigger"],
  runtime: "node",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
