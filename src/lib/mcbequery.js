/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const crypto = require("crypto");
const dgram = require("dgram");

async function generateChallenge(client, sessionId, host, port, timeout) {
	return new Promise((resolve, reject) => {
		let buffer = Buffer.alloc(7);

		buffer.writeUInt16BE(0xFEFD, 0);
		buffer.writeUInt8(9, 2);
		buffer.writeInt32BE(sessionId, 3);
		buffer.write("", 7);

		client.on("message", (data, info) => {
			client.removeAllListeners();
			resolve(parseInt(data.toString('utf-8', 5)));
		});

		setTimeout(() => {
			client.removeAllListeners();
			reject(new Error("Challenge recovery time out"));
		}, timeout);

		client.send(buffer, port, host, (err) => {
			if (err) {
				reject(err);
			}
		});
	});
}

module.exports.query = async function (host, port = 19132, timeout = 5000) {
	return new Promise(async (resolve, reject) => {
		try {
			let sessionId = crypto.randomBytes(4);
			let client = dgram.createSocket("udp4");
			let challenge = await generateChallenge(client, sessionId, host, port, timeout);
			let buffer = Buffer.alloc(15);;

			buffer.writeUInt16BE(0xFEFD, 0);
			buffer.writeUInt8(0, 2);
			buffer.writeInt32BE(sessionId, 3);
			buffer.writeInt32BE(challenge, 7);
			buffer.writeInt32BE(0x00, 11);

			client.on("message", (data, info) => {
				data = data.toString("utf-8", 11).split("\x00\x01player_\x00\x00");
				let players = data[ 1 ].split("\u0000").slice(0, -2) || null;
				data = data[ 0 ].split("\0");

				client.close();
				resolve({
					online: Number.parseInt(isNaN(data[ 17 ]) ? data[ 9 ] : data[ 17 ]),
					players,
				});
			});

			setTimeout(() => {
				client.removeAllListeners();
				if (client.readyState === "open") {
					client.close();
				}
				reject(new Error("Query timed out"));
			}, timeout);

			client.send(buffer, port, host, (err) => {
				if (err) {
					reject(err);
				}
			});
		} catch (ex) {
			reject(ex);
		}
	});
};