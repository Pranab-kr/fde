/**
 * Hallmark Studio · Frontend Client Logic
 * Genre: Modern-Minimal
 * States: default, hover, focus-visible, active, disabled, loading, error, success
 */

export let currentMode = "assistant";

/**
 * Clean trailing punctuation from detected URL.
 */
function cleanUrl(url) {
	return url.replace(/[.,;:!?)'"]+$/, "");
}

/**
 * Extracts a website preview URL from LLM response text.
 * Matches both full URLs (http://localhost:3000/sites/...) and relative paths (/sites/...).
 */
export function extractPreviewUrl(text) {
	if (!text || typeof text !== "string") return null;

	// Full localhost or domain url with /sites/
	const fullMatch = text.match(/https?:\/\/[^\s"'`<>)]*\/sites\/[a-zA-Z0-9_./-]+/);
	if (fullMatch) {
		return cleanUrl(fullMatch[0]);
	}

	// Relative /sites/ path
	const relMatch = text.match(/\/sites\/[a-zA-Z0-9_./-]+/);
	if (relMatch) {
		return cleanUrl(relMatch[0]);
	}

	return null;
}

/**
 * Normalizes preview URL to ensure it targets /index.html for static rendering.
 */
export function normalizePreviewUrl(url) {
	if (!url || typeof url !== "string") return "";
	const cleaned = cleanUrl(url.trim());
	if (cleaned.endsWith("/index.html")) {
		return cleaned;
	}
	if (cleaned.endsWith("/")) {
		return `${cleaned}index.html`;
	}
	if (!cleaned.endsWith(".html")) {
		return `${cleaned}/index.html`;
	}
	return cleaned;
}

/**
 * Extracts the site directory name from a /sites/<sitename>/ URL.
 */
export function extractSiteName(url) {
	if (!url || typeof url !== "string") return null;
	const match = url.match(/\/sites\/([a-zA-Z0-9_-]+)/);
	return match ? match[1] : null;
}

/**
 * Applies Hallmark 8-state interactive control discipline to an element.
 * Supported states: 'default', 'loading', 'error', 'success', 'disabled'.
 */
export function setInteractiveState(element, state) {
	if (!element) return;

	element.setAttribute("data-state", state);

	const removeAll = (...classes) => {
		for (const cls of classes) {
			element.classList.remove(cls);
		}
	};

	switch (state) {
		case "loading":
			element.classList.add("is-loading");
			removeAll("is-error", "is-success", "is-disabled");
			element.disabled = true;
			element.setAttribute("aria-disabled", "true");
			break;

		case "error":
			element.classList.add("is-error");
			removeAll("is-loading", "is-success", "is-disabled");
			element.disabled = false;
			element.removeAttribute("aria-disabled");
			break;

		case "success":
			element.classList.add("is-success");
			removeAll("is-loading", "is-error", "is-disabled");
			element.disabled = false;
			element.removeAttribute("aria-disabled");
			break;

		case "disabled":
			element.classList.add("is-disabled");
			removeAll("is-loading", "is-error", "is-success");
			element.disabled = true;
			element.setAttribute("aria-disabled", "true");
			break;

		case "default":
		default:
			removeAll("is-loading", "is-error", "is-success", "is-disabled");
			element.disabled = false;
			element.removeAttribute("aria-disabled");
			element.setAttribute("data-state", "default");
			break;
	}
}

/**
 * HTML entity escaping for XSS prevention in message logs.
 */
export function escapeHtml(str) {
	if (typeof str !== "string") return "";
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Formats message body content into paragraphs, code blocks, and clickable links.
 */
export function formatMessageBody(container, content) {
	if (!container || !content) return;

	const parts = content.split(/(```[\s\S]*?```)/g);

	for (const part of parts) {
		if (part.startsWith("```") && part.endsWith("```")) {
			const codeContent = part.slice(3, -3).replace(/^[a-zA-Z0-9_-]*\n/, "");
			const pre = document.createElement("pre");
			const code = document.createElement("code");
			code.textContent = codeContent.trim();
			pre.appendChild(code);
			container.appendChild(pre);
		} else {
			const paragraphs = part.split(/\n\s*\n/);
			for (const para of paragraphs) {
				const trimmed = para.trim();
				if (!trimmed) continue;
				const p = document.createElement("p");

				let html = escapeHtml(trimmed);

				// Markdown link [label](url)
				html = html.replace(
					/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/sites\/[^\s)]+)\)/g,
					'<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>'
				);

				// Raw URLs: extract clean URL and preserve trailing punctuation outside anchor
				html = html.replace(
					/(^|[\s(])(https?:\/\/[^\s)]+|\/sites\/[^\s)]+)/g,
					(match, prefix, rawUrl) => {
						const punctMatch = rawUrl.match(/[.,;:!?)"']+$/);
						const punct = punctMatch ? punctMatch[0] : "";
						const clean = rawUrl.slice(0, rawUrl.length - punct.length);
						return `${prefix}<a href="${clean}" target="_blank" rel="noopener noreferrer" class="chat-link">${clean}</a>${punct}`;
					}
				);

				p.innerHTML = html.replace(/\n/g, "<br />");
				container.appendChild(p);
			}
		}
	}
}

/**
 * Appends a formatted message entry into the messages container log.
 */
export function appendMessage({ role, content, isThinking = false }) {
	const container = document.getElementById("messages-container");
	if (!container) return null;

	const item = document.createElement("div");
	item.className = `message-item message-${role}${isThinking ? " is-thinking" : ""}`;

	const meta = document.createElement("div");
	meta.className = "message-meta";

	const sender = document.createElement("span");
	sender.className = "sender-tag";
	sender.textContent = role === "user" ? "You" : role === "assistant" ? "Assistant" : "System";

	const time = document.createElement("span");
	time.className = "message-timestamp";
	const now = new Date();
	time.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

	meta.appendChild(sender);
	meta.appendChild(time);

	const body = document.createElement("div");
	body.className = "message-body";

	if (isThinking) {
		const p = document.createElement("p");
		p.textContent = role === "assistant" && currentMode === "studio"
			? "Generating website with Hallmark modern-minimal standards..."
			: "Thinking...";
		body.appendChild(p);
	} else {
		formatMessageBody(body, content);
	}

	item.appendChild(meta);
	item.appendChild(body);
	container.appendChild(item);
	container.scrollTop = container.scrollHeight;

	return item;
}

/**
 * Updates the Website Studio live preview panel with loaded site details.
 */
export function updatePreviewPanel({ url, siteName }) {
	const previewFrame = document.getElementById("preview-frame");
	const previewExternalLink = document.getElementById("preview-external-link");
	const previewEmptyState = document.getElementById("preview-empty-state");
	const previewSitename = document.getElementById("preview-sitename");
	const previewUrlDisplay = document.getElementById("preview-url-display");
	const previewStatusText = document.getElementById("preview-status-text");
	const previewStatusIndicator = document.getElementById("preview-status-indicator");

	if (!url) return;

	const normalized = normalizePreviewUrl(url);
	const name = siteName || extractSiteName(url) || "Generated Site";

	if (previewSitename) previewSitename.textContent = name;
	if (previewUrlDisplay) previewUrlDisplay.textContent = normalized;
	if (previewEmptyState) previewEmptyState.style.display = "none";
	if (previewFrame) previewFrame.src = normalized;

	if (previewExternalLink) {
		previewExternalLink.href = normalized;
		previewExternalLink.classList.remove("is-disabled");
		previewExternalLink.setAttribute("aria-disabled", "false");
		previewExternalLink.removeAttribute("tabindex");
	}

	if (previewStatusText) previewStatusText.textContent = "Status: Live";
	if (previewStatusIndicator) {
		previewStatusIndicator.style.backgroundColor = "var(--color-success)";
	}
}

/**
 * Sends a query string to the backend API according to the selected mode.
 */
export async function sendQuery(promptText, mode = currentMode) {
	const endpoint = mode === "studio" ? "/api/website" : "/api/chat";
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "text/plain",
		},
		body: promptText,
	});

	if (!response.ok) {
		let errorMsg = `Server error (${response.status})`;
		try {
			const errorData = await response.json();
			if (errorData?.error) errorMsg = errorData.error;
		} catch {
			const text = await response.text();
			if (text) errorMsg = text;
		}
		throw new Error(errorMsg);
	}

	return await response.text();
}

