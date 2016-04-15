const GObject = imports.gi.GObject;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();

const ColorWidget = new GObject.Class({
    Name: 'ColorWidget',
    GTypeName: 'ColorWidget',
    Extends: Extension.imports.preferences.preferenceWidget.PreferenceWidget,

    _init: function(setting, settings) {
        this.parent(setting, settings);

        let oldColor = new Gdk.RGBA();
        oldColor.parse(settings.get(setting));

        let customColorButton = new Gtk.ColorButton({
            'rgba': oldColor
        });

        customColorButton.connect('color-set', Lang.bind(this, function(object) {
            let color = customColorButton.get_rgba().to_string();
            log('Setting ' + setting + ' to ' + color);
            settings.set(setting, color);
        }));

        this._addHelp(customColorButton);

        this.box.add(customColorButton);
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
