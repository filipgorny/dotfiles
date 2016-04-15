const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const _ = imports.gettext.domain('todotxt').gettext;

const Extension = imports.misc.extensionUtils.getCurrentExtension();

const ShortcutWidget = new GObject.Class({
    Name: 'ShortcutWidget',
    GTypeName: 'ShortcutWidget',
    Extends: Extension.imports.preferences.preferenceWidget.PreferenceWidget,

    _init: function(setting, settings) {
        this.parent(setting, settings, true);

        let model = new Gtk.ListStore();
        model.set_column_types([
            GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_INT, GObject.TYPE_INT
        ]);

        for (let shortcut in this._params.shortcuts) {
            if (this._params.shortcuts.hasOwnProperty(shortcut)) {
                let row = model.insert(10);
                let [key, mods] = Gtk.accelerator_parse(settings.get(shortcut));
                model.set(row, [0, 1, 2, 3], [shortcut, _(this._params.shortcuts[shortcut]), mods, key]);
            }
        }

        let treeview = new Gtk.TreeView({
            'expand': true,
            'model': model
        });

        let cellrend = new Gtk.CellRendererText();
        let col = new Gtk.TreeViewColumn({
            'title': _('Function'),
            'expand': true
        });

        col.pack_start(cellrend, true);
        col.add_attribute(cellrend, 'text', 1);

        treeview.append_column(col);

        cellrend = new Gtk.CellRendererAccel({
            'editable': true,
            'accel-mode': Gtk.CellRendererAccelMode.GTK
        });
        cellrend.connect('accel-edited', function(rend, iter, key, mods) {
            let value = Gtk.accelerator_name(key, mods);

            let [succ, iterator] = model.get_iter_from_string(iter);

            if (!succ) {
                throw new Error('Something is broken!');
            }

            let name = model.get_value(iterator, 0);

            model.set(iterator, [2, 3], [mods, key]);

            settings.set(name, value);
        });

        cellrend.connect('accel-cleared', function(rend, iter) {
            let [succ, iterator] = model.get_iter_from_string(iter);

            if (!succ) {
                throw new Error('Something is broken!');
            }

            model.set(iterator, [3], [0]);
            let name = model.get_value(iterator, 0);
            settings.set(name, '');
        });

        col = new Gtk.TreeViewColumn({
            'title': _('Key')
        });

        col.pack_end(cellrend, false);
        col.add_attribute(cellrend, 'accel-mods', 2);
        col.add_attribute(cellrend, 'accel-key', 3);

        treeview.append_column(col);
        this.box.add(treeview);
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
