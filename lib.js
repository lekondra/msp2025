// Общие функции дашборда: чтение CSV (UTF-8 или Windows-1251, запятая или точка с запятой),
// приведение чисел и дат к единому виду, маскирование номеров заявлений.
(function (root) {
  'use strict';

  function decode(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { return new TextDecoder('windows-1251').decode(buf); }
  }

  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    var firstLine = text.split(/\r?\n/, 1)[0];
    var sep = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, j) { o[h] = (r[j] === undefined ? '' : r[j]).replace(/\r\n/g, '\n'); });
      return o;
    });
  }

  var NUM_COLS = ['amount', 'fixed', 'left', 'applications', 'granted', 'granted_checked', 'granted_pct', 'refusals', 'refusals_checked', 'refusals_pct'];
  function normalize(rows) {
    return rows.map(function (r) {
      var o = {};
      for (var k in r) {
        var v = String(r[k]).trim();
        if (NUM_COLS.indexOf(k) >= 0) v = v.replace(/[\s  ]/g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
        if (k === 'deadline') { var m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/); if (m) v = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
        if (k === 'msp' || k === 'ousr' || k === 'row') v = v.replace(/\.0+$/, '');
        o[k] = v;
      }
      return o;
    });
  }

  function maskId(tok) {
    var i = tok.indexOf('_');
    var head = i >= 0 ? tok.slice(0, i) : tok.slice(0, 3);
    return head + '_…' + tok.slice(-4);
  }
  function maskText(s) { return String(s).replace(/Z[0-9A-Za-z]*_[0-9A-Za-z_\-]+/g, maskId); }
  function maskRows(rows) {
    return rows.map(function (r) {
      var o = {};
      for (var k in r) {
        var v = maskText(r[k]);
        if (k === 'app') v = v.replace(/(^|[\s])(\d{6,})(?=\s|$)/g, function (m, p, d) { return p + '…' + d.slice(-4); });
        o[k] = v;
      }
      return o;
    });
  }

  function toCSV(rows, cols) {
    var esc = function (v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cols.join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return esc(r[c]); }).join(','); })).join('\r\n') + '\r\n';
  }

  var TABLES = {
    violations: ['item', 'msp', 'ousr', 'app', 'kind', 'type', 'amount', 'fixed', 'left', 'status', 'who', 'npa', 'summary', 'plan'],
    sample: ['msp', 'name', 'applications', 'granted', 'granted_checked', 'granted_pct', 'refusals', 'refusals_checked', 'refusals_pct'],
    plan: ['row', 'item', 'recommendation', 'action', 'deadline', 'responsible'],
  };
  function detectTable(rows) {
    if (!rows.length) return null;
    var keys = Object.keys(rows[0]);
    if (keys.indexOf('app') >= 0) return 'violations';
    if (keys.indexOf('responsible') >= 0) return 'plan';
    if (keys.indexOf('granted_checked') >= 0) return 'sample';
    return null;
  }
  function missingCols(name, rows) {
    var keys = rows.length ? Object.keys(rows[0]) : [];
    return TABLES[name].filter(function (c) { return keys.indexOf(c) < 0; });
  }

  root.AuLib = { decode: decode, parseCSV: parseCSV, normalize: normalize, maskText: maskText, maskRows: maskRows, toCSV: toCSV, TABLES: TABLES, detectTable: detectTable, missingCols: missingCols };
  if (typeof module !== 'undefined') module.exports = root.AuLib;
})(typeof window !== 'undefined' ? window : globalThis);
