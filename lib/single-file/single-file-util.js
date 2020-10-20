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

/* global window */

this.singlefile.lib.util = this.singlefile.lib.util || (() => {

	const DEBUG = false;
	const ONE_MB = 1024 * 1024;
	const DEFAULT_REPLACED_CHARACTERS = ["~", "+", "\\\\", "?", "%", "*", ":", "|", "\"", "<", ">", "\x00-\x1f", "\x7F"];
	const CONTENT_TYPE_EXTENSIONS = {
		"image/svg+xml": ".svg",
		"image/png": ".png",
		"image/jpeg": ".jpg",
		"image/gif": ".gif",
		"image/webp": ".webp"
	};


	const URL = window.URL;
	const DOMParser = window.DOMParser;
	const Blob = window.Blob;
	const FileReader = window.FileReader;
	const fetch = window.fetch;
	const crypto = window.crypto;
	const TextDecoder = window.TextDecoder;
	const TextEncoder = window.TextEncoder;
	const singlefile = this.singlefile;

	return {
		getInstance: (utilOptions) => {
			const modules = singlefile.lib.modules;
			const vendor = singlefile.lib.vendor;
			const helper = singlefile.lib.helper;

			if (modules.serializer === undefined) {
				modules.serializer = {
					process(doc) {
						return getDoctypeString(doc) + doc.documentElement.outerHTML;
					}
				};
			}

			utilOptions = utilOptions || {};
			utilOptions.fetch = utilOptions.fetch || fetch;
			utilOptions.frameFetch = utilOptions.frameFetch || utilOptions.fetch || fetch;
			return {
				getDoctypeString,
				getContent,
				parseURL(resourceURL, baseURI) {
					if (baseURI === undefined) {
						return new URL(resourceURL);
					} else {
						return new URL(resourceURL, baseURI);
					}
				},
				resolveURL(resourceURL, baseURI) {
					return this.parseURL(resourceURL, baseURI).href;
				},
				getValidFilename(filename, replacedCharacters = DEFAULT_REPLACED_CHARACTERS, replacementCharacter) {
					replacedCharacters.forEach(replacedCharacter => filename = filename.replace(new RegExp("[" + replacedCharacter + "]+", "g"), replacementCharacter));
					filename = filename
						.replace(/\.\.\//g, "")
						.replace(/^\/+/, "")
						.replace(/\/+/g, "/")
						.replace(/\/$/, "")
						.replace(/\.$/, "")
						.replace(/\.\//g, "." + replacementCharacter)
						.replace(/\/\./g, "/" + replacementCharacter);
					return filename;
				},
				getFilenameExtension(resourceURL, replacedCharacters, replacementCharacter) {
					const matchExtension = new URL(resourceURL).pathname.match(/(\.[^\\/.]*)$/);
					return ((matchExtension && matchExtension[1] && this.getValidFilename(matchExtension[1], replacedCharacters, replacementCharacter)) || "").toLowerCase();
				},
				getContentTypeExtension(contentType) {
					return CONTENT_TYPE_EXTENSIONS[contentType] || "";
				},
				parseDocContent(content, baseURI) {
					const doc = (new DOMParser()).parseFromString(content, "text/html");
					if (!doc.head) {
						doc.documentElement.insertBefore(doc.createElement("HEAD"), doc.body);
					}
					let baseElement = doc.querySelector("base");
					if (!baseElement || !baseElement.getAttribute("href")) {
						if (baseElement) {
							baseElement.remove();
						}
						baseElement = doc.createElement("base");
						baseElement.setAttribute("href", baseURI);
						doc.head.insertBefore(baseElement, doc.head.firstChild);
					}
					return doc;
				},
				parseXMLContent(content) {
					return (new DOMParser()).parseFromString(content, "text/xml");
				},
				parseSVGContent(content) {
					return (new DOMParser()).parseFromString(content, "image/svg+xml");
				},
				async digest(algo, text) {
					try {
						const hash = await crypto.subtle.digest(algo, new TextEncoder("utf-8").encode(text));
						return hex(hash);
					} catch (error) {
						return "";
					}
				},
				getContentSize(content) {
					return new Blob([content]).size;
				},
				truncateText(content, maxSize) {
					const blob = new Blob([content]);
					const reader = new FileReader();
					reader.readAsText(blob.slice(0, maxSize));
					return new Promise((resolve, reject) => {
						reader.addEventListener("load", () => {
							if (content.startsWith(reader.result)) {
								resolve(reader.result);
							} else {
								this.truncateText(content, maxSize - 1).then(resolve).catch(reject);
							}
						}, false);
						reader.addEventListener("error", reject, false);
					});
				},
				minifyHTML(doc, options) {
					return modules.htmlMinifier.process(doc, options);
				},
				minifyCSSRules(stylesheets, styles, mediaAllInfo) {
					return modules.cssRulesMinifier.process(stylesheets, styles, mediaAllInfo);
				},
				removeUnusedFonts(doc, stylesheets, styles, options) {
					return modules.fontsMinifier.process(doc, stylesheets, styles, options);
				},
				removeAlternativeFonts(doc, stylesheets, fonts, fontTests) {
					return modules.fontsAltMinifier.process(doc, stylesheets, fonts, fontTests);
				},
				getMediaAllInfo(doc, stylesheets, styles) {
					return modules.matchedRules.getMediaAllInfo(doc, stylesheets, styles);
				},
				compressCSS(content, options) {
					return vendor.cssMinifier.processString(content, options);
				},
				minifyMedias(stylesheets) {
					return modules.mediasAltMinifier.process(stylesheets);
				},
				removeAlternativeImages(doc, imageResources) {
					return modules.imagesAltMinifier.process(doc, imageResources);
				},
				parseSrcset(srcset) {
					return vendor.srcsetParser.process(srcset);
				},
				preProcessDoc(doc, win, options) {
					return helper.preProcessDoc(doc, win, options);
				},
				postProcessDoc(doc, markedElements) {
					helper.postProcessDoc(doc, markedElements);
				},
				serialize(doc, compressHTML) {
					return modules.serializer.process(doc, compressHTML);
				},
				removeQuotes(string) {
					return helper.removeQuotes(string);
				},
				waitForUserScript(eventPrefixName) {
					if (helper.waitForUserScript) {
						return helper.waitForUserScript(eventPrefixName);
					}
				},
				ON_BEFORE_CAPTURE_EVENT_NAME: helper.ON_BEFORE_CAPTURE_EVENT_NAME,
				ON_AFTER_CAPTURE_EVENT_NAME: helper.ON_AFTER_CAPTURE_EVENT_NAME,
				WIN_ID_ATTRIBUTE_NAME: helper.WIN_ID_ATTRIBUTE_NAME,
				REMOVED_CONTENT_ATTRIBUTE_NAME: helper.REMOVED_CONTENT_ATTRIBUTE_NAME,
				HIDDEN_CONTENT_ATTRIBUTE_NAME: helper.HIDDEN_CONTENT_ATTRIBUTE_NAME,
				HIDDEN_FRAME_ATTRIBUTE_NAME: helper.HIDDEN_FRAME_ATTRIBUTE_NAME,
				IMAGE_ATTRIBUTE_NAME: helper.IMAGE_ATTRIBUTE_NAME,
				POSTER_ATTRIBUTE_NAME: helper.POSTER_ATTRIBUTE_NAME,
				CANVAS_ATTRIBUTE_NAME: helper.CANVAS_ATTRIBUTE_NAME,
				HTML_IMPORT_ATTRIBUTE_NAME: helper.HTML_IMPORT_ATTRIBUTE_NAME,
				INPUT_VALUE_ATTRIBUTE_NAME: helper.INPUT_VALUE_ATTRIBUTE_NAME,
				SHADOW_ROOT_ATTRIBUTE_NAME: helper.SHADOW_ROOT_ATTRIBUTE_NAME,
				PRESERVED_SPACE_ELEMENT_ATTRIBUTE_NAME: helper.PRESERVED_SPACE_ELEMENT_ATTRIBUTE_NAME,
				STYLESHEET_ATTRIBUTE_NAME: helper.STYLESHEET_ATTRIBUTE_NAME,
				SELECTED_CONTENT_ATTRIBUTE_NAME: helper.SELECTED_CONTENT_ATTRIBUTE_NAME
			};

			async function getContent(resourceURL, options) {
				let response, startTime;
				const fetchResource = utilOptions.fetch;
				const fetchFrameResource = utilOptions.frameFetch;
				if (DEBUG) {
					startTime = Date.now();
				}
				try {
					if (options.frameId) {
						try {
							response = await fetchFrameResource(resourceURL, options.frameId);
						} catch (error) {
							response = await fetchResource(resourceURL);
						}
					} else {
						response = await fetchResource(resourceURL);
					}
				} catch (error) {
					return { resourceURL };
				}
				let buffer;
				try {
					buffer = await response.arrayBuffer();
				} catch (error) {
					return { data: options.asBinary ? "data:null;base64," : "", resourceURL };
				}
				resourceURL = response.url || resourceURL;
				let contentType = response.headers.get("content-type");
				let charset;
				if (contentType) {
					const matchContentType = contentType.toLowerCase().split(";");
					contentType = matchContentType[0].trim();
					if (!contentType.includes("/")) {
						contentType = null;
					}
					const charsetValue = matchContentType[1] && matchContentType[1].trim();
					if (charsetValue) {
						const matchCharset = charsetValue.match(/^charset=(.*)/);
						if (matchCharset && matchCharset[1]) {
							charset = helper.removeQuotes(matchCharset[1].trim());
						}
					}
				}
				if (!charset && options.charset) {
					charset = options.charset;
				}
				if (options.asBinary) {
					try {
						if (DEBUG) {
							log("  // ENDED   download url =", resourceURL, "delay =", Date.now() - startTime);
						}
						if (options.maxResourceSizeEnabled && buffer.byteLength > options.maxResourceSize * ONE_MB) {
							return { resourceURL };
						} else {
							return { data: new Uint8Array(buffer), resourceURL, contentType };
						}
					} catch (error) {
						return { resourceURL };
					}
				} else {
					if (response.status >= 400 || (options.validateTextContentType && !contentType.startsWith("text/"))) {
						return { resourceURL };
					}
					if (!charset) {
						charset = "utf-8";
					}
					if (DEBUG) {
						log("  // ENDED   download url =", resourceURL, "delay =", Date.now() - startTime);
					}
					if (options.maxResourceSizeEnabled && buffer.byteLength > options.maxResourceSize * ONE_MB) {
						return { resourceURL, charset };
					} else {
						try {
							return { data: new TextDecoder(charset).decode(buffer), resourceURL, charset, contentType };
						} catch (error) {
							try {
								charset = "utf-8";
								return { data: new TextDecoder(charset).decode(buffer), resourceURL, charset, contentType };
							} catch (error) {
								return { resourceURL, charset };
							}
						}
					}
				}
			}

		}
	};

	// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
	function hex(buffer) {
		const hexCodes = [];
		const view = new DataView(buffer);
		for (let i = 0; i < view.byteLength; i += 4) {
			const value = view.getUint32(i);
			const stringValue = value.toString(16);
			const padding = "00000000";
			const paddedValue = (padding + stringValue).slice(-padding.length);
			hexCodes.push(paddedValue);
		}
		return hexCodes.join("");
	}

	function getDoctypeString(doc) {
		const docType = doc.doctype;
		let docTypeString = "";
		if (docType) {
			docTypeString = "<!DOCTYPE " + docType.nodeName;
			if (docType.publicId) {
				docTypeString += " PUBLIC \"" + docType.publicId + "\"";
				if (docType.systemId)
					docTypeString += " \"" + docType.systemId + "\"";
			} else if (docType.systemId)
				docTypeString += " SYSTEM \"" + docType.systemId + "\"";
			if (docType.internalSubset)
				docTypeString += " [" + docType.internalSubset + "]";
			docTypeString += "> ";
		}
		return docTypeString;
	}

	function log(...args) {
		console.log("S-File <browser>", ...args); // eslint-disable-line no-console
	}

})();