/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Discord = require("discord.js");
const Socket = require("./server/Socket.js");
const {Server} = require("./server/Server.js");
const {Template} = require("./server/Template.js");
const Proxy = require("./server/Proxy.js");

class ServerManager {
	/** @type {string} */
	Software_Version = "4.5.2";
	/** @type {string} */
	Proxy_Version = "1.1.8";
	/** @type {Socket} */
	socket;
	/** @type {Discord.Collection<string, Server>} */
	servers = new Discord.Collection();
	/** @type {Discord.Collection<string, Template>} */
	templates = new Discord.Collection();
	/** @type {string} */
	Software = this.servers_folder("server", "PocketMine-MP.phar");
	/** @type {string} */
	AuthToken = LIBRARIES.jwt.sign({auth: "xxAROX",random: generateId(16)}, "secret", {expiresIn: -1});
	/** @type {string} */
	address;
	/** @type {boolean} */
	query_interval_active = false;
	/** @type {boolean}
	 * @readonly */
	initialized = false;
	waiting = false;
	running = false;
	intervals = {};
	/** @type {Proxy} */
	#proxy = null;

	resources_folder(...files_or_dirs) {
		return LIBRARIES.path.join(__dirname + "/../../resources/", ...files_or_dirs).replaceAll("\\", "/");
	}

	templates_folder(...files_or_dirs) {
		return this.servers_folder("templates/", ...files_or_dirs).replaceAll("\\", "/");
	}

	running_folder(...files_or_dirs) {
		return this.servers_folder(".running/", ...files_or_dirs).replaceAll("\\", "/");
	}

	servers_folder(...files_or_dirs) {
		return this.resources_folder("servers", ...files_or_dirs).replaceAll("\\", "/");
	}

	/**
	 * @param {boolean} force_download
	 */
	downloadSoftware(force_download = false) {
		throw new Error("Not implemented yet.");
		if (LIBRARIES.fs.existsSync(this.Software) && !force_download) return;
		this.running = false;
		this.waiting = true;
		Logger.notice("Downloading software..");
		let cmd = "cd resources/servers/server/ && wget https://github.com/pmmp/PocketMine-MP/releases/download/" + this.Software_Version + "/PocketMine-MP.phar";
		Utils.download(
			"https://github.com/pmmp/PocketMine-MP/releases/download/" + this.Software_Version + "/PocketMine-MP.phar",
			this.Software
		).then(file => {
			Logger.success("Software downloaded.");
			this.running = true;
			this.waiting = false;
		});
	}

