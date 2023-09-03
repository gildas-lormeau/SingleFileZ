#!/bin/bash

dpkg -s zip &> /dev/null
if [ $? -ne 0 ]
then
    echo "Installing zip"
    sudo apt install zip
fi

dpkg -s jq &> /dev/null
if [ $? -ne 0 ]
then
    echo "Installing jq"
    sudo apt install jq
fi

npm install
npm update

npx rollup -c rollup.config.js

cp package.json package.copy.json
jq 'del(.dependencies."single-filez-cli")' package.copy.json > package.json
zip -r singlefilez-extension-source.zip manifest.json package.json _locales src rollup*.js .eslintrc.js build-extension.sh
mv package.copy.json package.json

rm singlefilez-extension-firefox.zip singlefilez-extension-chromium.zip singlefilez-extension-edge.zip
cp manifest.json manifest.copy.json

cp src/core/bg/config.js config.copy.js
jq "del(.options_page,.background.persistent,.optional_permissions[0],.oauth2)" manifest.copy.json >manifest.json
sed -i "" 's/forceWebAuthFlow: false/forceWebAuthFlow: true/g' src/core/bg/config.js
zip -r singlefilez-extension-firefox.zip manifest.json lib _locales src
mv config.copy.js src/core/bg/config.js

jq "del(.browser_specific_settings,.permissions[0],.permissions[1],.options_ui.browser_style)" manifest.copy.json >manifest.json
zip -r singlefilez-extension-chromium.zip manifest.json lib _locales src

cp src/core/bg/config.js config.copy.js
jq "del(.browser_specific_settings,.permissions[0],.permissions[1],.options_ui.browser_style)" manifest.copy.json >manifest.json
sed -i "" 's/forceWebAuthFlow: false/forceWebAuthFlow: true/g' src/core/bg/config.js
sed -i "" 's/image\/avif,//g' src/core/bg/config.js
zip -r singlefilez-extension-edge.zip manifest.json lib _locales src
mv config.copy.js src/core/bg/config.js

mv manifest.copy.json manifest.json
