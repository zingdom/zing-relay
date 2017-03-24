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
		describe: '// dashboard password',
		type: 'string'
	})
	.option('token', {
		alias: 't',
		describe: '// zing site token',
		type: 'string'
	})
	.help('help', '// show help')
	.usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-relay') + ' [config_file]')
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

process.on('SIGINT', function () {
	process.exit();
});

function promiseSetupConfig() {
	let spinner = utils.ora('opening config file');

	return Promise.resolve()
		.then(() => new Promise(function (resolve, reject) {
			if (!argv._.length) {
				nconf.use('memory');
				resolve(null);
			} else {
				let configPath = argv._[0];
				nconf.file({
						file: configPath
					})
					.load(function (err) {
						if (err) {
							spinner.finish('config', err);
							reject(err);
							return;
						}

						resolve(configPath);
					});
			}
		}))
		.then(configPath => new Promise(function (resolve, reject) {
			if (typeof argv.port !== 'undefined') {
				if (argv.port === 0) {
					nconf.clear('dash:port');
				} else {
					nconf.set('dash:port', argv.port);
				}
			}

			if (typeof argv.password !== 'undefined') {
				if (argv.password === '') {
					nconf.clear('dash:password');
				} else {
					nconf.set('dash:password', argv.password);
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

				spinner.finish('config', configPath ? configPath : '<memory>');
				resolve(nconf);
			});
		}));
}