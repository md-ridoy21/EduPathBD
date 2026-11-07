import type { Pathway } from "../data/demo";
import artifact from "../model/pathway-fit-model.json";

export const LOCAL_MODEL_INFO = {
  name: artifact.name,
  version: artifact.version,
  runtime: artifact.framework,
  architecture: "trained 5→8→1 dense neural network",
  samples: artifact.training.samples,
  mae: artifact.training.mae,
  offline: true
} as const;

type ProfileInput = { level: string; group: string; gpa: string; interest: string; location: string };

let modelPromise: Promise<import("@tensorflow/tfjs").Sequential> | undefined;

async function loadModel() {
  if (!modelPromise) {
    modelPromise = import("@tensorflow/tfjs").then(async (tf) => {
      await tf.ready();
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [5], units: 8, activation: "relu" }),
          tf.layers.dense({ units: 1, activation: "sigmoid" })
        ]
      });
      const tensors = artifact.weights.map((weight) => tf.tensor(weight.values, weight.shape));
      model.setWeights(tensors);
      tensors.forEach((tensor) => tensor.dispose());
      return model;
    });
  }
  return modelPromise;
}

export async function predictPathwayFit(profile: ProfileInput, pathway: Pathway) {
  const gpa = Math.max(0, Math.min(5, Number(profile.gpa) || 0));
  const gpaClearance = Math.max(0, Math.min(1, (gpa - pathway.minimumGpa + 1.5) / 3));
  const groupMatch = pathway.groups.includes(profile.group) ? 1 : 0;
  const interestMatch = pathway.title === profile.interest ? 1 : 0;
  const stageMatch = profile.level === "SSC" ? (pathway.category === "Post-SSC" ? 1 : 0.35) : pathway.category === "Post-SSC" ? 0.45 : 1;
  const flexibility = pathway.groups.length / 4;
  const tf = await import("@tensorflow/tfjs");
  const model = await loadModel();
  const input = tf.tensor2d([[gpaClearance, groupMatch, interestMatch, stageMatch, flexibility]]);
  const output = model.predict(input) as import("@tensorflow/tfjs").Tensor;
  const score = Math.round(output.dataSync()[0] * 100);
  tf.dispose([input, output]);
  const reasons = [
    interestMatch ? "Primary interest strongly matches" : "Useful alternative pathway",
    groupMatch ? `${profile.group} group aligns with this pathway` : "Group compatibility needs rule confirmation",
    `Neural fit computed locally from ${artifact.training.samples} training profiles`
  ];
  return { score: Math.max(1, Math.min(99, score)), reasons, modelVersion: LOCAL_MODEL_INFO.version };
}
