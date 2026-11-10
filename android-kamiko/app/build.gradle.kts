plugins { id("com.android.application") }

// Test builds are signed with one fixed key so new APKs install over older ones.
// Before a public release, set CMG_KEYSTORE_FILE / CMG_KEYSTORE_PASSWORD / CMG_KEY_ALIAS / CMG_KEY_PASSWORD
// (GitHub Actions secrets) to sign with a private key instead of this committed test key.
val keystoreFile = System.getenv("CMG_KEYSTORE_FILE")?.let { file(it) } ?: rootProject.file("signing/cammicgo-test.jks")

android {
  namespace = "com.cammicgo.kamikoseo"
  compileSdk = 35
  defaultConfig {
    applicationId = "com.cammicgo.kamikoseo"; minSdk = 26; targetSdk = 35; versionCode = 57; versionName = "0.7.2-models"
    // sherpa-onnx native libraries: phones (64 and 32 bit ARM) and the x86_64 emulator.
    ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }
  // Compressed native libraries: a smaller APK to download (unpacked once at install).
  packaging { jniLibs { useLegacyPackaging = true } }
  compileOptions { isCoreLibraryDesugaringEnabled = true; sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
  signingConfigs {
    create("cammicgo") {
      storeFile = keystoreFile
      storePassword = System.getenv("CMG_KEYSTORE_PASSWORD") ?: "cammicgo-test"
      keyAlias = System.getenv("CMG_KEY_ALIAS") ?: "cammicgo-test"
      keyPassword = System.getenv("CMG_KEY_PASSWORD") ?: "cammicgo-test"
    }
  }
  buildTypes { getByName("debug") { signingConfig = signingConfigs.getByName("cammicgo") } }
}

dependencies {
  implementation("androidx.core:core:1.13.1")
  implementation("com.github.TeamNewPipe:NewPipeExtractor:v0.27.1")
  coreLibraryDesugaring("com.android.tools:desugar_jdk_libs_nio:2.1.5")
  // On-device speech recognition (Whisper small through sherpa-onnx, Apache-2.0) for videos without captions.
  implementation("com.github.k2-fsa.sherpa-onnx:sherpa-onnx:v2.0.1")
  implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.24")
  // bzip2 + tar, to unpack the model archive while it downloads.
  implementation("org.apache.commons:commons-compress:1.24.0")
  testImplementation("junit:junit:4.13.2")
  androidTestImplementation("androidx.test:runner:1.6.2")
  androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
