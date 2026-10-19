# Локальные выпуски Sodesu

Версия хранится в `version.properties`. Перед сборкой запишите реальные изменения в локальном `UPDATE.txt`.

- `Build Release.exe -DebugBuild` — локальный debug APK: следующий patch, увеличение versionCode, тесты, lint и проверка подписи. Результат: `build/debug/vX.Y.Z/Sodesu-vX.Y.Z-debug.apk`.
- Debug переносится и устанавливается вручную через Movement. Он не публикуется в GitHub Releases и не проверяет обновления GitHub.
- `Build Release.exe -ValidateOnly -DebugBuild` — проверка окружения без компиляции и изменения файлов.
- `Build Release.exe -Beta` — публичный release APK с пометкой beta. Результат: `releases/vX.Y.Z/`.
- `Public Release.exe` — commit разрешённых исходников, push и публикация последнего публичного выпуска в GitHub Releases. Публикация debug запрещена.
- `Public Release.exe -ReleaseDirectory releases/vX.Y.Z` — повтор публикации после сетевого сбоя без новой сборки.

Сборка требует JDK 17–21 (подходит JBR Android Studio), Gradle 8.7 и Android SDK 34. Для нестандартных путей: `-JavaHome`, `-GradlePath`, `-AndroidSdk`.

Debug использует существующий локальный `.android/debug.keystore`. Обычный выпуск требует постоянный release-keystore через `SODESU_KEYSTORE_FILE`, `SODESU_KEYSTORE_PASSWORD`, `SODESU_KEY_ALIAS`, `SODESU_KEY_PASSWORD` или локальный `android/key.properties`. Ключи и пароли не публикуются.

Для GitHub выполните `gh auth login`. Загрузчик передаёт только release APK и UPDATE.txt; журналы и release.json остаются локально. При ошибке текст изменений сохраняется.

В release-приложении обновления проверяются при запуске и раз в 6 часов, пока оно открыто. Ручная проверка находится в настройках. Принимаются только опубликованные обычные релизы с тегами `vX.Y.Z` или `vX.Y-beta` и APK `Sodesu-vX.Y.Z.apk`. APK проверяется по размеру, SHA-256 GitHub, package name, версии, возрастанию versionCode, признаку release и сертификату подписи. Установку подтверждает пользователь через Android.

Публичная beta: `Build Release.exe -Version 0.14.0 -Beta` создаёт обычный release APK; в приложении отображается `0.14 (beta)`, GitHub-тег — `v0.14-beta`.

Для исправления ошибочной нумерации доступен явный `-AllowVersionReset` вместе с `-Version`; versionCode всё равно увеличивается. Существующие beta, использовавшие локальный debug-сертификат, можно продолжить тем же ключом с `-Beta -SigningReference releases/v0.14.0/Sodesu-v0.14.0.apk`: сборщик сверяет сертификат готового release APK с эталоном, а debuggable остаётся выключен.