	constructor(bind_port) {
		global.serverManager = global.serverManager || this;
		this.waiting = false;
		this.running = true;
		let can_start = true;

		process.on("exit", this.exit);
		process.on("SIGINT", () => console.commands.get("stop")?.execute(["Cloud shutdown."]));
		process.on("SIGTERM", () => console.commands.get("stop")?.execute(["Cloud shutdown."]));
		process.on("SIGUSR1", () => console.commands.get("stop")?.execute(["Cloud shutdown."]));
		process.on("SIGUSR2", () => console.commands.get("stop")?.execute(["Cloud shutdown."]));

		for (let folder of [
			this.resources_folder(), this.running_folder(), this.templates_folder(),
			this.servers_folder(), this.servers_folder("server"),
			this.servers_folder("server", "plugins"),
			this.servers_folder("server", "plugin_data"),
			this.servers_folder("server", "worlds"),
		]) if (!LIBRARIES.fs.existsSync(folder)) LIBRARIES.fs.mkdirSync(folder);

		if (!LIBRARIES.fs.existsSync(this.Software)) {
			can_start = false;
			Logger.error("Software not found in '" + this.Software + "'");
			Logger.hint(" => " + ("https://github.com/pmmp/PocketMine-MP/releases/download/" + this.Software_Version + "/PocketMine-MP.phar").underline.bold.blue);
		}

		this.bind_port = bind_port;
		if (!LIBRARIES.fs.existsSync(this.servers_folder("templates.json"))) LIBRARIES.fs.writeFileSync(this.servers_folder("templates.json"), "[\n\t\n]");


		this.address = undefined;
		for (let dev in LIBRARIES.os.networkInterfaces()) {
			let  _interface = LIBRARIES.os.networkInterfaces()[dev].filter((details) => details.family === 'IPv4' && details.internal === false);
			if (_interface.length > 0) this.address = _interface[0].address;
		}
		this.#proxy = new Proxy();
		can_start = this.#proxy.init();
		if (!can_start) process.exit(1);

		this.log("Starting..");
		this.socket = new Socket(this.bind_port);
		this.socket.start();

		this.clearDockerContainers();
		this.#proxy.start().then(() => this.loadTemplates());

		this.intervals.service_check = setInterval(async () => {
			if (this.waiting) return;
			serverManager.checkMinServices();
			serverManager.templates.forEach(async (template) => {
				template.checkMinPlayerCounts();
				template.checkMaxPlayerCounts();
			});
		}, 1000);
		this.intervals.query = setInterval(() => {
			if (this.waiting) return;
			if (!this.query_interval_active) {
				this.query_interval_active = true;

				if (this.#proxy.running) this.#proxy.query();
				this.servers.forEach(async (server) => {
					if (server.running && !server.killed && !server.query_running && serverManager.servers.has(server.identifier)) {
						server.query_running = true;
						await server.query();
						server.query_running = false;
					}
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

	get proxy() {
		return this.#proxy;
	}

	async beforeExit() {
		serverManager.log("Shutting down..");
		cloudflareManager.store();
		console.log(this.proxy.running);
		if (this.proxy.running) await this.proxy.stop();
		for (let intervalKey in serverManager.intervals) clearInterval(serverManager.intervals[intervalKey]) && delete serverManager.intervals[intervalKey];
		serverManager.servers.forEach((server) => {
			server.stop("Cloud shutdown");
			server.kill();
		});
	}

	async exit() {
		this.beforeExit();
		serverManager.running = false;
		if (this.socket) serverManager.socket.close();
		serverManager.clearDockerContainers();
		if (TESTING) wtf.dump();
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
				resolve(await LIBRARIES.mcquery.query(serverManager.address, port).online !== undefined);
			} catch (e) {
				resolve(false);
			}
		});
	}

	clearRunningFolder() {
		for (let file of LIBRARIES.fs.readdirSync(this.running_folder())) {
			LIBRARIES.fs.rmSync(this.running_folder(file), {recursive: true});
			if (DEBUG) this.log("Deleted " + file);
		}
		this.log("Cleared running folder!");
	}

	async clearDockerContainers() {
		await LIBRARIES.docker.listContainers({all: true}, async (err, containers) => {
			containers.forEach(async (containerInfo) => {
				if (!containerInfo.Command.includes("PocketMine-MP.phar")) return;
				let container = LIBRARIES.docker.getContainer(containerInfo.Id);

				if (container.State === "running") await container.stop();
				setTimeout(async () => { // kills the container after a while
					if (await container.State === "running") await container.kill();
				});
				container.remove({force: true});
				this.log("Deleted container " + container.id);
			});
			this.clearRunningFolder();
			this.log("Cleared Docker containers!");
		});
	}

	async loadTemplates() {
		this.log("Loading templates..");
		this.templates.clear();
		let templates = JSON.parse(LIBRARIES.fs.readFileSync(this.servers_folder("templates.json")).toString());
		for (let template_cfg of templates) {
			let template = new Template(template_cfg);
			this.templates.set(template.name, template);
			for (let i = 1; i <= template.start_amount; i++) template.startServer();
		}
		this.log("Loaded " + this.templates.size + " template" + (this.templates.size === 1 ? "" : "s") + "!");
	}

	checkMinServices(onStartup = false) {
		if (this.waiting) return;
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
