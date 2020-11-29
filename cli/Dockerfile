FROM zenika/alpine-chrome:with-node

RUN set -x \
    git \
    && git clone --depth 1 --recursive https://github.com/gildas-lormeau/SingleFileZ \
    && cd SingleFileZ && npm install --production && cd cli && mkdir out && npm install --production \
    && chmod +x single-filez \
    && echo

WORKDIR /usr/src/app/SingleFileZ/cli

ENTRYPOINT ["./single-filez", "--browser-executable-path", "/usr/bin/chromium-browser", "--dump-content", "--output-directory", "out", "--browser-args", "[\"--no-sandbox\"]"]
