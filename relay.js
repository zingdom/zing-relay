"use strict";

const chalk = require('chalk');
const fs = require('fs');
const getmac = require('getmac');
const jwt = require('jsonwebtoken');
const LRU = require('lru-cache');
const mqtt = require('mqtt');
const noble = require('noble');
const ora2 = require('./spinner');
const sprintf = require('sprintf-js').sprintf;

const KalmanFilter = require('./kalman');
const zing_pub_key = require('./zing_pub_key');

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

class Relay {
	constructor() {
		this.myAddr = null;
		this.mqConnOptions = null;
		this.mqClient = null;

		this.mqCache = LRU(256);
		this.advertCache = LRU(1024);
		this.kalman = new KalmanFilter(0.01, 5, 1);
	}

	isValid() {
		return this.myAddr != null && this.mqConnOptions != null;
	}

	_promiseSetupNoble() {
		return new Promise((resolve, reject) => {
			let spinner = ora2('initializing BLE...').start();

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
		return new Promise((resolve, reject) => {
			let spinner = ora2('getting address...').start();

			getmac.getMac((err, addr) => {
				if (err) {
					spinner.finish('Relay', err);
					reject(err);
					return;
				}
				addr = normalizeAddr(addr);

				spinner.finish('Relay', addr);
				resolve(addr);
			});
		});
	}

	_promiseVerifyToken(path) {
		return new Promise((resolve, reject) => {
			let spinner = ora2('verifying token...').start();
			fs.readFile(path, 'utf8', (err, data) => {
				let token = err ?
					path :
					data;

				jwt.verify(token.trim(), zing_pub_key, (err, encoded) => {
					if (err) {
						spinner.finish('Token', err);
						reject(err);
						return;
					}

					spinner.finish('Token', 'VERIFIED, site=\'' + encoded.sub + '\'');
					resolve(encoded);
				});
			});
		});
	}

	_promiseSetupMqttClient(encoded) {
		return new Promise((resolve, reject) => {
			let spinner = ora2('connecting...').start();

			let mqUrl = sprintf('mqtt:%s:%s@%s', encoded.username, encoded.password, encoded.host);
			let client = mqtt.connect(mqUrl);

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

	info() {
		return this._promiseGetMac();
	}

	run(token) {
		return Promise
			.resolve()
			.then(this._promiseGetMac)
			.then(addr => {
				this.myAddr = addr;
				return token;
			})
			.then(this._promiseVerifyToken)
			.then(encoded => {
				this.mqConnOptions = encoded;
				return encoded;
			})
			.then(this._promiseSetupMqttClient)
			.then(client => {
				this.mqClient = client;
			})
			.then(this._promiseSetupNoble)
			.then(state => {
				noble.on('discover', this.noble_onDiscover.bind(this));
				noble.startScanning([], true);

				setInterval(this.cacheDrain.bind(this), 100);
			});
	}

	noble_onDiscover(peripheral) {
		let addr = normalizeAddr(peripheral.uuid);
		this.cacheAdd(addr, peripheral.rssi, peripheral.advertisement.localName);
	}

	cacheAdd(addr, rssi, name) {
		let advertEntry = this.advertCache.get(addr);
		if (typeof advertEntry === 'undefined') {
			advertEntry = {
				count: 0
			};
			this.advertCache.set(addr, advertEntry);
		}
		advertEntry.count++;

		let mqEntry = this.mqCache.get(addr);
		if (typeof mqEntry === 'undefined') {
			mqEntry = {
				'addr': addr,
				'rssi_total': 0,
				'rssi_count': 0
			};
			this.mqCache.set(addr, mqEntry);
		}

		// timestamp
		mqEntry.time = new Date().getTime();

		// rssi
		if (rssi < 0) { // ignore invalid RSSI (rssi >= 0)
			mqEntry.rssi_total += rssi;
			mqEntry.rssi_count += 1;
		}

		// device name
		if (name) {
			mqEntry.name = name;
		}
	}

	cacheDrain() {
		this.mqCache
			.rforEach((value, key) => {
				let advertEntry = this.advertCache.peek(value.addr);
				if (advertEntry && advertEntry.count > 1 && value.rssi_count >= 1) {
					this.mqCache.del(value.addr);

					let age = Math.round((new Date().getTime() - value.time) / 65.536);
					let buffer = new Buffer(16);
					buffer[0] = (age >> 8) & 0xFF;
					buffer[1] = age & 0xFF;
					addrToBuffer(this.myAddr, buffer, 2);
					addrToBuffer(value.addr, buffer, 8);
					buffer[14] = (Math.round(value.rssi_total / value.rssi_count) + 256) % 0xFF;
					buffer[15] = value.rssi_count;

					console.log(chalk.dim('[MQTT]'),
						buffer,
						value.name ? value.name : '');

					this.mqClient.publish('scan', buffer);
					return;
				}
			});
	}
}

module.exports = Relay;