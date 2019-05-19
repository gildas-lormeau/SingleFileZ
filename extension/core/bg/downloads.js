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

/* global browser, singlefile, Blob, URL, document, zip, fetch, XMLHttpRequest, TextEncoder, DOMParser, FileReader, stop */

singlefile.extension.core.bg.downloads = (() => {

	const partialContents = new Map();
	const STATE_DOWNLOAD_COMPLETE = "complete";
	const STATE_DOWNLOAD_INTERRUPTED = "interrupted";
	const STATE_ERROR_CANCELED_CHROMIUM = "USER_CANCELED";
	const ERROR_DOWNLOAD_CANCELED_GECKO = "canceled";
	const ERROR_CONFLICT_ACTION_GECKO = "conflictaction prompt not yet implemented";
	const ERROR_INCOGNITO_GECKO = "'incognito'";
	const ERROR_INCOGNITO_GECKO_ALT = "\"incognito\"";
	const ERROR_INVALID_FILENAME_GECKO = "illegal characters";
	const ERROR_INVALID_FILENAME_CHROMIUM = "invalid filename";

	return {
		onMessage,
		download,
		downloadPage
	};

	async function onMessage(message, sender) {
		if (message.method.endsWith(".download")) {
			let contents;
			if (message.truncated) {
				contents = partialContents.get(sender.tab.id);
				if (!contents) {
					contents = [];
					partialContents.set(sender.tab.id, contents);
				}
				contents.push(message.content);
				if (message.finished) {
					partialContents.delete(sender.tab.id);
				}
			} else if (message.content) {
				contents = [message.content];
			}
			if (!message.truncated || message.finished) {
				const pageData = JSON.parse(contents.join());
				savePage(message, pageData, sender.tab);
			}
			return {};
		}
	}

	async function savePage(message, pageData, tab) {
		zip.workerScriptsPath = "lib/zip/";
		const docTypeMatch = pageData.content.match(/^(<!doctype.*>\s)/gi);
		const docType = docTypeMatch && docTypeMatch.length ? docTypeMatch[0] : "";
		let script = await (await fetch(browser.runtime.getURL("/lib/zip/zip.min.js"))).text();
		script += "(" + bootstrap.toString().replace(/\n|\t/g, "") + ")()";
		const blobWriter = new zip.BlobWriter("application/zip");
		await new Promise(resolve => blobWriter.init(resolve));
		await new Promise(resolve => blobWriter.writeUint8Array((new TextEncoder()).encode(docType + "<html><body hidden><script>" + script + "</script><![CDATA["), resolve));
		const zipWriter = await new Promise((resolve, reject) => zip.createWriter(blobWriter, resolve, reject));
		await addPageResources(zipWriter, pageData);
		const comment = "]]></body></html>";
		const data = await new Promise(resolve => zipWriter.close(resolve, comment.length));
		message.url = URL.createObjectURL(new Blob([data, comment]));
		try {
			singlefile.extension.ui.bg.main.onEnd(tab.id);
			await downloadPage(message, {
				confirmFilename: message.confirmFilename,
				incognito: tab.incognito,
				filenameConflictAction: message.filenameConflictAction,
				filenameReplacementCharacter: message.filenameReplacementCharacter
			});
		} catch (error) {
			console.error(error); // eslint-disable-line no-console
			singlefile.extension.ui.bg.main.onError(tab.id);
		} finally {
			URL.revokeObjectURL(message.url);
		}
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
					await new Promise(resolve => zipWriter.add(prefixName + data.name, dataReader, resolve));
				}
			}
		}
	}

	async function bootstrap() {
		zip.useWebWorkers = false;
		const xhr = new XMLHttpRequest();
		xhr.responseType = "blob";
		xhr.open("GET", "");
		xhr.onerror = () => {
			displayMessage("Error: cannot read the zip file. If you are using a chromium-based browser, it must be started with the switch '--allow-file-access-from-files'.");
		};
		xhr.send();
		xhr.onload = async () => {
			displayMessage("Please wait...");
			const zipReader = await new Promise((resolve, reject) => zip.createReader(new zip.BlobReader(xhr.response), resolve, reject));
			const entries = await new Promise(resolve => zipReader.getEntries(resolve));
			let resources = [];
			for (const entry of entries) {
				let dataWriter, content, textContent;
				if (entry.filename.match(/index.html$/) || entry.filename.match(/stylesheet_\n+/)) {
					dataWriter = new zip.TextWriter();
					textContent = await new Promise(resolve => entry.getData(dataWriter, resolve));
				} else {
					if (entry.filename.match(/.svg$/)) {
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
				resources.push({ filename: entry.filename, content: content, textContent });
			}
			resources = resources.sort((resourceLeft, resourceRight) => resourceRight.filename.length - resourceLeft.filename.length);
			let docContent;
			resources.forEach(resource => {
				if (resource.textContent) {
					if (resource.filename.match(/index.html$/) || resource.filename.match(/stylesheet_\n+/)) {
						let prefixPath = "";
						const prefixPathMatch = resource.filename.match(/(.*\/)[^/]+$/);
						if (prefixPathMatch && prefixPathMatch[1]) {
							prefixPath = prefixPathMatch[1];
						}
						resources.forEach(innerResource => {
							if (innerResource.filename.startsWith(prefixPath) && innerResource.filename != resource.filename) {
								const filename = innerResource.filename.substring(prefixPath.length);
								if (filename != resource.filename) {
									resource.textContent = resource.textContent.replace(new RegExp(filename, "g"), innerResource.content);
								}
							}
						});
						if (resource.filename.match(/stylesheet_\n+/)) {
							resource.content = URL.createObjectURL(new Blob([resource.textContent], { type: "text/css" }));
						} else {
							resource.content = URL.createObjectURL(new Blob([resource.textContent], { type: "text/html" }));
						}
						if (resource.filename == "index.html") {
							docContent = resource.textContent;
						}
					}
				}
			});
			const doc = (new DOMParser()).parseFromString(docContent, "text/html");
			doc.querySelectorAll("noscript").forEach(element => element.remove());
			document.replaceChild(document.importNode(doc.documentElement, true), document.documentElement);
			document.querySelectorAll("script").forEach(element => {
				element.remove();
				const scriptElement = document.createElement("script");
				scriptElement.textContent = element.textContent;
				document.body.appendChild(scriptElement);
			});
		};

		function displayMessage(text) {
			stop();
			Array.from(document.body.childNodes).forEach(node => node.remove());
			document.body.hidden = false;
			document.body.textContent = text;
		}
	}

	async function downloadPage(page, options) {
		const downloadInfo = {
			url: page.url,
			saveAs: options.confirmFilename,
			filename: page.filename,
			conflictAction: options.filenameConflictAction
		};
		if (options.incognito) {
			downloadInfo.incognito = true;
		}
		await download(downloadInfo, options.filenameReplacementCharacter);
	}

	async function download(downloadInfo, replacementCharacter) {
		let downloadId;
		try {
			downloadId = await browser.downloads.download(downloadInfo);
		} catch (error) {
			if (error.message) {
				const errorMessage = error.message.toLowerCase();
				const invalidFilename = errorMessage.includes(ERROR_INVALID_FILENAME_GECKO) || errorMessage.includes(ERROR_INVALID_FILENAME_CHROMIUM);
				if (invalidFilename && downloadInfo.filename.startsWith(".")) {
					downloadInfo.filename = replacementCharacter + downloadInfo.filename;
					return download(downloadInfo, replacementCharacter);
				} else if (invalidFilename && downloadInfo.filename.includes(",")) {
					downloadInfo.filename = downloadInfo.filename.replace(/,/g, replacementCharacter);
					return download(downloadInfo, replacementCharacter);
				} else if (invalidFilename && !downloadInfo.filename.match(/^[\x00-\x7F]+$/)) { // eslint-disable-line  no-control-regex
					downloadInfo.filename = downloadInfo.filename.replace(/[^\x00-\x7F]+/g, replacementCharacter); // eslint-disable-line  no-control-regex
					return download(downloadInfo, replacementCharacter);
				} else if ((errorMessage.includes(ERROR_INCOGNITO_GECKO) || errorMessage.includes(ERROR_INCOGNITO_GECKO_ALT)) && downloadInfo.incognito) {
					delete downloadInfo.incognito;
					return download(downloadInfo, replacementCharacter);
				} else if (errorMessage == ERROR_CONFLICT_ACTION_GECKO && downloadInfo.conflictAction) {
					delete downloadInfo.conflictAction;
					return download(downloadInfo, replacementCharacter);
				} else if (errorMessage.includes(ERROR_DOWNLOAD_CANCELED_GECKO)) {
					return {};
				} else {
					throw error;
				}
			} else {
				throw error;
			}
		}
		return new Promise((resolve, reject) => {
			browser.downloads.onChanged.addListener(onChanged);

			function onChanged(event) {
				if (event.id == downloadId && event.state) {
					if (event.state.current == STATE_DOWNLOAD_COMPLETE) {
						resolve({});
						browser.downloads.onChanged.removeListener(onChanged);
					}
					if (event.state.current == STATE_DOWNLOAD_INTERRUPTED) {
						if (event.error && event.error.current == STATE_ERROR_CANCELED_CHROMIUM) {
							resolve({});
						} else {
							reject(new Error(event.state.current));
						}
						browser.downloads.onChanged.removeListener(onChanged);
					}
				}
			}
		});
	}

})();
