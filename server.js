'use strict';

var chalk = require('chalk');
var express = require('express'),
	bodyParser = require('body-parser'),
	app = express();
var http = require('http');
var passport = require('passport'),
	BasicStrategy = require('passport-http').BasicStrategy;
var randomstring = require('randomstring');

var package_json = require('./package.json');
var utils = require('./utils');

let _username = 'admin';
let _password = null;
let _apiToken = randomstring.generate(16);

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

module.exports = function (scanner, port, password) {
	_password = password || randomstring.generate(8);

	let spinner = utils.ora('starting server ...');

	app.use(bodyParser.json())
		.use(function (req, res, next) {
			res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
			res.header('Expires', '-1');
			res.header('Pragma', 'no-cache');
			next();
		})
		.use(function (req, res, next) {
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
			next();
		})
		.use('/', passport.authenticate('basic', {
				session: false
			}),
			express.static(__dirname + '/public_html'));

	app.get('/api/info', function (req, res) {
		let info = {
			addr: scanner.addr,
			name: scanner.name,
			version: package_json.version,
			ticks: scanner.tickCounter,
			devices: scanner.tracked
		};

		if (scanner.mqttClient) {
			info.mqtt = {
				status: scanner.mqttClient.reconnecting ? 'reconnecting' : (scanner.mqttClient.connected ? 'connected' : 'disconnected'),
				access: scanner.extAccess,
				count: scanner.mqttCounter
			};
		}

		res.json(info);
	});

	app.get('/api/discover', function (req, res) {
		let ret = [];
		scanner.nearbyDeviceCache.forEach(function (value) {
			ret.push(value);
		});
		res.json(ret);
	});

	app.post('/api/register', function (req, res) {
		if (req.body.tracked) {
			scanner.registerDevice(req.body.addr, req.body.name)
				.then(success => {
					res.json({
						success: success
					});
				})
				.catch(err => {
					res.json({
						error: err
					});
				});
		} else {
			scanner.unregisterDevice(req.body.addr)
				.then(success => {
					res.json({
						success: success
					});
				})
				.catch(err => {
					res.json({
						error: err
					});
				});
		}
	});

	let ip = utils.myIP();
	let server = http.createServer(app).listen(port || 0);

	spinner.finish('server', 'UP');

	console.log();
	utils.log('httpd', 'Listening on http://' + chalk.bold(ip + ':' + server.address().port));
	utils.log('httpd', '    username: \'' + chalk.bold(_username) + '\'');
	utils.log('httpd', '    password: \'' + chalk.bold(_password) + '\'');
	console.log();
};