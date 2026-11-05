(function findComposer(service, focus) {
	const documents = [document];
	for (const frame of Array.from(document.querySelectorAll("iframe"))) {
		try {
			if (frame.contentDocument) documents.push(frame.contentDocument);
		} catch {}
	};
	const selectors = {
		outlook: [],
		whatsapp: ["#main footer [contenteditable=\"true\"][role=\"textbox\"]", "#main footer [contenteditable=\"true\"]"],
		teams: [
			"[data-tid=\"ckeditor\"][contenteditable=\"true\"]",
			"[data-tid=\"ckeditor\"] [contenteditable=\"true\"]",
			"[role=\"textbox\"][contenteditable=\"true\"][aria-label*=\"message\" i]",
			"[role=\"textbox\"][contenteditable=\"true\"][aria-label*=\"tin nhắn\" i]"
		],
		zoom: [
			".chat-box__chat-textarea[contenteditable=\"true\"]",
			".chat-box__chat-textarea [contenteditable=\"true\"]",
			"textarea.chat-box__chat-textarea",
			"[class*=\"chat-box\"] [contenteditable=\"true\"]",
			"[class*=\"chat-box\"] textarea"
		],
		meet: ["textarea[jsname=\"YPqjbf\"]", "[data-panel-container-id] textarea"],
		zalo: ["#richInput[contenteditable=\"true\"]", "#chat-input-content-id [contenteditable=\"true\"]"],
		// Telegram Web K keeps a hidden twin input (.input-field-input-fake); the visible one is used. A: #editable-message-text.
		telegram: [
			".chat-input .input-message-input[contenteditable=\"true\"]:not(.input-field-input-fake)",
			"#editable-message-text[contenteditable=\"true\"]",
			".input-message-input[contenteditable=\"true\"]:not(.input-field-input-fake)"
		]
	};
	const visible = (element) => {
		const rect = element.getBoundingClientRect();
		const style = (element.ownerDocument.defaultView || window).getComputedStyle(element);
		return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
	};
	for (const page of documents) {
		for (const selector of selectors[service]) {
			const element = Array.from(page.querySelectorAll(selector)).find(visible);
			if (!element) continue;
			if (focus) element.focus();
			const text = element instanceof HTMLTextAreaElement ? element.value : element.innerText || element.textContent || "";
			return {
				found: true,
				text: text.replace(/​/g, "").trim(),
				label: (element.getAttribute("aria-label") || element.getAttribute("placeholder") || "").trim().slice(0, 200)
			};
		}
	};
	return {
		found: false,
		text: "",
		label: ""
	};
})("zalo",false)
