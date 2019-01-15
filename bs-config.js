module.exports = {
  "callbacks": {
    ready: function(err, bs) {
      bs.utils.serveStatic.mime.define({ 'application/wasm': ['wasm'] });
    }
  }
};
