/* global TextEncoder, TextDecoder, BigInt64Array, BigUint64Array */

const MAX_CHUNK_SIZE = 8 * 1024 * 1024;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const types = new Array(256);
let typeIndex = 0;

registerType(serializeObject, parseObject, testObject);
registerType(serializeArray, parseArray, testArray);
registerType(serializeString, parseString, testString);
registerType(serializeTypedArray, parseBigUint64Array, testBigUint64Array);
registerType(serializeTypedArray, parseBigInt64Array, testBigInt64Array);
registerType(serializeTypedArray, parseFloat64Array, testFloat64Array);
registerType(serializeTypedArray, parseFloat32Array, testFloat32Array);
registerType(serializeTypedArray, parseUint32Array, testUint32Array);
registerType(serializeTypedArray, parseInt32Array, testInt32Array);
registerType(serializeTypedArray, parseUint16Array, testUint16Array);
registerType(serializeTypedArray, parseInt16Array, testInt16Array);
registerType(serializeTypedArray, parseUint8ClampedArray, testUint8ClampedArray);
registerType(serializeTypedArray, parseUint8Array, testUint8Array);
registerType(serializeTypedArray, parseInt8Array, testInt8Array);
registerType(serializeNumber, parseNumber, testNumber);
registerType(serializeBigInt, parseBigInt, testBigInt);
registerType(serializeUint32, parseUint32, testUint32);
registerType(serializeInt32, parseInt32, testInt32);
registerType(serializeUint16, parseUint16, testUint16);
registerType(serializeInt16, parseInt16, testInt16);
registerType(serializeUint8, parseUint8, testUint8);
registerType(serializeInt8, parseInt8, testInt8);
registerType(null, parseUndefined, testUndefined);
registerType(null, parseNull, testNull);
registerType(null, parseNaN, testNaN);
registerType(serializeBoolean, parseBoolean, testBoolean);
registerType(serializeMap, parseMap, testMap);
registerType(serializeSet, parseSet, testSet);
registerType(serializeDate, parseDate, testDate);
registerType(serializeError, parseError, testError);
registerType(serializeRegExp, parseRegExp, testRegExp);

export {
	getSerializer,
	getParser,
	registerType,
	serializeValue,
	serializeObject,
	serializeArray,
	serializeString,
	serializeTypedArray,
	serializeNumber,
	serializeBigInt,
	serializeUint32,
	serializeInt32,
	serializeUint16,
	serializeInt16,
	serializeUint8,
	serializeInt8,
	serializeBoolean,
	serializeMap,
	serializeSet,
	serializeDate,
	serializeError,
	serializeRegExp,
	parseValue,
	parseObject,
	parseArray,
	parseString,
	parseBigUint64Array,
	parseBigInt64Array,
	parseFloat64Array,
	parseFloat32Array,
	parseUint32Array,
	parseInt32Array,
	parseUint16Array,
	parseInt16Array,
	parseUint8ClampedArray,
	parseUint8Array,
	parseInt8Array,
	parseNumber,
	parseBigInt,
	parseUint32,
	parseInt32,
	parseUint16,
	parseInt16,
	parseUint8,
	parseInt8,
	parseUndefined,
	parseNull,
	parseNaN,
	parseBoolean,
	parseMap,
	parseSet,
	parseDate,
	parseError,
	parseRegExp,
	testObject,
	testArray,
	testString,
	testBigUint64Array,
	testBigInt64Array,
	testFloat64Array,
	testFloat32Array,
	testUint32Array,
	testInt32Array,
	testUint16Array,
	testInt16Array,
	testUint8ClampedArray,
	testUint8Array,
	testInt8Array,
	testNumber,
	testBigInt,
	testUint32,
	testInt32,
	testUint16,
	testInt16,
	testUint8,
	testInt8,
	testInteger,
	testUndefined,
	testNull,
	testNaN,
	testBoolean,
	testMap,
	testSet,
	testDate,
	testError,
	testRegExp
};

