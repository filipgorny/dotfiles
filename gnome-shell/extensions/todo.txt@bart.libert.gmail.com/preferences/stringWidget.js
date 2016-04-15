const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();

const StringWidget = new GObject.Class({
    Name: 'StringWidget',
    GTypeName: 'StringWidget',
    Extends: Extension.imports.preferences.preferenceWidget.PreferenceWidget,

    _init: function(setting, settings) {
        this.parent(setting, settings);

        let textFieldValue = new Gtk.Entry({
            hexpand: true
        });
        textFieldValue.set_text(this._settings.get(setting));
        textFieldValue.connect('focus-out-event', Lang.bind(this, function(object) {
            log('Setting ' + setting + ' to ' + textFieldValue.get_text());
            this._settings.set(setting, textFieldValue.get_text());
        }));
        textFieldValue.connect('activate', Lang.bind(this, function(object) {
            log('Setting ' + setting + ' to ' + textFieldValue.get_text());
            this._settings.set(setting, textFieldValue.get_text());
        }));
        this._addHelp(textFieldValue);
        this.box.add(textFieldValue);
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
