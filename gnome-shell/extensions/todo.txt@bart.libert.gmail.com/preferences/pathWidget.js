const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain('todotxt');
const _ = Gettext.gettext;

const PathWidget = new GObject.Class({
    Name: 'PathWidget',
    GTypeName: 'PathWidget',
    Extends: Extension.imports.preferences.preferenceWidget.PreferenceWidget,

    launchFileChooser: function(caller, entryTarget, title, setting, settings) {
        let dialogTitle = _('Select file');
        if (title !== null) {
            dialogTitle = title;
        }
        let chooser = new Gtk.FileChooserDialog({
            title: dialogTitle,
            action: Gtk.FileChooserAction.OPEN,
            modal: true
        });

        chooser.add_button(Gtk.STOCK_CANCEL, 0);
        chooser.add_button(Gtk.STOCK_OPEN, 1);
        chooser.set_default_response(1);
        let filename = null;
        if (chooser.run() == 1) {
            filename = chooser.get_filename();
            if (filename) {
                entryTarget.set_text(filename);
                settings.set(setting, filename);
            }
        }
        chooser.destroy();
    },

    _init: function(setting, settings) {
        this.parent(setting, settings);
        this.spacing = 6;

        let locationValue = new Gtk.Entry({
            hexpand: true
        });
        locationValue.set_text(settings.get(setting));
        let locationBrowse = new Gtk.Button({
            label: _('Browse')
        });
        locationBrowse.connect('clicked', Lang.bind(this, this.launchFileChooser, locationValue,
            _(this._params.description), setting, settings));
        locationValue.connect('focus-out-event', Lang.bind(this, function(object) {
            log('Setting ' + setting + ' to ' + locationValue.get_text());
            settings.set(setting, locationValue.get_text());
        }));
        locationValue.connect('activate', Lang.bind(this, function(object) {
            log('Setting ' + setting + ' to ' + locationValue.get_text());
            settings.set(setting, locationValue.get_text());
        }));

        this._addHelp(locationValue);

        this.box.add(locationValue);
        this.box.add(locationBrowse);
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
