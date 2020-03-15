/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
(function($protobuf) {
    "use strict";

    // Common aliases
    var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;
    
    // Exported root namespace
    var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});
    
    $root.Page = (function() {
    
        /**
         * Properties of a Page.
         * @exports IPage
         * @interface IPage
         * @property {string|null} [content] Page content
         * @property {string|null} [doctype] Page doctype
         * @property {string|null} [title] Page title
         * @property {string|null} [viewport] Page viewport
         * @property {IResources|null} [resources] Page resources
         * @property {string|null} [filename] Page filename
         * @property {string|null} [name] Page name
         */
    
        /**
         * Constructs a new Page.
         * @exports Page
         * @classdesc Represents a Page.
         * @implements IPage
         * @constructor
         * @param {IPage=} [properties] Properties to set
         */
        function Page(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * Page content.
         * @member {string} content
         * @memberof Page
         * @instance
         */
        Page.prototype.content = "";
    
        /**
         * Page doctype.
         * @member {string} doctype
         * @memberof Page
         * @instance
         */
        Page.prototype.doctype = "";
    
        /**
         * Page title.
         * @member {string} title
         * @memberof Page
         * @instance
         */
        Page.prototype.title = "";
    
        /**
         * Page viewport.
         * @member {string} viewport
         * @memberof Page
         * @instance
         */
        Page.prototype.viewport = "";
    
        /**
         * Page resources.
         * @member {IResources|null|undefined} resources
         * @memberof Page
         * @instance
         */
        Page.prototype.resources = null;
    
        /**
         * Page filename.
         * @member {string} filename
         * @memberof Page
         * @instance
         */
        Page.prototype.filename = "";
    
        /**
         * Page name.
         * @member {string} name
         * @memberof Page
         * @instance
         */
        Page.prototype.name = "";
    
        /**
         * Creates a new Page instance using the specified properties.
         * @function create
         * @memberof Page
         * @static
         * @param {IPage=} [properties] Properties to set
         * @returns {Page} Page instance
         */
        Page.create = function create(properties) {
            return new Page(properties);
        };
    
        /**
         * Encodes the specified Page message. Does not implicitly {@link Page.verify|verify} messages.
         * @function encode
         * @memberof Page
         * @static
         * @param {IPage} message Page message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Page.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.content != null && message.hasOwnProperty("content"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.content);
            if (message.doctype != null && message.hasOwnProperty("doctype"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.doctype);
            if (message.title != null && message.hasOwnProperty("title"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.title);
            if (message.viewport != null && message.hasOwnProperty("viewport"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.viewport);
            if (message.resources != null && message.hasOwnProperty("resources"))
                $root.Resources.encode(message.resources, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            if (message.filename != null && message.hasOwnProperty("filename"))
                writer.uint32(/* id 6, wireType 2 =*/50).string(message.filename);
            if (message.name != null && message.hasOwnProperty("name"))
                writer.uint32(/* id 7, wireType 2 =*/58).string(message.name);
            return writer;
        };
    
        /**
         * Encodes the specified Page message, length delimited. Does not implicitly {@link Page.verify|verify} messages.
         * @function encodeDelimited
         * @memberof Page
         * @static
         * @param {IPage} message Page message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Page.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a Page message from the specified reader or buffer.
         * @function decode
         * @memberof Page
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {Page} Page
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Page.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Page();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.content = reader.string();
                    break;
                case 2:
                    message.doctype = reader.string();
                    break;
                case 3:
                    message.title = reader.string();
                    break;
                case 4:
                    message.viewport = reader.string();
                    break;
                case 5:
                    message.resources = $root.Resources.decode(reader, reader.uint32());
                    break;
                case 6:
                    message.filename = reader.string();
                    break;
                case 7:
                    message.name = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };
    
        /**
         * Decodes a Page message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof Page
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {Page} Page
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Page.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a Page message.
         * @function verify
         * @memberof Page
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Page.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.content != null && message.hasOwnProperty("content"))
                if (!$util.isString(message.content))
                    return "content: string expected";
            if (message.doctype != null && message.hasOwnProperty("doctype"))
                if (!$util.isString(message.doctype))
                    return "doctype: string expected";
            if (message.title != null && message.hasOwnProperty("title"))
                if (!$util.isString(message.title))
                    return "title: string expected";
            if (message.viewport != null && message.hasOwnProperty("viewport"))
                if (!$util.isString(message.viewport))
                    return "viewport: string expected";
            if (message.resources != null && message.hasOwnProperty("resources")) {
                var error = $root.Resources.verify(message.resources);
                if (error)
                    return "resources." + error;
            }
            if (message.filename != null && message.hasOwnProperty("filename"))
                if (!$util.isString(message.filename))
                    return "filename: string expected";
            if (message.name != null && message.hasOwnProperty("name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            return null;
        };
    
        /**
         * Creates a Page message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof Page
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {Page} Page
         */
        Page.fromObject = function fromObject(object) {
            if (object instanceof $root.Page)
                return object;
            var message = new $root.Page();
            if (object.content != null)
                message.content = String(object.content);
            if (object.doctype != null)
                message.doctype = String(object.doctype);
            if (object.title != null)
                message.title = String(object.title);
            if (object.viewport != null)
                message.viewport = String(object.viewport);
            if (object.resources != null) {
                if (typeof object.resources !== "object")
                    throw TypeError(".Page.resources: object expected");
                message.resources = $root.Resources.fromObject(object.resources);
            }
            if (object.filename != null)
                message.filename = String(object.filename);
            if (object.name != null)
                message.name = String(object.name);
            return message;
        };
    
        /**
         * Creates a plain object from a Page message. Also converts values to other types if specified.
         * @function toObject
         * @memberof Page
         * @static
         * @param {Page} message Page
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Page.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.content = "";
                object.doctype = "";
                object.title = "";
                object.viewport = "";
                object.resources = null;
                object.filename = "";
                object.name = "";
            }
            if (message.content != null && message.hasOwnProperty("content"))
                object.content = message.content;
            if (message.doctype != null && message.hasOwnProperty("doctype"))
                object.doctype = message.doctype;
            if (message.title != null && message.hasOwnProperty("title"))
                object.title = message.title;
            if (message.viewport != null && message.hasOwnProperty("viewport"))
                object.viewport = message.viewport;
            if (message.resources != null && message.hasOwnProperty("resources"))
                object.resources = $root.Resources.toObject(message.resources, options);
            if (message.filename != null && message.hasOwnProperty("filename"))
                object.filename = message.filename;
            if (message.name != null && message.hasOwnProperty("name"))
                object.name = message.name;
            return object;
        };
    
        /**
         * Converts this Page to JSON.
         * @function toJSON
         * @memberof Page
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Page.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        return Page;
    })();
    
    $root.Resources = (function() {
    
        /**
         * Properties of a Resources.
         * @exports IResources
         * @interface IResources
         * @property {Array.<IBinaryResource>|null} [backgroundImages] Resources backgroundImages
         * @property {Array.<IBinaryResource>|null} [fonts] Resources fonts
         * @property {Array.<IPage>|null} [frames] Resources frames
         * @property {Array.<IBinaryResource>|null} [images] Resources images
         * @property {Array.<ITextResource>|null} [scripts] Resources scripts
         * @property {Array.<ITextResource>|null} [stylesheets] Resources stylesheets
         */
    
        /**
         * Constructs a new Resources.
         * @exports Resources
         * @classdesc Represents a Resources.
         * @implements IResources
         * @constructor
         * @param {IResources=} [properties] Properties to set
         */
        function Resources(properties) {
            this.backgroundImages = [];
            this.fonts = [];
            this.frames = [];
            this.images = [];
            this.scripts = [];
            this.stylesheets = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * Resources backgroundImages.
         * @member {Array.<IBinaryResource>} backgroundImages
         * @memberof Resources
         * @instance
         */
        Resources.prototype.backgroundImages = $util.emptyArray;
    
        /**
         * Resources fonts.
         * @member {Array.<IBinaryResource>} fonts
         * @memberof Resources
         * @instance
         */
        Resources.prototype.fonts = $util.emptyArray;
    
        /**
         * Resources frames.
         * @member {Array.<IPage>} frames
         * @memberof Resources
         * @instance
         */
        Resources.prototype.frames = $util.emptyArray;
    
        /**
         * Resources images.
         * @member {Array.<IBinaryResource>} images
         * @memberof Resources
         * @instance
         */
        Resources.prototype.images = $util.emptyArray;
    
        /**
         * Resources scripts.
         * @member {Array.<ITextResource>} scripts
         * @memberof Resources
         * @instance
         */
        Resources.prototype.scripts = $util.emptyArray;
    
        /**
         * Resources stylesheets.
         * @member {Array.<ITextResource>} stylesheets
         * @memberof Resources
         * @instance
         */
        Resources.prototype.stylesheets = $util.emptyArray;
    
        /**
         * Creates a new Resources instance using the specified properties.
         * @function create
         * @memberof Resources
         * @static
         * @param {IResources=} [properties] Properties to set
         * @returns {Resources} Resources instance
         */
        Resources.create = function create(properties) {
            return new Resources(properties);
        };
    
        /**
         * Encodes the specified Resources message. Does not implicitly {@link Resources.verify|verify} messages.
         * @function encode
         * @memberof Resources
         * @static
         * @param {IResources} message Resources message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Resources.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.backgroundImages != null && message.backgroundImages.length)
                for (var i = 0; i < message.backgroundImages.length; ++i)
                    $root.BinaryResource.encode(message.backgroundImages[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.fonts != null && message.fonts.length)
                for (var i = 0; i < message.fonts.length; ++i)
                    $root.BinaryResource.encode(message.fonts[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            if (message.frames != null && message.frames.length)
                for (var i = 0; i < message.frames.length; ++i)
                    $root.Page.encode(message.frames[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            if (message.images != null && message.images.length)
                for (var i = 0; i < message.images.length; ++i)
                    $root.BinaryResource.encode(message.images[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.scripts != null && message.scripts.length)
                for (var i = 0; i < message.scripts.length; ++i)
                    $root.TextResource.encode(message.scripts[i], writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            if (message.stylesheets != null && message.stylesheets.length)
                for (var i = 0; i < message.stylesheets.length; ++i)
                    $root.TextResource.encode(message.stylesheets[i], writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
            return writer;
        };
    
        /**
         * Encodes the specified Resources message, length delimited. Does not implicitly {@link Resources.verify|verify} messages.
         * @function encodeDelimited
         * @memberof Resources
         * @static
         * @param {IResources} message Resources message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Resources.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a Resources message from the specified reader or buffer.
         * @function decode
         * @memberof Resources
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {Resources} Resources
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Resources.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Resources();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    if (!(message.backgroundImages && message.backgroundImages.length))
                        message.backgroundImages = [];
                    message.backgroundImages.push($root.BinaryResource.decode(reader, reader.uint32()));
                    break;
                case 2:
                    if (!(message.fonts && message.fonts.length))
                        message.fonts = [];
                    message.fonts.push($root.BinaryResource.decode(reader, reader.uint32()));
                    break;
                case 3:
                    if (!(message.frames && message.frames.length))
                        message.frames = [];
                    message.frames.push($root.Page.decode(reader, reader.uint32()));
                    break;
                case 4:
                    if (!(message.images && message.images.length))
                        message.images = [];
                    message.images.push($root.BinaryResource.decode(reader, reader.uint32()));
                    break;
                case 5:
                    if (!(message.scripts && message.scripts.length))
                        message.scripts = [];
                    message.scripts.push($root.TextResource.decode(reader, reader.uint32()));
                    break;
                case 6:
                    if (!(message.stylesheets && message.stylesheets.length))
                        message.stylesheets = [];
                    message.stylesheets.push($root.TextResource.decode(reader, reader.uint32()));
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };
    
        /**
         * Decodes a Resources message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof Resources
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {Resources} Resources
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Resources.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a Resources message.
         * @function verify
         * @memberof Resources
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Resources.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.backgroundImages != null && message.hasOwnProperty("backgroundImages")) {
                if (!Array.isArray(message.backgroundImages))
                    return "backgroundImages: array expected";
                for (var i = 0; i < message.backgroundImages.length; ++i) {
                    var error = $root.BinaryResource.verify(message.backgroundImages[i]);
                    if (error)
                        return "backgroundImages." + error;
                }
            }
            if (message.fonts != null && message.hasOwnProperty("fonts")) {
                if (!Array.isArray(message.fonts))
                    return "fonts: array expected";
                for (var i = 0; i < message.fonts.length; ++i) {
                    var error = $root.BinaryResource.verify(message.fonts[i]);
                    if (error)
                        return "fonts." + error;
                }
            }
            if (message.frames != null && message.hasOwnProperty("frames")) {
                if (!Array.isArray(message.frames))
                    return "frames: array expected";
                for (var i = 0; i < message.frames.length; ++i) {
                    var error = $root.Page.verify(message.frames[i]);
                    if (error)
                        return "frames." + error;
                }
            }
            if (message.images != null && message.hasOwnProperty("images")) {
                if (!Array.isArray(message.images))
                    return "images: array expected";
                for (var i = 0; i < message.images.length; ++i) {
                    var error = $root.BinaryResource.verify(message.images[i]);
                    if (error)
                        return "images." + error;
                }
            }
            if (message.scripts != null && message.hasOwnProperty("scripts")) {
                if (!Array.isArray(message.scripts))
                    return "scripts: array expected";
                for (var i = 0; i < message.scripts.length; ++i) {
                    var error = $root.TextResource.verify(message.scripts[i]);
                    if (error)
                        return "scripts." + error;
                }
            }
            if (message.stylesheets != null && message.hasOwnProperty("stylesheets")) {
                if (!Array.isArray(message.stylesheets))
                    return "stylesheets: array expected";
                for (var i = 0; i < message.stylesheets.length; ++i) {
                    var error = $root.TextResource.verify(message.stylesheets[i]);
                    if (error)
                        return "stylesheets." + error;
                }
            }
            return null;
        };
    
        /**
         * Creates a Resources message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof Resources
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {Resources} Resources
         */
        Resources.fromObject = function fromObject(object) {
            if (object instanceof $root.Resources)
                return object;
            var message = new $root.Resources();
            if (object.backgroundImages) {
                if (!Array.isArray(object.backgroundImages))
                    throw TypeError(".Resources.backgroundImages: array expected");
                message.backgroundImages = [];
                for (var i = 0; i < object.backgroundImages.length; ++i) {
                    if (typeof object.backgroundImages[i] !== "object")
                        throw TypeError(".Resources.backgroundImages: object expected");
                    message.backgroundImages[i] = $root.BinaryResource.fromObject(object.backgroundImages[i]);
                }
            }
            if (object.fonts) {
                if (!Array.isArray(object.fonts))
                    throw TypeError(".Resources.fonts: array expected");
                message.fonts = [];
                for (var i = 0; i < object.fonts.length; ++i) {
                    if (typeof object.fonts[i] !== "object")
                        throw TypeError(".Resources.fonts: object expected");
                    message.fonts[i] = $root.BinaryResource.fromObject(object.fonts[i]);
                }
            }
            if (object.frames) {
                if (!Array.isArray(object.frames))
                    throw TypeError(".Resources.frames: array expected");
                message.frames = [];
                for (var i = 0; i < object.frames.length; ++i) {
                    if (typeof object.frames[i] !== "object")
                        throw TypeError(".Resources.frames: object expected");
                    message.frames[i] = $root.Page.fromObject(object.frames[i]);
                }
            }
            if (object.images) {
                if (!Array.isArray(object.images))
                    throw TypeError(".Resources.images: array expected");
                message.images = [];
                for (var i = 0; i < object.images.length; ++i) {
                    if (typeof object.images[i] !== "object")
                        throw TypeError(".Resources.images: object expected");
                    message.images[i] = $root.BinaryResource.fromObject(object.images[i]);
                }
            }
            if (object.scripts) {
                if (!Array.isArray(object.scripts))
                    throw TypeError(".Resources.scripts: array expected");
                message.scripts = [];
                for (var i = 0; i < object.scripts.length; ++i) {
                    if (typeof object.scripts[i] !== "object")
                        throw TypeError(".Resources.scripts: object expected");
                    message.scripts[i] = $root.TextResource.fromObject(object.scripts[i]);
                }
            }
            if (object.stylesheets) {
                if (!Array.isArray(object.stylesheets))
                    throw TypeError(".Resources.stylesheets: array expected");
                message.stylesheets = [];
                for (var i = 0; i < object.stylesheets.length; ++i) {
                    if (typeof object.stylesheets[i] !== "object")
                        throw TypeError(".Resources.stylesheets: object expected");
                    message.stylesheets[i] = $root.TextResource.fromObject(object.stylesheets[i]);
                }
            }
            return message;
        };
    
        /**
         * Creates a plain object from a Resources message. Also converts values to other types if specified.
         * @function toObject
         * @memberof Resources
         * @static
         * @param {Resources} message Resources
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Resources.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.backgroundImages = [];
                object.fonts = [];
                object.frames = [];
                object.images = [];
                object.scripts = [];
                object.stylesheets = [];
            }
            if (message.backgroundImages && message.backgroundImages.length) {
                object.backgroundImages = [];
                for (var j = 0; j < message.backgroundImages.length; ++j)
                    object.backgroundImages[j] = $root.BinaryResource.toObject(message.backgroundImages[j], options);
            }
            if (message.fonts && message.fonts.length) {
                object.fonts = [];
                for (var j = 0; j < message.fonts.length; ++j)
                    object.fonts[j] = $root.BinaryResource.toObject(message.fonts[j], options);
            }
            if (message.frames && message.frames.length) {
                object.frames = [];
                for (var j = 0; j < message.frames.length; ++j)
                    object.frames[j] = $root.Page.toObject(message.frames[j], options);
            }
            if (message.images && message.images.length) {
                object.images = [];
                for (var j = 0; j < message.images.length; ++j)
                    object.images[j] = $root.BinaryResource.toObject(message.images[j], options);
            }
            if (message.scripts && message.scripts.length) {
                object.scripts = [];
                for (var j = 0; j < message.scripts.length; ++j)
                    object.scripts[j] = $root.TextResource.toObject(message.scripts[j], options);
            }
            if (message.stylesheets && message.stylesheets.length) {
                object.stylesheets = [];
                for (var j = 0; j < message.stylesheets.length; ++j)
                    object.stylesheets[j] = $root.TextResource.toObject(message.stylesheets[j], options);
            }
            return object;
        };
    
        /**
         * Converts this Resources to JSON.
         * @function toJSON
         * @memberof Resources
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Resources.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        return Resources;
    })();
    
    $root.TextResource = (function() {
    
        /**
         * Properties of a TextResource.
         * @exports ITextResource
         * @interface ITextResource
         * @property {string|null} [name] TextResource name
         * @property {string|null} [contentType] TextResource contentType
         * @property {string|null} [extension] TextResource extension
         * @property {string|null} [url] TextResource url
         * @property {string|null} [content] TextResource content
         */
    
        /**
         * Constructs a new TextResource.
         * @exports TextResource
         * @classdesc Represents a TextResource.
         * @implements ITextResource
         * @constructor
         * @param {ITextResource=} [properties] Properties to set
         */
        function TextResource(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * TextResource name.
         * @member {string} name
         * @memberof TextResource
         * @instance
         */
        TextResource.prototype.name = "";
    
        /**
         * TextResource contentType.
         * @member {string} contentType
         * @memberof TextResource
         * @instance
         */
        TextResource.prototype.contentType = "";
    
        /**
         * TextResource extension.
         * @member {string} extension
         * @memberof TextResource
         * @instance
         */
        TextResource.prototype.extension = "";
    
        /**
         * TextResource url.
         * @member {string} url
         * @memberof TextResource
         * @instance
         */
        TextResource.prototype.url = "";
    
        /**
         * TextResource content.
         * @member {string} content
         * @memberof TextResource
         * @instance
         */
        TextResource.prototype.content = "";
    
        /**
         * Creates a new TextResource instance using the specified properties.
         * @function create
         * @memberof TextResource
         * @static
         * @param {ITextResource=} [properties] Properties to set
         * @returns {TextResource} TextResource instance
         */
        TextResource.create = function create(properties) {
            return new TextResource(properties);
        };
    
        /**
         * Encodes the specified TextResource message. Does not implicitly {@link TextResource.verify|verify} messages.
         * @function encode
         * @memberof TextResource
         * @static
         * @param {ITextResource} message TextResource message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        TextResource.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.name != null && message.hasOwnProperty("name"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
            if (message.contentType != null && message.hasOwnProperty("contentType"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.contentType);
            if (message.extension != null && message.hasOwnProperty("extension"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.extension);
            if (message.url != null && message.hasOwnProperty("url"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.url);
            if (message.content != null && message.hasOwnProperty("content"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.content);
            return writer;
        };
    
        /**
         * Encodes the specified TextResource message, length delimited. Does not implicitly {@link TextResource.verify|verify} messages.
         * @function encodeDelimited
         * @memberof TextResource
         * @static
         * @param {ITextResource} message TextResource message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        TextResource.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a TextResource message from the specified reader or buffer.
         * @function decode
         * @memberof TextResource
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {TextResource} TextResource
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        TextResource.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.TextResource();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.name = reader.string();
                    break;
                case 2:
                    message.contentType = reader.string();
                    break;
                case 3:
                    message.extension = reader.string();
                    break;
                case 4:
                    message.url = reader.string();
                    break;
                case 5:
                    message.content = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };
    
        /**
         * Decodes a TextResource message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof TextResource
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {TextResource} TextResource
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        TextResource.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a TextResource message.
         * @function verify
         * @memberof TextResource
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        TextResource.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.name != null && message.hasOwnProperty("name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            if (message.contentType != null && message.hasOwnProperty("contentType"))
                if (!$util.isString(message.contentType))
                    return "contentType: string expected";
            if (message.extension != null && message.hasOwnProperty("extension"))
                if (!$util.isString(message.extension))
                    return "extension: string expected";
            if (message.url != null && message.hasOwnProperty("url"))
                if (!$util.isString(message.url))
                    return "url: string expected";
            if (message.content != null && message.hasOwnProperty("content"))
                if (!$util.isString(message.content))
                    return "content: string expected";
            return null;
        };
    
        /**
         * Creates a TextResource message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof TextResource
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {TextResource} TextResource
         */
        TextResource.fromObject = function fromObject(object) {
            if (object instanceof $root.TextResource)
                return object;
            var message = new $root.TextResource();
            if (object.name != null)
                message.name = String(object.name);
            if (object.contentType != null)
                message.contentType = String(object.contentType);
            if (object.extension != null)
                message.extension = String(object.extension);
            if (object.url != null)
                message.url = String(object.url);
            if (object.content != null)
                message.content = String(object.content);
            return message;
        };
    
        /**
         * Creates a plain object from a TextResource message. Also converts values to other types if specified.
         * @function toObject
         * @memberof TextResource
         * @static
         * @param {TextResource} message TextResource
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        TextResource.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.name = "";
                object.contentType = "";
                object.extension = "";
                object.url = "";
                object.content = "";
            }
            if (message.name != null && message.hasOwnProperty("name"))
                object.name = message.name;
            if (message.contentType != null && message.hasOwnProperty("contentType"))
                object.contentType = message.contentType;
            if (message.extension != null && message.hasOwnProperty("extension"))
                object.extension = message.extension;
            if (message.url != null && message.hasOwnProperty("url"))
                object.url = message.url;
            if (message.content != null && message.hasOwnProperty("content"))
                object.content = message.content;
            return object;
        };
    
        /**
         * Converts this TextResource to JSON.
         * @function toJSON
         * @memberof TextResource
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        TextResource.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        return TextResource;
    })();
    
    $root.BinaryResource = (function() {
    
        /**
         * Properties of a BinaryResource.
         * @exports IBinaryResource
         * @interface IBinaryResource
         * @property {string|null} [name] BinaryResource name
         * @property {string|null} [contentType] BinaryResource contentType
         * @property {string|null} [extension] BinaryResource extension
         * @property {string|null} [url] BinaryResource url
         * @property {Uint8Array|null} [content] BinaryResource content
         */
    
        /**
         * Constructs a new BinaryResource.
         * @exports BinaryResource
         * @classdesc Represents a BinaryResource.
         * @implements IBinaryResource
         * @constructor
         * @param {IBinaryResource=} [properties] Properties to set
         */
        function BinaryResource(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * BinaryResource name.
         * @member {string} name
         * @memberof BinaryResource
         * @instance
         */
        BinaryResource.prototype.name = "";
    
        /**
         * BinaryResource contentType.
         * @member {string} contentType
         * @memberof BinaryResource
         * @instance
         */
        BinaryResource.prototype.contentType = "";
    
        /**
         * BinaryResource extension.
         * @member {string} extension
         * @memberof BinaryResource
         * @instance
         */
        BinaryResource.prototype.extension = "";
    
        /**
         * BinaryResource url.
         * @member {string} url
         * @memberof BinaryResource
         * @instance
         */
        BinaryResource.prototype.url = "";
    
        /**
         * BinaryResource content.
         * @member {Uint8Array} content
         * @memberof BinaryResource
         * @instance
         */
        BinaryResource.prototype.content = $util.newBuffer([]);
    
        /**
         * Creates a new BinaryResource instance using the specified properties.
         * @function create
         * @memberof BinaryResource
         * @static
         * @param {IBinaryResource=} [properties] Properties to set
         * @returns {BinaryResource} BinaryResource instance
         */
        BinaryResource.create = function create(properties) {
            return new BinaryResource(properties);
        };
    
        /**
         * Encodes the specified BinaryResource message. Does not implicitly {@link BinaryResource.verify|verify} messages.
         * @function encode
         * @memberof BinaryResource
         * @static
         * @param {IBinaryResource} message BinaryResource message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        BinaryResource.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.name != null && message.hasOwnProperty("name"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
            if (message.contentType != null && message.hasOwnProperty("contentType"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.contentType);
            if (message.extension != null && message.hasOwnProperty("extension"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.extension);
            if (message.url != null && message.hasOwnProperty("url"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.url);
            if (message.content != null && message.hasOwnProperty("content"))
                writer.uint32(/* id 5, wireType 2 =*/42).bytes(message.content);
            return writer;
        };
    
        /**
         * Encodes the specified BinaryResource message, length delimited. Does not implicitly {@link BinaryResource.verify|verify} messages.
         * @function encodeDelimited
         * @memberof BinaryResource
         * @static
         * @param {IBinaryResource} message BinaryResource message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        BinaryResource.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a BinaryResource message from the specified reader or buffer.
         * @function decode
         * @memberof BinaryResource
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {BinaryResource} BinaryResource
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        BinaryResource.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.BinaryResource();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.name = reader.string();
                    break;
                case 2:
                    message.contentType = reader.string();
                    break;
                case 3:
                    message.extension = reader.string();
                    break;
                case 4:
                    message.url = reader.string();
                    break;
                case 5:
                    message.content = reader.bytes();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };
    
        /**
         * Decodes a BinaryResource message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof BinaryResource
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {BinaryResource} BinaryResource
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        BinaryResource.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a BinaryResource message.
         * @function verify
         * @memberof BinaryResource
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        BinaryResource.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.name != null && message.hasOwnProperty("name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            if (message.contentType != null && message.hasOwnProperty("contentType"))
                if (!$util.isString(message.contentType))
                    return "contentType: string expected";
            if (message.extension != null && message.hasOwnProperty("extension"))
                if (!$util.isString(message.extension))
                    return "extension: string expected";
            if (message.url != null && message.hasOwnProperty("url"))
                if (!$util.isString(message.url))
                    return "url: string expected";
            if (message.content != null && message.hasOwnProperty("content"))
                if (!(message.content && typeof message.content.length === "number" || $util.isString(message.content)))
                    return "content: buffer expected";
            return null;
        };
    
        /**
         * Creates a BinaryResource message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof BinaryResource
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {BinaryResource} BinaryResource
         */
        BinaryResource.fromObject = function fromObject(object) {
            if (object instanceof $root.BinaryResource)
                return object;
            var message = new $root.BinaryResource();
            if (object.name != null)
                message.name = String(object.name);
            if (object.contentType != null)
                message.contentType = String(object.contentType);
            if (object.extension != null)
                message.extension = String(object.extension);
            if (object.url != null)
                message.url = String(object.url);
            if (object.content != null)
                if (typeof object.content === "string")
                    $util.base64.decode(object.content, message.content = $util.newBuffer($util.base64.length(object.content)), 0);
                else if (object.content.length)
                    message.content = object.content;
            return message;
        };
    
        /**
         * Creates a plain object from a BinaryResource message. Also converts values to other types if specified.
         * @function toObject
         * @memberof BinaryResource
         * @static
         * @param {BinaryResource} message BinaryResource
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        BinaryResource.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.name = "";
                object.contentType = "";
                object.extension = "";
                object.url = "";
                if (options.bytes === String)
                    object.content = "";
                else {
                    object.content = [];
                    if (options.bytes !== Array)
                        object.content = $util.newBuffer(object.content);
                }
            }
            if (message.name != null && message.hasOwnProperty("name"))
                object.name = message.name;
            if (message.contentType != null && message.hasOwnProperty("contentType"))
                object.contentType = message.contentType;
            if (message.extension != null && message.hasOwnProperty("extension"))
                object.extension = message.extension;
            if (message.url != null && message.hasOwnProperty("url"))
                object.url = message.url;
            if (message.content != null && message.hasOwnProperty("content"))
                object.content = options.bytes === String ? $util.base64.encode(message.content, 0, message.content.length) : options.bytes === Array ? Array.prototype.slice.call(message.content) : message.content;
            return object;
        };
    
        /**
         * Converts this BinaryResource to JSON.
         * @function toJSON
         * @memberof BinaryResource
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        BinaryResource.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        return BinaryResource;
    })();

    return $root;
})(protobuf);
