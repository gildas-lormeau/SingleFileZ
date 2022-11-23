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

/* global browser */

import * as config from "./config.js";
import * as yabson from "./../../lib/yabson/yabson.js";

const EDITOR_PAGE_URL = "/src/ui/pages/editor.html";
const tabsData = new Map();
const tabDataParsers = new Map();
const EDITOR_URL = browser.runtime.getURL(EDITOR_PAGE_URL);

export {
	onMessage,
	onTabRemoved,
	isEditor,
	open,
	EDITOR_URL
};

async function open({ tabIndex, content, filename }) {
	const createTabProperties = { active: true, url: EDITOR_PAGE_URL };
	if (tabIndex != null) {
		createTabProperties.index = tabIndex;
	}
	const tab = await browser.tabs.create(createTabProperties);
	tabsData.set(tab.id, { content, filename });
}

function onTabRemoved(tabId) {
	tabsData.delete(tabId);
}

function isEditor(tab) {
	return tab.url == EDITOR_URL;
}

async function onMessage(message, sender) {
	if (message.method.endsWith(".getTabData")) {
		const tab = sender.tab;
		const tabData = tabsData.get(tab.id);
		if (tabData) {
			const options = await config.getOptions(tabData.url);
			const serializer = yabson.getSerializer({ tabData, options });
			for await (const data of serializer) {
				await browser.tabs.sendMessage(tab.id, {
					method: "editor.setTabData",
					data: Array.from(data)
				});
			}
			await browser.tabs.sendMessage(tab.id, { method: "editor.setTabData" });
		}
		return {};
	}
	if (message.method.endsWith(".open")) {
		const tab = sender.tab;
		let tabDataParser = tabDataParsers.get(tab.id);
		if (!tabDataParser) {
			tabDataParser = yabson.getParser();
			tabDataParsers.set(tab.id, tabDataParser);
		}
		const result = await tabDataParser.next(message.data);
		if (result.done) {
			const updateTabProperties = { url: EDITOR_PAGE_URL };
			await browser.tabs.update(tab.id, updateTabProperties);
			tabsData.set(tab.id, { url: tab.url, content: result.value.content, filename: result.value.filename });
		}
		return {};
	}
	if (message.method.endsWith(".ping")) {
		return {};
	}
}