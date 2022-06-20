require("colors");
opt = require('node-getopt').create([
	['v' , '', 'Show version']
])
.bindHelp()
.parseSystem();

global.LIBARIES = {
	fs: require("fs"),
	discord: require("discord.js"),
	path: require("path"),
};
global.PACKAGE = require("./package.json");
global.CONFIG = require("./resources/config.json");
global.TESTING = opt.argv.includes("dev");
global.DEBUG = opt.argv.includes("debug");

if (opt.options.v === true) {
	console.log(PACKAGE.name + " v" + PACKAGE.version);
	return;
}
if (DEBUG) console.log("Debug Mode".black.bgWhite);
if (!TESTING) console.log("Stable Mode".green);
else console.log("Developer Mode".bgCyan);

require("./src/index.js");