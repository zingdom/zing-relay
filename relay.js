"use strict";

const chalk = require('chalk');
const EventEmitter = require('event-emitter-es6');
const figlet = require('figlet');
const fs = require('fs');
const getmac = require('getmac');
const jwt = require('jsonwebtoken');
const LRU = require('lru-cache');
const mqtt = require('mqtt');
const noble = require('noble');
const ora = require('ora');
const sprintf = require('sprintf-js').sprintf;

const KalmanFilter = require('./kalman');
const package_json = require('./package.json');
const zing_pub_key = require('./zing_pub_key');

function normalizeAddr(addr) {
    let a = addr.replace(/[^0-9A-Fa-f]/g, '');
    if (a.length != 12) {
        throw new Error('invalid address: ' + addr + ' (' + a + ')');
    }

    a = a.toLowerCase();
    return a.substring(0, 4) + ':' + a.substring(4, 6) + ':' + a.substring(6, 12);
}

function toStatusString(name, value) {
    let spaces = '                    ';
    return chalk.dim(name + ':') + spaces.substring(0, 6 - name.length) + chalk.bold(value);
}

class Relay extends EventEmitter {
    constructor() {
        super();

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
            noble //
                .on('stateChange', function(state) {
                    resolve(noble);
                    return;

                    if (state !== 'poweredOn') {
                        reject(new Error('bluetooth powered off or not available'));
                    }
                })
                .on('discover', function(peripheral) {
                    let addr = normalizeAddr(peripheral.uuid);
                    cacheAdd(addr, peripheral.rssi, peripheral.advertisement.localName);
                });
        });
    }

    _promiseGetMac() {
        return new Promise((resolve, reject) => {
            let spinner = ora('getting address...').start();

            getmac.getMac((err, addr) => {
                if (err) {
                    spinner.fail(err);
                    reject(err);
                    return;
                }
                addr = normalizeAddr(addr);

                spinner.succeed(toStatusString('Relay', addr));
                resolve(addr);
            });
        });
    }

    info() {
        return this._promiseGetMac();
    }

    _promiseVerifyToken(path) {
        return new Promise((resolve, reject) => {
            let spinner = ora('verifying token...').start();
            fs.readFile(path, 'utf8', (err, data) => {
                let token = err ? path : data;

                jwt.verify(token.trim(), zing_pub_key, (err, encoded) => {
                    if (err) {
                        spinner.fail(err);
                        reject(err);
                        return;
                    }

                    spinner.succeed(toStatusString('Site', encoded.sub));
                    resolve(encoded);
                });
            });
        });
    }

    _promiseSetupMqttClient(encoded) {
        return new Promise((resolve, reject) => {
            let spinner = ora('connecting...').start();

            let mqUrl = sprintf('mqtt:%s:%s@%s', encoded.username, encoded.password, encoded.host);
            let client = mqtt.connect(mqUrl);

            client.on('connect', function() {
                spinner.succeed(toStatusString('MQTT', 'CONNECTED'));
                resolve(client);
            });

            client.on('error', function(err) {
                console.log('error');
                spinner.fail(err);
                reject(err);
            });

            client.on('reconnect', function() {
                console.log('reconnect');
                // spinner = ora('connecting...').start();
            });

            client.on('close', function() {
                spinner.fail('failed!');
                reject(err);
            });
        });
    }

    _setupMqttClient() {}

    run(token) {
        return Promise.resolve()
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
            .then(this._promiseSetupNoble);
    }

    cacheAdd(addr, rssi, name) {
        let advEntry = _advertCache.get(addr);
        if (!advEntry) {
            advEntry = {
                count: 0
            };
            _advertCache.set(addr, advEntry);
        }
        advEntry.count++;

        let mqEntry = _mqCache.get(addr);
        if (!mqEntry) {
            mqEntry = {
                'addr': addr,
                'rssi_total': 0,
                'rssi_count': 0
            };
            _mqCache.set(addr, mqEntry);
        }

        // timestamp
        mqEntry.time = new Date().getTime();

        // rssi
        if (rssi < 0) { // ignore invalid RSSI (rssi >= 0)
            if (addr === '00ea:24:2efea4') {
                rssi = _kalman.filter(rssi);
            }

            mqEntry.rssi_total += rssi;
            mqEntry.rssi_count += 1;
        }

        // device name
        if (name) {
            mqEntry.name = name;
        }
    }

    cacheDrain() {
        _mqCache
            .rforEach(function(value, key) {
                let advEntry = _advertCache.peek(value.addr);
                if (advEntry && advEntry.count > 1 && value.rssi_count >= 1) {
                    _mqCache.del(value.addr);

                    let age = Math.round((new Date().getTime() - value.time) / 65.536);
                    let buffer = new Buffer(16);
                    buffer[0] = (age >> 8) & 0xFF;
                    buffer[1] = age & 0xFF;
                    addrToBuffer(_addr, buffer, 2);
                    addrToBuffer(value.addr, buffer, 8);
                    buffer[14] = (Math.round(value.rssi_total / value.rssi_count) + 256) % 0xFF;
                    buffer[15] = value.rssi_count;

                    console.log(chalk.dim('[MQTT ]'), buffer, value.name ?
                        value.name :
                        '');

                    _mqClient.publish('scan', buffer);
                    return;
                }
            });
    }

    addrToBuffer(addr, buffer, index) {
        buffer[index] = parseInt(addr.substring(0, 2), 16);
        buffer[index + 1] = parseInt(addr.substring(2, 4), 16);
        buffer[index + 2] = parseInt(addr.substring(5, 7), 16);
        buffer[index + 3] = parseInt(addr.substring(8, 10), 16);
        buffer[index + 4] = parseInt(addr.substring(10, 12), 16);
        buffer[index + 5] = parseInt(addr.substring(12, 14), 16);
    }
}

module.exports = Relay;
