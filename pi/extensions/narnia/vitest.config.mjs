import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export default {
	cacheDir: join(tmpdir(), "pi-narnia-vitest-cache"),
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		clearMocks: true,
		restoreMocks: false,
	},
	resolve: {
		alias: {
			"@earendil-works/pi-coding-agent": fileURLToPath(new URL("./tests/stubs/pi-coding-agent.ts", import.meta.url)),
			"@earendil-works/pi-tui": fileURLToPath(new URL("./tests/stubs/pi-tui.ts", import.meta.url)),
			typebox: fileURLToPath(new URL("./tests/stubs/typebox.ts", import.meta.url)),
		},
	},
};
