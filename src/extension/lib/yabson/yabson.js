/* global TextEncoder, TextDecoder, BigInt64Array, BigUint64Array */

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
const TYPE_REFERENCE = 0;
const SPECIAL_TYPES = [TYPE_REFERENCE];
const EMPTY_SLOT_VALUE = Symbol();

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const types = new Array(256);
let typeIndex = 0;

registerType(serializeCircularReference, parseCircularReference, testCircularReference, TYPE_REFERENCE);
registerType(null, parseObject, testObject);
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
registerType(serializeSymbol, parseSymbol, testSymbol);
registerType(null, parseEmptySlot, testEmptySlot);
registerType(serializeMap, parseMap, testMap);
registerType(serializeSet, parseSet, testSet);
registerType(serializeDate, parseDate, testDate);
registerType(serializeError, parseError, testError);
registerType(serializeRegExp, parseRegExp, testRegExp);
registerType(serializeStringObject, parseStringObject, testStringObject);
registerType(serializeNumberObject, parseNumberObject, testNumberObject);
registerType(serializeBooleanObject, parseBooleanObject, testBooleanObject);

export {
	getSerializer,
	getParser,
	registerType,
	clone,
	serialize,
	parse,
	serializeValue,
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
	serializeStringObject,
	serializeNumberObject,
	serializeBooleanObject,
	serializeSymbol,
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
	parseStringObject,
	parseNumberObject,
	parseBooleanObject,
	parseSymbol,
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
	testRegExp,
	testStringObject,
	testNumberObject,
	testBooleanObject,
	testSymbol
};

function registerType(serialize, parse, test, type) {
	if (type === undefined) {
		typeIndex++;
		if (types.length - typeIndex >= SPECIAL_TYPES.length) {
			types[types.length - typeIndex] = { serialize, parse, test };
		} else {
			throw new Error("Reached maximum number of custom types");
		}
	} else {
		types[type] = { serialize, parse, test };
	}
}

function clone(object, options) {
	const serializer = getSerializer(object, options);
	const parser = getParser();
	let result;
	for (const chunk of serializer) {
		result = parser.next(chunk);
	}
	return result.value;
}

function serialize(object, options) {
	const serializer = getSerializer(object, options);
	let result = new Uint8Array([]);
	for (const chunk of serializer) {
		const previousResult = result;
		result = new Uint8Array(previousResult.length + chunk.length);
		result.set(previousResult, 0);
		result.set(chunk, previousResult.length);
	}
	return result;
}

function parse(array) {
	const parser = getParser();
	const result = parser.next(array);
	return result.value;
}

class SerializerData {
	constructor(chunkSize) {
		this.stream = new WriteStream(chunkSize);
		this.objects = [];
	}

	append(array) {
		return this.stream.append(array);
	}

	flush() {
		return this.stream.flush();
	}

	addObject(value) {
		this.objects.push(testReferenceable(value) && !testCircularReference(value, this) ? value : undefined);
	}
}

class WriteStream {
	constructor(chunkSize) {
		this.offset = 0;
		this.value = new Uint8Array(chunkSize);
	}

	*append(array) {
		if (this.offset + array.length > this.value.length) {
			const offset = this.value.length - this.offset;
			yield* this.append(array.subarray(0, offset));
			yield this.value;
			this.offset = 0;
			yield* this.append(array.subarray(offset));
		} else {
			this.value.set(array, this.offset);
			this.offset += array.length;
		}
	}

	*flush() {
		if (this.offset) {
			yield this.value.subarray(0, this.offset);
		}
	}
}

