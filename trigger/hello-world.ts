import { task } from "@trigger.dev/sdk";

/**
 * Toolchain sanity check for B1 -- confirms `trigger.dev dev` and
 * `trigger.dev deploy` work before any real pipeline logic is built.
 * Safe to delete once campaign-workflow.ts is deployed and verified.
 */
export const helloWorld = task({
  id: "hello-world",
  run: async (payload: { name: string }) => {
    return {
      message: `Hello ${payload.name}`,
      at: new Date().toISOString(),
    };
  },
});