/**
 * Switches the active application mode between 'assistant' and 'studio'.
 */
export function setMode(mode) {
	currentMode = mode === "studio" ? "studio" : "assistant";
	const stage = document.getElementById("app-stage");
	const assistantBtn = document.getElementById("mode-assistant");
	const studioBtn = document.getElementById("mode-studio");
	const panelTitle = document.getElementById("panel-title");
	const panelEyebrow = document.getElementById("panel-eyebrow");
	const promptInput = document.getElementById("prompt-input");

	if (currentMode === "studio") {
		if (stage) {
			stage.classList.remove("mode-assistant");
			stage.classList.add("mode-studio");
		}
		if (assistantBtn) {
			assistantBtn.classList.remove("is-active");
			assistantBtn.setAttribute("aria-checked", "false");
		}
		if (studioBtn) {
			studioBtn.classList.add("is-active");
			studioBtn.setAttribute("aria-checked", "true");
		}
		if (panelTitle) panelTitle.textContent = "Website Studio";
		if (panelEyebrow) panelEyebrow.textContent = "STUDIO PROMPT";
		if (promptInput) {
			promptInput.placeholder = "Describe a website to generate (e.g. minimal architect portfolio)...";
		}
	} else {
		if (stage) {
			stage.classList.remove("mode-studio");
			stage.classList.add("mode-assistant");
		}
		if (studioBtn) {
			studioBtn.classList.remove("is-active");
			studioBtn.setAttribute("aria-checked", "false");
		}
		if (assistantBtn) {
			assistantBtn.classList.add("is-active");
			assistantBtn.setAttribute("aria-checked", "true");
		}
		if (panelTitle) panelTitle.textContent = "AI Assistant";
		if (panelEyebrow) panelEyebrow.textContent = "CONVERSATION";
		if (promptInput) {
			promptInput.placeholder = "Ask the assistant or calculate, check weather, currency...";
		}
	}
}