function registerType(serialize, parse, test) {
	typeIndex++;
	types[types.length - typeIndex] = { serialize, parse, test };
}

class WriteStream {
	constructor(chunkSize) {
		this.offset = 0;
		this.value = new Uint8Array(chunkSize);
	}

	*append(array) {
		if (this.pending) {
			const pending = this.pending;
			this.pending = null;
			this.offset = 0;
			this.value = new Uint8Array(this.value.length);
			yield* this.append(pending);
			yield* this.append(array);
		} else if (this.offset + array.length > this.value.length) {
			this.value.set(array.subarray(0, this.value.length - this.offset), this.offset);
			this.pending = array.subarray(this.value.length - this.offset);
			yield this.value;
		} else {
			this.value.set(array, this.offset);
			this.offset += array.length;
		}
	}
}

function* getSerializer(value, { chunkSize = MAX_CHUNK_SIZE } = {}) {
	const data = new WriteStream(chunkSize);
	yield* serializeValue(data, value);
	if (data.pending) {
		yield* data.append(new Uint8Array([]));
	}
	if (data.offset) {
		yield data.value.subarray(0, data.offset);
	}
}

function* serializeValue(data, value) {
	const type = types.findIndex(({ test } = {}) => test && test(value));
	yield* data.append(new Uint8Array([type]));
	const serialize = types[type].serialize;
	if (serialize) {
		yield* serialize(data, value);
	}
}

function* serializeObject(data, object) {
	const entries = Object.entries(object);
	yield* serializeValue(data, entries.length);
	for (const [key, value] of entries) {
		yield* serializeString(data, key);
		yield* serializeValue(data, value);
	}
}

function* serializeArray(data, array) {
	yield* serializeValue(data, array.length);
	for (const value of array) {
		yield* serializeValue(data, value);
	}
}

function* serializeString(data, string) {
	const encodedString = textEncoder.encode(string);
	yield* serializeValue(data, encodedString.length);
	yield* data.append(encodedString);
}

function* serializeTypedArray(data, array) {
	yield* serializeValue(data, array.length);
	yield* data.append(new Uint8Array(array.buffer));
}

function* serializeNumber(data, number) {
	const serializedNumber = new Uint8Array(new Float64Array([number]).buffer);
	yield* data.append(serializedNumber);
}

function* serializeBigInt(data, number) {
	const serializedNumber = new Uint8Array(new BigInt64Array([number]).buffer);
	yield* data.append(serializedNumber);
}

function* serializeUint32(data, number) {
	const serializedNumber = new Uint8Array(new Uint32Array([number]).buffer);
	yield* data.append(serializedNumber);
}

function* serializeInt32(data, number) {
	const serializedNumber = new Uint8Array(new Int32Array([number]).buffer);
	yield* data.append(serializedNumber);
}

function* serializeUint16(data, number) {
	const serializedNumber = new Uint8Array(new Uint16Array([number]).buffer);
	yield* data.append(serializedNumber);
}

function* serializeInt16(data, number) {
	const serializedNumber = new Uint8Array(new Int16Array([number]).buffer);
	yield* data.append(serializedNumber);
}

function* serializeUint8(data, number) {
	const serializedNumber = new Uint8Array([number]);
	yield* data.append(serializedNumber);
}

function* serializeInt8(data, number) {
	const serializedNumber = new Uint8Array(new Int8Array([number]).buffer);
	yield* data.append(serializedNumber);
}

function* serializeBoolean(data, boolean) {
	const serializedBoolean = new Uint8Array([Number(boolean)]);
	yield* data.append(serializedBoolean);
}

function* serializeMap(data, map) {
	const entries = map.entries();
	yield* serializeValue(data, map.size);
	for (const [key, value] of entries) {
		yield* serializeValue(data, key);
		yield* serializeValue(data, value);
	}
}

