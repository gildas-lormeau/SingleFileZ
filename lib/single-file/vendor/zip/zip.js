/*
 Copyright (c) 2013 Gildas Lormeau. All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in
 the documentation and/or other materials provided with the distribution.

 3. The names of the authors may not be used to endorse or promote products
 derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
 INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
 INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
 INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
 OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* global Blob, setTimeout, FileReader, Worker, document, crypto, TextEncoder */

(function (obj) {
	"use strict";

	var ERR_BAD_FORMAT = "File format is not recognized.";
	var ERR_CRC = "CRC failed.";
	var ERR_ENCRYPTED = "File contains encrypted entry.";
	var ERR_INVALID_PASSORD = "Invalid pasword";
	var ERR_INVALID_SIGNATURE = "Invalid signature";
	var ERR_ZIP64 = "File is using Zip64 (4gb+ file size).";
	var ERR_READ = "Error while reading zip file.";
	var ERR_WRITE = "Error while writing zip file.";
	var ERR_WRITE_DATA = "Error while writing file data.";
	var ERR_READ_DATA = "Error while reading file data.";
	var ERR_DUPLICATED_NAME = "File already exists.";
	var CHUNK_SIZE = 512 * 1024;

	var TEXT_PLAIN = "text/plain";

	var appendABViewSupported;
	try {
		appendABViewSupported = new Blob([new DataView(new ArrayBuffer(0))]).size === 0;
	} catch (e) {
		// ignored
	}

	function Crc32() {
		this.crc = -1;
	}
	Crc32.prototype.append = function append(data) {
		var crc = this.crc | 0, table = this.table;
		for (var offset = 0, len = data.length | 0; offset < len; offset++)
			crc = (crc >>> 8) ^ table[(crc ^ data[offset]) & 0xFF];
		this.crc = crc;
	};
	Crc32.prototype.get = function get() {
		return ~this.crc;
	};
	Crc32.prototype.table = (function () {
		var i, j, t, table = []; // Uint32Array is actually slower than []
		for (i = 0; i < 256; i++) {
			t = i;
			for (j = 0; j < 8; j++)
				if (t & 1)
					t = (t >>> 1) ^ 0xEDB88320;
				else
					t = t >>> 1;
			table[i] = t;
		}
		return table;
	})();

	// "no-op" codec
	function NOOP() { }
	NOOP.prototype.append = function append(bytes/*, onprogress*/) {
		return bytes;
	};
	NOOP.prototype.flush = function flush() { };

	function blobSlice(blob, index, length) {
		if (index < 0 || length < 0 || index + length > blob.size)
			throw new RangeError("offset:" + index + ", length:" + length + ", size:" + blob.size);
		if (blob.slice)
			return blob.slice(index, index + length);
		else if (blob.webkitSlice)
			return blob.webkitSlice(index, index + length);
		else if (blob.mozSlice)
			return blob.mozSlice(index, index + length);
		else if (blob.msSlice)
			return blob.msSlice(index, index + length);
	}

	function getDataHelper(byteLength, bytes) {
		var dataBuffer, dataArray;
		dataBuffer = new ArrayBuffer(byteLength);
		dataArray = new Uint8Array(dataBuffer);
		if (bytes)
			dataArray.set(bytes, 0);
		return {
			buffer: dataBuffer,
			array: dataArray,
			view: new DataView(dataBuffer)
		};
	}

	var BASE_KEY_ALG = { name: "PBKDF2", hash: { name: "HMAC" } };
	var CRYPT_KEY_ALG = { name: "AES-CTR" };
	var AUTH_KEY_ALG = { name: "HMAC", hash: "SHA-1" };
	var INIT_COUNTER = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

	// Readers
	function Reader() {
	}
	Reader.prototype.startDecrypt = function (index, callback, onerror) {
		var that = this;
		this.counter = new Uint8Array(INIT_COUNTER);
		this.readUint8Array(index, 18, function (saltAndPasswordVerification) {
			var compositeKey, salt = saltAndPasswordVerification.slice(0, 16),
				passwordVerification = saltAndPasswordVerification.slice(16);

			crypto.subtle.importKey("raw", (new TextEncoder()).encode(that.password), BASE_KEY_ALG, false, ["deriveBits"])
				.then(function (basekey) {
					return crypto.subtle.deriveBits(
						{ name: "PBKDF2", salt: salt, iterations: 1000, hash: { name: "SHA-1" } },
						basekey,
						528
					);
				}).then(function (derivedBits) {
					compositeKey = new Uint8Array(derivedBits);
					return Promise.all([
						crypto.subtle.importKey("raw", compositeKey.slice(0, 32), CRYPT_KEY_ALG, true, ["decrypt"]),
						crypto.subtle.importKey("raw", compositeKey.slice(32, 64), AUTH_KEY_ALG, false, ["sign"])
					]);
				}).then(function (args) {
					that.keys = {
						decryption: args[0],
						authentication: args[1],
						passwordVerification: compositeKey.slice(64)
					};
					if (that.keys.passwordVerification[0] != passwordVerification[0] || that.keys.passwordVerification[1] != passwordVerification[1]) {
						onerror(ERR_INVALID_PASSORD);
					}
					else {
						that.encryptedArray = new Uint8Array(0);
						callback();
					}
				}).catch(onerror);
		});
	};
	Reader.prototype.decryptUint8Array = function (index, length, callback, onerror) {
		var that = this, decryptedArray = new Uint8Array(length);
		this.readUint8Array(index, length, function (encryptedArray) {
			step(0);

			function step(index) {
				crypto.subtle.decrypt(
					{ name: "AES-CTR", counter: that.counter, length: 16 },
					that.keys.decryption,
					encryptedArray.slice(index, index + 16)
				).then(function (decryptedChunk) {
					var indexCounter, previousEncryptedArray;
					decryptedArray.set(new Uint8Array(decryptedChunk), index);
					for (indexCounter = 0; indexCounter < 16; indexCounter++) {
						if (that.counter[indexCounter] === 255)
							that.counter[indexCounter] = 0;
						else {
							that.counter[indexCounter]++;
							break;
						}
					}
					if (index + 16 < encryptedArray.length) {
						step(index + 16);
					}
					else {
						previousEncryptedArray = that.encryptedArray;
						that.encryptedArray = new Uint8Array(previousEncryptedArray.length + encryptedArray.length);
						that.encryptedArray.set(previousEncryptedArray, 0);
						that.encryptedArray.set(encryptedArray, previousEncryptedArray.length);
						callback(decryptedArray);
					}
				}).catch(onerror);
			}
		}, onerror);
	};
	Reader.prototype.verifySignature = function (index, callback, onerror) {
		var that = this;
		that.readUint8Array(index, 10, function (originalSignatureArray) {
			crypto.subtle.sign(
				{ name: "HMAC" },
				that.keys.authentication,
				that.encryptedArray
			).then(function (signature) {
				var signatureArray = new Uint8Array(signature), indexSignature;
				that.encryptedArray = null;
				for (indexSignature = 0; indexSignature < originalSignatureArray.length; indexSignature++) {
					if (signatureArray[indexSignature] != originalSignatureArray[indexSignature]) {
						callback(false);
						return;
					}
				}
				callback(true);
			}).catch(onerror);
		});
	};

	function TextReader(text) {
		var that = this, blobReader;

		function init(callback, onerror) {
			var blob = new Blob([text], {
				type: TEXT_PLAIN
			});
			blobReader = new BlobReader(blob);
			blobReader.init(function () {
				that.size = blobReader.size;
				callback();
			}, onerror);
		}

		function readUint8Array(index, length, callback, onerror) {
			blobReader.readUint8Array(index, length, callback, onerror);
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	TextReader.prototype = new Reader();
	TextReader.prototype.constructor = TextReader;

	function Data64URIReader(dataURI) {
		var that = this, dataStart;

		function init(callback) {
			var dataEnd = dataURI.length;
			while (dataURI.charAt(dataEnd - 1) == "=")
				dataEnd--;
			dataStart = dataURI.indexOf(",") + 1;
			that.size = Math.floor((dataEnd - dataStart) * 0.75);
			callback();
		}

		function readUint8Array(index, length, callback) {
			var i, data = getDataHelper(length);
			var start = Math.floor(index / 3) * 4;
			var end = Math.ceil((index + length) / 3) * 4;
			var bytes = obj.atob(dataURI.substring(start + dataStart, end + dataStart));
			var delta = index - Math.floor(start / 4) * 3;
			for (i = delta; i < delta + length; i++)
				data.array[i - delta] = bytes.charCodeAt(i);
			callback(data.array);
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	Data64URIReader.prototype = new Reader();
	Data64URIReader.prototype.constructor = Data64URIReader;

	function BlobReader(blob) {
		var that = this;

		function init(callback) {
			that.size = blob.size;
			callback();
		}

		function readUint8Array(index, length, callback, onerror) {
			var reader = new FileReader();
			reader.onload = function (e) {
				callback(new Uint8Array(e.target.result));
			};
			reader.onerror = onerror;
			try {
				reader.readAsArrayBuffer(blobSlice(blob, index, length));
			} catch (e) {
				onerror(e);
			}
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	BlobReader.prototype = new Reader();
	BlobReader.prototype.constructor = BlobReader;

	// Writers

	function Writer() {
	}
	Writer.prototype.getData = function (callback) {
		callback(this.data);
	};
	Writer.prototype.encryptUint8Array = function (array, callback, onerror) {
		var that = this, encryptedArray = new Uint8Array(array.length - (array.length % 16)), compositeKey;
		if (!this.encryptedArray) {
			this.encryptedArray = new Uint8Array(0);
			this.chunkToEncrypt = new Uint8Array(0);
			this.counter = new Uint8Array(INIT_COUNTER);
			this.salt = crypto.getRandomValues(new Uint8Array(16));
			crypto.subtle.importKey("raw", (new TextEncoder()).encode(that.password), BASE_KEY_ALG, false, ["deriveBits"])
				.then(function (basekey) {
					return crypto.subtle.deriveBits(
						{ name: "PBKDF2", salt: that.salt, iterations: 1000, hash: { name: "SHA-1" } },
						basekey,
						528
					);
				}).then(function (derivedBits) {
					compositeKey = new Uint8Array(derivedBits);
					return Promise.all([
						crypto.subtle.importKey("raw", compositeKey.slice(0, 32), CRYPT_KEY_ALG, true, ["encrypt"]),
						crypto.subtle.importKey("raw", compositeKey.slice(32, 64), AUTH_KEY_ALG, false, ["sign"])
					]);
				}).then(function (args) {
					var preludeData;
					that.keys = {
						encryption: args[0],
						authentication: args[1],
						passwordVerification: compositeKey.slice(64)
					};
					preludeData = new Uint8Array(that.salt.length + that.keys.passwordVerification.length);
					preludeData.set(that.salt, 0);
					preludeData.set(that.keys.passwordVerification, that.salt.length);
					that.writeUint8Array(preludeData, function () {
						step(0);
					}, onerror);
				}).catch(onerror);
		}
		else
			step(0);

		function step(index) {
			var newArray, previousEncryptedArray;
			if (!index && that.chunkToEncrypt.length) {
				newArray = new Uint8Array(array.length + that.chunkToEncrypt.length);
				newArray.set(that.chunkToEncrypt, 0);
				newArray.set(array, that.chunkToEncrypt.length);
				array = newArray;
				previousEncryptedArray = encryptedArray;
				encryptedArray = new Uint8Array(array.length - (array.length % 16));
				encryptedArray.set(previousEncryptedArray, 0);
			}
			if (index + 16 <= array.length) {
				crypto.subtle.encrypt(
					{ name: "AES-CTR", counter: that.counter, length: 16 },
					that.keys.encryption,
					array.slice(index, index + 16)
				).then(function (encryptedChunk) {
					var indexCounter;
					for (indexCounter = 0; indexCounter < 16; indexCounter++) {
						if (that.counter[indexCounter] === 255)
							that.counter[indexCounter] = 0;
						else {
							that.counter[indexCounter]++;
							break;
						}
					}
					encryptedArray.set(new Uint8Array(encryptedChunk), index);
					step(index + 16);
				}).catch(onerror);
			}
			else {
				that.chunkToEncrypt = array.slice(index);
				previousEncryptedArray = that.encryptedArray;
				that.encryptedArray = new Uint8Array(previousEncryptedArray.length + encryptedArray.length);
				that.encryptedArray.set(previousEncryptedArray, 0);
				that.encryptedArray.set(encryptedArray, previousEncryptedArray.length);
				that.writeUint8Array(encryptedArray, callback, onerror);
			}
		}
	};
	Writer.prototype.endEncrypt = function (callback, onerror) {
		var that = this;
		if (that.chunkToEncrypt.length)
			crypto.subtle.encrypt(
				{ name: "AES-CTR", counter: that.counter, length: 16 },
				that.keys.encryption,
				that.chunkToEncrypt
			).then(function (encryptedChunk) {
				var previousEncryptedArray, encryptedChunkArray = new Uint8Array(encryptedChunk);
				previousEncryptedArray = that.encryptedArray;
				that.encryptedArray = new Uint8Array(previousEncryptedArray.length + encryptedChunkArray.length);
				that.encryptedArray.set(previousEncryptedArray, 0);
				that.encryptedArray.set(encryptedChunkArray, previousEncryptedArray.length);
				that.writeUint8Array(encryptedChunkArray, sign, onerror);
			});
		else
			sign();

		function sign() {
			crypto.subtle.sign(
				{ name: "HMAC" },
				that.keys.authentication,
				that.encryptedArray
			).then(function (signature) {
				that.writeUint8Array(new Uint8Array(signature).slice(0, 10), function () {
					that.encryptedArray = null;
					callback();
				}, onerror);
			}).catch(onerror);
		}
	};

	function TextWriter(encoding) {
		var that = this, blob;

		function init(callback) {
			blob = new Blob([], {
				type: TEXT_PLAIN
			});
			callback();
		}

		function writeUint8Array(array, callback) {
			blob = new Blob([blob, appendABViewSupported ? array : array.buffer], {
				type: TEXT_PLAIN
			});
			callback();
		}

		function getData(callback, onerror) {
			var reader = new FileReader();
			reader.onload = function (e) {
				callback(e.target.result);
			};
			reader.onerror = onerror;
			reader.readAsText(blob, encoding);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	TextWriter.prototype = new Writer();
	TextWriter.prototype.constructor = TextWriter;

	function Data64URIWriter(contentType) {
		var that = this, data = "", pending = "";

		function init(callback) {
			data += "data:" + (contentType || "") + ";base64,";
			callback();
		}

		function writeUint8Array(array, callback) {
			var i, delta = pending.length, dataString = pending;
			pending = "";
			for (i = 0; i < (Math.floor((delta + array.length) / 3) * 3) - delta; i++)
				dataString += String.fromCharCode(array[i]);
			for (; i < array.length; i++)
				pending += String.fromCharCode(array[i]);
			if (dataString.length > 2)
				data += obj.btoa(dataString);
			else
				pending = dataString;
			callback();
		}

		function getData(callback) {
			callback(data + obj.btoa(pending));
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	Data64URIWriter.prototype = new Writer();
	Data64URIWriter.prototype.constructor = Data64URIWriter;

	function BlobWriter(contentType) {
		var blob, that = this;

		function init(callback) {
			this.offset = 0;
			blob = new Blob([], {
				type: contentType
			});
			callback();
		}

		function writeUint8Array(array, callback) {
			blob = new Blob([blob, appendABViewSupported ? array : array.buffer], {
				type: contentType
			});
			this.offset = blob.size;
			callback();
		}

		function getData(callback) {
			callback(blob);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	BlobWriter.prototype = new Writer();
	BlobWriter.prototype.constructor = BlobWriter;

	/** 
	 * inflate/deflate core functions
	 * @param worker {Worker} web worker for the task.
	 * @param initialMessage {Object} initial message to be sent to the worker. should contain
	 *   sn(serial number for distinguishing multiple tasks sent to the worker), and codecClass.
	 *   This function may add more properties before sending.
	 */
	function launchWorkerProcess(worker, initialMessage, reader, writer, offset, size, onprogress, onend, onreaderror, onwriteerror) {
		var chunkIndex = 0,
			writerHasPassword = writer.password && writer.password.length,
			readerHasPassword = reader.password && reader.password.length,
			index, outputSize, sn = initialMessage.sn, crc;

		function onflush() {
			worker.removeEventListener("message", onmessage, false);
			onend(outputSize, crc);
		}

		function onmessage(event) {
			var message = event.data, data = message.data, err = message.error;
			if (err) {
				err.toString = function () { return "Error: " + this.message; };
				onreaderror(err);
				return;
			}
			if (message.sn !== sn)
				return;
			if (typeof message.codecTime === "number")
				worker.codecTime += message.codecTime; // should be before onflush()
			if (typeof message.crcTime === "number")
				worker.crcTime += message.crcTime;

			switch (message.type) {
				case "append":
					if (data) {
						outputSize += data.length;
						if (writerHasPassword)
							writer.encryptUint8Array(data, function () {
								step();
							}, onwriteerror);
						else
							writer.writeUint8Array(data, function () {
								step();
							}, onwriteerror);
					} else
						step();
					break;
				case "flush":
					crc = message.crc;
					if (data) {
						outputSize += data.length;
						if (writerHasPassword)
							writer.encryptUint8Array(data, function () {
								writer.endEncrypt(function () {
									outputSize += 28;
									onflush();
								}, onwriteerror);
							}, onwriteerror);
						else
							writer.writeUint8Array(data, function () {
								onflush();
							}, onwriteerror);
					} else {
						if (writerHasPassword)
							writer.endEncrypt(function () {
								outputSize += 28;
								onflush();
							}, onwriteerror);
						else
							onflush();
					}
					break;
				case "progress":
					if (onprogress)
						onprogress(index + message.loaded, size);
					break;
				case "importScripts": //no need to handle here
				case "newTask":
				case "echo":
					break;
				default:
					console.warn("zip.js:launchWorkerProcess: unknown message: ", message);
			}
		}

		function step() {
			index = chunkIndex * CHUNK_SIZE;
			// use `<=` instead of `<`, because `size` may be 0.
			if (index <= size)
				if (readerHasPassword)
					reader.decryptUint8Array(offset + index, Math.min(CHUNK_SIZE, size - index - 28), onread, onreaderror);
				else
					reader.readUint8Array(offset + index, Math.min(CHUNK_SIZE, size - index), onread, onreaderror);
			else {
				if (readerHasPassword)
					reader.verifySignature(offset + size - 28, function (valid) {
						if (valid)
							worker.postMessage({
								sn: sn,
								type: "flush"
							});
						else
							onreaderror(ERR_INVALID_SIGNATURE);
					}, onreaderror);
				else
					worker.postMessage({
						sn: sn,
						type: "flush"
					});
			}

			function onread(array) {
				if (onprogress)
					onprogress(index, size);
				var msg = index === 0 ? initialMessage : { sn: sn };
				msg.type = "append";
				msg.data = array;

				// posting a message with transferables will fail on IE10
				try {
					worker.postMessage(msg, [array.buffer]);
				} catch (ex) {
					worker.postMessage(msg); // retry without transferables
				}
				chunkIndex++;
			}
		}

		outputSize = 0;
		worker.addEventListener("message", onmessage, false);
		step();
	}

	function launchProcess(process, reader, writer, offset, size, crcType, onprogress, onend, onreaderror, onwriteerror) {
		var chunkIndex = 0, index, outputSize = 0,
			readerHasPassword = reader.password && reader.password.length,
			writerHasPassword = writer.password && writer.password.length,
			crcInput = crcType === "input",
			crcOutput = crcType === "output",
			crc = new Crc32();

		function nextStep() {
			var index = chunkIndex * CHUNK_SIZE;
			if (index < size) {
				setTimeout(step, 0);
			} else {
				step();
			}
		}

		function step() {
			var outputData;
			index = chunkIndex * CHUNK_SIZE;
			if (index < size)
				if (readerHasPassword)
					reader.decryptUint8Array(offset + index, Math.min(CHUNK_SIZE, size - index - 28), onread, onreaderror);
				else
					reader.readUint8Array(offset + index, Math.min(CHUNK_SIZE, size - index), onread, onreaderror);
			else {
				if (readerHasPassword)
					reader.verifySignature(offset + size - 28, function (valid) {
						if (valid)
							flush();
						else
							onreaderror(ERR_INVALID_SIGNATURE);
					}, onreaderror);
				else
					flush();
			}

			function flush() {
				try {
					outputData = process.flush();
				} catch (e) {
					onreaderror(e);
					return;
				}
				if (outputData) {
					if (crcOutput)
						crc.append(outputData);
					outputSize += outputData.length;
					if (writerHasPassword)
						writer.encryptUint8Array(outputData, function () {
							writer.endEncrypt(function () {
								outputSize += 28;
								onend(outputSize, crc.get());
							}, onwriteerror);
						}, onwriteerror);
					else
						writer.writeUint8Array(outputData, function () {
							onend(outputSize, crc.get());
						}, onwriteerror);
				}
				else {
					if (writerHasPassword)
						writer.endEncrypt(function () {
							outputSize += 28;
							onend(outputSize, crc.get());
						}, onwriteerror);
					else
						onend(outputSize, crc.get());
				}
			}

			function onread(inputData) {
				var outputData;
				try {
					outputData = process.append(inputData, function (loaded) {
						if (onprogress)
							onprogress(index + loaded, size);
					});
				} catch (e) {
					onreaderror(e);
					return;
				}
				if (crcInput)
					crc.append(inputData);
				if (outputData) {
					outputSize += outputData.length;
					if (writerHasPassword)
						writer.encryptUint8Array(outputData, function () {
							chunkIndex++;
							nextStep();
						}, onwriteerror);
					else
						writer.writeUint8Array(outputData, function () {
							chunkIndex++;
							nextStep();
						}, onwriteerror);
					if (crcOutput)
						crc.append(outputData);
				} else {
					chunkIndex++;
					nextStep();
				}
				if (onprogress)
					onprogress(index, size);
			}
		}

		step();
	}

	function inflate(worker, sn, reader, writer, offset, size, computeCrc32, onend, onprogress, onreaderror, onwriteerror) {
		var crcType = computeCrc32 ? "output" : "none";
		if (obj.zip.useWebWorkers) {
			var initialMessage = {
				sn: sn,
				codecClass: "Inflater",
				crcType: crcType,
			};
			launchWorkerProcess(worker, initialMessage, reader, writer, offset, size, onprogress, onend, onreaderror, onwriteerror);
		} else
			launchProcess(new obj.zip.Inflater(), reader, writer, offset, size, crcType, onprogress, onend, onreaderror, onwriteerror);
	}

	function deflate(worker, sn, reader, writer, level, computeCrc32, onend, onprogress, onreaderror, onwriteerror) {
		var crcType = computeCrc32 ? "input" : "none";
		if (obj.zip.useWebWorkers) {
			var initialMessage = {
				sn: sn,
				options: { level: level },
				codecClass: "Deflater",
				crcType: crcType,
			};
			launchWorkerProcess(worker, initialMessage, reader, writer, 0, reader.size, onprogress, onend, onreaderror, onwriteerror);
		} else
			launchProcess(new obj.zip.Deflater(), reader, writer, 0, reader.size, crcType, onprogress, onend, onreaderror, onwriteerror);
	}

	function copy(worker, sn, reader, writer, offset, size, computeCrc32, onend, onprogress, onreaderror, onwriteerror) {
		var crcType = computeCrc32 ? "input" : "none";
		if (obj.zip.useWebWorkers) {
			var initialMessage = {
				sn: sn,
				codecClass: "NOOP",
				crcType: crcType,
			};
			launchWorkerProcess(worker, initialMessage, reader, writer, offset, size, onprogress, onend, onreaderror, onwriteerror);
		} else
			launchProcess(new NOOP(), reader, writer, offset, size, crcType, onprogress, onend, onreaderror, onwriteerror);
	}

	// ZipReader

	function decodeASCII(str) {
		var i, out = "", charCode, extendedASCII = ["\u00C7", "\u00FC", "\u00E9", "\u00E2", "\u00E4", "\u00E0", "\u00E5", "\u00E7", "\u00EA", "\u00EB",
			"\u00E8", "\u00EF", "\u00EE", "\u00EC", "\u00C4", "\u00C5", "\u00C9", "\u00E6", "\u00C6", "\u00F4", "\u00F6", "\u00F2", "\u00FB", "\u00F9",
			"\u00FF", "\u00D6", "\u00DC", "\u00F8", "\u00A3", "\u00D8", "\u00D7", "\u0192", "\u00E1", "\u00ED", "\u00F3", "\u00FA", "\u00F1", "\u00D1",
			"\u00AA", "\u00BA", "\u00BF", "\u00AE", "\u00AC", "\u00BD", "\u00BC", "\u00A1", "\u00AB", "\u00BB", "_", "_", "_", "\u00A6", "\u00A6",
			"\u00C1", "\u00C2", "\u00C0", "\u00A9", "\u00A6", "\u00A6", "+", "+", "\u00A2", "\u00A5", "+", "+", "-", "-", "+", "-", "+", "\u00E3",
			"\u00C3", "+", "+", "-", "-", "\u00A6", "-", "+", "\u00A4", "\u00F0", "\u00D0", "\u00CA", "\u00CB", "\u00C8", "i", "\u00CD", "\u00CE",
			"\u00CF", "+", "+", "_", "_", "\u00A6", "\u00CC", "_", "\u00D3", "\u00DF", "\u00D4", "\u00D2", "\u00F5", "\u00D5", "\u00B5", "\u00FE",
			"\u00DE", "\u00DA", "\u00DB", "\u00D9", "\u00FD", "\u00DD", "\u00AF", "\u00B4", "\u00AD", "\u00B1", "_", "\u00BE", "\u00B6", "\u00A7",
			"\u00F7", "\u00B8", "\u00B0", "\u00A8", "\u00B7", "\u00B9", "\u00B3", "\u00B2", "_", " "];
		for (i = 0; i < str.length; i++) {
			charCode = str.charCodeAt(i) & 0xFF;
			if (charCode > 127)
				out += extendedASCII[charCode - 128];
			else
				out += String.fromCharCode(charCode);
		}
		return out;
	}

	function decodeUTF8(string) {
		return decodeURIComponent(escape(string));
	}

	function getString(bytes) {
		var i, str = "";
		for (i = 0; i < bytes.length; i++)
			str += String.fromCharCode(bytes[i]);
		return str;
	}

	function getDate(timeRaw) {
		var date = (timeRaw & 0xffff0000) >> 16, time = timeRaw & 0x0000ffff;
		try {
			return new Date(1980 + ((date & 0xFE00) >> 9), ((date & 0x01E0) >> 5) - 1, date & 0x001F, (time & 0xF800) >> 11, (time & 0x07E0) >> 5,
				(time & 0x001F) * 2, 0);
		} catch (e) {
			// ignored
		}
	}

	function readCommonHeader(entry, data, index, centralDirectory, onerror) {
		entry.version = data.view.getUint16(index, true);
		entry.bitFlag = data.view.getUint16(index + 2, true);
		entry.compressionMethod = data.view.getUint16(index + 4, true);
		entry.lastModDateRaw = data.view.getUint32(index + 6, true);
		entry.lastModDate = getDate(entry.lastModDateRaw);
		if ((entry.bitFlag & 0x01) === 0x01) {
			entry.passwordProtected = true;
			if (entry.extraField)
				entry.compressionMethod = entry.extraField[9] + 256 * (entry.extraField[10]);
		}
		if (centralDirectory || (entry.bitFlag & 0x0008) != 0x0008) {
			entry.crc32 = data.view.getUint32(index + 10, true);
			entry.compressedSize = data.view.getUint32(index + 14, true);
			entry.uncompressedSize = data.view.getUint32(index + 18, true);
		}
		if (entry.compressedSize === 0xFFFFFFFF || entry.uncompressedSize === 0xFFFFFFFF) {
			onerror(ERR_ZIP64);
			return;
		}
		entry.filenameLength = data.view.getUint16(index + 22, true);
		entry.extraFieldLength = data.view.getUint16(index + 24, true);
	}

	function createZipReader(reader, callback, onerror) {
		var inflateSN = 0;

		function Entry() {
		}

		Entry.prototype.getData = function (writer, onend, onprogress, checkCrc32) {
			var that = this;

			function testCrc32(crc32) {
				var dataCrc32 = getDataHelper(4);
				dataCrc32.view.setUint32(0, crc32);
				return that.crc32 == dataCrc32.view.getUint32(0);
			}

			function getWriterData(uncompressedSize, crc32) {
				if (checkCrc32 && !testCrc32(crc32))
					onerror(ERR_CRC);
				else
					writer.getData(function (data) {
						onend(data);
					});
			}

			function onreaderror(err) {
				onerror(err || ERR_READ_DATA);
			}

			function onwriteerror(err) {
				onerror(err || ERR_WRITE_DATA);
			}

			reader.readUint8Array(that.offset, 30, function (bytes) {
				var data = getDataHelper(bytes.length, bytes), dataOffset;
				if (data.view.getUint32(0) != 0x504b0304) {
					onerror(ERR_BAD_FORMAT);
					return;
				}
				readCommonHeader(that, data, 4, false, onerror);
				dataOffset = that.offset + 30 + that.filenameLength + that.extraFieldLength;
				writer.init(function () {
					if (that.passwordProtected)
						if (reader.password && reader.password.length)
							reader.startDecrypt(dataOffset, function () {
								dataOffset += 18;
								processData();
							}, onerror);
						else
							onerror(ERR_ENCRYPTED);
					else {
						processData();
					}

					function processData() {
						if (that.compressionMethod === 0)
							copy(that._worker, inflateSN++, reader, writer, dataOffset, that.compressedSize, checkCrc32, getWriterData, onprogress, onreaderror, onwriteerror);
						else
							inflate(that._worker, inflateSN++, reader, writer, dataOffset, that.compressedSize, checkCrc32, getWriterData, onprogress, onreaderror, onwriteerror);
					}
				}, onwriteerror);
			}, onreaderror);
		};

		function seekEOCDR(eocdrCallback) {
			// "End of central directory record" is the last part of a zip archive, and is at least 22 bytes long.
			// Zip file comment is the last part of EOCDR and has max length of 64KB,
			// so we only have to search the last 64K + 22 bytes of a archive for EOCDR signature (0x06054b50).
			var EOCDR_MIN = 22;
			if (reader.size < EOCDR_MIN) {
				onerror(ERR_BAD_FORMAT);
				return;
			}
			var ZIP_COMMENT_MAX = 256 * 256, EOCDR_MAX = EOCDR_MIN + ZIP_COMMENT_MAX;

			// In most cases, the EOCDR is EOCDR_MIN bytes long
			doSeek(EOCDR_MIN, function () {
				// If not found, try within EOCDR_MAX bytes
				doSeek(Math.min(EOCDR_MAX, reader.size), function () {
					onerror(ERR_BAD_FORMAT);
				});
			});

			// seek last length bytes of file for EOCDR
			function doSeek(length, eocdrNotFoundCallback) {
				reader.readUint8Array(reader.size - length, length, function (bytes) {
					for (var i = bytes.length - EOCDR_MIN; i >= 0; i--) {
						if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
							eocdrCallback(new DataView(bytes.buffer, i, EOCDR_MIN));
							return;
						}
					}
					eocdrNotFoundCallback();
				}, function () {
					onerror(ERR_READ);
				});
			}
		}

		var zipReader = {
			getEntries: function (callback) {
				var worker = this._worker;
				// look for End of central directory record
				seekEOCDR(function (dataView) {
					var datalength, fileslength;
					datalength = dataView.getUint32(16, true);
					fileslength = dataView.getUint16(8, true);
					if (datalength < 0 || datalength >= reader.size) {
						onerror(ERR_BAD_FORMAT);
						return;
					}
					reader.readUint8Array(datalength, reader.size - datalength, function (bytes) {
						var i, index = 0, entries = [], entry, filename, comment, data = getDataHelper(bytes.length, bytes);
						for (i = 0; i < fileslength; i++) {
							entry = new Entry();
							entry._worker = worker;
							if (data.view.getUint32(index) != 0x504b0102) {
								onerror(ERR_BAD_FORMAT);
								return;
							}
							readCommonHeader(entry, data, index + 6, true, onerror);
							entry.commentLength = data.view.getUint16(index + 32, true);
							entry.directory = ((data.view.getUint8(index + 38) & 0x10) == 0x10);
							entry.offset = data.view.getUint32(index + 42, true);
							filename = getString(data.array.subarray(index + 46, index + 46 + entry.filenameLength));
							entry.filename = ((entry.bitFlag & 0x0800) === 0x0800) ? decodeUTF8(filename) : decodeASCII(filename);
							if (!entry.directory && entry.filename.charAt(entry.filename.length - 1) == "/")
								entry.directory = true;
							entry.extraField = data.array.subarray(index + 46 + entry.filenameLength, index + 46 + entry.filenameLength + entry.extraFieldLength);
							comment = getString(data.array.subarray(index + 46 + entry.filenameLength + entry.extraFieldLength, index + 46
								+ entry.filenameLength + entry.extraFieldLength + entry.commentLength));
							entry.comment = ((entry.bitFlag & 0x0800) === 0x0800) ? decodeUTF8(comment) : decodeASCII(comment);
							entries.push(entry);
							index += 46 + entry.filenameLength + entry.extraFieldLength + entry.commentLength;
						}
						callback(entries);
					}, function () {
						onerror(ERR_READ);
					});
				});
			},
			close: function (callback) {
				if (this._worker) {
					this._worker.terminate();
					this._worker = null;
				}
				if (callback)
					callback();
			},
			_worker: null
		};

		if (!obj.zip.useWebWorkers)
			callback(zipReader);
		else {
			createWorker("inflater",
				function (worker) {
					zipReader._worker = worker;
					callback(zipReader);
				},
				function (err) {
					onerror(err);
				}
			);
		}
	}

	// ZipWriter

	function encodeUTF8(string) {
		return unescape(encodeURIComponent(string));
	}

	function getBytes(str) {
		var i, array = [];
		for (i = 0; i < str.length; i++)
			array.push(str.charCodeAt(i));
		return array;
	}

	function createZipWriter(writer, callback, onerror, dontDeflate) {
		var files = {}, filenames = [], datalength = writer.offset;
		var deflateSN = 0;

		function onwriteerror(err) {
			onerror(err || ERR_WRITE);
		}

		function onreaderror(err) {
			onerror(err || ERR_READ_DATA);
		}

		var zipWriter = {
			add: function (name, reader, onend, onprogress, options) {
				var header, filename, date;
				var worker = this._worker;

				function writeHeader(callback) {
					var data, extraFieldLength;
					date = options.lastModDate || new Date();
					header = getDataHelper(26);
					files[name] = {
						headerArray: header.array,
						directory: options.directory,
						filename: filename,
						offset: datalength,
						comment: getBytes(encodeUTF8(options.comment || "")),
						extraField: options.extraField || new Uint8Array([])
					};
					if (writer.password && writer.password.length) {
						header.view.setUint32(0, 0x33000900);
						header.view.setUint8(4, 0x63);
						files[name].extraField = new Uint8Array([0x01, 0x99, 0x07, 0x00, 0x02, 0x00, 0x41, 0x45, 0x03, 0x00, 0x00]);
						if (!dontDeflate && options.level !== 0 && !options.directory)
							files[name].extraField[9] = 0x08;
					}
					else {
						header.view.setUint32(0, 0x14000808);
						if (options.version)
							header.view.setUint8(0, options.version);
						if (!dontDeflate && options.level !== 0 && !options.directory)
							header.view.setUint16(4, 0x0800);
					}
					header.view.setUint16(6, (((date.getHours() << 6) | date.getMinutes()) << 5) | date.getSeconds() / 2, true);
					header.view.setUint16(8, ((((date.getFullYear() - 1980) << 4) | (date.getMonth() + 1)) << 5) | date.getDate(), true);
					header.view.setUint16(22, filename.length, true);
					extraFieldLength = files[name].extraField.length;
					header.view.setUint16(24, extraFieldLength, true);
					data = getDataHelper(30 + filename.length + extraFieldLength);
					data.view.setUint32(0, 0x504b0304);
					data.array.set(header.array, 4);
					data.array.set(filename, 30);
					data.array.set(files[name].extraField, 30 + filename.length);
					datalength += data.array.length;
					writer.writeUint8Array(data.array, callback, onwriteerror);
				}

				function writeFooter(compressedLength, crc32) {
					var footer = getDataHelper(16);
					datalength += compressedLength || 0;
					footer.view.setUint32(0, 0x504b0708);
					if (typeof crc32 != "undefined") {
						header.view.setUint32(10, crc32, true);
						footer.view.setUint32(4, crc32, true);
					}
					if (reader) {
						footer.view.setUint32(8, compressedLength, true);
						header.view.setUint32(14, compressedLength, true);
						footer.view.setUint32(12, reader.size, true);
						header.view.setUint32(18, reader.size, true);
					}
					writer.writeUint8Array(footer.array, function () {
						datalength += 16;
						onend();
					}, onwriteerror);
				}

				function writeFile() {
					options = options || {};
					var computeCrc = writer.password === undefined || !writer.password.length;
					name = name.trim();
					if (options.directory && name.charAt(name.length - 1) != "/")
						name += "/";
					if (files.hasOwnProperty(name)) {
						onerror(ERR_DUPLICATED_NAME);
						return;
					}
					filename = getBytes(encodeUTF8(name));
					filenames.push(name);
					writeHeader(function () {
						if (reader)
							if (dontDeflate || options.level === 0)
								copy(worker, deflateSN++, reader, writer, 0, reader.size, computeCrc, writeFooter, onprogress, onreaderror, onwriteerror);
							else
								deflate(worker, deflateSN++, reader, writer, options.level, computeCrc, writeFooter, onprogress, onreaderror, onwriteerror);
						else
							writeFooter();
					}, onwriteerror);
				}

				if (reader)
					reader.init(writeFile, onreaderror);
				else
					writeFile();
			},
			close: function (callback, commentLength) {
				if (this._worker) {
					this._worker.terminate();
					this._worker = null;
				}

				var data, length = 0, index = 0, indexFilename, file;
				for (indexFilename = 0; indexFilename < filenames.length; indexFilename++) {
					file = files[filenames[indexFilename]];
					length += 46 + file.filename.length + file.comment.length + file.extraField.length;
				}
				data = getDataHelper(length + 22);
				for (indexFilename = 0; indexFilename < filenames.length; indexFilename++) {
					file = files[filenames[indexFilename]];
					data.view.setUint32(index, 0x504b0102);
					data.view.setUint16(index + 4, 0x1400);
					data.array.set(file.headerArray, index + 6);
					data.view.setUint16(index + 32, file.comment.length, true);
					if (file.directory)
						data.view.setUint8(index + 38, 0x10);
					data.view.setUint32(index + 42, file.offset, true);
					data.array.set(file.filename, index + 46);
					data.array.set(file.extraField, index + 46 + file.filename.length);
					data.array.set(file.comment, index + 46 + file.filename.length + file.extraField.length);
					index += 46 + file.filename.length + file.comment.length + file.extraField.length;
				}
				data.view.setUint32(index, 0x504b0506);
				data.view.setUint16(index + 8, filenames.length, true);
				data.view.setUint16(index + 10, filenames.length, true);
				data.view.setUint32(index + 12, length, true);
				data.view.setUint32(index + 16, datalength, true);
				if (commentLength) {
					data.view.setUint16(index + 20, commentLength, true);
				}
				writer.writeUint8Array(data.array, function () {
					writer.getData(callback);
				}, onwriteerror);
			},
			_worker: null
		};

		if (!obj.zip.useWebWorkers)
			callback(zipWriter);
		else {
			createWorker("deflater",
				function (worker) {
					zipWriter._worker = worker;
					callback(zipWriter);
				},
				function (err) {
					onerror(err);
				}
			);
		}
	}

	function resolveURLs(urls) {
		var a = document.createElement("a");
		return urls.map(function (url) {
			a.href = url;
			return a.href;
		});
	}

	var DEFAULT_WORKER_SCRIPTS = {
		deflater: ["z-worker.js", "deflate.js"],
		inflater: ["z-worker.js", "inflate.js"]
	};
	function createWorker(type, callback, onerror) {
		if (obj.zip.workerScripts !== null && obj.zip.workerScriptsPath !== null) {
			onerror(new Error("Either zip.workerScripts or zip.workerScriptsPath may be set, not both."));
			return;
		}
		var scripts;
		if (obj.zip.workerScripts) {
			scripts = obj.zip.workerScripts[type];
			if (!Array.isArray(scripts)) {
				onerror(new Error("zip.workerScripts." + type + " is not an array!"));
				return;
			}
			scripts = resolveURLs(scripts);
		} else {
			scripts = DEFAULT_WORKER_SCRIPTS[type].slice(0);
			scripts[0] = (obj.zip.workerScriptsPath || "") + scripts[0];
		}
		var worker = new Worker(scripts[0]);
		// record total consumed time by inflater/deflater/crc32 in this worker
		worker.codecTime = worker.crcTime = 0;
		worker.postMessage({ type: "importScripts", scripts: scripts.slice(1) });
		worker.addEventListener("message", onmessage);
		function onmessage(ev) {
			var msg = ev.data;
			if (msg.error) {
				worker.terminate(); // should before onerror(), because onerror() may throw.
				onerror(msg.error);
				return;
			}
			if (msg.type === "importScripts") {
				worker.removeEventListener("message", onmessage);
				worker.removeEventListener("error", errorHandler);
				callback(worker);
			}
		}
		// catch entry script loading error and other unhandled errors
		worker.addEventListener("error", errorHandler);
		function errorHandler(err) {
			worker.terminate();
			onerror(err);
		}
	}

	function onerror_default(error) {
		console.error(error);
	}
	obj.zip = {
		Reader: Reader,
		Writer: Writer,
		BlobReader: BlobReader,
		Data64URIReader: Data64URIReader,
		TextReader: TextReader,
		BlobWriter: BlobWriter,
		Data64URIWriter: Data64URIWriter,
		TextWriter: TextWriter,
		createReader: function (reader, callback, onerror) {
			onerror = onerror || onerror_default;

			reader.init(function () {
				createZipReader(reader, callback, onerror);
			}, onerror);
		},
		createWriter: function (writer, callback, onerror, dontDeflate) {
			onerror = onerror || onerror_default;
			dontDeflate = !!dontDeflate;

			createZipWriter(writer, callback, onerror, dontDeflate);
		},
		useWebWorkers: true,
		/**
		 * Directory containing the default worker scripts (z-worker.js, deflate.js, and inflate.js), relative to current base url.
		 * E.g.: zip.workerScripts = './';
		 */
		workerScriptsPath: null,
		/**
		 * Advanced option to control which scripts are loaded in the Web worker. If this option is specified, then workerScriptsPath must not be set.
		 * workerScripts.deflater/workerScripts.inflater should be arrays of urls to scripts for deflater/inflater, respectively.
		 * Scripts in the array are executed in order, and the first one should be z-worker.js, which is used to start the worker.
		 * All urls are relative to current base url.
		 * E.g.:
		 * zip.workerScripts = {
		 *   deflater: ['z-worker.js', 'deflate.js'],
		 *   inflater: ['z-worker.js', 'inflate.js']
		 * };
		 */
		workerScripts: null,
	};

})(this);