function* getSerializer(value, { chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
	const data = new SerializerData(chunkSize);
	yield* serializeValue(data, value);
	yield* data.flush();
}

function* serializeValue(data, value) {
	const type = types.findIndex(({ test } = {}) => test && test(value, data));
	data.addObject(value);
	yield* data.append(new Uint8Array([type]));
	const serialize = types[type].serialize;
	if (serialize) {
		yield* serialize(data, value);
	}
	if (type != TYPE_REFERENCE && testObject(value)) {
		yield* serializeSymbols(data, value);
		yield* serializeOwnProperties(data, value);
	}
}

function* serializeSymbols(data, value) {
	const ownPropertySymbols = Object.getOwnPropertySymbols(value);
	const symbols = ownPropertySymbols.map(propertySymbol => [propertySymbol, value[propertySymbol]]);
	yield* serializeArray(data, symbols);
}

function* serializeOwnProperties(data, value) {
	let entries = Object.entries(value);
	if (testArray(value)) {
		entries = entries.filter(([key]) => !testInteger(Number(key)));
	}
	yield* serializeEntries(data, entries);
}

function* serializeCircularReference(data, value) {
	const index = data.objects.indexOf(value);
	yield* serializeValue(data, index);
}

function* serializeArray(data, array) {
	yield* serializeValue(data, array.length);
	const notEmptyIndexes = Object.keys(array).filter(key => testInteger(Number(key))).map(key => Number(key));
	for (const [indexArray, value] of array.entries()) {
		yield* serializeValue(data, notEmptyIndexes.includes(indexArray) ? value : EMPTY_SLOT_VALUE);
	}
}

function* serializeEntries(data, entries) {
	yield* serializeValue(data, entries.length);
	for (const [key, value] of entries) {
		yield* serializeString(data, key);
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
	yield* serializeString(data, error.message);
	yield* serializeString(data, error.stack);
}

function* serializeRegExp(data, regExp) {
	yield* serializeString(data, regExp.source);
	yield* serializeString(data, regExp.flags);
}

function* serializeStringObject(data, string) {
	yield* serializeString(data, string.valueOf());
}

function* serializeNumberObject(data, number) {
	yield* serializeNumber(data, number.valueOf());
}

function* serializeBooleanObject(data, boolean) {
	yield* serializeBoolean(data, boolean.valueOf());
}

function* serializeSymbol(data, symbol) {
	yield* serializeString(data, symbol.description);
}

class Reference {
	constructor(index, data) {
		this.index = index;
		this.data = data;
	}

	getObject() {
		return this.data.objects[this.index];
	}
}

class ParserData {
	constructor() {
		this.stream = new ReadStream();
		this.objects = [];
		this.setters = [];
	}

	consume(size) {
		return this.stream.consume(size);
	}

	getObjectId() {
		const objectIndex = this.objects.length;
		this.objects.push(undefined);
		return objectIndex;
	}

	resolveObject(objectId, value) {
		if (testReferenceable(value) && !testReference(value)) {
			this.objects[objectId] = value;
		}
	}

	setObject(functionArguments, setterFunction) {
		this.setters.push({ functionArguments, setterFunction });
	}

	executeSetters() {
		this.setters.forEach(({ functionArguments, setterFunction }) => {
			const resolvedArguments = functionArguments.map(argument => testReference(argument) ? argument.getObject() : argument);
			setterFunction(...resolvedArguments);
		});
	}
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
			if (pending.length + value.length != this.value.length) {
				this.value = new Uint8Array(pending.length + value.length);
			}
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
	const data = new ParserData();
	const result = yield* parseValue(data);
	data.executeSetters();
	return result;
}

function* parseValue(data) {
	const array = yield* data.consume(1);
	const parserType = array[0];
	const parse = types[parserType].parse;
	const valueId = data.getObjectId();
	const result = yield* parse(data);
	if (parserType != TYPE_REFERENCE && testObject(result)) {
		yield* parseSymbols(data, result);
		yield* parseOwnProperties(data, result);
	}
	data.resolveObject(valueId, result);
	return result;
}

function* parseSymbols(data, value) {
	const symbols = yield* parseArray(data);
	data.setObject([symbols], symbols => symbols.forEach(([symbol, propertyValue]) => value[symbol] = propertyValue));
}

function* parseOwnProperties(data, value) {
	yield* parseEntries(data, value);
}

function* parseCircularReference(data) {
	const index = yield* parseValue(data);
	const result = new Reference(index, data);
	return result;
}

// eslint-disable-next-line require-yield
function* parseObject() {
	return {};
}

function* parseArray(data) {
	const length = yield* parseValue(data);
	const array = [];
	for (let indexArray = 0; indexArray < length; indexArray++) {
		const value = yield* parseValue(data);
		if (!testEmptySlot(value)) {
			data.setObject([value], value => array[indexArray] = value);
		}
	}
	return array;
}

function* parseEntries(data, object) {
	const size = yield* parseValue(data);
	for (let indexKey = 0; indexKey < size; indexKey++) {
		const key = yield* parseString(data);
		const value = yield* parseValue(data);
		data.setObject([value], value => object[key] = value);
	}
}

// eslint-disable-next-line require-yield
function* parseEmptySlot() {
	return EMPTY_SLOT_VALUE;
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
		data.setObject([key, value], (key, value) => map.set(key, value));
	}
	return map;
}

function* parseSet(data) {
	const size = yield* parseValue(data);
	const set = new Set();
	for (let indexKey = 0; indexKey < size; indexKey++) {
		const value = yield* parseValue(data);
		data.setObject([value], value => set.add(value));
	}
	return set;
}

function* parseDate(data) {
	const milliseconds = yield* parseNumber(data);
	return new Date(milliseconds);
}

function* parseError(data) {
	const message = yield* parseString(data);
	const stack = yield* parseString(data);
	const error = new Error(message);
	error.stack = stack;
	return error;
}

function* parseRegExp(data) {
	const source = yield* parseString(data);
	const flags = yield* parseString(data);
	return new RegExp(source, flags);
}

function* parseStringObject(data) {
	return new String(yield* parseString(data));
}

function* parseNumberObject(data) {
	return new Number(yield* parseNumber(data));
}

function* parseBooleanObject(data) {
	return new Boolean(yield* parseBoolean(data));
}

function* parseSymbol(data) {
	const description = yield* parseString(data);
	return Symbol(description);
}

function testCircularReference(value, data) {
	return testObject(value) && data.objects.includes(value);
}

function testReference(value) {
	return value instanceof Reference;
}

function testObject(value) {
	return value === Object(value);
}

function testArray(value) {
	return typeof value.length == "number";
}

function testEmptySlot(value) {
	return value === EMPTY_SLOT_VALUE;
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
	return testNumber(value) && Number.isInteger(value);
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

function testStringObject(value) {
	return value instanceof String;
}

function testNumberObject(value) {
	return value instanceof Number;
}

function testBooleanObject(value) {
	return value instanceof Boolean;
}

function testSymbol(value) {
	return typeof value == "symbol";
}

function testReferenceable(value) {
	return testObject(value) || testSymbol(value);
}