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

/* global browser, singlefile, URL, fetch, btoa, AbortController */

import * as config from "./config.js";
import * as bookmarks from "./bookmarks.js";
import * as business from "./business.js";
import * as editor from "./editor.js";
import { launchWebAuthFlow, extractAuthCode } from "./tabs-util.js";
import * as ui from "./../../ui/bg/index.js";
import { GDrive } from "./../../lib/gdrive/gdrive.js";
import { pushGitHub } from "./../../lib/github/github.js";
import { download } from "./download-util.js";
import * as yabson from "./../../lib/yabson/yabson.js";

const parsers = new Map();
const GDRIVE_CLIENT_ID = "7544745492-oe3q2jjvdluks2st2smslmrofcdederh.apps.googleusercontent.com";
const GDRIVE_CLIENT_KEY = "VQJ8Gq8Vxx72QyxPyeLtWvUt";
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const CONFLICT_ACTION_SKIP = "skip";
const CONFLICT_ACTION_UNIQUIFY = "uniquify";
const CONFLICT_ACTION_OVERWRITE = "overwrite";
const CONFLICT_ACTION_PROMPT = "prompt";
const REGEXP_ESCAPE = /([{}()^$&.*?/+|[\\\\]|\]|-)/g;

const gDrive = new GDrive(GDRIVE_CLIENT_ID, GDRIVE_CLIENT_KEY, SCOPES);
export {
	onMessage,
	downloadPage,
	testSkipSave,
	saveToGDrive,
	saveToGitHub,
	saveWithWebDAV,
	encodeSharpCharacter
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
	if (message.blobURL) {
		try {
			message.pageData = await yabson.parse(new Uint8Array(await (await fetch(message.blobURL)).arrayBuffer()));
		} catch (error) {
			return { error: true };
		}
		await download(message);
	} else {
		let parser = parsers.get(tabId);
		if (!parser) {
			parser = yabson.getParser();
			parsers.set(tabId, parser);
		}
		let result = await parser.next(message.data);
		if (result.done) {
			const message = result.value;
			parsers.delete(tabId);
			await download(message);
		}
	}
	return {};

	async function download(message) {
		let skipped;
		if (message.backgroundSave && !message.saveToGDrive && !message.saveWithWebDAV && !message.saveToGitHub) {
			const testSkip = await testSkipSave(message.filename, message);
			message.filenameConflictAction = testSkip.filenameConflictAction;
			skipped = testSkip.skipped;
		}
		if (skipped) {
			ui.onEnd(tabId);
		} else {
			const pageData = message.pageData;
			const blob = await singlefile.processors.compression.process(pageData, {
				insertTextBody: message.insertTextBody,
				url: pageData.url || tab.url,
				createRootDirectory: message.createRootDirectory,
				tabId,
				selfExtractingArchive: message.selfExtractingArchive,
				insertCanonicalLink: message.insertCanonicalLink,
				insertMetaNoIndex: message.insertMetaNoIndex,
				password: message.password
			});
			if (message.openEditor) {
				ui.onEdit(tab.id);
				await editor.open({ tabIndex: tab.index + 1, filename: message.filename, content: new Uint8Array(await blob.arrayBuffer()) });
			} else {
				await downloadBlob(blob, tabId, tab.incognito, message);
			}
		}
	}
}

