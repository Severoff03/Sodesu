import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

assert.ok(existsSync('ios/Sodesu.xcodeproj/project.pbxproj'), 'Xcode project must exist');
assert.ok(existsSync('ios/Sodesu.xcodeproj/xcshareddata/xcschemes/Sodesu.xcscheme'), 'Sodesu shared scheme must exist');
assert.ok(existsSync('ios/Sodesu/AppDelegate.swift'), 'AppDelegate.swift must exist');
assert.ok(existsSync('ios/Sodesu/SceneDelegate.swift'), 'SceneDelegate.swift must exist');
assert.ok(existsSync('ios/Sodesu/ViewController.swift'), 'ViewController.swift must exist');
assert.ok(existsSync('ios/Sodesu/Info.plist'), 'Info.plist must exist');

const project = read('ios/Sodesu.xcodeproj/project.pbxproj');
assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = com\.genki\.sodesu;/, 'bundle id must be com.genki.sodesu');
assert.match(project, /\bwww\b/, 'Xcode project must bundle the shared www folder');
assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET = 15\.0;/, 'iOS deployment target must be 15.0');

const app = read('www/js/app.js');
assert.match(app, /window\.webkit\.messageHandlers\.sodesu\.postMessage/, 'app.js must notify the iOS bridge');
assert.match(app, /window\.Android\.setActive/, 'app.js must keep the Android bridge fallback');

const viewController = read('ios/Sodesu/ViewController.swift');
assert.match(viewController, /WKScriptMessageHandler/, 'ViewController must handle WKWebView script messages');
assert.match(viewController, /add\(self, name: "sodesu"\)/, 'WKWebView must register the sodesu script handler');
assert.match(viewController, /loadFileURL/, 'WKWebView must load bundled www/index.html');

const appDelegate = read('ios/Sodesu/AppDelegate.swift');
assert.match(appDelegate, /UNUserNotificationCenter/, 'AppDelegate must configure local notifications');
assert.match(appDelegate, /markActive/, 'Native app must track last open time');
assert.match(appDelegate, /scheduleDailyNotifications/, 'Native app must schedule daily notifications');

console.log('iOS port contract checks passed');
