/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

require("colors");
opt = require('node-getopt').create([
	['v' , 'version', 'Show version'],
])
.bindHelp()
.parseSystem();

if (opt.options.version === true) {
	console.log(PACKAGE.name + " v" + PACKAGE.version);
	return;
}

global.generateId = (length) => {
	let result           = '';
	let characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let charactersLength = characters.length;
	for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * charactersLength));
	return result;
}
global.eachOS= (win32, linux, darwin) => {
	if (process.platform === "win32" && typeof win32 === "function") return win32();
	else if (process.platform === "linux" && typeof linux === "function") return linux();
	else if (process.platform === "darwin" && typeof darwin === "function") return darwin();
	return undefined;
};

const {ServerManager, GameState, ServerState, ServerType, ServerVisibility} = require('./src/classes/ServerManager.js');
global.GameState = GameState;
global.ServerState = ServerState;
global.ServerType = ServerType;
global.ServerVisibility = ServerVisibility;

global.term = require("terminal-kit").terminal;
global.LIBARIES = {
	fs: require("fs"),
	fse: require("fs-extra"),
	discord: require("discord.js"),
	path: require("path"),
	dgram: require("dgram"),
	jwt: require("jsonwebtoken"),
	os: require("os"),
	child_process: require("child_process"),
	crypto: require("crypto"),
	libquery: require("libquery"),
	properties_reader: require("properties-reader"),
	promisify: require("util").promisify,
	moment: require("moment"),
};
global.PACKAGE = require("./package.json");
global.CONFIG = require("./resources/config.json");
global.CONFIG_PRIVATE = require("./resources/config_private.json");
global.TESTING = opt.argv.includes("dev");
global.DEBUG = opt.argv.includes("debug");
global.Logger = require("./src/utils/Logger.js");
Logger.success("success");
Logger.blank("blank");
Logger.warn("warn");
Logger.error("error");
Logger.debug("debug");
Logger.notice("notice");


console.commands = new (require("discord.js")).Collection();
console.command_aliases = new (require("discord.js")).Collection();
console.loadCommands = () => {
	if (console.commands.size > 0 || console.command_aliases.size > 0) {
		console.commands.clear();
		console.command_aliases.clear();
	}
	console.log("Loading commands...");
	for (const file of LIBARIES.fs.readdirSync(LIBARIES.path.join(__dirname, "src/commands/console"))) {
		if (file.endsWith(".js")) {
			const command = require(LIBARIES.path.join(__dirname, "src/commands/console", file));
			console.commands.set(command.name.toLowerCase(), command);
			if (command.aliases && command.aliases.length > 0) {
				for (const alias of command.aliases) {
					console.command_aliases.set(alias.toLowerCase(), command.name.toLowerCase());
				}
			}
		}
	}
	console.log("Loaded ".green + console.commands.size.toString().green + " command".green + (console.commands.size === 1 ? "" : "s").green + ".".green);
};
(() => (require('readline').createInterface({input:process.stdin,output:process.stdout})).on("line", (input) => {
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
			console.error("Command failed".red);
			console.error(e);
		}
	} else {
		console.log("Command '".red + input_command + "' not found!".red);
	}
	console.registerReadlineInterface = undefined;
}))();

console.loadCommands();

process.on("uncaughtException", (err) => Logger.error(err));

require("./src/index.js");