function* serializeSet(data, set) {
	yield* serializeValue(data, set.size);
	for (const value of set) {
		yield* serializeValue(data, value);
	}
}

function* serializeDate(data, date) {
	yield* serializeNumber(data, date.getTime());
}

function* serializeError(data, error) {
	yield* serializeString(data, error.name);
	yield* serializeString(data, error.message);
	yield* serializeString(data, error.stack);
}

function* serializeRegExp(data, regExp) {
	yield* serializeString(data, regExp.source);
	yield* serializeString(data, regExp.flags);
}

class ReadStream {
	constructor() {
		this.offset = 0;
		this.value = new Uint8Array(0);
	}

	*consume(size) {
		if (this.offset + size > this.value.length) {
			const pending = this.value.subarray(this.offset, this.value.length);
			const value = yield;
			this.value = new Uint8Array(pending.length + value.length);
			this.value.set(pending);
			this.value.set(value, pending.length);
			this.offset = 0;
			return yield* this.consume(size);
		} else {
			const result = this.value.slice(this.offset, this.offset + size);
			this.offset += result.length;
			return result;
		}
	}
}

function getParser() {
	const parser = getParseGenerator();
	parser.next();
	return parser;
}

function* getParseGenerator() {
	return yield* parseValue(new ReadStream());
}

function* parseValue(data) {
	const array = yield* data.consume(1);
	const parserType = array[0];
	const parse = types[parserType].parse;
	const result = yield* parse(data);
	return result;
}

function* parseObject(data) {
	const size = yield* parseValue(data);
	const object = {};
	for (let indexKey = 0; indexKey < size; indexKey++) {
		const key = yield* parseString(data);
		const value = yield* parseValue(data);
		object[key] = value;
	}
	return object;
}

function* parseArray(data) {
	const length = yield* parseValue(data);
	const array = [];
	for (let indexArray = 0; indexArray < length; indexArray++) {
		array.push(yield* parseValue(data));
	}
	return array;
}

function* parseString(data) {
	const size = yield* parseValue(data);
	const array = yield* data.consume(size);
	return textDecoder.decode(array);
}

function* parseBigUint64Array(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length * 8);
	return new BigUint64Array(array.buffer);
}

function* parseBigInt64Array(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length * 8);
	return new BigInt64Array(array.buffer);
}

function* parseFloat64Array(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length * 8);
	return new Float64Array(array.buffer);
}

function* parseFloat32Array(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length * 4);
	return new Float32Array(array.buffer);
}

function* parseUint32Array(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length * 4);
	return new Uint32Array(array.buffer);
}

function* parseInt32Array(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length * 4);
	return new Int32Array(array.buffer);
}

function* parseUint16Array(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length * 2);
	return new Uint16Array(array.buffer);
}

function* parseInt16Array(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length * 2);
	return new Int16Array(array.buffer);
}

function* parseUint8ClampedArray(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length);
	return new Uint8ClampedArray(array.buffer);
}

function* parseUint8Array(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length);
	return array;
}

function* parseInt8Array(data) {
	const length = yield* parseValue(data);
	const array = yield* data.consume(length);
	return new Int8Array(array.buffer);
}

function* parseNumber(data) {
	const array = yield* data.consume(8);
	return new Float64Array(array.buffer)[0];
}

function* parseBigInt(data) {
	const array = yield* data.consume(8);
	return new BigInt64Array(array.buffer)[0];
}

function* parseUint32(data) {
	const array = yield* data.consume(4);
	return new Uint32Array(array.buffer)[0];
}

function* parseInt32(data) {
	const array = yield* data.consume(4);
	return new Int32Array(array.buffer)[0];
}

function* parseUint16(data) {
	const array = yield* data.consume(2);
	return new Uint16Array(array.buffer)[0];
}

function* parseInt16(data) {
	const array = yield* data.consume(2);
	return new Int16Array(array.buffer)[0];
}

