"use strict";

var chalk = require('chalk');
var express = require('express'),
	app = express(),
	cors = require('cors'),
	session = require('express-session');

var http = require('http');
var passport = require('passport'),
	BasicStrategy = require('passport-http').BasicStrategy;
var randomstring = require('randomstring');

var package_json = require('./package.json');
var utils = require('./utils');

let _username = null;
let _password = null;
let _apiToken = randomstring.generate(16);
let _connections = [];

passport.use(new BasicStrategy(
	function (userid, password, verified) {
		if (userid === _username && password === _password) {
			return verified(null, {
				token: _apiToken
			});
		}
		if (password === _apiToken) {
			return verified(null, true);
		}
		return verified(null, false);
	}
));

module.exports = function (nconf, scanner) {
	_username = 'admin';
	_password = nconf.get('dash:password') || randomstring.generate(8);

	let spinner = utils.ora('starting server ...');
	app.use(cors());
	app.use(function (req, res, next) {
		let write = res.write;
		res.write = function (chunk) {
			if (req.user) {
				if (res.getHeader('Content-Type').indexOf('application/javascript') >= 0) {
					let idx = chunk.indexOf('16CHAR_API_TOKEN');
					if (idx >= 0) {
						chunk.write(req.user.token, idx, 16);
					}
				}
			}
			write.apply(this, arguments);
		};
		return next();
	});
	app.use('/', passport.authenticate('basic', {
			session: false
		}),
		express.static('public_html'));

	app.get('/api/info', function (req, res) {
		let info = {
			mac: scanner.myAddr,
			version: package_json.version,
		};

		if (scanner.mqClient) {
			info.mqtt = {
				status: scanner.mqClient.reconnecting ? 'reconnecting' : (scanner.mqClient.connected ? 'connected' : 'disconnected'),
				access: scanner.mqAccess,
				count: scanner.mqCounter
			};
		}

		res.json(info);
	});

	app.get('/api/discover', function (req, res) {
		let ret = [];
		scanner.nearbyDeviceCache.forEach(function (value, key) {
			ret.push(value);
		});
		res.json(ret);
	});

	app.post('/api/register', function (req, res) {});

	let ip = utils.myIP();
	let server = http.createServer(app).listen(nconf.get('dash:port'));

	spinner.finish('server', 'UP');

	console.log();
	utils.log('httpd', 'Listening on http://' + chalk.bold(ip + ':' + server.address().port));
	utils.log('httpd', '    username: \'' + chalk.bold(_username) + '\'');
	utils.log('httpd', '    password: \'' + chalk.bold(_password) + '\'');
	console.log();
};