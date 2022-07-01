/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const {success} = require("./Logger");
const LOG_LEVEL_NONE = "NONE";
const LOG_LEVEL_DEBUG = "DEBUG";
const LOG_LEVEL_ERROR = "ERROR";
const LOG_LEVEL_WARNING = "WARNING";
const LOG_LEVEL_SUCCESS = "SUCCESS";
const LOG_LEVEL_NOTICE = "NOTICE";

const __log = (level, content) => {
	let date = "[".gray + LIBARIES.moment().format("HH:m:ss").yellow + "]".gray;
	let line = "[".gray + (TESTING ? "Development".bgCyan.magenta : "Stable".blue) + "]".gray;
	let prefix = level.toUpperCase();
	switch (level.toUpperCase()) {
		case LOG_LEVEL_NONE: {
			prefix = "";
			break;
		}
		case LOG_LEVEL_DEBUG: {
			if (!DEBUG) return;
			prefix = prefix.magentaBG.white;
			break;
		}
		case LOG_LEVEL_SUCCESS: {
			prefix = prefix.green;
			break;
		}
		case LOG_LEVEL_NOTICE: {
			prefix = prefix.cyan;
			break;
		}
		case LOG_LEVEL_ERROR: {
			prefix = prefix.bgRed;
			break;
		}
		case LOG_LEVEL_WARNING: {
			prefix = prefix.bgYellow.black;
			prefix = "W".yellow +
				"A".black +
				"R".yellow +
				"N".black +
				"I".yellow +
				"N".black +
				"G".yellow
			break;
		}
	}
	console.log(date + " " + line + " " + (prefix !== "" ? "[".gray + prefix + "] ".gray : "") + content);
};
module.exports.error = (e) => {
	__log(LOG_LEVEL_ERROR, e.message);
};
module.exports.debug = (content) => {
	__log(LOG_LEVEL_DEBUG, content);
};
module.exports.warn = (content) => {
	__log(LOG_LEVEL_WARNING, content);
};
module.exports.notice = (content) => {
	__log(LOG_LEVEL_NOTICE, content);
};
module.exports.blank = (content) => {
	__log(LOG_LEVEL_NONE, content);
};
module.exports.success = (content) => {
	__log(LOG_LEVEL_SUCCESS, content);
};
