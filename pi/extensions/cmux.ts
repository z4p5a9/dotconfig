import type { AgentEndEvent, ExtensionAPI } from "@earendil-works/pi-coding-agent";

type NotificationSubtitle = "Waiting" | "Task Complete" | "Error";

const DEFAULT_NOTIFY_LEVEL = "all";
const DEFAULT_NOTIFY_MAX_CHARS = 240;
const DEFAULT_NOTIFY_DEBOUNCE_MS = 3000;
const DEFAULT_COMMAND_TIMEOUT_MS = 1500;

function positiveIntegerEnv(name: string, fallback: number) {
	const value = process.env[name];
	if (!value) return fallback;

	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function notifyLevelEnv() {
	const value = process.env.PI_CMUX_NOTIFY_LEVEL;
	if (value === "all") return "all";
	if (value === "medium") return "medium";
	if (value === "low") return "low";
	if (value === "disabled") return "disabled";
	return DEFAULT_NOTIFY_LEVEL;
}

function readConfig() {
	return {
		disabled: process.env.PI_CMUX_DISABLED === "1",
		notifyLevel: notifyLevelEnv(),
		notifyMaxChars: positiveIntegerEnv("PI_CMUX_NOTIFY_MAX_CHARS", DEFAULT_NOTIFY_MAX_CHARS),
		notifyDebounceMs: positiveIntegerEnv("PI_CMUX_NOTIFY_DEBOUNCE_MS", DEFAULT_NOTIFY_DEBOUNCE_MS),
		commandTimeoutMs: positiveIntegerEnv("PI_CMUX_COMMAND_TIMEOUT_MS", DEFAULT_COMMAND_TIMEOUT_MS),
	};
}

function nonEmptyEnv(name: string) {
	const value = process.env[name]?.trim();
	return value || undefined;
}

function resolveCmuxTarget() {
	const config = readConfig();
	const workspaceId = nonEmptyEnv("CMUX_WORKSPACE_ID");
	const surfaceId = nonEmptyEnv("CMUX_SURFACE_ID");

	if (config.disabled || !workspaceId || !surfaceId) return undefined;
	return { config, workspaceId, surfaceId };
}

function shouldNotify(level: string, subtitle: NotificationSubtitle) {
	if (level === "disabled") return false;
	if (subtitle === "Error") return true;
	if (subtitle === "Waiting") return level === "all" || level === "medium";
	return level === "all";
}

function truncateBody(body: string, maxChars: number) {
	const trimmed = body.trim();
	if (trimmed.length <= maxChars) return trimmed;
	if (maxChars <= 1) return "…";
	return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}

function stringValue(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function textFromContent(content: unknown) {
	if (typeof content === "string") return stringValue(content);
	if (!Array.isArray(content)) return undefined;

	const parts: string[] = [];
	for (const block of content) {
		if (typeof block === "string") {
			parts.push(block);
			continue;
		}

		if (!block || typeof block !== "object") continue;
		if (!("type" in block) || block.type !== "text") continue;
		if (!("text" in block) || typeof block.text !== "string") continue;

		parts.push(block.text);
	}

	const text = parts.join("\n").trim();
	return text || undefined;
}

function finalAssistantText(event: AgentEndEvent) {
	for (const message of [...event.messages].reverse()) {
		if (!("role" in message) || message.role !== "assistant") continue;

		const text = textFromContent(message.content);
		if (text) return text;
	}
	return undefined;
}

function finalErrorMessage(event: AgentEndEvent) {
	for (const message of [...event.messages].reverse()) {
		if (!("role" in message) || message.role !== "assistant") continue;

		const errorMessage = stringValue(message.errorMessage);
		if (errorMessage) return errorMessage;
	}
	return undefined;
}

function finalFailed(event: AgentEndEvent) {
	return event.messages.some((message) => {
		if (!("role" in message) || message.role !== "assistant") return false;
		return message.stopReason === "error" || message.stopReason === "aborted" || !!message.errorMessage;
	});
}

function parseWaitingEvent(data: unknown) {
	if (!data || typeof data !== "object") return undefined;
	if (!("source" in data) || !("id" in data) || !("waiting" in data)) return undefined;

	const source = stringValue(data.source);
	const id = stringValue(data.id);

	if (!source || !id || typeof data.waiting !== "boolean") return undefined;
	return { source, id, waiting: data.waiting };
}

export default function (pi: ExtensionAPI) {
	if (process.env.PI_SUBAGENT_CHILD === "1") return;

	let activeWaitingIds = new Set<string>();
	let lastNotification: { subtitle: NotificationSubtitle; body: string; sentAt: number } | undefined;

	async function sendNotification(subtitle: NotificationSubtitle, body: string) {
		const target = resolveCmuxTarget();
		if (!target || !shouldNotify(target.config.notifyLevel, subtitle)) return;

		const truncatedBody = truncateBody(body, target.config.notifyMaxChars);
		const now = Date.now();
		if (
			lastNotification &&
			lastNotification.subtitle === subtitle &&
			lastNotification.body === truncatedBody &&
			now - lastNotification.sentAt < target.config.notifyDebounceMs
		) {
			return;
		}

		try {
			const result = await pi.exec(
				"cmux",
				[
					"notify",
					"--title",
					"Pi",
					"--subtitle",
					subtitle,
					"--body",
					truncatedBody,
					"--workspace",
					target.workspaceId,
					"--surface",
					target.surfaceId,
				],
				{ timeout: target.config.commandTimeoutMs },
			);

			if (result.code === 0 && !result.killed) {
				lastNotification = { subtitle, body: truncatedBody, sentAt: now };
			}
		} catch {
			// cmux notifications are best-effort.
		}
	}

	function queueNotification(subtitle: NotificationSubtitle, body: string) {
		void sendNotification(subtitle, body);
	}

	const unsubscribeWaiting = pi.events.on("pi:waiting-for-user-input", (data) => {
		const payload = parseWaitingEvent(data);
		if (!payload) return;

		const key = `${payload.source}:${payload.id}`;
		const wasWaiting = activeWaitingIds.size > 0;

		if (payload.waiting) {
			activeWaitingIds.add(key);
		} else {
			activeWaitingIds.delete(key);
		}

		if (!wasWaiting && activeWaitingIds.size > 0) {
			queueNotification("Waiting", "Ready for input");
		}
	});

	pi.on("session_start", () => {
		activeWaitingIds.clear();
	});

	pi.on("input", () => {
		activeWaitingIds.clear();
	});

	pi.on("agent_start", () => {
		activeWaitingIds.clear();
	});

	pi.on("agent_end", (event) => {
		const failed = finalFailed(event);
		if (!failed && activeWaitingIds.size > 0) return;

		const body = failed ? finalErrorMessage(event) ?? finalAssistantText(event) ?? "Error" : finalAssistantText(event);
		if (!body) return;

		queueNotification(failed ? "Error" : "Task Complete", body);
	});

	pi.on("session_shutdown", () => {
		unsubscribeWaiting();
		activeWaitingIds.clear();
	});
}
