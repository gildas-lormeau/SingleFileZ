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

/* global browser, singlefile, Blob, document, zip, fetch, XMLHttpRequest, TextEncoder, DOMParser, FileReader, stop, setTimeout, clearTimeout, CustomEvent, URL */

singlefile.extension.core.bg.compression = (() => {

	const NO_COMPRESSION_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf", ".woff2", ".mp4", ".mp3", ".ogg", ".webp", ".webm"];

	return {
		compressPage
	};

	async function compressPage(pageData, options) {
		zip.workerScriptsPath = "extension/lib/zip/";
		let script = await (await fetch(browser.runtime.getURL("extension/lib/zip/zip.min.js"))).text();
		script += "(" + bootstrapCode.toString().replace(/\n|\t/g, "") + ")()";
		const blobWriter = new zip.BlobWriter("application/zip");
		await new Promise(resolve => blobWriter.init(resolve));
		let pageContent = pageData.doctype + "<html data-sfz><meta charset='utf-8'><title>" + (pageData.title || "") + "</title><body hidden>";
		if (pageData.viewport) {
			pageContent += "<meta name=\"viewport\" content=" + JSON.stringify(pageData.viewport) + ">";
		}
		pageContent += "<div id='sfz-wait-message'>Please wait...</div>";
		pageContent += "<div id='sfz-error-message'><strong>Error</strong>: Cannot open the page from the filesystem.";
		pageContent += "<ul style='line-height:20px;'><li style='margin-bottom:10px'><strong>Chrome</strong>: Install <a href='https://chrome.google.com/webstore/detail/singlefilez/offkdfbbigofcgdokjemgjpdockaafjg'>SingleFileZ</a> and enable the option \"Allow access to file URLs\" in the details page of the extension (chrome://extensions/?id=offkdfbbigofcgdokjemgjpdockaafjg). Otherwise, start the browser with the switch \"--allow-file-access-from-files\".</li>";
		pageContent += "<li><strong>Safari</strong>: Select \"Disable Local File Restrictions\" in the \"Develop\" menu.</li></ul></div>";
		pageContent += "<script>" + script + "</script>";
		if (options.insertTextBody) {
			const doc = (new DOMParser()).parseFromString(pageData.content, "text/html");
			doc.body.querySelectorAll("style, script, noscript").forEach(element => element.remove());
			pageContent += "\n<main hidden>\n" + doc.body.innerText.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim() + "\n</main>\n";
		}
		pageContent += "</body><xmp><![CDATA[";
		await new Promise(resolve => blobWriter.writeUint8Array((new TextEncoder()).encode(pageContent), resolve));
		const zipWriter = await new Promise((resolve, reject) => zip.createWriter(blobWriter, resolve, reject));
		pageData.url = options.url;
		pageData.archiveTime = (new Date()).toISOString();
		await addPageResources(zipWriter, pageData, "", options.url);
		const comment = "]]></xmp></html>";
		return new Promise(resolve => zipWriter.close(data => resolve(new Blob([data, comment], { type: "text/html" })), comment.length));
	}

	async function addPageResources(zipWriter, pageData, prefixName, url) {
		await new Promise(resolve => zipWriter.add(prefixName + "index.html", new zip.BlobReader(new Blob([pageData.content], { type: "text/html" })), resolve, null, { comment: url }));
		await new Promise(resolve => zipWriter.add(prefixName + "index.json", new zip.TextReader(JSON.stringify({
			originalUrl: pageData.url,
			title: pageData.title,
			archiveTime: pageData.archiveTime,
			indexFilename: "index.html"
		}, null, 2)), resolve));
		for (const resourceType of Object.keys(pageData.resources)) {
			for (const data of pageData.resources[resourceType]) {
				if (resourceType == "frames") {
					await addPageResources(zipWriter, data, prefixName + data.name, data.url);
				} else {
					let dataReader;
					if (typeof data.content == "string") {
						dataReader = new zip.TextReader(data.content);
					} else {
						dataReader = new zip.BlobReader(new Blob([new Uint8Array(data.content)]));
					}
					const options = { comment: data.url && data.url.startsWith("data:") ? "data:" : data.url };
					if (NO_COMPRESSION_EXTENSIONS.includes(data.extension)) {
						options.level = 0;
					}
					await new Promise(resolve => zipWriter.add(prefixName + data.name, dataReader, resolve, null, options));
				}
			}
		}
	}

	function bootstrapCode() {
		let bootstrapStarted;
		zip.useWebWorkers = false;
		const xhr = new XMLHttpRequest();
		let displayTimeout;
		Array.from(document.documentElement.childNodes).forEach(node => {
			if (node != document.body && node != document.head) {
				node.remove();
			}
		});
		xhr.responseType = "blob";
		xhr.open("GET", "");
		xhr.onerror = () => displayTimeout = displayMessage("sfz-error-message");
		xhr.send();
		xhr.onload = async () => bootstrap(xhr.response);
		this.bootstrap = bootstrap;

		async function bootstrap(content) {
			if (bootstrapStarted) {
				return;
			}
			bootstrapStarted = true;
			stop();
			if (displayTimeout) {
				clearTimeout(displayTimeout);
			}
			displayTimeout = displayMessage("sfz-wait-message");
			if (Array.isArray(content)) {
				content = new Blob([new Uint8Array(content)]);
			}
			const zipReader = await new Promise((resolve, reject) => zip.createReader(new zip.BlobReader(content), resolve, reject));
			const entries = await new Promise(resolve => zipReader.getEntries(resolve));
			let resources = [];
			for (const entry of entries) {
				let dataWriter, content, textContent;
				if (entry.filename.match(/index\.html$/) || entry.filename.match(/stylesheet_[0-9]+\.css/) || entry.filename.match(/scripts\/[0-9]+\.js/)) {
					dataWriter = new zip.TextWriter();
					textContent = await new Promise(resolve => entry.getData(dataWriter, resolve));
				} else {
					const mimeType = entry.filename.match(/\.svg$/) ? "image/svg+xml" : "application/octet-stream";
					if (entry.filename.match(/frames\//)) {
						content = await new Promise(resolve => entry.getData(new zip.Data64URIWriter(mimeType), resolve));
					} else {
						content = URL.createObjectURL(await new Promise(resolve => entry.getData(new zip.BlobWriter(mimeType), resolve)));
					}
				}
				resources.push({ filename: entry.filename, content, textContent });
			}
			resources = resources.sort((resourceLeft, resourceRight) => resourceRight.filename.length - resourceLeft.filename.length);
			let docContent;
			for (const resource of resources) {
				if (resource.textContent !== undefined) {
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
								resource.textContent = resource.textContent.replace(new RegExp(filename, "g"), innerResource.content);
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
					if (resource.filename == "index.html") {
						docContent = resource.textContent;
					} else {
						const reader = new FileReader();
						reader.readAsDataURL(new Blob([resource.textContent], { type: mimeType + ";charset=utf-8" }));
						resource.content = await new Promise((resolve, reject) => {
							reader.addEventListener("load", () => resolve(reader.result), false);
							reader.addEventListener("error", reject, false);
						});
					}
				}
			}
			const DISABLED_NOSCRIPT_ATTRIBUTE_NAME = "data-single-filez-disabled-noscript";
			const doc = (new DOMParser()).parseFromString(docContent, "text/html");
			doc.querySelectorAll("noscript:not([" + DISABLED_NOSCRIPT_ATTRIBUTE_NAME + "])").forEach(element => {
				element.setAttribute(DISABLED_NOSCRIPT_ATTRIBUTE_NAME, element.innerHTML);
				element.textContent = "";
			});
			clearTimeout(displayTimeout);
			document.replaceChild(document.importNode(doc.documentElement, true), document.documentElement);
			document.querySelectorAll("link[rel*=icon]").forEach(element => element.parentElement.replaceChild(element, element));
			document.open = document.write = document.close = () => { };
			for (let element of Array.from(document.querySelectorAll("script"))) {
				await new Promise((resolve, reject) => {
					const scriptElement = document.createElement("script");
					Array.from(element.attributes).forEach(attribute => scriptElement.setAttribute(attribute.name, attribute.value));
					const async = element.getAttribute("async") == "" || element.getAttribute("async") == "async";
					if (element.textContent) {
						scriptElement.textContent = element.textContent;
					} else if (!async) {
						scriptElement.addEventListener("load", resolve);
						scriptElement.addEventListener("error", reject);
					}
					element.parentElement.replaceChild(scriptElement, element);
					if (element.textContent || async) {
						resolve();
					}
				});
			}
			document.dispatchEvent(new CustomEvent("single-file-display-infobar"));
		}

		function displayMessage(elementId) {
			return setTimeout(() => {
				Array.from(document.body.childNodes).forEach(node => {
					if (node.id != elementId) {
						node.remove();
					}
				});
				document.body.hidden = false;
			}, 1500);
		}
	}


})();
