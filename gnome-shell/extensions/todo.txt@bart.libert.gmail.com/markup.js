const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Shared = Extension.imports.sharedConstants;
const Utils = Extension.imports.utils;

const Markup = new Lang.Class({
    Name: 'Markup',
    bold: false,
    italic: false,
    changeColor: false,
    color: null,
    logger: null,

    _init: function(variant, logger) {
        this.color = new Gdk.RGBA();
        this.color.parse('rgb(0,0,0)');
        if (typeof logger == 'undefined') {
            this.logger = Utils.getDefaultLogger();
            this.logger.warning('Using default logger instead of injected one');
        }
        else {
            this.logger = logger;
        }
        if (typeof variant == 'undefined') {
            return;
        }
        if (!(variant instanceof GLib.Variant)) {
            this.logger.error('Markup instantiated with non-variant object of type ' + typeof variant);
            return;
        }
        let expectedVariant = new GLib.VariantType('(bsbb)');
        if (!(variant.is_of_type(expectedVariant))) {
            this.logger.error('Markup instantiated with variant of wrong type ' + variant.get_type_string());
            return;
        }
        let unpack = variant.deep_unpack();
        this.bold = unpack[Shared.STYLE_BOLD];
        this.italic = unpack[Shared.STYLE_ITALIC];
        this.changeColor = unpack[Shared.STYLE_CHANGE_COLOR];
        this.color.parse(unpack[Shared.STYLE_COLOR]);
    },

    setColorFromString: function(colorString) {
        try {
            this.color.parse(colorString);
        }
        catch (err) {
            this.logger.error('Could not parse color: ' + err);
        }
    },

    toVariant: function() {
        let tuple = [];
        tuple[Shared.STYLE_BOLD] = GLib.Variant.new_boolean(this.bold);
        tuple[Shared.STYLE_ITALIC] = GLib.Variant.new_boolean(this.italic);
        tuple[Shared.STYLE_CHANGE_COLOR] = GLib.Variant.new_boolean(this.changeColor);
        tuple[Shared.STYLE_COLOR] = GLib.Variant.new_string(this.color.to_string());
        return GLib.Variant.new_tuple(tuple);
    },

    toString: function() {
        return '[object Markup] (bold: ' + this.bold + ', italic: ' + this.italic + ', changeColor: ' +
            this.changeColor + ', color: ' + this.color.to_string() + ')';
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
