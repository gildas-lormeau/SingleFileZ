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

/* global browser, URL, Blob */

import * as yabson from "./../../lib/yabson/yabson.js";

export {
	downloadPage
};

async function downloadPage(pageData, options) {
	if (options.includeBOM) {
		pageData.content = "\ufeff" + pageData.content;
	}
	const blobURL = URL.createObjectURL(new Blob([await yabson.serialize(pageData)], { type: "application/octet-stream" }));
	const message = {
		method: "downloads.download",
		taskId: options.taskId,
		insertTextBody: options.insertTextBody,
		confirmFilename: options.confirmFilename,
		filenameConflictAction: options.filenameConflictAction,
		filename: pageData.filename,
		saveToGDrive: options.saveToGDrive,
		saveWithWebDAV: options.saveWithWebDAV,
		webDAVURL: options.webDAVURL,
		webDAVUser: options.webDAVUser,
		webDAVPassword: options.webDAVPassword,
		saveToGitHub: options.saveToGitHub,
		githubToken: options.githubToken,
		githubUser: options.githubUser,
		githubRepository: options.githubRepository,
		githubBranch: options.githubBranch,
		forceWebAuthFlow: options.forceWebAuthFlow,
		filenameReplacementCharacter: options.filenameReplacementCharacter,
		openEditor: options.openEditor,
		openSavedPage: options.openSavedPage,
		compressHTML: options.compressHTML,
		backgroundSave: options.backgroundSave,
		bookmarkId: options.bookmarkId,
		replaceBookmarkURL: options.replaceBookmarkURL,
		applySystemTheme: options.applySystemTheme,
		defaultEditorMode: options.defaultEditorMode,
		includeInfobar: options.includeInfobar,
		warnUnsavedPage: options.warnUnsavedPage,
		createRootDirectory: options.createRootDirectory,
		selfExtractingArchive: options.selfExtractingArchive,
		extractDataFromPage: options.extractDataFromPage,
		insertCanonicalLink: options.insertCanonicalLink,
		insertMetaNoIndex: options.insertMetaNoIndex,
		password: options.password,
		infobarScript: options.infobarScript,
		blobURL
	};
	const result = await browser.runtime.sendMessage(message);
	URL.revokeObjectURL(blobURL);
	if (result.error) {
		message.blobURL = null;
		message.pageData = pageData;
		const serializer = yabson.getSerializer(message);
		for await (const data of serializer) {
			await browser.runtime.sendMessage({
				method: "downloads.download",
				data: Array.from(data)
			});
		}
		await browser.runtime.sendMessage({ method: "downloads.download" });
	}
	if (options.backgroundSave) {
		await browser.runtime.sendMessage({ method: "downloads.end", taskId: options.taskId });
	}
}