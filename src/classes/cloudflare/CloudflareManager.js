/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const Zone = require("./Zone");
const DNSRecord = require("./DNSRecord");
/**
 * Class CloudflareManager
 * @author Jan Sohn / xxAROX
 * @date 02.07.2022 - 15:11
 * @project Cloud
 */
class CloudflareManager {
	#cache_file = "./resources/cloudflare_cache.json";
	/** @type {LIBRARIES.discord.Collection<string, Zone>} */
	#zones = new LIBARIES.discord.Collection();

	constructor() {
		this.load();
	}

	store() {
		let data = {};
		this.#zones.forEach(zone => data[zone.id] = {
				id: zone.id,
				name: zone.name,
				dns_records: zone.dns_records.map(record => {
					return {
						id: record.id,
						subdomain: record.subdomain,
						target: record.target
					};
				}),
			});
		LIBARIES.fs.writeFileSync(this.#cache_file, JSON.stringify(data));
	}

	load() {
		let data = LIBARIES.fs.readFileSync(this.#cache_file).toString();
		data = JSON.parse(data);

		for (let id in data) {
			let zone = new Zone(id, data[id].name);
			for (let record of data[id].dns_records) zone.addDNSRecord(new DNSRecord(zone, record.id, record.subdomain, record.target));
			this.#zones.set(zone.id, zone);
		}
		console.log("Loaded " + this.#zones.size + " zones.");
	}

	/**
	 * @param {Zone} zone
	 * @param {string} subdomain
	 * @param {string} target
	 * @return {DNSRecord}
	 */
	createDNSRecord(zone, subdomain, target) {
		if (subdomain.endsWith(".") || subdomain.endsWith("@")) subdomain = subdomain.substring(0, subdomain.length - 1);
		if (subdomain.startsWith(".")) subdomain = subdomain.substring(1);
		if (subdomain.endsWith(this.#name)) subdomain = subdomain.substring(0, subdomain.length - zone.getName.length - 1);
		if (!target.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) throw new Error("'" + target + "' is not a valid IPv4 address.");

		LIBARIES.cloudflare.dnsrecords.add(zone.#id, {
			name: subdomain + "." + zone.getName,
			type: "A",
			content:
		});
		let record = new DNSRecord(this.#id, this, subdomain, target);
		this.#dns_records.set(record.getId(), record);
		return record;
	}
}
module.exports.CloudflareManager = CloudflareManager;
