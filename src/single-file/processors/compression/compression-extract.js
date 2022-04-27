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

/* global zip, Blob, FileReader, URL */

export {
	extract
};

async function extract(content, { password, prompt = () => { }, shadowRootScriptURL, zipOptions = { useWebWorkers: false }, noBlobURL } = {}) {
	const KNOWN_MIMETYPES = {
		"gif": "image/gif",
		"jpg": "image/jpeg",
		"png": "image/png",
		"tif": "image/tiff",
		"tiff": "image/tiff",
		"bmp": "image/bmp",
		"ico": "image/vnd.microsoft.icon",
		"webp": "image/webp",
		"svg": "image/svg+xml",
		"avi": "video/x-msvideo",
		"ogv": "video/ogg",
		"mp4": "video/mp4",
		"mpeg": "video/mpeg",
		"ts": "video/mp2t",
		"webm": "video/webm",
		"3gp": "video/3gpp",
		"3g2": "video/3gpp",
		"mp3": "audio/mpeg",
		"oga": "audio/ogg",
		"mid": "audio/midi",
		"midi": "audio/midi",
		"opus": "audio/opus",
		"wav": "audio/wav",
		"weba": "audio/webm"
	};
	if (Array.isArray(content)) {
		content = new Blob([new Uint8Array(content)]);
	}
	zip.configure(zipOptions);
	const blobReader = new zip.BlobReader(content);
	let resources = [];
	const zipReader = new zip.ZipReader(blobReader);
	const entries = await zipReader.getEntries();
	const options = { password };
	await Promise.all(entries.map(async entry => {
		let dataWriter, content, textContent, name;
		if (!options.password && entry.bitFlag.encrypted) {
			options.password = prompt("Please enter the password to view the page");
		}
		name = entry.filename.match(/^([0-9_]+\/)?(.*)$/)[2];
		if (entry.filename.match(/index\.html$/) || entry.filename.match(/stylesheet_[0-9]+\.css/) || entry.filename.match(/scripts\/[0-9]+\.js/)) {
			dataWriter = new zip.TextWriter();
			textContent = await entry.getData(dataWriter, options);
		} else {
			const extension = entry.filename.match(/\.([^.]+)/);
			let mimeType;
			if (extension && extension[1] && KNOWN_MIMETYPES[extension[1]]) {
				mimeType = KNOWN_MIMETYPES[extension[1]];
			} else {
				mimeType = "application/octet-stream";
			}
			if (entry.filename.match(/frames\//) || noBlobURL) {
				content = await entry.getData(new zip.Data64URIWriter(mimeType), options);
			} else {
				content = URL.createObjectURL(await entry.getData(new zip.BlobWriter(mimeType), options));
			}
		}
		resources.push({ filename: entry.filename, name, url: entry.comment, content, textContent, parentResources: [] });
	}));
	await zipReader.close();
	let docContent, url;
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
						const searchRegExp = new RegExp(filename.replace(REGEXP_ESCAPE, "\\$1"), "g");
						const position = resource.textContent.search(searchRegExp);
						if (position != -1) {
							innerResource.parentResources.push(resource.filename);
							resource.textContent = resource.textContent.replace(searchRegExp, innerResource.content);
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
				if (shadowRootScriptURL) {
					resource.textContent = resource.textContent.replace(/<script data-template-shadow-root.*<\/script>/g, "<script data-template-shadow-root src=" + shadowRootScriptURL + "></" + "script>");
				}
			}
			if (resource.filename.match(/^([0-9_]+\/)?index.html$/)) {
				docContent = resource.textContent;
				url = resource.url;
			} else {
				const reader = new FileReader();
				if (resource.textContent) {
					reader.readAsDataURL(new Blob([resource.textContent], { type: mimeType + ";charset=utf-8" }));
					resource.content = await new Promise((resolve, reject) => {
						reader.addEventListener("load", () => resolve(reader.result), false);
						reader.addEventListener("error", reject, false);
					});
				} else {
					resource.content = "data:text/plain,";
				}
			}
		}
	}
	return { docContent, resources, url };
}