function* parseUint8(data) {
	const array = yield* data.consume(1);
	return new Uint8Array(array.buffer)[0];
}

function* parseInt8(data) {
	const array = yield* data.consume(1);
	return new Int8Array(array.buffer)[0];
}

// eslint-disable-next-line require-yield
function* parseUndefined() {
	return undefined;
}

// eslint-disable-next-line require-yield
function* parseNull() {
	return null;
}

// eslint-disable-next-line require-yield
function* parseNaN() {
	return NaN;
}

function* parseBoolean(data) {
	const array = yield* data.consume(1);
	return Boolean(array[0]);
}

function* parseMap(data) {
	const size = yield* parseValue(data);
	const map = new Map();
	for (let indexKey = 0; indexKey < size; indexKey++) {
		const key = yield* parseValue(data);
		const value = yield* parseValue(data);
		map.set(key, value);
	}
	return map;
}

function* parseSet(data) {
	const size = yield* parseValue(data);
	const set = new Set();
	for (let indexKey = 0; indexKey < size; indexKey++) {
		const value = yield* parseValue(data);
		set.add(value);
	}
	return set;
}

function* parseDate(data) {
	const milliseconds = yield* parseNumber(data);
	return new Date(milliseconds);
}

function* parseError(data) {
	const name = yield* parseString(data);
	const message = yield* parseString(data);
	const stack = yield* parseString(data);
	const error = new Error(message);
	error.name = name;
	error.stack = stack;
	return error;
}

function* parseRegExp(data) {
	const source = yield* parseString(data);
	const flags = yield* parseString(data);
	return new RegExp(source, flags);
}

function testObject(value) {
	return value === Object(value);
}

function testArray(value) {
	return typeof value.length == "number";
}

function testString(value) {
	return typeof value == "string";
}

function testBigUint64Array(value) {
	return value instanceof BigUint64Array;
}

function testBigInt64Array(value) {
	return value instanceof BigInt64Array;
}

function testFloat64Array(value) {
	return value instanceof Float64Array;
}

function testUint32Array(value) {
	return value instanceof Uint32Array;
}

function testInt32Array(value) {
	return value instanceof Int32Array;
}

function testUint16Array(value) {
	return value instanceof Uint16Array;
}

function testFloat32Array(value) {
	return value instanceof Float32Array;
}

function testInt16Array(value) {
	return value instanceof Int16Array;
}

function testUint8ClampedArray(value) {
	return value instanceof Uint8ClampedArray;
}

function testUint8Array(value) {
	return value instanceof Uint8Array;
}

function testInt8Array(value) {
	return value instanceof Int8Array;
}

function testNumber(value) {
	return typeof value == "number";
}
function testBigInt(value) {
	return typeof value == "bigint";
}

function testUint32(value) {
	return testInteger(value) && value >= 0 && value <= 4294967295;
}

function testInt32(value) {
	return testInteger(value) && value >= -2147483648 && value <= 2147483647;
}

function testUint16(value) {
	return testInteger(value) && value >= 0 && value <= 65535;
}

function testInt16(value) {
	return testInteger(value) && value >= -32768 && value <= 32767;
}

function testUint8(value) {
	return testInteger(value) && value >= 0 && value <= 255;
}

function testInt8(value) {
	return testInteger(value) && value >= -128 && value <= 127;
}

function testInteger(value) {
	return testNumber(value) && value == Number.parseInt(value, 10);
}

function testUndefined(value) {
	return value === undefined;
}

function testNull(value) {
	return value === null;
}

function testNaN(value) {
	return Number.isNaN(value);
}

function testBoolean(value) {
	return typeof value == "boolean";
}

function testMap(value) {
	return value instanceof Map;
}

function testSet(value) {
	return value instanceof Set;
}

function testDate(value) {
	return value instanceof Date;
}

function testError(value) {
	return value instanceof Error;
}

function testRegExp(value) {
	return value instanceof RegExp;
}