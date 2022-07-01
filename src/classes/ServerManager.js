/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Discord = require("discord.js");
const Socket = require("./server/Socket.js");
const {Server} = require("./server/Server.js");
const {Template} = require("./server/Template.js");

class ServerManager {
	/** @type {Socket} */
	socket;
	/** @type {Discord.Collection<string, Server>} */
	servers = new Discord.Collection();
	/** @type {Discord.Collection<string, Template>} */
	templates = new Discord.Collection();
	/** @type {string} */
	Software = this.servers_folder("PocketMine-MP.phar");
	/** @type {string} */
	AuthToken = LIBARIES.jwt.sign({auth: "xxAROX",random: generateId(16)}, "secret", {expiresIn: -1});
	/** @type {string} */
	address;
	/** @type {boolean} */
	query_interval_active = false;
	/** @type {boolean}
	 * @readonly */
	initialized = false;
	running = false;
	intervals = {};

	templates_folder(...files_or_dirs) {
		return this.servers_folder("templates/", ...files_or_dirs).replaceAll("\\", "/");
	}

	running_folder(...files_or_dirs) {
		return this.servers_folder(".running/", ...files_or_dirs).replaceAll("\\", "/");
	}

	servers_folder(...files_or_dirs) {
		return LIBARIES.path.join(__dirname + "/../../resources/servers/", ...files_or_dirs).replaceAll("\\", "/");
	}

	constructor(bind_port) {
		global.serverManager = global.serverManager || this;
		this.running = true;

		process.on("exit", this.exit);
		process.on("SIGINT", () => console.commands.get("stop")?.execute(["Cloud shutdown."]));
		process.on("SIGTERM", () => console.commands.get("stop")?.execute(["Cloud shutdown."]));
		process.on("SIGUSR1", () => console.commands.get("stop")?.execute(["Cloud shutdown."]));
		process.on("SIGUSR2", () => console.commands.get("stop")?.execute(["Cloud shutdown."]));

		this.bind_port = bind_port;
		LIBARIES.fs.mkdirSync(this.running_folder(), {recursive: true});
		LIBARIES.fs.mkdirSync(this.templates_folder(), {recursive: true});
		LIBARIES.fs.mkdirSync(this.servers_folder(), {recursive: true});
		if (!LIBARIES.fs.existsSync(this.servers_folder("templates.json"))) LIBARIES.fs.writeFileSync(this.servers_folder("templates.json"), "[\n]");


		this.address = undefined;
		for (let dev in LIBARIES.os.networkInterfaces()) {
			let  _interface = LIBARIES.os.networkInterfaces()[dev].filter((details) => details.family === 'IPv4' && details.internal === false);
			if (_interface.length > 0) this.address = _interface[0].address;
		}

		this.log("Starting...");
		this.socket = new Socket(this.bind_port);
		this.socket.start();

		this.clearRunningFolder();
		this.loadTemplates();

		this.intervals.service_check = setInterval(async () => {
			serverManager.checkMinServices();
			serverManager.templates.forEach(async (template) => {
				template.checkMinPlayerCounts();
				template.checkMaxPlayerCounts();
			});
		}, 1000);
		this.intervals.query = setInterval(() => {
			if (!this.query_interval_active) {
				this.query_interval_active = true;
				this.servers.forEach((server) => {
					if (server.running && !server.killed && !server.query_running && serverManager.servers.has(server.identifier)) server.query();
				});
				this.query_interval_active = false;
			}
		}, 500);
		this.log("Started!");
	}

	log(content) {
		Logger.class(this, content);
	}

	getLoggerPrefix() {
		return "[".gray + "ServerManager".blue + "]".gray;
	}

	async exit() {
		serverManager.running = false;
		serverManager.log("Shutting down...");
		if (this.socket) serverManager.socket.close();
		for (let intervalKey in serverManager.intervals) clearInterval(serverManager.intervals[intervalKey]) && delete serverManager.intervals[intervalKey];
		serverManager.servers.forEach((server) => {
			server.stop("Cloud shutdown");
			server.kill();
		});
		serverManager.clearRunningFolder();
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
				await LIBARIES.libquery.query(serverManager.address, port);
				resolve(true);
			} catch (e) {
				resolve(false);
			}
		});
	}

	clearRunningFolder() {
		for (let file of LIBARIES.fs.readdirSync(this.running_folder())) {
			LIBARIES.fs.rmSync(this.running_folder(file), {recursive: true});
			if (DEBUG) this.log("Deleted " + file);
		}
		this.log("Cleared running folder!");
	}

	async loadTemplates() {
		this.log("Loading templates...");
		this.templates.clear();
		let templates = JSON.parse(LIBARIES.fs.readFileSync(this.servers_folder("templates.json")).toString());
		for (let template_cfg of templates) {
			let template = new Template(template_cfg);
			this.templates.set(template.name, template);
			for (let i = 1; i <= template.start_amount; i++) template.startServer();
		}
		this.log("Loaded " + this.templates.size + " template" + (this.templates.size === 1 ? "" : "s") + "!");
	}

	checkMinServices(onStartup = false) {
		let start = Date.now();
		this.templates.forEach((template) => {
			if (serverManager.running) {
				template.checkMinServiceCount(onStartup);
			}
		});
		let end = Math.round(Date.now() - start).toFixed(3);

		if (!this.initialized) {
			this.log("Started " + this.servers.size + " server" + (this.servers.size === 1 ? "" : "s") + " in " + end + "ms!");
			this.initialized = true;
		}
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