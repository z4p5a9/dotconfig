import { EventEmitter } from "node:events";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({
	spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	spawn: spawnMock,
}));

import narniaExtension from "../index.ts";

const originalChildEnv = process.env.PI_NARNIA_CHILD;

function childOutput(result: string) {
	return `Result: ${result}`;
}

function createHarness(branch: unknown[] = [], initialActiveTools = ["read", "bash", "write"]) {
	const allTools: any[] = [{ name: "read" }, { name: "bash" }, { name: "write" }];
	let currentActiveTools = [...initialActiveTools];
	const commands: Record<string, any> = {};
	const events: Record<string, any[]> = {};
	const appended: any[] = [];
	const activeTools: string[][] = [];
	const notifications: Array<[string, string]> = [];
	const statuses: Array<[string, unknown]> = [];
	const ctx = {
		hasUI: true,
		cwd: "/tmp/narnia-test",
		model: { provider: "fake", id: "model" },
		getContextUsage: vi.fn(() => ({ tokens: 1536 })),
		isProjectTrusted: vi.fn(() => true),
		sessionManager: {
			getBranch: vi.fn(() => branch),
		},
		ui: {
			theme: {
				fg: vi.fn((_color: string, text: string) => text),
				bold: vi.fn((text: string) => text),
			},
			setStatus: vi.fn((type: string, value: unknown) => statuses.push([type, value])),
			notify: vi.fn((message: string, level: string) => notifications.push([message, level])),
		},
	};
	const pi = {
		registerTool: vi.fn((tool: any) => allTools.push(tool)),
		registerCommand: vi.fn((name: string, command: any) => {
			commands[name] = command;
		}),
		on: vi.fn((name: string, handler: any) => {
			(events[name] ??= []).push(handler);
		}),
		appendEntry: vi.fn((customType: string, data: unknown) => appended.push({ customType, data })),
		getActiveTools: vi.fn(() => [...currentActiveTools]),
		setActiveTools: vi.fn((names: string[]) => {
			currentActiveTools = [...names];
			activeTools.push([...names]);
		}),
		getAllTools: vi.fn(() => allTools),
		getThinkingLevel: vi.fn(() => "medium"),
	};

	narniaExtension(pi as any);

	return {
		allTools,
		appended,
		activeTools,
		commands,
		ctx,
		events,
		notifications,
		pi,
		statuses,
		delegate: () => allTools.find((tool) => tool.name === "delegate"),
	};
}

function makeProcess() {
	const proc = new EventEmitter() as any;
	proc.stdout = new EventEmitter();
	proc.stderr = new EventEmitter();
	proc.kill = vi.fn((signal = "SIGTERM") => {
		setTimeout(() => proc.emit("close", signal === "SIGKILL" ? null : 143, signal), 0);
		return true;
	});
	return proc;
}

function queueChild(events: unknown[], code: number, stderr = "") {
	spawnMock.mockImplementationOnce(() => {
		const proc = makeProcess();
		setTimeout(() => {
			if (stderr) proc.stderr.emit("data", Buffer.from(stderr));
			for (const event of events) proc.stdout.emit("data", Buffer.from(`${JSON.stringify(event)}\n`));
			proc.emit("close", code, null);
		}, 0);
		return proc;
	});
}

beforeEach(() => {
	spawnMock.mockReset();
	delete process.env.PI_NARNIA_CHILD;
});

afterEach(() => {
	delete process.env.PI_NARNIA_CHILD;
});

afterAll(() => {
	if (originalChildEnv === undefined) delete process.env.PI_NARNIA_CHILD;
	else process.env.PI_NARNIA_CHILD = originalChildEnv;
});

