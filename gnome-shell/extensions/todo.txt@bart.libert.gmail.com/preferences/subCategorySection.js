const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Extension.imports.utils;

const _ = imports.gettext.domain('todotxt').gettext;

const SubCategorySection = new GObject.Class({
    Name: 'SubCategorySection',
    GTypeName: 'SubCategorySection',
    Extends: Gtk.Box,
    _visible: false,

    _init: function(title) {
        this.parent();
        this.label = new Gtk.Label({
            label: '<b>' + _(title) + '</b>',
            use_markup: true,
            xalign: 0
        });
        this.orientation = Gtk.Orientation.VERTICAL;
        this.vbox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_left: 20,
        });
        Gtk.Box.prototype.add.call(this, this.label);
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
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
