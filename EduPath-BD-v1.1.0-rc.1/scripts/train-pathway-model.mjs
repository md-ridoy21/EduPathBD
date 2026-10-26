import * as tf from "@tensorflow/tfjs";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const samples = [];

// Reproducible rule-derived profiles. Hard eligibility is deliberately not learned;
// the model only learns a soft pathway-fit score after the rule engine has passed.
for (const gpaClearance of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
  for (const groupMatch of [0, 1]) {
    for (const interestMatch of [0, 1]) {
      for (const stageMatch of [0, 0.5, 1]) {
        for (const flexibility of [0.25, 0.5, 0.75, 1]) {
          const interaction = groupMatch * interestMatch * 0.08 + stageMatch * gpaClearance * 0.05;
          const target = clamp(0.05 + 0.34 * gpaClearance + 0.25 * groupMatch + 0.18 * interestMatch + 0.1 * stageMatch + 0.05 * flexibility + interaction);
          samples.push({ input: [gpaClearance, groupMatch, interestMatch, stageMatch, flexibility], target });
        }
      }
    }
  }
}

const model = tf.sequential({
  layers: [
    tf.layers.dense({ inputShape: [5], units: 8, activation: "relu", kernelInitializer: tf.initializers.glorotUniform({ seed: 73 }), biasInitializer: "zeros" }),
    tf.layers.dense({ units: 1, activation: "sigmoid", kernelInitializer: tf.initializers.glorotUniform({ seed: 91 }), biasInitializer: "zeros" })
  ]
});
model.compile({ optimizer: tf.train.adam(0.025), loss: "meanSquaredError", metrics: ["mae"] });

const inputs = tf.tensor2d(samples.map((sample) => sample.input));
const targets = tf.tensor2d(samples.map((sample) => [sample.target]));
const history = await model.fit(inputs, targets, { epochs: 220, batchSize: 32, shuffle: false, verbose: 0, validationSplit: 0.2 });
const prediction = model.predict(inputs);
const mse = tf.metrics.meanSquaredError(targets, prediction).mean().dataSync()[0];
const mae = tf.metrics.meanAbsoluteError(targets, prediction).mean().dataSync()[0];
const weights = model.getWeights().map((tensor) => ({ shape: tensor.shape, values: Array.from(tensor.dataSync(), (value) => Number(value.toFixed(8))) }));

console.log(JSON.stringify({
  schemaVersion: 1,
  name: "EduPath Pathway Fit Neural Network",
  version: "2.0.0",
  framework: `TensorFlow.js ${tf.version.tfjs}`,
  trainedAt: "2026-09-12T00:00:00.000Z",
  training: { samples: samples.length, epochs: history.epoch.length, validationSplit: 0.2, loss: "meanSquaredError", mse: Number(mse.toFixed(6)), mae: Number(mae.toFixed(6)) },
  inputFeatures: ["gpaClearance", "groupMatch", "interestMatch", "stageMatch", "pathwayFlexibility"],
  layers: [{ units: 8, activation: "relu" }, { units: 1, activation: "sigmoid" }],
  weights
}, null, 2));

tf.dispose([inputs, targets, prediction]);
model.dispose();
