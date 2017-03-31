'use strict';

var fetch = require('node-fetch');
var LRU = require('lru-cache');
var mqtt = require('mqtt');
var noble = require('noble');
var os = require('os');
var sprintf = require('sprintf-js').sprintf;
var utils = require('./utils');

const API_BASE = 'https://api.zing.fm/v1';

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
		this.addr = null;
		this.name = null;
		this.token = null;
		this.extAccess = null;
		this.mqttClient = null;
		this.mqttCounter = 0;

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

	_setupNoble() {
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
					resolve(noble.address);
				}
			}, 500);
		});
	}

	_verifyToken(token, relayKey, relayName) {
		if (token) {
			return new Promise(function (resolve, reject) {
				let spinner = utils.ora('connecting to zing...').start();

				fetch(sprintf('%s/ext/%s', API_BASE, token), {
						method: 'PUT',
						headers: {
							'Accept': 'application/json',
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							key: relayKey,
							name: relayName
						})
					})
					.then(res => res.json())
					.then(json => {
						if (json.success && json.data) {
							spinner.finish('token', 'VERIFIED');
							resolve(json.data);
						} else {
							throw new Error(json);
						}
					})
					.catch(err => {
						spinner.finish('token', 'Failed to verify');
						reject(err);
					});
			});
		}
	}

	_setupMqttClient(extAccess) {
		return new Promise(function (resolve, reject) {
			let spinner = utils.ora('connecting...').start();

			let mqttUri = sprintf('mqtts://%s:%s@%s:%d', extAccess.mqtt.username, extAccess.mqtt.password, extAccess.mqtt.host, extAccess.mqtt.port);
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

	setup(token, name) {
		this.token = token || null;
		this.name = name || os.hostname();
		return Promise.resolve()
			.then(this._setupNoble)
			.then(addr => {
				this.addr = normalizeAddr(addr);
			})
			.then(() => this._verifyToken(token, this.addr, this.name))
			.then(extAccess => {
				if (extAccess) {
					this.extAccess = extAccess;
					return this._setupMqttClient(extAccess);
				}
			})
			.then(mqttClient => {
				if (mqttClient) {
					this.mqttClient = mqttClient;
				}
			});
	}

	start() {
		return Promise.resolve()
			.then(() => {
				noble.on('discover', this._nobleOnDiscover.bind(this));
				noble.startScanning([], true);

				setInterval(this._tick.bind(this), 100);
			});
	}

	registerDevice(deviceKey, deviceName) {
		return fetch(sprintf('%s/ext/%s/device', API_BASE, this.token), {
				method: 'PUT',
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					key: deviceKey,
					name: deviceName
				})
			})
			.then(res => res.json())
			.then(json => {
				if (!json.success || !json.data)
					throw new Error(json);

				return (json.data);
			});
	}

	unregisterDevice(deviceKey) {
		return fetch(sprintf('%s/ext/%s/device/%s', API_BASE, this.token, deviceKey), {
				method: 'DELETE'
			})
			.then(res => res.json())
			.then(json => {
				if (!json.success || !json.data)
					throw new Error(json);

				return (json.data);
			});
	}

	_nobleOnDiscover(peripheral) {
		let addr = normalizeAddr(peripheral.uuid);

		/*
		if (peripheral.addressType !== 'public') {
			let p = _.omitBy(peripheral, function (v, k) {
				if (k === '_noble') {
					return true;
				}

				if (typeof v === 'function' ||
					typeof v === 'undefined' ||
					v === null) {
					return true;
				}

				return false;
			});
			console.dir(p, {
				colors: true,
				depth: null
			});
		}
		*/
		this._cacheAdd(addr, peripheral.rssi, peripheral.advertisement);
	}

	_cacheAdd(addr, rssi, advertisement) {
		let addrEntry = this.randomAddrFilterCache.get(addr);
		if (typeof addrEntry === 'undefined') {
			addrEntry = {
				count: 0
			};
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
		if (advertisement.localName) {
			nearbyEntry.name = advertisement.localName;
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
			if (advertisement) {
				mqEntry.advert = advertisement;
			}
		}
	}

	_tick() {
		++this.tickCounter;
		utils.sll(this.tickCounter);

		if (this.tickCounter % 100 === 1) {
			if (this.extAccess) {
				fetch(sprintf('%s/ext/%s/device', API_BASE, this.token))
					.then(res => res.json())
					.then(json => {
						if (json.success && json.data) {
							this.tracked = json.data;
						}
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
			.rforEach((value) => {
				if (value.rssi_count === 0)
					return;

				this.mqCache.del(value.addr);

				let buffer = new Buffer(8);
				let age = Math.round((new Date().getTime() - value.time) / 65.536);
				buffer[0] = Math.min(0xFF, age);
				addrToBuffer(value.addr, buffer, 1);
				buffer[7] = (Math.round(value.rssi_total / value.rssi_count) + 256) % 0xFF;

				if (value.advert.manufacturerData) {
					buffer = Buffer.concat([buffer, value.advert.manufacturerData]);
				}

				utils.sll(this.tickCounter, 'MQTT: ' + buffer.toString('hex'));

				let topic = sprintf('s/%s/r/%s', this.extAccess.site.key, this.addr);
				this.mqttClient.publish(topic, buffer);
				this.mqttCounter++;

				return;
			});
	}
}

module.exports = Scanner;