#!/usr/bin/env node

"use strict";

const chalk = require('chalk');
const express = require('express');
const figlet = require('figlet');
const http = require('http');
const nconf = require('nconf');
const utils = require('./utils');
const path = require('path');
const package_json = require('./package.json');
const Relay = require('./relay');

let argv = require('yargs')
	.strict()
	.option('port', {
		alias: 'p',
		describe: '// configurator port',
		type: 'number'
	})
	.option('password', {
		alias: 'w',
		describe: '// configurator password',
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
	.wrap(null)
	.help()
	.usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-relay') + ' [config_file]')
	.argv;

Promise.resolve()
	.then(function () {
		let spinner = utils.ora('opening config file: ' + configPath);
		let configPath = argv.configPath || path.normalize(path.join((process.env.USERPROFILE || process.env.HOME), '.config', 'zing-relay.json'));
		
		// open the config file
		nconf
			.file({
				file: configPath
			})
		spinner.finish('config', configPath);
	})
	then(function() {
let app = express();
let server = http.createServer(app).listen(argv.port);
	});



console.log('port', server.address);


process.on('SIGINT', function () {
	process.exit();
});