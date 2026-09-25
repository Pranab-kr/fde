document.addEventListener("DOMContentLoaded", () => {
  const chatMessages = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const clearBtn = document.getElementById("clear-btn");
  const comfortBtn = document.getElementById("comfort-btn");
  const headpatBtn = document.getElementById("headpat-btn");

  const EVELYN_AVATAR = "https://api.dicebear.com/7.x/bottts/svg?seed=EvelynMommy";

  // Auto-resize textarea like modern ai-chat-input
  function adjustTextareaHeight() {
    userInput.style.height = "auto";
    const newHeight = Math.min(userInput.scrollHeight, 150);
    userInput.style.height = `${newHeight}px`;

    const hasText = userInput.value.trim().length > 0;
    sendBtn.disabled = !hasText;
    if (hasText) {
      sendBtn.classList.add("active");
    } else {
      sendBtn.classList.remove("active");
    }
  }

  userInput.addEventListener("input", adjustTextareaHeight);

  // Send on Enter (Shift+Enter for newline)
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        chatForm.dispatchEvent(new Event("submit"));
      }
    }
  });

  // Helper: Format current time
  function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Helper: Append a message to chat
  function appendMessage(role, text) {
    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    if (role === "assistant") {
      const avatarDiv = document.createElement("div");
      avatarDiv.className = "message-avatar";
      avatarDiv.innerHTML = `<img src="${EVELYN_AVATAR}" alt="Evelyn" />`;
      row.appendChild(avatarDiv);
    }

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text;

    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.textContent = formatTime();

    contentDiv.appendChild(bubble);
    contentDiv.appendChild(timeSpan);
    row.appendChild(contentDiv);

    chatMessages.appendChild(row);
    scrollToBottom();
    return row;
  }

  // Helper: Show Message Loading Indicator (jakobhoeg/message-loading style)
  function showLoadingIndicator() {
    const row = document.createElement("div");
    row.className = "message-row assistant";
    row.id = "active-loading-indicator";

    const avatarDiv = document.createElement("div");
    avatarDiv.className = "message-avatar";
    avatarDiv.innerHTML = `<img src="${EVELYN_AVATAR}" alt="Evelyn" />`;
    row.appendChild(avatarDiv);

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    const bubble = document.createElement("div");
    bubble.className = "message-loading-bubble";
    bubble.innerHTML = `
      <div class="loading-dots">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>
      <span class="loading-text">Evelyn is typing...</span>
    `;

    contentDiv.appendChild(bubble);
    row.appendChild(contentDiv);

    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function removeLoadingIndicator() {
    const indicator = document.getElementById("active-loading-indicator");
    if (indicator) {
      indicator.remove();
    }
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Submit Handler
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;

    // Reset input
    userInput.value = "";
    adjustTextareaHeight();
    userInput.focus();

    // Render user message
    appendMessage("user", message);

    // Show loading indicator
    showLoadingIndicator();
    sendBtn.disabled = true;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: message,
      });

      removeLoadingIndicator();

      if (!response.ok) {
        const errText = await response.text();
        appendMessage(
          "assistant",
          `Ara ara darling, something went wrong on my end... (${errText || "Unable to reach server"}). Let Mommy hold you while you try again~`
        );
        return;
      }

      const answer = await response.text();
      appendMessage("assistant", answer);
    } catch (err) {
      removeLoadingIndicator();
      console.error("Chat error:", err);
      appendMessage(
        "assistant",
        "Oh sweetie, I couldn't connect to the server. Make sure our connection is alive and try again for Mommy, okay? 💕"
      );
    } finally {
      adjustTextareaHeight();
    }
  });

  // Quick Action Buttons
  comfortBtn.addEventListener("click", () => {
    userInput.value = "Mommy, I had a really rough day... Can you comfort me?";
    adjustTextareaHeight();
    userInput.focus();
  });

  headpatBtn.addEventListener("click", () => {
    userInput.value = "Can you give me some warm headpats and praise me, Evelyn?";
    adjustTextareaHeight();
    userInput.focus();
  });

  // Clear / Reset Button
  clearBtn.addEventListener("click", async () => {
    if (!confirm("Do you want to reset our conversation, darling?")) return;

    try {
      const res = await fetch("/api", { method: "DELETE" });
      if (res.ok) {
        chatMessages.innerHTML = "";
        appendMessage(
          "assistant",
          "Ara ara, a fresh start for us darling~ What would you like to talk about now? Mommy's all ears. 💕"
        );
      }
    } catch (err) {
      console.error("Failed to reset:", err);
    }
  });

  // Initial focus
  userInput.focus();
});
