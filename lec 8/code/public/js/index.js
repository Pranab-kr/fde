/* anime-vec · one file for one page.
 *
 * Part 1 is the transport layer: the three routes in src/routes/animeRoutes.js,
 * their error wording, and the small DOM helpers the page half leans on.
 * Part 2 is the page controller: catalogue grid, genre filter, mood search, detail sheet.
 *
 * These were two files while a second page shared the transport. One page, one file.
 *
 * The OpenRouter key never reaches the browser — the server holds it.
 */

/**
 * anime-vec · API layer
 *
 * One place that knows how to talk to the three routes in src/routes/animeRoutes.js,
 * so the wording of a failure is decided once instead of per call site.
 *
 *   GET  /api/anime                          → the catalogue
 *   POST /api/anime/search  { query, limit } → ranked matches + similarity
 *   GET  /api/anime/:title/similar?limit=   → selected title + recommendations
 */

/* Same-origin in the browser. Opened straight off disk, it falls back to the local
   express server this project serves from. */
const ORIGIN =
	typeof location !== "undefined" && /^https?:$/.test(location.protocol)
		? location.origin
		: "http://localhost:3000";

const BASE = `${ORIGIN}/api/anime`;

class ApiError extends Error {
	constructor(message, status) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

async function request(path, options = {}) {
	let response;

	try {
		response = await fetch(path, {
			headers: { Accept: "application/json", ...(options.headers || {}) },
			...options,
		});
	} catch {
		throw new ApiError(
			"The server did not answer. Start it with npm run dev, then run the query again.",
			0,
		);
	}

	const body = await response.text();
	let payload = null;

	if (body) {
		try {
			payload = JSON.parse(body);
		} catch {
			payload = null;
		}
	}

	if (!response.ok || payload?.success === false) {
		throw new ApiError(
			payload?.error || `The request came back as ${response.status}. Nothing was changed.`,
			response.status,
		);
	}

	return payload;
}

/** Catalogue of every indexed title. Embeddings are stripped server-side. */
function getCatalog() {
	return request(BASE);
}

/**
 * Semantic search. The server embeds `query` and returns the nearest synopses.
 * @param {string} query  natural language, e.g. "a chef who stops cooking"
 * @param {number} [limit=3]
 */
function searchAnime(query, limit = 3) {
	const trimmed = String(query ?? "").trim();

	if (!trimmed) {
		return Promise.reject(
			new ApiError("Type a few words first — an empty sentence has nothing to embed.", 400),
		);
	}

	return request(`${BASE}/search?limit=${encodeURIComponent(limit)}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query: trimmed }),
	});
}

/**
 * Nearest neighbours of one catalogue title. The title is matched exactly and
 * case-insensitively, so it must be the string the API returns.
 * @param {string} title
 * @param {number} [limit=3]
 */
function getSimilar(title, limit = 3) {
	const trimmed = String(title ?? "").trim();

	if (!trimmed) {
		return Promise.reject(new ApiError("Pick a title before probing it.", 400));
	}

	return request(
		`${BASE}/${encodeURIComponent(trimmed)}/similar?limit=${encodeURIComponent(limit)}`,
	);
}

/* ── small DOM helpers, shared by both pages ─────────────────────────────────── */

function el(tag, props = {}, children = []) {
	const node = document.createElement(tag);

	for (const [key, value] of Object.entries(props)) {
		if (value === null || value === undefined || value === false) continue;

		if (key === "class") node.className = value;
		else if (key === "text") node.textContent = value;
		else if (key === "dataset") Object.assign(node.dataset, value);
		else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
		else node.setAttribute(key, value === true ? "" : String(value));
	}

	for (const child of [].concat(children)) {
		if (child === null || child === undefined || child === false) continue;
		node.append(child instanceof Node ? child : document.createTextNode(String(child)));
	}

	return node;
}

function clear(node) {
	node.replaceChildren();
}

/**
 * Open a native <dialog> modally. Falls back to the bare `open` attribute on
 * engines without showModal(), so the sheet still opens instead of throwing.
 */
function showDialog(dialog) {
	if (typeof dialog.showModal === "function") dialog.showModal();
	else dialog.setAttribute("open", "");
}

/** Close after the exit transition has played. */
function hideDialog(dialog, delay = 200) {
	dialog.classList.remove("is-open");
	document.body.style.overflow = "";

	setTimeout(() => {
		if (typeof dialog.close === "function") dialog.close();
		else dialog.removeAttribute("open");
	}, delay);
}

function formatScore(similarity) {
	const value = Number(similarity);
	return Number.isFinite(value) ? value.toFixed(4) : "—";
}

/**
 * Hold a pending state long enough to be read, and never flash it for fast calls.
 * Delays showing by 150 ms, and keeps a shown spinner up for 300 ms.
 * @param {(pending: boolean) => void} onChange
 */
function pendingController(onChange) {
	let showTimer;
	let hideTimer;
	let visible = false;

	return {
		begin() {
			clearTimeout(showTimer);
			clearTimeout(hideTimer);
			showTimer = setTimeout(() => {
				visible = true;
				onChange(true);
			}, 150);
		},
		end() {
			clearTimeout(showTimer);
			clearTimeout(hideTimer);
			if (!visible) return;
			hideTimer = setTimeout(() => {
				visible = false;
				onChange(false);
			}, 300);
		},
	};
}

/** Fill a button into its loading / error / success state. */
function buttonState(button, state, busyLabel) {
	if (!button) return;

	if (!button.dataset.label) button.dataset.label = button.textContent.trim();
	button.dataset.state = state;

	if (state !== "loading") {
		button.disabled = false;
		button.removeAttribute("aria-busy");
		button.textContent = button.dataset.label;
		return;
	}

	button.disabled = true;
	button.setAttribute("aria-busy", "true");
	button.replaceChildren(
		el("span", { class: "spinner", "aria-hidden": "true" }),
		document.createTextNode(busyLabel || "Working…"),
	);
}

/* ─────────────────────────────── the page half ───────────────────────────────
 *
 * The cover-first half of the engine:
 *   GET  /api/anime                 → the catalogue grid, the genre filter, the inventory line
 *   POST /api/anime/search          → the mood strip under the dark band
 *   GET  /api/anime/:title/similar  → the detail sheet's neighbour list
 */


const $ = (id) => document.getElementById(id);

const dom = {
	inventory: $("inventory-line"),
	filterCount: $("filter-count"),
	filter: $("filter"),
	grid: $("grid"),
	matches: $("matches-slot"),
	moodForm: $("mood-form"),
	moodInput: $("mood"),
	moodHelp: $("mood-help"),
	moodSubmit: $("mood-submit"),
	sheet: $("sheet"),
	sheetTitle: $("sheet-title"),
	sheetEyebrow: $("sheet-eyebrow"),
	sheetBody: $("sheet-body"),
};

const catalogue = [];
const seen = new Map();
let activeGenre = "All";
let lastFocused = null;

/* ── catalogue ────────────────────────────────────────────────────────────── */

function genreCounts() {
	const counts = new Map();

	for (const entry of catalogue) {
		for (const genre of entry.genres || []) {
			counts.set(genre, (counts.get(genre) || 0) + 1);
		}
	}

	return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function card(entry, rank) {
	const image = el("img", {
		src: entry.image,
		alt: `${entry.title} cover art`,
		width: "220",
		height: "293",
		loading: "lazy",
		decoding: "async",
	});

	const media = el("button", {
		class: "product__media",
		type: "button",
		"aria-label": `Open ${entry.title}`,
		onClick: () => openEntry(entry.title),
	}, [image]);

	if (Number.isInteger(rank)) {
		media.append(el("span", { class: "product__rank", text: `#${rank}` }));
	}

	const open = el("button", {
		class: "product__link",
		type: "button",
		onClick: () => openEntry(entry.title),
	}, [el("span", { text: "Similar titles" }), el("span", { "aria-hidden": "true", text: "→" })]);

	return el("article", { class: "product" }, [
		media,
		el("div", { class: "product__meta" }, [
			el("h3", { class: "product__name", text: entry.title }),
			el("p", {
				class: "product__genres",
				text: (entry.genres || []).slice(0, 3).join(" · "),
				title: (entry.genres || []).join(", "),
			}),
			open,
		]),
	]);
}

function visibleEntries() {
	if (activeGenre === "All") return catalogue;
	return catalogue.filter((entry) => (entry.genres || []).includes(activeGenre));
}

function renderGrid() {
	const entries = visibleEntries();
	clear(dom.grid);
	// no rank badge here: the catalogue is in dataset order, not a ranking
	dom.grid.append(...entries.map((entry) => card(entry)));

	dom.filterCount.textContent =
		activeGenre === "All"
			? `${entries.length} titles · ${genreCounts().length} genres`
			: `${entries.length} of ${catalogue.length} titles in ${activeGenre}`;
}

function renderSkeletons(count = 12) {
	clear(dom.grid);
	dom.grid.append(
		...Array.from({ length: count }, () => el("div", { class: "skeleton", "aria-hidden": "true" })),
	);
}

function renderFilter() {
	const genres = genreCounts();
	const options = [["All", catalogue.length], ...genres];

	clear(dom.filter);

	for (const [name, count] of options) {
		const chip = el("button", {
			class: "chip",
			type: "button",
			"aria-pressed": name === activeGenre ? "true" : "false",
			onClick: () => {
				activeGenre = name;
				renderFilter();
				renderGrid();
			},
		}, [
			el("span", { text: name }),
			el("span", { class: "mono chip__count", text: String(count) }),
		]);

		dom.filter.append(chip);
	}
}

/* ── the mood strip · POST /api/anime/search ──────────────────────────────── */

/**
 * The server only fails a search when the embedding provider refuses it, so the
 * wording has to name the real cause: an exhausted retry means a rate limit, not
 * a broken page. The catalogue and the similar-title lookup never touch it.
 */
function searchErrorText(error) {
	if (error.status === 401) {
		return "The server has no OpenRouter key, so it cannot embed a new sentence. Add one to .env and restart.";
	}

	if (/rate limit|retries/i.test(error.message)) {
		return "The embedding provider is rate-limiting this key, so the query was dropped after three tries. Wait a minute and run it again — browsing and similar titles still work.";
	}

	return error.message;
}

function matchCard(entry, rank) {
	const cover = el("img", {
		src: entry.image,
		alt: `${entry.title} cover art`,
		width: "220",
		height: "293",
		loading: "lazy",
		decoding: "async",
	});

	return el("article", { class: "product" }, [
		el("button", {
			class: "product__media",
			type: "button",
			"aria-label": `Open ${entry.title}`,
			onClick: () => openEntry(entry.title),
		}, [cover, el("span", { class: "product__rank", text: `#${rank}` })]),
		el("div", { class: "product__meta" }, [
			el("h3", { class: "product__name", text: entry.title }),
			el("p", { class: "similar__score", text: formatScore(entry.similarity) }),
			el("p", {
				class: "product__genres",
				text: (entry.genres || []).slice(0, 3).join(" · "),
			}),
		]),
	]);
}

function renderMatches(payload) {
	clear(dom.matches);

	const section = el("section", { class: "matches", "aria-label": "Matches for your mood" }, [
		el("div", { class: "matches__head" }, [
			el("h2", { class: "matches__title", text: `For “${payload.query}”` }),
			el("p", { class: "mono", text: `${payload.count} matches · cosine score below each title` }),
		]),
		el(
			"div",
			{ class: "matches__grid" },
			payload.results.map((entry, i) => matchCard(entry, i + 1)),
		),
	]);

	dom.matches.append(section);
	section.scrollIntoView({ block: "nearest" });
}

const moodPending = pendingController((pending) => {
	if (pending) {
		buttonState(dom.moodSubmit, "loading", "Reading…");
		dom.moodHelp.textContent = "Embedding your sentence and scoring it against all fifty synopses.";
		return;
	}
	if (dom.moodSubmit.dataset.state === "loading") buttonState(dom.moodSubmit, "idle");
});

dom.moodForm.addEventListener("submit", async (event) => {
	event.preventDefault();

	const mood = dom.moodInput.value.trim();
	dom.moodInput.removeAttribute("aria-invalid");
	dom.moodHelp.dataset.tone = "neutral";
	dom.moodHelp.textContent = "Three matches, ranked by how close the synopsis sits to your sentence.";

	if (!mood) {
		dom.moodInput.setAttribute("aria-invalid", "true");
		dom.moodHelp.dataset.tone = "error";
		dom.moodHelp.textContent = "Write a few words first — an empty sentence has nothing to match against.";
		dom.moodInput.focus();
		return;
	}

	moodPending.begin();

	try {
		const payload = await searchAnime(mood, 3);
		renderMatches(payload);
		dom.moodHelp.textContent = `Found ${payload.count} matches for “${mood}”. Open any cover to go deeper.`;
		buttonState(dom.moodSubmit, "success");
		setTimeout(() => buttonState(dom.moodSubmit, "idle"), 1600);
	} catch (error) {
		dom.moodInput.setAttribute("aria-invalid", "true");
		dom.moodHelp.dataset.tone = "error";
		dom.moodHelp.textContent = searchErrorText(error);
		buttonState(dom.moodSubmit, "error");
		setTimeout(() => buttonState(dom.moodSubmit, "idle"), 2400);
	} finally {
		moodPending.end();
	}
});

dom.moodInput.addEventListener("input", () => {
	if (dom.moodInput.getAttribute("aria-invalid") === "true") {
		dom.moodInput.removeAttribute("aria-invalid");
		dom.moodHelp.dataset.tone = "neutral";
		dom.moodHelp.textContent = "Three matches, ranked by how close the synopsis sits to your sentence.";
	}
});

/* ── detail sheet · GET /api/anime/:title/similar ─────────────────────────── */

function findEntry(title) {
	return catalogue.find((entry) => entry.title === title) || seen.get(title) || null;
}

function neighbourRow(entry) {
	const cover = el("img", {
		class: "similar__cover",
		src: entry.image,
		alt: `${entry.title} cover art`,
		width: "120",
		height: "160",
		loading: "lazy",
		decoding: "async",
	});

	return el("div", { class: "similar" }, [
		cover,
		el("div", {}, [
			el("button", {
				class: "product__link",
				type: "button",
				onClick: () => openEntry(entry.title),
			}, [el("span", { text: entry.title }), el("span", { "aria-hidden": "true", text: "→" })]),
			el("p", { class: "similar__score", text: formatScore(entry.similarity) }),
			el("p", { class: "similar__genres", text: (entry.genres || []).join(", ") }),
		]),
	]);
}

function paintEntry(entry) {
	dom.sheetTitle.textContent = entry.title;
	dom.sheetEyebrow.textContent = `Catalogue entry · ${entry.id} of ${catalogue.length || "—"}`;

	clear(dom.sheetBody);

	const cover = el("img", {
		class: "sheet__cover",
		src: entry.image,
		alt: `${entry.title} cover art`,
		width: "220",
		height: "293",
		decoding: "async",
	});

	const genres = el(
		"div",
		{ class: "sheet__genres" },
		(entry.genres || []).map((genre) => el("span", { text: genre })),
	);

	dom.sheetBody.append(
		el("div", { class: "sheet__figure" }, [
			cover,
			el("div", {}, [
				el("p", { class: "mono", text: `AniList id ${entry.anilistId ?? "—"}` }),
				genres,
			]),
		]),
		el("p", { class: "sheet__synopsis", text: entry.description || "No synopsis on file." }),
		el("div", { id: "sheet-neighbours" }, [
			el("p", { class: "sheet__status", text: "Finding the three closest synopses…" }),
		]),
	);
}

let neighbourRun = 0;

async function loadNeighbours(entry) {
	const slot = $("sheet-neighbours");
	if (!slot) return;

	const run = ++neighbourRun;

	const pending = pendingController((busy) => {
		if (busy) {
			clear(slot);
			slot.append(el("p", { class: "sheet__status", text: "Finding the three closest synopses…" }));
		}
	});

	pending.begin();

	try {
		const payload = await getSimilar(entry.title, 3);
		if (run !== neighbourRun) return;

		for (const item of payload.recommendations) seen.set(item.title, item);

		clear(slot);
		slot.append(
			el("p", { class: "mono", text: "Nearest by synopsis" }),
			el("div", { class: "sheet__list" }, payload.recommendations.map(neighbourRow)),
			el("p", {
				class: "sheet__note",
				text: "Cosine values sit low because these are synopsis vectors, not ratings. Use them to order the list, not to grade it.",
			}),
		);
	} catch (error) {
		if (run !== neighbourRun) return;

		clear(slot);
		slot.append(
			el("p", {
				class: "sheet__status sheet__status--error",
				text:
					error.status === 404
						? "That title is not in the catalogue, so it has no neighbours."
						: error.message,
			}),
		);
	} finally {
		pending.end();
	}
}

function openSheet() {
	if (!dom.sheet.open) {
		lastFocused = document.activeElement;
		showDialog(dom.sheet);
		document.body.style.overflow = "hidden";
		requestAnimationFrame(() => {
			dom.sheet.classList.add("is-open");
			dom.sheet.querySelector(".sheet__panel").focus();
		});
	}
}

function closeSheet() {
	if (!dom.sheet.open) return;
	hideDialog(dom.sheet);
}

function openEntry(title) {
	const entry = findEntry(title);

	if (!entry) {
		dom.sheetTitle.textContent = "Not in the catalogue";
		dom.sheetEyebrow.textContent = "Unknown title";
		clear(dom.sheetBody);
		dom.sheetBody.append(
			el("p", { class: "sheet__status sheet__status--error", text: `“${title}” is not one of the fifty indexed titles.` }),
		);
		openSheet();
		return;
	}

	paintEntry(entry);
	openSheet();
	loadNeighbours(entry);
}

dom.sheet.addEventListener("cancel", (event) => {
	event.preventDefault();
	closeSheet();
});

dom.sheet.addEventListener("click", (event) => {
	if (event.target.dataset.close !== undefined) closeSheet();
});

dom.sheet.addEventListener("close", () => {
	document.body.style.overflow = "";
	lastFocused?.focus?.();
});

/* ── boot ─────────────────────────────────────────────────────────────────── */

function renderOffline(error) {
	dom.inventory.textContent = "Catalogue unavailable";
	dom.filterCount.textContent = "—";
	clear(dom.grid);
	dom.grid.append(
		el("div", { class: "empty-note empty-note--wide" }, [
			el("h3", { text: "The catalogue did not load." }),
			el("p", { text: error.message }),
			el("button", {
				class: "btn btn--quiet",
				type: "button",
				text: "Try again",
				onClick: () => window.location.reload(),
			}),
		]),
	);
}

async function boot() {
	renderSkeletons();

	try {
		const payload = await getCatalog();
		catalogue.push(...payload.data);

		dom.inventory.textContent = `${payload.total} titles · ${genreCounts().length} genres · covers by AniList`;
		renderFilter();
		renderGrid();
	} catch (error) {
		renderOffline(error);
	}
}

boot();
