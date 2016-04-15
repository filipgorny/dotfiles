const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Extension.imports.utils;
const _ = imports.gettext.domain('todotxt').gettext;

const CategoryTab = new GObject.Class({
    Name: 'CategoryTab',
    GTypeName: 'CategoryTab',
    Extends: Gtk.Box,
    _visible: false,

    _init: function(title) {
        this.parent();
        this.orientation = Gtk.Orientation.VERTICAL;
        this.border_width = 10;
        this.vexpand = true;
        this.spacing = 6;

        this.titleLabel = new Gtk.Label({
            label: _(title),
            xalign: 0,
            margin_top: 0
        });
    },

    _updateVisibility: function() {
        this._visible = false;
        for (let child in this.get_children()) {
            if (this.get_children().hasOwnProperty(child)) {
                if (Utils.isValid(this.get_children()[child].isVisible)) {
                    this._visible = this._visible || this.get_children()[child].isVisible();
                }
            }
        }
    },

    isVisible: function() {
        this._updateVisibility();
        return this._visible;
    },

    getTitle: function() {
        return this.titleLabel;
    },

    add: function(child) {
        this.parent(child);
        this._updateVisibility();
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
