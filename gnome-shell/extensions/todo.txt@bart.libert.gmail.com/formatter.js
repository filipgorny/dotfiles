const Class = imports.lang.Class;
const Params = imports.misc.params;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Errors = Extension.imports.errors;
const Utils = Extension.imports.utils;

const DEFAULT_LEFT_DELIMITER = '%';
const DEFAULT_RIGHT_DELIMITER = '';
const DEFAULT_TOKEN_LENGTH = 1;

const ORIG_REGEX_POSITION = 0;
const PAD_LENGTH_POSTION = 2;
const PAD_DIRECTION_POSITION = 3;
const PAD_CHARACTER_POSITION = 4;
const TOKEN_POSITION = 5;

const Formatter = new Class({
    Name: 'Formatter',
    _format: null,
    _leftDelimiter: DEFAULT_LEFT_DELIMITER,
    _rightDelimiter: DEFAULT_RIGHT_DELIMITER,
    _replacements: {},
    _tokenLength: DEFAULT_TOKEN_LENGTH,

    _init: function(format, logger) {
        this.setFormatString(format);
        if (typeof logger != 'undefined') {
            this.logger = logger;
        }
        else {
            this.logger = Utils.getDefaultLogger();
        }
    },

    setLogger: function(logger) {
        this.logger = logger;
    },

    setLeftDelimiter: function(left) {
        if (typeof left == 'undefined') {
            this._leftDelimiter = DEFAULT_LEFT_DELIMITER;
            return;
        }
        this._leftDelimiter = left;
    },

    setRightDelimiter: function(right) {
        if (typeof right == 'undefined') {
            this._rightDelimiter = DEFAULT_RIGHT_DELIMITER;
            return;
        }
        this._rightDelimiter = right;
    },

    setFormatString: function(string) {
        if (typeof string != 'undefined') {
            this._format = string;
            return;
        }
        this._format = null;
    },

    _verifyConfiguration: function() {
        if (this._rightDelimiter.length === 0 && this._tokenLength === 0) {
            throw new Errors.ConfigurationError('No end delimiter and no token length specified!',
                this.logger.error);
        }
    },

    _isFixedLengthPattern: function() {
        return (this._tokenLength !== 0);
    },

    _getIteratorPattern: function() {
        if (this._isFixedLengthPattern()) {
            return '{' + this._tokenLength + '}';
        }
        else {
            return '*';
        }
    },

    _getTokenPattern: function() {
        let tokenPattern = new RegExp(
            this._leftDelimiter +
            this._getPaddingPattern() +
            '([A-Za-z]' +
            this._getIteratorPattern() +
            ')' +
            this._rightDelimiter,
            'g');
        return tokenPattern;
    },

    _getPaddingPattern: function() {
        if (this._isFixedLengthPattern()) {
            return '(([0-9]*)([lrLR])(.?))?';
        }
        return '(([0-9]*)([lrLR])(.?):)?';
    },

    _getPaddingLength: function(toBePadded, targetLength) {
        return targetLength - toBePadded.toString().length;
    },

    _padLeft: function(toBePadded, paddingLength, padCharacter) {
        return Array(paddingLength + 1).join(padCharacter) + toBePadded;
    },

    _padRight: function(toBePadded, paddingLength, padCharacter) {
        return toBePadded + Array(paddingLength + 1).join(padCharacter);
    },

    _padToken: function(toBePadded, matchedString) {
        if (typeof matchedString[PAD_LENGTH_POSTION] == 'undefined') {
            return toBePadded;
        }
        if (typeof matchedString[PAD_DIRECTION_POSITION] == 'undefined') {
            return toBePadded;
        }
        let targetLength = parseInt(matchedString[PAD_LENGTH_POSTION]);
        if (typeof toBePadded == 'function') {
            toBePadded = toBePadded();
        }
        if (targetLength <= toBePadded.toString().length) {
            return toBePadded;
        }
        let padCharacter = ' ';
        if ((typeof matchedString[PAD_CHARACTER_POSITION] != 'undefined') &&
            (matchedString[PAD_CHARACTER_POSITION] !== '')) {
            padCharacter = matchedString[PAD_CHARACTER_POSITION];
        }
        let paddingLength = this._getPaddingLength(toBePadded, targetLength);
        if (matchedString[PAD_DIRECTION_POSITION] == 'l') {
            return this._padLeft(toBePadded, paddingLength, padCharacter);
        }
        if (matchedString[PAD_DIRECTION_POSITION] == 'r') {
            return this._padRight(toBePadded, paddingLength, padCharacter);
        }
        let rightPadded = null;
        let rightPadLength = 0;
        let leftPadLength = 0;
        if (matchedString[PAD_DIRECTION_POSITION] == 'R') {
            rightPadLength = Math.ceil(paddingLength / 2);
            rightPadded = this._padRight(toBePadded, rightPadLength, padCharacter);
            leftPadLength = paddingLength - rightPadLength;
        }
        if (matchedString[PAD_DIRECTION_POSITION] == 'L') {
            leftPadLength = Math.ceil(paddingLength / 2);
            rightPadLength = paddingLength - leftPadLength;
            rightPadded = this._padRight(toBePadded, rightPadLength, padCharacter);
        }
        if (rightPadded === null) {
            return toBePadded;
        }
        return this._padLeft(rightPadded, leftPadLength, padCharacter);
    },

    _parseMatch: function(match, resultString, overrideReplacements) {
        let token = match[TOKEN_POSITION];
        let replacements = this._replacements;
        if (overrideReplacements !== null) {
            replacements = overrideReplacements;
        }
        if (typeof replacements[token] == 'undefined') {
            throw new Errors.UndefinedTokenError('No replacement defined for token ' + token, this.logger.error);
        }
        let replaceRegex = new RegExp(match[ORIG_REGEX_POSITION], 'g');
        let paddedToken = this._padToken(replacements[token], match);
        return resultString.replace(replaceRegex, paddedToken);
    },

    getString: function(params) {
        let parameters = Params.parse(params, {
            formatString: this._format,
            overrideReplacements: null
        });
        let format = parameters.formatString;
        this._verifyConfiguration();
        let tokenPattern = this._getTokenPattern();
        let match = tokenPattern.exec(format);

        let resultString = format;
        while ((match !== null) && (typeof match != 'undefined')) {
            resultString = this._parseMatch(match, resultString, parameters.overrideReplacements);
            match = tokenPattern.exec(format);
        }
        return resultString;
    },

    setReplacement: function(token, replacement) {
        if (typeof token == 'undefined') {
            return true;
        }
        if (/^[A-Za-z]*$/.test(token) === false) {
            return false;
        }
        if (typeof replacement == 'undefined' || replacement === null) {
            delete this._replacements[token];
            return true;
        }
        this._replacements[token] = replacement;
        return true;
    },

    setTokenLength: function(length) {
        this._tokenLength = length;
    }

});
/* vi: set expandtab tabstop=4 shiftwidth=4: */
