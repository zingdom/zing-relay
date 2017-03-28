"use strict";

var chalk = require('chalk');
var fetch = require('node-fetch');
var getmac = require('getmac');
var LRU = require('lru-cache');
var mqtt = require('mqtt');
var noble = require('noble');
var sprintf = require('sprintf-js').sprintf;
var url = require('url');
var utils = require('./utils');

var KalmanFilter = require('./kalman');

function normalizeAddr(addr) {
	let a = addr.replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
	if (a.length != 12) {
		throw new Error('invalid address: ' + addr + ' (' + a + ')');
	}
	return a.substring(0, 4) + ':' + a.substring(4, 6) + ':' + a.substring(6, 12);
}

function addrToBuffer(addr, buffer, index) {
	buffer[index] = parseInt(addr.substring(0, 2), 16);
	buffer[index + 1] = parseInt(addr.substring(2, 4), 16);
	buffer[index + 2] = parseInt(addr.substring(5, 7), 16);
	buffer[index + 3] = parseInt(addr.substring(8, 10), 16);
	buffer[index + 4] = parseInt(addr.substring(10, 12), 16);
	buffer[index + 5] = parseInt(addr.substring(12, 14), 16);
}

class Scanner {
	constructor() {
		this.tickCounter = 0;
		this.myAddr = null;
		this.mqAccess = null;
		this.mqClient = null;
		this.mqCounter = 0;

		this.tracked = [];
		this.mqCache = LRU({
			max: 64,
			maxAge: 1000 * 60
		});
		this.randomAddrFilterCache = LRU({
			max: 1024,
			maxAge: 1000 * 60 * 5
		});
		this.nearbyDeviceCache = LRU({
			max: 64,
			maxAge: 1000 * 60
		});
		// this.kalman = new KalmanFilter(0.01, 5, 1);
	}

	_promiseSetupNoble() {
		return new Promise(function (resolve, reject) {
			let spinner = utils.ora('initializing BLE...').start();

			let counter = 0;
			let handle = setInterval(function () {
				if (counter++ >= 10) {
					let err = new Error('Bluetooth is powered off or not available, (state="' + noble.state + '")');
					spinner.finish('BLE', err);
					clearInterval(handle);
					reject(err);
					return;
				}

				if (noble.state === 'poweredOn') {
					spinner.finish('BLE', 'READY');
					clearInterval(handle);
					resolve(noble.state);
				}
			}, 500);
		});
	}

	_promiseGetMac() {
		return new Promise(function (resolve, reject) {
			let spinner = utils.ora('getting address...').start();

			getmac.getMac((err, addr) => {
				if (err) {
					spinner.finish('self', err);
					reject(err);
					return;
				}
				addr = normalizeAddr(addr);

				spinner.finish('self', addr);
				resolve(addr);
			});
		});
	}

	_promiseVerifyToken(token) {
		if (token) {
			return new Promise(function (resolve, reject) {
				let spinner = utils.ora('connecting to zing...').start();

				fetch(sprintf('https://api.zing.fm/v1/ext/%s', token))
					.then(res => res.json())
					.then(json => {
						spinner.finish('token', 'VERIFIED');
						resolve(json.data);
					})
					.catch(err => {
						spinner.finish('token', err);
						reject(err);
					});
			});
		}
	}

	_promiseSetupMqttClient(mqAccess) {
		return new Promise(function (resolve, reject) {
			let spinner = utils.ora('connecting...').start();

			let mqttUri = sprintf('mqtts://%s:%s@%s', mqAccess.name, mqAccess.password, mqAccess.host);
			let client = mqtt.connect(mqttUri);

			client.on('connect', function () {
				spinner.finish('MQTT', 'CONNECTED');
				resolve(client);
			});
			client.on('error', function (err) {
				spinner.finish('MQTT', err);
				reject(err);
			});
			client.on('reconnect', function () {
				console.error('MQTT reconnecting...');
			});
			client.on('close', function () {
				console.error('MQTT closed...');
				process.exit(-1);
			});
		});
	}

	setup(token) {
		return Promise.resolve()
			.then(this._promiseGetMac)
			.then(addr => {
				this.myAddr = addr;
			})
			.then(this._promiseVerifyToken.bind(this, token))
			.then(mqAccess => {
				if (mqAccess) {
					this.mqAccess = mqAccess;
					return this._promiseSetupMqttClient(mqAccess);
				}
			})
			.then(mqClient => {
				if (mqClient) {
					this.mqClient = mqClient;
				}
			})
			.then(this._promiseSetupNoble)
	}

