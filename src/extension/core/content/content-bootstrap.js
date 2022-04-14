/*
 * Copyright 2010-2020 Gildas Lormeau
 * contact : gildas.lormeau <at> gmail.com
 * 
 * This file is part of SingleFile.
 *
 *   The code in this file is free software: you can redistribute it and/or 
 *   modify it under the terms of the GNU Affero General Public License 
 *   (GNU AGPL) as published by the Free Software Foundation, either version 3
 *   of the License, or (at your option) any later version.
 * 
 *   The code in this file is distributed in the hope that it will be useful, 
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of 
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero 
 *   General Public License for more details.
 *
 *   As additional permission under GNU AGPL version 3 section 7, you may 
 *   distribute UNMODIFIED VERSIONS OF THIS file without the copy of the GNU 
 *   AGPL normally required by section 4, provided you include this license 
 *   notice and a URL through which recipients can access the Corresponding 
 *   Source.
 */

/* global browser, globalThis, window, document, location, setTimeout, XMLHttpRequest, DOMParser */

const singlefile = globalThis.singlefileBootstrap;

const MAX_CONTENT_SIZE = 32 * (1024 * 1024);

let unloadListenerAdded, options, tabId, tabIndex, autoSaveEnabled, autoSaveTimeout, autoSavingPage, pageAutoSaved, previousLocationHref;
singlefile.pageInfo = {
	updatedResources: {},
	visitDate: new Date()
};
browser.runtime.sendMessage({ method: "bootstrap.init" }).then(message => {
	options = message.options;
	tabId = message.tabId;
	tabIndex = message.tabIndex;
	autoSaveEnabled = message.autoSaveEnabled;
	if (options && options.autoOpenEditor && detectSavedPage(document)) {
		if (document.readyState == "loading") {
			document.addEventListener("DOMContentLoaded", () => openEditor());
		} else {
			openEditor();
		}
	} else {
		if (document.readyState == "loading") {
			document.addEventListener("DOMContentLoaded", refresh);
		} else {
			refresh();
		}
	}
});
browser.runtime.onMessage.addListener(message => {
	if ((autoSaveEnabled && message.method == "content.autosave") ||
		message.method == "content.maybeInit" ||
		message.method == "content.init" ||
		message.method == "content.openEditor" ||
		message.method == "devtools.resourceCommitted") {
		return onMessage(message);
	}
});
document.addEventListener("DOMContentLoaded", init, false);
if (globalThis.window == globalThis.top && location && location.href && (location.href.startsWith("file://") || location.href.startsWith("content://"))) {
	if (document.readyState == "loading") {
		document.addEventListener("DOMContentLoaded", extractFile, false);
	} else {
		extractFile();
	}
}

async function extractFile() {
	if (document.documentElement.dataset.sfz !== undefined) {
		const data = await getContent();
		executeBootstrap(data);
	} else {
		if ((document.body && document.body.childNodes.length == 1 && document.body.childNodes[0].tagName == "PRE" && /<html[^>]* data-sfz[^>]*>/i.test(document.body.childNodes[0].textContent))) {
			const doc = (new DOMParser()).parseFromString(document.body.childNodes[0].textContent, "text/html");
			document.replaceChild(doc.documentElement, document.documentElement);
			document.querySelectorAll("script").forEach(element => {
				const scriptElement = document.createElement("script");
				scriptElement.textContent = element.textContent;
				element.parentElement.replaceChild(scriptElement, element);
			});
			await extractFile();
		}
	}
}

