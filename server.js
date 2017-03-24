"use strict";

var chalk = require('chalk');
var express = require('express'),
	app = express(),
	cors = require('cors'),
	sse = require('./server-sse');

var http = require('http');
var passport = require('passport'),
	BasicStrategy = require('passport-http').BasicStrategy;
var randomstring = require('randomstring');

var package_json = require('./package.json');
var utils = require('./utils');

let _username = null;
let _password = null;
let _connections = [];

passport.use(new BasicStrategy(
	function (username, password, done) {
		if (username !== _username || _password != password) {
			return done(null, false);
		}

		return done(null, {
			username: _username
		});
	}
));

module.exports = function (nconf, scanner) {
	_username = 'admin';
	_password = nconf.get('dash:password') || randomstring.generate(8);

	let spinner = utils.ora('starting server ...');
	app.use(cors());
	app.use('/', passport.authenticate('basic', {
			session: false
		}),
		express.static('public_html'));

	app.get('/api/info', function (req, res) {
		res.json({
			mac: scanner.myAddr,
			version: package_json.version
		});
	});

	app.get('/api/discover', function (req, res) {
		let ret = [];
		scanner.mqCache.forEach(function (value, key) {
			ret.push(value);
		});
		res.json(ret);
	});

	let ip = utils.myIP();
	let server = http.createServer(app).listen(nconf.get('dash:port'));

	spinner.finish('server', 'UP');

	console.log();
	utils.log('HTTP', 'Listening on http://' + chalk.bold(ip + ':' + server.address().port));
	utils.log('HTTP', '    username: \'' + chalk.bold(_username) + '\'');
	utils.log('HTTP', '    password: \'' + chalk.bold(_password) + '\'');
	console.log();
};
