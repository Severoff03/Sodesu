package com.genki.app;

import java.math.BigInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Channel and version rules shared by metadata selection and APK verification. */
final class UpdatePolicy {
    private static final Pattern VERSION = Pattern.compile("^v?((?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*))(\\.(?:0|[1-9][0-9]*))?(-early-access|-beta)?$");

    static String version(String tag) {
        Matcher match = VERSION.matcher(tag == null ? "" : tag);
        return match.matches() ? match.group(1) + (match.group(2) == null ? ".0" : match.group(2)) : null;
    }

    static boolean channel(boolean debug, boolean draft, boolean prerelease, String tag) {
        if (draft || version(tag) == null) return false;
        return !debug && !prerelease && !tag.endsWith("-early-access");
    }

    static boolean asset(boolean debug, String version, String name) {
        return !debug && ("Sodesu-v" + version + ".apk").equals(name);
    }

    static int compare(String a, String b) {
        String x = version(a), y = version(b);
        if (x == null || y == null) throw new IllegalArgumentException("Invalid version");
        String[] left = x.split("\\."), right = y.split("\\.");
        for (int i = 0; i < 3; i++) {
            int result = new BigInteger(left[i]).compareTo(new BigInteger(right[i]));
            if (result != 0) return result;
        }
        return 0;
    }

    static boolean digest(String value) {
        return value != null && value.matches("sha256:[0-9a-fA-F]{64}");
    }

    static boolean newerApk(String expected, String actual, long installedCode, long candidateCode,
                            boolean debug, boolean candidateDebug) {
        return expected.equals(actual) && candidateCode > installedCode && candidateDebug == debug;
    }
}