	start() {
		return Promise.resolve()
			.then(state => {
				noble.on('discover', this._nobleOnDiscover.bind(this));
				noble.startScanning([], true);

				setInterval(this._tick.bind(this), 100);
			});
	}

	_nobleOnDiscover(peripheral) {
		let addr = normalizeAddr(peripheral.uuid);
		if (addr.indexOf('2015') === 0) {
			console.log(peripheral);
		}

		this._cacheAdd(addr, peripheral.rssi, peripheral.advertisement.localName);
	}

	_cacheAdd(addr, rssi, name) {
		let addrEntry = this.randomAddrFilterCache.get(addr);
		if (typeof addrEntry === 'undefined') {
			addrEntry = {
				count: 0
			}
			this.randomAddrFilterCache.set(addr, addrEntry);
		}
		addrEntry++;

		let nearbyEntry = this.nearbyDeviceCache.get(addr);
		if (typeof nearbyEntry === 'undefined') {
			nearbyEntry = {
				addr: addr,
				rssi: rssi,
				count: 0
			};
		}
		nearbyEntry.rssi = rssi;
		nearbyEntry.count++;
		if (name) {
			nearbyEntry.name = name;
		}
		this.nearbyDeviceCache.set(addr, nearbyEntry);

		nearbyEntry.tracked = this.tracked.indexOf(addr) >= 0;
		if (nearbyEntry.tracked) {
			let mqEntry = this.mqCache.get(addr);
			if (typeof mqEntry === 'undefined') {
				mqEntry = {
					'addr': addr,
					'rssi_total': 0,
					'rssi_count': 0
				};
				this.mqCache.set(addr, mqEntry);
			}

			mqEntry.time = new Date().getTime();
			if (rssi < 0) { // ignore invalid RSSI (rssi >= 0)
				mqEntry.rssi_total += rssi;
				mqEntry.rssi_count += 1;
			}
			if (name) {
				mqEntry.name = name;
			}
		}
	}

	_updateTrackedList(token) {
		return new Promise(function (resolve, reject) {
			let reqOpts = {
				host: 'api.zing.fm',
				port: 443,
				path: sprintf('/v1/ext/%s/device', token),
				headers: {
					accept: 'application/json'
				}
			};
			https.request(reqOpts, function (res) {
					let body = [];
					res.on('data', function (chunk) {
						body.push(chunk);
					});
					res.on('end', function () {
						let json = JSON.parse(Buffer.concat(body));
						if (json.success && json.data) {
							resolve(json.data);
						} else {
							let err = new Error(json);
							reject(err);
						}
					});
				})
				.on('error', function (err) {
					reject(err);
				})
				.end();
		});
	}

	_tick() {
		++this.tickCounter;
		utils.sll(this.tickCounter);

		if (this.tickCounter % 100 === 1) {
			if (this.mqAccess) {
				fetch(sprintf('https://api.zing.fm/v1/ext/%s/device', this.mqAccess.id))
					.then(res => res.json())
					.then(json => {
						this.tracked = json.data;
					})
					.catch(err => {
						utils.log('API', err);
					});
			}
		}

		if (this.tickCounter % 10 === 0) {
			this.nearbyDeviceCache.prune();
		}

		this.mqCache
			.rforEach((value, key) => {
				if (value.rssi_count === 0) {
					contine;
				}

				this.mqCache.del(value.addr);

				let age = Math.round((new Date().getTime() - value.time) / 65.536);
				let buffer = new Buffer(16);
				buffer[0] = (age >> 8) & 0xFF;
				buffer[1] = age & 0xFF;
				addrToBuffer(this.myAddr, buffer, 2);
				addrToBuffer(value.addr, buffer, 8);
				buffer[14] = (Math.round(value.rssi_total / value.rssi_count) + 256) % 0xFF;
				buffer[15] = value.rssi_count;

				utils.sll(this.tickCounter, 'MQTT: ' + buffer.toString('hex'));

				let topic = sprintf('s/%s/r/%s', this.mqAccess.siteKey, this.myAddr);
				this.mqClient.publish(topic, buffer);
				this.mqCounter++;

				return;
			});
	}
}

module.exports = Scanner;