'use strict';

var chalk = require('chalk');
var Ora = require('ora');
var os = require('os');
var sll = require('single-line-log').stdout;

const SPACES = '                              '; // 30 spaces
let _sllPrev = '';

module.exports.ora = function (opts) {
	let o = new Ora(opts);

	o.finish = function (name, value) {
		if (!value) {
			this.succeed(name);
			return;
		}

		let msg = chalk.dim(name + ':') + SPACES.substr(0, 7 - name.length) + chalk.bold(value);
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
	let ifaces = os.networkInterfaces();
	Object.keys(ifaces).forEach(function (ifname) {
		ifaces[ifname].forEach(function (iface) {
			if ('IPv4' !== iface.family || iface.internal !== false) {
				// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
				return;
			}

			addr = iface.address;
		});
	});
	return addr;
};

module.exports.log = function (section, msg) {
	if (!GLOBAL.argv.plain) {
		sll(null);
	}

	console.log(to_log_header(section), msg);
};

module.exports.sll = function (section, msg) {
	if (typeof msg === 'undefined') {
		msg = _sllPrev;
	}
	_sllPrev = msg;

	if (GLOBAL.argv.plain) {
		console.log(to_log_header(section), msg);
	} else {
		sll(to_log_header(section), msg);
	}
};

function to_log_header(section) {
	let len = section.toString().length;
	let lpad = Math.max(0, 6 - len);
	let rpad = Math.max(0, 7 - len - lpad);
	let s = '[' + SPACES.substr(0, lpad) + section + SPACES.substr(0, rpad) + ']';

	return (GLOBAL.argv.plain ? s : chalk.dim(s)) + SPACES.substring(0, 9 - s.length);
}