/**
 * Active timer ID for interactive settle-back transitions.
 */
export let activeSettleTimer = null;

/**
 * Main prompt form submission handler with 8-state feedback loop.
 */
export async function handleSubmit(event) {
	if (event) event.preventDefault();

	const input = document.getElementById("prompt-input");
	const sendBtn = document.getElementById("send-btn");
	const statusMsg = document.getElementById("prompt-status-msg");
	const headerStatusLabel = document.getElementById("header-status-label");
	const headerStatusIndicator = document.getElementById("header-status-indicator");

	if (!input || !sendBtn) return;

	const promptText = input.value.trim();
	if (!promptText) return;
	if (sendBtn.disabled || sendBtn.classList.contains("is-loading")) return;

	// Cancel any pending settle-back transition timer from a previous request
	if (activeSettleTimer !== null) {
		clearTimeout(activeSettleTimer);
		activeSettleTimer = null;
	}

	// Reset input and height
	input.value = "";
	input.style.height = "auto";

	// 8-State: Loading transition
	setInteractiveState(sendBtn, "loading");
	setInteractiveState(input, "loading");
	if (statusMsg) {
		statusMsg.textContent = currentMode === "studio"
			? "Generating static website..."
			: "Consulting tools...";
	}
	if (headerStatusLabel) {
		headerStatusLabel.textContent = currentMode === "studio" ? "Generating" : "Thinking";
	}
	if (headerStatusIndicator) {
		headerStatusIndicator.style.backgroundColor = "var(--color-accent)";
	}

	// Append user entry
	appendMessage({ role: "user", content: promptText });

	// Append thinking placeholder
	const thinkingNode = appendMessage({ role: "assistant", content: "", isThinking: true });

	try {
		const replyText = await sendQuery(promptText, currentMode);

		// Remove thinking placeholder
		if (thinkingNode && thinkingNode.parentNode) {
			thinkingNode.parentNode.removeChild(thinkingNode);
		}

		// Append assistant response
		appendMessage({ role: "assistant", content: replyText });

		// Live preview URL extraction and iframe updating
		const previewUrl = extractPreviewUrl(replyText);
		if (previewUrl) {
			const siteName = extractSiteName(previewUrl);
			updatePreviewPanel({ url: previewUrl, siteName });
		}

		// 8-State: Success transition
		setInteractiveState(sendBtn, "success");
		setInteractiveState(input, "success");
		if (statusMsg) statusMsg.textContent = "Complete";
		if (headerStatusLabel) headerStatusLabel.textContent = "Ready";
		if (headerStatusIndicator) {
			headerStatusIndicator.style.backgroundColor = "var(--color-success)";
		}

		// Settle back to default state after 1500ms
		if (activeSettleTimer !== null) {
			clearTimeout(activeSettleTimer);
			activeSettleTimer = null;
		}
		activeSettleTimer = setTimeout(() => {
			activeSettleTimer = null;
			if (sendBtn.getAttribute("data-state") === "loading") return;
			setInteractiveState(sendBtn, "default");
			setInteractiveState(input, "default");
			if (statusMsg) statusMsg.textContent = "";
			if (typeof input.focus === "function") input.focus();
		}, 1500);

	} catch (err) {
		if (thinkingNode && thinkingNode.parentNode) {
			thinkingNode.parentNode.removeChild(thinkingNode);
		}

		// Restore prompt text if input is currently empty so the user doesn't lose what they typed
		if (!input.value.trim()) {
			input.value = promptText;
			input.style.height = "auto";
			input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
		}

		appendMessage({
			role: "system",
			content: `Error: ${err.message || "Failed to communicate with server"}`,
		});

		// 8-State: Error transition
		setInteractiveState(sendBtn, "error");
		setInteractiveState(input, "error");
		if (statusMsg) statusMsg.textContent = `Error: ${err.message}`;
		if (headerStatusLabel) headerStatusLabel.textContent = "Error";
		if (headerStatusIndicator) {
			headerStatusIndicator.style.backgroundColor = "var(--color-error)";
		}

		// Settle back to default state after 2500ms
		if (activeSettleTimer !== null) {
			clearTimeout(activeSettleTimer);
			activeSettleTimer = null;
		}
		activeSettleTimer = setTimeout(() => {
			activeSettleTimer = null;
			if (sendBtn.getAttribute("data-state") === "loading") return;
			setInteractiveState(sendBtn, "default");
			setInteractiveState(input, "default");
			if (statusMsg) statusMsg.textContent = "";
			if (headerStatusLabel) headerStatusLabel.textContent = "Ready";
			if (headerStatusIndicator) {
				headerStatusIndicator.style.backgroundColor = "var(--color-success)";
			}
			if (typeof input.focus === "function") input.focus();
		}, 2500);
	}
}

