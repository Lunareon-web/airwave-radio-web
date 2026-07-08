// Web Worker timer — runs in its own thread so Chrome's background-tab
// throttling (which clamps main-thread setInterval to ≥1 s) doesn't affect it.
var intervalId = null;
self.onmessage = function (e) {
  if (e.data === 'start') {
    clearInterval(intervalId);
    intervalId = setInterval(function () { self.postMessage('tick'); }, 500);
  } else if (e.data === 'stop') {
    clearInterval(intervalId);
    intervalId = null;
  }
};
