const Lang = imports.lang;

String.prototype.times = function(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
};

const LogDecorator = new Lang.Class({
    Name: 'LogDecorator',
    _loggerFunction: log,

    setLogger: function(logger) {
        this._loggerFunction = logger;
    },

    _getLoggedFunction: function(object, func, name) {
        return Lang.bind(this, function() {
            let logText = name + '(';
            for (let i = 0; i < arguments.length; i++) {
                if (i > 0) {
                    logText += ', ';
                }
                logText += arguments[i];
            }
            logText += ');';

            this._loggerFunction.apply(this, [logText]);
            return func.apply(object, arguments);
        });
    },

    addLoggingToNamespace: function(namespaceObject) {
        /* jshint forin: false */
        for (let name in namespaceObject) {
            let potentialFunction = namespaceObject[name];
            if (Object.prototype.toString.call(potentialFunction) === '[object Function]') {
                namespaceObject[name] = this._getLoggedFunction(namespaceObject, potentialFunction, name);
            }
        }
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
