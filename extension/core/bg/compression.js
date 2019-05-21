/*
 * Copyright 2010-2019 Gildas Lormeau
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

/* global browser, singlefile, Blob, URL, document, zip, fetch, XMLHttpRequest, TextEncoder, DOMParser, FileReader, stop, setTimeout, clearTimeout, CustomEvent */

singlefile.extension.core.bg.compression = (() => {

	const NO_COMPRESSION_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf", ".woff2", ".mp4", ".mp3", ".ogg"];

	return {
		compressPage
	};

	async function compressPage(pageData) {
		zip.workerScriptsPath = "lib/zip/";
		const docTypeMatch = pageData.content.match(/^(<!doctype.*>\s)/gi);
		const docType = docTypeMatch && docTypeMatch.length ? docTypeMatch[0] : "";
		let script = await (await fetch(browser.runtime.getURL("/lib/zip/zip.min.js"))).text();
		script += "(" + bootstrapCode.toString().replace(/\n|\t/g, "") + ")()";
		const blobWriter = new zip.BlobWriter("application/zip");
		await new Promise(resolve => blobWriter.init(resolve));
		await new Promise(resolve => blobWriter.writeUint8Array((new TextEncoder()).encode(docType + "<html><body hidden><script>" + script + "</script><![CDATA["), resolve));
		const zipWriter = await new Promise((resolve, reject) => zip.createWriter(blobWriter, resolve, reject));
		await addPageResources(zipWriter, pageData);
		const comment = "]]></body></html>";
		return new Promise(resolve => zipWriter.close(data => resolve(new Blob([data, comment])), comment.length));
	}

	async function addPageResources(zipWriter, pageData, prefixName = "") {
		await new Promise(resolve => zipWriter.add(prefixName + "index.html", new zip.BlobReader(new Blob([pageData.content])), resolve));
		for (const resourceType of Object.keys(pageData.resources)) {
			for (const data of pageData.resources[resourceType]) {
				if (resourceType == "frames") {
					await addPageResources(zipWriter, data, prefixName + data.name);
				} else {
					let dataReader;
					if (typeof data.content == "string") {
						dataReader = new zip.TextReader(data.content);
					} else {
						dataReader = new zip.BlobReader(new Blob([new Uint8Array(data.content)]));
					}
					const options = {};
					if (NO_COMPRESSION_EXTENSIONS.includes(data.extension)) {
						options.level = 0;
					}
					await new Promise(resolve => zipWriter.add(prefixName + data.name, dataReader, resolve, null, options));
				}
			}
		}
	}

	function bootstrapCode() {
		stop();
		zip.useWebWorkers = false;
		const xhr = new XMLHttpRequest();
		xhr.responseType = "blob";
		xhr.open("GET", "");
		xhr.onerror = () => {
			displayMessage("Error: cannot read the zip file. If you are using a chromium-based browser and trying to read the page from the filesystem, it must be started with the switch '--allow-file-access-from-files'.");
		};
		xhr.send();
		xhr.onload = async () => {
			const displayTimeout = displayMessage("Please wait...", true);
			const zipReader = await new Promise((resolve, reject) => zip.createReader(new zip.BlobReader(xhr.response), resolve, reject));
			const entries = await new Promise(resolve => zipReader.getEntries(resolve));
			let resources = [];
			for (const entry of entries) {
				let dataWriter, content, textContent;
				if (entry.filename.match(/index\.html$/) || entry.filename.match(/stylesheet_[0-9]+\.css/) || entry.filename.match(/scripts\/[0-9]+\.js/)) {
					dataWriter = new zip.TextWriter();
					textContent = await new Promise(resolve => entry.getData(dataWriter, resolve));
				} else {
					if (entry.filename.match(/\.svg$/)) {
						const blob = await new Promise(resolve => entry.getData(new zip.BlobWriter("image/svg+xml"), resolve));
						const reader = new FileReader();
						reader.readAsDataURL(blob);
						content = await new Promise((resolve, reject) => {
							reader.addEventListener("load", () => resolve(reader.result), false);
							reader.addEventListener("error", reject, false);
						});
					} else {
						const blob = await new Promise(resolve => entry.getData(new zip.BlobWriter("application/octet-stream"), resolve));
						content = URL.createObjectURL(blob);
					}
				}
				resources.push({ filename: entry.filename, content, textContent });
			}
			resources = resources.sort((resourceLeft, resourceRight) => resourceRight.filename.length - resourceLeft.filename.length);
			let docContent;
			resources.forEach(resource => {
				if (resource.textContent) {
					let prefixPath = "";
					const prefixPathMatch = resource.filename.match(/(.*\/)[^/]+$/);
					if (prefixPathMatch && prefixPathMatch[1]) {
						prefixPath = prefixPathMatch[1];
					}
					const isScript = resource.filename.match(/scripts\/[0-9]+\.js/);
					if (!isScript) {
						resources.forEach(innerResource => {
							if (innerResource.filename.startsWith(prefixPath) && innerResource.filename != resource.filename) {
								const filename = innerResource.filename.substring(prefixPath.length);
								if (filename != resource.filename) {
									resource.textContent = resource.textContent.replace(new RegExp(filename, "g"), innerResource.content);
								}
							}
						});
					}
					let mimeType;
					if (resource.filename.match(/stylesheet_[0-9]+\.css/)) {
						mimeType = "text/css";
					} else if (isScript) {
						mimeType = "text/javascript";
					} else if (resource.filename.match(/index\.html$/)) {
						mimeType = "text/html";
					}
					resource.content = URL.createObjectURL(new Blob([resource.textContent], { type: mimeType + ";charset=utf-8" }));
					if (resource.filename == "index.html") {
						docContent = resource.textContent;
					}
				}
			});
			const doc = (new DOMParser()).parseFromString(docContent, "text/html");
			doc.querySelectorAll("noscript").forEach(element => element.remove());
			clearTimeout(displayTimeout);
			document.replaceChild(document.importNode(doc.documentElement, true), document.documentElement);
			document.dispatchEvent(new CustomEvent("single-file-display-infobar"));
			document.querySelectorAll("script").forEach(element => {
				const parentElement = element.parentElement;
				element.remove();
				const scriptElement = document.createElement("script");
				if (element.getAttribute("type")) {
					scriptElement.type = element.type;
				}
				if (element.getAttribute("src")) {
					scriptElement.src = element.src;
				}
				if (element.textContent) {
					scriptElement.textContent = element.textContent;
				}
				parentElement.appendChild(scriptElement);
			});
		};

		function displayMessage(text, deferred) {
			Array.from(document.body.childNodes).forEach(node => node.remove());
			document.body.hidden = false;
			if (deferred) {
				return setTimeout(() => document.body.textContent = text, 500);
			} else {
				document.body.textContent = text;
			}
		}
	}


})();
