# SingleFileZ
SingleFileZ is a fork of [SingleFile](https://addons.mozilla.org/en-US/firefox/addon/single-file) that allows you to save a webpage as a self-extracting HTML file. This HTML file is also a valid ZIP file which contains the resources (images, fonts, stylesheets and frames) of the saved page. This ZIP file can be unzipped on the filesystem in order to view the page in a browser that would not support pages saved with SingleFileZ.

## Demo
![](demo/demo-sfz.gif)

## Examples
Here is an example of page produced by SingleFileZ: https://gildas-lormeau.github.io. Other examples of files can be found here: https://github.com/gildas-lormeau/SingleFileZ/tree/master/examples

## Download
SingleFileZ is available on Firefox and Chrome. You can download the extension here:
 - Firefox Add-ons website: https://addons.mozilla.org/firefox/addon/singlefilez
 - Chrome web store: https://chrome.google.com/webstore/detail/singlefilez/offkdfbbigofcgdokjemgjpdockaafjg

To open saved pages from the filesystem in a Chromium-based browser, SingleFileZ must be installed and the option "Allow access to file URLs" must be enabled in the details page of the extension (chrome://extensions/?id=offkdfbbigofcgdokjemgjpdockaafjg). Otherwise, the browser must be started with the switch ['--allow-file-access-from-files'](http://www.chrome-allow-file-access-from-file.com/).

## Notes
 - JavaScript must be enabled to view saved pages.
