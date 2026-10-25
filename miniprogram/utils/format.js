'use strict';

function two(n) {
  return String(n).padStart(2, '0');
}

function formatTime(ts) {
  const d = new Date(Number(ts) || Date.now());
  return (
    d.getFullYear() +
    '-' +
    two(d.getMonth() + 1) +
    '-' +
    two(d.getDate()) +
    ' ' +
    two(d.getHours()) +
    ':' +
    two(d.getMinutes())
  );
}

function formatClock(ts) {
  const d = new Date(Number(ts) || Date.now());
  return two(d.getHours()) + ':' + two(d.getMinutes());
}

function clip(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function utf8Bytes(text) {
  let bytes = 0;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {
      bytes += 4;
      i++;
    } else if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

module.exports = { formatTime, formatClock, clip, utf8Bytes };
