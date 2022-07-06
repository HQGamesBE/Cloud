/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
class Server {
	static QUERY_TIMEOUT = 3500;

	container = undefined;

	query_running = false;
	created = -1;
	timed_out = false;
	query_fails = 0;
	public_visibility = ServerVisibility.private;
	online_state = ServerState.offline;
	backend_properties = {
		AuthToken: serverManager.AuthToken,
		backend_address: "127.0.0.1", //not needed, because no nodes are used
		backend_port: serverManager.socket?.bind_port,
	};

	player_count = 0;
	running = false;
	killed = false;

	/**
	 * @param {Template} template
	 * @param {string} identifier
	 * @param {number} port
	 */
	constructor(template, identifier, port) {
		this.created = Date.now();
		this.template = template;
		this.identifier = identifier;
		this.port = port;
		this.folder = (...file_or_dirs) => serverManager.running_folder(identifier, ...file_or_dirs);
		this.backend_properties.identifier = identifier;
		this.backend_properties.template = template.name;
		this.backend_properties.display_name = template.display_name;
		this.backend_properties.image = template.image;
	}

	log(content) {
		Logger.class(this, content);
	}

	getLoggerPrefix() {
		return "[".gray + "Server".green + "]".gray + "[".gray + this.identifier.toString().cyan + "]".gray;
	}

	async query() {
		if (!this.running) return;
		if (this.killed) return;
		if (this.timed_out) return;
		let online = false;

		try {
			let data = await LIBRARIES.mcquery.query(eachOS(() => "127.0.0.1", () => "0.0.0.0", () => "0.0.0.0"), this.port, Server.QUERY_TIMEOUT);
			this.player_count = data.online || 0;
			online = data.online !== undefined && !this.timed_out && this.running && !this.killed;
		} catch (err) {
		}

		if (!online) {
			if (this.query_fails >= 3) this.timeout();
			else this.query_fails++;
		} else {
			this.query_fails = 0;
			this.online_state = ServerState.online;
		}
		return online;
	}

	timeout() {
		this.online_state = ServerState.offline;
		this.timed_out = true;
		this.query_fails = 0;
		this.query_running = false;
		this.player_count = 404;
		this.stop("Server timed out");
	}

	async #createFiles() {
		this.online_state = ServerState.starting;

		if (!LIBRARIES.fs.existsSync(this.folder()))
			LIBRARIES.fs.mkdirSync(this.folder(), {recursive: true});

		// NOTE: backend.json
		(() => {
			LIBRARIES.fs.writeFileSync(this.folder("backend.json"), JSON.stringify(this.backend_properties, null, 4));
		})();

		// NOTE: server.properties
		(() => {
			LIBRARIES.fs.writeFileSync(this.folder("server.properties"), "#Properties Config file\n" +
				"language=eng\n" +
				"motd=" + this.template.display_name  +"\n" +
				"server-id=" + this.identifier + "\n" +
				"server-port=" + this.port  +"\n" +
				"server-portv6=" + this.port  +"\n" +
				"enable-ipv6=off\n" +
				"white-list=off\n" +
				"max-players=100\n" +
				"gamemode=adventure\n" +
				"force-gamemode=on\n" +
				"hardcore=off\n" +
				"pvp=on\n" +
				"difficulty=0\n" +
				"generator-settings=\n" +
				"level-name=world\n" +
				"level-seed=\n" +
				"level-type=DEFAULT\n" +
				"enable-query=on\n" +
				"auto-save=on\n" +
				"view-distance=16\n" +
				"xbox-auth=off\n"
			);
		})();

