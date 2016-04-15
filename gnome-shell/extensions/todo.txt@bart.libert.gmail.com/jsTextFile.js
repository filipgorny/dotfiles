const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Errors = Extension.imports.errors;
const Utils = Extension.imports.utils;

const JsTextFile = new Lang.Class({
    Name: 'JsTextFile',

    _init: function(path, logger) {
        if (typeof logger == 'undefined') {
            this.logger = Utils.getDefaultLogger();
        }
        else {
            this.logger = logger;
        }
        if (typeof path == 'undefined') {
            throw new Errors.IoError('JsTextFile: no path specified', this.logger.error);
        }
        this.logger.debug('Creating JsTextFile for path ' + path);
        this.path = path;
        this.lines = null;
        this._loadLines();
    },

    // Returns true if file exists, false if not
    exists: function() {
        if (GLib.file_test(this.path, GLib.FileTest.EXISTS)) {
            return true;
        }
        this.logger.error('JsTextFile: File does not exist : ' + this.path);
        return false;
    },

    // Loads all lines from the text file
    _loadLines: function() {
        if (!this.exists()) {
            throw new Errors.IoError('JsTextFile: trying to load non-existing file ' + this.path,
                this.logger.error);
        }
        let file = Gio.file_new_for_path(this.path);
        let [result, contents] = file.load_contents(null);
        if (!result) {
            this.logger.error('Could not read file: ' + this.path);
            throw new Errors.IoError('JsTextFile: trying to load non-existing file ' + this.path,
                this.logger.error);
        }
        let content = contents.toString();
        if (content.slice(-1) == '\n') {
            content = content.slice(0, -1);
        }
        this.lines = content.split('\n');
    },

    // Returns the number in the lines-array that contains the matching string
    // Returns -1 if text is not found
    _getLineNum: function(text) {
        if (!this.exists()) {
            return -1;
        }
        return this.lines.indexOf(text);
    },

    // Saves the lines to a file
    saveFile: function(removeEmptyLines) {
        if (!this.exists()) {
            return;
        }
        if (removeEmptyLines === true) {
            this._removeEmptyLines();
        }
        try {
            let lines = this.lines.join('\n');
            // make sure file ends with a newline
            GLib.file_set_contents(this.path, lines + '\n');
        }
        catch (exception) {
            throw new Errors.FileWriteError(exception.toString(), this.path, this.logger.error);
        }
    },

    _removeEmptyLines: function() {
        this.lines = this.lines.filter(function(value) {
            return (value !== '');
        });
    },

    getLines: function() {
        if (!this.exists()) {
            this.logger.error('JsTextFile: no path specified');
        }
        return this.lines;
    },

    removeLine: function(text) {
        let lineNum = this._getLineNum(text);
        if (lineNum == -1) {
            return false;
        }
        this.lines.splice(lineNum, 1);
        return true;
    },

    addLine: function(text) {
        if (!this.exists()) {
            return false;
        }
        this.lines.push(text);
        return true;
    },

    modifyLine: function(oldtext, newtext) {
        if (this.removeLine(oldtext)) {
            return this.addLine(newtext);
        }
        return false;
    },

    setLines: function(newlines) {
        this.lines = newlines;
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
