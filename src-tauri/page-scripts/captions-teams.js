(function readMeetingCaptions() {
	const visible = (element) => {
		const r = element.getBoundingClientRect(), s = getComputedStyle(element);
		return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && s.display !== "none" && s.visibility !== "hidden";
	};
	const diagnostics = {
		captionMarkers: [...new Set([...document.querySelectorAll("[data-tid], [data-testid]")].filter(visible).flatMap((element) => [element.getAttribute("data-tid"), element.getAttribute("data-testid")]).filter((value) => !!value && /^(closed[-_]?caption|caption)[a-z0-9_-]{0,90}$/i.test(value)))].slice(0, 40),
		iframeCount: document.querySelectorAll("iframe").length
	};
	const root = [...document.querySelectorAll("[data-tid=\"closed-caption-container\"], [data-tid=\"closed-captions-renderer\"], [data-tid=\"closed-captions-container\"], [data-tid=\"closed-caption-v2-container\"], [data-tid=\"closed-caption-v2-window-wrapper\"], [data-tid=\"closed-caption-v2-renderer\"], [data-tid=\"closed-caption-renderer-wrapper\"], [data-tid=\"closed-captions-v2-items-renderer\"]")].find(visible);
	if (!root) return {
		session: null,
		segments: [],
		diagnostics
	};
	const scope = window;
	if (scope.__linguaMeeting?.root !== root) scope.__linguaMeeting = {
		root,
		session: crypto.randomUUID(),
		ids: new WeakMap(),
		next: 0
	};
	const state = scope.__linguaMeeting;
	const rowSelector = "[data-tid=\"closed-caption-item\"], [data-tid=\"closed-caption-v2-item\"], [data-tid=\"closed-caption-v2-utterance\"], [data-tid=\"closed-caption-utterance\"]";
	const candidates = [...root.querySelectorAll(rowSelector)].filter(visible);
	const rows = candidates.filter((row) => !candidates.some((other) => other !== row && row.contains(other)));
	// Teams side-panel captions can expose only text nodes, without item/utterance markers.
	for (const body of root.querySelectorAll("[data-tid=\"closed-caption-text\"], [data-tid=\"closed-caption-v2-text\"], [data-tid=\"closed-caption-v2-text-content\"]")) {
		if (visible(body) && !rows.some((row) => row === body || row.contains(body))) rows.push(body);
	};
	rows.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
	const segments = rows.slice(-30).flatMap((row) => {
		const bodySelector = "[data-tid=\"closed-caption-text\"], [data-tid=\"closed-caption-v2-text\"], [data-tid=\"closed-caption-v2-text-content\"], [data-tid=\"closed-caption-text-content\"]";
		const body = row.matches(bodySelector) ? row : row.querySelector(bodySelector) || (row.matches("[data-tid=\"closed-caption-v2-utterance\"], [data-tid=\"closed-caption-utterance\"]") ? row : null);
		if (!body || !visible(body)) return [];
		const copy = body.cloneNode(true);
		copy.querySelectorAll("button,[role=\"button\"],[aria-hidden=\"true\"],[data-tid*=\"speaker\"]").forEach((element) => element.remove());
		const text = (copy.textContent || "").replace(/\s+/g, " ").trim().slice(0, 4e3);
		if (!text) return [];
		if (!state.ids.has(row)) state.ids.set(row, String(++state.next));
		const speaker = row.querySelector("[data-tid=\"closed-caption-speaker-name\"], [data-tid=\"closed-caption-v2-speaker-name\"], [data-tid=\"closed-caption-v2-speaker\"]");
		return [{
			id: state.ids.get(row),
			text,
			speaker: speaker && visible(speaker) ? (speaker.textContent || "").trim().slice(0, 100) : "",
			timestamp: Date.now()
		}];
	});
	return {
		session: state.session,
		segments,
		diagnostics
	};
})()
