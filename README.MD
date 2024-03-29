# SingleFileZ
SingleFileZ is a fork of [SingleFile](https://github.com/gildas-lormeau/SingleFile) that allows you to save a webpage as a self-extracting HTML file. This HTML file is also a valid ZIP file which contains the resources (images, fonts, stylesheets and frames) of the saved page.

**NEW**: The SingleFileZ code has been completely merged with the SingleFile code, see the option "File format" in SingleFile to produce (self-extracting) ZIP files.

## Demo
![](https://github.com/gildas-lormeau/SingleFile-Demos/blob/master/demo-sfz.gif)

## Examples
Here is an example of page produced by SingleFileZ: https://gildas-lormeau.github.io. Here is the same example but protected by a password (`thisisapage`): https://gildas-lormeau.github.io/private.

Other examples of files can be found here: https://github.com/gildas-lormeau/SingleFileZ/tree/master/examples

## Download
SingleFileZ is available on Firefox, Chrome and Microsoft Edge. You can download the extension here:
 - Firefox: https://addons.mozilla.org/firefox/addon/singlefilez
 - Microsoft Edge: https://microsoftedge.microsoft.com/addons/detail/singlefilez/gofneaifncimeglaecpnanbnmnpfjekk
 - Chrome: https://chrome.google.com/webstore/detail/singlefilez/offkdfbbigofcgdokjemgjpdockaafjg


To open saved pages from the filesystem in a Chromium-based or Webkit-based browser, the option "ZIP content > add metadata to extract data from the page" must be enabled. Otherwise, SingleFileZ must be installed and the option "Allow access to file URLs" must be enabled in the details page of the extension (e.g. chrome://extensions/?id=offkdfbbigofcgdokjemgjpdockaafjg).

To open saved pages from the filesystem in Safari, the option "Disable Local File Restrictions" must be selected in the "Develop" menu

## Notes
 - JavaScript must be enabled to view saved pages.

## Command Line Interface
You can save web pages to HTML from the command line interface. See here for more info: https://github.com/gildas-lormeau/single-filez-cli.

## FAQ
cf. https://github.com/gildas-lormeau/SingleFileZ/blob/master/faq.md

## Icons
 - Icon made by [Pixelmeetup](https://www.flaticon.com/authors/pixelmeetup) from [Flaticon](www.flaticon.com) is licensed by [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/)