async function downloadBlob(blob, tabId, incognito, message) {
	try {
		const prompt = filename => promptFilename(tabId, filename);
		let response;
		if (message.saveWithWebDAV) {
			response = await saveWithWebDAV(message.taskId, encodeSharpCharacter(message.filename), blob, message.webDAVURL, message.webDAVUser, message.webDAVPassword, { filenameConflictAction: message.filenameConflictAction, prompt });
		} else if (message.saveToGDrive) {
			await saveToGDrive(message.taskId, encodeSharpCharacter(message.filename), blob, {
				forceWebAuthFlow: message.forceWebAuthFlow
			}, {
				onProgress: (offset, size) => ui.onUploadProgress(tabId, offset, size),
				filenameConflictAction: message.filenameConflictAction,
				prompt
			});
		} else if (message.saveToGitHub) {
			response = await saveToGitHub(message.taskId, encodeSharpCharacter(message.filename), blob, message.githubToken, message.githubUser, message.githubRepository, message.githubBranch, {
				filenameConflictAction: message.filenameConflictAction,
				prompt
			});
			await response.pushPromise;
		} else {
			if (message.backgroundSave) {
				message.url = URL.createObjectURL(blob);
				response = await downloadPage(message, {
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
		if (message.replaceBookmarkURL && response && response.url) {
			await bookmarks.update(message.bookmarkId, { url: response.url });
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

function encodeSharpCharacter(path) {
	return path.replace(/#/g, "%23");
}

function getRegExp(string) {
	return string.replace(REGEXP_ESCAPE, "\\$1");
}

async function getAuthInfo(authOptions, force) {
	let authInfo = await config.getAuthInfo();
	const options = {
		interactive: true,
		forceWebAuthFlow: authOptions.forceWebAuthFlow,
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

async function saveToGitHub(taskId, filename, blob, githubToken, githubUser, githubRepository, githubBranch, { filenameConflictAction, prompt }) {
	const taskInfo = business.getTaskInfo(taskId);
	if (!taskInfo || !taskInfo.cancelled) {
		const pushInfo = pushGitHub(githubToken, githubUser, githubRepository, githubBranch, filename, blob, { filenameConflictAction, prompt });
		business.setCancelCallback(taskId, pushInfo.cancelPush);
		try {
			await (await pushInfo).pushPromise;
			return pushInfo;
		} catch (error) {
			throw new Error(error.message + " (GitHub)");
		}
	}
}

async function saveWithWebDAV(taskId, filename, blob, url, username, password, { filenameConflictAction, prompt, preventRetry }) {
	const taskInfo = business.getTaskInfo(taskId);
	const controller = new AbortController();
	const { signal } = controller;
	const authorization = "Basic " + btoa(username + ":" + password);
	if (!url.endsWith("/")) {
		url += "/";
	}
	if (!taskInfo || !taskInfo.cancelled) {
		business.setCancelCallback(taskId, () => controller.abort());
		try {
			let response = await sendRequest(url + filename, "HEAD");
			if (response.status == 200) {
				if (filenameConflictAction == CONFLICT_ACTION_OVERWRITE) {
					response = await sendRequest(url + filename, "PUT", blob);
					if (response.status == 201) {
						return response;
					} else if (response.status >= 400) {
						response = await sendRequest(url + filename, "DELETE");
						if (response.status >= 400) {
							throw new Error("Error " + response.status);
						}
						return saveWithWebDAV(taskId, filename, blob, url, username, password, { filenameConflictAction, prompt });
					}
				} else if (filenameConflictAction == CONFLICT_ACTION_UNIQUIFY) {
					let filenameWithoutExtension = filename;
					let extension = "";
					const dotIndex = filename.lastIndexOf(".");
					if (dotIndex > -1) {
						filenameWithoutExtension = filename.substring(0, dotIndex);
						extension = filename.substring(dotIndex + 1);
					}
					let saved = false;
					let indexFilename = 1;
					while (!saved) {
						filename = filenameWithoutExtension + " (" + indexFilename + ")." + extension;
						const response = await sendRequest(url + filename, "HEAD");
						if (response.status == 404) {
							return saveWithWebDAV(taskId, filename, blob, url, username, password, { filenameConflictAction, prompt });
						} else {
							indexFilename++;
						}
					}
				} else if (filenameConflictAction == CONFLICT_ACTION_PROMPT) {
					if (prompt) {
						filename = await prompt(filename);
						if (filename) {
							return saveWithWebDAV(taskId, filename, blob, url, username, password, { filenameConflictAction, prompt });
						} else {
							return response;
						}
					} else {
						return saveWithWebDAV(taskId, filename, blob, url, username, password, { filenameConflictAction: CONFLICT_ACTION_UNIQUIFY });
					}
				} else if (filenameConflictAction == CONFLICT_ACTION_SKIP) {
					return response;
				}
			} else if (response.status == 404) {
				response = await sendRequest(url + filename, "PUT", blob);
				if (response.status >= 400 && !preventRetry) {
					if (filename.includes("/")) {
						const filenameParts = filename.split(/\/+/);
						filenameParts.pop();
						let path = "";
						for (const filenamePart of filenameParts) {
							if (filenamePart) {
								path += filenamePart;
								const response = await sendRequest(url + path, "PROPFIND");
								if (response.status == 404) {
									const response = await sendRequest(url + path, "MKCOL");
									if (response.status >= 400) {
										throw new Error("Error " + response.status);
									}
								}
								path += "/";
							}
						}
						return saveWithWebDAV(taskId, filename, blob, url, username, password, { filenameConflictAction, prompt, preventRetry: true });
					} else {
						throw new Error("Error " + response.status);
					}
				} else {
					return response;
				}
			} else if (response.status >= 400) {
				throw new Error("Error " + response.status);
			}
		} catch (error) {
			if (error.name != "AbortError") {
				throw new Error(error.message + " (WebDAV)");
			}
		}
	}

	function sendRequest(url, method, body) {
		const headers = {
			"Authorization": authorization
		};
		if (body) {
			headers["Content-Type"] = "text/html";
		}
		return fetch(url, { method, headers, signal, body, credentials: "omit" });
	}
}

async function saveToGDrive(taskId, filename, blob, authOptions, uploadOptions) {
	try {
		await getAuthInfo(authOptions);
		const taskInfo = business.getTaskInfo(taskId);
		if (!taskInfo || !taskInfo.cancelled) {
			return gDrive.upload(filename, blob, uploadOptions, callback => business.setCancelCallback(taskId, callback));
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
			return await saveToGDrive(taskId, filename, blob, authOptions, uploadOptions);
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

function promptFilename(tabId, filename) {
	return browser.tabs.sendMessage(tabId, { method: "content.prompt", message: "Filename conflict, please enter a new filename", value: filename });
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
	if (downloadData.filename) {
		let url = downloadData.filename;
		if (!url.startsWith("file:")) {
			if (url.startsWith("/")) {
				url = url.substring(1);
			}
			url = "file:///" + encodeSharpCharacter(url);
		}
		return { url };
	}
}

async function downloadPageForeground(taskId, filename, content, tabId) {
	const serializer = yabson.getSerializer({ filename, taskId, content: await content.arrayBuffer() });
	for await (const data of serializer) {
		await browser.tabs.sendMessage(tabId, {
			method: "content.download",
			data: Array.from(data)
		});
	}
	await browser.tabs.sendMessage(tabId, { method: "content.download" });
}