/*
 * Copyright (c) Jan Sohn / xxAROX
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const docker = new (require('dockerode'))({socketPath: '/var/run/docker.sock'});

async function test() {
	let container = await docker.createContainer({
		Image: 'php:8.0',
		Cmd: [ '/bin/bash', '-c', 'echo "Hello World"' ],
		name: 'test',
        Tty: true,
        Volumes: [
            '/tmp/test:/tmp/test'
        ]
	}, undefined);
    console.log("[Container:" + container.id + "] " + "created!");


    container.start();
    setTimeout(() => {
        console.log("[Container:" + container.id + "] " + "stopped!");
        container.stop();
        container.remove();
    }, 1000 * 5);
}
test();