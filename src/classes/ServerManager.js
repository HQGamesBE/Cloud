/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Discord = require("discord.js");
const {SSocket} = require("./server/Socket.js");
const {Server} = require("./server/Server.js");
const {Template} = require("./server/Template.js");

class ServerManager {
	/** @type {Socket} */
	server;
	/** @type {Discord.Collection<string, Server>} */
	servers = new Discord.Collection();
	/** @type {Discord.Collection<string, Template>} */
	templates = new Discord.Collection();
	/** @type {string} */
	Software = this.servers_folder("PocketMine-MP.phar");
	/** @type {string} */
	AuthToken = LIBARIES.jwt.sign({auth: "X_X_A_R_O_X",random: generateId(16)}, "secret", {expiresIn: -1});
	/** @type {string} */
	address;
	/** @type {boolean} */
	query_interval_active = false;

	templates_folder(...files_or_dirs) {
		return this.servers_folder("templates", ...files_or_dirs);
	}

	running_folder(...files_or_dirs) {
		return this.servers_folder(".running", ...files_or_dirs);
	}

	servers_folder(...files_or_dirs) {
		return LIB.path.join(__dirname + "/../../../resources/servers/", ...files_or_dirs);
	}

	randomPort() {
		let ports = [];
		for (let server of this.servers.values()) {
			ports.push(server.port);
		}
		let port = Math.floor(Math.random() * (65535 - 1024)) + 1024;
		while (ports.includes(port) && this.checkPortIfUsed(port)) {
			port = Math.floor(Math.random() * (65535 - 1024)) + 1024;
		}
		return port;
	}

	async checkPortIfUsed(port) {
		return new Promise(async (resolve, reject) => {
			try {
				await LIB.libquery.query(serverManager.address, port);
				resolve(true);
			} catch (e) {
				resolve(false);
			}
		});
	}

	constructor(bind_port) {
		global.serverManager = global.serverManager || this;
		this.bind_port = bind_port;

		this.address = undefined;
		for (let dev in LIB.os.networkInterfaces()) {
			let  _interface = LIB.os.networkInterfaces()[dev].filter((details) => details.family === 'IPv4' && details.internal === false);
			if (_interface.length > 0) this.address = _interface[0].address;
		}

		console.log("[ServerManager] ".blue + "Starting...");
		this.server = new SSocket(this.bind_port);
		this.server.start();
		process.on("exit", () => {
			console.log("[ServerManager] ".blue + "Shutting down...");
			this.server.close();
			if (this.query_interval) clearInterval(this.query_interval);
			this.servers.forEach((server) => {
				server.stop();
				server.kill();
			});
			this.clearRunningFolder();
			console.log("[ServerManager] ".blue + "Shutdown.");
			console.log("Written by ".bgBlue.cyan + "xxAROX".underline.bgBlue);
		});
		this.clearRunningFolder();
		this.loadTemplates();
		this.query_interval = setInterval(() => {
			if (!this.query_interval_active) {
				this.query_interval_active = true;
				this.servers.forEach((server) => {
					if (server.running && !server.killed && !server.query_running && serverManager.servers.has(server.identifier)) {
						server.query();
					}
				});
				this.query_interval_active = false;
			}
		}, 1000);
		console.log("[ServerManager] ".blue + " Started!");
	}

	clearRunningFolder() {
		for (let file of LIB.fs.readdirSync(this.running_folder())) {
			LIB.fs.rmSync(this.running_folder(file), {recursive: true});
			if (DEBUG_MODE) console.log("[ServerManager] ".blue + "Deleted " + file);
		}
		console.log("[ServerManager] ".blue + "Cleared running folder!");
	}

	async loadTemplates() {
		console.log("[ServerManager] ".blue + "Loading templates...");
		this.templates.clear();
		let templates = JSON.parse(LIB.fs.readFileSync(this.servers_folder("templates.json")).toString());
		for (let template of templates) {
			this.templates.set(template.name, template = new Template(template));
		}
		this.templates.forEach((template) => {
			if (template.type !== ServerType.game) {
				template.startServer();
			}
		});
		console.log("[ServerManager] ".blue + "Loaded " + this.templates.size + " template" + (this.templates.size === 1 ? "" : "s") + "!");
	}
}
class ServerType {
	static lobby = "Lobby";
	static game = "Game";
	static builder = "Builder";
	static developer = "Developer";
}
class GameState {
	static lobby = "Lobby";
	static starting = "Starting";
	static running = "Running";
	static ending = "Ending";
}
class ServerState {
	static offline = "Offline";
	static starting = "Starting";
	static online = "Online";
}
class ServerVisibility {
	static public = "Public";
	static private = "Private";
}
module.exports.ServerManager = ServerManager;
module.exports.ServerType = ServerType;
module.exports.GameState = GameState;
module.exports.ServerState = ServerState;
module.exports.ServerVisibility = ServerVisibility;