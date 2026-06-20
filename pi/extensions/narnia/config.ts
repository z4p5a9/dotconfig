import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export type NarniaConfig = {
	rootTools: string[];
	childTools: string[] | undefined;
};

function normalizeConfiguredTools(tools: string[]): string[] {
	const normalizedTools: string[] = [];
	const seen = new Set<string>();

	for (const tool of tools) {
		const name = tool.trim();
		if (!name || seen.has(name)) continue;
		seen.add(name);
		normalizedTools.push(name);
	}

	return normalizedTools;
}

export function getNarniaConfigPath(): string {
	return join(getAgentDir(), "extensions", "narnia.json");
}

export function loadNarniaConfigFromPath(configPath: string): NarniaConfig {
	if (!existsSync(configPath)) return { rootTools: [], childTools: undefined };

	const fail = (message: string): never => {
		throw new Error(`[narnia] invalid config at ${configPath}: ${message}`);
	};

	let source: string;
	try {
		source = readFileSync(configPath, "utf8");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		fail(`could not read file: ${message}`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(source);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		fail(`malformed JSON: ${message}`);
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("top-level config must be an object");
	const config = parsed as Record<string, unknown>;

	let rootTools: string[] = [];
	if (config.root !== undefined) {
		if (!config.root || typeof config.root !== "object" || Array.isArray(config.root)) fail("root must be an object");
		const tools = (config.root as Record<string, unknown>).tools;
		if (tools !== undefined) {
			if (!Array.isArray(tools) || tools.some((tool) => typeof tool !== "string")) fail("root.tools must be an array of strings");
			rootTools = normalizeConfiguredTools(tools);
		}
	}

	let childTools: string[] | undefined;
	if (config.children !== undefined) {
		if (!config.children || typeof config.children !== "object" || Array.isArray(config.children)) fail("children must be an object");
		const tools = (config.children as Record<string, unknown>).tools;
		if (tools !== undefined) {
			if (!Array.isArray(tools) || tools.some((tool) => typeof tool !== "string")) fail("children.tools must be an array of strings");
			childTools = normalizeConfiguredTools(tools).filter((name) => name !== "delegate");
		}
	}

	return { rootTools, childTools };
}

export function loadNarniaConfig(): NarniaConfig {
	return loadNarniaConfigFromPath(getNarniaConfigPath());
}
