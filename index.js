#!/usr/bin/env node

"use strict";

const chalk = require('chalk');
const figlet = require('figlet');
const package_json = require('./package.json');
const Relay = require('./relay');

let relay = new Relay();

require('yargs')
	.strict()
	.command('info', '// information about this relay', {}, function (argv) {
		relay
			.info()
			.then(addr => {
				process.exit();
			})
			.catch(err => {
				process.exit(-1);
			});
	})
	.command('run', '// start this relay node', (yargs) => {
		yargs //
			.usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-relay run'))
			.option('token', {
				alias: 't',
				describe: '// auth token',
				type: 'string'
			})
			.demandOption(['token'])
	}, function (argv) {
		relay
			.run(argv.token)
			.catch(err => {
				console.error(err);
				process.exit(-1);
			});
	}) //
	.wrap(null)
	.usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-relay') + ' <command>')
	.demand(1, null)
	.argv;

process.on('SIGINT', function () {
	process.exit();
});