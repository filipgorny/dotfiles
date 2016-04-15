const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const Signals = imports.signals;
const St = imports.gi.St;

const Gettext = imports.gettext;
const _ = Gettext.domain('todotxt').gettext;

const MessageDialog = new Lang.Class({
    Name: 'MessageDialog',
    Extends: ModalDialog.ModalDialog,

    _init: function(title, message) {
        this.message = message;
        this.title = title;
        this.parent({
            styleClass: 'message-dialog'
        });

        let tlabel = new St.Label({
            style_class: 'message-dialog-title',
            text: this.title
        });
        this.contentLayout.add(tlabel, {
            x_align: St.Align.MIDDLE,
            y_align: St.Align.START
        });

        let label = new St.Label({
            style_class: 'message-dialog-label',
            text: this.message,
        });
        label.clutter_text.line_wrap = true;
        this.contentLayout.add(label, {
            y_align: St.Align.MIDDLE
        });

        let buttons = [{
            label: _('Ok'),
            action: Lang.bind(this, this._onOkButton),
            key: Clutter.Return
        }];
        this.setButtons(buttons);
    },

    close: function() {
        this.parent();
    },

    _onOkButton: function() {
        this.close();
    },

    open: function() {
        this.parent();
    }
});
Signals.addSignalMethods(MessageDialog.prototype);

/* vi: set expandtab tabstop=4 shiftwidth=4: */
