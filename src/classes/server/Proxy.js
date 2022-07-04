/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const {Server} = require("./Server");
/**
 * Class Proxy
 * @author Jan Sohn / xxAROX
 * @date 03.07.2022 - 01:52
 * @project Cloud
 */
class Proxy extends require("events").EventEmitter {
	running = false;
	killed = false;
	waiting = false;

	created = -1;

	timed_out = false;
	query_fails = 0;
	query_running = false;

	player_count = 0;

	backend_properties = {
		AuthToken: serverManager.AuthToken,
		backend_address: "127.0.0.1", //not needed, because no nodes are used
		backend_port: serverManager.socket?.bind_port,
	};

	constructor() {
		super();
		this.created = Date.now();
		this.folder = (...file_or_dirs) => serverManager.servers_folder("Proxy", ...file_or_dirs);
		if (!LIBRARIES.fs.existsSync(this.folder())) LIBRARIES.fs.mkdirSync(this.folder());
	}

	log(content) {
		Logger.class(this, content);
	}

	getLoggerPrefix() {
		return "[".gray + "Proxy".red + "]".gray;
	}

	init() {
		let can_start = true;
		if (!LIBRARIES.fs.existsSync(this.folder("start.sh"))) {
			this.log("Creating start.sh..");
			LIBRARIES.fs.writeFileSync(this.folder("start.sh"), "#!/bin/bash\ntmux new-session -d -s Proxy java -jar Waterdog.jar");
			LIBRARIES.fs.chmodSync(this.folder("start.sh"), "755");
			LIBRARIES.fs.writeFileSync(this.folder("manuel-start.sh"), "#!/bin/bash\ntmux new-session -s Proxy java -jar Waterdog.jar");
			LIBRARIES.fs.chmodSync(this.folder("manuel-start.sh"), "755");
			this.log("Created start.sh!");
		}
		if (!LIBRARIES.fs.existsSync(this.folder("backend.json"))) {
			this.log("Creating backend.json..");
			LIBRARIES.fs.writeFileSync(this.folder("backend.json"), JSON.stringify(this.backend_properties));
			this.log("Created backend.json!");
		}
		if (!LIBRARIES.fs.existsSync(this.folder("Waterdog.jar"))) {
			let cmd = "cd /home/HQGamesBE/Cloud/resources/servers/Proxy && wget https://github.com/WaterdogPE/WaterdogPE/releases/download/v1.1.8/Waterdog.jar";
			can_start = false;
			Logger.error("Waterdog.jar not found in '" + this.folder() + "'");
			Logger.hint(" => " + ("https://github.com/WaterdogPE/WaterdogPE/releases/download/v" + serverManager.Proxy_Version + "/Waterdog.jar").underline.bold.blue);
		}
		return can_start;
	}

	async isTmuxSession() {
		let {strout, strerr} = await PROMISED_FUNCTIONS.exec(`tmux has-session -t Proxy`, (err) => null).toString();
		let a =  strout?.stdout.startsWith("can't find session") || strout?.stdout.includes("no server running on ");
		return !a;
	}

	start() {
		return new Promise(function (resolve, reject) {
			if (this.running) {
				this.log("Already running!");
				resolve();
			} else {
				if (!LIBRARIES.fs.existsSync(this.folder("start.sh"))) {
					Logger.error("'" + this.folder("start.sh") + "' not found!");
					return reject();
				}
				if (!LIBRARIES.fs.existsSync(this.folder("Waterdog.jar"))) {
					Logger.error("'" + this.folder("Waterdog.jar") + "' not found!");
					return reject();
				}
				this.log("Starting Proxy..");
				this.waiting = true;
				LIBRARIES.child_process.exec("cd " + this.folder() + " && ./start.sh", function (err, stdout, stderr) {
					this.waiting = false;
					if (err) {
						Logger.error("Error while starting Proxy: " + err);
						return;
					}
					this.running = true;
					this.log("Proxy started!".green);
					resolve();
				}.bind(this));
			}
		}.bind(this));
	}

	stop(reason = undefined) {
		if (!this.running) return;
		let timeout = setTimeout(() => this.kill(), 1000 * 7);
		let done = this.executeCommand("end" + (reason ? " " + reason : "")).then(() => clearTimeout(timeout));
		console.log(done);
		this.running = false;
		this.log("stopped!".red);
		setTimeout(() => this.kill() && this.start(), 1000 * 5);
	}

	kill() {
		if (this.killed) throw new Error("Could not kill the proxy, because it is already killed!");
		this.log("Killing..");

		eachOS(
			() => {
				throw new Error("Could not kill the proxy, because the OS is not supported!");
			},
			() => {
				if (this.isTmuxSession()) LIBRARIES.child_process.exec("tmux kill-session -t Proxy");
			},
			() => {
				throw new Error("Your operating system is not supported!");
			}
		);
		this.running = false;
		this.killed = true;
		this.log("killed!");
		this.emit("killed", this);
	}

	timeout() {
		this.online_state = ServerState.offline;
		this.timed_out = true;
		this.query_fails = 0;
		this.query_running = false;
		this.player_count = 404;
		this.stop("Proxy timed out");
	}

	async query() {
		if (!this.running) return;
		if (this.killed) return;
		if (this.timed_out) return;
		let online = false;

		try {
			let data = await LIBRARIES.mcquery.query(eachOS(() => "127.0.0.1", () => "0.0.0.0", () => "0.0.0.0"), 19132, Server.QUERY_TIMEOUT);
			this.player_count = data.online || 0;
			online = data.online !== undefined && !this.timed_out && this.running && !this.killed;
		} catch (err) {
		}

		if (!online) {
			if (this.query_fails >= 6) this.timeout();
			else this.query_fails++;
		} else {
			this.query_fails = 0;
			this.online_state = ServerState.online;
		}
		return online;
	}

	async executeCommand(command) {
		if (!this.running) return undefined;
		if (command.startsWith("/")) command = command.substring(1);

		return eachOS(
			() => {
				this.log("[Important] ".bold.red + "Executing commands is not supported on windows!".red);
			},
			() => {
				let str = LIBRARIES.child_process.exec("tmux send -t 'Proxy' '" + command + "' ENTER");
				return {strout:str?.strout, strerr:str?.strerr};
			},
			() => {
				this.log("[Important] ".bold.red + "Executing commands is not supported on macos!".red);
			}
		);
	}
}
module.exports = Proxy;
