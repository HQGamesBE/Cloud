/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
module.exports = {
	name: 'stop',
	description: 'Stop the process.',
	aliases: ['end', 'exit'],
	execute: (args) => {
		process.exit(0);
	}
}