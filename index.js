/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don"t want anyone to use my source code without permission.
 */

require("colors");
opt = require("node-getopt").create([
	["v" , "version", "Show version"],
])
.bindHelp()
.parseSystem();

if (opt.options.version === true) {
	console.log(PACKAGE.name + " v" + PACKAGE.version);
	return;
}

global.generateId = (length) => {
	let result           = "";
	let characters       = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let charactersLength = characters.length;
	for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * charactersLength));
	return result;
}
global.eachOS= (win32, linux, darwin) => {
	if (process.platform === "win32" && typeof win32 === "function") return win32();
	else if (process.platform === "linux" && typeof linux === "function") return linux();
	else if (process.platform === "darwin" && typeof darwin === "function") return darwin();
	throw new Error("Your operating system is not supported!") && process.exit(1);
};

const Loggable = require("./src/classes/Loggable");
const {ServerManager, GameState, ServerState, ServerType, ServerVisibility} = require("./src/classes/ServerManager.js");
global.GameState = GameState;
global.ServerState = ServerState;
global.ServerType = ServerType;
global.ServerVisibility = ServerVisibility;

global.term = require("terminal-kit").terminal;
term.windowTitle("Cloud by xxAROX#9881");
// TODO
term.on("key", function (key, matches, data) {
	switch (key) {
		case "UP" :term.up(1);break;
		case "DOWN" :term.down(1);break;
		case "LEFT" :term.left(1);break;
		case "RIGHT" :term.right(1);break;
		default:term.noFormat(Buffer.isBuffer(data.code) ? data.code : String.fromCharCode(data.code));break;
	}
});

global.YAML = {parse: require("yaml").parse, stringify: require("yaml").stringify};
global.PACKAGE = require("./package.json");
global.CONFIG = require("./resources/config.json");
global.CONFIG_PRIVATE = require("./resources/config_private.json");
global.TESTING = opt.argv.includes("dev");
global.DEBUG = opt.argv.includes("debug");
global.Utils = require("./src/utils/utils.js");
global.Logger = require("./src/utils/Logger.js");
global.LIBRARIES = {
	fs: require("fs"),
	fse: require("fs-extra"),
	tarfs: require("tar-fs"),
	discord: require("discord.js"),
	path: require("path"),
	dgram: require("dgram"),
	jwt: require("jsonwebtoken"),
	os: require("os"),
	child_process: require("child_process"),
	crypto: require("crypto"),
	properties_reader: require("properties-reader"),
	util: require("util"),
	moment: require("moment"),
	https: require("https"),
	cloudflare: require("cloudflare")({token: CONFIG_PRIVATE.cloudflare_token}),
	AdmZip: require("adm-zip"),
	bedrock: require("bedrock-protocol"),
	mcquery: require("./src/lib/mcbequery"),
};
global.wtf = TESTING ? require("wtfnode") : undefined;
global.PROMISED_FUNCTIONS = {
	exec: LIBRARIES.util.promisify(LIBRARIES.child_process.exec),
};


console.commands = new (require("discord.js")).Collection();
console.command_aliases = new (require("discord.js")).Collection();
console.loadCommands = () => {
	if (console.commands.size > 0 || console.command_aliases.size > 0) {
		console.commands.clear();
		console.command_aliases.clear();
	}
	Logger.info("Loading commands..");
	for (const file of LIBRARIES.fs.readdirSync(LIBRARIES.path.join(__dirname, "src/commands/console"))) {
		if (file.endsWith(".js")) {
			const command = require(LIBRARIES.path.join(__dirname, "src/commands/console", file));
			console.commands.set(command.name.toLowerCase(), command);
			if (command.aliases && command.aliases.length > 0) {
				for (const alias of command.aliases) {
					console.command_aliases.set(alias.toLowerCase(), command.name.toLowerCase());
				}
			}
		}
	}
	Logger.info("Loaded ".green + console.commands.size.toString().green + " command".green + (console.commands.size === 1 ? "" : "s").green + ".".green);
};
(() => (require("readline").createInterface({input:process.stdin,output:process.stdout})).on("line", (input) => {
	let args = input.split(" ");
	let input_command = args.shift();
	let command = console.commands.get(input_command.toLowerCase());
	if (!command) command = console.commands.get(console.command_aliases.get(input_command.toLowerCase()));

	if (command) {
		try {
			if (command && command.execute) {
				command.execute(args);
			}
		} catch (e) {
			Logger.error("Command failed".red);
			Logger.error(e);
		}
	} else {
		Logger.info("Command '".red + input_command + "' not found!".red);
	}
	console.registerReadlineInterface = undefined;
}))();

console.loadCommands();

process.on("uncaughtException", (err) => {
	Logger.error(err);
});

require("./src/index.js");
