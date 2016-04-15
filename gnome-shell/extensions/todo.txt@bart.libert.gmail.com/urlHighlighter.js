function getParentHighlighter() {
    if (typeof imports.ui.messageTray.URLHighlighter != 'undefined') {
        return imports.ui.messageTray.URLHighlighter;
    }
    try {
        return imports.ui.messageList.URLHighlighter;
    }
    catch (err) {
        return imports.ui.calendar.URLHighlighter;
    }
}
const Highlighter = getParentHighlighter();
const Lang = imports.lang;
const Util = imports.misc.util;

const TaskURLHighlighter = new Lang.Class({
    Name: 'TaskURLHighlighter',
    Extends: Highlighter,
    markupFunction: null,

    _init: function(text, lineWrap, allowMarkup, urlMarkupFunction) {
        this.markupFunction = urlMarkupFunction;
        this.parent(text, lineWrap, allowMarkup);
    },

    _highlightUrls: function() {
        let urls = Util.findUrls(this._text);
        let markup = '';
        let pos = 0;
        for (let i = 0; i < urls.length; i++) {
            let url = urls[i];
            let str = this._text.substr(pos, url.pos - pos);
            markup += str + this.markupFunction(url.url, this._linkColor);
            pos = url.pos + url.url.length;
        }
        markup += this._text.substr(pos);
        this.actor.clutter_text.set_markup(markup);
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