/**
 * Clears the context history both locally and on the server.
 */
export async function handleClearContext() {
	const clearBtn = document.getElementById("clear-context-btn");
	const statusMsg = document.getElementById("prompt-status-msg");
	const messagesContainer = document.getElementById("messages-container");

	if (clearBtn) {
		setInteractiveState(clearBtn, "loading");
	}
	if (statusMsg) {
		statusMsg.textContent = "Clearing context...";
	}

	try {
		const res = await fetch("/api/clear", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mode: currentMode }),
		});

		if (!res.ok) {
			throw new Error(`Server returned ${res.status}`);
		}

		if (messagesContainer) {
			messagesContainer.innerHTML = `
				<div class="message-item message-system">
					<div class="message-role">SYSTEM</div>
					<div class="message-body">
						<p>Context history has been cleared. The LLM context window is fresh and ready.</p>
					</div>
				</div>
			`;
		}

		if (clearBtn) {
			setInteractiveState(clearBtn, "success");
		}
		if (statusMsg) {
			statusMsg.textContent = "Context cleared";
		}

		setTimeout(() => {
			if (clearBtn) setInteractiveState(clearBtn, "default");
			if (statusMsg) statusMsg.textContent = "";
		}, 1500);
	} catch (err) {
		console.error("Failed to clear context:", err);
		if (clearBtn) {
			setInteractiveState(clearBtn, "error");
		}
		if (statusMsg) {
			statusMsg.textContent = `Error: ${err.message}`;
		}
		setTimeout(() => {
			if (clearBtn) setInteractiveState(clearBtn, "default");
			if (statusMsg) statusMsg.textContent = "";
		}, 2000);
	}
}

/**
 * Initializes DOM listeners and bindings.
 */
export function initApp() {
	const form = document.getElementById("prompt-form");
	const input = document.getElementById("prompt-input");
	const assistantBtn = document.getElementById("mode-assistant");
	const studioBtn = document.getElementById("mode-studio");
	const clearBtn = document.getElementById("clear-context-btn");

	if (form) {
		form.addEventListener("submit", handleSubmit);
	}

	if (input) {
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSubmit();
			}
		});

		input.addEventListener("input", () => {
			input.style.height = "auto";
			input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
		});
	}

	if (assistantBtn) {
		assistantBtn.addEventListener("click", () => setMode("assistant"));
	}

	if (studioBtn) {
		studioBtn.addEventListener("click", () => setMode("studio"));
	}

	if (clearBtn) {
		clearBtn.addEventListener("click", handleClearContext);
	}
}

// Auto-boot if running in browser DOM
if (typeof window !== "undefined") {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initApp);
	} else {
		initApp();
	}
}
