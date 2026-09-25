import fs from "node:fs/promises";
import path from "node:path";
import cors from "cors";
import express from "express";
import OpenAI from "openai";
import "dotenv/config";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
export const websiteWorkspace = path.resolve(__dirname, "../generated-sites");

app.use(cors());
app.use(express.json());
app.use(express.text({ type: "*/*" }));
app.use(express.static(path.resolve(__dirname, "../public")));
app.use("/sites", express.static(websiteWorkspace));

export function createOpenAIClient(env = process.env) {
	const apiKey = (env.OPENAI_APIKEY || env.OPENAI_API_KEY || "").trim();
	const baseURL = (env.OPENAI_ENDPOINT || env.OPENAI_BASE_URL || "").trim();

	return new OpenAI({
		apiKey: apiKey || "unconfigured-api-key",
		...(baseURL ? { baseURL } : {}),
	});
}

let cachedOpenAI = null;
export function getOpenAI() {
	if (!cachedOpenAI) {
		cachedOpenAI = createOpenAIClient();
	}
	return cachedOpenAI;
}

const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const chatHistory = [];
const websiteHistory = [];

const chatSystemPrompt = `You are a helpful AI assistant with access to external tools.

Follow these rules:
1. For arithmetic calculations, ALWAYS use the calculator tool.
2. Always use calculator tool for even trivial calculation
3. For current weather, ALWAYS use the currentWeather tool.
4. For currency conversion or exchange rates, ALWAYS use the convertCurrency tool.
5. You may call multiple tools when solving a multi-step request.
6. After receiving tool results, explain the answer naturally.
7. Never invent current weather or exchange-rate information.`;

