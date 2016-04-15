const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Extension.imports.utils;

const _ = imports.gettext.domain('todotxt').gettext;

const COL_COMBO_VALUE = 0;
const COL_COMBO_TEXT = 1;

const IntegerWidget = new GObject.Class({
    Name: 'IntegerWidget',
    GTypeName: 'IntegerWidget',
    Extends: Extension.imports.preferences.preferenceWidget.PreferenceWidget,

    _init: function(setting, settings) {
        this.parent(setting, settings);

        let model = new Gtk.ListStore();
        model.set_column_types([GObject.TYPE_INT, GObject.TYPE_STRING]);
        let comboBox = new Gtk.ComboBox({
            model: model
        });

        if (this._params.options.length === 0) {
            comboBox.sensitive = false;
        }

        let indexedOptions = this._convertOptionArrayToIndexedArray(this._params.options);
        for (let i in indexedOptions) {
            if (indexedOptions.hasOwnProperty(i)) {
                if (!Utils.isValid(indexedOptions[i])) {
                    continue;
                }
                let row = model.insert(parseInt(i));
                model.set(row, [COL_COMBO_VALUE, COL_COMBO_TEXT], [parseInt(i), _(indexedOptions[i])]);
                if (model.get_value(row, COL_COMBO_VALUE) === this._settings.get(setting)) {
                    comboBox.set_active_iter(row);
                }
            }
        }

        let cell = new Gtk.CellRendererText();
        comboBox.pack_start(cell, true);
        comboBox.add_attribute(cell, 'text', COL_COMBO_TEXT);

        comboBox.connect('changed', Lang.bind(this, function(object) {
            let model = object.get_model();
            let [success, iter] = object.get_active_iter();
            if (!success) {
                return;
            }
            let activeValue = model.get_value(iter, COL_COMBO_VALUE);
            let activeText = model.get_value(iter, COL_COMBO_TEXT);
            log('changing ' + setting + ' to ' + activeValue + ' (' + activeText + ')');
            this._settings.set(setting, activeValue);
            if ((typeof extraFunctionOnChange !== 'undefined') && (extraFunctionOnChange !==
                    null)) {
                extraFunctionOnChange(activeValue);
            }
        }));

        this._addHelp(comboBox);
        this.box.add(comboBox);
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
