/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
class Socket {
	/** @private */
	socket = null;
	connections = new LIBRARIES.discord.Collection();
	running = false;
	bind_host = "127.0.0.1";
	bind_port = null;

	constructor(bind_port) {
		process.on("exit", () => this.close());
		this.bind_port = bind_port;
		this.socket = LIBRARIES.dgram.createSocket("udp4");
		this.socket.on("message", (msg, remoteInfo) => {
			this.onMessage(msg.toString(), remoteInfo);
		});
		this.socket.on("listening", () => {
			this.running = true;
			this.log(`Listening on port ${this.bind_host}:${this.bind_port}`);
		});
		this.socket.on("close", () => {
			this.running = false;
			this.log("Socket closed");
		});
		this.socket.on("error", (err) => {
			this.running = false;
			Logger.error(`[Socket] Error: ${err}`);
		});
	}

	log(content) {
		Logger.class(this, content);
	}

	getLoggerPrefix() {
		return "[".gray + "Socket".yellow + "]".gray;
	}

	/**
	 * @param {string} data
	 * @returns {Object}
	 */
	encodeData(data) {
		let json = null;
		try {
			json = JSON.parse(data);
		} catch (e) {
		}
		return json;
	}

	start() {
		this.socket.bind(this.bind_port, this.bind_host);
	}

	/**
	 * @private
	 * @param {string} message
	 * @param {RemoteInfo} remoteInfo
	 */
	onMessage(message, remoteInfo) {
		let data = this.encodeData(message);
		if (!data.type) {
			return;
		}
		if (!data.identifier) {
			return;
		}
		if (data.type !== "connect" && !this.isAuthenticated(data.identifier)) {
			return this.sendPacket({
				type: "error",
				message: "Server not found or not authenticated",
			}, remoteInfo);
		}
		if (!serverManager.servers.has(data.identifier)) {
			return this.sendPacket({
				type: "error",
				message: "Server not found or not authenticated",
			}, remoteInfo);
		}
		let required_fields = [];

		switch (data.type) {
			case "connect":
				required_fields = [ "AuthToken" ];
				break;
			case "disconnect":
				required_fields = [ "reason" ];
				break;
			case "start_server":
				required_fields = [ "template_name", "visibility" ];
				break;
			case "stop_server":
				required_fields = [ "reason", "identifier" ];
				break;

			case "lol":
				required_fields = [ "lol" ];
				break;

			default:
				break;
		}
		if (required_fields.length > 0) {
			let missing_fields = [];
			required_fields.forEach(field => (!data[ field ] ? missing_fields.push(field) : null));
			if (missing_fields.length > 0) {
				this.sendPacket({
					type: "error",
					reason: `Missing fields: ${missing_fields.join(", ")} for ${data.type}-packet`,
				}, remoteInfo);
				return;
			}
		}
		let server = serverManager.servers.get(data.identifier);
		if (!server) {
			return this.sendPacket({
				type: "error",
				message: "Server not found or not authenticated",
			}, remoteInfo);
		}

		switch (data.type) {
			case "connect":
				if ((serverManager.AuthToken === data.AuthToken || (TEST_MODE && data.AuthToken === "test"))) {
					this.connections.set(remoteInfo.address + ":" + remoteInfo.port, data.identifier);
					this.sendPacket({
						type: "connect",
						success: true,
					}, remoteInfo);
				}
				break;
			case "disconnect":
				this.connections.delete(remoteInfo.address + ":" + remoteInfo.port);
				this.log("Disconnected from " + data.identifier);
				break;
			case "start_server":
				let template = serverManager.templates.filter(t => t.name === data[ "template_name" ]).first();
				if (!template) {
					this.sendPacket({
						type: "error",
						reason: "Template not found",
					}, remoteInfo);
					return;
				}
				if (![ ServerVisibility.public, ServerVisibility.private ].includes(data[ "visibility" ])) {
					this.sendPacket({
						type: "error",
						reason: "Invalid visibility",
					}, remoteInfo);
					return;
				}
				let started_server = template.startServer();
				started_server.public_visibility = data[ "visibility" ];
				started_server.once("started", () => {
					this.sendPacket({
						type: "start_server",
						success: true,
						server_identifier: server.identifier,
					}, remoteInfo);
				});
				break;
			case "stop_server":
				server.stop(data[ "reason" ]);
				this.sendPacket({
					type: "stop_server",
					success: true,
				}, remoteInfo);
				break;
			default:
				break;
		}
		console.log(data);
	}

	isAuthenticated(identifier, remoteInfo) {
		return this.connections.has(remoteInfo.address + ":" + remoteInfo.port);
	}

	sendPacket(data, remoteInfo) {
		this.socket.send(JSON.stringify(data), 0, data.length, remoteInfo.port, remoteInfo.address);
	}

	close() {
		this.log("Closing socket..");
		if (this.running && this.socket.running) this.socket.close();
		this.log("Socket closed.");
		serverManager.log("Shutdown.");
		console.log("Written by ".bgBlue.cyan + "xxAROX".underline.bgBlue);
	}
}
module.exports = Socket