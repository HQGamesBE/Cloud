/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Zone = require("./Zone");

/**
 * Class DNSRecord
 * @author Jan Sohn / xxAROX
 * @date 02.07.2022 - 15:14
 * @project Cloud
 */
class DNSRecord {
	/** @type {Zone} */
	#zone;
	/** @type {string} */
	#id;
	/** @type {string} */
	#subdomain;
	/** @type {string} */
	#target;


	/**
	 * @param {Zone} zone
	 * @param {string} id
	 * @param {string} subdomain
	 * @param {string} target
	 */
	constructor(zone, id, subdomain, target) {
		if (subdomain.endsWith(".") || subdomain.endsWith("@")) subdomain = subdomain.substring(0, subdomain.length - 1);
		if (subdomain.startsWith(".")) subdomain = subdomain.substring(1);
		if (subdomain.endsWith(zone.name)) subdomain = subdomain.substring(0, subdomain.length - zone.name.length - 1);
		if (subdomain.length > 63) throw new Error("Subdomain is too long.");
		if (!target.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) throw new Error("'" + target + "' is not a valid IPv4 address.");

		this.#id = id;
		this.#zone = zone;
		this.#subdomain = subdomain;
		this.#target = target;
	}

	/**
	 * @return {Zone}
	 */
	get zone() {
		return this.#zone;
	}

	/**
	 * @return {string}
	 */
	get id() {
		return this.#id;
	}

	/**
	 * @return {string}
	 */
	get subdomain() {
		return this.#subdomain;
	}

	set subdomain(v) {
		if (v.endsWith(".") || v.endsWith("@")) v = v.substring(0, v.length - 1);
		if (v.startsWith(".")) v = v.substring(1);
		if (v.endsWith(this.#zone.name)) v = v.substring(0, v.length - this.#zone.name.length - 1);
		if (v.length > 63) throw new Error("Subdomain is too long.");
		this.#subdomain = v;
	}

	/**
	 * @return {string}
	 */
	get full_subdomain() {
		return this.#subdomain + "." + this.#zone.name;
	}

	/**
	 * @return {string}
	 */
	get target() {
		return this.#target;
	}

	set target(v) {
		if (!v.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) throw new Error("'" + v + "' is not a valid IPv4 address.");
		this.#target = v;
	}

	/**
	 * @return {string}
	 */
	toString() {
		return `${this.full_subdomain} => ${this.#target}`;
	}
}
module.exports = DNSRecord;
