#!/usr/bin/env node

"use strict";

const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const KalmanFilter = require('./kalman');
const noble = require('noble');
const package_json = require('./package.json');
const Relay = require('./relay');
const Table = require('cli-table');

let relay = new Relay();

require('yargs')
    .strict()
    .command('info', '// information about this relay', {}, function(argv) {
        relay.info()
            .then(addr => {
                process.exit();
            })
            .catch(err => {
                process.exit(-1);
            });
    })
    .command('run', '// start this relay node', (yargs) => {
        yargs //
            .usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-relay run'))
            .option('token', {
                alias: 't',
                describe: '// auth token',
                type: 'string'
            })
            .demandOption(['token'])
    }, function(argv) {
        relay.run(argv.token)
            .then(addr => {
                process.exit();
            })
            .catch(err => {
				console.error(err);
                process.exit(-1);
            });

        // promiseGetMac('RUN  ') //
        // .then(() => new Promise(function(resolve, reject) {
        //     console.log(chalk.dim('[RUN  ]'), 'connecting to MQTT server ...');
        //
        //     let
        // })).then(client => {
        //     _mqClient = client;
        //     console.log(chalk.dim('[RUN  ]'), '->', chalk.bold(client.connected ?
        //         'CONNECTED' :
        //         'DISCONNECTED'));
        // }).then(() => {
        //     console.log(chalk.dim('[RUN  ]'), 'start scanning ...');
        //     noble.startScanning([], true);
        // }).catch(err => {
        //     console.error(chalk.bold('[ERROR]'));
        //     console.error(err);
        //     process.exit(1);
        // });
    }) //
    .wrap(null)
    .usage(figlet.textSync('ZING') + ' (' + package_json.version + ')\n\n' + ' Usage: ' + chalk.bold('zing-relay') + ' <command>')
    .demand(1, null)
    .argv;

// ----- global variables

function setup() {
}
