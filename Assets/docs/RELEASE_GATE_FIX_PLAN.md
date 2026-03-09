# Blocking Gates Fix Plan

## 1) Release Gate Pass Criteria
Gate 2 PASS when every external engine only runs if its explicit enable flag is true, and missing API keys yield status "disabled" or "not_available" while still appearing in results. No external engine executes solely because AIREALCHECK_USE_PAID_APIS is true.
Gate 3 PASS when VIDEO_ENGINE_GROUPS includes a non-empty whole_video_apis group and the grouped video score can use that group.
Gate 4 PASS when there is explicit audio-video consistency logic that can influence the video final score (not just conflict spread), guarded by a clear env flag.
Gate 5 PASS when at least one external audio engine exists, is modular, and is controlled by its own .env enable flag.
Gate 6 PASS when a data-driven weight learning or automatic weight optimization mechanism exists and can be enabled via .env.

## 2) Gate Fix Details

### Gate 2 — Modularity and .env Control
Problem: External engines can run without an explicit per-engine enable flag, and video Sightengine has no enable flag.
PASS condition: Every external engine requires its own enable flag and paid APIs switch, and missing keys still produce a visible engine_result with status "disabled" or "not_available".
Tasks:
1. Require explicit enable flags for image providers even when AIREALCHECK_USE_PAID_APIS is true.
Files: Backend/ensemble.py, Backend/engines/hive_engine.py, Backend/engines/reality_defender_engine.py, Backend/engines/sightengine_engine.py, Backend/engines/sensity_image_engine.py.
.env flags: Ensure AIREALCHECK_ENABLE_HIVE_IMAGE, AIREALCHECK_ENABLE_REALITY_DEFENDER_IMAGE, AIREALCHECK_ENABLE_SIGHTENGINE_IMAGE, AIREALCHECK_ENABLE_SENSITY_IMAGE are present with defaults false in .env and .env.example.
Tests: Update Backend/tests/test_image_provider_status.py to assert engines are disabled when enable flags are false even if paid APIs are on.
2. Add an explicit enable flag for video Sightengine and block it by default.
Files: Backend/engines/video_frame_detectors_engine.py.
.env flags: Add AIREALCHECK_ENABLE_SIGHTENGINE_VIDEO with default false in .env and .env.example.
Tests: Extend Backend/tests/test_video_frame_detectors_placeholders.py to assert Sightengine video remains disabled when the new flag is false.
Risks and dependencies:
- Any UI or monitoring that assumed paid APIs auto-enable will need alignment.
- External provider tests may require mocking requests.
- Ensure disabled engines still appear in engine_results via build_standard_result.

### Gate 3 — Video Architecture Completeness
Problem: VIDEO_ENGINE_GROUPS whole_video_apis is empty.
PASS condition: VIDEO_ENGINE_GROUPS has a non-empty whole_video_apis group and the grouped score uses it.
Tasks:
1. Promote at least one whole-video provider into whole_video_apis and execute it in the video pipeline.
Files: Backend/ensemble.py, Backend/server.py, Backend/engines/reality_defender_video_engine.py.
.env flags: Reuse AIREALCHECK_ENABLE_REALITY_DEFENDER_VIDEO for the whole-video path or add a distinct AIREALCHECK_ENABLE_REALITY_DEFENDER_WHOLE_VIDEO flag.
Tests: Add a test in Backend/tests to assert whole_video_apis is non-empty and that the grouped video score considers the whole-video engine when available.
2. Ensure the whole-video engine result is inserted into engine_results_raw for video before build_standard_result.
Files: Backend/server.py.
.env flags: No new flags beyond task 1.
Tests: Extend Backend/tests/test_engine_utils.py or add a new test to verify engine_results includes the whole-video engine entry.
Risks and dependencies:
- Provider API latency may affect overall video analysis runtime.
- If the provider cannot process video files, a fallback behavior must be defined.
- Group weight distribution may need adjustment after adding whole_video_apis.

