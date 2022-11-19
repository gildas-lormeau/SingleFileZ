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

/* global browser, window, CustomEvent, setTimeout, clearTimeout */

import * as yabson from "./../../../../lib/yabson/yabson.js";

const FETCH_REQUEST_EVENT = "single-filez-request-fetch";
const FETCH_ACK_EVENT = "single-filez-ack-fetch";
const FETCH_RESPONSE_EVENT = "single-filez-response-fetch";
const ERR_HOST_FETCH = "Host fetch error (SingleFileZ)";
const HOST_FETCH_MAX_DELAY = 2500;
const USE_HOST_FETCH = Boolean(window.wrappedJSObject);

const addEventListener = (type, listener, options) => window.addEventListener(type, listener, options);
const dispatchEvent = event => window.dispatchEvent(event);
const removeEventListener = (type, listener, options) => window.removeEventListener(type, listener, options);

const fetch = (url, options) => window.fetch(url, options);

let requestId = 0, pendingResponses = new Map();

browser.runtime.onMessage.addListener(message => {
	if (message.method == "singlefile.fetchFrame" && window.frameId && window.frameId == message.frameId) {
		return onFetchFrame(message);
	}
	if (message.method == "singlefile.fetchResponse") {
		return onFetchResponse(message);
	}
});

async function onFetchFrame(message) {
	try {
		const response = await fetch(message.url, { cache: "force-cache", headers: message.headers });
		return {
			status: response.status,
			headers: [...response.headers],
			array: Array.from(new Uint8Array(await response.arrayBuffer()))
		};
	} catch (error) {
		return {
			error: error && error.toString()
		};
	}
}

async function onFetchResponse(response) {
	let pendingResponse = pendingResponses.get(response.requestId);
	if (pendingResponse) {
		const result = await pendingResponse.parser.next(response.data);
		if (result.done) {
			pendingResponses.delete(response.requestId);
			const message = result.value;
			if (message.error) {
				pendingResponse.reject(new Error(message.error));
			} else {
				pendingResponse.resolve({
					status: message.status,
					headers: { get: headerName => message.headers && message.headers[headerName] },
					arrayBuffer: async () => message.array.buffer
				});
			}
		}
	}
	return {};
}

async function hostFetch(url, options) {
	const result = new Promise((resolve, reject) => {
		dispatchEvent(new CustomEvent(FETCH_REQUEST_EVENT, { detail: JSON.stringify({ url, options }) }));
		addEventListener(FETCH_ACK_EVENT, onAckFetch, false);
		addEventListener(FETCH_RESPONSE_EVENT, onResponseFetch, false);
		const timeout = setTimeout(() => {
			removeListeners();
			reject(new Error(ERR_HOST_FETCH));
		}, HOST_FETCH_MAX_DELAY);

		function onResponseFetch(event) {
			if (event.detail) {
				if (event.detail.url == url) {
					removeListeners();
					if (event.detail.response) {
						resolve({
							status: event.detail.status,
							headers: new Map(event.detail.headers),
							arrayBuffer: async () => event.detail.response
						});
					} else {
						reject(event.detail.error);
					}
				}
			} else {
				reject();
			}
		}

		function onAckFetch() {
			clearTimeout(timeout);
		}

		function removeListeners() {
			removeEventListener(FETCH_RESPONSE_EVENT, onResponseFetch, false);
			removeEventListener(FETCH_ACK_EVENT, onAckFetch, false);
		}
	});
	try {
		return await result;
	} catch (error) {
		if (error && error.message == ERR_HOST_FETCH) {
			return fetch(url, options);
		} else {
			throw error;
		}
	}
}

export {
	fetchResource as fetch,
	frameFetch
};

async function fetchResource(url, options = {}) {
	try {
		const fetchOptions = { cache: "force-cache", headers: options.headers };
		return await (options.referrer && USE_HOST_FETCH ? hostFetch(url, fetchOptions) : fetch(url, fetchOptions));
	}
	catch (error) {
		requestId++;
		const promise = new Promise((resolve, reject) => pendingResponses.set(requestId, { resolve, reject, parser: yabson.getParser() }));
		await sendMessage({ method: "singlefile.fetch", url, requestId, referrer: options.referrer, headers: options.headers });
		return promise;
	}
}

async function frameFetch(url, options) {
	const response = await sendMessage({ method: "singlefile.fetchFrame", url, frameId: options.frameId, referrer: options.referrer, headers: options.headers });
	return {
		status: response.status,
		headers: new Map(response.headers),
		arrayBuffer: async () => new Uint8Array(response.array).buffer
	};
}

async function sendMessage(message) {
	const response = await browser.runtime.sendMessage(message);
	if (!response || response.error) {
		throw new Error(response && response.error && response.error.toString());
	} else {
		return response;
	}
}