/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Loggable = require("../classes/Loggable.js");

const LOG_LEVEL_NONE = "NONE";
const LOG_LEVEL_DEBUG = "DEBUG";
const LOG_LEVEL_ERROR = "ERROR";
const LOG_LEVEL_WARNING = "WARNING";
const LOG_LEVEL_SUCCESS = "SUCCESS";
const LOG_LEVEL_NOTICE = "NOTICE";
const LOG_LEVEL_HINT = "HINT";
const LOG_LEVEL_INFO = "INFO";

const __log = (level, content) => {
	let date = "[".gray + LIBRARIES.moment().format("HH:m:ss").yellow + "]".gray;
	let line = "[".gray + (TESTING ? "Development" : "Stable").magenta + "]".gray;
	let prefix = level.toUpperCase();
	switch (level.toUpperCase()) {
		case LOG_LEVEL_NONE: {
			prefix = "";
			content = content.gray;
			break;
		}
		case LOG_LEVEL_DEBUG: {
			if (!DEBUG) return;
			prefix = prefix.bgBrightMagenta.white;
			content = content.magenta;
			break;
		}
		case LOG_LEVEL_SUCCESS: {
			prefix = prefix.green;
			content = content.green;
			break;
		}
		case LOG_LEVEL_NOTICE: {
			prefix = prefix.cyan;
			content = content.cyan;
			break;
		}
		case LOG_LEVEL_HINT: {
			prefix = prefix.bgCyan.black;
			content = content.gray.italic;
			break;
		}
		case LOG_LEVEL_INFO: {
			prefix = prefix.white;
			content = content.gray;
			break;
		}
		case LOG_LEVEL_ERROR: {
			prefix = prefix.bgRed;
			content = content.red;
			break;
		}
		case LOG_LEVEL_WARNING: {
			prefix = prefix.bgYellow.black;
			content = content.yellow;
			break;
		}
	}
	console.log(date + "" + line + "" + (prefix !== "" ? "[".gray + prefix + "]".gray + ": " : "") + content);
};

module.exports.error = (e) => {
	console.error(e);
	__log(LOG_LEVEL_ERROR, e.message ? e.message : e);
};
module.exports.debug = (content) => {
	if (DEBUG) __log(LOG_LEVEL_DEBUG, content);
};
module.exports.warn = (content) => {
	__log(LOG_LEVEL_WARNING, content);
};
module.exports.notice = (content) => {
	__log(LOG_LEVEL_NOTICE, content);
};
module.exports.hint = (content) => {
	__log(LOG_LEVEL_HINT, content);
};
module.exports.info = (content) => {
	__log(LOG_LEVEL_INFO, content);
};
module.exports.blank = (content) => {
	__log(LOG_LEVEL_NONE, content);
};
/**
 * @param loggable_class
 * @param {string} content
 */
module.exports.class = (loggable_class, content) => {
	if (typeof loggable_class.getLoggerPrefix !== "function" || !loggable_class instanceof Loggable) return;
	__log(LOG_LEVEL_NONE, loggable_class.getLoggerPrefix() + ": " + content);
};
module.exports.success = (content) => {
	__log(LOG_LEVEL_SUCCESS, content);
};
