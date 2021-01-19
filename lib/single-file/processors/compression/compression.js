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

/* global singlefile, Blob, document, zip, fetch, XMLHttpRequest, TextEncoder, DOMParser, FileReader, stop, setTimeout, clearTimeout, CustomEvent, URL, prompt, alert */

singlefile.lib.processors.compression = (() => {

	const NO_COMPRESSION_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf", ".woff2", ".mp4", ".mp3", ".ogg", ".webp", ".webm"];
	const SCRIPT_PATH = "lib/single-file/vendor/zip/zip.min.js";

	const browser = this.browser;

	return {
		compressPage
	};

	async function compressPage(pageData, options) {
		let script;
		if (browser && browser.runtime && browser.runtime.getURL) {
			zip.configure({ workerScriptsPath: "lib/single-file/vendor/zip/" });
			script = await (await fetch(browser.runtime.getURL(SCRIPT_PATH))).text();
		} else {
			zip.configure({ useWebWorkers: false });
			script = singlefile.lib.getFileContent(SCRIPT_PATH);
		}
		script += "(" + bootstrapCode.toString().replace(/\n|\t/g, "") + ")()";
		const blobWriter = new zip.BlobWriter("application/zip");
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
			pageContent += "<li style='margin-bottom:10px'><strong>Chrome</strong>: Install <a href='https://chrome.google.com/webstore/detail/singlefilez/offkdfbbigofcgdokjemgjpdockaafjg'>SingleFileZ</a> and enable the option \"Allow access to file URLs\" in the details page of the extension (chrome://extensions/?id=offkdfbbigofcgdokjemgjpdockaafjg). Otherwise, start the browser with the switch \"--allow-file-access-from-files\".</li>";
			pageContent += "<li style='margin-bottom:10px'><strong>Microsoft Edge</strong>: Install <a href='https://microsoftedge.microsoft.com/addons/detail/singlefilez/gofneaifncimeglaecpnanbnmnpfjekk'>SingleFileZ</a> and enable the option \"Allow access to file URLs\" in the details page of the extension (edge://extensions/?id=gofneaifncimeglaecpnanbnmnpfjekk). Otherwise, start the browser with the switch \"--allow-file-access-from-files\".</li>";
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
		const zipWriter = new zip.ZipWriter(blobWriter);
		pageData.url = options.url;
		pageData.archiveTime = (new Date()).toISOString();
		await addPageResources(zipWriter, pageData, { password: options.password }, options.createRootDirectory ? String(Date.now()) + "_" + (options.tabId || 0) + "/" : "", options.url);
		const comment = (new TextEncoder()).encode("]]></xmp></html>");
		const data = await zipWriter.close(comment);
		return new Blob([data], { type: "text/html" });
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
		const dataReader = typeof data.content == "string" ? new zip.TextReader(data.content) : new zip.BlobReader(new Blob([new Uint8Array(data.content)]));
		const options = { comment: data.url && data.url.startsWith("data:") ? "data:" : data.url, password: data.password, bufferedWrite: true };
		if (NO_COMPRESSION_EXTENSIONS.includes(data.extension)) {
			options.level = 0;
		}
		await zipWriter.add(prefixName + data.name, dataReader, options);
	}

	function bootstrapCode() {
		let bootstrapStarted;
		zip.configure({ useWebWorkers: false });
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
			const blobReader = new zip.BlobReader(content);
			let resources = [];
			try {
				const zipReader = new zip.ZipReader(blobReader);
				const entries = await zipReader.getEntries();
				let options;
				await Promise.all(entries.map(async entry => {
					let dataWriter, content, textContent;
					if (!options && entry.bitFlag.encrypted) {
						options = { password: prompt("Please enter the password to view the page") };
					}
					if (entry.filename.match(/index\.html$/) || entry.filename.match(/stylesheet_[0-9]+\.css/) || entry.filename.match(/scripts\/[0-9]+\.js/)) {
						dataWriter = new zip.TextWriter();
						textContent = await entry.getData(dataWriter, options);
					} else {
						const mimeType = entry.filename.match(/\.svg$/) ? "image/svg+xml" : "application/octet-stream";
						if (entry.filename.match(/frames\//)) {
							content = await entry.getData(new zip.Data64URIWriter(mimeType), options);
						} else {
							content = URL.createObjectURL(await entry.getData(new zip.BlobWriter(mimeType), options));
						}
					}
					resources.push({ filename: entry.filename, content, textContent });
				}));
				await zipReader.close();
			} catch (error) {
				alert("Error: " + error.message || error);
				const waitMessage = document.getElementById("sfz-wait-message");
				if (waitMessage) {
					waitMessage.remove();
				}
			}
			let docContent;
			resources = resources.sort((resourceLeft, resourceRight) => resourceRight.filename.length - resourceLeft.filename.length);
			const REGEXP_ESCAPE = /([{}()^$&.*?/+|[\\\\]|\]|-)/g;
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
								resource.textContent = resource.textContent.replace(new RegExp(filename.replace(REGEXP_ESCAPE, "\\$1"), "g"), innerResource.content);
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
					if (resource.filename.match(/^([0-9_]+\/)?index.html$/)) {
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
			document.dispatchEvent(new CustomEvent("single-filez-display-infobar"));
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
