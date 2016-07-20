(function(exports, moment) {
	"use strict";

	exports.stringify = function stringify(v) {
		function encode(s) {
			return !/[^\w-.]/.test(s) ? s : s.replace(/[^\w-.]/g, function(ch) {
				if (ch === '$') return '!';
				ch = ch.charCodeAt(0);
				// thanks to Douglas Crockford for the negative slice trick
				return ch < 0x100 ? '*' + ('00' + ch.toString(16)).slice(-2) : '**' + ('0000' + ch.toString(16)).slice(-4);
			});
		}

		switch (typeof v) {
			case 'number':
				return isFinite(v) ? '~' + v : '~null';
			case 'boolean':
				return '~' + v;
			case 'string':
				return "~'" + encode(v);
			case 'object':
				if (!v) return '~null';
				if (Array.isArray(v)) {
					return '~(' + (v.map(function(elt) {
							return stringify(elt) || '~null';
						}).join('') || '~') + ')';
				} else if(moment.isMoment(v)) {
					return '~*' + v.format();
				} else {
					return '~(' + Object.keys(v).map(function(key) {
							var val = stringify(v[key]);
							// skip undefined and functions
							return val && (encode(key) + val);
						}).filter(function(str) {
							return str;
						}).join('~') + ')';
				}
			default:
				// function, undefined
				return;
		}
	};

	var reserved = {
		true: true,
		false: false,
		null: null
	};

	exports.parse = function(s) {
		if (!s) return s;
		var i = 0,
			len = s.length;

		function eat(expected) {
			if (s[i] !== expected) throw new Error("bad JSURL syntax: expected " + expected + ", got " + (s && s[i]));
			i++;
		}

		function decode() {
			var beg = i,
				ch, r = "";
			while (i < len && (ch = s[i]) !== '~' && ch !== ')') {
				switch (ch) {
					case '*':
						if (beg < i) r += s.substring(beg, i);
						if (s[i + 1] === '*') r += String.fromCharCode(parseInt(s.substring(i + 2, i + 6), 16)), beg = (i += 6);
						else r += String.fromCharCode(parseInt(s.substring(i + 1, i + 3), 16)), beg = (i += 3);
						break;
					case '!':
						if (beg < i) r += s.substring(beg, i);
						r += '$', beg = ++i;
						break;
					default:
						i++;
				}
			}
			return r + s.substring(beg, i);
		}

		return (function parseOne() {
			var result, ch, beg;
			eat('~');
			switch (ch = s[i]) {
				case '(':
					i++;
					if (s[i] === '~') {
						result = [];
						if (s[i + 1] === ')') i++;
						else {
							do {
								result.push(parseOne());
							} while (s[i] === '~');
						}
					} else {
						result = {};
						if (s[i] !== ')') {
							do {
								var key = decode();
								result[key] = parseOne();
							} while (s[i] === '~' && ++i);
						}
					}
					eat(')');
					break;
				case "'":
					i++;
					result = decode();
					break;
				case "*":
					beg = ++i;
					while (i < len && /[^)~]/.test(s[i]))
						i++;
					var subs = s.substring(beg, i);
					result = moment(subs);
					break;
				default:
					beg = i++;
					while (i < len && /[^)~]/.test(s[i]))
						i++;
					var sub = s.substring(beg, i);
					if (/[\d\-]/.test(ch)) {
						result = parseFloat(sub);
					} else {
						result = reserved[sub];
						if (typeof result === "undefined") throw new Error("bad value keyword: " + sub);
					}
			}
			return result;
		})();
	}
})(typeof exports !== 'undefined' ? exports : (window.JSURL = window.JSURL || {}), typeof require !== 'undefined' ? require('moment') : window.moment);