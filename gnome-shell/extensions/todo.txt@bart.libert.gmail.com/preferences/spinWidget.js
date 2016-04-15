const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();

const SpinWidget = new GObject.Class({
    Name: 'SpinWidget',
    GTypeName: 'SpinWidget',
    Extends: Extension.imports.preferences.preferenceWidget.PreferenceWidget,

    _init: function(setting, settings) {
        this.parent(setting, settings);

        let adjustment = new Gtk.Adjustment({
            lower: this._params.range.min,
            upper: this._params.range.max,
            step_increment: this._params.range.step
        });

        let spinButton = new Gtk.SpinButton({
            adjustment: adjustment,
            snap_to_ticks: true,
        });

        spinButton.set_value(this._settings.get(setting));

        spinButton.connect('value-changed', Lang.bind(this, function(entry) {
            log('changing ' + setting + ' to ' + entry.get_value_as_int());
            this._settings.set(setting, entry.get_value_as_int());
        }));

        this._addHelp(spinButton);
        this.box.add(spinButton);
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
