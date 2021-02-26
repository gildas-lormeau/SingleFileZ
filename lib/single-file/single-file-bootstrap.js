import * as frameTree from "./processors/frame-tree/content/content-frame-tree.js";
import {
	ON_BEFORE_CAPTURE_EVENT_NAME,
	ON_AFTER_CAPTURE_EVENT_NAME,
	waitForUserScript,
	preProcessDoc,
	postProcessDoc,
	serialize
} from "./single-file-helper.js";

const processors = { frameTree };
const helper = {
	ON_BEFORE_CAPTURE_EVENT_NAME,
	ON_AFTER_CAPTURE_EVENT_NAME,
	waitForUserScript,
	preProcessDoc,
	postProcessDoc,
	serialize
};

export {
	helper,
	processors
};