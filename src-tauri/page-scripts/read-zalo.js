(function readVisibleChatPage(service) {
	const visibleWithin = (element, clip) => {
		const rect = element.getBoundingClientRect();
		const style = window.getComputedStyle(element);
		return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0 && rect.bottom > (clip?.top ?? 0) && rect.top < (clip?.bottom ?? window.innerHeight) && rect.right > (clip?.left ?? 0) && rect.left < (clip?.right ?? window.innerWidth);
	};
	const first = (selectors, root = document) => {
		for (const selector of selectors) {
			const found = root.querySelector(selector);
			if (found) return found;
		};
		return null;
	};
	if (service === "zalo") {
		// Zalo Web (checked live 11/2026): each .chat-item is one message row, yours carry .me;
		// the text sits in [data-component="message-text-content"]; quoted replies are skipped.
		const zaloRoot = document.querySelector("#messageViewScroll");
		if (!zaloRoot) return {
			conversationHint: "",
			messages: []
		};
		const zaloClip = (document.querySelector("#messageViewContainer") || zaloRoot).getBoundingClientRect();
		const zaloMessages = [];
		for (const item of Array.from(zaloRoot.querySelectorAll(".chat-item")).filter((element) => visibleWithin(element, zaloClip)).slice(-60)) {
			const parts = Array.from(item.querySelectorAll("[data-component=\"message-text-content\"]")).filter((element) => !element.closest("[class*=\"quote\"]") && visibleWithin(element, zaloClip));
			const text = parts.map((element) => element.innerText || element.textContent || "").join("\n").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n").slice(0, 4e3);
			if (text.length < 2) continue;
			const bubble = item.querySelector("[id^=\"bb_msg_id_\"]");
			const stableId = bubble?.id && bubble.id.length <= 200 ? bubble.id : undefined;
			zaloMessages.push({
				text,
				side: item.classList.contains("me") ? "right" : "left",
				...stableId ? { id: stableId } : {}
			});
		};
		const title = document.querySelector("header#header .header-title");
		return {
			conversationHint: (title?.innerText || title?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200),
			messages: zaloMessages
		};
	};
	if (service === "telegram") {
		// Telegram Web has two clients: K (web.telegram.org/k, .bubble[data-mid] with is-in/is-out) and
		// A (web.telegram.org/a, .Message[data-message-id] with .own). Time stamps, reactions and quoted
		// replies are stripped so only the message text is read.
		const cleanText = (element) => {
			const copy = element.cloneNode(true);
			copy.querySelectorAll(".time, .time-inner, .reactions, .reply, .MessageMeta, .Reactions, .EmbeddedMessage, .message-time, .bubble-name-forwarded, .name").forEach((node) => node.remove());
			return (copy.innerText || copy.textContent || "").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n").slice(0, 4e3);
		};
		const telegramMessages = [];
		// Forum groups keep a second, hidden chat (the topic list) in the DOM: read the active one.
		const activeChat = document.querySelector(".chat.active") || document;
		// A leftover .bubbles-remover container (chat switch animation) is empty: take the one with messages.
		const kRoot = [...activeChat.querySelectorAll(".bubbles .bubbles-inner:not(.bubbles-remover)")].find((inner) => inner.querySelector(".bubble[data-mid]")) || activeChat.querySelector(".bubbles .bubbles-inner:not(.bubbles-remover)") || document.querySelector(".bubbles .bubbles-inner:not(.bubbles-remover)");
		const aRoot = document.querySelector(".MessageList");
		const listRoot = kRoot || aRoot;
		if (!listRoot) return {
			conversationHint: "",
			messages: []
		};
		const listClip = (listRoot.closest(".bubbles, .MessageList") || listRoot).getBoundingClientRect();
		const items = kRoot ? Array.from(kRoot.querySelectorAll(".bubble[data-mid]")).filter((element) => !element.classList.contains("service")) : Array.from(listRoot.querySelectorAll(".Message[data-message-id], .Message[id^=\"message\"]"));
		for (const item of items.filter((element) => visibleWithin(element, listClip)).slice(-60)) {
			const body = kRoot ? item.querySelector(".message") : item.querySelector(".text-content");
			if (!body) continue;
			const text = cleanText(body);
			if (text.length < 2) continue;
			const own = kRoot ? item.classList.contains("is-out") : item.classList.contains("own");
			const stableId = (item.getAttribute("data-mid") || item.getAttribute("data-message-id") || item.id || "").trim();
			telegramMessages.push({
				text,
				side: own ? "right" : "left",
				...stableId && stableId.length <= 200 ? { id: stableId } : {}
			});
		};
		const peer = activeChat.querySelector(".chat-info .peer-title[data-peer-id], .topbar .peer-title[data-peer-id]") || document.querySelector(".chat-info .peer-title[data-peer-id], .topbar .peer-title[data-peer-id]");
		const titleElement = peer || activeChat.querySelector(".chat-info .peer-title") || document.querySelector(".chat-info .peer-title, .MiddleHeader .fullName, .ChatInfo .fullName, .MiddleHeader h3");
		const peerId = peer?.getAttribute("data-peer-id")?.trim() || location.hash.replace(/^#/, "").trim();
		const title = (titleElement?.innerText || titleElement?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200);
		return {
			conversationHint: peerId && peerId.length <= 200 ? `id:${peerId}` : title,
			messages: telegramMessages
		};
	};
	if (service === "zoom" || service === "meet") {
		// The Zoom web client may render the meeting inside a same-origin iframe; Meet renders in the top document.
		const documents = [document];
		for (const frame of Array.from(document.querySelectorAll("iframe"))) {
			try {
				if (frame.contentDocument && visibleWithin(frame)) documents.push(frame.contentDocument);
			} catch {}
		};
		const selfNames = /^(you|me|bạn|tôi)$/i;
		const meetingRoots = service === "zoom" ? [
			".chat-container__chat-list",
			"#chat-list-content",
			".chat-content__chat-scrollbar",
			"[class*=\"chat-list\"]",
			"[aria-label*=\"chat message\" i]",
			".chat-container"
		] : [
			"[jsname=\"xySENc\"][aria-live]",
			"[aria-label*=\"chat message\" i]",
			"[aria-label*=\"in-call message\" i]",
			"[aria-label*=\"tin nhắn\" i]",
			"[data-panel-container-id]"
		];
		const meetingBubbles = service === "zoom" ? [
			"[class*=\"new-chat-message__container\"]",
			".chat-item-container",
			"[class*=\"chat-item__chat-info\"]",
			"[role=\"listitem\"]"
		] : ["[data-message-id]"];
		const meetingContent = service === "zoom" ? [
			"[class*=\"new-chat-message__text-content\"]",
			".chat-rtf-box__display",
			"[class*=\"chat-message__text\"]",
			"[dir=\"auto\"]"
		] : ["[jsname=\"dTKtvb\"]", "[dir=\"auto\"]"];
		const senderSelectors = service === "zoom" ? [
			"[class*=\"chat-item__sender\"]",
			"[class*=\"new-chat-message__sender\"]",
			"[class*=\"chat-item__left\"]"
		] : ["[data-sender-name]", ".poVWob"];
		const messages = [];
		let conversationHint = "";
		for (const page of documents) {
			let meetingRoot = null;
			for (const selector of meetingRoots) {
				meetingRoot = Array.from(page.querySelectorAll(selector)).find((element) => visibleWithin(element) && element.querySelector(meetingBubbles.join(","))) || null;
				if (meetingRoot) break;
			};
			// Meet has no stable panel label in every locale: fall back to the nearest scrollable ancestor of a visible message.
			if (!meetingRoot && service === "meet") meetingRoot = Array.from(page.querySelectorAll("[data-message-id]")).find((element) => visibleWithin(element))?.parentElement?.closest("[role=\"list\"], [aria-live], [jsname]") || null;
			if (!meetingRoot) continue;
			const clipRect = meetingRoot.getBoundingClientRect();
			let items = Array.from(meetingRoot.querySelectorAll(meetingBubbles.join(","))).filter((element) => visibleWithin(element, clipRect));
			items = items.filter((element) => !items.some((other) => other !== element && other.contains(element)));
			let lastSender = "";
			for (const item of items.slice(-60)) {
				let content = [];
				for (const selector of meetingContent) {
					content = Array.from(item.querySelectorAll(selector)).filter((element) => visibleWithin(element, clipRect));
					if (content.length) break;
				};
				content = content.filter((element) => !content.some((other) => other !== element && other.contains(element)));
				const text = (content.length ? content : [item]).map((element) => element.innerText || element.textContent || "").join("\n").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n").slice(0, 4e3);
				if (text.length < 2) continue;
				// Meet groups consecutive messages under one sender heading; Zoom repeats the sender per message.
				const group = item.closest("[data-sender-id], [data-sender-name]") || item.parentElement?.parentElement || item;
				const senderElement = senderSelectors.map((selector) => item.querySelector(selector) || group.querySelector(selector)).find(Boolean);
				const sender = (senderElement?.getAttribute("data-sender-name") || senderElement?.textContent || lastSender).replace(/\s+/g, " ").trim().replace(/\s*\(.*\)$/, "").replace(/^(from|từ)\s+/i, "").replace(/\s+(to|đến)\s+.*$/i, "");
				lastSender = sender;
				const className = typeof item.className === "string" ? item.className : "";
				// Meet (checked in a live call, 11/2026): a group heading [.HNucUd] holds only the time for your own
				// messages and the sender name plus time for other people's.
				const meetGroup = service === "meet" ? item.closest("[jsname=\"Ypafjf\"]") : null;
				const meetHeading = meetGroup?.querySelector(".HNucUd");
				const meetSender = meetHeading ? Array.from(meetHeading.children).filter((child) => !child.matches("[jsname=\"biJjHb\"], .MuzmKe")).map((child) => child.textContent?.trim() || "").find(Boolean) || "" : undefined;
				const side = meetSender !== undefined ? meetSender && !selfNames.test(meetSender) ? "left" : "right" : /--self|is-me|my-message/i.test(className) || selfNames.test(sender) ? "right" : sender ? "left" : "center";
				const stableId = [
					item.getAttribute("data-message-id"),
					item.getAttribute("data-id"),
					item.id
				].map((value) => value?.trim() || "").find((value) => value.length >= 1 && value.length <= 200);
				messages.push({
					text,
					side,
					...stableId ? { id: stableId } : {}
				});
			};
			conversationHint = `${service}:${page.location?.pathname || ""}`;
			if (messages.length) break;
		};
		return {
			conversationHint,
			messages
		};
	};
	const root = service === "whatsapp" ? first([
		"#main [data-testid=\"conversation-panel-messages\"]",
		"#main [aria-label*=\"message list\" i]",
		"#main"
	]) : first([
		"[data-tid=\"message-pane-list-viewport\"]",
		"[data-tid=\"message-pane-body\"]",
		"[data-tid=\"chat-pane-messageList\"]",
		"[data-tid=\"chat-pane-message-list\"]",
		"[role=\"log\"]",
		"[data-tid=\"chat-pane\"]"
	]);
	if (!root) return {
		conversationHint: "",
		messages: []
	};
	const clip = root instanceof Element ? root.getBoundingClientRect() : undefined;
	const bubbleSelectors = service === "whatsapp" ? [
		"[data-pre-plain-text]",
		"[data-id].message-in, [data-id].message-out",
		"[data-testid*=\"msg-container\"]"
	] : [
		"[data-tid=\"chat-pane-message\"]",
		"[data-tid=\"message\"]",
		"[data-message-id]",
		"[role=\"listitem\"]"
	];
	let bubbles = Array.from(root.querySelectorAll(bubbleSelectors.join(","))).filter((element) => visibleWithin(element, clip));
	// Keep outer message bubbles only; nested Teams content containers can match the same selectors.
	bubbles = bubbles.filter((element) => !bubbles.some((other) => other !== element && other.contains(element)));
	const contentSelectors = service === "whatsapp" ? [".selectable-text", "[dir=\"auto\"]"] : [
		"[data-tid=\"messageBodyContent\"]",
		"[data-tid=\"message-body\"]",
		"[data-tid*=\"messageBody\"]",
		".message-body-content",
		"[dir=\"auto\"]"
	];
	const messages = [];
	const seen = new Set();
	for (const bubble of bubbles.slice(-60)) {
		let content = [];
		for (const selector of contentSelectors) {
			content = Array.from(bubble.querySelectorAll(selector)).filter((element) => visibleWithin(element, clip));
			if (content.length) break;
		};
		// Use deepest text-bearing nodes to avoid repeating parent and child text.
		content = content.filter((element) => !content.some((other) => other !== element && other.contains(element)));
		const text = (content.length ? content : [bubble]).map((element) => element.innerText || element.textContent || "").join("\n").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n").slice(0, 4e3);
		if (text.length < 2) continue;
		const rect = bubble.getBoundingClientRect();
		const key = `${Math.round(rect.left / 8)}:${Math.round(rect.top / 8)}:${text}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const className = typeof bubble.className === "string" ? bubble.className : "";
		let side = /message-out|message-self|own-message/i.test(className) || bubble.closest(".message-out") ? "right" : /message-in|message-other/i.test(className) || bubble.closest(".message-in") ? "left" : "center";
		// WhatsApp Web (11/2026) no longer marks direction in classes or data-id; your messages hug the right edge.
		if (side === "center" && service === "whatsapp" && clip) {
			const leftGap = rect.left - clip.left;
			const rightGap = clip.right - rect.right;
			if (rightGap + 40 < leftGap) side = "right";
			else if (leftGap + 40 < rightGap) side = "left";
		};
		const stableId = [
			bubble.getAttribute("data-id"),
			bubble.getAttribute("data-message-id"),
			bubble.id
		].map((value) => value?.trim() || "").find((value) => value.length >= 1 && value.length <= 200);
		messages.push({
			text,
			side,
			...stableId ? { id: stableId } : {}
		});
	};
	const header = service === "whatsapp" ? first(["#main header", "#main [data-testid=\"conversation-info-header\"]"]) : first([
		"[data-tid=\"chat-pane-header\"]",
		"main header",
		"[role=\"main\"] header"
	]);
	const headerElement = header;
	const stableConversationId = [
		"data-conversation-id",
		"data-chat-id",
		"data-thread-id",
		"data-id"
	].map((name) => header?.getAttribute(name)?.trim() || "").find((value) => value.length >= 1 && value.length <= 200);
	const stableConversationLabel = [header?.getAttribute("aria-label"), header?.getAttribute("title")].map((value) => value?.trim() || "").find((value) => value.length >= 1 && value.length <= 200);
	const browserHeaderLine = headerElement?.innerText?.split("\n").map((line) => line.trim()).find(Boolean);
	const primaryHeaderLine = (browserHeaderLine || header?.firstElementChild?.textContent || header?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200);
	const conversationHint = stableConversationId ? `id:${stableConversationId}` : stableConversationLabel ? `label:${stableConversationLabel}` : primaryHeaderLine;
	return {
		conversationHint,
		messages
	};
})("zalo")