function getContent() {
	return new Promise(resolve => {
		const xhr = new XMLHttpRequest();
		xhr.open("GET", location.href);
		xhr.send();
		xhr.responseType = "arraybuffer";
		xhr.onload = () => resolve(Array.from(new Uint8Array(xhr.response)));
		xhr.onerror = () => {
			let pendingResponseArray = [];
			browser.runtime.onMessage.addListener(message => {
				if (message.method == "singlefile.multipartResponse") {
					fetchResponse(message);
				}
			});
			const errorMessageElement = document.getElementById("sfz-error-message");
			if (errorMessageElement) {
				errorMessageElement.remove();
			}
			browser.runtime.sendMessage({ method: "singlefile.multipartFetch", url: location.href });

			function fetchResponse(message) {
				if (message.error) {
					browser.runtime.onMessage.removeListener(fetchResponse);
				} else {
					if (!pendingResponseArray.length) {
						document.body.appendChild(document.createTextNode("Please wait..."));
					}
					if (message.truncated) {
						pendingResponseArray = pendingResponseArray.concat(message.array);
					} else {
						pendingResponseArray = message.array;
					}
					if (!message.truncated || message.finished) {
						browser.runtime.onMessage.removeListener(fetchResponse);
						resolve(pendingResponseArray);
					}
				}
			}
		};
	});
}

function executeBootstrap(data) {
	const scriptElement = document.createElement("script");
	scriptElement.textContent = "(() => { const bootstrapReady = this.bootstrap([" + (new Uint8Array(data)).toString() + "]); if (bootstrapReady) { bootstrapReady.then(() => document.dispatchEvent(new CustomEvent(\"single-filez-display-infobar\"))); } })()";
	document.body.appendChild(scriptElement);
}

async function onMessage(message) {
	if (autoSaveEnabled && message.method == "content.autosave") {
		initAutoSavePage(message);
		return {};
	}
	if (message.method == "content.maybeInit") {
		init();
		return {};
	}
	if (message.method == "content.init") {
		options = message.options;
		autoSaveEnabled = message.autoSaveEnabled;
		refresh();
		return {};
	}
	if (message.method == "content.openEditor") {
		if (detectSavedPage(document)) {
			openEditor();
		} else {
			refresh();
		}
		return {};
	}
	if (message.method == "devtools.resourceCommitted") {
		singlefile.pageInfo.updatedResources[message.url] = { content: message.content, type: message.type, encoding: message.encoding };
		return {};
	}
}

function init() {
	if (previousLocationHref != location.href && !singlefile.pageInfo.processing) {
		pageAutoSaved = false;
		previousLocationHref = location.href;
		browser.runtime.sendMessage({ method: "tabs.init", savedPageDetected: detectSavedPage(document) }).catch(() => { });
		browser.runtime.sendMessage({ method: "ui.processInit" }).catch(() => { });
	}
}

async function initAutoSavePage(message) {
	options = message.options;
	if (document.readyState != "complete") {
		await new Promise(resolve => globalThis.addEventListener("load", resolve));
	}
	await autoSavePage();
	if (options.autoSaveRepeat) {
		setTimeout(() => {
			if (autoSaveEnabled && !autoSavingPage) {
				pageAutoSaved = false;
				options.autoSaveDelay = 0;
				onMessage(message);
			}
		}, options.autoSaveRepeatDelay * 1000);
	}
}

async function autoSavePage() {
	const helper = singlefile.helper;
	if ((!autoSavingPage || autoSaveTimeout) && !pageAutoSaved) {
		autoSavingPage = true;
		if (options.autoSaveDelay && !autoSaveTimeout) {
			await new Promise(resolve => autoSaveTimeout = setTimeout(resolve, options.autoSaveDelay * 1000));
			await autoSavePage();
		} else {
			const waitForUserScript = window._singleFileZ_waitForUserScript;
			let frames = [];
			let framesSessionId;
			autoSaveTimeout = null;
			if (!options.removeFrames && globalThis.frames && globalThis.frames.length) {
				frames = await singlefile.processors.frameTree.getAsync(options);
			}
			framesSessionId = frames && frames.sessionId;
			if (options.userScriptEnabled && waitForUserScript) {
				await waitForUserScript(helper.ON_BEFORE_CAPTURE_EVENT_NAME);
			}
			const docData = helper.preProcessDoc(document, globalThis, options);
			savePage(docData, frames);
			if (framesSessionId) {
				singlefile.processors.frameTree.cleanup(framesSessionId);
			}
			helper.postProcessDoc(document, docData.markedElements, docData.invalidElements);
			if (options.userScriptEnabled && waitForUserScript) {
				await waitForUserScript(helper.ON_AFTER_CAPTURE_EVENT_NAME);
			}
			pageAutoSaved = true;
			autoSavingPage = false;
		}
	}
}

