(function readWebCaptions() {
	const visible = (element) => {
		const r = element.getBoundingClientRect(), s = getComputedStyle(element);
		return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && s.display !== "none" && s.visibility !== "hidden";
	};
	const captionLike = /(caption|subtitle|transcript)/i;
	const chatLike = /(chat|message-list|participants)/i;
	const markers = [...document.querySelectorAll("[aria-label],[class]")].filter(visible).filter((element) => captionLike.test(element.getAttribute("aria-label") || "") || captionLike.test(String(element.getAttribute("class") || ""))).map((element) => (element.getAttribute("aria-label") || String(element.getAttribute("class") || "")).slice(0, 80));
	const diagnostics = {
		captionMarkers: [...new Set(markers)].slice(0, 40),
		iframeCount: document.querySelectorAll("iframe").length
	};
	const root = [...document.querySelectorAll("[aria-live],[aria-label],[class]")].filter((element) => visible(element) && captionLike.test(element.getAttribute("aria-label") || String(element.getAttribute("class") || "")) && !chatLike.test(element.getAttribute("aria-label") || String(element.getAttribute("class") || "")) && (element.textContent || "").trim().length > 0).pop();
	if (!root) return {
		session: null,
		segments: [],
		diagnostics
	};
	const scope = window;
	if (scope.__linguaWebCaptions?.root !== root) scope.__linguaWebCaptions = {
		root,
		session: crypto.randomUUID(),
		ids: new WeakMap(),
		next: 0
	};
	const state = scope.__linguaWebCaptions;
	const rows = [...root.children].filter((child) => visible(child) && (child.textContent || "").trim().length > 0);
	const candidates = rows.length ? rows : [root];
	const segments = candidates.slice(-30).flatMap((row) => {
		const text = (row.textContent || "").replace(/\s+/g, " ").trim().slice(0, 4e3);
		if (!text) return [];
		if (!state.ids.has(row)) state.ids.set(row, String(++state.next));
		return [{
			id: state.ids.get(row),
			text,
			speaker: "",
			timestamp: Date.now()
		}];
	});
	return {
		session: state.session,
		segments,
		diagnostics
	};
})()
