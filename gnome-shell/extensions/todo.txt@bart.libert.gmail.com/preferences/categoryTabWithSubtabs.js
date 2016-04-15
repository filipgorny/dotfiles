const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Extension.imports.utils;

const _ = imports.gettext.domain('todotxt').gettext;

const CategoryTabWithSubtabs = new GObject.Class({
    Name: 'CategoryTabWithSubtabs',
    GTypeName: 'CategoryTabWithSubtabs',
    Extends: Gtk.Notebook,
    _visible: false,

    _init: function(title) {
        this.parent();

        this.titleLabel = new Gtk.Label({
            label: _(title),
            xalign: 0,
            margin_top: 0
        });
    },

    getTitle: function() {
        return this.titleLabel;
    },

    _updateVisibility: function() {
        this._visible = false;
        for (let i = 0, len = this.get_n_pages(); i < len; i++) {
            let page = this.get_nth_page(i);
            if (Utils.isValid(page.isVisible())) {
                this._visible = this._visible || page.isVisible();
            }
        }
    },

    isVisible: function() {
        this._updateVisibility();
        return this._visible;
    },

    add: function(element) {
        this.append_page(element, element.getTitle());
        this._updateVisibility();
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
