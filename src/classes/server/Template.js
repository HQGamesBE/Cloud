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

	folder;

	/**
	 * @param {boolean} enabled
	 * @param {string} name
	 * @param {string} display_name
	 * @param {string} type
	 * @param {boolean} maintained
	 * @param {null|string} image
	 */
	constructor({ enabled, name, display_name, type, maintained, image }) {
		this.enabled = enabled;
		this.name = name;
		if (!LIBARIES.fs.existsSync(serverManager.templates_folder(name.toLowerCase()))) {
			if (LIBARIES.fs.existsSync(serverManager.templates_folder(name))) {
				LIBARIES.fs.renameSync(serverManager.templates_folder(name), serverManager.templates_folder(name.toLowerCase()));
			} else {
				LIBARIES.fs.mkdirSync(serverManager.templates_folder(name.toLowerCase()), { recursive: true });
				LIBARIES.fs.mkdirSync(serverManager.templates_folder(name.toLowerCase()) + "/worlds", { recursive: true });
				LIBARIES.fs.mkdirSync(serverManager.templates_folder(name.toLowerCase()) + "/plugins", { recursive: true });
				LIBARIES.fs.mkdirSync(serverManager.templates_folder(name.toLowerCase()) + "/plugin_data", { recursive: true });
				console.log(`Created template folder for ${name}`);
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
		if (!LIBARIES.fs.existsSync(serverManager.Software)) {
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
}
module.exports.Template = Template;
