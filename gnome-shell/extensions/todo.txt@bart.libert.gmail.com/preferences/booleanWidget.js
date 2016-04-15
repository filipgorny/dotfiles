const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Extension = imports.misc.extensionUtils.getCurrentExtension();

const BooleanWidget = new GObject.Class({
    Name: 'BooleanWidget',
    GTypeName: 'BooleanWidget',
    Extends: Extension.imports.preferences.preferenceWidget.PreferenceWidget,

    _init: function(setting, settings) {
        this.parent(setting, settings);

        let settingsSwitch = new Gtk.Switch({
            active: settings.get(setting),
        });

        this._addHelp(settingsSwitch);

        settingsSwitch.connect('notify::active', Lang.bind(this, function(object) {
            log('changing boolean ' + setting + ' to ' + object.active);
            settings.set(setting, object.active);
        }));

        this.box.add(settingsSwitch);
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
