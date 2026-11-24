/* Makes the timer open without a network, after one visit with one.            */
/*                                                                              */
/* Network first, so a deploy shows up on the next load with no version number  */
/* to bump; the cache is only for when the network fails or takes too long.     */
/* Installing caches every file or none, so there is always a complete set.     */
/* tests/offline.spec.mjs checks FILES against what index.html loads.           */
/*                                                                              */
/* Service workers arrived in iOS 11.3. Older ones just load from the network.  */
'use strict';

var CACHE = 'reveal-timer';
var SLOW_MS = 4000;   /* on a connection that hangs, stop waiting after this */
var FILES = [
  './',
  'style.css',
  'art/helpers.js',
  'art/patterns.js',
  'art/openmoji.js',
  'art/animals.js',
  'art/food.js',
  'art/words.js',
  'art/tiles.js',
  'catalog.js',
  'storage.js',
  'collection.js',
  'reveals.js',
  'celebrations.js',
  'audio.js',
  'wakelock.js',
  'dom.js',
  'sheet.js',
  'app.js'
];
var URLS = FILES.map(function(f) { return new URL(f, self.registration.scope).href; });

self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE).then(function(cache) {
    /* 'reload' so that a stale HTTP cache can't supply half of the set. */
    return cache.addAll(URLS.map(function(url) { return new Request(url, {cache: 'reload'}); }));
  }).then(function() { return self.skipWaiting(); }));
});

/* Drop cached files that are no longer part of the app. */
self.addEventListener('activate', function(event) {
  event.waitUntil(caches.open(CACHE).then(function(cache) {
    return cache.keys().then(function(requests) {
      return Promise.all(requests.map(function(r) {
        return URLS.indexOf(r.url) < 0 ? cache.delete(r) : null;
      }));
    });
  }).then(function() { return self.clients.claim(); }));
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url.split(/[?#]/)[0].replace(/\/index\.html$/, '/');
  if (event.request.method !== 'GET' || URLS.indexOf(url) < 0) return;

  var fromNetwork = fetch(event.request).then(function(response) {
    /* A redirect is the browser's to follow, and can't be replayed from a cache. */
    if (response.redirected || response.type === 'opaqueredirect') return response;
    if (!response.ok) throw new Error('HTTP ' + response.status);
    var copy = response.clone();
    return caches.open(CACHE)
      .then(function(cache) { return cache.put(url, copy); })
      .then(function() { return response; }, function() { return response; });
  });
  var fromCache = function() {
    return caches.open(CACHE).then(function(cache) { return cache.match(url); });
  };
  var slow = new Promise(function(resolve) { setTimeout(resolve, SLOW_MS); }).then(fromCache);

  event.waitUntil(fromNetwork.catch(function() {}));
  event.respondWith(
    Promise.race([fromNetwork, slow.then(function(hit) { return hit || fromNetwork; })])
      .catch(function(error) {
        return fromCache().then(function(hit) { if (hit) return hit; throw error; });
      })
  );
});