export function getHallmarkDesignGuide({
	topic = "general",
	genre = "modern-minimal",
} = {}) {
	return `
# Hallmark Design Guide for Modern-Minimal Static Websites

Topic: ${topic}
Genre: ${genre}

## 1. Minimal Theme Catalog
Select one of these curated themes:

- **Cobalt** (Engineering & Developer Tools, APIs, Products):
  - Canvas: Cool light paper \`oklch(98.5% 0.004 250)\`
  - Text: Cool charcoal ink \`oklch(24% 0.02 258)\`
  - Accent: Electric cobalt signal \`oklch(58% 0.20 256)\`
  - Borders/Hairlines: \`oklch(88% 0.01 250)\`
  - Typography: Space Grotesk (display), Inter (body), JetBrains Mono (code/labels)
  - Style: Clean 1px hairlines, 6px border radii, asymmetric layout, code/data focal element

- **Coral** (SaaS, Consumer, Creative Tools):
  - Canvas: Warm grey paper \`oklch(97% 0.01 60)\`
  - Text: Warm charcoal ink \`oklch(20% 0.015 50)\`
  - Accent: Vibrant coral signal \`oklch(65% 0.20 35)\`
  - Borders/Hairlines: \`oklch(88% 0.012 60)\`
  - Typography: Inter (display & body), JetBrains Mono (labels)

- **Studio** (Architecture, Portfolios, Design Studios):
  - Canvas: Stone paper \`oklch(96% 0.005 90)\`
  - Text: Deep mineral ink \`oklch(18% 0.005 90)\`
  - Accent: Graphite / slate signal \`oklch(35% 0.01 90)\`
  - Borders/Hairlines: \`oklch(85% 0.005 90)\`
  - Typography: Grotesk or clean system sans, monospaced metadata

- **Atelier** (Craft, Editorial, Long-form Content):
  - Canvas: Warm linen paper \`oklch(96% 0.01 80)\`
  - Text: Warm charcoal ink \`oklch(18% 0.01 60)\`
  - Accent: Deep olive / umber \`oklch(45% 0.08 120)\`
  - Borders/Hairlines: \`oklch(86% 0.01 80)\`
  - Typography: Clean serif or editorial sans pairing

- **Lumen** (Financial, Research, Institutional):
  - Canvas: Pale parchment \`oklch(97% 0.008 70)\`
  - Text: Deep charcoal ink \`oklch(19% 0.01 60)\`
  - Accent: Muted brass / amber signal \`oklch(70% 0.14 75)\`
  - Borders/Hairlines: \`oklch(88% 0.008 70)\`
  - Typography: System sans + monospace data tables

## 2. Locked Tokens (OKLCH)
Define tokens on :root in style.css using OKLCH and only use var(--token-name). Never use raw hex/rgb/hsl or inline colors:
\`\`\`css
:root {
  --color-paper: oklch(98.5% 0.004 250);
  --color-paper-subtle: oklch(96% 0.006 250);
  --color-ink: oklch(24% 0.02 258);
  --color-muted: oklch(50% 0.015 258);
  --color-hairline: oklch(88% 0.01 250);
  --color-accent: oklch(58% 0.20 256);
  --color-focus: oklch(58% 0.20 256);
  --font-display: "Space Grotesk", system-ui, -apple-system, sans-serif;
  --font-body: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
}
\`\`\`

## 3. Typography Rules
- 2+1 font discipline: display font + body font + optional mono for code/eyebrows.
- Roman headers only: Heading and display text MUST be roman (font-style: normal). No italic headers or italicized words inside headings.
- Clear typographic scale with proportional line-heights (display: 1.1-1.2, body: 1.5-1.6).

## 4. Macrostructure & Layout
Choose a clean, non-generic layout rhythm:
- Workbench: Top navigation bar, split asymmetric panels, interactive main stage.
- Bento Grid: Asymmetric grid cards with varied cell spans (e.g. 2x1, 1x1, 1x2) framed with hairlines.
- Long Document: Generous margins, sticky table-of-contents or side rail, section dividers.
- Marquee Hero: Bold left-aligned typography with interactive showcase or data preview on the right.

## 5. Anti-Slop Discipline
- No fabricated metrics: Do not invent stats ("99.9% uptime", "10,000+ happy users"). Use genuine descriptive copy or labeled placeholders.
- No re-drawn UI chrome: Do not draw fake browser windows, phone cases, or mock titlebar dots around content. Let content stand naturally.
- Mobile responsiveness: Tested from 320px to 1200px. Root \`overflow-x: clip\` on html and body. No horizontal scroll. Display headers must wrap safely (\`overflow-wrap: anywhere\`).
- 8-State interactive completeness: All buttons, links, and inputs must handle 8 states:
  1. Default
  2. Hover
  3. Focus-visible (outline with offset)
  4. Active
  5. Disabled
  6. Loading (spinner or disabled state with indicator)
  7. Error
  8. Success
`.trim();
}

export const websiteSystemPrompt = `You are an expert frontend website developer following Hallmark modern-minimal design standards.

Your job is to create complete static websites using the available tools.

Follow these rules:
1. Always call the getHallmarkDesignGuide tool first to get design tokens, macrostructures, typography rules, and anti-slop constraints for the requested website.
2. Select an appropriate theme from the guide (e.g., Cobalt, Coral, Studio, Atelier, Lumen). Never use a terminal or CRT hacker aesthetic.
3. Create a separate directory for every website inside the workspace (e.g., createDirectory({ path: "sitename" })).
4. Create index.html, style.css, and script.js using writeFile.
5. In style.css, lock design tokens with OKLCH CSS variables (--color-paper, --color-ink, --color-accent, --color-hairline, etc.) at :root. Never use inline raw colors or pure #000/#fff.
6. Enforce Roman display headers (no italic headers or emphasis words in headings).
7. Implement complete 8-state discipline for interactive controls (default, hover, focus-visible, active, disabled, loading, error, success).
8. Avoid AI slop: No fabricated metrics or fake proof, no re-drawn browser/phone chrome, ensure mobile responsiveness from 320px to 1200px (use overflow-x: clip).
9. Use only semantic HTML5, CSS3, and clean vanilla JavaScript.
10. Do not just return code in your response. Actually create all project files using tools.
11. After creating the website, list the project files and verify them.
12. Finish only when the complete website has been created, and ALWAYS provide the live preview URL at the end of your response: http://localhost:3000/sites/<sitename>/index.html`;