function refresh() {
	if (autoSaveEnabled && options && (options.autoSaveUnload || options.autoSaveLoadOrUnload || options.autoSaveDiscard || options.autoSaveRemove)) {
		if (!unloadListenerAdded) {
			globalThis.addEventListener("unload", onUnload);
			document.addEventListener("visibilitychange", onVisibilityChange);
			unloadListenerAdded = true;
		}
	} else {
		globalThis.removeEventListener("unload", onUnload);
		document.removeEventListener("visibilitychange", onVisibilityChange);
		unloadListenerAdded = false;
	}
}

function onVisibilityChange() {
	if (document.visibilityState == "hidden" && options.autoSaveDiscard) {
		autoSaveUnloadedPage({ autoSaveDiscard: options.autoSaveDiscard });
	}
}

function onUnload() {
	if (!pageAutoSaved && (options.autoSaveUnload || options.autoSaveLoadOrUnload || options.autoSaveRemove)) {
		autoSaveUnloadedPage({ autoSaveUnload: options.autoSaveUnload, autoSaveRemove: options.autoSaveRemove });
	}
}

function autoSaveUnloadedPage({ autoSaveUnload, autoSaveDiscard, autoSaveRemove }) {
	const helper = singlefile.helper;
	const waitForUserScript = window._singleFile_waitForUserScript;
	let frames = [];
	if (!options.removeFrames && globalThis.frames && globalThis.frames.length) {
		frames = singlefile.processors.frameTree.getSync(options);
	}
	if (options.userScriptEnabled && waitForUserScript) {
		waitForUserScript(helper.ON_BEFORE_CAPTURE_EVENT_NAME);
	}
	const docData = helper.preProcessDoc(document, globalThis, options);
	savePage(docData, frames, { autoSaveUnload, autoSaveDiscard, autoSaveRemove });
}

function savePage(docData, frames, { autoSaveUnload, autoSaveDiscard, autoSaveRemove } = {}) {
	const helper = singlefile.helper;
	const updatedResources = singlefile.pageInfo.updatedResources;
	const visitDate = singlefile.pageInfo.visitDate.getTime();
	Object.keys(updatedResources).forEach(url => updatedResources[url].retrieved = false);
	browser.runtime.sendMessage({
		method: "autosave.save",
		tabId,
		tabIndex,
		taskId: options.taskId,
		content: helper.serialize(document),
		canvases: docData.canvases,
		fonts: docData.fonts,
		stylesheets: docData.stylesheets,
		images: docData.images,
		posters: docData.posters,
		usedFonts: docData.usedFonts,
		shadowRoots: docData.shadowRoots,
		imports: docData.imports,
		referrer: docData.referrer,
		frames: frames,
		url: location.href,
		updatedResources,
		visitDate,
		autoSaveUnload,
		autoSaveDiscard,
		autoSaveRemove
	});
}

async function openEditor() {
	const content = await getContent();
	for (let blockIndex = 0; blockIndex * MAX_CONTENT_SIZE < content.length; blockIndex++) {
		const message = {
			method: "editor.open",
			filename: decodeURIComponent(location.href.match(/^.*\/(.*)$/)[1])
		};
		message.truncated = content.length > MAX_CONTENT_SIZE;
		if (message.truncated) {
			message.finished = (blockIndex + 1) * MAX_CONTENT_SIZE > content.length;
			message.content = content.slice(blockIndex * MAX_CONTENT_SIZE, (blockIndex + 1) * MAX_CONTENT_SIZE);
		} else {
			message.content = content;
		}
		await browser.runtime.sendMessage(message);
	}
}

function detectSavedPage(document) {
	return document.documentElement.dataset.sfz == "";
}