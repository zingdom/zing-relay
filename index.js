#!/usr/bin/env node

'use strict';

var chalk = require('chalk');
var figlet = require('figlet');
var package_json = require('./package.json');
var Scanner = require('./scanner');
var server = require('./server');
var updateNotifier = require('update-notifier');

updateNotifier({
	pkg: package_json
}).notify();

let argv = require('yargs')
	.strict()
	.option('token', {
		alias: 't',
		describe: '// zing site access token',
		type: 'string'
	})
	.option('name', {
		describe: '// display name of this relay',
		type: 'string'
	})
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
	.help('help', '// show help')
	.usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-relay'))
	.argv;

let scanner = new Scanner();

Promise.resolve()
	.then(scanner.setup.bind(scanner, argv.token, argv.name))
	.then(() => server(scanner, argv.port, argv.password))
	.then(scanner.start.bind(scanner))
	.catch(function (err) {
		console.error(chalk.red('ERROR'), err);
		process.exit(-1);
	});

process.on('SIGINT', function () {
	process.exit();
});