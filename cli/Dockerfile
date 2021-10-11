FROM zenika/alpine-chrome:with-node

RUN npm install --production gildas-lormeau/SingleFileZ#master

WORKDIR /usr/src/app/node_modules/single-filez/cli

ENTRYPOINT [ \
    "./single-filez", \
    "--browser-executable-path", "/usr/bin/chromium-browser", \
    "--output-directory", "./../../../out/", \
    "--browser-args", "[\"--no-sandbox\"]", \
    "--dump-content" ]
