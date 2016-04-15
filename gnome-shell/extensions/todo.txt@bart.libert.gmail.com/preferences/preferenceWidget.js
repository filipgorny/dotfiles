const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Params = imports.misc.params;
const Signals = imports.signals;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Extension.imports.utils;
const _ = imports.gettext.domain('todotxt').gettext;

const PreferenceWidget = new GObject.Class({
    Name: 'PreferenceWidget',
    GTypeName: 'PreferenceWidget',
    Extends: Gtk.Box,
    _params: null,
    _help: null,
    _settings: null,
    _settingName: null,

    _isSensitive: function(sensitivityArray) {
        if (sensitivityArray === null) {
            return true;
        }
        for (let checkSetting in sensitivityArray) {
            if (sensitivityArray.hasOwnProperty(checkSetting)) {
                let checkSettingArray = sensitivityArray[checkSetting];
                if (this._settings.getType(checkSetting) == 'integer') {
                    checkSettingArray = this._convertOptionArrayToIndexedArray(sensitivityArray[
                        checkSetting]);
                }
                let currentCheckSettingValue = this._settings.get(checkSetting);
                if (typeof checkSettingArray[currentCheckSettingValue] != 'undefined') {
                    return checkSettingArray[currentCheckSettingValue];
                }
            }
        }
        return true;
    },

    _hasVisibleLevel: function() {
        return (this._settings.getLevel(this._settingName) <= this._settings.get('settings-level'));
    },

    isVisible: function() {
        return this._hasVisibleLevel() && this._isSensitive(this._params.sensitivity);
    },

    _updateRevealerVisibility: function() {
        if (Utils.isValid(Gtk.Revealer) && (this.revealer instanceof Gtk.Revealer)) {
            this.revealer.set_reveal_child(this.isVisible());
        }
        else {
            this.revealer.set_visible(this.isVisible());
        }
        this.emit('visibility-changed');
    },

    _registerLevel: function() {
        this._settings.registerForChange('settings-level', Lang.bind(this, function() {
            this._updateRevealerVisibility();
        }));
    },

    _registerSensitivity: function(sensitivityArray, callback) {
        if (sensitivityArray === null) {
            return;
        }
        for (let sensitivitySetting in sensitivityArray) {
            if (sensitivityArray.hasOwnProperty(sensitivitySetting)) {
                this._settings.registerForChange(sensitivitySetting, callback);
            }
        }
    },

    _convertOptionArrayToIndexedArray: function(optionArray) {
        let indexedOptions = {};
        for (let option in optionArray) {
            if (optionArray.hasOwnProperty(option)) {
                indexedOptions[this._optionToInteger(option)] = optionArray[option];
            }
        }
        return indexedOptions;
    },

    _optionToInteger: function(option) {
        let result = /^#(.*)#$/.exec(option);
        if (result !== null) {
            let importPath = result[1].charAt(0).toLowerCase() + result[1].substring(1);
            let parts = importPath.split('.');
            let temp = Extension.imports[parts[0]];
            for (let i = 1; i < parts.length; i++) {
                temp = temp[parts[i]];
            }
            return parseInt(temp);
        }
        return parseInt(option);
    },

    _addHelp: function(target) {
        if (this._help !== undefined) {
            target.set_tooltip_text(_(this._help));
        }
    },

    _getLabel: function() {
        let preferenceLabel = new Gtk.Label({
            label: _(this._settings.getHumanName(this._settingName)),
            xalign: 0
        });

        this._addHelp(preferenceLabel);
        return preferenceLabel;
    },

    _init: function(settingName, settings, noLabel) {
        this.parent();
        this._settingName = settingName;
        this._settings = settings;
        this._help = this._settings.getHelp(this._settingName);
        this.spacing = 6;
        this.orientation = Gtk.Orientation.HORIZONTAL;

        this._params = Params.parse(settings.getExtraParams(settingName), {
            sensitivity: null,
            description: '_(No description)',
            options: ['No options defined'],
            shortcuts: [],
            range: {
                'min': 1,
                'max': 65535,
                'step': 1
            }
        });

        this.box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            margin: 3
        });

        if (Utils.isValid(Gtk.Revealer)) {
            this.revealer = new Gtk.Revealer({
                reveal_child: this.isVisible()
            });
            this.revealer.add(this.box);
        }
        else {
            this.revealer = new Gtk.Box({
                visible: this.isVisible()
            });
            this.revealer.pack_start(this.box, true, true, 0);
        }

        this.pack_start(this.revealer, true, true, 0);
        this._registerLevel();
        this._registerSensitivity(this._params.sensitivity, Lang.bind(this, function() {
            this._updateRevealerVisibility();
            this.revealer.sensitive = this._isSensitive(this._params.sensitivity);
        }));

        if (noLabel === true) {
            return;
        }

        this.box.pack_start(this._getLabel(), true, true, 0);
    }

});
Signals.addSignalMethods(PreferenceWidget.prototype);

/* vi: set expandtab tabstop=4 shiftwidth=4: */