describe("narnia extension", () => {
	it("does not register in child processes", () => {
		process.env.PI_NARNIA_CHILD = "1";

		const harness = createHarness();

		expect(harness.pi.registerCommand).not.toHaveBeenCalled();
		expect(harness.pi.registerTool).not.toHaveBeenCalled();
		expect(harness.pi.on).not.toHaveBeenCalled();
	});

	it("toggles /narnia on and off and restores prior tools", async () => {
		const harness = createHarness([], ["read"]);

		await harness.commands.narnia.handler("on", harness.ctx);
		expect(harness.delegate()).toBeTruthy();
		expect(harness.appended.at(-1)).toEqual({ customType: "narnia", data: { enabled: true, previousActiveTools: ["read"] } });
		expect(harness.activeTools.at(-1)).toEqual(["delegate"]);
		expect(harness.notifications.at(-1)?.[0]).toContain("Narnia enabled");

		await harness.commands.narnia.handler("off", harness.ctx);
		expect(harness.appended.at(-1)).toEqual({ customType: "narnia", data: { enabled: false, previousActiveTools: ["read"] } });
		expect(harness.activeTools.at(-1)).toEqual(["read"]);
		expect(harness.notifications.at(-1)).toEqual(["Narnia disabled.", "info"]);
	});

	it("restores mode from branch state", () => {
		const harness = createHarness([{ type: "custom", customType: "narnia", data: { enabled: true, previousActiveTools: ["read"] } }]);

		harness.events.session_start[0]({}, harness.ctx);
		expect(harness.delegate()).toBeTruthy();
		expect(harness.activeTools.at(-1)).toEqual(["delegate"]);

		harness.ctx.sessionManager.getBranch.mockReturnValue([
			{ type: "custom", customType: "narnia", data: { enabled: true, previousActiveTools: ["read"] } },
			{ type: "custom", customType: "narnia", data: { enabled: false, previousActiveTools: ["bash"] } },
		]);
		harness.events.session_tree[0]({}, harness.ctx);
		expect(harness.activeTools.at(-1)).toEqual(["bash"]);
	});

	it("adds root prompt and gates tools while enabled", async () => {
		const harness = createHarness();

		expect(harness.events.before_agent_start[0]({ systemPrompt: "base" }, harness.ctx)).toBeUndefined();
		await harness.commands.narnia.handler("on", harness.ctx);

		const promptResult = harness.events.before_agent_start[0]({ systemPrompt: "base" }, harness.ctx);
		expect(promptResult.systemPrompt).toContain("base\n\nNarnia mode is enabled");
		expect(harness.events.tool_call[0]({ toolName: "read" })).toEqual({
			block: true,
			reason: expect.stringContaining("root session cannot call tools directly"),
		});
		expect(harness.events.tool_call[0]({ toolName: "delegate" })).toBeUndefined();

		await harness.commands.narnia.handler("off", harness.ctx);
		expect(harness.events.tool_call[0]({ toolName: "read" })).toBeUndefined();
	});

	it("rejects semantically invalid delegate payloads without spawning children", async () => {
		const harness = createHarness();
		await harness.commands.narnia.handler("on", harness.ctx);
		const delegate = harness.delegate();

		await expect(delegate.execute("call", { tasks: [{ title: "   ", content: "x" }] }, undefined, undefined, harness.ctx)).resolves.toMatchObject({
			content: [{ type: "text", text: "Delegate task 1 title is empty." }],
			details: { exitCode: 1, tasks: [] },
		});
		await expect(delegate.execute("call", { tasks: [{ title: "one two three four five", content: "x" }] }, undefined, undefined, harness.ctx)).resolves.toMatchObject({
			content: [{ type: "text", text: "Delegate task 1 title must be 1-4 words." }],
			details: { exitCode: 1, tasks: [] },
		});
		await expect(delegate.execute("call", { tasks: [{ title: "Valid", content: "  \n\t  " }] }, undefined, undefined, harness.ctx)).resolves.toMatchObject({
			content: [{ type: "text", text: "Delegate task 1 content is empty." }],
			details: { exitCode: 1, tasks: [] },
		});
		expect(spawnMock).not.toHaveBeenCalled();
	});

	it("fans out child tasks and aggregates success and failure", async () => {
		const harness = createHarness();
		await harness.commands.narnia.handler("on", harness.ctx);
		const delegate = harness.delegate();
		const updates: unknown[] = [];

		queueChild(
			[
				{ type: "tool_execution_start", toolCallId: "r1", toolName: "read", args: { path: "src/a.ts" } },
				{ type: "tool_execution_end", toolCallId: "r1", toolName: "read", isError: false },
				{ type: "tool_execution_start", toolCallId: "b1", toolName: "bash", args: { command: "npm test" } },
				{ type: "tool_execution_end", toolCallId: "b1", toolName: "bash", isError: false, result: { details: { exitCode: 0 } } },
				{
					type: "message_end",
					message: {
						role: "assistant",
						content: [{ type: "text", text: childOutput("ok") }],
						provider: "fake-provider",
						model: "fake-model",
						usage: { input: 10, output: 5, cacheRead: 2, cacheWrite: 1, totalTokens: 20, cost: { total: 0.01 } },
						stopReason: "stop",
					},
				},
			],
			0,
		);
		queueChild(
			[
				{
					type: "message_end",
					message: {
						role: "assistant",
						content: [{ type: "text", text: childOutput("bad") }],
						stopReason: "error",
						errorMessage: "boom",
					},
				},
			],
			1,
			"stderr text",
		);

		const result = await delegate.execute(
			"call",
			{
				tasks: [
					{ title: "  Read   task  ", content: "  inspect file  " },
					{ title: "Fail task", content: "fail intentionally" },
				],
			},
			undefined,
			(update: unknown) => updates.push(update),
			harness.ctx,
		);

		expect(spawnMock).toHaveBeenCalledTimes(2);
		expect(spawnMock.mock.calls.every((call) => call[2].env.PI_NARNIA_CHILD === "1")).toBe(true);
		const firstSpawnArgs = spawnMock.mock.calls[0][1].slice(spawnMock.mock.calls[0][1].indexOf("--mode"));
		expect(firstSpawnArgs).toEqual([
			"--mode",
			"json",
			"-p",
			"--no-session",
			"--tools",
			"read,bash,write",
			"--append-system-prompt",
			"Follow the delegated task exactly. Do not delegate further. Return only what the parent needs.",
			"--model",
			"fake/model",
			"--thinking",
			"medium",
			"--approve",
			expect.stringContaining("Task title: Read task\n\nTask:\ninspect file"),
		]);
		expect(result.content[0].text).toContain("1/2 tasks succeeded.");
		expect(result.details.exitCode).toBe(1);
		expect(result.details.tasks.map((task: any) => task.exitCode)).toEqual([0, 1]);
		expect(result.details.tasks[0].text).toContain("Result: ok");
		expect(result.details.tasks[0].tools).toEqual([
			{ name: "read", args: { path: "src/a.ts" } },
			{ name: "bash", args: { command: "npm test" } },
		]);
		expect(result.details.tasks[1].text).toContain("Delegate failed (error) [exit 1]");
		expect(updates.length).toBeGreaterThan(0);
	});

	it("does not cap aggregate returned output", async () => {
		const harness = createHarness();
		await harness.commands.narnia.handler("on", harness.ctx);
		const delegate = harness.delegate();
		const largeOutput = "x".repeat(13 * 1024);

		queueChild(
			[
				{
					type: "message_end",
					message: {
						role: "assistant",
						content: [{ type: "text", text: largeOutput }],
						stopReason: "stop",
					},
				},
			],
			0,
		);

		const result = await delegate.execute("call", { tasks: [{ title: "Large", content: "produce large output" }] }, undefined, undefined, harness.ctx);

		expect(result.content[0].text).toContain(largeOutput);
		expect(result.details.tasks[0].text).toBe(largeOutput);
	});

	it("rejects overlapping delegate calls", async () => {
		const harness = createHarness();
		await harness.commands.narnia.handler("on", harness.ctx);
		const delegate = harness.delegate();
		const proc = makeProcess();
		spawnMock.mockReturnValueOnce(proc);

		const first = delegate.execute("first", { tasks: [{ title: "Slow", content: "wait" }] }, undefined, undefined, harness.ctx);
		const second = await delegate.execute("second", { tasks: [{ title: "Next", content: "now" }] }, undefined, undefined, harness.ctx);

		expect(second.content[0].text).toContain("Delegate already has an active call");
		expect(second.details).toMatchObject({ exitCode: 1, tasks: [] });
		expect(spawnMock).toHaveBeenCalledTimes(1);

		proc.emit("close", 0, null);
		await expect(first).resolves.toMatchObject({ details: { exitCode: 0 } });
	});

	it("renders delegate call and result without throwing", async () => {
		const harness = createHarness();
		await harness.commands.narnia.handler("on", harness.ctx);
		const delegate = harness.delegate();
		const theme = {
			fg: (_color: string, text: string) => text,
			bold: (text: string) => text,
		};
		const result = {
			content: [{ type: "text", text: `1/1 tasks succeeded.\n\n## Render\n\n${childOutput("rendered")}` }],
			details: {
				tasks: [
					{
						title: "Render",
						exitCode: 0,
						durationMs: 12,
						text: childOutput("rendered"),
						tools: [{ name: "read", args: { path: "a.ts" } }],
					},
				],
				exitCode: 0,
			},
		};
		const context = { args: { tasks: [{ title: "Render", content: "smoke" }] }, isError: false };

		const call = delegate.renderCall(context.args, theme, { lastComponent: undefined });
		expect(call.text).toContain("delegate: 1 task");
		expect(call.text).toContain("Render");
		expect(() => delegate.renderResult(result, { expanded: false, isPartial: false }, theme, context)).not.toThrow();
		expect(() => delegate.renderResult(result, { expanded: true, isPartial: false }, theme, context)).not.toThrow();
	});
});
