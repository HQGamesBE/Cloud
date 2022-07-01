/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
class Server extends require("events").EventEmitter{
	static QUERY_TIMEOUT = 5 * 1000;

	query_running = false;
	created = -1;
	timed_out = false;
	query_errors = [];
	public_visibility = ServerVisibility.private;
	online_state = ServerState.offline;
	backend_properties = {
		AuthToken: serverManager.AuthToken,
		backend_address: "127.0.0.1",
		backend_port: serverManager.server?.bind_port,
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
		this.backend_properties.identifier = identifier;
		this.backend_properties.template = template.name;
		this.backend_properties.display_name = template.display_name;
		this.backend_properties.image = template.image;
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
		let {strout, strerr} = await LIBARIES.promisify(require("child_process").exec)(`tmux has-session -t ${this.identifier}`).toString();
		let a =  strout.stdout.startsWith("can't find session") || strout.stdout.includes("no server running on ");
		return !a;
	}

	async query() {
		if (!this.running) return;
		if (this.killed) return;
		if (this.timed_out) return;
		if (this.query_running) return;
		const isOnlineFunc = async function (server) {
			try {
				let data = await LIBARIES.libquery.query(eachOS(() => "127.0.0.1", () => "0.0.0.0", () => "0.0.0.0"), server.port, Server.QUERY_TIMEOUT);
				server.player_count = data.online;
				return !server.timed_out && server.running && !server.killed;
			} catch (err) {
				server.query_errors.push(err);
				return false;
			} finally {
				server.query_running = false;
			}
		};

		if (!(await isOnlineFunc(this))) {
			if (this.query_errors.length > 5) {
				this.timed_out = true;
				this.timeout();
			}
		} else {
			this.query_errors.shift();
			this.online_state = ServerState.online;
		}
	}

	timeout() {
		this.online_state = ServerState.offline;
		this.timed_out = true;
		this.query_running = false;
		this.player_count = 404;
		this.stop("Server timed out");
	}

	async createFiles() {
		this.emit("creating_files", this);
		this.online_state = ServerState.starting;
		if (!LIBARIES.fs.existsSync(this.folder())) LIBARIES.fs.mkdirSync(this.folder(), {recursive: true});
		if (!LIBARIES.fs.existsSync(serverManager.Software)) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + "".cyan + " Could not find the software in '" + serverManager.Software + "'!");

		// NOTE: backend.json
		(() => {
			LIBARIES.fs.writeFileSync(this.folder("backend.json"), JSON.stringify(this.backend_properties, null, 4));
		})();

