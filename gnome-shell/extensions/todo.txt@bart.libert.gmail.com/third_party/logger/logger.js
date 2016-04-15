const Lang = imports.lang;
const DEFAULT_LEVEL = 250;

const Level = new Lang.Class({
    Name: 'Level',
    _init: function(name, prefix, weight) {
        this.name = name;
        this.prefix = prefix;
        this.weight = weight;
    }
});

const Logger = new Lang.Class({
    Name: 'Logger',

    _init: function(prefix, level) {
        if (prefix === undefined) {
            prefix = '';
        }
        if (level === undefined) {
            level = DEFAULT_LEVEL;
        }
        this._prefix = prefix;
        this._level = level;
        this._levels = {};
    },

    setPrefix: function(prefix) {
        this._prefix = prefix;
    },

    setLevel: function(level) {
        this._level = level;
    },

    log: function(message, level) {
        if (level >= this._level) {
            this._log(this._prefix + ' ' + message + '\r\n');
        }
    },

    addLevel: function(name, prefix, weight) {
        this._levels[weight] = new Level(name, prefix, weight);
        this[name] = Lang.bind(this, function(message) {
            this.log(prefix + ' ' + message, weight);
        });
    },

    getLevels: function() {
        return this._levels;
    },

    _log: function(message) {
        if (typeof log === 'function') {
            log(message);
            return;
        }
        if (typeof global.log === 'function') {
            global.log(message);
            return;
        }
    },
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
