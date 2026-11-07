# On-device pathway prediction

EduPath Pathway Fit v2 is a trained TensorFlow.js dense neural network bundled with the React/Capacitor build. It performs inference on the device and does not call Gemini, Firebase or any paid service.

## Inputs and output

Inputs are normalized GPA clearance, academic-group compatibility, interest match, current-stage match and pathway flexibility. The saved model has a 5→8→1 dense architecture. The reproducible `scripts/train-pathway-model.mjs` script creates 288 rule-derived profiles and trains for 220 epochs.

The UI shows the model version and feature-level reasons. `scripts/verify-pathway-model.mjs` validates the artifact, tensor shapes, recorded error and ranking behavior during every full QA run.

## Safety boundary

The neural model produces only a personalized fit score. It never decides admission eligibility. Hard eligibility comes from current database `AdmissionRule` records and returns matched programs, academic session, reasons and source URLs. Students are always directed to the latest official circular because subject-grade and special criteria may still apply.
