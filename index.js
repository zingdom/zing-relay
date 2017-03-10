#!/usr/bin/env node

"use strict";

const chalk = require('chalk');
const figlet = require('figlet');
const getmac = require('getmac');
const KalmanFilter = require('./kalman');
const LRU = require('lru-cache');
const mqtt = require('mqtt');
const noble = require('noble');
const package_json = require('./package.json');
const sprintf = require('sprintf-js').sprintf;
const yargs = require('yargs');

// ----- global variables
let _addr = null;
let _addrK = 'aaaa:bb:cccccc';
let _mqClient = null;
let _mqCache = LRU(256);
let _advertCache = LRU(1024);
let _kalman = new KalmanFilter(0.01, 1);

noble
    .on('stateChange', function(state) {
        console.log(chalk.dim('[NOBLE]'), 'state is', state);
        if (state !== 'poweredOn') {
            throw new Error('bluetooth powered off or not available')
            return;
        }

        setup();
    })
    .on('discover', function(peripheral) {
        let addr = normalizeAddr(peripheral.uuid);
        cacheAdd(addr, peripheral.rssi, peripheral.advertisement.localName);
    });

let promiseGetMac = function(prefix) {
    if (!prefix) {
        prefix = 'SETUP';
    }
    return new Promise(function(resolve, reject) {
        console.log(chalk.dim('[' + prefix + ']'), 'getting relay MAC address ...');

        getmac.getMac(function(err, addr) {
            if (err) {
                reject(err);
                return;
            }

            addr = normalizeAddr(addr);
            resolve(addr);
        });
    });
}

function normalizeAddr(addr) {
    let a = addr.replace(/[^0-9A-Fa-f]/g, '');
    if (a.length != 12) {
        throw new Error('invalid address: ' + addr + ' (' + a + ')');
    }

    a = a.toLowerCase();
    return a.substring(0, 4) + ':' + a.substring(4, 6) + ':' + a.substring(6, 12);
}

function setup() {
    yargs
        .strict()
        .option('host', {
            alias: 'h',
            describe: '// ZING ingest server hostname',
            type: 'string'
        })
        .option('token', {
            alias: 't',
            describe: '// ZING ingest token',
            type: 'string'
        })
        .command('info', '// information about this node', {}, function(argv) {
            promiseGetMac('INFO ') //
                .then((addr) => {
                    console.log(chalk.dim('[INFO ]'), '->', chalk.bold(addr));
                    process.exit(0);
                });
        })
        .command('start', '// start this relay node', {}, function(argv) {
            promiseGetMac('RUN  ') //
                .then((addr) => {
					_addr = addr;
                    console.log(chalk.dim('[RUN  ]'), '->', chalk.bold(addr));
                })
                .then(() => new Promise(function(resolve, reject) {
                    console.log(chalk.dim('[RUN  ]'), 'connecting to MQTT server ...');

                    let client = mqtt.connect('mqtt://test1:blahblah12@intelligent-rhino.rmq.cloudamqp.com');
                    client.on('connect', function() {
                        resolve(client);
                    });
                    client.on('error', function(err) {
                        reject(err);
                    });

                    client.on('reconnect', function() {
                        console.log(chalk.dim('[MQTT ]'), 'mqtt.Client.reconnect()', client);
                    });

                    client.on('close', function() {
                        console.log(chalk.dim('[MQTT ]'), 'mqtt.Client.close()', client);
                        process.exit();
                    });
                }))
                .then(client => {
					_mqClient = client;
                    console.log(chalk.dim('[RUN  ]'), '->', chalk.bold(client.connected ?
                        'CONNECTED' :
                        'DISCONNECTED'));
                })
                .then(() => {
                    console.log(chalk.dim('[RUN  ]'), 'start scanning ...');
                    noble.startScanning([], true);
                })
                .catch(err => {
                    console.error(chalk.bold('[ERROR]'));
                    console.error(err);
                    process.exit(1);
                });
        })
        .wrap(null)
        .usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-relay') + ' <command>')
        .demand(1, null)
        .argv;

    setInterval(function() {
        if (!_mqCache.length || !_mqClient || !_mqClient.connected) {
            return;
        }

        cacheDrain();
    }, 100);
}


function addrToBuffer(addr, buffer, index) {
    buffer[index] = parseInt(addr.substring(0, 2), 16);
    buffer[index + 1] = parseInt(addr.substring(2, 4), 16);
    buffer[index + 2] = parseInt(addr.substring(5, 7), 16);
    buffer[index + 3] = parseInt(addr.substring(8, 10), 16);
    buffer[index + 4] = parseInt(addr.substring(10, 12), 16);
    buffer[index + 5] = parseInt(addr.substring(12, 14), 16);
}

function cacheAdd(addr, rssi, name) {
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
		if(addr === '00ea:24:2efea4')
		{
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

function cacheDrain() {
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

                console.log(chalk.dim('[MQTT ]'), buffer, value.name ? value.name : '');

                _mqClient.publish('scan', buffer);
                return;
            }
        });
}
