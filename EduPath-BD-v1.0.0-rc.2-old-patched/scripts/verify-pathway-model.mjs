import { readFile } from "node:fs/promises";
import * as tf from "@tensorflow/tfjs";

const artifact = JSON.parse(await readFile(new URL("../apps/web/src/model/pathway-fit-model.json", import.meta.url), "utf8"));

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

check(artifact.framework.startsWith("TensorFlow.js"), "model artifact identifies the TensorFlow.js framework");
check(artifact.training.samples >= 200 && artifact.training.epochs >= 100, "model artifact records a reproducible training run");
check(artifact.training.mae < 0.05, "recorded validation error stays below the acceptance threshold");
check(JSON.stringify(artifact.weights.map((weight) => weight.shape)) === JSON.stringify([[5, 8], [8], [8, 1], [1]]), "saved tensor shapes match the 5→8→1 architecture");

const model = tf.sequential({ layers: [
  tf.layers.dense({ inputShape: [5], units: 8, activation: "relu" }),
  tf.layers.dense({ units: 1, activation: "sigmoid" })
] });
const tensors = artifact.weights.map((weight) => tf.tensor(weight.values, weight.shape));
model.setWeights(tensors);
tensors.forEach((tensor) => tensor.dispose());
const inputs = tf.tensor2d([[0.1, 0, 0, 0, 0.25], [0.9, 1, 1, 1, 0.75]]);
const output = model.predict(inputs);
const [weakFit, strongFit] = await output.data();
check(Number.isFinite(weakFit) && Number.isFinite(strongFit) && strongFit > weakFit + 0.35, "trained model ranks a strongly compatible profile above a weak profile");
tf.dispose([inputs, output]);
model.dispose();
