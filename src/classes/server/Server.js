/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
class Server extends require("events").EventEmitter{
	static QUERY_TIMEOUT = 3500;

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
		super();
		this.created = Date.now();
		this.template = template;
		this.identifier = identifier;
		this.port = port;
		this.folder = (...file_or_dirs) => serverManager.running_folder(identifier, ...file_or_dirs);
		this.log(this.folder())
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

	/**
	 * @param {"creating_files"|"created_files"|"boot"|"started"|"command"|"stopping"|"stopped"|"killing"|"killed"|"deleting"|"deleted"} eventName
	 * @param {(...args: any[]) => void} listener
	 */
	on(eventName, listener) {
		super.on(eventName, listener);
		return this;
	}

	async isTmuxSession() {
		// noinspection JSCheckFunctionSignatures
		let {strout, strerr} = await PROMISED_FUNCTIONS.exec(`tmux has-session -t ${this.identifier}`, (err) => null).toString();
		let a =  strout?.stdout.startsWith("can't find session") || strout?.stdout.includes("no server running on ");
		return !a;
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

	async createFiles() {
		this.emit("creating_files", this);
		this.online_state = ServerState.starting;
		if (!LIBRARIES.fs.existsSync(this.folder())) LIBRARIES.fs.mkdirSync(this.folder(), {recursive: true});
		if (!LIBRARIES.fs.existsSync(serverManager.Software)) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + "".cyan + " Could not find the software in '" + serverManager.Software + "'!");

		// NOTE: backend.json
		(() => {
			LIBRARIES.fs.writeFileSync(this.folder("backend.json"), JSON.stringify(this.backend_properties, null, 4));
		})();

		// NOTE: start_script
		(() => {
			let start_script = undefined;
			eachOS(
				() => {
					let id = generateId(8);
					console.log(this.folder("start.bat"));
					LIBRARIES.fs.writeFileSync(start_script = this.folder("start.bat"), "" +
						"@echo off\n" +
						"title " + id + "\n" +
						"IF EXIST cmd_pid.txt DEL /F cmd_pid.txt\n" +
						"tasklist /FI \"ImageName eq cmd.exe\" /FI \"Status eq Running\" /FI \"WindowTitle eq " + id + "\" /FO csv > cmd_pid.txt\n" +
						"php " + serverManager.Software + (TESTING ? " --test" : "") + " --no-wizard" + (DEBUG ? " --debug" : "") + "\n" +
						"exit"
					);
				},
				() => {
					if (!LIBRARIES.fs.existsSync(serverManager.Binary)) throw new Error("Could not find the php binary in '" + serverManager.Binary + "'!");
					LIBRARIES.fs.writeFileSync(start_script = this.folder("start.sh"), serverManager.Binary + " " + serverManager.Software + (TESTING ? " --test" : "") + " --no-wizard" + (DEBUG ? " --debug" : ""));
				},
				() => {
					throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " MacOS is not supported yet!");
				}
			);

			if (start_script) LIBRARIES.fs.chmodSync(start_script, 0o777);
			else throw new Error("Could not create start.bat or start.sh!");

			this.start_script = start_script;
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
			let files = [ "pocketmine.yml", "ops.txt" ];
			let directories = [ "plugins", "plugin_data", "worlds" ];

			for (let file of files) if (LIBRARIES.fs.existsSync(serverManager.servers_folder("server", file))) LIBRARIES.fs.copyFileSync(serverManager.servers_folder("server", file), this.folder(file));
			for (let directory of directories) {
				if (LIBRARIES.fs.existsSync(serverManager.servers_folder("server", directory))) LIBRARIES.fse.copySync(serverManager.servers_folder("server", directory), this.folder(directory));
				else LIBRARIES.fs.mkdirSync(this.folder("server", directory), {recursive: true});
			}
		})();

