package com.genki.app;

/** Run with javac/java; no Android framework or network required. */
public final class UpdatePolicyTest {
    private static void check(boolean condition) { if (!condition) throw new AssertionError(); }
    public static void main(String[] args) {
        check(UpdatePolicy.channel(true, false, true, "v14.2.2-early-access"));
        check(!UpdatePolicy.channel(true, false, false, "v14.2.2"));
        check(!UpdatePolicy.channel(false, false, true, "v14.2.2-early-access"));
        check(UpdatePolicy.channel(false, false, false, "v14.2.2"));
        check(!UpdatePolicy.channel(true, true, true, "v14.2.2-early-access"));
        check(!UpdatePolicy.channel(true, false, false, "v14.2.2-early-access"));
        check(!UpdatePolicy.channel(true, false, true, "v14.2.2-beta"));
        check(!UpdatePolicy.channel(false, false, true, "v14.2.2"));
        check(!UpdatePolicy.channel(false, false, false, "v014.2.2"));
        check(UpdatePolicy.channel(false, false, false, "v0.14-beta"));
        check(!UpdatePolicy.channel(true, false, false, "v0.14-beta"));
        check(!UpdatePolicy.channel(false, false, true, "v0.14-beta"));
        check("0.14.0".equals(UpdatePolicy.version("v0.14-beta")));
        check(UpdatePolicy.compare("v0.14-beta", "v0.13-beta") > 0);
        check(UpdatePolicy.compare("14.10.0", "14.9.9") > 0);
        check(UpdatePolicy.compare("v14.2.2-early-access", "14.2.2") == 0);
        check(UpdatePolicy.compare("14.2.1", "14.2.2") < 0);
        check(UpdatePolicy.asset(true, "14.2.2", "Sodesu-v14.2.2-early-access.apk"));
        check(!UpdatePolicy.asset(true, "14.2.2", "Sodesu-v14.2.2.apk"));
        check(!UpdatePolicy.asset(false, "14.2.2", "Sodesu-v14.2.2-early-access.apk"));
        check(!UpdatePolicy.asset(false, "14.2.2", "other.apk"));
        check(UpdatePolicy.digest("sha256:68e25d94765898b737f6e78d53ec6ed4d120bdce2910554bd59ee3cea4c56bf0"));
        check(!UpdatePolicy.digest("")); check(!UpdatePolicy.digest("sha256:1234"));
        check(UpdatePolicy.newerApk("14.2.2", "14.2.2", 29, 30, true, true));
        check(!UpdatePolicy.newerApk("14.2.2", "14.2.1", 29, 30, true, true));
        check(!UpdatePolicy.newerApk("14.2.2", "14.2.2", 29, 29, true, true));
        check(!UpdatePolicy.newerApk("14.2.2", "14.2.2", 29, 28, true, true));
        check(!UpdatePolicy.newerApk("14.2.2", "14.2.2", 29, 30, true, false));
        check(!UpdatePolicy.newerApk("14.2.2", "14.2.2", 29, 30, false, true));
        System.out.println("PASS: strict channels, prereleases/drafts, semantic versions, APK names, digest and installed-version checks");
    }
}
