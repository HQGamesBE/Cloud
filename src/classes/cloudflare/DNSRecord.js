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

	/**
	 * @return {string}
	 */
	toString() {
		return `${this.full_subdomain} => ${this.#target}`;
	}
}
module.exports = DNSRecord;