function calculate({ operation, a, b }) {
	console.log("Calculator tool called");

	if (operation === "add") return a + b;
	if (operation === "subtract") return a - b;
	if (operation === "multiply") return a * b;
	if (operation === "divide") {
		if (b === 0) throw new Error("Cannot divide by 0");
		return a / b;
	}
	if (operation === "mod") {
		if (b === 0) throw new Error("Cannot calculate mod by 0");
		return a % b;
	}
	if (operation === "power") return a ** b;
	throw new Error(`Unsupported operation ${operation}`);
}

async function currentWeather({ city }) {
	console.log("Weather tool called");
	const url = new URL("https://api.weatherapi.com/v1/current.json");
	url.searchParams.set("key", process.env.WEATHER_API_KEY);
	url.searchParams.set("q", city);
	const response = await fetch(url);
	if (!response.ok) throw new Error(await response.text());
	return response.text();
}

async function getExchangeRate({ from, to }) {
	console.log("Currency Exchange tool called");
	const response = await fetch(
		`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
	);
	if (!response.ok) throw new Error(await response.text());
	return response.text();
}

function safePath(relativePath) {
	const resolved = path.resolve(websiteWorkspace, relativePath);
	if (
		resolved !== websiteWorkspace &&
		!resolved.startsWith(`${websiteWorkspace}${path.sep}`)
	) {
		throw new Error("Access outside generated-sites is not allowed");
	}
	return resolved;
}

async function createDirectory({ path: relativePath }) {
	try {
		await fs.mkdir(safePath(relativePath), { recursive: true });
		return `Directory created successfully: ${relativePath}`;
	} catch (error) {
		return `Failed to create directory: ${error.message}`;
	}
}

async function writeFile({ path: relativePath, content }) {
	try {
		const file = safePath(relativePath);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(file, content, "utf8");
		return `File written successfully: ${relativePath}`;
	} catch (error) {
		return `Failed to write file: ${error.message}`;
	}
}

async function readFile({ path: relativePath }) {
	try {
		return await fs.readFile(safePath(relativePath), "utf8");
	} catch (error) {
		return `Failed to read file: ${error.message}`;
	}
}

async function listFiles({ path: relativePath }) {
	try {
		const directory = safePath(relativePath);
		try {
			await fs.access(directory);
		} catch {
			return `Directory does not exist: ${relativePath}`;
		}

		const files = [];
		async function walk(current) {
			for (const entry of await fs.readdir(current, { withFileTypes: true })) {
				const item = path.join(current, entry.name);
				files.push(path.relative(websiteWorkspace, item));
				if (entry.isDirectory()) await walk(item);
			}
		}
		await walk(directory);
		return files.join("\n");
	} catch (error) {
		return `Failed to list files: ${error.message}`;
	}
}

const chatTools = [
	{
		type: "function",
		function: {
			name: "calculate",
			description:
				"Performs arithmetic calculations. Supported operations: add, subtract, multiply, divide, mod, power.",
			parameters: {
				type: "object",
				properties: {
					operation: {
						type: "string",
						description:
							"Operation: add, subtract, multiply, divide, mod, power",
					},
					a: { type: "number", description: "First number" },
					b: { type: "number", description: "Second number" },
				},
				required: ["operation", "a", "b"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "currentWeather",
			description: "Get the current weather of a city.",
			parameters: {
				type: "object",
				properties: {
					city: { type: "string", description: "Name of the city" },
				},
				required: ["city"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "getExchangeRate",
			description: "Gets the latest exchange rate between two currencies.",
			parameters: {
				type: "object",
				properties: {
					from: {
						type: "string",
						description: "Source currency code, for example USD",
					},
					to: {
						type: "string",
						description: "Target currency code, for example INR",
					},
				},
				required: ["from", "to"],
			},
		},
	},
];

export const websiteTools = [
	tool(
		"getHallmarkDesignGuide",
		"Fetches curated Hallmark design guidelines, color tokens, typography rules, and macrostructures. Minimal themes only.",
		{
			topic: {
				type: "string",
				description:
					"Topic or type of website to generate, e.g. portfolio, saas, restaurant",
			},
			genre: {
				type: "string",
				description: "Design genre, e.g. modern-minimal",
			},
		},
	),
	tool(
		"createDirectory",
		"Creates a new directory inside the website workspace.",
		{
			path: {
				type: "string",
				description: "Relative directory path, for example brewlab",
			},
		},
	),
	tool(
		"writeFile",
		"Creates or overwrites a text file inside the website workspace. Use this to create HTML, CSS and JavaScript files.",
		{
			path: {
				type: "string",
				description: "Relative file path, for example brewlab/index.html",
			},
			content: {
				type: "string",
				description: "Complete content that should be written into the file",
			},
		},
	),
	tool(
		"readFile",
		"Reads the contents of an existing file from the website workspace.",
		{
			path: {
				type: "string",
				description: "Relative file path, for example brewlab/index.html",
			},
		},
	),
	tool(
		"listFiles",
		"Lists all files and directories inside a website project.",
		{
			path: {
				type: "string",
				description: "Relative directory path, for example brewlab",
			},
		},
	),
];

function tool(name, description, properties) {
	return {
		type: "function",
		function: {
			name,
			description,
			parameters: {
				type: "object",
				properties,
				required: Object.keys(properties),
			},
		},
	};
}

async function complete(systemPrompt, history, tools, functions, message) {
	const openai = getOpenAI();
	history.push({ role: "user", content: message });
	const messages = [{ role: "system", content: systemPrompt }, ...history];

	while (true) {
		const completion = await openai.chat.completions.create({
			model,
			messages,
			tools,
		});
		const reply = completion.choices[0].message;
		if (!reply.tool_calls?.length) {
			history.push({ role: "assistant", content: reply.content });
			return reply.content;
		}

		messages.push(reply);
		for (const call of reply.tool_calls) {
			const result = await functions[call.function.name](
				JSON.parse(call.function.arguments),
			);
			messages.push({
				role: "tool",
				tool_call_id: call.id,
				content: typeof result === "string" ? result : JSON.stringify(result),
			});
		}
	}
}

export function chat(message) {
	return complete(
		chatSystemPrompt,
		chatHistory,
		chatTools,
		{
			calculate,
			currentWeather,
			getExchangeRate,
		},
		message,
	);
}

export async function generateWebsite(message) {
	await fs.mkdir(websiteWorkspace, { recursive: true });
	return complete(
		websiteSystemPrompt,
		websiteHistory,
		websiteTools,
		{
			getHallmarkDesignGuide,
			createDirectory,
			writeFile,
			readFile,
			listFiles,
		},
		message,
	);
}

app.post("/api/chat", async (req, res) => {
	if (typeof req.body !== "string") {
		return res.status(400).json({ error: "Request body must be a string" });
	}
	try {
		const response = await chat(req.body);
		res.type("text/plain").send(response);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

app.post("/api/website", async (req, res) => {
	if (typeof req.body !== "string") {
		return res.status(400).json({ error: "Request body must be a string" });
	}
	try {
		const response = await generateWebsite(req.body);
		res.type("text/plain").send(response);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

export function clearHistory(mode = "all") {
	if (mode === "chat") {
		chatHistory.length = 0;
	} else if (mode === "website") {
		websiteHistory.length = 0;
	} else {
		chatHistory.length = 0;
		websiteHistory.length = 0;
	}
	return { ok: true, message: `Context history cleared for ${mode}` };
}

app.post("/api/clear", (req, res) => {
	try {
		let mode = "all";
		if (typeof req.body === "object" && req.body !== null && req.body.mode) {
			mode = req.body.mode;
		} else if (typeof req.body === "string" && req.body.trim()) {
			try {
				const parsed = JSON.parse(req.body);
				if (parsed.mode) mode = parsed.mode;
			} catch {
				mode = req.body.trim();
			}
		}
		const result = clearHistory(mode);
		res.json(result);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

export { app, chatHistory, websiteHistory };

const isDirectRun =
	Boolean(process.argv[1]) &&
	fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

export let server;
if (isDirectRun) {
	server = app.listen(3000, () => {
		console.log("Server is running on http://localhost:3000");
	});
}
