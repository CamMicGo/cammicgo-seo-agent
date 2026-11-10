// Runs the app's NewPipe audio resolver on a plain JVM (CI), to see what YouTube answers.
plugins { application; java }
java { toolchain { languageVersion.set(JavaLanguageVersion.of(17)) } }
sourceSets { main { java { srcDir("../../android-kamiko/app/src/main/java"); include("com/cammicgo/kamikoseo/NewPipeAudioResolver.java", "com/cammicgo/kamikoseo/Probe.java", "com/cammicgo/kamikoseo/TranscriptFetcherStub.java") } } }
dependencies { implementation("com.github.TeamNewPipe:NewPipeExtractor:v0.27.1") }
application { mainClass.set("com.cammicgo.kamikoseo.Probe") }
