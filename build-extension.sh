#!/bin/sh
rm singlefilez-extension-firefox.zip singlefilez-extension-chromium.zip singlefilez-extension-edge.zip
cp manifest.json manifest.copy.json
cp extension/core/bg/downloads.js downloads.copy.js
sed -i 's/7544745492-ig6uqhua0ads4jei52lervm1pqsi6hot/7544745492-oe3q2jjvdluks2st2smslmrofcdederh/g' extension/core/bg/downloads.js

cp extension/core/bg/config.js config.copy.js
jq "del(.options_page,.background.persistent,.optional_permissions[0],.oauth2)" manifest.copy.json >manifest.json
sed -i 's/7544745492-ig6uqhua0ads4jei52lervm1pqsi6hot/7544745492-oe3q2jjvdluks2st2smslmrofcdederh/g' manifest.json
sed -i 's/forceWebAuthFlow: false/forceWebAuthFlow: true/g' extension/core/bg/config.js
zip -r singlefilez-extension-firefox.zip manifest.json common extension lib/single-file/dist _locales lib/single-file/processors/hooks/content/*-web.js lib/single-file/vendor/zip/zip.min.js lib/single-file/vendor/zip/z-worker.js
mv config.copy.js extension/core/bg/config.js

jq "del(.browser_specific_settings,.permissions[0],.permissions[1],.options_ui.browser_style)" manifest.copy.json >manifest.json
sed -i 's/7544745492-ig6uqhua0ads4jei52lervm1pqsi6hot/7544745492-oe3q2jjvdluks2st2smslmrofcdederh/g' manifest.json
zip -r singlefilez-extension-chromium.zip manifest.json common extension lib/single-file/dist _locales lib/single-file/processors/hooks/content/*-web.js lib/single-file/vendor/zip/zip.min.js lib/single-file/vendor/zip/z-worker.js

cp extension/core/bg/config.js config.copy.js
jq "del(.browser_specific_settings,.permissions[0],.permissions[1],.options_ui.browser_style)" manifest.copy.json >manifest.json
sed -i 's/7544745492-ig6uqhua0ads4jei52lervm1pqsi6hot/7544745492-oe3q2jjvdluks2st2smslmrofcdederh/g' manifest.json
sed -i 's/forceWebAuthFlow: false/forceWebAuthFlow: true/g' extension/core/bg/config.js
mkdir _locales.copy
cp -R _locales/* _locales.copy
rm -rf _locales/*
cp -R _locales.copy/en _locales
zip -r singlefilez-extension-edge.zip manifest.json common extension lib/single-file/dist _locales lib/single-file/processors/hooks/content/*-web.js lib/single-file/vendor/zip/zip.min.js lib/single-file/vendor/zip/z-worker.js
rm -rf _locales/*
mv _locales.copy/* _locales
rmdir _locales.copy
mv config.copy.js extension/core/bg/config.js

mv manifest.copy.json manifest.json
mv downloads.copy.js extension/core/bg/downloads.js
