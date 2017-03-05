#!/usr/bin/env node

"use strict";

const chalk = require('chalk');
const figlet = require('figlet');
const getmac = require('getmac');
const LRU = require('lru-cache');
const mqtt = require('mqtt');
const noble = require('noble');
const package_json = require('./package.json');
const sprintf = require('sprintf-js').sprintf;

// ----- global variables
let _addr = null;
let _mqClient = null;
let _cache = LRU(256);

function normalizeAddr(addr) {
    let a = addr.replace(/[^0-9A-Fa-f]/g, '');
    if (a.length != 12) {
        throw new Error('invalid address: ' + addr + ' (' + a + ')');
    }

    a = a.toLowerCase();
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

function cacheAdd(addr, rssi, name) {
    let entry = _cache.get(addr);

    if (!entry) {
        entry = {
            'addr': addr,
            'rssi_total': 0,
            'rssi_count': 0
        };
        _cache.set(addr, entry);
    }

    // timestamp
    entry.time = new Date().getTime();

    // rssi
    if (rssi < 0) { // ignore invalid RSSI (rssi >= 0)
        entry.rssi_total += rssi;
        entry.rssi_count += 1;
    }

    // device name
    if (name) {
        entry.name = name;
    }
}

function cacheDrain() {
    _cache.rforEach(function(value, key) {
        if (value.rssi_count > 1) {
            _cache.del(value.addr);

            let age = Math.round((new Date().getTime() - value.time) / 65.536);
            let buffer = new Buffer(16);
            buffer[0] = (age >> 8) & 0xFF;
            buffer[1] = age & 0xFF;
            addrToBuffer(_addr, buffer, 2);
            addrToBuffer(value.addr, buffer, 8);
            buffer[14] = (Math.round(value.rssi_total / value.rssi_count) + 256) % 0xFF;
            buffer[15] = value.rssi_count;

            console.log(chalk.dim('[MQTT] '), buffer);

            _mqClient.publish('scan', buffer);
            return;
        }
    });
}

// ----- print logo
console.log(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n');

// ----- NOBLE events
noble.on('stateChange', function(state) {
    console.log(chalk.dim('[NOBLE]'), 'state is', state);
    if (state !== 'poweredOn') {
        throw new Error('bluetooth powered off or not available')
        return;
    }

    setup();
});

noble.on('discover', function(peripheral) {
    let addr = normalizeAddr(peripheral.uuid);
    cacheAdd(addr, peripheral.rssi, peripheral.advertisement.localName);
});

// ----- setup the global variables
function setup() {
    Promise.resolve()
        .then(() => new Promise(function(resolve, reject) {
            console.log(chalk.dim('[SETUP]'), 'getting own MAC address ...');

            getmac.getMac(function(err, addr) {
                if (err) {
                    reject(err);
                    return;
                }

                addr = normalizeAddr(addr);
                resolve(addr);
            });
        }))
        .then(addr => {
            console.log(chalk.dim('[SETUP]'), '...', chalk.bold(addr));
            _addr = addr;
        })
        .then(() => new Promise(function(resolve, reject) {
            console.log(chalk.dim('[SETUP]'), 'connecting to MQTT server ...');

            let client = mqtt.connect('mqtt://test1:blahblah12@intelligent-rhino.rmq.cloudamqp.com');
            client.on('connect', function() {
                resolve(client);
            });
            client.on('error', function(err) {
                reject(err);
            });

            client.on('reconnect', function() {
                console.log(chalk.dim('[MQTT] '), 'mqtt.Client.reconnect()', client);
            });

            client.on('close', function() {
                console.log(chalk.dim('[MQTT] '), 'mqtt.Client.close()', client);
                process.exit();
            });
        }))
        .then(client => {
            console.log(chalk.dim('[SETUP]'), '...', chalk.bold(client.connected ? 'CONNECTED' : 'DISCONNECTED'));
            _mqClient = client;
        })
        .then(() => {
            console.log(chalk.dim('[SETUP]'), 'start scanning ...');
            noble.startScanning([], true);
        })
        .catch(err => {
            console.error(chalk.bold('[ERROR]'));
            console.error(err);
            process.exit(1);
        });
}

setInterval(function() {
    if (!_cache.length || !_mqClient || !_mqClient.connected) {
        return;
    }

    cacheDrain();
}, 100);
