"use strict";

const chalk = require('chalk');
const fs = require('fs');
const getmac = require('getmac');
const jwt = require('jsonwebtoken');
const LRU = require('lru-cache');
const mqtt = require('mqtt');
const noble = require('noble');
const sprintf = require('sprintf-js').sprintf;
const url = require('url');
const utils = require('./utils');

const KalmanFilter = require('./kalman');

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
		this.site = null;
		this.myAddr = null;

		this.mqClient = null;
		this.mqCache = LRU({
			max: 64,
			maxAge: 1000 * 60
		});
		this.advertCache = LRU({
			max: 1024,
			maxAge: 1000 * 60
		});
		// this.kalman = new KalmanFilter(0.01, 5, 1);
	}

	_promiseSetupNoble() {
		return new Promise((resolve, reject) => {
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
		return new Promise((resolve, reject) => {
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

	_promiseSetupMqttClient(mqttUri) {
		return new Promise((resolve, reject) => {
			let spinner = utils.ora('connecting...').start();

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

	setup() {
		return Promise.resolve()
			.then(this._promiseGetMac)
			.then(addr => {
				this.myAddr = addr;
			})
			.then(this._promiseSetupNoble)
	}

	start(token) {
		return Promise.resolve()
			.then(state => {
				noble.on('discover', this._nobleOnDiscover.bind(this));
				noble.startScanning([], true);

				setInterval(this._tick.bind(this), 100);
			});
	}

	run2(mqttUri) {
		return Promise.resolve()
			.then(addr => {
				let auth = url.parse(mqttUri).auth;
				if (typeof auth === 'undefined') {
					throw new Error('badly formatted MQTT URI');
				}

				this.site = auth.substring(0, auth.indexOf('-'));
				console.log('site', this.site);

				return mqttUri;
			})
			.then(this._promiseSetupMqttClient)
			.then(client => {
				this.mqClient = client;
			})
			.then(state => {

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
		mqEntry.published = false;

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

	_tick() {
		this.mqCache.prune();

		if (!this.mqClient) {
			return;
		}

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

					let topic = sprintf('site/%s/%s', this.mqConnOptions.sub, this.myAddr);
					this.mqClient.publish(topic, buffer);
					return;
				}
			});
	}
}

module.exports = Scanner;