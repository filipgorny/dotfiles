const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Extension.imports.utils;

const _ = imports.gettext.domain('todotxt').gettext;

const SubCategoryTab = new GObject.Class({
    Name: 'SubCategoryTab',
    GTypeName: 'SubCategoryTab',
    Extends: Gtk.Box,
    _visible: false,

    _init: function(title, help) {
        this.parent();
        this.label = new Gtk.Label({
            label: _(title),
            margin_top: 0
        });
        this.orientation = Gtk.Orientation.VERTICAL;
        this.vbox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            border_width: 10,
            vexpand: true,
        });
        if (typeof help != 'undefined' && help !== null && help.length !== 0) {
            let helpButton = new Gtk.Button({
                label: _('Help'),
            });

            let buttonBox = new Gtk.HButtonBox({
                layout_style: Gtk.ButtonBoxStyle.END
            });

            helpButton.connect('clicked', Lang.bind(this, function(object) {
                let dialog = new Gtk.MessageDialog({
                    buttons: Gtk.ButtonsType.OK,
                    text: _(help),
                    message_type: Gtk.MessageType.INFO
                });
                dialog.run();
                dialog.destroy();
            }));
            buttonBox.add(helpButton);
            this.vbox.pack_end(buttonBox, false, false, 0);
        }
        Gtk.Box.prototype.add.call(this, this.vbox);
    },

    _updateVisibility: function() {
        this._visible = false;
        for (let child in this.vbox.get_children()) {
            if (this.vbox.get_children().hasOwnProperty(child)) {
                if (Utils.isValid(this.vbox.get_children()[child].isVisible)) {
                    this._visible = this._visible || this.vbox.get_children()[child].isVisible();
                }
            }
        }
    },

    isVisible: function() {
        this._updateVisibility();
        return this._visible;
    },

    add: function(child) {
        if (child === null) {
            return;
        }
        this.vbox.add(child);
        this._updateVisibility();
    },

    remove: function(child) {
        if (child === null) {
            return;
        }
        this.vbox.remove(child);
        this._updateVisibility();
    },

    getTitle: function() {
        return this.label;
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
