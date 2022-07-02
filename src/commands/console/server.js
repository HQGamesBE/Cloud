/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
module.exports = {
	name: 'server',
	description: 'Manage servers.',
	aliases: ['s'],
	execute: (args) => {
		switch (args[0]) {
			case "ls":
			case "list": {
				let servers = (!args[1] ? serverManager.servers : serverManager.servers.filter(s => s.template.name.toLowerCase().includes(args[1].toLowerCase())));
				if (servers.size === 0) return Logger.error("No servers found.");
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
				break;
			}
			default: {
				Logger.hint("Usage: server <list|ls>");
				break;
			}
		}
	}
}