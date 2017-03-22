"use strict";

const chalk = require('chalk');
const Ora = require('ora');
const os = require('os');

let spaces = '                              '; // 30 spaces

module.exports.ora = function (opts) {
	let o = new Ora(opts);

	o.finish = function (name, value) {
		if (!value) {
			this.succeed(name);
			return;
		}

		let msg = chalk.dim(name + ':') + spaces.substring(0, 7 - name.length) + chalk.bold(value);
		if (value instanceof Error) {
			this.fail(msg);
		} else {
			this.succeed(msg);
		}
	};

	return o;
};

module.exports.myIP = function () {
	let addr = null;
	let ifaces = os.networkInterfaces()
	Object.keys(ifaces).forEach(function (ifname) {
		var alias = 0;

		ifaces[ifname].forEach(function (iface) {
			if ('IPv4' !== iface.family || iface.internal !== false) {
				// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
				return;
			}

			addr = iface.address;
		});
	});
	return addr;
}

module.exports.log = function (section, msg) {
	console.log(chalk.dim('[ ' + section + ' ]') + spaces.substring(0, 5 - section.length), msg);
}