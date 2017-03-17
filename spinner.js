"use strict";

const chalk = require('chalk');
const Ora = require('ora');

module.exports = function(opts) {
    let o = new Ora(opts);

    o.finish = function(name, value) {
        if (!value) {
            this.succeed(name);
            return;
        }

        let spaces = '                              '; // 30 spaces
        let msg = chalk.dim(name + ':') + spaces.substring(0, 6 - name.length) + chalk.bold(value);
        if (value instanceof Error) {
            this.fail(msg);
        } else {
            this.succeed(msg);
        }
    };

    return o;
};
