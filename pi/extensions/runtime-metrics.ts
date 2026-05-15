import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const CUSTOM_TYPE = "runtime-metrics";

type UsageSnapshot = {
	tokens: number;
	cost: number;
};

type RuntimeRunEntry = {
	kind: "run";
	startedAt: number;
	endedAt: number;
	durationMs: number;
	tokenDelta: number;
	costDelta: number;
};

type ActiveRun = {
	startedAt: number;
	baseline: UsageSnapshot;
};

function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(Number.isFinite(ms) ? ms / 1000 : 0));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) return `${hours}h${minutes}m${seconds}s`;
	if (minutes > 0) return `${minutes}m${seconds}s`;
	return `${seconds}s`;
}

function formatTokens(count: number): string {
	const tokens = Math.max(0, Number.isFinite(count) ? count : 0);

	if (tokens < 1_000) return `${Math.round(tokens)}`;
	if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}k`;
	if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
	if (tokens < 10_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
	return `${Math.round(tokens / 1_000_000)}M`;
}

function formatCost(cost: number, isSubscription: boolean): string {
	const amount = Math.max(0, Number.isFinite(cost) ? cost : 0);
	return `$${amount.toFixed(3)}${isSubscription ? " (sub)" : ""}`;
}

function buildSummary(durationMs: number, tokenDelta: number, costDelta: number, isSubscription: boolean): string {
	return `done ${formatDuration(durationMs)} · ${formatTokens(tokenDelta)} tok · ${formatCost(costDelta, isSubscription)}`;
}

function getUsageSnapshot(ctx: ExtensionContext): UsageSnapshot {
	let tokens = 0;
	let cost = 0;

	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type === "message" && entry.message.role === "assistant") {
			const usage = entry.message.usage;

			tokens +=
				(Number.isFinite(usage?.input) ? usage.input : 0) +
				(Number.isFinite(usage?.output) ? usage.output : 0) +
				(Number.isFinite(usage?.cacheRead) ? usage.cacheRead : 0) +
				(Number.isFinite(usage?.cacheWrite) ? usage.cacheWrite : 0);
			cost += Number.isFinite(usage?.cost?.total) ? usage.cost.total : 0;
		}
	}

	return { tokens, cost };
}

function isRuntimeEntry(entry: unknown): entry is RuntimeRunEntry {
	if (!entry || typeof entry !== "object") return false;

	const data = entry as Partial<RuntimeRunEntry>;
	return (
		data.kind === "run" &&
		typeof data.startedAt === "number" &&
		Number.isFinite(data.startedAt) &&
		typeof data.endedAt === "number" &&
		Number.isFinite(data.endedAt) &&
		typeof data.durationMs === "number" &&
		Number.isFinite(data.durationMs) &&
		typeof data.tokenDelta === "number" &&
		Number.isFinite(data.tokenDelta) &&
		typeof data.costDelta === "number" &&
		Number.isFinite(data.costDelta)
	);
}

function getBranchRuntimeMs(ctx: ExtensionContext): number {
	let runtimeMs = 0;

	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type === "custom" && entry.customType === CUSTOM_TYPE && isRuntimeEntry(entry.data)) {
			runtimeMs += Math.max(0, entry.data.durationMs);
		}
	}

	return runtimeMs;
}

function updateStatus(ctx: ExtensionContext, runtimeMs = cumulativeRuntimeMs): void {
	if (!ctx.hasUI) return;

	ctx.ui.setStatus(CUSTOM_TYPE, ctx.ui.theme.fg("dim", `active ${formatDuration(runtimeMs)}`));
}

let activeRun: ActiveRun | undefined;
let cumulativeRuntimeMs = 0;
let statusTimer: ReturnType<typeof setInterval> | undefined;
let workingMessageOwned = false;

function stopStatusTimer(): void {
	if (statusTimer) {
		clearInterval(statusTimer);
		statusTimer = undefined;
	}
}

function setRunWorkingMessage(ctx: ExtensionContext, elapsedMs: number): void {
	if (!ctx.hasUI) return;

	try {
		ctx.ui.setWorkingMessage(`Working... ${formatDuration(elapsedMs)}`);
		workingMessageOwned = true;
	} catch (error) {
		console.error("[runtime-metrics] failed to set working message", error);
	}
}

function resetWorkingMessage(ctx: ExtensionContext): void {
	if (!workingMessageOwned) return;

	if (!ctx.hasUI) {
		workingMessageOwned = false;
		return;
	}

	try {
		ctx.ui.setWorkingMessage();
	} catch (error) {
		console.error("[runtime-metrics] failed to reset working message", error);
	} finally {
		workingMessageOwned = false;
	}
}

function restoreSessionRuntime(ctx: ExtensionContext): void {
	stopStatusTimer();
	activeRun = undefined;
	resetWorkingMessage(ctx);

	cumulativeRuntimeMs = getBranchRuntimeMs(ctx);
	if (ctx.hasUI) updateStatus(ctx);
}

function handleEvent(label: string, handler: (ctx: ExtensionContext) => void) {
	return (_event: unknown, ctx: ExtensionContext) => {
		try {
			handler(ctx);
		} catch (error) {
			console.error(`[runtime-metrics] ${label}`, error);
		}
	};
}

export default function (pi: ExtensionAPI) {
	pi.on(
		"session_start",
		handleEvent("failed during session_start", (ctx) => {
			restoreSessionRuntime(ctx);
		}),
	);

	pi.on(
		"session_tree",
		handleEvent("failed during session_tree", (ctx) => {
			restoreSessionRuntime(ctx);
		}),
	);

	pi.on(
		"session_shutdown",
		handleEvent("failed during session_shutdown", (ctx) => {
			stopStatusTimer();
			activeRun = undefined;
			resetWorkingMessage(ctx);

			if (ctx.hasUI) {
				ctx.ui.setStatus(CUSTOM_TYPE, undefined);
			}
		}),
	);

	pi.on(
		"agent_start",
		handleEvent("failed during agent_start", (ctx) => {
			stopStatusTimer();

			if (!ctx.hasUI) {
				activeRun = undefined;
				return;
			}

			activeRun = {
				startedAt: Date.now(),
				baseline: getUsageSnapshot(ctx),
			};
			const timerRun = activeRun;
			updateStatus(ctx);
			setRunWorkingMessage(ctx, 0);

			statusTimer = setInterval(() => {
				try {
					if (activeRun !== timerRun) return;

					const elapsedCurrentRun = Math.max(0, Date.now() - timerRun.startedAt);
					updateStatus(ctx, cumulativeRuntimeMs + elapsedCurrentRun);
					setRunWorkingMessage(ctx, elapsedCurrentRun);
				} catch (error) {
					console.error("[runtime-metrics] failed during status timer", error);
					stopStatusTimer();
					resetWorkingMessage(ctx);
				}
			}, 1000);
		}),
	);

	pi.on(
		"agent_end",
		handleEvent("failed during agent_end", (ctx) => {
			stopStatusTimer();

			if (!ctx.hasUI) {
				activeRun = undefined;
				return;
			}

			const run = activeRun;

			try {
				if (!run) {
					updateStatus(ctx);
					return;
				}

				const endedAt = Date.now();
				const durationMs = Math.max(0, endedAt - run.startedAt);
				const finalUsage = getUsageSnapshot(ctx);
				const tokenDelta = Math.max(0, finalUsage.tokens - run.baseline.tokens);
				const costDelta = Math.max(0, finalUsage.cost - run.baseline.cost);
				const runEntry: RuntimeRunEntry = {
					kind: "run",
					startedAt: run.startedAt,
					endedAt,
					durationMs,
					tokenDelta,
					costDelta,
				};

				try {
					pi.appendEntry(CUSTOM_TYPE, runEntry);
				} catch (error) {
					console.error("[runtime-metrics] failed to append run entry", error);
					updateStatus(ctx, cumulativeRuntimeMs);
					return;
				}

				cumulativeRuntimeMs += durationMs;
				updateStatus(ctx);

				const isSubscription = ctx.model ? ctx.modelRegistry.isUsingOAuth(ctx.model) : false;
				const summary = buildSummary(durationMs, tokenDelta, costDelta, isSubscription);
				ctx.ui.notify(summary, "info");
			} finally {
				activeRun = undefined;
				resetWorkingMessage(ctx);
			}
		}),
	);
}
