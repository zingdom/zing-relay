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
		describe: '// dashboard port',
		type: 'number'
	})
	.option('password', {
		alias: 'w',
		default: '<random>',
		describe: '// dashboard password',
		type: 'string'
	})
	.option('token', {
		alias: 't',
		describe: '// zing site token',
		type: 'string'
	})
	.help('help', '// show help')
	.usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-spot') + ' [config_file]')
	.argv;

let scanner = new Scanner();

Promise.resolve()
	.then(promiseSetupConfig)
	.then(scanner.setup.bind(scanner, argv.token))
	.then(() => server(nconf, scanner))
	.then(scanner.start.bind(scanner))
	.catch(function (err) {
		console.error(chalk.red('ERROR'), err);
		process.exit(-1);
	});

function promiseSetupConfig() {
	return new Promise((resolve, reject) => {
		let spinner = utils.ora('opening config file');
		let configPath = argv._[0] || path.normalize(path.join((process.env.USERPROFILE || process.env.HOME), '.config', 'zing-spot.json'));

		// open the config file
		nconf.file({
			file: configPath
		});

		if (typeof argv.port !== 'undefined') {
			if (argv.port === 0) {
				nconf.clear('server:port');
			} else {
				nconf.set('server:port', argv.port);
			}
		}

		if (typeof argv.password !== 'undefined') {
			if (argv.password === '<random>') {
				nconf.clear('server:password');
			} else {
				nconf.set('server:password', argv.password);
			}
		}

		if (argv.token) {
			nconf.set('token', argv.token);
		}

		nconf.save(function (err) {
			if (err) {
				spinner.finish('config', err);
				reject(err);
				return;
			}

			spinner.finish('config', configPath);
			resolve(nconf);
		});
	});
}

process.on('SIGINT', function () {
	process.exit();
});