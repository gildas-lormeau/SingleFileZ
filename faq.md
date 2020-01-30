# FAQ

## Why SingleFileZ is a separate extension?
There are some disadvantages to using SingleFileZ compared to SingleFile. JavaScript must be enabled to open the saved pages, and Chrome cannot open these files without passing a switch on the command line or installing the extension. It also takes a little longer to save and open the pages. This is why the self-extracting ZIP feature is integrated as a separate extension.

## Does SingleFileZ upload any data to third-party servers?
As stated in the [privacy policy](https://github.com/gildas-lormeau/SingleFileZ/blob/master/privacy.md), SingleFileZ does not upload any data to third-party servers. All the work is done in your browser. However, when you save a page with SingleFileZ, it can download resources (images, CSS, frame contents, fonts etc.) that are not displayed or not cached but present in the page.

## Why can't I save some pages like https://addons.mozilla.org/addon/single-file?
For security purposes, browsers block web extensions on certain domains. This prevents a malicious extension to remove or change bad reviews, for example.

## Why isn't the infobar displayed / Why cannot I save a page from the filesystem in Chrome?
By default, Chrome extensions are not allowed to access to pages stored on the filesystem. Therefore, you must enable the option "Allow access to file URLs" in the extension page to display the infobar when viewing a saved page, or to save a page stored on the filesystem.

## What are the permissions requested by SingleFileZ for?
The permissions requested by SingleFileZ are defined in the [manifest.json](https://github.com/gildas-lormeau/SingleFileZ/blob/master/manifest.json) file. Below are the reasons why they are necessary.
 - `identity`: allows SingleFileZ to connect to your Google Drive account.
 - `storage`: allows SingleFileZ to store your settings.
 - `menus/contextMenus`: allows SingleFileZ to display an entry in the context menu of web pages.
 - `tabs` (all_urls): allows SingleFileZ to inject the code needed to process a page in any tab. This permission is needed for saving several tabs in one click, for example.
 - `downloads`: allows SingleFileZ to save pages as if they were downloaded from the web.

## SingleFileZ is slow on my computer/tablet/phone, can it run faster?
The default configuration of SingleFileZ is optimized to produce small pages. This can sometimes slow down the save process considerably. Below are the options you can disable to save time and CPU.
 - HTML content > remove hidden elements
 - Stylesheets > remove unused styles

You can also disable the options below. Some resources (e.g. images, frames) on the page may be missing though.
 - HTML content > remove frames
 - Images > save deferred images
 
 ## Why SingleFileZ uses '.html' as the default filename extension?
Pages saved by SingleFileZ can be viewed from the filesystem in Firefox and Safari (by selecting the option "Disable Local File Restrictions" in the "Develop" menu) without installing the extension. Only Chrome requires the installation of SingleFileZ to view saved pages from the filesystem. These restrictions don't apply when the saved page is hosted on a server. For example, this page saved with SingleFileZ https://gildas-lormeau.github.io can be viewed in Firefox, Chrome, or Safari without installing or doing anything special. That's why SingleFileZ uses `.html` as the default filename extension.
