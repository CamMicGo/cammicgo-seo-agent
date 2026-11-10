#!/usr/bin/env bash
# Runs LocalAsrDeviceTest on the emulator with the real model and the 5-minute recordings.
set -euo pipefail
PKG=com.cammicgo.kamikoseo
adb install -r -g android-kamiko/app/build/outputs/apk/debug/app-debug.apk
adb install -r android-kamiko/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell getprop ro.build.version.release
adb shell cat /proc/meminfo | head -3
# Copy into the app's private storage through run-as (the app cannot read /data/local/tmp itself).
copy() { # local file, path under files/bench
  adb push "$1" /data/local/tmp/cmg.tmp >/dev/null
  adb shell "run-as $PKG mkdir -p files/bench/$(dirname "$2") && cat /data/local/tmp/cmg.tmp | run-as $PKG sh -c 'cat > files/bench/$2'"
  adb shell rm -f /data/local/tmp/cmg.tmp
}
for f in conv_frontend.onnx encoder.int8.onnx decoder.int8.onnx tokenizer/vocab.json tokenizer/merges.txt tokenizer/tokenizer_config.json; do copy "model/$f" "asr-model/$f"; done
for f in fr.wav en.wav ref-fr.txt ref-en.txt; do copy "audio/$f" "asr-audio/$f"; done
adb shell "run-as $PKG ls -lR files/bench" | head -30
adb shell am instrument -w -r -e class $PKG.LocalAsrDeviceTest $PKG.test/androidx.test.runner.AndroidJUnitRunner | tee instrument.txt
grep -E "ASR_[a-z_]+=" instrument.txt | sed 's/INSTRUMENTATION_STATUS: //' || true
grep -q "^OK (" instrument.txt
