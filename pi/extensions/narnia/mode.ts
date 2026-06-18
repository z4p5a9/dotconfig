import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export type NarniaState = {
	enabled: boolean;
};

const CUSTOM_TYPE = "narnia";
const BLOCK_REASON = "Narnia Mode: root session cannot call tools directly. Use one delegate call with tasks: { title: string; content: string }[]; batch currently-known independent work into multiple titled tasks.";
const NARNIA_ROOT_PROMPT = "Narnia mode is enabled. Root session is a delegate-only orchestrator. Use only delegate for file, shell, web, edit, and test work. Use one delegate call containing multiple titled tasks for all currently-known independent work. Do not make multiple delegate calls in the same turn unless later work depends on earlier delegate results. Always look for work that can be parallelized before delegating. Each task object needs a concise title and full content. Delegate bounded tasks with enough context. Keep root context compact. Do not ask child agents to recursively delegate.";

export function formatTokens(count: number): string {
	const tokens = Math.max(0, Number.isFinite(count) ? count : 0);

	if (tokens < 1_000) return `${Math.round(tokens)}`;
	if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}k`;
	if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
	if (tokens < 10_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
	return `${Math.round(tokens / 1_000_000)}M`;
}

function isNarniaState(data: unknown): data is NarniaState {
	return !!data && typeof data === "object" && typeof (data as { enabled?: unknown }).enabled === "boolean";
}

export function registerNarniaModeControls(
	pi: ExtensionAPI,
	options: {
		ensureDelegateRegistered: () => void;
		getState: () => NarniaState | undefined;
		setState: (state: NarniaState | undefined) => void;
		getActiveDelegateCalls: () => number;
	},
): (ctx: ExtensionContext) => void {
	function updateStatus(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;

		const state = options.getState();
		const usage = ctx.getContextUsage();
		const tokens = usage?.tokens === null || usage?.tokens === undefined ? "" : ` · ctx ${formatTokens(usage.tokens)}`;
		const hasRunningDelegates = options.getActiveDelegateCalls() > 0;
		const status = hasRunningDelegates ? "child running" : state?.enabled ? "on" : "off";
		ctx.ui.setStatus(CUSTOM_TYPE, ctx.ui.theme.fg(hasRunningDelegates ? "warning" : "dim", `Narnia: ${status}${tokens}`));
	}

	function setAllConfiguredExceptDelegate(): void {
		pi.setActiveTools(pi.getAllTools().map((tool) => tool.name).filter((name) => name !== "delegate"));
	}

	function restoreFromBranch(ctx: ExtensionContext): void {
		let savedState: NarniaState | undefined;

		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === CUSTOM_TYPE && isNarniaState(entry.data)) {
				savedState = entry.data;
			}
		}

		options.setState(savedState);

		if (savedState?.enabled) {
			options.ensureDelegateRegistered();
			pi.setActiveTools(["delegate"]);
		} else if (savedState) {
			options.ensureDelegateRegistered();
			setAllConfiguredExceptDelegate();
		}

		updateStatus(ctx);
	}

	function handleSessionEvent(label: string) {
		return (_event: unknown, ctx: ExtensionContext) => {
			try {
				restoreFromBranch(ctx);
			} catch (error) {
				console.error(`[narnia] ${label}`, error);
			}
		};
	}

	pi.registerCommand("narnia", {
		description: "Enable/disable Narnia delegate-only root mode",
		handler: async (args, ctx) => {
			const command = args.trim().toLowerCase();

			if (!command) {
				updateStatus(ctx);
				ctx.ui.notify(`Narnia: ${options.getState()?.enabled ? "on" : "off"}\nUsage: /narnia on | /narnia off`, "info");
				return;
			}

			if (command === "on") {
				options.ensureDelegateRegistered();
				const state = { enabled: true };
				options.setState(state);
				pi.appendEntry<NarniaState>(CUSTOM_TYPE, state);
				pi.setActiveTools(["delegate"]);
				updateStatus(ctx);
				ctx.ui.notify("Narnia enabled. Root tools restricted to delegate; paste/! output can still pollute root context.", "warning");
				return;
			}

			if (command === "off") {
				options.ensureDelegateRegistered();
				const state = { enabled: false };
				options.setState(state);
				pi.appendEntry<NarniaState>(CUSTOM_TYPE, state);
				setAllConfiguredExceptDelegate();
				updateStatus(ctx);
				ctx.ui.notify("Narnia disabled.", "info");
				return;
			}

			ctx.ui.notify("Usage: /narnia on | /narnia off", "warning");
		},
	});

	pi.on("session_start", handleSessionEvent("failed during session_start"));
	pi.on("session_tree", handleSessionEvent("failed during session_tree"));

	pi.on("before_agent_start", (event, ctx) => {
		updateStatus(ctx);
		if (!options.getState()?.enabled) return undefined;

		return {
			systemPrompt: `${event.systemPrompt}\n\n${NARNIA_ROOT_PROMPT}`,
		};
	});

	pi.on("tool_call", (event) => {
		if (!options.getState()?.enabled || event.toolName === "delegate") return undefined;
		return { block: true, reason: BLOCK_REASON };
	});

	pi.on("session_shutdown", (_event, ctx) => {
		if (ctx.hasUI) ctx.ui.setStatus(CUSTOM_TYPE, undefined);
		options.setState(undefined);
	});

	return updateStatus;
}
