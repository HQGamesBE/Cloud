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
		let servers = (!args[0] ? serverManager.servers : serverManager.servers.filter(s => s.template.name.toLowerCase().includes(args[0].toLowerCase())));
		term.table([
			['^MID', '^MTemplate', '^MStatus', '^MPlayers', '^MPort'],
			...servers.map((server) => {
				return [
					server.identifier,
					server.template.name,
					server.online_state,
					server.player_count + "/" + server.template.max_players,
					server.port,
				];
			})
		], {
			fit: false,
			contentHasMarkup: true,
		});
	}
}