/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

/**
 * Class utils
 * @package
 * @author Jan Sohn / xxAROX
 * @date 02. July, 2022 - 17:13
 * @ide PhpStorm
 * @project Cloud
 */
class Utils {
	/**
	 * @param {string} url
	 * @param {string} filename
	 * @return {Promise<string>}
	 */
	static async download(url, filename) {
		return new Promise(async (resolve, reject) => {
			const file = LIBRARIES.fs.createWriteStream(filename);
			let body = "";
			let request = await LIBRARIES.https.get(url, response => {
				if (response.statusCode !== 200) throw new Error(`Could not download ${url}`);
				response.on("data", (chunk) => body += chunk);
				response.on("end", () => {
					resolve(filename);
					file.end();
				});
				response.on("error", function(e){
					Logger.error(e.message);
					reject(e);
				});
			});
		});
	}

	/**
	 * @param {module:stream.internal.Readable} stream
	 * @return {Promise<string>}
	 */
	static async streamToString(stream) {
		const chunks = [];
		for await (const chunk of stream) {
			chunks.push(Buffer.from(chunk));
		}
		return Buffer.concat(chunks).toString("utf-8");
	}
}
module.exports = Utils;
