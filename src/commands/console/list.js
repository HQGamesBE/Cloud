/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
module.exports = {
	name: 'list',
	description: 'List all running servers.',
	aliases: ['ls'],
	execute: (args) => {
		console.log(serverManager.servers.mapValues(server => server.identifier));
	}
}