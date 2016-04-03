(function() {
    var App = {
        cache: {},
        files: [],
        parserSettings: {
            headerOffset: 1,
            exportFromLineNumber: false,
            suppressSubScriptHandling: false,
            suppressAutoLink: false
        },
        bindAll: function() {
            var k = Object.keys(this),
                l = k.length;

            while (l--) {
                if (this[k[l]] instanceof Function) {
                    this[k[l]] = this[k[l]].bind(this);
                }
            }
        },
        download: function(file, callback) {
            $.get(file).success(callback);
        },
        highlightSyntax: function() {
            $('article pre code').each(function(i, block) {
                hljs.highlightBlock(block);
            });
        },
        loading: function() {
            $('article').empty();
            $('body').addClass('loading');
        },
        render: function(file) {
            $('article').html(this.cache[file]);
            $('body').removeClass('loading');
            this.highlightSyntax();
        },
        parse: function(file, response) {
            var parser = new Org.Parser(),
                orgDocument = parser.parse(response),
                orgHTMLDocument = orgDocument.convert(
                    Org.ConverterHTML,
                    this.parserSettings
                );

            this.cache[file] = orgHTMLDocument.toString();
            this.render(file);
        },
        populateMenu: function(response) {
            $('#document-select').empty();
            this.files = response.split(',') || [];
            this.files.forEach(function(file, i) {
                $('<option>' + file + '</option>')
                    .appendTo('#document-select');
            });
            this.download(
                'documents/' + this.files[0],
                this.parse.bind(this, this.files[0])
            );
        },
        select: function(e) {
            var file = $(e.target).val();

            this.loading();

            if (this.cache[file]) {
                this.render(file);
            } else {
                this.download('documents/' + file, this.parse.bind(this, file));
            }
        }
    };
    App.bindAll();
    App.loading();
    App.download('documents.txt', App.populateMenu);
    $('#document-select').on('change', App.select)
})();