		this.emit("created_files", this);
		this.log("Created files");
	}

	boot() {
		if (!TESTING && LIBRARIES.os.platform() === "win32") {
			this.log("Windows is not supported yet!".red);
			return;
		}
		this.emit("boot", this);
		this.log("Starting...");

		if (!this.start_script) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not start the server, because the start script is not defined!");

		console.log(this.folder());
		eachOS(
			() => {
				LIBRARIES.child_process.exec("cd " + this.folder() + " && start start.bat && exit");
				Logger.error("Console must be closed manually!".bold.underline.italic);
			},
			() => {
				LIBRARIES.child_process.exec("cd " + this.folder() + " && tmux new-session -d -s " + this.identifier + " ./start.sh");
			},
			() => {
				throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " MacOS is not supported!")
			}
		);

		new Promise((resolve, reject) => {
			let timeout = setTimeout(() => reject("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not start the server, because it is not responding!"), 1000 * 10);
			let interval = setInterval(() => {
				if (LIBRARIES.fs.existsSync(this.folder("server.lock"))) {
					this.running = true;
					this.pid = Number.parseInt(LIBRARIES.fs.readFileSync(this.folder("server.lock")).toString().trim());

					if (LIBRARIES.os.platform() === "win32" && LIBRARIES.fs.existsSync(this.folder("cmd_pid.txt"))) {
						this.start_script_pid = LIBRARIES.fs.readFileSync(this.folder("cmd_pid.txt")).toString().split("\n")[1].replaceAll("\"", "").split(",")[1];
						LIBRARIES.fs.rmSync(this.folder("cmd_pid.txt"));
					}
					clearInterval(interval);
					this.afterStart();
					resolve();
				}
			}, 100);
			this.once("started", () => clearTimeout(timeout) && resolve());
		})
		.then(() => {
			this.emit("booted", this);
			this.log("Started!");
		})
		.catch(error => {
			this.emit("error", error);
			Logger.error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not start the server, because " + error.message);
		});
	}

	afterStart() {
		this.emit("started", this);
		this.log("PID: " + this.pid + " | Started on port " + this.port.toString().bgYellow.black);
	}

	async executeCommand(command) {
		if (!this.start_script) return Logger.error("[Important]".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not execute the command, because the start script is not defined!");
		if (!this.running) return undefined;

		if (LIBRARIES.os.platform() === "win32") {
			LIBRARIES.child_process.exec('Get-CimInstance Win32_Process -Filter "name = \'cmd.exe\'" | ForEach-Object {\n' +
				'  if ((Get-Process -Id $_.ProcessId).MainWindowTitle -eq \'TEST\') {\n' +
				'    (Invoke-CimMethod -InputObject $_ -MethodName GetOwner).User -eq \'SYSTEM\'\n' +
				'  }\n' +
				'}', {
				shell: "powershell.exe"
			});
			//Logger.error("[Important] ".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Executing commands is not supported on windows!".red);
		}
		else if (LIBRARIES.os.platform() === "darwin") Logger.error("[Important] ".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Executing commands is not supported on macos!".red);
		else if (LIBRARIES.os.platform() === "linux") {
			let str = LIBRARIES.child_process.exec("" + this.start_script + " " + command);
			return {strout:str?.strout, strerr:str?.strerr};
		}
		else Logger.error("Your operating system is not supported!".red);
	}

	stop(reason) {
		if (!this.running) return;
		this.emit("stopping", this);
		let timeout = setTimeout(() => this.kill() && this.deleteFiles(), 1000 * 7);
		let done = this.executeCommand(reason ? "stop " + reason : "stop").then(() => clearTimeout(timeout) && this.deleteFiles());
		this.running = false;
		serverManager.servers.delete(this.identifier);
		this.log("Server stopped with reason: " + reason);
		this.emit("stopped", this);
	}

	kill() {
		this.emit("killing", this);
		if (!this.start_script) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not kill the server, because the start script is not defined!");
		if (this.killed) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not kill the server, because it is already killed!");
		this.log("Killing server...");

		if (LIBRARIES.os.platform() === "win32") LIBRARIES.child_process.exec("taskkill /F /PID " + this.pid) && LIBRARIES.child_process.exec("taskkill /F /PID " + this.start_script_pid);
		else if (LIBRARIES.os.platform() === "linux") {
			LIBRARIES.child_process.exec("kill -9 " + this.pid);
			if (this.isTmuxSession()) LIBRARIES.child_process.exec("tmux kill-session -t " + this.identifier);
		}
		else throw new Error("Your operating system is not supported!");
		this.running = false;
		this.killed = true;
		this.log("Server killed!");
		this.emit("killed", this);
	}

	deleteFiles() {
		this.emit("deleting", this);
		this.log("Deleting files...");
		LIBRARIES.fs.unlinkSync(this.folder());
		this.log("Deleted files!");
		this.emit("deleted", this);
		this.removeAllListeners();
	}
}
module.exports.Server = Server;
