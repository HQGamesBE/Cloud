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
	/** @type {Collection<string, Zone>} */
	#zones = null;

	constructor() {
		this.#zones = new LIBARIES.discord.Collection();
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

	async load(from_cache = true) {
		if (this.#zones) this.#zones.clear();
		if (from_cache) {
			let data = LIBARIES.fs.readFileSync(this.#cache_file).toString();
			data = JSON.parse(data);

			for (let id in data) {
				let zone = new Zone(id, data[id].name);
				for (let record of data[id].dns_records) zone.addDNSRecord(new DNSRecord(zone, record.id, record.subdomain, record.target));
				this.#zones.set(zone.id, zone);
			}
		} else {
			let zones = await LIBARIES.cloudflare.zones.browse();
			for (let zone of zones.result) {
				let zone_obj = new Zone(zone.id, zone.name);
				let records = await LIBARIES.cloudflare.dnsRecords.browse(zone.id);
				for (let record of records.result) zone_obj.addDNSRecord(new DNSRecord(zone_obj, record.id, record.subdomain, record.target));
				this.#zones.set(zone_obj.id, zone_obj);
			}
		}
		Logger.notice("Loaded " + this.#zones.size + " zones from cache.");
	}

	/**
	 * @param {Zone} zone
	 * @param {string} subdomain
	 * @param {string} target
	 * @return {Promise<DNSRecord>}
	 */
	async createDNSRecord(zone, subdomain, target) {
		if (subdomain.endsWith(".") || subdomain.endsWith("@")) subdomain = subdomain.substring(0, subdomain.length - 1);
		if (subdomain.startsWith(".")) subdomain = subdomain.substring(1);
		if (subdomain.endsWith(zone.name)) subdomain = subdomain.substring(0, subdomain.length - zone.name.length - 1);
		if (subdomain.length > 63) throw new Error("Subdomain is too long.");
		if (!target.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) throw new Error("'" + target + "' is not a valid IPv4 address.");

		let record = await LIBARIES.cloudflare.dnsRecords.add(zone.id, {
			name: subdomain + "." + zone.name,
			type: "A",
			content: target
		});
		zone.addDNSRecord(record = new DNSRecord(zone, record.id, subdomain, target));
		return record;
	}

	/**
	 *
	 * @param {Zone} zone
	 * @param {DNSRecord|string} record
	 * @return {Promise<Object>}
	 */
	deleteDNSRecord(zone, record) {
		return LIBARIES.cloudflare.dnsRecords.del(zone.id, record instanceof DNSRecord ? record.id : record).then(() => zone.removeDNSRecord(record));
	}

	/**
	 * @param {Zone} zone
	 * @param {DNSRecord} record
	 * @param {string} subdomain
	 * @param {string} target
	 * @return {Promise<DNSRecord>}
	 */
	async updateDNSRecord(zone, record, subdomain, target) {
		if (subdomain.endsWith(".") || subdomain.endsWith("@")) subdomain = subdomain.substring(0, subdomain.length - 1);
		if (subdomain.startsWith(".")) subdomain = subdomain.substring(1);
		if (subdomain.endsWith(zone.name)) subdomain = subdomain.substring(0, subdomain.length - zone.name.length - 1);
		if (subdomain.length > 63) throw new Error("Subdomain is too long.");
		if (!target.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) throw new Error("'" + target + "' is not a valid IPv4 address.");

		await LIBARIES.cloudflare.dnsRecords.edit(zone.id, record.id, {
			name: subdomain + "." + zone.name,
			type: "A",
			content: target
		});
		record.subdomain = subdomain;
		record.target = target;
		return record;
	}
}
module.exports = CloudflareManager;
