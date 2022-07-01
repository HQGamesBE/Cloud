/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

/**
 * Class Loggable
 * @author Jan Sohn / xxAROX
 * @date 01.07.2022 - 11:35
 * @project Cloud
 */
class Loggable {
	getLoggerPrefix() {
		return "[".gray + "Loggable".bgWhite.black + "]".gray;
	}
}
module.exports = Loggable;
