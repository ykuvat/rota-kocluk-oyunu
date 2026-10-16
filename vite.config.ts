import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages alt yolu (ör. /rota-kocluk-oyunu/) derleme ortamından gelir; yerelde kök
  base: process.env.BASE_PATH ?? "/",
  // sanat kaynakları (zip, jpg, python ortamı) izlenmez: indirilen dosyanın kilidi izleyiciyi çökertiyordu (EBUSY)
  server: { port: 5173, strictPort: true, watch: { ignored: ["**/art/**", "**/tools/**", "**/docs/**"] } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
