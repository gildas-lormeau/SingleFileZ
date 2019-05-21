# SingleFileZ
SingleFileZ is a fork of [SingleFile](https://addons.mozilla.org/en-US/firefox/addon/single-file) that allows you to save a webpage into a self-extracting HTML file. This HTML file is also a valid ZIP file which contains the resources (images, fonts, stylesheets and frames) of the saved page. This ZIP file can be unzipped on the filesytem in order to view the page in a browser that would not support pages saved with SingleFileZ.

Here is an example of page produced by SingleFileZ: https://gildas-lormeau.github.io/. Other examples of files produced by SingleFileZ can be found here: https://github.com/gildas-lormeau/SingleFileZ/tree/master/examples

Today, it is only available on Firefox. You can download the extension here: https://addons.mozilla.org/firefox/addon/singlefilez/

To open saved pages from the filesystem in Chrome, you must start it with the switch `--allow-file-access-from-files`. That's why the extension will probably never be published on the Chrome store.

Note that JavaScript must be enabled to view saved pages.

*This is a work in progress*
