// Installed app metadata comes from version.properties through Android resources.
// A browser-only preview has no installed application version.
(function () {
  const native = window.Android;
  const name = native && native.getAppVersionName ? native.getAppVersionName() : 'dev';
  const code = native && native.getAppVersionCode ? Number(native.getAppVersionCode()) : 0;
  window.SODESU_VERSION = Object.freeze({ code, name, label: name });
})();
