/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const {ServerManager} = require("./classes/ServerManager");
global.serverManager = new ServerManager(CONFIG.bind_port);
