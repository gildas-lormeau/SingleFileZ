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

/* global globalThis, Blob, document, fetch, XMLHttpRequest, TextEncoder, DOMParser, stop, setTimeout, clearTimeout */

import {
	configure,
	BlobReader,
	BlobWriter,
	TextReader,
	ZipWriter
} from "./../../vendor/zip/zip.js";
import {
	extract
} from "./compression-extract.js";
import {
	display
} from "./compression-display.js";

const NO_COMPRESSION_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf", ".woff2", ".mp4", ".mp3", ".ogg", ".webp", ".webm"];
const SCRIPT_PATH = "src/single-file/vendor/zip/zip.min.js";

const browser = globalThis.browser;

export {
	process
};

async function process(pageData, options) {
	let script;
	if (browser && browser.runtime && browser.runtime.getURL) {
		configure({ workerScripts: { deflate: ["/src/single-file/vendor/zip/z-worker.js"] } });
		script = await (await fetch(browser.runtime.getURL(SCRIPT_PATH))).text();
	} else {
		configure({ useWebWorkers: false });
		script = options.getFileContent(SCRIPT_PATH);
	}
	script += "globalThis.bootstrap=(()=>{let bootstrapStarted;return async content=>{if (bootstrapStarted) return bootstrapStarted;bootstrapStarted = (" +
		extract.toString().replace(/\n|\t/g, "") + ")(content,{prompt}).then(({docContent}) => " +
		display.toString().replace(/\n|\t/g, "") + "(document,docContent));return bootstrapStarted;}})();(" +
		getContent.toString().replace(/\n|\t/g, "") + ")().then(globalThis.bootstrap).catch(()=>{});";
	const blobWriter = new BlobWriter("application/octet-stream");
	await blobWriter.init();
	if (options.selfExtractingArchive) {
		let pageContent = "";
		if (options.includeBOM) {
			pageContent += "\ufeff";
		}
		pageContent += pageData.doctype + "<html data-sfz><meta charset='utf-8'><title>" + (pageData.title.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "") + "</title>";
		if (options.insertCanonicalLink) {
			pageContent += "<link rel=canonical href=\"" + options.url + "\">";
		}
		if (options.insertMetaNoIndex) {
			pageContent += "<meta name=robots content=noindex>";
		}
		if (pageData.viewport) {
			pageContent += "<meta name=\"viewport\" content=" + JSON.stringify(pageData.viewport) + ">";
		}
		pageContent += "<body hidden>";
		pageContent += "<div id='sfz-wait-message'>Please wait...</div>";
		pageContent += "<div id='sfz-error-message'><strong>Error</strong>: Cannot open the page from the filesystem.";
		pageContent += "<ul style='line-height:20px;'>";
		pageContent += "<li style='margin-bottom:10px'><strong>Chrome</strong>: Install <a href='https://chrome.google.com/webstore/detail/singlefilez/offkdfbbigofcgdokjemgjpdockaafjg'>SingleFileZ</a> and enable the option \"Allow access to file URLs\" in the details page of the extension (chrome://extensions/?id=offkdfbbigofcgdokjemgjpdockaafjg).</li>";
		pageContent += "<li style='margin-bottom:10px'><strong>Microsoft Edge</strong>: Install <a href='https://microsoftedge.microsoft.com/addons/detail/singlefilez/gofneaifncimeglaecpnanbnmnpfjekk'>SingleFileZ</a> and enable the option \"Allow access to file URLs\" in the details page of the extension (edge://extensions/?id=gofneaifncimeglaecpnanbnmnpfjekk).</li>";
		pageContent += "<li><strong>Safari</strong>: Select \"Disable Local File Restrictions\" in the \"Develop\" menu.</li></ul></div>";
		pageContent += "<script>" + script + "</script>";
		if (options.insertTextBody) {
			const doc = (new DOMParser()).parseFromString(pageData.content, "text/html");
			doc.body.querySelectorAll("style, script, noscript").forEach(element => element.remove());
			pageContent += "\n<main hidden>\n" + doc.body.innerText.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim() + "\n</main>\n";
		}
		pageContent += "</body><xmp><![CDATA[";
		await blobWriter.writeUint8Array((new TextEncoder()).encode(pageContent));
	}
	const zipWriter = new ZipWriter(blobWriter);
	pageData.url = options.url;
	pageData.archiveTime = (new Date()).toISOString();
	await addPageResources(zipWriter, pageData, { password: options.password }, options.createRootDirectory ? String(Date.now()) + "_" + (options.tabId || 0) + "/" : "", options.url);
	const comment = (new TextEncoder()).encode("]]></xmp></html>");
	const data = await zipWriter.close(comment);
	return data;
}

async function addPageResources(zipWriter, pageData, options, prefixName, url) {
	const resources = {};
	for (const resourceType of Object.keys(pageData.resources)) {
		for (const data of pageData.resources[resourceType]) {
			data.password = options.password;
			if (data.url && !data.url.startsWith("data:")) {
				resources[data.name] = data.url;
			}
		}
	}
	const jsonContent = JSON.stringify({
		originalUrl: pageData.url,
		title: pageData.title,
		archiveTime: pageData.archiveTime,
		indexFilename: "index.html",
		resources
	}, null, 2);
	await Promise.all([
		Promise.all([
			addFile(zipWriter, prefixName, { name: "index.html", extension: ".html", content: pageData.content, url, password: options.password }),
			addFile(zipWriter, prefixName, { name: "index.json", extension: ".json", content: jsonContent, password: options.password })
		]),
		Promise.all(Object.keys(pageData.resources).map(async resourceType =>
			Promise.all(pageData.resources[resourceType].map(data => {
				if (resourceType == "frames") {
					return addPageResources(zipWriter, data, options, prefixName + data.name, data.url);
				} else {
					return addFile(zipWriter, prefixName, data, true);
				}
			}))
		))
	]);
}

async function addFile(zipWriter, prefixName, data) {
	const dataReader = typeof data.content == "string" ? new TextReader(data.content) : new BlobReader(new Blob([new Uint8Array(data.content)]));
	const options = { comment: data.url && data.url.startsWith("data:") ? "data:" : data.url, password: data.password, bufferedWrite: true };
	if (NO_COMPRESSION_EXTENSIONS.includes(data.extension)) {
		options.level = 0;
	}
	await zipWriter.add(prefixName + data.name, dataReader, options);
}

async function getContent() {
	const xhr = new XMLHttpRequest();
	let displayTimeout;
	Array.from(document.documentElement.childNodes).forEach(node => {
		if (node != document.body && node != document.head) {
			node.remove();
		}
	});
	xhr.responseType = "blob";
	xhr.open("GET", "");
	return new Promise((resolve, reject) => {
		xhr.onerror = () => {
			displayTimeout = displayMessage("sfz-error-message");
			reject();
		};
		xhr.send();
		xhr.onload = () => {
			displayTimeout = displayMessage("sfz-wait-message");
			stop();
			if (displayTimeout) {
				clearTimeout(displayTimeout);
			}
			resolve(xhr.response);
		};
	});

	function displayMessage(elementId) {
		return setTimeout(() => {
			if (document.getElementById(elementId)) {
				Array.from(document.body.childNodes).forEach(node => {
					if (node.id != elementId) {
						node.remove();
					}
				});
				document.body.hidden = false;
			}
		}, 1500);
	}
}