### Gate 4 — Audio-Video Consistency
Problem: Audio results are only appended; they do not influence final video score.
PASS condition: Audio can influence the video final score via an explicit consistency or fusion step, gated by a clear .env flag.
Tasks:
1. Add a fusion step that adjusts the video final_ai when audio signals are present and AIREALCHECK_ENABLE_AUDIO_VIDEO_FUSION is true.
Files: Backend/ensemble.py, Backend/server.py.
.env flags: Add AIREALCHECK_ENABLE_AUDIO_VIDEO_FUSION and AIREALCHECK_AUDIO_VIDEO_FUSION_WEIGHT with safe defaults.
Tests: Add Backend/tests/test_audio_video_fusion.py to verify audio can shift final_ai and generate a consistency reason when enabled.
2. Add explicit reasons for audio-video alignment or conflict in the output.
Files: Backend/ensemble.py.
.env flags: None beyond task 1.
Tests: Extend the same fusion test to check reasons contain an audio-video consistency marker.
Risks and dependencies:
- Requires clear numeric combination logic to avoid destabilizing video scores.
- Must remain deterministic for reproducible outputs.
- Audio extraction for videos must be reliable to avoid false negatives.

### Gate 5 — External Audio Detectors
Problem: No external audio engine exists.
PASS condition: At least one external audio engine exists, is modular, and controlled via a dedicated .env flag.
Tasks:
1. Add an external audio engine wrapper and integrate it into the audio ensemble.
Files: Backend/engines/reality_defender_audio_engine.py, Backend/ensemble.py, Backend/server.py.
.env flags: Add AIREALCHECK_ENABLE_REALITY_DEFENDER_AUDIO and reuse REALITY_DEFENDER_API_KEY plus AIREALCHECK_USE_PAID_APIS.
Tests: Add Backend/tests/test_audio_provider_status.py mirroring image provider tests to assert disabled/not_available when key is missing or flag is off.
2. Ensure the external audio engine appears in engine_results for audio requests.
Files: Backend/ensemble.py, Backend/server.py.
.env flags: None beyond task 1.
Tests: Extend the new audio provider status test to check engine_results ordering includes the external audio engine.
Risks and dependencies:
- Provider API may not support audio content or may require different endpoints.
- Requires explicit timeouts to avoid blocking audio analysis.
- Needs stable error mapping to status "disabled" or "not_available".

### Gate 6 — Data-Driven Ensemble Weights
Problem: Weights are static with only manual JSON overrides.
PASS condition: A data-driven weight learning or optimization path exists and can be enabled via .env.
Tasks:
1. Add a learning or optimization script that produces learned weight files from logged analysis data.
Files: scripts/learn_weights.py, data/analysis_log.jsonl (input), data/learned_weights.json (output).
.env flags: Add AIREALCHECK_ENABLE_LEARNED_WEIGHTS and AIREALCHECK_LEARNED_WEIGHTS_PATH.
Tests: Add Backend/tests/test_weight_loading.py to verify learned weights load and override defaults when enabled.
2. Load learned weights when enabled and fall back to defaults otherwise.
Files: Backend/ensemble.py.
.env flags: Use AIREALCHECK_ENABLE_LEARNED_WEIGHTS and AIREALCHECK_LEARNED_WEIGHTS_PATH.
Tests: Extend Backend/tests/test_weight_loading.py to assert fallback to ENGINE_WEIGHTS when learned weights are unavailable.
Risks and dependencies:
- Requires enough logged data to produce stable weights.
- Learned weights must be validated to avoid negative or nonsensical values.
- Must define precedence with existing JSON overrides to avoid ambiguity.

## 3) Sequence and Dependencies
1. Gate 2 (explicit enable flags) is first, because it defines the execution controls for any new providers.
2. Gate 5 (external audio engine) depends on Gate 2 for consistent flag behavior.
3. Gate 3 (whole_video_apis) can be implemented in parallel with Gate 5 if provider selection is confirmed.
4. Gate 4 (audio-video fusion) depends on Gate 5 because it needs an external audio signal to be meaningful.
5. Gate 6 (learned weights) can proceed in parallel with Gate 3 and Gate 4 but should land after Gate 2 to keep config consistent.
