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

/* global browser, singlefile, Blob, URL, document, zip, fetch, XMLHttpRequest, TextEncoder, DOMParser, stop */

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
				zip.workerScriptsPath = "lib/zip/";
				const docTypeMatch = pageData.content.match(/^(<!doctype.*>\s)/gi);
				const docType = docTypeMatch && docTypeMatch.length ? docTypeMatch[0] : "";
				let script = await (await fetch(browser.runtime.getURL("/lib/zip/zip.min.js"))).text();
				script += "(" + (async () => {
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
						let resources = new Map();
						for (const entry of entries) {
							let dataWriter, content, textContent;
							if (entry.filename == "index.html" || entry.filename.startsWith("stylesheet_")) {
								dataWriter = new zip.TextWriter();
								textContent = await new Promise(resolve => entry.getData(dataWriter, resolve));
							} else {
								dataWriter = new zip.BlobWriter("application/octet-stream");
								content = URL.createObjectURL(await new Promise(resolve => entry.getData(dataWriter, resolve)));
							}
							resources.set(entry.filename, { filename: entry.filename, content: content, textContent });
						}
						resources.forEach(resource => {
							if (resource.textContent) {
								if (resource.filename.startsWith("stylesheet_")) {
									resources.forEach(innerResource => {
										resource.textContent = resource.textContent.replace(new RegExp(innerResource.filename, "g"), innerResource.content);
									});
									resource.content = URL.createObjectURL(new Blob([resource.textContent], { type: "text/css" }));
								}
							}
						});
						let docContent = resources.get("index.html").textContent;
						resources.forEach(innerResource => {
							docContent = docContent.replace(new RegExp(innerResource.filename, "g"), innerResource.content);
						});
						const doc = (new DOMParser()).parseFromString(docContent, "text/html");
						doc.querySelectorAll("noscript").forEach(element => element.remove());
						document.replaceChild(document.importNode(doc.documentElement, true), document.documentElement);
					};

					function displayMessage(text) {
						stop();
						Array.from(document.body.childNodes).forEach(node => node.remove());
						document.body.hidden = false;
						document.body.textContent = text;
					}
				}).toString().replace(/\n|\t/g, "") + ")()";
				const blobWriter = new zip.BlobWriter("application/zip");
				await new Promise(resolve => blobWriter.init(resolve));
				await new Promise(resolve => blobWriter.writeUint8Array((new TextEncoder()).encode(docType + "<html><body hidden><script>" + script + "</script><![CDATA["), resolve));
				const zipWriter = await new Promise((resolve, reject) => zip.createWriter(blobWriter, resolve, reject));
				await new Promise(resolve => zipWriter.add("index.html", new zip.BlobReader(new Blob([pageData.content])), resolve));
				for (const resourceType of Object.keys(pageData.resources)) {
					for (const data of pageData.resources[resourceType]) {
						let dataReader;
						if (typeof data.content == "string") {
							dataReader = new zip.TextReader(data.content);
						} else {
							dataReader = new zip.BlobReader(new Blob([new Uint8Array(data.content)]));
						}
						await new Promise(resolve => zipWriter.add(data.name, dataReader, resolve));
					}
				}
				const comment = "]]></body></html>";
				const data = await new Promise(resolve => zipWriter.close(resolve, comment.length));
				message.url = URL.createObjectURL(new Blob([data, comment]));
				try {
					singlefile.extension.ui.bg.main.onEnd(sender.tab.id);
					await downloadPage(message, {
						confirmFilename: message.confirmFilename,
						incognito: sender.tab.incognito,
						filenameConflictAction: message.filenameConflictAction,
						filenameReplacementCharacter: message.filenameReplacementCharacter
					});
				} catch (error) {
					console.error(error); // eslint-disable-line no-console
					singlefile.extension.ui.bg.main.onError(sender.tab.id);
				} finally {
					URL.revokeObjectURL(message.url);
				}
			}
			return {};
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
