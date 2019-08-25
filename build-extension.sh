#!/bin/sh
rm singlefilez-extension-firefox.zip singlefilez-extension-chromium.zip
cp manifest.json manifest.copy.json
jq "del(.options_page,.background.persistent)" manifest.copy.json > manifest.json
zip -r singlefilez-extension-firefox.zip manifest.json common extension lib _locales
jq "del(.applications,.permissions[0],.options_ui.browser_style)" manifest.copy.json > manifest.json
zip -r singlefilez-extension-chromium.zip manifest.json common extension lib _locales
mv manifest.copy.json manifest.json