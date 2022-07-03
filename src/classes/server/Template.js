/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const {Server} = require("./Server");
const {SnowflakeUtil} = require("discord.js");
/**
 * Class Template
 * @author Jan Sohn / xxAROX
 * @date 21.06.2022 - 13:21
 * @project Cloud
 */
class Template {
	enabled;
	name;
	display_name;
	type;
	maintained;
	image;
	/** @readonly */
	start_amount;
	max_players;
	player_minimum_percent;
	player_maximum_percent;

	folder;

	/**
	 * @param {boolean} enabled
	 * @param {string} name
	 * @param {string} display_name
	 * @param {string} type
	 * @param {boolean} maintained
	 * @param {null|string} image
	 * @param {null|int} start_amount
	 * @param {null|int} max_players
	 * @param {null|int} player_minimum_percent
	 * @param {null|int} player_maximum_percent
	 */
	constructor({ enabled, name, display_name, type, maintained, image, start_amount, max_players, player_minimum_percent, player_maximum_percent }) {
		if (!name) throw new Error("name is not defined in templates.json");
		this.enabled = enabled;
		this.name = name;
		this.start_amount = start_amount || 1;
		this.max_players = max_players || 100;
		this.player_minimum_percent = player_minimum_percent || 0;
		this.player_maximum_percent = player_maximum_percent || 90;

		if (!LIBRARIES.fs.existsSync(serverManager.templates_folder(name.toLowerCase()))) {
			if (LIBRARIES.fs.existsSync(serverManager.templates_folder(name))) {
				LIBRARIES.fs.renameSync(serverManager.templates_folder(name), serverManager.templates_folder(name.toLowerCase()));
			} else {
				LIBRARIES.fs.mkdirSync(serverManager.templates_folder(name.toLowerCase()), { recursive: true });
				LIBRARIES.fs.mkdirSync(serverManager.templates_folder(name.toLowerCase()) + "/worlds", { recursive: true });
				LIBRARIES.fs.mkdirSync(serverManager.templates_folder(name.toLowerCase()) + "/plugins", { recursive: true });
				LIBRARIES.fs.mkdirSync(serverManager.templates_folder(name.toLowerCase()) + "/plugin_data", { recursive: true });
				Logger.debug(`Created template folder for ${name}`);
			}
		}
		this.folder = (...file_or_dirs) => serverManager.templates_folder(name.toLowerCase(), ...file_or_dirs);
		this.display_name = display_name;
		this.type = type;
		this.maintained = maintained;
		this.image = image;
	}

	/**
	 * @return {null|Server}
	 */
	async #bootServer() {
		if (!this.enabled) {
			return null;
		}
		if (!LIBRARIES.fs.existsSync(serverManager.Binary)) {
			serverManager.downloadBinaries(true);
			throw new Error("Could not find the php binary in '" + serverManager.Binary + "'!");
		}
		if (!LIBRARIES.fs.existsSync(serverManager.Software)) {
			serverManager.downloadSoftware(true);
			throw new Error(`Software folder not found at ${serverManager.Software}`);
		}
		let server = new Server(this, SnowflakeUtil.generate(Date.now()).toString(), serverManager.randomPort());
		server.createFiles();
		server.boot();
		serverManager.servers.set(server.identifier, server);
		return server;
	}

	/**
	 * @return {null|Server}
	 */
	startServer() {
		let server = this.#bootServer();
		return server;
	}

	/**
	 * @param {(Server) => boolean} filter
	 * @return {LIBRARIES.discord.Collection<string, Server>|Map<string, Server>}
	 */
	getServers(filter = () => true) {
		return serverManager.servers.filter((server) => server.template.name === this.name && filter);
	}

	getTotalMaxPlayersFromTemplatesRunningServers() {
		return this.getServers().size * this.max_players;
	}

	getTotalOnlinePlayersFromTemplatesRunningServers() {
		let total = 0;
		this.getServers().forEach((server) => {
			if (server.createdAt +(1000 * 10) < Date.now()) total += server.player_count;
		})
		return total;
	}

	checkMinServiceCount() {
		if (serverManager.waiting) return;
		let current = this.getServers().size;
		if (current < this.start_amount) {
			for (let i = current; i < this.start_amount; i++) {
				this.startServer();
			}
		}
	}

	checkMaxPlayerCounts() {
		let max = this.getTotalMaxPlayersFromTemplatesRunningServers();
		let online_players = this.getTotalOnlinePlayersFromTemplatesRunningServers();

		if (max > 0) {
			if ((100 /max *online_players) < this.player_maximum_percent) {
				this.stopEmptyServers();
			}
		}
	}

	checkMinPlayerCounts() {
		let max = this.getTotalMaxPlayersFromTemplatesRunningServers();
		let online_players = this.getTotalOnlinePlayersFromTemplatesRunningServers();

		if (max > 0) {
			let percent = (100 /max *online_players);
			Logger.debug("Online players: " + percent + "% / " + this.player_minimum_percent + "%");
			if (percent < this.player_minimum_percent) {
				this.stopEmptyServers();
			}
		}
	}

	stopEmptyServers() {
		for (let server of Array.from(this.getServers()).reverse()) {
			if (this.getServers().size <= this.start_amount) return;
			if (server.player_count === 0 && server.created +(1000 *60 *10) < Date.now()) {
				server.stop("No players");
			}
		}
	}
}
module.exports.Template = Template;
