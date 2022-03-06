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

/* global browser, singlefile, URL, Response */

import * as config from "./config.js";
import * as bookmarks from "./bookmarks.js";
import * as business from "./business.js";
import { launchWebAuthFlow, extractAuthCode } from "./tabs-util.js";
import * as ui from "./../../ui/bg/index.js";
import { GDrive } from "./../../lib/gdrive/gdrive.js";
import { pushGitHub } from "./../../lib/github/github.js";
import { download } from "./download-util.js";

const partialContents = new Map();
const MAX_CONTENT_SIZE = 32 * (1024 * 1024);
const GDRIVE_CLIENT_ID = "7544745492-ig6uqhua0ads4jei52lervm1pqsi6hot.apps.googleusercontent.com";
const GDRIVE_CLIENT_KEY = "000000000000000000000000";
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const CONFLICT_ACTION_SKIP = "skip";
const CONFLICT_ACTION_UNIQUIFY = "uniquify";
const REGEXP_ESCAPE = /([{}()^$&.*?/+|[\\\\]|\]|-)/g;

const manifest = browser.runtime.getManifest();
const requestPermissionIdentity = manifest.optional_permissions && manifest.optional_permissions.includes("identity");
const gDrive = new GDrive(GDRIVE_CLIENT_ID, GDRIVE_CLIENT_KEY, SCOPES);
export {
	onMessage,
	downloadPage,
	testSkipSave,
	saveToGDrive,
	saveToGitHub
};

async function onMessage(message, sender) {
	if (message.method.endsWith(".download")) {
		return downloadTabPage(message, sender.tab);
	}
	if (message.method.endsWith(".disableGDrive")) {
		const authInfo = await config.getAuthInfo();
		config.removeAuthInfo();
		await gDrive.revokeAuthToken(authInfo && (authInfo.accessToken || authInfo.revokableAccessToken));
		return {};
	}
	if (message.method.endsWith(".end")) {
		business.onSaveEnd(message.taskId);
		return {};
	}
	if (message.method.endsWith(".getInfo")) {
		return business.getTasksInfo();
	}
	if (message.method.endsWith(".cancel")) {
		business.cancelTask(message.taskId);
		return {};
	}
	if (message.method.endsWith(".cancelAll")) {
		business.cancelAllTasks();
		return {};
	}
	if (message.method.endsWith(".saveUrls")) {
		business.saveUrls(message.urls);
		return {};
	}
}

async function downloadTabPage(message, tab) {
	const tabId = tab.id;
	let contents;
	if (message.truncated) {
		contents = partialContents.get(tabId);
		if (!contents) {
			contents = [];
			partialContents.set(tabId, contents);
		}
		contents.push(message.content);
		if (message.finished) {
			partialContents.delete(tabId);
		}
	} else if (message.content) {
		contents = [message.content];
	}
	if (!message.truncated || message.finished) {
		let skipped;
		if (message.backgroundSave && !message.saveToGDrive) {
			const testSkip = await testSkipSave(message.filename, message);
			message.filenameConflictAction = testSkip.filenameConflictAction;
			skipped = testSkip.skipped;
		}
		if (skipped) {
			ui.onEnd(tabId);
		} else {
			const pageData = JSON.parse(singlefile.helper.flatten(contents).join(""));
			const blob = await singlefile.processors.compression.process(pageData, {
				insertTextBody: message.insertTextBody,
				url: tab.url,
				createRootDirectory: message.createRootDirectory,
				tabId,
				selfExtractingArchive: message.selfExtractingArchive,
				insertCanonicalLink: message.insertCanonicalLink,
				insertMetaNoIndex: message.insertMetaNoIndex,
				password: message.password
			});
			await downloadBlob(blob, tabId, tab.incognito, message);
		}
	}
	return {};
}

async function downloadBlob(blob, tabId, incognito, message) {
	try {
		if (message.saveToGDrive) {
			await (await saveToGDrive(message.taskId, message.filename, blob, {
				forceWebAuthFlow: message.forceWebAuthFlow
			}, {
				onProgress: (offset, size) => ui.onUploadProgress(tabId, offset, size)
			})).uploadPromise;
		} else if (message.saveToGitHub) {
			await (await saveToGitHub(message.taskId, message.filename, blob, message.githubToken, message.githubUser, message.githubRepository, message.githubBranch)).pushPromise;
		} else {
			if (message.backgroundSave) {
				message.url = URL.createObjectURL(blob);
				await downloadPage(message, {
					confirmFilename: message.confirmFilename,
					incognito,
					filenameConflictAction: message.filenameConflictAction,
					filenameReplacementCharacter: message.filenameReplacementCharacter,
					bookmarkId: message.bookmarkId,
					replaceBookmarkURL: message.replaceBookmarkURL
				});
			} else {
				await downloadPageForeground(message.taskId, message.filename, blob, tabId);
			}
		}
		ui.onEnd(tabId);
	} catch (error) {
		if (!error.message || error.message != "upload_cancelled") {
			console.error(error); // eslint-disable-line no-console
			ui.onError(tabId, error.message);
		}
	} finally {
		if (message.url) {
			URL.revokeObjectURL(message.url);
		}
	}
}