		// NOTE: start_script
		(() => {
			let start_script = undefined;
			if (LIBARIES.os.platform() === "win32") {
				let id = generateId(8);
				LIBARIES.fs.writeFileSync(start_script = this.folder("start.bat"), "" +
					"@echo off\n" +
					"title " + id + "\n" +
					"IF EXIST cmd_pid.txt DEL /F cmd_pid.txt\n" +
					"tasklist /FI \"ImageName eq cmd.exe\" /FI \"Status eq Running\" /FI \"WindowTitle eq " + id + "\" /FO csv > cmd_pid.txt\n" +
					"php " + serverManager.Software + (TESTING ? " --test" : "") + " --no-wizard" + (DEBUG ? " --debug" : "") + "\n" +
					"exit"
				);
			}
			else if (LIBARIES.os.platform() === "darwin") throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " MacOS is not supported yet!");
			else if (LIBARIES.os.platform() === "linux") {
				let php = serverManager.servers_folder("bin", "php7", "bin", "php");
				if (!LIBARIES.fs.existsSync(php)) throw new Error("Could not find the php binary in '" + php + "', get it here https://jenkins.pmmp.io/job/PHP-8.0-Aggregate/lastSuccessfulBuild/artifact/PHP-8.0-Linux-x86_64.tar.gz!");
				LIBARIES.fs.writeFileSync(start_script = this.folder("start.sh"), php + " " + serverManager.Software + (TESTING ? " --test" : "") + " --no-wizard" + (DEBUG ? " --debug" : ""));
			}
			else throw new Error("Your operating system is not supported!");

			if (start_script) LIBARIES.fs.chmodSync(start_script, 0o777);
			else throw new Error("Could not create start.bat or start.sh!");

			this.start_script = start_script;
		})();

		// NOTE: server.properties
		(() => {
			LIBARIES.fs.writeFileSync(this.folder("server.properties"), "#Properties Config file\n" +
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

			for (let file of files) if (LIBARIES.fs.existsSync(serverManager.servers_folder(file))) LIBARIES.fs.copyFileSync(serverManager.servers_folder(file), this.folder(file));
			for (let directory of directories) if (LIBARIES.fs.existsSync(serverManager.servers_folder(directory))) LIBARIES.fse.copySync(serverManager.servers_folder(directory), this.folder(directory));
		})();

		this.emit("created_files", this);
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Created files");
	}

	boot() {
		if (!TESTING && LIBARIES.os.platform() === "win32") {
			console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Windows is not supported yet!".red);
			return;
		}
		this.emit("boot", this);
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Starting...");

		if (!this.start_script) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not start the server, because the start script is not defined!");

		eachOS(
			() => {
				LIBARIES.child_process.exec("cd " + this.folder() + " && start start.bat && exit");
				Logger.error("Console must be closed manually!".bold.underline.italic);
			},
			() => {
				LIBARIES.child_process.exec("cd " + this.folder() + " && tmux new-session -d -s " + this.identifier + " ./start.sh");
			},
			() => {
				throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " MacOS is not supported!")
			}
		);

		new Promise((resolve, reject) => {
			let timeout = setTimeout(() => reject("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not start the server, because it is not responding!"), 1000 * 10);
			let interval = setInterval(() => {
				if (LIBARIES.fs.existsSync(this.folder("server.lock"))) {
					this.running = true;
					this.pid = Number.parseInt(LIBARIES.fs.readFileSync(this.folder("server.lock")).toString().trim());

					if (LIBARIES.os.platform() === "win32" && LIBARIES.fs.existsSync(this.folder("cmd_pid.txt"))) {
						this.start_script_pid = LIBARIES.fs.readFileSync(this.folder("cmd_pid.txt")).toString().split("\n")[1].replaceAll("\"", "").split(",")[1];
						LIBARIES.fs.rmSync(this.folder("cmd_pid.txt"));
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
			console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Started!");
		})
		.catch(error => {
			this.emit("error", error);
			console.error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not start the server, because " + error.message);
		});
	}

	afterStart() {
		this.emit("started", this);
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " PID: " + this.pid + " | Started on port " + this.port.toString().bgYellow.black);
	}

	async executeCommand(command) {
		if (!this.start_script) return console.error("[Important]".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not execute the command, because the start script is not defined!");
		if (!this.running) return;

		if (LIBARIES.os.platform() === "win32") {
			LIBARIES.child_process.exec('Get-CimInstance Win32_Process -Filter "name = \'cmd.exe\'" | ForEach-Object {\n' +
				'  if ((Get-Process -Id $_.ProcessId).MainWindowTitle -eq \'TEST\') {\n' +
				'    (Invoke-CimMethod -InputObject $_ -MethodName GetOwner).User -eq \'SYSTEM\'\n' +
				'  }\n' +
				'}', {
				shell: "powershell.exe"
			});
			//console.error("[Important] ".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Executing commands is not supported on windows!".red);
		}
		else if (LIBARIES.os.platform() === "darwin") console.error("[Important] ".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Executing commands is not supported on macos!".red);
		else if (LIBARIES.os.platform() === "linux") {
			let {strout, strerr} = LIB.child_process.exec("" + this.start_script + " " + command);
			return {strout, strerr};
		}
		else console.error("[Error]".bold.red + "[Server] ".green + ("[" + this.identifier + "]").cyan + " Your operating system is not supported!".red);
	}

	stop(reason) {
		if (!this.running) return;
		this.emit("stopping", this);
		let timeout = setTimeout(() => this.kill() && this.deleteFiles(), 1000 * 7);
		let done = this.executeCommand(reason ? "stop " + reason : "stop").then(() => clearTimeout(timeout) && this.deleteFiles());
		this.running = false;
		serverManager.servers.delete(this.identifier);
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Server stopped with reason: " + reason);
		this.emit("stopped", this);
	}

	kill() {
		this.emit("killing", this);
		if (!this.start_script) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not kill the server, because the start script is not defined!");
		if (this.killed) throw new Error("[Server] ".green + ("[" + this.identifier + "]").cyan + " Could not kill the server, because it is already killed!");
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Killing server...");

		if (LIBARIES.os.platform() === "win32") LIBARIES.child_process.exec("taskkill /F /PID " + this.pid) && LIBARIES.child_process.exec("taskkill /F /PID " + this.start_script_pid);
		else if (LIBARIES.os.platform() === "linux") {
			LIBARIES.child_process.exec("kill -9 " + this.pid);
			if (this.isTmuxSession()) LIBARIES.child_process.exec("tmux kill-session -t " + this.identifier);
		}
		else throw new Error("Your operating system is not supported!");
		this.running = false;
		this.killed = true;
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Server killed!");
		this.emit("killed", this);
	}

	deleteFiles() {
		this.emit("deleting", this);
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Deleting files...");
		LIBARIES.fs.unlinkSync(this.folder());
		console.log("[Server] ".green + ("[" + this.identifier + "]").cyan + " Deleted files!");
		this.emit("deleted", this);
		this.removeAllListeners();
	}
}
module.exports.Server = Server;
