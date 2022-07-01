/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
module.exports = {
	name: 'help',
	description: 'Get a list of all commands.',
	aliases: ['?'],
	execute: (args) => {
		let commands = [["^MName", "^MDescription", "^MAliases"]];
		console.commands.forEach(command => commands.push([command.name, command.description, command.aliases.join(", ")]));
		term.table(commands, {
				contentHasMarkup: true,
				borderChars: 'heavy',
				borderAttr: { color: 'gray' },
				width: 65 ,
				fit: true
			}
		) ;
	}
}