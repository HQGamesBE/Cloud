/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const DNSRecord = require("./DNSRecord");

/**
 * Class Zone
 * @author Jan Sohn / xxAROX
 * @date 02.07.2022 - 15:12
 * @project Cloud
 */
class Zone {
	#id;
	#name;
	#dns_records;

	constructor(id, name) {
		this.#id = id;
		this.#name = name;
		this.#dns_records = new LIBRARIES.discord.Collection();
	}

	/**
	 * @deprecated
	 * @return {*}
	 */
	get getId() {
		return this.#id;
	}

	get id() {
		return this.#id;
	}

	/**
	 * @deprecated
	 * @return {*}
	 */
	get getName() {
		return this.#name;
	}

	get name() {
		return this.#name;
	}

	get dns_records() {
		return this.#dns_records;
	}

	toString() {
		return `${this.#name}`;
	}

	/**
	 * @param {DNSRecord} record
	 */
	addDNSRecord(record) {
		this.#dns_records.set(record.getId(), record);
	}

	/**
	 * @param {DNSRecord} record
	 */
	removeDNSRecord(record) {
		this.#dns_records.remove(record.getId());
	}
}
module.exports = Zone;
