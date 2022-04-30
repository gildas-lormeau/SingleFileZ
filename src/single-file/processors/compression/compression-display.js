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

/* global DOMParser */

export {
	display
};

async function display(document, docContent, { disableFramePointerEvents } = {}) {
	const DISABLED_NOSCRIPT_ATTRIBUTE_NAME = "data-single-filez-disabled-noscript";
	const doc = (new DOMParser()).parseFromString(docContent, "text/html");
	doc.querySelectorAll("noscript:not([" + DISABLED_NOSCRIPT_ATTRIBUTE_NAME + "])").forEach(element => {
		element.setAttribute(DISABLED_NOSCRIPT_ATTRIBUTE_NAME, element.innerHTML);
		element.textContent = "";
	});
	if (doc.doctype) {
		if (document.doctype) {
			document.replaceChild(doc.doctype, document.doctype);
		} else {
			document.insertBefore(doc.doctype, document.documentElement);
		}
	} else if (document.doctype) {
		document.doctype.remove();
	}
	if (disableFramePointerEvents) {
		doc.querySelectorAll("iframe").forEach(element => {
			const pointerEvents = "pointer-events";
			element.style.setProperty("-sf-" + pointerEvents, element.style.getPropertyValue(pointerEvents), element.style.getPropertyPriority(pointerEvents));
			element.style.setProperty(pointerEvents, "none", "important");
		});
	}
	document.replaceChild(document.importNode(doc.documentElement, true), document.documentElement);
	document.documentElement.setAttribute("data-sfz", "");
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
}