function getRegExp(string) {
	return string.replace(REGEXP_ESCAPE, "\\$1");
}

async function getAuthInfo(authOptions, force) {
	let authInfo = await config.getAuthInfo();
	const options = {
		interactive: true,
		forceWebAuthFlow: authOptions.forceWebAuthFlow,
		requestPermissionIdentity,
		launchWebAuthFlow: options => launchWebAuthFlow(options),
		extractAuthCode: authURL => extractAuthCode(authURL)
	};
	gDrive.setAuthInfo(authInfo, options);
	if (!authInfo || !authInfo.accessToken || force) {
		authInfo = await gDrive.auth(options);
		if (authInfo) {
			await config.setAuthInfo(authInfo);
		} else {
			await config.removeAuthInfo();
		}
	}
	return authInfo;
}

async function saveToGitHub(taskId, filename, content, githubToken, githubUser, githubRepository, githubBranch) {
	const taskInfo = business.getTaskInfo(taskId);
	if (!taskInfo || !taskInfo.cancelled) {
		const pushInfo = pushGitHub(githubToken, githubUser, githubRepository, githubBranch, filename, content);
		business.setCancelCallback(taskId, pushInfo.cancelPush);
		try {
			await (await pushInfo).pushPromise;
			return pushInfo;
		} catch (error) {
			throw new Error(error.message + " (GitHub)");
		}
	}
}

async function saveToGDrive(taskId, filename, blob, authOptions, uploadOptions) {
	try {
		await getAuthInfo(authOptions);
		const taskInfo = business.getTaskInfo(taskId);
		if (!taskInfo || !taskInfo.cancelled) {
			const uploadInfo = await gDrive.upload(filename, blob, uploadOptions);
			business.setCancelCallback(taskId, uploadInfo.cancelUpload);
			return uploadInfo;
		}
	}
	catch (error) {
		if (error.message == "invalid_token") {
			let authInfo;
			try {
				authInfo = await gDrive.refreshAuthToken();
			} catch (error) {
				if (error.message == "unknown_token") {
					authInfo = await getAuthInfo(authOptions, true);
				} else {
					throw new Error(error.message + " (Google Drive)");
				}
			}
			if (authInfo) {
				await config.setAuthInfo(authInfo);
			} else {
				await config.removeAuthInfo();
			}
			await saveToGDrive(taskId, filename, blob, authOptions, uploadOptions);
		} else {
			throw new Error(error.message + " (Google Drive)");
		}
	}
}

async function testSkipSave(filename, options) {
	let skipped, filenameConflictAction = options.filenameConflictAction;
	if (filenameConflictAction == CONFLICT_ACTION_SKIP) {
		const downloadItems = await browser.downloads.search({
			filenameRegex: "(\\\\|/)" + getRegExp(filename) + "$",
			exists: true
		});
		if (downloadItems.length) {
			skipped = true;
		} else {
			filenameConflictAction = CONFLICT_ACTION_UNIQUIFY;
		}
	}
	return { skipped, filenameConflictAction };
}

async function downloadPage(pageData, options) {
	const downloadInfo = {
		url: pageData.url,
		saveAs: options.confirmFilename,
		filename: pageData.filename,
		conflictAction: options.filenameConflictAction
	};
	if (options.incognito) {
		downloadInfo.incognito = true;
	}
	const downloadData = await download(downloadInfo, options.filenameReplacementCharacter);
	if (downloadData.filename && pageData.bookmarkId && pageData.replaceBookmarkURL) {
		if (!downloadData.filename.startsWith("file:")) {
			if (downloadData.filename.startsWith("/")) {
				downloadData.filename = downloadData.filename.substring(1);
			}
			downloadData.filename = "file:///" + downloadData.filename.replace(/#/g, "%23");
		}
		await bookmarks.update(pageData.bookmarkId, { url: downloadData.filename });
	}
}

async function downloadPageForeground(taskId, filename, content, tabId) {
	for (let blockIndex = 0; blockIndex * MAX_CONTENT_SIZE < content.size; blockIndex++) {
		const message = {
			method: "content.download",
			filename,
			taskId
		};
		message.truncated = content.size > MAX_CONTENT_SIZE;
		if (message.truncated) {
			message.finished = (blockIndex + 1) * MAX_CONTENT_SIZE > content.size;
			const blob = content.slice(blockIndex * MAX_CONTENT_SIZE, (blockIndex + 1) * MAX_CONTENT_SIZE);
			message.content = Array.from(new Uint8Array(await new Response(blob).arrayBuffer()));
		} else {
			message.content = Array.from(new Uint8Array(await new Response(content).arrayBuffer()));
		}
		await browser.tabs.sendMessage(tabId, message);
	}
}