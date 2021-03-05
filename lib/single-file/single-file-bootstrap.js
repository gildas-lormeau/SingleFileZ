import * as frameTree from "./processors/frame-tree/content/content-frame-tree.js";
import * as serializer from "./modules/html-serializer.js";
import {
	ON_BEFORE_CAPTURE_EVENT_NAME,
	ON_AFTER_CAPTURE_EVENT_NAME,
	initUserScriptHandler,
	preProcessDoc,
	postProcessDoc
} from "./single-file-helper.js";

const processors = { frameTree };
const helper = {
	ON_BEFORE_CAPTURE_EVENT_NAME,
	ON_AFTER_CAPTURE_EVENT_NAME,
	preProcessDoc,
	postProcessDoc,
	serialize(doc, compressHTML) {
		return serializer.process(doc, compressHTML);
	}
};

initUserScriptHandler();

export {
	helper,
	processors
};