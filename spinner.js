"use strict";

const chalk = require('chalk');
const Ora = require('ora');

module.exports = function(opts) {
    let o = new Ora(opts);

    o.succeed2 = function(text1, text2) {
        if (!text2) {
            this.succeed(text1);
            return;
        }

        let spaces = '                              '; // 30 spaces
        this.succeed(chalk.dim(text1 + ':') + spaces.substring(0, 6 - text1.length) + chalk.bold(text2));
    };

    return o;
};