		// NOTE: [pocketmine.yml, ops.txt, plugins, plugin_data, worlds] folders
		(() => {
			let files = [ "pocketmine.yml", "ops.txt", "PocketMine-MP.phar" ];
			let directories = [ "plugins", "plugin_data", "worlds" ];

			if (LIBRARIES.fs.existsSync(serverManager.templates_folder(this.template.name.toLowerCase()))) // NOTE: get templates from templates folder
				LIBRARIES.fs.cpSync(serverManager.templates_folder(this.template.name.toLowerCase()), this.folder(), {recursive: true});

			for (let file of files) { // NOTE: copy files from global-server-template folder
				if (LIBRARIES.fs.existsSync(serverManager.servers_folder("server", file)))
					LIBRARIES.fs.cpSync(serverManager.servers_folder("server", file), this.folder(file), {recursive: true});
			}
			for (let directory of directories) { // NOTE: copy directories from global-server-template folder
				if (LIBRARIES.fs.existsSync(serverManager.servers_folder("server", directory)))
					LIBRARIES.fs.cpSync(serverManager.servers_folder("server", directory), this.folder(directory), {recursive: true});
			}
		})();
		this.log("Created files");
	}

	async #createContainer() {
		this.#createFiles();
		this.log("Creating container");

		let paths = {};
		if (LIBRARIES.fs.existsSync(this.folder()))
			paths[this.folder()] = "/home/server/";

		let containerInfo = await LIBRARIES.docker.createContainer({
			Image: 'ubuntu',
			Cmd: ["tmux", "new-session", "-d", "-s", "server", "/usr/php/bin/php", "/home/server/PocketMine-MP.phar" + (TESTING ? " --test" : "") + " --no-wizard" + (DEBUG ? " --debug" : "") ],
			name: this.identifier.toString(),
			workingDir: "/home/server/",
			HostConfig: {
				Binds: [`${this.folder()}:/home/server`],
			},
			Tty: true,
		}, undefined)
		.catch(err => {
			this.log("Error creating container: " + err.message);
			this.stop("Error creating container");
		});
		if (!containerInfo) throw new Error("Error while creating container");
		this.container = LIBRARIES.docker.getContainer(containerInfo.id);
		this.container.attach({stream: true, stdout: true, stderr: true}, function (err, stream) {
			stream.pipe(process.stdout);
		}.bind(this));
	}

	async boot() {
		this.log("Starting..");
		if (!this.container) await this.#createContainer();
		if (!this.container) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not create container!");

		this.container.start();

		/*new Promise(async (resolve, reject) => {
			let interval_running = false;
			let check = setInterval(async () => {
				if (interval_running) return;
				interval_running = true;
				let exec = this.executeCommandInContainer("-f /home/server/" + this.identifier + "/server.lock && echo \"y\"")
				exec.start({hijack: true, stdin: true},
					(err, stream) => {
						stream.on("data", (data) => {
							console.log(data);
							if (data.toString().trim() === "y") {
								clearInterval(check);
								resolve();
							} else {
								interval_running = false;
							}
						}).on("error", (err) => {
							this.log("Error: " + err.message);
							this.stop("Error: " + err.message);
						});
					}
				);
			});
			let timeout = setTimeout(() => {
				clearInterval(check);
				throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not start server!");
			}, 1000);
		}).then(() => {
			this.log("Server started");
			this.online_state = ServerState.online;
			this.running = true;
			this.afterStart();
		})
		.catch(error => {
			Logger.error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not start the server, because " + error.message);
		});*/
		setTimeout(() => {
			this.log("Server started");
			this.online_state = ServerState.online;
			this.running = true;
			this.afterStart();
		}, 1000);
	}

	afterStart() {
		serverManager.proxy.executeCommand("servermanager remove " + this.identifier);
		serverManager.proxy.executeCommand("servermanager add " + this.identifier + " 127.0.0.1:" + this.port);
		this.log("Container-ID: " + this.container.id + " | Started on port " + this.port.toString().bgYellow.black);
	}

	async executeCommandInContainer(command) {
		if (!this.container) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not execute command, because the container is not running!");
		return await this.container.exec({
			Cmd: ['/bin/bash', '-c', command],
			AttachStdout: true,
			AttachStderr: true,
			Tty: true,
		}, undefined);
	}

	async executeCommand(command) {
		if (!this.running) return undefined;
		if (command.startsWith("/")) command = command.substring(1);
		this.container.exec({Cmd:["tmux send -t '" + this.identifier + "' '" + command + "' ENTER" ]});
	}

	stop(reason) {
		if (!this.running) return;
		if (!this.container) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not stop the server, because it is not running!");
		this.container.stop();
		if (serverManager.proxy) serverManager.proxy.executeCommand("servermanager remove " + this.identifier);
		let timeout = setTimeout(() => this.kill() && this.deleteFiles(), 1000 * 7);
		let done = this.executeCommand(reason ? "stop " + reason : "stop").then(() => clearTimeout(timeout) && this.deleteFiles());
		this.running = false;
		serverManager.servers.delete(this.identifier);
		this.log("Server stopped with reason: " + reason);
	}

	kill() {
		if (!this.container) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not kill the server, because it is not running!");
		if (this.killed) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not kill the server, because it is already killed!");
		this.log("Killing server..");
		this.container.exec({Cmd:[ "-c", "tmux", "kill-session", "-t", this.identifier ]});
		console.log("killed");
		this.container.kill();
		this.running = false;
		this.killed = true;
		this.log("Server killed!");
	}

	deleteFiles() {
		if (!this.container) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not delete the files, because it is not running!");
		this.log("Deleting files..");
		this.container.remove({force: true});

		LIBRARIES.fs.unlinkSync(this.folder());
		this.log("Deleted files!");
	}
}
module.exports.Server = Server;
