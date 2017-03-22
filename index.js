#!/usr/bin/env node

"use strict";

const chalk = require('chalk');
const figlet = require('figlet');
const nconf = require('nconf');
const path = require('path');
const package_json = require('./package.json');
const Scanner = require('./scanner');
const server = require('./server');
const utils = require('./utils');

let argv = require('yargs')
	.strict()
	.option('port', {
		alias: 'p',
		describe: '// configurator port, default: <random>',
		type: 'number'
	})
	.option('password', {
		alias: 'w',
		describe: '// configurator password, default: <random>',
		type: 'string'
	})
	// .command('run', '// start this relay node', (yargs) => {
	// 	yargs //
	// 		.usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-relay run'))
	// 		.option('uri', {
	// 			alias: 'u',
	// 			describe: '// MQTT server URI',
	// 			type: 'string'
	// 		})
	// 		.demandOption(['uri'])
	// }, function (argv) {
	// 	relay
	// 		.run(argv.uri)
	// 		.catch(err => {
	// 			console.error(err);
	// 			process.exit(-1);
	// 		});
	// }) //
	.help('help', '// show help')
	.usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-spot') + ' [config_file]')
	.argv;

let scanner = new Scanner();

Promise.resolve()
	.then(_setupConfig)
	.then(scanner.setup.bind(scanner))
	.then(() => server(argv.port, 'admin', argv.password, scanner))
	.then(scanner.start.bind(scanner))
	.catch(function (err) {
		console.error(err);
		process.exit(-1);
	});

function _setupConfig() {
	let spinner = utils.ora('opening config file');
	let configPath = argv._[0] || path.normalize(path.join((process.env.USERPROFILE || process.env.HOME), '.config', 'zing-spot.json'));

	// open the config file
	nconf
		.file({
			file: configPath
		});

	spinner.finish('config', configPath);
	return nconf;
}

process.on('SIGINT', function () {
	process.exit();
});