#!/bin/sh
rm singlefilez-extension-firefox.zip singlefilez-extension-chromium.zip
cp manifest.json manifest.copy.json
cp extension/core/bg/downloads.js downloads.copy.js
sed -i 's/7544745492-ig6uqhua0ads4jei52lervm1pqsi6hot/7544745492-oe3q2jjvdluks2st2smslmrofcdederh/g' extension/core/bg/downloads.js

jq "del(.options_page,.background.persistent,.optional_permissions[0],.oauth2)" manifest.copy.json > manifest.json
sed -i 's/7544745492-ig6uqhua0ads4jei52lervm1pqsi6hot/7544745492-oe3q2jjvdluks2st2smslmrofcdederh/g' manifest.json
zip -r singlefilez-extension-firefox.zip manifest.json common extension lib _locales

jq "del(.applications,.permissions[0],.permissions[1],.options_ui.browser_style)" manifest.copy.json > manifest.json
sed -i 's/7544745492-ig6uqhua0ads4jei52lervm1pqsi6hot/7544745492-oe3q2jjvdluks2st2smslmrofcdederh/g' manifest.json
zip -r singlefilez-extension-chromium.zip manifest.json common extension lib _locales

mv manifest.copy.json manifest.json
mv downloads.copy.js extension/core/bg/downloads.js